// Terjemahan Suara: audio video ditangkap oleh stt.js (di halaman), dikenali Whisper (cloud / server kompatibel OpenAI)
// atau mesin offline di PC (sherpa-onnx), diterjemahkan Google Translate atau terjemahan offline (Opus-MT),
// lalu ditampilkan di popup (overlay) atau sebagai subtitle layar penuh.
const { ipcMain } = require('electron');
const ctx = require('./ctx');
const SV = require('./services');
const OFF = require('./offline');

let H = {};                       // pengait dari main.js: toast, changed, script, openSettings
let S = null;                     // sesi aktif
const pos = { x: 0, y: 0 };       // geseran popup (diseret pengguna)
let fsMode = false;               // video sedang layar penuh
let idleT = null;

const HALLUC = ['ご視聴ありがとうございました', 'ご視聴ありがとうございます', 'ご清聴ありがとうございました', 'チャンネル登録', '字幕提供', '最後までご視聴', '请不吝点赞', '感谢观看', '시청해 주셔서 감사합니다', '구독과 좋아요'];
const COMMON = new Set(['thank you', 'thanks for watching', 'thank you for watching', 'you', 'bye', 'okay', 'terima kasih']);
const keyOf = () => { const e = ctx.settings.data.stkeyEnc; return e ? SV.dec(e) : ''; };
const num = (v, d) => (typeof v === 'number' && isFinite(v) ? v : d);
const A = () => SV.setting('sta');
const offlineOn = () => SV.setting('stengine') === 'offline';

function init(h) {
  H = h;
  ipcMain.on('stt:chunk', (e, tok, b64, mime) => {
    if (!S || tok !== S.tok || e.sender !== S.tab.view.webContents) return;
    if (b64.length > 8e6) return;
    S.queue.push({ seq: ++S.seq, buf: Buffer.from(b64, 'base64'), mime, t: Date.now() });
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
  S = { tab, tok: String(Date.now()) + Math.random().toString(36).slice(2, 8), seq: 0, queue: [], busy: 0, cool: 0, ctxTail: '', base: 'Menyiapkan…', lat: '', lines: { cur: null, prev: null }, status: 'Menyiapkan…', gen: 0 };
  pos.x = 0; pos.y = 0; inject(); H.changed();
  if (offlineOn()) {
    const me = S; setStatus('Memuat model suara…');
    OFF.warm().then(() => { if (S === me) setStatus(null); }).catch(e => { if (S !== me) return; H.toast(e.message); stop(); });
  }
}
function stop() {
  if (!S) return;
  try { if (!S.tab.view.webContents.isDestroyed()) S.tab.view.webContents.executeJavaScript('window.__alSTT&&window.__alSTT.stop()').catch(() => {}); } catch {}
  S = null; clearTimeout(idleT); OFF.sttStop(); H.changed();
}
function refresh() { if (S) { inject(); H.changed(); } }
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
  place(j.seq, { orig: text, tr: '' }); touch();
  const tgt = SV.setting('trLang'); let tr = '', trFail = '';
  try { tr = await translateText(text, j.lang, tgt); } catch (e) { trFail = e.message || 'Terjemahan gagal'; }
  if (S !== me) return;
  if (tr && tr.trim() === text.trim()) tr = '';
  place(j.seq, { tr }); touch();
  me.lat = ' · tunda ' + ((Date.now() - j.t) / 1000).toFixed(1) + ' dtk'; setStatus(trFail || null);
}
// terjemahan: offline (Opus-MT) bila dipilih, dengan cadangan Google Translate; selain itu Google Translate
async function translateText(text, src, tgt) {
  text = text.slice(0, 500);
  if (SV.setting('trmode') === 'offline') {
    const stl = SV.setting('stlang'), sl = src || (stl && stl.split('-')[0]);
    try { return await OFF.translate(text, sl, tgt); }
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
const FS = { size: { sm: 22, md: 30, lg: 40, xl: 52 } };
function ui(win) {
  if (!S) return null;
  const f = SV.setting('stf'), fs = fsMode;
  const [w, h] = win;
  let rect;
  if (fs) {
    const px = FS.size[f.size] || 30, rh = Math.round(px * 4.2 + 24), rw = Math.min(w - 80, 1100);
    rect = { x: Math.round((w - rw) / 2), y: f.pos === 'top' ? 50 : h - rh - 90, w: rw, h: rh };
  } else {
    const rw = Math.min(720, w - 40), rh = 168;
    rect = { x: Math.round((w - rw) / 2) + pos.x, y: h - rh - 24 + pos.y, w: rw, h: rh };
    rect.x = Math.max(0, Math.min(w - rw, rect.x)); rect.y = Math.max(0, Math.min(h - rh, rect.y));
    pos.x = rect.x - Math.round((w - rw) / 2); pos.y = rect.y - (h - rh - 24);
  }
  return { rect, fs, idle: !!S.idle, status: S.status, cur: S.lines.cur, prev: S.lines.prev, cfg: { size: FS.size[f.size] || 30, pos: f.pos, bg: f.bg, color: f.color, orig: f.orig !== false } };
}
module.exports = { init, start, stop, toggle, refresh, active, activeTabId, setFs, drag, ui };
