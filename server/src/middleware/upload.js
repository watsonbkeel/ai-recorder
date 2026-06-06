const fs = require('fs')
const path = require('path')
const multer = require('multer')
const { UPLOAD_DIR_ABS } = require('../config/env')
const { createError } = require('../utils/errors')

fs.mkdirSync(UPLOAD_DIR_ABS, { recursive: true })

const ALLOWED_AUDIO_EXTS = ['.mp3', '.m4a', '.aac', '.wav', '.webm', '.amr']

function resolveUploadType(req) {
  return req.uploadType === 'audio' ? 'audio' : 'image'
}

function uploadExtension(req, file) {
  const ext = path.extname(file.originalname || '').toLowerCase()
  if (resolveUploadType(req) === 'audio') {
    return ALLOWED_AUDIO_EXTS.includes(ext) ? ext : '.mp3'
  }
  return ext
}

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
    const uploadPath = path.join(UPLOAD_DIR_ABS, resolveUploadType(req), weeklyFolder)
    fs.mkdirSync(uploadPath, { recursive: true })
    callback(null, uploadPath)
  },
  filename(req, file, callback) {
    const ext = uploadExtension(req, file)
    callback(null, `${Date.now()}-${Math.random().toString(36).slice(2, 10)}${ext}`)
  }
})

function fileFilter(req, file, callback) {
  if (resolveUploadType(req) === 'audio') {
    const allowedAudio = ['audio/mpeg', 'audio/mp3', 'audio/mp4', 'audio/aac', 'audio/x-m4a', 'audio/wav', 'audio/webm', 'audio/amr']
    const ext = path.extname(file.originalname || '').toLowerCase()
    const looseMime = !file.mimetype || file.mimetype === 'application/octet-stream'
    if (!allowedAudio.includes(file.mimetype) && !(looseMime && (!ext || ALLOWED_AUDIO_EXTS.includes(ext)))) {
      return callback(createError('UPLOAD_ERROR', '仅支持微信录音常见音频格式', 400))
    }
    return callback(null, true)
  }

  const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
  if (!allowed.includes(file.mimetype)) {
    return callback(createError('UPLOAD_ERROR', '仅支持 jpg/jpeg/png/webp 图片', 400))
  }
  return callback(null, true)
}

function markAudioUpload(req, res, next) {
  req.uploadType = 'audio'
  next()
}

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter
})

module.exports = {
  upload,
  markAudioUpload,
  getWeeklyUploadFolder
}
