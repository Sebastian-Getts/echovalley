// exam.ts
import { getTranslation } from '../../utils/i18n'
import { getEnvironmentStorage } from '../../utils/environment'
import { getExamCategories, getExamList } from '../../utils/api'

Page({
  data: {
    sections: [] as any[],
    setsAvailableText: '',
    lang: {} as any,
    loading: false
  },

  onLoad() {
    // 检查登录状态
    const isLoggedIn = getEnvironmentStorage('isLoggedIn')
    if (!isLoggedIn) {
      wx.redirectTo({
        url: '/pages/login/login'
      })
      return
    }

    this.loadLanguage()
  },

  onShow() {
    // 每次显示时重新加载语言和数据
    this.loadLanguage()
  },

  loadLanguage() {
    const language = wx.getStorageSync('language') || 'en'
    const lang = getTranslation(language)
    
    this.setData({
      lang: lang.exam,
      setsAvailableText: lang.exam.setsAvailable
    })
    
    // 动态设置导航栏标题
    wx.setNavigationBarTitle({
      title: lang.exam.title
    })
    
    // 从API加载考试分类数据
    this.loadExamCategories()
  },

  loadExamCategories() {
    // 显示加载提示
    const language = wx.getStorageSync('language') || 'en'
    const loadingText = language === 'zh' ? '加载中...' : 'Loading...'
    wx.showLoading({
      title: loadingText,
      mask: true
    })
    
    this.setData({ loading: true })
    
    getExamCategories()
      .then((categories) => {
        // 映射分类数据，设置图标和展开状态
        const categoryIcons: Record<string, string> = {
          'unit_test': '📚',
          'stage_test': '📊',
          'mock_exam': '🎯'
        }
        
        const mappedCategories = categories.map((category) => ({
          id: category.id,
          title: category.title,
          icon: category.icon || categoryIcons[category.category_type] || '📝',
          count: category.count,
          category_type: category.category_type,
          expanded: false,
          items: [] as Array<{ id: number; title: string }>, // 初始为空，点击展开时加载
          loading: false
        }))
        
        this.setData({
          sections: mappedCategories,
          loading: false
        })
        
        wx.hideLoading()
      })
      .catch((error) => {
        console.error('Load exam categories error:', error)
        wx.hideLoading()
        this.setData({ loading: false })
        
        // API调用失败，显示错误提示
        const language = wx.getStorageSync('language') || 'en'
        const errorMessage = language === 'zh' 
          ? '加载考试分类失败，请稍后重试' 
          : 'Failed to load exam categories, please try again later'
        
        wx.showToast({
          title: errorMessage,
          icon: 'none',
          duration: 2000
        })
        
        // 设置空数组，不显示任何分类
        this.setData({
          sections: []
        })
      })
  },

  loadExamListForCategory(categoryId: number, categoryType: string) {
    // 标记该分类正在加载
    const sections = this.data.sections.map(section => {
      if (section.id === categoryId) {
        return { ...section, loading: true }
      }
      return section
    })
    this.setData({ sections })
    
    getExamList({
      category_id: categoryId,
      category_type: categoryType
    })
      .then((examList) => {
        // 更新对应分类的items，保存exam的id和title
        const updatedSections = this.data.sections.map(section => {
          if (section.id === categoryId) {
            return {
              ...section,
              items: examList.map(exam => ({ id: exam.id, title: exam.title })),
              loading: false
            }
          }
          return section
        })
        
        this.setData({
          sections: updatedSections
        })
      })
      .catch((error) => {
        console.error('Load exam list error:', error)
        
        // 加载失败，取消loading状态
        const sections = this.data.sections.map(section => {
          if (section.id === categoryId) {
            return { ...section, loading: false }
          }
          return section
        })
        this.setData({ sections })
        
        const language = wx.getStorageSync('language') || 'en'
        const errorMessage = language === 'zh' 
          ? '加载考试列表失败，请稍后重试' 
          : 'Failed to load exam list, please try again later'
        
        wx.showToast({
          title: errorMessage,
          icon: 'none',
          duration: 2000
        })
      })
  },

  onSectionTap(e: any) {
    const sectionId = e.currentTarget.dataset.id
    const section = this.data.sections.find(s => s.id === sectionId)
    
    if (!section) return
    
    const language = wx.getStorageSync('language') || 'en'
    const lang = getTranslation(language)
    
    // 切换展开状态
    const sections = this.data.sections.map(s => {
      if (s.id === sectionId) {
        const newExpanded = !s.expanded
        // 如果展开且items为空，则加载考试列表
        if (newExpanded && s.items.length === 0) {
          this.loadExamListForCategory(sectionId, s.category_type)
        }
        return {
          ...s,
          expanded: newExpanded
        }
      }
      return s
    })
    
    this.setData({
      sections
    })
  },

  onItemTap(e: any) {
    const sectionId = e.currentTarget.dataset.sectionId
    const itemIndex = e.currentTarget.dataset.itemIndex
    const section = this.data.sections.find(s => s.id === sectionId)
    
    if (section && section.items[itemIndex]) {
      const examItem = section.items[itemIndex]
      const examId = examItem.id || examItem // 兼容字符串或对象格式
      wx.navigateTo({
        url: `/pages/exam-detail/exam-detail?examId=${examId}`,
      })
    }
  }
})
