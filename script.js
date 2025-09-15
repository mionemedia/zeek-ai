// Helper: build a consistent sidebar to avoid duplication on new pages
function buildSidebar(activeRoute) {
    const is = (hash) => (activeRoute === hash ? 'class="active"' : '');
    return `
        <div class="sidebar">
            <div class="logo">Zeeks AI</div>
            <div class="status-lights" style="display:flex;gap:8px;align-items:center;margin:8px 0 4px 0;">
                <span style="font-size:11px;color:var(--muted-text)">Status:</span>
                <span id="light-backend" class="light" title="Backend" style="font-size:16px;color:#90a4ae">●</span>
                <span id="light-modelhub" class="light" title="Model Hub API" style="font-size:16px;color:#90a4ae">●</span>
                <span id="light-rag" class="light" title="RAG API" style="font-size:16px;color:#90a4ae">●</span>
            </div>
            <button class="new-btn">+ New</button>
            <nav class="sidebar-nav">
                <ul>
                    <li><a href="#/" ${is('/') }><i class="material-icons">chat_bubble_outline</i> Conversations</a></li>
                    
                    <li><a href="#/personal" ${is('/personal')}><i class="material-icons">person</i> Personal</a></li>
                    <li><a href="#/features" ${is('/features')}><i class="material-icons">star_outline</i> Features</a></li>
                    <li><a href="#/model-hub-online" ${is('/model-hub-online')}><i class="material-icons">storage</i> Model Hub</a></li>
                    <li><a href="#/split-chats" ${is('/split-chats')}><i class="material-icons">view_week</i> Split Chats</a></li>
                    <li><a href="#/prompts" ${is('/prompts')}><i class="material-icons">description</i> Prompts Library</a></li>
                    <li><a href="#/knowledge-stacks" ${is('/knowledge-stacks')}><i class="material-icons">book</i> Knowledge Stacks</a></li>
                    <li><a href="#/toolbox" ${is('/toolbox')}><i class="material-icons">build</i> Toolbox</a></li>
                    <li><a href="#/workflows" ${is('/workflows')}><i class="material-icons">timeline</i> Workflows</a></li>
                    <li><a href="#/playground" ${is('/playground')}><i class="material-icons">science</i> AI Playground</a></li>
                </ul>
            </nav>
            <div class="user-profile">
                <div class="user-info">
                    <img src="https://i.pravatar.cc/40" alt="User Avatar">
                    <span>User</span>
                </div>
                <i class="material-icons">settings</i>
            </div>
        </div>
    `;
}

function updateModelBadge() {
    const badge = document.getElementById('chat-model-badge');
    if (!badge) return;
    const provider = window.__chatProvider || localStorage.getItem('chat:provider') || 'Ollama';
    let model = localStorage.getItem(`chat:model:${provider}`) || '';
    try {
        if (!model) {
            const raw = localStorage.getItem(providerStorageKey(provider));
            const cfg = raw ? JSON.parse(raw) : null;
            model = (cfg && (cfg.defModel || cfg.defaultModel)) || '';
        }
    } catch {}
    const text = `${provider}${model ? ' • ' + model : ''}`;
    badge.textContent = text;
    badge.title = `Current provider: ${provider}${model ? `\nModel: ${model}` : ''}`;
}

// Inject Authorization header for local API when a token is configured.
// Store a token with: localStorage.setItem('local:apiToken', '<token>')
(() => {
    try {
        const origFetch = window.fetch.bind(window);
        window.fetch = (input, init = {}) => {
            try {
                const token = localStorage.getItem('local:apiToken') || '';
                let url = typeof input === 'string' ? input : (input && input.url) || '';
                // When loaded via file://, relative /api/* will incorrectly resolve to file:///.../api/*
                // Rewrite to the local backend on 127.0.0.1
                if (typeof url === 'string' && url.startsWith('/api/')) {
                    const port = localStorage.getItem('core:port') || '8000';
                    const full = `http://127.0.0.1:${port}${url}`;
                    if (typeof input === 'string') input = full; else input = new Request(full, input);
                }
                // Inject bearer if configured and targeting API
                if (token && typeof url === 'string' && (url.startsWith('/api/') || url.startsWith('http://127.0.0.1:') || url.startsWith('https://127.0.0.1:'))) {
                    const headers = new Headers(init.headers || (typeof input !== 'string' ? input.headers : undefined) || {});
                    if (!headers.has('Authorization')) headers.set('Authorization', `Bearer ${token}`);
                    init = { ...init, headers };
                }
            } catch {}
            return origFetch(input, init);
        };
    } catch {}
})();

// --- Model selection helpers ---
async function fetchModelsForProvider(provider) {
    const key = (provider || '').toLowerCase();
    try {
        if (key.startsWith('ollama')) {
            const raw = localStorage.getItem('provider:Ollama');
            const cfg = raw ? JSON.parse(raw) : null;
            const base = (cfg && cfg.baseUrl) ? cfg.baseUrl.replace(/\/$/, '') : '';
            if (!base) throw new Error('Missing Ollama Base URL');
            const res = await fetchWithTimeout(`/api/ollama/tags?base=${encodeURIComponent(base)}`, { timeout: 10000 });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const json = await res.json();
            const models = Array.isArray(json && json.models) ? json.models.map(m => m.name || m.tag).filter(Boolean) : [];
            return models;
        }
        if (key.startsWith('google')) {
            const raw = localStorage.getItem('provider:Google AI');
            const cfg = raw ? JSON.parse(raw) : null;
            const apiKey = cfg && cfg.apiKey;
            if (!apiKey) throw new Error('Missing Google AI API Key');
            const res = await fetchWithTimeout(`/api/googleai/models?apiKey=${encodeURIComponent(apiKey)}`, { timeout: 12000 });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const json = await res.json();
            return Array.isArray(json && json.models) ? json.models : [];
        }
        if (key.startsWith('openrouter')) {
            const raw = localStorage.getItem('provider:OpenRouter');
            const cfg = raw ? JSON.parse(raw) : null;
            const apiKey = cfg && cfg.apiKey;
            if (!apiKey) throw new Error('Missing OpenRouter API Key');
            const res = await fetchWithTimeout(`/api/openrouter/models?apiKey=${encodeURIComponent(apiKey)}`, { timeout: 12000 });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const json = await res.json();
            return Array.isArray(json && json.models) ? json.models : [];
        }
        return [];
    } catch (e) {
        console.error('fetchModelsForProvider error:', e);
        toast(e && e.message ? e.message : 'Failed to load models', 'error');
        return [];
    }
}

async function openModelSelector(anchorBtn) {
    const existing = document.getElementById('model-popover');
    if (existing) { existing.remove(); }
    let selected = window.__chatProvider || localStorage.getItem('chat:provider') || 'Ollama';
    const pop = document.createElement('div');
    pop.id = 'model-popover';
    pop.className = 'model-popover';
    pop.style.position = 'fixed';
    pop.style.zIndex = '10000';
    pop.style.background = 'var(--card-bg)';
    pop.style.border = '1px solid var(--border-color)';
    pop.style.borderRadius = '8px';
    pop.style.boxShadow = '0 6px 18px rgba(0,0,0,0.35)';
    pop.style.padding = '8px';
    const providers = ['Ollama','Google AI','OpenRouter'];
    const options = providers.map(p => `<option value="${p}" ${p===selected?'selected':''}>${p}</option>`).join('');
    pop.innerHTML = `<div style="display:flex;flex-direction:column;gap:6px;min-width:300px">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:4px">
            <div style="display:flex;align-items:center;gap:8px">
                <label style="font-size:12px;color:var(--muted-text)">Provider</label>
                <select id="provider-switch" style="background:var(--card-bg);color:var(--text-color);border:1px solid var(--border-color);border-radius:6px;padding:4px 6px">${options}</select>
            </div>
            <button class="close-pop" style="border:none;background:transparent;color:var(--muted-text);font-size:18px;line-height:1">×</button>
        </div>
        <div class="model-list" style="max-height:40vh;overflow:auto"><div style="padding:8px;color:var(--muted-text);font-size:13px">Loading models…</div></div>
    </div>`;
    const rect = anchorBtn.getBoundingClientRect();
    pop.style.top = `${Math.round(rect.bottom + 8)}px`;
    pop.style.left = `${Math.round(rect.left)}px`;
    document.body.appendChild(pop);
    async function loadModelsUI(prov) {
        const listEl = pop.querySelector('.model-list');
        listEl.innerHTML = `<div style="padding:8px;color:var(--muted-text);font-size:13px">Loading models…</div>`;
        const models = await fetchModelsForProvider(prov);
        if (!models.length) {
            listEl.innerHTML = `<div style="padding:8px;color:var(--muted-text);font-size:13px">No models found.</div>`;
        } else {
            const lastUsed = localStorage.getItem(`chat:model:${prov}`) || '';
            listEl.innerHTML = models.map(name => {
                const sel = lastUsed && lastUsed === name;
                return `<button class="pick-model" data-name="${name.replace(/"/g,'&quot;')}" style="display:flex;align-items:center;justify-content:space-between;gap:8px;width:100%;text-align:left;padding:6px 8px;border-radius:6px;background:transparent;border:1px solid var(--border-color);${sel ? 'outline:2px solid #42a5f5' : ''}"><span>${name}</span>${sel ? '<span style="font-size:11px;color:#42a5f5">Selected</span>' : ''}</button>`;
            }).join('');
        }
    }
    await loadModelsUI(selected);
    // Bind provider switch change
    pop.querySelector('#provider-switch').addEventListener('change', async (ev) => {
        selected = ev.target.value;
        window.__chatProvider = selected;
        localStorage.setItem('chat:provider', selected);
        updateModelBadge();
        await loadModelsUI(selected);
    });
}

function providerStorageKey(name) {
    const n = (name || '').toLowerCase();
    if (n.startsWith('ollama') || /lm studio|lmstudio/.test(n)) return 'provider:Ollama';
    if (n.startsWith('google ai') || n.startsWith('google generative ai') || n.startsWith('google')) return 'provider:Google AI';
    if (n.startsWith('openrouter') || n.startsWith('open router')) return 'provider:OpenRouter';
    // default: use original
    return `provider:${name}`;
}

// Provider kind helper to unify string matching in one place
function getProviderKind(name) {
    const n = (name || '').toLowerCase();
    if (/ollama|lm studio|lmstudio/.test(n)) return 'ollama';
    if (/(google|gemini)/.test(n)) return 'gemini';
    if (/(openrouter|open router)/.test(n)) return 'openrouter';
    if (/azure/.test(n)) return 'azure';
    if (/anthropic/.test(n)) return 'anthropic';
    if (/mistral/.test(n)) return 'mistral';
    if (/groq/.test(n)) return 'groq';
    if (/cohere/.test(n)) return 'cohere';
    if (/openai/.test(n)) return 'openai';
    return 'unknown';
}

function loadProviderConfig(providerName) {
    const drawer = document.getElementById('provider-config-drawer');
    const card = drawer && drawer.querySelector('.config-card');
    if (!card) return;
    try {
        const raw = localStorage.getItem(providerStorageKey(providerName));
        if (!raw) return;
        const cfg = JSON.parse(raw);
        if (cfg.apiKey != null && card.querySelector('#cfg-api-key')) card.querySelector('#cfg-api-key').value = cfg.apiKey;
        if (cfg.baseUrl != null && card.querySelector('#cfg-base-url')) card.querySelector('#cfg-base-url').value = cfg.baseUrl;
        if (cfg.defModel != null && card.querySelector('#cfg-default-model')) card.querySelector('#cfg-default-model').value = cfg.defModel;
        if (cfg.apiVersion != null && card.querySelector('#cfg-api-version')) card.querySelector('#cfg-api-version').value = cfg.apiVersion;
        if (cfg.visionModel != null && card.querySelector('#cfg-vision-model')) card.querySelector('#cfg-vision-model').value = cfg.visionModel;
        if (cfg.keepAlive != null && card.querySelector('#cfg-keepalive')) card.querySelector('#cfg-keepalive').value = cfg.keepAlive;
        if (cfg.parallel != null && card.querySelector('#cfg-parallel')) card.querySelector('#cfg-parallel').value = cfg.parallel;
        if (cfg.temperature != null && card.querySelector('#cfg-temperature')) card.querySelector('#cfg-temperature').value = cfg.temperature;
        if (cfg.maxTokens != null && card.querySelector('#cfg-max-tokens')) card.querySelector('#cfg-max-tokens').value = cfg.maxTokens;
        if (cfg.topP != null && card.querySelector('#cfg-top-p')) card.querySelector('#cfg-top-p').value = cfg.topP;
        if (cfg.openaiOrg != null && card.querySelector('#cfg-openai-org')) card.querySelector('#cfg-openai-org').value = cfg.openaiOrg;
    } catch {}
}

function saveProviderConfig(providerName, cardRoot) {
    const card = cardRoot || (document.getElementById('provider-config-drawer')?.querySelector('.config-card'));
    if (!card) return;
    const baseUrl = (card.querySelector('#cfg-base-url')?.value || '').trim();
    const apiKey = (card.querySelector('#cfg-api-key')?.value || '').trim();
    const defModel = (card.querySelector('#cfg-default-model')?.value || '').trim();
    const apiVersion = (card.querySelector('#cfg-api-version')?.value || '').trim();
    const keepAlive = (card.querySelector('#cfg-keepalive')?.value || '').trim();
    const parallel = (card.querySelector('#cfg-parallel')?.value || '').trim();
    const visionModel = (card.querySelector('#cfg-vision-model')?.value || '').trim();
    const temperature = (card.querySelector('#cfg-temperature')?.value || '').trim();
    const maxTokens = (card.querySelector('#cfg-max-tokens')?.value || '').trim();
    const topP = (card.querySelector('#cfg-top-p')?.value || '').trim();
    const openaiOrg = (card.querySelector('#cfg-openai-org')?.value || '').trim();
    const payload = { baseUrl, apiKey, defModel, apiVersion, visionModel, keepAlive, parallel, temperature, maxTokens, topP, openaiOrg };
    localStorage.setItem(providerStorageKey(providerName), JSON.stringify(payload));
}

