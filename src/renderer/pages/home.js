
var CS='analog',O={},tid=null;
var R=document.documentElement;
async function apply(){
  var P=new URLSearchParams(await api('settings.home')),t=P.get('t');
  if(t==='dark'||(!t&&false))R.setAttribute('data-theme','dark');else R.removeAttribute('data-theme');
  if(P.get('o')==='1')R.setAttribute('data-amoled','1');else R.removeAttribute('data-amoled');
  var a=P.get('a'),okA=a&&/^#[0-9a-f]{6}$/i.test(a);
  if(okA)R.style.setProperty('--acc',a);else R.style.removeProperty('--acc');
  document.querySelector('.hero').style.display=P.get('l')==='0'?'none':'';
  var wv=P.get('w');
  if(wv&&wv!=='0'){var dd=[.2,.4,.62][parseInt(P.get('d')||'1',10)]||.4;var ov=R.getAttribute('data-theme')==='dark'?'rgba(0,0,0,'+dd+')':'rgba(255,255,255,'+dd+')';var b=document.body.style;b.backgroundImage='linear-gradient('+ov+','+ov+'),url(alethra://wallpaper/w.jpg?v='+wv+')';b.backgroundSize='cover';b.backgroundPosition='center';b.backgroundAttachment='scroll';b.backgroundRepeat='no-repeat'}
  else if(P.get('g')==='1'){var c=okA?a:(R.getAttribute('data-theme')==='dark'?'#ffffff':'#000000');var cc='rgba('+parseInt(c.substr(1,2),16)+','+parseInt(c.substr(3,2),16)+','+parseInt(c.substr(5,2),16);document.body.style.backgroundImage='linear-gradient(180deg,'+cc+',.2),'+cc+',0) 60%)';document.body.style.backgroundRepeat='no-repeat'}else document.body.style.backgroundImage='none';
  var no={c:P.get('c')||'analog',p:P.get('p')||'mid',z:parseInt(P.get('z')||'1',10),k:P.get('k')||'t',al:P.get('al')||'c',d:parseInt(P.get('d2')||'0',10),h24:P.get('h')!=='0',s:P.get('q')==='1',y:P.get('y')!=='0',n:P.get('n')!=='0',b:P.get('b')!=='0'};
  var sig=JSON.stringify(no);if(sig!==window.__cs){window.__cs=sig;CS=no.c;O={p:no.p,z:no.z,k:no.k,al:no.al,d:no.d,h24:no.h24,s:no.s,y:no.y,n:no.n,b:no.b};build()}
  var s=((await api('settings.get'))||{}).shortcuts||[];
  var g=document.getElementById('grid');g.innerHTML='';
  s.forEach(function(x,i){
    var d=document.createElement('div');d.className='tile';
    var ic=document.createElement('div');ic.className='ic';
    var host='';try{host=new URL(x.u).hostname}catch(e){}
    var l=document.createElement('span');l.textContent=(x.n||host||'?').charAt(0).toUpperCase();ic.appendChild(l);
    var im=new Image();im.onload=function(){l.style.display='none';ic.appendChild(im)};
    if(host)im.src='https://www.google.com/s2/favicons?domain='+host+'&sz=64';
    var lb=document.createElement('div');lb.className='lb';lb.textContent=x.n||host;
    d.appendChild(ic);d.appendChild(lb);
    d.onclick=function(){api('nav.to',x.u)};var rm=document.createElement('button');rm.className='rm';rm.textContent='\u2715';rm.title='Hapus pintasan';rm.onclick=function(e){e.stopPropagation();api('shortcut.remove',i)};d.appendChild(rm);
    
    g.appendChild(d);
  });
  var a=document.createElement('div');a.className='tile';
  a.innerHTML='<div class="ic"><svg viewBox="0 0 24 24"><path d="M5 12h14"/><path d="M12 5v14"/></svg></div><div class="lb">Tambah</div>';
  a.onclick=async function(){var r=await askText('Tambah pintasan',[{l:'Nama',p:'mis. Berita'},{l:'Alamat situs',p:'contoh.com'}],'Tambah');if(r&&r[1])api('shortcut.add',r[0],r[1])};
  g.appendChild(a);
}
apply();alethra.on('settings',function(){apply()});
function place(c){var b=document.body,hero=document.querySelector('.hero'),g=document.getElementById('grid');
  if(O.p==='top')b.insertBefore(c,b.firstChild);else if(O.p==='bot')b.insertBefore(c,g.nextSibling);else b.insertBefore(c,g)}
