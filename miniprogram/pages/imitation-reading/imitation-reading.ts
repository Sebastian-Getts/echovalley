// imitation-reading.ts
import { getTranslation } from '../../utils/i18n'
import {
  getQuestionDetail,
  getPresignedAudioUrl,
  getOrCreateSession,
  resetSession,
  completeSession,
  submitAnswer,
  uploadAudio,
  ApiError
} from '../../utils/api'

Page({
  data: {
    questionId: 0,
    sessionId: 0,
    questionTitle: '',
    questionContent: '',
    prefaceAudioUrl: '', // 旁白语音URL
    contentAudioUrl: '', // 短文音频URL
    // 四阶段控制
    currentPhase: 1, // 当前阶段：1=旁白播放, 2=短文播放, 3=准备录音, 4=录音
    showPhase1Timer: false,
    showPhase2Timer: false,
    showPhase3Timer: false,
    showPhase4Timer: false,
    phase1Duration: 15, // 旁白播放15秒
    phase2Duration: 15, // 短文播放15秒
    phase3Duration: 10, // 准备录音10秒
    phase4Duration: 15  // 录音15秒
  },

  // 录音管理器
  recorderManager: null as any,
  // 音频播放器
  innerAudioContext: null as any,

  onLoad(options: any) {
    // 初始化录音管理器
    this.initRecorder()

    // 检查登录状态
    const isLoggedIn = wx.getStorageSync('isLoggedIn')
    if (!isLoggedIn) {
      wx.redirectTo({ url: '/pages/login/login' })
      return
    }

    // 获取题目ID
    const questionId = options.questionId ? parseInt(options.questionId, 10) : 0
    if (!questionId) {
      wx.showToast({ title: '题目ID无效', icon: 'none' })
      setTimeout(() => { wx.navigateBack() }, 1500)
      return
    }

    this.setData({ questionId })

    this.loadLanguage()
    this.loadQuestionDetail()
  },

  onUnload() {
    this.cleanupAudio()
    this.cleanupRecorder()
  },

  loadLanguage() {
    const language = wx.getStorageSync('language') || 'en'
    getTranslation(language)
    wx.setNavigationBarTitle({
      title: language === 'zh' ? '模仿朗读' : 'Imitation Reading'
    })
  },

  loadQuestionDetail() {
    wx.showLoading({ title: '加载中...', mask: true })

    getQuestionDetail(this.data.questionId)
      .then((question: any) => {
        console.log('[Imitation Reading] Question detail:', question)

        // 解析 content_json
        let contentText = ''
        let contentAudioUrl = ''
        let contentAudioDuration = 15
        if (question.content_json) {
          if (typeof question.content_json === 'string') {
            try {
              question.content_json = JSON.parse(question.content_json)
            } catch (e) {
              console.error('[Imitation Reading] Failed to parse content_json:', e)
            }
          }
          if (question.content_json) {
            contentText = question.content_json.content || ''
            contentAudioUrl = question.content_json.audio_url || ''
            if (question.content_json.duration !== undefined && question.content_json.duration !== null) {
              contentAudioDuration = question.content_json.duration
            }
          }
        }

        const prefaceAudioUrl = question.preface_audio_url || ''
        const prefaceAudioDuration = question.preface_audio_duration || 15

        this.setData({
          questionTitle: question.title || '',
          questionContent: contentText,
          prefaceAudioUrl: prefaceAudioUrl,
          contentAudioUrl: contentAudioUrl,
          phase1Duration: Math.ceil(prefaceAudioDuration),
          phase2Duration: Math.ceil(contentAudioDuration)
        })

        wx.hideLoading()

        if (!prefaceAudioUrl) {
          wx.showModal({
            title: '提示',
            content: '旁白语音不存在，请联系管理员',
            showCancel: false,
            success: () => { wx.navigateBack() }
          })
          return
        }

        // 获取或创建 session
        return getOrCreateSession(this.data.questionId)
      })
      .then((sessionData: any) => {
        console.log('[Imitation Reading] Session:', sessionData)
        this.setData({ sessionId: sessionData.session_id })

        if (sessionData.status === 1) {
          // 已完成
          const language = wx.getStorageSync('language') || 'en'
          wx.showModal({
            title: language === 'zh' ? '提示' : 'Notice',
            content: language === 'zh' ? '该题目已做过，要重新开始，原记录会清除。' : 'This question has been completed. Starting over will clear previous records.',
            showCancel: true,
            cancelText: language === 'zh' ? '返回' : 'Back',
            confirmText: language === 'zh' ? '确认' : 'Confirm',
            success: (res) => {
              if (res.confirm) {
                this.doResetAndStart()
              } else if (res.cancel) {
                wx.navigateBack()
              }
            }
          })
        } else if (sessionData.has_answer_record && sessionData.answer_count > 0) {
          // 有部分记录，统一重新开始
          const language = wx.getStorageSync('language') || 'en'
          wx.showModal({
            title: language === 'zh' ? '提示' : 'Notice',
            content: language === 'zh' ? '该题目已做过，要重新开始，原记录会清除。' : 'This question has been completed. Starting over will clear previous records.',
            showCancel: true,
            cancelText: language === 'zh' ? '返回' : 'Back',
            confirmText: language === 'zh' ? '确认' : 'Confirm',
            success: (res) => {
              if (res.confirm) {
                this.doResetAndStart()
              } else if (res.cancel) {
                wx.navigateBack()
              }
            }
          })
        } else {
          // 新建 session，直接开始
          this.startPhase1()
        }
      })
      .catch((error: any) => {
        console.error('[Imitation Reading] Load error:', error)
        wx.hideLoading()
        const language = wx.getStorageSync('language') || 'en'
        let msg = language === 'zh' ? '加载失败' : 'Load failed'
        if (error instanceof ApiError) msg = error.message || msg
        wx.showToast({ title: msg, icon: 'none', duration: 2000 })
        setTimeout(() => { wx.navigateBack() }, 2000)
      })
  },

  doResetAndStart() {
    wx.showLoading({ title: '加载中...', mask: true })
    resetSession(this.data.questionId)
      .then((res: any) => {
        console.log('[Imitation Reading] Session reset:', res)
        this.setData({ sessionId: res.session_id })
        wx.hideLoading()
        this.startPhase1()
      })
      .catch((err: any) => {
        console.error('[Imitation Reading] Reset error:', err)
        wx.hideLoading()
        wx.showToast({ title: '重置失败', icon: 'none' })
      })
  },

  startPhase1() {
    this.setData({ currentPhase: 1, showPhase1Timer: true })
    setTimeout(() => {
      const timer = this.selectComponent('#phase1Timer')
      if (timer) {
        timer.startTimer()
        this.playAudio(this.data.prefaceAudioUrl, () => this.onPhase1Finish())
      }
    }, 100)
  },

  startRecordingPhase() {
    // 直接进入录音阶段（跳过已完成的音频播放）
    this.setData({
      currentPhase: 3,
      showPhase1Timer: false,
      showPhase2Timer: false,
      showPhase3Timer: true,
      showPhase4Timer: false
    })
    setTimeout(() => {
      const timer = this.selectComponent('#phase3Timer')
      if (timer) timer.startTimer()
    }, 100)
  },

  onPhase1Finish() {
    console.log('[Imitation Reading] Phase 1 finished, starting phase 2')
    this.cleanupAudio()
    this.setData({ currentPhase: 2, showPhase1Timer: false, showPhase2Timer: true })
    setTimeout(() => {
      const timer = this.selectComponent('#phase2Timer')
      if (timer) {
        timer.startTimer()
        if (!this.data.contentAudioUrl) {
          wx.showModal({
            title: '提示',
            content: '短文音频不存在，请联系管理员',
            showCancel: false,
            success: () => { wx.navigateBack() }
          })
          return
        }
        this.playAudio(this.data.contentAudioUrl, () => this.onPhase2Finish())
      }
    }, 100)
  },

  onPhase2Finish() {
    console.log('[Imitation Reading] Phase 2 finished, starting phase 3')
    this.cleanupAudio()
    const language = wx.getStorageSync('language') || 'en'
    wx.showToast({ title: language === 'zh' ? '即将开始准备' : 'Get ready', icon: 'none', duration: 1500 })
    this.setData({ currentPhase: 3, showPhase2Timer: false, showPhase3Timer: true })
    setTimeout(() => {
      const timer = this.selectComponent('#phase3Timer')
      if (timer) timer.startTimer()
    }, 100)
  },

  onPhase3Finish() {
    console.log('[Imitation Reading] Phase 3 finished, starting phase 4')
    const language = wx.getStorageSync('language') || 'en'
    wx.showToast({ title: language === 'zh' ? '开始录音' : 'Start recording', icon: 'none', duration: 1500 })
    this.setData({ currentPhase: 4, showPhase3Timer: false, showPhase4Timer: true })
    setTimeout(() => {
      const timer = this.selectComponent('#phase4Timer')
      if (timer) {
        timer.startTimer()
        this.startRecording()
      }
    }, 100)
  },

  onPhase4Finish() {
    console.log('[Imitation Reading] Phase 4 finished, stopping recording')
    this.stopRecording()
    this.cleanupRecorder()
    this.cleanupAudio()
  },

  initRecorder() {
    const recorderManager = wx.getRecorderManager()
    recorderManager.onStart(() => {
      console.log('[Imitation Reading] Recording started')
    })
    recorderManager.onStop((res: any) => {
      console.log('[Imitation Reading] Recording stopped', res)
      const { tempFilePath, duration } = res
      this.handleRecordingComplete(tempFilePath, Math.ceil(duration / 1000))
    })
    recorderManager.onError((err: any) => {
      console.error('[Imitation Reading] Recording error:', err)
      const language = wx.getStorageSync('language') || 'en'
      wx.showToast({ title: language === 'zh' ? '录音失败' : 'Recording failed', icon: 'none' })
    })
    this.recorderManager = recorderManager
  },

  handleRecordingComplete(tempFilePath: string, duration: number) {
    const language = wx.getStorageSync('language') || 'en'
    const studentDbId = wx.getStorageSync('studentDbId') || 0
    wx.showLoading({ title: language === 'zh' ? '上传中...' : 'Uploading...', mask: true })

    // 1. 上传录音
    uploadAudio(tempFilePath, this.data.questionId)
      .then((uploadRes: any) => {
        console.log('[Imitation Reading] Audio uploaded:', uploadRes)
        // 2. 提交答案
        return submitAnswer(studentDbId, {
          session_id: this.data.sessionId,
          question_id: this.data.questionId,
          answers: [{ audio_url: uploadRes.audio_url, duration }]
        })
      })
      .then((submitRes: any) => {
        console.log('[Imitation Reading] Answer submitted:', submitRes)
        wx.hideLoading()
        wx.showToast({
          title: language === 'zh' ? '录音完成' : 'Recording completed',
          icon: 'success',
          duration: 2000
        })
        // 3. 标记 session 完成
        return completeSession(this.data.questionId)
      })
      .then(() => {
        setTimeout(() => { wx.navigateBack() }, 2000)
      })
      .catch((err: any) => {
        console.error('[Imitation Reading] Error:', err)
        wx.hideLoading()
        wx.showToast({
          title: language === 'zh' ? '提交失败，请重试' : 'Submit failed, please retry',
          icon: 'none'
        })
      })
  },

  startRecording() {
    if (!this.recorderManager) {
      console.error('[Imitation Reading] RecorderManager not initialized')
      return
    }
    const language = wx.getStorageSync('language') || 'en'
    wx.authorize({
      scope: 'scope.record',
      success: () => {
        console.log('[Imitation Reading] Recording authorized')
        this.recorderManager.start({
          duration: 15000,
          format: 'mp3',
          sampleRate: 16000,
          numberOfChannels: 1,
          encodeBitRate: 48000,
          frameSize: 50
        })
      },
      fail: () => {
        console.error('[Imitation Reading] Recording authorization denied')
        wx.showToast({ title: language === 'zh' ? '需要录音权限' : 'Permission required', icon: 'none' })
      }
    })
  },

  stopRecording() {
    if (this.recorderManager) this.recorderManager.stop()
  },

  playAudio(audioUrl: string, onEnded?: () => void) {
    console.log('[Imitation Reading] Playing audio:', audioUrl)
    this.cleanupAudio()
    wx.showLoading({ title: '加载音频...', mask: true })
    getPresignedAudioUrl(audioUrl)
      .then((response: any) => {
        console.log('[Imitation Reading] Got presigned URL:', response.url)
        const innerAudioContext = wx.createInnerAudioContext()
        this.innerAudioContext = innerAudioContext
        innerAudioContext.src = response.url
        innerAudioContext.onCanplay(() => { wx.hideLoading() })
        innerAudioContext.onPlay(() => { console.log('[Imitation Reading] Audio playing') })
        innerAudioContext.onEnded(() => {
          console.log('[Imitation Reading] Audio ended')
          if (onEnded) onEnded()
        })
        innerAudioContext.onError((res: any) => {
          console.error('[Imitation Reading] Audio play error:', res)
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
        console.error('[Imitation Reading] Failed to get presigned URL:', error)
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

  cleanupRecorder() {
    if (this.recorderManager) this.recorderManager.stop()
  }
})
