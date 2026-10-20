// Mesin offline untuk PC: Suara ke teks (sherpa-onnx) dan Terjemahan (Opus-MT lewat onnxruntime).
// Model diunduh sekali dari Hugging Face ke %APPDATA%\Alethra\models, lalu dijalankan di proses terpisah
// (offline-stt-worker.js / offline-mt-worker.js) supaya jendela browser tidak tersendat dan memori bisa dilepas.
const { app, net, shell } = require('electron');
const fs = require('fs'), path = require('path'), cp = require('child_process');
const { once } = require('events');
const ctx = require('./ctx');
const SV = require('./services');

const root = () => path.join(app.getPath('userData'), 'models');
const sttDir = (id) => path.join(root(), 'stt', id);
const mtDir = (id) => path.join(root(), 'mt', id);
const HF = (process.env.ALETHRA_HF || 'https://huggingface.co').replace(/\/+$/, '');   // bisa diganti cermin (mis. https://hf-mirror.com)

/* ================= katalog ================= */
const LANG = { en: 'Inggris', id: 'Indonesia', ja: 'Jepang', zh: 'Mandarin', ko: 'Korea', vi: 'Vietnam', th: 'Thai', ru: 'Rusia', ar: 'Arab', hi: 'Hindi', tr: 'Turki', es: 'Spanyol', fr: 'Prancis', de: 'Jerman', it: 'Italia', nl: 'Belanda' };
const GROUPS = ['ja', 'multi', 'en', 'ko', 'ru', 'vi'];
const GROUP_NAME = { ja: 'Jepang', multi: 'Semua bahasa (Whisper)', en: 'Inggris', ko: 'Korea', ru: 'Rusia', vi: 'Vietnam' };

// Hanya model kecil dan cepat di CPU biasa (±40-170 MB). kind: whisper | moonshine | transducer
const STT_MODELS = [
  { id: 'whisper-tiny', title: 'Whisper tiny', kind: 'whisper', repo: 'csukuangfj/sherpa-onnx-whisper-tiny', prefix: 'tiny', lang: 'multi', mb: 103, note: 'Semua bahasa (±99). Paling ringan dan cepat, akurasi dasar. Pilihan aman untuk PC biasa.' },
  { id: 'whisper-base', title: 'Whisper base', kind: 'whisper', repo: 'csukuangfj/sherpa-onnx-whisper-base', prefix: 'base', lang: 'multi', mb: 160, note: 'Semua bahasa (±99). Seimbang antara kecepatan dan akurasi.' },
  { id: 'moonshine-ja-tiny', title: 'Moonshine tiny Jepang', kind: 'moonshine', repo: 'csukuangfj/sherpa-onnx-moonshine-tiny-ja-quantized-2026-02-27', lang: 'ja', mb: 40, note: 'Khusus Jepang. Sangat ringan dan cepat.' },
  { id: 'moonshine-ja-base', title: 'Moonshine base Jepang', kind: 'moonshine', repo: 'csukuangfj/sherpa-onnx-moonshine-base-ja-quantized-2026-02-27', lang: 'ja', mb: 130, note: 'Khusus Jepang. Lebih akurat dari tiny, masih ringan.' },
  { id: 'zipformer-ja', title: 'Zipformer Jepang (ReazonSpeech)', kind: 'transducer', repo: 'reazon-research/reazonspeech-k2-v2', lang: 'ja', mb: 170, note: 'Khusus Jepang. Akurat untuk ucapan sehari-hari dan tetap cepat di CPU.' },
  { id: 'whisper-tiny-en', title: 'Whisper tiny · Inggris', kind: 'whisper', repo: 'csukuangfj/sherpa-onnx-whisper-tiny.en', prefix: 'tiny.en', lang: 'en', fixed: 'en', mb: 100, note: 'Khusus Inggris. Paling ringan.' },
  { id: 'whisper-base-en', title: 'Whisper base · Inggris', kind: 'whisper', repo: 'csukuangfj/sherpa-onnx-whisper-base.en', prefix: 'base.en', lang: 'en', fixed: 'en', mb: 160, note: 'Khusus Inggris. Lebih akurat dari tiny.' },
  { id: 'zipformer-en', title: 'Zipformer Inggris', kind: 'transducer', repo: 'k2-fsa/sherpa-onnx-zipformer-en-2023-06-26', lang: 'en', mb: 90, note: 'Khusus Inggris. Cepat.' },
  { id: 'zipformer-ko', title: 'Zipformer Korea', kind: 'transducer', repo: 'k2-fsa/sherpa-onnx-zipformer-korean-2024-06-24', lang: 'ko', mb: 85, note: 'Khusus Korea. Ringan dan cepat.' },
  { id: 'zipformer-ru-small', title: 'Zipformer Rusia (kecil)', kind: 'transducer', repo: 'k2-fsa/sherpa-onnx-small-zipformer-ru-2024-09-18', lang: 'ru', mb: 40, note: 'Khusus Rusia. Sangat ringan.' },
  { id: 'zipformer-vi-30m', title: 'Zipformer Vietnam (kecil)', kind: 'transducer', repo: 'k2-fsa/sherpa-onnx-zipformer-vi-30M-int8-2026-02-09', lang: 'vi', mb: 40, note: 'Khusus Vietnam. Sangat ringan.' }
];
STT_MODELS.forEach(m => { if (!m.fixed && m.lang !== 'multi') m.fixed = m.lang; });

