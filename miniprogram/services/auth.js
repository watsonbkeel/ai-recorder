const request = require('../utils/request')

function wechatLogin(data) {
  return request({ url: '/auth/wechat-login', method: 'POST', data, silent: true })
}

function register(data) {
  return request({ url: '/auth/register', method: 'POST', data, silent: true })
}

function login(data) {
  return request({ url: '/auth/login', method: 'POST', data, silent: true })
}

function getMe() {
  return request({ url: '/auth/me' })
}

function updateMe(data) {
  return request({ url: '/auth/me', method: 'PATCH', data })
}

module.exports = {
  wechatLogin,
  register,
  login,
  getMe,
  updateMe
}
