// listening-selection.ts
import { getTranslation } from '../../utils/i18n'

Page({
  data: {
    questionId: 0,
    questionTitle: '',
    isPaused: false, // false=播放中(显示⏸), true=暂停(显示▶)
    timer: 5, // 倒计时5秒
    timerText: '5秒',
    progressAngle: 0, // 进度条旋转角度 (0-360度)
    timerInterval: null as any
  },

  onLoad(options: any) {
    // 检查登录状态
    const isLoggedIn = wx.getStorageSync('isLoggedIn')
    if (!isLoggedIn) {
      wx.redirectTo({
        url: '/pages/login/login'
      })
      return
    }

    // 获取题目ID（必须）
    const questionId = options.questionId ? parseInt(options.questionId, 10) : 0
    if (!questionId) {
      wx.showToast({
        title: '题目ID无效',
        icon: 'none'
      })
      setTimeout(() => {
        wx.navigateBack()
      }, 1500)
      return
    }

    this.setData({
      questionId
    })

    this.loadLanguage()
    this.startTimer()
  },

  onUnload() {
    // 清除定时器
    this.stopTimer()
  },

  loadLanguage() {
    const language = wx.getStorageSync('language') || 'en'
    const lang = getTranslation(language)
    
    // 动态设置导航栏标题
    wx.setNavigationBarTitle({
      title: language === 'zh' ? '听选信息' : 'Listening Selection'
    })
  },

  startTimer() {
    // 设置定时器，每秒更新一次
    const that = this
    const interval = setInterval(() => {
      that.updateTimer()
    }, 1000)
    
    this.setData({
      timerInterval: interval
    })
    // 立即更新一次，开始倒计时
    this.updateTimer()
  },

  stopTimer() {
    if (this.data.timerInterval) {
      clearInterval(this.data.timerInterval)
      this.setData({
        timerInterval: null
      })
    }
  },

  updateTimer() {
    if (this.data.isPaused) {
      return // 如果暂停，不更新计时
    }
    
    let timer = this.data.timer
    if (timer > 0) {
      timer--
      // 计算进度角度：从5秒到0秒，角度从0度到360度
      const progress = (5 - timer) / 5
      const progressAngle = progress * 360
      
      this.setData({
        timer: timer,
        timerText: `${timer}秒`,
        progressAngle: progressAngle
      })
    } else {
      // 倒计时结束，跳转到对话页面
      this.stopTimer()
      this.setData({
        timerText: '0秒',
        progressAngle: 360
      })
      
      // 跳转到对话页面，传递题目ID
      wx.redirectTo({
        url: `/pages/listening-selection-dialog/listening-selection-dialog?questionId=${this.data.questionId}&dialogIndex=0`
      })
    }
  },

  onTimerToggle() {
    // 切换播放/暂停状态（目前只是UI效果，后续可以添加音频播放功能）
    this.setData({
      isPaused: !this.data.isPaused
    })
  }
})

