const familyService = require('../../services/family')
const familySlots = require('../../utils/familySlots')

function buildSlotCards(slots, selectedSlotKey) {
  return familySlots.decorateSlots(slots || familySlots.DEFAULT_FAMILY_SLOTS, selectedSlotKey ? [selectedSlotKey] : [])
}

Page({
  data: {
    inviteCode: '',
    message: '',
    familyPreview: null,
    familySlots: buildSlotCards(null, ''),
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
    loading: false,
    error: ''
  },
  handleInviteInput(event) {
    this.setData({
      inviteCode: event.detail.value,
      familyPreview: null,
      selectedSlotKey: '',
      selectedSlotLabel: '',
      familySlots: buildSlotCards(null, '')
    })
  },
  handleMessageInput(event) {
    this.setData({ message: event.detail.value })
  },
  selectIdentitySlot(event) {
    const slotKey = familySlots.normalizeSlotKey(event.currentTarget.dataset.key)
    if (!slotKey) {
      return
    }
    const slot = this.data.familySlots.find((item) => item.key === slotKey)
    if (slot && slot.occupied) {
      wx.showToast({ title: '这个位置已有家人', icon: 'none' })
      return
    }
    const showChildRelationship = familySlots.isChildSlot(slotKey)
    this.setData({
      selectedSlotKey: slotKey,
      selectedSlotLabel: familySlots.slotLabel(slotKey, showChildRelationship
        ? this.data.childRelationshipOptions[this.data.childRelationshipIndex].value
        : undefined),
      showChildRelationship,
      familySlots: buildSlotCards(this.data.familyPreview && this.data.familyPreview.slots, slotKey)
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
  async previewFamily() {
    if (this.data.loading) {
      return null
    }
    const inviteCode = this.data.inviteCode.trim()
    if (!inviteCode) {
      wx.showToast({ title: '请输入邀请码', icon: 'none' })
      return null
    }
    this.setData({ loading: true, error: '' })
    try {
      const family = await familyService.getFamilyByInvite(inviteCode)
      this.setData({
        familyPreview: family,
        selectedSlotKey: '',
        selectedSlotLabel: '',
        showChildRelationship: false,
        familySlots: buildSlotCards(family.slots, '')
      })
      return family
    } catch (error) {
      this.setData({ error: error.message || '查询家庭失败' })
      return null
    } finally {
      this.setData({ loading: false })
    }
  },
  async submit() {
    if (this.data.loading) {
      return
    }
    const family = this.data.familyPreview || await this.previewFamily()
    if (!family) {
      return
    }
    if (!this.data.selectedSlotKey) {
      wx.showToast({ title: '请点选你在家里的位置', icon: 'none' })
      return
    }
    if (!this.data.familyNickname.trim()) {
      wx.showToast({ title: '请填写家庭昵称', icon: 'none' })
      return
    }
    this.setData({ loading: true, error: '' })
    try {
      await familyService.createJoinRequest(family.id, {
        message: this.data.message || '申请加入家庭',
        ...familySlots.buildIdentityPayload({
          slotKey: this.data.selectedSlotKey,
          childRelationship: this.data.childRelationshipOptions[this.data.childRelationshipIndex].value,
          birthYear: this.data.birthYear,
          familyNickname: this.data.familyNickname,
          preferredTitle: this.data.preferredTitle,
          identityNote: this.data.identityNote
        })
      })
      wx.showToast({ title: '申请已提交', icon: 'success' })
      setTimeout(() => wx.navigateBack(), 500)
    } catch (error) {
      this.setData({ error: error.message || '提交失败' })
    } finally {
      this.setData({ loading: false })
    }
  }
})
