# Alethra Browser — Versi PC (Windows)

Port desktop dari **Alethra Browser v68 (Android)**, dibangun dengan Electron (Chromium) dan UI bergaya desktop:
tab bar di atas, toolbar + omnibox, bilah bookmark, menu Tools (tombol "Tools"), menu ⋮, dan pintasan keyboard lengkap.
GitHub Actions membuat **installer `.exe`** dan **versi portable `.exe`** otomatis.

## Cara build `.exe` di GitHub
1. Buat repo baru di GitHub, lalu unggah **seluruh isi folder ini** (termasuk folder `.github`).
2. Buka tab **Actions** → workflow **Build EXE (Windows)** (jalan otomatis saat push ke `main`, atau klik *Run workflow*).
3. Setelah selesai (± 3–5 menit), ambil hasilnya di **Artifacts** → `Alethra-Windows` (berisi `Alethra-Setup-x.y.z.exe` dan `Alethra-Portable-x.y.z.exe`) atau di tab **Releases**.

> Build tanpa sertifikat belum ditandatangani (code signing), jadi Windows SmartScreen bisa menampilkan peringatan → klik *More info* → *Run anyway*. Untuk rilis publik, tanda tangani build; lihat bagian *Penandatanganan kode* di bawah.

## Jalankan / build lokal
```bash
npm install
npm start        # jalankan langsung
npm run dist     # hasilkan .exe di folder dist/ (di Windows)
```

## Fitur (dipetakan dari versi Android)
| Fitur | Di versi PC |
|---|---|
| Tab & tab Incognito (sesi memori, terhapus saat ditutup) | Tab bar ala Chrome: seret untuk urutkan, klik-tengah tutup, bisukan tab, Ctrl+Shift+T |
| Bilah alamat + saran bookmark/histori | Omnibox dengan saran dan indikator HTTPS/HTTP |
| Beranda (jam, pintasan, aksen, wallpaper) | `alethra://home` + kotak pencarian; opsi jam di Pengaturan → Tampilan |
| Bookmark (folder, impor/ekspor HTML) | Halaman Bookmark + bilah bookmark (Ctrl+Shift+B) |
| Histori | Dikelompokkan per hari, cari, hapus |
| Unduhan (jeda/lanjut/batal) | Pengelola unduhan, lokasi simpan, opsi "tanya lokasi" |
| Halaman offline | Simpan MHTML + PDF (Ctrl+S) |
| Blokir iklan YouTube, iklan situs, jaringan iklan | Skrip asli dipakai ulang; bisa dimatikan per situs |
| DNS aman (DoH) | Cloudflare, AdGuard, Quad9, Google, kustom |
| Cookie pihak ketiga, HTTPS-only, DNT/GPC | Ada |
| Penerjemah halaman + chat live | Ada (Ctrl+Alt+T); chat live juga bisa dinyalakan dari menu ⋮ |
| **Terjemahan Suara** (terjemahan ucapan video) | Menu Tools → Terjemahan Suara (Ctrl+Alt+S), lihat bagian di bawah |
| Mode baca + TTS | Ada (Ctrl+Alt+R), memakai suara Windows. Tombol 🌐 di bilah mode baca: pilih **bahasa suara** (Otomatis = dideteksi per paragraf), **jenis suara Pria/Wanita**, dan suara tertentu; pilihan tersimpan. Suara bahasa lain dipasang di Pengaturan Windows → Waktu & bahasa → Ucapan |
| Tombol layar penuh | Tombol Tools dan ⋮ yang melayang saat layar penuh bisa **digeser** (tahan lalu seret); posisinya tersimpan dan menu terbuka di dekatnya (ke atas bila tombol di bawah). Warna dan transparansinya diatur di **Pengaturan → Widget → Tombol menu layar penuh** |
| Widget (Pengaturan) | Menu baru berisi bagian lipat: *Tombol menu layar penuh* dan *Jam* (dipindah dari Tampilan) |
| Kualitas video | Menu Tools → Kualitas video… |
| Video mini | Diganti Picture-in-Picture bawaan Chromium |
| Izin situs | Bilah izin + manajer di Pengaturan |
| Pengelola sandi | Terenkripsi (Windows DPAPI), isi otomatis saat kolom diklik |
| Kunci aplikasi | **PIN** (scrypt), seluruh app atau bagian tertentu |
| Mode desktop/seluler | Dibalik: *Tampilan situs seluler* per situs |
| Mode perangkat (ponsel/tablet) | *Mode perangkat* di Tools atau Ctrl+Shift+M (juga dari dalam Alat pengembang): halaman dipersempit seperti layar ponsel (390×844) atau tablet (820×1180), memakai UA seluler dan emulasi sentuh. Tekan lagi untuk ganti/mati |
| Cadangan | Ekspor/impor JSON |
| Browser default | Installer mendaftarkan Alethra ke Windows (*Aplikasi default*) |

