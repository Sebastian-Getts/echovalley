// i18n.ts - 国际化语言配置
export const translations = {
  en: {
    appName: 'EchoValley',
    login: {
      welcome: 'Welcome to EchoValley',
      subtitle: 'Please Login',
      username: 'Username',
      password: 'Password',
      usernamePlaceholder: 'Enter your username',
      passwordPlaceholder: 'Enter your password',
      loginButton: 'Login',
      loggingIn: 'Logging in...',
      loginSuccess: 'Login successful',
      enterUsernamePassword: 'Please enter username and password',
      invalidCredentials: 'Invalid username or password'
    },
    practice: {
      title: 'Practice',
      imitationReading: 'Imitation Reading',
      listeningComprehension: 'Listening Comprehension',
      qaPractice: 'Q&A Practice',
      passageRetelling: 'Passage Retelling',
      setsAvailable: 'sets available',
      searchPlaceholder: 'Search questions...',
      noQuestions: 'No questions found',
      loading: 'Loading...',
      difficulty: 'Difficulty'
    },
    exam: {
      title: 'Exam',
      unitTest: 'Unit Test',
      stageTest: 'Stage Test',
      mockExam: 'Mock Exam',
      setsAvailable: 'sets available',
      enterTest: 'Enter'
    },
    profile: {
      title: 'Profile',
      username: 'Username',
      study: 'Study',
      system: 'System',
      wrongAnswerCollection: 'Wrong Answer Collection',
      settings: 'Settings',
      about: 'About',
      helpFeedback: 'Help & Feedback',
      logout: 'Logout',
      logoutConfirm: 'Are you sure you want to logout?',
      confirm: 'Confirm'
    },
    settings: {
      title: 'Settings',
      language: 'Language',
      selectLanguage: 'Select Language',
      currentLanguage: 'Current Language',
      switchedToZh: 'Switched to Chinese',
      switchedToEn: 'Switched to English'
    },
    about: {
      title: 'About',
      tagline: 'English Listening & Speaking Practice',
      introduction: 'Introduction',
      introductionText: 'EchoValley is an interactive English learning mini-program designed for middle school students. Our platform helps improve your English listening and speaking skills through comprehensive practice exercises and assessments.',
      features: 'Features',
      featuresList: [
        'Imitation Reading Practice',
        'Listening Comprehension',
        'Question & Answer Practice',
        'Passage Retelling',
        'Unit Tests & Mock Exams',
        'Wrong Answer Collection'
      ],
      version: 'Version',
      initialRelease: 'Initial Release'
    },
    tabBar: {
      practice: 'Practice',
      exam: 'Exam',
      profile: 'Profile'
    }
  },
  zh: {
    appName: '桂园听说',
    login: {
      welcome: '欢迎使用桂园听说',
      subtitle: '请登录',
      username: '账号',
      password: '密码',
      usernamePlaceholder: '请输入账号',
      passwordPlaceholder: '请输入密码',
      loginButton: '登录',
      loggingIn: '登录中...',
      loginSuccess: '登录成功',
      enterUsernamePassword: '请输入账号和密码',
      invalidCredentials: '账号或密码错误'
    },
    practice: {
      title: '练习',
      imitationReading: '模仿朗读',
      listeningComprehension: '听选信息',
      qaPractice: '回答问题',
      passageRetelling: '短文复述及提问',
      setsAvailable: '套题',
      searchPlaceholder: '搜索题目...',
      noQuestions: '暂无题目',
      loading: '加载中...',
      difficulty: '难度'
    },
    exam: {
      title: '考试',
      unitTest: '单元测试',
      stageTest: '阶段测试',
      mockExam: '综合模拟',
      setsAvailable: '套题',
      enterTest: '进入'
    },
    profile: {
      title: '我的',
      username: '用户名',
      study: '学习',
      system: '系统',
      wrongAnswerCollection: '错题本',
      settings: '设置',
      about: '关于',
      helpFeedback: '帮助与反馈',
      logout: '退出登录',
      logoutConfirm: '确定要退出登录吗？',
      confirm: '确定'
    },
    settings: {
      title: '设置',
      language: '语言',
      selectLanguage: '选择语言',
      currentLanguage: '当前语言',
      switchedToZh: '已切换为中文',
      switchedToEn: '已切换为英文'
    },
    about: {
      title: '关于',
      tagline: '英语听说能力提升',
      introduction: '简介',
      introductionText: '桂园听说是一款面向中学生的英语学习小程序。我们的平台通过全面的练习和评估帮助您提升英语听说能力。',
      features: '功能特色',
      featuresList: [
        '模仿朗读练习',
        '听选信息',
        '回答问题练习',
        '短文复述及提问',
        '单元测试与综合模拟',
        '错题本'
      ],
      version: '版本',
      initialRelease: '初始版本'
    },
    tabBar: {
      practice: '练习',
      exam: '考试',
      profile: '我的'
    }
  }
}

export function getTranslation(language: string = 'en') {
  return translations[language as keyof typeof translations] || translations.en
}

export function t(key: string, language: string = 'en'): string {
  const lang = getTranslation(language)
  const keys = key.split('.')
  let value: any = lang
  for (const k of keys) {
    if (value && typeof value === 'object' && k in value) {
      value = value[k]
    } else {
      value = undefined
      break
    }
  }
  return value || key
}

