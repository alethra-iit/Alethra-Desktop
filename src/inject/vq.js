(function(){
var W=window,D=document,S={r:null,pick:null,close:null,gen:0,btn:null,els:null};
function vid(){return D.querySelector('video.__alv')||D.querySelector('video')}
function T(e){return((e&&e.textContent)||'').replace(/\s+/g,' ').trim()}
function clk(e){try{e.click()}catch(x){}}
function vis(e){try{return e.getClientRects().length>0}catch(x){return false}}
function H(h){return h+'p'}
function curH(){var v=vid();return v?Math.min(v.videoWidth||0,v.videoHeight||0):0}
function done(items,pick,close){S.r=JSON.stringify({items:items});S.pick=pick;S.close=close||null}
function none(){S.r=JSON.stringify({items:[]});S.pick=null;S.close=null}
function sortDesc(idx,get){idx.sort(function(a,b){return(get(b)||0)-(get(a)||0)});return idx}
function range(n){var a=[],i;for(i=0;i<n;i++)a.push(i);return a}

/* ===== Adapter sinkron: API player yang dikenal ===== */
function yt(){
  var p=D.getElementById('movie_player')||D.querySelector('.html5-video-player');
  if(!p||!p.getAvailableQualityLevels)return null;
  var M={highres:2160,hd2160:2160,hd1440:1440,hd1080:1080,hd720:720,large:480,medium:360,small:240,tiny:144};
  var a=[];try{a=p.getAvailableQualityLevels()}catch(e){}
  var o=[],seen={},i;
  for(i=0;i<a.length;i++){var h=M[a[i]];if(h&&!seen[h]){seen[h]=1;o.push({n:a[i],h:h})}}
  if(!o.length)return null;
  var cur=curH(),items=[{l:'Otomatis',c:false}];
  o.forEach(function(x){items.push({l:H(x.h),c:x.h===cur})});
  return{items:items,pick:function(i){
    if(i===0){p.setPlaybackQualityRange('tiny','highres');return}
    var n=o[i-1].n;p.setPlaybackQualityRange(n,n);p.setPlaybackQuality(n)}};
}
function jw(){
  var j=W.jwplayer;if(!j)return null;
  var p;try{p=j()}catch(e){return null}
  if(!p||!p.getQualityLevels)return null;
  var q=p.getQualityLevels()||[];if(q.length<2)return null;
  var c=p.getCurrentQuality();
  return{items:q.map(function(x,i){return{l:x.label||('#'+i),c:i===c}}),pick:function(i){p.setCurrentQuality(i)}};
}
function hls(){
  var v=vid(),h=W.hls||W.hlsPlayer||(v&&(v.hls||v._hls))||(W.player&&W.player.hls);
  if(!h||!h.levels||h.levels.length<2||h.currentLevel===undefined)return null;
  var L=h.levels,idx=sortDesc(range(L.length),function(i){return L[i].height});
  var cur=h.autoLevelEnabled?-1:h.currentLevel;
  var items=[{l:'Otomatis',c:cur===-1}];
  idx.forEach(function(i){items.push({l:L[i].height?H(L[i].height):(L[i].name||Math.round((L[i].bitrate||0)/1000)+' kbps'),c:i===cur})});
  return{items:items,pick:function(k){h.currentLevel=k===0?-1:idx[k-1]}};
}
function dash(){
  var d=W.dashPlayer||W.player;
  if(!d||!d.getBitrateInfoListFor)return null;
  var b;try{b=d.getBitrateInfoListFor('video')}catch(e){return null}
  if(!b||b.length<2)return null;
  var auto=true,cur=-1;
  try{auto=d.getSettings().streaming.abr.autoSwitchBitrate.video}catch(e){}
  try{cur=d.getQualityFor('video')}catch(e){}
  var idx=sortDesc(range(b.length),function(i){return b[i].height});
  var items=[{l:'Otomatis',c:!!auto}];
  idx.forEach(function(i){items.push({l:b[i].height?H(b[i].height):Math.round((b[i].bitrate||0)/1000)+' kbps',c:!auto&&i===cur})});
  return{items:items,pick:function(k){
    if(k===0){d.updateSettings({streaming:{abr:{autoSwitchBitrate:{video:true}}}});return}
    d.updateSettings({streaming:{abr:{autoSwitchBitrate:{video:false}}}});d.setQualityFor('video',idx[k-1])}};
}
function shaka(){
  var p=W.shakaPlayer||W.player;
  if(!p||!p.getVariantTracks||!p.selectVariantTrack)return null;
  var t=p.getVariantTracks()||[],seen={},o=[];
  t.forEach(function(x){if(x.height&&!seen[x.height]){seen[x.height]=1;o.push(x)}});
  if(o.length<2)return null;
  o.sort(function(a,b){return b.height-a.height});
  var auto=true;try{auto=p.getConfiguration().abr.enabled}catch(e){}
  var items=[{l:'Otomatis',c:!!auto}];
  o.forEach(function(x){items.push({l:H(x.height),c:!auto&&!!x.active})});
  return{items:items,pick:function(k){
    if(k===0){p.configure({abr:{enabled:true}});return}
    p.configure({abr:{enabled:false}});p.selectVariantTrack(o[k-1],true)}};
}
function vjs(){
  var V=W.videojs;if(!V||!V.getPlayers)return null;
  var ps=V.getPlayers(),k,p=null;
  for(k in ps){if(ps[k]&&ps[k].qualityLevels){p=ps[k];break}}
  if(!p)return null;
  var q;try{q=p.qualityLevels()}catch(e){return null}
  if(!q||q.length<2)return null;
  var idx=sortDesc(range(q.length),function(i){return q[i].height}),all=true,i;
  for(i=0;i<q.length;i++){if(!q[i].enabled)all=false}
  var items=[{l:'Otomatis',c:all}];
  idx.forEach(function(i){items.push({l:q[i].height?H(q[i].height):('#'+i),c:!all&&!!q[i].enabled})});
  return{items:items,pick:function(k){
    var j;for(j=0;j<q.length;j++){q[j].enabled=(k===0)?true:(j===idx[k-1])}}};
}
function src(){
  var v=vid();if(!v)return null;
  var s=v.querySelectorAll('source'),o=[],seen={},i;
  for(i=0;i<s.length;i++){
    var x=(s[i].getAttribute('size')||s[i].getAttribute('res')||s[i].getAttribute('data-res')||s[i].getAttribute('label')||s[i].getAttribute('title')||'')+'';
    var m=x.match(/([0-9]{3,4})/);
    if(m&&s[i].src){var h=parseInt(m[1],10);if(!seen[h]){seen[h]=1;o.push({u:s[i].src,h:h})}}
  }
  if(o.length<2)return null;
  o.sort(function(a,b){return b.h-a.h});
  var cur=curH();
  return{items:o.map(function(x){return{l:H(x.h),c:x.h===cur}}),pick:function(i){
    var t=v.currentTime,pl=!v.paused;W.__alUP=false;v.src=o[i].u;
    v.addEventListener('loadedmetadata',function f(){v.removeEventListener('loadedmetadata',f);try{v.currentTime=t}catch(e){}if(pl)v.play().catch(function(){})});
    v.load()}};
}

/* ===== Adapter DOM: klik menu kualitas bawaan player situs ===== */
var QRE=/^(auto|otomatis|automatic|adaptive|source|original|[0-9]{3,4}\s?p?[0-9]{0,3}|[0-9]{3,4}x[0-9]{3,4}|[248]k|hd|sd|fhd|uhd|hq|lq)(\b|$)/i;
var DS=[
  '[data-a-target="player-settings-submenu-quality-option"]',
  'button[data-plyr="quality"]',
  '.vjs-quality-selector .vjs-menu-item','.vjs-resolution-button .vjs-menu-item','.vjs-http-source-selector .vjs-menu-item',
  '.jw-settings-submenu-quality .jw-settings-content-item',
  '.dplayer-quality-item',
  '.xgplayer-definition li'
];
function box(){
  var v=vid();if(!v)return D.body;
  var e=v.parentElement,best=null,n;
  for(n=0;n<8&&e&&e!==D.body;n++,e=e.parentElement){
    var c=(e.className&&e.className.baseVal!==undefined)?e.className.baseVal:e.className;
    if(/player|plyr|video-js|jwplayer|dplayer|xgplayer|art-/i.test(String(c)+' '+(e.id||'')))best=e;
  }
  return best||(v.parentElement&&v.parentElement.parentElement)||D.body;
}
function isCur(e){
  var x=e.querySelector&&e.querySelector('input');
  if(x&&x.checked)return true;
  var a=function(n){return(e.getAttribute(n)||'')==='true'};
  if(a('aria-checked')||a('aria-selected')||a('aria-current'))return true;
  var c=String((e.className&&e.className.baseVal!==undefined)?e.className.baseVal:e.className);
  if(/(^|[ _-])(active|selected|current|checked|vjs-selected|jw-active-option)([ _-]|$)/i.test(c))return true;
  return !!(e.querySelector&&e.querySelector('[aria-checked="true"]'));
}
function menuOpen(){return S.btn&&S.els&&S.els[0]&&S.els[0].isConnected&&vis(S.els[0])}
function fromEls(els){
  S.els=els;
  done(els.map(function(e){return{l:T(e).replace(/\s*[✓✔]\s*$/,''),c:isCur(e)}}),
    function(i){
      var e=S.els[i],x=e.querySelector&&e.querySelector('input');
      clk(x||e);
      setTimeout(function(){if(menuOpen())clk(S.btn)},350);
    },
    function(){if(menuOpen())clk(S.btn)});
}
function direct(){
  var o=[],seen={};
  DS.forEach(function(s){
    var n=D.querySelectorAll(s),i;
    for(i=0;i<n.length;i++){var t=T(n[i]);if(t&&t.length<40&&QRE.test(t)&&!seen[t]){seen[t]=1;o.push(n[i])}}
  });
  return o.length>1?o:null;
}
function scanBox(){
  var n=box().querySelectorAll('li,button,a,[role="menuitem"],[role="menuitemradio"],[role="option"]'),o=[],seen={},i;
  for(i=0;i<n.length;i++){var t=T(n[i]);if(t&&t.length<30&&QRE.test(t)&&!seen[t]&&vis(n[i])){seen[t]=1;o.push(n[i])}}
  return o.length>1?o:null;
}
function qitem(){
  var s=D.querySelector('[data-a-target="player-settings-menu-item-quality"]');if(s)return s;
  var n=box().querySelectorAll('li,button,[role="menuitem"],div,span'),i;
  for(i=0;i<n.length;i++){var t=T(n[i]);
    if(t&&t.length<40&&/(quality|resolution|kualitas|resolusi|definition|画质|清晰度)/i.test(t)&&vis(n[i])&&n[i].children.length<4)return n[i]}
  return null;
}
function tryBtn(c,k,g){
  if(g!==S.gen)return;
  if(k>=c.length){S.btn=null;none();return}
  var btn=c[k];S.btn=btn;clk(btn);
  setTimeout(function(){
    if(g!==S.gen)return;
    var o=direct()||scanBox();
    if(o){fromEls(o);return}
    var qi=qitem();
    if(qi){
      clk(qi);
      setTimeout(function(){
        if(g!==S.gen)return;
        var o2=direct()||scanBox();
        if(o2){fromEls(o2)}else{clk(btn);tryBtn(c,k+1,g)}
      },300);
      return;
    }
    clk(btn);tryBtn(c,k+1,g);
  },300);
}
function dom(g){
  var d=direct();if(d){fromEls(d);return}
  var c=[],sp=D.querySelector('[data-a-target="player-settings-button"]');
  if(sp)c.push(sp);
  var n=box().querySelectorAll('button,[role="button"],div,span,i,a'),i;
  for(i=0;i<n.length&&c.length<5;i++){
    var e=n[i];
    var cl=(e.className&&e.className.baseVal!==undefined)?e.className.baseVal:e.className;
    var s=String(cl)+' '+(e.getAttribute('aria-label')||'')+' '+(e.getAttribute('title')||'')+' '+(e.id||'');
    if(/(settings?|gear|cog|quality|resolution|definition)/i.test(s)&&!/(menu-item|submenu|content|panel|container|wrapper)/i.test(s)&&c.indexOf(e)<0&&e.children.length<4)c.push(e);
  }
  if(!c.length){none();return}
  tryBtn(c,0,g);
}

W.__alVQ={
  start:function(){
    S.r=null;S.pick=null;S.close=null;S.btn=null;S.els=null;
    var g=++S.gen,a=[yt,jw,hls,dash,shaka,vjs,src],i,r;
    for(i=0;i<a.length;i++){
      try{r=a[i]()}catch(e){r=null}
      if(r){done(r.items,r.pick);return}
    }
    try{dom(g)}catch(e){none()}
  },
  res:function(){return S.r},
  pick:function(i){try{if(S.pick)S.pick(i)}catch(e){}},
  close:function(){S.gen++;try{if(S.close)S.close()}catch(e){}}
};
})()