// Build minimal provider configuration panel for inline drawer
function buildProviderConfig(providerName) {
    const modalExpand = `onclick=\"(function(){openGlobalModal('${providerName} Configuration', document.getElementById('provider-config-drawer').innerHTML)})()\"`;
    const name = (providerName || '').toLowerCase();
    const kind = getProviderKind(providerName);
    const isLocal = kind === 'ollama';
    const isAzure = kind === 'azure';
    const isGemini = kind === 'gemini';
    const isOpenRouter = kind === 'openrouter';
    const needsApiKey = !isLocal; // all cloud providers use API keys
    const showBase = isLocal || isAzure; // Ollama/LM Studio base URL, Azure endpoint (Gemini never)
    const baseLabel = isAzure ? 'Endpoint' : 'Base URL';
    // For local Ollama in Docker Desktop, host.docker.internal is the correct host bridge
    const basePlaceholder = isAzure ? 'https://<resource>.openai.azure.com' : 'http://host.docker.internal:11434';
    const modelLabel = isAzure ? 'Deployment Name' : 'Chat model';
    const modelPlaceholder = isAzure ? 'my-gpt4o-deployment' : (isGemini ? 'Gemini 1.5 Flash' : 'gpt-4o | claude-3 | mistral-large | llama3 | ...');
    const apiKeyPlaceholder = (/openrouter/.test(name) ? 'sk-or-v1-...' : /anthropic/.test(name) ? 'sk-ant-...' : /cohere/.test(name) ? 'cohere-...': /google|gemini/.test(name) ? 'AIza...' : 'sk-...');
    const extraAzure = isAzure ? `
        <div class="form-row">
            <label>API Version</label>
            <input type="text" placeholder="2025-03-01-preview" id="cfg-api-version">
        </div>
    ` : '';
    // Show Load Models for Ollama, Google (Gemini), and OpenRouter
    const loadModelsBtn = isLocal
        ? `<button class="new-btn load-models-btn" style="background:#37474f" data-provider="${providerName}">Load Models</button>`
        : (isGemini ? `<button class="new-btn load-google-models-btn" style="background:#37474f" data-provider="${providerName}">Load Models</button>`
        : (isOpenRouter ? `<button class="new-btn load-openrouter-models-btn" style="background:#37474f" data-provider="${providerName}">Load Models</button>` : ''));
    const providerHint = isGemini
        ? `<div class="hint" style="margin-top:6px;color:var(--muted-text);font-size:12px">Example models: <code>gemini-1.5-flash-latest</code>, <code>gemini-1.5-pro-latest</code>. No Base URL required.</div>`
        : (isAzure ? `<div class="hint" style="margin-top:6px;color:var(--muted-text);font-size:12px">Use your Azure OpenAI Endpoint, Deployment name, and API Version (e.g., 2025-03-01-preview).</div>`
        : (isLocal ? `<div class="hint" style="margin-top:6px;color:var(--muted-text);font-size:12px">Enter your local server Base URL and a model installed in Ollama/LM Studio.</div>`
        : `<div class="hint" style="margin-top:6px;color:var(--muted-text);font-size:12px">Enter API Key and a valid model id for this provider.</div>`));
    return `
        <div class="config-card" style="margin-top:0;" data-provider="${providerName}">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                <h2 style="margin:0">${providerName} Configuration</h2>
                <div>
                    <button class="icon-btn" title="Expand" ${modalExpand}><i class="material-icons">open_in_full</i></button>
                    <button class="icon-btn" title="Close" onclick="(function(){const d=document.getElementById('provider-config-drawer'); if(d) d.style.display='none';})()"><i class="material-icons">close</i></button>
                </div>
            </div>
            <p class="model-note">Provide your provider credentials and defaults.</p>
            ${needsApiKey ? `
            <div class="form-row">
                <label>API Key</label>
                <input type="password" placeholder="${apiKeyPlaceholder}" id="cfg-api-key">
            </div>` : ''}
            ${showBase ? `
            <div class="form-row">
                <label>${baseLabel}</label>
                <input type="text" placeholder="${basePlaceholder}" id="cfg-base-url">
            </div>` : ''}
            <div class="form-row">
                <label>${modelLabel}</label>
                <input type="text" placeholder="${modelPlaceholder}" id="cfg-default-model">
            </div>
            ${isGemini ? `
            <div class="form-row">
                <label>Vision model fallback</label>
                <input type="text" placeholder="Gemini 1.5 Flash" id="cfg-vision-model">
            </div>` : ''}
            ${providerHint}
            <details style="margin-top:10px">
                <summary style="cursor:pointer">Advanced</summary>
                <div class="form-grid" style="margin-top:8px">
                    <div>
                        <label>Temperature</label>
                        <input type="number" step="0.01" min="0" max="2" placeholder="Provider default" id="cfg-temperature">
                    </div>
                    <div>
                        <label>Max output tokens</label>
                        <input type="number" min="1" placeholder="Provider default" id="cfg-max-tokens">
                    </div>
                    <div>
                        <label>Top P</label>
                        <input type="number" step="0.01" min="0" max="1" placeholder="Provider default" id="cfg-top-p">
                    </div>
                    ${kind === 'openai' ? `
                    <div>
                        <label>OpenAI Organization (optional)</label>
                        <input type="text" placeholder="org_..." id="cfg-openai-org">
                    </div>` : ''}
                </div>
            </details>
            ${extraAzure}
            <div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap;">
                <button class="new-btn save-config-btn" data-provider="${providerName}">Save</button>
                <button class="new-btn test-conn-btn" style="background:#455a64" data-provider="${providerName}">Test Connection</button>
                ${loadModelsBtn}
            </div>
            <div id="cfg-results" style="margin-top:10px;font-size:13px;color:var(--muted-text)"></div>
        </div>
    `;
}

// --- Personal Notes helpers ---
const NOTES_STORE_KEY = 'personal:notes:store';
const NOTES_CURRENT_KEY = 'personal:notes:current';

// --- Agents Catalog (seeded from https://github.com/ashishpatel26/500-AI-Agents-Projects ) ---
// Minimal starter set; expand by adding entries below. Each agent maps to a category and a logo URL.
const AGENTS_CATEGORIES = [
    'Productivity', 'Coding', 'Design', 'Image/GenAI', 'Voice/Audio', 'RPA/Automation', 'Education', 'Research', 'Data/Analytics'
];
const AGENTS_CATALOG = [
    {
        name: 'Code Assistant',
        category: 'Coding',
        description: 'AI pair programmer for code generation, explanation, and refactoring.',
        repo: 'https://github.com/ashishpatel26/500-AI-Agents-Projects',
        logo: 'https://cdn.simpleicons.org/github/FFFFFF'
    },
    {
        name: 'Research Analyst',
        category: 'Research',
        description: 'Web research, summarization, and citation drafting agent.',
        repo: 'https://github.com/ashishpatel26/500-AI-Agents-Projects',
        logo: 'https://cdn.simpleicons.org/readthedocs/FFFFFF'
    },
    {
        name: 'Image Designer',
        category: 'Image/GenAI',
        description: 'Prompt-to-image generation assistant with style presets.',
        repo: 'https://github.com/ashishpatel26/500-AI-Agents-Projects',
        logo: 'https://cdn.simpleicons.org/adobecreativecloud/FFFFFF'
    },
    {
        name: 'Voice Scribe',
        category: 'Voice/Audio',
        description: 'Speech-to-text and text-to-speech workflows with diarization.',
        repo: 'https://github.com/ashishpatel26/500-AI-Agents-Projects',
        logo: 'https://cdn.simpleicons.org/microsoftextra/FFFFFF'
    },
    {
        name: 'Task Automator',
        category: 'RPA/Automation',
        description: 'Desktop/web automation with natural language commands.',
        repo: 'https://github.com/ashishpatel26/500-AI-Agents-Projects',
        logo: 'https://cdn.simpleicons.org/powershell/FFFFFF'
    },
    {
        name: 'Study Buddy',
        category: 'Education',
        description: 'Interactive tutor that explains topics with examples and quizzes.',
        repo: 'https://github.com/ashishpatel26/500-AI-Agents-Projects',
        logo: 'https://cdn.simpleicons.org/googleclassroom/FFFFFF'
    },
    {
        name: 'Productivity Planner',
        category: 'Productivity',
        description: 'Daily planning, reminders, and project breakdowns.',
        repo: 'https://github.com/ashishpatel26/500-AI-Agents-Projects',
        logo: 'https://cdn.simpleicons.org/todoist/FFFFFF'
    },
    {
        name: 'Data Wrangler',
        category: 'Data/Analytics',
        description: 'CSV/JSON exploration, charting, and QA over data.',
        repo: 'https://github.com/ashishpatel26/500-AI-Agents-Projects',
        logo: 'https://cdn.simpleicons.org/plotly/FFFFFF'
    }
];

function debounce(fn, wait) {
    let t;
    return function(...args) {
        clearTimeout(t);
        t = setTimeout(() => fn.apply(this, args), wait);
    };
}

function genNoteId() { return 'note-' + Date.now(); }

function getNotesStore() {
    try {
        const raw = localStorage.getItem(NOTES_STORE_KEY);
        const parsed = raw ? JSON.parse(raw) : null;
        return parsed && typeof parsed === 'object' ? parsed : { notes: {} };
    } catch { return { notes: {} }; }
}
function setNotesStore(store) { try { localStorage.setItem(NOTES_STORE_KEY, JSON.stringify(store)); } catch {} }
function getCurrentNoteId() { return localStorage.getItem(NOTES_CURRENT_KEY) || ''; }
function setCurrentNoteId(id) { try { localStorage.setItem(NOTES_CURRENT_KEY, id); } catch {} }

function ensureNotesStore() {
    let store = getNotesStore();
    if (!store || typeof store !== 'object') store = { notes: {} };
    if (!store.notes) store.notes = {};
    let current = getCurrentNoteId();
    // Migrate legacy single-note value if present
    try {
        if (!Object.keys(store.notes).length) {
            const legacy = localStorage.getItem('personal:notes');
            if (legacy != null) {
                const id = genNoteId();
                store.notes[id] = { id, title: 'My Note', content: legacy || '', updatedAt: Date.now() };
                current = id;
                setNotesStore(store);
                localStorage.removeItem('personal:notes');
            }
        }
    } catch {}
    if (!current) {
        const id = genNoteId();
        store.notes[id] = { id, title: 'My Note', content: '', updatedAt: Date.now() };
        current = id;
        setNotesStore(store);
    }
    setCurrentNoteId(current);
}

function populateNotesSelect() {
    const sel = document.getElementById('notes-select');
    if (!sel) return;
    const store = getNotesStore();
    const current = getCurrentNoteId();
    sel.innerHTML = '';
    Object.values(store.notes).forEach(n => {
        const opt = document.createElement('option');
        opt.value = n.id; opt.textContent = n.title || 'Untitled';
        if (n.id === current) opt.selected = true;
        sel.appendChild(opt);
    });
}

function currentNote() { const store = getNotesStore(); const id = getCurrentNoteId(); return store.notes[id] || null; }

function savePersonalNotes() {
    try {
        const ta = document.getElementById('personal-notes');
        if (!ta) return;
        const store = getNotesStore();
        const id = getCurrentNoteId();
        if (!id) return;
        const note = store.notes[id] || { id, title: 'My Note', content: '' };
        note.content = ta.value || '';
        note.updatedAt = Date.now();
        store.notes[id] = note;
        setNotesStore(store);
        // Update status and reflect possibly updated labels
        const s = document.getElementById('notes-status');
        if (s) s.textContent = 'Saved at ' + new Date(note.updatedAt).toLocaleTimeString();
        populateNotesSelect();
    } catch {}
}

function loadPersonalNotes() {
    try {
        const ta = document.getElementById('personal-notes');
        if (!ta) return;
        const note = currentNote();
        ta.value = (note && note.content) || '';
        const s = document.getElementById('notes-status');
        if (s) s.textContent = note && note.updatedAt ? ('Saved at ' + new Date(note.updatedAt).toLocaleTimeString()) : 'Saved';
        populateNotesSelect();
    } catch {}
}

function createNewNote() {
    const store = getNotesStore();
    const id = genNoteId();
    // Generate a friendly title
    const count = Object.keys(store.notes).length + 1;
    const title = 'Untitled ' + count;
    store.notes[id] = { id, title, content: '', updatedAt: Date.now() };
    setNotesStore(store);
    return id;
}

function renameCurrentNote(newTitle) {
    if (!newTitle) return;
    const store = getNotesStore();
    const id = getCurrentNoteId();
    if (!id || !store.notes[id]) return;
    store.notes[id].title = newTitle;
    store.notes[id].updatedAt = Date.now();
    setNotesStore(store);
    populateNotesSelect();
}

