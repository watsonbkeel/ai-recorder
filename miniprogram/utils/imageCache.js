const auth = require('./auth')

function hashText(text) {
  let hash = 0
  for (let index = 0; index < text.length; index += 1) {
    hash = ((hash << 5) - hash) + text.charCodeAt(index)
    hash |= 0
  }
  return Math.abs(hash).toString(36)
}

function getExtension(url, contentType) {
  const path = String(url || '').split('?')[0]
  const match = path.match(/\.(jpg|jpeg|png|webp)$/i)
  if (match) {
    return `.${match[1].toLowerCase()}`
  }
  if (/png/i.test(contentType || '')) {
    return '.png'
  }
  if (/webp/i.test(contentType || '')) {
    return '.webp'
  }
  return '.jpg'
}

function writeFile(filePath, data) {
  return new Promise((resolve, reject) => {
    wx.getFileSystemManager().writeFile({
      filePath,
      data,
      success: () => resolve(filePath),
      fail: reject
    })
  })
}

function requestImage(url) {
  const token = auth.getToken()
  return new Promise((resolve, reject) => {
    wx.request({
      url,
      method: 'GET',
      responseType: 'arraybuffer',
      header: token ? { Authorization: `Bearer ${token}` } : {},
      success(res) {
        if (res.statusCode < 200 || res.statusCode >= 300 || !res.data) {
          reject(new Error('图片加载失败'))
          return
        }
        resolve({
          data: res.data,
          contentType: res.header && (res.header['content-type'] || res.header['Content-Type'])
        })
      },
      fail: reject
    })
  })
}

async function cacheImage(url) {
  if (!url || !/^https?:\/\//.test(url)) {
    return url
  }

  const response = await requestImage(url)
  const extension = getExtension(url, response.contentType)
  const filePath = `${wx.env.USER_DATA_PATH}/diary-image-${hashText(url)}${extension}`
  return writeFile(filePath, response.data)
}

module.exports = {
  cacheImage
}
