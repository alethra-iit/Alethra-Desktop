(async function () {
  await pageInit();
  const app = $('#app'); let list = [], folder = null, q = '';
  app.innerHTML = `<h1>Bookmark</h1><p class="sub">Simpan situs favorit Anda.</p>
  <div class="bar"><div class="search">${ICON('search', 18)}<input id="q" placeholder="Cari bookmark"></div><button class="btn" id="add">${ICON('plus', 16)} Tambah</button><button class="btn" id="imp">Impor</button><button class="btn" id="exp">Ekspor</button></div>
  <div class="bar" id="chips"></div><div class="list" id="l"></div>`;
  async function load() {
    const r = await api('bm.list');
    if (r && r.locked) { $('#l').innerHTML = `<div class="empty">${ICON('lock', 34)}<p>Bookmark dikunci.</p><button class="btn pri" id="un">Buka kunci</button></div>`; $('#chips').innerHTML = ''; $('#un').onclick = load; return; }
    list = r || []; render();
  }
  function render() {
    const folders = {}; list.forEach(b => { if (b.f) folders[b.f] = (folders[b.f] || 0) + 1; });
    if (folder && !folders[folder]) folder = null;
    $('#chips').innerHTML = '';
    const mk = (n, label) => { const c = document.createElement('button'); c.className = 'chip' + (folder === n ? ' on' : ''); c.textContent = label; c.onclick = () => { folder = n; render(); }; $('#chips').appendChild(c); };
    if (Object.keys(folders).length) { mk(null, 'Semua (' + list.length + ')'); Object.keys(folders).forEach(f => mk(f, f + ' (' + folders[f] + ')')); }
    const ql = q.toLowerCase(), L = list.filter(b => (!folder || b.f === folder) && (!ql || (b.t || '').toLowerCase().includes(ql) || b.u.toLowerCase().includes(ql)));
    const el = $('#l'); el.innerHTML = '';
    if (!L.length) { el.innerHTML = '<div class="empty">Belum ada bookmark.</div>'; return; }
    L.forEach(b => {
      const r = document.createElement('div'); r.className = 'row';
      r.appendChild(fav(b.u, b.t));
      const tx = document.createElement('div'); tx.className = 'tx'; tx.innerHTML = `<div class="t">${esc(b.t || b.u)}</div><div class="s">${esc(b.u)}${b.f ? ' · ' + esc(b.f) : ''}</div>`;
      tx.onclick = () => api('nav.to', b.u); tx.onauxclick = e => { if (e.button === 1) api('nav.open', b.u, true); };
      r.appendChild(tx);
      const a = document.createElement('div'); a.className = 'acts';
      a.innerHTML = `<button class="ib" title="Ubah">${ICON('edit', 17)}</button><button class="ib" title="Hapus">${ICON('trash', 17)}</button>`;
      a.children[0].onclick = async () => { const v = await askText('Ubah bookmark', [{ l: 'Judul', v: b.t }, { l: 'Alamat', v: b.u }, { l: 'Folder (kosongkan jika tidak ada)', v: b.f }]); if (v) { await api('bm.update', b.id, v[0], v[1], v[2].trim()); load(); } };
      a.children[1].onclick = async () => { await api('bm.remove', b.id); load(); };
      r.appendChild(a); el.appendChild(r);
    });
  }
  $('#q').oninput = e => { q = e.target.value; render(); };
  $('#add').onclick = async () => { const v = await askText('Tambah bookmark', [{ l: 'Judul' }, { l: 'Alamat', p: 'contoh.com' }, { l: 'Folder (opsional)' }], 'Tambah'); if (v && v[1]) { const ok = await api('bm.add', v[0], v[1], v[2].trim()); if (!ok) alert('Alamat tidak valid atau sudah ada.'); load(); } };
  $('#exp').onclick = () => api('bm.export');
  $('#imp').onclick = async () => { const n = await api('bm.import'); if (n >= 0) { alert(n + ' bookmark diimpor.'); load(); } };
  alethra.on('bookmarks', load); load();
})();
