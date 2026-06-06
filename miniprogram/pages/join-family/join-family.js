const familyService = require('../../services/family')

Page({
  data: {
    inviteCode: '',
    message: '',
    loading: false,
    error: ''
  },
  handleInviteInput(event) {
    this.setData({ inviteCode: event.detail.value })
  },
  handleMessageInput(event) {
    this.setData({ message: event.detail.value })
  },
  async submit() {
    const inviteCode = this.data.inviteCode.trim()
    if (!inviteCode) {
      wx.showToast({ title: '请输入邀请码', icon: 'none' })
      return
    }
    this.setData({ loading: true, error: '' })
    try {
      const family = await familyService.getFamilyByInvite(inviteCode)
      await familyService.createJoinRequest(family.id, { message: this.data.message || '申请加入家庭' })
      wx.showToast({ title: '申请已提交', icon: 'success' })
      setTimeout(() => wx.navigateBack(), 500)
    } catch (error) {
      this.setData({ error: error.message || '提交失败' })
    } finally {
      this.setData({ loading: false })
    }
  }
})
