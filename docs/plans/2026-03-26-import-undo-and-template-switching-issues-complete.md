# 导入撤销与模板切换问题分析（完整版）

> **文档目的**：基于《页面交互操作草稿（补充：清除 / 撤销 / 替换逻辑）》分析当前实现中的问题
> **创建时间**：2026-03-26
> **关联文档**：页面交互操作草稿.md、补充稿.md
> **关联文件**：src/App.tsx, src/store/workspace.ts, src/screens/TemplateBuilderScreen.tsx

---

## 零、核心原则

> **任何一步都要有明确的"重来"和"退出"路径。**

用户在以下场景不能被卡住：
- 图导错了
- 框错了
- 参数改乱了
- 模板套错了
- 想放弃当前任务
- 想重新开始

需要补齐的 5 类动作：
1. **清除当前选区**
2. **重置当前区域设置**
3. **清空当前任务**
4. **替换当前模板**
5. **取消当前批量任务**

---

## 一、最必须的 6 个补充入口

根据补充稿，以下 6 个是**最少一定要补**的：

| # | 入口 | 位置 | 优先级 |
|---|------|------|--------|
| 1 | 清空当前任务 | 模板构建页左侧 | P0 |
| 2 | 清除选区 | 模板构建页中间/右侧 | P0 |
| 3 | 重置当前区域设置 | 模板构建页右侧 | P0 |
| 4 | 离开页面确认 | 模板构建页导航触发 | P0 |
| 5 | 模板替换确认 | 应用模板时 | P0 |
| 6 | 取消任务 | 批量执行页 | P0 |

---

## 二、问题 1：清空当前任务

### 2.1 问题描述

用户导入图片后进入 `builder` 页面，想要清空当前任务重新开始时，没有明显的 UI 入口。

### 2.2 当前实现

`src/store/workspace.ts` 中已有 `clearWorkspace` 函数：

```typescript
clearWorkspace: () =>
  set((state) => ({
    importedImages: [],
    selectedImageId: null,
    warnings: [],
    preview: null,
    lastBatchResult: null,
    currentTemplateId: null,
    currentTemplateName: "",
    isTemplateDirty: false,
    cleanupMethod: state.appSettings.defaultCleanupMethod,
    sizeHandlingMode: state.appSettings.defaultSizeHandlingMode,
    outputDir: state.appSettings.defaultOutputDir,
    notification: { kind: "info", message: "当前任务已清空，可重新导入图片或文件夹。" },
  })),
```

**问题**：函数存在，但 UI 上没有入口。

### 2.3 补充稿规范

#### 位置
左侧图片列表上方，靠近任务标题区域。

#### 按钮文案
**清空当前任务**

#### 点击后弹窗

```
标题：清空当前任务？

说明：清空后将移除当前导入的图片、预览结果和未保存的编辑内容，并返回首页。

按钮：
- 取消
- 清空并返回首页
```

#### 执行结果
- 当前任务状态清空
- 当前页面关闭
- 返回首页

### 2.4 实现方案

#### 在 TemplateBuilderScreen 添加按钮

```typescript
// src/screens/TemplateBuilderScreen.tsx

// 新增 props
interface TemplateBuilderScreenProps {
  // ... 现有 props
  onClearWorkspace: () => void;
}

// 在左侧 section 中，样图列表之前添加
{importedImages.length > 0 && (
  <button
    className="w-full rounded-2xl border border-line bg-surface px-4 py-3 text-sm text-muted hover:text-ink hover:bg-white transition"
    type="button"
    onClick={onClearWorkspace}
  >
    清空当前任务
  </button>
)}
```

#### 在 App.tsx 中实现弹窗确认

