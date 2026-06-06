const request = require('../utils/request')

function createReport(data) {
  return request({ url: '/reports', method: 'POST', data })
}

module.exports = {
  createReport
}