// Opus-MT (Helsinki-NLP, versi ONNX dari Xenova). Hampir semua pasangan lewat Inggris; pasangan langsung dipakai bila ada,
// jika tidak teks diterjemahkan sumber → Inggris → tujuan.
const MT_PAIRS = [];
const mtp = (src, tgt, repo, mb) => MT_PAIRS.push({ id: `opus-${src}-${tgt}`, src, tgt, repo: 'Xenova/opus-mt-' + repo, mb: mb || 85 });
['ja', 'zh', 'ko', 'vi', 'th', 'ru', 'ar', 'hi', 'tr', 'es', 'fr', 'de', 'it', 'nl', 'id'].forEach(l => mtp(l, 'en', l + '-en'));
mtp('en', 'ja', 'en-jap');
['id', 'zh', 'vi', 'ru', 'ar', 'hi', 'es', 'fr', 'de', 'it', 'nl'].forEach(l => mtp('en', l, 'en-' + l));
const mtFind = (id) => MT_PAIRS.find(p => p.id === id);
const sttFind = (id) => STT_MODELS.find(m => m.id === id);

const MT_ROOT_FILES = ['config.json', 'generation_config.json', 'special_tokens_map.json', 'tokenizer.json', 'tokenizer_config.json'];
const MT_ONNX = ['onnx/encoder_model_quantized.onnx', 'onnx/decoder_model_merged_quantized.onnx'];

