window.GRAPP='62';
/* Assisting PWA — offline, no case data, no analytics */
'use strict';
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const view=$('#view'), reader=$('#reader'), rdBody=$('#rdBody');

let META=null, AZ=null, CASES=null, OPS=null, OPS2=null, TPL=null, G3=null, STEN=null, KB=null;
const CHUNKS={};            // file -> {start,end,pages}
let chunksReady=false, chunksLoading=false;
let curPage=1, tab='search', lastQuery='', lastFilter='all';
let toolState={};           // session-only checklist state
const FAVKEY='gr_favs_v1';
let favs=JSON.parse(localStorage.getItem(FAVKEY)||'[]'); // [{a,title,label}] — section IDs only

/* ---------- boot ---------- */
(async function boot(){
  if('serviceWorker' in navigator){ try{ navigator.serviceWorker.register('sw.js'); }catch(e){} }
  const [m,a,cs,op,sn,kb,o2,tpl,g3]=await Promise.all(['meta','az','cases','ops','stencils','kb','ops2','templates','guides3'].map(f=>fetch('data/'+f+'.json').then(r=>r.json())));
  META=m; AZ=a; CASES=cs; OPS=op; OPS2=o2; TPL=tpl; G3=g3; STEN=sn; KB=kb;
  window.GRVER='v'+(window.GRAPP||'')+' · content '+META.built+' · '+META.pages+' pp'; { const vi=$('#verinfo'); if(vi)vi.textContent=GRVER; }
  wrapSubviews(); bindUI(); render();
  loadAllChunks(); // background; SW caches for offline
})();

async function loadAllChunks(){
  if(chunksLoading) return; chunksLoading=true;
  let done=0, total=META.chunks.length;
  const st=$('#loadState');
  for(const c of META.chunks){
    try{ CHUNKS[c.f]=await fetch(c.f).then(r=>r.json()); }
    catch(e){ st.textContent='Load failed — retry online'; heroLoad('LOAD FAILED · RETRY ONLINE'); chunksLoading=false; return; }
    done++; st.textContent='Loading '+done+'/'+total; heroLoad('LOADING '+done+'/'+total);
    if(tab==='search'&&lastQuery) doSearch(lastQuery,lastFilter,true);
  }
  chunksReady=true; st.textContent='All content saved offline'; st.classList.add('ok'); heroLoad('OFFLINE READY');
  setTimeout(()=>{st.textContent='';},2500);
}

const HEAD_EMO=/^[\s\u2190-\u21FF\u2300-\u23FF\u2460-\u27BF\u2900-\u2BFF\u{1F000}-\u{1FAFF}\uFE0F\u200D★☆◉⌕✓✦▸•]+/u;
function tidyHeads(root){
  root.querySelectorAll('h2.sec:not([data-t])').forEach(h=>{ h.dataset.t='1';
    if(h.querySelector('.sec-r')||h.children.length)return;
    let t=h.textContent.replace(HEAD_EMO,'').trim(), sub='';
    const i=t.indexOf(' — '); if(i>0&&t.length>30){ sub=t.slice(i+3).trim(); t=t.slice(0,i).trim(); }
    h.textContent=t;
    if(sub){ const d=document.createElement('div'); d.className='sec-sub'; d.textContent=sub.charAt(0).toUpperCase()+sub.slice(1); h.after(d); }
  });
}
new MutationObserver(()=>tidyHeads(view)).observe(view,{childList:true,subtree:true});
function heroLoad(t){ window._heroLoad=t; document.querySelectorAll('.hs-load').forEach(e=>{e.textContent=t;}); }
function pageText(abs){
  for(const c of META.chunks){ if(abs>=c.s&&abs<=c.e){ const ch=CHUNKS[c.f]; return ch?ch.pages[abs-c.s]:null; } }
  return null;
}
function pageLabel(abs){ return META.labels[abs]||('p.'+abs); }
function topicEmoji(t){t=(t||'').toLowerCase();
  if(/knife|blade|weapon|s\.9|offensive/.test(t))return '🔪 ';
  if(/firearm|gun|s\.15 fire/.test(t))return '🔫 ';
  if(/drug|misuse|controlled/.test(t))return '💊 ';
  if(/traffic|collision|rta|driving|vehicle|scooter/.test(t))return '🚗 ';
  if(/assault|harm|nfoap/.test(t))return '👊 ';
  if(/theft|burglary|robbery|stolen/.test(t))return '🧰 ';
  if(/sexual|rape|consent/.test(t))return '⚠️ ';
  if(/public order|intoxicat/.test(t))return '📢 ';
  if(/cctv|footage/.test(t))return '📹 ';
  if(/search|warrant/.test(t))return '🔍 ';
  if(/domestic|coercive/.test(t))return '🏠 ';
  return '';}
function titleFor(abs){
  const t=META.titles; let lo=0,hi=t.length-1,ans='Cover';
  while(lo<=hi){const mid=(lo+hi)>>1; if(t[mid][0]<=abs){ans=t[mid][1];lo=mid+1;}else hi=mid-1;}
  return ans;
}
function isDated(abs){ return abs>=993; } // 2007 manual

/* ---------- tabs ---------- */
function applyFS(){document.documentElement.dataset.fs=localStorage.getItem('gr_fs')||'m';}
/* ---------- display: theme + text size (the Aa button) ---------- */
/* [key, name, note, page, card, text, accent, tone] — keep in step with the head script in index.html and the tokens in theme.css */
const THEMES=[
  ['ivory','Ivory','Warm paper · best in daylight','#f3f0e9','#fbf9f4','#1d2733','#1f4e79','light'],
  ['daylight','Daylight','Maximum contrast · bright sun','#f2f3f5','#ffffff','#000000','#0047b3','light'],
  ['sepia','Sepia','Soft and warm · long reads','#eee4d1','#f6eedd','#2e2316','#8a4513','light'],
  ['mist','Mist & indigo','Cool grey · crisp','#eef1f5','#f8fafc','#18212c','#3d4db7','light'],
  ['slate','Slate','Neutral grey · soft blue','#121519','#191d23','#e4e7eb','#8fb0d6','dark'],
  ['graphite','Graphite & teal','Minimal · easy at night','#0f1111','#171a19','#e5e8e6','#72b6a9','dark'],
  ['navy','Navy & brass','Classic','#0c1320','#121b2a','#e6eaf0','#c9a96e','dark'],
  ['forest','Forest & sage','Deep green · calm','#0f1411','#151c18','#e2e9e4','#9cc58f','dark'],
  ['midnight','Midnight & amber','True black · gentle at night','#000000','#0d0d0e','#ece9e4','#e0a650','dark']];
function applyTheme(t){
  let th=THEMES.find(x=>x[0]===t); if(!th)th=THEMES[0];
  const d=document.documentElement; d.dataset.theme=th[0]; d.dataset.tone=th[7]; try{localStorage.setItem('gr_theme',th[0]);}catch(e){}
  const m=document.querySelector('meta[name="theme-color"]'); if(m)m.setAttribute('content',th[3]);
  try{ window.dispatchEvent(new CustomEvent('gr:theme',{detail:th[0]})); }catch(e){}
}
function displaySheet(){
  let o=document.getElementById('dsp');
  if(!o){ o=document.createElement('div'); o.id='dsp'; o.className='dsp hidden'; document.body.appendChild(o); }
  const cur=document.documentElement.dataset.theme||'ivory', fs=localStorage.getItem('gr_fs')||'m';
  const tile=([k,n,d,pg,cd,tx,ac])=>'<button type="button" class="dsp-t'+(k===cur?' on':'')+'" data-th="'+k+'" aria-pressed="'+(k===cur)+'">'
    +'<span class="sw" style="background:'+pg+'" aria-hidden="true"><span class="sw-c" style="background:'+cd+'"><i style="background:'+tx+'"></i><i style="background:'+tx+'"></i><em style="background:'+ac+'"></em></span></span>'
    +'<span class="lt"><b>'+esc(n)+'</b><small>'+esc(d)+'</small></span>'+(window.GRI?GRI('check','ok'):'')+'</button>';
  o.innerHTML='<div class="dsp-shade"></div><div class="dsp-sheet" role="dialog" aria-label="Display"><div class="dsp-grip"></div><h3>Display</h3>'
    +'<div class="dsp-l">Light themes</div><div class="dsp-th">'+THEMES.filter(x=>x[7]==='light').map(tile).join('')+'</div>'
    +'<div class="dsp-l">Dark themes</div><div class="dsp-th">'+THEMES.filter(x=>x[7]==='dark').map(tile).join('')+'</div>'
    +'<div class="dsp-l">Text size</div><div class="dsp-fs">'+['s','m','l','xl'].map((k,i)=>'<button type="button" data-fs="'+k+'" class="'+(k===fs?'on':'')+'" style="font-size:'+(13+i*3)+'px" aria-label="Text size '+k+'">A</button>').join('')+'</div>'
    +'<p class="dsp-n">The theme carries through every screen — tools, cameras, notes and the reader.</p>'
    +'<button type="button" class="dsp-done">Done</button></div>';
  const close=()=>o.classList.add('hidden');
  o.querySelector('.dsp-shade').onclick=close; o.querySelector('.dsp-done').onclick=close;
  o.querySelectorAll('[data-th]').forEach(b=>b.onclick=()=>{ applyTheme(b.dataset.th); o.querySelectorAll('[data-th]').forEach(x=>{ x.classList.toggle('on',x===b); x.setAttribute('aria-pressed',String(x===b)); }); });
  o.querySelectorAll('[data-fs]').forEach(b=>b.onclick=()=>{ localStorage.setItem('gr_fs',b.dataset.fs); applyFS(); o.querySelectorAll('[data-fs]').forEach(x=>x.classList.toggle('on',x===b)); if(typeof bookRelayout==='function')setTimeout(bookRelayout,60); });
  o.classList.remove('hidden');
}
window.displaySheet=displaySheet;
function updateDlBtn(){const d=$('#rdDl');if(d)d.style.display=curDoc?'':'none';}
function bindUI(){
  applyFS();
  const top=document.querySelector('.rd-top');
  if(top){
    top.insertAdjacentHTML('beforeend','<div id="rdProg"></div>');
    const star=$('#rdStar');
    star.insertAdjacentHTML('beforebegin','<button id="rdBook" class="iconbtn" title="Book reading — page by page" aria-label="Book reading" aria-pressed="false">'+(window.GRI?GRI('book-open-text'):'B')+'</button><button id="rdDl" class="iconbtn" title="Download as Word" aria-label="Download Word document" style="display:none">'+(window.GRI?GRI('download'):'⬇')+'</button>');
    const rb=$('#rdBack'); if(rb&&window.GRI)rb.innerHTML=GRI('chevron-left');
    $('#rdDl').addEventListener('click',()=>{if(curDoc)downloadDoc(curDoc.title,curDoc.text);});
    $('#rdBook').addEventListener('click',bookToggle);
    bookWire();
    rdBody.addEventListener('scroll',()=>{if(book.on)return;const el=rdBody;const max=el.scrollHeight-el.clientHeight;
      const p=max>0?(el.scrollTop/max*100):0;const bar=$('#rdProg');if(bar)bar.style.width=p+'%';},{passive:true});
  }
  $('#topbar .tb-clock').insertAdjacentHTML('afterend','<button id="fsBtn" title="Theme and text size" aria-label="Theme and text size"><span>A</span><span>a</span></button>');
  $('#fsBtn').addEventListener('click',displaySheet);
  $$('#tabbar .tab').forEach(b=>{
    if(window.GRI&&b.dataset.ic&&!b.querySelector('.gri'))b.insertAdjacentHTML('afterbegin',GRI(b.dataset.ic));
    b.addEventListener('click',()=>{ const t=b.dataset.tab;
      if(t===tab&&view.dataset.root===t){ view.scrollTo({top:0,behavior:'smooth'}); if(t==='search'){const i=$('#q'); if(i)i.focus();} return; }
      setTab(t); closeReader(); render(); view.scrollTop=0; if(t==='search'){const i=$('#q'); if(i&&!lastQuery)i.focus();} });
  });

  $('#brandBtn').addEventListener('click',goHome);
  $('#brandBtn').insertAdjacentHTML('beforebegin','<button id="tbBack" class="tbback" aria-label="Back">'+(window.GRI?GRI('chevron-left'):'‹')+'</button>');
  $('#tbBack').addEventListener('click',()=>{ if(window.grBack)grBack(); });
  $('#rdBack').addEventListener('click',closeReader);
  $('#rdPrev').addEventListener('click',()=>openPage(Math.max(1,curPage-1)));
  $('#rdNext').addEventListener('click',()=>openPage(Math.min(META.pages,curPage+1)));
  $('#rdJump').addEventListener('click',jumpPrompt);
  $('#rdStar').addEventListener('click',toggleFav);
  document.addEventListener('keydown',e=>{ if(!reader.classList.contains('hidden')){ if(e.key==='ArrowLeft')openPage(Math.max(1,curPage-1)); if(e.key==='ArrowRight')openPage(Math.min(META.pages,curPage+1)); if(e.key==='Escape')closeReader(); }});
}

function render(){
  if(tab==='home')tab='search';
  setTab(tab); vstack.length=0; vcur=null; view.dataset.root=tab; document.body.classList.remove('subview');
  if(tab==='search')renderSearch();
  else if(tab==='browse')renderBrowse();
  else if(tab==='index')renderIndex();
  else if(tab==='tools')renderTools();
  else renderSaved();
}
function setTab(t){ tab=t; $$('#tabbar .tab').forEach(x=>x.classList.toggle('active',x.dataset.tab===t)); }
function goHome(){ lastQuery=''; setTab('search'); closeReader(); render(); view.scrollTop=0; }
function searchFor(q,opt){ lastQuery=q||''; lastFilter='all'; setTab('search'); closeReader(); render(); view.scrollTop=0;
  if(opt&&opt.focus){ const i=$('#q'); if(i)i.focus(); } }
function subView(){ view.innerHTML='<div id="results"></div>'; view.scrollTop=0; return $('#results'); }
/* sub-view stack: every screen drawn into #view that isn't a tab's own page. Back steps through it, then to the tab, then Home. */
const vstack=[]; let vcur=null;
const SUBVIEWS=['renderPTP','renderGuides','renderMajor','renderEssentials','renderOffences','renderOffence','renderStencils','renderLive','renderClock',
  'renderCourtDay','renderCaution','renderKBtopic','renderLatin','renderAcronyms','renderCCTV','renderCautions','renderTemplates','openTemplate','renderExhibits',
  'renderLang','renderDeep','renderChecklists','renderJudgments','renderCourtLists','renderAbout','renderAISettings'];
function sameArgs(a,b){ return JSON.stringify(a||[])===JSON.stringify(b||[]); }
function wrapSubviews(){
  for(const name of SUBVIEWS){ const orig=window[name]; if(typeof orig!=='function'||orig._sv)continue;
    const w=function(...a){
      a=a.filter(x=>x!==undefined&&!(x&&typeof x==='object'&&'isTrusted' in x));   // drop click events passed by listeners
      const ix=vstack.findIndex(e=>e.f===name&&sameArgs(e.a,a));
      if(ix>=0){ vstack.length=ix; }                                             // "up" to a screen already in the trail
      else if(vcur){ if(vcur.f!==name||(!vcur.a.length&&a.length)) vstack.push({f:vcur.f,a:vcur.a,y:view.scrollTop}); }
      vcur={f:name,a}; view.dataset.root=''; document.body.classList.add('subview');
      return orig.apply(this,a); };
    w._sv=1; w._orig=orig; window[name]=w; }
}

/* ---------- SEARCH (search.js draws the Search tab; this is only the fallback) ---------- */
const FILTERS=[['all','Everything'],['vols','Vols 1–11'],['v12','Vol 12'],['st','Statements'],['pb','Playbooks'],['man','2007 Manual']];
const FRANGE={vols:[15,937],v12:[938,968],st:[969,992],pb:[986,992],man:[993,1478]};
function renderSearch(){
  if(window.GRSearch){ GRSearch.render(view,{q:lastQuery,home:homeQuick}); return; }
  view.innerHTML=`<div class="tabroot" data-tab="search" hidden></div>
  <div class="searchbox sb-mag"><input id="q" type="search" placeholder="Search — topic, case, statute, offence…" value="${esc(lastQuery)}" autocomplete="off" enterkeyhint="search"></div>
  <div id="results"></div>`;
  const q=$('#q'); let t;
  q.addEventListener('input',()=>{clearTimeout(t);t=setTimeout(()=>doSearch(q.value,lastFilter),200);});
  q.addEventListener('keydown',e=>{if(e.key==='Enter'){q.blur();doSearch(q.value,lastFilter);}});
  lastFilter='all';
  if(lastQuery)doSearch(lastQuery,lastFilter,true); else homeQuick($('#results'));
}

/* ---------- HOME ---------- */
const HERO=[
  ['hOsint','map','Map','stations · districts · cameras · DCC CCTV · Street View pin · draw & measure — you choose what\u2019s on'],
  ['hFirstAid','heart-pulse','Medical emergency','call 112/999 · CPR metronome · choking · bleeding · overdose · 22 conditions · step by step','red'],
  ['hTools','toolbox','Toolbox','ruler · measure with evidence photo · evidence camera · level · compass · torch · timers · 21 tools']];
