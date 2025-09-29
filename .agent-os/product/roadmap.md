# Roadmap

## Phase 0: Already Completed

- [x] Electron main spawns FastAPI on 127.0.0.1 and waits for `/health` (`app/main.cjs`)
- [x] Backend provider proxies and unified chat routing with rate limiting and token guard (`backend/app/main.py`)
- [x] Prompts Library and System Prompt Creator toolbar with Appearance toggle persistence (`script.js`)
- [x] Agents Catalog with themed icons and hover accents; category panel foundation

## Phase 1: Current Development

- [ ] Normalize category selection and taxonomy (`script.js`): `trim().toLowerCase()` compare; add selection toast
- [ ] Health indicators for Ollama/Gemini endpoints
- [ ] Docs lint cleanup (CHANGELOG) and CSS dedup (style.css); fix `handleSend` warning
- [ ] Add Next.js (no Vite, no Docker) under `web/` with Tailwind + shadcn/ui; map theme tokens; Electron loads web bundle

### Option B path (selected)

- [x] Tailwind CSS integration in current vanilla UI (no React): Tailwind CLI wired, `dist/styles.css` linked, theme toggles live.
- [ ] Chat window layout parity (post‑Tailwind): audit Conversations view and apply minimal, scoped fixes.

## Phase 2: Near Term
- [ ] shadcn/ui components, blocks, themes via React/Next.js when moving from Option B to Option A
- [ ] RAG sources UI (upload/index/search stubs in frontend)
- [ ] Minimal E2E tests for Appearance persistence and Prompts flow

## Phase 3: Later

- [ ] Packaging for Windows/macOS installers
- [ ] Optional web distribution (Next.js server), still no Docker
- [ ] Rich analytics/log opt‑in with privacy controls
