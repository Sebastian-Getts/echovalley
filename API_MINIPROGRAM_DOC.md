# 桂园听说 - 小程序 API 接口文档

本文档描述了小程序端所需的所有 API 接口，用于前后端开发沟通。

## 基础信息

- **Base URL**: `/api/v1` (可通过 `API_BASE_URL` 配置，默认: `http://localhost:8000/api/v1`)
- **认证方式**: Bearer Token (在请求头中传递 `Authorization: Bearer <token>`)
- **数据格式**: JSON
- **请求库**: 微信小程序 `wx.request` API

---

## 1. 认证相关

### 1.1 学生登录

**接口路径**: `POST /miniprogram/login`

**请求参数** (Request Body):

| 参数名   | 类型   | 必填 | 说明     |
| -------- | ------ | ---- | -------- |
| username | string | 是   | 学生账号 |
| password | string | 是   | 登录密码 |

**请求示例**:

```json
{
  "username": "erin",
  "password": "1004"
}
```

**响应数据**:

```json
{
  "success": true,
  "message": "登录成功",
  "student_id": "2024001",
  "name": "张三",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**响应字段说明**:

| 字段       | 类型    | 说明                          |
| ---------- | ------- | ----------------------------- |
| success    | boolean | 是否登录成功                  |
| message    | string  | 响应消息                      |
| student_id | string  | 学生 ID                       |
| name       | string  | 学生姓名                      |
| token      | string  | JWT Token，用于后续请求的认证 |

**错误响应**:

后端可能使用以下格式之一返回错误：

**格式一**（推荐）:
```json
{
  "success": false,
  "message": "账号或密码错误"
}
```

**格式二**（FastAPI 等框架标准格式）:
HTTP 401 状态码 + 响应体：
```json
{
  "detail": "Invalid username or password"
}
```

**说明**:

- 此接口不需要认证
- 登录成功后返回的 `token` 需要保存到 `wx.setStorageSync('token', token)`，后续所有接口都需要在请求头中携带 `Authorization: Bearer <token>`
- 前端会将登录状态存储到 `wx.setStorageSync('isLoggedIn', true)`，用户信息存储到 `wx.setStorageSync('username', name)` 和 `wx.setStorageSync('studentId', student_id)`
- 当账号或密码错误时，后端可能返回：
  - HTTP 401 状态码 + JSON 错误体（如 `{"detail": "..."}` 或 `{"message": "..."}`）
  - HTTP 200 状态码 + `{"success": false, "message": "..."}`
- 前端会解析错误响应体中的 `detail`、`message`、`error`、`msg` 等字段来显示错误信息
- Token 有效期内可用于后续所有需要认证的接口请求

---

## 2. 练习相关

### 2.1 获取练习模块列表

**接口路径**: `GET /miniprogram/practice/modules`

**请求参数**: 无

**认证**: 需要 (Bearer Token)

**响应数据**:

```json
[
  {
    "id": 1,
    "title": "模仿朗读",
    "type_code": "imitation_reading",
    "count": 25
  },
  {
    "id": 2,
    "title": "听选信息",
    "type_code": "listening_selection",
    "count": 30
  },
  {
    "id": 3,
    "title": "回答问题",
    "type_code": "question_answering",
    "count": 20
  },
  {
    "id": 4,
    "title": "短文复述",
    "type_code": "passage_retelling",
    "count": 15
  }
]
```

**响应字段说明**:

| 字段      | 类型   | 说明                                                         |
| --------- | ------ | ------------------------------------------------------------ |
| id        | integer | 模块 ID                                                      |
| title     | string | 模块标题                                                     |
| type_code | string | 模块类型代码：`imitation_reading`、`listening_selection`、`question_answering`、`passage_retelling` |
| count     | integer | 该模块下的题目数量                                           |

**说明**:

- 此接口返回所有可用的练习模块列表
- `type_code` 用于前端识别模块类型，用于后续获取题目列表时的筛选

---

### 2.2 获取练习题目列表

**接口路径**: `GET /miniprogram/practice/questions`

**请求参数** (Query Parameters):

| 参数名          | 类型    | 必填 | 说明                                     |
| --------------- | ------- | ---- | ---------------------------------------- |
| question_type_id | integer | 否   | 题目类型 ID，对应练习模块的 ID           |
| difficulty      | string  | 否   | 难度筛选                                 |
| search          | string  | 否   | 搜索关键词，支持按题目标题、内容等关键字搜索 |
| skip            | integer | 否   | 跳过记录数，用于分页，默认 0             |
| limit           | integer | 否   | 返回记录数，默认 20                       |

**认证**: 需要 (Bearer Token)

**响应数据**:

```json
[
  {
    "id": 201,
    "title": "Unit 1 - 日常对话练习",
    "type": "imitation",
    "difficulty": 0.3,
    "audio_url": "https://example.com/audio/question_201.mp3",
    "content": "题目内容文本...",
    "created_at": "2024-09-01T08:00:00Z"
  },
  {
    "id": 202,
    "title": "Unit 2 - 听力理解",
    "type": "listening",
    "difficulty": 0.5,
    "audio_url": "https://example.com/audio/question_202.mp3",
    "content": "题目内容文本...",
    "options": ["选项A", "选项B", "选项C", "选项D"],
    "created_at": "2024-09-01T08:00:00Z"
  }
]
```

**响应字段说明**:

| 字段       | 类型    | 说明                                                         |
| ---------- | ------- | ------------------------------------------------------------ |
| id         | integer | 题目 ID                                                      |
| title      | string  | 题目名称                                                     |
| type       | string  | 题目类型：`imitation`、`listening`、`answering`、`retelling` |
| difficulty | float   | 难度值 0-1，越接近1越难                                      |
| audio_url  | string  | 题目音频 URL（如果有）                                       |
| content    | string  | 题目内容文本                                                 |
| options    | array   | 选项列表（仅听选信息题型有）                                 |
| created_at | string  | 创建时间 (ISO 8601 格式)                                     |

**说明**:

- 支持按题目类型和难度筛选
- 支持关键字搜索（`search` 参数），可搜索题目标题、内容等
- 支持分页查询
- 不同题型返回的字段可能不同，前端需要根据 `type` 字段判断
- 多个筛选条件可以组合使用

---

## 3. 考试相关

### 3.1 获取考试分类列表

**接口路径**: `GET /miniprogram/exam/categories`

**请求参数**: 无

**认证**: 需要 (Bearer Token)

**响应数据**:

```json
[
  {
    "id": 1,
    "title": "单元测试",
    "icon": "📚",
    "count": 12,
    "category_type": "unit_test"
  },
  {
    "id": 2,
    "title": "阶段测试",
    "icon": "📊",
    "count": 8,
    "category_type": "stage_test"
  },
  {
    "id": 3,
    "title": "综合模拟",
    "icon": "🎯",
    "count": 15,
    "category_type": "mock_exam"
  }
]
```

**响应字段说明**:

| 字段          | 类型    | 说明                                                         |
| ------------- | ------- | ------------------------------------------------------------ |
| id            | integer | 分类 ID                                                      |
| title         | string  | 分类标题                                                     |
| icon          | string  | 分类图标（可选，前端也可以根据 category_type 自行设置）      |
| count         | integer | 该分类下的考试数量                                           |
| category_type | string  | 分类类型：`unit_test`(单元测试)、`stage_test`(阶段测试)、`mock_exam`(综合模拟) |

**说明**:

- 此接口返回所有可用的考试分类列表
- `category_type` 用于前端识别分类类型
- `count` 表示该分类下的考试套题数量

---

### 3.2 获取指定分类下的考试列表

**接口路径**: `GET /miniprogram/exam/list`

**请求参数** (Query Parameters):

| 参数名        | 类型    | 必填 | 说明                                                         |
| ------------- | ------- | ---- | ------------------------------------------------------------ |
| category_id   | integer | 否   | 分类 ID，筛选特定分类下的考试                                |
| category_type | string  | 否   | 分类类型筛选：`unit_test`、`stage_test`、`mock_exam`        |
| skip          | integer | 否   | 跳过记录数，用于分页，默认 0                                 |
| limit         | integer | 否   | 返回记录数，默认 100                                         |

**认证**: 需要 (Bearer Token)

**响应数据**:

```json
[
  {
    "id": 301,
    "title": "第1单元测试",
    "category_id": 1,
    "category_type": "unit_test"
  },
  {
    "id": 302,
    "title": "第2单元测试",
    "category_id": 1,
    "category_type": "unit_test"
  }
]
```

**响应字段说明**:

| 字段          | 类型    | 说明                                                         |
| ------------- | ------- | ------------------------------------------------------------ |
| id            | integer | 考试 ID                                                      |
| title         | string  | 考试标题                                                     |
| category_id   | integer | 所属分类 ID                                                  |
| category_type | string  | 分类类型                                                     |

**说明**:

- 支持按分类 ID 或分类类型筛选
- 支持分页查询
- 通常用于在用户展开某个分类时，懒加载该分类下的考试列表

---

### 3.3 获取考试题目列表

**接口路径**: `GET /miniprogram/exam/questions`

**请求参数** (Query Parameters):

| 参数名  | 类型    | 必填 | 说明                         |
| ------- | ------- | ---- | ---------------------------- |
| exam_id | integer | 否   | 考试 ID，筛选特定考试的题目  |
| skip    | integer | 否   | 跳过记录数，用于分页，默认 0 |
| limit   | integer | 否   | 返回记录数，默认 20          |

**认证**: 需要 (Bearer Token)

**响应数据**:

```json
[
  {
    "id": 301,
    "title": "Unit 1 Test - Question 1",
    "type": "exam",
    "difficulty": 0.6,
    "audio_url": "https://example.com/audio/exam_301.mp3",
    "content": "考试题目内容...",
    "created_at": "2024-09-01T08:00:00Z"
  }
]
```

**响应字段说明**:

| 字段       | 类型    | 说明                        |
| ---------- | ------- | --------------------------- |
| id         | integer | 题目 ID                     |
| title      | string  | 题目名称                    |
| type       | string  | 题目类型，固定为 `exam`     |
| difficulty | float   | 难度值 0-1                  |
| audio_url  | string  | 题目音频 URL                |
| content    | string  | 题目内容文本                |
| created_at | string  | 创建时间 (ISO 8601 格式)    |

**说明**:

- 考试题目列表，支持按考试 ID 筛选
- 支持分页查询
- 考试题目通常是综合性的，包含多种题型
- 当提供 `exam_id` 时，返回该考试下的所有题目

---

## 4. 题目详情相关

### 4.1 获取题目详情

**接口路径**: `GET /miniprogram/questions/{questionId}`

**路径参数**:

| 参数名     | 类型    | 必填 | 说明   |
| ---------- | ------- | ---- | ------ |
| questionId | integer | 是   | 题目 ID |

**认证**: 需要 (Bearer Token)

**响应数据**:

```json
{
  "id": 201,
  "title": "Unit 1 - 日常对话练习",
  "type": "imitation",
  "mode": "practice",
  "difficulty": 0.3,
  "audio_url": "https://example.com/audio/question_201.mp3",
  "content": "题目详细内容文本...",
  "instructions": "请模仿朗读以下对话",
  "reference_text": "参考文本...",
  "options": null,
  "created_at": "2024-09-01T08:00:00Z"
}
```

**响应字段说明**:

| 字段           | 类型    | 说明                                                         |
| -------------- | ------- | ------------------------------------------------------------ |
| id             | integer | 题目 ID                                                      |
| title          | string  | 题目名称                                                     |
| type           | string  | 题目类型：`imitation`、`listening`、`answering`、`retelling`、`exam` |
| mode           | string  | 模式：`practice`(练习)、`exam`(考试)                         |
| difficulty     | float   | 难度值 0-1                                                   |
| audio_url      | string  | 题目音频 URL                                                 |
| content        | string  | 题目内容文本                                                 |
| instructions   | string  | 题目说明/提示                                                |
| reference_text | string  | 参考文本（模仿朗读、短文复述等题型使用）                     |
| options        | array   | 选项列表（听选信息题型使用），其他题型为 null                |
| created_at     | string  | 创建时间 (ISO 8601 格式)                                     |

**说明**:

- 返回题目的详细信息，包括完整的题目内容、音频、参考文本等
- 不同题型返回的字段可能不同

---

## 5. 答题记录相关

### 5.1 提交答题记录

**接口路径**: `POST /miniprogram/answers/{studentId}`

**路径参数**:

| 参数名    | 类型    | 必填 | 说明   |
| --------- | ------- | ---- | ------ |
| studentId | integer | 是   | 学生 ID |

**请求参数** (Request Body):

| 参数名          | 类型   | 必填 | 说明                                                         |
| --------------- | ------ | ---- | ------------------------------------------------------------ |
| question_id     | integer | 是   | 题目 ID                                                      |
| answer_text     | string | 否   | 文字答案（回答问题、短文复述等题型使用）                     |
| audio_url       | string | 否   | 学生录音 URL（模仿朗读、短文复述等题型使用）                 |
| selected_options | string | 否   | 选中的选项（JSON 字符串，听选信息题型使用，如：`["A", "B"]`） |

**请求示例**:

```json
{
  "question_id": 201,
  "audio_url": "https://example.com/audio/student_answer_12345.mp3"
}
```

**认证**: 需要 (Bearer Token)

**响应数据**:

```json
{
  "id": 1001,
  "student_id": 101,
  "question_id": 201,
  "answer_text": null,
  "audio_url": "https://example.com/audio/student_answer_12345.mp3",
  "selected_options": null,
  "score": 95,
  "grade": "优秀",
  "status": "submitted",
  "submitted_at": "2025-01-15T10:30:00Z"
}
```

**响应字段说明**:

| 字段             | 类型    | 说明                                                         |
| ---------------- | ------- | ------------------------------------------------------------ |
| id               | integer | 答题记录 ID                                                  |
| student_id       | integer | 学生 ID                                                      |
| question_id      | integer | 题目 ID                                                      |
| answer_text      | string  | 文字答案（如果有）                                           |
| audio_url        | string  | 学生录音 URL（如果有）                                       |
| selected_options | string  | 选中的选项（JSON 字符串，如果有）                            |
| score            | integer | 得分                                                         |
| grade            | string  | 等级：`优秀`(>=90)、`及格`(60-89)、`低分`(<60)              |
| status           | string  | 状态：`submitted`(已提交)                                    |
| submitted_at     | string  | 提交时间 (ISO 8601 格式)                                     |

**说明**:

- 提交答题记录后，后端会自动评分并返回评分结果
- 不同题型需要提交不同的答案字段：
  - 模仿朗读、短文复述：主要提交 `audio_url`
  - 听选信息：主要提交 `selected_options`（JSON 字符串）
  - 回答问题：主要提交 `answer_text` 或 `audio_url`
- 前端需要先将学生录音上传到服务器（或使用微信小程序云存储），获取 `audio_url` 后再提交
- 等级判断规则：
  - `优秀`: score >= 90
  - `及格`: 60 <= score < 90
  - `低分`: score < 60

---

## 6. 通用响应格式

**注意**: 小程序接口的响应格式与管理后台接口格式不同，小程序接口使用简化的响应格式，便于前端直接使用。

### 成功响应

**列表接口**（如获取练习模块、题目列表等），直接返回数组：

```json
[{...}, {...}]
```

**详情接口**（如获取题目详情、提交答题记录等），直接返回对象：

```json
{...}
```

**操作接口**（如登录），返回包含 `success` 字段的对象：

```json
{
  "success": true,
  "message": "操作成功",
  ...其他字段
}
```

### 错误响应

**方式一**: 返回包含 `success: false` 的对象（推荐，便于前端统一处理）：

```json
{
  "success": false,
  "message": "错误描述"
}
```

**方式二**: 使用 HTTP 状态码表示错误（4xx, 5xx），响应体可以包含错误信息：

```json
{
  "detail": "错误描述"
}
```

或

```json
{
  "message": "错误描述"
}
```

**说明**: 前端会优先尝试从 `detail`、`message`、`error`、`msg` 等字段中提取错误消息。

### HTTP 状态码

- `200`: 成功
- `400`: 请求参数错误
- `401`: 未授权，需要登录或 token 无效
- `403`: 无权限访问
- `404`: 资源不存在
- `500`: 服务器内部错误

### 响应格式说明

小程序端代码中，`request` 函数会直接返回 `res.data`，因此：
- 列表接口应该直接返回数组，不要包装在 `{ code, data }` 中
- 详情接口应该直接返回对象，不要包装在 `{ code, data }` 中
- 操作接口（如登录）可以返回包含 `success` 字段的对象

这样设计是为了简化前端代码，减少数据解包的步骤。

---

## 7. 数据字典

### 7.1 题目类型枚举

- `imitation`: 模仿朗读
- `listening`: 听选信息
- `answering`: 回答问题
- `retelling`: 短文复述及提问
- `exam`: 考试（综合测试）

### 7.2 模块类型代码枚举

- `imitation_reading`: 模仿朗读
- `listening_selection`: 听选信息
- `question_answering`: 回答问题
- `passage_retelling`: 短文复述

### 7.3 模式枚举

- `practice`: 练习
- `exam`: 考试

### 7.4 考试分类类型枚举

- `unit_test`: 单元测试
- `stage_test`: 阶段测试
- `mock_exam`: 综合模拟

### 7.5 等级枚举

- `优秀`: score >= 90
- `及格`: 60 <= score < 90
- `低分`: score < 60

### 7.6 答题状态枚举

- `submitted`: 已提交
- `pending`: 待提交（暂未使用）

---

## 8. 注意事项

1. **认证**: 除登录接口外，所有接口都需要在请求头中携带 `Authorization: Bearer <token>`
2. **Token 存储**: 前端使用 `wx.setStorageSync('token', token)` 存储 token，使用 `wx.getStorageSync('token')` 读取
3. **分页**: 列表接口支持分页，使用 `skip` 和 `limit` 参数
4. **时间格式**: 所有时间字段使用 ISO 8601 格式：`YYYY-MM-DDTHH:mm:ssZ`
5. **音频 URL**: 
   - 题目音频 URL 由后端提供，前端可直接用于播放
   - 学生录音需要先上传（可使用微信小程序云存储或后端文件上传接口），获取 URL 后提交
6. **请求头**: 
   - 默认 Content-Type: `application/json`
   - 自动添加 `Authorization` 头（如果有 token）
7. **错误处理**: 
   - HTTP 状态码 200-299 视为成功
   - 其他状态码视为失败，会抛出 `ApiError` 异常
   - 错误响应体可能包含以下字段之一：`detail`、`message`、`error`、`msg`
   - 前端会从错误响应体中提取错误消息并显示给用户
   - 例如：后端返回 HTTP 401 + `{"detail": "Invalid username or password"}` 时，前端会显示 "Invalid username or password"
8. **Base URL 配置**: 
   - 当前默认: `http://localhost:8000/api/v1`
   - 生产环境需要修改为实际的服务器地址
   - 建议通过配置文件或环境变量管理

