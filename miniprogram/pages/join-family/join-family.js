const familyService = require('../../services/family')
const identity = require('../../utils/familyIdentity')

Page({
  data: {
    inviteCode: '',
    message: '',
    relationshipLabels: identity.RELATIONSHIP_LABELS,
    genderLabels: identity.GENDER_LABELS,
    relationshipIndex: identity.optionIndex(identity.RELATIONSHIP_OPTIONS, 'other'),
    showChildOrder: false,
    genderIndex: identity.optionIndex(identity.GENDER_OPTIONS, 'unspecified'),
    childOrder: '',
    birthYear: '',
    familyNickname: '',
    preferredTitle: '',
    identityNote: '',
    loading: false,
    error: ''
  },
  handleInviteInput(event) {
    this.setData({ inviteCode: event.detail.value })
  },
  handleMessageInput(event) {
    this.setData({ message: event.detail.value })
  },
  handleRelationshipChange(event) {
    const relationshipIndex = Number(event.detail.value)
    const relationship = identity.optionValue(identity.RELATIONSHIP_OPTIONS, relationshipIndex)
    const showChildOrder = identity.isChildRelationship(relationship)
    this.setData({
      relationshipIndex,
      showChildOrder,
      childOrder: showChildOrder ? this.data.childOrder : ''
    })
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
  async submit() {
    if (this.data.loading) {
      return
    }
    const inviteCode = this.data.inviteCode.trim()
    if (!inviteCode) {
      wx.showToast({ title: '请输入邀请码', icon: 'none' })
      return
    }
    this.setData({ loading: true, error: '' })
    try {
      const family = await familyService.getFamilyByInvite(inviteCode)
      await familyService.createJoinRequest(family.id, {
        message: this.data.message || '申请加入家庭',
        ...identity.buildIdentityPayload({
          relationship: identity.optionValue(identity.RELATIONSHIP_OPTIONS, this.data.relationshipIndex),
          gender: identity.optionValue(identity.GENDER_OPTIONS, this.data.genderIndex),
          childOrder: this.data.childOrder,
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
