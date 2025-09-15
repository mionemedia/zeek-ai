# Zeek AI Desktop (Electron-first)

Zeek AI runs as a lightweight Electron desktop app. The renderer (UI) talks to local services on `127.0.0.1` (no proxy, no Nginx). Provider calls are proxied through the local FastAPI backend to avoid CORS and to attach credentials securely.

## Quick start (Electron dev)

Prereqs: Node.js 18+, Python 3.10+.

1) Install deps
```powershell
npm install
```

2) Start the Electron app (spawns backend on 127.0.0.1)
```powershell
npm run dev
```

Optional: secure local API with a token
- Set an environment variable for the backend before starting:
```powershell
$env:LOCAL_API_TOKEN = "devtoken"
npm run dev
```
- In the renderer, set the same token once:
```js
localStorage.setItem('local:apiToken', 'devtoken')
```

## Backend only (standalone)

If you want to run the API without Electron:
```powershell
npm run backend
```
The API is available at http://127.0.0.1:8000

You can still open `index.html` in your browser for a quick UI check; CORS is permissive for dev.

## Project structure (key files)

- `app/main.ts` — Electron main process. Spawns FastAPI, waits for `/health`, loads UI.
- `app/preload.ts` — IPC bridge (zeek.health/zeek.chat) for renderer.
- `backend/app/main.py` — FastAPI backend and provider proxies.
- `index.html`, `style.css`, `script.js` — current UI files (will be relocated to `web/`).

## Notes

- Nginx has been removed from docker-compose and is not required for desktop mode.
- If you previously used Docker to serve the UI via Nginx, switch to Electron (`npm run dev`).
* `.dockerignore` excludes the duplicated `zeek-ai/` subfolder to avoid copying duplicate files into the image.

## Run full stack with docker-compose

This will start both the UI (nginx) and the backend (FastAPI) and wire `/api/*` through nginx to the backend.

1. Build and start services:

```powershell
docker compose up -d --build
```

1. Open the UI:

```text
http://localhost:8080
```

1. Verify backend via nginx proxy:

```powershell
curl http://localhost:8080/api/model_hub/providers
```

To stop:

```powershell
docker compose down
```

## Routes & Navigation

All routes use hash-based navigation. You can directly access a page with URLs like `http://localhost:8080#/features`.

* `/` — Conversations (Dashboard)
* `/features` — Features overview
* `/model-hub` — Consolidated Model Hub
* `/model-hub-local` — Legacy local models page (back-compat)
* `/model-hub-online` — Legacy online models page (back-compat)
* `/personas` — Personas
- `/prompts` — Prompts Library
- `/knowledge-stacks` — Knowledge Stacks (RAG)
- `/toolbox` — Toolbox (MCP tools)
- `/workflows` — Workflows
- `/playground` — AI Playground
- `/settings` — Settings (Appearance, Backup & Restore, Account)

Tips:
- Click the settings icon in the bottom-left user profile area to open `/settings`.
- Navigation state is controlled by the URL hash; refreshing the page will preserve the current route.
