// Proses pekerja: terjemahan offline CTranslate2 (Opus-MT / Marian yang sudah dikonversi, int8) lewat binding Node native.
// Lebih cepat dari onnxruntime untuk model yang sama. Berjalan di proses terpisah supaya jendela browser tidak tersendat.
// Folder model berisi: config.json, model.bin, shared_vocabulary.json, source.spm, target.spm.
const path = require('path');

let C = null;
const loaded = new Map();       // id -> Ct2Translator (maks 3 di memori)

function getTr(root, id, threads) {
  const key = id + '|' + (threads || 2);
  if (loaded.has(key)) { const t = loaded.get(key); loaded.delete(key); loaded.set(key, t); return t; }
  if (!C) C = require('ctranslate2');
  for (const k of [...loaded.keys()]) if (k.split('|')[0] === id) loaded.delete(k);      // thread berubah: muat ulang
  const t = new C.Ct2Translator({ modelPath: path.join(root, id), device: 'cpu', threads: threads || 2 });
  loaded.set(key, t);
  while (loaded.size > 3) loaded.delete(loaded.keys().next().value);
  return t;
}

const ops = {
  async load(m) { getTr(m.root, m.model, m.threads); return {}; },
  async run(m) {
    const t = getTr(m.root, m.model, m.threads);
    const text = String(m.text || '').slice(0, 600);
    const out = await t.translateBatch([text], { beamSize: 2, maxBatchSize: 1 });
    return { text: String((out && out[0] && out[0].text) || '').trim() };
  }
};

process.on('message', async (m) => {
  let out;
  try { out = Object.assign({ id: m.id, ok: true }, await ops[m.op](m)); }
  catch (e) { out = { id: m.id, ok: false, err: String((e && e.message) || e) }; }
  try { process.send(out); } catch {}
});
process.on('disconnect', () => process.exit(0));
