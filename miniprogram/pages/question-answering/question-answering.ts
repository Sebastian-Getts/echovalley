// question-answering.ts
import { getTranslation } from '../../utils/i18n'
import { getPracticeQuestions, getQuestionDetail, ApiError } from '../../utils/api'

Page({
  data: {
    questionId: 0, // 主题目ID
    questionTitle: '',
    questions: [] as any[], // 四个问题（从当前题目的 content_json.questions 中获取）
    isPaused: false, // false=播放中(显示⏸), true=暂停(显示▶)
    timer: 10, // 倒计时10秒
    timerText: '10秒',
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
    this.loadQuestions()
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
      title: language === 'zh' ? '回答问题' : 'Question Answering'
    })
  },

  loadQuestions() {
    wx.showLoading({
      title: '加载中...',
      mask: true
    })

    // 获取当前题目详情，从 content_json.questions 中提取4个问题
    getQuestionDetail(this.data.questionId)
      .then((questionDetail: any) => {
        console.log('[Question Answering] Question detail:', questionDetail)
        
        // 解析 content_json
        let contentJson = questionDetail.content_json
        if (typeof contentJson === 'string') {
          try {
            contentJson = JSON.parse(contentJson)
          } catch (e) {
            console.error('[Question Answering] Failed to parse content_json:', e)
            throw new Error('题目数据格式错误')
          }
        }
        
        // 从 content_json.questions 中提取4个问题
        // 根据数据库结构，question_type=3 的 content_json 格式：
        // {
        //   "text": {...},
        //   "questions": [
        //     {"content": "问题1", "audio_url": "..."},
        //     {"content": "问题2", "audio_url": "..."},
        //     {"content": "问题3", "audio_url": "..."},
        //     {"content": "问题4", "audio_url": "..."}
        //   ]
        // }
        if (!contentJson || !contentJson.questions || !Array.isArray(contentJson.questions)) {
          throw new Error('题目数据格式错误：缺少 questions 字段')
        }
        
        const questions = contentJson.questions.slice(0, 4) // 确保只取前4个问题
        
        if (questions.length < 4) {
          console.warn('[Question Answering] 题目中的问题数量少于4个:', questions.length)
        }
        
        // 格式化问题数据
        const formattedQuestions = questions.map((q: any, index: number) => {
          return {
            id: index + 1, // 使用索引作为ID
            question: q.content || q.question || `问题${index + 1}`, // 优先使用 content 字段
            audio_url: q.audio_url || ''
          }
        })

        this.setData({
          questions: formattedQuestions,
          questionTitle: questionDetail.title || ''
        })

        wx.hideLoading()
      })
      .catch((error) => {
        console.error('[Question Answering] Load questions error:', error)
        wx.hideLoading()

        const language = wx.getStorageSync('language') || 'en'
        let errorMessage = language === 'zh' 
          ? '加载题目失败，请稍后重试' 
          : 'Failed to load questions, please try again later'

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
      // 计算进度角度：从10秒到0秒，角度从0度到360度
      const progress = (10 - timer) / 10
      const progressAngle = progress * 360
      
      this.setData({
        timer: timer,
        timerText: `${timer}秒`,
        progressAngle: progressAngle
      })
    } else {
      // 倒计时结束，跳转到第一题
      this.stopTimer()
      this.setData({
        timerText: '0秒',
        progressAngle: 360
      })
      
      // 跳转到第一题展示页面
      wx.redirectTo({
        url: `/pages/question-answering-item/question-answering-item?questionId=${this.data.questionId}&questionIndex=0`
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

