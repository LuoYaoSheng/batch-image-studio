# Interaction Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Refactor the current single-screen Doubao-focused MVP into a template-first multi-screen desktop workflow aligned with the new UI direction while reusing the existing Tauri preview and batch-processing backend.

**Architecture:** Keep the Rust/Tauri commands, preview pipeline, batch pipeline, and local persistence model intact. Do the frontend refactor in two layers: first introduce a screen-based app shell and reorganize the Zustand state around workflow concepts, then extract dedicated page components and shared UI blocks. Do not block the refactor on perfect Stitch fidelity; treat the new `stitch 2` as a visual target, not a behavioral spec.

**Tech Stack:** React 19, TypeScript, Zustand, Tailwind CSS, Vite, Tauri 2

---

## Scope Decision

This plan intentionally does **not** start with a router dependency migration.

Reason:

1. The app is still a small Tauri desktop shell with one entry point in [`src/main.tsx`](/Users/luoyaosheng/Desktop/project/Other/Batch%20Image%20Studio/src/main.tsx).
2. The current frontend is concentrated in [`src/App.tsx`](/Users/luoyaosheng/Desktop/project/Other/Batch%20Image%20Studio/src/App.tsx).
3. The fastest path is to establish a `screen`-driven shell first, then decide later whether external routing is worth the complexity.

If the screen model stabilizes and page complexity grows, router introduction can be a follow-up task.

---

## Non-Blocking Design Gaps

The latest `stitch 2` still has some semantic drift, but these are **not blockers** for implementation:

* `P00` design system page is missing.
* Some sample content still implies generic image-processing flows instead of local-region template processing.
* `P03` and `P05` still contain a few overly broad “enhancement/workflow” ideas.

Implementation should proceed, but these pages should be built against product docs first and Stitch visuals second.

---

## Phase Order

> Phase naming in this document now matches the analysis doc:
> 
> * `Phase 0` = skeleton and architecture layer
> * `Phase 1` = first-time user core flow
> * `Phase 2` = template reuse flow
> * `Phase 3` = later structural upgrades and polish

### Phase 0: Establish the app shell and workflow screens

**Objective:** Replace the current “all features on one page” layout with a screen-based shell and explicit workflow transitions.

**Files:**

* Modify: [`src/App.tsx`](/Users/luoyaosheng/Desktop/project/Other/Batch%20Image%20Studio/src/App.tsx)
* Modify: [`src/types.ts`](/Users/luoyaosheng/Desktop/project/Other/Batch%20Image%20Studio/src/types.ts)
* Modify: [`src/store/workspace.ts`](/Users/luoyaosheng/Desktop/project/Other/Batch%20Image%20Studio/src/store/workspace.ts)
* Modify: [`src/styles.css`](/Users/luoyaosheng/Desktop/project/Other/Batch%20Image%20Studio/src/styles.css)
* Create: `src/components/layout/AppShell.tsx`
* Create: `src/components/layout/SidebarNav.tsx`
* Create: `src/components/layout/TopBar.tsx`
* Create: `src/screens/HomeScreen.tsx`
* Create: `src/screens/TemplateBuilderScreen.tsx`
* Create: `src/screens/PreviewScreen.tsx`
* Create: `src/screens/BatchScreen.tsx`
* Create: `src/screens/TemplatesScreen.tsx`
* Create: `src/screens/HistoryScreen.tsx`
* Create: `src/screens/SettingsScreen.tsx`

**Implementation steps:**

1. Add a `ScreenId` type and a single source of truth for the active screen.
2. Replace the monolithic current layout with an `AppShell` that renders sidebar, page-specific top bar, and screen content.
3. Keep the initial screen set to `home`.
4. Wire core screen transitions:
   * `home` import success -> `builder`
   * `builder` preview action -> `preview`
   * `preview` start batch -> `batch`
   * `batch` complete -> stay on `batch` with complete state
   * sidebar direct access -> `home/templates/history/settings`
5. Preserve all existing import, preview, batch, template-save, and history-write logic during this move.

**Verification:**

* Run: `npm run build`
* Expected: TypeScript and Vite build succeed.
* Manual: launch `npm run dev` and verify that the shell can switch between all seven screens without broken layout or runtime errors.

---

### Phase 0: Reshape state from “Doubao tool” to “template workflow”

**Objective:** Reorganize frontend state around workflow concepts without breaking the current backend contract.

**Files:**

* Modify: [`src/types.ts`](/Users/luoyaosheng/Desktop/project/Other/Batch%20Image%20Studio/src/types.ts)
* Modify: [`src/store/workspace.ts`](/Users/luoyaosheng/Desktop/project/Other/Batch%20Image%20Studio/src/store/workspace.ts)
* Create: `src/store/selectors.ts`

**Implementation steps:**

1. Add screen/navigation state to the store.
2. Introduce explicit workflow state buckets:
   * import/session state
   * builder state
   * preview state
   * batch state
   * persisted templates/history/settings state
3. Expand `Template` to support:
   * metadata
   * naming
   * positioning mode
   * output settings
