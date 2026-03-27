---
stepsCompleted: ["step-01-init", "step-02-context", "step-03-starter", "step-04-decisions", "step-05-patterns", "step-06-structure", "step-07-validation", "step-08-complete"]
lastStep: 8
status: complete
completedAt: 2026-03-27
inputDocuments:
  - "_bmad-output/planning-artifacts/prd.md"
  - "_bmad-output/planning-artifacts/ux-design-specification.md"
  - "docs/plans/2026-03-23-batch-image-studio-mvp.md"
  - "docs/plans/2026-03-23-mvp-closure-plan.md"
  - "docs/plans/2026-03-24-local-onnx-inpainting-design.md"
  - "docs/plans/2026-03-26-redesign-feature-list.md"
  - "docs/plans/2026-03-26-interaction-redesign-analysis.md"
  - "docs/plans/2026-03-26-interaction-redesign-implementation-plan.md"
  - "docs/plans/2026-03-26-import-undo-and-template-switching-issues.md"
  - "docs/plans/2026-03-26-import-undo-and-template-switching-issues-complete.md"
  - "docs/plans/2026-03-26-workflow-sequence-diagrams.md"
workflowType: 'architecture'
project_name: 'Batch Image Studio'
user_name: 'Luoyaosheng'
date: 2026-03-27
---

# Architecture Decision Document

_This document builds collaboratively through step-by-step discovery. Sections are appended as we work through each architectural decision together._

---

## Project Context Analysis

### Requirements Overview

**Functional Requirements:**

核心功能架构（46 个功能需求）：

1. **图片导入模块** (FR1-FR5)
   - 支持单/多文件导入
   - 支持文件夹导入
   - 缩略图列表渲染
   - 单张移除功能

2. **区域框选模块** (FR6-FR13)
   - 默认框智能定位（右下角锚定）
   - 拖动/缩放/旋转交互
   - 锚定模式与相对坐标模式
   - 清除/重新框选功能

3. **预览与处理模块** (FR14-FR19)
   - LaMa ONNX AI 修复
   - 预览生成与对比
   - 多种处理方法（AI/模糊/填充/裁切）

4. **批量处理模块** (FR20-FR26)
   - 批量任务执行
   - 进度实时反馈
   - 任务取消与重试
   - 完成统计提示

5. **模板管理模块** (FR27-FR34)
   - 模板保存/应用/编辑/删除
   - 模板切换确认对话框
   - 最近模板显示

6. **历史记录模块** (FR35-FR39)
   - 任务记录存储
   - 历史查看与管理

**Non-Functional Requirements:**

| 类别 | 需求 | 架构驱动 |
|------|------|----------|
| **性能** | 预览生成 <5s (1920x1080) | 模型预加载、后台线程 |
| **性能** | 启动响应 <2s | 代码分割、懒加载 |
| **性能** | 100+ 图片批量处理 | 内存管理、分批处理 |
| **隐私** | 100% 本地处理 | 无云 API、本地存储 |
| **可靠性** | 批量处理 100% 成功率 | 错误隔离、重试机制 |
| **无障碍** | WCAG 2.1 AA | ARIA、键盘导航、焦点管理 |
| **兼容性** | macOS/Windows/Linux | Tauri 跨平台 |

**Scale & Complexity:**

- **Primary domain**: Desktop Application (Tauri + React + Rust)
- **Complexity level**: Medium（Brownfield，MVP 已完成）
- **Estimated architectural components**: 18-22

### Technical Constraints & Dependencies

**技术栈约束：**
- 前端：React 19 + TypeScript + Tailwind CSS
- 状态管理：Zustand（已选定）
- 桌面框架：Tauri 2.x
- 后端逻辑：Rust
- AI 模型：LaMa ONNX（本地运行，已实现在 Rust 端）

**外部依赖：**
- ONNX Runtime（Rust `ort` crate）
- Tauri API（文件系统、窗口管理）
- 系统原生对话框

**平台约束：**
- macOS：代码签名、公证、DMG 打包
- Windows：安装程序、SmartScreen 警告处理
- Linux：AppImage、deb 包

### Cross-Cutting Concerns Identified

| 关注点 | 影响组件 | 实现策略 |
|--------|----------|----------|
| **状态管理** | 所有 UI 组件 | Zustand Store + Selector 模式 |
| **错误处理** | 批量处理、文件操作 | 错误边界 + 用户友好错误提示 |
| **进度反馈** | 预览、批量、加载 | aria-live + UI 进度组件 |
| **撤销/恢复** | 区域、导入、模板 | 8 秒撤销窗口 + 全 Store 撤销中间件 |
| **无障碍** | 所有交互组件 | ARIA 属性 + 键盘导航 |
| **本地存储** | 模板、历史、偏好 | JSON 文件 |
| **内存管理** | 图片处理 | Rust 端 Worker Pool + 及时释放 |

### Architecture Decision Priorities (Party Mode 共识)

| 决策 | 方案 | 优先级 | 复杂度 |
|------|------|--------|--------|
| Zustand Store 结构 | 单一 Store + slice | P0 | 低 |
| 响应式断点系统 | Tauri 原生监听 + Hook | P0 | 中 |
| Modal/Dialog 基础组件 | 内置无障碍功能 | P0 | 中 |
| 撤销中间件设计 | 全 Store 撤销 | P1 | 中 |
| 批量处理进度架构 | Rust Worker Pool (已实现) | P1 | 低 |
| 本地存储策略 | JSON 文件 | P1 | 低 |
| 错误边界架构 | React Error Boundary | P2 | 低 |

---

## Starter Template Evaluation

### Primary Technology Domain

**Desktop Application** (Tauri 2.x + React 19 + TypeScript) based on project requirements analysis.

### Starter Options Considered

