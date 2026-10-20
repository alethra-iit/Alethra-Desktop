const { app, session, protocol, net, dialog, shell, safeStorage, nativeTheme, ipcMain, webContents } = require('electron');
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const { pathToFileURL } = require('url');
const U = require('./util');
const ctx = require('./ctx');

const DEFAULTS = {
  theme: 'system', amoled: false, accent: '', engine: 'google', customEngine: '', httpsOnly: false, suggest: true,
  restore: true, adblock: true, sadblock: true, sadoff: [], tpc: false, dnt: false, doh: 'off', dohcustom: '',
  bmbar: true, dlAsk: false, dlDir: '', trLang: 'id', tr: false, trhide: false, rdsize: 18, rdtheme: '',
  zoomMap: {}, mobileSites: [], shortcuts: [
    { n: 'Google', u: 'https://www.google.com' }, { n: 'YouTube', u: 'https://www.youtube.com' },
    { n: 'Wikipedia', u: 'https://id.wikipedia.org' }, { n: 'GitHub', u: 'https://github.com' }],
  clock: { c: 'analog', p: 'mid', z: 1, k: 't', al: 'c', d2: 0, h24: true, q: false, y: true, n: true, b: true },
  logo: true, grad: false, wall: 0, dim: 1,
  ptr: true, stt: true, stengine: 'cloud', stmodel: '', stwmodel: '', stvmodel: '', trmode: 'online', mtfb: true, hfmirror: '', ofthreads: 0, stprov: 'groq', stspeed: 'bal', stlang: '', stcurl: '', stcmodel: 'whisper-1',
  sta: { pg: 1, min: 0, max: 0, sens: 2.8, dur: 300, ns: 0, gate: 0, hp: 80, lp: 0, auto: 6, minlen: 2, filt: true, meter: false, legacy: false },
  // layar penuh. bgop -1 = ikut opsi lama `bg` (dim=62, solid=100, none=0). width/height/sizepx 0 = otomatis.
  stf: { size: 'md', pos: 'bottom', bg: 'dim', color: 'white', orig: true, bgop: -1, bgcol: '#000000', sizepx: 0, width: 0, height: 0, radius: 12, offy: 0, bold: true, shadow: 'auto' },
  // kotak terjemahan suara di luar layar penuh. Kosong ('') = ikut tema terang/gelap.
  stb: { bgop: 100, bgcol: '', color: '', size: 20, bold: true, width: 720, height: 168, radius: 16, border: true, prev: true, shadow: 'auto' },
  // item menu Tools yang ditampilkan
  tools: { find: true, print: true, pdf: true, offline: true, translate: true, chat: true, stt: true, reader: true, vq: true, pip: true, mobile: true, adsite: true },
  lock: { mode: 'off', parts: [], grace: 60000, hash: '', salt: '' }
};
const S = () => ctx.settings.data;
const setting = (k) => {
  const v = S()[k], d = DEFAULTS[k];
  if (v === undefined) return d;
  return (d && typeof d === 'object' && !Array.isArray(d) && v && typeof v === 'object') ? Object.assign({}, d, v) : v;
};
function saveSetting(k, v) { S()[k] = v; ctx.settings.save(); }

/* ---------- UA ---------- */
const CHROME = process.versions.chrome;
const UA = `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${CHROME} Safari/537.36`;
const MOBILE_UA = `Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${CHROME} Mobile Safari/537.36`;
const isMobileSite = (h) => !!h && (setting('mobileSites') || []).includes(h);

