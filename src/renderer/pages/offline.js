(async function () {
  await pageInit();
  const app = $('#app'); let q = '';
  app.innerHTML = `<h1>Halaman offline</h1><p class="sub">Halaman yang disimpan (MHTML + PDF) agar bisa dibaca tanpa internet. Simpan lewat menu ⋮ → Simpan halaman offline (Ctrl+S).</p><div class="bar"><div class="search">${ICON('search', 18)}<input id="q" placeholder="Cari halaman offline"></div></div><div class="list" id="l"></div>`;
  async function load() {
    const L = (await api('off.list') || []).filter(x => !q || (x.title + x.url).toLowerCase().includes(q.toLowerCase())); const el = $('#l'); el.innerHTML = '';
    if (!L.length) { el.innerHTML = '<div class="empty">Belum ada halaman offline.</div>'; return; }
    L.forEach(x => {
      const r = document.createElement('div'); r.className = 'row'; r.appendChild(fav(x.url, x.title));
      const tx = document.createElement('div'); tx.className = 'tx'; tx.innerHTML = `<div class="t">${esc(x.title)}</div><div class="s">${esc(x.url)} · ${new Date(x.time).toLocaleString('id-ID')}</div>`; tx.onclick = () => api('off.act', x.id, 'open');
      const a = document.createElement('div'); a.className = 'acts'; a.style.opacity = 1;
      [['file', 'Buka PDF', 'pdf', !!x.pdf], ['globe', 'Buka versi online', 'online', true], ['folder', 'Tampilkan di folder', 'show', true], ['trash', 'Hapus', 'delete', true]].forEach(([ic, t, act, on]) => { if (!on) return; const b = document.createElement('button'); b.className = 'ib'; b.title = t; b.innerHTML = ICON(ic, 17); b.onclick = async () => { await api('off.act', x.id, act); if (act === 'delete') load(); }; a.appendChild(b); });
      r.append(tx, a); el.appendChild(r);
    });
  }
  $('#q').oninput = e => { q = e.target.value; load(); }; load();
})();
