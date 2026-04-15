import { defineConfig } from 'vitepress';

export default defineConfig({
  title: 'Batch Image Studio',
  description: 'AI 驱动的图片批量处理工具',
  lang: 'zh-CN',
  base: '/',
  cleanUrls: true,
  ignoreDeadLinks: true,

  vite: {
    css: { postcss: {} },
  },

  head: [
    ['link', { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' }],
    ['meta', { name: 'author', content: 'LuoYaoSheng' }],
    ['meta', { name: 'keywords', content: '图片处理,批量处理,AI修复,水印去除,LaMa,桌面工具,Batch Image Studio' }],
    ['meta', { property: 'og:type',        content: 'website' }],
    ['meta', { property: 'og:site_name',   content: 'Batch Image Studio' }],
    ['meta', { property: 'og:title',       content: 'Batch Image Studio — AI 驱动的图片批量处理工具' }],
    ['meta', { property: 'og:description', content: '基于 LaMa AI 模型的智能图片修复与批量处理工具。' }],
    ['meta', { property: 'og:url',         content: 'https://batch.open.i2kai.com/' }],
    ['meta', { property: 'og:locale',      content: 'zh_CN' }],
    ['meta', { name: 'twitter:card',        content: 'summary_large_image' }],
    ['meta', { name: 'twitter:title',       content: 'Batch Image Studio — AI 驱动的图片批量处理工具' }],
    ['meta', { name: 'twitter:description', content: '基于 LaMa AI 模型的智能图片修复与批量处理工具。' }],
    ['meta', { name: 'theme-color', content: '#646cff' }],
  ],

  themeConfig: {
    nav: [
      { text: '首页', link: '/' },
      { text: '安装', link: '/install' },
      { text: '更新日志', link: '/changelog' },
      { text: '组件指南', link: '/UX_COMPONENTS_GUIDE' },
    ],
    sidebar: [
      {
        text: '入门',
        items: [
          { text: '简介', link: '/README' },
          { text: '安装指南', link: '/install' },
          { text: '更新日志', link: '/changelog' },
        ],
      },
      {
        text: '开发文档',
        items: [
          { text: 'UX 组件指南', link: '/UX_COMPONENTS_GUIDE' },
        ],
      },
    ],
    socialLinks: [
      { icon: 'github', link: 'https://github.com/LuoYaoSheng/batch-image-studio' },
    ],
  },
});
