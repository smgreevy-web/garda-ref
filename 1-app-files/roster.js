/* Assisting — My roster: rotating shift pattern with an in-app setup, month calendar,
   leave/court/overtime overrides, today/next-shift status and optional shift reminders.
   Saved only on this phone (localStorage 'gr_roster'). Nothing is uploaded. */
(function(){
'use strict';
const W=window, D=document, LS='gr_roster';
const H=3600e3, MIN=60e3, DAY=864e5;
const p2=n=>String(n).padStart(2,'0');
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const DAYS=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'], DAYL=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const MON=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'], MONL=['January','February','March','April','May','June','July','August','September','October','November','December'];
const hm=t=>{const d=new Date(t);return p2(d.getHours())+':'+p2(d.getMinutes());};
const dkey=d=>d.getFullYear()+'-'+p2(d.getMonth()+1)+'-'+p2(d.getDate());
const fromKey=k=>{const [y,m,d]=k.split('-').map(Number);return new Date(y,m-1,d);};
const dayNo=d=>Math.round(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate())/DAY);   // DST-safe calendar day number
const addDays=(d,n)=>{const x=new Date(d.getFullYear(),d.getMonth(),d.getDate()+n);return x;};
const today0=()=>{const n=new Date();return new Date(n.getFullYear(),n.getMonth(),n.getDate());};
const dname=d=>DAYS[d.getDay()]+' '+d.getDate()+' '+MON[d.getMonth()];
function durStr(ms){ms=Math.max(0,ms);const d=Math.floor(ms/DAY),h=Math.floor(ms%DAY/H),m=Math.floor(ms%H/MIN);return d?d+' d '+h+' h':h?h+' h '+p2(m)+' m':m+' min';}
const hmMin=s=>{const m=/^(\d{1,2}):(\d{2})$/.exec(s||'');return m?(+m[1])*60+(+m[2]):null;};
function parseHM(t){const m=/^(\d{1,2}):?(\d{2})$/.exec(String(t||'').trim());if(!m)return null;const h=+m[1],mi=+m[2];return(h>23||mi>59)?null:p2(h)+':'+p2(mi);}
const vib=p=>{try{if(navigator.vibrate)navigator.vibrate(p);}catch(e){}};

/* shift types: code → look */
const TYPES={
 E:{t:'Early',ico:'🌅',c:'#f0b429'}, D:{t:'Day',ico:'☀️',c:'#f0b429'}, L:{t:'Late',ico:'🌇',c:'#ff8a4c'},
 N:{t:'Night',ico:'🌙',c:'#9d8cff'}, R:{t:'Rest day',ico:'🏠',c:'#5b6b82',off:1},
 /* station-roster variants (b = the base type they belong to) */
 E1:{t:'Early',ico:'🌅',c:'#f0b429',b:'E'}, L1:{t:'Late',ico:'🌇',c:'#ff8a4c',b:'L'}, L2:{t:'Late',ico:'🌇',c:'#ff8a4c',b:'L'}, L3:{t:'Late',ico:'🌇',c:'#ff8a4c',b:'L'},
 N1:{t:'Night',ico:'🌙',c:'#9d8cff',b:'N'}, MR:{t:'Rest day',ico:'🏠',c:'#5b6b82',off:1,b:'R'}
};
const BASE=c=>(TYPES[c]&&TYPES[c].b)||c;
/* ---- station rosters: Core contingency, Non-core and DDU for Units A–D. Each repeats in a fixed cycle, so any date can be worked out.
   Checked day-by-day against the Nov 2026 rosters (see roster test). [code, label as shown on the roster] ---- */
const ST=(function(){
  const rp=(s,l)=>s.split('').map(c=>[c,c==='R'?'':l]);
  const MRR=[['MR',''],['R',''],['R',''],['R','']];
  const blk=a=>a.map(x=>x.split(' ')).concat(MRR);
  const dn=k=>{const q=k.split('-');return Math.round(Date.UTC(+q[0],q[1]-1,+q[2])/DAY);};
  const mk=(name,short,cycle,anchor,times,sure)=>{const a={};Object.keys(anchor).forEach(u=>a[u]=dn(anchor[u]));return {name,short,cycle,a,times,sure};};
  return {
   core:mk('Core contingency','Core',rp('EENNRRRR','').map(x=>[x[0],x[0]==='E'?'700':x[0]==='N'?'19':'']),{A:'2026-10-25',B:'2026-10-29',C:'2026-10-27',D:'2026-10-31'},{E:['07:00','19:00'],N:['19:00','07:00']},1),
   noncore:mk('Non-core','Non-core',[].concat(rp('EEELLLRRRR','10'),rp('EEELLLRRRR','10'),rp('EELLRRRR','10')),{A:'2026-11-17',B:'2026-11-10',C:'2026-11-03',D:'2026-11-24'},{E:['06:00','16:00'],L:['14:00','00:00']},0),
   ddu:mk('DDU','DDU',[].concat(blk(['E 700*','E 700*','L2 15','L2 15','L2 15','L1 15*']),blk(['L2 15','L2 15','L1 15','L 12','L3 16','L3 16']),blk(['L 12','L 12','L3 16','L3 16','N 18','N 18']),
     blk(['E 700*','E 700*','N 18','N1 18','L3 16','L3 16']),blk(['E1 10*','E 700*','L 12','L 12','L3 16','N 18']),blk(['E 700*','E 700*','E 700*','E 700*','N1 18*','L3 16']),blk(['E 700*','E1 10','E 700*','E 700*','L 12','L2 15'])),
     {A:'2026-10-27',B:'2026-10-13',C:'2026-09-29',D:'2026-11-24'},{E:['07:00','17:00'],E1:['10:00','20:00'],L:['12:00','22:00'],L1:['15:00','01:00'],L2:['15:00','01:00'],L3:['16:00','02:00'],N:['18:00','04:00'],N1:['18:00','04:00']},0)};
})();
const UNITS=['A','B','C','D'];
function peer(s,u,d){ const S=ST[s], n=S.cycle.length, i=((dayNo(d)-S.a[u])%n+n)%n, c=S.cycle[i]; return {code:c[0],lab:c[1],off:!!TYPES[c[0]].off}; }
function setStation(s,u){ const S=ST[s], same=R&&R.station===s;
  R={v:2,preset:'station',station:s,unitL:u,cycle:S.cycle.map(c=>c[0]),lab:S.cycle.map(c=>c[1]),times:same&&R.times?R.times:JSON.parse(JSON.stringify(S.times)),timesOk:same?!!R.timesOk:!!S.sure,
    unit:'Unit '+u,al:R&&R.al!=null?R.al:29.5,remind:R&&R.remind||0,anchorDay:S.a[u],anchorIdx:0,ovr:R&&R.ovr||{},fired:{},det:R&&R.det||{}};
  save(); check(); }
