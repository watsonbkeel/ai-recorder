const multer = require('multer')
const { AppError } = require('../utils/errors')

function redactLogMessage(value) {
  return String(value || 'Unknown error')
    .replace(/ghp_[A-Za-z0-9_]+/g, '[REDACTED_GITHUB_TOKEN]')
    .replace(/github_pat_[A-Za-z0-9_]+/g, '[REDACTED_GITHUB_TOKEN]')
    .replace(/sk-[A-Za-z0-9]{20,}/g, '[REDACTED_AI_KEY]')
    .replace(/wx[0-9a-fA-F]{16}/g, '[REDACTED_WECHAT_APPID]')
}

function notFoundHandler(req, res) {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: '接口不存在'
    }
  })
}

function errorHandler(error, req, res, next) {
  if (res.headersSent) {
    return next(error)
  }

  if (error instanceof AppError) {
    return res.status(error.statusCode).json({
      success: false,
      error: {
        code: error.code,
        message: error.message
      }
    })
  }

  if (error instanceof multer.MulterError) {
    const message = error.code === 'LIMIT_FILE_SIZE'
      ? '上传文件不能超过 20MB，请压缩或缩短后再上传'
      : (error.message || '文件上传失败')

    return res.status(400).json({
      success: false,
      error: {
        code: 'UPLOAD_ERROR',
        message
      }
    })
  }

  console.error('[internal-error]', redactLogMessage(error.message))
  return res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: '服务器内部错误'
    }
  })
}

module.exports = {
  redactLogMessage,
  notFoundHandler,
  errorHandler
}
