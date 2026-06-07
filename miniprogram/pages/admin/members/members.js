const adminService = require('../../../services/admin')
const familyService = require('../../../services/family')
const auth = require('../../../utils/auth')
const identity = require('../../../utils/familyIdentity')
const familySlots = require('../../../utils/familySlots')
const { handleFamilyAccessError } = require('../../../utils/familyAccess')

function buildSlotCards(slots, selectedSlotKey, editingUserId) {
  return familySlots.decorateSlots(slots || familySlots.DEFAULT_FAMILY_SLOTS, selectedSlotKey ? [selectedSlotKey] : [])
    .map((slot) => ({
      ...slot,
      occupiedByOther: Boolean(slot.member && Number(slot.member.userId) !== Number(editingUserId))
    }))
}

function identityFormFromMember(member, layoutSlots) {
  const slotKey = familySlots.normalizeSlotKey(member && member.slotKey)
  const showChildRelationship = familySlots.isChildSlot(slotKey)
  const childRelationshipIndex = member && member.relationship === 'daughter' ? 1 : 0
  return {
    selectedSlotKey: slotKey,
    selectedSlotLabel: slotKey ? familySlots.slotLabel(slotKey, member && member.relationship) : '',
    editSlots: buildSlotCards(layoutSlots, slotKey, member && member.userId),
    showChildRelationship,
    childRelationshipIndex,
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
    layoutSlots: [],
    editingMember: null,
    editSlots: buildSlotCards(null, '', null),
    selectedSlotKey: '',
    selectedSlotLabel: '',
    childRelationshipOptions: familySlots.CHILD_RELATIONSHIP_OPTIONS,
    childRelationshipLabels: familySlots.CHILD_RELATIONSHIP_OPTIONS.map((item) => item.label),
    childRelationshipIndex: 0,
    showChildRelationship: false,
    birthYear: '',
    familyNickname: '',
    preferredTitle: '',
    identityNote: '',
    savingIdentity: false,
    handlingMemberId: null,
    handlingAction: ''
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
      const [items, layout] = await Promise.all([
        adminService.getMembers(this.data.familyId),
        familyService.getFamilyLayout(this.data.familyId)
      ])
      this.setData({
        layoutSlots: layout.slots || [],
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
      wx.stopPullDownRefresh()
    }
  },
  onPullDownRefresh() {
    this.loadData()
  },
  startEditIdentity(event) {
    const item = event.currentTarget.dataset.item
    this.setData({
      editingMember: item,
      ...identityFormFromMember(item, this.data.layoutSlots)
    })
  },
  cancelEditIdentity() {
    this.setData({
      editingMember: null,
      ...identityFormFromMember(null, this.data.layoutSlots)
    })
  },
  selectIdentitySlot(event) {
    const selectedSlotKey = familySlots.normalizeSlotKey(event.currentTarget.dataset.key)
    if (!selectedSlotKey) {
      return
    }
    const slot = this.data.editSlots.find((item) => item.key === selectedSlotKey)
    if (slot && slot.occupiedByOther) {
      wx.showToast({ title: '这个位置已有家人', icon: 'none' })
      return
    }
    const showChildRelationship = familySlots.isChildSlot(selectedSlotKey)
    this.setData({
      selectedSlotKey,
      selectedSlotLabel: familySlots.slotLabel(selectedSlotKey, showChildRelationship
        ? this.data.childRelationshipOptions[this.data.childRelationshipIndex].value
        : undefined),
      showChildRelationship,
      editSlots: buildSlotCards(this.data.layoutSlots, selectedSlotKey, this.data.editingMember && this.data.editingMember.userId)
    })
  },
  handleChildRelationshipChange(event) {
    const childRelationshipIndex = Number(event.detail.value)
    const relationship = this.data.childRelationshipOptions[childRelationshipIndex]
      ? this.data.childRelationshipOptions[childRelationshipIndex].value
      : 'son'
    this.setData({
      childRelationshipIndex,
      selectedSlotLabel: this.data.selectedSlotKey ? familySlots.slotLabel(this.data.selectedSlotKey, relationship) : ''
    })
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
    if (!this.data.selectedSlotKey) {
      wx.showToast({ title: '请点选家庭位置', icon: 'none' })
      return
    }
    if (!this.data.familyNickname.trim()) {
      wx.showToast({ title: '请填写家庭昵称', icon: 'none' })
      return
    }
    this.setData({ savingIdentity: true, error: '' })
    try {
      await adminService.updateMemberIdentity(this.data.familyId, this.data.editingMember.userId, familySlots.buildIdentityPayload({
        slotKey: this.data.selectedSlotKey,
        childRelationship: this.data.childRelationshipOptions[this.data.childRelationshipIndex].value,
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
    if (item && item.isSelf) {
      wx.showToast({ title: '不能停用自己的留言权限', icon: 'none' })
      return
    }
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
    if (item && item.isSelf) {
      wx.showToast({ title: '不能调整自己的管理员身份', icon: 'none' })
      return
    }
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
    if (item && item.isSelf) {
      wx.showToast({ title: '不能把自己移出家庭', icon: 'none' })
      return
    }
    wx.showModal({
      title: '移出家庭',
      content: `确认将 ${item.displayName || item.user.nickname || '这位成员'} 移出这个家庭吗？`,
      confirmColor: '#c75f52',
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
