(function () {
  let st = {}, lastModal = null;
  const SIC = { go: 'search', bm: 'star', hist: 'clock' };
  const catcher = $('#catch');
  catcher.addEventListener('mousedown', () => api('ov.close'));
  const hide = (id, v) => { $('#' + id).hidden = !v; };
  function render() {
    const s = st;
    catcher.style.display = (s.suggest || s.menu) ? '' : 'none';
    // saran alamat
    if (s.suggest) {
      const el = $('#sug'); el.hidden = false; el.style.left = Math.max(4, s.suggest.x) + 'px'; el.style.width = Math.max(300, s.suggest.w) + 'px';
      el.innerHTML = '';
      s.suggest.items.forEach((it, i) => {
        const d = document.createElement('div'); d.className = 'si' + (i === s.suggest.sel ? ' sel' : '');
        d.innerHTML = `<div class="ic">${ICON(SIC[it.k] || 'search', 18)}</div><div class="m"><div class="a">${esc(it.title)}</div>${it.sub ? `<div class="b">${esc(it.sub)}</div>` : ''}</div>`;
        d.onmousedown = e => { e.preventDefault(); api('ov.pick', i); };
        el.appendChild(d);
      });
    } else hide('sug', false);
    // menu utama
    if (s.menu) {
      const el = $('#menu'); el.hidden = false; el.innerHTML = ''; el.style.right = (s.menu.right != null ? s.menu.right : 8) + 'px';
      s.menu.items.forEach(it => {
        if (it.sep) { el.insertAdjacentHTML('beforeend', '<div class="msep"></div>'); return; }
        if (it.head) { el.insertAdjacentHTML('beforeend', `<div class="mhd">${esc(it.head)}</div>`); return; }
        if (it.zoom) {
          const z = document.createElement('div'); z.className = 'zr'; z.innerHTML = `<span class="l">Zoom</span><button data-d="-1">−</button><span class="v">${it.zoom}%</span><button data-d="1">+</button><button data-d="0" title="Setel ulang">⟲</button>`;
          $$('button', z).forEach(b => b.onclick = () => api('ov.zoom', +b.dataset.d)); el.appendChild(z); return;
        }
        const d = document.createElement('div'); d.className = 'mi' + (it.off ? ' off' : '') + (it.dim ? ' dim' : '');
        // dim = item tidak bisa dipakai sekarang, tapi tetap bisa diklik untuk membuka pengaturan yang menyebabkannya; note = alasannya
        d.innerHTML = `<span class="ck">${it.check ? ICON('check', 16) : ''}</span><span class="l">${esc(it.label)}</span>${it.note ? `<span class="nt">${esc(it.note)}</span>` : `<span class="k">${esc(it.key || '')}</span>`}`;
        if (it.note) d.title = it.note + ' — klik untuk membuka pengaturan';
        d.onclick = () => api('ov.menu', it.id); el.appendChild(d);
      });
    } else hide('menu', false);
    // modal
    const m = s.modal, md = $('#modal');
    if (m) {
      const key = m.type === 'tabs' ? 'tabs:' + m.data.sid : JSON.stringify(m);
      if (key !== lastModal) { lastModal = key; tabsUpd = null; buildModal(m); }
      md.hidden = false; md.classList.toggle('opaque', m.type === 'pin' && m.data.dismissable === false); md.classList.toggle('top', m.type === 'tabs');
    } else { md.hidden = true; lastModal = null; tabsUpd = null; md.innerHTML = ''; }
    // suara ke teks
    renderStt(s);
    // toast
    const t = $('#toast'); if (s.toast) { t.hidden = false; t.textContent = s.toast; } else t.hidden = true;
  }
  const rgba = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; };
  function renderStt(s) {
    const el = $('#stt'), t = s.stt;
    if (!t) { el.hidden = true; el.innerHTML = ''; el.className = ''; el.removeAttribute('style'); return; }
    el.hidden = false;
    const c = t.cfg, cur = t.cur || {}, main = cur.tr || cur.orig || '', sub = (cur.tr && c.orig) ? cur.orig : '';
    const pos = `left:${t.rect.x - s.ox}px;top:${t.rect.y - s.oy}px;width:${t.rect.w}px;height:${t.rect.h}px;`;
    if (t.fs) {
      const bg = c.bgop <= 0 ? 'transparent' : rgba(c.bgcol, c.bgop / 100);
      const sh = c.shadow ? '0 0 4px #000,0 0 8px #000,1px 1px 2px #000' : 'none';
      el.className = 'fs'; el.removeAttribute('style');
      el.style.cssText = pos + `justify-content:${c.pos === 'top' ? 'flex-start' : 'flex-end'}`;
      const box = `font-size:${c.size}px;color:${c.color};background:${bg};text-shadow:${sh};border-radius:${c.radius}px;font-weight:${c.bold ? 600 : 400}` + (c.fixW ? ';display:block;width:100%' : '') + (c.fixH ? ';height:100%;box-sizing:border-box;display:flex;flex-direction:column;justify-content:center' : '');
      el.innerHTML = main ? `<div class="fsb" style="${box}"><div class="l1">${esc(main)}</div>${sub ? `<div class="l2" style="font-size:${Math.round(c.size * 0.58)}px">${esc(sub)}</div>` : ''}</div>` : '';
      return;
    }
    const custom = !!c.bgcol, op = c.bgop;
    const vars = [
      `--sbg:${custom ? rgba(c.bgcol, op / 100) : `color-mix(in srgb, var(--bg) ${op}%, transparent)`}`,
      `--shd:${custom ? 'rgba(128,128,128,.18)' : `color-mix(in srgb, var(--surf) ${op}%, transparent)`}`,
      `--srad:${c.radius}px`, `--sbd:${c.border ? '1px solid var(--line)' : '0'}`, `--sbs:${op > 20 ? 'var(--shadow)' : 'none'}`,
      `--sfs:${c.size}px`, `--sfs2:${Math.max(10, Math.round(c.size * 0.625))}px`, `--sfw:${c.bold ? 600 : 400}`,
      c.color ? `--stc:${c.color}` : '', c.color ? `--ssub:color-mix(in srgb, ${c.color} 70%, transparent)` : '',
      `--stsh:${c.shadow ? '0 0 3px #000,0 0 6px #000' : 'none'}`
    ].filter(Boolean).join(';');
    el.className = 'box'; el.removeAttribute('style'); el.style.cssText = pos + vars;
    const pv = (c.prev && t.prev) ? (t.prev.tr || t.prev.orig) : '';
    el.innerHTML = `<div class="sh"><span class="mic">${ICON('mic', 16)}</span><span class="ss">${esc(t.status || '')}</span>${t.logOn ? `<button data-a="copy" title="Salin kalimat terakhir" aria-label="Salin kalimat terakhir">${ICON('copy', 15)}</button><button data-a="hist" title="Riwayat terjemahan: buka di sisi video (Ctrl+Alt+H)" aria-label="Buka riwayat terjemahan">${ICON('clock', 15)}</button>` : ''}<button data-a="stop" title="Berhenti" aria-label="Berhenti">${ICON('close', 15)}</button></div>
      <div class="sb">${pv ? `<div class="sp">${esc(pv)}</div>` : ''}<div class="sc${main ? '' : ' e'}">${main ? esc(main) : 'Memutar video lalu menunggu ucapan…'}</div>${sub ? `<div class="so">${esc(sub)}</div>` : ''}</div>`;
    el.querySelectorAll('.sh button').forEach(b => { b.onclick = () => api({ stop: 'stt.stop', hist: 'stt.hist', copy: 'stt.copylast' }[b.dataset.a]); });
    const h = $('.sh', el);
    h.onmousedown = e => {
      if (e.target.closest('button')) return;
      let lx = e.screenX, ly = e.screenY;
      const mv = ev => { api('stt.drag', ev.screenX - lx, ev.screenY - ly); lx = ev.screenX; ly = ev.screenY; };
      const up = () => { document.removeEventListener('mousemove', mv); document.removeEventListener('mouseup', up); };
      document.addEventListener('mousemove', mv); document.addEventListener('mouseup', up); e.preventDefault();
    };
  }
  let tabsUpd = null;
  /* ---- palet pencarian tab: disaring di sini supaya mengetik tetap lancar walau tab puluhan ---- */
  function buildTabs(m) {
    const md = $('#modal'); let data = m.data || { tabs: [], groups: [], closed: [] }, sel = 0, rows = [];
    const done = (v) => api('modal.result', v);
    md.innerHTML = `<div class="mc tabs" role="dialog" aria-label="Cari tab"><div class="ts-in">${ICON('search', 16)}<input id="tq" placeholder="Cari tab: judul, alamat, atau nama grup" autocomplete="off" spellcheck="false" aria-label="Cari tab"></div><div class="ts-list" id="tl" role="listbox"></div><div class="ts-ft"><span>↑↓ pilih · Enter buka · Del tutup tab · Esc batal</span><span id="tn"></span></div></div>`;
    const q = $('#tq', md), list = $('#tl', md), tn = $('#tn', md);
    const gm = (id) => (data.groups || []).find(g => g.id === id);
    const hay = (t) => ((t.title || '') + ' ' + (t.url || '') + ' ' + ((gm(t.group) || {}).name || '')).toLowerCase();
    const toks = () => q.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const score = (t, ks) => { const ti = (t.title || '').toLowerCase(), u = (t.url || '').toLowerCase().replace(/^https?:\/\/(www\.)?/, ''); let s = 0; ks.forEach(k => { if (ti.startsWith(k)) s += 3; else if (ti.includes(k)) s += 2; else if (u.startsWith(k)) s += 2; else s += 1; }); return s; };
    const hi = (txt) => { let o = esc(txt || ''); toks().forEach(k => { const re = new RegExp('(' + esc(k).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'ig'); o = o.replace(re, '<mark>$1</mark>'); }); return o; };
    const short = (u) => String(u || '').replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');
    function compute() {
      const ks = toks();
      const tabs = (data.tabs || []).filter(t => !ks.length || ks.every(k => hay(t).includes(k))).sort((a, b) => (score(b, ks) - score(a, ks)) || (b.last - a.last));   // yang paling baru dipakai di atas
      const closed = (data.closed || []).filter(c => !ks.length || ks.every(k => ((c.title || '') + ' ' + (c.url || '')).toLowerCase().includes(k))).slice(0, ks.length ? 8 : 5);
      rows = [...tabs.map(t => ({ k: 'tab', t })), ...closed.map(c => ({ k: 'closed', c }))];
      sel = Math.max(0, Math.min(sel, rows.length - 1));
    }
    function draw() {
      list.innerHTML = ''; let sepDone = false;
      if (!rows.length) list.innerHTML = '<div class="ts-empty">Tidak ada tab yang cocok</div>';
      rows.forEach((r, i) => {
        if (r.k === 'closed' && !sepDone) { sepDone = true; list.insertAdjacentHTML('beforeend', '<div class="ts-hd">Baru saja ditutup</div>'); }
        const o = r.k === 'tab' ? r.t : r.c, d = document.createElement('div'); d.className = 'ts-it' + (i === sel ? ' on' : ''); d.setAttribute('role', 'option');
        const fv = document.createElement('span'); fv.className = 'fv';
        if (r.k === 'tab' && o.icon) { const im = new Image(); im.onerror = () => { fv.textContent = (o.title || '?')[0].toUpperCase(); }; im.src = o.icon; fv.appendChild(im); } else fv.textContent = (o.title || o.url || '?')[0].toUpperCase();
        const g = r.k === 'tab' && gm(o.group);
        const tx = document.createElement('span'); tx.className = 'tx';
        tx.innerHTML = `<span class="t1">${hi(o.title || o.url || 'Tab baru')}${r.k === 'tab' && o.active ? '<em>tab ini</em>' : ''}${r.k === 'tab' && o.pinned ? '<em>sematan</em>' : ''}${g ? `<em class="g" style="--gc:${esc(g.color)}">${esc(g.name || 'Grup')}</em>` : ''}${r.k === 'tab' && o.incog ? '<em>incognito</em>' : ''}${r.k === 'tab' && o.audible ? '<em>♪</em>' : ''}</span><span class="t2">${hi(short(o.url))}</span>`;
        d.append(fv, tx);
        if (r.k === 'tab') { const x = document.createElement('button'); x.className = 'ts-x'; x.title = 'Tutup tab'; x.setAttribute('aria-label', 'Tutup tab'); x.innerHTML = ICON('close', 14); x.onmousedown = e => e.stopPropagation(); x.onclick = e => { e.stopPropagation(); closeRow(r); }; d.appendChild(x); }
        else { const b = document.createElement('span'); b.className = 'ts-re'; b.textContent = 'Buka lagi'; d.appendChild(b); }
        d.onmousemove = () => { if (sel !== i) { sel = i; mark(); } };
        d.onclick = () => pick(r);
        list.appendChild(d);
      });
      const nt = (data.tabs || []).length; tn.textContent = nt + ' tab terbuka';
      mark();
    }
    function mark() { [...list.querySelectorAll('.ts-it')].forEach((e, i) => e.classList.toggle('on', i === sel)); const on = list.querySelector('.ts-it.on'); if (on) on.scrollIntoView({ block: 'nearest' }); }
    const pick = (r) => r.k === 'tab' ? done({ pick: r.t.id }) : done({ reopen: r.c.i });
    function closeRow(r) { if (r.k !== 'tab') return; api('tab.close', r.t.id); data = Object.assign({}, data, { tabs: data.tabs.filter(t => t.id !== r.t.id) }); compute(); draw(); }
    q.oninput = () => { compute(); sel = !q.value.trim() && rows.length > 1 ? 1 : 0; draw(); };   // sorotan konsisten: tanpa kata kunci = tab yang dipakai sebelumnya, dengan kata kunci = hasil terbaik
    md.onkeydown = e => {
      if (e.key === 'ArrowDown') { sel = Math.min(rows.length - 1, sel + 1); mark(); e.preventDefault(); }
      else if (e.key === 'ArrowUp') { sel = Math.max(0, sel - 1); mark(); e.preventDefault(); }
      else if (e.key === 'Enter') { if (rows[sel]) pick(rows[sel]); e.preventDefault(); }
      else if (e.key === 'Escape') { done(null); e.preventDefault(); }
      else if (e.key === 'Delete' && q.selectionStart === q.value.length && q.selectionEnd === q.value.length) { if (rows[sel]) closeRow(rows[sel]); e.preventDefault(); }
    };
    md.onmousedown = e => { if (e.target === md) done(null); };
    tabsUpd = (d) => { data = d || data; compute(); draw(); };
    compute(); if (!q.value && rows.length > 1) sel = 1;     // tanpa kata kunci: sorot tab yang dipakai sebelumnya (seperti Alt+Tab)
    draw(); setTimeout(() => q.focus(), 30);
  }
  function buildModal(m) {
    const md = $('#modal'), d = m.data || {};
    const done = (v) => api('modal.result', v);
    if (m.type === 'tabs') return buildTabs(m);
    let h = '';
    if (m.type === 'confirm') h = `<h3>${esc(d.title)}</h3><p>${esc(d.text)}</p><div class="end"><button data-c>${esc(d.cancel || 'Batal')}</button><button class="${d.danger ? 'dng' : 'pri'}" data-o>${esc(d.ok || 'OK')}</button></div>`;
    else if (m.type === 'auth') h = `<h3>Masuk ke ${esc(d.host)}</h3><p>${esc(d.realm || 'Situs ini meminta nama pengguna dan kata sandi.')}</p><div class="f"><label>Nama pengguna</label><input id="au"></div><div class="f"><label>Kata sandi</label><input id="ap" type="password"></div><div class="end"><button data-c>Batal</button><button class="pri" data-o>Masuk</button></div>`;
    else if (m.type === 'group') h = `<h3>${esc(d.title || 'Grup tab')}</h3><div class="f"><label>Nama grup (boleh dikosongkan)</label><input id="gn" maxlength="30" value="${esc(d.name || '')}" placeholder="mis. Kerja, Belanja, Riset" autocomplete="off"></div><div class="f"><label>Warna</label><div class="gsw" id="gs" role="radiogroup">${(d.colors || []).map(c => `<button type="button" class="gs${c.id === d.color ? ' on' : ''}" data-col="${esc(c.id)}" title="${esc(c.label)}" aria-label="${esc(c.label)}" role="radio" aria-checked="${c.id === d.color}" style="--c:${esc(c.hex)}"></button>`).join('')}</div></div><div class="end"><button data-c>Batal</button><button class="pri" data-o>Simpan</button></div>`;
    else if (m.type === 'pin') h = `<div class="logo">${LOGO(44)}</div><h3 style="text-align:center">${esc(d.title || 'Masukkan PIN')}</h3><p style="text-align:center">${esc(d.reason || '')}</p><div class="f"><input id="pn" class="pin" type="password" inputmode="numeric" maxlength="12" autocomplete="off"></div><div class="end">${d.dismissable === false ? '' : '<button data-c>Batal</button>'}<button class="pri" data-o>Buka</button></div>`;
    md.innerHTML = `<div class="mc">${h}</div>`;
    const c = $('[data-c]', md), o = $('[data-o]', md);
    const submit = () => {
      if (m.type === 'confirm') done(true);
      else if (m.type === 'auth') done({ u: $('#au').value, p: $('#ap').value });
      else if (m.type === 'group') done({ name: $('#gn').value, color: gcol });
      else if (m.type === 'pin') { const v = $('#pn').value; if (v) { done({ pin: v }); const i = $('#pn'); if (i) { i.value = ''; } } }
    };
    let gcol = d.color || ''; $$('.gs', md).forEach(b => { b.onclick = () => { gcol = b.dataset.col; $$('.gs', md).forEach(x => { x.classList.toggle('on', x === b); x.setAttribute('aria-checked', x === b); }); }; });
    if (c) c.onclick = () => done(m.type === 'confirm' ? false : null);
    o.onclick = submit;
    md.onkeydown = e => { if (e.key === 'Enter') submit(); else if (e.key === 'Escape' && d.dismissable !== false) done(m.type === 'confirm' ? false : null); };
    const f = $('input', md); setTimeout(() => (f || o).focus(), 30);
  }
  alethra.on('tabsearch', d => { if (tabsUpd) tabsUpd(d); });
  alethra.on('state', s => { st = s || {}; render(); });
  alethra.on('settings', s => applyTheme(s));
  api('settings.get').then(s => s && applyTheme(s));
})();
