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

let win, chromeWC, overlay, fsBar, chromeH = 84, pageId = 0;
const closed = [];
/* Kelompok tab berwarna. Anggota satu grup selalu berurutan di ctx.tabs; tab yang disematkan selalu di paling kiri dan tidak bisa masuk grup. */
ctx.groups = []; let groupSeq = 0;
const GCOLORS = { abu: ['Abu-abu', '#8b8d94'], biru: ['Biru', '#4f8df7'], merah: ['Merah', '#e5534b'], kuning: ['Kuning', '#d9a520'], hijau: ['Hijau', '#3fb950'], pink: ['Merah muda', '#e76bb5'], ungu: ['Ungu', '#a371f7'], sian: ['Sian', '#2fb5c0'], jingga: ['Jingga', '#f0883e'] };
const GCOLOR_IDS = Object.keys(GCOLORS);
// Tampilan terpisah: pasangan tab {a: kiri/atas, b: kanan/bawah}. activeId = panel yang sedang fokus, jadi seluruh fitur lama (omnibox, pintasan, menu) otomatis bekerja pada panel fokus.
let split = null, fsId = null, ratioLive = null, lastGeo = null;
const GAP = 8, FB = 3;   // celah pembagi; strip penanda fokus di atas panel
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
  const cp = U.barPalette(setting('barcol'));   // warna toolbar kustom berlaku di tema terang maupun gelap
  if (cp) return { color: cp.strip, symbolColor: cp.fg };
  if (isDark()) {
    const am = setting('amoled'), st = setting('barstyle');
    const c = (am ? { abu: '#000000', biru: '#000000', hangat: '#000000', putih: '#121214' } : { abu: '#121214', biru: '#0f1620', hangat: '#1a1714', putih: '#1c1c20' })[st] || (am ? '#000000' : '#121214');
    return { color: c, symbolColor: '#f4f4f5' };
  }
  const c = { abu: '#d9dae0', biru: '#d3dae6', hangat: '#e0dcd4', putih: '#e9e9ee' }[setting('barstyle')] || '#d9dae0';
  return { color: c, symbolColor: '#111113' };
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
  s.barpal = U.barPalette(s.barcol);
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
const inSplit = (id) => !!split && (split.a === id || split.b === id);
const partnerOf = (id) => (split ? (split.a === id ? split.b : split.a) : null);
// Hitung posisi semua panel. Responsif: susunan "auto" berdampingan di jendela lebar dan atas-bawah di jendela sempit;
// tiap panel punya ukuran minimum; jendela yang terlalu kecil menampilkan panel fokus saja (pasangan tetap tersimpan).
function geometry(w, h, top) {
  const out = { rects: {}, chrome: { on: false } };
  const full = (id) => { if (id != null) out.rects[id] = { x: 0, y: top, width: w, height: Math.max(0, h - top) }; };
  if (htmlFs && fsId != null) { full(fsId); return out; }          // video layar penuh dari halaman: panel itu saja, penuh
  if (!split || !inSplit(activeId) || w < 520 || h - top < 260) { full(activeId); return out; }
  const mode = setting('splitMode'), vertical = mode === 'v' || (mode === 'auto' && w < 900);
  const r0 = ratioLive != null ? ratioLive : setting('splitRatio'), y0 = top + FB;
  let A, B, bar, bars, drag;
  if (!vertical) {
    const total = w - GAP, min = Math.min(280, Math.floor(total / 2)), wa = Math.max(min, Math.min(total - min, Math.round(total * r0)));
    const H = Math.max(0, h - y0);
    A = { x: 0, y: y0, width: wa, height: H }; B = { x: wa + GAP, y: y0, width: total - wa, height: H };
    bar = { x: wa, y: y0, w: GAP, h: H };
    bars = [{ x: 0, y: top, w: wa, h: FB }, { x: wa + GAP, y: top, w: total - wa, h: FB }];
    drag = { start: 0, len: w };
  } else {
    const total = h - y0 - GAP, min = Math.min(150, Math.floor(total / 2)), ha = Math.max(min, Math.min(total - min, Math.round(total * r0)));
    A = { x: 0, y: y0, width: w, height: ha }; B = { x: 0, y: y0 + ha + GAP, width: w, height: total - ha };
    bar = { x: 0, y: y0 + ha, w, h: GAP - FB };
    bars = [{ x: 0, y: top, w, h: FB }, { x: 0, y: y0 + ha + GAP - FB, w, h: FB }];
    drag = { start: y0, len: h - y0 };
  }
  out.rects[split.a] = A; out.rects[split.b] = B;
  out.chrome = { on: true, vertical, bar, drag, ratio: Math.round(((vertical ? A.height : A.width) / (vertical ? A.height + B.height : A.width + B.width)) * 1000) / 1000,
    bars: [{ r: bars[0], on: activeId === split.a }, { r: bars[1], on: activeId === split.b }] };
  return out;
}
/* ---------- Mode perangkat (ponsel/tablet): viewport dipersempit + UA seluler + sentuh ---------- */
const EMU = [{ name: 'Ponsel', w: 390, h: 844, dpr: 3 }, { name: 'Tablet', w: 820, h: 1180, dpr: 2 }];
function emuApply(t, r) {
  const e = t.emu, wc = t.view.webContents;
  const bw = Math.max(200, Math.min(e.w, r.width)), bh = Math.max(200, Math.min(e.h, r.height));
  const b = { x: r.x + Math.round((r.width - bw) / 2), y: r.y, width: bw, height: bh };
  const key = [e.name, bw, bh].join('x');
  if (t._emuKey !== key) {
    t._emuKey = key;
    try { wc.enableDeviceEmulation({ screenPosition: 'mobile', screenSize: { width: e.w, height: e.h }, viewPosition: { x: 0, y: 0 }, deviceScaleFactor: e.dpr, viewSize: { width: bw, height: bh }, scale: 1 }); } catch {}
  }
  return b;
}
function emuCycle(t) {
  if (!t || internalName(t.url) || !/^https?:/.test(t.url)) { ctx.toast('Mode perangkat hanya untuk halaman web'); return; }
  const wc = t.view.webContents;
  const cur = t.emu ? EMU.findIndex(x => x.name === t.emu.name) : -1;
  t.emu = EMU[cur + 1] || null; t._emuKey = '';
  if (!t.emu) { try { wc.disableDeviceEmulation(); } catch {} }
  try { wc.setUserAgent(t.emu || SV.isMobileSite(U.hostOf(t.url)) ? SV.MOBILE_UA : SV.UA); } catch {}
  layout(); pushTabs();
  ctx.toast(t.emu ? 'Mode perangkat: ' + t.emu.name + ' (' + t.emu.w + '×' + t.emu.h + ')' : 'Mode perangkat dimatikan');
  wc.reloadIgnoringCache();
}
function layout() {
  if (!win) return;
  const [w, h] = win.getContentSize();
  const top = htmlFs && fsId != null ? 0 : (htmlFs ? 0 : chromeH);
  const G = lastGeo = geometry(w, h, top);
  ctx.tabs.forEach(t => { const r = G.rects[t.id]; t.view.setVisible(!!r); if (r) t.view.setBounds(t.emu ? emuApply(t, r) : r); });
  ctx.sendChrome('split', G.chrome);
  renderOverlay();
}
// panel tempat sebuah tab berada (koordinat jendela); null bila tab tidak sedang terlihat
const paneBox = (id) => { const r = lastGeo && lastGeo.rects[id]; return r ? { x: r.x, y: r.y, w: r.width, h: r.height } : null; };
// Layar penuh: toolbar tersembunyi, jadi dua tombol melayang (Tools & titik tiga) di pojok kanan atas membuka menu dari overlay
const fsActive = () => !!htmlFs;
const FSB = { w: 96, h: 44 };
// tombol layar penuh mengirim jarak dari tepi kanan tombol ke tepi kanan bilahnya; tambahkan posisi bilah sekarang
const fsRight = (e, right) => (fsBar && e.sender === fsBar.webContents ? fsbarPos().r + (right | 0) : right);
let fsDrag = null;
function fsbarPos() {
  const p = setting('fsbarpos') || {}, [w, h] = win.getContentSize();
  return { r: Math.max(0, Math.min(w - FSB.w, +p.r >= 0 ? +p.r : 12)), y: Math.max(0, Math.min(h - FSB.h, +p.y >= 0 ? +p.y : 12)) };
}
function renderFsBar() {
  if (!fsBar || !win || win.isDestroyed()) return;
  if (!fsActive() || OV.modal) { fsBar.setVisible(false); return; }
  const [w] = win.getContentSize(), p = fsDrag ? fsDrag.cur : fsbarPos();
  fsBar.setBounds({ x: Math.max(0, w - p.r - FSB.w), y: p.y, width: FSB.w, height: FSB.h });
  fsBar.setVisible(true);
  win.contentView.addChildView(fsBar);          // selalu paling atas, di atas overlay menu
  sendTo(fsBar.webContents, 'fsbar', { menu: OV.menu ? OV.menu.kind : null });
}
// Seret tombol melayang: ph = 'start' | 'move' | 'end'; dx, dy = selisih posisi layar sejak awal seretan
function fsbarDrag(ph, dx, dy) {
  if (!win || !fsActive()) return;
  if (ph === 'start') { closePopups(); fsDrag = { base: fsbarPos(), cur: fsbarPos() }; return; }
  if (!fsDrag) return;
  const [w, h] = win.getContentSize();
  fsDrag.cur = { r: Math.round(Math.max(0, Math.min(w - FSB.w, fsDrag.base.r - (+dx || 0)))), y: Math.round(Math.max(0, Math.min(h - FSB.h, fsDrag.base.y + (+dy || 0)))) };
  renderFsBar();
  if (ph === 'end') { saveSetting('fsbarpos', fsDrag.cur); fsDrag = null; renderFsBar(); }
}
function renderOverlay() { renderOverlayCore(); renderFsBar(); }
function renderOverlayCore() {
  if (!overlay || !win) return;
  const [w, h] = win.getContentSize();
  const stt = STT.ui([w, h], paneBox, (id) => inSplit(id) && !!(lastGeo && lastGeo.rects[partnerOf(id)]));   // mini hanya bila kedua panel split benar-benar terlihat
  const sttShow = stt && !(stt.fs && stt.idle);
  const any = OV.suggest || OV.menu || OV.modal || OV.toast || sttShow;
  if (!any) { overlay.setVisible(false); sendOv('state', {}); return; }
  let b;
  if (OV.modal) b = { x: 0, y: 0, width: w, height: h };
  else if (OV.suggest || OV.menu) { const ty = fsActive() ? 0 : chromeH; b = { x: 0, y: ty, width: w, height: Math.max(0, h - ty) }; }
  else {
    const rs = [];
    if (OV.toast) rs.push({ x: Math.floor(w / 2 - 230), y: h - 70, width: 460, height: 56 });
    if (sttShow) rs.push({ x: stt.rect.x, y: stt.rect.y, width: stt.rect.w, height: stt.rect.h });
    const x1 = Math.min(...rs.map(r => r.x)), y1 = Math.min(...rs.map(r => r.y)), x2 = Math.max(...rs.map(r => r.x + r.width)), y2 = Math.max(...rs.map(r => r.y + r.height));
    b = { x: x1, y: y1, width: x2 - x1, height: y2 - y1 };
  }
  overlay.setBounds(b); overlay.setVisible(true);
  win.contentView.addChildView(overlay);
  sendOv('state', { suggest: OV.suggest, menu: OV.menu, modal: OV.modal && { type: OV.modal.type, data: OV.modal.data }, toast: OV.toast, iconMenu: !!setting('iconMenu'), fsUi: fsActive(), fsTop: fsActive() ? fsbarPos().y + FSB.h + 6 : 0, dark: isDark(), stt: sttShow ? stt : null, ox: b.x, oy: b.y, tw: b.width });
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
      pinned: !!t.pinned, group: t.group || null, active: t.id === activeId, pane: inSplit(t.id) ? (t.id === split.a ? 'a' : 'b') : '', secure: /^https:/.test(t.url), internal: !!internalName(t.url), trOn: t.trOn, zoom: wc.getZoomFactor ? Math.round(wc.getZoomFactor() * 100) : 100,
      bookmarked: ctx.bm.data.some(b => b.u === t.url), mobile: SV.isMobileSite(host), emu: t.emu ? t.emu.name : '', trTo: t.trTo || '', trFrom: t.trFrom || '', adoff: !!host && (setting('sadoff') || []).some(d => host === d || host.endsWith('.' + d)) };
  });
}
let pushT = null;
function pushTabs() {
  if (pushT) return;
  pushT = setImmediate(() => {
    pushT = null; ctx.sendChrome('groups', ctx.groups); ctx.sendChrome('tabs', tabState()); saveSessionSoon();
    if (OV.modal && OV.modal.type === 'tabs') sendOv('tabsearch', tabSearchData());   // palet pencarian tab terbuka: perbarui isinya
  });
}

