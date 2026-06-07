const fs = require('fs')
const path = require('path')
const { UPLOAD_DIR_ABS } = require('../config/env')
const { createError } = require('./errors')

function resolveUploadedFilePath(rawUrl, expectedType) {
  const url = String(rawUrl || '').trim()
  if (!url) {
    return null
  }

  const prefix = `/uploads/${expectedType}/`
  if (!url.startsWith(prefix)) {
    throw createError('VALIDATION_ERROR', expectedType === 'audio'
      ? '原始语音必须先通过音频上传接口上传'
      : '图片必须先通过图片上传接口上传', 400)
  }

  const relativePath = url.replace(prefix, '')
  if (!relativePath || relativePath.includes('\0')) {
    throw createError('VALIDATION_ERROR', '上传文件地址无效', 400)
  }

  const root = path.resolve(UPLOAD_DIR_ABS, expectedType)
  const filePath = path.resolve(root, relativePath)
  if (filePath !== root && !filePath.startsWith(`${root}${path.sep}`)) {
    throw createError('VALIDATION_ERROR', '上传文件地址无效', 400)
  }

  return filePath
}

function resolveAudioUploadPath(originalAudioUrl) {
  return resolveUploadedFilePath(originalAudioUrl, 'audio')
}

function assertUploadedFileExists(filePath, message) {
  if (!filePath || !fs.existsSync(filePath)) {
    throw createError('VALIDATION_ERROR', message || '上传文件不存在，请重新上传', 400)
  }
}

module.exports = {
  resolveUploadedFilePath,
  resolveAudioUploadPath,
  assertUploadedFileExists
}
