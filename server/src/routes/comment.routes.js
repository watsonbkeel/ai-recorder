const express = require('express')
const controller = require('../controllers/comment.controller')
const { requireAuth } = require('../middleware/auth')
const { asyncHandler } = require('../utils/errors')

const router = express.Router()

router.use(requireAuth)
router.get('/diaries/:diaryId/comments', asyncHandler(controller.listComments))
router.post('/diaries/:diaryId/comments', asyncHandler(controller.createComment))
router.delete('/comments/:commentId', asyncHandler(controller.deleteComment))

module.exports = router
