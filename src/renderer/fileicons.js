/* Ikon berkas berwarna (SVG) menurut format. Pakai: FILEICON('laporan.pdf', 34) */
(function () {
  // Palet: [warna badan, warna lipatan, warna label/ikon]
  const C = {
    red: ['#fde4e4', '#f5b9b9', '#e0605f'], blue: ['#d3e4fb', '#a9c8f3', '#4a8de0'], green: ['#dcefd9', '#b5dcae', '#78bd74'],
    teal: ['#c1e8e0', '#93d3c6', '#3fae9b'], orange: ['#fedcc4', '#fbbd93', '#f78a47'], gray: ['#dde1ea', '#b9c0cf', '#7f8aa3'],
    purple: ['#e0d6f5', '#c4b3ea', '#9275d3'], yellow: ['#fdecb9', '#f7d87c', '#efc24b'], brown: ['#ecd5c2', '#d9b496', '#b9825a'],
    cyan: ['#cdeefa', '#9fdcf2', '#4cb7dc'], pink: ['#fcd5e3', '#f7a9c6', '#e5668f'], indigo: ['#c9d9fb', '#9fb8f2', '#5b82dd'],
    lime: ['#d6f0d4', '#acdca9', '#6ab568'], slate: ['#d5d9e3', '#aeb5c6', '#6e7a94']
  };
  const t = (s, x, y, sz, f) => `<text x="${x}" y="${y}" text-anchor="middle" font-size="${sz}" font-weight="800" fill="${f}" font-family="Segoe UI,Arial,sans-serif">${s}</text>`;
  const S = (d, c, w) => `<path d="${d}" fill="none" stroke="${c}" stroke-width="${w || 2}" stroke-linecap="round" stroke-linejoin="round"/>`;
  const F = (d, c) => `<path d="${d}" fill="${c}"/>`;
  const R = (x, y, w, h, c, r) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r || 2}" fill="${c}"/>`;

  // Glif (area atas, kira-kira x 12–36, y 10–32)
  const G = {
    pdf: c => S('M14 31c4-3 7-9 9-18 2 9 5 14 11 16-7-1-14 1-20 2z', c, 2.2),
    word: c => R(13, 12, 22, 19, c, 3) + `<path d="M17.5 17l2.2 9 2.3-7 2.3 7 2.2-9" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`,
    grid: c => R(13, 12, 22, 19, c, 3) + S('M13 18.3h22M13 24.6h22M20.3 12v19M27.6 12v19', '#fff', 1.6),
    ppt: c => R(13, 12, 22, 19, c, 3) + t('P', 24, 27.5, 15, '#fff'),
    txt: c => S('M13 15h22M13 21h22M13 27h13', c, 2.6),
    log: c => R(14, 11, 20, 22, 'none', 3).replace('fill="none"', `fill="none" stroke="${c}" stroke-width="2"`) + S('M19 18h10M19 23h10M19 28h6', c, 1.8),
    zip: c => S('M24 9v22', c, 3.4).replace('stroke-linecap="round"', 'stroke-dasharray="2.4 2.2"') + `<circle cx="24" cy="30" r="3.6" fill="none" stroke="${c}" stroke-width="2.2"/>`,
    rar: c => F('M24 10l11 5-11 5-11-5z', c) + S('M13 21l11 5 11-5M13 27l11 5 11-5', c, 2.4),
    tar: c => F('M24 10l11 5.5v11L24 32 13 26.5v-11z', c) + S('M13 15.5l11 5.5 11-5.5M24 21v11', '#fff', 1.6),
    sz: c => t('7z', 24, 29, 20, c),
    json: c => t('{ }', 24, 28, 17, c),
    xml: c => S('M19 15l-7 7 7 7M29 15l7 7-7 7M26 13l-4 18', c, 2.4),
    css: c => F('M15 11h18l-1.6 16L24 31l-7.4-4z', c) + t('3', 24, 25, 13, '#fff'),
    js: c => t('JS', 24, 29, 19, c),
    img: c => R(13, 12, 22, 19, 'none', 3).replace('fill="none"', `fill="none" stroke="${c}" stroke-width="2.2"`) + `<circle cx="29" cy="18" r="2" fill="${c}"/>` + F('M14 30l7-8 5 5 3-3 6 6z', c),
    gif: c => F('M18 12l15 10-15 10z', c),
    svg: c => S('M14 29c0-12 20-12 20 0', c, 2) + R(11.5, 27, 5, 5, '#fff', 1).replace('fill="#fff"', `fill="#fff" stroke="${c}" stroke-width="1.6"`) + R(31.5, 27, 5, 5, '#fff', 1).replace('fill="#fff"', `fill="#fff" stroke="${c}" stroke-width="1.6"`),
    note: c => F('M20 28a3.6 3.6 0 1 1-3.6-3.6c.9 0 1.7.3 2.3.8V13l12-3v14.4a3.6 3.6 0 1 1-3.6-3.6c.9 0 1.7.3 2.3.8V15l-7.4 1.9z', c),
    wave: c => S('M13 20v4M17 17v10M21 12v20M25 15v14M29 18v8M33 21v2', c, 2.4),
    play: c => F('M18 12l16 10-16 10z', c),
    film: c => R(13, 11, 22, 21, 'none', 3).replace('fill="none"', `fill="none" stroke="${c}" stroke-width="2.2"`) + S('M19 11v21M29 11v21M13 18h6M13 25h6M29 18h6M29 25h6', c, 1.8),
    mov: c => `<circle cx="24" cy="21" r="10" fill="none" stroke="${c}" stroke-width="3.4"/>` + F('M22 17.5l6 3.5-6 3.5z', c),
    vec: c => S('M13 29c0-12 22-12 22 0', c, 2) + `<circle cx="13" cy="29" r="2.6" fill="${c}"/><circle cx="35" cy="29" r="2.6" fill="${c}"/>`,
    ai: c => t('Ai', 24, 29, 19, c), ps: c => t('Ps', 24, 29, 19, c), id: c => t('Id', 24, 29, 19, c),
    exe: c => `<circle cx="24" cy="21.5" r="7" fill="none" stroke="${c}" stroke-width="5" stroke-dasharray="3.6 2.1"/><circle cx="24" cy="21.5" r="5.5" fill="none" stroke="${c}" stroke-width="2.6"/>`,
    doc: c => S('M14 15h20M14 21h20M14 27h12', c, 2.4)
  };

  // ekstensi -> [palet, glif, label]
  const M = {};
  const add = (list, pal, g, lab) => list.split(' ').forEach(e => { M[e] = [pal, g, lab || e.toUpperCase()]; });
  add('pdf', 'red', 'pdf'); add('doc', 'blue', 'word'); add('docx', 'blue', 'word'); add('rtf odt dot dotx', 'blue', 'word');
  add('xls', 'green', 'grid'); add('xlsx', 'teal', 'grid'); add('xlsm ods', 'teal', 'grid'); add('csv tsv', 'lime', 'grid');
  add('ppt', 'orange', 'ppt'); add('pptx', 'orange', 'ppt'); add('odp pps ppsx', 'orange', 'ppt');
  add('txt md', 'gray', 'txt'); add('log', 'slate', 'log');
  add('rar', 'purple', 'rar'); add('zip', 'yellow', 'zip'); add('7z', 'gray', 'sz'); add('tar', 'brown', 'tar');
  add('gz', 'teal', 'zip'); add('bz2', 'purple', 'zip'); add('xz tgz zst', 'teal', 'zip');
  add('json', 'cyan', 'json'); add('xml', 'orange', 'xml'); add('html htm', 'orange', 'xml', 'HTML'); add('css', 'blue', 'css'); add('js mjs', 'yellow', 'js');
  add('png', 'purple', 'img'); add('jpg jpeg', 'green', 'img', 'JPG'); add('gif', 'pink', 'gif'); add('svg', 'purple', 'svg'); add('webp', 'teal', 'img');
  add('tif tiff', 'cyan', 'img', 'TIF'); add('bmp ico heic avif', 'indigo', 'img');
  add('mp3', 'pink', 'note'); add('m4a aac wma opus', 'pink', 'note'); add('wav', 'blue', 'wave'); add('ogg', 'purple', 'wave'); add('flac', 'green', 'wave');
  add('mp4', 'indigo', 'play'); add('m4v webm mpg mpeg 3gp', 'indigo', 'play'); add('avi', 'purple', 'film'); add('mov', 'cyan', 'mov'); add('mkv', 'slate', 'film');
  add('eps', 'purple', 'vec'); add('ai', 'orange', 'ai'); add('psd', 'indigo', 'ps'); add('indd', 'pink', 'id');
  add('exe', 'indigo', 'exe'); add('msi', 'indigo', 'exe'); add('apk dmg iso', 'slate', 'exe');

  window.FILEEXT = n => { const m = /\.([a-z0-9]{1,8})$/i.exec(String(n || '')); return m ? m[1].toLowerCase() : ''; };
  window.FILEICON = function (name, w) {
    w = w || 34;
    const ext = FILEEXT(name);
    const [pal, g, lab] = M[ext] || ['gray', 'doc', ext ? ext.slice(0, 4).toUpperCase() : 'FILE'];
    const [body, fold, main] = C[pal];
    const fs = lab.length > 3 ? 9.6 : 11;
    return `<svg class="fi-svg" viewBox="0 0 48 56" style="width:${w}px;height:${Math.round(w * 56 / 48)}px" aria-hidden="true">`
      + `<path d="M9 2H32L44 14V49A5 5 0 0 1 39 54H9A5 5 0 0 1 4 49V7A5 5 0 0 1 9 2Z" fill="${body}"/>`
      + `<path d="M32 2V9A5 5 0 0 0 37 14H44Z" fill="${fold}"/>`
      + (G[g] || G.doc)(main)
      + `<path d="M4 37H44V49A5 5 0 0 1 39 54H9A5 5 0 0 1 4 49Z" fill="${main}"/>`
      + t(esc(lab), 24, 49, fs, '#fff')
      + `</svg>`;
  };
})();
