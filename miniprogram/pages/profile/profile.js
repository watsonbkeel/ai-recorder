const authService = require('../../services/auth')
const familyService = require('../../services/family')
const auth = require('../../utils/auth')
const identity = require('../../utils/familyIdentity')

function identityFormFromFamily(family) {
  return {
    relationshipIndex: identity.optionIndex(identity.RELATIONSHIP_OPTIONS, family && family.relationship),
    genderIndex: identity.optionIndex(identity.GENDER_OPTIONS, family && family.gender),
    childOrder: family && family.childOrder ? String(family.childOrder) : '',
    birthYear: family && family.birthYear ? String(family.birthYear) : '',
    familyNickname: family && family.familyNickname ? family.familyNickname : '',
    preferredTitle: family && family.preferredTitle ? family.preferredTitle : '',
    identityNote: family && family.identityNote ? family.identityNote : ''
  }
}

Page({
  data: {
    loading: true,
    error: '',
    user: null,
    families: [],
    currentFamily: null,
    nicknameInput: '',
    avatarUrlInput: '',
    relationshipLabels: identity.RELATIONSHIP_LABELS,
    genderLabels: identity.GENDER_LABELS,
    relationshipIndex: 0,
    genderIndex: 0,
    childOrder: '',
    birthYear: '',
    familyNickname: '',
    preferredTitle: '',
    identityNote: '',
    savingProfile: false,
    savingIdentity: false
  },
  onShow() {
    this.loadData()
  },
  async loadData() {
    this.setData({ loading: true, error: '' })
    try {
      const [user, families] = await Promise.all([authService.getMe(), familyService.getMyFamilies()])
      const storedFamily = auth.getCurrentFamily()
      const currentFamily = storedFamily
        ? (families.find((item) => item.id === storedFamily.id) || families[0] || null)
        : (families[0] || null)

      if (currentFamily) {
        auth.setCurrentFamily(currentFamily)
        getApp().setCurrentFamily(currentFamily)
      }
      auth.setUser(user)
      getApp().setUser(user, auth.getToken())

      this.setData({
        user,
        families,
        currentFamily,
        nicknameInput: user.nickname || '',
        avatarUrlInput: user.avatarUrl || '',
        ...identityFormFromFamily(currentFamily)
      })
    } catch (error) {
      this.setData({ error: error.message || '加载失败' })
    } finally {
      this.setData({ loading: false })
    }
  },
  switchFamily(event) {
    const currentFamily = event.currentTarget.dataset.item
    auth.setCurrentFamily(currentFamily)
    getApp().setCurrentFamily(currentFamily)
    this.setData({
      currentFamily,
      ...identityFormFromFamily(currentFamily)
    })
    wx.showToast({ title: '已切换家庭', icon: 'success' })
  },
  handleNicknameInput(event) {
    this.setData({ nicknameInput: event.detail.value })
  },
  handleAvatarUrlInput(event) {
    this.setData({ avatarUrlInput: event.detail.value })
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
  async saveProfile() {
    if (this.data.savingProfile) {
      return
    }
    const nickname = this.data.nicknameInput.trim()
    if (!nickname) {
      wx.showToast({ title: '请输入昵称', icon: 'none' })
      return
    }

    this.setData({ savingProfile: true, error: '' })
    try {
      const user = await authService.updateMe({
        nickname,
        avatarUrl: this.data.avatarUrlInput.trim()
      })
      auth.setUser(user)
      getApp().setUser(user, auth.getToken())
      this.setData({ user })
      wx.showToast({ title: '昵称已保存', icon: 'success' })
    } catch (error) {
      this.setData({ error: error.message || '保存失败' })
    } finally {
      this.setData({ savingProfile: false })
    }
  },
  async saveIdentity() {
    if (this.data.savingIdentity) {
      return
    }
    if (!this.data.currentFamily) {
      wx.showToast({ title: '请先选择家庭', icon: 'none' })
      return
    }

    this.setData({ savingIdentity: true, error: '' })
    try {
      const updatedFamily = await familyService.updateIdentity(this.data.currentFamily.id, identity.buildIdentityPayload({
        relationship: identity.optionValue(identity.RELATIONSHIP_OPTIONS, this.data.relationshipIndex),
        gender: identity.optionValue(identity.GENDER_OPTIONS, this.data.genderIndex),
        childOrder: this.data.childOrder,
        birthYear: this.data.birthYear,
        familyNickname: this.data.familyNickname,
        preferredTitle: this.data.preferredTitle,
        identityNote: this.data.identityNote
      }))
      const families = this.data.families.map((item) => (item.id === updatedFamily.id ? updatedFamily : item))
      auth.setCurrentFamily(updatedFamily)
      getApp().setCurrentFamily(updatedFamily)
      this.setData({ families, currentFamily: updatedFamily })
      wx.showToast({ title: '家庭身份已保存', icon: 'success' })
    } catch (error) {
      this.setData({ error: error.message || '保存失败' })
    } finally {
      this.setData({ savingIdentity: false })
    }
  },
  logout() {
    auth.clearSession()
    wx.reLaunch({ url: '/pages/login/login' })
  },
  goAdmin() {
    if (this.data.currentFamily && this.data.currentFamily.role === 'admin') {
      wx.navigateTo({ url: `/pages/admin/dashboard/dashboard?familyId=${this.data.currentFamily.id}` })
    }
  }
})
