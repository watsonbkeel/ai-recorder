const express = require('express')
const cors = require('cors')
const path = require('path')
const { UPLOAD_DIR_ABS } = require('./config/env')
const authRoutes = require('./routes/auth.routes')
const classRoutes = require('./routes/class.routes')
const diaryRoutes = require('./routes/diary.routes')
const commentRoutes = require('./routes/comment.routes')
const likeRoutes = require('./routes/like.routes')
const uploadRoutes = require('./routes/upload.routes')
const reportRoutes = require('./routes/report.routes')
const notificationRoutes = require('./routes/notification.routes')
const adminRoutes = require('./routes/admin.routes')
const { notFoundHandler, errorHandler } = require('./middleware/errorHandler')

const app = express()

app.use(cors())
app.use(express.json({ limit: '2mb' }))
app.use(express.urlencoded({ extended: true }))
app.use('/uploads', express.static(path.resolve(UPLOAD_DIR_ABS)))

app.get('/health', (req, res) => {
  res.json({ success: true, data: { ok: true }, message: 'ok' })
})

app.use('/api/auth', authRoutes)
app.use('/api/classes', classRoutes)
app.use('/api', diaryRoutes)
app.use('/api', commentRoutes)
app.use('/api', likeRoutes)
app.use('/api/upload', uploadRoutes)
app.use('/api/reports', reportRoutes)
app.use('/api/notifications', notificationRoutes)
app.use('/api/admin', adminRoutes)

app.use(notFoundHandler)
app.use(errorHandler)

module.exports = app
