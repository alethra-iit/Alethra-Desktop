(function () {
  // Penerjemah melayang. UI ini hanya tampilan; penerjemahan dilakukan main.js lewat api('xl.run') memakai mesin dari Pengaturan.
  const box = $('#box'), ico = $('#ico'), MAX = 5000;
  let langs = {}, pair = { s: 'auto', t: 'id' }, min = false, ready = false, seq = 0, timer = null, detected = '';
  let sSel, tSel, inp, out, status, bCopy, bPaste, bSwap, bClearIn;

  const nm = (c) => langs[c] || c;
  function dragger(el, kind, onClick, axis) {
    let d = null;
    el.addEventListener('pointerdown', e => {
      if (e.button !== 0 || e.target.closest('button,select,input,textarea')) return;
      d = { x: e.screenX, y: e.screenY, id: e.pointerId, on: false };
      try { el.setPointerCapture(e.pointerId); } catch {}
      e.preventDefault();
    });
    el.addEventListener('pointermove', e => {
      if (!d || e.pointerId !== d.id) return;
      const dx = e.screenX - d.x, dy = e.screenY - d.y;
      if (!d.on) { if (onClick && Math.abs(dx) + Math.abs(dy) < 5) return; d.on = true; el.classList.add('drag'); api('xl.drag', 'start'); }
      api('xl.drag', kind, axis === 'y' ? 0 : dx, axis === 'x' ? 0 : dy);
    });
    const end = e => {
      if (!d || e.pointerId !== d.id) return;
      const was = d; d = null; el.classList.remove('drag');
      try { el.releasePointerCapture(e.pointerId); } catch {}
      if (was.on) api('xl.drag', 'end'); else if (onClick && e.type === 'pointerup') onClick();
    };
    el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end);
  }
  function fillSelects() {
    const o = Object.keys(langs).map(c => `<option value="${esc(c)}">${esc(langs[c])}</option>`).join('');
    sSel.innerHTML = `<option value="auto">Deteksi otomatis${detected ? ' (' + esc(nm(detected)) + ')' : ''}</option>` + o;
    tSel.innerHTML = o; sSel.value = pair.s; tSel.value = pair.t;
  }
  function build() {
    box.innerHTML = `<div class="xh" id="xh">${ICONM('xl', 18)}<span class="t">Penerjemah</span>
        <button class="xb" id="bMin" title="Perkecil" aria-label="Perkecil">${ICON('minus', 18)}</button>
        <button class="xb" id="bX" title="Tutup" aria-label="Tutup">${ICON('close', 18)}</button></div>
      <div class="xl"><select id="sSel" aria-label="Bahasa asal"></select>
        <button class="xb" id="bSwap" title="Tukar bahasa" aria-label="Tukar bahasa">${ICONM('swap', 18)}</button>
        <select id="tSel" aria-label="Bahasa tujuan"></select></div>
      <div class="xp"><textarea id="inp" dir="auto" spellcheck="false" maxlength="${MAX}" placeholder="Ketik atau tempel teks di sini" aria-label="Teks asal"></textarea>
        <div class="xt"><span class="s" id="cnt">0 / ${MAX}</span>
          <button id="bPasteIn" title="Tempel dari clipboard">${ICON('paste', 14)}Tempel</button>
          <button id="bClr" title="Hapus teks">${ICON('close', 14)}Hapus</button></div></div>
      <div class="xp"><div class="xo" id="out" dir="auto" data-ph="Hasil terjemahan muncul di sini" aria-live="polite"></div>
        <div class="xt"><span class="s" id="st"></span>
          <button id="bCopy" title="Salin hasil" disabled>${ICON('copy', 14)}Salin</button>
          <button id="bPaste" title="Tempel hasil ke halaman aktif" disabled>${ICON('paste', 14)}Tempel ke halaman</button></div></div>
      <div class="xf"></div>
      <div class="rr" id="rr" title="Tarik untuk mengubah lebar"></div><div class="rb" id="rb" title="Tarik untuk mengubah tinggi"></div>
      <div class="rz" id="rz" title="Tarik untuk mengubah ukuran" aria-label="Ubah ukuran">${ICON('resize', 12)}</div>`;
    sSel = $('#sSel'); tSel = $('#tSel'); inp = $('#inp'); out = $('#out'); status = $('#st');
    bCopy = $('#bCopy'); bPaste = $('#bPaste'); bSwap = $('#bSwap'); bClearIn = $('#bClr');
    fillSelects();
    $('#bX').onclick = () => api('xl.close'); $('#bMin').onclick = () => api('xl.min');
    sSel.onchange = () => { pair.s = sSel.value; detected = ''; fillSelects(); savePair(); if (inp.value.trim()) run(); };
    tSel.onchange = () => { pair.t = tSel.value; savePair(); if (inp.value.trim()) run(); };
    bSwap.onclick = swap;
    inp.addEventListener('input', () => { $('#cnt').textContent = inp.value.length + ' / ' + MAX; schedule(); });
    inp.addEventListener('keydown', e => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); run(); }
      if (e.key === 'Escape') api('xl.close');
    });
    $('#bPasteIn').onclick = async () => { const t = await api('xl.readclip'); if (t) { inp.value = t; inp.dispatchEvent(new Event('input')); inp.focus(); run(); } };
    bClearIn.onclick = () => { inp.value = ''; inp.dispatchEvent(new Event('input')); showOut('', false); inp.focus(); };
    bCopy.onclick = async () => { if (out.textContent) { await api('xl.copy', out.textContent); flash('Disalin ✓'); } };
    bPaste.onclick = async () => { if (out.textContent) await api('xl.paste', out.textContent); };
    dragger($('#xh'), 'move'); dragger($('#rz'), 'resize'); dragger($('#rr'), 'resize', null, 'x'); dragger($('#rb'), 'resize', null, 'y');
  }
  const savePair = () => api('xl.pair', pair.s, pair.t);
  let ft = null;
  function flash(msg) { const old = status.dataset.keep || ''; status.textContent = msg; clearTimeout(ft); ft = setTimeout(() => { status.textContent = old; }, 1200); }
  function showOut(text, isErr, info) {
    out.textContent = text; out.classList.toggle('err', !!isErr);
    bCopy.disabled = bPaste.disabled = !text || !!isErr;
    status.dataset.keep = info || ''; status.textContent = info || '';
  }
  function schedule() {
    clearTimeout(timer);
    if (!inp.value.trim()) { seq++; showOut('', false); return; }
    timer = setTimeout(run, 650);
  }
  async function run() {
    clearTimeout(timer);
    const text = inp.value;
    if (!text.trim()) { seq++; showOut('', false); return; }
    const my = ++seq; status.dataset.keep = ''; status.textContent = 'Menerjemahkan…';
    const r = await api('xl.run', text, pair.s, pair.t);
    if (my !== seq) return;
    if (!r || !r.ok) { showOut((r && r.err) || 'Terjemahan gagal', true); return; }
    if (pair.s === 'auto' && r.src && r.src !== detected) { detected = r.src; const v = sSel.value; fillSelects(); sSel.value = v; }
    const bits = []; if (r.engine) bits.push(r.engine); if (pair.s === 'auto' && r.src) bits.push('dari ' + nm(r.src));
    showOut(r.text || '', false, bits.join(' · ') + (r.notice ? ' · ' + r.notice : ''));
  }
  function swap() {
    const ns = pair.t, nt = pair.s === 'auto' ? detected : pair.s;
    if (!nt) { flash('Pilih bahasa asal dulu'); return; }
    const res = out.textContent; pair = { s: ns, t: nt }; detected = '';
    fillSelects(); savePair();
    if (res && !out.classList.contains('err')) { inp.value = res; inp.dispatchEvent(new Event('input')); }
    run();
  }
  function setMode(m) {
    min = !!m;
    if (!ready) return;
    box.hidden = min; ico.hidden = !min;
    if (!min && inp) inp.focus();
  }
  async function init() {
    const st = await api('settings.get'); if (st) applyTheme(st);
    alethra.on('settings', s => applyTheme(s));
    const r = await api('xl.state') || {}; langs = r.langs || {}; if (r.pair) pair = r.pair;
    ico.innerHTML = ICONM('xl', 22);
    build(); ready = true; setMode(r.min);
    dragger(ico, 'move', () => api('xl.restore'));
    ico.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); api('xl.restore'); } });
    alethra.on('xl.mode', m => setMode(m && m.min));
    alethra.on('xl.focus', sel => {
      if (min || !inp) return; inp.focus();
      if (sel) { inp.value = sel; inp.dispatchEvent(new Event('input')); run(); } else inp.select();   // teks yang disorot di halaman langsung diterjemahkan
    });
  }
  init();
})();
