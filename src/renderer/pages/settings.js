(async function () {
  let built = false, sec = (location.hash || '#umum').slice(1), S = {};
  S = await pageInit(s => { S = s; if (built) renderSec(false); });
  const SECS = [['umum', 'Umum', 'settings'], ['mesin', 'Mesin pencari', 'search'], ['privasi', 'Privasi & Keamanan', 'shield'], ['tampilan', 'Tampilan', 'image'], ['unduhan', 'Unduhan', 'download'], ['terjemah', 'Penerjemah', 'translate'], ['cadangan', 'Cadangan', 'copy'], ['tentang', 'Tentang', 'globe']];
  $('#side').innerHTML = '<h2>Pengaturan</h2>'; SECS.forEach(([k, l, ic]) => { const b = document.createElement('button'); b.dataset.k = k; b.innerHTML = ICON(ic, 18) + esc(l); b.onclick = () => { sec = k; history.replaceState(null, '', '#' + k); renderSec(true); }; $('#side').appendChild(b); });
  const set = (k, v) => api('settings.set', k, v);
  const el = (h) => { const t = document.createElement('div'); t.innerHTML = h.trim(); return t.firstChild; };
  const box = (rows) => { const l = document.createElement('div'); l.className = 'list'; rows.forEach(r => l.appendChild(r)); return l; };
  const row = (title, desc, ctl) => { const r = el(`<div class="set"><div class="tx"><div>${esc(title)}</div>${desc ? `<div class="d">${esc(desc)}</div>` : ''}</div></div>`); if (ctl) r.appendChild(ctl); return r; };
  const toggle = (k, title, desc, inv) => { const c = el(`<label class="sw"><input type="checkbox"><i></i></label>`); const i = c.firstChild; i.checked = inv ? !S[k] : !!S[k]; i.onchange = () => set(k, inv ? !i.checked : i.checked); return row(title, desc, c); };
  const select = (title, desc, opts, val, fn) => { const s = document.createElement('select'); opts.forEach(([v, l]) => { const o = document.createElement('option'); o.value = v; o.textContent = l; if (String(v) === String(val)) o.selected = true; s.appendChild(o); }); s.onchange = () => fn(s.value); return row(title, desc, s); };
  const button = (title, desc, label, fn, cls) => { const b = document.createElement('button'); b.className = 'btn sm ' + (cls || ''); b.textContent = label; b.onclick = fn; return row(title, desc, b); };
  const grp = (t) => el(`<div class="group">${esc(t)}</div>`);
  const main = $('#main');

  async function renderSec(scroll) {
    $$('#side button').forEach(b => b.classList.toggle('on', b.dataset.k === sec));
    const keep = main.scrollTop || window.scrollY; main.innerHTML = '';
    const title = SECS.find(x => x[0] === sec)[1]; main.appendChild(el(`<h1>${esc(title)}</h1>`));
    const A = (n) => main.appendChild(n);
    if (sec === 'umum') {
      A(box([
        toggle('restore', 'Lanjutkan sesi sebelumnya', 'Buka kembali tab terakhir saat Alethra dimulai'),
        toggle('bmbar', 'Tampilkan bilah bookmark', 'Ctrl+Shift+B'),
        button('Jadikan browser default', 'Membuka pengaturan "Aplikasi default" Windows (pilih Alethra untuk HTTP/HTTPS)', 'Buka pengaturan', () => api('defaultBrowser.open'))
      ]));
      A(grp('Situs & halaman')); A(box([
        button('Kelola izin situs', 'Kamera, mikrofon, lokasi, notifikasi per situs', 'Kelola', () => { sec = 'privasi'; renderSec(true); setTimeout(() => $('#perms') && $('#perms').scrollIntoView(), 100); }),
        button('Halaman offline', 'Daftar halaman yang disimpan', 'Buka', () => api('nav.open', 'alethra://offline')),
        button('Kata sandi tersimpan', '', 'Buka', () => api('nav.open', 'alethra://passwords'))
      ]));
    }
    if (sec === 'mesin') {
      const opts = Object.entries(S.engines).map(([k, v]) => [k, v.n]).concat([['custom', 'Kustom…']]);
      const rows = [select('Mesin pencari utama', 'Dipakai di bilah alamat dan beranda', opts, S.engine, v => set('engine', v))];
      if (S.engine === 'custom') { const i = document.createElement('input'); i.className = 'inp'; i.style.width = '320px'; i.placeholder = 'https://situs.com/cari?q=%s'; i.value = S.customEngine || ''; i.onchange = () => set('customEngine', i.value.trim()); rows.push(row('Alamat pencarian kustom', 'Gunakan %s untuk kata kunci', i)); }
      rows.push(toggle('suggest', 'Saran saat mengetik', 'Dari bookmark dan riwayat (tidak dikirim ke mesin pencari)'));
      A(box(rows));
    }
    if (sec === 'privasi') {
      const dohOpts = Object.entries(S.doh_list).map(([k, v]) => [k, v[0]]);
      const rows = [select('DNS aman (DoH)', 'Terjemahkan nama situs lewat HTTPS. Membantu menembus pemblokiran DNS & melindungi dari pelacakan DNS.', dohOpts, S.doh, v => set('doh', v))];
      if (S.doh === 'custom') { const i = document.createElement('input'); i.className = 'inp'; i.style.width = '320px'; i.placeholder = 'https://…/dns-query'; i.value = S.dohcustom || ''; i.onchange = () => set('dohcustom', i.value.trim()); rows.push(row('Alamat DoH kustom', 'Harus diawali https://', i)); }
      rows.push(toggle('httpsOnly', 'Selalu gunakan HTTPS', 'Alihkan otomatis http:// ke https://'), toggle('tpc', 'Blokir cookie pihak ketiga', 'Selalu diblokir di tab Incognito'), toggle('dnt', 'Kirim sinyal "Jangan Lacak"', 'Mengirim header DNT dan Global Privacy Control'));
      A(box(rows));
      A(grp('Blokir iklan')); A(box([toggle('adblock', 'Blokir iklan YouTube', 'Melewati iklan video dan menyembunyikan slot iklan'), toggle('sadblock', 'Blokir iklan situs web', 'Menyembunyikan banner & memblokir jaringan iklan umum. Bisa dimatikan per situs lewat menu ⋮')]));
      A(grp('Data')); A(box([button('Hapus data penjelajahan', 'Histori, cookie, cache, unduhan, dll. (Ctrl+Shift+Del)', 'Hapus…', clearDlg, 'danger')]));
      A(grp('Kunci aplikasi (PIN)')); A(await lockUI());
      A(el('<div class="group" id="perms">Izin situs</div>')); A(await permsUI());
    }
    if (sec === 'tampilan') {
      A(box([select('Tema', '', [['system', 'Ikuti sistem'], ['light', 'Terang'], ['dark', 'Gelap']], S.theme, v => set('theme', v)), toggle('amoled', 'Mode AMOLED', 'Latar hitam pekat saat tema gelap')]));
      const sw = el('<div class="sws"></div>');
      ['', '#2F6BFF', '#7C4DFF', '#E91E63', '#F44336', '#FF9800', '#2E9E5B', '#00A3A3'].forEach(c => { const b = document.createElement('button'); b.className = 'swc' + ((S.accent || '') === c ? ' on' : ''); b.style.background = c || 'linear-gradient(135deg,#fff 50%,#111 50%)'; b.title = c || 'Hitam/putih'; b.onclick = () => set('accent', c); sw.appendChild(b); });
      const ci = document.createElement('input'); ci.className = 'inp'; ci.style.width = '110px'; ci.placeholder = '#RRGGBB'; ci.value = S.accent || ''; ci.onchange = () => set('accent', ci.value.trim().toUpperCase()); sw.appendChild(ci);
      A(grp('Warna aksen')); A(box([row('Warna aksen', 'Dipakai pada tombol, tab Incognito & beranda', sw)]));
      const C = Object.assign({ c: 'analog', p: 'mid', z: 1, k: 't', al: 'c', d2: 0, h24: true, q: false, y: true, n: true, b: true }, S.clock || {});
      const sc = (k, v) => { C[k] = v; set('clock', Object.assign({}, C)); };
      const ck = (k, t, d) => { const c = el(`<label class="sw"><input type="checkbox"><i></i></label>`); c.firstChild.checked = !!C[k]; c.firstChild.onchange = () => sc(k, c.firstChild.checked); return row(t, d, c); };
      A(grp('Beranda'));
      A(box([toggle('logo', 'Tampilkan logo'), toggle('grad', 'Gradasi warna latar'),
        button('Wallpaper', S.wall ? 'Wallpaper aktif' : 'Pilih gambar sebagai latar beranda', 'Pilih gambar…', () => api('wall.pick')),
        S.wall ? button('Hapus wallpaper', '', 'Hapus', () => api('wall.clear'), 'danger') : row('', '', null),
        select('Keburaman wallpaper', '', [[0, 'Tipis'], [1, 'Sedang'], [2, 'Tebal']], S.dim, v => set('dim', +v))].filter(r => r.textContent !== '')));
      A(grp('Jam')); A(box([
        select('Gaya jam', '', [['analog', 'Analog + teks'], ['dial', 'Jam dinding'], ['digital', 'Digital'], ['text', 'Teks'], ['bar', 'Bilah'], ['off', 'Mati']], C.c, v => sc('c', v)),
        select('Perataan', '', [['c', 'Tengah'], ['l', 'Kiri'], ['r', 'Kanan']], C.al, v => sc('al', v)),
        select('Ukuran', '', [[0, 'Kecil'], [1, 'Sedang'], [2, 'Besar']], C.z, v => sc('z', +v)),
        select('Warna jam', '', [['t', 'Teks'], ['a', 'Aksen'], ['g', 'Emas'], ['b', 'Biru'], ['h', 'Hijau']], C.k, v => sc('k', v)),
        select('Format tanggal', '', [[0, 'Lengkap'], [1, 'Singkat'], [2, 'Sembunyikan']], C.d2, v => sc('d2', +v)),
        ck('h24', 'Format 24 jam'), ck('q', 'Tampilkan detik'), ck('n', 'Angka pada jam analog'), ck('y', 'Tampilkan zona waktu'), ck('b', 'Latar kartu jam')]));
    }
    if (sec === 'unduhan') {
      A(box([
        row('Lokasi simpan', S.dlDirShown, (() => { const d = document.createElement('div'); d.style.display = 'flex'; d.style.gap = '6px'; const b = document.createElement('button'); b.className = 'btn sm'; b.textContent = 'Pilih folder…'; b.onclick = () => api('dir.pick'); d.appendChild(b); if (S.dlDir) { const r = document.createElement('button'); r.className = 'btn sm'; r.textContent = 'Setel ulang'; r.onclick = () => set('dlDir', ''); d.appendChild(r); } return d; })()),
        toggle('dlAsk', 'Tanya lokasi simpan setiap unduhan')]));
    }
    if (sec === 'terjemah') {
      A(box([
        select('Terjemahkan ke', 'Bahasa tujuan untuk Terjemahkan halaman (Ctrl+Alt+T)', Object.entries(S.trLangs), S.trLang, v => set('trLang', v)),
        toggle('tr', 'Terjemahkan chat langsung', 'Menerjemahkan pesan chat live YouTube/Twitch otomatis'),
        S.tr ? toggle('trhide', 'Sembunyikan teks asli chat') : row('', '', null)].filter(r => r.textContent !== '' || r.querySelector('input'))));
    }
    if (sec === 'cadangan') {
      A(box([button('Ekspor pengaturan & bookmark', 'Berkas JSON (tanpa sandi, histori, dan PIN)', 'Ekspor…', () => api('backup.export')), button('Pulihkan dari cadangan', '', 'Pilih berkas…', async () => { const ok = await api('backup.import'); if (ok === false) alert('Berkas cadangan tidak valid.'); }),
        button('Ekspor bookmark (HTML)', 'Format standar, kompatibel dengan Chrome/Firefox', 'Ekspor…', () => api('bm.export')), button('Impor bookmark (HTML)', '', 'Pilih berkas…', async () => { const n = await api('bm.import'); if (n >= 0) alert(n + ' bookmark diimpor.'); })]));
    }
    if (sec === 'tentang') {
      const a = await api('about');
      A(box([row('Alethra', 'Versi ' + a.version, null), row('Mesin', `Chromium ${a.chrome} · Electron ${a.electron}`, null), row('Folder data', a.data, null)]));
      A(el('<p class="sub" style="margin-top:16px">Pintasan: Ctrl+T tab baru · Ctrl+Shift+N Incognito · Ctrl+L alamat · Ctrl+F cari · Ctrl+D bookmark · Ctrl+H histori · Ctrl+J unduhan · F11 layar penuh · Ctrl+Alt+R mode baca · Ctrl+Alt+T terjemah.</p>'));
    }
    if (!scroll) window.scrollTo(0, keep);
  }

  /* ---------- kunci aplikasi ---------- */
  async function lockUI() {
    const L = S.lock, rows = [];
    const msg = el('<div class="d" style="padding:0 16px 10px;color:var(--danger)" id="lm"></div>');
    const err = (t) => { msg.textContent = t || ''; };
    const pinBtn = button(L.hasPin ? 'Ubah PIN' : 'Atur PIN', 'PIN 4–12 angka. Disimpan sebagai hash (scrypt).', L.hasPin ? 'Ubah PIN' : 'Atur PIN', async () => {
      const v = await askText(L.hasPin ? 'PIN baru' : 'Atur PIN', [{ l: 'PIN (4–12 angka)', t: 'password' }, { l: 'Ulangi PIN', t: 'password' }]);
      if (!v) return; if (v[0] !== v[1]) return err('PIN tidak sama');
      const r = await api('lock.set', { pin: v[0] }); err(r.ok ? '' : r.err); if (r.ok) renderSec(false);
    });
    rows.push(pinBtn);
    if (L.hasPin) {
      rows.push(select('Kunci', 'Seluruh aplikasi atau hanya bagian tertentu', [['off', 'Mati'], ['app', 'Seluruh aplikasi'], ['parts', 'Bagian tertentu']], L.mode, async v => { const r = await api('lock.set', { mode: v }); err(r.ok ? '' : r.err); renderSec(false); }));
      rows.push(select('Kunci ulang setelah', 'Setelah Alethra ditinggalkan / tidak dipakai', [[0, 'Langsung'], [30000, '30 detik'], [60000, '1 menit'], [300000, '5 menit'], [900000, '15 menit']], L.grace, async v => { const r = await api('lock.set', { grace: +v }); err(r.ok ? '' : r.err); }));
      if (L.mode === 'parts') {
        const w = el('<div style="padding:4px 16px 10px"></div>');
        [['incog', 'Tab Incognito'], ['bookmarks', 'Bookmark'], ['passwords', 'Kata sandi']].forEach(([k, t]) => { const c = el(`<label class="chk"><input type="checkbox"> ${t}</label>`); c.firstChild.checked = L.parts.includes(k); c.firstChild.onchange = async () => { const p = new Set(L.parts); c.firstChild.checked ? p.add(k) : p.delete(k); const r = await api('lock.set', { parts: [...p] }); err(r.ok ? '' : r.err); }; w.appendChild(c); });
        rows.push(w);
      }
      rows.push(button('Hapus PIN & matikan kunci', '', 'Hapus PIN', async () => { const r = await api('lock.set', { off: true }); err(r.ok ? '' : r.err); renderSec(false); }, 'danger'));
    }
    const b = box(rows); b.appendChild(msg); return b;
  }

  /* ---------- izin situs ---------- */
  async function permsUI() {
    const L = await api('perms.list') || [];
    const wrap = document.createElement('div');
    if (!L.length) { wrap.className = 'list'; wrap.innerHTML = '<div class="empty">Belum ada izin tersimpan.</div>'; return wrap; }
    const lb = L[0].labels; const rows = [];
    L.forEach(p => { Object.keys(p.perms).forEach(k => rows.push(select(p.host, lb[k], [['allow', 'Izinkan'], ['block', 'Blokir'], ['ask', 'Tanya']], p.perms[k], async v => { await api('perms.set', p.host, k, v); renderSec(false); }))); });
    const b = box(rows); wrap.appendChild(b);
    wrap.appendChild(el('<div style="margin-top:10px"></div>')); wrap.lastChild.appendChild(Object.assign(document.createElement('button'), { className: 'btn sm danger', textContent: 'Hapus semua izin situs', onclick: async () => { if (await askConfirm('Hapus semua izin situs?', '', 'Hapus', true)) { await api('perms.clear'); renderSec(false); } } }));
    return wrap;
  }

  /* ---------- hapus data ---------- */
  function clearDlg() {
    const d = document.createElement('div'); d.className = 'dlg';
    d.innerHTML = `<div class="card"><h3>Hapus data penjelajahan</h3>
    ${[['history', 'Histori', 1], ['cookies', 'Cookie & data situs', 1], ['cache', 'Cache gambar & berkas', 1], ['downloads', 'Daftar unduhan', 0], ['passwords', 'Kata sandi tersimpan', 0], ['perms', 'Izin situs', 0], ['offline', 'Halaman offline', 0]].map(([k, t, on]) => `<label class="chk"><input type="checkbox" data-k="${k}" ${on ? 'checked' : ''}> ${t}</label>`).join('')}
    <div class="end"><button class="btn" data-x>Batal</button><button class="btn danger" data-ok>Hapus</button></div></div>`;
    document.body.appendChild(d);
    $('[data-x]', d).onclick = () => d.remove();
    $('[data-ok]', d).onclick = async () => { const o = {}; $$('input', d).forEach(i => o[i.dataset.k] = i.checked); d.remove(); await api('data.clear', o); };
  }
  alethra.on('open-clear', clearDlg);
  built = true; renderSec(true);
  window.addEventListener('hashchange', () => { sec = (location.hash || '#umum').slice(1); if (SECS.some(x => x[0] === sec)) renderSec(true); });
})();
