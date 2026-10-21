(async function () {
  await pageInit();
  const app = $('#app');
  app.innerHTML = `<h1>Riwayat Terjemahan Suara</h1>
  <p class="sub">Kalimat yang ditangkap dari video. Disimpan di memori (5 sesi terakhir), tidak dicatat di tab Incognito.</p>
  <div class="bar"><select id="ss" class="grow" aria-label="Sesi"></select>
    <select id="md" aria-label="Isi yang ditampilkan"><option value="both">Terjemahan + asli</option><option value="tr">Terjemahan saja</option><option value="orig">Asli saja</option></select>
    <input id="q" type="search" class="grow" placeholder="Cari kalimat…" aria-label="Cari kalimat"></div>
  <div class="bar"><label><input type="checkbox" id="ts" checked><span>Waktu</span></label><label><input type="checkbox" id="fl" checked><span>Ikuti yang terbaru</span></label>
    <div class="acts" style="margin-left:auto"><button class="btn" id="cp">Salin semua</button><button class="btn" id="t1">Simpan .txt</button><button class="btn" id="t2">Simpan .srt</button><button class="btn" id="cl">Hapus</button></div></div>
  <div id="st"></div><div id="ls" role="log" aria-live="polite"></div>`;
  const ls = $('#ls'), ss = $('#ss'), md = $('#md'), q = $('#q'), ts = $('#ts'), fl = $('#fl'), st = $('#st');
  let sess = [], cur = null, entries = [], manual = false, rows = new Map();
  const start = (e) => (e.vs >= 0 ? e.vs : e.ws / 1000);
  const fmt = (s) => { s = Math.max(0, Math.floor(s)); const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), x = s % 60, p = (n) => String(n).padStart(2, '0'); return (h ? h + ':' + p(m) : m) + ':' + p(x); };
  const hl = (t) => { t = esc(t || ''); const k = q.value.trim(); if (!k) return t; const re = new RegExp('(' + esc(k).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'ig'); return t.replace(re, '<mark>$1</mark>'); };
  const match = (e) => { const k = q.value.trim().toLowerCase(); return !k || (e.orig || '').toLowerCase().includes(k) || (e.tr || '').toLowerCase().includes(k); };
  function rowOf(e) {
    const d = document.createElement('div'); d.className = 'it' + (!e.tr && e.orig && md.value !== 'orig' ? ' wait' : ''); d.dataset.seq = e.seq;
    const m = md.value, main = m === 'orig' ? e.orig : (e.tr || e.orig), sub = m === 'both' && e.tr && e.orig && e.tr !== e.orig ? e.orig : '';
    const t = document.createElement('button'); t.className = 'tm' + (e.vs >= 0 ? ' go' : ''); t.textContent = ts.checked ? fmt(start(e)) : '';
    if (!ts.checked) t.style.display = 'none';
    if (e.vs >= 0) { t.title = 'Lompat ke posisi ini di video'; t.onclick = () => api('stt.seek', cur, e.vs); }
    const x = document.createElement('div'); x.className = 'tx'; x.innerHTML = `<div class="tr">${hl(main)}</div>${sub ? `<div class="or">${hl(sub)}</div>` : ''}`;
    const c = document.createElement('button'); c.className = 'cp'; c.title = 'Salin kalimat ini'; c.setAttribute('aria-label', 'Salin kalimat ini'); c.innerHTML = ICON('copy', 15);
    c.onclick = async () => { await api('clip.write', [main, sub].filter(Boolean).join('\n')); c.innerHTML = ICON('check', 15); setTimeout(() => { c.innerHTML = ICON('copy', 15); }, 1200); };
    d.append(t, x, c); return d;
  }
  function stat() {
    const s = sess.find(x => x.id === cur), n = entries.filter(e => e.orig || e.tr).length;
    st.innerHTML = s ? `${s.live ? '<span class="dot"></span><span>Sedang berjalan</span>' : '<span>Selesai</span>'}<span>· ${n} kalimat</span>${entries.some(e => e.vs >= 0) ? '<span>· waktu mengikuti video</span>' : '<span>· waktu sejak sesi dimulai</span>'}` : '';
  }
  function renderAll() {
    ls.innerHTML = ''; rows.clear();
    const list = entries.filter(e => (e.orig || e.tr) && match(e)).sort((a, b) => start(a) - start(b));
    if (!list.length) {
      ls.innerHTML = `<div class="empty">${cur == null ? 'Belum ada riwayat.<br>Buka video, lalu mulai <b>Terjemahan Suara</b> (Ctrl+Alt+S) dari menu Tools. Kalimat akan muncul di sini.<br><br>Riwayat tidak dicatat di tab Incognito atau bila dimatikan di Pengaturan → Play.' : (q.value.trim() ? 'Tidak ada kalimat yang cocok.' : 'Menunggu ucapan…')}</div>`;
    } else list.forEach(e => { const r = rowOf(e); rows.set(e.seq, r); ls.appendChild(r); });
    stat(); if (fl.checked) ls.scrollTop = ls.scrollHeight;
  }
  function upsert(e) {
    const i = entries.findIndex(x => x.seq === e.seq); if (i >= 0) entries[i] = e; else entries.push(e);
    const old = rows.get(e.seq);
    if (!(e.orig || e.tr) || !match(e)) { if (old) { old.remove(); rows.delete(e.seq); } stat(); return; }
    if (old) { const nr = rowOf(e); old.replaceWith(nr); rows.set(e.seq, nr); }
    else {
      const last = ls.lastElementChild, ok = !last || !last.dataset || !last.dataset.seq || start(entries.find(x => String(x.seq) === last.dataset.seq) || e) <= start(e);
      if (!ok) return renderAll();
      if (!rows.size) ls.innerHTML = '';
      const r = rowOf(e); rows.set(e.seq, r); ls.appendChild(r);
    }
    stat(); if (fl.checked) ls.scrollTop = ls.scrollHeight;
  }
  function fillSess() {
    ss.innerHTML = '';
    if (!sess.length) { ss.innerHTML = '<option>Belum ada sesi</option>'; ss.disabled = true; return; }
    ss.disabled = false;
    sess.forEach(s => { const o = document.createElement('option'); o.value = s.id; let host = ''; try { host = new URL(s.url).hostname; } catch {} o.textContent = (s.live ? '● ' : '') + (s.title || host || 'Video') + ' · ' + new Date(s.started).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' · ' + s.n; ss.appendChild(o); });
    if (cur != null) ss.value = cur;
  }
  async function pick(id) { cur = id; entries = id == null ? [] : (await api('stt.entries', id)) || []; fillSess(); renderAll(); }
  async function init() { sess = (await api('stt.sessions')) || []; await pick(sess.length ? sess[0].id : null); }
  ss.onchange = () => { manual = true; pick(+ss.value); };
  md.onchange = renderAll; ts.onchange = renderAll; q.oninput = renderAll;
  const flash = (b, t) => { const o = b.textContent; b.textContent = t; setTimeout(() => { b.textContent = o; }, 1500); };
  $('#cp').onclick = async (ev) => { if (cur == null) return; const ok = await api('stt.copy', cur, md.value, ts.checked); flash(ev.target, ok ? 'Tersalin ✓' : 'Kosong'); };
  $('#t1').onclick = () => cur != null && api('stt.export', cur, 'txt', md.value, ts.checked);
  $('#t2').onclick = () => cur != null && api('stt.export', cur, 'srt', md.value, ts.checked);
  $('#cl').onclick = async () => { if (cur == null || !entries.length) return; if (!confirm('Hapus semua kalimat di sesi ini dari riwayat?')) return; await api('stt.clear', cur); };
  alethra.on('stt-sess', async (list) => {
    sess = list || []; const top = sess[0];
    if (top && top.live && top.id !== cur && !manual) return pick(top.id);          // sesi baru dimulai: ikuti otomatis
    if (cur != null && !sess.some(s => s.id === cur)) return pick(sess.length ? sess[0].id : null);
    fillSess(); stat();
  });
  alethra.on('stt-log', ({ sid, entry }) => { if (sid !== cur) return; if (entry === null) { entries = []; return renderAll(); } upsert(entry); });
  await init();
})();
