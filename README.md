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
| Bilah alamat + saran bookmark/histori | Omnibox dengan saran. Ikon di kiri omnibox adalah tombol **Pengaturan situs** (seperti Chrome): *Koneksi aman/tidak aman*, *Cookie dan data situs* (lihat jumlah, hapus), dan *Pengaturan situs* (izin Lokasi/Kamera/Mikrofon/Notifikasi/Papan klip per situs, blokir iklan, setel ulang izin) |
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
| Tombol layar penuh | Tiga tombol kotak melayang (1 baris × 3 kolom: **Tools, ⋮, ✕ keluar layar penuh**) bisa **digeser** (tahan lalu seret); posisinya tersimpan dan menu terbuka di dekatnya (ke atas bila tombol di bawah). Warna dan transparansinya diatur di **Pengaturan → Widget → Tombol menu layar penuh** |
| Alamat di layar penuh | Menu Tools (tombol melayang) punya kotak alamat/pencarian di paling atas dengan tombol **Salin / Tempel / Hapus / Buka**, lalu Cari di halaman, Cetak, Simpan sebagai PDF, dan Simpan offline. Ctrl+L / F6 membukanya langsung |
| Widget (Pengaturan) | Menu baru berisi bagian lipat: *Tombol menu layar penuh* dan *Jam* (dipindah dari Tampilan) |
| Kualitas video | Menu Tools → Kualitas video… |
| Notepad | Menu Tools → Notepad (Ctrl+Alt+N). Catatan melayang di atas halaman (lihat bagian *Notepad* di bawah) |
| Mini browser | Menu Tools → Mini browser (Ctrl+Alt+B). Jendela web kecil yang melayang di atas halaman (lihat bagian *Mini browser* di bawah) |
| Riwayat clipboard | Menu Tools → Riwayat clipboard (Ctrl+Alt+C). Daftar teks yang baru disalin (lihat bagian *Riwayat clipboard* di bawah) |
| Penerjemah melayang | Menu Tools → Penerjemah melayang (Ctrl+Alt+X). Kotak terjemahan kecil di atas halaman (lihat bagian *Penerjemah melayang* di bawah) |
| Sound Master | Menu Tools → Sound Master (Ctrl+Alt+M). Penguat volume per tab sampai 600 %, Bass boost, Voice boost, dan daftar tab yang berbunyi (lihat bagian *Sound Master* di bawah) |
| AlethPlay (pemutar musik & video) | Menu Tools → AlethPlay (Ctrl+Alt+P). Tab khusus untuk memutar musik/video dari folder perangkat dan unduhan; file media yang dibuka dari Unduhan, Windows (Buka dengan / aplikasi default), atau diseret ke jendela otomatis diputar di sini (lihat bagian *AlethPlay* di bawah) |
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
- **CTranslate2** (±80–155 MB per arah): model Opus-MT yang sama, dijalankan mesin native `ctranslate2`, jadi lebih cepat dan hemat memori. Model diambil dari repo `manancode/…-ctranslate2-android` (int8), cadangan `gaudi/…-ctranslate2`; pasangan yang repo-nya tidak lengkap akan menampilkan galat.
- **Bergamot** (mesin terjemahan Firefox, ±15–45 MB per arah): Marian int8 WASM (`@browsermt/bergamot-translator`). Daftar model dibaca dari Mozilla Remote Settings (cache 6 jam), berkas diperiksa sha256. Tidak semua pasangan bahasa tersedia; unduhan Bergamot tidak ikut pengaturan cermin Hugging Face.
- **Uji kecepatan** (Pengaturan → Mesin offline): menjalankan satu kalimat di Opus-MT, CTranslate2, Bergamot, dan NLLB yang sudah terpasang untuk pasangan bahasa pilihan, lalu menampilkan waktu (rata-rata 3 kali), waktu muat pertama, RAM, dan teks hasilnya.
- **Jeda / Lanjut**: semua unduhan model (suara dan terjemahan) bisa dijeda dan dilanjutkan dari byte terakhir (berkas `.part` disimpan).
- **NLLB-200 distilled 600M** (Transformers.js, ±900 MB unduhan, ±1,5 GB RAM): satu model untuk semua pasangan bahasa (±40 bahasa tujuan tersedia di Alethra), tanpa lewat Inggris.
- Cadangan Google Translate bisa dimatikan.

