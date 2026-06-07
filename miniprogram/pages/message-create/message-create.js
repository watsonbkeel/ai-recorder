const messageService = require('../../services/message')
const uploadService = require('../../services/upload')
const aiService = require('../../services/ai')
const familyService = require('../../services/family')
const auth = require('../../utils/auth')
const { identitySummary } = require('../../utils/familyIdentity')
const familySlots = require('../../utils/familySlots')
const { handleFamilyAccessError } = require('../../utils/familyAccess')

const recorder = wx.getRecorderManager ? wx.getRecorderManager() : null
const MESSAGE_TYPES = ['thanks', 'apology', 'grievance', 'request', 'explain', 'stress', 'repair', 'encouragement', 'general']
const MESSAGE_TYPE_LABELS = ['感谢', '道歉', '委屈', '请求', '解释', '压力', '修复关系', '鼓励', '普通心声']
const VISIBILITIES = ['private', 'family', 'self']
const VISIBILITY_LABELS = ['指定家人', '全家可见', '仅自己']
const VISIBILITY_DESCRIPTIONS = [
  '只发给你选择的家人，其他成员不可见。',
  '家庭成员都能在时间线看到这条心声。',
  '只保存给自己，用来整理想法，不通知家人。'
]
const PREVIEW_MODELS = ['standard', 'advanced']
const PREVIEW_MODEL_LABELS = ['普通模型预览', '高级模型预览']
const AI_STATUS_STEPS = [
  'AI 正在理解你的心里话...',
  '正在识别这段话背后的情绪和需求...',
  '正在整理成更容易被家人听见的表达...',
  '快好了，正在保留你的本意和边界...'
]
const MIN_RECORD_DURATION_MS = 800

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
    previewModelIndex: 0,
    previewModelLabels: PREVIEW_MODEL_LABELS,
    originalText: '',
    optimizedText: '',
    inputMode: 'text',
    emotionTags: [],
    coreNeed: '',
    aiAdvice: '',
    riskLevel: 'low',
    attackWarning: '',
    audioTempPath: '',
    uploadedAudioUrl: '',
    audioDurationSec: 0,
    recording: false,
    playingAudio: false,
    transcribing: false,
    transcribeStatus: '',
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
    this.audio = wx.createInnerAudioContext ? wx.createInnerAudioContext() : null
    this.setData({ familyId: Number(options.familyId) })
    if (!Number(options.familyId)) {
      this.exitInvalidFamily('请先选择家庭')
      return
    }
    this.loadMembers()
    if (recorder) {
      this.handleRecorderStop = (res) => {
        this.handleRecordStop(res)
      }
      this.handleRecorderError = () => {
        this.voicePressActive = false
        this.setData({
          recording: false,
          transcribeStatus: '录音没有保存成功，请重新按住说话。',
          error: '录音失败，请重试'
        })
      }
      recorder.onStop(this.handleRecorderStop)
      recorder.onError(this.handleRecorderError)
    }
    if (this.audio) {
      this.audio.onEnded(() => {
        this.setData({ playingAudio: false })
      })
      this.audio.onError(() => {
        this.setData({ playingAudio: false, error: '语音试听失败，请重新录制或稍后再试' })
      })
    }
  },
  onUnload() {
    this.clearAiStatus(false)
    if (this.data.recording && recorder) {
      recorder.stop()
    }
    if (recorder && this.handleRecorderStop && recorder.offStop) {
      recorder.offStop(this.handleRecorderStop)
    }
    if (recorder && this.handleRecorderError && recorder.offError) {
      recorder.offError(this.handleRecorderError)
    }
    if (this.audio) {
      this.audio.stop()
      if (this.audio.destroy) {
        this.audio.destroy()
      }
      this.audio = null
    }
    this.setData({ playingAudio: false })
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
      if (handleFamilyAccessError(error, this.data.familyId)) {
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
  toggleReceiverSlot(event) {
    const slotKey = familySlots.normalizeSlotKey(event.currentTarget.dataset.key)
    if (!slotKey) {
      return
    }
    const selectedSet = new Set(this.data.selectedReceiverSlotKeys)
    if (selectedSet.has(slotKey)) {
      selectedSet.delete(slotKey)
    } else {
      selectedSet.add(slotKey)
    }
    const selectedReceiverSlotKeys = Array.from(selectedSet)
    this.setData({
      selectedReceiverSlotKeys,
      receiverSlots: familySlots.decorateSlots(this.data.receiverSlots, selectedReceiverSlotKeys)
    })
  },
  handleTypeChange(event) {
    this.setData({ messageTypeIndex: Number(event.detail.value) })
  },
  handlePreviewModelChange(event) {
    this.setData({
      previewModelIndex: Number(event.detail.value),
      optimizedText: '',
      emotionTags: [],
      coreNeed: '',
      aiAdvice: '',
      riskLevel: 'low',
      attackWarning: ''
    })
  },
  handleVisibilityChange(event) {
    const visibilityIndex = Number(event.detail.value)
    const visibility = VISIBILITIES[visibilityIndex] || 'private'
    this.setData({
      visibilityIndex,
      selectedReceiverIds: visibility === 'private' ? this.data.selectedReceiverIds : [],
      selectedReceiverSlotKeys: visibility === 'private' ? this.data.selectedReceiverSlotKeys : [],
      allowOriginalTextView: visibility === 'self' ? false : this.data.allowOriginalTextView,
      allowOriginalAudioPlay: visibility === 'self' ? false : this.data.allowOriginalAudioPlay,
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
  handleAudioPermission(event) {
    this.setData({ allowOriginalAudioPlay: event.detail.value })
  },
  handleMemorySwitch(event) {
    this.setData({ useFamilyMemory: event.detail.value })
  },
  toggleInputMode() {
    if (this.data.loading || this.data.aiLoading || this.data.transcribing) {
      return
    }
    if (this.data.recording) {
      this.stopRecord()
      return
    }
    this.setData({
      inputMode: this.data.inputMode === 'voice' ? 'text' : 'voice',
      error: ''
    })
  },
  async requestOpenRecordSetting() {
    const shouldOpenSetting = await new Promise((resolve) => {
      wx.showModal({
        title: '开启录音权限',
        content: '暖心留声需要麦克风权限，才能录下给家人的原始语音。',
        confirmText: '去设置',
        confirmColor: '#df7d62',
        success: (res) => resolve(Boolean(res.confirm)),
        fail: () => resolve(false)
      })
    })
    if (!shouldOpenSetting || !wx.openSetting) {
      this.setData({ error: '未开启录音权限，暂时无法录制原声。' })
      return false
    }

    const nextSettings = await new Promise((resolve) => {
      wx.openSetting({
        success: resolve,
        fail: () => resolve({ authSetting: {} })
      })
    })
    const enabled = Boolean(nextSettings.authSetting && nextSettings.authSetting['scope.record'])
    if (!enabled) {
      this.setData({ error: '未开启录音权限，暂时无法录制原声。' })
    }
    return enabled
  },
  async ensureRecordPermission() {
    if (!wx.getSetting || !wx.authorize) {
      return true
    }

    const settings = await new Promise((resolve) => {
      wx.getSetting({
        success: resolve,
        fail: () => resolve({ authSetting: {} })
      })
    })
    const recordSetting = settings.authSetting && settings.authSetting['scope.record']
    if (recordSetting === true) {
      return true
    }

    if (recordSetting === false) {
      return this.requestOpenRecordSetting()
    }

    const authorized = await new Promise((resolve) => {
      wx.authorize({
        scope: 'scope.record',
        success: () => resolve(true),
        fail: () => resolve(false)
      })
    })
    if (!authorized) {
      return this.requestOpenRecordSetting()
    }
    return authorized
  },
  async startRecord() {
    if (this.data.recording || this.data.playingAudio || this.data.loading || this.data.aiLoading) {
      return
    }
    if (!recorder) {
      wx.showToast({ title: '当前环境不支持录音', icon: 'none' })
      return
    }
    const hasPermission = await this.ensureRecordPermission()
    if (!hasPermission) {
      return
    }
    if (!this.voicePressActive) {
      return
    }
    const replacingPreviousAudio = Boolean(this.data.audioTempPath || this.data.uploadedAudioUrl)
    this.recordStartedAt = Date.now()
    this.setData({
      recording: true, audioTempPath: '', audioDurationSec: 0, allowOriginalAudioPlay: false,
      uploadedAudioUrl: '',
      transcribeStatus: replacingPreviousAudio ? '正在重新留声，这次录音会替换上一段原声。' : '正在录音，松手保存这段留声。',
      error: ''
    })
    try {
      recorder.start({ duration: 120000, format: 'mp3' })
      if (!this.voicePressActive) {
        recorder.stop()
      }
    } catch (error) {
      this.setData({ recording: false, error: '录音启动失败，请重试' })
    }
  },
  stopRecord() {
    if (recorder && this.data.recording) {
      recorder.stop()
    }
  },
  handleVoiceTouchStart() {
    if (this.data.inputMode !== 'voice' || this.data.transcribing) {
      return
    }
    if (this.data.audioTempPath && wx.vibrateShort) {
      wx.vibrateShort({ type: 'medium' })
    }
    this.voicePressActive = true
    this.startRecord()
  },
  handleVoiceTouchEnd() {
    if (this.data.inputMode !== 'voice') {
      return
    }
    this.voicePressActive = false
    if (this.data.recording) {
      this.setData({ transcribeStatus: '正在保存这段留声...' })
      this.stopRecord()
    }
  },
  handleVoiceTouchCancel() {
    this.voicePressActive = false
    if (this.data.recording) {
      this.setData({ transcribeStatus: '录音已结束，正在保存...' })
      this.stopRecord()
    }
  },
  handleRecordStop(res) {
    this.voicePressActive = false
    const durationMs = Number(res.duration || 0) || Math.max(0, Date.now() - (this.recordStartedAt || Date.now()))
    this.recordStartedAt = 0
    if (!res.tempFilePath) {
      this.setData({
        recording: false,
        transcribeStatus: '没有保存到有效录音，请重新按住说话。',
        error: '录音保存失败，请重试'
      })
      return
    }
    if (durationMs < MIN_RECORD_DURATION_MS) {
      this.setData({
        audioTempPath: '',
        uploadedAudioUrl: '',
        audioDurationSec: 0,
        recording: false,
        transcribeStatus: '这段留声太短了，请按住多说一会儿。',
        error: '录音时间太短'
      })
      return
    }
    const canShareAudio = VISIBILITIES[this.data.visibilityIndex] !== 'self'
    this.setData({
      audioTempPath: res.tempFilePath,
      audioDurationSec: Math.max(1, Math.round(durationMs / 1000)),
      recording: false,
      uploadedAudioUrl: '',
      allowOriginalAudioPlay: canShareAudio,
      transcribeStatus: '原声已保存，正在上传并转成文字...',
      error: ''
    })
    this.uploadAndTranscribeAudio(res.tempFilePath)
  },
  async uploadAndTranscribeAudio(filePath) {
    if (!filePath) {
      return
    }
    this.setData({
      transcribing: true,
      transcribeStatus: '正在上传这段留声...',
      error: ''
    })
    let uploaded
    try {
      uploaded = await uploadService.uploadAudio(filePath)
    } catch (error) {
      if (handleFamilyAccessError(error, this.data.familyId)) {
        return
      }
      this.setData({
        transcribeStatus: '原声已保留在本机，上传暂时失败。保存时会再试一次，也可以稍后重新录。',
        error: error.message || '录音上传失败，请检查网络后重试'
      })
      return
    } finally {
      if (!uploaded) {
        this.setData({ transcribing: false })
      }
    }

    this.setData({
      uploadedAudioUrl: uploaded.url,
      transcribeStatus: '正在把留声转成文字...'
    })
    try {
      const result = await aiService.transcribeAudio({
        familyId: this.data.familyId,
        audioUrl: uploaded.url
      })
      const text = String(result.text || '').trim()
      this.setData({
        originalText: text || this.data.originalText,
        optimizedText: '',
        emotionTags: [],
        coreNeed: '',
        aiAdvice: '',
        riskLevel: 'low',
        attackWarning: '',
        inputMode: 'text',
        transcribeStatus: text
          ? '语音已转成文字，可以直接修改错漏；原声也会保留。'
          : '原声已保存，但没有识别到文字。可以手动补充后继续保存。'
      })
    } catch (error) {
      if (handleFamilyAccessError(error, this.data.familyId)) {
        return
      }
      this.setData({
        transcribeStatus: '原声已保存，转文字暂时失败。可以切回文字，手动补充后继续保存。',
        error: error.message || '语音转文字失败，请先手动输入文字'
      })
    } finally {
      this.setData({ transcribing: false })
    }
  },
  playAudio() {
    const audio = this.audio
    if (!audio || !this.data.audioTempPath || this.data.recording) {
      return
    }
    audio.stop()
    audio.src = this.data.audioTempPath
    this.setData({ playingAudio: true, error: '' })
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
  effectiveReceiverSlotKeys() {
    const visibility = VISIBILITIES[this.data.visibilityIndex] || 'private'
    if (visibility !== 'private') {
      return []
    }
    return this.data.selectedReceiverSlotKeys
  },
  async optimize() {
    if (this.data.aiLoading || this.data.loading || this.data.recording || this.data.playingAudio) {
      return
    }
    const visibility = VISIBILITIES[this.data.visibilityIndex] || 'private'
    const receiverIds = this.effectiveReceiverIds()
    const receiverSlotKeys = this.effectiveReceiverSlotKeys()
    if (visibility === 'private' && !receiverIds.length && !receiverSlotKeys.length) {
      wx.showToast({ title: '请先选择接收家人', icon: 'none' })
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
        visibility,
        receiverIds,
        receiverSlotKeys,
        originalText: this.data.originalText,
        hasOriginalAudio: Boolean(this.data.audioTempPath),
        messageType: MESSAGE_TYPES[this.data.messageTypeIndex],
        previewModel: PREVIEW_MODELS[this.data.previewModelIndex] || 'standard',
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
      if (handleFamilyAccessError(error, this.data.familyId)) {
        return
      }
      this.setData({ error: error.message || 'AI 整理失败' })
    } finally {
      this.clearAiStatus()
      this.setData({ aiLoading: false })
    }
  },
  async optimizeForSubmit() {
    await this.optimize()
    if (!this.data.optimizedText.trim()) {
      throw new Error(this.data.error || 'AI 整理失败')
    }
  },
  async ensureOptimizedBeforeSubmit(visibility, receiverIds, receiverSlotKeys, originalText) {
    const hasManualOptimized = Boolean(this.data.optimizedText.trim())
    if (!originalText || hasManualOptimized) {
      return true
    }

    try {
      await this.optimizeForSubmit()
      return Boolean(this.data.optimizedText.trim())
    } catch (error) {
      const reason = error && error.message ? `失败原因：${error.message}` : 'AI 暂时没有整理成功。'
      const shouldSendRaw = await new Promise((resolve) => {
        wx.showModal({
          title: 'AI 整理暂时失败',
          content: `${reason}\n\n录音和原文已保留。你可以稍后重试，或先按当前文字保存。`,
          confirmText: '按原文发送',
          cancelText: '先不发送',
          confirmColor: '#df7d62',
          success: (res) => resolve(Boolean(res.confirm)),
          fail: () => resolve(false)
        })
      })
      if (shouldSendRaw) {
        this.setData({
          optimizedText: this.data.optimizedText.trim() || originalText,
          emotionTags: [],
          coreNeed: '',
          aiAdvice: '',
          riskLevel: 'low',
          attackWarning: ''
        })
        return true
      }
      return false
    }
  },
  async submit() {
    if (this.data.loading || this.data.aiLoading || this.data.recording || this.data.playingAudio || this.data.transcribing) {
      return
    }
    const visibility = VISIBILITIES[this.data.visibilityIndex] || 'private'
    const receiverIds = this.effectiveReceiverIds()
    const receiverSlotKeys = this.effectiveReceiverSlotKeys()
    const originalText = this.data.originalText.trim()
    if (visibility === 'private' && !receiverIds.length && !receiverSlotKeys.length) {
      wx.showToast({ title: '请选择接收家人', icon: 'none' })
      return
    }
    if (!originalText && !this.data.audioTempPath) {
      wx.showToast({ title: '请先打字或录音', icon: 'none' })
      return
    }
    const canContinue = await this.ensureOptimizedBeforeSubmit(visibility, receiverIds, receiverSlotKeys, originalText)
    if (!canContinue) {
      return
    }
    const optimizedText = this.data.optimizedText.trim() || originalText
    if (!optimizedText) {
      wx.showToast({ title: '请先补充一段发送前表达', icon: 'none' })
      return
    }
    this.setData({ loading: true, error: '' })
    try {
      let uploadedAudio = null
      if (this.data.audioTempPath) {
        uploadedAudio = this.data.uploadedAudioUrl
          ? { url: this.data.uploadedAudioUrl }
          : await uploadService.uploadAudio(this.data.audioTempPath)
      }
      await messageService.createMessage(this.data.familyId, {
        receiverIds,
        receiverSlotKeys,
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
        allowOriginalAudioPlay: Boolean(this.data.audioTempPath) && this.data.allowOriginalAudioPlay
      })
      wx.showToast({ title: '已发送', icon: 'success' })
      setTimeout(() => wx.navigateBack(), 500)
    } catch (error) {
      if (handleFamilyAccessError(error, this.data.familyId)) {
        return
      }
      this.setData({ error: error.message || '发送失败' })
    } finally {
      this.setData({ loading: false })
    }
  }
})
