// 云数据库操作封装

const db = wx.cloud.database()

// 获取用户信息
function getUserInfo(userId) {
  return db.collection('users').doc(userId).get()
}

// 获取宠物信息
function getPetInfo(petId) {
  return db.collection('pets').doc(petId).get()
}

// 创建宠物
function createPet(data) {
  return db.collection('pets').add({
    data
  })
}

// 更新宠物信息
function updatePet(petId, data) {
  return db.collection('pets').doc(petId).update({
    data
  })
}

// 获取可用任务列表
// 获取所有活跃任务后在客户端过滤，兼容微信小程序查询语法
async function getAvailableTasks(classId, userId) {
  const result = await db.collection('tasks').where({
    isActive: true
  }).get()

  // 过滤：全局任务 + 当前班级任务 + 用户自己创建的任务
  const filteredData = result.data.filter(task => {
    return task.classId === null || task.classId === classId || task.creatorId === userId
  })

  return {
    data: filteredData
  }
}

// 获取用户任务状态
function getUserTasks(userId) {
  return db.collection('userTasks').where({
    userId
  }).get()
}

// 完成任务（直接完成，用于未开启审批的情况）
async function completeTask(userId, taskId, expGain) {
  // 检查是否今天已经完成
  const isCompleted = await isTaskCompletedToday(userId, taskId)
  if (isCompleted) {
    return {
      success: false,
      message: '今天已经完成过这个任务了'
    }
  }

  // 检查是否已经存在记录
  const existing = await db.collection('userTasks').where({
    userId,
    taskId
  }).get()

  // 添加或更新任务记录，记录获得的经验
  if (existing.data.length === 0) {
    await db.collection('userTasks').add({
      data: {
        userId,
        taskId,
        status: 'completed',
        expGain: expGain || 0,
        completeTime: new Date(),
        createTime: new Date()
      }
    })
  } else {
    await db.collection('userTasks').doc(existing.data[0]._id).update({
      data: {
        status: 'completed',
        expGain: expGain || 0,
        completeTime: new Date()
      }
    })
  }

  return {
    success: true
  }
}

// 提交任务待审批（用于开启审批的情况）
async function submitTaskForApproval(userId, taskId, expGain, taskName) {
  // 检查是否今天已经完成（包括审批通过的）
  const isCompleted = await isTaskCompletedToday(userId, taskId)
  if (isCompleted) {
    return {
      success: false,
      message: '今天已经完成过这个任务了'
    }
  }

  // 检查是否今天已经有 pending 或 waiting_approval 状态
  const isWaiting = await isTaskWaitingApproval(userId, taskId)
  if (isWaiting) {
    return {
      success: false,
      message: '任务已提交，等待审批'
    }
  }

  // 检查今天是否有 rejected 状态，如果有就更新它
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  const todayTasks = await db.collection('userTasks').where({
    userId,
    taskId
  }).get()

  const rejectedToday = todayTasks.data.find(item => {
    if (item.status === 'rejected' && item.submitTime) {
      const d = new Date(item.submitTime)
      return d >= today && d < tomorrow
    }
    return false
  })

  if (rejectedToday) {
    // 今天被拒绝过，重新提交审批
    await db.collection('userTasks').doc(rejectedToday._id).update({
      data: {
        status: 'waiting_approval',
        submitTime: new Date()
      }
    })
    return { success: true }
  }

  // 创建新记录
  await db.collection('userTasks').add({
    data: {
      userId,
      taskId,
      taskName,
      status: 'waiting_approval',
      expGain: expGain || 0,
      submitTime: new Date(),
      createTime: new Date()
    }
  })

  return { success: true }
}

// 检查任务是否待审批
async function isTaskWaitingApproval(userId, taskId) {
  // 获取今天日期字符串（YYYY-MM-DD 格式）
  const now = new Date()
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

  const result = await db.collection('userTasks')
    .where({
      userId,
      taskId,
      status: 'waiting_approval'
    })
    .get()

  if (result.data.length === 0) {
    return false
  }

  // 检查是否是今天提交的
  for (const item of result.data) {
    if (item.submitTime) {
      const d = new Date(item.submitTime)
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      if (dateStr === todayStr) {
        return true
      }
    }
  }

  return false
}

// 创建班级
function createClass(name, code) {
  return db.collection('classes').add({
    data: {
      name,
      code,
      memberCount: 0,
      createTime: new Date()
    }
  })
}

// 通过加入码查找班级
function findClassByCode(code) {
  return db.collection('classes').where({
    code: code
  }).get()
}

// 更新用户班级
function updateUserClass(userId, classId) {
  return db.collection('users').doc(userId).update({
    data: {
      classId: classId
    }
  })
}

// 获取班级成员
function getClassMembers(classId) {
  return db.collection('users').where({
    classId: classId
  }).get()
}

// 检查用户今日是否已完成任务（包括审批通过的）
async function isTaskCompletedToday(userId, taskId) {
  // 获取今天日期字符串（YYYY-MM-DD 格式，最可靠）
  const now = new Date()
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

  const result = await db.collection('userTasks')
    .where({
      userId,
      taskId
    })
    .get()

  console.log('[任务检查] 查询结果:', result.data, '今天日期:', todayStr)

  if (result.data.length === 0) {
    return false
  }

  // 检查是否是今天完成或审批通过的
  for (const item of result.data) {
    console.log('[任务检查] 遍历记录:', item._id, 'status:', item.status)

    // 如果是 completed 或 approved 状态
    if (item.status === 'completed' || item.status === 'approved') {
      // 检查所有时间字段，任一为今天就算完成
      const timeFields = ['completeTime', 'approveTime', 'submitTime', 'createTime']
      for (const field of timeFields) {
        if (item[field]) {
          const d = new Date(item[field])
          const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
          console.log('[任务检查] 字段:', field, '原始值:', item[field], '转换后:', dateStr)
          if (dateStr === todayStr) {
            console.log('[任务检查] 匹配成功，任务已完成')
            return true
          }
        }
      }
    }
  }

  console.log('[任务检查] 未匹配到今日完成记录')
  return false
}

module.exports = {
  getUserInfo,
  getPetInfo,
  createPet,
  updatePet,
  getAvailableTasks,
  getUserTasks,
  completeTask,
  submitTaskForApproval,
  isTaskWaitingApproval,
  createClass,
  findClassByCode,
  updateUserClass,
  getClassMembers,
  isTaskCompletedToday
}
