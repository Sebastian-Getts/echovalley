// passage-retelling-questions.ts
// 第二节：显示旁白3+两道小题，播放旁白3，完毕后跳转到question-1
import { getTranslation } from '../../utils/i18n'
import {
  getQuestionDetail,
  getPresignedAudioUrl,
  ApiError
} from '../../utils/api'

Page({
  data: {
    questionId: 0,
    sessionId: 0,
    examId: 0,
    // 旁白3
    prefaceText: '',
    prefaceAudioUrl: '',
    // 问题
    questions: [] as Array<{ content: string; audio_url: string }>,
    // UI
    showContent: false,
    currentStepText: '',
    showPrefaceTimer: false,
    prefaceDuration: 5
  },

  innerAudioContext: null as any,

  onLoad(options: any) {
    const isLoggedIn = getEnvironmentStorage('isLoggedIn')
    if (!isLoggedIn) {
      wx.redirectTo({ url: '/pages/login/login' })
      return
    }

    const questionId = options.questionId ? parseInt(options.questionId, 10) : 0
    const sessionId = options.sessionId ? parseInt(options.sessionId, 10) : 0
    const examId = options.examId ? parseInt(options.examId, 10) : 0
    if (!questionId) {
      wx.showToast({ title: '题目ID无效', icon: 'none' })
      setTimeout(() => { wx.navigateBack() }, 1500)
      return
    }

    this.setData({ questionId, sessionId, examId })
    this.loadLanguage()
    this.loadQuestionDetail()
  },

  onUnload() {
    this.cleanupAudio()
  },

  loadLanguage() {
    const language = wx.getStorageSync('language') || 'en'
    getTranslation(language)
    wx.setNavigationBarTitle({
      title: language === 'zh' ? '短文复述及提问' : 'Passage Retelling'
    })
  },

  loadQuestionDetail() {
    wx.showLoading({ title: '加载中...', mask: true })

    getQuestionDetail(this.data.questionId)
      .then((question: any) => {
        console.log('[Passage Retelling Questions] Question detail:', question)

        // 获取旁白3
        const prefaceItems = question.preface_items || []
        const preface3 = prefaceItems[2] || {}
        // 旁白3格式为"第二节，提问。你希望了解更多信息..."
        // 用句号分割，去掉"第二节，提问"前缀，只保留正文
        let prefaceText = preface3.content || ''
        const parts = prefaceText.split('。')
        // 第一部分是"第二节，提问"，第二部分开始是正文
        prefaceText = parts.slice(1).join('。').trim()
        const prefaceAudioUrl = preface3.audio_url || ''
        const prefaceDuration = preface3.duration || 5

        // 获取两道小题
        let questions: Array<{ content: string; audio_url: string }> = []
        if (question.content_json && question.content_json.questions) {
          questions = question.content_json.questions
        }

        this.setData({
          prefaceText,
          prefaceAudioUrl,
          prefaceDuration,
          questions
        })

        wx.hideLoading()

        if (questions.length < 2) {
          wx.showModal({
            title: '提示',
            content: '题目数据不存在',
            showCancel: false,
            success: () => { wx.navigateBack() }
          })
          return
        }

        this.setData({ showContent: true })

        // 开始播放旁白
        this.startPreface()
      })
      .catch((error: any) => {
        console.error('[Passage Retelling Questions] Load error:', error)
        wx.hideLoading()
        const language = wx.getStorageSync('language') || 'en'
        let msg = language === 'zh' ? '加载失败' : 'Load failed'
        if (error instanceof ApiError) msg = error.message || msg
        wx.showToast({ title: msg, icon: 'none', duration: 2000 })
        setTimeout(() => { wx.navigateBack() }, 2000)
      })
  },

  // 播放旁白3
  startPreface() {
    const { prefaceAudioUrl, prefaceDuration } = this.data
    const language = wx.getStorageSync('language') || 'en'

    this.setData({
      currentStepText: language === 'zh' ? '题目说明' : 'Question Overview',
      showPrefaceTimer: true,
      prefaceDuration: Math.ceil(prefaceDuration)
    })

    setTimeout(() => {
      const timer = this.selectComponent('#prefaceTimer')
      if (timer) timer.startTimer()
    }, 100)

    if (!prefaceAudioUrl) {
      this.onPrefaceComplete()
      return
    }

    this.playAudio(prefaceAudioUrl, () => {
      this.onPrefaceComplete()
    })
  },

  onPrefaceComplete() {
    console.log('[Passage Retelling Questions] Preface complete, navigate to question 1')
    this.setData({ showPrefaceTimer: false })
    // 旁白播放完成，跳转到第一小题
    wx.redirectTo({
      url: `/pages/passage-retelling-question-1/passage-retelling-question-1?questionId=${this.data.questionId}&sessionId=${this.data.sessionId}&examId=${this.data.examId}`
    })
  },

  playAudio(audioUrl: string, onEnded?: () => void) {
    console.log('[Passage Retelling Questions] Playing audio:', audioUrl)
    this.cleanupAudio()
    wx.showLoading({ title: '加载音频...', mask: true })
    getPresignedAudioUrl(audioUrl)
      .then((response: any) => {
        console.log('[Passage Retelling Questions] Got presigned URL:', response.url)
        const innerAudioContext = wx.createInnerAudioContext()
        this.innerAudioContext = innerAudioContext
        innerAudioContext.src = response.url
        innerAudioContext.onCanplay(() => { wx.hideLoading() })
        innerAudioContext.onPlay(() => { console.log('[Passage Retelling Questions] Audio playing') })
        innerAudioContext.onEnded(() => {
          console.log('[Passage Retelling Questions] Audio ended')
          if (onEnded) onEnded()
        })
        innerAudioContext.onError((res: any) => {
          console.error('[Passage Retelling Questions] Audio play error:', res)
          wx.hideLoading()
          const language = wx.getStorageSync('language') || 'en'
          wx.showModal({
            title: language === 'zh' ? '错误' : 'Error',
            content: language === 'zh' ? '音频播放失败' : 'Playback failed',
            showCancel: false,
            success: () => { wx.navigateBack() }
          })
        })
        innerAudioContext.play()
      })
      .catch((error: any) => {
        console.error('[Passage Retelling Questions] Failed to get presigned URL:', error)
        wx.hideLoading()
        const language = wx.getStorageSync('language') || 'en'
        wx.showModal({
          title: language === 'zh' ? '错误' : 'Error',
          content: language === 'zh' ? '获取音频链接失败' : 'Failed to get audio URL',
          showCancel: false,
          success: () => { wx.navigateBack() }
        })
      })
  },

  cleanupAudio() {
    if (this.innerAudioContext) {
      this.innerAudioContext.stop()
      this.innerAudioContext.destroy()
      this.innerAudioContext = null
    }
  },

  onPrefaceTimerFinish() {
    console.log('[Passage Retelling Questions] Preface timer finished')
  }
})
import { getEnvironmentStorage } from '../../utils/environment'
