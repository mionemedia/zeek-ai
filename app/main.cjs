// Electron main process entry (CommonJS)
// Spawns FastAPI backend on 127.0.0.1 and loads the renderer (web/index.html)

const { app, BrowserWindow } = require('electron');
const { spawn } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');

let win = null;
const services = [];

// --- Simple app logger ---
function ensureLogFile() {
  try {
    const dir = path.join(process.cwd(), 'server', 'logs');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    return path.join(dir, 'app.log');
  } catch {
    return path.join(process.cwd(), 'app.log');
  }
}
const LOG_FILE = ensureLogFile();
function log(line) {
  const ts = new Date().toISOString();
  try { fs.appendFileSync(LOG_FILE, `[${ts}] ${line}\n`); } catch {}
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitForHealth(url, timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const r = await fetch(url);
      if (r.ok) return;
    } catch {}
    await sleep(250);
  }
  throw new Error(`Service not healthy: ${url}`);
}

async function createWindow() {
  const corePort = process.env.CORE_PORT || '8000';
  const py = process.env.PYTHON || 'python';
  const backendCwd = path.join(process.cwd(), 'backend');
  const backendEntry = path.join(backendCwd, 'app', 'main.py');
  const core = spawn(py, [backendEntry], {
    env: { ...process.env, PORT: corePort, PYTHONPATH: backendCwd },
    stdio: 'inherit',
    cwd: backendCwd
  });
  services.push({ name: 'core', proc: core, port: Number(corePort) });
  log(`Spawned backend on 127.0.0.1:${corePort}`);

  await waitForHealth(`http://127.0.0.1:${corePort}/health`);

  win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(process.cwd(), 'app', 'preload.js'),
      contextIsolation: true
    }
  });

  // Capture renderer console messages to app log
  win.webContents.on('console-message', (_e, level, message, line, sourceId) => {
    try { log(`renderer[${level}] ${message} (${sourceId}:${line})`); } catch {}
  });
  // When page crashes or fails to load
  win.webContents.on('did-fail-load', (_e, errorCode, errorDescription, validatedURL) => {
    log(`did-fail-load code=${errorCode} desc=${errorDescription} url=${validatedURL}`);
  });
  win.webContents.on('render-process-gone', (_e, details) => {
    log(`render-process-gone: ${JSON.stringify(details)}`);
  });
  win.on('unresponsive', () => log('window unresponsive'));
  win.webContents.on('did-finish-load', () => log('renderer did-finish-load'));

  // UI bundle switch: set UI_BUNDLE=web to load web/index.html, otherwise load root index.html
  const uiBundle = (process.env.UI_BUNDLE || 'root').toLowerCase();
  if (uiBundle === 'web') {
    await win.loadFile(path.join(process.cwd(), 'web', 'index.html'));
    log('renderer loaded web/index.html');
  } else {
    await win.loadFile(path.join(process.cwd(), 'index.html'));
    log('renderer loaded index.html');
  }
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  services.forEach((s) => {
    try { s.proc?.kill(); } catch {}
  });
  log('app quitting');
  app.quit();
});
