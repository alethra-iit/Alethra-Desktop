(async function () {
  await pageInit(); const a = await api('about');
  $('#app').innerHTML = `<div style="text-align:center;margin-top:10vh">${LOGO(64)}<h1 style="margin-top:12px">Alethra</h1><p class="sub">Jelajahi lebih jauh.<br>Versi ${esc(a.version)}</p>
  <p class="sub" style="font-size:12.5px">Chromium ${esc(a.chrome)} · Electron ${esc(a.electron)} · Node ${esc(a.node)}<br>Data: ${esc(a.data)}</p></div>`;
})();