function deleteCurrentNote() {
    const store = getNotesStore();
    const id = getCurrentNoteId();
    if (!id || !store.notes[id]) return;
    delete store.notes[id];
    let nextId = Object.keys(store.notes)[0];
    if (!nextId) { nextId = createNewNote(); }
    setNotesStore(store);
    setCurrentNoteId(nextId);
}

function exportCurrentNote() {
    try {
        const n = currentNote();
        if (!n) return;
        // Prefer native Save As via preload
        if (window.zeek && typeof window.zeek.saveAsNote === 'function') {
            window.zeek.saveAsNote({ content: n.content || '', filename: (n.title || 'note') + '.txt' })
                .then((res) => {
                    if (res && res.ok && res.path) { try { toast('Saved to ' + res.path, 'success'); } catch {} }
                    else if (res && res.canceled) { try { toast('Save canceled'); } catch {} }
                    else { try { toast('Save failed', 'error'); } catch {} }
                })
                .catch(() => { try { toast('Save failed', 'error'); } catch {} });
            return;
        }
        // Fallback to browser download if preload unavailable
        const blob = new Blob([n.content || ''], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const base = (n.title || 'note').replace(/[^a-z0-9-_\. ]/gi, '_');
        a.href = url; a.download = base + '.txt';
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {}
}

// New: Personal
function renderPersonal() {
    const app = document.getElementById('app');
    app.innerHTML = `
        ${buildSidebar('/personal')}
        <div class="main-content">
            <h1>Personal</h1>
            <div class="feature-card">
                <h3>My Notes</h3>
                <div style="display:flex;gap:8px;align-items:center;margin:6px 0;flex-wrap:wrap">
                    <label for="notes-select" style="font-size:12px;color:var(--muted-text)">Note</label>
                    <select id="notes-select" style="background:var(--card-bg);color:var(--text-color);border:1px solid var(--border-color);border-radius:6px;padding:4px 6px;min-width:180px"></select>
                    <button class="new-btn notes-new-btn" title="Create new note">New</button>
                    <button class="new-btn notes-rename-btn" title="Rename note" style="background:#37474f">Rename</button>
                    <button class="new-btn notes-delete-btn" title="Delete note" style="background:#b71c1c">Delete</button>
                    <button class="new-btn notes-upload-btn" title="Upload text into note" style="background:#455a64">Upload</button>
                    <button class="new-btn notes-save-btn" title="Save notes">Save</button>
                    <span id="notes-status" style="font-size:12px;color:var(--muted-text)">Saved</span>
                    <span id="ipc-status" style="font-size:11px;color:#90a4ae;border:1px solid var(--border-color);border-radius:999px;padding:2px 6px">IPC?</span>
                </div>
                <textarea id="personal-notes" rows="12" style="width:100%;resize:vertical;background:var(--card-bg);color:var(--text-color);border:1px solid var(--border-color);border-radius:8px;padding:10px;line-height:1.5" placeholder="Write anything…"></textarea>
                <input type="file" id="notes-upload-input" accept=".txt,.md,.markdown,.csv,.json" style="display:none" />
            </div>
        </div>
    `;
    // Initialize store and UI
    try { ensureNotesStore(); populateNotesSelect(); loadPersonalNotes(); } catch {}
    const notesInput = document.getElementById('personal-notes');
    const notesSaveBtn = document.querySelector('.notes-save-btn');
    const notesNewBtn = document.querySelector('.notes-new-btn');
    const notesRenameBtn = document.querySelector('.notes-rename-btn');
    const notesDeleteBtn = document.querySelector('.notes-delete-btn');
    const notesUploadBtn = document.querySelector('.notes-upload-btn');
    const notesUploadInput = document.getElementById('notes-upload-input');
    const notesSelect = document.getElementById('notes-select');
    const notesStatus = document.getElementById('notes-status');
    const saveNotesDebounced = debounce(savePersonalNotes, 400);
    // Initialize IPC status chip
    try {
        const chip = document.getElementById('ipc-status');
        const ok = !!(window.zeek && typeof window.zeek.saveAsNote === 'function');
        if (chip) {
            chip.textContent = ok ? 'IPC OK' : 'IPC off';
            chip.style.color = ok ? '#2e7d32' : '#ef5350';
            chip.title = ok ? 'Native Save As available' : 'Native Save As unavailable';
        }
    } catch {}
    if (notesInput) notesInput.addEventListener('input', () => {
        if (notesStatus) notesStatus.textContent = 'Saving…';
        saveNotesDebounced();
    });
    if (notesSaveBtn) notesSaveBtn.addEventListener('click', () => {
        savePersonalNotes();
        if (notesStatus) notesStatus.textContent = 'Saved';
    });
    if (notesNewBtn) notesNewBtn.addEventListener('click', () => {
        const id = createNewNote();
        setCurrentNoteId(id);
        populateNotesSelect();
        loadPersonalNotes();
        if (notesStatus) notesStatus.textContent = 'Saved';
    });
    if (notesRenameBtn) notesRenameBtn.addEventListener('click', () => {
        const n = currentNote();
        const next = prompt('Rename note', (n && n.title) || 'Untitled');
        if (next && next.trim()) { renameCurrentNote(next.trim()); }
    });
    if (notesDeleteBtn) notesDeleteBtn.addEventListener('click', () => {
        const n = currentNote();
        if (!n) return;
        if (confirm(`Delete note "${n.title || 'Untitled'}"? This cannot be undone.`)) {
            deleteCurrentNote();
            populateNotesSelect();
            loadPersonalNotes();
        }
    });
    if (notesSelect) notesSelect.addEventListener('change', () => {
        // Save current before switching
        savePersonalNotes();
        const id = notesSelect.value;
        setCurrentNoteId(id);
        loadPersonalNotes();
        if (notesStatus) notesStatus.textContent = 'Saved';
    });
    if (notesUploadBtn && notesUploadInput) {
        notesUploadBtn.addEventListener('click', () => notesUploadInput.click());
        notesUploadInput.addEventListener('change', async () => {
            const files = Array.from(notesUploadInput.files || []);
            if (!files.length || !notesInput) return;
            for (const f of files) {
                try {
                    const text = await f.text();
                    notesInput.value += (notesInput.value ? "\n\n" : "") + text;
                } catch {}
            }
            savePersonalNotes();
            if (notesStatus) notesStatus.textContent = 'Saved';
            notesUploadInput.value = '';
        });
    }
    // Drag & drop support on textarea
    if (notesInput) {
        const prevent = (e) => { e.preventDefault(); e.stopPropagation(); };
        ['dragenter','dragover','dragleave','drop'].forEach(ev => notesInput.addEventListener(ev, prevent));
        notesInput.addEventListener('drop', async (e) => {
            const dt = e.dataTransfer;
            if (!dt || !dt.files || !dt.files.length) return;
            for (const f of Array.from(dt.files)) {
                try {
                    const text = await f.text();
                    notesInput.value += (notesInput.value ? "\n\n" : "") + text;
                } catch {}
            }
            savePersonalNotes();
            if (notesStatus) notesStatus.textContent = 'Saved';
        });
    }
    // Autosave on route changes and when the window is about to close
    window.addEventListener('hashchange', savePersonalNotes);
    window.addEventListener('beforeunload', savePersonalNotes);
    document.addEventListener('visibilitychange', () => { if (document.hidden) savePersonalNotes(); });
}

// New: Split Chats view (two panes)
function renderSplitChats() {
    const app = document.getElementById('app');
    // ... (rest of the code remains the same)
    app.innerHTML = `
        ${buildSidebar('/split-chats')}
        <div class="main-content">
            <h1>Split Chats</h1>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
                <div class="feature-card"><h3>Chat A</h3><p>Left conversation (UI stub).</p></div>
                <div class="feature-card"><h3>Chat B</h3><p>Right conversation (UI stub).</p></div>
            </div>
        </div>
    `;
}
document.addEventListener('DOMContentLoaded', () => {
    const app = document.getElementById('app');

    const routes = {
        '/': renderDashboard,
        '/features': renderFeatures,
        // Route legacy/consolidated path to the Online Model Hub for consistency
        '/model-hub': renderModelHubOnline,
        // Back-compat routes
        '/model-hub-local': renderModelHubLocal,
        '/model-hub-online': renderModelHubOnline,
        // New sections aligned with Studio
        '/personas': renderPersonas,
        '/personal': renderPersonal,
        '/split-chats': renderSplitChats,
        '/prompts': renderPrompts,
        '/toolbox': renderToolbox,
        '/knowledge-stacks': renderKnowledge,
        '/workflows': renderWorkflows,
        '/playground': renderPlayground,
        '/settings': renderSettings,
        '/profile': renderProfile,
        '/notifications': renderNotifications,
        '/support': renderSupport
    };

    function router() {
        const path = window.location.hash.slice(1) || '/';
        try { console.debug('[router] path =', path); } catch {}
        // Hard redirect legacy path to the online page so URL updates visibly
        if (path === '/model-hub') {
            window.location.hash = '/model-hub-online';
            return; // wait for next hashchange
        }
        const handler = routes[path];
        try { console.debug('[router] handler fn =', typeof handler); } catch {}
        if (typeof handler === 'function') {
            try {
                handler();
            } catch (err) {
                console.error('[router] handler error', err);
                // Fallback to dashboard if a handler throws
                if (typeof window.renderDashboard === 'function') {
                    window.renderDashboard();
                }
            }
            setActiveNav();
            addEventListeners();
            // Update connection status lights after render
            updateStatusLights();
            // Periodic refresh (every 30s)
            if (window.__statusTimer) clearInterval(window.__statusTimer);
            window.__statusTimer = setInterval(updateStatusLights, 30000);
        } else {
            // Unknown route: fallback
            if (typeof window.renderDashboard === 'function') {
                window.renderDashboard();
                setActiveNav();
                addEventListeners();
            } else {
                app.innerHTML = '<h1>Page Not Found</h1>';
            }
        }
    }

    function setActiveNav() {
        // Highlight the active nav item based on current hash
        const current = window.location.hash || '#/';
        document.querySelectorAll('.sidebar-nav a').forEach(a => {
            if (!a || !a.getAttribute) return;
            const href = a.getAttribute('href');
            if (href === current) {
                a.classList.add('active');
            } else {
                a.classList.remove('active');
            }
        });

        // Autosave whenever inputs in the provider drawer change
        const onAutoSave = (ev) => {
            const target = ev.target;
            if (!target || !target.closest) return;
            const card = target.closest('#provider-config-drawer .config-card');
            if (!card) return;
            const name = card.getAttribute('data-provider') || 'Provider';
            try { saveProviderConfig(name, card); } catch {}
        };
        app.addEventListener('input', onAutoSave);
        app.addEventListener('change', onAutoSave);
    }

    function addEventListeners() {
        // Bind once per app lifetime to avoid duplicate handlers across renders
        if (window.__listenersBound) return;
        window.__listenersBound = true;
        // Use event delegation
        app.addEventListener('click', (e) => {
            // Sidebar navigation: handle all in-app links
            const navA = e.target.closest && e.target.closest('.sidebar-nav a[href^="#/"]');
            if (navA) {
                e.preventDefault();
                const href = navA.getAttribute('href');
                if (href) {
                    // Autosave notes before navigating away
                    try { savePersonalNotes(); } catch {}
                    if (window.location.hash !== href) {
                        window.location.hash = href;
                    }
                    // Direct-invoke handler as a resilient fallback
                    try {
                        const path = href.slice(1);
                        const handler = routes && routes[path];
                        if (typeof handler === 'function') {
                            handler();
                            setActiveNav();
                            addEventListeners();
                        } else {
                            router();
                        }
                    } catch {
                        router();
                    }
                }
                return;
            }

            // Personal Notes: global delegation for reliability
            const notesSave = e.target.closest && e.target.closest('.notes-save-btn');
            if (notesSave) {
                e.preventDefault();
                try {
                    // Always persist locally first
                    savePersonalNotes();
                    // If native Save As is available, prompt user where to save
                    const ta = document.getElementById('personal-notes');
                    const note = (typeof currentNote === 'function') ? currentNote() : null;
                    const title = (note && note.title) ? note.title : 'note';
                    const content = ta && ta.value ? ta.value : (note && note.content) || '';
                    if (window.zeek && typeof window.zeek.saveAsNote === 'function') {
                        window.zeek.saveAsNote({ content, filename: title + '.txt' }).then((res) => {
                            if (res && res.ok && res.path) {
                                try { toast('Saved to ' + res.path, 'success'); } catch {}
                            } else if (res && res.canceled) {
                                try { toast('Save canceled'); } catch {}
                            } else {
                                try { toast('Save failed', 'error'); } catch {}
                            }
                        }).catch(() => { try { toast('Save failed', 'error'); } catch {} });
                    } else {
                        // Fallback: perform quick Export download if native Save As is unavailable
                        try { exportCurrentNote(); } catch { try { toast('Save failed', 'error'); } catch {} }
                    }
                } catch {}
                return;
            }
            const notesNew = e.target.closest && e.target.closest('.notes-new-btn');
            if (notesNew) { e.preventDefault(); try { const id = createNewNote(); setCurrentNoteId(id); populateNotesSelect(); loadPersonalNotes(); } catch {}; return; }
            const notesRename = e.target.closest && e.target.closest('.notes-rename-btn');
            if (notesRename) { e.preventDefault(); try { const n = currentNote(); const next = prompt('Rename note', (n && n.title) || 'Untitled'); if (next && next.trim()) renameCurrentNote(next.trim()); } catch {}; return; }
            const notesDelete = e.target.closest && e.target.closest('.notes-delete-btn');
            if (notesDelete) { e.preventDefault(); try { const n = currentNote(); if (n && confirm(`Delete note "${n.title || 'Untitled'}"? This cannot be undone.`)) { deleteCurrentNote(); populateNotesSelect(); loadPersonalNotes(); } } catch {}; return; }
            const notesUpload = e.target.closest && e.target.closest('.notes-upload-btn');
            if (notesUpload) { e.preventDefault(); const up = document.getElementById('notes-upload-input'); if (up) up.click(); return; }
            // Normalize any legacy Model Hub links to the online page
            const legacyModelHub = e.target.closest('a[href="#/model-hub"]');
            if (legacyModelHub) {
                e.preventDefault();
                window.location.hash = '/model-hub-online';
                return;
            }

            // Conversations: provider selector buttons
            const pick = e.target.closest('.provider-pick');
            if (pick) {
                const name = pick.getAttribute('data-provider') || 'Ollama';
                window.__chatProvider = name;
                localStorage.setItem('chat:provider', name);
                // Visual selection
                document.querySelectorAll('.provider-pick').forEach(btn => {
                    btn.classList.remove('selected');
                    btn.style.outline = 'none';
                });
                pick.classList.add('selected');
                pick.style.outline = '2px solid #42a5f5';
                toast(`Chat provider: ${name}`, 'success');
                return;
            }

            // Composer toolbar: Attach
            if (e.target.closest('.btn-attach')) {
                let fi = document.getElementById('chat-file-input');
                if (!fi) {
                    fi = document.createElement('input');
                    fi.type = 'file'; fi.id = 'chat-file-input'; fi.multiple = true; fi.style.display = 'none';
                    document.body.appendChild(fi);
                    fi.addEventListener('change', () => {
                        const files = Array.from(fi.files || []);
                        window.__chatFiles = files;
                        toast(files.length ? `Attached ${files.length} file(s)` : 'No files selected');
                    });
                }
                fi.click();
                return;
            }

            // Composer toolbar: Mic toggle (stub)
            if (e.target.closest('.btn-mic')) {
                window.__micOn = !window.__micOn;
                toast(window.__micOn ? 'Voice input: ON' : 'Voice input: OFF');
                return;
            }

            // Composer toolbar: Prompts Library
            if (e.target.closest('.btn-prompt')) {
                window.location.hash = '/prompts';
                return;
            }

            // Composer toolbar: Knowledge Context
            if (e.target.closest('.btn-context')) {
                window.location.hash = '/knowledge-stacks';
                return;
            }

            // Composer toolbar: Model picker popover (models for selected provider)
            const modelBtn = e.target.closest('.btn-model');
            if (modelBtn) { openModelSelector(modelBtn); return; }

            // Model popover picking (model item)
            const pickModel = e.target.closest('#model-popover .pick-model');
            if (pickModel) {
                // Prefer provider selected in the popover switcher
                const sw = document.querySelector('#model-popover #provider-switch');
                const provider = (sw && sw.value) || window.__chatProvider || localStorage.getItem('chat:provider') || 'Ollama';
                const modelName = pickModel.getAttribute('data-name') || '';
                if (modelName) {
                    localStorage.setItem(`chat:model:${provider}`, modelName);
                    // Persist provider selection together with model pick
                    window.__chatProvider = provider;
                    localStorage.setItem('chat:provider', provider);
                    toast(`Model selected: ${modelName}`, 'success');
                    updateModelBadge();
                }
                document.getElementById('model-popover')?.remove();
                return;
            }

            // Model Hub - Online: Configure button should also load saved config
            const cfgBtn = e.target.closest('.config-btn');
            if (cfgBtn) {
                let name = cfgBtn.getAttribute('data-name') || cfgBtn.textContent || 'Provider';
                // Normalize LM Studio into a single Ollama config entry
                try {
                    if (getProviderKind(name) === 'ollama' && /lm studio|lmstudio/i.test(name)) {
                        name = 'Ollama';
                    }
                } catch {}
                const drawer = document.getElementById('provider-config-drawer');
                if (drawer) {
                    drawer.innerHTML = buildProviderConfig(name);
                    loadProviderConfig(name);
                    // Defensive: If this is Google/Gemini, ensure no Base URL field remains visible
                    try {
                        if (getProviderKind(name) === 'gemini') {
                            const baseRow = drawer.querySelector('#cfg-base-url')?.closest('.form-row');
                            if (baseRow) baseRow.remove();
                        }
                    } catch {}
                    drawer.style.display = 'block';
                    drawer.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    toast(`${name} configuration ready`, 'success');
                } else {
                    openGlobalModal(`${name} Configuration`, buildProviderConfig(name));
                }
                return;
            }

            // Inline Provider Config: Save/Test/Load handlers
            const saveBtn = e.target.closest('.save-config-btn');
            if (saveBtn) {
                const card = saveBtn.closest('.config-card') || document;
                const name = card.getAttribute('data-provider') || 'Provider';
                try {
                    saveProviderConfig(name, card);
                    toast('Saved configuration', 'success');
                } catch (err) {
                    console.error('Save config error', err);
                    toast('Failed to save configuration', 'error');
                }
                return;
            }

            const testBtn = e.target.closest('.test-conn-btn');
            if (testBtn) {
                const card = testBtn.closest('.config-card') || document;
                const name = (card.getAttribute('data-provider') || '').trim();
                const results = card.querySelector('#cfg-results');
                const apiKey = (card.querySelector('#cfg-api-key')?.value || '').trim();
                const baseUrl = (card.querySelector('#cfg-base-url')?.value || '').trim().replace(/\/$/, '');
                (async () => {
                    try {
                        // Normalize provider kind to avoid regex mismatches
                        const n = name.toLowerCase();
                        const kind = (
                            /ollama|lm studio|lmstudio/.test(n) ? 'ollama' :
                            /(google|gemini)/.test(n) ? 'gemini' :
                            /openrouter/.test(n) ? 'openrouter' :
                            /azure/.test(n) ? 'azure' :
                            /anthropic/.test(n) ? 'anthropic' :
                            /mistral/.test(n) ? 'mistral' :
                            /groq/.test(n) ? 'groq' :
                            /cohere/.test(n) ? 'cohere' :
                            /openai/.test(n) ? 'openai' : 'unknown'
                        );
                        let res, json, ok = false, msg = '';
                        if (kind === 'ollama') {
                            if (!baseUrl) throw new Error('Base URL required');
                            // Pure proxy approach (avoid browser→Ollama direct calls to prevent CORS)
                            let diag = [];
                            res = await fetchWithTimeout(`/api/ollama/version?base=${encodeURIComponent(baseUrl)}`, { timeout: 10000 });
                            if (res.ok) {
                                const v = await res.json().catch(() => ({}));
                                ok = true; msg = `OK • ${v?.version || 'Ollama'}`; diag.push('version: OK');
                            } else {
                                diag.push(`version: HTTP ${res.status}`);
                                // Try listing tags via proxy to infer connectivity
                                try {
                                    const resTags = await fetchWithTimeout(`/api/ollama/tags?base=${encodeURIComponent(baseUrl)}`, { timeout: 10000 });
                                    if (resTags.ok) {
                                        const j = await resTags.json();
                                        const count = Array.isArray(j?.models) ? j.models.length : (Array.isArray(j?.tags) ? j.tags.length : 0);
                                        ok = true; msg = `OK • ${count} models`; diag.push('tags: OK');
                                    } else {
                                        ok = false; msg = `HTTP ${res.status}`; diag.push(`tags: HTTP ${resTags.status}`);
                                    }
                                } catch (e) {
                                    ok = false; msg = `HTTP ${res.status}`; diag.push('tags: error');
                                }
                            }
                            if (results && diag.length) {
                                const html = `<div style="margin-top:6px;color:var(--muted-text)">Diagnostics: ${diag.join(' | ')}</div>`;
                                results.insertAdjacentHTML('beforeend', html);
                            }
                        }
 else if (kind === 'gemini') {
                            if (!apiKey) throw new Error('API Key required');
                            const model = (card.querySelector('#cfg-default-model')?.value || 'gemini-1.5-flash-latest').trim().replace(/^models\//,'');
                            res = await fetchWithTimeout('/api/googleai/generate', {
                                method: 'POST', headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ apiKey, model, prompt: 'ping' }), timeout: 12000
                            });
                            ok = res.ok; json = ok ? await res.json() : null; msg = ok ? `OK • generateContent` : `HTTP ${res.status}`;
                            if (ok) { window.__chatProvider = 'Google AI'; localStorage.setItem('chat:provider','Google AI'); updateModelBadge(); }
                        } else if (kind === 'openrouter') {
                            if (!apiKey) throw new Error('API Key required');
                            res = await fetchWithTimeout(`/api/openrouter/models?apiKey=${encodeURIComponent(apiKey)}`, { timeout: 12000 });
                            ok = res.ok; json = ok ? await res.json() : null; msg = ok ? `OK • ${json?.models?.length || 0} models` : `HTTP ${res.status}`;
                            if (ok) { window.__chatProvider = 'OpenRouter'; localStorage.setItem('chat:provider','OpenRouter'); updateModelBadge(); }
                        } else if (kind === 'openai') {
                            if (!apiKey) throw new Error('API Key required');
                            const model = (card.querySelector('#cfg-default-model')?.value || 'gpt-4o-mini').trim();
                            res = await fetchWithTimeout('/api/chat', {
                                method: 'POST', headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ provider: 'openai', apiKey, model, prompt: 'ping' }), timeout: 12000
                            });
                            ok = res.ok; msg = ok ? 'OK • chat' : `HTTP ${res.status}`;
                            if (ok) { window.__chatProvider = 'OpenAI'; localStorage.setItem('chat:provider','OpenAI'); updateModelBadge(); }
                        } else if (kind === 'anthropic') {
                            if (!apiKey) throw new Error('API Key required');
                            const model = (card.querySelector('#cfg-default-model')?.value || 'claude-3-5-sonnet-latest').trim();
                            res = await fetchWithTimeout('/api/chat', {
                                method: 'POST', headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ provider: 'anthropic', apiKey, model, prompt: 'ping' }), timeout: 12000
                            });
                            ok = res.ok; msg = ok ? 'OK • chat' : `HTTP ${res.status}`;
                            if (ok) { window.__chatProvider = 'Anthropic'; localStorage.setItem('chat:provider','Anthropic'); updateModelBadge(); }
                        } else if (kind === 'mistral') {
                            if (!apiKey) throw new Error('API Key required');
                            const model = (card.querySelector('#cfg-default-model')?.value || 'mistral-large-latest').trim();
                            res = await fetchWithTimeout('/api/chat', {
                                method: 'POST', headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ provider: 'mistral', apiKey, model, prompt: 'ping' }), timeout: 12000
                            });
                            ok = res.ok; msg = ok ? 'OK • chat' : `HTTP ${res.status}`;
                            if (ok) { window.__chatProvider = 'Mistral'; localStorage.setItem('chat:provider','Mistral'); updateModelBadge(); }
                        } else if (kind === 'groq') {
                            if (!apiKey) throw new Error('API Key required');
                            const model = (card.querySelector('#cfg-default-model')?.value || 'llama-3.1-70b-versatile').trim();
                            res = await fetchWithTimeout('/api/chat', {
                                method: 'POST', headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ provider: 'groq', apiKey, model, prompt: 'ping' }), timeout: 12000
                            });
                            ok = res.ok; msg = ok ? 'OK • chat' : `HTTP ${res.status}`;
                            if (ok) { window.__chatProvider = 'Groq'; localStorage.setItem('chat:provider','Groq'); updateModelBadge(); }
                        } else if (kind === 'cohere') {
                            if (!apiKey) throw new Error('API Key required');
                            const model = (card.querySelector('#cfg-default-model')?.value || 'command-r-plus').trim();
                            res = await fetchWithTimeout('/api/chat', {
                                method: 'POST', headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ provider: 'cohere', apiKey, model, prompt: 'ping' }), timeout: 12000
                            });
                            ok = res.ok; msg = ok ? 'OK • chat' : `HTTP ${res.status}`;
                            if (ok) { window.__chatProvider = 'Cohere'; localStorage.setItem('chat:provider','Cohere'); updateModelBadge(); }
                        } else if (kind === 'azure') {
                            const endpoint = (card.querySelector('#cfg-base-url')?.value || '').trim().replace(/\/$/, '');
                            const apiVersion = (card.querySelector('#cfg-api-version')?.value || '2025-03-01-preview').trim();
                            const deployment = (card.querySelector('#cfg-default-model')?.value || '').trim();
                            if (!endpoint || !apiKey || !deployment) throw new Error('Endpoint, API Key, and Deployment required');
                            res = await fetchWithTimeout('/api/chat', {
                                method: 'POST', headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ provider: 'azure_openai', model: deployment, prompt: 'ping', azure: { endpoint, apiKey, apiVersion } }), timeout: 12000
                            });
                            ok = res.ok; msg = ok ? 'OK • chat' : `HTTP ${res.status}`;
                            if (ok) { window.__chatProvider = 'Azure OpenAI'; localStorage.setItem('chat:provider','Azure OpenAI'); updateModelBadge(); }
                        } else {
                            throw new Error('Test not implemented for this provider');
                        }
                        if (results) results.textContent = ok ? msg : `Failed • ${msg}`;
                        toast(ok ? 'Connection OK' : 'Connection failed', ok ? 'success' : 'error');
                    } catch (err) {
                        console.error('Test connection error', err);
                        if (results) results.textContent = `Failed • ${err?.message || 'Error'}`;
                        toast(`Test failed: ${err?.message || 'Error'}`, 'error');
                    }
                })();
                return;
            }

            const loadGoogleBtn = e.target.closest('.load-google-models-btn');
            if (loadGoogleBtn) {
                const card = loadGoogleBtn.closest('.config-card') || document;
                const results = card.querySelector('#cfg-results');
                const apiKey = (card.querySelector('#cfg-api-key')?.value || '').trim();
                if (!apiKey) { toast('Enter an API Key first', 'error'); return; }
                (async () => {
                    try {
                        const res = await fetchWithTimeout(`/api/googleai/models?apiKey=${encodeURIComponent(apiKey)}`, { timeout: 12000 });
                        if (!res.ok) throw new Error(`HTTP ${res.status}`);
                        const json = await res.json();
                        const models = Array.isArray(json?.models) ? json.models.map(n => String(n).replace(/^models\//,'')) : [];
                        if (!models.length) {
                            results && (results.innerHTML = '<span>No models found for Google AI.</span>');
                            toast('No models found', 'warn');
                        } else {
                            const list = models.map(n => `<li>${n}</li>`).join('');
                            results && (results.innerHTML = `<div>Available Models:</div><ul>${list}</ul>`);
                            toast('Models loaded', 'success');
                        }
                    } catch (err) {
                        console.error('Load Google models failed:', err);
                        results && (results.textContent = `Load models failed: ${err && err.message ? err.message : 'Error'}`);
                        toast('Failed to load models', 'error');
                    }
                })();
                return;
            }

            // Autosave on input change within provider drawer
            if (e.target.matches('#provider-config-drawer input')) {
                const card = e.target.closest('.config-card');
                const name = card?.getAttribute('data-provider') || 'Provider';
                try { saveProviderConfig(name, card); } catch {}
                return;
            }

            const loadBtn = e.target.closest('.load-models-btn');
            if (loadBtn) {
                const card = loadBtn.closest('.config-card') || document;
                const baseUrlRaw = (card.querySelector('#cfg-base-url')?.value || '').trim();
                const results = card.querySelector('#cfg-results');
                const baseUrl = baseUrlRaw.replace(/\/$/, '');
                if (!baseUrl) { toast('Enter a Base URL first', 'error'); return; }
                (async () => {
                    try {
                        // Prefer backend proxy to avoid browser CORS
                        let res = await fetchWithTimeout(`/api/ollama/tags?base=${encodeURIComponent(baseUrl)}`, { timeout: 9000 });
                        if (!res.ok) {
                            res = await fetchWithTimeout(`${baseUrl}/api/tags`, { timeout: 8000 });
                        }
                        if (!res.ok) throw new Error(`HTTP ${res.status}`);
                        const json = await res.json();
                        const models = (json && json.models) ? json.models : [];
                        if (!models.length) {
                            results && (results.innerHTML = '<span>No models found on Ollama.</span>');
                            toast('No models found', 'warn');
                        } else {
                            const list = models.map(m => `<li>${m.name || m.tag || 'model'}</li>`).join('');
                            results && (results.innerHTML = `<div>Models:</div><ul>${list}</ul>`);
                            toast('Models loaded', 'success');
                        }
                    } catch (err) {
                        console.error('Load models failed:', err);
                        results && (results.textContent = `Load models failed: ${err && err.message ? err.message : 'Error'}`);
                        toast('Failed to load models', 'error');
                    }
                })();
                return;
            }

            // Conversations: send message
            const sendBtn = e.target.closest('.send-btn');
            if (sendBtn) {
                const panel = sendBtn.closest('.conversations-list') || document;
                const input = panel.querySelector('.composer-row input');
                const text = (input && input.value || '').trim();
                if (!text) { toast('Type a message first', 'error'); return; }
                // Append user message
                ensureChatThread(panel);
                appendChat(panel, 'user', text);
                if (input) input.value = '';
                // Choose provider: first use explicit selection, else fallback cascade
                const selected = window.__chatProvider || localStorage.getItem('chat:provider') || '';
                const pOllama = (() => { try { return JSON.parse(localStorage.getItem('provider:Ollama') || 'null'); } catch { return null; } })();
                const pGemini = (() => { try { return JSON.parse(localStorage.getItem('provider:Google AI') || 'null'); } catch { return null; } })();
                const pOpenRouter = (() => { try { return JSON.parse(localStorage.getItem('provider:OpenRouter') || 'null'); } catch { return null; } })();
                const chatModelOllama = localStorage.getItem('chat:model:Ollama') || (pOllama && (pOllama.defModel || pOllama.defaultModel)) || '';
                const chatModelGemini = localStorage.getItem('chat:model:Google AI') || (pGemini && (pGemini.defModel || pGemini.defaultModel)) || '';
                const chatModelOpenRouter = localStorage.getItem('chat:model:OpenRouter') || (pOpenRouter && (pOpenRouter.defModel || pOpenRouter.defaultModel)) || '';
                const selOllama = selected.toLowerCase().startsWith('ollama') && pOllama && pOllama.baseUrl && chatModelOllama;
                const selGemini = selected.toLowerCase().startsWith('google') && pGemini && pGemini.apiKey && chatModelGemini;
                const selOpenRouter = selected.toLowerCase().startsWith('openrouter') && pOpenRouter && pOpenRouter.apiKey && chatModelOpenRouter;

                let useOllama = false, useGemini = false, useOpenRouter = false;
                if (selOllama) useOllama = true;
                else if (selGemini) useGemini = true;
                else if (selOpenRouter) useOpenRouter = true;
                else {
                    // fallback cascade
                    useOllama = pOllama && pOllama.baseUrl && (pOllama.defModel || pOllama.defaultModel);
                    useGemini = !useOllama && pGemini && pGemini.apiKey && (pGemini.defModel || pGemini.defaultModel);
                    useOpenRouter = !useOllama && !useGemini && pOpenRouter && pOpenRouter.apiKey && (pOpenRouter.defModel || pOpenRouter.defaultModel);
                }

                // Validate selected provider to avoid 502s
                if (selected.toLowerCase().startsWith('ollama')) {
                    if (!(pOllama && pOllama.baseUrl)) { appendChat(panel, 'ai', 'Please set Ollama Base URL in Model Hub.'); return; }
                    if (!chatModelOllama) { appendChat(panel, 'ai', 'Please choose an Ollama model from the model selector.'); return; }
                } else if (selected.toLowerCase().startsWith('google')) {
                    if (!(pGemini && pGemini.apiKey)) { appendChat(panel, 'ai', 'Please set Google AI API Key in Model Hub.'); return; }
                    if (!chatModelGemini) { appendChat(panel, 'ai', 'Please choose a Gemini model from the model selector.'); return; }
                } else if (selected.toLowerCase().startsWith('openrouter')) {
                    if (!(pOpenRouter && pOpenRouter.apiKey)) { appendChat(panel, 'ai', 'Please set OpenRouter API Key in Model Hub.'); return; }
                    if (!chatModelOpenRouter) { appendChat(panel, 'ai', 'Please choose an OpenRouter model from the model selector.'); return; }
                } else if (!useOllama && !useGemini && !useOpenRouter) {
                    appendChat(panel, 'ai', 'Please configure a provider first in Model Hub.');
                    return;
                }
                // Call unified chat endpoint
                (async () => {
                    appendChat(panel, 'ai', '…'); // placeholder that we will replace
                    const thread = panel.querySelector('.chat-thread');
                    const pending = thread && thread.lastElementChild;
                    try {
                        let provider = 'ollama';
                        let payload = { provider: 'ollama', model: '', prompt: text };
                        if (useOllama) {
                            const base = pOllama.baseUrl.replace(/\/$/, '');
                            const model = chatModelOllama;
                            provider = 'ollama';
                            // Optional tuning
                            const tuning = {};
                            if (pOllama?.temperature) tuning.temperature = Number(pOllama.temperature);
                            if (pOllama?.maxTokens) tuning.maxTokens = Number(pOllama.maxTokens);
                            if (pOllama?.topP) tuning.topP = Number(pOllama.topP);
                            payload = { provider, model, prompt: text, base, ...tuning };
                        } else if (useGemini) {
                            const model = chatModelGemini;
                            const apiKey = pGemini.apiKey;
                            provider = 'googleai';
                            const tuning = {};
                            if (pGemini?.temperature) tuning.temperature = Number(pGemini.temperature);
                            if (pGemini?.maxTokens) tuning.maxTokens = Number(pGemini.maxTokens);
                            if (pGemini?.topP) tuning.topP = Number(pGemini.topP);
                            payload = { provider, model, prompt: text, apiKey, ...tuning };
                        } else {
                            const model = chatModelOpenRouter;
                            const apiKey = pOpenRouter.apiKey;
                            provider = 'openrouter';
                            const tuning = {};
                            if (pOpenRouter?.temperature) tuning.temperature = Number(pOpenRouter.temperature);
                            if (pOpenRouter?.maxTokens) tuning.maxTokens = Number(pOpenRouter.maxTokens);
                            if (pOpenRouter?.topP) tuning.topP = Number(pOpenRouter.topP);
                            payload = { provider, model, prompt: text, apiKey, ...tuning };
                        }
                        let json;
                        if (window.zeek && typeof window.zeek.chat === 'function') {
                            // Prefer IPC in Electron desktop mode
                            json = await window.zeek.chat(payload);
                        } else {
                            const res = await fetchWithTimeout('/api/chat', {
                                method: 'POST', headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify(payload), timeout: 60000
                            });
                            if (!res.ok) throw new Error(`HTTP ${res.status}`);
                            json = await res.json();
                        }
                        const reply = (json && (json.output || json.response || json.message || JSON.stringify(json))) || 'No response';
                        if (pending) pending.textContent = reply;
                        else appendChat(panel, 'ai', reply);
                    } catch (err) {
                        console.error('Chat send failed:', err);
                        if (pending) pending.textContent = `Error: ${err && err.message ? err.message : 'Failed to generate'}`;
                        else appendChat(panel, 'ai', 'Error: Failed to generate');
                    }
                })();
                return;
            }

            // Settings icon in user profile navigates to Settings
            if (e.target.matches('.user-profile i.material-icons') && e.target.textContent.trim() === 'settings') {
                window.location.hash = '/settings';
                return;
            }

            // Toggle user avatar dropdown menu
            if (e.target.closest('.user-info')) {
                const profile = e.target.closest('.user-profile');
                if (profile) {
                    let menu = profile.querySelector('.user-menu');
                    if (!menu) {
                        menu = document.createElement('div');
                        menu.className = 'user-menu';
                        menu.innerHTML = `
                            <a href="#/profile" data-action="profile"><i class="material-icons">account_circle</i><span>Profile</span></a>
                            <a href="#/notifications" data-action="notifications"><i class="material-icons">notifications</i><span>Notifications</span></a>
                            <a href="#/settings" data-action="settings"><i class="material-icons">settings</i><span>Settings</span></a>
                            <a href="#/support" data-action="support"><i class="material-icons">help_outline</i><span>Support</span></a>
                            <a href="#/logout" data-action="logout"><i class="material-icons">logout</i><span>Log out</span></a>
                        `;
                        profile.appendChild(menu);
                    }
                    menu.classList.toggle('open');
                    return;
                }
            }

            // Close user menu when clicking outside
            if (!e.target.closest('.user-profile')) {
                const open = document.querySelector('.user-menu.open');
                if (open) open.classList.remove('open');
            }
            // Knowledge Stacks (wire to modal stubs)
            if (e.target.matches('.delete-btn')) {
                document.querySelector('.modal-overlay').style.display = 'flex';
            }
            if (e.target.matches('.cancel-btn') || e.target.matches('.modal-overlay')) {
                document.querySelector('.modal-overlay').style.display = 'none';
            }
            if (e.target.matches('.confirm-delete-btn')) {
                console.log('Stack deleted');
                document.querySelector('.modal-overlay').style.display = 'none';
            }
            if (e.target.matches('.new-stack-btn')) openGlobalModal('New Stack', '<p>Name, description, visibility (UI stub).</p>');
            if (e.target.matches('.details-btn')) openGlobalModal('Stack Details', '<p>Processing progress, indexed docs (UI stub).</p>');
            if (e.target.matches('.add-source-btn')) openGlobalModal('Add Data Source', '<p>Choose File, URL, or Repo (UI stub).</p>');

            // RAG actions
            if (e.target.matches('.rag-upload-btn')) {
                (async () => {
                    try {
                        const json = await ragUpload();
                        toast('Upload started', 'success');
                        console.debug('rag.upload', json);
                    } catch (err) {
                        console.error(err);
                        toast('Upload failed', 'error');
                    }
                })();
                return;
            }
            if (e.target.matches('.rag-index-btn')) {
                (async () => {
                    try {
                        const json = await ragIndex();
                        toast('Indexing started', 'success');
                        console.debug('rag.index', json);
                    } catch (err) {
                        console.error(err);
                        toast('Indexing failed', 'error');
                    }
                })();
                return;
            }
            if (e.target.matches('.rag-search-btn')) {
                (async () => {
                    const input = document.getElementById('rag-search-q');
                    const container = document.querySelector('.rag-results');
                    try {
                        const json = await ragSearch(input ? input.value : '');
                        renderRagResults(container, json);
                        toast('Search complete', 'success');
                    } catch (err) {
                        console.error(err);
                        toast('Search failed', 'error');
                    }
                })();
                return;
            }

            // Model Hub - Local
            if (e.target.matches('.load-btn')) console.log('Load Model');
            if (e.target.matches('.unload-btn')) console.log('Unload Model');
            if (e.target.matches('.config-btn')) console.log('Configure Model');

            // Model Hub - Online: make Connect act like Configure (open inline drawer)
            if (e.target.matches('.connect-btn')) {
                const btn = e.target.closest('.connect-btn');
                const name = btn && (btn.getAttribute('data-name') || btn.textContent || 'Provider');
                const drawer = document.getElementById('provider-config-drawer');
                if (drawer) {
                    drawer.innerHTML = buildProviderConfig(name);
                    loadProviderConfig(name);
                    drawer.style.display = 'block';
                    drawer.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    toast(`${name} configuration ready`, 'success');
                } else {
                    openGlobalModal(`${name} Configuration`, buildProviderConfig(name));
                }
                return;
            }

            // Prompts Library (modal stubs)
            if (e.target.matches('.new-prompt-btn')) openGlobalModal('New Prompt', '<p>Title, tags, content (UI stub).</p>');
            if (e.target.matches('.prompt-buttons button')) {
                 if (e.target.textContent === 'Save') openGlobalModal('Save Prompt', '<p>Prompt saved (UI stub).</p>');
                 if (e.target.textContent === 'Edit') openGlobalModal('Edit Prompt', '<p>Edit prompt fields (UI stub).</p>');
                 if (e.target.textContent === 'Share') openGlobalModal('Share Prompt', '<p>Share link and permissions (UI stub).</p>');
            }

            // AI Playground
            if (e.target.matches('.compare-btn')) openGlobalModal('Compare Prompts', '<p>Select two prompt versions and view side-by-side (UI stub).</p>');
            if (e.target.matches('.share-btn')) openGlobalModal('Share Session', '<p>Shareable link and access (UI stub).</p>');
            if (e.target.matches('.reset-btn')) openGlobalModal('Reset Playground', '<p>Reset parameters and prompt (UI stub).</p>');
            if (e.target.matches('.close-tutorial-btn')) {
                document.querySelector('.tutorial-overlay').style.display = 'none';
            }
            if (e.target.matches('.open-tutorial-btn')) {
                document.querySelector('.tutorial-overlay').style.display = 'block';
            }

            // Chat toolbar actions (stubs)
            if (e.target.closest('.chat-toolbar')) {
                if (e.target.closest('.btn-attach')) openGlobalModal('Attach file', '<p>Choose a file to attach (UI stub).</p>');
                if (e.target.closest('.btn-mic')) openGlobalModal('Use Microphone', '<p>Start/stop microphone capture (UI stub).</p>');
                if (e.target.closest('.btn-prompt')) openGlobalModal('Select Prompt', '<p>Pick a saved prompt (UI stub).</p>');
                if (e.target.closest('.btn-model')) openGlobalModal('Select Model', '<p>Pick a model (UI stub).</p>');
                if (e.target.closest('.btn-context')) openGlobalModal('Add Context', '<p>Add a live context source (UI stub).</p>');
            }

            // Model Hub actions
            if (e.target.closest('.create-engine-btn')) {
                openGlobalModal('Create Engine', '<p>Choose a provider to create a new engine (UI stub).</p>');
            }
            // Prefer inline config drawer for Configure buttons in Model Hub pages
            const configBtn = e.target.closest('.config-btn');
            if (configBtn) {
                const name = configBtn.getAttribute('data-name') || (configBtn.closest('[data-name]')?.getAttribute('data-name')) || 'Provider';
                const drawer = document.getElementById('provider-config-drawer');
                if (drawer) {
                    drawer.innerHTML = buildProviderConfig(name);
                    drawer.style.display = 'block';
                    drawer.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    toast(`${name} configuration ready`, 'success');
                } else {
                    // Fallback to modal if drawer not present
                    openGlobalModal(name + ' Configuration', `<p>Inline drawer not available on this page.</p>`);
                }
                return;
            }

            const providerBtn = e.target.closest('.provider-btn, .provider-item');
            if (providerBtn) {
                const name = providerBtn.getAttribute('data-name') || 'Provider';
                openGlobalModal(name, `<p>Connect to <strong>${name}</strong> (UI stub).</p>`);
            }
        });

        // Chat: Enter to send (Shift+Enter for newline)
        app.addEventListener('keydown', (e) => {
            const input = e.target && e.target.matches && e.target.matches('.composer-row input[type="text"]') ? e.target : null;
            if (!input) return;
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                const btn = input.closest('.composer-row')?.querySelector('.send-btn');
                handleSend(btn || input.closest('.composer-row'));
            }
        });

        // Editor shortcuts: Ctrl+S / Ctrl+E on Personal page
        document.addEventListener('keydown', (e) => {
            const hash = window.location.hash || '#/';
            if (hash !== '#/personal') return;
            if (!e.ctrlKey && !e.metaKey) return;
            if (e.key.toLowerCase() === 's') {
                e.preventDefault();
                try {
                    // trigger same as Save button
                    const btn = document.querySelector('.notes-save-btn');
                    if (btn) btn.dispatchEvent(new Event('click', { bubbles: true }));
                } catch {}
            }
            // Reserved: additional shortcuts can be added here
        });
    }

    // Simple global modal utilities (reused across actions)
    function ensureGlobalModal() {
        if (!document.getElementById('global-modal')) {
            const el = document.createElement('div');
            el.id = 'global-modal';
            el.className = 'global-modal';
            el.innerHTML = '<div class="modal"><div class="modal-header"><h3></h3><button class="modal-close" aria-label="Close">\u00D7</button></div><div class="modal-body"></div></div>';
            document.body.appendChild(el);
            el.addEventListener('click', (ev) => {
                if (ev.target === el || ev.target.matches('.modal-close')) closeGlobalModal();
            });
        }
    }
    function openGlobalModal(title, html) {
        ensureGlobalModal();
        const el = document.getElementById('global-modal');
        el.querySelector('.modal-header h3').textContent = title;
        el.querySelector('.modal-body').innerHTML = html;
        el.style.display = 'flex';
    }
    function closeGlobalModal() {
        const el = document.getElementById('global-modal');
        if (el) el.style.display = 'none';
    }

    window.addEventListener('hashchange', router);
    router(); // Initial call

    // Global link delegation for hash routes (ensure navigation always fires)
    const navHandler = (ev) => {
        const a = ev.target && ev.target.closest ? ev.target.closest('a[href^="#/"]') : null;
        if (!a) return;
        const href = a.getAttribute('href');
        if (!href) return;
        ev.preventDefault();
        try { console.debug('[nav] click ->', href); } catch {}
        // Use full hash string for accurate comparison and assignment
        if (window.location.hash !== href) {
            window.location.hash = href;
            try { console.debug('[nav] set hash ->', window.location.hash); } catch {}
        } else {
            // Same route; force re-render
            try { console.debug('[nav] same hash, forcing router'); } catch {}
            router();
        }
    };
    // Capture-phase to beat any stopPropagation on bubble
    document.addEventListener('click', navHandler, true);
    window.addEventListener('click', navHandler, true);
    // Bubble-phase as fallback
    document.addEventListener('click', navHandler, false);
});

