// question-answering.ts
import { getTranslation } from '../../utils/i18n'
import {
  PRACTICE_RULES,
  findMissingPracticeResources,
  showPracticeResourceError,
} from '../../utils/practice-rules'
import {
  ensureRecordPermission,
  savePhaseSnapshot,
  loadPhaseSnapshot,
  clearPhaseSnapshot,
} from '../../utils/recording-flow'
import {
  getQuestionDetail,
  getPresignedAudioUrl,
  getOrCreateSession,
  resetSession,
  ApiError,
} from '../../utils/api'

Page({
  data: {
    questionId: 0,
    sessionId: 0,
    examId: 0,
    questionTitle: '',
    maxScore: PRACTICE_RULES.answering.maxScore,
    // 四个问题（从 t_questions 获取）
    questions: [] as any[],
    // 旁白音频信息（从 t_question_types 获取）
    prefaceAudioUrl: '',
    prefaceDuration: 15,
    passageAudioUrl: '',
    passageDuration: 15,
    // UI显示状态
    showContent: false,
    showAudioTimer: false, // 旁白音频/短文音频倒计时
    showReadingTimer: false, // 阅读题目倒计时
    currentAudioDuration: 0,
    readingDuration: PRACTICE_RULES.answering.readingSeconds,
    currentStepText: '',
    currentPhase: 0, // 0=初始, 1=题目说明(旁白音频), 2=阅读题目, 3=播放短文
  },

  innerAudioContext: null as any,

  onLoad(options: any) {
    const isLoggedIn = wx.getStorageSync('isLoggedIn')
    if (!isLoggedIn) {
      wx.redirectTo({ url: '/pages/login/login' })
      return
    }

    const questionId = options.questionId ? parseInt(options.questionId, 10) : 0
    const examId = options.examId ? parseInt(options.examId, 10) : 0
    const sessionId = options.sessionId ? parseInt(options.sessionId, 10) : 0
    if (!questionId) {
      wx.showToast({ title: '题目ID无效', icon: 'none' })
      setTimeout(() => {
        wx.navigateBack()
      }, 1500)
      return
    }

    this.setData({ questionId, examId, sessionId })
    this.loadLanguage()
    this.loadQuestionDetail()
  },

  onUnload() {
    this.cleanupAudio()
  },

  onHide() {
    // P2-2: persist phase snapshot for resume after backgrounding.
    savePhaseSnapshot(
      'answering',
      this.data.questionId,
      this.data.sessionId,
      this.data.currentPhase,
      this.data.uploadedCount || 0,
    )
    if (this.data.isRecording && this.recorderManager) {
      try {
        this.recorderManager.stop()
      } catch (e) {
        // ignore
      }
    }
  },

  onShow() {
    const snapshot = loadPhaseSnapshot(
      'answering',
      this.data.questionId,
      this.data.sessionId,
    )
    if (!snapshot || snapshot.currentPhase <= 1) return
    const language = wx.getStorageSync('language') || 'en'
    const title = language === 'zh' ? '检测到上一次的进度' : 'Resume previous progress?'
    const content = language === 'zh'
      ? '上次进行了一半，是否继续？\n选"否"将从头开始。'
      : 'You were in the middle. Continue?\nChoosing "No" restarts from the top.'
    wx.showModal({
      title,
      content,
      confirmText: language === 'zh' ? '继续' : 'Continue',
      cancelText: language === 'zh' ? '从头开始' : 'Restart',
      success: modal => {
        if (!modal.confirm) {
          clearPhaseSnapshot(
            'answering',
            this.data.questionId,
            this.data.sessionId,
          )
        }
      },
    })
  },

  loadLanguage() {
    const language = wx.getStorageSync('language') || 'en'
    getTranslation(language)
    wx.setNavigationBarTitle({
      title: language === 'zh' ? '回答问题' : 'Question Answering',
    })
  },

  loadQuestionDetail() {
    wx.showLoading({ title: '加载中...', mask: true })

    getQuestionDetail(this.data.questionId)
      .then((question: any) => {
        console.log('[Question Answering] Question detail:', question)

        // 解析 content_json
        let contentJson = question.content_json || {}
        if (typeof contentJson === 'string') {
          try {
            contentJson = JSON.parse(contentJson)
          } catch (e) {
            console.error('[Question Answering] Failed to parse content_json:', e)
          }
        }

        // 获取四个问题
        const questions = contentJson.questions || []

        // 获取旁白音频（从 preface_items 获取，如同听选信息）
        const prefaceItems = question.preface_items || []
        // 旁白音频取第一个（如果有的话）
        const prefaceItem = prefaceItems[0] || {}
        const prefaceAudioUrl = prefaceItem.audio_url || ''
        const prefaceDuration = prefaceItem.duration || 15

        // 获取短文音频（从 text 字段获取）
        const passageAudioUrl = contentJson.text?.audio_url || ''
        const passageDuration = contentJson.text?.duration || 15

        this.setData({
          questionTitle: question.title || '',
          questions,
          prefaceAudioUrl,
          prefaceDuration,
          passageAudioUrl,
          passageDuration,
        })

        wx.hideLoading()

        const missing = findMissingPracticeResources([
          { label: '题型说明音频', value: prefaceAudioUrl },
          { label: '短文音频', value: passageAudioUrl },
          {
            label: `${PRACTICE_RULES.answering.questionCount} 个问题及音频`,
            value:
              questions.length === PRACTICE_RULES.answering.questionCount &&
              questions.every((item: any) => item?.content && item?.audio_url),
          },
        ])
        if (missing.length > 0) {
          showPracticeResourceError(missing)
          return
        }

        // 显示内容，开始流程
        this.setData({ showContent: true })

        // 获取或创建 session
        if (this.data.examId && this.data.sessionId) {
          return { session_id: this.data.sessionId, status: 0 }
        }
        return getOrCreateSession(this.data.questionId)
      })
      .then((sessionData: any) => {
        if (!sessionData) return // 用户选择返回

        console.log('[Question Answering] Session:', sessionData)
        this.setData({ sessionId: sessionData.session_id })

        if (sessionData.status === 1) {
          // 已完成，询问是否重新开始
          const language = wx.getStorageSync('language') || 'en'
          wx.showModal({
            title: language === 'zh' ? '提示' : 'Notice',
            content:
              language === 'zh'
                ? '该题目已做过，要重新开始。'
                : 'This question has been completed. Starting over will clear previous records.',
            showCancel: true,
            cancelText: language === 'zh' ? '返回' : 'Back',
            confirmText: language === 'zh' ? '确认' : 'Confirm',
            success: res => {
              if (res.confirm) {
                this.doResetAndStart()
              } else {
                wx.navigateBack()
              }
            },
          })
          return
        }

        // 新建 session，开始流程
        this.ensurePermissionAndStart()
      })
      .catch((error: any) => {
        console.error('[Question Answering] Load error:', error)
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

  doResetAndStart() {
    wx.showLoading({ title: '加载中...', mask: true })
    resetSession(this.data.questionId)
      .then((res: any) => {
        console.log('[Question Answering] Session reset:', res)
        this.setData({ sessionId: res.session_id, showContent: true })
        wx.hideLoading()
        this.ensurePermissionAndStart()
      })
      .catch((err: any) => {
        console.error('[Question Answering] Reset error:', err)
        wx.hideLoading()
        wx.showToast({ title: '重置失败', icon: 'none' })
      })
  },

  ensurePermissionAndStart() {
    ensureRecordPermission()
      .then(() => this.startPrefaceAudio())
      .catch(() => wx.navigateBack())
  },

  // 阶段1：播放旁白音频，显示"题目说明"
  startPrefaceAudio() {
    const { prefaceAudioUrl, prefaceDuration } = this.data

    this.setData({
      currentPhase: 1,
      currentStepText: '题目说明',
      currentAudioDuration: prefaceDuration,
      showAudioTimer: true,
    })

    setTimeout(() => {
      const timer = this.selectComponent('#audioTimer')
      if (timer) timer.startTimer()
    }, 100)

    if (!prefaceAudioUrl) {
      // 没有旁白音频，直接进入阅读阶段
      this.setData({ showAudioTimer: false })
      this.onPrefaceAudioEnd()
      return
    }

    this.playAudio(prefaceAudioUrl, () => {
      this.setData({ showAudioTimer: false })
      this.onPrefaceAudioEnd()
    })
  },

  onPrefaceAudioEnd() {
    if (this.data.currentPhase !== 1) return
    // 旁白音频结束，进入阅读题目阶段
    this.setData({ showAudioTimer: false })
    this.startReading()
  },

  // 阶段2：阅读题目，显示"阅读题目"
  startReading() {
    console.log('[Question Answering] Start reading')

    this.setData({
      currentPhase: 2,
      currentStepText: '阅读题目',
      showReadingTimer: true,
      readingDuration: PRACTICE_RULES.answering.readingSeconds,
    })

    setTimeout(() => {
      const timer = this.selectComponent('#readingTimer')
      if (timer) timer.startTimer()
    }, 100)
  },

  onReadingTimerFinish() {
    if (this.data.currentPhase !== 2) return
    console.log('[Question Answering] Reading finished')
    this.setData({ showReadingTimer: false })
    this.startPassageAudio()
  },

  // 阶段3：播放短文音频，显示"正在播放信息"
  startPassageAudio() {
    const { passageAudioUrl, passageDuration } = this.data

    this.setData({
      currentPhase: 3,
      currentStepText: '正在播放信息',
      currentAudioDuration: passageDuration * PRACTICE_RULES.answering.passagePlayCount,
      showAudioTimer: true,
    })

    setTimeout(() => {
      const timer = this.selectComponent('#audioTimer')
      if (timer) timer.startTimer()
    }, 100)

    if (!passageAudioUrl) {
      wx.showModal({
        title: '题目资源不完整',
        content: '短文音频不存在，请联系管理员。',
        showCancel: false,
        success: () => wx.navigateBack(),
      })
      return
    }

    this.playAudioTimes(passageAudioUrl, PRACTICE_RULES.answering.passagePlayCount, () => {
      this.setData({ showAudioTimer: false })
      this.onPassageAudioEnd()
    })
  },

  playAudioTimes(audioUrl: string, count: number, onEnded: () => void) {
    let played = 0
    const playNext = () => {
      if (played >= count) {
        onEnded()
        return
      }
      played += 1
      this.playAudio(audioUrl, playNext)
    }
    playNext()
  },

  onPassageAudioEnd() {
    if (this.data.currentPhase !== 3) return
    console.log('[Question Answering] Passage audio ended, navigate to question 1')
    // 短文播放完毕，跳转到第一题
    wx.redirectTo({
      url: `/pages/question-answering-item/question-answering-item?questionId=${this.data.questionId}&questionIndex=0&sessionId=${this.data.sessionId}&examId=${this.data.examId}`,
    })
  },

  playAudio(audioUrl: string, onEnded?: () => void) {
    console.log('[Question Answering] Playing audio:', audioUrl)
    this.cleanupAudio()
    wx.showLoading({ title: '加载音频...', mask: true })
    getPresignedAudioUrl(audioUrl)
      .then((response: any) => {
        console.log('[Question Answering] Got presigned URL:', response.url)
        const innerAudioContext = wx.createInnerAudioContext()
        this.innerAudioContext = innerAudioContext
        innerAudioContext.src = response.url
        innerAudioContext.onCanplay(() => {
          wx.hideLoading()
        })
        innerAudioContext.onPlay(() => {
          console.log('[Question Answering] Audio playing')
        })
        innerAudioContext.onEnded(() => {
          console.log('[Question Answering] Audio ended')
          if (onEnded) onEnded()
        })
        innerAudioContext.onError((res: any) => {
          console.error('[Question Answering] Audio play error:', res)
          wx.hideLoading()
          const language = wx.getStorageSync('language') || 'en'
          wx.showModal({
            title: language === 'zh' ? '错误' : 'Error',
            content: language === 'zh' ? '音频播放失败' : 'Playback failed',
            showCancel: false,
          })
        })
        innerAudioContext.play()
      })
      .catch((error: any) => {
        console.error('[Question Answering] Failed to get presigned URL:', error)
        wx.hideLoading()
        const language = wx.getStorageSync('language') || 'en'
        wx.showModal({
          title: language === 'zh' ? '错误' : 'Error',
          content: language === 'zh' ? '获取音频链接失败' : 'Failed to get audio URL',
          showCancel: false,
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

  onAudioTimerFinish() {
    console.log('[Question Answering] Audio timer finished')
    this.setData({ showAudioTimer: false })
  },
})
