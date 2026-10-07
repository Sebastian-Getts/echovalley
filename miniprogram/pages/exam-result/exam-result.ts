// exam-result.ts
import { getTranslation } from '../../utils/i18n'
import { clearActiveExam } from '../../utils/exam-flow'
import { getExamResult } from '../../utils/api'

interface PageData {
  loading: boolean
  error: string
  title: string
  paperName: string
  gradingStatus: number
  isReleased: boolean
  totalScore: number | null
  paperTotalScore: number
  overallFeedback: string
  releasedAt: string
  submittedAt: string
  statusLabel: string
  lang: Record<string, string>
}

const STATUS_LABELS_ZH: Record<number, string> = {
  0: '已提交，等待评分',
  1: '教师评分中',
  2: '评分完成，等待发布',
  3: '已发布',
  4: '评分已撤回',
}

const STATUS_LABELS_EN: Record<number, string> = {
  0: 'Submitted, waiting for grading',
  1: 'Teacher is grading',
  2: 'Graded, waiting for release',
  3: 'Released',
  4: 'Grade withdrawn',
}

Page({
  data: {
    loading: true,
    error: '',
    title: '',
    paperName: '',
    gradingStatus: 0,
    isReleased: false,
    totalScore: null,
    paperTotalScore: 0,
    overallFeedback: '',
    releasedAt: '',
    submittedAt: '',
    statusLabel: '',
    lang: {},
  } as PageData,

  onLoad(query: Record<string, string>) {
    const lang = getTranslation(wx.getStorageSync('language') || 'en')
    this.setData({ lang: lang.exam })

    const examId = Number(query.examId || 0)
    if (!examId) {
      this.setData({ loading: false, error: lang.exam.examInfoMissing })
      clearActiveExam()
      return
    }

    getExamResult(examId)
      .then((res) => {
        const statusLabels =
          (wx.getStorageSync('language') || 'en') === 'zh'
            ? STATUS_LABELS_ZH
            : STATUS_LABELS_EN
        this.setData({
          loading: false,
          title: res.paper_name || '',
          paperName: res.paper_name || '',
          gradingStatus: res.grading_status,
          isReleased: res.is_released,
          totalScore: res.total_score,
          paperTotalScore: res.paper_total_score,
          overallFeedback: res.overall_feedback || '',
          releasedAt: res.released_at || '',
          submittedAt: res.submitted_at || '',
          statusLabel: statusLabels[res.grading_status] || '—',
        })
        if (res.grading_status === 3) {
          wx.setNavigationBarTitle({
            title: (lang.exam as Record<string, unknown>).resultReleased as string,
          })
        } else {
          wx.setNavigationBarTitle({
            title: (lang.exam as Record<string, unknown>).resultSubmitted as string,
          })
        }
      })
      .catch((err) => {
        console.error('Load exam result error:', err)
        this.setData({
          loading: false,
          error: (lang.exam as Record<string, unknown>).resultLoadFailed as string,
        })
      })
      .finally(() => {
        clearActiveExam()
      })
  },

  onRefresh() {
    const pages = getCurrentPages()
    const current = pages[pages.length - 1]
    const examId = (current.options as Record<string, string>).examId
    if (!examId) return
    this.setData({ loading: true, error: '' })
    getExamResult(Number(examId))
      .then((res) => {
        const statusLabels =
          (wx.getStorageSync('language') || 'en') === 'zh'
            ? STATUS_LABELS_ZH
            : STATUS_LABELS_EN
        this.setData({
          loading: false,
          gradingStatus: res.grading_status,
          isReleased: res.is_released,
          totalScore: res.total_score,
          paperTotalScore: res.paper_total_score,
          overallFeedback: res.overall_feedback || '',
          releasedAt: res.released_at || '',
          submittedAt: res.submitted_at || '',
          statusLabel: statusLabels[res.grading_status] || '—',
        })
      })
      .catch((err) => {
        console.error('Refresh exam result error:', err)
        this.setData({ loading: false, error: '刷新失败，请稍后重试' })
      })
  },

  backToExamList() {
    wx.switchTab({ url: '/pages/exam/exam' })
  },
})