// --- Helpers for API calls ---
async function fetchJson(url) {
    try {
        const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json();
    } catch (err) {
        console.error('fetchJson error:', err);
        return null;
    }
}

async function getOnlineProviders() {
    const defaultProviders = [
        { provider: 'Ollama', pricing: 'Local engine for running OSS models.' },
        { provider: 'LM Studio', pricing: 'Local GUI for OSS models.' },
        { provider: 'OpenAI', pricing: 'GPT-4o, o3-mini — reliable text+vision. From $0.007 / 1K in.' },
        { provider: 'Anthropic', pricing: 'Claude 3 family — helpful & safe. Competitive pricing.' },
        { provider: 'Google AI', pricing: 'Gemini 2.0 Flash & Pro — strong multimodal.' },
        { provider: 'Meta', pricing: 'Llama family — performant OSS models.' },
        { provider: 'Mistral', pricing: 'Fast, cost-effective models.' },
        { provider: 'Azure', pricing: 'Azure OpenAI and AI Services.' },
        { provider: 'DeepSeek', pricing: 'Strong reasoning models at low cost.' },
        { provider: 'xAI', pricing: 'Grok models.' },
        { provider: 'OpenRouter', pricing: 'Meta-router across many models and providers.' },
        { provider: 'Groq', pricing: 'High throughput, low latency inference.' },
        { provider: 'Cerebras', pricing: 'Inference at scale on CS systems.' },
        { provider: 'Cohere', pricing: 'Command family for reasoning and chat.' },
        { provider: 'Perplexity', pricing: 'Answer engines with strong retrieval.' }
    ];
    const json = await fetchJson('/api/model_hub/providers');
    const apiList = Array.isArray(json && json.data) ? json.data : [];
    // Merge API response with defaults and de-duplicate by provider/name (case-insensitive)
    const merged = [...apiList, ...defaultProviders];
    const seen = new Set();
    const deduped = merged.filter(p => {
        const name = (p.provider || p.name || '').trim().toLowerCase();
        if (!name) return false;
        if (seen.has(name)) return false;
        seen.add(name);
        return true;
    });
    return deduped;
}