4. Keep the persisted storage backward-compatible by migrating old template records on load.
5. Add a “dirty template” flag so the builder screen can show “有未保存更改”.

**Verification:**

* Run: `npm run build`
* Manual:
  * save a template
  * reload app
  * confirm old records still render
  * confirm template dirty state changes when builder values are edited

---

### Phase 1: Implement the Home screen as the new entry point

**Objective:** Make first-use and template-reuse entry points obvious and simple.

**Files:**

* Create: `src/screens/HomeScreen.tsx`
* Create: `src/components/home/ImportDropZone.tsx`
* Create: `src/components/home/RecentTemplateList.tsx`
* Create: `src/components/home/RecentTaskList.tsx`
* Modify: [`src/App.tsx`](/Users/luoyaosheng/Desktop/project/Other/Batch%20Image%20Studio/src/App.tsx)
* Modify: [`src/store/workspace.ts`](/Users/luoyaosheng/Desktop/project/Other/Batch%20Image%20Studio/src/store/workspace.ts)

**Implementation steps:**

1. Move import entry actions out of the current builder page into the new home screen.
2. Keep drag-and-drop support and dialog-based import support.
3. Add three clear entry actions:
   * 导入图片
   * 导入文件夹
   * 应用已有模板
4. Render recent templates and recent tasks using existing persisted data.
5. When there is no recent data, render explicit empty states instead of blank boxes.
6. After successful import, navigate to the builder screen automatically.

**Verification:**

* Run: `npm run build`
* Manual:
  * import files from home
  * import folder from home
  * trigger template-apply path from home
  * verify transition into the builder screen

---

### Phase 1: Build the Template Builder screen around region editing

**Objective:** Turn the current “parameter-heavy tool page” into the core template creation experience.

**Files:**

* Create: `src/components/builder/ImageSampleList.tsx`
* Create: `src/components/builder/RegionList.tsx`
* Create: `src/components/builder/RegionSelector.tsx`
* Create: `src/components/builder/BuilderSidePanel.tsx`
* Create: `src/components/builder/BuilderActionBar.tsx`
* Modify: [`src/App.tsx`](/Users/luoyaosheng/Desktop/project/Other/Batch%20Image%20Studio/src/App.tsx)
* Modify: [`src/store/workspace.ts`](/Users/luoyaosheng/Desktop/project/Other/Batch%20Image%20Studio/src/store/workspace.ts)
* Modify: [`src/types.ts`](/Users/luoyaosheng/Desktop/project/Other/Batch%20Image%20Studio/src/types.ts)

**Implementation steps:**

1. Extract the current preview canvas and editable region logic out of `App.tsx`.
2. Preserve the existing drag-to-move and resize handle behavior.
3. Default the builder to:
   * first imported image selected
   * one region
   * `bottomRight` positioning mode
   * AI repair as primary method
4. Add a visible step guide:
   * Step 1: 框选区域
   * Step 2: 选择处理方式
   * Step 3: 预览与处理
5. Keep advanced output settings present but folded or visually secondary.
6. Implement action states:
   * no region -> preview/save/batch disabled
   * region but no preview -> preview enabled, batch weakened
   * preview complete -> batch highlighted

**Verification:**

* Run: `npm run build`
* Manual:
  * import images
  * move region
  * resize region
  * change positioning mode
  * save template
  * confirm dirty/clean states update correctly

---

### Phase 1: Make Preview a dedicated confirmation screen

**Objective:** Separate “effect confirmation” from “parameter editing”.

**Files:**

* Create: `src/components/preview/ComparisonSlider.tsx`
* Create: `src/components/preview/PreviewSampleList.tsx`
* Create: `src/components/preview/PreviewSummaryCard.tsx`
* Modify: `src/screens/PreviewScreen.tsx`
* Modify: [`src/App.tsx`](/Users/luoyaosheng/Desktop/project/Other/Batch%20Image%20Studio/src/App.tsx)
* Modify: [`src/store/workspace.ts`](/Users/luoyaosheng/Desktop/project/Other/Batch%20Image%20Studio/src/store/workspace.ts)

**Implementation steps:**

1. Reuse existing preview-generation and cache logic.
2. Move preview rendering out of the builder screen and into the dedicated preview screen.
3. Provide:
   * left sample list
   * center before/after comparison
   * visible slider handle
   * right-side template summary
4. Keep actions limited to:
   * 返回调整
   * 重新预览
   * 保存模板
   * 开始批量处理
5. Remove editing controls and non-essential “richness” widgets from this screen.

**Verification:**

* Run: `npm run build`
* Manual:
  * preview one image
  * switch preview sample
  * re-run preview
  * confirm the builder state is preserved when returning

---

### Phase 1: Turn batch progress into a dedicated execution screen

**Objective:** Separate execution monitoring from setup.

**Files:**

* Create: `src/components/batch/BatchStats.tsx`
* Create: `src/components/batch/BatchQueueList.tsx`
* Create: `src/components/batch/BatchLogPanel.tsx`
* Create: `src/components/batch/BatchCompletePanel.tsx`
* Modify: `src/screens/BatchScreen.tsx`
* Modify: [`src/App.tsx`](/Users/luoyaosheng/Desktop/project/Other/Batch%20Image%20Studio/src/App.tsx)

