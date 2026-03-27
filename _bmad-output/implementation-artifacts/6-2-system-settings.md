# Story 6.2: 系统设置管理

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

作为普通用户，
我想要配置默认输出目录和文件命名规则，
这样我就可以根据自己的习惯设置应用。

## Acceptance Criteria

1. **设置默认输出目录** - 用户可以设置默认输出目录，系统打开文件夹选择对话框，设置保存后批量处理默认使用该目录
2. **设置文件命名规则** - 用户可以选择预设规则或自定义规则，系统显示即时预览，支持的变量包括 {原文件名}、{时间戳}、{序号}
3. **设置页面分组** - 设置按类别分组显示：输出设置、界面设置（预留）、关于
4. **设置持久化** - 设置关闭并重新打开应用后保持用户上次保存的值

## Tasks / Subtasks

- [x] **任务 1: 设置页面分组显示** (AC: 3)
  - [x] 1.1 创建 SettingsScreen 组件，使用分组布局
  - [x] 1.2 实现"基础设置"组（默认处理方式、默认定位方式）
  - [x] 1.3 实现"输出设置"组（默认输出格式、默认输出目录）

- [x] **任务 2: 默认输出目录设置** (AC: 1)
  - [x] 2.1 添加目录选择按钮和输入框
  - [x] 2.2 集成 Tauri dialog API 打开文件夹选择器
  - [x] 2.3 用户选择目录后路径显示在输入框中

- [x] **任务 3: 文件命名规则设置** (AC: 2)
  - [x] 3.1 添加命名规则预设选项（原名_已处理、原名_去除水印、原名_[时间戳]、自定义）
  - [x] 3.2 实现自定义规则输入框，支持变量 {name}、{timestamp}、{index}
  - [x] 3.3 添加即时预览显示转换效果
  - [x] 3.4 添加规则验证，无效时显示错误提示（通过 applyFileNamingRule 的 try-catch 处理）

- [x] **任务 4: 设置持久化** (AC: 4)
  - [x] 4.1 使用 Zustand persist middleware 或 localStorage 存储设置
  - [x] 4.2 应用启动时从存储恢复设置

- [x] **任务 5: 添加文件命名类型到 AppSettings** (技术任务)
  - [x] 5.1 在 types.ts 中添加 FileNamingRule 类型和 applyFileNamingRule 函数
  - [x] 5.2 在 AppSettings 中添加 defaultFileNamingRule 和 customFileNamingPattern 字段
  - [x] 5.3 在 workspace.ts 中更新 DEFAULT_SETTINGS

## Dev Notes

### 现有基础设施（已存在，无需创建）

**SettingsScreen 组件 (`src/screens/SettingsScreen.tsx`):**
- 已实现基础设置分组布局
- 已实现默认输出目录选择
- 已实现默认处理方式、定位方式、输出格式设置

**AppSettings 类型 (`src/types.ts`):**
```typescript
export type AppSettings = {
  defaultOutputDir: string;
  defaultFormat: OutputFormat;
  defaultCleanupMethod: CleanupMethod;
  defaultSizeHandlingMode: SizeHandlingMode;
};
```

**设置持久化 (`src/store/workspace.ts`):**
- `updateAppSettings` 方法已实现
- 使用 `APP_SETTINGS_KEY` 的 `saveObject` / `loadObject` 存储到 localStorage

### 需要实施的功能

**文件命名规则类型定义:**
```typescript
// types.ts
export type FileNamingRule = "name_processed" | "name_cleaned" | "name_timestamp" | "custom";

export type FileNamingCustomRule = {
  pattern: string; // 自定义模式，支持 {name}, {timestamp}, {index}
};
```

**命名规则预设:**
- `name_processed`: "{name}_已处理" (默认)
- `name_cleaned`: "{name}_去除水印"
- `name_timestamp`: "{name}_{timestamp}"
- `custom`: 用户自定义

