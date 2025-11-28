# EchoValley

A mini-program about English learning built with WeChat Mini Program, TypeScript, and Less.

## 项目简介

EchoValley 是一个专注于英语学习的微信小程序，为用户提供便捷的英语听说练习的工具和资源。

## 技术栈

- **框架**: 微信小程序
- **语言**: TypeScript
- **样式**: Less
- **组件框架**: glass-easel
- **渲染方式**: Skyline

## 项目结构

```
EchoValley/
├── miniprogram/          # 小程序源码目录
│   ├── app.ts           # 小程序入口文件
│   ├── app.json         # 小程序全局配置
│   ├── app.less         # 小程序全局样式
│   ├── pages/           # 页面目录
│   ├── components/      # 组件目录
│   └── utils/           # 工具函数目录
├── typings/             # TypeScript 类型定义
├── project.config.json  # 项目配置文件
└── tsconfig.json        # TypeScript 配置

```

## 开发指南

### 环境要求

- Node.js >= 14.0.0
- 微信开发者工具

### 安装依赖

```bash
npm install
```

### 开发工具

- **代码检查**: `npm run lint`
- **代码修复**: `npm run lint:fix`
- **代码格式化**: `npm run format`
- **格式化检查**: `npm run format:check`

### 开发流程

1. 使用微信开发者工具打开项目
2. 在 `miniprogram` 目录下进行开发
3. 使用 TypeScript 编写代码
4. 使用 Less 编写样式

## 开发规范

### 代码风格

- 使用 TypeScript 严格模式
- 遵循 ESLint 规则
- 使用 Prettier 进行代码格式化
- 使用 2 空格缩进

### 文件命名

- 页面文件：小写字母，单词间使用连字符（如：`user-profile`）
- 组件文件：小写字母，单词间使用连字符（如：`navigation-bar`）
- TypeScript 文件：使用 `.ts` 扩展名
- Less 文件：使用 `.less` 扩展名

## 许可证

MIT License
