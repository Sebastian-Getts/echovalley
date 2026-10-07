const CUE_PATHS = {
  start: '/assets/audio/recording-start.mp3',
  stop: '/assets/audio/recording-stop.mp3',
} as const

/**
 * Recording lifecycle helpers shared by the four practice pages.
 *
 * P2-2 — phase persistence and interruption handling.
 *
 *  * Page cut-background record a snapshot of (subscriber name -> phase) and
 *    (subscriber name -> uploaded sub-answers). Returning to the page
 *    re-reads the snapshot and offers the student a "continue from
 *    where you left off" choice instead of restarting from phase 1.
 *  * Practice pages use `stopRecordingOnBackground` to make sure the
 *    recorder is destroyed in onHide; re-entering starts from the
 *    last persisted phase, never mid-recording.
 *  * The dedup contract on the server (P2-1) guarantees that even
 *    without client-side phase tracking, accidental double submits
 *    don't inflate sub-answer counts.
 */

interface PhaseSnapshot {
  currentPhase: number
  uploadedCount: number
  updatedAt: number
}

function snapshotKey(scope: string, questionId: number, sessionId: number): string {
  return `phase:${scope}:${sessionId || 0}:${questionId}`
}

export function savePhaseSnapshot(
  scope: string,
  questionId: number,
  sessionId: number,
  currentPhase: number,
  uploadedCount: number,
): void {
  try {
    const snapshot: PhaseSnapshot = {
      currentPhase,
      uploadedCount,
      updatedAt: Date.now(),
    }
    wx.setStorageSync(
      snapshotKey(scope, questionId, sessionId),
      snapshot,
    )
  } catch (e) {
    console.warn('[recording-flow] savePhaseSnapshot failed', e)
  }
}

export function loadPhaseSnapshot(
  scope: string,
  questionId: number,
  sessionId: number,
): PhaseSnapshot | null {
  try {
    return wx.getStorageSync(
      snapshotKey(scope, questionId, sessionId),
    ) || null
  } catch (e) {
    console.warn('[recording-flow] loadPhaseSnapshot failed', e)
    return null
  }
}

export function clearPhaseSnapshot(
  scope: string,
  questionId: number,
  sessionId: number,
): void {
  try {
    wx.removeStorageSync(snapshotKey(scope, questionId, sessionId))
  } catch (e) {
    console.warn('[recording-flow] clearPhaseSnapshot failed', e)
  }
}

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