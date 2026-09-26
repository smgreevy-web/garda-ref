/* Garda Reference — Detention clock: custody time limits, excluded periods, extensions and alerts.
   Self-contained. Everything is saved only on this phone (localStorage). Nothing is uploaded.
   Periods checked against the revised Acts (Law Reform Commission): CJA 1984 s.4, OASA 1939 s.30,
   CJ(DT)A 1996 s.2, CJA 2007 s.50. */
(function(){
'use strict';
const W=window, D=document;
const LS='gr_det', LSA='gr_det_alerts', LSI='gr_det_info';
const H=3600e3, MIN=60e3;
const p2=n=>String(n).padStart(2,'0');
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const DAYS=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'], MON=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const hm=t=>{const d=new Date(t);return p2(d.getHours())+':'+p2(d.getMinutes());};
const day=t=>{const d=new Date(t);return DAYS[d.getDay()]+' '+d.getDate()+' '+MON[d.getMonth()];};
const when=t=>hm(t)+' · '+day(t);
const full=t=>{const d=new Date(t);return hm(t)+' '+DAYS[d.getDay()]+' '+p2(d.getDate())+'/'+p2(d.getMonth()+1)+'/'+d.getFullYear();};
function clockStr(ms){ms=Math.max(0,ms);const h=Math.floor(ms/H),m=Math.floor(ms%H/MIN),s=Math.floor(ms%MIN/1000);return h+':'+p2(m)+':'+p2(s);}
function durStr(ms){ms=Math.max(0,Math.round(ms/MIN)*MIN);const h=Math.floor(ms/H),m=Math.round(ms%H/MIN);return h?(h+' h'+(m?' '+p2(m)+' m':'')):(m+' min');}
function inStr(ms){return ms>=0?'in '+durStr(ms):durStr(-ms)+' ago';}
const vib=p=>{try{if(navigator.vibrate)navigator.vibrate(p);}catch(e){}};
const uid=()=>'d'+Date.now().toString(36)+Math.random().toString(36).slice(2,6);

/* ================= the law (verified) ================= */
const REG={
 s4:{short:'s.4 CJA 1984',name:'Criminal Justice Act 1984, s.4',max:24,scope:'Offences punishable by 5 years or more',
  stages:[
   {h:6, name:'Initial period',auth:'Member in charge',cite:'s.4(2), (3)(a)'},
   {h:6, name:'1st extension',auth:'Superintendent or above',cite:'s.4(3)(b)',need:'Superintendent direction',act:'Supt extension directed'},
   {h:12,name:'2nd extension',auth:'Chief Superintendent or above',cite:'s.4(3)(bb)',need:'Chief Superintendent direction',act:'Chief Supt extension directed'}],
  exc:['rest','med','court','cert','susp'],
  law:[
   'Applies to offences punishable by 5 years’ imprisonment or more, and attempts.',
   'The member in charge authorises detention on arrival if there are reasonable grounds for believing it is necessary for the proper investigation of the offence — s.4(2).',
   '6 hours from the time of arrest — s.4(3)(a).',
   'A Superintendent or above may direct up to 6 more hours, with reasonable grounds for believing it is necessary for the proper investigation — s.4(3)(b).',
   'A Chief Superintendent or above may direct up to 12 more hours on the same basis — s.4(3)(bb).',
   'Never longer than 24 hours from arrest, not counting excluded periods — s.4(9).',
   'Release as soon as there are no longer reasonable grounds for believing detention is necessary for the proper investigation, unless charged — s.4(5).',
   'Excluded periods: rest with written consent — s.4(6); medical attention, including before reaching the station — s.4(8); court applications about the lawfulness of the detention — s.4(8A); a doctor’s certificate of unfitness for questioning, up to 6 hours, once only — s.4(8B); suspension of detention on release to return, at most 2 occasions and 4 months in total — s.4(3A)–(3F).',
   'Rest: between midnight and 08:00 the member in charge may suspend questioning to let the person rest, only if the person consents in writing. The person signs a written notice showing the time it was given. The time from the notice until the time stated in it (not later than 08:00) is excluded — s.4(6). The Criminal Justice Act 2011 would make this suspension automatic unless the person objects, but that change was not yet in force when this was checked.']},
 s30:{short:'s.30 OASA 1939',name:'Offences against the State Act 1939, s.30',max:72,scope:'Offences under the 1939 Act and scheduled offences',
  stages:[
   {h:24,name:'Initial period',auth:'On arrest',cite:'s.30(3)'},
   {h:24,name:'Extension',auth:'Chief Superintendent or above',cite:'s.30(3)',need:'Chief Superintendent direction',act:'Chief Supt extension directed'},
   {h:24,name:'Court extension',auth:'District Court judge — warrant applied for by a Superintendent or above',cite:'s.30(4), (4A)',need:'District Court warrant',act:'District Court warrant granted',court:1}],
  exc:[],
  law:[
   '24 hours from the time of arrest — s.30(3).',
   'A Chief Superintendent or above may direct a further 24 hours — s.30(3).',
   'A Superintendent or above may apply to a District Court judge for a warrant for up to 24 more hours. The judge must be satisfied it is necessary for the proper investigation — s.30(4), (4A).',
   'If not charged or released, the person must be released when the authorised period ends — s.30(4C).',
   'Section 30 itself provides no excluded periods, so this clock runs continuously.']},
 dta:{short:'s.2 DTA 1996',name:'Criminal Justice (Drug Trafficking) Act 1996, s.2',max:168,scope:'Drug trafficking offences',
  stages:[
   {h:6, name:'Initial period',auth:'Member in charge',cite:'s.2(1), (2)'},
   {h:18,name:'1st extension',auth:'Superintendent or above',cite:'s.2(2)',need:'Superintendent direction',act:'Supt extension directed'},
   {h:24,name:'2nd extension',auth:'Chief Superintendent or above',cite:'s.2(2)',need:'Chief Superintendent direction',act:'Chief Supt extension directed'},
   {h:72,name:'1st court warrant',auth:'Circuit or District Court judge — applied for by a Chief Superintendent or above',cite:'s.2(2)',need:'Court warrant (72 h)',act:'Court warrant granted (72 h)',court:1},
   {h:48,name:'2nd court warrant',auth:'Circuit or District Court judge — applied for by a Chief Superintendent or above',cite:'s.2(2)',need:'Second court warrant (48 h)',act:'Court warrant granted (48 h)',court:1}],
  exc:['med'],
  law:[
   '6 hours from arrest. A Superintendent or above may direct up to 18 more hours; a Chief Superintendent or above up to 24 more — s.2(2).',
   'After that, a Chief Superintendent or above may apply to a Circuit or District Court judge for a warrant: up to 72 hours, then a further 48 hours — s.2(2).',
   'Never more than 168 hours (7 days) from arrest, not counting time excluded under s.4(8) CJA 1984 for medical attention — s.2(7).',
   'Rest periods do not stop this clock.']},
 s50:{short:'s.50 CJA 2007',name:'Criminal Justice Act 2007, s.50',max:168,scope:'Murder with a firearm or explosive, organised crime and the other offences in s.50(1)',
  stages:[
   {h:6, name:'Initial period',auth:'Member in charge',cite:'s.50(2), (3)'},
   {h:18,name:'1st extension',auth:'Superintendent or above',cite:'s.50(3)',need:'Superintendent direction',act:'Supt extension directed'},
   {h:24,name:'2nd extension',auth:'Chief Superintendent or above',cite:'s.50(3)',need:'Chief Superintendent direction',act:'Chief Supt extension directed'},
   {h:72,name:'1st court warrant',auth:'Circuit or District Court judge — applied for by a Chief Superintendent or above',cite:'s.50(3), (4)',need:'Court warrant (72 h)',act:'Court warrant granted (72 h)',court:1},
   {h:48,name:'2nd court warrant',auth:'Circuit or District Court judge — applied for by a Chief Superintendent or above',cite:'s.50(3), (4)',need:'Second court warrant (48 h)',act:'Court warrant granted (48 h)',court:1}],
  exc:['med','court'],
  law:[
   'Applies to the offences in s.50(1): murder involving a firearm or explosive, murder to which s.3 CJA 1990 applies, s.15 Firearms Act 1925, false imprisonment involving a firearm, organised crime offences under Part 7 CJA 2006, and conspiracy to murder.',
   '6 hours from arrest. A Superintendent or above may direct up to 18 more hours; a Chief Superintendent or above up to 24 more — s.50(3).',
   'After that, a Chief Superintendent or above may apply to a Circuit or District Court judge for warrants of up to 72 hours, then 48 hours. The person must be produced before the judge — s.50(3), (4).',
   'Never more than 168 hours from arrest, not counting time excluded under s.4(8) or (8A) CJA 1984 (medical attention; court applications about lawfulness) — s.50(8).',
   'Rest periods do not stop this clock.']}
};
const EXC={
 rest:{t:'Rest — questioning suspended',ico:'🌙',help:'Midnight to 08:00 only. Needs the person’s written consent and a signed notice. Runs from the notice until the time stated in it — not later than 08:00.'},
 med:{t:'Medical attention',ico:'🏥',help:'Time before reaching the station, or time away from it, while taken to a hospital or other place for medical attention.'},
 court:{t:'At court — lawfulness of detention',ico:'⚖️',help:'Time away from the station for a court application about the lawfulness of the detention.'},
 cert:{t:'Doctor: unfit for questioning',ico:'🩺',help:'A doctor, at Garda request, certifies the person unfit for questioning without needing hospital. Up to 6 hours, once only.'},
 susp:{t:'Detention suspended — released to return',ico:'↩️',help:'The member in charge suspends detention and releases the person on a written notice to return. At most 2 occasions, 4 months in total.'}
};
const EXCITE={s4:{rest:'s.4(6)',med:'s.4(8)',court:'s.4(8A)',cert:'s.4(8B)',susp:'s.4(3A)–(3F)'},dta:{med:'s.4(8) CJA 1984 · s.2(7)'},s50:{med:'s.4(8) CJA 1984 · s.50(8)',court:'s.4(8A) CJA 1984 · s.50(8)'},s30:{}};
const HOW={
 released:'Released',charged:'Charged',court:'Brought to court',transfer:'Transferred',other:'Clock stopped'};

/* ================= storage ================= */
let DB=load();
function load(){try{const d=JSON.parse(localStorage.getItem(LS)||'null');if(d&&Array.isArray(d.clocks))return d;}catch(e){}return {v:1,clocks:[]};}
function persist(){try{localStorage.setItem(LS,JSON.stringify(DB));}catch(e){}}
function save(){persist();updateSummary();paintStrips();}
function purge(){const now=Date.now(),n=DB.clocks.length;DB.clocks=DB.clocks.filter(c=>!c.ended||now-c.ended.at<24*H);if(DB.clocks.length!==n)persist();}
purge();
const active=()=>DB.clocks.filter(c=>!c.ended&&REG[c.reg]);
const byId=id=>DB.clocks.find(c=>c.id===id);

/* ================= the arithmetic ================= */
function intervals(c,now){
  const R=REG[c.reg],iv=[];
  for(const e of c.exc||[]){ if(!R.exc.includes(e.type))continue;
    const a=Math.max(e.from,c.arrest), b=e.to==null?Math.max(now,a):e.to; if(b>a)iv.push([a,b]); }
  iv.sort((x,y)=>x[0]-y[0]);
  const m=[]; for(const x of iv){const l=m[m.length-1]; if(l&&x[0]<=l[1])l[1]=Math.max(l[1],x[1]); else m.push([x[0],x[1]]);}
  return m;
}
// wall-clock moment at which `eff` ms of countable detention have elapsed
function wallAt(c,eff,iv){let t=c.arrest,rem=eff;for(const[a,b]of iv){if(b<=t)continue;if(a>t){const run=a-t;if(rem<=run)return t+rem;rem-=run;}t=Math.max(t,b);}return t+rem;}
// countable detention between arrest and `at`
function effAt(c,at,iv){let e=at-c.arrest;for(const[a,b]of iv){const lo=Math.max(a,c.arrest),hi=Math.min(b,at);if(hi>lo)e-=hi-lo;}return Math.max(0,e);}
function calc(c,now){
  const R=REG[c.reg], stop=c.ended?c.ended.at:now, iv=intervals(c,stop);
  const cums=[]; let cum=0; R.stages.forEach(s=>{cum+=s.h;cums.push(cum*H);});
  const ends=cums.map(x=>wallAt(c,x,iv));
  const cur=Math.min((c.ext||[]).length,R.stages.length-1);
  const eff=effAt(c,stop,iv), left=cums[cur]-eff;
  const ex=(c.exc||[]).filter(e=>R.exc.includes(e.type));
  const paused=c.ended?null:(ex.find(e=>e.to==null&&e.from<=now)||ex.find(e=>e.to!=null&&e.from<=now&&now<e.to)||null);
  return {R,iv,cums,ends,cur,deadline:ends[cur],max:ends[ends.length-1],eff,left,paused,final:cur===R.stages.length-1,
    expired:!c.ended&&now>=ends[cur],actual:stop-c.arrest};
}
const openPause=s=>!!(s.paused&&s.paused.to==null);
const pauseName=e=>EXC[e.type].t.split(' — ')[0].toLowerCase();
function level(s,now){ if(s.expired)return 'x'; const r=s.deadline-now; return r<=30*MIN?'r':r<=2*H?'a':'g'; }
function nextNeed(c,s){ const R=s.R; return s.final?'Charge or release':R.stages[s.cur+1].need; }

/* ================= alerts ================= */
const TH=[120,60,30,0];
const VIB={120:[500],60:[300,200,300],30:[200,120,200,120,200],0:[800,250,800,250,800]};
const alertsOn=()=>{try{return localStorage.getItem(LSA)==='1';}catch(e){return false;}};
const permOK=()=>('Notification' in W)&&Notification.permission==='granted';
let regP=null;
function reg(){
  if(!('serviceWorker' in navigator))return Promise.resolve(null);
  if(!regP)regP=Promise.race([navigator.serviceWorker.ready,new Promise(r=>setTimeout(()=>r(null),2500))]).then(r=>{if(!r)regP=null;return r;}).catch(()=>{regP=null;return null;});
  return regP;
}
async function notify(title,opt){
  if(!permOK())return false;
  const o=Object.assign({icon:'icons/icon-192.png',badge:'icons/badge-clock.png',lang:'en-IE'},opt);
  try{const r=await reg(); if(r&&r.showNotification){await r.showNotification(title,o);return true;}}catch(e){}
  try{new Notification(title,o);return true;}catch(e){}
  return false;
}
async function closeTag(tag){try{const r=await reg();if(!r||!r.getNotifications)return;(await r.getNotifications({tag})).forEach(n=>n.close());}catch(e){}}
function alertText(c,s,th,rem){
  const ref=c.ref||'Detention', st=s.R.stages[s.cur], dl=s.deadline;
  const late=rem!=null&&th>0&&rem<th*MIN-2*MIN;
  const lead=th===0?(s.final?'⛔ Maximum detention reached':'⛔ '+st.name+' has ended')
    :'⏱ '+(late?durStr(rem):(th>=60?(th/60)+' hour'+(th>60?'s':''):th+' minutes'))+' left';
  const title=lead+' — '+ref;
  const nx=s.final?null:s.R.stages[s.cur+1];
  const body=s.R.short+' · '+st.name+' '+(th===0?'ended':'ends')+' '+hm(dl)+' '+day(dl)+'. '
    +(s.final?(th===0?'Charge or release now.':'Charge or release by '+hm(dl)+'.')
      :(th===0?'No longer authorised unless the '+nx.need+' was given before '+hm(dl)+' — record it, or charge or release.':'Needs: '+nx.need+' before '+hm(dl)+'.'));
  return {title,body};
}
function check(){
  const now=Date.now(); let dirty=false;
  for(const c of active()){
    const s=calc(c,now), rem=s.deadline-now; c.fired=c.fired||{};
    for(const th of TH){const k=s.cur+':'+th,f=c.fired[k]; if(f&&s.deadline-f>20*MIN&&rem>th*MIN){delete c.fired[k];dirty=true;}}   // deadline moved later → re-arm
    if(!alertsOn()||openPause(s))continue;
    let hit=null; for(const th of [0,30,60,120]){ if(rem<=th*MIN){hit=th;break;} }
    if(hit==null||c.fired[s.cur+':'+hit])continue;
    for(const th of TH) if(th>=hit&&!c.fired[s.cur+':'+th])c.fired[s.cur+':'+th]=s.deadline;
    dirty=true;
    if(hit===0&&rem<-6*H)continue;                       // long past — the screen shows it, no alarm
    fire(c,s,hit);
  }
  if(dirty){persist();updateSummary();}
}
function fire(c,s,th){
  const t=alertText(c,s,th,s.deadline-Date.now());
  notify(t.title,{body:t.body,tag:'gr-det-'+c.id,renotify:true,requireInteraction:th<=30,vibrate:VIB[th],timestamp:s.deadline,data:{open:'det',id:c.id}});
  if(D.visibilityState==='visible'){ vib(VIB[th]); beep(th); banner(c,t,th); }
}
async function updateSummary(){
  const act=active();
  if(!alertsOn()||!permOK()||!act.length){closeTag('gr-det-sum');return;}
  const now=Date.now();
  const rows=act.map(c=>({c,s:calc(c,now)})).sort((a,b)=>a.s.deadline-b.s.deadline);
  const line=({c,s})=>(c.ref||'Detention')+' · '+s.R.short+' — '
     +(openPause(s)?'⏸ paused ('+pauseName(s.paused)+' since '+hm(s.paused.from)+') · '+durStr(s.left)+' of the '+s.R.stages[s.cur].name.toLowerCase()+' left'
       :(s.paused?'⏸ paused until '+hm(s.paused.to)+' · ':'')+s.R.stages[s.cur].name.toLowerCase()+' '+(s.expired?'ENDED ':'ends ')+hm(s.deadline)+' '+day(s.deadline))
     +(s.final?' · charge or release':' · needs '+nextNeed(c,s))+(s.final||openPause(s)?'':' · max '+hm(s.max)+' '+day(s.max));
  const f=rows[0];
  const title=rows.length===1?'⏱ '+(f.c.ref||'Detention')+' — '+(openPause(f.s)?'clock paused · '+durStr(f.s.left)+' left':(f.s.expired?'period ENDED ':'ends ')+hm(f.s.deadline)+' '+day(f.s.deadline))
    :'⏱ '+rows.length+' detentions — next ends '+hm(f.s.deadline)+' '+day(f.s.deadline);
  notify(title,{body:rows.map(line).join('\n')+'\nAlerts at 2 h · 1 h · 30 min · end',tag:'gr-det-sum',silent:true,renotify:false,requireInteraction:true,timestamp:f.s.deadline,data:{open:'det'}});
}
// sound: 1, 2, 3 short or 3 long tones
let AC=null;
function unlockAudio(){try{const K=W.AudioContext||W.webkitAudioContext;if(!K)return;if(!AC)AC=new K();if(AC.state==='suspended')AC.resume();}catch(e){}}
function beep(th){
  try{ if(!AC||AC.state!=='running')return;
    const n=th===120?1:th===60?2:3, len=th===0?.55:.18, gap=th===0?.25:.14; let t=AC.currentTime+.05;
    for(let i=0;i<n;i++){const o=AC.createOscillator(),g=AC.createGain();o.type='square';o.frequency.value=th===0?660:880;
      g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(.25,t+.02);g.gain.exponentialRampToValueAtTime(.0001,t+len);
      o.connect(g);g.connect(AC.destination);o.start(t);o.stop(t+len+.02);t+=len+gap;}
  }catch(e){}
}
function banner(c,t,th){
  let b=D.getElementById('detBanner'); if(!b){b=D.createElement('div');b.id='detBanner';D.body.appendChild(b);}
  b.className='db-'+(th===0?'x':th===30?'r':'a');
  b.innerHTML='<div class="db-t">'+esc(t.title)+'</div><div class="db-b">'+esc(t.body)+'</div><div class="db-row"><button type="button" class="db-open">Open clock</button><button type="button" class="db-ok">OK</button></div>';
  b.querySelector('.db-open').onclick=()=>{b.className='hidden';openDetention(c.id);};
  b.querySelector('.db-ok').onclick=()=>{b.className='hidden';};
  clearTimeout(b._t); if(th>=60)b._t=setTimeout(()=>{b.className='hidden';},15000);
}
async function enableAlerts(){
  unlockAudio();
  if(!('Notification' in W)){ toast('This browser can’t show notifications — alerts will only show inside the app'); try{localStorage.setItem(LSA,'1');}catch(e){} render(); return; }
  let p=Notification.permission;
  if(p==='default'){ try{p=await Notification.requestPermission();}catch(e){} }
  if(p!=='granted'){ sheetBlocked(); return; }
  try{localStorage.setItem(LSA,'1');}catch(e){}
  vib(VIB[120]);
  check(); updateSummary(); render();
  toast('Alerts on — check the notification bar');
}
function disableAlerts(){ try{localStorage.setItem(LSA,'0');}catch(e){} closeTag('gr-det-sum'); render(); toast('Alerts off'); }
function testAlert(){
  unlockAudio();
  if(!permOK()&&('Notification' in W)&&Notification.permission!=='granted'){ enableAlerts(); return; }
  toast('Test alert in 5 seconds — lock the phone now to check it arrives');
  setTimeout(()=>{
    const t={title:'⏱ TEST — 30 minutes left — Example',body:'This is how a 30-minute warning looks: three short buzzes. 2 h = one long buzz · 1 h = two · 30 min = three short · end = three long.'};
    notify(t.title,{body:t.body,tag:'gr-det-test',renotify:true,vibrate:VIB[30],requireInteraction:false,data:{open:'det'}});
    if(D.visibilityState==='visible'){vib(VIB[30]);beep(30);}
  },5000);
}

/* ================= overlay shell ================= */
let ov=null, main=null, sh=null, view='list', curId=null, deskId=null, wake=null;
function build(){
  if(ov&&ov.isConnected)return;
  ov=D.createElement('div'); ov.id='det'; ov.hidden=true; ov.setAttribute('role','dialog'); ov.setAttribute('aria-label','Detention clock');
  ov.innerHTML='<div class="det-top"><button type="button" class="det-back">‹ Back</button><div class="det-tt"><b class="det-title">Detention clock</b><span class="hudclock" data-f="line"></span></div><button type="button" class="det-bell" aria-label="Alerts"></button></div>'
    +'<div class="det-main"></div><div class="det-shade" hidden></div><div class="det-sheet" hidden></div><div class="det-desk" hidden></div><div class="det-toast"></div>';
  D.body.appendChild(ov);
  main=ov.querySelector('.det-main'); sh=ov.querySelector('.det-sheet');
  ov.querySelector('.det-back').onclick=()=>back();
  ov.querySelector('.det-bell').onclick=()=>{ if(alertsOn()&&permOK())sheetAlerts(); else enableAlerts(); };
  ov.querySelector('.det-shade').onclick=()=>closeSheet();
  ov.addEventListener('click',()=>unlockAudio(),{passive:true});
}
function toast(m){ if(!ov){ if(W.grToast)W.grToast(m); return; } const t=ov.querySelector('.det-toast'); t.textContent=m; t.classList.add('on'); clearTimeout(t._t); t._t=setTimeout(()=>t.classList.remove('on'),3200); }
function openDetention(id){
  build(); purge();
  const bt=D.getElementById('boot'); if(bt&&bt.parentNode)bt.parentNode.removeChild(bt);
  if(id&&byId(id)){view='clock';curId=id;} else if(!ov.hidden&&view!=='list'){/* keep */} else {view='list';curId=null;}
  ov.hidden=false; D.body.classList.add('det-open'); closeSheet(); render(); if(W.grHudTick)W.grHudTick(); check();
  return true;
}
function closeDetention(){ if(!ov)return; closeDesk(); closeSheet(); ov.hidden=true; D.body.classList.remove('det-open'); main.innerHTML=''; }
function back(){
  if(!ov||ov.hidden)return false;
  if(!ov.querySelector('.det-desk').hidden){closeDesk();return true;}
  if(!sh.hidden){closeSheet();return true;}
  if(view!=='list'){view='list';curId=null;render();return true;}
  closeDetention(); return true;
}
function render(){
  if(!ov||ov.hidden)return;
  const bell=ov.querySelector('.det-bell'); const on=alertsOn()&&permOK();
  bell.textContent=on?'🔔':'🔕'; bell.classList.toggle('on',on);
  if(view==='clock'&&byId(curId))renderClock(byId(curId));
  else if(view==='new')renderForm(null);
  else if(view==='edit'&&byId(curId))renderForm(byId(curId));
  else {view='list';renderList();}
  tick(true);
}

/* ================= list ================= */
function alertCard(){
  const on=alertsOn()&&permOK(), blocked=('Notification' in W)&&Notification.permission==='denied';
  if(on)return '<button type="button" class="det-alert on" data-a="sheet"><b>🔔 Alerts on</b><span>Notification bar + vibration at 2 h · 1 h · 30 min · end. Tap for details or a test.</span></button>';
  return '<button type="button" class="det-alert" data-a="enable"><b>🔕 Turn on alerts</b><span>'+(blocked?'Notifications are blocked for this app — tap to see how to allow them.':'Deadlines in your notification bar, with a different vibration at 2 h · 1 h · 30 min · end.')+'</span></button>';
}
function card(c,now){
  const s=calc(c,now), st=s.R.stages[s.cur], lv=level(s,now);
  return '<button type="button" class="det-card lv-'+lv+'" data-id="'+c.id+'"><div class="dc-h"><b>'+esc(c.ref||'Detention')+'</b><span>'+esc(s.R.short)+'</span></div>'
   +'<div class="dc-big" data-cd="'+c.id+'">'+clockStr(s.left)+'</div>'
   +'<div class="dc-s" data-cds="'+c.id+'">'+stLine(c,s,now)+'</div>'
   +'<div class="dc-n">'+(s.final?'Final period — charge or release'+(openPause(s)?'':' by '+esc(hm(s.deadline))):'Next: '+esc(s.R.stages[s.cur+1].need)+(openPause(s)?'':' before '+esc(hm(s.deadline))))+'</div>'
   +bar(c,s,now)+'</button>';
}
function stLine(c,s,now){
  const st=s.R.stages[s.cur];
  if(s.expired)return '<span class="x">'+esc(st.name)+' ENDED '+esc(hm(s.deadline))+' · '+esc(durStr(now-s.deadline))+' ago</span>';
  if(openPause(s))return '<span class="pz">⏸ Paused — '+esc(pauseName(s.paused))+' since '+esc(hm(s.paused.from))+'</span> · '+esc(durStr(s.left))+' of the '+esc(st.name.toLowerCase())+' left when the clock restarts';
  const p=s.paused?'<span class="pz">⏸ paused — '+esc(pauseName(s.paused))+' until '+esc(hm(s.paused.to))+'</span> · ':'';
  return p+esc(st.name)+' ends <b>'+esc(hm(s.deadline))+'</b> · '+esc(day(s.deadline))+' <small>('+esc(inStr(s.deadline-now))+')</small>';
}
function bar(c,s,now){
  const tot=s.cums[s.cums.length-1], pct=Math.min(100,s.eff/tot*100);
  let ticks=''; s.cums.slice(0,-1).forEach(x=>{ticks+='<i style="left:'+(x/tot*100).toFixed(2)+'%"></i>';});
  const auth=(s.cums[s.cur]/tot*100).toFixed(2);
  return '<div class="dc-bar"><span class="dc-auth" style="width:'+auth+'%"></span><span class="dc-fill" data-cdb="'+c.id+'" style="width:'+pct.toFixed(2)+'%"></span>'+ticks+'</div>';
}
function renderList(){
  const now=Date.now(), act=active().sort((a,b)=>calc(a,now).deadline-calc(b,now).deadline), done=DB.clocks.filter(c=>c.ended);
  ov.querySelector('.det-title').textContent='Detention clock';
  let h='<div class="det-wrap">'+alertCard();
  h+=act.length?'<h3 class="det-sec">In custody now</h3>'+act.map(c=>card(c,now)).join(''):'<div class="det-empty">No detention clocks running.</div>';
  h+='<button type="button" class="det-new" data-a="new">＋ New detention</button>';
  if(done.length)h+='<h3 class="det-sec">Ended — deleted automatically after 24 h</h3>'+done.map(c=>{const s=calc(c,now);
    return '<button type="button" class="det-done" data-id="'+c.id+'"><b>'+esc(c.ref||'Detention')+' · '+esc(s.R.short)+'</b><span>'+esc(HOW[c.ended.how]||'Ended')+' '+esc(when(c.ended.at))+' · '+esc(durStr(s.eff))+' on the clock</span></button>';}).join('');
  let seen=false; try{seen=localStorage.getItem(LSI)==='1';}catch(e){}
  h+=howHtml(!act.length&&!seen);
  h+='<p class="det-foot">Aid only — the custody record and the member in charge govern. Check every authorisation against the Act. Saved only on this phone; use a custody record number or initials, never a name.</p></div>';
  main.innerHTML=h; main.scrollTop=0; wireCommon();
  main.querySelectorAll('.det-card,.det-done').forEach(b=>b.onclick=()=>{view='clock';curId=b.dataset.id;render();main.scrollTop=0;});
}
function howHtml(open){
  return '<details class="det-how"'+(open?' open':'')+'><summary>How the alerts work</summary><div class="det-howb">'
  +'<p><b>Notification bar.</b> While a clock runs, your notification bar (and lock screen, if your phone shows notifications there) keeps the current deadline, what is needed before it, and the maximum.</p>'
  +'<p><b>Warnings.</b> For each deadline you get an alert at <b>2 hours</b>, <b>1 hour</b>, <b>30 minutes</b> and <b>when it ends</b>, each with its own rhythm:</p>'
  +'<ul><li>2 h — one long buzz</li><li>1 h — two buzzes</li><li>30 min — three short buzzes (stays on screen)</li><li>End — three long buzzes (stays on screen)</li></ul>'
  +'<p>When an extension is recorded, the warnings move to the new deadline. Adding an excluded period (rest, hospital…) moves them too.</p>'
  +'<p><b>Keep it reliable.</b> Phones pause web apps in the background to save battery, so a warning can arrive late if the app was closed. Leave the app open in the background (don’t swipe it away) and set Battery to <b>Unrestricted</b> for Chrome in your phone’s settings. On a Samsung, also add Chrome to <b>Never sleeping apps</b> (Settings → Battery → Background usage limits — names vary slightly by phone). Any warning that was missed shows as soon as you open the app. Some phones use their standard notification buzz instead of the rhythm — the alert text always says which warning it is. Use “Test alert” to check your phone.</p>'
  +'<p><b>Desk mode</b> keeps the screen on with a large countdown — the most reliable option in the custody area.</p></div></details>';
}
function wireCommon(){
  main.querySelectorAll('[data-a]').forEach(b=>b.addEventListener('click',e=>{const a=b.dataset.a;
    if(a==='enable')enableAlerts(); else if(a==='sheet')sheetAlerts(); else if(a==='new'){view='new';curId=null;render();}
  }));
  const how=main.querySelector('.det-how'); if(how)how.addEventListener('toggle',()=>{try{localStorage.setItem(LSI,'1');}catch(e){}});
}

/* ================= new / edit ================= */
function dtVal(ms){const d=new Date(ms);return {d:d.getFullYear()+'-'+p2(d.getMonth()+1)+'-'+p2(d.getDate()),t:p2(d.getHours())+':'+p2(d.getMinutes())};}
function dtHtml(key,ms,opt){
  opt=opt||{}; const v=ms==null?{d:'',t:''}:dtVal(ms);
  return '<div class="det-dt" data-dt="'+key+'"><input type="date" class="det-in dt-d" value="'+v.d+'" aria-label="Date"><input type="text" class="det-in dt-t" inputmode="numeric" maxlength="5" placeholder="HH:MM" autocomplete="off" aria-label="Time, 24-hour" value="'+v.t+'">'
   +'<div class="dt-q">'+(opt.chips||[['Now',0],['−5 m',-5],['−15 m',-15],['−30 m',-30],['−1 h',-60]]).map(([l,m])=>'<button type="button" data-m="'+m+'">'+l+'</button>').join('')+'</div>'
   +'<div class="dt-read"></div></div>';
}
function parseHM(t){ const m=/^(\d{1,2}):?(\d{2})$/.exec(String(t||'').trim()); if(!m)return null; const h=+m[1],mi=+m[2]; return (h>23||mi>59)?null:[h,mi]; }
function dtRead(root,key){ const w=root.querySelector('[data-dt="'+key+'"]'); if(!w)return NaN; const d=w.querySelector('.dt-d').value, t=parseHM(w.querySelector('.dt-t').value);
  if(!d||!t)return NaN; const [y,mo,da]=d.split('-').map(Number); return new Date(y,mo-1,da,t[0],t[1],0,0).getTime(); }
function dtSet(root,key,ms){ const w=root.querySelector('[data-dt="'+key+'"]'); const v=dtVal(ms); w.querySelector('.dt-d').value=v.d; w.querySelector('.dt-t').value=v.t; dtShow(root,key); }
function dtShow(root,key){ const w=root.querySelector('[data-dt="'+key+'"]'); if(!w)return; const ms=dtRead(root,key), r=w.querySelector('.dt-read');
  const tv=w.querySelector('.dt-t').value.trim(), bad=tv&&tv.length>=4&&!parseHM(tv);
  r.textContent=bad?'Use a 24-hour time, e.g. 07:35 or 19:05':isNaN(ms)?'—':full(ms)+(ms>Date.now()+2*MIN?' · in the future':'');
  r.classList.toggle('warn',!!(bad||ms>Date.now()+2*MIN)); }
function fmtTime(inp){ inp.addEventListener('input',()=>{ const dg=inp.value.replace(/\D/g,'').slice(0,4); const v=dg.length>2?dg.slice(0,2)+':'+dg.slice(2):dg; if(v!==inp.value)inp.value=v; });
  inp.addEventListener('blur',()=>{ const t=parseHM(inp.value); if(t)inp.value=p2(t[0])+':'+p2(t[1]); }); }
function dtWire(root,key,onch){ const w=root.querySelector('[data-dt="'+key+'"]'); if(!w)return;
  fmtTime(w.querySelector('.dt-t'));
  w.querySelectorAll('input').forEach(i=>i.addEventListener('input',()=>{dtShow(root,key);onch&&onch();}));
  w.querySelectorAll('.dt-q button').forEach(b=>b.addEventListener('click',()=>{const n=new Date();n.setSeconds(0,0);dtSet(root,key,n.getTime()+(+b.dataset.m)*MIN);onch&&onch();}));
  dtShow(root,key); }
function renderForm(c){
  const edit=!!c, now=Date.now(); ov.querySelector('.det-title').textContent=edit?'Edit detention':'New detention';
  const r0=edit?c.reg:'s4';
  let h='<div class="det-wrap det-form">'
   +'<label class="det-lab">Reference <small>custody record no. or initials — never a name</small></label><input class="det-in f-ref" maxlength="40" autocomplete="off" placeholder="e.g. CR 1234 or J.M." value="'+esc(edit?c.ref:'')+'">'
   +'<label class="det-lab">Power of detention</label><div class="det-regs">'
   +Object.keys(REG).map(k=>{const R=REG[k];return '<button type="button" class="det-reg'+(k===r0?' on':'')+'" data-r="'+k+'"><b>'+esc(R.short)+'</b><span>up to '+(R.max>=48?R.max+' h ('+(R.max/24)+' days)':R.max+' h')+'</span><small>'+esc(R.scope)+'</small></button>';}).join('')+'</div>'
   +'<label class="det-lab">Time of arrest <small>the clock runs from arrest</small></label>'+dtHtml('arr',edit?c.arrest:Math.floor(now/MIN)*MIN)
   +'<label class="det-lab">Arrived at the station <small>optional</small></label>'+dtHtml('arv',edit?c.arrive:null,{chips:[['Now',0],['−5 m',-5],['−15 m',-15],['−30 m',-30]]})
   +'<label class="det-chk"><input type="checkbox" class="f-med"><span>Taken for medical attention before reaching the station <small>time from arrest to arrival is excluded — s.4(8)</small></span></label>'
   +'<p class="det-err" hidden></p>'
   +'<button type="button" class="det-go">'+(edit?'Save changes':'Start clock')+'</button>'
   +(edit?'<button type="button" class="det-sec-btn f-cancel">Cancel</button>':'')
   +'</div>';
  main.innerHTML=h; main.scrollTop=0;
  let reg=r0;
  const medBox=main.querySelector('.det-chk'), sync=()=>{ medBox.hidden=!REG[reg].exc.includes('med'); };
  main.querySelectorAll('.det-reg').forEach(b=>b.onclick=()=>{reg=b.dataset.r;main.querySelectorAll('.det-reg').forEach(x=>x.classList.toggle('on',x===b));sync();});
  sync(); dtWire(main,'arr'); dtWire(main,'arv');
  if(edit&&c.exc&&c.exc.some(e=>e.pre))main.querySelector('.f-med').checked=true;
  const err=m=>{const e=main.querySelector('.det-err');e.textContent=m;e.hidden=!m;if(m)e.scrollIntoView({block:'center'});};
  if(edit)main.querySelector('.f-cancel').onclick=()=>{view='clock';render();};
  main.querySelector('.det-go').onclick=()=>{
    unlockAudio();
    const arr=dtRead(main,'arr'), arv=dtRead(main,'arv'), ref=main.querySelector('.f-ref').value.trim(), med=main.querySelector('.f-med').checked&&REG[reg].exc.includes('med');
    if(isNaN(arr))return err('Enter the date and time of arrest.');
    if(arr>Date.now()+2*MIN)return err('The arrest time is in the future — check the date and time.');
    if(Date.now()-arr>8*24*H)return err('That arrest time is more than 8 days ago — check the date.');
    if(!isNaN(arv)&&arv<arr)return err('Arrival at the station can’t be before the arrest.');
    if(med&&isNaN(arv))return err('Enter the arrival time so the medical time before arrival can be excluded.');
    const x=edit?c:{id:uid(),ext:[],exc:[],fired:{},created:Date.now()};
    x.ref=ref; x.reg=reg; x.arrest=arr; x.arrive=isNaN(arv)?null:arv;
    x.exc=(x.exc||[]).filter(e=>!e.pre);
    if(med&&arv>arr)x.exc.unshift({id:uid(),type:'med',from:arr,to:arv,pre:1,note:'Before arrival at the station'});
    if(edit&&c.reg!==reg){ x.ext=[]; x.fired={}; }
    x.exc=x.exc.filter(e=>REG[reg].exc.includes(e.type));
    if(!edit)DB.clocks.push(x);
    save(); view='clock'; curId=x.id; render(); main.scrollTop=0; check();
    if(!edit&&!(alertsOn()&&permOK()))setTimeout(()=>toast('Tip: turn on alerts with the 🔕 button at the top'),600);
  };
}

/* ================= one clock ================= */
function renderClock(c){
  const now=Date.now(), s=calc(c,now), R=s.R, lv=c.ended?'e':level(s,now);
  ov.querySelector('.det-title').textContent=(c.ref||'Detention')+' · '+R.short;
  let h='<div class="det-wrap">';
  // hero
  h+='<div class="det-hero lv-'+lv+'">';
  if(c.ended){
    h+='<div class="dh-k">'+esc(HOW[c.ended.how]||'Ended')+' '+esc(when(c.ended.at))+'</div><div class="dh-big">'+durStr(s.eff)+'</div><div class="dh-s">on the detention clock · '+esc(durStr(s.actual))+' actual time since arrest</div>';
  } else {
    const st=R.stages[s.cur];
    h+='<div class="dh-k">'+esc(st.name)+' · '+esc(st.auth.split(' — ')[0])+'</div>'
     +'<div class="dh-big" data-cd="'+c.id+'">'+clockStr(s.left)+'</div>'
     +'<div class="dh-cap" data-cdc="'+c.id+'">'+capLine(s,now)+'</div>'
     +'<div class="dh-s" data-cds="'+c.id+'">'+stLine(c,s,now)+'</div>'
     +'<div class="dh-n">'+(s.final?'Final period — <b>charge or release</b>'+(openPause(s)?'':' by '+esc(when(s.deadline))):'Next: <b>'+esc(R.stages[s.cur+1].need)+'</b>'+(openPause(s)?'':' before '+esc(hm(s.deadline))))+'</div>'
     +bar(c,s,now)
     +'<div class="dh-meta">Arrested '+esc(when(c.arrest))+(c.arrive?' · arrived '+esc(hm(c.arrive)):'')+(s.final?'':' · max '+esc(when(s.max)))+'</div>';
  }
  h+='</div>';
  // actions
  if(!c.ended){
    const nx=s.final?null:R.stages[s.cur+1];
    h+='<div class="det-acts">'
     +(nx?'<button type="button" class="da da-ext" data-a="ext">✓ '+esc(nx.act)+'</button>':'')
     +(R.exc.length?'<button type="button" class="da" data-a="exc">⏸ Excluded period</button>':'')
     +'<button type="button" class="da" data-a="desk">🖥 Desk mode</button>'
     +'<button type="button" class="da da-stop" data-a="stop">■ Stop clock</button>'
     +'<button type="button" class="da" data-a="copy">⧉ Copy summary</button></div>';
  }
  // stages
  h+='<h3 class="det-sec">Stages — '+esc(R.name)+'</h3>'+(openPause(s)?'<p class="det-note pzn">⏸ The clock is paused, so these times move later for as long as the pause lasts.</p>':'')+'<div class="det-stages">';
  R.stages.forEach((st,i)=>{
    const done=i<s.cur, cur=i===s.cur, e=(c.ext||[])[i-1];
    let tag=c.ended?(i<=s.cur?'authorised':'—'):cur?(s.expired?'<b class="x">ENDED</b>':'<b class="now">◉ now</b>'):done?'✓ done':'if '+(st.court?'granted':'directed');
    h+='<div class="dst'+(cur&&!c.ended?' cur':'')+(done?' done':'')+(i>s.cur?' fut':'')+'">'
     +'<div class="dst-l"><b>'+(i+1)+'</b></div><div class="dst-m"><div class="dst-t">'+esc(st.name)+' <small>'+(i?'+':'')+st.h+' h · total '+(s.cums[i]/H)+' h</small></div>'
     +'<div class="dst-e">Clock expires <b>'+esc(hm(s.ends[i]))+'</b> · '+esc(day(s.ends[i]))+(cur&&!c.ended?' <span class="bell" title="Alerts set">'+(alertsOn()&&permOK()?'🔔':'🔕')+'</span>':'')+'</div>'
     +'<div class="dst-a">'+esc(st.auth)+' · '+esc(st.cite)+'</div>'
     +(e?'<div class="dst-g">✓ '+(st.court?'Granted':'Directed')+' '+esc(when(e.at))+(e.by?' — '+esc(e.by):'')+'</div>':'')
     +'</div><div class="dst-r">'+tag+'</div></div>';
  });
  h+='</div>';
  if(!c.ended&&(c.ext||[]).length)h+='<button type="button" class="det-link" data-a="undo">↶ Undo the last extension</button>';
  // excluded periods
  if(R.exc.length){
    const ex=c.exc||[];
    h+='<h3 class="det-sec">Excluded periods — clock stopped</h3>';
    h+=ex.length?'<div class="det-excs">'+ex.map(e=>{const d=(e.to==null?now:e.to)-e.from;
      return '<div class="dex"><div class="dex-i">'+EXC[e.type].ico+'</div><div class="dex-m"><b>'+esc(EXC[e.type].t)+'</b> <small>'+esc((EXCITE[c.reg]||{})[e.type]||'')+'</small>'
       +'<div>'+esc(when(e.from))+' → '+(e.to==null?'<b class="pz">ongoing</b>':esc(e.to-e.from<24*H&&day(e.to)===day(e.from)?hm(e.to):when(e.to)))+' · '+esc(durStr(d))+'</div>'
       +(e.note?'<div class="dex-n">'+esc(e.note)+'</div>':'')+'</div>'
       +'<div class="dex-b">'+(e.to==null&&!c.ended?'<button type="button" data-end="'+e.id+'">End now</button>':'')+(c.ended?'':'<button type="button" class="del" data-del="'+e.id+'">✕</button>')+'</div></div>';}).join('')+'</div>'
      :'<p class="det-note">None recorded. '+(c.ended?'':'Use “Excluded period” for rest, hospital, court or a doctor’s certificate.')+'</p>';
  } else h+='<h3 class="det-sec">Excluded periods</h3><p class="det-note">'+esc(R.law[R.law.length-1])+'</p>';
  // record + law
  if(c.ended)h+='<div class="det-row2"><button type="button" class="det-sec-btn" data-a="copy">⧉ Copy summary</button><span></span></div>';
  h+='<details class="det-law"><summary>The law — '+esc(R.name)+'</summary><ul>'+R.law.map(x=>'<li>'+esc(x)+'</li>').join('')+'</ul><p class="det-note">Checked against the revised Acts (Law Reform Commission). Verify before relying on it.</p></details>';
  if(!alertsOn()||!permOK())h+=alertCard();
  h+='<div class="det-links">'+(c.ended?'':'<button type="button" class="det-link" data-a="edit">✎ Edit details</button>')+'<button type="button" class="det-link del" data-a="delete">Delete this clock</button></div>';
  h+='</div>';
  main.innerHTML=h; wireCommon();
  main.querySelectorAll('[data-a]').forEach(b=>b.addEventListener('click',()=>{const a=b.dataset.a;
    if(a==='ext')sheetExt(c); else if(a==='exc')sheetExc(c); else if(a==='desk')openDesk(c.id); else if(a==='stop')sheetStop(c);
    else if(a==='undo')sheetUndo(c); else if(a==='copy')copySummary(c); else if(a==='edit'){view='edit';render();main.scrollTop=0;} else if(a==='delete')sheetDelete(c);
  }));
  main.querySelectorAll('[data-end]').forEach(b=>b.onclick=()=>{const e=(c.exc||[]).find(x=>x.id===b.dataset.end);if(!e)return;
    let to=Date.now(); if(e.type==='cert'&&to-e.from>6*H)to=e.from+6*H; e.to=to; save(); render(); toast('Excluded period ended — the clock is running again');});
  main.querySelectorAll('[data-del]').forEach(b=>b.onclick=()=>{ if(b.dataset.sure!=='1'){b.dataset.sure='1';b.textContent='Delete?';setTimeout(()=>{b.dataset.sure='';b.textContent='✕';},2500);return;}
    c.exc=(c.exc||[]).filter(x=>x.id!==b.dataset.del); save(); render(); toast('Excluded period removed'); });
}
function capLine(s,now){
  if(s.expired)return '<span class="x">EXPIRED '+clockStr(now-s.deadline)+' ago</span>';
  if(s.paused)return '<span class="pz">⏸ PAUSED — left on the clock</span>';
  return 'left on the clock';
}

/* ================= sheets ================= */
function sheet(html,wire){
  sh.innerHTML='<div class="ds-grip"></div>'+html; sh.hidden=false; ov.querySelector('.det-shade').hidden=false;
  sh.querySelectorAll('.ds-x').forEach(b=>b.onclick=()=>closeSheet());
  wire&&wire(sh); sh.scrollTop=0;
}
function closeSheet(){ if(!sh)return; sh.hidden=true; sh.innerHTML=''; ov.querySelector('.det-shade').hidden=true; }
function sErr(m){const e=sh.querySelector('.det-err');if(e){e.textContent=m;e.hidden=!m;}}
function sheetExt(c){
  const now=Date.now(), s=calc(c,now), nx=s.R.stages[s.cur+1];
  sheet('<h3>✓ '+esc(nx.act)+'</h3><p class="det-note">'+esc(nx.name)+': up to '+nx.h+' more hours — '+esc(nx.auth)+' ('+esc(nx.cite)+'). '+(nx.court?'The warrant must be granted':'The direction must be given')+' before the current period ends at <b>'+esc(when(s.deadline))+'</b>.</p>'
   +'<label class="det-lab">Time '+(nx.court?'granted':'directed')+'</label>'+dtHtml('at',Math.floor(now/MIN)*MIN,{chips:[['Now',0],['−5 m',-5],['−15 m',-15],['−30 m',-30]]})
   +'<label class="det-lab">'+(nx.court?'Judge / court':'By')+' <small>optional — e.g. rank and name</small></label><input class="det-in e-by" maxlength="60" autocomplete="off" placeholder="'+(nx.court?'e.g. Judge, Dublin District Court':'e.g. Supt Byrne')+'">'
   +'<p class="det-err" hidden></p><div class="ds-row"><button type="button" class="det-go e-ok">Record</button><button type="button" class="det-sec-btn ds-x">Cancel</button></div>',root=>{
    dtWire(root,'at');
    let confirmLate=false;
    root.querySelector('.e-ok').onclick=()=>{
      const at=dtRead(root,'at'); if(isNaN(at))return sErr('Enter the time.');
      if(at<c.arrest)return sErr('That is before the arrest.');
      if(at>Date.now()+2*MIN)return sErr('That time is in the future.');
      if(at>=s.deadline&&!confirmLate){confirmLate=true;root.querySelector('.e-ok').textContent='Record anyway';
        return sErr('That is after the current period ended ('+hm(s.deadline)+'). An extension can’t revive detention once the period has run out — check the times. Tap “Record anyway” only if the custody record shows it this way.');}
      c.ext=c.ext||[]; c.ext.push({at,by:root.querySelector('.e-by').value.trim()}); save(); closeSheet(); render(); check();
      toast(nx.name+' recorded — new deadline '+hm(calc(c,Date.now()).deadline));
    };
  });
}
function sheetUndo(c){
  const e=c.ext[c.ext.length-1], st=REG[c.reg].stages[c.ext.length];
  sheet('<h3>↶ Undo last extension?</h3><p class="det-note">Removes “'+esc(st.name)+'” recorded at '+esc(when(e.at))+'. The deadline goes back to the previous stage.</p><div class="ds-row"><button type="button" class="det-go u-ok">Undo it</button><button type="button" class="det-sec-btn ds-x">Cancel</button></div>',root=>{
    root.querySelector('.u-ok').onclick=()=>{c.ext.pop();save();closeSheet();render();check();toast('Extension removed');};});
}
function sheetExc(c){
  const R=REG[c.reg], now=Date.now(); let type=R.exc[0];
  const hr=new Date(now).getHours();
  sheet('<h3>⏸ Excluded period</h3><p class="det-note">Time that does not count towards the detention period. Record it as it appears in the custody record.</p>'
   +'<div class="det-types">'+R.exc.map(k=>'<button type="button" class="det-type'+(k===type?' on':'')+'" data-t="'+k+'"><span>'+EXC[k].ico+'</span><b>'+esc(EXC[k].t)+'</b><small>'+esc((EXCITE[c.reg]||{})[k]||'')+'</small></button>').join('')+'</div>'
   +'<p class="det-help"></p>'
   +'<div class="x-rest-q"'+(hr<8?'':' hidden')+'><button type="button" class="det-sec-btn x-q8">Notice given now → until 08:00</button></div>'
   +'<label class="det-lab">From</label>'+dtHtml('from',Math.floor(now/MIN)*MIN)
   +'<label class="det-lab">Until</label><label class="det-chk"><input type="checkbox" class="x-on"><span>Still ongoing <small>the clock stays paused until you tap “End now”</small></span></label>'+dtHtml('to',null,{chips:[['Now',0],['08:00','8h'],['+1 h',60],['+2 h',120],['+6 h',360]]})
   +'<label class="det-lab">Note <small>optional — e.g. Mater Hospital, notice signed</small></label><input class="det-in x-note" maxlength="80" autocomplete="off">'
   +'<p class="det-err" hidden></p><div class="ds-row"><button type="button" class="det-go x-ok">Add</button><button type="button" class="det-sec-btn ds-x">Cancel</button></div>',root=>{
    dtWire(root,'from');
    // "until" chips are relative to "from" (08:00 = the next 08:00 after "from")
    const toW=root.querySelector('[data-dt="to"]');
    fmtTime(toW.querySelector('.dt-t'));
    toW.querySelectorAll('input').forEach(i=>i.addEventListener('input',()=>dtShow(root,'to')));
    toW.querySelectorAll('.dt-q button').forEach(b=>b.addEventListener('click',()=>{
      let f=dtRead(root,'from'); if(isNaN(f))f=Date.now(); let t;
      if(b.dataset.m==='0'){const n=new Date();n.setSeconds(0,0);t=n.getTime();}
      else if(b.dataset.m==='8h'){const d=new Date(f);d.setHours(8,0,0,0);if(d.getTime()<=f)d.setDate(d.getDate()+1);t=d.getTime();}
      else t=f+(+b.dataset.m)*MIN;
      root.querySelector('.x-on').checked=false; toW.classList.remove('off'); dtSet(root,'to',t);}));
    const on=root.querySelector('.x-on'); on.onchange=()=>toW.classList.toggle('off',on.checked);
    const setType=k=>{type=k;root.querySelectorAll('.det-type').forEach(x=>x.classList.toggle('on',x.dataset.t===k));
      root.querySelector('.det-help').textContent=EXC[k].help; root.querySelector('.x-rest-q').hidden=!(k==='rest'&&new Date().getHours()<8);};
    root.querySelectorAll('.det-type').forEach(b=>b.onclick=()=>setType(b.dataset.t)); setType(type);
    root.querySelector('.x-q8').onclick=()=>{const n=new Date();n.setSeconds(0,0);dtSet(root,'from',n.getTime());const d=new Date(n);d.setHours(8,0,0,0);on.checked=false;toW.classList.remove('off');dtSet(root,'to',d.getTime());};
    root.querySelector('.x-ok').onclick=()=>{
      const from=dtRead(root,'from'), ongoing=on.checked, to=ongoing?null:dtRead(root,'to');
      if(isNaN(from))return sErr('Enter when it started.');
      if(!ongoing&&isNaN(to))return sErr('Enter when it ended, or tick “Still ongoing”.');
      if(!ongoing&&to<=from)return sErr('The end must be after the start.');
      if(from<c.arrest-MIN)return sErr('That starts before the arrest.');
      if(from>Date.now()+2*MIN&&type!=='rest')return sErr('That starts in the future.');
      if(type==='rest'){
        const fd=new Date(from); if(fd.getHours()>=8)return sErr('A rest period can only start between midnight and 08:00 — s.4(6).');
        if(ongoing)return sErr('Enter the time stated in the notice (not later than 08:00).');
        const lim=new Date(from); lim.setHours(8,0,0,0); if(to>lim.getTime())return sErr('The notice can’t run later than 08:00 — s.4(6).');
      }
      if(type==='cert'){
        if((c.exc||[]).some(e=>e.type==='cert'))return sErr('A doctor’s certificate can be used once only — s.4(8B).');
        if(!ongoing&&to-from>6*H)return sErr('A certificate can’t exceed 6 hours — s.4(8B).');
      }
      if(type==='susp'&&(c.exc||[]).filter(e=>e.type==='susp').length>=2)return sErr('Detention can be suspended on 2 occasions at most — s.4(3B).');
      if(ongoing&&(c.exc||[]).some(e=>e.to==null))return sErr('Another excluded period is still ongoing — end it first.');
      const overlap=(c.exc||[]).find(e=>e.from<(to==null?Infinity:to)&&(e.to==null?Infinity:e.to)>from);
      if(overlap)return sErr('This overlaps another excluded period ('+EXC[overlap.type].t.split(' — ')[0]+' from '+hm(overlap.from)+').');
      c.exc=c.exc||[]; c.exc.push({id:uid(),type,from,to,note:root.querySelector('.x-note').value.trim()});
      c.exc.sort((a,b)=>a.from-b.from);
      if(type==='cert'&&ongoing){ /* capped at 6 h when ended */ }
      save(); closeSheet(); render(); check();
      const n=calc(c,Date.now()); toast(openPause(n)?'Clock paused — '+durStr(n.left)+' left when it restarts':'Deadline now '+hm(n.deadline)+' '+day(n.deadline));
    };
  });
}
function sheetStop(c){
  sheet('<h3>■ Stop the clock</h3><p class="det-note">Use when the person is released, charged or transferred. The clock is kept on this phone for 24 hours, then deleted.</p>'
   +'<div class="det-types two">'+Object.keys(HOW).map((k,i)=>'<button type="button" class="det-type'+(i===0?' on':'')+'" data-h="'+k+'"><b>'+esc(HOW[k])+'</b></button>').join('')+'</div>'
   +'<label class="det-lab">Time</label>'+dtHtml('at',Math.floor(Date.now()/MIN)*MIN,{chips:[['Now',0],['−5 m',-5],['−15 m',-15],['−30 m',-30]]})
   +'<p class="det-err" hidden></p><div class="ds-row"><button type="button" class="det-go s-ok">Stop clock</button><button type="button" class="det-sec-btn ds-x">Cancel</button></div>',root=>{
    let how='released'; root.querySelectorAll('[data-h]').forEach(b=>b.onclick=()=>{how=b.dataset.h;root.querySelectorAll('[data-h]').forEach(x=>x.classList.toggle('on',x===b));});
    dtWire(root,'at');
    root.querySelector('.s-ok').onclick=()=>{const at=dtRead(root,'at'); if(isNaN(at))return sErr('Enter the time.'); if(at<c.arrest)return sErr('That is before the arrest.'); if(at>Date.now()+2*MIN)return sErr('That time is in the future.');
      (c.exc||[]).forEach(e=>{if(e.to==null)e.to=Math.max(e.from,at);});
      c.ended={at,how}; save(); closeTag('gr-det-'+c.id); closeSheet(); render(); toast('Clock stopped — '+HOW[how].toLowerCase());};
  });
}
function sheetDelete(c){
  sheet('<h3>Delete this clock?</h3><p class="det-note">Removes “'+esc(c.ref||'Detention')+'” and its record from this phone. This can’t be undone.</p><div class="ds-row"><button type="button" class="det-go danger d-ok">Delete</button><button type="button" class="det-sec-btn ds-x">Cancel</button></div>',root=>{
    root.querySelector('.d-ok').onclick=()=>{DB.clocks=DB.clocks.filter(x=>x!==c);save();closeTag('gr-det-'+c.id);closeSheet();view='list';curId=null;render();toast('Deleted');};});
}
function sheetAlerts(){
  const on=alertsOn()&&permOK();
  sheet('<h3>'+(on?'🔔 Alerts are on':'🔕 Alerts are off')+'</h3>'+howHtml(true).replace('<details class="det-how" open>','<div class="det-how flat">').replace('<summary>How the alerts work</summary>','').replace(/<\/details>$/,'</div>')
   +'<div class="ds-row"><button type="button" class="det-go a-test">Test alert</button>'+(on?'<button type="button" class="det-sec-btn a-off">Turn off</button>':'<button type="button" class="det-sec-btn a-on">Turn on</button>')+'</div><button type="button" class="det-sec-btn ds-x wide">Close</button>',root=>{
    root.querySelector('.a-test').onclick=()=>{closeSheet();testAlert();};
    const off=root.querySelector('.a-off'); if(off)off.onclick=()=>{closeSheet();disableAlerts();};
    const onb=root.querySelector('.a-on'); if(onb)onb.onclick=()=>{closeSheet();enableAlerts();};
  });
}
function sheetBlocked(){
  sheet('<h3>Notifications are blocked</h3><p class="det-note">Android is blocking notifications for this app, so the clock can only warn you while it is on screen.</p>'
   +'<ol class="det-steps"><li>Open your phone’s <b>Settings → Apps</b>.</li><li>Choose <b>Garda Reference</b> (or <b>Chrome</b> if it isn’t listed).</li><li>Tap <b>Notifications</b> and allow them.</li><li>Come back and tap <b>Turn on alerts</b> again.</li></ol>'
   +'<button type="button" class="det-sec-btn ds-x wide">OK</button>');
}
function copySummary(c){
  const now=Date.now(), s=calc(c,now), R=s.R, L=[];
  L.push('DETENTION CLOCK — '+(c.ref||'(no reference)')+' — '+R.name);
  L.push('Arrested: '+full(c.arrest)+(c.arrive?' · Arrived at station: '+full(c.arrive):''));
  R.stages.forEach((st,i)=>{const e=i?(c.ext||[])[i-1]:null;
    L.push((i+1)+'. '+st.name+' ('+(i?'+':'')+st.h+' h, '+st.auth+', '+st.cite+'): expires '+full(s.ends[i])+(e?' — '+(st.court?'granted ':'directed ')+full(e.at)+(e.by?' by '+e.by:''):(i&&i>s.cur?' — if '+(st.court?'granted':'directed'):'')));});
  const ex=c.exc||[];
  L.push('Excluded periods: '+(ex.length?ex.map(e=>EXC[e.type].t+' '+((EXCITE[c.reg]||{})[e.type]||'')+' '+full(e.from)+' to '+(e.to==null?'ongoing':full(e.to))+' ('+durStr((e.to==null?now:e.to)-e.from)+')'+(e.note?' — '+e.note:'')).join('; '):'none'));
  if(c.ended)L.push(HOW[c.ended.how]+': '+full(c.ended.at)+' · time on the clock '+durStr(s.eff)+' · actual '+durStr(s.actual));
  else L.push('Current: '+R.stages[s.cur].name+' expires '+full(s.deadline)+(s.final?'':' · maximum '+full(s.max)));
  L.push('Prepared '+full(now)+' with Garda Reference (aid only — the custody record governs).');
  const txt=L.join('\n');
  (navigator.clipboard&&navigator.clipboard.writeText?navigator.clipboard.writeText(txt):Promise.reject()).then(()=>toast('Summary copied')).catch(()=>{
    sheet('<h3>Summary</h3><textarea class="det-in det-ta" readonly>'+esc(txt)+'</textarea><button type="button" class="det-sec-btn ds-x wide">Close</button>',r=>{const t=r.querySelector('textarea');t.focus();t.select();});});
}

/* ================= desk mode ================= */
function openDesk(id){
  deskId=id; const d=ov.querySelector('.det-desk'); d.hidden=false; paintDesk(true);
  d.onclick=e=>{ if(e.target.closest('.dk-x'))closeDesk(); };
  wantWake(true);
}
function closeDesk(){ if(!ov)return; const d=ov.querySelector('.det-desk'); if(d.hidden)return; d.hidden=true; d.innerHTML=''; deskId=null; wantWake(false); }
function paintDesk(first){
  const d=ov.querySelector('.det-desk'); const c=byId(deskId); if(!c||c.ended){closeDesk();return;}
  const now=Date.now(), s=calc(c,now), lv=level(s,now), st=s.R.stages[s.cur];
  if(first){ d.innerHTML='<button type="button" class="dk-x">‹ Exit desk mode</button><div class="dk-c"><div class="dk-ref"></div><div class="dk-big"></div><div class="dk-cap"></div><div class="dk-dl"></div><div class="dk-n"></div><div class="hudclock dk-now" data-f="line"></div></div><div class="dk-foot">Screen stays on · warnings sound and vibrate here</div>'; }
  d.className='det-desk lv-'+lv;
  d.querySelector('.dk-ref').textContent=(c.ref||'Detention')+' · '+s.R.short+' · '+st.name;
  d.querySelector('.dk-big').textContent=s.expired?'-'+clockStr(now-s.deadline):clockStr(s.left);
  d.querySelector('.dk-cap').textContent=s.expired?'PERIOD ENDED':s.paused?'PAUSED — '+EXC[s.paused.type].t.split(' — ')[0]:'left on the clock';
  d.querySelector('.dk-dl').textContent=openPause(s)?'Restarts when the '+pauseName(s.paused)+' ends':'Ends '+hm(s.deadline)+' · '+day(s.deadline);
  d.querySelector('.dk-n').textContent=s.final?'Final period — charge or release':'Next: '+s.R.stages[s.cur+1].need;
  if(first&&W.grHudTick)W.grHudTick();
}
let wantW=false;
function wantWake(on){ wantW=on; if(on)reqWake(); else if(wake){wake.release().catch(()=>{});wake=null;} }
function reqWake(){ if(!wantW||wake||!navigator.wakeLock||D.visibilityState!=='visible')return; navigator.wakeLock.request('screen').then(l=>{ if(!wantW){l.release().catch(()=>{});return;} wake=l; l.addEventListener('release',()=>{wake=null;}); }).catch(()=>{}); }

/* ================= home-screen strip ================= */
let strips=[];
function mountStrip(el){ if(!el)return; strips=strips.filter(x=>x.isConnected); if(!strips.includes(el))strips.push(el); paintStrip(el,true); }
function paintStrips(){ strips=strips.filter(x=>x.isConnected); strips.forEach(el=>paintStrip(el,true)); }
function paintStrip(el,full_){
  const act=active(), now=Date.now();
  if(!act.length){ if(el.innerHTML)el.innerHTML=''; return; }
  const rows=act.map(c=>({c,s:calc(c,now)})).sort((a,b)=>a.s.deadline-b.s.deadline);
  if(full_||el.childElementCount!==1||el.firstChild.childElementCount!==rows.length+1){
    el.innerHTML='<div class="det-strip"><div class="dsp-h">⏱ IN CUSTODY <span>'+rows.length+'</span></div>'+rows.map(({c})=>'<button type="button" class="dsp-r" data-id="'+c.id+'"></button>').join('')+'</div>';
    el.querySelectorAll('.dsp-r').forEach(b=>b.onclick=()=>openDetention(b.dataset.id));
  }
  rows.forEach(({c,s})=>{ const b=el.querySelector('.dsp-r[data-id="'+c.id+'"]'); if(!b)return; const lv=level(s,now);
    const h='<b>'+esc(c.ref||'Detention')+'</b><span class="dsp-t">'+(s.expired?'ENDED '+hm(s.deadline):clockStr(s.left))+'</span><small>'+esc(s.R.short)+' · '+esc(s.R.stages[s.cur].name.toLowerCase())+' ends '+hm(s.deadline)+(s.paused?' · ⏸ paused':'')+'</small>';
    if(b._h!==h){b.innerHTML=h;b._h=h;} b.className='dsp-r lv-'+lv; });
}

/* ================= ticker ================= */
let lastCheck=0;
function tick(force){
  const now=Date.now();
  if(ov&&!ov.hidden){
    if(view==='clock'||view==='list'){
      main.querySelectorAll('[data-cd]').forEach(el=>{const c=byId(el.dataset.cd); if(!c||c.ended)return; const s=calc(c,now);
        el.textContent=clockStr(s.left);
        const cap=main.querySelector('[data-cdc="'+c.id+'"]'); if(cap){const h=capLine(s,now); if(cap._h!==h){cap.innerHTML=h;cap._h=h;}}
        const sl=main.querySelector('[data-cds="'+c.id+'"]'); if(sl){const h=stLine(c,s,now); if(sl._h!==h){sl.innerHTML=h;sl._h=h;}}
        const fb=main.querySelector('[data-cdb="'+c.id+'"]'); if(fb)fb.style.width=Math.min(100,s.eff/s.cums[s.cums.length-1]*100).toFixed(2)+'%';
        const box=el.closest('.det-card,.det-hero'); if(box){const lv='lv-'+level(s,now); if(!box.classList.contains(lv)){ if(sh.hidden&&!main.contains(D.activeElement))render(); } }
      });
    }
    if(deskId)paintDesk(false);
  }
  strips=strips.filter(x=>x.isConnected); strips.forEach(el=>paintStrip(el,false));
  if(force!==true&&now-lastCheck>=15000){lastCheck=now;check();}
}
setInterval(tick,1000);
D.addEventListener('visibilitychange',()=>{ if(D.visibilityState==='visible'){ purge(); check(); updateSummary(); tick(true); reqWake(); } });
W.addEventListener('pageshow',()=>{check();});

/* ================= notification clicks / deep link ================= */
if('serviceWorker' in navigator){ navigator.serviceWorker.addEventListener('message',e=>{const m=e.data||{}; if(m.gr==='notif'&&m.data&&m.data.open==='det')openDetention(m.data.id);}); }
(function(){ try{ const q=new URLSearchParams(location.search); if(q.get('open')==='det'){ const id=q.get('id'); history.replaceState(history.state,'',location.pathname);
  const go=()=>openDetention(id); if(D.readyState==='loading')D.addEventListener('DOMContentLoaded',()=>setTimeout(go,50)); else setTimeout(go,50); } }catch(e){} })();

// first run after load: fire anything missed while the app was closed; refresh the notification-bar summary
setTimeout(()=>{check();updateSummary();},1200);

W.openDetention=openDetention; W.closeDetention=closeDetention; W.detBack=back;
W.GRDet=Object.freeze({open:openDetention,mountStrip,check,calc:(c,n)=>calc(c,n==null?Date.now():n),REG,_db:()=>DB});
})();
