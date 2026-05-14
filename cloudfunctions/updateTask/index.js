// 云函数：更新自定义任务
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

exports.main = async (event, context) => {
  const { taskId, title, description, experienceReward, classId, userId } = event

  if (!taskId) {
    return {
      success: false,
      message: '任务ID不能为空'
    }
  }

  if (!title || title.trim().length === 0) {
    return {
      success: false,
      message: '任务标题不能为空'
    }
  }

  try {
    // 先查询任务，验证是否是创建者
    const taskResult = await db.collection('tasks').doc(taskId).get()
    const task = taskResult.data

    if (!task) {
      return {
        success: false,
        message: '任务不存在'
      }
    }

    // 验证是否是创建者
    if (task.creatorId !== userId) {
      return {
        success: false,
        message: '只能修改自己创建的任务'
      }
    }

    // 准备更新数据
    const updateData = {
      title: title.trim(),
      experienceReward: experienceReward || 10,
      updateTime: db.serverDate()
    }

    if (description !== undefined) {
      updateData.description = description.trim()
    }

    // 支持更新任务范围（个人/班级）
    if (classId !== undefined) {
      updateData.classId = classId
    }

    // 更新任务
    await db.collection('tasks').doc(taskId).update({
      data: updateData
    })

    return {
      success: true,
      message: '任务更新成功'
    }
  } catch (error) {
    console.error('更新任务失败', error)
    return {
      success: false,
      message: '更新任务失败: ' + error.message
    }
  }
}
