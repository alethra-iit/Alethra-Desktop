const { app, BrowserWindow, WebContentsView, session, protocol, Menu, MenuItem, ipcMain, dialog, shell, nativeTheme, clipboard, nativeImage } = require('electron');
const fs = require('fs'), path = require('path');
const ctx = require('./ctx');
const U = require('./util');
const Store = require('./store');
const SV = require('./services');
const { setting, saveSetting } = SV;
const STT = require('./stt');
const OFF = require('./offline');

protocol.registerSchemesAsPrivileged([{ scheme: 'alethra', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } }]);
app.setName('Alethra');
app.setPath('userData', path.join(app.getPath('appData'), 'Alethra'));
// ---- log kesalahan: %APPDATA%\Alethra\alethra-log.txt ----
function log(...a) {
  try {
    const f = path.join(app.getPath('userData'), 'alethra-log.txt'); fs.mkdirSync(path.dirname(f), { recursive: true });
    fs.appendFileSync(f, new Date().toISOString() + ' ' + a.map(x => (x && x.stack) || String(x)).join(' ') + '\n');
  } catch {}
}
process.on('uncaughtException', e => { log('uncaught', e); try { dialog.showErrorBox('Alethra: terjadi kesalahan', String((e && e.stack) || e) + '\n\nRincian tersimpan di %APPDATA%\\Alethra\\alethra-log.txt'); } catch {} });
process.on('unhandledRejection', e => log('unhandledRejection', e));
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) { log('instance lain sudah berjalan'); app.quit(); process.exit(0); }

let win, chromeWC, overlay, chromeH = 84, pageId = 0;
const closed = [];
let activeId = null, htmlFs = false, saveT = null, quitting = false;
const OV = { suggest: null, menu: null, modal: null, toast: null };
const INCOG = 'incog';
const PERSIST = 'persist:main';

/* ================= util kirim ================= */
const alive = (wc) => wc && !wc.isDestroyed();
const sendTo = (wc, name, data) => { if (alive(wc)) wc.send('ev', name, data); };
ctx.sendChrome = (n, d) => sendTo(chromeWC, n, d);
const sendOv = (n, d) => sendTo(overlay && overlay.webContents, n, d);
ctx.broadcastPages = (n, d) => ctx.tabs.forEach(t => { const wc = t.view.webContents; if (alive(wc) && wc.getURL().startsWith('alethra://')) sendTo(wc, n, d); });
const isInternalSender = (e) => { try { return (e.senderFrame && e.senderFrame.url || '').startsWith('alethra://'); } catch { return false; } };

/* ================= tema ================= */
function isDark() { return nativeTheme.shouldUseDarkColors; }
function barColors() {
  if (isDark()) return setting('amoled') ? { color: '#000000', symbolColor: '#f4f4f5' } : { color: '#121214', symbolColor: '#f4f4f5' };
  return { color: '#e9e9ee', symbolColor: '#111113' };
}
function applyTheme() {
  nativeTheme.themeSource = setting('theme');
  if (win) { const c = barColors(); try { win.setTitleBarOverlay({ color: c.color, symbolColor: c.symbolColor, height: 40 }); } catch {} win.setBackgroundColor(c.color); }
  const st = publicSettings();
  ctx.sendChrome('settings', st); sendOv('settings', st); ctx.broadcastPages('settings', st);
  try { renderOverlay(); } catch {}
}
function publicSettings() {
  const s = Object.assign({}, ctx.settings.data);
  const l = s.lock || {}; s.lock = { mode: l.mode || 'off', parts: l.parts || [], grace: l.grace == null ? 60000 : l.grace, hasPin: !!l.hash };
  delete s.stkeyEnc; { const e = ctx.settings.data.stkeyEnc; const k = e ? SV.dec(e) : ''; s.stkeyMask = k ? '••••' + k.slice(-4) : ''; }
  for (const k of ['sta', 'stf', 'stb', 'tools']) s[k] = SV.setting(k);
  s.stDefs = { stf: SV.DEFAULTS.stf, stb: SV.DEFAULTS.stb, tools: SV.DEFAULTS.tools };
  s.dark = isDark(); s.engines = U.ENGINES; s.doh_list = U.DOH; s.trLangs = U.TR_LANGS; s.dlDirShown = SV.dlDir(); s.version = app.getVersion();
  for (const k of Object.keys(SV.DEFAULTS)) if (s[k] === undefined && k !== 'lock') s[k] = SV.DEFAULTS[k];
  return s;
}
function homeParams() {
  const s = publicSettings(), c = Object.assign({}, SV.DEFAULTS.clock, s.clock || {}), P = new URLSearchParams();
  P.set('t', s.dark ? 'dark' : 'light'); P.set('o', s.amoled ? '1' : '0'); if (s.accent) P.set('a', s.accent);
  P.set('l', s.logo === false ? '0' : '1'); if (s.wall) P.set('w', String(s.wall)); P.set('d', String(s.dim)); P.set('g', s.grad ? '1' : '0');
  P.set('c', c.c); P.set('p', c.p); P.set('z', c.z); P.set('k', c.k); P.set('al', c.al); P.set('d2', c.d2);
  P.set('h', c.h24 ? '1' : '0'); P.set('q', c.q ? '1' : '0'); P.set('y', c.y ? '1' : '0'); P.set('n', c.n ? '1' : '0'); P.set('b', c.b ? '1' : '0');
  return P.toString();
}

/* ================= tata letak ================= */
function layout() {
  if (!win) return;
  const [w, h] = win.getContentSize();
  const top = htmlFs ? 0 : chromeH;
  ctx.tabs.forEach(t => {
    const show = t.id === activeId;
    t.view.setVisible(show);
    if (show) t.view.setBounds({ x: 0, y: top, width: w, height: Math.max(0, h - top) });
  });
  renderOverlay();
}
function renderOverlay() {
  if (!overlay || !win) return;
  const [w, h] = win.getContentSize();
  const stt = STT.ui([w, h]);
  const sttShow = stt && !(stt.fs && stt.idle);
  const any = OV.suggest || OV.menu || OV.modal || OV.toast || sttShow;
  if (!any) { overlay.setVisible(false); sendOv('state', {}); return; }
  let b;
  if (OV.modal) b = { x: 0, y: 0, width: w, height: h };
  else if (OV.suggest || OV.menu) b = { x: 0, y: chromeH, width: w, height: Math.max(0, h - chromeH) };
  else {
    const rs = [];
    if (OV.toast) rs.push({ x: Math.floor(w / 2 - 230), y: h - 70, width: 460, height: 56 });
    if (sttShow) rs.push({ x: stt.rect.x, y: stt.rect.y, width: stt.rect.w, height: stt.rect.h });
    const x1 = Math.min(...rs.map(r => r.x)), y1 = Math.min(...rs.map(r => r.y)), x2 = Math.max(...rs.map(r => r.x + r.width)), y2 = Math.max(...rs.map(r => r.y + r.height));
    b = { x: x1, y: y1, width: x2 - x1, height: y2 - y1 };
  }
  overlay.setBounds(b); overlay.setVisible(true);
  win.contentView.addChildView(overlay);
  sendOv('state', { suggest: OV.suggest, menu: OV.menu, modal: OV.modal && { type: OV.modal.type, data: OV.modal.data }, toast: OV.toast, dark: isDark(), stt: sttShow ? stt : null, ox: b.x, oy: b.y, tw: b.width });
}
let toastT = null;
ctx.toast = (msg) => { OV.toast = msg; renderOverlay(); clearTimeout(toastT); toastT = setTimeout(() => { OV.toast = null; renderOverlay(); }, 2600); };
function closePopups() { if (OV.suggest || OV.menu) { OV.suggest = null; OV.menu = null; renderOverlay(); } }
function askModal(type, data, dismissable = true) {
  return new Promise(res => { if (OV.modal) OV.modal.resolve(null); OV.modal = { type, data: Object.assign({ dismissable }, data), resolve: res }; OV.suggest = OV.menu = null; renderOverlay(); });
}
function endModal(v) { if (!OV.modal) return; const r = OV.modal.resolve; OV.modal = null; renderOverlay(); r(v); if (alive(curWC())) curWC().focus(); }

/* ================= infobar ================= */
const infobars = []; let ibSeq = 0;
ctx.addInfobar = (o) => { o.id = ++ibSeq; infobars.push(o); pushInfobars(); return o.id; };
function pushInfobars() {
  ctx.sendChrome('infobars', infobars.filter(i => i.tabId === activeId).map(i => ({ id: i.id, kind: i.kind, text: i.text, actions: i.actions })));
}
function dropInfobars(tabId, resolveWith) { for (let i = infobars.length - 1; i >= 0; i--) if (infobars[i].tabId === tabId) { const x = infobars.splice(i, 1)[0]; try { x.done && x.done(resolveWith || 'dismiss'); } catch {} } pushInfobars(); }

