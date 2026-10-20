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
| Mode baca + TTS | Ada (Ctrl+Alt+R), memakai suara Windows |
| Kualitas video | Menu Tools → Kualitas video… |
| Video mini | Diganti Picture-in-Picture bawaan Chromium |
| Izin situs | Bilah izin + manajer di Pengaturan |
| Pengelola sandi | Terenkripsi (Windows DPAPI), isi otomatis saat kolom diklik |
| Kunci aplikasi | **PIN** (scrypt), seluruh app atau bagian tertentu |
| Mode desktop/seluler | Dibalik: *Tampilan situs seluler* per situs |
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