const HOME=[
 {h:'Live cameras',r:'live',c:[
  ['hCamDist','cctv','Fitzgibbon St / Mountjoy','street cams · your district + north city'],
  ['hCamM50','route','M50 motorway','every TII camera · J3 → J17'],
  ['hCamPort','ship','Dublin Port','ships · Liffey · Poolbeg'],
  ['hCamAll','video','All cameras','organised list · M1 · N4 · N7 too'],
  ['hDccList','list-video','DCC City CCTV list','241 Dublin City Council cameras · search a street → pinpoint it on the map · locations only, no live feed','wide']]},
 {h:'Live TV & radio',c:[
  ['hLiveNews','tv','Live news','Sky News live · RTÉ News latest · in the app'],
  ['hRadio','radio','Irish radio','favourites · RTÉ · Newstalk · 98 · FM104 · all'],
  ['hSocial','message-circle','Social media','official Garda accounts · Garda Info · Garda Traffic · DMR Facebook · TikTok · read-only','wide']]},
 {h:'On the job',c:[
  ['qbOff','shield','Offences','elements · arrest · statement'],
  ['hPatrol','walk','Proactive patrol','GPS route · stops · times · patrol log'],
  ['hClock','timer','Detention clock','deadlines · extensions · alerts'],
  ['hGaol','users','Gaoler · cell checks','buzz 2 min before each check'],
  ['hCaution','triangle-alert','Cautions','wording · declarations'],
  ['hScene','sunrise','First at scene','golden hour']]},
 {h:'My work',c:[
  ['hRoster','calendar-days','My roster','today · next tour · leave · court · swaps'],
  ['hTasks','square-check','Tasks','CCTV · arrests · deadlines · photo a list'],
  ['hNotes','notebook-pen','Notes','sketches · photos · checklists · lock'],
  ['hRec','mic','Voice recorder','markers · crash-safe · stays on phone'],
  ['hScan','scan-text','Scanner','documents → PDF · saved to phone only'],
  ['hPres','monitor','Present to TV','photos & CCTV on the TV · Smart View · DeX']]},
 {h:'In-depth investigation guides',c:[
  ['hAssault','hand','Assault','scene · evidence · trial · case law'],
  ['hRobbery','wallet','Robbery from person','force · ID · continuing act'],
  ['hBurglary','door-open','Burglary','entry forensics · recent possession'],
  ['hTheft','shopping-bag','Theft & handling','dishonesty · claim of right'],
  ['hDrugs2','pill','Drugs prosecutions','MDA · s.23 · s.26 warrants'],
  ['hImm','plane','Immigration','status · smuggling · trafficking']]},
 {h:'Law & authority',c:[
  ['qbEss','star','Essential case law','the ones that changed everything'],
  ['qbCases','library','Full case library','383 cases, categorised'],
  ['hBail','scale','Objecting to bail',"O'Callaghan · s.2 · burglary presumption"],
  ['hOcall','clipboard-list',"O'Callaghan worksheet",'systematic objection'],
  ['hBailpack','folder-open','Bail pack','case-manager worksheet'],
  ['hAmend','file-pen-line','Recent amendments','new laws by area — verify'],
  ['hJudg','gavel','Judgments search','BAILII Ireland · Supreme · Appeal · High'],
  ['hCourtLists','calendar-clock','Court lists','CCJ & all Dublin courts — today']]},
 {h:'Files & paperwork',c:[
  ['hGuides','file-text','Statement guides','per offence'],
  ['hSten','layout-template','Stencils','your templates'],
  ['hTpl','mail','Templates','CCTV · s.41 · agency'],
  ['hPrecis','file-check','Précis of evidence','build it to win']]},
 {h:'Deep guides',c:[
  ['hPO','megaphone','Public order','s.6 & s.8'],
  ['hAffray','swords','Affray','investigation guide'],
  ['hClamp','car-front','Clamping & s.41','public clamping · seizure · rogue clampers'],
  ['hIplan','messages-square','Interview plan','stencil'],
  ['hDrugs','pill','Drugs prosecutions','MDA · s.23 · s.26 warrants'],
  ['hRare','scroll','Rare offences','niche statutes'],
  ['hDeep','book-open','All deep guides','search · weapons · RTC · MP','wide']]},
 {h:'The manual',c:[
  ['g986','book-marked','Playbooks','5-part per offence'],
  ['g955','brain','Inference aide','ss.18/19/19A'],
  ['g975','eye','ADVOKATE','identification'],
  ['g941','message-square-quote','Cross-exam','surviving the stand'],
  ['g945','landmark','Law of evidence','V12 Part B'],
  ['g144','file-pen','Assault statements','s.2 / s.3 guide'],
  ['hLang','languages','Latin & acronyms','ABC · MMO · PEACE'],
  ['hCourt','gavel','Court-day mode','everything for the stand']]}
];
function hsub(t){ const p=String(t).split(' · '); return p.map((x,i)=>'<span class="sb">'+esc(x)+(i<p.length-1?' ·':'')+'</span>').join(' '); }
function hcard(c){ const [id,ic,t,sub,cls]=c; const go=/^g\d+$/.test(id)?` data-go="${id.slice(1)}"`:` id="${id}"`;
  return `<button class="qbtn${cls?' '+cls:''}"${go}><span class="qh">${GRI(ic)}<b>${esc(t)}</b></span><small>${hsub(sub)}</small></button>`; }
/* ---------- HOME layout: every block and box can be moved, hidden and brought back ---------- */
const HOME_KEYS=['cams','tv','job','work','inv','law','files','deep','manual'];
HOME.forEach((g,i)=>{ g.k=g.k||HOME_KEYS[i]; });
const HOME_STRIPS={tasks:'Tasks',news:'Need-to-know news',recent:'Recent',inner:'Dublin inner city'};
const BOXES={}; HERO.forEach(c=>{ BOXES[c[0]]=c; }); HOME.forEach(g=>g.c.forEach(c=>{ BOXES[c[0]]=c; }));
function homeDefault(){ const boxes={top:HERO.map(c=>c[0])}; HOME.forEach(g=>{ boxes[g.k]=g.c.map(c=>c[0]); });
  return {order:['tasks','news','recent','top','inner',...HOME.map(g=>g.k)],boxes,hidden:[]}; }
function homeLayout(){
  const d=homeDefault(); let sv=null; try{ sv=JSON.parse(localStorage.getItem('gr_home')||'null'); }catch(e){}
  if(!sv||!Array.isArray(sv.order))return d;
  const known=new Set(d.order), order=sv.order.filter(k=>known.has(k));
  d.order.forEach((k,i)=>{ if(!order.includes(k))order.splice(Math.min(i,order.length),0,k); });   // new blocks go where they'd be by default
  const placed=new Set(), boxes={};
  Object.keys(d.boxes).forEach(k=>{ boxes[k]=((sv.boxes||{})[k]||[]).filter(id=>BOXES[id]&&!placed.has(id)&&placed.add(id)); });
  Object.keys(d.boxes).forEach(k=>d.boxes[k].forEach(id=>{ if(!placed.has(id)){ boxes[k].push(id); placed.add(id); } }));   // new boxes join their usual section
  return {order,boxes,hidden:(sv.hidden||[]).filter(id=>known.has(id)||BOXES[id])}; }
