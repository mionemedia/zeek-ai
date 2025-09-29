# Tech Stack (Project)

## Runtime
- Electron 30.x (desktop shell)
- FastAPI (Python 3.10+) on 127.0.0.1 with health checks

## UI
- Current (Option B active): Vanilla HTML/CSS/JS (`index.html`, `style.css`, `script.js`) with Tailwind base utilities only
- Tailwind (active): Tailwind CLI builds `dist/styles.css` from `tailwind.css`; linked in `index.html`
- Target: Next.js 14+ (no Vite, no Docker), Tailwind CSS 4+, shadcn/ui components, blocks, themes
- Icons: Lucide React
- Theming: `html[data-theme]` + `--icon-accent` (dark `#049499`, light `#5DE2E7`)

### Migration plan
- React/Next.js spike will live in `web/` in parallel behind an Electron flag (no impact to current renderer until parity).

## Backend
- FastAPI + httpx + uvicorn
- Provider proxies: Ollama (local), Google AI (Gemini), OpenRouter, OpenAI-compatible, Anthropic, Mistral, Groq, Cohere, Azure OpenAI
- Rate limiting: simple in‑memory (300 req/min/IP)
- Optional local token guard via `LOCAL_API_TOKEN`

## Tooling
- Node 20 LTS, npm
- esbuild for Electron main/preload; Next.js build/runtime for web (no Vite)
- Tailwind CLI scripts: `npm run css:build`, `npm run css:watch`

## Repo & Workflow
- Branch protection: protect `main` from force-push/deletion, require PR reviews, and optionally require status checks.
- Use feature branches and squash-merge PRs into `main` to keep a linear history.

## Hosting / Distribution
- Desktop: Electron packaged installers (future)
- Optional web: Next.js server (no Docker)

## Testing
- `tests/e2e/` for E2E scaffolding; expand for theme and prompts flows
