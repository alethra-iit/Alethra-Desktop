(function(){
  if(window.__alTrInit)return;window.__alTrInit=1;
  var seq=0,pend={},cache={};
  var SEL='yt-live-chat-text-message-renderer #message,yt-live-chat-paid-message-renderer #message,[data-a-target="chat-line-message-body"] .text-fragment,.chat-line__message-body .text-fragment,.chat-line__message .text-fragment';
  window.__alTr=function(id,r){var f=pend[id];delete pend[id];if(f&&r)f(r)};
  function show(el,orig,r){
    if(!r||r.trim()===orig)return;
    var c=window.__alCfg||{},d=el.ownerDocument;
    var wrap=d.createElement('span');wrap.className='__alo';
    while(el.firstChild)wrap.appendChild(el.firstChild);
    var t=d.createElement('span');t.className='__alt';t.textContent=r;
    t.style.cssText='display:block;opacity:.9;font-style:italic';
    if(c.hide)wrap.style.display='none';
    el.appendChild(wrap);el.appendChild(t);
  }
  function handle(el){
    if(el.__alDone)return false;
    var t=(el.textContent||'').trim();
    if(t.length<2||t.length>300)return false;
    el.__alDone=1;
    if(cache[t]!==undefined){show(el,t,cache[t]);return true}
    var id=++seq;
    pend[id]=function(r){cache[t]=r;show(el,t,r)};
    try{AlethraTr.translate(id,t,(window.__alCfg||{}).lang||'id')}catch(e){}
    return true;
  }
  function scan(){
    var c=window.__alCfg;if(!c||!c.on)return;
    var ds=[document],fr=document.querySelectorAll('iframe'),i;
    for(i=0;i<fr.length;i++){try{if(fr[i].contentDocument)ds.push(fr[i].contentDocument)}catch(e){}}
    var budget=15;
    ds.forEach(function(d){
      var n=d.querySelectorAll(SEL),k;
      for(k=n.length-1;k>=0&&budget>0;k--){if(handle(n[k]))budget--}
      var o=d.querySelectorAll('.__alo');
      for(k=0;k<o.length;k++)o[k].style.display=c.hide?'none':'';
    });
  }
  setInterval(scan,1200);scan();
})();
