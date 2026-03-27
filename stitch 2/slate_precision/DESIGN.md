```markdown
# 桌面端工具设计系统指南：静默生产力 (Silent Productivity)

本设计系统专为“图片批量处理大师”打造，旨在 Tauri 跨平台环境下提供一种“编辑室级别”的专业感。我们摒弃了传统软件的繁琐边框与高频对比，转而采用一种基于**色彩层叠（Tonal Layering）**与**精密排版**的视觉逻辑，营造一个安静、专注且极其高效的处理环境。

---

## 1. 创意北极星：数字策展人 (The Digital Curator)

我们将该系统定义为“数字策展人”。它不应当是一套生硬的工具箱，而是一个充满呼吸感的洗练空间。
- **意图化不对称：** 侧边栏与主工作区的比例不再是死板的分割，而是通过 `surface` 与 `surface-container` 的微妙色差实现的有机融合。
- **触觉化深度：** 放弃 1px 的物理线条，利用色块的“重叠”与“嵌套”来定义功能区。
- **冷静的高潮：** 全局保持中性灰调，仅在核心动作（如“开始批处理”）时激发 `primary` 克莱因蓝，形成强烈的视觉引导。

---

## 2. 色彩逻辑与层级 (Colors & Surface)

本系统严禁使用纯黑（#000）或纯白（#FFF）作为文字与背景的直接对比。

### 色彩原则
- **无边框原则 (The No-Line Rule)：** 禁止使用 1px 实线描边来划分大区域。必须通过背景色切换（如 `surface` 到 `surface-container-low`）来界定边界。
- **嵌套深度：** UI 是堆叠的纸张。
    - **底层：** `background` (#f9f9fb)
    - **中层：** `surface-container` (#ebeef2) 用于侧边栏或侧边面板。
    - **顶层：** `surface-container-lowest` (#ffffff) 用于内容卡片或操作输入区。
- **克莱因蓝的克制：** `primary` (#2e59b9) 仅用于点睛之笔。

### 核心色票引用
| 角色 | Token | 十六进制 | 用途 |
| :--- | :--- | :--- | :--- |
| 背景 | `background` | #f9f9fb | 软件最底层画布 |
| 容器 | `surface-container` | #ebeef2 | 侧边导航与工具栏底色 |
| 悬浮/卡片 | `surface-container-lowest` | #ffffff | 图片预览卡片、活动输入框 |
| 品牌色 | `primary` | #2e59b9 | 主动作按钮、进度条激活态 |
| 文本 | `on-surface` | #2d3338 | 主要正文与标题 |
| 辅助文本 | `on-surface-variant` | #596065 | 提示文字、次要标签 |

---

## 3. 高级排版 (Typography)

我们使用系统默认无衬线字体（PingFang SC, Segoe UI），但通过极端字号对比来建立“社论式”的权威感。

- **Display (展示层):** 使用 `display-sm` (2.25rem)，仅用于空状态的大标题，传达宁静感。
- **Headline (标题层):** `headline-sm` (1.5rem) 用于模块标题，加粗并增加 `letter-spacing`。
- **Body (正文层):** `body-md` (0.875rem) 为阅读主力，行高设定为 1.6，确保长列表不显拥挤。
- **Label (标签层):** `label-sm` (0.6875rem) 仅用于图片参数（如 ISO、光圈），必须全大写或配合微弱的 `surface-variant` 底色。

---

## 4. 深度与材质 (Elevation & Depth)

### 氛围阴影 (Ambient Shadows)
当组件需要“浮起”（如 Context Menu 或 Toast）时，严禁使用深灰色阴影。
- **规范：** 阴影应为 `on-surface` 的 4%~8% 透明度，扩散值（Blur）需在 20px 以上。
- **效果：** 像晨雾般弥散在纸面上，而非悬浮在空中的塑料块。

### 鬼影描边 (The Ghost Border)
若因无障碍需求必须使用边界，仅允许使用 `outline-variant` 并降低至 20% 不透明度。这是一种视觉暗示，而非视觉阻断。

### 磨砂材质 (Glassmorphism)
顶部工具栏或浮动操作栏应使用 `surface` 颜色配合 80% 透明度及 `backdrop-blur(12px)`。这能让下方的图片预览隐约透出，增强空间连贯性。

---

## 5. 组件规范 (Components)

### 按钮 (Buttons)
- **主按钮 (Primary):** 背景 `primary`，文字 `on-primary`。使用 `md` (0.375rem) 圆角。建议加入从 `primary` 到 `primary-dim` 的极细微对角线渐变，增加“高级绸缎”感。
- **次要按钮 (Secondary):** 严禁描边。使用 `surface-container-high` 背景，文字为 `on-surface`。

### 输入框与对比滑杆 (Input & Slider)
- **输入框:** 背景 `surface-container-low`，聚焦时背景变为 `surface-container-lowest`，且下方出现 2px 的 `primary` 装饰线，而非四周描边。
- **对比滑杆 (Comparison Slider):** 滑块柄部使用圆角矩形，厚度 2px，颜色为 `primary`。两侧轨道分别使用 `surface-variant` 与 `primary-container` 区分前后对比。

### 导航侧边栏 (Navigation Sidebar)
- 采用 `surface-container` 背景。
- 活动项不使用高亮背景，而是使用一个 3px 宽的 `primary` 垂直条靠在左侧，文字颜色加深至 `on-primary-fixed`。

### 进度条 (Progress Bar)
- 轨道使用 `surface-container-highest`。
- 填充层使用 `primary` 到 `primary-fixed` 的横向渐变，表现“能量流动”感。

### 图片卡片 (Image Cards)
- **禁忌:** 绝对禁止使用分割线。
- **方案:** 利用 `spacing.4` (0.9rem) 的垂直留白配合 `surface-container-low` 的轻微背景色块来区分图片。

---

## 6. Do's & Don'ts

### ✅ 推荐做法 (Do)
- **利用间距：** 使用 `spacing.8` (1.75rem) 以上的大留白来区分不同的处理阶段。
- **语义化动效：** 所有交互状态切换（如 Hover）需有 200ms 的 `ease-in-out` 过渡。
- **微圆角：** 统一使用 `md` (0.375rem) 圆角，这在生产力工具中既保留了严谨性，又去除了锐利感。

### ❌ 避免做法 (Don't)
- **禁止线框化：** 除非是表格，否则不要在界面中画线。
- **禁止刺眼对比：** 避免在浅灰背景上直接使用纯黑文字，应使用 `on-surface`。
- **禁止过度修饰：** 所有的视觉元素必须服务于“图片处理”这一核心功能，不要添加无关的装饰性图标。

---

## 7. 场景示例：空状态 (Empty State)

当没有图片被载入时，界面中心不应只是一句话。
- **插画风格：** 采用极简线条或低对比度的几何阴影插画，颜色控制在 `surface-dim` 范围内。
- **引导：** 使用 `display-sm` 标题（如“准备好开始了吗？”），下方紧跟一个极简的 `primary` 按钮“导入首批图片”。

---
*本系统作为“图片批量处理大师”的视觉基石，应严格执行“以色代线”的层级逻辑，确保用户在长时间批量处理任务中保持心态平和与操作高效。*```