```typescript
// src/App.tsx

const [showClearConfirm, setShowClearConfirm] = useState(false);

function handleClearWorkspace() {
  setShowClearConfirm(true);
}

function handleConfirmClear() {
  setShowClearConfirm(false);
  clearWorkspace();
  setCurrentScreen("home");
}

// 确认对话框 JSX
{showClearConfirm && (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
    <div className="rounded-2xl bg-white p-6 shadow-ambient max-w-md w-full mx-4">
      <h3 className="text-lg font-semibold text-ink">清空当前任务？</h3>
      <p className="mt-2 text-sm text-muted">
        清空后将移除当前导入的图片、预览结果和未保存的编辑内容，并返回首页。
      </p>
      <div className="mt-6 flex justify-end gap-3">
        <button
          className="rounded-xl border border-line bg-white px-4 py-2 text-sm font-medium"
          type="button"
          onClick={() => setShowClearConfirm(false)}
        >
          取消
        </button>
        <button
          className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-white"
          type="button"
          onClick={handleConfirmClear}
        >
          清空并返回首页
        </button>
      </div>
    </div>
  </div>
)}
```

---

## 三、问题 2：清除选区 / 重新框选

### 3.1 问题描述

用户框选区域后，如果想重新框选，没有明显的操作入口。

### 3.2 补充稿规范

#### 位置
中间预览区工具条，或右侧"区域位置"卡片中。

#### 按钮文案
- **清除选区** — 删除当前区域框
- **重新框选** — 进入重新拖拽状态

#### 区别

| 操作 | 结果 |
|------|------|
| **清除选区** | 当前矩形框消失，右侧区域参数清空，左侧区域列表同步移除，"预览效果"按钮禁用 |
| **重新框选** | 当前矩形消失，鼠标进入框选模式，提示"请在图片上重新拖拽处理区域" |

### 3.3 实现方案

#### 在右侧参数区添加按钮

```typescript
// src/screens/TemplateBuilderScreen.tsx

// 在"区域设置"卡片中添加
<div className="mb-3 flex items-center justify-between">
  <span className="text-sm font-medium text-ink">区域设置</span>
  <div className="flex gap-2">
    <button
      className="rounded-xl border border-line bg-surface px-3 py-2 text-xs font-medium"
      type="button"
      onClick={onResetRegion}
    >
      重置区域
    </button>
    <button
      className="rounded-xl border border-line bg-surface px-3 py-2 text-xs font-medium"
      type="button"
      onClick={onClearRegion}
    >
      清除选区
    </button>
  </div>
</div>
```

#### 在 workspace.ts 中添加清除选区函数

```typescript
// src/store/workspace.ts

clearRegion: () =>
  set({
    region: { x: 0, y: 0, width: 0, height: 0 },
    isTemplateDirty: true,
    preview: null,
  }),
```

---

## 四、问题 3：重置当前区域设置

### 4.1 问题描述

用户修改了定位方式、处理方式等参数后，想要恢复默认值。

### 4.2 补充稿规范

#### 位置
"处理方式"卡片底部，或"区域设置"卡片底部。

#### 按钮文案
**重置当前区域设置**

#### 作用范围
只重置当前区域的参数，不删除当前区域框：
- 定位方式
- 处理方式
- 质量参数
- 模糊参数 / 填充参数等

#### 重置后的默认值
- 定位方式：右下角锚定
- 处理方式：AI 修复（LaMa）
- AI 修复质量：平衡

#### 点击后交互
提示：*当前区域设置已恢复默认*

### 4.3 实现方案

这个功能当前已经有 `resetRegionFromImage`，但需要改为"恢复默认参数"而不是"根据图片计算区域"。

```typescript
// src/store/workspace.ts

resetRegionSettings: () =>
  set((state) => ({
    cleanupMethod: state.appSettings.defaultCleanupMethod,
    sizeHandlingMode: state.appSettings.defaultSizeHandlingMode,
    blurSigma: 10,
    fillColor: "#f7f9fc",
    isTemplateDirty: true,
    notification: { kind: "info", message: "当前区域设置已恢复默认" },
  })),
```

---

## 五、问题 4：离开页面确认

### 5.1 问题描述

用户在构建页点击返回首页时，如果有未保存内容，应该弹出确认框。

### 5.2 补充稿规范

