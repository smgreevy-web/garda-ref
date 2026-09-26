/* Garda Reference — My roster: rotating shift pattern with an in-app setup, month calendar,
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
 N:{t:'Night',ico:'🌙',c:'#9d8cff'}, R:{t:'Rest day',ico:'🏠',c:'#5b6b82',off:1}
};
const OVR={
 AL:{t:'Annual leave',ico:'🌴',off:1,c:'#34c768'}, RDW:{t:'Rest day working',ico:'💼',c:'#ff6b6b'}, OT:{t:'Overtime',ico:'⏱️',c:'#ff6b6b'},
 CT:{t:'Court',ico:'⚖️',c:'#ffcf6e'}, TR:{t:'Training',ico:'🎓',c:'#5fd0ff'}, SK:{t:'Sick',ico:'🤒',off:1,c:'#8fa3bf'},
 SW:{t:'Swapped shift',ico:'🔁',c:'#c9a7ff'}, TOIL:{t:'Time off in lieu',ico:'🕑',off:1,c:'#34c768'}, OTHER:{t:'Other',ico:'📌',c:'#9fb0c8'}
};
const PRESETS=[
 {k:'core12',t:'Core unit — 4 on / 4 off',sub:'12-hour tours · Early, Early, Night, Night, then 4 rest days',cycle:'EENNRRRR',times:{E:['07:00','19:00'],N:['19:00','07:00']}},
 {k:'noncore10',t:'6 on / 4 off',sub:'10-hour tours · Early, Early, Late, Late, Night, Night, then 4 rest days',cycle:'EELLNNRRRR',times:{E:['06:00','16:00'],L:['14:00','00:00'],N:['22:00','08:00']}},
 {k:'custom',t:'Build my own pattern',sub:'Any sequence of Early, Day, Late, Night and Rest days',cycle:'',times:{}}
];
const DEF_TIMES={E:['07:00','19:00'],D:['08:00','18:00'],L:['14:00','00:00'],N:['19:00','07:00']};

/* ================= storage ================= */
let R=load();
function load(){try{const d=JSON.parse(localStorage.getItem(LS)||'null');if(d&&d.cycle)return d;}catch(e){}return null;}
function save(){try{localStorage.setItem(LS,JSON.stringify(R));}catch(e){} paintStrips();}

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
  return {d,code,planned:p.code,idx:p.idx,off,from,to,label,ico,color,tag,note:o&&o.note||''};
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
  if(dirty){ const cut=now-7*DAY; Object.keys(R.fired).forEach(k=>{if(R.fired[k]<cut)delete R.fired[k];}); save(); }
}

/* ================= overlay ================= */
let ov=null, main=null, sh=null, view='main', month=null, wiz=null;
function build(){
  if(ov&&ov.isConnected)return;
  ov=D.createElement('div'); ov.id='rst'; ov.hidden=true; ov.setAttribute('role','dialog'); ov.setAttribute('aria-label','My roster');
  ov.innerHTML='<div class="rs-top"><button type="button" class="rs-back">‹ Back</button><div class="rs-tt"><b class="rs-title">My roster</b><span class="hudclock" data-f="line"></span></div><button type="button" class="rs-set" aria-label="Roster settings">⚙</button></div>'
   +'<div class="rs-main"></div><div class="rs-shade" hidden></div><div class="rs-sheet" hidden></div><div class="rs-toast"></div>';
  D.body.appendChild(ov); main=ov.querySelector('.rs-main'); sh=ov.querySelector('.rs-sheet');
  ov.querySelector('.rs-back').onclick=()=>back();
  ov.querySelector('.rs-set').onclick=()=>{ view='wizard'; wiz=null; render(); };
  ov.querySelector('.rs-shade').onclick=()=>closeSheet();
}
function toast(m){ const t=ov.querySelector('.rs-toast'); t.textContent=m; t.classList.add('on'); clearTimeout(t._t); t._t=setTimeout(()=>t.classList.remove('on'),3000); }
function openRoster(){ build(); const bt=D.getElementById('boot'); if(bt&&bt.parentNode)bt.parentNode.removeChild(bt);
  ov.hidden=false; view=R?'main':'wizard'; wiz=null; month=null; closeSheet(); render(); if(W.grHudTick)W.grHudTick(); return true; }