/* ================= status terpasang ================= */
const manifest = (dir) => { try { return JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8')); } catch { return null; } };
const sttInstalled = (m) => !!manifest(sttDir(m.id));
const mtInstalled = (p) => !!manifest(mtDir(p.id));
function dirSize(d) { let n = 0; try { for (const f of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, f.name); n += f.isDirectory() ? dirSize(p) : fs.statSync(p).size; } } catch {} return n; }

/* ================= unduhan ================= */
const jobs = new Map();            // id -> { id, kind, done, total, error, ctl }
let pushT = null;
function push() {
  if (pushT) return;
  pushT = setTimeout(() => { pushT = null; ctx.broadcastPages && ctx.broadcastPages('oe', jobInfo()); }, 250);
}
function jobInfo() { const o = {}; for (const j of jobs.values()) o[j.id] = { done: j.done, total: j.total, error: j.error || '', busy: !j.finished, phase: j.phase }; return o; }
const httpErr = (st, name) => new Error(st === 404 ? `Berkas ${name} tidak ditemukan di Hugging Face` : st === 401 || st === 403 ? 'Akses ke Hugging Face ditolak' : `Unduhan gagal (HTTP ${st})`);

async function hfList(repo, sub, signal) {
  const r = await net.fetch(`${HF}/api/models/${repo}/tree/main${sub ? '/' + sub : ''}`, { signal });
  if (!r.ok) throw new Error(r.status === 404 ? 'Model tidak ditemukan di Hugging Face' : `Gagal membaca daftar berkas (HTTP ${r.status})`);
  return (await r.json()).filter(x => x.type === 'file').map(x => ({ name: x.path, size: x.size || (x.lfs && x.lfs.size) || 0 }));
}

// pilih berkas yang perlu diunduh dari daftar isi repo (tingkat teratas saja); mengembalikan { files, roles }
function pick(m, all) {
  const top = all.filter(f => !f.name.includes('/'));
  const first = (ok) => top.find(f => ok(f.name));
  const files = [], roles = {};
  const add = (role, f) => { if (!f) throw new Error('Berkas model tidak lengkap di repo'); roles[role] = f.name; if (!files.includes(f)) files.push(f); };
  if (m.kind === 'whisper') {
    const p = m.prefix;
    add('encoder', first(n => n === `${p}-encoder.int8.onnx`) || first(n => n === `${p}-encoder.onnx`));
    add('decoder', first(n => n === `${p}-decoder.int8.onnx`) || first(n => n === `${p}-decoder.onnx`));
    add('tokens', first(n => n === `${p}-tokens.txt`));
    top.filter(f => (f.name.startsWith(`${p}-encoder.int8`) || f.name.startsWith(`${p}-decoder.int8`)) && !files.includes(f)).forEach(f => files.push(f));
  } else if (m.kind === 'moonshine') {
    add('encoder', first(n => /^encoder_model.*\.(ort|onnx)$/.test(n) && n.startsWith('encoder_model.')) || first(n => /^encoder_model.*\.(ort|onnx)$/.test(n)));
    add('mergedDecoder', first(n => /^decoder_model_merged\.(ort|onnx)$/.test(n)) || first(n => /^decoder_model_merged.*\.(ort|onnx)$/.test(n)));
    add('tokens', first(n => n === 'tokens.txt'));
  } else {
    add('encoder', first(n => n.startsWith('encoder') && n.endsWith('.onnx') && n.includes('.int8')) || first(n => n.startsWith('encoder') && n.endsWith('.onnx')));
    add('joiner', first(n => n.startsWith('joiner') && n.endsWith('.onnx') && n.includes('.int8')) || first(n => n.startsWith('joiner') && n.endsWith('.onnx')));
    add('decoder', first(n => n.startsWith('decoder') && n.endsWith('.onnx') && !n.includes('int8')) || first(n => n.startsWith('decoder') && n.endsWith('.onnx')));
    add('tokens', first(n => n === 'tokens.txt'));
  }
  return { files, roles };
}

// unduh satu berkas dengan dukungan lanjut (Range) bila terputus
async function fetchTo(url, dest, size, job) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  if (fs.existsSync(dest) && (!size || fs.statSync(dest).size === size)) { job.done += fs.statSync(dest).size; push(); return; }
  const part = dest + '.part'; let have = 0;
  try { have = fs.statSync(part).size; } catch {}
  if (size && have > size) { try { fs.unlinkSync(part); } catch {} have = 0; }
  const r = await net.fetch(url, { headers: have ? { Range: 'bytes=' + have + '-' } : {}, signal: job.ctl.signal });
  if (r.status === 416 && size && have === size) { fs.renameSync(part, dest); job.done += have; push(); return; }
  if (r.status !== 200 && r.status !== 206) throw httpErr(r.status, path.basename(dest));
  if (r.status === 200) have = 0;
  job.done += have;
  const ws = fs.createWriteStream(part, { flags: have ? 'a' : 'w' });
  let werr = null; ws.on('error', e => { werr = e; });
  try {
    const rd = r.body.getReader();
    for (;;) {
      const { done, value } = await rd.read(); if (done) break;
      if (werr) throw werr;
      if (!ws.write(value)) await once(ws, 'drain');
      job.done += value.length; push();
    }
  } finally { await new Promise(res => ws.end(res)); }
  if (werr) throw werr;
  fs.renameSync(part, dest);
}

