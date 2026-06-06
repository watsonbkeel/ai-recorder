const adminService = require('../../../services/admin')
const identity = require('../../../utils/familyIdentity')
const { handleFamilyAccessError } = require('../../../utils/familyAccess')

function identityFormFromMember(member) {
  return {
    relationshipIndex: identity.optionIndex(identity.RELATIONSHIP_OPTIONS, member && member.relationship),
    genderIndex: identity.optionIndex(identity.GENDER_OPTIONS, member && member.gender),
    childOrder: member && member.childOrder ? String(member.childOrder) : '',
    birthYear: member && member.birthYear ? String(member.birthYear) : '',
    familyNickname: member && member.familyNickname ? member.familyNickname : '',
    preferredTitle: member && member.preferredTitle ? member.preferredTitle : '',
    identityNote: member && member.identityNote ? member.identityNote : ''
  }
}

Page({
  data: {
    familyId: null,
    loading: true,
    error: '',
    items: [],
    editingMember: null,
    relationshipLabels: identity.RELATIONSHIP_LABELS,
    genderLabels: identity.GENDER_LABELS,
    relationshipIndex: 0,
    genderIndex: 0,
    childOrder: '',
    birthYear: '',
    familyNickname: '',
    preferredTitle: '',
    identityNote: '',
    savingIdentity: false,
    handlingMemberId: null,
    handlingAction: ''
  },
  onLoad(options) {
    this.setData({ familyId: Number(options.familyId) })
    this.loadData()
  },
  async loadData() {
    this.setData({ loading: true, error: '' })
    try {
      const items = await adminService.getMembers(this.data.familyId)
      this.setData({
        items: items.map((item) => ({
          ...item,
          identitySummary: identity.identitySummary(item)
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
  startEditIdentity(event) {
    const item = event.currentTarget.dataset.item
    this.setData({
      editingMember: item,
      ...identityFormFromMember(item)
    })
  },
  cancelEditIdentity() {
    this.setData({
      editingMember: null,
      ...identityFormFromMember(null)
    })
  },
  handleRelationshipChange(event) {
    this.setData({ relationshipIndex: Number(event.detail.value) })
  },
  handleGenderChange(event) {
    this.setData({ genderIndex: Number(event.detail.value) })
  },
  handleChildOrderInput(event) {
    this.setData({ childOrder: event.detail.value })
  },
  handleBirthYearInput(event) {
    this.setData({ birthYear: event.detail.value })
  },
  handleFamilyNicknameInput(event) {
    this.setData({ familyNickname: event.detail.value })
  },
  handlePreferredTitleInput(event) {
    this.setData({ preferredTitle: event.detail.value })
  },
  handleIdentityNoteInput(event) {
    this.setData({ identityNote: event.detail.value })
  },
  async saveIdentity() {
    if (!this.data.editingMember || this.data.savingIdentity) {
      return
    }
    this.setData({ savingIdentity: true, error: '' })
    try {
      await adminService.updateMemberIdentity(this.data.familyId, this.data.editingMember.userId, identity.buildIdentityPayload({
        relationship: identity.optionValue(identity.RELATIONSHIP_OPTIONS, this.data.relationshipIndex),
        gender: identity.optionValue(identity.GENDER_OPTIONS, this.data.genderIndex),
        childOrder: this.data.childOrder,
        birthYear: this.data.birthYear,
        familyNickname: this.data.familyNickname,
        preferredTitle: this.data.preferredTitle,
        identityNote: this.data.identityNote
      }))
      wx.showToast({ title: '身份已保存', icon: 'success' })
      this.setData({ editingMember: null })
      this.loadData()
    } catch (error) {
      if (handleFamilyAccessError(error, this.data.familyId)) {
        return
      }
      this.setData({ error: error.message || '保存失败' })
    } finally {
      this.setData({ savingIdentity: false })
    }
  },
  async toggleMute(event) {
    if (this.data.handlingMemberId) {
      return
    }
    const item = event.currentTarget.dataset.item
    this.setData({ handlingMemberId: Number(item.userId), handlingAction: 'mute', error: '' })
    try {
      await adminService.updateMute(this.data.familyId, item.userId, { isMuted: !item.isMuted })
      this.loadData()
    } catch (error) {
      if (handleFamilyAccessError(error, this.data.familyId)) {
        return
      }
      this.setData({ error: error.message || '操作失败' })
    } finally {
      this.setData({ handlingMemberId: null, handlingAction: '' })
    }
  },
  async toggleRole(event) {
    if (this.data.handlingMemberId) {
      return
    }
    const item = event.currentTarget.dataset.item
    const role = item.role === 'admin' ? 'member' : 'admin'
    this.setData({ handlingMemberId: Number(item.userId), handlingAction: 'role', error: '' })
    try {
      await adminService.updateRole(this.data.familyId, item.userId, { role })
      this.loadData()
    } catch (error) {
      if (handleFamilyAccessError(error, this.data.familyId)) {
        return
      }
      this.setData({ error: error.message || '操作失败' })
    } finally {
      this.setData({ handlingMemberId: null, handlingAction: '' })
    }
  },
  async removeMember(event) {
    if (this.data.handlingMemberId) {
      return
    }
    const item = event.currentTarget.dataset.item
    wx.showModal({
      title: '移除成员',
      content: `确认移除 ${item.displayName || item.user.nickname || '这位成员'} 吗？`,
      confirmColor: '#ef4444',
      success: async (res) => {
        if (!res.confirm) {
          return
        }
        this.setData({ handlingMemberId: Number(item.userId), handlingAction: 'remove', error: '' })
        try {
          await adminService.removeMember(this.data.familyId, item.userId, { reason: '管理员移除成员' })
          this.loadData()
        } catch (error) {
          if (handleFamilyAccessError(error, this.data.familyId)) {
            return
          }
          this.setData({ error: error.message || '移除失败' })
        } finally {
          this.setData({ handlingMemberId: null, handlingAction: '' })
        }
      }
    })
  }
})
