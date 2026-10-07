// listening-selection.ts
import { getTranslation } from '../../utils/i18n'
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
import { finishExamQuestion } from '../../utils/exam-flow'
import {
  getQuestionDetail,
  getPresignedAudioUrl,
  getOrCreateSession,
  resetSession,
  completeSession,
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
    maxScore: PRACTICE_RULES.listening.maxScore,
    // 旁白数据 (4个元素)
    prefaceItems: [] as any[],
    // 题目内容 (3段对话)
    dialogues: [] as any[],
    // 阶段控制
    currentPhase: 0, // 0=初始准备, 1-22=音频流程, 23=完成
    // 当前进度索引
    currentPrefaceIndex: 0, // 当前播放的旁白索引 (0-3)
    currentDialogIndex: 0, // 当前对话索引 (0-2)
    currentQuestionIndex: 0, // 当前问题索引 (0-1)
    // 页面展示的当前内容（旁白2/3/4内容或题目内容）
    currentContent: {} as any, // 当前展示的内容对象
    currentContentType: 'preface' as 'preface' | 'question', // 当前内容类型
    // 页面内容显示开关
    showContent: false,
    // 当前全局题号（用于显示第X题，1-6）
    currentGlobalQuestionIndex: 0,
    // UI显示
    showAudioTimer: false,
    showReadingTimer: false,
    showRecordingTimer: false,
    currentAudioDuration: 0,
    readingDuration: PRACTICE_RULES.listening.readingSeconds,
    recordingDuration: PRACTICE_RULES.listening.recordingSeconds,
    // 当前状态描述
    currentStepText: '',
    // 调试信息
    debugLog: [] as string[],
    // 已提交的子题数量
    answeredCount: 0,
    submitting: false,
    completing: false,
  },

  // 录音管理器
  recorderManager: null as any,
  // 音频播放器
  innerAudioContext: null as any,
  recordingStopped: false,

  onLoad(options: any) {
    this.initRecorder()

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
    this.cleanupRecorder()
  },

  onHide() {
    // P2-2: persist the current phase so the student can resume after
    // coming back from a phone call or backgrounding the app.
    savePhaseSnapshot(
      'listening',
      this.data.questionId,
      this.data.sessionId,
      this.data.currentPhase,
      this.data.uploadedCount || 0,
    )
    // If we were mid-recording, abort cleanly — never resume mid-recording.
    if (this.data.isRecording && this.recorderManager) {
      try {
        this.recorderManager.stop()
      } catch (e) {
        // ignore
      }
    }
  },

  onShow() {
    // P2-2: surface a resume prompt if we have a saved snapshot.
    const snapshot = loadPhaseSnapshot(
      'listening',
      this.data.questionId,
      this.data.sessionId,
    )
    if (!snapshot) return
    if (snapshot.currentPhase <= 0) return
    if (snapshot.currentPhase >= 100) return  // already completed
    const language = wx.getStorageSync('language') || 'en'
    const title = language === 'zh' ? '检测到上一次的进度' : 'Resume previous progress?'
    const content = language === 'zh'
      ? '上次进行了一半，是否继续？\n选"否"将从头开始。'
      : 'You were in the middle of a question. Continue?\nChoosing "No" restarts from the top.'
    wx.showModal({
      title,
      content,
      confirmText: language === 'zh' ? '继续' : 'Continue',
      cancelText: language === 'zh' ? '从头开始' : 'Restart',
      success: modal => {
        if (!modal.confirm) {
          clearPhaseSnapshot(
            'listening',
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
      title: language === 'zh' ? '听选信息' : 'Listening Selection',
    })
  },

  loadQuestionDetail() {
    wx.showLoading({ title: '加载中...', mask: true })

    getQuestionDetail(this.data.questionId)
      .then((question: any) => {
        console.log('[Listening Selection] Question detail:', question)

        let dialogues = question.content_json || []
        if (typeof dialogues === 'string') {
          try {
            dialogues = JSON.parse(dialogues)
          } catch (e) {
            console.error('[Listening Selection] Failed to parse content_json:', e)
          }
        }

        const prefaceItems = question.preface_items || []

        this.setData({
          questionTitle: question.title || '',
          prefaceItems,
          dialogues,
        })

        wx.hideLoading()

        const resourceChecks: any[] = [
          {
            label: `${PRACTICE_RULES.listening.dialogueCount + 1} 段固定说明音频`,
            value:
              prefaceItems.length === PRACTICE_RULES.listening.dialogueCount + 1 &&
              prefaceItems.every((item: any) => item?.audio_url),
          },
          {
            label: `${PRACTICE_RULES.listening.dialogueCount} 段对话`,
            value: dialogues.length === PRACTICE_RULES.listening.dialogueCount,
          },
        ]
        dialogues.forEach((dialogue: any, dialogIndex: number) => {
          const questions = dialogue?.questions || []
          resourceChecks.push({
            label: `第 ${dialogIndex + 1} 段对话音频`,
            value: dialogue?.text?.audio_url,
          })
          resourceChecks.push({
            label: `第 ${dialogIndex + 1} 段的 ${PRACTICE_RULES.listening.questionsPerDialogue} 个问题及音频`,
            value:
              questions.length === PRACTICE_RULES.listening.questionsPerDialogue &&
              questions.every((item: any) => item?.content && item?.audio_url),
          })
        })
        const missing = findMissingPracticeResources(resourceChecks)
        if (missing.length > 0) {
          showPracticeResourceError(missing)
          return
        }

        // 获取或创建 session
        if (this.data.examId && this.data.sessionId) {
          return { session_id: this.data.sessionId, status: 0, answer_count: 0 }
        }
        return getOrCreateSession(this.data.questionId)
      })
      .then((sessionData: any) => {
        console.log('[Listening Selection] Session:', sessionData)
        this.setData({ sessionId: sessionData.session_id })

        if (sessionData.status === 1) {
          // 已完成
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
              } else if (res.cancel) {
                wx.navigateBack()
              }
            },
          })
        } else if (sessionData.has_answer_record && sessionData.answer_count > 0) {
          // 有部分记录，统一重新开始
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
              } else if (res.cancel) {
                wx.navigateBack()
              }
            },
          })
        } else {
          // 新建 session，直接开始播放旁白1
          // 页面初始显示旁白1内容
          this.ensurePermissionAndStart()
        }
      })
      .catch((error: any) => {
        console.error('[Listening Selection] Load error:', error)
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
        console.log('[Listening Selection] Session reset:', res)
        this.setData({ sessionId: res.session_id, answeredCount: 0 })
        wx.hideLoading()
        this.ensurePermissionAndStart()
      })
      .catch((err: any) => {
        console.error('[Listening Selection] Reset error:', err)
        wx.hideLoading()
        wx.showToast({ title: '重置失败', icon: 'none' })
      })
  },

  ensurePermissionAndStart() {
    ensureRecordPermission()
      .then(() => this.startFreshFlow())
      .catch(() => wx.navigateBack())
  },

  startFreshFlow() {
    const prefaceItems = this.data.prefaceItems
    const dialogues = this.data.dialogues

    // 第一段旁白是整题说明。此时继续保留页面上的完整静态说明，
    // 避免在权限检查后立即切换两套条件渲染结构，导致文字闪现或短暂空白。
    // 等旁白结束、真正进入第一段对话阅题时，再切换到动态题目内容。
    this.setData({
      showContent: false,
      currentContent: {},
      currentContentType: 'preface',
      currentGlobalQuestionIndex: 1,
    })
    this.playPreface(0, () => {
      this.setData({
        currentContent: {
          preface: prefaceItems[1],
          questions: dialogues[0].questions || [],
          dialogIndex: 0,
        },
        currentContentType: 'preface',
      })
      this.playPreface(1, () => {
        this.setData({
          currentContent: {
            questions: dialogues[0].questions || [],
            title_content: prefaceItems[1].title_content || '',
          },
          currentContentType: 'question',
        })
        this.startReading(0)
      })
    })
  },

  // 根据已回答数量恢复进度
  // 听选信息：dialogIndex = answeredCount / 2，questionIndex = answeredCount % 2
  resumeFromProgress(answeredCount: number) {
    const dialogIndex = Math.floor(answeredCount / 2)
    const questionIndex = answeredCount % 2

    this.setData({
      currentDialogIndex: dialogIndex,
      currentQuestionIndex: questionIndex,
      answeredCount,
    })

    // 跳到对应位置播放问题音频，然后开始录音
    this.jumpToQuestion(dialogIndex, questionIndex)
  },

  // 跳到指定位置播放问题音频并录音
  jumpToQuestion(dialogIndex: number, questionIndex: number) {
    const dialogues = this.data.dialogues
    const prefaceItems = this.data.prefaceItems

    if (dialogIndex >= dialogues.length) {
      this.onAllCompleted()
      return
    }

    // 更新当前旁白索引（用于显示）
    const prefaceIndex = dialogIndex + 1 // 当前对话对应的旁白索引

    const questions = dialogues[dialogIndex].questions || []
    if (questionIndex >= questions.length) {
      // 本对话问题已答完，进入下一段对话
      const nextDialogIndex = dialogIndex + 1
      if (nextDialogIndex < dialogues.length) {
        // 播放下一段对话旁白
        const nextPrefaceIndex = dialogIndex + 2 // 0->2(旁白3), 1->3(旁白4)
        this.setData({ currentPrefaceIndex: nextPrefaceIndex })
        this.playPreface(nextPrefaceIndex, () => {
          this.setData({ currentDialogIndex: nextDialogIndex, currentQuestionIndex: 0 })
          this.startReading(nextDialogIndex)
        })
      } else {
        this.onAllCompleted()
      }
      return
    }

    // 显示当前题目内容（questionIndex=0显示两题，questionIndex=1只显示第二题）
    // questionIndex=0 -> global 1,2; questionIndex=1 -> global 3,4 或 5,6
    const globalBase = dialogIndex * 2 + 1
    if (questionIndex === 0) {
      this.setData({
        showContent: true,
        currentContent: {
          preface: prefaceItems[prefaceIndex],
          questions: questions,
          dialogIndex: dialogIndex,
        },
        currentContentType: 'preface',
        currentGlobalQuestionIndex: globalBase,
      })
    } else {
      this.setData({
        showContent: true,
        currentContent: {
          questions: questions,
          title_content: prefaceItems[prefaceIndex].title_content || '',
        },
        currentContentType: 'question',
        currentGlobalQuestionIndex: globalBase,
      })
    }

    this.setData({
      currentDialogIndex: dialogIndex,
      currentQuestionIndex: questionIndex,
      currentPrefaceIndex: prefaceIndex,
      currentPhase: 30 + dialogIndex * 4 + questionIndex,
      currentStepText: '正在播放信息',
      currentAudioDuration: questions[questionIndex].duration || 5,
      showAudioTimer: true,
    })

    setTimeout(() => {
      const timer = this.selectComponent('#audioTimer')
      if (timer) timer.startTimer()
    }, 100)

    const questionAudioUrl = questions[questionIndex].audio_url
    if (!questionAudioUrl) {
      this.setData({ showAudioTimer: false })
      this.startRecording()
    } else {
      this.playAudio(questionAudioUrl, () => {
        this.setData({ showAudioTimer: false })
        this.startRecording()
      })
    }
  },

  playPreface(index: number, onEnded: () => void) {
    const prefaceItems = this.data.prefaceItems
    if (index >= prefaceItems.length) {
      console.error('[Listening Selection] Preface index out of range:', index)
      onEnded()
      return
    }

    const item = prefaceItems[index]
    const audioUrl = item.audio_url

    this.setData({
      currentPhase: index + 1,
      currentStepText: '正在播放信息',
      currentAudioDuration: item.duration || 5,
      showAudioTimer: true,
    })

    setTimeout(() => {
      const timer = this.selectComponent('#audioTimer')
      if (timer) timer.startTimer()
    }, 100)

    this.addDebugLog(`播放旁白${index + 1}，时长${item.duration || 5}s`)

    if (!audioUrl) {
      this.setData({ showAudioTimer: false })
      onEnded()
      return
    }

    this.playAudio(audioUrl, () => {
      this.setData({ showAudioTimer: false })
      onEnded()
    })
  },

  startReading(dialogIndex: number) {
    console.log('[Listening Selection] Start reading, dialog:', dialogIndex)
    this.addDebugLog(`阅题时间（10秒），对话${dialogIndex + 1}`)

    this.setData({
      currentPhase: 10 + dialogIndex * 4,
      currentDialogIndex: dialogIndex,
      currentQuestionIndex: 0,
      currentStepText: '阅题',
      showReadingTimer: true,
    })

    setTimeout(() => {
      const timer = this.selectComponent('#readingTimer')
      if (timer) timer.startTimer()
    }, 100)
  },

  onReadingFinish() {
    const dialogIndex = this.data.currentDialogIndex
    console.log('[Listening Selection] Reading finished, playing dialog:', dialogIndex)
    this.addDebugLog(`阅题完成，播放对话${dialogIndex + 1}`)

    const dialogues = this.data.dialogues
    if (dialogIndex >= dialogues.length) {
      this.onAllCompleted()
      return
    }

    const dialogData = dialogues[dialogIndex]
    const dialogAudioUrl = dialogData.text?.audio_url

    if (!dialogAudioUrl) {
      wx.showModal({
        title: '题目资源不完整',
        content: '当前对话音频不存在，请联系管理员。',
        showCancel: false,
        success: () => wx.navigateBack(),
      })
      return
    }

    this.setData({
      currentPhase: 20 + dialogIndex * 4,
      currentStepText: '正在播放信息',
      currentAudioDuration:
        (dialogData.text?.duration || 5) * PRACTICE_RULES.listening.dialoguePlayCount,
      showAudioTimer: true,
    })

    setTimeout(() => {
      const timer = this.selectComponent('#audioTimer')
      if (timer) timer.startTimer()
    }, 100)

    this.playAudioTimes(dialogAudioUrl, PRACTICE_RULES.listening.dialoguePlayCount, () => {
      this.setData({ showAudioTimer: false, currentQuestionIndex: 0 })
      this.playQuestionAudio(0)
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

  jumpToQuestionAnswering(dialogIndex: number, subIndex: number) {
    const prefaceItems = this.data.prefaceItems
    const titleContent = prefaceItems[dialogIndex + 1]?.title_content || ''
    wx.redirectTo({
      url: `/pages/question-answering-item/question-answering-item?questionId=${this.data.questionId}&dialogueIndex=${dialogIndex}&subIndex=${subIndex}&titleContent=${encodeURIComponent(titleContent)}&sessionId=${this.data.sessionId}`,
    })
  },

  playQuestionAudio(questionIndex: number) {
    const dialogIndex = this.data.currentDialogIndex
    const dialogues = this.data.dialogues

    if (dialogIndex >= dialogues.length) {
      this.onAllCompleted()
      return
    }

    const questions = dialogues[dialogIndex].questions || []
    if (questionIndex >= questions.length) {
      if (dialogIndex < dialogues.length - 1) {
        const nextPrefaceIndex = dialogIndex + 2
        this.playPreface(nextPrefaceIndex, () => {
          this.startReading(dialogIndex + 1)
        })
      } else {
        this.onAllCompleted()
      }
      return
    }

    const question = questions[questionIndex]
    const questionAudioUrl = question.audio_url

    this.setData({
      currentPhase: 30 + dialogIndex * 4 + questionIndex,
      currentQuestionIndex: questionIndex,
      currentStepText: '正在播放信息',
      currentAudioDuration: question.duration || 5,
      showAudioTimer: true,
    })

    setTimeout(() => {
      const timer = this.selectComponent('#audioTimer')
      if (timer) timer.startTimer()
    }, 100)

    this.addDebugLog(`播放问题${dialogIndex * 2 + questionIndex + 1}: ${questionAudioUrl}`)

    if (!questionAudioUrl) {
      this.setData({ showAudioTimer: false })
      this.startRecording()
      return
    }

    this.playAudio(questionAudioUrl, () => {
      this.setData({ showAudioTimer: false })
      this.startRecording()
    })
  },

  startRecording() {
    console.log('[Listening Selection] Start recording')
    this.addDebugLog(`开始录音`)

    this.setData({
      currentPhase: 100,
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

  onRecordingFinish() {
    const dialogIndex = this.data.currentDialogIndex
    const questionIndex = this.data.currentQuestionIndex

    console.log(
      '[Listening Selection] Recording finished, dialog:',
      dialogIndex,
      'question:',
      questionIndex
    )
    this.addDebugLog(`录音完成`)

    const dialogues = this.data.dialogues
    const newAnsweredCount = this.data.answeredCount + 1
    this.setData({ answeredCount: newAnsweredCount })

    if (questionIndex === 0) {
      // 第一题完成，显示第二题内容，播放第二题
      const prefaceItems = this.data.prefaceItems
      this.setData({
        currentQuestionIndex: 1,
        showContent: true,
        currentContent: {
          questions: dialogues[dialogIndex].questions || [],
          title_content: prefaceItems[dialogIndex + 1].title_content || '',
        },
        currentContentType: 'question',
        currentGlobalQuestionIndex: dialogIndex * 2 + 2,
      })
      this.playQuestionAudio(1)
    } else if (questionIndex === 1) {
      // 第二题完成，判断是否有下一段对话
      if (dialogIndex < dialogues.length - 1) {
        const nextDialogIndex = dialogIndex + 1
        const nextPrefaceIndex = dialogIndex + 2
        const prefaceItems = this.data.prefaceItems
        // 显示下一段旁白内容+题目
        this.setData({
          showContent: true,
          currentContent: {
            preface: prefaceItems[nextPrefaceIndex],
            questions: dialogues[nextDialogIndex].questions || [],
            dialogIndex: nextDialogIndex,
          },
          currentContentType: 'preface',
          currentGlobalQuestionIndex: nextDialogIndex * 2 + 1,
        })
        this.playPreface(nextPrefaceIndex, () => {
          this.startReading(nextDialogIndex)
        })
      } else {
        this.onAllCompleted()
      }
    }
  },

  onAllCompleted() {
    const totalQuestions =
      PRACTICE_RULES.listening.dialogueCount * PRACTICE_RULES.listening.questionsPerDialogue
    if (this.data.completing || this.data.answeredCount < totalQuestions) return
    this.setData({ completing: true })
    console.log('[Listening Selection] All completed!')
    this.addDebugLog('全部完成')

    this.cleanupAudio()
    this.cleanupRecorder()

    const language = wx.getStorageSync('language') || 'en'
    wx.showToast({
      title: language === 'zh' ? '练习完成' : 'Practice completed',
      icon: 'success',
      duration: 2000,
    })

    // P2-2: question is fully submitted; no need to offer resume.
    clearPhaseSnapshot(
      'listening',
      this.data.questionId,
      this.data.sessionId,
    )

    // 标记 session 完成
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

  handleRecordingComplete(tempFilePath: string, duration: number) {
    if (!tempFilePath || this.data.submitting || this.data.completing) return
    const language = wx.getStorageSync('language') || 'en'
    this.setData({ submitting: true })
    wx.showLoading({ title: language === 'zh' ? '上传中...' : 'Uploading...', mask: true })

    uploadAudio(tempFilePath, this.data.questionId)
      .then((uploadRes: any) => {
        console.log('[Listening Selection] Audio uploaded:', uploadRes)
        const studentDbId = wx.getStorageSync('studentDbId') || 0
        return submitAnswer(studentDbId, {
          session_id: this.data.sessionId,
          question_id: this.data.questionId,
          answers: [{ audio_url: uploadRes.audio_url, duration }],
        })
      })
      .then((submitRes: any) => {
        console.log('[Listening Selection] Answer submitted:', submitRes)
        wx.hideLoading()
        this.setData({ submitting: false })
        const language = wx.getStorageSync('language') || 'en'
        wx.showToast({
          title: language === 'zh' ? '已保存' : 'Saved',
          icon: 'none',
          duration: 1000,
        })
        // 继续下一题
        this.onRecordingFinish()
      })
      .catch((err: any) => {
        console.error('[Listening Selection] Submit error:', err)
        wx.hideLoading()
        this.setData({ submitting: false })
        const language = wx.getStorageSync('language') || 'en'
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

  initRecorder() {
    const recorderManager = wx.getRecorderManager()

    recorderManager.onStart(() => {
      console.log('[Listening Selection] Recording started')
    })

    recorderManager.onStop((res: any) => {
      this.recordingStopped = true
      console.log('[Listening Selection] Recording stopped', res)
      this.setData({ showRecordingTimer: false })
      const { tempFilePath, duration } = res
      playRecordingCue('stop').then(() => {
        this.handleRecordingComplete(tempFilePath, Math.ceil(duration / 1000))
      })
    })

    recorderManager.onError((err: any) => {
      console.error('[Listening Selection] Recording error:', err)
      const language = wx.getStorageSync('language') || 'en'
      wx.showToast({ title: language === 'zh' ? '录音失败' : 'Recording failed', icon: 'none' })
    })

    this.recorderManager = recorderManager
  },

  startRecordAudio() {
    if (!this.recorderManager) {
      console.error('[Listening Selection] RecorderManager not initialized')
      return
    }

    this.recordingStopped = false
    this.recorderManager.start({
      duration: PRACTICE_RULES.listening.recordingSeconds * 1000,
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
    console.log('[Listening Selection] Playing audio:', audioUrl)
    this.cleanupAudio()
    wx.showLoading({ title: '加载音频...', mask: true })
    getPresignedAudioUrl(audioUrl)
      .then((response: any) => {
        console.log('[Listening Selection] Got presigned URL:', response.url)
        const innerAudioContext = wx.createInnerAudioContext()
        this.innerAudioContext = innerAudioContext
        innerAudioContext.src = response.url
        innerAudioContext.onCanplay(() => {
          wx.hideLoading()
        })
        innerAudioContext.onPlay(() => {
          console.log('[Listening Selection] Audio playing')
        })
        innerAudioContext.onEnded(() => {
          console.log('[Listening Selection] Audio ended')
          if (onEnded) onEnded()
        })
        innerAudioContext.onError((res: any) => {
          console.error('[Listening Selection] Audio play error:', res)
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
        console.error('[Listening Selection] Failed to get presigned URL:', error)
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

  addDebugLog(message: string) {
    const logs = this.data.debugLog || []
    const timestamp = new Date().toLocaleTimeString()
    logs.push(`[${timestamp}] ${message}`)
    if (logs.length > 20) logs.shift()
    this.setData({ debugLog: logs })
    console.log('[Listening Selection Debug]', message)
  },

  onAudioTimerFinish() {
    console.log('[Listening Selection] Audio timer finished')
    this.setData({ showAudioTimer: false })
  },

  onReadingTimerFinish() {
    console.log('[Listening Selection] Reading timer finished')
    this.setData({ showReadingTimer: false })
    this.onReadingFinish()
  },

  onRecordingTimerFinish() {
    console.log('[Listening Selection] Recording timer finished')
    this.setData({ showRecordingTimer: false })
    this.stopRecording()
    // 注意：不在这里调用 onRecordingFinish，而是等 handleRecordingComplete 成功后调用
  },
})