// --- Connection status lights ---
// Global status store (state: ok|err|warn|unknown)
window.__status = {
    backend:  { state: 'unknown', updatedAt: 0, error: null },
    modelhub: { state: 'unknown', updatedAt: 0, error: null },
    rag:      { state: 'unknown', updatedAt: 0, error: null }
};

function setLight(el, state) {
    // state: 'ok' | 'warn' | 'err' | 'unknown'
    const colors = { ok: '#2e7d32', warn: '#f9a825', err: '#d32f2f', unknown: '#90a4ae' };
    if (!el) return;
    el.style.color = colors[state] || colors.unknown;
}

function fetchWithTimeout(resource, options = {}) {
    const { timeout = 4000, ...opts } = options;
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Timeout')), timeout);
        fetch(resource, opts)
            .then((response) => { clearTimeout(timer); resolve(response); })
            .catch((err) => { clearTimeout(timer); reject(err); });
    });
}

async function updateStatusLights() {
    const b = document.getElementById('light-backend');
    const m = document.getElementById('light-modelhub');
    const r = document.getElementById('light-rag');
    setLight(b, 'unknown'); setLight(m, 'unknown'); setLight(r, 'unknown');
    try {
        const res = await fetchWithTimeout('/api/health', { timeout: 3000 });
        setLight(b, res.ok ? 'ok' : 'err');
        window.__status.backend = { state: (res.ok ? 'ok' : 'err'), updatedAt: Date.now(), error: null };
    } catch (e) {
        setLight(b, 'err'); window.__status.backend = { state: 'err', updatedAt: Date.now(), error: e && e.message ? e.message : 'Error' };
    }
    try {
        const res = await fetchWithTimeout('/api/model_hub/providers', { timeout: 4000 });
        setLight(m, res.ok ? 'ok' : 'err');
        window.__status.modelhub = { state: (res.ok ? 'ok' : 'err'), updatedAt: Date.now(), error: null };
    } catch (e) {
        setLight(m, 'err'); window.__status.modelhub = { state: 'err', updatedAt: Date.now(), error: e && e.message ? e.message : 'Error' };
    }
    try {
        const res = await fetchWithTimeout('/api/rag/search?q=pulse', { timeout: 4000 });
        setLight(r, res.ok ? 'ok' : 'err');
        window.__status.rag = { state: (res.ok ? 'ok' : 'err'), updatedAt: Date.now(), error: null };
    } catch (e) {
        setLight(r, 'err'); window.__status.rag = { state: 'err', updatedAt: Date.now(), error: e && e.message ? e.message : 'Error' };
    }
    updateStatusChips();
    updateStatusTitles();
    renderStatusBanner();
}

