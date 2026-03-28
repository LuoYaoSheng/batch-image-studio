# Batch Image Studio

> 模板驱动的桌面端图片局部批量处理工具

## 📥 下载

| 渠道 | 地址 | 说明 |
|------|------|------|
| **GitHub Releases** | [下载页面](https://github.com/LuoYaoSheng/batch-image-studio/releases) | ✅ 正式安装包，包含完整模型文件 |
| **安装说明** | [按平台查看](./docs/install.md) | macOS / Windows / Linux 专属安装步骤 |

> 当前建议统一从 GitHub Releases 下载正式安装包。每个版本都已包含内置 AI 模型，无需额外下载 `model.onnx`。

---

一款基于 Tauri + React + TypeScript 开发的本地批量图片处理工具，使用 LaMa AI 模型实现智能水印去除。

## ✨ 特性

- 🎯 **模板驱动** - 创建一次模板，复用于同类图片
- 🤖 **AI 智能修复** - 基于 LaMa 模型的图像修复
- 🖼️ **多种处理方式** - AI修复、纯色填充、裁切
- 📐 **灵活定位** - 右下角锚定、按比例定位、固定像素
- ⚡ **批量处理** - 支持批量导入和处理图片
- 📋 **历史记录** - 任务历史和模板复用
- 🔒 **本地处理** - 所有处理在本地完成，保护隐私

## 🚀 快速开始

### 安装应用

- 普通用户：直接从 [GitHub Releases](https://github.com/LuoYaoSheng/batch-image-studio/releases) 下载
- 安装步骤：查看 [安装指南](./docs/install.md)

### 环境要求

- Node.js 18+
- Rust (用于编译 Tauri)
- pnpm

### 安装

```bash
# 克隆仓库
git clone https://github.com/LuoYaoSheng/batch-image-studio.git
cd batch-image-studio

# 安装依赖
pnpm install
```

### 开发

```bash
# 启动开发服务器
pnpm tauri dev
```

### 构建

```bash
# 构建生产版本
pnpm build
```

## 📖 使用指南

### 基本流程

1. **导入图片** - 拖拽或选择需要处理的图片
2. **选择样图** - 从导入的图片中选择一张作为样图
3. **框选区域** - 在样图上框选需要处理的水印/瑕疵区域
4. **配置参数** - 选择处理方式和定位方式
5. **预览效果** - 查看处理效果，确认满意后保存模板
6. **批量处理** - 使用保存的模板批量处理同类图片

### 快捷键

| 快捷键 | 功能 |
|--------|------|
| `⌘/Ctrl + 1` | 首页 |
| `⌘/Ctrl + 2` | 模板构建 |
| `⌘/Ctrl + 3` | 效果预览 |
| `⌘/Ctrl + 4` | 批量执行 |
| `⌘/Ctrl + ,` | 设置 |
| `⌘/Ctrl + /` | 显示快捷键帮助 |

## 🛠️ 技术栈

- **前端框架**: React 19
- **语言**: TypeScript
- **样式**: Tailwind CSS
- **桌面框架**: Tauri 2.x
- **AI 模型**: LaMa (Large Mask Inpainting)

## 📁 项目结构

```
src/
├── components/       # 可复用组件
│   ├── builder/      # 模板构建相关组件
│   ├── layout/       # 布局组件
│   ├── preview/      # 预览相关组件
│   └── ...
├── screens/          # 页面组件
├── store/            # 状态管理
├── lib/              # 工具函数
├── types/            # 类型定义
└── styles.css        # 全局样式
```

## 📄 许可证

MIT License

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📮 联系方式

- 作者: LuoYaoSheng
- GitHub: [@LuoYaoSheng](https://github.com/LuoYaoSheng)
