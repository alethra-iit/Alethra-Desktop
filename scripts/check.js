// Pemeriksaan sintaks cepat sebelum build (gagal lebih awal bila ada salah ketik).
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
let bad = 0;
(function walk(d) {
  for (const f of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, f.name);
    if (f.isDirectory()) walk(p);
    else if (p.endsWith('.js')) {
      try { execFileSync(process.execPath, ['--check', p], { stdio: 'pipe' }); }
      catch (e) { bad++; console.error('SINTAKS SALAH:', p, '\n', String(e.stderr || e)); }
    }
  }
})(path.join(__dirname, '..', 'src'));
if (bad) process.exit(1);
console.log('Sintaks OK');
