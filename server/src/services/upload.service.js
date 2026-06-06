const path = require('path')
const { createError } = require('../utils/errors')
const { PUBLIC_BASE_URL, UPLOAD_DIR_ABS } = require('../config/env')

function buildPublicUrl(url) {
  return `${PUBLIC_BASE_URL.replace(/\/$/, '')}${url}`
}

async function uploadImage(file) {
  if (!file) {
    throw createError('UPLOAD_ERROR', '请选择图片文件', 400)
  }

  const relativeFilePath = path.relative(UPLOAD_DIR_ABS, file.path).split(path.sep).join('/')
  const relativePath = `/uploads/${relativeFilePath}`

  return {
    url: relativePath,
    fullUrl: buildPublicUrl(relativePath)
  }
}

module.exports = {
  uploadImage
}
