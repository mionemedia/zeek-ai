import { contextBridge, ipcRenderer } from 'electron';

async function authHeaders(): Promise<Record<string, string>> {
  try {
    const token = localStorage.getItem('local:apiToken') || '';
    return token ? { Authorization: `Bearer ${token}` } : {} as Record<string,string>;
  } catch {
    return {} as Record<string, string>;
  }
}

contextBridge.exposeInMainWorld('zeek', {
  async health() {
    const headers = await authHeaders();
    const r = await fetch('http://127.0.0.1:8000/health', { headers });
    return r.ok;
  },
  async chat(payload: any) {
    const headers = { 'Content-Type': 'application/json', ...(await authHeaders()) };
    const r = await fetch('http://127.0.0.1:8000/api/chat', {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  },
  async saveAsNote(params: { content: string; filename?: string }) {
    try {
      const res = await ipcRenderer.invoke('note:saveAs', params);
      return res; // { ok: boolean, path?: string, error?: string }
    } catch (e: any) {
      return { ok: false, error: e?.message || 'Failed' };
    }
  }
});