async function runJob(job, plan) {
  try {
    job.phase = 'Membaca daftar berkas…'; push();
    const { files, meta, dir } = await plan(job.ctl.signal);
    job.total = files.reduce((a, f) => a + (f.size || 0), 0) || job.total;
    job.phase = 'Mengunduh…';
    for (const f of files) {
      if (job.ctl.signal.aborted) throw new Error('dibatalkan');
      await fetchTo(f.url, path.join(dir, f.name), f.size, job);
    }
    fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify(Object.assign({ ts: Date.now() }, meta)));
    job.finished = true; job.phase = 'Selesai';
    onInstalled(job);
  } catch (e) {
    job.finished = true;
    if (job.cancelled) { job.error = ''; jobs.delete(job.id); }
    else job.error = (e && e.name === 'AbortError') ? 'Dibatalkan' : String((e && e.message) || e);
  } finally { push(); }
}
function onInstalled(job) {
  if (job.kind === 'stt' && !SV.setting('stmodel')) SV.saveSetting('stmodel', job.id);
  ctx.toast && ctx.toast('Model terpasang');
  ctx.broadcastPages && ctx.broadcastPages('oe', jobInfo());
  if (ctx.refreshSettings) ctx.refreshSettings();
}
function startJob(kind, id, mb, plan) {
  const cur = jobs.get(id); if (cur && !cur.finished) return false;
  const job = { id, kind, done: 0, total: (mb || 0) * 1e6, error: '', finished: false, cancelled: false, phase: '', ctl: new AbortController() };
  jobs.set(id, job); runJob(job, plan); return true;
}
function download(id) {
  const m = sttFind(id);
  if (m) {
    if (sttInstalled(m)) return true;
    return startJob('stt', id, m.mb, async (signal) => {
      const { files, roles } = pick(m, await hfList(m.repo, '', signal));
      return { dir: sttDir(id), meta: { id, kind: m.kind, roles }, files: files.map(f => ({ name: f.name, size: f.size, url: `${HF}/${m.repo}/resolve/main/${f.name}` })) };
    });
  }
  const p = mtFind(id);
  if (p) {
    if (mtInstalled(p)) return true;
    return startJob('mt', id, p.mb, async (signal) => {
      const root = (await hfList(p.repo, '', signal)).filter(f => MT_ROOT_FILES.includes(f.name));
      if (!root.some(f => f.name === 'tokenizer.json') || !root.some(f => f.name === 'config.json')) throw new Error('Berkas model tidak lengkap di repo');
      const ox = (await hfList(p.repo, 'onnx', signal)).filter(f => MT_ONNX.includes(f.name));
      if (ox.length !== MT_ONNX.length) throw new Error('Versi ringan (quantized) model ini tidak tersedia');
      return { dir: mtDir(id), meta: { id, src: p.src, tgt: p.tgt }, files: root.concat(ox).map(f => ({ name: f.name, size: f.size, url: `${HF}/${p.repo}/resolve/main/${f.name}` })) };
    });
  }
  return false;
}
function cancel(id) { const j = jobs.get(id); if (j && !j.finished) { j.cancelled = true; j.ctl.abort(); setTimeout(() => rmDir(sttFind(id) ? sttDir(id) : mtDir(id)), 400); } push(); }
function rmDir(d) { try { fs.rmSync(d, { recursive: true, force: true }); } catch {} }
async function remove(id) {
  const j = jobs.get(id); if (j && !j.finished) return false;
  jobs.delete(id);
  if (sttFind(id)) {
    if (SV.setting('stmodel') === id) { SV.saveSetting('stmodel', ''); }
    sttW.kill(); sttLoaded = '';
    rmDir(sttDir(id));
  } else if (mtFind(id)) { mtW.kill(); rmDir(mtDir(id)); }
  else return false;
  push(); return true;
}

