const adminService = require('../../../services/admin')
const auth = require('../../../utils/auth')

Page({
  data: {
    familyId: null,
    currentFamily: null,
    loading: true,
    error: '',
    stats: null
  },
  onLoad(options) {
    const currentFamily = auth.getCurrentFamily()
    const familyId = Number(options.familyId || (currentFamily && currentFamily.id))
    this.setData({ familyId, currentFamily })
  },
  onShow() {
    this.loadData()
  },
  async loadData() {
    this.setData({ loading: true, error: '' })
    try {
      const stats = await adminService.getDashboard(this.data.familyId)
      this.setData({ stats, currentFamily: auth.getCurrentFamily() })
    } catch (error) {
      this.setData({ error: error.message || '加载失败' })
    } finally {
      this.setData({ loading: false })
    }
  },
  goJoinRequests() {
    wx.navigateTo({ url: `/pages/admin/join-requests/join-requests?familyId=${this.data.familyId}` })
  },
  goMembers() {
    wx.navigateTo({ url: `/pages/admin/members/members?familyId=${this.data.familyId}` })
  }
})
