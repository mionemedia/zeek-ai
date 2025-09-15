# CHANGELOG.md

# Changelog

All notable changes to this project will be documented here.

## [Unreleased]

- Unify sidebars across pages using global `buildSidebar()` to keep navigation consistent.

## [0.1.2] - 2025-09-15

### Fixed

  • Resolve renderer blank screen by removing duplicate `sendBtn` declaration in `script.js` and consolidating send handling.
  • Restore modern desktop UI after rollback; keep Electron desktop architecture with FastAPI loopback.
- Restore modern desktop UI after rollback; keep Electron desktop architecture with FastAPI loopback.

### Changed

- Kept `UI_BUNDLE` switch in `app/main.cjs` to toggle between `index.html` (root) and `web/index.html` during stabilization.

## [0.1.1] - 2025-09-15

### Added

- Electron app-level logging to `server/logs/app.log` capturing renderer console, load failures, unresponsive notices, and backend spawn lifecycle. (file: `app/main.cjs`)
- UI bundle switch via `UI_BUNDLE` environment variable to quickly toggle renderer target between `index.html` (root) and `web/index.html` (modern bundle). (file: `app/main.cjs`)

### Fixed

- Navigation in root UI by mapping routes to function references and adding robust link delegation (capture + bubble + window), eliminating inert clicks. (file: `script.js` at repo root)
- API calls under `file://` by rewriting relative `/api/*` requests to `http://127.0.0.1:<port>/*` in the global fetch wrapper. Port defaults to `8000` and can be overridden via `localStorage.setItem('core:port', '8000')`. (file: `script.js`)
- Sidebar logo path in the root stylesheet from `logo-small.png` to `assets/logo-small.png`. (file: `style.css`)
- Chat send behavior: single binding across renders, Enter-to-send support, pending/anti-double-submit, and graceful fallback when backend chat route is unavailable. Prevents false "Type a message first" toasts and UI freezes. (file: `script.js`)

### Changed

- Router diagnostics and safe fallback when unknown route or handler errors occur, rendering dashboard as a default. (file: `script.js`)

### Notes

- For major UI changes, fully close the Electron window and start it again so changes take effect.

## [2025-09-01]

### Added

- Initial architecture and PRP documents
- Style guide and template for wireframes