Mesin jalan di proses terpisah (tidak membuat browser tersendat) dan dilepas dari memori 45 detik setelah Terjemahan Suara dimatikan. Jumlah thread CPU bisa diatur. Unduhan memakai Hugging Face (bisa diganti cermin di Pengaturan → Mesin offline → Sumber unduhan model; variabel `ALETHRA_HF` masih dikenali sebagai cadangan) dan alphacephei.com untuk Vosk (`ALETHRA_VOSK`).

## Pintasan keyboard
Ctrl+T tab baru · Ctrl+Shift+N Incognito · Ctrl+W tutup · Ctrl+Tab ganti tab · Ctrl+1…9 · Ctrl+L alamat · Ctrl+F cari ·
Ctrl+D bookmark · Ctrl+H histori · Ctrl+J unduhan · Ctrl+P cetak · Ctrl+S simpan offline · Ctrl +/−/0 zoom ·
F11 layar penuh · F12 devtools · Ctrl+U sumber · Ctrl+Shift+Del hapus data · Alt+←/→ · Ctrl+, pengaturan · Ctrl+Alt+N Notepad · Ctrl+Alt+B Mini browser · Ctrl+Alt+C Riwayat clipboard · Ctrl+Alt+X Penerjemah melayang · Ctrl+Alt+M Sound Master

Data pengguna: `%APPDATA%\Alethra\data`.

## Jika aplikasi tidak terbuka
1. Buka **Task Manager** (Ctrl+Shift+Esc) → bila ada proses *Alethra* yang tersisa, **End task**, lalu buka lagi (Alethra hanya mengizinkan satu salinan).
2. Lihat log kesalahan: tekan Win+R, ketik `%APPDATA%\Alethra\alethra-log.txt`.
3. Jalankan dari terminal untuk melihat pesan error:
   `"%LOCALAPPDATA%\Programs\Alethra\Alethra.exe"`

## Menu Tools
Tombol "Tools" di toolbar (antara Unduhan dan ⋮) berisi: cari di halaman, cetak, PDF, simpan offline, terjemahan, chat live, Terjemahan Suara, mode baca, tampilan terpisah, **Notepad**, kualitas video, PiP, mode perangkat, blokir iklan situs. Item yang tampil diatur di **Pengaturan → Tools**. Fitur yang dimatikan di **Pengaturan → Play** (Terjemahkan situs, Terjemahan Suara) tetap muncul di menu Tools dalam keadaan redup dengan keterangan (mis. "Dimatikan di Play", "Model suara belum terpasang"); klik item itu membuka pengaturan yang tepat. Saat menu Tools dibuka, model suara offline dimuat lebih dulu di latar belakang supaya Terjemahan Suara langsung siap.

### Catatan unduhan model
Model sherpa-onnx diunduh dari Hugging Face dan tersebar di beberapa akun (`csukuangfj`, `csukuangfj2`, `k2-fsa`). Alethra mencoba semuanya berurutan. Hugging Face menjawab HTTP 401 untuk repo yang tidak ada, jadi 401 berarti nama repo tidak ditemukan, bukan butuh login. Bila Hugging Face diblokir atau lambat, ganti **Sumber unduhan model** di Pengaturan → Mesin offline (pilih `hf-mirror.com` atau isi alamat sendiri, lalu tekan *Uji*). Bila unduhan gagal, tombol **Salin detail error** menyalin versi aplikasi, sumber, tahap, dan pesan galat untuk laporan.

