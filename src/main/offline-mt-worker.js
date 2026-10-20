// Proses pekerja: terjemahan offline (Opus-MT / Marian, ONNX int8) lewat transformers.js + onnxruntime-node.
// Berjalan di proses terpisah dari pekerja suara karena keduanya membawa onnxruntime sendiri.
const Module = require('module'), path = require('path');

// transformers.js memuat "sharp" (pengolah gambar) saat start; untuk teks tidak diperlukan, jadi diganti pengganti kosong
// agar tidak perlu ikut dalam installer.
const origResolve = Module._resolveFilename;
Module._resolveFilename = function (req, ...a) { return req === 'sharp' ? path.join(__dirname, 'sharp-stub.js') : origResolve.call(this, req, ...a); };

let T = null, root = '';
const pipes = new Map();        // id -> pipeline (maks 3 model di memori)

async function getPipe(id, threads) {
  if (pipes.has(id)) { const p = pipes.get(id); pipes.delete(id); pipes.set(id, p); return p; }
  if (!T) { T = require('@huggingface/transformers'); T.env.allowRemoteModels = false; T.env.allowLocalModels = true; T.env.useBrowserCache = false; }
  T.env.localModelPath = root;
  // NLLB-600M besar (±1 GB di memori): saat dimuat, model lain dilepas dulu; model Opus-MT juga melepas NLLB.
  const big = (x) => String(x).startsWith('nllb');
  for (const k of [...pipes.keys()]) if (big(id) || big(k)) { const old = pipes.get(k); pipes.delete(k); try { old.dispose && await old.dispose(); } catch {} }
  const p = await T.pipeline('translation', id, { dtype: 'q8', device: 'cpu', session_options: { intraOpNumThreads: threads || 2, graphOptimizationLevel: 'all' } });
  pipes.set(id, p);
  while (pipes.size > 3) { const k = pipes.keys().next().value; const old = pipes.get(k); pipes.delete(k); try { old.dispose && old.dispose(); } catch {} }
  return p;
}

const ops = {
  async load(m) { root = m.root; await getPipe(m.model, m.threads); return {}; },
  async run(m) {
    root = m.root;
    const p = await getPipe(m.model, m.threads);
    const text = String(m.text || '').slice(0, 600);
    // NLLB: kode bahasa FLORES-200 (mis. jpn_Jpan → ind_Latn); satu model untuk semua pasangan, tanpa lewat Inggris
    const opt = m.src_lang ? { src_lang: m.src_lang, tgt_lang: m.tgt_lang, max_new_tokens: 256, num_beams: 1 } : { max_new_tokens: 256, num_beams: 2 };
    const out = await p(text, opt);
    const r = Array.isArray(out) ? out[0] : out;
    return { text: String((r && (r.translation_text || r.text)) || '').trim() };
  }
};

process.on('message', async (m) => {
  let out;
  try { out = Object.assign({ id: m.id, ok: true }, await ops[m.op](m)); }
  catch (e) { out = { id: m.id, ok: false, err: String((e && e.message) || e) }; }
  try { process.send(out); } catch {}
});
process.on('disconnect', () => process.exit(0));
