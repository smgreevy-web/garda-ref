/* Assisting Pro — the Today and Browse screens, the nine folders and Settings.
   Every tool keeps working as before: this file only decides where each one lives and how the way in looks.
   3D icons: Microsoft Fluent Emoji (MIT licence), bundled in icons/3d so they work offline. */
(function(){
'use strict';
const W=window, D=document;
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const ico=(code,sz)=>{ const u=(W.P3D&&(W.P3D[code]||W.P3D['1f4c4']))||''; return '<span class="pi" style="--s:'+(sz||36)+'px">'+(u?'<img src="'+u+'" alt="">':'')+'</span>'; };
const call=(name,...a)=>()=>{ const f=W[name]; if(typeof f==='function')return f(...a); };
const guide=id=>()=>openGuide3(id);
const page=n=>()=>openPage(n);
const ext=u=>()=>{ try{ W.open(u,'_blank','noopener'); }catch(e){} };
const legacyTab=t=>()=>{ setTab(t); render(); view.scrollTop=0; };

/* ---- every tool: id → [icon, title, one line, action] ---- */
const IT={
 // on the job
 offences:['1f6e1-fe0f','Offences','Elements, arrest power and statement for each offence',()=>renderOffences()],
 ptp:['1f3af','Points to prove','20 offence cards',()=>renderPTP()],
 searchp:['1f50e','Search of the person','Guided: power, grounds, what to say, what to record',call('renderSearchPerson')],
 nb:['1f4d3','Notebook entries','Every offence, search and incident',call('renderNBLib')],
 rs:['1f9e0','Reasonable suspicion','Think it through, with grounds for your notebook',call('renderRS')],
 cautions:['1f4ac','Cautions and declarations','The wording, ready to read out',()=>renderCautions()],
 caution:['1f5e3-fe0f','Caution — when, and the case law','Questioning, statements, key cases',()=>renderCaution()],
 scene:['1f6a8','First at scene','Major incident: first response and the golden hour',()=>renderMajor()],
 patrol:['1f6b6','Proactive patrol','GPS route, stops, times and a patrol log',call('openPatrol')],
 route:['1f697','Emergency route','Straight to a call, on any road',call('openRoute')],
 firstaid:['1f691','Medical emergency','112/999, CPR metronome and 22 conditions',call('openFirstAid')],
 toolbox:['1f9f0','Toolbox','Ruler, evidence camera, level, compass, torch, timers',call('openToolbox')],
 weapons:['1f52a','Weapons and knives','Offences, search and seizure',()=>renderKBtopic('weapons')],
 seizure:['1f511','Seizure powers','Quick reference',()=>renderKBtopic('seizure')],
 rtc:['1f6a6','Traffic collision','Investigation guide',()=>renderKBtopic('rtc')],
 escooter:['1f6f4','E-scooters','Status, charges and collisions',()=>renderKBtopic('escooter')],
 wanted:['1f575-fe0f','Most wanted','Interpol, FBI, Europe, UK and wanted by Ireland',()=>renderWanted()],
 // custody & court
 clock:['23f0','Detention clock','Deadlines, extensions, excluded periods and alerts',()=>{ if(W.openDetention)openDetention(); else renderClock(); }],
 gaol:['1f6aa','Gaoler — cell checks','Cell board, with a buzz before each check',call('openGaol')],
 rights:['1f5e3-fe0f','Rights and languages','The official letter of rights, and finding the right interpreter',()=>renderRights()],
 bail:['2696-fe0f','Objecting to bail','O’Callaghan, s.2 and the burglary presumption',guide('bail')],
 ocall:['1f4cb','O’Callaghan worksheet','A systematic objection',guide('ocall')],
 bailpack:['1f4c1','Bail pack','Case-manager worksheet',()=>openTemplate(TPL.findIndex(t=>t.id==='bailpack'))],
 courtlists:['1f4c6','Court lists','CCJ and all Dublin courts, today',()=>renderCourtLists()],
 courtday:['1f3db-fe0f','Court-day mode','Everything for the stand',()=>renderCourtDay()],
 sentencing:['1f9d1-200d-2696-fe0f','Aggravating and mitigating','Sentencing: what to bring to court',guide('sentencing')],
 crossexam:['1f5e3-fe0f','Cross-examination','Surviving the stand',page(941)],
 // law
 essentials:['2b50','Essential case law','The ones that changed everything',()=>renderEssentials()],
 cases:['1f4da','Full case library','Every case by topic',()=>{ ixKind='case'; setTab('index'); render(); view.scrollTop=0; }],
 judg:['1f50d','Judgments search','BAILII: Supreme, Appeal and High Court',()=>renderJudgments()],
 amend:['1f4f0','Recent amendments','New laws by area — verify',guide('amendments')],
 discretion:['1f4a1','Garda discretion','Legal basis, limits and recording',guide('discretion')],
 inference:['1f9e0','Inference aide','ss.18, 19 and 19A',page(955)],
 evidence:['1f4d8','Law of evidence','Volume 12, Part B',page(945)],
 advokate:['1f441-fe0f','ADVOKATE','Identification evidence',page(975)],
 lang:['1f4d5','Latin and acronyms','Legal terms, ABC, MMO, PEACE',()=>renderLang()],
 index:['1f4c7','A–Z indexes','Topics, statutes and cases',()=>{ setTab('index'); render(); view.scrollTop=0; }],
 // investigation guides
 gAssault:['1f44a','Assault','Scene, evidence, trial and case law',guide('assault_inv')],
 gRobbery:['1f45b','Robbery from the person','Force, identification, continuing act',guide('robbery_inv')],
 gBurglary:['1f3e0','Burglary','Entry forensics and recent possession',guide('burglary_inv')],
 gTheft:['1f6cd-fe0f','Theft and handling','Dishonesty and claim of right',guide('theft_inv')],
 gDrugs:['1f48a','Drugs prosecutions','MDA, s.23 and s.26 warrants',guide('drugs')],
 gImm:['2708-fe0f','Immigration','Status, smuggling and trafficking',guide('immigration_inv')],
 gPO:['1f4e3','Public order','s.6 and s.8',guide('po')],
 gAffray:['2694-fe0f','Affray','Investigation guide',guide('affray')],
 gClamp:['1f697','Clamping and s.41','Public clamping, seizure, rogue clampers',guide('clamping')],
 gIndec:['1f6d1','Indecency (s.45)','Exposure, statements and the file',guide('indecency')],
 gIplan:['1f4dd','Interview plan','Stencil',guide('iplan')],
 gRare:['1f4dc','Rare offences','Niche statutes',guide('rare')],
 gDeep:['1f4d6','All deep guides','Searches, weapons, RTC, missing person',()=>renderDeep()],
 // manual
 tree:['1f4da','Browse the manual','Volumes 1–12, chapter by chapter',legacyTab('browse')],
 playbooks:['1f4d7','Playbooks','Five parts for each offence',page(986)],
 assaultst:['1f58a-fe0f','Assault statements','s.2 and s.3 guide',page(144)],
 saved:['1f516','Saved pages','The sections you starred',legacyTab('saved')],
 // paperwork
 proofs:['2705','Statement check','Does the statement meet the proofs?',()=>renderProofs()],
 sguides:['1f4c4','Statement guides','What to capture, for each offence',()=>renderGuides()],
 sten:['1f4d1','My stencils','Your templates — tap to copy',()=>renderStencils()],
 tpl:['1f4e8','Templates and forms','CCTV, s.41, agency requests',()=>renderTemplates()],
 precis:['1f9fe','Précis of evidence','Build it to win',guide('precis2')],
 exhibits:['1f4e6','Exhibits builder','Numbering, continuity, copy for the report',()=>renderExhibits()],
 preserve:['1f4e8','Preservation request','Any holder, any record — keep it safe',()=>renderPreserve()],
 cctv:['1f4f9','CCTV preservation','Generate the request text',()=>renderCCTV()],
 cctvst:['270d-fe0f','CCTV continuity statement','Print and fill in by pen',()=>{ if(W.GRForms)GRForms.open('cctv'); }],
 checks:['2705','Checklists','Scene, arrest, warrant, exhibits, interview, ID',()=>renderChecklists()],
 scan:['1f5a8-fe0f','Document scanner','Documents to PDF, saved to this phone only',call('openScanner')],
 // my work
 tasks:['1f4cb','Tasks','CCTV, arrests, deadlines and follow-ups',call('openTasks')],
 roster:['1f4c5','Roster','Core, Non-core and DDU for Units A–D',call('openRoster')],
 notes:['1f4dd','Notes','Sketches, photos, checklists, with a lock',call('openNotes')],
 rec:['1f399-fe0f','Voice recorder','Markers, crash-safe, stays on this phone',call('openRecorder')],
 pres:['1f4fa','Present to TV','Photos and CCTV on the big screen',call('openPresent')],
 // maps & cameras
 map:['1f5fa-fe0f','Map','Stations, districts, cameras, draw and measure',call('openOSINT')],
 camd:['1f4f9','Fitzgibbon St / Mountjoy cameras','Street cameras for the district and north city',()=>{ if(W.openCamReel)openCamReel(0,'district',true); }],
 camm50:['1f6e3-fe0f','M50 cameras','Every TII camera, J3 to J17',()=>{ if(W.openCamReel)openCamReel(0,'m50',true); }],
 camport:['1f6a2','Dublin Port cameras','Ships, the Liffey and Poolbeg',()=>{ if(W.openCamReel)openCamReel(0,'port',true); }],
 camall:['1f3a5','All cameras','Organised list, with M1, N4 and N7',()=>{ if(W.openCamReel)openCamReel(0,null,true); }],
 dcc:['1f4cd','City CCTV list','Dublin City Council cameras — locations only',call('openDccList')],
 news:['1f4f0','Live news','Sky News live and RTÉ News',()=>{ if(W.GRMedia)GRMedia.openTV('sky'); }],
 newslist:['1f514','Need-to-know news','Garda and crime news, most urgent first',()=>{ if(W.GRMedia&&GRMedia.openNewsList)GRMedia.openNewsList(); }],
 radio:['1f4fb','Irish radio','RTÉ, Newstalk, 98FM, FM104 and more',()=>{ if(W.GRMedia)GRMedia.openRadio(); }],
 // settings
 display:['1f3a8','Look, theme and text size','Light by day, dark at night',()=>displaySheet()],
 backup:['1f4be','Backup file','Encrypted file of your jobs, roster and notes, saved to this phone',()=>{ if(W.GRBackup)GRBackup.sheet(); }],
 sync:['2601-fe0f','Sync across devices','Encrypted, in your own Google Drive',call('openSync')],
 applock:['1f512','App lock','A password to open Assisting',()=>{ if(W.GRLock)GRLock.sheet(); }],
 aikey:['2728','AI search','Your own key, what is sent, and the cost',()=>{ if(W.GRSearch)GRSearch.settings(); }],
 tour:['1f44b','Intro tour','See the five-screen tour again',()=>openTour()],
 homelay:['1f3e0','Customise Today','Show, hide and reorder sections; favourites size; compact spacing',()=>layoutSheet()],
 rddense:['1f4d6','Compact reading','Smaller text and tighter sections in guides, pages and cases — tap to switch',()=>{ const roomy=!D.documentElement.classList.contains('rd-roomy'); if(W.GRReader)GRReader.setRoomy(roomy); if(typeof applyRdScale==='function')try{applyRdScale();}catch(e){} if(W.grToast)grToast(roomy?'Roomy reading on':'Compact reading on'); }],
 fatig:['1f319','Night-run notes','A gentle note on Today after two or more nights in a row — tap to turn on or off',()=>{ let on=true; try{ on=localStorage.getItem('gr_fatigue')!=='0'; localStorage.setItem('gr_fatigue',on?'0':'1'); }catch(e){} if(W.grToast)grToast('Night-run notes are '+(on?'off':'on')); }],
 about:['2139-fe0f','About Assisting','Version, disclaimer, what stays on this phone',()=>renderAbout()],
 graBen:['1f381','Membership benefits','What members get — on gra.ie',ext('https://www.gra.ie/membership-benefits')],
 graPortal:['1f511','Member portal','Sign in with your own GRA login',ext('https://www.gra.ie/member-portal')],
 graDisc:['1f6cd-fe0f','Discount portal','Member discounts — your own login',ext('https://gra.wrkit.com/login')],
 graNews:['1f4f0','GRA news','Latest from the association',ext('https://www.gra.ie/latest-news')],
 graReview:['1f4d6','Garda Review','The members’ magazine',ext('https://www.gra.ie/latest-news/garda-review')],
 graContact:['1f4de','Contact the GRA','Phone, email and address — on gra.ie',ext('https://www.gra.ie/contact-us')],
 graAbout:['1f465','About the GRA','Who they are and what they do',ext('https://www.gra.ie/about-gra')],
 graTrain:['1f393','Rep training','For GRA representatives — own login',ext('https://gra-training.moodlecloud.com/login/index.php')]
};
/* ---- the nine folders ---- */
const FOLDERS=[
 {k:'job',t:'On the job',i:'1f6e1-fe0f',s:[['Most used',['offences','searchp','nb','rs']],['At a scene',['scene','cautions','caution','ptp','weapons','seizure']],['Getting there',['route','patrol']],['Roads',['rtc','escooter']],['Emergencies and tools',['firstaid','toolbox','wanted']]]},
 {k:'custody',t:'Custody & court',i:'1f3db-fe0f',s:[['In custody',['clock','gaol','rights']],['Bail',['bail','ocall','bailpack']],['At court',['courtday','courtlists','crossexam','sentencing']]]},
 {k:'law',t:'Law',i:'2696-fe0f',s:[['Case law',['essentials','cases','judg']],['Know the law',['amend','discretion','inference','evidence','advokate']],['Look it up',['index','lang']]]},
 {k:'guides',t:'Investigation guides',i:'1f4d6',s:[['Start to finish',['gAssault','gRobbery','gBurglary','gTheft','gDrugs','gImm']],['Deep guides',['gPO','gAffray','gClamp','gIndec','gRare','gIplan','gDeep']]]},
 {k:'manual',t:'Manual',i:'1f4da',s:[['Read',['tree','playbooks','assaultst']],['Yours',['saved']]]},
 {k:'paper',t:'Paperwork',i:'1f4c4',s:[['Statements',['proofs','sguides','precis','sten']],['Requests and forms',['preserve','tpl','cctv','cctvst']],['Build and check',['exhibits','checks','scan']]]},
 {k:'work',t:'My work',i:'2705',s:[['Every day',['tasks','roster','notes']],['Capture',['rec','scan','pres']],['Kept',['saved']]]},
 {k:'maps',t:'Maps & cameras',i:'1f5fa-fe0f',s:[['Map',['map','dcc']],['Live cameras',['camd','camm50','camport','camall']],['News and radio',['newslist','news','radio']]]},
 {k:'gra',t:'GRA',i:'1f465',s:[['Member services',['graBen','graPortal','graDisc']],['News',['graNews','graReview']],['Get in touch',['graContact','graAbout','graTrain']]],note:'Links to the Garda Representative Association’s own website (gra.ie), checked November 2026. They open in your browser and need signal. Assisting is independent of the GRA.'}
];
const SETTINGS=['display','homelay','rddense','applock','backup','sync','fatig','aikey','tour','about'];
const FAV_DEF=['offences','nb','searchp','rs','clock','roster','tasks','map'];
const FKEY='gr_pro_favs';
const favs=()=>{ try{ const a=JSON.parse(localStorage.getItem(FKEY)||'null'); if(Array.isArray(a)){ const b=a.filter(x=>IT[x]); if(b.length)return b; } }catch(e){} return FAV_DEF.slice(); };
const run=id=>{ const it=IT[id]; if(!it)return; if(id!=='favs'&&typeof pushRecent==='function')try{ pushRecent({k:'tool',id,t:it[1],s:it[2]}); }catch(e){} try{ it[3](); }catch(e){ if(W.grToast)grToast('Could not open that'); } };
const row=id=>{ const it=IT[id]; return it?'<button type="button" class="p-row" data-it="'+id+'">'+ico(it[0])+'<span class="p-tx"><b>'+esc(it[1])+'</b><small>'+esc(it[2])+'</small></span><i class="p-ch" aria-hidden="true">›</i></button>':''; };
const wire=root=>root.querySelectorAll('[data-it]').forEach(b=>b.addEventListener('click',()=>run(b.dataset.it)));
const recents=()=>{ try{ const r=JSON.parse(localStorage.getItem('gr_recent')||'[]'); return Array.isArray(r)?r:[]; }catch(e){ return []; } };
const openRecent=(k,id)=>{ if(k==='guide')openGuide3(id); else if(k==='case')openCase(id); else if(k==='tool')run(id); else openPage(+id); };
const DAYN=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'], MONN=['January','February','March','April','May','June','July','August','September','October','November','December'];

/* ---------- Today ---------- */
function shiftCard(){
  const R=W.GRRoster, st=R&&R.status?R.status():null, now=Date.now(), hm=t=>{ const d=new Date(t); return String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0'); };
  const dur=ms=>{ ms=Math.max(0,ms); const d=Math.floor(ms/864e5), h=Math.floor(ms%864e5/36e5), m=Math.floor(ms%36e5/6e4); return d?d+' d '+h+' h':h?h+' h '+m+' m':m+' min'; };
  if(!st) return '<button type="button" class="p-hero" data-open="roster"><span class="p-hk">ROSTER</span><b>Set up your roster</b><small>Pick Core, Non-core or DDU and your unit — your tours then show here.</small></button>';
  if(st.on){ const i=st.info, p=Math.max(0,Math.min(1,(now-st.sp.s)/(st.sp.e-st.sp.s)));
    return '<button type="button" class="p-hero" data-open="roster"><span class="p-hrow"><b>'+esc(i.label)+' tour · '+hm(st.sp.s)+'–'+hm(st.sp.e)+'</b><small>'+esc(i.planned+(i.lab?' '+i.lab:''))+'</small></span><span class="p-bar"><i style="width:'+Math.round(p*100)+'%"></i></span><span class="p-hrow"><small>'+dur(now-st.sp.s)+' done</small><small>'+dur(st.sp.e-now)+' left</small></span></button>'; }
  const td=st.today, nx=st.next;
  return '<button type="button" class="p-hero" data-open="roster"><span class="p-hk">'+(td?esc(td.off?td.label:'Today · '+td.label).toUpperCase():'TODAY')+'</span><b>'+(nx?'Next: '+esc(nx.label)+' · '+esc(DAYN[nx.d.getDay()].slice(0,3)+' '+nx.d.getDate()+' '+MONN[nx.d.getMonth()].slice(0,3))+' at '+hm(st.sp.s):'No tour in the next 60 days')+'</b><small>'+(nx?'in '+dur(st.sp.s-now):'')+'</small></button>';
}
/* deadlines that are running out, from Tasks: summons time limit, CCTV overwrite, court dates, due dates */
function runningOut(){
  try{ const G=W.GRTasks; if(!G||!G._db||!G._lib||!G._lib.taskUrg)return ''; const db=G._db(), list=(db&&(db.tasks||db.list))||[], now=Date.now(), rows=[];
    list.forEach(t=>{ if(!t||t.done||t.deleted)return; const u=G._lib.taskUrg(t,now); if(u&&u.dl!=null&&u.dl-now<30*864e5)rows.push([u.dl,t,u]); });
    if(!rows.length)return ''; rows.sort((a,b)=>a[0]-b[0]);
    const left=ms=>{ const d=Math.round((ms-now)/864e5); return ms<now?'Overdue':d<=0?'Today':d===1?'1 day':d+' days'; };
    return '<div class="p-sec"><b>Running out</b><button type="button" data-open="tasks">All jobs</button></div><div class="p-card">'+rows.slice(0,3).map(([dl,t,u])=>{ const why=String((u.own&&u.own.why&&u.own.why[0])||(u.M&&[...u.M.values()].map(x=>x.why&&x.why[0]).find(Boolean))||'Deadline').replace(/\s*\(.*\)$/,''), code=/summons/i.test(why)?'23f0':/overwritten/i.test(why)?'1f4f9':/court/i.test(why)?'1f3db-fe0f':'1f4cb', d=Math.round((dl-now)/864e5);
      return '<button type="button" class="p-row" data-task="'+esc(t.id)+'">'+ico(code)+'<span class="p-tx"><b>'+esc(t.title||t.t||'Job')+'</b><small>'+esc(why)+'</small></span><em class="p-pill '+(dl<now||d<=2?'red':d<=7?'amb':'')+'">'+left(dl)+'</em></button>'; }).join('')+'</div>';
  }catch(e){ return ''; } }
/* a gentle note after a run of nights (can be turned off) */
function fatigue(){
  try{ if(localStorage.getItem('gr_fatigue')==='0')return ''; const R=W.GRRoster; if(!R||!R.dayInfo||!R._state())return '';
    const t=new Date(), day=k=>new Date(t.getFullYear(),t.getMonth(),t.getDate()+k), night=i=>i&&!i.off&&R.base(i.code)==='N';
    let run=0; const start=night(R.dayInfo(day(0)))?0:-1; for(let k=start;k>-10;k--){ if(night(R.dayInfo(day(k))))run++; else break; }
    if(run<2)return ''; const onNow=start===0;
    return '<div class="p-note" id="pFat">'+ico('1f319',34)+'<span><b>'+(onNow?'Night '+run+' in a row':run+' nights in a row behind you')+'</b><small>Tiredness slows you like drink does. Take your breaks, and think about the drive home — pull in if your eyes get heavy.</small></span><button type="button" aria-label="Turn these notes off">Turn off</button></div>';
  }catch(e){ return ''; } }
/* Today layout — order, show/hide, favourites size and style, compact mode (kept on the phone) */
const HKEY='gr_pro_home';
const HSEC=[['shift','Tour card'],['quick','Quick search bar'],['stats','Jobs at a glance'],['live','Running clocks and patrols'],['running','Deadlines running out'],['favs','Favourites'],['recent','Recently viewed'],['asked','Recent searches and Ask'],['fatigue','Night-run notes']];
const HDEF={order:HSEC.map(x=>x[0]),hide:['quick'],favN:8,favStyle:'grid',recN:4,compact:false};
const home=()=>{ let h={}; try{ h=JSON.parse(localStorage.getItem(HKEY)||'{}')||{}; }catch(e){} const o=Object.assign({},HDEF,h);
  o.order=(Array.isArray(o.order)?o.order:[]).filter(k=>HSEC.some(x=>x[0]===k)); HSEC.forEach(x=>{ if(!o.order.includes(x[0]))o.order.push(x[0]); }); if(!Array.isArray(o.hide))o.hide=HDEF.hide.slice(); return o; };
const homeSet=o=>{ try{ localStorage.setItem(HKEY,JSON.stringify(o)); }catch(e){} };
const RICO={guide:'1f4d6',page:'1f4c4',case:'2696-fe0f'};
const askedList=()=>{ const g=k=>{ try{ const v=JSON.parse(localStorage.getItem(k)||'[]'); return Array.isArray(v)?v:[]; }catch(e){ return []; } };
  const a=g('gr_ai_recent').map(x=>({q:typeof x==='string'?x:x.q,ai:1,t:x.t||0})), s=g('gr_srecent').map((q,i)=>({q,ai:0,t:-i}));
  const seen=new Set(), out=[]; a.concat(s).forEach(x=>{ const k=String(x.q||'').toLowerCase(); if(!k||seen.has(k))return; seen.add(k); out.push(x); }); return out; };
function goSearch(q,ai){ setTab('search'); render(); const el=D.getElementById('q'); if(!el)return; if(q!=null){ el.value=q; el.dispatchEvent(new Event('input',{bubbles:true})); if(ai&&W.GRSearch&&GRSearch.ask)setTimeout(()=>GRSearch.ask(q),400); } else el.focus(); }
function recentRows(n){ const rec=recents().slice(0,n); return rec.map(r=>{ const tool=r.k==='tool'&&IT[r.id]; return '<button type="button" class="p-row" data-rk="'+esc(r.k)+'" data-rid="'+esc(String(r.id))+'">'+ico(tool?IT[r.id][0]:(RICO[r.k]||'1f4c4'))+'<span class="p-tx"><b>'+esc(r.t)+'</b><small>'+esc(r.s||'')+'</small></span><i class="p-ch" aria-hidden="true">›</i></button>'; }).join(''); }
function today(view){
  const d=new Date(), T=W.GRTasks&&GRTasks.summary?GRTasks.summary():null, H=home(), F=favs().slice(0,H.favN);
  const stat=(v,l,c)=>'<button type="button" class="p-stat" data-open="tasks"><b class="'+(c&&v?c:'')+'">'+v+'</b><small>'+l+'</small></button>';
  const asked=askedList().slice(0,4), rr=recentRows(H.recN);
  const S={
    shift:'<div id="pShift">'+shiftCard()+'</div>',
    quick:'<button type="button" class="p-qs" data-go="search2">'+(W.GRI?GRI('search'):'')+'<span>Search or ask anything</span></button>',
    stats:T?'<div class="p-stats">'+stat(T.open,'Jobs open')+stat(T.overdue,'Overdue','red')+stat(T.tourN,T.tourOn?'This tour':'Next tour','amb')+'</div>':'',
    live:'<div class="p-live"><div id="homeDet"></div><div id="homeGaol"></div><div id="homePatrol"></div><div id="homeTasks"></div></div>',
    running:runningOut(), fatigue:fatigue(),
    favs:'<div class="p-sec"><b>Favourites</b><button type="button" data-go="favs">Edit</button></div>'+(H.favStyle==='list'?'<div class="p-card">'+F.map(row).join('')+'</div>':'<div class="p-favs">'+F.map(id=>'<button type="button" data-it="'+id+'">'+ico(IT[id][0],52)+'<span>'+esc(IT[id][1])+'</span></button>').join('')+'</div>'),
    recent:rr?'<div class="p-sec"><b>Recently viewed</b></div><div class="p-card">'+rr+'</div>':'',
    asked:asked.length?'<div class="p-sec"><b>Recent searches</b></div><div class="p-chips p-asked">'+asked.map(x=>'<button type="button" data-q="'+esc(x.q)+'"'+(x.ai?' data-ai="1"':'')+'>'+(x.ai?'<span class="p-aitag">Ask</span>':'')+esc(x.q.length>48?x.q.slice(0,46)+'…':x.q)+'</button>').join('')+'</div>':''
  };
  view.innerHTML='<div class="tabroot" data-tab="today" hidden></div><div class="pro'+(H.compact?' p-compact':'')+'" id="proToday">'
   +'<div class="p-head"><div><h1>Today</h1><small>'+DAYN[d.getDay()]+' '+d.getDate()+' '+MONN[d.getMonth()]+'</small></div><button type="button" class="p-ib" data-go="layout" aria-label="Customise Today">'+(W.GRI?GRI('sliders-horizontal'):'')+'</button><button type="button" class="p-ib" data-go="search" aria-label="Search">'+(W.GRI?GRI('search'):'')+'</button><button type="button" class="p-ib" data-go="settings" aria-label="Settings">'+(W.GRI?GRI('settings'):'')+'</button></div>'
   +H.order.filter(k=>!H.hide.includes(k)).map(k=>S[k]||'').join('')
   +'<p class="p-foot">Independent tool — not an official Garda system. Not legal advice.</p></div>';
  const root=view.querySelector('#proToday'); wire(root);
  root.querySelectorAll('[data-open]').forEach(b=>b.addEventListener('click',()=>run(b.dataset.open)));
  root.querySelectorAll('[data-task]').forEach(b=>b.addEventListener('click',()=>{ if(W.GRTasks)GRTasks.open(b.dataset.task); }));
  root.querySelectorAll('[data-rk]').forEach(b=>b.addEventListener('click',()=>openRecent(b.dataset.rk,b.dataset.rid)));
  root.querySelectorAll('.p-asked [data-q]').forEach(b=>b.addEventListener('click',()=>goSearch(b.dataset.q,!!b.dataset.ai)));
  root.querySelector('[data-go="search"]').onclick=()=>goSearch();
  { const q=root.querySelector('[data-go="search2"]'); if(q)q.onclick=()=>goSearch(); }
  root.querySelector('[data-go="settings"]').onclick=()=>renderSettings();
  root.querySelector('[data-go="layout"]').onclick=()=>layoutSheet();
  { const f=root.querySelector('[data-go="favs"]'); if(f)f.onclick=()=>favSheet(); }
  { const f=root.querySelector('#pFat button'); if(f)f.onclick=()=>{ try{ localStorage.setItem('gr_fatigue','0'); }catch(e){} root.querySelector('#pFat').remove(); if(W.grToast)grToast('Night-run notes are off — turn them back on in Settings'); }; }
  if(!H.hide.includes('live')){
    if(W.GRDet)GRDet.mountStrip(root.querySelector('#homeDet'));
    if(W.GRGaol)GRGaol.mountStrip(root.querySelector('#homeGaol'));
    if(W.GRPatrol)GRPatrol.mountStrip(root.querySelector('#homePatrol'));
    if(W.GRTasks)GRTasks.mountStrip(root.querySelector('#homeTasks')); }
  if(W.grHudTick)grHudTick();
}
function layoutSheet(){
  let o=D.getElementById('pSheet'); if(!o){ o=D.createElement('div'); o.id='pSheet'; D.body.appendChild(o); }
  const H=home(); const name=k=>(HSEC.find(x=>x[0]===k)||[k,k])[1];
  const seg=(key,opts)=>'<div class="p-seg" data-k="'+key+'">'+opts.map(([v,l])=>'<button type="button" data-v="'+v+'" class="'+(String(H[key])===String(v)?'on':'')+'">'+l+'</button>').join('')+'</div>';
  const paint=()=>{ o.innerHTML='<div class="p-shade"></div><div class="p-sheet pro" role="dialog" aria-label="Customise Today"><h3>Customise Today</h3><p>Show, hide and reorder what’s on your home screen. Saved on this phone only.</p>'
    +'<div class="p-card p-lay">'+H.order.map((k,i)=>'<div class="p-lrow"><label><input type="checkbox" data-sh="'+k+'"'+(H.hide.includes(k)?'':' checked')+'> '+esc(name(k))+'</label><span><button type="button" data-up="'+i+'" aria-label="Move '+esc(name(k))+' up"'+(i?'':' disabled')+'>↑</button><button type="button" data-dn="'+i+'" aria-label="Move '+esc(name(k))+' down"'+(i<H.order.length-1?'':' disabled')+'>↓</button></span></div>').join('')+'</div>'
    +'<div class="p-sec"><b>Favourites</b></div>'+seg('favN',[[4,'4'],[8,'8'],[12,'12']])+seg('favStyle',[['grid','Icons'],['list','List']])
    +'<div class="p-sec"><b>Recently viewed</b></div>'+seg('recN',[[3,'3'],[4,'4'],[6,'6'],[8,'8']])
    +'<div class="p-sec"><b>Spacing</b></div>'+seg('compact',[[false,'Comfortable'],[true,'Compact']])
    +'<div class="p-acts"><button type="button" data-a="reset">Reset</button><button type="button" data-a="clear">Clear history</button><button type="button" class="go" data-a="done">Done</button></div></div>';
    o.querySelector('.p-shade').onclick=done;
    o.querySelectorAll('[data-sh]').forEach(c=>c.onchange=()=>{ const k=c.dataset.sh; H.hide=H.hide.filter(x=>x!==k); if(!c.checked)H.hide.push(k); homeSet(H); });
    o.querySelectorAll('[data-up]').forEach(b=>b.onclick=()=>{ const i=+b.dataset.up; [H.order[i-1],H.order[i]]=[H.order[i],H.order[i-1]]; homeSet(H); paint(); });
    o.querySelectorAll('[data-dn]').forEach(b=>b.onclick=()=>{ const i=+b.dataset.dn; [H.order[i+1],H.order[i]]=[H.order[i],H.order[i+1]]; homeSet(H); paint(); });
    o.querySelectorAll('.p-seg button').forEach(b=>b.onclick=()=>{ const k=b.parentNode.dataset.k, v=b.dataset.v; H[k]=v==='true'?true:v==='false'?false:isNaN(+v)?v:+v; homeSet(H); paint(); });
    o.querySelector('[data-a="reset"]').onclick=()=>{ try{ localStorage.removeItem(HKEY); }catch(e){} Object.assign(H,home()); paint(); };
    o.querySelector('[data-a="clear"]').onclick=()=>{ try{ ['gr_recent','gr_srecent','gr_ai_recent'].forEach(k=>localStorage.removeItem(k)); }catch(e){} if(W.grToast)grToast('Recently viewed and searches cleared'); };
    o.querySelector('[data-a="done"]').onclick=done; };
  const done=()=>{ o.innerHTML=''; if(tab==='today')render(); };
  paint();
}
setInterval(()=>{ const el=D.getElementById('pShift'); if(!el||D.visibilityState!=='visible')return; const h=shiftCard(); if(el._h!==h){ el._h=h; el.innerHTML=h; el.querySelector('[data-open]').addEventListener('click',()=>run('roster')); } },30000);
function favSheet(){
  let o=D.getElementById('pSheet'); if(!o){ o=D.createElement('div'); o.id='pSheet'; D.body.appendChild(o); }
  let sel=favs();
  const paint=()=>{ o.innerHTML='<div class="p-shade"></div><div class="p-sheet pro" role="dialog" aria-label="Edit favourites"><h3>Favourites</h3><p>Pick up to 8. They show on Today in this order.</p>'
     +FOLDERS.filter(f=>f.k!=='gra').map(f=>'<div class="p-sec"><b>'+esc(f.t)+'</b></div><div class="p-chips">'+[...new Set(f.s.flatMap(x=>x[1]))].map(id=>'<button type="button" data-f="'+id+'" class="'+(sel.includes(id)?'on':'')+'">'+esc(IT[id][1])+'</button>').join('')+'</div>').join('')
     +'<div class="p-acts"><button type="button" data-a="reset">Reset</button><button type="button" class="go" data-a="done">Done</button></div></div>';
    o.querySelector('.p-shade').onclick=close;
    o.querySelectorAll('[data-f]').forEach(b=>b.onclick=()=>{ const id=b.dataset.f; if(sel.includes(id))sel=sel.filter(x=>x!==id); else { if(sel.length>=8){ if(W.grToast)grToast('Eight is the most — take one off first'); return; } sel.push(id); } b.classList.toggle('on',sel.includes(id)); });
    o.querySelector('[data-a="reset"]').onclick=()=>{ sel=FAV_DEF.slice(); paint(); };
    o.querySelector('[data-a="done"]').onclick=()=>{ try{ localStorage.setItem(FKEY,JSON.stringify(sel)); }catch(e){} close(); if(tab==='today')render(); }; };
  const close=()=>{ o.innerHTML=''; };
  paint();
}
W.proSheetBack=()=>{ const o=D.getElementById('pSheet'); if(o&&o.innerHTML){ o.innerHTML=''; return true; } return false; };

/* ---------- Browse: the nine folders ---------- */
function count(f){ return new Set(f.s.flatMap(x=>x[1])).size; }
function browse(view){
  const rec=recents().slice(0,6), T=W.GRTasks&&GRTasks.summary?GRTasks.summary():null;
  const sub=f=>f.k==='law'&&W.CASES_N?W.CASES_N+' cases':f.k==='gra'?'Member services':count(f)+(f.k==='guides'?' guides':' tools');
  const badge=f=>f.k==='work'&&T&&T.overdue?'<em class="red">'+T.overdue+' overdue</em>':f.k==='work'&&T&&T.open?'<em>'+T.open+' open</em>':'';
  view.innerHTML='<div class="tabroot" data-tab="folders" hidden></div><div class="pro" id="proBrowse">'
   +'<div class="p-head"><div><h1>Browse</h1></div><button type="button" class="p-ib" data-go="settings" aria-label="Settings">'+(W.GRI?GRI('settings'):'')+'</button></div>'
   +'<button type="button" class="p-search" data-go="search">'+(W.GRI?GRI('search'):'')+'<span>Search everything</span></button>'
   +(rec.length?'<div class="p-sec"><b>Recent</b></div><div class="p-rec">'+rec.map(r=>'<button type="button" data-rk="'+esc(r.k)+'" data-rid="'+esc(String(r.id))+'">'+ico(r.k==='guide'?'1f4d6':'1f4c4',26)+'<span>'+esc(r.t)+'</span></button>').join('')+'</div>':'')
   +'<div class="p-sec"><b>Folders</b></div><div class="p-tiles">'+FOLDERS.map(f=>'<button type="button" data-f="'+f.k+'">'+ico(f.i,40)+badge(f)+'<b>'+esc(f.t)+'</b><small>'+esc(sub(f))+'</small></button>').join('')+'</div></div>';
  const root=view.querySelector('#proBrowse');
  root.querySelectorAll('[data-f]').forEach(b=>b.addEventListener('click',()=>renderFolder(b.dataset.f)));
  root.querySelectorAll('[data-rk]').forEach(b=>b.addEventListener('click',()=>openRecent(b.dataset.rk,b.dataset.rid)));
  root.querySelector('[data-go="search"]').onclick=()=>{ setTab('search'); render(); const q=D.getElementById('q'); if(q)q.focus(); };
  root.querySelector('[data-go="settings"]').onclick=()=>renderSettings();
}
W.renderFolder=function(k){
  const f=FOLDERS.find(x=>x.k===k); if(!f)return;
  view.innerHTML='<div class="pro" id="proFolder"><div class="p-fhead">'+ico(f.i,52)+'<div><h1>'+esc(f.t)+'</h1><small>'+(f.k==='gra'?'Member services':count(f)+(f.k==='guides'?' guides':' tools'))+'</small></div></div>'
   +f.s.map(([h,ids])=>'<div class="p-sec"><b>'+esc(h)+'</b></div><div class="p-card">'+ids.map(row).join('')+'</div>').join('')
   +(f.note?'<p class="p-foot">'+esc(f.note)+'</p>':'')+'</div>';
  wire(view); view.scrollTop=0;
};
W.renderSettings=function(){
  view.innerHTML='<div class="pro" id="proSettings"><div class="p-fhead">'+ico('2699-fe0f',52)+'<div><h1>Settings</h1><small>Everything is saved on this phone</small></div></div>'
   +'<div class="p-card" style="margin-top:14px">'+SETTINGS.map(row).join('')+'</div>'
   +'<p class="p-foot">Assisting is an independent tool — not an official Garda system. '+esc(W.GRVER||'')+'</p></div>';
  wire(view); view.scrollTop=0;
};
/* ---------- intro tour: five screens on first launch, skippable, re-openable from Settings ---------- */
function openTour(){
  let o=D.getElementById('pTour'); if(!o){ o=D.createElement('div'); o.id='pTour'; D.body.appendChild(o); }
  let i=0, rs='core', ru='C'; const R=W.GRRoster, has=!!(R&&R._state&&R._state());
  const S=[
   ['1f44b','Welcome to Assisting','An offline reference for the job: offences, powers, case law, custody clocks, notebook entries and your roster.','It is an independent tool — not an official Garda system, and not legal advice.'],
   ['1f9ed','Three tabs','<b>Today</b> shows your tour and what’s due now. <b>Browse</b> has everything in nine folders. <b>Search</b> finds anything — type a question in your own words.',''],
   ['1f512','Your data stays on this phone','Jobs, notes, roster and custody clocks are saved only on this phone. Nothing is uploaded unless you turn on sync or use AI search with your own key.','<b>Never enter names, addresses, dates of birth, PULSE or reg numbers.</b> Use “Person A” and “the location”.'],
   ['1f4c5','Your roster','',''],
   ['1f31f','You’re set','The look is light by day and dark at night. Put Assisting on your home screen so it opens like an app and works with no signal.','You can see this tour again in Settings.']];
  const done=()=>{ try{ localStorage.setItem('gr_tour','1'); }catch(e){} o.innerHTML=''; if(tab==='today')render(); };
  const paint=()=>{ const s=S[i], last=i===S.length-1, ros=i===3;
    o.innerHTML='<div class="p-tour pro" role="dialog" aria-label="Intro tour"><button type="button" class="pt-skip">'+(last?'':'Skip')+'</button><div class="pt-body">'+ico(s[0],96)+'<h2>'+s[1]+'</h2>'
     +(ros?(has?'<p>Your roster is already set up. You can change it any time in My work → Roster.</p>':'<p>Pick your roster and unit, and your tours show on Today. You can skip this and do it later.</p><div class="pt-seg">'+Object.keys(R?R.ST:{}).map(k=>'<button type="button" data-rs="'+k+'" class="'+(rs===k?'on':'')+'">'+R.ST[k].short+'</button>').join('')+'</div><div class="pt-seg">'+(R?R.units:[]).map(u=>'<button type="button" data-ru="'+u+'" class="'+(ru===u?'on':'')+'">Unit '+u+'</button>').join('')+'</div><button type="button" class="pt-set">Set as my roster</button>')
        :'<p>'+s[2]+'</p>'+(s[3]?'<p class="pt-2">'+s[3]+'</p>':''))
     +'</div><div class="pt-dots">'+S.map((_,k)=>'<i class="'+(k===i?'on':'')+'"></i>').join('')+'</div><div class="pt-nav">'+(i?'<button type="button" class="pt-b">Back</button>':'<span></span>')+'<button type="button" class="pt-n go">'+(last?'Start':'Next')+'</button></div></div>';
    o.querySelector('.pt-skip').onclick=done; o.querySelector('.pt-n').onclick=()=>{ if(last)done(); else { i++; paint(); } };
    const b=o.querySelector('.pt-b'); if(b)b.onclick=()=>{ i--; paint(); };
    o.querySelectorAll('[data-rs]').forEach(x=>x.onclick=()=>{ rs=x.dataset.rs; paint(); }); o.querySelectorAll('[data-ru]').forEach(x=>x.onclick=()=>{ ru=x.dataset.ru; paint(); });
    const st=o.querySelector('.pt-set'); if(st)st.onclick=()=>{ R.setStation(rs,ru); if(W.grToast)grToast(R.ST[rs].name+' · Unit '+ru+' set'); i++; paint(); };
    const body=o.querySelector('.pt-body'); let sx=null; body.addEventListener('touchstart',e=>{ sx=e.touches[0].clientX; },{passive:true});
    body.addEventListener('touchend',e=>{ if(sx==null)return; const dx=e.changedTouches[0].clientX-sx; sx=null; if(dx<-60&&i<S.length-1){ i++; paint(); } else if(dx>60&&i>0){ i--; paint(); } },{passive:true}); };
  paint();
}
W.openTour=openTour;
W.tourBack=()=>{ const o=D.getElementById('pTour'); if(o&&o.innerHTML){ try{ localStorage.setItem('gr_tour','1'); }catch(e){} o.innerHTML=''; return true; } return false; };
(function(){ let seen=true; try{ seen=!!localStorage.getItem('gr_tour'); }catch(e){} if(seen||navigator.webdriver)return;
  const go=()=>{ if(typeof META==='undefined'||!META||!D.getElementById('proToday'))return setTimeout(go,300); if(D.documentElement.classList.contains('locked'))return setTimeout(go,800); openTour(); }; setTimeout(go,600); })();
/* long-press shortcuts on the app icon: ?open=notebook | search | tasks (roster handles its own) */
(function(){ try{ const o=new URLSearchParams((W.__entry||location).search).get('open'); if(!['notebook','search','tasks'].includes(o))return;
  const go=()=>{ if(typeof META==='undefined'||!META||!D.querySelector('#view .tabroot'))return setTimeout(go,250);
    if(o==='notebook'){ if(W.renderNBLib)renderNBLib(); } else if(o==='search'){ setTab('search'); render(); const q=D.getElementById('q'); if(q)q.focus(); } else if(W.openTasks)openTasks(); }; setTimeout(go,300); }catch(e){} })();
W.GRPro={today,browse,items:IT,folders:FOLDERS,run,icon:ico,layoutSheet,goSearch};
})();
