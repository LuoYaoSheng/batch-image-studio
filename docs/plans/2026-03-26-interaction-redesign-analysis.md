# Batch Image Studio - 交互重构分析

> **文档目的**：分析当前应用与《页面交互操作草稿》的差异，明确重构方向
> **创建时间**：2026-03-26
> **最后更新**：2026-03-26
> **关联文档**：页面交互操作草稿.md、2026-03-26-interaction-redesign-implementation-plan.md

---

## 零、最核心的架构决策：如何开始重构

### 0.1 问题：新建目录 vs 旧工程修改？

这是重构开始前必须首先明确的问题。

### 0.2 两种方案对比

| 维度 | 方案A：新建目录 | 方案B：旧工程修改 |
|------|----------------|------------------|
| **目录** | `src-v2/` 或 `src-new/` | 直接在 `src/` 上修改 |
| **Git 历史** | 分支或新目录，历史保持 | 直接在主分支修改 |
| **旧代码** | 完整保留，可随时参考 | 逐步删除/替换 |
| **风险** | 低，可随时切换回旧版本 | 中，重构期间可能不稳定 |
| **配置文件** | 需要复制/重新配置 | 保持不变 |
| **最终合并** | 需要一次性合并替换 | 无需合并 |
| **开发体验** | 新旧代码可以同时运行 | 重构期间功能可能缺失 |

### 0.3 推荐：方案 B - 旧工程渐进式修改

**推荐理由**：

1. **项目规模适中** — 当前代码集中在一个 `App.tsx` 中，不是大型工程
2. **后端接口稳定** — Rust/Tauri 命令不需要改动
3. **状态管理已有** — Zustand store 可以复用并逐步优化
4. **功能需要保持可用** — 重构过程中功能不能断

### 0.4 具体执行策略

```
┌─────────────────────────────────────────────────────────────┐
│                    渐进式重构执行策略                         │
└─────────────────────────────────────────────────────────────┘

Step 1: 建立新目录结构（在 src/ 内部）
   ├─ components/layout/    # 新增：布局组件
   ├─ components/home/      # 新增：首页组件
   ├─ components/builder/   # 新增：构建页组件
   ├─ components/preview/   # 新增：预览页组件
   ├─ components/batch/     # 新增：批量页组件
   ├─ components/templates/ # 新增：模板中心组件
   ├─ components/history/   # 新增：历史记录组件
   ├─ screens/              # 新增：页面容器
   └─ 直接改造 src/App.tsx  # 在现有入口内渐进式重组

Step 2: 在现有入口中建立页面骨架
   ├─ src/App.tsx           # 直接改造成 AppShell + Screen 切换
   └─ src/App.legacy.tsx    # 可选快照，仅在需要时保留

Step 3: 逐步迁移功能
   ├─ Phase 0: 建立 AppShell 和 Screen 骨架
   ├─ Phase 1: 抽离首页、构建页核心能力
   ├─ Phase 2: 抽离预览页、批量页核心能力
   ├─ Phase 3: 补齐模板中心、历史记录、设置页

Step 4: 清理旧代码
   └─ 删除未使用的导入和组件
```

### 0.5 Git 分支策略

```
main (当前)
  │
  ├─ feature/refactor-shell (Phase 0：骨架)
  │    ├─ 建立 AppShell
  │    ├─ 建立 Screen 骨架
  │    └─ Screen 状态切换
  │
  ├─ feature/refactor-home-builder (Phase 1：首页 + 构建页)
  │    └─ 首页 + 导入功能 + 模板构建页
  │
  ├─ feature/refactor-preview-batch (Phase 2：预览 + 批量)
  │    └─ 预览页 + 批量执行页
  │
  └─ feature/refactor-library-pages (Phase 3：模板中心 + 历史 + 设置)
       └─ 模板中心 + 历史记录 + 设置页
```

### 0.6 入口文件切换方式

当前阶段不建议引入双入口切换。

**建议做法**：

- `src/main.tsx` 保持不变
- 直接在 `src/App.tsx` 中建立新的页面骨架
- 如果担心回滚，可在开始前临时保留一份 `src/App.legacy.tsx`

这样可以避免：

- 双入口并存造成认知负担
- `main.tsx` 为了过渡方案频繁改动
- 新旧入口行为不一致

### 0.7 回滚策略

如果重构出现问题，可以立即回滚：

| 问题级别 | 回滚方式 |
|----------|----------|
| 小问题（单个页面） | 修复单个组件，不影响其他页面 |
| 中问题（核心流程） | 回退当前分支提交，或恢复 `App.tsx` 的上一个稳定版本 |
| 大问题（架构不可行） | 使用 `App.legacy.tsx` 快照或 Git 历史恢复 |

### 0.8 当前项目目录结构（重构前）

```
src/
├── App.tsx              # 单一入口，所有功能混在一起
├── main.tsx             # React 入口
├── styles.css           # 全局样式
├── types.ts             # 类型定义
├── store/
│   └── workspace.ts     # Zustand store
└── components/          # 现有组件（较少）
```

### 0.9 目标目录结构（重构后）

```
src/
├── App.tsx              # 当前唯一入口（内部使用 AppShell + Screen 切换）
├── App.legacy.tsx       # 可选快照（仅在过渡期需要时保留）
├── main.tsx             # React 入口（不变）
├── styles.css           # 全局样式（保留）
├── types.ts             # 类型定义（扩展）
│
├── store/               # 状态管理（渐进式优化）
│   ├── workspace.ts     # 主 store（按页面分层）
│   └── selectors.ts     # 选择器（新增）
│
├── components/
│   ├── layout/          # 布局组件（新增）
│   │   ├── AppShell.tsx
│   │   ├── SidebarNav.tsx
│   │   └── TopBar.tsx
│   ├── home/            # 首页组件（新增）
│   │   ├── ImportDropZone.tsx
│   │   ├── RecentTemplateList.tsx
│   │   └── RecentTaskList.tsx
│   ├── builder/         # 构建页组件（新增）
│   │   ├── ImageSampleList.tsx
│   │   ├── RegionList.tsx
│   │   ├── RegionSelector.tsx
│   │   ├── BuilderSidePanel.tsx
│   │   └── BuilderActionBar.tsx
│   ├── preview/         # 预览页组件（新增）
│   │   ├── ComparisonSlider.tsx
│   │   ├── PreviewSampleList.tsx
│   │   └── PreviewSummaryCard.tsx
│   ├── batch/           # 批量页组件（新增）
│   │   ├── BatchStats.tsx
│   │   ├── BatchQueueList.tsx
│   │   ├── BatchLogPanel.tsx
│   │   └── BatchCompletePanel.tsx
│   ├── templates/       # 模板中心组件（新增）
│   │   └── TemplateCard.tsx
│   ├── history/         # 历史记录组件（新增）
│   │   └── HistoryTable.tsx
│   └── ui/              # 通用 UI 组件（新增）
│       ├── Button.tsx
│       ├── Input.tsx
│       └── ...
│
└── screens/             # 页面容器（新增）
    ├── HomeScreen.tsx
    ├── TemplateBuilderScreen.tsx
    ├── PreviewScreen.tsx
    ├── BatchScreen.tsx
    ├── TemplatesScreen.tsx
    ├── HistoryScreen.tsx
    └── SettingsScreen.tsx
```

### 0.10 第一步：在 App.tsx 内建立页面骨架

重构的第一步是直接在 `src/App.tsx` 内建立新的页面骨架：

```typescript
// src/App.tsx
import { AppShell } from './components/layout/AppShell';
import { HomeScreen } from './screens/HomeScreen';
import { TemplateBuilderScreen } from './screens/TemplateBuilderScreen';
import { PreviewScreen } from './screens/PreviewScreen';
import { BatchScreen } from './screens/BatchScreen';
import { TemplatesScreen } from './screens/TemplatesScreen';
import { HistoryScreen } from './screens/HistoryScreen';
import { SettingsScreen } from './screens/SettingsScreen';

import { useWorkspaceStore } from './store/workspace';

function App() {
  const currentScreen = useWorkspaceStore((s) => s.navigation.currentScreen);

  const renderScreen = () => {
    switch (currentScreen) {
      case 'home':
        return <HomeScreen />;
      case 'builder':
        return <TemplateBuilderScreen />;
      case 'preview':
        return <PreviewScreen />;
      case 'batch':
        return <BatchScreen />;
      case 'templates':
        return <TemplatesScreen />;
      case 'history':
        return <HistoryScreen />;
      case 'settings':
        return <SettingsScreen />;
      default:
        return <HomeScreen />;
    }
  };

  return (
    <AppShell>
      {renderScreen()}
    </AppShell>
  );
}

export default App;
```