Daftar model di Pengaturan > Mesin offline hanya menampilkan mesin suara dan mode terjemahan yang sedang dipilih.

## Pembaruan otomatis
- **Installer (`Alethra-Setup-*.exe`)**: Alethra mengecek rilis terbaru di GitHub 20 detik setelah dibuka lalu tiap 6 jam, mengunduhnya di latar (hanya selisihnya bila bisa), dan memasangnya saat Alethra ditutup atau saat menekan **Mulai ulang & pasang** di Pengaturan → Tentang → Pembaruan. Bisa dimatikan lewat *Periksa dan unduh otomatis* (tombol *Periksa sekarang* tetap bisa dipakai).
- **Portable**: tidak bisa memasang sendiri. Alethra hanya memberi tahu ada versi baru dan membuka halaman rilis.
- **`npm start` / build lokal tanpa publish**: pembaruan tidak aktif (ditampilkan di Tentang).
- Syarat: repo GitHub **publik** (repo privat butuh token). Workflow `build.yml` sudah mengisi pengaturan publish dan mengunggah `latest.yml` serta `.blockmap` bersama installer; tanpa dua berkas itu, pembaruan otomatis tidak berfungsi. Nomor versi = `1.0.<nomor run>`, jadi tiap build baru dianggap lebih baru.
- Opsional: bila build ditandatangani, isi `win.publisherName` (nama pada sertifikat) di `package.json` agar electron-updater ikut memverifikasi tanda tangan installer pembaruan.

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
- **Terjemahkan halaman… (menu Tools):** klik untuk memilih bahasa tujuan dari daftar ±100 bahasa (ada kolom cari, Enter memilih hasil pertama). Baris *Bahasa asal* di atas daftar memungkinkan memilih bahasa teks sumber (default *Deteksi otomatis*, selalu di paling atas daftar asal). Pilihan hanya berlaku untuk tab itu; *Tampilkan bahasa asli* mengembalikan teks. Ctrl+Alt+T tetap menerjemahkan langsung ke bahasa default di Pengaturan.
- **Warna toolbar (tema terang):** toolbar kini abu-abu dengan garis pemisah di bawahnya agar tidak menyatu dengan halaman putih. Gaya bawaan (berlaku di tema terang, gelap, dan AMOLED): Abu-abu (bawaan), Biru keabuan, Krem hangat, Menyatu dengan halaman. Selain itu ada **warna kustom** (swatch, pemilih warna, atau kode hex `#RRGGBB`/`#RGB`) yang berlaku di tema terang maupun gelap; teks, strip tab, dan kolom alamat menyesuaikan otomatis (Pengaturan → Tampilan → Warna toolbar).
- **Atur tab (menu ⋮ → Atur tab):** membuka daftar opsi yang sama dengan klik kanan pada tab (muat ulang, duplikat, bisukan, sematkan, grup, tampilan terpisah, tutup tab/di kanan/lain/semua) untuk tab yang sedang aktif. Klik kanan pada tab tetap tersedia seperti biasa.
- **Cari tab (Ctrl+Shift+A, tombol kaca pembesar di samping +, atau menu ⋮):** palet yang menyaring tab terbuka berdasarkan judul, alamat, dan nama grup (beberapa kata sekaligus). Urutan awal = yang terakhir dipakai, dengan sorotan di tab sebelumnya (seperti Alt+Tab). ↑↓ memilih, Enter membuka, Del menutup tab yang disorot. Di bawahnya ada tab yang baru ditutup, bisa dibuka lagi.
- **Tutup massal:** menu ⋮ → *Tutup tab lain* dan *Tutup semua tab* (juga di klik kanan tab, bersama *Tutup tab di kanan*). Tab sematan dilewati; bila tidak ada yang tersisa, dibuatkan tab baru. Penutupan ≥ 5 tab meminta konfirmasi. Tab yang ditutup bisa dibuka lagi dengan Ctrl+Shift+T (50 terakhir).
- **Kelompok tab berwarna:** klik kanan tab → *Tambahkan ke grup → Grup baru…* (nama opsional + 9 warna). Chip berwarna di depan grup: klik untuk menciutkan/membentangkan, klik kanan untuk ubah nama/warna, tab baru di grup, pisahkan grup, atau tutup grup. Seret tab ke chip untuk memasukkannya; seret keluar dari deretan grup untuk melepasnya. Tab yang dibuka dari tab dalam grup ikut grup itu. Grup disimpan bersama sesi.
- Puluhan tab: strip tab bisa digulir dengan roda mouse, tab aktif selalu digulirkan ke tampilan, dan Ctrl+Tab melewati grup yang diciutkan.