const OVR={
 AL:{t:'Annual leave',ico:'🌴',off:1,c:'#34c768'}, RDW:{t:'Rest day working',ico:'💼',c:'#ff6b6b'}, OT:{t:'Overtime',ico:'⏱️',c:'#ff6b6b'},
 CT:{t:'Court',ico:'⚖️',c:'#ffcf6e'}, TR:{t:'Training',ico:'🎓',c:'#82b2f2'}, SK:{t:'Sick',ico:'🤒',off:1,c:'#8fa3bf'},
 SW:{t:'Swapped shift',ico:'🔁',c:'#c9a7ff'}, TOIL:{t:'Time off in lieu',ico:'🕑',off:1,c:'#34c768'}, OTHER:{t:'Other',ico:'📌',c:'#8b98aa'}
};
const PRESETS=[
 {k:'core12',t:'Core unit — 4 on / 4 off',sub:'12-hour tours · Early, Early, Night, Night, then 4 rest days',cycle:'EENNRRRR',times:{E:['07:00','19:00'],N:['19:00','07:00']}},
 {k:'noncore10',t:'6 on / 4 off',sub:'10-hour tours · Early, Early, Late, Late, Night, Night, then 4 rest days',cycle:'EELLNNRRRR',times:{E:['06:00','16:00'],L:['14:00','00:00'],N:['22:00','08:00']}},
 {k:'custom',t:'Build my own pattern',sub:'Any sequence of Early, Day, Late, Night and Rest days',cycle:'',times:{}}
];
const DEF_TIMES={E:['07:00','19:00'],D:['08:00','18:00'],L:['14:00','00:00'],N:['19:00','07:00'],E1:['10:00','20:00'],L1:['15:00','01:00'],L2:['15:00','01:00'],L3:['16:00','02:00'],N1:['18:00','04:00']};
// your detail for a working day — what you're on (car, station, files…), whole tour or half and half. Tasks plans your jobs around it.
const DET=[{k:'car',t:'Car',i:'🚓',s:'Patrol car'},{k:'beat',t:'Beat',i:'🚶',s:'Foot patrol'},{k:'station',t:'Station',i:'🏢',s:'Public office · station duty'},
 {k:'files',t:'Files',i:'📁',s:'Files and paperwork'},{k:'court',t:'Court',i:'⚖️',s:'At court'},{k:'event',t:'Event / op',i:'🏟️',s:'Croke Park, checkpoint, operation'},
 {k:'escort',t:'Escort / guard',i:'🚑',s:'Prisoner escort, hospital guard'},{k:'training',t:'Training',i:'🎓',s:'Course or training'},{k:'other',t:'Other',i:'📌',s:'Anything else'}];
const DETK=Object.fromEntries(DET.map(x=>[x.k,x]));

/* ================= storage ================= */
let R=load();
/* an old "4 on / 4 off" roster set up by hand becomes the matching Core unit, keeping its times, leave and notes */
(function(){ try{ if(!R||R.station||R.cycle!=='EENNRRRR')return; const t=dayNo(today0()), mine=((t-R.anchorDay+R.anchorIdx)%8+8)%8;
  const u=UNITS.find(x=>((t-ST.core.a[x])%8+8)%8===mine); if(!u)return;
  R.station='core'; R.unitL=u; R.preset='station'; R.cycle=ST.core.cycle.map(c=>c[0]); R.lab=ST.core.cycle.map(c=>c[1]); R.anchorDay=ST.core.a[u]; R.anchorIdx=0; R.timesOk=true; if(!R.unit)R.unit='Unit '+u;
  localStorage.setItem(LS,JSON.stringify(R)); }catch(e){} })();
function load(){try{const d=JSON.parse(localStorage.getItem(LS)||'null');if(d&&d.cycle)return d;}catch(e){}return null;}
function detail(d){ const x=R&&R.det&&R.det[dkey(d)]; return x&&DETK[x.a]?x:null; }
function setDetail(d,rec){ if(!R)return; R.det=R.det||{}; const k=dkey(d);
  if(rec&&DETK[rec.a])R.det[k]={a:rec.a,b:rec.b&&DETK[rec.b]?rec.b:null,at:rec.b&&parseHM(rec.at||'')?parseHM(rec.at):null,note:String(rec.note||'').slice(0,60)}; else delete R.det[k];
  const cut=dkey(addDays(today0(),-45)); Object.keys(R.det).forEach(x=>{ if(x<cut)delete R.det[x]; }); save(); }
const detIco=x=>x?DETK[x.a].i+(x.b?'½':''):'';
function save(mine){try{localStorage.setItem(LS,JSON.stringify(R));}catch(e){} paintStrips(); if(mine!==false&&W.grTouch)W.grTouch('roster');}

/* ================= roster maths ================= */
function planned(d){ if(!R||!R.cycle)return null; const n=R.cycle.length; const i=((dayNo(d)-R.anchorDay+R.anchorIdx)%n+n)%n; return {code:R.cycle[i],idx:i}; }
function ovr(d){ return (R&&R.ovr&&R.ovr[dkey(d)])||null; }
// what the day actually is: override wins
function dayInfo(d){
  const p=planned(d); if(!p)return null; const o=ovr(d);
  let code=p.code, from=null, to=null, label=TYPES[code].t, off=!!TYPES[code].off, ico=TYPES[code].ico, color=TYPES[code].c, tag=null;
  if(!off){ const tm=R.times[code]||DEF_TIMES[code]; from=tm[0]; to=tm[1]; }
  if(o){ const O=OVR[o.k]||OVR.OTHER; tag=o.k; ico=O.ico; color=O.c;
    if(o.k==='SW'&&o.to){ code=o.to; label=TYPES[o.to].t+' (swapped)'; off=!!TYPES[o.to].off; from=off?null:(R.times[o.to]||DEF_TIMES[o.to])[0]; to=off?null:(R.times[o.to]||DEF_TIMES[o.to])[1]; ico=TYPES[o.to].ico; }
    else if(O.off){ label=O.t; off=true; from=to=null; }
    else { label=O.t+(off?' (on a rest day)':''); off=false; if(o.from&&o.to){from=o.from;to=o.to;} else if(!from){from='09:00';to='17:00';} }
  }
  return {d,code,planned:p.code,idx:p.idx,off,from,to,label,ico,color,tag,note:o&&o.note||'',lab:(R.lab&&R.lab[p.idx])||''};
}
function span(info){ // start/end timestamps of a working day's tour (a tour ending at/after midnight ends the next day)
  if(!info||info.off||!info.from)return null; const a=hmMin(info.from), b=hmMin(info.to), d=info.d;
  const s=new Date(d.getFullYear(),d.getMonth(),d.getDate(),Math.floor(a/60),a%60).getTime();
  const e=new Date(d.getFullYear(),d.getMonth(),d.getDate()+(b<=a?1:0),Math.floor(b/60),b%60).getTime();
  return {s,e};
}
function status(now){
  now=now||Date.now(); const t0=today0(), y=addDays(t0,-1);
  for(const d of [y,t0]){ const i=dayInfo(d), sp=span(i); if(sp&&now>=sp.s&&now<sp.e)return {on:true,info:i,sp}; }
  // next working tour
  for(let k=0;k<60;k++){ const d=addDays(t0,k), i=dayInfo(d), sp=span(i); if(sp&&sp.s>now)return {on:false,next:i,sp,today:dayInfo(t0)}; }
  return {on:false,today:dayInfo(t0)};
}
function cyclePos(info){ // "day 2 of 4 on" / "rest day 3 of 4"
  if(!R)return ''; const c=R.cycle; const i=info.idx; const ch=c[i];
  let a=i; while(a>0&&(TYPES[c[a-1]].off?1:0)===(TYPES[ch].off?1:0))a--; let b=i; while(b<c.length-1&&(TYPES[c[b+1]].off?1:0)===(TYPES[ch].off?1:0))b++;
  return TYPES[ch].off?'rest day '+(i-a+1)+' of '+(b-a+1):'day '+(i-a+1)+' of '+(b-a+1)+' on';
}

