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
      const items = await adminService.getReports(this.data.classId)
      this.setData({ items })
    } catch (error) {
      this.setData({ error: error.message || '加载失败' })
    } finally {
      this.setData({ loading: false })
    }
  },
  async handleReport(event) {
    const { id, action, muteauthor } = event.currentTarget.dataset
    try {
      await adminService.handleReport(id, { action, muteAuthor: Boolean(muteauthor) })
      wx.showToast({ title: '处理成功', icon: 'success' })
      this.loadData()
    } catch (error) {}
  }
})