## Mini browser
Menu Tools → **Mini browser** (atau Ctrl+Alt+B) membuka jendela web kecil yang melayang di atas halaman, cocok untuk kamus, Google Terjemahan, chat, atau situs referensi tanpa berpindah tab.
- **Isi:** bilah atas (judul, favorit ★, tampilan ponsel/desktop, buka di tab biasa, perkecil, tutup), bilah alamat dengan mundur/maju/muat ulang/daftar situs, lalu halaman web. Pegangan di pojok kanan bawah untuk mengubah ukuran.
- **Geser & ukuran:** tarik bilah atas untuk memindahkan. Tarik tepi kanan untuk mengubah lebar, kaki jendela (bagian bawah) untuk mengubah tinggi, atau pojok kanan bawah untuk keduanya. Posisi dan ukuran diingat (`minibox`).
- **Zoom:** tombol − / + dan angka persen di kaki jendela (klik angkanya untuk kembali ke 100%), atau Ctrl++ / Ctrl+− / Ctrl+0 di dalam mini browser. Zoom hanya berlaku di mini browser dan diingat per situs (`minizoom`); tab biasa tidak ikut berubah.
- **Perkecil:** tombol − mengubahnya jadi ikon bulat yang bisa digeser; situs tetap hidup di belakang (mis. musik tetap jalan). Ketuk ikon untuk membuka lagi. Tombol ✕ menutup dan menghentikan halaman.
- **Favorit:** buka sebuah situs lalu ketuk ★. Daftar favorit tampil saat mini browser dibuka tanpa alamat (`minisites`).
- **Sesi:** memakai sesi yang sama dengan tab biasa, jadi login, blokir iklan, dan pengaturan privasi tetap berlaku. Tautan yang dibuka dari dalamnya (target=_blank) tetap di jendela mini. Izin kamera/mikrofon/lokasi ditolak otomatis di mini browser.
- **Tampilan ponsel:** nyala secara bawaan supaya situs pas di jendela sempit; matikan untuk situs yang butuh tampilan desktop (mis. WhatsApp Web).
- **Pintasan di dalam mini browser:** Ctrl+R / F5 muat ulang, Alt+←/→ mundur/maju, Ctrl+L / F6 ke bilah alamat. Pintasan tab biasa (Ctrl+W, Ctrl+Tab, dst.) tidak berlaku di sini.
- **Menampilkan/menyembunyikan item:** Pengaturan → Tools → *Mini browser*. Bila dimatikan, jendela yang sedang terbuka ikut ditutup.

