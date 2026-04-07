# BatchImageStudio - AI 驱动的图片批量处理工具

> 基于 Tauri 2.x + React 19 的桌面应用，使用 LaMa AI 模型进行智能图片修复。

## 📁 项目结构

```
BatchImageStudio/
├── src/                          # React 前端源码
│   ├── components/               # 可复用组件
│   │   ├── builder/              # 模板构建组件
│   │   │   ├── PreviewCanvasCard.tsx    # 选区编辑画布
│   │   │   ├── RegionInputs.tsx         # 精确区域输入
│   │   │   ├── RegionSliders.tsx        # 滑块调整
│   │   │   └── ImageSampleList.tsx      # 样图列表
│   │   ├── layout/               # 布局组件
│   │   │   ├── AppShell.tsx              # 应用外壳
│   │   │   ├── SidebarNav.tsx            # 侧边栏导航
│   │   │   └── TopBar.tsx                # 顶部工具栏
│   │   ├── preview/              # 预览相关
│   │   │   └── ComparisonSlider.tsx      # 对比滑块
│   │   └── templates/            # 模板相关
│   │       ├── TemplateCard.tsx          # 模板卡片
│   │       └── TemplatePickerDialog.tsx  # 模板选择器
│   ├── screens/                  # 页面组件
│   │   ├── HomeScreen.tsx                # 首页
│   │   ├── TemplateBuilderScreen.tsx     # 模板构建页
│   │   ├── PreviewScreen.tsx             # 预览页
│   │   ├── BatchScreen.tsx               # 批量处理页
│   │   ├── TemplatesScreen.tsx           # 模板管理页
│   │   ├── HistoryScreen.tsx             # 历史记录页
│   │   └── SettingsScreen.tsx            # 设置页
│   ├── store/                   # Zustand 状态管理
│   │   └── workspace.ts                  # 主状态存储
│   ├── lib/                     # 工具函数
│   └── types.ts                 # TypeScript 类型定义
├── src-tauri/                   # Rust 后端
│   ├── src/
│   │   ├── lib.rs                # 主要逻辑
│   │   ├── model_runtime.rs     # 模型运行时
│   │   └── onnx_server.rs       # ONNX 服务器
│   └── Cargo.toml               # Rust 依赖
└── docs/                       # 文档
```

## 🎯 核心功能

### 1. 图片导入
- 支持拖拽上传
- 批量导入文件夹
- 生成缩略图

### 2. 模板构建系统
- 选择样图
- 框选处理区域
- 配置处理参数：
  - **适配模式**：贴右下角、跟随比例、固定位置
  - **处理方法**：智能修复、直接盖住、裁掉
- 保存和复用模板

### 3. AI 智能修复
- 基于 LaMa 模型
- 支持局部水印去除
- 实时预览效果

### 4. 批量处理
- 使用模板批量处理图片
- 进度追踪
- 失败重试

## 🔄 用户流程

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│  1.导入图片  │ -> │  2.框选区域  │ -> │  3.确认效果  │ -> │  4.批量处理  │
│   (首页)    │    │  (构建页)   │    │  (预览页)   │    │  (批量页)   │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
```

## 🛠️ 技术栈

| 类别 | 技术 |
|------|------|
| 前端框架 | React 19 + TypeScript |
| 状态管理 | Zustand |
| 样式 | Tailwind CSS |
| 桌面框架 | Tauri 2.x |
| 后端语言 | Rust |
| AI 模型 | LaMa (via ONNX Runtime) |

## 📝 开发规范

### 命名规范
- 组件：PascalCase (`PreviewCanvasCard.tsx`)
- 工具函数：camelCase (`formatRelativeTime`)
- 常量：UPPER_SNAKE_CASE (`DEFAULT_BLUR_SIGMA`)
- 类型：PascalCase (`ImportedImage`)

### 提交规范
```
feat: 新功能
fix: 修复 bug
refactor: 重构
style: 样式调整
docs: 文档更新
```

### 快捷键
| 快捷键 | 功能 |
|--------|------|
| ⌘1 | 首页 |
| ⌘2 | 模板构建 |
| ⌘3 | 效果预览 |
| ⌘4 | 批量处理 |
| ⌘S | 保存模板 |
| Delete | 删除当前图片 |

## 🚀 开发命令

```bash
# 启动开发环境
npm run tauri dev

# 构建生产版本
npm run build

# 运行测试
npm test
```

## 📧 联系方式

- GitHub: [BatchImageStudio](https://github.com/your-repo)
- 问题反馈: Issues
