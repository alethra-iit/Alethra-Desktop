// Proses pekerja: pengenalan suara dengan Vosk (Kaldi) lewat vosk-koffi. Tanpa internet.
// Dijalankan oleh offline.js lewat child_process.fork.
let V = null, model = null;

const ops = {
  load(m) {
    if (!V) { V = require('vosk-koffi'); V.setLogLevel(-1); }
    if (model) { try { model.free(); } catch {} model = null; }
    const md = new V.Model(m.dir);
    if (!md.handle) throw new Error('Model Vosk tidak bisa dimuat (berkas rusak atau tidak lengkap)');
    model = md;
    return {};
  },
  run(m) {
    if (!model) throw new Error('Model belum dimuat');
    const f = m.pcm instanceof Float32Array ? m.pcm : new Float32Array(m.pcm);
    const pcm = Buffer.alloc(f.length * 2);
    for (let i = 0; i < f.length; i++) { const v = Math.max(-1, Math.min(1, f[i])); pcm.writeInt16LE(Math.round(v < 0 ? v * 32768 : v * 32767), i * 2); }
    const rec = new V.Recognizer({ model, sampleRate: 16000 });
    try {
      rec.acceptWaveform(pcm);
      const r = rec.finalResult();
      return { text: String((r && r.text) || '').trim() };
    } finally { try { rec.free(); } catch {} }
  }
};

process.on('message', (m) => {
  let out;
  try { out = Object.assign({ id: m.id, ok: true }, ops[m.op](m)); }
  catch (e) { out = { id: m.id, ok: false, err: String((e && e.message) || e) }; }
  try { process.send(out); } catch {}
});
process.on('disconnect', () => process.exit(0));
