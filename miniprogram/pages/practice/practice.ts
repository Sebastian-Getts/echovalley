// practice.ts
import { getTranslation } from '../../utils/i18n'
import { getEnvironmentStorage } from '../../utils/environment'
import { getPracticeModules } from '../../utils/api'

Page({
  data: {
    modules: [] as any[],
    lang: {} as any,
    setsAvailableText: ''
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
    this.loadModules()
  },

  loadModules() {
    // 显示加载提示
    wx.showLoading({
      title: '加载中...',
      mask: true
    })
    
    console.log('[Practice] 开始加载练习模块...')
    
    getPracticeModules()
      .then((modules) => {
        console.log('[Practice] 接口返回的原始数据:', JSON.stringify(modules, null, 2))
        
        // 检查返回数据
        if (!Array.isArray(modules)) {
          console.error('[Practice] 返回数据格式错误，不是数组:', modules)
          throw new Error('返回数据格式错误')
        }
        
        // 映射模块数据，添加图标
        const moduleIcons: Record<string, string> = {
          'imitation_reading': '📖',
          'listening_selection': '🎧',
          'question_answering': '💬',
          'passage_retelling': '📝'
        }
        
        const mappedModules = modules.map((module) => {
          const mapped = {
            id: module.id,
            title: module.title,
            icon: moduleIcons[module.type_code] || '📚',
            count: module.count || 0,  // 确保 count 有默认值
            type_code: module.type_code
          }
          console.log(`[Practice] 模块映射: ${module.type_code} -> count=${mapped.count}`)
          return mapped
        })
        
        console.log('[Practice] 映射后的模块数据:', JSON.stringify(mappedModules, null, 2))
        
        this.setData({
          modules: mappedModules
        })
        
        wx.hideLoading()
      })
      .catch((error) => {
        console.error('[Practice] 加载模块失败:', error)
        console.error('[Practice] 错误详情:', {
          message: error.message,
          statusCode: error.statusCode,
          data: error.data
        })
        
        wx.hideLoading()
        
        // API调用失败，显示错误提示
        const language = wx.getStorageSync('language') || 'en'
        const errorMessage = language === 'zh' 
          ? `加载练习模块失败: ${error.message || '未知错误'}` 
          : `Failed to load practice modules: ${error.message || 'Unknown error'}`
        
        wx.showToast({
          title: errorMessage,
          icon: 'none',
          duration: 3000
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
      // 跳转到练习题目列表页面，传递 type_code 用于后续跳转判断
      wx.navigateTo({
        url: `/pages/practice-questions/practice-questions?moduleId=${module.id}&moduleTitle=${encodeURIComponent(module.title)}&typeCode=${encodeURIComponent(module.type_code || '')}`
      })
    }
  }
})
