# 桂园听说 - 教师管理后台 API 接口文档

本文档描述了教师管理后台系统所需的所有 API 接口，用于前后端开发沟通。

## 基础信息

- **Base URL**: `/api` (可通过环境变量 `VITE_API_BASE_URL` 配置)
- **认证方式**: Bearer Token (在请求头中传递 `Authorization: Bearer <token>`)
- **数据格式**: JSON

---

## 1. 认证相关

### 1.1 教师登录

**接口路径**: `POST /v1/auth/login`

**请求参数** (Request Body):

| 参数名   | 类型   | 必填 | 说明     |
| -------- | ------ | ---- | -------- |
| username | string | 是   | 教师账号 |
| password | string | 是   | 登录密码 |

**请求示例**:

```json
{
  "username": "teacher001",
  "password": "password123"
}
```

**响应数据**:

```json
{
  "code": 200,
  "message": "登录成功",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": 1,
      "name": "张老师",
      "username": "teacher001",
      "role": "teacher"
    }
  }
}
```

**响应字段说明**:

| 字段               | 类型    | 说明                          |
| ------------------ | ------- | ----------------------------- |
| code               | integer | 状态码，200 表示成功          |
| message            | string  | 响应消息                      |
| data               | object  | 响应数据                      |
| data.token         | string  | JWT Token，用于后续请求的认证 |
| data.user          | object  | 用户信息                      |
| data.user.id       | integer | 用户 ID                       |
| data.user.name     | string  | 教师姓名                      |
| data.user.username | string  | 教师账号                      |
| data.user.role     | string  | 角色，固定为 "teacher"        |

**错误响应**:

```json
{
  "code": 401,
  "message": "账号或密码错误",
  "data": null
}
```

**说明**:

- 此接口不需要认证，登录成功后返回的 `token` 需要保存，后续所有接口都需要在请求头中携带 `Authorization: Bearer <token>`
- 前端会将 `token` 存储到 `localStorage` 中（key: `token`），用户信息存储到 `localStorage` 中（key: `userInfo`）
- 当账号或密码错误时，返回 HTTP 401 状态码或 code 401，前端会显示错误信息
- Token 有效期内可用于后续所有需要认证的接口请求

---

## 2. 学习情况相关

### 2.1 获取学生答题记录列表

**接口路径**: `GET /v1/student-answers`

**请求参数** (Query Parameters):
| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| skip | integer | 否 | 跳过记录数，用于分页，默认 0 |
| limit | integer | 否 | 返回记录数，默认 100，最大 1000 |
| question_id | integer | 否 | 题目 ID，筛选特定题目的答题记录 |
| grade | string | 否 | 等级筛选：`优秀`、`及格`、`低分` |
| search | string | 否 | 搜索关键词，支持按学生姓名、学号、班级搜索 |
| mode | string | 否 | 模式筛选：`practice`(练习)、`exam`(考试) |
| question_type | string | 否 | 题型筛选：`imitation`(模仿朗读)、`listening`(听选信息)、`answering`(回答问题)、`retelling`(短文复述及提问) |
| class | string | 否 | 班级筛选，如：`初一(1)班` |

**响应数据**:

```json
{
  "code": 200,
  "message": "获取成功",
  "data": {
    "total": 100, // 总记录数
    "items": [
      {
        "id": 1, // 答题记录ID
        "student_id": 101, // 学生ID
        "question_id": 201, // 题目ID
        "student_name": "张三", // 学生姓名
        "student_student_id": "2024001", // 学号
        "student_class": "初一(1)班", // 学生班级（需要关联查询）
        "question_title": "Unit 1 - 日常对话练习", // 题目名称
        "score": 95, // 得分
        "max_score": 100, // 满分
        "grade": "优秀", // 等级：优秀、及格、低分
        "audio_url": "https://example.com/audio/answer_1.mp3", // 学生录音URL
        "status": "submitted", // 状态：submitted(已提交)、pending(待提交)
        "submitted_at": "2025-01-15T10:30:00Z" // 提交时间
      }
    ]
  }
}
```

**说明**:

- 等级判断规则：
  - `优秀`: score >= 90
  - `及格`: 70 <= score < 90 或 60 <= score < 70
  - `低分`: score < 60
