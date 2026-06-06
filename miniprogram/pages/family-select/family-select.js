const familyService = require('../../services/family')
const auth = require('../../utils/auth')
const identity = require('../../utils/familyIdentity')

Page({
  data: {
    loading: true,
    creating: false,
    selectingFamilyId: null,
    error: '',
    families: [],
    createName: '',
    createDescription: '',
    relationshipLabels: identity.RELATIONSHIP_LABELS,
    genderLabels: identity.GENDER_LABELS,
    relationshipIndex: identity.optionIndex(identity.RELATIONSHIP_OPTIONS, 'other'),
    showChildOrder: false,
    genderIndex: identity.optionIndex(identity.GENDER_OPTIONS, 'unspecified'),
    childOrder: '',
    birthYear: '',
    familyNickname: '',
    preferredTitle: '',
    identityNote: ''
  },
  onShow() {
    this.setData({ selectingFamilyId: null })
    this.loadFamilies()
  },
  async loadFamilies() {
    this.setData({ loading: true, error: '' })
    try {
      const families = await familyService.getMyFamilies()
      const storedFamily = auth.getCurrentFamily()
      if (storedFamily) {
        const refreshedFamily = families.find((family) => Number(family.id) === Number(storedFamily.id))
        if (refreshedFamily) {
          auth.setCurrentFamily(refreshedFamily)
          getApp().setCurrentFamily(refreshedFamily)
        } else {
          auth.clearCurrentFamily()
          getApp().setCurrentFamily(null)
        }
      }
      this.setData({ families })
    } catch (error) {
      this.setData({ error: error.message || '加载失败' })
    } finally {
      this.setData({ loading: false })
    }
  },
  handleNameInput(event) {
    this.setData({ createName: event.detail.value })
  },
  handleDescriptionInput(event) {
    this.setData({ createDescription: event.detail.value })
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
  selectFamily(event) {
    const currentFamily = event.currentTarget.dataset.item
    if (!currentFamily || this.data.selectingFamilyId) {
      return
    }
    this.setData({ selectingFamilyId: currentFamily.id })
    auth.setCurrentFamily(currentFamily)
    getApp().setCurrentFamily(currentFamily)
    wx.navigateTo({ url: `/pages/message-list/message-list?familyId=${currentFamily.id}` })
  },
  goJoin() {
    wx.navigateTo({ url: '/pages/join-family/join-family' })
  },
  async createFamily() {
    if (this.data.creating) {
      return
    }
    const name = this.data.createName.trim()
    if (!name) {
      wx.showToast({ title: '请输入家庭名称', icon: 'none' })
      return
    }
    this.setData({ creating: true, error: '' })
    try {
      const created = await familyService.createFamily({
        name,
        description: this.data.createDescription,
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
      auth.setCurrentFamily(created)
      getApp().setCurrentFamily(created)
      wx.showToast({ title: '创建成功', icon: 'success' })
      wx.navigateTo({ url: `/pages/message-list/message-list?familyId=${created.id}` })
    } catch (error) {
      this.setData({ error: error.message || '创建失败' })
    } finally {
      this.setData({ creating: false })
    }
  }
})
