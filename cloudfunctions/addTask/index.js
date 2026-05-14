// 云函数：添加自定义任务
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

exports.main = async (event, context) => {
  const { title, description, classId, experienceReward, creatorId } = event

  if (!title || title.trim().length === 0) {
    return {
      success: false,
      message: '任务标题不能为空'
    }
  }

  // 默认值
  const exp = experienceReward || 10

  try {
    const result = await db.collection('tasks').add({
      data: {
        title: title.trim(),
        description: description ? description.trim() : '',
        type: 'custom',
        classId: classId || null,
        experienceReward: exp,
        isActive: true,
        creatorId,
        createTime: db.serverDate()
      }
    })

    return {
      success: true,
      taskId: result._id,
      message: '任务创建成功'
    }
  } catch (error) {
    console.error('创建任务失败', error)
    return {
      success: false,
      message: '创建任务失败: ' + error.message
    }
  }
}