## Terjemahan Suara (dari Android v90)
Menerjemahkan ucapan di video secara hampir realtime, tanpa mikrofon (audio diambil langsung dari elemen video/audio halaman).
- **Pengaturan → Play → Terjemahan Suara**: pilih penyedia **Groq** (gratis, disarankan), **OpenAI**, atau **Kustom** (server Whisper kompatibel OpenAI, misalnya faster-whisper-server/LocalAI/whisper.cpp server di PC sendiri, sehingga bisa offline). Isi **Kunci API** (disimpan terenkripsi Windows DPAPI dan tidak ikut cadangan).
- Pilih **Bahasa ucapan video**, **Bahasa tujuan**, dan **Kecepatan teks** (Cepat / Seimbang / Hemat).
- **Pengaturan audio**: preset (Video bising, Suara pelan, Musik latar, …), penguat volume, volume minimum/maksimum, kepekaan, peredam derau, filter, penyaring halusinasi, level volume, dan Mode klasik. Perubahan langsung diterapkan.
- Popup bisa digeser dan ditutup dengan X. Saat video layar penuh, terjemahan tampil sebagai subtitle (ukuran, posisi, transparansi, warna, lebar, tinggi diatur di *Teks suara di layar penuh*; kotak di luar layar penuh diatur di *Kotak terjemahan suara*) dan hilang 8 detik setelah ucapan berhenti.
- Berhenti otomatis saat pindah tab atau halaman. Video di iframe lintas-situs dan video ber-DRM tidak bisa ditangkap.
- Mesin offline tersedia di Pengaturan → Mesin offline (lihat bagian di bawah). ML Kit dan Argos versi Android tidak dibawa.

## Mesin offline (Pengaturan → Mesin offline)
Terjemahan Suara (pengenalan ucapan dan penerjemahannya) bisa berjalan di PC tanpa internet. Model diunduh sekali ke `%APPDATA%\Alethra\models`. **Mesin suara dan mesin terjemahan bebas dikombinasikan** (mis. sherpa-onnx + NLLB, Vosk + Opus-MT, Whisper Transformers.js + Google Translate).

**Suara ke teks** (Pengaturan → Play → *Mesin suara ke teks*):
| Mesin | Model | Catatan |
|---|---|---|
| **sherpa-onnx** | Whisper tiny/base (semua bahasa & Inggris), Moonshine tiny/base Jepang, Zipformer (Jepang, Inggris, Korea, Rusia, Thai, Kanton, Vietnam) · ±40–260 MB | Ringan dan cepat |
| **Whisper (Transformers.js)** | Whisper tiny/base/small, multibahasa dan varian `.en` (ONNX int8 dari Xenova) · ±45–270 MB | Semua bahasa; bahasa ditebak otomatis bila *Bahasa ucapan video* = Otomatis |
| **Vosk** | Satu model kecil per bahasa: Inggris, Jepang, Mandarin, Korea, Rusia, Vietnam, Turki, Hindi, Spanyol, Prancis, Jerman, Italia, Belanda, Portugis, Arab, Polandia, Ukraina · ±30–105 MB | Sangat ringan, tanpa tanda baca. Tidak ada model Indonesia resmi |

