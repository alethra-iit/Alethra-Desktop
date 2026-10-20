(async function () {
  await pageInit();
  const app = $('#app'); let L = [], f = 0;
  app.innerHTML = `<h1>Unduhan</h1><p class="sub" id="loc"></p><div class="bar" id="chips"></div><div class="bar"><button class="btn" id="clr">Bersihkan daftar</button></div><div class="list" id="l"></div>`;
  const FIL = ['Semua', 'Berlangsung', 'Selesai', 'Gagal'];
  const stateOf = d => d.state === 'progressing' || d.state === 'paused' ? 1 : d.state === 'completed' ? 2 : 3;
  function render() {
    $('#chips').innerHTML = ''; FIL.forEach((n, i) => { const c = document.createElement('button'); c.className = 'chip' + (f === i ? ' on' : ''); c.textContent = n; c.onclick = () => { f = i; render(); }; $('#chips').appendChild(c); });
    const el = $('#l'); el.innerHTML = ''; const X = L.filter(d => !f || stateOf(d) === f);
    if (!X.length) { el.innerHTML = '<div class="empty">Belum ada unduhan.</div>'; return; }
    X.forEach(d => {
      const r = document.createElement('div'); r.className = 'row';
      const pct = d.total ? Math.round(d.received * 100 / d.total) : 0;
      const stt = { progressing: d.total ? `${pct}% · ${fmtBytes(d.received)} / ${fmtBytes(d.total)}` : fmtBytes(d.received), paused: 'Dijeda · ' + pct + '%', completed: fmtBytes(d.total || d.received) + ' · Selesai', cancelled: 'Dibatalkan', interrupted: 'Gagal / terputus' }[d.state];
      r.innerHTML = `<div class="fav">${ICON('file', 18)}</div><div class="tx"><div class="t">${esc(d.name)}</div><div class="s">${esc(stt)}${d.incog ? ' · Incognito' : ''}</div>${d.state === 'progressing' || d.state === 'paused' ? `<div class="prog"><i style="width:${pct}%"></i></div>` : ''}</div><div class="acts" style="opacity:1"></div>`;
      const a = r.lastChild, B = (ic, t, fn) => { const b = document.createElement('button'); b.className = 'ib'; b.title = t; b.innerHTML = ICON(ic, 17); b.onclick = e => { e.stopPropagation(); fn(); }; a.appendChild(b); };
      if (d.state === 'progressing') { B('pause', 'Jeda', () => api('dl.act', d.id, 'pause')); B('close', 'Batalkan', () => api('dl.act', d.id, 'cancel')); }
      else if (d.state === 'paused') { B('play', 'Lanjutkan', () => api('dl.act', d.id, 'resume')); B('close', 'Batalkan', () => api('dl.act', d.id, 'cancel')); }
      else if (d.state === 'completed') { B('open', 'Buka berkas', () => api('dl.act', d.id, 'open')); B('folder', 'Tampilkan di folder', () => api('dl.act', d.id, 'show')); B('trash', 'Hapus dari daftar', () => api('dl.act', d.id, 'remove')); }
      else { B('reload', 'Ulangi', () => api('dl.act', d.id, 'retry')); B('trash', 'Hapus dari daftar', () => api('dl.act', d.id, 'remove')); }
      if (d.state === 'completed') r.querySelector('.tx').onclick = () => api('dl.act', d.id, 'open');
      el.appendChild(r);
    });
  }
  $('#clr').onclick = () => api('dl.act', 0, 'clear');
  const S = await api('settings.get'); $('#loc').textContent = 'Lokasi simpan: ' + S.dlDirShown;
  alethra.on('downloads', l => { L = l; render(); });
  L = await api('dl.list') || []; render();
})();
