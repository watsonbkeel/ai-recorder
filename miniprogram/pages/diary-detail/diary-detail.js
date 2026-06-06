const diaryService = require('../../services/diary')
const commentService = require('../../services/comment')
const reportService = require('../../services/report')
const adminService = require('../../services/admin')
const format = require('../../utils/format')
const imageCache = require('../../utils/imageCache')

const REPORT_REASONS = ['辱骂攻击', '泄露隐私', '不友善内容', '广告垃圾', '其他']

function prepareDiary(diary) {
  const images = (diary.images || []).map((image) => ({
    ...image,
    fullUrl: image.fullUrl || format.fullImage(image.url),
    displayUrl: image.fullUrl || format.fullImage(image.url)
  }))

  return {
    ...diary,
    createdAtText: format.formatDate(diary.createdAt),
    images,
    imagePreviewUrls: images.map((image) => image.displayUrl)
  }
}

function prepareComment(comment, targetCommentId) {
  return {
    ...comment,
    isFocused: comment.id === targetCommentId,
    createdAtText: format.formatDate(comment.createdAt),
    replies: (comment.replies || []).map((reply) => ({
      ...reply,
      isFocused: reply.id === targetCommentId,
      createdAtText: format.formatDate(reply.createdAt)
    }))
  }
}

Page({
  data: {
    diaryId: null,
    diary: null,
    comments: [],
    content: '',
    isAnonymous: false,
    replyParentId: null,
    targetCommentId: null,
    noticeText: '',
    loading: true,
    error: '',
    formatDate: format.formatDate,
    fullImage: format.fullImage
  },
  onLoad(options) {
    this.setData({
      diaryId: Number(options.diaryId),
      targetCommentId: options.commentId ? Number(options.commentId) : null,
      noticeText: options.noticeText ? decodeURIComponent(options.noticeText) : ''
    })
    this.loadData()
  },
  async loadData() {
    this.setData({ loading: true, error: '' })
    try {
      const [diary, comments] = await Promise.all([
        diaryService.getDiaryDetail(this.data.diaryId),
        commentService.getComments(this.data.diaryId)
      ])
      const preparedDiary = prepareDiary(diary)
      const preparedComments = comments.map((comment) => prepareComment(comment, this.data.targetCommentId))
      this.setData({ diary: preparedDiary, comments: preparedComments })
      this.cacheDiaryImages(preparedDiary)
      if (this.data.targetCommentId) {
        wx.showToast({ title: '已定位到相关互动', icon: 'none' })
      }
    } catch (error) {
      this.setData({ error: error.message || '加载失败' })
    } finally {
      this.setData({ loading: false })
    }
  },
  handleContentInput(event) {
    this.setData({ content: event.detail.value })
  },
  cacheDiaryImages(diary) {
    const images = diary.images || []
    const tasks = images
      .filter((image) => image.displayUrl && !image.isLocalCached)
      .map((image) => imageCache.cacheImage(image.displayUrl)
        .then((localUrl) => ({ imageId: image.id, localUrl }))
        .catch(() => null))

    if (!tasks.length) {
      return
    }

    Promise.all(tasks).then((results) => {
      const validResults = results.filter(Boolean)
      if (!validResults.length || !this.data.diary) {
        return
      }
      const nextDiary = {
        ...this.data.diary,
        images: (this.data.diary.images || []).map((image) => {
          const result = validResults.find((item) => item.imageId === image.id)
          return result ? { ...image, displayUrl: result.localUrl, isLocalCached: true } : image
        })
      }
      this.setData({
        diary: {
          ...nextDiary,
          imagePreviewUrls: (nextDiary.images || []).map((image) => image.displayUrl)
        }
      })
    })
  },
  previewDiaryImage(event) {
    const current = event.currentTarget.dataset.current
    const urls = event.currentTarget.dataset.urls || []
    if (!current || !urls.length) {
      return
    }
    wx.previewImage({ current, urls })
  },
  handleAnonymousChange(event) {
    this.setData({ isAnonymous: event.detail.value })
  },
  replyToComment(event) {
    const commentId = event.currentTarget.dataset.id
    this.setData({ replyParentId: commentId })
    wx.showToast({ title: '当前为回复模式', icon: 'none' })
  },
  cancelReply() {
    this.setData({ replyParentId: null })
  },
  async submitComment() {
    try {
      await commentService.createComment(this.data.diaryId, {
        content: this.data.content,
        parentId: this.data.replyParentId,
        isAnonymous: this.data.isAnonymous
      })
      this.setData({ content: '', replyParentId: null })
      wx.showToast({ title: '评论成功', icon: 'success' })
      this.loadData()
    } catch (error) {}
  },
  async toggleCommentLike(event) {
    const commentId = event.currentTarget.dataset.id
    try {
      await commentService.toggleCommentLike(commentId)
      this.loadData()
    } catch (error) {}
  },
  async deleteComment(event) {
    const commentId = event.currentTarget.dataset.id
    try {
      await commentService.deleteComment(commentId)
      wx.showToast({ title: '已删除', icon: 'success' })
      this.loadData()
    } catch (error) {}
  },
  reportComment(event) {
    const commentId = event.currentTarget.dataset.id
    wx.showActionSheet({
      itemList: REPORT_REASONS,
      success: async ({ tapIndex }) => {
        try {
          await reportService.createReport({
            targetType: 'comment',
            targetId: commentId,
            reason: REPORT_REASONS[tapIndex],
            description: ''
          })
          wx.showToast({ title: '举报已提交', icon: 'success' })
        } catch (error) {}
      }
    })
  },
  async hideComment(event) {
    const commentId = event.currentTarget.dataset.id
    try {
      await adminService.hideComment(commentId, { reason: '管理员隐藏评论' })
      wx.showToast({ title: '已隐藏', icon: 'success' })
      this.loadData()
    } catch (error) {}
  }
})
