// Terjemahan Suara: audio video ditangkap oleh stt.js (di halaman), dikenali Whisper (cloud / server kompatibel OpenAI)
// atau mesin offline di PC (sherpa-onnx, Whisper Transformers.js, Vosk), diterjemahkan Google Translate atau terjemahan offline (Opus-MT, NLLB-200 600M),
// lalu ditampilkan di popup (overlay) atau sebagai subtitle layar penuh.
const { ipcMain } = require('electron');
const fs = require('fs'), path = require('path');
const ctx = require('./ctx');
const SV = require('./services');
const OFF = require('./offline');

let H = {};                       // pengait dari main.js: toast, changed, script, openSettings
let S = null;                     // sesi aktif
const pos = { x: 0, y: 0 };       // geseran popup (diseret pengguna)
let fsMode = false;               // video sedang layar penuh
let idleT = null;

/* ---------- riwayat (hanya di memori; maks 5 sesi terakhir) ---------- */
const sessions = [];            // terbaru di depan
let sessSeq = 0;
const MAXLOG = 3000;            // kalimat per sesi; yang tertua dibuang
const pushLog = (sid, entry) => { try { ctx.broadcastPages && ctx.broadcastPages('stt-log', { sid, entry }); } catch {} };
const pushSess = () => { try { ctx.broadcastPages && ctx.broadcastPages('stt-sess', sessionList()); } catch {} };
function newSession(tab) {
  if (tab.incog || SV.setting('sthist') === false) return null;      // Incognito tidak pernah dicatat
  const ss = { id: ++sessSeq, tabId: tab.id, title: tab.title || tab.url, url: tab.url, started: Date.now(), ended: 0, live: true, entries: [] };
  sessions.unshift(ss); while (sessions.length > 5) sessions.pop();
  return ss;
}
function sessionList() { return sessions.map(s => ({ id: s.id, title: s.title, url: s.url, started: s.started, live: s.live, n: s.entries.length, tabId: s.tabId })); }
function logPut(j, patch) {
  const ss = S && S.sess; if (!ss) return;
  let e = null;
  for (let i = ss.entries.length - 1; i >= 0; i--) if (ss.entries[i].seq === j.seq) { e = ss.entries[i]; break; }
  if (!e) {
    const durMs = Math.max(300, (j.buf.length - 44) / 32);           // WAV 16-bit mono 16 kHz = 32 byte per ms
    const we = Math.max(0, j.t - ss.started), ws = Math.max(0, we - durMs);
    e = { seq: j.seq, ws, we, vs: j.vs == null ? -1 : j.vs, ve: j.ve == null ? -1 : j.ve, lang: '', orig: '', tr: '' };
    ss.entries.push(e); if (ss.entries.length > MAXLOG) ss.entries.shift();
  }
  Object.assign(e, patch, j.lang && !e.lang ? { lang: j.lang } : {});
  pushLog(ss.id, e);
}
const find = (sid) => sessions.find(s => s.id === sid) || sessions[0] || null;
// waktu tiap kalimat: posisi video bila ada (cocok dengan videonya), kalau tidak waktu sejak sesi dimulai
const span = (e) => e.vs >= 0 && e.ve >= 0 ? { s: e.vs * 1000, e: e.ve * 1000, video: true } : { s: e.ws, e: e.we, video: false };
const pad = (n, l) => String(Math.floor(n)).padStart(l || 2, '0');
function stamp(ms, srt) { ms = Math.max(0, Math.round(ms)); const h = ms / 3600000, m = (ms % 3600000) / 60000, s = (ms % 60000) / 1000; return pad(h) + ':' + pad(m) + ':' + pad(s) + (srt ? ',' + pad(ms % 1000, 3) : ''); }
const lineOf = (e, mode) => {
  const o = (e.orig || '').trim(), t = (e.tr || '').trim();
  if (mode === 'orig') return o; if (mode === 'tr') return t || o;
  return t && o && t !== o ? t + '\n' + o : (t || o);
};
function cuesOf(ss, mode) {
  const list = ss.entries.map(e => ({ e, t: span(e), text: lineOf(e, mode) })).filter(c => c.text).sort((a, b) => a.t.s - b.t.s);
  return list;
}
// fmt: 'txt' | 'srt'; mode: 'both' | 'orig' | 'tr'; stamps: tambahkan waktu di .txt
function build(sid, fmt, mode, stamps) {
  const ss = find(sid); if (!ss) return '';
  mode = ['both', 'orig', 'tr'].includes(mode) ? mode : 'both';
  const cues = cuesOf(ss, mode);
  if (fmt === 'srt') {
    return cues.map((c, i) => {
      const nx = cues[i + 1]; let end = Math.max(c.t.e, c.t.s + 800);
      if (nx && nx.t.s > c.t.s + 300) end = Math.min(end, nx.t.s - 10);
      if (end <= c.t.s) end = c.t.s + 800;
      return (i + 1) + '\r\n' + stamp(c.t.s, true) + ' --> ' + stamp(end, true) + '\r\n' + c.text.replace(/\n/g, '\r\n') + '\r\n';
    }).join('\r\n');
  }
  const head = [ss.title, ss.url, new Date(ss.started).toLocaleString('id-ID')].filter(Boolean).join('\n') + '\n\n';
  return head + cues.map(c => (stamps !== false ? '[' + stamp(c.t.s) + '] ' : '') + c.text.replace(/\n/g, '\n' + (stamps !== false ? '           ' : ''))).join('\n') + '\n';
}
const fileBase = (ss) => { let h = ''; try { h = new URL(ss.url).hostname; } catch {} const d = new Date(ss.started), p2 = (n) => String(n).padStart(2, '0'); return ('Transkrip ' + (h || 'video') + ' ' + d.getFullYear() + p2(d.getMonth() + 1) + p2(d.getDate()) + '-' + p2(d.getHours()) + p2(d.getMinutes())).replace(/[<>:"/\\|?*]/g, '_'); };
function autosave(ss) {
  if (!ss || !ss.entries.length || SV.setting('stauto') !== true) return;
  try {
    const dir = path.join(SV.dlDir(), 'Transkrip Alethra'); fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, fileBase(ss) + '.srt'), build(ss.id, 'srt', 'both'), 'utf8');
    fs.writeFileSync(path.join(dir, fileBase(ss) + '.txt'), build(ss.id, 'txt', 'both', true), 'utf8');
    SV.recordSaved(path.join(dir, fileBase(ss) + '.srt'), 'application/x-subrip');
    SV.recordSaved(path.join(dir, fileBase(ss) + '.txt'), 'text/plain');
    H.toast('Riwayat disimpan di ' + dir);
  } catch (e) { H.toast('Gagal menyimpan riwayat: ' + (e && e.message)); }
}

const HALLUC = ['ご視聴ありがとうございました', 'ご視聴ありがとうございます', 'ご清聴ありがとうございました', 'チャンネル登録', '字幕提供', '最後までご視聴', '请不吝点赞', '感谢观看', '시청해 주셔서 감사합니다', '구독과 좋아요'];
const COMMON = new Set(['thank you', 'thanks for watching', 'thank you for watching', 'you', 'bye', 'okay', 'terima kasih']);
const keyOf = () => { const e = ctx.settings.data.stkeyEnc; return e ? SV.dec(e) : ''; };
const num = (v, d) => (typeof v === 'number' && isFinite(v) ? v : d);
const A = () => SV.setting('sta');
const offlineOn = () => ['offline', 'tjs', 'vosk'].includes(SV.setting('stengine'));   // sherpa-onnx, Whisper (Transformers.js), atau Vosk

function init(h) {
  H = h;
  ipcMain.on('stt:chunk', (e, tok, b64, mime, t0, t1) => {
    if (!S || tok !== S.tok || e.sender !== S.tab.view.webContents) return;
    if (b64.length > 8e6) return;
    const vs = Number.isFinite(t0) && t0 >= 0 ? t0 : -1, ve = Number.isFinite(t1) && t1 >= 0 ? t1 : -1;
    S.queue.push({ seq: ++S.seq, buf: Buffer.from(b64, 'base64'), mime, t: Date.now(), vs, ve });
    if (S.queue.length > 6) { S.queue.shift(); setStatus(offlineOn() ? 'PC kewalahan, melewati sebagian suara… (coba model lebih kecil)' : 'Jaringan lambat, melewati sebagian suara…'); }
    pump();
  });
  ipcMain.on('stt:status', (e, tok, t) => {
    if (!S || tok !== S.tok || e.sender !== S.tab.view.webContents) return;
    S.base = String(t).slice(0, 80); setStatus(null);
  });
}
const active = () => !!S;
const activeTabId = () => (S ? S.tab.id : null);

function audCfg() {
  const a = A();
  return { pg: num(a.pg, 1), hp: num(a.hp, 80), lp: num(a.lp, 0), min: num(a.min, 0), max: num(a.max, 0), sens: num(a.sens, 2.8), dur: num(a.dur, 300), ns: num(a.ns, 0), gate: num(a.gate, 0), auto: num(a.auto, 6), legacy: !!a.legacy, meter: !!a.meter };
}
function inject() {
  if (!S) return;
  const wc = S.tab.view.webContents; if (wc.isDestroyed()) return stop();
  const cfg = { tok: S.tok, mode: SV.setting('stspeed'), off: offlineOn(), vosk: false, live: false, aud: audCfg() };
  wc.executeJavaScript(`window.__alSttCfg=${JSON.stringify(cfg)};` + H.script('stt.js')).catch(() => setStatus('Gagal memasang penangkap suara'));
}
function start(tab) {
  if (S) stop();
  const prov = SV.setting('stprov');
  if (!/^https?:/.test(tab.url)) return H.toast('Buka halaman berisi video dulu');
  if (offlineOn()) {
    if (!OFF.sttReady()) { H.toast('Pasang model suara ke teks offline dulu di Pengaturan > Mesin offline'); H.openSettings('mesinoff'); return; }
  } else if (prov === 'custom' ? !/^https?:\/\//.test(SV.setting('stcurl')) : !keyOf()) { H.toast(prov === 'custom' ? 'Isi alamat server di Pengaturan > Play' : 'Isi Kunci API dulu di Pengaturan > Play > Terjemahan Suara'); H.openSettings('play'); return; }
  S = { tab, tok: String(Date.now()) + Math.random().toString(36).slice(2, 8), seq: 0, queue: [], busy: 0, cool: 0, ctxTail: '', base: 'Menyiapkan…', lat: '', lines: { cur: null, prev: null }, status: 'Menyiapkan…', gen: 0, sess: newSession(tab) };
  if (S.sess) pushSess();
  pos.x = 0; pos.y = 0; inject(); H.changed();
  if (offlineOn()) {
    const me = S; setStatus('Memuat model suara…');
    OFF.warm().then(() => { if (S === me) setStatus(null); }).catch(e => { if (S !== me) return; H.toast(e.message); stop(); });
  }
}
function stop() {
  if (!S) return;
  try { if (!S.tab.view.webContents.isDestroyed()) S.tab.view.webContents.executeJavaScript('window.__alSTT&&window.__alSTT.stop()').catch(() => {}); } catch {}
  const ss = S.sess; if (ss) { ss.live = false; ss.ended = Date.now(); autosave(ss); }
  S = null; clearTimeout(idleT); OFF.sttStop(); H.changed(); if (ss) pushSess();
}
function refresh() { if (S) { inject(); H.changed(); } }
// Kesiapan Terjemahan Suara, dibaca sebelum fitur dijalankan (dipakai menu Tools): { ok, short, msg, sec }
// short = keterangan pendek di menu; sec = bagian Pengaturan yang perlu dibuka.
function readiness() {
  if (SV.setting('stt') === false) return { ok: false, short: 'Dimatikan di Play', msg: 'Terjemahan Suara dimatikan di Pengaturan > Play', sec: 'play' };
  if (offlineOn()) {
    if (!OFF.sttReady()) return { ok: false, short: 'Model suara belum terpasang', msg: 'Pasang model suara ke teks offline dulu di Pengaturan > Mesin offline', sec: 'mesinoff' };
    const tm = SV.setting('trmode');
    if (tm === 'nllb' && !OFF.nllbReady() && !SV.setting('mtfb')) return { ok: false, short: 'Model NLLB belum terpasang', msg: 'Pasang model NLLB di Pengaturan > Mesin offline', sec: 'mesinoff' };
  } else {
    const prov = SV.setting('stprov');
    if (prov === 'custom' ? !/^https?:\/\//.test(SV.setting('stcurl')) : !keyOf()) return { ok: false, short: prov === 'custom' ? 'Alamat server belum diisi' : 'Kunci API belum diisi', msg: 'Lengkapi pengaturan di Pengaturan > Play', sec: 'play' };
  }
  return { ok: true };
}
// Muat model lebih dulu (tanpa menjalankan fitur), lalu lepas lagi bila tidak jadi dipakai.
function prewarm() {
  if (S || !offlineOn() || !readiness().ok) return;
  OFF.warm().then(() => { if (!S) OFF.sttStop(); }).catch(() => {});
}
function toggle(tab) { if (S && S.tab === tab) stop(); else start(tab); }

function setStatus(msg) {
  if (!S) return;
  if (msg) S.msg = msg; else S.msg = '';
  S.status = (S.msg || S.base || '') + (S.msg ? '' : S.lat);
  H.changed();
}
function touch() { if (!fsMode) return; S.idle = false; clearTimeout(idleT); idleT = setTimeout(() => { if (S) { S.idle = true; H.changed(); } }, 8000); }
function setFs(v) { fsMode = !!v; if (S) { S.idle = false; if (v) touch(); H.changed(); } }
function drag(dx, dy) { pos.x += dx | 0; pos.y += dy | 0; H.changed(); }
const miniPos = { x: 0, y: 0 };   // geseran ikon mic (mode diminimalkan) dari posisi bawaan
function dragMini(dx, dy) { miniPos.x += dx | 0; miniPos.y += dy | 0; H.changed(); }

/* ---------- filter teks ---------- */
function noise(t, checkCtx = true) {
  const a = A(), rx = /[^\p{L}\p{N} ]/gu;
  const n = t.toLowerCase().replace(rx, '').trim();
  if (n.length < (a.legacy ? 2 : num(a.minlen, 2))) return true;
  if (!a.legacy && a.filt === false) return false;
  if (n.length < 2 || COMMON.has(n)) return true;
  if (a.legacy) return checkCtx && n.length >= 12 && S && S.ctxTail.toLowerCase().replace(rx, '').includes(n);
  const cjk = t.replace(/[\s\p{P}\p{S}]/gu, '');
  if (cjk.length <= 30 && HALLUC.some(h => cjk.includes(h))) return true;
  if (cjk.length >= 8) { const m = /(.{1,6}?)\1{3,}/u.exec(cjk); if (m && m[0].length * 10 >= cjk.length * 6) return true; }
  if (!checkCtx || !S) return false;
  return n.length >= 12 && S.ctxTail.toLowerCase().replace(rx, '').includes(n);
}

/* ---------- Whisper ---------- */
class SttError extends Error { constructor(m, fatal) { super(m); this.fatal = fatal; } }
async function transcribe(buf, job) {
  if (offlineOn()) {
    try { const r = await OFF.transcribe(buf); if (job) job.lang = r.lang; return r.text; }
    catch (e) { throw new SttError(e.message || 'Mesin offline gagal', !!e.fatal); }
  }
  const prov = SV.setting('stprov'); let url, model;
  const headers = {}; const key = keyOf();
  if (prov === 'openai') { url = 'https://api.openai.com/v1/audio/transcriptions'; model = 'whisper-1'; }
  else if (prov === 'custom') { const b = SV.setting('stcurl').replace(/\/+$/, ''); url = /\/audio\/transcriptions$/.test(b) ? b : b + '/audio/transcriptions'; model = SV.setting('stcmodel') || 'whisper-1'; }
  else { url = 'https://api.groq.com/openai/v1/audio/transcriptions'; model = 'whisper-large-v3-turbo'; }
  if (key) headers.Authorization = 'Bearer ' + key;
  const fd = new FormData();
  fd.append('model', model); fd.append('response_format', 'verbose_json'); fd.append('temperature', '0');
  const lang = (SV.setting('stlang') || '').split('-')[0]; if (lang) fd.append('language', lang);
  const c = S && S.ctxTail.trim().replace(/[\r\n]+/g, ' '); if (c) fd.append('prompt', c);
  fd.append('file', new Blob([buf], { type: 'audio/wav' }), 'audio.wav');
  let r;
  try { r = await fetch(url, { method: 'POST', headers, body: fd, signal: AbortSignal.timeout(20000) }); }
  catch { throw new SttError('Gagal menghubungi layanan suara ke teks', false); }
  if (r.status === 401 || r.status === 403) throw new SttError('Kunci API ditolak. Periksa kunci di Pengaturan > Play', true);
  if (r.status === 429) { const ra = Math.min(60, Math.max(2, parseFloat(r.headers.get('retry-after')) || 10)); if (S) S.cool = Date.now() + ra * 1000; throw new SttError(`Batas layanan tercapai, jeda ${Math.round(ra)} dtk`, false); }
  if (!r.ok) throw new SttError(`Layanan suara ke teks error (${r.status})`, false);
  const j = await r.json();
  if (job) job.lang = OFF.langFromName(j.language);
  if (!Array.isArray(j.segments) || !j.segments.length) return String(j.text || '').trim();
  let out = '';
  for (const g of j.segments) {
    if ((g.no_speech_prob || 0) > 0.6 && (g.avg_logprob || 0) < -0.7) continue;
    if ((g.compression_ratio || 0) > 2.4) continue;
    out += (g.text || '') + ' ';
  }
  return out.replace(/\s+/g, ' ').trim();
}

/* ---------- antrean ---------- */
function pump() {
  if (!S) return;
  const now = Date.now();
  if (S.cool > now) { if (S.queue.length && !S.pt) S.pt = setTimeout(() => { if (S) { S.pt = null; pump(); } }, S.cool - now + 50); return; }
  while (S.busy < 2 && S.queue.length) { const j = S.queue.shift(), me = S; me.busy++; run(j).finally(() => { me.busy--; if (S === me) pump(); }); }
}
async function run(j) {
  const me = S;
  let text;
  try { setStatus(`Mengenali ${(j.buf.length / 32000).toFixed(1)} dtk suara${offlineOn() ? ' (offline)' : ''}…`); text = await transcribe(j.buf, j); }
  catch (e) { if (S !== me) return; if (e.fatal) { setStatus(e.message); H.toast(e.message); stop(); return; } setStatus(e.message); return; }
  if (S !== me) return;
  setStatus(null);
  if (!text || noise(text)) return;
  me.ctxTail = (me.ctxTail + ' ' + text).slice(-200);
  place(j.seq, { orig: text, tr: '' }); logPut(j, { orig: text }); touch();
  const tgt = SV.setting('trLang'); let tr = '', trFail = '';
  try { tr = await translateText(text, j.lang, tgt); } catch (e) { trFail = e.message || 'Terjemahan gagal'; }
  if (S !== me) return;
  if (tr && tr.trim() === text.trim()) tr = '';
  place(j.seq, { tr }); logPut(j, { tr }); touch();
  me.lat = ' · tunda ' + ((Date.now() - j.t) / 1000).toFixed(1) + ' dtk'; setStatus(trFail || null);
}
// terjemahan: offline (Opus-MT, CTranslate2, Bergamot atau NLLB) bila dipilih, dengan cadangan Google Translate; selain itu Google Translate
async function translateText(text, src, tgt) {
  text = text.slice(0, 500);
  const mode = SV.setting('trmode');
  if (mode === 'offline' || mode === 'nllb' || mode === 'ct2' || mode === 'bergamot') {
    const stl = SV.setting('stlang'), sl = src || (stl && stl.split('-')[0]);
    try { return await OFF.translateBy(mode, text, sl, tgt); }
    catch (e) { if (SV.setting('mtfb') === false) throw new Error(e && e.missing ? e.message : 'Terjemahan offline gagal: ' + (e && e.message)); }
  }
  try { return await SV.trOne(text, tgt); } catch { throw new Error('Google Translate gagal, periksa internet'); }
}
// kalimat bernomor urut: yang terlambat masuk ke slot "sebelumnya", tidak menimpa yang lebih baru
function place(seq, patch) {
  const L = S.lines;
  if (!L.cur || seq > L.cur.seq) { L.prev = L.cur; L.cur = Object.assign({ seq, orig: '', tr: '' }, patch); }
  else if (seq === L.cur.seq) Object.assign(L.cur, patch);
  else if (L.prev && seq === L.prev.seq) Object.assign(L.prev, patch);
  H.changed();
}

/* ---------- untuk overlay ---------- */
const FS = { size: { sm: 22, md: 30, lg: 40, xl: 52 }, col: { white: '#ffffff', yellow: '#ffe14d', cyan: '#6fe3ff' } };
const HEX = /^#[0-9a-f]{6}$/i;
const clampN = (v, a, b, d) => { v = Number(v); return Number.isFinite(v) ? Math.max(a, Math.min(b, Math.round(v))) : d; };
const SHADOWS = ['auto', 'on', 'off'];
// Rentang nilai pengaturan kotak. 0 pada width/height layar penuh berarti otomatis.
const LIM = {
  stf: { bgop: [-1, 100], sizepx: [0, 120], width: [0, 3000], height: [0, 1200], radius: [0, 40], offy: [-40, 400] },
  stb: { bgop: [0, 100], size: [10, 72], width: [260, 2400], height: [90, 1000], radius: [0, 40] }
};
function sanitize(k, o) {
  for (const [f, [a, b]] of Object.entries(LIM[k] || {})) if (f in o) o[f] = clampN(o[f], a, b, SV.DEFAULTS[k][f]);
  if ('bgcol' in o && o.bgcol !== '' && !HEX.test(o.bgcol)) o.bgcol = SV.DEFAULTS[k].bgcol;
  if ('color' in o && o.color !== '' && !HEX.test(o.color) && !(k === 'stf' && FS.col[o.color])) o.color = SV.DEFAULTS[k].color;
  if ('shadow' in o && !SHADOWS.includes(o.shadow)) o.shadow = 'auto';
  return o;
}
function resetPos() { pos.x = 0; pos.y = 0; H.changed(); }
// boxOf(tabId) -> { x, y, w, h } panel tempat video berada (koordinat jendela), atau null bila tab tidak terlihat (popup disembunyikan, sesi tetap jalan)
function ui(win, boxOf, miniOf) {
  if (!S) return null;
  const f = SV.setting('stf'), b = SV.setting('stb'), fs = fsMode;
  const box = boxOf ? boxOf(S.tab.id) : { x: 0, y: 0, w: win[0], h: win[1] };
  if (!box) return null;
  const w = box.w, h = box.h;
  let rect, cfg;
  if (fs) {
    const px = f.sizepx > 0 ? clampN(f.sizepx, 10, 120, 30) : (FS.size[f.size] || 30);
    const fixW = f.width > 0, fixH = f.height > 0;
    const rh = fixH ? Math.min(clampN(f.height, 40, 1200, 100), Math.max(40, h - 20)) : Math.round(px * 4.2 + 24);
    const rw = fixW ? Math.min(clampN(f.width, 200, 3000, 1100), Math.max(200, w - 20)) : Math.min(w - 80, 1100);
    const off = clampN(f.offy, -40, 400, 0);
    let y = f.pos === 'top' ? 50 + off : h - rh - 90 - off;
    y = Math.max(0, Math.min(Math.max(0, h - rh), y));
    rect = { x: Math.round((w - rw) / 2), y, w: rw, h: rh };
    const op = f.bgop >= 0 ? f.bgop : ({ dim: 62, solid: 100, none: 0 }[f.bg] != null ? { dim: 62, solid: 100, none: 0 }[f.bg] : 62);
    cfg = { size: px, pos: f.pos, bgop: op, bgcol: HEX.test(f.bgcol) ? f.bgcol : '#000000', color: HEX.test(f.color) ? f.color : (FS.col[f.color] || '#ffffff'), orig: f.orig !== false,
      radius: clampN(f.radius, 0, 40, 12), bold: f.bold !== false, shadow: f.shadow === 'on' || (f.shadow !== 'off' && op <= 20), fixW, fixH };
  } else {
    const rw = Math.min(clampN(b.width, 260, 2400, 720), w - 40), rh = Math.max(90, Math.min(clampN(b.height, 90, 1000, 168), h - 20));
    rect = { x: Math.round((w - rw) / 2) + pos.x, y: h - rh - 24 + pos.y, w: rw, h: rh };
    rect.x = Math.max(0, Math.min(w - rw, rect.x)); rect.y = Math.max(0, Math.min(h - rh, rect.y));
    pos.x = rect.x - Math.round((w - rw) / 2); pos.y = rect.y - (h - rh - 24);
    const op = clampN(b.bgop, 0, 100, 100);
    cfg = { size: clampN(b.size, 10, 72, 20), bgop: op, bgcol: HEX.test(b.bgcol) ? b.bgcol : '', color: HEX.test(b.color) ? b.color : '', radius: clampN(b.radius, 0, 40, 16),
      bold: b.bold !== false, border: b.border !== false, prev: b.prev !== false, orig: f.orig !== false, shadow: b.shadow === 'on' || (b.shadow !== 'off' && op <= 20) };
  }
  rect.x += box.x; rect.y += box.y;
  // Panel video sedang dalam tampilan terpisah (riwayat / split view): kotak mengecil jadi ikon mic bulat di tepi kanan panel, sejajar dengan bawah kotak
  if (miniOf && miniOf(S.tab.id)) {
    const M = 44, bx = Math.max(box.x + 4, box.x + box.w - M - 16), by = Math.max(box.y + 4, Math.min(box.y + box.h - M - 8, rect.y + rect.h - M));
    const mx = Math.max(box.x + 4, Math.min(box.x + box.w - M - 4, bx + miniPos.x)), my = Math.max(box.y + 4, Math.min(box.y + box.h - M - 4, by + miniPos.y));
    miniPos.x = mx - bx; miniPos.y = my - by;      // tetap di dalam panel video
    return { mini: true, rect: { x: mx, y: my, w: M, h: M }, fs: false, idle: false, status: S.status, cur: S.lines.cur, prev: S.lines.prev, cfg, logOn: !!S.sess, wasFs: fs };
  }
  return { rect, fs, idle: !!S.idle, status: S.status, cur: S.lines.cur, prev: S.lines.prev, cfg, logOn: !!S.sess };
}
// riwayat untuk halaman alethra://transcript dan ekspor
const sessionsApi = { list: sessionList, entries: (sid) => { const s = find(sid); return s ? s.entries.slice() : []; }, build, fileBase: (sid) => { const s = find(sid); return s ? fileBase(s) : 'Transkrip'; },
  clear: (sid) => { const s = find(sid); if (!s) return false; s.entries.length = 0; pushSess(); pushLog(s.id, null); return true; },
  last: () => { const s = find(); const e = s && s.entries.filter(x => x.orig || x.tr).slice(-1)[0]; return e ? lineOf(e, 'both') : ''; },
  tabOf: (sid) => { const s = find(sid); return s ? s.tabId : null; } };
module.exports = { init, start, stop, toggle, readiness, prewarm, hist: sessionsApi, refresh, active, activeTabId, setFs, drag, dragMini, ui, sanitize, resetPos };
