# Batch Image Studio MVP Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the first runnable desktop MVP for Batch Image Studio: import images, define detection regions, preview cleanup, run batch jobs, and export results locally.

**Architecture:** Use a Tauri desktop shell with a React + TypeScript + Vite frontend and a Rust service layer in `src-tauri/`. Keep image processing behind a backend command boundary so detection and cleanup engines can evolve independently from the UI.

**Tech Stack:** Tauri 2, React, TypeScript, Vite, Tailwind CSS, Zustand, Rust, `image` crate, `tauri-plugin-store`, Vitest, Playwright, Rust unit tests.

---

## Current Repository State
- Product scope exists in `PRD.md`.
- Visual direction exists in `stitch/blueprint_precision/DESIGN.md`.
- UI prototypes exist in `stitch/p00` to `stitch/p10`.
- No app scaffold, package manager config, Rust code, or test setup is checked in yet.

## Target Project Layout
- `src/`: React app, routes, state, shared UI components.
- `src/features/import/`: file intake, grouping, thumbnail state.
- `src/features/detection/`: region editing, detection mode settings.
- `src/features/preview/`: sample comparison, before/after preview.
- `src/features/jobs/`: queue progress, logs, retry handling.
- `src/features/templates/`: save/apply template flows.
- `src-tauri/src/`: native commands, image processing pipeline, persistence.
- `tests/e2e/`: desktop smoke tests.
- `docs/plans/`: implementation plans and execution notes.

## Milestone 1: Scaffold the Desktop App
**Files:**
- Create: `package.json`, `vite.config.ts`, `tailwind.config.ts`, `src/main.tsx`, `src/App.tsx`
- Create: `src-tauri/Cargo.toml`, `src-tauri/src/main.rs`, `src-tauri/src/lib.rs`

**Deliverables:**
- Tauri app boots locally.
- Tailwind tokens mirror `DESIGN.md`.
- Basic 3-column shell matches the stitched prototype style.

**Acceptance:**
- `npm install`
- `npm run tauri dev`
- Window launches with placeholder navigation and panel layout.

## Milestone 2: Rebuild Core UI From Prototypes
**Files:**
- Create: `src/components/layout/*`
- Create: `src/features/workspace/*`
- Reference: `stitch/p01/code.html` to `stitch/p10/code.html`

**Deliverables:**
- Import workspace, detection panel, preview page, batch status page, settings page.
- Shared tokens for spacing, colors, radius, typography.

**Acceptance:**
- Every stitched page has a mapped React screen or reusable section.
- No inline one-off styles unless required by prototype parity.

## Milestone 3: Implement Import and Local Task Model
**Files:**
- Create: `src/features/import/store.ts`
- Create: `src/features/import/components/*`
- Create: `src-tauri/src/commands/files.rs`
- Create: `src-tauri/src/domain/task.rs`

**Deliverables:**
- Import images or folders.
- Filter unsupported formats.
- Generate thumbnail metadata, dimensions, and grouping.

**Acceptance:**
- Sample folder import works.
- Corrupt files are marked without crashing the task list.

## Milestone 4: Ship Detection and Region Editing v1
**Files:**
- Create: `src/features/detection/*`
- Create: `src-tauri/src/commands/detection.rs`
- Create: `src-tauri/src/engines/detection/mod.rs`

**Deliverables:**
- Fixed-position mode first.
- Manual add, move, resize, delete region boxes.
- Detection settings persisted per task.

**Acceptance:**
- User can define a reusable region on one sample image and apply it to all imported images.

## Milestone 5: Build Cleanup Preview Pipeline
**Files:**
- Create: `src/features/preview/*`
- Create: `src-tauri/src/commands/cleanup.rs`
- Create: `src-tauri/src/engines/cleanup/mod.rs`

**Deliverables:**
- Support blur, solid fill, and crop in MVP.
- Smart inpaint stays behind a feature flag or placeholder adapter.
- Before/after preview with timing metrics.

**Acceptance:**
- One selected image can render original, detected, and processed states on demand.

## Milestone 6: Batch Jobs, Export, Templates, and History
**Files:**
- Create: `src/features/jobs/*`
- Create: `src/features/templates/*`
- Create: `src-tauri/src/commands/jobs.rs`
- Create: `src-tauri/src/persistence/*`

**Deliverables:**
- Queue processing with success/failure counts.
- Retry failed items only.
- Save template and task history locally.
- Export report JSON or CSV.

**Acceptance:**
- A batch run can complete, pause, resume, and reopen output folder.

## Testing Strategy
- Frontend: Vitest for stores, reducers, and utility functions.
- Native: Rust unit tests for file scanning, region transforms, and cleanup algorithms.
- E2E: Playwright smoke flow for import -> preview -> batch export.
- Minimum merge gate: one unit test for each new store/command and one updated smoke path per milestone.

## Execution Order
1. Scaffold Tauri app and design tokens.
2. Rebuild the prototype shell as React screens.
3. Add import pipeline and local task state.
4. Add fixed-position detection and box editing.
5. Add preview cleanup pipeline.
6. Add batch jobs, persistence, and export.
7. Add tests, packaging, and release automation.