### 0.11 实施确认清单

在开始重构前，请确认：

- [ ] 确认采用 **旧工程渐进式修改** 方案
- [ ] 确认直接在 `App.tsx` 中进行骨架化改造
- [ ] 确认是否需要保留 `App.legacy.tsx` 快照
- [ ] 确认 Git 分支策略
- [ ] 确认回滚方式（依赖 Git 历史或 `App.legacy.tsx`）
- [ ] 确认团队成员了解重构计划

---

## 一、核心设计理念对比

### 1.1 产品定位

| 维度 | 当前应用 | 交互草稿设计 |
|------|----------|--------------|
| **定位描述** | 豆包水印清理工具（测试性质） | **用户自定义模板型的桌面端图片批量局部处理工具** |
| **核心能力** | 预设规则处理 | 用户自定义模板处理 |
| **使用场景** | 豆包AI图片去水印 | 通用化图片局部处理 |

### 1.2 核心原则

交互草稿明确了两大核心原则：

1. **第一次使用尽量简单** — 降低首次上手门槛
2. **模板建好后后续使用更简单** — 提高复用效率

### 1.3 主链路对比

#### 首次使用主链路

```
当前应用：
导入图片 → 手动调整区域 → 选择处理方式 → 预览 → 批量处理

交互草稿：
导入图片 → 选样图 → 框选区域 → 选处理方式 → 预览效果 → 保存模板 → 批量处理
         (自动)    (拖拽)    (默认AI)    (独立页面)   (引导保存)
```

#### 后续使用主链路

```
当前应用：
导入图片 → 应用模板 → 预览 → 批量处理
         (手动选择)

交互草稿：
导入图片 → 选模板 → 预览一张 → 批量处理
         (首页快速选择)  (确认即可)
```

---

## 二、页面架构对比

### 2.1 当前应用架构

**特点**：单页面应用（SPA），所有功能在一个页面内完成

```
┌─────────────────────────────────────────────────────────────┐
│  Header: Logo | 批量图片水印清理工具           [设置] [?]  │
├──────────┬──────────────────────────────────────┬──────────┤
│  左侧栏  │           主工作区                    │  右侧栏  │
│          │                                       │          │
│ ━━━━━━━━│ ┌─────────────────────────────────────┐│ ━━━━━━━━│
│ 导入    │ │                                     ││ 处理参数 │
│ ────────│ │            图片预览区               ││ ─────────│
│ 📁 选择 │ │           （主要内容）             ││ 规则选择 │
│   文件   │ │                                     ││   ↓      │
│          │ │                                     ││ 豆包文字 │
│ 📁 选择 │ │                                     ││ 豆包卡片 │
│   文件夹 │ │                                     ││ 自定义... │
│          │ │                                     ││          │
│ ━━━━━━━━│ │                                     ││ ━━━━━━━━│
│ 规则    │ │                                     ││ 预览控制 │
│ ────────│ │                                     ││ ─────────│
│ 📋 预设 │ │                                     ││ [刷新]   │
│   规则   │ │                                     ││ [对比]   │
│          │ │                                     ││          │
│ ⚙️ 自定义│ │                                     ││ ━━━━━━━━│
│   规则   │ │                                     ││ 批量操作 │
│          │ │                                     ││ ─────────│
│ ━━━━━━━━│ │                                     ││ [开始批量]│
│ 模板    │ │                                     ││ [停止]   │
│ ────────│ │                                     ││          │
│ 📄 模板1│ │                                     ││ 进度: 3/10│
│ 📄 模板2│ │                                     ││          │
│          │ │                                     ││          │
│ ━━━━━━━━│ │                                     ││          │
│ 历史    │ │                                     ││          │
│ ────────│ │                                     ││          │
│ 🕐 记录1│ │                                     ││          │
│ 🕐 记录2│ │                                     ││          │
│          │ │                                     ││          │
└──────────┴──────────────────────────────────────┴──────────┘
```

**问题**：
- 信息密度过高，首次使用者容易被复杂界面吓到
- 没有明确的工作流引导
- 所有功能平铺，用户需要自己理解操作顺序

### 2.2 交互草稿架构

**特点**：7个独立页面，有明确工作流引导

```
┌─────────────────────────────────────────────────────────────┐
│                        页面流转图                           │
└─────────────────────────────────────────────────────────────┘

    ┌─────────┐
    │  首页   │ ◄─── 返回 ───┐
    │ (P01)   │               │
    └────┬────┘               │
         │                    │
         │ 导入图片           │ 完成后再来
         ↓                    │
    ┌─────────┐               │
    │模板构建 │ ◄─ 返回调整 ──┤
    │  页     │               │
    │ (P02)   │               │
    └────┬────┘               │
         │                    │
         │ 预览效果           │
         ↓                    │
    ┌─────────┐               │
    │ 预览页  │ ◄─── 返回 ────┤
    │ (P03)   │               │
    └────┬────┘               │
         │                    │
         │ 开始批量           │
         ↓                    │
    ┌─────────┐               │
    │批量执行 │ ──────────────┘
    │   页    │
    │ (P04)   │
    └────┬────┘
         │
         │ 完成
         ↓
    ┌─────────┐
    │  返回   │
    │  首页   │
    └─────────┘

    ┌─────────┐    ┌─────────┐
    │模板中心 │    │历史记录 │
    │ (P05)   │    │ (P06)   │
    └─────────┘    └─────────┘

    ┌─────────┐
    │ 设置页  │
    │ (P07)   │
    └─────────┘
```

**优势**：
- 每个页面职责单一，专注当前阶段任务
- 有明确的线性工作流
- 支持非线性跳转（模板中心、历史记录）

---

## 三、核心功能模块对比

### 3.1 模板的地位

| 维度 | 当前应用 | 交互草稿设计 |
|------|----------|--------------|
| **定位** | 辅助功能（保存配置方便复用） | **核心概念**（产品的灵魂） |
| **使用方式** | 手动保存，手动应用 | 工作流强制引导保存 |
| **复用性** | 弱 | 强（后续只需选模板） |
| **数据结构** | 简单配置对象 | 完整的模板实体 |

### 3.2 区域框选交互

| 维度 | 当前应用 | 交互草稿设计 |
|------|----------|--------------|
| **创建方式** | `computeDoubaoRegion` 自动计算 | **鼠标拖拽创建矩形框** |
| **调整方式** | 数值输入（x, y, width, height） | 拖动位置、拖动四角缩放 |
| **可视化** | 静态矩形框 | 高亮选中、联动反馈 |
| **多区域** | 不支持 | 支持（但初期建议限制1个） |

### 3.3 定位方式

| 维度 | 当前应用 | 交互草稿设计 |
|------|----------|--------------|
| **支持方式** | relative / absolute / bottomRight | **右下角锚定**（默认）<br>按比例定位<br>固定像素 |
| **默认选择** | relative | **右下角锚定** |
| **文案说明** | 无 | 有引导文案 |

### 3.4 预览功能

| 维度 | 当前应用 | 交互草稿设计 |
|------|----------|--------------|
| **位置** | 在同一页面内 | **独立的预览页** |
| **交互** | 切换显示原图/处理后 | **对比滑杆** |
| **页面目标** | 无明确目标 | **只做"确认效果"**<br>不暴露复杂编辑 |

### 3.5 首页体验

| 维度 | 当前应用 | 交互草稿设计 |
|------|----------|--------------|
| **进入状态** | 直接进入工作界面 | **空状态引导页** |
| **主要元素** | 全功能界面 | 拖拽区 + 最近模板 + 最近任务 |
| **新用户引导** | 无 | 明确的引导文案 |

---

## 四、数据结构设计

### 4.1 当前 Template 类型

```typescript
// src/types.ts
export type Template = {
  id: string;
  name: string;
  region: Region;           // 单一区域
  cleanupMethod: CleanupMethod;
  sizeHandlingMode: SizeHandlingMode;
  blurSigma: number;
  fillColor: string;
};

export type Region = {
  x: number;      // 相对坐标 0-1
  y: number;
  width: number;  // 相对尺寸 0-1
  height: number;
};

export type CleanupMethod = "blur" | "fill" | "crop";
export type SizeHandlingMode = "relative" | "absolute" | "bottomRight";
```

### 4.2 建议的 Template 类型（目标态）

> **说明**：本节描述的是中后期的目标态数据模型，用于指导架构方向。  
> **不是当前 Phase 0 / Phase 1 的前置条件**。当前阶段应先完成页面骨架、状态分层和旧功能搬迁，再视需要升级 Template 结构。

