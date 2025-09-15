# BUILD_AND_DEPLOY.md

# Build & Deploy

## Local Development

1. Install Node.js and Python 3.10+  
2. Install dependencies: `npm install`  
3. Start the desktop app (Electron): `npm run dev`

### Desktop notes

- The desktop renderer defaults to the root bundle: `index.html` + `script.js`.
- The backend FastAPI service is spawned automatically on `127.0.0.1:<PORT>`; default `PORT=8000`.
- If you change Electron main or preload code, fully close the Electron window and start it again.

### Personal Notes (Save-As)

- The Save button invokes a native OS Save As dialog via Electron IPC.
- An IPC status chip shows availability:
  - IPC OK (green): native Save-As will open.
  - IPC off (red): Save will fall back to direct file download.
- Autosave is enabled on input (debounced), navigation, visibility change, and window close.

### Environment

- You can override the UI bundle for debugging with `UI_BUNDLE=web`, but production desktop uses the root renderer by default.

## Release

1. Update `docs/CHANGELOG.md`.
2. Tag the release, e.g.: `git tag -a v0.1.3 -m "v0.1.3" && git push origin v0.1.3`.
3. Create a GitHub Release (optional).

## Packaging

- Windows: `npm run package-win`  
- macOS: `npm run package-mac`  
- Linux: `npm run package-linux`
2. Push and create GitHub Release  
3. Upload packaged binaries to release

## Environment Configuration (Search Providers & Local API Token)

Use `.env` (see `.env.example`) to configure the desktop backend and search providers.

Required/Optional variables:

- `LOCAL_API_TOKEN` (optional):
  - When set, all `/api/*` routes require `Authorization: Bearer <LOCAL_API_TOKEN>`.
  - Set the same token in the UI via `localStorage['local:apiToken']` (handled automatically by the app if present).

- `SEARXNG_URL` (recommended):
  - Primary SearXNG instance used by `/api/tools/search`. Example: `https://priv.au`.
  - Open‑source, keyless.

- `SEARXNG_FALLBACK_URL` (optional):
  - Fallback SearXNG instance when the primary is down. Example: `https://searx.party`.

- `BRAVE_API_KEY` (optional):
  - If provided, `/api/tools/search` prefers Brave after SearXNG. Otherwise it falls back to DuckDuckGo Instant Answer.

Quick start on Windows (PowerShell):

```
$env:SEARXNG_URL='https://priv.au'
$env:SEARXNG_FALLBACK_URL='https://searx.party'
# Optional:
# $env:BRAVE_API_KEY='...'
npm run dev
```

Verification (Browsing):

1. In the app, open Chat.
2. Click the `Web` toggle (left of Attach) to enable browsing.
3. Ask a time‑sensitive question (e.g., "Latest on SpaceX Starship static fire").
4. The AI reply should include a collapsible "Web findings" card under the message with links and snippets.

Verification (Local API Token):

1. Set `LOCAL_API_TOKEN` in `.env` and restart.
2. In the UI DevTools console, set `localStorage.setItem('local:apiToken','<same-token>')` if needed.
3. All `/api/*` calls should succeed (401 otherwise).
