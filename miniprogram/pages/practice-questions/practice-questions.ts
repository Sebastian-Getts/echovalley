// practice-questions.ts
import { getTranslation } from '../../utils/i18n'
import { getPracticeQuestions, ApiError } from '../../utils/api'

Page({
  data: {
    questions: [] as any[],
    loading: false,
    searchKeyword: '',
    moduleTitle: '',
    moduleId: 0,
    lang: {} as any,
    searchTimer: null as any // 用于防抖搜索
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

    // 获取传递的参数
    const moduleId = options.moduleId ? parseInt(options.moduleId, 10) : 0
    const moduleTitle = options.moduleTitle ? decodeURIComponent(options.moduleTitle) : '练习题目'

    this.setData({
      moduleId,
      moduleTitle
    })

    this.loadLanguage()
    this.loadQuestions()
  },

  onShow() {
    this.loadLanguage()
  },

  onUnload() {
    // 清除定时器
    if (this.data.searchTimer) {
      clearTimeout(this.data.searchTimer)
    }
  },

  loadLanguage() {
    const language = wx.getStorageSync('language') || 'en'
    const lang = getTranslation(language)
    
    this.setData({
      lang: lang.practice
    })
    
    // 动态设置导航栏标题
    wx.setNavigationBarTitle({
      title: this.data.moduleTitle || lang.practice.title
    })
  },

  loadQuestions() {
    if (this.data.loading) return

    this.setData({ loading: true })

    const language = wx.getStorageSync('language') || 'en'
    const loadingText = this.data.lang.loading || (language === 'zh' ? '加载中...' : 'Loading...')
    wx.showLoading({
      title: loadingText,
      mask: true
    })

    const params: any = {
      question_type_id: this.data.moduleId,
      limit: 100 // 加载更多题目
    }

    if (this.data.searchKeyword.trim()) {
      params.search = this.data.searchKeyword.trim()
    }

    getPracticeQuestions(params)
      .then((questions) => {
        // 格式化题目数据，优化难度显示
        const formattedQuestions = questions.map((q: any) => ({
          ...q,
          difficultyText: this.formatDifficulty(q.difficulty),
          typeText: this.formatType(q.type)
        }))
        
        this.setData({
          questions: formattedQuestions,
          loading: false
        })
        wx.hideLoading()
      })
      .catch((error) => {
        console.error('Load questions error:', error)
        wx.hideLoading()
        this.setData({ loading: false })

        const language = wx.getStorageSync('language') || 'en'
        let errorMessage = language === 'zh' 
          ? '加载题目失败，请稍后重试' 
          : 'Failed to load questions, please try again later'

        if (error instanceof ApiError) {
          errorMessage = error.message || errorMessage
        }

        wx.showToast({
          title: errorMessage,
          icon: 'none',
          duration: 2000
        })

        this.setData({
          questions: []
        })
      })
  },

  onSearchInput(e: any) {
    const keyword = e.detail.value
    this.setData({
      searchKeyword: keyword
    })

    // 清除之前的定时器
    if (this.data.searchTimer) {
      clearTimeout(this.data.searchTimer)
    }

    // 如果搜索框为空，立即搜索
    if (!keyword.trim()) {
      this.loadQuestions()
      return
    }

    // 防抖：500ms 后执行搜索
    const timer = setTimeout(() => {
      this.loadQuestions()
    }, 500)
    
    this.setData({
      searchTimer: timer
    })
  },

  onSearchConfirm() {
    // 清除定时器，立即搜索
    if (this.data.searchTimer) {
      clearTimeout(this.data.searchTimer)
      this.setData({ searchTimer: null })
    }
    this.loadQuestions()
  },

  onSearchClear() {
    // 清除定时器
    if (this.data.searchTimer) {
      clearTimeout(this.data.searchTimer)
      this.setData({ searchTimer: null })
    }
    
    this.setData({
      searchKeyword: ''
    })
    this.loadQuestions()
  },

  formatDifficulty(difficulty: number): string {
    const language = wx.getStorageSync('language') || 'en'
    if (language === 'zh') {
      if (difficulty < 0.3) return '简单'
      if (difficulty < 0.6) return '中等'
      if (difficulty < 0.8) return '较难'
      return '困难'
    } else {
      if (difficulty < 0.3) return 'Easy'
      if (difficulty < 0.6) return 'Medium'
      if (difficulty < 0.8) return 'Hard'
      return 'Very Hard'
    }
  },

  formatType(type: string): string {
    const language = wx.getStorageSync('language') || 'en'
    const typeMap: Record<string, { zh: string; en: string }> = {
      'imitation': { zh: '模仿朗读', en: 'Imitation' },
      'listening': { zh: '听选信息', en: 'Listening' },
      'answering': { zh: '回答问题', en: 'Q&A' },
      'retelling': { zh: '短文复述', en: 'Retelling' },
      'exam': { zh: '综合测试', en: 'Exam' }
    }
    const typeInfo = typeMap[type]
    if (typeInfo) {
      return language === 'zh' ? typeInfo.zh : typeInfo.en
    }
    return type
  },

  onQuestionTap(e: any) {
    const questionId = e.currentTarget.dataset.id
    const question = this.data.questions.find(q => q.id === questionId)
    
    if (question) {
      const language = wx.getStorageSync('language') || 'en'
      const enterText = language === 'zh' ? '进入' : 'Enter'
      wx.showToast({
        title: `${enterText} ${question.title}`,
        icon: 'none'
      })
      // TODO: 这里后续可以跳转到具体的答题页面
      // wx.navigateTo({
      //   url: `/pages/question-detail/question-detail?questionId=${questionId}`
      // })
    }
  }
})

