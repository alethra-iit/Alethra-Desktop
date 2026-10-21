(function () {
  let tabs = [], groups = [], S = {}, bms = [], infos = [], dragId = null, selIdx = -1, sugCount = 0, typed = '', omniFocused = false;
  const url = $('#url');
  const set = (id, ic) => { $('#' + id).innerHTML = ICON(ic); };
  set('newtab', 'plus'); set('tabsrch', 'search'); set('back', 'back'); set('fwd', 'fwd'); set('home', 'home'); set('star', 'star'); set('trb', 'translate'); set('menub', 'more'); set('toolsb', 'tools'); $('#toolsb').insertAdjacentHTML('beforeend', '<span class="tl">Tools</span>');
  $('#dlb').insertAdjacentHTML('afterbegin', ICON('download')); set('fp', 'up'); set('fn', 'down'); set('fx', 'close');
  $('#reload').innerHTML = ICON('reload');
  const cur = () => tabs.find(t => t.active);
  // pembaca layar dan pengguna baru: setiap tombol ikon punya nama yang sama dengan tooltip-nya
  const syncAria = () => $$('.tb[title]').forEach(b => b.setAttribute('aria-label', b.title));
  syncAria(); new MutationObserver(syncAria).observe($('#toolbar'), { subtree: true, attributes: true, attributeFilter: ['title'] });

  /* ---------- tab ---------- */
  const GHEX = { abu: '#8b8d94', biru: '#4f8df7', merah: '#e5534b', kuning: '#d9a520', hijau: '#3fb950', pink: '#e76bb5', ungu: '#a371f7', sian: '#2fb5c0', jingga: '#f0883e' };
  function renderTabs() {
    const box = $('#tabs'), keepScroll = box.scrollLeft; box.innerHTML = '';
    const gmap = {}; groups.forEach(g => { gmap[g.id] = g; });
    const hidden = (t) => { const g = t.group && gmap[t.group]; return !!(g && g.collapsed && !t.active); };
    // mode ringkas bila tab biasa yang terlihat banyak; tab sematan selalu ringkas dan tidak dihitung
    const compact = tabs.filter(t => !t.pinned && !hidden(t)).length > 7;
    let activeEl = null;
    tabs.forEach((t, idx) => {
      const g = t.group && gmap[t.group], gcol = g ? (GHEX[g.color] || '#8b8d94') : '';
      // chip grup: muncul sekali di depan anggota pertama
      if (g && (idx === 0 || tabs[idx - 1].group !== t.group)) {
        const n = tabs.filter(z => z.group === g.id).length;
        const c = document.createElement('div'); c.className = 'gchip' + (g.collapsed ? ' col' : ''); c.style.setProperty('--gc', gcol);
        c.title = (g.name || 'Grup tanpa nama') + ' · ' + n + ' tab\nKlik untuk ' + (g.collapsed ? 'membentangkan' : 'menciutkan') + ', klik kanan untuk opsi';
        c.setAttribute('role', 'button'); c.setAttribute('aria-label', 'Grup ' + (g.name || 'tanpa nama') + ', ' + n + ' tab, ' + (g.collapsed ? 'diciutkan' : 'terbuka'));
        c.textContent = (g.name || '') + (g.collapsed ? (g.name ? ' · ' : '') + n : '');
        if (!g.name && !g.collapsed) c.classList.add('empty');
        c.onclick = () => api('group.toggle', g.id); c.oncontextmenu = e => { e.preventDefault(); api('group.menu', g.id); };
        c.ondragover = e => { if (dragId != null) { e.preventDefault(); c.classList.add('drop'); } };
        c.ondragleave = () => c.classList.remove('drop');
        c.ondrop = e => { e.preventDefault(); c.classList.remove('drop'); if (dragId != null) api('tab.togroup', dragId, g.id); dragId = null; };
        box.appendChild(c);
      }
      if (hidden(t)) return;
      const d = document.createElement('div'); d.className = 'tab' + (t.active ? ' active' : '') + (t.incog ? ' incog' : '') + (t.pane ? ' sp sp-' + t.pane : '') + (t.pinned ? ' pin' : '') + (g ? ' grp' : '') + (compact && !t.active && !t.pinned ? ' compact' : '');
      if (g) d.style.setProperty('--gc', gcol);
      d.draggable = true; d.title = (t.pinned ? '📌 ' : '') + t.title + '\n' + t.url + (g ? '\nGrup: ' + (g.name || 'tanpa nama') : '');
      d.setAttribute('role', 'tab'); d.setAttribute('aria-selected', t.active ? 'true' : 'false');
      const fv = document.createElement('div'); fv.className = 'fv';
      if (t.loading) fv.innerHTML = '<div class="spin"></div>';
      else if (t.incog) fv.innerHTML = ICON('incog');
      else if (t.icon) { const im = new Image(); im.onerror = () => { fv.textContent = (t.title || '?')[0].toUpperCase(); }; im.src = t.icon; fv.appendChild(im); }
      else if (t.internal) fv.innerHTML = LOGO(15);
      else fv.textContent = (t.title || '?')[0].toUpperCase();
      d.appendChild(fv);
      const tt = document.createElement('div'); tt.className = 'tt'; tt.textContent = t.title || t.url || 'Tab baru'; d.appendChild(tt);
      if (t.audible || t.muted) { const a = document.createElement('button'); a.className = 'au'; a.innerHTML = ICON(t.muted ? 'mute' : 'volume'); a.title = t.muted ? 'Aktifkan suara' : 'Bisukan tab'; a.onclick = e => { e.stopPropagation(); api('tab.mute', t.id); }; d.appendChild(a); }
      if (!t.pinned) { const x = document.createElement('button'); x.className = 'x'; x.innerHTML = ICON('close'); x.title = 'Tutup tab'; x.draggable = false; x.onmousedown = e => { e.stopPropagation(); if (e.button === 0) { e.preventDefault(); api('tab.close', t.id); } }; x.onclick = e => e.stopPropagation(); d.appendChild(x); }
      d.onmousedown = e => { if (e.target.closest('.x, .au')) return; if (e.button === 0) api('tab.select', t.id); else if (e.button === 1) { e.preventDefault(); if (!t.pinned) api('tab.close', t.id); } };   // klik tengah tidak menutup tab sematan
      d.oncontextmenu = e => { e.preventDefault(); api('tab.menu', t.id); };
      d.ondragstart = e => { dragId = t.id; e.dataTransfer.effectAllowed = 'move'; };
      d.ondragover = e => { if (dragId != null) { e.preventDefault(); d.classList.add('drop'); } };
      d.ondragleave = () => d.classList.remove('drop');
      d.ondrop = e => { e.preventDefault(); d.classList.remove('drop'); if (dragId != null && dragId !== t.id) api('tab.move', dragId, tabs.findIndex(z => z.id === t.id)); dragId = null; };
      d.ondragend = () => { dragId = null; };
      box.appendChild(d); if (t.active) activeEl = d;
    });
    box.scrollLeft = keepScroll;
    if (activeEl) { const r = activeEl.getBoundingClientRect(), b = box.getBoundingClientRect(); if (r.left < b.left || r.right > b.right) activeEl.scrollIntoView({ inline: 'nearest', block: 'nearest' }); }   // tab aktif selalu terlihat saat tab sangat banyak
  }
  function shown(u) {
    if (!u || u.startsWith('alethra://')) return '';
    return u.replace(/^https:\/\//, '').replace(/^http:\/\/(?=.)/, 'http://').replace(/\/$/, '');
  }
  function renderBar() {
    const t = cur(); if (!t) return;
    $('#back').disabled = !t.back; $('#fwd').disabled = !t.fwd;
    $('#reload').innerHTML = ICON(t.loading ? 'close' : 'reload'); $('#reload').title = t.loading ? 'Berhenti' : 'Muat ulang (Ctrl+R)';
    if (!omniFocused) url.value = shown(t.url);
    const s = $('#sec'); s.className = ''; 
    if (t.internal) s.innerHTML = LOGO(16); else if (t.secure) s.innerHTML = ICON('lock'); else if (/^https?:/.test(t.url)) { s.innerHTML = ICON('warn'); s.className = 'bad'; s.title = 'Tidak aman (HTTP)'; } else s.innerHTML = ICON('globe');
    $('#star').classList.toggle('on', !!t.bookmarked); $('#star').style.display = t.internal ? 'none' : '';
    $('#trb').classList.toggle('on', !!t.trOn);
    document.title = (t.title || 'Alethra') + ' — Alethra';
  }
  function renderBm() {
    const b = $('#bmbar'); b.innerHTML = '';
    const on = S.bmbar !== false && bms.length > 0; b.classList.toggle('show', on);
    if (!on) return;
    bms.forEach(x => {
      const e = document.createElement('button'); e.className = 'bmi'; e.title = x.t + '\n' + x.u;
      let h = ''; try { h = new URL(x.u).hostname; } catch {}
      const ic = document.createElement('b'); ic.textContent = (x.t || '?')[0].toUpperCase(); e.appendChild(ic);
      if (h) { const im = new Image(); im.width = 14; im.onload = () => { ic.replaceWith(im); }; im.src = 'https://www.google.com/s2/favicons?domain=' + h + '&sz=32'; }
      const sp = document.createElement('span'); sp.textContent = x.t || x.u; e.appendChild(sp);
      e.onclick = () => api('omni.go', x.u, -1);
      e.onauxclick = ev => { if (ev.button === 1) api('tab.new', x.u); };
      b.appendChild(e);
    });
  }
  function renderInfos() {
    const b = $('#infobars'); b.innerHTML = '';
    infos.forEach(i => {
      const d = document.createElement('div'); d.className = 'ib2';
      d.innerHTML = `<div class="tx">${esc(i.text)}</div>` + i.actions.map(a => `<button data-k="${a.k}">${esc(a.l)}</button>`).join('') + `<button data-k="dismiss" title="Tutup" style="border:0;background:none">✕</button>`;
      $$('button', d).forEach(bt => bt.onclick = () => api('infobar.act', i.id, bt.dataset.k));
      b.appendChild(d);
    });
  }

  /* ---------- tombol ---------- */
  $('#newtab').onclick = () => api('tab.new');
  $('#back').onclick = () => api('nav.back'); $('#fwd').onclick = () => api('nav.forward');
  $('#reload').onclick = () => api(cur() && cur().loading ? 'nav.stop' : 'nav.reload');
  $('#home').onclick = () => api('nav.home'); $('#star').onclick = () => api('bookmark.toggle');
  $('#trb').onclick = () => { const r = $('#trb').getBoundingClientRect(); api('tr.open', Math.round(window.innerWidth - r.right)); }; $('#dlb').onclick = () => api('dl.open'); $('#menub').onclick = () => api('menu.open');
  $('#toolsb').onclick = () => { const r = $('#toolsb').getBoundingClientRect(); api('tools.open', Math.round(window.innerWidth - r.right)); };
  document.addEventListener('mousedown', e => { if (!e.target.closest('#omni')) api('omni.hide'); }, true);
  $('#tabstrip').addEventListener('dblclick', e => { if (e.target.id === 'tabstrip') api('tab.new'); });

  /* ---------- omnibox ---------- */
  function rect() { const r = $('#omni').getBoundingClientRect(); return [Math.round(r.left), Math.round(r.width)]; }
  let ti = null;
  url.addEventListener('focus', () => { omniFocused = true; const t = cur(); if (t && !t.internal) url.value = t.url; setTimeout(() => url.select(), 0); });
  url.addEventListener('blur', () => { omniFocused = false; setTimeout(() => { if (!omniFocused) renderBar(); }, 150); });
  url.addEventListener('input', () => {
    typed = url.value; selIdx = -1; clearTimeout(ti);
    ti = setTimeout(async () => { const [x, w] = rect(); sugCount = (await api('omni.suggest', typed, x, w)) || 0; }, 40);
  });
  url.addEventListener('keydown', async e => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (!sugCount) return; e.preventDefault();
      selIdx = (selIdx + (e.key === 'ArrowDown' ? 1 : -1) + sugCount + 1) % (sugCount + 1) - 0; if (selIdx >= sugCount) selIdx = -1;
      api('omni.sel', selIdx);
    } else if (e.key === 'Enter') {
      e.preventDefault(); clearTimeout(ti);
      const v = url.value; await api('omni.go', v, selIdx); selIdx = -1; sugCount = 0; url.blur();
    } else if (e.key === 'Escape') { api('omni.hide'); const t = cur(); url.value = t && !t.internal ? t.url : ''; url.select(); }
  });

  /* ---------- cari di halaman ---------- */
  const fi = $('#fi');
  function openFind(focus) { $('#findbar').hidden = false; if (focus) { fi.focus(); fi.select(); } }
  function closeFind() { $('#findbar').hidden = true; $('#fc').textContent = ''; api('find.stop'); }
  fi.oninput = () => api('find.start', fi.value);
  fi.onkeydown = e => { if (e.key === 'Enter') api('find.next', !e.shiftKey); else if (e.key === 'Escape') closeFind(); };
  $('#fp').onclick = () => api('find.next', false); $('#fn').onclick = () => api('find.next', true); $('#fx').onclick = closeFind;

  /* ---------- peristiwa dari main ---------- */
  /* ---- tampilan terpisah ---- */
  let SG = null, dragging = false, raf = 0, lastPos = 0;
  const sp = $('#split'), sbar = $('#sbar'), pfs = sp.querySelectorAll('.pf');
  const box = (el, r) => { el.style.left = r.x + 'px'; el.style.top = r.y + 'px'; el.style.width = r.w + 'px'; el.style.height = r.h + 'px'; };
  alethra.on('split', G => {
    SG = G && G.on ? G : null; sp.hidden = !SG; if (!SG) return;
    box(sbar, SG.bar); sbar.className = SG.vertical ? 'v' : 'h';
    SG.bars.forEach((b, i) => { box(pfs[i], b.r); pfs[i].classList.toggle('on', !!b.on); });
    sbar.setAttribute('aria-orientation', SG.vertical ? 'horizontal' : 'vertical'); sbar.setAttribute('aria-valuenow', Math.round(SG.ratio * 100));
  });
  const sendDrag = () => { raf = 0; if (dragging) api('split.drag', lastPos); };
  sbar.addEventListener('pointerdown', e => { if (!SG) return; dragging = true; sbar.setPointerCapture(e.pointerId); sbar.classList.add('drag'); document.body.classList.add('splitdrag'); e.preventDefault(); });
  sbar.addEventListener('pointermove', e => { if (!dragging || !SG) return; lastPos = SG.vertical ? e.clientY : e.clientX; if (!raf) raf = requestAnimationFrame(sendDrag); });
  const endDrag = () => { if (!dragging) return; dragging = false; sbar.classList.remove('drag'); document.body.classList.remove('splitdrag'); api('split.dragend'); };
  sbar.addEventListener('pointerup', endDrag); sbar.addEventListener('pointercancel', endDrag); sbar.addEventListener('lostpointercapture', endDrag);
  sbar.addEventListener('dblclick', () => api('split.reset'));
  sbar.addEventListener('keydown', e => {
    if (!SG) return; const k = e.key, dec = SG.vertical ? 'ArrowUp' : 'ArrowLeft', inc = SG.vertical ? 'ArrowDown' : 'ArrowRight';
    if (k === dec || k === inc) { api('split.nudge', k === inc ? 0.02 : -0.02); e.preventDefault(); } else if (k === 'Home' || k === 'Enter') { api('split.reset'); e.preventDefault(); }
  });
  $('#tabsrch').onclick = () => api('tabs.search');
  // roda mouse di strip tab menggulir ke samping (berguna saat tab sangat banyak)
  $('#tabs').addEventListener('wheel', e => { const b = $('#tabs'); if (b.scrollWidth > b.clientWidth && Math.abs(e.deltaY) > Math.abs(e.deltaX)) { b.scrollLeft += e.deltaY; e.preventDefault(); } }, { passive: false });
  alethra.on('groups', l => { groups = Array.isArray(l) ? l : []; });
  alethra.on('tabs', l => { const prev = cur(); tabs = l; const c = cur(); if (prev && c && prev.id !== c.id) { $('#findbar').hidden = true; } renderTabs(); renderBar(); });
  // warna toolbar kustom (palet dihitung di proses utama): menimpa variabel warna khusus halaman toolbar
  const BARV = { strip: '--strip', tbar: '--tbar', omni: '--omni', bline: '--bline', fg: '--fg', sub: '--sub', tbh: '--tbh', bg: '--bg', surf2: '--surf2' };
  function applyBar(s) {
    const R = document.documentElement.style, p = s && s.barpal;
    Object.keys(BARV).forEach(k => { if (p) R.setProperty(BARV[k], p[k]); else R.removeProperty(BARV[k]); });
    if (p) R.setProperty('--line', p.bline); else R.removeProperty('--line');
  }
  alethra.on('settings', s => { S = s; applyTheme(s); applyBar(s); renderBm(); });
  alethra.on('bookmarks', l => { bms = l; renderBm(); });
  alethra.on('infobars', l => { infos = l; renderInfos(); });
  alethra.on('downloads', d => { const b = $('#badge'); b.style.display = d.active ? 'flex' : 'none'; b.textContent = d.active ? d.pct + '%' : ''; });
  alethra.on('focus-omni', () => { url.focus(); });
  alethra.on('omni-blur', () => url.blur());
  alethra.on('find', f => {
    if (f.open === false) { $('#findbar').hidden = true; return; }
    if (f.open) openFind(f.focus);
    if (f.total != null) $('#fc').textContent = fi.value ? (f.total ? f.ordinal + ' dari ' + f.total : 'Tidak ada') : '';
  });
  alethra.on('fullscreen', v => document.body.classList.toggle('fs', !!v));

  new ResizeObserver(() => api('chrome.height', Math.ceil($('#bars').getBoundingClientRect().height))).observe($('#bars'));
  api('ui.ready').then(r => { if (!r) return; S = r.settings; bms = r.bookmarks; tabs = r.tabs; applyTheme(S); applyBar(S); renderTabs(); renderBar(); renderBm(); });
})();