- `student_class` 字段需要通过关联查询学生表获取
- 支持多条件组合筛选

---

## 3. 学生管理相关

### 3.1 获取学生列表

**接口路径**: `GET /v1/students`

**请求参数** (Query Parameters):
| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| skip | integer | 否 | 跳过记录数，默认 0 |
| limit | integer | 否 | 返回记录数，默认 10 |
| grade | string | 否 | 年级筛选：`初一`、`初二`、`初三` |
| class | string | 否 | 班级筛选，如：`1班` |
| search | string | 否 | 搜索关键词，支持按姓名、学号搜索 |

**响应数据**:

```json
{
  "code": 200,
  "message": "获取成功",
  "data": {
    "total": 50,
    "items": [
      {
        "id": 101,
        "student_id": "2024001", // 学号
        "name": "张三",
        "grade": "初一", // 年级
        "class": "1班", // 班级
        "created_at": "2024-09-01T08:00:00Z"
      }
    ]
  }
}
```

### 3.2 创建学生

**接口路径**: `POST /v1/students`

**请求参数**:

```json
{
  "student_id": "string", // 学号，必填，唯一
  "name": "string", // 姓名，必填
  "grade": "string", // 年级：初一、初二、初三，必填
  "class": "string" // 班级，必填，如：1班
}
```

**响应数据**:

```json
{
  "code": 200,
  "message": "创建成功",
  "data": {
    "id": 101,
    "student_id": "2024001",
    "name": "张三",
    "grade": "初一",
    "class": "1班",
    "created_at": "2025-01-15T10:00:00Z"
  }
}
```

**错误响应**:

```json
{
  "code": 400,
  "message": "学号已存在",
  "data": null
}
```

### 3.3 更新学生信息

**接口路径**: `PUT /v1/students/{id}`

**请求参数**:

```json
{
  "student_id": "string", // 学号，可选
  "name": "string", // 姓名，可选
  "grade": "string", // 年级，可选
  "class": "string" // 班级，可选
}
```

**响应数据**:

```json
{
  "code": 200,
  "message": "更新成功",
  "data": {
    "id": 101,
    "student_id": "2024001",
    "name": "张三",
    "grade": "初一",
    "class": "1班",
    "updated_at": "2025-01-15T10:30:00Z"
  }
}
```

### 3.4 删除学生

**接口路径**: `DELETE /v1/students/{id}`

**响应数据**:

```json
{
  "code": 200,
  "message": "删除成功",
  "data": null
}
```

### 3.5 批量导入学生

**接口路径**: `POST /v1/students/batch-import`

**请求参数** (Form Data):

- `file`: CSV 文件，格式如下：
  ```csv
  学号,姓名,年级,班级
  2024001,张三,初一,1班
  2024002,李四,初一,1班
  ```

**响应数据**:

```json
{
  "code": 200,
  "message": "导入成功",
  "data": {
    "success_count": 45, // 成功导入数量
    "failed_count": 5, // 失败数量
    "failed_items": [
      // 失败详情
      {
        "row": 3,
        "reason": "学号已存在"
      }
    ]
  }
}
```

### 3.6 导出学生列表

**接口路径**: `GET /v1/students/export`

**请求参数**: 同获取学生列表接口的查询参数

**响应**: 返回 CSV 文件下载

---

## 4. 题目管理相关

### 4.1 获取题目列表

**接口路径**: `GET /v1/questions`

**请求参数** (Query Parameters):
| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| skip | integer | 否 | 跳过记录数，默认 0 |
| limit | integer | 否 | 返回记录数，默认 10 |
| mode | string | 否 | 模式筛选：`practice`(练习)、`exam`(考试) |
| type | string | 否 | 题型筛选：`imitation`、`listening`、`answering`、`retelling`、`exam`(考试) |
| difficulty_min | float | 否 | 最小难度值 (0-1) |
| difficulty_max | float | 否 | 最大难度值 (0-1) |

**响应数据**:

```json
{
  "code": 200,
  "message": "获取成功",
  "data": {
    "total": 20,
    "items": [
      {
        "id": 201,
        "title": "Unit 1 - 日常对话练习",
        "mode": "practice", // practice 或 exam
        "type": "imitation", // imitation, listening, answering, retelling, exam
        "difficulty": 0.3, // 难度值 0-1，越接近1越难
        "created_at": "2024-09-01T08:00:00Z"
      }
    ]
  }
}
```

