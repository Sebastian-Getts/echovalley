// passage-retelling.ts
import { getTranslation } from '../../utils/i18n'
import { getEnvironmentStorage } from '../../utils/environment'
import {
  PRACTICE_RULES,
  findMissingPracticeResources,
  showPracticeResourceError,
} from '../../utils/practice-rules'
import {
  ensureRecordPermission,
  playRecordingCue,
  savePhaseSnapshot,
  loadPhaseSnapshot,
  clearPhaseSnapshot,
} from '../../utils/recording-flow'
import {
  getQuestionDetail,
  getPresignedAudioUrl,
  getOrCreateSession,
  resetSession,
  submitAnswer,
  uploadAudio,
  ApiError,
} from '../../utils/api'

Page({
  data: {
    questionId: 0,
    sessionId: 0,
    examId: 0,
    questionTitle: '',
    maxScore: PRACTICE_RULES.retelling.maxScore,
    // 旁白3个item (从 t_question_types 获取)
    prefaceItems: [] as any[],
    // 题目内容
    theme: '',
    themeAudioUrl: '',
    themeDuration: 0,
    content: '',
    contentAudioUrl: '',
    contentDuration: 0,
    example: '',
    imgUrl: '',
    // 阶段控制
    currentPhase: 0, // 0=初始, 1=题目说明(旁白+theme), 2=阅读, 3=播放content, 4=准备回答, 5=录音
    currentStepText: '',
    // UI显示
    showContent: false,
    showAudioTimer: false,
    showReadingTimer: false,
    showPrepareTimer: false,
    showRecordingTimer: false,
    currentAudioDuration: 0,
    readingDuration: PRACTICE_RULES.retelling.mindMapReadingSeconds,
    prepareDuration: PRACTICE_RULES.retelling.preparationSeconds,
    recordingDuration: PRACTICE_RULES.retelling.retellingRecordingSeconds,
    // 当前播放的旁白索引
    currentPrefaceIndex: 0,
    submitting: false,
  },

  // 录音管理器
  recorderManager: null as any,
  // 音频播放器
  innerAudioContext: null as any,
  recordingStopped: false,

  onLoad(options: any) {
    this.initRecorder()

    const isLoggedIn = getEnvironmentStorage('isLoggedIn')
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
    this.cleanupRecorder()
  },

  onHide() {
    // P2-2: persist phase snapshot for resume after backgrounding.
    savePhaseSnapshot(
      'retelling',
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
      'retelling',
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
            'retelling',
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
      title: language === 'zh' ? '短文复述及提问' : 'Passage Retelling',
    })
  },

  loadQuestionDetail() {
    wx.showLoading({ title: '加载中...', mask: true })

    getQuestionDetail(this.data.questionId)
      .then((question: any) => {
        console.log('[Passage Retelling] Question detail:', question)

        // 解析 content_json
        let theme = ''
        let themeAudioUrl = ''
        let themeDuration = 0
        let content = ''
        let contentAudioUrl = ''
        let contentDuration = 0
        let example = ''
        let imgUrl = ''

        if (question.content_json) {
          if (typeof question.content_json === 'string') {
            try {
              question.content_json = JSON.parse(question.content_json)
            } catch (e) {
              console.error('[Passage Retelling] Failed to parse content_json:', e)
            }
          }

          if (question.content_json && question.content_json.text) {
            theme = question.content_json.text.theme || ''
            themeAudioUrl = question.content_json.text.theme_audio_url || ''
            themeDuration = question.content_json.text.theme_duration || 0
            content = question.content_json.text.content || ''
            contentAudioUrl = question.content_json.text.audio_url || ''
            contentDuration = question.content_json.text.duration || 0
            example = question.content_json.text.example || ''
            imgUrl = question.content_json.text.img_url || ''
          }
        }

        // 获取旁白3个item (从 t_question_types 获取)
        const prefaceItems = question.preface_items || []
        const questions = (question.content_json && question.content_json.questions) || []

        const missing = findMissingPracticeResources([
          { label: '题目主题', value: theme },
          { label: '题目主题音频', value: themeAudioUrl },
          { label: '短文正文', value: content },
          { label: '短文音频', value: contentAudioUrl },
          { label: '思维导图', value: imgUrl },
          {
            label: '三段固定说明音频',
            value: prefaceItems.length >= 3 && prefaceItems.slice(0, 3).every((item: any) => item && item.audio_url),
          },
          {
            label: '两个提问提示',
            value:
              questions.length === PRACTICE_RULES.retelling.questionCount &&
              questions.every((item: any) => item && item.content),
          },
        ])
        if (missing.length > 0) {
          wx.hideLoading()
          showPracticeResourceError(missing)
          return
        }

        // MinIO buckets are private in both development and production. Images,
        // like audio, therefore need a temporary URL before renderer access.
        const imageUrlPromise = imgUrl
          ? getPresignedAudioUrl(imgUrl)
              .then((response: any) => response.url || imgUrl)
              .catch((error: any) => {
                console.error('[Passage Retelling] Failed to sign mind map URL:', error)
                return imgUrl
              })
          : Promise.resolve('')

        return imageUrlPromise.then((resolvedImgUrl: string) => {
          this.setData({
            questionTitle: question.title || '',
            theme,
            themeAudioUrl,
            themeDuration,
            content,
            contentAudioUrl,
            contentDuration,
            example,
            imgUrl: resolvedImgUrl,
            prefaceItems,
          })

          wx.hideLoading()

          // 显示内容
          this.setData({ showContent: true })

          // 获取或创建 session
          if (this.data.examId && this.data.sessionId) {
            return { session_id: this.data.sessionId, status: 0 }
          }
          return getOrCreateSession(this.data.questionId)
        })
      })
      .then((sessionData: any) => {
        if (!sessionData) return

        console.log('[Passage Retelling] Session:', sessionData)
        this.setData({ sessionId: sessionData.session_id })

        if (sessionData.status === 1) {
          // 已完成，询问是否重新开始
          const language = wx.getStorageSync('language') || 'en'
          wx.showModal({
            title: language === 'zh' ? '提示' : 'Notice',
            content:
              language === 'zh'
                ? '该题目已做过，要重新开始，原记录会清除。'
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

        // 新建 session，直接开始
        this.ensurePermissionAndStart()
      })
      .catch((error: any) => {
        console.error('[Passage Retelling] Load error:', error)
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
        console.log('[Passage Retelling] Session reset:', res)
        this.setData({ sessionId: res.session_id, showContent: true })
        wx.hideLoading()
        this.ensurePermissionAndStart()
      })
      .catch((err: any) => {
        console.error('[Passage Retelling] Reset error:', err)
        wx.hideLoading()
        wx.showToast({ title: '重置失败', icon: 'none' })
      })
  },

  ensurePermissionAndStart() {
    ensureRecordPermission()
      .then(() => this.startPrefacePhase())
      .catch(() => wx.navigateBack())
  },

  // 阶段1：题目说明 - 播放 旁白1 → theme → 旁白2
  startPrefacePhase() {
    const { prefaceItems, themeDuration } = this.data
    const language = wx.getStorageSync('language') || 'en'

    // 计算总时长：旁白1 + theme + 旁白2
    const preface1Duration = (prefaceItems[0] && prefaceItems[0].duration) || 5
    const actualThemeDuration = themeDuration || 3
    const preface2Duration = (prefaceItems[1] && prefaceItems[1].duration) || 5
    const totalDuration = preface1Duration + actualThemeDuration + preface2Duration

    this.setData({
      currentPhase: 1,
      currentStepText: language === 'zh' ? '题目说明' : 'Question Overview',
      currentAudioDuration: Math.ceil(totalDuration),
      showAudioTimer: true,
      currentPrefaceIndex: 0,
    })

    setTimeout(() => {
      const timer = this.selectComponent('#audioTimer')
      if (timer) timer.startTimer()
    }, 100)

    // 开始播放：旁白1 → theme → 旁白2
    this.playPreface1(() => {
      this.playTheme(() => {
        this.playPreface2(() => {
          // 旁白1+theme+旁白2全部播放完成，进入阅读阶段
          this.onPrefacePhaseComplete()
        })
      })
    })
  },

  // 播放旁白1
  playPreface1(onEnded: () => void) {
    const { prefaceItems } = this.data
    const preface1 = prefaceItems[0]

    if (!preface1 || !preface1.audio_url) {
      console.log('[Passage Retelling] No preface 1 audio, skip to theme')
      onEnded()
      return
    }

    this.playAudio(preface1.audio_url, () => {
      console.log('[Passage Retelling] Preface 1 ended')
      onEnded()
    })
  },

  // 播放 theme (使用预录音频)
  playTheme(onEnded: () => void) {
    const { theme, themeAudioUrl, themeDuration } = this.data

    if (themeAudioUrl) {
      // 更新倒计时时长
      this.setData({ currentAudioDuration: Math.ceil(themeDuration) || 5 })
      this.playAudio(themeAudioUrl, () => {
        console.log('[Passage Retelling] Theme audio ended')
        onEnded()
      })
    } else {
      // 如果没有 theme 音频，直接继续
      console.log('[Passage Retelling] Theme (no audio):', theme)
      onEnded()
    }
  },

  // 播放旁白2
  playPreface2(onEnded: () => void) {
    const { prefaceItems } = this.data
    const preface2 = prefaceItems[1]

    if (!preface2 || !preface2.audio_url) {
      console.log('[Passage Retelling] No preface 2 audio, skip')
      onEnded()
      return
    }

    this.playAudio(preface2.audio_url, () => {
      console.log('[Passage Retelling] Preface 2 ended')
      onEnded()
    })
  },

  onPrefacePhaseComplete() {
    console.log('[Passage Retelling] Preface phase complete, start reading')
    this.setData({ showAudioTimer: false })
    this.startReadingPhase()
  },

  // 阶段2：阅读时间 15秒
  startReadingPhase() {
    const language = wx.getStorageSync('language') || 'en'

    this.setData({
      currentPhase: 2,
      currentStepText: language === 'zh' ? '阅读时间' : 'Reading Time',
      showReadingTimer: true,
    })

    setTimeout(() => {
      const timer = this.selectComponent('#readingTimer')
      if (timer) timer.startTimer()
    }, 100)
  },

  onReadingTimerFinish() {
    console.log('[Passage Retelling] Reading finished, start content audio')
    this.setData({ showReadingTimer: false })
    this.startContentAudioPhase()
  },

  // 阶段3：播放短文内容录音
  startContentAudioPhase() {
    const { contentAudioUrl, contentDuration } = this.data
    const language = wx.getStorageSync('language') || 'en'

    this.setData({
      currentPhase: 3,
      currentStepText: language === 'zh' ? '短文播放' : 'Passage Audio',
      currentAudioDuration: Math.ceil(contentDuration) || 15,
      showAudioTimer: true,
    })

    setTimeout(() => {
      const timer = this.selectComponent('#audioTimer')
      if (timer) timer.startTimer()
    }, 100)

    if (!contentAudioUrl) {
      wx.showToast({ title: '短文音频不存在', icon: 'none' })
      this.onContentAudioComplete()
      return
    }

    this.playAudioTimes(contentAudioUrl, PRACTICE_RULES.retelling.passagePlayCount, () => {
      this.onContentAudioComplete()
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

  onContentAudioComplete() {
    console.log('[Passage Retelling] Content audio complete, start prepare phase')
    this.setData({ showAudioTimer: false })
    this.startPreparePhase()
  },

  // 阶段4：准备回答 15秒
  startPreparePhase() {
    const language = wx.getStorageSync('language') || 'en'

    this.setData({
      currentPhase: 4,
      currentStepText: language === 'zh' ? '准备回答' : 'Prepare to Answer',
      showPrepareTimer: true,
    })

    setTimeout(() => {
      const timer = this.selectComponent('#prepareTimer')
      if (timer) timer.startTimer()
    }, 100)
  },

  onPrepareTimerFinish() {
    console.log('[Passage Retelling] Prepare finished, start recording')
    this.setData({ showPrepareTimer: false })
    this.startRecordingPhase()
  },

  // 阶段5：开始录音
  startRecordingPhase() {
    const language = wx.getStorageSync('language') || 'en'

    this.setData({
      currentPhase: 5,
      currentStepText: language === 'zh' ? '开始录音' : 'Start Recording',
      showRecordingTimer: true,
    })

    setTimeout(async () => {
      const timer = this.selectComponent('#recordingTimer')
      await playRecordingCue('start')
      if (timer) timer.startTimer()
      this.startRecording()
    }, 100)
  },

  initRecorder() {
    const recorderManager = wx.getRecorderManager()
    recorderManager.onStart(() => {
      console.log('[Passage Retelling] Recording started')
    })
    recorderManager.onStop((res: any) => {
      this.recordingStopped = true
      console.log('[Passage Retelling] Recording stopped', res)
      this.setData({ showRecordingTimer: false })
      const { tempFilePath, duration } = res
      playRecordingCue('stop').then(() => {
        this.handleRecordingComplete(tempFilePath, Math.ceil(duration / 1000))
      })
    })
    recorderManager.onError((err: any) => {
      console.error('[Passage Retelling] Recording error:', err)
      const language = wx.getStorageSync('language') || 'en'
      wx.showToast({ title: language === 'zh' ? '录音失败' : 'Recording failed', icon: 'none' })
    })
    this.recorderManager = recorderManager
  },

  handleRecordingComplete(tempFilePath: string, duration: number) {
    if (!tempFilePath || this.data.submitting) return
    const language = wx.getStorageSync('language') || 'en'
    const studentDbId = getEnvironmentStorage('studentDbId') || 0
    this.setData({ submitting: true })
    wx.showLoading({ title: language === 'zh' ? '上传中...' : 'Uploading...', mask: true })

    uploadAudio(tempFilePath, this.data.questionId)
      .then((uploadRes: any) => {
        console.log('[Passage Retelling] Audio uploaded:', uploadRes)
        return submitAnswer(studentDbId, {
          session_id: this.data.sessionId,
          question_id: this.data.questionId,
          answers: [{ audio_url: uploadRes.audio_url, duration }],
        })
      })
      .then((submitRes: any) => {
        console.log('[Passage Retelling] Answer submitted:', submitRes)
        wx.hideLoading()
        this.setData({ submitting: false })
        wx.showToast({
          title: language === 'zh' ? '录音完成' : 'Recording completed',
          icon: 'success',
          duration: 2000,
        })
        // 复述只是第一段答案，完成两道提问后再结束 session。
        wx.redirectTo({
          url: `/pages/passage-retelling-questions/passage-retelling-questions?questionId=${this.data.questionId}&sessionId=${this.data.sessionId}&examId=${this.data.examId}`,
        })
      })
      .catch((err: any) => {
        console.error('[Passage Retelling] Error:', err)
        wx.hideLoading()
        this.setData({ submitting: false })
        wx.showModal({
          title: language === 'zh' ? '提交失败' : 'Submit failed',
          content:
            language === 'zh' ? '录音已保留，是否重新上传？' : 'Recording saved. Retry upload?',
          confirmText: language === 'zh' ? '重试' : 'Retry',
          success: res => {
            if (res.confirm) this.handleRecordingComplete(tempFilePath, duration)
          },
        })
      })
  },

  startRecording() {
    if (!this.recorderManager) {
      console.error('[Passage Retelling] RecorderManager not initialized')
      return
    }
    this.recordingStopped = false
    this.recorderManager.start({
      duration: PRACTICE_RULES.retelling.retellingRecordingSeconds * 1000,
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

  onEarlyStopRecording() {
    this.setData({ showRecordingTimer: false })
    this.stopRecording()
  },

  playAudio(audioUrl: string, onEnded?: () => void) {
    console.log('[Passage Retelling] Playing audio:', audioUrl)
    this.cleanupAudio()
    wx.showLoading({ title: '加载音频...', mask: true })
    getPresignedAudioUrl(audioUrl)
      .then((response: any) => {
        console.log('[Passage Retelling] Got presigned URL:', response.url)
        const innerAudioContext = wx.createInnerAudioContext()
        this.innerAudioContext = innerAudioContext
        innerAudioContext.src = response.url
        innerAudioContext.onCanplay(() => {
          wx.hideLoading()
        })
        innerAudioContext.onPlay(() => {
          console.log('[Passage Retelling] Audio playing')
        })
        innerAudioContext.onEnded(() => {
          console.log('[Passage Retelling] Audio ended')
          if (onEnded) onEnded()
        })
        innerAudioContext.onError((res: any) => {
          console.error('[Passage Retelling] Audio play error:', res)
          wx.hideLoading()
          const language = wx.getStorageSync('language') || 'en'
          wx.showModal({
            title: language === 'zh' ? '错误' : 'Error',
            content: language === 'zh' ? '音频播放失败' : 'Playback failed',
            showCancel: false,
            success: () => {
              wx.navigateBack()
            },
          })
        })
        innerAudioContext.play()
      })
      .catch((error: any) => {
        console.error('[Passage Retelling] Failed to get presigned URL:', error)
        wx.hideLoading()
        const language = wx.getStorageSync('language') || 'en'
        wx.showModal({
          title: language === 'zh' ? '错误' : 'Error',
          content: language === 'zh' ? '获取音频链接失败' : 'Failed to get audio URL',
          showCancel: false,
          success: () => {
            wx.navigateBack()
          },
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
  },

  onAudioTimerFinish() {
    console.log('[Passage Retelling] Audio timer finished')
    this.setData({ showAudioTimer: false })
  },

  onRecordingTimerFinish() {
    console.log('[Passage Retelling] Recording timer finished')
    this.setData({ showRecordingTimer: false })
    this.stopRecording()
  },
})
