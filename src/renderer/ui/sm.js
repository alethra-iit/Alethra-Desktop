(function () {
  // Sound Master melayang. UI ini hanya tampilan; pengaturan per tab diterapkan main.js (api 'sm.*') lewat mesin inject/sm.js.
  const box = $('#box'), ico = $('#ico');
  let tabs = [], showAll = false, min = false, ready = false, list, cnt;

  function dragger(el, kind, onClick) {
    let d = null;
    el.addEventListener('pointerdown', e => {
      if (e.button !== 0 || e.target.closest('button,select,input,textarea,label')) return;
      d = { x: e.screenX, y: e.screenY, id: e.pointerId, on: false };
      try { el.setPointerCapture(e.pointerId); } catch {}
      e.preventDefault();
    });
    el.addEventListener('pointermove', e => {
      if (!d || e.pointerId !== d.id) return;
      const dx = e.screenX - d.x, dy = e.screenY - d.y;
      if (!d.on) { if (onClick && Math.abs(dx) + Math.abs(dy) < 5) return; d.on = true; el.classList.add('drag'); api('sm.drag', 'start'); }
      api('sm.drag', kind, dx, dy);
    });
    const end = e => {
      if (!d || e.pointerId !== d.id) return;
      const was = d; d = null; el.classList.remove('drag');
      try { el.releasePointerCapture(e.pointerId); } catch {}
      if (was.on) api('sm.drag', 'end'); else if (onClick && e.type === 'pointerup') onClick();
    };
    el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end);
  }

  const clamp = (v, a, b) => Math.max(a, Math.min(b, Math.round(+v) || 0));
  const PRE = [0, 100, 200, 300, 400, 600];
  function card(t) {
    const hot = t.v > 300;
    const bad = t.bad > 0 && (t.v !== 100 || t.b > 0 || t.voice);
    const sub = t.audible ? (t.muted ? 'Berbunyi (tab dibisukan)' : 'Sedang berbunyi') : (t.active ? 'Tab aktif' : 'Tidak berbunyi');
    return `<div class="mc${t.active ? ' act' : ''}" data-id="${t.id}">
      <div class="mt" tabindex="0" role="button" title="Pindah ke tab ini" aria-label="Pindah ke tab ${esc(t.title)}">
        ${t.icon ? `<img src="${esc(t.icon)}" alt="">` : ICON(t.audible ? 'volume' : 'mute', 16)}
        <span class="nm"><b>${esc(t.title)}</b><span>${esc((t.host ? t.host + ' · ' : '') + sub)}${t.incog ? ' · Incognito' : ''}</span></span>
        ${t.audible && !t.muted ? '<span class="eq" aria-hidden="true"><i></i><i></i><i></i></span>' : ''}
      </div>
      ${t.web ? `<div class="mg">
        <div class="vr"><label for="v${t.id}">Volume</label><input type="range" id="v${t.id}" class="rv" min="0" max="600" step="1" value="${t.v}" aria-label="Volume tab, 0 sampai 600 persen">
          <span class="nv${hot ? ' hot' : ''}"><input type="number" class="nvi" min="0" max="600" step="1" value="${t.v}" aria-label="Volume dalam persen">%</span></div>
        <div class="pr">${PRE.map(p => `<button data-p="${p}" class="${t.v === p ? 'on' : ''}">${p}%</button>`).join('')}</div>
        <div class="vr"><label for="b${t.id}">Bass</label><input type="range" id="b${t.id}" class="rb" min="0" max="100" step="1" value="${t.b}" aria-label="Bass boost, 0 sampai 100 persen">
          <span class="nv"><input type="number" class="nbi" min="0" max="100" step="1" value="${t.b}" aria-label="Bass boost dalam persen">%</span></div>
        <div class="vt"><label class="l" for="s${t.id}">Voice boost<small>Dialog dan podcast lebih jelas</small></label>
          <span class="sw"><input type="checkbox" id="s${t.id}" class="vb"${t.voice ? ' checked' : ''}><i></i></span></div>
      </div>
      ${bad ? '<div class="wn">Sebagian suara di tab ini tidak bisa diatur (berasal dari server lain tanpa izin CORS, atau ber-DRM).</div>' : ''}
      ${t.susp ? '<div class="wn">Mesin audio tertahan oleh browser. Klik halaman sekali atau putar ulang videonya.</div>' : ''}
      ${t.v !== 100 || t.b || t.voice ? '<div class="mr"><button class="rs">Atur ulang</button></div>' : ''}` : '<div class="wn" style="margin-top:0">Halaman ini bukan situs web, jadi suaranya tidak bisa diatur.</div>'}
    </div>`;
  }
  function render() {
    if (!list) return;
    const act = document.activeElement, keep = act && act.closest && act.closest('.mc') ? { id: act.closest('.mc').dataset.id, cls: act.className, type: act.type } : null;
    const sc = list.scrollTop;
    list.innerHTML = tabs.length ? tabs.map(card).join('')
      : `<div class="em">Belum ada tab yang berbunyi.<br>Putar video atau musik di sebuah tab, lalu tab itu muncul di sini. Centang <b>Semua tab</b> di bawah untuk mengatur tab yang belum berbunyi.</div>`;
    list.scrollTop = sc;
    cnt.textContent = tabs.filter(t => t.audible).length + ' tab berbunyi';
    $('#all').checked = showAll;
    if (keep && !/^number$/.test(keep.type)) { const el = list.querySelector(`.mc[data-id="${keep.id}"] .${String(keep.cls).split(' ')[0]}`); if (el && el.focus) el.focus(); }
  }
  function send(id, p) { return api('sm.set', id, p); }
  function wireList() {
    list.addEventListener('click', e => {
      const c = e.target.closest('.mc'); if (!c) return; const id = +c.dataset.id;
      if (e.target.closest('.pr button')) { const v = +e.target.closest('.pr button').dataset.p; send(id, { v }); return; }
      if (e.target.closest('.rs')) { api('sm.reset', id); return; }
      if (e.target.closest('.mt')) api('sm.switch', id);
    });
    list.addEventListener('keydown', e => {
      if ((e.key === 'Enter' || e.key === ' ') && e.target.classList.contains('mt')) { e.preventDefault(); api('sm.switch', +e.target.closest('.mc').dataset.id); }
      if (e.key === 'Enter' && e.target.type === 'number') e.target.blur();
    });
    // geser slider: tampilkan angka langsung, kirim ke main tiap perubahan (ringan: hanya satu pesan kecil)
    list.addEventListener('input', e => {
      const c = e.target.closest('.mc'); if (!c) return; const id = +c.dataset.id, el = e.target;
      if (el.classList.contains('rv')) { const v = clamp(el.value, 0, 600); c.querySelector('.nvi').value = v; c.querySelector('.nv').classList.toggle('hot', v > 300); c.querySelectorAll('.pr button').forEach(b => b.classList.toggle('on', +b.dataset.p === v)); send(id, { v }); }
      else if (el.classList.contains('rb')) { const b = clamp(el.value, 0, 100); c.querySelector('.nbi').value = b; send(id, { b }); }
      else if (el.classList.contains('vb')) send(id, { voice: el.checked });
    });
    list.addEventListener('change', e => {
      const c = e.target.closest('.mc'); if (!c) return; const id = +c.dataset.id, el = e.target;
      if (el.classList.contains('nvi')) { const v = clamp(el.value, 0, 600); el.value = v; c.querySelector('.rv').value = v; send(id, { v }); }
      else if (el.classList.contains('nbi')) { const b = clamp(el.value, 0, 100); el.value = b; c.querySelector('.rb').value = b; send(id, { b }); }
    });
  }
  // render dari main ditunda selagi slider/angka sedang dipakai, supaya tidak mengganggu geseran
  let busy = false, pending = null;
  function incoming(st) {
    if (!st) return;
    tabs = st.tabs || []; showAll = !!st.all;
    if (busy) { pending = true; return; }
    render();
  }
  function build() {
    box.innerHTML = `<div class="mh" id="mh">${ICONM('sm', 18)}<span class="t">Sound Master</span>
        <button class="mb" id="bMin" title="Perkecil" aria-label="Perkecil">${ICON('minus', 18)}</button>
        <button class="mb" id="bX" title="Tutup" aria-label="Tutup">${ICON('close', 18)}</button></div>
      <div id="ml"></div>
      <div class="mf"><label><input type="checkbox" id="all"><span>Semua tab</span></label><span id="cnt"></span>
        <div class="rz" id="rz" title="Tarik untuk mengubah ukuran" aria-label="Ubah ukuran">${ICON('resize', 12)}</div></div>`;
    list = $('#ml'); cnt = $('#cnt');
    $('#bX').onclick = () => api('sm.close'); $('#bMin').onclick = () => api('sm.min');
    $('#all').onchange = e => api('sm.all', e.target.checked);
    list.addEventListener('pointerdown', e => { if (e.target.matches('input[type=range]')) busy = true; });
    window.addEventListener('pointerup', () => { if (busy) { busy = false; if (pending) { pending = null; render(); } } });
    list.addEventListener('focusin', e => { if (e.target.type === 'number') busy = true; });
    list.addEventListener('focusout', e => { if (e.target.type === 'number') { busy = false; if (pending) { pending = null; render(); } } });
    box.addEventListener('keydown', e => { if (e.key === 'Escape') api('sm.close'); });
    wireList();
    dragger($('#mh'), 'move'); dragger($('#rz'), 'resize');
  }
  function setMode(m) {
    min = !!m;
    if (!ready) return;
    box.hidden = min; ico.hidden = !min;
  }
  async function init() {
    const st = await api('settings.get'); if (st) applyTheme(st);
    alethra.on('settings', s => applyTheme(s));
    const r = await api('sm.state') || {};
    ico.innerHTML = ICONM('sm', 22);
    build(); ready = true; setMode(r.min); incoming(r);
    dragger(ico, 'move', () => api('sm.restore'));
    ico.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); api('sm.restore'); } });
    alethra.on('sm.mode', m => setMode(m && m.min));
    alethra.on('sm.state', incoming);
  }
  init();
})();
