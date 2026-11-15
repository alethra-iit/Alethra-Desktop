/* AlethPlay — pengambil gambar sampul tanpa dependensi.
   Musik : gambar tertanam di tag (MP3/AAC = ID3v2, M4A = MP4 'covr', FLAC = PICTURE, OGG/OPUS = METADATA_BLOCK_PICTURE),
           lalu gambar di folder yang sama (nama sama dengan lagu, atau cover/folder/front/album/artwork…).
   Video : gambar di folder yang sama dengan nama sama (lagu.jpg, lagu-poster.jpg, lagu-thumb.jpg).
   Frame video diambil di sisi halaman (play.js) lewat elemen <video>, bukan di sini.
   Semua fungsi mengembalikan { mime, data: Buffer } atau null; kesalahan baca apa pun = null (tidak pernah melempar). */
const fs = require('fs'), path = require('path');

const MAXTAG = 24 * 1024 * 1024;   // batas tag/moov yang dibaca
const MAXIMG = 12 * 1024 * 1024;   // batas gambar di folder
const IMG_EXT = ['.jpg', '.jpeg', '.png', '.webp', '.bmp', '.gif'];
const COVER_NAMES = ['cover', 'folder', 'front', 'album', 'albumart', 'albumartsmall', 'artwork', 'thumb'];

/* jenis gambar ditentukan dari isinya, bukan dari label di tag (sering salah) */
function sniff(b) {
  if (!b || b.length < 12) return '';
  if (b[0] === 0xFF && b[1] === 0xD8) return 'image/jpeg';
  if (b.readUInt32BE(0) === 0x89504E47) return 'image/png';
  if (b.toString('latin1', 0, 4) === 'RIFF' && b.toString('latin1', 8, 12) === 'WEBP') return 'image/webp';
  if (b.toString('latin1', 0, 3) === 'GIF') return 'image/gif';
  if (b[0] === 0x42 && b[1] === 0x4D) return 'image/bmp';
  return '';
}
const img = (buf) => { const mime = sniff(buf); return mime ? { mime, data: buf } : null; };

async function readAt(fd, pos, len) {
  const b = Buffer.alloc(len), { bytesRead } = await fd.read(b, 0, len, pos);
  return bytesRead === len ? b : b.subarray(0, bytesRead);
}
const synchsafe = (b, o) => ((b[o] & 0x7f) << 21) | ((b[o + 1] & 0x7f) << 14) | ((b[o + 2] & 0x7f) << 7) | (b[o + 3] & 0x7f);

/* ---------- ID3v2 (MP3, AAC) ---------- */
function deUnsync(b) {
  const o = Buffer.allocUnsafe(b.length); let n = 0;
  for (let i = 0; i < b.length; i++) { o[n++] = b[i]; if (b[i] === 0xFF && b[i + 1] === 0x00) i++; }
  return o.subarray(0, n);
}
function skipTerm(b, o, enc) {   // lewati teks berakhiran nol (UTF-16 = nol ganda)
  if (enc === 1 || enc === 2) { while (o + 1 < b.length && !(b[o] === 0 && b[o + 1] === 0)) o += 2; return o + 2; }
  while (o < b.length && b[o] !== 0) o++;
  return o + 1;
}
function apic(f, v22) {
  const enc = f[0]; let o = 1;
  if (v22) o += 3; else { while (o < f.length && f[o] !== 0) o++; o++; }   // format gambar / MIME
  const type = f[o++]; o = skipTerm(f, o, enc);
  return { type, data: f.subarray(o) };
}
async function fromID3(fd) {
  const h = await readAt(fd, 0, 10);
  if (h.length < 10 || h.toString('latin1', 0, 3) !== 'ID3') return null;
  const ver = h[3], fl = h[5], size = synchsafe(h, 6);
  if (ver < 2 || ver > 4 || !size || size > MAXTAG) return null;
  let body = await readAt(fd, 10, size);
  if ((fl & 0x80) && ver < 4) body = deUnsync(body);
  let o = 0;
  if (fl & 0x40) { if (ver === 3) o = 4 + body.readUInt32BE(0); else if (ver === 4) o = synchsafe(body, 0); }
  const idLen = ver === 2 ? 3 : 4, hdr = ver === 2 ? 6 : 10; let best = null;
  while (o + hdr <= body.length) {
    if (body[o] === 0) break;   // padding
    const id = body.toString('latin1', o, o + idLen);
    const sz = ver === 2 ? (body[o + 3] << 16) | (body[o + 4] << 8) | body[o + 5] : ver === 3 ? body.readUInt32BE(o + 4) : synchsafe(body, o + 4);
    const f2 = ver === 2 ? 0 : body[o + 9], s = o + hdr, e = s + sz;
    if (sz <= 0 || e > body.length) break;
    if (id === 'APIC' || id === 'PIC') {
      let fr = body.subarray(s, e), skip = false;
      if (ver === 3) { if (f2 & 0xC0) skip = true; else if (f2 & 0x20) fr = fr.subarray(1); }
      else if (ver === 4) { if (f2 & 0x0C) skip = true; else { if (f2 & 0x40) fr = fr.subarray(1); if (f2 & 0x01) fr = fr.subarray(4); if (f2 & 0x02) fr = deUnsync(fr); } }
      if (!skip) {
        const p = apic(fr, ver === 2), im = img(p.data);
        if (im) { if (p.type === 3) return im; if (!best) best = im; }   // 3 = sampul depan
      }
    }
    o = e;
  }
  return best;
}