### 4.2 获取单个题目详情

**接口路径**: `GET /v1/questions/{question_id}`

**路径参数**:
| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| question_id | integer | 是 | 题目ID |

**响应数据**:

```json
{
  "code": 200,
  "message": "获取成功",
  "data": {
    "id": 201,
    "title": "Unit 1 - 日常对话练习",
    "mode": "practice", // practice、exam 或 unspecified（未指定）
    "type": "imitation", // imitation, listening, answering, retelling
    "difficulty": 3, // 难度值 1-5 整数，1最简单，5最难
    "difficulty_float": 0.5, // 难度值 0-1 浮点数（向后兼容）
    "content_json": {}, // 题目内容和配置（JSON格式），根据题型不同格式不同，详见下方说明
    "is_active": true, // 是否启用
    "usage_type": 1, // 题目用途：0=未指定, 1=专项练习, 2=试卷
    "created_at": "2024-09-01T08:00:00Z",
    "updated_at": "2024-09-01T09:00:00Z"
  }
}
```

**content_json 字段格式说明**:

不同题型的 `content_json` 格式不同，具体如下：

1. **模仿朗读 (type=imitation)**
   ```json
   {
     "content": "需要模仿朗读的文本内容",
     "audio_url": "音频文件URL"
   }
   ```

2. **听选信息 (type=listening)**
   ```json
   [
     {
       "text": {
         "content": "第一段对话文本内容",
         "audio_url": "第一段对话音频URL"
       },
       "questions": [
         {
           "content": "第一个问题的内容",
           "audio_url": "第一个问题的音频URL"
         },
         {
           "content": "第二个问题的内容",
           "audio_url": "第二个问题的音频URL"
         }
       ]
     },
     // ... 共3段对话
   ]
   ```

3. **回答问题 (type=answering)**
   ```json
   {
     "text": {
       "content": "短文文本内容或提示信息",
       "audio_url": "短文音频文件URL"
     },
     "questions": [
       {
         "content": "第一个问题的内容",
         "audio_url": "第一个问题的音频文件URL"
       },
       // ... 共4个问题
     ]
   }
   ```

4. **短文复述及提问 (type=retelling)**
   ```json
   {
     "text": {
       "theme": "主题描述（中文）",
       "example": "示例文本内容（英文短文）",
       "img_url": "图片URL"
     },
     "questions": [
       {
         "content": "第一个问题的内容（中文）",
         "audio_url": "第一个问题的音频文件URL"
       },
       {
         "content": "第二个问题的内容（中文）",
         "audio_url": "第二个问题的音频文件URL"
       }
     ]
   }
   ```

**错误响应**:

```json
{
  "code": 404,
  "message": "题目不存在",
  "data": null
}
```

**说明**:

- 此接口用于获取单个题目的详细信息，包括完整的 `content_json` 内容
- `difficulty` 字段返回 1-5 整数，`difficulty_float` 字段返回 0-1 浮点数（用于向后兼容）
- `content_json` 的格式根据题型不同而不同，详见上方说明

---

### 4.3 创建题目

**接口路径**: `POST /v1/questions`

**请求参数**:

```json
{
  "title": "string", // 题目名称，必填
  "mode": "string", // practice 或 exam，必填
  "type": "string", // 题型，必填：imitation(模仿朗读)、listening(听选信息)、answering(回答问题)、retelling(短文复述及提问)
  "difficulty": 0.5, // 难度值 0-1，必填
  "content_json": {} // 题目内容和配置（JSON格式），根据题型不同格式不同，详见下方说明
}
```

**content_json 字段说明**:

不同题型的 `content_json` 格式不同：

1. **模仿朗读 (type=imitation)**
   ```json
   {
     "content": "需要模仿朗读的文本内容",
     "audio_url": "音频文件URL（可选，暂不支持可传空字符串）"
   }
   ```
   示例：
   ```json
   {
     "content": "Do you want to be my pen friend? My name is Kate. I'm a student from Sunshine Middle School.",
     "audio_url": ""
   }
   ```