**即时预览实现:**
```typescript
function previewFileName(originalName: string, rule: FileNamingRule, customPattern?: string): string {
  const ext = originalName.split('.').pop();
  const baseName = originalName.replace(`.${ext}`, '');

  switch (rule) {
    case "name_processed":
      return `${baseName}_已处理.${ext}`;
    case "name_cleaned":
      return `${baseName}_去除水印.${ext}`;
    case "name_timestamp":
      return `${baseName}_${new Date().toISOString().slice(0, 10)}.${ext}`;
    case "custom":
      if (!customPattern) return originalName;
      return customPattern
        .replace("{name}", baseName)
        .replace("{timestamp}", new Date().toISOString().slice(0, 10))
        .replace("{index}", "1")
        + `.${ext}`;
  }
}
```

### 架构合规性

**命名约定:**
- 类型: `PascalCase` → `FileNamingRule`
- 字段: `camelCase` → `defaultFileNamingRule`
- 预设值: `snake_case` 或 `camelCase`

**状态管理:**
- 使用现有的 `useWorkspaceStore`
- 遵循 Zustand 不可变更新模式

**UX 一致性模式:**
- 表单模式：输入框带即时验证和预览
- 保存反馈：成功提示（由 store 统一处理）

### 技术实现细节

**types.ts 更新:**
```typescript
export type FileNamingRule = "name_processed" | "name_cleaned" | "name_timestamp" | "custom";

export type AppSettings = {
  defaultOutputDir: string;
  defaultFormat: OutputFormat;
  defaultCleanupMethod: CleanupMethod;
  defaultSizeHandlingMode: SizeHandlingMode;
  defaultFileNamingRule: FileNamingRule; // 新增
  customFileNamingPattern?: string; // 新增，用于 custom 模式
};
```

**workspace.ts 更新:**
```typescript
const DEFAULT_SETTINGS: AppSettings = {
  defaultOutputDir: "",
  defaultFormat: "png",
  defaultCleanupMethod: "blur",
  defaultSizeHandlingMode: "bottomRight",
  defaultFileNamingRule: "name_processed", // 新增
  customFileNamingPattern: "", // 新增
};
```

**SettingsScreen UI 更新:**
```tsx
// 在"输出设置"组中添加
<label className="block">
  <span className="mb-2 block text-sm font-medium text-ink">文件命名规则</span>
  <select
    className="h-11 w-full rounded-xl border border-line bg-surface px-3"
    value={appSettings.defaultFileNamingRule}
    onChange={(event) =>
      onUpdateSettings({ defaultFileNamingRule: event.target.value as FileNamingRule })
    }
  >
    <option value="name_processed">原名_已处理</option>
    <option value="name_cleaned">原名_去除水印</option>
    <option value="name_timestamp">原名_[时间戳]</option>
    <option value="custom">自定义规则</option>
  </select>
</label>

{appSettings.defaultFileNamingRule === "custom" && (
  <label className="mt-4 block">
    <span className="mb-2 block text-sm font-medium text-ink">自定义模式</span>
    <span className="mb-1 block text-xs text-muted">
      可用变量: {"{原文件名}"}、{"{时间戳}"}、{"{序号}"}
    </span>
    <input
      className="h-11 w-full rounded-xl border border-line bg-surface px-3"
      placeholder="{name}_{timestamp}"
      value={appSettings.customFileNamingPattern || ""}
      onChange={(event) =>
        onUpdateSettings({ customFileNamingPattern: event.target.value })
      }
    />
    <div className="mt-2 text-xs text-muted">
      预览: {previewFileName("image.jpg", appSettings.defaultFileNamingRule, appSettings.customFileNamingPattern)}
    </div>
  </label>
)}
```

### 测试要点

- **手动测试**: 选择每个预设规则，确认命名符合预期
- **手动测试**: 选择自定义规则并输入模式，确认预览正确显示
- **手动测试**: 输入无效变量如 {invalid}，确认预览仍显示变量名
- **手动测试**: 设置保存后重启应用，确认设置保持

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (claude-opus-4-6)

### Debug Log References

### Completion Notes List

### File List

<!-- 此文件由 bmad-create-story 工作流自动生成 -->
<!-- 生成时间: 2026-03-27 -->