/* ---------- FLAC (+ struktur PICTURE yang sama dipakai Ogg) ---------- */
function parsePic(b) {
  try {
    let o = 0; const type = b.readUInt32BE(o); o += 4;
    o += 4 + b.readUInt32BE(o);        // MIME
    o += 4 + b.readUInt32BE(o);        // deskripsi
    o += 16;                           // lebar, tinggi, kedalaman, jumlah warna
    const n = b.readUInt32BE(o); o += 4;
    return { type, data: b.subarray(o, o + n) };
  } catch { return null; }
}
async function fromFlac(fd) {
  let pos = 0; const h = await readAt(fd, 0, 10);
  if (h.toString('latin1', 0, 3) === 'ID3') pos = 10 + synchsafe(h, 6);   // sebagian file FLAC diawali tag ID3
  if ((await readAt(fd, pos, 4)).toString('latin1') !== 'fLaC') return null;
  pos += 4; let best = null;
  for (let n = 0; n < 64; n++) {
    const bh = await readAt(fd, pos, 4); if (bh.length < 4) break;
    const last = bh[0] & 0x80, type = bh[0] & 0x7f, len = (bh[1] << 16) | (bh[2] << 8) | bh[3]; pos += 4;
    if (type === 6 && len > 0 && len < MAXTAG) {
      const p = parsePic(await readAt(fd, pos, len)), im = p && img(p.data);
      if (im) { if (p.type === 3) return im; if (!best) best = im; }
    }
    pos += len; if (last) break;
  }
  return best;
}

/* ---------- Ogg (Vorbis / Opus) ---------- */
async function fromOgg(fd) {
  const size = (await fd.stat()).size, buf = await readAt(fd, 0, Math.min(size, MAXTAG));
  let o = 0, serial = null, cur = []; const packets = [];
  while (o + 27 <= buf.length && packets.length < 2 && buf.toString('latin1', o, o + 4) === 'OggS') {
    const nseg = buf[o + 26], ser = buf.readUInt32LE(o + 14);
    let p = o + 27 + nseg;
    if (serial === null) serial = ser;
    for (let i = 0; i < nseg; i++) {
      const l = buf[o + 27 + i];
      if (ser === serial) { cur.push(buf.subarray(p, p + l)); if (l < 255) { packets.push(Buffer.concat(cur)); cur = []; } }
      p += l;
    }
    o = p;
  }
  const c = packets[1]; if (!c) return null;   // paket 0 = header ID, paket 1 = komentar
  let q = c.toString('latin1', 0, 8) === 'OpusTags' ? 8 : (c[0] === 3 && c.toString('latin1', 1, 7) === 'vorbis' ? 7 : -1);
  if (q < 0) return null;
  q += 4 + c.readUInt32LE(q);                  // vendor
  const cnt = c.readUInt32LE(q); q += 4; let best = null;
  for (let i = 0; i < cnt && q + 4 <= c.length; i++) {
    const l = c.readUInt32LE(q); q += 4;
    const key = c.toString('latin1', q, q + 23).toUpperCase();
    if (key === 'METADATA_BLOCK_PICTURE=') {
      const p = parsePic(Buffer.from(c.toString('latin1', q + 23, q + l), 'base64')), im = p && img(p.data);
      if (im) { if (p.type === 3) return im; if (!best) best = im; }
    } else if (!best && key.startsWith('COVERART=')) {
      best = img(Buffer.from(c.toString('latin1', q + 9, q + l), 'base64'));
    }
    q += l;
  }
  return best;
}

