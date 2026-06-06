const adminService = require('../../../services/admin')
const format = require('../../../utils/format')

Page({
  data: {
    classId: null,
    loading: true,
    error: '',
    items: [],
    formatDate: format.formatDate
  },
  onLoad(options) {
    this.setData({ classId: Number(options.classId) })
    this.loadData()
  },
  async loadData() {
    this.setData({ loading: true, error: '' })
    try {
      const items = await adminService.getJoinRequests(this.data.classId)
      this.setData({ items })
    } catch (error) {
      this.setData({ error: error.message || '加载失败' })
    } finally {
      this.setData({ loading: false })
    }
  },
  async handleAction(event) {
    const { id, action } = event.currentTarget.dataset
    try {
      await adminService.handleJoinRequest(id, { action })
      wx.showToast({ title: '处理成功', icon: 'success' })
      this.loadData()
    } catch (error) {}
  }
})