## Riwayat clipboard
Menu Tools → **Riwayat clipboard** (atau Ctrl+Alt+C) membuka daftar melayang berisi teks yang baru Anda salin, dari Alethra maupun aplikasi lain.
- **Pakai:** ketuk item untuk menyalinnya lagi; tombol tempel di kanan item langsung menempelkannya ke halaman aktif. Kolom cari menyaring isi riwayat.
- **Sematkan:** tombol pin menyimpan item secara permanen (tersimpan di `clips.json`) dan menaruhnya di atas daftar.
- **Privasi:** riwayat biasa hanya di memori dan hilang saat Alethra ditutup (maksimal 60 item, tiap item maksimal 20.000 karakter). Tidak merekam saat tab aktif adalah tab Incognito, saat perekaman dijeda (tombol jeda), atau bila aplikasi sumber menandai salinannya rahasia (mis. pengelola sandi di Windows). Isi clipboard yang sudah ada saat Alethra dibuka tidak ikut direkam. Hanya teks, gambar tidak direkam.
- **Geser & ukuran:** tarik bilah atas untuk memindahkan, pegangan kanan bawah untuk mengubah ukuran, tombol − untuk memperkecil jadi ikon bulat.
- **Menampilkan/menyembunyikan item:** Pengaturan → Tools → *Riwayat clipboard*. Bila dimatikan, perekaman berhenti dan jendela ditutup.

## Penerjemah melayang
Menu Tools → **Penerjemah melayang** (atau Ctrl+Alt+X) membuka kotak terjemahan kecil di atas halaman, tanpa pindah tab.
- **Pakai:** ketik atau tempel teks (tombol *Tempel* mengambil dari clipboard), hasil muncul otomatis sekitar 0,6 detik setelah berhenti mengetik (Ctrl+Enter untuk langsung). Jika ada teks yang disorot di halaman saat kotak dibuka, teks itu otomatis dimasukkan dan diterjemahkan.
- **Bahasa:** pilih bahasa asal (atau *Deteksi otomatis*, bahasa terdeteksi ditampilkan) dan bahasa tujuan; tombol tukar membalik keduanya dan memindahkan hasil jadi teks asal. Pasangan terakhir diingat (`xlpair`).
- **Hasil:** *Salin* menyalin terjemahan, *Tempel ke halaman* menempelkannya ke kolom yang sedang aktif di tab. Teks maksimal 5.000 karakter.
- **Mesin:** mengikuti Pengaturan → *Terjemahan hasil suara*: Google Translate (online) atau mesin offline (Opus-MT / CTranslate2 / Bergamot / NLLB), dengan cadangan Google Translate bila *mtfb* menyala. Mesin offline memerlukan bahasa asal yang dipilih manual; dengan *Deteksi otomatis* dipakai Google Translate. Baris di bawah hasil menampilkan mesin yang dipakai. Dengan Google Translate, teks yang diterjemahkan dikirim ke server Google.
- **Privasi:** teks yang diketik tidak disimpan; hanya pasangan bahasa terakhir dan posisi/ukuran kotak (`xlbox`).
- **Geser & ukuran:** tarik bilah atas untuk memindahkan; tarik tepi kanan, tepi bawah, atau pojok kanan bawah untuk mengubah ukuran; tombol − memperkecil jadi ikon bulat.
- **Menampilkan/menyembunyikan item:** Pengaturan → Tools → *Penerjemah melayang*.

## AlethPlay
Pemutar musik & video sederhana yang berjalan di **tab sendiri** (`alethra://play`). Buka dari **Tools → AlethPlay** atau **Ctrl+Alt+P**; hanya ada satu tab AlethPlay, memanggilnya lagi akan berpindah ke tab itu.

**Bagian**: *Sedang diputar* (pemutar + antrean), *Musik* dan *Video* (semua berkas di folder yang dipindai, bisa dicari dan diurutkan), *Folder* (telusuri folder; tambah/hapus folder sumber), *Unduhan* (musik/video yang diunduh lewat Alethra), *Playlist*, dan *Riwayat*.

