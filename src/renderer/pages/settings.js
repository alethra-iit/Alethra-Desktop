(async function () {
  let built = false, sec = (location.hash || '#umum').slice(1), S = {};
  let busyUI = false; // true saat slider/pemilih warna sedang dipakai, supaya halaman tidak dibangun ulang di tengah geseran
  S = await pageInit(s => { S = s; if (built && !busyUI) renderSec(false); });
  const SECS = [['umum', 'Umum', 'settings'], ['mesin', 'Mesin pencari', 'search'], ['privasi', 'Privasi & Keamanan', 'shield'], ['tampilan', 'Tampilan', 'image'], ['widget', 'Widget', 'layout'], ['unduhan', 'Unduhan', 'download'], ['tools', 'Tools', 'tools'], ['play', 'Play', 'play'], ['mesinoff', 'Mesin offline', 'mic'], ['audio', 'Pengaturan audio', 'sliders', 1], ['cadangan', 'Cadangan', 'copy'], ['tentang', 'Tentang', 'globe']];
  $('#side').innerHTML = '<h2>Pengaturan</h2>'; SECS.forEach(([k, l, ic, hid]) => { if (hid) return; const b = document.createElement('button'); b.dataset.k = k; b.innerHTML = ICON(ic, 18) + esc(l); b.onclick = () => { sec = k; history.replaceState(null, '', '#' + k); renderSec(true); }; $('#side').appendChild(b); });
  const set = (k, v) => api('settings.set', k, v);
  const el = (h) => { const t = document.createElement('div'); t.innerHTML = h.trim(); return t.firstChild; };
  const box = (rows) => { const l = document.createElement('div'); l.className = 'list'; rows.forEach(r => l.appendChild(r)); return l; };
  const row = (title, desc, ctl) => { const r = el(`<div class="set"><div class="tx"><div>${esc(title)}</div>${desc ? `<div class="d">${esc(desc)}</div>` : ''}</div></div>`); if (ctl) r.appendChild(ctl); return r; };
  const toggle = (k, title, desc, inv) => { const c = el(`<label class="sw"><input type="checkbox"><i></i></label>`); const i = c.firstChild; i.checked = inv ? !S[k] : !!S[k]; i.onchange = () => set(k, inv ? !i.checked : i.checked); return row(title, desc, c); };
  const select = (title, desc, opts, val, fn) => { const s = document.createElement('select'); opts.forEach(([v, l]) => { const o = document.createElement('option'); o.value = v; o.textContent = l; if (String(v) === String(val)) o.selected = true; s.appendChild(o); }); s.onchange = () => fn(s.value); return row(title, desc, s); };
  const button = (title, desc, label, fn, cls) => { const b = document.createElement('button'); b.className = 'btn sm ' + (cls || ''); b.textContent = label; b.onclick = fn; return row(title, desc, b); };
  const grp = (t) => el(`<div class="group">${esc(t)}</div>`);
  // slider angka dengan nilai di sebelahnya; perubahan dikirim langsung (diperlambat) supaya terlihat saat geser
  const slider = (title, desc, min, max, step, val, fmt, fn) => {
    const w = document.createElement('div'); w.style.cssText = 'display:flex;align-items:center;gap:10px';
    const r = document.createElement('input'); r.type = 'range'; r.min = min; r.max = max; r.step = step; r.value = val; r.style.cssText = 'width:200px;accent-color:var(--acc)';
    const v = document.createElement('span'); v.style.cssText = 'min-width:68px;text-align:right;font-variant-numeric:tabular-nums;color:var(--sub);font-size:13px'; v.textContent = fmt(+val);
    let t = 0; const end = () => { if (busyUI) { busyUI = false; renderSec(false); } };
    r.onpointerdown = () => { busyUI = true; };
    r.onpointerup = () => setTimeout(end, 200);
    r.onblur = end;
    r.oninput = () => { busyUI = true; v.textContent = fmt(+r.value); clearTimeout(t); t = setTimeout(() => fn(+r.value), 40); };
    r.onchange = () => { clearTimeout(t); fn(+r.value); };
    w.append(r, v); return row(title, desc, w);
  };
  const colorRow = (title, desc, val, fallback, fn, canReset) => {
    const w = document.createElement('div'); w.style.cssText = 'display:flex;align-items:center;gap:8px';
    const c = document.createElement('input'); c.type = 'color'; c.value = /^#[0-9a-f]{6}$/i.test(val) ? val : fallback; c.style.cssText = 'width:44px;height:32px;border:1px solid var(--line);border-radius:8px;background:none;padding:2px;cursor:pointer';
    let t = 0; const end = () => { if (busyUI) { busyUI = false; renderSec(false); } };
    c.onclick = () => { busyUI = true; };
    c.oninput = () => { busyUI = true; clearTimeout(t); t = setTimeout(() => fn(c.value), 40); };
    c.onchange = () => { clearTimeout(t); fn(c.value); setTimeout(end, 200); };
    c.onblur = () => setTimeout(end, 200);
    w.appendChild(c);
    if (canReset && val) { const b = document.createElement('button'); b.className = 'btn sm'; b.textContent = 'Ikuti tema'; b.onclick = () => { busyUI = false; fn(''); }; w.appendChild(b); }
    return row(title, desc, w);
  };
  const flag = (title, desc, val, fn) => { const c = el('<label class="sw"><input type="checkbox"><i></i></label>'); c.firstChild.checked = !!val; c.firstChild.onchange = () => fn(c.firstChild.checked); return row(title, desc, c); };
  // bagian lipat: klik judul untuk membuka/menutup daftar opsinya; status buka tersimpan selama halaman ini terbuka
  const openAcc = new Set();
  const acc = (id, title, desc, rows) => {
    const w = el('<div class="acc"></div>'), h = el(`<button class="acch" type="button" aria-expanded="false"><span class="tx"><b>${esc(title)}</b>${desc ? `<span class="d">${esc(desc)}</span>` : ''}</span><span class="chv">${ICON('down', 18)}</span></button>`);
    const sync = () => { const o = openAcc.has(id); w.classList.toggle('open', o); h.setAttribute('aria-expanded', o); };
    h.onclick = () => { if (openAcc.has(id)) openAcc.delete(id); else openAcc.add(id); sync(); };
    w.append(h, box(rows)); sync(); return w;
  };
  const main = $('#main');

  const DEFSTA = { pg: 1, min: 0, max: 0, sens: 2.8, dur: 300, ns: 0, gate: 0, hp: 80, lp: 0, auto: 6, minlen: 2, filt: true, meter: false, legacy: false };
  const STA = [
    { key: 'pg', title: 'Penguat volume awal', def: 1, vals: [1, 1.5, 2, 3, 4], names: ['1×', '1,5×', '2×', '3×', '4×'], help: 'Menaikkan volume audio video sebelum diproses. Berguna bila video terlalu pelan.' },
    { key: 'min', title: 'Volume minimum', def: 0, vals: [0, 0.016, 0.025, 0.04, 0.063, 0.1], names: ['Otomatis', 'Rendah (−36 dB)', 'Sedang (−32 dB)', 'Tinggi (−28 dB)', 'Sangat tinggi (−24 dB)', 'Ekstrem (−20 dB)'], help: 'Suara di bawah volume ini dibisukan (bisikan, percakapan latar, derau pelan).' },
    { key: 'max', title: 'Volume maksimum', def: 0, vals: [0, 0.5, 0.316, 0.2, 0.1], names: ['Mati', 'Sangat keras (−6 dB)', 'Keras (−10 dB)', 'Sedang (−14 dB)', 'Pelan (−20 dB)'], help: 'Suara di atas volume ini dibisukan (musik keras, efek). Terlalu rendah membuat ucapan keras ikut hilang.' },
    { key: 'sens', title: 'Kepekaan deteksi ucapan', def: 2.8, vals: [2, 2.4, 2.8, 3.6, 5], names: ['Sangat peka', 'Peka', 'Normal', 'Ketat', 'Sangat ketat'], help: 'Ketat: derau dan musik pelan tidak memicu. Peka: ucapan pelan tertangkap.' },
    { key: 'dur', title: 'Ucapan minimum', def: 300, vals: [150, 300, 500, 800], names: ['150 ms (sangat peka)', '300 ms', '500 ms', '800 ms'], help: 'Potongan yang lebih pendek dari ini dibuang sebagai derau (klik, napas).' },
    { key: 'ns', title: 'Peredam derau', def: 0, vals: [0, 1, 2, 3], names: ['Mati', 'Ringan (±−4 dB)', 'Sedang (±−7 dB)', 'Kuat (±−11 dB)'], help: 'Meredam derau stabil (desis, kipas, angin). Kuat bisa membuat ucapan sedikit tipis.' },
    { key: 'gate', title: 'Redam suara latar', def: 0, vals: [0, 1, 2, 3], names: ['Mati', 'Ringan', 'Sedang', 'Kuat'], help: 'Menurunkan suara latar di sela ucapan; mengurangi teks palsu pada bagian senyap.' },
    { key: 'hp', title: 'Filter gemuruh (high-pass)', def: 80, vals: [0, 80, 120, 200, 300], names: ['Mati', '80 Hz', '120 Hz', '200 Hz', '300 Hz'], help: 'Membuang gemuruh rendah. Di atas 200 Hz suara bass bisa menipis.' },
    { key: 'lp', title: 'Filter desis (low-pass)', def: 0, vals: [0, 7000, 5000, 3800], names: ['Mati', '7 kHz', '5 kHz', '3,8 kHz'], help: 'Membuang desis tinggi. Terlalu rendah membuat huruf s, sh, f kurang jelas.' },
    { key: 'auto', title: 'Penguat suara pelan otomatis', def: 6, vals: [1, 3, 6, 12], names: ['Mati (1×)', 'Ringan (3×)', 'Standar (6×)', 'Kuat (12×)'], help: 'Menaikkan potongan yang pelan sebelum dikirim, supaya konsonan lemah tidak hilang.' },
    { key: 'minlen', title: 'Panjang teks minimum', def: 2, vals: [1, 2, 4, 6, 10], names: ['1 karakter', '2 karakter', '4 karakter', '6 karakter', '10 karakter'], help: 'Hasil teks yang lebih pendek dari ini dibuang.' }];
  const PRESETS = [
    ['Standar', 'Semua kembali ke bawaan', {}],
    ['Video bising', 'Peredam derau sedang, redam latar ringan, buang gemuruh, deteksi lebih ketat', { ns: 2, gate: 1, hp: 120, sens: 3.6, dur: 500 }],
    ['Suara pelan', 'Naikkan volume 3×, penguat otomatis kuat, deteksi lebih peka', { pg: 3, auto: 12, sens: 2.4, dur: 150 }],
    ['Musik latar', 'Redam latar sedang, peredam derau ringan, fokus ke suara manusia', { ns: 1, gate: 2, hp: 200, lp: 5000, sens: 3.6, dur: 500 }],
    ['Hanya suara jelas', 'Abaikan bisikan dan percakapan latar', { min: 0.04, sens: 5, gate: 2, dur: 500 }]];
  function audSummary() { const T = S.sta || DEFSTA; let n = STA.filter(o => Number(T[o.key]) !== o.def).length + (T.filt === false ? 1 : 0) + (T.meter ? 1 : 0) + (T.legacy ? 1 : 0); return n ? n + ' pengaturan diubah' : 'Standar'; }
  function presetDlg() {
    const d = document.createElement('div'); d.className = 'dlg';
    d.innerHTML = `<div class="card"><h3>Preset cepat</h3>${PRESETS.map((p, i) => `<button class="btn" data-i="${i}" style="width:100%;margin:4px 0;height:auto;padding:10px 14px;flex-direction:column;align-items:flex-start;gap:2px"><b>${esc(p[0])}</b><span style="color:var(--sub);font-size:12.5px;text-align:left">${esc(p[1])}</span></button>`).join('')}<div class="end"><button class="btn" data-x>Batal</button></div></div>`;
    document.body.appendChild(d);
    $('[data-x]', d).onclick = () => d.remove();
    $$('[data-i]', d).forEach(b => b.onclick = () => { const p = PRESETS[+b.dataset.i]; d.remove(); set('sta', Object.assign({}, DEFSTA, p[2])); });
  }

  let OE = null, mtS = '', mtT = '', playSub = 'umum', mirCustom = false;
  // baris model (suara atau terjemahan): unduh / batal / pakai / hapus, dengan bilah kemajuan yang diperbarui langsung
  function oeRow(map) {
    return (m0) => {
      const m = map(m0), job = (OE.jobs || {})[m.id], busy = job && job.busy, pct = job && job.total ? Math.min(100, Math.round(job.done * 100 / job.total)) : 0;
      const r = el(`<div class="set"><div class="tx"><div>${esc(m.title)}${m.sel ? ' <span style="font-size:11px;padding:2px 8px;border-radius:9px;background:var(--acc);color:var(--onacc);margin-left:6px">Dipakai</span>' : ''}</div><div class="d">${esc(m.desc)} · ${m.installed ? fmtBytes(m.bytes) : '±' + m.mb + ' MB'}</div>${busy ? `<div class="prog"><i data-p="${m.id}" style="width:${pct}%"></i></div><div class="d" data-pt="${m.id}">${esc(job.phase || '')} ${job.total ? pct + '% (' + fmtBytes(job.done) + ' / ' + fmtBytes(job.total) + ')' : ''}</div>` : ''}${!busy && job && job.error ? `<div class="d" style="color:var(--danger)">${esc(job.error)}</div>` : ''}</div></div>`);
      const a = document.createElement('div'); a.style.cssText = 'display:flex;gap:6px;flex:none';
      const b = (t, fn, cls) => { const x = document.createElement('button'); x.className = 'btn sm ' + (cls || ''); x.textContent = t; x.onclick = fn; a.appendChild(x); };
      if (!busy && job && job.error && job.detail) b('Salin detail error', async () => { await api('clip.write', job.detail); const x = a.firstChild; if (x) { x.textContent = 'Tersalin ✓'; setTimeout(() => { x.textContent = 'Salin detail error'; }, 1800); } });
      if (busy) b('Batal', async () => { await api('oe.cancel', m.id); renderSec(false); });
      else if (m.installed) { if (m.pick && !m.sel) b('Pakai', () => m.pick()); b('Hapus', async () => { if (await askConfirm('Hapus model?', m.title + ' akan dihapus dari PC ini.', 'Hapus', true)) { await api('oe.del', m.id); renderSec(false); } }, 'danger'); }
      else b(job && job.error ? 'Coba lagi' : 'Unduh', async () => { await api('oe.dl', m.id); renderSec(false); }, 'pri');
      r.appendChild(a); return r;
    };
  }
  alethra.on('oe', (jobs) => {
    if (!OE || (sec !== 'mesinoff' && sec !== 'play')) return;
    const was = OE.jobs || {}; OE.jobs = jobs; let redo = false;
    for (const id of Object.keys(Object.assign({}, was, jobs))) { const a = was[id], b = jobs[id]; if (!!(a && a.busy) !== !!(b && b.busy)) redo = true; }
    if (redo) return renderSec(false);
    for (const id of Object.keys(jobs)) {
      const j = jobs[id]; if (!j.busy) continue; const pct = j.total ? Math.min(100, Math.round(j.done * 100 / j.total)) : 0;
      const bar = document.querySelector(`[data-p="${id}"]`), tx = document.querySelector(`[data-pt="${id}"]`);
      if (bar) bar.style.width = pct + '%'; if (tx) tx.textContent = (j.phase || '') + ' ' + (j.total ? pct + '% (' + fmtBytes(j.done) + ' / ' + fmtBytes(j.total) + ')' : '');
    }
  });

  async function renderSec(scroll) {
    busyUI = false;
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
      A(grp('Blokir iklan')); A(box([toggle('adblock', 'Blokir iklan YouTube', 'Melewati iklan video dan menyembunyikan slot iklan'), toggle('sadblock', 'Blokir iklan situs web', 'Menyembunyikan banner & memblokir jaringan iklan umum. Bisa dimatikan per situs lewat menu Tools')]));
      A(grp('Data')); A(box([button('Hapus data penjelajahan', 'Histori, cookie, cache, unduhan, dll. (Ctrl+Shift+Del)', 'Hapus…', clearDlg, 'danger')]));
      A(grp('Kunci aplikasi (PIN)')); A(await lockUI());
      A(el('<div class="group" id="perms">Izin situs</div>')); A(await permsUI());
    }
    if (sec === 'widget') {
      const C = Object.assign({ c: 'analog', p: 'mid', z: 1, k: 't', al: 'c', d2: 0, h24: true, q: false, y: true, n: true, b: true }, S.clock || {});
      const sc = (k, v) => { C[k] = v; set('clock', Object.assign({}, C)); };
      const ck = (k, t, d) => { const c = el(`<label class="sw"><input type="checkbox"><i></i></label>`); c.firstChild.checked = !!C[k]; c.firstChild.onchange = () => sc(k, c.firstChild.checked); return row(t, d, c); };
      const D = S.stDefs, F = S.fsb || D.fsb, sf = (k, v) => set('fsb', Object.assign({}, F, { [k]: v }));
      // pratinjau: dua tombol dengan gaya yang sama seperti di layar penuh, di atas latar bergaris supaya transparansi terlihat
      const pv = el('<div style="display:flex;gap:8px;padding:14px 18px;border-radius:12px;background:repeating-conic-gradient(#8884 0 25%,#fff4 0 50%) 0 0/16px 16px"></div>');
      const pbg = F.bg || (S.dark ? (S.amoled ? '#000000' : '#0b0b0d') : '#ffffff'), pfg = F.fg || (S.dark ? '#f4f4f5' : '#111113');
      ['tools', 'more'].forEach(n => { const b = el(`<div style="width:40px;height:40px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:1px solid var(--line);box-shadow:var(--shadow)">${ICON(n, 20)}</div>`); b.style.background = `color-mix(in srgb, ${pbg} ${F.bgop}%, transparent)`; b.style.color = pfg; b.style.opacity = F.op / 100; pv.appendChild(b); });
      A(acc('fsb', 'Tombol menu layar penuh', 'Warna dan transparansi tombol Tools dan ⋮ yang melayang saat layar penuh', [
        row('Pratinjau', 'Seret tombolnya di layar penuh untuk memindahkan posisinya', pv),
        colorRow('Warna tombol', 'Warna latar tombol. "Ikuti tema" memakai warna tema terang/gelap', F.bg, S.dark ? '#0b0b0d' : '#ffffff', v => sf('bg', v), true),
        colorRow('Warna ikon', 'Warna ikon Tools dan ⋮', F.fg, S.dark ? '#f4f4f5' : '#111113', v => sf('fg', v), true),
        slider('Transparansi latar', '0% = latar tombol pekat, 100% = latar hilang dan hanya ikon yang terlihat', 0, 100, 1, 100 - F.bgop, v => v + '%', v => sf('bgop', 100 - v)),
        slider('Transparansi tombol', 'Seberapa pudar seluruh tombol saat tidak disentuh. Saat kursor di atasnya tombol selalu jelas', 0, 90, 1, 100 - F.op, v => v + '%', v => sf('op', 100 - v)),
        button('Pengaturan bawaan', 'Kembalikan warna dan transparansi tombol', 'Setel ulang', () => set('fsb', D.fsb))]));
      A(acc('jam', 'Jam', 'Gaya, ukuran, warna, dan format jam di beranda', [select('Gaya jam', '', [['analog', 'Analog + teks'], ['dial', 'Jam dinding'], ['digital', 'Digital'], ['text', 'Teks'], ['bar', 'Bilah'], ['off', 'Mati']], C.c, v => sc('c', v)),
        select('Perataan', '', [['c', 'Tengah'], ['l', 'Kiri'], ['r', 'Kanan']], C.al, v => sc('al', v)),
        select('Ukuran', '', [[0, 'Kecil'], [1, 'Sedang'], [2, 'Besar']], C.z, v => sc('z', +v)),
        select('Warna jam', '', [['t', 'Teks'], ['a', 'Aksen'], ['g', 'Emas'], ['b', 'Biru'], ['h', 'Hijau']], C.k, v => sc('k', v)),
        select('Format tanggal', '', [[0, 'Lengkap'], [1, 'Singkat'], [2, 'Sembunyikan']], C.d2, v => sc('d2', +v)),
        ck('h24', 'Format 24 jam'), ck('q', 'Tampilkan detik'), ck('n', 'Angka pada jam analog'), ck('y', 'Tampilkan zona waktu'), ck('b', 'Latar kartu jam')]));
    }
    if (sec === 'tampilan') {
      A(box([select('Tema', '', [['system', 'Ikuti sistem'], ['light', 'Terang'], ['dark', 'Gelap']], S.theme, v => set('theme', v)), toggle('amoled', 'Mode AMOLED', 'Latar hitam pekat saat tema gelap')]));
      const nh = (v) => { v = String(v || '').trim().replace(/^#?/, '#'); if (/^#[0-9a-f]{3}$/i.test(v)) v = '#' + v.slice(1).split('').map(c => c + c).join(''); return /^#[0-9a-f]{6}$/i.test(v) ? v.toUpperCase() : null; };
      const bw = el('<div class="sws"></div>');
      [['', 'Ikuti tema'], ['#ECEDF1', 'Abu terang'], ['#E6ECF5', 'Biru muda'], ['#EFECE6', 'Krem'], ['#FFFFFF', 'Putih'], ['#2A2A2F', 'Abu gelap'], ['#1E2A3A', 'Biru malam'], ['#2B2A33', 'Ungu gelap'], ['#1B1B1F', 'Hitam lembut'], ['#0F3D2E', 'Hijau tua'], ['#4A1F2B', 'Marun']].forEach(([c, n]) => { const b = document.createElement('button'); b.className = 'swc' + ((S.barcol || '').toUpperCase() === c ? ' on' : ''); b.style.background = c || 'linear-gradient(135deg,#fff 50%,#111 50%)'; b.title = n; b.onclick = () => set('barcol', c); bw.appendChild(b); });
      const pk = document.createElement('input'); pk.type = 'color'; pk.value = /^#[0-9a-f]{6}$/i.test(S.barcol) ? S.barcol : '#ecedf1'; pk.title = 'Pilih warna lain'; pk.style.cssText = 'width:36px;height:30px;border:1px solid var(--line);border-radius:8px;background:none;padding:2px;cursor:pointer'; pk.onchange = () => set('barcol', pk.value.toUpperCase()); bw.appendChild(pk);
      const bi = document.createElement('input'); bi.className = 'inp'; bi.style.width = '110px'; bi.placeholder = '#RRGGBB'; bi.value = S.barcol || '';
      bi.onchange = () => { const t = bi.value.trim(); if (!t) return set('barcol', ''); const h = nh(t); if (h) set('barcol', h); else { bi.value = S.barcol || ''; bi.style.borderColor = 'var(--danger)'; setTimeout(() => { bi.style.borderColor = ''; }, 1200); } };
      bw.appendChild(bi);
      A(grp('Warna toolbar')); A(box([
        select('Gaya bawaan', 'Berlaku di tema terang, gelap, dan AMOLED. Dipakai bila warna kustom di bawah tidak diatur', [['abu', 'Abu-abu (bawaan)'], ['biru', 'Biru keabuan'], ['hangat', 'Krem hangat'], ['putih', 'Menyatu dengan halaman']], S.barstyle || 'abu', v => set('barstyle', v)),
        row('Warna kustom', 'Berlaku di tema terang dan gelap. Warna teks, strip tab, dan kolom alamat menyesuaikan otomatis. Kosongkan atau pilih "Ikuti tema" untuk mengembalikan', bw)]));
      const sw = el('<div class="sws"></div>');
      ['', '#2F6BFF', '#7C4DFF', '#E91E63', '#F44336', '#FF9800', '#2E9E5B', '#00A3A3'].forEach(c => { const b = document.createElement('button'); b.className = 'swc' + ((S.accent || '') === c ? ' on' : ''); b.style.background = c || 'linear-gradient(135deg,#fff 50%,#111 50%)'; b.title = c || 'Hitam/putih'; b.onclick = () => set('accent', c); sw.appendChild(b); });
      const ci = document.createElement('input'); ci.className = 'inp'; ci.style.width = '110px'; ci.placeholder = '#RRGGBB'; ci.value = S.accent || ''; ci.onchange = () => set('accent', ci.value.trim().toUpperCase()); sw.appendChild(ci);
      A(grp('Warna aksen')); A(box([row('Warna aksen', 'Dipakai pada tombol, tab Incognito & beranda', sw)]));
      A(grp('Beranda'));
      A(box([toggle('logo', 'Tampilkan logo'), toggle('grad', 'Gradasi warna latar'),
        button('Wallpaper', S.wall ? 'Wallpaper aktif' : 'Pilih gambar sebagai latar beranda', 'Pilih gambar…', () => api('wall.pick')),
        S.wall ? button('Hapus wallpaper', '', 'Hapus', () => api('wall.clear'), 'danger') : row('', '', null),
        select('Keburaman wallpaper', '', [[0, 'Tipis'], [1, 'Sedang'], [2, 'Tebal']], S.dim, v => set('dim', +v))].filter(r => r.textContent !== '')));
      A(grp('Tampilan terpisah (split view)'));
      A(box([
        select('Susunan panel', 'Otomatis: berdampingan di jendela lebar, atas-bawah di jendela sempit. Buka dari menu Tools → Tampilan terpisah (Ctrl+Alt+V), klik kanan tab, atau klik kanan tautan.', [['auto', 'Otomatis'], ['h', 'Selalu berdampingan'], ['v', 'Selalu atas-bawah']], S.splitMode || 'auto', v => set('splitMode', v)),
        button('Lebar panel', 'Seret pembagi di antara panel untuk mengubah ukuran. Klik dua kali pembagi, atau tombol ini, untuk 50:50. Ctrl+Alt+←/→ memindahkan fokus antar panel.', 'Samakan 50:50', () => set('splitRatio', 0.5))
      ]));
    }
    if (sec === 'unduhan') {
      A(box([
        row('Lokasi simpan', S.dlDirShown, (() => { const d = document.createElement('div'); d.style.display = 'flex'; d.style.gap = '6px'; const b = document.createElement('button'); b.className = 'btn sm'; b.textContent = 'Pilih folder…'; b.onclick = () => api('dir.pick'); d.appendChild(b); if (S.dlDir) { const r = document.createElement('button'); r.className = 'btn sm'; r.textContent = 'Setel ulang'; r.onclick = () => set('dlDir', ''); d.appendChild(r); } return d; })()),
        toggle('dlAsk', 'Tanya lokasi simpan setiap unduhan')]));
    }
    if (sec === 'tools') {
      A(el('<p class="sub">Menu Tools dibuka dari tombol "Tools" di toolbar (antara Unduhan dan ⋮). Pilih fitur yang ingin ditampilkan di sana. Pintasan keyboard tetap berfungsi walau itemnya disembunyikan. Fitur yang dimatikan di Play tetap muncul di menu Tools dalam keadaan redup dengan keterangan, supaya jelas kenapa belum bisa dipakai.</p>'));
      const T = () => S.tools || {}, tt = (k) => (c) => set('tools', Object.assign({}, S.tools, { [k]: c }));
      const tg = (k, title, desc) => flag(title, desc, T()[k] !== false, tt(k));
      // fitur yang juga bergantung pada Play: bila Play mematikannya, tampilkan peringatan + tombol untuk menyalakan
      const tgp = (k, title, desc, pk, where) => {
        const r = tg(k, title, desc);
        if (S[pk] === false) {
          const d = r.querySelector('.d') || r.querySelector('.tx').appendChild(el('<div class="d"></div>'));
          d.style.color = 'var(--danger)'; d.textContent = 'Dimatikan di Play → ' + where + ', jadi di menu Tools tampil redup dan tidak bisa dipakai.';
          const b = document.createElement('button'); b.className = 'btn sm pri'; b.textContent = 'Nyalakan di Play'; b.onclick = () => set(pk, true); r.appendChild(b);
        }
        return r;
      };
      A(grp('Halaman')); A(box([
        tg('find', 'Cari di halaman', 'Ctrl+F'), tg('print', 'Cetak…', 'Ctrl+P'), tg('pdf', 'Simpan sebagai PDF'), tg('offline', 'Simpan halaman offline', 'Ctrl+S')]));
      A(grp('Terjemahan & baca')); A(box([
        tgp('translate', 'Terjemahkan halaman', 'Ctrl+Alt+T. Juga perlu dinyalakan di Play → Terjemahkan situs', 'ptr', 'Terjemahkan situs'),
        tg('chat', 'Terjemahkan chat live', 'YouTube dan Twitch'),
        tgp('stt', 'Terjemahan Suara', 'Ctrl+Alt+S. Juga perlu dinyalakan di Play → Terjemahan Suara', 'stt', 'Terjemahan Suara'),
        tg('reader', 'Mode baca', 'Ctrl+Alt+R'), tg('transcript', 'Riwayat terjemahan suara', 'Ctrl+Alt+H. Daftar kalimat hasil Terjemahan Suara')]));
      A(grp('Video & situs')); A(box([
        tg('vq', 'Kualitas video…'), tg('pip', 'Gambar dalam gambar'), tg('emu', 'Mode perangkat (ponsel/tablet)', 'Ctrl+Shift+M. Lebar halaman dipersempit seperti layar ponsel'), tg('adsite', 'Blokir iklan di situs ini', 'Per situs'), tg('split', 'Tampilan terpisah', 'Ctrl+Alt+V. Dua halaman berdampingan, mis. video + catatan')]));
      A(box([button('Tampilkan semua', 'Kembalikan semua item ke menu Tools', 'Atur ulang', () => set('tools', S.stDefs.tools))]));
    }
    if (sec === 'play') {
      const OEs = await api('oe.list') || { stt: [], mt: [], jobs: {} };
      const SELK = { offline: 'stmodel', tjs: 'stwmodel', vosk: 'stvmodel' }, ENGN = { offline: 'sherpa-onnx', tjs: 'Whisper (Transformers.js)', vosk: 'Vosk' };
      const isLocal = S.stengine in SELK;
      const curM = isLocal && OEs.stt.find(m => m.id === S[SELK[S.stengine]] && m.installed);
      const goOff = () => { sec = 'mesinoff'; history.replaceState(null, '', '#mesinoff'); renderSec(true); };
      /* ringkasan di atas + sub-bagian, supaya halaman tidak panjang */
      const trName = { online: 'Google Translate', offline: 'Opus-MT', nllb: 'NLLB' }[S.trmode] || S.trmode;
      const engName = S.stengine === 'cloud' ? 'Whisper cloud' : ENGN[S.stengine];
      const modelName = isLocal ? (curM ? curM.title : 'belum terpasang') : ({ groq: 'Groq', openai: 'OpenAI', custom: 'Server sendiri' }[S.stprov] || S.stprov);
      let warn = '';
      if (S.stt === false) warn = 'Terjemahan Suara dimatikan.';
      else if (isLocal && !curM) warn = 'Model suara belum terpasang. Fitur belum bisa dijalankan.';
      else if (!isLocal && S.stprov !== 'custom' && !S.stkeyMask) warn = 'Kunci API belum diisi. Fitur belum bisa dijalankan.';
      else if (!isLocal && S.stprov === 'custom' && !S.stcurl) warn = 'Alamat server belum diisi. Fitur belum bisa dijalankan.';
      else if (S.trmode === 'nllb' && !(OEs.nllb && OEs.nllb.installed)) warn = S.mtfb ? 'Model NLLB belum terpasang; sementara memakai terjemahan online.' : 'Model NLLB belum terpasang.';
      const sumBox = el('<div class="list"></div>');
      sumBox.appendChild(row('Mesin: ' + engName + ' · ' + (isLocal ? 'Model: ' : 'Penyedia: ') + modelName + ' · Terjemahan: ' + trName,
        warn || ('Siap dipakai · Bahasa tujuan: ' + (S.trLangs[S.trLang] || S.trLang)),
        warn && (isLocal || S.trmode === 'nllb') ? (() => { const b = document.createElement('button'); b.className = 'btn sm pri'; b.textContent = 'Kelola model…'; b.onclick = goOff; return b; })() : null));
      const sd = sumBox.querySelector('.d'); if (sd) sd.style.color = warn ? 'var(--danger)' : 'var(--sub)';
      A(sumBox);
      const PS = [['umum', 'Umum'], ['suara', 'Mesin suara & terjemahan'], ['kotak', 'Kotak popup'], ['layar', 'Layar penuh']];
      const pills = el('<div style="display:flex;gap:6px;flex-wrap:wrap;margin:14px 0"></div>');
      PS.forEach(([k, l]) => { const b = document.createElement('button'); b.className = 'btn sm' + (playSub === k ? ' pri' : ''); b.textContent = l; b.onclick = () => { playSub = k; renderSec(false); }; pills.appendChild(b); });
      A(pills);
      if (playSub === 'umum') {
      A(grp('Video')); A(box([
        toggle('adblock', 'Blokir iklan YouTube', 'Hilangkan iklan video dan banner di YouTube'),
        row('Perkecil video', 'Tools → Gambar dalam gambar (PiP bawaan Chromium), bisa dipakai di situs apa pun', null)]));
      A(grp('Terjemahan')); A(box([
        toggle('ptr', 'Terjemahkan situs', 'Aktifkan "Terjemahkan halaman" di menu Tools (Ctrl+Alt+T). Bila mati, itemnya tampil redup di menu Tools dengan keterangan "Dimatikan di Play"'),
        toggle('tr', 'Terjemahan chat live', 'Terjemahkan chat live YouTube dan Twitch (juga tersedia di menu Tools)'),
        select('Bahasa tujuan', 'Dipakai untuk terjemahan situs, chat live, dan Terjemahan Suara', Object.entries(S.trLangs), S.trLang, v => set('trLang', v)),
        toggle('trhide', 'Sembunyikan teks asli', 'Hanya tampilkan hasil terjemahan')]));
      }
      if (playSub === 'suara') {
      A(grp('Terjemahan Suara'));
      const sr = [
        toggle('stt', 'Terjemahan Suara', 'Aktifkan "Terjemahan Suara" di menu Tools (Ctrl+Alt+S). Audio video dikenali lalu diterjemahkan di kotak popup, tanpa mikrofon.'),
        select('Mesin suara ke teks', 'Cloud butuh internet dan kunci API. Tiga mesin offline berjalan di PC ini, tanpa internet dan tanpa kunci. Mesin suara dan mesin terjemahan bebas dikombinasikan.', [['cloud', 'Whisper cloud (Groq / OpenAI / server sendiri)'], ['offline', 'Offline · sherpa-onnx (ringan dan cepat)'], ['tjs', 'Offline · Whisper (Transformers.js)'], ['vosk', 'Offline · Vosk (sangat ringan)']], S.stengine, v => set('stengine', v))];
      if (isLocal) {
        sr.push(button('Model suara · ' + ENGN[S.stengine], curM ? 'Dipakai: ' + curM.title : 'Belum ada model terpasang. Unduh satu dulu (mulai dari ±40 MB).', 'Kelola model…', goOff));
      } else {
        sr.push(select('Penyedia suara ke teks', 'Whisper di cloud, atau server Whisper milik Anda', [['groq', 'Groq (gratis, disarankan)'], ['openai', 'OpenAI (whisper-1)'], ['custom', 'Kustom (kompatibel OpenAI, mis. server Whisper lokal)']], S.stprov, v => set('stprov', v)));
        if (S.stprov === 'custom') {
          const u = document.createElement('input'); u.className = 'inp'; u.style.width = '300px'; u.placeholder = 'http://localhost:8000/v1'; u.value = S.stcurl || ''; u.onchange = async () => { if (u.value.trim() && !(await set('stcurl', u.value.trim()))) { alert('Alamat harus diawali http:// atau https://'); u.value = S.stcurl || ''; } else if (!u.value.trim()) set('stcurl', ''); };
          const m = document.createElement('input'); m.className = 'inp'; m.style.width = '200px'; m.placeholder = 'whisper-1'; m.value = S.stcmodel || ''; m.onchange = () => set('stcmodel', m.value.trim());
          sr.push(row('Alamat server', 'Basis API yang punya /audio/transcriptions (faster-whisper-server, LocalAI, whisper.cpp server…)', u), row('Nama model', 'Sesuai server Anda', m));
        }
        const kb = document.createElement('div'); kb.style.display = 'flex'; kb.style.gap = '6px';
        const kbtn = document.createElement('button'); kbtn.className = 'btn sm'; kbtn.textContent = S.stkeyMask ? 'Ganti…' : 'Isi…';
        kbtn.onclick = async () => { const r = await askText('Kunci API', [{ l: 'Kunci API (disimpan terenkripsi di PC ini, tidak ikut cadangan)', t: 'password', p: S.stprov === 'openai' ? 'sk-…' : 'gsk_…' }]); if (r && r[0].trim()) await api('stt.key', r[0]); };
        kb.appendChild(kbtn);
        if (S.stkeyMask) { const kd = document.createElement('button'); kd.className = 'btn sm danger'; kd.textContent = 'Hapus'; kd.onclick = () => api('stt.key', ''); kb.appendChild(kd); }
        sr.push(row('Kunci API', S.stkeyMask || (S.stprov === 'custom' ? 'Opsional untuk server lokal' : 'Belum diisi. Dapatkan gratis di console.groq.com'), kb));
      }
      sr.push(select('Terjemahan hasil suara', 'Online memakai Google Translate. Opus-MT: model kecil per pasangan bahasa. NLLB: satu model besar, lebih akurat untuk bahasa langka. Keduanya bisa dipakai dengan mesin suara apa pun.', [['online', 'Online (Google Translate)'], ['offline', 'Offline · Opus-MT (ringan, per pasangan)'], ['nllb', 'Offline · NLLB-200 600M (Transformers.js, semua bahasa)']], S.trmode, v => set('trmode', v)));
      if (S.trmode === 'nllb') {
        sr.push(button('Model NLLB-200 600M', OEs.nllb && OEs.nllb.installed ? 'Terpasang (' + fmtBytes(OEs.nllb.bytes) + '). Satu model untuk semua pasangan bahasa.' : 'Belum terpasang (±900 MB). Unduh dulu. Butuh ±1,5 GB RAM saat dipakai.', 'Kelola model…', goOff));
      }
      if (S.trmode === 'offline') {
        const n = OEs.mt.filter(p => p.installed).length;
        sr.push(button('Bahasa terjemahan offline', n ? n + ' model terpasang. Bahasa tujuan: ' + (S.trLangs[S.trLang] || S.trLang) : 'Belum ada model terpasang. Pilih bahasa lalu unduh.', 'Kelola bahasa…', goOff));
      }
      const LG = [['', 'Otomatis (deteksi bahasa)'], ['en-US', 'Inggris'], ['id-ID', 'Indonesia'], ['ja-JP', 'Jepang'], ['ko-KR', 'Korea'], ['zh-CN', 'Mandarin'], ['es-ES', 'Spanyol'], ['ar-SA', 'Arab'], ['hi-IN', 'Hindi'], ['fr-FR', 'Prancis'], ['de-DE', 'Jerman'], ['pt-BR', 'Portugis'], ['ru-RU', 'Rusia'], ['it-IT', 'Italia'], ['nl-NL', 'Belanda'], ['tr-TR', 'Turki'], ['th-TH', 'Thai'], ['vi-VN', 'Vietnam'], ['ms-MY', 'Melayu']];
      sr.push(select('Bahasa ucapan video', 'Memilih bahasa sendiri lebih cepat dan akurat daripada Otomatis. Dipakai juga untuk memilih model terjemahan offline. Vosk selalu memakai bahasa modelnya.', LG, S.stlang, v => set('stlang', v)),
        select('Kecepatan teks', 'Makin cepat, makin banyak permintaan API per menit', [['fast', 'Cepat (potongan maks ±3,8 dtk)'], ['bal', 'Seimbang (±5,5 dtk, disarankan)'], ['eco', 'Hemat (±8,5 dtk, jatah gratis awet)']], S.stspeed, v => set('stspeed', v)),
        button('Pengaturan audio', audSummary(), 'Buka', () => { sec = 'audio'; history.replaceState(null, '', '#audio'); renderSec(true); }));
      A(box(sr));
      A(grp('Riwayat terjemahan'));
      A(box([
        toggle('sthist', 'Catat riwayat Terjemahan Suara', 'Kalimat disimpan di memori (5 sesi terakhir, maks 3000 kalimat per sesi) supaya bisa disalin atau disimpan sebagai .txt / .srt. Tidak pernah dicatat di tab Incognito.'),
        toggle('stside', 'Buka riwayat di sisi video otomatis', 'Saat Terjemahan Suara dimulai, riwayat langsung tampil di panel sebelah video (tampilan terpisah)'),
        toggle('stauto', 'Simpan otomatis saat berhenti', 'Menulis berkas .srt dan .txt ke folder Unduhan → Transkrip Alethra setiap sesi selesai. Mati secara bawaan karena isinya berasal dari video yang Anda tonton.'),
        button('Riwayat', 'Buka daftar kalimat di sisi video, lengkap dengan tombol salin dan simpan', 'Buka riwayat', () => api('stt.hist'))
      ]));
      A(el('<p class="sub" style="margin-top:14px;font-size:12.5px">Cara pakai: putar video, buka menu Tools → Terjemahan Suara (atau Ctrl+Alt+S). Audio diambil langsung dari video, jadi video tidak dijeda dan tidak butuh mikrofon. Terbatas untuk video di iframe lintas-situs dan video ber-DRM. Batas Groq gratis: 20 permintaan/menit dan 2.000/hari; bila kena batas, Alethra jeda otomatis.</p>'));
      }

      const D = S.stDefs, dark = !!S.dark;
      const sb = (k, v) => set('stb', Object.assign({}, S.stb, { [k]: v })), sf = (k, v) => set('stf', Object.assign({}, S.stf, { [k]: v }));
      const px = (v) => v + ' px', pct = (v) => v + '%', autoPx = (v) => v ? v + ' px' : 'Otomatis';
      const shadowOpts = [['auto', 'Otomatis (saat latar tipis)'], ['on', 'Selalu'], ['off', 'Mati']];
      const B = S.stb;
      if (playSub === 'kotak') {
      A(grp('Kotak terjemahan suara (di luar layar penuh)'));
      A(el('<p class="sub" style="font-size:12.5px;margin:0 0 8px">Berlaku untuk kotak popup yang tampil di atas video. Geser kotaknya lewat bilah atasnya. Perubahan terlihat langsung saat Terjemahan Suara sedang berjalan.</p>'));
      A(box([
        slider('Transparansi latar', '0 = tembus pandang penuh, 100 = pekat', 0, 100, 1, B.bgop, pct, v => sb('bgop', v)),
        colorRow('Warna latar', 'Bawaan mengikuti tema terang/gelap', B.bgcol, dark ? (S.amoled ? '#000000' : '#0b0b0d') : '#ffffff', v => sb('bgcol', v), true),
        colorRow('Warna teks', 'Bawaan mengikuti tema terang/gelap', B.color, dark ? '#f4f4f5' : '#111113', v => sb('color', v), true),
        slider('Ukuran teks', '', 10, 72, 1, B.size, px, v => sb('size', v)),
        slider('Lebar kotak', 'Dibatasi mengikuti lebar jendela', 260, 2000, 10, B.width, px, v => sb('width', v)),
        slider('Tinggi kotak', '', 90, 800, 2, B.height, px, v => sb('height', v)),
        slider('Sudut membulat', '', 0, 40, 1, B.radius, px, v => sb('radius', v)),
        flag('Teks tebal', '', B.bold !== false, v => sb('bold', v)),
        flag('Garis tepi', '', B.border !== false, v => sb('border', v)),
        flag('Tampilkan kalimat sebelumnya', 'Baris kecil di atas terjemahan terbaru', B.prev !== false, v => sb('prev', v)),
        select('Bayangan teks', 'Membantu keterbacaan bila latar tipis atau transparan', shadowOpts, B.shadow, v => sb('shadow', v)),
        button('Atur ulang posisi', 'Kembalikan kotak ke tengah bawah setelah digeser', 'Atur ulang', () => api('stt.resetpos')),
        button('Tampilan bawaan', 'Kembalikan semua pengaturan kotak ini', 'Setel ulang', () => set('stb', D.stb))]));

      }
      if (playSub === 'layar') {
      A(grp('Teks suara di layar penuh'));
      const F = S.stf, NAMED = { white: '#ffffff', yellow: '#ffe14d', cyan: '#6fe3ff' }, SZ = { sm: 22, md: 30, lg: 40, xl: 52 };
      const effOp = F.bgop >= 0 ? F.bgop : ({ dim: 62, solid: 100, none: 0 }[F.bg] != null ? { dim: 62, solid: 100, none: 0 }[F.bg] : 62);
      A(box([
        select('Ukuran teks (preset)', '', [['sm', 'Kecil'], ['md', 'Sedang'], ['lg', 'Besar'], ['xl', 'Sangat besar']], F.size, v => set('stf', Object.assign({}, S.stf, { size: v, sizepx: 0 }))),
        slider('Ukuran teks (px)', 'Mengganti preset di atas', 10, 120, 1, F.sizepx > 0 ? F.sizepx : (SZ[F.size] || 30), px, v => sf('sizepx', v)),
        select('Posisi', '', [['bottom', 'Bawah'], ['top', 'Atas']], F.pos, v => sf('pos', v)),
        slider('Jarak dari tepi', 'Makin besar makin menjauh dari tepi layar', -40, 300, 2, F.offy, px, v => sf('offy', v)),
        slider('Transparansi latar', '0 = tanpa latar (pakai bayangan), 100 = pekat', 0, 100, 1, effOp, pct, v => sf('bgop', v)),
        colorRow('Warna latar', '', F.bgcol, '#000000', v => sf('bgcol', v)),
        colorRow('Warna teks', '', /^#[0-9a-f]{6}$/i.test(F.color) ? F.color : (NAMED[F.color] || '#ffffff'), '#ffffff', v => sf('color', v)),
        slider('Lebar kotak', '0 = otomatis mengikuti teks', 0, 2000, 10, F.width, autoPx, v => sf('width', v)),
        slider('Tinggi kotak', '0 = otomatis mengikuti teks', 0, 600, 5, F.height, autoPx, v => sf('height', v)),
        slider('Sudut membulat', '', 0, 40, 1, F.radius, px, v => sf('radius', v)),
        flag('Teks tebal', '', F.bold !== false, v => sf('bold', v)),
        select('Bayangan teks', 'Membantu keterbacaan bila latar tipis atau transparan', shadowOpts, F.shadow, v => sf('shadow', v)),
        flag('Tampilkan teks asli', 'Ucapan asli di bawah terjemahan (berlaku juga di kotak di luar layar penuh)', F.orig !== false, v => sf('orig', v)),
        button('Tampilan bawaan', 'Kembalikan semua pengaturan layar penuh', 'Setel ulang', () => set('stf', D.stf))]));
      }
    }
    if (sec === 'mesinoff') {
      OE = await api('oe.list') || { stt: [], mt: [], jobs: {}, langs: {}, groups: [] };
      A(el('<p class="sub">Alat offline untuk Terjemahan Suara. Suara ke teks: sherpa-onnx, Whisper (Transformers.js), atau Vosk. Terjemahan: Opus-MT atau NLLB-200 600M. Pilih satu mesin suara dan satu mesin terjemahan, bebas dikombinasikan (mis. sherpa-onnx + NLLB). Model hanya perlu diunduh sekali, lalu berjalan di PC ini tanpa internet. Mesin dimuat saat Terjemahan Suara dinyalakan dan dilepas dari memori beberapa detik setelah dimatikan.</p>'));
      A(grp('Sumber unduhan model'));
      {
        const MIR = [['', 'Hugging Face (resmi)'], ['https://hf-mirror.com', 'hf-mirror.com (cermin)'], ['custom', 'Alamat lain…']];
        const known = MIR.some(m => m[0] === (S.hfmirror || ''));
        const cur = (mirCustom || (S.hfmirror && !known)) ? 'custom' : (S.hfmirror || '');
        const rows = [select('Server model', 'Ganti bila Hugging Face lambat atau diblokir di jaringan Anda. Berlaku untuk unduhan berikutnya; tidak perlu variabel lingkungan.', MIR, cur, v => { if (v === 'custom') { mirCustom = true; renderSec(false); } else { mirCustom = false; set('hfmirror', v); } })];
        if (cur === 'custom') {
          const i = document.createElement('input'); i.className = 'inp'; i.style.width = '320px'; i.placeholder = 'https://cermin.contoh.com'; i.value = S.hfmirror || '';
          i.onchange = async () => { const v = i.value.trim().replace(/\/+$/, ''); if (!(await set('hfmirror', v))) { alert('Alamat harus diawali https:// (atau http://localhost)'); i.value = S.hfmirror || ''; } };
          rows.push(row('Alamat cermin', 'Susunan alamatnya harus sama dengan huggingface.co', i));
        }
        const pr = row('Uji koneksi', 'Periksa apakah server di atas bisa dijangkau dari PC ini. Model Vosk diunduh dari alphacephei.com dan tidak ikut cermin.', null);
        const pb = document.createElement('button'); pb.className = 'btn sm'; pb.textContent = 'Uji';
        pb.onclick = async () => { const d = pr.querySelector('.d'); pb.disabled = true; d.style.color = 'var(--sub)'; d.textContent = 'Menghubungi…'; const r = await api('oe.ping'); pb.disabled = false; d.style.color = r && r.ok ? 'var(--ok, var(--sub))' : 'var(--danger)'; d.textContent = r && r.ok ? 'Terhubung ke ' + r.base + ' (' + r.ms + ' ms)' : 'Gagal menghubungi ' + (r ? r.base : '') + ': ' + (r ? (r.err || 'HTTP ' + r.status) : 'tidak diketahui'); };
        pr.appendChild(pb); rows.push(pr);
        A(box(rows));
      }
      A(grp('Mesin'));
      A(box([
        select('Mesin suara ke teks', '', [['cloud', 'Whisper cloud'], ['offline', 'Offline · sherpa-onnx'], ['tjs', 'Offline · Whisper (Transformers.js)'], ['vosk', 'Offline · Vosk']], S.stengine, v => set('stengine', v)),
        select('Terjemahan hasil suara', '', [['online', 'Online (Google Translate)'], ['offline', 'Offline · Opus-MT'], ['nllb', 'Offline · NLLB-200 600M (Transformers.js)']], S.trmode, v => set('trmode', v))]));

      /* ----- model suara ke teks (tiga mesin) ----- */
      const SELK = { sherpa: 'stmodel', tjs: 'stwmodel', vosk: 'stvmodel' };
      const sttRows = (ms) => box(ms.map(oeRow(m => ({ id: m.id, title: m.title, desc: m.note, mb: m.mb, installed: m.installed, bytes: m.bytes, sel: S[SELK[m.engine]] === m.id, pick: () => set(SELK[m.engine], m.id) }))));
      const ENGHELP = {
        sherpa: 'Pilih satu model lalu tekan Pakai. Untuk video Jepang coba Moonshine tiny; untuk bahasa campuran pakai Whisper tiny atau base. Model yang lebih kecil lebih cepat tetapi kurang akurat.',
        tjs: 'Whisper yang dijalankan lewat Transformers.js (ONNX int8). Semua bahasa, bahasa dideteksi otomatis bila Bahasa ucapan video di Play diset Otomatis. Pakai tiny/base untuk PC biasa; small hanya untuk CPU kuat.',
        vosk: 'Vosk (Kaldi): satu model per bahasa, sangat ringan dan cepat, tanpa tanda baca dan kurang akurat pada ucapan bising. Tidak ada model Indonesia resmi; untuk ucapan Indonesia pakai Whisper.'
      };
      // hanya tampilkan model untuk mesin yang sedang dipilih di atas (cloud = tidak ada yang perlu diunduh)
      const ENGOF = { offline: 'sherpa', tjs: 'tjs', vosk: 'vosk' };
      const eg = ENGOF[S.stengine];
      if (!eg) {
        A(grp('Suara ke teks'));
        A(el('<p class="sub" style="font-size:12.5px;margin:0 0 8px">Mesin suara memakai Whisper cloud, jadi tidak ada model yang perlu diunduh. Pilih mesin offline (sherpa-onnx, Whisper Transformers.js, atau Vosk) di atas untuk melihat daftar model dan bahasanya.</p>'));
      } else {
        A(grp('Suara ke teks · ' + (OE.engines[eg] || eg)));
        A(el(`<p class="sub" style="font-size:12.5px;margin:0 0 8px">${esc(ENGHELP[eg])}</p>`));
        if (eg === 'sherpa') {
          OE.groups.forEach(([g, gname]) => {
            const ms = OE.stt.filter(m => m.engine === eg && m.lang === g); if (!ms.length) return;
            A(el(`<div class="group" style="margin-top:14px">${esc(gname)}</div>`)); A(sttRows(ms));
          });
        } else A(sttRows(OE.stt.filter(m => m.engine === eg)));
        const other = OE.stt.filter(m => m.engine !== eg && m.installed);
        if (other.length) A(el(`<p class="sub" style="font-size:12.5px;margin:10px 0 0">${other.length} model mesin lain masih terpasang (${esc(fmtBytes(other.reduce((a, m) => a + m.bytes, 0)))}). Ganti mesin di atas untuk mengelolanya.</p>`));
      }

      if (S.trmode !== 'offline' && S.trmode !== 'nllb') {
        A(grp('Terjemahan offline'));
        A(el('<p class=\"sub\" style=\"font-size:12.5px;margin:0 0 8px\">Terjemahan hasil suara memakai Google Translate (online), jadi tidak ada model yang perlu diunduh. Pilih Opus-MT atau NLLB-200 di atas untuk melihat daftar bahasa dan model yang bisa diunduh.</p>'));
      }
      /* ----- terjemahan offline ----- */
      const LN = OE.langs; const base = (v) => String(v || '').split('-')[0].toLowerCase();
      if (!mtS) mtS = base(S.stlang) && LN[base(S.stlang)] ? base(S.stlang) : 'ja';
      if (!mtT) mtT = LN[base(S.trLang)] ? base(S.trLang) : 'id';
      const opts = Object.entries(LN);
      if (S.trmode === 'offline') {
        A(grp('Terjemahan offline'));
        A(el('<p class="sub" style="font-size:12.5px;margin:0 0 8px">Model Opus-MT (±85 MB per arah). Kebanyakan bahasa lewat Inggris, jadi Jepang → Indonesia memakai dua model (Jepang → Inggris dan Inggris → Indonesia). Pilih pasangan lalu unduh yang diperlukan.</p>'));
        const planRow = row('Status', 'Memeriksa…', null);
        const showPlan = async () => {
          const p = await api('oe.plan', mtS, mtT); const d = planRow.querySelector('.d');
          if (p === null) d.textContent = 'Pasangan bahasa ini belum didukung.';
          else if (!p.length) d.textContent = mtS === mtT ? 'Bahasa sumber dan tujuan sama.' : 'Siap dipakai.';
          else d.textContent = 'Perlu diunduh: ' + p.map(id => { const q = OE.mt.find(x => x.id === id); return LN[q.src] + ' → ' + LN[q.tgt]; }).join(', ') + ' (±' + p.length * 85 + ' MB).';
          return p;
        };
        const goBtn = document.createElement('button'); goBtn.className = 'btn sm pri'; goBtn.textContent = 'Unduh yang diperlukan';
        goBtn.onclick = async () => { const p = await showPlan(); if (p === null) return alert('Pasangan bahasa ini belum didukung.'); if (!p.length) return; for (const id of p) await api('oe.dl', id); renderSec(false); };
        planRow.appendChild(goBtn);
        A(box([select('Dari bahasa', 'Bahasa ucapan di video', opts, mtS, v => { mtS = v; showPlan(); }), select('Ke bahasa', 'Bahasa terjemahan', opts, mtT, v => { mtT = v; showPlan(); }), planRow,
          button('Coba terjemahan', 'Uji model yang terpasang dengan satu kalimat', 'Coba…', async () => {
            const r = await askText('Coba terjemahan offline', [{ l: LN[mtS] + ' → ' + LN[mtT], v: '', p: 'Ketik kalimat dalam ' + LN[mtS] }], 'Terjemahkan'); if (!r || !r[0].trim()) return;
            const o = await api('oe.test', r[0], mtS, mtT); alert(o && o.ok ? o.text : 'Gagal: ' + (o ? o.err : 'tidak diketahui'));
          }),
          toggle('mtfb', 'Cadangan terjemahan online', 'Bila model offline belum terpasang atau gagal, pakai Google Translate')]));
        showPlan();
        const pairs = OE.mt.filter(p => p.installed || (OE.jobs[p.id] && (OE.jobs[p.id].busy || OE.jobs[p.id].error)));
        A(el('<div class="group" style="margin-top:14px">Model terjemahan terpasang</div>'));
        if (!pairs.length) A(el('<div class="list"><div class="empty" style="padding:22px">Belum ada model terjemahan.</div></div>'));
        else A(box(pairs.map(oeRow(p => ({ id: p.id, title: LN[p.src] + ' → ' + LN[p.tgt], desc: 'Opus-MT, int8', mb: p.mb, installed: p.installed, bytes: p.bytes, sel: false })))));

      }
      /* ----- NLLB ----- */
      if (S.trmode === 'nllb') {
        A(grp('Terjemahan offline · NLLB-200 600M (Transformers.js)'));
        A(el('<p class="sub" style="font-size:12.5px;margin:0 0 8px">Satu model untuk semua pasangan bahasa (±200 bahasa), tanpa lewat Inggris, jadi lebih akurat daripada Opus-MT untuk pasangan seperti Jepang → Indonesia. Lebih besar dan lebih lambat: ±900 MB unduhan, ±1,5 GB RAM saat dipakai. Cocok dipasangkan dengan sherpa-onnx atau Whisper.</p>'));
        const NL = OE.nllb || { id: 'nllb-600m', title: 'NLLB-200 600M', mb: 900, installed: false, bytes: 0 };
        A(box([select('Dari bahasa', 'Untuk uji coba terjemahan', opts, mtS, v => { mtS = v; }), select('Ke bahasa', 'Untuk uji coba terjemahan', opts, mtT, v => { mtT = v; }),
          oeRow(m => m)({ id: NL.id, title: NL.title, desc: 'Transformers.js, int8', mb: NL.mb, installed: NL.installed, bytes: NL.bytes, sel: S.trmode === 'nllb', pick: () => set('trmode', 'nllb') }),
          button('Coba NLLB', 'Uji dengan satu kalimat memakai pasangan bahasa di atas', 'Coba…', async () => {
            const r = await askText('Coba terjemahan NLLB', [{ l: LN[mtS] + ' → ' + LN[mtT], v: '', p: 'Ketik kalimat dalam ' + LN[mtS] }], 'Terjemahkan'); if (!r || !r[0].trim()) return;
            const o = await api('oe.test', r[0], mtS, mtT, 'nllb'); alert(o && o.ok ? o.text : 'Gagal: ' + (o ? o.err : 'tidak diketahui'));
          })]));

      }

      /* ----- kinerja & penyimpanan ----- */
      A(grp('Kinerja dan penyimpanan'));
      A(box([
        select('Thread CPU', 'Otomatis memakai setengah inti CPU (2-4). Naikkan bila PC kuat; turunkan bila video tersendat.', [[0, 'Otomatis'], [1, '1'], [2, '2'], [3, '3'], [4, '4'], [6, '6'], [8, '8']], S.ofthreads | 0, v => set('ofthreads', +v)),
        button('Penyimpanan model', fmtBytes(OE.total) + ' dipakai · ' + OE.root, 'Buka folder', () => api('oe.dir'))]));
    }
    if (sec === 'audio') {
      A(el('<p class="sub">Mengatur cara audio video diproses sebelum diubah jadi teks. Perubahan langsung diterapkan ke Terjemahan Suara yang sedang berjalan.</p>'));
      A(box([button('Kembali ke Play', '', '← Play', () => { sec = 'play'; history.replaceState(null, '', '#play'); renderSec(true); })]));
      const T = S.sta, st = (k, v) => set('sta', Object.assign({}, T, { [k]: v }));
      A(grp('Mode')); A(box([
        (() => { const c = el('<label class="sw"><input type="checkbox"><i></i></label>'); c.firstChild.checked = !!T.legacy; c.firstChild.onchange = () => st('legacy', c.firstChild.checked); return row('Mode klasik (v78)', 'Proses audio seperti v78: tanpa pembersih audio, tanpa penguat otomatis', c); })(),
        button('Preset cepat', 'Video bising, Suara pelan, Musik latar, dll.', 'Pilih…', presetDlg)]));
      const grpOpts = (label, keys) => { A(grp(label)); A(box(keys.map(k => { const o = STA.find(x => x.key === k); return select(o.title, o.help, o.vals.map((v, i) => [v, o.names[i] + (v === o.def ? ' (bawaan)' : '')]), T[k], v => st(k, +v)); }))); };
      grpOpts('Volume dan ambang', ['pg', 'min', 'max', 'sens', 'dur']);
      grpOpts('Pembersih suara', ['ns', 'gate', 'hp', 'lp', 'auto']);
      A(grp('Teks hasil')); const ml = STA.find(x => x.key === 'minlen');
      A(box([select(ml.title, ml.help, ml.vals.map((v, i) => [v, ml.names[i]]), T.minlen, v => st('minlen', +v)),
        (() => { const c = el('<label class="sw"><input type="checkbox"><i></i></label>'); c.firstChild.checked = T.filt !== false; c.firstChild.onchange = () => st('filt', c.firstChild.checked); return row('Saring halusinasi dan derau teks', 'Buang kalimat khas model pada musik/senyap dan pengulangan berlebihan', c); })()]));
      A(grp('Diagnostik')); A(box([
        (() => { const c = el('<label class="sw"><input type="checkbox"><i></i></label>'); c.firstChild.checked = !!T.meter; c.firstChild.onchange = () => st('meter', c.firstChild.checked); return row('Tampilkan level volume', 'Tampilkan level dB di status kotak, untuk menentukan Volume minimum/maksimum', c); })(),
        button('Atur ulang pengaturan audio', 'Kembalikan semua ke bawaan', 'Atur ulang', async () => { if (await askConfirm('Atur ulang pengaturan audio?', 'Semua kembali ke bawaan.', 'Atur ulang')) set('sta', DEFSTA); })]));
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
