import { clearActiveExam, getActiveExam } from '../../utils/exam-flow'

Page({
  data: {
    title: '考试已提交',
    totalScore: 0,
  },

  onLoad() {
    const flow = getActiveExam()
    if (flow) {
      this.setData({ title: flow.exam.title, totalScore: flow.exam.total_score })
    }
    clearActiveExam()
  },

  backToExamList() {
    wx.switchTab({ url: '/pages/exam/exam' })
  },
})
