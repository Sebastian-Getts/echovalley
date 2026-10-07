// practice-overview.ts
//
// Pre-flight summary page for a practice question. Surfaces:
//   - question type (imitation / listening / answering / retelling)
//   - estimated total time
//   - per-phase breakdown so the student knows what is going to happen
//   - whether they have already submitted (and how many sub-answers
//     were recorded) so they can decide between '开始' and '重新练习'
//
// Once the student confirms, the page redirects to the actual practice
// flow with the same questionId/sessionId the original list page would
// have used. We accept the same query string as the four practice pages
// (questionId, optional examId / sessionId for the exam flow).
import { getTranslation } from '../../utils/i18n'
import {
  PRACTICE_RULES,
  type PracticeQuestionType,
} from '../../utils/practice-rules'
import {
  getQuestionDetail,
  getOrCreateSession,
  resetSession,
} from '../../utils/api'

interface PhaseRow {
  label: string
  detail: string
}

interface PageData {
  loading: boolean
  error: string
  questionId: number
  examId: number
  sessionId: number
  typeCode: string
  typeKey: PracticeQuestionType | ''
  title: string
  totalSeconds: number
  totalText: string
  hasSubmitted: boolean
  submittedCount: number
  requiredCount: number
  phaseRows: PhaseRow[]
  startedAt: number
}

function resolveTypeKey(typeCode: string): PracticeQuestionType | '' {
  const map: Record<string, PracticeQuestionType> = {
    imitation_reading: 'imitation',
    listening_selection: 'listening',
    question_answering: 'answering',
    passage_retelling: 'retelling',
  }
  return map[typeCode] || ''
}