function homeSave(L){ try{ localStorage.setItem('gr_home',JSON.stringify({v:1,order:L.order,boxes:L.boxes,hidden:L.hidden})); }catch(e){} }
let homeEdit=false;
function homeEditOpen(){ homeEdit=true; if(tab!=='search'||lastQuery){ lastQuery=''; setTab('search'); } closeReader(); render(); view.scrollTop=0; }
function homeEditDone(){ homeEdit=false; const r=$('#results'); if(r&&r.querySelector('.homeq'))homeQuick(r); }
window.homeEditOpen=homeEditOpen;
function homeQuick(box){
  box=box||$('#results'); if(!box)return;
  const lp=+localStorage.getItem('gr_lastpage')||0;
  let recent=[]; try{recent=JSON.parse(localStorage.getItem('gr_recent')||'[]');}catch(e){}
  let rows=recent.slice();
  if(lp){ rows=rows.filter(r=>!(r.k!=='guide'&&+r.id===lp)); rows.unshift({k:'page',id:lp,t:titleFor(lp).split(' › ').pop(),s:pageLabel(lp)+' · continue reading',ts:0,cont:1}); }
  const L=homeLayout(), hid=new Set(L.hidden), ed=homeEdit;
  const eye=on=>GRI(on?'eye':'eye-off');
  const card=(id,sec)=>{ const c=BOXES[id]; if(!c)return ''; if(!ed&&hid.has(id))return '';
    const [bid,ic,t,sub,cls0]=c, cls=((sec==='top'?'hero ':'')+(cls0||'')).trim();
    const go=/^g\d+$/.test(bid)?` data-go="${bid.slice(1)}"`:` id="${bid}"`;
    return `<button class="qbtn${cls?' '+cls:''}${ed&&hid.has(id)?' hid':''}"${go} data-box="${bid}">`
      +(ed?`<span class="he-ctl"><i class="he-eye" data-eye="${bid}" aria-label="${hid.has(id)?'Show':'Hide'}">${eye(!hid.has(id))}</i><i class="he-drag" data-drag="${bid}" aria-label="Move">${GRI('grip')}</i></span>`:'')
      +`<span class="qh">${GRI(ic)}<b>${esc(t)}</b></span><small>${hsub(sub)}</small></button>`; };
  const bar=(k,name)=>ed?`<div class="hb-bar"><i class="he-drag" data-bdrag="${k}" aria-label="Move">${GRI('grip')}</i><b>${esc(name)}</b><i class="he-eye" data-beye="${k}" aria-label="${hid.has(k)?'Show':'Hide'}">${eye(!hid.has(k))}</i></div>`:'';
  const blk=(k,inner)=>`<section class="hblk${ed&&hid.has(k)?' hid':''}" data-b="${k}">${inner}</section>`;
  const recentHtml=()=>`<h2 class="sec">Recent<span class="sec-r"><button type="button" class="sec-x" id="recentHide" aria-label="Hide Recent">Hide</button></span></h2><div class="recentwrap">`+
    rows.slice(0,2).map(r=>`<button class="recentrow${r.cont?' cont':''}" data-k="${r.k}" data-id="${esc(String(r.id))}">${GRI(r.cont?'book-open':'history')}<div class="rr-t">${esc(r.t)}</div><div class="rr-s">${esc(r.s)}</div><div class="rr-time">${r.cont?'':relTime(r.ts)}</div></button>`).join('')+`</div>`;
  const blockHtml=k=>{
    if(hid.has(k)&&!ed)return '';
    if(HOME_STRIPS[k]){
      if(ed)return blk(k,bar(k,HOME_STRIPS[k]));
      if(k==='recent')return rows.length?blk(k,recentHtml()):'';
      return blk(k,`<div id="${{tasks:'homeTasks',news:'homeNews',inner:'homeInner'}[k]}"></div>`); }
    if(k==='top'){ const ids=L.boxes.top; return blk(k,bar(k,'Top · big boxes')+`<div class="heroes" data-sec="top">${ids.map(id=>card(id,'top')).join('')}</div>`); }
    const g=HOME.find(x=>x.k===k); if(!g)return '';
    return blk(k,(ed?bar(k,g.h):`<h2 class="sec">${esc(g.h)}${g.r==='live'?'<span class="sec-r live"><i></i>LIVE</span>':''}</h2>`)
      +`<div class="quick" data-sec="${k}">${L.boxes[k].map(id=>card(id,k)).join('')}</div>`); };
  box.innerHTML=`<div class="homeq${ed?' editing':''}">
  ${ed?`<div class="he-banner"><b>Customise Home</b><span>Drag ${GRI('grip')} to move · tap ${GRI('eye')} to hide or show</span><div class="he-acts"><button type="button" id="heReset">Reset</button><button type="button" id="heDone" class="on">Done</button></div></div>`:''}
  <div id="homePatrol"></div>
  <div id="homeGaol"></div>
  <div id="homeRoster"></div>
  <div id="homeDet"></div>
  ${L.order.map(blockHtml).join('')}
  ${ed?'':`<button type="button" class="home-edit" id="homeEditBtn">${GRI('sliders-horizontal')}Customise Home</button>`}
  <div class="empty">Or type anything above — all 1,478 pages are searchable.</div>
  </div>`;
  if(ed){ homeEditWire(box,L); return; }
  { const eb=box.querySelector('#homeEditBtn'); if(eb)eb.addEventListener('click',homeEditOpen);
    const rh=box.querySelector('#recentHide'); if(rh)rh.addEventListener('click',e=>{ e.stopPropagation(); const L2=homeLayout(); if(!L2.hidden.includes('recent'))L2.hidden.push('recent'); homeSave(L2); homeQuick(box); if(window.grToast)grToast('Recent hidden — Customise Home brings it back'); }); }
  if(window.grHudTick)grHudTick();
  box.querySelectorAll('.recentrow').forEach(b=>b.addEventListener('click',()=>{
    const k=b.dataset.k, id=b.dataset.id;
    if(k==='guide')openGuide3(id); else openPage(+id);
  }));
  const go=(id,fn)=>{const b=box.querySelector('#'+id); if(b)b.addEventListener('click',fn);};
  go('qbOff',()=>renderOffences());
  go('qbEss',()=>renderEssentials());
  go('qbCases',()=>{ixKind='case';setTab('index');render();});
  go('hPatrol',()=>{ if(window.openPatrol) openPatrol(); });
  go('hGaol',()=>{ if(window.openGaol) openGaol(); });
  go('hClock',()=>{ if(window.openDetention) openDetention(); else renderClock(); });
  go('hCaution',()=>renderCautions());
  go('hScene',()=>renderMajor());
  go('hOsint',()=>{ if(window.openOSINT) window.openOSINT(); });
  go('hCamDist',()=>{ if(window.openCamReel) window.openCamReel(0,'district',true); });
  go('hCamM50',()=>{ if(window.openCamReel) window.openCamReel(0,'m50',true); });
  go('hCamPort',()=>{ if(window.openCamReel) window.openCamReel(0,'port',true); });
  go('hCamAll',()=>{ if(window.openCamReel) window.openCamReel(0,null,true); });
  go('hDccList',()=>{ if(window.openDccList) window.openDccList(); });
  go('hTools',()=>{ if(window.openToolbox) window.openToolbox(); });
  go('hFirstAid',()=>{ if(window.openFirstAid) openFirstAid(); });
  go('hLiveNews',()=>{ if(window.GRMedia) GRMedia.openTV('sky'); });
  go('hRadio',()=>{ if(window.GRMedia) GRMedia.openRadio(); });
  go('hSocial',()=>{ if(window.openSocial) openSocial(); });
  if(window.GRPatrol) GRPatrol.mountStrip(box.querySelector('#homePatrol'));
  if(window.GRGaol) GRGaol.mountStrip(box.querySelector('#homeGaol'));
  if(window.GRDet) GRDet.mountStrip(box.querySelector('#homeDet'));
  if(window.GRRoster) GRRoster.mountStrip(box.querySelector('#homeRoster'));
  if(window.GRTasks) GRTasks.mountStrip(box.querySelector('#homeTasks'));
  go('hRoster',()=>{ if(window.openRoster) openRoster(); });
  go('hTasks',()=>{ if(window.openTasks) openTasks(); });
  go('hNotes',()=>{ if(window.openNotes) openNotes(); });
  go('hRec',()=>{ if(window.openRecorder) openRecorder(); });
  go('hScan',()=>{ if(window.openScanner) openScanner(); });
  go('hPres',()=>{ if(window.openPresent) openPresent(); });
  if(window.GRMedia){ GRMedia.mountNewsStrip(box.querySelector('#homeNews')); if(GRMedia.mountInnerStrip)GRMedia.mountInnerStrip(box.querySelector('#homeInner')); }
  go('hBail',()=>openGuide3('bail'));
  go('hOcall',()=>openGuide3('ocall'));
  go('hBailpack',()=>openTemplate(TPL.findIndex(t=>t.id==='bailpack')));
  go('hAssault',()=>openGuide3('assault_inv'));
  go('hRobbery',()=>openGuide3('robbery_inv'));
  go('hBurglary',()=>openGuide3('burglary_inv'));
  go('hTheft',()=>openGuide3('theft_inv'));
  go('hDrugs2',()=>openGuide3('drugs'));
  go('hDrugs',()=>openGuide3('drugs'));
  go('hImm',()=>openGuide3('immigration_inv'));
  go('hRare',()=>openGuide3('rare'));
  go('hPrecis',()=>openGuide3('precis2'));
  go('hPO',()=>openGuide3('po'));
  go('hAffray',()=>openGuide3('affray'));
  go('hClamp',()=>openGuide3('clamping'));
  go('hIplan',()=>openGuide3('iplan'));
  go('hAmend',()=>openGuide3('amendments'));
  go('hJudg',()=>renderJudgments());
  go('hCourtLists',()=>renderCourtLists());
  go('hGuides',()=>renderGuides());
  go('hSten',()=>renderStencils());
  go('hTpl',()=>renderTemplates());
  go('hDeep',()=>renderDeep());
  go('hLang',()=>renderLang());
  go('hCourt',()=>renderCourtDay());
  box.querySelectorAll('.qbtn[data-go]').forEach(b=>b.addEventListener('click',()=>openPage(+b.dataset.go)));
}
/* edit mode: drag a box (or a whole block) by its handle; the eye hides or shows it */
function homeEditWire(box,L){
  const root=box.querySelector('.homeq');
  const fromDom=()=>{ const order=[...root.querySelectorAll('.hblk')].map(b=>b.dataset.b), boxes={};
    root.querySelectorAll('[data-sec]').forEach(g=>{ boxes[g.dataset.sec]=[...g.querySelectorAll('[data-box]')].map(x=>x.dataset.box); });
    return {order,boxes,hidden:homeLayout().hidden}; };
  root.querySelector('#heDone').addEventListener('click',homeEditDone);
  root.querySelector('#heReset').addEventListener('click',()=>{ try{ localStorage.removeItem('gr_home'); }catch(e){} homeQuick(box); if(window.grToast)grToast('Home is back to the standard layout'); });
  root.addEventListener('click',e=>{ const t=e.target.closest('[data-eye],[data-beye]');
    if(t){ const id=t.dataset.eye||t.dataset.beye, L2=fromDom(), i=L2.hidden.indexOf(id); if(i>=0)L2.hidden.splice(i,1); else L2.hidden.push(id); homeSave(L2); const y=view.scrollTop; homeQuick(box); view.scrollTop=y; }
    if(e.target.closest('.qbtn,.recentrow')){ e.preventDefault(); e.stopPropagation(); } },true);
  let st=null, raf=0;
  const place=(x,y)=>{
    if(st.block){ const bl=[...root.querySelectorAll('.hblk')].filter(b=>b!==st.el); let before=null;
      for(const b of bl){ const r=b.getBoundingClientRect(); if(y<r.top+r.height/2){ before=b; break; } }
      if(before){ if(before!==st.el.nextElementSibling)root.insertBefore(st.el,before); }
      else { const last=bl[bl.length-1]; if(last&&last.nextElementSibling!==st.el)last.after(st.el); }
      return; }
    const t=document.elementFromPoint(x,y); if(!t)return;
    const cardEl=t.closest('.homeq [data-box]'), grid=t.closest('[data-sec]')||(t.closest('.hblk')&&t.closest('.hblk').querySelector('[data-sec]'));
    if(cardEl&&cardEl!==st.el){ const r=cardEl.getBoundingClientRect(), hero=cardEl.parentNode.dataset.sec==='top';
      const before=hero?y<r.top+r.height/2:(y<r.top+r.height*.3||(y<r.bottom-r.height*.3&&x<r.left+r.width/2));
      if(before){ if(cardEl.previousElementSibling!==st.el)cardEl.before(st.el); } else if(cardEl.nextElementSibling!==st.el)cardEl.after(st.el); }
    else if(grid&&!grid.contains(st.el))grid.appendChild(st.el); };
  const tick=()=>{ if(!st)return; const vr=view.getBoundingClientRect(), edge=70; let dy=0;
    if(st.y<vr.top+edge)dy=-Math.ceil((vr.top+edge-st.y)/6); else if(st.y>vr.bottom-edge)dy=Math.ceil((st.y-(vr.bottom-edge))/6);
    if(dy){ view.scrollTop+=dy; place(st.x,st.y); } raf=requestAnimationFrame(tick); };
  root.addEventListener('pointerdown',e=>{ const h=e.target.closest('[data-drag],[data-bdrag]'); if(!h)return;
    e.preventDefault(); e.stopPropagation();
    const block=!!h.dataset.bdrag, el=block?h.closest('.hblk'):h.closest('[data-box]'); if(!el)return;
    const r=el.getBoundingClientRect(), gh=el.cloneNode(true);
    gh.classList.add('he-ghost'); gh.style.cssText='left:'+r.left+'px;top:'+r.top+'px;width:'+r.width+'px;height:'+r.height+'px';
    document.body.appendChild(gh); el.classList.add('he-ph');
    st={el,gh,block,dx:e.clientX-r.left,dy:e.clientY-r.top,x:e.clientX,y:e.clientY};
    try{ root.setPointerCapture(e.pointerId); }catch(_){}   // on the list itself: the dragged box moves in the page, the list never does
    if(navigator.vibrate)try{navigator.vibrate(15);}catch(_){}
    raf=requestAnimationFrame(tick); });
  root.addEventListener('pointermove',e=>{ if(!st)return; e.preventDefault(); st.x=e.clientX; st.y=e.clientY;
    st.gh.style.left=(e.clientX-st.dx)+'px'; st.gh.style.top=(e.clientY-st.dy)+'px'; place(e.clientX,e.clientY); });
  const end=()=>{ if(!st)return; cancelAnimationFrame(raf); st.gh.remove(); st.el.classList.remove('he-ph'); st=null;
    const y=view.scrollTop; homeSave(fromDom()); homeQuick(box); view.scrollTop=y; };
  root.addEventListener('pointerup',end); root.addEventListener('pointercancel',end);
}
function netPaint(){ const on=navigator.onLine; document.querySelectorAll('.hs-net').forEach(el=>{ el.classList.toggle('off',!on); const sp=el.querySelector('span'); if(sp)sp.textContent=on?'ONLINE':'OFFLINE'; }); }
addEventListener('online',netPaint); addEventListener('offline',netPaint);
function pushRecent(item){
  try{
    let r=JSON.parse(localStorage.getItem('gr_recent')||'[]');
    r=r.filter(x=>!(x.k===item.k&&String(x.id)===String(item.id)));
    item.ts=Date.now(); r.unshift(item); r=r.slice(0,8);
    localStorage.setItem('gr_recent',JSON.stringify(r));
  }catch(e){}
}
function relTime(ts){
  const m=Math.round((Date.now()-ts)/60000);
  if(m<1)return 'now'; if(m<60)return m+'m'; const h=Math.round(m/60);
  if(h<24)return h+'h'; return Math.round(h/24)+'d';
}
function openGuide3(id){
  const g=G3.find(x=>x.id===id); if(!g)return;
  pushRecent({k:'guide',id:id,t:g.t,s:'Investigation guide'});
  reader.classList.remove('hidden');reader.setAttribute('aria-hidden','false');
  $('#rdTitle').textContent=g.t; $('#rdPage').textContent='Guide';
  $('#rdFlag').classList.add('hidden');$('#rdStar').textContent='☆';
  $('#rdPrev').style.visibility='hidden';$('#rdNext').style.visibility='hidden';$('#rdJump').style.visibility='hidden';
  curDoc={title:g.t,text:g.b}; rdBody.innerHTML=formatPage(g.b); applyRdScale(); rdBody.scrollTop=0; updateDlBtn();
}
/* synonym groups for full-text search — a word that isn't on the page is tried as its synonyms */
const SYN=[
 ['garda','gardai','gardaí','member','police'],
 ['arrest','arrested','arresting','apprehend'],
 ['detention','detained','custody','cell','prisoner'],
 ['assault','assaulted','attack','attacked','harm'],
 ['theft','steal','stole','stolen','shoplifting','shoplifter','larceny'],
 ['burglary','burglar','break-in','housebreaking'],
 ['robbery','robbed','mugging','mugged'],
 ['drug','drugs','controlled drug','cannabis','cocaine','heroin','misuse of drugs'],
 ['knife','blade','bladed','weapon','point'],
 ['firearm','firearms','gun','shotgun','pistol','ammunition'],
 ['car','vehicle','mechanically propelled','motor'],
 ['drink','drunk','intoxicated','intoxicant','alcohol','breath','evidenzer'],
 ['statement','memo','memorandum','deposition'],
 ['interview','questioning','interrogation'],
 ['search','searched','searching','warrant'],
 ['bail','remand','recognisance','surety'],
 ['court','district court','circuit court','judge'],
 ['child','children','juvenile','minor','young person'],
 ['domestic','domestic violence','domestic abuse','barring','safety order','protection order'],
 ['cctv','footage','camera','video'],
 ['exhibit','exhibits','evidence','continuity'],
 ['disclosure','unused material'],
 ['harassment','stalking','coercive control'],
 ['rape','sexual assault','sexual','defilement'],
 ['fraud','deception','counterfeit','forgery','forged'],
 ['criminal damage','damage','vandalism','graffiti'],
 ['immigration','visa','passport','deportation'],
 ['mental health','mental illness','s.12'],
 ['missing','missing person'],
 ['collision','crash','accident','rtc','road traffic'],
 ['scooter','e-scooter','powered personal transporter'],
 ['identification','identify','advokate','id parade'],
 ['inference','inferences','silence'],
 ['overdose','od','opioid'],
 ['caution','cautioned','cautioning']
];
function doSearch(q,filter,keep){
  lastQuery=q;
  const box=$('#results'); if(!box)return;
  q=q.trim();
  if(q.length<2){homeQuick();return;}
  const terms=q.toLowerCase().split(/\s+/).filter(w=>w.length>1);
  if(!terms.length){box.innerHTML='';return;}
  let html='';
  // 1) A–Z index matches (instant)
  const ixhits=AZ.filter(e=>terms.every(t=>e.t.toLowerCase().includes(t))).slice(0,8);
  if(ixhits.length){
    html+='<h2 class="sec">Index matches</h2>';
    for(const e of ixhits){
      html+=`<button class="hit ixhit" data-go="${e.r[0].a}"><div class="h-title ${e.k==='case'?'':''}">${e.k==='case'?'<i>':''}${esc(e.t)}${e.k==='case'?'</i>':''}</div>
      <div class="h-loc">${e.r.map(r=>`<span class="goref" data-a="${r.a}">${esc(r.l)}</span>`).join(' · ')}</div></button>`;
    }
  }
  // 2) full-text
  const range=FRANGE[filter]||[1,META.pages];
  const hits=[];
  for(const c of META.chunks){
    if(c.e<range[0]||c.s>range[1])continue;
    const ch=CHUNKS[c.f]; if(!ch)continue;
    for(let i=0;i<ch.pages.length;i++){
      const abs=c.s+i; if(abs<range[0]||abs>range[1])continue;
      const low=ch.pages[i].toLowerCase();
      let score=0, first=-1, ok=true;
      for(const t of terms){
        let idx=low.indexOf(t), syn=false;
        if(idx<0){ // synonyms then stem fallback
          for(const g of SYN)if(g.includes(t)){for(const x of g){idx=low.indexOf(x);if(idx>=0){syn=true;break;}}break;}
          if(idx<0&&t.length>4)idx=low.indexOf(t.slice(0,t.length-2));
        }
        if(idx<0){ok=false;break;}
        if(first<0||idx<first)first=idx;
        let n=0,p=idx; while(p>=0&&n<20){n++;p=low.indexOf(t,p+1);} score+=(syn?n*0.5:n);
      }
      if(ok){ // boost exact phrase and title matches so the chapter itself beats tables that mention it
        const tl=(titleFor(abs)||'').toLowerCase(), ph=terms.join(' ');
        if(terms.length>1&&low.includes(ph))score+=8;
        for(const t of terms)if(tl.includes(t))score+=4;
        hits.push({abs,score,first,txt:ch.pages[i]}); }
    }
  }
  hits.sort((a,b)=>b.score-a.score);
  const loaded=Object.keys(CHUNKS).length, total=META.chunks.length;
  html+=`<h2 class="sec">In the text ${loaded<total?`(searching ${loaded}/${total} loaded…)`:`(${hits.length} pages)`}</h2>`;
  if(!hits.length&&loaded>=total&&!ixhits.length)html+='<div class="empty">No match. Try fewer or different words.</div>';
  for(const h of hits.slice(0,40)){
    const s=Math.max(0,h.first-60), snip=stripMd(h.txt.slice(s,h.first+140)).replace(/\s+/g,' ');
    let marked=esc(snip);
    for(const t of terms)marked=marked.replace(new RegExp('('+t.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+')','ig'),'<mark>$1</mark>');
    html+=`<button class="hit" data-go="${h.abs}"><div class="h-title">${topicEmoji(titleFor(h.abs))}${esc(titleFor(h.abs))}</div>
    <div class="h-loc">${esc(pageLabel(h.abs))}${isDated(h.abs)?' · <span style="color:var(--flag)">2007 — verify</span>':''}</div>
    <div class="h-snip">…${marked}…</div></button>`;
  }
  box.innerHTML=html;
  box.querySelectorAll('.hit').forEach(b=>b.addEventListener('click',e=>{
    const g=e.target.closest('.goref'); openPage(g?+g.dataset.a:+b.dataset.go);
  }));
}

/* ---------- POINTS TO PROVE ---------- */
function renderPTP(){
  subView();
  let html='<h2 class="sec">Points to prove — tap offence · always verify current wording</h2>';
  OPS.ptp.forEach((p,pi)=>{
    html+=`<div class="cslot"><button class="ixrow cshead"><span class="term" style="font-style:normal;font-weight:700">${esc(p.o)}</span><div class="refs">▾</div></button>
    <div class="csbody hidden"><ul class="rlist" style="color:var(--ink)">${p.e.map(x=>'<li>'+esc(x)+'</li>').join('')}</ul>
    <div class="ddefk"><b>Arrest/notes:</b> ${esc(p.a)}</div>
    <button class="csall gbtn" data-g="${p.g}">📝 Statement guide for this offence</button>
    <button class="csall" data-q="${esc(p.o.split('—')[0].trim())}">⌕ Open in manual</button></div></div>`;
  });
  $('#results').innerHTML=html;
  $$('.cshead').forEach(h=>h.addEventListener('click',()=>h.nextElementSibling.classList.toggle('hidden')));
  $$('#results .csall').forEach(b=>b.addEventListener('click',()=>{
    if(b.dataset.g){renderGuides(b.dataset.g);return;}
    searchFor(b.dataset.q);}));
  view.scrollTop=0;
}
function renderGuides(openG){
  view.innerHTML='<h2 class="sec">📝 Statement guides — what each statement MUST capture</h2><div id="results"></div>';
  let html='';
  for(const g of OPS.sguides){
    const open=g.g===openG;
    html+=`<div class="cslot"><button class="ixrow cshead"><span class="term" style="font-style:normal;font-weight:700">${esc(g.t)}</span><div class="refs">${g.must.length} points ▾</div></button>
    <div class="csbody ${open?'':'hidden'}"><ul class="rlist" style="color:var(--ink)">${g.must.map(x=>'<li>'+esc(x)+'</li>').join('')}</ul>
    <button class="csall" data-a="969">Open statement-taking chapter</button>
    <button class="csall" data-a="144">Open worked example (assault SG)</button></div></div>`;
  }
  html+='<div class="toolnote">Structure every statement on the 5-part model (ST:6). These lists are the offence-specific layer on top.</div>';
  $('#results').innerHTML=html;
  $$('.cshead').forEach(h=>h.addEventListener('click',()=>h.nextElementSibling.classList.toggle('hidden')));
  $$('#results .csall').forEach(b=>b.addEventListener('click',()=>openPage(+b.dataset.a)));
  view.scrollTop=0;
}
function renderMajor(){
  const M=OPS.major;
  let html='<h2 class="sec">🚨 '+esc(M.t)+'</h2>';
  M.sections.forEach((sec,si)=>{
    html+=`<div class="tool"><h3>${esc(sec.h)}</h3>`;
    sec.items.forEach((it,i)=>{
      const k='mj'+si+'_'+i, on=toolState[k];
      html+=`<div class="ck ${on?'done':''}" data-k="${k}"><div class="box">${on?'✓':''}</div><div class="lb">${esc(it)}</div></div>`;
    });
    html+='</div>';
  });
  html+=`<button class="csall" data-a="${M.src}">Open homicide chapter (2007 manual)</button><button class="csall" data-a="1168">Open general investigation chapter</button>
  <div class="toolnote">Ticks are session-only — nothing stored. This guide supplements, never replaces, direction from your member i/c and SIO.</div>`;
  view.innerHTML=html;
  $$('.ck').forEach(c=>c.addEventListener('click',()=>{const k=c.dataset.k;toolState[k]=!toolState[k];c.classList.toggle('done',toolState[k]);c.querySelector('.box').textContent=toolState[k]?'✓':'';}));
  $$('#view .csall').forEach(b=>b.addEventListener('click',()=>openPage(+b.dataset.a)));
  view.scrollTop=0;
}
function renderEssentials(){
  const ess=CASES.filter(c=>c.star);
  view.innerHTML=`<h2 class="sec">★ Essential case law — know these cold</h2><div id="esslist"></div>`;
  $('#esslist').innerHTML=ess.map(c=>`<button class="hit ixhit" data-n="${esc(c.n)}">
    <div class="h-title"><i>${esc(c.n)}</i>${c.c[0]?' · '+esc(c.c[0]):''}</div>
    <div class="h-snip" style="color:var(--ink)">${esc(c.why||c.d)}</div></button>`).join('');
  $$('#esslist .hit').forEach(b=>b.addEventListener('click',()=>openCase(b.dataset.n)));
  view.scrollTop=0;
}
function openCase(name){
  const c=CASES.find(x=>x.n===name); if(!c)return;
  reader.classList.remove('hidden');reader.setAttribute('aria-hidden','false');
  $('#rdTitle').textContent=c.n; $('#rdPage').textContent=(c.cat||'General')+(c.c[0]?' · '+c.c.join(' · '):'');
  $('#rdFlag').classList.add('hidden');$('#rdStar').textContent='☆';
  $('#rdPrev').style.visibility='hidden';$('#rdNext').style.visibility='hidden';$('#rdJump').style.visibility='hidden';
  let h='';
  if(c.why)h+='<div class="rbox note"><b>Why it matters:</b> '+esc(c.why)+'</div>';
  else if(c.d)h+='<div class="rbox note">'+esc(c.d)+'</div>';
  if(c.f){if(c.f.facts)h+='<div class="rsub">Facts</div><p>'+esc(c.f.facts)+'</p>';
    if(c.f.held)h+='<div class="rbox warn" style="background:color-mix(in srgb,var(--amber) 12%,transparent);border-left-color:var(--amber);color:var(--tx)"><b>Held:</b> '+esc(c.f.held)+'</div>';}
  h+='<div class="rsub">In your manual</div>';
  h+=(c.s||[]).map(sn=>'<p><span class="xref" data-a="'+sn.a+'">'+esc(pageLabel(sn.a))+'</span> — '+esc(sn.t)+'</p>').join('')||'<p>Open the pages below for full context.</p>';
  h+='<div class="rsub">Every page it appears on</div><p>'+c.p.map(p=>'<span class="xref" data-a="'+p+'">'+esc(pageLabel(p))+'</span>').join(' · ')+'</p>';
  h+='<div class="rsub">Full judgment (needs signal)</div><p><span class="extj" data-u="bailii">BAILII</span> · <span class="extj" data-u="courts">Courts.ie</span> · <span class="extj" data-u="westlaw">Westlaw (your login)</span></p>';
  rdBody.innerHTML=h; curDoc={title:c.n,text:(c.why||c.d||"")+"\n\n"+((c.f&&(("Facts: "+(c.f.facts||""))+"\nHeld: "+(c.f.held||"")))||"")+"\n\n"+(c.s||[]).map(x=>pageLabel(x.a)+" — "+x.t).join("\n\n")}; updateDlBtn();
  rdBody.querySelectorAll('.xref').forEach(x=>x.addEventListener('click',()=>openPage(+x.dataset.a)));
  rdBody.querySelectorAll('.extj').forEach(x=>x.addEventListener('click',()=>{
    const q=encodeURIComponent(c.n);
    window.open({bailii:'https://www.bailii.org/cgi-bin/lucy_search_1.cgi?sort=rank&highlight=1&mask_path=ie&query='+q,
      courts:'https://www.courts.ie/judgments?search_api_fulltext='+q,westlaw:'https://www.westlaw.ie'}[x.dataset.u],'_blank');}));
  rdBody.scrollTop=0;
}
function renderOffences(){
  view.innerHTML='<h2 class="sec">⚖ Offences — tap one for everything on it</h2><div class="toolmenu" id="offlist"></div>';
  $('#offlist').innerHTML=OPS.ptp.map((p,i)=>`<button class="tmenu" data-i="${i}"><b>${esc(p.o.split('—')[0].trim())}</b><small>${esc(p.o.split('—')[1]||'')}</small></button>`).join('');
  $$('#offlist .tmenu').forEach(b=>b.addEventListener('click',()=>renderOffence(+b.dataset.i)));
  view.scrollTop=0;
}
function renderOffence(i){
  const p=OPS.ptp[i], short=p.o.split('—')[0].trim();
  view.innerHTML=`<button class="chip" id="backO">‹ Offences</button>
  <h2 class="sec">${esc(p.o)}</h2>
  <div class="tool"><h3>Points to prove</h3><ul class="rlist">${p.e.map(x=>'<li>'+esc(x)+'</li>').join('')}</ul>
  <div class="ddefk"><b>Arrest/notes:</b> ${esc(p.a)}</div></div>
  <div class="quick">
    <button class="qbtn" id="oGuide">📝 Statement guide<small>what to capture</small></button>
    <button class="qbtn" id="oPlay">Playbook<small>5-part approach</small></button>
    <button class="qbtn" id="oSearch">⌕ In the manual<small>every mention</small></button>
    <button class="qbtn" id="oCases">⚖ Related case law<small>from the library</small></button>
  </div>`;
  $('#backO').addEventListener('click',renderOffences);
  $('#oGuide').addEventListener('click',()=>renderGuides(p.g));
  $('#oPlay').addEventListener('click',()=>openPage(986));
  $('#oSearch').addEventListener('click',()=>searchFor(short));
  $('#oCases').addEventListener('click',()=>{window.caseCat='All';ixKind='case';caseQ=short.split(' ')[0];setTab('index');render();});
  view.scrollTop=0;
}
function renderStencils(){
  const cats=[...new Set(STEN.map(x=>x.cat))];
  let html='<button class="chip" id="backT" style="margin-bottom:8px">‹ Tools</button><h2 class="sec">📄 My stencils — tap to open · ⧉ copies the whole template</h2>';
  for(const cat of cats){
    html+=`<h2 class="sec">${esc(cat)}</h2>`;
    STEN.forEach((st,i)=>{ if(st.cat!==cat)return;
      html+=`<button class="hit" data-i="${i}"><div class="h-title">${esc(st.t)}</div><div class="h-loc">≈${Math.round(st.b.split(/\s+/).length)} words</div></button>`;});
  }
  view.innerHTML=html;wireBack();
  $$('#view .hit').forEach(b=>b.addEventListener('click',()=>openStencil(+b.dataset.i)));
  view.scrollTop=0;
}

