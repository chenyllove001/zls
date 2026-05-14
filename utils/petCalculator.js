// 宠物属性计算器 - 新版: 四维属性 + 升级加点 + 每日经验限制

// 每一级升级所需经验固定 100
const EXP_PER_LEVEL = 100

// 每日最大获得经验
const DAILY_MAX_EXP = 100

// 每日不做任务掉落经验
const DAILY_EXP_LOSS = 20

// 初始四维属性
const INITIAL_ATTRIBUTES = {
  attack: 5,
  speed: 5,
  defense: 5,
  hp: 10
}

// 计算升级所需经验
function getNextLevelExp(level) {
  // 每一级都需要 100 经验才能升级
  return EXP_PER_LEVEL
}

// 获取当前等级的经验百分比
function getExpPercentage(currentExp) {
  return Math.floor((currentExp / EXP_PER_LEVEL) * 100)
}

// 检查是否可以升级
function checkLevelUp(currentLevel, currentExp) {
  const required = EXP_PER_LEVEL
  if (currentExp >= required) {
    return {
      canLevelUp: true,
      newLevel: currentLevel + 1,
      remainingExp: currentExp - required
    }
  }
  return {
    canLevelUp: false,
    newLevel: currentLevel,
    remainingExp: currentExp
  }
}

// 计算经验衰减（根据天数）
function calculateExpDecay(pet) {
  const now = new Date()
  const lastUpdate = pet.lastUpdateTime ? new Date(pet.lastUpdateTime) : now
  const daysPassed = Math.floor((now.getTime() - lastUpdate.getTime()) / (1000 * 60 * 60 * 24))

  if (daysPassed <= 1) {
    return {
      experience: pet.experience,
      daysPassed,
      expLoss: 0
    }
  }

  // 每天掉 20 经验，最少 0
  const expLoss = DAILY_EXP_LOSS * (daysPassed - 1)
  const newExp = Math.max(0, pet.experience - expLoss)

  return {
    experience: newExp,
    daysPassed,
    expLoss
  }
}

// 获取今日已获得经验
async function getTodayExp(userId) {
  const db = wx.cloud.database()
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  // 查询今天完成的任务获得的总经验
  const result = await db.collection('userTasks')
    .where({
      userId,
      status: 'completed'
    })
    .get()

  let totalExp = 0
  for (const item of result.data) {
    if (item.completeTime && item.expGain > 0) {
      const completeDate = new Date(item.completeTime)
      if (completeDate >= today && completeDate < tomorrow) {
        totalExp += item.expGain
      }
    }
  }

  return totalExp
}

// 应用任务奖励，考虑每日限制
function applyRewards(pet, task, todayExp) {
  const newPet = { ...pet }
  const expGain = task.experienceReward

  // 检查是否超过每日上限
  if (todayExp + expGain > DAILY_MAX_EXP) {
    const allowed = DAILY_MAX_EXP - todayExp
    if (allowed > 0) {
      newPet.experience += allowed
      return {
        newPet,
        actuallyGained: allowed,
        overLimit: true
      }
    } else {
      return {
        newPet,
        actuallyGained: 0,
        overLimit: true
      }
    }
  }

  // 正常添加经验
  newPet.experience += expGain

  // 检查升级，每升一级获得1个属性点
  let pointsGained = 0
  let levelResult = checkLevelUp(newPet.level, newPet.experience)
  while (levelResult.canLevelUp) {
    pointsGained++
    newPet.level = levelResult.newLevel
    newPet.experience = levelResult.remainingExp
    levelResult = checkLevelUp(newPet.level, newPet.experience)
  }

  newPet.attributePoints += pointsGained

  return {
    newPet,
    actuallyGained: expGain,
    pointsGained,
    overLimit: false
  }
}

// 分配属性点
function addAttributePoint(pet, attribute) {
  if (pet.attributePoints <= 0) {
    return {
      success: false,
      message: '没有属性点了'
    }
  }

  const newPet = { ...pet }
  newPet[attribute] += 1
  newPet.attributePoints -= 1

  return {
    success: true,
    newPet
  }
}

// 获取宠物进化阶段（每10级一个阶段，共4个阶段）
// 0: 蛋
// 1-10: 阶段1 (幼年)
// 11-20: 阶段2 (成长)
// 21-30: 阶段3 (成年)
// 31+: 阶段4 (完全体)
function getEvolutionStage(level) {
  if (level <= 0) return 0
  if (level <= 10) return 1
  if (level <= 20) return 2
  if (level <= 30) return 3
  return 4
}

// 获取宠物图片URL根据等级
function getPetImageByLevel(baseType, level) {
  const stage = getEvolutionStage(level)
  if (stage === 0) {
    return '/assets/images/egg.png'
  }
  return `/assets/images/${baseType}_stage${stage}.png`
}

// 初始化新宠物
function initPet(userId, name, type) {
  return {
    userId,
    name,
    type,
    level: 0,
    experience: 0,
    attack: INITIAL_ATTRIBUTES.attack,
    speed: INITIAL_ATTRIBUTES.speed,
    defense: INITIAL_ATTRIBUTES.defense,
    hp: INITIAL_ATTRIBUTES.hp,
    attributePoints: 0,
    evolutionStage: 0,
    adoptTime: new Date(),
    lastUpdateTime: new Date()
  }
}

module.exports = {
  EXP_PER_LEVEL,
  DAILY_MAX_EXP,
  DAILY_EXP_LOSS,
  INITIAL_ATTRIBUTES,
  getNextLevelExp,
  getExpPercentage,
  checkLevelUp,
  calculateExpDecay,
  getTodayExp,
  applyRewards,
  addAttributePoint,
  getEvolutionStage,
  getPetImageByLevel,
  initPet
}
