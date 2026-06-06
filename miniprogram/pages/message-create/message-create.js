const messageService = require('../../services/message')
const uploadService = require('../../services/upload')
const aiService = require('../../services/ai')
const familyService = require('../../services/family')
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
    membersLoading: false,
    loading: false,
    error: ''
  },
  onLoad(options) {
    this.setData({ familyId: Number(options.familyId) })
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
    if (!recorder) {
      wx.showToast({ title: '当前环境不支持录音', icon: 'none' })
      return
    }
    this.setData({ recording: true, error: '' })
    recorder.start({ duration: 120000, format: 'mp3' })
  },
  stopRecord() {
    if (recorder) {
      recorder.stop()
    }
  },
  playAudio() {
    if (!audio || !this.data.audioTempPath) {
      return
    }
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
    if (!this.data.originalText.trim() && !this.data.audioTempPath) {
      wx.showToast({ title: '请先写下心声或录音', icon: 'none' })
      return
    }
    this.setData({ aiLoading: true, error: '' })
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
      this.setData({ error: error.message || 'AI 整理失败' })
    } finally {
      this.setData({ aiLoading: false })
    }
  },
  async submit() {
    const visibility = VISIBILITIES[this.data.visibilityIndex] || 'private'
    const receiverIds = this.effectiveReceiverIds()
    if (visibility === 'private' && !receiverIds.length) {
      wx.showToast({ title: '请选择接收家人', icon: 'none' })
      return
    }
    if (!this.data.optimizedText.trim()) {
      wx.showToast({ title: '请先生成或填写整理版', icon: 'none' })
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
        optimizedText: this.data.optimizedText,
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
      this.setData({ error: error.message || '发送失败' })
    } finally {
      this.setData({ loading: false })
    }
  }
})