/* ---------- reflow hard-wrapped text into normal paragraphs (stencils, templates, exports) ---------- */
function reflow(txt){
  return String(txt||'').replace(/\r/g,'').replace(/([.!?])"(?=[A-Z])/g,'$1 "').split(/\n\s*\n/).map(block=>{
    const L=block.split('\n').map(x=>x.trim()).filter(Boolean); if(!L.length)return '';
    const out=[]; let cur=L[0];
    for(let i=1;i<L.length;i++){ const t=L[i];
      const brk=/^([-•▪◦*]|\(?[a-z0-9ivx]{1,3}[.)])\s+/i.test(t) || /^[A-Z][A-Za-z\s\/()'’&-]{1,24}:\s/.test(t) || (cur.length<38 && /[.:!?]$/.test(cur));
      if(brk){ out.push(cur); cur=t; } else cur+=(/-$/.test(cur)&&!/\s-$/.test(cur)?'':' ')+t;
    }
    out.push(cur); return out.join('\n');
  }).filter(Boolean).join('\n\n');
}
function paraHtml(txtEsc){ return txtEsc.split(/\n\n/).map(b=>'<p>'+b.replace(/\n/g,'<br>')+'</p>').join(''); }
function openStencil(i){
  const st=STEN[i];
  reader.classList.remove('hidden');reader.setAttribute('aria-hidden','false');
  $('#rdTitle').textContent=st.t; $('#rdPage').textContent='Stencil · '+st.cat;
  const star=$('#rdStar'); star.textContent='⧉';
  const body=reflow(String(st.b).replace(/^\s*\.\s*\n/,''));
  star.onclick=()=>{navigator.clipboard.writeText(body).then(()=>{$('#rdPage').textContent='Copied ✓';setTimeout(()=>$('#rdPage').textContent='Stencil · '+st.cat,1500);}).catch(()=>{$('#rdPage').textContent='Copy failed';});};
  $('#rdFlag').classList.add('hidden');
  let h=esc(body);
  h=h.replace(/(\[[^\]\n]{1,60}\]|_{3,}|\bXXXX?\b|\bTIME\b|\bDATE\b|\bLOCATION\b|\bNAME\b|\bSTATION\b|\bOFFENCE\b)/g,'<mark class="ph">$1</mark>');
  h=paraHtml(h);
  curDoc={title:st.t,text:body}; rdBody.innerHTML=h; rdBody.scrollTop=0; updateDlBtn();
  $('#rdPrev').style.visibility='hidden';$('#rdNext').style.visibility='hidden';$('#rdJump').style.visibility='hidden';
}
function renderLive(){
  view.innerHTML=`<h2 class="sec">◉ Live judgments — needs signal</h2>
  <div class="searchbox" style="position:static"><input id="lq" type="search" placeholder="Topic, case, statute… e.g. inference s.19A"></div>
  <div class="quick">
    <button class="qbtn" data-src="courts">Courts.ie<small>official, most recent first</small></button>
    <button class="qbtn" data-src="bailii">BAILII Ireland<small>free full text</small></button>
    <button class="qbtn" data-src="westlaw">Westlaw IE<small>opens your subscription</small></button>
    <button class="qbtn" data-src="supreme">Supreme Court<small>latest judgments</small></button>
  </div>
  <div class="toolnote">Each opens in your browser with your search. Westlaw can't take the query in the link — it opens your signed-in Westlaw and you paste there. A true in-app Westlaw feed isn't possible without a Thomson Reuters API licence.</div>`;
  $$('#view .qbtn').forEach(b=>b.addEventListener('click',()=>{
    const q=encodeURIComponent(($('#lq').value||'').trim());
    const u={courts:'https://www.courts.ie/judgments?search_api_fulltext='+q,
      bailii:'https://www.bailii.org/cgi-bin/lucy_search_1.cgi?sort=date&highlight=1&mask_path=ie&query='+q,
      westlaw:'https://www.westlaw.ie',
      supreme:'https://www.courts.ie/judgments?f%5B0%5D=judgment_court%3A251286'+(q?'&search_api_fulltext='+q:'')}[b.dataset.src];
    window.open(u,'_blank');
  }));
  view.scrollTop=0;
}

/* ---------- DETENTION CLOCK (session only — nothing saved) ---------- */
function renderClock(){
  subView();
  $('#results').innerHTML=`<h2 class="sec">⏱ Detention clock</h2>
  <div class="tool">
    <label class="flab">Time detention commenced (member i/c)</label>
    <input type="datetime-local" id="dtStart" class="fin">
    <label class="flab">Regime</label>
    <div class="chips"><button class="chip on" data-r="s4">s.4 CJA 1984</button><button class="chip" data-r="s30">s.30 OASA 1939</button><button class="chip" data-r="dta">s.2 DTA 1996</button><button class="chip" data-r="s50">s.50 CJA 2007</button></div>
    <label class="flab"><input type="checkbox" id="restCut" checked> Apply rest-period suspension (midnight–08:00, s.4 only)</label>
    <label class="flab">Manual suspension already used (mins) — medical, solicitor consult, rest not auto-counted</label>
    <input type="number" id="susMin" class="fin" value="0" min="0" step="15">
    <div id="clockOut"></div>
  </div>
  <div class="toolnote">Aid only — the member in charge governs the clock. Suspensions and their reasons must be recorded in the custody record. Verify every authorisation against the Act.</div>`;
  let regime='s4';
  const REG={
   s4:{rest:true,steps:[['Initial detention','6','Member i/c'],['1st extension','6','Superintendent (→12h)'],['2nd extension','12','Chief Superintendent (→24h)']]},
   s30:{rest:false,steps:[['Initial','24','On arrest'],['Extension','24','Chief Superintendent (→48h)'],['Further','24','District Court judge (→72h)']]},
   dta:{rest:false,steps:[['Initial','6','Member i/c'],['Extension','18','Superintendent (→24h)'],['Extension','24','Chief Supt (→48h)'],['Court','72','Judge (→120h)'],['Court','48','Judge (→168h / 7 days)']]},
   s50:{rest:false,steps:[['Initial','6','Member i/c'],['Extension','18','Superintendent (→24h)'],['Extension','24','Chief Supt (→48h)'],['Court','72','Judge (→120h)'],['Court','48','Judge (→168h)']]}
  };
  const fmt=ms=>new Date(ms).toLocaleString('en-IE',{weekday:'short',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});
  const draw=()=>{
    const v=$('#dtStart').value,out=$('#clockOut');
    if(!v){out.innerHTML='';return;}
    const R=REG[regime];
    let t=new Date(v).getTime();
    const sus=(+$('#susMin').value||0)*60e3; if(sus)t+=sus;
    const useRest=R.rest&&$('#restCut').checked;
    let cum=0, html='<table class="clocktab"><tr><th>Stage</th><th>Clock expires</th><th>Authority</th></tr>';
    for(const[st,hrs,auth]of R.steps){
      let add=(+hrs)*3600e3;
      // rest suspension: any part of window between 00:00-08:00 doesn't count (approximate — adds that overlap back)
      if(useRest){
        let probe=t, end=t+add, extra=0, guard=0;
        while(probe<end+extra&&guard++<50){
          const d=new Date(probe),hr=d.getHours();
          if(hr>=0&&hr<8){extra+=3600e3;}
          probe+=3600e3;
        }
        add+=extra;
      }
      t+=add;
      html+=`<tr><td>${st}<br><small>+${hrs}h${useRest?' +rest':''}</small></td><td><b>${fmt(t)}</b></td><td>${auth}</td></tr>`;
    }
    out.innerHTML=html+'</table>';
  };
  ['dtStart','susMin','restCut'].forEach(id=>$('#'+id).addEventListener('input',draw));
  $$('#results .chip').forEach(c=>c.addEventListener('click',()=>{regime=c.dataset.r;$$('#results .chip').forEach(x=>x.classList.toggle('on',x===c));draw();}));
  view.scrollTop=0;
}

/* ---------- COURT-DAY MODE ---------- */
function renderCourtDay(){
  subView();
  let html=`<h2 class="sec">⚖ Court day — all offline</h2><div class="quick">
    <button class="qbtn" data-go="941">Cross-exam survival<small>V12 Part A</small></button>
    <button class="qbtn" data-go="945">Law of evidence<small>objections & rules</small></button>
    <button class="qbtn" data-go="975">ADVOKATE<small>your ID evidence</small></button>
    <button class="qbtn" data-go="955">Inferences<small>proofs & preconditions</small></button>
    <button class="qbtn" data-go="969">Your statement<small>refresh the structure</small></button>
    <button class="qbtn" data-go="322">Disclosure<small>duty & pitfalls</small></button></div>`;
  if(favs.length){html+='<h2 class="sec">Your saved pages</h2>';
    favs.forEach(f=>{html+=`<button class="hit" data-go="${f.a}"><div class="h-title">${esc(f.title)}</div><div class="h-loc">${esc(f.label)}</div></button>`;});}
  html+=`<h2 class="sec">Fresh law (needs signal)</h2>
  <button class="hit" id="jfeed1"><div class="h-title">Latest Supreme & Appeal Court judgments</div><div class="h-loc">courts.ie — opens in browser</div></button>
  <button class="hit" id="jfeed2"><div class="h-title">Search BAILII Irish cases on a topic</div><div class="h-loc">bailii.org — opens in browser</div></button>`;
  $('#results').innerHTML=html;
  $$('#results .qbtn,#results .hit[data-go]').forEach(b=>b.addEventListener('click',()=>openPage(+b.dataset.go)));
  $('#jfeed1').addEventListener('click',()=>window.open('https://www.courts.ie/judgments','_blank'));
  $('#jfeed2').addEventListener('click',()=>{const t=prompt('Topic or case name:');if(t)window.open('https://www.bailii.org/cgi-bin/lucy_search_1.cgi?method=boolean&datehigh=&query='+encodeURIComponent(t)+'&mask_path=ie&datelow=&sort=rank&highlight=1','_blank');});
  view.scrollTop=0;
}

/* ---------- BROWSE ---------- */
function renderBrowse(){
  view.innerHTML='<div class="tabroot" data-tab="browse" hidden></div><h2 class="sec">Browse the full reference<span class="sec-r">'+META.pages+' pages</span></h2><div id="tree"></div>';
  const root=$('#tree'); META.tree.forEach(n=>root.appendChild(treeNode(n,0)));
}
function treeNode(n,depth){
  const d=document.createElement('div'); d.className='tnode';
  const row=document.createElement('button'); row.className='trow';
  const kids=(n.children||[]);
  row.innerHTML=`${kids.length?'<span class="caret">›</span>':'<span style="width:10px"></span>'}
    <span class="tw">${esc(n.title)}${n.dated?' <span class="dated-dot">●</span>':''}</span><span class="tpg">${esc(n.label||'')}</span>`;
  d.appendChild(row);
  if(kids.length){
    const kwrap=document.createElement('div'); kwrap.className='tkids';
    kids.forEach(k=>kwrap.appendChild(treeNode(k,depth+1)));
    d.appendChild(kwrap);
    row.addEventListener('click',()=>{ if(d.classList.contains('open')){openPage(n.abs);} else d.classList.add('open'); });
    // long-press alternative: second tap opens; add explicit open handled above. Also caret toggles:
    row.querySelector('.caret').addEventListener('click',e=>{e.stopPropagation();d.classList.toggle('open');});
  } else row.addEventListener('click',()=>openPage(n.abs));
  return d;
}

/* ---------- INDEX (contents · topics · case law · statutes · A–Z) ---------- */
let ixKind='topic';
function renderIndex(){
  if(ixKind==='contents')ixKind='topic';
  const K=[['topic','Topics'],['case','Case law'],['statute','Statutes'],['all','All A–Z']];
  view.innerHTML=`<div class="tabroot" data-tab="index" hidden></div>
  <div class="ixtop"><div class="chips">${K.map(([k,l])=>`<button class="chip ${ixKind===k?'on':''}" data-k="${k}">${l}</button>`).join('')}</div></div>
  <div class="alpharail" id="rail"></div><div id="ixlist"></div>`;
  $$('.ixtop .chip').forEach(c=>c.addEventListener('click',()=>{ixKind=c.dataset.k;renderIndex();view.scrollTop=0;}));
  if(ixKind==='case'){renderCases();return;}
  const items=AZ.filter(e=>ixKind==='all'||e.k===ixKind);
  const list=$('#ixlist'); let html='', letters=new Set(), cur='';
  for(const e of items){
    const L=(e.t[0]||'#').toUpperCase().replace(/[^A-Z]/,'#');
    if(L!==cur){cur=L;letters.add(L);html+=`<div class="letterhead" id="L${L}">${L}</div>`;}
    html+=`<button class="ixrow ${e.k}" data-a="${e.r[0].a}"><span class="term">${esc(e.t)}</span>
      <div class="refs">${e.r.map(r=>`<span class="goref" data-a="${r.a}">${esc(r.l)}</span>`).join(' · ')}</div></button>`;
  }
  list.innerHTML=html||'<div class="empty">Nothing here.</div>';
  $('#rail').innerHTML=[...letters].map(L=>`<button class="al" data-l="${L}">${L}</button>`).join('');
  $$('.al').forEach(a=>a.addEventListener('click',()=>{const el=$('#L'+a.dataset.l);if(el)el.scrollIntoView();}));
  list.querySelectorAll('.ixrow').forEach(b=>b.addEventListener('click',e=>{
    const g=e.target.closest('.goref'); openPage(g?+g.dataset.a:+b.dataset.a);
  }));
}

