// API工具函数
// 配置API基础URL，可以根据环境切换
// 生产环境请修改为实际的服务器地址
const API_BASE_URL = 'http://localhost:8000/api/v1' // 开发环境，实际使用时需要配置为实际服务器地址

interface RequestOptions {
  url: string
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  data?: any
  header?: Record<string, string>
}

/**
 * API错误类
 */
export class ApiError extends Error {
  statusCode: number
  data: any

  constructor(statusCode: number, message: string, data?: any) {
    super(message)
    this.name = 'ApiError'
    this.statusCode = statusCode
    this.data = data
  }

  /**
   * 从响应中提取错误消息
   */
  static extractErrorMessage(resData: any): string {
    if (typeof resData === 'string') {
      try {
        resData = JSON.parse(resData)
      } catch {
        return resData
      }
    }
    
    if (typeof resData === 'object' && resData !== null) {
      // 支持多种错误格式
      if (resData.detail) {
        return resData.detail
      }
      if (resData.message) {
        return resData.message
      }
      if (resData.error) {
        return typeof resData.error === 'string' ? resData.error : resData.error.message || JSON.stringify(resData.error)
      }
      if (resData.msg) {
        return resData.msg
      }
    }
    
    return JSON.stringify(resData)
  }
}

/**
 * 通用请求函数
 */
function request<T = any>(options: RequestOptions): Promise<T> {
  return new Promise((resolve, reject) => {
    const { url, method = 'GET', data, header = {} } = options
    
    // 添加默认header
    const defaultHeader: Record<string, string> = {
      'Content-Type': 'application/json',
      ...header
    }
    
    // 如果有token，添加到header
    const token = wx.getStorageSync('token')
    if (token) {
      defaultHeader['Authorization'] = `Bearer ${token}`
    }
    
    wx.request({
      url: url.startsWith('http') ? url : `${API_BASE_URL}${url}`,
      method: method as any,
      data: data,
      header: defaultHeader,
      success: (res) => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          // 直接返回响应数据，小程序接口不使用 { code, message, data } 包装格式
          resolve(res.data as T)
        } else {
          // HTTP状态码错误，解析错误响应体
          const errorMessage = ApiError.extractErrorMessage(res.data)
          reject(new ApiError(res.statusCode, errorMessage, res.data))
        }
      },
      fail: (err) => {
        reject(err)
      }
    })
  })
}

/**
 * 学生登录
 */
export function studentLogin(username: string, password: string) {
  return request<{
    success: boolean
    message: string
    student_id?: string
    name?: string
    token?: string
  }>({
    url: '/miniprogram/login',
    method: 'POST',
    data: { username, password }
  })
}

/**
 * 获取练习模块列表
 */
export function getPracticeModules() {
  console.log('[API] 调用 getPracticeModules, URL:', '/miniprogram/practice/modules')
  const token = wx.getStorageSync('token')
  console.log('[API] Token:', token ? '存在' : '不存在')
  
  return request<Array<{
    id: number
    title: string
    type_code: string
    count: number
  }>>({
    url: '/miniprogram/practice/modules'
  }).then((data) => {
    console.log('[API] getPracticeModules 返回数据:', JSON.stringify(data, null, 2))
    return data
  }).catch((error) => {
    console.error('[API] getPracticeModules 请求失败:', error)
    throw error
  })
}

/**
 * 获取练习题目列表
 */
export function getPracticeQuestions(params?: {
  question_type_id?: number
  difficulty?: string
  search?: string
  skip?: number
  limit?: number
}) {
  const queryString = params ? '?' + Object.entries(params)
    .filter(([_, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join('&') : ''
  
  return request<Array<any>>({
    url: `/miniprogram/practice/questions${queryString}`
  })
}

/**
 * 获取考试分类列表
 */
export function getExamCategories() {
  return request<Array<{
    id: number
    title: string
    icon?: string
    count: number
    category_type: string // 'unit_test', 'stage_test', 'mock_exam'
  }>>({
    url: '/miniprogram/exam/categories'
  })
}

/**
 * 获取指定分类下的考试列表
 */
export function getExamList(params?: {
  category_id?: number
  category_type?: string
  skip?: number
  limit?: number
}) {
  const queryString = params ? '?' + Object.entries(params)
    .filter(([_, v]) => v !== undefined)
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join('&') : ''
  
  return request<Array<{
    id: number
    title: string
    category_id?: number
    category_type?: string
  }>>({
    url: `/miniprogram/exam/list${queryString}`
  })
}

/**
 * 获取考试题目列表
 */
export function getExamQuestions(params?: {
  exam_id?: number
  skip?: number
  limit?: number
}) {
  const queryString = params ? '?' + Object.entries(params)
    .filter(([_, v]) => v !== undefined)
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join('&') : ''
  
  return request<Array<any>>({
    url: `/miniprogram/exam/questions${queryString}`
  })
}

/**
 * 获取题目详情
 */
export function getQuestionDetail(questionId: number) {
  return request<any>({
    url: `/miniprogram/questions/${questionId}`
  })
}

/**
 * 提交答题记录
 */
export function submitAnswer(studentId: number, answerData: {
  question_id: number
  answer_text?: string
  audio_url?: string
  selected_options?: string
}) {
  return request<{
    id: number
    student_id: number
    question_id: number
    answer_text?: string
    audio_url?: string
    selected_options?: string
    score?: number
    grade?: string
    status: string
    submitted_at: string
  }>({
    url: `/miniprogram/answers/${studentId}`,
    method: 'POST',
    data: answerData
  })
}


