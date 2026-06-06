const messageService = require('../../services/message')
const replyService = require('../../services/reply')
const aiService = require('../../services/ai')
const format = require('../../utils/format')
const { PUBLIC_BASE_URL } = require('../../utils/config')

const audio = wx.createInnerAudioContext ? wx.createInnerAudioContext() : null

function fullUrl(url) {
  if (!url) {
    return ''
  }
  if (/^https?:\/\//.test(url)) {
    return url
  }
  return `${PUBLIC_BASE_URL.replace(/\/$/, '')}${url}`
}

function prepareMessage(message) {
  return {
    ...message,
    originalAudioUrl: fullUrl(message.originalAudioUrl),
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
    loading: true,
    aiLoading: false,
    submitting: false,
    error: ''
  },
  onLoad(options) {
    this.setData({ messageId: Number(options.messageId) })
    this.loadData()
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
  playOriginalAudio() {
    if (!audio || !this.data.message || !this.data.message.originalAudioUrl) {
      return
    }
    audio.src = this.data.message.originalAudioUrl
    audio.play()
  },
  handleReplyInput(event) {
    this.setData({ replyOriginalText: event.detail.value })
  },
  handleReplyOptimizedInput(event) {
    this.setData({ replyOptimizedText: event.detail.value })
  },
  async optimizeReply() {
    if (!this.data.replyOriginalText.trim()) {
      wx.showToast({ title: '请先写下回复', icon: 'none' })
      return
    }
    this.setData({ aiLoading: true, error: '' })
    try {
      const result = await aiService.optimizeReply({
        originalText: this.data.replyOriginalText,
        message: this.data.message ? this.data.message.optimizedText : ''
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
      this.setData({ aiLoading: false })
    }
  },
  async submitReply() {
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
  }
})
