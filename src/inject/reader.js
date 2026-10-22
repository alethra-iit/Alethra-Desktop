(function(){
var VP=__VOICE__;   // {lang:'auto'|kode, gender:'auto'|'male'|'female', name:''}
var AlVoice=(function(){
  var FEM=/\b(zira|hazel|susan|aria|jenny|heera|hedda|helena|katja|elsa|hortense|julie|paulina|sabina|lucia|laura|helia|elena|irina|ayumi|haruka|huihui|yaoyao|hanhan|heami|sunhi|xiaoxiao|xiaoyi|xiaohan|emma|michelle|libby|sonia|natasha|clara|catherine|linda|zuzana|maria|monica|isabella|amelie|denise|elke|heidi|fatima|salma|hoda|mia|nanami|sofia|ioana|alexandra|svetlana|ekaterina|yuna|gadis|samantha|victoria|karen|tessa|fiona|moira|veena|kyoko|ting-ting|sin-ji|mei-jia|female|woman|wanita|perempuan)\b/i;
  var MAL=/\b(david|mark|george|guy|ravi|andika|ardi|stefan|stefanos|james|richard|ryan|sean|brian|christopher|eric|jorge|pablo|raul|sergio|diego|claude|paul|bart|frank|hemant|naayf|hamed|shakir|rizwan|ichiro|keita|kangkang|yunyang|danny|zhiwei|jonas|conrad|killian|jose|aleksandr|pavel|lucas|henri|tomas|cheng|kenji|ivan|filip|aaron|daniel|alex|fred|ralph|thomas|oliver|rishi|male|man|pria|laki)\b/i;
  var STOP={
   id:'yang dan di ke dari untuk dengan ini itu tidak pada adalah akan juga dalam atau oleh bisa sudah saya kami mereka karena sebagai lebih telah ada anda kita',
   en:'the and of to in is that for with as on are this was by it from at be or an have not but they which you we more has their will can',
   es:'el la los las de que y en un una es por con para no se su al lo como más pero sus le ya o este sí porque esta entre cuando muy sin sobre',
   fr:'le la les de des du et en un une est que qui dans pour pas sur au avec ce il elle sont plus par nous vous mais ou ses leur être cette',
   de:'der die das und ist nicht ein eine zu den mit von sich auf für auch es dem im als auch wie wird sind oder bei nach aber noch nur',
   pt:'o a os as de que e do da em um uma para com não é por mais se dos como mas foi ao ele das tem à seu sua ou ser quando muito',
   it:'il lo la i gli le di che e un una è per con non si da in del della dei come più ma anche al sono ha nel alla questo se loro',
   nl:'de het een en van ik te dat die in is niet zijn op aan met als voor er maar om had ook dan nog bij of wat naar uit door'
  };
  var SW={};Object.keys(STOP).forEach(function(k){var o={};STOP[k].split(' ').forEach(function(w){o[w]=1;});SW[k]=o;});
  function base(l){return String(l||'').toLowerCase().split(/[-_]/)[0];}
  function detect(t,fb){
   var m;
   if(/[؀-ۿ]/.test(t))return 'ar';
   if(/[぀-ヿ]/.test(t))return 'ja';
   if(/[가-힯]/.test(t))return 'ko';
   if(/[一-鿿]/.test(t))return 'zh';
   if(/[฀-๿]/.test(t))return 'th';
   if(/[ऀ-ॿ]/.test(t))return 'hi';
   if(/[֐-׿]/.test(t))return 'he';
   if(/[Ͱ-Ͽ]/.test(t))return 'el';
   if(/[Ѐ-ӿ]/.test(t))return base(fb)==='uk'?'uk':'ru';
   var w=t.toLowerCase().match(/[a-zà-ÿ]+/g)||[],best='',bs=0,k,n,i;
   for(k in SW){n=0;for(i=0;i<w.length;i++)if(SW[k][w[i]])n++;if(n>bs){bs=n;best=k;}}
   if(best==='id'&&base(fb)==='ms')best='ms';
   return bs>=2?best:(base(fb)||'en');
  }
  function genderOf(v){var n=v.name||'';if(FEM.test(n))return 'female';if(MAL.test(n))return 'male';return '';}
  function voices(){try{return speechSynthesis.getVoices()||[];}catch(e){return [];}}
  function pageLang(){return base(document.documentElement.lang)||'';}
  // pilih suara untuk satu bahasa. Urutan: suara pilihan pengguna → jenis kelamin cocok → suara lokal bahasa itu
  function pick(lang){
   var b=base(lang),all=voices().filter(function(v){return base(v.lang)===b;}),i,v,g=VP.gender;
   if(!all.length)return {voice:null,exact:false};
   if(VP.name){for(i=0;i<all.length;i++)if(all[i].name===VP.name)return {voice:all[i],exact:g==='auto'||genderOf(all[i])===g};}
   var full=String(lang||'').toLowerCase();
   all.sort(function(x,y){
    var sx=(x.lang.toLowerCase()===full?2:0)+(x.localService?1:0),sy=(y.lang.toLowerCase()===full?2:0)+(y.localService?1:0);
    return sy-sx;
   });
   if(g!=='auto'){for(i=0;i<all.length;i++)if(genderOf(all[i])===g)return {voice:all[i],exact:true};}
   return {voice:all[0],exact:g==='auto'};
  }
  return {base:base,detect:detect,genderOf:genderOf,voices:voices,pageLang:pageLang,pick:pick};
})();

var AlApp=(function(){
  var rate=1,idx=0,items=[],tok=0,docLang='';
  function langFor(txt){
   if(VP.lang&&VP.lang!=='auto')return VP.lang;
   return AlVoice.detect(txt,docLang||'en');   // aksara non-Latin dikenali langsung; teks Latin pendek ikut bahasa halaman
  }
  function speakFrom(i){
    var my=++tok; try{speechSynthesis.cancel();}catch(e){}
    if(i>=items.length){try{window.__alTtsEnd&&window.__alTtsEnd();}catch(e){}return;}
    idx=i;try{window.__alTts&&window.__alTts(i);}catch(e){}
    var u=new SpeechSynthesisUtterance(items[i]);u.rate=rate;
    var L=langFor(items[i]),p=AlVoice.pick(L);
    if(p.voice){u.voice=p.voice;u.lang=p.voice.lang;}else u.lang=L;
    // tidak ada suara dengan jenis kelamin itu: tetap bicara dengan suara yang ada, nadanya digeser
    u.pitch=(VP.gender==='female'&&!p.exact)?1.3:(VP.gender==='male'&&!p.exact)?0.7:1;
    try{window.__alTtsInfo=(p.voice?p.voice.name:'(bawaan sistem)')+' · '+u.lang;window.__alTtsInfoCb&&window.__alTtsInfoCb();}catch(e){}
    u.onend=function(){if(my===tok)speakFrom(i+1);};
    u.onerror=function(){if(my===tok&&!window.__alStop)speakFrom(i+1);};
    speechSynthesis.speak(u);
  }
  return{
    readerPref:function(s,t){window.__alRdPref=JSON.stringify({size:s,theme:t,voice:VP});},
    ttsStart:function(j,i,l,r){items=JSON.parse(j);rate=r||1;docLang=AlVoice.base(l);window.__alStop=false;speakFrom(i||0);},
    ttsStop:function(){tok++;window.__alStop=true;try{speechSynthesis.cancel();}catch(e){}},
    ttsRate:function(r){rate=r;},
    ttsPick:function(){}
  };
})();

 var SIZE=__SIZE__,THEME='__THEME__';
 var ex=document.getElementById('__alrd');
 if(ex){if(ex.__close)ex.__close();return 'off';}
 function txt(e){return (e.innerText||'').replace(/\s+/g,' ').trim();}
 var cands=document.querySelectorAll('article,main,[role=main],section,div'),scores=[],bs=0,i,j,best=null;
 var lim=Math.min(cands.length,600);
 for(i=0;i<lim;i++){
  var el=cands[i],ps=el.querySelectorAll('p'),s=0;
  if(ps.length<2){scores.push(0);continue;}
  for(j=0;j<ps.length;j++){var t=txt(ps[j]);if(t.length>60)s+=Math.min(t.length,300);}
  var all=txt(el).length||1,ln=0,as=el.querySelectorAll('a');
  for(j=0;j<as.length;j++)ln+=txt(as[j]).length;
  s=s*(1-Math.min(0.9,ln/all));
  scores.push(s);
  if(s>bs)bs=s;
 }
 if(bs<200)return 'no';
 var bn=1e9;
 for(i=0;i<lim;i++){if(scores[i]>=bs*0.85){var n=cands[i].getElementsByTagName('*').length;if(n<bn){bn=n;best=cands[i];}}}
 if(!best)return 'no';
 var ALLOW={P:1,H1:1,H2:1,H3:1,H4:1,H5:1,H6:1,UL:1,OL:1,LI:1,BLOCKQUOTE:1,PRE:1,CODE:1,STRONG:1,B:1,EM:1,I:1,BR:1,FIGURE:1,FIGCAPTION:1,TABLE:1,THEAD:1,TBODY:1,TR:1,TD:1,TH:1,A:1,HR:1};
 var SKIP={SCRIPT:1,STYLE:1,NAV:1,ASIDE:1,FOOTER:1,FORM:1,IFRAME:1,BUTTON:1,NOSCRIPT:1,SVG:1,VIDEO:1,AUDIO:1,CANVAS:1,SELECT:1,INPUT:1,TEXTAREA:1,HEADER:1,TEMPLATE:1,OBJECT:1,EMBED:1};
 var skipRe=/(comment|share|social|related|promo|advert|banner|sidebar|newsletter|subscribe|popup|modal|cookie|breadcrumb|toolbar)/i;
 function abs(u){try{var x=new URL(u,location.href);return(x.protocol==='http:'||x.protocol==='https:')?x.href:'';}catch(e){return '';}}
 function clean(src,dst){
  var c=src.firstChild;
  while(c){
   if(c.nodeType===3){dst.appendChild(document.createTextNode(c.nodeValue));}
   else if(c.nodeType===1){
    var tag=c.tagName.toUpperCase(),cls=(typeof c.className==='string'?c.className:'')+' '+(c.id||'');
    var hid=false;
    try{hid=c.hidden||getComputedStyle(c).display==='none';}catch(e){}
    if(SKIP[tag]||hid){}
    else if(skipRe.test(cls)&&txt(c).length<400){}
    else if(tag==='IMG'){
     var sr=abs(c.currentSrc||c.getAttribute('data-src')||c.src||'');
     var w=c.naturalWidth||parseInt(c.getAttribute('width')||'0',10);
     if(sr&&(w===0||w>=80)){var im=document.createElement('img');im.src=sr;im.alt=c.alt||'';dst.appendChild(im);}
    }
    else if(ALLOW[tag]){
     var nd=document.createElement(tag.toLowerCase());
     if(tag==='A'){var h=abs(c.getAttribute('href')||'');if(h)nd.href=h;}
     clean(c,nd);dst.appendChild(nd);
    }
    else{clean(c,dst);}
   }
   c=c.nextSibling;
  }
 }
 var h1=document.querySelector('article h1')||document.querySelector('h1');
 var title=(h1&&txt(h1))||document.title||'';
 var oldY=window.scrollY;
 var css='body.__alr>*:not(#__alrd){display:none!important}body.__alr{margin:0!important;padding:0!important;height:auto!important;overflow:visible!important}html{height:auto!important;overflow:visible!important}'+
 '#__alrd{display:block;box-sizing:border-box;min-height:100vh;font-family:Georgia,serif;text-align:left;margin:0;padding:0}'+
 '#__alrd *{box-sizing:border-box;max-width:100%}#__alrd.l{background:#fff;color:#1a1a1a}#__alrd.s{background:#f4ecd8;color:#3b3228}#__alrd.d{background:#121212;color:#d8d8d8}'+
 '#__alrd .b{position:sticky;top:0;display:flex;flex-wrap:wrap;gap:8px;justify-content:flex-end;padding:8px 12px;background:inherit;border-bottom:1px solid rgba(128,128,128,.25);z-index:2}'+
 '#__alrd .b button{border:0;display:inline-flex;align-items:center;justify-content:center;min-width:38px;height:36px;padding:0 9px;white-space:nowrap;border-radius:14px;background:rgba(128,128,128,.2);color:inherit;font:600 14px sans-serif}#__alrd .b svg{display:block;pointer-events:none}'+
 '#__alrd .vp{position:absolute;right:12px;top:100%;margin-top:6px;width:min(320px,calc(100vw - 24px));padding:12px;border-radius:14px;background:#fff;color:#1a1a1a;border:1px solid rgba(128,128,128,.4);box-shadow:0 8px 28px rgba(0,0,0,.28);font:14px sans-serif;z-index:3}#__alrd.d .vp{background:#242424;color:#e6e6e6}#__alrd.s .vp{background:#fbf5e6;color:#3b3228}'+
 '#__alrd .vp[hidden]{display:none}#__alrd .vp label{display:block;font-size:12px;opacity:.7;margin:10px 0 4px}#__alrd .vp label:first-child{margin-top:0}'+
 '#__alrd .vp select{width:100%;height:36px;border-radius:10px;border:1px solid rgba(128,128,128,.5);background:rgba(128,128,128,.12);color:inherit;font:14px sans-serif;padding:0 8px}#__alrd .vp select option{background:#fff;color:#1a1a1a}'+
 '#__alrd .vp .g{display:flex;gap:6px}#__alrd .vp .g button{flex:1;height:36px;border:1px solid rgba(128,128,128,.5);border-radius:10px;background:rgba(128,128,128,.12);color:inherit;font:600 13px sans-serif;cursor:pointer}#__alrd .vp .g button.on{background:#1a73e8;border-color:#1a73e8;color:#fff}'+
 '#__alrd .vp .n{font-size:12px;opacity:.75;margin-top:10px;line-height:1.4}'+
 '#__alrd .c{max-width:680px;margin:0 auto;padding:16px 20px 64px;line-height:1.7}'+
 '#__alrd h1{font-size:1.5em;line-height:1.25;margin:.4em 0}#__alrd h2{font-size:1.3em;margin:1.2em 0 .4em}#__alrd h3,#__alrd h4{font-size:1.15em;margin:1em 0 .3em}'+
 '#__alrd p,#__alrd ul,#__alrd ol{margin:0 0 1em}#__alrd a{color:inherit;text-decoration:underline}'+
 '#__alrd img{display:block;height:auto;margin:1em auto;border-radius:6px}#__alrd figure{margin:1em 0}#__alrd figcaption{font-size:.8em;opacity:.7;text-align:center}'+
 '#__alrd blockquote{border-left:3px solid rgba(128,128,128,.5);margin:1em 0;padding:0 1em;opacity:.9}'+
 '#__alrd pre{overflow:auto;background:rgba(128,128,128,.15);padding:12px;border-radius:6px;font-size:.85em}#__alrd table{border-collapse:collapse;display:block;overflow:auto}#__alrd td,#__alrd th{border:1px solid rgba(128,128,128,.4);padding:6px}';
 var sheet=null,st=null;
 try{sheet=new CSSStyleSheet();sheet.replaceSync(css);document.adoptedStyleSheets=(document.adoptedStyleSheets||[]).concat([sheet]);}
 catch(e){sheet=null;st=document.createElement('style');st.textContent=css;document.head.appendChild(st);}
 var wrap=document.createElement('div');wrap.id='__alrd';
 var bar=document.createElement('div');bar.className='b';
 var cont=document.createElement('div');cont.className='c';cont.style.fontSize=SIZE+'px';
 function applyTheme(){wrap.className=THEME==='dark'?'d':(THEME==='sepia'?'s':'l');}
 function save(){try{AlApp.readerPref(SIZE,THEME);}catch(e){}}
 function close(){
  try{AlApp.ttsStop();}catch(e){}
  ttsClear();
  document.body.classList.remove('__alr');
  wrap.remove();
  if(st)st.remove();
  if(sheet){document.adoptedStyleSheets=(document.adoptedStyleSheets||[]).filter(function(x){return x!==sheet;});}
  window.scrollTo(0,oldY);
 }
 wrap.__close=close;
 function ic(d){return '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'+d+'</svg>';}
 var IC={
  minus:ic('<path d="M3.5 19l5-13 5 13M5.2 14.5h6.6M17 8h4"/>'),
  plus:ic('<path d="M3.5 19l5-13 5 13M5.2 14.5h6.6M17 8h4M19 6v4"/>'),
  theme:ic('<circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor"/>'),
  speak:ic('<path d="M11 5L6 9H2v6h4l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/>'),
  pause:ic('<path d="M8 5v14M16 5v14"/>'),
  play:ic('<path d="M7 4l13 8-13 8z"/>'),
  globe:ic('<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>'),
  close:ic('<path d="M18 6L6 18M6 6l12 12"/>')
 };
 function mk(icon,label,fn){var b=document.createElement('button');if(icon.charAt(0)==='<')b.innerHTML=icon;else b.textContent=icon;b.setAttribute('aria-label',label);b.title=label;b.onclick=fn;bar.appendChild(b);return b;}
 mk(IC.minus,'Perkecil teks',function(){SIZE=Math.max(14,SIZE-2);cont.style.fontSize=SIZE+'px';save();});
 mk(IC.plus,'Perbesar teks',function(){SIZE=Math.min(28,SIZE+2);cont.style.fontSize=SIZE+'px';save();});
 mk(IC.theme,'Ganti tema',function(){THEME=THEME==='light'?'sepia':(THEME==='sepia'?'dark':'light');applyTheme();save();});
 var ttsOn=false,ttsIdx=0,ttsEls=[],ttsRate=__RATE__,ttsHi=null,tb=null,rb=null;
 var TS='h1,h2,h3,h4,p,li,blockquote,figcaption';
 function tbSet(k){if(!tb)return;tb.innerHTML=IC[k];var l={speak:'Baca artikel',pause:'Jeda',play:'Lanjutkan'};tb.setAttribute('aria-label',l[k]);tb.title=l[k];}
 function ttsClear(){if(ttsHi){ttsHi.style.background='';ttsHi=null;}}
 window.__alTts=function(i){ttsIdx=i;ttsClear();var e=ttsEls[i];if(e){ttsHi=e;e.style.background='rgba(255,193,7,.3)';try{e.scrollIntoView({block:'center',behavior:'smooth'});}catch(x){e.scrollIntoView();}}};
 window.__alTtsEnd=function(){ttsOn=false;ttsIdx=0;ttsClear();tbSet('speak');};
 function ttsPlay(){
  if(!ttsEls.length){ttsEls=[].slice.call(cont.querySelectorAll(TS)).filter(function(e){return !e.querySelector(TS)&&txt(e).length>1;});}
  if(!ttsEls.length)return;
  var arr=ttsEls.map(function(e){return txt(e);});
  ttsOn=true;tbSet('pause');
  try{AlApp.ttsStart(JSON.stringify(arr),ttsIdx,document.documentElement.lang||'',ttsRate);}catch(e){ttsOn=false;tbSet('speak');}
 }
 function ttsPause(){ttsOn=false;tbSet('play');try{AlApp.ttsStop();}catch(e){}}
 tb=mk(IC.speak,'Baca artikel',function(){if(ttsOn)ttsPause();else ttsPlay();});
 rb=mk(ttsRate+'x','Kecepatan baca',function(){
  var rs=[1,1.25,1.5,0.75],k=rs.indexOf(ttsRate);ttsRate=rs[(k+1)%rs.length];
  rb.textContent=ttsRate+'x';try{AlApp.ttsRate(ttsRate);}catch(e){}
  if(ttsOn)ttsPlay();
 });
 window.__alTtsLang=function(){if(ttsOn)ttsPlay();};
 // ---- Bahasa & suara bacaan ----
 var vb=mk(IC.globe,'Bahasa & suara bacaan',function(e){vpToggle();}),vp=document.createElement('div');
 vp.className='vp';vp.hidden=true;
 var vpL=document.createElement('select'),vpV=document.createElement('select'),vpG=document.createElement('div'),vpN=document.createElement('div');
 vpG.className='g';vpN.className='n';
 function lbl(t){var l=document.createElement('label');l.textContent=t;return l;}
 var GN=[['auto','Otomatis'],['male','Pria'],['female','Wanita']],gb={};
 GN.forEach(function(g){var b=document.createElement('button');b.textContent=g[1];b.setAttribute('data-g',g[0]);b.onclick=function(){VP.gender=g[0];VP.name='';vpFill();vpChanged();};gb[g[0]]=b;vpG.appendChild(b);});
 vpL.onchange=function(){VP.lang=vpL.value;VP.name='';vpFill();vpChanged();};
 vpV.onchange=function(){VP.name=vpV.value;vpFill();vpChanged();};
 vp.appendChild(lbl('Bahasa suara'));vp.appendChild(vpL);
 vp.appendChild(lbl('Jenis suara'));vp.appendChild(vpG);
 vp.appendChild(lbl('Suara'));vp.appendChild(vpV);vp.appendChild(vpN);
 bar.appendChild(vp);
 var NAMES=null;
 function langName(c){
  try{if(!NAMES)NAMES=new Intl.DisplayNames(['id'],{type:'language'});var n=NAMES.of(c);if(n&&n!==c)return n.charAt(0).toUpperCase()+n.slice(1);}catch(e){}
  return c;
 }
 function vpFill(){
  var vs=AlVoice.voices(),seen={},codes=[],i,o;
  vs.forEach(function(v){var b=AlVoice.base(v.lang);if(b&&!seen[b]){seen[b]=1;codes.push(b);}});
  ['id','en'].forEach(function(c){if(!seen[c]){seen[c]=1;codes.push(c);}});
  var pl=AlVoice.pageLang();if(pl&&!seen[pl]){seen[pl]=1;codes.push(pl);}
  if(VP.lang!=='auto'&&!seen[AlVoice.base(VP.lang)]){codes.push(AlVoice.base(VP.lang));}
  codes.sort(function(a,b){return langName(a).localeCompare(langName(b),'id');});
  vpL.innerHTML='';
  o=document.createElement('option');o.value='auto';o.textContent='Otomatis (ikuti bahasa teks)';vpL.appendChild(o);
  codes.forEach(function(c){o=document.createElement('option');o.value=c;o.textContent=langName(c)+' ('+c+')';vpL.appendChild(o);});
  vpL.value=(VP.lang==='auto'||seen[AlVoice.base(VP.lang)])?(VP.lang==='auto'?'auto':AlVoice.base(VP.lang)):'auto';
  GN.forEach(function(g){gb[g[0]].className=VP.gender===g[0]?'on':'';});
  // daftar suara yang cocok dengan bahasa (dan jenis) terpilih
  var tl=VP.lang==='auto'?(AlVoice.pageLang()||'en'):VP.lang;
  var list=vs.filter(function(v){return AlVoice.base(v.lang)===AlVoice.base(tl)&&(VP.gender==='auto'||AlVoice.genderOf(v)===VP.gender);});
  vpV.innerHTML='';
  o=document.createElement('option');o.value='';o.textContent='Otomatis (terbaik yang ada)';vpV.appendChild(o);
  list.forEach(function(v){o=document.createElement('option');o.value=v.name;o.textContent=v.name.replace(/^Microsoft\s+/,'')+' ['+v.lang+']';vpV.appendChild(o);});
  vpV.value=list.some(function(v){return v.name===VP.name;})?VP.name:'';
  if(VP.name&&vpV.value!==VP.name)VP.name='';
  var msg='';
  if(VP.lang!=='auto'&&!vs.some(function(v){return AlVoice.base(v.lang)===AlVoice.base(VP.lang);}))msg='Belum ada suara '+langName(AlVoice.base(VP.lang))+' di komputer ini. Pasang di Pengaturan Windows → Waktu & bahasa → Ucapan. Sementara dibaca dengan suara bawaan.';
  else if(VP.gender!=='auto'&&!list.length)msg='Tidak ada suara '+(VP.gender==='male'?'pria':'wanita')+' terpasang untuk bahasa ini, jadi nada suara yang ada disesuaikan.';
  else if(window.__alTtsInfo)msg='Sedang dipakai: '+window.__alTtsInfo;
  vpN.textContent=msg;
 }
 function vpChanged(){save();if(ttsOn)ttsPlay();}
 function vpToggle(){vp.hidden=!vp.hidden;if(!vp.hidden)vpFill();}
 window.__alTtsInfoCb=function(){if(!vp.hidden)vpFill();};
 try{speechSynthesis.addEventListener('voiceschanged',function(){if(!vp.hidden)vpFill();});}catch(e){}
 wrap.addEventListener('click',function(e){if(!vp.hidden&&!vp.contains(e.target)&&!vb.contains(e.target))vp.hidden=true;});
 document.addEventListener('keydown',function(e){if(e.key==='Escape'&&!vp.hidden){vp.hidden=true;}},true);
 mk(IC.close,'Tutup mode baca',close);
 var ht=document.createElement('h1');ht.textContent=title;cont.appendChild(ht);
 var hs=document.createElement('div');hs.style.cssText='opacity:.6;font:13px sans-serif;margin-bottom:1em';hs.textContent=location.hostname;cont.appendChild(hs);
 clean(best,cont);
 var h1s=cont.querySelectorAll('h1');
 for(i=1;i<h1s.length;i++){if(txt(h1s[i])===title)h1s[i].remove();}
 wrap.appendChild(bar);wrap.appendChild(cont);
 applyTheme();
 document.body.appendChild(wrap);
 document.body.classList.add('__alr');
 window.scrollTo(0,0);
 return 'ok';
})()