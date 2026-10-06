const CUE_PATHS = {
  start: '/assets/audio/recording-start.mp3',
  stop: '/assets/audio/recording-stop.mp3',
} as const

export function ensureRecordPermission(): Promise<void> {
  return new Promise((resolve, reject) => {
    wx.getSetting({
      success: setting => {
        if (setting.authSetting['scope.record']) {
          resolve()
          return
        }
        wx.authorize({
          scope: 'scope.record',
          success: () => resolve(),
          fail: () => {
            wx.showModal({
              title: '需要录音权限',
              content: '正式答题会自动录音，请在设置中允许使用麦克风。',
              confirmText: '去设置',
              success: modal => {
                if (!modal.confirm) {
                  reject(new Error('record permission denied'))
                  return
                }
                wx.openSetting({
                  success: opened => {
                    if (opened.authSetting['scope.record']) resolve()
                    else reject(new Error('record permission denied'))
                  },
                  fail: reject,
                })
              },
            })
          },
        })
      },
      fail: reject,
    })
  })
}

export function playRecordingCue(kind: keyof typeof CUE_PATHS): Promise<void> {
  return new Promise(resolve => {
    const audio = wx.createInnerAudioContext()
    let finished = false
    const finish = () => {
      if (finished) return
      finished = true
      audio.destroy()
      resolve()
    }
    audio.src = CUE_PATHS[kind]
    audio.onEnded(finish)
    audio.onError(finish)
    audio.play()
  })
}
