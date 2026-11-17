/* The original home (v60 style): hero with the badge, clock and online state; search; live strips; recent;
   grouped tool cards. Tabs Home · Search · Index · Tools · Saved. Switch in Settings → Home style. */
(function(W){ 'use strict';
const D=document;
try{ if(localStorage.getItem('gr_home_v3m')!=='1'){ localStorage.setItem('gr_home_v3m','1'); localStorage.setItem('gr_home_v','2'); localStorage.setItem('gr_home_style','mix'); localStorage.setItem('gr_pro_auto','1'); }
 if(localStorage.getItem('gr_home_v')!=='2'){ localStorage.setItem('gr_home_v','2'); localStorage.setItem('gr_home_style','v200'); localStorage.setItem('gr_pro_auto','1'); localStorage.setItem('gr_theme','pro'); }
 if(!localStorage.getItem('gr_home_style')){ localStorage.setItem('gr_home_style','original'); localStorage.setItem('gr_theme','navy'); localStorage.setItem('gr_pro_auto','0'); localStorage.setItem('gr_look','classic'); } }catch(e){}
const mode=()=>{ try{ return localStorage.getItem('gr_home_style')||'mix'; }catch(e){ return 'mix'; } };
const on=()=>mode()==='original'||mode()==='v200';
const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
/* tab bar: swap before app.js wires it */
if(mode()==='v200'){ const tb=D.getElementById('tabbar'); if(tb)tb.innerHTML=
  '<button data-tab="search" data-ic="search" class="tab active" role="tab">Search</button>'+
  '<button data-tab="tools" data-ic="wrench" class="tab" role="tab">Tools</button>'+
  '<button data-tab="index" data-ic="book-text" class="tab" role="tab">Indexes</button>'+
  '<button data-tab="saved" data-ic="bookmark" class="tab" role="tab">Saved</button>'; }
if(mode()==='original'){ const tb=D.getElementById('tabbar'); if(tb)tb.innerHTML=
  '<button data-tab="today" data-ic="house" class="tab active" role="tab">Home</button>'+
  '<button data-tab="search" data-ic="search" class="tab" role="tab">Search</button>'+
  '<button data-tab="index" data-ic="book-open" class="tab" role="tab">Index</button>'+
  '<button data-tab="tools" data-ic="wrench" class="tab" role="tab">Tools</button>'+
  '<button data-tab="saved" data-ic="bookmark" class="tab" role="tab">Saved</button>';
  D.documentElement.classList.add('home-original'); }
/* [item id, line icon, extra class] — titles and subtitles come from the app's own tool list */
const HOME=[
 ['On the job','Quick access',[['offences','shield'],['patrol','footprints'],['clock','timer'],['gaol','users'],['cautions','triangle-alert'],['scene','sunrise']]],
 ['Emergency & field','Offline',[['firstaid','heart-pulse','wide red'],['map','map'],['toolbox','toolbox']]],
 ['My work','On this phone',[['roster','calendar-days'],['tasks','square-check'],['notes','notebook-pen'],['rec','mic'],['scan','scan-text'],['pres','monitor']]],
 ['Investigation guides','In depth',[['alloff','scale','wide'],['gAssault','hand'],['gRobbery','wallet'],['gBurglary','door-open'],['gTheft','shopping-bag'],['gDrugs','pill'],['gImm','plane']]],
 ['Law & authority','Case law · Bail',[['essentials','star'],['cases','library'],['bail','scale'],['ocall','clipboard-list'],['bailpack','folder-open'],['amend','file-pen-line']]],
 ['Files & paperwork','Statements · Forms',[['sguides','file-text'],['proofs','list-checks'],['sten','layout-template'],['tpl','mail'],['preserve','send'],['precis','file-check']]],
 ['Deep guides','Reference',[['gPO','megaphone'],['gAffray','swords'],['gClamp','car-front'],['gIplan','messages-square'],['gRare','scroll'],['gDeep','book-open']]],
 ['The manual','Vols 1–12',[['playbooks','book-marked'],['inference','brain'],['advokate','eye'],['crossexam','message-square-quote'],['evidence','landmark'],['assaultst','file-pen'],['lang','languages'],['courtday','gavel']]],
 ['Live','Needs signal',[['judg','gavel'],['courtlists','calendar-clock'],['camd','cctv'],['camm50','route'],['camport','ship'],['camall','video'],['dcc','list-video'],['radio','radio']]]
];
const I=n=>W.GRI?GRI(n):'';
function card([id,ic,cls]){ const it=W.GRPro&&GRPro.items[id]; if(!it)return '';
  return '<button type="button" class="hc'+(cls?' '+cls:'')+'" data-it="'+id+'">'+I(ic)+'<span class="hc-t"><b>'+esc(it[1])+'</b><small>'+esc(it[2]||'')+'</small></span></button>'; }
function recentRows(){ let r=[]; try{ r=JSON.parse(localStorage.getItem('gr_recent')||'[]')||[]; }catch(e){}
  return r.slice(0,3).map(x=>'<button type="button" class="recentrow" data-k="'+esc(x.k)+'" data-id="'+esc(String(x.id))+'">'+I(x.k==='case'?'scale':x.k==='tool'?'wrench':'history')+'<div class="rr-t">'+esc(x.t)+'</div><div class="rr-s">'+esc(x.s||'')+'</div></button>').join(''); }
function render(view){
  const rr=recentRows();
  view.innerHTML='<div class="tabroot" data-tab="today" hidden></div><div class="ch"><div class="home-root">'
   +'<section class="hero"><div class="hero-row"><svg class="hero-emb" viewBox="0 0 64 72" aria-hidden="true"><use href="#emb"/></svg>'
   +'<div class="hero-txt"><h1>ASSISTING</h1><div class="hero-sub">OPERATIONAL REFERENCE TOOL</div><i class="hero-rule"></i><p>Independent reference for frontline Gardaí — law, procedure and tools.</p></div>'
   +'<div class="hero-stat"><div class="hs-net"><i></i><span>ONLINE</span></div><div class="hudclock hs-time" data-f="t"></div><div class="hudclock hs-date" data-f="d"></div></div></div></section>'
   +'<div class="home-body"><button class="homesearch" id="homeSearch" type="button">'+I('search')+'<span>Search or ask anything…</span>'+I('sparkles')+'</button>'
   +'<div id="homeRoster"></div><div id="homeDet"></div><div id="homeGaol"></div><div id="homePatrol"></div><div id="homeTasks"></div>'
   +(rr?'<h2 class="sec">Recent<span class="sec-r">Continue</span></h2><div class="recentwrap">'+rr+'</div>':'')
   +HOME.map(([h,r,c])=>'<h2 class="sec">'+esc(h)+'<span class="sec-r">'+esc(r)+'</span></h2><div class="hgrid">'+c.map(card).join('')+'</div>').join('')
   +'<div class="homefoot"><div class="hf-dis"><span>INDEPENDENT TOOL</span> · <span>NOT AN OFFICIAL GARDA SYSTEM</span></div><div class="hf-sub">Not legal advice · verify current wording before relying on it</div>'
   +'<button type="button" class="hf-style" id="hfStyle">Switch to the new home</button></div></div></div></div>';
  if(W.grHudTick)grHudTick(); if(W.netPaint)try{netPaint();}catch(e){}
  view.querySelector('#homeSearch').onclick=()=>{ if(W.GRPro&&GRPro.goSearch)GRPro.goSearch(); };
  view.querySelectorAll('.hc[data-it]').forEach(b=>b.onclick=()=>GRPro.run(b.dataset.it));
  view.querySelectorAll('.recentrow').forEach(b=>b.onclick=()=>{ const k=b.dataset.k,id=b.dataset.id;
    if(k==='case'&&W.openCase)openCase(id); else if(k==='tool')GRPro.run(id); else if(k==='guide'&&W.openGuide3)openGuide3(id); else if(W.openPage)openPage(+id); });
  view.querySelector('#hfStyle').onclick=()=>setStyle('new');
  if(W.GRRoster&&GRRoster.mountStrip)GRRoster.mountStrip(view.querySelector('#homeRoster'));
  if(W.GRDet)GRDet.mountStrip(view.querySelector('#homeDet'));
  if(W.GRGaol)GRGaol.mountStrip(view.querySelector('#homeGaol'));
  if(W.GRPatrol)GRPatrol.mountStrip(view.querySelector('#homePatrol'));
  if(W.GRTasks)GRTasks.mountStrip(view.querySelector('#homeTasks'));
}

/* ---- Simple home (v200 look): today card, your essentials, All tools. Pick essentials with Edit. ---- */
const LINE={}; HOME.forEach(g=>g[2].forEach(([id,ic])=>{ LINE[id]=ic; }));
Object.assign(LINE,{nb:'notebook-pen',searchp:'user-search',rs:'brain',caution:'triangle-alert',rights:'scale',saved:'bookmark',tree:'book-open'});
const EKEY='gr_ess2', EDEF=['offences','ptp','searchp','nb','clock','gaol','cautions','proofs','camd','radio'];
const XTRA=[['news','Need-to-know news (simple home)'],['inner','Dublin inner city (simple home)'],['recent','Recently viewed (simple home)']];
function ess(){ try{ const v=JSON.parse(localStorage.getItem(EKEY)||'null'); if(v&&Array.isArray(v.ids))return v; }catch(e){} return {ids:EDEF.slice(),x:['recent']}; }
function essSave(v){ try{ localStorage.setItem(EKEY,JSON.stringify(v)); }catch(e){} }
function tile(id){ const it=W.GRPro&&GRPro.items[id]; if(!it)return '';
  return '<button type="button" class="qbtn" data-it="'+id+'"><span class="qh">'+I(LINE[id]||'star')+'<b>'+esc(it[1])+'</b></span></button>'; }
function mini(box){
  const E=ess(), X=new Set(E.x||[]);
  box.innerHTML='<div class="homeq mini"><div id="homeToday"></div><div id="homePatrol"></div><div id="homeGaol"></div><div id="homeRoster"></div><div id="homeDet"></div>'
   +'<h2 class="sec">Essentials<span class="sec-r"><button type="button" class="sec-x" id="essEdit">Edit</button></span></h2>'
   +'<div class="quick mini-q">'+E.ids.map(tile).join('')+'</div>'
   +(X.has('recent')?'<div id="miniRecent"></div>':'')
   +(X.has('news')?'<div id="homeNews"></div>':'')+(X.has('inner')?'<div id="homeInner"></div>':'')
   +'<button type="button" class="home-edit" id="allTools">'+I('list')+'All tools</button></div>';
  wireSwitch(box);
  box.querySelectorAll('[data-it]').forEach(b=>b.onclick=()=>GRPro.run(b.dataset.it));
  box.querySelector('#essEdit').onclick=()=>pick(box);
  box.querySelector('#allTools').onclick=()=>{ setTab('tools'); W.render(); D.getElementById('view').scrollTop=0; };
  if(X.has('recent')){ const r=recentRows(); const el=box.querySelector('#miniRecent'); if(r){ el.innerHTML='<h2 class="sec">Recent</h2><div class="recentwrap">'+r+'</div>';
    el.querySelectorAll('.recentrow').forEach(b=>b.onclick=()=>{ const k=b.dataset.k,id=b.dataset.id; if(k==='case'&&W.openCase)openCase(id); else if(k==='tool')GRPro.run(id); else if(k==='guide'&&W.openGuide3)openGuide3(id); else if(W.openPage)openPage(+id); }); } }
  try{ if(W.paintToday)paintToday(); if(W.grHudTick)grHudTick(); }catch(e){}
  if(W.GRRoster&&GRRoster.mountStrip)GRRoster.mountStrip(box.querySelector('#homeRoster'));
  if(W.GRDet&&GRDet.mountStrip)GRDet.mountStrip(box.querySelector('#homeDet'));
  if(W.GRGaol&&GRGaol.mountStrip)GRGaol.mountStrip(box.querySelector('#homeGaol'));
  if(W.GRPatrol&&GRPatrol.mountStrip)GRPatrol.mountStrip(box.querySelector('#homePatrol'));
  if(W.GRMedia){ if(X.has('news'))GRMedia.mountNewsStrip(box.querySelector('#homeNews')); if(X.has('inner')&&GRMedia.mountInnerStrip)GRMedia.mountInnerStrip(box.querySelector('#homeInner')); }
}
function pick(box){
  const E=ess(), on=new Set(E.ids), X=new Set(E.x||[]), F=(W.GRPro&&GRPro.folders)||[], seen=new Set();
  const row=(id,lab,chk,attr)=>'<label class="ess-row"><input type="checkbox" '+attr+'="'+id+'"'+(chk?' checked':'')+'><span>'+esc(lab)+'</span></label>';
  let h='<div class="ess-pick"><div class="ess-top"><b>Pick your tools</b><span id="essN"></span><button type="button" id="essDone">Done</button></div>'
   +'<p class="ess-help">Tick everything you want under Dublin inner city on your home screen — tools, live cameras, radio, anything. The rest stays in the Tools tab. Change it any time with Edit.</p>'
   +'<h2 class="sec">Also show</h2>'+XTRA.map(([k,l])=>row(k,l,X.has(k),'data-x')).join('');
  F.forEach(f=>{ const ids=[]; f.s.forEach(([,L])=>L.forEach(id=>{ if(!seen.has(id)&&GRPro.items[id]){ seen.add(id); ids.push(id); } }));
    if(ids.length)h+='<h2 class="sec">'+esc(f.t)+'</h2>'+ids.map(id=>row(id,GRPro.items[id][1],on.has(id),'data-e')).join(''); });
  const SET=new Set(['display','backup','sync','applock','aikey','tour','homesimple','homestyle','homelay','rddense','fatig','about']); const rest=Object.keys(GRPro.items).filter(id=>!seen.has(id)&&!SET.has(id));
  if(rest.length)h+='<h2 class="sec">Other</h2>'+rest.map(id=>row(id,GRPro.items[id][1],on.has(id),'data-e')).join('');
  box.innerHTML=h+'<button type="button" class="home-edit" id="essReset">Reset to the standard set</button></div>';
  const cnt=()=>{ box.querySelector('#essN').textContent=box.querySelectorAll('[data-e]:checked').length+' chosen'; }; cnt();
  box.querySelectorAll('[data-e]').forEach(c=>c.onchange=()=>{ if(c.checked)E.ids.push(c.dataset.e); else E.ids=E.ids.filter(x=>x!==c.dataset.e); cnt(); });
  box.querySelectorAll('[data-x]').forEach(c=>c.onchange=()=>{ const s=new Set(E.x||[]); c.checked?s.add(c.dataset.x):s.delete(c.dataset.x); E.x=[...s]; });
  box.querySelector('#essDone').onclick=()=>{ essSave(E); try{ localStorage.setItem('gr_ess_asked','1'); }catch(e){} W.goHome(); };
  box.querySelector('#essReset').onclick=()=>{ essSave({ids:EDEF.slice(),x:['recent']}); W.goHome(); };
  D.getElementById('view').scrollTop=0;
}
function setStyle(s){ try{ localStorage.setItem('gr_home_style',s); if(s==='v200'||s==='mix'){ localStorage.setItem('gr_pro_auto','1'); } else if(s==='original'){ localStorage.setItem('gr_theme','navy'); localStorage.setItem('gr_pro_auto','0'); localStorage.setItem('gr_look','classic'); } else { localStorage.setItem('gr_theme','pro'); localStorage.setItem('gr_pro_auto','1'); } }catch(e){} location.reload(); }

/* ---- Desktop: two columns — tools on the left, live info on the right, with subtitles shown ---- */
function desk(box){
  const root=box&&box.querySelector('.homeq'); if(!root||root.classList.contains('editing')||root.classList.contains('mini'))return;
  if(W.innerWidth<1100){ return; }
  const main=D.createElement('div'), side=D.createElement('aside'); main.className='hq-main'; side.className='hq-side';
  const SIDE=new Set(['news','inner','cams','tv','tasks','recent']);
  [...root.children].forEach(el=>{ const k=el.dataset&&el.dataset.b; const id=el.id||'';
    if((k&&SIDE.has(k))||/^home(Patrol|Gaol|Roster|Det)$/.test(id))side.appendChild(el); else main.appendChild(el); });
  let r=[]; try{ r=JSON.parse(localStorage.getItem('gr_recent')||'[]')||[]; }catch(e){}
  if(r.length){ const rec=D.createElement('section'); rec.className='hq-recent';
    rec.innerHTML='<h2 class="sec">Recently viewed</h2>'+r.slice(0,8).map(x=>'<button type="button" class="recentrow" data-k="'+esc(x.k)+'" data-id="'+esc(String(x.id))+'">'+I(x.k==='case'?'scale':x.k==='tool'?'wrench':x.k==='guide'?'book-open':'history')+'<div class="rr-t">'+esc(x.t)+'</div><div class="rr-s">'+esc(x.s||'')+'</div></button>').join('');
    rec.querySelectorAll('.recentrow').forEach(b=>b.onclick=()=>{ const k=b.dataset.k,id=b.dataset.id; if(k==='case'&&W.openCase)openCase(id); else if(k==='tool')GRPro.run(id); else if(k==='guide'&&W.openGuide3)openGuide3(id); else if(W.openPage)openPage(+id); });
    const old=side.querySelector('[data-b="recent"]'); if(old)old.remove(); side.insertBefore(rec,side.firstChild); }
  root.innerHTML=''; root.classList.add('desk'); root.appendChild(main); root.appendChild(side);
}
let deskW=W.innerWidth>=1100;
W.addEventListener('resize',()=>{ const n=W.innerWidth>=1100; if(n!==deskW){ deskW=n; try{ if(W.tab==='search'&&!(D.getElementById('q')||{}).value&&W.render)W.render(); }catch(e){} } });

/* ---- Full / Simple switch, and the full home's "Your picks" ---- */
function switcher(){ const m=mode()==='v200'?(simple()?'simple':'full'):mode()==='new'?'week':'';
  const B=(k,l)=>'<button type="button" data-hsw="'+k+'" class="'+(m===k?'on':'')+'">'+l+'</button>';
  return '<div class="hsw" role="tablist">'+B('full','Full')+B('simple','Simple')+B('week','Last week')+'</div>'; }
function wireSwitch(box){ box.querySelectorAll('[data-hsw]').forEach(b=>b.onclick=()=>{ const k=b.dataset.hsw;
  if(k==='week'){ if(mode()!=='new')setStyle('new'); return; }
  setSimple(k==='simple'); if(mode()!=='v200')setStyle('v200'); else W.goHome(); }); }
function addSwitch(view){}
function cycleHome(){ const ORDER=['mix','full','simple','week'], NAME={mix:'Home: Today · Browse · Search',full:'Home: Full',simple:'Home: Simple',week:'Home: Last week'};
  const m=mode()==='mix'?'mix':mode()==='v200'?(simple()?'simple':'full'):mode()==='new'?'week':'mix', n=ORDER[(ORDER.indexOf(m)+1)%ORDER.length];
  try{ localStorage.setItem('gr_home_toast',NAME[n]); }catch(e){}
  if(n==='week'){ setStyle('new'); return; } if(n==='mix'){ setStyle('mix'); return; }
  setSimple(n==='simple'); if(mode()!=='v200')setStyle('v200'); else { try{ localStorage.removeItem('gr_home_toast'); }catch(e){} if(W.grToast)grToast(NAME[n]); W.goHome(); } }
function homeName(){ return mode()==='mix'?'Today · Browse · Search':mode()==='new'?'Last week':simple()?'Simple':'Full'; }
try{ const t=localStorage.getItem('gr_home_toast'); if(t){ localStorage.removeItem('gr_home_toast'); setTimeout(()=>{ if(W.grToast)grToast(t); },1200); } }catch(e){}
const GROUPS=['job','work','inv','law','files','deep','manual'];
try{ if(localStorage.getItem('gr_home_v3')!=='1'){ localStorage.setItem('gr_home_v3','1'); let L=null; try{ L=JSON.parse(localStorage.getItem('gr_home')||'null'); }catch(e){}
  if(L&&Array.isArray(L.order)){ L.hidden=L.hidden||[]; if(!L.hidden.includes('manual'))L.hidden.push('manual'); localStorage.setItem('gr_home',JSON.stringify(L)); }
  else localStorage.setItem('gr_home',JSON.stringify({v:1,order:['tasks','news','recent','top','inner','cams','tv','job','work','inv','law','files','deep','manual'],boxes:{},hidden:['manual']})); } }catch(e){}
function full(box){
  const root=box&&box.querySelector('.homeq'); if(!root||root.classList.contains('editing'))return;
  const E=ess(), X=new Set(E.x||[]), wide=W.innerWidth>=1100;
  root.querySelectorAll('section.hblk').forEach(s=>{ if(GROUPS.includes(s.dataset.b)||s.dataset.b==='cams'||s.dataset.b==='tv')s.remove(); });
  let asked='1'; try{ asked=localStorage.getItem('gr_ess_asked')||''; }catch(e){}
  if(!asked){ pick(box); return; }
  const picks=D.createElement('section'); picks.className='hblk hq-picks'; picks.dataset.b='picks';
  picks.innerHTML='<h2 class="sec">My tools<span class="sec-r"><button type="button" class="sec-x" id="essEdit">Edit</button></span></h2><div class="quick mini-q">'+E.ids.map(tile).join('')+'</div>';
  const inner=root.querySelector('section.hblk[data-b="inner"]'), ed0=root.querySelector('.home-edit');
  if(inner)inner.after(picks); else if(ed0)root.insertBefore(picks,ed0); else root.appendChild(picks);
  picks.querySelectorAll('[data-it]').forEach(b=>b.onclick=()=>GRPro.run(b.dataset.it));
  picks.querySelector('#essEdit').onclick=()=>pick(box);
  const all=D.createElement('button'); all.type='button'; all.className='home-edit'; all.id='allTools'; all.innerHTML=I('list')+'All tools';
  all.onclick=()=>{ setTab('tools'); W.render(); D.getElementById('view').scrollTop=0; };
  picks.after(all);
  desk(box);
}

/* ---- Each page (Browse, Indexes, Tools, Saved) has its own Full / Simple / Last week ---- */
const PVN={browse:'Browse',index:'Indexes',tools:'Tools',saved:'Saved'};
function pv(k){ const d=k==='tools'?'week':'full'; try{ return localStorage.getItem('gr_pv_'+k)||d; }catch(e){ return d; } }
function pageSwitch(view,k){ if(!view||view.querySelector(':scope > .hsw'))return; const m=pv(k);
  const B=(x,l)=>'<button type="button" data-pv="'+x+'" class="'+(m===x?'on':'')+'">'+l+'</button>';
  view.insertAdjacentHTML('afterbegin','<div class="hsw pvsw" role="tablist" aria-label="'+esc(PVN[k]||'')+' layout">'+B('full','Full')+B('simple','Simple')+B('week','Last week')+'</div>');
  if(k==='index'){ const sw=view.querySelector(':scope > .pvsw'); sw.insertAdjacentHTML('afterend','<button type="button" class="home-edit" id="ixManual">'+I('book-open')+'Browse the manual</button>'); view.querySelector('#ixManual').onclick=()=>{ setTab('browse'); W.render(); D.getElementById('view').scrollTop=0; }; }
  view.querySelectorAll(':scope > .pvsw [data-pv]').forEach(b=>b.onclick=()=>{ try{ localStorage.setItem('gr_pv_'+k,b.dataset.pv); }catch(e){} const v=D.getElementById('view'); setTab(k); W.render(); v.scrollTop=0; }); }
const simple=()=>{ try{ return localStorage.getItem('gr_home_simple')==='1'; }catch(e){ return false; } };
function setSimple(v){ try{ localStorage.setItem('gr_home_simple',v?'1':'0'); }catch(e){} }
W.GRClassic={on,mode,render,setStyle,mini,simple,setSimple,desk,full,addSwitch,pv,pageSwitch,cycleHome,homeName};
})(window);
