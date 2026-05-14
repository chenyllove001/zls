const app = getApp()
const cloud = require('../../utils/cloud.js')
const petCalculator = require('../../utils/petCalculator.js')
const util = require('../../utils/util.js')

Page({
  data: {
    petInfo: null,
    expPercent: 0,
    evolutionStage: 1,
    currentImage: '',
    adoptTime: '',
    canAddPoints: false,
    defaultImage: '/assets/images/default-pet.png'
  },

  onLoad: function () {
    this.loadPetInfo()
  },

  onShow: function () {
    this.loadPetInfo()
  },

  loadPetInfo: async function () {
    const userId = app.globalData.userId
    if (!userId) return

    this.setData({
      petInfo: app.globalData.petInfo
    })

    if (!app.globalData.petInfo) {
      return
    }

    let pet = { ...app.globalData.petInfo }

    // 计算经验衰减（根据天数掉经验）
    const decayResult = petCalculator.calculateExpDecay(pet)
    if (decayResult.experience !== pet.experience) {
      pet.experience = decayResult.experience
      pet.lastUpdateTime = new Date()

      // 检查是否升级（掉经验不会降级）
      await cloud.updatePet(pet._id, {
        experience: decayResult.experience,
        lastUpdateTime: new Date()
      })

      app.globalData.petInfo = pet
      this.setData({
        petInfo: pet
      })
    }

    // 计算进化阶段
    const evolutionStage = petCalculator.getEvolutionStage(pet.level)
    // 获取当前阶段图片
    const currentImage = pet.evolutionStage === evolutionStage
      ? pet.imageUrl
      : `/assets/images/${pet.type}_stage${evolutionStage}.png`

    // 更新宠物进化阶段到数据库
    if (pet.evolutionStage !== evolutionStage) {
      await cloud.updatePet(pet._id, {
        evolutionStage,
        imageUrl: currentImage
      })
      pet.evolutionStage = evolutionStage
      pet.imageUrl = currentImage
      app.globalData.petInfo = pet
    }

    const expPercent = petCalculator.getExpPercentage(pet.experience)

    let adoptTime = ''
    if (pet.adoptTime) {
      const date = pet.adoptTime instanceof Date
        ? pet.adoptTime
        : new Date(pet.adoptTime)
      adoptTime = util.formatTime(date)
    }

    this.setData({
      petInfo: pet,
      evolutionStage,
      currentImage,
      expPercent,
      adoptTime,
      canAddPoints: pet.attributePoints > 0
    })
  },

  addPoint: async function (e) {
    const attr = e.currentTarget.dataset.attr
    const petId = this.data.petInfo._id

    if (this.data.petInfo.attributePoints <= 0) {
      wx.showToast({ title: '没有属性点了', icon: 'warning' })
      return
    }

    const result = petCalculator.addAttributePoint(this.data.petInfo, attr)
    if (!result.success) {
      wx.showToast({ title: result.message, icon: 'warning' })
      return
    }

    // 保存到数据库
    await cloud.updatePet(petId, {
      [attr]: result.newPet[attr],
      attributePoints: result.newPet.attributePoints
    })

    // 更新本地数据
    app.globalData.petInfo = result.newPet
    this.setData({
      petInfo: result.newPet,
      canAddPoints: result.newPet.attributePoints > 0
    })

    wx.showToast({
      title: `+1 ${this.getAttrName(attr)}`,
      icon: 'success'
    })
  },

  getAttrName: function (attr) {
    const names = {
      attack: '攻击',
      speed: '速度',
      defense: '防御',
      hp: '生命'
    }
    return names[attr] || attr
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
  }
})
