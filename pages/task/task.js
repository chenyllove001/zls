const app = getApp()
const cloud = require('../../utils/cloud.js')
const petCalculator = require('../../utils/petCalculator.js')
const verification = require('../../utils/verification.js')
const db = wx.cloud.database()

Page({
  data: {
    tasks: [],
    taskStatus: {}, // taskId -> status: pending/completed/waiting_approval
    dailyExp: 0,
    remainingExp: 100,
    approvalEnabled: false,
    pendingTasks: [],
    pendingCount: 0,
    currentTab: 'tasks', // tasks | approval
    // 审批验证
    showApprovalVerify: false,
    approvalVerified: false,
    verifyNum1: 0,
    verifyNum2: 0,
    verifyQuestion: '',
    verifyAnswer: '',
    verifyError: '',
    verifying: false
  },

  onLoad: function () {
    this.loadTasks()
    this.loadApprovalConfig()
  },

  onShow: function () {
    // 强制刷新任务列表，确保删除后的任务不再显示
    console.log('[任务页面] onShow - 重新加载任务列表和审批配置')
    this.loadTasks()
    this.loadApprovalConfig()
    // 如果当前在审批tab，也刷新审批列表
    if (this.data.currentTab === 'approval' && this.data.approvalVerified) {
      this.loadPendingTasks()
    }
  },

  onPullDownRefresh: function () {
    this.loadTasks(() => {
      wx.stopPullDownRefresh()
    })
  },

  loadTasks: async function (callback) {
    const userId = app.globalData.userId
    if (!userId) {
      if (callback) callback()
      return
    }

    const classInfo = app.globalData.classInfo
    const classId = classInfo ? classInfo._id : null

    try {
      // 获取今日已获得经验
      const dailyExp = await petCalculator.getTodayExp(userId)
      const remainingExp = Math.max(0, petCalculator.DAILY_MAX_EXP - dailyExp)

      // 获取所有可用任务，最多显示10个
      const taskRes = await cloud.getAvailableTasks(classId, userId)
      let tasks = taskRes.data
      // 按创建时间倒序排列（最新的在最上面）
      tasks = tasks.sort((a, b) => {
        return new Date(b.createTime || 0) - new Date(a.createTime || 0)
      }).slice(0, 10)

      const taskStatus = {}

      // 2. 用和后端完全一致的逻辑判断每个任务状态，避免不一致
      for (const task of tasks) {
        // 检查是否已完成
        const isCompleted = await cloud.isTaskCompletedToday(userId, task._id)
        if (isCompleted) {
          taskStatus[task._id] = 'completed'
          continue
        }
        // 检查是否待审批
        const isWaiting = await cloud.isTaskWaitingApproval(userId, task._id)
        if (isWaiting) {
          taskStatus[task._id] = 'waiting_approval'
        }
      }

      console.log('[任务加载] 最终任务状态:', taskStatus)

      this.setData({
        tasks,
        taskStatus,
        dailyExp,
        remainingExp
      })

      if (callback) callback()
    } catch (error) {
      console.error('加载任务失败', error)
      wx.showToast({ title: '加载失败', icon: 'error' })
      if (callback) callback()
    }
  },

  onTaskComplete: async function (e) {
    const taskId = e.detail.taskId
    const userId = app.globalData.userId
    const petId = app.globalData.petInfo ? app.globalData.petInfo._id : null

    if (!petId) {
      wx.showToast({ title: '还没有领养宠物', icon: 'error' })
      return
    }

    // 检查今天是否已经完成
    const isCompleted = await cloud.isTaskCompletedToday(userId, taskId)
    if (isCompleted) {
      wx.showToast({ title: '今天已经完成过这个任务了', icon: 'none' })
      return
    }

    // 检查今日经验上限
    if (this.data.remainingExp <= 0) {
      wx.showToast({ title: '今日经验已经满了哦，明天再来吧', icon: 'none' })
      return
    }

    const task = this.data.tasks.find(t => t._id === taskId)

    console.log('[任务完成] 审批状态检查:', {
      approvalEnabled: this.data.approvalEnabled,
      currentStatus: this.data.taskStatus[taskId]
    })

    // 如果开启了审批，先提交审批
    if (this.data.approvalEnabled) {
      // 检查任务状态
      const currentStatus = this.data.taskStatus[taskId]
      if (currentStatus === 'waiting_approval') {
        wx.showToast({ title: '已提交，等待审批', icon: 'none' })
        return
      }
      if (currentStatus === 'completed') {
        wx.showToast({ title: '今天已经完成过这个任务了', icon: 'none' })
        return
      }

      wx.showLoading({ title: '提交审批中...' })
      try {
        // 直接在客户端写入 userTasks 集合，状态为 waiting_approval
        const result = await cloud.submitTaskForApproval(userId, taskId, task.experienceReward, task.title)

        if (!result.success) {
          wx.hideLoading()
          wx.showToast({ title: result.message || '提交失败', icon: 'none' })
          return
        }

        // 更新状态为待审批
        const taskStatus = { ...this.data.taskStatus }
        taskStatus[taskId] = 'waiting_approval'
        this.setData({ taskStatus })

        wx.hideLoading()
        wx.showToast({
          title: '已提交，等待审批',
          icon: 'success'
        })
      } catch (error) {
        wx.hideLoading()
        console.error('提交审批失败', error)
        wx.showToast({ title: '提交失败', icon: 'error' })
      }
      return
    }

    // 未开启审批，直接完成
    wx.showLoading({ title: '提交中...' })

    try {
      // 标记任务完成，记录获得的经验
      await cloud.completeTask(userId, taskId, task.experienceReward)

      // 获取当前宠物信息
      let petRes = await cloud.getPetInfo(petId)
      let currentPet = petRes.data

      // 获取今日已获得经验
      const todayExp = await petCalculator.getTodayExp(userId)

      // 应用奖励（考虑每日上限）
      const result = petCalculator.applyRewards(currentPet, task, todayExp)

      result.newPet.lastUpdateTime = new Date()

      // 保存更新
      await cloud.updatePet(petId, {
        experience: result.newPet.experience,
        level: result.newPet.level,
        attack: result.newPet.attack,
        speed: result.newPet.speed,
        defense: result.newPet.defense,
        hp: result.newPet.hp,
        attributePoints: result.newPet.attributePoints,
        evolutionStage: result.newPet.evolutionStage,
        imageUrl: result.newPet.imageUrl,
        lastUpdateTime: new Date()
      })

      // 更新状态
      const taskStatus = { ...this.data.taskStatus }
      taskStatus[taskId] = 'completed'
      this.setData({
        taskStatus,
        dailyExp: todayExp + result.actuallyGained,
        remainingExp: Math.max(0, petCalculator.DAILY_MAX_EXP - (todayExp + result.actuallyGained))
      })

      // 更新全局数据
      app.globalData.petInfo = result.newPet

      wx.hideLoading()

      if (result.overLimit) {
        if (result.actuallyGained > 0) {
          wx.showModal({
            title: '任务完成',
            content: `获得 ${result.actuallyGained} 经验，今日经验已上限`,
            showCancel: false
          })
        } else {
          wx.showToast({
            title: '今日经验已经满了',
            icon: 'none'
          })
        }
      } else if (result.pointsGained > 0) {
        // 升级了，获得属性点
        wx.showModal({
          title: '恭喜升级🎉',
          content: `你的宠物升到了 Lv.${result.newPet.level}！获得 ${result.pointsGained} 点属性点，快去宠物页面分配吧~`,
          showCancel: false
        })
      } else {
        wx.showToast({
          title: `任务完成！+${result.actuallyGained} 经验`,
          icon: 'success'
        })
      }

    } catch (error) {
      wx.hideLoading()
      console.error('完成任务失败', error)
      wx.showToast({ title: '完成任务失败', icon: 'error' })
    }
  },

  goToCreateTask: function () {
    wx.navigateTo({
      url: '/pages/createTask/createTask'
    })
  },

  // Tab 切换
  switchTab: function (e) {
    const tab = e.currentTarget.dataset.tab

    if (tab === 'tasks') {
      // 切换到任务列表，刷新任务数据
      this.loadTasks()
    }

    if (tab === 'approval') {
      // 点击审批 tab，检查是否已验证
      if (!this.data.approvalVerified) {
        this.generateApprovalVerifyQuestion()
        this.setData({
          showApprovalVerify: true,
          verifyAnswer: '',
          verifyError: ''
        })
        return
      }
      // 已验证，刷新待审批列表
      this.loadPendingTasks()
    }

    this.setData({
      currentTab: tab
    })
  },

  // 生成审批验证题目
  generateApprovalVerifyQuestion: function () {
    const q = verification.generateQuestion()
    this.setData({
      verifyNum1: q.num1,
      verifyNum2: q.num2,
      verifyQuestion: q.question,
      verifyAnswer: '',
      verifyError: ''
    })
  },

  // 验证答案输入
  onVerifyAnswerInput: function (e) {
    this.setData({
      verifyAnswer: e.detail.value
    })
  },

  // 取消验证
  cancelApprovalVerify: function () {
    this.setData({
      showApprovalVerify: false
    })
  },

  // 提交验证
  submitApprovalVerify: async function () {
    const userAnswer = parseInt(this.data.verifyAnswer)
    if (isNaN(userAnswer)) {
      this.setData({
        verifyError: '请输入有效的数字答案'
      })
      return
    }

    this.setData({ verifying: true })

    try {
      // 云函数验证
      const result = await wx.cloud.callFunction({
        name: 'checkAnswer',
        data: {
          num1: this.data.verifyNum1,
          num2: this.data.verifyNum2,
          userAnswer: this.data.verifyAnswer
        }
      })

      this.setData({ verifying: false })

      if (result.result.correct) {
        // 验证通过
        this.setData({
          approvalVerified: true,
          showApprovalVerify: false,
          verifyError: '',
          currentTab: 'approval'
        })
        // 加载待审批任务
        this.loadPendingTasks()
        wx.showToast({
          title: '验证通过！',
          icon: 'success'
        })
      } else {
        // 验证失败，生成新题目
        const correctAnswer = this.data.verifyNum1 * this.data.verifyNum2
        this.setData({
          verifyError: `回答错误，正确答案是 ${correctAnswer}，换一题试试吧`
        })
        setTimeout(() => {
          this.generateApprovalVerifyQuestion()
        }, 1500)
      }
    } catch (error) {
      console.error('验证失败', error)
      this.setData({
        verifying: false,
        verifyError: '验证请求失败，请重试'
      })
    }
  },

  // 加载审批配置
  loadApprovalConfig: async function () {
    try {
      const res = await wx.cloud.callFunction({
        name: 'taskApproval',
        data: {
          action: 'getApprovalConfig'
        }
      })

      console.log('[任务页面] 审批配置加载结果:', res.result)

      if (res.result.success) {
        this.setData({
          approvalEnabled: res.result.enabled
        })
        console.log('[任务页面] 审批开关状态:', res.result.enabled ? '开启' : '关闭')
      }
    } catch (error) {
      console.error('加载审批配置失败', error)
    }
  },

  // 加载待审批任务
  loadPendingTasks: async function () {
    try {
      const res = await wx.cloud.callFunction({
        name: 'taskApproval',
        data: {
          action: 'getPendingTasks'
        }
      })

      if (res.result.success) {
        // 按提交时间倒序排列（最新的在最上面）
        const sortedTasks = res.result.pendingTasks.sort((a, b) => {
          return new Date(b.submitTime) - new Date(a.submitTime)
        })

        this.setData({
          pendingTasks: sortedTasks,
          pendingCount: sortedTasks.length
        })
      }
    } catch (error) {
      console.error('加载待审批任务失败', error)
    }
  },

  // 审批任务
  approveTask: async function (e) {
    const { taskId, approved } = e.currentTarget.dataset

    wx.showLoading({ title: '处理中...' })

    try {
      await wx.cloud.callFunction({
        name: 'taskApproval',
        data: {
          action: 'approveTask',
          data: {
            pendingTaskId: taskId,
            isApproved: approved
          }
        }
      })

      wx.hideLoading()
      wx.showToast({
        title: approved ? '已通过' : '已拒绝',
        icon: 'success'
      })

      // 刷新两个列表：审批列表减少一项，任务列表状态更新
      this.loadPendingTasks()
      this.loadTasks()

    } catch (error) {
      wx.hideLoading()
      console.error('审批失败', error)
      wx.showToast({ title: '审批失败', icon: 'error' })
    }
  }
})
