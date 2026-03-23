# Repository Guidelines

## Project Structure & Module Organization
This repository is a product and UI prototype workspace for Batch Image Studio. [`PRD.md`](/Users/luoyaosheng/Desktop/project/Other/Batch%20Image%20Studio/PRD.md) contains the product requirements in Chinese. [`stitch/blueprint_precision/DESIGN.md`](/Users/luoyaosheng/Desktop/project/Other/Batch%20Image%20Studio/stitch/blueprint_precision/DESIGN.md) defines the visual system. The `stitch/` directory holds screen-by-screen prototypes in folders such as `stitch/p00/` through `stitch/p10/`, each typically containing `code.html` and `screen.png`.

## Build, Test, and Development Commands
There is no formal build pipeline checked in yet. Use lightweight preview commands while iterating:

```bash
python3 -m http.server 8000
open stitch/p00/code.html
rg --files stitch
```

`python3 -m http.server 8000` serves the static prototypes locally. `open stitch/p00/code.html` is the fastest way to inspect one screen on macOS. `rg --files stitch` lists all prototype assets and pages.

## Coding Style & Naming Conventions
Keep prototype files self-contained and readable. Use 2-space indentation in HTML, CSS, and inline JavaScript. Preserve the existing Tailwind-first approach used in `stitch/*/code.html`, and keep design tokens aligned with the palette and spacing rules in `DESIGN.md`. Name new prototype pages with zero-padded folders such as `stitch/p11/`, and keep exported screenshots as `screen.png`.

## Testing Guidelines
Testing is currently manual. For each change, verify the updated HTML page in a browser, check layout at desktop width, and confirm that referenced CDN assets load correctly. When adding a new flow, include both the HTML prototype and a matching screenshot for review.

## Commit & Pull Request Guidelines
Git history is not available in this workspace, so no repository-specific commit convention can be inferred. Use Conventional Commits by default, for example `feat: add batch preview prototype` or `docs: refine contributor guide`. Pull requests should include a short summary, the affected paths, updated screenshots for visual changes, and links back to the relevant PRD section or design note.

## Security & Configuration Tips
Do not commit real user images, model credentials, or local export paths. Keep prototypes dependency-light and prefer public CDN resources only for mockups; production dependencies should be introduced in a dedicated app scaffold, not inside `stitch/`.