/* ================= reminders (best effort, like the other modules) ================= */
const permOK=()=>('Notification' in W)&&Notification.permission==='granted';
let regP=null;
function reg(){ if(!('serviceWorker' in navigator))return Promise.resolve(null);
  if(!regP)regP=Promise.race([navigator.serviceWorker.ready,new Promise(r=>setTimeout(()=>r(null),2500))]).then(r=>{if(!r)regP=null;return r;}).catch(()=>{regP=null;return null;});
  return regP; }
async function notify(title,opt){ if(!permOK())return; const o=Object.assign({icon:'icons/icon-192.png',badge:'icons/badge.png',lang:'en-IE'},opt);
  try{const r=await reg(); if(r&&r.showNotification){await r.showNotification(title,o);return;}}catch(e){} try{new Notification(title,o);}catch(e){} }
function check(){
  if(!R||!R.remind||!permOK())return; const now=Date.now(); R.fired=R.fired||{}; let dirty=false;
  for(let k=0;k<3;k++){ const i=dayInfo(addDays(today0(),k)), sp=span(i); if(!sp)continue;
    const at=sp.s-(R.remind*MIN), key=dkey(i.d)+':'+sp.s;
    if(now>=at&&now<sp.s&&!R.fired[key]){ R.fired[key]=now; dirty=true;
      notify(i.ico+' '+i.label+' at '+hm(sp.s),{body:dname(i.d)+' · '+hm(sp.s)+'–'+hm(sp.e)+(i.note?' · '+i.note:'')+(R.unit?' · '+R.unit:''),tag:'gr-roster',renotify:true,vibrate:[150,80,150],data:{open:'roster'}}); } }
  if(dirty){ const cut=now-7*DAY; Object.keys(R.fired).forEach(k=>{if(R.fired[k]<cut)delete R.fired[k];}); save(false); }
}

/* ================= overlay ================= */
let ov=null, main=null, sh=null, view='main', month=null, wiz=null, yearMode=false, vS=null, vU=null;
function build(){
  if(ov&&ov.isConnected)return;
  ov=D.createElement('div'); ov.id='rst'; ov.hidden=true; ov.setAttribute('role','dialog'); ov.setAttribute('aria-label','My roster');
  ov.innerHTML='<div class="rs-top"><button type="button" class="rs-back">‹ Back</button><div class="rs-tt"><b class="rs-title">My roster</b><span class="hudclock" data-f="line"></span></div><button type="button" class="rs-set" aria-label="Roster settings">⚙</button></div>'
   +'<div class="rs-main"></div><div class="rs-shade" hidden></div><div class="rs-sheet" hidden></div><div class="rs-toast"></div>';
  D.body.appendChild(ov); main=ov.querySelector('.rs-main'); sh=ov.querySelector('.rs-sheet');
  ov.querySelector('.rs-back').onclick=()=>back();
  ov.querySelector('.rs-set').onclick=()=>settingsSheet();
  ov.querySelector('.rs-shade').onclick=()=>closeSheet();
}
function toast(m){ const t=ov.querySelector('.rs-toast'); t.textContent=m; t.classList.add('on'); clearTimeout(t._t); t._t=setTimeout(()=>t.classList.remove('on'),3000); }
function openRoster(){ build(); const bt=D.getElementById('boot'); if(bt&&bt.parentNode)bt.parentNode.removeChild(bt);
  ov.hidden=false; view='main'; wiz=null; month=null; yearMode=false; vS=null; vU=null; closeSheet(); render(); if(W.grHudTick)W.grHudTick(); return true; }
function closeRoster(){ if(!ov)return; closeSheet(); ov.hidden=true; main.innerHTML=''; paintStrips(); }
function back(){ if(!ov||ov.hidden)return false; if(!sh.hidden){closeSheet();return true;}
  if(view==='wizard'&&R){ if(wiz&&wiz.step>1){wiz.step--;render();return true;} view='main'; render(); return true; }
  if(view==='wizard'){ if(wiz&&wiz.step>1){ wiz.step--; render(); return true; } view='main'; wiz=null; render(); return true; }
  if(yearMode){ yearMode=false; render(); return true; }
  closeRoster(); return true; }
function render(){ if(!ov||ov.hidden)return; ov.querySelector('.rs-set').hidden=view!=='main'||!R; if(view==='wizard')renderWizard(); else renderMain(); if(W.grHudTick)W.grHudTick(); }
function closeSheet(){ if(!sh)return; sh.hidden=true; sh.innerHTML=''; ov.querySelector('.rs-shade').hidden=true; }
function sheet(html,wire){ sh.innerHTML='<div class="rs-grip"></div>'+html; sh.hidden=false; ov.querySelector('.rs-shade').hidden=false; sh.querySelectorAll('.rs-x').forEach(b=>b.onclick=()=>closeSheet()); wire&&wire(sh); }