```typescript
// 重构后的类型设计
export type Template = {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;

  // 区域配置（支持多区域，初期限制1个）
  regions: RegionConfig[];

  // 处理方式
  processingMethod: ProcessingMethod;

  // 输出设置
  outputSettings: OutputSettings;

  // 示例图（可选，用于模板展示）
  previewImage?: string;
};

export type RegionConfig = {
  id: string;
  name?: string;           // 区域名称，如"右下角水印"
  region: Region;
  positioningMode: PositioningMode;

  // 每个区域可以有不同的处理方式（未来功能）
  processingMethod?: ProcessingMethod;
};

export type PositioningMode =
  | "bottomRight"    // 右下角锚定（默认）
  | "relative"       // 按比例定位
  | "absolute";      // 固定像素

export type ProcessingMethod =
  | "inpaint"        // AI修复（LaMa）
  | "blur"           // 模糊覆盖
  | "fill"           // 纯色填充
  | "crop";          // 裁切

// AI修复参数
export type InpaintParams = {
  qualityMode: "fast" | "balanced" | "quality";
};

// 模糊参数
export type BlurParams = {
  sigma: number;     // 1-50
};

// 填充参数
export type FillParams = {
  color: string;     // 十六进制颜色
};

// 处理方法与参数的联合
export type ProcessingMethodConfig =
  | { method: "inpaint"; params: InpaintParams }
  | { method: "blur"; params: BlurParams }
  | { method: "fill"; params: FillParams }
  | { method: "crop"; params: {} };

export type OutputSettings = {
  format: "png" | "jpg" | "webp" | "original";
  quality?: number;        // JPEG/WEBP 质量 1-100
  directory: string;       // 输出目录
  namingPattern: string;   // 文件命名模式
  overwrite: boolean;      // 是否覆盖同名文件
};
```

### 4.3 数据结构对比总结（目标态变化）

| 变化点 | 说明 |
|--------|------|
| **regions 数组** | 支持多区域，初期可限制长度为1 |
| **processingMethod** | 新增 `inpaint` 方法（当前只有 blur/fill/crop） |
| **参数结构化** | 每种处理方法有独立的参数类型 |
| **outputSettings** | 新增输出设置结构 |
| **元数据** | 添加创建/更新时间、描述等 |

---

## 五、核心交互组件需求

### 5.1 需要新建的组件

| 组件名 | 作用 | 复杂度 | 优先级 |
|--------|------|--------|--------|
| **RegionSelector** | 鼠标拖拽框选、拖动调整位置和大小 | 高 | P0 |
| **ComparisonSlider** | 原图/处理后对比滑杆 | 中 | P1 |
| **TemplateBuilderPage** | 模板构建页主容器 | 高 | P0 |
| **BatchProgressPage** | 批量执行进度展示 | 中 | P0 |
| **TemplateCard** | 模板卡片展示 | 低 | P0 |
| **TemplateCenterPage** | 模板中心页面 | 中 | P1 |
| **HomePage** | 首页/启动页 | 中 | P0 |
| **PreviewPage** | 独立预览页 | 中 | P1 |
| **HistoryPage** | 历史记录页 | 中 | P2 |

### 5.2 RegionSelector 组件详细设计

```typescript
interface RegionSelectorProps {
  // 图片信息
  imageSrc: string;
  imageWidth: number;
  imageHeight: number;

  // 当前选中的区域
  region: Region;
  onRegionChange: (region: Region) => void;

  // 多区域支持（未来）
  regions?: RegionConfig[];
  selectedRegionId?: string;
  onRegionSelect?: (id: string) => void;

  // 交互限制
  readonly?: boolean;
  minSize?: { width: number; height: number };
}
```

**交互能力**：
- 鼠标拖拽创建新矩形
- 拖动已有矩形位置
- 拖动四角缩放
- 选中高亮
- 删除（快捷键或按钮）

### 5.3 ComparisonSlider 组件详细设计

```typescript
interface ComparisonSliderProps {
  beforeSrc: string;    // 原图
  afterSrc: string;     // 处理后
  defaultPosition?: number;  // 默认滑块位置 0-1
  width?: number;
  height?: number;
}
```

**交互能力**：
- 滑块左右拖动
- 显示"原图"/"处理后"标签
- 支持放大查看

---

## 六、页面骨架与导航架构设计

### 6.1 目标页面结构（最终形态）

```
/                           → HomePage
/template/new               → TemplateBuilderPage (新建)
/template/edit/:id          → TemplateBuilderPage (编辑)
/preview                    → PreviewPage
/batch                      → BatchProgressPage
/templates                  → TemplateCenterPage
/history                    → HistoryPage
/settings                   → SettingsPage
```

### 6.2 当前阶段建议落地方式（更符合现状）

> **关键判断**：旧工程的导入、预览、批处理、模板保存、历史记录等基础功能已经基本完成，当前改造重点是 **UI 骨架重组 + 交互流程重排**，不是先做完整底层重写。

因此当前阶段更合适的做法是：

1. **先建立 AppShell 页面骨架**
   - 左侧导航
   - 顶部栏
   - 主内容区域
   - 各页面 Screen 容器

2. **先用 screen 状态驱动页面切换**
   - 不强制第一步就引入完整路由系统
   - 先把多页面体验搭起来
   - 等页面边界稳定后，再决定是否切到正式路由

3. **复用现有能力，逐页挂接**
   - 现有导入逻辑直接挂到首页
   - 现有区域编辑逻辑直接挂到模板构建页
   - 现有预览逻辑直接挂到预览页
   - 现有批处理逻辑直接挂到批量执行页

### 6.3 当前阶段建议的导航状态

```typescript
type AppScreen =
  | "home"
  | "builder"
  | "preview"
  | "batch"
  | "templates"
  | "history"
  | "settings";

type NavigationState = {
  currentScreen: AppScreen;
  builderMode?: "new" | "edit";
  selectedTemplateId?: string | null;
};
```

### 6.4 页面流转状态

```typescript
type WorkflowState = {
  importedImages?: ImportedImage[];
  workingTemplate?: Template | null;
  selectedImageId?: string | null;
  confirmedTemplate?: Template | null;
};
```

---

## 七、状态管理重构（渐进式）

### 7.1 当前状态管理

```typescript
// src/store/workspace.ts
type WorkspaceState = {
  cleanupMethod: CleanupMethod;
  sizeHandlingMode: SizeHandlingMode;
  blurSigma: number;
  fillColor: string;
  outputDir: string;
  region: Region;
  importedImages: ImportedImage[];
  selectedImageId: string | null;
  // ... 更多状态
};
```

**问题**：所有状态混在一个 store 中，难以分页面管理；但当前阶段也不适合一次性完全拆散，否则会影响已有功能稳定性。

### 7.2 当前阶段建议的状态管理策略

**建议**：继续使用一个 Zustand store，但在 store 内部按“页面职责”分层，而不是第一步就拆成多个独立 store。

这样可以：

- 保留现有逻辑可用性
- 降低重构风险
- 先支撑页面骨架切换
- 后续再按需要进一步拆分

### 7.3 建议的状态结构

```typescript
type WorkspaceState = {
  // 导航层
  navigation: {
    currentScreen: AppScreen;
    builderMode: "new" | "edit";
  };

  // 全局持久化层
  templates: Template[];
  history: HistoryEntry[];
  appSettings: AppSettings;

  // 当前工作流层
  importedImages: ImportedImage[];
  selectedImageId: string | null;
  currentTemplate: Template | null;
  isTemplateDirty: boolean;

  // Builder 层
  region: Region;
  cleanupMethod: CleanupMethod;
  sizeHandlingMode: SizeHandlingMode;
  blurSigma: number;
  fillColor: string;
  outputDir: string;

  // Preview 层
  preview: PreviewResult | null;
  isPreviewLoading: boolean;

  // Batch 层
  batchProgress: BatchProgress | null;
  lastBatchResult: BatchResult | null;
  isBatchRunning: boolean;
};
```

### 7.4 后续可升级方向

在页面骨架稳定之后，再考虑：

- 是否拆成多个 store slice
- 是否引入路由级状态管理
- 是否彻底升级 Template 数据结构

---

## 八、MVP 实施优先级（修订版）

> **说明**：本节使用的是“汇总阶段”编号，用于规划讨论。  
> 更细的实现拆分会在实施计划文档中继续展开。

### Phase 0（骨架与架构层接入）

**目标**：先把单页工具改造成“多页面骨架”，但不破坏现有功能

| 功能 | 页面/组件 | 说明 |
|------|-----------|------|
| AppShell | 应用壳层 | 左侧导航 + 顶部栏 + 主内容区 |
| Screen 切换 | 导航层 | 先用 screen 状态切换页面 |
| 页面骨架 | Home / Builder / Preview / Batch / Templates / History / Settings | 先建立页面容器 |
| 状态分层 | Store 内部分层 | 导航层 / 工作流层 / Builder / Preview / Batch |