const ESSENTIALS={'dpp v jc':'Rewrote the exclusionary rule — inadvertent breach of rights no longer means automatic exclusion.','dpp v kenny':'The old strict exclusion rule — the world before JC; still cited constantly.','damache v dpp':'Search warrant issued by a Supt tied to the investigation = unconstitutional. Independence required.','dpp v gormley':'No interviewing after solicitor requested until access given — constitutional right.','dpp v doyle':'No constitutional right to have the solicitor IN the interview room — the counterpoint to Gormley.','christie v leachinsky':'You must tell a person WHY they are arrested, in ordinary language. Foundation of arrest law.','o\'callaghan':'Bail exists only to secure trial attendance — the foundation of all bail objections.','braddish v dpp':'Duty to seek out and PRESERVE evidence — lose the CCTV, lose the case.','dunne v dpp':'Extends Braddish — the preservation duty in action.','allan v uk':'Covert questioning of a detainee via informant breaches the right to silence.','people (dpp) v shaw':'Voluntariness and fundamental fairness — the confession admissibility test.','dpp v avadenei':'Technical defects don\'t automatically kill the prosecution — substance over form.','v casey':'The identification warning — every ID case runs through Casey.','r v turnbull':'The UK ID guidelines that shaped ADVOKATE.','dpp v cash':'Reasonable suspicion may rest on material that is itself inadmissible.','v quirke':'Computer/phone searches need specific authorisation in the warrant — get the wording right.'};
let caseQ='';
function caseSurname(n){
  return n.toLowerCase().replace(/^(the\s)?(people\s\((dpp|ag)\)|dpp|the\sstate\s\([^)]+\)|attorney\sgeneral|ag|re|r|minister[a-z\s]*)\sv\s/,'');
}
function renderCases(){
  const rail=$('#rail'), list=$('#ixlist');
  list.insertAdjacentHTML('beforebegin',`<div class="searchbox" style="top:auto"><input id="cq" type="search" placeholder="Filter ${CASES.length} cases — name, citation, topic…" value="${esc(caseQ)}"></div>
  <div class="chips catchips">${['All',...new Set(CASES.map(c=>c.cat))].map(c=>`<button class="chip ${c===(window.caseCat||'All')?'on':''}" data-cc="${c}">${c}</button>`).join('')}</div>`);
  $$('.catchips .chip').forEach(ch=>ch.addEventListener('click',()=>{window.caseCat=ch.dataset.cc;renderIndex();}));
  const draw=()=>{
    const q=caseQ.trim().toLowerCase();
    let essHtml='';
    if(!q&&(!window.caseCat||window.caseCat==='All')){
      const ess=CASES.map(c=>{const k=Object.keys(ESSENTIALS).find(k=>c.n.toLowerCase().includes(k));return k?{c,why:ESSENTIALS[k]}:null;}).filter(Boolean);
      if(ess.length)essHtml='<h2 class="sec">★ The essentials — know these cold</h2>'+ess.map(e=>`<button class="hit ixhit esshit" data-n="${esc(e.c.n)}"><div class="h-title"><i>${esc(e.c.n)}</i> ${e.c.c[0]?'· '+esc(e.c.c[0]):''}</div><div class="h-snip">${esc(e.why)}</div></button>`).join('')+'<h2 class="sec">Full library</h2>';
    }
    let items=CASES.filter(c=>!q||c.n.toLowerCase().includes(q)||c.c.join(' ').toLowerCase().includes(q)||(c.d||'').toLowerCase().includes(q))
      .slice().sort((a,b)=>caseSurname(a.n).localeCompare(caseSurname(b.n),'en',{sensitivity:'base'}));
    if(window.caseCat&&window.caseCat!=='All')items=items.filter(c=>c.cat===window.caseCat);
    let html='', cur='', letters=new Set();
    for(const c of items){
      const L=(caseSurname(c.n)[0]||'#').toUpperCase().replace(/[^A-Z]/,'#');
      if(L!==cur&&!q){cur=L;letters.add(L);html+=`<div class="letterhead" id="L${L}">${L}</div>`;}
      html+=`<div class="cslot"><button class="ixrow case cshead"><span class="term">${esc(c.n)}</span>
        <div class="refs"><span class="catpill">${esc(c.cat||'General')}</span> ${c.c.length?esc(c.c.join(' · ')):'cited in text'} · ${c.p.length}pp ▾</div>
        <div class="csdesc">${esc((c.d||'').slice(0,150))}</div></button>
        <div class="csbody hidden">
          ${c.s.map(sn=>`<button class="cssnip" data-a="${sn.a}"><b>${esc(pageLabel(sn.a))}${sn.a>=993?' · 2007':''}</b> — ${esc(sn.t)}</button>`).join('')}
          <div class="cspages">${c.p.map(p=>`<button class="cspg" data-a="${p}">${esc(pageLabel(p))}</button>`).join('')}</div>
          <button class="csall" data-n="${esc(c.n)}">⌕ Every mention in full text</button>
        </div></div>`;
    }
    list.innerHTML=essHtml+(html||'<div class="empty">No case matches.</div>');
    list.querySelectorAll('.esshit').forEach(b=>b.addEventListener('click',()=>{caseQ=b.dataset.n;renderIndex();}));
    rail.innerHTML=q?'':[...letters].map(L=>`<button class="al" data-l="${L}">${L}</button>`).join('');
    rail.querySelectorAll('.al').forEach(a=>a.addEventListener('click',()=>{const el=$('#L'+a.dataset.l);if(el)el.scrollIntoView();}));
    list.querySelectorAll('.cshead').forEach(h=>{
      h.addEventListener('click',()=>h.nextElementSibling.classList.toggle('hidden'));
      const nm=h.querySelector('.term');if(nm)nm.addEventListener('click',e=>{e.stopPropagation();openCase(nm.textContent);});
    });
    list.querySelectorAll('.cssnip,.cspg').forEach(b=>b.addEventListener('click',()=>openPage(+b.dataset.a)));
    list.querySelectorAll('.csall').forEach(b=>b.addEventListener('click',()=>{
      searchFor(b.dataset.n.replace(/^(The\s)?(People\s\((DPP|AG)\)|DPP)\sv\s/i,'').trim());
    }));
  };
  draw();
  const cq=$('#cq'); let t;
  cq.addEventListener('input',()=>{clearTimeout(t);t=setTimeout(()=>{caseQ=cq.value;draw();},150);});
}

/* ---------- TOOLS (session-only state, no case data) ---------- */
const TOOLS=[
 {id:'advokate',title:'ADVOKATE — identification',src:975,items:[
  'A — Amount of time the witness had the suspect in view',
  'D — Distance between witness and suspect',
  'V — Visibility: light, weather, obstructions to sight',
  'O — Obstruction: anything blocking the view, and for how long',
  'K — Known or seen before? How, when, where',
  'A — Any reason to remember this person',
  'T — Time lapse between sighting and description',
  'E — Errors or discrepancies between description and appearance']},
 {id:'fivepart',title:'5-part statement structure',src:974,items:[
  '1 — Introduction: who the witness is, capacity, how they came to be there',
  '2 — Scene-setting: date, time, place, light, sobriety, vantage',
  '3 — The incident: chronological account, points to prove covered',
  '4 — Aftermath & impact: injuries, medical, fear, loss, effect',
  '5 — Evidential anchors: ADVOKATE, exhibits, quotes, continuity']},
 {id:'inference',title:'Inference interview aide — ss.18 / 19 / 19A CJA 1984',src:955,items:[
  'Arrested and detained — offence carries 5+ years',
  'Solicitor: reasonable opportunity to consult given',
  'Ordinary caution administered first',
  'Interview electronically recorded',
  's.18 — object / substance / mark: specify it, state your belief, ask to account',
  's.19 — presence at a place: specify place and time, state belief, ask to account',
  's.19A — fact relied on in defence that was not mentioned when questioned',
  'Special caution in ordinary language: offence, what inference may be drawn, effect of failure',
  'Accused told a record is being made and given opportunity to consult solicitor before failure counts',
  'Remember: inference corroborates only — no conviction on inference alone']}];
TOOLS.push(
 {id:'arrest',title:'Arrest — lawful essentials',src:40,items:[
  'Power identified: statutory or common law — name it',
  'Reasonable suspicion grounds noted (what you saw / heard / knew)',
  'Suspect told they are under arrest',
  'Told the reason in ordinary language (Christie v Leachinsky)',
  'Caution administered and noted verbatim',
  'Replies after caution recorded',
  'Force used: minimum, proportionate, recorded',
  'Custody record commenced on arrival']},
 {id:'scene',title:'First at scene — preserve it',src:1168,items:[
  'Scene safe — casualties first, then preservation',
  'Cordon set wider than you think you need',
  'Single entry/exit route established',
  'Scene log started: everyone in/out, times',
  'Nothing touched, moved, or walked through',
  'CCTV identified — request preservation NOW (it overwrites)',
  'Witnesses identified and separated',
  'Weather / perishable evidence protected',
  'Notify: member i/c, SOCO, D/unit as required']},
 {id:'warrant',title:'Search warrant — execution',src:42,items:[
  'Warrant in date and for THIS premises — read it',
  'Named member present as required',
  'Announce, demand entry, show warrant',
  'Copy given / shown to occupier',
  'Search within scope of the warrant only',
  'Seizures itemised contemporaneously',
  'Exhibits: bagged, sealed, labelled, logged',
  'Premises secured on departure; record condition']},
 {id:'exhibit',title:'Exhibit seizure & continuity',src:945,items:[
  'Photographed in situ before touching',
  'Gloves / appropriate handling',
  'Unique exhibit ref (initials + number)',
  'Bagged and sealed at the scene',
  'Label: what, where, when, who found',
  'Every handover recorded — person, date, purpose',
  'PEMS entry completed',
  'Memo of finding in your statement']},
 {id:'victim',title:'Victim first contact — 2017 Act',src:179,items:[
  'Information on rights given at first contact',
  'Needs / vulnerability assessment done',
  'Special measures considered (screens, video-link, intermediary)',
  'Letter of Rights / contact details provided',
  'Updates: arrest, charge, bail — victim informed',
  'VIS explained for sentence stage',
  'Referral: support services offered']});
const TOOLS_MENU=[
 ['On the job',[
  ['clock','timer','Detention clock','s.4 · s.30 · DTA 1996 · s.50 — extensions, excluded periods, alerts'],
  ['gaol','users','Gaoler · cell checks','Cell board · buzz 2 min before each check · check log'],
  ['patrol','walk','Proactive patrol','Where you walked and when — stops, street names, patrol log'],
  ['firstaid','heart-pulse','Medical emergency','112/999 · CPR metronome · 22 conditions · incident log','red'],
  ['ptp','shield','Points to prove','20 offence cards — elements & arrest power'],
  ['major','siren','Major incident','First response · golden hour'],
  ['cautions','triangle-alert','Cautions & declarations','Caution wording · pre-caution questioning · declarations'],
  ['caution','message-square-quote','Caution — when & case law','Questioning · statement declarations · key cases']]],
 ['My work',[
  ['tasks','square-check','Tasks','CCTV · arrests · deadlines · follow-ups · photograph a list'],
  ['roster','calendar-days','My roster','Shift pattern · today & next tour · leave, court, swaps'],
  ['notes','notebook-pen','Notes','Sketches · photos · checklists · lock'],
  ['rec','mic','Voice recorder','Record with markers — kept on this phone'],
  ['scan','scan-text','Document scanner','Flatten · clean up · multi-page PDF'],
  ['pres','monitor','Present to TV','Photos & CCTV via Smart View, DeX or cast']]],
 ['Paperwork',[
  ['guides','file-text','Statement guides','What to capture, per offence'],
  ['sten','layout-template','My stencils','Your templates — tap to copy'],
  ['tpl','mail','Templates & forms','CCTV preservation · s.41 DP · passport · welfare'],
  ['exhibits','clipboard-list','Exhibits builder','SMG1–99 · continuity · copy for report'],
  ['cctv','cctv','CCTV preservation','Generate the request text'],
  ['checks','list-checks','Checklists','Scene · arrest · warrant · exhibits · interview · ID']]],
 ['Law & guides',[
  ['guides2','book-open','Deep guides','Searches · weapons · RTC · précis · missing person'],
  ['searches','search','Searches','Powers & what to say'],
  ['weapons','swords','Weapons & knives','Offences · search · seizure'],
  ['rtc','car-front','Traffic collision','Investigation guide'],
  ['escooter','route','E-scooters','Status · charges · collisions'],
  ['seizure','key','Seizure powers','Quick reference'],
  ['lang','languages','Latin & acronyms','Legal terms · ABC · MMO · ADVOKATE · PEACE'],
  ['latin','scroll','Latin & legal terms','Meaning & Garda use'],
  ['acronyms','book-text','Acronyms','ABC · MMO · ADVOKATE …']]],
 ['Live',[
  ['judg','gavel','Judgments search','BAILII Ireland — Supreme · Appeal · High Court'],
  ['courtlists','calendar-clock',"Court lists — who's on",'CCJ & all Dublin courts — official Legal Diary'],
  ['social','message-circle','Social media','Official accounts — read-only, in the app']]],
 ['Utilities',[
  ['toolbox','toolbox','Toolbox','Ruler · measure · evidence camera · level · compass · torch · timers · QR']]],
 ['Settings',[
  ['display','palette','Theme & text size','Nine themes, light and dark · text size'],
  ['homelayout','sliders-horizontal','Home screen','Move, hide or bring back boxes'],
  ['applock','lock','App lock','Username and password to open Assisting'],
  ['aikey','sparkles','AI search','Your Anthropic key · what is sent · cost'],
  ['about','info','About Assisting','Version · disclaimer · what stays on this phone']]]
];
function lrow(v,ic,t,sub,cls,attr){ return `<button class="lrow${cls?' '+cls:''}" ${attr||'data-v'}="${esc(v)}">${GRI(ic)}<span class="lt"><b>${esc(t)}</b>${sub?`<small>${esc(sub)}</small>`:''}</span>${GRI('chevron-right','chev')}</button>`; }
function renderTools(){
  view.innerHTML=`<div class="tabroot" data-tab="tools" hidden></div>`+TOOLS_MENU.map(([g,rows])=>`<h2 class="sec">${esc(g)}${g==='Live'?'<span class="sec-r">Needs signal</span>':''}</h2><div class="lgrp">${rows.map(r=>lrow(r[0],r[1],r[2],r[3],r[4])).join('')}</div>`).join('');
  $$('#view .lrow[data-v]').forEach(b=>b.addEventListener('click',()=>{
    const v=b.dataset.v;
    if(v==='toolbox'){ if(window.openToolbox) openToolbox(); return; }
    if(v==='patrol'){ if(window.openPatrol) openPatrol(); return; }
    if(v==='gaol'){ if(window.openGaol) openGaol(); return; }
    if(v==='social'){ if(window.openSocial) openSocial(); return; }
    if(v==='firstaid'){ if(window.openFirstAid) openFirstAid(); return; }
    if(v==='tasks'){ if(window.openTasks) openTasks(); return; }
    if(v==='roster'){ if(window.openRoster) openRoster(); return; }
    if(v==='notes'){ if(window.openNotes) openNotes(); return; }
    if(v==='rec'){ if(window.openRecorder) openRecorder(); return; }
    if(v==='scan'){ if(window.openScanner) openScanner(); return; }
    if(v==='pres'){ if(window.openPresent) openPresent(); return; }
    if(v==='aikey'){ if(window.GRSearch) GRSearch.settings(); return; }
    if(v==='about'){ renderAbout(); return; }
    if(v==='display'){ displaySheet(); return; }
    if(v==='homelayout'){ homeEditOpen(); return; }
    if(v==='applock'){ if(window.GRLock)GRLock.sheet(); return; }
    if(v==='clock'){ if(window.openDetention){ openDetention(); return; } renderClock();}
    else if(v==='ptp')renderPTP();
    else if(v==='guides')renderGuides();
    else if(v==='sten')renderStencils();
    else if(v==='checks')renderChecklists();
    else if(v==='major')renderMajor();
    else if(v==='caution')renderCaution();
    else if(v==='exhibits')renderExhibits();
    else if(v==='cctv')renderCCTV();
    else if(['weapons','searches','rtc','escooter','seizure'].includes(v))renderKBtopic(v);
    else if(v==='latin')renderLatin();
    else if(v==='acronyms')renderAcronyms();
    else if(v==='cautions')renderCautions();
    else if(v==='tpl')renderTemplates();
    else if(v==='lang')renderLang();
    else if(v==='guides2')renderDeep();
    else if(v==='courtlists')renderCourtLists();
    else renderJudgments();
  }));
  view.scrollTop=0;
}
function renderAbout(){
  view.innerHTML=`<h2 class="sec">About Assisting</h2>
  <div class="tool"><div class="gtxt"><b>Assisting</b> is an independent operational reference tool. It is <b>not an official Garda system</b> and is not endorsed by An Garda Síochána. Nothing in it is legal advice — verify current wording and follow direction from your member in charge.</div></div>
  <div class="tool"><h3>What stays on this phone</h3><div class="gtxt">Your notes, tasks, roster, patrols, recordings, scans and saved pages are stored only on this phone. Nothing is uploaded. Clearing the app's site data deletes them.</div></div>
  <div class="tool"><h3>What uses the internet</h3><div class="gtxt">Live cameras, news, radio, judgments, court lists, map tiles and street names need signal. AI search sends your question and the matching extracts from the app's reference content (never your own notes, tasks or patrols) to Anthropic, using your own key.</div></div>
  <div class="tool"><h3>Version</h3><div class="gtxt">${esc(window.GRVER||'')}</div></div>`;
  view.scrollTop=0;
}
function kbHead(t){return `<button class="chip" id="backT" style="margin-bottom:8px">‹ Tools</button><h2 class="sec">${esc(t)}</h2>`;}
function cardHTML(c){return `<div class="tool"><h3>${esc(c.h)}</h3><div style="font-size:13.5px;line-height:1.55">${esc(c.body)}</div>`+(c.tag?'':'')+`</div>`;}
function copyBtnHtml(txt,label){const id='cp'+Math.random().toString(36).slice(2,7);
  setTimeout(()=>{const b=document.getElementById(id);if(b)b.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(txt);b.textContent='✓ Copied';}catch(e){b.textContent='Copy failed';}});},0);
  return `<button class="csall" id="${id}">⧉ ${label||'Copy'}</button>`;}