2. **听选信息 (type=listening)**
   ```json
   [
     {
       "text": {
         "content": "第一段对话文本内容",
         "audio_url": "第一段对话音频URL（可选，暂不支持可传空字符串）"
       },
       "questions": [
         {
           "content": "第一个问题的内容",
           "audio_url": "第一个问题的音频URL（可选，暂不支持可传空字符串）"
         },
         {
           "content": "第二个问题的内容",
           "audio_url": "第二个问题的音频URL（可选，暂不支持可传空字符串）"
         }
       ]
     },
     {
       "text": {
         "content": "第二段对话文本内容",
         "audio_url": ""
       },
       "questions": [
         {
           "content": "第三个问题的内容",
           "audio_url": ""
         },
         {
           "content": "第四个问题的内容",
           "audio_url": ""
         }
       ]
     },
     {
       "text": {
         "content": "第三段对话文本内容",
         "audio_url": ""
       },
       "questions": [
         {
           "content": "第五个问题的内容",
           "audio_url": ""
         },
         {
           "content": "第六个问题的内容",
           "audio_url": ""
         }
       ]
     }
   ]
   ```
   说明：
   - 数组固定包含3个对象，对应三段对话
   - 每个对象包含 `text` 和 `questions` 两个字段
   - `text` 字段包含对话的文本内容和音频URL
   - `questions` 字段是一个数组，固定包含2个问题对象
   - 每个问题对象包含问题的文本内容和音频URL

3. **其他题型（待补充）**

**响应数据**:

```json
{
  "code": 200,
  "message": "创建成功",
  "data": {
    "id": 201,
    "title": "Unit 1 - 日常对话练习",
    "mode": "practice",
    "type": "imitation",
    "difficulty": 0.3,
    "created_at": "2025-01-15T10:00:00Z"
  }
}
```

### 4.4 更新题目

**接口路径**: `PUT /v1/questions/{question_id}`

**请求参数**:

```json
{
  "title": "string", // 可选
  "mode": "string", // 可选
  "type": "string", // 可选
  "difficulty": 0.5 // 可选
}
```

**响应数据**: 同创建题目接口

### 4.5 删除题目

**接口路径**: `DELETE /v1/questions/{question_id}`

**响应数据**:

```json
{
  "code": 200,
  "message": "删除成功",
  "data": null
}
```

---

## 5. 试卷管理相关

### 5.1 创建试卷

**接口路径**: `POST /v1/exam-papers`

**请求参数**:

```json
{
  "name": "string", // 试卷名称，必填
  "description": "string", // 试卷描述，可选
  "section_config": { // 各题型配置（JSON格式），必填
    "section1": {
      "count": 1, // 题数
      "score": 25 // 分值
    },
    "section2": {
      "count": 1,
      "score": 25
    },
    "section3": {
      "count": 1,
      "score": 25
    },
    "section4": {
      "count": 1,
      "score": 25
    }
  },
  "time_limit": 1200, // 时间限制（秒），可选，默认1200秒（20分钟）
  "total_score": 100 // 试卷总分，可选，默认100分
}
```

**说明**:
- `section_config` 必须包含 `section1`、`section2`、`section3`、`section4` 四个部分，分别对应4种题型
- `section1`: 模仿朗读
- `section2`: 听选信息
- `section3`: 回答问题
- `section4`: 短文复述及提问
- 各题型分值之和必须等于 `total_score`
- `time_limit` 单位为秒，默认1200秒（20分钟）

**响应数据**:

```json
{
  "code": 200,
  "message": "创建成功",
  "data": {
    "id": 1,
    "name": "期中考试试卷",
    "description": "期中考试综合测试",
    "section_config": {
      "section1": {"count": 1, "score": 25},
      "section2": {"count": 1, "score": 25},
      "section3": {"count": 1, "score": 25},
      "section4": {"count": 1, "score": 25}
    },
    "time_limit": 1200,
    "total_score": 100,
    "is_active": true,
    "created_by": null,
    "created_at": "2025-01-15T10:00:00Z",
    "updated_at": null
  }
}
```

**错误响应**:

```json
{
  "code": 400,
  "message": "各题型分值之和（75）与试卷总分（100）不一致",
  "data": null
}
```

### 5.2 创建试卷题目关联关系

**接口路径**: `POST /v1/paper-questions`

