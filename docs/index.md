---
layout: home
hero:
  name: Batch Image Studio
  text: AI 驱动的图片批量处理工具
  tagline: 模板驱动 · LaMa AI 智能修复 · 本地隐私处理 · 跨平台桌面应用
  actions:
    - theme: brand
      text: ⬇️ 下载 v0.1.2
      link: https://github.com/LuoYaoSheng/batch-image-studio/releases/latest
    - theme: alt
      text: 安装指南
      link: /install
    - theme: alt
      text: GitHub
      link: https://github.com/LuoYaoSheng/batch-image-studio

features:
  - icon: 🎯
    title: 模板驱动
    details: 创建一次模板，复用于同类图片。支持右下角锚定、按比例定位、固定像素等多种定位方式。
  - icon: 🤖
    title: AI 智能修复
    details: 基于 LaMa 模型的图像修复，智能填充水印区域，效果自然无痕。
  - icon: 🖼️
    title: 多种处理方式
    details: AI 修复、纯色填充、裁切三种处理模式，按需选择最佳方案。
  - icon: ⚡
    title: 批量处理
    details: 支持批量导入和批量处理图片，模板复用大幅提升效率。
  - icon: 📋
    title: 历史记录
    details: 任务历史和模板复用，随时回顾和重新执行历史任务。
  - icon: 🔒
    title: 本地隐私
    details: 所有图片处理在本地完成，不上传云端，保护隐私安全。
---

<div class="product-preview">
  <div class="preview-title">产品预览</div>
  <div class="screenshot-row">
    <div class="screenshot-item">
      <img src="/screenshots/home.png" alt="首页" />
      <span>首页</span>
    </div>
    <div class="screenshot-item">
      <img src="/screenshots/builder.png" alt="模板构建" />
      <span>模板构建</span>
    </div>
    <div class="screenshot-item">
      <img src="/screenshots/preview.png" alt="效果预览" />
      <span>效果预览</span>
    </div>
    <div class="screenshot-item">
      <img src="/screenshots/batch.png" alt="批量执行" />
      <span>批量执行</span>
    </div>
  </div>
</div>

<div class="platform-support">
  <div class="platform-title">跨平台支持</div>
  <div class="platform-grid">
    <div class="platform-card">
      <span class="platform-icon">🍎</span>
      <span class="platform-name">macOS</span>
      <span class="platform-detail">Apple Silicon + Intel</span>
    </div>
    <div class="platform-card">
      <span class="platform-icon">🪟</span>
      <span class="platform-name">Windows</span>
      <span class="platform-detail">x64 安装包</span>
    </div>
    <div class="platform-card">
      <span class="platform-icon">🐧</span>
      <span class="platform-name">Linux</span>
      <span class="platform-detail">AppImage + deb</span>
    </div>
  </div>
</div>

<style>
.product-preview {
  max-width: 900px;
  margin: 48px auto 32px;
  text-align: center;
}

.preview-title {
  font-size: 1.3rem;
  font-weight: 700;
  margin-bottom: 20px;
}

.screenshot-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
}

.screenshot-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.screenshot-item img {
  width: 100%;
  border-radius: 8px;
  border: 1px solid var(--vp-c-divider);
  transition: transform 0.2s, box-shadow 0.2s;
}

.screenshot-item img:hover {
  transform: scale(1.03);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.screenshot-item span {
  font-size: 0.85rem;
  color: var(--vp-c-text-2);
}

.platform-support {
  max-width: 600px;
  margin: 32px auto 64px;
  text-align: center;
}

.platform-title {
  font-size: 1.3rem;
  font-weight: 700;
  margin-bottom: 20px;
}

.platform-grid {
  display: flex;
  gap: 16px;
  justify-content: center;
  flex-wrap: wrap;
}

.platform-card {
  flex: 1;
  min-width: 140px;
  max-width: 180px;
  padding: 20px 16px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 12px;
  text-align: center;
  transition: border-color 0.3s;
}

.platform-card:hover {
  border-color: var(--vp-c-brand);
}

.platform-icon {
  display: block;
  font-size: 2rem;
  margin-bottom: 8px;
}

.platform-name {
  display: block;
  font-weight: 600;
  font-size: 1rem;
  margin-bottom: 4px;
}

.platform-detail {
  display: block;
  font-size: 0.8rem;
  color: var(--vp-c-text-2);
}

@media (max-width: 768px) {
  .screenshot-row {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
