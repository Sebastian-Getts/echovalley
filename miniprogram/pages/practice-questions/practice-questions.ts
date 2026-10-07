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
    typeCode: '', // 模块类型代码，用于跳转判断
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
    const typeCode = options.typeCode ? decodeURIComponent(options.typeCode) : ''

    this.setData({
      moduleId,
      moduleTitle,
      typeCode
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
        console.log('[Practice Questions] Raw questions from API:', questions)
        // 格式化题目数据，确保 difficulty 在 1-5 范围内
        const formattedQuestions = questions.map((q: any) => {
          const normalizedDifficulty = this.normalizeDifficulty(q.difficulty)
          console.log(`[Practice Questions] Question ${q.id}: difficulty=${q.difficulty}, normalized=${normalizedDifficulty}`)
          // 生成星星数组：每个元素表示该位置的星星是否填充
          const stars = [1, 2, 3, 4, 5].map(starIndex => starIndex <= normalizedDifficulty)
          
          const formatted = {
            ...q,
            // 确保 difficulty 是 1-5 之间的整数
            difficulty: normalizedDifficulty,
            // 添加星星数组，方便模板使用
            stars: stars
          }
          console.log(`[Practice Questions] Formatted question ${formatted.id}:`, formatted, 'stars:', stars)
          return formatted
        })
        
        console.log('[Practice Questions] Formatted questions:', formattedQuestions)
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

  normalizeDifficulty(difficulty: any): number {
    // 将 difficulty 转换为 1-5 范围的整数
    // 数据库中的 difficulty 字段是 1-5
    console.log('[normalizeDifficulty] Input:', difficulty, 'Type:', typeof difficulty)
    
    // 处理 null/undefined
    if (difficulty === null || difficulty === undefined) {
      console.log('[normalizeDifficulty] Value is null/undefined, returning 3')
      return 3
    }
    
    // 处理数字类型（包括浮点数 1.0, 2.0 等）
    if (typeof difficulty === 'number') {
      // 使用 Math.floor 向下取整，或者 Math.round 四舍五入
      // 为了安全，先检查是否为 NaN
      if (isNaN(difficulty)) {
        console.log('[normalizeDifficulty] NaN detected, returning 3')
        return 3
      }
      const rounded = Math.round(difficulty)
      // 确保在 1-5 范围内
      const result = Math.max(1, Math.min(5, rounded))
      console.log('[normalizeDifficulty] Number:', difficulty, '→ Rounded:', rounded, '→ Result:', result)
      return result
    }
    
    // 如果是字符串，尝试转换为数字
    if (typeof difficulty === 'string') {
      const trimmed = difficulty.trim()
      if (trimmed === '') {
        console.log('[normalizeDifficulty] Empty string, returning 3')
        return 3
      }
      const num = parseFloat(trimmed) // 使用 parseFloat 而不是 parseInt，以便处理 "1.0" 这样的字符串
      if (!isNaN(num)) {
        const rounded = Math.round(num)
        const result = Math.max(1, Math.min(5, rounded))
        console.log('[normalizeDifficulty] String:', difficulty, '→ Parsed:', num, '→ Rounded:', rounded, '→ Result:', result)
        return result
      }
    }
    
    // 默认返回 3（中等难度）
    console.log('[normalizeDifficulty] Unknown type/value, returning 3')
    return 3
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

    if (!question) return

    // 先进入答题前概览页：展示题型 / 预计耗时 / 流程 / 是否已提交，
    // 由概览页决定「开始」还是「继续 / 重新练习」，再跳转到具体题型页。
    const typeCode = this.data.typeCode
    const knownTypes = [
      'imitation_reading',
      'listening_selection',
      'question_answering',
      'passage_retelling',
    ]
    if (!knownTypes.includes(typeCode)) {
      // 兼容旧逻辑：未知模块类型直接进模仿朗读
      wx.navigateTo({
        url: `/pages/imitation-reading/imitation-reading?questionId=${questionId}`,
      })
      return
    }

    wx.navigateTo({
      url: `/pages/practice-overview/practice-overview?questionId=${questionId}&typeCode=${encodeURIComponent(typeCode)}`,
    })
  }
})
