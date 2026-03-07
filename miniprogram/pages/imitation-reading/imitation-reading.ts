// imitation-reading.ts
import { getTranslation } from '../../utils/i18n'
import { getQuestionDetail, ApiError } from '../../utils/api'

Page({
  data: {
    questionId: 0,
    questionTitle: '',
    questionContent: '',
    isPaused: false, // false=播放中(显示⏸), true=暂停(显示▶)
    timer: 30, // 倒计时30秒
    timerText: '30秒',
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

    // 获取题目ID
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
    this.loadQuestionDetail()
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
      title: language === 'zh' ? '模仿朗读' : 'Imitation Reading'
    })
  },

  loadQuestionDetail() {
    wx.showLoading({
      title: '加载中...',
      mask: true
    })

    getQuestionDetail(this.data.questionId)
      .then((question: any) => {
        console.log('[Imitation Reading] Question detail:', question)
        
        // 解析 content_json
        let contentText = ''
        if (question.content_json) {
          // 模仿朗读题型的 content_json 格式：{"content": "...", "audio_url": "..."}
          if (typeof question.content_json === 'string') {
            try {
              question.content_json = JSON.parse(question.content_json)
            } catch (e) {
              console.error('[Imitation Reading] Failed to parse content_json:', e)
            }
          }
          if (question.content_json && question.content_json.content) {
            contentText = question.content_json.content
          }
        }

        this.setData({
          questionTitle: question.title || '',
          questionContent: contentText
        })

        wx.hideLoading()
      })
      .catch((error) => {
        console.error('[Imitation Reading] Load question error:', error)
        wx.hideLoading()

        const language = wx.getStorageSync('language') || 'en'
        let errorMessage = language === 'zh' 
          ? '加载题目失败，请稍后重试' 
          : 'Failed to load question, please try again later'

        if (error instanceof ApiError) {
          errorMessage = error.message || errorMessage
        }

        wx.showToast({
          title: errorMessage,
          icon: 'none',
          duration: 2000
        })

        setTimeout(() => {
          wx.navigateBack()
        }, 2000)
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
      // 计算进度角度：从30秒到0秒，角度从0度到360度
      const progress = (30 - timer) / 30
      const progressAngle = progress * 360
      
      this.setData({
        timer: timer,
        timerText: `${timer}秒`,
        progressAngle: progressAngle
      })
    } else {
      // 倒计时结束
      this.stopTimer()
      this.setData({
        timerText: '0秒',
        progressAngle: 360
      })
      
      const language = wx.getStorageSync('language') || 'en'
      wx.showToast({
        title: language === 'zh' ? '准备时间结束' : 'Preparation time ended',
        icon: 'none'
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