function renderCaution(){
  const K=KB.caution;
  let h=kbHead('🗣 '+K.t)+`<div class="rbox note">${esc(K.intro)}</div>`;
  h+=K.cards.map(c=>`<div class="tool"><h3>${esc(c.h)}</h3><div style="font-size:13.5px;line-height:1.55">${esc(c.body)}</div>${copyBtnHtml(c.body,'Copy text')}</div>`).join('');
  h+='<h2 class="sec">Related case law — know before you caution</h2>';
  h+=K.cases.map(c=>`<button class="hit" data-n="${esc(c.n)}"><div class="h-title"><i>${esc(c.n)}</i></div><div class="h-snip" style="color:var(--ink)">${esc(c.p)}</div></button>`).join('');
  view.innerHTML=h;wireBack();
  $$('#view .hit').forEach(b=>b.addEventListener('click',()=>{const c=CASES.find(x=>x.n===b.dataset.n);if(c)openCase(c.n);else searchFor(b.dataset.n);}));
  view.scrollTop=0;
}
function renderKBtopic(v){
  const K=KB[v];let h=kbHead((K.emoji||'')+' '+K.t);
  if(K.intro)h+=`<div class="rbox note">${esc(K.intro)}</div>`;
  if(K.cards)h+=K.cards.map(c=>`<div class="tool"><h3>${esc(c.h)}</h3><div style="font-size:13.5px;line-height:1.55">${esc(c.body)}</div></div>`).join('');
  if(K.sections)h+=K.sections.map(sec=>`<div class="tool"><h3>${esc(sec.h)}</h3><ul class="rlist" style="color:var(--ink)">${sec.items.map(i=>'<li>'+esc(i)+'</li>').join('')}</ul></div>`).join('');
  if(K.items)h+='<div class="tool">'+K.items.map(([a,b])=>`<div style="padding:8px 0;border-bottom:1px solid var(--navy3)"><b style="color:var(--gold)">${esc(a)}</b><div style="font-size:13.5px">${esc(b)}</div></div>`).join('')+'</div>';
  view.innerHTML=h;wireBack();view.scrollTop=0;
}
function renderLatin(){
  const K=KB.latin;let h=kbHead('📜 '+K.t)+`<div class="searchbox" style="position:static"><input id="lxq" type="search" placeholder="Filter terms…"></div><div id="lxl"></div>`;
  view.innerHTML=h;wireBack();
  const draw=q=>{q=(q||'').toLowerCase();
    $('#lxl').innerHTML='<div class="tool">'+K.terms.filter(([a,b])=>!q||a.toLowerCase().includes(q)||b.toLowerCase().includes(q))
      .map(([a,b])=>`<div style="padding:8px 0;border-bottom:1px solid var(--navy3)"><b style="color:var(--gold);font-style:italic">${esc(a)}</b><div style="font-size:13.5px">${esc(b)}</div></div>`).join('')+'</div>';};
  draw();let t;$('#lxq').addEventListener('input',e=>{clearTimeout(t);t=setTimeout(()=>draw(e.target.value),120);});
  view.scrollTop=0;
}
function renderAcronyms(){
  const K=KB.acronyms;
  view.innerHTML=kbHead('🔤 '+K.t)+'<div class="tool">'+K.items.map(([a,b])=>`<div style="padding:9px 0;border-bottom:1px solid var(--navy3)"><b style="color:var(--gold)">${esc(a)}</b><div style="font-size:13.5px">${esc(b)}</div></div>`).join('')+'</div>';
  wireBack();view.scrollTop=0;
}
function renderCCTV(){
  view.innerHTML=kbHead('📧 CCTV preservation request')+`
  <div class="tool">
    <label class="flab">Premises / holder</label><input class="fin" id="cvHolder" placeholder="e.g. Centra, 12 Main St">
    <label class="flab">Location searched on Google (optional)</label><input class="fin" id="cvSearch" placeholder="business name + area">
    <button class="csall" id="cvGmap">🔎 Find contact on Google</button>
    <label class="flab">Incident date & time</label><input class="fin" id="cvWhen" placeholder="28/06/2026, approx 03:30">
    <label class="flab">Camera(s) / area of interest</label><input class="fin" id="cvArea" placeholder="front door + footpath">
    <label class="flab">Your details</label><input class="fin" id="cvYou" placeholder="Garda [Name] [Reg], [Station], [tel]">
    <label class="flab">PULSE / ref (optional)</label><input class="fin" id="cvRef" placeholder="incident ref">
    <button class="csall" id="cvGen">Generate request</button>
  </div>
  <div id="cvOut"></div>
  <div class="toolnote">Generates text only. Copy it onto your station headed paper and send it yourself. The parallel s.41B request to your district office must be raised through your own Garda email — this app cannot and must not send it for you.</div>`;
  wireBack();
  $('#cvGmap').addEventListener('click',()=>{const q=encodeURIComponent(($('#cvSearch').value||$('#cvHolder').value||'')+' contact');window.open('https://www.google.com/search?q='+q,'_blank');});
  $('#cvGen').addEventListener('click',()=>{
    const g=id=>($('#'+id).value||'').trim();
    const body=`Re: Preservation and provision of CCTV — request under investigation${g('cvRef')?' (Ref: '+g('cvRef')+')':''}\n\nTo the occupier / data controller, ${g('cvHolder')||'[premises]'},\n\nAn Garda Síochána is investigating an incident that occurred on ${g('cvWhen')||'[date/time]'} in your vicinity. Your CCTV system may hold footage of evidential value covering ${g('cvArea')||'[area]'}.\n\nI request that you PRESERVE and do not overwrite or delete any CCTV footage for a period of at least two hours before and after the above time, and retain it pending formal collection. CCTV is routinely overwritten within days, so prompt preservation is essential.\n\nA member of An Garda Síochána will attend to view and, where appropriate, take possession of relevant footage. A formal data-access request will follow through the appropriate channel.\n\nPlease confirm preservation by contacting me.\n\n${g('cvYou')||'Garda [Name] [Reg], [Station], [tel]'}\nAn Garda Síochána`;
    $('#cvOut').innerHTML='<div class="tool"><h3>Preservation request</h3><div style="font-size:13px;white-space:pre-wrap;line-height:1.5">'+esc(body)+'</div>'+copyBtnHtml(body,'Copy request')+'<button class="csall" id="cvDl">⬇ Download as Word</button></div>'
      +'<div class="tool"><h3>Reminder — s.41B parallel step</h3><div style="font-size:13px;line-height:1.5">Raise the s.41B Data Protection Act 2018 request on your official Garda email and forward to the District Office for the Superintendent\'s signature. Do this yourself through Garda systems — never through this app.</div></div>';
    const dl=$('#cvDl'); if(dl)dl.addEventListener('click',()=>downloadDoc('CCTV preservation request'+(g('cvHolder')?' — '+g('cvHolder'):''),body));
    // rewire copy
    const t=$('#cvOut'); t.scrollIntoView({behavior:'smooth'});
  });
  view.scrollTop=0;
}
function dictate(item,draw,save){
  const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
  if(!SR){alert('Voice dictation not supported in this browser. Type instead.');return;}
  const r=new SR();r.lang='en-IE';r.interimResults=false;
  r.onresult=e=>{const t=e.results[0][0].transcript;item.desc=(item.desc?item.desc+' ':'')+t;save();draw();};
  r.onerror=()=>{};
  r.start();
}

function blocksHTML(bl){return bl.map(b=>`<div class="tool"><h3>${esc(b.h)}</h3><div class="gtxt">${esc(b.t).replace(/\n/g,'<br>')}</div></div>`).join('');}
function copyBtn(id,txt){
  setTimeout(()=>{const b=document.getElementById(id);if(!b)return;
    b.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(txt);const o=b.textContent;b.textContent='✓ Copied';setTimeout(()=>b.textContent=o,1600);}catch(e){b.textContent='Copy failed — long-press the text';}});},0);
}
function renderCautions(){
  const C=OPS2.cautions,D=OPS2.declarations;
  view.innerHTML=`<button class="chip" id="backT">‹ Tools</button><h2 class="sec">${esc(C.title)}</h2>${blocksHTML(C.blocks)}<h2 class="sec">${esc(D.title)}</h2><div id="decl"></div>`;
  wireBack();
  $('#decl').innerHTML=D.items.map((d,i)=>`<div class="cslot"><button class="ixrow cshead"><span class="term" style="font-style:normal;font-weight:700">${esc(d.n)}</span><div class="refs">▾</div></button><div class="csbody hidden"><div class="gtxt declbox">${esc(d.t).replace(/\n/g,'<br>')}</div><button class="csall" id="dc${i}">⧉ Copy</button></div></div>`).join('');
  $$('#decl .cshead').forEach(h=>h.addEventListener('click',()=>h.nextElementSibling.classList.toggle('hidden')));
  D.items.forEach((d,i)=>copyBtn('dc'+i,d.t));
  view.scrollTop=0;
}
function renderTemplates(){
  const cats=[...new Set(TPL.map(t=>t.cat))];
  let h='<button class="chip" id="backT">‹ Tools</button>';
  for(const c of cats){h+=`<h2 class="sec">${esc(c)}</h2>`;
    TPL.forEach((t,i)=>{if(t.cat!==c)return;h+=`<button class="hit" data-i="${i}"><div class="h-title">${esc(t.t)}</div>${t.sub?`<div class="h-loc">${esc(t.sub)}</div>`:''}</button>`;});}
  h+='<div class="toolnote">Fill the [BRACKETS] before sending. Anything needing a Superintendent signature goes via your official email to the District Office — never issue it under your own name.</div>';
  view.innerHTML=h;wireBack();
  $$('#view .hit').forEach(b=>b.addEventListener('click',()=>openTemplate(+b.dataset.i)));
  view.scrollTop=0;
}
function openTemplate(i){
  const t0=TPL[i], t=Object.assign({},t0,{b:reflow(t0.b)});
  view.innerHTML=`<button class="chip" id="backT2">‹ Templates</button><h2 class="sec">${esc(t.t)}</h2>
  ${t.sub?`<div class="tool"><h3>Subject</h3><div class="gtxt">${esc(t.sub)}</div><button class="csall" id="cs">⧉ Copy subject</button></div>`:''}
  <div class="tool"><div class="gtxt tplbody">${paraHtml(esc(t.b))}</div></div>
  <button class="csall" id="cb">⧉ Copy full text</button>
  <button class="csall" id="dlw">⬇ Download as Word</button>
  ${t.sub?'<button class="csall" id="mb">✉️ Open in email app</button>':''}`;
  $('#backT2').addEventListener('click',renderTemplates);
  copyBtn('cb',t.b); if(t.sub)copyBtn('cs',t.sub);
  $('#dlw').addEventListener('click',()=>downloadDoc(t.t,t.b));
  const mb=$('#mb'); if(mb)mb.addEventListener('click',()=>{window.location.href='mailto:?subject='+encodeURIComponent(t.sub)+'&body='+encodeURIComponent(t.b);});
  view.scrollTop=0;
}
// Exhibit log: the list lives in memory for this session only (never stored); only the prefix is remembered.
let EXH=[];
let exhPrefix=(()=>{ try{ return localStorage.getItem('gr_exhpre')||'SMG'; }catch(e){ return 'SMG'; } })();
function saveExh(){ /* session only by design — nothing written to the phone */ }
function renderExhibits(){
  const rec=('webkitSpeechRecognition' in window)||('SpeechRecognition' in window);
  view.innerHTML=`<button class="chip" id="backT">‹ Tools</button><h2 class="sec">📦 Exhibit log — session only</h2>
  <div class="tool">
    <div style="display:flex;gap:8px;align-items:center;margin-bottom:8px">
      <input id="pre" value="${esc(exhPrefix)}" style="width:74px;padding:9px;border-radius:8px;border:1px solid var(--navy3);background:var(--navy);color:var(--gold);font-weight:800;text-align:center">
      <span style="color:var(--ink-dim);font-size:13px">next: <b style="color:var(--gold)">${esc(exhPrefix)}${EXH.length+1}</b></span>
    </div>
    <textarea id="edesc" rows="3" placeholder="What it is · where found · when · by whom" style="width:100%;padding:10px;border-radius:8px;border:1px solid var(--navy3);background:var(--navy);color:var(--ink);font-size:14px"></textarea>
    <div style="display:flex;gap:8px;margin-top:8px">
      ${rec?'<button class="csall" id="mic" style="flex:1;margin:0">🎤 Speak it</button>':''}
      <button class="csall" id="addE" style="flex:1;margin:0">+ Add exhibit</button>
    </div>
  </div><div id="elist"></div>
  ${EXH.length?'<button class="csall" id="copyAll">⧉ Copy exhibit schedule</button><button class="toolreset" id="clrE">Clear all</button>':''}
  <div class="toolnote">Session-only — cleared when you close the app. Never a substitute for PEMS or your notebook.</div>`;
  wireBack();
  $('#pre').addEventListener('change',e=>{exhPrefix=(e.target.value||'SMG').toUpperCase().trim();localStorage.setItem('gr_exhpre',exhPrefix);renderExhibits();});
  $('#elist').innerHTML=EXH.map((x,i)=>`<div class="cslot"><div class="ixrow" style="display:flex;gap:10px;align-items:flex-start"><b style="color:var(--gold)">${esc(exhPrefix)}${i+1}</b><span style="flex:1;font-size:14px">${esc(x.d)}<div class="refs">${esc(x.t)}</div></span><button class="unsave" data-i="${i}" style="width:36px;height:36px;font-size:15px">✕</button></div></div>`).join('');
  $$('#elist .unsave').forEach(b=>b.addEventListener('click',()=>{EXH.splice(+b.dataset.i,1);saveExh();renderExhibits();}));
  $('#addE').addEventListener('click',()=>{const d=$('#edesc').value.trim();if(!d)return;
    EXH.push({d,t:new Date().toLocaleString('en-IE',{hour:'2-digit',minute:'2-digit',day:'2-digit',month:'2-digit'})});saveExh();renderExhibits();});
  const ca=$('#copyAll'); if(ca)copyBtn('copyAll',EXH.map((x,i)=>exhPrefix+(i+1)+' — '+x.d).join('\n'));
  const cl=$('#clrE'); if(cl)cl.addEventListener('click',()=>{if(confirm('Clear all exhibits?')){EXH=[];saveExh();renderExhibits();}});
  const mic=$('#mic');
  if(mic)mic.addEventListener('click',()=>{
    const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
    const r=new SR();r.lang='en-IE';r.interimResults=false;
    mic.textContent='🔴 Listening…';
    r.onresult=e=>{const ta=$('#edesc');ta.value=(ta.value?ta.value+' ':'')+e.results[0][0].transcript;mic.textContent='🎤 Speak it';};
    r.onerror=()=>{mic.textContent='🎤 Mic unavailable — type it';};
    r.onend=()=>{if(mic.textContent==='🔴 Listening…')mic.textContent='🎤 Speak it';};
    r.start();
  });
  view.scrollTop=0;
}
function renderLang(){
  const L=OPS2.latin,A=OPS2.acronyms;
  view.innerHTML=`<button class="chip" id="backT">‹ Tools</button><div class="searchbox" style="position:static"><input id="lqq" type="search" placeholder="Find a term… res gestae, ABC, ADVOKATE"></div><div id="langout"></div>`;
  wireBack();
  const draw=q=>{
    q=(q||'').toLowerCase();
    const lat=L.items.filter(x=>!q||(x.t+x.m+x.u).toLowerCase().includes(q));
    const ac=A.items.filter(x=>!q||(x.t+x.m).toLowerCase().includes(q));
    let h='';
    if(ac.length)h+=`<h2 class="sec">${esc(A.title)}</h2>`+ac.map(x=>`<div class="cslot"><div class="ixrow"><b style="color:var(--gold)">${esc(x.t)}</b><div class="csdesc" style="color:var(--ink)">${esc(x.m)}</div></div></div>`).join('');
    if(lat.length)h+=`<h2 class="sec">${esc(L.title)}</h2>`+lat.map(x=>`<div class="cslot"><div class="ixrow"><b style="color:var(--gold);font-style:italic">${esc(x.t)}</b><div class="csdesc" style="color:var(--ink)">${esc(x.m)}</div><div class="refs">Use: ${esc(x.u)}</div></div></div>`).join('');
    $('#langout').innerHTML=h||'<div class="empty">No match.</div>';
  };
  draw();let t;$('#lqq').addEventListener('input',e=>{clearTimeout(t);t=setTimeout(()=>draw(e.target.value),140);});
  view.scrollTop=0;
}
function renderDeep(g){
  const G=[['searches',OPS2.searches],['weapons',OPS2.weapons],['rtc',OPS2.rtc],['precis',OPS2.precis],['missing',OPS2.missing],['exhibitsHelp',OPS2.exhibitsHelp]];
  if(!g){
    view.innerHTML='<button class="chip" id="backT">‹ Tools</button><h2 class="sec">📚 Deep guides</h2><div class="toolmenu">'
      +G.map(([k,v])=>`<button class="tmenu" data-g="${k}"><b>${esc(v.title)}</b></button>`).join('')
      +`<button class="tmenu" data-g="door"><b>${esc(OPS2.door.title)}</b></button></div>`;
    wireBack();
    $$('#view .tmenu').forEach(b=>b.addEventListener('click',()=>renderDeep(b.dataset.g)));
    view.scrollTop=0;return;
  }
  if(g==='door'){
    const D=OPS2.door;
    view.innerHTML=`<button class="chip" id="backD">‹ Deep guides</button><h2 class="sec">${esc(D.title)}</h2>`
      +D.items.map((it,i)=>{const on=toolState['dd'+i];return `<div class="ck ${on?'done':''}" data-k="dd${i}"><div class="box">${on?'✓':''}</div><div class="lb">${esc(it)}</div></div>`;}).join('')
      +'<button class="csall" id="cpq">⧉ Copy questionnaire</button>';
    $('#backD').addEventListener('click',()=>renderDeep());
    $$('#view .ck').forEach(c=>c.addEventListener('click',()=>{const k=c.dataset.k;toolState[k]=!toolState[k];
      c.classList.toggle('done',toolState[k]);c.querySelector('.box').textContent=toolState[k]?'✓':'';}));
    copyBtn('cpq',D.items.map((x,i)=>(i+1)+'. '+x).join('\n'));
    view.scrollTop=0;return;
  }
  const V=OPS2[g];
  view.innerHTML=`<button class="chip" id="backD">‹ Deep guides</button><h2 class="sec">${esc(V.title)}</h2>${blocksHTML(V.blocks)}`;
  $('#backD').addEventListener('click',()=>renderDeep());
  view.scrollTop=0;
}
let rdScale=parseFloat(localStorage.getItem('gr_rdscale')||'1');
function applyRdScale(){rdBody.style.fontSize=(15.5*rdScale).toFixed(1)+'px';localStorage.setItem('gr_rdscale',String(rdScale));}
(function pinch(){
  let d0=null,s0=1;
  const dist=e=>Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY);
  document.addEventListener('touchstart',e=>{if(e.target.closest&&e.target.closest('.rd-body')&&e.touches.length===2){d0=dist(e);s0=rdScale;}},{passive:true});
  document.addEventListener('touchmove',e=>{if(d0&&e.touches.length===2){rdScale=Math.min(2.2,Math.max(0.75,s0*(dist(e)/d0)));applyRdScale();}},{passive:true});
  document.addEventListener('touchend',()=>{ if(d0&&book.on)bookRelayout(); d0=null;},{passive:true});
})();
function wireBack(){const b=$('#backT');if(b)b.addEventListener('click',()=>{ if(window.grBack)grBack(); else{setTab('tools');render();} });}
function renderChecklists(){
  const GRP=[['On scene',['scene','warrant','exhibit','arrest']],
   ['Custody & interview',['inference']],['Statements & identification',['advokate','fivepart','victim']]];
  view.innerHTML=`<button class="chip" id="backT" style="margin-bottom:8px">‹ Tools</button>
  <div class="searchbox" style="position:static"><input id="tq" type="search" placeholder="Find a checklist… warrant, scene, ADVOKATE"></div><div id="toolList"></div>`;
  wireBack();
  const draw=q=>{
    q=(q||'').toLowerCase();let out='';
    for(const[g,ids]of GRP){
      const ts=TOOLS.filter(t=>ids.includes(t.id)&&(!q||t.title.toLowerCase().includes(q)||t.items.join(' ').toLowerCase().includes(q)));
      if(!ts.length)continue;
      out+=`<h2 class="sec">${g}</h2>`;
      for(const t of ts){
        const done=t.items.filter((_,i)=>toolState[t.id+i]).length;
        out+=`<div class="cslot"><button class="ixrow cshead"><span class="term" style="font-style:normal;font-weight:700">${esc(t.title)}</span>
        <div class="refs">${done?done+'/'+t.items.length+' · ':''}${t.items.length} steps ▾</div></button><div class="csbody ${q?'':'hidden'}">`;
        t.items.forEach((it,i)=>{const on=toolState[t.id+i];
          out+=`<div class="ck ${on?'done':''}" data-t="${t.id}" data-i="${i}"><div class="box">${on?'✓':''}</div><div class="lb">${esc(it)}</div></div>`;});
        out+=`<button class="csall srcbtn" data-a="${t.src}">Open source pages (${esc(pageLabel(t.src))})</button>
        <button class="toolreset" data-t="${t.id}" data-n="${t.items.length}">Reset</button></div></div>`;
      }
    }
    out+='<div class="toolnote">Ticks are session-only — nothing stored, nothing sent.</div>';
    $('#toolList').innerHTML=out;
    $$('#toolList .cshead').forEach(h=>h.addEventListener('click',()=>h.nextElementSibling.classList.toggle('hidden')));
    $$('#toolList .ck').forEach(c=>c.addEventListener('click',()=>{const k=c.dataset.t+c.dataset.i;toolState[k]=!toolState[k];
      c.classList.toggle('done',toolState[k]);c.querySelector('.box').textContent=toolState[k]?'✓':'';}));
    $$('#toolList .toolreset').forEach(b=>b.addEventListener('click',()=>{for(let i=0;i<+b.dataset.n;i++)delete toolState[b.dataset.t+i];draw($('#tq').value);}));
    $$('#toolList .srcbtn').forEach(b=>b.addEventListener('click',()=>openPage(+b.dataset.a)));
  };
  draw();let tm;$('#tq').addEventListener('input',e=>{clearTimeout(tm);tm=setTimeout(()=>draw(e.target.value),150);});
}
/* ---------- JUDGMENTS: BAILII Ireland search ----------
   BAILII runs an anti-bot check that stops apps loading its pages, so the search is built here and the results open on bailii.org. */
