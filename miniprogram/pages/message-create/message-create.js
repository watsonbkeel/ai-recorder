const messageService = require('../../services/message')
const uploadService = require('../../services/upload')
const aiService = require('../../services/ai')

const recorder = wx.getRecorderManager ? wx.getRecorderManager() : null
const audio = wx.createInnerAudioContext ? wx.createInnerAudioContext() : null
const MESSAGE_TYPES = ['thanks', 'apology', 'grievance', 'request', 'explain', 'stress', 'repair', 'encouragement', 'general']
const MESSAGE_TYPE_LABELS = ['感谢', '道歉', '委屈', '请求', '解释', '压力', '修复关系', '鼓励', '普通心声']

Page({
  data: {
    familyId: null,
    receiverText: '',
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
    aiLoading: false,
    loading: false,
    error: ''
  },
  onLoad(options) {
    this.setData({ familyId: Number(options.familyId) })
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
  handleReceiverInput(event) {
    this.setData({ receiverText: event.detail.value })
  },
  handleTypeChange(event) {
    this.setData({ messageTypeIndex: Number(event.detail.value) })
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
  async optimize() {
    if (!this.data.originalText.trim() && !this.data.audioTempPath) {
      wx.showToast({ title: '请先写下心声或录音', icon: 'none' })
      return
    }
    this.setData({ aiLoading: true, error: '' })
    try {
      const result = await aiService.optimizeMessage({
        originalText: this.data.originalText,
        hasOriginalAudio: Boolean(this.data.audioTempPath),
        messageType: MESSAGE_TYPES[this.data.messageTypeIndex]
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
  parseReceiverIds() {
    return this.data.receiverText.split(',').map((item) => Number(item.trim())).filter((id) => Number.isInteger(id) && id > 0)
  },
  async submit() {
    const receiverIds = this.parseReceiverIds()
    if (!receiverIds.length) {
      wx.showToast({ title: '请输入接收人用户ID', icon: 'none' })
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
        visibility: 'private',
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
