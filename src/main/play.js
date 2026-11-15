/* AlethPlay — pemutar musik & video (alethra://play).
   Sisi main: pemindaian folder, penyajian file media lokal (dengan Range, tanpa membuka file:// ke situs web),
   penyimpanan playlist/riwayat, dan pembukaan otomatis file media. UI ada di renderer/pages/play.{html,js}. */
const { app, dialog, shell } = require('electron');
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const { Readable } = require('stream');
const { fileURLToPath } = require('url');
const ctx = require('./ctx');

const AUDIO = ['.mp3', '.m4a', '.aac', '.wav', '.flac', '.ogg', '.oga', '.opus', '.weba'];
const VIDEO = ['.mp4', '.m4v', '.webm', '.mkv', '.mov', '.ogv'];
const MIME = {
  '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.aac': 'audio/aac', '.wav': 'audio/wav', '.flac': 'audio/flac', '.ogg': 'audio/ogg', '.oga': 'audio/ogg', '.opus': 'audio/ogg', '.weba': 'audio/webm',
  '.mp4': 'video/mp4', '.m4v': 'video/mp4', '.webm': 'video/webm', '.mkv': 'video/x-matroska', '.mov': 'video/quicktime', '.ogv': 'video/ogg'
};
const EXTS = AUDIO.concat(VIDEO);
const kindOf = (p) => { const e = path.extname(String(p || '')).toLowerCase(); return AUDIO.includes(e) ? 'a' : VIDEO.includes(e) ? 'v' : ''; };
const isMedia = (p) => !!kindOf(p);
const exists = (p) => { try { return fs.statSync(p).isFile(); } catch { return false; } };
const SKIP = /^(\$recycle\.bin|system volume information|node_modules|\.git)$/i;

/* ---------- token: file lokal hanya bisa dibuka lewat alethra://media/<token>/…, token acak per sesi ---------- */
const tokByPath = new Map(), pathByTok = new Map();
function token(p) {
  p = path.resolve(p); let t = tokByPath.get(p);
  if (!t) { t = crypto.randomBytes(12).toString('hex'); tokByPath.set(p, t); pathByTok.set(t, p); }
  return t;
}
function describe(p, st) {
  p = path.resolve(p); const k = kindOf(p); if (!k) return null;
  try { st = st || fs.statSync(p); if (!st.isFile()) return null; } catch { return null; }
  const n = path.basename(p);
  return { p, n, k, s: st.size, m: Math.round(st.mtimeMs), u: 'alethra://media/' + token(p) + '/' + encodeURIComponent(n) };
}
const known = (p) => typeof p === 'string' && tokByPath.has(path.resolve(p));   // hanya file yang pernah ditampilkan AlethPlay
const lost = (p) => ({ p, n: path.basename(String(p || '')), k: kindOf(p) || 'a', s: 0, m: 0, u: '', missing: true });

/* Respons file dengan dukungan Range (dibutuhkan untuk seek video/audio). Dipanggil dari protokol alethra:// (services.js). */
function serve(req) {
  const u = new URL(req.url), seg = u.pathname.split('/').filter(Boolean);
  const file = pathByTok.get(seg[0] || '');
  if (!file || !isMedia(file)) return new Response('Not found', { status: 404 });
  let st; try { st = fs.statSync(file); if (!st.isFile()) throw 0; } catch { return new Response('Not found', { status: 404 }); }
  const size = st.size, h = { 'content-type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream', 'accept-ranges': 'bytes', 'cache-control': 'no-store' };
  if (!size) { h['content-length'] = '0'; return new Response(null, { status: 200, headers: h }); }
  let start = 0, end = size - 1, code = 200;
  const m = /^bytes=(\d*)-(\d*)$/.exec(req.headers.get('range') || '');
  if (m && (m[1] !== '' || m[2] !== '')) {
    if (m[1] === '') start = Math.max(0, size - (+m[2] || 0));
    else { start = +m[1]; if (m[2] !== '') end = Math.min(size - 1, +m[2]); }
    if (start > end || start >= size) return new Response(null, { status: 416, headers: { 'content-range': 'bytes */' + size } });
    code = 206; h['content-range'] = `bytes ${start}-${end}/${size}`;
  }
  h['content-length'] = String(end - start + 1);
  const rs = fs.createReadStream(file, { start, end });
  rs.on('error', () => {});
  return new Response(Readable.toWeb(rs), { status: code, headers: h });
}

