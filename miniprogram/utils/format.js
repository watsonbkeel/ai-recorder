const { PUBLIC_BASE_URL } = require('./config')

function formatDate(value) {
  if (!value) {
    return ''
  }
  const date = new Date(value)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hour = String(date.getHours()).padStart(2, '0')
  const minute = String(date.getMinutes()).padStart(2, '0')
  return `${year}-${month}-${day} ${hour}:${minute}`
}

function fullImage(url) {
  if (!url) {
    return ''
  }
  if (/^https?:\/\//.test(url)) {
    return url
  }
  return `${PUBLIC_BASE_URL.replace(/\/$/, '')}${url}`
}

module.exports = {
  formatDate,
  fullImage
}