/* ================= setup wizard ================= */
function renderWizard(){
  ov.querySelector('.rs-title').textContent='Build my own pattern';
  if(!wiz){ wiz=R&&typeof R.cycle==='string'?{step:1,preset:R.preset||'custom',cycle:R.cycle,times:JSON.parse(JSON.stringify(R.times)),unit:R.unit||'',al:R.al!=null?R.al:29.5,remind:R.remind||0,todayIdx:null}
               :{step:1,preset:'custom',cycle:'',times:{},unit:'',al:R&&R.al!=null?R.al:29.5,remind:R&&R.remind||0,todayIdx:null}; }
  const w=wiz; let h='<div class="rs-wrap"><div class="rs-steps">'+[1,2,3].map(i=>'<span class="'+(i===w.step?'on':i<w.step?'done':'')+'">'+i+'</span>').join('<i></i>')+'</div>';
  if(w.step===1){
    h+='<h3 class="rs-h">1 · Your pattern</h3><div class="rs-presets">'+PRESETS.map(p=>'<button type="button" class="rs-pre'+(w.preset===p.k?' on':'')+'" data-pre="'+p.k+'"><b>'+esc(p.t)+'</b><span>'+esc(p.sub)+'</span>'+(p.cycle?'<div class="rs-mini">'+p.cycle.split('').map(c=>'<i style="background:'+TYPES[c].c+'">'+c+'</i>').join('')+'</div>':'')+'</button>').join('')+'</div>';
    h+='<h3 class="rs-h sm">The cycle '+(w.cycle?'<small>('+w.cycle.length+' days)</small>':'')+'</h3><div class="rs-cyc">'+(w.cycle?w.cycle.split('').map((c,i)=>'<button type="button" class="rs-cc" data-rm="'+i+'" style="--c:'+TYPES[c].c+'"><b>'+c+'</b><small>'+(i+1)+'</small></button>').join(''):'<p class="rs-note">Tap the shift buttons below to build your cycle in order, starting from your first shift.</p>')+'</div>'
      +'<div class="rs-add">'+Object.keys(TYPES).filter(c=>!TYPES[c].b).map(c=>'<button type="button" class="rs-ad" data-add="'+c+'" style="--c:'+TYPES[c].c+'">+ '+TYPES[c].ico+' '+TYPES[c].t+'</button>').join('')+'<button type="button" class="rs-ad clr" data-clear="1">Clear</button></div>'
      +'<p class="rs-note">Tap a day in the cycle to remove it.</p>';
  } else if(w.step===2){
    const used=[...new Set(w.cycle.split(''))].filter(c=>!TYPES[c].off);
    h+='<h3 class="rs-h">2 · Tour times <small>24-hour</small></h3>'+used.map(c=>{const tm=w.times[c]||DEF_TIMES[c];return '<div class="rs-time"><span class="rs-tico" style="--c:'+TYPES[c].c+'">'+TYPES[c].ico+'</span><b>'+TYPES[c].t+'</b><input class="rs-in" inputmode="numeric" maxlength="5" data-tf="'+c+'" value="'+tm[0]+'"><span>to</span><input class="rs-in" inputmode="numeric" maxlength="5" data-tt="'+c+'" value="'+tm[1]+'"></div>';}).join('')
      +'<p class="rs-note">Times are your station’s — change them if your unit starts earlier or later. A tour that ends after midnight (a night) is counted on the day it starts.</p>'
      +'<h3 class="rs-h sm">Unit <small>optional</small></h3><input class="rs-in wide f-unit" maxlength="40" placeholder="e.g. Unit C · Mountjoy" value="'+esc(w.unit)+'">'
      +'<h3 class="rs-h sm">Annual leave allowance <small>days per year</small></h3><input class="rs-in f-al" inputmode="decimal" maxlength="5" value="'+esc(String(w.al))+'">'
      +'<h3 class="rs-h sm">Shift reminder</h3><div class="rs-chips">'+[[0,'Off'],[60,'1 h before'],[120,'2 h before'],[720,'12 h before']].map(([m,l])=>'<button type="button" class="rs-chip'+(w.remind===m?' on':'')+'" data-rem="'+m+'">'+l+'</button>').join('')+'</div>';
  } else {
    h+='<h3 class="rs-h">3 · What are you on today?</h3><p class="rs-note">Today is <b>'+esc(DAYL[new Date().getDay()]+' '+new Date().getDate()+' '+MONL[new Date().getMonth()])+'</b>. Tap the day of your cycle that today is.</p>'
      +'<div class="rs-cyc big">'+w.cycle.split('').map((c,i)=>'<button type="button" class="rs-cc'+(w.todayIdx===i?' sel':'')+'" data-today="'+i+'" style="--c:'+TYPES[c].c+'"><b>'+c+'</b><small>'+esc(cycleLabel(w.cycle,i))+'</small></button>').join('')+'</div>';
    if(w.todayIdx!=null){ const tmp={cycle:w.cycle,anchorDay:dayNo(today0()),anchorIdx:w.todayIdx,times:w.times,ovr:{}}; const keep=R; R=tmp;
      h+='<h3 class="rs-h sm">Next 8 days</h3><div class="rs-prev">'+[0,1,2,3,4,5,6,7].map(k=>{const i=dayInfo(addDays(today0(),k));return '<div style="--c:'+i.color+'"><small>'+esc(DAYS[i.d.getDay()]+' '+i.d.getDate())+'</small><b>'+i.code+'</b></div>';}).join('')+'</div>'; R=keep; }
  }
  h+='<p class="rs-err" hidden></p><div class="rs-row2">'+(w.step>1?'<button type="button" class="rs-sec w-prev">‹ Back</button>':R?'<button type="button" class="rs-sec w-cancel">Cancel</button>':'<span></span>')
    +'<button type="button" class="rs-go w-next">'+(w.step<3?'Next ›':'Save roster')+'</button></div>';
  
  h+='<p class="rs-foot">Saved only on this phone.</p></div>';
  main.innerHTML=h; main.scrollTop=0;
  const err=m=>{const e=main.querySelector('.rs-err');e.textContent=m;e.hidden=!m;};
  main.querySelectorAll('[data-pre]').forEach(b=>b.onclick=()=>{const p=PRESETS.find(x=>x.k===b.dataset.pre); w.preset=p.k; if(p.cycle){w.cycle=p.cycle; w.times=JSON.parse(JSON.stringify(p.times));} else w.cycle=''; w.todayIdx=null; renderWizard();});
  main.querySelectorAll('[data-add]').forEach(b=>b.onclick=()=>{ if(w.cycle.length>=42)return err('A cycle can have up to 42 days.'); w.cycle+=b.dataset.add; w.preset='custom'; w.todayIdx=null; renderWizard(); });
  main.querySelectorAll('[data-rm]').forEach(b=>b.onclick=()=>{ const i=+b.dataset.rm; w.cycle=w.cycle.slice(0,i)+w.cycle.slice(i+1); w.preset='custom'; w.todayIdx=null; renderWizard(); });
  const cl=main.querySelector('[data-clear]'); if(cl)cl.onclick=()=>{w.cycle='';w.preset='custom';renderWizard();};
  main.querySelectorAll('[data-today]').forEach(b=>b.onclick=()=>{w.todayIdx=+b.dataset.today; renderWizard();});
  main.querySelectorAll('[data-rem]').forEach(b=>b.onclick=async()=>{ w.remind=+b.dataset.rem; main.querySelectorAll('[data-rem]').forEach(x=>x.classList.toggle('on',x===b));
    if(w.remind&&('Notification' in W)&&Notification.permission==='default'){try{await Notification.requestPermission();}catch(e){}} });
  main.querySelectorAll('.rs-time input').forEach(i=>i.addEventListener('input',()=>{const dg=i.value.replace(/\D/g,'').slice(0,4);const v=dg.length>2?dg.slice(0,2)+':'+dg.slice(2):dg;if(v!==i.value)i.value=v;}));
  const readStep2=()=>{ let ok=true; main.querySelectorAll('[data-tf]').forEach(i=>{const c=i.dataset.tf, a=parseHM(i.value), b=parseHM(main.querySelector('[data-tt="'+c+'"]').value); if(!a||!b||a===b){ok=false;return;} w.times[c]=[a,b];});
    const u=main.querySelector('.f-unit'); if(u)w.unit=u.value.trim(); const al=main.querySelector('.f-al'); if(al){const v=parseFloat(al.value.replace(',','.')); w.al=isNaN(v)?29.5:v;} return ok; };
  const pv=main.querySelector('.w-prev'); if(pv)pv.onclick=()=>{ if(w.step===2)readStep2(); w.step--; renderWizard(); };
  const cc=main.querySelector('.w-cancel'); if(cc)cc.onclick=()=>{ view='main'; wiz=null; render(); };
  const dl=main.querySelector('.w-del'); if(dl)dl.onclick=()=>{ if(dl.dataset.sure!=='1'){dl.dataset.sure='1';dl.textContent='Tap again to delete your roster and all leave/overrides';return;} R=null; try{localStorage.removeItem(LS);}catch(e){} wiz=null; toast('Roster deleted'); render(); paintStrips(); };
  main.querySelector('.w-next').onclick=()=>{
    if(w.step===1){ if(w.cycle.length<2)return err('Build a cycle of at least 2 days.'); if(!/[EDLN]/.test(w.cycle))return err('Add at least one working tour.'); w.step=2; renderWizard(); return; }
    if(w.step===2){ if(!readStep2())return err('Enter every tour as two different 24-hour times, e.g. 07:00 to 19:00.'); w.step=3; renderWizard(); return; }
    if(w.todayIdx==null)return err('Tap which day of your cycle today is.');
    const keepOvr=R&&R.ovr||{}, fired=R&&R.fired||{};
    const keepDet=R&&R.det||{};
    R={v:1,preset:w.preset,cycle:w.cycle,times:w.times,timesOk:true,unit:w.unit,al:w.al,remind:w.remind,anchorDay:dayNo(today0()),anchorIdx:w.todayIdx,ovr:keepOvr,fired,det:keepDet};
    save(); view='main'; wiz=null; month=null; render(); toast('Roster saved'); check();
  };
}
function cycleLabel(cyc,i){ const c=cyc[i]; let n=1; for(let k=i-1;k>=0&&cyc[k]===c;k--)n++; return TYPES[c].t.split(' ')[0]+' '+n; }