function build(){
  var c=document.getElementById('clock');place(c);
  var al={l:' al-l',r:' al-r'}[O.al]||' al-c';
  c.className='clock '+CS+al+(O.b?'':' nobg');c.style.display=CS==='off'?'none':'';
  var z=[.78,1,1.25][O.z]||1;c.style.setProperty('--z',z);
  var ck={a:'var(--acc,var(--fg))',g:'#f0a030',b:'#4f8ef7',h:'#34c38f'}[O.k];c.style.setProperty('--ck',ck||'var(--fg)');
  var face='';
  if(CS==='analog'||CS==='dial'){
    var n='',i,x,y,x2,y2;
    for(i=1;i<=12;i++){
      if(O.n){x=60+45*Math.sin(i*Math.PI/6);y=60-45*Math.cos(i*Math.PI/6);n+='<text x="'+x.toFixed(1)+'" y="'+y.toFixed(1)+'">'+i+'</text>'}
      else{x=60+52*Math.sin(i*Math.PI/6);y=60-52*Math.cos(i*Math.PI/6);x2=60+(i%3?47:42)*Math.sin(i*Math.PI/6);y2=60-(i%3?47:42)*Math.cos(i*Math.PI/6);n+='<line class="t" stroke-width="'+(i%3?2:3.2)+'" x1="'+x.toFixed(1)+'" y1="'+y.toFixed(1)+'" x2="'+x2.toFixed(1)+'" y2="'+y2.toFixed(1)+'"/>'}
    }
    face='<svg class="clk" viewBox="0 0 120 120">'+n+'<line class="h" id="hh" stroke-width="4.5" x1="60" y1="60" x2="60" y2="38"/><line class="h" id="mh" stroke-width="3.6" x1="60" y1="60" x2="60" y2="24"/><line class="s" id="sh" stroke-width="1.6" x1="60" y1="68" x2="60" y2="20"/><circle cx="60" cy="60" r="3.4"/></svg>';
  }
  if(CS==='analog')c.innerHTML='<div><div class="tm" id="tm"></div>'+(O.y?'<div class="city" id="city"></div>':'')+(O.d<2?'<div class="dt" id="dt"></div>':'')+'</div>'+face;
  else if(CS==='dial')c.innerHTML=face;
  else if(CS!=='off')c.innerHTML='<div class="tm" id="tm"></div>'+(O.d<2?'<div class="dt" id="dt"></div>':'');
  clearInterval(tid);
  if(CS!=='off'){tick();tid=setInterval(tick,(CS==='analog'||CS==='dial'||O.s)?1000:5000)}
}
function tick(){var n=new Date(),tm=document.getElementById('tm');
var hh=n.getHours(),mm=n.getMinutes(),ss=n.getSeconds(),p2=function(v){return v<10?'0'+v:v};
if(tm){var h=O.h24?hh:((hh%12)||12);
 tm.textContent=(O.h24?p2(h):h)+':'+p2(mm)+(O.s&&CS!=='analog'?':'+p2(ss):'')+(O.h24?'':(hh<12?' AM':' PM'))}
var dt=document.getElementById('dt');
if(dt)dt.textContent=n.toLocaleDateString('id-ID',(CS==='analog'||O.d===1)?{weekday:'long',day:'numeric',month:'short'}:{weekday:'long',day:'numeric',month:'long',year:'numeric'});
var cy=document.getElementById('city');
if(cy){var tz='';try{tz=Intl.DateTimeFormat().resolvedOptions().timeZone||''}catch(e){}cy.textContent=tz?tz.split('/').pop().replace(/_/g,' '):'Waktu setempat'}
if(document.getElementById('hh')){
 var set=function(id,d){document.getElementById(id).setAttribute('transform','rotate('+d+' 60 60)')};
 set('hh',((hh%12)+mm/60)*30);set('mh',(mm+ss/60)*6);set('sh',ss*6)}
}

document.getElementById('sf').onsubmit=function(e){e.preventDefault();var v=document.getElementById('sq').value.trim();if(v)api('nav.search',v)};
document.getElementById('sq').focus();
