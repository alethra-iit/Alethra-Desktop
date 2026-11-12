(function () {
  // Notepad melayang. Tampilan ini hidup di WebContentsView sendiri; posisi/ukuran/mode ikon diatur main.js lewat api('note.*').
  // Isi lembar kerja disimpan ke main (notes.json) 0,5 dtk setelah berhenti mengetik, dan langsung saat ditutup / Simpan.
  const box = $('#box'), ico = $('#ico');
  let sheets = [], cur = 0, min = false, ta = null, status = null, tabRow = null, saveT = null, tipT = null, ready = false;
  const uid = () => Date.now() * 1000 + Math.floor(Math.random() * 1000);
  const sh = () => sheets[Math.max(0, Math.min(sheets.length - 1, cur))];

  const nextName = () => { let n = 1; while (sheets.some(s => s.n.trim().toLowerCase() === 'lembar ' + n)) n++; return 'Lembar ' + n; };
  const fileName = (s) => {
    const b = s.n.replace(/[\\/:*?"<>|\r\n]/g, '-').trim().replace(/^\.+|\.+$/g, '') || ('catatan-' + new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-'));
    return /\.(txt|md|srt|log|csv|json)$/i.test(b) ? b : b + '.txt';
  };

  function persist(now) {
    clearTimeout(saveT);
    const go = () => { if (ta && sheets.length) sh().t = ta.value; return api('note.save', { cur, list: sheets.map(s => ({ id: s.id, n: s.n, t: s.t, s: s.s, f: s.f })) }); };
    if (now) return go();
    saveT = setTimeout(go, 500);
  }
  function tip(msg) {
    let t = $('#tip'); if (!t) { t = document.createElement('div'); t.id = 'tip'; box.appendChild(t); }
    t.textContent = msg; clearTimeout(tipT); tipT = setTimeout(() => { const x = $('#tip'); if (x) x.remove(); }, 2200);
  }
  const refreshStatus = () => { if (status && ta) status.textContent = ta.value === sh().s ? 'Tersimpan' : 'Belum disimpan'; };

  // dialog kecil di dalam kotak: buttons = [{ k, l, cls }], input = { v, p } (opsional) -> Promise<{ k, v }>
  function ask(title, msg, buttons, input) {
    return new Promise(res => {
      const m = document.createElement('div'); m.className = 'md';
      m.innerHTML = `<div class="c" role="dialog" aria-label="${esc(title)}"><h4>${esc(title)}</h4>${msg ? `<p>${esc(msg)}</p>` : ''}${input ? `<input class="inp" maxlength="80" value="${esc(input.v || '')}" placeholder="${esc(input.p || '')}" spellcheck="false">` : ''}<div class="end">${buttons.map(b => `<button class="btn sm ${b.cls || ''}" data-k="${b.k}">${esc(b.l)}</button>`).join('')}</div></div>`;
      box.appendChild(m);
      const inp = $('input', m), done = (k) => { m.remove(); res({ k, v: inp ? inp.value : '' }); if (ta) ta.focus(); };
      $$('button', m).forEach(b => { b.onclick = () => done(b.dataset.k); });
      m.addEventListener('keydown', e => { if (e.key === 'Escape') done('x'); if (e.key === 'Enter' && inp) done(buttons.find(b => b.cls === 'pri').k); });
      m.addEventListener('mousedown', e => { if (e.target === m) done('x'); });
      (inp || $('button.pri', m) || $('button', m)).focus(); if (inp) inp.select();
    });
  }

  // geser / ubah ukuran: main menerima jarak total sejak mulai (api 'note.drag' start/move|resize/end)
  function dragger(el, kind, onClick) {
    let d = null;
    el.addEventListener('pointerdown', e => {
      if (e.button !== 0 || e.target.closest('button')) return;
      d = { x: e.screenX, y: e.screenY, id: e.pointerId, on: false };
      try { el.setPointerCapture(e.pointerId); } catch {}
      e.preventDefault();
    });
    el.addEventListener('pointermove', e => {
      if (!d || e.pointerId !== d.id) return;
      const dx = e.screenX - d.x, dy = e.screenY - d.y;
      if (!d.on) { if (onClick && Math.abs(dx) + Math.abs(dy) < 5) return; d.on = true; el.classList.add('drag'); api('note.drag', 'start'); }
      api('note.drag', kind, dx, dy);
    });
    const end = e => {
      if (!d || e.pointerId !== d.id) return;
      const was = d; d = null; el.classList.remove('drag');
      try { el.releasePointerCapture(e.pointerId); } catch {}
      if (was.on) api('note.drag', 'end'); else if (onClick && e.type === 'pointerup') onClick();
    };
    el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end);
  }

  function showSheet(i) {
    sh().t = ta.value;
    cur = Math.max(0, Math.min(sheets.length - 1, i));
    ta.value = sh().t; ta.setSelectionRange(ta.value.length, ta.value.length);
    refreshStatus(); rebuild(); persist(true); ta.focus();
  }
  function addSheet() { sh().t = ta.value; sheets.push({ id: uid(), n: nextName(), t: '', s: '', f: '' }); showSheet(sheets.length - 1); }
  async function delSheet(i) {
    if (i < 0 || i >= sheets.length) return;
    const s = sheets[i], txt = i === cur ? ta.value : s.t;
    if (txt.trim()) {
      const r = await ask('Hapus lembar kerja', `"${s.n}" beserta isinya akan dihapus.` + (sheets.length === 1 ? ' Sebagai gantinya dibuat lembar kosong.' : ''), [{ k: 'x', l: 'Batal' }, { k: 'ok', l: 'Hapus', cls: 'pri' }]);
      if (r.k !== 'ok') return;
    }
    sh().t = ta.value;
    const was = cur; sheets.splice(i, 1);
    if (!sheets.length) { sheets.push({ id: uid(), n: nextName(), t: '', s: '', f: '' }); cur = 0; }
    else if (i < was) cur = was - 1; else if (i === was) cur = Math.min(i, sheets.length - 1);
    ta.value = sh().t; ta.setSelectionRange(ta.value.length, ta.value.length);
    refreshStatus(); rebuild(); persist(true); ta.focus();
  }
  async function renameSheet(i) {
    const s = sheets[i]; if (!s) return;
    const r = await ask('Ganti nama lembar kerja', '', [{ k: 'x', l: 'Batal' }, { k: 'ok', l: 'Simpan', cls: 'pri' }], { v: s.n, p: 'Nama lembar kerja' });
    if (r.k !== 'ok') return;
    const n = r.v.replace(/\n/g, ' ').trim();
    if (!n) return tip('Nama tidak boleh kosong');
    s.n = n; rebuild(); persist(true);
  }
  function rebuild() {
    tabRow.innerHTML = '';
    let curChip = null;
    sheets.forEach((s, i) => {
      const on = i === cur, c = document.createElement('div');
      c.className = 'chip2' + (on ? ' on' : ''); c.title = s.n + (on ? ' (ketuk lagi untuk ganti nama)' : '');
      c.innerHTML = `<span class="nm">${esc(s.n)}</span><span class="x" title="Hapus ${esc(s.n)}" aria-label="Hapus ${esc(s.n)}">${ICON('close', 14)}</span>`;
      c.onclick = (e) => { if (e.target.closest('.x')) return delSheet(i); if (i !== cur) showSheet(i); else renameSheet(i); };
      c.oncontextmenu = (e) => { e.preventDefault(); renameSheet(i); };
      tabRow.appendChild(c); if (on) curChip = c;
    });
    const p = document.createElement('div'); p.className = 'plus'; p.title = 'Lembar kerja baru'; p.setAttribute('aria-label', 'Lembar kerja baru'); p.innerHTML = ICON('plus', 16); p.onclick = addSheet;
    tabRow.appendChild(p);
    if (curChip) setTimeout(() => { tabRow.scrollLeft = Math.max(0, curChip.offsetLeft - 24); }, 0);
  }

  async function doSave() {
    const t = ta.value;
    if (!t.trim()) return tip('Belum ada teks untuk disimpan');
    const s = sh(); s.t = t; s.s = t; refreshStatus(); persist(true);
    await api('note.export', fileName(s), t);   // main menampilkan toast "Tersimpan: nama berkas"
  }
  function insertAtSel(txt) {
    const a = ta.selectionStart, z = ta.selectionEnd;
    ta.setRangeText(txt, a, z, 'end'); ta.dispatchEvent(new Event('input', { bubbles: true })); ta.focus();
  }
  async function doOpen() {
    const r = await api('note.pick');
    if (!r) return;
    if (r.err) return tip(r.err);
    const apply = (replace) => {
      const s = sh();
      const merged = replace ? r.text : ta.value.replace(/\s+$/, '') + '\n\n' + r.text;
      if (replace) { s.f = r.name; if (r.name) s.n = r.name; }   // nama berkas jadi judul lembar kerja
      ta.value = merged; s.t = merged; ta.setSelectionRange(0, 0); ta.scrollTop = 0;
      refreshStatus(); rebuild(); persist(true); tip('Dibuka: ' + r.name);
    };
    if (!ta.value.trim() || ta.value === r.text) return apply(true);
    const a = await ask('Buka berkas', 'Catatan yang sedang ada akan diganti dengan isi berkas ini.', [{ k: 'x', l: 'Batal' }, { k: 'add', l: 'Tambahkan' }, { k: 'rep', l: 'Ganti', cls: 'pri' }]);
    if (a.k === 'rep') apply(true); else if (a.k === 'add') apply(false);
  }

  function build() {
    box.innerHTML = `<div class="nh" id="nh">${ICON('note', 18)}<span class="t">Notepad</span><button class="nb" id="bm" title="Perkecil" aria-label="Perkecil">${ICON('minus', 18)}</button><button class="nb" id="bx" title="Tutup" aria-label="Tutup">${ICON('close', 18)}</button></div>
      <div class="nt" id="nt"></div>
      <div class="nbar"><button class="tool" id="tOpen" title="Buka berkas" aria-label="Buka berkas">${ICON('folder', 20)}</button><button class="tool" id="tCopy" title="Salin (teks terpilih atau semua)" aria-label="Salin">${ICON('copy', 20)}</button><button class="tool" id="tPaste" title="Tempel" aria-label="Tempel">${ICON('paste', 20)}</button><button class="tool pri" id="tSave" title="Simpan (Ctrl+S)" aria-label="Simpan">${ICON('save', 20)}</button></div>
      <textarea id="ta" placeholder="Tulis catatan di sini…" spellcheck="true"></textarea>
      <div class="nf"><span class="st" id="st"></span><div class="rz" id="rz" title="Ubah ukuran" aria-label="Ubah ukuran">${ICON('resize', 15)}</div></div>`;
    ta = $('#ta'); status = $('#st'); tabRow = $('#nt');
    dragger($('#nh'), 'move');
    dragger($('#rz'), 'resize');
    $('#bm').onclick = () => { persist(true); api('note.min'); };
    $('#bx').onclick = () => { persist(true); api('note.close'); };
    $('#tOpen').onclick = doOpen;
    $('#tCopy').onclick = async () => {
      const a = Math.min(ta.selectionStart, ta.selectionEnd), z = Math.max(ta.selectionStart, ta.selectionEnd), sel = z > a;
      const t = sel ? ta.value.slice(a, z) : ta.value;
      if (!t) return tip('Belum ada teks untuk disalin');
      await api('note.clip', 'w', t); tip(sel ? 'Teks terpilih disalin' : 'Semua teks disalin');
    };
    $('#tPaste').onclick = async () => { const t = await api('note.clip', 'r'); if (!t) return tip('Clipboard kosong'); insertAtSel(t); };
    $('#tSave').onclick = doSave;
    ta.addEventListener('input', () => { sh().t = ta.value; refreshStatus(); persist(false); });
    ta.value = sh().t; refreshStatus(); rebuild();
  }

  function setMode(m) {
    min = !!m;
    if (!ready) return;
    box.hidden = min; ico.hidden = !min;
    if (!min && ta) ta.focus();
  }

  async function init() {
    const st = await api('settings.get'); if (st) applyTheme(st);
    alethra.on('settings', s => applyTheme(s));
    const r = await api('note.state') || {};
    const n = r.notes || {};
    sheets = (n.list || []).map((x, i) => ({ id: x.id || uid() + i, n: x.n || 'Lembar ' + (i + 1), t: x.t || '', s: x.s || '', f: x.f || '' }));
    cur = Math.max(0, Math.min(Math.max(0, sheets.length - 1), n.cur | 0));
    if (!sheets.length) { sheets.push({ id: uid(), n: 'Lembar 1', t: '', s: '', f: '' }); cur = 0; }
    ico.innerHTML = ICON('note', 22);
    build(); ready = true; setMode(r.min);
    dragger(ico, 'move', () => api('note.restore'));
    ico.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); api('note.restore'); } });
    alethra.on('note.mode', m => setMode(m && m.min));
    alethra.on('note.focus', () => { if (ta && !min) ta.focus(); });
    alethra.on('note.save', () => { if (!min && ta) doSave(); });
    alethra.on('note.flush', () => persist(true));
    window.addEventListener('beforeunload', () => { persist(true); });
  }
  init();
})();
