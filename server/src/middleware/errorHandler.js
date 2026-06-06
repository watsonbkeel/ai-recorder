const multer = require('multer')
const { AppError } = require('../utils/errors')

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
      ? '图片不能超过 5MB，请压缩后再上传'
      : (error.message || '图片上传失败')

    return res.status(400).json({
      success: false,
      error: {
        code: 'UPLOAD_ERROR',
        message
      }
    })
  }

  return res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: error.message || '服务器内部错误'
    }
  })
}

module.exports = {
  notFoundHandler,
  errorHandler
}