/* ================= tab ================= */
const curTab = () => ctx.tabs.find(t => t.id === activeId);
const curWC = () => { const t = curTab(); return t && t.view.webContents; };
const tabByWc = (wc) => ctx.tabs.find(t => t.view.webContents === wc);
const internalName = (u) => { const m = /^alethra:\/\/([a-z]+)/.exec(u || ''); return m ? m[1] : null; };

function tabState() {
  return ctx.tabs.map(t => {
    const wc = t.view.webContents; let back = false, fwd = false;
    try { back = wc.navigationHistory.canGoBack(); fwd = wc.navigationHistory.canGoForward(); } catch {}
    const host = U.hostOf(t.url);
    return { id: t.id, title: t.title, url: t.url, icon: t.icon, loading: t.loading, incog: t.incog, audible: t.audible, muted: t.muted, back, fwd,
      active: t.id === activeId, secure: /^https:/.test(t.url), internal: !!internalName(t.url), trOn: t.trOn, zoom: wc.getZoomFactor ? Math.round(wc.getZoomFactor() * 100) : 100,
      bookmarked: ctx.bm.data.some(b => b.u === t.url), mobile: SV.isMobileSite(host), adoff: !!host && (setting('sadoff') || []).some(d => host === d || host.endsWith('.' + d)) };
  });
}
let pushT = null;
function pushTabs() { if (pushT) return; pushT = setImmediate(() => { pushT = null; ctx.sendChrome('tabs', tabState()); saveSessionSoon(); }); }

function createTab(url, o = {}) {
  const incog = !!o.incog;
  const part = incog ? INCOG : PERSIST;
  const ses = session.fromPartition(part);
  SV.setupSession(ses, incog);
  const view = new WebContentsView({ webPreferences: { partition: part, sandbox: true, contextIsolation: true, nodeIntegration: false, preload: path.join(__dirname, '..', 'preload', 'page.js'), spellcheck: true, webSecurity: true, allowRunningInsecureContent: false } });
  view.setBackgroundColor('#00000000');
  const t = { id: ++pageId, view, incog, title: 'Tab baru', url: url || '', icon: '', loading: false, audible: false, muted: false, trOn: false, find: '' };
  const idx = o.index == null ? ctx.tabs.length : o.index;
  ctx.tabs.splice(idx, 0, t);
  win.contentView.addChildView(view);
  if (overlay) win.contentView.addChildView(overlay);
  wire(t);
  if (o.activate !== false) selectTab(t.id);
  go(t, url || 'alethra://home');
  pushTabs();
  return t;
}
function go(t, url) {
  if (!url) return;
  if (!SV.localOk(url)) { ctx.toast('Berkas lokal diblokir'); return; }
  if (/^view-source:/i.test(url) === false && !/^(https?|alethra|file|about|data):/i.test(url)) url = 'https://www.google.com/search?q=' + encodeURIComponent(url);
  t.url = url; t.view.webContents.loadURL(url).catch(() => {});
}
function selectTab(id) {
  const t = ctx.tabs.find(x => x.id === id); if (!t) return;
  if (t.incog && !t.authed && !ctx.tabs.some(x => x.incog && x.authed)) { /* PIN bagian incognito ditangani saat dibuat */ }
  if (STT.active() && STT.activeTabId() !== id) STT.stop();
  activeId = id; layout(); pushInfobars(); pushTabs();
  const wc = t.view.webContents;
  if (t.url.startsWith('alethra://home') && !t.loading) setTimeout(() => focusOmni(), 50); else wc.focus();
  ctx.sendChrome('find', { open: false });
}
function closeTab(id) {
  const i = ctx.tabs.findIndex(x => x.id === id); if (i < 0) return;
  const t = ctx.tabs[i];
  if (STT.activeTabId() === id) STT.stop();
  dropInfobars(id, 'dismiss');
  if (!t.incog && t.url && !t.url.startsWith('alethra://')) { closed.push({ title: t.title, url: t.url }); if (closed.length > 25) closed.shift(); }
  ctx.tabs.splice(i, 1);
  try { win.contentView.removeChildView(t.view); } catch {}
  try { t.view.webContents.close(); } catch {}
  if (t.incog && !ctx.tabs.some(x => x.incog)) wipeIncog();
  if (!ctx.tabs.length) { win.close(); return; }
  if (activeId === id) selectTab(ctx.tabs[Math.min(i, ctx.tabs.length - 1)].id); else { layout(); pushTabs(); }
}
async function wipeIncog() { try { const s = session.fromPartition(INCOG); await s.clearStorageData(); await s.clearCache(); } catch {} }
function reopenClosed() { const c = closed.pop(); if (c) createTab(c.url); }
async function newIncogTab(url) {
  const l = setting('lock');
  if (l && l.mode === 'parts' && (l.parts || []).includes('incog')) { if (!(await needAuth('incog'))) return; }
  createTab(url || 'alethra://home', { incog: true });
}
function cycle(d) { const i = ctx.tabs.findIndex(t => t.id === activeId); selectTab(ctx.tabs[(i + d + ctx.tabs.length) % ctx.tabs.length].id); }
function openInternal(name) {
  const cur = curTab();
  if (cur && internalName(cur.url) === name) return selectTab(cur.id);
  const ex = ctx.tabs.find(t => internalName(t.url) === name && !t.incog);
  if (ex) return selectTab(ex.id);
  createTab('alethra://' + name);
}
function focusOmni(sel = true) { if (!alive(chromeWC)) return; chromeWC.focus(); sendTo(chromeWC, 'focus-omni', sel); }

function addHistory(t, url) {
  if (t.incog || !/^https?:/.test(url)) return;
  const h = ctx.hist.data, last = h[h.length - 1];
  if (last && last.u === url && Date.now() - last.ts < 4000) { last.t = t.title || last.t; return; }
  h.push({ u: url, t: t.title || url, ts: Date.now() });
  if (h.length > 6000) h.splice(0, h.length - 6000);
  ctx.hist.save();
}

