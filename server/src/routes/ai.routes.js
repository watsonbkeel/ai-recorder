const express = require('express')
const controller = require('../controllers/ai.controller')
const { requireAuth } = require('../middleware/auth')
const { asyncHandler } = require('../utils/errors')

const router = express.Router()

router.use(requireAuth)
router.post('/optimize-message', asyncHandler(controller.optimizeMessage))
router.post('/analyze-message', asyncHandler(controller.analyzeMessage))
router.post('/optimize-reply', asyncHandler(controller.optimizeReply))

module.exports = router
