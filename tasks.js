/* Assisting — Tasks: a to-do scheduler for the job.
   Types with their own icons (CCTV camera, statement paper, moon for nights…), time windows (business hours,
   early morning, lunchtime, nights…), deadlines with reminders, an urgent flag, and helpers for CCTV overwrite
   dates and the 6-month summary time limit. Saved only on this phone (localStorage). Nothing is uploaded. */
(function(){
'use strict';
const W=window, D=document;
const LS='gr_tasks', LSP='gr_tasks_prefs';
const H=3600e3, MIN=60e3, DAY=24*H;
const p2=n=>String(n).padStart(2,'0');
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const DAYS=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'], MON=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const hm=t=>{const d=new Date(t);return p2(d.getHours())+':'+p2(d.getMinutes());};
const day=t=>{const d=new Date(t);return DAYS[d.getDay()]+' '+d.getDate()+' '+MON[d.getMonth()];};
const full=t=>{const d=new Date(t);return hm(t)+' '+DAYS[d.getDay()]+' '+p2(d.getDate())+'/'+p2(d.getMonth()+1)+'/'+d.getFullYear();};
const dateOnly=t=>{const d=new Date(t);return DAYS[d.getDay()]+' '+d.getDate()+' '+MON[d.getMonth()]+' '+d.getFullYear();};
const sod=t=>{const d=new Date(t);d.setHours(0,0,0,0);return d.getTime();};
function durStr(ms){ms=Math.abs(ms);const d=Math.floor(ms/DAY),h=Math.floor(ms%DAY/H),m=Math.round(ms%H/MIN);
  return d?d+' d'+(h?' '+h+' h':''):h?h+' h'+(m?' '+p2(m)+' m':''):m+' min';}
function rel(t,now){ // "today 17:00" / "tomorrow 09:00" / "Mon 29 Sep 09:00"
  const dd=Math.round((sod(t)-sod(now))/DAY);
  return (dd===0?'today':dd===1?'tomorrow':dd===-1?'yesterday':day(t))+' '+hm(t);
}
const uid=()=>'t'+Date.now().toString(36)+Math.random().toString(36).slice(2,6);
const vib=p=>{try{if(navigator.vibrate)navigator.vibrate(p);}catch(e){}};
const svg=(p,c)=>'<svg viewBox="0 0 24 24" aria-hidden="true"'+(c?' class="'+c+'"':'')+'>'+p+'</svg>';

/* ================= icons ================= */
const IC={
 cctv:'<path d="M3 8h3l2-3h8l2 3h3v11H3z"/><circle cx="12" cy="13" r="4"/>',
 statement:'<path d="M6 3h9l4 4v14H6z"/><path d="M15 3v4h4"/><path d="M9 11h7M9 14h7M9 17h4"/>',
 night:'<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
 call:'<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/>',
 visit:'<path d="M3 11 12 4l9 7"/><path d="M5 10v11h14V10"/><path d="M10 21v-6h4v6"/>',
 court:'<path d="M12 3v18M7 21h10M4 7h16"/><path d="M4 7l-2.5 6a2.5 2.5 0 0 0 5 0zM20 7l-2.5 6a2.5 2.5 0 0 0 5 0z"/>',
 file:'<path d="M3 6h6l2 2h10v11H3z"/><path d="M3 11h18"/>',
 exhibit:'<path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.5" cy="8.5" r="1.5"/>',
 email:'<path d="M3 6h18v12H3z"/><path d="m3 7 9 7 9-7"/>',
 limit:'<path d="M6 3h12M6 21h12M7 3c0 5 5 6 5 9 0-3 5-4 5-9M7 21c0-5 5-6 5-9 0 3 5 4 5 9"/>',
 arrest:'<circle cx="6.5" cy="15.5" r="4"/><circle cx="17.5" cy="15.5" r="4"/><path d="M9.6 12.9 11 11h2l1.4 1.9"/><path d="M6.5 11.5V9M17.5 11.5V9M5 9h3M16 9h3"/>',
 scan:'<path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3"/><path d="M8 9h8M8 12h8M8 15h5"/>',
 other:'<path d="M10 6h10M10 12h10M10 18h10"/><path d="m3.5 6 1.5 1.5L8 4.5M3.5 12l1.5 1.5L8 10.5M3.5 18l1.5 1.5L8 16.5"/>',
 flag:'<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
 any:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
 business:'<path d="M3 8h18v11H3z"/><path d="M8 8V5h8v3"/><path d="M3 13h18"/>',
 early:'<path d="M3 18h18M7 18a5 5 0 0 1 10 0"/><path d="M12 5v4M5.6 9.6l2 2M18.4 9.6l-2 2"/>',
 lunch:'<path d="M8 3v18M6 3v5a2 2 0 0 0 4 0V3M16 21V3c2 1 3.5 4 3.5 8H16"/>',
 evening:'<path d="M3 18h18M7 18a5 5 0 0 1 10 0"/><path d="M12 5v5M9.5 8 12 10.5 14.5 8"/>',
 custom:'<path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/>',
 check:'<path d="m5 12.5 4.5 4.5L19 7.5"/>', bell:'<path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z"/><path d="M10 20a2 2 0 0 0 4 0"/>',
 copy:'<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V4H4v12h4"/>', trash:'<path d="M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14"/>',
 plus:'<path d="M12 5v14M5 12h14"/>'
};
const TYPES=[
 {k:'cctv',t:'CCTV',tip:'View, collect or preserve footage'},
 {k:'statement',t:'Statement',tip:'Take or finish a statement'},
 {k:'arrest',t:'Arrest',tip:'Arrest to make — named suspect, warrant, person wanted'},
 {k:'night',t:'Night shift',tip:'Something to do on nights',win:'night'},
 {k:'call',t:'Phone call',tip:'Ring back / follow up'},
 {k:'visit',t:'Call to house',tip:'House call / enquiries at an address'},
 {k:'court',t:'Court',tip:'Court date, summons, warrant'},
 {k:'file',t:'File / PULSE',tip:'Update PULSE, prepare a file'},
 {k:'exhibit',t:'Exhibit',tip:'Lodge, send to the lab, return property'},
 {k:'email',t:'Email / letter',tip:'Request, reply, agency letter'},
 {k:'limit',t:'Time limit',tip:'Summons deadline for a summary offence'},
 {k:'other',t:'Other',tip:'Anything else'}
];
const TY=Object.fromEntries(TYPES.map(x=>[x.k,x]));
const WINS=[
 {k:'any',t:'Any time'},
 {k:'business',t:'Business hours',from:'09:00',to:'17:30',days:'weekdays',tip:'Shops, offices, agencies'},
 {k:'early',t:'Early morning',from:'06:00',to:'09:00',tip:'Catch people at home before work'},
 {k:'lunch',t:'Lunchtime',from:'12:00',to:'14:00'},
 {k:'evening',t:'Evening',from:'17:00',to:'21:00',tip:'People home from work'},
 {k:'night',t:'Night shift',from:'22:00',to:'07:00'},
 {k:'custom',t:'Custom'}
];
const WN=Object.fromEntries(WINS.map(x=>[x.k,x]));
const DAYSET={all:'Every day',weekdays:'Mon–Fri',weekend:'Sat–Sun'};
const REMS=[[0,'At the time'],[15,'15 min before'],[60,'1 hour before'],[DAY/MIN,'1 day before'],[7*DAY/MIN,'1 week before'],[30*DAY/MIN,'1 month before']];

/* ================= storage ================= */
let DB=load();
function load(){try{const d=JSON.parse(localStorage.getItem(LS)||'null');if(d&&Array.isArray(d.tasks))return d;}catch(e){}return {v:1,tasks:[]};}
function persist(){try{localStorage.setItem(LS,JSON.stringify(DB));}catch(e){}}
function save(){persist();paintStrips();}
function prefs(){try{return JSON.parse(localStorage.getItem(LSP)||'{}')||{};}catch(e){return {};}}
function setPref(k,v){const p=prefs();p[k]=v;try{localStorage.setItem(LSP,JSON.stringify(p));}catch(e){}}
function purge(){const now=Date.now(),n=DB.tasks.length;DB.tasks=DB.tasks.filter(t=>!t.done||now-t.done<30*DAY);if(n!==DB.tasks.length)persist();}
purge();
const byId=id=>DB.tasks.find(t=>t.id===id);
const open_=()=>DB.tasks.filter(t=>!t.done);

/* ================= time windows ================= */
const hmMin=s=>{const m=/^(\d{1,2}):(\d{2})$/.exec(s||'');return m?(+m[1])*60+(+m[2]):null;};
function winOf(t){ const w=WN[t.win||'any']||WN.any; if(w.k==='any')return null;
  const from=w.k==='custom'?t.wFrom:w.from, to=w.k==='custom'?t.wTo:w.to; const a=hmMin(from),b=hmMin(to);
  if(a==null||b==null||a===b)return null; return {a,b,days:t.wDays||w.days||'all',label:(w.k==='custom'?'':w.t+' ')+from+'–'+to}; }
const dayOK=(days,dow)=>days==='weekdays'?(dow>=1&&dow<=5):days==='weekend'?(dow===0||dow===6):true;
// is time `now` inside the window?  Overnight windows (22:00–07:00) belong to the day they start.
function inWin(w,now){ const d=new Date(now), m=d.getHours()*60+d.getMinutes(), dow=d.getDay();
  if(w.a<w.b)return m>=w.a&&m<w.b&&dayOK(w.days,dow);
  if(m>=w.a)return dayOK(w.days,dow);
  if(m<w.b)return dayOK(w.days,(dow+6)%7);
  return false; }
function nextOpen(w,now){ // start of the next window after now
  const base=new Date(now); base.setSeconds(0,0);
  for(let i=0;i<9;i++){ const d=new Date(base); d.setDate(base.getDate()+i); d.setHours(Math.floor(w.a/60),w.a%60,0,0);
    if(d.getTime()>now&&dayOK(w.days,d.getDay()))return d.getTime(); }
  return null; }
function winState(t,now){ const w=winOf(t); if(!w)return {any:true,open:true};
  const o=inWin(w,now); return {w,open:o,next:o?null:nextOpen(w,now)}; }

/* ================= helpers: CCTV + time limits ================= */
function addMonths(ms,n){ const d=new Date(ms), dd=d.getDate(); const r=new Date(d); r.setDate(1); r.setMonth(r.getMonth()+n);
  const last=new Date(r.getFullYear(),r.getMonth()+1,0).getDate(); r.setDate(Math.min(dd,last)); return r.getTime(); }
// 6 months "from" the offence: the last safe day is the day before the same date 6 months on (counted cautiously)
// Irish public holidays (+ Good Friday, when court offices close) — so a "last safe day" never lands on a day the office is shut
function easter(y){ const a=y%19,b=Math.floor(y/100),c=y%100,d=Math.floor(b/4),e=b%4,f=Math.floor((b+8)/25),g=Math.floor((b-f+1)/3),h=(19*a+b-d-g+15)%30,i=Math.floor(c/4),k=c%4,l=(32+2*e+2*i-h-k)%7,m=Math.floor((a+11*h+22*l)/451),mo=Math.floor((h+l-7*m+114)/31),da=((h+l-7*m+114)%31)+1; return new Date(y,mo-1,da); }
function firstMon(y,m){ const d=new Date(y,m,1); d.setDate(1+((8-d.getDay())%7)); return d; }
function lastMon(y,m){ const d=new Date(y,m+1,0); d.setDate(d.getDate()-((d.getDay()+6)%7)); return d; }
const _hol={};
function holidays(y){ if(_hol[y])return _hol[y]; const L=[], add=d=>L.push(d.toDateString()), fixed=(m,d)=>{ const x=new Date(y,m,d); add(x); if(x.getDay()===6||x.getDay()===0){ const n=new Date(x); n.setDate(n.getDate()+(x.getDay()===6?2:1)); while(L.includes(n.toDateString()))n.setDate(n.getDate()+1); add(n); } };
  fixed(0,1); const b1=new Date(y,1,1); add(b1.getDay()===5?b1:firstMon(y,1)); fixed(2,17);
  const e=easter(y), gf=new Date(e), em=new Date(e); gf.setDate(e.getDate()-2); em.setDate(e.getDate()+1); add(gf); add(em);
  add(firstMon(y,4)); add(firstMon(y,5)); add(firstMon(y,7)); add(lastMon(y,9)); fixed(11,25); fixed(11,26);
  return (_hol[y]=L); }
const workDay=d=>d.getDay()!==0&&d.getDay()!==6&&!holidays(d.getFullYear()).includes(d.toDateString());
function limitEnd(offence,months){ const e=addMonths(sod(offence),months); const d=new Date(e); d.setDate(d.getDate()-1); d.setHours(12,0,0,0); while(!workDay(d))d.setDate(d.getDate()-1); return d.getTime(); }
function cctvOverwrite(c){ return c&&c.inc&&c.keep?c.inc+c.keep*DAY:null; }

/* ================= reminders ================= */
const permOK=()=>('Notification' in W)&&Notification.permission==='granted';
let regP=null;
function reg(){ if(!('serviceWorker' in navigator))return Promise.resolve(null);
  if(!regP)regP=Promise.race([navigator.serviceWorker.ready,new Promise(r=>setTimeout(()=>r(null),2500))]).then(r=>{if(!r)regP=null;return r;}).catch(()=>{regP=null;return null;});
  return regP; }
async function notify(title,opt){ if(!permOK())return false;
  const o=Object.assign({icon:'icons/icon-192.png',badge:'icons/badge.png',lang:'en-IE'},opt);
  try{const r=await reg(); if(r&&r.showNotification){await r.showNotification(title,o);return true;}}catch(e){}
  try{new Notification(title,o);return true;}catch(e){} return false; }
function dueTimes(t){ // [key, when, label]
  const out=[];
  if(t.due){ (t.rem||[]).forEach(m=>{ out.push(['d'+m+':'+t.due, t.due-m*MIN, 'due']); }); }
  return out; }
function check(){
  if(!permOK())return;
  const now=Date.now(); let dirty=false;
  for(const t of open_()){ t.fired=t.fired||{};
    const w=t.remWin?winOf(t):null;
    if(w){ if(!t.nextWin){t.nextWin=nextOpen(w,now);dirty=true;}
      else if(now>=t.nextWin){ const at=t.nextWin; t.nextWin=nextOpen(w,now); dirty=true;
        if(now-at<=12*H)notify((t.urgent?'🚩 ':'')+TY[t.type||'other'].t+': '+(t.title||'Task'),{
          body:'Window open now — '+w.label.trim()+(now-at>5*MIN?' (reminder was delayed — phone asleep)':'')+(t.due?' · due '+rel(t.due,now):'')+(t.notes?' · '+t.notes.slice(0,80):''),
          tag:'gr-task-'+t.id,renotify:true,vibrate:[120,80,120],data:{open:'task',id:t.id}}); } }
    const due=dueTimes(t).filter(([k,at])=>!t.fired[k]&&at<=now);
    if(due.length){ due.forEach(([k])=>{t.fired[k]=now;}); dirty=true;
      const [k,at]=due.reduce((a,b)=>b[1]>a[1]?b:a);
      if(now-at>12*H||at<(t.updated||t.created||0)-MIN)continue;   // long missed, or already past when saved — the list shows it
      const late=now-at>5*MIN;
      notify((t.urgent?'🚩 ':'')+TY[t.type||'other'].t+': '+(t.title||'Task'),{
        body:(t.due<=now+MIN?(t.due<now-MIN?'Overdue since '+rel(t.due,now):'Due now'):'Due '+rel(t.due,now))+(late?' (reminder was delayed — phone asleep)':'')+(t.notes?' · '+t.notes.slice(0,80):''),
        tag:'gr-task-'+t.id,renotify:true,vibrate:t.urgent?[250,120,250,120,250]:[200,100,200],data:{open:'task',id:t.id},timestamp:t.due||at});
    }
  }
  if(dirty)persist();
}
async function enableReminders(){
  if(!('Notification' in W)){toast('This browser can’t show notifications');return false;}
  let p=Notification.permission; if(p==='default'){try{p=await Notification.requestPermission();}catch(e){}}
  if(p!=='granted'){toast('Notifications are blocked — allow them in Android Settings → Apps → Chrome → Notifications');return false;}
  toast('Reminders on'); return true;
}

/* ================= overlay shell ================= */
let ov=null, main=null, sh=null, view='list', curId=null, tab=null, draft=null;
function build(){
  if(ov&&ov.isConnected)return;
  ov=D.createElement('div'); ov.id='tsk'; ov.hidden=true; ov.setAttribute('role','dialog'); ov.setAttribute('aria-label','Tasks');
  ov.innerHTML='<div class="tk-top"><button type="button" class="tk-back">‹ Back</button><div class="tk-tt"><b class="tk-title">Tasks</b><span class="hudclock" data-f="line"></span></div><button type="button" class="tk-scan" aria-label="Photograph a to-do list">'+svg(IC.scan)+'</button><button type="button" class="tk-copy" aria-label="Copy the list">'+svg(IC.copy)+'</button></div>'
    +'<div class="tk-main"></div><button type="button" class="tk-fab" aria-label="New task">'+svg(IC.plus)+'</button><div class="tk-shade" hidden></div><div class="tk-sheet" hidden></div><div class="tk-toast"></div>';
  D.body.appendChild(ov); main=ov.querySelector('.tk-main'); sh=ov.querySelector('.tk-sheet');
  ov.querySelector('.tk-back').onclick=()=>back();
  ov.querySelector('.tk-copy').onclick=()=>copyList();
  ov.querySelector('.tk-scan').onclick=()=>startScan();
  ov.querySelector('.tk-fab').onclick=()=>editTask(null);
  ov.querySelector('.tk-shade').onclick=()=>closeSheet();
}
function toast(m){ if(!ov){if(W.grToast)W.grToast(m);return;} const t=ov.querySelector('.tk-toast'); t.innerHTML=m; t.classList.add('on'); clearTimeout(t._t); t._t=setTimeout(()=>t.classList.remove('on'),3400); }
function openTasks(id){
  build(); purge();
  const bt=D.getElementById('boot'); if(bt&&bt.parentNode)bt.parentNode.removeChild(bt);
  ov.hidden=false; D.body.classList.add('tsk-open'); closeSheet();
  if(id&&byId(id))editTask(id); else {view='list';render();}
  if(W.grHudTick)W.grHudTick(); check(); return true;
}
function closeTasks(){ if(!ov)return; closeSheet(); ov.hidden=true; D.body.classList.remove('tsk-open'); main.innerHTML=''; draft=null; paintStrips(); }
function back(){
  if(!ov||ov.hidden)return false;
  if(!sh.hidden){closeSheet();return true;}
  if(view==='edit'){ view='list'; draft=null; render(); return true; }
  if(view==='scan'){ if(scan&&(scan.mode==='type'||scan.mode==='key')){ scan.mode='choose'; scan.err=''; render(); return true; } scan=null; view='list'; render(); return true; }
  closeTasks(); return true;
}
function render(){ if(!ov||ov.hidden)return; if(view==='edit')renderEdit(); else if(view==='scan')renderScan(); else renderList(); if(W.grHudTick)W.grHudTick(); }

/* ================= list ================= */
function classify(t,now){
  const ws=winState(t,now), od=t.due&&t.due<now, today=t.due&&sod(t.due)===sod(now);
  return {ws,od,today};
}
function sortKey(t,now){ const c=classify(t,now); return [t.urgent?0:1, c.od?0:1, t.due||9e15, t.created]; }
function cmp(a,b){ for(let i=0;i<a.length;i++){ if(a[i]!==b[i])return a[i]<b[i]?-1:1; } return 0; }
function row(t,now){
  const c=classify(t,now), ty=TY[t.type]||TY.other, done=!!t.done;
  let chips='';
  if(t.urgent&&!done)chips+='<span class="tk-chip urg">'+svg(IC.flag)+'URGENT</span>';
  if(done)chips+='<span class="tk-chip">✓ done '+esc(rel(t.done,now))+'</span>';
  else{
    if(t.due)chips+='<span class="tk-chip '+(c.od?'od':c.today?'td':'')+'">'+(c.od?'overdue '+esc(durStr(now-t.due)):'due '+esc(rel(t.due,now)))+'</span>';
    if(!c.ws.any)chips+='<span class="tk-chip '+(c.ws.open?'op':'cl')+'">'+svg(IC[t.win]||IC.custom)+(c.ws.open?'open now':'opens '+esc(c.ws.next?rel(c.ws.next,now):'—'))+'</span>';
    if(t.type==='cctv'&&cctvOverwrite(t.cctv)){ const ow=cctvOverwrite(t.cctv); chips+='<span class="tk-chip '+(ow<now?'od':ow-now<2*DAY?'td':'')+'">'+(ow<now?'footage may be gone':'overwritten '+esc(rel(ow,now)))+'</span>'; }
  }
  return '<div class="tk-row'+(done?' done':'')+(t.urgent&&!done?' urg':'')+(c.od&&!done?' od':'')+'" data-id="'+t.id+'">'
   +'<button type="button" class="tk-ck" data-ck="'+t.id+'" aria-label="'+(done?'Mark not done':'Mark done')+'">'+svg(IC.check)+'</button>'
   +'<button type="button" class="tk-body" data-ed="'+t.id+'"><span class="tk-ico ty-'+ty.k+'">'+svg(IC[ty.k])+'</span>'
   +'<span class="tk-txt"><b>'+esc(t.title||ty.t)+'</b>'+(t.notes?'<small>'+esc(t.notes.split('\n')[0].slice(0,90))+'</small>':'')+'<span class="tk-chips">'+chips+'</span></span></button></div>';
}
function renderList(){
  const now=Date.now(); ov.querySelector('.tk-title').textContent='Tasks'; ov.querySelector('.tk-fab').hidden=false; ov.querySelector('.tk-copy').hidden=false; ov.querySelector('.tk-scan').hidden=false;
  const all=open_().sort((a,b)=>cmp(sortKey(a,now),sortKey(b,now)));
  const nowList=all.filter(t=>classify(t,now).ws.open), todayList=all.filter(t=>{const c=classify(t,now);return c.od||c.today;});
  const done=DB.tasks.filter(t=>t.done).sort((a,b)=>b.done-a.done);
  if(!tab)tab=prefs().tab||'now';
  const tabs=[['now','Can do now',nowList.length],['today','Due today',todayList.length],['all','All',all.length],['done','Done',done.length]];
  let h='<div class="tk-wrap"><div class="tk-tabs">'+tabs.map(([k,l,n])=>'<button type="button" class="tk-tab'+(tab===k?' on':'')+'" data-tab="'+k+'">'+l+' <span>'+n+'</span></button>').join('')+'</div>';
  const type=prefs().type||'';
  h+='<div class="tk-filters"><button type="button" class="tk-f'+(type?'':' on')+'" data-ty="">All types</button>'+TYPES.filter(x=>DB.tasks.some(t=>t.type===x.k)).map(x=>'<button type="button" class="tk-f'+(type===x.k?' on':'')+'" data-ty="'+x.k+'">'+svg(IC[x.k])+esc(x.t)+'</button>').join('')+'</div>';
  const f=l=>type?l.filter(t=>t.type===type):l;
  let body='';
  if(tab==='now'){ const l=f(nowList); body=l.length?l.map(t=>row(t,now)).join(''):empty('Nothing that can be done right now.',all.length?'Tasks waiting for their time window are under “All”.':'');
    const later=f(all.filter(t=>!classify(t,now).ws.open)); if(later.length)body+='<h3 class="tk-sec">Waiting for their time window</h3>'+later.map(t=>row(t,now)).join(''); }
  else if(tab==='today'){ const l=f(todayList); body=l.length?l.map(t=>row(t,now)).join(''):empty('Nothing due today.',''); }
  else if(tab==='done'){ const l=f(done); body=l.length?'<p class="tk-note">Completed tasks are kept for 30 days, then deleted automatically.</p>'+l.map(t=>row(t,now)).join(''):empty('No completed tasks yet.',''); }
  else { const l=f(all); if(!l.length)body=empty('No tasks yet.','Tap ＋ to add one — CCTV to collect, a statement to take, something for nights…');
    else { const g={}; const order=['Overdue','Today','Tomorrow','This week','Later','No date'];
      l.forEach(t=>{const c=classify(t,now); let k='No date'; if(t.due){const dd=Math.round((sod(t.due)-sod(now))/DAY); k=c.od?'Overdue':dd===0?'Today':dd===1?'Tomorrow':dd<7?'This week':'Later';} (g[k]=g[k]||[]).push(t);});
      order.forEach(k=>{ if(g[k])body+='<h3 class="tk-sec'+(k==='Overdue'?' red':'')+'">'+k+' <span>'+g[k].length+'</span></h3>'+g[k].map(t=>row(t,now)).join(''); }); } }
  h+=body;
  if(!permOK()&&open_().some(t=>t.due||t.remWin))h+='<button type="button" class="tk-remcard" data-a="rem"><b>🔕 Reminders are off</b><span>Allow notifications so due tasks can remind you.</span></button>';
  h+='<p class="tk-foot">Saved only on this phone. Keep details of members of the public to the minimum — this isn’t your official notebook.</p></div>';
  main.innerHTML=h; main.scrollTop=0;
  main.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{tab=b.dataset.tab;setPref('tab',tab);renderList();});
  main.querySelectorAll('[data-ty]').forEach(b=>b.onclick=()=>{setPref('type',b.dataset.ty);renderList();});
  main.querySelectorAll('[data-ck]').forEach(b=>b.onclick=()=>toggleDone(b.dataset.ck));
  main.querySelectorAll('[data-ed]').forEach(b=>b.onclick=()=>editTask(b.dataset.ed));
  const rc=main.querySelector('[data-a="rem"]'); if(rc)rc.onclick=async()=>{ if(await enableReminders())renderList(); };
}
function empty(a,b){ return '<div class="tk-empty"><b>'+esc(a)+'</b>'+(b?'<span>'+esc(b)+'</span>':'')+'</div>'; }
function toggleDone(id){
  const t=byId(id); if(!t)return;
  if(t.done){ t.done=null; save(); render(); toast('Back on the list'); return; }
  t.done=Date.now(); save(); vib(30); render();
  closeTag('gr-task-'+id);
  followSheet(t);
}
async function closeTag(tag){try{const r=await reg();if(!r||!r.getNotifications)return;(await r.getNotifications({tag})).forEach(n=>n.close());}catch(e){}}

/* ================= date/time inputs (24-hour) ================= */
function dtVal(ms){const d=new Date(ms);return {d:d.getFullYear()+'-'+p2(d.getMonth()+1)+'-'+p2(d.getDate()),t:p2(d.getHours())+':'+p2(d.getMinutes())};}
function parseHM(t){ const m=/^(\d{1,2}):?(\d{2})$/.exec(String(t||'').trim()); if(!m)return null; const h=+m[1],mi=+m[2]; return (h>23||mi>59)?null:[h,mi]; }
function dtHtml(key,ms,chips,raw){ const v=raw&&(raw.d||raw.t)?raw:ms==null?{d:'',t:''}:dtVal(ms);
  return '<div class="tk-dt" data-dt="'+key+'"><input type="date" class="tk-in dt-d" value="'+v.d+'" aria-label="Date"><input type="text" class="tk-in dt-t" inputmode="numeric" maxlength="5" placeholder="HH:MM" autocomplete="off" aria-label="Time, 24-hour" value="'+v.t+'">'
   +(chips?'<div class="dt-q">'+chips.map(([l,v])=>'<button type="button" data-q="'+v+'">'+l+'</button>').join('')+'</div>':'')+'<div class="dt-read"></div></div>'; }
function dtRead(root,key){ const w=root.querySelector('[data-dt="'+key+'"]'); if(!w)return NaN; const d=w.querySelector('.dt-d').value, t=parseHM(w.querySelector('.dt-t').value);
  if(!d||!t)return NaN; const [y,mo,da]=d.split('-').map(Number); return new Date(y,mo-1,da,t[0],t[1],0,0).getTime(); }
function dtSet(root,key,ms){ const w=root.querySelector('[data-dt="'+key+'"]'); if(!w)return; if(ms==null){w.querySelector('.dt-d').value='';w.querySelector('.dt-t').value='';} else {const v=dtVal(ms); w.querySelector('.dt-d').value=v.d; w.querySelector('.dt-t').value=v.t;} dtShow(root,key); }
function dtShow(root,key){ const w=root.querySelector('[data-dt="'+key+'"]'); if(!w)return; const ms=dtRead(root,key), r=w.querySelector('.dt-read');
  const tv=w.querySelector('.dt-t').value.trim(), bad=tv&&tv.length>=4&&!parseHM(tv);
  r.textContent=bad?'Use a 24-hour time, e.g. 07:35 or 19:05':isNaN(ms)?'':full(ms); r.classList.toggle('warn',!!bad); }
function quick(q){ // chip value → ms
  const n=new Date(); n.setSeconds(0,0); const at=(d,h,m)=>{const x=new Date(n);x.setDate(x.getDate()+d);x.setHours(h,m||0,0,0);return x.getTime();};
  if(q==='none')return null;
  if(q==='now')return n.getTime();
  if(/^\+\d+h$/.test(q))return n.getTime()+parseInt(q.slice(1))*H;
  if(q==='t17')return at(0,17);
  if(q==='t23')return at(0,23,0);
  if(q==='m09')return at(1,9);
  if(/^\+\d+d$/.test(q))return at(parseInt(q.slice(1)),9);
  if(q==='-1d')return n.getTime()-DAY;
  if(q==='-2h')return n.getTime()-2*H;
  return n.getTime();
}
function dtWire(root,key,onch){ const w=root.querySelector('[data-dt="'+key+'"]'); if(!w)return;
  const ti=w.querySelector('.dt-t');
  ti.addEventListener('input',()=>{const dg=ti.value.replace(/\D/g,'').slice(0,4);const v=dg.length>2?dg.slice(0,2)+':'+dg.slice(2):dg;if(v!==ti.value)ti.value=v;});
  ti.addEventListener('blur',()=>{const t=parseHM(ti.value);if(t)ti.value=p2(t[0])+':'+p2(t[1]);});
  w.querySelectorAll('input').forEach(i=>i.addEventListener('input',()=>{dtShow(root,key);onch&&onch();}));
  w.querySelectorAll('[data-q]').forEach(b=>b.addEventListener('click',()=>{dtSet(root,key,quick(b.dataset.q));onch&&onch();}));
  dtShow(root,key); }

/* ================= editor ================= */
function editTask(id){
  const t=id?byId(id):null; view='edit'; curId=t?t.id:null;
  draft=t?JSON.parse(JSON.stringify(t)):{id:uid(),type:'other',title:'',notes:'',urgent:false,win:'any',wDays:null,due:null,rem:[0,60],remWin:false,created:Date.now(),done:null,fired:{}};
  render(); main.scrollTop=0;
}
function renderEdit(){
  const t=draft, now=Date.now(); ov.querySelector('.tk-title').textContent=curId?'Edit task':'New task'; ov.querySelector('.tk-fab').hidden=true; ov.querySelector('.tk-copy').hidden=true; ov.querySelector('.tk-scan').hidden=true;
  const ty=TY[t.type]||TY.other, w=WN[t.win]||WN.any;
  let h='<div class="tk-wrap tk-form">'
   +'<label class="tk-lab">Type</label><div class="tk-types">'+TYPES.map(x=>'<button type="button" class="tk-type ty-'+x.k+(x.k===t.type?' on':'')+'" data-type="'+x.k+'">'+svg(IC[x.k])+'<b>'+esc(x.t)+'</b></button>').join('')+'</div>'
   +'<p class="tk-hint">'+esc(ty.tip)+'</p>'
   +'<label class="tk-lab">What needs doing</label><input class="tk-in f-title" maxlength="120" autocomplete="off" placeholder="'+esc(placeholder(t.type))+'" value="'+esc(t.title)+'">'
   +'<textarea class="tk-in tk-ta f-notes" maxlength="2000" placeholder="Notes — address, contact, reference numbers… (optional)">'+esc(t.notes)+'</textarea>'
   +'<button type="button" class="tk-urg'+(t.urgent?' on':'')+'">'+svg(IC.flag)+'<b>'+(t.urgent?'Urgent':'Mark as urgent')+'</b><span>'+(t.urgent?'Shown first, in red':'Tap to flag it')+'</span></button>';
  // helpers
  if(t.type==='cctv')h+=cctvHtml(t,now);
  if(t.type==='limit')h+=limitHtml(t,now);
  // window
  h+='<label class="tk-lab">When can it be done?</label><div class="tk-wins">'+WINS.map(x=>'<button type="button" class="tk-win'+(x.k===t.win?' on':'')+'" data-win="'+x.k+'">'+svg(IC[x.k])+'<b>'+esc(x.t)+'</b><small>'+(x.from?esc(x.from+'–'+x.to):x.k==='any'?'no restriction':'set times')+'</small></button>').join('')+'</div>';
  if(t.win==='custom')h+='<div class="tk-cw"><input class="tk-in f-wf" inputmode="numeric" maxlength="5" placeholder="From HH:MM" value="'+esc(t.wFrom||'')+'"><span>to</span><input class="tk-in f-wt" inputmode="numeric" maxlength="5" placeholder="To HH:MM" value="'+esc(t.wTo||'')+'"></div>';
  if(t.win!=='any')h+='<div class="tk-days">'+Object.keys(DAYSET).map(k=>'<button type="button" class="tk-d'+((t.wDays||w.days||'all')===k?' on':'')+'" data-days="'+k+'">'+DAYSET[k]+'</button>').join('')+'</div>'
     +'<label class="tk-chk"><input type="checkbox" class="f-rw"'+(t.remWin?' checked':'')+'><span>Remind me when the window opens</span></label>'
     +'<p class="tk-hint wst"></p>';
  // deadline
  const RAW=t._raw||{};
  h+='<label class="tk-lab">Deadline <small>optional</small></label>'+dtHtml('due',t.due,[['Today 17:00','t17'],['Today 23:00','t23'],['Tomorrow 09:00','m09'],['+2 days','+2d'],['+1 week','+7d'],['None','none']],RAW.due);
  h+='<div class="tk-rems"><span>Remind me</span>'+REMS.filter(([m])=>m<=DAY/MIN||t.type==='limit'||(t.rem||[]).includes(m)).map(([m,l])=>'<button type="button" class="tk-rm'+((t.rem||[]).includes(m)?' on':'')+'" data-rm="'+m+'">'+l+'</button>').join('')+'</div>';
  h+='<p class="tk-err" hidden></p><div class="tk-row2"><button type="button" class="tk-go f-save">'+(curId?'Save':'Add task')+'</button>'
   +(curId?'<button type="button" class="tk-sec-btn f-done">'+(t.done?'Not done':'✓ Mark done')+'</button>':'<button type="button" class="tk-sec-btn f-cancel">Cancel</button>')+'</div>'
   +(curId?'<button type="button" class="tk-link del f-del">'+svg(IC.trash)+'Delete task</button>':'')
   +'</div>';
  main.innerHTML=h;
  wireEdit();
}
function placeholder(k){ return ({cctv:'e.g. Collect CCTV — Centra, Dorset St',statement:'e.g. Statement from shop manager',arrest:'e.g. Arrest on bench warrant — address on PULSE',night:'e.g. Check back lane behind the chipper',call:'e.g. Ring the injured party back',visit:'e.g. House call — 12 Summerhill',court:'e.g. Court 8, CCJ — 10:30',file:'e.g. Update PULSE incident',exhibit:'e.g. Send exhibit to FSI',email:'e.g. Email the council for footage',limit:'e.g. Apply for summons — s.4 Public Order',other:'e.g. Anything to remember'})[k]||''; }
function cctvHtml(t,now){
  const c=t.cctv||{}; const ow=cctvOverwrite(c);
  return '<div class="tk-help"><div class="tk-help-h">'+svg(IC.cctv)+'<b>CCTV — beat the overwrite</b></div>'
   +'<p>Many systems overwrite footage within days, and few keep it much beyond a month. Ask the owner how long theirs keeps it, and ask them to preserve the footage straight away.</p>'
   +'<label class="tk-lab sm">Time of the incident</label>'+dtHtml('inc',c.inc||null,[['Now','now'],['2 h ago','-2h'],['Yesterday','-1d']],(t._raw||{}).inc)
   +'<label class="tk-lab sm">The system keeps footage for</label><div class="tk-keeps">'+[[1,'24 h'],[3,'3 days'],[7,'7 days'],[14,'14 days'],[28,'28 days'],[31,'31 days'],[0,'Don’t know']].map(([d,l])=>'<button type="button" class="tk-kp'+((c.keep||0)===d?' on':'')+'" data-keep="'+d+'">'+l+'</button>').join('')+'</div>'
   +'<div class="tk-help-r">'+cctvRes(c,now)+'</div>'
   +'<div class="tk-row2"><button type="button" class="tk-sec-btn f-cdl"'+(c.inc?'':' disabled')+'>Set deadline '+(ow?'a day before':'for 24 h after the incident')+'</button><button type="button" class="tk-sec-btn f-tpl">📧 Preservation request</button></div></div>';
}
function cctvRes(c,now){ const ow=cctvOverwrite(c);
  return ow?'Footage may be overwritten from <b>'+esc(full(ow))+'</b>'+(ow<now?' — <b class="red">that may already have happened</b>':' ('+(ow-now<DAY?'in '+esc(durStr(ow-now)):esc(rel(ow,now)))+')'):c.inc?'Unknown retention — treat it as urgent: some systems keep only 24–72 hours.':'Enter the incident time to work out the overwrite date.'; }
function limitRes(s,now){ const end=s.off?limitEnd(s.off,s.months||6):null;
  return end?'Last safe day to apply: <b>'+esc(dateOnly(end))+'</b>'+(end<now?' — <b class="red">that date has passed</b>':' ('+esc(durStr(end-now))+' left)')+'<br><small>Counted cautiously: the day before the same date '+(s.months||6)+' months on, moved back to a working day if that falls on a weekend or public holiday.</small>':'Enter the date of the offence.'; }
function limitHtml(t,now){
  const s=t.sol||{months:6}; const end=s.off?limitEnd(s.off,s.months||6):null;
  return '<div class="tk-help"><div class="tk-help-h">'+svg(IC.limit)+'<b>Summons time limit</b></div>'
   +'<p>For a <b>summary offence</b> the complaint must be made — the summons applied for — within <b>6 months</b> of the offence: s.10(4) Petty Sessions (Ireland) Act 1851. What counts is the date the application reaches the District Court office.</p>'
   +'<p>That limit doesn’t apply to indictable offences, or to offences that can be tried either way (s.7 Criminal Justice Act 1951, substituted by s.177 Criminal Justice Act 2006). Some Acts set their own, longer limits — check the Act for the offence.</p>'
   +'<label class="tk-lab sm">Date of the offence</label>'+dtHtml('off',s.off||null,[['Today','now'],['Yesterday','-1d']],(t._raw||{}).off)
   +'<label class="tk-lab sm">Time limit</label><div class="tk-keeps">'+[[6,'6 months'],[12,'12 months'],[24,'2 years'],[36,'3 years']].map(([m,l])=>'<button type="button" class="tk-kp'+((s.months||6)===m?' on':'')+'" data-mon="'+m+'">'+l+'</button>').join('')+'</div>'
   +'<div class="tk-help-r">'+limitRes(s,now)+'</div>'
   +'<button type="button" class="tk-sec-btn wide f-ldl"'+(end?'':' disabled')+'>Set the deadline and reminders (1 month, 1 week, 1 day before)</button></div>';
}
function readDraft(){
  const r=main; const t=draft; t._raw={};
  r.querySelectorAll('[data-dt]').forEach(w=>{ t._raw[w.dataset.dt]={d:w.querySelector('.dt-d').value,t:w.querySelector('.dt-t').value}; });
  t.title=r.querySelector('.f-title').value.trim(); t.notes=r.querySelector('.f-notes').value.trim();
  const due=dtRead(r,'due'); t.due=isNaN(due)?null:due;
  const rw=r.querySelector('.f-rw'); if(rw)t.remWin=rw.checked;
  const wf=r.querySelector('.f-wf'), wt=r.querySelector('.f-wt'); if(wf){ const a=parseHM(wf.value), b=parseHM(wt.value); t.wFrom=a?p2(a[0])+':'+p2(a[1]):wf.value.trim(); t.wTo=b?p2(b[0])+':'+p2(b[1]):wt.value.trim(); }
  if(t.type==='cctv'){ const inc=dtRead(r,'inc'); t.cctv=t.cctv||{}; t.cctv.inc=isNaN(inc)?null:inc; }
  if(t.type==='limit'){ let off=dtRead(r,'off'); if(isNaN(off)){ const d=r.querySelector('[data-dt="off"] .dt-d'); if(d&&d.value){ const [y,mo,da]=d.value.split('-').map(Number); off=new Date(y,mo-1,da,12,0,0,0).getTime(); } }
    t.sol=t.sol||{months:6}; t.sol.off=isNaN(off)?null:off; }
}
let redrawing=false;
function wireEdit(){
  const r=main, t=draft;
  const rer=()=>{ if(redrawing)return; redrawing=true; try{ const a=D.activeElement; if(a&&main.contains(a)&&a.blur)a.blur(); const st=main.scrollTop; readDraft(); renderEdit(); main.scrollTop=st; } finally{ redrawing=false; } };
  r.querySelectorAll('[data-type]').forEach(b=>b.onclick=()=>{ readDraft(); const k=b.dataset.type; if(k===t.type)return; t.type=k;
    if(TY[k].win&&t.win==='any')t.win=TY[k].win;
    if(k==='cctv'&&!t.cctv)t.cctv={inc:null,keep:0};
    if(k==='limit'&&!t.sol)t.sol={months:6,off:null};
    if(k==='cctv'||k==='limit')t.urgent=t.urgent||k==='cctv';
    rer(); });
  r.querySelector('.tk-urg').onclick=()=>{ readDraft(); t.urgent=!t.urgent; vib(15); rer(); };
  r.querySelectorAll('[data-win]').forEach(b=>b.onclick=()=>{ readDraft(); t.win=b.dataset.win; t.wDays=null; if(t.win==='custom'&&!t.wFrom){t.wFrom='09:00';t.wTo='17:00';} rer(); });
  r.querySelectorAll('[data-days]').forEach(b=>b.onclick=()=>{ readDraft(); t.wDays=b.dataset.days; rer(); });
  r.querySelectorAll('[data-rm]').forEach(b=>b.onclick=()=>{ const m=+b.dataset.rm; t.rem=t.rem||[]; if(t.rem.includes(m))t.rem=t.rem.filter(x=>x!==m); else t.rem.push(m); b.classList.toggle('on'); });
  ['f-wf','f-wt'].forEach(c=>{const i=r.querySelector('.'+c); if(i)i.addEventListener('input',()=>{const dg=i.value.replace(/\D/g,'').slice(0,4);const v=dg.length>2?dg.slice(0,2)+':'+dg.slice(2):dg;if(v!==i.value)i.value=v;});});
  dtWire(r,'due');
  // window status line
  const ws=r.querySelector('.wst'); if(ws){ readDraft(); const s=winState(t,Date.now()); ws.innerHTML=s.any?'':s.open?'<span class="grn">Open now</span> · '+esc(s.w.label.trim())+' · '+esc(DAYSET[s.w.days]):'Next opens <b>'+esc(s.next?rel(s.next,Date.now()):'—')+'</b> · '+esc(DAYSET[s.w.days]); }
  // CCTV helper
  if(t.type==='cctv'){
    const cr=()=>{ readDraft(); r.querySelector('.tk-help-r').innerHTML=cctvRes(t.cctv,Date.now()); const b=r.querySelector('.f-cdl'); b.disabled=!t.cctv.inc;
      b.textContent='Set deadline '+(cctvOverwrite(t.cctv)?'a day before':'for 24 h after the incident'); };
    dtWire(r,'inc',cr);
    r.querySelectorAll('[data-keep]').forEach(b=>b.onclick=()=>{ t.cctv.keep=+b.dataset.keep||0; r.querySelectorAll('[data-keep]').forEach(x=>x.classList.toggle('on',x===b)); cr(); });
    const cd=r.querySelector('.f-cdl'); if(cd)cd.onclick=()=>{ readDraft(); const c=t.cctv; if(!c.inc)return; const ow=cctvOverwrite(c);
      let due=ow?ow-DAY:c.inc+DAY; if(due<Date.now()+30*MIN)due=Math.ceil((Date.now()+60*MIN)/MIN)*MIN; t.rem=[0,60]; t.urgent=true;
      dtSet(r,'due',due); const ti=r.querySelector('.f-title'); if(!ti.value.trim())ti.value='Collect CCTV';
      rer(); toast('Deadline set: '+full(due)); };
    r.querySelector('.f-tpl').onclick=()=>{ openTpl('cctv'); }; }
  // time-limit helper
  if(t.type==='limit'){
    const lr=()=>{ readDraft(); r.querySelector('.tk-help-r').innerHTML=limitRes(t.sol,Date.now()); r.querySelector('.f-ldl').disabled=!t.sol.off; };
    dtWire(r,'off',lr);
    r.querySelectorAll('[data-mon]').forEach(b=>b.onclick=()=>{ t.sol.months=+b.dataset.mon; r.querySelectorAll('[data-mon]').forEach(x=>x.classList.toggle('on',x===b)); lr(); });
    const ld=r.querySelector('.f-ldl'); if(ld)ld.onclick=()=>{ readDraft(); if(!t.sol.off)return; const due=limitEnd(t.sol.off,t.sol.months||6); t.rem=[0,DAY/MIN,7*DAY/MIN,30*DAY/MIN];
      dtSet(r,'due',due); const ti=r.querySelector('.f-title'); if(!ti.value.trim())ti.value='Apply for the summons';
      rer(); toast('Deadline set: '+dateOnly(due)); }; }
  const err=m=>{const e=r.querySelector('.tk-err');e.textContent=m;e.hidden=!m;if(m)e.scrollIntoView({block:'center'});};
  r.querySelector('.f-save').onclick=async()=>{
    readDraft();
    if(!t.title&&!t.notes)return err('Say what needs doing.');
    const tv=r.querySelector('[data-dt="due"] .dt-t').value.trim(), dv=r.querySelector('[data-dt="due"] .dt-d').value;
    if((tv||dv)&&t.due==null)return err('Finish the deadline — date and a 24-hour time (e.g. 17:00) — or tap “None”.');
    if(t.win==='custom'&&(!parseHM(t.wFrom)||!parseHM(t.wTo)||t.wFrom===t.wTo))return err('Enter the custom window as two 24-hour times, e.g. 10:00 to 16:00.');
    if(!t.title)t.title=t.notes.split('\n')[0].slice(0,80);
    t.updated=Date.now(); t.fired={}; t.nextWin=null; delete t._raw;
    const isNew=!curId; if(isNew)DB.tasks.push(t); else { const i=DB.tasks.findIndex(x=>x.id===curId); if(i>=0)DB.tasks[i]=t; }
    save(); view='list'; draft=null; render(); toast(isNew?'Task added':'Saved');
    if((t.due&&(t.rem||[]).length)||t.remWin){ if(!permOK()&&('Notification' in W)&&Notification.permission==='default')await enableReminders(); }
    check();
  };
  const c=r.querySelector('.f-cancel'); if(c)c.onclick=()=>back();
  const dn=r.querySelector('.f-done'); if(dn)dn.onclick=()=>{ const id=curId; view='list'; draft=null; toggleDone(id); };
  const dl=r.querySelector('.f-del'); if(dl)dl.onclick=()=>{ if(dl.dataset.sure!=='1'){dl.dataset.sure='1';dl.lastChild.textContent='Tap again to delete';setTimeout(()=>{if(dl.isConnected){dl.dataset.sure='';dl.lastChild.textContent='Delete task';}},2500);return;}
    DB.tasks=DB.tasks.filter(x=>x.id!==curId); save(); closeTag('gr-task-'+curId); view='list'; draft=null; render(); toast('Deleted'); };
}
function openTpl(id){
  try{ if(typeof TPL!=='undefined'&&TPL&&typeof openTemplate==='function'){ const i=TPL.findIndex(x=>x.id===id); if(i>=0){ closeTasks(); openTemplate(i); return; } } }catch(e){}
  toast('Templates are still loading — try again in a moment');
}
function closeSheet(){ if(!sh)return; sh.hidden=true; sh.innerHTML=''; ov.querySelector('.tk-shade').hidden=true; }

/* ================= follow-ups when a task is done ================= */
// [type, title, what it involves, when]  when: none · t23 (today) · +Nd (N days, 09:00)
const FOLLOW={
 cctv:[['exhibit','Exhibit the footage','label it and keep the continuity','none'],['file','View the footage','viewing notes · stills of anyone of interest','+1d'],['statement','Statement from whoever produced it','how and when the footage was downloaded','+2d'],['file','Disclosure — schedule the footage','relied on, or unused material','+7d']],
 statement:[['file','Add the statement to the file','and update PULSE','+1d'],['other','Follow up what the statement raised','witnesses, CCTV, other enquiries','+2d'],['call','Update the injured party','what happens next','+2d'],['file','Disclosure — schedule the statement','','+7d']],
 arrest:[['file','Update PULSE — arrest and outcome','','t23'],['statement','Arrest statement / memo of interview','','+1d'],['court','Charge, or apply for a summons','','+1d'],['exhibit','Record property and exhibits','seized items · continuity','t23'],['file','Prepare the file','','+7d'],['file','Disclosure — schedule the material','','+7d']],
 visit:[['file','Record the result','PULSE / notes','t23'],['visit','Call back — nobody home','','+1d'],['statement','Statement arising from the visit','','+2d']],
 call:[['file','Record the result','','t23'],['call','Ring again','no answer','+1d']],
 night:[['file','Record the result','','t23']],
 court:[['file','Update PULSE with the outcome','','t23'],['court','Next court date','remand or adjourned date','none'],['call','Tell the injured party the outcome','','+2d'],['exhibit','Exhibits — return or dispose','once the case is finished','+7d']],
 file:[['file','Submit for review','sergeant / supervisor','+1d'],['file','Disclosure schedule','','+7d']],
 exhibit:[['file','Update the exhibits register','continuity','t23'],['exhibit','Chase the lab result','','+14d'],['exhibit','Return property to the owner','','+7d']],
 email:[['email','Chase a reply','','+7d']],
 limit:[['court','Track the summons','issue, service and court date','+14d']],
 other:[['other','Follow-up','','+1d']]
};
const whenTxt=q=>q==='none'?'no deadline':q==='t23'?'today':q==='+1d'?'tomorrow':q.replace(/^\+(\d+)d$/,'in $1 days');
function followSheet(t){
  if(!ov||ov.hidden)return; const L=FOLLOW[t.type]||FOLLOW.other, pick=new Set();
  let h='<div class="tk-grip"></div><h3>✓ Done — any follow-up?</h3><p class="tk-note">'+esc(t.title)+'</p>';
  if(t.type==='arrest')h+='<div class="tk-row2"><button type="button" class="tk-sec-btn fu-det">⏱ Start detention clock</button><button type="button" class="tk-sec-btn fu-gaol">🔐 Cell checks</button></div>';
  h+='<div class="tk-fu">'+L.map((f,i)=>'<button type="button" class="tk-fuo" data-fu="'+i+'"><span class="tk-ico ty-'+f[0]+'">'+svg(IC[f[0]]||IC.other)+'</span><span class="tk-fut"><b>'+esc(f[1])+'</b><small>'+esc((f[2]?f[2]+' · ':'')+whenTxt(f[3]))+'</small></span><i></i></button>').join('')+'</div>'
   +'<div class="tk-row2"><button type="button" class="tk-sec-btn fu-none">No follow-up</button><button type="button" class="tk-go fu-add" disabled>Add follow-up</button></div>'
   +'<div class="tk-fu-foot"><button type="button" class="tk-link fu-own">'+svg(IC.plus)+'Write my own</button><button type="button" class="tk-link fu-undo">Undo — not done</button></div>';
  sh.innerHTML=h; sh.hidden=false; ov.querySelector('.tk-shade').hidden=false; ov.querySelector('.tk-toast').classList.remove('on');
  const add=sh.querySelector('.fu-add');
  sh.querySelectorAll('[data-fu]').forEach(b=>b.onclick=()=>{ const i=+b.dataset.fu; if(pick.has(i))pick.delete(i); else pick.add(i); b.classList.toggle('on',pick.has(i));
    add.disabled=!pick.size; add.textContent=pick.size?'Add '+pick.size+' follow-up'+(pick.size>1?'s':''):'Add follow-up'; });
  add.onclick=()=>{ const now=Date.now(); let n=0;
    for(const i of [...pick].sort()){ const f=L[i], ty=TY[f[0]]||TY.other;
      DB.tasks.push({id:uid(),type:f[0],title:(f[1]+' · '+t.title).slice(0,120),notes:'Follow-up from “'+t.title+'” (done '+full(t.done||now)+')'+(f[2]?'\n'+f[2]:''),urgent:false,win:ty.win||'any',wDays:null,
        due:f[3]==='none'?null:quick(f[3]),rem:f[3]==='none'?[]:[0,60],remWin:false,created:now+n,done:null,fired:{},from:t.id}); n++; }
    save(); closeSheet(); render(); check(); toast(n+' follow-up'+(n>1?'s':'')+' added'); };
  sh.querySelector('.fu-none').onclick=()=>{ closeSheet(); toast('✓ Done'); };
  sh.querySelector('.fu-own').onclick=()=>{ closeSheet(); editTask(null); draft.notes='Follow-up from “'+t.title+'” (done '+full(t.done||Date.now())+')'; draft.from=t.id; render(); };
  sh.querySelector('.fu-undo').onclick=()=>{ t.done=null; save(); closeSheet(); render(); toast('Back on the list'); };
  const dt=sh.querySelector('.fu-det'); if(dt)dt.onclick=()=>{ closeSheet(); if(W.openDetention)W.openDetention(); };
  const gl=sh.querySelector('.fu-gaol'); if(gl)gl.onclick=()=>{ closeSheet(); if(W.openGaol)W.openGaol(); };
}

/* ================= photograph a to-do list → read it → sort it into tasks ================= */
const AIKEY='gr_apikey';
let scan=null;   // {img, items:[{on,text,type,urgent,due}], busy, err, mode}
function guessType(s){ s=' '+String(s).toLowerCase()+' ';
  if(/cctv|footage|camera/.test(s))return 'cctv';
  if(/arrest|warrant|\bbench\b|wanted|detain/.test(s))return 'arrest';
  if(/statement|\bstmt\b|\bs\/t\b|memo of int|interview/.test(s))return 'statement';
  if(/\bcourt\b|summons|\bccj\b|remand|\bdc\b/.test(s))return 'court';
  if(/exhibit|\blab\b|\bfsi\b|property|\bseal/.test(s))return 'exhibit';
  if(/pulse|\bfile\b|incident|report/.test(s))return 'file';
  if(/e-?mail|letter|write to/.test(s))return 'email';
  if(/house|visit|call to|call at|address|door|knock/.test(s))return 'visit';
  if(/\bring\b|\bcall\b|phone|\btel\b|text back|ring back/.test(s))return 'call';
  if(/\bnights?\b/.test(s))return 'night';
  if(/time limit|6 months|six months/.test(s))return 'limit';
  return 'other'; }
function guessDue(s){ s=String(s).toLowerCase(); return /\btoday\b|\btonight\b|\basap\b/.test(s)?'today':/tomorrow|\btmrw\b|\btmw\b|\btmr\b/.test(s)?'tomorrow':/this week|by fri|end of week/.test(s)?'week':'none'; }
function lineItems(txt){ return String(txt||'').split(/\r?\n/).map(l=>l.replace(/^\s*(?:[-*•·▪◦›>]|\d{1,2}[.)]|\[[ xX✓]?\]|[☐□✓✔])\s*/,'').trim()).filter(l=>l.length>1)
  .map(l=>({on:true,text:l.slice(0,120),type:guessType(l),urgent:/urgent|asap|!!/i.test(l),due:guessDue(l)})); }
