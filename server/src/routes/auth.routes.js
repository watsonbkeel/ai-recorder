const express = require('express')
const controller = require('../controllers/auth.controller')
const { requireAuth } = require('../middleware/auth')
const { asyncHandler } = require('../utils/errors')

const router = express.Router()

router.post('/wechat-login', asyncHandler(controller.wechatLogin))
router.post('/register', asyncHandler(controller.register))
router.post('/login', asyncHandler(controller.login))
router.get('/me', requireAuth, asyncHandler(controller.getMe))
router.patch('/me', requireAuth, asyncHandler(controller.updateMe))

module.exports = router
