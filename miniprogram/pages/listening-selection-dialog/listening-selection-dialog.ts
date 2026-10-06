// listening-selection-dialog.ts
import { getTranslation } from '../../utils/i18n'
import { getQuestionDetail, ApiError } from '../../utils/api'

Page({
  data: {
    questionId: 0,
    dialogIndex: 0, // 当前对话索引 (0, 1, 2)
    questionTitle: '',
    questions: [] as any[], // 问题列表
    dialogNumberText: '', // 对话编号文本（第一/第二/第三）
    questionRangeText: '', // 问题范围文本（1-2/3-4/5-6）
    totalDialogs: 3, // 总对话数量
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

    // 获取题目ID和对话索引
    const questionId = options.questionId ? parseInt(options.questionId, 10) : 0
    const dialogIndex = options.dialogIndex ? parseInt(options.dialogIndex, 10) : 0
    
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

    // 计算对话编号和问题范围文本
    const dialogNumberMap = ['第一', '第二', '第三']
    const questionRangeMap = ['1-2', '3-4', '5-6']
    const dialogNumberText = dialogNumberMap[dialogIndex] || '第一'
    const questionRangeText = questionRangeMap[dialogIndex] || '1-2'

    this.setData({
      questionId,
      dialogIndex,
      dialogNumberText,
      questionRangeText
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
      title: language === 'zh' ? '听选信息' : 'Listening Selection'
    })
  },

  loadQuestionDetail() {
    wx.showLoading({
      title: '加载中...',
      mask: true
    })

    getQuestionDetail(this.data.questionId)
      .then((question: any) => {
        console.log('[Listening Selection Dialog] Question detail:', question)
        
        // 解析 content_json
        let contentJson = question.content_json
        if (typeof contentJson === 'string') {
          try {
            contentJson = JSON.parse(contentJson)
          } catch (e) {
            console.error('[Listening Selection Dialog] Failed to parse content_json:', e)
            wx.hideLoading()
            wx.showToast({
              title: '数据格式错误',
              icon: 'none'
            })
            setTimeout(() => {
              wx.navigateBack()
            }, 2000)
            return
          }
        }

        // 听选信息题型的 content_json 格式：数组，包含3个对话对象
        if (!Array.isArray(contentJson) || contentJson.length === 0) {
          wx.hideLoading()
          wx.showToast({
            title: '题目数据格式错误',
            icon: 'none'
          })
          setTimeout(() => {
            wx.navigateBack()
          }, 2000)
          return
        }

        // 获取当前对话索引对应的数据
        const dialogIndex = this.data.dialogIndex
        if (dialogIndex >= contentJson.length) {
          wx.hideLoading()
          wx.showToast({
            title: '对话索引超出范围',
            icon: 'none'
          })
          setTimeout(() => {
            wx.navigateBack()
          }, 2000)
          return
        }

        const dialogData = contentJson[dialogIndex]
        const questions = dialogData.questions || []
        const totalDialogs = contentJson.length

        this.setData({
          questionTitle: question.title || '',
          questions,
          totalDialogs
        })

        wx.hideLoading()
      })
      .catch((error) => {
        console.error('[Listening Selection Dialog] Load question error:', error)
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
    const interval = setInterval(() => {
      this.updateTimer()
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
      // 倒计时结束，跳转到下一个对话或结束
      this.stopTimer()
      this.setData({
        timerText: '0秒',
        progressAngle: 360
      })
      
      const dialogIndex = this.data.dialogIndex
      const totalDialogs = this.data.totalDialogs
      const questionId = this.data.questionId
      
      // 如果还有下一个对话，跳转到下一个对话页面
      if (dialogIndex < totalDialogs - 1) {
        const nextDialogIndex = dialogIndex + 1
        wx.redirectTo({
          url: `/pages/listening-selection-dialog/listening-selection-dialog?questionId=${questionId}&dialogIndex=${nextDialogIndex}`
        })
      } else {
        // 所有对话都完成了
        const language = wx.getStorageSync('language') || 'en'
        wx.showToast({
          title: language === 'zh' ? '所有对话已完成' : 'All dialogues completed',
          icon: 'none'
        })
        // 可以在这里跳转到结果页面或其他页面
        setTimeout(() => {
          wx.navigateBack({
            delta: 2 // 返回两级，回到题目列表
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