**Implementation steps:**

1. Reuse the current `BatchProgressPanel` logic and failure tracking.
2. Move batch status UI to its own screen.
3. Keep failure visibility high:
   * failed file name
   * clear reason
   * retry-failed action
4. Add complete-state actions:
   * 打开输出目录
   * 仅重试失败项
   * 返回首页
   * 再处理一批

**Verification:**

* Run: `npm run build`
* Manual:
  * execute batch from preview
  * verify progress updates
  * verify complete state
  * retry failed-only path

---

### Phase 2: Implement Templates and History as reusable entry screens

**Objective:** Support the “template first” return path without re-entering full builder flow every time.

**Files:**

* Modify: `src/screens/TemplatesScreen.tsx`
* Modify: `src/screens/HistoryScreen.tsx`
* Create: `src/components/templates/TemplateCard.tsx`
* Create: `src/components/history/HistoryTable.tsx`
* Modify: [`src/store/workspace.ts`](/Users/luoyaosheng/Desktop/project/Other/Batch%20Image%20Studio/src/store/workspace.ts)
* Modify: [`src/types.ts`](/Users/luoyaosheng/Desktop/project/Other/Batch%20Image%20Studio/src/types.ts)

**Implementation steps:**

1. Template Center:
   * render saved templates
   * apply/edit/delete actions
   * keep semantics strictly around local-region processing templates
2. History:
   * render task name, time, template, image count, result summary, output path
   * add reuse entry that reapplies the template and prompts for new import
3. Remove all generic “workflow / filter / enhancement / rename / conversion” sample semantics from these screens.

**Verification:**

* Run: `npm run build`
* Manual:
  * apply template from template center
  * edit template in builder
  * reuse from history
  * open output directory from history

---

### Phase 2: Add a minimal Settings screen for app defaults

**Objective:** Store app-level defaults without polluting the main workflow.

**Files:**

* Modify: `src/screens/SettingsScreen.tsx`
* Modify: [`src/store/workspace.ts`](/Users/luoyaosheng/Desktop/project/Other/Batch%20Image%20Studio/src/store/workspace.ts)
* Modify: [`src/types.ts`](/Users/luoyaosheng/Desktop/project/Other/Batch%20Image%20Studio/src/types.ts)

**Implementation steps:**

1. Add persisted app settings for:
   * default output directory
   * default format
   * default cleanup method
   * default positioning mode
2. Keep model/data settings lightweight:
   * cache status
   * clear cache
   * update check placeholder
3. Do not turn this into a developer console.

**Verification:**

* Run: `npm run build`
* Manual:
  * change defaults
  * reload app
  * confirm settings persist

---

## File Reorganization Target

By the end of the refactor, the frontend should roughly look like this:

```text
src/
  App.tsx
  main.tsx
  styles.css
  types.ts
  store/
    workspace.ts
    selectors.ts
  components/
    layout/
      AppShell.tsx
      SidebarNav.tsx
      TopBar.tsx
    home/
      ImportDropZone.tsx
      RecentTemplateList.tsx
      RecentTaskList.tsx
    builder/
      ImageSampleList.tsx
      RegionList.tsx
      RegionSelector.tsx
      BuilderSidePanel.tsx
      BuilderActionBar.tsx
    preview/
      ComparisonSlider.tsx
      PreviewSampleList.tsx
      PreviewSummaryCard.tsx
    batch/
      BatchStats.tsx
      BatchQueueList.tsx
      BatchLogPanel.tsx
      BatchCompletePanel.tsx
    templates/
      TemplateCard.tsx
    history/
      HistoryTable.tsx
  screens/
    HomeScreen.tsx
    TemplateBuilderScreen.tsx
    PreviewScreen.tsx
    BatchScreen.tsx
    TemplatesScreen.tsx
    HistoryScreen.tsx
    SettingsScreen.tsx
```

---

## Delivery Sequence Recommendation

Recommended execution order:

1. Phase 0 shell
2. Phase 0 state reshape
3. Phase 1 home
4. Phase 1 builder
5. Phase 1 preview
6. Phase 1 batch
7. Phase 2 templates/history
8. Phase 2 settings

This order keeps the app runnable after each milestone and ensures the first usable workflow lands early.

---

## Acceptance Criteria

The redesign can be considered complete when all of the following are true:

* The app no longer opens into the old “Doubao-only single page”.
* Home, builder, preview, batch, templates, history, and settings all exist as distinct screens.
* A user can complete the new first-time flow:
  * import -> builder -> preview -> save template -> batch
* A user can complete the returning flow:
  * choose template -> import -> preview -> batch
* The persisted template/history model survives existing local storage data.
* `npm run build` passes.

---

## Recommendation

Start implementation now.

Do **not** spend another round polishing Stitch before coding. Use the current UI as visual direction, and let product documents and the new shell architecture drive the real behavior.
