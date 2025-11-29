// app.ts
App<IAppOption>({
  globalData: {
    language: 'en' // 默认英文
  } as any,
  onLaunch() {
    // 应用启动时的初始化逻辑
    // 登录状态检查在各页面的onLoad中进行
    
    // 从本地存储读取语言设置
    const savedLanguage = wx.getStorageSync('language') || 'en'
    ;(this.globalData as any).language = savedLanguage
  },
})