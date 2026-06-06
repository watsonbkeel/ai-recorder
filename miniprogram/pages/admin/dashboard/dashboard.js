const adminService = require('../../../services/admin')
const auth = require('../../../utils/auth')

Page({
  data: {
    classId: null,
    currentClass: null,
    loading: true,
    error: '',
    stats: null
  },
  onLoad(options) {
    this.setData({ classId: Number(options.classId), currentClass: auth.getCurrentClass() })
  },
  onShow() {
    this.loadData()
  },
  async loadData() {
    this.setData({ loading: true, error: '' })
    try {
      const stats = await adminService.getDashboard(this.data.classId)
      this.setData({ stats })
    } catch (error) {
      this.setData({ error: error.message || '加载失败' })
    } finally {
      this.setData({ loading: false })
    }
  },
  goJoinRequests() {
    wx.navigateTo({ url: `/pages/admin/join-requests/join-requests?classId=${this.data.classId}` })
  },
  goMembers() {
    wx.navigateTo({ url: `/pages/admin/members/members?classId=${this.data.classId}` })
  },
  goReports() {
    wx.navigateTo({ url: `/pages/admin/reports/reports?classId=${this.data.classId}` })
  }
})
