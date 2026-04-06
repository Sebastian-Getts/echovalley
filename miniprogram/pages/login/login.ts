// login.ts
import { getTranslation } from '../../utils/i18n'
import { studentLogin, ApiError } from '../../utils/api'

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

    // 调用API登录
    studentLogin(username.trim(), password)
      .then((result) => {
        if (result.success) {
          // 登录成功，保存登录状态和用户信息
          wx.setStorageSync('isLoggedIn', true)
          wx.setStorageSync('username', result.name || username.trim())
          wx.setStorageSync('studentId', result.student_id || '')
          wx.setStorageSync('studentDbId', result.student_db_id || 0)
          if (result.token) {
            wx.setStorageSync('token', result.token)
          }
          
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
        } else {
          wx.hideLoading()
          wx.showToast({
            title: result.message || lang.invalidCredentials,
            icon: 'none'
          })
        }
      })
      .catch((error) => {
        wx.hideLoading()
        console.error('Login error:', error)
        
        // 处理API错误
        if (error instanceof ApiError) {
          // 显示后端返回的错误消息
          const errorMessage = error.message || lang.invalidCredentials
          wx.showToast({
            title: errorMessage,
            icon: 'none',
            duration: 2000
          })
        } else {
          // 网络错误或其他错误
          const errorMessage = lang.invalidCredentials || '登录失败，请检查网络连接'
          wx.showToast({
            title: errorMessage,
            icon: 'none',
            duration: 2000
          })
        }
      })
  }
})