/* ---------- sumber folder ---------- */
const store = () => { const d = ctx.play.data; if (!Array.isArray(d.folders)) d.folders = []; return d; };
const idOf = (p) => crypto.createHash('sha1').update(p.toLowerCase()).digest('hex').slice(0, 10);
function sources(dlDir) {
  const out = [], seen = new Set();
  const add = (p, n, user) => { try { p = path.resolve(p); } catch { return; } const k = p.toLowerCase(); if (!p || seen.has(k) || !fs.existsSync(p)) return; seen.add(k); out.push({ id: idOf(p), n, p, user: !!user }); };
  for (const [k, n] of [['music', 'Musik'], ['videos', 'Video'], ['downloads', 'Unduhan']]) { try { add(app.getPath(k), n, false); } catch {} }
  if (dlDir) add(dlDir, 'Unduhan Alethra', false);
  store().folders.forEach(p => add(p, path.basename(p) || p, true));
  return out;
}
const inside = (root, p) => { const r = path.resolve(root).toLowerCase(), q = path.resolve(p).toLowerCase(); return q === r || q.startsWith(r.endsWith(path.sep) ? r : r + path.sep); };

async function scan(root, depth, cap, out, seen) {
  let level = [root];
  for (let d = 0; d <= depth && level.length && out.length < cap; d++) {
    const next = [];
    for (const dir of level) {
      let ents; try { ents = await fs.promises.readdir(dir, { withFileTypes: true }); } catch { continue; }
      for (const e of ents) {
        if (out.length >= cap) break;
        if (e.name[0] === '.' || SKIP.test(e.name)) continue;
        const full = path.join(dir, e.name);
        if (e.isDirectory()) next.push(full);
        else if (e.isFile() && isMedia(e.name)) {
          const k = full.toLowerCase(); if (seen.has(k)) continue; seen.add(k);
          const it = describe(full); if (it) out.push(it);
        }
      }
    }
    level = next;
  }
}
let libCache = null;

