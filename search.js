/* Assisting — Search tab. One box for everything in the app: instant offline results (search-worker.js) and AI answers
   from Claude that search the app themselves, cite what they used and ask for the facts they need.
   Never searched or sent: your notes, tasks, patrols, recordings, roster, scans. The API key stays on this phone. */
(function(){
'use strict';
const W=window, D=document;
const KEY='gr_apikey', MKEY='gr_ai_model', RKEY='gr_srecent', TKEY='gr_ai_thread';
const MODELS=['claude-sonnet-5','claude-sonnet-4-6'];
const API='https://api.anthropic.com/v1/messages';
const e=s=>String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const I=(n,c)=>W.GRI?W.GRI(n,c):'';
const ls={get(k,d){try{const v=localStorage.getItem(k);return v==null?d:JSON.parse(v);}catch(_){return d;}},set(k,v){try{localStorage.setItem(k,JSON.stringify(v));}catch(_){}}};
const getKey=()=>{ try{ return (localStorage.getItem(KEY)||'').trim(); }catch(_){ return ''; } };

/* ---------- what the app can do: indexed alongside the reference content ---------- */
const APP_HELP=[
 ['patrol','Proactive patrol — record where you walked','Proactive patrol records your foot patrol by GPS with exact times: the route on a map, street names, every stop (where you stood still), distance, and a patrol log you can copy into your notebook or PULSE, or save as a GPX file. Start patrol, keep the app open; pocket mode keeps the screen on but dark. Phone locked or screen off: a web app cannot read GPS with the screen locked, so record with the free GPS Logger app and import the track (share the GPX to Assisting, or Import in patrol settings); Assisting merges it with your patrol and fills the gaps.'],
 ['gaol','Gaoler — cell checks','Gaoler cell board: place a prisoner in a cell, choose the check interval (every 15, 30 or 60 minutes, or constant observation), mark drink or drugs (prompts the 2-hour review), and Assisting buzzes 2 minutes before each check is due and again if it is overdue, with a distinctive vibration per cell. Tap Checked on the alert, the notification or the cell; desk mode lets you hold to check. Every check is logged with the time, including late checks.'],
 ['det','Detention clock','Detention clock for s.4 Criminal Justice Act 1984, s.30 Offences Against the State Act 1939, s.2 Criminal Justice (Drug Trafficking) Act 1996 and s.50 Criminal Justice Act 2007: enter when detention started and it works out when each period expires, extensions and who authorises them, rest periods and excluded time, with alerts before each deadline. The member in charge governs the clock.'],
 ['tasks','Tasks — to-do list','Tasks: a to-do list for CCTV collection, statements, calls, arrests, court and deadlines. Due dates move off weekends and public holidays for legal limits. Completing a task offers follow-ups (e.g. after an arrest: detention clock, statements). Photograph a handwritten list and Assisting turns it into tasks.'],
 ['roster','My roster','Roster: your shift pattern, today and your next tour, leave, court dates, swaps and overtime.'],
 ['notes','Notes','Notes like Samsung Notes: text, sketches, photos, checklists, and a lock. Kept on this phone only.'],
 ['rec','Voice recorder','Voice recorder with markers you can tap during a recording; crash-safe; recordings stay on this phone.'],
 ['scan','Document scanner','Document scanner: photograph pages, flatten and clean them, save a multi-page PDF to the phone.'],
 ['pres','Present to TV','Present to TV: show photos and CCTV clips on a TV through Smart View, DeX or casting.'],
 ['map','Map','Map: Garda stations and districts, traffic and city cameras, Dublin City Council CCTV locations, a Street View pin, drawing and measuring, and a photos layer.'],
 ['cams','Live cameras','Live cameras: street cameras around Fitzgibbon Street and Mountjoy, every M50 camera by junction, Dublin Port, and motorways. Needs signal.'],
 ['firstaid','Medical emergency — first aid','Medical emergency: call 112/999, describe what you see by typing or speaking, and get big step-by-step first aid for 22 conditions with a CPR metronome, timers and an incident log.'],
 ['toolbox','Toolbox','Toolbox: torch, spirit level, inclinometer, compass, ruler, measure, speedometer, location, stopwatch, timer, counter, sound level, magnifier, mirror, QR and barcode scanner, NFC reader, converter, calculator, evidence camera, vibration meter, phone status.'],
 ['search','Search and AI answers','Search: one box searches the whole app offline — manual, case law, guides, offence cards, templates, stencils, first aid and tools. Ask AI gives a smart answer from the app\'s content with sources, and asks for details when they change the answer. Needs signal and your Anthropic API key (Tools → AI search).'],
 ['saved','Saved pages','Saved: tap the star on any manual page to keep it in the Saved tab.'],
 ['textsize','Text size','Text size: the A button at the top of inner screens, or Text size at the bottom of Home. Pinch to zoom while reading.'],
 ['exhibits','Exhibits builder','Exhibits builder: number exhibits (SMG1, SMG2…), describe them by voice or typing, and copy the schedule for your report. Session only.'],
 ['cctvreq','CCTV preservation request','CCTV preservation request: fills in a preservation letter for a business, plus the s.41B Data Protection Act reminder.'],
 ['news','News, radio, TV and social media','Live news (Sky News, RTÉ), Irish radio stations, Garda and crime news, and official Garda social media accounts, read-only in the app. Needs signal.']
];
const TOOLBOX=[['torch','Torch','Torch, flashlight, SOS strobe'],['level','Spirit level','Level, flat surface'],['angle','Inclinometer','Angle, slope'],['compass','Compass','Bearing, direction, north'],
 ['ruler','Ruler','Measure small objects on screen'],['measure','Measure','Measure distance with the camera, evidence photo'],['speed','Speedometer','GPS speed'],['location','Location','Coordinates, address, grid reference'],
 ['stopwatch','Stopwatch','Time an event'],['timer','Timer','Countdown'],['counter','Counter','Tally, count people'],['sound','Sound level','Decibels, noise complaint'],['magnifier','Magnifier','Zoom, read small print'],
 ['mirror','Mirror','Front camera mirror'],['scanner','QR / barcode','Scan QR code or barcode'],['nfc','NFC reader','Read NFC tag or card'],['converter','Converter','Units, speed, distance'],
 ['calculator','Calculator','Sums'],['camera','Evidence camera','Photos with time and location stamp'],['vibro','Vibration meter','Vibration'],['device','Phone status','Battery, signal, storage']];
function extraDocs(){
  const out=[];
  APP_HELP.forEach(([id,t,x])=>out.push({k:'app',p:'app:'+id,t,l:'App feature',x,o:{k:'app',v:id},w:3}));
  TOOLBOX.forEach(([id,t,x])=>out.push({k:'tool',p:'tb:'+id,t:t+' (Toolbox)',l:'Toolbox',x,o:{k:'tool',id},w:3}));
  try{ const fa=W.GRFirstAid&&GRFirstAid.content(); if(fa)fa.conditions.forEach(c=>{
    const L=a=>(a||[]).map(x=>x.text).join('\n');
    const steps=c.variants?c.variants.map(v=>v.label+':\n'+v.steps.map(s=>'- '+s.text).join('\n')).join('\n\n'):(c.steps||[]).map(s=>'- '+s.text).join('\n');
    out.push({k:'fa',p:'fa:'+c.id,t:c.title,l:'First aid · '+(c.subtitle||''),
      x:['Also called: '+(c.keywords||[]).join(', '),'Recognise:\n'+L(c.recognise),'Steps:\n'+steps,'Don’t:\n'+L(c.dont),'Call 112 when:\n'+L(c.call112When)].join('\n\n').slice(0,4000),o:{k:'fa',id:c.id},w:3}); }); }catch(_){}
  return out;
}

/* ---------- worker ---------- */
let wk=null, wInfo=null, wErr=null, rid=0, prog=null;
const waiters=new Map(), readyCbs=[];
function worker(){
  if(wk||wErr)return wk;
  try{ wk=new Worker('search-worker.js'); }catch(err){ wErr=String(err&&err.message||err); return null; }
  wk.onmessage=ev=>{ const m=ev.data||{};
    if(m.t==='prog'){ prog=m; paintPrep(); return; }
    if(m.t==='ready'){ wInfo=m.info; prog=null; readyCbs.splice(0).forEach(f=>f()); paintPrep(); return; }
    const w=waiters.get(m.id); if(!w)return; waiters.delete(m.id);
    if(m.t==='err')w.rej(new Error(m.e)); else w.res(m.r); };
  wk.onerror=ev=>{ wErr=(ev&&ev.message)||'search worker failed'; waiters.forEach(w=>w.rej(new Error(wErr))); waiters.clear(); paintPrep(); };
  wk.postMessage({t:'init',extra:extraDocs()});
  return wk;
}
function call(msg){ return new Promise((res,rej)=>{ const w=worker(); if(!w){rej(new Error(wErr||'no worker'));return;}
  const go=()=>{ const id=++rid; waiters.set(id,{res,rej}); w.postMessage(Object.assign({id},msg)); };
  if(wInfo)go(); else readyCbs.push(go); }); }

/* ---------- state ---------- */
const FILTERS=[['all','All'],['manual','Manual'],['cases','Case law'],['guides','Guides'],['offences','Offences'],['forms','Forms'],['app','App & first aid']];
const TYPE={page:['book-open','Manual'],az:['list','Index'],case:['scale','Case law'],guide:['book-marked','Guide'],off:['shield','Offence card'],sg:['file-text','Statement guide'],
  tpl:['mail','Template'],sten:['layout-template','Stencil'],kb:['book-text','Quick reference'],ops2:['book-text','Quick reference'],major:['siren','Checklist'],
  fa:['heart-pulse','First aid'],tool:['wrench','Toolbox'],app:['smartphone','App']};
const S={q:'',filter:'all',res:null,shown:20,seq:0,keyAsk:null,ai:null};
try{ const t=JSON.parse(sessionStorage.getItem(TKEY)||'null'); if(t&&t.turns)S.ai=t; }catch(_){}
const saveThread=()=>{ try{ sessionStorage.setItem(TKEY,JSON.stringify(S.ai)); }catch(_){} };
let V=null;   // the view element while the Search tab is showing
const on=()=>V&&D.body.contains(V)&&V.querySelector('.tabroot[data-tab="search"]');

/* ---------- render ---------- */
function render(view,opt){
  V=view; worker();
  if(opt&&typeof opt.q==='string'&&opt.q!==S.q){ S.q=opt.q; S.res=null; S.shown=20; }
  view.innerHTML=`<div class="tabroot" data-tab="search" hidden></div>
  <div class="sx-top">
    <div class="sx-box">${I('search')}<input id="q" type="search" placeholder="Search or ask anything…" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="search" value="${e(S.q)}">
      <button type="button" class="sx-clear" aria-label="Clear"${S.q?'':' hidden'}>${I('x')}</button></div>
    <div class="chips sx-f">${FILTERS.map(([k,l])=>`<button type="button" class="chip${S.filter===k?' on':''}" data-f="${k}">${l}<span class="sx-n"></span></button>`).join('')}</div>
  </div>
  <div id="sxPrep" class="sx-prep" hidden></div>
  <div id="aiBox"></div>
  <div id="results"></div>`;
  const q=view.querySelector('#q'); let t=null;
  q.addEventListener('input',()=>{ S.q=q.value; try{ lastQuery=S.q; }catch(_){}
    view.querySelector('.sx-clear').hidden=!S.q; clearTimeout(t); t=setTimeout(run,140); });
  q.addEventListener('keydown',ev=>{ if(ev.key==='Enter'){ ev.preventDefault(); q.blur(); remember(S.q); run(); } });
  view.querySelector('.sx-clear').addEventListener('click',()=>{ S.q=''; q.value=''; try{ lastQuery=''; }catch(_){} view.querySelector('.sx-clear').hidden=true; run(); q.focus(); });
  view.querySelectorAll('.sx-f .chip').forEach(c=>c.addEventListener('click',()=>{ S.filter=c.dataset.f; S.shown=20;
    view.querySelectorAll('.sx-f .chip').forEach(x=>x.classList.toggle('on',x===c)); run(); }));
  paintPrep(); paintAI(); run();
}
function paintPrep(){
  if(!on())return; const el=V.querySelector('#sxPrep'); if(!el)return;
  if(wErr){ el.hidden=false; el.textContent='Search engine failed to start ('+wErr+'). Restart the app.'; return; }
  if(wInfo){ el.hidden=true; if(S.q&&!S.res)run(); return; }
  el.hidden=false; el.innerHTML=`<i class="sx-spin"></i>Preparing search${prog?` · ${Math.round(prog.d/prog.n*100)}%`:'…'}`;
}
async function run(){
  if(!on())return;
  const box=V.querySelector('#results'); const q=S.q.trim();
  if(q.length<2){ S.res=null; paintEmpty(box); return; }
  const seq=++S.seq;
  if(!wInfo){ box.innerHTML=aiCard(q); wireAICard(box); return; }
  let r; try{ r=await call({t:'q',q,filter:S.filter,n:200}); }catch(err){ box.innerHTML='<div class="empty">Search failed: '+e(err.message)+'</div>'; return; }
  if(seq!==S.seq||!on())return;
  S.res=r; paintRes(box);
}
function aiCard(q){
  if(S.ai&&S.ai.turns.length&&S.ai.turns[0].q.toLowerCase()===String(q).toLowerCase())return '';
  return `<button type="button" class="sx-ai" id="sxAsk">${I('sparkles')}<span class="lt"><b>Ask AI</b><span class="sx-aq">“${e(q)}”</span>
    <small>Smart answer from the app's content, with sources — asks for details if they matter</small></span>${I('chevron-right','chev')}</button>`;
}
function wireAICard(box){ const b=box.querySelector('#sxAsk'); if(b)b.addEventListener('click',()=>{ remember(S.q); ask(S.q.trim(),'ask'); }); }
function paintEmpty(box){
  const rec=ls.get(RKEY,[]);
  const n=wInfo&&wInfo.counts||{};
  box.innerHTML=`<div class="sx-intro">
    <div class="sx-ih">${I('sparkles')}<b>Ask in your own words</b></div>
    <p>Type a topic for instant results from everything in the app, or tap <b>Ask AI</b> for an answer that cites its sources and asks you for the details that matter.</p>
    <div class="sx-ex">${['Can I search a car for drugs without a warrant?','How long can I detain someone arrested under s.4?','What do I need to prove for a s.6 public order offence?','How do I object to bail for a repeat burglar?','How do I record a patrol with the phone locked?'].map(x=>`<button type="button" class="sx-exq">${e(x)}</button>`).join('')}</div>
  </div>
  ${rec.length?`<h2 class="sec">Recent searches<span class="sec-r"><button type="button" class="sx-clr">Clear</button></span></h2><div class="lgrp">${rec.map(x=>`<button type="button" class="lrow sx-rec" data-q="${e(x)}">${I('history')}<span class="lt"><b>${e(x)}</b></span>${I('chevron-right','chev')}</button>`).join('')}</div>`:''}
  <h2 class="sec">What's searched</h2>
  <div class="sx-what">${[['book-open',(n.page||1478).toLocaleString('en-IE')+' manual pages'],['scale',(n.case||397)+' cases'],['book-marked',((n.guide||15)+(n.ops2||11)+(n.kb||8))+' guides & quick references'],['shield',((n.off||20)+(n.sg||11))+' offence cards & statement guides'],['mail',((n.tpl||8)+(n.sten||12))+' templates & stencils'],['heart-pulse',(n.fa||22)+' first-aid conditions · '+((n.app||0)+(n.tool||0))+' app tools']].map(([i,t])=>`<div>${I(i)}<span>${e(t)}</span></div>`).join('')}</div>
  <div class="sx-priv">${I('lock')}<span>Your notes, tasks, patrols, recordings and roster are never searched by AI or sent anywhere.</span></div>`;
  box.querySelectorAll('.sx-exq').forEach(b=>b.addEventListener('click',()=>{ S.q=b.textContent; S.filter='all'; V.querySelectorAll('.sx-f .chip').forEach(x=>x.classList.toggle('on',x.dataset.f==='all')); const q=V.querySelector('#q'); if(q)q.value=S.q; V.querySelector('.sx-clear').hidden=false; remember(S.q); run(); ask(S.q,'ask'); }));
  box.querySelectorAll('.sx-rec').forEach(b=>b.addEventListener('click',()=>{ S.q=b.dataset.q; const q=V.querySelector('#q'); if(q)q.value=S.q; V.querySelector('.sx-clear').hidden=false; run(); }));
  const c=box.querySelector('.sx-clr'); if(c)c.addEventListener('click',()=>{ ls.set(RKEY,[]); paintEmpty(box); });
  paintCounts(null);
}
function remember(q){ q=String(q||'').trim(); if(q.length<3)return; const r=ls.get(RKEY,[]).filter(x=>x.toLowerCase()!==q.toLowerCase()); r.unshift(q); ls.set(RKEY,r.slice(0,6)); }
function paintCounts(c){ if(!on())return; V.querySelectorAll('.sx-f .chip').forEach(ch=>{ const n=ch.querySelector('.sx-n'); if(n)n.textContent=c&&c[ch.dataset.f]!=null?' '+c[ch.dataset.f]:''; }); }
function hl(txt,terms){
  let h=e(txt); if(!terms||!terms.length)return h;
  const re=new RegExp('\\b('+terms.filter(t=>t.length>1).map(t=>t.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|')+')[a-z]*','gi');
  return h.replace(re,'<mark>$&</mark>');
}
function paintRes(box){
  const r=S.res; paintCounts(r.counts);
  let h=aiCard(S.q.trim());
  if(!r.items.length){ h+=`<div class="empty">Nothing in the app matches “${e(S.q)}”${S.filter!=='all'?' in this filter':''}. Try fewer or different words${S.filter!=='all'?', or the All filter':''} — or ask AI.</div>`; box.innerHTML=h; wireAICard(box); return; }
  h+=`<h2 class="sec">${S.filter==='all'?'Best matches':e(FILTERS.find(f=>f[0]===S.filter)[1])}<span class="sec-r">${r.total} result${r.total===1?'':'s'}</span></h2><div class="lgrp">`;
  r.items.slice(0,S.shown).forEach((it,i)=>{ const T=TYPE[it.k]||['circle-dot',''];
    h+=`<button type="button" class="lrow sr" data-i="${i}">${I(T[0])}<span class="lt"><b>${e(it.t)}</b><small class="sr-l"><span class="sr-k">${e(T[1])}</span>${it.l?' · '+e(it.l):''}${it.dated?' · <span class="sr-old">verify — 2007</span>':''}</small>${it.snip&&it.k!=='az'?`<span class="sr-snip">${hl(it.snip,r.terms)}</span>`:''}</span></button>`; });
  h+='</div>';
  if(r.items.length>S.shown)h+=`<button type="button" class="sx-more">Show more (${r.items.length-S.shown})</button>`;
  box.innerHTML=h; wireAICard(box);
  box.querySelectorAll('.sr').forEach(b=>b.addEventListener('click',()=>{ remember(S.q); openItem(r.items[+b.dataset.i].o); }));
  const m=box.querySelector('.sx-more'); if(m)m.addEventListener('click',()=>{ S.shown+=30; paintRes(box); });
}

/* ---------- open anything ---------- */
function openItem(o){
  if(!o)return;
  try{
    switch(o.k){
      case 'page': openPage(o.a); break;
      case 'case': openCase(o.n); break;
      case 'guide': openGuide3(o.id); break;
      case 'off': renderOffence(o.i); break;
      case 'sg': renderGuides(o.g); break;
      case 'tpl': openTemplate(o.i); break;
      case 'sten': openStencil(o.i); break;
      case 'major': renderMajor(); break;
      case 'kb': if(o.v==='caution')renderCaution(); else if(o.v==='latin')renderLatin(); else if(o.v==='acronyms')renderAcronyms(); else renderKBtopic(o.v); break;
      case 'ops2': if(o.v==='cautions'||o.v==='declarations')renderCautions(); else if(o.v==='latin'||o.v==='acronyms')renderLang(); else renderDeep(o.v); break;
      case 'fa': if(W.openFirstAid)openFirstAid(o.id); break;
      case 'tool': if(W.openTool)openTool(o.id); break;
      case 'app': openApp(o.v); break;
    }
  }catch(err){ if(W.grToast)grToast('Could not open that: '+err.message); }
}
function openApp(v){
  const f={patrol:'openPatrol',gaol:'openGaol',det:'openDetention',tasks:'openTasks',roster:'openRoster',notes:'openNotes',rec:'openRecorder',scan:'openScanner',
    pres:'openPresent',map:'openOSINT',firstaid:'openFirstAid',toolbox:'openToolbox',news:'openSocial'}[v];
  if(f&&typeof W[f]==='function'){ W[f](); return; }
  if(v==='cams'&&W.openCamReel){ openCamReel(0,null,true); return; }
  if(v==='exhibits'){ renderExhibits(); return; }
  if(v==='cctvreq'){ renderCCTV(); return; }
  if(v==='saved'){ setTab('saved'); render2(); return; }
  if(v==='search'){ W.renderAISettings(); return; }
  if(v==='textsize'){ goHome(); setTimeout(()=>{ const f=D.querySelector('.homefoot'); if(f)f.scrollIntoView({behavior:'smooth'}); },60); return; }
}
function render2(){ if(typeof W.render==='function')W.render(); }

/* ---------- AI ---------- */
const SYSTEM=`You are the research assistant inside Assisting, an independent offline reference app (not an official Garda system) used by a serving Garda — an Irish police officer in Dublin. You answer questions about Irish criminal law, Garda powers and procedure, evidence, case law, statements and paperwork, first aid, and how to use the app's own tools.

How to work:
1. You are given numbered SOURCES retrieved from the app. If they don't clearly answer the question, call search_app with up to 3 short keyword queries (statute names, section numbers, legal terms — e.g. "s.23 Misuse of Drugs Act search vehicle"). You may search at most twice per question.
2. Then call respond.

Rules for the answer:
- Lead with the direct answer in one or two sentences, then the key points (powers, conditions, time limits, what to say or record). Short paragraphs and "- " bullets; **bold** only for key terms. Usually 80–250 words.
- Base every legal point on the sources and cite them inline like [4] or [2][7]. Never cite a source that doesn't support the point.
- Never invent section numbers, time limits, penalties, case names or quotations. If the sources don't cover something, say so plainly ("Not covered in your app"); you may add general knowledge only if it is labelled "General knowledge — verify".
- Sources marked 2007 manual may be out of date; say so when you rely on one.
- If the right answer depends on facts you don't have (e.g. the person's age, where it happened, which offence, time already in custody, consent, whether there's a warrant), still give the best general answer AND ask up to 3 short clarifying questions, each with 2–5 tap-able answer options. Only ask questions whose answers would change the advice.
- When the officer answers your questions, give the specific answer for those facts.
- For questions about using the app, name the feature to open and say how.
- For an urgent medical or danger situation, put "Call 112/999" first.
- This is a reference, not legal advice; the app already shows that, so don't add disclaimers.`;
const TOOLS=[
 {name:'search_app',description:'Search everything in the Assisting app again — manual, case law, guides, offence cards, templates, first aid and app features. Returns new numbered sources.',
  input_schema:{type:'object',properties:{queries:{type:'array',items:{type:'string'},minItems:1,maxItems:3,description:'Short keyword queries, e.g. "s.4 CJA 1984 detention extension", "DPP v JC exclusionary rule".'}},required:['queries']}},
 {name:'respond',description:'Give the answer to show the officer.',
  input_schema:{type:'object',properties:{
   answer:{type:'string',description:'The answer. Plain text with light markdown: short paragraphs, "- " bullets, **bold** for key terms. Cite sources inline as [n].'},
   confidence:{type:'string',enum:['high','medium','low'],description:'high = the sources directly answer it; medium = partly; low = they barely cover it.'},
   questions:{type:'array',maxItems:3,description:'Clarifying questions, only when the facts would change the answer.',items:{type:'object',properties:{q:{type:'string'},options:{type:'array',items:{type:'string'},minItems:2,maxItems:5}},required:['q','options']}},
   follow_ups:{type:'array',maxItems:3,items:{type:'string'},description:'Up to 3 short, useful next questions the officer might ask.'},
   sources_used:{type:'array',items:{type:'integer'},description:'Numbers of the sources the answer relies on.'}},
   required:['answer','confidence','sources_used']}}];

function newThread(){ return {turns:[],msgs:[],srcs:{},n:0,busy:false,pending:[]}; }
function srcBlock(list){
  return list.map(s=>{ const T=TYPE[s.k]||['',s.k];
    return `[${s.n}] ${T[1]} — ${s.t}${s.l?' · '+s.l:''}${s.dated?' (2007 manual — may be out of date)':''}\n${s.text}`; }).join('\n\n');
}
function addSources(list){ const A=S.ai; const out=[];
  for(const s of list){ if(Object.values(A.srcs).some(x=>x.key===s.key))continue; const n=++A.n; const src=Object.assign({n},s); A.srcs[n]=src; out.push(src); }
  return out; }
const sentKeys=()=>Object.values(S.ai.srcs).map(s=>s.key);

async function ask(q,kind,answers){
  q=String(q||'').trim(); if(!q)return;
  if(!getKey()){ S.keyAsk={q,kind,answers}; paintAI(); scrollAI(); return; }
  if(!navigator.onLine){ toastAI('AI needs signal — the offline results below still work.'); return; }
  if(!S.ai||kind==='ask')S.ai=newThread();
  const A=S.ai; if(A.busy)return;
  const snap={m:A.msgs.length,n:A.n,keys:Object.keys(A.srcs),pending:(A.pending||[]).slice()};
  const turn={q,kind,status:'Searching the app…',res:null,err:null,sources:[],answers:answers||null,t:Date.now()};
  A.turns.push(turn); A.busy=true; paintAI(); scrollAI(true);
  try{
    const ctxQ=kind==='ask'?q:[A.turns[0].q,q==='(answers)'?'':q,answers?answers.map(x=>x.a).join(' '):''].join(' ');
    const found=await call({t:'ctx',q:ctxQ,extra:[],exclude:sentKeys(),budget:kind==='ask'?13000:8000});
    const fresh=addSources(found); turn.sources=fresh.map(s=>s.n);
    let text='';
    if(kind==='clarify'&&answers)text='MY ANSWERS TO YOUR QUESTIONS:\n'+answers.map(x=>'- '+x.q+' → '+x.a).join('\n')+(q&&q!=='(answers)'&&!(answers.length===1&&answers[0].a===q)?'\nMore detail: '+q:'')+'\n\nGive the answer for these facts.';
    else if(kind==='follow')text='FOLLOW-UP QUESTION: '+q;
    else text='QUESTION: '+q;
    text+=fresh.length?'\n\nSOURCES FROM THE APP:\n'+srcBlock(fresh):'\n\n(No new sources matched — use the earlier sources or call search_app.)';
    const content=(A.pending||[]).map(id=>({type:'tool_result',tool_use_id:id,content:'Shown to the officer.'}));
    A.pending=[];
    content.push({type:'text',text});
    A.msgs.push({role:'user',content});
    turn.status=`Reading ${fresh.length} source${fresh.length===1?'':'s'}…`; paintAI();
    let searches=0;
    for(let round=0;round<4&&!turn.res;round++){
      const r=await api(A.msgs,searches>=2||round>=3);
      A.msgs.push({role:'assistant',content:r.content});
      const tu=(r.content||[]).filter(x=>x.type==='tool_use');
      const resp=tu.find(x=>x.name==='respond');
      if(resp){ turn.res=clean(resp.input); A.pending=tu.map(x=>x.id); break; }
      if(!tu.length)throw new Error('No answer came back — try again.');
      const results=[];
      for(const call1 of tu){
        if(call1.name!=='search_app'){ results.push({type:'tool_result',tool_use_id:call1.id,content:'Unknown tool.'}); continue; }
        searches++;
        const qs=(call1.input&&Array.isArray(call1.input.queries)?call1.input.queries:[]).slice(0,3).map(String);
        turn.status='Searching: '+qs.join(' · '); paintAI();
        let more=[]; for(const sq of qs){ try{ const f=await call({t:'ctx',q:sq,extra:[],exclude:sentKeys().concat(more.map(m=>m.key)),budget:Math.floor(9000/Math.max(1,qs.length))}); more=more.concat(f); }catch(_){} }
        const added=addSources(more); turn.sources=turn.sources.concat(added.map(x=>x.n));
        results.push({type:'tool_result',tool_use_id:call1.id,content:added.length?'NEW SOURCES:\n'+srcBlock(added):'No new sources found for those terms. Answer from what you have.'});
        turn.status=`Reading ${added.length} more source${added.length===1?'':'s'}…`; paintAI();
      }
      A.msgs.push({role:'user',content:results});
    }
    if(!turn.res)throw new Error('No answer came back — try again.');
  }catch(err){
    turn.err=String(err&&err.message||err); if(err&&err.key){ /* bad key: ask again next time */ }
    A.msgs.length=snap.m; A.pending=snap.pending;                                   // roll back so a retry is a clean request
    for(const k of Object.keys(A.srcs))if(!snap.keys.includes(k))delete A.srcs[k]; A.n=snap.n; turn.sources=[];
  }
  turn.status=''; A.busy=false; saveThread(); paintAI(); scrollAI(true);
  if(on()&&S.res)paintRes(V.querySelector('#results'));
}
function clean(x){ x=x||{};
  const arr=a=>Array.isArray(a)?a:[];
  return {answer:String(x.answer||''),confidence:['high','medium','low'].includes(x.confidence)?x.confidence:'medium',
    questions:arr(x.questions).filter(q=>q&&q.q).slice(0,3).map(q=>({q:String(q.q),options:arr(q.options).map(String).slice(0,5)})),
    follow_ups:arr(x.follow_ups).map(String).slice(0,3),sources_used:arr(x.sources_used).map(n=>+n).filter(n=>n>0)}; }
async function api(msgs,forceRespond){
  const key=getKey(); if(!key)throw new Error('No API key.');
  let models=MODELS.slice(); const pref=localStorage.getItem(MKEY); if(pref&&models.includes(pref))models=[pref].concat(models.filter(m=>m!==pref));
  let lastErr=null;
  for(const model of models){
    for(let attempt=0;attempt<2;attempt++){
      const ac=new AbortController(); const to=setTimeout(()=>ac.abort(),75000);
      let r, d;
      try{
        const body={model,max_tokens:1800,system:[{type:'text',text:SYSTEM,cache_control:{type:'ephemeral'}}],tools:TOOLS,
          tool_choice:forceRespond?{type:'tool',name:'respond'}:{type:'any'},messages:withCache(msgs)};
        r=await fetch(API,{method:'POST',signal:ac.signal,headers:{'content-type':'application/json','x-api-key':key,'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'},body:JSON.stringify(body)});
        d=await r.json().catch(()=>({}));
      }catch(err){ clearTimeout(to); lastErr=new Error(err&&err.name==='AbortError'?'The AI took too long — try again.':'No connection to the AI — check signal.'); if(attempt===0){ await sleep(1200); continue; } throw lastErr; }
      clearTimeout(to);
      if(r.ok){ try{ localStorage.setItem(MKEY,model); }catch(_){} return d; }
      const et=d&&d.error&&d.error.type||'', em=d&&d.error&&d.error.message||('HTTP '+r.status);
      if(r.status===401||et==='authentication_error'){ const err=new Error('Your API key was rejected. Check it in Tools → AI search.'); err.key=1; throw err; }
      if(r.status===404||et==='not_found_error'||/model/i.test(em)&&r.status===400){ lastErr=new Error(em); break; }   // try the next model
      if(/credit balance/i.test(em))throw new Error('Your Anthropic account is out of credit — top up at console.anthropic.com.');
      if(r.status===429)throw new Error('Too many requests right now — wait a minute and try again.');
      if((r.status===529||r.status>=500)&&attempt===0){ await sleep(1500); continue; }
      throw new Error(em);
    }
  }
  throw lastErr||new Error('AI unavailable.');
}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
function withCache(msgs){   // cache the conversation so follow-ups only pay for what's new
  const m=JSON.parse(JSON.stringify(msgs)); const last=m[m.length-1];
  if(last&&Array.isArray(last.content)&&last.content.length){ last.content[last.content.length-1].cache_control={type:'ephemeral'}; }
  return m;
}

/* ---------- AI rendering ---------- */
function md(txt,known){
  const lines=String(txt||'').replace(/\r/g,'').split('\n'); let h='', list=false;
  const inline=s=>e(s).replace(/\*\*([^*]+)\*\*/g,'<b>$1</b>').replace(/(?:\[(\d{1,3})\])+/g,m=>{
    return m.match(/\d{1,3}/g).map(n=>known[n]?`<button type="button" class="cite" data-n="${n}">${n}</button>`:'').join(''); });
  for(const raw of lines){ const t=raw.trim();
    if(!t){ if(list){h+='</ul>';list=false;} continue; }
    const b=t.match(/^(?:[-•*]|\d+[.)])\s+(.*)/);
    if(b){ if(!list){h+='<ul>';list=true;} h+='<li>'+inline(b[1])+'</li>'; continue; }
    if(list){h+='</ul>';list=false;}
    const hd=t.match(/^#{1,4}\s+(.*)/); if(hd){ h+='<p class="ai-h">'+inline(hd[1])+'</p>'; continue; }
    h+='<p>'+inline(t)+'</p>';
  }
  if(list)h+='</ul>'; return h;
}
function paintAI(){
  if(!on())return; const box=V.querySelector('#aiBox'); if(!box)return;
  if(S.keyAsk){ box.innerHTML=keyCard(); wireKey(box); return; }
  const A=S.ai; if(!A||!A.turns.length){ box.innerHTML=''; return; }
  let h='<div class="ai-thread">';
  A.turns.forEach((t,ti)=>{
    const lastTurn=ti===A.turns.length-1;
    h+=`<div class="ai-q">${t.kind==='clarify'&&t.answers?`<span class="ai-qk">Your answers</span>${t.answers.map(a=>e(a.a)).join(' · ')}${t.q&&t.q!=='(answers)'?' · '+e(t.q):''}`:(t.kind==='follow'?'<span class="ai-qk">Follow-up</span>':'')+e(t.kind==='clarify'?'':t.q)}</div>`;
    h+='<div class="ai-a">';
    if(t.status)h+=`<div class="ai-status"><i class="sx-spin"></i>${e(t.status)}</div>`;
    if(t.err)h+=`<div class="ai-err">${I('triangle-alert')}<span>${e(t.err)}</span>${lastTurn?'<button type="button" class="ai-retry">Try again</button>':''}</div>`;
    if(t.res){ const R=t.res;
      h+=`<div class="ai-body">${md(R.answer,A.srcs)}</div>`;
      const used=[...new Set(R.sources_used.filter(n=>A.srcs[n]))];
      h+=`<div class="ai-meta"><span class="ai-conf ${R.confidence}">${R.confidence==='high'?'Well covered':R.confidence==='low'?'Thinly covered — check the sources':'Partly covered'}</span><span>${used.length} source${used.length===1?'':'s'} cited</span></div>`;
      if(lastTurn&&R.questions.length){
        h+=`<div class="ai-clar"><div class="ai-ch">${I('circle-help')}<b>To be more accurate</b></div>`+R.questions.map((qq,qi)=>`<div class="ai-cq" data-qi="${qi}"><div class="ai-cqt">${e(qq.q)}</div><div class="ai-opts">${qq.options.map((o,oi)=>`<button type="button" class="ai-opt" data-qi="${qi}" data-oi="${oi}">${e(o)}</button>`).join('')}</div></div>`).join('')+
          `<div class="ai-more"><input class="ai-extra" type="text" placeholder="Or add details in your own words…" enterkeyhint="send"><button type="button" class="ai-upd" disabled>Update answer</button></div></div>`;
      }
      if(used.length)h+=`<div class="ai-src"><div class="ai-sh">Sources</div>${used.map(n=>srcRow(A.srcs[n])).join('')}</div>`;
      const other=t.sources.filter(n=>!used.includes(n)&&A.srcs[n]);
      if(other.length)h+=`<details class="ai-also"><summary>Also searched · ${other.length}</summary>${other.map(n=>srcRow(A.srcs[n])).join('')}</details>`;
      if(lastTurn&&R.follow_ups.length&&!R.questions.length)h+=`<div class="ai-fu">${R.follow_ups.map(f=>`<button type="button" class="ai-fuq">${I('corner-down-left')}<span>${e(f)}</span></button>`).join('')}</div>`;
    }
    h+='</div>';
  });
  if(!A.busy)h+=`<div class="ai-ask"><input class="ai-fin" type="text" placeholder="Ask a follow-up…" enterkeyhint="send"><button type="button" class="ai-send" aria-label="Send">${I('send')}</button></div>`;
  h+=`<div class="ai-foot"><span>AI can be wrong — check the sources before you rely on it.</span><button type="button" class="ai-new">${I('rotate-ccw')}New question</button></div></div>`;
  box.innerHTML=h; wireAI(box);
}
function srcRow(s){ const T=TYPE[s.k]||['circle-dot',''];
  return `<button type="button" class="ai-s" data-n="${s.n}"><span class="ai-sn">${s.n}</span><span class="lt"><b>${e(s.t)}</b><small>${e(T[1])}${s.l?' · '+e(s.l):''}${s.dated?' · verify — 2007':''}</small></span>${I('chevron-right','chev')}</button>`; }
function wireAI(box){
  const A=S.ai;
  box.querySelectorAll('.cite,.ai-s').forEach(b=>b.addEventListener('click',()=>{ const s=A.srcs[b.dataset.n]; if(s)openItem(s.o); }));
  const picks={};
  const upd=box.querySelector('.ai-upd'), extra=box.querySelector('.ai-extra');
  const nQ=box.querySelectorAll('.ai-cq').length;
  const submit=()=>{ const t=A.turns[A.turns.length-1], R=t.res; if(!R)return;
    const answers=Object.entries(picks).map(([qi,oi])=>({q:R.questions[qi].q,a:R.questions[qi].options[oi]}));
    const x=(extra&&extra.value||'').trim(); if(!answers.length&&!x)return;
    ask(x||'(answers)','clarify',answers.length?answers:[{q:'Details',a:x}]); };
  box.querySelectorAll('.ai-opt').forEach(b=>b.addEventListener('click',()=>{ const qi=b.dataset.qi;
    picks[qi]=+b.dataset.oi; box.querySelectorAll('.ai-opt[data-qi="'+qi+'"]').forEach(x=>x.classList.toggle('on',x===b));
    if(upd)upd.disabled=false;
    if(nQ===1&&!(extra&&extra.value.trim()))submit(); }));
  if(extra){ extra.addEventListener('input',()=>{ if(upd)upd.disabled=!extra.value.trim()&&!Object.keys(picks).length; });
    extra.addEventListener('keydown',ev=>{ if(ev.key==='Enter'){ ev.preventDefault(); submit(); } }); }
  if(upd)upd.addEventListener('click',submit);
  box.querySelectorAll('.ai-fuq').forEach(b=>b.addEventListener('click',()=>ask(b.textContent.trim(),'follow')));
  const fin=box.querySelector('.ai-fin'), send=box.querySelector('.ai-send');
  const go=()=>{ const v=(fin&&fin.value||'').trim(); if(v)ask(v,'follow'); };
  if(fin)fin.addEventListener('keydown',ev=>{ if(ev.key==='Enter'){ ev.preventDefault(); go(); } });
  if(send)send.addEventListener('click',go);
  const nw=box.querySelector('.ai-new'); if(nw)nw.addEventListener('click',()=>{ S.ai=null; saveThread(); paintAI(); if(S.res)paintRes(V.querySelector('#results')); else run(); const q=V.querySelector('#q'); if(q){ q.focus(); } });
  const rt=box.querySelector('.ai-retry'); if(rt)rt.addEventListener('click',()=>{ const t=A.turns.pop(); if(A.turns.length===0)S.ai=null; ask(t.q,A.turns.length?t.kind:'ask',t.answers); });
}
function scrollAI(top){ if(!on())return; const box=V.querySelector('#aiBox'); if(!box)return;
  requestAnimationFrame(()=>{ const qs=box.querySelectorAll(top?'.ai-q':'.ai-clar'); const el=qs[qs.length-1]||box; const hd=V.querySelector('.sx-top'), off=(hd?hd.offsetHeight:60)+4; const y=el.getBoundingClientRect().top-V.getBoundingClientRect().top+V.scrollTop-off; V.scrollTo({top:Math.max(0,y),behavior:'smooth'}); }); }
function toastAI(m){ if(W.grToast)grToast(m); }

/* ---------- API key ---------- */
function keyCard(){
  return `<div class="ai-key"><div class="ai-ch">${I('key-round')}<b>Connect AI answers</b></div>
  <p>Paste your Anthropic API key. It's kept only on this phone and is sent only to Anthropic, with your question and the matching extracts from the app.</p>
  <input class="ai-keyin" type="password" placeholder="sk-ant-…" autocomplete="off" autocapitalize="off" spellcheck="false">
  <div class="ai-kerr" hidden></div>
  <div class="ai-krow"><button type="button" class="ai-ksave">Save &amp; ask</button><button type="button" class="ai-kcancel">Cancel</button></div>
  <small>Create a key at console.anthropic.com → API keys. Each answer costs roughly 1–3 cents of your API credit.</small></div>`;
}
function wireKey(box){
  const inp=box.querySelector('.ai-keyin'), err=box.querySelector('.ai-kerr');
  const save=()=>{ const k=inp.value.trim();
    if(!/^sk-ant-[\w-]{20,}$/.test(k)){ err.hidden=false; err.textContent='That doesn’t look like an Anthropic key — it starts sk-ant-.'; return; }
    try{ localStorage.setItem(KEY,k); }catch(_){}
    const p=S.keyAsk; S.keyAsk=null; paintAI(); if(p)ask(p.q,p.kind,p.answers); };
  box.querySelector('.ai-ksave').addEventListener('click',save);
  inp.addEventListener('keydown',ev=>{ if(ev.key==='Enter'){ ev.preventDefault(); save(); } });
  box.querySelector('.ai-kcancel').addEventListener('click',()=>{ S.keyAsk=null; paintAI(); });
  setTimeout(()=>inp.focus(),50);
}
function renderAISettings(){
  const view=D.getElementById('view'); const k=getKey();
  view.innerHTML=`<h2 class="sec">AI search</h2>
  <div class="tool"><h3>Your key</h3><div class="gtxt">${k?`Saved on this phone: <b>sk-ant-…${e(k.slice(-4))}</b>`:'No key saved yet.'}</div>
    <input class="fin ai-setin" type="password" placeholder="${k?'Paste a new key to replace it':'sk-ant-…'}" autocomplete="off" autocapitalize="off" spellcheck="false">
    <div class="ai-kerr" hidden></div>
    <div class="ai-krow"><button type="button" class="ai-ksave">Save key</button>${k?'<button type="button" class="ai-kdel">Remove key</button>':''}</div></div>
  <div class="tool"><h3>What is sent</h3><div class="gtxt">Only when you tap Ask AI: your question and the matching extracts from the app's reference content (manual, case law, guides, offence cards, templates, first aid, app help) go to Anthropic over an encrypted connection. Your notes, tasks, patrols, recordings, scans and roster are never sent. Don't type names or personal details of members of the public into a question.</div></div>
  <div class="tool"><h3>Cost & model</h3><div class="gtxt">Uses ${e(localStorage.getItem(MKEY)||MODELS[0])}. Each answer costs roughly 1–3 cents from your Anthropic API credit; follow-ups in the same thread cost less. Photo → tasks uses the same key.</div></div>
  <div class="tool"><h3>Accuracy</h3><div class="gtxt">Answers come from the app's own content and cite it — tap a number to check the source. AI can still be wrong or out of date. It is a reference, not legal advice; verify current law and follow direction from your member in charge.</div></div>`;
  view.scrollTop=0;
  const inp=view.querySelector('.ai-setin'), err=view.querySelector('.ai-kerr');
  view.querySelector('.ai-ksave').addEventListener('click',()=>{ const v=inp.value.trim();
    if(!/^sk-ant-[\w-]{20,}$/.test(v)){ err.hidden=false; err.textContent='That doesn’t look like an Anthropic key — it starts sk-ant-.'; return; }
    try{ localStorage.setItem(KEY,v); }catch(_){} toastAI('Key saved on this phone'); renderAISettings(); });
  const del=view.querySelector('.ai-kdel'); if(del)del.addEventListener('click',()=>{ try{ localStorage.removeItem(KEY); }catch(_){} toastAI('Key removed'); renderAISettings(); });
}
W.renderAISettings=renderAISettings;

/* ---------- back button ---------- */
function back(){
  if(!on())return false;
  if(S.keyAsk){ S.keyAsk=null; paintAI(); return true; }
  if(S.ai&&S.ai.turns.length&&!S.ai.busy){ S.ai=null; saveThread(); paintAI(); return true; }
  return false;
}

W.GRSearch={render,back,settings:()=>W.renderAISettings(),ask:(q)=>{ S.q=q; ask(q,'ask'); },
  _state:()=>S,_info:()=>wInfo,_call:call,_md:md,_worker:worker};
/* build the index in the background shortly after start-up, so the first search is instant */
W.addEventListener('load',()=>setTimeout(()=>{ try{ worker(); }catch(_){} },2500));
})();
