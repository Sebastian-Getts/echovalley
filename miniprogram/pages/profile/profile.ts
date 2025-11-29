// profile.ts
import { getTranslation } from '../../utils/i18n'

Page({
  data: {
    username: '',
    businessModules: [] as any[],
    systemModules: [] as any[],
    lang: {} as any
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

    const username = wx.getStorageSync('username') || ''
    this.setData({
      username
    })

    this.loadLanguage()
  },

  onShow() {
    // 每次显示时重新加载语言
    this.loadLanguage()
  },

  loadLanguage() {
    const language = wx.getStorageSync('language') || 'en'
    const lang = getTranslation(language)
    
    const businessModules = [
      {
        id: 1,
        title: lang.profile.wrongAnswerCollection,
        icon: '📋'
      }
    ]
    
    const systemModules = [
      {
        id: 2,
        title: lang.profile.settings,
        icon: '⚙️',
        url: '/pages/settings/settings'
      },
      {
        id: 3,
        title: lang.profile.about,
        icon: 'ℹ️',
        url: '/pages/about/about'
      },
      {
        id: 4,
        title: lang.profile.helpFeedback,
        icon: '💡'
      }
    ]

    this.setData({
      businessModules,
      systemModules,
      lang: lang.profile
    })
    
    // 动态设置导航栏标题
    wx.setNavigationBarTitle({
      title: lang.profile.title
    })
  },

  onModuleTap(e: any) {
    const module = e.currentTarget.dataset.module
    const language = wx.getStorageSync('language') || 'en'
    const comingSoonText = language === 'zh' ? '即将推出' : 'coming soon'
    
    if (module.url) {
      wx.navigateTo({
        url: module.url
      })
    } else {
      wx.showToast({
        title: `${module.title} ${comingSoonText}`,
        icon: 'none'
      })
    }
  },

  onLogout() {
    const { lang } = this.data
    wx.showModal({
      title: lang.confirm,
      content: lang.logoutConfirm,
      success: (res) => {
        if (res.confirm) {
          wx.removeStorageSync('isLoggedIn')
          wx.removeStorageSync('username')
          wx.redirectTo({
            url: '/pages/login/login'
          })
        }
      }
    })
  }
})

