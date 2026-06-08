const messageService = require('../../services/message')
const replyService = require('../../services/reply')
const uploadService = require('../../services/upload')
const aiService = require('../../services/ai')
const adminService = require('../../services/admin')
const format = require('../../utils/format')
const { identitySummary } = require('../../utils/familyIdentity')
const { handleFamilyAccessError } = require('../../utils/familyAccess')

const recorder = wx.getRecorderManager ? wx.getRecorderManager() : null

const VISIBILITY_TEXT = {
  private: '指定家人',
  family: '全家可见',
  self: '仅自己'
}
const PREVIEW_MODELS = ['standard', 'advanced']
const PREVIEW_MODEL_LABELS = ['普通模型', '高级模型']

const ANALYSIS_STATUS_STEPS = [
  'AI 正在理解这段心声...',
  '正在提炼情绪和真实需求...',
  '正在整理回应时需要避开的表达...',
  '快好了，正在生成更温和的回应方式...'
]
const REPLY_STATUS_STEPS = [
  'AI 正在理解你的回复原意...',
  '正在降低可能伤人的语气...',
  '正在保留你的关心、观点和边界...',
  '快好了，正在整理成更容易被家人接住的表达...'
]
const CONTENT_UNAVAILABLE_CODES = new Set(['CONTENT_NOT_VISIBLE', 'FORBIDDEN', 'NOT_FOUND'])
const MIN_RECORD_DURATION_MS = 800

function prepareMessage(message) {
  let visibilityText = VISIBILITY_TEXT[message.visibility] || '指定家人';

  // 优化：如果是私密留言，尝试提取接收者身份拼接上去
  if (message.visibility === 'private' && message.receivers && message.receivers.length > 0) {
    const names = message.receivers.map(r => {
       if (r.member && r.member.displayName) return r.member.displayName;
       if (r.user && r.user.nickname) return r.user.nickname;
       if (r.slot && r.slot.displayLabel) return r.slot.displayLabel;
       if (r.displayName) return r.displayName;
       return null;
    }).filter(Boolean);

    if (names.length > 0) {
      visibilityText = `指定家人: ${names.join(', ')}`;
    }
  }

  return {
    ...message,
    visibilityText,
    createdAtText: format.formatDate(message.createdAt),
    senderIdentitySummary: identitySummary(message.sender)
  }
}

function prepareReply(reply) {
  return {
    ...reply,
    createdAtText: format.formatDate(reply.createdAt),
    senderIdentitySummary: identitySummary(reply.sender)
  }
}

