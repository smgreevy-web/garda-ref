/* The original home (v60 style): hero with the badge, clock and online state; search; live strips; recent;
   grouped tool cards. Tabs Home · Search · Index · Tools · Saved. Switch in Settings → Home style. */
(function(W){ 'use strict';
const D=document;
try{ if(localStorage.getItem('gr_home_v')!=='2'){ localStorage.setItem('gr_home_v','2'); localStorage.setItem('gr_home_style','v200'); localStorage.setItem('gr_pro_auto','1'); localStorage.setItem('gr_theme','pro'); }
 if(!localStorage.getItem('gr_home_style')){ localStorage.setItem('gr_home_style','original'); localStorage.setItem('gr_theme','navy'); localStorage.setItem('gr_pro_auto','0'); localStorage.setItem('gr_look','classic'); } }catch(e){}
const mode=()=>{ try{ return localStorage.getItem('gr_home_style')||'v200'; }catch(e){ return 'v200'; } };
const on=()=>mode()==='original'||mode()==='v200';
const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
/* tab bar: swap before app.js wires it */
if(mode()==='v200'){ const tb=D.getElementById('tabbar'); if(tb)tb.innerHTML=
  '<button data-tab="search" data-ic="search" class="tab active" role="tab">Search</button>'+
  '<button data-tab="browse" data-ic="list" class="tab" role="tab">Browse</button>'+
  '<button data-tab="index" data-ic="book-text" class="tab" role="tab">Indexes</button>'+
  '<button data-tab="tools" data-ic="wrench" class="tab" role="tab">Tools</button>'+
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
function setStyle(s){ try{ localStorage.setItem('gr_home_style',s); if(s==='v200'){ localStorage.setItem('gr_pro_auto','1'); } else if(s==='original'){ localStorage.setItem('gr_theme','navy'); localStorage.setItem('gr_pro_auto','0'); localStorage.setItem('gr_look','classic'); } else { localStorage.setItem('gr_theme','pro'); localStorage.setItem('gr_pro_auto','1'); } }catch(e){} location.reload(); }
W.GRClassic={on,mode,render,setStyle};
})(window);
