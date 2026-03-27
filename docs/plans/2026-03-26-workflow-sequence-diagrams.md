# Workflow Sequence Diagrams

**Goal:** Use explicit sequence diagrams to govern workflow changes before more UI/logic tweaks are made.

**Rule:** When a workflow bug is found, update the relevant sequence first, then update code and tests.

---

## Why This Matters

The current project is no longer blocked on page skeletons. The main risk now is **workflow drift**:

* a button exists but leads to the wrong page
* a destructive action clears too much or too little state
* a template switch behaves differently depending on where it is triggered
* import actions mix up “replace current task” and “append to current task”
* preview/batch actions are enabled in states where they should not be

These are all **sequence problems**, not just component problems.

---

## Core Entities

Use these mental entities consistently when discussing flows:

* `User`
* `HomeScreen`
* `BuilderScreen`
* `PreviewScreen`
* `BatchScreen`
* `TemplatesScreen`
* `HistoryScreen`
* `WorkspaceStore`
* `TauriRuntime`

---

## Global Invariants

These invariants should remain true across all flows:

1. `builder` is the canonical place to inspect or change template parameters.
2. `preview` is only for effect confirmation, not heavy editing.
3. `batch` is only for execution monitoring and post-run actions.
4. Destructive actions must explicitly state what will be cleared.
5. When a task is cleared, the app returns to `home`.
6. Applying a template must not silently create inconsistent state.
7. Any action unavailable in browser preview must fail with a clear notification, not silent no-op or crash.

---

## Flow 1: First-Time User Main Flow

```mermaid
sequenceDiagram
    actor U as User
    participant H as HomeScreen
    participant S as WorkspaceStore
    participant B as BuilderScreen
    participant P as PreviewScreen
    participant T as TauriRuntime
    participant X as BatchScreen

    U->>H: Click "导入图片" / "导入文件夹"
    H->>S: startNewTemplateSession()
    H->>T: open import dialog
    T-->>S: importedImages
    S-->>B: currentScreen = builder

    U->>B: Adjust region / method / positioning
    B->>S: updateRegion / setCleanupMethod / setSizeHandlingMode
    U->>B: Click "预览效果"
    B->>T: start preview task
    T-->>S: preview result
    S-->>P: currentScreen = preview

    U->>P: Confirm effect
    U->>P: Click "保存模板"
    P->>S: saveTemplate()
    U->>P: Click "开始批量处理"
    P->>T: start batch task
    T-->>S: batch progress/result
    S-->>X: currentScreen = batch
```

### Current Expected UX

* This flow should be the cleanest path.
* No confirmation dialog is needed unless the user tries to leave with unsaved work.

---

## Flow 2: Template-First Reuse Flow

```mermaid
sequenceDiagram
    actor U as User
    participant H as HomeScreen
    participant TS as TemplatesScreen
    participant S as WorkspaceStore
    participant B as BuilderScreen

    U->>H: Click recent template OR open template center
    H->>TS: navigate templates
    U->>TS: Click "应用模板"
    TS->>S: applyTemplate(templateId)
    S-->>B: currentScreen = builder
    B-->>U: Show applied template parameters
    U->>B: Import new images OR adjust params first
```

### Current Decision

This is the preferred default behavior for template application.

**Do not** jump straight into a file picker as the primary path.

---

## Flow 3: Switch Template During Active Task

```mermaid
sequenceDiagram
    actor U as User
    participant B as BuilderScreen
    participant TS as TemplatesScreen
    participant S as WorkspaceStore
    participant D as DecisionDialog

    U->>B: Click "切换模板"
    B->>TS: navigate templates
    U->>TS: Click "应用模板"
    TS->>D: open dialog
    D-->>U: 应用到当前图片 / 清空任务后应用 / 取消

    alt 应用到当前图片
        U->>D: Confirm keep current images
        D->>S: applyTemplate(templateId)
        S->>S: clear preview result
        S-->>B: currentScreen = builder
    else 清空任务后应用
        U->>D: Confirm clear current task
        D->>S: clearWorkspace()
        D->>S: applyTemplate(templateId)
        S-->>B: currentScreen = builder
    else 取消
        U->>D: Cancel
        D-->>TS: keep current state
    end
```

### Risk Area

This is currently one of the most fragile workflows because it mixes:

* current imported images
* current preview result
* current template edit state
* navigation to another page

Every future template-application bug should be checked against this sequence first.

---

## Flow 4: Clear Task and Return Home

```mermaid
sequenceDiagram
    actor U as User
    participant B as BuilderScreen
    participant D as DecisionDialog
    participant S as WorkspaceStore
    participant H as HomeScreen

    U->>B: Click "清空当前任务"
    B->>D: open confirm dialog
    D-->>U: 取消 / 清空并返回首页

    alt 清空并返回首页
        U->>D: Confirm
        D->>S: clearWorkspace()
        S-->>H: currentScreen = home
    else 取消
        U->>D: Cancel
        D-->>B: keep current task
    end
```