Page({
  data: {
    messageId: null,
    familyId: null,
    message: null,
    replies: [],

    // 回复输入及语音状态
    inputMode: 'text',
    recording: false,
    isCancelVoice: false,
    transcribing: false,
    replyTranscribeStatus: '',

    // 模型选择
    previewModelIndex: 0,
    previewModelLabels: PREVIEW_MODEL_LABELS,

    replyOriginalText: '',
    replyOptimizedText: '',
    replyEmotionTags: [],
    replyAdvice: '',
    replyRiskLevel: 'low',
    replyAttackWarning: '',

    analysis: null,
    useFamilyMemory: true,
    loading: true,
    analysisLoading: false,
    analysisStatusText: '',
    aiLoading: false,
    replyAiStatusText: '',
    submitting: false,
    playingOriginalAudio: false,
    handlingMessageAction: '',
    handlingReplyId: null,
    handlingReplyAction: '',
    error: ''
  },
  onLoad(options) {
    this.audio = wx.createInnerAudioContext ? wx.createInnerAudioContext() : null
    this.setData({
      messageId: Number(options.messageId),
      familyId: Number(options.familyId) || null
    })

    // 获取缓存的模型偏好
    const savedModelIndex = wx.getStorageSync('ai_preview_model_index')
    if (savedModelIndex !== '' && savedModelIndex !== null) {
      this.setData({ previewModelIndex: Number(savedModelIndex) })
    }

    if (this.audio) {
      this.audio.onEnded(() => {
        this.setData({ playingOriginalAudio: false })
      })
      this.audio.onError((err) => {
        console.error('Audio play error:', err);
        // 捕捉底层解码错误
        this.setData({ playingOriginalAudio: false, error: '原始语音解码失败，可能是格式兼容问题' })
      })
    }

    // 初始化录音组件
    if (recorder) {
      this.handleRecorderStop = (res) => this.handleRecordStop(res)
      this.handleRecorderError = () => {
        this.voicePressActive = false
        this.setData({
          recording: false,
          isCancelVoice: false,
          replyTranscribeStatus: '录音没有保存成功，请重试。'
        })
      }
      recorder.onStop(this.handleRecorderStop)
      recorder.onError(this.handleRecorderError)
    }

    this.loadData()
  },
  onUnload() {
    this.clearAnalysisStatus(false)
    this.clearReplyAiStatus(false)
    if (this.data.recording && recorder) recorder.stop();
    if (recorder && this.handleRecorderStop && recorder.offStop) recorder.offStop(this.handleRecorderStop)
    if (recorder && this.handleRecorderError && recorder.offError) recorder.offError(this.handleRecorderError)

    if (this.audio) {
      this.audio.stop()
      if (this.audio.destroy) this.audio.destroy()
      this.audio = null
    }
  },

  // ---------- 模型切换与音频修复 ----------
  handlePreviewModelChange(event) {
    const index = Number(event.detail.value)
    wx.setStorageSync('ai_preview_model_index', index)
    this.setData({ previewModelIndex: index })
  },

  async playOriginalAudio() {
    const audio = this.audio
    if (!audio || !this.data.message || !this.data.message.originalAudioUrl || this.data.playingOriginalAudio) {
      return
    }
    this.setData({ playingOriginalAudio: true, error: '' })
    try {
      // 修复方案1：尝试让 audio.src 直接指向远端 URL（若无强鉴权），微信会自动处理流式解码。
      // 如果你们的业务必须下载，downloadOriginalAudio 返回的最好是一个确切有后缀的路径 (如 wx.env.USER_DATA_PATH + '/temp.mp3')
      const tempFilePath = await messageService.downloadOriginalAudio(this.data.message.originalAudioUrl)
      audio.stop()
      audio.src = tempFilePath
      audio.play()
    } catch (error) {
      this.setData({ playingOriginalAudio: false })
      if (handleFamilyAccessError(error, this.fallbackFamilyId())) return;
      if (this.handleContentUnavailable(error, '原始语音已不可播放')) return;
      this.setData({ error: error.message || '原始语音播放网络失败' })
    }
  },

  // ---------- 录音交互逻辑 ----------
  toggleInputMode() {
    if (this.data.submitting || this.data.aiLoading || this.data.transcribing) return;
    if (this.data.recording) {
      this.stopRecord();
      return;
    }
    this.setData({
      inputMode: this.data.inputMode === 'voice' ? 'text' : 'voice',
      error: ''
    })
  },
  async startRecord() {
    if (this.data.recording || this.data.submitting || this.data.aiLoading) return;
    if (!recorder) return wx.showToast({ title: '当前环境不支持录音', icon: 'none' });

    // 假设已在 utils 或其他地方有了权限校验，为保持精简，直接调用
    this.recordStartedAt = Date.now()
    this.setData({
      recording: true,
      isCancelVoice: false,
      replyTranscribeStatus: '正在录音，松手保存，上滑取消。',
      error: ''
    })
    try {
      recorder.start({ duration: 120000, format: 'mp3' })
    } catch (error) {
      this.setData({ recording: false, replyTranscribeStatus: '录音启动失败' })
    }
  },
  stopRecord() {
    if (recorder && this.data.recording) recorder.stop();
  },
  handleVoiceTouchStart(e) {
    if (this.data.inputMode !== 'voice' || this.data.transcribing) return;
    if (wx.vibrateShort) wx.vibrateShort({ type: 'medium' });
    this.voicePressActive = true
    this.startY = e.touches[0].clientY
    this.startRecord()
  },
  handleVoiceTouchMove(e) {
    if (!this.voicePressActive || !this.data.recording) return;
    const currentY = e.touches[0].clientY
    const isCancelVoice = (this.startY - currentY > 50)
    if (isCancelVoice !== this.data.isCancelVoice) {
      this.setData({ isCancelVoice })
    }
  },
  handleVoiceTouchEnd() {
    if (this.data.inputMode !== 'voice') return;
    this.voicePressActive = false
    if (this.data.recording) {
      if (this.data.isCancelVoice) {
        this._cancelNextRecord = true
        this.setData({ replyTranscribeStatus: '已取消本次录音。' })
      } else {
        this.setData({ replyTranscribeStatus: '正在保存这段留声...' })
      }
      this.stopRecord()
    }
  },
  handleVoiceTouchCancel() {
    this.voicePressActive = false
    if (this.data.recording) {
      this._cancelNextRecord = true
      this.setData({ replyTranscribeStatus: '录音被打断，已取消。' })
      this.stopRecord()
    }
  },
  handleRecordStop(res) {
    this.voicePressActive = false
    if (this._cancelNextRecord) {
      this._cancelNextRecord = false
      this.setData({ recording: false, isCancelVoice: false })
      return
    }
    const durationMs = Number(res.duration || 0) || Math.max(0, Date.now() - (this.recordStartedAt || Date.now()))
    this.recordStartedAt = 0

    if (!res.tempFilePath || durationMs < MIN_RECORD_DURATION_MS) {
      this.setData({
        recording: false,
        isCancelVoice: false,
        replyTranscribeStatus: durationMs < MIN_RECORD_DURATION_MS ? '留声太短了' : '录音保存失败',
      })
      return
    }

    this.setData({
      recording: false,
      isCancelVoice: false,
      replyTranscribeStatus: '原声已保存，正在转成文字...',
    })
    this.uploadAndTranscribeReplyAudio(res.tempFilePath)
  },
  async uploadAndTranscribeReplyAudio(filePath) {
    this.setData({ transcribing: true })
    try {
      const uploaded = await uploadService.uploadAudio(filePath)
      const result = await aiService.transcribeAudio({
        familyId: this.data.message.familyId,
        audioUrl: uploaded.url
      })
      const text = String(result.text || '').trim()
      this.setData({
        replyOriginalText: text || this.data.replyOriginalText,
        inputMode: 'text',
        replyTranscribeStatus: text ? '已转成文字，可补充修改。' : '未识别到文字，请手动输入。'
      })
    } catch (error) {
      this.setData({ replyTranscribeStatus: '转文字暂时失败，可手动输入。' })
    } finally {
      this.setData({ transcribing: false })
    }
  },

  // ---------- 页面基础与AI逻辑 ----------
  startAnalysisStatus() {
    this.clearAnalysisStatus(false)
    let index = 0
    this.setData({ analysisStatusText: ANALYSIS_STATUS_STEPS[index] })
    this.analysisStatusTimer = setInterval(() => {
      if (index >= ANALYSIS_STATUS_STEPS.length - 1) {
        clearInterval(this.analysisStatusTimer)
        return
      }
      index++
      this.setData({ analysisStatusText: ANALYSIS_STATUS_STEPS[index] })
    }, 4500)
  },
  clearAnalysisStatus(reset = true) {
    if (this.analysisStatusTimer) {
      clearInterval(this.analysisStatusTimer)
      this.analysisStatusTimer = null
    }
    if (reset) this.setData({ analysisStatusText: '' })
  },
  startReplyAiStatus() {
    this.clearReplyAiStatus(false)
    let index = 0
    this.setData({ replyAiStatusText: REPLY_STATUS_STEPS[index] })
    this.replyAiStatusTimer = setInterval(() => {
      if (index >= REPLY_STATUS_STEPS.length - 1) {
        clearInterval(this.replyAiStatusTimer)
        return
      }
      index++
      this.setData({ replyAiStatusText: REPLY_STATUS_STEPS[index] })
    }, 4500)
  },
  clearReplyAiStatus(reset = true) {
    if (this.replyAiStatusTimer) {
      clearInterval(this.replyAiStatusTimer)
      this.replyAiStatusTimer = null
    }
    if (reset) this.setData({ replyAiStatusText: '' })
  },
  navigateBackOrList(familyId) {
    const pages = getCurrentPages()
    if (pages.length > 1) {
      wx.navigateBack()
      return
    }
    if (familyId) {
      wx.redirectTo({ url: `/pages/message-list/message-list?familyId=${familyId}` })
      return
    }
    wx.redirectTo({ url: '/pages/family-select/family-select' })
  },
  fallbackFamilyId() {
    return (this.data.message && this.data.message.familyId) || this.data.familyId
  },
  handleContentUnavailable(error, fallbackMessage) {
    if (!error || !CONTENT_UNAVAILABLE_CODES.has(error.code)) return false;
    wx.showToast({ title: fallbackMessage || '这条留言已不可见', icon: 'none' })
    setTimeout(() => this.navigateBackOrList(this.fallbackFamilyId()), 500)
    return true
  },
  async loadData() {
    this.setData({ loading: true, error: '' })
    try {
      const [message, replies] = await Promise.all([
        messageService.getMessageDetail(this.data.messageId),
        replyService.getReplies(this.data.messageId)
      ])
      this.setData({
        message: prepareMessage(message),
        replies: replies.map(prepareReply)
      })
    } catch (error) {
      if (handleFamilyAccessError(error, this.fallbackFamilyId())) return;
      if (this.handleContentUnavailable(error, '这条留言已不可见')) return;
      this.setData({ error: error.message || '加载失败' })
    } finally {
      this.setData({ loading: false })
    }
  },

  handleReplyInput(event) {
    this.setData({ replyOriginalText: event.detail.value })
  },
  handleReplyOptimizedInput(event) {
    this.setData({ replyOptimizedText: event.detail.value })
  },
  handleMemorySwitch(event) {
    this.setData({ useFamilyMemory: event.detail.value })
  },
  async analyzeMessage() {
    if (this.data.analysisLoading) return;
    this.setData({ analysisLoading: true, error: '' })
    this.startAnalysisStatus()
    try {
      const analysis = await aiService.analyzeMessage({
        messageId: this.data.messageId,
        useFamilyMemory: this.data.useFamilyMemory
      })
      this.setData({ analysis })
    } catch (error) {
      if (handleFamilyAccessError(error, this.fallbackFamilyId())) return;
      if (this.handleContentUnavailable(error, '这条留言已不可分析')) return;
      this.setData({ error: error.message || 'AI 理解失败' })
    } finally {
      this.clearAnalysisStatus()
      this.setData({ analysisLoading: false })
    }
  },
  async optimizeReply() {
    if (this.data.aiLoading) return;
    if (!this.data.replyOriginalText.trim()) {
      wx.showToast({ title: '请先写下回复', icon: 'none' })
      return
    }
    this.setData({ aiLoading: true, error: '' })
    this.startReplyAiStatus()
    try {
      const result = await aiService.optimizeReply({
        originalText: this.data.replyOriginalText,
        messageId: this.data.messageId,
        previewModel: PREVIEW_MODELS[this.data.previewModelIndex] || 'standard',
        useFamilyMemory: this.data.useFamilyMemory
      })
      this.setData({
        replyOptimizedText: result.optimizedText || this.data.replyOriginalText,
        replyEmotionTags: result.emotionTags || [],
        replyAdvice: result.communicationAdvice || '',
        replyRiskLevel: result.riskLevel || 'low',
        replyAttackWarning: result.attackWarning || ''
      })
    } catch (error) {
      if (handleFamilyAccessError(error, this.fallbackFamilyId())) return;
      if (this.handleContentUnavailable(error, '这条留言已不可回复')) return;

      wx.showModal({
        title: '整理暂时不可用',
        content: '你可以直接对原话进行预览和修改。',
        confirmText: '使用原话',
        confirmColor: '#df7d62',
        success: (res) => {
          if (res.confirm) {
            this.setData({
              replyOptimizedText: this.data.replyOriginalText,
              replyRiskLevel: 'low'
            })
          }
        }
      })
    } finally {
      this.clearReplyAiStatus()
      this.setData({ aiLoading: false })
    }
  },
  async submitReply() {
    if (this.data.submitting || this._isSubmitting) return;
    if (!this.data.replyOptimizedText.trim() && !this.data.replyOriginalText.trim()) {
      wx.showToast({ title: '内容不能为空', icon: 'none' })
      return
    }

    this._isSubmitting = true;
    this.setData({ submitting: true, error: '' })
    try {
      await replyService.createReply(this.data.messageId, {
        originalText: this.data.replyOriginalText,
        optimizedText: this.data.replyOptimizedText || this.data.replyOriginalText,
        emotionTags: this.data.replyEmotionTags,
        aiAdvice: this.data.replyAdvice,
        riskLevel: this.data.replyRiskLevel,
        attackWarning: this.data.replyAttackWarning
      })
      this.setData({
        replyOriginalText: '',
        replyOptimizedText: '',
        replyEmotionTags: [],
        replyAdvice: '',
        replyRiskLevel: 'low',
        replyAttackWarning: ''
      })
      wx.showToast({ title: '已回复', icon: 'success' })
      this.loadData()
    } catch (error) {
      if (handleFamilyAccessError(error, this.fallbackFamilyId())) return;
      if (this.handleContentUnavailable(error, '这条留言已不可回复')) return;
      this.setData({ error: error.message || '回复失败' })
    } finally {
      this._isSubmitting = false;
      this.setData({ submitting: false })
    }
  },

  // (后续的 delete/hide 代码与原本逻辑一致，为了完整性依然保留)
  deleteMessage() {
    if (!this.data.message || !this.data.message.canDelete || this.data.handlingMessageAction) return;
    wx.showModal({
      title: '删除留言',
      content: '删除后这条留言将不可见，相关家庭沟通记忆会失效并等待重新整理。',
      confirmColor: '#c75f52',
      success: async (res) => {
        if (!res.confirm) return;
        this.setData({ loading: true, handlingMessageAction: 'delete', error: '' })
        try {
          await messageService.deleteMessage(this.data.messageId)
          wx.showToast({ title: '已删除', icon: 'success' })
          const pages = getCurrentPages()
          if (pages.length > 1) wx.navigateBack()
          else wx.redirectTo({ url: `/pages/message-list/message-list?familyId=${this.data.message.familyId}` })
        } catch (error) {
          if (handleFamilyAccessError(error, this.fallbackFamilyId())) return;
          if (this.handleContentUnavailable(error, '这条留言已不可删除')) return;
          this.setData({ error: error.message || '删除失败', loading: false, handlingMessageAction: '' })
        }
      }
    })
  },
  hideMessage() {
    if (!this.data.message || !this.data.message.canHide || this.data.handlingMessageAction) return;
    wx.showModal({
      title: '隐藏留言',
      content: '隐藏后这条留言将不再展示给家庭成员，相关家庭沟通记忆会失效并等待重新整理。',
      confirmColor: '#c75f52',
      success: async (res) => {
        if (!res.confirm) return;
        this.setData({ loading: true, handlingMessageAction: 'hide', error: '' })
        try {
          await adminService.hideMessage(this.data.messageId, { reason: '管理员隐藏留言' })
          wx.showToast({ title: '已隐藏', icon: 'success' })
          const pages = getCurrentPages()
          if (pages.length > 1) wx.navigateBack()
          else wx.redirectTo({ url: `/pages/message-list/message-list?familyId=${this.data.message.familyId}` })
        } catch (error) {
          if (handleFamilyAccessError(error, this.fallbackFamilyId())) return;
          if (this.handleContentUnavailable(error, '这条留言已不可隐藏')) return;
          this.setData({ error: error.message || '隐藏失败', loading: false, handlingMessageAction: '' })
        }
      }
    })
  },
  deleteReply(event) {
    const replyId = Number(event.currentTarget.dataset.id)
    if (!replyId || this.data.handlingReplyId) return;
    wx.showModal({
      title: '删除回复',
      content: '删除后这条回复将不可见，相关家庭沟通记忆会失效并等待重新整理。',
      confirmColor: '#c75f52',
      success: async (res) => {
        if (!res.confirm) return;
        this.setData({ handlingReplyId: replyId, handlingReplyAction: 'delete', error: '' })
        try {
          await replyService.deleteReply(replyId)
          wx.showToast({ title: '已删除', icon: 'success' })
          this.loadData()
        } catch (error) {
          if (handleFamilyAccessError(error, this.fallbackFamilyId())) return;
          if (this.handleContentUnavailable(error, '这条回复已不可删除')) return;
          this.setData({ error: error.message || '删除失败' })
        } finally {
          this.setData({ handlingReplyId: null, handlingReplyAction: '' })
        }
      }
    })
  },
  hideReply(event) {
    const replyId = Number(event.currentTarget.dataset.id)
    if (!replyId || this.data.handlingReplyId) return;
    wx.showModal({
      title: '隐藏回复',
      content: '隐藏后这条回复将不再展示给家庭成员，相关家庭沟通记忆会失效并等待重新整理。',
      confirmColor: '#c75f52',
      success: async (res) => {
        if (!res.confirm) return;
        this.setData({ handlingReplyId: replyId, handlingReplyAction: 'hide', error: '' })
        try {
          await adminService.hideReply(replyId, { reason: '管理员隐藏回复' })
          wx.showToast({ title: '已隐藏', icon: 'success' })
          this.loadData()
        } catch (error) {
          if (handleFamilyAccessError(error, this.fallbackFamilyId())) return;
          if (this.handleContentUnavailable(error, '这条回复已不可隐藏')) return;
          this.setData({ error: error.message || '隐藏失败' })
        } finally {
          this.setData({ handlingReplyId: null, handlingReplyAction: '' })
        }
      }
    })
  }
})
