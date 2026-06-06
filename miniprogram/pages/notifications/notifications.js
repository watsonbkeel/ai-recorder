const notificationService = require('../../services/notification')
const format = require('../../utils/format')

function getActorText(item) {
  if (!item.actor) {
    return item.type === 'diary_commented' || item.type === 'comment_replied' ? '来自：匿名同学' : ''
  }
  return `来自：${item.actor.nickname || '同学'}`
}

function prepareNotification(item) {
  return {
    ...item,
    createdAtText: format.formatDate(item.createdAt),
    actorText: getActorText(item),
    actionText: item.diaryId ? '点击查看日记' : '暂无可跳转内容'
  }
}

function buildNoticeText(item) {
  const actorName = item.actor ? (item.actor.nickname || '同学') : '匿名同学'
  if (item.type === 'diary_liked') {
    return `${actorName} 点赞了这篇日记`
  }
  if (item.type === 'comment_liked') {
    return `${actorName} 点赞了你的评论`
  }
  if (item.type === 'diary_commented') {
    return `${actorName} 评论了这篇日记`
  }
  if (item.type === 'comment_replied') {
    return `${actorName} 回复了你的评论`
  }
  return item.title || '通知详情'
}

Page({
  data: {
    loading: true,
    error: '',
    items: [],
    formatDate: format.formatDate
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

    if (!item.diaryId) {
      wx.showToast({ title: '这条通知暂无可打开内容', icon: 'none' })
      this.loadData()
      return
    }

    const params = [`diaryId=${item.diaryId}`]
    if (item.commentId) {
      params.push(`commentId=${item.commentId}`)
    }
    params.push(`noticeText=${encodeURIComponent(buildNoticeText(item))}`)
    wx.navigateTo({ url: `/pages/diary-detail/diary-detail?${params.join('&')}` })
  },
  async markAllRead() {
    try {
      await notificationService.markAllRead()
      wx.showToast({ title: '已全部标记', icon: 'success' })
      this.loadData()
    } catch (error) {}
  }
})
