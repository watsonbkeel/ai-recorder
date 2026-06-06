const messageService = require('../../services/message')
const uploadService = require('../../services/upload')
const aiService = require('../../services/ai')
const familyService = require('../../services/family')
const auth = require('../../utils/auth')
const { identitySummary } = require('../../utils/familyIdentity')

const recorder = wx.getRecorderManager ? wx.getRecorderManager() : null
const audio = wx.createInnerAudioContext ? wx.createInnerAudioContext() : null
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
const FAMILY_CONTEXT_ERROR_CODES = new Set(['NOT_FAMILY_MEMBER'])

Page({
  data: {
    familyId: null,
    members: [],
    selectedReceiverIds: [],
    visibilityIndex: 0,
    visibilityLabels: VISIBILITY_LABELS,
    visibilityDescriptions: VISIBILITY_DESCRIPTIONS,
    messageTypeIndex: 8,
    messageTypeLabels: MESSAGE_TYPE_LABELS,
    originalText: '',
    optimizedText: '',
    emotionTags: [],
    coreNeed: '',
    aiAdvice: '',
    riskLevel: 'low',
    attackWarning: '',
    audioTempPath: '',
    audioDurationSec: 0,
    recording: false,
    allowOriginalTextView: false,
    allowOriginalAudioPlay: false,
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
    if (recorder) {
      recorder.onStop((res) => {
        this.setData({
          audioTempPath: res.tempFilePath,
          audioDurationSec: Math.round((res.duration || 0) / 1000),
          recording: false
        })
      })
      recorder.onError(() => {
        this.setData({ recording: false, error: '录音失败，请重试' })
      })
    }
  },
  onUnload() {
    this.clearAiStatus(false)
    if (this.data.recording && recorder) {
      recorder.stop()
    }
    if (audio) {
      audio.stop()
    }
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
    if (!this.data.familyId) {
      return
    }
    this.setData({ membersLoading: true, error: '' })
    try {
      const members = await familyService.getFamilyMembers(this.data.familyId)
      this.setData({
        members: members
          .filter((member) => !member.isSelf)
          .map((member) => ({
            ...member,
            selected: false,
            identitySummary: identitySummary(member)
          }))
      })
    } catch (error) {
      if (FAMILY_CONTEXT_ERROR_CODES.has(error.code)) {
        this.exitInvalidFamily('你已不在这个家庭，请重新选择')
        return
      }
      this.setData({ error: error.message || '加载家庭成员失败' })
    } finally {
      this.setData({ membersLoading: false })
    }
  },
  toggleReceiver(event) {
    const userId = Number(event.currentTarget.dataset.userId)
    const selectedSet = new Set(this.data.selectedReceiverIds)
    if (selectedSet.has(userId)) {
      selectedSet.delete(userId)
    } else {
      selectedSet.add(userId)
    }
    const selectedReceiverIds = Array.from(selectedSet)
    this.setData({
      selectedReceiverIds,
      members: this.data.members.map((member) => ({
        ...member,
        selected: selectedSet.has(Number(member.userId))
      }))
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
      members: visibility === 'private'
        ? this.data.members
        : this.data.members.map((member) => ({ ...member, selected: false }))
    })
  },
  handleOriginalInput(event) {
    this.setData({ originalText: event.detail.value })
  },
  handleOptimizedInput(event) {
    this.setData({ optimizedText: event.detail.value })
  },
  handleTextPermission(event) {
    this.setData({ allowOriginalTextView: event.detail.value })
  },
  handleAudioPermission(event) {
    this.setData({ allowOriginalAudioPlay: event.detail.value })
  },
  handleMemorySwitch(event) {
    this.setData({ useFamilyMemory: event.detail.value })
  },
  startRecord() {
    if (this.data.recording || this.data.loading || this.data.aiLoading) {
      return
    }
    if (!recorder) {
      wx.showToast({ title: '当前环境不支持录音', icon: 'none' })
      return
    }
    this.setData({ recording: true, audioTempPath: '', audioDurationSec: 0, error: '' })
    try {
      recorder.start({ duration: 120000, format: 'mp3' })
    } catch (error) {
      this.setData({ recording: false, error: '录音启动失败，请重试' })
    }
  },
  stopRecord() {
    if (recorder && this.data.recording) {
      recorder.stop()
    }
  },
  playAudio() {
    if (!audio || !this.data.audioTempPath || this.data.recording) {
      return
    }
    audio.stop()
    audio.src = this.data.audioTempPath
    audio.play()
  },
  effectiveReceiverIds() {
    const visibility = VISIBILITIES[this.data.visibilityIndex] || 'private'
    if (visibility === 'family') {
      return this.data.members.map((member) => Number(member.userId)).filter(Boolean)
    }
    if (visibility === 'self') {
      return []
    }
    return this.data.selectedReceiverIds
  },
  async optimize() {
    if (this.data.aiLoading || this.data.loading || this.data.recording) {
      return
    }
    if (!this.data.originalText.trim()) {
      wx.showToast({ title: '请先写下文字原话或语音大意', icon: 'none' })
      return
    }
    this.setData({ aiLoading: true, error: '' })
    this.startAiStatus()
    try {
      const result = await aiService.optimizeMessage({
        familyId: this.data.familyId,
        visibility: VISIBILITIES[this.data.visibilityIndex] || 'private',
        receiverIds: this.effectiveReceiverIds(),
        originalText: this.data.originalText,
        hasOriginalAudio: Boolean(this.data.audioTempPath),
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
      if (FAMILY_CONTEXT_ERROR_CODES.has(error.code)) {
        this.exitInvalidFamily('你已不在这个家庭，请重新选择')
        return
      }
      this.setData({ error: error.message || 'AI 整理失败' })
    } finally {
      this.clearAiStatus()
      this.setData({ aiLoading: false })
    }
  },
  async submit() {
    if (this.data.loading || this.data.aiLoading || this.data.recording) {
      return
    }
    const visibility = VISIBILITIES[this.data.visibilityIndex] || 'private'
    const receiverIds = this.effectiveReceiverIds()
    const originalText = this.data.originalText.trim()
    const optimizedText = this.data.optimizedText.trim() || originalText
    if (visibility === 'private' && !receiverIds.length) {
      wx.showToast({ title: '请选择接收家人', icon: 'none' })
      return
    }
    if (!optimizedText) {
      wx.showToast({ title: '请先写下文字或填写整理版', icon: 'none' })
      return
    }
    this.setData({ loading: true, error: '' })
    try {
      let uploadedAudio = null
      if (this.data.audioTempPath) {
        uploadedAudio = await uploadService.uploadAudio(this.data.audioTempPath)
      }
      await messageService.createMessage(this.data.familyId, {
        receiverIds,
        visibility,
        messageType: MESSAGE_TYPES[this.data.messageTypeIndex],
        originalText: this.data.originalText,
        originalAudioUrl: uploadedAudio ? uploadedAudio.url : '',
        audioDurationSec: this.data.audioDurationSec,
        optimizedText,
        emotionTags: this.data.emotionTags,
        coreNeed: this.data.coreNeed,
        aiAdvice: this.data.aiAdvice,
        riskLevel: this.data.riskLevel,
        attackWarning: this.data.attackWarning,
        allowOriginalTextView: this.data.allowOriginalTextView,
        allowOriginalAudioPlay: this.data.allowOriginalAudioPlay
      })
      wx.showToast({ title: '已发送', icon: 'success' })
      setTimeout(() => wx.navigateBack(), 500)
    } catch (error) {
      if (FAMILY_CONTEXT_ERROR_CODES.has(error.code)) {
        this.exitInvalidFamily('你已不在这个家庭，请重新选择')
        return
      }
      this.setData({ error: error.message || '发送失败' })
    } finally {
      this.setData({ loading: false })
    }
  }
})
