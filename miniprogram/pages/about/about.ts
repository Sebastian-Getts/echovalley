// about.ts
import { getTranslation } from '../../utils/i18n'
import { getEnvironmentStorage } from '../../utils/environment'

Page({
  data: {
    version: '1.0.0',
    appName: '',
    lang: {} as any,
    featuresList: [] as string[]
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
      appName: lang.appName,
      lang: lang.about,
      featuresList: lang.about.featuresList
    })
    
    // 动态设置导航栏标题
    wx.setNavigationBarTitle({
      title: lang.about.title
    })
  }
})
