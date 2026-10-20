(async function () {
  await pageInit();
  const app = $('#app');
  app.innerHTML = `<h1>Kata sandi</h1><p class="sub">Tersimpan terenkripsi (Windows DPAPI). Tidak disimpan dari tab Incognito.</p><div class="list" id="l"></div>`;
  async function load() {
    const r = await api('pw.list'); const el = $('#l');
    if (r && r.locked) { el.innerHTML = `<div class="empty">${ICON('lock', 34)}<p>Kata sandi dikunci.</p><button class="btn pri" id="un">Buka kunci</button></div>`; $('#un').onclick = load; return; }
    el.innerHTML = ''; if (!r || !r.length) { el.innerHTML = '<div class="empty">Belum ada kata sandi tersimpan.</div>'; return; }
    r.forEach(x => {
      const row = document.createElement('div'); row.className = 'row'; row.appendChild(fav(x.o));
      const tx = document.createElement('div'); tx.className = 'tx'; tx.style.cursor = 'default'; tx.innerHTML = `<div class="t">${esc(x.o.replace(/^https?:\/\//, ''))}</div><div class="s">${esc(x.u || '(tanpa nama pengguna)')}</div>`;
      const a = document.createElement('div'); a.className = 'acts'; a.style.opacity = 1;
      a.innerHTML = `<button class="ib" title="Tampilkan / sembunyikan">${ICON('key', 17)}</button><button class="ib" title="Salin sandi">${ICON('copy', 17)}</button><button class="ib" title="Hapus">${ICON('trash', 17)}</button>`;
      let shown = false; a.children[0].onclick = async () => { const s = tx.querySelector('.s'); if (shown) { s.textContent = x.u || '(tanpa nama pengguna)'; shown = false; return; } const p = await api('pw.reveal', x.i); if (p != null) { s.textContent = (x.u ? x.u + ' · ' : '') + p; shown = true; } };
      a.children[1].onclick = async () => { const p = await api('pw.reveal', x.i); if (p != null) { await navigator.clipboard.writeText(p).catch(() => {}); } };
      a.children[2].onclick = async () => { if (await askConfirm('Hapus sandi ini?', x.o, 'Hapus', true)) { await api('pw.delete', x.i); load(); } };
      row.append(tx, a); el.appendChild(row);
    });
  }
  load();
})();
