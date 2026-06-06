const adminService = require('../../../services/admin')
const format = require('../../../utils/format')
const { identitySummary } = require('../../../utils/familyIdentity')
const { handleFamilyAccessError } = require('../../../utils/familyAccess')

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
      if (handleFamilyAccessError(error, this.data.familyId)) {
        return
      }
      this.setData({ error: error.message || '加载失败' })
    } finally {
      this.setData({ loading: false })
    }
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
