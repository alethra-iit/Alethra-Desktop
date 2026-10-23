// Pembaruan otomatis lewat GitHub Releases.
//  - Installer (NSIS): electron-updater mengecek latest.yml di rilis terbaru, mengunduh di latar (diff bila bisa), dan memasang saat
//    Alethra ditutup atau saat pengguna menekan "Mulai ulang & pasang".
//  - Portable: tidak bisa memasang sendiri, jadi hanya mengecek rilis terbaru lalu membuka halamannya.
//  - Dijalankan dari `npm start` (belum dipaketkan): tidak aktif.
// Alamat repo diisi saat build lewat `--config.extraMetadata.alethraRepo=pemilik/nama` (lihat .github/workflows/build.yml).
const { app, net, shell } = require('electron');
const fs = require('fs'), path = require('path');
const ctx = require('./ctx');
const SV = require('./services');

const portable = () => !!process.env.PORTABLE_EXECUTABLE_FILE;
const modeNow = () => !app.isPackaged ? 'dev' : portable() ? 'manual' : 'auto';
const S = { state: 'idle', mode: '', version: '', newVersion: '', pct: 0, err: '', url: '', notes: '', last: 0 };
let au = null, busy = false, timer = null;

const verNum = (v) => String(v || '0').replace(/^v/i, '').split(/[-+]/)[0].split('.').map(x => parseInt(x, 10) || 0);
const cmp = (a, b) => { const x = verNum(a), y = verNum(b); for (let i = 0; i < Math.max(x.length, y.length); i++) { const d = (x[i] || 0) - (y[i] || 0); if (d) return d; } return 0; };
const plain = (t) => String(t || '').replace(/<[^>]*>/g, ' ').replace(/\s+\n/g, '\n').replace(/[ \t]+/g, ' ').trim().slice(0, 1200);

function repo() {
  try { const r = require('../../package.json').alethraRepo; if (/^[\w.-]+\/[\w.-]+$/.test(r || '')) return r; } catch {}
  try {
    const y = fs.readFileSync(path.join(process.resourcesPath, 'app-update.yml'), 'utf8'), o = /owner:\s*(\S+)/.exec(y), n = /repo:\s*(\S+)/.exec(y);
    if (o && n) return o[1] + '/' + n[1];
  } catch {}
  return '';
}
const info = () => Object.assign({}, S, { auto: SV.setting('upauto') !== false, repo: repo() });
function push() { try { ctx.broadcastPages && ctx.broadcastPages('up', info()); } catch {} }
function set(p) { Object.assign(S, p); push(); }
function nice(e) {
  const m = String((e && e.message) || e || '');
  if (/app-update\.yml/i.test(m)) return 'Build ini tidak membawa informasi pembaruan (dibuat tanpa pengaturan publish GitHub).';
  if (/404|Cannot find latest|latest\.yml/i.test(m)) return 'Belum ada rilis dengan berkas pembaruan (latest.yml) di GitHub.';
  if (/ENOTFOUND|ETIMEDOUT|ECONNRESET|ERR_INTERNET|ERR_NAME|net::|getaddrinfo|socket hang up|ECONNREFUSED/i.test(m)) return 'Tidak bisa menghubungi GitHub. Periksa koneksi internet.';
  if (/rate limit|403/i.test(m)) return 'GitHub membatasi permintaan sementara (HTTP 403). Coba lagi nanti.';
  return m.split('\n')[0].slice(0, 220) || 'Kesalahan tidak diketahui';
}
const fail = (e) => set({ state: 'error', err: nice(e), pct: 0 });

