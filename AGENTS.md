# Repository Guidelines

## Project Structure & Module Organization

This repository is a dependency-free Chrome Manifest V3 extension. Source files live at the repository root:

- `background.js` coordinates tabs, jobs, storage, and extension messages.
- `capture-main.js` runs in X's page context; `content.js` detects the report UI and coordinates capture.
- `report.mjs`, `labels.mjs`, and `i18n.mjs` contain parsing, label mapping, and localization logic.
- `popup.html`, `popup.css`, and `popup.mjs` implement the extension popup.
- `_locales/` contains Chrome manifest translations; `icons/` and `docs/` contain static assets.
- `test.mjs` is the complete automated test suite. Build artifacts go to ignored `dist/`.

## Build, Test, and Development Commands

- `node test.mjs` runs all assertions without installing dependencies.
- `for file in *.js *.mjs; do node --check "$file"; done` checks JavaScript syntax.
- `./release.sh` runs tests and creates `dist/x-recommendation-checker-v<version>.zip`.
- Load the repository directory through `chrome://extensions` → **Load unpacked** for manual testing.

Use `./release.sh --publish` only from a clean, up-to-date `main` branch; it creates and pushes a release tag.

## Coding Style & Naming Conventions

Use two-space indentation, semicolons, double quotes, and trailing commas in multiline structures. Prefer `const`, small functions, and `async`/`await`. Use ES modules for `.mjs` files and module service workers; keep classic content scripts wrapped in an IIFE. Name functions and variables in `camelCase`, constants in `UPPER_SNAKE_CASE`, and DOM IDs/classes in kebab-case. No formatter or linter is configured, so match surrounding code.

Keep user-facing translations synchronized in `i18n.mjs`. Reserve `_locales/*/messages.json` for strings referenced by `manifest.json`.

## Testing Guidelines

Tests use `node:assert/strict` and lightweight VM mocks. Extend `test.mjs` for every non-trivial parser, DOM-detection, storage, or localization change. Reproduce X page changes with a minimal DOM fixture, then run `node test.mjs` and `./release.sh` before submission.

## Commit & Pull Request Guidelines

Follow the existing Conventional Commit style: `feat: ...`, `docs: ...`, `ci: ...`, or `fix: ...`. Keep each commit focused. Pull requests should explain behavior changes, list verification commands, link relevant issues, and include popup screenshots for UI changes. Call out manifest permission, version, data-handling, or X DOM/network assumptions explicitly.

## Security & Agent Instructions

Keep permissions minimal and never commit credentials or captured user reports. Treat page data as untrusted and normalize it before storage or rendering. Automation agents must respond in Simplified Chinese, preserve unrelated local changes, and prefer the smallest tested fix.
