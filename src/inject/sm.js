// Sound Master: mesin audio per halaman/frame. Dipasang oleh main.js (executeJavaScript) hanya bila pengguna mengubah
// pengaturan suara sebuah tab, jadi halaman yang tidak disentuh tidak dimodifikasi sama sekali.
// Semua elemen <audio>/<video> di frame diarahkan ke satu bus Web Audio:
//   sumber -> bus -> [bass] -> [suara: highpass, EQ, kompresor] -> penguat (0-600 %) -> limiter -> keluaran
// Elemen yang TIDAK aman diarahkan dibiarkan apa adanya (jika diarahkan, suaranya malah jadi senyap):
//   - sumber lintas-origin tanpa CORS (keluaran MediaElementSource akan nol)
//   - konten ber-DRM (EME)
//   - elemen yang sudah dipakai grafik audio milik situs
(function () {
  if (window.__alSM) return;
  var W = window, D = document, AC = W.AudioContext || W.webkitAudioContext;
  var cfg = { v: 100, b: 0, voice: false };
  var ac = null, N = null, key = '', refs = [], hooked = false;

  function api(o) { try { Object.defineProperty(W, '__alSM', { value: o, configurable: true }); } catch (e) { W.__alSM = o; } }
  if (!AC) { api({ set: function () { return { n: 0, ok: 0, bad: 0, off: 1 }; }, stat: function () { return { n: 0, ok: 0, bad: 0, off: 1 }; } }); return; }

  function isDefault() { return cfg.v === 100 && !cfg.b && !cfg.voice; }

  function build() {
    try { ac = new AC({ latencyHint: 'interactive' }); } catch (e) { ac = null; return false; }
    var f = function (type, freq, q, gain) { var n = ac.createBiquadFilter(); n.type = type; n.frequency.value = freq; if (q != null) n.Q.value = q; n.gain.value = gain || 0; return n; };
    N = {
      bus: ac.createGain(),
      bass: f('lowshelf', 140, null, 0),
      hp: f('highpass', 100, 0.7),
      mud: f('lowshelf', 240, null, -3),
      mid: f('peaking', 2000, 1.0, 6),
      pres: f('peaking', 4000, 1.2, 3),
      comp: ac.createDynamicsCompressor(),
      make: ac.createGain(),
      master: ac.createGain(),
      lim: ac.createDynamicsCompressor(),
      post: ac.createGain()
    };
    // perata dialog: suara pelan terangkat, ledakan tidak ikut keras. DynamicsCompressorNode menambah "makeup gain" otomatis
    // (ikut menaikkan suara pelan); N.make menyesuaikan supaya Voice boost terasa jelas tapi tidak berlebihan.
    N.comp.threshold.value = -30; N.comp.knee.value = 20; N.comp.ratio.value = 3; N.comp.attack.value = 0.01; N.comp.release.value = 0.25;
    N.make.gain.value = 0.8;
    // limiter: mencegah pecah kasar saat penguatan tinggi. Makeup gain otomatisnya = (1 / gain pada 0 dBFS)^0.6; N.post membatalkannya
    // supaya angka persen tetap akurat (di bawah ambang, keluaran = masukan).
    N.lim.threshold.value = -2; N.lim.knee.value = 0; N.lim.ratio.value = 20; N.lim.attack.value = 0.002; N.lim.release.value = 0.12;
    N.post.gain.value = Math.pow(Math.pow(10, (-2 + 2 / 20) / 20), 0.6);
    ac.onstatechange = function () { if (ac && ac.state === 'suspended') wake(); };
    ['pointerdown', 'keydown', 'touchstart'].forEach(function (e) { D.addEventListener(e, wake, true); });
    key = '';
    return true;
  }
  function wake() { try { if (ac && ac.state !== 'running' && ac.state !== 'closed') ac.resume().catch(function () {}); } catch (e) {} }

  // susun ulang rantai hanya bila tahap yang aktif berubah
  function wire() {
    if (!ac) return;
    var k = (cfg.b > 0 ? 'b' : '') + (cfg.voice ? 'v' : '') + (cfg.v > 100 || cfg.b > 0 || cfg.voice ? 'l' : '');
    if (k === key) return;
    key = k;
    Object.keys(N).forEach(function (n) { try { N[n].disconnect(); } catch (e) {} });
    var chain = [N.bus];
    if (cfg.b > 0) chain.push(N.bass);
    if (cfg.voice) chain.push(N.hp, N.mud, N.mid, N.pres, N.comp, N.make);
    chain.push(N.master);
    if (k.indexOf('l') >= 0) chain.push(N.lim, N.post);
    for (var i = 0; i < chain.length - 1; i++) chain[i].connect(chain[i + 1]);
    chain[chain.length - 1].connect(ac.destination);
  }
  function params() {
    if (!ac) return;
    var t = ac.currentTime, set = function (p, v) { try { p.setTargetAtTime(v, t, 0.02); } catch (e) { p.value = v; } };
    set(N.master.gain, cfg.v / 100);
    set(N.bass.gain, cfg.b / 100 * 14);
  }

  // true = aman diarahkan, false = jangan, null = belum bisa dinilai (sumber belum dimuat)
  function safe(el) {
    if (el.mediaKeys) return false;
    var s = el.currentSrc || el.src;
    if (!s) return el.srcObject ? true : null;
    if (/^(blob|data|mediastream):/i.test(s)) return true;
    try { if (new URL(s, location.href).origin === location.origin) return true; } catch (e) { return false; }
    return el.crossOrigin != null;
  }
  function attach(el) {
    if (!el || el.__alSMs !== undefined) return;
    var ok = safe(el);
    if (ok === null) return;
    if (!ac && !build()) return;
    var st = 0;
    if (ok) {
      try { var s = ac.createMediaElementSource(el); s.connect(N.bus); st = 1; }
      catch (e) { st = 2; }
    } else st = 2;
    try { Object.defineProperty(el, '__alSMs', { value: st, configurable: true }); } catch (e) { el.__alSMs = st; }
    refs.push(new WeakRef(el));
  }
  function scan(root) {
    if (!ac && isDefault()) return;
    var l = (root || D).querySelectorAll ? (root || D).querySelectorAll('audio,video') : [];
    for (var i = 0; i < l.length; i++) attach(l[i]);
    if (root && root.matches && root.matches('audio,video')) attach(root);
  }
  function hook() {
    if (hooked) return; hooked = true;
    try {   // elemen yang dibuat lewat new Audio() tidak ada di DOM: tangkap saat mulai diputar
      var op = HTMLMediaElement.prototype.play;
      HTMLMediaElement.prototype.play = function () { try { if (ac || !isDefault()) attach(this); } catch (e) {} return op.apply(this, arguments); };
    } catch (e) {}
    ['loadedmetadata', 'playing'].forEach(function (ev) { D.addEventListener(ev, function (e) { try { var t = e.target; if (t && t.tagName && /^(AUDIO|VIDEO)$/.test(t.tagName) && (ac || !isDefault())) attach(t); } catch (x) {} }, true); });
    try {
      new MutationObserver(function (ms) {
        if (!ac && isDefault()) return;
        for (var i = 0; i < ms.length; i++) for (var j = 0; j < ms[i].addedNodes.length; j++) { var n = ms[i].addedNodes[j]; if (n.nodeType === 1) scan(n); }
      }).observe(D, { childList: true, subtree: true });
    } catch (e) {}
    setInterval(function () { if (ac) scan(); }, 2000);   // cadangan: elemen yang sumbernya baru terisi, atau di shadow DOM yang sudah diputar
  }

  function stat() {
    var n = 0, ok = 0, bad = 0, live = [];
    for (var i = 0; i < refs.length; i++) { var e = refs[i].deref(); if (!e) continue; live.push(refs[i]); n++; if (e.__alSMs === 1) ok++; else bad++; }
    refs = live;
    return { n: n, ok: ok, bad: bad, st: ac ? ac.state : '' };
  }
  function set(c) {
    c = c || {};
    var v = Math.round(+c.v); if (!isFinite(v)) v = 100; v = Math.max(0, Math.min(600, v));
    var b = Math.round(+c.b); if (!isFinite(b)) b = 0; b = Math.max(0, Math.min(100, b));
    cfg = { v: v, b: b, voice: !!c.voice };
    hook();
    if (!ac && isDefault()) return stat();
    if (!ac && !build()) return stat();
    wire(); params(); wake(); scan();
    return stat();
  }
  api({ set: set, stat: stat });
})();
