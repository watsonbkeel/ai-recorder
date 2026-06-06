const adminService = require('../../../services/admin')

Page({
  data: {
    classId: null,
    loading: true,
    error: '',
    items: []
  },
  onLoad(options) {
    this.setData({ classId: Number(options.classId) })
    this.loadData()
  },
  async loadData() {
    this.setData({ loading: true, error: '' })
    try {
      const items = await adminService.getMembers(this.data.classId)
      this.setData({ items })
    } catch (error) {
      this.setData({ error: error.message || '加载失败' })
    } finally {
      this.setData({ loading: false })
    }
  },
  async toggleMute(event) {
    const item = event.currentTarget.dataset.item
    try {
      await adminService.updateMute(this.data.classId, item.userId, { isMuted: !item.isMuted })
      this.loadData()
    } catch (error) {}
  },
  async toggleRole(event) {
    const item = event.currentTarget.dataset.item
    const role = item.role === 'admin' ? 'member' : 'admin'
    try {
      await adminService.updateRole(this.data.classId, item.userId, { role })
      this.loadData()
    } catch (error) {}
  },
  async removeMember(event) {
    const item = event.currentTarget.dataset.item
    try {
      await adminService.removeMember(this.data.classId, item.userId, { reason: '管理员移除成员' })
      this.loadData()
    } catch (error) {}
  }
})
