const express = require('express')
const controller = require('../controllers/upload.controller')
const { requireAuth } = require('../middleware/auth')
const { upload } = require('../middleware/upload')
const { asyncHandler } = require('../utils/errors')

const router = express.Router()

router.post('/image', requireAuth, upload.single('file'), asyncHandler(controller.uploadImage))

module.exports = router
