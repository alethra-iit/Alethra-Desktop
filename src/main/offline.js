// Mesin offline untuk PC. Suara ke teks: sherpa-onnx, Whisper (Transformers.js), atau Vosk. Terjemahan: Opus-MT, CTranslate2, Bergamot atau NLLB-200 600M.
// Mesin suara dan mesin terjemahan bebas dikombinasikan.
// Model diunduh sekali dari Hugging Face ke %APPDATA%\Alethra\models, lalu dijalankan di proses terpisah
// (offline-stt-worker.js / offline-asr-worker.js / offline-vosk-worker.js / offline-mt-worker.js) supaya jendela browser tidak tersendat dan memori bisa dilepas.
const { app, net, shell } = require('electron');
const fs = require('fs'), path = require('path'), cp = require('child_process');
const { once } = require('events');
const ctx = require('./ctx');
const SV = require('./services');

const root = () => path.join(app.getPath('userData'), 'models');
const sttDir = (id) => path.join(root(), 'stt', id);
const mtDir = (id) => path.join(root(), 'mt', id);
// Sumber unduhan: Pengaturan > Mesin offline > Sumber unduhan model (cermin Hugging Face), lalu variabel ALETHRA_HF, lalu huggingface.co
const hfBase = () => String(SV.setting('hfmirror') || process.env.ALETHRA_HF || 'https://huggingface.co').replace(/\/+$/, '');

/* ================= katalog ================= */
const LANG = { en: 'Inggris', id: 'Indonesia', ja: 'Jepang', zh: 'Mandarin', ko: 'Korea', vi: 'Vietnam', th: 'Thai', ru: 'Rusia', ar: 'Arab', hi: 'Hindi', tr: 'Turki', es: 'Spanyol', fr: 'Prancis', de: 'Jerman', it: 'Italia', nl: 'Belanda' };
const GROUPS = ['ja', 'multi', 'en', 'zh', 'ko', 'th', 'ru', 'vi'];
const GROUP_NAME = { ja: 'Jepang', multi: 'Semua bahasa (Whisper)', en: 'Inggris', zh: 'Mandarin / Kanton', ko: 'Korea', th: 'Thai', ru: 'Rusia', vi: 'Vietnam' };

// Hanya model kecil dan cepat di CPU biasa (±40-170 MB). kind: whisper | moonshine | transducer
const STT_MODELS = [
  { id: 'whisper-tiny', title: 'Whisper tiny', kind: 'whisper', repo: 'csukuangfj/sherpa-onnx-whisper-tiny', prefix: 'tiny', lang: 'multi', mb: 103, note: 'Semua bahasa (±99). Paling ringan dan cepat, akurasi dasar. Pilihan aman untuk PC biasa.' },
  { id: 'whisper-base', title: 'Whisper base', kind: 'whisper', repo: 'csukuangfj/sherpa-onnx-whisper-base', prefix: 'base', lang: 'multi', mb: 160, note: 'Semua bahasa (±99). Seimbang antara kecepatan dan akurasi.' },
  { id: 'moonshine-ja-tiny', title: 'Moonshine tiny Jepang', kind: 'moonshine', repo: 'csukuangfj2/sherpa-onnx-moonshine-tiny-ja-quantized-2026-02-27', lang: 'ja', mb: 40, note: 'Khusus Jepang. Sangat ringan dan cepat.' },
  { id: 'moonshine-ja-base', title: 'Moonshine base Jepang', kind: 'moonshine', repo: 'csukuangfj2/sherpa-onnx-moonshine-base-ja-quantized-2026-02-27', lang: 'ja', mb: 130, note: 'Khusus Jepang. Lebih akurat dari tiny, masih ringan.' },
  { id: 'zipformer-ja', title: 'Zipformer Jepang (ReazonSpeech)', kind: 'transducer', repo: 'reazon-research/reazonspeech-k2-v2', lang: 'ja', mb: 170, note: 'Khusus Jepang. Akurat untuk ucapan sehari-hari dan tetap cepat di CPU.' },
  { id: 'whisper-tiny-en', title: 'Whisper tiny · Inggris', kind: 'whisper', repo: 'csukuangfj/sherpa-onnx-whisper-tiny.en', prefix: 'tiny.en', lang: 'en', fixed: 'en', mb: 100, note: 'Khusus Inggris. Paling ringan.' },
  { id: 'whisper-base-en', title: 'Whisper base · Inggris', kind: 'whisper', repo: 'csukuangfj/sherpa-onnx-whisper-base.en', prefix: 'base.en', lang: 'en', fixed: 'en', mb: 160, note: 'Khusus Inggris. Lebih akurat dari tiny.' },
  { id: 'zipformer-en', title: 'Zipformer Inggris', kind: 'transducer', repo: 'csukuangfj/sherpa-onnx-zipformer-en-2023-06-26', repos: ['csukuangfj/sherpa-onnx-zipformer-en-2023-06-26', 'csukuangfj/sherpa-onnx-zipformer-gigaspeech-2023-12-12'], lang: 'en', mb: 90, note: 'Khusus Inggris. Cepat.' },
  { id: 'zipformer-ko', title: 'Zipformer Korea', kind: 'transducer', repo: 'csukuangfj/sherpa-onnx-zipformer-korean-2024-06-24', lang: 'ko', mb: 85, note: 'Khusus Korea. Ringan dan cepat.' },
  { id: 'zipformer-ru-small', title: 'Zipformer Rusia (kecil)', kind: 'transducer', repo: 'csukuangfj/sherpa-onnx-small-zipformer-ru-2024-09-18', lang: 'ru', mb: 40, note: 'Khusus Rusia. Sangat ringan.' },
  { id: 'zipformer-en-giga', title: 'Zipformer Inggris (GigaSpeech)', kind: 'transducer', repo: 'csukuangfj/sherpa-onnx-zipformer-gigaspeech-2023-12-12', lang: 'en', mb: 130, note: 'Khusus Inggris. Dilatih dari GigaSpeech (podcast, video, audiobook), cocok untuk ucapan bebas.' },
  { id: 'zipformer-ru', title: 'Zipformer Rusia', kind: 'transducer', repo: 'csukuangfj/sherpa-onnx-zipformer-ru-2024-09-18', lang: 'ru', mb: 260, note: 'Khusus Rusia. Lebih akurat dari versi kecil, tetap berjalan di CPU biasa.' },
  { id: 'zipformer-th', title: 'Zipformer Thai', kind: 'transducer', repo: 'csukuangfj/sherpa-onnx-zipformer-thai-2024-06-20', lang: 'th', mb: 130, note: 'Khusus Thai. Dilatih dari GigaSpeech2.' },
  { id: 'zipformer-yue', title: 'Zipformer Kanton', kind: 'transducer', repo: 'csukuangfj/sherpa-onnx-zipformer-cantonese-2024-03-13', lang: 'zh', mb: 130, note: 'Khusus Kanton (Yue). Hasil dilabeli bahasa Mandarin/Tionghoa.' },
  { id: 'zipformer-vi', title: 'Zipformer Vietnam', kind: 'transducer', repo: 'csukuangfj/sherpa-onnx-zipformer-vi-int8-2025-04-20', repos: ['csukuangfj/sherpa-onnx-zipformer-vi-int8-2025-04-20', 'csukuangfj2/sherpa-onnx-zipformer-vi-int8-2025-04-20'], lang: 'vi', mb: 80, note: 'Khusus Vietnam. Lebih akurat dari versi 30M.' },
  { id: 'zipformer-vi-30m', title: 'Zipformer Vietnam (kecil)', kind: 'transducer', repo: 'csukuangfj2/sherpa-onnx-zipformer-vi-30M-int8-2026-02-09', lang: 'vi', mb: 40, note: 'Khusus Vietnam. Sangat ringan.' }
];
STT_MODELS.forEach(m => { m.engine = 'sherpa'; if (!m.fixed && m.lang !== 'multi') m.fixed = m.lang; });

