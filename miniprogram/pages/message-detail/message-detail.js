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
    analysis: null,
    useFamilyMemory: true,
    loading: true,
    analysisLoading: false,
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
  handleMemorySwitch(event) {
    this.setData({ useFamilyMemory: event.detail.value })
  },
  async analyzeMessage() {
    this.setData({ analysisLoading: true, error: '' })
    try {
      const analysis = await aiService.analyzeMessage({
        messageId: this.data.messageId,
        useFamilyMemory: this.data.useFamilyMemory
      })
      this.setData({ analysis })
    } catch (error) {
      this.setData({ error: error.message || 'AI 理解失败' })
    } finally {
      this.setData({ analysisLoading: false })
    }
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
  },
  deleteMessage() {
    if (!this.data.message || !this.data.message.canDelete) {
      return
    }
    wx.showModal({
      title: '删除留言',
      content: '删除后这条留言将不可见，相关家庭沟通记忆会失效并等待重新整理。',
      confirmColor: '#ef4444',
      success: async (res) => {
        if (!res.confirm) {
          return
        }
        this.setData({ loading: true, error: '' })
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
          this.setData({ error: error.message || '删除失败', loading: false })
        }
      }
    })
  },
  deleteReply(event) {
    const replyId = Number(event.currentTarget.dataset.id)
    if (!replyId) {
      return
    }
    wx.showModal({
      title: '删除回复',
      content: '删除后这条回复将不可见，相关家庭沟通记忆会失效并等待重新整理。',
      confirmColor: '#ef4444',
      success: async (res) => {
        if (!res.confirm) {
          return
        }
        this.setData({ error: '' })
        try {
          await replyService.deleteReply(replyId)
          wx.showToast({ title: '已删除', icon: 'success' })
          this.loadData()
        } catch (error) {
          this.setData({ error: error.message || '删除失败' })
        }
      }
    })
  }
})
