const aiService = require('../services/ai.service')
const { sendSuccess } = require('../utils/response')

async function optimizeMessage(req, res) {
  const data = await aiService.optimizeMessage(req.body)
  return sendSuccess(res, data, 'ok')
}

async function analyzeMessage(req, res) {
  const data = await aiService.analyzeMessage(req.body)
  return sendSuccess(res, data, 'ok')
}

async function optimizeReply(req, res) {
  const data = await aiService.optimizeReply(req.body)
  return sendSuccess(res, data, 'ok')
}

module.exports = {
  optimizeMessage,
  analyzeMessage,
  optimizeReply
}