function closeRoster(){ if(!ov)return; closeSheet(); ov.hidden=true; main.innerHTML=''; paintStrips(); }
function back(){ if(!ov||ov.hidden)return false; if(!sh.hidden){closeSheet();return true;}
  if(view==='wizard'&&R){ if(wiz&&wiz.step>1){wiz.step--;render();return true;} view='main'; render(); return true; }
  if(view==='wizard'&&wiz&&wiz.step>1){ wiz.step--; render(); return true; }
  closeRoster(); return true; }
function render(){ if(!ov||ov.hidden)return; ov.querySelector('.rs-set').hidden=view!=='main'; if(view==='wizard')renderWizard(); else renderMain(); if(W.grHudTick)W.grHudTick(); }
function closeSheet(){ if(!sh)return; sh.hidden=true; sh.innerHTML=''; ov.querySelector('.rs-shade').hidden=true; }
function sheet(html,wire){ sh.innerHTML='<div class="rs-grip"></div>'+html; sh.hidden=false; ov.querySelector('.rs-shade').hidden=false; sh.querySelectorAll('.rs-x').forEach(b=>b.onclick=()=>closeSheet()); wire&&wire(sh); }

/* ================= setup wizard ================= */
function renderWizard(){
  ov.querySelector('.rs-title').textContent=R?'Change roster':'Set up my roster';
  if(!wiz){ wiz=R?{step:1,preset:R.preset||'custom',cycle:R.cycle,times:JSON.parse(JSON.stringify(R.times)),unit:R.unit||'',al:R.al!=null?R.al:29.5,remind:R.remind||0,todayIdx:null}
               :{step:1,preset:'core12',cycle:PRESETS[0].cycle,times:JSON.parse(JSON.stringify(PRESETS[0].times)),unit:'',al:29.5,remind:0,todayIdx:null}; }
  const w=wiz; let h='<div class="rs-wrap"><div class="rs-steps">'+[1,2,3].map(i=>'<span class="'+(i===w.step?'on':i<w.step?'done':'')+'">'+i+'</span>').join('<i></i>')+'</div>';
  if(w.step===1){
    h+='<h3 class="rs-h">1 · Your pattern</h3><div class="rs-presets">'+PRESETS.map(p=>'<button type="button" class="rs-pre'+(w.preset===p.k?' on':'')+'" data-pre="'+p.k+'"><b>'+esc(p.t)+'</b><span>'+esc(p.sub)+'</span>'+(p.cycle?'<div class="rs-mini">'+p.cycle.split('').map(c=>'<i style="background:'+TYPES[c].c+'">'+c+'</i>').join('')+'</div>':'')+'</button>').join('')+'</div>';
    h+='<h3 class="rs-h sm">The cycle '+(w.cycle?'<small>('+w.cycle.length+' days)</small>':'')+'</h3><div class="rs-cyc">'+(w.cycle?w.cycle.split('').map((c,i)=>'<button type="button" class="rs-cc" data-rm="'+i+'" style="--c:'+TYPES[c].c+'"><b>'+c+'</b><small>'+(i+1)+'</small></button>').join(''):'<p class="rs-note">Tap the shift buttons below to build your cycle in order, starting from your first shift.</p>')+'</div>'
      +'<div class="rs-add">'+Object.keys(TYPES).map(c=>'<button type="button" class="rs-ad" data-add="'+c+'" style="--c:'+TYPES[c].c+'">+ '+TYPES[c].ico+' '+TYPES[c].t+'</button>').join('')+'<button type="button" class="rs-ad clr" data-clear="1">Clear</button></div>'
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
  if(R&&w.step===1)h+='<button type="button" class="rs-link del w-del">Delete my roster</button>';
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
    R={v:1,preset:w.preset,cycle:w.cycle,times:w.times,unit:w.unit,al:w.al,remind:w.remind,anchorDay:dayNo(today0()),anchorIdx:w.todayIdx,ovr:keepOvr,fired};
    save(); view='main'; wiz=null; month=null; render(); toast('Roster saved'); check();
  };
}
function cycleLabel(cyc,i){ const c=cyc[i]; let n=1; for(let k=i-1;k>=0&&cyc[k]===c;k--)n++; return TYPES[c].t.split(' ')[0]+' '+n; }

