const fs = require('fs')
const path = require('path')
const multer = require('multer')
const { UPLOAD_DIR_ABS } = require('../config/env')
const { createError } = require('../utils/errors')

fs.mkdirSync(UPLOAD_DIR_ABS, { recursive: true })

function getWeeklyUploadFolder(date = new Date()) {
  const current = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const day = current.getUTCDay() || 7
  current.setUTCDate(current.getUTCDate() + 4 - day)
  const yearStart = new Date(Date.UTC(current.getUTCFullYear(), 0, 1))
  const week = Math.ceil((((current - yearStart) / 86400000) + 1) / 7)
  return `${current.getUTCFullYear()}-W${String(week).padStart(2, '0')}`
}

const storage = multer.diskStorage({
  destination(req, file, callback) {
    const weeklyFolder = getWeeklyUploadFolder()
    const uploadPath = path.join(UPLOAD_DIR_ABS, weeklyFolder)
    fs.mkdirSync(uploadPath, { recursive: true })
    callback(null, uploadPath)
  },
  filename(req, file, callback) {
    const ext = path.extname(file.originalname || '').toLowerCase()
    callback(null, `${Date.now()}-${Math.random().toString(36).slice(2, 10)}${ext}`)
  }
})

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter(req, file, callback) {
    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
    if (!allowed.includes(file.mimetype)) {
      return callback(createError('UPLOAD_ERROR', '仅支持 jpg/jpeg/png/webp 图片', 400))
    }
    return callback(null, true)
  }
})

module.exports = {
  upload,
  getWeeklyUploadFolder
}
