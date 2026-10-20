const ENGINES = {
  google: { n: 'Google', u: 'https://www.google.com/search?q=' },
  bing: { n: 'Bing', u: 'https://www.bing.com/search?q=' },
  ddg: { n: 'DuckDuckGo', u: 'https://duckduckgo.com/?q=' }
};
const DOH = {
  off: ['Mati', ''], cloudflare: ['Cloudflare', 'https://cloudflare-dns.com/dns-query'],
  cfsec: ['Cloudflare Keamanan', 'https://security.cloudflare-dns.com/dns-query'],
  adguard: ['AdGuard', 'https://dns.adguard-dns.com/dns-query'],
  quad9: ['Quad9', 'https://dns.quad9.net/dns-query'],
  google: ['Google', 'https://dns.google/dns-query'], custom: ['Kustom', '']
};
const TR_LANGS = {
  id: 'Indonesia', en: 'Inggris', ja: 'Jepang', ko: 'Korea', 'zh-CN': 'Mandarin', es: 'Spanyol', ar: 'Arab', hi: 'Hindi',
  'zh-TW': 'Mandarin (Tradisional)', fr: 'Prancis', de: 'Jerman', pt: 'Portugis', ru: 'Rusia', it: 'Italia', nl: 'Belanda',
  tr: 'Turki', th: 'Thai', vi: 'Vietnam', ms: 'Melayu', jv: 'Jawa', su: 'Sunda', tl: 'Filipino', bn: 'Bengali', ur: 'Urdu',
  ta: 'Tamil', fa: 'Persia', he: 'Ibrani', pl: 'Polandia', uk: 'Ukraina', el: 'Yunani', sv: 'Swedia', ro: 'Rumania',
  cs: 'Ceko', hu: 'Hungaria', da: 'Denmark', fi: 'Finlandia', no: 'Norwegia', sw: 'Swahili'
};
const AD_DOMAINS = ["doubleclick.net","googlesyndication.com","googleadservices.com","adservice.google.com","adnxs.com","adsrvr.org","advertising.com","taboola.com","outbrain.com","criteo.com","criteo.net","rubiconproject.com","pubmatic.com","openx.net","casalemedia.com","indexww.com","smartadserver.com","adform.net","adcolony.com","applovin.com","moatads.com","amazon-adsystem.com","media.net","revcontent.com","mgid.com","popads.net","popcash.net","propellerads.com","exoclick.com","juicyads.com","trafficjunky.net","adsterra.com","hilltopads.net","clickadu.com","onclickads.net","admaven.com","ero-advertising.com","yllix.com","zedo.com","yieldmo.com","sharethrough.com","teads.tv","33across.com","bidswitch.net","contextweb.com","lijit.com","sovrn.com","adsafeprotected.com","serving-sys.com","mathtag.com","adition.com","inmobi.com","vungle.com","chartboost.com","adcash.com","richads.com","a-ads.com","adsco.re","bidgear.com","ads.yahoo.com","adtech.com","adtechus.com","everesttech.net","tribalfusion.com","undertone.com","spotxchange.com","spotx.tv","connatix.com","kargo.com","triplelift.com","gumgum.com","nativo.com","adblade.com","adroll.com","quantserve.com","scorecardresearch.com"];
const YT_AD_HOSTS = ["googleads.g.doubleclick.net","ad.doubleclick.net","static.doubleclick.net","securepubads.g.doubleclick.net","pagead2.googlesyndication.com","tpc.googlesyndication.com","www.googleadservices.com","ade.googlesyndication.com"];

const SLD = new Set(['co', 'com', 'net', 'org', 'gov', 'ac', 'edu', 'or', 'go', 'web', 'my', 'sch', 'mil']);
function hostOf(u) { try { return new URL(u).hostname.toLowerCase(); } catch { return null; } }
function siteOf(h) {
  if (!h) return '';
  if (/^[\d.]+$/.test(h) || h.includes(':')) return h;
  const p = h.split('.');
  if (p.length <= 2) return h;
  const n = (p[p.length - 1].length === 2 && SLD.has(p[p.length - 2])) ? 3 : 2;
  return p.slice(-n).join('.');
}
function matchDomain(host, list) { return list.some(d => host === d || host.endsWith('.' + d)); }

function toUrl(input, engineUrl, httpsFirst) {
  const s = String(input || '').trim();
  if (!s) return '';
  if (/^(https?|alethra|file|about|view-source):/i.test(s)) return s;
  if (/^(localhost|\d{1,3}(\.\d{1,3}){3}|\[[0-9a-f:]+\])(:\d+)?([/?#].*)?$/i.test(s)) return 'http://' + s;
  if (!/\s/.test(s) && /^[^\s/?#]+\.[a-z]{2,}(:\d+)?([/?#].*)?$/i.test(s)) return (httpsFirst === false ? 'http://' : 'https://') + s;
  return engineUrl + encodeURIComponent(s);
}
function prettyUrl(u) {
  if (!u) return '';
  return u.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '');
}
function esc(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
module.exports = { ENGINES, DOH, TR_LANGS, AD_DOMAINS, YT_AD_HOSTS, hostOf, siteOf, matchDomain, toUrl, prettyUrl, esc };