#### 判断条件
只要满足以下任一条件，都弹确认框：
- 已导入图片
- 已框选区域
- 参数已改动
- 模板未保存

#### 弹窗文案

```
标题：离开当前任务？

说明：当前任务还有未保存内容。你可以继续编辑，或清空后返回首页。

按钮：
- 继续编辑
- 清空并返回首页
```

### 5.3 实现方案

#### 在 SidebarNav 中拦截导航

```typescript
// src/components/layout/SidebarNav.tsx

interface SidebarNavProps {
  currentScreen: AppScreen;
  onNavigate: (screen: AppScreen) => void;
  // 新增
  hasUnsavedWork: boolean;
  onNavigateWithConfirm: (screen: AppScreen) => void;
}

export function SidebarNav({ currentScreen, onNavigate, hasUnsavedWork, onNavigateWithConfirm }: SidebarNavProps) {
  const handleNavClick = (screen: AppScreen) => {
    if (currentScreen === "builder" && screen === "home" && hasUnsavedWork) {
      onNavigateWithConfirm(screen);
    } else {
      onNavigate(screen);
    }
  };

  return (
    <nav className="mt-6 space-y-2">
      {NAV_ITEMS.map((item) => (
        <button
          key={item.id}
          onClick={() => handleNavClick(item.id)}
        >
          ...
        </button>
      ))}
    </nav>
  );
}
```

#### 在 App.tsx 中实现确认逻辑

```typescript
// src/App.tsx

const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
const [pendingNavigation, setPendingNavigation] = useState<AppScreen | null>(null);

// 判断是否有未保存内容
const hasUnsavedWork =
  importedImages.length > 0 ||
  isTemplateDirty ||
  (region.width > 0 && region.height > 0);

function handleNavigateWithConfirm(screen: AppScreen) {
  setPendingNavigation(screen);
  setShowLeaveConfirm(true);
}

function handleConfirmLeave() {
  setShowLeaveConfirm(false);
  clearWorkspace();
  setCurrentScreen(pendingNavigation!);
  setPendingNavigation(null);
}

// 确认对话框 JSX
{showLeaveConfirm && (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
    <div className="rounded-2xl bg-white p-6 shadow-ambient max-w-md w-full mx-4">
      <h3 className="text-lg font-semibold text-ink">离开当前任务？</h3>
      <p className="mt-2 text-sm text-muted">
        当前任务还有未保存内容。你可以继续编辑，或清空后返回首页。
      </p>
      <div className="mt-6 flex justify-end gap-3">
        <button
          className="rounded-xl border border-line bg-white px-4 py-2 text-sm font-medium"
          type="button"
          onClick={() => setShowLeaveConfirm(false)}
        >
          继续编辑
        </button>
        <button
          className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-white"
          type="button"
          onClick={handleConfirmLeave}
        >
          清空并返回首页
        </button>
      </div>
    </div>
  </div>
)}
```

---

## 六、问题 5：模板替换确认

### 6.1 问题描述

当前已经有图片和编辑内容，用户点击"应用已有模板"时，直接覆盖或直接打开文件选择框，用户体验不佳。

### 6.2 当前实现

```typescript
// src/App.tsx

async function handleUseTemplate(templateId: string) {
  applyTemplate(templateId);           // 直接应用
  setPendingImportDestination("preview");
  await importWithDialog("files");     // 直接打开文件选择框
}
```

### 6.3 补充稿规范

#### 场景
当前已经有图片和编辑内容，用户又点击"应用已有模板"。

#### 正确交互
弹出选择框，而不是直接覆盖：

```
标题：应用新模板到当前任务？

说明：你可以将新模板应用到当前已导入图片，也可以清空当前任务后重新开始。

按钮：
- 应用到当前图片
- 清空任务后应用
- 取消
```

#### 三种结果

| 选择 | 结果 |
|------|------|
| **应用到当前图片** | 保留当前导入图片，替换当前模板参数，清空已有预览结果，提示"已应用新模板，请重新预览效果" |
| **清空任务后应用** | 清空当前任务，加载新模板，跳到模板构建页空图状态或导入流程 |
| **取消** | 不做任何变更 |