**Tampilan daftar / detail / gambar kecil / gambar**: di pojok kanan atas tiap bagian (Musik, Video, Folder, Unduhan, Playlist, Riwayat) ada empat tombol pilihan tampilan. *Daftar* = baris seperti biasa; *Detail* = tabel dengan kolom Judul, Format, Durasi, Ukuran, dan Tanggal (di layar sempit hanya Judul, Durasi, Ukuran). Di bagian Musik dan Video, kepala kolom Judul/Format/Ukuran/Tanggal bisa diklik untuk mengurutkan (klik lagi membalik arah), dan pilihan urutan di atas daftar ikut berubah. Durasi dibaca dari metadata berkas hanya untuk baris yang terlihat (maksimal 3 sekaligus), lalu disimpan sementara di memori; muncul juga sebagai lencana di pojok kartu pada tampilan gambar dan gambar kecil, dan tidak muncul bila berkas tidak punya durasi atau tidak bisa dibaca; *Gambar kecil* = kartu setengah ukuran *Gambar* (lebih banyak kartu per layar, judul diperkecil dan keterangan kedua disembunyikan); *Gambar* = kartu berukuran besar dengan gambar di atas judul. Pilihan diingat (disimpan di `play.json`).

**Pilih banyak berkas**: tombol *Pilih* di kepala daftar (Musik, Video, Folder, Unduhan, Playlist, Riwayat) mengaktifkan mode pilih. Klik baris untuk mencentang (Shift+klik = satu rentang, Ctrl+A = semua, Esc = keluar). Bilah di bagian bawah menampilkan jumlah terpilih dan aksi: *Putar*, *Putar berikutnya*, *Tambah ke antrean*, *Ke playlist…*, serta *Hapus dari playlist* / *Hapus dari riwayat* di bagian yang sesuai. *Pilih semua* mencakup seluruh hasil yang sedang tampil (termasuk yang belum dibuka lewat “Tampilkan lebih banyak”) dan mengikuti pencarian. Pilihan dibersihkan saat pindah bagian atau setelah aksi dijalankan.

**Ingat posisi**: tiap bagian (Musik, Video, tiap folder, tiap playlist, Unduhan, Riwayat) mengingat posisi scroll dan jumlah baris yang sudah dibuka; Musik dan Video juga mengingat kotak pencarian dan urutan. Saat Anda kembali dari bagian lain atau dari *Sedang diputar*, tampilannya persis seperti ditinggalkan. Mengeklik menu bagian yang sedang terbuka mengembalikan scroll ke atas (pencarian tetap). Ingatan ini hanya di memori dan hilang saat aplikasi ditutup.

Gambar yang dipakai:
- **Musik** → sampul yang tertanam di berkas (MP3/AAC = ID3v2, M4A, FLAC, OGG/OPUS); bila tidak ada, gambar di folder yang sama (`namalagu.jpg`, atau `cover`/`folder`/`front`/`album`/`albumart`/`artwork` `.jpg/.png/.webp`).
- **Video** → gambar di folder yang sama bernama sama (`namavideo.jpg`, `namavideo-poster.jpg`, `namavideo-thumb.jpg`); bila tidak ada, satu bingkai dari video itu sendiri (hanya format/codec yang bisa dibaca Chromium).
- Tidak ada atau tidak didukung → **gambar default AlethPlay**.
Gambar dimuat hanya untuk kartu yang terlihat (dan hanya saat mode gambar aktif), diperkecil ke lebar 320 px, lalu disimpan sementara di memori selama aplikasi berjalan; tidak ada berkas gambar yang ditulis ke disk.

**Pembukaan otomatis** (AlethPlay aktif sendiri saat berkas media dibuka; ada tab AlethPlay → dipakai, belum ada → dibuat):
- klik berkas musik/video di halaman **Unduhan** (tombol Buka atau klik namanya, juga dari panel unduhan)
- klik berkas di bagian **Folder** AlethPlay
- membuka berkas dari Windows: *Buka dengan → Alethra*, atau menjadikan Alethra aplikasi default untuk format itu (installer mendaftarkan MP3, M4A, AAC, WAV, FLAC, OGG, OPUS, MP4, M4V, WEBM, MKV, MOV)
- menyeret berkas media ke jendela Alethra

