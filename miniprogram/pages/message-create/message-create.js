const messageService = require('../../services/message')
const aiService = require('../../services/ai')
const familyService = require('../../services/family')
const auth = require('../../utils/auth')
const { identitySummary } = require('../../utils/familyIdentity')
const familySlots = require('../../utils/familySlots')
const { handleFamilyAccessError } = require('../../utils/familyAccess')

const MESSAGE_TYPES = ['thanks', 'apology', 'grievance', 'request', 'explain', 'stress', 'repair', 'encouragement', 'general']
const MESSAGE_TYPE_LABELS = ['感谢', '道歉', '委屈', '请求', '解释', '压力', '修复关系', '鼓励', '普通心声']
const VISIBILITIES = ['private', 'family', 'self']
const VISIBILITY_LABELS = ['指定家人', '全家可见', '仅自己']
const VISIBILITY_DESCRIPTIONS = [
  '只发给你选择的家人，其他成员不可见。',
  '家庭成员都能在时间线看到这条心声。',
  '只保存给自己，用来整理想法，不通知家人。'
]
const AI_STATUS_STEPS = [
  'AI 正在理解你的心里话...',
  '正在识别这段话背后的情绪和需求...',
  '正在整理成更容易被家人听见的表达...',
  '快好了，正在保留你的本意和边界...'
]