/* ---------- MP4 / M4A ---------- */
function boxes(b, s, e) {
  const out = [];
  while (s + 8 <= e) {
    let sz = b.readUInt32BE(s), hl = 8; const t = b.toString('latin1', s + 4, s + 8);
    if (sz === 1) { sz = Number(b.readBigUInt64BE(s + 8)); hl = 16; } else if (sz === 0) sz = e - s;
    if (sz < hl || s + sz > e) break;
    out.push({ t, s: s + hl, e: s + sz }); s += sz;
  }
  return out;
}
const boxOf = (a, t) => a.find(x => x.t === t);
function mp4Covr(b) {
  const udta = boxOf(boxes(b, 0, b.length), 'udta'); if (!udta) return null;
  const meta = boxOf(boxes(b, udta.s, udta.e), 'meta'); if (!meta) return null;
  const ilst = boxOf(boxes(b, meta.s + 4, meta.e), 'ilst') || boxOf(boxes(b, meta.s, meta.e), 'ilst'); if (!ilst) return null;   // meta biasa punya 4 byte versi
  const covr = boxOf(boxes(b, ilst.s, ilst.e), 'covr'); if (!covr) return null;
  for (const d of boxes(b, covr.s, covr.e)) if (d.t === 'data') { const r = img(b.subarray(d.s + 8, d.e)); if (r) return r; }
  return null;
}
async function fromMp4(fd) {
  const size = (await fd.stat()).size; let pos = 0;
  while (pos + 8 <= size) {
    const h = await readAt(fd, pos, 16); if (h.length < 8) break;
    let sz = h.readUInt32BE(0), hl = 8; const t = h.toString('latin1', 4, 8);
    if (sz === 1 && h.length >= 16) { sz = Number(h.readBigUInt64BE(8)); hl = 16; } else if (sz === 0) sz = size - pos;
    if (sz < hl) break;
    if (t === 'moov') { if (sz > MAXTAG) return null; return mp4Covr(await readAt(fd, pos + hl, sz - hl)); }
    pos += sz;
  }
  return null;
}

/* ---------- gambar di folder yang sama ---------- */
const dirCache = new Map();
async function listDir(dir) {
  const c = dirCache.get(dir); if (c && Date.now() - c.t < 30000) return c.names;
  let names = []; try { names = await fs.promises.readdir(dir); } catch {}
  dirCache.set(dir, { t: Date.now(), names });
  if (dirCache.size > 200) dirCache.delete(dirCache.keys().next().value);
  return names;
}
async function sidecar(file, kind) {
  const names = await listDir(path.dirname(file)), base = path.basename(file, path.extname(file)).toLowerCase();
  const pick = (ok) => names.find(n => { const e = path.extname(n).toLowerCase(); return IMG_EXT.includes(e) && ok(path.basename(n, e).toLowerCase()); });
  let n = pick(b => b === base);
  if (!n && kind === 'v') n = pick(b => b === base + '-poster' || b === base + '-thumb' || b === base + '-thumbnail');
  if (!n && kind === 'a') for (const w of COVER_NAMES) { n = pick(b => b === w); if (n) break; }
  if (!n) return null;
  const f = path.join(path.dirname(file), n);
  try { if ((await fs.promises.stat(f)).size > MAXIMG) return null; return img(await fs.promises.readFile(f)); } catch { return null; }
}

async function find(file, kind) {
  const ext = path.extname(file).toLowerCase(); let fd, r = null;
  if (kind === 'a') {
    try {
      fd = await fs.promises.open(file, 'r');
      if (ext === '.mp3' || ext === '.aac') r = await fromID3(fd);
      else if (ext === '.flac') r = await fromFlac(fd);
      else if (ext === '.ogg' || ext === '.oga' || ext === '.opus') r = await fromOgg(fd);
      else if (ext === '.m4a') r = await fromMp4(fd);
    } catch { r = null; } finally { if (fd) await fd.close().catch(() => {}); }
  }
  return r || (await sidecar(file, kind).catch(() => null));
}

module.exports = { find };
