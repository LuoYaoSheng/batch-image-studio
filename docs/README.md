# Batch Image Studio

模板驱动的桌面端图片局部批量处理工具，基于 LaMa AI 模型实现智能水印去除。

## 特性

- 🎯 **模板驱动** — 创建一次模板，复用于同类图片
- 🤖 **AI 智能修复** — 基于 LaMa 模型的图像修复
- 🖼️ **多种处理方式** — AI 修复、纯色填充、裁切
- 📐 **灵活定位** — 右下角锚定、按比例定位、固定像素
- ⚡ **批量处理** — 支持批量导入和处理图片
- 🔒 **本地处理** — 所有处理在本地完成，保护隐私

## 快速开始

👉 请先阅读 [安装指南](/install) 下载并安装应用。

## 产品截图

<div class="screenshot-grid">
  <img src="/screenshots/home.png" alt="首页" />
  <img src="/screenshots/builder.png" alt="模板构建" />
  <img src="/screenshots/preview.png" alt="效果预览" />
  <img src="/screenshots/batch.png" alt="批量执行" />
</div>

## 使用流程

```
导入图片 → 框选处理区域 → 确认效果 → 批量处理
```

## 更多资源

- [安装指南](/install) — macOS / Windows / Linux 安装步骤
- [UX 组件指南](/UX_COMPONENTS_GUIDE) — 开发文档
- [GitHub](https://github.com/LuoYaoSheng/batch-image-studio) — 源码与 Issue

<style>
.screenshot-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
  margin: 24px 0;
}
.screenshot-grid img {
  width: 100%;
  border-radius: 8px;
  border: 1px solid var(--vp-c-divider);
  transition: transform 0.2s;
}
.screenshot-grid img:hover {
  transform: scale(1.02);
}
@media (max-width: 640px) {
  .screenshot-grid {
    grid-template-columns: 1fr;
  }
}
</style>
