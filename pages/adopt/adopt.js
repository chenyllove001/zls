const app = getApp()
const cloud = require('../../utils/cloud.js')
const petCalculator = require('../../utils/petCalculator.js')

Page({
  data: {
    petTypes: [
      { type: 'cat', name: '小猫', image: 'cat_stage1.png' },
      { type: 'dog', name: '小狗', image: 'dog_stage1.png' },
      { type: 'bird', name: '小龟', image: 'bird_stage1.png' }
    ],
    selectedType: '',
    petName: '',
    canAdopt: false
  },

  onLoad: function () {
    // 检查是否已经有宠物了
    if (app.globalData.hasPet) {
      wx.showModal({
        title: '提示',
        content: '你已经有宠物了，确定要领养新的吗？（原有宠物会被替换）',
        success: (res) => {
          if (!res.confirm) {
            wx.navigateBack()
          }
        }
      })
    }
  },

  selectPet: function (e) {
    const type = e.currentTarget.dataset.type
    this.setData({
      selectedType: type
    })
    this.checkCanAdopt()
  },

  onNameInput: function (e) {
    this.setData({
      petName: e.detail.value.trim()
    })
    this.checkCanAdopt()
  },

  checkCanAdopt: function () {
    const canAdopt = this.data.selectedType && this.data.petName.length > 0
    this.setData({ canAdopt })
  },

  adoptPet: async function () {
    if (!this.data.canAdopt) return

    const userId = app.globalData.userId
    if (!userId) {
      wx.showToast({ title: '用户信息未加载', icon: 'error' })
      return
    }

    wx.showLoading({ title: '领养中...' })

    try {
      // 创建宠物记录 - 使用新四维属性
      const petType = this.data.selectedType
      const initData = petCalculator.initPet(userId, this.data.petName, petType)

      // 获取对应阶段图片URL (0级是蛋)
      initData.imageUrl = petCalculator.getPetImageByLevel(petType, initData.level)

      console.log('[领养] 准备调用云函数，petData:', initData)

      // 调用云函数完成领养（避免权限问题）
      const cloudResult = await wx.cloud.callFunction({
        name: 'adoptPet',
        data: {
          petData: initData
        }
      })

      console.log('[领养] 云函数返回结果:', cloudResult.result)

      if (!cloudResult.result.success) {
        throw new Error(cloudResult.result.error || '领养失败')
      }

      const petId = cloudResult.result.petId
      const petInfo = cloudResult.result.petData

      // 更新全局数据
      app.globalData.hasPet = true
      app.globalData.petInfo = petInfo

      wx.hideLoading()
      wx.showToast({ title: '领养成功！', icon: 'success' })

      setTimeout(() => {
        wx.switchTab({
          url: '/pages/index/index'
        })
      }, 1500)

    } catch (error) {
      wx.hideLoading()
      console.error('领养失败', error)
      wx.showToast({ title: '领养失败', icon: 'error' })
    }
  }
})
