import { completeExamSession, ExamDetail } from './api'

const ACTIVE_EXAM_KEY = 'activeExamFlow'

export interface ActiveExamFlow {
  exam: ExamDetail
  sessionId: number
  startedAt: number
}

export function saveActiveExam(flow: ActiveExamFlow): void {
  wx.setStorageSync(ACTIVE_EXAM_KEY, flow)
}

export function getActiveExam(): ActiveExamFlow | null {
  return wx.getStorageSync(ACTIVE_EXAM_KEY) || null
}

export function clearActiveExam(): void {
  wx.removeStorageSync(ACTIVE_EXAM_KEY)
}

export function questionPage(questionType: number): string {
  const pages: Record<number, string> = {
    1: '/pages/imitation-reading/imitation-reading',
    2: '/pages/listening-selection/listening-selection',
    3: '/pages/question-answering/question-answering',
    4: '/pages/passage-retelling/passage-retelling',
  }
  return pages[questionType] || ''
}

export function openExamQuestion(questionId: number): void {
  const flow = getActiveExam()
  if (!flow) {
    wx.showToast({ title: '考试信息已失效，请重新进入', icon: 'none' })
    wx.switchTab({ url: '/pages/exam/exam' })
    return
  }
  const item = flow.exam.questions.find(question => question.question_id === questionId)
  const page = item ? questionPage(item.question_type) : ''
  if (!page) {
    wx.showToast({ title: '试卷题目配置错误', icon: 'none' })
    return
  }
  wx.redirectTo({
    url: `${page}?questionId=${questionId}&examId=${flow.exam.id}&sessionId=${flow.sessionId}`,
  })
}

export function finishExamQuestion(questionId: number): Promise<void> {
  const flow = getActiveExam()
  if (!flow) return Promise.reject(new Error('active exam not found'))
  const currentIndex = flow.exam.questions.findIndex(item => item.question_id === questionId)
  if (currentIndex < 0) return Promise.reject(new Error('exam question not found'))

  const nextQuestion = flow.exam.questions[currentIndex + 1]
  if (nextQuestion) {
    openExamQuestion(nextQuestion.question_id)
    return Promise.resolve()
  }

  return completeExamSession(flow.exam.id, flow.sessionId).then(() => {
    wx.redirectTo({
      url: `/pages/exam-result/exam-result?examId=${flow.exam.id}&sessionId=${flow.sessionId}`,
    })
  })
}