function updateStatusChips() {
    const colors = { ok: '#2e7d32', warn: '#f9a825', err: '#d32f2f', unknown: '#90a4ae' };
    document.querySelectorAll('.status-chip').forEach(chip => {
        const target = chip.getAttribute('data-target');
        const entry = window.__status && window.__status[target];
        const state = entry && entry.state ? entry.state : 'unknown';
        chip.style.background = colors[state] || colors.unknown;
        chip.textContent = state.toUpperCase();
        const when = entry && entry.updatedAt ? new Date(entry.updatedAt).toLocaleTimeString() : 'n/a';
        chip.title = `${target} = ${state}\nLast check: ${when}${entry && entry.error ? `\nError: ${entry.error}` : ''}`;
    });
}

function updateStatusTitles() {
    const map = { backend: 'light-backend', modelhub: 'light-modelhub', rag: 'light-rag' };
    Object.keys(map).forEach(key => {
        const el = document.getElementById(map[key]);
        const entry = window.__status[key];
        if (!el || !entry) return;
        const when = entry.updatedAt ? new Date(entry.updatedAt).toLocaleTimeString() : 'n/a';
        el.title = `${key} = ${entry.state}\nLast check: ${when}${entry.error ? `\nError: ${entry.error}` : ''}`;
    });
}

function ensureStatusBanner() {
    if (document.getElementById('global-status-banner')) return;
    const el = document.createElement('div');
    el.id = 'global-status-banner';
    el.style.position = 'fixed';
    el.style.top = '0';
    el.style.left = '0';
    el.style.right = '0';
    el.style.zIndex = '9998';
    el.style.display = 'none';
    el.style.padding = '8px 12px';
    el.style.color = '#fff';
    el.style.fontSize = '13px';
    el.style.background = '#d32f2f';
    el.style.boxShadow = '0 2px 8px rgba(0,0,0,0.25)';
    el.innerHTML = 'Some connections are failing. <a href="#/settings" style="color:#fff;text-decoration:underline">Open Settings</a>';
    document.body.appendChild(el);
}