function startScan(){ const inp=D.createElement('input'); inp.type='file'; inp.accept='image/*'; inp.setAttribute('capture','environment'); inp.style.display='none'; D.body.appendChild(inp);
  inp.onchange=()=>{ const f=inp.files&&inp.files[0]; inp.remove(); if(!f)return; loadPhoto(f); }; inp.click(); setTimeout(()=>{ if(inp.isConnected&&!inp.files.length)inp.remove(); },60000); }
function loadPhoto(file){ const url=URL.createObjectURL(file), im=new Image();
  im.onload=()=>{ const s=Math.min(1,1568/Math.max(im.naturalWidth,im.naturalHeight)), c=D.createElement('canvas'); c.width=Math.round(im.naturalWidth*s); c.height=Math.round(im.naturalHeight*s);
    c.getContext('2d').drawImage(im,0,0,c.width,c.height); URL.revokeObjectURL(url);
    scan={img:c.toDataURL('image/jpeg',.85),items:[],busy:false,err:'',mode:'choose'}; view='scan'; render(); };
  im.onerror=()=>{ URL.revokeObjectURL(url); toast('Couldn’t open that photo'); }; im.src=url; }
async function readWithClaude(){ const key=(localStorage.getItem(AIKEY)||'').trim(); if(!key){ scan.mode='key'; render(); return; }
  if(navigator.onLine===false){ scan.err='No signal — type the list in instead, or try again when you have signal.'; render(); return; }
  scan.busy=true; scan.err=''; render();
  const prompt='This is a photo of a Garda’s to-do list (handwritten or printed). Transcribe each separate task as one item, keeping the wording close to what is written (fix obvious spelling only). Do not invent tasks; if part of a line is unreadable, put (?) there. '
   +'For each item give: "text" (max 120 characters), "type" — one of cctv, statement, arrest, night, call, visit, court, file, exhibit, email, limit, other — "urgent" (true only if it is marked urgent, starred or says ASAP), and "due" — one of "today", "tomorrow", "week", "none" (only if the list says when). '
   +'Reply with JSON only, no other text: {"items":[{"text":"...","type":"other","urgent":false,"due":"none"}]}';
  try{ const r=await fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'Content-Type':'application/json','x-api-key':key,'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'},
      body:JSON.stringify({model:'claude-sonnet-5',max_tokens:1500,messages:[{role:'user',content:[{type:'image',source:{type:'base64',media_type:'image/jpeg',data:scan.img.split(',')[1]}},{type:'text',text:prompt}]}]})});
    const d=await r.json().catch(()=>({}));
    if(!r.ok||d.error){ const m=(d.error&&d.error.message)||('HTTP '+r.status); throw new Error(r.status===401?'The API key was refused — check it in AI search settings.':m); }
    const txt=(d.content||[]).filter(b=>b.type==='text').map(b=>b.text).join('\n'), a=txt.indexOf('{'), z=txt.lastIndexOf('}');
    const j=JSON.parse(txt.slice(a,z+1)), ok=TYPES.map(x=>x.k);
    const items=(j.items||[]).map(x=>({on:true,text:String(x.text||'').trim().slice(0,120),type:ok.includes(x.type)?x.type:guessType(x.text),urgent:!!x.urgent,due:['today','tomorrow','week','none'].includes(x.due)?x.due:'none'})).filter(x=>x.text);
    if(!scan)return; scan.busy=false; if(!items.length){ scan.err='Claude couldn’t find any tasks in that photo — type them in instead.'; render(); return; }
    scan.items=items; scan.mode='triage'; render();
  }catch(e){ if(!scan)return; scan.busy=false; scan.err=(e&&e.message&&!/JSON|Unexpected/.test(e.message))?e.message:'Couldn’t read the list — try a clearer photo, or type it in.'; render(); } }
