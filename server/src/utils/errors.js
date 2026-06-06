class AppError extends Error {
  constructor(code, message, statusCode) {
    super(message)
    this.code = code || 'INTERNAL_ERROR'
    this.statusCode = statusCode || 500
  }
}

function createError(code, message, statusCode) {
  return new AppError(code, message, statusCode)
}

function asyncHandler(handler) {
  return function wrappedHandler(req, res, next) {
    Promise.resolve(handler(req, res, next)).catch(next)
  }
}

module.exports = {
  AppError,
  createError,
  asyncHandler
}
