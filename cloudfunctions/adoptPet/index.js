// 云函数：宠物领养
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const { petData } = event

  console.log('========================================')
  console.log('[adoptPet] 开始宠物领养')
  console.log('[adoptPet] OPENID:', OPENID)
  console.log('[adoptPet] petData:', JSON.stringify(petData, null, 2))
  console.log('========================================')

  try {
    // 1. 先根据 openid 查找用户
    const userRes = await db.collection('users').where({
      openid: OPENID
    }).get()

    if (userRes.data.length === 0) {
      return {
        success: false,
        error: '用户不存在'
      }
    }

    const userId = userRes.data[0]._id
    console.log('[adoptPet] 找到用户，userId:', userId)

    // 2. 创建宠物记录
    const petCreateRes = await db.collection('pets').add({
      data: {
        ...petData,
        _openid: OPENID,  // 设置权限字段
        createTime: db.serverDate(),
        updateTime: db.serverDate()
      }
    })

    const petId = petCreateRes._id
    console.log('[adoptPet] 宠物创建成功，petId:', petId)

    // 3. 更新用户的 petId
    const userUpdateRes = await db.collection('users').doc(userId).update({
      data: {
        petId: petId
      }
    })

    console.log('[adoptPet] 用户 petId 更新结果:', userUpdateRes.stats)

    console.log('========================================')
    console.log('[adoptPet] 领养完成')
    console.log('========================================')

    return {
      success: true,
      petId: petId,
      petData: {
        ...petData,
        _id: petId
      }
    }

  } catch (error) {
    console.error('[adoptPet] 领养失败:', error)
    return {
      success: false,
      error: error.message
    }
  }
}
