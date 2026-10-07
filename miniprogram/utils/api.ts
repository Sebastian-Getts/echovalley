// API工具函数
// API baseURL 通过 pickApiBase() 按运行环境自动选择：
//   * 微信小程序正式版（envVersion === 'release'）→ PROD_API_BASE
//   * 开发版 / 体验版 / 微信开发者工具（develop / trial）→ DEV_API_BASE
//
// 调试覆盖（仅供开发人员使用，正式版不要让用户接触 wx.setStorageSync）：
//   wx.setStorageSync('__apiBaseOverride', 'https://example.com/api/v1')
//   wx.removeStorageSync('__apiBaseOverride')
//
// 部署时务必把下面的两个常量里的 example.com 替换成实际域名
// （微信平台要求 HTTPS，IP 是服务器的公网 IP，不是 localhost）。
const PROD_API_BASE = 'https://example.com/api/v1'
const DEV_API_BASE = 'https://example.com/api-dev/v1'
const OVERRIDE_KEY = '__apiBaseOverride'

function pickApiBase(): string {
  // 调试覆盖优先；正式包不应再覆盖 owner-controlled storage。
  try {
    const override = wx.getStorageSync(OVERRIDE_KEY)
    if (typeof override === 'string' && override.trim()) return override.trim()
  } catch (e) {
    // storage 不可用时不阻挠主路径
  }

  try {
    const envVersion = wx.getAccountInfoSync().miniProgram.envVersion
    if (envVersion === 'release') return PROD_API_BASE
    return DEV_API_BASE
  } catch (e) {
    // getAccountInfoSync 在非微信 IDE 等场景抛错；兜底为开发 API
    return DEV_API_BASE
  }
}

const API_BASE_URL = pickApiBase()

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
    student_db_id?: number
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

export interface ExamQuestionSummary {
  question_id: number
  title: string
  question_type: number
  section: number
  order_num: number
  max_score: number
}

export interface ExamDetail {
  id: number
  title: string
  description?: string
  time_limit: number
  total_score: number
  questions: ExamQuestionSummary[]
}

export function getExamDetail(examId: number) {
  return request<ExamDetail>({ url: `/miniprogram/exam/detail/${examId}` })
}

export function startExamSession(examId: number) {
  return request<{
    session_id: number
    status: number
    answer_counts: Record<string, number>
  }>({
    url: `/miniprogram/exam/${examId}/session`,
    method: 'POST',
  })
}

export function completeExamSession(examId: number, sessionId: number) {
  return request<{ status: string; session_id: number }>({
    url: `/miniprogram/exam/${examId}/complete?session_id=${sessionId}`,
    method: 'POST',
  })
}

export interface ExamResult {
  session_id: number
  submitted_at: string | null
  // grading_status: 0=未评分 1=评分中 2=评分完成(未发布) 3=已发布 4=已撤回
  grading_status: number
  is_released: boolean
  paper_name?: string | null
  total_score: number | null
  paper_total_score: number
  overall_feedback: string | null
  released_at: string | null
}

export function getExamResult(examId: number) {
  return request<ExamResult>({
    url: `/miniprogram/exam/${examId}/result`,
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
  session_id: number
  question_id: number
  answers?: Array<{ audio_url: string; duration: number }>
  answer_text?: string
  selected_options?: string
}) {
  return request<{
    id: number
    session_id: number
    student_id: number
    question_id: number
    answer_detail: string | null
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

/**
 * 获取或创建 session
 */
export function getOrCreateSession(questionId: number) {
  return request<{
    session_id: number
    status: number  // 0=进行中, 1=已完成
    has_answer_record: boolean
    answer_count: number
    answer_detail: string | null  // JSON string
  }>({
    url: `/miniprogram/session/${questionId}`
  })
}

/**
 * 重置 session（重新开始）
 */
export function resetSession(questionId: number) {
  return request<{
    session_id: number
    status: number
    message: string
  }>({
    url: `/miniprogram/session/${questionId}/reset`,
    method: 'POST'
  })
}

/**
 * 完成 session
 */
export function completeSession(questionId: number) {
  return request<{
    status: string
    session_id: number | null
  }>({
    url: `/miniprogram/session/${questionId}/complete`,
    method: 'POST'
  })
}

/**
 * 上传录音文件到 MinIO
 * 注意：使用 wx.uploadFile 而非 request
 */
export function uploadAudio(filePath: string, _questionId: number) {
  return new Promise<{ audio_url: string; object_name: string; size: number }>(
    (resolve, reject) => {
      const token = wx.getStorageSync('token')
      wx.uploadFile({
        url: `${API_BASE_URL}/miniprogram/audio/upload`,
        filePath: filePath,
        name: 'file',
        header: {
          'Authorization': `Bearer ${token}`
        },
        success: (res) => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            try {
              const data = JSON.parse(res.data)
              resolve(data)
            } catch (e) {
              reject(new Error('Failed to parse response'))
            }
          } else {
            reject(new Error(`Upload failed: ${res.statusCode}`))
          }
        },
        fail: (err) => {
          reject(err)
        }
      })
    }
  )
}

/**
 * 获取音频的临时访问 URL（presigned URL）
 * 用于小程序播放音频，因为 InnerAudioContext 无法发送认证头
 */
export function getPresignedAudioUrl(minioUrl: string) {
  return request<{
    url: string
    expires_in: number
  }>({
    url: '/miniprogram/audio/presigned',
    method: 'POST',
    data: { url: minioUrl }
  })
}
