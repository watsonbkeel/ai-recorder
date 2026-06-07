const familyService = require('../../services/family')
const auth = require('../../utils/auth')
const familySlots = require('../../utils/familySlots')

function buildSlotCards(selectedSlotKey) {
  return familySlots.decorateSlots(familySlots.DEFAULT_FAMILY_SLOTS, selectedSlotKey ? [selectedSlotKey] : [])
}

Page({
  data: {
    loading: true,
    creating: false,
    selectingFamilyId: null,
    error: '',
    families: [],
    createName: '',
    createDescription: '',
    familySlots: buildSlotCards(''),
    selectedSlotKey: '',
    selectedSlotLabel: '',
    childRelationshipOptions: familySlots.CHILD_RELATIONSHIP_OPTIONS,
    childRelationshipLabels: familySlots.CHILD_RELATIONSHIP_OPTIONS.map((item) => item.label),
    childRelationshipIndex: 0,
    showChildRelationship: false,
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
  selectIdentitySlot(event) {
    const selectedSlotKey = familySlots.normalizeSlotKey(event.currentTarget.dataset.key)
    if (!selectedSlotKey) {
      return
    }
    const showChildRelationship = familySlots.isChildSlot(selectedSlotKey)
    this.setData({
      selectedSlotKey,
      selectedSlotLabel: familySlots.slotLabel(selectedSlotKey, showChildRelationship
        ? this.data.childRelationshipOptions[this.data.childRelationshipIndex].value
        : undefined),
      showChildRelationship,
      familySlots: buildSlotCards(selectedSlotKey)
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
    if (!this.data.selectedSlotKey) {
      wx.showToast({ title: '请点选你在家里的位置', icon: 'none' })
      return
    }
    if (!this.data.familyNickname.trim()) {
      wx.showToast({ title: '请填写家庭昵称', icon: 'none' })
      return
    }
    this.setData({ creating: true, error: '' })
    try {
      const created = await familyService.createFamily({
        name,
        description: this.data.createDescription,
        ...familySlots.buildIdentityPayload({
          slotKey: this.data.selectedSlotKey,
          childRelationship: this.data.childRelationshipOptions[this.data.childRelationshipIndex].value,
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
