// 云函数：任务审批相关操作
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const { action, data } = event

  console.log('[taskApproval] action:', action, 'OPENID:', OPENID)

  switch (action) {
    case 'getApprovalConfig':
      return getApprovalConfig()
    case 'setApprovalConfig':
      return setApprovalConfig(data.enabled)
    case 'getPendingTasks':
      return getPendingTasks()
    case 'approveTask':
      return approveTask(data.pendingTaskId, data.isApproved)
    default:
      return { success: false, error: '未知操作' }
  }
}

// 获取审批配置
async function getApprovalConfig() {
  try {
    const res = await db.collection('app_config').where({
      key: 'taskApprovalEnabled'
    }).get()

    if (res.data.length > 0) {
      return {
        success: true,
        enabled: res.data[0].value
      }
    } else {
      // 默认关闭
      return {
        success: true,
        enabled: false
      }
    }
  } catch (error) {
    console.error('获取配置失败:', error)
    // 如果是集合不存在的错误，也返回默认值（关闭）
    if (error.errCode === -502005 || error.message.includes('DATABASE_COLLECTION_NOT_EXIST')) {
      return {
        success: true,
        enabled: false,
        info: '集合不存在，使用默认值'
      }
    }
    return { success: false, error: error.message }
  }
}

// 设置审批配置
async function setApprovalConfig(enabled) {
  try {
    const res = await db.collection('app_config').where({
      key: 'taskApprovalEnabled'
    }).get()

    if (res.data.length > 0) {
      await db.collection('app_config').doc(res.data[0]._id).update({
        data: {
          value: enabled,
          updateTime: db.serverDate()
        }
      })
    } else {
      await db.collection('app_config').add({
        data: {
          key: 'taskApprovalEnabled',
          value: enabled,
          createTime: db.serverDate(),
          updateTime: db.serverDate()
        }
      })
    }

    return { success: true, enabled }
  } catch (error) {
    console.error('设置配置失败:', error)
    // 如果是集合不存在的错误，尝试先创建（云开发会自动创建集合）
    if (error.errCode === -502005 || error.message.includes('DATABASE_COLLECTION_NOT_EXIST')) {
      try {
        // 直接添加第一条记录，云开发会自动创建集合
        await db.collection('app_config').add({
          data: {
            key: 'taskApprovalEnabled',
            value: enabled,
            createTime: db.serverDate(),
            updateTime: db.serverDate()
          }
        })
        return { success: true, enabled, info: '自动创建集合' }
      } catch (e) {
        console.error('创建集合失败:', e)
        return { success: false, error: e.message }
      }
    }
    return { success: false, error: error.message }
  }
}


// 获取待审批任务列表（从 userTasks 集合读取）
async function getPendingTasks() {
  try {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const res = await db.collection('userTasks').where({
      status: 'waiting_approval'
    }).orderBy('submitTime', 'desc').get()

    // 补充用户信息
    const pendingTasks = []
    for (const task of res.data) {
      // 只显示今天的待审批任务
      if (task.submitTime) {
        const submitDate = new Date(task.submitTime)
        if (submitDate < today) continue
      }

      const userRes = await db.collection('users').doc(task.userId).get()
      pendingTasks.push({
        _id: task._id,
        userId: task.userId,
        taskId: task.taskId,
        taskName: task.taskName || '未命名任务',
        experienceReward: task.expGain || 0,
        userName: userRes.data ? (userRes.data.customName || userRes.data.nickName) : '未知用户',
        submitTime: task.submitTime
      })
    }

    return { success: true, pendingTasks }
  } catch (error) {
    console.error('获取待审批任务失败:', error)
    // 如果是集合不存在的错误，返回空列表
    if (error.errCode === -502005 || error.message.includes('DATABASE_COLLECTION_NOT_EXIST')) {
      return { success: true, pendingTasks: [], info: '集合不存在' }
    }
    return { success: false, error: error.message }
  }
}

// 审批任务
async function approveTask(pendingTaskId, isApproved) {
  try {
    // 1. 先获取任务信息
    const taskRes = await db.collection('userTasks').doc(pendingTaskId).get()
    const task = taskRes.data
    if (!task) {
      return { success: false, error: '任务不存在' }
    }

    // 2. 更新 userTasks 中的任务状态
    await db.collection('userTasks').doc(pendingTaskId).update({
      data: {
        status: isApproved ? 'completed' : 'rejected',
        approveTime: db.serverDate(),
        completeTime: isApproved ? db.serverDate() : null
      }
    })

    // 3. 如果审批通过，给宠物加经验
    if (isApproved && task.userId && task.expGain) {
      const userRes = await db.collection('users').doc(task.userId).get()
      if (userRes.data && userRes.data.petId) {
        const petId = userRes.data.petId
        const petRes = await db.collection('pets').doc(petId).get()
        if (petRes.data) {
          // 计算新经验
          const currentExp = petRes.data.experience || 0
          const newExp = currentExp + task.expGain

          // 计算等级（每100经验升一级）
          const newLevel = Math.floor(newExp / 100) + 1

          // 更新宠物
          await db.collection('pets').doc(petId).update({
            data: {
              experience: newExp,
              level: newLevel
            }
          })
          console.log('[审批通过] 经验已发放，petId:', petId, 'exp:', task.expGain)
        }
      }
    }

    return { success: true }
  } catch (error) {
    console.error('审批失败:', error)
    return { success: false, error: error.message }
  }
}
