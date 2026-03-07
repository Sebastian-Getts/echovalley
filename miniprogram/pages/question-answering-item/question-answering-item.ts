// question-answering-item.ts
import { getTranslation } from '../../utils/i18n'
import { getQuestionDetail, ApiError } from '../../utils/api'

Page({
  data: {
    questionId: 0, // 题目ID
    questionIndex: 0, // 当前题目索引（0-3）
    totalQuestions: 4, // 总题目数
    questionTitle: '',
    currentQuestion: null as any, // 当前显示的问题
    allQuestions: [] as any[], // 所有4个问题
    isPaused: false, // false=播放中(显示⏸), true=暂停(显示▶)
    timer: 3, // 倒计时3秒
    timerText: '3秒',
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

    // 获取题目ID和题目索引
    const questionId = options.questionId ? parseInt(options.questionId, 10) : 0
    const questionIndex = options.questionIndex ? parseInt(options.questionIndex, 10) : 0
    
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

    if (questionIndex < 0 || questionIndex >= 4) {
      wx.showToast({
        title: '题目索引无效',
        icon: 'none'
      })
      setTimeout(() => {
        wx.navigateBack()
      }, 1500)
      return
    }

    this.setData({
      questionId,
      questionIndex
    })

    this.loadLanguage()
    this.loadQuestion()
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
      title: language === 'zh' ? `回答问题 ${this.data.questionIndex + 1}/4` : `Question ${this.data.questionIndex + 1}/4`
    })
  },

  loadQuestion() {
    wx.showLoading({
      title: '加载中...',
      mask: true
    })

    // 获取题目详情，从 content_json.questions 中提取当前索引的问题
    getQuestionDetail(this.data.questionId)
      .then((questionDetail: any) => {
        console.log('[Question Answering Item] Question detail:', questionDetail)
        
        // 解析 content_json
        let contentJson = questionDetail.content_json
        if (typeof contentJson === 'string') {
          try {
            contentJson = JSON.parse(contentJson)
          } catch (e) {
            console.error('[Question Answering Item] Failed to parse content_json:', e)
            throw new Error('题目数据格式错误')
          }
        }
        
        // 从 content_json.questions 中提取所有问题
        if (!contentJson || !contentJson.questions || !Array.isArray(contentJson.questions)) {
          throw new Error('题目数据格式错误：缺少 questions 字段')
        }
        
        const allQuestions = contentJson.questions.slice(0, 4) // 确保只取前4个问题
        
        if (allQuestions.length <= this.data.questionIndex) {
          throw new Error('题目索引超出范围')
        }
        
        // 获取当前索引的问题
        const currentQuestion = allQuestions[this.data.questionIndex]
        
        // 格式化问题数据
        const formattedQuestion = {
          id: this.data.questionIndex + 1,
          question: currentQuestion.content || currentQuestion.question || `问题${this.data.questionIndex + 1}`,
          audio_url: currentQuestion.audio_url || ''
        }

        this.setData({
          currentQuestion: formattedQuestion,
          allQuestions: allQuestions,
          questionTitle: questionDetail.title || ''
        })

        wx.hideLoading()
      })
      .catch((error) => {
        console.error('[Question Answering Item] Load question error:', error)
        wx.hideLoading()

        const language = wx.getStorageSync('language') || 'en'
        let errorMessage = language === 'zh' 
          ? '加载题目失败，请稍后重试' 
          : 'Failed to load question, please try again later'

        if (error instanceof ApiError) {
          errorMessage = error.message || errorMessage
        } else if (error.message) {
          errorMessage = error.message
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
      // 计算进度角度：从3秒到0秒，角度从0度到360度
      const progress = (3 - timer) / 3
      const progressAngle = progress * 360
      
      this.setData({
        timer: timer,
        timerText: `${timer}秒`,
        progressAngle: progressAngle
      })
    } else {
      // 倒计时结束，跳转到下一题或返回
      this.stopTimer()
      this.setData({
        timerText: '0秒',
        progressAngle: 360
      })
      
      // 检查是否还有下一题
      const nextIndex = this.data.questionIndex + 1
      if (nextIndex < this.data.totalQuestions) {
        // 跳转到下一题
        wx.redirectTo({
          url: `/pages/question-answering-item/question-answering-item?questionId=${this.data.questionId}&questionIndex=${nextIndex}`
        })
      } else {
        // 所有题目都展示完了，返回上一页或跳转到完成页面
        const language = wx.getStorageSync('language') || 'en'
        wx.showToast({
          title: language === 'zh' ? '所有题目展示完成' : 'All questions completed',
          icon: 'success',
          duration: 2000
        })
        
        setTimeout(() => {
          // 返回到练习题目列表页面
          wx.navigateBack({
            delta: 2 // 返回2层（跳过当前页面和问题列表页面）
          })
        }, 2000)
      }
    }
  },

  onTimerToggle() {
    // 切换播放/暂停状态（目前只是UI效果，后续可以添加音频播放功能）
    this.setData({
      isPaused: !this.data.isPaused
    })
  }
})

