function sendSuccess(res, data, message) {
  return res.json({
    success: true,
    data: data === undefined ? {} : data,
    message: message || 'ok'
  })
}

module.exports = {
  sendSuccess
}
