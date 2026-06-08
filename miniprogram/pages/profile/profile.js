const authService = require('../../services/auth')
const familyService = require('../../services/family')
const uploadService = require('../../services/upload')
const auth = require('../../utils/auth')
const familySlots = require('../../utils/familySlots')
const { getApiRootUrl } = require('../../utils/config')
const { handleFamilyAccessError } = require('../../utils/familyAccess')

function imageUrl(url) {
  const value = String(url || '').trim()
  if (!value) {
    return ''
  }
  if (/^https?:\/\//.test(value)) {
    return value
  }
  return `${getApiRootUrl()}${value}`
}

function identityFormFromFamily(family) {
  const slotKey = familySlots.normalizeSlotKey(family && family.slotKey)
  const showChildRelationship = familySlots.isChildSlot(slotKey)
  const childRelationshipIndex = family && family.relationship === 'daughter' ? 1 : 0
  const decoratedSlots = familySlots.decorateSlots(null, slotKey ? [slotKey] : [])
  return {
    selectedSlotKey: slotKey,
    selectedSlotLabel: slotKey ? familySlots.slotLabel(slotKey, family && family.relationship) : '',
    familySlots: decoratedSlots,
    ...familySlots.splitSlotsByGroup(decoratedSlots),
    showChildRelationship,
    childRelationshipIndex,
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
    avatarFallbackText: '家',
    avatarUrlInput: '',
    avatarPreviewUrl: '',
    uploadingAvatar: false,
    familySlots: familySlots.decorateSlots(null, ''),
    parentSlots: familySlots.splitSlotsByGroup(familySlots.decorateSlots(null, '')).parentSlots,
    childSlots: familySlots.splitSlotsByGroup(familySlots.decorateSlots(null, '')).childSlots,
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
        ? (families.find((item) => Number(item.id) === Number(storedFamily.id)) || families[0] || null)
        : (families[0] || null)

      if (currentFamily) {
        auth.setCurrentFamily(currentFamily)
        getApp().setCurrentFamily(currentFamily)
      } else {
        auth.clearCurrentFamily()
        getApp().setCurrentFamily(null)
      }
      auth.setUser(user)
      getApp().setUser(user, auth.getToken())

      this.setData({
        user,
        families,
        currentFamily,
        nicknameInput: user.nickname || '',
        avatarFallbackText: (user.nickname || '家').slice(0, 1),
        avatarUrlInput: user.avatarUrl || '',
        avatarPreviewUrl: imageUrl(user.avatarUrl),
        ...identityFormFromFamily(currentFamily)
      })
      if (currentFamily) {
        this.loadFamilyLayout(currentFamily.id, currentFamily.slotKey)
      }
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
    this.loadFamilyLayout(currentFamily.id, currentFamily.slotKey)
    wx.showToast({ title: '已切换家庭', icon: 'success' })
  },
  async loadFamilyLayout(familyId, selectedSlotKey) {
    if (!familyId) {
      return
    }
    try {
      const layout = await familyService.getFamilyLayout(familyId)
      const decoratedSlots = familySlots.decorateSlots(layout.slots, selectedSlotKey ? [selectedSlotKey] : [])
      this.setData({
        familySlots: decoratedSlots,
        ...familySlots.splitSlotsByGroup(decoratedSlots)
      })
    } catch (error) {
      if (handleFamilyAccessError(error, familyId)) {
        return
      }
      this.setData({ error: error.message || '家庭位置加载失败' })
    }
  },
  handleNicknameInput(event) {
    const nicknameInput = event.detail.value
    this.setData({
      nicknameInput,
      avatarFallbackText: (nicknameInput || '家').slice(0, 1)
    })
  },
  selectIdentitySlot(event) {
    const selectedSlotKey = familySlots.normalizeSlotKey(event.currentTarget.dataset.key)
    if (!selectedSlotKey) {
      return
    }
    const slot = this.data.familySlots.find((item) => item.key === selectedSlotKey)
    if (slot && slot.occupiedByOther) {
      wx.showToast({ title: '这个位置已有家人', icon: 'none' })
      return
    }
    const showChildRelationship = familySlots.isChildSlot(selectedSlotKey)
    const decoratedSlots = familySlots.decorateSlots(this.data.familySlots, [selectedSlotKey])
    this.setData({
      selectedSlotKey,
      selectedSlotLabel: familySlots.slotLabel(selectedSlotKey, showChildRelationship
        ? this.data.childRelationshipOptions[this.data.childRelationshipIndex].value
        : undefined),
      showChildRelationship,
      familySlots: decoratedSlots,
      ...familySlots.splitSlotsByGroup(decoratedSlots)
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
  async chooseAvatar() {
    if (this.data.uploadingAvatar || this.data.savingProfile) {
      return
    }
    const chooseFile = () => new Promise((resolve, reject) => {
      if (wx.chooseMedia) {
        wx.chooseMedia({
          count: 1,
          mediaType: ['image'],
          sourceType: ['album', 'camera'],
          success: (res) => resolve(res.tempFiles && res.tempFiles[0] && res.tempFiles[0].tempFilePath),
          fail: reject
        })
        return
      }
      wx.chooseImage({
        count: 1,
        sourceType: ['album', 'camera'],
        success: (res) => resolve(res.tempFilePaths && res.tempFilePaths[0]),
        fail: reject
      })
    })

    this.setData({ uploadingAvatar: true, error: '' })
    try {
      const filePath = await chooseFile()
      if (!filePath) {
        throw new Error('没有选择图片')
      }
      const uploaded = await uploadService.uploadImage(filePath)
      this.setData({
        avatarUrlInput: uploaded.url,
        avatarPreviewUrl: uploaded.fullUrl || imageUrl(uploaded.url)
      })
      wx.showToast({ title: '头像已选择', icon: 'success' })
    } catch (error) {
      if (!/cancel/.test(String(error.errMsg || error.message || ''))) {
        this.setData({ error: error.message || '头像上传失败' })
      }
    } finally {
      this.setData({ uploadingAvatar: false })
    }
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
      this.setData({
        user,
        avatarPreviewUrl: imageUrl(user.avatarUrl),
        avatarFallbackText: (user.nickname || '家').slice(0, 1)
      })
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
    if (!this.data.selectedSlotKey) {
      wx.showToast({ title: '请点选你在家里的位置', icon: 'none' })
      return
    }
    if (!this.data.familyNickname.trim()) {
      wx.showToast({ title: '请填写家庭昵称', icon: 'none' })
      return
    }

    this.setData({ savingIdentity: true, error: '' })
    try {
      const updatedFamily = await familyService.updateIdentity(this.data.currentFamily.id, familySlots.buildIdentityPayload({
        slotKey: this.data.selectedSlotKey,
        childRelationship: this.data.childRelationshipOptions[this.data.childRelationshipIndex].value,
        birthYear: this.data.birthYear,
        familyNickname: this.data.familyNickname,
        preferredTitle: this.data.preferredTitle,
        identityNote: this.data.identityNote
      }))
      const families = this.data.families.map((item) => (Number(item.id) === Number(updatedFamily.id) ? updatedFamily : item))
      auth.setCurrentFamily(updatedFamily)
      getApp().setCurrentFamily(updatedFamily)
      this.setData({
        families,
        currentFamily: updatedFamily,
        ...identityFormFromFamily(updatedFamily)
      })
      wx.showToast({ title: '家庭身份已保存', icon: 'success' })
    } catch (error) {
      if (handleFamilyAccessError(error, this.data.currentFamily && this.data.currentFamily.id)) {
        return
      }
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
