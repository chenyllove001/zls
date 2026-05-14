const app = getApp()
const cloud = require('../../utils/cloud.js')
const db = wx.cloud.database()

Page({
  data: {
    classInfo: null,
    members: [],
    sortedMembers: []
  },

  onLoad: function () {
    this.loadClassInfo()
  },

  onShow: function () {
    this.loadClassInfo()
  },

  onPullDownRefresh: function () {
    this.loadClassInfo(() => {
      wx.stopPullDownRefresh()
    })
  },

  loadClassInfo: async function (callback) {
    const classInfo = app.globalData.classInfo
    this.setData({
      classInfo
    })

    if (classInfo) {
      await this.loadMembers(classInfo._id)
    }

    if (callback) callback()
  },

  loadMembers: async function (classId) {
    try {
      const memberRes = await cloud.getClassMembers(classId)
      const members = memberRes.data
      const sortedMembers = []

      for (const member of members) {
        if (member.petId) {
          const petRes = await cloud.getPetInfo(member.petId)
          sortedMembers.push({
            member,
            pet: petRes.data
          })
        } else {
          sortedMembers.push({
            member,
            pet: null
          })
        }
      }

      // 按等级排序，高到低，再按经验排序
      sortedMembers.sort((a, b) => {
        if (!a.pet && !b.pet) return 0
        if (!a.pet) return 1
        if (!b.pet) return -1
        if (a.pet.level !== b.pet.level) {
          return b.pet.level - a.pet.level
        }
        return b.pet.experience - a.pet.experience
      })

      this.setData({
        members,
        sortedMembers
      })
    } catch (error) {
      console.error('加载成员失败', error)
    }
  }
})