// Whisper lewat Transformers.js (ONNX int8 dari Xenova). Semua bahasa kecuali varian .en.
const tjs = (id, title, repo, mb, lang, note) => STT_MODELS.push({ id: 'tjs-' + id, title, engine: 'tjs', kind: 'tjs', repo: 'Xenova/' + repo, lang, fixed: lang === 'multi' ? '' : lang, mb, note });
tjs('whisper-tiny', 'Whisper tiny', 'whisper-tiny', 45, 'multi', 'Semua bahasa (±99). Paling ringan, akurasi dasar.');
tjs('whisper-base', 'Whisper base', 'whisper-base', 85, 'multi', 'Semua bahasa (±99). Seimbang antara kecepatan dan akurasi.');
tjs('whisper-small', 'Whisper small', 'whisper-small', 270, 'multi', 'Semua bahasa (±99). Jauh lebih akurat, butuh CPU yang kuat agar tetap hampir realtime.');
tjs('whisper-tiny-en', 'Whisper tiny · Inggris', 'whisper-tiny.en', 45, 'en', 'Khusus Inggris. Paling ringan.');
tjs('whisper-base-en', 'Whisper base · Inggris', 'whisper-base.en', 85, 'en', 'Khusus Inggris. Lebih akurat dari tiny.');
tjs('whisper-small-en', 'Whisper small · Inggris', 'whisper-small.en', 270, 'en', 'Khusus Inggris. Akurat, butuh CPU yang kuat.');

// Vosk (Kaldi): satu model per bahasa, berupa .zip dari alphacephei.com. Tidak ada model Indonesia resmi.
const VOSK_URL = (process.env.ALETHRA_VOSK || 'https://alphacephei.com/vosk/models').replace(/\/+$/, '');
const vosk = (lang, zip, mb) => STT_MODELS.push({ id: 'vosk-' + lang, title: 'Vosk small · ' + (LANG[lang] || VOSK_LANG[lang]), engine: 'vosk', kind: 'vosk', zip, lang, fixed: lang, mb, note: 'Khusus ' + (LANG[lang] || VOSK_LANG[lang]) + '. Ringan dan cepat, tanpa tanda baca.' });
const VOSK_LANG = { pt: 'Portugis', pl: 'Polandia', uk: 'Ukraina' };
vosk('en', 'vosk-model-small-en-us-0.15', 40); vosk('ja', 'vosk-model-small-ja-0.22', 48); vosk('zh', 'vosk-model-small-cn-0.22', 42); vosk('ko', 'vosk-model-small-ko-0.22', 83);
vosk('ru', 'vosk-model-small-ru-0.22', 45); vosk('vi', 'vosk-model-small-vn-0.4', 33); vosk('tr', 'vosk-model-small-tr-0.3', 37); vosk('hi', 'vosk-model-small-hi-0.22', 44);
vosk('es', 'vosk-model-small-es-0.42', 40); vosk('fr', 'vosk-model-small-fr-0.22', 42); vosk('de', 'vosk-model-small-de-0.15', 47); vosk('it', 'vosk-model-small-it-0.22', 50);
vosk('nl', 'vosk-model-small-nl-0.22', 41); vosk('pt', 'vosk-model-small-pt-0.3', 33); vosk('ar', 'vosk-model-small-ar-0.3', 105); vosk('pl', 'vosk-model-small-pl-0.22', 53); vosk('uk', 'vosk-model-small-uk-v3-nano', 78);

// nilai pengaturan "stengine" → jenis mesin pada model, dan pengaturan yang menyimpan model terpilih per mesin
const ENG = { offline: 'sherpa', tjs: 'tjs', vosk: 'vosk' };
const KEY = { sherpa: 'stmodel', tjs: 'stwmodel', vosk: 'stvmodel' };
const ENG_NAME = { sherpa: 'sherpa-onnx', tjs: 'Whisper (Transformers.js)', vosk: 'Vosk' };

// Opus-MT (Helsinki-NLP, versi ONNX dari Xenova). Hampir semua pasangan lewat Inggris; pasangan langsung dipakai bila ada,
// jika tidak teks diterjemahkan sumber → Inggris → tujuan.
const MT_PAIRS = [];
const mtp = (src, tgt, repo, mb) => MT_PAIRS.push({ id: `opus-${src}-${tgt}`, src, tgt, repo: 'Xenova/opus-mt-' + repo, mb: mb || 85 });
['ja', 'zh', 'ko', 'vi', 'th', 'ru', 'ar', 'hi', 'tr', 'es', 'fr', 'de', 'it', 'nl', 'id'].forEach(l => mtp(l, 'en', l + '-en'));
mtp('en', 'ja', 'en-jap');
['id', 'zh', 'vi', 'ru', 'ar', 'hi', 'es', 'fr', 'de', 'it', 'nl'].forEach(l => mtp('en', l, 'en-' + l));
const mtFind = (id) => MT_PAIRS.find(p => p.id === id);

// NLLB-200 distilled 600M (Xenova, ONNX int8): satu model untuk semua pasangan bahasa, tanpa pivot lewat Inggris.
const NLLB = { id: 'nllb-600m', title: 'NLLB-200 600M', repo: 'Xenova/nllb-200-distilled-600M', mb: 900 };
const NLLB_CODES = { en: 'eng_Latn', id: 'ind_Latn', ja: 'jpn_Jpan', zh: 'zho_Hans', ko: 'kor_Hang', vi: 'vie_Latn', th: 'tha_Thai', ru: 'rus_Cyrl', ar: 'arb_Arab', hi: 'hin_Deva', tr: 'tur_Latn', es: 'spa_Latn', fr: 'fra_Latn', de: 'deu_Latn', it: 'ita_Latn', nl: 'nld_Latn', pt: 'por_Latn', ms: 'zsm_Latn', jv: 'jav_Latn', su: 'sun_Latn', tl: 'tgl_Latn', bn: 'ben_Beng', ur: 'urd_Arab', ta: 'tam_Taml', fa: 'pes_Arab', he: 'heb_Hebr', pl: 'pol_Latn', uk: 'ukr_Cyrl', el: 'ell_Grek', sv: 'swe_Latn', ro: 'ron_Latn', cs: 'ces_Latn', hu: 'hun_Latn', da: 'dan_Latn', fi: 'fin_Latn', no: 'nob_Latn', sw: 'swh_Latn', ca: 'cat_Latn', kk: 'kaz_Cyrl', kz: 'kaz_Cyrl' };
const nllbCode = (l) => /^zh[-_](tw|hk|hant)/i.test(String(l || '')) ? 'zho_Hant' : (NLLB_CODES[norm(l)] || '');
const sttFind = (id) => STT_MODELS.find(m => m.id === id);

