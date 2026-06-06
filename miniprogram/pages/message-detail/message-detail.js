const messageService = require('../../services/message')
const replyService = require('../../services/reply')
const aiService = require('../../services/ai')
const adminService = require('../../services/admin')
const format = require('../../utils/format')

const VISIBILITY_TEXT = {
  private: '指定家人',
  family: '全家可见',
  self: '仅自己'
}
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

function prepareMessage(message) {
  return {
    ...message,
    visibilityText: VISIBILITY_TEXT[message.visibility] || '指定家人',
    createdAtText: format.formatDate(message.createdAt)
  }
}

function prepareReply(reply) {
  return {
    ...reply,
    createdAtText: format.formatDate(reply.createdAt)
  }
}

Page({
  data: {
    messageId: null,
    message: null,
    replies: [],
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
    this.setData({ messageId: Number(options.messageId) })
    if (this.audio) {
      this.audio.onEnded(() => {
        this.setData({ playingOriginalAudio: false })
      })
      this.audio.onError(() => {
        this.setData({ playingOriginalAudio: false, error: '原始语音播放失败，请稍后重试' })
      })
    }
    this.loadData()
  },
  onUnload() {
    this.clearAnalysisStatus(false)
    this.clearReplyAiStatus(false)
    if (this.audio) {
      this.audio.stop()
      if (this.audio.destroy) {
        this.audio.destroy()
      }
      this.audio = null
    }
    this.setData({ playingOriginalAudio: false })
  },
  startAnalysisStatus() {
    this.clearAnalysisStatus(false)
    let index = 0
    this.setData({ analysisStatusText: ANALYSIS_STATUS_STEPS[index] })
    this.analysisStatusTimer = setInterval(() => {
      index = Math.min(index + 1, ANALYSIS_STATUS_STEPS.length - 1)
      this.setData({ analysisStatusText: ANALYSIS_STATUS_STEPS[index] })
    }, 4500)
  },
  clearAnalysisStatus(reset = true) {
    if (this.analysisStatusTimer) {
      clearInterval(this.analysisStatusTimer)
      this.analysisStatusTimer = null
    }
    if (reset) {
      this.setData({ analysisStatusText: '' })
    }
  },
  startReplyAiStatus() {
    this.clearReplyAiStatus(false)
    let index = 0
    this.setData({ replyAiStatusText: REPLY_STATUS_STEPS[index] })
    this.replyAiStatusTimer = setInterval(() => {
      index = Math.min(index + 1, REPLY_STATUS_STEPS.length - 1)
      this.setData({ replyAiStatusText: REPLY_STATUS_STEPS[index] })
    }, 4500)
  },
  clearReplyAiStatus(reset = true) {
    if (this.replyAiStatusTimer) {
      clearInterval(this.replyAiStatusTimer)
      this.replyAiStatusTimer = null
    }
    if (reset) {
      this.setData({ replyAiStatusText: '' })
    }
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
      this.setData({ error: error.message || '加载失败' })
    } finally {
      this.setData({ loading: false })
    }
  },
  async playOriginalAudio() {
    const audio = this.audio
    if (!audio || !this.data.message || !this.data.message.originalAudioUrl || this.data.playingOriginalAudio) {
      return
    }
    this.setData({ playingOriginalAudio: true, error: '' })
    try {
      const tempFilePath = await messageService.downloadOriginalAudio(this.data.message.originalAudioUrl)
      audio.stop()
      audio.src = tempFilePath
      audio.play()
    } catch (error) {
      this.setData({ playingOriginalAudio: false, error: error.message || '原始语音播放失败' })
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
    if (this.data.analysisLoading) {
      return
    }
    this.setData({ analysisLoading: true, error: '' })
    this.startAnalysisStatus()
    try {
      const analysis = await aiService.analyzeMessage({
        messageId: this.data.messageId,
        useFamilyMemory: this.data.useFamilyMemory
      })
      this.setData({ analysis })
    } catch (error) {
      this.setData({ error: error.message || 'AI 理解失败' })
    } finally {
      this.clearAnalysisStatus()
      this.setData({ analysisLoading: false })
    }
  },
  async optimizeReply() {
    if (this.data.aiLoading) {
      return
    }
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
      this.setData({ error: error.message || 'AI 整理失败' })
    } finally {
      this.clearReplyAiStatus()
      this.setData({ aiLoading: false })
    }
  },
  async submitReply() {
    if (this.data.submitting) {
      return
    }
    if (!this.data.replyOriginalText.trim()) {
      wx.showToast({ title: '请先写下回复', icon: 'none' })
      return
    }
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
      this.setData({ replyOriginalText: '', replyOptimizedText: '' })
      wx.showToast({ title: '已回复', icon: 'success' })
      this.loadData()
    } catch (error) {
      this.setData({ error: error.message || '回复失败' })
    } finally {
      this.setData({ submitting: false })
    }
  },
  deleteMessage() {
    if (!this.data.message || !this.data.message.canDelete || this.data.handlingMessageAction) {
      return
    }
    wx.showModal({
      title: '删除留言',
      content: '删除后这条留言将不可见，相关家庭沟通记忆会失效并等待重新整理。',
      confirmColor: '#c75f52',
      success: async (res) => {
        if (!res.confirm) {
          return
        }
        this.setData({ loading: true, handlingMessageAction: 'delete', error: '' })
        try {
          await messageService.deleteMessage(this.data.messageId)
          wx.showToast({ title: '已删除', icon: 'success' })
          const pages = getCurrentPages()
          if (pages.length > 1) {
            wx.navigateBack()
          } else {
            wx.redirectTo({ url: `/pages/message-list/message-list?familyId=${this.data.message.familyId}` })
          }
        } catch (error) {
          this.setData({ error: error.message || '删除失败', loading: false, handlingMessageAction: '' })
        }
      }
    })
  },
  hideMessage() {
    if (!this.data.message || !this.data.message.canHide || this.data.handlingMessageAction) {
      return
    }
    wx.showModal({
      title: '隐藏留言',
      content: '隐藏后这条留言将不再展示给家庭成员，相关家庭沟通记忆会失效并等待重新整理。',
      confirmColor: '#c75f52',
      success: async (res) => {
        if (!res.confirm) {
          return
        }
        this.setData({ loading: true, handlingMessageAction: 'hide', error: '' })
        try {
          await adminService.hideMessage(this.data.messageId, { reason: '管理员隐藏留言' })
          wx.showToast({ title: '已隐藏', icon: 'success' })
          const pages = getCurrentPages()
          if (pages.length > 1) {
            wx.navigateBack()
          } else {
            wx.redirectTo({ url: `/pages/message-list/message-list?familyId=${this.data.message.familyId}` })
          }
        } catch (error) {
          this.setData({ error: error.message || '隐藏失败', loading: false, handlingMessageAction: '' })
        }
      }
    })
  },
  deleteReply(event) {
    const replyId = Number(event.currentTarget.dataset.id)
    if (!replyId || this.data.handlingReplyId) {
      return
    }
    wx.showModal({
      title: '删除回复',
      content: '删除后这条回复将不可见，相关家庭沟通记忆会失效并等待重新整理。',
      confirmColor: '#c75f52',
      success: async (res) => {
        if (!res.confirm) {
          return
        }
        this.setData({ handlingReplyId: replyId, handlingReplyAction: 'delete', error: '' })
        try {
          await replyService.deleteReply(replyId)
          wx.showToast({ title: '已删除', icon: 'success' })
          this.loadData()
        } catch (error) {
          this.setData({ error: error.message || '删除失败' })
        } finally {
          this.setData({ handlingReplyId: null, handlingReplyAction: '' })
        }
      }
    })
  },
  hideReply(event) {
    const replyId = Number(event.currentTarget.dataset.id)
    if (!replyId || this.data.handlingReplyId) {
      return
    }
    wx.showModal({
      title: '隐藏回复',
      content: '隐藏后这条回复将不再展示给家庭成员，相关家庭沟通记忆会失效并等待重新整理。',
      confirmColor: '#c75f52',
      success: async (res) => {
        if (!res.confirm) {
          return
        }
        this.setData({ handlingReplyId: replyId, handlingReplyAction: 'hide', error: '' })
        try {
          await adminService.hideReply(replyId, { reason: '管理员隐藏回复' })
          wx.showToast({ title: '已隐藏', icon: 'success' })
          this.loadData()
        } catch (error) {
          this.setData({ error: error.message || '隐藏失败' })
        } finally {
          this.setData({ handlingReplyId: null, handlingReplyAction: '' })
        }
      }
    })
  }
})