/* ================= main view ================= */
// tasks due on (or planned for a tour on) a day — from Tasks, when it's loaded
function tasksOn(d){ try{ return W.GRTasks&&W.GRTasks.forDay?W.GRTasks.forDay(d):[]; }catch(e){ return []; } }
const RNG=[2025*12,2028*12+11];   // Jan 2025 … Dec 2028
function clampMonth(m){ const t=Math.min(RNG[1],Math.max(RNG[0],m.getFullYear()*12+m.getMonth())); return new Date(Math.floor(t/12),t%12,1); }
function renderMain(){
  const t0=today0(), now=Date.now();
  ov.querySelector('.rs-title').textContent='Roster'+(R&&R.unit?' · '+R.unit:'');
  const mineS=R?(R.station||'own'):null;
  if(!vS){ vS=mineS||'core'; vU=R&&R.unitL||'C'; }
  const stn=vS!=='own', isMine=!!R&&vS===mineS&&(!stn||vU===R.unitL);
  // what a day is on the roster being looked at
  const cellOf=d=>{ if(isMine){ const i=dayInfo(d); return {code:i.planned,lab:i.lab,off:!!TYPES[i.planned].off,info:i}; } return peer(vS,vU,d); };
  let h='<div class="rs-wrap rp">';
  // which roster
  h+='<div class="rp-seg">'+Object.keys(ST).map(k=>'<button type="button" data-st="'+k+'" class="'+(vS===k?'on':'')+'">'+ST[k].short+'</button>').join('')+(mineS==='own'?'<button type="button" data-st="own" class="'+(vS==='own'?'on':'')+'">My own</button>':'')+'</div>';
  if(stn) h+='<div class="rp-units">'+UNITS.map(u=>{ const q=peer(vS,u,t0), me=R&&R.station===vS&&R.unitL===u; return '<button type="button" data-un="'+u+'" class="'+(vU===u?'on':'')+'">Unit '+u+'<small>'+(me?'my unit':TYPES[q.code].t.split(' ')[0])+'</small></button>'; }).join('')+'</div>';
  if(!R) h+='<div class="rp-pick"><b>Pick your roster and unit</b><span>Then tap the button. You can change it any time.</span><button type="button" class="rs-go" data-a="mine">Set '+esc(ST[vS].name)+' · Unit '+vU+' as my roster</button><button type="button" class="rs-link" data-a="own">My roster isn’t here — build my own pattern</button></div>';
  else if(!isMine) h+='<div class="rp-pick slim"><span>You’re looking at '+esc(ST[vS].name)+' · Unit '+vU+'. Yours is '+esc(R.station?ST[R.station].name+' · Unit '+R.unitL:'your own pattern')+'.</span><div class="rs-row2"><button type="button" class="rs-sec" data-a="back">Back to mine</button><button type="button" class="rs-go" data-a="mine">Make this mine</button></div></div>';
  // status hero (mine)
  if(R&&isMine){ const st=status(now);
    if(st.on){ const i=st.info; h+='<div class="rs-hero rp-hero"><div class="rp-big rp-'+BASE(i.planned)+'">'+esc(i.tag?i.ico:i.planned)+'<small>'+esc(i.lab||'')+'</small></div><div><div class="rs-k">ON DUTY · '+esc(i.label.toUpperCase())+'</div><div class="rs-big" data-cd="e">'+durStr(st.sp.e-now)+'</div><div class="rs-cap">until the end of your tour at <b>'+hm(st.sp.e)+'</b></div><div class="rs-sub">'+esc(hm(st.sp.s)+'–'+hm(st.sp.e))+' · '+esc(cyclePos(i))+(i.note?' · '+esc(i.note):'')+'</div></div></div>'; }
    else { const td=st.today;
      h+='<div class="rs-hero rp-hero"><div class="rp-big rp-'+(td?BASE(td.planned):'R')+'">'+esc(td?(td.tag?td.ico:td.planned):'—')+'<small>'+esc(td&&td.lab||'')+'</small></div><div><div class="rs-k">'+(td?'TODAY · '+esc(td.label.toUpperCase()):'')+'</div>';
      if(td&&!td.off&&span(td)&&span(td).s>now) h+='<div class="rs-big" data-cd="s">'+durStr(span(td).s-now)+'</div><div class="rs-cap">until your '+esc(td.label.toLowerCase())+' starts at <b>'+hm(span(td).s)+'</b></div>';
      else if(st.next) h+='<div class="rs-big" data-cd="s">'+durStr(st.sp.s-now)+'</div><div class="rs-cap">until your next tour — <b>'+esc(st.next.label)+' '+esc(dname(st.next.d))+' at '+hm(st.sp.s)+'</b></div>';
      h+='<div class="rs-sub">'+(td?esc(cyclePos(td)):'')+(td&&td.note?' · '+esc(td.note):'')+'</div></div></div>'; }
    if(R.station&&!R.timesOk) h+='<button type="button" class="rp-warn" data-a="times">Tour times for '+esc(ST[R.station].name)+' are estimates. Tap to check yours.</button>'; }
  // today, all units
  if(stn) h+='<h3 class="rp-h">Today, all units</h3><div class="rp-across">'+UNITS.map(u=>{ const q=peer(vS,u,t0); return '<div class="'+(vU===u?'on':'')+'"><small>Unit '+u+'</small><b class="rp-'+BASE(q.code)+'">'+q.code+'</b><small>'+TYPES[q.code].t.split(' ')[0]+'</small></div>'; }).join('')+'</div>';
  // month / year
  if(!month) month=new Date(t0.getFullYear(),t0.getMonth(),1);
  month=clampMonth(month); const m0=month, y=m0.getFullYear();
  h+='<div class="rp-nav"><button type="button" class="rp-ib" data-mv="-1" aria-label="Earlier">‹</button><b>'+(yearMode?y:MONL[m0.getMonth()]+' '+y)+'</b><button type="button" class="rp-chip" data-a="today">Today</button><button type="button" class="rp-chip" data-a="year">'+(yearMode?'Month':'Year')+'</button><button type="button" class="rp-ib" data-mv="1" aria-label="Later">›</button></div>';
  const cnt={E:0,D:0,L:0,N:0,R:0}; const ovc={};
  if(yearMode){ h+='<div class="rp-year">';
    for(let m=0;m<12;m++){ const f=(new Date(y,m,1).getDay()+6)%7, dim=new Date(y,m+1,0).getDate(); h+='<button type="button" class="rp-mini" data-mo="'+m+'"><b>'+MON[m]+'</b><div>';
      for(let k=0;k<f;k++)h+='<i class="x"></i>';
      for(let dd=1;dd<=dim;dd++){ const d=new Date(y,m,dd), c=cellOf(d), bs=BASE(c.code); cnt[bs]++; h+='<i class="rp-'+bs+(dayNo(d)===dayNo(t0)?' today':'')+(c.info&&c.info.tag?' ov':'')+'"></i>'; }
      h+='</div></button>'; }
    h+='</div>'; }
  else { const first=(m0.getDay()+6)%7, dim=new Date(y,m0.getMonth()+1,0).getDate(), cells=Math.ceil((first+dim)/7)*7;
    h+='<div class="rp-card rp-cal"><div class="rp-dow">'+['M','T','W','T','F','S','S'].map(x=>'<span>'+x+'</span>').join('')+'</div><div class="rp-grid">';
    for(let k=0;k<cells;k++){ const d=new Date(y,m0.getMonth(),k-first+1), inM=d.getMonth()===m0.getMonth(), c=cellOf(d), bs=BASE(c.code), i=c.info;
      if(inM){ cnt[bs]++; if(i&&i.tag)ovc[i.tag]=(ovc[i.tag]||0)+1; }
      h+='<button type="button" class="rp-day rp-'+bs+(dayNo(d)===dayNo(t0)?' today':'')+(inM?'':' out')+(i&&i.tag?' ov':'')+'" data-day="'+dkey(d)+'"'+(i&&i.tag?' style="--oc:'+i.color+'"':'')+'><small>'+d.getDate()+'</small><b>'+(i&&i.tag?i.ico:c.code)+'</b><em>'+esc(c.lab||'')+'</em>'+(isMine&&tasksOn(d).length?'<i class="rs-td" aria-label="Tasks"></i>':'')+'</button>'; }
    h+='</div></div>'; }
  h+='<h3 class="rp-h">'+(yearMode?y:MONL[m0.getMonth()])+' totals</h3><div class="rp-stats">'+[['E','Earlies'],['L','Lates'],['N','Nights'],['R','Rest days']].map(x=>'<div><b class="rp-'+x[0]+'">'+(cnt[x[0]]+(x[0]==='E'?cnt.D:0))+'</b><small>'+x[1]+'</small></div>').join('')+'</div>';
  if(Object.keys(ovc).length) h+='<div class="rs-legend">'+Object.keys(ovc).map(k=>'<span style="--c:'+OVR[k].c+'"><i></i>'+esc(OVR[k].t)+' '+ovc[k]+'</span>').join('')+'</div>';
  if(R&&isMine){ const ty=t0.getFullYear(), alUsed=Object.keys(R.ovr||{}).filter(k=>k.startsWith(ty+'-')&&R.ovr[k].k==='AL').length;
    h+='<div class="rs-al"><b>🌴 Annual leave '+ty+'</b><span>'+alUsed+' day'+(alUsed===1?'':'s')+' booked'+(R.al?' of '+R.al+' · '+(Math.round((R.al-alUsed)*10)/10)+' left':'')+'</span></div>';
    if(!yearMode) h+='<div class="rs-row2"><button type="button" class="rs-sec" data-a="copy">⧉ Copy month</button><button type="button" class="rs-sec" data-a="set">⚙ Settings</button></div>'; }
  h+='<div class="rp-legend"><span><i class="rp-E"></i>Early</span><span><i class="rp-L"></i>Late</span><span><i class="rp-N"></i>Night</span><span><i class="rp-R"></i>Rest (MR = rest)</span></div>';
  h+='<p class="rs-foot">'+(stn?'Worked out from the November 2026 roster patterns, for January 2025 to December 2028. Always check against the official roster. ':'')+(R&&isMine?'Tap a day to add leave, court, training, overtime, a swap or a note. ':'')+'Saved only on this phone.</p></div>';
  main.innerHTML=h;
  const keepY=fn=>{ const y_=main.scrollTop; fn(); renderMain(); main.scrollTop=y_; };
  main.querySelectorAll('[data-st]').forEach(b=>b.onclick=()=>keepY(()=>{ vS=b.dataset.st; if(vS!=='own'&&R&&R.station===vS)vU=R.unitL; }));
  main.querySelectorAll('[data-un]').forEach(b=>b.onclick=()=>keepY(()=>{ vU=b.dataset.un; }));
  main.querySelectorAll('[data-day]').forEach(b=>b.onclick=()=>{ const d=fromKey(b.dataset.day); if(isMine)daySheet(d); else peerSheet(d); });
  main.querySelectorAll('[data-mv]').forEach(b=>b.onclick=()=>keepY(()=>{ month=clampMonth(new Date(month.getFullYear()+(yearMode?+b.dataset.mv:0),month.getMonth()+(yearMode?0:+b.dataset.mv),1)); }));
  main.querySelectorAll('[data-mo]').forEach(b=>b.onclick=()=>{ month=new Date(y,+b.dataset.mo,1); yearMode=false; renderMain(); });
  const act=(a,fn)=>main.querySelectorAll('[data-a="'+a+'"]').forEach(b=>b.onclick=fn);
  act('today',()=>{ month=null; renderMain(); });
  act('year',()=>keepY(()=>{ yearMode=!yearMode; }));
  act('copy',()=>copyMonth());
  act('set',()=>settingsSheet());
  act('times',()=>settingsSheet());
  act('back',()=>{ vS=null; renderMain(); });
  act('own',()=>{ view='wizard'; wiz=null; render(); });
  act('mine',()=>{ const had=!!R; setStation(vS,vU); render(); toast(ST[vS].name+' · Unit '+vU+' is now your roster'+(had?'':' — tap ⚙ to set reminders')); });
  // swipe the calendar to change month / year
  const cal=main.querySelector('.rp-cal,.rp-year'); if(cal){ let sx=null,sy=0;
    cal.addEventListener('touchstart',e=>{ sx=e.touches[0].clientX; sy=e.touches[0].clientY; },{passive:true});
    cal.addEventListener('touchend',e=>{ if(sx==null)return; const dx=e.changedTouches[0].clientX-sx, dy=e.changedTouches[0].clientY-sy; sx=null;
      if(Math.abs(dx)>60&&Math.abs(dx)>Math.abs(dy)*1.5){ const b=main.querySelector('[data-mv="'+(dx<0?1:-1)+'"]'); if(b)b.click(); } },{passive:true}); }
}
function peerSheet(d){
  sheet('<h3>'+esc(DAYL[d.getDay()]+' '+d.getDate()+' '+MONL[d.getMonth()]+' '+d.getFullYear())+'</h3><p class="rs-note">'+esc(ST[vS].name)+'</p>'
   +'<div class="rp-across">'+UNITS.map(u=>{ const q=peer(vS,u,d); return '<div class="'+(vU===u?'on':'')+'"><small>Unit '+u+'</small><b class="rp-'+BASE(q.code)+'">'+q.code+'</b><small>'+esc(q.lab||TYPES[q.code].t.split(' ')[0])+'</small></div>'; }).join('')+'</div>'
   +'<button type="button" class="rs-sec wide rs-x">Close</button>');
}
function settingsSheet(){
  if(!R)return; const used=[...new Set(Array.from(R.cycle))].filter(c=>!TYPES[c].off);
  sheet('<h3>Roster settings</h3>'
   +'<label class="rs-lab">Tour times <small>24-hour'+(R.station&&!R.timesOk?' · estimates — check yours':'')+'</small></label>'
   +used.map(c=>{const tm=R.times[c]||DEF_TIMES[c];return '<div class="rs-time"><b class="rp-code rp-'+BASE(c)+'">'+c+'</b><input class="rs-in" inputmode="numeric" maxlength="5" data-tf="'+c+'" value="'+tm[0]+'"><span>to</span><input class="rs-in" inputmode="numeric" maxlength="5" data-tt="'+c+'" value="'+tm[1]+'"></div>';}).join('')
   +'<label class="rs-lab">Shift reminder</label><div class="rs-chips">'+[[0,'Off'],[60,'1 h before'],[120,'2 h before'],[720,'12 h before']].map(([m,l])=>'<button type="button" class="rs-chip'+((R.remind||0)===m?' on':'')+'" data-rem="'+m+'">'+l+'</button>').join('')+'</div>'
   +'<label class="rs-lab">Annual leave allowance <small>days per year</small></label><input class="rs-in f-al" inputmode="decimal" maxlength="5" value="'+esc(String(R.al!=null?R.al:29.5))+'">'
   +'<p class="rs-err" hidden></p><div class="rs-row2"><button type="button" class="rs-sec rs-x">Cancel</button><button type="button" class="rs-go s-save">Save</button></div>'
   +'<button type="button" class="rs-link s-own">Build my own pattern instead</button><button type="button" class="rs-link del s-del">Delete my roster</button>',root=>{
    let rem=R.remind||0;
    root.querySelectorAll('.rs-time input').forEach(i=>i.addEventListener('input',()=>{const dg=i.value.replace(/\D/g,'').slice(0,4);const v=dg.length>2?dg.slice(0,2)+':'+dg.slice(2):dg;if(v!==i.value)i.value=v;}));
    root.querySelectorAll('[data-rem]').forEach(b=>b.onclick=async()=>{ rem=+b.dataset.rem; root.querySelectorAll('[data-rem]').forEach(x=>x.classList.toggle('on',x===b));
      if(rem&&('Notification' in W)&&Notification.permission==='default'){try{await Notification.requestPermission();}catch(e){}} });
    root.querySelector('.s-save').onclick=()=>{ const e=m=>{const x=root.querySelector('.rs-err');x.textContent=m;x.hidden=!m;}; const tm={}; let ok=true;
      root.querySelectorAll('[data-tf]').forEach(i=>{const c=i.dataset.tf, a=parseHM(i.value), b=parseHM(root.querySelector('[data-tt="'+c+'"]').value); if(!a||!b||a===b){ok=false;return;} tm[c]=[a,b];});
      if(!ok)return e('Enter every tour as two different 24-hour times, e.g. 07:00 to 19:00.');
      const v=parseFloat(root.querySelector('.f-al').value.replace(',','.'));
      R.times=Object.assign({},R.times,tm); R.timesOk=true; R.remind=rem; R.al=isNaN(v)?29.5:v; save(); closeSheet(); renderMain(); toast('Saved'); check(); };
    root.querySelector('.s-own').onclick=()=>{ closeSheet(); view='wizard'; wiz=null; render(); };
    const dl=root.querySelector('.s-del'); dl.onclick=()=>{ if(dl.dataset.sure!=='1'){dl.dataset.sure='1';dl.textContent='Tap again to delete your roster and all leave and notes';return;} R=null; try{localStorage.removeItem(LS);}catch(e){} closeSheet(); vS=null; toast('Roster deleted'); render(); paintStrips(); };
  });
}
function daySheet(d){
  const i=dayInfo(d), p=planned(d), o=ovr(d)||{};
  const opts=Object.keys(OVR).map(k=>'<button type="button" class="rs-ov'+(o.k===k?' on':'')+'" data-ov="'+k+'" style="--c:'+OVR[k].c+'"><span>'+OVR[k].ico+'</span>'+esc(OVR[k].t)+'</button>').join('');
  sheet('<h3>'+esc(DAYL[d.getDay()]+' '+d.getDate()+' '+MONL[d.getMonth()]+' '+d.getFullYear())+'</h3>'
   +'<p class="rs-note">Rostered: <b>'+TYPES[p.code].ico+' '+esc(TYPES[p.code].t)+(TYPES[p.code].b&&!TYPES[p.code].off?' ('+p.code+')':'')+'</b>'+(TYPES[p.code].off?'':' '+esc((R.times[p.code]||DEF_TIMES[p.code]).join('–')))+' · '+esc(cyclePos({idx:p.idx}))+'</p>'
   +(R.station?'<p class="rs-note rp-peers">'+UNITS.map(u=>{const q=peer(R.station,u,d);return '<span class="'+(u===R.unitL?'me':'')+'">Unit '+u+' <b class="rp-'+BASE(q.code)+'">'+q.code+'</b></span>';}).join('')+'</p>':'')
   +'<div class="rs-ovs">'+opts+'</div>'
   +'<div class="rs-ovx" hidden><label class="rs-lab">Swap to</label><div class="rs-chips">'+Object.keys(TYPES).filter(c=>!TYPES[c].b).map(c=>'<button type="button" class="rs-chip'+(o.to===c?' on':'')+'" data-sw="'+c+'">'+TYPES[c].ico+' '+TYPES[c].t+'</button>').join('')+'</div></div>'
   +'<div class="rs-ovt" hidden><label class="rs-lab">Times <small>24-hour, optional</small></label><div class="rs-time"><input class="rs-in" inputmode="numeric" maxlength="5" data-of value="'+esc(o.from||'')+'" placeholder="From"><span>to</span><input class="rs-in" inputmode="numeric" maxlength="5" data-ot value="'+esc(o.to&&!TYPES[o.to]?o.to:'')+'" placeholder="To"></div></div>'
   +(i.off?'':(x=>'<label class="rs-lab">Your detail <small>'+(x&&x.b?'half and half — change it in Tasks':'optional')+'</small></label><div class="rs-chips rs-dets">'+DET.map(D_=>'<button type="button" class="rs-chip'+(x&&x.a===D_.k&&!x.b?' on':'')+'" data-det="'+D_.k+'">'+D_.i+' '+esc(D_.t)+'</button>').join('')+'</div>'
      +(W.GRTasks&&W.GRTasks.days?'<button type="button" class="rs-sec wide o-plan">🗓 Plan my days — half days and job suggestions</button>':''))(detail(d)))
   +((L=>'<label class="rs-lab">Tasks '+(L.length?'<small>'+L.length+' for this day</small>':'<small>none yet</small>')+'</label>'
      +(L.length?'<div class="rs-tasks">'+L.map(x=>'<button type="button" class="rs-tk" data-tk="'+esc(x.id)+'"><span class="rs-tki ty-'+esc(x.ty)+'"><svg viewBox="0 0 24 24" aria-hidden="true">'+x.ic+'</svg></span><span class="rs-tkt"><b>'+esc(x.title)+'</b><small>'+esc(x.label+(x.tour?' · this tour':x.due?' · '+hm(x.due):''))+'</small></span>'+(x.urgent?'<em>URGENT</em>':'')+'</button>').join('')+'</div>':'')
      +'<button type="button" class="rs-sec wide o-task">＋ Task for this day</button>')(tasksOn(d)))
   +'<label class="rs-lab">Note <small>optional</small></label><input class="rs-in wide o-note" maxlength="80" placeholder="e.g. CCJ Court 8, 10:30 · swap with Garda Byrne" value="'+esc(o.note||'')+'">'
   +'<p class="rs-err" hidden></p><div class="rs-row2"><button type="button" class="rs-sec o-clear"'+(o.k||o.note?'':' disabled')+'>Back to rostered</button><button type="button" class="rs-go o-save">Save</button></div>',root=>{
    let sel=o.k||null, sw=o.to&&TYPES[o.to]?o.to:null;
    root.querySelectorAll('[data-tk]').forEach(b=>b.onclick=()=>{ closeSheet(); closeRoster(); if(W.GRTasks)W.GRTasks.open(b.dataset.tk); });
    root.querySelectorAll('[data-det]').forEach(b=>b.onclick=()=>{ const x=detail(d), on=x&&x.a===b.dataset.det&&!x.b; setDetail(d,on?null:{a:b.dataset.det,note:x&&x.note});
      root.querySelectorAll('[data-det]').forEach(y=>y.classList.toggle('on',!on&&y===b)); renderMain(); toast(on?'Detail cleared':'Detail: '+DETK[b.dataset.det].t); });
    const op=root.querySelector('.o-plan'); if(op)op.onclick=()=>{ closeSheet(); closeRoster(); W.GRTasks.days(dkey(d)); };
    const ot=root.querySelector('.o-task'); if(ot)ot.onclick=()=>{ closeSheet(); closeRoster(); if(W.GRTasks&&W.GRTasks.newOn)W.GRTasks.newOn(d); };
    const sync=()=>{ root.querySelector('.rs-ovx').hidden=sel!=='SW'; root.querySelector('.rs-ovt').hidden=!(sel&&!OVR[sel].off&&sel!=='SW'); };
    root.querySelectorAll('[data-ov]').forEach(b=>b.onclick=()=>{ sel=sel===b.dataset.ov?null:b.dataset.ov; root.querySelectorAll('[data-ov]').forEach(x=>x.classList.toggle('on',x.dataset.ov===sel)); sync(); });
    root.querySelectorAll('[data-sw]').forEach(b=>b.onclick=()=>{ sw=b.dataset.sw; root.querySelectorAll('[data-sw]').forEach(x=>x.classList.toggle('on',x===b)); });
    root.querySelectorAll('.rs-ovt input').forEach(i=>i.addEventListener('input',()=>{const dg=i.value.replace(/\D/g,'').slice(0,4);const v=dg.length>2?dg.slice(0,2)+':'+dg.slice(2):dg;if(v!==i.value)i.value=v;}));
    sync();
    root.querySelector('.o-clear').onclick=()=>{ if(R.ovr)delete R.ovr[dkey(d)]; save(); closeSheet(); renderMain(); toast('Back to the rostered tour'); };
    root.querySelector('.o-save').onclick=()=>{
      const note=root.querySelector('.o-note').value.trim(); const e=m=>{const x=root.querySelector('.rs-err');x.textContent=m;x.hidden=!m;};
      if(!sel&&!note){ closeSheet(); return; }
      const rec={k:sel||'OTHER',note};
      if(sel==='SW'){ if(!sw)return e('Pick the tour you swapped to.'); rec.to=sw; }
      else if(sel&&!OVR[sel].off){ const f=root.querySelector('[data-of]').value, t=root.querySelector('[data-ot]').value; if(f||t){ const a=parseHM(f), b=parseHM(t); if(!a||!b||a===b)return e('Enter both times as 24-hour times, e.g. 08:00 to 16:00.'); rec.from=a; rec.to=b; } }
      if(!sel){ rec.k='OTHER'; }
      R.ovr=R.ovr||{}; R.ovr[dkey(d)]=rec; save(); closeSheet(); renderMain(); toast('Saved'); };
  });
}
function copyMonth(){
  const m0=month||new Date(today0().getFullYear(),today0().getMonth(),1), dim=new Date(m0.getFullYear(),m0.getMonth()+1,0).getDate();
  const L=['ROSTER — '+MONL[m0.getMonth()]+' '+m0.getFullYear()+(R.unit?' · '+R.unit:''),''];
  for(let dd=1;dd<=dim;dd++){ const i=dayInfo(new Date(m0.getFullYear(),m0.getMonth(),dd)); L.push(p2(dd)+' '+DAYS[i.d.getDay()]+'  '+i.label+(i.off?'':' '+i.from+'–'+i.to)+(i.note?' — '+i.note:'')); }
  const txt=L.join('\n');
  (navigator.clipboard&&navigator.clipboard.writeText?navigator.clipboard.writeText(txt):Promise.reject()).then(()=>toast('Month copied')).catch(()=>{
    sheet('<h3>Roster</h3><textarea class="rs-in wide rs-ta" readonly>'+esc(txt)+'</textarea><button type="button" class="rs-sec wide rs-x">Close</button>'); });
}

