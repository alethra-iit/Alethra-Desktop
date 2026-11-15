/* AlethPlay — antarmuka pemutar musik & video (alethra://play). Data & file lewat API play.* di main (play.js). */
(async function () {
  await pageInit();
  const D = (await api('play.get')) || {};
  let lists = D.lists || [], hist = D.history || [], resume = D.resume || {};
  const st = Object.assign({ vol: 1, muted: false, shuffle: false, repeat: 'off', view: 'list', rate: 1 }, D.state || {});
  const PLAY = '<svg class="i f" viewBox="0 0 24 24"><path d="M7 4l13 8-13 8z"/></svg>', PAUSE = '<svg class="i f" viewBox="0 0 24 24"><path d="M7 4h3.5v16H7zM13.5 4H17v16h-3.5z"/></svg>';
  const NAV = [['np', 'Sedang diputar', 'volume'], ['music', 'Musik', 'music'], ['video', 'Video', 'video'], ['folder', 'Folder', 'folder'], ['dl', 'Unduhan', 'download'], ['pl', 'Playlist', 'list'], ['hist', 'Riwayat', 'clock']];
  const el = (h) => { const d = document.createElement('div'); d.innerHTML = h.trim(); return d.firstChild; };
  const base = (n) => String(n).replace(/\.[^.]+$/, '');
  const extOf = (n) => (String(n).match(/\.([^.]+)$/) || [, ''])[1].toUpperCase();
  const fmtT = (s) => { if (!isFinite(s) || s < 0) s = 0; s = Math.floor(s); const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), x = s % 60; return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(x).padStart(2, '0'); };
  const fmtD = (t) => t ? new Date(t).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
  const when = (t) => new Date(t).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  const deb = (f, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => f(...a), ms); }; };
  const natural = (a, b) => a.n.localeCompare(b.n, undefined, { numeric: true, sensitivity: 'base' });
  const persist = (k, v) => api('play.set', k, v);
  const saveLists = () => persist('lists', lists), saveHist = deb(() => persist('history', hist), 1000);
  const saveState = deb(() => persist('state', st), 500), saveResume = deb(() => persist('resume', resume), 3000);
  let toastT; const toast = (m) => { const t = $('#toast'); t.textContent = m; t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 2200); };

  /* ================= kerangka ================= */
  $('#ap').innerHTML = `<nav class="sb" id="sb"><div class="lg">${ICON('alethplay', 22)}<span>AlethPlay</span></div></nav>
    <main class="mn">
      <section class="view" id="np" data-k="a">
        <div id="npEmpty" class="empty" style="flex:1"><div style="font-size:16px;font-weight:600;color:var(--fg)">Belum ada yang diputar</div>
          <div>Pilih lagu atau video dari Musik, Video, Folder, atau Unduhan.</div>
          <button class="btn pri" id="open">${ICON('open')} Buka berkas…</button></div>
        <div id="npMain" class="col" hidden>
          <div class="stage" id="stage"><video id="v" preload="metadata" crossorigin="anonymous"></video><div class="art">${ICON('music')}<div class="an" id="an"></div></div></div>
          <div class="err" id="err" hidden><span id="errt"></span><button class="btn sm" id="ext">Buka dengan aplikasi lain</button></div>
        </div>
        <aside class="q" id="q" hidden><div class="qh"><b id="qn">Antrean</b><span style="display:flex;gap:6px"><button class="btn sm" id="qs">Simpan</button><button class="btn sm" id="qc">Kosongkan</button></span></div><div class="lst" id="ql"></div></aside>
      </section>
      <section class="view" id="lv" hidden></section>
      <div class="sbar" id="sbar" hidden><b id="scn">0 dipilih</b></div>
    </main>
    <footer class="pl">
      <div class="pr"><span id="tc">0:00</span><input type="range" id="seek" min="0" max="1000" value="0" disabled><span id="td">0:00</span></div>
      <div class="pc">
        <div class="nm" id="nm"><div class="t" id="nt">Tidak ada yang diputar</div><div class="s" id="ns">AlethPlay</div></div>
        <div class="mid"><button class="cb" id="bsh" title="Acak (S)">${ICON('shuffle')}</button><button class="cb" id="bpv" title="Sebelumnya (P)">${ICON('prev')}</button>
          <button class="cb big" id="bpp" title="Putar/Jeda (Spasi)">${PLAY}</button><button class="cb" id="bnx" title="Berikutnya (N)">${ICON('next')}</button><button class="cb" id="brp" title="Ulangi (R)">${ICON('repeat')}</button></div>
        <div class="rt"><button class="cb sp" id="brt" title="Kecepatan putar">1×</button><button class="cb" id="bmu" title="Bisukan (M)">${ICON('volume')}</button><input type="range" class="vol" id="vol" min="0" max="100"><button class="cb" id="bpip" title="Gambar dalam gambar" hidden>${ICON('pip')}</button><button class="cb" id="bfs" title="Layar penuh (F)" hidden>${ICON('fullscreen')}</button></div>
      </div>
    </footer>`;
  $('#np').hidden = false;
  const v = $('#v'), np = $('#np'), lv = $('#lv');

  /* ================= mesin pemutar ================= */
  let Q = [], order = [], pos = -1, errN = 0, dragging = false;
  const cur = () => (pos >= 0 && pos < order.length ? Q[order[pos]] : null);
  const shuf = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  function buildOrder(start) {
    order = Q.map((_, i) => i);
    if (st.shuffle && order.length > 1) { const rest = shuf(order.filter(i => i !== start)); order = [start, ...rest]; pos = 0; } else pos = start;
  }
  function playList(items, index) {
    const target = items[index], ok = items.filter(x => !x.missing);
    if (!ok.length) return toast('Berkas tidak ditemukan');
    Q = ok.slice(); buildOrder(Math.max(0, Q.indexOf(target))); load(pos); go('np');
  }
  function load(i) {
    pos = i; const it = cur(); if (!it) return stop();
    v.src = it.u; v.playbackRate = st.rate; hideErr(); v.play().catch(() => {});
    hist = hist.filter(x => x.p !== it.p); hist.unshift({ p: it.p, n: it.n, k: it.k, t: Date.now() }); if (hist.length > 200) hist.length = 200; saveHist();
    ui();
  }
  function stop() { Q = []; order = []; pos = -1; v.pause(); v.removeAttribute('src'); v.load(); hideErr(); ui(); }
  function next(auto) {
    if (!Q.length) return;
    if (pos + 1 < order.length) return load(pos + 1);
    if (st.repeat === 'all') { if (st.shuffle) buildOrder(Math.floor(Math.random() * Q.length)); return load(0); }
    if (!auto) toast('Sudah di akhir antrean');
  }
  function prev() {
    if (!Q.length) return;
    if (v.currentTime > 3 || pos <= 0) { v.currentTime = 0; return; }
    load(pos - 1);
  }
  function enqueue(items, afterCurrent) {
    items = items.filter(x => !x.missing); if (!items.length) return;
    if (!Q.length) return playList(items, 0);
    const first = Q.length; Q.push(...items); const idx = items.map((_, i) => first + i);
    if (afterCurrent) order.splice(pos + 1, 0, ...idx);
    else if (st.shuffle) idx.forEach(i => order.splice(pos + 1 + Math.floor(Math.random() * (order.length - pos)), 0, i));
    else order.push(...idx);
    toast(afterCurrent ? 'Diputar berikutnya' : items.length + ' item ditambahkan ke antrean'); renderQueue(); renderMini();
  }
  function removeAt(k) {
    const idx = order[k], wasCur = k === pos;
    Q.splice(idx, 1); order = order.filter((_, j) => j !== k).map(x => x > idx ? x - 1 : x);
    if (k < pos) pos--;
    if (!Q.length) return stop();
    if (wasCur) { if (pos >= order.length) { v.pause(); pos = order.length - 1; ui(); } else load(pos); } else ui();
  }
  const showErr = (m) => { $('#errt').textContent = m; $('#err').hidden = false; };
  const hideErr = () => { $('#err').hidden = true; };
  v.addEventListener('error', () => {
    const it = cur(); if (!it || !v.getAttribute('src')) return;
    errN++; showErr('Tidak bisa memutar “' + it.n + '”. Format atau codec-nya mungkin tidak didukung.');
    if (errN < Q.length && pos + 1 < order.length) setTimeout(() => { if (cur() === it) next(true); }, 900);
  });
  v.addEventListener('playing', () => { errN = 0; hideErr(); });
  v.addEventListener('loadedmetadata', () => {
    const it = cur(); $('#td').textContent = fmtT(v.duration); $('#seek').disabled = !isFinite(v.duration);
    const r = it && it.k === 'v' && resume[it.p]; if (r > 5 && r < v.duration - 10) v.currentTime = r;
  });
  v.addEventListener('timeupdate', () => {
    const d = v.duration || 0, t = v.currentTime;
    if (!dragging) { $('#tc').textContent = fmtT(t); setRange($('#seek'), d ? t / d * 1000 : 0); }
    const it = cur(); if (it && it.k === 'v' && d > 30 && Math.floor(t) % 5 === 0) { delete resume[it.p]; resume[it.p] = Math.floor(t); saveResume(); }
  });
  v.addEventListener('play', ui); v.addEventListener('pause', ui);
  v.addEventListener('ended', () => {
    const it = cur(); if (it) { delete resume[it.p]; saveResume(); }
    if (st.repeat === 'one') { v.currentTime = 0; v.play().catch(() => {}); } else next(true);
  });
  v.addEventListener('volumechange', () => { st.vol = v.volume; st.muted = v.muted; saveState(); uiVol(); });
  v.addEventListener('click', () => toggle());
  v.addEventListener('dblclick', () => fsToggle());
  const toggle = () => { if (!cur()) return; v.paused ? v.play().catch(() => {}) : v.pause(); };
  const setRange = (r, val) => { r.value = val; r.style.setProperty('--p', (r.max ? val / r.max * 100 : 0) + '%'); };

  /* ================= kontrol ================= */
  const seek = $('#seek'), vol = $('#vol');
  seek.addEventListener('input', () => { dragging = true; setRange(seek, seek.value); $('#tc').textContent = fmtT(seek.value / 1000 * (v.duration || 0)); });
  seek.addEventListener('change', () => { dragging = false; if (isFinite(v.duration)) v.currentTime = seek.value / 1000 * v.duration; });
  vol.addEventListener('input', () => { v.muted = false; v.volume = vol.value / 100; });
  $('#bmu').onclick = () => { v.muted = !v.muted; };
  // kecepatan putar 0,25× – 3× (nada tetap). defaultPlaybackRate ikut diatur supaya tidak kembali ke 1× saat lagu berganti
  const RATES = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2], fmtRate = (r) => String(r).replace('.', ',') + '×';
  function uiRate() { const b = $('#brt'); b.textContent = fmtRate(st.rate); b.classList.toggle('on', Math.abs(st.rate - 1) > 1e-6); b.title = 'Kecepatan putar: ' + fmtRate(st.rate) + ' ( [ ] ubah, \\ normal )'; }
  function setRate(r, quiet) {
    r = Math.max(0.25, Math.min(3, Math.round((+r || 1) * 100) / 100)); st.rate = r;
    try { v.defaultPlaybackRate = r; v.playbackRate = r; v.preservesPitch = true; } catch {}
    saveState(); uiRate(); if (!quiet) toast('Kecepatan ' + fmtRate(r));
  }
  function stepRate(d) { const lo = RATES.filter(x => x < st.rate - 1e-6), hi = RATES.filter(x => x > st.rate + 1e-6); setRate(d < 0 ? (lo.length ? lo[lo.length - 1] : RATES[0]) : (hi.length ? hi[0] : RATES[RATES.length - 1])); }
  $('#brt').onclick = () => popMenu($('#brt'), [{ h: 'Kecepatan putar' }, ...RATES.map(r => ({ t: fmtRate(r) + (r === 1 ? ' (normal)' : ''), ic: Math.abs(r - st.rate) < 1e-6 ? 'check' : null, sp: true, fn: () => setRate(r) }))]);
  $('#bpp').onclick = toggle; $('#bnx').onclick = () => next(false); $('#bpv').onclick = prev;
  $('#bsh').onclick = () => { st.shuffle = !st.shuffle; if (Q.length) { const c = order[pos]; buildOrder(c); if (!st.shuffle) pos = c; } saveState(); ui(); };
  $('#brp').onclick = () => { st.repeat = st.repeat === 'off' ? 'all' : st.repeat === 'all' ? 'one' : 'off'; saveState(); ui(); };
  $('#bfs').onclick = () => fsToggle();
  $('#bpip').onclick = () => { if (document.pictureInPictureElement) document.exitPictureInPicture(); else v.requestPictureInPicture().catch(() => toast('Video ini tidak mendukung gambar-dalam-gambar')); };
  $('#nm').onclick = () => { if (cur()) go('np'); };
  $('#open').onclick = openFiles;
  $('#ext').onclick = () => { const it = cur(); if (it) api('play.external', it.p); };
  $('#qc').onclick = () => stop();
  $('#qs').onclick = async () => { if (!Q.length) return; const r = await askText('Simpan antrean sebagai playlist', [{ l: 'Nama playlist', v: 'Playlist baru' }], 'Simpan'); if (r && r[0].trim()) { newList(r[0].trim(), Q); toast('Playlist disimpan'); } };
  async function openFiles() { const items = await api('play.pick'); if (items && items.length) playList(items, 0); }
  function fsToggle() { if (document.fullscreenElement) document.exitFullscreen(); else if (cur() && cur().k === 'v') $('#ap').requestFullscreen().catch(() => {}); }
  let idleT; const wake = () => { document.body.classList.remove('idle'); clearTimeout(idleT); if (document.fullscreenElement) idleT = setTimeout(() => { if (!v.paused) document.body.classList.add('idle'); }, 2500); };
  document.addEventListener('fullscreenchange', () => { document.body.classList.toggle('fs', !!document.fullscreenElement); wake(); });
  document.addEventListener('mousemove', wake);
  document.addEventListener('keydown', e => {
    const tg = e.target, tag = tg.tagName;
    if (tag === 'TEXTAREA' || tag === 'SELECT' || (tag === 'INPUT' && tg.type !== 'range') || e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.key; let used = true; wake();
    if (k === ' ' && tag !== 'BUTTON') toggle();
    else if (k === 'ArrowLeft') v.currentTime = Math.max(0, v.currentTime - 5);
    else if (k === 'ArrowRight') v.currentTime = Math.min(v.duration || 1e9, v.currentTime + 5);
    else if (k === 'ArrowUp') { v.muted = false; v.volume = Math.min(1, v.volume + .05); }
    else if (k === 'ArrowDown') v.volume = Math.max(0, v.volume - .05);
    else if (k === 'j') v.currentTime = Math.max(0, v.currentTime - 10);
    else if (k === 'l') v.currentTime = Math.min(v.duration || 1e9, v.currentTime + 10);
    else if (k === 'm') v.muted = !v.muted;
    else if (k === 'n') next(false); else if (k === 'p') prev();
    else if (k === '[') stepRate(-1); else if (k === ']') stepRate(1); else if (k === '\\') setRate(1);
    else if (k === 's') $('#bsh').click(); else if (k === 'r') $('#brp').click(); else if (k === 'f') fsToggle();
    else used = false;
    if (used) e.preventDefault();
  });
  if ('mediaSession' in navigator) {
    const ms = navigator.mediaSession;
    [['play', () => v.play()], ['pause', () => v.pause()], ['previoustrack', prev], ['nexttrack', () => next(false)],
     ['seekbackward', () => { v.currentTime = Math.max(0, v.currentTime - 10); }], ['seekforward', () => { v.currentTime += 10; }]].forEach(([a, f]) => { try { ms.setActionHandler(a, f); } catch {} });
  }

  /* ================= tampilan pemutar ================= */
  function uiVol() { v.volume !== undefined && setRange(vol, v.muted ? 0 : Math.round(v.volume * 100)); $('#bmu').innerHTML = ICON(v.muted || v.volume === 0 ? 'mute' : 'volume'); }
  function ui() {
    const it = cur(), has = !!it;
    $('#npEmpty').hidden = has; $('#npMain').hidden = !has; $('#q').hidden = !has;
    np.dataset.k = it ? it.k : 'a';
    $('#nt').textContent = it ? base(it.n) : 'Tidak ada yang diputar'; $('#ns').textContent = it ? (it.k === 'v' ? 'Video' : 'Musik') + ' · ' + extOf(it.n) : 'AlethPlay';
    $('#an').textContent = it ? base(it.n) : '';
    document.title = it ? base(it.n) + ' — AlethPlay' : 'AlethPlay';
    $('#bpp').innerHTML = !v.paused && has ? PAUSE : PLAY;
    ['#bpp', '#bnx', '#bpv'].forEach(s => { $(s).disabled = !has; });
    $('#bsh').classList.toggle('on', !!st.shuffle);
    $('#brp').classList.toggle('on', st.repeat !== 'off'); $('#brp').innerHTML = ICON(st.repeat === 'one' ? 'repeat1' : 'repeat'); $('#brp').title = 'Ulangi: ' + ({ off: 'mati', all: 'semua', one: 'satu lagu' }[st.repeat]) + ' (R)';
    $('#bfs').hidden = $('#bpip').hidden = !(it && it.k === 'v');
    if (!has) { $('#tc').textContent = $('#td').textContent = '0:00'; setRange(seek, 0); seek.disabled = true; }
    if (has && 'mediaSession' in navigator) { try { navigator.mediaSession.metadata = new MediaMetadata({ title: base(it.n), artist: 'AlethPlay' }); navigator.mediaSession.playbackState = v.paused ? 'paused' : 'playing'; } catch {} }
    uiVol(); renderQueue(); renderMini();
  }
  function renderQueue() {
    const ql = $('#ql'); if (!Q.length) { ql.innerHTML = ''; return; }
    $('#qn').textContent = 'Antrean · ' + Q.length;
    ql.innerHTML = '';
    const from = Math.max(0, pos - 3), to = Math.min(order.length, from + 200);
    for (let k = from; k < to; k++) {
      const it = Q[order[k]], r = el(`<div class="it${k === pos ? ' now' : ''}" data-p="${esc(it.p)}"><div class="ic">${ICON(it.k === 'v' ? 'video' : 'music', 15)}</div><div class="tx"><div class="t">${esc(base(it.n))}</div></div><div class="acts"><button class="ib" title="Hapus dari antrean">${ICON('close', 15)}</button></div></div>`);
      r.onclick = (e) => { if (e.target.closest('.ib')) removeAt(k); else load(k); };
      ql.appendChild(r);
    }
  }
  function renderMini() { const p = cur() && cur().p; $$('#lv .it[data-p]').forEach(r => r.classList.toggle('now', r.dataset.p === p)); }

  /* ================= tampilan daftar gambar ================= */
  // Mode daftar = baris biasa. Mode gambar = baris yang sama dengan CSS kartu (class "grid" pada .lst); gambar dimuat malas, hanya yang terlihat.
  // Sumber gambar: musik → sampul di tag / folder (main: play.thumb); video → sampul di folder, bila tidak ada satu frame video
  // (hanya format yang bisa dibaca Chromium). Bila tidak ada → gambar default AlethPlay (.dfl).
  const gridOn = () => st.view === 'grid' || st.view === 'small';   // 'small' = kartu gambar setengah ukuran 'grid'
  const allVid = (a) => a.length > 0 && a.every(x => x.k === 'v');
  const mkBox = (wide) => { const b = el('<div></div>'); b.className = 'lst' + (gridOn() ? ' grid' : '') + (st.view === 'small' ? ' sm' : '') + (st.view === 'detail' ? ' detail' : '') + (wide ? ' wide' : ''); return b; };
  const THUMBS = new Map(), inflight = new Map(), PEND = new Set(); let io = null;
  function newObserver() {
    if (io) io.disconnect(); PEND.clear();
    const o = io = new IntersectionObserver(es => es.forEach(e => {
      if (!e.isIntersecting) return;
      o.unobserve(e.target); PEND.delete(e.target);   // baris yang belum perlu apa-apa (mis. mode daftar) dilepas; setView memasangnya lagi saat mode berganti
      if (needs(e.target)) e.target._ld && e.target._ld();
    }), { root: lv, rootMargin: '400px 0px' });
  }
  // Yang dimuat malas per baris: gambar (mode gambar / gambar kecil) dan durasi (semua mode selain daftar). Masing-masing hanya sekali per baris.
  const durOn = () => st.view !== 'list';
  const needs = (r) => (gridOn() && !r._th) || (durOn() && !r._dr);
  const DUR = new Map(), durFly = new Map(); let dBusy = 0; const dWait = [];
  function readDur(it) {   // durasi dari metadata lewat <audio>/<video> tersembunyi; gagal / tanpa durasi (siaran langsung) → 0
    return new Promise(res => {
      const x = document.createElement(it.k === 'v' ? 'video' : 'audio'); let done = false, tm = 0;
      const end = (d) => { if (done) return; done = true; clearTimeout(tm); x.onloadedmetadata = x.onerror = null; x.removeAttribute('src'); try { x.load(); } catch {} res(isFinite(d) && d > 0 ? d : 0); };
      tm = setTimeout(() => end(0), 8000);
      x.preload = 'metadata'; x.muted = true; x.onerror = () => end(0); x.onloadedmetadata = () => end(x.duration); x.src = it.u;
    });
  }
  function getDur(it) {   // maksimal 3 sekaligus
    if (DUR.has(it.p)) return Promise.resolve(DUR.get(it.p));
    if (durFly.has(it.p)) return durFly.get(it.p);
    const pr = new Promise(res => {
      const run = () => { dBusy++; readDur(it).then(d => { dBusy--; const n = dWait.shift(); if (n) n(); res(d); }); };
      dBusy < 3 ? run() : dWait.push(run);
    }).then(d => { DUR.set(it.p, d); if (DUR.size > 3000) DUR.delete(DUR.keys().next().value); durFly.delete(it.p); return d; });
    durFly.set(it.p, pr); return pr;
  }
  const setDur = (r, d) => { const t = d > 0 ? fmtT(d) : ''; $$('.dur', r).forEach(e => { e.textContent = t; }); };
  function loadRow(r, it) {
    if (gridOn() && !r._th) { r._th = 1; getThumb(it).then(u => { if (u && r.isConnected) setThumb(r, u); }); }
    if (durOn() && !r._dr) { r._dr = 1; getDur(it).then(d => { if (d && r.isConnected) setDur(r, d); }); }
  }
  function lazyMeta(r, it) {
    const c = THUMBS.get(it.p), d = DUR.get(it.p);   // sudah ada di cache: langsung dipasang, tanpa kedip
    if (gridOn() && c !== undefined) { r._th = 1; if (c) setThumb(r, c); }
    if (durOn() && d !== undefined) { r._dr = 1; if (d) setDur(r, d); }
    r._ld = () => loadRow(r, it);
    if (needs(r)) { PEND.add(r); io && io.observe(r); }
  }
  function setThumb(r, u) {
    const ic = $('.ic', r), im = $('.th', r); if (!ic || !im) return;
    im.onerror = () => ic.classList.remove('has'); im.src = u; ic.classList.add('has');
  }
  function getThumb(it) {
    if (THUMBS.has(it.p)) return Promise.resolve(THUMBS.get(it.p));
    if (inflight.has(it.p)) return inflight.get(it.p);
    const pr = (async () => {
      let u = ''; try { u = await api('play.thumb', it.p) || ''; } catch {}
      if (!u && it.k === 'v') u = await vidFrame(it);
      THUMBS.set(it.p, u); if (THUMBS.size > 1500) THUMBS.delete(THUMBS.keys().next().value);
      inflight.delete(it.p); return u;
    })();
    inflight.set(it.p, pr); return pr;
  }
  // frame video lewat <video> tersembunyi, maksimal 2 sekaligus. Gagal / codec tidak didukung / lebih dari 9 dtk → '' (pakai gambar default)
  let vBusy = 0; const vWait = [];
  const vidFrame = (it) => new Promise(res => {
    const run = () => { vBusy++; captureFrame(it).then(u => { vBusy--; const n = vWait.shift(); if (n) n(); res(u); }); };
    vBusy < 2 ? run() : vWait.push(run);
  });
  function captureFrame(it) {
    return new Promise(res => {
      const x = document.createElement('video'); let done = false, tm = 0;
      const end = (u) => { if (done) return; done = true; clearTimeout(tm); x.onloadedmetadata = x.onseeked = x.oncanplay = x.onerror = null; x.removeAttribute('src'); try { x.load(); } catch {} res(u || ''); };
      const draw = () => {
        try {
          const w = x.videoWidth, h = x.videoHeight; if (!w || !h) return end('');
          const k = Math.min(1, 320 / w), c = document.createElement('canvas'); c.width = Math.round(w * k); c.height = Math.round(h * k);
          c.getContext('2d').drawImage(x, 0, 0, c.width, c.height); end(c.toDataURL('image/jpeg', .8));
        } catch { end(''); }
      };
      tm = setTimeout(() => end(''), 9000);
      x.muted = true; x.preload = 'auto'; x.crossOrigin = 'anonymous'; x.playsInline = true;
      x.onerror = () => end('');
      x.onloadedmetadata = () => { const d = x.duration; x.currentTime = isFinite(d) && d > 0 ? Math.min(Math.max(d * .1, 1), d / 2, 60) : .1; };
      x.onseeked = () => { if (x.readyState >= 2) draw(); else x.oncanplay = draw; };
      x.src = it.u;
    });
  }
  function viewToggle() {
    const s = el(`<div class="seg" role="group" aria-label="Tampilan"><button data-v="list" title="Tampilan daftar">${ICON('list')}</button><button data-v="detail" title="Tampilan detail (tabel)">${ICON('table')}</button><button data-v="small" title="Tampilan gambar kecil">${ICON('grid3')}</button><button data-v="grid" title="Tampilan gambar">${ICON('grid')}</button></div>`);
    $$('button', s).forEach(b => { b.classList.toggle('on', b.dataset.v === st.view); b.onclick = () => setView(b.dataset.v); });
    return s;
  }
  // kepala kolom tabel (mode detail). sort(k) dipakai bila daftarnya bisa diurutkan; h._mark(k, arah) menandai kolom aktif
  function dth(sort) {
    const h = el('<div class="dth"></div>'); h.hidden = st.view !== 'detail';
    [['', '', ''], ['Judul', 'n', ''], ['Format', 'e', 'ce'], ['Durasi', '', 'r'], ['Ukuran', 's', 'r'], ['Tanggal', 'm', 'cm'], ['', '', '']].forEach(([t, k, c]) => {
      const x = el(k && sort ? `<button class="${c}" data-k="${k}"><span>${t}</span><i></i></button>` : `<span class="${c}">${t}</span>`);
      if (k && sort) x.onclick = () => sort(k); h.appendChild(x);
    });
    h._mark = (k, d) => $$('button', h).forEach(b => { const on = b.dataset.k === k; b.classList.toggle('on', on); $('i', b).textContent = on ? (d > 0 ? '▲' : '▼') : ''; });
    return h;
  }
  function onScroll() { const h = $('.dth:not([hidden])', lv); if (h) h.classList.toggle('stuck', h.getBoundingClientRect().top <= lv.getBoundingClientRect().top + 1); }
  lv.addEventListener('scroll', onScroll, { passive: true });
  function setView(v2) {
    if (st.view === v2) return; st.view = v2; saveState();
    $$('.lst', lv).forEach(b => { b.classList.toggle('grid', gridOn()); b.classList.toggle('sm', st.view === 'small'); b.classList.toggle('detail', st.view === 'detail'); });
    $$('.dth', lv).forEach(h => { h.hidden = st.view !== 'detail'; });
    $$('.seg button', lv).forEach(b => b.classList.toggle('on', b.dataset.v === st.view));
    if (io) $$('.it[data-p]', lv).forEach(r => { if (r._ld && needs(r)) { PEND.add(r); io.unobserve(r); io.observe(r); } });   // baris yang sudah terlihat tidak memicu ulang sendiri; hanya yang belum punya gambar/durasi
    onScroll();
  }

  /* ================= daftar & menu ================= */
  let pm = null; const closeMenu = () => { if (pm) { pm.remove(); pm = null; $$('.it.menu').forEach(r => r.classList.remove('menu')); } };
  document.addEventListener('mousedown', e => { if (pm && !pm.contains(e.target)) closeMenu(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeMenu(); });
  lv.addEventListener('scroll', closeMenu);
  function popMenu(anchor, entries) {
    closeMenu(); pm = el('<div class="pm"></div>');
    entries.forEach(x => {
      if (x === '-') return pm.appendChild(el('<hr>'));
      if (x.h) return pm.appendChild(el(`<div class="hh">${esc(x.h)}</div>`));
      const b = el(`<button class="${x.dg ? 'dg' : ''}">${x.ic ? ICON(x.ic, 16) : x.sp ? '<i style="display:inline-block;width:16px;flex:none"></i>' : ''}<span>${esc(x.t)}</span></button>`);
      b.onclick = () => { closeMenu(); x.fn(); }; pm.appendChild(b);
    });
    document.body.appendChild(pm);
    const a = anchor.getBoundingClientRect(), w = pm.offsetWidth, h = pm.offsetHeight;
    pm.style.left = Math.max(8, Math.min(innerWidth - w - 8, a.right - w)) + 'px';
    pm.style.top = (a.bottom + h + 8 > innerHeight ? Math.max(8, a.top - h - 4) : a.bottom + 4) + 'px';
  }
  const newId = () => 'l' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
  function newList(name, items) { const l = { id: newId(), name, items: items.map(x => ({ p: x.p, n: x.n, k: x.k })) }; lists.push(l); saveLists(); return l; }
  function addToList(l, items) { const have = new Set(l.items.map(x => x.p)); let n = 0; items.forEach(x => { if (!have.has(x.p)) { l.items.push({ p: x.p, n: x.n, k: x.k }); have.add(x.p); n++; } }); saveLists(); toast(n ? n + ' item ditambahkan ke “' + l.name + '”' : 'Sudah ada di “' + l.name + '”'); }
  function listMenu(anchor, items, after) {
    const e = lists.map(l => ({ t: l.name, ic: 'list', fn: () => { addToList(l, items); after && after(); } }));
    popMenu(anchor, [{ h: 'Tambah ke playlist' }, ...e, ...(e.length ? ['-'] : []), { t: 'Playlist baru…', ic: 'plus', fn: async () => { const r = await askText('Playlist baru', [{ l: 'Nama playlist', v: '' }], 'Buat'); if (r && r[0].trim()) { const l = newList(r[0].trim(), items); toast('Playlist “' + l.name + '” dibuat'); after && after(); } } }]);
  }
  // satu baris media. o.sub(it) = teks kedua, o.extra = item menu tambahan
  function itemRow(it, list, o = {}) {
    const p = cur() && cur().p;
    const r = el(`<div class="it${it.missing ? ' miss' : ''}${p === it.p ? ' now' : ''}${SEL.has(it.p) ? ' pk' : ''}" data-p="${esc(it.p)}"><div class="ic"><span class="ico">${ICON(it.k === 'v' ? 'video' : 'music')}</span><span class="dfl">${ICON('alethplay')}</span><img class="th" alt="" draggable="false"><span class="dur"></span><span class="ck">${ICON('check', 14)}</span></div><div class="tx"><div class="t" title="${esc(it.p)}">${esc(base(it.n))}</div><div class="s">${esc(o.sub ? o.sub(it) : extOf(it.n) + ' · ' + fmtBytes(it.s))}</div></div><div class="cl"><span class="ce">${esc(extOf(it.n))}</span><span class="cd dur"></span><span class="cs">${it.missing ? '' : fmtBytes(it.s)}</span><span class="cm">${esc(o.dtxt ? o.dtxt(it) : fmtD(it.m))}</span></div><div class="acts"><button class="ib" data-more title="Opsi">${ICON('more')}</button></div></div>`);
    r.onclick = (e) => {
      if (selMode) { if (!it.missing) selClick(it, e); return; }
      if (e.target.closest('[data-more]')) {
        r.classList.add('menu');
        const m = [];
        if (!it.missing) m.push({ t: 'Putar berikutnya', ic: 'next', fn: () => enqueue([it], true) }, { t: 'Tambah ke antrean', ic: 'queue', fn: () => enqueue([it], false) }, { t: 'Tambah ke playlist…', ic: 'list', fn: () => listMenu(e.target.closest('[data-more]'), [it]) }, { t: 'Tampilkan di folder', ic: 'folder', fn: () => api('play.reveal', it.p) });
        if (o.extra) m.push('-', ...o.extra(it));
        return popMenu(e.target.closest('[data-more]'), m);
      }
      if (it.missing) return toast('Berkas tidak ditemukan'); playList(list, list.indexOf(it));
    };
    if (!it.missing) lazyMeta(r, it);
    return r;
  }
  const head = (title, sub, extra) => { const h = el(`<div class="hd"><div><h1>${esc(title)}</h1><p class="sub">${esc(sub || '')}</p></div><div class="ex"></div></div>`); (extra || []).forEach(b => $('.ex', h).appendChild(b)); $('.ex', h).appendChild(viewToggle()); return h; };
  const btn = (ic, t, fn, cls) => { const b = el(`<button class="btn ${cls || ''}">${ic ? ICON(ic) : ''}<span>${esc(t)}</span></button>`); b.onclick = fn; return b; };
  const empty = (m, b) => { const e = el(`<div class="empty">${esc(m)}</div>`); (b || []).forEach(x => e.appendChild(el('<br>')) && e.appendChild(x)); return e; };
  // daftar bertahap (300 baris per halaman) supaya folder besar tetap ringan
  function fill(box, items, mk) {
    shown = items; const want = restoreN; restoreN = 0;   // want = jumlah baris yang sudah dibuka saat tampilan ini ditinggalkan
    let n = 0; const more = btn('', '', () => step(), 'more');
    const step = () => { items.slice(n, n + 300).forEach(it => box.insertBefore(mk(it), more)); n = Math.min(items.length, n + 300); more.hidden = n >= items.length; $('span', more).textContent = 'Tampilkan lebih banyak (' + (items.length - n) + ')'; mem().n = n; };
    box.appendChild(more); step(); while (n < want && n < items.length) step();
  }
  const playBtns = (items) => [btn('play', 'Putar semua', () => playList(items, 0), 'pri'), btn('shuffle', 'Acak', () => { const was = st.shuffle; st.shuffle = true; playList(items, Math.floor(Math.random() * items.length)); if (!was) { saveState(); } ui(); })];

  /* ================= pilih banyak ================= */
  // Tombol "Pilih" di kepala daftar → klik baris untuk mencentang (Shift = rentang), lalu aksi massal di bilah bawah. Hanya berlaku untuk daftar yang tampil (shown).
  let selMode = false, selX = null, selLast = -1, shown = []; const SEL = new Set(); const sbar = $('#sbar');
  const selItems = () => shown.filter(x => !x.missing && SEL.has(x.p));
  function updateSel() {
    const all = shown.filter(x => !x.missing), n = selItems().length;
    lv.classList.toggle('selmode', selMode);
    $$('.selbtn', lv).forEach(b => b.classList.toggle('on', selMode));
    $$('.it[data-p]', lv).forEach(r => r.classList.toggle('pk', SEL.has(r.dataset.p)));
    sbar.hidden = !(selMode && !lv.hidden); $('#scn').textContent = n + ' dipilih';
    $$('[data-a]', sbar).forEach(b => {
      const a = b.dataset.a;
      if (a === 'all') { $('span', b).textContent = all.length && n === all.length ? 'Batal pilih semua' : 'Pilih semua'; b.disabled = !all.length; }
      else if (a === 'x') { b.hidden = !selX; if (selX) $('span', b).textContent = selX.t; b.disabled = !n; }
      else if (a !== 'done') b.disabled = !n;
    });
  }
  function selExit() { selMode = false; SEL.clear(); selLast = -1; updateSel(); }
  function selAll(on) { shown.forEach(x => { if (!x.missing) on ? SEL.add(x.p) : SEL.delete(x.p); }); updateSel(); }
  function selClick(it, e) {
    const i = shown.indexOf(it);
    if (e.shiftKey && selLast >= 0 && i >= 0) { for (let k = Math.min(i, selLast); k <= Math.max(i, selLast); k++) if (!shown[k].missing) SEL.add(shown[k].p); }
    else { SEL.has(it.p) ? SEL.delete(it.p) : SEL.add(it.p); selLast = i; }
    updateSel();
  }
  function selAct(a) {
    if (a === 'done') return selExit();
    const items = selItems();
    if (a === 'all') return selAll(!(items.length && items.length === shown.filter(x => !x.missing).length));
    if (!items.length) return;
    if (a === 'play') { selExit(); return playList(items, 0); }
    if (a === 'next') { enqueue(items, true); return selExit(); }
    if (a === 'queue') { enqueue(items, false); return selExit(); }
    if (a === 'pl') return listMenu($('[data-a="pl"]', sbar), items, selExit);
    if (a === 'x' && selX) selX.fn(items);
  }
  [['all', 'Pilih semua', ''], ['play', 'Putar', 'pri'], ['next', 'Putar berikutnya', ''], ['queue', 'Tambah ke antrean', ''], ['pl', 'Ke playlist…', ''], ['x', '', 'danger'], ['done', 'Selesai', '']].forEach(([a, t, c]) => {
    const b = btn('', t, () => selAct(a), c); b.classList.add('sm'); b.dataset.a = a; if (a === 'x') b.hidden = true; sbar.appendChild(b);
  });
  const selBtn = () => { const b = btn('check', 'Pilih', () => { selMode ? selExit() : (selMode = true, updateSel()); }, 'selbtn'); b.classList.toggle('on', selMode); return b; };
  document.addEventListener('keydown', e => {
    if (!selMode || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
    if (e.key === 'Escape') { e.preventDefault(); selExit(); }
    else if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === 'a') { e.preventDefault(); selAll(true); }
  });

  /* ================= bagian ================= */
  let sec = 'np', rt = 0, lib = null, fdir = '', plId = '', lastKey = '', restoreN = 0;
  // ingatan per tampilan (Musik, Video, tiap folder, tiap playlist…): posisi scroll, jumlah baris yang dibuka, pencarian & urutan. Hanya di memori selama aplikasi berjalan.
  const M = {};
  const memKey = () => sec + (sec === 'folder' ? ':' + fdir : '') + (sec === 'pl' ? ':' + plId : '');
  const mem = () => (M[memKey()] = M[memKey()] || {});
  const saveScroll = () => { if (lastKey && !lv.hidden) (M[lastKey] = M[lastKey] || {}).top = lv.scrollTop; };
  const NV = $('#sb');
  NAV.forEach(([k, n, ic]) => { const b = el(`<button class="nv" data-s="${k}" title="${n}">${ICON(ic)}<span>${n}</span></button>`); b.onclick = () => { const fresh = k === sec && !lv.hidden; if (k === 'folder') fdir = ''; if (k === 'pl') plId = ''; go(k, fresh); }; NV.appendChild(b); });
  function go(k, fresh) {   // fresh = klik menu bagian yang sedang dibuka → kembali ke atas
    saveScroll(); if (fresh) { const m = M[memKey()]; if (m) { m.top = 0; m.n = 0; } }
    lastKey = ''; selExit(); sec = k; closeMenu(); $$('.nv', NV).forEach(b => b.classList.toggle('on', b.dataset.s === k)); np.hidden = k !== 'np'; lv.hidden = k === 'np'; if (k !== 'np') render(); }
  async function render() {
    const my = ++rt; saveScroll(); const key = memKey(); restoreN = (M[key] && M[key].n) || 0; shown = []; selX = null;
    newObserver(); lv.innerHTML = '<div class="empty">Memuat…</div>'; let nodes = [];
    try {
      if (sec === 'music' || sec === 'video') nodes = await viewLib(sec === 'music' ? 'a' : 'v');
      else if (sec === 'folder') nodes = await viewFolder();
      else if (sec === 'dl') nodes = await viewDl();
      else if (sec === 'pl') nodes = await viewLists();
      else if (sec === 'hist') nodes = await viewHist();
    } catch (e) { nodes = [empty('Gagal memuat: ' + e.message)]; }
    if (my !== rt) return; lv.innerHTML = ''; nodes.forEach(n => lv.appendChild(n)); lastKey = key; lv.scrollTop = (M[key] && M[key].top) || 0; updateSel();
  }
  async function viewLib(kind) {
    if (!lib) lib = await api('play.library') || [];
    const all = lib.filter(x => x.k === kind), title = kind === 'a' ? 'Musik' : 'Video';
    const tb = el(`<div class="tb"><label class="search">${ICON('search', 16)}<input type="search" placeholder="Cari ${title.toLowerCase()}…" autocomplete="off"></label><select><option value="n">Nama</option><option value="m">Terbaru</option><option value="s">Ukuran</option><option value="e">Format</option></select></div>`);
    const box = mkBox(kind === 'v'), q = $('input', tb), sel = $('select', tb);
    let sk = 'n', sd = 1;   // kunci & arah urut: nama naik, terbaru/ukuran turun, format naik
    const DEF = { n: 1, m: -1, s: -1, e: 1 }, CMP = { n: natural, m: (a, b) => a.m - b.m, s: (a, b) => a.s - b.s, e: (a, b) => extOf(a.n).localeCompare(extOf(b.n)) || natural(a, b) };
    const m0 = mem(); if (m0.q) q.value = m0.q; if (m0.sk) { sk = m0.sk; sd = m0.sd; sel.value = sk; }
    const hd = dth(k => { if (sk === k) sd = -sd; else { sk = k; sd = DEF[k]; } sel.value = k; draw(); });
    const draw = () => {
      const mm = mem(); mm.q = q.value; mm.sk = sk; mm.sd = sd;
      const kw = q.value.trim().toLowerCase(); let l = all.filter(x => !kw || x.n.toLowerCase().includes(kw));
      l = l.sort((a, b) => sd * CMP[sk](a, b)); hd._mark(sk, sd);
      box.innerHTML = ''; if (!l.length) return box.appendChild(empty(kw ? 'Tidak ada yang cocok dengan “' + q.value + '”.' : 'Belum ada ' + title.toLowerCase() + ' di folder yang dipindai. Tambahkan folder lewat bagian Folder, atau buka berkas langsung.'));
      fill(box, l, it => itemRow(it, l));
    };
    q.oninput = draw; sel.onchange = () => { sk = sel.value; sd = DEF[sk]; draw(); };
    const cnt = all.length + ' berkas';
    const h = head(title, cnt, [...(all.length ? [...playBtns(all.slice().sort(natural)), selBtn()] : []), btn('reload', 'Segarkan', async () => { lib = null; render(); }), btn('open', 'Buka berkas…', openFiles)]);
    draw(); return [h, tb, ...(all.length ? [hd] : []), box];
  }
  async function viewFolder() {
    if (!fdir) {
      const src = await api('play.sources') || [], box = mkBox();
      src.forEach(s => { const r = el(`<div class="it"><div class="ic">${ICON('folder', 18)}</div><div class="tx"><div class="t">${esc(s.n)}</div><div class="s">${esc(s.p)}</div></div><div class="acts">${s.user ? `<button class="ib" title="Hapus dari daftar">${ICON('close', 16)}</button>` : ''}</div></div>`);
        r.onclick = async (e) => { if (e.target.closest('.ib')) { await api('play.removeFolder', s.p); lib = null; return render(); } fdir = s.p; render(); }; box.appendChild(r); });
      return [head('Folder', 'Telusuri folder di perangkat', [btn('plus', 'Tambah folder…', async () => { const r = await api('play.addFolder'); if (r) { lib = null; render(); } }, 'pri')]), box];
    }
    const d = await api('play.dir', fdir); if (!d) { fdir = ''; return [empty('Folder tidak bisa dibuka.')]; }
    const box = mkBox(allVid(d.files));
    d.dirs.forEach(f => { const r = el(`<div class="it"><div class="ic">${ICON('folder', 18)}</div><div class="tx"><div class="t">${esc(f.n)}</div></div></div>`); r.onclick = () => { fdir = f.p; render(); }; box.appendChild(r); });
    fill(box, d.files, it => itemRow(it, d.files));
    if (!d.dirs.length && !d.files.length) box.appendChild(empty('Tidak ada subfolder atau berkas musik/video di sini.'));
    const back = el(`<button class="back">${ICON('arrowleft')}<span>${d.parent ? 'Folder induk' : 'Semua folder'}</span></button>`); back.onclick = () => { fdir = d.parent; render(); };
    return [back, head(d.dir.split(/[\\/]/).filter(Boolean).pop() || d.dir, d.files.length + ' berkas · ' + d.dirs.length + ' subfolder', d.files.length ? [...playBtns(d.files), selBtn()] : []), ...(d.files.length ? [dth()] : []), box];
  }
  async function viewDl() {
    const items = await api('play.downloads') || [], box = mkBox(allVid(items));
    if (!items.length) box.appendChild(empty('Belum ada musik atau video yang diunduh lewat Alethra.')); else fill(box, items, it => itemRow(it, items, { sub: x => extOf(x.n) + ' · ' + fmtBytes(x.s) + ' · ' + when(x.m) }));
    return [head('Unduhan', items.length + ' berkas media', items.length ? [...playBtns(items), selBtn()] : []), ...(items.length ? [dth()] : []), box];
  }
  async function viewHist() {
    const items = hist.length ? await api('play.resolve', hist.map(x => x.p)) || [] : [], box = mkBox(allVid(items));
    const at = new Map(hist.map(x => [x.p, x.t]));
    selX = { t: 'Hapus dari riwayat', fn: (its) => { const s = new Set(its.map(x => x.p)); hist = hist.filter(h => !s.has(h.p)); saveHist(); selExit(); render(); } };
    if (!items.length) box.appendChild(empty('Belum ada riwayat pemutaran.')); else fill(box, items, it => itemRow(it, items, { sub: x => (x.missing ? 'Berkas tidak ditemukan · ' : extOf(x.n) + ' · ') + when(at.get(x.p)), dtxt: x => when(at.get(x.p)), extra: x => [{ t: 'Hapus dari riwayat', ic: 'eraser', fn: () => { hist = hist.filter(h => h.p !== x.p); saveHist(); render(); } }] }));
    return [head('Riwayat', items.length + ' diputar terakhir', [...(items.length ? [selBtn(), btn('trash', 'Hapus riwayat', async () => { if (await askConfirm('Hapus riwayat pemutaran?', 'Berkas di komputer tidak ikut terhapus.', 'Hapus', true)) { hist = []; saveHist(); render(); } })] : [])]), ...(items.length ? [dth()] : []), box];
  }
  async function viewLists() {
    const mkNew = btn('plus', 'Playlist baru', async () => { const r = await askText('Playlist baru', [{ l: 'Nama playlist', v: '' }], 'Buat'); if (r && r[0].trim()) { plId = newList(r[0].trim(), []).id; render(); } }, 'pri');
    const l = lists.find(x => x.id === plId);
    if (!l) {
      plId = ''; const box = mkBox();
      if (!lists.length) box.appendChild(empty('Belum ada playlist. Buat satu, atau pilih “Tambah ke playlist” pada lagu atau video.'));
      lists.forEach(x => { const r = el(`<div class="it"><div class="ic">${ICON('list', 18)}</div><div class="tx"><div class="t">${esc(x.name)}</div><div class="s">${x.items.length} item</div></div></div>`); r.onclick = () => { plId = x.id; render(); }; box.appendChild(r); });
      return [head('Playlist', lists.length + ' playlist', [mkNew]), box];
    }
    const items = l.items.length ? await api('play.resolve', l.items.map(x => x.p)) || [] : [], box = mkBox(allVid(items));
    selX = { t: 'Hapus dari playlist', fn: (its) => { const s = new Set(its.map(x => x.p)); l.items = l.items.filter(y => !s.has(y.p)); saveLists(); selExit(); render(); } };
    if (!items.length) box.appendChild(empty('Playlist ini kosong. Tambahkan lagu atau video lewat menu ⋮ pada daftar.'));
    else fill(box, items, it => itemRow(it, items, { sub: x => x.missing ? 'Berkas tidak ditemukan' : extOf(x.n) + ' · ' + fmtBytes(x.s), extra: x => [{ t: 'Hapus dari playlist', ic: 'eraser', fn: () => { l.items = l.items.filter(y => y.p !== x.p); saveLists(); render(); } }] }));
    const back = el(`<button class="back">${ICON('arrowleft')}<span>Semua playlist</span></button>`); back.onclick = () => { plId = ''; render(); };
    const acts = [...(items.length ? [...playBtns(items), selBtn()] : []),
      btn('edit', 'Ganti nama', async () => { const r = await askText('Ganti nama playlist', [{ l: 'Nama playlist', v: l.name }], 'Simpan'); if (r && r[0].trim()) { l.name = r[0].trim().slice(0, 80); saveLists(); render(); } }),
      btn('trash', 'Hapus', async () => { if (await askConfirm('Hapus playlist “' + l.name + '”?', 'Berkas musik/video tidak ikut terhapus.', 'Hapus', true)) { lists = lists.filter(x => x !== l); saveLists(); plId = ''; render(); } })];
    return [back, head(l.name, l.items.length + ' item', acts), ...(items.length ? [dth()] : []), box];
  }

  /* ================= awal ================= */
  alethra.on('downloads', deb(() => { if (sec === 'dl') render(); }, 600));
  async function takePending() { const items = await api('play.pending'); if (items && items.length) playList(items, 0); }   // file yang dibuka dari Unduhan/Windows/Folder
  alethra.on('play-open', takePending);
  v.volume = Math.max(0, Math.min(1, st.vol)); v.muted = !!st.muted; setRate(st.rate, true);
  ui(); go('np'); takePending();
})();