### 6.4 实现方案

```typescript
// src/App.tsx

const [showTemplateReplaceConfirm, setShowTemplateReplaceConfirm] = useState(false);
const [pendingTemplateId, setPendingTemplateId] = useState<string | null>(null);

async function handleUseTemplate(templateId: string) {
  // 如果当前没有图片或编辑内容，直接应用
  if (importedImages.length === 0 && !isTemplateDirty) {
    applyTemplate(templateId);
    setCurrentScreen("builder");
    setNotification({
      kind: "success",
      message: "模板已应用，请导入图片开始处理"
    });
    return;
  }

  // 有内容时，显示确认对话框
  setPendingTemplateId(templateId);
  setShowTemplateReplaceConfirm(true);
}

function handleApplyToCurrentImages() {
  if (!pendingTemplateId) return;

  applyTemplate(pendingTemplateId);
  setShowTemplateReplaceConfirm(false);
  setPendingTemplateId(null);

  setPreview(null);  // 清空预览

  if (importedImages.length > 0) {
    setCurrentScreen("preview");
    setAutoPreviewOnEnter(true);
  }

  setNotification({
    kind: "success",
    message: "已应用新模板，请重新预览效果"
  });
}

function handleApplyWithClear() {
  if (!pendingTemplateId) return;

  clearWorkspace();  // 先清空
  applyTemplate(pendingTemplateId);

  setShowTemplateReplaceConfirm(false);
  setPendingTemplateId(null);
  setCurrentScreen("builder");

  setNotification({
    kind: "info",
    message: "模板已应用，请导入图片开始处理"
  });
}

// 确认对话框 JSX
{showTemplateReplaceConfirm && (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
    <div className="rounded-2xl bg-white p-6 shadow-ambient max-w-md w-full mx-4">
      <h3 className="text-lg font-semibold text-ink">应用新模板到当前任务？</h3>
      <p className="mt-2 text-sm text-muted">
        你可以将新模板应用到当前已导入图片，也可以清空当前任务后重新开始。
      </p>
      <div className="mt-6 flex flex-col gap-3">
        <button
          className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-medium text-white"
          type="button"
          onClick={handleApplyToCurrentImages}
        >
          应用到当前图片
        </button>
        <button
          className="w-full rounded-xl border border-line bg-white px-4 py-3 text-sm font-medium"
          type="button"
          onClick={handleApplyWithClear}
        >
          清空任务后应用
        </button>
        <button
          className="w-full rounded-xl border border-line bg-white px-4 py-3 text-sm font-medium text-muted"
          type="button"
          onClick={() => {
            setShowTemplateReplaceConfirm(false);
            setPendingTemplateId(null);
          }}
        >
          取消
        </button>
      </div>
    </div>
  </div>
)}
```

---

## 七、问题 6：取消批量任务

### 7.1 问题描述

批量处理进行中，用户想要中止时，没有取消入口。

### 7.2 补充稿规范

#### 按钮文案
**取消任务**

#### 点击后弹窗

```
标题：取消当前批量任务？

说明：取消后，未处理的图片将停止执行，已完成的结果会保留。

按钮：
- 继续处理
- 取消任务
```

#### 执行结果
- 终止当前未完成任务
- 已完成结果保留
- 页面进入"已取消"状态

### 7.3 实现方案

这个需要在 BatchScreen 中添加取消按钮，并调用后端的中止接口。

```typescript
// src/screens/BatchScreen.tsx

{isBatchRunning && (
  <button
    className="rounded-xl border border-line bg-white px-4 py-2 text-sm font-medium"
    type="button"
    onClick={onCancelBatch}
  >
    取消任务
  </button>
)}
```

---

## 八、其他补充交互

### 8.1 放弃当前预览（预览页）

#### 按钮文案
**放弃当前预览**

#### 作用范围
只清除当前 preview 结果，不清除导入图片、选区、参数、模板内容。