const BL_COURTS=[['ie/cases','All Irish courts'],['ie/cases/IESC','Supreme Court'],['ie/cases/IECA','Court of Appeal'],['ie/cases/IEHC','High Court'],['ie/cases/IECCA','Court of Criminal Appeal (to 2014)']];
let blCourt='ie/cases', blSort='rank';
function bailiiURL(q,court,sort){
  return 'https://www.bailii.org/cgi-bin/lucy_search_1.cgi?method=boolean&query='+encodeURIComponent(q)
    +'&mask_path='+(court||'ie/cases')+'&datelow=&datehigh=&sort='+(sort==='date'?'date':'rank')+'&highlight=1';
}
function blRecent(){ try{ const r=JSON.parse(localStorage.getItem('gr_bl_recent')||'[]'); return Array.isArray(r)?r:[]; }catch(e){ return []; } }
function openBailii(q,court,sort){
  q=String(q||'').trim(); if(!q)return false;
  try{ const r=blRecent().filter(x=>String(x).toLowerCase()!==q.toLowerCase()); r.unshift(q); localStorage.setItem('gr_bl_recent',JSON.stringify(r.slice(0,8))); }catch(e){}
  window.open(bailiiURL(q,court||blCourt,sort||blSort),'_blank','noopener');
  return true;
}
window.openBailii=openBailii;
const BL_BROWSE=[['newspaper','Recent Irish decisions','Everything added to BAILII lately','https://www.bailii.org/recent-accessions-ie.html'],
  ['landmark','Supreme Court','Judgments by year','https://www.bailii.org/ie/cases/IESC/'],
  ['scale','Court of Appeal','Civil and criminal appeals since 2014','https://www.bailii.org/ie/cases/IECA/'],
  ['gavel','High Court','Judgments by year','https://www.bailii.org/ie/cases/IEHC/'],
  ['scroll','Court of Criminal Appeal','Older criminal appeals, up to 2014','https://www.bailii.org/ie/cases/IECCA/'],
  ['book-open','Courts.ie judgments','Official Courts Service site, newest first','https://www.courts.ie/judgments']];
function bailiiScreen(q0){
  const rec=blRecent();
  view.innerHTML=`<button class="chip" id="backT">‹ Tools</button>
  <h2 class="sec" data-t="1">Judgments — BAILII Ireland</h2>
  <div class="sec-sub">Search Irish judgments · results open on bailii.org</div>
  <form class="bl" id="blForm" autocomplete="off">
    <label class="bl-box">${GRI('search')}<input id="blq" type="search" enterkeyhint="search" placeholder="Case name, topic or citation…" value="${esc(q0||'')}"></label>
    <div class="bl-l">Court</div>
    <div class="chips bl-c">${BL_COURTS.map(([k,l])=>`<button type="button" class="chip${k===blCourt?' on':''}" data-c="${k}">${esc(l)}</button>`).join('')}</div>
    <div class="bl-l">Order</div>
    <div class="chips bl-s"><button type="button" class="chip${blSort==='rank'?' on':''}" data-s="rank">Best match</button><button type="button" class="chip${blSort==='date'?' on':''}" data-s="date">Newest first</button></div>
    <button class="bl-go" type="submit">${GRI('search')}<span>Search BAILII</span>${GRI('external-link')}</button>
  </form>
  <div class="bl-tip">Tips: put an “exact phrase” in quotes · AND, OR, NOT work · a citation like [2017] IESC 77 finds that judgment · a party name finds the case.</div>
  ${rec.length?`<h2 class="sec" data-t="1">Recent searches<span class="sec-r"><button type="button" class="sx-clr" id="blClr">Clear</button></span></h2><div class="lgrp">${rec.map(x=>`<button type="button" class="lrow bl-r" data-q="${esc(x)}">${GRI('history')}<span class="lt"><b>${esc(x)}</b></span>${GRI('external-link','chev')}</button>`).join('')}</div>`:''}
  <h2 class="sec" data-t="1">Browse the newest</h2>
  <div class="lgrp">${BL_BROWSE.map(([ic,t,sb,u])=>`<button type="button" class="lrow bl-u" data-u="${u}">${GRI(ic)}<span class="lt"><b>${esc(t)}</b><small>${esc(sb)}</small></span>${GRI('external-link','chev')}</button>`).join('')}</div>
  <div class="toolnote">BAILII doesn't allow apps to load its pages, so results open in your browser. Free · needs signal.</div>`;
  wireBack();
  const qi=$('#blq');
  $$('.bl-c .chip').forEach(c=>c.addEventListener('click',()=>{ blCourt=c.dataset.c; $$('.bl-c .chip').forEach(x=>x.classList.toggle('on',x===c)); }));
  $$('.bl-s .chip').forEach(c=>c.addEventListener('click',()=>{ blSort=c.dataset.s; $$('.bl-s .chip').forEach(x=>x.classList.toggle('on',x===c)); }));
  $('#blForm').addEventListener('submit',ev=>{ ev.preventDefault(); const q=qi.value.trim(); if(!q){ qi.focus(); return; } qi.blur(); openBailii(q); setTimeout(()=>{ if(document.getElementById('blForm'))bailiiScreen(q); },300); });
  $$('.bl-r').forEach(b=>b.addEventListener('click',()=>{ qi.value=b.dataset.q; openBailii(b.dataset.q); }));
  $$('.bl-u').forEach(b=>b.addEventListener('click',()=>window.open(b.dataset.u,'_blank','noopener')));
  const cl=$('#blClr'); if(cl)cl.addEventListener('click',()=>{ try{ localStorage.removeItem('gr_bl_recent'); }catch(e){} bailiiScreen(qi.value); });
  view.scrollTop=0;
}
function renderJudgments(q){ bailiiScreen(typeof q==='string'?q:''); }
function renderCourtLists(){
  const C=[
   ['⚖️ Supreme Court','https://legaldiary.courts.ie/supreme-court'],
   ['🏛️ Court of Appeal','https://legaldiary.courts.ie/court-of-appeal'],
   ['🏛️ High Court','https://legaldiary.courts.ie/high-court'],
   ['⚖️ Central Criminal Court (CCJ)','https://legaldiary.courts.ie/central-criminal-court'],
   ['🏛️ Circuit Court (Civil & Criminal)','https://legaldiary.courts.ie/circuit-court'],
   ['🏛️ District Court','https://legaldiary.courts.ie/district-court'],
   ['📋 General notices','https://legaldiary.courts.ie/general-notices'],
  ];
  view.innerHTML=`<button class="chip" id="backT" style="margin-bottom:8px">‹ Tools</button>
   <h2 class="sec">🗓️ Court lists — who's on today</h2>
   <div class="tool"><div class="gtxt">The official Legal Diary — every Dublin court's daily list, parties and judges. Updated <b>5.00pm daily, Mon–Fri</b> for the next sitting day. Opens in your browser (the live lists load there).</div></div>
   ${C.map(([n,u])=>`<a class="oslink" href="${u}" target="_blank" rel="noopener">${n} ↗</a>`).join('')}
   <a class="oslink" href="https://legaldiary.courts.ie/download" target="_blank" rel="noopener" style="border-color:var(--gold);color:var(--gold)">⬇️ Download today's diary (PDF / Word) ↗</a>
   <div class="toolnote">CCJ (Parkgate St) houses the Central Criminal Court and the Circuit Criminal Court — check both. Live scraping isn't reliable here, so these open the authoritative source directly.</div>`;
  wireBack();
}

/* ---------- SAVED ---------- */
function renderSaved(){
  let html='<div class="tabroot" data-tab="saved" hidden></div><h2 class="sec">Saved sections<span class="sec-r">'+favs.length+'</span></h2>';
  if(!favs.length)html+='<div class="empty">Nothing saved yet. Open any page and tap ☆ to keep it here.<br>Only the page reference is stored — never case data.</div>';
  html+='<div class="lgrp">'+favs.map((f,i)=>{ const parts=String(f.title).split(' › '), t=parts.pop(), sub=f.label+(parts.length?' · '+parts[parts.length-1]:'');
    return `<div class="savedrow">${lrow(f.a,'bookmark',t,sub,'','data-go')}<button class="unsave" data-i="${i}" aria-label="Remove">${GRI('x')}</button></div>`; }).join('')+'</div>';
  view.innerHTML=html;
  $$('.savedrow .lrow').forEach(b=>b.addEventListener('click',()=>openPage(+b.dataset.go)));
  $$('.unsave').forEach(b=>b.addEventListener('click',()=>{favs.splice(+b.dataset.i,1);saveFavs();renderSaved();}));
}
function saveFavs(){localStorage.setItem(FAVKEY,JSON.stringify(favs));}
function toggleFav(){
  const i=favs.findIndex(f=>f.a===curPage);
  if(i>=0)favs.splice(i,1); else favs.push({a:curPage,title:titleFor(curPage),label:pageLabel(curPage)});
  saveFavs(); $('#rdStar').textContent=favs.some(f=>f.a===curPage)?'★':'☆';
}

/* ---------- READER ---------- */
function openPage(abs){ if(!window._pz){window._pz=1;setTimeout(pinchZoom,0);} 
  try{localStorage.setItem('gr_lastpage',String(abs));}catch(e){}
  try{pushRecent({k:'page',id:abs,t:titleFor(abs).split(' › ').pop(),s:pageLabel(abs)});}catch(e){}
  $('#rdPrev').style.visibility='';$('#rdNext').style.visibility='';$('#rdJump').style.visibility='';
  const star0=$('#rdStar'); star0.onclick=null; star0.textContent=favs.some(f=>f.a===curPage)?'★':'☆';
  curPage=Math.min(Math.max(1,abs),META.pages);
  const txt=pageText(curPage);
  reader.classList.remove('hidden'); reader.setAttribute('aria-hidden','false');
  { const tp=titleFor(curPage).split(' › '), last=tp.pop(); $('#rdTitle').innerHTML=(tp.length?'<small class="rd-path">'+esc(tp.join(' › '))+'</small>':'')+esc(last); }
  $('#rdPage').textContent=pageLabel(curPage)+'  ·  p.'+curPage+' of '+META.pages;
  $('#rdStar').textContent=favs.some(f=>f.a===curPage)?'★':'☆';
  const flag=$('#rdFlag');
  if(isDated(curPage)){flag.textContent='⚠ 2007 manual — law and procedure may be superseded. Verify before relying.';flag.classList.remove('hidden');}
  else flag.classList.add('hidden');
  if(txt===null){rdBody.textContent='This part is still downloading — one moment (or reconnect once to finish caching).';return;}
  curDoc={title:titleFor(curPage).split(' › ').pop()+' — '+pageLabel(curPage),text:stripMd(txt)};
  rdBody.innerHTML=formatPage(stripMd(txt));
  applyRdScale(); updateDlBtn();
  rdBody.querySelectorAll('.xref').forEach(x=>x.addEventListener('click',()=>openPage(+x.dataset.a)));
  rdBody.scrollTop=0;
}
function pinchZoom(){
  const el=rdBody; let base=parseFloat(localStorage.getItem('gr_zoom')||'1');
  el.style.fontSize=(base*100)+'%';
  let d0=0,b0=base;
  el.addEventListener('touchstart',e=>{if(e.touches.length===2){d0=Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY);b0=base;}},{passive:true});
  el.addEventListener('touchmove',e=>{if(e.touches.length===2&&d0){const d=Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY);base=Math.min(2.2,Math.max(0.7,b0*d/d0));el.style.fontSize=(base*100)+'%';}},{passive:true});
  el.addEventListener('touchend',()=>{if(d0){localStorage.setItem('gr_zoom',base.toFixed(2));d0=0;}});
}
/* ---------- Book reading: long texts in pages, like a Kindle ----------
   Swipe or tap the right/left edge to turn the page; tap the middle to hide the bars. At the end of a manual page
   the next tap carries on into the next page. On by default for long reading; the book button switches it. */
const book={on:false,page:0,pages:1,goEnd:false,raf:0};
function bookPref(){ try{ return localStorage.getItem('gr_book'); }catch(e){ return null; } }
function bookWanted(){ return bookPref()!=='0'; }        // on unless switched off — short texts are simply one page
function bookToggle(){ const on=!book.on; try{ localStorage.setItem('gr_book',on?'1':'0'); }catch(e){} bookApply(); if(typeof toast==='function')toast(on?'Book reading on — swipe or tap the edges to turn pages':'Book reading off — scroll as normal'); }
function bookStride(){ return rdBody.clientWidth; }
function bookApply(){
  if(reader.classList.contains('hidden'))return;
  const on=bookWanted(), b=$('#rdBook');
  book.on=on; reader.classList.toggle('book',on); reader.classList.remove('bare');
  if(b){ b.classList.toggle('on',on); b.setAttribute('aria-pressed',on?'true':'false'); }
  if(!on){ rdBody.style.removeProperty('--bw'); rdBody.scrollLeft=0; const pi=$('#bkInd'); if(pi)pi.hidden=true; return; }
  rdBody.querySelectorAll('details').forEach(d=>{ d.open=true; });
  const end=book.goEnd; book.goEnd=false; bookLayout(end?1e9:0); }