/* ================= proses pekerja ================= */
class Worker {
  constructor(file, label) { this.file = file; this.label = label; this.p = null; this.seq = 0; this.pending = new Map(); this.err = ''; }
  ensure() {
    if (this.p && this.p.connected) return;
    const p = cp.fork(path.join(__dirname, this.file), [], { serialization: 'advanced', windowsHide: true, stdio: ['ignore', 'ignore', 'pipe', 'ipc'], env: Object.assign({}, process.env, { ELECTRON_RUN_AS_NODE: '1' }) });
    this.p = p; this.err = '';
    p.stderr.on('data', d => { this.err = (this.err + d).slice(-1500); });
    p.on('message', m => { const q = this.pending.get(m.id); if (!q) return; this.pending.delete(m.id); clearTimeout(q.t); m.ok ? q.res(m) : q.rej(new Error(m.err || 'Kesalahan mesin offline')); });
    p.on('exit', (code) => {
      if (this.p === p) this.p = null;
      const why = new Error(this.label + ' berhenti tiba-tiba' + (this.err ? ': ' + this.err.split('\n').filter(Boolean).pop() : ''));
      for (const [id, q] of this.pending) { clearTimeout(q.t); q.rej(why); } this.pending.clear();
      if (this.onexit) this.onexit();
    });
    p.on('error', () => {});
  }
  call(msg, timeout) {
    return new Promise((res, rej) => {
      try { this.ensure(); } catch (e) { return rej(e); }
      const id = ++this.seq;
      const t = setTimeout(() => { this.pending.delete(id); rej(new Error(this.label + ' tidak merespons')); this.kill(); }, timeout || 60000);
      this.pending.set(id, { res, rej, t });
      try { this.p.send(Object.assign({ id }, msg)); } catch (e) { clearTimeout(t); this.pending.delete(id); rej(e); }
    });
  }
  kill() { const p = this.p; this.p = null; if (p) { try { p.kill(); } catch {} } }
}
const sttW = new Worker('offline-stt-worker.js', 'Mesin suara ke teks offline');
const mtW = new Worker('offline-mt-worker.js', 'Mesin terjemahan offline');
let sttLoaded = '';
sttW.onexit = () => { sttLoaded = ''; };
let idleT = null;
const used = () => { clearTimeout(idleT); idleT = null; };
// lepas memori bila mesin tidak dipakai beberapa saat
function releaseSoon(ms) { clearTimeout(idleT); idleT = setTimeout(() => { sttW.kill(); mtW.kill(); sttLoaded = ''; }, ms || 45000); }
function shutdown() { clearTimeout(idleT); sttW.kill(); mtW.kill(); }

/* ================= suara ke teks ================= */
const norm = (t) => { t = String(t || '').trim(); if (!t) return ''; if (/^(zh|yue|cmn)/i.test(t)) return 'zh'; if (/^(iw)$/i.test(t)) return 'he'; if (/^jp$/i.test(t)) return 'ja'; return t.split(/[-_]/)[0].toLowerCase(); };
const WHISPER_NAMES = { english: 'en', indonesian: 'id', japanese: 'ja', korean: 'ko', chinese: 'zh', spanish: 'es', arabic: 'ar', hindi: 'hi', french: 'fr', german: 'de', portuguese: 'pt', russian: 'ru', italian: 'it', dutch: 'nl', turkish: 'tr', thai: 'th', vietnamese: 'vi', malay: 'ms' };
const langFromName = (n) => WHISPER_NAMES[String(n || '').toLowerCase()] || '';
const threads = () => { const c = SV.setting('ofthreads'); const n = require('os').cpus().length; return c > 0 ? Math.min(c, 16) : Math.max(2, Math.min(4, Math.floor(n / 2))); };
const selected = () => { const m = sttFind(SV.setting('stmodel')); return m && sttInstalled(m) ? m : null; };
const sttReady = () => !!selected();

function wavToFloat(buf) {
  // WAV 16-bit mono dari stt.js: cari potongan "data" lalu ubah ke Float32
  let off = 12, start = 44, len = buf.length - 44;
  while (off + 8 <= buf.length) {
    const id = buf.toString('ascii', off, off + 4), sz = buf.readUInt32LE(off + 4);
    if (id === 'data') { start = off + 8; len = Math.min(sz, buf.length - start); break; }
    off += 8 + sz + (sz & 1);
  }
  const n = len >> 1, out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = buf.readInt16LE(start + i * 2) / 32768;
  return out;
}

