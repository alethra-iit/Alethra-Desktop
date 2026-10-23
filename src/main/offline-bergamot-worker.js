// Proses pekerja: terjemahan offline Bergamot (mesin terjemahan Firefox: Marian int8 yang dikompilasi ke WebAssembly).
// Berjalan di proses terpisah supaya jendela browser tidak tersendat dan memori mudah dilepas.
// Model per arah (±15-45 MB) berisi: model.bin, lex (shortlist), dan satu/dua berkas vocab (SentencePiece).
const fs = require('fs'), path = require('path');

let mod = null, service = null;
const loaded = new Map();       // id -> TranslationModel (maks 3 di memori)

const GEMM = {
  int8_prepare_a: 'int8PrepareAFallback', int8_prepare_b: 'int8PrepareBFallback', int8_prepare_b_from_transposed: 'int8PrepareBFromTransposedFallback',
  int8_prepare_b_from_quantized_transposed: 'int8PrepareBFromQuantizedTransposedFallback', int8_prepare_bias: 'int8PrepareBiasFallback',
  int8_multiply_and_add_bias: 'int8MultiplyAndAddBiasFallback', int8_select_columns_of_b: 'int8SelectColumnsOfBFallback'
};

function pkgDir() { return path.join(path.dirname(require.resolve('@browsermt/bergamot-translator/package.json')), 'worker'); }

async function boot() {
  if (mod) return;
  const dir = pkgDir();
  const wasm = fs.readFileSync(path.join(dir, 'bergamot-translator-worker.wasm'));
  const script = fs.readFileSync(path.join(dir, 'bergamot-translator-worker.js'), 'utf8');
  const Module = {};
  await new Promise((resolve, reject) => {
    Object.assign(Module, {
      instantiateWasm: (info, accept) => {
        const gemm = {}; for (const k of Object.keys(GEMM)) gemm[k] = (...a) => Module.asm[GEMM[k]](...a);
        WebAssembly.instantiate(wasm, Object.assign({}, info, { wasm_gemm: gemm })).then(({ instance }) => accept(instance)).catch(reject);
        return {};
      },
      onRuntimeInitialized: () => resolve(Module),
      print() {}, printErr() {}
    });
    // kode perekat emscripten membaca "Module" dan "require" global
    global.Module = Module; global.require = require;
    try { (0, eval)(script); } catch (e) { reject(e); }
  });
  mod = Module;
  service = new mod.BlockingService({ cacheSize: 0 });
}

function memory(buf, align) {
  const bytes = new Int8Array(buf.buffer, buf.byteOffset, buf.byteLength);
  const m = new mod.AlignedMemory(bytes.byteLength, align);
  m.getByteArrayView().set(bytes);
  return m;
}

function load(root, id) {
  if (loaded.has(id)) { const m = loaded.get(id); loaded.delete(id); loaded.set(id, m); return m; }
  const dir = path.join(root, id), mf = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8')), rd = (n) => fs.readFileSync(path.join(dir, n));
  const vocabNames = [...new Set(mf.vocabs || [])];
  const vocabs = new mod.AlignedMemoryList();
  vocabNames.forEach(n => vocabs.push_back(memory(rd(n), 64)));
  // sama dengan bawaan Firefox/bergamot-translator untuk model "intgemm alphas"
  const cfg = ['beam-size: 1', 'normalize: 1.0', 'word-penalty: 0', 'cpu-threads: 0', 'gemm-precision: int8shiftAlphaAll', 'skip-cost: true',
    'alignment: soft', 'quiet: true', 'quiet-translation: true', 'max-length-break: 128', 'mini-batch-words: 1024', 'workspace: 128', 'max-length-factor: 2.0'].join('\n') + '\n';
  const m = new mod.TranslationModel(cfg, memory(rd(mf.model), 256), memory(rd(mf.lex), 64), vocabs, null);
  loaded.set(id, m);
  while (loaded.size > 3) { const k = loaded.keys().next().value; const old = loaded.get(k); loaded.delete(k); try { old.delete(); } catch {} }
  return m;
}

function run(root, ids, text) {
  const ms = ids.map(id => load(root, id));
  const input = new mod.VectorString(), opts = new mod.VectorResponseOptions();
  input.push_back(text); opts.push_back({ alignment: false, html: false, qualityScores: false });
  let res = null;
  try {
    res = ms.length > 1 ? service.translateViaPivoting(ms[0], ms[1], input, opts) : service.translate(ms[0], input, opts);
    return String(res.get(0).getTranslatedText() || '').trim();
  } finally { try { input.delete(); opts.delete(); res && res.delete(); } catch {} }
}

const ops = {
  async load(m) { await boot(); for (const id of m.models) load(m.root, id); return {}; },
  async run(m) {
    await boot();
    return { text: run(m.root, m.models, String(m.text || '').slice(0, 600)) };
  }
};

process.on('message', async (m) => {
  let out;
  try { const r = await ops[m.op](m); out = Object.assign({ id: m.id, ok: true }, r, { rss: process.memoryUsage().rss }); }
  catch (e) { out = { id: m.id, ok: false, err: String((e && e.message) || e) }; }
  try { process.send(out); } catch {}
});
process.on('disconnect', () => process.exit(0));

module.exports = { boot, _test: () => ({ mod, service }) };