---

## 9. 待实现/待优化接口

以下接口在前端代码中可能需要，但当前接口可能需要完善：

1. **文件上传接口** - 用于上传学生录音文件，获取音频 URL
   - 建议路径: `POST /miniprogram/upload/audio`
   - 返回: `{ "url": "https://..." }`

2. **获取学生答题历史记录** - 用于查看学生的答题历史
   - 建议路径: `GET /miniprogram/answers`
   - 支持筛选: `question_id`, `student_id`, `skip`, `limit`

3. **获取学生信息** - 用于个人中心显示学生信息
   - 建议路径: `GET /miniprogram/student/info`
   - 返回学生详细信息

4. **修改密码** - 用于学生修改登录密码
   - 建议路径: `POST /miniprogram/student/change-password`

---

## 10. 接口路径规范说明

当前小程序接口路径使用 `/miniprogram/*` 前缀，与管理后台的 `/v1/*` 路径区分。

**建议的路径结构**:
- 小程序接口: `/api/v1/miniprogram/*`
- 管理后台接口: `/api/v1/*` (已在 API_MANGER_DOC.md 中定义)

这样可以在同一个后端服务中区分不同客户端的接口，便于管理和维护。

---

## 更新日志

- 2025-01-15: 
  - 初始版本，包含认证、练习、考试、题目详情、答题记录相关接口
  - 新增：获取考试分类列表接口 (`GET /miniprogram/exam/categories`)
  - 新增：获取指定分类下的考试列表接口 (`GET /miniprogram/exam/list`)
  - 更新：获取考试题目列表接口，添加 `exam_id` 参数支持
  - 移除：练习页面和考试页面的模拟数据，改为真实API调用

