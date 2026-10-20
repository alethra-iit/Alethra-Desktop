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
      const el = $('#menu'); el.hidden = false; el.innerHTML = '';
      s.menu.items.forEach(it => {
        if (it.sep) { el.insertAdjacentHTML('beforeend', '<div class="msep"></div>'); return; }
        if (it.zoom) {
          const z = document.createElement('div'); z.className = 'zr'; z.innerHTML = `<span class="l">Zoom</span><button data-d="-1">−</button><span class="v">${it.zoom}%</span><button data-d="1">+</button><button data-d="0" title="Setel ulang">⟲</button>`;
          $$('button', z).forEach(b => b.onclick = () => api('ov.zoom', +b.dataset.d)); el.appendChild(z); return;
        }
        const d = document.createElement('div'); d.className = 'mi' + (it.off ? ' off' : '');
        d.innerHTML = `<span class="ck">${it.check ? ICON('check', 16) : ''}</span><span class="l">${esc(it.label)}</span><span class="k">${esc(it.key || '')}</span>`;
        d.onclick = () => api('ov.menu', it.id); el.appendChild(d);
      });
    } else hide('menu', false);
    // modal
    const m = s.modal, md = $('#modal');
    if (m) {
      const key = JSON.stringify(m);
      if (key !== lastModal) { lastModal = key; buildModal(m); }
      md.hidden = false; md.classList.toggle('opaque', m.type === 'pin' && m.data.dismissable === false);
    } else { md.hidden = true; lastModal = null; md.innerHTML = ''; }
    // suara ke teks
    renderStt(s);
    // toast
    const t = $('#toast'); if (s.toast) { t.hidden = false; t.textContent = s.toast; } else t.hidden = true;
  }
  function renderStt(s) {
    const el = $('#stt'), t = s.stt;
    if (!t) { el.hidden = true; el.innerHTML = ''; el.className = ''; el.removeAttribute('style'); return; }
    el.hidden = false;
    el.style.left = (t.rect.x - s.ox) + 'px'; el.style.top = (t.rect.y - s.oy) + 'px'; el.style.width = t.rect.w + 'px'; el.style.height = t.rect.h + 'px';
    const cur = t.cur || {}, main = cur.tr || cur.orig || '', sub = (cur.tr && t.cfg.orig) ? cur.orig : '';
    if (t.fs) {
      const col = { white: '#fff', yellow: '#ffe14d', cyan: '#6fe3ff' }[t.cfg.color] || '#fff';
      el.className = 'fs'; el.removeAttribute('style');
      el.style.left = (t.rect.x - s.ox) + 'px'; el.style.top = (t.rect.y - s.oy) + 'px'; el.style.width = t.rect.w + 'px'; el.style.height = t.rect.h + 'px';
      el.style.justifyContent = t.cfg.pos === 'top' ? 'flex-start' : 'flex-end';
      const bg = t.cfg.bg === 'solid' ? '#000' : t.cfg.bg === 'none' ? 'transparent' : 'rgba(0,0,0,.62)';
      const sh = t.cfg.bg === 'none' ? '0 0 4px #000,0 0 8px #000,1px 1px 2px #000' : 'none';
      el.innerHTML = main ? `<div class="fsb" style="font-size:${t.cfg.size}px;color:${col};background:${bg};text-shadow:${sh}"><div class="l1">${esc(main)}</div>${sub ? `<div class="l2" style="font-size:${Math.round(t.cfg.size * 0.58)}px">${esc(sub)}</div>` : ''}</div>` : '';
      return;
    }
    el.className = 'box'; el.removeAttribute('style');
    el.style.left = (t.rect.x - s.ox) + 'px'; el.style.top = (t.rect.y - s.oy) + 'px'; el.style.width = t.rect.w + 'px'; el.style.height = t.rect.h + 'px';
    const pv = t.prev ? (t.prev.tr || t.prev.orig) : '';
    el.innerHTML = `<div class="sh"><span class="mic">${ICON('mic', 16)}</span><span class="ss">${esc(t.status || '')}</span><button title="Berhenti">${ICON('close', 15)}</button></div>
      <div class="sb">${pv ? `<div class="sp">${esc(pv)}</div>` : ''}<div class="sc${main ? '' : ' e'}">${main ? esc(main) : 'Memutar video lalu menunggu ucapan…'}</div>${sub ? `<div class="so">${esc(sub)}</div>` : ''}</div>`;
    $('button', el).onclick = () => api('stt.stop');
    const h = $('.sh', el);
    h.onmousedown = e => {
      if (e.target.closest('button')) return;
      let lx = e.screenX, ly = e.screenY;
      const mv = ev => { api('stt.drag', ev.screenX - lx, ev.screenY - ly); lx = ev.screenX; ly = ev.screenY; };
      const up = () => { document.removeEventListener('mousemove', mv); document.removeEventListener('mouseup', up); };
      document.addEventListener('mousemove', mv); document.addEventListener('mouseup', up); e.preventDefault();
    };
  }
  function buildModal(m) {
    const md = $('#modal'), d = m.data || {};
    const done = (v) => api('modal.result', v);
    let h = '';
    if (m.type === 'confirm') h = `<h3>${esc(d.title)}</h3><p>${esc(d.text)}</p><div class="end"><button data-c>${esc(d.cancel || 'Batal')}</button><button class="${d.danger ? 'dng' : 'pri'}" data-o>${esc(d.ok || 'OK')}</button></div>`;
    else if (m.type === 'auth') h = `<h3>Masuk ke ${esc(d.host)}</h3><p>${esc(d.realm || 'Situs ini meminta nama pengguna dan kata sandi.')}</p><div class="f"><label>Nama pengguna</label><input id="au"></div><div class="f"><label>Kata sandi</label><input id="ap" type="password"></div><div class="end"><button data-c>Batal</button><button class="pri" data-o>Masuk</button></div>`;
    else if (m.type === 'pin') h = `<div class="logo">${LOGO(44)}</div><h3 style="text-align:center">${esc(d.title || 'Masukkan PIN')}</h3><p style="text-align:center">${esc(d.reason || '')}</p><div class="f"><input id="pn" class="pin" type="password" inputmode="numeric" maxlength="12" autocomplete="off"></div><div class="end">${d.dismissable === false ? '' : '<button data-c>Batal</button>'}<button class="pri" data-o>Buka</button></div>`;
    md.innerHTML = `<div class="mc">${h}</div>`;
    const c = $('[data-c]', md), o = $('[data-o]', md);
    const submit = () => {
      if (m.type === 'confirm') done(true);
      else if (m.type === 'auth') done({ u: $('#au').value, p: $('#ap').value });
      else if (m.type === 'pin') { const v = $('#pn').value; if (v) { done({ pin: v }); const i = $('#pn'); if (i) { i.value = ''; } } }
    };
    if (c) c.onclick = () => done(m.type === 'confirm' ? false : null);
    o.onclick = submit;
    md.onkeydown = e => { if (e.key === 'Enter') submit(); else if (e.key === 'Escape' && d.dismissable !== false) done(m.type === 'confirm' ? false : null); };
    const f = $('input', md); setTimeout(() => (f || o).focus(), 30);
  }
  alethra.on('state', s => { st = s || {}; render(); });
  alethra.on('settings', s => applyTheme(s));
  api('settings.get').then(s => s && applyTheme(s));
})();
