// 云函数：获取用户创建的任务列表
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

exports.main = async (event, context) => {
  const { userId, classId } = event

  if (!userId) {
    return {
      success: false,
      message: '用户ID不能为空'
    }
  }

  try {
    // 1. 查询用户创建的班级任务（同班级的所有人都能看到）
    const classTasksPromise = classId ? db.collection('tasks').where({
      classId: classId,
      type: 'custom',
      isActive: true
    }).orderBy('createTime', 'desc').get() : Promise.resolve({ data: [] })

    // 2. 查询用户创建的个人任务
    const privateTasksPromise = db.collection('tasks').where({
      creatorId: userId,
      classId: null,
      type: 'custom',
      isActive: true
    }).orderBy('createTime', 'desc').get()

    const [classResult, privateResult] = await Promise.all([classTasksPromise, privateTasksPromise])

    // 标记任务类型
    const classTasks = classResult.data.map(task => ({
      ...task,
      taskType: 'class',
      canEdit: task.creatorId === userId
    }))

    const privateTasks = privateResult.data.map(task => ({
      ...task,
      taskType: 'private',
      canEdit: true
    }))

    // 合并并按班级优先排序
    const allTasks = [...classTasks, ...privateTasks]

    return {
      success: true,
      data: {
        classTasks,
        privateTasks,
        allTasks,
        classTaskCount: classTasks.length,
        privateTaskCount: privateTasks.length,
        totalTaskCount: allTasks.length
      },
      message: '获取任务列表成功'
    }
  } catch (error) {
    console.error('获取任务列表失败', error)
    return {
      success: false,
      message: '获取任务列表失败: ' + error.message
    }
  }
}
