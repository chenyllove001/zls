const app = getApp()

Page({
  data: {
    // 表单相关
    taskId: '',
    title: '',
    description: '',
    experienceReward: 10,
    scope: 'private', // private | class
    hasClass: false,
    creating: false,
    isEdit: false
  },

  onLoad: async function (options) {
    // 检查是否在班级中
    const hasClass = !!app.globalData.classInfo
    this.setData({
      hasClass: hasClass,
      scope: hasClass ? 'class' : 'private'
    })

    // 如果是编辑模式
    if (options.taskId) {
      wx.setNavigationBarTitle({ title: '编辑任务' })
      this.setData({
        isEdit: true,
        taskId: options.taskId,
        title: decodeURIComponent(options.title || ''),
        description: decodeURIComponent(options.description || ''),
        experienceReward: parseInt(options.experienceReward) || 10
      })

      // 获取任务的 classId 来确定当前范围
      try {
        const db = wx.cloud.database()
        const res = await db.collection('tasks').doc(options.taskId).get()
        if (res.data) {
          const taskClassId = res.data.classId
          // 如果 classId 为 null 则是个人任务，否则是班级任务
          const taskScope = taskClassId === null ? 'private' : 'class'
          this.setData({ scope: taskScope })
        }
      } catch (error) {
        console.error('获取任务详情失败', error)
      }
    }
  },

  // 表单输入处理
  onTitleInput: function (e) {
    this.setData({
      title: e.detail.value.trim()
    })
  },

  onDescriptionInput: function (e) {
    this.setData({
      description: e.detail.value.trim()
    })
  },

  onExpChange: function (e) {
    this.setData({
      experienceReward: e.detail.value
    })
  },

  changeScope: function (e) {
    this.setData({
      scope: e.currentTarget.dataset.scope
    })
  },

  createTask: async function () {
    if (!this.data.title) {
      wx.showToast({ title: '请输入任务标题', icon: 'error' })
      return
    }

    this.setData({ creating: true })

    const userId = app.globalData.userId
    const classInfo = app.globalData.classInfo
    const classId = this.data.scope === 'class' && classInfo ? classInfo._id : null

    try {
      let result
      if (this.data.isEdit) {
        // 编辑模式
        result = await wx.cloud.callFunction({
          name: 'updateTask',
          data: {
            taskId: this.data.taskId,
            title: this.data.title,
            description: this.data.description,
            experienceReward: this.data.experienceReward,
            classId: classId,
            userId: userId
          }
        })
      } else {
        // 创建模式
        result = await wx.cloud.callFunction({
          name: 'addTask',
          data: {
            title: this.data.title,
            description: this.data.description,
            classId: classId,
            experienceReward: this.data.experienceReward,
            creatorId: userId
          }
        })
      }

      this.setData({ creating: false })

      if (result.result.success) {
        wx.showToast({
          title: this.data.isEdit ? '任务更新成功' : '任务创建成功',
          icon: 'success'
        })
        setTimeout(() => {
          wx.navigateBack()
        }, 1500)
      } else {
        wx.showToast({
          title: result.result.message || (this.data.isEdit ? '更新失败' : '创建失败'),
          icon: 'error'
        })
      }
    } catch (error) {
      console.error(this.data.isEdit ? '更新任务失败' : '创建任务失败', error)
      this.setData({ creating: false })
      wx.showToast({
        title: this.data.isEdit ? '更新失败' : '创建失败',
        icon: 'error'
      })
    }
  }
})