function wire(t) {
  const wc = t.view.webContents;
  wc.setWindowOpenHandler((d) => {
    if (!/^(https?|about):/i.test(d.url) || (/^file:/i.test(d.url) && !SV.localOk(d.url))) return { action: 'deny' };
    if (d.disposition === 'new-window' && d.features && /width|height/.test(d.features)) {
      return { action: 'allow', overrideBrowserWindowOptions: { autoHideMenuBar: true, width: 520, height: 720, icon: path.join(__dirname, '..', '..', 'build', 'icon.png') } };
    }
    createTab(d.url, { incog: t.incog, activate: d.disposition !== 'background-tab', index: ctx.tabs.indexOf(t) + 1 });
    return { action: 'deny' };
  });
  const guardNav = (e, url) => { if (!SV.localOk(url) || (/^alethra:/.test(url) && !t.url.startsWith('alethra://') && false)) e.preventDefault(); };
  wc.on('will-navigate', guardNav); wc.on('will-redirect', guardNav);
  wc.on('page-title-updated', (_e, title) => { t.title = title; if (!t.incog && /^https?:/.test(t.url)) { const h = ctx.hist.data[ctx.hist.data.length - 1]; if (h && h.u === t.url) h.t = title; } pushTabs(); });
  wc.on('page-favicon-updated', (_e, f) => { t.icon = f[0] || ''; pushTabs(); });
  wc.on('did-start-loading', () => { t.loading = true; pushTabs(); });
  wc.on('did-stop-loading', () => { t.loading = false; pushTabs(); });
  wc.on('did-start-navigation', (d) => {
    const e = d.isMainFrame !== undefined ? d : {}; if (!e.isMainFrame || e.isSameDocument) return;
    dropInfobars(t.id, 'dismiss');
    if (STT.activeTabId() === t.id) STT.stop();
  });
  const onNav = (_e, url) => {
    t.url = url;
    const h = U.hostOf(url);
    if (h) { const z = (setting('zoomMap') || {})[h]; wc.setZoomFactor(z || 1); try { wc.setUserAgent(SV.isMobileSite(h) ? SV.MOBILE_UA : SV.UA); } catch {} }
    addHistory(t, url); pushTabs();
  };
  wc.on('did-navigate', onNav);
  wc.on('did-navigate-in-page', (_e, url, main) => { if (main) { t.url = url; addHistory(t, url); pushTabs(); } });
  wc.on('did-finish-load', () => {
    t.url = wc.getURL() || t.url;
    const u = t.url;
    if (/^alethra:\/\/home/.test(u) === false && t.trOn && /^https?:/.test(u)) startPageTr(t);
    if (/^https?:/.test(u) && setting('tr')) wc.executeJavaScript(`window.__alCfg={on:true,lang:${JSON.stringify(setting('trLang'))},hide:${!!setting('trhide')}};` + injectScript('translate.js')).catch(() => {});
    pushTabs();
  });
  wc.on('did-fail-load', (_e, code, desc, url, isMain) => {
    if (!isMain || code === -3) return;
    if (t.upgraded && url.startsWith('https://') && t.upgraded === 'http://' + url.slice(8)) { const u = t.upgraded; t.upgraded = null; wc.loadURL(u).catch(() => {}); return; }
    if (/^alethra:/.test(url)) return;
    t.url = url;
    wc.loadURL('alethra://error?c=' + code + '&d=' + encodeURIComponent(desc) + '&u=' + encodeURIComponent(url)).catch(() => {});
  });
  wc.on('render-process-gone', () => { ctx.toast('Tab berhenti bekerja, memuat ulang…'); setTimeout(() => { try { wc.reload(); } catch {} }, 600); });
  wc.on('audio-state-changed', (e) => { t.audible = e.audible; pushTabs(); });
  wc.on('enter-html-full-screen', () => { if (STT.activeTabId() === t.id) STT.setFs(true); htmlFs = true; win.setFullScreen(true); ctx.sendChrome('fullscreen', true); layout(); });
  wc.on('leave-html-full-screen', () => { if (STT.activeTabId() === t.id) STT.setFs(false); htmlFs = false; if (!userFs) win.setFullScreen(false); ctx.sendChrome('fullscreen', false); layout(); });
  wc.on('found-in-page', (_e, r) => ctx.sendChrome('find', { open: true, ordinal: r.activeMatchOrdinal, total: r.matches }));
  wc.on('certificate-error', async (event, url, error, cert, cb) => {
    event.preventDefault();
    const host = U.hostOf(url); t.sslOk = t.sslOk || new Set();
    if (t.sslOk.has(host)) return cb(true);
    const ok = await askModal('confirm', { title: 'Koneksi tidak aman', text: `${host}\n${error}\n\nJangan lanjutkan kecuali Anda yakin situs ini aman.`, ok: 'Lanjutkan (tidak aman)', cancel: 'Kembali', danger: true });
    if (ok) t.sslOk.add(host); cb(!!ok);
  });
  wc.on('login', async (event, details, info, cb) => {
    event.preventDefault();
    const r = await askModal('auth', { host: info.host, realm: info.realm });
    if (r && r.u !== undefined) cb(r.u, r.p); else cb();
  });
  wc.on('before-input-event', (e, input) => { if (shortcut(e, input)) e.preventDefault(); });
  wc.on('focus', () => closePopups());
  wc.on('context-menu', (_e, p) => showContextMenu(t, p));
  wc.on('devtools-opened', () => {});
}
const injects = {};
function injectScript(name) { return injects[name] || (injects[name] = fs.readFileSync(path.join(__dirname, '..', 'inject', name), 'utf8')); }
function startPageTr(t) { t.view.webContents.executeJavaScript(injectScript('pagetr.js') + `;window.__alPT&&window.__alPT.start(${JSON.stringify(setting('trLang'))})`).catch(() => {}); }
function injectTrAll() {
  const on = !!setting('tr');
  ctx.tabs.forEach(t => { if (!/^https?:/.test(t.url)) return; t.view.webContents.executeJavaScript(`window.__alCfg={on:${on},lang:${JSON.stringify(setting('trLang'))},hide:${!!setting('trhide')}};` + (on ? injectScript('translate.js') : '')).catch(() => {}); });
}
function sttToggle() {
  const t = curTab(); if (!t) return;
  if (setting('stt') === false) { ctx.toast('Terjemahan Suara dimatikan di Pengaturan > Play'); return; }
  STT.toggle(t);
}
function openSettingsAt(sec) {
  const ex = ctx.tabs.find(x => internalName(x.url) === 'settings' && !x.incog);
  if (ex) { selectTab(ex.id); ex.view.webContents.executeJavaScript(`location.hash=${JSON.stringify('#' + sec)}`).catch(() => {}); }
  else createTab('alethra://settings#' + sec);
}
function togglePageTr() {
  const t = curTab(); if (!t || !/^https?:/.test(t.url)) return ctx.toast('Buka sebuah situs dulu untuk menerjemahkan');
  t.trOn = !t.trOn;
  if (t.trOn) { startPageTr(t); ctx.toast('Menerjemahkan ke ' + (U.TR_LANGS[setting('trLang')] || setting('trLang'))); }
  else { t.view.webContents.executeJavaScript('window.__alPT&&window.__alPT.stop()').catch(() => {}); ctx.toast('Terjemahan dimatikan'); }
  pushTabs();
}

/* ipc halaman: skrip yang disuntikkan saat dokumen mulai */
ipcMain.on('page:init', (e) => {
  let js = '';
  try {
    const u = e.senderFrame.url, h = U.hostOf(u);
    if (h && setting('adblock') && U.matchDomain(h, ['youtube.com'])) js += injectScript('adblock.js') + '\n';
    if (h && setting('sadblock')) js += `window.__alOff=${JSON.stringify(setting('sadoff') || [])};` + injectScript('siteads.js') + '\n';
    if (h && setting('tr') && e.senderFrame === e.sender.mainFrame) js += `window.__alCfg={on:true,lang:${JSON.stringify(setting('trLang'))},hide:${!!setting('trhide')}};` + injectScript('translate.js') + '\n';
  } catch {}
  e.returnValue = { js };
});

/* ================= navigasi dari omnibox ================= */
function engineUrl() { const k = setting('engine'); if (k === 'custom' && /%s|^https?:/.test(setting('customEngine'))) { const c = setting('customEngine'); return c.includes('%s') ? c.replace('%s', '') : c; } return (U.ENGINES[k] || U.ENGINES.google).u; }
function navigateInput(text) {
  const t = curTab(); if (!t) return;
  const u = U.toUrl(text, engineUrl(), true); if (!u) return;
  go(t, u); t.view.webContents.focus();
}
async function suggest(q) {
  q = (q || '').trim(); if (!q) { OV.suggest = null; renderOverlay(); return; }
  const items = []; const ql = q.toLowerCase();
  items.push({ k: 'go', title: U.toUrl(q, engineUrl(), true).startsWith(engineUrl()) ? `Cari “${q}”` : 'Buka ' + q, sub: '', target: q });
  if (setting('suggest')) {
    const l = setting('lock'); const bmLocked = l.mode === 'parts' && (l.parts || []).includes('bookmarks') && !authFresh();
    if (!bmLocked) ctx.bm.data.filter(b => (b.t || '').toLowerCase().includes(ql) || b.u.toLowerCase().includes(ql)).slice(0, 4).forEach(b => items.push({ k: 'bm', title: b.t || b.u, sub: U.prettyUrl(b.u), target: b.u }));
    const seen = new Set(items.map(i => i.target)); const h = ctx.hist.data;
    for (let i = h.length - 1, n = 0; i >= 0 && n < 5 && i > h.length - 2500; i--) {
      const x = h[i]; if (seen.has(x.u)) continue;
      if ((x.t || '').toLowerCase().includes(ql) || x.u.toLowerCase().includes(ql)) { seen.add(x.u); n++; items.push({ k: 'hist', title: x.t || x.u, sub: U.prettyUrl(x.u), target: x.u }); }
    }
  }
  OV.suggest = { items, sel: -1, x: 0, w: 0 }; renderOverlay();
}

/* ================= kunci aplikasi ================= */
let lastAuth = 0, lastLeft = 0, locked = false;
const authFresh = () => Date.now() - lastAuth < Math.max(15000, (setting('lock').grace || 0));
async function needAuth(part) {
  const l = setting('lock');
  if (!l.hash) return true;
  if (!(l.mode === 'parts' && (l.parts || []).includes(part))) return true;
  if (authFresh()) return true;
  const r = await askModal('pin', { reason: { incog: 'Tab Incognito', bookmarks: 'Bookmark', passwords: 'Kata sandi' }[part] || 'Alethra' }, true);
  if (r && SV.verifyPin(r.pin)) { lastAuth = Date.now(); return true; }
  return false;
}
async function lockApp() {
  const l = setting('lock'); if (l.mode !== 'app' || !l.hash || locked) return;
  locked = true;
  for (;;) { const r = await askModal('pin', { reason: 'Alethra terkunci', title: 'Masukkan PIN' }, false); if (r && SV.verifyPin(r.pin)) break; if (r) ctx.toast('PIN salah'); }
  locked = false; lastAuth = Date.now(); endModal(null);
}

