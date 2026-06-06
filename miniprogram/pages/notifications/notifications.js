const notificationService = require('../../services/notification')
const familyService = require('../../services/family')
const auth = require('../../utils/auth')
const format = require('../../utils/format')

function actorName(item) {
  return item.actor ? (item.actor.nickname || '家人') : ''
}

function actionText(item) {
  if (item.messageId) {
    return '查看留言'
  }
  if (item.type === 'family_join_requested') {
    return '前往家庭管理处理'
  }
  if (item.type === 'join_request_approved') {
    return '进入家庭'
  }
  if (item.type === 'join_request_rejected') {
    return '查看结果'
  }
  return '暂无可跳转内容'
}

function prepareNotification(item) {
  const name = actorName(item)
  return {
    ...item,
    createdAtText: format.formatDate(item.createdAt),
    actorText: name ? `来自：${name}` : '',
    actionText: actionText(item)
  }
}

Page({
  data: {
    loading: true,
    markingAllRead: false,
    markingReadId: null,
    openingId: null,
    error: '',
    items: []
  },
  onShow() {
    this.loadData()
  },
  async loadData() {
    this.setData({ loading: true, error: '' })
    try {
      const result = await notificationService.getNotifications({ page: 1, pageSize: 30 })
      this.setData({ items: (result.items || []).map(prepareNotification) })
    } catch (error) {
      this.setData({ error: error.message || '加载失败' })
    } finally {
      this.setData({ loading: false })
    }
  },
  async markRead(event) {
    const id = event.currentTarget.dataset.id
    if (!id || this.data.markingReadId || this.data.openingId) {
      return
    }
    this.setData({ markingReadId: id, error: '' })
    try {
      await notificationService.markRead(id)
      this.loadData()
    } catch (error) {
      this.setData({ error: error.message || '标记失败' })
    } finally {
      this.setData({ markingReadId: null })
    }
  },
  async openNotification(event) {
    const item = event.currentTarget.dataset.item
    if (!item || this.data.openingId || this.data.markingAllRead) {
      return
    }
    this.setData({ openingId: item.id, error: '' })

    try {
      if (!item.isRead) {
        await notificationService.markRead(item.id)
      }

      if (item.messageId) {
        wx.navigateTo({ url: `/pages/message-detail/message-detail?messageId=${item.messageId}` })
        return
      }

      if (item.type === 'family_join_requested' && item.familyId) {
        wx.navigateTo({ url: `/pages/admin/join-requests/join-requests?familyId=${item.familyId}` })
        return
      }

      if (item.type === 'join_request_approved' && item.familyId) {
        await this.enterApprovedFamily(item.familyId)
        return
      }

      if (item.type === 'join_request_rejected') {
        wx.showModal({
          title: item.title || '申请结果',
          content: item.content || '管理员暂未通过你的入家申请。',
          showCancel: false
        })
        this.loadData()
        return
      }

      wx.showToast({ title: '这条通知暂无可打开内容', icon: 'none' })
      this.loadData()
    } catch (error) {
      this.setData({ error: error.message || '打开通知失败' })
    } finally {
      this.setData({ openingId: null })
    }
  },
  async enterApprovedFamily(familyId) {
    this.setData({ loading: true, error: '' })
    try {
      const families = await familyService.getMyFamilies()
      const currentFamily = families.find((family) => Number(family.id) === Number(familyId))
      if (!currentFamily) {
        wx.showToast({ title: '暂未找到这个家庭，请稍后刷新', icon: 'none' })
        this.loadData()
        return
      }

      auth.setCurrentFamily(currentFamily)
      getApp().setCurrentFamily(currentFamily)
      wx.redirectTo({ url: `/pages/message-list/message-list?familyId=${currentFamily.id}` })
    } catch (error) {
      this.setData({ error: error.message || '进入家庭失败' })
    } finally {
      this.setData({ loading: false })
    }
  },
  async markAllRead() {
    if (this.data.markingAllRead || this.data.loading) {
      return
    }
    this.setData({ markingAllRead: true, error: '' })
    try {
      await notificationService.markAllRead()
      wx.showToast({ title: '已全部标记', icon: 'success' })
      this.loadData()
    } catch (error) {
      this.setData({ error: error.message || '标记失败' })
    } finally {
      this.setData({ markingAllRead: false })
    }
  }
})