function getAu() { if (!au) bind(require('electron-updater').autoUpdater); return au; }
function bind(a) {
  au = a;
  au.autoDownload = false;               // diunduh lewat download(), supaya hormat pengaturan "otomatis"
  au.autoInstallOnAppQuit = true;
  au.allowPrerelease = false;
  au.logger = null;
  au.on('checking-for-update', () => set({ state: 'checking', err: '' }));
  au.on('update-not-available', () => set({ state: 'none', err: '', newVersion: '', last: Date.now() }));
  au.on('update-available', (i) => {
    const n = i && i.releaseNotes, notes = Array.isArray(n) ? n.map(x => x && x.note || '').join('\n') : n;
    set({ state: 'available', newVersion: String((i && i.version) || ''), notes: plain(notes), err: '', pct: 0, last: Date.now() });
    if (SV.setting('upauto') !== false) download();
  });
  au.on('download-progress', (p) => set({ state: 'downloading', pct: Math.max(0, Math.min(100, Math.round((p && p.percent) || 0))) }));
  au.on('update-downloaded', (i) => { set({ state: 'ready', pct: 100, newVersion: String((i && i.version) || S.newVersion) }); try { ctx.toast && ctx.toast('Pembaruan ' + S.newVersion + ' siap. Dipasang saat Alethra ditutup, atau buka Pengaturan > Tentang'); } catch {} });
  au.on('error', (e) => { if (S.state === 'checking' || S.state === 'downloading') fail(e); });
}

async function manualCheck() {
  const r = repo(); if (!r) throw new Error('Alamat repo GitHub tidak diketahui (build ini tidak membawa alethraRepo)');
  const res = await net.fetch(`https://api.github.com/repos/${r}/releases/latest`, { headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'Alethra' } });
  if (res.status === 404) return set({ state: 'none', newVersion: '', err: '', last: Date.now() });
  if (!res.ok) throw new Error('GitHub HTTP ' + res.status);
  const j = await res.json(), v = String(j.tag_name || '').replace(/^v/i, '');
  if (v && cmp(v, app.getVersion()) > 0) set({ state: 'available', newVersion: v, url: String(j.html_url || `https://github.com/${r}/releases/latest`), notes: plain(j.body), err: '', last: Date.now() });
  else set({ state: 'none', newVersion: '', err: '', last: Date.now() });
}

async function check() {
  if (busy || S.state === 'downloading' || S.state === 'ready') return info();
  const m = modeNow(); S.mode = m; S.version = app.getVersion();
  if (m === 'dev') { set({ state: 'unsupported', err: 'Pembaruan hanya tersedia di versi terpasang (bukan saat npm start).' }); return info(); }
  busy = true; set({ state: 'checking', err: '' });
  try {
    if (m === 'auto') await getAu().checkForUpdates();       // hasilnya datang lewat event
    else await manualCheck();
  } catch (e) { fail(e); }
  finally { busy = false; S.last = Date.now(); push(); }
  return info();
}

function download() {
  if (S.state !== 'available') return false;
  if (S.mode === 'manual') { if (/^https:\/\/github\.com\//.test(S.url)) shell.openExternal(S.url); return true; }
  set({ state: 'downloading', pct: 0, err: '' });
  getAu().downloadUpdate().catch(fail);
  return true;
}
function install() {
  if (S.state !== 'ready' || S.mode !== 'auto') return false;
  setImmediate(() => { try { getAu().quitAndInstall(false, true); } catch (e) { fail(e); } });
  return true;
}
function openReleases() { const r = repo(); if (r) shell.openExternal(`https://github.com/${r}/releases`); return !!r; }

// cek 20 detik setelah dibuka, lalu tiap 6 jam, bila "Periksa pembaruan otomatis" menyala
function init() {
  S.version = app.getVersion(); S.mode = modeNow();
  if (S.mode === 'dev') return;
  const run = () => { if (SV.setting('upauto') !== false) check(); };
  setTimeout(run, 20000);
  timer = setInterval(run, 6 * 3600e3); if (timer.unref) timer.unref();
}

module.exports = { init, check, download, install, openReleases, state: () => { S.version = app.getVersion(); S.mode = S.mode || modeNow(); return info(); }, _test: { cmp, S, setAu: (x) => bind(x), repo } };
