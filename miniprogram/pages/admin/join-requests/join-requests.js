const adminService = require('../../../services/admin')
const format = require('../../../utils/format')
const { identitySummary } = require('../../../utils/familyIdentity')

Page({
  data: {
    familyId: null,
    loading: true,
    error: '',
    items: []
  },
  onLoad(options) {
    this.setData({ familyId: Number(options.familyId) })
    this.loadData()
  },
  async loadData() {
    this.setData({ loading: true, error: '' })
    try {
      const items = await adminService.getJoinRequests(this.data.familyId)
      this.setData({
        items: items.map((item) => ({
          ...item,
          createdAtText: format.formatDate(item.createdAt),
          identitySummary: identitySummary(item)
        }))
      })
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