function computePhases(typeKey: PracticeQuestionType): {
  rows: PhaseRow[]
  totalSeconds: number
} {
  if (typeKey === 'imitation') {
    const r = PRACTICE_RULES.imitation
    const rows: PhaseRow[] = [
      { label: '旁白', detail: '固定话术 1 次' },
      { label: '短文', detail: `原文 ${r.contentPlayCount} 次播放` },
      { label: '准备', detail: `${r.preparationSeconds} 秒` },
      { label: '录音', detail: `最长 ${r.recordingSeconds} 秒` },
    ]
    return {
      rows,
      totalSeconds: 30 + r.preparationSeconds + r.recordingSeconds,
    }
  }
  if (typeKey === 'listening') {
    const r = PRACTICE_RULES.listening
    const rows: PhaseRow[] = [
      { label: '总说明', detail: '1 次播放' },
      {
        label: '3 段对话',
        detail: `每段 ${r.dialoguePlayCount} 次播放 · 阅题 ${r.readingSeconds}s · ${r.questionsPerDialogue} 个问题`,
      },
      { label: '录音', detail: `每题 ${r.recordingSeconds} 秒（共 ${r.dialogueCount * r.questionsPerDialogue} 题）` },
    ]
    const perDialogue =
      r.dialoguePlayCount * 12 + r.readingSeconds + r.questionsPerDialogue * r.recordingSeconds
    return {
      rows,
      totalSeconds: 15 + r.dialogueCount * perDialogue,
    }
  }
  if (typeKey === 'answering') {
    const r = PRACTICE_RULES.answering
    const rows: PhaseRow[] = [
      { label: '题型说明', detail: '1 次播放' },
      { label: '阅题', detail: `${r.readingSeconds} 秒` },
      { label: '短文', detail: `${r.passagePlayCount} 次播放` },
      { label: '录音', detail: `${r.questionCount} 题 × ${r.recordingSeconds} 秒` },
    ]
    return {
      rows,
      totalSeconds: 15 + r.readingSeconds + 30 + r.questionCount * r.recordingSeconds,
    }
  }
  if (typeKey === 'retelling') {
    const r = PRACTICE_RULES.retelling
    const rows: PhaseRow[] = [
      { label: '总说明 + 主题', detail: '1 次播放' },
      { label: '思维导图', detail: `${r.mindMapReadingSeconds} 秒` },
      { label: '短文', detail: `${r.passagePlayCount} 次播放` },
      {
        label: '复述录音',
        detail: `${r.preparationSeconds} 秒准备 · 最长 ${r.retellingRecordingSeconds} 秒录音`,
      },
      {
        label: '提问',
        detail: `${r.questionCount} 题 × ${r.questionPreparationSeconds}s 准备 + ${r.questionRecordingSeconds}s 录音`,
      },
    ]
    return {
      rows,
      totalSeconds:
        30 +
        r.mindMapReadingSeconds +
        30 +
        r.preparationSeconds +
        r.retellingRecordingSeconds +
        r.questionCount * (r.questionPreparationSeconds + r.questionRecordingSeconds),
    }
  }
  return { rows: [], totalSeconds: 0 }
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds} 秒`
  const minutes = Math.floor(seconds / 60)
  const rest = seconds - minutes * 60
  if (rest === 0) return `${minutes} 分钟`
  return `${minutes} 分 ${rest} 秒`
}

Page({
  data: {
    loading: true,
    error: '',
    questionId: 0,
    examId: 0,
    sessionId: 0,
    typeCode: '',
    typeKey: '',
    title: '',
    totalSeconds: 0,
    totalText: '',
    hasSubmitted: false,
    submittedCount: 0,
    requiredCount: 0,
    phaseRows: [] as PhaseRow[],
  } as PageData,

  onLoad(options: any) {
    const isLoggedIn = wx.getStorageSync('isLoggedIn')
    if (!isLoggedIn) {
      wx.redirectTo({ url: '/pages/login/login' })
      return
    }

    const questionId = options.questionId ? parseInt(options.questionId, 10) : 0
    const examId = options.examId ? parseInt(options.examId, 10) : 0
    const sessionId = options.sessionId ? parseInt(options.sessionId, 10) : 0
    const typeCode = options.typeCode ? decodeURIComponent(options.typeCode) : ''

    if (!questionId || !typeCode) {
      this.setData({ loading: false, error: '参数缺失' })
      return
    }
    this.setData({ questionId, examId, sessionId, typeCode })
    void this.bootstrap()
  },

  async bootstrap() {
    this.setData({ loading: true, error: '' })
    try {
      const detail = await getQuestionDetail(this.data.questionId)
      const typeKey = resolveTypeKey(this.data.typeCode)
      if (!typeKey) {
        this.setData({ loading: false, error: '未知题型' })
        return
      }

      const phases = computePhases(typeKey)
      const requiredCounts: Record<PracticeQuestionType, number> = {
        imitation: PRACTICE_RULES.imitation.contentPlayCount,
        listening: PRACTICE_RULES.listening.dialogueCount *
          PRACTICE_RULES.listening.questionsPerDialogue,
        answering: PRACTICE_RULES.answering.questionCount,
        retelling:
          1 + PRACTICE_RULES.retelling.questionCount, // retelling + questions
      }
      const requiredCount = requiredCounts[typeKey]

      const language = wx.getStorageSync('language') || 'en'
      const lang = getTranslation(language)
      wx.setNavigationBarTitle({
        title: (lang.practice as any)?.overviewTitle ||
          (language === 'zh' ? '答题概览' : 'Overview'),
      })

      this.setData({
        loading: false,
        typeKey,
        title: detail.title,
        phaseRows: phases.rows,
        totalSeconds: phases.totalSeconds,
        totalText: formatDuration(phases.totalSeconds),
        requiredCount,
      })

      // 读取既有 session 的提交情况，用于"开始 / 继续 / 重新练习"判断
      try {
        const session = await getOrCreateSession(this.data.questionId)
        this.setData({
          sessionId: session.session_id || this.data.sessionId,
          hasSubmitted: !!session.has_answer_record,
          submittedCount: session.answer_count || 0,
        })
      } catch (e) {
        // 拿不到 session 不影响概览展示，按"未提交"处理
        console.warn('[practice-overview] session lookup failed', e)
      }
    } catch (e: any) {
      this.setData({ loading: false, error: e?.message || '加载失败' })
    }
  },

  async onStart() {
    if (!this.data.typeKey) return

    let sessionId = this.data.sessionId
    try {
      const session = await getOrCreateSession(this.data.questionId)
      sessionId = session.session_id || sessionId
    } catch (e: any) {
      console.warn('[practice-overview] getOrCreateSession failed', e)
    }

    const targetPages: Record<PracticeQuestionType, string> = {
      imitation: '/pages/imitation-reading/imitation-reading',
      listening: '/pages/listening-selection/listening-selection',
      answering: '/pages/question-answering/question-answering',
      retelling: '/pages/passage-retelling/passage-retelling',
    }
    const targetPage = targetPages[this.data.typeKey as PracticeQuestionType]
    const params = [`questionId=${this.data.questionId}`]
    if (sessionId) params.push(`sessionId=${sessionId}`)
    if (this.data.examId) params.push(`examId=${this.data.examId}`)

    wx.redirectTo({
      url: `${targetPage}?${params.join('&')}`,
    })
  },

  async onReset() {
    const language = wx.getStorageSync('language') || 'en'
    const ok = await new Promise<boolean>(resolve => {
      wx.showModal({
        title: language === 'zh' ? '重新练习' : 'Reset progress?',
        content: language === 'zh'
          ? '将清除当前 session 的全部录音记录。是否继续？'
          : "This will erase the current session's recordings. Continue?",
        confirmText: language === 'zh' ? '重置' : 'Reset',
        cancelText: language === 'zh' ? '取消' : 'Cancel',
        success: r => resolve(!!r.confirm),
        fail: () => resolve(false),
      })
    })
    if (!ok) return
    try {
      await resetSession(this.data.questionId)
      this.setData({ hasSubmitted: false, submittedCount: 0 })
      await this.onStart()
    } catch (e: any) {
      wx.showToast({
        title: language === 'zh' ? '重置失败' : 'Reset failed',
        icon: 'none',
      })
    }
  },
})