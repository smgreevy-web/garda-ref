/* Assisting — Gaoler: cell board with check reminders. Each occupied cell has a check interval; 2 minutes before each check
   the phone gives a distinctive buzz (three short, one long — not like a call or a text), and again if a check is overdue.
   Reg. 19(6), S.I. 119/1987: a person kept in a cell is visited about every half hour; a drunken person or a person under the
   influence of drugs is visited, spoken to and roused if necessary about every quarter of an hour for two hours, or longer if
   their condition warrants it. A reminder aid only — the custody record is the record. Saved only on this phone ('gr_gaol'). */
(function(){
'use strict';
const W=window, D=document, N=navigator, MIN=60e3, H=36e5, LS='gr_gaol';
const p2=n=>String(n).padStart(2,'0');
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const DAYS=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'], MON=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const hm=t=>{const d=new Date(t);return p2(d.getHours())+':'+p2(d.getMinutes());};
const dstr=t=>{const d=new Date(t);return DAYS[d.getDay()]+' '+d.getDate()+' '+MON[d.getMonth()]+' '+d.getFullYear();};
const mmss=ms=>{ const neg=ms<0; ms=Math.abs(ms); const s=Math.floor(ms/1000); const m=Math.floor(s/60); return (neg?'-':'')+(m>=60?Math.floor(m/60)+':'+p2(m%60):m)+':'+p2(s%60); };
const minsTxt=ms=>{ const m=Math.round(Math.abs(ms)/MIN); return m<60?m+' min':Math.floor(m/60)+' h '+p2(m%60)+' min'; };
function parseHM(t){ const m=/^(\d{1,2}):?(\d{2})$/.exec(String(t||'').trim()); if(!m||+m[1]>23||+m[2]>59)return null; return [+m[1],+m[2]]; }
// a clock time typed for "earlier": the most recent past occurrence (never in the future, at most 12 h back)
function pastTime(hh,mm){ const n=new Date(), d=new Date(n); d.setHours(hh,mm,0,0); if(d.getTime()>n.getTime()+30e3)d.setDate(d.getDate()-1); return d.getTime(); }
const vib=p=>{ try{ if(N.vibrate)N.vibrate(p); }catch(e){} };
const _sv=b=>'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+b+'</svg>';
const IC={ gear:_sv('<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>') };

/* distinctive patterns: pre-warning = three short + one long (twice); overdue = rapid taps + two long */
const VIB_PRE=[120,90,120,90,120,380,650,700,120,90,120,90,120,380,650];
const VIB_OVER=[90,60,90,60,90,60,90,60,90,60,90,280,900,400,900];
const VIB_2H=[300,150,300];
const PRE=2*MIN, LATE=2*MIN, REPEAT=5*MIN;
const EVERY=[
 {m:30,t:'Every 30 min',s:'Standard — Reg. 19(6)'},
 {m:15,t:'Every 15 min — drink or drugs',s:'Visit, speak to and rouse if necessary · for at least 2 hours',drink:1},
 {m:0,t:'Constant observation',s:'No reminders — someone is watching them continuously'},
 {m:-1,t:'Other interval',s:'As directed by the member in charge'}];
const OTHER=[5,10,20,45,60];

/* ================= state ================= */
let G=load();
function newId(){ return 'c'+Date.now().toString(36)+Math.random().toString(36).slice(2,6); }
function load(){ let g=null; try{ g=JSON.parse(localStorage.getItem(LS)||'null'); }catch(e){}
  if(!g||!Array.isArray(g.cells)||!g.cells.length)g={v:1,cells:[1,2,3,4].map(i=>({id:newId()+i,name:'Cell '+i})),occ:{},log:[],sound:true,setup:false};
  g.occ=g.occ||{}; g.log=g.log||[]; if(g.sound==null)g.sound=true; return g; }
function save(){ try{ localStorage.setItem(LS,JSON.stringify(G)); }catch(e){} }
const cellBy=id=>G.cells.find(c=>c.id===id);
function occList(){ return G.cells.filter(c=>G.occ[c.id]).map(c=>({c,o:G.occ[c.id]})); }
function nextDue(){ let b=null; for(const x of occList()){ if(!x.o.every)continue; if(!b||x.o.due<b.o.due)b=x; } return b; }
function logAdd(e){ G.log.push(Object.assign({t:Date.now()},e)); G.log.sort((a,b)=>a.t-b.t); if(G.log.length>600)G.log=G.log.slice(-600); }
function everyTxt(o){ return !o.every?'constant observation':'every '+o.every+' min'+(o.drink?' · drink/drugs':''); }
function state(o,now){ if(!o.every)return 'obs'; const r=o.due-now; return r<-LATE?'over':r<=PRE?'soon':'ok'; }

/* ================= actions ================= */
function place(cid,{label,every,drink,acc,since}){
  const t=since||Date.now(); G.occ[cid]={since:t,label:(label||'').trim().slice(0,40),every,drink:!!drink,drinkSince:t,acc:!!acc,due:every?t+every*MIN:null,last:null,pre:null,od:null,ask2h:false};
  logAdd({t,c:cid,cn:cellBy(cid).name,k:'in',note:(G.occ[cid].label?G.occ[cid].label+' · ':'')+everyTxt(G.occ[cid])+(acc?' · accompanied visits':'')});
  save(); paint(); unlockAudio(); if(!alertsOn()&&every)maybeAskAlerts(); }
function checked(cid,at,later){ const o=G.occ[cid], c=cellBy(cid); if(!o||!c)return;
  const t=at||Date.now(), late=o.every&&o.due?t-o.due:0;
  logAdd({t,c:cid,cn:c.name,k:'check',late:late>LATE?Math.round(late/MIN):0,later:!!later});
  o.last=t; if(o.every){ o.due=t+o.every*MIN; } o.pre=null; o.od=null;
  save(); closeTag('gr-gaol-'+cid); hideBanner(cid); paint(); vib(35);
  toast(c.name+' checked '+hm(t)+(o.every?' · next '+hm(o.due):'')); }
function setEvery(cid,every,drink){ const o=G.occ[cid], c=cellBy(cid); if(!o)return;
  o.every=every; if(drink&&!o.drink)o.drinkSince=Date.now(); o.drink=!!drink; o.ask2h=false;
  const base=o.last||o.since; o.due=every?Math.max(base+every*MIN,Date.now()+60e3):null;   // never "overdue" the instant it's changed
  if(every&&o.last==null&&o.since+every*MIN<Date.now())o.due=Date.now()+every*MIN;
  o.pre=null; o.od=null; logAdd({c:cid,cn:c.name,k:'every',note:everyTxt(o)}); save(); paint(); }
function vacate(cid,why){ const c=cellBy(cid); if(!G.occ[cid])return; logAdd({c:cid,cn:c.name,k:'out',note:why||''}); delete G.occ[cid]; save(); closeTag('gr-gaol-'+cid); hideBanner(cid); paint(); }
function move(from,to){ const a=cellBy(from), b=cellBy(to); if(!G.occ[from]||G.occ[to]||!b)return; G.occ[to]=G.occ[from]; delete G.occ[from]; logAdd({c:to,cn:b.name,k:'move',note:'from '+a.name}); save(); closeTag('gr-gaol-'+from); hideBanner(from); paint(); }

/* ================= alerts ================= */
const permOK=()=>('Notification' in W)&&Notification.permission==='granted';
const alertsOn=()=>!!G.alerts;
let regP=null;
function reg(){ if(!('serviceWorker' in N))return Promise.resolve(null);
  if(!regP)regP=Promise.race([N.serviceWorker.ready,new Promise(r=>setTimeout(()=>r(null),2500))]).then(r=>{ if(!r)regP=null; return r; }).catch(()=>{ regP=null; return null; });
  return regP; }
async function notify(title,opt){ if(!permOK())return false;
  const o=Object.assign({icon:'icons/icon-192.png',badge:'icons/badge-clock.png',lang:'en-IE'},opt);
  try{ const r=await reg(); if(r&&r.showNotification){ await r.showNotification(title,o); return true; } }catch(e){}
  try{ new Notification(title,o); return true; }catch(e){} return false; }
async function closeTag(tag){ try{ const r=await reg(); if(!r||!r.getNotifications)return; (await r.getNotifications({tag})).forEach(n=>n.close()); }catch(e){} }
async function enableAlerts(){ unlockAudio();
  if(!('Notification' in W)){ G.alerts=true; save(); paint(); toast('Alerts will show inside Assisting only'); return; }
  let p=Notification.permission; if(p==='default'){ try{ p=await Notification.requestPermission(); }catch(e){} }
  G.alerts=true; save(); paint();
  if(p!=='granted')toast('Notifications are blocked — alerts will only show while Assisting is open'); else toast('Alerts on'); }
function maybeAskAlerts(){ if(G.asked)return; G.asked=true; save(); enableAlerts(); }
function alertText(c,o,kind,now,lock){
  const who=c.name+(o.label&&!lock?' ('+o.label+')':'');   // no labels on the lock screen
  const extra=(o.drink?' Speak to them and rouse if necessary.':'')+(o.acc?' Take a second member with you.':'');
  if(kind==='pre')return {t:'🔐 '+who+' — check due '+hm(o.due),b:'In '+Math.max(0,Math.round((o.due-now)/MIN))+' min · '+everyTxt(o)+'.'+extra};
  if(kind==='over')return {t:'⚠️ '+who+' — check OVERDUE',b:'Was due '+hm(o.due)+' ('+minsTxt(now-o.due)+' ago).'+extra+' Record the visit in the custody record.'};
  return {t:'🔐 '+who+' — 2 hours on 15-minute checks',b:'Still under the influence? Keep 15-minute checks. If not, change to 30 min — follow the member in charge’s direction.'}; }
function fire(c,o,kind){ const now=Date.now(), x=alertText(c,o,kind,now), n=alertText(c,o,kind,now,true), pat=kind==='pre'?VIB_PRE:kind==='over'?VIB_OVER:VIB_2H;
  if(alertsOn())notify(n.t,{body:n.b,tag:'gr-gaol-'+c.id,renotify:true,requireInteraction:true,vibrate:pat,timestamp:o.due||now,
    actions:kind==='2h'?[]:[{action:'checked',title:'✓ Checked'}],data:{open:'gaol',id:c.id}});
  if(D.visibilityState==='visible'){ vib(pat); chime(kind); banner(c,x,kind); } }
function tickCheck(){ const now=Date.now(); let dirty=false;
  for(const {c,o} of occList()){
    if(o.every&&o.due){ const rem=o.due-now;
      if(rem<=-LATE){ if(!o.od||now-o.od>=REPEAT){ o.od=now; o.pre=o.due; dirty=true; fire(c,o,'over'); } }
      else if(rem<=PRE&&o.pre!==o.due){ o.pre=o.due; dirty=true; fire(c,o,'pre'); } }
    if(o.drink&&o.every===15&&!o.ask2h&&now-o.drinkSince>=2*H){ o.ask2h=true; dirty=true; fire(c,o,'2h'); } }
  if(dirty)save(); paint(); }
// sound: ding-dong before, rapid pips when overdue (only while Assisting is open)
let AC=null;
function unlockAudio(){ try{ const K=W.AudioContext||W.webkitAudioContext; if(!K)return; if(!AC)AC=new K(); if(AC.state==='suspended')AC.resume(); }catch(e){} }
function chime(kind){ if(!G.sound)return; try{ if(!AC||AC.state!=='running')return; let t=AC.currentTime+.05;
  const tone=(f,len)=>{ const o=AC.createOscillator(), g=AC.createGain(); o.type='sine'; o.frequency.value=f; g.gain.setValueAtTime(.0001,t); g.gain.exponentialRampToValueAtTime(.3,t+.02); g.gain.exponentialRampToValueAtTime(.0001,t+len); o.connect(g); g.connect(AC.destination); o.start(t); o.stop(t+len+.05); };
  const seq=kind==='over'?[[1320,.12,.08],[1320,.12,.08],[1320,.12,.3],[1320,.12,.08],[1320,.12,.08],[1320,.12,0]]:[[1318,.35,.05],[1047,.6,.35],[1318,.35,.05],[1047,.6,0]];
  for(const [f,l,g] of seq){ tone(f,l); t+=l+g; } }catch(e){} }
function banner(c,x,kind){ let b=D.getElementById('glBanner'); if(!b){ b=D.createElement('div'); b.id='glBanner'; D.body.appendChild(b); }
  b.className=kind==='over'?'over':''; b.dataset.cid=c.id;
  b.innerHTML='<div class="t">'+esc(x.t.replace(/^\S+\s/,''))+'</div><div class="b">'+esc(x.b)+'</div><div class="r">'
    +(kind==='2h'?'<button type="button" class="op">Open cells</button><button type="button" class="gck ev">Keep 15 min</button>':'<button type="button" class="op">Open cells</button><button type="button" class="gck ck">✓ Checked</button>')+'</div>';
  b.querySelector('.op').onclick=()=>{ b.className='hidden'; openGaol(); };
  const ck=b.querySelector('.ck'); if(ck)ck.onclick=()=>{ b.className='hidden'; checked(c.id); };
  const ev=b.querySelector('.ev'); if(ev)ev.onclick=()=>{ b.className='hidden'; }; }
function hideBanner(cid){ const b=D.getElementById('glBanner'); if(b&&(!cid||b.dataset.cid===cid))b.className='hidden'; }
function testBuzz(){ unlockAudio(); toast('This is the check buzz — three short, one long'); vib(VIB_PRE); chime('pre');
  if(alertsOn()&&permOK())setTimeout(()=>notify('🔐 TEST — Cell 1 check due in 2 min',{body:'This is how a check reminder looks. Overdue checks buzz fast, then long.',tag:'gr-gaol-test',renotify:true,vibrate:VIB_PRE,data:{open:'gaol'}}),600); }

/* ================= UI shell ================= */
let ov=null, main=null, sh=null, strips=[], wl=null, desk=false;
function build(){ if(ov&&ov.isConnected)return;
  ov=D.createElement('div'); ov.id='gl'; ov.hidden=true; ov.setAttribute('role','dialog'); ov.setAttribute('aria-label','Gaoler cell checks');
  ov.innerHTML='<div class="gl-top"><button type="button" class="gl-back">‹ Back</button><div class="gl-tt"><b class="gl-title">Gaoler · cell checks</b><span class="hudclock" data-f="line"></span></div>'
   +'<button type="button" class="gl-ic" data-a="setup" aria-label="Cells and settings">'+IC.gear+'</button></div><div class="gl-main"></div>'
   +'<div class="gl-desk" hidden></div><div class="gl-shade" hidden></div><div class="gl-sheet" hidden></div><div class="gl-toast" role="status" aria-live="polite"></div>';
  D.body.appendChild(ov); main=ov.querySelector('.gl-main'); sh=ov.querySelector('.gl-sheet');
  ov.querySelector('.gl-back').onclick=()=>back(); ov.querySelector('.gl-shade').onclick=()=>closeSheet();
  ov.querySelector('[data-a="setup"]').onclick=()=>setupSheet();
  ov.addEventListener('pointerdown',unlockAudio,{passive:true});
  main.addEventListener('click',onClick); }
function toast(m){ if(!ov||ov.hidden){ if(W.grToast)W.grToast(m); return; } const t=ov.querySelector('.gl-toast'); t.textContent=m; t.classList.add('on'); clearTimeout(t._t); t._t=setTimeout(()=>t.classList.remove('on'),3200); }
function sheet(html,wire){ sh.innerHTML='<div class="gl-grip"></div>'+html; sh.hidden=false; ov.querySelector('.gl-shade').hidden=false; sh.querySelectorAll('[data-x]').forEach(b=>b.onclick=()=>closeSheet()); wire&&wire(sh); }
function closeSheet(){ if(!sh)return; sh.hidden=true; sh.innerHTML=''; ov.querySelector('.gl-shade').hidden=true; }
function openGaol(cid){ build(); const bt=D.getElementById('boot'); if(bt&&bt.parentNode)bt.parentNode.removeChild(bt);
  ov.hidden=false; closeSheet(); render(); if(cid&&G.occ[cid])cellSheet(cid); if(W.grHudTick)W.grHudTick(); return true; }
function closeGaol(){ if(!ov)return; deskMode(false); closeSheet(); ov.hidden=true; main.innerHTML=''; paintStrips(); }
function back(){ if(!ov||ov.hidden)return false; if(desk){ deskMode(false); return true; } if(!sh.hidden){ closeSheet(); return true; } closeGaol(); return true; }

/* ---------- board ---------- */
function render(){ if(!ov||ov.hidden)return; const now=Date.now(), occ=occList(), nx=nextDue();
  let h='<div class="gl-wrap">';
  h+='<div class="gl-sum"><div><b>'+occ.length+'<small style="font:400 14px var(--gmono);color:var(--gid)"> / '+G.cells.length+'</small></b><span>in cells</span></div><div class="nx">'
    +(nx?'<b>Next check: '+esc(nx.c.name)+' at '+hm(nx.o.due)+'</b><span id="glNx">'+(nx.o.due<now?'overdue by '+minsTxt(now-nx.o.due):'in '+minsTxt(nx.o.due-now))+'</span>':'<b>'+(occ.length?'No timed checks':'All cells vacant')+'</b><span>'+(occ.length?'constant observation only':'tap a cell when you place someone in it')+'</span>')+'</div></div>';
  if(!alertsOn())h+='<div class="gl-alerts"><b>Turn on check alerts.</b> 2 minutes before each check the phone buzzes <b>three short, one long</b> — different from a call or a text. Overdue checks buzz fast, then long.<div class="gl-row"><button type="button" class="gl-sec on" data-a="alerts">Turn on alerts</button><button type="button" class="gl-sec" data-a="test">Feel the buzz</button></div></div>';
  else h+='<div class="gl-alerts ok"><b>Alerts on.</b> For the distinctive buzz on time every time, keep Assisting open — use <b>Desk mode</b> (screen stays on, dimmed). With the phone locked, Android may deliver the reminder late and with its normal buzz.<div class="gl-row"><button type="button" class="gl-sec on" data-a="desk">Desk mode</button><button type="button" class="gl-sec" data-a="test">Feel the buzz</button></div></div>';
  h+='<h3 class="gl-hd">Cells <small>tap a cell</small></h3><div class="gl-board">'+G.cells.map(c=>cellHtml(c,now)).join('')+'</div>';
  const today=G.log.slice().reverse().slice(0,60);
  h+='<h3 class="gl-hd">Check log <small>'+G.log.length+' entr'+(G.log.length===1?'y':'ies')+'</small></h3>';
  h+=today.length?'<ul class="gl-log">'+today.map(logHtml).join('')+'</ul><div class="gl-row"><button type="button" class="gl-sec" data-a="copy">Copy log</button><button type="button" class="gl-sec warn" data-a="clear">Clear log</button></div>':'<div class="gl-empty">Nothing logged yet.</div>';
  h+='<p class="gl-foot"><b>Reg. 19(6), S.I. 119/1987:</b> a person kept in a cell is visited about every half hour; a drunken person or someone under the influence of drugs is visited, spoken to and roused if necessary about every quarter of an hour for two hours, or longer if their condition warrants it. <b>Reg. 19(7):</b> visits to a person of the opposite sex alone in a cell are accompanied. Follow the member in charge and any risk assessment — some people need closer or constant observation. <b>Record every visit in the custody record</b> — this is a reminder aid, saved only on this phone. Keep labels to initials or a custody record number.</p></div>';
  const sc=main.scrollTop; main.innerHTML=h; main.scrollTop=sc; paintStrips(); }
function cellHtml(c,now){ const o=G.occ[c.id];
  if(!o)return '<button type="button" class="gl-cell vac" data-cell="'+c.id+'"><span class="nm"><i></i>'+esc(c.name)+'</span><span class="lb">Vacant</span><span class="add">+ Place someone</span></button>';
  const st=state(o,now), rem=o.every?o.due-now:0, pct=o.every?Math.max(0,Math.min(100,100-(rem/(o.every*MIN))*100)):0;
  return '<div class="gl-cell occ '+st+'" data-cell="'+c.id+'" role="button" tabindex="0"><span class="nm"><i></i>'+esc(c.name)+'</span><span class="lb">'+esc(o.label||'Occupied')+' · since '+hm(o.since)+'</span>'
   +(o.every?'<span class="cd" data-cd="'+c.id+'">'+(rem<0?'−'+mmss(-rem).replace('-',''):mmss(rem))+'<small>'+(rem<0?'late':'to '+hm(o.due))+'</small></span>':'<span class="cd">Constant obs.</span>')
   +'<span class="ev">'+esc(everyTxt(o))+(o.last?' · last '+hm(o.last):'')+'</span>'
   +((o.acc||o.drink)?'<span>'+(o.drink?'<i class="gl-flag am">rouse if needed</i>':'')+(o.acc?'<i class="gl-flag">accompanied</i>':'')+'</span>':'')
   +(o.every?'<span class="bar"><b style="width:'+pct.toFixed(0)+'%"></b></span><button type="button" class="gl-chk" data-chk="'+c.id+'">✓ Checked</button>':'<button type="button" class="gl-chk" data-chk="'+c.id+'">✓ Log a check</button>')+'</div>'; }
function logHtml(e){ const cls=e.k==='check'&&e.late?'late':e.k==='in'?'in':e.k==='out'?'out':'';
  const txt=e.k==='in'?'Placed in '+e.cn:e.k==='check'?e.cn+' checked'+(e.late?' — '+e.late+' min late':'')+(e.later?' (time entered later)':''):e.k==='out'?e.cn+' vacated':e.k==='every'?e.cn+' → '+e.note:e.k==='move'?'Moved to '+e.cn:e.k==='note'?e.cn+' note':e.cn;
  const sub=e.k==='every'||e.k==='check'?'':(e.note||'');
  return '<li class="'+cls+'"><span class="t">'+hm(e.t)+'</span><div><b>'+esc(txt)+'</b>'+(sub?'<span>'+esc(sub)+'</span>':'')+'</div></li>'; }
// live countdowns without re-rendering the whole board
function paint(){ if(ov&&!ov.hidden&&!desk){ const now=Date.now(); let need=false;
    ov.querySelectorAll('.gl-cell.occ').forEach(el=>{ const o=G.occ[el.dataset.cell]; if(!o){ need=true; return; } const st=state(o,now); if(!el.classList.contains(st))need=true;
      const cd=el.querySelector('[data-cd]'); if(cd){ const rem=o.due-now; cd.innerHTML=(rem<0?'−'+mmss(-rem).replace('-',''):mmss(rem))+'<small>'+(rem<0?'late':'to '+hm(o.due))+'</small>'; const b=el.querySelector('.bar b'); if(b)b.style.width=Math.max(0,Math.min(100,100-(rem/(o.every*MIN))*100)).toFixed(0)+'%'; } });
    if(ov.querySelectorAll('.gl-cell.occ').length!==occList().length)need=true;
    const nx=nextDue(), el=ov.querySelector('#glNx'); if(el&&nx)el.textContent=nx.o.due<now?'overdue by '+minsTxt(now-nx.o.due):'in '+minsTxt(nx.o.due-now);
    if(need&&sh.hidden)render(); }
  if(desk)paintDesk(); paintStrips(); }
function onClick(e){ const a=e.target.closest('[data-a]'); if(a&&main.contains(a)){ const k=a.dataset.a;
    if(k==='alerts')enableAlerts(); else if(k==='test')testBuzz(); else if(k==='desk')deskMode(true); else if(k==='copy')copyLog(); else if(k==='clear')clearSheet(); return; }
  const ck=e.target.closest('[data-chk]'); if(ck){ e.stopPropagation(); checked(ck.dataset.chk); return; }
  const cl=e.target.closest('[data-cell]'); if(cl){ const id=cl.dataset.cell; if(G.occ[id])cellSheet(id); else placeSheet(id); } }

/* ---------- sheets ---------- */
function placeSheet(cid){ const c=cellBy(cid); let every=30, drink=false, acc=false, other=false;
  const opts=()=>EVERY.map(x=>'<button type="button" class="gl-opt'+((x.m===-1?other:(!other&&x.m===every))?' on':'')+'" data-m="'+x.m+'"><b>'+x.t+'</b><span>'+x.s+'</span></button>').join('');
  sheet('<h4>'+esc(c.name)+' — place someone</h4><label class="gl-l">Label (optional)</label><input class="gl-in" id="glLb" maxlength="40" placeholder="Initials or custody record no." autocomplete="off">'
   +'<label class="gl-l">Checks</label><div class="gl-opts" id="glOp">'+opts()+'</div><div class="gl-chips" id="glOt" hidden>'+OTHER.map(m=>'<button type="button" class="gl-chip" data-om="'+m+'">'+m+' min</button>').join('')+'</div>'
   +'<button type="button" class="gl-sw" id="glAc"><span>Visits must be accompanied<small>Person of the opposite sex alone in a cell — Reg. 19(7)</small></span><i></i></button>'
   +'<label class="gl-l">Placed in the cell at</label><input class="gl-in sm" id="glAt" inputmode="numeric" maxlength="5" value="'+hm(Date.now())+'"><p id="glFirst" style="margin-top:8px"></p>'
   +'<div class="gl-row"><button type="button" class="gl-sec" data-x="1">Cancel</button><button type="button" class="gl-sec on" id="glGo">Place in '+esc(c.name)+'</button></div>',
   s=>{ const first=()=>{ const tt=parseHM(s.querySelector('#glAt').value), t=tt?pastTime(tt[0],tt[1]):Date.now();
        s.querySelector('#glFirst').innerHTML=every?'First check due <b>'+hm(Math.max(t+every*MIN,Date.now()+60e3))+'</b> · then every '+every+' min':'No reminders — constant observation'; };
     const wireOpts=()=>s.querySelectorAll('.gl-opt').forEach(b=>b.onclick=()=>{ const m=+b.dataset.m; if(m===-1){ other=true; s.querySelector('#glOt').hidden=false; if(!OTHER.includes(every))every=20; }
         else { other=false; every=m; drink=!!(EVERY.find(x=>x.m===m)||{}).drink; s.querySelector('#glOt').hidden=true; }
         if(m===-1)drink=false; s.querySelector('#glOp').innerHTML=opts(); wireOpts(); paintOt(); first(); });
     const paintOt=()=>s.querySelectorAll('.gl-chip').forEach(b=>b.classList.toggle('on',other&&+b.dataset.om===every));
     s.querySelectorAll('.gl-chip').forEach(b=>b.onclick=()=>{ every=+b.dataset.om; paintOt(); first(); });
     wireOpts(); first();
     s.querySelector('#glAt').oninput=e=>{ const v=e.target.value.replace(/[^\d]/g,'').slice(0,4); e.target.value=v.length>2?v.slice(0,2)+':'+v.slice(2):v; first(); };
     s.querySelector('#glAc').onclick=e=>{ acc=!acc; e.currentTarget.classList.toggle('on',acc); };
     s.querySelector('#glGo').onclick=()=>{ const tt=parseHM(s.querySelector('#glAt').value); if(!tt){ toast('Type the time like 14:05'); return; }
       const t=pastTime(tt[0],tt[1]); if(Date.now()-t>12*H){ toast('That time is more than 12 hours ago'); return; }
       const label=s.querySelector('#glLb').value; closeSheet(); place(cid,{label,every,drink,acc,since:t});
       const o=G.occ[cid]; if(o&&o.every&&o.due<Date.now()+60e3)o.due=Date.now()+60e3;   // placed a while ago: first check straight away
       save(); render(); toast(c.name+' occupied'+(every?' · first check '+hm(G.occ[cid].due):'')); }; }); }
function cellSheet(cid){ const c=cellBy(cid), o=G.occ[cid]; if(!o)return; const now=Date.now();
  const vac=G.cells.filter(x=>!G.occ[x.id]);
  sheet('<h4>'+esc(c.name)+(o.label?' · '+esc(o.label):'')+'</h4><p>In the cell since <b>'+hm(o.since)+'</b> · '+esc(everyTxt(o))+(o.last?' · last check <b>'+hm(o.last)+'</b>':' · not checked yet')
    +(o.every?'<br>Next check due <b>'+hm(o.due)+'</b> ('+(o.due<now?minsTxt(now-o.due)+' overdue':'in '+minsTxt(o.due-now))+')':'')+(o.acc?'<br>Visits accompanied (Reg. 19(7)).':'')+'</p>'
    +'<div class="gl-row"><button type="button" class="gl-sec on" id="glCk">✓ Checked now</button><button type="button" class="gl-sec" id="glCkE">Checked earlier…</button></div>'
    +'<div id="glE" hidden><label class="gl-l">Time of the check</label><div style="display:flex;gap:8px"><input class="gl-in sm" id="glEt" inputmode="numeric" maxlength="5" placeholder="hh:mm"><button type="button" class="gl-sec" id="glEgo" style="flex:1">Log it</button></div></div>'
    +'<label class="gl-l">Checks</label><div class="gl-chips">'+[30,15,5,10,20,45,60].map(m=>'<button type="button" class="gl-chip'+(o.every===m?' on':'')+'" data-ev="'+m+'">'+(m===15?'15 min · drink/drugs':m===30?'30 min':m+' min')+'</button>').join('')+'<button type="button" class="gl-chip'+(!o.every?' on':'')+'" data-ev="0">Constant obs.</button></div>'
    +'<label class="gl-l">Note (goes in the log)</label><div style="display:flex;gap:8px"><input class="gl-in" id="glNt" maxlength="120" placeholder="e.g. doctor called · requested water"><button type="button" class="gl-sec" id="glNtGo">Add</button></div>'
    +(vac.length?'<label class="gl-l">Move to</label><div class="gl-chips">'+vac.map(x=>'<button type="button" class="gl-chip" data-mv="'+x.id+'">'+esc(x.name)+'</button>').join('')+'</div>':'')
    +'<div class="gl-row" style="margin-top:16px"><button type="button" class="gl-sec warn" id="glOut">Left the cell / released</button><button type="button" class="gl-sec" data-x="1">Close</button></div>',
   s=>{ s.querySelector('#glCk').onclick=()=>{ closeSheet(); checked(cid); };
     s.querySelector('#glCkE').onclick=()=>{ s.querySelector('#glE').hidden=false; s.querySelector('#glEt').focus(); };
     const et=s.querySelector('#glEt'); et.oninput=()=>{ const v=et.value.replace(/[^\d]/g,'').slice(0,4); et.value=v.length>2?v.slice(0,2)+':'+v.slice(2):v; };
     s.querySelector('#glEgo').onclick=()=>{ const tt=parseHM(et.value); if(!tt){ toast('Type the time like 14:05'); return; } const t=pastTime(tt[0],tt[1]);
       if(t<o.since-60e3){ toast('That’s before they were placed in the cell ('+hm(o.since)+')'); return; } if(o.last&&t<=o.last){ toast('That’s before the last logged check ('+hm(o.last)+')'); return; }
       closeSheet(); checked(cid,t,true); };
     s.querySelectorAll('[data-ev]').forEach(b=>b.onclick=()=>{ const m=+b.dataset.ev; setEvery(cid,m,m===15); closeSheet(); cellSheet(cid); toast(c.name+' → '+everyTxt(G.occ[cid])); });
     s.querySelector('#glNtGo').onclick=()=>{ const v=s.querySelector('#glNt').value.trim(); if(!v)return; logAdd({c:cid,cn:c.name,k:'note',note:v}); save(); closeSheet(); render(); toast('Note logged'); };
     s.querySelectorAll('[data-mv]').forEach(b=>b.onclick=()=>{ const to=b.dataset.mv; closeSheet(); move(cid,to); toast('Moved to '+cellBy(to).name); });
     s.querySelector('#glOut').onclick=()=>{ sheet('<h4>'+esc(c.name)+' — left the cell?</h4><p>Stops the reminders for '+esc(c.name)+' and logs the time. Record it in the custody record.</p><div class="gl-chips">'
         +['Released','Charged — to court','Transferred','Taken to hospital','Moved to interview'].map(w=>'<button type="button" class="gl-chip" data-why="'+esc(w)+'">'+esc(w)+'</button>').join('')+'</div><div class="gl-row"><button type="button" class="gl-sec" data-x="1">Cancel</button><button type="button" class="gl-sec on" id="glOutGo">Vacate '+esc(c.name)+'</button></div>',
         s2=>{ let why=''; s2.querySelectorAll('[data-why]').forEach(b=>b.onclick=()=>{ why=b.dataset.why; s2.querySelectorAll('[data-why]').forEach(x=>x.classList.toggle('on',x===b)); });
           s2.querySelector('#glOutGo').onclick=()=>{ closeSheet(); vacate(cid,why); toast(c.name+' vacated'); }; }); }; }); }
function setupSheet(){ const cells=G.cells.map(c=>({id:c.id,name:c.name}));
  const list=()=>cells.map((c,i)=>'<div style="display:flex;gap:8px;margin-top:7px"><input class="gl-in" data-nm="'+i+'" value="'+esc(c.name)+'" maxlength="24"'+(G.occ[c.id]?' title="Occupied"':'')+'>'+(G.occ[c.id]?'<span class="gl-flag" style="align-self:center">in use</span>':'<button type="button" class="gl-sec" data-rm="'+i+'" style="min-width:52px">✕</button>')+'</div>').join('');
  sheet('<h4>Cells &amp; settings</h4><p>Name the cells as they are at your station — e.g. Cell 1–5, Juvenile room, Detention room.</p><div id="glCl">'+list()+'</div>'
   +'<div class="gl-row"><button type="button" class="gl-sec" id="glAdd">+ Add a cell</button></div>'
   +'<button type="button" class="gl-sw'+(G.sound?' on':'')+'" id="glSnd" style="margin-top:10px"><span>Chime with the buzz<small>Plays while Assisting is open</small></span><i></i></button>'
   +'<button type="button" class="gl-sw'+(alertsOn()?' on':'')+'" id="glAl"><span>Notifications<small>Reminders in the notification bar, with a ✓ Checked button</small></span><i></i></button>'
   +'<div class="gl-row"><button type="button" class="gl-sec" data-x="1">Cancel</button><button type="button" class="gl-sec on" id="glSv">Save</button></div>',
   s=>{ const rw=()=>{ s.querySelector('#glCl').innerHTML=list(); wire(); };
     const wire=()=>{ s.querySelectorAll('[data-nm]').forEach(inp=>inp.oninput=()=>{ cells[+inp.dataset.nm].name=inp.value; });
       s.querySelectorAll('[data-rm]').forEach(b=>b.onclick=()=>{ cells.splice(+b.dataset.rm,1); rw(); }); };
     wire();
     s.querySelector('#glAdd').onclick=()=>{ if(cells.length>=24){ toast('24 cells at most'); return; } cells.push({id:newId(),name:'Cell '+(cells.length+1)}); rw(); };
     s.querySelector('#glSnd').onclick=e=>{ G.sound=!G.sound; e.currentTarget.classList.toggle('on',G.sound); save(); };
     s.querySelector('#glAl').onclick=e=>{ if(alertsOn()){ G.alerts=false; save(); e.currentTarget.classList.remove('on'); } else { enableAlerts(); e.currentTarget.classList.add('on'); } };
     s.querySelector('#glSv').onclick=()=>{ const clean=cells.map((c,i)=>({id:c.id,name:(c.name||'').trim().slice(0,24)||('Cell '+(i+1))}));
       if(!clean.length){ toast('Keep at least one cell'); return; }
       for(const id of Object.keys(G.occ))if(!clean.some(c=>c.id===id))clean.push(G.cells.find(c=>c.id===id));   // never drop an occupied cell
       G.cells=clean; G.setup=true; save(); closeSheet(); render(); toast('Cells saved'); }; }); }
function clearSheet(){ sheet('<h4>Clear the check log?</h4><p>Removes '+G.log.length+' log entries from this phone. Cells stay as they are. Make sure the visits are in the custody record first.</p><div class="gl-row"><button type="button" class="gl-sec" data-x="1">Keep it</button><button type="button" class="gl-sec warn" id="glClr">Clear log</button></div>',
  s=>{ s.querySelector('#glClr').onclick=()=>{ G.log=[]; save(); closeSheet(); render(); toast('Log cleared'); }; }); }
function logText(){ const L=['GAOLER — CELL CHECKS'+(G.log.length?' · '+dstr(G.log[0].t):''),''];
  let day=G.log.length?new Date(G.log[0].t).toDateString():'';
  for(const e of G.log){ if(new Date(e.t).toDateString()!==day){ day=new Date(e.t).toDateString(); L.push('— '+dstr(e.t)+' —'); }
    const txt=e.k==='in'?e.cn+' — placed in cell'+(e.note?' ('+e.note+')':''):e.k==='check'?e.cn+' — checked'+(e.late?' ('+e.late+' min late)':'')+(e.later?' [time entered later]':''):e.k==='out'?e.cn+' — vacated'+(e.note?' ('+e.note+')':''):e.k==='every'?e.cn+' — checks changed to '+e.note:e.k==='move'?e.cn+' — moved in '+e.note:e.cn+' — note: '+e.note;
    L.push(hm(e.t)+'  '+txt); }
  L.push(''); L.push('Times from this phone. Enter each visit in the custody record.'); return L.join('\n'); }
function copyLog(){ const t=logText(), ok=()=>toast('Log copied');
  if(N.clipboard&&N.clipboard.writeText)N.clipboard.writeText(t).then(ok,()=>fb()); else fb();
  function fb(){ const ta=D.createElement('textarea'); ta.value=t; ta.style.cssText='position:fixed;left:-9999px'; D.body.appendChild(ta); ta.select(); try{ D.execCommand('copy'); ok(); }catch(e){ toast('Couldn’t copy'); } ta.remove(); } }

/* ---------- desk mode: screen on, dimmed, hold to confirm a check ---------- */
function deskMode(on){ const d=ov.querySelector('.gl-desk');
  if(on){ desk=true; d.hidden=false; d.innerHTML='<div class="dh"><b>Cell checks · desk mode</b><button type="button" class="dx">Exit</button></div><div class="dl"></div><div class="df">Screen stays on · buzz 3 short + 1 long = check in 2 min · hold ✓ to log a check</div>';
    d.querySelector('.dx').onclick=()=>deskMode(false); paintDesk(true); wake(true); unlockAudio(); }
  else { if(!desk)return; desk=false; d.hidden=true; d.innerHTML=''; wake(false); render(); } }
function paintDesk(first){ const d=ov.querySelector('.gl-desk'), l=d&&d.querySelector('.dl'); if(!l)return; const now=Date.now(), occ=occList();
  if(first||l.childElementCount!==Math.max(1,occ.length)||occ.some(x=>!l.querySelector('[data-dc="'+x.c.id+'"]'))){
    l.innerHTML=occ.length?occ.map(({c})=>'<div class="gl-dr" data-dc="'+c.id+'"><div class="n"></div><div class="c"></div><button type="button" class="h" data-hold="'+c.id+'"><span>Hold to log a check ✓</span></button></div>').join(''):'<div class="gl-dr"><div class="n">All cells vacant</div></div>';
    l.querySelectorAll('[data-hold]').forEach(b=>{ let tm=null; const stop=()=>{ clearTimeout(tm); b.classList.remove('hold'); };
      b.addEventListener('pointerdown',e=>{ e.preventDefault(); b.classList.add('hold'); tm=setTimeout(()=>{ b.classList.remove('hold'); checked(b.dataset.hold); },700); });
      ['pointerup','pointerleave','pointercancel'].forEach(ev=>b.addEventListener(ev,stop)); }); }
  for(const {c,o} of occ){ const row=l.querySelector('[data-dc="'+c.id+'"]'); if(!row)continue; const st=state(o,now), rem=o.every?o.due-now:0;
    row.className='gl-dr '+st; row.querySelector('.n').innerHTML=esc(c.name)+'<small>'+esc((o.label?o.label+' · ':'')+everyTxt(o))+'</small>';
    row.querySelector('.c').innerHTML=o.every?(rem<0?'−'+mmss(-rem).replace('-',''):mmss(rem))+'<small>'+(rem<0?'LATE · due '+hm(o.due):'due '+hm(o.due))+'</small>':'OBS<small>constant</small>'; } }
async function wake(on){ if(!('wakeLock' in N))return; try{ if(on&&!wl&&D.visibilityState==='visible'){ wl=await N.wakeLock.request('screen'); wl.addEventListener('release',()=>{ wl=null; }); } else if(!on&&wl){ const w=wl; wl=null; await w.release(); } }catch(e){} }

/* ================= home strip ================= */
function mountStrip(el){ if(!el)return; strips=strips.filter(x=>x.isConnected); if(!strips.includes(el))strips.push(el); paintStrip(el); }
function paintStrips(){ strips=strips.filter(x=>x.isConnected); strips.forEach(paintStrip); }
function paintStrip(el){ const occ=occList(); if(!occ.length){ if(el.innerHTML)el.innerHTML=''; return; } const now=Date.now(), nx=nextDue();
  const st=nx?state(nx.o,now):'ok', txt=occ.length+' in cells'+(nx?' · next '+nx.c.name+' '+hm(nx.o.due)+(nx.o.due<now?' LATE':' ('+minsTxt(nx.o.due-now)+')'):'');
  let b=el.querySelector('.gl-strip'); if(!b){ el.innerHTML='<button type="button" class="gl-strip"><b>Gaoler</b><span></span><em>Open ›</em></button>'; b=el.querySelector('.gl-strip'); b.onclick=()=>openGaol(); }
  b.className='gl-strip'+(st==='soon'?' soon':st==='over'?' over':''); b.querySelector('span').textContent=txt; }

/* ================= timers, notification clicks, deep link ================= */
setInterval(tickCheck,5000);
setInterval(()=>{ if((ov&&!ov.hidden)||desk)paint(); },1000);
D.addEventListener('visibilitychange',()=>{ if(D.visibilityState==='visible'){ tickCheck(); if(desk)wake(true); } });
if('serviceWorker' in N){ N.serviceWorker.addEventListener('message',e=>{ const m=e.data||{}; if(m.gr!=='notif'||!m.data||m.data.open!=='gaol')return;
  if(m.data.action==='checked'&&m.data.id&&G.occ[m.data.id]){ checked(m.data.id,m.data.ts&&Math.abs(Date.now()-m.data.ts)<6*H?m.data.ts:Date.now()); openGaol(); }
  else openGaol(m.data.id); }); }
(function(){ try{ const q=new URLSearchParams((window.__entry||location).search); if(q.get('open')!=='gaol')return; const id=q.get('id'), act=q.get('act'), ts=+q.get('ts')||0;
  history.replaceState(history.state,'',location.pathname);
  const go=()=>{ if(act==='checked'&&id&&G.occ[id])checked(id,ts&&Math.abs(Date.now()-ts)<6*H?ts:Date.now()); openGaol(act?null:id); };
  if(D.readyState==='loading')D.addEventListener('DOMContentLoaded',()=>setTimeout(go,60)); else setTimeout(go,60); }catch(e){} })();
setTimeout(tickCheck,1500);

W.openGaol=openGaol; W.gaolBack=()=>back();
W.GRGaol=Object.freeze({open:openGaol,mountStrip,_state:()=>G,_tick:tickCheck,_checked:checked,_place:place,_log:logText});
})();