**Terjemahan** (*Terjemahan hasil suara*):
- **Opus-MT** (±85 MB per arah, lewat Inggris bila tidak ada pasangan langsung): Jepang, Mandarin, Korea, Vietnam, Thai, Rusia, Arab, Hindi, Turki, Spanyol, Prancis, Jerman, Italia, Belanda, Indonesia.
- **NLLB-200 distilled 600M** (Transformers.js, ±900 MB unduhan, ±1,5 GB RAM): satu model untuk semua pasangan bahasa (±40 bahasa tujuan tersedia di Alethra), tanpa lewat Inggris.
- Cadangan Google Translate bisa dimatikan.

Mesin jalan di proses terpisah (tidak membuat browser tersendat) dan dilepas dari memori 45 detik setelah Terjemahan Suara dimatikan. Jumlah thread CPU bisa diatur. Unduhan memakai Hugging Face (bisa diganti cermin di Pengaturan → Mesin offline → Sumber unduhan model; variabel `ALETHRA_HF` masih dikenali sebagai cadangan) dan alphacephei.com untuk Vosk (`ALETHRA_VOSK`).

## Pintasan keyboard
Ctrl+T tab baru · Ctrl+Shift+N Incognito · Ctrl+W tutup · Ctrl+Tab ganti tab · Ctrl+1…9 · Ctrl+L alamat · Ctrl+F cari ·
Ctrl+D bookmark · Ctrl+H histori · Ctrl+J unduhan · Ctrl+P cetak · Ctrl+S simpan offline · Ctrl +/−/0 zoom ·
F11 layar penuh · F12 devtools · Ctrl+U sumber · Ctrl+Shift+Del hapus data · Alt+←/→ · Ctrl+, pengaturan

Data pengguna: `%APPDATA%\Alethra\data`.

## Jika aplikasi tidak terbuka
1. Buka **Task Manager** (Ctrl+Shift+Esc) → bila ada proses *Alethra* yang tersisa, **End task**, lalu buka lagi (Alethra hanya mengizinkan satu salinan).
2. Lihat log kesalahan: tekan Win+R, ketik `%APPDATA%\Alethra\alethra-log.txt`.
3. Jalankan dari terminal untuk melihat pesan error:
   `"%LOCALAPPDATA%\Programs\Alethra\Alethra.exe"`

## Menu Tools
Tombol "Tools" di toolbar (antara Unduhan dan ⋮) berisi: cari di halaman, cetak, PDF, simpan offline, terjemahan, chat live, Terjemahan Suara, mode baca, kualitas video, PiP, situs seluler, blokir iklan situs. Item yang tampil diatur di **Pengaturan → Tools**. Fitur yang dimatikan di **Pengaturan → Play** (Terjemahkan situs, Terjemahan Suara) tetap muncul di menu Tools dalam keadaan redup dengan keterangan (mis. "Dimatikan di Play", "Model suara belum terpasang"); klik item itu membuka pengaturan yang tepat. Saat menu Tools dibuka, model suara offline dimuat lebih dulu di latar belakang supaya Terjemahan Suara langsung siap.

### Catatan unduhan model
Model sherpa-onnx diunduh dari Hugging Face dan tersebar di beberapa akun (`csukuangfj`, `csukuangfj2`, `k2-fsa`). Alethra mencoba semuanya berurutan. Hugging Face menjawab HTTP 401 untuk repo yang tidak ada, jadi 401 berarti nama repo tidak ditemukan, bukan butuh login. Bila Hugging Face diblokir atau lambat, ganti **Sumber unduhan model** di Pengaturan → Mesin offline (pilih `hf-mirror.com` atau isi alamat sendiri, lalu tekan *Uji*). Bila unduhan gagal, tombol **Salin detail error** menyalin versi aplikasi, sumber, tahap, dan pesan galat untuk laporan.

