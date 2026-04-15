import { defineConfig } from 'vitepress';

export default defineConfig({
  title: 'Batch Image Studio',
  description: '图片批量处理工具',
  lang: 'zh-CN',
  cleanUrls: true,
  ignoreDeadLinks: true,
  themeConfig: {
    nav: [
      { text: '首页', link: '/' },
      { text: '安装', link: '/install' },
      { text: '组件指南', link: '/UX_COMPONENTS_GUIDE' },
    ],
    sidebar: [
      {
        text: '入门',
        items: [
          { text: '简介', link: '/README' },
          { text: '安装指南', link: '/install' },
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
