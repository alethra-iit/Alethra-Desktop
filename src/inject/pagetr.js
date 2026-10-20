(function () {
  if (window.__alPT) return;
  var active = false, lang = 'id', seq = 0, inflight = 0;
  var pend = {}, cache = {}, store = [], queue = [], pending = [], tm = null, obs = null;
  var SKIP = { SCRIPT: 1, STYLE: 1, NOSCRIPT: 1, TEXTAREA: 1, CODE: 1, PRE: 1, INPUT: 1, SVG: 1, CANVAS: 1, IFRAME: 1, SELECT: 1 };
  var LET = /[A-Za-z\u00C0-\u024F\u0370-\uFFFF]/;

  function ok(n) {
    var p = n.parentElement;
    if (!p) return false;
    var v = n.nodeValue;
    if (!v || v.length < 2 || v.length > 1000 || !LET.test(v) || n.__alT === v) return false;
    var t = p;
    while (t && t !== document.documentElement) {
      if (SKIP[t.tagName] || t.isContentEditable) return false;
      if (t.getAttribute && t.getAttribute('translate') === 'no') return false;
      if (t.classList && t.classList.contains('notranslate')) return false;
      t = t.parentElement;
    }
    return true;
  }

  function collect(root, out) {
    if (root.nodeType === 3) { if (ok(root)) out.push(root); return out; }
    if (root.nodeType !== 1) return out;
    var w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null), n;
    while ((n = w.nextNode())) if (ok(n)) out.push(n);
    return out;
  }

  function apply(n, original, tr) {
    if (!active || !tr || n.nodeValue !== original) return;
    if (tr.trim() === original.trim()) { n.__alT = original; return; }
    var lead = original.match(/^\s*/)[0], trail = original.match(/\s*$/)[0];
    var nv = lead + tr + trail;
    store.push([n, original]);
    n.__alT = nv;
    n.nodeValue = nv;
  }

  function enqueue(nodes) {
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i], t = n.nodeValue, k = t.trim();
      if (cache[k] !== undefined) { apply(n, t, cache[k]); continue; }
      queue.push({ n: n, t: t, k: k });
    }
  }

  function pump() {
    while (active && inflight < 3 && queue.length) {
      var items = [], texts = [], chars = 0;
      while (queue.length && items.length < 30 && chars < 2500) {
        var it = queue.shift();
        if (it.n.nodeValue !== it.t) continue;
        items.push(it); texts.push(it.k); chars += it.k.length;
      }
      if (!items.length) continue;
      var id = ++seq;
      inflight++;
      pend[id] = { items: items, to: setTimeout((function (i) {
        return function () { if (pend[i]) { delete pend[i]; inflight--; pump(); } };
      })(id), 20000) };
      try { AlethraTr.translateBatch(id, JSON.stringify(texts), lang); }
      catch (e) { clearTimeout(pend[id].to); delete pend[id]; inflight--; }
    }
  }

  window.__alTrB = function (id, resStr) {
    var p = pend[id];
    if (!p) return;
    clearTimeout(p.to); delete pend[id]; inflight--;
    var r = [];
    try { r = JSON.parse(resStr) || []; } catch (e) {}
    for (var i = 0; i < p.items.length; i++) {
      var it = p.items[i], tr = r[i];
      if (tr) { cache[it.k] = tr; apply(it.n, it.t, tr); }
    }
    pump();
  };

  function flush() {
    tm = null;
    if (!active) return;
    var list = pending; pending = [];
    var out = [];
    for (var i = 0; i < list.length; i++) collect(list[i], out);
    enqueue(out);
    pump();
  }

  function stop() {
    active = false;
    if (obs) { obs.disconnect(); obs = null; }
    for (var i = 0; i < store.length; i++) {
      var n = store[i][0];
      try { if (n.nodeValue === n.__alT) n.nodeValue = store[i][1]; } catch (e) {}
      n.__alT = undefined;
    }
    store = []; queue = []; pending = [];
  }

  function start(l) {
    if (active && l !== lang) stop();
    lang = l;
    if (!document.body) return;
    if (!active) {
      active = true;
      obs = new MutationObserver(function (ms) {
        if (!active) return;
        for (var i = 0; i < ms.length; i++) {
          var m = ms[i];
          if (m.type === 'characterData') pending.push(m.target);
          else for (var k = 0; k < m.addedNodes.length; k++) pending.push(m.addedNodes[k]);
        }
        if (pending.length && !tm) tm = setTimeout(flush, 700);
      });
      obs.observe(document.body, { childList: true, subtree: true, characterData: true });
    }
    pending.push(document.body);
    flush();
  }

  window.__alPT = { start: start, stop: stop };
})();