/* ================= menu konteks (asli Windows) ================= */
function showContextMenu(t, p) {
  const wc = t.view.webContents, m = new Menu(), add = (o) => m.append(new MenuItem(o)), sep = () => m.append(new MenuItem({ type: 'separator' }));
  const tab = (u, inc) => createTab(u, { incog: inc || t.incog, activate: !inc ? true : true, index: ctx.tabs.indexOf(t) + 1 });
  if (p.misspelledWord) { (p.dictionarySuggestions || []).slice(0, 5).forEach(s => add({ label: s, click: () => wc.replaceMisspelling(s) })); if (p.dictionarySuggestions && p.dictionarySuggestions.length) sep(); }
  if (p.linkURL && /^https?:/.test(p.linkURL)) {
    add({ label: 'Buka tautan di tab baru', click: () => createTab(p.linkURL, { incog: t.incog, activate: false, index: ctx.tabs.indexOf(t) + 1 }) });
    add({ label: 'Buka tautan di tab Incognito', click: () => newIncogTab(p.linkURL) });
    add({ label: 'Salin alamat tautan', click: () => clipboard.writeText(p.linkURL) });
    add({ label: 'Simpan tautan sebagai…', click: () => wc.downloadURL(p.linkURL) });
    sep();
  }
  if (p.mediaType === 'image' && p.srcURL) {
    add({ label: 'Buka gambar di tab baru', click: () => /^https?:/.test(p.srcURL) && tab(p.srcURL) });
    add({ label: 'Simpan gambar sebagai…', click: () => saveImage(t, p.srcURL) });
    add({ label: 'Salin gambar', click: () => wc.copyImageAt(p.x, p.y) });
    add({ label: 'Salin alamat gambar', enabled: !p.srcURL.startsWith('data:'), click: () => clipboard.writeText(p.srcURL) });
    sep();
  }
  if (p.mediaType === 'video' && p.srcURL && /^https?:/.test(p.srcURL)) { add({ label: 'Simpan video sebagai…', click: () => wc.downloadURL(p.srcURL) }); sep(); }
  if (p.isEditable) { add({ role: 'undo', label: 'Urungkan' }); add({ role: 'redo', label: 'Ulangi' }); sep(); add({ role: 'cut', label: 'Potong' }); add({ role: 'copy', label: 'Salin' }); add({ role: 'paste', label: 'Tempel' }); add({ role: 'selectAll', label: 'Pilih semua' }); sep(); }
  else if (p.selectionText) {
    const s = p.selectionText.trim();
    add({ role: 'copy', label: 'Salin' });
    add({ label: `Cari “${s.length > 28 ? s.slice(0, 28) + '…' : s}”`, click: () => createTab(engineUrl() + encodeURIComponent(s), { incog: t.incog, index: ctx.tabs.indexOf(t) + 1 }) });
    sep();
  }
  if (!p.isEditable && !p.linkURL && p.mediaType === 'none') {
    let b = false, f = false; try { b = wc.navigationHistory.canGoBack(); f = wc.navigationHistory.canGoForward(); } catch {}
    add({ label: 'Kembali', enabled: b, click: () => wc.navigationHistory.goBack() });
    add({ label: 'Maju', enabled: f, click: () => wc.navigationHistory.goForward() });
    add({ label: 'Muat ulang', click: () => wc.reload() });
    sep();
    add({ label: 'Simpan halaman offline', click: () => SV.saveOffline(t) });
    add({ label: 'Cetak…', click: () => wc.print() });
    add({ label: t.trOn ? 'Matikan terjemahan' : 'Terjemahkan halaman', click: () => togglePageTr() });
    sep();
  }
  add({ label: 'Lihat sumber halaman', click: () => /^https?:/.test(t.url) && createTab('view-source:' + t.url, { incog: t.incog }) });
  add({ label: 'Periksa elemen', click: () => { wc.inspectElement(p.x, p.y); if (wc.isDevToolsOpened()) wc.devToolsWebContents.focus(); } });
  m.popup({ window: win });
}
async function saveImage(t, src) {
  const wc = t.view.webContents;
  if (/^data:/.test(src)) {
    const m = /^data:([^;,]+)?(;base64)?,(.*)$/s.exec(src); if (!m) return;
    const mime = m[1] || 'image/png', buf = m[2] ? Buffer.from(m[3], 'base64') : Buffer.from(decodeURIComponent(m[3]));
    const r = await dialog.showSaveDialog(win, { defaultPath: path.join(SV.dlDir(), 'gambar' + (SV.EXT[mime] || '.png')) });
    if (!r.canceled) { fs.writeFileSync(r.filePath, buf); ctx.toast('Gambar disimpan'); }
  } else wc.downloadURL(src);
}

/* ================= pintasan keyboard ================= */
let userFs = false;
const ZOOMS = [0.25, 0.33, 0.5, 0.67, 0.75, 0.8, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2, 2.5, 3, 4, 5];
function zoomBy(d) {
  const t = curTab(); if (!t) return; const wc = t.view.webContents;
  let f = d === 0 ? 1 : wc.getZoomFactor(); if (d) { let i = ZOOMS.findIndex(z => z >= f - 0.001); if (i < 0) i = 7; i = Math.max(0, Math.min(ZOOMS.length - 1, i + d)); f = ZOOMS[i]; }
  wc.setZoomFactor(f); const h = U.hostOf(t.url);
  if (h && !t.url.startsWith('alethra://')) { const zm = Object.assign({}, setting('zoomMap')); if (f === 1) delete zm[h]; else zm[h] = f; saveSetting('zoomMap', zm); }
  ctx.toast('Zoom ' + Math.round(f * 100) + '%'); pushTabs();
}
function setFullscreen(v) { userFs = v; win.setFullScreen(v); htmlFs = v; ctx.sendChrome('fullscreen', v); layout(); }
function shortcut(e, i) {
  if (i.type !== 'keyDown') return false;
  const k = (i.key || '').toLowerCase(), c = i.control || i.meta, s = i.shift, a = i.alt;
  const run = (f) => { f(); return true; };
  if (k === 'f11') return run(() => setFullscreen(!win.isFullScreen()));
  if (k === 'escape' && userFs && !a && !c) return run(() => setFullscreen(false));
  if (k === 'f5' || (c && k === 'r' && !s && !a)) return run(() => (c && i.shift ? curWC().reloadIgnoringCache() : curWC().reload()));
  if ((c && s && k === 'r') || (c && k === 'f5')) return run(() => curWC().reloadIgnoringCache());
  if (k === 'f12' || (c && s && k === 'i')) return run(() => { const w = curWC(); w.isDevToolsOpened() ? w.closeDevTools() : w.openDevTools({ mode: 'right' }); });
  if (k === 'f6' || (c && k === 'l') || (a && k === 'd')) return run(() => focusOmni());
  if (k === 'f3' || (c && k === 'g')) return run(() => findNext(!s));
  if (a && k === 'arrowleft') return run(() => curWC().navigationHistory.goBack());
  if (a && k === 'arrowright') return run(() => curWC().navigationHistory.goForward());
  if (a && k === 'home') return run(() => go(curTab(), setting('home') || 'alethra://home'));
  if (!c) return false;
  if (k === 't' && !s && !a) return run(() => createTab('alethra://home'));
  if (k === 't' && s) return run(reopenClosed);
  if (k === 'n' && s) return run(() => newIncogTab());
  if (k === 'n' && !s) return run(() => createTab('alethra://home'));
  if (k === 'w' || k === 'f4') return run(() => closeTab(activeId));
  if (k === 'tab') return run(() => cycle(s ? -1 : 1));
  if (k === 'pagedown') return run(() => cycle(1));
  if (k === 'pageup') return run(() => cycle(-1));
  if (/^[1-9]$/.test(k) && !s) return run(() => { const n = +k; selectTab((n === 9 ? ctx.tabs[ctx.tabs.length - 1] : ctx.tabs[n - 1] || ctx.tabs[ctx.tabs.length - 1]).id); });
  if (k === 'd' && !s) return run(toggleBookmark);
  if (k === 'b' && s) return run(() => { saveSetting('bmbar', !setting('bmbar')); applyTheme(); });
  if (k === 'h') return run(() => openInternal('history'));
  if (k === 'j') return run(() => openInternal('downloads'));
  if (k === 'o' && s) return run(() => openInternal('bookmarks'));
  if (k === ',') return run(() => openInternal('settings'));
  if (k === 'f' && !s) return run(() => { chromeWC.focus(); ctx.sendChrome('find', { open: true, focus: true }); });
  if (k === 'p') return run(() => curWC().print());
  if (a && k === 's') return run(sttToggle);
  if (k === 's') return run(() => SV.saveOffline(curTab()));
  if (k === 'u') return run(() => { const t = curTab(); /^https?:/.test(t.url) && createTab('view-source:' + t.url, { incog: t.incog }); });
  if (k === '=' || k === '+') return run(() => zoomBy(1));
  if (k === '-' || k === '_') return run(() => zoomBy(-1));
  if (k === '0') return run(() => zoomBy(0));
  if (k === 'delete' && s) return run(clearDataDialog);
  if (a && k === 'r') return run(readerMode);
  if (a && k === 't') return run(togglePageTr);
  return false;
}
function findNext(fwd) { const t = curTab(); if (t && t.find) t.view.webContents.findInPage(t.find, { forward: fwd, findNext: true }); }
function toggleBookmark() {
  const t = curTab(); if (!t || !/^https?:/.test(t.url)) return ctx.toast('Hanya halaman web yang bisa di-bookmark');
  const i = ctx.bm.data.findIndex(b => b.u === t.url);
  if (i >= 0) { ctx.bm.data.splice(i, 1); ctx.toast('Bookmark dihapus'); } else { ctx.bm.data.push({ id: Date.now(), t: t.title, u: t.url, f: '', ts: Date.now() }); ctx.toast('Bookmark ditambahkan'); }
  ctx.bm.save(); pushTabs(); sendBm();
}
function sendBm() { ctx.sendChrome('bookmarks', ctx.bm.data.slice(0, 60)); ctx.broadcastPages('bookmarks', null); }
async function clearDataDialog() { openInternal('settings'); setTimeout(() => ctx.broadcastPages('open-clear', null), 400); }

