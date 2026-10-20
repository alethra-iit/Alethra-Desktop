// Proses pekerja: mengenali suara dengan sherpa-onnx (tanpa internet). Dijalankan oleh offline.js lewat child_process.fork.
const path = require('path');
let S = null, rec = null;

function cfgFor(m) {
  const f = (n) => path.join(m.dir, n), r = m.roles;
  const mc = { tokens: f(r.tokens), numThreads: m.threads || 2, provider: 'cpu', debug: 0 };
  if (m.kind === 'whisper') mc.whisper = { encoder: f(r.encoder), decoder: f(r.decoder), language: m.lang || '', task: 'transcribe' };
  else if (m.kind === 'moonshine') mc.moonshine = { encoder: f(r.encoder), mergedDecoder: f(r.mergedDecoder) };
  else mc.transducer = { encoder: f(r.encoder), decoder: f(r.decoder), joiner: f(r.joiner) };
  return { featConfig: { sampleRate: 16000, featureDim: 80 }, modelConfig: mc, decodingMethod: 'greedy_search' };
}

const ops = {
  load(m) {
    if (!S) S = require('sherpa-onnx-node');
    rec = null;                                   // lepas model lama sebelum memuat yang baru
    rec = new S.OfflineRecognizer(cfgFor(m));
    return {};
  },
  run(m) {
    if (!rec) throw new Error('Model belum dimuat');
    const st = rec.createStream();
    st.acceptWaveform({ sampleRate: 16000, samples: m.pcm instanceof Float32Array ? m.pcm : new Float32Array(m.pcm) });
    rec.decode(st);
    const r = rec.getResult(st) || {};
    const lg = /[a-z]{2,3}/i.exec(String(r.lang || ''));
    return { text: String(r.text || '').trim(), lang: lg ? lg[0].toLowerCase() : '' };
  }
};

process.on('message', (m) => {
  let out;
  try { out = Object.assign({ id: m.id, ok: true }, ops[m.op](m)); }
  catch (e) { out = { id: m.id, ok: false, err: String((e && e.message) || e) }; }
  try { process.send(out); } catch {}
});
process.on('disconnect', () => process.exit(0));
