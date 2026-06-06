const diaryService = require('../../services/diary')
const reportService = require('../../services/report')
const adminService = require('../../services/admin')
const notificationService = require('../../services/notification')
const auth = require('../../utils/auth')
const format = require('../../utils/format')
const imageCache = require('../../utils/imageCache')

const REPORT_REASONS = ['辱骂攻击', '泄露隐私', '不友善内容', '广告垃圾', '其他']

function prepareDiary(item) {
  const images = (item.images || []).map((image) => ({
    ...image,
    fullUrl: image.fullUrl || format.fullImage(image.url),
    displayUrl: image.fullUrl || format.fullImage(image.url)
  }))

  return {
    ...item,
    createdAtText: format.formatDate(item.createdAt),
    images,
    imagePreviewUrls: images.map((image) => image.displayUrl)
  }
}

Page({
  data: {
    loading: true,
    loadingMore: false,
    error: '',
    empty: false,
    diaries: [],
    page: 1,
    hasMore: true,
    classId: null,
    currentClass: null,
    unreadCount: 0,
    formatDate: format.formatDate,
    fullImage: format.fullImage
  },
  onLoad(options) {
    const currentClass = auth.getCurrentClass()
    const classId = Number(options.classId || (currentClass && currentClass.id))
    this.setData({ classId, currentClass })
  },
  onShow() {
    const currentClass = auth.getCurrentClass()
    this.setData({ currentClass })
    this.refresh()
    this.loadUnreadCount()
  },
  async loadUnreadCount() {
    try {
      const data = await notificationService.getUnreadCount()
      this.setData({ unreadCount: data.count || 0 })
    } catch (error) {}
  },
  async refresh() {
    this.setData({ page: 1, hasMore: true, diaries: [], loading: true, error: '', empty: false })
    try {
      const result = await diaryService.getDiaries(this.data.classId, { page: 1, pageSize: 10 })
      this.setData({
        diaries: result.items.map(prepareDiary),
        empty: !result.items.length,
        hasMore: result.pagination.page < result.pagination.totalPages
      })
      this.cacheDiaryImages(this.data.diaries)
    } catch (error) {
      this.setData({ error: error.message || '加载失败' })
    } finally {
      this.setData({ loading: false })
      wx.stopPullDownRefresh()
    }
  },
  async loadMore() {
    if (!this.data.hasMore || this.data.loadingMore) {
      return
    }
    const nextPage = this.data.page + 1
    this.setData({ loadingMore: true })
    try {
      const result = await diaryService.getDiaries(this.data.classId, { page: nextPage, pageSize: 10 })
      this.setData({
        diaries: this.data.diaries.concat(result.items.map(prepareDiary)),
        page: nextPage,
        hasMore: result.pagination.page < result.pagination.totalPages
      })
      this.cacheDiaryImages(this.data.diaries)
    } finally {
      this.setData({ loadingMore: false })
    }
  },
  onPullDownRefresh() {
    this.refresh()
  },
  onReachBottom() {
    this.loadMore()
  },
  goCreate() {
    wx.navigateTo({ url: `/pages/diary-create/diary-create?classId=${this.data.classId}` })
  },
  cacheDiaryImages(diaries) {
    const tasks = []
    diaries.forEach((diary) => {
      ;(diary.images || []).forEach((image) => {
        if (!image.displayUrl || image.isLocalCached) {
          return
        }
        tasks.push(
          imageCache.cacheImage(image.displayUrl)
            .then((localUrl) => ({ diaryId: diary.id, imageId: image.id, localUrl }))
            .catch(() => null)
        )
      })
    })

    if (!tasks.length) {
      return
    }

    Promise.all(tasks).then((results) => {
      const validResults = results.filter(Boolean)
      if (!validResults.length) {
        return
      }
      const diariesWithLocalImages = this.data.diaries.map((diary) => ({
        ...diary,
        images: (diary.images || []).map((image) => {
          const result = validResults.find((item) => item.diaryId === diary.id && item.imageId === image.id)
          return result ? { ...image, displayUrl: result.localUrl, isLocalCached: true } : image
        })
      }))
      this.setData({
        diaries: diariesWithLocalImages.map((diary) => ({
          ...diary,
          imagePreviewUrls: (diary.images || []).map((image) => image.displayUrl)
        }))
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
  goDetail(event) {
    const diaryId = event.currentTarget.dataset.id
    wx.navigateTo({ url: `/pages/diary-detail/diary-detail?diaryId=${diaryId}` })
  },
  goProfile() {
    wx.navigateTo({ url: '/pages/profile/profile' })
  },
  goNotifications() {
    wx.navigateTo({ url: '/pages/notifications/notifications' })
  },
  goAdmin() {
    if (this.data.currentClass && this.data.currentClass.role === 'admin') {
      wx.navigateTo({ url: `/pages/admin/dashboard/dashboard?classId=${this.data.classId}` })
    }
  },
  async toggleLike(event) {
    const diaryId = event.currentTarget.dataset.id
    try {
      const result = await diaryService.toggleDiaryLike(diaryId)
      const diaries = this.data.diaries.map((item) => {
        if (item.id === diaryId) {
          return { ...item, likedByMe: result.liked, likeCount: result.likeCount }
        }
        return item
      })
      this.setData({ diaries })
    } catch (error) {}
  },
  async deleteDiary(event) {
    const diaryId = event.currentTarget.dataset.id
    try {
      await diaryService.deleteDiary(diaryId)
      wx.showToast({ title: '已删除', icon: 'success' })
      this.refresh()
    } catch (error) {}
  },
  async hideDiary(event) {
    const diaryId = event.currentTarget.dataset.id
    try {
      await adminService.hideDiary(diaryId, { reason: '管理员隐藏' })
      wx.showToast({ title: '已隐藏', icon: 'success' })
      this.refresh()
    } catch (error) {}
  },
  reportDiary(event) {
    const diaryId = event.currentTarget.dataset.id
    wx.showActionSheet({
      itemList: REPORT_REASONS,
      success: async ({ tapIndex }) => {
        try {
          await reportService.createReport({
            targetType: 'diary',
            targetId: diaryId,
            reason: REPORT_REASONS[tapIndex],
            description: ''
          })
          wx.showToast({ title: '举报已提交', icon: 'success' })
        } catch (error) {}
      }
    })
  }
})