Daftar model di Pengaturan > Mesin offline hanya menampilkan mesin suara dan mode terjemahan yang sedang dipilih.

## Penandatanganan kode (Windows)
Workflow `build.yml` otomatis menandatangani installer dan portable **bila** dua secret berikut diisi di GitHub (Settings → Secrets and variables → Actions). Bila kosong, build tetap jalan tanpa tanda tangan seperti sebelumnya.

| Secret | Isi |
|---|---|
| `WIN_CSC_LINK` | Sertifikat code signing `.pfx` dalam base64 (atau URL berkas) |
| `WIN_CSC_KEY_PASSWORD` | Kata sandi `.pfx` |

Pilihan sertifikat (cek syarat dan harga terbaru ke masing-masing penyedia):
- **Sertifikat OV/EV dari CA** (DigiCert, Sectigo, SSL.com, dll.). Pastikan CA mengizinkan penyimpanan kunci yang bisa dipakai di CI; sebagian CA mewajibkan token fisik atau layanan tanda tangan awan.
- **Azure Trusted Signing**: berlangganan bulanan, kunci tidak keluar dari Azure. electron-builder mendukungnya lewat `win.azureSignOptions`.
- **SignPath Foundation**: gratis untuk proyek open source yang memenuhi syarat.

Catatan: tanda tangan memastikan penerbit tercatat, tetapi reputasi SmartScreen untuk berkas baru tetap perlu waktu dan jumlah unduhan untuk naik, jadi peringatan bisa masih muncul di rilis-rilis awal.

## Tampilan terpisah (split view)
Dua halaman berdampingan, mis. video di satu sisi dan catatan/chat di sisi lain.
- **Membuka:** Tools → *Tampilan terpisah* (Ctrl+Alt+V, membuka tab baru di sisi), klik kanan tab → *Tampilan terpisah dengan tab aktif*, atau klik kanan tautan → *Buka tautan di sisi*.
- **Fokus:** klik panel mana pun, atau Ctrl+Alt+←/→. Omnibox, pintasan, zoom, cari, dan menu selalu bekerja pada panel yang fokus (garis aksen di atasnya).
- **Ukuran:** seret pembagi, panah ←/→ saat pembagi fokus, klik dua kali untuk 50:50. Rasio diingat.
- **Responsif:** susunan *otomatis* = berdampingan bila jendela ≥ 900 px, atas-bawah bila lebih sempit (bisa dipaksa di Pengaturan → Tampilan). Tiap panel punya ukuran minimum; jendela < 520 px hanya menampilkan panel fokus (pasangan tetap tersimpan).
- **Pasangan:** memilih tab di luar pasangan menangguhkan split; memilih salah satu tab pasangan memulihkannya. Menutup salah satu tab membubarkan split. Video layar penuh memakai seluruh jendela.
- Terjemahan Suara tidak terhenti saat fokus berpindah antar panel; popupnya mengikuti panel video.
- Split belum disimpan antar-sesi (saat Alethra dibuka ulang, tab kembali biasa).

## Riwayat Terjemahan Suara
Tools → *Riwayat terjemahan suara* (Ctrl+Alt+H, atau ikon jam di popup) membuka `alethra://transcript` di sisi video.
- Daftar kalimat (terjemahan + asli) bergulir otomatis, bisa dicari, disalin (semua/per kalimat), dan disimpan sebagai **.txt** atau **.srt**.
- Waktu mengikuti **posisi video** (halaman mengirim `currentTime` tiap potongan audio), jadi `.srt` cocok dengan videonya; mengklik waktu melompat ke posisi itu di video. Untuk siaran langsung (durasi tak hingga) dipakai waktu sejak sesi dimulai.
- Privasi: hanya di memori (5 sesi terakhir, maks 3000 kalimat per sesi), tidak pernah dicatat di tab Incognito, bisa dimatikan (Pengaturan → Play → Mesin suara). *Simpan otomatis saat berhenti* (mati bawaan) menulis .srt dan .txt ke Unduhan → Transkrip Alethra. *Buka riwayat di sisi video otomatis* juga tersedia.