// --- Chat helpers ---
function ensureChatThread(root) {
    const panel = root || document;
    let thread = panel.querySelector('.chat-thread');
    if (!thread) {
        thread = document.createElement('div');
        thread.className = 'chat-thread';
        thread.style.display = 'flex';
        thread.style.flexDirection = 'column';
        thread.style.gap = '10px';
        thread.style.padding = '10px';
        thread.style.margin = '10px 12px';
        thread.style.minHeight = '200px';
        thread.style.maxHeight = '45vh';
        thread.style.overflow = 'auto';
        thread.style.border = '1px solid var(--border-color)';
        thread.style.borderRadius = '8px';
        const composer = panel.querySelector('.composer-row');
        if (composer && composer.parentElement) {
            composer.parentElement.insertBefore(thread, composer);
        } else {
            panel.appendChild(thread);
        }
    }
    return thread;
}

function appendChat(root, role, text) {
    const thread = ensureChatThread(root);
    const msg = document.createElement('div');
    msg.className = role === 'user' ? 'msg user' : 'msg ai';
    msg.textContent = text;
    msg.style.whiteSpace = 'pre-wrap';
    msg.style.lineHeight = '1.4';
    msg.style.padding = '8px 10px';
    msg.style.borderRadius = '8px';
    msg.style.alignSelf = role === 'user' ? 'flex-end' : 'flex-start';
    msg.style.background = role === 'user' ? 'var(--chip-bg, #263238)' : 'var(--card-bg, #1f2937)';
    msg.style.color = 'var(--text-color, #e0e0e0)';
    thread.appendChild(msg);
    thread.scrollTop = thread.scrollHeight;
}

function renderStatusBanner() {
    ensureStatusBanner();
    const el = document.getElementById('global-status-banner');
    const anyErr = ['backend','modelhub','rag'].some(k => (window.__status[k] && window.__status[k].state === 'err'));
    el.style.display = anyErr ? 'block' : 'none';
}

// --- Toast notifications (minimal) ---
function ensureToastContainer() {
    if (document.getElementById('toast-container')) return;
    const el = document.createElement('div');
    el.id = 'toast-container';
    el.style.position = 'fixed';
    el.style.bottom = '20px';
    el.style.right = '20px';
    el.style.zIndex = '9999';
    el.style.display = 'flex';
    el.style.flexDirection = 'column-reverse';
    el.style.gap = '8px';
    document.body.appendChild(el);
}

function toast(message, type = 'info') {
    ensureToastContainer();
    const el = document.createElement('div');
    el.textContent = message;
    el.style.padding = '10px 14px';
    el.style.borderRadius = '6px';
    el.style.color = '#fff';
    el.style.fontSize = '14px';
    el.style.boxShadow = '0 2px 8px rgba(0,0,0,0.35)';
    el.style.background = type === 'error' ? '#d32f2f' : (type === 'success' ? '#2e7d32' : '#455a64');
    document.getElementById('toast-container').appendChild(el);
    setTimeout(() => {
        el.remove();
    }, 2500);
}

// --- RAG helpers ---
async function ragUpload() {
    const res = await fetch('/api/rag/sources/upload', { method: 'POST' });
    if (!res.ok) throw new Error(`Upload failed: HTTP ${res.status}`);
    return res.json();
}

async function ragIndex() {
    const res = await fetch('/api/rag/sources/index', { method: 'POST' });
    if (!res.ok) throw new Error(`Index failed: HTTP ${res.status}`);
    return res.json();
}

async function ragSearch(query) {
    const res = await fetch(`/api/rag/search?q=${encodeURIComponent(query || '')}`);
    if (!res.ok) throw new Error(`Search failed: HTTP ${res.status}`);
    return res.json();
}

function renderRagResults(container, payload) {
    const results = payload && payload.data && payload.data.results ? payload.data.results : [];
    if (!container) return;
    if (!results.length) {
        container.innerHTML = '<div class="feature-card"><p>No results.</p></div>';
        return;
    }
    const html = results.map(r => `
        <div class="feature-card">
            <h3>${r.title || 'Result'}</h3>
            <p>${r.snippet || ''}</p>
        </div>
    `).join('');
    container.innerHTML = html;
}

function renderDashboard() {
    const app = document.getElementById('app');
    app.innerHTML = `
        ${buildSidebar('/')}
        <div class="conversations-list">
            <div class="conv-toolbar">
                <h2>Conversations</h2>
                <div class="conv-actions">
                    <i class="material-icons" title="Search">search</i>
                    <i class="material-icons" title="Notifications">notifications_none</i>
                </div>
            </div>
            <div class="conv-sections">
                <div class="conv-section">
                    <div class="conv-section-title">Misc</div>
                    <ul>
                        <li>- Future Campaign</li>
                        <li>- Brainstorm visuals</li>
                    </ul>
                </div>
                <div class="conv-section">
                    <div class="conv-section-title">Migrated Projects - Team</div>
                    <ul>
                        <li>- Testing and Debugging</li>
                        <li>- Facebook Video Downloader</li>
                    </ul>
                </div>
            </div>
        </div>
        <div class="chat-main">
            <div class="chat-scroll chat-messages">
                <div class="message ai-message"><p>Welcome to Zeeks AI! I can help you with a variety of tasks. Try asking me to generate some ideas for your campaign.</p></div>
            </div>
            <div class="composer">
                <div class="composer-toolbar" style="display:flex;align-items:center;gap:8px">
                    <button class="tool-btn btn-attach" title="Attach files"><i class="material-icons">attach_file</i></button>
                    <button class="tool-btn btn-mic" title="Voice input (toggle)"><i class="material-icons">mic</i></button>
                    <button class="tool-btn btn-prompt" title="Open Prompts Library"><i class="material-icons">bookmark</i></button>
                    <button class="tool-btn btn-model" title="Select Model (Provider)"><i class="material-icons">smart_toy</i></button>
                    <button class="tool-btn btn-context" title="Add Knowledge Context"><i class="material-icons">library_add</i></button>
                    <div style="margin-left:auto"></div>
                    <span id="chat-model-badge" title="Current provider and model" style="font-size:12px;color:var(--muted-text);border:1px solid var(--border-color);padding:4px 8px;border-radius:14px;white-space:nowrap;">—</span>
                </div>
                <div class="composer-row">
                    <input type="text" placeholder="Enter to submit, Shift+Enter for new line">
                    <button class="send-btn"><i class="material-icons">send</i></button>
                </div>
            </div>
        </div>
    `;

    // Initialize selected chat provider and model badge
    const preferred = localStorage.getItem('chat:provider') || 'Ollama';
    window.__chatProvider = preferred;
    updateModelBadge();
}