function renderScan(){ const s=scan; if(!s){ view='list'; renderList(); return; } ov.querySelector('.tk-title').textContent='Photo → tasks'; ov.querySelector('.tk-fab').hidden=true; ov.querySelector('.tk-copy').hidden=true; ov.querySelector('.tk-scan').hidden=true;
  let h='<div class="tk-wrap tk-scanv"><div class="tk-shot"><img src="'+s.img+'" alt="Your to-do list"></div>';
  if(s.err)h+='<p class="tk-err">'+esc(s.err)+'</p>';
  if(s.mode==='choose'||s.mode==='key'){
    if(s.busy)h+='<div class="tk-busy"><i></i>Reading your list…</div>';
    else if(s.mode==='key')h+='<label class="tk-lab">Your Anthropic API key</label><input class="tk-in f-key" type="password" autocomplete="off" placeholder="sk-ant-…"><p class="tk-hint">Stored only on this phone (the same key as AI search). Each photo costs about a cent.</p><div class="tk-row2"><button type="button" class="tk-sec-btn sc-back">Back</button><button type="button" class="tk-go sc-savekey">Save and read</button></div>';
    else h+='<div class="tk-row2 col"><button type="button" class="tk-go sc-ai">✦ Read it with Claude</button><button type="button" class="tk-sec-btn sc-type">Type it in myself</button></div>'
      +'<p class="tk-hint"><b>Read it with Claude</b> sends this photo to Anthropic’s Claude service with your API key to read the writing — handwriting included. Only do that if Garda policy allows it for what’s on the list: <b>if it has personal details of members of the public, type it in instead</b>. The photo isn’t kept on the phone either way.</p>';
  } else if(s.mode==='type'){
    h+='<label class="tk-lab">One task per line</label><textarea class="tk-in tk-ta big f-lines" placeholder="e.g.\nCCTV Centra Dorset St\nRing IP back re statement\nCourt Thurs 10:30">'+esc(s.lines||'')+'</textarea><div class="tk-row2"><button type="button" class="tk-sec-btn sc-back">Back</button><button type="button" class="tk-go sc-split">Sort into tasks</button></div>';
  } else {
    const n=s.items.filter(x=>x.on&&x.text.trim()).length;
    h+='<label class="tk-lab">Check each one — untick anything that isn’t a task</label><div class="tk-tri">'+s.items.map((x,i)=>'<div class="tk-tr'+(x.on?'':' off')+'" data-i="'+i+'">'
      +'<button type="button" class="tk-tron" aria-label="Include">'+svg(IC.check)+'</button><div class="tk-trb"><input class="tk-in tr-t" maxlength="120" value="'+esc(x.text)+'">'
      +'<div class="tk-trm"><select class="tk-in tr-y">'+TYPES.map(y=>'<option value="'+y.k+'"'+(y.k===x.type?' selected':'')+'>'+esc(y.t)+'</option>').join('')+'</select>'
      +'<select class="tk-in tr-d">'+[['none','No deadline'],['today','Today'],['tomorrow','Tomorrow'],['week','This week']].map(([v,l])=>'<option value="'+v+'"'+(v===x.due?' selected':'')+'>'+l+'</option>').join('')+'</select>'
      +'<button type="button" class="tk-tru'+(x.urgent?' on':'')+'" aria-label="Urgent">'+svg(IC.flag)+'</button></div></div></div>').join('')+'</div>'
      +'<button type="button" class="tk-link sc-more">'+svg(IC.plus)+'Add a line</button>'
      +'<div class="tk-row2"><button type="button" class="tk-sec-btn sc-back">Cancel</button><button type="button" class="tk-go sc-add"'+(n?'':' disabled')+'>Add '+n+' task'+(n===1?'':'s')+'</button></div>';
  }
  h+='</div>'; main.innerHTML=h; main.scrollTop=0;
  const q=c=>main.querySelector(c);
  if(q('.sc-ai'))q('.sc-ai').onclick=()=>readWithClaude();
  if(q('.sc-type'))q('.sc-type').onclick=()=>{ s.mode='type'; s.err=''; render(); setTimeout(()=>{ const t=q('.f-lines'); if(t)t.focus(); },50); };
  if(q('.sc-savekey'))q('.sc-savekey').onclick=()=>{ const k=q('.f-key').value.trim(); if(!/^sk-ant-/.test(k)){ s.err='That doesn’t look like an Anthropic key (it starts sk-ant-).'; render(); return; } localStorage.setItem(AIKEY,k); s.mode='choose'; s.err=''; readWithClaude(); };
  main.querySelectorAll('.sc-back').forEach(b=>b.onclick=()=>{ if(s.mode==='triage'||s.mode==='choose'){ scan=null; view='list'; render(); } else { s.mode='choose'; s.err=''; render(); } });
  if(q('.sc-split'))q('.sc-split').onclick=()=>{ s.lines=q('.f-lines').value; const it=lineItems(s.lines); if(!it.length){ s.err='Type at least one task — one per line.'; render(); return; } s.items=it; s.mode='triage'; s.err=''; render(); };
  if(s.mode==='triage'){
    const sync=()=>{ const n=s.items.filter(x=>x.on&&x.text.trim()).length, b=q('.sc-add'); b.disabled=!n; b.textContent='Add '+n+' task'+(n===1?'':'s'); };
    main.querySelectorAll('.tk-tr').forEach(r=>{ const x=s.items[+r.dataset.i];
      r.querySelector('.tk-tron').onclick=()=>{ x.on=!x.on; r.classList.toggle('off',!x.on); sync(); };
      r.querySelector('.tr-t').oninput=e=>{ x.text=e.target.value; sync(); };
      r.querySelector('.tr-y').onchange=e=>{ x.type=e.target.value; };
      r.querySelector('.tr-d').onchange=e=>{ x.due=e.target.value; };
      r.querySelector('.tk-tru').onclick=e=>{ x.urgent=!x.urgent; e.currentTarget.classList.toggle('on',x.urgent); }; });
    q('.sc-more').onclick=()=>{ s.items.push({on:true,text:'',type:'other',urgent:false,due:'none'}); render(); const all=main.querySelectorAll('.tr-t'); if(all.length){ all[all.length-1].focus(); } };
    q('.sc-add').onclick=()=>{ const now=Date.now(); const L=s.items.filter(x=>x.on&&x.text.trim());
      L.forEach((x,i)=>{ const ty=TY[x.type]||TY.other; DB.tasks.push({id:uid(),type:x.type,title:x.text.trim().slice(0,120),notes:'',urgent:!!x.urgent,win:ty.win||'any',wDays:null,
        due:x.due==='today'?quick('t23'):x.due==='tomorrow'?quick('+1d'):x.due==='week'?quick('+7d'):null,rem:x.due==='none'?[]:[0,60],remWin:false,created:now+i,done:null,fired:{}}); });
      scan=null; save(); view='list'; tab='all'; render(); check(); toast(L.length+' task'+(L.length===1?'':'s')+' added'); };
  }
}

