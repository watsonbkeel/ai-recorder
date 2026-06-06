const uploadService = require('../services/upload.service')
const { sendSuccess } = require('../utils/response')

async function uploadImage(req, res) {
  const data = await uploadService.uploadImage(req.file)
  return sendSuccess(res, data, 'ok')
}

module.exports = {
  uploadImage
}
