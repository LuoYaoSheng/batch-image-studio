# 导入撤销与模板切换问题分析

> **文档目的**：分析当前实现中"导入图片后撤销"和"切换模板"两个问题的根本原因，并提供解决方案
> **创建时间**：2026-03-26
> **关联文件**：src/App.tsx, src/store/workspace.ts, src/screens/HomeScreen.tsx

---

## 一、问题 1：导入图片后撤销

### 1.1 问题描述

用户导入图片后自动进入 `builder` 页面，但如果想要撤销/清空导入的图片，没有明显的 UI 入口。

### 1.2 当前实现分析

#### 状态管理层面

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

#### UI 层面

`src/screens/TemplateBuilderScreen.tsx` 中：

- 左侧有样图列表
- 中间有预览画布
- 右侧有参数面板
- **缺少**：清空/撤销操作的 UI 入口

### 1.3 用户期望

| 场景 | 用户期望 |
|------|----------|
| 导入图片后发现不是想要的 | 能一键清空，重新开始 |
| 想换一批图片处理 | 能清空当前任务，重新导入 |
| 想回到首页选择已有模板 | 能返回首页而不保留当前状态 |

### 1.4 建议解决方案

#### 方案 A：在 TemplateBuilderScreen 添加"清空"按钮（推荐）

在左侧样图列表上方添加清空按钮：

```typescript
// src/screens/TemplateBuilderScreen.tsx

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

对应的 props 和处理：

```typescript
// 新增 prop
onClearWorkspace: () => void;

// App.tsx 中的调用
<TemplateBuilderScreen
  // ... 其他 props
  onClearWorkspace={() => {
    clearWorkspace();
    setCurrentScreen("home");
  }}
/>
```

#### 方案 B：在顶部栏添加"清空"按钮

在 `AppShell` 的 `TopBar` 中根据当前页面动态添加操作按钮：

```typescript
// src/components/layout/TopBar.tsx

{currentScreen === "builder" && importedImages.length > 0 && (
  <button
    className="rounded-2xl border border-line bg-white px-4 py-2 text-sm font-medium"
    type="button"
    onClick={onClearWorkspace}
  >
    清空任务
  </button>
)}
```

#### 方案 C：支持页面切换时的智能清理

当用户从 builder 页面切换到首页时，如果当前有未保存的工作，弹出确认对话框：

```typescript
// src/App.tsx

function handleNavigateTo(screen: AppScreen) {
  if (currentScreen === "builder" && screen === "home") {
    if (importedImages.length > 0 && isTemplateDirty) {
      // 显示确认对话框
      // - 保留当前工作
      // - 清空并返回首页
      return;
    }
  }
  setCurrentScreen(screen);
}
```

### 1.5 推荐实施顺序

1. **第一步**：在 TemplateBuilderScreen 左侧添加"清空当前任务"按钮（方案 A）
2. **第二步**：在 TopBar 添加全局"清空"按钮（方案 B）
3. **第三步**：添加页面切换时的智能确认（方案 C，可选）

---

## 二、问题 2：切换模板

### 2.1 问题描述

当用户点击"应用已有模板"时，直接弹出文件选择对话框，用户体验不够流畅。

### 2.2 当前实现分析

#### 首页/模板中心的调用链

```typescript
// src/App.tsx

async function handleUseTemplate(templateId: string) {
  applyTemplate(templateId);           // 1. 应用模板参数
  setPendingImportDestination("preview"); // 2. 设置目标为 preview
  await importWithDialog("files");     // 3. 直接打开文件选择框
}
```

#### HomeScreen 中的按钮

```typescript
// src/screens/HomeScreen.tsx

<button onClick={() => onUseTemplate(template.id)}>
  {template.name}
</button>
```

#### TemplatesScreen 中的按钮

```typescript
// src/screens/TemplatesScreen.tsx（推测）

<button onClick={() => onApply(template.id)}>
  应用
</button>
```

### 2.3 问题分析

| 问题 | 说明 |
|------|------|
| **直接弹出文件选择框** | 用户可能期望先看到模板参数 |
| **取消文件选择后状态不一致** | 模板参数已应用但没有图片 |
| **缺少流程提示** | 用户不知道下一步该做什么 |
| **目标页面固定为 preview** | 应该根据是否有图片动态决定 |

### 2.4 用户期望流程

#### 期望流程 A：先查看参数，再导入图片

```
1. 点击"应用已有模板"
   ↓
2. 应用模板参数，跳转到 builder 页面
   ↓
3. 用户查看/调整参数
   ↓
4. 用户点击"导入图片"或"导入文件夹"
   ↓
5. 跳转到 preview 页面确认效果
```

#### 期望流程 B：应用模板 + 选择导入方式

```
1. 点击"应用已有模板"
   ↓
2. 应用模板参数，显示选择对话框
   - 导入新图片
   - 使用当前导入的图片（如果有）
   ↓
3. 根据选择跳转到对应页面
```

### 2.5 建议解决方案

#### 方案 A：应用模板后跳转到 builder 页面（推荐）

```typescript
// src/App.tsx

async function handleUseTemplate(templateId: string) {
  applyTemplate(templateId);
  setCurrentScreen("builder");
  setNotification({
    kind: "success",
    message: "模板已应用，现在可以导入图片或调整参数"
  });
}

// 编辑模板保持原有行为
function handleEditTemplate(templateId: string) {
  applyTemplate(templateId);
  setCurrentScreen("builder");
}
```

**优点**：
- 流程清晰，用户可以先查看参数
- 符合"模板优先"的设计理念
- 给用户更多控制权

#### 方案 B：应用模板后智能跳转

```typescript
// src/App.tsx

