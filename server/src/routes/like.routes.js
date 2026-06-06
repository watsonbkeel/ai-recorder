const express = require('express')
const controller = require('../controllers/like.controller')
const { requireAuth } = require('../middleware/auth')
const { asyncHandler } = require('../utils/errors')

const router = express.Router()

router.use(requireAuth)
router.post('/diaries/:diaryId/like', asyncHandler(controller.toggleDiaryLike))
router.post('/comments/:commentId/like', asyncHandler(controller.toggleCommentLike))

module.exports = router