**Kontrol**: Putar/Jeda, Berikutnya, Sebelumnya, Progress bar (seek), Volume + bisu, Acak, Ulangi (mati / semua / satu lagu), layar penuh dan gambar-dalam-gambar untuk video. **Kecepatan putar** (tombol di sebelah volume, atau `[` lebih lambat · `]` lebih cepat · `\` kembali normal): 0,5× / 0,75× / 1× / 1,25× / 1,5× / 1,75× / 2× (tombol `[` `]` bergerak di antara pilihan itu); nada suara tetap, berlaku untuk musik dan video, dan diingat (`play.json`). Pintasan (saat halaman AlethPlay aktif): Spasi putar/jeda · ←/→ mundur/maju 5 dtk (J/L 10 dtk) · ↑/↓ volume · M bisu · N/P berikutnya/sebelumnya · S acak · R ulangi · F layar penuh. Tombol media keyboard juga bekerja.

**Playlist & riwayat**: menu ⋮ pada tiap baris → *Putar berikutnya*, *Tambah ke antrean*, *Tambah ke playlist…*, *Tampilkan di folder*. Antrean bisa disimpan sebagai playlist. Riwayat menyimpan 200 berkas terakhir. Posisi terakhir video (durasi di atas 30 dtk) diingat; cara memakainya diatur di **Pengaturan → Play → Umum → Video → Lanjutkan video dari posisi terakhir**: *Mati* (bawaan, selalu mulai dari awal), *Otomatis* (langsung lanjut), atau *Tanya dulu* (mulai dari awal dan muncul tombol "Lanjutkan dari 12:34" selama 12 detik). Semua data tersimpan di `%APPDATA%\Alethra\data\play.json` (hanya jalur berkas, bukan isinya).

**Keamanan**: berkas lokal tidak pernah dibuka lewat `file://` (tetap diblokir untuk situs). Berkas hanya bisa dibaca pemutar lewat alamat `alethra://media/<token>/…` dengan token acak per sesi; hanya halaman internal Alethra yang bisa meminta daftar folder, dan hanya format musik/video yang disajikan. Pengambilan bingkai video untuk thumbnail memakai izin CORS khusus yang hanya diberikan ke halaman internal `alethra://`.

**Format**: yang didukung Chromium — MP3, M4A/AAC, WAV, FLAC, OGG/OPUS, MP4/M4V (H.264), WEBM, MKV, MOV (tergantung codec). Format lain (mis. AVI, WMV, HEVC) menampilkan pesan dengan tombol *Buka dengan aplikasi lain*.

**Pengaturan**: Pengaturan → Tools → Suara & video → *AlethPlay* untuk menampilkan/menyembunyikan dari menu Tools. Bila dimatikan, berkas media dibuka dengan aplikasi bawaan Windows seperti sebelumnya.

## Sound Master
Menu Tools → **Sound Master** (atau Ctrl+Alt+M) membuka panel melayang untuk mengatur suara tiap tab, tanpa pindah tab.
- **Volume 0 % – 600 %:** slider dan kotak angka (selangkah 1 %), plus tombol cepat 0/100/200/300/400/600 %. Angka di atas 300 % ditandai merah karena suara mudah pecah.
- **Bass boost:** 0 – 100 % (menaikkan frekuensi rendah sampai +14 dB).
- **Voice boost:** tombol on/off. Memotong gemuruh, menonjolkan rentang suara bicara, dan meratakan dinamika sehingga dialog/podcast yang pelan lebih jelas tanpa ledakan ikut keras.
- **Tab yang berbunyi:** panel mendaftar tab yang sedang mengeluarkan suara (dan tab aktif). Ketuk judul tab untuk **pindah ke tab itu dengan satu klik**. Centang *Semua tab* untuk mengatur juga tab yang belum berbunyi. Tombol *Atur ulang* mengembalikan tab ke 100 % tanpa efek.
- **Cara kerja:** elemen `<audio>`/`<video>` di halaman (termasuk di dalam iframe) diarahkan ke grafik Web Audio. Penguat dilengkapi limiter supaya tidak pecah kasar. Mesin baru dipasang ke sebuah tab setelah pengaturannya diubah; tab yang tidak disentuh tidak dimodifikasi sama sekali. Tab yang sudah dikembalikan ke 100 % tetap lewat grafik (suara tetap normal).
- **AlethPlay:** tab AlethPlay (`alethra://play`) juga bisa diatur dari panel ini (volume, Bass, Voice boost), sama seperti tab situs web. Elemen `<video>` pemutarnya memakai `crossorigin="anonymous"` supaya file lokal (`alethra://media/…`) dianggap aman diarahkan ke grafik Web Audio. Tab halaman internal lain tetap tidak bisa diatur.
- **Batasan:** suara ber-DRM (mis. layanan streaming berbayar), sumber dari server lain tanpa izin CORS, dan suara yang dibuat sendiri oleh situs lewat Web Audio (mis. sebagian game) tidak bisa diatur; panel menampilkan peringatan bila hal ini terdeteksi. Elemen seperti itu sengaja dibiarkan apa adanya supaya suaranya tidak malah senyap.
- **Privasi & penyimpanan:** pengaturan disimpan per tab di memori dan hilang saat tab ditutup; hanya posisi/ukuran panel (`smbox`) yang disimpan. Tidak ada data yang dikirim ke mana pun.
- **Geser & ukuran:** tarik bilah atas untuk memindahkan; pegangan kanan bawah untuk mengubah ukuran; tombol − memperkecil jadi ikon bulat.
- **Menampilkan/menyembunyikan item:** Pengaturan → Tools → *Sound Master* (kategori *Suara & video*).

## Notepad
Menu Tools → **Notepad** (atau Ctrl+Alt+N) membuka catatan melayang di atas halaman, sama seperti Notepad di menu titik tiga Alethra Browser (Android).
- **Melayang:** kotak bisa digeser (tahan dan seret judulnya) dan diubah ukurannya (pegangan di pojok kanan bawah). Posisi dan ukuran diingat. Kotak tetap terbuka saat berpindah tab dan selalu di bawah menu/popup.
- **Perkecil (−):** kotak berubah menjadi ikon kecil yang bisa digeser; klik ikon untuk menampilkan lagi. **Tutup (✕)** menyembunyikan kotak, isinya tetap tersimpan.
- **Banyak lembar kerja:** deretan chip di bawah judul. Klik chip untuk pindah; klik chip yang aktif atau klik kanan = ganti nama; ✕ pada chip = hapus (dikonfirmasi bila ada isinya; menghapus lembar terakhir menggantinya dengan lembar kosong); **+** = lembar baru (nama otomatis *Lembar N*).
- **Draf otomatis:** isi disimpan otomatis tiap berhenti mengetik (file `notes.json` di folder data aplikasi), jadi tidak hilang walau belum menekan Simpan. Status di kaki kotak: *Tersimpan* / *Belum disimpan*.
- **Toolbar:** Buka berkas (txt, md, srt, log, csv, json, maks. 2 MB; pilih *Ganti* atau *Tambahkan* bila catatan sudah ada isinya; nama berkas jadi nama lembar kerja) · Salin (teks terpilih, atau semua bila tidak ada yang dipilih) · Tempel · **Simpan** (Ctrl+S saat kotak aktif).
- **Simpan** menulis berkas `.txt` bernama sesuai lembar kerja ke folder unduhan dan mencatatnya di halaman Unduhan (tidak dicatat bila tab aktif adalah tab penyamaran). Bila *Tanya lokasi simpan setiap unduhan* menyala, muncul dialog simpan.
- **Menampilkan/menyembunyikan item:** Pengaturan → Tools → *Notepad*. Bila dimatikan, kotak yang sedang terbuka ikut ditutup.
