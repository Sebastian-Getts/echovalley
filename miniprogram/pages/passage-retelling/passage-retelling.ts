// passage-retelling.ts
import { getTranslation } from '../../utils/i18n'
import { getQuestionDetail, ApiError } from '../../utils/api'

Page({
  data: {
    questionId: 0,
    questionTitle: '',
    theme: '',
    example: '',
    imgUrl: '',
    isPaused: false, // false=播放中(显示⏸), true=暂停(显示▶)
    timer: 15, // 倒计时15秒
    timerText: '15秒',
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
      title: language === 'zh' ? '短文复述及提问' : 'Passage Retelling'
    })
  },

  loadQuestionDetail() {
    wx.showLoading({
      title: '加载中...',
      mask: true
    })

    getQuestionDetail(this.data.questionId)
      .then((question: any) => {
        console.log('[Passage Retelling] Question detail:', question)
        
        // 解析 content_json
        let theme = ''
        let example = ''
        let imgUrl = ''
        
        if (question.content_json) {
          // 短文复述及提问题型的 content_json 格式：
          // {
          //   "text": {
          //     "theme": "主题描述（中文）",
          //     "example": "示例文本内容（英文短文）",
          //     "img_url": "图片URL"
          //   },
          //   "questions": [...]
          // }
          if (typeof question.content_json === 'string') {
            try {
              question.content_json = JSON.parse(question.content_json)
            } catch (e) {
              console.error('[Passage Retelling] Failed to parse content_json:', e)
            }
          }
          
          if (question.content_json && question.content_json.text) {
            theme = question.content_json.text.theme || ''
            example = question.content_json.text.example || ''
            imgUrl = question.content_json.text.img_url || ''
          }
        }

        this.setData({
          questionTitle: question.title || '',
          theme: theme,
          example: example,
          imgUrl: imgUrl
        })

        wx.hideLoading()
      })
      .catch((error) => {
        console.error('[Passage Retelling] Load question error:', error)
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
      // 计算进度角度：从15秒到0秒，角度从0度到360度
      const progress = (15 - timer) / 15
      const progressAngle = progress * 360
      
      this.setData({
        timer: timer,
        timerText: `${timer}秒`,
        progressAngle: progressAngle
      })
    } else {
      // 倒计时结束，跳转到第二个页面
      this.stopTimer()
      this.setData({
        timerText: '0秒',
        progressAngle: 360
      })
      
      // 跳转到准备页面
      wx.redirectTo({
        url: `/pages/passage-retelling-prepare/passage-retelling-prepare?questionId=${this.data.questionId}`
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