Page({
  data: {
    familyId: null,
    members: [],
    receiverSlots: [],
    selectedReceiverIds: [],
    selectedReceiverSlotKeys: [],
    visibilityIndex: 0,
    visibilityLabels: VISIBILITY_LABELS,
    visibilityDescriptions: VISIBILITY_DESCRIPTIONS,
    messageTypeIndex: 8,
    messageTypeLabels: MESSAGE_TYPE_LABELS,
    
    // 文本与 AI 状态
    originalText: '',
    optimizedText: '',
    emotionTags: [],
    coreNeed: '',
    aiAdvice: '',
    riskLevel: 'low',
    attackWarning: '',
    
    // 开关与状态
    allowOriginalTextView: false,
    useFamilyMemory: true,
    aiLoading: false,
    aiStatusText: '',
    membersLoading: false,
    loading: false,
    error: ''
  },

  onLoad(options) {
    this.setData({ familyId: Number(options.familyId) })
    if (!Number(options.familyId)) {
      this.exitInvalidFamily('请先选择家庭')
      return
    }
    this.loadMembers()
  },

  onUnload() {
    this.clearAiStatus(false)
  },

  startAiStatus() {
    this.clearAiStatus(false)
    let index = 0
    this.setData({ aiStatusText: AI_STATUS_STEPS[index] })
    this.aiStatusTimer = setInterval(() => {
      index = Math.min(index + 1, AI_STATUS_STEPS.length - 1)
      this.setData({ aiStatusText: AI_STATUS_STEPS[index] })
    }, 4500)
  },

  clearAiStatus(reset = true) {
    if (this.aiStatusTimer) {
      clearInterval(this.aiStatusTimer)
      this.aiStatusTimer = null
    }
    if (reset) {
      this.setData({ aiStatusText: '' })
    }
  },

  exitInvalidFamily(message) {
    auth.clearCurrentFamily()
    getApp().setCurrentFamily(null)
    wx.showToast({ title: message || '家庭状态已更新，请重新选择', icon: 'none' })
    setTimeout(() => {
      wx.reLaunch({ url: '/pages/family-select/family-select' })
    }, 500)
  },

  async loadMembers() {
    if (!this.data.familyId) return
    this.setData({ membersLoading: true, error: '' })
    try {
      const layout = await familyService.getFamilyLayout(this.data.familyId)
      const slots = familySlots.decorateSlots(layout.slots, this.data.selectedReceiverSlotKeys)
        .filter((slot) => !(slot.member && slot.member.isSelf))
      const members = layout.members || []
      this.setData({
        receiverSlots: slots,
        members: members
          .filter((member) => !member.isSelf)
          .map((member) => ({
            ...member,
            selected: false,
            identitySummary: identitySummary(member)
          }))
      })
    } catch (error) {
      if (handleFamilyAccessError(error, this.data.familyId)) return
      this.setData({ error: error.message || '加载家庭成员失败' })
    } finally {
      this.setData({ membersLoading: false })
    }
  },

  toggleReceiver(event) {
    const userId = Number(event.currentTarget.dataset.userId)
    const selectedSet = new Set(this.data.selectedReceiverIds)
    if (selectedSet.has(userId)) selectedSet.delete(userId)
    else selectedSet.add(userId)
    const selectedReceiverIds = Array.from(selectedSet)
    this.setData({
      selectedReceiverIds,
      members: this.data.members.map((member) => ({
        ...member,
        selected: selectedSet.has(Number(member.userId))
      }))
    })
  },

  toggleReceiverSlot(event) {
    const slotKey = familySlots.normalizeSlotKey(event.currentTarget.dataset.key)
    if (!slotKey) return
    const selectedSet = new Set(this.data.selectedReceiverSlotKeys)
    if (selectedSet.has(slotKey)) selectedSet.delete(slotKey)
    else selectedSet.add(slotKey)
    const selectedReceiverSlotKeys = Array.from(selectedSet)
    this.setData({
      selectedReceiverSlotKeys,
      receiverSlots: familySlots.decorateSlots(this.data.receiverSlots, selectedReceiverSlotKeys)
    })
  },

  handleTypeChange(event) {
    this.setData({ messageTypeIndex: Number(event.detail.value) })
  },

  handleVisibilityChange(event) {
    const visibilityIndex = Number(event.detail.value)
    const visibility = VISIBILITIES[visibilityIndex] || 'private'
    this.setData({
      visibilityIndex,
      selectedReceiverIds: visibility === 'private' ? this.data.selectedReceiverIds : [],
      selectedReceiverSlotKeys: visibility === 'private' ? this.data.selectedReceiverSlotKeys : [],
      allowOriginalTextView: visibility === 'self' ? false : this.data.allowOriginalTextView,
      members: visibility === 'private'
        ? this.data.members
        : this.data.members.map((member) => ({ ...member, selected: false })),
      receiverSlots: visibility === 'private'
        ? this.data.receiverSlots
        : familySlots.decorateSlots(this.data.receiverSlots, [])
    })
  },

  handleOriginalInput(event) {
    this.setData({
      originalText: event.detail.value,
      optimizedText: '',
      emotionTags: [],
      coreNeed: '',
      aiAdvice: '',
      riskLevel: 'low',
      attackWarning: ''
    })
  },

  handleOptimizedInput(event) {
    this.setData({ optimizedText: event.detail.value })
  },

  handleTextPermission(event) {
    this.setData({ allowOriginalTextView: event.detail.value })
  },

  handleMemorySwitch(event) {
    this.setData({ useFamilyMemory: event.detail.value })
  },

  effectiveReceiverIds() {
    const visibility = VISIBILITIES[this.data.visibilityIndex] || 'private'
    if (visibility === 'family') return this.data.members.map((member) => Number(member.userId)).filter(Boolean)
    if (visibility === 'self') return []
    return this.data.selectedReceiverIds
  },

  effectiveReceiverSlotKeys() {
    const visibility = VISIBILITIES[this.data.visibilityIndex] || 'private'
    if (visibility !== 'private') return []
    return this.data.selectedReceiverSlotKeys
  },

  async optimize() {
    if (this.data.aiLoading || this.data.loading) return
    const visibility = VISIBILITIES[this.data.visibilityIndex] || 'private'
    const receiverIds = this.effectiveReceiverIds()
    const receiverSlotKeys = this.effectiveReceiverSlotKeys()
    
    if (visibility === 'private' && !receiverIds.length && !receiverSlotKeys.length) {
      wx.showToast({ title: '请先选择接收家人', icon: 'none' })
      return
    }
    if (!this.data.originalText.trim()) {
      wx.showToast({ title: '请先写下你想说的话', icon: 'none' })
      return
    }
    
    this.setData({ aiLoading: true, error: '' })
    this.startAiStatus()
    try {
      const result = await aiService.optimizeMessage({
        familyId: this.data.familyId,
        visibility,
        receiverIds,
        receiverSlotKeys,
        originalText: this.data.originalText,
        hasOriginalAudio: false, // 明确告知后端无音频
        messageType: MESSAGE_TYPES[this.data.messageTypeIndex],
        useFamilyMemory: this.data.useFamilyMemory
      })
      this.setData({
        optimizedText: result.optimizedText || this.data.originalText,
        emotionTags: result.emotionTags || [],
        coreNeed: result.coreNeed || '',
        aiAdvice: result.communicationAdvice || '',
        riskLevel: result.riskLevel || 'low',
        attackWarning: result.attackWarning || ''
      })
    } catch (error) {
      if (handleFamilyAccessError(error, this.data.familyId)) return
      wx.showModal({
        title: 'AI 整理暂时不可用',
        content: '系统或网络异常，AI 无法自动优化。你可以直接对原文进行预览和发送。',
        confirmText: '使用原文',
        cancelText: '取消',
        confirmColor: '#df7d62',
        success: (res) => {
          if (res.confirm) {
            this.setData({
              optimizedText: this.data.originalText,
              emotionTags: [], coreNeed: '', aiAdvice: '', riskLevel: 'low', attackWarning: ''
            })
          }
        }
      })
    } finally {
      this.clearAiStatus()
      this.setData({ aiLoading: false })
    }
  },

  async submit() {
    if (this.data.loading || this.data.aiLoading) return
    const visibility = VISIBILITIES[this.data.visibilityIndex] || 'private'
    const receiverIds = this.effectiveReceiverIds()
    const receiverSlotKeys = this.effectiveReceiverSlotKeys()
    const optimizedText = this.data.optimizedText.trim()
    
    if (visibility === 'private' && !receiverIds.length && !receiverSlotKeys.length) {
      wx.showToast({ title: '请选择接收家人', icon: 'none' })
      return
    }
    if (!optimizedText && !this.data.originalText.trim()) {
      wx.showToast({ title: '发送内容不能为空', icon: 'none' })
      return
    }

    this.setData({ loading: true, error: '' })
    try {
      await messageService.createMessage(this.data.familyId, {
        receiverIds,
        receiverSlotKeys,
        visibility,
        messageType: MESSAGE_TYPES[this.data.messageTypeIndex],
        originalText: this.data.originalText,
        originalAudioUrl: '', // 置空音频字段
        audioDurationSec: 0,  // 置空音频字段
        optimizedText: optimizedText || this.data.originalText,
        emotionTags: this.data.emotionTags,
        coreNeed: this.data.coreNeed,
        aiAdvice: this.data.aiAdvice,
        riskLevel: this.data.riskLevel,
        attackWarning: this.data.attackWarning,
        allowOriginalTextView: this.data.allowOriginalTextView,
        allowOriginalAudioPlay: false // 永远为 false
      })
      wx.showToast({ title: '已发送', icon: 'success' })
      setTimeout(() => wx.navigateBack(), 500)
    } catch (error) {
      if (handleFamilyAccessError(error, this.data.familyId)) return
      this.setData({ error: error.message || '发送失败' })
    } finally {
      this.setData({ loading: false })
    }
  }
})