async function handleUseTemplate(templateId: string) {
  applyTemplate(templateId);

  // 如果已有图片，直接去 preview
  if (importedImages.length > 0) {
    setCurrentScreen("preview");
    setAutoPreviewOnEnter(true);
    setNotification({
      kind: "success",
      message: "模板已应用，正在生成预览..."
    });
  } else {
    // 没有图片，去 builder 页面
    setCurrentScreen("builder");
    setNotification({
      kind: "info",
      message: "模板已应用，请导入图片开始处理"
    });
  }
}
```

**优点**：
- 根据当前状态智能决策
- 已有图片时可以快速预览
- 没有图片时引导用户导入

#### 方案 C：应用模板后显示操作选择

```typescript
// src/App.tsx

async function handleUseTemplate(templateId: string) {
  applyTemplate(templateId);

  // 显示操作选择对话框
  // - 导入新图片 → 打开文件选择框
  // - 使用当前图片 → 跳转到 preview
  // - 查看参数 → 跳转到 builder
}
```

**优点**：
- 给用户最多选择
- 灵活性最高

**缺点**：
- 需要额外的对话框组件
- 增加一次交互步骤

### 2.6 模板应用后的状态一致性

无论采用哪种方案，都需要确保状态一致性：

```typescript
// 确保模板应用后状态正确
applyTemplate: (id) => {
  const template = get().templates.find((item) => item.id === id);
  if (!template) return;

  // 更新模板使用时间
  const now = new Date().toISOString();
  const nextTemplates = get().templates.map((item) =>
    item.id === id ? { ...item, lastUsedAt: now } : item
  );
  saveArray(TEMPLATES_KEY, nextTemplates);

  // 应用模板参数
  set((state) => ({
    templates: nextTemplates,
    currentTemplateId: template.id,
    currentTemplateName: template.name,
    region: template.region,
    cleanupMethod: template.cleanupMethod,
    sizeHandlingMode: template.sizeHandlingMode,
    blurSigma: template.blurSigma ?? 10,
    fillColor: template.fillColor ?? "#f7f9fc",
    isTemplateDirty: false,  // 应用模板后不是 dirty 状态
    preview: null,           // 清空预览
    navigation: {
      ...state.navigation,
      builderMode: "edit",   // 进入编辑模式
    },
  }));
}
```

### 2.7 推荐实施顺序

1. **第一步**：采用方案 A（应用模板后跳转到 builder 页面）
2. **第二步**：添加成功通知，告知用户下一步操作
3. **第三步**：在 builder 页面添加"快速导入"按钮
4. **第四步**：（可选）实现方案 B 的智能跳转逻辑

---

## 三、相关代码位置

| 文件 | 相关代码 | 行号参考 |
|------|----------|----------|
| `src/store/workspace.ts` | `clearWorkspace` 函数 | 322-336 |
| `src/store/workspace.ts` | `applyTemplate` 函数 | 400-433 |
| `src/App.tsx` | `handleUseTemplate` 函数 | 1016-1020 |
| `src/App.tsx` | `handleEditTemplate` 函数 | 1022-1025 |
| `src/screens/HomeScreen.tsx` | `onUseTemplate` 调用 | 86 |
| `src/screens/TemplateBuilderScreen.tsx` | 组件结构 | 64-285 |

---

## 四、实施检查清单

### 问题 1：导入撤销

- [ ] 在 `TemplateBuilderScreen` 添加 `onClearWorkspace` prop
- [ ] 在左侧样图列表上方添加"清空当前任务"按钮
- [ ] 在 `App.tsx` 中实现清空后跳转到首页的逻辑
- [ ] 添加清空前的确认提示（可选）
- [ ] 测试：导入图片 → 清空 → 验证状态已重置

### 问题 2：切换模板

- [ ] 修改 `handleUseTemplate` 函数
- [ ] 移除直接打开文件选择框的逻辑
- [ ] 添加跳转到 builder 页面的逻辑
- [ ] 添加成功通知
- [ ] 测试：应用模板 → 验证参数已正确应用
- [ ] 测试：应用模板 → 导入图片 → 验证预览正确

---

## 五、UI 流程图对比

### 当前流程 vs 建议流程

#### 导入撤销流程

```
当前：
导入图片 → builder 页面 → [无撤销入口] → 用户困惑

建议：
导入图片 → builder 页面 → 点击"清空当前任务" → 回到首页 → 状态重置
```

#### 模板切换流程

```
当前：
点击应用模板 → 直接弹出文件选择框 → 用户困惑/取消后状态不一致

建议 A：
点击应用模板 → 应用参数 → 跳转 builder 页 → 通知提示 → 用户选择导入

建议 B：
点击应用模板 → 应用参数 →
  ├─ 有图片？ → 跳转 preview 页 → 生成预览
  └─ 无图片？ → 跳转 builder 页 → 提示导入
```

---

## 六、向后兼容性

### 现有功能不受影响

- `clearWorkspace` 函数已存在，只需添加 UI 入口
- `applyTemplate` 函数已存在，只需修改调用逻辑
- 不涉及后端接口变更
- 不涉及数据结构变更

### 状态迁移

无需迁移，所有改动都是前端行为优化。

---

## 七、总结

| 问题 | 根本原因 | 推荐解决方案 | 预计工作量 |
|------|----------|--------------|------------|
| **导入撤销** | 缺少 UI 入口 | 在 builder 页面添加"清空"按钮 | 30分钟 |
| **模板切换** | 流程跳过 builder 页面 | 应用模板后跳转到 builder 页面 | 15分钟 |

**总计预计工作量：45分钟**
