const notificationService = require('../../services/notification')
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
    try {
      await notificationService.markRead(event.currentTarget.dataset.id)
      this.loadData()
    } catch (error) {}
  },
  async openNotification(event) {
    const item = event.currentTarget.dataset.item
    if (!item) {
      return
    }

    if (!item.isRead) {
      try {
        await notificationService.markRead(item.id)
      } catch (error) {}
    }

    if (item.messageId) {
      wx.navigateTo({ url: `/pages/message-detail/message-detail?messageId=${item.messageId}` })
      return
    }

    if (item.type === 'family_join_requested' && item.familyId) {
      wx.navigateTo({ url: `/pages/admin/join-requests/join-requests?familyId=${item.familyId}` })
      return
    }

    wx.showToast({ title: '这条通知暂无可打开内容', icon: 'none' })
    this.loadData()
  },
  async markAllRead() {
    try {
      await notificationService.markAllRead()
      wx.showToast({ title: '已全部标记', icon: 'success' })
      this.loadData()
    } catch (error) {}
  }
})
