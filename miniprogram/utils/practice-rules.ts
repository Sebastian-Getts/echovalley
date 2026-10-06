export const PRACTICE_RULES = Object.freeze({
  imitation: Object.freeze({
    maxScore: 10,
    preparationSeconds: 50,
    recordingSeconds: 50,
    contentPlayCount: 1,
  }),
  listening: Object.freeze({
    maxScore: 15,
    dialogueCount: 3,
    questionsPerDialogue: 2,
    readingSeconds: 10,
    recordingSeconds: 8,
    dialoguePlayCount: 2,
  }),
  answering: Object.freeze({
    maxScore: 20,
    questionCount: 4,
    readingSeconds: 15,
    recordingSeconds: 8,
    passagePlayCount: 2,
  }),
  retelling: Object.freeze({
    maxScore: 25,
    mindMapReadingSeconds: 15,
    preparationSeconds: 60,
    retellingRecordingSeconds: 60,
    passagePlayCount: 2,
    questionPreparationSeconds: 15,
    questionRecordingSeconds: 8,
    questionCount: 2,
  }),
})

export type PracticeQuestionType = keyof typeof PRACTICE_RULES

export interface PracticeResourceCheck {
  label: string
  value: unknown
}

/**
 * Keep the preflight result deterministic so every practice page presents the
 * same blocking message before a session or timer starts.
 */
export function findMissingPracticeResources(checks: PracticeResourceCheck[]): string[] {
  return checks
    .filter(check => {
      if (Array.isArray(check.value)) return check.value.length === 0
      return typeof check.value === 'string' ? check.value.trim().length === 0 : !check.value
    })
    .map(check => check.label)
}

export function showPracticeResourceError(missing: string[]): void {
  wx.showModal({
    title: '题目资源不完整',
    content: `缺少：${missing.join('、')}。请联系管理员补充后再开始答题。`,
    showCancel: false,
    success: () => wx.navigateBack(),
  })
}