/* ================= home strip ================= */
let strips=[];
function mountStrip(el){ if(!el)return; strips=strips.filter(x=>x.isConnected); if(!strips.includes(el))strips.push(el); paintStrip(el); }
function paintStrips(){ strips=strips.filter(x=>x.isConnected); strips.forEach(paintStrip); }
function paintStrip(el){
  if(!R){ if(el.innerHTML)el.innerHTML=''; el._h=''; return; }
  const now=Date.now(), st=status(now); let h;
  if(st.on){ const i=st.info; h='<button type="button" class="rs-strip" style="--c:'+i.color+'"><span class="rsx-i">'+i.ico+'</span><span class="rsx-t"><b>On '+esc(i.label.toLowerCase())+' until '+hm(st.sp.e)+'</b><small>'+esc(durStr(st.sp.e-now))+' left · '+esc(cyclePos(i))+'</small></span><span class="rsx-k">ROSTER</span></button>'; }
  else { const td=st.today, nx=st.next; h='<button type="button" class="rs-strip" style="--c:'+(td?td.color:'#5b6b82')+'"><span class="rsx-i">'+(td?td.ico:'🗓')+'</span><span class="rsx-t"><b>Today: '+esc(td?td.label:'—')+(td&&!td.off?' '+td.from+'–'+td.to:'')+'</b><small>'+(nx?'Next: '+esc(nx.label)+' '+esc(dname(nx.d))+' '+hm(st.sp.s)+' · in '+esc(durStr(st.sp.s-now)):'')+'</small></span><span class="rsx-k">ROSTER</span></button>'; }
  if(el._h===h)return; el._h=h; el.innerHTML=h; el.querySelector('.rs-strip').onclick=()=>openRoster();
}