**这一阶段的重点**：

- 不是先追求完整数据模型升级
- 不是先做完整路由系统
- 而是先让 UI 结构站起来

### Phase 1（首次使用核心闭环）

**目标**：完成“首次使用”的基本闭环

| 功能 | 页面/组件 | 说明 |
|------|-----------|------|
| 首页 | HomePage | 空状态 + 导入入口 |
| 图片导入 | - | 复用现有拖拽、选择文件/文件夹功能 |
| 模板构建页 | TemplateBuilderPage | 框选区域 + 选择处理方式 |
| 区域框选组件 | RegionSelector | 抽离现有编辑能力 |
| 预览页 | PreviewPage | 独立效果确认页 |
| 批量执行页 | BatchProgressPage | 进度 + 结果 |
| 模板保存 | - | 保存当前配置为模板 |

**主链路**：
```
首页 → 导入图片 → 模板构建页 → 框选区域 → 预览 → 保存模板 → 批量执行
```

### Phase 2（模板复用闭环）

**目标**：让后续使用更简单

| 功能 | 页面/组件 | 说明 |
|------|-----------|------|
| 模板中心 | TemplateCenterPage | 保存/应用/管理模板 |
| 首页增强 | HomePage | 显示最近模板与最近任务 |
| 模板应用 | - | 一键应用已有模板 |
| 历史记录页 | HistoryPage | 查看历史、复用任务 |

**主链路**：
```
首页 → 选择模板 → 导入图片 → 预览页确认 → 批量执行
```

### Phase 3（架构升级与体验完善）

**目标**：在骨架稳定后再做更深层升级

| 功能 | 页面/组件 | 说明 |
|------|-----------|------|
| 正式路由接入 | Router | 视页面复杂度决定是否引入 |
| Template 数据结构升级 | types/store | 元数据、outputSettings、兼容迁移 |
| 设置页完善 | SettingsPage | 应用级默认项 |
| 多区域支持 | RegionSelector | 一张图片多个处理区域 |
| 高级参数 | - | 各处理方式高级参数 |

---

## 九、与功能清单文档的关系

### 9.1 概念差异

| 维度 | 功能清单文档 | 交互草稿文档 |
|------|--------------|--------------|
| **侧重点** | 功能点罗列、数据结构定义 | 用户流程、页面交互 |
| **核心概念** | WatermarkRule（规则） | **Template（模板）** |
| **预设内容** | 强调预设规则库（豆包文字、豆包卡片...） | **弱化预设**，强调用户自定义 |

### 9.2 概念转变分析

**这是一个重要的概念转变**：

- **功能清单思路**：规则优先
  - 预设规则库 → 用户自定义规则
  - 用户选择规则 → 应用规则 → 保存为模板

- **交互草稿思路**：模板优先
  - 用户直接创建模板
  - 模板是唯一的复用单元
  - 规则概念弱化或融入模板

### 9.3 建议

采用**交互草稿的模板优先思路**，原因：
1. 更符合"简单"原则 — 用户不需要理解"规则"这个抽象概念
2. 更符合产品定位 — "用户自定义模板型"工具
3. 降低认知负担 — 一个概念（模板）而不是两个（规则+模板）

---

## 十、重构实施建议

### 10.0 实施前提判断

当前项目不是“从零开始做新产品”，而是：

- 旧工程已经具备基础能力
- 现阶段主要任务是 **重组 UI 结构与用户流程**
- 因此应优先做 **骨架接入 + 旧能力搬迁**

### 10.1 技术选型

| 需求 | 建议 | 说明 |
|------|------|------|
| 页面导航 | **Screen 状态驱动优先** | 当前阶段先建立页面骨架，后续可升级 Router |
| 路由 | TanStack Router（可选后续） | 页面边界稳定后再决定是否引入 |
| 状态管理 | Zustand（保持） | 先单 store 分层，后续再按需要拆分 |
| 样式 | Tailwind CSS（保持） | 继续使用 |
| 拖拽交互 | 原生实现优先 | 先复用现有 Region 编辑能力，不急于引库 |
| 架构层 | AppShell + Screen Components | 先把页面壳层搭起来 |

### 10.2 实施步骤

1. **步骤 1：架构层接入**
   - 建立 AppShell
   - 建立左侧导航与顶部栏
   - 建立七个 Screen 骨架
   - 用 screen 状态驱动页面切换

2. **步骤 2：核心工作流搬迁**
   - 首页接入现有导入能力
   - 模板构建页接入现有区域编辑能力
   - 抽离 RegionSelector 组件

3. **步骤 3：预览与执行拆页**
   - 独立预览页接入现有 preview 能力
   - 批量执行页接入现有 batch 能力
   - 模板保存流程接入

4. **步骤 4：复用能力补齐**
   - 实现模板中心
   - 实现历史记录
   - 实现设置页

5. **步骤 5：结构升级（可选）**
   - 评估是否引入正式路由
   - 升级 Template 数据结构
   - 处理向后兼容与迁移

### 10.3 兼容性考虑

- 保持现有后端接口（Rust/Tauri）不变
- 前端逐步重构，优先复用现有能力
- 初期允许保留部分旧组件和旧状态字段
- Template 数据结构升级应放到骨架稳定之后，并提供迁移方案

---

## 十一、总结

### 核心改造方向

1. **先建立页面骨架与应用壳层** — 先把单页改造成多页面工作流骨架
2. **架构层同步接入** — 导航层、Screen 层、状态分层一起进入
3. **以模板为核心** — 所有配置最终都保存为模板
4. **简化首次体验** — 引导式流程，默认智能值
5. **强化复用体验** — 后续使用只需选模板
6. **可视化交互** — 拖拽框选替代数值输入
7. **独立预览页** — 专门的对比确认页面
8. **架构升级后置** — Router、数据结构大改放到骨架稳定后

### 设计原则

- **第一次使用尽量简单** — 引导式流程，智能默认值
- **模板建好后后续使用更简单** — 一键应用，快速批量

### 产品定位

**用户自定义模板型的桌面端图片批量局部处理工具**

---

## 附录：关键决策记录

| 决策点 | 选择 | 原因 |
|--------|------|------|
| 核心概念 | Template（模板） | 比 WatermarkRule 更直观 |
| 首页设计 | 空状态引导 | 降低首次使用门槛 |
| 预览方式 | 独立页面 | 专注确认效果，避免干扰 |
| 定位默认值 | 右下角锚定 | 适合最常见的边角水印场景 |
| 处理方式默认值 | AI修复（LaMa） | 效果最好，用户满意度高 |
| 初期多区域 | 限制为1个 | 避免复杂度过高 |

---

## 十二、Stitch 2 设计稿评审

> **设计来源**：stitch 2/ 文件夹中的6个页面设计稿
> **评审时间**：2026-03-26

### 12.1 设计稿概览

> **更新说明**：设计稿已覆盖式更换，新增 P07 设置页，并附带完整的设计系统文档 `slate_precision/DESIGN.md`

| 页面 | 文件路径 | 对应交互草稿 | 状态 |
|------|----------|--------------|------|
| P00 | slate_precision/DESIGN.md | 设计系统页 | ✅ 新增 |
| P01 | stitch 2/p01/screen.png | 首页/启动页 | ✅ 已更新 |
| P02 | stitch 2/p02/screen.png | 模板构建页 | ✅ 已更新 |
| P03 | stitch 2/p03/screen.png | 预览页 | ✅ 已更新 |
| P04 | stitch 2/p04/screen.png | 批量执行页 | ✅ 已更新 |
| P05 | stitch 2/p05/screen.png | 模板中心 | ✅ 已更新 |
| P06 | stitch 2/p06/screen.png | 历史记录页 | ✅ 已更新 |
| P07 | stitch 2/p07/screen.png | 设置页 | ✅ 新增 |

### 12.1.1 设计系统：静默生产力 (Silent Productivity)

新设计稿附带完整的设计系统文档，定义了"数字策展人"风格的视觉语言：

#### 核心设计原则

| 原则 | 描述 | 实现方式 |
|------|------|----------|
| **无边框原则** | 禁止使用 1px 实线描边 | 通过背景色切换（surface → surface-container）界定边界 |
| **嵌套深度** | UI 是堆叠的纸张 | 底层 `#f9f9fb` → 中层 `#ebeef2` → 顶层 `#ffffff` |
| **克莱因蓝的克制** | 品牌色仅用于点睛之笔 | `#2e59b9` 仅用于主动作按钮、进度条激活态 |

