const request = require('../utils/request')

function optimizeMessage(data) {
  return request({ url: '/ai/optimize-message', method: 'POST', data })
}

function analyzeMessage(data) {
  return request({ url: '/ai/analyze-message', method: 'POST', data })
}

function optimizeReply(data) {
  return request({ url: '/ai/optimize-reply', method: 'POST', data })
}

module.exports = {
  optimizeMessage,
  analyzeMessage,
  optimizeReply
}
