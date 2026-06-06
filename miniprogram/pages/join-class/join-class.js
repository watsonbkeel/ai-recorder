const classService = require('../../services/class')

Page({
  data: {
    loading: false,
    error: '',
    inviteCode: '',
    classInfo: null,
    message: ''
  },
  handleInviteInput(event) {
    this.setData({ inviteCode: event.detail.value.toUpperCase() })
  },
  handleMessageInput(event) {
    this.setData({ message: event.detail.value })
  },
  async queryClass() {
    if (!this.data.inviteCode) {
      wx.showToast({ title: '请输入邀请码', icon: 'none' })
      return
    }
    this.setData({ loading: true, error: '', classInfo: null })
    try {
      const classInfo = await classService.getClassByInvite(this.data.inviteCode)
      this.setData({ classInfo })
    } catch (error) {
      this.setData({ error: error.message || '查询失败' })
    } finally {
      this.setData({ loading: false })
    }
  },
  async submitRequest() {
    if (!this.data.classInfo) {
      return
    }
    try {
      await classService.createJoinRequest(this.data.classInfo.id, { message: this.data.message })
      wx.showToast({ title: '申请已提交', icon: 'success' })
      setTimeout(() => {
        wx.navigateBack()
      }, 600)
    } catch (error) {}
  }
})