/* ================= copy the list (handover) ================= */
function copyList(){
  const now=Date.now(), l=open_().sort((a,b)=>cmp(sortKey(a,now),sortKey(b,now)));
  if(!l.length){toast('No open tasks to copy');return;}
  const lines=['TASKS — '+full(now),''];
  l.forEach((t,i)=>{ const c=classify(t,now); const w=winOf(t);
    lines.push((i+1)+'. '+(t.urgent?'[URGENT] ':'')+TY[t.type].t+': '+t.title
      +(t.due?' — '+(c.od?'OVERDUE since ':'due ')+full(t.due):'')+(w?' — '+w.label.trim()+(w.days!=='all'?' '+DAYSET[w.days]:''):'')
      +(t.type==='cctv'&&cctvOverwrite(t.cctv)?' — footage overwritten from '+full(cctvOverwrite(t.cctv)):''));
    if(t.notes)lines.push('   '+t.notes.replace(/\n/g,'\n   ')); });
  const txt=lines.join('\n');
  (navigator.clipboard&&navigator.clipboard.writeText?navigator.clipboard.writeText(txt):Promise.reject()).then(()=>toast('List copied — paste it into a message or your notes')).catch(()=>{
    sh.innerHTML='<div class="tk-grip"></div><h3>Your tasks</h3><textarea class="tk-in tk-ta big" readonly>'+esc(txt)+'</textarea><button type="button" class="tk-sec-btn wide tk-x">Close</button>';
    sh.hidden=false; ov.querySelector('.tk-shade').hidden=false; sh.querySelector('.tk-x').onclick=()=>closeSheet(); });
}

