(function () {
  if (window.__alAd) return;
  if (!/(^|\.)youtube\.com$/.test(location.hostname)) return;
  window.__alAd = 1;

  var KEYS = ['adPlacements', 'playerAds', 'adSlots', 'adBreakHeartbeatParams'];
  function strip(o) {
    if (!o || typeof o !== 'object') return o;
    for (var i = 0; i < KEYS.length; i++) if (KEYS[i] in o) { try { delete o[KEYS[i]]; } catch (e) {} }
    if (o.playerResponse) strip(o.playerResponse);
    if (o.response && o.response.playerResponse) strip(o.response.playerResponse);
    return o;
  }

  // Buang data iklan dari respons pemutar sebelum dipakai YouTube
  try {
    var jp = JSON.parse;
    JSON.parse = function () {
      var r = jp.apply(this, arguments);
      try { if (r && typeof r === 'object' && (r.adPlacements || r.playerAds || r.adSlots || r.playerResponse)) strip(r); } catch (e) {}
      return r;
    };
  } catch (e) {}
  try {
    var rj = Response.prototype.json;
    Response.prototype.json = function () {
      return rj.apply(this, arguments).then(function (r) { try { strip(r); } catch (e) {} return r; });
    };
  } catch (e) {}
  try {
    var ipr = window.ytInitialPlayerResponse;
    Object.defineProperty(window, 'ytInitialPlayerResponse', {
      configurable: true,
      get: function () { return ipr; },
      set: function (v) { try { strip(v); } catch (e) {} ipr = v; }
    });
  } catch (e) {}

  // Sembunyikan slot iklan di halaman
  var css = [
    'ytd-ad-slot-renderer', 'ytd-in-feed-ad-layout-renderer', 'ytd-banner-promo-renderer',
    'ytd-statement-banner-renderer', 'ytd-promoted-sparkles-web-renderer', 'ytd-display-ad-renderer',
    'ytd-companion-slot-renderer', 'ytd-player-legacy-desktop-watch-ads-renderer', 'ytd-action-companion-ad-renderer',
    '#player-ads', '#masthead-ad', '.ytp-ad-overlay-container', '.ytp-ad-overlay-slot', '.ytp-ad-image-overlay',
    'ytm-promoted-sparkles-web-renderer', 'ytm-promoted-video-renderer', 'ytm-companion-ad-renderer',
    'ytm-statement-banner-renderer', 'ytm-ad-slot-renderer', 'ytm-in-feed-ad-layout-renderer',
    'ytm-display-ad-renderer', 'ad-slot-renderer', '.ytp-ad-text-overlay'
  ].join(',') + '{display:none!important}';
  function addCss() {
    if (document.getElementById('__alads')) return;
    var s = document.createElement('style');
    s.id = '__alads'; s.textContent = css;
    (document.head || document.documentElement).appendChild(s);
  }
  addCss();
  document.addEventListener('DOMContentLoaded', addCss);

  // Cadangan: kalau iklan video tetap muncul, lewati langsung
  var was = null;
  setInterval(function () {
    if (window.__alMini) return;
    var p = document.querySelector('.html5-video-player');
    var v = document.querySelector('video.html5-main-video') || document.querySelector('video');
    var ad = p && p.classList.contains('ad-showing');
    if (!ad) {
      if (was !== null && v) { v.muted = was; }
      was = null;
      return;
    }
    if (v) {
      if (was === null) was = v.muted;
      v.muted = true;
      if (isFinite(v.duration) && v.duration > 0) { try { v.currentTime = v.duration; } catch (e) {} }
      try { v.playbackRate = 16; } catch (e) {}
    }
    var b = document.querySelector('.ytp-skip-ad-button,.ytp-ad-skip-button,.ytp-ad-skip-button-modern,.ytp-ad-skip-button-container button');
    if (b) b.click();
  }, 250);
})();
