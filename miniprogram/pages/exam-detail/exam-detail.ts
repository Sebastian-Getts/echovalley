import { ApiError, ExamDetail, getExamDetail, startExamSession } from '../../utils/api'
import { openExamQuestion, saveActiveExam } from '../../utils/exam-flow'

const TYPE_LABELS: Record<number, string> = {
  1: '模仿朗读',
  2: '听选信息',
  3: '回答问题',
  4: '短文复述及提问',
}

const REQUIRED_ANSWER_COUNTS: Record<number, number> = {
  1: 1,
  2: 6,
  3: 4,
  4: 3,
}

Page({
  data: {
    examId: 0,
    exam: null as ExamDetail | null,
    questions: [] as Array<any>,
    loading: true,
    starting: false,
  },

  onLoad(options: any) {
    const examId = Number(options.examId || 0)
    if (!examId) {
      wx.showToast({ title: '试卷ID无效', icon: 'none' })
      wx.navigateBack()
      return
    }
    this.setData({ examId })
    this.loadExam()
  },

  loadExam() {
    wx.showLoading({ title: '加载试卷...', mask: true })
    getExamDetail(this.data.examId)
      .then(exam => {
        this.setData({
          exam,
          questions: exam.questions.map(item => ({
            ...item,
            typeLabel: TYPE_LABELS[item.question_type] || '未知题型',
          })),
          loading: false,
        })
      })
      .catch((error: any) => {
        const message = error instanceof ApiError ? error.message : '试卷加载失败'
        wx.showModal({ title: '无法进入考试', content: message, showCancel: false })
      })
      .finally(() => wx.hideLoading())
  },

  startExam() {
    if (!this.data.exam || this.data.starting) return
    this.setData({ starting: true })
    wx.showLoading({ title: '正在进入考试...', mask: true })
    startExamSession(this.data.examId)
      .then(session => {
        saveActiveExam({
          exam: this.data.exam as ExamDetail,
          sessionId: session.session_id,
          startedAt: Date.now(),
        })
        const firstUnanswered = (this.data.exam as ExamDetail).questions.find(
          item => (session.answer_counts[String(item.question_id)] || 0) < REQUIRED_ANSWER_COUNTS[item.question_type]
        ) || (this.data.exam as ExamDetail).questions[0]
        openExamQuestion(firstUnanswered.question_id)
      })
      .catch((error: any) => {
        const message = error instanceof ApiError ? error.message : '进入考试失败'
        wx.showModal({ title: '进入考试失败', content: message, showCancel: false })
      })
      .finally(() => {
        wx.hideLoading()
        this.setData({ starting: false })
      })
  },
})