/* ================= mode baca ================= */
async function readerMode() {
  const t = curTab(); if (!t || !/^https?:/.test(t.url)) return ctx.toast('Buka sebuah situs dulu');
  const wc = t.view.webContents;
  try { const pr = await wc.executeJavaScript('window.__alRdPref||""'); if (pr) { const o = JSON.parse(pr); saveSetting('rdsize', o.size); saveSetting('rdtheme', o.theme); } } catch {}
  const th = ['light', 'sepia', 'dark'].includes(setting('rdtheme')) ? setting('rdtheme') : (isDark() ? 'dark' : 'light');
  const js = injectScript('reader.js').replace('__SIZE__', Math.max(14, Math.min(28, setting('rdsize') | 0 || 18))).replace("'__THEME__'", JSON.stringify(th)).replace('__RATE__', '1');
  const r = await wc.executeJavaScript(js, true).catch(() => 'no');
  if (r === 'no') ctx.toast('Halaman ini tidak cocok untuk mode baca');
}

/* ================= video: kualitas & PiP ================= */
async function videoQuality() {
  const t = curTab(); if (!t) return; const wc = t.view.webContents;
  await wc.executeJavaScript(injectScript('vq.js') + ';window.__alVQ.start()').catch(() => {});
  await new Promise(r => setTimeout(r, 1100));
  let r = null; try { r = JSON.parse(await wc.executeJavaScript('window.__alVQ&&window.__alVQ.res()') || 'null'); } catch {}
  if (!r || !r.items || !r.items.length) return ctx.toast('Kualitas video tidak tersedia di halaman ini');
  const m = new Menu();
  r.items.forEach((it, i) => m.append(new MenuItem({ label: it.l, type: 'radio', checked: !!it.c, click: () => { wc.executeJavaScript(`window.__alVQ.pick(${i});window.__alVQ.close&&setTimeout(function(){window.__alVQ.close()},600)`).catch(() => {}); } })));
  m.popup({ window: win });
}
function pip() {
  const t = curTab(); if (!t) return;
  t.view.webContents.executeJavaScript(`(function(){var v=[].slice.call(document.querySelectorAll('video'));var p=v.filter(function(x){return !x.paused})[0]||v[0];if(!p)return 'no';if(document.pictureInPictureElement){document.exitPictureInPicture();return 'ok'}return p.requestPictureInPicture().then(function(){return 'ok'}).catch(function(){return 'err'})})()`, true)
    .then(r => { if (r === 'no') ctx.toast('Tidak ada video di halaman ini'); else if (r === 'err') ctx.toast('Video ini tidak mendukung gambar-dalam-gambar'); }).catch(() => {});
}

