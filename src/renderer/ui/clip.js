(function () {
  // Riwayat clipboard melayang. Daftar dikirim main.js (event 'ch.state'); posisi/ukuran/mode ikon diatur main.js lewat api('ch.*').
  const box = $('#box'), ico = $('#ico');
  let S = { list: [], paused: false }, min = false, ready = false, q = '', listEl = null, stEl = null, qEl = null, bPause = null, bClear = null;

  const ago = (ts) => {
    const s = Math.max(0, (Date.now() - ts) / 1000);
    if (s < 45) return 'baru saja'; if (s < 3600) return Math.round(s / 60) + ' mnt lalu';
    if (s < 86400) return Math.round(s / 3600) + ' jam lalu'; return Math.round(s / 86400) + ' hari lalu';
  };
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
      if (!d.on) { if (onClick && Math.abs(dx) + Math.abs(dy) < 5) return; d.on = true; el.classList.add('drag'); api('ch.drag', 'start'); }
      api('ch.drag', kind, dx, dy);
    });
    const end = e => {
      if (!d || e.pointerId !== d.id) return;
      const was = d; d = null; el.classList.remove('drag');
      try { el.releasePointerCapture(e.pointerId); } catch {}
      if (was.on) api('ch.drag', 'end'); else if (onClick && e.type === 'pointerup') onClick();
    };
    el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end);
  }
  function build() {
    box.innerHTML = `<div class="ch" id="ch">${ICONM('clips', 18)}<span class="t">Riwayat clipboard</span>
        <button class="cb" id="bP" title="Jeda perekaman" aria-label="Jeda perekaman">${ICON('pause', 18)}</button>
        <button class="cb" id="bC" title="Hapus riwayat (item sematan tetap)" aria-label="Hapus riwayat">${ICON('trash', 18)}</button>
        <button class="cb" id="bM" title="Perkecil" aria-label="Perkecil">${ICON('minus', 18)}</button>
        <button class="cb" id="bX" title="Tutup" aria-label="Tutup">${ICON('close', 18)}</button></div>
      <div class="cs"><input id="q" type="search" autocomplete="off" spellcheck="false" placeholder="Cari di riwayat" aria-label="Cari di riwayat"></div>
      <div id="cl"></div>
      <div class="cf"><span class="st" id="st"></span><div class="rz" id="rz" title="Ubah ukuran" aria-label="Ubah ukuran">${ICON('resize', 14)}</div></div>`;
    listEl = $('#cl'); stEl = $('#st'); qEl = $('#q'); bPause = $('#bP'); bClear = $('#bC');
    $('#bX').onclick = () => api('ch.close'); $('#bM').onclick = () => api('ch.min');
    bPause.onclick = () => api('ch.pause'); bClear.onclick = () => api('ch.clear');
    qEl.oninput = () => { q = qEl.value.trim().toLowerCase(); renderList(); };
    qEl.addEventListener('keydown', e => { if (e.key === 'Escape') { if (qEl.value) { qEl.value = ''; q = ''; renderList(); } else api('ch.close'); } });
    dragger($('#ch'), 'move'); dragger($('#rz'), 'resize');
  }
  function flash(row, msg) {
    const o = document.createElement('div'); o.className = 'ok'; o.textContent = msg; row.appendChild(o); setTimeout(() => o.remove(), 700);
  }
  function renderList() {
    if (!listEl) return;
    const items = S.list.filter(x => !q || x.t.toLowerCase().includes(q));
    listEl.innerHTML = '';
    if (!items.length) {
      listEl.innerHTML = `<div class="em">${S.list.length ? 'Tidak ada yang cocok.' : (S.paused ? 'Perekaman dijeda.' : 'Belum ada yang disalin.<br>Salin teks dari mana saja, nanti muncul di sini.')}</div>`;
    }
    items.forEach(x => {
      const r = document.createElement('div'); r.className = 'ci' + (x.pin ? ' pin' : ''); r.tabIndex = 0; r.setAttribute('role', 'button');
      r.title = 'Ketuk untuk menyalin';
      r.innerHTML = `<div class="bd"><div class="tx">${esc(x.t)}</div><div class="mt">${x.pin ? 'Disematkan · ' : ''}${x.n.toLocaleString('id-ID')} karakter · ${ago(x.ts)}</div></div>
        <div class="ac"><button class="ab" data-a="paste" title="Tempel ke halaman" aria-label="Tempel ke halaman">${ICON('paste', 15)}</button>
        <button class="ab pn" data-a="pin" title="${x.pin ? 'Lepas sematan' : 'Sematkan'}" aria-label="${x.pin ? 'Lepas sematan' : 'Sematkan'}">${ICON('pin', 15)}</button>
        <button class="ab" data-a="del" title="Hapus" aria-label="Hapus">${ICON('close', 15)}</button></div>`;
      const act = async (a) => {
        if (a === 'paste') { await api('ch.paste', x.id); return; }
        if (a === 'pin') { await api('ch.pin', x.id); return; }
        if (a === 'del') { await api('ch.del', x.id); return; }
        await api('ch.copy', x.id); flash(r, 'Disalin ✓');
      };
      r.onclick = (e) => { const b = e.target.closest('.ab'); act(b ? b.dataset.a : 'copy'); };
      r.onkeydown = (e) => { if ((e.key === 'Enter' || e.key === ' ') && e.target === r) { e.preventDefault(); act('copy'); } if (e.key === 'Delete' && e.target === r) act('del'); };
      listEl.appendChild(r);
    });
    stEl.textContent = (S.paused ? 'Dijeda · ' : 'Merekam · ') + S.list.length + ' item';
    bPause.innerHTML = ICON(S.paused ? 'play' : 'pause', 18); bPause.classList.toggle('on', !!S.paused);
    bPause.title = S.paused ? 'Lanjutkan perekaman' : 'Jeda perekaman';
    bClear.disabled = !S.list.some(x => !x.pin);
  }
  function setMode(m) {
    min = !!m;
    if (!ready) return;
    box.hidden = min; ico.hidden = !min;
    if (!min && qEl) qEl.focus();
  }
  async function init() {
    const st = await api('settings.get'); if (st) applyTheme(st);
    alethra.on('settings', s => applyTheme(s));
    S = Object.assign(S, await api('ch.state') || {});
    ico.innerHTML = ICONM('clips', 22);
    build(); ready = true; setMode(S.min); renderList();
    dragger(ico, 'move', () => api('ch.restore'));
    ico.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); api('ch.restore'); } });
    alethra.on('ch.state', s => { S = Object.assign(S, s || {}); renderList(); });
    alethra.on('ch.mode', m => setMode(m && m.min));
    alethra.on('ch.focus', () => { if (qEl && !min) qEl.focus(); });
    setInterval(() => { if (!min && ready) renderList(); }, 30000);   // segarkan "x mnt lalu"
  }
  init();
})();