// Settings page aligned with Studio structure
function renderSettings() {
    const app = document.getElementById('app');
    app.innerHTML = `
        ${buildSidebar('/settings')}
        <div class="main-content">
            <div class="settings-page">
                <h1>Settings</h1>
                <p>Manage your application preferences and account settings.</p>

                <div class="settings-section">
                    <h2>Appearance</h2>
                    <div class="settings-card">
                        <div class="radio-group">
                            <label><input type="radio" name="theme" value="light"> Light</label>
                            <label><input type="radio" name="theme" value="dark" checked> Dark</label>
                            <label><input type="radio" name="theme" value="system"> System</label>
                        </div>
                    </div>
                </div>

                <div class="settings-section">
                    <h2>Backup & Restore</h2>
                    <div class="settings-card">
                        <p>Create a backup of your conversations, prompts, personas, and settings.</p>
                        <button class="new-btn">Backup Now</button>
                    </div>
                </div>

                <div class="settings-section">
                    <h2>Account</h2>
                    <div class="settings-card">
                        <p>Manage your account security and data.</p>
                        <button class="new-btn">Change Password</button>
                        <button class="new-btn" style="background-color:#f44336; margin-left:10px;">Delete Account</button>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function renderFeatures() {
    const app = document.getElementById('app');
    app.innerHTML = `
        ${buildSidebar('/features')}
        <div class="main-content">
            <div class="features-overview">
                <h1>Features</h1>
                <div class="feature-card">
                    <h3>Universal Integrations</h3>
                    <p>Bridge your workflows and connect with APIs, databases, and external tools via MCP.</p>
                </div>
                <div class="feature-card">
                    <h3>Equipped Personas</h3>
                    <p>Assign tools to personas to perform tasks.</p>
                </div>
                <div class="feature-card">
                    <h3>Live Contexts</h3>
                    <p>Bring fresh data into conversations with API-connected contexts.</p>
                </div>
                <div class="feature-card">
                    <h3>Workflow Automation</h3>
                    <p>Automate repetitive, multi-step processes.</p>
                </div>
                <div class="feature-card">
                    <h3>Core Features</h3>
                    <ul>
                        <li>Model Hub - Local Models</li>
                        <li>Model Hub - Online Models</li>
                        <li>Conversations</li>
                        <li>Split Chats</li>
                        <li>Prompts Library</li>
                        <li>Toolbox - MCP Tools</li>
                        <li>Knowledge Stacks - RAG</li>
                    </ul>
                </div>
            </div>
        </div>
    `;
}

function renderModelHubLocal() {
    const app = document.getElementById('app');
    app.innerHTML = `
        ${buildSidebar('/model-hub-local')}
        <div class="main-content">
            <div class="model-hub-local">
                <h1>Model Hub - Local Models</h1>
                <div class="local-model-card">
                    <div class="model-info">
                        <h3>Ollama Llama 2</h3>
                        <span class="status loaded">Loaded</span>
                        <p>Local Installation: /usr/local/models/llama2</p>
                        <p>Resource Allocation: 8GB RAM, 4 CPU Cores</p>
                    </div>
                    <div class="model-actions">
                        <button class="unload-btn">Unload</button>
                        <button class="config-btn">Configure</button>
                    </div>
                </div>
                <div class="local-model-card">
                    <div class="model-info">
                        <h3>Ollama Mistral</h3>
                        <span class="status unloaded">Unloaded</span>
                        <p>Local Installation: /usr/local/models/mistral</p>
                        <p>Resource Allocation: Not Allocated</p>
                    </div>
                    <div class="model-actions">
                        <button class="load-btn">Load</button>
                        <button class="config-btn">Configure</button>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function renderModelHubOnline() {
    const app = document.getElementById('app');
    app.innerHTML = `
        ${buildSidebar('/model-hub-online')}
        <div class="main-content studio-scope">
            <div class="model-hub-online">
                <h1 style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">Model Hub - Online Models
                    <span class="status-chip" data-target="backend" style="padding:2px 8px;border-radius:999px;color:#fff;font-size:11px;">CHECK</span>
                    <span class="status-chip" data-target="modelhub" style="padding:2px 8px;border-radius:999px;color:#fff;font-size:11px;">CHECK</span>
                </h1>
                <div class="online-filters">
                    <input type="search" placeholder="Search providers or models..." aria-label="Search models">
                    <select aria-label="Provider">
                        <option value="">All Providers</option>
                        <option>OpenAI</option>
                        <option>Anthropic</option>
                        <option>Google</option>
                        <option>Meta</option>
                        <option>Groq</option>
                        <option>OpenRouter</option>
                    </select>
                    <label style="font-size:12px;color:var(--muted-text);display:inline-flex;gap:6px;align-items:center"><input type="checkbox"> Vision</label>
                    <label style="font-size:12px;color:var(--muted-text);display:inline-flex;gap:6px;align-items:center"><input type="checkbox"> Functions</label>
                    <label style="font-size:12px;color:var(--muted-text);display:inline-flex;gap:6px;align-items:center"><input type="checkbox"> Streaming</label>
                </div>
                <div class="resource-panel" style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:12px 0;">
                    <div class="resource-item"><span>CPU</span><div class="bar"><div class="fill" style="width:45%"></div></div></div>
                    <div class="resource-item"><span>Memory</span><div class="bar"><div class="fill" style="width:60%"></div></div></div>
                    <div class="resource-item"><span>Disk</span><div class="bar"><div class="fill" style="width:30%"></div></div></div>
                </div>
                <div class="provider-grid" id="provider-grid"><p style="color:var(--muted-text)">Loading providers...</p></div>
                <div id="provider-config-drawer" style="display:none;margin-top:16px;padding:16px;border:1px solid var(--border-color);border-radius:8px;background:var(--card-bg)"></div>
            </div>
        </div>
    `;

    // Populate providers dynamically
    (async () => {
        const grid = document.getElementById('provider-grid');
        try {
            const providers = await getOnlineProviders();
            window.__lastProviders = providers;
            console.debug('Model Hub Online providers:', providers.map(p => p.provider || p.name));
            if (!providers.length) {
                grid.innerHTML = '<p style="color:var(--muted-text)">No providers found.</p>';
                return;
            }
            const iconFor = (name) => {
                const key = (name || '').toLowerCase();
                const map = {
                    'ollama': 'assets/providers/ollama-light_53.png',
                    'lm': 'assets/providers/lmstudio.svg',
                    'lm studio': 'assets/providers/lmstudio.svg',
                    'openai': 'assets/providers/openai-light_53.png',
                    'anthropic': 'assets/providers/anthropic.svg',
                    'google': 'assets/providers/google-light_53.png',
                    'google ai': 'assets/providers/google-light_53.png',
                    'meta': 'assets/providers/meta-light_53.png',
                    'mistral': 'assets/providers/mistral.svg',
                    'azure': 'assets/providers/azure.svg',
                    'deepseek': 'assets/providers/deepseek-light_53.png',
                    'xai': 'assets/providers/xai.svg',
                    'openrouter': 'assets/providers/openrouter-light_53.png',
                    'groq': 'assets/providers/groq.svg',
                    'cerebras': 'assets/providers/cerebras.svg'
                };
                return map[key] || map[(key.split(' ')[0] || '')] || '';
            };
            const html = providers.map(p => {
                const name = p.provider || p.name;
                const icon = iconFor(name);
                const fallback = (url) => `this.onerror=null;this.src='${url}'`;
                const nk = (name || '').toLowerCase();
                const fallbackUrl = nk.includes('lm studio') ? 'https://lmstudio.ai/favicon.ico' :
                    nk.includes('openai') ? 'https://cdn.simpleicons.org/openai/FFFFFF' :
                    nk.includes('anthropic') ? 'https://cdn.simpleicons.org/anthropic/FFFFFF' :
                    nk.includes('google') ? 'https://cdn.simpleicons.org/google/FFFFFF' :
                    nk.includes('meta') ? 'https://cdn.simpleicons.org/meta/FFFFFF' :
                    nk.includes('mistral') ? 'https://www.mistral.ai/favicon.svg' :
                    nk.includes('azure') ? 'https://cdn.simpleicons.org/microsoftazure/FFFFFF' :
                    nk.includes('deepseek') ? 'https://www.deepseek.com/favicon.ico' :
                    nk.includes('xai') ? 'https://cdn.simpleicons.org/x/FFFFFF' :
                    nk.includes('openrouter') ? 'https://openrouter.ai/favicon-32x32.png' :
                    nk.includes('groq') ? 'https://groq.com/favicon-32x32.png' :
                    nk.includes('cerebras') ? 'https://www.cerebras.net/favicon-32x32.png' : '';
                const initials = (name || '').split(/\s+/).map(s=>s[0]).join('').slice(0,2).toUpperCase() || '?';
                const avatar = `<div aria-hidden="true" style="width:22px;height:22px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;background:#263238;color:#fff;font-size:11px;">${initials}</div>`;
                return `
                <div class="provider-card" data-name="${name}">
                    <div class="meta" style="display:flex;align-items:center;gap:10px;">
                        ${icon ? `<img class="provider-icon" alt="${name}" src="${icon}" onerror="${fallback(fallbackUrl || '')}" style="width:22px;height:22px;object-fit:contain">` : (fallbackUrl ? `<img class="provider-icon" alt="${name}" src="${fallbackUrl}" style="width:22px;height:22px;object-fit:contain">` : avatar)}
                        <div>
                            <h4 style="margin:0">${name}</h4>
                            ${p.pricing ? `<p style="margin:0">${p.pricing}</p>` : ''}
                        </div>
                    </div>
                    <div class="actions">
                        <button class="connect-btn provider-btn" data-name="${name}">Connect</button>
                        <button class="config-btn provider-btn" data-name="${name}">Configure</button>
                    </div>
                </div>`;
            }).join('');
            grid.innerHTML = html;
            toast('Providers loaded', 'success');
        } catch (err) {
            console.error(err);
            grid.innerHTML = '<p style="color:#d32f2f">Failed to load providers.</p>';
            toast('Failed to load providers', 'error');
        }
        updateStatusChips();
    })();
}

// Single source of truth: any calls to renderModelHub will delegate to Online
function renderModelHub() { renderModelHubOnline(); }
function renderProfile() {
    const app = document.getElementById('app');
    app.innerHTML = `
        ${buildSidebar('/profile')}
        <div class="main-content">
            <div class="features-overview">
                <h1>Profile</h1>
                <div class="feature-card"><h3>Account</h3><p>View and edit your profile details (placeholder).</p></div>
            </div>
        </div>
    `;
}

// Notifications
function renderNotifications() {
    const app = document.getElementById('app');
    app.innerHTML = `
        ${buildSidebar('/notifications')}
        <div class="main-content">
            <div class="features-overview">
                <h1>Notifications</h1>
                <div class="feature-card"><h3>Inbox</h3><p>Notification center (placeholder).</p></div>
            </div>
        </div>
    `;
}

// Support
function renderSupport() {
    const app = document.getElementById('app');
    app.innerHTML = `
        ${buildSidebar('/support')}
        <div class="main-content">
            <div class="features-overview">
                <h1>Support</h1>
                <div class="feature-card"><h3>Help & Docs</h3><p>Access FAQs and contact support (placeholder).</p></div>
            </div>
        </div>
    `;
}

// Added: Personas page aligned with Studio
function renderPersonas() {
    const app = document.getElementById('app');
    app.innerHTML = `
        ${buildSidebar('/personas')}
        <div class="main-content">
            <div class="features-overview">
                <h1>Personas</h1>
                <div class="feature-card">
                    <h3>General Assistant</h3>
                    <p>A helpful and friendly AI for a wide range of tasks and questions.</p>
                </div>
                <div class="feature-card">
                    <h3>Code-Wizard</h3>
                    <p>Expert in writing, debugging, and explaining code across multiple languages.</p>
                </div>
                <div class="feature-card">
                    <h3>Creative Writer</h3>
                    <p>Specializes in crafting stories, articles, and other creative content.</p>
                </div>
            </div>
        </div>
    `;
}

// Added: Workflows page aligned with Studio
function renderWorkflows() {
    const app = document.getElementById('app');
    app.innerHTML = `
        ${buildSidebar('/workflows')}
        <div class="main-content">
            <div class="features-overview">
                <h1>Workflows</h1>
                <div class="feature-card">
                    <h3>Automations</h3>
                    <p>Design and run multi-step automations to streamline your processes.</p>
                </div>
                <div class="feature-card">
                    <h3>Templates</h3>
                    <p>Start from curated templates for common tasks.</p>
                </div>
            </div>
        </div>
    `;
}

function renderPrompts() {
    const app = document.getElementById('app');
    const renderAgents = (q = '', cat = 'All') => {
        const term = (q || '').toLowerCase();
        const list = AGENTS_CATALOG.filter(a => {
            const matchCat = (cat === 'All') || a.category === cat;
            const matchQ = !term || a.name.toLowerCase().includes(term) || a.description.toLowerCase().includes(term) || a.category.toLowerCase().includes(term);
            return matchCat && matchQ;
        });
        if (!list.length) return '<div class="feature-card"><p>No agents match your query.</p></div>';
        const cards = list.map(a => `
            <div class="agent-card" data-name="${a.name.replace(/\"/g,'&quot;')}">
                <div style="display:flex;align-items:center;justify-content:space-between;gap:8px">
                    <div style="font-weight:600">${a.name}</div>
                    <span class="chip" style="font-size:11px;border:1px solid var(--border-color);border-radius:999px;padding:2px 6px;color:var(--muted-text)">${a.category}</span>
                </div>
                <p style="margin:8px 0 0 0;color:var(--muted-text);font-size:13px">${a.description}</p>
                ${a.repo ? `<div style=\"margin-top:8px\"><a href=\"${a.repo}\" target=\"_blank\" style=\"font-size:12px\">Source</a></div>` : ''}
            </div>
        `).join('');
        return `<div class="agents-grid">${cards}</div>`;
    };
    const cats = ['All', ...AGENTS_CATEGORIES];
    app.innerHTML = `
        ${buildSidebar('/prompts')}
        <div class="main-content">
            <div class="prompts-library">
                <h1>Prompts Library</h1>
                <div class="prompts-actions" style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:8px">
                    <input id="agents-search" type="text" placeholder="Search agents..." style="flex:1;min-width:220px">
                    <select id="agents-category" style="background:var(--card-bg);color:var(--text-color);border:1px solid var(--border-color);border-radius:6px;padding:4px 6px">
                        ${cats.map(c => `<option value="${c}">${c}</option>`).join('')}
                    </select>
                    <button class="new-prompt-btn">New Prompt</button>
                </div>
                <div class="feature-card">
                    <h3 style="margin-top:0">Agents Catalog</h3>
                    <div id="agents-list" style="margin-top:8px">${renderAgents()}</div>
                </div>
            </div>
        </div>
        <style>
            .agents-grid { display:grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap:10px; }
            .agent-card { border:1px solid var(--border-color); border-radius:8px; padding:10px; background:var(--card-bg); }
            .agent-card:hover { outline: 2px solid #42a5f5; }
        </style>
    `;
    const search = document.getElementById('agents-search');
    const sel = document.getElementById('agents-category');
    const list = document.getElementById('agents-list');
    const rerender = () => { list.innerHTML = renderAgents(search.value, sel.value); };
    if (search) search.addEventListener('input', debounce(rerender, 200));
    if (sel) sel.addEventListener('change', rerender);
}

function renderToolbox() {
    const app = document.getElementById('app');
    app.innerHTML = `
        ${buildSidebar('/toolbox')}
        <div class="main-content">
            <div class="toolbox-mcp">
                <h1>Toolbox</h1>
                <div class="tool-card disabled">
                    <h3>API Connector</h3>
                    <p>Connect to any API and use it as a tool.</p>
                    <span class="premium-label">Premium</span>
                </div>
                <div class="tool-card disabled">
                    <h3>Database Connector</h3>
                    <p>Connect to your databases and query them.</p>
                    <span class="premium-label">Premium</span>
                </div>
                <div class="tool-card">
                    <h3>Web Search</h3>
                    <p>Search the web for information.</p>
                </div>
            </div>
        </div>
    `;
}

function renderKnowledge() {
    const app = document.getElementById('app');
    app.innerHTML = `
        ${buildSidebar('/knowledge-stacks')}
        <div class="main-content">
            <div class="features-overview knowledge-stacks">
                <h1>Knowledge Stacks</h1>
                <div class="knowledge-actions">
                    <input type="text" placeholder="Search stacks or sources...">
                    <button class="new-stack-btn">New Stack</button>
                </div>
                <div class="stack-card">
                    <div class="stack-info">
                        <h3>Product Docs</h3>
                        <p>Indexed docs with FAQ and release notes.</p>
                    </div>
                    <div class="stack-buttons">
                        <button class="details-btn">Details</button>
                        <button class="add-source-btn">Add Source</button>
                        <button class="delete-btn">Delete</button>
                    </div>
                </div>
                <div class="stack-card active">
                    <div class="stack-info">
                        <h3>Work Team Knowledge</h3>
                        <p>Internal wiki and meeting notes.</p>
                    </div>
                    <div class="stack-buttons">
                        <button class="details-btn">Details</button>
                        <button class="add-source-btn">Add Source</button>
                        <button class="delete-btn">Delete</button>
                    </div>
                </div>
                <div style="margin-top:16px;display:flex;gap:10px;align-items:center">
                    <button class="rag-upload-btn">Upload Documents</button>
                    <input type="search" placeholder="Search knowledge..." style="flex:1">
                    <button class="new-btn" onclick="(function(){document.querySelector('.rag-results').innerHTML='';})()">Clear</button>
                </div>
                <div class="rag-results" style="margin-top:16px;"></div>
            </div>
        </div>
        <div class="modal-overlay" style="display:none;">
            <div class="modal">
                <h3>Are you sure?</h3>
                <p>Do you really want to delete this stack? This process cannot be undone.</p>
                <div class="modal-buttons">
                    <button class="cancel-btn">Cancel</button>
                    <button class="confirm-delete-btn">Delete</button>
                </div>
            </div>
        </div>
    `;
}

function renderPlayground() {
    const app = document.getElementById('app');
    app.innerHTML = `
        ${buildSidebar('/playground')}
        <div class="main-content">
            <div class="ai-playground">
                <h1>AI Playground</h1>
                <div class="playground-layout">
                    <div class="playground-tabs">
                        <!-- Tabs will be dynamically rendered here -->
                    </div>
                    <div class="playground-main">
                        <div class="prompt-area">
                            <textarea placeholder="Enter your prompt here..."></textarea>
                            <div class="prompt-actions">
                                <button>Undo</button>
                                <button>Redo</button>
                                <button>Save Prompt</button>
                            </div>
                        </div>
                        <div class="output-area">
                            <!-- AI output will be displayed here -->
                        </div>
                    </div>
                    <div class="playground-sidebar">
                        <div class="model-selection">
                            <label for="model">Model</label>
                            <select id="model">
                                <option>OpenAI GPT-4</option>
                                <option>Anthropic Claude 3 Opus</option>
                                <option>Ollama Llama 2</option>
                            </select>
                        </div>
                        <div class="parameters">
                            <h4>Parameters</h4>
                            <label>Temperature: 0.7</label>
                            <input type="range" min="0" max="1" step="0.1" value="0.7">
                            <label>Max Tokens: 256</label>
                            <input type="range" min="1" max="2048" step="1" value="256">
                        </div>
                        <button class="compare-btn">Compare Prompts</button>
                        <button class="share-btn">Share Session</button>
                        <button class="reset-btn">Reset Playground</button>
                    </div>
                </div>
            </div>
        </div>
        <div class="tutorial-overlay" style="display:none;">
            <div class="tutorial-content">
                <h2>Welcome to the AI Playground!</h2>
                <p>This is a quick start tutorial...</p>
                <button class="close-tutorial-btn">Got it!</button>
            </div>
        </div>
    `;
}
