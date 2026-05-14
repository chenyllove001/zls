// 验证码工具 - 生成两位数乘法题目

// 生成一个新的验证题目
function generateQuestion() {
  // 10-99 之间的随机两位数
  const num1 = Math.floor(Math.random() * 90) + 10
  const num2 = Math.floor(Math.random() * 90) + 10
  return {
    num1,
    num2,
    question: `${num1} × ${num2} = ?`
  }
}

// 验证答案（客户端也可以验证，但最终验证在云函数）
function verifyAnswer(num1, num2, userAnswer) {
  const correct = num1 * num2
  return parseInt(userAnswer) === correct
}

module.exports = {
  generateQuestion,
  verifyAnswer
}
