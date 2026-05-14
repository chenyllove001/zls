// 云函数：验证乘法题目答案
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

exports.main = async (event, context) => {
  const { num1, num2, userAnswer } = event

  if (!num1 || !num2 || userAnswer === undefined) {
    return {
      correct: false,
      message: '参数不完整'
    }
  }

  const correctAnswer = num1 * num2
  const userAnswerNum = parseInt(userAnswer)

  console.log(`验证: ${num1} × ${num2} = ${correctAnswer}, 用户答案: ${userAnswerNum}`)

  return {
    correct: userAnswerNum === correctAnswer,
    correctAnswer,
    message: userAnswerNum === correctAnswer ? '回答正确' : '回答错误'
  }
}
