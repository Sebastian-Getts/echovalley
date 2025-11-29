// login.ts
import { getTranslation } from '../../utils/i18n'

Page({
  data: {
    username: '',
    password: '',
    lang: {} as any
  },

  onLoad() {
    // 检查是否已登录
    const isLoggedIn = wx.getStorageSync('isLoggedIn')
    if (isLoggedIn) {
      wx.switchTab({
        url: '/pages/practice/practice'
      })
      return
    }

    // 加载语言
    this.loadLanguage()
  },

  onShow() {
    // 每次显示时重新加载语言（支持从设置页返回后更新）
    this.loadLanguage()
  },

  loadLanguage() {
    const language = wx.getStorageSync('language') || 'en'
    const lang = getTranslation(language)
    this.setData({
      lang: lang.login,
      appName: lang.appName
    })
    
    // 动态设置导航栏标题
    wx.setNavigationBarTitle({
      title: language === 'zh' ? '登录' : 'Login'
    })
  },

  onUsernameInput(e: any) {
    this.setData({
      username: e.detail.value
    })
  },

  onPasswordInput(e: any) {
    this.setData({
      password: e.detail.value
    })
  },

  onLogin() {
    const { username, password, lang } = this.data
    
    if (!username || !password) {
      wx.showToast({
        title: lang.enterUsernamePassword,
        icon: 'none'
      })
      return
    }

    // 显示加载遮罩层
    wx.showLoading({
      title: lang.loggingIn,
      mask: true
    })

    // 账号密码校验（用户名不区分大小写）
    const validUsername = 'erin'
    const validPassword = '1004'
    
    if (username.toLowerCase() !== validUsername.toLowerCase() || password !== validPassword) {
      wx.hideLoading()
      wx.showToast({
        title: lang.invalidCredentials,
        icon: 'none'
      })
      return
    }

    // 模拟登录处理时间（实际项目可能涉及网络请求）
    setTimeout(() => {
      // 登录成功，保存登录状态（保存用户原始输入的用户名）
      wx.setStorageSync('isLoggedIn', true)
      wx.setStorageSync('username', username.trim())

      wx.hideLoading()
      
      // 直接跳转，不显示toast避免延迟
      wx.switchTab({
        url: '/pages/practice/practice',
        success: () => {
          // 跳转成功后显示提示
          wx.showToast({
            title: lang.loginSuccess,
            icon: 'success',
            duration: 1500
          })
        }
      })
    }, 300)
  }
})

