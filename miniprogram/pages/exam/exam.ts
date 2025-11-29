// exam.ts
import { getTranslation } from '../../utils/i18n'

Page({
  data: {
    sections: [] as any[],
    setsAvailableText: ''
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

    this.loadLanguage()
  },

  onShow() {
    // 每次显示时重新加载语言
    this.loadLanguage()
  },

  loadLanguage() {
    const language = wx.getStorageSync('language') || 'en'
    const lang = getTranslation(language)
    
    const sections = [
      {
        id: 1,
        title: lang.exam.unitTest,
        icon: '📚',
        count: 12,
        expanded: false,
        items: language === 'zh' ? [
          '第1单元测试',
          '第2单元测试',
          '第3单元测试',
          '第4单元测试',
          '第5单元测试',
          '第6单元测试',
          '第7单元测试',
          '第8单元测试',
          '第9单元测试',
          '第10单元测试',
          '第11单元测试',
          '第12单元测试'
        ] : [
          'Unit 1 Test',
          'Unit 2 Test',
          'Unit 3 Test',
          'Unit 4 Test',
          'Unit 5 Test',
          'Unit 6 Test',
          'Unit 7 Test',
          'Unit 8 Test',
          'Unit 9 Test',
          'Unit 10 Test',
          'Unit 11 Test',
          'Unit 12 Test'
        ]
      },
      {
        id: 2,
        title: lang.exam.stageTest,
        icon: '📊',
        count: 8,
        expanded: false,
        items: language === 'zh' ? [
          '第一阶段测试',
          '第二阶段测试',
          '第三阶段测试',
          '第四阶段测试',
          '第五阶段测试',
          '第六阶段测试',
          '第七阶段测试',
          '第八阶段测试'
        ] : [
          'Stage 1 Test',
          'Stage 2 Test',
          'Stage 3 Test',
          'Stage 4 Test',
          'Stage 5 Test',
          'Stage 6 Test',
          'Stage 7 Test',
          'Stage 8 Test'
        ]
      },
      {
        id: 3,
        title: lang.exam.mockExam,
        icon: '🎯',
        count: 15,
        expanded: false,
        items: language === 'zh' ? [
          '7年级(上) 模拟试题1',
          '7年级(上) 模拟试题2',
          '7年级(上) 模拟试题3',
          '7年级(下) 模拟试题1',
          '7年级(下) 模拟试题2',
          '7年级(下) 模拟试题3',
          '8年级(上) 模拟试题1',
          '8年级(上) 模拟试题2',
          '8年级(上) 模拟试题3',
          '8年级(下) 模拟试题1',
          '8年级(下) 模拟试题2',
          '8年级(下) 模拟试题3',
          '9年级(上) 模拟试题1',
          '9年级(上) 模拟试题2',
          '9年级(上) 模拟试题3'
        ] : [
          'Grade 7 (1st Semester) Mock Test 1',
          'Grade 7 (1st Semester) Mock Test 2',
          'Grade 7 (1st Semester) Mock Test 3',
          'Grade 7 (2nd Semester) Mock Test 1',
          'Grade 7 (2nd Semester) Mock Test 2',
          'Grade 7 (2nd Semester) Mock Test 3',
          'Grade 8 (1st Semester) Mock Test 1',
          'Grade 8 (1st Semester) Mock Test 2',
          'Grade 8 (1st Semester) Mock Test 3',
          'Grade 8 (2nd Semester) Mock Test 1',
          'Grade 8 (2nd Semester) Mock Test 2',
          'Grade 8 (2nd Semester) Mock Test 3',
          'Grade 9 (1st Semester) Mock Test 1',
          'Grade 9 (1st Semester) Mock Test 2',
          'Grade 9 (1st Semester) Mock Test 3'
        ]
      }
    ]

    this.setData({
      sections,
      setsAvailableText: lang.exam.setsAvailable
    })
    
    // 动态设置导航栏标题
    wx.setNavigationBarTitle({
      title: lang.exam.title
    })
  },

  onSectionTap(e: any) {
    const sectionId = e.currentTarget.dataset.id
    const sections = this.data.sections.map(section => {
      if (section.id === sectionId) {
        return {
          ...section,
          expanded: !section.expanded
        }
      }
      return section
    })
    
    this.setData({
      sections
    })
  },

  onItemTap(e: any) {
    const sectionId = e.currentTarget.dataset.sectionId
    const itemIndex = e.currentTarget.dataset.itemIndex
    const section = this.data.sections.find(s => s.id === sectionId)
    
    if (section && section.items[itemIndex]) {
      const language = wx.getStorageSync('language') || 'en'
      const enterText = language === 'zh' ? '进入' : 'Enter'
      wx.showToast({
        title: `${enterText} ${section.items[itemIndex]}`,
        icon: 'none'
      })
      // 这里后续可以跳转到具体的考试页面
    }
  }
})

