(async function () {
  await pageInit();
  const app = $('#app'); let q = '';
  app.innerHTML = `<h1>Histori</h1><p class="sub">Situs yang pernah Anda kunjungi (tidak mencatat tab Incognito).</p>
  <div class="bar"><div class="search">${ICON('search', 18)}<input id="q" placeholder="Cari histori"></div><button class="btn danger" id="clr">${ICON('trash', 16)} Hapus semua</button></div><div id="l"></div>`;
  const day0 = (t) => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };
  function label(t) { const T = day0(Date.now()), d = day0(t); if (d === T) return 'Hari ini'; if (d === T - 864e5) return 'Kemarin'; return new Date(t).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }); }
  async function load() {
    const L = await api('hist.list', q) || []; const el = $('#l'); el.innerHTML = '';
    if (!L.length) { el.innerHTML = '<div class="list"><div class="empty">Tidak ada riwayat.</div></div>'; return; }
    let cur = '', box = null;
    L.forEach(h => {
      const lb = label(h.ts); if (lb !== cur) { cur = lb; el.insertAdjacentHTML('beforeend', `<div class="group">${esc(lb)}</div>`); box = document.createElement('div'); box.className = 'list'; el.appendChild(box); }
      const r = document.createElement('div'); r.className = 'row'; r.appendChild(fav(h.u, h.t));
      const tx = document.createElement('div'); tx.className = 'tx'; tx.innerHTML = `<div class="t">${esc(h.t || h.u)}</div><div class="s">${esc(h.u)}</div>`; tx.onclick = () => api('nav.to', h.u); tx.onauxclick = e => { if (e.button === 1) api('nav.open', h.u, true); };
      const tm = document.createElement('div'); tm.className = 's'; tm.textContent = new Date(h.ts).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
      const a = document.createElement('div'); a.className = 'acts'; a.innerHTML = `<button class="ib" title="Hapus">${ICON('close', 17)}</button>`; a.firstChild.onclick = async () => { await api('hist.remove', h.ts, h.u); load(); };
      r.append(tx, tm, a); box.appendChild(r);
    });
  }
  $('#q').oninput = e => { q = e.target.value; load(); };
  $('#clr').onclick = async () => { if (await askConfirm('Hapus semua histori?', 'Tindakan ini tidak bisa dibatalkan.', 'Hapus', true)) { await api('hist.clear'); load(); } };
  load();
})();