**请求参数**:

```json
{
  "paper_id": 1, // 试卷ID，必填
  "question_id": 201, // 题目ID，必填
  "question_type": 1, // 题型，必填：1=模仿朗读, 2=听选信息, 3=回答问题, 4=短文复述及提问
  "section": 1, // 试卷部分（1-4对应4种题型），必填
  "order_num": 1, // 在section中的顺序，必填
  "max_score": 25.0 // 该题分值，必填
}
```

**说明**:
- `question_type` 必须与题目的实际题型匹配
- `section` 必须与 `question_type` 对应：
  - `section=1` 对应 `question_type=1`（模仿朗读）
  - `section=2` 对应 `question_type=2`（听选信息）
  - `section=3` 对应 `question_type=3`（回答问题）
  - `section=4` 对应 `question_type=4`（短文复述及提问）
- `order_num` 表示该题目在对应section中的顺序，通常为1（因为每个section只有一道题）

**响应数据**:

```json
{
  "code": 200,
  "message": "创建成功",
  "data": {
    "id": 1,
    "paper_id": 1,
    "question_id": 201,
    "question_type": 1,
    "section": 1,
    "order_num": 1,
    "max_score": 25.0,
    "created_at": "2025-01-15T10:00:00Z",
    "updated_at": null
  }
}
```

**错误响应**:

```json
{
  "code": 404,
  "message": "试卷不存在",
  "data": null
}
```

或

```json
{
  "code": 404,
  "message": "题目不存在",
  "data": null
}
```

或

```json
{
  "code": 400,
  "message": "题目题型（2）与指定的题型（1）不匹配",
  "data": null
}
```

**说明**:
- 创建试卷时，通常需要调用4次此接口，为每种题型各创建一道题目的关联关系
- 建议前端在创建试卷成功后，批量创建试卷题目关联关系

---

## 6. 通用响应格式

### 成功响应

```json
{
  "code": 200,
  "message": "操作成功",
  "data": { ... }
}
```

### 错误响应

```json
{
  "code": 400, // HTTP 状态码
  "message": "错误描述",
  "data": null
}
```

### 常见错误码

- `200`: 成功
- `400`: 请求参数错误
- `401`: 未授权，需要登录
- `403`: 无权限访问
- `404`: 资源不存在
- `500`: 服务器内部错误

---

## 7. 数据字典

### 6.1 年级枚举

- `初一`
- `初二`
- `初三`

### 6.2 等级枚举

- `优秀`: score >= 90
- `及格`: 60 <= score < 90
- `低分`: score < 60

### 6.3 题型枚举

- `imitation`: 模仿朗读
- `listening`: 听选信息
- `answering`: 回答问题
- `retelling`: 短文复述及提问
- `exam`: 考试（综合测试）

### 6.4 模式枚举

- `practice`: 练习
- `exam`: 考试

---

## 8. 注意事项

1. **认证**: 除登录接口外，所有接口都需要在请求头中携带 `Authorization: Bearer <token>`
2. **分页**: 所有列表接口都支持分页，建议前端使用 `skip` 和 `limit` 参数
3. **时间格式**: 所有时间字段使用 ISO 8601 格式：`YYYY-MM-DDTHH:mm:ssZ`
4. **音频 URL**: `audio_url` 字段返回的是完整的音频文件访问 URL，前端可直接用于播放
5. **班级字段**: 学生答题记录中的 `student_class` 需要通过关联查询获取，建议后端在返回数据时直接包含
6. **难度值**: 题目难度范围为 0-1，0 表示最简单，1 表示最难

---

## 9. 待实现接口

以下接口在前端代码中可能需要，但当前未实现，建议后端优先实现：

1. **获取题目列表** (`GET /v1/questions`) - 用于学习情况页面的题目筛选下拉框
2. **获取学生列表** (`GET /v1/students`) - 用于学生帐号管理页面
3. **学生 CRUD 接口** - 用于学生帐号管理的增删改查
4. **批量导入/导出学生** - 用于学生帐号管理的批量操作

---

## 更新日志

- 2025-01-15: 初始版本，包含学习情况、学生管理、题目管理相关接口
- 2025-01-15: 新增试卷管理接口，支持创建试卷和试卷题目关联关系