/* ================= main view ================= */
function renderMain(){
  ov.querySelector('.rs-title').textContent='My roster'+(R.unit?' · '+R.unit:'');
  const now=Date.now(), st=status(now), t0=today0();
  let h='<div class="rs-wrap">';
  // status hero
  if(st.on){ const i=st.info; h+='<div class="rs-hero" style="--c:'+i.color+'"><div class="rs-k">'+i.ico+' ON DUTY · '+esc(i.label.toUpperCase())+'</div><div class="rs-big" data-cd="e">'+durStr(st.sp.e-now)+'</div><div class="rs-cap">until the end of your tour at <b>'+hm(st.sp.e)+'</b></div><div class="rs-sub">'+esc(hm(st.sp.s)+'–'+hm(st.sp.e))+' · '+esc(cyclePos(i))+(i.note?' · '+esc(i.note):'')+'</div></div>'; }
  else { const td=st.today;
    h+='<div class="rs-hero" style="--c:'+(td?td.color:'#5b6b82')+'"><div class="rs-k">'+(td?td.ico+' TODAY · '+esc(td.label.toUpperCase()):'')+'</div>';
    if(td&&!td.off&&span(td)&&span(td).s>now) h+='<div class="rs-big" data-cd="s">'+durStr(span(td).s-now)+'</div><div class="rs-cap">until your '+esc(td.label.toLowerCase())+' starts at <b>'+hm(span(td).s)+'</b></div>';
    else if(st.next) h+='<div class="rs-big" data-cd="s">'+durStr(st.sp.s-now)+'</div><div class="rs-cap">until your next tour — <b>'+esc(st.next.label)+' '+esc(dname(st.next.d))+' at '+hm(st.sp.s)+'</b></div>';
    h+='<div class="rs-sub">'+(td?esc(cyclePos(td)):'')+(td&&td.note?' · '+esc(td.note):'')+'</div></div>'; }
  // next days
  h+='<h3 class="rs-hd">Next 14 days</h3><div class="rs-days">';
  for(let k=0;k<14;k++){ const i=dayInfo(addDays(t0,k)); h+='<button type="button" class="rs-day'+(k===0?' today':'')+(i.tag?' ov':'')+'" data-day="'+dkey(i.d)+'" style="--c:'+i.color+'"><small>'+(k===0?'Today':k===1?'Tomorrow':esc(DAYS[i.d.getDay()]))+'</small><b>'+i.d.getDate()+'</b><span>'+i.ico+'</span><em>'+esc(i.off?(i.tag?OVR[i.tag].t.split(' ')[0]:'Rest'):i.from+'–'+i.to)+'</em></button>'; }
  h+='</div>';
  // month calendar
  if(!month){ month=new Date(t0.getFullYear(),t0.getMonth(),1); }
  const m0=month, first=(m0.getDay()+6)%7, dim=new Date(m0.getFullYear(),m0.getMonth()+1,0).getDate();
  h+='<div class="rs-mhead"><button type="button" class="rs-mn" data-mv="-1">‹</button><b>'+MONL[m0.getMonth()]+' '+m0.getFullYear()+'</b><button type="button" class="rs-mn" data-mv="1">›</button></div>';
  h+='<div class="rs-cal"><i>Mon</i><i>Tue</i><i>Wed</i><i>Thu</i><i>Fri</i><i>Sat</i><i>Sun</i>';
  for(let k=0;k<first;k++)h+='<span></span>';
  const cnt={}; let al=0;
  for(let dd=1;dd<=dim;dd++){ const d=new Date(m0.getFullYear(),m0.getMonth(),dd), i=dayInfo(d); const isT=dayNo(d)===dayNo(t0);
    const k=i.tag||i.code; cnt[k]=(cnt[k]||0)+1;
    h+='<button type="button" class="rs-c'+(isT?' today':'')+(i.tag?' ov':'')+(i.off?' off':'')+'" data-day="'+dkey(d)+'" style="--c:'+i.color+'"><small>'+dd+'</small><b>'+(i.tag?i.ico:i.code)+'</b></button>'; }
  h+='</div>';
  h+='<div class="rs-legend">'+Object.keys(cnt).map(k=>{const T=TYPES[k]||OVR[k];return '<span style="--c:'+T.c+'"><i></i>'+esc(T.t)+' '+cnt[k]+'</span>';}).join('')+'</div>';
  // leave this year
  const y=t0.getFullYear(); const alUsed=Object.keys(R.ovr||{}).filter(k=>k.startsWith(y+'-')&&R.ovr[k].k==='AL').length;
  h+='<div class="rs-al"><b>🌴 Annual leave '+y+'</b><span>'+alUsed+' day'+(alUsed===1?'':'s')+' booked'+(R.al?' of '+R.al+' · '+(Math.round((R.al-alUsed)*10)/10)+' left':'')+'</span></div>';
  h+='<div class="rs-row2"><button type="button" class="rs-sec" data-a="copy">⧉ Copy month</button><button type="button" class="rs-sec" data-a="today">Today</button></div>';
  h+='<p class="rs-foot">Tap any day to add leave, court, training, overtime, a swap or a note. Saved only on this phone.</p></div>';
  main.innerHTML=h;
  main.querySelectorAll('[data-day]').forEach(b=>b.onclick=()=>daySheet(fromKey(b.dataset.day)));
  main.querySelectorAll('[data-mv]').forEach(b=>b.onclick=()=>{ month=new Date(month.getFullYear(),month.getMonth()+(+b.dataset.mv),1); const st_=main.scrollTop; renderMain(); main.scrollTop=st_; });
  main.querySelector('[data-a="today"]').onclick=()=>{ month=null; renderMain(); };
  main.querySelector('[data-a="copy"]').onclick=()=>copyMonth();
}
function daySheet(d){
  const i=dayInfo(d), p=planned(d), o=ovr(d)||{};
  const opts=Object.keys(OVR).map(k=>'<button type="button" class="rs-ov'+(o.k===k?' on':'')+'" data-ov="'+k+'" style="--c:'+OVR[k].c+'"><span>'+OVR[k].ico+'</span>'+esc(OVR[k].t)+'</button>').join('');
  sheet('<h3>'+esc(DAYL[d.getDay()]+' '+d.getDate()+' '+MONL[d.getMonth()]+' '+d.getFullYear())+'</h3>'
   +'<p class="rs-note">Rostered: <b>'+TYPES[p.code].ico+' '+esc(TYPES[p.code].t)+'</b>'+(TYPES[p.code].off?'':' '+esc((R.times[p.code]||DEF_TIMES[p.code]).join('–')))+' · '+esc(cyclePos({idx:p.idx}))+'</p>'
   +'<div class="rs-ovs">'+opts+'</div>'
   +'<div class="rs-ovx" hidden><label class="rs-lab">Swap to</label><div class="rs-chips">'+Object.keys(TYPES).map(c=>'<button type="button" class="rs-chip'+(o.to===c?' on':'')+'" data-sw="'+c+'">'+TYPES[c].ico+' '+TYPES[c].t+'</button>').join('')+'</div></div>'
   +'<div class="rs-ovt" hidden><label class="rs-lab">Times <small>24-hour, optional</small></label><div class="rs-time"><input class="rs-in" inputmode="numeric" maxlength="5" data-of value="'+esc(o.from||'')+'" placeholder="From"><span>to</span><input class="rs-in" inputmode="numeric" maxlength="5" data-ot value="'+esc(o.to&&!TYPES[o.to]?o.to:'')+'" placeholder="To"></div></div>'
   +'<label class="rs-lab">Note <small>optional</small></label><input class="rs-in wide o-note" maxlength="80" placeholder="e.g. CCJ Court 8, 10:30 · swap with Garda Byrne" value="'+esc(o.note||'')+'">'
   +'<p class="rs-err" hidden></p><div class="rs-row2"><button type="button" class="rs-sec o-clear"'+(o.k||o.note?'':' disabled')+'>Back to rostered</button><button type="button" class="rs-go o-save">Save</button></div>',root=>{
    let sel=o.k||null, sw=o.to&&TYPES[o.to]?o.to:null;
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
(function(){ try{ const q=new URLSearchParams(location.search); if(q.get('open')==='roster'){ history.replaceState(history.state,'',location.pathname);
  const go=()=>openRoster(); if(D.readyState==='loading')D.addEventListener('DOMContentLoaded',()=>setTimeout(go,60)); else setTimeout(go,60); } }catch(e){} })();
setTimeout(check,2000);

W.openRoster=openRoster; W.closeRoster=closeRoster; W.rstBack=back;
W.GRRoster=Object.freeze({open:openRoster,mountStrip,status:n=>R?status(n):null,dayInfo:d=>R?dayInfo(d):null,_state:()=>R,_set:x=>{R=x;save();}});
})();
