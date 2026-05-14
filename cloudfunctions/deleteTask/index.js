// 云函数：删除自定义任务
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

exports.main = async (event, context) => {
  const { taskId, userId } = event

  if (!taskId) {
    return {
      success: false,
      message: '任务ID不能为空'
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
        message: '只能删除自己创建的任务'
      }
    }

    // 删除任务（软删除，标记为非活跃）
    await db.collection('tasks').doc(taskId).update({
      data: {
        isActive: false,
        deleteTime: db.serverDate()
      }
    })

    return {
      success: true,
      message: '任务删除成功'
    }
  } catch (error) {
    console.error('删除任务失败', error)
    return {
      success: false,
      message: '删除任务失败: ' + error.message
    }
  }
}