/* ================= home-screen strip ================= */
let strips=[];
function mountStrip(el){ if(!el)return; strips=strips.filter(x=>x.isConnected); if(!strips.includes(el))strips.push(el); paintStrip(el); }
function paintStrips(){ strips=strips.filter(x=>x.isConnected); strips.forEach(paintStrip); }
function paintStrip(el){
  const now=Date.now(), l=open_(); if(!l.length){ if(el.innerHTML)el.innerHTML=''; el._h=''; return; }
  const od=l.filter(t=>t.due&&t.due<now).length, nowN=l.filter(t=>winState(t,now).open).length, urg=l.filter(t=>t.urgent).length;
  const top=l.slice().sort((a,b)=>cmp(sortKey(a,now),sortKey(b,now))).slice(0,3);
  const h='<div class="tk-strip"><button type="button" class="tks-h" data-open="1">'+svg(IC.other)+'<b>TASKS</b><span>'+l.length+' open'+(nowN?' · '+nowN+' can do now':'')+(od?' · <i>'+od+' overdue</i>':'')+(urg?' · '+urg+' urgent':'')+'</span></button>'
   +top.map(t=>{ const c=classify(t,now); return '<div class="tks-r'+(t.urgent?' urg':'')+(c.od?' od':'')+'"><button type="button" class="tks-ck" data-ck="'+t.id+'" aria-label="Mark done">'+svg(IC.check)+'</button><button type="button" class="tks-b" data-id="'+t.id+'"><span class="tk-ico ty-'+t.type+'">'+svg(IC[t.type]||IC.other)+'</span><span class="tks-t"><b>'+esc(t.title)+'</b><small>'+(t.due?(c.od?'overdue '+esc(durStr(now-t.due)):'due '+esc(rel(t.due,now))):c.ws.any?'any time':c.ws.open?'open now':'opens '+esc(c.ws.next?rel(c.ws.next,now):''))+'</small></span></button></div>'; }).join('')+'</div>';
  if(el._h===h)return; el._h=h; el.innerHTML=h;
  el.querySelector('[data-open]').onclick=()=>openTasks();
  el.querySelectorAll('.tks-b').forEach(b=>b.onclick=()=>openTasks(b.dataset.id));
  el.querySelectorAll('.tks-ck').forEach(b=>b.onclick=()=>{ const t=byId(b.dataset.ck); if(!t)return; t.done=Date.now(); save(); vib(30); closeTag('gr-task-'+t.id); openTasks(); followSheet(t); });
}

