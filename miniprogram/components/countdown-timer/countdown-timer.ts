// countdown-timer.ts
Component({
  properties: {
    // 倒计时秒数
    duration: {
      type: Number,
      value: 10,
    },
    // 文字标签
    label: {
      type: String,
      value: '题目说明',
    },
    allowEarlyStop: {
      type: Boolean,
      value: false,
    },
  },

  data: {
    timer: 10, // 当前倒计时秒数
    timerText: '10秒',
    progressPercent: 0, // 进度百分比 (0-100)
    timerInterval: null as any,
    phaseStartTime: 0, // 阶段开始时间
    phaseDuration: 10000, // 阶段持续时间（毫秒）
  },

  lifetimes: {
    detached() {
      // 组件卸载时清除定时器
      this.stopTimer()
    },
  },

  methods: {
    /**
     * 开始倒计时
     */
    startTimer() {
      // 设置定时器，每100毫秒更新一次，让动画更流畅
      const interval = setInterval(() => {
        this.updateTimer()
      }, 100)

      // 记录开始时间
      const phaseDuration = this.data.duration * 1000

      this.setData({
        timerInterval: interval,
        phaseStartTime: Date.now(),
        phaseDuration: phaseDuration,
      })
      // 立即更新一次，开始倒计时
      this.updateTimer()
    },

    /**
     * 停止倒计时
     */
    stopTimer() {
      if (this.data.timerInterval) {
        clearInterval(this.data.timerInterval)
        this.setData({
          timerInterval: null,
        })
      }
    },

    /**
     * 重置倒计时
     */
    resetTimer() {
      this.stopTimer()
      this.setData({
        timer: this.data.duration,
        timerText: `${this.data.duration}秒`,
        progressPercent: 0,
        phaseStartTime: 0,
      })
    },

    /**
     * 更新倒计时
     */
    updateTimer() {
      const now = Date.now()
      const elapsed = now - this.data.phaseStartTime
      const duration = this.data.phaseDuration

      // 计算进度百分比
      let progress = elapsed / duration
      if (progress > 1) progress = 1

      // 计算进度百分比（用于 conic-gradient）
      const progressPercent = progress * 100

      // 计算剩余秒数（用于显示）
      const remainingSeconds = Math.ceil((duration - elapsed) / 1000)
      const timer = remainingSeconds > 0 ? remainingSeconds : 0

      if (progress >= 1) {
        // 倒计时结束
        this.stopTimer()
        this.setData({
          timerText: '0秒',
          progressPercent: 100,
        })

        // 触发倒计时结束事件
        this.triggerEvent('finish', {})
      } else {
        // 更新进度
        this.setData({
          timer: timer,
          timerText: `${timer}秒`,
          progressPercent: progressPercent,
        })
      }
    },

    onControlTap() {
      if (!this.data.allowEarlyStop) return
      this.stopTimer()
      this.triggerEvent('earlystop', {})
    },
  },
})
