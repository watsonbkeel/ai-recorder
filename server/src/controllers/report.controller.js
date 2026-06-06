const reportService = require('../services/report.service')
const { sendSuccess } = require('../utils/response')

async function createReport(req, res) {
  const data = await reportService.createReport(req.user.id, req.body)
  return sendSuccess(res, data, 'ok')
}

module.exports = {
  createReport
}
