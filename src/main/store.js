const fs = require('fs'), path = require('path');
class Store {
  constructor(dir, name, def) {
    this.file = path.join(dir, name); this.def = def; this.t = null;
    try { this.data = Object.assign(Array.isArray(def) ? [] : {}, JSON.parse(fs.readFileSync(this.file, 'utf8'))); }
    catch { this.data = JSON.parse(JSON.stringify(def)); }
    if (Array.isArray(def)) { try { const a = JSON.parse(fs.readFileSync(this.file, 'utf8')); this.data = Array.isArray(a) ? a : []; } catch { this.data = []; } }
  }
  save() { clearTimeout(this.t); this.t = setTimeout(() => this.flush(), 300); }
  flush() {
    clearTimeout(this.t);
    try { fs.mkdirSync(path.dirname(this.file), { recursive: true }); fs.writeFileSync(this.file + '.tmp', JSON.stringify(this.data)); fs.renameSync(this.file + '.tmp', this.file); } catch (e) { console.error('store', e.message); }
  }
}
module.exports = Store;
