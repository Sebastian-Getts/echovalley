// question-answering-item.ts
import {
  getQuestionDetail,
  getPresignedAudioUrl,
  uploadAudio,
  submitAnswer,
  completeSession,
} from '../../utils/api'
import { PRACTICE_RULES } from '../../utils/practice-rules'
import { playRecordingCue } from '../../utils/recording-flow'
import { finishExamQuestion } from '../../utils/exam-flow'

Page({
  data: {
    questionId: 0,
    sessionId: 0,
    examId: 0,
    questionIndex: 0, // 当前题目索引（0-3，共4题）
    totalQuestions: 4,
    currentQuestion: null as any,

    currentStepText: '',
    showAudioTimer: false,
    showRecordingTimer: false,
    currentAudioDuration: 0,
    recordingDuration: PRACTICE_RULES.answering.recordingSeconds,
    submitFailed: false,
    submitting: false,
    completing: false,
    pendingFilePath: '',
    pendingDuration: 0,
  },

  recorderManager: null as any,
  innerAudioContext: null as any,
  recordingStopped: false,

  onLoad(options: any) {
    const isLoggedIn = getEnvironmentStorage('isLoggedIn')
    if (!isLoggedIn) {
      wx.redirectTo({ url: '/pages/login/login' })
      return
    }

    const questionId = options.questionId ? parseInt(options.questionId, 10) : 0
    const questionIndex =
      options.questionIndex !== undefined ? parseInt(options.questionIndex, 10) : 0
    const sessionId = options.sessionId ? parseInt(options.sessionId, 10) : 0
    const examId = options.examId ? parseInt(options.examId, 10) : 0

    if (!questionId) {
      wx.showToast({ title: '题目ID无效', icon: 'none' })
      setTimeout(() => {
        wx.navigateBack()
      }, 1500)
      return
    }

    this.setData({
      questionId,
      questionIndex,
      sessionId,
      examId,
    })

    this.initRecorder()
    this.loadQuestion()
  },

  onUnload() {
    this.cleanupAudio()
    this.cleanupRecorder()
  },

  loadLanguage() {
    const language = wx.getStorageSync('language') || 'en'
    wx.setNavigationBarTitle({
      title: language === 'zh' ? '回答问题' : 'Question Answering',
    })
  },

  loadQuestion() {
    wx.showLoading({ title: '加载中...', mask: true })

    getQuestionDetail(this.data.questionId)
      .then((question: any) => {
        console.log('[Question Answering Item] Question detail:', question)

        let contentJson = question.content_json || {}
        if (typeof contentJson === 'string') {
          try {
            contentJson = JSON.parse(contentJson)
          } catch (e) {
            console.error('[Question Answering Item] Failed to parse content_json:', e)
          }
        }

        const questions = contentJson.questions || []
        if (this.data.questionIndex >= questions.length) {
          wx.showToast({ title: '题目索引超出范围', icon: 'none' })
          setTimeout(() => {
            wx.navigateBack()
          }, 1500)
          return
        }

        const currentQuestion = questions[this.data.questionIndex]
        this.setData({
          currentQuestion: {
            content: currentQuestion.content || '',
            audio_url: currentQuestion.audio_url || '',
            duration: currentQuestion.duration || 5,
          },
        })

        wx.hideLoading()
        this.loadLanguage()

        // 延迟开始播放音频
        setTimeout(() => {
          this.playQuestionAudio()
        }, 500)
      })
      .catch((error: any) => {
        console.error('[Question Answering Item] Load error:', error)
        wx.hideLoading()
        wx.showToast({ title: '加载失败', icon: 'none' })
        setTimeout(() => {
          wx.navigateBack()
        }, 1500)
      })
  },

  playQuestionAudio() {
    const question = this.data.currentQuestion
    const questionIndex = this.data.questionIndex

    // 显示"第X题"倒计时
    this.setData({
      currentStepText: `第${questionIndex + 1}题`,
      showAudioTimer: true,
      currentAudioDuration: question.duration || 5,
    })

    setTimeout(() => {
      const timer = this.selectComponent('#audioTimer')
      if (timer) timer.startTimer()
    }, 100)

    if (!question.audio_url) {
      wx.showModal({
        title: '题目资源不完整',
        content: '当前问题音频不存在，请联系管理员。',
        showCancel: false,
        success: () => wx.navigateBack(),
      })
      return
    }

    getPresignedAudioUrl(question.audio_url)
      .then((res: any) => {
        this.cleanupAudio()
        const audioContext = wx.createInnerAudioContext()
        this.innerAudioContext = audioContext
        audioContext.src = res.url
        audioContext.onEnded(() => {
          console.log('[Question Answering Item] Audio ended')
          this.setData({ showAudioTimer: false })
          this.startRecording()
        })
        audioContext.onError((err: any) => {
          console.error('[Question Answering Item] Audio error:', err)
          this.setData({ showAudioTimer: false })
          wx.showModal({ title: '音频播放失败', content: '请稍后重试。', showCancel: false })
        })
        audioContext.play()
      })
      .catch((err: any) => {
        console.error('[Question Answering Item] Failed to get presigned URL:', err)
        this.setData({ showAudioTimer: false })
        wx.showModal({ title: '音频播放失败', content: '请稍后重试。', showCancel: false })
      })
  },

  startRecording() {
    console.log('[Question Answering Item] Start recording')

    this.setData({
      currentStepText: '开始录音',
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
      console.log('[Question Answering Item] Recording started')
    })

    recorderManager.onStop((res: any) => {
      this.recordingStopped = true
      console.log('[Question Answering Item] Recording stopped', res)
      this.setData({ showRecordingTimer: false })
      const { tempFilePath, duration } = res
      playRecordingCue('stop').then(() => {
        this.handleRecordingComplete(tempFilePath, Math.ceil(duration / 1000))
      })
    })

    recorderManager.onError((err: any) => {
      console.error('[Question Answering Item] Recording error:', err)
      wx.showToast({ title: '录音失败', icon: 'none' })
    })

    this.recorderManager = recorderManager
  },

  startRecordAudio() {
    if (!this.recorderManager) {
      console.error('[Question Answering Item] RecorderManager not initialized')
      return
    }

    this.recordingStopped = false
    this.recorderManager.start({
      duration: PRACTICE_RULES.answering.recordingSeconds * 1000,
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

  handleRecordingComplete(tempFilePath: string, duration: number) {
    this.setData({ pendingFilePath: tempFilePath, pendingDuration: duration })
    this.submitPendingRecording()
  },

  submitPendingRecording() {
    const tempFilePath = this.data.pendingFilePath
    const duration = this.data.pendingDuration
    if (!tempFilePath || this.data.submitting) return
    wx.showLoading({ title: '上传中...', mask: true })
    this.setData({ submitting: true, submitFailed: false })

    const studentDbId = getEnvironmentStorage('studentDbId') || 0

    uploadAudio(tempFilePath, this.data.questionId)
      .then((uploadRes: any) => {
        console.log('[Question Answering Item] Audio uploaded:', uploadRes)
        return submitAnswer(studentDbId, {
          session_id: this.data.sessionId,
          question_id: this.data.questionId,
          answers: [{ audio_url: uploadRes.audio_url, duration }],
        })
      })
      .then((submitRes: any) => {
        console.log('[Question Answering Item] Answer submitted:', submitRes)
        wx.hideLoading()
        this.setData({ submitting: false, pendingFilePath: '', pendingDuration: 0 })
        wx.showToast({ title: '已保存', icon: 'none', duration: 800 })
        setTimeout(() => {
          this.goToNextQuestion()
        }, 1000)
      })
      .catch((err: any) => {
        console.error('[Question Answering Item] Submit error:', err)
        wx.hideLoading()
        this.setData({ submitting: false, submitFailed: true })
        wx.showToast({ title: '提交失败', icon: 'none' })
      })
  },

  retrySubmit() {
    this.submitPendingRecording()
  },

  onEarlyStopRecording() {
    this.setData({ showRecordingTimer: false })
    this.stopRecording()
  },

  goToNextQuestion() {
    if (this.data.completing) return
    const nextIndex = this.data.questionIndex + 1

    if (nextIndex < this.data.totalQuestions) {
      // 还有下一题，跳转到下一题
      wx.redirectTo({
        url: `/pages/question-answering-item/question-answering-item?questionId=${this.data.questionId}&questionIndex=${nextIndex}&sessionId=${this.data.sessionId}&examId=${this.data.examId}`,
      })
    } else {
      // 全部完成，标记 session 完成
      this.setData({ completing: true })
      const completion = this.data.examId
        ? finishExamQuestion(this.data.questionId)
        : completeSession(this.data.questionId)
      completion
        .then(() => {
          if (this.data.examId) return
          console.log('[Question Answering Item] Session completed')
          wx.showToast({ title: '全部完成', icon: 'success', duration: 1500 })
          setTimeout(() => {
            wx.navigateBack()
          }, 2000)
        })
        .catch((err: any) => {
          this.setData({ completing: false })
          console.error('[Question Answering Item] Complete session error:', err)
          wx.showToast({ title: '全部完成', icon: 'success', duration: 1500 })
          setTimeout(() => {
            wx.navigateBack()
          }, 2000)
        })
    }
  },

  onAudioTimerFinish() {
    console.log('[Question Answering Item] Audio timer finished')
    this.setData({ showAudioTimer: false })
  },

  onRecordingTimerFinish() {
    console.log('[Question Answering Item] Recording timer finished')
    this.setData({ showRecordingTimer: false })
    this.stopRecording()
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
  },
})
import { getEnvironmentStorage } from '../../utils/environment'