/* ================= ticker ================= */
setInterval(()=>{ paintStrips(); check();
  if(ov&&!ov.hidden&&view==='main'&&sh.hidden){ const b=main.querySelector('[data-cd]'); if(b){ const st=status(); const t=st.on?st.sp.e:(st.today&&!st.today.off&&span(st.today)&&span(st.today).s>Date.now()?span(st.today).s:st.sp&&st.sp.s); if(t)b.textContent=durStr(t-Date.now()); } }
},20000);
D.addEventListener('visibilitychange',()=>{ if(D.visibilityState==='visible'){ paintStrips(); check(); } });
if('serviceWorker' in navigator){ navigator.serviceWorker.addEventListener('message',e=>{const m=e.data||{}; if(m.gr==='notif'&&m.data&&m.data.open==='roster')openRoster();}); }
(function(){ try{ const q=new URLSearchParams((window.__entry||location).search); if(q.get('open')==='roster'){ history.replaceState(history.state,'',location.pathname);
  const go=()=>openRoster(); if(D.readyState==='loading')D.addEventListener('DOMContentLoaded',()=>setTimeout(go,60)); else setTimeout(go,60); } }catch(e){} })();
setTimeout(check,2000);

W.openRoster=openRoster; W.closeRoster=closeRoster; W.rstBack=back;
W.GRRoster=Object.freeze({ST,peer,setStation,units:UNITS,base:BASE,types:TYPES,open:openRoster,mountStrip,status:n=>R?status(n):null,dayInfo:d=>R?dayInfo(d):null,DET,detail:d=>R?detail(d):null,setDetail,_state:()=>R,_set:x=>{R=x;save();},_reload:()=>{ R=load(); paintStrips(); if(ov&&!ov.hidden&&typeof render==='function')render(); }});
})();
