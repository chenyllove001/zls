const app = getApp()

Page({
  data: {
    loading: false,
    loadingText: '正在登录...',
    bgImage: '/assets/images/login-bg.jpg',
    step: 1, // 1: 选择头像, 2: 输入昵称
    tempAvatarUrl: '',
    tempNickName: '',
    canLogin: false,
    existingUserId: null // 已存在用户ID，用于快速登录
  },

  onLoad: function () {
    // 如果已经登录，直接跳转首页
    if (app.globalData.userId && app.globalData.userInfo) {
      this.goToHome()
      return
    }

    // 查询用户信息（但不自动登录，都需要用户主动点击）
    this.checkUserExist()
  },

  // 检查用户是否已存在
  checkUserExist: function () {
    console.log('[登录] 检查用户是否已存在...')

    wx.cloud.callFunction({
      name: 'login',
      data: {
        userInfo: null  // 传空表示只查询，不创建/更新
      },
      success: res => {
        console.log('[登录] 用户查询结果:', res.result)

        if (res.result.success && res.result.userId) {
          // 用户已存在，预填现有信息，但不自动登录
          const userInfo = res.result.userInfo
          console.log('[登录] 用户已存在，等待用户主动点击登录')
          // 预填现有信息，用户点击后直接登录
          this.setData({
            tempAvatarUrl: userInfo.avatarUrl || '',
            tempNickName: userInfo.nickName || '',
            existingUserId: res.result.userId
          })
        } else {
          // 新用户，正常走选择流程
          console.log('[登录] 新用户，需要选择头像昵称')
        }
      },
      fail: err => {
        console.error('[登录] 查询用户失败:', err)
        // 查询失败，继续走正常流程
      }
    })
  },

  // 老用户快速登录
  quickLogin: function () {
    console.log('[登录] 老用户快速登录')
    const savedUserInfo = wx.getStorageSync('userInfo')
    if (savedUserInfo) {
      this.doLogin(savedUserInfo)
    } else {
      // 缓存失效，重新走正常流程
      this.setData({ existingUserId: null })
    }
  },

  // 选择头像（新用户）
  onChooseAvatar: function (e) {
    console.log('========================================')
    console.log('[登录] 选择头像成功')
    console.log('  头像URL:', e.detail.avatarUrl)
    console.log('========================================')

    const avatarUrl = e.detail.avatarUrl

    // 新用户，正常走流程
    this.setData({
      tempAvatarUrl: avatarUrl,
      step: 2
    })

    // 上传头像到云存储
    this.uploadAvatar(avatarUrl)
  },

  // 上传头像到云存储
  uploadAvatar: function (tempFilePath) {
    const cloudPath = `avatar/${Date.now()}-${Math.random().toString(36).substr(2, 9)}.png`

    wx.cloud.uploadFile({
      cloudPath: cloudPath,
      filePath: tempFilePath,
      success: res => {
        console.log('[登录] 头像上传成功，fileID:', res.fileID)
        this.setData({
          tempAvatarUrl: res.fileID
        })
        this.checkCanLogin()
      },
      fail: err => {
        console.error('[登录] 头像上传失败:', err)
        // 上传失败也可以继续，使用临时路径
        this.checkCanLogin()
      }
    })
  },

  // 输入昵称
  onNicknameInput: function (e) {
    this.setData({
      tempNickName: e.detail.value.trim()
    })
    this.checkCanLogin()
  },

  // 检查是否可以登录
  checkCanLogin: function () {
    const canLogin = this.data.tempAvatarUrl && this.data.tempNickName.length > 0
    this.setData({ canLogin })
  },

  // 确认登录
  confirmLogin: function () {
    if (!this.data.canLogin) return

    const userInfo = {
      nickName: this.data.tempNickName,
      avatarUrl: this.data.tempAvatarUrl
    }

    console.log('========================================')
    console.log('[登录] 准备登录，用户信息:')
    console.log('  nickName:', userInfo.nickName)
    console.log('  avatarUrl:', userInfo.avatarUrl)
    console.log('========================================')

    this.doLogin(userInfo)
  },

  doLogin: function (wxUserInfo) {
    this.setData({
      loading: true,
      loadingText: '正在登录...'
    })

    console.log('[登录] 开始调用云函数，wxUserInfo:', wxUserInfo)

    // 调用云函数登录
    wx.cloud.callFunction({
      name: 'login',
      data: {
        userInfo: wxUserInfo
      },
      success: res => {
        console.log('========================================')
        console.log('[登录] 云函数调用成功')
        console.log('[登录] 完整返回结果:', JSON.stringify(res.result, null, 2))
        console.log('========================================')

        const result = res.result
        const { userId, userInfo, success } = result

        if (success && userId) {
          // 保存到全局数据
          app.globalData.userId = userId
          app.globalData.userInfo = userInfo
          console.log('========================================')
          console.log('[登录] 保存到全局数据完成')
          console.log('  userId:', app.globalData.userId)
          console.log('  userInfo.nickName:', app.globalData.userInfo.nickName)
          console.log('  userInfo.customName:', app.globalData.userInfo.customName)
          console.log('  userInfo.avatarUrl:', app.globalData.userInfo.avatarUrl)
          console.log('========================================')

          // 保存到本地缓存，下次快速登录
          wx.setStorageSync('userInfo', app.globalData.userInfo)

          // 获取用户宠物和班级信息
          this.loadUserData(userId)
        } else {
          this.setData({ loading: false })
          console.error('[登录] 返回结果不对', { success, userId })
          wx.showToast({
            title: '登录失败，请重试',
            icon: 'error'
          })
        }
      },
      fail: err => {
        console.error('[登录] 云函数调用失败', err)
        this.setData({ loading: false })
        wx.showModal({
          title: '登录失败',
          content: '云函数调用超时，请检查：\n1. 是否已经上传部署 login 云函数\n2. 云环境配置是否正确',
          showCancel: false
        })
      }
    })
  },

  loadUserData: function (userId) {
    this.setData({
      loadingText: '加载数据...'
    })

    console.log('[登录] 开始加载用户数据，userId:', userId)

    let pending = 2
    const checkComplete = () => {
      pending--
      if (pending === 0) {
        console.log('[登录] 数据加载完成，hasPet:', app.globalData.hasPet, 'petInfo:', app.globalData.petInfo)
        this.setData({ loading: false })
        // 登录成功，跳转到首页
        this.goToHome()
      }
    }

    app.getUserPet(userId, checkComplete)
    app.getUserClass(userId, checkComplete)
  },

  // 游客登录
  guestLogin: function () {
    console.log('[登录] 游客模式登录')

    const guestInfo = {
      nickName: '游客',
      avatarUrl: '',
      isGuest: true
    }

    this.doLogin(guestInfo)
  },

  goToHome: function () {
    wx.switchTab({
      url: '/pages/index/index'
    })
  }
})
