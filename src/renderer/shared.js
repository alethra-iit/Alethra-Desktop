(function () {
  const P = {
    chat: 'M4 5h16v11H9l-5 4z', split: 'M3 5h18v14H3zM12 5v14', swap: 'M7 8h13M16 4l4 4-4 4M17 16H4M8 12l-4 4 4 4',
    video: 'M3 6h12v12H3zM15 10l6-3v10l-6-3', phone: 'M8 3h8v18H8zM11 18h2', undo: 'M9 14L4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3',
    tabs: 'M3 9h18v11H3zM3 9V6h7l2 3', fullscreen: 'M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5', code: 'M8 7l-5 5 5 5M16 7l5 5-5 5M14 4l-4 16',
    info: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 11v6M12 7.5h.01', power: 'M12 3v9M6.5 6.5a8 8 0 1 0 11 0',
    layout: 'M3 5h18v14H3zM3 10h18M9 10v9', equal: 'M5 9h14M5 15h14', grid: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
    pin: 'M9 4h6l-1 6 3 3H7l3-3zM12 13v8', group: 'M4 5h10v10H4zM10 9h10v10H10z', ungroup: 'M4 5h10v10H4zM17 13l4 4M21 13l-4 4',
    closeother: 'M3 6h8v12H3zM15 9l6 6M21 9l-6 6', closeright: 'M3 6h8v12H3zM15 12h6M18 9l3 3-3 3', closeall: 'M4 4h16v16H4zM9 9l6 6M15 9l-6 6',
    back: 'M15 18l-6-6 6-6', fwd: 'M9 18l6-6-6-6', reload: 'M21 12a9 9 0 1 1-3-6.7L21 8M21 3v5h-5', close: 'M18 6L6 18M6 6l12 12',
    home: 'M3 11l9-8 9 8M5 10v10h14V10', star: 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z',
    download: 'M12 4v11M7 11l5 5 5-5M5 20h14', more: 'M5 12h.01M12 12h.01M19 12h.01', lock: 'M6 11h12v9H6zM8 11V8a4 4 0 0 1 8 0v3',
    warn: 'M12 3l10 18H2zM12 10v5M12 18h.01', globe: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18',
    translate: 'M4 5h9M8.5 3v2M6 5c0 4 3 8 6 9M12 5c0 4-3 8-6 9M13 20l4-9 4 9M14.5 17h5', plus: 'M12 5v14M5 12h14', minus: 'M5 12h14',
    volume: 'M11 5L6 9H3v6h3l5 4zM15.5 8.5a5 5 0 0 1 0 7', mute: 'M11 5L6 9H3v6h3l5 4zM16 9l5 6M21 9l-5 6',
    incog: 'M3 12c3-6 15-6 18 0M3 12c3 6 15 6 18 0M12 9.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5M4 4l16 16',
    search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM21 21l-5-5', up: 'M6 15l6-6 6 6', down: 'M6 9l6 6 6-6', clock: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7v5l3 2',
    trash: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13', folder: 'M3 6h6l2 2h10v11H3z', edit: 'M4 20h4L19 9l-4-4L4 16zM14 6l4 4', copy: 'M9 9h11v11H9zM5 15V4h11',
    file: 'M6 3h8l4 4v14H6zM14 3v4h4', pause: 'M8 5v14M16 5v14', play: 'M7 4l13 8-13 8z', open: 'M14 4h6v6M20 4l-9 9M18 14v6H4V6h6',
    check: 'M5 12l5 5 9-10', key: 'M15 8a4 4 0 1 1-3 6.5L4 21v-3h3v-3h3', shield: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z', settings: 'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM19 12l2-1-1-3-2 .5-1.5-1.5L17 5l-3-1-1 2h-2L10 4 7 5l.5 2L6 8.5 4 8l-1 3 2 1v2l-2 1 1 3 2-.5L8 19l-.5 2 3 1 1-2h2l1 2 3-1-.5-2 1.5-1.5 2 .5 1-3-2-1z',
    eraser: 'M20 20H9L4 15l10-10 6 6-7 9M9 20l-3-3', print: 'M7 9V3h10v6M7 17H4v-7h16v7h-3M7 14h10v7H7z', offline: 'M4 4l16 16M8.5 8.5A8 8 0 0 0 4 12M20 12a8 8 0 0 0-4-3.5M9 16a4 4 0 0 1 6 0M12 20h.01',
    reader: 'M4 5h16M4 10h10M4 15h16M4 20h10', pip: 'M3 5h18v14H3zM12 12h8v6h-8z', image: 'M3 5h18v14H3zM3 16l5-5 4 4 3-3 6 6M9 9h.01', desktop: 'M3 4h18v12H3zM8 20h8M12 16v4', mic: 'M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3zM5 11a7 7 0 0 0 14 0M12 18v3', tools: 'M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z', sliders: 'M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0M14 4v4M8 10v4M16 16v4'
  };
  window.ICON = (n, s) => `<svg class="i" viewBox="0 0 24 24"${s ? ` style="width:${s}px;height:${s}px"` : ''}><path d="${P[n] || ''}"/></svg>`;
  window.LOGO = (s) => `<svg viewBox="0 0 24 24" class="i" style="width:${s}px;height:${s}px;stroke-width:2.4"><path d="M4 21L12 3l8 18"/><path d="M8.2 15h7.6"/></svg>`;
  window.$ = (s, r) => (r || document).querySelector(s);
  window.$$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  window.esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  window.api = (n, ...a) => window.alethra.call(n, ...a);
  window.applyTheme = function (s) {
    const R = document.documentElement;
    if (s.dark) R.setAttribute('data-theme', 'dark'); else R.removeAttribute('data-theme');
    if (s.dark && s.amoled) R.setAttribute('data-amoled', ''); else R.removeAttribute('data-amoled');
    if (s.barstyle && s.barstyle !== 'abu') R.setAttribute('data-bar', s.barstyle); else R.removeAttribute('data-bar');
    if (s.accent && /^#[0-9a-f]{6}$/i.test(s.accent)) {
      R.style.setProperty('--acc', s.accent);
      const n = parseInt(s.accent.slice(1), 16), l = (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
      R.style.setProperty('--onacc', l > 0.6 ? '#111' : '#fff');
    } else { R.style.removeProperty('--acc'); R.style.removeProperty('--onacc'); }
  };
  window.fav = (u, n) => {
    let h = ''; try { h = new URL(u).hostname; } catch {}
    const d = document.createElement('div'); d.className = 'fav'; d.textContent = ((n || h || '?')[0] || '?').toUpperCase();
    if (h) { const im = new Image(); im.onload = () => { d.textContent = ''; d.appendChild(im); }; im.src = 'https://www.google.com/s2/favicons?domain=' + h + '&sz=32'; }
    return d;
  };
  window.fmtBytes = (b) => { b = +b || 0; const u = ['B', 'KB', 'MB', 'GB']; let i = 0; while (b >= 1024 && i < 3) { b /= 1024; i++; } return (i ? b.toFixed(1) : b) + ' ' + u[i]; };
  window.pageInit = async function (onSettings) {
    const s = await api('settings.get'); applyTheme(s); onSettings && onSettings(s);
    alethra.on('settings', st => { applyTheme(st); onSettings && onSettings(st); });
    return s;
  };
  window.askText = function (title, fields, ok) {
    return new Promise(res => {
      const d = document.createElement('div'); d.className = 'dlg';
      d.innerHTML = `<div class="card"><h3>${esc(title)}</h3>${fields.map((f, i) => `<div class="f"><label>${esc(f.l)}</label><input class="inp" data-i="${i}" value="${esc(f.v || '')}" placeholder="${esc(f.p || '')}" type="${f.t || 'text'}"></div>`).join('')}<div class="end"><button class="btn" data-x>Batal</button><button class="btn pri" data-ok>${esc(ok || 'Simpan')}</button></div></div>`;
      document.body.appendChild(d);
      const ins = $$('input', d); ins[0].focus(); ins[0].select();
      const done = (v) => { d.remove(); res(v); };
      $('[data-x]', d).onclick = () => done(null);
      $('[data-ok]', d).onclick = () => done(ins.map(i => i.value));
      d.addEventListener('keydown', e => { if (e.key === 'Enter') done(ins.map(i => i.value)); if (e.key === 'Escape') done(null); });
      d.addEventListener('mousedown', e => { if (e.target === d) done(null); });
    });
  };
  window.askConfirm = function (title, text, ok, danger) {
    return new Promise(res => {
      const d = document.createElement('div'); d.className = 'dlg';
      d.innerHTML = `<div class="card"><h3>${esc(title)}</h3><div style="color:var(--sub);white-space:pre-wrap">${esc(text || '')}</div><div class="end"><button class="btn" data-x>Batal</button><button class="btn ${danger ? 'danger' : 'pri'}" data-ok>${esc(ok || 'OK')}</button></div></div>`;
      document.body.appendChild(d); $('[data-ok]', d).focus();
      const done = (v) => { d.remove(); res(v); };
      $('[data-x]', d).onclick = () => done(false); $('[data-ok]', d).onclick = () => done(true);
      d.addEventListener('keydown', e => { if (e.key === 'Escape') done(false); });
    });
  };
})();