## Mengelola banyak tab
- **Sematkan tab:** klik kanan tab → *Sematkan tab*. Tab sematan hanya berupa ikon di paling kiri, tanpa tombol tutup (klik tengah juga tidak menutupnya), tidak ikut *Tutup tab lain/semua*, dan **selalu dipulihkan saat Alethra dibuka**, walau "Lanjutkan sesi sebelumnya" mati. Menyematkan tab di dalam grup mengeluarkannya dari grup.
- **Ikon terjemahan (di kiri Unduhan):** klik untuk memilih bahasa tujuan dari daftar ±100 bahasa (ada kolom cari, Enter memilih hasil pertama). Baris *Bahasa asal* di atas daftar memungkinkan memilih bahasa teks sumber (default *Deteksi otomatis*, selalu di paling atas daftar asal). Pilihan hanya berlaku untuk tab itu; *Tampilkan bahasa asli* mengembalikan teks. Ctrl+Alt+T tetap menerjemahkan langsung ke bahasa default di Pengaturan.
- **Warna toolbar (tema terang):** toolbar kini abu-abu dengan garis pemisah di bawahnya agar tidak menyatu dengan halaman putih. Gaya bawaan (berlaku di tema terang, gelap, dan AMOLED): Abu-abu (bawaan), Biru keabuan, Krem hangat, Menyatu dengan halaman. Selain itu ada **warna kustom** (swatch, pemilih warna, atau kode hex `#RRGGBB`/`#RGB`) yang berlaku di tema terang maupun gelap; teks, strip tab, dan kolom alamat menyesuaikan otomatis (Pengaturan → Tampilan → Warna toolbar).
- **Atur tab (menu ⋮ → Atur tab):** membuka daftar opsi yang sama dengan klik kanan pada tab (muat ulang, duplikat, bisukan, sematkan, grup, tampilan terpisah, tutup tab/di kanan/lain/semua) untuk tab yang sedang aktif. Klik kanan pada tab tetap tersedia seperti biasa.
- **Cari tab (Ctrl+Shift+A, tombol kaca pembesar di samping +, atau menu ⋮):** palet yang menyaring tab terbuka berdasarkan judul, alamat, dan nama grup (beberapa kata sekaligus). Urutan awal = yang terakhir dipakai, dengan sorotan di tab sebelumnya (seperti Alt+Tab). ↑↓ memilih, Enter membuka, Del menutup tab yang disorot. Di bawahnya ada tab yang baru ditutup, bisa dibuka lagi.
- **Tutup massal:** menu ⋮ → *Tutup tab lain* dan *Tutup semua tab* (juga di klik kanan tab, bersama *Tutup tab di kanan*). Tab sematan dilewati; bila tidak ada yang tersisa, dibuatkan tab baru. Penutupan ≥ 5 tab meminta konfirmasi. Tab yang ditutup bisa dibuka lagi dengan Ctrl+Shift+T (50 terakhir).
- **Kelompok tab berwarna:** klik kanan tab → *Tambahkan ke grup → Grup baru…* (nama opsional + 9 warna). Chip berwarna di depan grup: klik untuk menciutkan/membentangkan, klik kanan untuk ubah nama/warna, tab baru di grup, pisahkan grup, atau tutup grup. Seret tab ke chip untuk memasukkannya; seret keluar dari deretan grup untuk melepasnya. Tab yang dibuka dari tab dalam grup ikut grup itu. Grup disimpan bersama sesi.
- Puluhan tab: strip tab bisa digulir dengan roda mouse, tab aktif selalu digulirkan ke tampilan, dan Ctrl+Tab melewati grup yang diciutkan.
