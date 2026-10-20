// Proses pekerja: Whisper lewat transformers.js + onnxruntime-node (tanpa internet).
// Dijalankan oleh offline.js lewat child_process.fork; terpisah dari pekerja sherpa-onnx karena masing-masing membawa onnxruntime sendiri.
const Module = require('module'), path = require('path');

// transformers.js memuat "sharp" (pengolah gambar) saat start; untuk suara tidak diperlukan, jadi diganti pengganti kosong.
const origResolve = Module._resolveFilename;
Module._resolveFilename = function (req, ...a) { return req === 'sharp' ? path.join(__dirname, 'sharp-stub.js') : origResolve.call(this, req, ...a); };

let T = null, cur = null, curKey = '';

async function getPipe(m) {
  const key = [m.root, m.model, m.dtype, m.threads].join('|');
  if (cur && key === curKey) return cur;
  if (!T) { T = require('@huggingface/transformers'); T.env.allowRemoteModels = false; T.env.allowLocalModels = true; T.env.useBrowserCache = false; }
  T.env.localModelPath = m.root;
  if (cur) { try { cur.dispose && await cur.dispose(); } catch {} cur = null; curKey = ''; }   // satu model saja di memori
  cur = await T.pipeline('automatic-speech-recognition', m.model, { dtype: m.dtype || 'q8', device: 'cpu', session_options: { intraOpNumThreads: m.threads || 2, graphOptimizationLevel: 'all' } });
  curKey = key;
  return cur;
}

const ops = {
  async load(m) { await getPipe(m); return {}; },
  async run(m) {
    const p = await getPipe(m);
    const pcm = m.pcm instanceof Float32Array ? m.pcm : new Float32Array(m.pcm);
    const opt = { task: 'transcribe', return_timestamps: false, chunk_length_s: 30 };
    if (m.lang) opt.language = m.lang;            // kosong = Whisper menebak sendiri
    const out = await p(pcm, opt);
    const r = Array.isArray(out) ? out[0] : out;
    return { text: String((r && r.text) || '').trim() };
  }
};

process.on('message', async (m) => {
  let out;
  try { out = Object.assign({ id: m.id, ok: true }, await ops[m.op](m)); }
  catch (e) { out = { id: m.id, ok: false, err: String((e && e.message) || e) }; }
  try { process.send(out); } catch {}
});
process.on('disconnect', () => process.exit(0));
