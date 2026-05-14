// 通用工具函数

// 格式化时间
function formatTime(date) {
  const year = date.getFullYear()
  const month = date.getMonth() + 1
  const day = date.getDate()
  const hour = date.getHours()
  const minute = date.getMinutes()

  return `${year}-${padZero(month)}-${padZero(day)} ${padZero(hour)}:${padZero(minute)}`
}

// 补零
function padZero(n) {
  return n < 10 ? '0' + n : '' + n
}

// 生成随机六位数班级加入码
function generateClassCode() {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

// 防抖
function debounce(fn, delay) {
  let timer = null
  return function() {
    const context = this
    const args = arguments
    clearTimeout(timer)
    timer = setTimeout(function() {
      fn.apply(context, args)
    }, delay)
  }
}

module.exports = {
  formatTime,
  padZero,
  generateClassCode,
  debounce
}
