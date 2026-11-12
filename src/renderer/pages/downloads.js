(async function () {
  await pageInit();
  const app = $('#app'); let L = [], f = 0, q = '';
  app.innerHTML = `<div class="dlc">
    <div class="dlh"><div class="ico">${ICON('download')}</div>
      <div class="tt"><h1>Unduhan</h1><p class="sub">Kelola file yang telah Anda unduh</p><div class="loc" id="loc"></div></div>
      <label class="dls">${ICON('search', 20)}<input id="q" type="search" placeholder="Cari di unduhan…" autocomplete="off"></label></div>
    <div class="dlt" id="tabs"></div><div class="dll" id="l"></div>
    <div class="dlf"><div class="cn" id="cn"></div><button class="btn" id="clr">${ICON('trash', 20)} Hapus semua</button></div></div>`;
  const FIL = [['Semua', 'grid'], ['Selesai', 'check'], ['Berlangsung', 'pause'], ['Gagal', 'close']];
  // 0 semua · 1 selesai · 2 berlangsung · 3 gagal
  const stateOf = d => d.state === 'completed' ? 1 : d.state === 'progressing' || d.state === 'paused' ? 2 : 3;
  const cnt = i => L.filter(d => !i || stateOf(d) === i).length;
  let menu = null; const closeMenu = () => { if (menu) { menu.remove(); menu = null; } };
  document.addEventListener('mousedown', e => { if (menu && !menu.contains(e.target) && !e.target.closest('[data-more]')) closeMenu(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeMenu(); });
  const act = (d, a) => api('dl.act', d.id, a);
  const sameDay = (t) => { const x = new Date(t); return x.toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); };

  function tabs() {
    const t = $('#tabs'); t.innerHTML = '';
    FIL.forEach(([n, ic], i) => { const b = document.createElement('button'); b.className = 'tab' + (f === i ? ' on' : ''); b.innerHTML = `${ICON(ic)}<span>${n}${i === 0 ? ` (${cnt(0)})` : cnt(i) ? ` (${cnt(i)})` : ''}</span>`; b.onclick = () => { f = i; closeMenu(); render(); }; t.appendChild(b); });
  }
  function openMenu(d, anchor) {
    closeMenu(); const m = document.createElement('div'); m.className = 'mn';
    const add = (ic, t, fn, cls) => { const b = document.createElement('button'); if (cls) b.className = cls; b.innerHTML = ICON(ic) + '<span>' + t + '</span>'; b.onclick = e => { e.stopPropagation(); closeMenu(); fn(); }; m.appendChild(b); };
    if (d.state === 'completed' && d.path && !d.missing) add('open', 'Buka berkas', () => act(d, 'open'));
    if (d.path) add('folder', 'Tampilkan di folder', () => act(d, 'show'));
    if (d.url && /^https?:/.test(d.url)) add('copy', 'Salin tautan unduhan', async () => { await api('clip.write', d.url); });
    if (d.state === 'completed' || d.state === 'cancelled' || d.state === 'interrupted') add('reload', 'Unduh ulang', () => act(d, 'retry'));
    if (d.state === 'progressing') add('pause', 'Jeda', () => act(d, 'pause'));
    if (d.state === 'paused') add('play', 'Lanjutkan', () => act(d, 'resume'));
    if (d.state === 'progressing' || d.state === 'paused') add('close', 'Batalkan', () => act(d, 'cancel'));
    add('eraser', 'Hapus dari daftar', () => act(d, 'remove'));
    if (d.state === 'completed' && d.path && !d.missing) add('trash', 'Hapus berkas dari komputer', async () => { if (await askConfirm('Hapus berkas?', d.name + '\n\nBerkas akan dipindahkan ke Sampah dan dihapus dari daftar.', 'Hapus', true)) { await act(d, 'trash'); act(d, 'remove'); } }, 'dg');
    anchor.closest('.it').appendChild(m); menu = m;
  }
  function render() {
    tabs(); const el = $('#l'); el.innerHTML = '';
    const kw = q.trim().toLowerCase();
    const X = L.filter(d => (!f || stateOf(d) === f) && (!kw || (d.name || '').toLowerCase().includes(kw) || (d.url || '').toLowerCase().includes(kw)));
    const done = cnt(1), run = cnt(2);
    $('#cn').innerHTML = `<span class="ck">${ICON('check')}</span><span>${run ? `${run} berlangsung · ` : ''}${done} file selesai</span>`;
    $('#clr').disabled = !L.some(d => d.state !== 'progressing' && d.state !== 'paused');
    if (!X.length) { el.innerHTML = `<div class="empty">${kw ? 'Tidak ada unduhan yang cocok dengan “' + esc(q) + '”.' : 'Belum ada unduhan.'}</div>`; return; }
    X.forEach(d => {
      const r = document.createElement('div'); r.className = 'it' + (d.state === 'completed' && !d.missing ? ' ok' : '');
      const pct = d.total ? Math.round(d.received * 100 / d.total) : 0;
      const live = d.state === 'progressing' || d.state === 'paused';
      let st, cls = '';
      if (d.state === 'completed') { st = d.missing ? 'Berkas tidak ditemukan' : 'Selesai'; cls = d.missing ? 'warn' : ''; }
      else if (d.state === 'progressing') st = d.total ? `${pct}% · ${fmtBytes(d.received)} / ${fmtBytes(d.total)}` : 'Mengunduh… ' + fmtBytes(d.received);
      else if (d.state === 'paused') st = 'Dijeda · ' + pct + '%';
      else if (d.state === 'cancelled') { st = 'Dibatalkan'; cls = 'bad'; } else { st = 'Gagal / terputus'; cls = 'bad'; }
      const size = d.state === 'completed' ? fmtBytes(d.total || d.received) : '';
      const bar = d.state === 'completed' ? `<div class="pb"><i style="width:100%"></i></div>` : live ? `<div class="pb ${d.state === 'paused' ? 'pz' : ''}"><i style="width:${d.total ? pct : 8}%"></i></div>` : `<div class="pb bad"><i style="width:${pct}%"></i></div>`;
      r.innerHTML = `<div class="fi">${FILEICON(d.name, 40)}</div><div class="tx"><div class="t" title="${esc(d.name)}">${esc(d.name)}</div><div class="s">${size ? esc(size) + '<span class="dot"></span>' : ''}<span class="st ${cls}">${esc(st)}</span>${d.incog ? '<span class="dot"></span><span>Incognito</span>' : ''}<span class="dot"></span><span>${esc(sameDay(d.time))}</span></div>${bar}</div><div class="ac"></div>`;
      const a = r.lastChild, B = (ic, t, fn, more) => { const b = document.createElement('button'); b.title = t; b.innerHTML = ICON(ic); if (more) b.setAttribute('data-more', ''); b.onclick = e => { e.stopPropagation(); fn(b); }; a.appendChild(b); };
      if (d.state === 'progressing') B('pause', 'Jeda', () => act(d, 'pause'));
      else if (d.state === 'paused') B('play', 'Lanjutkan', () => act(d, 'resume'));
      else if (d.state !== 'completed') B('reload', 'Ulangi', () => act(d, 'retry'));
      if (d.state === 'completed') { if (d.path) B('folder', 'Tampilkan di folder', () => act(d, 'show')); if (!d.missing) B('open', 'Buka berkas', () => act(d, 'open')); }
      else if (live) B('close', 'Batalkan', () => act(d, 'cancel'));
      B('more', 'Opsi lain', b => { if (menu && menu.parentNode === r) closeMenu(); else openMenu(d, b); }, true);
      if (d.state === 'completed' && !d.missing) r.querySelector('.tx').onclick = () => act(d, 'open');
      el.appendChild(r);
    });
  }
  $('#q').oninput = e => { q = e.target.value; closeMenu(); render(); };
  $('#clr').onclick = async () => {
    const n = L.filter(d => d.state !== 'progressing' && d.state !== 'paused').length; if (!n) return;
    if (await askConfirm('Hapus semua riwayat unduhan?', n + ' item akan dihapus dari daftar. Berkas di komputer tidak ikut terhapus.', 'Hapus semua', true)) api('dl.act', 0, 'clear');
  };
  const S = await api('settings.get'); $('#loc').textContent = 'Lokasi simpan: ' + S.dlDirShown;
  alethra.on('downloads', l => { L = l; if (!menu) render(); else { tabs(); } });
  L = await api('dl.list') || []; render();
})();
