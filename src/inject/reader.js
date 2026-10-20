(function(){
var AlApp=(function(){
  var rate=1,idx=0,items=[],tok=0;
  function speakFrom(i){
    var my=++tok; try{speechSynthesis.cancel();}catch(e){}
    if(i>=items.length){try{window.__alTtsEnd&&window.__alTtsEnd();}catch(e){}return;}
    idx=i;try{window.__alTts&&window.__alTts(i);}catch(e){}
    var u=new SpeechSynthesisUtterance(items[i]);u.rate=rate;
    var lang=document.documentElement.lang;if(lang)u.lang=lang;
    u.onend=function(){if(my===tok)speakFrom(i+1);};
    u.onerror=function(){if(my===tok&&!window.__alStop)speakFrom(i+1);};
    speechSynthesis.speak(u);
  }
  return{
    readerPref:function(s,t){window.__alRdPref=JSON.stringify({size:s,theme:t});},
    ttsStart:function(j,i,l,r){items=JSON.parse(j);rate=r||1;window.__alStop=false;speakFrom(i||0);},
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