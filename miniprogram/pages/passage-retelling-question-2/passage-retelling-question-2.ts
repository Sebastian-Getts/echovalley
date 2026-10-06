// passage-retelling-question-2.ts
import { getTranslation } from '../../utils/i18n'
import {
  getQuestionDetail,
  submitAnswer,
  uploadAudio,
  completeSession,
  ApiError,
} from '../../utils/api'
import { PRACTICE_RULES } from '../../utils/practice-rules'
import { playRecordingCue } from '../../utils/recording-flow'
import { finishExamQuestion } from '../../utils/exam-flow'

Page({
  data: {
    questionId: 0,
    sessionId: 0,
    examId: 0,
    // 问题
    question: { content: '', audio_url: '' },
    // UI
    showContent: false,
    currentStepText: '',
    showPrepareTimer: false,
    showRecordingTimer: false,
    prepareDuration: PRACTICE_RULES.retelling.questionPreparationSeconds,
    recordingDuration: PRACTICE_RULES.retelling.questionRecordingSeconds,
    submitFailed: false,
    submitting: false,
    completing: false,
    pendingFilePath: '',
    pendingDuration: 0,
  },

  recorderManager: null as any,
  recordingStopped: false,

  onLoad(options: any) {
    this.initRecorder()

    const isLoggedIn = wx.getStorageSync('isLoggedIn')
    if (!isLoggedIn) {
      wx.redirectTo({ url: '/pages/login/login' })
      return
    }

    const questionId = options.questionId ? parseInt(options.questionId, 10) : 0
    const sessionId = options.sessionId ? parseInt(options.sessionId, 10) : 0
    const examId = options.examId ? parseInt(options.examId, 10) : 0
    if (!questionId) {
      wx.showToast({ title: '题目ID无效', icon: 'none' })
      setTimeout(() => {
        wx.navigateBack()
      }, 1500)
      return
    }

    this.setData({ questionId, sessionId, examId })
    this.loadLanguage()
    this.loadQuestionDetail()
  },

  onUnload() {
    this.cleanupRecorder()
  },

  loadLanguage() {
    const language = wx.getStorageSync('language') || 'en'
    getTranslation(language)
    wx.setNavigationBarTitle({
      title: language === 'zh' ? '短文复述及提问' : 'Passage Retelling',
    })
  },

  loadQuestionDetail() {
    wx.showLoading({ title: '加载中...', mask: true })

    getQuestionDetail(this.data.questionId)
      .then((question: any) => {
        console.log('[Passage Retelling Q2] Question detail:', question)

        const questionData = question.content_json?.questions?.[1] || { content: '', audio_url: '' }

        this.setData({
          question: questionData,
        })

        wx.hideLoading()
        this.setData({ showContent: true })

        // 直接开始准备阶段
        this.startPrepare()
      })
      .catch((error: any) => {
        console.error('[Passage Retelling Q2] Load error:', error)
        wx.hideLoading()
        const language = wx.getStorageSync('language') || 'en'
        let msg = language === 'zh' ? '加载失败' : 'Load failed'
        if (error instanceof ApiError) msg = error.message || msg
        wx.showToast({ title: msg, icon: 'none', duration: 2000 })
        setTimeout(() => {
          wx.navigateBack()
        }, 2000)
      })
  },

  // 准备回答
  startPrepare() {
    const language = wx.getStorageSync('language') || 'en'

    this.setData({
      currentStepText: language === 'zh' ? '准备回答' : 'Prepare to Answer',
      showPrepareTimer: true,
    })

    setTimeout(() => {
      const timer = this.selectComponent('#prepareTimer')
      if (timer) timer.startTimer()
    }, 100)
  },

  onPrepareTimerFinish() {
    console.log('[Passage Retelling Q2] Prepare finished')
    this.setData({ showPrepareTimer: false })
    this.startRecording()
  },

  // 开始录音
  startRecording() {
    const language = wx.getStorageSync('language') || 'en'

    this.setData({
      currentStepText: language === 'zh' ? '开始录音' : 'Start Recording',
      showRecordingTimer: true,
    })

    setTimeout(async () => {
      const timer = this.selectComponent('#recordingTimer')
      await playRecordingCue('start')
      if (timer) timer.startTimer()
      this.startRecordAudio()
    }, 100)
  },

  initRecorder() {
    const recorderManager = wx.getRecorderManager()
    recorderManager.onStart(() => {
      console.log('[Passage Retelling Q2] Recording started')
    })
    recorderManager.onStop((res: any) => {
      this.recordingStopped = true
      console.log('[Passage Retelling Q2] Recording stopped', res)
      this.setData({ showRecordingTimer: false })
      const { tempFilePath, duration } = res
      playRecordingCue('stop').then(() => {
        this.handleRecordingComplete(tempFilePath, Math.ceil(duration / 1000))
      })
    })
    recorderManager.onError((err: any) => {
      console.error('[Passage Retelling Q2] Recording error:', err)
      const language = wx.getStorageSync('language') || 'en'
      wx.showToast({ title: language === 'zh' ? '录音失败' : 'Recording failed', icon: 'none' })
    })
    this.recorderManager = recorderManager
  },

  handleRecordingComplete(tempFilePath: string, duration: number) {
    this.setData({ pendingFilePath: tempFilePath, pendingDuration: duration })
    this.submitPendingRecording()
  },

  submitPendingRecording() {
    const tempFilePath = this.data.pendingFilePath
    const duration = this.data.pendingDuration
    if (!tempFilePath || this.data.submitting) return
    const language = wx.getStorageSync('language') || 'en'
    const studentDbId = wx.getStorageSync('studentDbId') || 0
    wx.showLoading({ title: language === 'zh' ? '上传中...' : 'Uploading...', mask: true })
    this.setData({ submitting: true, submitFailed: false })

    uploadAudio(tempFilePath, this.data.questionId)
      .then((uploadRes: any) => {
        console.log('[Passage Retelling Q2] Audio uploaded:', uploadRes)
        return submitAnswer(studentDbId, {
          session_id: this.data.sessionId,
          question_id: this.data.questionId,
          answers: [{ audio_url: uploadRes.audio_url, duration }],
        })
      })
      .then((submitRes: any) => {
        console.log('[Passage Retelling Q2] Answer submitted:', submitRes)
        wx.hideLoading()
        this.setData({ submitting: false, pendingFilePath: '', pendingDuration: 0 })
        // 全部完成
        this.onAllCompleted()
      })
      .catch((err: any) => {
        console.error('[Passage Retelling Q2] Error:', err)
        wx.hideLoading()
        this.setData({ submitting: false, submitFailed: true })
        wx.showToast({
          title: language === 'zh' ? '提交失败' : 'Submit failed',
          icon: 'none',
        })
      })
  },

  retrySubmit() {
    this.submitPendingRecording()
  },

  startRecordAudio() {
    if (!this.recorderManager) {
      console.error('[Passage Retelling Q2] RecorderManager not initialized')
      return
    }
    this.recordingStopped = false
    this.recorderManager.start({
      duration: PRACTICE_RULES.retelling.questionRecordingSeconds * 1000,
      format: 'mp3',
      sampleRate: 16000,
      numberOfChannels: 1,
      encodeBitRate: 48000,
      frameSize: 50,
    })
  },

  stopRecording() {
    if (!this.recorderManager || this.recordingStopped) return
    this.recordingStopped = true
    this.recorderManager.stop()
  },

  cleanupRecorder() {
    if (this.recorderManager) this.recorderManager.stop()
  },

  onRecordingTimerFinish() {
    console.log('[Passage Retelling Q2] Recording timer finished')
    this.setData({ showRecordingTimer: false })
    this.stopRecording()
  },

  onEarlyStopRecording() {
    this.setData({ showRecordingTimer: false })
    this.stopRecording()
  },

  onAllCompleted() {
    if (this.data.completing) return
    this.setData({ completing: true })
    console.log('[Passage Retelling Q2] All questions completed!')
    this.cleanupRecorder()

    const language = wx.getStorageSync('language') || 'en'
    wx.showToast({
      title: language === 'zh' ? '练习完成' : 'Practice completed',
      icon: 'success',
      duration: 2000,
    })

    const completion = this.data.examId
      ? finishExamQuestion(this.data.questionId)
      : completeSession(this.data.questionId)
    completion
      .then(() => {
        if (this.data.examId) return
        setTimeout(() => {
          wx.navigateBack()
        }, 2000)
      })
      .catch(() => {
        this.setData({ completing: false })
        setTimeout(() => {
          wx.navigateBack()
        }, 2000)
      })
  },
})
