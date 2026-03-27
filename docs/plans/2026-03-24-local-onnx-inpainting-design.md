# Local ONNX Inpainting Redesign

**Goal:** Replace the current heuristic watermark cleanup engine with a bundled local model runtime that ships inside the desktop app. The user installs one app and processes images fully offline.

## Why Change
- `Telea + heuristic mask` is not stable enough for Doubao text watermark removal.
- The app requirement is privacy-first local processing, not cloud inference.
- The user should not install Python, model runtimes, or extra dependencies.

## Target Architecture
- Keep the current `Tauri + React + Rust` shell and batch workflow.
- Add a native runtime layer in `src-tauri/src/model_runtime.rs`.
- Bundle model files under `resources/models/` and ship them with Tauri resources.
- Resolve the bundled model path from `app.path().resource_dir()` at runtime.
- Route cleanup through an engine abstraction:
  - `legacy-heuristic`: current fallback path
  - `embedded-onnx`: target production path

## Model Packaging
- Version models by folder, for example `resources/models/doubao-lama-v1/`.
- Keep a small manifest beside the model, for example `manifest.json`, with:
  - model name
  - model file name
  - input size
  - supported watermark profile
- Do not commit large binaries to git by default. Keep the directory structure and README in repo; add real model files only when release packaging is ready.

## Runtime Flow
1. Frontend requests preview or batch cleanup.
2. Backend resolves the active cleanup engine.
3. If an embedded model is available, generate the Doubao region mask and run local inference.
4. If the model is missing or fails, return a clear error and optionally fall back to heuristic cleanup in dev builds only.

## Delivery Phases
1. Add bundled-resource scaffolding and runtime status reporting.
2. Add engine abstraction and isolate current heuristic cleanup behind it.
3. Integrate ONNX Runtime and a bundled inpainting model.
4. Tune Doubao-specific preprocessing, batch performance, and release packaging on macOS, Windows, and Linux.
