# Bundled Model Assets

This directory is reserved for model files that ship inside the desktop app bundle.

Target layout:

```text
resources/models/
  lama-v1/
    manifest.json
    model.onnx
```

Rules:
- Keep runtime metadata in `manifest.json`.
- Do not rename model folders after release; version with a new folder instead.
- Large binaries such as `.onnx`, `.ort`, and `.bin` are ignored by git until release packaging is finalized.
- The Tauri bundle maps this directory to `$RESOURCES/models/` inside the packaged app.