#### 色彩系统

| 角色 | Token | 十六进制 | 用途 |
|------|-------|----------|------|
| 背景 | `background` | #f9f9fb | 软件最底层画布 |
| 容器 | `surface-container` | #ebeef2 | 侧边导航与工具栏底色 |
| 悬浮/卡片 | `surface-container-lowest` | #ffffff | 图片预览卡片、活动输入框 |
| 品牌色 | `primary` | #2e59b9 | 主动作按钮、进度条激活态 |
| 文本 | `on-surface` | #2d3338 | 主要正文与标题 |
| 辅助文本 | `on-surface-variant` | #596065 | 提示文字、次要标签 |

#### 组件规范

| 组件 | 规范 |
|------|------|
| **主按钮** | 背景 `primary`，`md` (0.375rem) 圆角，极细微对角线渐变 |
| **次要按钮** | 严禁描边，使用 `surface-container-high` 背景 |
| **导航侧边栏** | 活动项使用 3px 宽的 `primary` 垂直条，无高亮背景 |
| **进度条** | `primary` 到 `primary-fixed` 的横向渐变，表现"能量流动"感 |
| **图片卡片** | 禁止使用分割线，利用 `spacing.4` 的垂直留白区分 |

### 12.2 P01 - 首页评审

**设计优点**：
- ✅ 拖拽区域明显，空状态引导清晰
- ✅ 两个主要操作按钮（导入图片、导入文件夹）突出
- ✅ 最近模板和最近任务分区展示

**潜在问题**：
| 问题 | 严重程度 | 建议 |
|------|----------|------|
| 空状态下"最近模板"和"最近任务"区域会造成页面空洞感 | 中 | 空状态下显示引导文案或隐藏该区域 |
| 首页顶部缺少应用名称/Logo 区域 | 低 | 添加简洁的 Logo 和应用名称 |
| "应用已有模板"入口不够突出 | 中 | 将"应用模板"按钮提升到与导入按钮同等位置 |

**改进建议**：
```
空状态下首页布局建议：
┌─────────────────────────────────────┐
│  [Logo] 批量图片局部处理工具  [设置] │
├─────────────────────────────────────┤
│                                     │
│         ┌─────────────────┐         │
│         │                 │         │
│         │   拖入图片或     │         │
│         │   文件夹开始    │         │
│         │                 │         │
│         └─────────────────┘         │
│                                     │
│    [导入图片] [导入文件夹]          │
│                                     │
│    或应用已有模板快速开始           │
│                                     │
└─────────────────────────────────────┘
```

### 12.3 P02 - 模板构建页评审（核心页）

**设计优点**：
- ✅ 三栏布局清晰（图片列表 | 预览区 | 参数面板）
- ✅ 区域框选可视化明显
- ✅ 处理方式选择直观（AI修复/模糊/填充/裁切）

**潜在问题**：

| 问题 | 严重程度 | 建议 |
|------|----------|------|
| 右侧参数面板信息密度过高 | **高** | 高级参数（输出设置）应该折叠 |
| 缺少首次进入的引导提示 | **高** | 添加分步引导（Step 1/2/3） |
| 区域列表位置不明显 | 中 | 在图片列表和区域列表之间加分隔标题 |
| 定位方式文案不够友好 | 中 | 添加说明性副标题 |
| 缺少区域操作按钮 | 中 | 添加"删除区域"、"清空重选"按钮 |

**改进建议**：

1. **添加首次进入引导**：
```
┌─────────────────────────────────────┐
│  Step 1 of 3: 框选要处理的区域      │
│  ━━━━━━━━━━━○━━━━━━━━○             │
│                                     │
│  💡 在右侧图片上拖拽鼠标框选区域    │
└─────────────────────────────────────┘
```

2. **参数面板分组折叠**：
```
┌─────────────────────────────┐
│ ▼ 区域设置                   │
│   • 位置: 右下角             │
│   • 定位: 锚定模式           │
├─────────────────────────────┤
│ ▼ 处理方式                   │
│   • AI修复 (LaMa)           │
├─────────────────────────────┤
│ ▶ 输出设置 (高级)            │
└─────────────────────────────┘
```

3. **定位方式说明优化**：
```
┌─────────────────────────────┐
│ 定位方式                     │
│ ○ 右下角锚定                 │
│   适合边角固定位置的水印     │
│ ○ 按比例定位                 │
│   适合不同尺寸的图片         │
│ ○ 固定像素                   │
│   适合完全相同尺寸的图片     │
└─────────────────────────────┘
```

### 12.4 P03 - 预览页评审

**设计优点**：
- ✅ 对比视图清晰
- ✅ 原图/处理后标签明显
- ✅ 操作按钮位置合理

**潜在问题**：

| 问题 | 严重程度 | 建议 |
|------|----------|------|
| 对比滑杆不够明显 | 中 | 在滑杆上添加拖动图标/手型提示 |
| 缺少样图切换入口 | **高** | 添加左侧样图列表或左右切换箭头 |
| 缺少全部预览功能 | 低 | 添加"预览全部样图"功能 |

**改进建议**：

1. **添加左侧样图缩略图列表**：
```
┌─────┬─────────────────────────────┐
│ 图1 │                             │
│     │      [对比视图区域]         │
│ 图2 │                             │
│  ✓  │                             │
│ 图3 │                             │
│     │                             │
└─────┴─────────────────────────────┘
```

2. **对比滑杆视觉增强**：
- 添加双向箭头图标 `◀▶`
- 滑杆使用对比色
- 鼠标悬停时显示手型光标

### 12.5 P04 - 批量执行页评审

**设计优点**：
- ✅ 进度展示清晰
- ✅ 任务状态标识明显（待处理/处理中/成功/失败）
- ✅ 完成态展示清晰

**潜在问题**：

| 问题 | 严重程度 | 建议 |
|------|----------|------|
| 失败任务的错误信息展示不够 | **高** | 失败项应展开显示错误原因 |
| "仅重试失败项"按钮位置不明显 | 中 | 完成后该按钮应该更突出 |
| 缺少"暂停"功能 | 中 | 添加暂停/继续按钮 |
| 当前处理文件信息不够突出 | 低 | 当前处理的文件应该高亮或动画 |

**改进建议**：

1. **失败任务展开显示**：
```
┌─────────────────────────────────────┐
│ ▼ image-003.jpg          [失败]     │
│   错误: 图片格式不支持               │
│   [重试此文件]                       │
├─────────────────────────────────────┤
│ ✓ image-001.jpg          [成功]     │
│ ✓ image-002.jpg          [成功]     │
└─────────────────────────────────────┘
```

2. **当前处理文件高亮**：
- 使用动画边框或脉冲效果
- 左侧列表中当前项高亮显示

### 12.6 P05 - 模板中心评审

**设计优点**：
- ✅ 模板卡片展示美观
- ✅ 操作按钮清晰（应用/编辑/删除）

**潜在问题**：

| 问题 | 严重程度 | 建议 |
|------|----------|------|
| 模板预览图不够突出 | 中 | 模板卡片应显示前后对比效果 |
| 缺少模板的元信息 | 低 | 添加创建时间、使用次数 |
| 搜索框位置不够明显 | 低 | 搜索框放在顶部更显眼位置 |
| "新建模板"入口不够突出 | 中 | 顶部添加明显的"新建模板"按钮 |

**改进建议**：

1. **模板卡片增强**：
```
┌─────────────────────────────────┐
│  [原图 → 处理后 对比缩略图]      │
│                                  │
│  右下角水印清除模板              │
│  使用 12 次  •  3天前创建        │
│                                  │
│  [应用] [编辑] [删除]            │
└─────────────────────────────────┘
```

### 12.7 P06 - 历史记录页评审

**设计优点**：
- ✅ 表格式展示清晰
- ✅ 状态标识明显

**潜在问题**：

| 问题 | 严重程度 | 建议 |
|------|----------|------|
| 信息密度较高，不够直观 | 中 | 考虑卡片式布局作为替代 |
| 缺少筛选功能 | 中 | 添加日期、状态、模板筛选 |
| "复用"操作不够明显 | 低 | 将复用按钮改为更明显的样式 |
| 缺少模板关联显示 | 中 | 显示该任务使用的模板 |

**改进建议**：

1. **添加筛选器**：
```
┌─────────────────────────────────────┐
| 筛选: [全部日期 ▼] [全部状态 ▼]    │
└─────────────────────────────────────┘
```

2. **关联模板显示**：
```
| 任务名称       | 模板        | 时间     | 状态 |
|----------------|-------------|----------|------|
| 豆包图片处理   | 右下角清除  | 3天前    | 成功 |
```

