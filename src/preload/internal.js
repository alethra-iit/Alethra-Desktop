// Dipakai halaman internal alethra:// dan UI (toolbar/overlay). Tidak diekspos ke situs lain.
const { contextBridge, ipcRenderer } = require('electron');
if (location.protocol === 'alethra:') {
  const subs = {};
  ipcRenderer.on('ev', (_e, name, data) => { (subs[name] || []).forEach(f => { try { f(data); } catch (e) { console.error(e); } }); });
  contextBridge.exposeInMainWorld('alethra', {
    call: (name, ...args) => ipcRenderer.invoke('api', name, ...args),
    on: (name, cb) => { (subs[name] = subs[name] || []).push(cb); }
  });
}
