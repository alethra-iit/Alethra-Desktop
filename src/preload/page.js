// Preload untuk tab web biasa: skrip blokir iklan, jembatan terjemahan, simpan/isi sandi.
const { contextBridge, ipcRenderer, webFrame } = require('electron');

if (location.protocol === 'alethra:') {
  const subs = {};
  ipcRenderer.on('ev', (_e, name, data) => { (subs[name] || []).forEach(f => { try { f(data); } catch (e) { console.error(e); } }); });
  contextBridge.exposeInMainWorld('alethra', {
    call: (name, ...args) => ipcRenderer.invoke('api', name, ...args),
    on: (name, cb) => { (subs[name] = subs[name] || []).push(cb); }
  });
} else if (location.protocol === 'http:' || location.protocol === 'https:') {
  try {
    const cfg = ipcRenderer.sendSync('page:init', location.href);
    if (cfg && cfg.js) webFrame.executeJavaScript(cfg.js).catch(() => {});
  } catch (e) {}
  if (window.top === window) {
    contextBridge.exposeInMainWorld('AlethraTr', {
      translate: (id, t, l) => ipcRenderer.send('tr:one', id, String(t), String(l)),
      translateBatch: (id, j, l) => ipcRenderer.send('tr:batch', id, String(j), String(l))
    });
  }

  // ---- Sandi: tawarkan simpan & isi otomatis (hanya saat kolom diklik) ----
  const TEXTY = /^(text|email|tel|search|)$/i;
  function grab(root) {
    const p = root.querySelector && root.querySelector('input[type=password]');
    if (!p || !p.value) return null;
    const scope = p.form || root;
    let u = '';
    const ins = Array.from(scope.querySelectorAll('input'));
    for (const i of ins) { if (i === p) break; if (TEXTY.test(i.type) && i.value) u = i.value; }
    return { u, p: p.value };
  }
  function offer(c) { if (c) ipcRenderer.send('pw:offer', location.href, c.u, c.p); }
  document.addEventListener('submit', e => { try { offer(grab(e.target)); } catch (x) {} }, true);
  document.addEventListener('click', e => {
    try {
      const b = e.target.closest && e.target.closest('button,input[type=submit],input[type=button],[role=button]');
      if (b) offer(grab(b.form || document));
    } catch (x) {}
  }, true);
  document.addEventListener('keydown', e => { if (e.key === 'Enter') { try { offer(grab(e.target.form || document)); } catch (x) {} } }, true);

  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
  function fill(el, v) { if (!el || el.value) return; setter.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); }
  let done = false;
  document.addEventListener('focusin', async e => {
    const t = e.target;
    if (done || !t || t.tagName !== 'INPUT') return;
    const scope = t.form || document;
    const pw = scope.querySelector('input[type=password]');
    if (!pw || !(t === pw || TEXTY.test(t.type))) return;
    done = true;
    try {
      const list = await ipcRenderer.invoke('pw:find', location.origin);
      if (!list || !list.length) { done = false; return; }
      const c = list[0];
      const ins = Array.from(scope.querySelectorAll('input')).filter(i => TEXTY.test(i.type));
      const user = ins.filter(i => pw.compareDocumentPosition(i) & Node.DOCUMENT_POSITION_PRECEDING).pop();
      if (user) fill(user, c.u);
      fill(pw, c.p);
    } catch (x) { done = false; }
  }, true);
}