/* ================= menu utama (overlay) ================= */
function mainMenuSpec() {
  const t = curTab(), st = t ? tabState().find(x => x.id === t.id) : {};
  const I = (id, label, o = {}) => Object.assign({ id, label }, o);
  return [
    I('tab.new', 'Tab baru', { key: 'Ctrl+T' }), I('tab.incog', 'Tab Incognito baru', { key: 'Ctrl+Shift+N' }), I('tab.reopen', 'Buka tab tertutup', { key: 'Ctrl+Shift+T', off: !closed.length }),
    { sep: 1 },
    I('open.bookmarks', 'Bookmark', { key: 'Ctrl+Shift+O' }), I('open.history', 'Histori', { key: 'Ctrl+H' }), I('open.downloads', 'Unduhan', { key: 'Ctrl+J' }), I('open.offline', 'Halaman offline'), I('open.passwords', 'Kata sandi'),
    { sep: 1 },
    { zoom: st.zoom || 100 },
    { sep: 1 },
    I('clear', 'Hapus data penjelajahan', { key: 'Ctrl+Shift+Del' }), I('fullscreen', 'Layar penuh', { key: 'F11' }), I('devtools', 'Alat pengembang', { key: 'F12' }),
    { sep: 1 },
    I('open.settings', 'Pengaturan', { key: 'Ctrl+,' }), I('open.about', 'Tentang Alethra'), I('quit', 'Keluar')
  ];
}
/* ================= menu Tools (overlay) ================= */
// Item mana yang tampil diatur di Pengaturan > Tools. Fitur yang dimatikan di Pengaturan > Play ikut disembunyikan.
function toolsMenuSpec() {
  const t = curTab(), st = t ? tabState().find(x => x.id === t.id) : {}, web = t && /^https?:/.test(t.url);
  const I = (id, label, o = {}) => Object.assign({ id, label }, o);
  const cfg = setting('tools');
  const on = (k) => cfg[k] !== false;
  const groups = [
    [on('find') && I('find', 'Cari di halaman', { key: 'Ctrl+F', off: !web }),
     on('print') && I('print', 'Cetak…', { key: 'Ctrl+P', off: !web }),
     on('pdf') && I('pdf', 'Simpan sebagai PDF', { off: !web }),
     on('offline') && I('offline.save', 'Simpan halaman offline', { key: 'Ctrl+S', off: !web })],
    [on('translate') && setting('ptr') !== false && I('translate', 'Terjemahkan halaman', { key: 'Ctrl+Alt+T', check: !!st.trOn, off: !web }),
     on('chat') && I('chat', 'Terjemahkan chat live', { check: !!setting('tr') }),
     on('stt') && setting('stt') !== false && I('stt', 'Terjemahan Suara', { key: 'Ctrl+Alt+S', check: STT.active(), off: !web }),
     on('reader') && I('reader', 'Mode baca', { key: 'Ctrl+Alt+R', off: !web })],
    [on('vq') && I('vq', 'Kualitas video…', { off: !web }),
     on('pip') && I('pip', 'Gambar dalam gambar', { off: !web }),
     on('mobile') && I('mobile', 'Tampilan situs seluler', { check: !!st.mobile, off: !web }),
     on('adsite') && I('adsite', 'Blokir iklan di situs ini', { check: web && !st.adoff, off: !web })]
  ].map(g => g.filter(Boolean)).filter(g => g.length);
  const out = [];
  groups.forEach((g, i) => { if (i) out.push({ sep: 1 }); out.push(...g); });
  if (!out.length) out.push(I('tools.config', 'Belum ada alat. Atur di Pengaturan → Tools'));
  else { out.push({ sep: 1 }); out.push(I('tools.config', 'Atur menu Tools…')); }
  return out;
}
function openMenu(kind, right) {
  OV.suggest = null;
  OV.menu = kind === 'tools' ? { kind, items: toolsMenuSpec(), right: Math.max(8, right | 0) } : { kind: 'main', items: mainMenuSpec() };
  renderOverlay();
}
function menuAction(id) {
  OV.menu = null; renderOverlay();
  const t = curTab(), wc = curWC();
  switch (id) {
    case 'tab.new': return createTab('alethra://home');
    case 'tab.incog': return newIncogTab();
    case 'tab.reopen': return reopenClosed();
    case 'tools.config': { const ex = ctx.tabs.find(x => internalName(x.url) === 'settings' && !x.incog); if (ex) { go(ex, 'alethra://settings#tools'); return selectTab(ex.id); } return createTab('alethra://settings#tools'); }
    case 'find': chromeWC.focus(); return ctx.sendChrome('find', { open: true, focus: true });
    case 'print': return wc.print();
    case 'pdf': return wc.printToPDF({ printBackground: true }).then(async b => { const r = await dialog.showSaveDialog(win, { defaultPath: path.join(SV.dlDir(), (t.title || 'halaman').replace(/[<>:"/\\|?*]/g, '_') + '.pdf') }); if (!r.canceled) { fs.writeFileSync(r.filePath, b); ctx.toast('PDF disimpan'); } });
    case 'offline.save': return SV.saveOffline(t);
    case 'translate': return togglePageTr();
    case 'chat': { saveSetting('tr', !setting('tr')); injectTrAll(); applyTheme(); return ctx.toast(setting('tr') ? 'Terjemahan chat live aktif (YouTube, Twitch)' : 'Terjemahan chat live dimatikan'); }
    case 'stt': return sttToggle();
    case 'reader': return readerMode();
    case 'vq': return videoQuality();
    case 'pip': return pip();
    case 'mobile': { const h = U.hostOf(t.url); if (!h) return; const l = new Set(setting('mobileSites')); l.has(h) ? l.delete(h) : l.add(h); saveSetting('mobileSites', [...l]); wc.setUserAgent(l.has(h) ? SV.MOBILE_UA : SV.UA); wc.reloadIgnoringCache(); return; }
    case 'adsite': { const h = U.hostOf(t.url); if (!h) return; let l = (setting('sadoff') || []).slice(); const on = l.some(d => h === d || h.endsWith('.' + d)); if (on) l = l.filter(d => !(h === d || h.endsWith('.' + d))); else l.push(h); saveSetting('sadoff', l); if (!setting('sadblock')) saveSetting('sadblock', true); ctx.toast(on ? 'Blokir iklan dimatikan untuk ' + h : 'Blokir iklan aktif untuk ' + h); wc.reload(); return; }
    case 'clear': return clearDataDialog();
    case 'fullscreen': return setFullscreen(!win.isFullScreen());
    case 'devtools': return wc.openDevTools({ mode: 'right' });
    case 'quit': return app.quit();
    default: if (id.startsWith('open.')) return openInternal(id.slice(5));
  }
}

/* ================= sesi tersimpan ================= */
function saveSessionSoon() { clearTimeout(saveT); saveT = setTimeout(saveSession, 1500); }
function saveSession() {
  ctx.sess.data = { tabs: ctx.tabs.filter(t => !t.incog && t.url && !t.url.startsWith('alethra://error')).map(t => ({ u: t.url })), active: Math.max(0, ctx.tabs.filter(t => !t.incog).findIndex(t => t.id === activeId)) };
  ctx.sess.flush();
}

/* ================= API untuk UI & halaman internal ================= */
const UIONLY = new Set(['ui.ready', 'tab.new', 'tab.close', 'tab.select', 'tab.move', 'tab.menu', 'nav.back', 'nav.forward', 'nav.reload', 'nav.stop', 'nav.home', 'omni.suggest', 'omni.sel', 'omni.hide', 'omni.go', 'menu.open', 'ov.menu', 'ov.zoom', 'ov.pick', 'ov.close', 'modal.result', 'bookmark.toggle', 'find.start', 'find.next', 'find.stop', 'infobar.act', 'chrome.height', 'tab.mute', 'dl.open', 'stt.stop', 'stt.drag', 'tools.open']);
const SETKEYS = Object.keys(SV.DEFAULTS).filter(k => k !== 'lock');
const API = {
  'ui.ready': () => ({ settings: publicSettings(), tabs: tabState(), bookmarks: ctx.bm.data.slice(0, 60), dl: SV.dlSummary() }),
  'tab.new': (e, u) => createTab(u || 'alethra://home'),
  'tab.close': (e, id) => closeTab(id),
  'tab.select': (e, id) => selectTab(id),
  'tab.move': (e, id, to) => { const i = ctx.tabs.findIndex(t => t.id === id); if (i < 0) return; const [t] = ctx.tabs.splice(i, 1); ctx.tabs.splice(Math.max(0, Math.min(ctx.tabs.length, to)), 0, t); pushTabs(); },
  'tab.mute': (e, id) => { const t = ctx.tabs.find(x => x.id === id); if (t) { t.muted = !t.muted; t.view.webContents.setAudioMuted(t.muted); pushTabs(); } },
  'tab.menu': (e, id) => {
    const t = ctx.tabs.find(x => x.id === id); if (!t) return; const wc = t.view.webContents, i = ctx.tabs.indexOf(t);
    Menu.buildFromTemplate([
      { label: 'Muat ulang', click: () => wc.reload() },
      { label: 'Duplikat tab', click: () => createTab(t.url, { incog: t.incog, index: i + 1 }) },
      { label: t.muted ? 'Aktifkan suara tab' : 'Bisukan tab', click: () => API['tab.mute'](null, id) },
      { type: 'separator' },
      { label: 'Tutup tab', click: () => closeTab(id) },
      { label: 'Tutup tab lain', enabled: ctx.tabs.length > 1, click: () => ctx.tabs.filter(x => x.id !== id).forEach(x => closeTab(x.id)) },
      { label: 'Tutup tab di kanan', enabled: i < ctx.tabs.length - 1, click: () => ctx.tabs.slice(i + 1).forEach(x => closeTab(x.id)) }
    ]).popup({ window: win });
  },
  'nav.back': () => curWC().navigationHistory.goBack(),
  'nav.forward': () => curWC().navigationHistory.goForward(),
  'nav.reload': () => curWC().reload(),
  'nav.stop': () => curWC().stop(),
  'nav.home': () => go(curTab(), 'alethra://home'),
  'nav.to': (e, u) => { const t = tabByWc(e.sender); if (t && /^(https?|alethra):/.test(u)) go(t, u); },
  'nav.open': (e, u, bg) => { const t = tabByWc(e.sender); if (/^(https?|alethra):/.test(u)) createTab(u, { incog: t && t.incog, activate: !bg, index: t ? ctx.tabs.indexOf(t) + 1 : undefined }); },
  'omni.suggest': (e, q, x, w) => suggest(q).then(() => { if (OV.suggest) { OV.suggest.x = x; OV.suggest.w = w; renderOverlay(); } return OV.suggest ? OV.suggest.items.length : 0; }),
  'omni.sel': (e, i) => { if (OV.suggest) { OV.suggest.sel = i; renderOverlay(); } },
  'omni.hide': () => closePopups(),
  'omni.go': (e, text, i) => { const it = OV.suggest && OV.suggest.items[i]; closePopups(); navigateInput(it ? it.target : text); },
  'ov.pick': (e, i) => { const it = OV.suggest && OV.suggest.items[i]; closePopups(); if (it) navigateInput(it.target); },
  'ov.close': () => { closePopups(); sendTo(chromeWC, 'omni-blur'); },
  'menu.open': () => { if (OV.menu) { closePopups(); return; } openMenu('main'); },
  'tools.open': (e, right) => { if (OV.menu) { closePopups(); return; } openMenu('tools', right); },
  'ov.menu': (e, id) => menuAction(id),
  'ov.zoom': (e, d) => { zoomBy(d); openMenu('main'); },
  'modal.result': (e, v) => endModal(v),
  'bookmark.toggle': toggleBookmark,
  'find.start': (e, text) => { const t = curTab(); if (!t) return; t.find = text; if (text) t.view.webContents.findInPage(text); else { t.view.webContents.stopFindInPage('clearSelection'); ctx.sendChrome('find', { open: true, ordinal: 0, total: 0 }); } },
  'find.next': (e, fwd) => findNext(fwd),
  'find.stop': () => { const t = curTab(); if (t) { t.find = ''; t.view.webContents.stopFindInPage('clearSelection'); t.view.webContents.focus(); } },
  'infobar.act': (e, id, key) => { const i = infobars.findIndex(x => x.id === id); if (i < 0) return; const x = infobars.splice(i, 1)[0]; try { x.done && x.done(key); } catch {} pushInfobars(); },
  'chrome.height': (e, h) => { h = Math.max(40, Math.min(300, h | 0)); if (h !== chromeH) { chromeH = h; layout(); } },

  /* pengaturan */
  'settings.get': () => publicSettings(),
  'settings.home': () => homeParams(),
  'settings.set': (e, k, v) => {
    if (!SETKEYS.includes(k)) return false;
    const d = SV.DEFAULTS[k];
    if (typeof d !== typeof v && !(k === 'wall')) return false;
    if (k === 'engine' && !(v in U.ENGINES) && v !== 'custom') return false;
    if (k === 'theme' && !['system', 'light', 'dark'].includes(v)) return false;
    if (k === 'accent' && v && !/^#[0-9a-f]{6}$/i.test(v)) return false;
    if (k === 'dlDir' && v && !fs.existsSync(v)) return false;
    if (k === 'trLang' && !U.TR_LANGS[v]) return false;
    if (k === 'doh' && !U.DOH[v]) return false;
    if (['clock', 'sta', 'stf', 'stb', 'tools'].includes(k)) { if (!v || typeof v !== 'object' || Array.isArray(v)) return false; const o = {}; for (const kk of Object.keys(d)) if (typeof v[kk] === typeof d[kk]) o[kk] = v[kk]; v = (k === 'stf' || k === 'stb') ? STT.sanitize(k, o) : o; }
    if (k === 'stprov' && !['groq', 'openai', 'custom'].includes(v)) return false;
    if (k === 'stengine' && !['cloud', 'offline'].includes(v)) return false;
    if (k === 'trmode' && !['online', 'offline'].includes(v)) return false;
    if (k === 'stmodel' && !OFF.validModel(v)) return false;
    if (k === 'ofthreads' && !(Number.isInteger(v) && v >= 0 && v <= 16)) return false;
    if (k === 'stspeed' && !['fast', 'bal', 'eco'].includes(v)) return false;
    if (k === 'stcurl' && v && !/^https?:\/\/[^\s]+$/.test(v)) return false;
    saveSetting(k, v);
    if (['sta', 'stspeed', 'stlang', 'stengine', 'stmodel', 'trmode'].includes(k)) STT.refresh();
    if (k === 'stt' && !v) STT.stop();
    if (['tr', 'trhide', 'trLang'].includes(k)) injectTrAll();
    if (k === 'doh' || k === 'dohcustom') SV.applyDoh();
    if (k === 'tr' || k === 'adblock' || k === 'sadblock') { /* berlaku di muat berikutnya */ }
    applyTheme(); return true;
  },
  /* mesin offline (suara ke teks & terjemahan) */
  'oe.list': () => OFF.list(),
  'oe.dl': (e, id) => OFF.download(String(id)),
  'oe.cancel': (e, id) => OFF.cancel(String(id)),
  'oe.del': async (e, id) => { const ok = await OFF.remove(String(id)); applyTheme(); return ok; },
  'oe.plan': (e, s, t) => OFF.plan(String(s), String(t)),
  'oe.test': async (e, text, s, t) => { try { return { ok: true, text: (await OFF.translate(String(text || '').slice(0, 300), String(s), String(t))) || String(text) }; } catch (err) { return { ok: false, err: err.message }; } },
  'oe.dir': () => OFF.openDir(),
  'stt.stop': () => STT.stop(),
  'stt.drag': (e, dx, dy) => STT.drag(+dx || 0, +dy || 0),
  'stt.resetpos': () => STT.resetPos(),
  'stt.key': (e, key) => {
    key = String(key || '').trim();
    if (!key) { delete ctx.settings.data.stkeyEnc; } else { ctx.settings.data.stkeyEnc = SV.enc(key); }
    ctx.settings.save(); applyTheme(); return true;
  },
  'shortcut.add': (e, n, u) => { u = U.toUrl(u, engineUrl(), true); if (!/^https?:/.test(u)) return false; const l = setting('shortcuts').slice(); l.push({ n: String(n || '').slice(0, 40), u }); saveSetting('shortcuts', l); applyTheme(); return true; },
  'shortcut.remove': (e, i) => { const l = setting('shortcuts').slice(); l.splice(i, 1); saveSetting('shortcuts', l); applyTheme(); },
  'wall.pick': async () => {
    const r = await dialog.showOpenDialog(win, { filters: [{ name: 'Gambar', extensions: ['jpg', 'jpeg', 'png', 'webp'] }], properties: ['openFile'] });
    if (r.canceled) return false;
    fs.copyFileSync(r.filePaths[0], path.join(ctx.dataDir, 'wallpaper.img')); saveSetting('wall', Date.now()); applyTheme(); return true;
  },
  'wall.clear': () => { try { fs.unlinkSync(path.join(ctx.dataDir, 'wallpaper.img')); } catch {} saveSetting('wall', 0); applyTheme(); },
  'dir.pick': async () => { const r = await dialog.showOpenDialog(win, { properties: ['openDirectory', 'createDirectory'] }); if (r.canceled) return false; saveSetting('dlDir', r.filePaths[0]); applyTheme(); return true; },
  'defaultBrowser.open': () => shell.openExternal('ms-settings:defaultapps'),
  'about': () => ({ version: app.getVersion(), electron: process.versions.electron, chrome: process.versions.chrome, node: process.versions.node, data: ctx.dataDir }),

  /* bookmark */
  'bm.list': async () => (await needAuth('bookmarks')) ? ctx.bm.data.slice().reverse() : { locked: true },
  'bm.add': (e, t, u, f) => { u = U.toUrl(u, engineUrl(), true); if (!/^https?:/.test(u) || ctx.bm.data.some(b => b.u === u)) return false; ctx.bm.data.push({ id: Date.now(), t: t || u, u, f: f || '', ts: Date.now() }); ctx.bm.save(); sendBm(); pushTabs(); return true; },
  'bm.update': (e, id, t, u, f) => { const b = ctx.bm.data.find(x => x.id === id); if (!b) return false; if (/^https?:/.test(u)) b.u = u; b.t = t || b.u; b.f = f || ''; ctx.bm.save(); sendBm(); pushTabs(); return true; },
  'bm.remove': (e, id) => { ctx.bm.data = ctx.bm.data.filter(b => b.id !== id); ctx.bm.save(); sendBm(); pushTabs(); },
  'bm.export': async () => { const r = await dialog.showSaveDialog(win, { defaultPath: 'bookmark-alethra.html', filters: [{ name: 'HTML', extensions: ['html'] }] }); if (r.canceled) return false; fs.writeFileSync(r.filePath, SV.exportBookmarksHtml()); ctx.toast('Bookmark diekspor'); return true; },
  'bm.import': async () => { const r = await dialog.showOpenDialog(win, { filters: [{ name: 'HTML', extensions: ['html', 'htm'] }], properties: ['openFile'] }); if (r.canceled) return -1; const n = SV.importBookmarksHtml(fs.readFileSync(r.filePaths[0], 'utf8')); sendBm(); pushTabs(); return n; },

  /* histori */
  'hist.list': (e, q) => { q = (q || '').toLowerCase(); const l = ctx.hist.data; const out = []; for (let i = l.length - 1; i >= 0 && out.length < 800; i--) { const x = l[i]; if (!q || (x.t || '').toLowerCase().includes(q) || x.u.toLowerCase().includes(q)) out.push({ i, u: x.u, t: x.t, ts: x.ts }); } return out; },
  'hist.remove': (e, ts, u) => { ctx.hist.data = ctx.hist.data.filter(x => !(x.ts === ts && x.u === u)); ctx.hist.save(); },
  'hist.clear': () => { ctx.hist.data = []; ctx.hist.save(); },

  /* unduhan */
  'dl.list': () => SV.listDownloads(),
  'dl.act': (e, id, a) => SV.dlAct(id, a),
  'dl.open': () => openInternal('downloads'),

  /* offline */
  'off.list': () => ctx.off.data.slice().reverse(),
  'off.act': (e, id, a) => {
    const x = ctx.off.data.find(o => o.id === id); if (!x) return;
    const { pathToFileURL } = require('url');
    if (a === 'open') createTab(pathToFileURL(x.mhtml).href);
    else if (a === 'pdf' && x.pdf) shell.openPath(x.pdf);
    else if (a === 'show') shell.showItemInFolder(x.mhtml);
    else if (a === 'online') createTab(x.url);
    else if (a === 'delete') { for (const f of [x.mhtml, x.pdf]) try { fs.unlinkSync(f); } catch {} ctx.off.data = ctx.off.data.filter(o => o.id !== id); ctx.off.save(); }
  },

  /* izin situs */
  'perms.list': () => SV.listPerms().map(p => Object.assign(p, { labels: SV.PERM_LABEL })),
  'perms.set': (e, host, key, v) => { if (['allow', 'block', 'ask'].includes(v) && SV.PERM_LABEL[key]) SV.setPerm(host, key, v, false); },
  'perms.clear': () => { ctx.perms.data = {}; ctx.perms.save(); },

  /* sandi */
  'pw.list': async () => (await needAuth('passwords')) ? ctx.pw.data.map((x, i) => ({ i, o: x.o, u: x.u, ts: x.ts })) : { locked: true },
  'pw.reveal': async (e, i) => (await needAuth('passwords')) && ctx.pw.data[i] ? SV.dec(ctx.pw.data[i].p) : null,
  'pw.delete': (e, i) => { ctx.pw.data.splice(i, 1); ctx.pw.save(); },

  /* data & cadangan */
  'data.clear': async (e, o) => { await SV.clearData(o || {}); ctx.toast('Data dihapus'); return true; },
  'backup.export': async () => {
    const r = await dialog.showSaveDialog(win, { defaultPath: 'cadangan-alethra.json', filters: [{ name: 'JSON', extensions: ['json'] }] }); if (r.canceled) return false;
    const s = Object.assign({}, ctx.settings.data); delete s.lock; delete s.zoomMap; delete s.stkeyEnc;
    fs.writeFileSync(r.filePath, JSON.stringify({ alethra: 1, settings: s, bookmarks: ctx.bm.data }, null, 1)); ctx.toast('Cadangan dibuat'); return true;
  },
  'backup.import': async () => {
    const r = await dialog.showOpenDialog(win, { filters: [{ name: 'JSON', extensions: ['json'] }], properties: ['openFile'] }); if (r.canceled) return false;
    try {
      const j = JSON.parse(fs.readFileSync(r.filePaths[0], 'utf8')); if (!j.alethra) return false;
      for (const k of SETKEYS) if (j.settings && k in j.settings && typeof j.settings[k] === typeof SV.DEFAULTS[k] && !['zoomMap', 'dlDir'].includes(k)) ctx.settings.data[k] = j.settings[k];
      ctx.settings.save();
      const have = new Set(ctx.bm.data.map(b => b.u)); (j.bookmarks || []).forEach(b => { if (b && /^https?:/.test(b.u) && !have.has(b.u)) ctx.bm.data.push({ id: Date.now() + Math.random(), t: String(b.t || b.u), u: b.u, f: String(b.f || ''), ts: b.ts || Date.now() }); });
      ctx.bm.save(); applyTheme(); sendBm(); SV.applyDoh(); ctx.toast('Cadangan dipulihkan'); return true;
    } catch { return false; }
  },

  /* kunci aplikasi */
  'lock.state': () => publicSettings().lock,
  'lock.set': async (e, o) => {
    const cur = setting('lock');
    if (cur.hash) { if (!(await needAuthStrict())) return { ok: false, err: 'PIN salah' }; }
    const nl = Object.assign({}, cur);
    if (o.pin) { if (!/^\d{4,12}$/.test(o.pin)) return { ok: false, err: 'PIN harus 4-12 angka' }; SV.setPin(o.pin); Object.assign(nl, setting('lock')); }
    if (o.off) { nl.mode = 'off'; nl.hash = ''; nl.salt = ''; }
    else { if (['app', 'parts', 'off'].includes(o.mode)) nl.mode = o.mode; if (Array.isArray(o.parts)) nl.parts = o.parts.filter(p => ['incog', 'bookmarks', 'passwords'].includes(p)); if (typeof o.grace === 'number') nl.grace = o.grace; if (!nl.hash) { nl.mode = 'off'; return { ok: false, err: 'Atur PIN dulu' }; } }
    saveSetting('lock', nl); lastAuth = Date.now(); applyTheme(); return { ok: true };
  }
};
async function needAuthStrict() {
  const r = await askModal('pin', { reason: 'Verifikasi untuk mengubah kunci' }, true);
  if (r && SV.verifyPin(r.pin)) { lastAuth = Date.now(); return true; }
  return false;
}
ipcMain.handle('api', async (e, name, ...args) => {
  if (!isInternalSender(e)) return null;
  if (UIONLY.has(name) && e.sender !== chromeWC && !(overlay && e.sender === overlay.webContents) && name !== 'dl.open') return null;
  const f = API[name]; if (!f) return null;
  try { return await f(e, ...args); } catch (err) { console.error('api', name, err); return null; }
});

/* ================= jendela & siklus hidup ================= */
function createWindow() {
  const c = barColors();
  win = new BrowserWindow({
    width: 1320, height: 840, minWidth: 640, minHeight: 420, show: false, backgroundColor: c.color, title: 'Alethra',
    icon: path.join(__dirname, '..', '..', 'build', 'icon.png'), autoHideMenuBar: true,
    titleBarStyle: 'hidden', titleBarOverlay: { color: c.color, symbolColor: c.symbolColor, height: 40 },
    webPreferences: { preload: path.join(__dirname, '..', 'preload', 'internal.js'), sandbox: true, contextIsolation: true, nodeIntegration: false }
  });
  win.setMenu(null);
  chromeWC = win.webContents;
  chromeWC.on('before-input-event', (e, input) => { if (shortcut(e, input)) e.preventDefault(); });
  overlay = new WebContentsView({ webPreferences: { preload: path.join(__dirname, '..', 'preload', 'internal.js'), sandbox: true, contextIsolation: true } });
  overlay.setBackgroundColor('#00000000');
  overlay.webContents.on('before-input-event', (e, input) => { if (input.type === 'keyDown' && input.key === 'Escape' && !OV.modal) { closePopups(); e.preventDefault(); } else if (shortcut(e, input)) e.preventDefault(); });
  win.contentView.addChildView(overlay); overlay.setVisible(false);
  overlay.webContents.loadURL('alethra://app/ui/overlay.html');
  chromeWC.loadURL('alethra://app/ui/chrome.html');
  win.once('ready-to-show', () => win.show());
  setTimeout(() => { if (win && !win.isDestroyed() && !win.isVisible()) { log('ready-to-show tidak muncul, memaksa tampil'); win.show(); } }, 4000);
  chromeWC.on('did-fail-load', (_e, code, desc, u) => { log('UI gagal dimuat', code, desc, u); dialog.showErrorBox('Alethra: UI gagal dimuat', code + ' ' + desc + '\n' + u); });
  chromeWC.on('render-process-gone', (_e, d) => log('UI crash', JSON.stringify(d)));
  chromeWC.on('console-message', (_e, lvl, msg, line, src) => { if (lvl >= 2) log('UI console', msg, src + ':' + line); });
  overlay.webContents.on('console-message', (_e, lvl, msg, line, src) => { if (lvl >= 2) log('overlay console', msg, src + ':' + line); });
  ['resize', 'maximize', 'unmaximize', 'enter-full-screen', 'leave-full-screen'].forEach(ev => win.on(ev, () => layout()));
  win.on('blur', () => { lastLeft = Date.now(); });
  win.on('minimize', () => { lastLeft = Date.now(); });
  const back = () => { if (Date.now() - lastLeft > (setting('lock').grace || 0)) lockApp(); };
  win.on('focus', back); win.on('restore', back);
  win.on('close', () => { saveSession(); });
  win.on('closed', () => { win = null; });
  chromeWC.on('did-finish-load', () => { if (!ctx.booted) { ctx.booted = true; try { boot(); } catch (e) { log('BOOT', e); } } });
}
function urlArgs(argv) { return argv.slice(1).filter(a => /^https?:\/\//i.test(a)); }
function boot() {
  const urls = urlArgs(process.argv);
  let restored = false;
  if (setting('restore') && ctx.sess.data && ctx.sess.data.tabs && ctx.sess.data.tabs.length && !urls.length) {
    const a = ctx.sess.data.active || 0;
    ctx.sess.data.tabs.slice(0, 40).forEach((x, i) => createTab(x.u, { activate: i === a }));
    restored = true;
  }
  urls.forEach(u => createTab(u));
  if (!restored && !urls.length) createTab('alethra://home');
  if (setting('lock').mode === 'app' && setting('lock').hash) lockApp();
}

app.on('second-instance', (_e, argv) => {
  if (!win) return; if (win.isMinimized()) win.restore(); win.focus();
  urlArgs(argv).forEach(u => createTab(u));
});
app.on('web-contents-created', (_e, c) => { c.on('will-attach-webview', ev => ev.preventDefault()); });
app.on('window-all-closed', () => app.quit());
app.on('before-quit', () => { quitting = true; try { OFF.shutdown(); } catch {} try { saveSession(); } catch {} wipeIncog(); [ctx.settings, ctx.bm, ctx.hist, ctx.perms, ctx.pw, ctx.off, ctx.dlStore].forEach(s => s && s.flush()); });

app.whenReady().then(() => {
  ctx.dataDir = path.join(app.getPath('userData'), 'data');
  fs.mkdirSync(ctx.dataDir, { recursive: true });
  ctx.settings = new Store(ctx.dataDir, 'settings.json', {});
  ctx.bm = new Store(ctx.dataDir, 'bookmarks.json', []);
  ctx.hist = new Store(ctx.dataDir, 'history.json', []);
  ctx.dlStore = new Store(ctx.dataDir, 'downloads.json', []);
  ctx.perms = new Store(ctx.dataDir, 'perms.json', {});
  ctx.pw = new Store(ctx.dataDir, 'passwords.json', []);
  ctx.off = new Store(ctx.dataDir, 'offline.json', []);
  ctx.sess = new Store(ctx.dataDir, 'session.json', {});
  ctx.dlList = (ctx.dlStore.data || []).map(d => d.state === 'progressing' || d.state === 'paused' ? Object.assign(d, { state: 'interrupted' }) : d);
  SV.setupSession(session.defaultSession, false);
  SV.initTranslate(); SV.applyDoh();
  ctx.refreshSettings = () => applyTheme();
  STT.init({ toast: (m) => ctx.toast(m), changed: () => renderOverlay(), script: injectScript, openSettings: openSettingsAt });
  nativeTheme.themeSource = setting('theme');
  nativeTheme.on('updated', () => applyTheme());
  createWindow();
});
API['nav.search'] = (e, text) => { const t = tabByWc(e.sender); if (t) go(t, U.toUrl(text, engineUrl(), true)); };
