# MVP Closure Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Finish a stable, testable Batch Image Studio MVP with a complete user workflow before deeper quality optimization.

**Architecture:** Keep the current Tauri + React split. Use the Rust side for file scanning, preview generation, cleanup, and export; keep the React side responsible for workflow, selection, controls, and status feedback. Freeze advanced detection and PS-grade repair for a later milestone so the current phase focuses on end-to-end usability.

**Tech Stack:** Tauri 2, React, TypeScript, Zustand, Rust, `image`, local browser storage.

---

## Scope For This Phase
- Finish the import -> select region -> preview -> batch export loop.
- Make workflow state obvious and stable.
- Separate “MVP blockers” from “quality optimizations”.
- Do not add OCR or heavy AI repair in this phase.

### Task 1: Workflow Audit And Gap List

**Files:**
- Modify: `docs/plans/2026-03-23-mvp-closure-plan.md`
- Review: `src/App.tsx`
- Review: `src/store/workspace.ts`
- Review: `src-tauri/src/lib.rs`

**Step 1: Verify current MVP path manually**

Run: `npm run tauri:dev`
Expected: app opens and can import images, move region, preview, and export.

**Step 2: Record blockers**

Capture:
- region/render mismatch
- unclear status feedback
- missing drag-resize handles
- weak repair quality

**Step 3: Commit**

```bash
git commit -m "docs: record mvp closure gaps"
```

### Task 2: Make Region Editing Reliable

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/types.ts`

**Step 1: Align rendered box and processed box**

Make one shared image-space mapping function for:
- click-to-place
- drag-to-move
- preview overlay rendering
- final region submission

**Step 2: Add resize handles**

Support:
- right edge
- bottom edge
- bottom-right corner

**Step 3: Add numeric inputs**

Keep sliders, but also expose direct `%` inputs for x/y/width/height.

**Step 4: Verify**

Run: `npm run build`
Expected: PASS

**Step 5: Commit**

```bash
git commit -m "feat: improve region editing precision"
```

### Task 3: Improve Workflow Feedback

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/store/workspace.ts`

**Step 1: Add explicit workflow states**

Examples:
- no images
- images imported
- preview ready
- batch running
- batch complete

**Step 2: Add user-facing summaries**

Show:
- selected file name
- region pixel bounds
- preview generation status
- last batch output path

**Step 3: Add basic error banners**

Avoid silent failures. Surface import, preview, and export errors inline.

**Step 4: Verify**

Run: `npm run build`
Expected: PASS

**Step 5: Commit**

```bash
git commit -m "feat: improve mvp workflow feedback"
```

### Task 4: Stabilize Batch Export

**Files:**
- Modify: `src-tauri/src/lib.rs`
- Modify: `src/App.tsx`

**Step 1: Preserve output naming safely**

Handle duplicate filenames from different folders.

**Step 2: Improve batch result reporting**

Return:
- total processed
- success count
- failed count
- failed file reasons

**Step 3: Add “retry failed only” UI hook**

MVP version can reuse existing batch command with filtered paths.

**Step 4: Verify**

Run:
- `cargo check --manifest-path src-tauri/Cargo.toml`
- `npm run build`

Expected: PASS

**Step 5: Commit**

```bash
git commit -m "feat: stabilize batch export reporting"
```

### Task 5: Improve Cleanup Quality Without Expanding Scope

**Files:**
- Modify: `src-tauri/src/lib.rs`
- Modify: `src/App.tsx`

**Step 1: Keep current lightweight repair path, but expose intent clearly**

Rename UI copy away from “PS-like repair” claims.

**Step 2: Add cleanup presets**

Examples:
- soft watermark
- corner text
- banner strip

Map presets to region feather / blur / blend behavior.

**Step 3: Add before/after comparison option**

Simple toggle or split preview is enough.

**Step 4: Verify**

Run:
- `cargo check --manifest-path src-tauri/Cargo.toml`
- `npm run build`

Expected: PASS

**Step 5: Commit**

```bash
git commit -m "feat: improve cleanup presets and preview comparison"
```

### Task 6: Create A Dedicated Post-MVP Optimization Track

**Files:**
- Create: `docs/plans/2026-03-23-repair-quality-plan.md`

**Step 1: Document deferred items**

Track separately:
- OpenCV inpaint integration
- OCR / auto-detection
- precise mask editing
- drag-and-drop import
- GPU / async preview optimization

**Step 2: Commit**

```bash
git commit -m "docs: split post-mvp optimization track"
```

## Acceptance Checklist
- A new user can import files without guidance.
- The region box can be placed and adjusted precisely enough for real testing.
- Preview generation is understandable and reasonably responsive.
- Batch export completes with usable output and visible status.
- Known quality limitations are documented instead of hidden.

## Recommended Execution Order
1. Task 2: region editing reliability
2. Task 3: workflow feedback
3. Task 4: batch export stability
4. Task 5: cleanup quality within MVP scope
5. Task 6: defer advanced work cleanly