### Invariant

This action must clear:

* imported images
* preview result
* current unsaved edit state
* current task context

It should **not** delete saved templates or history.

---

## Flow 5: Leave Builder via Sidebar/Home

```mermaid
sequenceDiagram
    actor U as User
    participant Nav as SidebarNav
    participant A as App
    participant D as DecisionDialog
    participant S as WorkspaceStore
    participant H as HomeScreen

    U->>Nav: Click "首页"
    Nav->>A: navigateWithGuard(home)

    alt current task has unsaved work
        A->>D: open leave-confirm dialog
        D-->>U: 继续编辑 / 清空并返回首页
        alt 清空并返回首页
            D->>S: clearWorkspace()
            S-->>H: currentScreen = home
        else 继续编辑
            D-->>A: stay on builder
        end
    else no active task
        A->>S: currentScreen = home
    end
```

### Note

This is not the same as “just navigate”.

Navigation from `builder` is a guarded state transition.

---

## Flow 6: Remove Single Image

```mermaid
sequenceDiagram
    actor U as User
    participant B as BuilderScreen
    participant S as WorkspaceStore
    participant D as DecisionDialog
    participant H as HomeScreen

    U->>B: Click "移除" on an image item

    alt more than one image remains
        B->>S: removeImage(imageId)
        S-->>B: select next image if needed
    else last image
        B->>D: open confirm dialog
        D-->>U: 取消 / 移除并返回首页
        alt confirm
            D->>S: clearWorkspace()
            S-->>H: currentScreen = home
        else cancel
            D-->>B: keep image
        end
    end
```

### UX Requirement

Single-image removal must be visibly available in the image list itself, not only through “当前图片” context.

---

## Flow 7: Region Recovery Controls

```mermaid
sequenceDiagram
    actor U as User
    participant B as BuilderScreen
    participant S as WorkspaceStore

    alt Click "清除选区"
        U->>B: Clear current region
        B->>S: clearRegionSelection()
        S-->>B: region hidden, preview invalidated
    else Click "重新框选"
        U->>B: Reset region anchor
        B->>S: resetRegionFromImage(selectedImage)
        S-->>B: region visible again
    else Click "重置当前区域设置"
        U->>B: Reset current region settings
        B->>S: resetCurrentRegionSettings()
        S-->>B: method/positioning params back to defaults
    end
```

### Important Distinction

* `清除选区` = remove active selection
* `重新框选` = create a fresh region again
* `重置当前区域设置` = keep region, reset method/positioning-related settings

These three must never collapse into one ambiguous action.

---

## Flow 8: Discard Preview

```mermaid
sequenceDiagram
    actor U as User
    participant P as PreviewScreen
    participant D as DecisionDialog
    participant S as WorkspaceStore
    participant B as BuilderScreen

    U->>P: Click "放弃当前预览"
    P->>D: open confirm dialog
    D-->>U: 继续查看 / 放弃预览

    alt 放弃预览
        D->>S: clearPreviewState()
        S-->>B: currentScreen = builder
    else 继续查看
        D-->>P: stay in preview
    end
```

### Invariant

Discarding preview clears only:

* preview result
* batch result summary derived from that preview path

It does **not** clear:

* imported images
* region selection
* template parameters

---

## Flow 9: Batch Completion and Follow-Up Actions

```mermaid
sequenceDiagram
    actor U as User
    participant P as PreviewScreen
    participant T as TauriRuntime
    participant S as WorkspaceStore
    participant X as BatchScreen

    U->>P: Click "开始批量处理"
    P->>T: start batch task
    T-->>S: batch progress events
    S-->>X: show progress screen
    T-->>S: batch result
    S-->>X: show result summary

    alt user clicks "打开输出目录"
        X->>T: open_path_in_file_manager(outputDir)
    else user clicks "仅重试失败项"
        X->>T: start batch task with failed entries only
    else user clicks "返回首页"
        X->>S: currentScreen = home
    end
```

---

## Current High-Risk Sequence Gaps

These are the places most likely to produce future bugs:

1. **Import semantics are still mixed**
   - “start new task” vs “append images to current task” are not yet formally separated

2. **Template switching still depends on page-hopping**
   - visible now, but not yet a dedicated in-place switch flow

3. **Preview sample list reuses builder list semantics**
   - currently safe, but the underlying list is still builder-oriented

4. **Batch cancellation/pause semantics are still thin**
   - present conceptually, not yet modeled with the same rigor as task clearing

---

## Recommended Next Fix Order

1. Split import behavior into:
   * `replace_current_task`
   * `append_to_current_task`
2. Move template switching into a more direct current-task flow
3. Separate preview image list behavior from builder image list behavior
4. Formalize batch cancellation / interruption / completion follow-up sequences

---

## Working Rule Going Forward

Before changing workflow code:

1. Identify which sequence this bug belongs to
2. Update the diagram first
3. Update code
4. Update tests

If the bug does not fit any sequence, add a new one before coding.
