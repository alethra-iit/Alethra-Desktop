(function () {
  // Mini browser melayang. UI ini hidup di WebContentsView sendiri (bilah atas, daftar situs, pegangan ukuran);
  // isi situs ada di view terpisah yang diatur main.js lewat api('mini.*'). Posisi, ukuran, dan mode ikon juga diatur main.js.
  const box = $('#box'), ico = $('#ico');
  let S = { url: '', title: '', loading: false, back: false, fwd: false, mobile: true, sites: [] }, min = false, ready = false;
  let addr = null, ld = null, title = null, startEl = null, btn = {};

  const hostOf = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return u; } };
  const isSaved = () => S.url && S.sites.some(x => x.u === S.url);

  function dragger(el, kind, onClick) {
    let d = null;
    el.addEventListener('pointerdown', e => {
      if (e.button !== 0 || e.target.closest('button,input')) return;
      d = { x: e.screenX, y: e.screenY, id: e.pointerId, on: false };
      try { el.setPointerCapture(e.pointerId); } catch {}
      e.preventDefault();
    });
    el.addEventListener('pointermove', e => {
      if (!d || e.pointerId !== d.id) return;
      const dx = e.screenX - d.x, dy = e.screenY - d.y;
      if (!d.on) { if (onClick && Math.abs(dx) + Math.abs(dy) < 5) return; d.on = true; el.classList.add('drag'); api('mini.drag', 'start'); }
      api('mini.drag', kind, dx, dy);
    });
    const end = e => {
      if (!d || e.pointerId !== d.id) return;
      const was = d; d = null; el.classList.remove('drag');
      try { el.releasePointerCapture(e.pointerId); } catch {}
      if (was.on) api('mini.drag', 'end'); else if (onClick && e.type === 'pointerup') onClick();
    };
    el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end);
  }

  function build() {
    box.innerHTML = `<div class="mh" id="mh">${ICONM('mini', 18)}<span class="t" id="mt">Mini browser</span>
        <button class="mb" id="bStar" title="Simpan ke favorit" aria-label="Simpan ke favorit">${ICON('star', 18)}</button>
        <button class="mb" id="bMob" title="Tampilan ponsel (nyala) / desktop (mati)" aria-label="Tampilan ponsel">${ICON('phone', 18)}</button>
        <button class="mb" id="bTab" title="Buka di tab biasa" aria-label="Buka di tab biasa">${ICON('external', 18)}</button>
        <button class="mb" id="bMin" title="Perkecil" aria-label="Perkecil">${ICON('minus', 18)}</button>
        <button class="mb" id="bX" title="Tutup" aria-label="Tutup">${ICON('close', 18)}</button></div>
      <div class="mr"><button class="mb" id="bBack" title="Mundur" aria-label="Mundur">${ICON('back', 18)}</button>
        <button class="mb" id="bFwd" title="Maju" aria-label="Maju">${ICON('fwd', 18)}</button>
        <button class="mb" id="bRel" title="Muat ulang" aria-label="Muat ulang">${ICON('reload', 18)}</button>
        <button class="mb" id="bHome" title="Daftar situs" aria-label="Daftar situs">${ICON('home', 18)}</button>
        <input id="ad" type="text" autocomplete="off" spellcheck="false" placeholder="Ketik alamat atau pencarian" aria-label="Alamat"></div>
      <div class="ld" id="ld"></div>
      <div id="st"></div>
      <div class="mf"><div class="rz" id="rz" title="Ubah ukuran" aria-label="Ubah ukuran">${ICON('resize', 12)}</div></div>`;
    addr = $('#ad'); ld = $('#ld'); title = $('#mt'); startEl = $('#st');
    ['bStar', 'bMob', 'bTab', 'bMin', 'bX', 'bBack', 'bFwd', 'bRel', 'bHome'].forEach(k => { btn[k] = $('#' + k); });
    btn.bX.onclick = () => api('mini.close');
    btn.bMin.onclick = () => api('mini.min');
    btn.bTab.onclick = () => api('mini.totab');
    btn.bBack.onclick = () => api('mini.back');
    btn.bFwd.onclick = () => api('mini.fwd');
    btn.bRel.onclick = () => api('mini.reload');
    btn.bHome.onclick = () => api('mini.home');
    btn.bMob.onclick = () => api('mini.mobile', !S.mobile);
    btn.bStar.onclick = () => {
      if (!S.url) return;
      if (isSaved()) api('mini.site.del', S.url); else api('mini.site.add', S.title || hostOf(S.url), S.url);
    };
    addr.addEventListener('keydown', e => {
      if (e.key === 'Enter') { const v = addr.value.trim(); if (v) { api('mini.go', v); addr.blur(); } }
      if (e.key === 'Escape') { addr.value = S.url || ''; addr.blur(); }
    });
    addr.addEventListener('focus', () => addr.select());
    dragger($('#mh'), 'move');
    dragger($('#rz'), 'resize');
  }

  function renderStart() {
    startEl.hidden = !!S.url;
    if (S.url) return;
    startEl.innerHTML = `<h4>Situs favorit</h4>`;
    if (!S.sites.length) startEl.insertAdjacentHTML('beforeend', `<div class="hint">Belum ada favorit. Buka sebuah situs, lalu ketuk ${ICON('star', 14)} untuk menyimpannya di sini.</div>`);
    S.sites.forEach(x => {
      const r = document.createElement('div'); r.className = 'si'; r.tabIndex = 0; r.setAttribute('role', 'button');
      const fv = document.createElement('div'); fv.className = 'fv'; fv.textContent = ((x.n || hostOf(x.u) || '?')[0] || '?').toUpperCase();
      const h = hostOf(x.u);
      if (h) { const im = new Image(); im.onload = () => { fv.textContent = ''; fv.appendChild(im); }; im.src = 'https://www.google.com/s2/favicons?domain=' + encodeURIComponent(h) + '&sz=32'; }
      const tx = document.createElement('div'); tx.className = 'tx'; tx.innerHTML = `<div class="n">${esc(x.n)}</div><div class="u">${esc(h)}</div>`;
      const del = document.createElement('button'); del.className = 'x'; del.title = 'Hapus dari favorit'; del.setAttribute('aria-label', 'Hapus ' + x.n); del.innerHTML = ICON('close', 14);
      del.onclick = (e) => { e.stopPropagation(); api('mini.site.del', x.u); };
      r.append(fv, tx, del);
      r.onclick = () => api('mini.go', x.u);
      r.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); api('mini.go', x.u); } };
      startEl.appendChild(r);
    });
    startEl.insertAdjacentHTML('beforeend', `<div class="hint">Atau ketik alamat / pencarian di kolom atas. Situs dibuka dengan sesi yang sama seperti tab biasa, jadi login tetap berlaku.</div>`);
  }

  function render() {
    if (!ready) return;
    title.textContent = S.url ? (S.title || hostOf(S.url)) : 'Mini browser';
    if (document.activeElement !== addr) addr.value = S.url || '';
    btn.bBack.disabled = !S.url; btn.bFwd.disabled = !S.fwd; btn.bRel.disabled = !S.url; btn.bTab.disabled = !S.url; btn.bStar.disabled = !S.url; btn.bHome.disabled = !S.url;
    btn.bRel.innerHTML = ICON(S.loading ? 'close' : 'reload', 18); btn.bRel.title = S.loading ? 'Berhenti' : 'Muat ulang';
    btn.bMob.classList.toggle('on', !!S.mobile);
    btn.bStar.classList.toggle('on', !!isSaved()); btn.bStar.title = isSaved() ? 'Hapus dari favorit' : 'Simpan ke favorit';
    ld.classList.toggle('on', !!S.loading);
    renderStart();
  }

  function setMode(m) {
    min = !!m;
    if (!ready) return;
    box.hidden = min; ico.hidden = !min;
    ico.innerHTML = ICONM('mini', 22) + (S.url ? '<i></i>' : '');
    if (!min && !S.url && addr) addr.focus();
  }

  async function init() {
    const st = await api('settings.get'); if (st) applyTheme(st);
    alethra.on('settings', s => applyTheme(s));
    S = Object.assign(S, await api('mini.state') || {});
    build(); ready = true; setMode(S.min); render();
    dragger(ico, 'move', () => api('mini.restore'));
    ico.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); api('mini.restore'); } });
    alethra.on('mini.state', s => { S = Object.assign(S, s || {}); if (S.min !== min) setMode(S.min); else if (min) ico.innerHTML = ICONM('mini', 22) + (S.url ? '<i></i>' : ''); render(); });
    alethra.on('mini.mode', m => setMode(m && m.min));
    alethra.on('mini.addr', () => { if (addr && !min) { addr.focus(); addr.select(); } });
  }
  init();
})();
