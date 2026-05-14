const app = getApp()
const util = require('../../utils/util.js')
const cloud = require('../../utils/cloud.js')
const verification = require('../../utils/verification.js')
const db = wx.cloud.database()

Page({
  data: {
    currentClass: null,
    customName: '',
    classList: [],
    approvalEnabled: false,
    // 整体验证状态
    settingsVerified: false,
    showVerifyModal: false,
    verifyNum1: 0,
    verifyNum2: 0,
    verifyQuestion: '',
    verifyAnswer: '',
    verifyError: '',
    verifying: false,
    // 创建班级
    newClassName: '',
    creating: false,
    // 任务列表
    taskList: [],
    classTasks: [],
    privateTasks: [],
    userId: '',
    taskTab: 'class' // class | private
  },

  onLoad: function () {
    this.setData({
      currentClass: app.globalData.classInfo,
      customName: app.globalData.userInfo.customName || '',
      userId: app.globalData.userId
    })
    this.loadClassList()
    this.loadApprovalConfig()
    // 检查本地是否有验证状态
    const verified = wx.getStorageSync('settingsVerified')
    if (verified) {
      this.setData({ settingsVerified: true })
      this.loadUserTasks()
    }
  },

  onShow: function () {
    this.setData({
      currentClass: app.globalData.classInfo,
      customName: app.globalData.userInfo.customName || ''
    })
    this.loadClassList()
    if (this.data.settingsVerified) {
      this.loadUserTasks()
    }
  },

  loadClassList: async function () {
    // 加载所有公开班级
    if (!this.data.currentClass) {
      try {
        const result = await db.collection('classes').orderBy('memberCount', 'desc').get()
        this.setData({
          classList: result.data
        })
      } catch (error) {
        console.error('加载班级列表失败', error)
      }
    }
  },

  onNameInput: function (e) {
    this.setData({
      customName: e.detail.value.trim()
    })
  },

  saveCustomName: async function () {
    const userId = app.globalData.userId
    if (!userId) {
      wx.showToast({ title: '用户信息未加载', icon: 'error' })
      return
    }

    wx.showLoading({ title: '保存中...' })

    try {
      // 更新数据库
      await wx.cloud.database().collection('users').doc(userId).update({
        data: {
          customName: this.data.customName
        }
      })

      // 更新全局数据
      app.globalData.userInfo.customName = this.data.customName

      // 更新本地缓存
      wx.setStorageSync('userInfo', app.globalData.userInfo)

      wx.hideLoading()
      wx.showToast({ title: '保存成功！', icon: 'success' })
    } catch (error) {
      wx.hideLoading()
      console.error('保存失败', error)
      wx.showToast({ title: '保存失败', icon: 'error' })
    }
  },

  // 跳转到创建任务
  goToCreateTask: function () {
    wx.navigateTo({
      url: '/pages/createTask/createTask'
    })
  },

  // 加载用户创建的任务列表
  loadUserTasks: async function () {
    const userId = app.globalData.userId
    const classInfo = app.globalData.classInfo

    try {
      const result = await wx.cloud.callFunction({
        name: 'getUserTasks',
        data: {
          userId: userId,
          classId: classInfo ? classInfo._id : null
        }
      })

      if (result.result.success) {
        this.setData({
          taskList: result.result.data.allTasks,
          classTasks: result.result.data.classTasks,
          privateTasks: result.result.data.privateTasks
        })
      }
    } catch (error) {
      console.error('加载任务列表失败', error)
    }
  },

  // 编辑任务
  editTask: function (e) {
    const task = e.currentTarget.dataset.task
    wx.navigateTo({
      url: `/pages/createTask/createTask?taskId=${task._id}&title=${encodeURIComponent(task.title)}&description=${encodeURIComponent(task.description || '')}&experienceReward=${task.experienceReward}`
    })
  },

  // 切换任务Tab
  switchTaskTab: function (e) {
    const tab = e.currentTarget.dataset.tab
    console.log('[设置页面] 切换Tab:', tab)
    this.setData({ taskTab: tab })
  },

  // 删除任务
  deleteTask: function (e) {
    const task = e.currentTarget.dataset.task
    wx.showModal({
      title: '确认删除',
      content: `确定要删除任务"${task.title}"吗？`,
      success: async (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '删除中...' })
          try {
            const result = await wx.cloud.callFunction({
              name: 'deleteTask',
              data: {
                taskId: task._id,
                userId: app.globalData.userId
              }
            })

            wx.hideLoading()
            if (result.result.success) {
              wx.showToast({ title: '删除成功', icon: 'success' })
              // 重新加载任务列表，确保视图更新
              setTimeout(() => {
                this.loadUserTasks()
              }, 100)
            } else {
              wx.showToast({ title: result.result.message || '删除失败', icon: 'error' })
            }
          } catch (error) {
            wx.hideLoading()
            console.error('删除任务失败', error)
            wx.showToast({ title: '删除失败', icon: 'error' })
          }
        }
      }
    })
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

      if (res.result.success) {
        this.setData({
          approvalEnabled: res.result.enabled
        })
      }
    } catch (error) {
      console.error('加载审批配置失败', error)
    }
  },

  // 切换审批开关
  toggleApproval: async function (e) {
    const enabled = e.detail.value

    try {
      await wx.cloud.callFunction({
        name: 'taskApproval',
        data: {
          action: 'setApprovalConfig',
          data: { enabled }
        }
      })

      this.setData({ approvalEnabled: enabled })

      wx.showToast({
        title: enabled ? '审批已开启' : '审批已关闭',
        icon: 'success'
      })
    } catch (error) {
      console.error('切换审批开关失败', error)
      wx.showToast({ title: '操作失败', icon: 'error' })
    }
  },

  // 显示验证弹窗
  showVerifyModal: function () {
    this.generateVerifyQuestion()
    this.setData({
      showVerifyModal: true,
      verifyAnswer: '',
      verifyError: ''
    })
  },

  // 生成验证题目
  generateVerifyQuestion: function () {
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
  cancelVerify: function () {
    this.setData({
      showVerifyModal: false
    })
  },

  // 提交验证
  submitVerify: async function () {
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
          settingsVerified: true,
          showVerifyModal: false,
          verifyError: ''
        })
        // 保存到本地
        wx.setStorageSync('settingsVerified', true)
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
          this.generateVerifyQuestion()
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

  leaveClass: function () {
    wx.showModal({
      title: '确认退出',
      content: '确定要退出当前班级吗？',
      success: async (res) => {
        if (res.confirm) {
          const userId = app.globalData.userId
          try {
            await cloud.updateUserClass(userId, null)
            app.globalData.classInfo = null
            this.setData({
              currentClass: null
            })
            this.loadClassList()
            wx.showToast({ title: '已退出班级', icon: 'success' })
          } catch (error) {
            console.error('退出班级失败', error)
            wx.showToast({ title: '退出失败', icon: 'error' })
          }
        }
      }
    })
  },

  onNewClassNameInput: function (e) {
    this.setData({
      newClassName: e.detail.value.trim()
    })
  },

  createClass: function () {
    const name = this.data.newClassName
    if (!name) {
      wx.showToast({ title: '请输入班级名称', icon: 'error' })
      return
    }
    this.doCreateClass()
  },

  doCreateClass: async function () {
    const name = this.data.newClassName
    const userId = app.globalData.userId

    this.setData({ creating: true })

    try {
      const result = await cloud.createClass(name, userId)

      this.setData({ creating: false })

      if (result.success) {
        app.globalData.classInfo = result.classInfo
        this.setData({
          currentClass: result.classInfo,
          newClassName: '',
          classList: []
        })
        wx.showToast({ title: '班级创建成功', icon: 'success' })
      } else {
        wx.showToast({ title: result.message || '创建失败', icon: 'error' })
      }
    } catch (error) {
      console.error('创建班级失败', error)
      this.setData({ creating: false })
      wx.showToast({ title: '创建失败', icon: 'error' })
    }
  },

  joinClassFromList: function (e) {
    const classId = e.currentTarget.dataset.id
    this.joinClassById(classId)
  },

  async joinClassById(classId) {
    try {
      const userId = app.globalData.userId
      await cloud.updateUserClass(userId, classId)
      const res = await db.collection('classes').doc(classId).get()
      app.globalData.classInfo = res.data

      wx.showToast({ title: '加入班级成功', icon: 'success' })
      this.setData({
        currentClass: res.data,
        classList: []
      })

    } catch (error) {
      console.error('加入班级失败', error)
      wx.showToast({ title: '加入失败', icon: 'error' })
    }
  }
})
