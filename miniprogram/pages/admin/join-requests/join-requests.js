const adminService = require('../../../services/admin')
const auth = require('../../../utils/auth')
const format = require('../../../utils/format')
const { identitySummary } = require('../../../utils/familyIdentity')
const { handleFamilyAccessError } = require('../../../utils/familyAccess')

const STATUS_TEXT = {
  pending: '等待确认',
  approved: '已通过',
  rejected: '暂不通过'
}

Page({
  data: {
    familyId: null,
    loading: true,
    error: '',
    handlingRequestId: null,
    handlingAction: '',
    items: []
  },
  onLoad(options) {
    const currentFamily = auth.getCurrentFamily()
    this.setData({ familyId: Number(options.familyId || (currentFamily && currentFamily.id)) || null })
    this.loadData()
  },
  async loadData() {
    if (!this.data.familyId) {
      const currentFamily = auth.getCurrentFamily()
      this.setData({ familyId: Number(currentFamily && currentFamily.id) || null })
    }
    if (!this.data.familyId) {
      this.setData({ loading: false, error: '请先选择家庭' })
      wx.stopPullDownRefresh()
      return
    }
    this.setData({ loading: true, error: '' })
    try {
      const items = await adminService.getJoinRequests(this.data.familyId)
      this.setData({
        items: items.map((item) => ({
          ...item,
          createdAtText: format.formatDate(item.createdAt),
          statusText: STATUS_TEXT[item.status] || item.status,
          identitySummary: identitySummary(item)
        }))
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
  onPullDownRefresh() {
    this.loadData()
  },
  async handleAction(event) {
    const { id, action } = event.currentTarget.dataset
    if (!id || this.data.handlingRequestId) {
      return
    }
    this.setData({
      handlingRequestId: Number(id),
      handlingAction: action,
      error: ''
    })
    try {
      await adminService.handleJoinRequest(id, { action })
      wx.showToast({ title: '处理成功', icon: 'success' })
      this.loadData()
    } catch (error) {
      if (handleFamilyAccessError(error, this.data.familyId)) {
        return
      }
      this.setData({ error: error.message || '处理失败' })
    } finally {
      this.setData({ handlingRequestId: null, handlingAction: '' })
    }
  }
})