function createTab(url, o = {}) {
  const incog = !!o.incog;
  const part = incog ? INCOG : PERSIST;
  const ses = session.fromPartition(part);
  SV.setupSession(ses, incog);
  const view = new WebContentsView({ webPreferences: { partition: part, sandbox: true, contextIsolation: true, nodeIntegration: false, preload: path.join(__dirname, '..', 'preload', 'page.js'), spellcheck: true, webSecurity: true, allowRunningInsecureContent: false } });
  view.setBackgroundColor('#00000000');
  const t = { id: ++pageId, view, incog, title: 'Tab baru', url: url || '', icon: '', loading: false, audible: false, muted: false, trOn: false, find: '', pinned: !!o.pinned, group: null, last: Date.now() };
  let idx = o.index == null ? ctx.tabs.length : o.index;
  const pc = pinnedCount();
  idx = t.pinned ? Math.min(idx, pc) : Math.max(idx, pc);          // tab sematan hanya di area kiri, tab biasa di sisanya
  if (!t.pinned) {
    if (o.group !== undefined) t.group = o.group && groupOf(o.group) ? o.group : null;
    else if (o.index != null && idx > 0 && ctx.tabs[idx - 1].group && !ctx.tabs[idx - 1].pinned) t.group = ctx.tabs[idx - 1].group;   // dibuka dari tab dalam grup: ikut grup
  }
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
  // Terjemahan Suara baru dihentikan bila tabnya tidak lagi terlihat (pindah fokus antar panel split tidak menghentikannya)
  const vis = inSplit(id) ? [split.a, split.b] : [id];
  if (STT.active() && !vis.includes(STT.activeTabId())) STT.stop();
  const tg = t.group && groupOf(t.group); if (tg && tg.collapsed) tg.collapsed = false;   // memilih tab di grup yang diciutkan membentangkannya
  t.last = Date.now();
  activeId = id; layout(); pushInfobars(); pushTabs();
  const wc = t.view.webContents;
  if (t.url.startsWith('alethra://home') && !t.loading) setTimeout(() => focusOmni(), 50); else wc.focus();
  ctx.sendChrome('find', { open: false });
}
function closeTab(id) {
  const i = ctx.tabs.findIndex(x => x.id === id); if (i < 0) return;
  const t = ctx.tabs[i];
  const pref = inSplit(id) ? partnerOf(id) : null; if (pref != null) split = null;   // salah satu panel ditutup: split bubar, pasangannya jadi tab biasa
  if (STT.activeTabId() === id) STT.stop();
  dropInfobars(id, 'dismiss');
  if (!t.incog && t.url && !t.url.startsWith('alethra://')) { closed.push({ title: t.title, url: t.url, p: !!t.pinned }); if (closed.length > 50) closed.shift(); }
  ctx.tabs.splice(i, 1); cleanGroups();
  try { win.contentView.removeChildView(t.view); } catch {}
  try { t.view.webContents.close(); } catch {}
  if (t.incog && !ctx.tabs.some(x => x.incog)) wipeIncog();
  if (!ctx.tabs.length) { win.close(); return; }
  if (activeId === id) selectTab(pref != null && ctx.tabs.some(x => x.id === pref) ? pref : ctx.tabs[Math.min(i, ctx.tabs.length - 1)].id); else { layout(); pushTabs(); }
}
async function wipeIncog() { try { const s = session.fromPartition(INCOG); await s.clearStorageData(); await s.clearCache(); } catch {} }
function reopenClosed() { const c = closed.pop(); if (c) createTab(c.url, { pinned: c.p }); }
async function newIncogTab(url) {
  const l = setting('lock');
  if (l && l.mode === 'parts' && (l.parts || []).includes('incog')) { if (!(await needAuth('incog'))) return; }
  createTab(url || 'alethra://home', { incog: true });
}
function cycle(d) {
  const n = ctx.tabs.length; let i = ctx.tabs.findIndex(t => t.id === activeId);
  for (let k = 0; k < n; k++) { i = (i + d + n) % n; const g = ctx.tabs[i].group && groupOf(ctx.tabs[i].group); if (!(g && g.collapsed)) break; }   // lewati tab yang tersembunyi di grup ciut
  selectTab(ctx.tabs[i].id);
}
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
    if (h) { const z = (setting('zoomMap') || {})[h]; wc.setZoomFactor(z || 1); try { wc.setUserAgent(SV.isMobileSite(h) || t.emu ? SV.MOBILE_UA : SV.UA); } catch {} }
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
  wc.on('enter-html-full-screen', () => { if (STT.activeTabId() === t.id) STT.setFs(true); htmlFs = true; fsId = t.id; win.setFullScreen(true); ctx.sendChrome('fullscreen', true); layout(); });
  wc.on('leave-html-full-screen', () => { if (STT.activeTabId() === t.id) STT.setFs(false); htmlFs = false; fsId = null; if (!userFs) win.setFullScreen(false); ctx.sendChrome('fullscreen', false); layout(); });
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
  wc.on('focus', () => { closePopups(); if (inSplit(t.id) && t.id !== activeId && !htmlFs) paneFocus(t.id); });
  wc.on('context-menu', (_e, p) => showContextMenu(t, p));
  wc.on('devtools-opened', () => {
    // Tombol perangkat bawaan DevTools tidak bekerja di WebContentsView; Ctrl+Shift+M diarahkan ke mode perangkat Alethra
    try { wc.devToolsWebContents.on('before-input-event', (ev, inp) => { if (inp.type === 'keyDown' && (inp.control || inp.meta) && inp.shift && (inp.key || '').toLowerCase() === 'm') { ev.preventDefault(); emuCycle(t); } }); } catch {}
  });
}
const injects = {};
function injectScript(name) { return injects[name] || (injects[name] = fs.readFileSync(path.join(__dirname, '..', 'inject', name), 'utf8')); }
function startPageTr(t) { t.view.webContents.executeJavaScript(injectScript('pagetr.js') + `;window.__alPT&&window.__alPT.start(${JSON.stringify((t.trFrom && U.TR_LANGS[t.trFrom] ? t.trFrom + '>' : '') + (t.trTo || setting('trLang')))})`).catch(() => {}); }
function injectTrAll() {
  const on = !!setting('tr');
  ctx.tabs.forEach(t => { if (!/^https?:/.test(t.url)) return; t.view.webContents.executeJavaScript(`window.__alCfg={on:${on},lang:${JSON.stringify(setting('trLang'))},hide:${!!setting('trhide')}};` + (on ? injectScript('translate.js') : '')).catch(() => {}); });
}
function sttToggle() {
  const t = curTab(); if (!t) return;
  if (setting('stt') === false) { ctx.toast('Terjemahan Suara dimatikan di Pengaturan > Play'); return; }
  STT.toggle(t);
  if (STT.active() && setting('stside')) openTranscriptSide();
}
/* ================= tampilan terpisah ================= */
function paneFocus(id) {            // fokus pindah ke panel lain (klik/pintasan) tanpa mengubah susunan
  if (!inSplit(id) || id === activeId) return;
  activeId = id; pushInfobars(); pushTabs(); layout(); ctx.sendChrome('find', { open: false });
}
function splitPair(otherId, focusOther) {
  const a = curTab(), b = ctx.tabs.find(x => x.id === otherId);
  if (!a || !b || a === b) return;
  split = { a: a.id, b: b.id }; ratioLive = null;
  if (focusOther) selectTab(b.id); else { layout(); pushTabs(); }
}
function splitNew(url) {
  const cur = curTab(); if (!cur) return;
  const t = createTab(url || 'alethra://home', { incog: cur.incog, activate: false, index: ctx.tabs.indexOf(cur) + 1 });
  split = { a: cur.id, b: t.id }; ratioLive = null; selectTab(t.id);
}
function splitClose() { if (!split) return; split = null; ratioLive = null; layout(); pushTabs(); }
function splitSwap() { if (!split) return; split = { a: split.b, b: split.a }; layout(); pushTabs(); }
function splitToggle() { if (inSplit(activeId)) splitClose(); else splitNew(); }
function splitFocusNext() { if (inSplit(activeId)) selectTab(partnerOf(activeId)); else if (split) selectTab(split.a); }
function splitMode() { const o = ['auto', 'h', 'v'], n = o[(o.indexOf(setting('splitMode')) + 1) % 3]; saveSetting('splitMode', n); layout(); ctx.toast({ auto: 'Susunan: otomatis (menyesuaikan lebar jendela)', h: 'Susunan: berdampingan', v: 'Susunan: atas-bawah' }[n]); }
// buka alamat di sisi: bila sudah split, dimuat di panel pasangan; bila belum, jadi tab baru di sisi
function openSide(url, from) {
  from = from || curTab(); if (!from) return;
  if (inSplit(from.id)) { const p = ctx.tabs.find(x => x.id === partnerOf(from.id)); if (p) { go(p, url); return; } }
  const nt = createTab(url, { incog: from.incog, activate: false, index: ctx.tabs.indexOf(from) + 1 });
  split = { a: from.id, b: nt.id }; ratioLive = null; layout(); pushTabs();
}
// Riwayat Terjemahan Suara di sisi video: video tetap fokus (Terjemahan Suara tidak terganggu), daftar kalimat bergulir di panel pasangan
function openTranscriptSide() {
  const base = (STT.active() && ctx.tabs.find(x => x.id === STT.activeTabId())) || curTab(); if (!base) return;
  let tr = ctx.tabs.find(x => internalName(x.url) === 'transcript' && !x.incog);
  if (!tr) tr = createTab('alethra://transcript', { activate: false, index: ctx.tabs.indexOf(base) + 1 });
  if (base.id === tr.id) return selectTab(tr.id);
  split = { a: base.id, b: tr.id }; ratioLive = null;
  if (activeId !== base.id) selectTab(base.id); else { layout(); pushTabs(); }
}
// Klik ikon mic (kotak terjemahan yang diminimalkan): tampilan terpisah ditutup, tab riwayat ikut ditutup, kotak terjemahan kembali normal
function sttRestore() {
  const id = STT.activeTabId(); if (id == null || !inSplit(id)) return;
  const pid = partnerOf(id), p = ctx.tabs.find(x => x.id === pid);
  splitClose();
  if (p && internalName(p.url) === 'transcript') closeTab(pid);
  if (ctx.tabs.some(x => x.id === id) && activeId !== id) selectTab(id);
  renderOverlay();
}
/* ================= sematkan tab, grup, tutup massal, cari tab ================= */
const pinnedCount = () => ctx.tabs.filter(t => t.pinned).length;
const groupOf = (gid) => ctx.groups.find(g => g.id === gid);
function cleanGroups() {                       // grup tanpa anggota hilang dengan sendirinya
  const before = ctx.groups.length;
  ctx.groups = ctx.groups.filter(g => ctx.tabs.some(t => t.group === g.id));
  return before !== ctx.groups.length;
}
function pinTab(id, on) {
  const t = ctx.tabs.find(x => x.id === id); if (!t || !!t.pinned === !!on) return;
  t.pinned = !!on; if (on) t.group = null;
  const i = ctx.tabs.indexOf(t); ctx.tabs.splice(i, 1);
  ctx.tabs.splice(ctx.tabs.filter(x => x.pinned).length, 0, t);     // disematkan: di ujung area sematan; dilepas: tepat setelah area sematan
  cleanGroups(); layout(); pushTabs();
}
function moveTab(id, to) {
  const i = ctx.tabs.findIndex(t => t.id === id); if (i < 0) return;
  const [t] = ctx.tabs.splice(i, 1), pc = ctx.tabs.filter(x => x.pinned).length;
  to = Math.max(0, Math.min(ctx.tabs.length, to | 0));
  to = t.pinned ? Math.min(to, pc) : Math.max(to, pc);
  ctx.tabs.splice(to, 0, t);
  // keanggotaan grup mengikuti letak baru: di antara dua anggota grup yang sama = masuk grup; terlepas dari grupnya = keluar
  const L = ctx.tabs[to - 1], R = ctx.tabs[to + 1];
  if (t.pinned) t.group = null;
  else if (L && R && L.group && L.group === R.group) t.group = L.group;
  else if (t.group && !(L && L.group === t.group) && !(R && R.group === t.group)) t.group = null;
  cleanGroups(); pushTabs();
}
function addToGroup(id, gid) {
  const t = ctx.tabs.find(x => x.id === id), g = groupOf(gid); if (!t || !g) return;
  if (t.pinned) pinTab(id, false);
  const i = ctx.tabs.indexOf(t); ctx.tabs.splice(i, 1);
  let last = -1; ctx.tabs.forEach((x, k) => { if (x.group === gid) last = k; });
  ctx.tabs.splice(last + 1, 0, t); t.group = gid; cleanGroups(); pushTabs();
}
function removeFromGroup(id) {
  const t = ctx.tabs.find(x => x.id === id); if (!t || !t.group) return;
  const gid = t.group, i = ctx.tabs.indexOf(t); ctx.tabs.splice(i, 1); t.group = null;
  let last = -1; ctx.tabs.forEach((x, k) => { if (x.group === gid) last = k; });
  ctx.tabs.splice(last + 1, 0, t); cleanGroups(); pushTabs();      // keluar dari grup: berdiri tepat setelah grupnya
}
async function groupDialog(o) {
  const r = await askModal('group', { title: o.title, name: o.name || '', color: o.color || '', colors: GCOLOR_IDS.map(k => ({ id: k, label: GCOLORS[k][0], hex: GCOLORS[k][1] })) });
  return r && typeof r === 'object' && GCOLORS[r.color] ? { name: String(r.name || '').trim().slice(0, 30), color: r.color } : null;
}
async function newGroupFor(id) {
  const used = new Set(ctx.groups.map(g => g.color)), color = GCOLOR_IDS.find(c => !used.has(c)) || GCOLOR_IDS[ctx.groups.length % GCOLOR_IDS.length];
  const r = await groupDialog({ title: 'Grup tab baru', color });
  if (!r) return;
  const g = { id: ++groupSeq, name: r.name, color: r.color, collapsed: false }; ctx.groups.push(g); addToGroup(id, g.id);
}
async function editGroup(gid) {
  const g = groupOf(gid); if (!g) return;
  const r = await groupDialog({ title: 'Ubah grup', name: g.name, color: g.color }); if (!r) return;
  g.name = r.name; g.color = r.color; pushTabs();
}
function toggleGroup(gid) {
  const g = groupOf(gid); if (!g) return;
  if (!g.collapsed) {                                                 // menciutkan grup yang berisi tab aktif: pindah ke tab terdekat di luar grup
    const act = curTab();
    if (act && act.group === gid) {
      const i = ctx.tabs.indexOf(act), out = ctx.tabs.slice(i + 1).find(x => x.group !== gid) || ctx.tabs.slice(0, i).reverse().find(x => x.group !== gid);
      if (!out) return ctx.toast('Tidak ada tab lain di luar grup ini');
      g.collapsed = true; selectTab(out.id); return;
    }
  }
  g.collapsed = !g.collapsed; pushTabs();
}
function ungroup(gid) { ctx.tabs.forEach(t => { if (t.group === gid) t.group = null; }); cleanGroups(); pushTabs(); }
// ikon titik berwarna untuk menu native (PNG 14x14 dibuat langsung, tanpa berkas)
const dotCache = {};
function dotIcon(hex) {
  if (dotCache[hex]) return dotCache[hex];
  try {
    const zlib = require('zlib'), W = 14, rgb = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
    const raw = Buffer.alloc((W * 4 + 1) * W);
    for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) {
      const d = Math.hypot(x - 6.5, y - 6.5), a = Math.max(0, Math.min(1, 6.2 - d)), o = y * (W * 4 + 1) + 1 + x * 4;
      raw[o] = rgb[0]; raw[o + 1] = rgb[1]; raw[o + 2] = rgb[2]; raw[o + 3] = Math.round(a * 255);
    }
    const tbl = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; tbl[n] = c >>> 0; }
    const crc = (b) => { let c = 0xFFFFFFFF; for (const x of b) c = tbl[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
    const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]), c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
    const ih = Buffer.alloc(13); ih.writeUInt32BE(W, 0); ih.writeUInt32BE(W, 4); ih[8] = 8; ih[9] = 6;
    const png = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
    return (dotCache[hex] = require('electron').nativeImage.createFromBuffer(png));
  } catch { return undefined; }
}
// Tutup massal. Tab sematan tidak pernah ikut ditutup; bila yang tersisa kosong, dibuatkan tab baru. Yang ditutup bisa dibuka lagi (Ctrl+Shift+T, 50 terakhir).
async function closeMany(ids, what) {
  const list = ctx.tabs.filter(t => ids.includes(t.id) && !t.pinned);
  if (!list.length) return ctx.toast('Tidak ada tab yang bisa ditutup (tab sematan tidak ikut)');
  if (list.length >= 5) {
    const r = await dialog.showMessageBox(win, { type: 'question', buttons: ['Tutup ' + list.length + ' tab', 'Batal'], defaultId: 1, cancelId: 1, title: 'Tutup tab', message: what + ': ' + list.length + ' tab akan ditutup.', detail: 'Tab sematan tidak ikut ditutup. Tab biasa yang ditutup bisa dibuka lagi satu per satu dengan Ctrl+Shift+T (50 terakhir).' });
    if (r.response !== 0) return;
  }
  const survivors = ctx.tabs.filter(t => !list.includes(t));
  if (!survivors.length) createTab('alethra://home'); else if (list.some(t => t.id === activeId)) { const pick = survivors.find(t => { const g = t.group && groupOf(t.group); return !(g && g.collapsed); }) || survivors[0]; selectTab(pick.id); }
  list.forEach(t => closeTab(t.id));
}
const closeOthers = () => closeMany(ctx.tabs.filter(t => t.id !== activeId).map(t => t.id), 'Tutup tab lain');
const closeAllTabs = () => closeMany(ctx.tabs.map(t => t.id), 'Tutup semua tab');
// pencarian tab: palet di overlay; daftar disaring di sisi overlay supaya mengetik tetap lancar
let tabSearchSeq = 0;
function tabSearchData() {
  return {
    tabs: ctx.tabs.map(t => ({ id: t.id, title: t.title, url: t.url, icon: t.icon, pinned: !!t.pinned, group: t.group || null, audible: !!t.audible, muted: !!t.muted, incog: !!t.incog, active: t.id === activeId, last: t.last || 0 })),
    groups: ctx.groups.map(g => ({ id: g.id, name: g.name, color: GCOLORS[g.color] ? GCOLORS[g.color][1] : '#8b8d94' })),
    closed: closed.map((c, i) => ({ i, title: c.title, url: c.url })).reverse().slice(0, 12)
  };
}
function openTabSearch() {
  if (OV.modal && OV.modal.type === 'tabs') return endModal(null);
  askModal('tabs', Object.assign({ sid: ++tabSearchSeq }, tabSearchData())).then(r => {
    if (!r || typeof r !== 'object') return;
    if (r.pick != null) selectTab(r.pick);
    else if (r.reopen != null) { const c = closed.splice(r.reopen, 1)[0]; if (c) createTab(c.url, { pinned: c.p }); }
  });
}
function openSettingsAt(sec) {
  const ex = ctx.tabs.find(x => internalName(x.url) === 'settings' && !x.incog);
  if (ex) { selectTab(ex.id); ex.view.webContents.executeJavaScript(`location.hash=${JSON.stringify('#' + sec)}`).catch(() => {}); }
  else createTab('alethra://settings#' + sec);
}
function togglePageTr() {
  const t = curTab(); if (!t || !/^https?:/.test(t.url)) return ctx.toast('Buka sebuah situs dulu untuk menerjemahkan');
  t.trOn = !t.trOn;
  if (t.trOn) { startPageTr(t); const c = t.trTo || setting('trLang'); ctx.toast('Menerjemahkan' + (t.trFrom ? ' dari ' + U.TR_LANGS[t.trFrom] : '') + ' ke ' + (U.TR_LANGS[c] || c)); }
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
    add({ label: inSplit(t.id) ? 'Buka tautan di panel sebelah' : 'Buka tautan di sisi (tampilan terpisah)', click: () => openSide(p.linkURL, t) });
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
    if (!r.canceled) { fs.writeFileSync(r.filePath, buf); SV.recordSaved(r.filePath, mime); ctx.toast('Gambar disimpan'); }
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
function exitFullscreen() {
  const t = fsId != null ? ctx.tabs.find(x => x.id === fsId) : null;
  if (t) { try { t.view.webContents.executeJavaScript('document.fullscreenElement&&document.exitFullscreen()').catch(() => {}); } catch {} }
  if (!t || userFs) return setFullscreen(false);
  setTimeout(() => { if (htmlFs && win && !win.isDestroyed()) { htmlFs = false; fsId = null; win.setFullScreen(false); ctx.sendChrome('fullscreen', false); layout(); } }, 500);   // cadangan bila halaman menolak keluar
}
const toggleFullscreen = () => (win.isFullScreen() || htmlFs ? exitFullscreen() : setFullscreen(true));
function setFullscreen(v) { userFs = v; win.setFullScreen(v); htmlFs = v; ctx.sendChrome('fullscreen', v); layout(); }
function shortcut(e, i) {
  if (i.type !== 'keyDown') return false;
  const k = (i.key || '').toLowerCase(), c = i.control || i.meta, s = i.shift, a = i.alt;
  const run = (f) => { f(); return true; };
  if (k === 'f11') return run(toggleFullscreen);
  if (k === 'escape' && userFs && !a && !c) return run(() => setFullscreen(false));
  if (k === 'f5' || (c && k === 'r' && !s && !a)) return run(() => (c && i.shift ? curWC().reloadIgnoringCache() : curWC().reload()));
  if ((c && s && k === 'r') || (c && k === 'f5')) return run(() => curWC().reloadIgnoringCache());
  if (k === 'f12' || (c && s && k === 'i')) return run(() => { const w = curWC(); w.isDevToolsOpened() ? w.closeDevTools() : w.openDevTools({ mode: 'right' }); });
  if (c && s && k === 'm') return run(() => emuCycle(curTab()));
  if (c && a && (k === 'arrowleft' || k === 'arrowright')) return run(splitFocusNext);   // pindah fokus antar panel (sebelum Alt+panah = mundur/maju)
  if (k === 'f6' || (c && k === 'l') || (a && k === 'd')) return run(() => focusOmni());
  if (k === 'f3' || (c && k === 'g')) return run(() => findNext(!s));
  if (a && k === 'arrowleft') return run(() => curWC().navigationHistory.goBack());
  if (a && k === 'arrowright') return run(() => curWC().navigationHistory.goForward());
  if (a && k === 'home') return run(() => go(curTab(), setting('home') || 'alethra://home'));
  if (!c) return false;
  if (s && !a && k === 'a') return run(openTabSearch);
  if (a && k === 'v') return run(splitToggle);
  if (a && k === 'h') return run(openTranscriptSide);
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
const RDLANG = /^(auto|[a-z]{2,3}(-[A-Za-z0-9]{2,8})*)$/;
function readerVoice() {
  const v = setting('rdvoice') || {};
  return { lang: RDLANG.test(v.lang) ? v.lang : 'auto', gender: ['auto', 'male', 'female'].includes(v.gender) ? v.gender : 'auto', name: typeof v.name === 'string' ? v.name.slice(0, 160) : '' };
}
// ambil pilihan ukuran/tema/suara yang diubah pengguna di halaman mode baca
async function saveReaderPrefs(wc) {
  try {
    const pr = await wc.executeJavaScript('window.__alRdPref||""'); if (!pr) return;
    const o = JSON.parse(pr);
    if (o.size) saveSetting('rdsize', Math.max(14, Math.min(28, o.size | 0)));
    if (['light', 'sepia', 'dark'].includes(o.theme)) saveSetting('rdtheme', o.theme);
    if (o.voice && typeof o.voice === 'object') {
      const v = o.voice, cur = readerVoice(), nv = { lang: RDLANG.test(v.lang) ? v.lang : cur.lang, gender: ['auto', 'male', 'female'].includes(v.gender) ? v.gender : cur.gender, name: typeof v.name === 'string' ? v.name.slice(0, 160) : '' };
      if (JSON.stringify(nv) !== JSON.stringify(cur)) saveSetting('rdvoice', nv);
    }
  } catch {}
}
async function readerMode() {
  const t = curTab(); if (!t || !/^https?:/.test(t.url)) return ctx.toast('Buka sebuah situs dulu');
  const wc = t.view.webContents;
  await saveReaderPrefs(wc);
  const th = ['light', 'sepia', 'dark'].includes(setting('rdtheme')) ? setting('rdtheme') : (isDark() ? 'dark' : 'light');
  const js = injectScript('reader.js').replace('__SIZE__', Math.max(14, Math.min(28, setting('rdsize') | 0 || 18))).replace("'__THEME__'", () => JSON.stringify(th)).replace('__RATE__', '1').replace('__VOICE__', () => JSON.stringify(readerVoice()));
  const r = await wc.executeJavaScript(js, true).catch(() => 'no');
  if (r === 'no') return ctx.toast('Halaman ini tidak cocok untuk mode baca');
  if (r === 'ok') {   // simpan perubahan segera (tidak menunggu mode baca dibuka lagi) selama halaman masih membuka mode baca
    const iv = setInterval(async () => {
      if (!alive(wc)) return clearInterval(iv);
      const open = await wc.executeJavaScript('!!document.getElementById("__alrd")').catch(() => false);
      await saveReaderPrefs(wc);
      if (!open) clearInterval(iv);
    }, 2000);
  }
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
  // Kelompok: Tab | Pustaka | Tampilan halaman | Aplikasi. "Hapus data penjelajahan" ada di Pengaturan → Privasi & Keamanan (pintasan Ctrl+Shift+Del tetap jalan).
  const fsOn = fsActive();
  return [
    ...(fsOn ? [I('fullscreen', 'Keluar dari layar penuh', { key: 'F11', ic: 'exitfs' }), { sep: 1 }] : []),
    { head: 'Tab' },
    I('tab.new', 'Tab baru', { key: 'Ctrl+T' }), I('tab.incog', 'Tab Incognito baru', { key: 'Ctrl+Shift+N' }), I('tab.reopen', 'Buka tab tertutup', { key: 'Ctrl+Shift+T', off: !closed.length }),
    I('tabs.search', 'Cari tab…', { key: 'Ctrl+Shift+A', off: ctx.tabs.length < 2 && !closed.length }),
    I('menu.tabs', 'Atur tab', { arrow: 'l', on: !!(OV.menu && OV.menu.side), off: !t }),
    { sep: 1 }, { head: 'Pustaka' },
    I('open.bookmarks', 'Bookmark', { key: 'Ctrl+Shift+O' }), I('open.history', 'Histori', { key: 'Ctrl+H' }), I('open.downloads', 'Unduhan', { key: 'Ctrl+J' }), I('open.offline', 'Halaman offline'), I('open.passwords', 'Kata sandi'),
    { sep: 1 }, { head: 'Tampilan halaman' },
    { zoom: st.zoom || 100 },
    !fsOn && I('fullscreen', 'Layar penuh', { key: 'F11' }), I('devtools', 'Alat pengembang', { key: 'F12' }),
    { sep: 1 },
    I('open.settings', 'Pengaturan', { key: 'Ctrl+,' }), I('open.about', 'Tentang Alethra'), I('quit', 'Keluar')
  ].filter(Boolean);
}
/* ================= submenu "Atur tab" (urutan sama dengan klik kanan tab; berlaku untuk tab aktif). "Cari tab…" hanya di menu utama & klik kanan. ================= */
function tabsMenuSpec() {
  const t = curTab(); if (!t) return [{ head: 'Atur tab' }];
  const I = (id, label, o = {}) => Object.assign({ id, label }, o);
  const i = ctx.tabs.indexOf(t), closable = (l) => l.some(x => !x.pinned);
  return [
    { head: 'Atur tab · ' + ((t.title || t.url || 'Tab').slice(0, 28)) },
    I('tm.reload', 'Muat ulang'), I('tm.dup', 'Duplikat tab'), I('tm.mute', t.muted ? 'Aktifkan suara tab' : 'Bisukan tab', { ic: t.muted ? 'mute' : 'volume' }),
    { sep: 1 }, { head: 'Susunan' },
    I('tm.pin', t.pinned ? 'Lepas sematan tab' : 'Sematkan tab'),
    !t.pinned && I('menu.tabgroup', 'Tambahkan ke grup', { arrow: true }),
    t.group && I('tm.ungroup', 'Keluarkan dari grup'),
    inSplit(t.id) ? I('tm.split', 'Tutup tampilan terpisah') : I('tm.split', 'Tampilan terpisah (tab baru)'),
    { sep: 1 }, { head: 'Tutup' },
    I('tm.close', 'Tutup tab'),
    I('tm.closeother', 'Tutup tab lain', { off: !closable(ctx.tabs.filter(x => x.id !== t.id)) }),
    I('tm.closeright', 'Tutup tab di kanan', { off: !closable(ctx.tabs.slice(i + 1)) }),
    I('tabs.closeall', 'Tutup semua tab', { off: !closable(ctx.tabs) })
  ].filter(Boolean);
}
function tabGroupMenuSpec() {
  const t = curTab(); if (!t) return [];
  const out = [{ id: 'menu.tabs', label: '‹ Atur tab' }, { head: 'Tambahkan ke grup' }];
  ctx.groups.forEach(g => out.push({ id: 'tm.group:' + g.id, label: (g.name || GCOLORS[g.color][0]) + (t.group === g.id ? '  ✓' : ''), off: t.group === g.id, check: t.group === g.id }));
  if (ctx.groups.length) out.push({ sep: 1 });
  out.push({ id: 'tm.groupnew', label: 'Grup baru…' });
  return out;
}
/* ================= pilihan bahasa terjemahan halaman (ikon terjemahan di toolbar) ================= */
function trPickSpec() {
  const t = curTab(), L = U.TR_LANGS, cur = t && (t.trTo || setting('trLang'));
  const POP = ['id', 'en', 'ja', 'ko', 'zh-CN', 'es', 'ar', 'hi', 'fr', 'de', 'pt', 'ru'];
  const item = (c) => ({ id: 'trp:' + c, label: L[c], key: c, check: !!(t && t.trOn && cur === c), q: (L[c] + ' ' + c).toLowerCase() });
  const out = [{ filter: 'Cari bahasa…' },
    { id: 'menu.trsrc', label: 'Bahasa asal: ' + (t && t.trFrom && L[t.trFrom] ? L[t.trFrom] : 'Deteksi otomatis'), arrow: true, q: 'bahasa asal deteksi otomatis' },
    { sep: 1 }, { head: 'Terjemahkan halaman ini ke…' }];
  if (t && t.trOn) out.push({ id: 'trp.off', label: 'Tampilkan bahasa asli', q: 'tampilkan bahasa asli matikan' }, { sep: 1 });
  out.push({ head: 'Sering dipakai' });
  POP.filter(c => L[c]).forEach(c => out.push(item(c)));
  out.push({ sep: 1 }, { head: 'Semua bahasa (' + Object.keys(L).length + ')' });
  Object.keys(L).sort((a, b) => L[a].localeCompare(L[b], 'id')).forEach(c => out.push(item(c)));
  return out;
}
function trSrcSpec() {
  const t = curTab(), L = U.TR_LANGS, cur = t && t.trFrom;
  const POP = ['en', 'id', 'ja', 'ko', 'zh-CN', 'es', 'ar', 'hi', 'fr', 'de', 'pt', 'ru'];
  const item = (c) => ({ id: 'trs:' + c, label: L[c], key: c, check: cur === c, q: (L[c] + ' ' + c).toLowerCase() });
  const out = [{ filter: 'Cari bahasa…' }, { id: 'menu.trlang', label: '‹ Pilih bahasa tujuan' }, { head: 'Bahasa asal (bahasa teks di halaman)' },
    { id: 'trs:auto', label: 'Deteksi otomatis', check: !cur, q: 'deteksi otomatis auto' }, { sep: 1 }, { head: 'Sering dipakai' }];
  POP.filter(c => L[c]).forEach(c => out.push(item(c)));
  out.push({ sep: 1 }, { head: 'Semua bahasa (' + Object.keys(L).length + ')' });
  Object.keys(L).sort((a, b) => L[a].localeCompare(L[b], 'id')).forEach(c => out.push(item(c)));
  return out;
}
function pickTr(t, code) {
  if (!U.TR_LANGS[code]) return;
  if (!/^https?:/.test(t.url)) return ctx.toast('Buka sebuah situs dulu untuk menerjemahkan');
  if (t.trFrom === code) return ctx.toast('Bahasa asal dan tujuan sama (' + U.TR_LANGS[code] + ')');
  t.trTo = code; t.trOn = true; startPageTr(t);
  ctx.toast('Menerjemahkan' + (t.trFrom ? ' dari ' + U.TR_LANGS[t.trFrom] : '') + ' ke ' + U.TR_LANGS[code]); pushTabs();
}
function pickTrSrc(t, code) {
  t.trFrom = code === 'auto' || !U.TR_LANGS[code] ? '' : code;
  if (t.trOn) startPageTr(t);   // sedang diterjemahkan: ulangi dengan bahasa asal baru
  ctx.toast('Bahasa asal: ' + (t.trFrom ? U.TR_LANGS[t.trFrom] : 'deteksi otomatis')); pushTabs();
  openMenu('trlang');           // kembali ke pilihan bahasa tujuan
}
/* ================= menu Tools (overlay) ================= */
// Item mana yang tampil diatur di Pengaturan > Tools. Fitur yang dimatikan di Pengaturan > Play tetap ditampilkan (redup)
// dengan keterangan, supaya pengguna tahu kenapa tidak bisa dipakai; klik membuka Pengaturan di tempat yang tepat.
function toolsMenuSpec() {
  const t = curTab(), st = t ? tabState().find(x => x.id === t.id) : {}, web = t && /^https?:/.test(t.url);
  const I = (id, label, o = {}) => Object.assign({ id, label }, o);
  const cfg = setting('tools'), rd = STT.readiness();
  const on = (k) => cfg[k] !== false;
  const groups = [
    [on('find') && I('find', 'Cari di halaman', { key: 'Ctrl+F', off: !web }),
     on('print') && I('print', 'Cetak…', { key: 'Ctrl+P', off: !web }),
     on('pdf') && I('pdf', 'Simpan sebagai PDF', { off: !web }),
     on('offline') && I('offline.save', 'Simpan halaman offline', { key: 'Ctrl+S', off: !web })],
    [on('translate') && (setting('ptr') !== false ? I('translate', 'Terjemahkan halaman', { key: 'Ctrl+Alt+T', check: !!st.trOn, off: !web }) : I('goto.play', 'Terjemahkan halaman', { dim: true, ic: 'translate', note: 'Dimatikan di Play' })),
     on('chat') && I('chat', 'Terjemahkan chat live', { check: !!setting('tr') }),
     on('stt') && (rd.ok ? I('stt', 'Terjemahan Suara', { key: 'Ctrl+Alt+S', check: STT.active(), off: !web }) : I('goto.' + rd.sec, 'Terjemahan Suara', { dim: true, ic: 'mic', note: rd.short })),
     on('reader') && I('reader', 'Mode baca', { key: 'Ctrl+Alt+R', off: !web }),
     on('transcript') && I('transcript.side', 'Riwayat terjemahan suara', { key: 'Ctrl+Alt+H' })],
    // Tampilan terpisah: item berubah sesuai keadaan (belum split / sedang split)
    on('split') ? (inSplit(activeId)
      ? [I('split.close', 'Tutup tampilan terpisah', { key: 'Ctrl+Alt+V' }), I('split.swap', 'Tukar posisi panel'), I('split.mode', 'Susunan: ' + ({ auto: 'otomatis', h: 'berdampingan', v: 'atas-bawah' }[setting('splitMode')] || 'otomatis')), I('split.reset', 'Samakan lebar panel (50:50)')]
      : [I('split.new', 'Tampilan terpisah', { key: 'Ctrl+Alt+V' })]) : [],
    [on('vq') && I('vq', 'Kualitas video…', { off: !web }),
     on('pip') && I('pip', 'Gambar dalam gambar', { off: !web }),
     on('emu') && I('emu', 'Mode perangkat' + (st.emu ? ': ' + st.emu : ' (ponsel/tablet)'), { key: 'Ctrl+Shift+M', check: !!st.emu, off: !web }),
     on('adsite') && I('adsite', 'Blokir iklan di situs ini', { check: web && !st.adoff, off: !web })]
  ].map(g => g.filter(Boolean)).filter(g => g.length);
  const out = [];
  groups.forEach((g, i) => { if (i) out.push({ sep: 1 }); out.push(...g); });
  const im = !!setting('iconMenu');
  const modeItem = I('tools.iconmode', im ? 'Kembali ke mode daftar' : 'Mode ikon', { ic: im ? 'reader' : 'grid', check: im });
  if (!out.length) out.push(I('tools.config', 'Belum ada alat. Atur di Pengaturan → Tools'), modeItem);
  else { out.push({ sep: 1 }); out.push(modeItem, I('tools.config', 'Atur menu Tools…')); }
  return out;
}
let trRight = 8;
function openMenu(kind, right) {
  if (kind === 'trlang' && right != null) trRight = right;
  OV.suggest = null;
  if (kind === 'tools') STT.prewarm();   // muat model suara lebih dulu selagi menu terbuka, supaya Terjemahan Suara langsung siap
  OV.menu = kind === 'tools' ? { kind, items: toolsMenuSpec(), right: Math.max(8, right | 0) }
    : kind === 'tabs' ? { kind, items: tabsMenuSpec() }
    : kind === 'tabgroup' ? { kind, items: tabGroupMenuSpec() }
    : kind === 'trlang' || kind === 'trsrc' ? { kind, items: kind === 'trlang' ? trPickSpec() : trSrcSpec(), right: Math.max(8, (right == null ? trRight : right) | 0) }
    : (() => { const side = OV.menu && OV.menu.kind === 'main' ? OV.menu.side : null; const m = { kind: 'main', side, items: [], right: right != null ? Math.max(8, right | 0) : (OV.menu && OV.menu.kind === 'main' ? OV.menu.right : undefined) }; const old = OV.menu; OV.menu = m; m.items = mainMenuSpec(); if (side) m.side = sideSpec(side.kind); OV.menu = old; return m; })();
  renderOverlay();
  if (kind === 'trlang' || kind === 'trsrc') setTimeout(() => { try { overlay.webContents.focus(); } catch {} }, 30);
}
/* panel samping menu utama ("Atur tab" dan submenu grup): muncul di kiri menu utama, menu utama tetap terbuka */
function sideSpec(kind) { return { kind, items: kind === 'tabgroup' ? tabGroupMenuSpec() : tabsMenuSpec() }; }
function openMenuSide(kind) {
  if (!OV.menu || OV.menu.kind !== 'main') openMenu('main');
  OV.menu.side = kind ? sideSpec(kind) : null;
  OV.menu.items = mainMenuSpec();
  renderOverlay();
}
function menuAction(id) {
  // navigasi antar panel menu: menu tidak ditutup
  if (id === 'menu.main') return openMenu('main');
  if (id === 'menu.tabs') return openMenuSide(OV.menu && OV.menu.side && OV.menu.side.kind === 'tabs' ? null : 'tabs');
  if (id === 'menu.tabgroup') return openMenuSide('tabgroup');
  if (id === 'menu.trsrc') return openMenu('trsrc');
  if (id === 'menu.trlang') return openMenu('trlang');
  if (id === 'tools.iconmode') { saveSetting('iconMenu', !setting('iconMenu')); const m = OV.menu; return openMenu(m ? m.kind : 'tools', m && m.right); }   // menu tetap terbuka, hanya berganti tampilan
  OV.menu = null; renderOverlay();
  const t = curTab(), wc = curWC();
  if (t && id.startsWith('tm.group:')) return addToGroup(t.id, +id.slice(9));
  if (t && id.startsWith('trp:')) return pickTr(t, id.slice(4));
  if (t && id.startsWith('trs:')) return pickTrSrc(t, id.slice(4));
  if (t && id === 'trp.off') { t.trOn = false; wc.executeJavaScript('window.__alPT&&window.__alPT.stop()').catch(() => {}); ctx.toast('Terjemahan dimatikan'); return pushTabs(); }
  switch (id) {
    case 'tm.reload': return wc.reload();
    case 'tm.dup': return createTab(t.url, { incog: t.incog, index: ctx.tabs.indexOf(t) + 1 });
    case 'tm.mute': return API['tab.mute'](null, t.id);
    case 'tm.pin': return pinTab(t.id, !t.pinned);
    case 'tm.ungroup': return removeFromGroup(t.id);
    case 'tm.groupnew': return newGroupFor(t.id);
    case 'tm.split': return inSplit(t.id) ? splitClose() : splitNew();
    case 'tm.close': return closeTab(t.id);
    case 'tm.closeother': return closeMany(ctx.tabs.filter(x => x.id !== t.id).map(x => x.id), 'Tutup tab lain');
    case 'tm.closeright': return closeMany(ctx.tabs.slice(ctx.tabs.indexOf(t) + 1).map(x => x.id), 'Tutup tab di kanan');
    case 'tab.new': return createTab('alethra://home');
    case 'tab.incog': return newIncogTab();
    case 'tab.reopen': return reopenClosed();
    case 'tabs.search': return openTabSearch();
    case 'tabs.closeother': return closeOthers();
    case 'tabs.closeall': return closeAllTabs();
    case 'split.new': return splitNew();
    case 'split.close': return splitClose();
    case 'split.swap': return splitSwap();
    case 'split.mode': return splitMode();
    case 'split.reset': ratioLive = null; saveSetting('splitRatio', 0.5); return layout();
    case 'transcript.side': return openTranscriptSide();
    case 'goto.play': return openSettingsAt('play');
    case 'goto.mesinoff': return openSettingsAt('mesinoff');
    case 'tools.config': { const ex = ctx.tabs.find(x => internalName(x.url) === 'settings' && !x.incog); if (ex) { go(ex, 'alethra://settings#tools'); return selectTab(ex.id); } return createTab('alethra://settings#tools'); }
    case 'find': chromeWC.focus(); return ctx.sendChrome('find', { open: true, focus: true });
    case 'print': return wc.print();
    case 'pdf': return wc.printToPDF({ printBackground: true }).then(async b => { const r = await dialog.showSaveDialog(win, { defaultPath: path.join(SV.dlDir(), (t.title || 'halaman').replace(/[<>:"/\\|?*]/g, '_') + '.pdf') }); if (!r.canceled) { fs.writeFileSync(r.filePath, b); SV.recordSaved(r.filePath, 'application/pdf'); ctx.toast('PDF disimpan'); } });
    case 'offline.save': return SV.saveOffline(t);
    case 'translate': return togglePageTr();
    case 'chat': { saveSetting('tr', !setting('tr')); injectTrAll(); applyTheme(); return ctx.toast(setting('tr') ? 'Terjemahan chat live aktif (YouTube, Twitch)' : 'Terjemahan chat live dimatikan'); }
    case 'stt': return sttToggle();
    case 'reader': return readerMode();
    case 'vq': return videoQuality();
    case 'pip': return pip();
    case 'emu': return emuCycle(t);
    case 'adsite': { const h = U.hostOf(t.url); if (!h) return; let l = (setting('sadoff') || []).slice(); const on = l.some(d => h === d || h.endsWith('.' + d)); if (on) l = l.filter(d => !(h === d || h.endsWith('.' + d))); else l.push(h); saveSetting('sadoff', l); if (!setting('sadblock')) saveSetting('sadblock', true); ctx.toast(on ? 'Blokir iklan dimatikan untuk ' + h : 'Blokir iklan aktif untuk ' + h); wc.reload(); return; }
    case 'clear': return clearDataDialog();
    case 'fullscreen': return toggleFullscreen();
    case 'devtools': return wc.openDevTools({ mode: 'right' });
    case 'quit': return app.quit();
    default: if (id.startsWith('open.')) return openInternal(id.slice(5));
  }
}

/* ================= sesi tersimpan ================= */
function saveSessionSoon() { clearTimeout(saveT); saveT = setTimeout(saveSession, 1500); }
function saveSession() {
  const keep = ctx.tabs.filter(t => !t.incog && t.url && !t.url.startsWith('alethra://error'));
  ctx.sess.data = { tabs: keep.map(t => ({ u: t.url, p: t.pinned ? 1 : 0, g: t.group || 0 })), groups: ctx.groups.filter(g => keep.some(t => t.group === g.id)), active: Math.max(0, keep.findIndex(t => t.id === activeId)) };
  ctx.sess.flush();
}

/* ================= API untuk UI & halaman internal ================= */
const UIONLY = new Set(['ui.ready', 'tab.new', 'tab.close', 'tab.select', 'tab.move', 'tab.menu', 'tab.togroup', 'group.toggle', 'group.menu', 'tabs.search', 'nav.back', 'nav.forward', 'nav.reload', 'nav.stop', 'nav.home', 'omni.suggest', 'omni.sel', 'omni.hide', 'omni.go', 'menu.open', 'ov.menu', 'split.drag', 'split.dragend', 'split.nudge', 'split.reset', 'split.close', 'split.new', 'stt.hist', 'stt.restore', 'stt.minidrag', 'stt.copylast', 'ov.zoom', 'ov.pick', 'ov.close', 'modal.result', 'bookmark.toggle', 'find.start', 'find.next', 'find.stop', 'infobar.act', 'chrome.height', 'tab.mute', 'dl.open', 'stt.stop', 'stt.drag', 'fsbar.drag', 'fsbar.pos', 'tools.open', 'tr.open']);
const SETKEYS = Object.keys(SV.DEFAULTS).filter(k => k !== 'lock');
const API = {
  'ui.ready': () => ({ settings: publicSettings(), tabs: tabState(), bookmarks: ctx.bm.data.slice(0, 60), dl: SV.dlSummary() }),
  'tab.new': (e, u) => createTab(u || 'alethra://home'),
  'tab.close': (e, id) => closeTab(id),
  'tab.select': (e, id) => selectTab(id),
  'tab.move': (e, id, to) => moveTab(id, to),
  'tab.togroup': (e, id, gid) => addToGroup(id, gid),
  'group.toggle': (e, gid) => toggleGroup(gid),
  'group.menu': (e, gid) => {
    const g = groupOf(gid); if (!g) return;
    Menu.buildFromTemplate([
      { label: 'Ubah nama dan warna…', click: () => editGroup(gid) },
      { label: g.collapsed ? 'Bentangkan grup' : 'Ciutkan grup', click: () => toggleGroup(gid) },
      { label: 'Tab baru di grup ini', click: () => { const last = ctx.tabs.map((x, k) => x.group === gid ? k : -1).reduce((a, b) => Math.max(a, b), -1); createTab('alethra://home', { index: last + 1, group: gid }); } },
      { type: 'separator' },
      { label: 'Pisahkan grup (tab tetap terbuka)', click: () => ungroup(gid) },
      { label: 'Tutup grup', click: () => closeMany(ctx.tabs.filter(x => x.group === gid).map(x => x.id), 'Tutup grup' + (g.name ? ' "' + g.name + '"' : '')) }
    ]).popup({ window: win });
  },
  'tabs.search': () => openTabSearch(),
  'tab.mute': (e, id) => { const t = ctx.tabs.find(x => x.id === id); if (t) { t.muted = !t.muted; t.view.webContents.setAudioMuted(t.muted); pushTabs(); } },
  'tab.menu': (e, id) => {
    const t = ctx.tabs.find(x => x.id === id); if (!t) return; const wc = t.view.webContents, i = ctx.tabs.indexOf(t);
    const closable = (list) => list.filter(x => !x.pinned).length > 0;
    // submenu grup: grup yang ada (dengan titik berwarna) + grup baru
    const groupItems = ctx.groups.map(g => ({ label: (g.name || GCOLORS[g.color][0]) + (t.group === g.id ? '  ✓' : ''), icon: dotIcon(GCOLORS[g.color][1]), enabled: t.group !== g.id, click: () => addToGroup(id, g.id) }));
    Menu.buildFromTemplate([
      { label: 'Muat ulang', click: () => wc.reload() },
      { label: 'Duplikat tab', click: () => createTab(t.url, { incog: t.incog, index: i + 1 }) },
      { label: t.muted ? 'Aktifkan suara tab' : 'Bisukan tab', click: () => API['tab.mute'](null, id) },
      { type: 'separator' },
      { label: t.pinned ? 'Lepas sematan tab' : 'Sematkan tab', click: () => pinTab(id, !t.pinned) },
      t.pinned ? null : { label: 'Tambahkan ke grup', submenu: [...groupItems, ...(groupItems.length ? [{ type: 'separator' }] : []), { label: 'Grup baru…', click: () => newGroupFor(id) }] },
      t.group ? { label: 'Keluarkan dari grup', click: () => removeFromGroup(id) } : null,
      inSplit(id) ? { label: 'Tutup tampilan terpisah', click: splitClose } : (id !== activeId ? { label: 'Tampilan terpisah dengan tab aktif', click: () => splitPair(id, false) } : { label: 'Tampilan terpisah (tab baru)', click: () => splitNew() }),
      { type: 'separator' },
      { label: 'Tutup tab', click: () => closeTab(id) },
      { label: 'Tutup tab lain', enabled: closable(ctx.tabs.filter(x => x.id !== id)), click: () => closeMany(ctx.tabs.filter(x => x.id !== id).map(x => x.id), 'Tutup tab lain') },
      { label: 'Tutup tab di kanan', enabled: closable(ctx.tabs.slice(i + 1)), click: () => closeMany(ctx.tabs.slice(i + 1).map(x => x.id), 'Tutup tab di kanan') },
      { label: 'Tutup semua tab', enabled: closable(ctx.tabs), click: closeAllTabs },
      { type: 'separator' },
      { label: 'Cari tab…', accelerator: 'Ctrl+Shift+A', registerAccelerator: false, click: openTabSearch }
    ].filter(Boolean)).popup({ window: win });
  },
  // --- tampilan terpisah (pembagi digambar halaman chrome; posisi pointer dikirim ke sini) ---
  'split.drag': (e, pos) => { const g = lastGeo && lastGeo.chrome; if (!g || !g.on || !g.drag) return; ratioLive = Math.max(0.15, Math.min(0.85, (pos - g.drag.start - GAP / 2) / (g.drag.len - GAP))); layout(); },
  'split.dragend': () => { if (ratioLive != null) { const r = Math.round(ratioLive * 1000) / 1000; ratioLive = null; saveSetting('splitRatio', r); layout(); } },
  'split.nudge': (e, d) => { const g = lastGeo && lastGeo.chrome; if (!g || !g.on) return; saveSetting('splitRatio', Math.max(0.15, Math.min(0.85, (ratioLive != null ? ratioLive : g.ratio) + (+d || 0)))); ratioLive = null; layout(); },
  'split.reset': () => { ratioLive = null; saveSetting('splitRatio', 0.5); layout(); },
  'split.close': () => splitClose(),
  'split.new': () => splitNew(),
  // --- riwayat Terjemahan Suara ---
  'stt.hist': () => openTranscriptSide(),
  'stt.restore': () => sttRestore(),
  'stt.minidrag': (e, dx, dy) => STT.dragMini(+dx || 0, +dy || 0),
  'stt.copylast': () => { const t = STT.hist.last(); if (!t) { ctx.toast('Belum ada kalimat'); return false; } clipboard.writeText(t); ctx.toast('Kalimat terakhir disalin'); return true; },
  'stt.sessions': () => STT.hist.list(),
  'stt.entries': (e, sid) => STT.hist.entries(sid),
  'stt.copy': (e, sid, mode, stamps) => { const s = STT.hist.build(sid, 'txt', mode, stamps !== false); if (!s) return false; clipboard.writeText(s); return true; },
  'stt.export': async (e, sid, fmt, mode, stamps) => {
    fmt = fmt === 'srt' ? 'srt' : 'txt'; const s = STT.hist.build(sid, fmt, mode, stamps !== false); if (!s) { ctx.toast('Belum ada teks untuk disimpan'); return false; }
    const r = await dialog.showSaveDialog(win, { defaultPath: path.join(SV.dlDir(), STT.hist.fileBase(sid) + '.' + fmt), filters: [{ name: fmt === 'srt' ? 'Subtitle SRT' : 'Teks', extensions: [fmt] }] });
    if (r.canceled || !r.filePath) return false;
    try { fs.writeFileSync(r.filePath, s, 'utf8'); SV.recordSaved(r.filePath, fmt === 'srt' ? 'application/x-subrip' : 'text/plain'); ctx.toast('Tersimpan: ' + path.basename(r.filePath)); return true; } catch (er) { ctx.toast('Gagal menyimpan: ' + (er && er.message)); return false; }
  },
  'stt.clear': (e, sid) => STT.hist.clear(sid),
  // klik waktu di riwayat: lompat ke posisi itu di video sumbernya (bila tabnya masih terbuka)
  'stt.seek': (e, sid, sec) => {
    const t = ctx.tabs.find(x => x.id === STT.hist.tabOf(sid)); if (!t || !(sec >= 0)) return false;
    t.view.webContents.executeJavaScript(`(function(t){var l=[].slice.call(document.querySelectorAll('video,audio')),v=l.filter(function(x){return !x.paused})[0]||l[0];if(v&&isFinite(v.duration)){v.currentTime=Math.max(0,t);return true}return false})(${+sec})`).catch(() => {});
    return true;
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
  'fsbar.drag': (e, ph, dx, dy) => fsbarDrag(String(ph), dx, dy),
  'fsbar.pos': () => fsbarPos(),
  'menu.open': (e, right) => { right = fsRight(e, right); if (OV.menu && OV.menu.kind === 'main') { closePopups(); return; } openMenu('main', right); },
  'tr.open': (e, right) => { if (OV.menu && (OV.menu.kind === 'trlang' || OV.menu.kind === 'trsrc')) { closePopups(); return; } const t = curTab(); if (!t || !/^https?:/.test(t.url)) return ctx.toast('Buka sebuah situs dulu untuk menerjemahkan'); openMenu('trlang', right); },
  'tools.open': (e, right) => { right = fsRight(e, right); if (OV.menu && OV.menu.kind === 'tools') { closePopups(); return; } openMenu('tools', right); },
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
    if (k === 'barstyle' && !['abu', 'biru', 'hangat', 'putih'].includes(v)) return false;
    if (k === 'barcol' && v && !/^#[0-9a-f]{6}$/i.test(v)) return false;
    if (k === 'doh' && !U.DOH[v]) return false;
    if (['clock', 'sta', 'stf', 'stb', 'tools'].includes(k)) { if (!v || typeof v !== 'object' || Array.isArray(v)) return false; const o = {}; for (const kk of Object.keys(d)) if (typeof v[kk] === typeof d[kk]) o[kk] = v[kk]; v = (k === 'stf' || k === 'stb') ? STT.sanitize(k, o) : o; }
    if (k === 'stprov' && !['groq', 'openai', 'custom'].includes(v)) return false;
    if (k === 'stengine' && !['cloud', 'offline', 'tjs', 'vosk'].includes(v)) return false;
    if (k === 'trmode' && !['online', 'offline', 'nllb'].includes(v)) return false;
    if (['stmodel', 'stwmodel', 'stvmodel'].includes(k) && !OFF.validModel(v, k)) return false;
    if (k === 'ofthreads' && !(Number.isInteger(v) && v >= 0 && v <= 16)) return false;
    if (k === 'stspeed' && !['fast', 'bal', 'eco'].includes(v)) return false;
    if (k === 'hfmirror' && v && !/^(https:\/\/|http:\/\/(localhost|127\.0\.0\.1)(:\d+)?)[^\s]*$/i.test(v)) return false;
    if (k === 'splitMode' && !['auto', 'h', 'v'].includes(v)) return false;
    if (k === 'splitRatio' && !(typeof v === 'number' && v >= 0.15 && v <= 0.85)) return false;
    if (k === 'stcurl' && v && !/^https?:\/\/[^\s]+$/.test(v)) return false;
    saveSetting(k, v);
    if (['sta', 'stspeed', 'stlang', 'stengine', 'stmodel', 'stwmodel', 'stvmodel', 'trmode'].includes(k)) STT.refresh();
    if (k === 'stt' && !v) STT.stop();
    if (k === 'splitMode' || k === 'splitRatio') { ratioLive = null; layout(); }
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
  'oe.test': async (e, text, s, t, mode) => { try { return { ok: true, text: (await OFF.translateBy(mode === 'nllb' ? 'nllb' : 'offline', String(text || '').slice(0, 300), String(s), String(t))) || String(text) }; } catch (err) { return { ok: false, err: err.message }; } },
  'oe.dir': () => OFF.openDir(),
  'oe.ping': () => OFF.ping(),
  'clip.write': (e, t) => { clipboard.writeText(String(t == null ? '' : t).slice(0, 20000)); return true; },
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
  if (UIONLY.has(name) && e.sender !== chromeWC && !(overlay && e.sender === overlay.webContents) && !(fsBar && e.sender === fsBar.webContents) && name !== 'dl.open') return null;
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
  fsBar = new WebContentsView({ webPreferences: { preload: path.join(__dirname, '..', 'preload', 'internal.js'), sandbox: true, contextIsolation: true } });
  fsBar.setBackgroundColor('#00000000');
  fsBar.webContents.on('before-input-event', (e, input) => { if (shortcut(e, input)) e.preventDefault(); });
  win.contentView.addChildView(fsBar); fsBar.setVisible(false);
  fsBar.webContents.loadURL('alethra://app/ui/fsbar.html');
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
  // Sesi penuh dipulihkan bila "Lanjutkan sesi sebelumnya" menyala. Tab sematan selalu dipulihkan, apa pun pengaturannya.
  const sd = ctx.sess.data || {}, saved = Array.isArray(sd.tabs) ? sd.tabs : [];
  const full = !!setting('restore') && saved.length > 0 && !urls.length;
  const list = full ? saved.slice(0, 40) : saved.filter(x => x.p).slice(0, 20);
  if (list.length) {
    if (Array.isArray(sd.groups)) ctx.groups = sd.groups.filter(g => g && GCOLORS[g.color] && list.some(x => x.g === g.id)).map(g => ({ id: g.id | 0, name: String(g.name || '').slice(0, 30), color: g.color, collapsed: !!g.collapsed }));
    groupSeq = ctx.groups.reduce((m, g) => Math.max(m, g.id), 0);
    const a = sd.active || 0;
    list.forEach((x, i) => createTab(x.u, { activate: full && i === a, pinned: !!x.p, group: x.p ? null : (x.g || null) }));
    cleanGroups(); restored = full;
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
