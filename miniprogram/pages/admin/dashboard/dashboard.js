const adminService = require('../../../services/admin')
const auth = require('../../../utils/auth')
const { handleFamilyAccessError } = require('../../../utils/familyAccess')

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
    if (!this.data.familyId) {
      const currentFamily = auth.getCurrentFamily()
      const familyId = Number(currentFamily && currentFamily.id) || null
      this.setData({ familyId, currentFamily })
    }
    if (!this.data.familyId) {
      this.setData({ loading: false, error: '请先选择家庭' })
      wx.stopPullDownRefresh()
      return
    }
    this.setData({ loading: true, error: '' })
    try {
      const stats = await adminService.getDashboard(this.data.familyId)
      const currentFamily = {
        ...(auth.getCurrentFamily() || {}),
        ...(stats && stats.family ? stats.family : {})
      }
      auth.setCurrentFamily(currentFamily)
      getApp().setCurrentFamily(currentFamily)
      this.setData({ stats, currentFamily })
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
  goJoinRequests() {
    wx.navigateTo({ url: `/pages/admin/join-requests/join-requests?familyId=${this.data.familyId}` })
  },
  editInviteCode() {
    const currentFamily = this.data.currentFamily || {}
    wx.showModal({
      title: '修改家庭邀请码',
      editable: true,
      placeholderText: '推荐使用家长手机号，最多20个字符',
      content: currentFamily.inviteCode || '',
      success: async (res) => {
        const newCode = String(res.content || '').trim()
        if (!res.confirm) {
          return
        }
        if (!newCode) {
          wx.showToast({ title: '邀请码不能为空', icon: 'none' })
          return
        }
        if (newCode.length > 20) {
          wx.showToast({ title: '不能超过20个字符', icon: 'none' })
          return
        }
        if (newCode === currentFamily.inviteCode) {
          return
        }
        wx.showLoading({ title: '修改中' })
        try {
          const updated = await adminService.updateInviteCode(this.data.familyId, newCode)
          const nextFamily = {
            ...currentFamily,
            inviteCode: updated.inviteCode
          }
          auth.setCurrentFamily(nextFamily)
          getApp().setCurrentFamily(nextFamily)
          this.setData({ currentFamily: nextFamily })
          wx.showToast({ title: '修改成功', icon: 'success' })
        } catch (error) {
          wx.showToast({ title: error.message || '修改失败', icon: 'none' })
        } finally {
          wx.hideLoading()
        }
      }
    })
  },
  goMembers() {
    wx.navigateTo({ url: `/pages/admin/members/members?familyId=${this.data.familyId}` })
  }
})