| Starter | 来源 | React 版本 | Tailwind | 维护状态 |
|---------|------|-----------|---------|----------|
| **[create-tauri-app](https://v2.tauri.app/start/create-project/)** | 官方 | 19 | ✅ | ✅ 活跃 |
| **[dannysmith/tauri-template](https://github.com/dannysmith/tauri-template)** | 社区 | 19 | ✅ | ✅ 更新 |

### Selected Starter: create-tauri-app (Official)

**Rationale for Selection:**

- 官方支持，与 Tauri 2.x 同步更新
- 支持 React 19 + TypeScript + Tailwind 模板
- 社区活跃，[文档完善](https://v2.tauri.app/start/project-structure/)
- 与现有项目技术栈完全匹配

**Initialization Command:**

```bash
npm create tauri-app@latest
```

**Note:** 由于 Batch Image Studio 是 Brownfield 项目，不需要重新初始化。此分析仅用于参考最佳实践改进现有项目结构。

**Architectural Decisions Provided by Starter:**

**Language & Runtime:**
- TypeScript 5.x（严格模式）
- React 19（并发特性：`useTransition`、`useDeferredValue`）
- Node.js native API（Tauri invoke）

**Styling Solution:**
- Tailwind CSS 3.x（JIT 模式）
- PostCSS 配置
- CSS 变量支持主题切换

**Build Tooling:**
- Vite 5.x（开发服务器、HMR）
- Tauri CLI（桌面打包、代码签名）
- esbuild（快速构建）

**Testing Framework:**
- Vitest（单元测试，与 Vite 兼容）
- React Testing Library（组件测试）

**Code Organization:**

```
src/
├── components/     # React 组件（按功能分组）
│   ├── ui/        # 基础 UI 组件 (Modal, Dialog, Button)
│   ├── region/    # 区域框选相关 (RegionBox, RegionToolbar)
│   ├── batch/     # 批量处理相关 (BatchProgress, BatchControls)
│   └── template/  # 模板管理相关 (TemplatePicker, TemplateEditor)
├── lib/           # 工具函数
├── hooks/         # 自定义 Hooks
│   ├── useBreakpoint.ts    # 响应式断点
│   ├── useImageLoader.ts   # 图片加载
│   └── useRegionState.ts   # 区域状态
├── stores/        # Zustand stores
│   ├── uiStore.ts          # UI 状态（侧边栏、断点、焦点）
│   ├── projectStore.ts     # 项目状态（图片、选中、区域）
│   ├── templateStore.ts    # 模板管理
│   └── historyStore.ts     # 历史记录
├── types/         # TypeScript 类型定义
├── utils/         # 通用工具
├── App.tsx        # 根组件
└── main.tsx       # 应用入口

src-tauri/
├── src/
│   ├── lib.rs     # Rust 入口
│   ├── cmds.rs    # Tauri commands
│   ├── onnx.rs    # ONNX 模型处理
│   └── error.rs   # 错误处理
├── Cargo.toml     # Rust 依赖
└── tauri.conf.json # Tauri 配置
```

**Development Experience:**
- 热模块替换（HMR）- 前端修改自动刷新
- TypeScript 类型检查 - 编译时错误检测
- ESLint + Prettier - 代码风格统一
- 开发模式自动重载 - Rust 修改重新编译

**Brownfield 项目改进建议：**

| 改进项 | 现有状态 | 建议 |
|--------|----------|------|
| **目录结构** | 待确认 | 添加 `src/stores/`、`src/hooks/`、`src/types/` |
| **TypeScript** | 待确认 | 启用严格模式，添加路径别名 |
| **测试** | 无 | 添加 Vitest + React Testing Library |
| **代码质量** | 待确认 | ESLint + Prettier 统一配置 |

**Note:** 项目初始化不适用（Brownfield），但最佳实践应应用到现有项目结构优化中。

---

## Core Architectural Decisions

### Decision Priority Analysis

**Critical Decisions (Block Implementation):**
- ✅ Zustand Store 结构（单一 Store + slice）
- ✅ 响应式断点系统（Tauri 原生监听）

**Important Decisions (Shape Architecture):**
- ✅ Modal/Dialog 基础组件（自建 + Radix UI 原语）
- ✅ 撤销中间件设计（Zustand 自定义）
- ✅ 本地存储策略（SQLite via Tauri Plugin）

**Deferred Decisions (Post-MVP):**
- 测试框架（Vitest + React Testing Library）
- 国际化（i18n）
- 主题切换（暗色模式）

### Frontend Architecture

**State Management:**

| 决策 | 选择 | 版本 | 理由 |
|------|------|------|------|
| Store 结构 | 单一 Store + slice | - | 支持全局撤销、类型安全 |
| 撤销中间件 | Zustand 自定义 | - | 全 Store 撤销、8 秒窗口 |

**Zustand Store 结构定义：**

```typescript
// src/stores/index.ts
interface Store {
  // UI 状态
  ui: {
    sidebarCollapsed: boolean
    activeBreakpoint: Breakpoint
    focusedElement: string | null
    modalStack: string[]
  }

  // 项目状态
  project: {
    images: Image[]
    selectedId: string | null
    region: Region
    processing: boolean
  }

  // 模板
  templates: {
    list: Template[]
    activeId: string | null
  }

  // 历史记录
  history: {
    entries: HistoryEntry[]
  }

  // 设置
  settings: {
    outputDirectory: string
    defaultNaming: string
  }

  // 撤销操作
  undo: () => void
  redo: () => void
  canUndo: () => boolean
  canRedo: () => boolean
}
```

**响应式系统:**

| 决策 | 选择 | 版本 | 理由 |
|------|------|------|------|
| 断点监听 | Tauri 原生 API | 2.x | 性能最佳、与桌面深度集成 |
| 断点级别 | 5 级 | Compact/Narrow/Normal/Wide/Ultrawide | 满足 UX 设计要求 |

**useBreakpoint Hook 实现：**

```typescript
// src/hooks/useBreakpoint.ts
import { getCurrentWindow } from '@tauri-apps/api/window'
import { useState, useEffect } from 'react'

export type Breakpoint = 'compact' | 'narrow' | 'normal' | 'wide' | 'ultrawide'

const BREAKPOINTS = {
  compact: 1024,
  narrow: 1280,
  normal: 1440,
  wide: 1920,
  ultrawide: 2560,
}

export function useBreakpoint(): Breakpoint {
  const [breakpoint, setBreakpoint] = useState<Breakpoint>('normal')

  useEffect(() => {
    const unlisten = getCurrentWindow().onResized(({ width }) => {
      const bp = Object.entries(BREAKPOINTS)
        .reverse()
        .find(([_, min]) => width! >= min)?.[0] as Breakpoint || 'compact'
      setBreakpoint(bp)
    })
    return () => { unlisten.then(fn => fn()) }
  }, [])

  return breakpoint
}
```

**组件架构:**

| 决策 | 选择 | 版本 | 理由 |
|------|------|------|------|
| Modal/Dialog | 自建 + Radix UI | ^1.x | 无障碍内置、高度定制 |
| 其他基础组件 | Tailwind + 自建 | - | 轻量、设计一致 |

**Modal 基础组件结构：**

```typescript
// src/components/ui/Modal.tsx
import * as Dialog from '@radix-ui/react-dialog'
import { useEffect, useRef } from 'react'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
}

export function Modal({ open, onClose, title, children }: ModalProps) {
  const contentRef = useRef<HTMLDivElement>(null)

  // 焦点陷阱（Radix 内置，可自定义增强）
  useEffect(() => {
    if (open && contentRef.current) {
      const firstFocusable = contentRef.current.querySelector(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      ) as HTMLElement
      firstFocusable?.focus()
    }
  }, [open])

  return (
    <Dialog.Root open={open} onOpenChange={onClose}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content
          ref={contentRef}
          className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-lg shadow-lg p-6 w-full max-w-md"
          role="dialog"
          aria-modal="true"
        >
          <Dialog.Title className="text-lg font-semibold">{title}</Dialog.Title>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
```

### Data Architecture

**本地存储:**

| 决策 | 选择 | 版本 | 理由 |
|------|------|------|------|
| 数据库 | SQLite | Tauri Plugin | 结构化查询、适合筛选 |
| 存储内容 | 模板、历史记录、用户偏好 | - | 持久化需求 |
| 备份策略 | JSON 导出/导入 | - | 用户数据所有权 |

**SQLite Schema (参考):**

```sql
-- 模板表
CREATE TABLE templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  region_data TEXT NOT NULL, -- JSON
  processing_method TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- 历史记录表
CREATE TABLE history (
  id TEXT PRIMARY KEY,
  image_count INTEGER NOT NULL,
  template_id TEXT,
  output_directory TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (template_id) REFERENCES templates(id)
);

-- 设置表
CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
```

### Tauri Commands (Rust Backend)

| Command | 描述 | 参数 | 返回值 |
|---------|------|------|--------|
| `process_image` | ONNX 推理 | `image: Vec<u8>`, `region: Region` | `Result<Vec<u8>>` |
| `batch_process` | 批量处理 | `images: Vec<ImagePath>`, `template: Template` | `ProgressStream` |
| `save_template` | 保存模板 | `template: Template` | `Result<TemplateId>` |
| `load_templates` | 加载模板 | - | `Vec<Template>` |
| `save_history` | 保存历史 | `entry: HistoryEntry` | `Result<HistoryId>` |
| `load_history` | 加载历史 | - | `Vec<HistoryEntry>` |

### Decision Impact Analysis

**Implementation Sequence:**

1. **P0 - 基础架构** (10h)
   - Zustand Store 结构定义
   - 响应式断点 Hook 实现
   - Modal/Dialog 基础组件

2. **P1 - 功能增强** (12h)
   - 撤销中间件集成
   - SQLite 存储层

3. **P2 - 优化** (8h)
   - 测试框架搭建
   - 性能优化

**Cross-Component Dependencies:**

```
┌─────────────────────────────────────────────────────────────┐
│                        App Root                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              Zustand Store (Single)                  │   │
│  │  ┌──────────┬──────────┬──────────┬──────────────┐  │   │
│  │  │ uiSlice  │projectSlice│templateSlice│historySlice│ │   │
│  │  └──────────┴──────────┴──────────┴──────────────┘  │   │
│  │                       ↓                               │   │
│  │              Undo Middleware                         │   │
│  └─────────────────────────────────────────────────────┘   │
│                          ↓                                   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              useBreakpoint Hook                      │   │
│  │           (Tauri Window Resized)                    │   │
│  └─────────────────────────────────────────────────────┘   │
│                          ↓                                   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │           Components (Responsive)                    │   │
│  │  ┌─────────┬─────────┬─────────┬─────────────────┐   │   │
│  │  │ Region  │  Image  │ Batch   │ Modal (Radix)   │   │   │
│  │  │  Box    │  List   │Progress │    + A11Y       │   │   │
│  │  └─────────┴─────────┴─────────┴─────────────────┘   │   │
│  └─────────────────────────────────────────────────────┘   │
│                          ↓                                   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              SQLite Storage (Tauri)                  │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## Implementation Patterns & Consistency Rules

### Pattern Categories Defined

**Critical Conflict Points Identified:**
7 个主要冲突类别（命名、结构、格式、通信、过程、无障碍、类型安全）

### Naming Patterns

**React Component Naming:**
- 组件文件：`PascalCase.tsx`（单文件单组件）
- 组件名：与文件名一致
- 组件 Props 接口：`ComponentNameProps`
- Props 解构：直接在参数中解构（`{ prop1, prop2 }`）

**Zustand Store Naming (Party Mode 更新):**
- Store 文件：`camelCase.ts`（如 `ui.ts`，**不是** `uiSlice.ts`）
- Store Hook：`use` + `PascalCase` + `Store`（如 `useUIStore`）
- Slice 对象：直接使用 TypeScript 接口定义
- Actions：`set` + `PascalCase`（如 `setSelectedImage`）

**Tauri Command Naming:**
- Rust 函数：`snake_case`（如 `process_image`）
- Command 类型定义：`PascalCase` + `Command`（前端）

**Hook Naming:**
- 自定义 Hook：`use` + `PascalCase`（如 `useBreakpoint`）
- Hook 文件：与 Hook 名一致

**Type Naming:**
- 类型/接口：`PascalCase`
- 类型参数：`T` + 描述（如 `TImage`, `TTemplate`）
- 泛型约束：`T extends`

### Structure Patterns

**Project Organization:**
```
src/
├── components/
│   ├── ui/              # 基础 UI 组件（可复用）
│   │   ├── Modal.tsx
│   │   ├── Modal.test.tsx      # 单元测试
│   │   ├── Modal.a11y.test.tsx # 无障碍测试
│   │   ├── Button.tsx
│   │   └── ...
│   ├── region/          # 区域框选功能组件
│   │   ├── RegionBox.tsx
│   │   ├── RegionToolbar.tsx
│   │   └── RegionBox.test.tsx
│   ├── batch/           # 批量处理功能组件
│   │   ├── BatchProgress.tsx
│   │   ├── BatchControls.tsx
│   │   └── ...
│   └── template/        # 模板管理功能组件
│       ├── TemplatePicker.tsx
│       └── TemplateEditor.tsx
├── hooks/               # 自定义 Hooks
│   ├── useBreakpoint.ts
│   ├── useImageLoader.ts
│   └── useRegionState.ts
├── stores/              # Zustand stores
│   ├── index.ts         # 统一导出
│   ├── ui.ts            # UI 状态
│   ├── project.ts       # 项目状态
│   ├── template.ts      # 模板管理
│   ├── history.ts       # 历史记录
│   └── selectors.ts     # Selector 函数（新增）
├── types/               # TypeScript 类型定义
│   ├── models.ts        # 数据模型
│   ├── api.ts           # API 类型
│   └── store.ts         # Store 类型
├── utils/               # 通用工具函数
│   ├── cn.ts            # className 合并
│   └── format.ts        # 格式化工具
├── lib/                 # 第三方库封装
│   └── tauri.ts         # Tauri API 封装
├── App.tsx
└── main.tsx

src-tauri/
├── src/
│   ├── commands/        # Tauri commands（按功能分组）
│   │   ├── mod.rs       # 统一导出
│   │   ├── image.rs     # 图片处理命令
│   │   ├── template.rs  # 模板管理命令
│   │   └── history.rs   # 历史记录命令
│   ├── models/          # 数据模型
│   ├── services/        # 业务逻辑
│   ├── onnx.rs          # ONNX 模型处理
│   └── error.rs         # 错误类型
├── api/
│   └── commands.ts      # 自动生成的类型定义（新增）
└── Cargo.toml

tests/                   # 集成测试
├── e2e/
└── integration/
```

**Test Organization:**
- 单元测试：与源文件 colocated（`Component.test.tsx`）
- 无障碍测试：单独文件（`Component.a11y.test.tsx`）
- 集成测试：`tests/` 目录

### Format Patterns

**Tauri Command Response:**
```typescript
// 成功响应
interface CommandSuccess<T> {
  success: true
  data: T
}

// 错误响应
interface CommandError {
  success: false
  error: {
    code: string
    message: string
  }
}

type CommandResult<T> = CommandSuccess<T> | CommandError
```

**State Update Pattern:**
```typescript
// Zustand 不可变更新
setSelectedImage: (id) => set((state) => ({
  project: { ...state.project, selectedId: id }
}))

// 或使用 Immer 中间件
setSelectedImage: (id) => set((state) => {
  state.project.selectedId = id
})
```

### Communication Patterns

**Tauri Command Pattern (类型安全):**
```rust
// src-tauri/src/commands/image.rs
#[tauri::command]
pub async fn process_image(
    image: Vec<u8>,
    region: Region,
) -> Result<Vec<u8>, String> {
    // 实现
    Ok(processed)
}
```

```typescript
// src-tauri/api/commands.ts（自动生成的类型定义）
export interface Commands {
  process_image: (image: Uint8Array, region: Region) => Promise<Uint8Array>
  save_template: (template: Template) => Promise<string>
  load_templates: () => Promise<Template[]>
}

// 前端使用（类型安全）
import { invoke } from '@tauri-apps/api/tauri'
import type { Commands } from '@/../../src-tauri/api/commands'

const result = await invoke<Commands['process_image']>(
  'process_image',
  { image: data, region: selectedRegion }
)
```

**Event Naming:**
- Store 订阅：`on` + `EventName`（如 `onImageLoad`）
- UI 事件处理器：`handle` + `Action`（如 `handleSubmit`）

### Process Patterns

**Error Handling Pattern (Party Mode 细化):**
```typescript
// 用户友好的错误接口
interface ErrorAction {
  label: string        // "重试"
  action: () => void
  primary?: boolean    // 标记主要操作
}

interface UserError {
  title: string        // "无法加载图片"
  message: string      // 友好描述
  solutions: ErrorAction[]
  learnMore?: string   // 链接到帮助文档
}

// 组件级错误边界
<ErrorBoundary
  fallback={<ErrorScreen />}
  onError={(error) => showError({ ...error })}
>
  <App />
</ErrorBoundary>

// 操作级错误处理
try {
  await operation()
} catch (error) {
  showError({
    title: "操作失败",
    message: error.userMessage || "未知错误",
    solutions: [
      { label: '重试', action: () => operation(), primary: true },
      { label: '查看帮助', action: () => openHelp() },
    ],
    learnMore: "/help/error-codes/OPERATION_FAILED",
  })
}
```

**Loading State Pattern (Party Mode 细化):**
```typescript
// Zustand Store 细化
interface LoadingState {
  isLoading: boolean
  loadingStage: 'model_loading' | 'processing' | 'saving' | null
  loadingMessage: string | null
  loadingProgress: number | null  // 0-100
}

// 使用
const { isLoading, loadingStage, loadingProgress } = useUIStore()

// UI 显示
{isLoading && (
  <LoadingProgress
    stage={loadingStage}
    message={loadingMessage}
    progress={loadingProgress}
  />
)}
```

**Accessibility Pattern:**
```tsx
// 所有交互组件必须支持键盘导航
<button
  onClick={handleClick}
  aria-label="关闭对话框"
  aria-pressed={isPressed}
>

// Modal 必须有焦点陷阱和 aria-modal
<Dialog.Root
  aria-modal="true"
  onEscapeKeyDown={handleClose}
>
  <Dialog.Content
    onInteractOutside={(e) => e.preventDefault()}  // 阻止点击外部关闭
  >
    {/* 内容 */}
  </Dialog.Content>
</Dialog.Root>
```

### Selector Patterns (Party Mode 新增)

**Selector 函数模式：**
```typescript
// stores/selectors.ts
import type { Store } from './types'

// 获取当前选中的图片
export const selectCurrentImage = (state: Store) =>
  state.project.images.find(img => img.id === state.project.selectedId)

// 获取已处理的图片
export const selectProcessedImages = (state: Store) =>
  state.project.images.filter(img => img.status === 'processed')

// 获取批量处理进度
export const selectBatchProgress = (state: Store) => {
  const total = state.project.images.length
  const processed = state.project.images.filter(img => img.status === 'processed').length
  return total > 0 ? (processed / total) * 100 : 0
}

// 使用
import { selectCurrentImage } from './selectors'

const currentImage = selectCurrentImage(useStore.getState())
```

### Component Props Pattern (Party Mode 新增)

**Props 解构模式：**
```typescript
// ✅ 好的做法
interface RegionBoxProps {
  region: Region
  onChange: (region: Region) => void
  disabled?: boolean
}

export function RegionBox({
  region,
  onChange,
  disabled = false  // 默认值
}: RegionBoxProps) {
  // ...
}

// ❌ 避免
export function RegionBox(props: RegionBoxProps) {
  const { region, onChange } = props
  // ...
}
```

### Enforcement Guidelines

**All AI Agents MUST:**

1. **使用 TypeScript 严格模式** - 所有代码必须通过类型检查
2. **遵循 ARIA 最佳实践** - 所有交互组件必须有适当的 ARIA 属性
3. **错误消息必须友好** - 用户看到的错误必须提供解决方案
4. **组件必须有 Props 类型** - 不使用 `any` 或未定义的 props
5. **Tauri Commands 必须返回 Result** - Rust 端使用 `Result<T, String>`
6. **Props 必须解构** - 在函数签名中直接解构 props
7. **添加无障碍测试** - 所有交互组件必须有 `.a11y.test.tsx`

**Pattern Enforcement:**
- ESLint 规则强制命名约定
- TypeScript strict 模式强制类型安全
- Pre-commit hook 运行 lint 和类型检查
- CI/CD 运行无障碍测试（axe-core）

### Pattern Examples

**Good Examples:**
```typescript
// ✅ 组件命名 + Props 解构
interface RegionBoxProps {
  region: Region
  onChange: (region: Region) => void
}
export function RegionBox({ region, onChange }: RegionBoxProps) {
  // ...
}

// ✅ Hook 命名
export function useBreakpoint(): Breakpoint {
  // ...
}

// ✅ Store（更新后）
// stores/ui.ts
interface UIState {
  sidebarCollapsed: boolean
  activeBreakpoint: Breakpoint
}
export const useUIStore = create<UIState>((set) => ({
  sidebarCollapsed: false,
  activeBreakpoint: 'normal',
}))

// ✅ Selector（新增）
export const selectCurrentImage = (state: Store) =>
  state.project.images.find(img => img.id === state.project.selectedId)

// ✅ Tauri Command 类型安全
const result = await invoke<Commands['process_image']>(
  'process_image',
  { image, region }
)
```

**Anti-Patterns:**
```typescript
// ❌ 组件文件 kebab-case
// region-box.tsx

// ❌ Hook 没有 'use' 前缀
// function breakpoint() { }

// ❌ Store 文件命名误导
// uiSlice.ts → 应该是 ui.ts

// ❌ Props 没有解构
// function RegionBox(props: Props) {
//   const { region } = props
// }

// ❌ 使用 any
// function Component(props: any) { }

// ❌ 没有类型安全调用 Tauri
// invoke('process_image', { image, region })
```

---

## Project Structure & Boundaries

### Complete Project Directory Structure

```bash
batch-image-studio/
├── README.md
├── LICENSE
├── .gitignore
├── .env.example
├── package.json
├── pnpm-lock.yaml
├── tsconfig.json
├── tailwind.config.js
├── vite.config.ts
├── .eslintrc.js
├── .prettierrc
├── .github/
│   └── workflows/
│       ├── ci.yml
│       └── release.yml
│
├── docs/
│   ├── architecture.md
│   ├── data-flow.md       # 数据流文档
│   ├── component-communication.md  # 组件通信
│   └── api.md             # Tauri Commands API
│
├── src/
│   ├── main.tsx           # 应用入口
│   ├── App.tsx            # 根组件
│   ├── vite-env.d.ts
│   │
│   ├── components/
│   │   ├── ui/            # 基础 UI 组件
│   │   │   ├── Button.tsx
│   │   │   ├── Button.test.tsx
│   │   │   ├── Button.a11y.test.tsx
│   │   │   ├── Modal.tsx
│   │   │   ├── Dialog.tsx
│   │   │   ├── Input.tsx
│   │   │   ├── Progress.tsx
│   │   │   └── index.ts
│   │   │
│   │   ├── import/        # 图片导入功能
│   │   │   ├── ImageUploader.tsx
│   │   │   ├── FileSelector.tsx
│   │   │   ├── ImageList.tsx
│   │   │   ├── ImageThumbnail.tsx
│   │   │   └── index.ts
│   │   │
│   │   ├── region/        # 区域框选功能
│   │   │   ├── RegionBox.tsx
│   │   │   ├── RegionHandles.tsx
│   │   │   ├── RegionToolbar.tsx
│   │   │   └── index.ts
│   │   │
│   │   ├── preview/       # 预览功能
│   │   │   ├── PreviewCanvas.tsx
│   │   │   ├── CompareSlider.tsx
│   │   │   └── index.ts
│   │   │
│   │   ├── batch/         # 批量处理功能
│   │   │   ├── BatchProgress.tsx
│   │   │   ├── BatchControls.tsx
│   │   │   ├── ResultsPanel.tsx
│   │   │   └── index.ts
│   │   │
│   │   ├── template/      # 模板管理功能
│   │   │   ├── TemplatePicker.tsx
│   │   │   ├── TemplateEditor.tsx
│   │   │   ├── TemplateCard.tsx
│   │   │   └── index.ts
│   │   │
│   │   ├── history/       # 历史记录功能
│   │   │   ├── HistoryList.tsx
│   │   │   ├── HistoryDetail.tsx
│   │   │   └── index.ts
│   │   │
│   │   └── layout/        # 布局组件
│   │       ├── AppLayout.tsx
│   │       ├── Sidebar.tsx
│   │       ├── Header.tsx
│   │       └── index.ts
│   │
│   ├── hooks/             # 按功能分组
│   │   ├── ui/            # UI 相关 Hooks
│   │   │   ├── useBreakpoint.ts
│   │   │   ├── useFocusTrap.ts
│   │   │   └── useKeyboardNav.ts
│   │   ├── data/          # 数据加载 Hooks
│   │   │   ├── useImageLoader.ts
│   │   │   ├── useTemplate.ts
│   │   │   └── useHistory.ts
│   │   ├── state/         # 状态管理 Hooks
│   │   │   ├── useRegionState.ts
│   │   │   ├── useUndo.ts
│   │   │   └── useStore.ts
│   │   └── index.ts
│   │
│   ├── stores/            # Zustand stores
│   │   ├── index.ts       # 统一导出
│   │   ├── types.ts       # Store 类型定义
│   │   ├── ui.ts          # UI 状态
│   │   ├── project.ts     # 项目状态
│   │   ├── template.ts    # 模板状态
│   │   ├── history.ts     # 历史状态
│   │   └── selectors.ts   # Selector 函数
│   │
│   ├── types/             # 按域划分
│   │   ├── domain/        # 领域模型
│   │   │   ├── image.ts
│   │   │   ├── template.ts
│   │   │   └── history.ts
│   │   ├── api/           # API 类型
│   │   │   └── commands.ts
│   │   ├── ui/            # UI 类型
│   │   │   ├── components.ts
│   │   │   └── stores.ts
│   │   └── index.ts
│   │
│   ├── contexts/          # Context Providers
│   │   ├── ThemeContext.tsx
│   │   └── A11yContext.tsx
│   │
│   ├── constants/         # 常量定义
│   │   ├── breakpoints.ts
│   │   ├── shortcuts.ts
│   │   └── defaults.ts
│   │
│   ├── services/          # 前端服务层
│   │   └── imageService.ts
│   │
│   ├── adapters/          # 适配器层
│   │   ├── tauri.ts       # Tauri API 适配
│   │   └── sqlite.ts      # SQLite 适配
│   │
│   ├── utils/             # 纯工具函数
│   │   ├── cn.ts          # className 合并
│   │   ├── format.ts      # 格式化
│   │   ├── validation.ts  # 验证
│   │   └── index.ts
│   │
│   ├── styles/
│   │   ├── globals.css
│   │   └── components.css
│   │
│   └── assets/
│       ├── icons/
│       └── images/
│
├── src-tauri/             # Rust 后端
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   ├── build.rs
│   │
│   ├── src/
│   │   ├── main.rs
│   │   ├── lib.rs
│   │   ├── error.rs
│   │   │
│   │   ├── commands/      # Tauri commands
│   │   │   ├── mod.rs
│   │   │   ├── image.rs
│   │   │   ├── template.rs
│   │   │   ├── history.rs
│   │   │   └── settings.rs
│   │   │
│   │   ├── models/        # 数据模型
│   │   │   ├── mod.rs
│   │   │   ├── image.rs
│   │   │   ├── template.rs
│   │   │   └── history.rs
│   │   │
│   │   ├── services/      # 业务逻辑（按模块组织）
│   │   │   ├── mod.rs
│   │   │   ├── onnx/     # ONNX 服务
│   │   │   │   ├── mod.rs
│   │   │   │   ├── model.rs
│   │   │   │   └── inference.rs
│   │   │   ├── storage/  # 存储服务
│   │   │   │   ├── mod.rs
│   │   │   │   ├── database.rs
│   │   │   │   └── file.rs
│   │   │   └── image/    # 图片处理
│   │   │       ├── mod.rs
│   │   │       └── process.rs
│   │   │
│   │   └── utils/        # 工具函数
│   │       ├── mod.rs
│   │       └── region.rs
│   │
│   ├── tests/            # Rust 测试
│   │   ├── commands/
│   │   │   └── image_test.rs
│   │   └── services/
│   │       └── onnx_test.rs
│   │
│   ├── api/
│   │   └── commands.ts   # 自动生成的类型定义
│   │
│   └── assets/
│       └── icons/
│
├── tests/                # 集成测试
│   ├── fixtures/         # 测试数据
│   │   ├── images/
│   │   ├── templates/
│   │   └── mocks/
│   │       ├── tauri.ts
│   │       └── store.ts
│   ├── integration/      # 集成测试
│   │   └── template-flow.spec.ts
│   └── e2e/              # 端到端测试
│       └── user-journey.spec.ts
│
└── dist/                 # 构建输出 (gitignore)
```

### Architectural Boundaries

**Tauri Command Boundaries:**

| 层 | 职责 | 接口 |
|------|------|------|
| 前端 | UI 展示、用户交互 | `invoke<T>(command, args)` |
| Tauri IPC | 进程间通信 | `#[tauri::command]` 宏 |
| Rust | 业务逻辑、数据处理 | `Result<T, String>` 返回 |

**Component Boundaries:**

| 类型 | 职责 | 示例 | 依赖 |
|------|------|------|------|
| UI 组件 | 纯展示、可复用 | Button, Modal | 无 Store 依赖 |
| 功能组件 | 业务逻辑、状态管理 | ImageList, TemplatePicker | 使用 Store |
| 布局组件 | 页面结构、数据传递 | AppLayout, Sidebar | 组合其他组件 |

**State Boundaries:**

| 类型 | 范围 | 访问方式 |
|------|------|----------|
| Store 状态 | 全局共享 | `useStore()` Hook |
| 组件状态 | 本地 UI | `useState()` |
| 服务状态 | 远程数据 | Tauri Commands |

### Requirements to Structure Mapping

| FR 类别 | 组件目录 | Store | Tauri Commands |
|---------|----------|-------|----------------|
| 图片导入 (FR1-FR5) | `components/import/` | `project` | `import_files`, `remove_image` |
| 区域框选 (FR6-FR13) | `components/region/` | `project` | - |
| 预览处理 (FR14-FR19) | `components/preview/` | `project` | `process_image`, `generate_preview` |
| 批量处理 (FR20-FR26) | `components/batch/` | `project` | `batch_process`, `cancel_batch` |
| 模板管理 (FR27-FR34) | `components/template/` | `template` | `save_template`, `load_templates`, `delete_template` |
| 历史记录 (FR35-FR39) | `components/history/` | `history` | `save_history`, `load_history`, `clear_history` |

### Integration Points

**Internal Communication:**

```
┌─────────────────────────────────────────────────────────────┐
│                        Component Layer                       │
│  ┌──────────┬──────────┬──────────┬─────────────────────┐  │
│  │ Import   │ Region   │ Batch    │ Template             │  │
│  └────┬─────┴────┬─────┴────┬─────┴──────┬──────────────┘  │
│       │          │          │           │                   │
│       ▼          ▼          ▼           ▼                   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                  Hooks Layer                         │   │
│  │  useImageLoader │ useRegionState │ useTemplate      │   │
│  └────────────────────┬────────────────────────────────┘   │
│                       │                                     │
│  ┌────────────────────▼────────────────────────────────┐   │
│  │                  Store Layer (Zustand)               │   │
│  │  ┌─────────┬──────────┬─────────┬─────────────────┐  │   │
│  │  │project  │ template │ history │     UI          │  │   │
│  │  └────┬────┴────┬─────┴────┬────┴────┬────────────┘  │   │
│  └───────┼──────────┼──────────┼─────────┼──────────────┘   │
│          │          │          │         │                   │
│          ▼          ▼          ▼         ▼                   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                  Adapters Layer                      │   │
│  │              (tauri.ts, sqlite.ts)                   │   │
│  └────────────────────┬────────────────────────────────┘   │
│                       │                                     │
│  ┌────────────────────▼────────────────────────────────┐   │
│  │               Tauri IPC Boundary                     │   │
│  └────────────────────┬────────────────────────────────┘   │
│                       │                                     │
│  ┌────────────────────▼────────────────────────────────┐   │
│  │                  Rust Backend                        │   │
│  │  ┌─────────┬──────────┬─────────┬─────────────────┐  │   │
│  │  │commands │  models  │services │      utils      │  │   │
│  │  └─────────┴──────────┴─────────┴─────────────────┘  │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

**Data Flow:**

```
用户操作 → 组件事件 → Store Action → State 更新 → 组件重渲染
                │
                ▼
         Tauri Command → Rust 处理 → 返回结果 → State 更新
```

**Cross-Cutting Concerns:**

| 关注点 | 实现位置 | 影响范围 |
|--------|----------|----------|
| 错误处理 | `adapters/tauri.ts` + ErrorBoundary | 所有组件 |
| 无障碍 | `components/ui/` + `hooks/ui/` | 所有交互组件 |
| 状态持久化 | `stores/` + SQLite | 模板、历史、设置 |
| 日志记录 | `adapters/tauri.ts` | 所有 Tauri 调用 |
| 性能优化 | `hooks/data/` + Store selectors | 图片加载、批量处理 |

### File Organization Patterns

**Configuration Files:**
- 根目录：`package.json`, `tsconfig.json`, `vite.config.ts`
- Tauri 配置：`src-tauri/tauri.conf.json`
- 环境变量：`.env.example`（`.env` 在 .gitignore）

**Source Organization:**
- 按功能分组：`components/import/`, `components/region/`
- 按类型分组：`hooks/ui/`, `hooks/data/`
- 按域分组：`types/domain/`, `types/api/`

**Test Organization:**
- 单元测试：与源文件 colocated
- 无障碍测试：单独文件 `.a11y.test.tsx`
- 集成测试：`tests/integration/`
- 测试数据：`tests/fixtures/`

---

## Architecture Validation Results

### Coherence Validation ✅

**Decision Compatibility:**
- ✅ Tauri 2.x + React 19 + TypeScript 版本完全兼容
- ✅ Zustand + Radix UI + Tailwind CSS 无冲突
- ✅ Rust ONNX 服务与 SQLite 存储架构一致
- ✅ 无冲突决策

**Pattern Consistency:**
- ✅ 命名约定统一（PascalCase 组件、camelCase Store、snake_case Command）
- ✅ 实施模式支持所有架构决策
- ✅ 通信模式一致（Tauri IPC + Zustand + Hooks）

**Structure Alignment:**
- ✅ 项目结构支持所有功能模块
- ✅ 组件边界清晰（UI/功能/布局）
- ✅ 集成点定义完整（Tauri Commands）

### Requirements Coverage Validation ✅

**Functional Requirements Coverage:**
- ✅ 6 个功能类别全部覆盖
- ✅ 46 个功能需求有架构支持
- ✅ 横切关注点（状态、错误、无障碍）已处理

**Non-Functional Requirements Coverage:**
- ✅ 性能要求：模型预加载、Worker Pool、代码分割
- ✅ 隐私要求：100% 本地、SQLite 存储
- ✅ 可靠性要求：错误隔离、Result 类型
- ✅ 无障碍要求：WCAG 2.1 AA、Radix UI、ARIA 模式

### Implementation Readiness Validation ✅

**Decision Completeness:**
- ✅ 5 大关键决策已文档化
- ✅ 技术栈版本已指定
- ✅ 7 大强制规则已定义
- ✅ Good/Anti-patterns 示例完整

**Structure Completeness:**
- ✅ 完整目录结构已定义
- ✅ 组件边界已建立
- ✅ 集成点已映射
- ✅ 需求到结构映射完整

**Pattern Completeness:**
- ✅ 7 大冲突类别已处理
- ✅ 命名约定全面覆盖
- ✅ 通信/过程模式已定义

### Gap Analysis Results

**Critical Gaps:** 无

**Important Gaps:** 无

**Nice-to-Have Gaps:**
- 测试框架配置（Vitest + React Testing Library）
- CI/CD 流程配置

### Party Mode Validation Discussion (补充内容)

**开发者视角补充：**
- 撤销中间件实现需要示例代码
- useBreakpoint Hook 需要处理初始窗口尺寸
- Radix UI + Tailwind 集成需要示例

**QA 视角补充：**
- 无障碍测试工具：axe-core、jest-axe、Playwright
- 测试覆盖率目标：单元测试 ≥70%、无障碍 100%

**产品视角补充：**
- MVP 分阶段实施计划
- 成功指标定义

**架构视角补充：**
- 数据流图文档
- 错误边界策略
- 性能监控点定义

### Implementation Phase Plan (Party Mode 建议)

**Phase 1 (P0 - 基础架构) - 10h:**
1. Zustand Store 结构定义
2. 响应式断点 Hook 实现
3. Modal/Dialog 基础组件（Radix UI）
4. 颜色对比度调整

**Phase 2 (P1 - 功能增强) - 12h:**
1. 撤销中间件集成
2. SQLite 存储层
3. 键盘快捷键实现
4. 批量处理进度架构

**Phase 3 (P2 - 优化) - 8h:**
1. 测试框架搭建
2. 性能监控集成
3. CI/CD 配置

### Architecture Completeness Checklist

**✅ Requirements Analysis**
- [x] 项目上下文完整分析
- [x] 规模和复杂度评估
- [x] 技术约束识别
- [x] 横切关注点映射

**✅ Architectural Decisions**
- [x] 关键决策已文档化并注明版本
- [x] 技术栈完全指定
- [x] 集成模式已定义
- [x] 性能考虑已处理

**✅ Implementation Patterns**
- [x] 命名约定已建立
- [x] 结构模式已定义
- [x] 通信模式已指定
- [x] 过程模式已文档化

**✅ Project Structure**
- [x] 完整目录结构已定义
- [x] 组件边界已建立
- [x] 集成点已映射
- [x] 需求到结构映射完整

### Architecture Readiness Assessment

**Overall Status:** ✅ READY FOR IMPLEMENTATION

**Confidence Level:** HIGH

**Key Strengths:**
1. 技术栈成熟稳定（Tauri 2.x + React 19 + Rust）
2. 无障碍设计完整（WCAG 2.1 AA + Radix UI）
3. 实施模式清晰可执行
4. 项目结构完整可落地
5. Party Mode 多视角验证充分

**Areas for Future Enhancement:**
1. 测试框架配置
2. CI/CD 自动化
3. 性能监控集成
4. 国际化支持

### Implementation Handoff

**AI Agent Guidelines:**
- 严格遵循所有架构决策
- 一致使用实施模式
- 尊重项目结构和边界
- 参考本文档解决架构问题

**First Implementation Priority:**
1. Zustand Store 结构定义 (`src/stores/`)
2. 响应式断点 Hook 实现 (`src/hooks/ui/useBreakpoint.ts`)
3. Modal/Dialog 基础组件 (`src/components/ui/`)

### Data Flow Summary

```
用户操作 → 组件事件 → Hook 调用 → Store Action → State 更新 → 组件重渲染
                │
                ▼
         Tauri Command → Rust 处理 → Result<T> → State 更新 → UI 更新
```

### Error Boundary Strategy

```
AppRoot
  │
  ├── ImageErrorBoundary    (图片处理错误)
  │     └── 友好错误提示 + 重试
  │
  ├── TemplateErrorBoundary  (模板错误)
  │     └── 清空模板 + 默认值
  │
  └── StorageErrorBoundary   (存储错误)
        └── 降级到内存存储
```

### Performance Monitoring Points

| 监控点 | 目标 | 实现方式 |
|--------|------|----------|
| 预览生成时间 | <5s | performance.mark() |
| 批量处理吞吐量 | 100 张无溢出 | 内存监控 |
| 启动时间 | <2s | performance.getEntriesByType() |
| 内存峰值 | <2GB | performance.memory |

---

