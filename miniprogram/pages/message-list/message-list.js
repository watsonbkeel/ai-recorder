const messageService = require('../../services/message')
const notificationService = require('../../services/notification')
const familyService = require('../../services/family')
const auth = require('../../utils/auth')
const format = require('../../utils/format')
const { identitySummary } = require('../../utils/familyIdentity')
const { handleFamilyAccessError } = require('../../utils/familyAccess')

const TYPE_TEXT = {
  thanks: '感谢',
  apology: '道歉',
  grievance: '委屈',
  request: '请求',
  explain: '解释',
  stress: '压力',
  repair: '修复关系',
  encouragement: '鼓励',
  general: '心声'
}

const VISIBILITY_TEXT = {
  private: '指定家人',
  family: '全家可见',
  self: '仅自己'
}
function prepareMessage(item) {
  return {
    ...item,
    messageTypeText: TYPE_TEXT[item.messageType] || '心声',
    visibilityText: VISIBILITY_TEXT[item.visibility] || '指定家人',
    createdAtText: format.formatDate(item.createdAt),
    senderIdentitySummary: identitySummary(item.sender)
  }
}

Page({
  data: {
    familyId: null,
    currentFamily: null,
    messages: [],
    page: 1,
    hasMore: true,
    unreadCount: 0,
    loading: true,
    loadingMore: false,
    empty: false,
    error: ''
  },
  onLoad(options) {
    const currentFamily = auth.getCurrentFamily()
    const familyId = Number(options.familyId || (currentFamily && currentFamily.id))
    this.setData({ familyId, currentFamily })
  },
  async onShow() {
    try {
      const currentFamily = await this.syncCurrentFamily()
      if (!currentFamily) {
        this.exitInvalidFamily('请先选择家庭')
        return
      }
      this.refresh()
      this.loadUnreadCount()
    } catch (error) {
      this.setData({ loading: false, error: error.message || '家庭状态同步失败' })
    }
  },
  async syncCurrentFamily() {
    const requestedFamilyId = Number(this.data.familyId) || null
    const storedFamily = auth.getCurrentFamily()

    if (!requestedFamilyId && storedFamily) {
      const familyId = Number(storedFamily.id)
      this.setData({ familyId, currentFamily: storedFamily })
      return storedFamily
    }

    if (!requestedFamilyId) {
      return null
    }

    if (storedFamily && Number(storedFamily.id) === requestedFamilyId) {
      this.setData({ currentFamily: storedFamily })
      return storedFamily
    }

    const families = await familyService.getMyFamilies()
    const currentFamily = families.find((family) => Number(family.id) === requestedFamilyId) || null
    if (!currentFamily) {
      auth.clearCurrentFamily()
      getApp().setCurrentFamily(null)
      return null
    }

    auth.setCurrentFamily(currentFamily)
    getApp().setCurrentFamily(currentFamily)
    this.setData({ currentFamily })
    return currentFamily
  },
  exitInvalidFamily(message) {
    auth.clearCurrentFamily()
    getApp().setCurrentFamily(null)
    wx.showToast({ title: message || '家庭状态已更新，请重新选择', icon: 'none' })
    setTimeout(() => {
      wx.reLaunch({ url: '/pages/family-select/family-select' })
    }, 500)
  },
  async loadUnreadCount() {
    try {
      const data = await notificationService.getUnreadCount()
      this.setData({ unreadCount: data.count || 0 })
    } catch (error) {
      this.setData({ unreadCount: 0 })
    }
  },
  async refresh() {
    if (!this.data.familyId) {
      this.exitInvalidFamily('请先选择家庭')
      return
    }
    this.setData({ page: 1, hasMore: true, messages: [], loading: true, error: '', empty: false })
    try {
      const result = await messageService.getMessages(this.data.familyId, { page: 1, pageSize: 10 })
      this.setData({
        messages: result.items.map(prepareMessage),
        empty: !result.items.length,
        hasMore: result.pagination.page < result.pagination.totalPages
      })
    } catch (error) {
      if (handleFamilyAccessError(error, this.data.familyId)) {
        return
      }
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
      const result = await messageService.getMessages(this.data.familyId, { page: nextPage, pageSize: 10 })
      this.setData({
        messages: this.data.messages.concat(result.items.map(prepareMessage)),
        page: nextPage,
        hasMore: result.pagination.page < result.pagination.totalPages
      })
    } catch (error) {
      if (handleFamilyAccessError(error, this.data.familyId)) {
        return
      }
      this.setData({ error: error.message || '加载更多失败' })
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
    if (!this.data.familyId) {
      this.exitInvalidFamily('请先选择家庭')
      return
    }
    wx.navigateTo({ url: `/pages/message-create/message-create?familyId=${this.data.familyId}` })
  },
  goDetail(event) {
    wx.navigateTo({ url: `/pages/message-detail/message-detail?messageId=${event.currentTarget.dataset.id}&familyId=${this.data.familyId}` })
  },
  goNotifications() {
    wx.navigateTo({ url: '/pages/notifications/notifications' })
  },
  goProfile() {
    wx.navigateTo({ url: '/pages/profile/profile' })
  }
})
