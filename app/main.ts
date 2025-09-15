// Use explicit main-process entry to avoid ambiguous module resolution
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { app, BrowserWindow, ipcMain, dialog } = require('electron/main');
import { spawn } from 'node:child_process';
import path from 'node:path';
import { writeFile } from 'node:fs/promises';

let win: any = null;
let services: Array<{ name: string; proc: any; port: number }> = [];

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitForHealth(url: string, timeoutMs = 15000) {
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

/**
 * Main window creation (Electron main process)
 *
 * Docs:
 * - Process model (Main vs Renderer): https://www.electronjs.org/docs/latest/tutorial/process-model
 * - BrowserWindow API: https://www.electronjs.org/docs/latest/api/browser-window
 * - Security checklist (contextIsolation, preload-only): https://www.electronjs.org/docs/latest/tutorial/security
 * - IPC patterns: https://www.electronjs.org/docs/latest/tutorial/ipc
 */
async function createWindow() {
  // Spawn FastAPI backend on 127.0.0.1
  const corePort = process.env.CORE_PORT || '8000';
  const py = process.env.PYTHON || 'python';
  const backendEntry = path.join(process.cwd(), 'backend', 'app', 'main.py');
  const core = spawn(py, [backendEntry], {
    env: { ...process.env, PORT: corePort },
    stdio: 'inherit'
  });
  services.push({ name: 'core', proc: core, port: Number(corePort) });

  await waitForHealth(`http://127.0.0.1:${corePort}/health`);

  // Renderer is sandboxed; expose minimal API via preload only
  win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      // Preload runs in isolated world; use it to expose a safe, typed bridge.
      // Preload docs: https://www.electronjs.org/docs/latest/tutorial/sandbox
      preload: path.join(process.cwd(), 'app', 'preload.js'),
      contextIsolation: true
    }
  });
  // Default to 'root' desktop renderer; can override with UI_BUNDLE env
  const bundle = (process.env.UI_BUNDLE || 'root').toLowerCase();
  const target = bundle === 'root'
    ? path.join(process.cwd(), 'index.html')
    : path.join(process.cwd(), 'web', 'index.html');
  console.log(`[main] Loading renderer bundle: ${bundle} -> ${target}`);
  await win.loadFile(target);
}

// App lifecycle: https://www.electronjs.org/docs/latest/api/app
app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  services.forEach((s) => {
    try { s.proc?.kill(); } catch {}
  });
  app.quit();
});

// IPC: Save As for notes
ipcMain.handle('note:saveAs', async (_event: any, params: { content: string; filename?: string }) => {
  try {
    const { content, filename } = params || { content: '' } as any;
    const result = await dialog.showSaveDialog({
      title: 'Save Note As',
      defaultPath: filename || 'note.txt',
      filters: [
        { name: 'Text Files', extensions: ['txt'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    });
    if (result.canceled || !result.filePath) return { ok: false, canceled: true };
    await writeFile(result.filePath, content ?? '', { encoding: 'utf-8' });
    return { ok: true, path: result.filePath };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'Failed' };
  }
});