/* ---------- pembukaan otomatis ---------- */
let pending = [];
function enabled() { return !ctx.setting || (ctx.setting('tools') || {}).play !== false; }
// Buka file media di tab AlethPlay. Mengembalikan false bila tidak ada file media / fitur dimatikan (pemanggil memakai perilaku lama).
function openFiles(paths) {
  if (!enabled()) return false;
  const items = (paths || []).map(p => { try { return exists(p) ? describe(p) : null; } catch { return null; } }).filter(Boolean);
  if (!items.length) return false;
  pending = items; ctx.openPlayTab && ctx.openPlayTab(); return true;
}
function fromUrl(u) { try { return /^file:/i.test(u) ? fileURLToPath(u) : ''; } catch { return ''; } }
function argFiles(argv, cwd) {
  return (argv || []).slice(1).filter(a => a && !/^-/.test(a) && !/^[a-z][a-z0-9+.-]+:\/\//i.test(a) && isMedia(a))
    .map(a => path.resolve(cwd || process.cwd(), a)).filter(exists);
}

/* ---------- API untuk halaman alethra://play ---------- */
const clampArr = (a, n) => Array.isArray(a) ? a.slice(0, n) : [];
const str = (s, n) => String(s == null ? '' : s).slice(0, n);
function cleanItems(a, n) { return clampArr(a, n).filter(x => x && typeof x.p === 'string' && isMedia(x.p)).map(x => ({ p: str(x.p, 600), n: str(x.n || path.basename(x.p), 300), k: kindOf(x.p) })); }
function api(U) {
  const dlDir = () => U.dlDir();
  const allowed = (dir) => sources(dlDir()).some(s => inside(s.p, dir));
  return {
    'play.get': () => { const d = store(); return { lists: d.lists || [], history: d.history || [], state: d.state || {}, resume: d.resume || {} }; },
    'play.set': (e, key, v) => {
      const d = store();
      if (key === 'lists') {
        if (!Array.isArray(v)) return false;
        d.lists = clampArr(v, 200).filter(l => l && l.id).map(l => ({ id: str(l.id, 40), name: str(l.name, 80) || 'Playlist', items: cleanItems(l.items, 3000) }));
      } else if (key === 'history') {
        if (!Array.isArray(v)) return false;
        d.history = clampArr(v, 300).filter(x => x && typeof x.p === 'string' && isMedia(x.p)).map(x => ({ p: str(x.p, 600), n: str(x.n, 300), k: kindOf(x.p), t: +x.t || Date.now() }));
      } else if (key === 'state') {
        if (!v || typeof v !== 'object') return false;
        d.state = { vol: Math.max(0, Math.min(1, +v.vol)) || 0, muted: !!v.muted, shuffle: !!v.shuffle, repeat: ['off', 'all', 'one'].includes(v.repeat) ? v.repeat : 'off' };
      } else if (key === 'resume') {
        if (!v || typeof v !== 'object') return false;
        const o = {}; Object.keys(v).slice(-200).forEach(k => { if (isMedia(k) && Number.isFinite(+v[k])) o[str(k, 600)] = Math.round(+v[k]); });
        d.resume = o;
      } else return false;
      ctx.play.save(); return true;
    },
    'play.pending': () => { const x = pending; pending = []; return x; },
    'play.sources': () => sources(dlDir()),
    'play.library': async (e, force) => {
      if (!force && libCache && Date.now() - libCache.t < 60000) return libCache.items;
      const out = [], seen = new Set();
      for (const s of sources(dlDir())) await scan(s.p, 4, 6000, out, seen);
      libCache = { t: Date.now(), items: out }; return out;
    },
    'play.dir': async (e, dir) => {
      if (!dir || typeof dir !== 'string' || !allowed(dir)) return null;
      dir = path.resolve(dir);
      let ents; try { ents = await fs.promises.readdir(dir, { withFileTypes: true }); } catch { return null; }
      const dirs = [], files = [];
      for (const en of ents) {
        if (en.name[0] === '.' || SKIP.test(en.name)) continue;
        const full = path.join(dir, en.name);
        if (en.isDirectory()) dirs.push({ n: en.name, p: full });
        else if (en.isFile() && isMedia(en.name)) { const it = describe(full); if (it) files.push(it); }
      }
      const cmp = (a, b) => a.n.localeCompare(b.n, undefined, { numeric: true, sensitivity: 'base' });
      dirs.sort(cmp); files.sort(cmp);
      const root = sources(dlDir()).find(s => path.resolve(s.p).toLowerCase() === dir.toLowerCase());
      const parent = root ? '' : (allowed(path.dirname(dir)) ? path.dirname(dir) : '');
      return { dir, parent, dirs, files };
    },
    'play.addFolder': async () => {
      const r = await dialog.showOpenDialog(ctx.win && ctx.win(), { properties: ['openDirectory'] });
      if (r.canceled || !r.filePaths[0]) return null;
      const d = store(), p = path.resolve(r.filePaths[0]);
      if (!d.folders.some(x => x.toLowerCase() === p.toLowerCase())) { d.folders.push(p); ctx.play.save(); }
      libCache = null; return sources(dlDir());
    },
    'play.removeFolder': (e, p) => {
      const d = store(); d.folders = d.folders.filter(x => x.toLowerCase() !== String(p).toLowerCase()); ctx.play.save(); libCache = null; return sources(dlDir());
    },
    'play.pick': async () => {
      const r = await dialog.showOpenDialog(ctx.win && ctx.win(), { properties: ['openFile', 'multiSelections'], filters: [{ name: 'Musik & video', extensions: EXTS.map(x => x.slice(1)) }] });
      if (r.canceled) return [];
      return r.filePaths.map(p => describe(p)).filter(Boolean);
    },
    'play.resolve': (e, paths) => clampArr(paths, 3000).map(p => { if (typeof p !== 'string' || !isMedia(p)) return null; return describe(p) || lost(p); }).filter(Boolean),
    'play.downloads': () => ctx.dlList.slice().reverse().filter(d => d.state === 'completed' && d.path && isMedia(d.path)).map(d => describe(d.path)).filter(Boolean),
    'play.reveal': (e, p) => { if (known(p) && exists(p)) shell.showItemInFolder(path.resolve(p)); },
    'play.external': (e, p) => { if (known(p) && isMedia(p) && exists(p)) shell.openPath(path.resolve(p)); }
  };
}

module.exports = { serve, openFiles, isMedia, fromUrl, argFiles, api, EXTS: EXTS.map(x => x.slice(1)) };