async function loadStt(m) {
  const lang = m.fixed || norm(SV.setting('stlang'));
  const key = [m.id, lang, threads()].join('|');
  if (key === sttLoaded) return;
  const mf = manifest(sttDir(m.id));
  await sttW.call({ op: 'load', kind: m.kind, dir: sttDir(m.id), roles: mf.roles, lang: m.kind === 'whisper' && !m.fixed ? lang : '', threads: threads() }, 120000);
  sttLoaded = key;
}
// dipanggil saat Suara ke teks dinyalakan, supaya model sudah siap sebelum kalimat pertama
async function warm() { const m = selected(); if (!m) throw new Error('Model suara ke teks offline belum dipasang'); used(); await loadStt(m); }
async function transcribe(wavBuf) {
  const m = selected(); if (!m) { const e = new Error('Model suara ke teks offline belum dipasang. Buka Pengaturan > Mesin offline'); e.fatal = true; throw e; }
  used(); await loadStt(m);
  const r = await sttW.call({ op: 'run', pcm: wavToFloat(wavBuf) }, 60000);
  return { text: String(r.text || '').trim(), lang: m.fixed || norm(r.lang) || norm(SV.setting('stlang')) };
}
function sttStop() { releaseSoon(45000); }

/* ================= terjemahan ================= */
class Missing extends Error { constructor(m) { super(m); this.missing = true; } }
function route(s, t) {
  const have = MT_PAIRS.filter(mtInstalled);
  const d = have.find(p => p.src === s && p.tgt === t); if (d) return [d];
  const a = have.find(p => p.src === s && p.tgt === 'en'), b = have.find(p => p.src === 'en' && p.tgt === t);
  return a && b ? [a, b] : null;
}
// model yang masih perlu diunduh agar src → tgt bisa berjalan ([] bila sudah siap, null bila tidak didukung)
function plan(src, tgt) {
  const s = norm(src), t = norm(tgt); if (!s || !t || s === t) return [];
  const d = mtFind(`opus-${s}-${t}`); if (d) return mtInstalled(d) ? [] : [d.id];
  const a = mtFind(`opus-${s}-en`), b = mtFind(`opus-en-${t}`); if (!a || !b) return null;
  return [a, b].filter(p => !mtInstalled(p)).map(p => p.id);
}
async function translate(text, src, tgt) {
  const s = norm(src), t = norm(tgt);
  if (!s) throw new Missing('Bahasa ucapan tidak diketahui, pilih Bahasa ucapan video di Pengaturan > Play');
  if (s === t) return '';
  const steps = route(s, t);
  if (!steps) throw new Missing(`Model terjemahan ${LANG[s] || s} → ${LANG[t] || t} belum terpasang`);
  used();
  let cur = text;
  for (const p of steps) {
    const r = await mtW.call({ op: 'run', root: path.join(root(), 'mt'), model: p.id, text: cur, threads: threads() }, 90000);
    cur = String(r.text || '').trim(); if (!cur) break;
  }
  return cur;
}
const mtReady = (src, tgt) => { const p = plan(src, tgt); return Array.isArray(p) && p.length === 0; };

/* ================= untuk halaman Pengaturan ================= */
function list() {
  return {
    langs: LANG, groups: GROUPS.map(g => [g, GROUP_NAME[g]]), selected: SV.setting('stmodel'), root: root(), jobs: jobInfo(),
    stt: STT_MODELS.map(m => ({ id: m.id, title: m.title, note: m.note, lang: m.lang, mb: m.mb, installed: sttInstalled(m), bytes: sttInstalled(m) ? dirSize(sttDir(m.id)) : 0 })),
    mt: MT_PAIRS.map(p => ({ id: p.id, src: p.src, tgt: p.tgt, mb: p.mb, installed: mtInstalled(p), bytes: mtInstalled(p) ? dirSize(mtDir(p.id)) : 0 })),
    total: dirSize(root())
  };
}
const openDir = () => { fs.mkdirSync(root(), { recursive: true }); shell.openPath(root()); };
const validModel = (id) => !id || !!sttFind(id);

module.exports = { list, download, cancel, remove, plan, translate, transcribe, warm, sttReady, mtReady, sttStop, shutdown, openDir, validModel, selected, norm, langFromName, Missing, LANG, jobInfo };
