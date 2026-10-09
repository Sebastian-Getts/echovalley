// settings.ts
import { getTranslation } from '../../utils/i18n'
import { getEnvironmentStorage } from '../../utils/environment'

Page({
  data: {
    language: 'en', // 'en' or 'zh'
    lang: {} as any
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
    // 从本地存储读取语言设置
    const savedLanguage = wx.getStorageSync('language') || 'en'
    const lang = getTranslation(savedLanguage)
    this.setData({
      language: savedLanguage,
      lang: lang.settings
    })
    
    // 动态设置导航栏标题
    wx.setNavigationBarTitle({
      title: lang.settings.title
    })
  },

  onLanguageChange(e: any) {
    const language = e.detail.value === 'zh' ? 'zh' : 'en'
    this.setData({
      language
    })
    
    // 保存语言设置
    wx.setStorageSync('language', language)
    
    // 保存到全局数据
    const app = getApp()
    if (app) {
      app.globalData.language = language
    }
    
    // 重新加载语言（会立即生效）
    this.loadLanguage()
    
    // 显示切换成功提示
    wx.showToast({
      title: language === 'zh' ? this.data.lang.switchedToZh : this.data.lang.switchedToEn,
      icon: 'success',
      duration: 2000
    })
  }
})
