(async function () {
  await pageInit();
  const P = new URLSearchParams(location.search), u = P.get('u') || '', c = +P.get('c') || 0, d = P.get('d') || '';
  let host = ''; try { host = new URL(u).hostname; } catch {}
  const MSG = { '-105': ['Situs tidak ditemukan', 'Nama domain tidak dapat diterjemahkan. Periksa ejaan alamat atau koneksi internet Anda.'], '-106': ['Tidak ada internet', 'Periksa koneksi jaringan Anda lalu coba lagi.'], '-102': ['Koneksi ditolak', 'Server menolak sambungan.'], '-118': ['Waktu habis', 'Situs terlalu lama merespons.'], '-109': ['Alamat tidak dapat dijangkau', 'Server tidak dapat dijangkau.'], '-501': ['Koneksi tidak aman', 'Sertifikat situs tidak valid.'] };
  const m = MSG[c] || ['Halaman tidak dapat dimuat', 'Terjadi kesalahan saat membuka halaman.'];
  document.title = m[0];
  $('#app').innerHTML = `<div style="text-align:center;margin-top:12vh">${LOGO(56)}<h1 style="margin-top:14px">${esc(m[0])}</h1><p class="sub">${esc(host || u)}<br>${esc(m[1])}</p><p class="sub" style="font-size:12px">${esc(d)} (${c})</p>
  <p><button class="btn pri" id="r">Coba lagi</button> ${c === -105 ? '<button class="btn" id="dns">Aktifkan DNS aman</button>' : ''}</p>
  ${c === -105 ? '<p class="sub" style="max-width:480px;margin:18px auto">Bila situs diblokir oleh penyedia internet, DNS aman (DoH) sering membantu. Buka Pengaturan → Privasi & Keamanan.</p>' : ''}</div>`;
  $('#r').onclick = () => api('nav.to', u);
  const dn = $('#dns'); if (dn) dn.onclick = () => api('nav.open', 'alethra://settings#privasi');
})();