### 12.8 总体评价

#### 设计亮点
1. **整体风格统一** — 6个页面保持了一致的设计语言
2. **核心流程清晰** — 首页 → 构建 → 预览 → 批量的主流程完整
3. **信息层次分明** — 重要操作突出，次要信息适度弱化

#### 需要重点改进的问题

| 优先级 | 问题 | 影响页面 |
|--------|------|----------|
| **P0** | 模板构建页缺少引导提示 | P02 |
| **P0** | 预览页缺少样图切换入口 | P03 |
| **P0** | 批量执行页失败信息不明确 | P04 |
| **P1** | 模板构建页参数面板过于密集 | P02 |
| **P1** | 首页空状态处理 | P01 |

#### 与交互草稿的契合度

| 交互草稿要求 | 设计稿实现 | 契合度 |
|--------------|------------|--------|
| 首页空状态引导 | ✅ 有拖拽区 | 90% |
| 模板构建页三栏布局 | ✅ 已实现 | 95% |
| 分步引导提示 | ❌ 缺失 | 60% |
| 独立预览页 | ✅ 已实现 | 85% |
| 对比滑杆 | ✅ 已实现，但不够明显 | 70% |
| 批量执行进度 | ✅ 已实现 | 90% |
| 模板中心 | ✅ 已实现 | 85% |
| 历史记录 | ✅ 已实现，缺少筛选 | 80% |

**总体契合度：82%**

### 12.9 实施建议

基于设计稿评审，建议按以下优先级进行调整：

1. **第一优先级必须调整**（影响核心体验）：
   - 模板构建页添加分步引导
   - 预览页添加样图切换功能
   - 批量执行页失败信息展开

2. **第二优先级建议优化**（提升体验）：
   - 模板构建页参数折叠
   - 首页空状态优化
   - 模板卡片增强预览

3. **第三优先级可选**（锦上添花）：
   - 历史记录筛选
   - 搜索优化
   - 元信息展示

---

### 12.10 P07 - 设置页评审（新增）

