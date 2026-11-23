var CAL={on:true,ws:1,hol:true,wk:false,p:'m',z:1,b:true,s:'l',k:'a',al:'l',m:'f'},EV={},CV=null,CSEL=null,CPICK=false,CDAY='',CAG=false,CEXP=false,HC={};
var MN=['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
var DN=['Sen','Sel','Rab','Kam','Jum','Sab','Min'],DL=['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'],MS=['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
// Tanggal merah (n = libur nasional, c = cuti bersama). Tahun di luar tabel hanya memakai libur tetap. Sumber: SKB 3 Menteri 2026 & 2027.
var HF={'01-01':'Tahun Baru Masehi','05-01':'Hari Buruh','06-01':'Hari Lahir Pancasila','08-17':'Hari Kemerdekaan RI','12-25':'Hari Natal'};
var HY={
2026:{'01-01':['Tahun Baru 2026 Masehi','n'],'01-16':['Isra Mikraj Nabi Muhammad saw.','n'],'02-16':['Cuti Bersama Imlek','c'],'02-17':['Tahun Baru Imlek 2577','n'],'03-18':['Cuti Bersama Nyepi','c'],'03-19':['Hari Suci Nyepi','n'],'03-20':['Cuti Bersama Idulfitri','c'],'03-21':['Idulfitri 1447 H','n'],'03-22':['Idulfitri 1447 H','n'],'03-23':['Cuti Bersama Idulfitri','c'],'03-24':['Cuti Bersama Idulfitri','c'],'04-03':['Wafat Yesus Kristus','n'],'04-05':['Paskah','n'],'05-01':['Hari Buruh','n'],'05-14':['Kenaikan Yesus Kristus','n'],'05-15':['Cuti Bersama Kenaikan Yesus Kristus','c'],'05-27':['Iduladha 1447 H','n'],'05-28':['Cuti Bersama Iduladha','c'],'05-31':['Hari Raya Waisak','n'],'06-01':['Hari Lahir Pancasila','n'],'06-16':['Tahun Baru Islam 1448 H','n'],'08-17':['Hari Kemerdekaan RI','n'],'08-25':['Maulid Nabi Muhammad saw.','n'],'12-24':['Cuti Bersama Natal','c'],'12-25':['Hari Natal','n']},
2027:{'01-01':['Tahun Baru 2027 Masehi','n'],'01-05':['Isra Mikraj Nabi Muhammad saw.','n'],'02-05':['Cuti Bersama Imlek','c'],'02-06':['Tahun Baru Imlek 2578','n'],'03-08':['Hari Suci Nyepi','n'],'03-09':['Cuti Bersama Idulfitri','c'],'03-10':['Idulfitri 1448 H','n'],'03-11':['Idulfitri 1448 H','n'],'03-12':['Cuti Bersama Idulfitri','c'],'03-15':['Cuti Bersama Idulfitri','c'],'03-25':['Cuti Bersama Wafat Yesus Kristus','c'],'03-26':['Wafat Yesus Kristus','n'],'03-28':['Paskah','n'],'05-01':['Hari Buruh','n'],'05-06':['Kenaikan Yesus Kristus','n'],'05-17':['Iduladha 1448 H','n'],'05-18':['Cuti Bersama Iduladha','c'],'05-19':['Cuti Bersama Waisak','c'],'05-20':['Hari Raya Waisak','n'],'06-01':['Hari Lahir Pancasila','n'],'06-06':['Tahun Baru Islam 1449 H','n'],'08-15':['Maulid Nabi Muhammad saw.','n'],'08-17':['Hari Kemerdekaan RI','n'],'12-24':['Cuti Bersama Natal','c'],'12-25':['Hari Natal','n']}};

var CS='analog',O={},tid=null;
var R=document.documentElement;
async function apply(){
  var P=new URLSearchParams(await api('settings.home')),t=P.get('t');
  if(t==='dark'||(!t&&false))R.setAttribute('data-theme','dark');else R.removeAttribute('data-theme');
  if(P.get('o')==='1')R.setAttribute('data-amoled','1');else R.removeAttribute('data-amoled');
  var a=P.get('a'),okA=a&&/^#[0-9a-f]{6}$/i.test(a);
  if(okA){R.style.setProperty('--acc',a);var an=parseInt(a.slice(1),16);R.style.setProperty('--onacc',(0.299*(an>>16)+0.587*((an>>8)&255)+0.114*(an&255))/255>0.6?'#111':'#fff')}else{R.style.removeProperty('--acc');R.style.removeProperty('--onacc')}
  document.querySelector('.hero').style.display=P.get('l')==='0'?'none':'';
  var wv=P.get('w');
  if(wv&&wv!=='0'){var dd=[.2,.4,.62][parseInt(P.get('d')||'1',10)]||.4;var ov=R.getAttribute('data-theme')==='dark'?'rgba(0,0,0,'+dd+')':'rgba(255,255,255,'+dd+')';var b=document.body.style;b.backgroundImage='linear-gradient('+ov+','+ov+'),url(alethra://wallpaper/w.jpg?v='+wv+')';b.backgroundSize='cover';b.backgroundPosition='center';b.backgroundAttachment='scroll';b.backgroundRepeat='no-repeat'}
  else if(P.get('g')==='1'){var c=okA?a:(R.getAttribute('data-theme')==='dark'?'#ffffff':'#000000');var cc='rgba('+parseInt(c.substr(1,2),16)+','+parseInt(c.substr(3,2),16)+','+parseInt(c.substr(5,2),16);document.body.style.backgroundImage='linear-gradient(180deg,'+cc+',.2),'+cc+',0) 60%)';document.body.style.backgroundRepeat='no-repeat'}else document.body.style.backgroundImage='none';
  var no={c:P.get('c')||'analog',p:P.get('p')||'mid',z:parseInt(P.get('z')||'1',10),k:P.get('k')||'t',al:P.get('al')||'c',d:parseInt(P.get('d2')||'0',10),h24:P.get('h')!=='0',s:P.get('q')==='1',y:P.get('y')!=='0',n:P.get('n')!=='0',b:P.get('b')!=='0'};
  var sig=JSON.stringify(no);if(sig!==window.__cs){window.__cs=sig;CS=no.c;O={p:no.p,z:no.z,k:no.k,al:no.al,d:no.d,h24:no.h24,s:no.s,y:no.y,n:no.n,b:no.b};build()}
  var ST=(await api('settings.get'))||{};var s=ST.shortcuts||[];
  CAL=Object.assign({on:true,ws:1,hol:true,wk:false,p:'m',z:1,b:true,s:'l',k:'a',al:'l',m:'f'},ST.cal||{});EV=ST.calev||{};renderCal();
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
  placeCal();
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

/* ================= kalender ================= */
function pk(y,m,d){return y+'-'+(m<9?'0':'')+(m+1)+'-'+(d<10?'0':'')+d}
function tk(dt){return pk(dt.getFullYear(),dt.getMonth(),dt.getDate())}
function parseK(k){var a=k.split('-');return new Date(+a[0],+a[1]-1,+a[2])}
function isoWeek(dt){var t=new Date(Date.UTC(dt.getFullYear(),dt.getMonth(),dt.getDate())),dn=t.getUTCDay()||7;t.setUTCDate(t.getUTCDate()+4-dn);var y0=new Date(Date.UTC(t.getUTCFullYear(),0,1));return Math.ceil(((t-y0)/864e5+1)/7)}
function holOf(y){if(HC[y])return HC[y];var o={},k;for(k in HF)o[k]=[HF[k],'n'];if(HY[y])for(k in HY[y])o[k]=HY[y][k];return HC[y]=o}
function holFor(k){return CAL.hol?(holOf(+k.slice(0,4))[k.slice(5)]||null):null}
function longDate(k){var d=parseK(k);return DL[d.getDay()]+', '+d.getDate()+' '+MN[d.getMonth()]+' '+d.getFullYear()}
function placeCal(){
  var c=document.getElementById('cal'),g=document.getElementById('grid'),ck=document.getElementById('clock');if(!c||!g)return;
  if(CAL.p==='b'){var an=(O.p==='bot'&&CS!=='off')?ck:g;if(c.previousSibling!==an)document.body.insertBefore(c,an.nextSibling)}
  else if(c.nextSibling!==g)document.body.insertBefore(c,g)
}
function evSorted(k){return (EV[k]||[]).slice().sort(function(a,b){return (a.m||'')<(b.m||'')?-1:(a.m||'')>(b.m||'')?1:0})}
function saveEv(){api('settings.set','calev',EV)}
function addEv(){
  var tx=document.getElementById('ctx'),tm=document.getElementById('ctm');if(!tx)return;
  var t=tx.value.trim();if(!t){tx.focus();return}
  var a=(EV[CSEL]||[]).slice();if(a.length>=50)return;
  a.push({i:Math.random().toString(36).slice(2,10),t:t.slice(0,160),m:(tm&&tm.value)||''});
  EV[CSEL]=a;tx.value='';if(tm)tm.value='';saveEv();renderCal();var n=document.getElementById('ctx');if(n)n.focus()
}
function delEv(id){var a=(EV[CSEL]||[]).filter(function(e){return e.i!==id});if(a.length)EV[CSEL]=a;else delete EV[CSEL];saveEv();renderCal()}
function shiftSel(n){var d=parseK(CSEL);d.setDate(d.getDate()+n);CSEL=tk(d);CV={y:d.getFullYear(),m:d.getMonth()}}
function chip(hd){return hd?'<span class="hc'+(hd[1]==='c'?' cu':'')+'">'+esc(hd[0])+'</span>':''}
function upcoming(today,skip){var up=[];Object.keys(EV).forEach(function(d){if(d>=today&&d!==skip)evSorted(d).forEach(function(e){up.push({d:d,e:e})})});up.sort(function(a,b){return a.d<b.d?-1:a.d>b.d?1:((a.e.m||'')<(b.e.m||'')?-1:1)});return up}
function upHTML(today){
  var up=upcoming(today,CSEL),h='';
  if(up.length){h='<div class="up">Mendatang</div>';up.slice(0,3).forEach(function(x){var d=parseK(x.d);h+='<button class="ui" data-a="day" data-d="'+x.d+'"><span class="ud">'+DN[(d.getDay()+6)%7]+', '+d.getDate()+' '+MS[d.getMonth()]+'</span><span class="ux">'+(x.e.m?x.e.m+'  ':'')+esc(x.e.t)+'</span></button>'})}
  return h
}
function agendaHTML(head,today){
  var ev=evSorted(CSEL),h='<div class="ag">';
  if(head)h+='<div class="ah"><b>'+esc(longDate(CSEL))+'</b>'+chip(holFor(CSEL))+'</div>';
  if(ev.length)ev.forEach(function(e){h+='<div class="ei"><span class="et">'+(e.m||'Seharian')+'</span><span class="ex">'+esc(e.t)+'</span><button class="cb" data-a="del" data-i="'+esc(e.i)+'" title="Hapus catatan">'+ICON('trash',15)+'</button></div>'});
  else h+='<div class="em">Belum ada catatan untuk hari ini.</div>';
  h+='<div class="ad"><input class="ci tm" id="ctm" type="time" title="Jam (opsional)"><input class="ci" id="ctx" maxlength="160" placeholder="Tambah catatan…" autocomplete="off" spellcheck="false"><button class="ab" data-a="add" title="Tambah">'+ICON('plus',18)+'</button></div></div>';
  return h+upHTML(today)
}
function dayCell(dt,today,dim){
  var k=tk(dt),hd=holFor(k),ev=(EV[k]||[]).length,sel=k===CSEL&&(CAL.s!=='c'||CAG);
  return '<button class="dc'+(dim?' o':'')+(dt.getDay()===0?' su':'')+(hd?(hd[1]==='n'?' hl':' cu'):'')+(k===today?' tdy':(sel?' sl':''))+'" data-a="day" data-d="'+k+'"'+(hd?' title="'+esc(hd[0])+'"':'')+'>'+dt.getDate()+'<span class="dts">'+(ev?'<i></i>':'')+(ev>1?'<i></i>':'')+(ev>2?'<i></i>':'')+'</span></button>'
}
function gridHTML(start,n,today,month){
  var ord=CAL.ws===1?[0,1,2,3,4,5,6]:[6,0,1,2,3,4,5],h='<div class="gd'+(CAL.wk?' wk':'')+'">'+(CAL.wk?'<div class="dh">#</div>':''),i,dt;
  ord.forEach(function(x){h+='<div class="dh'+(x===6?' su':'')+'">'+DN[x]+'</div>'});
  for(i=0;i<n;i++){
    dt=new Date(start.getFullYear(),start.getMonth(),start.getDate()+i);
    if(CAL.wk&&i%7===0)h+='<div class="wn">'+isoWeek(new Date(dt.getFullYear(),dt.getMonth(),dt.getDate()+(CAL.ws===0?1:0)))+'</div>';
    h+=dayCell(dt,today,month>=0&&dt.getMonth()!==month)
  }
  return h+'</div>'
}
function hdrHTML(today,now){
  var plain=CAL.s==='a',t=CPICK?CV.y:MN[CV.m]+' '+CV.y,mon=CAL.s==='l'||CAL.s==='c';
  var off=mon?(CV.y!==now.getFullYear()||CV.m!==now.getMonth()||CSEL!==today):CSEL!==today;
  var h='<div class="ch">'+(plain?'<span class="ct">'+t+'</span>':'<button class="ct" data-a="pick">'+t+ICON(CPICK?'up':'down',14)+'</button>')+'<div class="cn">';
  if(!CPICK&&off)h+='<button class="cb td" data-a="today">Hari ini</button>';
  return h+'<button class="cb" data-a="prev" title="Sebelumnya">'+ICON('back',18)+'</button><button class="cb" data-a="next" title="Berikutnya">'+ICON('fwd',18)+'</button></div></div>'
}
function renderCal(){
  var c=document.getElementById('cal');if(!c)return;
  c.style.display=CAL.on?'':'none';if(!CAL.on)return;
  placeCal();
  var S=CAL.s,now=new Date(),today=tk(now),i,h='';CDAY=today;
  c.className='cal st-'+S+' al-'+CAL.al+' m-'+CAL.m+(CAL.b?'':' nobg');c.style.setProperty('--cz',[.88,1,1.12][CAL.z]||1);
  var KC={t:['var(--fg)','var(--bg)'],a:['var(--acc,var(--fg))','var(--onacc,var(--bg))'],g:['#f0a030','#111'],b:['#4f8ef7','#fff'],h:['#34c38f','#111']}[CAL.k]||['var(--acc,var(--fg))','var(--onacc,var(--bg))'];
  c.style.setProperty('--ck',KC[0]);c.style.setProperty('--cok',KC[1]);
  if(!CV)CV={y:now.getFullYear(),m:now.getMonth()};if(!CSEL)CSEL=today;
  var oi=document.getElementById('ctx'),keep=oi?{v:oi.value,t:document.getElementById('ctm').value,f:document.activeElement===oi}:null;
  if(S==='b'){
    var tev=evSorted(today),up=upcoming(today,'x').filter(function(x){return x.d>today}),info;
    if(tev.length)info=(tev[0].m?tev[0].m+'  ':'')+tev[0].t+(tev.length>1?'  +'+(tev.length-1):'');
    else if(up.length){var d=parseK(up[0].d);info='Berikutnya: '+DN[(d.getDay()+6)%7]+', '+d.getDate()+' '+MS[d.getMonth()]+' · '+up[0].e.t}
    else info='Tidak ada catatan';
    var td=parseK(today);
    h='<button class="br" data-a="bar"><span class="bd">'+DN[(td.getDay()+6)%7]+', '+td.getDate()+' '+MS[td.getMonth()]+'</span>'+chip(holFor(today))+'<span class="bx">'+esc(info)+'</span>'+ICON(CEXP?'up':'down',14)+'</button>';
    if(CEXP)h+=agendaHTML(true,today)
  }else{
    h=hdrHTML(today,now);
    if(CPICK){
      h+='<div class="mp">';
      for(i=0;i<12;i++)h+='<button data-a="mon" data-m="'+i+'" class="'+(i===CV.m?'sl':'')+(CV.y===now.getFullYear()&&i===now.getMonth()?' tdy':'')+'">'+MN[i].slice(0,3)+'</button>';
      h+='</div>'
    }else if(S==='a'){
      var sd=parseK(CSEL);
      h+='<div class="ga"><div class="gl"><div class="gdn">'+sd.getDate()+'</div><div class="gdw">'+DL[sd.getDay()]+'</div><div class="gdm">'+MN[sd.getMonth()]+' '+sd.getFullYear()+'</div>'+chip(holFor(CSEL))+'</div><div class="gr">'+agendaHTML(false,today)+'</div></div>'
    }else if(S==='w'){
      var sw=parseK(CSEL),lead=CAL.ws===1?(sw.getDay()+6)%7:sw.getDay();
      h+=gridHTML(new Date(sw.getFullYear(),sw.getMonth(),sw.getDate()-lead),7,today,-1)+agendaHTML(true,today)
    }else{
      var fo=new Date(CV.y,CV.m,1),ld=CAL.ws===1?(fo.getDay()+6)%7:fo.getDay();
      h+=gridHTML(new Date(CV.y,CV.m,1-ld),42,today,CV.m);
      if(S==='l'||CAG)h+=agendaHTML(true,today);
    }
  }
  c.innerHTML=h;
  if(keep){var n=document.getElementById('ctx');if(n){n.value=keep.v;document.getElementById('ctm').value=keep.t;if(keep.f)n.focus()}}
}
(function(){
  var c=document.getElementById('cal');
  c.addEventListener('click',function(e){
    var b=e.target.closest('[data-a]');if(!b)return;var a=b.getAttribute('data-a');
    if(a==='add'){addEv();return}
    if(a==='del'){delEv(b.getAttribute('data-i'));return}
    if(a==='prev'||a==='next'){var d=a==='next'?1:-1;if(CPICK)CV.y+=d;else if(CAL.s==='w')shiftSel(7*d);else if(CAL.s==='a')shiftSel(d);else{CV.m+=d;if(CV.m<0){CV.m=11;CV.y--}if(CV.m>11){CV.m=0;CV.y++}}}
    else if(a==='today'){var n=new Date();CV={y:n.getFullYear(),m:n.getMonth()};CSEL=tk(n);CPICK=false}
    else if(a==='pick')CPICK=!CPICK;
    else if(a==='mon'){CV.m=+b.getAttribute('data-m');CPICK=false;if(CAL.s==='w')CSEL=pk(CV.y,CV.m,1)}
    else if(a==='bar'){CEXP=!CEXP;if(CEXP)CSEL=tk(new Date())}
    else if(a==='day'){var k=b.getAttribute('data-d'),dt=parseK(k);if(CAL.s==='c'){if(CSEL===k)CAG=!CAG;else{CSEL=k;CAG=true}}else CSEL=k;CV={y:dt.getFullYear(),m:dt.getMonth()}}
    renderCal()
  });
  c.addEventListener('keydown',function(e){if(e.key==='Enter'&&e.target.id==='ctx'){e.preventDefault();addEv()}});
  // pergantian hari saat tab dibiarkan terbuka
  setInterval(function(){var t=tk(new Date());if(CDAY&&t!==CDAY){var o=parseK(CDAY);if(CV&&CV.y===o.getFullYear()&&CV.m===o.getMonth()){var n=new Date();CV={y:n.getFullYear(),m:n.getMonth()}}if(CSEL===CDAY)CSEL=t;renderCal()}},30000);
})();

document.getElementById('sf').onsubmit=function(e){e.preventDefault();var v=document.getElementById('sq').value.trim();if(v)api('nav.search',v)};
document.getElementById('sq').focus();
