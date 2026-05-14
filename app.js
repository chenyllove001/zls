App({
  onLaunch: function () {
    // 云开发初始化
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力')
    } else {
      wx.cloud.init({
        // env 参数说明：
        //   env 参数决定接下来小程序发起的云开发调用（wx.cloud.xxx）会默认请求到哪个云环境的资源
        //   此处请填入环境 ID, 环境 ID 可打开云控制台查看
        //   如不填则使用默认环境（第一个创建的环境）
        // env: '',
        traceUser: true,
      })
    }

    this.globalData = {
      userId: null,
      userInfo: null,
      petInfo: null,
      classInfo: null,
      hasPet: false
    }

    // 现在登录流程移到登录页面处理
    // app 启动后不自动登录，等待用户在登录页面点击按钮
  },

  // 保存登录结果，由登录页面调用
  setLoginInfo: function(userId, userInfo) {
    this.globalData.userId = userId
    this.globalData.userInfo = userInfo
  },

  login: function(wxUserInfo, callback) {
    const that = this
    wx.cloud.callFunction({
      name: 'login',
      data: {
        userInfo: wxUserInfo
      },
      success: res => {
        console.log('[登录] 成功', res)
        const { userId, userInfo, success } = res.result
        if (success && userId) {
          that.globalData.userId = userId
          that.globalData.userInfo = userInfo
        }
        if (callback) callback(res.result)
      },
      fail: err => {
        console.error('[登录] 失败', err)
        if (callback) callback({ success: false, error: err })
      }
    })
  },

  getUserPet: function(userId, callback) {
    const that = this
    const db = wx.cloud.database()
    db.collection('users').doc(userId).get().then(res => {
      console.log('[getUserPet] 查询用户结果:', res.data)

      if (res.data && res.data.petId && res.data.petId !== null) {
        // 用户有宠物ID，查询宠物详情
        that.globalData.hasPet = true
        console.log('[getUserPet] 有宠物，petId:', res.data.petId)
        db.collection('pets').doc(res.data.petId).get().then(petRes => {
          console.log('[getUserPet] 宠物详情:', petRes.data)
          that.globalData.petInfo = petRes.data
          if (callback) callback()
        }).catch(err => {
          console.error('[getUserPet] 获取宠物详情失败:', err)
          // 获取宠物详情失败，但用户确实有 petId，所以 hasPet 还是 true
          if (callback) callback()
        })
      } else if (res.data) {
        // 用户没有宠物ID 或 petId 为 null
        console.log('[getUserPet] 没有宠物，petId:', res.data.petId)
        // 只有当内存中当前没有宠物时，才设置为 false
        // 如果内存已经有宠物了，说明是刚领养的，数据库可能还没同步，不覆盖状态
        if (!that.globalData.hasPet || !that.globalData.petInfo) {
          that.globalData.hasPet = false
          that.globalData.petInfo = null
        }
        if (callback) callback()
      } else {
        // 查询结果异常，不改变原有状态
        console.log('[getUserPet] 查询结果异常')
        if (callback) callback()
      }
    }).catch(err => {
      console.error('[getUserPet] 查询用户失败:', err)
      // 查询失败，不改变原有状态
      if (callback) callback()
    })
  },

  getUserClass: function(userId, callback) {
    const that = this
    const db = wx.cloud.database()
    db.collection('users').doc(userId).get().then(res => {
      if (res.data && res.data.classId) {
        db.collection('classes').doc(res.data.classId).get().then(classRes => {
          that.globalData.classInfo = classRes.data
          if (callback) callback()
        }).catch(() => {
          // 获取班级详情失败，保留原有数据
          if (callback) callback()
        })
      } else if (res.data) {
        // 明确查到没有 classId，才设置为 null
        that.globalData.classInfo = null
        if (callback) callback()
      } else {
        // 查询结果异常，不改变原有状态
        if (callback) callback()
      }
    }).catch(() => {
      // 查询失败，不改变原有状态
      if (callback) callback()
    })
  },

  refreshUserInfo: function(callback) {
    if (this.globalData.userId) {
      const db = wx.cloud.database()
      let pending = 3
      const checkComplete = () => {
        pending--
        if (pending === 0 && callback) {
          callback()
        }
      }
      // 重新获取用户信息（包括自定义昵称）
      db.collection('users').doc(this.globalData.userId).get().then(res => {
        if (res.data) {
          if (this.globalData.userInfo) {
            // 如果数据库中有 customName 就更新
            if (res.data.customName !== undefined) {
              this.globalData.userInfo.customName = res.data.customName
            } else if (res.data.nickName !== undefined && this.globalData.userInfo.customName === undefined) {
              // 兜底：旧数据没有 customName，使用 nickName
              this.globalData.userInfo.customName = res.data.nickName
            }
          } else {
            // 如果全局没有用户信息，从数据库创建
            const customName = res.data.customName !== undefined
              ? res.data.customName
              : (res.data.nickName || '匿名用户')
            this.globalData.userInfo = {
              nickName: res.data.nickName,
              avatarUrl: res.data.avatarUrl,
              customName
            }
          }
        }
        checkComplete()
      }).catch(() => {
        // 获取自定义昵称失败，保留原有数据
        checkComplete()
      })
      this.getUserPet(this.globalData.userId, checkComplete)
      this.getUserClass(this.globalData.userId, checkComplete)
    } else {
      if (callback) callback()
    }
  }
})
