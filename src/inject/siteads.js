(function () {
  if (window.__alSad) return;
  var p = location.protocol;
  if (p !== 'http:' && p !== 'https:') return;
  var h = location.hostname, off = window.__alOff || [], i;
  for (i = 0; i < off.length; i++) if (h === off[i] || h.endsWith('.' + off[i])) return;
  window.__alSad = 1;

  var css = [
    'ins.adsbygoogle', '.adsbygoogle', '[id^="google_ads_"]', '[id^="div-gpt-ad"]', '[id^="gpt-ad"]', '[class^="gpt-ad"]',
    'iframe[src*="doubleclick.net"]', 'iframe[src*="googlesyndication.com"]', 'iframe[src*="adnxs.com"]',
    'iframe[id^="google_ads_iframe"]', '[data-ad-slot]', '[data-ad-client]', '[data-google-query-id]',
    '.ad-slot', '.ad-container', '.ad-wrapper', '.ad-banner', '.ad-box', '.ad-unit', '.adunit', '.advert',
    '.advertisement', '.ads-container', '.ads-wrapper', '.ads-banner', '.banner-ads', '.sponsored-ad',
    '.google-ad', '.google-ads', '.adbox', '.adsbox', '.ad_container', '.ad_wrapper', '.ad_banner',
    '[id*="taboola"]', '[class*="taboola"]', '[id^="outbrain"]', '.OUTBRAIN', '.trc_rbox_container',
    '[class*="popup-ad"]', '[aria-label="Advertisement"]', '[aria-label="Iklan"]',
    '#ad', '#ads', '#ad-container', '#ad_container', '#adContainer', '#adBanner', '#ad-banner',
    '#top-ad', '#bottom-ad', '#sidebar-ad', '#banner-ad', '#header-ad', '#footer-ad'
  ].join(',') + '{display:none!important;height:0!important;min-height:0!important;margin:0!important;padding:0!important}';

  function add() {
    if (document.getElementById('__alsad')) return;
    var s = document.createElement('style');
    s.id = '__alsad';
    s.textContent = css;
    (document.head || document.documentElement).appendChild(s);
  }
  add();
  document.addEventListener('DOMContentLoaded', add);
})();
