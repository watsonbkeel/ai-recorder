const diaryService = require('../../services/diary')
const uploadService = require('../../services/upload')

const MAX_IMAGE_SIZE = 5 * 1024 * 1024

function isHeicImage(filePath) {
  return /\.(heic|heif)$/i.test(String(filePath || '').split('?')[0])
}

Page({
  data: {
    classId: null,
    content: '',
    isAnonymous: false,
    localImages: [],
    loading: false,
    uploadingText: '',
    error: ''
  },
  onLoad(options) {
    this.setData({ classId: Number(options.classId) })
  },
  handleContentInput(event) {
    this.setData({ content: event.detail.value })
  },
  handleAnonymousChange(event) {
    this.setData({ isAnonymous: event.detail.value })
  },
  chooseImages() {
    if (this.data.loading) {
      return
    }

    wx.chooseMedia({
      count: 9 - this.data.localImages.length,
      mediaType: ['image'],
      sizeType: ['compressed'],
      success: (res) => {
        const rejected = res.tempFiles.find((item) => isHeicImage(item.tempFilePath))
        if (rejected) {
          const message = '暂不支持 HEIC/HEIF 图片，请选择 JPG、PNG 或 WEBP 图片'
          this.setData({ error: message })
          wx.showToast({ title: '暂不支持 HEIC 图片', icon: 'none' })
          return
        }

        const paths = res.tempFiles.map((item) => item.tempFilePath)
        this.setData({
          localImages: this.data.localImages.concat(paths).slice(0, 9),
          error: ''
        })
      }
    })
  },
  getFileSize(filePath) {
    return new Promise((resolve) => {
      wx.getFileInfo({
        filePath,
        success: (res) => resolve(res.size || 0),
        fail: () => resolve(0)
      })
    })
  },
  removeImage(event) {
    if (this.data.loading) {
      return
    }

    const index = event.currentTarget.dataset.index
    const localImages = this.data.localImages.slice()
    localImages.splice(index, 1)
    this.setData({ localImages })
  },
  previewLocalImage(event) {
    const current = event.currentTarget.dataset.current
    if (!current || !this.data.localImages.length) {
      return
    }
    wx.previewImage({ current, urls: this.data.localImages })
  },
  compressImage(filePath) {
    return new Promise((resolve) => {
      if (!wx.compressImage) {
        resolve(filePath)
        return
      }

      wx.compressImage({
        src: filePath,
        quality: 70,
        success: (res) => resolve(res.tempFilePath || filePath),
        fail: () => resolve(filePath)
      })
    })
  },
  async uploadWithRetry(filePath) {
    try {
      return await uploadService.uploadImage(filePath)
    } catch (error) {
      if (error.message === 'UNAUTHORIZED') {
        throw error
      }
      return uploadService.uploadImage(filePath)
    }
  },
  async submitDiary() {
    if (this.data.loading) {
      return
    }

    if (!this.data.content.trim()) {
      wx.showToast({ title: '请输入日记内容', icon: 'none' })
      return
    }

    this.setData({ loading: true, error: '', uploadingText: '准备上传...' })
    try {
      const imageUrls = []
      const localImages = this.data.localImages.slice()
      for (let index = 0; index < localImages.length; index += 1) {
        this.setData({ uploadingText: `正在处理第 ${index + 1}/${localImages.length} 张图片...` })
        const compressedPath = await this.compressImage(localImages[index])
        const fileSize = await this.getFileSize(compressedPath)
        if (fileSize > MAX_IMAGE_SIZE) {
          throw new Error(`第 ${index + 1} 张图片超过 5MB，请压缩或换一张图片`)
        }
        this.setData({ uploadingText: `正在上传第 ${index + 1}/${localImages.length} 张图片...` })
        const uploaded = await this.uploadWithRetry(compressedPath)
        imageUrls.push(uploaded.url)
      }
      this.setData({ uploadingText: '正在发布日记...' })
      await diaryService.createDiary(this.data.classId, {
        content: this.data.content,
        isAnonymous: this.data.isAnonymous,
        imageUrls
      })
      wx.showToast({ title: '发布成功', icon: 'success' })
      setTimeout(() => {
        wx.navigateBack()
      }, 500)
    } catch (error) {
      const message = error.message || '发布失败，请稍后重试'
      this.setData({ error: message })
      wx.showToast({ title: message, icon: 'none' })
    } finally {
      this.setData({ loading: false, uploadingText: '' })
    }
  }
})