// CTranslate2: model Opus-MT yang sudah dikonversi (int8/fp16), jalan lewat binding native: lebih cepat dari onnxruntime.
// Repo dicoba berurutan; yang dipakai adalah yang berkasnya lengkap. Pasangan bahasa sama dengan Opus-MT di atas.
const CT2_FILES = ['config.json', 'model.bin', 'shared_vocabulary.json', 'source.spm', 'target.spm'];
const CT2_PAIRS = MT_PAIRS.map(p => { const r = p.repo.replace('Xenova/opus-mt-', ''); return { id: `ct2-${p.src}-${p.tgt}`, src: p.src, tgt: p.tgt, mb: 80, repos: [`manancode/opus-mt-${r}-ctranslate2-android`, `gaudi/opus-mt-${r}-ctranslate2`] }; });
const ct2Find = (id) => CT2_PAIRS.find(p => p.id === id);

// Bergamot (mesin terjemahan Firefox): model kecil (±15-45 MB per arah) dari Mozilla Remote Settings. Daftarnya dibaca saat dipakai,
// karena nama berkas model ada di server Mozilla. Hanya pasangan dengan bahasa yang ada di LANG yang ditampilkan.
const RS_BASE = 'https://firefox.settings.services.mozilla.com/v1';
const BG = { pairs: [], ts: 0, err: '', failTs: 0, busy: null };
const bgCacheFile = () => path.join(root(), 'bergamot-catalog.json');
const bgInstalledIds = () => { try { return fs.readdirSync(path.join(root(), 'mt')).filter(n => n.startsWith('bg-') && manifest(mtDir(n))); } catch { return []; } };
const bgInstalled = () => bgInstalledIds().map(id => { const m = manifest(mtDir(id)) || {}; return { id, src: m.src, tgt: m.tgt, mb: 0 }; }).filter(p => p.src && p.tgt);
const verNum = (v) => String(v || '0').split('.').map(x => parseInt(x, 10) || 0);
const verCmp = (a, b) => { const x = verNum(a), y = verNum(b); for (let i = 0; i < Math.max(x.length, y.length); i++) { const d = (x[i] || 0) - (y[i] || 0); if (d) return d; } return 0; };
function bgBuild(recs, attBase) {
  const by = new Map();
  for (const r of recs) {
    const a = r.attachment; if (!a || !a.location) continue;
    const from = norm(r.fromLang), to = norm(r.toLang), type = r.fileType || String(r.name || '').split('.')[0];
    if (!from || !to || from === to || !LANG[from] || !LANG[to]) continue;
    const k = from + '>' + to, v = String(r.version || '0'); let g = by.get(k); if (!g) by.set(k, g = { from, to, vers: new Map() });
    if (!g.vers.has(v)) g.vers.set(v, {}); g.vers.get(v)[type] = { url: attBase + a.location, size: a.size || 0, hash: a.hash || '' };
  }
  const out = [];
  for (const g of by.values()) {
    const vs = [...g.vers.keys()].sort(verCmp).reverse(), stable = vs.filter(v => !/[a-z]/i.test(v));
    for (const v of (stable.length ? stable : vs)) {
      const f = g.vers.get(v); if (!f.model || !f.lex || !(f.vocab || (f.srcvocab && f.trgvocab))) continue;
      const files = f.vocab ? { model: f.model, lex: f.lex, vocab: f.vocab } : { model: f.model, lex: f.lex, srcvocab: f.srcvocab, trgvocab: f.trgvocab };
      out.push({ id: `bg-${g.from}-${g.to}`, src: g.from, tgt: g.to, mb: Math.max(1, Math.round(Object.values(files).reduce((n, x) => n + x.size, 0) / 1e6)), files }); break;
    }
  }
  return out;
}
async function bgFetch(signal) {
  const sv = await net.fetch(RS_BASE + '/', { signal }); if (!sv.ok) throw new Error(`Server Mozilla tidak bisa dijangkau (HTTP ${sv.status})`);
  const att = (((await sv.json()).capabilities || {}).attachments || {}).base_url; if (!att) throw new Error('Alamat berkas model Bergamot tidak ditemukan di server Mozilla');
  const recs = []; let url = `${RS_BASE}/buckets/main/collections/translations-models/records`;
  for (let i = 0; url && i < 30; i++) {
    const r = await net.fetch(url, { signal }); if (!r.ok) throw new Error(`Daftar model Bergamot gagal dimuat (HTTP ${r.status})`);
    recs.push(...((await r.json()).data || [])); url = r.headers.get('next-page') || '';
  }
  return bgBuild(recs, att.replace(/\/*$/, '/'));
}
// daftar model Bergamot: memori → berkas cache (6 jam) → server Mozilla; bila server gagal, pakai cache lama
async function bgCatalog(signal, soft) {
  const fresh = () => BG.pairs.length && Date.now() - BG.ts < 6 * 3600e3;
  if (fresh()) return BG.pairs;
  if (!BG.pairs.length) { try { const c = JSON.parse(fs.readFileSync(bgCacheFile(), 'utf8')); if (Array.isArray(c.pairs)) { BG.pairs = c.pairs; BG.ts = c.ts || 0; } } catch {} }
  if (fresh()) return BG.pairs;
  if (soft && Date.now() - BG.failTs < 60000) return BG.pairs;
  if (!BG.busy) BG.busy = (async () => {
    const ctl = new AbortController(), to = setTimeout(() => ctl.abort(), soft ? 8000 : 30000);
    signal && signal.addEventListener('abort', () => ctl.abort(), { once: true });
    try {
      const p = await bgFetch(ctl.signal); if (!p.length) throw new Error('Daftar model Bergamot kosong');
      BG.pairs = p; BG.ts = Date.now(); BG.err = ''; BG.failTs = 0;
      try { fs.mkdirSync(root(), { recursive: true }); fs.writeFileSync(bgCacheFile(), JSON.stringify({ ts: BG.ts, pairs: p })); } catch {}
    } catch (e) { BG.err = (e && e.name === 'AbortError') ? 'Server Mozilla tidak menjawab' : String((e && e.message) || e); BG.failTs = Date.now(); }
    finally { clearTimeout(to); BG.busy = null; }
  })();
  await BG.busy;
  if (!BG.pairs.length && !soft) throw new Error(BG.err || 'Daftar model Bergamot tidak tersedia');
  return BG.pairs;
}
const bgFind = (id) => BG.pairs.find(p => p.id === id) || bgInstalled().find(p => p.id === id);

const MT_ROOT_FILES = ['config.json', 'generation_config.json', 'special_tokens_map.json', 'tokenizer.json', 'tokenizer_config.json'];
const MT_ONNX = ['onnx/encoder_model_quantized.onnx', 'onnx/decoder_model_merged_quantized.onnx'];
const TJS_ONNX = MT_ONNX;

/* ================= status terpasang ================= */
const manifest = (dir) => { try { return JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8')); } catch { return null; } };
const sttInstalled = (m) => !!manifest(sttDir(m.id));
const mtInstalled = (p) => !!manifest(mtDir(p.id));
const nllbInstalled = () => !!manifest(mtDir(NLLB.id));
const mtAnyInstalled = (id) => !!manifest(mtDir(id));      // Opus-MT, CTranslate2 dan Bergamot: satu folder per model di models/mt
function dirSize(d) { let n = 0; try { for (const f of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, f.name); n += f.isDirectory() ? dirSize(p) : fs.statSync(p).size; } } catch {} return n; }

/* ================= unduhan ================= */
const jobs = new Map();            // id -> { id, kind, done, total, error, ctl }
let pushT = null;
function push() {
  if (pushT) return;
  pushT = setTimeout(() => { pushT = null; ctx.broadcastPages && ctx.broadcastPages('oe', jobInfo()); }, 250);
}
function jobInfo() { const o = {}; for (const j of jobs.values()) o[j.id] = { done: j.done, total: j.total, error: j.error || '', detail: j.detail || '', busy: !j.finished, phase: j.phase, paused: !!j.paused, canPause: !j.finished && !j.noPause }; return o; }
// teks lengkap yang bisa disalin pengguna (untuk laporan atau pencarian solusi)
function errDetail(job, e) {
  return ['Alethra ' + app.getVersion() + ' · Electron ' + process.versions.electron + ' · ' + process.platform + ' ' + process.arch,
    'Waktu: ' + new Date().toISOString(), 'Model: ' + job.id + ' (' + job.kind + ')', 'Sumber unduhan: ' + hfBase() + (SV.setting('hfmirror') ? ' (cermin dari Pengaturan)' : process.env.ALETHRA_HF ? ' (variabel ALETHRA_HF)' : ''),
    'Tahap: ' + (job.phase || '-') + ' · ' + job.done + ' / ' + job.total + ' byte', 'Galat: ' + String((e && e.message) || e), e && e.cause ? 'Penyebab: ' + String(e.cause.message || e.cause) : ''].filter(Boolean).join('\n');
}
// uji cepat apakah sumber unduhan bisa dijangkau
async function ping() {
  const base = hfBase(), t0 = Date.now(), ctl = new AbortController(), to = setTimeout(() => ctl.abort(), 10000);
  try { const r = await net.fetch(base + '/api/models/csukuangfj/sherpa-onnx-whisper-tiny', { signal: ctl.signal }); return { ok: r.ok, base, status: r.status, ms: Date.now() - t0 }; }
  catch (e) { return { ok: false, base, err: e && e.name === 'AbortError' ? 'Tidak ada jawaban dalam 10 detik' : String((e && e.message) || e) }; }
  finally { clearTimeout(to); }
}
const httpErr = (st, name) => new Error(st === 404 ? `Berkas ${name} tidak ditemukan di Hugging Face` : st === 401 || st === 403 ? `Berkas ${name} tidak bisa diakses di Hugging Face (HTTP ${st})` : `Unduhan gagal (HTTP ${st})`);

// Hugging Face menjawab 401 (bukan 404) untuk repo yang tidak ada atau salah akun, jadi 401/403/404 dianggap "repo tidak ketemu"
class RepoMiss extends Error { constructor(m, st) { super(m); this.status = st; this.miss = true; } }
async function hfList(repo, sub, signal) {
  const r = await net.fetch(`${hfBase()}/api/models/${repo}/tree/main${sub ? '/' + sub : ''}`, { signal });
  if (!r.ok) {
    if (r.status === 401 || r.status === 403 || r.status === 404) throw new RepoMiss(`Repo ${repo} tidak ditemukan atau tidak bisa diakses di Hugging Face (HTTP ${r.status})`, r.status);
    throw new Error(`Gagal membaca daftar berkas (HTTP ${r.status})`);
  }
  return (await r.json()).filter(x => x.type === 'file').map(x => ({ name: x.path, size: x.size || (x.lfs && x.lfs.size) || 0 }));
}
// Model sherpa-onnx diunggah di beberapa akun (csukuangfj, csukuangfj2, k2-fsa). Coba repo utama, lalu akun lain dengan nama yang sama.
const HF_OWNERS = ['csukuangfj', 'csukuangfj2', 'k2-fsa'];
function repoCandidates(m) {
  const out = [], add = (r) => { if (r && !out.includes(r)) out.push(r); };
  for (const r of (m.repos || [m.repo])) {
    add(r);
    const [o, n] = r.split('/');
    if (n && HF_OWNERS.includes(o)) HF_OWNERS.forEach(x => add(x + '/' + n));
  }
  return out;
}
async function hfFind(m, signal) {
  const tried = []; let last = null;
  for (const repo of repoCandidates(m)) {
    try { return { repo, files: await hfList(repo, '', signal) }; }
    catch (e) { if (!(e && e.miss)) throw e; tried.push(repo); last = e; }
  }
  throw new Error(`Model ${m.title} tidak ditemukan di Hugging Face (dicoba: ${tried.join(', ')}). ${last ? 'Kode terakhir HTTP ' + last.status + '. ' : ''}Bila Hugging Face diblokir di jaringan Anda, ganti Sumber unduhan model di Pengaturan > Mesin offline (mis. hf-mirror.com).`);
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

// ekstrak zip model Vosk ke dir (folder teratas di dalam zip dibuang). Memakai fflate (JS murni, tanpa program luar).
async function unzipModel(zipPath, dir) {
  const fflate = require('fflate');
  const data = new Uint8Array(await fs.promises.readFile(zipPath));
  const files = await new Promise((res, rej) => fflate.unzip(data, (e, f) => e ? rej(e) : res(f)));
  const names = Object.keys(files).filter(n => !n.endsWith('/'));
  if (!names.length) throw new Error('Berkas zip kosong');
  const tops = new Set(names.map(n => n.split('/')[0])), strip = tops.size === 1 && names.every(n => n.includes('/'));
  const base = path.resolve(dir);
  for (const n of names) {
    const rel = strip ? n.split('/').slice(1).join('/') : n, out = path.resolve(base, rel);
    if (out !== base && !out.startsWith(base + path.sep)) throw new Error('Zip tidak valid');
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, files[n]);
  }
  if (!fs.existsSync(path.join(base, 'conf')) && !fs.existsSync(path.join(base, 'am'))) throw new Error('Isi model Vosk tidak lengkap');
}

// Satu kali jalan unduhan. Bisa dijeda: jeda membatalkan permintaan yang sedang berjalan tetapi berkas .part dibiarkan,
// sehingga "lanjut" meneruskan dari byte terakhir (Range). Daftar berkas (job.planned) disimpan agar lanjut tidak perlu internet untuk membaca daftar lagi.
function runJob(job) {
  job.run = (async () => {
    try {
      job.phase = 'Membaca daftar berkas…'; job.done = 0; push();
      if (!job.planned) job.planned = await job.plan(job.ctl.signal);
      const { files, meta, dir, after } = job.planned;
      job.total = files.reduce((a, f) => a + (f.size || 0), 0) || job.total;
      job.phase = 'Mengunduh…'; push();
      for (const f of files) {
        if (job.ctl.signal.aborted) throw new Error('dibatalkan');
        await fetchTo(f.url, path.join(dir, f.name), f.size, job);
      }
      job.noPause = true;
      if (after) { job.phase = 'Memproses…'; push(); await after(dir, job); }
      fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify(Object.assign({ ts: Date.now() }, meta)));
      job.finished = true; job.paused = false; job.phase = 'Selesai';
      onInstalled(job);
    } catch (e) {
      if (job.paused && !job.cancelled && !job.noPause) { job.phase = 'Dijeda'; return; }
      job.finished = true; job.paused = false;
      if (job.cancelled) { job.error = ''; jobs.delete(job.id); }
      else { job.error = (e && e.name === 'AbortError') ? 'Dibatalkan' : String((e && e.message) || e); job.detail = errDetail(job, e); }
    } finally { push(); }
  })();
  return job.run;
}
function onInstalled(job) {
  if (job.kind === 'stt') { const m = sttFind(job.id), k = m && KEY[m.engine]; if (k && !SV.setting(k)) SV.saveSetting(k, job.id); }
  ctx.toast && ctx.toast('Model terpasang');
  ctx.broadcastPages && ctx.broadcastPages('oe', jobInfo());
  if (ctx.refreshSettings) ctx.refreshSettings();
}
function startJob(kind, id, mb, plan) {
  const cur = jobs.get(id);
  if (cur && !cur.finished) { if (cur.paused) resume(id); return cur.paused ? true : false; }
  const job = { id, kind, done: 0, total: (mb || 0) * 1e6, error: '', finished: false, cancelled: false, paused: false, noPause: false, phase: '', plan, planned: null, run: null, ctl: new AbortController() };
  jobs.set(id, job); runJob(job); return true;
}
// jeda: hentikan jaringan, simpan berkas .part
function pause(id) {
  const j = jobs.get(id); if (!j || j.finished || j.paused || j.noPause) return false;
  j.paused = true; j.phase = 'Dijeda'; try { j.ctl.abort(); } catch {} push(); return true;
}
// lanjut: tunggu proses lama benar-benar selesai menulis berkas .part, baru mulai lagi dari byte terakhir
function resume(id) {
  const j = jobs.get(id); if (!j || j.finished || !j.paused) return false;
  (j.run || Promise.resolve()).then(() => {
    if (!j.paused || j.finished || j.cancelled) return;
    j.paused = false; j.ctl = new AbortController(); j.phase = 'Melanjutkan…'; push(); runJob(j);
  });
  return true;
}
function download(id) {
  const m = sttFind(id);
  if (m) {
    if (sttInstalled(m)) return true;
    if (m.engine === 'tjs') return startJob('stt', id, m.mb, async (signal) => {
      const root = (await hfList(m.repo, '', signal)).filter(f => /\.(json|txt)$/.test(f.name));
      if (!root.some(f => f.name === 'config.json') || !root.some(f => f.name === 'tokenizer.json')) throw new Error('Berkas model tidak lengkap di repo');
      const ox = (await hfList(m.repo, 'onnx', signal)).filter(f => TJS_ONNX.includes(f.name));
      if (ox.length !== TJS_ONNX.length) throw new Error('Versi ringan (quantized) model ini tidak tersedia');
      return { dir: sttDir(id), meta: { id, engine: 'tjs', dtype: 'q8' }, files: root.concat(ox).map(f => ({ name: f.name, size: f.size, url: `${hfBase()}/${m.repo}/resolve/main/${f.name}` })) };
    });
    if (m.engine === 'vosk') return startJob('stt', id, m.mb * 1.05, async (signal) => {
      const url = `${VOSK_URL}/${m.zip}.zip`;
      let size = 0; try { const h = await net.fetch(url, { method: 'HEAD', signal }); if (!h.ok) throw httpErr(h.status, m.zip + '.zip'); size = +h.headers.get('content-length') || 0; } catch (e) { if (e && e.name !== 'AbortError' && /HTTP|tidak ditemukan|ditolak/.test(e.message)) throw e; }
      return { dir: sttDir(id), meta: { id, engine: 'vosk' }, files: [{ name: 'model.zip', size, url }], after: async (dir) => { await unzipModel(path.join(dir, 'model.zip'), dir); try { fs.unlinkSync(path.join(dir, 'model.zip')); } catch {} } };
    });
    return startJob('stt', id, m.mb, async (signal) => {
      const { repo, files: all } = await hfFind(m, signal);
      const { files, roles } = pick(m, all);
      return { dir: sttDir(id), meta: { id, engine: 'sherpa', kind: m.kind, roles, repo }, files: files.map(f => ({ name: f.name, size: f.size, url: `${hfBase()}/${repo}/resolve/main/${f.name}` })) };
    });
  }
  if (id === NLLB.id) {
    if (nllbInstalled()) return true;
    return startJob('mt', id, NLLB.mb, async (signal) => {
      const root = (await hfList(NLLB.repo, '', signal)).filter(f => /\.(json|model)$/.test(f.name) && f.name !== 'quantize_config.json');
      if (!root.some(f => f.name === 'tokenizer.json') || !root.some(f => f.name === 'config.json')) throw new Error('Berkas model tidak lengkap di repo');
      const ox = (await hfList(NLLB.repo, 'onnx', signal)).filter(f => MT_ONNX.includes(f.name));
      if (ox.length !== MT_ONNX.length) throw new Error('Versi ringan (quantized) model ini tidak tersedia');
      return { dir: mtDir(id), meta: { id, engine: 'nllb' }, files: root.concat(ox).map(f => ({ name: f.name, size: f.size, url: `${hfBase()}/${NLLB.repo}/resolve/main/${f.name}` })) };
    });
  }
  const c2 = ct2Find(id);
  if (c2) {
    if (mtAnyInstalled(id)) return true;
    return startJob('mt', id, c2.mb, async (signal) => {
      let found = null; const tried = [];
      for (const repo of c2.repos) {
        try {
          const all = await hfList(repo, '', signal);
          if (CT2_FILES.every(n => all.some(f => f.name === n))) { found = { repo, all }; break; }
          tried.push(repo + ' (berkas tidak lengkap)');
        } catch (e) { if (!(e && e.miss)) throw e; tried.push(repo); }
      }
      if (!found) throw new Error(`Model CTranslate2 ${LANG[c2.src]} → ${LANG[c2.tgt]} tidak ditemukan atau tidak lengkap di Hugging Face (dicoba: ${tried.join(', ')}). Coba Opus-MT atau Bergamot untuk pasangan ini.`);
      return { dir: mtDir(id), meta: { id, engine: 'ct2', src: c2.src, tgt: c2.tgt, repo: found.repo }, files: CT2_FILES.map(n => ({ name: n, size: found.all.find(f => f.name === n).size, url: `${hfBase()}/${found.repo}/resolve/main/${n}` })) };
    });
  }
  if (id.startsWith('bg-')) {
    if (mtAnyInstalled(id)) return true;
    return startJob('mt', id, (bgFind(id) || {}).mb || 30, async (signal) => {
      const bp = (await bgCatalog(signal)).find(x => x.id === id);
      if (!bp) throw new Error('Model Bergamot untuk pasangan ini tidak ada di daftar Mozilla');
      const F = bp.files, names = { model: 'model.bin', lex: 'lex.bin', vocab: 'vocab.spm', srcvocab: 'srcvocab.spm', trgvocab: 'trgvocab.spm' };
      const list = Object.keys(F).map(k => ({ name: names[k], size: F[k].size, url: F[k].url, hash: F[k].hash }));
      const vocabs = F.vocab ? [names.vocab] : [names.srcvocab, names.trgvocab];
      return {
        dir: mtDir(id), meta: { id, engine: 'bergamot', src: bp.src, tgt: bp.tgt, model: names.model, lex: names.lex, vocabs }, files: list,
        // periksa sha256 (dari server Mozilla), lalu buka gzip bila berkasnya dikirim terkompresi
        after: async (dir) => {
          const crypto = require('crypto'), zlib = require('zlib');
          for (const f of list) {
            const fp = path.join(dir, f.name); let buf = fs.readFileSync(fp);
            if (f.hash && crypto.createHash('sha256').update(buf).digest('hex') !== String(f.hash).toLowerCase()) { try { fs.unlinkSync(fp); } catch {} throw new Error(`Berkas ${f.name} rusak (sha256 tidak cocok). Coba unduh lagi.`); }
            if (buf.length > 2 && buf[0] === 0x1f && buf[1] === 0x8b) fs.writeFileSync(fp, zlib.gunzipSync(buf));
          }
        }
      };
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
      return { dir: mtDir(id), meta: { id, src: p.src, tgt: p.tgt }, files: root.concat(ox).map(f => ({ name: f.name, size: f.size, url: `${hfBase()}/${p.repo}/resolve/main/${f.name}` })) };
    });
  }
  return false;
}
function cancel(id) {
  const j = jobs.get(id);
  if (j && !j.finished) {
    const wasPaused = j.paused; j.cancelled = true; j.paused = false; try { j.ctl.abort(); } catch {}
    if (wasPaused) { j.finished = true; jobs.delete(id); }      // sedang dijeda: tidak ada proses yang akan membersihkan
    setTimeout(() => rmDir(sttFind(id) ? sttDir(id) : mtDir(id)), 400);
  }
  push();
}
function rmDir(d) { try { fs.rmSync(d, { recursive: true, force: true }); } catch {} }
async function remove(id) {
  const j = jobs.get(id); if (j && !j.finished) return false;
  jobs.delete(id);
  if (sttFind(id)) {
    const m = sttFind(id), k = KEY[m.engine];
    if (SV.setting(k) === id) { SV.saveSetting(k, ''); }
    W[m.engine].kill(); loaded[m.engine] = '';
    rmDir(sttDir(id));
  } else if (mtFind(id) || id === NLLB.id) { mtW.kill(); loaded.mt = ''; rmDir(mtDir(id)); }
  else if (ct2Find(id)) { ct2W.kill(); rmDir(mtDir(id)); }
  else if (id.startsWith('bg-')) { bgW.kill(); rmDir(mtDir(id)); }
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
    p.on('message', m => { if (m && m.rss) this.rss = m.rss; const q = this.pending.get(m.id); if (!q) return; this.pending.delete(m.id); clearTimeout(q.t); m.ok ? q.res(m) : q.rej(new Error(m.err || 'Kesalahan mesin offline')); });
    p.on('exit', (code) => {
      if (this.p === p) this.p = null;
      const why = new Error(this.label + ' berhenti tiba-tiba' + (this.err ? ': ' + this.err.split('\n').filter(Boolean).pop() : ''));
      for (const [id, q] of this.pending) if (q.p === p) { clearTimeout(q.t); q.rej(why); this.pending.delete(id); }      // hanya permintaan milik proses ini, bukan proses baru penggantinya
      if (this.onexit) this.onexit();
    });
    p.on('error', () => {});
  }
  call(msg, timeout) {
    return new Promise((res, rej) => {
      try { this.ensure(); } catch (e) { return rej(e); }
      const id = ++this.seq;
      const t = setTimeout(() => { this.pending.delete(id); rej(new Error(this.label + ' tidak merespons')); this.kill(); }, timeout || 60000);
      this.pending.set(id, { res, rej, t, p: this.p });
      try { this.p.send(Object.assign({ id }, msg)); } catch (e) { clearTimeout(t); this.pending.delete(id); rej(e); }
    });
  }
  kill() { const p = this.p; this.p = null; if (p) { try { p.kill(); } catch {} } }
}
const sttW = new Worker('offline-stt-worker.js', 'Mesin suara ke teks offline (sherpa-onnx)');
const asrW = new Worker('offline-asr-worker.js', 'Mesin Whisper (Transformers.js)');
const voskW = new Worker('offline-vosk-worker.js', 'Mesin Vosk');
const mtW = new Worker('offline-mt-worker.js', 'Mesin terjemahan offline');
const ct2W = new Worker('offline-ct2-worker.js', 'Mesin terjemahan CTranslate2');
const bgW = new Worker('offline-bergamot-worker.js', 'Mesin terjemahan Bergamot');
const W = { sherpa: sttW, tjs: asrW, vosk: voskW };
const loaded = { sherpa: '', tjs: '', vosk: '', mt: '' };
sttW.onexit = () => { loaded.sherpa = ''; }; asrW.onexit = () => { loaded.tjs = ''; }; voskW.onexit = () => { loaded.vosk = ''; }; mtW.onexit = () => { loaded.mt = ''; };
let idleT = null;
const used = () => { clearTimeout(idleT); idleT = null; };
const killAll = () => { sttW.kill(); asrW.kill(); voskW.kill(); mtW.kill(); ct2W.kill(); bgW.kill(); loaded.sherpa = loaded.tjs = loaded.vosk = loaded.mt = ''; };
// lepas memori bila mesin tidak dipakai beberapa saat
function releaseSoon(ms) { clearTimeout(idleT); idleT = setTimeout(killAll, ms || 45000); }
function shutdown() { clearTimeout(idleT); killAll(); }

/* ================= suara ke teks ================= */
const norm = (t) => { t = String(t || '').trim(); if (!t) return ''; if (/^(zh|yue|cmn)/i.test(t)) return 'zh'; if (/^(iw)$/i.test(t)) return 'he'; if (/^jp$/i.test(t)) return 'ja'; return t.split(/[-_]/)[0].toLowerCase(); };
const WHISPER_NAMES = { english: 'en', indonesian: 'id', japanese: 'ja', korean: 'ko', chinese: 'zh', spanish: 'es', arabic: 'ar', hindi: 'hi', french: 'fr', german: 'de', portuguese: 'pt', russian: 'ru', italian: 'it', dutch: 'nl', turkish: 'tr', thai: 'th', vietnamese: 'vi', malay: 'ms' };
const langFromName = (n) => WHISPER_NAMES[String(n || '').toLowerCase()] || '';
const threads = () => { const c = SV.setting('ofthreads'); const n = require('os').cpus().length; return c > 0 ? Math.min(c, 16) : Math.max(2, Math.min(4, Math.floor(n / 2))); };
const curEngine = () => ENG[SV.setting('stengine')] || '';
const selected = () => { const e = curEngine(); if (!e) return null; const m = sttFind(SV.setting(KEY[e])); return m && m.engine === e && sttInstalled(m) ? m : null; };
// tebak bahasa dari aksara (dipakai bila mesin tidak melaporkan bahasa); huruf Latin tidak bisa dibedakan, jadi dikosongkan
const guessLang = (t) => /[\u3040-\u30ff]/.test(t) ? 'ja' : /[\uac00-\ud7af]/.test(t) ? 'ko' : /[\u4e00-\u9fff]/.test(t) ? 'zh' : /[\u0400-\u04ff]/.test(t) ? 'ru' : /[\u0e00-\u0e7f]/.test(t) ? 'th' : /[\u0600-\u06ff]/.test(t) ? 'ar' : /[\u0900-\u097f]/.test(t) ? 'hi' : '';
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

const modelRoot = () => path.join(root(), 'stt');
async function loadStt(m) {
  const th = threads();
  if (m.engine === 'sherpa') {
    const lang = m.fixed || norm(SV.setting('stlang'));
    const key = [m.id, lang, th].join('|'); if (key === loaded.sherpa) return;
    const mf = manifest(sttDir(m.id));
    await sttW.call({ op: 'load', kind: m.kind, dir: sttDir(m.id), roles: mf.roles, lang: m.kind === 'whisper' && !m.fixed ? lang : '', threads: th }, 120000);
    loaded.sherpa = key;
  } else if (m.engine === 'tjs') {
    const key = [m.id, th].join('|'); if (key === loaded.tjs) return;
    await asrW.call(Object.assign({ op: 'load' }, tjsArgs(m)), 240000);
    loaded.tjs = key;
  } else {
    if (m.id === loaded.vosk) return;
    await voskW.call({ op: 'load', dir: sttDir(m.id) }, 120000);
    loaded.vosk = m.id;
  }
}
const tjsArgs = (m) => { const mf = manifest(sttDir(m.id)) || {}; return { root: modelRoot(), model: m.id, dtype: mf.dtype || 'q8', lang: m.fixed ? '' : norm(SV.setting('stlang')), threads: threads() }; };
// dipanggil saat Terjemahan Suara dinyalakan, supaya model sudah siap sebelum kalimat pertama (suara ke teks dan, bila dipilih, NLLB)
async function warm() {
  const m = selected(); if (!m) throw new Error('Model suara ke teks offline belum dipasang');
  used();
  await Promise.all([loadStt(m), SV.setting('trmode') === 'nllb' && nllbInstalled() ? warmNllb() : null]);
}
async function warmNllb() { if (loaded.mt === NLLB.id) return; await mtW.call({ op: 'load', root: path.join(root(), 'mt'), model: NLLB.id, threads: threads() }, 300000); loaded.mt = NLLB.id; }
const spaceless = (t, lang) => (lang === 'ja' || lang === 'zh') ? t.replace(/\s+/g, '') : t;      // Vosk memberi spasi antar kata pada Jepang/Mandarin
async function transcribe(wavBuf) {
  const m = selected(); if (!m) { const e = new Error('Model suara ke teks offline belum dipasang. Buka Pengaturan > Mesin offline'); e.fatal = true; throw e; }
  used(); await loadStt(m);
  const pcm = wavToFloat(wavBuf), stl = norm(SV.setting('stlang'));
  if (m.engine === 'sherpa') {
    const r = await sttW.call({ op: 'run', pcm }, 60000), text = String(r.text || '').trim();
    return { text, lang: m.fixed || norm(r.lang) || stl || guessLang(text) };
  }
  if (m.engine === 'tjs') {
    const r = await asrW.call(Object.assign({ op: 'run', pcm }, tjsArgs(m)), 120000), text = String(r.text || '').trim();
    return { text, lang: m.fixed || stl || guessLang(text) };
  }
  const r = await voskW.call({ op: 'run', pcm }, 60000);
  return { text: spaceless(String(r.text || '').trim(), m.fixed), lang: m.fixed };
}
function sttStop() { releaseSoon(45000); }

/* ================= terjemahan ================= */
class Missing extends Error { constructor(m) { super(m); this.missing = true; } }
// Tiga keluarga model per-pasangan: Opus-MT (onnx), CTranslate2 dan Bergamot. Semuanya "lewat Inggris" bila tidak ada pasangan langsung.
const FAMS = {
  offline: { name: 'Opus-MT', all: () => MT_PAIRS, pfx: 'opus', worker: mtW },
  ct2: { name: 'CTranslate2', all: () => CT2_PAIRS, pfx: 'ct2', worker: ct2W },
  bergamot: { name: 'Bergamot', all: () => { const o = BG.pairs.slice(); for (const p of bgInstalled()) if (!o.some(x => x.id === p.id)) o.push(p); return o; }, pfx: 'bg', worker: bgW }
};
const famPair = (fam, s, t) => FAMS[fam].all().find(p => p.id === `${FAMS[fam].pfx}-${s}-${t}`);
const famHave = (fam) => FAMS[fam].all().filter(p => mtAnyInstalled(p.id));
function routeFam(fam, s, t) {
  const have = famHave(fam);
  const d = have.find(p => p.src === s && p.tgt === t); if (d) return [d];
  const a = have.find(p => p.src === s && p.tgt === 'en'), b = have.find(p => p.src === 'en' && p.tgt === t);
  return a && b ? [a, b] : null;
}
const route = (s, t) => routeFam('offline', s, t);
// model yang masih perlu diunduh agar src → tgt bisa berjalan ([] bila sudah siap, null bila tidak didukung)
function planFam(fam, src, tgt) {
  const s = norm(src), t = norm(tgt); if (!s || !t || s === t) return [];
  const d = famPair(fam, s, t); if (d) return mtAnyInstalled(d.id) ? [] : [d.id];
  const a = famPair(fam, s, 'en'), b = famPair(fam, 'en', t); if (!a || !b) return null;
  return [a, b].filter(p => !mtAnyInstalled(p.id)).map(p => p.id);
}
const plan = (src, tgt) => planFam('offline', src, tgt);
async function planAsync(src, tgt, fam) {
  fam = FAMS[fam] ? fam : 'offline';
  if (fam === 'bergamot') await bgCatalog(null, true);
  return planFam(fam, src, tgt);
}
async function translateFam(fam, text, src, tgt) {
  const s = norm(src), t = norm(tgt);
  if (!s) throw new Missing('Bahasa ucapan tidak diketahui, pilih Bahasa ucapan video di Pengaturan > Play');
  if (s === t) return '';
  const steps = routeFam(fam, s, t), F = FAMS[fam];
  if (!steps) throw new Missing(`Model ${F.name} ${LANG[s] || s} → ${LANG[t] || t} belum terpasang`);
  used();
  const mtRoot = path.join(root(), 'mt');
  if (fam === 'bergamot') {       // pivot (bila perlu) dikerjakan di dalam mesinnya
    const r = await bgW.call({ op: 'run', root: mtRoot, models: steps.map(p => p.id), text }, 120000);
    return String(r.text || '').trim();
  }
  let cur = text;
  for (const p of steps) {
    const r = await F.worker.call({ op: 'run', root: mtRoot, model: p.id, text: cur, threads: threads() }, 90000);
    cur = String(r.text || '').trim(); if (!cur) break;
  }
  return cur;
}
const translate = (text, src, tgt) => translateFam('offline', text, src, tgt);
async function translateNllb(text, src, tgt) {
  const s = norm(src), t = norm(tgt);
  if (!s) throw new Missing('Bahasa ucapan tidak diketahui, pilih Bahasa ucapan video di Pengaturan > Play');
  const sc = nllbCode(src), tc = nllbCode(tgt);
  if (!sc) throw new Missing(`Bahasa ${LANG[s] || s} belum didukung NLLB`);
  if (!tc) throw new Missing(`Bahasa tujuan ${LANG[t] || t} belum didukung NLLB`);
  if (sc === tc) return '';
  if (!nllbInstalled()) throw new Missing('Model NLLB-200 600M belum terpasang. Buka Pengaturan > Mesin offline');
  used();
  const r = await mtW.call({ op: 'run', root: path.join(root(), 'mt'), model: NLLB.id, text, src_lang: sc, tgt_lang: tc, threads: threads() }, loaded.mt === NLLB.id ? 120000 : 300000);
  loaded.mt = NLLB.id;
  return String(r.text || '').trim();
}
// mode: 'offline' = Opus-MT, 'ct2' = CTranslate2, 'bergamot' = Bergamot, 'nllb' = NLLB-200 600M
const translateBy = (mode, text, src, tgt) => mode === 'nllb' ? translateNllb(text, src, tgt) : FAMS[mode] ? translateFam(mode, text, src, tgt) : translate(text, src, tgt);
const mtReady = (src, tgt) => { const p = plan(src, tgt); return Array.isArray(p) && p.length === 0; };

/* ================= uji kecepatan mesin terjemahan ================= */
const BENCH_TEXT = {
  en: 'The weather is very nice today, so we are going to the park.', id: 'Cuaca hari ini sangat bagus, jadi kami pergi ke taman.',
  ja: '今日はとても天気がいいので、私たちは公園に行きます。', zh: '今天天气很好，所以我们去公园。', ko: '오늘은 날씨가 아주 좋아서 우리는 공원에 갑니다.',
  es: 'Hoy hace muy buen tiempo, así que vamos al parque.', fr: 'Il fait très beau aujourd\'hui, alors nous allons au parc.', de: 'Heute ist das Wetter sehr schön, deshalb gehen wir in den Park.',
  ru: 'Сегодня очень хорошая погода, поэтому мы идём в парк.', it: 'Oggi il tempo è molto bello, quindi andiamo al parco.', nl: 'Het weer is vandaag erg mooi, dus we gaan naar het park.',
  tr: 'Bugün hava çok güzel, bu yüzden parka gidiyoruz.', vi: 'Hôm nay thời tiết rất đẹp nên chúng tôi đi công viên.', th: 'วันนี้อากาศดีมาก เราจึงไปสวนสาธารณะ',
  ar: 'الطقس جميل جدًا اليوم، لذلك سنذهب إلى الحديقة.', hi: 'आज मौसम बहुत अच्छा है, इसलिए हम पार्क जा रहे हैं।'
};
const BENCH_ENGINES = [['offline', 'Opus-MT (onnxruntime)', mtW], ['ct2', 'CTranslate2', ct2W], ['bergamot', 'Bergamot', bgW], ['nllb', 'NLLB-200 600M', mtW]];
let benchBusy = false;
// Jalankan satu kalimat di setiap mesin terjemahan yang sudah siap untuk src → tgt. Tiap mesin dimulai dari keadaan dingin
// (proses pekerjanya dimatikan dulu) supaya waktu muat model ikut terukur, lalu 3 kali terjemah untuk rata-rata.
async function bench(src, tgt, text) {
  const s = norm(src), t = norm(tgt);
  if (!s || !t || s === t) return { ok: false, err: 'Pilih dua bahasa yang berbeda' };
  const sample = String(text || '').trim().slice(0, 300) || BENCH_TEXT[s];
  if (!sample) return { ok: false, err: 'Tidak ada kalimat contoh untuk bahasa ini' };
  if (benchBusy) return { ok: false, err: 'Uji kecepatan sedang berjalan' };
  benchBusy = true; used();
  const rows = [];
  try {
    for (const [mode, name, w] of BENCH_ENGINES) {
      const row = { mode, name };
      if (mode === 'nllb') { if (!nllbInstalled()) row.state = 'belum terpasang'; else if (!nllbCode(src) || !nllbCode(tgt)) row.state = 'bahasa tidak didukung'; }
      else { const p = planFam(mode, s, t); if (p === null) row.state = mode === 'bergamot' ? 'belum terpasang' : 'pasangan tidak didukung'; else if (p.length) row.state = 'belum terpasang'; }
      if (row.state) { rows.push(row); continue; }
      try {
        mtW.kill(); ct2W.kill(); bgW.kill(); loaded.mt = ''; w.rss = 0;           // mulai dingin
        let t0 = Date.now(); const first = await translateBy(mode, sample, s, t); row.firstMs = Date.now() - t0;     // termasuk memuat model
        const ms = []; let out = first;
        for (let i = 0; i < 3; i++) { t0 = Date.now(); out = await translateBy(mode, sample, s, t); ms.push(Date.now() - t0); }
        row.avgMs = Math.round(ms.reduce((a, b) => a + b, 0) / ms.length); row.text = out || first; row.ramMB = w.rss ? Math.round(w.rss / 1048576) : 0;
      } catch (e) { row.err = String((e && e.message) || e).slice(0, 200); }
      rows.push(row);
    }
  } finally { mtW.kill(); ct2W.kill(); bgW.kill(); loaded.mt = ''; benchBusy = false; }
  return { ok: true, sample, src: s, tgt: t, threads: threads(), rows };
}

/* ================= untuk halaman Pengaturan ================= */
async function list() {
  // daftar Bergamot hanya diambil dari server bila mesin itu yang dipilih; selain itu cukup model yang sudah terpasang
  const wantBg = SV.setting('trmode') === 'bergamot'; if (wantBg) await bgCatalog(null, true);
  const bgAll = FAMS.bergamot.all();
  return {
    langs: LANG, groups: GROUPS.map(g => [g, GROUP_NAME[g]]), engines: ENG_NAME, selected: { sherpa: SV.setting('stmodel'), tjs: SV.setting('stwmodel'), vosk: SV.setting('stvmodel') }, root: root(), jobs: jobInfo(),
    nllb: { id: NLLB.id, title: NLLB.title, mb: NLLB.mb, installed: nllbInstalled(), bytes: nllbInstalled() ? dirSize(mtDir(NLLB.id)) : 0 },
    stt: STT_MODELS.map(m => ({ id: m.id, engine: m.engine, title: m.title, note: m.note, lang: m.lang, mb: m.mb, installed: sttInstalled(m), bytes: sttInstalled(m) ? dirSize(sttDir(m.id)) : 0 })),
    mt: MT_PAIRS.map(p => ({ id: p.id, src: p.src, tgt: p.tgt, mb: p.mb, installed: mtInstalled(p), bytes: mtInstalled(p) ? dirSize(mtDir(p.id)) : 0 })),
    ct2: CT2_PAIRS.map(p => ({ id: p.id, src: p.src, tgt: p.tgt, mb: p.mb, installed: mtAnyInstalled(p.id), bytes: mtAnyInstalled(p.id) ? dirSize(mtDir(p.id)) : 0 })),
    bg: { loaded: BG.pairs.length > 0, err: wantBg ? BG.err : '', pairs: bgAll.map(p => ({ id: p.id, src: p.src, tgt: p.tgt, mb: p.mb || 0, installed: mtAnyInstalled(p.id), bytes: mtAnyInstalled(p.id) ? dirSize(mtDir(p.id)) : 0 })) },
    total: dirSize(root())
  };
}
const openDir = () => { fs.mkdirSync(root(), { recursive: true }); shell.openPath(root()); };
const validModel = (id, key) => !id || (() => { const m = sttFind(id); return !!m && (!key || KEY[m.engine] === key); })();

module.exports = { list, download, cancel, pause, resume, remove, plan, planAsync, bench, translate, translateNllb, translateBy, transcribe, warm, sttReady, nllbReady: nllbInstalled, ping, mtReady, sttStop, shutdown, openDir, validModel, selected, norm, langFromName, Missing, LANG, jobInfo };
