const app = getApp()
const petCalculator = require('../../utils/petCalculator.js')

Page({
  data: {
    userInfo: {},
    petInfo: null,
    classInfo: null,
    hasPet: false,
    nextLevelExp: 100,
    expPercent: 0,
    defaultAvatar: '/assets/images/default-avatar.png',
    defaultImage: '/assets/images/default-pet.png'
  },

  onLoad: function () {
    // 如果未登录，跳转到登录页面
    if (!app.globalData.userId) {
      wx.reLaunch({
        url: '/pages/login/login'
      })
      return
    }
    this.setData({
      userInfo: app.globalData.userInfo || {},
      petInfo: app.globalData.petInfo,
      classInfo: app.globalData.classInfo,
      hasPet: app.globalData.hasPet
    })
    this.calculateExp()
  },

  onShow: function () {
    // 每次显示页面刷新数据
    // 先更新当前数据，再等待刷新完成
    this.setData({
      userInfo: app.globalData.userInfo || {},
      petInfo: app.globalData.petInfo,
      classInfo: app.globalData.classInfo,
      hasPet: app.globalData.hasPet
    })
    this.calculateExp()
    app.refreshUserInfo(() => {
      this.setData({
        userInfo: app.globalData.userInfo || {},
        petInfo: app.globalData.petInfo,
        classInfo: app.globalData.classInfo,
        hasPet: app.globalData.hasPet
      })
      this.calculateExp()
    })
  },

  onPullDownRefresh: function () {
    app.refreshUserInfo(() => {
      this.setData({
        userInfo: app.globalData.userInfo || {},
        petInfo: app.globalData.petInfo,
        classInfo: app.globalData.classInfo,
        hasPet: app.globalData.hasPet
      })
      this.calculateExp()
      wx.stopPullDownRefresh()
    })
  },

  calculateExp: function () {
    if (this.data.petInfo) {
      const nextLevelExp = petCalculator.getNextLevelExp(this.data.petInfo.level)
      const expPercent = petCalculator.getExpPercentage(this.data.petInfo.experience)
      this.setData({
        nextLevelExp,
        expPercent
      })
    }
  },

  goToPet: function () {
    wx.navigateTo({
      url: '/pages/pet/pet'
    })
  },

  goToTasks: function () {
    wx.switchTab({
      url: '/pages/task/task'
    })
  },

  goToAdopt: function () {
    wx.navigateTo({
      url: '/pages/adopt/adopt'
    })
  },

  goToClass: function () {
    wx.switchTab({
      url: '/pages/class/class'
    })
  },

  goToCreateTask: function () {
    wx.navigateTo({
      url: '/pages/createTask/createTask'
    })
  },

  goToSettings: function () {
    wx.switchTab({
      url: '/pages/settings/settings'
    })
  }
})