/* ---------- Proteksi file lokal ---------- */
const offDir = () => path.join(ctx.dataDir, 'offline');
function localOk(u) {
  if (!/^file:/i.test(u)) return true;
  try {
    const p = decodeURIComponent(new URL(u).pathname).replace(/^\//, '');
    const f = path.resolve(p);
    return /\.mhtml$/i.test(f) && path.dirname(f) === path.resolve(offDir());
  } catch { return false; }
}

/* ---------- protokol alethra:// ---------- */
const PAGES = ['home', 'settings', 'bookmarks', 'history', 'downloads', 'offline', 'passwords', 'error', 'blocked', 'about'];
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png' };
function handleAlethra(req) {
  const u = new URL(req.url);
  const site = req.headers.get('sec-fetch-site'), dest = req.headers.get('sec-fetch-dest');
  // Situs web tidak boleh membuka halaman internal lewat tautan/iframe
  if (site === 'cross-site' && (dest === 'document' || dest === 'iframe' || dest === 'frame')) return new Response('Forbidden', { status: 403 });
  const root = path.join(__dirname, '..', 'renderer');
  let file;
  if (u.hostname === 'wallpaper') file = path.join(ctx.dataDir, 'wallpaper.img');
  else if (u.hostname === 'app') file = path.join(root, path.normalize(decodeURIComponent(u.pathname)).replace(/^(\.\.[/\\])+/, ''));
  else if (PAGES.includes(u.hostname)) file = path.join(root, 'pages', u.hostname + '.html');
  else return new Response('Not found', { status: 404 });
  if (!path.resolve(file).startsWith(path.resolve(u.hostname === 'wallpaper' ? ctx.dataDir : root))) return new Response('Forbidden', { status: 403 });
  try {
    const buf = fs.readFileSync(file);
    return new Response(buf, { headers: { 'content-type': u.hostname === 'wallpaper' ? 'image/jpeg' : (MIME[path.extname(file)] || 'application/octet-stream'), 'cache-control': 'no-store' } });
  } catch { return new Response('Not found', { status: 404 }); }
}

/* ---------- Sesi ---------- */
const sessionsDone = new Set();
function tabOfReq(d) { return d.webContentsId ? ctx.tabs.find(t => t.view.webContents.id === d.webContentsId) : null; }
function setupSession(ses, incog) {
  if (sessionsDone.has(ses)) return; sessionsDone.add(ses);
  ses.setUserAgent(UA);
  ses.protocol.handle('alethra', handleAlethra);
  ses.setSpellCheckerLanguages(['id', 'en-US'].filter(l => ses.availableSpellCheckerLanguages.includes(l)));

  ses.webRequest.onBeforeRequest((d, cb) => {
    const u = d.url;
    if (/^file:/i.test(u) && !localOk(u)) return cb({ cancel: true });
    if (!/^https?:/i.test(u)) return cb({});
    const main = d.resourceType === 'mainFrame';
    let host; try { host = new URL(u).hostname.toLowerCase(); } catch { return cb({}); }
    if (main && u.startsWith('http:') && setting('httpsOnly') && !/^(localhost|\d+\.\d+\.\d+\.\d+|.*\.local)$/.test(host)) {
      const t = tabOfReq(d); if (t) t.upgraded = u;
      return cb({ redirectURL: 'https://' + u.slice(7) });
    }
    if (!main) {
      const t = tabOfReq(d); const page = t ? U.hostOf(t.url) : null;
      if (setting('adblock') && page && U.matchDomain(page, ['youtube.com'])) {
        if (U.YT_AD_HOSTS.includes(host)) return cb({ cancel: true });
        if (U.matchDomain(host, ['youtube.com'])) {
          const p = new URL(u).pathname;
          if (p.startsWith('/pagead/') || p.startsWith('/api/stats/ads') || p.startsWith('/ptracking') || p.startsWith('/get_midroll_') || p.includes('/ad_break')) return cb({ cancel: true });
        }
      }
      if (setting('sadblock') && U.matchDomain(host, U.AD_DOMAINS)) {
        const off = setting('sadoff') || [];
        const pageOff = page && U.matchDomain(page, off);
        const same = page && (page === host || page.endsWith('.' + host) || host.endsWith('.' + page));
        if (!pageOff && !same) return cb({ cancel: true });
      }
    }
    cb({});
  });

  ses.webRequest.onBeforeSendHeaders((d, cb) => {
    const h = d.requestHeaders;
    if (!/^https?:/i.test(d.url)) return cb({ requestHeaders: h });
    if (setting('dnt')) { h['DNT'] = '1'; h['Sec-GPC'] = '1'; }
    const t = tabOfReq(d);
    if (t) {
      const th = U.hostOf(t.url);
      if (isMobileSite(th)) h['User-Agent'] = MOBILE_UA;
      if ((incog || setting('tpc')) && d.resourceType !== 'mainFrame' && th && U.siteOf(U.hostOf(d.url)) !== U.siteOf(th)) delete h['Cookie'];
    }
    cb({ requestHeaders: h });
  });
  ses.webRequest.onHeadersReceived((d, cb) => {
    if ((incog || setting('tpc')) && d.resourceType !== 'mainFrame' && /^https?:/i.test(d.url)) {
      const t = tabOfReq(d);
      const th = t && U.hostOf(t.url);
      if (th && U.siteOf(U.hostOf(d.url)) !== U.siteOf(th)) {
        const h = Object.assign({}, d.responseHeaders);
        for (const k of Object.keys(h)) if (k.toLowerCase() === 'set-cookie') delete h[k];
        return cb({ responseHeaders: h });
      }
    }
    cb({ responseHeaders: d.responseHeaders });
  });

  /* izin situs */
  ses.setPermissionRequestHandler((wc, perm, cb, details) => permRequest(wc, perm, cb, details, incog));
  ses.setPermissionCheckHandler((wc, perm, origin, details) => {
    if (ALWAYS.includes(perm)) return true;
    const key = permKey(perm, details || {}); if (!key) return false;
    const host = U.hostOf(origin || (details && details.requestingUrl)); return host ? getPerm(host, key, incog) === 'allow' : false;
  });
  ses.on('will-download', (e, item, wc) => ctx.onDownload(e, item, wc, incog));
}

/* ---------- Izin ---------- */
const ALWAYS = ['fullscreen', 'pointerLock', 'clipboard-sanitized-write', 'keyboardLock', 'window-management'];
const PERM_LABEL = { cam: 'Kamera', mic: 'Mikrofon', geo: 'Lokasi', notif: 'Notifikasi', clip: 'Papan klip' };
const memPerms = {};
function permKey(perm, d) {
  if (perm === 'geolocation') return 'geo';
  if (perm === 'notifications') return 'notif';
  if (perm === 'clipboard-read') return 'clip';
  if (perm === 'media') { const t = d.mediaTypes || []; return t.includes('video') ? 'cam' : 'mic'; }
  if (perm === 'mediaKeySystem') return null;
  return null;
}
function permStore(incog) { return incog ? memPerms : ctx.perms.data; }
function getPerm(host, key, incog) { const s = permStore(incog)[host]; return (s && s[key]) || 'ask'; }
function setPerm(host, key, v, incog) {
  const st = permStore(incog); st[host] = st[host] || {};
  if (v === 'ask') delete st[host][key]; else st[host][key] = v;
  if (!Object.keys(st[host]).length) delete st[host];
  if (!incog) ctx.perms.save();
}
function permRequest(wc, perm, cb, details, incog) {
  if (ALWAYS.includes(perm)) return cb(true);
  const t = ctx.tabs.find(x => x.view.webContents.id === wc.id);
  let keys;
  if (perm === 'media') { const mt = details.mediaTypes || []; keys = []; if (mt.includes('video')) keys.push('cam'); if (mt.includes('audio') || !mt.length) keys.push('mic'); }
  else { const k = permKey(perm, details); keys = k ? [k] : []; }
  if (!keys.length || !t) return cb(false);
  const host = U.hostOf(details.requestingUrl || wc.getURL());
  if (!host) return cb(false);
  const st = keys.map(k => getPerm(host, k, incog));
  if (st.includes('block')) return cb(false);
  if (st.every(s => s === 'allow')) return cb(true);
  ctx.addInfobar({
    tabId: t.id, kind: 'perm', text: `${host} ingin menggunakan ${keys.map(k => PERM_LABEL[k]).join(' & ')}`,
    actions: [{ k: 'allow', l: 'Izinkan' }, { k: 'block', l: 'Blokir' }],
    done: (a) => { if (a === 'allow' || a === 'block') { keys.forEach(k => setPerm(host, k, a, incog)); } cb(a === 'allow'); }
  });
}
function listPerms() {
  const out = [];
  const st = ctx.perms.data;
  for (const h of Object.keys(st)) out.push({ host: h, perms: st[h] });
  return out;
}

/* ---------- Unduhan ---------- */
const EXT = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/gif': '.gif', 'image/webp': '.webp', 'image/svg+xml': '.svg', 'image/avif': '.avif', 'image/bmp': '.bmp', 'image/x-icon': '.ico', 'application/pdf': '.pdf', 'text/html': '.html', 'video/mp4': '.mp4', 'audio/mpeg': '.mp3' };
const liveItems = new Map();
let dlSeq = Date.now();
function dlDir() { const d = setting('dlDir'); const p = d && fs.existsSync(d) ? d : path.join(app.getPath('downloads'), 'Alethra'); try { fs.mkdirSync(p, { recursive: true }); } catch {} return p; }
function uniquePath(dir, name) {
  name = name.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_') || 'unduhan';
  let p = path.join(dir, name), i = 1; const ext = path.extname(name), base = path.basename(name, ext);
  while (fs.existsSync(p)) p = path.join(dir, `${base} (${i++})${ext}`);
  return p;
}
let dlTimer = null;
function dlPush() { if (dlTimer) return; dlTimer = setTimeout(() => { dlTimer = null; ctx.sendChrome('downloads', dlSummary()); ctx.broadcastPages('downloads', listDownloads()); }, 250); }
function dlSummary() { const l = ctx.dlList; const act = l.filter(d => d.state === 'progressing' || d.state === 'paused'); const tot = act.reduce((a, d) => a + (d.total || 0), 0), rc = act.reduce((a, d) => a + d.received, 0); return { active: act.length, pct: tot ? Math.round(rc * 100 / tot) : 0 }; }
function listDownloads() { return ctx.dlList.map(d => Object.assign({}, d)).reverse(); }
function persistDl() { ctx.dlStore.data = ctx.dlList.filter(d => !d.incog).slice(-500); ctx.dlStore.save(); }
ctx.dlList = [];
ctx.onDownload = (e, item, wc, incog) => {
  let name = item.getFilename() || 'unduhan';
  if (!path.extname(name) && EXT[item.getMimeType()]) name += EXT[item.getMimeType()];
  const rec = { id: ++dlSeq, name, url: item.getURL(), path: '', total: item.getTotalBytes(), received: 0, state: 'progressing', time: Date.now(), mime: item.getMimeType(), incog: !!incog };
  if (setting('dlAsk')) {
    item.setSaveDialogOptions({ defaultPath: path.join(dlDir(), name) });
  } else { rec.path = uniquePath(dlDir(), name); item.setSavePath(rec.path); }
  ctx.dlList.push(rec); liveItems.set(rec.id, item); dlPush();
  item.on('updated', (_e, st) => { rec.received = item.getReceivedBytes(); rec.total = item.getTotalBytes(); rec.state = st === 'interrupted' ? 'interrupted' : (item.isPaused() ? 'paused' : 'progressing'); if (!rec.path && item.getSavePath()) { rec.path = item.getSavePath(); rec.name = path.basename(rec.path); } dlPush(); });
  item.once('done', (_e, st) => {
    liveItems.delete(rec.id); rec.received = item.getReceivedBytes(); if (item.getSavePath()) { rec.path = item.getSavePath(); rec.name = path.basename(rec.path); }
    rec.state = st === 'completed' ? 'completed' : (st === 'cancelled' ? 'cancelled' : 'interrupted');
    if (st === 'completed') ctx.toast('Unduhan selesai: ' + rec.name);
    persistDl(); dlPush();
  });
};
function dlAct(id, a) {
  const rec = ctx.dlList.find(d => d.id === id); if (!rec) return;
  const it = liveItems.get(id);
  if (a === 'pause' && it) it.pause();
  else if (a === 'resume' && it && it.canResume()) it.resume();
  else if (a === 'cancel' && it) it.cancel();
  else if (a === 'open' && rec.path) shell.openPath(rec.path).then(r => { if (r) ctx.toast('Berkas tidak ditemukan'); });
  else if (a === 'show' && rec.path) shell.showItemInFolder(rec.path);
  else if (a === 'retry') session.fromPartition(rec.incog ? 'incog' : 'persist:main').downloadURL(rec.url);
  else if (a === 'remove') { if (it) it.cancel(); ctx.dlList = ctx.dlList.filter(d => d.id !== id); persistDl(); }
  else if (a === 'clear') { ctx.dlList = ctx.dlList.filter(d => d.state === 'progressing' || d.state === 'paused'); persistDl(); }
  dlPush();
}

/* ---------- Sandi ---------- */
const enc = (s) => safeStorage.isEncryptionAvailable() ? 'e:' + safeStorage.encryptString(s).toString('base64') : 'p:' + Buffer.from(s).toString('base64');
const dec = (s) => { try { return s.startsWith('e:') ? safeStorage.decryptString(Buffer.from(s.slice(2), 'base64')) : Buffer.from(s.slice(2), 'base64').toString(); } catch { return ''; } };
const pwList = () => ctx.pw.data;
function pwFind(origin) { return pwList().filter(x => x.o === origin).map(x => ({ u: x.u, p: dec(x.p) })); }
function pwPut(origin, u, p) {
  const l = pwList(); const ex = l.find(x => x.o === origin && x.u === u);
  if (ex) ex.p = enc(p); else l.push({ o: origin, u, p: enc(p), ts: Date.now() });
  ctx.pw.save();
}

/* ---------- Penerjemah ---------- */
async function trOne(text, lang) {
  const r = await fetch('https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=' + encodeURIComponent(lang) + '&dt=t&q=' + encodeURIComponent(text), { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(7000) });
  if (!r.ok) return '';
  const j = await r.json(); return (j[0] || []).map(s => s[0] || '').join('');
}
async function trBatch(arr, lang) {
  try {
    const body = 'client=gtx&sl=auto&tl=' + encodeURIComponent(lang) + '&dt=t' + arr.map(t => '&q=' + encodeURIComponent(t)).join('');
    const r = await fetch('https://translate.googleapis.com/translate_a/t', { method: 'POST', headers: { 'User-Agent': 'Mozilla/5.0', 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' }, body, signal: AbortSignal.timeout(12000) });
    if (r.ok) {
      const j = await r.json(); let good = 0;
      const out = arr.map((_, i) => { const e = j[i]; const t = Array.isArray(e) ? (e[0] || '') : (typeof e === 'string' ? e : ''); if (t) good++; return t; });
      if (good) return out;
    }
  } catch {}
  const out = []; for (const t of arr) { try { out.push(await trOne(t, lang)); } catch { out.push(''); } } return out;
}
function initTranslate() {
  const tabOf = (e) => ctx.tabs.find(t => t.view.webContents === e.sender);
  ipcMain.on('tr:one', async (e, id, text, lang) => {
    const t = tabOf(e); if (!t || (!t.trOn && !setting('tr'))) return;
    let r = ''; try { r = await trOne(text, lang); } catch {}
    if (!e.sender.isDestroyed()) e.sender.executeJavaScript(`window.__alTr&&window.__alTr(${+id},${JSON.stringify(r)})`).catch(() => {});
  });
  ipcMain.on('tr:batch', async (e, id, json, lang) => {
    const t = tabOf(e); if (!t || !t.trOn) return;
    let arr = []; try { arr = JSON.parse(json); } catch { return; }
    if (!Array.isArray(arr) || arr.length > 60) return;
    const r = await trBatch(arr.map(String), lang);
    if (!e.sender.isDestroyed()) e.sender.executeJavaScript(`window.__alTrB&&window.__alTrB(${+id},${JSON.stringify(JSON.stringify(r))})`).catch(() => {});
  });
}

/* ---------- Halaman offline ---------- */
async function saveOffline(t) {
  if (t.incog) return ctx.toast('Tidak tersedia di mode Incognito');
  const wc = t.view.webContents; if (!/^https?:/.test(t.url)) return ctx.toast('Buka sebuah situs dulu');
  fs.mkdirSync(offDir(), { recursive: true });
  const id = Date.now(); const mh = path.join(offDir(), id + '.mhtml'), pdf = path.join(offDir(), id + '.pdf');
  try {
    await wc.savePage(mh, 'MHTML');
    try { fs.writeFileSync(pdf, await wc.printToPDF({ printBackground: true })); } catch {}
    const l = ctx.off.data.filter(x => { if (x.url === t.url) { for (const f of [x.mhtml, x.pdf]) try { fs.unlinkSync(f); } catch {} return false; } return true; });
    l.push({ id, title: t.title || t.url, url: t.url, time: id, mhtml: mh, pdf: fs.existsSync(pdf) ? pdf : '' });
    ctx.off.data = l; ctx.off.save(); ctx.toast('Halaman disimpan offline');
  } catch (e) { ctx.toast('Gagal menyimpan halaman'); }
}

/* ---------- Bookmark HTML ---------- */
function exportBookmarksHtml() {
  const bm = ctx.bm.data; const by = {};
  bm.forEach(b => (by[b.f || ''] = by[b.f || ''] || []).push(b));
  const a = (b) => `    <DT><A HREF="${U.esc(b.u)}" ADD_DATE="${Math.floor((b.ts || 0) / 1000)}">${U.esc(b.t || b.u)}</A>\n`;
  let o = '<!DOCTYPE NETSCAPE-Bookmark-file-1>\n<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">\n<TITLE>Bookmarks</TITLE>\n<H1>Bookmarks</H1>\n<DL><p>\n';
  (by[''] || []).forEach(b => { o += a(b); });
  Object.keys(by).filter(k => k).forEach(k => { o += `    <DT><H3>${U.esc(k)}</H3>\n    <DL><p>\n`; by[k].forEach(b => { o += '    ' + a(b); }); o += '    </DL><p>\n'; });
  return o + '</DL><p>\n';
}
const unesc = (s) => s.replace(/&(amp|lt|gt|quot|#39);/g, (m, c) => ({ amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'" }[c]));
function importBookmarksHtml(html) {
  const re = /<(\/?)(DL|H3|A)\b([^>]*)>([^<]*)/gi; let m, stack = [], pending = '', n = 0;
  const have = new Set(ctx.bm.data.map(b => b.u));
  while ((m = re.exec(html))) {
    const close = m[1], tag = m[2].toUpperCase();
    if (tag === 'H3' && !close) pending = unesc(m[4].trim());
    else if (tag === 'DL') { if (!close) { stack.push(pending); pending = ''; } else stack.pop(); }
    else if (tag === 'A' && !close) {
      const h = /HREF="([^"]*)"/i.exec(m[3]); if (!h) continue; const u = unesc(h[1]);
      if (!/^https?:/i.test(u) || have.has(u)) continue; have.add(u);
      const f = stack.filter(Boolean).slice(-1)[0] || '';
      ctx.bm.data.push({ id: Date.now() + n, t: unesc(m[4].trim()) || u, u, f, ts: Date.now() }); n++;
    }
  }
  ctx.bm.save(); return n;
}

/* ---------- Kunci aplikasi (PIN) ---------- */
const lk = () => S().lock || DEFAULTS.lock;
function hashPin(pin, salt) { return crypto.scryptSync(String(pin), salt, 32).toString('hex'); }
function verifyPin(pin) { const l = lk(); if (!l.hash) return true; const a = Buffer.from(hashPin(pin, l.salt)), b = Buffer.from(l.hash); return a.length === b.length && crypto.timingSafeEqual(a, b); }
function setPin(pin) { const salt = crypto.randomBytes(16).toString('hex'); saveSetting('lock', Object.assign({}, lk(), { salt, hash: hashPin(pin, salt) })); }

/* ---------- Hapus data ---------- */
async function clearData(o) {
  const parts = ['persist:main', 'incog'].map(p => session.fromPartition(p));
  if (o.cookies) for (const s of parts) await s.clearStorageData();
  if (o.cache) for (const s of parts) await s.clearCache();
  if (o.history) { ctx.hist.data = []; ctx.hist.save(); }
  if (o.downloads) { ctx.dlList = ctx.dlList.filter(d => d.state === 'progressing'); persistDl(); dlPush(); }
  if (o.passwords) { ctx.pw.data = []; ctx.pw.save(); }
  if (o.perms) { ctx.perms.data = {}; ctx.perms.save(); }
  if (o.offline) { for (const x of ctx.off.data) for (const f of [x.mhtml, x.pdf]) try { fs.unlinkSync(f); } catch {} ctx.off.data = []; ctx.off.save(); }
}

/* ---------- DoH ---------- */
function applyDoh() {
  const k = setting('doh'); const url = k === 'custom' ? setting('dohcustom') : (U.DOH[k] || ['', ''])[1];
  try {
    if (k !== 'off' && /^https:\/\//.test(url)) app.configureHostResolver({ enableBuiltInResolver: true, secureDnsMode: 'secure', secureDnsServers: [url] });
    else app.configureHostResolver({ secureDnsMode: 'automatic', secureDnsServers: [] });
  } catch (e) { console.error('doh', e.message); }
}

module.exports = { trOne, DEFAULTS, setting, saveSetting, UA, MOBILE_UA, isMobileSite, localOk, offDir, setupSession, getPerm, setPerm, listPerms, PERM_LABEL,
  dlAct, listDownloads, dlSummary, dlPush, dlDir, pwFind, pwPut, dec, enc, initTranslate, saveOffline, exportBookmarksHtml, importBookmarksHtml,
  verifyPin, setPin, hashPin, clearData, applyDoh, EXT };