/* ================= ticker / lifecycle ================= */
let lastChk=0;
setInterval(()=>{ const now=Date.now(); if(now-lastChk>=30000){lastChk=now;check();} paintStrips();
  if(ov&&!ov.hidden&&view==='list'&&sh.hidden&&!main.contains(D.activeElement)&&now-(ov._r||0)>60000){ov._r=now;const st=main.scrollTop;renderList();main.scrollTop=st;} },5000);
D.addEventListener('visibilitychange',()=>{ if(D.visibilityState==='visible'){ purge(); check(); paintStrips(); } });
if('serviceWorker' in navigator){ navigator.serviceWorker.addEventListener('message',e=>{const m=e.data||{}; if(m.gr==='notif'&&m.data&&m.data.open==='task')openTasks(m.data.id);}); }
(function(){ try{ const q=new URLSearchParams(location.search); if(q.get('open')==='task'){ const id=q.get('id'); history.replaceState(history.state,'',location.pathname);
  const go=()=>openTasks(id); if(D.readyState==='loading')D.addEventListener('DOMContentLoaded',()=>setTimeout(go,60)); else setTimeout(go,60); } }catch(e){} })();
setTimeout(check,1500);

W.openTasks=openTasks; W.closeTasks=closeTasks; W.tskBack=back;
W.GRTasks=Object.freeze({open:openTasks,mountStrip,check,_db:()=>DB,_lib:{inWin,nextOpen,winOf,limitEnd,addMonths,cctvOverwrite}});
})();
