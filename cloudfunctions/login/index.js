// 云函数：用户登录初始化
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

exports.main = async (event, context) => {
  const { OPENID, APPID } = cloud.getWXContext()
  const { userInfo } = event
  const isGuest = userInfo && userInfo.isGuest

  console.log('========================================')
  console.log('[login云函数] 开始登录流程')
  console.log('[login云函数] OPENID:', OPENID)
  console.log('[login云函数] 前端传入的 userInfo:', JSON.stringify(userInfo, null, 2))
  console.log('========================================')

  // 查找用户是否已存在
  const userRes = await db.collection('users').where({
    openid: OPENID
  }).get()

  // 如果 userInfo 为空，只查询不创建，用于前端判断是否需要补全信息
  if (!userInfo) {
    console.log('[login云函数] 查询模式，只返回用户信息')
    if (userRes.data.length > 0) {
      const existingUser = userRes.data[0]
      return {
        userId: existingUser._id,
        openid: OPENID,
        userInfo: {
          nickName: existingUser.nickName || '',
          avatarUrl: existingUser.avatarUrl || '',
          customName: existingUser.customName || ''
        },
        success: true
      }
    } else {
      return {
        success: false,
        error: '用户不存在'
      }
    }
  }

  let userId = null
  let resultUserInfo = null

  // 安全获取昵称，处理可能的不同字段名
  const getNickName = () => {
    if (!userInfo) return '匿名用户'
    // 尝试多种可能的字段名
    if (userInfo.nickName) return userInfo.nickName
    if (userInfo.nickname) return userInfo.nickname
    return '匿名用户'
  }

  // 安全获取头像
  const getAvatarUrl = () => {
    if (!userInfo) return ''
    if (userInfo.avatarUrl) return userInfo.avatarUrl
    if (userInfo.avatar) return userInfo.avatar
    return ''
  }

  if (userRes.data.length === 0) {
    // 新用户，创建记录
    // customName 默认使用微信昵称，用户可以在设置中修改
    // 模拟器中默认返回 "微信用户"，这种情况给个占位
    let nickName = getNickName()
    if (nickName === '微信用户' || nickName === '游客') {
      nickName = '同学'  // 模拟器测试时默认值
    }
    const avatarUrl = getAvatarUrl()

    // 游客模式：使用默认昵称和头像
    if (isGuest) {
      nickName = '游客'
    }

    console.log('[login云函数] creating new user, nickName:', nickName, 'isGuest:', isGuest)

    const createRes = await db.collection('users').add({
      data: {
        _openid: OPENID,  // 必须设置，用于数据库权限判断
        openid: OPENID,
        appid: APPID,
        nickName: nickName,
        avatarUrl: avatarUrl,
        customName: nickName,
        isGuest: isGuest,
        classId: null,
        petId: null,
        createTime: db.serverDate(),
        lastActiveTime: db.serverDate()
      }
    })
    userId = createRes._id
    resultUserInfo = {
      nickName: nickName,
      avatarUrl: avatarUrl,
      customName: nickName,
      isGuest: isGuest
    }
  } else {
    // 已存在用户
    userId = userRes.data[0]._id
    const existingUser = userRes.data[0]

    console.log('[login云函数] 老用户登录，现有信息:')
    console.log('  existing.nickName:', existingUser.nickName)
    console.log('  existing.customName:', existingUser.customName)
    console.log('  existing.avatarUrl:', existingUser.avatarUrl)

    // customName 逻辑：
    // - 如果用户在设置中修改过（不是默认值"同学"），保留
    // - 如果是默认值"同学"或为空，使用新传入的昵称
    const isDefaultCustomName = !existingUser.customName || existingUser.customName === '同学'
    const finalCustomName = isDefaultCustomName
      ? (getNickName() || existingUser.nickName || '同学')
      : existingUser.customName

    // nickName 使用新传入的昵称（如果有新值的话）
    const finalNickName = getNickName() || existingUser.nickName || '同学'

    // avatarUrl 使用新传入的头像（如果有新值的话）
    const finalAvatarUrl = getAvatarUrl() || existingUser.avatarUrl || ''

    // 游客升级逻辑：如果原来是游客，现在传入了有效信息，则升级为正式用户
    const wasGuest = existingUser.isGuest
    const upgradingFromGuest = wasGuest && getNickName() && getNickName() !== '游客'
    const finalIsGuest = upgradingFromGuest ? false : (wasGuest || false)

    resultUserInfo = {
      nickName: finalNickName,
      avatarUrl: finalAvatarUrl,
      customName: finalCustomName,
      isGuest: finalIsGuest
    }

    console.log('[login云函数] 处理后返回的用户信息:')
    console.log('  nickName:', finalNickName)
    console.log('  customName:', finalCustomName)
    console.log('  avatarUrl:', finalAvatarUrl)
    console.log('  isGuest:', finalIsGuest, 'upgrading:', upgradingFromGuest)

    // 更新用户信息和最后活跃时间
    const updateData = {
      lastActiveTime: db.serverDate()
    }

    // 游客升级时清除 isGuest 标记
    if (upgradingFromGuest) {
      updateData.isGuest = false
    }

    // 只有传入了新头像才更新（避免用临时路径覆盖云存储路径）
    if (getAvatarUrl() && getAvatarUrl().startsWith('cloud://')) {
      updateData.avatarUrl = finalAvatarUrl
    }

    // 只有传入了有效昵称才更新
    if (getNickName() && getNickName() !== '微信用户' && getNickName() !== '游客') {
      updateData.nickName = finalNickName
      // 如果 customName 是默认值，也一起更新
      if (isDefaultCustomName) {
        updateData.customName = finalCustomName
      }
    }

    await db.collection('users').doc(userId).update({
      data: updateData
    })
  }

  console.log('========================================')
  console.log('[login云函数] 登录完成，返回结果:')
  console.log('  userId:', userId)
  console.log('  nickName:', resultUserInfo.nickName)
  console.log('  customName:', resultUserInfo.customName)
  console.log('  avatarUrl:', resultUserInfo.avatarUrl)
  console.log('========================================')

  return {
    userId,
    openid: OPENID,
    userInfo: resultUserInfo,
    success: true
  }
}