![P07](https://maas-log-prod.cn-wlcb.ufileos.com/anthropic/facf6b2e-4ce3-4438-b7b9-166a0797cb74/screen.png?UCloudPublicKey=TOKEN_e15ba47a-d098-4fbd-9afc-a0dcf0e4e621&Expires=1774494813&Signature=9Bavtz5P/cUK8LjKOUspcnyTxPw=)

**设计优点**：
- ✅ 分组清晰（基础设置 / 输出设置 / 模型设置 / 数据设置 / 关于）
- ✅ 保持与整体设计系统一致的视觉风格
- ✅ 设置项布局合理，左侧标签右侧控件

**潜在问题**：

| 问题 | 严重程度 | 建议 |
|------|----------|------|
| 缺少"重置为默认"功能 | 低 | 添加一键恢复默认设置按钮 |
| 模型设置内容较少 | 低 | 可以添加模型版本选择或质量模式选择 |
| 缺少设置预览 | 低 | 某些设置（如默认格式）可以显示预览 |

**与实施计划的契合度**：

| 实施计划要求 | 设计稿实现 | 契合度 |
|--------------|------------|--------|
| 默认输出目录 | ✅ 有 | 100% |
| 默认格式 | ✅ 有 | 100% |
| 默认处理方式 | ✅ 有 | 100% |
| 缓存状态 | ✅ 有 | 100% |
| 清理缓存 | ✅ 有 | 100% |
| 更新检查 | ✅ 有（占位） | 100% |

**契合度：100%** ✅

---

## 十三、与实施计划的契合度分析

> **实施计划文档**：`docs/plans/2026-03-26-interaction-redesign-implementation-plan.md`

### 13.1 架构决策对比

| 决策点 | 实施计划 | 设计稿 | 契合度 |
|--------|----------|--------|--------|
| **路由方式** | 不引入路由依赖，使用 screen-based shell | ✅ 符合 | 100% |
| **页面数量** | 7个页面（不含P00设计系统） | ✅ 7个页面 | 100% |
| **状态管理** | Zustand，按工作流重组 | ✅ 符合 | 100% |
| **后端保留** | 保持 Rust/Tauri 命令不变 | ✅ 符合 | 100% |

### 13.2 页面实施优先级对比

> **说明**：详细实施计划采用更细粒度的阶段编号；这里按“功能模块”对照，避免和本分析文档的汇总阶段编号混淆。

| 实施模块 | 页面 | 设计稿状态 | 可开始实施 |
|----------|------|------------|------------|
| AppShell + 所有 Screen 骨架 | 骨架层 | ✅ 全部完成 | ✅ 是 |
| HomeScreen | P01 | ✅ 完成 | ✅ 是 |
| TemplateBuilderScreen | P02 | ✅ 完成 | ✅ 是 |
| PreviewScreen | P03 | ✅ 完成 | ✅ 是 |
| BatchScreen | P04 | ✅ 完成 | ✅ 是 |
| TemplatesScreen + HistoryScreen | P05 + P06 | ✅ 完成 | ✅ 是 |
| SettingsScreen | P07 | ✅ 完成 | ✅ 是 |

### 13.3 实施建议更新

基于新的设计稿和实施计划，建议按以下顺序进行开发：

#### 第一阶段：架构搭建
- 创建 `AppShell` 组件
- 创建 7 个 Screen 组件骨架
- 实现 screen-based 导航（不引入路由）
- **预计时间**：2-3天

#### 第二阶段：核心流程
- 实现 `HomeScreen` (P01)
- 实现 `TemplateBuilderScreen` (P02)
- 实现区域框选组件 `RegionSelector`
- **预计时间**：3-4天

#### 第三阶段：预览与批量
- 实现 `PreviewScreen` (P03)
- 实现对比滑杆 `ComparisonSlider`
- 实现 `BatchScreen` (P04)
- **预计时间**：2-3天

#### 第四阶段：模板与历史
- 实现 `TemplatesScreen` (P05)
- 实现 `HistoryScreen` (P06)
- **预计时间**：2天

#### 第五阶段：设置与完善
- 实现 `SettingsScreen` (P07)
- 应用设计系统样式
- **预计时间**：1-2天

**总计：10-14天**

### 13.4 设计实施注意事项

基于 `slate_precision/DESIGN.md` 设计系统，实施时需要注意：

1. **无边框原则**：
   - 使用背景色切换代替边框
   - 通过 `surface` → `surface-container` → `surface-container-lowest` 层级区分

2. **色彩使用**：
   - 严禁纯黑 #000 和纯白 #FFF
   - 主色 `#2e59b9` 仅用于点睛之笔
   - 文字使用 `#2d3338`，次要文字使用 `#596065`

3. **圆角统一**：
   - 统一使用 `md` (0.375rem) 圆角

4. **阴影规范**：
   - 阴影为 `on-surface` 的 4%-8% 透明度
   - 扩散值（Blur）需在 20px 以上

5. **过渡动画**：
   - 所有交互状态切换需有 200ms 的 `ease-in-out` 过渡

---

## 十四、最终评估

### 14.1 设计完整性

| 维度 | 完成度 |
|------|--------|
| **页面数量** | ✅ 100% (7/7) |
| **设计系统** | ✅ 100% |
| **核心流程** | ✅ 100% |
| **组件规范** | ✅ 100% |
| **与交互草稿契合度** | ✅ 85% |
| **与实施计划契合度** | ✅ 95% |

### 14.2 可以开始实施的条件

✅ **所有条件已满足，可以立即开始实施**

1. ✅ 设计稿完整（P01-P07）
2. ✅ 设计系统文档完整
3. ✅ 实施计划文档完整
4. ✅ 与交互草稿的契合度可接受
5. ✅ 与现有代码架构兼容

### 14.3 实施前的最终确认

在开始实施前，建议确认以下事项：

- [ ] 确认产品负责人对设计稿的最终认可
- [ ] 确认开发团队对设计系统的理解
- [ ] 确认实施计划的优先级和时间安排
- [ ] 确认是否需要先进行技术预研（如 RegionSelector 组件）
- [ ] 确认采用 **旧工程渐进式修改** 方案
- [ ] 确认直接在 `App.tsx` 中进行骨架化改造

---

## 十五、实施细节补充

### 15.1 设计系统的 Tailwind CSS 配置

设计系统文档（`slate_precision/DESIGN.md`）定义了颜色规范，需要在 `tailwind.config.ts` 中配置：

```typescript
// tailwind.config.ts
import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      // 设计系统色彩
      colors: {
        // 背景层级
        background: '#f9f9fb',
        'surface-container': '#ebeef2',
        'surface-container-low': '#f0f2f5',
        'surface-container-high': '#e5e9ef',
        'surface-container-highest': '#dfe4eb',
        'surface-container-lowest': '#ffffff',

        // 品牌色
        primary: '#2e59b9',
        'primary-dim': '#4a75c9',
        'on-primary': '#ffffff',
        'primary-fixed': '#e0eafa',
        'on-primary-fixed': '#1a3a7a',

        // 文字色
        'on-surface': '#2d3338',
        'on-surface-variant': '#596065',
        'surface-dim': '#8a9199',
      },

      // 统一圆角
      borderRadius: {
        'md': '0.375rem',
        'lg': '0.5rem',
        'xl': '0.75rem',
      },

      // 统一过渡
      transitionDuration: {
        '200': '200ms',
        '300': '300ms',
      },

      // 阴影（氛围阴影）
      boxShadow: {
        'ambient': '0 8px 24px rgba(45, 51, 56, 0.08)',
        'ambient-sm': '0 4px 12px rgba(45, 51, 56, 0.06)',
      },

      // 间距
      spacing: {
        '4': '0.9rem',   // 组件间距
        '6': '1.375rem',
        '8': '1.75rem',  // 大区块间距
      },
    },
  },
  plugins: [],
};

export default config;
```

### 15.2 AppShell 组件实现示例

```typescript
// src/components/layout/AppShell.tsx
import { ReactNode } from 'react';
import { SidebarNav } from './SidebarNav';
import { TopBar } from './TopBar';
import { useWorkspaceStore } from '../../store/workspace';

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const currentScreen = useWorkspaceStore((s) => s.navigation.currentScreen);

  return (
    <div className="flex h-screen bg-background text-on-surface">
      {/* 左侧导航 */}
      <SidebarNav currentScreen={currentScreen} />

      {/* 主内容区 */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* 顶部栏 - 根据当前页面动态变化 */}
        <TopBar currentScreen={currentScreen} />

        {/* 页面内容 */}
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
```

```typescript
// src/components/layout/SidebarNav.tsx
import { useWorkspaceStore } from '../../store/workspace';

const navItems = [
  { id: 'home', label: '首页', icon: '🏠' },
  { id: 'templates', label: '模板中心', icon: '📋' },
  { id: 'history', label: '历史记录', icon: '🕐' },
  { id: 'settings', label: '设置', icon: '⚙️' },
];

interface SidebarNavProps {
  currentScreen: string;
}

export function SidebarNav({ currentScreen }: SidebarNavProps) {
  const setCurrentScreen = useWorkspaceStore((s) => s.setCurrentScreen);

  return (
    <nav className="w-56 bg-surface-container flex flex-col">
      {/* Logo 区域 */}
      <div className="p-6 border-b border-surface-container-high">
        <h1 className="text-lg font-semibold text-on-surface">
          批量图片处理大师
        </h1>
      </div>

      {/* 导航项 */}
      <div className="flex-1 py-4">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setCurrentScreen(item.id as any)}
            className={`
              w-full flex items-center gap-3 px-6 py-3 text-left
              transition-colors duration-200
              ${currentScreen === item.id
                ? 'bg-primary/10 text-primary border-l-3 border-primary'
                : 'text-on-surface-variant hover:bg-surface-container-low'
              }
            `}
          >
            <span>{item.icon}</span>
            <span>{item.label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}
```

```typescript
// src/components/layout/TopBar.tsx
import { useWorkspaceStore } from '../../store/workspace';

interface TopBarProps {
  currentScreen: string;
}

export function TopBar({ currentScreen }: TopBarProps) {
  // 根据当前页面返回不同的顶部栏内容
  const getTitle = () => {
    switch (currentScreen) {
      case 'home': return '首页';
      case 'builder': return '模板构建';
      case 'preview': return '效果预览';
      case 'batch': return '批量处理';
      case 'templates': return '模板中心';
      case 'history': return '历史记录';
      case 'settings': return '设置';
      default: return '';
    }
  };

  return (
    <header className="h-14 bg-surface-container-lowest border-b border-surface-container-low flex items-center justify-between px-6">
      <h2 className="text-base font-semibold text-on-surface">
        {getTitle()}
      </h2>

      {/* 右侧操作区 - 根据页面动态变化 */}
      <div className="flex items-center gap-4">
        {/* 这里可以放置页面特定的操作按钮 */}
      </div>
    </header>
  );
}
```

### 15.3 现有组件复用对照表

| 现有功能 | 位置 | 复用方式 | 目标页面 | 新组件名 |
|----------|------|----------|----------|----------|
| 拖拽导入 | App.tsx | 抽离为独立组件 | HomePage | `ImportDropZone.tsx` |
| 文件选择对话框 | App.tsx | 抽离为独立组件 | HomePage | `FileImportButton.tsx` |
| 图片缩略图列表 | App.tsx | 抽离并增强 | TemplateBuilderPage | `ImageSampleList.tsx` |
| 区域编辑（拖拽/缩放） | App.tsx | **核心抽离** | TemplateBuilderPage | `RegionSelector.tsx` |
| 区域参数调整 | App.tsx | 抽离为右侧面板 | TemplateBuilderPage | `BuilderSidePanel.tsx` |
| 处理方式选择 | App.tsx | 抽离为组件 | TemplateBuilderPage | `ProcessingMethodSelector.tsx` |
| 预览生成逻辑 | App.tsx | 复用，移到 PreviewScreen | PreviewPage | `PreviewGenerator.tsx` |
| 原图/处理后切换 | App.tsx | 改为对比滑杆 | PreviewPage | `ComparisonSlider.tsx` |
| 批量处理逻辑 | App.tsx | 复用，移到 BatchScreen | BatchPage | `BatchExecutor.tsx` |
| 进度展示 | App.tsx | 抽离并增强 | BatchPage | `BatchQueueList.tsx` |
| 模板保存 | workspace.ts | 复用，添加 UI | TemplateBuilderPage | `SaveTemplateButton.tsx` |
| 模板应用 | App.tsx | 抽离为独立组件 | HomePage / TemplatesScreen | `TemplateCard.tsx` |
| 历史记录数据 | workspace.ts | 复用数据，新建 UI | HistoryPage | `HistoryTable.tsx` |
| 通知系统 | App.tsx | 抽离为全局组件 | 全局 | `NotificationCenter.tsx` |

### 15.4 数据迁移方案

当 Template 数据结构需要升级时，使用以下迁移策略：

```typescript
// src/store/migration.ts

// 旧版 Template 类型
interface OldTemplate {
  id: string;
  name: string;
  region: Region;
  cleanupMethod: CleanupMethod;
  sizeHandlingMode: SizeHandlingMode;
  blurSigma: number;
  fillColor: string;
}

// 新版 Template 类型
interface NewTemplate {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  regions: RegionConfig[];
  processingMethod: ProcessingMethodConfig;
  outputSettings: OutputSettings;
}

// 映射函数
function mapCleanupMethodToProcessingMethod(
  method: CleanupMethod
): ProcessingMethodConfig {
  switch (method) {
    case 'blur':
      return { method: 'blur', params: { sigma: 10 } };
    case 'fill':
      return { method: 'fill', params: { color: '#f7f9fc' } };
    case 'crop':
      return { method: 'crop', params: {} };
    default:
      return { method: 'inpaint', params: { qualityMode: 'balanced' } };
  }
}

// 迁移函数
export function migrateTemplate(old: OldTemplate): NewTemplate {
  const now = new Date().toISOString();

  return {
    id: old.id,
    name: old.name,
    description: undefined,
    createdAt: now,
    updatedAt: now,
    regions: [{
      id: crypto.randomUUID(),
      name: undefined,
      region: old.region,
      positioningMode: old.sizeHandlingMode === 'bottomRight'
        ? 'bottomRight'
        : old.sizeHandlingMode === 'absolute'
        ? 'absolute'
        : 'relative',
    }],
    processingMethod: mapCleanupMethodToProcessingMethod(old.cleanupMethod),
    outputSettings: {
      format: 'original',
      directory: '', // 需要从其他地方获取
      namingPattern: '${name}_processed${ext}',
      overwrite: false,
    },
  };
}

// 应用启动时执行一次性迁移
export function ensureTemplateMigration(): void {
  const TEMPLATES_KEY = 'batch-image-studio.templates';

  try {
    const raw = localStorage.getItem(TEMPLATES_KEY);
    if (!raw) return;

    const templates = JSON.parse(raw) as OldTemplate[] | NewTemplate[];

    // 检查是否需要迁移（通过检查是否有 createdAt 字段）
    const needsMigration = templates.some(
      (t): t is OldTemplate => !('createdAt' in t)
    );

    if (needsMigration) {
      console.log('Migrating old templates to new format...');
      const migrated = templates.map(migrateTemplate);
      localStorage.setItem(TEMPLATES_KEY, JSON.stringify(migrated));
      console.log(`Migrated ${migrated.length} templates`);
    }
  } catch (error) {
    console.error('Template migration failed:', error);
  }
}

// 在应用启动时调用
// src/main.tsx
import { ensureTemplateMigration } from './store/migration';

ensureTemplateMigration();
```

### 15.5 验证清单

#### Phase 0 验证清单（骨架与架构层）

**目标**：单页工具改造成多页面骨架，功能不受影响

- [ ] 应用启动，看到左侧导航和主内容区
- [ ] 点击左侧导航可以切换页面
- [ ] URL 保持不变（screen 状态驱动，非路由）
- [ ] 现有功能在新的 `App.tsx` 页面骨架中仍可正常使用
- [ ] `npm run build` 成功
- [ ] `npm run dev` 无运行时错误
- [ ] 可以通过 Git 历史或 `App.legacy.tsx` 完成回滚验证

#### Phase 1 验证清单（首次使用核心闭环）

**目标**：完成 首页 → 构建页 → 预览页 → 批量执行 的闭环

**首页**：
- [ ] 拖拽导入成功
- [ ] 点击"导入图片"成功
- [ ] 点击"导入文件夹"成功
- [ ] 导入后自动跳转到构建页
- [ ] 空状态下显示引导文案

**构建页**：
- [ ] 左侧显示图片列表
- [ ] 中间显示大图预览
- [ ] 可以在图片上拖拽框选区域
- [ ] 可以拖动区域位置
- [ ] 可以拖动四角缩放区域
- [ ] 右侧显示区域参数
- [ ] 可以切换定位方式
- [ ] 可以切换处理方式
- [ ] 点击"预览效果"跳转到预览页

**预览页**：
- [ ] 显示原图/处理后对比
- [ ] 对比滑杆可以拖动
- [ ] 点击"保存模板"成功
- [ ] 点击"开始批量处理"跳转到批量执行页

**批量执行页**：
- [ ] 显示总进度
- [ ] 显示当前处理的文件
- [ ] 处理完成后显示统计
- [ ] 可以打开输出目录

#### Phase 2 验证清单（模板复用闭环）

**目标**：首页选择模板 → 预览 → 批量执行

- [ ] 首页显示最近模板
- [ ] 点击"应用已有模板"可以选择模板
- [ ] 选择模板后导入图片
- [ ] 导入后直接跳转到预览页
- [ ] 预览页确认后可以批量执行
- [ ] 模板中心显示所有已保存模板
- [ ] 可以编辑已有模板
- [ ] 可以删除模板
- [ ] 历史记录显示所有批量任务
- [ ] 可以从历史记录复用模板

### 15.6 错误边界和降级策略

```typescript
// src/components/layout/ScreenErrorBoundary.tsx
import React, { Component, ErrorInfo, ReactNode } from 'react';
import { useWorkspaceStore } from '../../store/workspace';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ScreenErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // 记录错误
    console.error('Screen error:', error);
    console.error('Error info:', errorInfo);

    // 降级到首页
    try {
      useWorkspaceStore.getState().navigation.currentScreen = 'home';
      useWorkspaceStore.getState().setNotification({
        kind: 'error',
        message: '页面出错了，已返回首页',
      });
    } catch (e) {
      console.error('Failed to navigate away:', e);
    }
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="flex items-center justify-center h-screen bg-background">
          <div className="text-center">
            <h2 className="text-xl font-semibold text-on-surface mb-2">
              页面出错了
            </h2>
            <p className="text-on-surface-variant mb-4">
              {this.state.error?.message || '未知错误'}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-primary text-on-primary rounded-md"
            >
              重新加载
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
```

```typescript
// 在 AppShell 中使用
// src/components/layout/AppShell.tsx
import { ScreenErrorBoundary } from './ScreenErrorBoundary';

export function AppShell({ children }: AppShellProps) {
  // ...

  return (
    <div className="flex h-screen bg-background text-on-surface">
      <SidebarNav currentScreen={currentScreen} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar currentScreen={currentScreen} />
        <main className="flex-1 overflow-auto">
          <ScreenErrorBoundary>
            {children}
          </ScreenErrorBoundary>
        </main>
      </div>
    </div>
  );
}
```

### 15.7 桌面应用特性

作为 Tauri 桌面应用，需要考虑以下特性：

| 特性 | 建议 | 说明 |
|------|------|------|
| **窗口尺寸** | 最小 1200x800，推荐 1440x900 | 保证三栏布局可用 |
| **窗口标题** | 根据当前页面动态变化 | 如"模板构建 - 批量图片处理大师" |
| **键盘快捷键** | Cmd/Ctrl+O 导入<br>Cmd/Ctrl+S 保存模板<br>Cmd/Ctrl+Enter 开始批量 | 提升效率 |
| **拖拽文件** | 支持拖拽文件到应用窗口 | Tauri 原生支持 |
| **系统托盘** | 可选后续添加 | 批量处理时最小化到托盘 |
| **自动更新** | Tauri 内置支持 | 后续考虑 |

```typescript
// 窗口标题动态更新示例
// src/App.tsx
import { useEffect } from 'react';
import { useWorkspaceStore } from './store/workspace';

function App() {
  const currentScreen = useWorkspaceStore((s) => s.navigation.currentScreen);

  useEffect(() => {
    const titles = {
      home: '首页 - 批量图片处理大师',
      builder: '模板构建 - 批量图片处理大师',
      preview: '效果预览 - 批量图片处理大师',
      batch: '批量处理 - 批量图片处理大师',
      templates: '模板中心 - 批量图片处理大师',
      history: '历史记录 - 批量图片处理大师',
      settings: '设置 - 批量图片处理大师',
    };

    document.title = titles[currentScreen] || '批量图片处理大师';
  }, [currentScreen]);

  // ...
}
```

```typescript
// 键盘快捷键示例
// src/hooks/useKeyboardShortcuts.ts
import { useEffect } from 'react';
import { useWorkspaceStore } from '../store/workspace';

export function useKeyboardShortcuts() {
  const currentScreen = useWorkspaceStore((s) => s.navigation.currentScreen);
  const saveTemplate = useWorkspaceStore((s) => s.saveTemplate);
  const startBatch = useWorkspaceStore((s) => s.startBatch);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const cmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;

      // Cmd/Ctrl + S: 保存模板
      if (cmdOrCtrl && e.key === 's') {
        e.preventDefault();
        if (currentScreen === 'builder') {
          // 触发保存模板
        }
      }

      // Cmd/Ctrl + Enter: 开始批量
      if (cmdOrCtrl && e.key === 'Enter') {
        e.preventDefault();
        if (currentScreen === 'preview') {
          startBatch();
        }
      }

      // Cmd/Ctrl + O: 导入文件
      if (cmdOrCtrl && e.key === 'o') {
        e.preventDefault();
        if (currentScreen === 'home') {
          // 触发文件选择
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentScreen, saveTemplate, startBatch]);
}
```

---

## 十六、快速参考

### 16.1 关键文件清单

| 文件 | 状态 | 说明 |
|------|------|------|
| `src/App.tsx` | 修改 | 当前唯一入口，改造成页面骨架 |
| `src/App.legacy.tsx` | 可选 | 过渡期快照，仅在需要时保留 |
| `src/main.tsx` | 保持 | React 入口不变 |
| `src/components/layout/AppShell.tsx` | 新建 | 应用壳层 |
| `src/components/layout/SidebarNav.tsx` | 新建 | 左侧导航 |
| `src/components/layout/TopBar.tsx` | 新建 | 顶部栏 |
| `src/screens/*.tsx` | 新建 | 7个页面容器 |
| `src/store/workspace.ts` | 修改 | 添加 navigation 状态 |
| `src/types.ts` | 修改 | 添加新类型 |
| `tailwind.config.ts` | 修改 | 添加设计系统颜色 |

### 16.2 实施顺序速查

``` 
1. 直接重构 src/App.tsx，建立页面骨架
2. 创建 src/components/layout/ (AppShell, SidebarNav, TopBar)
3. 创建 src/screens/ (7个空页面骨架)
4. 修改 src/store/workspace.ts (添加 navigation 状态)
5. 运行验证：页面可以切换
6. 逐页迁移功能（从旧布局中拆出逻辑）
7. 视需要保留或删除 App.legacy.tsx
```

### 16.3 回滚速查

```text
回滚方式：
1. 使用 Git 历史恢复 `src/App.tsx`
2. 如果保留了 `src/App.legacy.tsx`，可临时复制回 `src/App.tsx`
```
