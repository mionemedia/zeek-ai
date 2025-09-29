from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi import Request, HTTPException, Depends
from fastapi.responses import JSONResponse
import httpx
import time
import os
import uvicorn

app = FastAPI(title="Zeek AI Backend", version="0.1.0")

# If UI is served via nginx and proxies /api to this backend, CORS is not needed.
# Leaving permissive CORS for local dev convenience if accessed directly.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --- Very simple in-memory rate limiter (60 req/min per client IP) ---
RATE_LIMIT = 300
WINDOW_SEC = 60
_rl_counters: dict[str, list[float]] = {}


def rate_limit(request: Request):
    ip = request.client.host if request.client else "anonymous"
    now = time.time()
    window_start = now - WINDOW_SEC
    bucket = _rl_counters.setdefault(ip, [])
    # drop old timestamps
    while bucket and bucket[0] < window_start:
        bucket.pop(0)
    if len(bucket) >= RATE_LIMIT:
        raise HTTPException(status_code=429, detail={"error": {"message": "Rate limit exceeded", "code": "rate_limited"}})
    bucket.append(now)


LOCAL_API_TOKEN = os.getenv("LOCAL_API_TOKEN", "").strip()
BRAVE_API_KEY = os.getenv("BRAVE_API_KEY", "").strip()
SEARXNG_URL = os.getenv("SEARXNG_URL", "").strip().rstrip('/')
SEARXNG_FALLBACK_URL = os.getenv("SEARXNG_FALLBACK_URL", "").strip().rstrip('/') or "https://searx.party"

@app.middleware("http")
async def local_token_guard(request: Request, call_next):
    """When LOCAL_API_TOKEN is set, require Authorization: Bearer <token> for /api/* routes.
    Health endpoints remain open.
    """
    path = request.url.path
    if LOCAL_API_TOKEN and path.startswith("/api/") and path not in ("/api/health",):
        auth = request.headers.get("authorization", "")
        token = auth.split(" ")[-1] if auth else ""
        if token != LOCAL_API_TOKEN:
            return JSONResponse(status_code=401, content={"error": {"message": "Unauthorized", "code": "unauthorized"}})
    return await call_next(request)


@app.get("/health")
def health(dep: None = Depends(rate_limit)):
    return {"status": "ok"}

@app.get("/api/health")
def api_health(dep: None = Depends(rate_limit)):
    return {"status": "ok"}


@app.get("/api/model_hub/providers")
def list_providers(dep: None = Depends(rate_limit)):
    return {
        "data": [
            {
                "id": "openai",
                "name": "OpenAI GPT-4",
                "provider": "OpenAI",
                "pricing": "$0.03/1K tok (prompt), $0.06/1K tok (completion)"
            },
            {
                "id": "anthropic",
                "name": "Anthropic Claude 3 Opus",
                "provider": "Anthropic",
                "pricing": "$15/1M tok (prompt), $75/1M tok (completion)"
            },
            {
                "id": "ollama-llama2",
                "name": "Ollama Llama 2",
                "provider": "Ollama (local)",
                "pricing": "$0 (local)"
            }
        ]
    }


# --- Ollama proxy (avoids browser CORS) ---
@app.get("/api/ollama/version")
async def ollama_version(base: str, dep: None = Depends(rate_limit)):
    # strip trailing slash
    base = base.rstrip('/')
    url = f"{base}/api/version"
    timeout = httpx.Timeout(5.0)
    async with httpx.AsyncClient(timeout=timeout) as client:
        try:
            r = await client.get(url)
            return JSONResponse(status_code=r.status_code, content=r.json() if r.headers.get('content-type','').startswith('application/json') else {"raw": r.text})
        except httpx.RequestError as e:
            raise HTTPException(status_code=502, detail={"error": {"message": f"Upstream error: {str(e)}", "code": "ollama_upstream"}})