function bookLayout(goPage){
  const cs=getComputedStyle(rdBody), pl=parseFloat(cs.paddingLeft)||0, pr=parseFloat(cs.paddingRight)||0;
  rdBody.style.setProperty('--bw',Math.max(120,rdBody.clientWidth-pl-pr)+'px'); rdBody.style.setProperty('--bg',(pl+pr)+'px');
  const st=bookStride(); book.pages=Math.max(1,Math.round(rdBody.scrollWidth/st));
  book.page=Math.max(0,Math.min(book.pages-1,goPage|0)); rdBody.scrollLeft=book.page*st; bookPaint();
  // the reading font arrives a moment later and re-flows the text: count the pages again then
  requestAnimationFrame(()=>bookMeasure(goPage)); setTimeout(()=>bookMeasure(goPage),400); if(document.fonts&&document.fonts.ready)document.fonts.ready.then(()=>bookMeasure(goPage)); }
function bookMeasure(goPage){ if(!book.on)return; const st=bookStride(), n=Math.max(1,Math.round(rdBody.scrollWidth/st));
  if(n===book.pages)return; book.pages=n; if(goPage>=1e9)book.page=n-1; else if(book.page>n-1)book.page=n-1; rdBody.scrollLeft=book.page*st; bookPaint(); }
function bookRelayout(){ if(!book.on)return; const r=book.pages>1?book.page/(book.pages-1):0; bookLayout(0); bookLayout(Math.round(r*(book.pages-1))); }
function bookPaint(){
  let pi=$('#bkInd'); if(!pi){ reader.insertAdjacentHTML('beforeend','<div id="bkInd" class="bk-ind"></div>'); pi=$('#bkInd'); }
  pi.hidden=!book.on; pi.textContent=(book.page+1)+' / '+book.pages;
  const bar=$('#rdProg'); if(bar)bar.style.width=(book.pages>1?(book.page/(book.pages-1)*100):100)+'%'; }
function bookTurn(dir){
  const st=bookStride(), np=book.page+dir, manual=$('#rdNext')&&$('#rdNext').style.visibility!=='hidden';
  if(np<0){ if(manual&&curPage>1){ book.goEnd=true; openPage(curPage-1); } return; }
  if(np>=book.pages){ if(manual&&curPage<META.pages)openPage(curPage+1); else if(typeof toast==='function')toast('End'); return; }
  book.page=np; rdBody.scrollTo({left:np*st,behavior:'smooth'}); bookPaint(); }
function bookWire(){
  let x0=0,y0=0,t0=0,moved=false;
  rdBody.addEventListener('touchstart',e=>{ if(!book.on||e.touches.length!==1)return; x0=e.touches[0].clientX; y0=e.touches[0].clientY; t0=Date.now(); moved=false; },{passive:true});
  rdBody.addEventListener('touchend',e=>{ if(!book.on||!t0)return; const t=e.changedTouches[0], dx=t.clientX-x0, dy=t.clientY-y0; t0=0;
    if(Math.abs(dx)>45&&Math.abs(dx)>Math.abs(dy)*1.3){ moved=true; bookTurn(dx<0?1:-1); } },{passive:true});
  rdBody.addEventListener('click',e=>{ if(!book.on||moved){ moved=false; return; }
    if(e.target.closest('a,button,summary,input,.xref,.cite,.caseref,.statref'))return;
    const r=rdBody.getBoundingClientRect(), fx=(e.clientX-r.left)/r.width;
    if(fx<0.3)bookTurn(-1); else if(fx>0.7)bookTurn(1); else reader.classList.toggle('bare'); });
  rdBody.addEventListener('keydown',e=>{ if(!book.on)return; if(e.key==='ArrowRight'||e.key==='PageDown'||e.key===' '){ e.preventDefault(); bookTurn(1); } else if(e.key==='ArrowLeft'||e.key==='PageUp'){ e.preventDefault(); bookTurn(-1); } });
  new MutationObserver(()=>{ cancelAnimationFrame(book.raf); book.raf=requestAnimationFrame(bookApply); }).observe(rdBody,{childList:true});
  addEventListener('resize',()=>{ if(book.on)bookRelayout(); });
}
function closeReader(){$('#rdPrev').style.visibility='';$('#rdNext').style.visibility='';$('#rdJump').style.visibility='';reader.classList.add('hidden');reader.setAttribute('aria-hidden','true');}
function jumpPrompt(){
  const v=prompt('Go to: printed page (e.g. 272), absolute p.N (e.g. p1219), or V12:8 / SG:3 / ST:6 / PB:2');
  if(!v)return;
  const s=v.trim();
  let m=s.match(/^(SG|ST|PB|V12):?(\d+)$/i);
  if(m){const base={SG:143,ST:968,PB:985,V12:937}[m[1].toUpperCase()];openPage(base+ +m[2]);return;}
  m=s.match(/^p\.?\s*(\d+)$/i); if(m){openPage(+m[1]);return;}
  m=s.match(/^(\d+)$/);
  if(m){const p=+m[1];const abs=printedToAbs(p);openPage(abs);return;}
}
function printedToAbs(p){
  // labels map holds 'Pg N' -> find
  for(const[a,l]of Object.entries(META.labels))if(l==='Pg '+p)return +a;
  return Math.min(14+p,META.pages);
}
let curDoc=null;
// every downloadable document: a real Word file (.docx) — the title, then the text line for line in a ruled box
function downloadDoc(title,text){
  if(!window.GRDocs){ if(typeof toast==='function')toast('Download isn’t available — reload the app'); return; }
  const name=GRDocs.safeName(title)+'.docx';
  try{ GRDocs.save(GRDocs.textDoc(title,text),name); if(typeof toast==='function')toast('Saved '+name+' to your downloads'); }
  catch(e){ if(typeof toast==='function')toast('Couldn’t make the Word file on this phone'); }
}
function formatPage(txt){
  txt=txt.replace(/\*{1,}/g,'');
  // strip running headers
  let lines=txt.split('\n').filter(l=>!/^Garda Investigation Techniques\b/.test(l.trim()));
  // reflow: join hard-wrapped lines
  const joined=[];
  for(let raw of lines){
    const t=raw.trim();
    if(!t){joined.push('');continue;}
    const prev=joined.length?joined[joined.length-1]:'';
    const bullet=/^[•▪◦·–\-\*]\s+/.test(t)||/^\(?[a-z0-9ivx]{1,3}[\)\.]\s+[A-Za-z]/.test(t);
    const label=/^[A-Z][\w\s\/()'’&,–-]{1,42}:\s+\S/.test(t);
    if(prev&&!bullet&&!label&&!/[.!?:;]$/.test(prev)&&(prev.length>60||/^[a-z0-9]/.test(t))){
      joined[joined.length-1]=prev+' '+t;
    } else joined.push(t);
  }
  let html='',secOpen=false,firstHead=true,para=[],list=null;
  const flushP=()=>{if(para.length){
    // break giant blobs at sentence boundaries every ~3 sentences
    const full=para.join(' ').replace(/\s+/g,' ');
    const sents=[];{let cur='';for(let i=0;i<full.length;i++){cur+=full[i];
      if('.!?'.includes(full[i])&&full[i+1]===' '&&/[A-Z"“(]/.test(full[i+2]||'')){sents.push(cur);cur='';i++;}}
      if(cur.trim())sents.push(cur);}
    for(let i=0;i<sents.length;i+=3)html+='<p>'+linkify(sents.slice(i,i+3).join('').trim())+'</p>';
    para=[];}};
  const flushL=()=>{if(list){html+='<ul class="rlist">'+list.map(x=>'<li>'+linkify(x)+'</li>').join('')+'</ul>';list=null;}};
  const closeSec=()=>{flushP();flushL();if(secOpen){html+='</div></details>';secOpen=false;}};
  const isHead=t=>{
    if(t.length<3||t.length>110)return 0;
    if(/^(Chapter|Part|Section|Volume|Appendix)\s+[\dA-Z]/i.test(t)&&!/[.;]$/.test(t))return 1;
    if(/^\d+(\.\d+)+\s+\S/.test(t)&&!/[.;,]$/.test(t))return 1;
    if(t===t.toUpperCase()&&/[A-Z]{3}/.test(t)&&!/[.;]$/.test(t)&&t.length<80)return 1;
    if(/^[A-Z][A-Za-z\s\/()'’&,–-]{1,38}$/.test(t)&&t.split(' ').length<=5&&!/[.;,]$/.test(t))return 2;
    return 0;
  };
  for(const t of joined){
    if(!t){flushP();flushL();continue;}
    const h=isHead(t);
    if(h===1){closeSec();
      html+='<details class="rsec"'+(firstHead?' open':'')+'><summary>'+linkify(t)+'</summary><div class="rsecb">';
      secOpen=true;firstHead=false;continue;}
    if(h===2){flushP();flushL();html+='<div class="rsub">'+linkify(t)+'</div>';continue;}
    const box=t.match(/^(NOTE|WARNING|CAUTION|TIP|PRACTICAL|KEY POINT|IMPORTANT|REMEMBER|PRACTICE|GOLDEN RULE)\b/i);
    if(box){flushP();flushL();html+='<div class="rbox '+(/(WARN|CAUTION|IMPORTANT)/i.test(box[1])?'warn':'note')+'">'+linkify(t)+'</div>';continue;}
    const lm=t.match(/^([A-Z][\w\s\/()'’&,–-]{1,42}):\s+(\S.*)/);
    if(lm&&lm[1].split(' ').length<=6){flushP();flushL();html+='<div class="ddef"><b>'+linkify(lm[1])+':</b> '+linkify(lm[2])+'</div>';continue;}
    const bm=t.match(/^[•▪◦·–\-\*]\s+(.*)/)||(/^\(?[a-z0-9ivx]{1,3}[\)\.]\s+[A-Za-z]/.test(t)?[,t]:null);
    if(bm){flushP();if(!list)list=[];list.push(bm[1]||t);continue;}
    flushL();para.push(t);
  }
  closeSec();flushP();flushL();
  return html;
}
function linkify(txt){
  let h=esc(txt);
  h=h.replace(/\bp\.\s?(\d{1,4})\b/g,(m,n)=>+n<=META.pages?`<span class="xref" data-a="${n}">${m}</span>`:m);
  h=h.replace(/\b(V12|SG|ST|PB):(\d{1,2})\b/g,(m,k,n)=>{const base={SG:143,ST:968,PB:985,V12:937}[k];return `<span class="xref" data-a="${base+ +n}">${m}</span>`;});
  h=h.replace(/\bPage\s(\d{1,3})\b/g,(m,n)=>`<span class="xref" data-a="${printedToAbs(+n)}">${m}</span>`);
  h=h.replace(/\b(Facts|Held|Issue|Ruling|Test|Rule|Why it matters|Practice point|The point)(\s*[:—–])/g,'<b>$1</b>$2');
  h=h.replace(/\b(s\.?\s?\d+[A-Z]?(?:\(\d+\))?(?:\s(?:of the\s)?[A-Z][A-Za-z\s]{2,40}Act\s(?:19|20)\d{2})?)/g,'<b class="statref">$1</b>');
  h=h.replace(/\b([A-Z][A-Za-z\'’\-]+(?:\s\([A-Z]{2,3}\))?\sv\.?\s[A-Z][A-Za-z\'’\-]+(?:\s[A-Z][A-Za-z\'’\-]+)?)/g,'<i class="caseref">$1</i>');
  return h;
}
function stripMd(t){return String(t).replace(/\*{1,3}|_{2,}|^#+\s/gm,'');}
function esc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}

/* ---------- always-on 24h clock + date (covert HUD) — fills every .hudclock ---------- */
(function(){
  const DAYS=['SUN','MON','TUE','WED','THU','FRI','SAT'], MON=['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
  const p=n=>String(n).padStart(2,'0');
  function tick(){
    const d=new Date(), t=p(d.getHours())+':'+p(d.getMinutes())+':'+p(d.getSeconds());
    const ds=DAYS[d.getDay()]+' '+p(d.getDate())+' '+MON[d.getMonth()]+' '+d.getFullYear();
    const hm=t.slice(0,5);
    document.querySelectorAll('.hudclock').forEach(el=>{
      const f=el.dataset.f;
      const h=f==='line'?'<b>'+hm+'</b> · '+ds : f==='hm'?'<b>'+hm+'</b>' : f==='t'?hm : f==='d'?ds : f==='sec'?'<b>'+t+'</b><small>'+ds+'</small>'
        : '<b>'+hm+'</b><small>'+(f==='noyear'?ds.slice(0,-5):ds)+'</small>';
      if(el._h!==h){el.innerHTML=h;el._h=h;}
    });
  }
  tick(); setInterval(tick,250); window.grHudTick=tick;   // 4×/s so new screens never show a blank clock
  window.grToast=function(m){let t=document.getElementById('osToast');if(!t){t=document.createElement('div');t.id='osToast';document.body.appendChild(t);}
    t.textContent=m;t.className='show';clearTimeout(t._h);t._h=setTimeout(()=>t.className='',3200);};
})();

/* ---------- phone Back button → previous screen (closes the top layer; never drops you out mid-task) ---------- */
(function(){
  const vis=el=>!!el&&!el.classList.contains('hidden')&&getComputedStyle(el).display!=='none';
  const clk=sel=>{const b=document.querySelector(sel); if(b){b.click(); return true;} return false;};
  function closeTop(){
    if(document.getElementById('boot'))return true;                       // opening screen: stay put
    if(window.lockBack&&window.lockBack())return true;                     // lock screen or its settings
    if(homeEdit){ homeEditDone(); return true; }                            // customising Home: Back = Done
    { const d=document.getElementById('dsp'); if(d&&!d.classList.contains('hidden')){ d.classList.add('hidden'); return true; } }
    for(const id of ['mStory','mTV','mRadio']){ const el=document.getElementById(id); if(vis(el)){ el.querySelector('.m-x').click(); return true; } }
    if(window.faBack&&window.faBack())return true;                        // first aid: step/CPR → list → closed
    if(window.prsBack&&window.prsBack())return true;                      // present to TV: blank → show → grid → closed
    if(window.scnBack&&window.scnBack())return true;                      // scanner: sheet → crop/enhance → pages → camera → closed
    if(window.recBack&&window.recBack())return true;                      // recorder: sheet → player → list → closed
    if(window.detBack&&window.detBack())return true;                      // detention clock: desk → sheet → clock → list → closed
    if(window.gaolBack&&window.gaolBack())return true;                    // gaoler: desk → sheet → closed
    if(window.ppBack&&window.ppBack())return true;                        // proactive patrol: pocket → sheet → detail → list → closed
    if(window.tskBack&&window.tskBack())return true;                      // tasks: sheet → editor → list → closed
    if(window.rstBack&&window.rstBack())return true;                      // roster: sheet → wizard step → main → closed
    if(window.ntsBack&&window.ntsBack())return true;
    if(window.socBack&&window.socBack())return true;                      // social media → closed                      // notes: sheet → sketch → editor → list → closed
    if(window.tbxBack&&window.tbxBack())return true;                      // toolbox: tool → grid → closed
    const reel=document.getElementById('osReel');
    if(vis(reel)){ const gv=document.getElementById('reelGridView');
      if(gv&&gv.classList.contains('hidden'))clk('#reelGridBtn'); else clk('#reelClose'); return true; }   // reel → list → closed
    if(vis(document.getElementById('dccList'))) return clk('#dclClose');
    const osint=document.getElementById('osint');
    if(vis(osint)){ if(window.osPhotoOpen&&window.osPhotoOpen()){ window.osPhotoClose(); return true; }
      const p=document.getElementById('osPanel');
      if(vis(p)){ if(!clk('#osPanel #ospClose'))p.classList.add('hidden'); return true; }
      if(window.closeOSINT){ closeOSINT(); return true; } }
    if(!reader.classList.contains('hidden')){ closeReader(); return true; }
    if(window.GRSearch&&GRSearch.back&&GRSearch.back())return true;          // search: key sheet → AI thread
    if(vcur){                                                               // sub-view → the screen before it → the tab
      if(vstack.length){ const p=vstack.pop(); vcur=null; const fn=window[p.f]; if(typeof fn==='function'){ fn.apply(null,p.a); view.scrollTop=p.y||0; } return true; }
      vcur=null; render(); return true; }
    if(tab!=='search'){ goHome(); return true; }
    if(lastQuery){ lastQuery=''; render(); view.scrollTop=0; return true; }
    if(view.scrollTop>40){ view.scrollTo({top:0,behavior:'smooth'}); return true; }
    return false;
  }
  window.grBack=()=>closeTop();
  try{ history.replaceState({gr:'base'},''); history.pushState({gr:'guard'},''); }catch(e){}
  let armed=false, leaving=false;
  addEventListener('popstate',()=>{
    if(leaving)return;
    if(closeTop()){ armed=false; history.pushState({gr:'guard'},''); return; }
    if(!armed){ armed=true; history.pushState({gr:'guard'},''); if(window.grToast)grToast('Press back again to exit'); setTimeout(()=>{armed=false;},2500); return; }
    leaving=true; history.back();                                          // second Back within 2.5 s → close the app
  });
})();
