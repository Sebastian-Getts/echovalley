// practice.ts
import { getTranslation } from '../../utils/i18n'

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
    
    const modules = [
      {
        id: 1,
        title: lang.practice.imitationReading,
        icon: '📖',
        count: 25
      },
      {
        id: 2,
        title: lang.practice.listeningComprehension,
        icon: '🎧',
        count: 30
      },
      {
        id: 3,
        title: lang.practice.qaPractice,
        icon: '💬',
        count: 20
      },
      {
        id: 4,
        title: lang.practice.passageRetelling,
        icon: '📝',
        count: 15
      }
    ]

    this.setData({
      modules,
      lang: lang.practice,
      setsAvailableText: lang.practice.setsAvailable
    })
    
    // 动态设置导航栏标题
    wx.setNavigationBarTitle({
      title: lang.practice.title
    })
  },

  onModuleTap(e: any) {
    const moduleId = e.currentTarget.dataset.id
    const module = this.data.modules.find(m => m.id === moduleId)
    
    if (module) {
      const language = wx.getStorageSync('language') || 'en'
      const enterText = language === 'zh' ? '进入' : 'Enter'
      wx.showToast({
        title: `${enterText} ${module.title}`,
        icon: 'none'
      })
      // 这里后续可以跳转到具体的练习页面
    }
  }
})