# --- Unified chat endpoint with provider registry ---
@app.post("/api/chat")
async def chat_unified(request: Request, dep: None = Depends(rate_limit)):
    body = await request.json()
    provider = (body.get('provider') or '').strip().lower()  # e.g., 'openai','anthropic','googleai','openrouter','ollama','mistral','groq','cohere','azure_openai'
    model = (body.get('model') or '').strip()
    prompt = (body.get('prompt') or '').strip()
    if not provider or not model or not prompt:
        raise HTTPException(status_code=400, detail={"error": {"message": "provider, model, and prompt are required", "code": "bad_request"}})

    # common inputs
    api_key = (body.get('apiKey') or '').strip()
    base = (body.get('base') or '').strip().rstrip('/')
    azure = body.get('azure') or {}

    timeout = httpx.Timeout(60.0)
    async with httpx.AsyncClient(timeout=timeout) as client:
        try:
            # Ollama (local)
            if provider.startswith('ollama'):
                if not base:
                    raise HTTPException(status_code=400, detail={"error": {"message": "Ollama base is required", "code": "bad_request"}})
                url = f"{base}/api/generate"
                payload = {"model": model, "prompt": prompt, "stream": False}
                r = await client.post(url, json=payload)
                data = r.json() if r.headers.get('content-type','').startswith('application/json') else {"raw": r.text}
                out = (data.get('response') if isinstance(data, dict) else None) or data
                return JSONResponse(status_code=r.status_code, content={"output": out, "raw": data})

            # Google AI (Gemini)
            if provider.startswith('google'):
                if not api_key:
                    raise HTTPException(status_code=400, detail={"error": {"message": "Google AI apiKey is required", "code": "bad_request"}})
                # Normalize model (strip 'models/' prefix if present)
                if model.startswith('models/'):
                    model = model.split('/', 1)[1]
                url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
                payload = {"contents": [{"parts": [{"text": prompt}]}]}
                r = await client.post(url, json=payload, headers={"Content-Type": "application/json"})
                data = r.json() if r.headers.get('content-type','').startswith('application/json') else {"raw": r.text}
                text = None
                try:
                    text = data["candidates"][0]["content"]["parts"][0]["text"]
                except Exception:
                    text = None
                return JSONResponse(status_code=r.status_code, content={"output": text, "raw": data})

            # OpenRouter
            if provider.startswith('openrouter'):
                if not api_key:
                    raise HTTPException(status_code=400, detail={"error": {"message": "OpenRouter apiKey is required", "code": "bad_request"}})
                url = "https://openrouter.ai/api/v1/chat/completions"
                payload = {"model": model, "messages": [{"role": "user", "content": prompt}]}
                r = await client.post(url, json=payload, headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"})
                data = r.json() if r.headers.get('content-type','').startswith('application/json') else {"raw": r.text}
                text = None
                try:
                    text = data["choices"][0]["message"]["content"]
                except Exception:
                    text = None
                return JSONResponse(status_code=r.status_code, content={"output": text, "raw": data})

            # OpenAI-compatible
            if provider.startswith('openai'):
                if not api_key:
                    raise HTTPException(status_code=400, detail={"error": {"message": "OpenAI apiKey is required", "code": "bad_request"}})
                url = "https://api.openai.com/v1/chat/completions"
                payload = {"model": model, "messages": [{"role": "user", "content": prompt}]}
                r = await client.post(url, json=payload, headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"})
                data = r.json() if r.headers.get('content-type','').startswith('application/json') else {"raw": r.text}
                text = None
                try:
                    text = data["choices"][0]["message"]["content"]
                except Exception:
                    text = None
                return JSONResponse(status_code=r.status_code, content={"output": text, "raw": data})

            # Anthropic
            if provider.startswith('anthropic'):
                if not api_key:
                    raise HTTPException(status_code=400, detail={"error": {"message": "Anthropic apiKey is required", "code": "bad_request"}})
                url = "https://api.anthropic.com/v1/messages"
                payload = {"model": model, "max_tokens": 1024, "messages": [{"role": "user", "content": prompt}]}
                r = await client.post(url, json=payload, headers={"x-api-key": api_key, "anthropic-version": "2023-06-01", "Content-Type": "application/json"})
                data = r.json() if r.headers.get('content-type','').startswith('application/json') else {"raw": r.text}
                text = None
                try:
                    text = data["content"][0]["text"]
                except Exception:
                    text = None
                return JSONResponse(status_code=r.status_code, content={"output": text, "raw": data})

            # Mistral
            if provider.startswith('mistral'):
                if not api_key:
                    raise HTTPException(status_code=400, detail={"error": {"message": "Mistral apiKey is required", "code": "bad_request"}})
                url = "https://api.mistral.ai/v1/chat/completions"
                payload = {"model": model, "messages": [{"role": "user", "content": prompt}]}
                r = await client.post(url, json=payload, headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"})
                data = r.json() if r.headers.get('content-type','').startswith('application/json') else {"raw": r.text}
                text = None
                try:
                    text = data["choices"][0]["message"]["content"]
                except Exception:
                    text = None
                return JSONResponse(status_code=r.status_code, content={"output": text, "raw": data})

            # Groq (OpenAI-compatible path)
            if provider.startswith('groq'):
                if not api_key:
                    raise HTTPException(status_code=400, detail={"error": {"message": "Groq apiKey is required", "code": "bad_request"}})
                url = "https://api.groq.com/openai/v1/chat/completions"
                payload = {"model": model, "messages": [{"role": "user", "content": prompt}]}
                r = await client.post(url, json=payload, headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"})
                data = r.json() if r.headers.get('content-type','').startswith('application/json') else {"raw": r.text}
                text = None
                try:
                    text = data["choices"][0]["message"]["content"]
                except Exception:
                    text = None
                return JSONResponse(status_code=r.status_code, content={"output": text, "raw": data})

            # Cohere
            if provider.startswith('cohere'):
                if not api_key:
                    raise HTTPException(status_code=400, detail={"error": {"message": "Cohere apiKey is required", "code": "bad_request"}})
                url = "https://api.cohere.ai/v2/chat"
                payload = {"model": model, "messages": [{"role": "user", "content": prompt}]}
                r = await client.post(url, json=payload, headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"})
                data = r.json() if r.headers.get('content-type','').startswith('application/json') else {"raw": r.text}
                text = None
                try:
                    text = data["text"] if isinstance(data, dict) and "text" in data else (data.get("output") if isinstance(data, dict) else None)
                except Exception:
                    text = None
                return JSONResponse(status_code=r.status_code, content={"output": text, "raw": data})

            # Azure OpenAI
            if provider.startswith('azure') or provider.startswith('azure_openai'):
                # expects azure = { endpoint, apiKey, deployment, apiVersion }
                az_ep = (azure.get('endpoint') if isinstance(azure, dict) else '') or ''
                az_key = (azure.get('apiKey') if isinstance(azure, dict) else '') or api_key
                az_dep = (azure.get('deployment') if isinstance(azure, dict) else '') or model
                az_ver = (azure.get('apiVersion') if isinstance(azure, dict) else '') or '2025-03-01-preview'
                if not az_ep or not az_key or not az_dep:
                    raise HTTPException(status_code=400, detail={"error": {"message": "Azure endpoint, apiKey and deployment are required", "code": "bad_request"}})
                url = f"{az_ep.rstrip('/')}/openai/deployments/{az_dep}/chat/completions?api-version={az_ver}"
                payload = {"messages": [{"role": "user", "content": prompt}]}
                r = await client.post(url, json=payload, headers={"api-key": az_key, "Content-Type": "application/json"})
                data = r.json() if r.headers.get('content-type','').startswith('application/json') else {"raw": r.text}
                text = None
                try:
                    text = data["choices"][0]["message"]["content"]
                except Exception:
                    text = None
                return JSONResponse(status_code=r.status_code, content={"output": text, "raw": data})

            raise HTTPException(status_code=400, detail={"error": {"message": f"Unsupported provider: {provider}", "code": "unsupported_provider"}})
        except httpx.RequestError as e:
            raise HTTPException(status_code=502, detail={"error": {"message": f"Upstream error: {str(e)}", "code": "chat_upstream"}})

# --- Google AI proxy (Gemini) ---
@app.post("/api/googleai/generate")
async def google_ai_generate(request: Request, dep: None = Depends(rate_limit)):
    body = await request.json()
    api_key = (body.get('apiKey') or '').strip()
    model = (body.get('model') or '').strip()
    prompt = (body.get('prompt') or '').strip()
    if not api_key or not model or not prompt:
        raise HTTPException(status_code=400, detail={"error": {"message": "apiKey, model, and prompt are required", "code": "bad_request"}})
    # Normalize model (strip 'models/' prefix if present)
    if model.startswith('models/'):
        model = model.split('/', 1)[1]
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
    payload = {"contents": [{"parts": [{"text": prompt}]}]}
    timeout = httpx.Timeout(60.0)
    async with httpx.AsyncClient(timeout=timeout) as client:
        try:
            r = await client.post(url, json=payload, headers={"Content-Type": "application/json"})
            if r.headers.get('content-type','').startswith('application/json'):
                data = r.json()
                text = None
                try:
                    text = data["candidates"][0]["content"]["parts"][0]["text"]
                except Exception:
                    text = None
                return JSONResponse(status_code=r.status_code, content={"output": text, "raw": data})
            else:
                return JSONResponse(status_code=r.status_code, content={"raw": r.text})
        except httpx.RequestError as e:
            raise HTTPException(status_code=502, detail={"error": {"message": f"Upstream error: {str(e)}", "code": "googleai_upstream"}})

@app.get("/api/googleai/models")
async def google_ai_models(apiKey: str, dep: None = Depends(rate_limit)):
    url = f"https://generativelanguage.googleapis.com/v1beta/models?key={apiKey}"
    timeout = httpx.Timeout(20.0)
    async with httpx.AsyncClient(timeout=timeout) as client:
        try:
            r = await client.get(url)
            if r.headers.get('content-type','').startswith('application/json'):
                data = r.json()
                names = []
                try:
                    for m in (data.get('models') or []):
                        if isinstance(m, dict) and m.get('name'):
                            names.append(m['name'])
                except Exception:
                    names = []
                return JSONResponse(status_code=r.status_code, content={"models": names, "raw": data})
            else:
                return JSONResponse(status_code=r.status_code, content={"raw": r.text})
        except httpx.RequestError as e:
            raise HTTPException(status_code=502, detail={"error": {"message": f"Upstream error: {str(e)}", "code": "googleai_upstream"}})


# --- OpenRouter proxy ---
@app.post("/api/openrouter/generate")
async def openrouter_generate(request: Request, dep: None = Depends(rate_limit)):
    body = await request.json()
    api_key = (body.get('apiKey') or '').strip()
    model = (body.get('model') or '').strip()
    prompt = (body.get('prompt') or '').strip()
    if not api_key or not model or not prompt:
        raise HTTPException(status_code=400, detail={"error": {"message": "apiKey, model, and prompt are required", "code": "bad_request"}})
    url = "https://openrouter.ai/api/v1/chat/completions"
    payload = {
        "model": model,
        "messages": [
            {"role": "user", "content": prompt}
        ]
    }
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }
    timeout = httpx.Timeout(60.0)
    async with httpx.AsyncClient(timeout=timeout) as client:
        try:
            r = await client.post(url, json=payload, headers=headers)
            if r.headers.get('content-type','').startswith('application/json'):
                data = r.json()
                text = None
                try:
                    text = data["choices"][0]["message"]["content"]
                except Exception:
                    text = None
                return JSONResponse(status_code=r.status_code, content={"output": text, "raw": data})
            else:
                return JSONResponse(status_code=r.status_code, content={"raw": r.text})
        except httpx.RequestError as e:
            raise HTTPException(status_code=502, detail={"error": {"message": f"Upstream error: {str(e)}", "code": "openrouter_upstream"}})


# --- Tools: Live Weather (Open-Meteo) ---
@app.get("/api/tools/weather")
async def tools_weather(request: Request, location: str | None = None, dep: None = Depends(rate_limit)):
    """
    Returns current weather using Open-Meteo. If location is provided, geocode it first.
    Docs: https://open-meteo.com/
    """
    timeout = httpx.Timeout(10.0)
    async with httpx.AsyncClient(timeout=timeout) as client:
        try:
            lat = None
            lon = None
            place = (location or "").strip()
            if place:
                # Geocode location via Open-Meteo, then fall back to Nominatim (OSM) if needed
                geo_url = "https://geocoding-api.open-meteo.com/v1/search"
                gr = await client.get(geo_url, params={"name": place, "count": 1})
                if gr.status_code == 200 and gr.headers.get("content-type", "").startswith("application/json"):
                    g = gr.json()
                    if g and g.get("results"):
                        r0 = g["results"][0]
                        lat = r0.get("latitude")
                        lon = r0.get("longitude")
                        if r0.get("name") and r0.get("country"):
                            place = f"{r0['name']}, {r0['country']}"
                
                if lat is None or lon is None:
                    # Fallback: Nominatim (OpenStreetMap) — public service, be kind and include UA
                    try:
                        nom_url = "https://nominatim.openstreetmap.org/search"
                        nr = await client.get(nom_url, params={"q": place, "format": "json", "limit": 1}, headers={"User-Agent": "zeek-ai/0.1 (desktop)"})
                        if nr.status_code == 200 and nr.headers.get("content-type", "").startswith("application/json"):
                            nj = nr.json() or []
                            if isinstance(nj, list) and nj:
                                lat = float(nj[0].get("lat")) if nj[0].get("lat") else None
                                lon = float(nj[0].get("lon")) if nj[0].get("lon") else None
                                disp = nj[0].get("display_name")
                                if disp:
                                    place = disp
                    except Exception:
                        pass
                if lat is None or lon is None:
                    raise HTTPException(status_code=404, detail={"error": {"message": f"Location not found: {place}", "code": "location_not_found"}})
            else:
                # Default to a safe coordinate (Mocksville, NC approx.)
                lat = 35.894
                lon = -80.561
                place = "Mocksville, NC"

            wx_url = "https://api.open-meteo.com/v1/forecast"
            wr = await client.get(wx_url, params={
                "latitude": lat,
                "longitude": lon,
                "current_weather": True,
                "temperature_unit": "fahrenheit"
            })
            if wr.status_code != 200:
                raise HTTPException(status_code=wr.status_code, detail={"error": {"message": f"Weather fetch failed ({wr.status_code})", "code": "weather_error"}})
            w = wr.json() or {}
            cw = (w.get("current_weather") or {})
            temp_f = cw.get("temperature")
            wind = cw.get("windspeed")
            code = cw.get("weathercode")
            time_iso = cw.get("time")
            # Minimal code -> description mapping (subset)
            desc_map = {
                0: "Clear",
                1: "Mainly clear",
                2: "Partly cloudy",
                3: "Overcast",
                45: "Fog",
                48: "Depositing rime fog",
                51: "Light drizzle",
                61: "Light rain",
                63: "Rain",
                65: "Heavy rain",
                71: "Snow",
                80: "Rain showers",
            }
            desc = desc_map.get(code, "Conditions available")
            msg = f"Current weather in {place}: {temp_f}°F, {desc}, wind {wind} mph. Time: {time_iso}."
            return {"message": msg, "place": place, "current": cw}
        except httpx.RequestError as e:
            raise HTTPException(status_code=502, detail={"error": {"message": f"Upstream error: {str(e)}", "code": "weather_upstream"}})

# --- Tools: Web Search (Brave -> DuckDuckGo fallback) ---
@app.get("/api/tools/search")
async def tools_search(q: str, max: int = 5, dep: None = Depends(rate_limit)):
    q = (q or "").strip()
    if not q:
        raise HTTPException(status_code=400, detail={"error": {"message": "q is required", "code": "bad_request"}})
    max = max if 1 <= max <= 10 else 5
    timeout = httpx.Timeout(10.0)
    async with httpx.AsyncClient(timeout=timeout) as client:
        # Prefer SearXNG if configured (open-source, keyless). Try primary then fallback.
        for base in [u for u in [SEARXNG_URL, SEARXNG_FALLBACK_URL] if u]:
            try:
                r = await client.get(
                    f"{base}/search",
                    params={
                        "q": q,
                        "format": "json",
                        "language": "en",
                        "safesearch": 1,
                        "categories": "general",
                    },
                    headers={"Accept": "application/json"},
                )
                if r.status_code == 200 and r.headers.get("content-type", "").startswith("application/json"):
                    data = r.json() or {}
                    items = []
                    for d in (data.get("results") or [])[:max]:
                        items.append({
                            "title": d.get("title") or d.get("url"),
                            "url": d.get("url"),
                            "snippet": d.get("content") or d.get("pretty_url") or ""
                        })
                    if items:
                        return {"items": items}
            except httpx.RequestError:
                continue

        # Try Brave next if API key is configured
        if BRAVE_API_KEY:
            try:
                r = await client.get(
                    "https://api.search.brave.com/res/v1/web/search",
                    params={"q": q, "count": max},
                    headers={"Accept": "application/json", "X-Subscription-Token": BRAVE_API_KEY},
                )
                if r.status_code == 200 and r.headers.get("content-type", "").startswith("application/json"):
                    data = r.json()
                    items = []
                    for d in (data.get("web", {}).get("results", []) or [])[:max]:
                        items.append({
                            "title": d.get("title") or d.get("url"),
                            "url": d.get("url"),
                            "snippet": d.get("description") or ""
                        })
                    if items:
                        return {"items": items}
            except httpx.RequestError:
                pass

        # Fallback: DuckDuckGo Instant Answer API (limited but keyless)
        try:
            r = await client.get("https://api.duckduckgo.com/", params={"q": q, "format": "json", "no_redirect": 1, "no_html": 1})
            if r.status_code != 200:
                raise HTTPException(status_code=r.status_code, detail={"error": {"message": "Search failed", "code": "search_error"}})
            j = r.json() or {}
            items = []
            # Abstract
            if j.get("AbstractText") and j.get("AbstractURL"):
                items.append({"title": j.get("Heading") or j.get("AbstractURL"), "url": j.get("AbstractURL"), "snippet": j.get("AbstractText")})
            # Related topics
            for rt in (j.get("RelatedTopics") or []):
                if isinstance(rt, dict) and rt.get("Text") and rt.get("FirstURL"):
                    items.append({"title": rt.get("Text")[:80], "url": rt.get("FirstURL"), "snippet": rt.get("Text")})
                if len(items) >= max:
                    break
            return {"items": items[:max]}
        except httpx.RequestError as e:
            raise HTTPException(status_code=502, detail={"error": {"message": f"Search upstream error: {str(e)}", "code": "search_upstream"}})

@app.get("/api/openrouter/models")
async def openrouter_models(apiKey: str, dep: None = Depends(rate_limit)):
    url = "https://openrouter.ai/api/v1/models"
    headers = {"Authorization": f"Bearer {apiKey}", "Accept": "application/json"}
    timeout = httpx.Timeout(20.0)
    async with httpx.AsyncClient(timeout=timeout) as client:
        try:
            r = await client.get(url, headers=headers)
            if r.headers.get('content-type','').startswith('application/json'):
                data = r.json()
                names = []
                try:
                    for m in (data.get('data') or []):
                        mid = m.get('id') if isinstance(m, dict) else None
                        if mid: names.append(mid)
                except Exception:
                    names = []
                return JSONResponse(status_code=r.status_code, content={"models": names, "raw": data})
            else:
                return JSONResponse(status_code=r.status_code, content={"raw": r.text})
        except httpx.RequestError as e:
            raise HTTPException(status_code=502, detail={"error": {"message": f"Upstream error: {str(e)}", "code": "openrouter_upstream"}})


@app.post("/api/ollama/generate")
async def ollama_generate(request: Request, dep: None = Depends(rate_limit)):
    body = await request.json()
    base = (body.get('base') or '').rstrip('/')
    model = body.get('model') or ''
    prompt = body.get('prompt') or ''
    if not base or not model or not prompt:
        raise HTTPException(status_code=400, detail={"error": {"message": "base, model, and prompt are required", "code": "bad_request"}})
    url = f"{base}/api/generate"
    payload = {"model": model, "prompt": prompt, "stream": False}
    timeout = httpx.Timeout(60.0)
    async with httpx.AsyncClient(timeout=timeout) as client:
        try:
            r = await client.post(url, json=payload)
            # Ollama returns { response: "...", ... }
            return JSONResponse(status_code=r.status_code, content=r.json() if r.headers.get('content-type','').startswith('application/json') else {"raw": r.text})
        except httpx.RequestError as e:
            raise HTTPException(status_code=502, detail={"error": {"message": f"Upstream error: {str(e)}", "code": "ollama_upstream"}})

@app.get("/api/ollama/tags")
async def ollama_tags(base: str, dep: None = Depends(rate_limit)):
    base = base.rstrip('/')
    url = f"{base}/api/tags"
    timeout = httpx.Timeout(8.0)
    async with httpx.AsyncClient(timeout=timeout) as client:
        try:
            r = await client.get(url)
            return JSONResponse(status_code=r.status_code, content=r.json() if r.headers.get('content-type','').startswith('application/json') else {"raw": r.text})
        except httpx.RequestError as e:
            raise HTTPException(status_code=502, detail={"error": {"message": f"Upstream error: {str(e)}", "code": "ollama_upstream"}})


# --- RAG stubs ---
@app.post("/api/rag/sources/upload")
async def rag_upload(dep: None = Depends(rate_limit)):
    return {"data": {"source_id": "src_demo_1", "status": "UPLOADED"}}


@app.post("/api/rag/sources/index")
async def rag_index(dep: None = Depends(rate_limit)):
    return {"data": {"source_id": "src_demo_1", "status": "INDEXING"}}


@app.get("/api/rag/search")
async def rag_search(q: str = "", dep: None = Depends(rate_limit)):
    return {"data": {"query": q, "results": []}}


# --- STT stub ---
@app.post("/api/stt/transcribe")
async def stt_transcribe(dep: None = Depends(rate_limit)):
    return {"data": {"transcript": "This is a stubbed transcript."}}


# --- TTS stub ---
@app.post("/api/tts/synthesize")
async def tts_synthesize(dep: None = Depends(rate_limit)):
    return {"data": {"audio_url": "/static/tts/demo.wav"}}


# --- Mini AI (Phi-3 Mini via Ollama) ---
@app.post("/api/mini/generate")
async def mini_generate(request: Request, dep: None = Depends(rate_limit)):
    """
    Minimal local generation endpoint backed by Ollama (Phi-3 Mini).
    Request body: { prompt: string, system?: string, temperature?: float, max_tokens?: int }
    Response: { data: { text: string } }
    """
    body = await request.json()
    prompt = (body.get("prompt") or "").strip()
    system = (body.get("system") or "").strip()
    temperature = body.get("temperature")
    max_tokens = body.get("max_tokens")
    if not prompt:
        raise HTTPException(status_code=400, detail={"error": {"message": "prompt is required", "code": "bad_request"}})

    base = os.getenv("OLLAMA_BASE", "http://127.0.0.1:11434").rstrip('/')
    model = os.getenv("MINI_MODEL", "phi3:mini")
    url = f"{base}/api/generate"

    # Compose text prompt; Ollama /api/generate does not accept roles, so prepend system
    composed = (f"SYSTEM:\n{system}\n\n" if system else "") + prompt
    payload = {"model": model, "prompt": composed, "stream": False}
    if isinstance(temperature, (int, float)):
        payload["temperature"] = temperature
    if isinstance(max_tokens, int):
        payload["num_predict"] = max_tokens

    timeout = httpx.Timeout(15.0)
    async with httpx.AsyncClient(timeout=timeout) as client:
        try:
            r = await client.post(url, json=payload)
            if r.status_code != 200:
                raise HTTPException(status_code=r.status_code, detail={"error": {"message": "Ollama error", "code": "ollama_error", "raw": r.text}})
            data = r.json() if r.headers.get('content-type','').startswith('application/json') else {"raw": r.text}
            text = None
            try:
                text = data.get("response") if isinstance(data, dict) else None
            except Exception:
                text = None
            return JSONResponse(status_code=200, content={"data": {"text": text}, "meta": {"model": model}})
        except httpx.RequestError as e:
            raise HTTPException(status_code=502, detail={"error": {"message": f"Upstream error: {str(e)}", "code": "mini_upstream"}})


# --- Automation stubs ---
@app.post("/api/automation/commands/run")
async def automation_run(dep: None = Depends(rate_limit)):
    return {"data": {"status": "QUEUED", "job_id": "job_demo_1"}}


@app.get("/api/automation/experts")
async def automation_experts(dep: None = Depends(rate_limit)):
    return {"data": [
        {"id": "legal-advisor", "name": "Legal Advisor"},
        {"id": "code-reviewer", "name": "Code Reviewer"}
    ]}


@app.post("/api/automation/scratchpad/fork")
async def automation_scratchpad_fork(dep: None = Depends(rate_limit)):
    return {"data": {"scratchpad_id": "sp_demo_1", "status": "CREATED"}}


if __name__ == "__main__":
    # Allow running as a local service for Electron mode
    port = int(os.getenv("PORT", "8000"))
    # Bind to loopback for desktop security
    uvicorn.run("app.main:app", host="127.0.0.1", port=port, reload=False, workers=1)
