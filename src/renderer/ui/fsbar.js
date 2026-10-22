(function () {
  // Dua tombol melayang saat layar penuh: Tools dan titik tiga (menu utama).
  // Angka = jarak tepi kanan tombol ke tepi kanan bilah (px); main menambahkan posisi bilah yang sedang dipakai.
  // Bilah bisa digeser: tahan lalu seret tombol mana pun. Posisi disimpan (pengaturan fsbarpos).
  $('#fsT').innerHTML = ICON('tools', 20); $('#fsM').innerHTML = ICON('more', 20);
  $('#fsT').onclick = () => api('tools.open', 48);
  $('#fsM').onclick = () => api('menu.open', 2);
  alethra.on('fsbar', s => { $('#fsT').classList.toggle('on', !!s && s.menu === 'tools'); $('#fsM').classList.toggle('on', !!s && s.menu === 'main'); });
  alethra.on('settings', s => applyTheme(s));
  api('settings.get').then(s => s && applyTheme(s));

  const bar = $('#bar'); let d = null, moved = false;
  bar.addEventListener('pointerdown', e => {
    if (e.button !== 0) return;
    d = { x: e.screenX, y: e.screenY, id: e.pointerId, on: false }; moved = false;
  });
  bar.addEventListener('pointermove', e => {
    if (!d || e.pointerId !== d.id) return;
    const dx = e.screenX - d.x, dy = e.screenY - d.y;
    if (!d.on) { if (Math.abs(dx) + Math.abs(dy) < 5) return; d.on = true; moved = true; bar.classList.add('drag'); try { bar.setPointerCapture(d.id); } catch {} api('fsbar.drag', 'start'); }   // pointer baru ditangkap saat menyeret, supaya klik biasa tetap sampai ke tombol
    api('fsbar.drag', 'move', dx, dy);
  });
  const end = e => {
    if (!d || (e && e.pointerId !== d.id)) return;
    if (d.on) api('fsbar.drag', 'end', e ? e.screenX - d.x : 0, e ? e.screenY - d.y : 0);
    try { bar.releasePointerCapture(d.id); } catch {}
    bar.classList.remove('drag'); d = null;
    setTimeout(() => { moved = false; }, 0);
  };
  bar.addEventListener('pointerup', end); bar.addEventListener('pointercancel', end);
  bar.addEventListener('click', e => { if (moved) { e.stopPropagation(); e.preventDefault(); } }, true);   // seretan bukan klik
})();
