# Alethra Browser — Versi PC (Windows)

Port desktop dari **Alethra Browser v68 (Android)**, dibangun dengan Electron (Chromium) dan UI bergaya desktop:
tab bar di atas, toolbar + omnibox, bilah bookmark, menu ⋮, dan pintasan keyboard lengkap.
GitHub Actions membuat **installer `.exe`** dan **versi portable `.exe`** otomatis.

## Cara build `.exe` di GitHub
1. Buat repo baru di GitHub, lalu unggah **seluruh isi folder ini** (termasuk folder `.github`).
2. Buka tab **Actions** → workflow **Build EXE (Windows)** (jalan otomatis saat push ke `main`, atau klik *Run workflow*).
3. Setelah selesai (± 3–5 menit), ambil hasilnya di **Artifacts** → `Alethra-Windows` (berisi `Alethra-Setup-x.y.z.exe` dan `Alethra-Portable-x.y.z.exe`) atau di tab **Releases**.

> Belum ditandatangani kode (code signing), jadi Windows SmartScreen bisa menampilkan peringatan → klik *More info* → *Run anyway*.

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
| **Terjemahan Suara** (terjemahan ucapan video) | Menu ⋮ → Terjemahan Suara (Ctrl+Alt+S), lihat bagian di bawah |
| Mode baca + TTS | Ada (Ctrl+Alt+R), memakai suara Windows |
| Kualitas video | Menu ⋮ → Kualitas video… |
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
- Popup bisa digeser dan ditutup dengan X. Saat video layar penuh, terjemahan tampil sebagai subtitle (ukuran, posisi, latar, warna diatur di *Teks suara di layar penuh*) dan hilang 8 detik setelah ucapan berhenti.
- Berhenti otomatis saat pindah tab atau halaman. Video di iframe lintas-situs dan video ber-DRM tidak bisa ditangkap.
- Mesin offline tersedia di Pengaturan → Mesin offline (lihat bagian di bawah). Vosk, ML Kit, NLLB, dan Argos versi Android tidak dibawa.

## Mesin offline (Pengaturan → Mesin offline)
Terjemahan Suara (pengenalan ucapan dan penerjemahannya) bisa berjalan di PC tanpa internet, memakai model ringan yang diunduh sekali dari Hugging Face ke `%APPDATA%\Alethra\models`.
- **Pengenalan suara**: [sherpa-onnx](https://github.com/k2-fsa/sherpa-onnx) dengan Whisper tiny/base (semua bahasa), Whisper tiny/base Inggris, Moonshine tiny/base Jepang, Zipformer (Jepang ReazonSpeech, Inggris, Korea, Rusia, Vietnam). Ukuran ±40–170 MB.
- **Terjemahan**: Opus-MT int8 (±85 MB per arah, lewat Inggris bila tidak ada pasangan langsung): Jepang, Mandarin, Korea, Vietnam, Thai, Rusia, Arab, Hindi, Turki, Spanyol, Prancis, Jerman, Italia, Belanda, Indonesia. Cadangan Google Translate bisa dimatikan.
- Pilih di **Pengaturan → Play → Terjemahan Suara**: *Mesin suara ke teks* (Whisper cloud / Offline di PC) dan *Terjemahan hasil suara* (Online / Offline); keduanya bisa dikombinasikan bebas. Pengaturan audio dan layar penuh tetap berlaku.
- Mesin jalan di proses terpisah (tidak membuat browser tersendat) dan dilepas dari memori 45 detik setelah Terjemahan Suara dimatikan. Jumlah thread CPU bisa diatur.
- Bila huggingface.co diblokir, set variabel lingkungan `ALETHRA_HF=https://hf-mirror.com` sebelum membuka Alethra.

Tidak dibawa karena khusus Android: biometrik, pintasan layar utama, intent berbagi, notifikasi bar status.

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
