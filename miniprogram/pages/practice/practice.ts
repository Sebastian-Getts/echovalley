// practice.ts
import { getTranslation } from '../../utils/i18n'
import { getPracticeModules } from '../../utils/api'

Page({
  data: {
    modules: [] as any[],
    lang: {} as any,
    setsAvailableText: ''
  },

  onLoad() {
    // 检查登录状态
    const isLoggedIn = wx.getStorageSync('isLoggedIn')
    if (!isLoggedIn) {
      wx.redirectTo({
        url: '/pages/login/login'
      })
      return
    }

    this.loadLanguage()
  },

  onShow() {
    // 每次显示时重新加载语言
    this.loadLanguage()
  },

  loadLanguage() {
    const language = wx.getStorageSync('language') || 'en'
    const lang = getTranslation(language)
    
    this.setData({
      lang: lang.practice,
      setsAvailableText: lang.practice.setsAvailable
    })
    
    // 动态设置导航栏标题
    wx.setNavigationBarTitle({
      title: lang.practice.title
    })
    
    // 从API加载模块数据
    this.loadModules(lang)
  },

  loadModules(lang: any) {
    // 显示加载提示
    wx.showLoading({
      title: '加载中...',
      mask: true
    })
    
    getPracticeModules()
      .then((modules) => {
        // 映射模块数据，添加图标
        const moduleIcons: Record<string, string> = {
          'imitation_reading': '📖',
          'listening_selection': '🎧',
          'question_answering': '💬',
          'passage_retelling': '📝'
        }
        
        const mappedModules = modules.map((module) => ({
          id: module.id,
          title: module.title,
          icon: moduleIcons[module.type_code] || '📚',
          count: module.count,
          type_code: module.type_code
        }))
        
        this.setData({
          modules: mappedModules
        })
        
        wx.hideLoading()
      })
      .catch((error) => {
        console.error('Load modules error:', error)
        wx.hideLoading()
        
        // API调用失败，显示错误提示
        const language = wx.getStorageSync('language') || 'en'
        const errorMessage = language === 'zh' 
          ? '加载练习模块失败，请稍后重试' 
          : 'Failed to load practice modules, please try again later'
        
        wx.showToast({
          title: errorMessage,
          icon: 'none',
          duration: 2000
        })
        
        // 设置空数组，不显示任何模块
        this.setData({
          modules: []
        })
      })
  },

  onModuleTap(e: any) {
    const moduleId = e.currentTarget.dataset.id
    const module = this.data.modules.find(m => m.id === moduleId)
    
    if (module) {
      // 跳转到练习题目列表页面
      wx.navigateTo({
        url: `/pages/practice-questions/practice-questions?moduleId=${module.id}&moduleTitle=${encodeURIComponent(module.title)}`
      })
    }
  }
})