#### 结果
- 清空 preview 结果
- 返回模板构建页
- 保留当前编辑状态

### 8.2 返回调整（预览页）

#### 按钮文案
**返回调整**

#### 结果
- 回到模板构建页
- 保留所有选区和参数
- 不清除模板内容

### 8.3 移除单张图片（构建页左侧）

#### 按钮文案
**移除图片**

#### 作用范围
只移除当前图片，不影响其他图片和模板设置。

#### 特殊规则
- 如果移除的是当前样图，自动切换到下一张
- 若当前已无图片，弹出提示并回到首页
- 最后只剩 1 张时移除，弹确认："当前任务将没有图片，是否移除并返回首页？"

---

## 九、统一规范总结

### 清除 / 撤销 / 替换交互规范

| 操作 | 作用范围 | 结果 |
|------|----------|------|
| **清除当前选区** | 当前选中的区域 | 删除选区及其参数，不影响图片和任务 |
| **重新框选** | 当前选中的区域 | 保留当前区域上下文，重新进入拖拽框选状态 |
| **重置当前区域设置** | 当前区域参数 | 恢复默认定位方式和处理方式，不删除选区 |
| **清空当前任务** | 当前任务全部内容 | 清空导入图片、当前编辑状态、预览结果，并返回首页 |
| **模板替换** | 当前任务 + 新模板 | 必须弹出确认框：应用到当前图片 / 清空任务后应用 / 取消 |
| **取消批量任务** | 当前批量执行过程 | 停止未完成任务，保留已完成结果 |

---

## 十、实施检查清单

### P0 - 最必须的 6 个入口

- [ ] **模板构建页：清空当前任务** — 左侧添加按钮，带确认弹窗
- [ ] **模板构建页：清除选区** — 右侧参数区添加按钮
- [ ] **模板构建页：重置当前区域设置** — 右侧参数区添加按钮（已有"重置区域"，需改为恢复默认参数）
- [ ] **模板构建页：离开页面确认** — 导航拦截 + 确认弹窗
- [ ] **模板切换时：替换确认** — handleUseTemplate 改造 + 三选一弹窗
- [ ] **批量执行页：取消任务** — 添加取消按钮 + 确认弹窗

### P1 - 其他补充交互

- [ ] **预览页：放弃当前预览** — 返回构建页但保留编辑状态
- [ ] **预览页：返回调整** — 返回构建页
- [ ] **构建页：移除单张图片** — 图片列表项添加移除按钮
- [ ] **首页：从构建页返回首页的确认** — 与"离开页面确认"合并处理

---

## 十一、相关代码位置

| 文件 | 相关代码/需要修改 | 行号参考 |
|------|------------------|----------|
| `src/store/workspace.ts` | `clearWorkspace` 函数 | 322-336 |
| `src/store/workspace.ts` | `applyTemplate` 函数 | 400-433 |
| `src/store/workspace.ts` | 需新增 `clearRegion` 函数 | - |
| `src/store/workspace.ts` | 需新增 `resetRegionSettings` 函数 | - |
| `src/App.tsx` | `handleUseTemplate` 函数 | 1016-1020 |
| `src/App.tsx` | 需新增确认对话框状态和逻辑 | - |
| `src/screens/TemplateBuilderScreen.tsx` | 需新增清空/清除/重置按钮 | - |
| `src/screens/TemplateBuilderScreen.tsx` | 需新增 props | - |
| `src/components/layout/SidebarNav.tsx` | 需新增导航拦截逻辑 | - |
| `src/screens/BatchScreen.tsx` | 需新增取消按钮 | - |

---

## 十二、总结

| 问题类别 | 数量 | 预计工作量 |
|----------|------|------------|
| **P0 必须补充** | 6 个入口 | 2-3 小时 |
| **P1 其他补充** | 4 个入口 | 1-2 小时 |
| **总计** | 10 个入口 | 3-5 小时 |

**关键实施顺序**：
1. 先实现 6 个 P0 入口，保证核心流程完整
2. 再实现 4 个 P1 入口，完善用户体验
