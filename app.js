/* Garda Reference PWA — offline, no case data, no analytics */
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
  $('#verinfo').textContent='v'+META.version+' · content '+META.built+' · '+META.pages+' pp';
  bindUI(); render();
  loadAllChunks(); // background; SW caches for offline
})();

async function loadAllChunks(){
  if(chunksLoading) return; chunksLoading=true;
  let done=0, total=META.chunks.length;
  const st=$('#loadState');
  for(const c of META.chunks){
    try{ CHUNKS[c.f]=await fetch(c.f).then(r=>r.json()); }
    catch(e){ st.textContent='Load failed — retry online'; chunksLoading=false; return; }
    done++; st.textContent='Loading '+done+'/'+total;
    if(tab==='search'&&lastQuery) doSearch(lastQuery,lastFilter,true);
  }
  chunksReady=true; st.textContent='All content ✓ offline'; st.classList.add('ok');
  setTimeout(()=>{st.textContent='Offline ✓';},2500);
}

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
function updateDlBtn(){const d=$('#rdDl');if(d)d.style.display=curDoc?'':'none';}
function bindUI(){
  applyFS();
  const top=document.querySelector('.rd-top');
  if(top){
    top.insertAdjacentHTML('beforeend','<div id="rdProg"></div>');
    const star=$('#rdStar');
    star.insertAdjacentHTML('beforebegin','<button id="rdDl" class="iconbtn" title="Download as Word" aria-label="Download Word document" style="display:none">⬇</button>');
    $('#rdDl').addEventListener('click',()=>{if(curDoc)downloadDoc(curDoc.title,curDoc.text);});
    rdBody.addEventListener('scroll',()=>{const el=rdBody;const max=el.scrollHeight-el.clientHeight;
      const p=max>0?(el.scrollTop/max*100):0;const bar=$('#rdProg');if(bar)bar.style.width=p+'%';},{passive:true});
  }
  $('#loadState').insertAdjacentHTML('beforebegin','<button id="fsBtn" title="Text size — tap to zoom" aria-label="Text size"><svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="13.5" cy="13.5" r="9.5"/><path d="m20.5 20.5 8 8"/><text x="13.5" y="18" text-anchor="middle">A</text></svg></button>');
  $('#fsBtn').addEventListener('click',()=>{const o=['s','m','l','xl'],c=localStorage.getItem('gr_fs')||'m';
    const n=o[(o.indexOf(c)+1)%o.length]; localStorage.setItem('gr_fs',n);applyFS();
    const t=document.getElementById('osToast')||null; if(window.grToast)grToast('Text size: '+({s:'small',m:'normal',l:'large',xl:'extra large'})[n]);});
  $$('#tabbar .tab').forEach(b=>b.addEventListener('click',()=>{
    tab=b.dataset.tab; $$('#tabbar .tab').forEach(x=>x.classList.toggle('active',x===b));
    closeReader(); render(); view.scrollTop=0;
  }));
  $('#brandBtn').addEventListener('click',()=>{tab='search';$$('#tabbar .tab').forEach(x=>x.classList.toggle('active',x.dataset.tab==='search'));closeReader();render();});
  $('#rdBack').addEventListener('click',closeReader);
  $('#rdPrev').addEventListener('click',()=>openPage(Math.max(1,curPage-1)));
  $('#rdNext').addEventListener('click',()=>openPage(Math.min(META.pages,curPage+1)));
  $('#rdJump').addEventListener('click',jumpPrompt);
  $('#rdStar').addEventListener('click',toggleFav);
  document.addEventListener('keydown',e=>{ if(!reader.classList.contains('hidden')){ if(e.key==='ArrowLeft')openPage(Math.max(1,curPage-1)); if(e.key==='ArrowRight')openPage(Math.min(META.pages,curPage+1)); if(e.key==='Escape')closeReader(); }});
}

function render(){
  if(tab==='search')renderSearch();
  else if(tab==='browse')renderBrowse();
  else if(tab==='index')renderIndex();
  else if(tab==='tools')renderTools();
  else renderSaved();
}

/* ---------- SEARCH ---------- */
const FILTERS=[['all','Everything'],['vols','Vols 1–11'],['v12','Vol 12'],['st','Statements'],['pb','Playbooks'],['man','2007 Manual']];
const FRANGE={vols:[15,937],v12:[938,968],st:[969,992],pb:[986,992],man:[993,1478]};
function renderSearch(){
  view.innerHTML=`
  <div class="searchbox sb-mag"><svg class="sb-ico" viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 5 5"/></svg><input id="q" type="search" placeholder="Search — topic, case, statute, offence…" value="${esc(lastQuery)}" autocomplete="off" enterkeyhint="search"></div>
  <div id="results"></div>`;
  const q=$('#q'); let t;
  q.addEventListener('input',()=>{clearTimeout(t);t=setTimeout(()=>doSearch(q.value,lastFilter),200);});
  q.addEventListener('keydown',e=>{if(e.key==='Enter'){q.blur();doSearch(q.value,lastFilter);}});
  lastFilter='all';
  if(lastQuery)doSearch(lastQuery,lastFilter,true); else homeQuick();
}
function homeQuick(){
  const lp=+localStorage.getItem('gr_lastpage')||0;
  const nCases=(CASES&&CASES.length)||0;
  const nGuides=(G3&&G3.length)||0;
  const online=navigator.onLine;
  let recent=[]; try{recent=JSON.parse(localStorage.getItem('gr_recent')||'[]');}catch(e){}
  // Recent + Continue reading, merged: the page you were reading comes first, then your latest items (2 rows max)
  let rows=recent.slice();
  if(lp){ rows=rows.filter(r=>!(r.k!=='guide'&&+r.id===lp)); rows.unshift({k:'page',id:lp,t:'▶ '+titleFor(lp),s:pageLabel(lp)+' · continue reading',ts:0,cont:1}); }
  const recentHtml = rows.length? `<h2 class="sec">↺ Recent</h2><div class="recentwrap">`+
    rows.slice(0,2).map(r=>`<button class="recentrow${r.cont?' cont':''}" data-k="${r.k}" data-id="${esc(String(r.id))}"><div class="rr-t">${esc(r.t)}</div><div class="rr-s">${esc(r.s)}</div><div class="rr-time">${r.cont?'':relTime(r.ts)}</div></button>`).join('')+`</div>` : '';
  $('#results').innerHTML=`
  <div id="homeRoster"></div>
  <div id="homeDet"></div>
  <div id="homeTasks"></div>
  <div id="homeNews"></div>
  ${recentHtml}

  <button class="qbtn osintHero" id="hOsint">🗺️ Map<small>stations · districts · cameras · DCC CCTV · Street View pin · draw & measure — you choose what's on</small></button>
  <button class="qbtn osintHero tbxHero" id="hTools">🧰 Toolbox<small>ruler · measure with evidence photo · evidence camera · level · compass · torch · timers · 21 tools</small></button>
  <h2 class="sec">📹 Live cameras <span class="livepip">● LIVE</span></h2><div class="quick">
    <button class="qbtn camHero" id="hCamDist">📷 Fitzgibbon St / Mountjoy<small>street cams · your district + north city</small></button>
    <button class="qbtn camHero" id="hCamM50">🛣️ M50 motorway<small>every TII camera · J3 → J17</small></button>
    <button class="qbtn camHero" id="hCamPort">⚓ Dublin Port<small>ships · Liffey · Poolbeg</small></button>
    <button class="qbtn camHero" id="hCamAll">🎥 All cameras<small>organised list · M1 · N4 · N7 too</small></button>
    <button class="qbtn dccHero" id="hDccList">🗂️ DCC City CCTV list<small>241 Dublin City Council cameras · search a street → pinpoint it on the map · locations only, no live feed</small></button>
  </div>

  <h2 class="sec">📡 Live TV & radio</h2><div class="quick">
    <button class="qbtn camHero" id="hLiveNews">📺 Live news<small>Sky News live · RTÉ News latest · in the app</small></button>
    <button class="qbtn camHero" id="hRadio">📻 Irish radio<small>favourites · RTÉ · Newstalk · 98 · FM104 · all</small></button>
  </div>

  <h2 class="sec">⚡ On the job</h2><div class="quick">
    <button class="qbtn" id="qbOff">📕 Offences<small>elements · arrest · statement</small></button>
    <button class="qbtn" id="hClock">⏱ Detention clock<small>deadlines · extensions · alerts</small></button>
    <button class="qbtn" id="hCaution">⚠️ Cautions<small>wording · declarations</small></button>
    <button class="qbtn" id="hScene">🚔 First at scene<small>golden hour</small></button>
  </div>

  <h2 class="sec">🗂️ My work</h2><div class="quick">
    <button class="qbtn" id="hRoster">🗓️ My roster<small>today · next tour · leave · court · swaps</small></button>
    <button class="qbtn" id="hTasks">✅ Tasks<small>CCTV · statements · nights · deadlines</small></button>
    <button class="qbtn" id="hNotes">📓 Notes<small>sketches · photos · checklists · lock</small></button>
    <button class="qbtn" id="hRec">🎙️ Voice recorder<small>markers · crash-safe · stays on phone</small></button>
    <button class="qbtn" id="hScan">📄 Scanner<small>documents → PDF · saved to phone only</small></button>
    <button class="qbtn" id="hPres">📺 Present to TV<small>photos & CCTV on the TV · Smart View · DeX</small></button>
  </div>

  <h2 class="sec">🔎 In-depth investigation guides</h2><div class="quick">
    <button class="qbtn" id="hAssault">👊 Assault<small>scene · evidence · trial · case law</small></button>
    <button class="qbtn" id="hRobbery">🔪 Robbery from person<small>force · ID · continuing act</small></button>
    <button class="qbtn" id="hBurglary">🏠 Burglary<small>entry forensics · recent possession</small></button>
    <button class="qbtn" id="hTheft">💰 Theft & handling<small>dishonesty · claim of right</small></button>
    <button class="qbtn" id="hDrugs2">💊 Drugs prosecutions<small>MDA · s.23 · s.26 warrants</small></button>
    <button class="qbtn" id="hImm">🛂 Immigration<small>status · smuggling · trafficking</small></button>
  </div>

  <h2 class="sec">⚖️ Law & authority</h2><div class="quick">
    <button class="qbtn" id="qbEss">★ Essential case law<small>the ones that changed everything</small></button>
    <button class="qbtn" id="qbCases">📚 Full case library<small>383 cases, categorised</small></button>
    <button class="qbtn" id="hBail">🔒 Objecting to bail<small>O'Callaghan · s.2 · burglary presumption</small></button>
    <button class="qbtn" id="hOcall">📋 O'Callaghan worksheet<small>systematic objection</small></button>
    <button class="qbtn" id="hBailpack">⚖️ Bail pack<small>case-manager worksheet</small></button>
    <button class="qbtn" id="hAmend">🆕 Recent amendments<small>new laws by area — verify</small></button>
    <button class="qbtn" id="hJudg">◉ Latest judgments<small>BAILII — Supreme · Appeal · High</small></button>
    <button class="qbtn" id="hCourtLists">🗓️ Court lists<small>CCJ & all Dublin courts — today</small></button>
  </div>

  <h2 class="sec">📝 Files & paperwork</h2><div class="quick">
    <button class="qbtn" id="hGuides">Statement guides<small>per offence</small></button>
    <button class="qbtn" id="hSten">📄 Stencils<small>your templates</small></button>
    <button class="qbtn" id="hTpl">📧 Templates<small>CCTV · s.41 · agency</small></button>
    <button class="qbtn" id="hPrecis">📑 Précis of evidence<small>build it to win</small></button>
  </div>

  <h2 class="sec">📖 Deep guides</h2><div class="quick">
    <button class="qbtn" id="hPO">🚨 Public order<small>s.6 & s.8</small></button>
    <button class="qbtn" id="hAffray">⚔️ Affray<small>investigation guide</small></button>
    <button class="qbtn" id="hClamp">🚗 Clamping & s.41<small>public clamping · seizure · rogue clampers</small></button>
    <button class="qbtn" id="hIplan">🎙️ Interview plan<small>stencil</small></button>
    <button class="qbtn" id="hDrugs">💊 Drugs prosecutions<small>MDA · s.23 · s.26 warrants</small></button>
    <button class="qbtn" id="hRare">📜 Rare offences<small>niche statutes</small></button>
    <button class="qbtn" id="hDeep">📚 All deep guides<small>search · weapons · RTC · MP</small></button>
  </div>

  <h2 class="sec">📗 The manual</h2><div class="quick">
    <button class="qbtn" data-go="986">Playbooks<small>5-part per offence</small></button>
    <button class="qbtn" data-go="955">Inference aide<small>ss.18/19/19A</small></button>
    <button class="qbtn" data-go="975">ADVOKATE<small>identification</small></button>
    <button class="qbtn" data-go="941">Cross-exam<small>surviving the stand</small></button>
    <button class="qbtn" data-go="945">Law of evidence<small>V12 Part B</small></button>
    <button class="qbtn" data-go="144">Assault statements<small>s.2 / s.3 guide</small></button>
    <button class="qbtn" id="hLang">⚖️ Latin & acronyms<small>ABC · MMO · PEACE</small></button>
    <button class="qbtn" id="hCourt">👨‍⚖️ Court-day mode<small>everything for the stand</small></button>
  </div>
  <div class="empty">Or type anything above — all 1,478 pages are searchable.</div>`;

  $$('#results .recentrow').forEach(b=>b.addEventListener('click',()=>{
    const k=b.dataset.k, id=b.dataset.id;
    if(k==='guide')openGuide3(id); else openPage(+id);
  }));
  const go=(id,fn)=>{const b=$('#'+id); if(b)b.addEventListener('click',fn);};
  go('qbOff',()=>renderOffences());
  go('qbEss',renderEssentials);
  go('qbCases',()=>{ixKind='case';tab='index';$$('#tabbar .tab').forEach(x=>x.classList.toggle('active',x.dataset.tab==='index'));render();});
  go('hClock',()=>{ if(window.openDetention) openDetention(); else renderClock(); });
  go('hCaution',renderCautions);
  go('hScene',renderMajor);
  go('hOsint',()=>{ if(window.openOSINT) window.openOSINT(); });
  go('hCamDist',()=>{ if(window.openCamReel) window.openCamReel(0,'district',true); });
  go('hCamM50',()=>{ if(window.openCamReel) window.openCamReel(0,'m50',true); });
  go('hCamPort',()=>{ if(window.openCamReel) window.openCamReel(0,'port',true); });
  go('hCamAll',()=>{ if(window.openCamReel) window.openCamReel(0,null,true); });
  go('hDccList',()=>{ if(window.openDccList) window.openDccList(); });
  go('hTools',()=>{ if(window.openToolbox) window.openToolbox(); });
  go('hLiveNews',()=>{ if(window.GRMedia) GRMedia.openTV('sky'); });
  go('hRadio',()=>{ if(window.GRMedia) GRMedia.openRadio(); });
  if(window.GRDet) GRDet.mountStrip($('#homeDet'));
  if(window.GRRoster) GRRoster.mountStrip($('#homeRoster'));
  if(window.GRTasks) GRTasks.mountStrip($('#homeTasks'));
  go('hRoster',()=>{ if(window.openRoster) openRoster(); });
  go('hTasks',()=>{ if(window.openTasks) openTasks(); });
  go('hNotes',()=>{ if(window.openNotes) openNotes(); });
  go('hRec',()=>{ if(window.openRecorder) openRecorder(); });
  go('hScan',()=>{ if(window.openScanner) openScanner(); });
  go('hPres',()=>{ if(window.openPresent) openPresent(); });
  if(window.GRMedia) GRMedia.mountNewsStrip($('#homeNews'));
  go('hBail',()=>openGuide3('bail'));
  go('hOcall',()=>openGuide3('ocall'));
  go('hBailpack',()=>openTemplate(TPL.findIndex(t=>t.id==='bailpack')));
  go('hDrugs',()=>openGuide3('drugs'));
  go('hAssault',()=>openGuide3('assault_inv'));
  go('hRobbery',()=>openGuide3('robbery_inv'));
  go('hBurglary',()=>openGuide3('burglary_inv'));
  go('hTheft',()=>openGuide3('theft_inv'));
  go('hDrugs2',()=>openGuide3('drugs'));
  go('hImm',()=>openGuide3('immigration_inv'));
  go('hRare',()=>openGuide3('rare'));
  go('hPrecis',()=>openGuide3('precis2'));
  go('hPO',()=>openGuide3('po'));
  go('hAffray',()=>openGuide3('affray'));
  go('hClamp',()=>openGuide3('clamping'));
  go('hIplan',()=>openGuide3('iplan'));
  go('hAmend',()=>openGuide3('amendments'));
  go('hJudg',renderJudgments);
  go('hCourtLists',renderCourtLists);
  go('hGuides',()=>renderGuides());
  go('hSten',renderStencils);
  go('hTpl',renderTemplates);
  go('hDeep',()=>renderDeep());
  go('hLang',renderLang);
  go('hCourt',renderCourtDay);
  $$('#results .qbtn[data-go]').forEach(b=>b.addEventListener('click',()=>openPage(+b.dataset.go)));
}
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
  $('#rdTitle').textContent=g.icon+' '+g.t; $('#rdPage').textContent='Guide';
  $('#rdFlag').classList.add('hidden');$('#rdStar').textContent='☆';
  $('#rdPrev').style.visibility='hidden';$('#rdNext').style.visibility='hidden';$('#rdJump').style.visibility='hidden';
  curDoc={title:g.t,text:g.b}; rdBody.innerHTML=formatPage(g.b); applyRdScale(); rdBody.scrollTop=0; updateDlBtn();
}
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
      const abs=ch.s+i; if(abs<range[0]||abs>range[1])continue;
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
      if(ok)hits.push({abs,score,first,txt:ch.pages[i]});
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
  tab='search';
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
    lastQuery=b.dataset.q;doSearch(lastQuery,'all');$('#q').value=lastQuery;}));
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
    if(c.f.held)h+='<div class="rbox warn" style="background:#f7efd7;border-left-color:var(--gold)"><b>Held:</b> '+esc(c.f.held)+'</div>';}
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
  $('#oSearch').addEventListener('click',()=>{tab='search';renderSearch();$('#q').value=short;doSearch(short,'all');});
  $('#oCases').addEventListener('click',()=>{window.caseCat='All';tab='index';ixKind='case';$$('#tabbar .tab').forEach(x=>x.classList.toggle('active',x.dataset.tab==='index'));caseQ=short.split(' ')[0];render();});
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
  view.innerHTML='<h2 class="sec">Browse the full reference</h2><div id="tree"></div>';
  const root=$('#tree');
  META.tree.forEach(n=>root.appendChild(treeNode(n,0)));
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

/* ---------- INDEXES ---------- */
let ixKind='topic';
function renderIndex(){
  view.innerHTML=`<div class="chips" style="padding-top:2px">
    <button class="chip ${ixKind==='topic'?'on':''}" data-k="topic">Topics</button>
    <button class="chip ${ixKind==='case'?'on':''}" data-k="case">Case law</button>
    <button class="chip ${ixKind==='statute'?'on':''}" data-k="statute">Statutes</button>
    <button class="chip ${ixKind==='all'?'on':''}" data-k="all">All A–Z</button></div>
  <div class="alpharail" id="rail"></div><div id="ixlist"></div>`;
  $$('.chip').forEach(c=>c.addEventListener('click',()=>{ixKind=c.dataset.k;renderIndex();}));
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
    let items=CASES.filter(c=>!q||c.n.toLowerCase().includes(q)||c.c.join(' ').toLowerCase().includes(q)||(c.d||'').toLowerCase().includes(q));
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
      lastQuery=b.dataset.n.replace(/^(The\s)?(People\s\((DPP|AG)\)|DPP)\sv\s/i,'').trim(); lastFilter='all';
      tab='search'; $$('#tabbar .tab').forEach(x=>x.classList.toggle('active',x.dataset.tab==='search')); render();
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
function renderTools(){
  view.innerHTML=`<h2 class="sec">Tools</h2><div class="toolmenu">
    <button class="tmenu" data-v="toolbox"><b>🧰 Toolbox</b><small>ruler · measure · evidence camera · level · compass · torch · timers · QR · more</small></button>
    <button class="tmenu" data-v="roster"><b>🗓️ My roster</b><small>your shift pattern · today & next tour · leave, court, swaps, overtime</small></button>
    <button class="tmenu" data-v="tasks"><b>✅ Tasks</b><small>to-do scheduler — CCTV · statements · nights · deadlines · reminders</small></button>
    <button class="tmenu" data-v="notes"><b>📓 Notes</b><small>notes like Samsung Notes — sketches · photos · checklists · lock</small></button>
    <button class="tmenu" data-v="rec"><b>🎙️ Voice recorder</b><small>record with markers — kept on this phone only</small></button>
    <button class="tmenu" data-v="scan"><b>📄 Document scanner</b><small>flatten · clean up · multi-page PDF saved to your phone</small></button>
    <button class="tmenu" data-v="pres"><b>📺 Present to TV</b><small>show photos & CCTV clips via Smart View / DeX / cast</small></button>
    <button class="tmenu" data-v="clock"><b>⏱ Detention clock</b><small>s.4 · s.30 · DTA 1996 · s.50 — extensions, excluded periods, alerts</small></button>
    <button class="tmenu" data-v="ptp"><b>Points to prove</b><small>20 offence cards — elements & arrest power</small></button>
    <button class="tmenu" data-v="guides"><b>📝 Statement guides</b><small>what to capture, per offence</small></button>
    <button class="tmenu" data-v="sten"><b>📄 My stencils</b><small>your templates — tap to copy</small></button>
    <button class="tmenu" data-v="checks"><b>✓ Checklists</b><small>scene · arrest · warrant · exhibits · interview · ID</small></button>
    <button class="tmenu" data-v="major"><b>🚨 Major incident</b><small>first response · golden hour</small></button>
    <button class="tmenu" data-v="caution"><b>🗣 Caution & declarations</b><small>questioning · statement declarations · case law</small></button>
    <button class="tmenu" data-v="exhibits"><b>📦 Exhibits builder</b><small>SMG1–99 · continuity · copy for report</small></button>
    <button class="tmenu" data-v="cctv"><b>📧 CCTV preservation</b><small>generate request text</small></button>
    <button class="tmenu" data-v="weapons"><b>🔪 Weapons & knives</b><small>offences · search · seizure</small></button>
    <button class="tmenu" data-v="searches"><b>🔍 Searches</b><small>powers & what to say</small></button>
    <button class="tmenu" data-v="rtc"><b>🚗 Traffic collision</b><small>investigation guide</small></button>
    <button class="tmenu" data-v="escooter"><b>🛴 E-scooters</b><small>status · charges · collisions</small></button>
    <button class="tmenu" data-v="seizure"><b>📦 Seizure powers</b><small>quick reference</small></button>
    <button class="tmenu" data-v="latin"><b>📜 Latin & legal terms</b><small>meaning & Garda use</small></button>
    <button class="tmenu" data-v="acronyms"><b>🔤 Acronyms</b><small>ABC · MMO · ADVOKATE …</small></button>
    <button class="tmenu" data-v="cautions"><b>⚠️ Cautions & declarations</b><small>caution wording · pre-caution questioning · declarations</small></button>
    <button class="tmenu" data-v="tpl"><b>📧 Templates & forms</b><small>CCTV preservation · s.41 DP · passport · welfare · blank forms</small></button>
    <button class="tmenu" data-v="lang"><b>⚖️ Latin & acronyms</b><small>legal terms · ABC · MMO · ADVOKATE · PEACE</small></button>
    <button class="tmenu" data-v="guides2"><b>📚 Deep guides</b><small>searches · weapons · RTC & e-scooters · précis · missing person</small></button>
    <button class="tmenu" data-v="judg"><b>◉ Latest judgments</b><small>Supreme · Appeal · High Court — live from BAILII</small></button>
    <button class="tmenu" data-v="courtlists"><b>🗓️ Court lists — who's on</b><small>CCJ & all Dublin courts — official Legal Diary</small></button>
  </div>`;
  $$('.tmenu').forEach(b=>b.addEventListener('click',()=>{
    const v=b.dataset.v;
    if(v==='toolbox'){ if(window.openToolbox) openToolbox(); return; }
    if(v==='tasks'){ if(window.openTasks) openTasks(); return; }
    if(v==='roster'){ if(window.openRoster) openRoster(); return; }
    if(v==='notes'){ if(window.openNotes) openNotes(); return; }
    if(v==='rec'){ if(window.openRecorder) openRecorder(); return; }
    if(v==='scan'){ if(window.openScanner) openScanner(); return; }
    if(v==='pres'){ if(window.openPresent) openPresent(); return; }
    if(v==='clock'){ if(window.openDetention){ openDetention(); return; } tab='search';renderSearch();renderClock();}
    else if(v==='ptp'){tab='search';renderSearch();renderPTP();}
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
function kbHead(t){return `<button class="chip" id="backT" style="margin-bottom:8px">‹ Tools</button><h2 class="sec">${esc(t)}</h2>`;}
function cardHTML(c){return `<div class="tool"><h3>${esc(c.h)}</h3><div style="font-size:13.5px;line-height:1.55">${esc(c.body)}</div>`+(c.tag?'':'')+`</div>`;}
function copyBtn(txt,label){const id='cp'+Math.random().toString(36).slice(2,7);
  setTimeout(()=>{const b=document.getElementById(id);if(b)b.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(txt);b.textContent='✓ Copied';}catch(e){b.textContent='Copy failed';}});},0);
  return `<button class="csall" id="${id}">⧉ ${label||'Copy'}</button>`;}
function renderCaution(){
  const K=KB.caution;
  let h=kbHead('🗣 '+K.t)+`<div class="rbox note">${esc(K.intro)}</div>`;
  h+=K.cards.map(c=>`<div class="tool"><h3>${esc(c.h)}</h3><div style="font-size:13.5px;line-height:1.55">${esc(c.body)}</div>${copyBtn(c.body,'Copy text')}</div>`).join('');
  h+='<h2 class="sec">Related case law — know before you caution</h2>';
  h+=K.cases.map(c=>`<button class="hit" data-n="${esc(c.n)}"><div class="h-title"><i>${esc(c.n)}</i></div><div class="h-snip" style="color:var(--ink)">${esc(c.p)}</div></button>`).join('');
  view.innerHTML=h;wireBack();
  $$('#view .hit').forEach(b=>b.addEventListener('click',()=>{const c=CASES.find(x=>x.n===b.dataset.n);if(c)openCase(c.n);else{lastQuery=b.dataset.n;tab='search';$$('#tabbar .tab').forEach(x=>x.classList.toggle('active',x.dataset.tab==='search'));render();}}));
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
    $('#cvOut').innerHTML='<div class="tool"><h3>Preservation request</h3><div style="font-size:13px;white-space:pre-wrap;line-height:1.5">'+esc(body)+'</div>'+copyBtn(body,'Copy request')+'</div>'
      +'<div class="tool"><h3>Reminder — s.41B parallel step</h3><div style="font-size:13px;line-height:1.5">Raise the s.41B Data Protection Act 2018 request on your official Garda email and forward to the District Office for the Superintendent\'s signature. Do this yourself through Garda systems — never through this app.</div></div>';
    document.querySelectorAll('#cvOut .csall').forEach(b=>{});
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
  document.addEventListener('touchend',()=>{d0=null;},{passive:true});
})();
function wireBack(){const b=$('#backT');if(b)b.addEventListener('click',()=>{tab='tools';render();});}
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
async function renderJudgments(court){
  court=court||'ALL';
  const TABS=[['ALL','All'],['IESC','Supreme'],['IECA','Appeal'],['IEHC','High Court']];
  view.innerHTML=`<button class="chip" id="backT" style="margin-bottom:8px">‹ Tools</button>
  <h2 class="sec">◉ Latest judgments — live from BAILII</h2>
  <div class="chips">${TABS.map(([k,l])=>`<button class="chip ${k===court?'on':''}" data-c="${k}">${l}</button>`).join('')}</div>
  <div id="jout" class="empty">Loading from bailii.org…</div>`;
  wireBack();
  $$('#view .chip[data-c]').forEach(c=>c.addEventListener('click',()=>renderJudgments(c.dataset.c)));
  const out=$('#jout');
  const parseJ=t=>{
    const cite=(t.match(/\[(?:19|20)\d{2}\]\s+IE[A-Z]{2,4}\s+\d+/)||[])[0]||'';
    const dm=t.match(/\((\d{1,2}\s+[A-Za-z]+\s+(?:19|20)\d{2})\)\s*$/);
    const date=dm?dm[1]:'';
    const name=t.replace(/\s*\(\d{1,2}\s+[A-Za-z]+\s+(?:19|20)\d{2}\)\s*$/,'').replace(/\s*\[(?:19|20)\d{2}\]\s+IE[A-Z]{2,4}\s+\d+.*$/,'').replace(/\s*\(Approved\)\s*(\(Rev\d*\))?/i,'').trim();
    return {name,cite,date,ts:(Date.parse(date)||0)};
  };
  try{
    if(!window._bailii){
      const target='https://www.bailii.org/recent-accessions-ie.html';
      const proxies=[u=>'https://api.allorigins.win/raw?url='+encodeURIComponent(u),u=>'https://corsproxy.io/?url='+encodeURIComponent(u),u=>'https://api.codetabs.com/v1/proxy?quest='+encodeURIComponent(u)];
      for(const p of proxies){
        try{const r=await fetch(p(target));if(r.ok){const t=await r.text();if(t.includes('/ie/cases/')){window._bailii=t;break;}}}catch(e){}
      }
      if(!window._bailii)throw new Error('feed unavailable');
    }
    const re=/<a href="(\/ie\/cases\/([A-Z]+)\/[^"]+)">([^<]+)<\/a>/g;
    const want=court==='ALL'?['IESC','IECA','IEHC']:[court];
    const items=[];let m;const seen=new Set();
    while((m=re.exec(window._bailii))!==null){
      if(!want.includes(m[2]))continue;
      if(seen.has(m[1]))continue; seen.add(m[1]);
      const p=parseJ(m[3]); p.u='https://www.bailii.org'+m[1]; p.court=m[2];
      items.push(p);
      if(items.length>200)break;
    }
    if(!items.length)throw new Error('none found');
    items.sort((a,b)=>b.ts-a.ts);
    const CN={IESC:'Supreme',IECA:'Appeal',IEHC:'High Court'};
    out.className='';
    out.innerHTML=items.slice(0,40).map(it=>`<button class="hit jlink" data-u="${it.u}">
       <div class="h-title" style="font-weight:600"><i>${esc(it.name)}</i></div>
       <div class="h-loc">${court==='ALL'?'<b style="color:var(--gold)">'+CN[it.court]+'</b> · ':''}${esc(it.cite||'')}${it.date?' · '+esc(it.date):''}</div></button>`).join('')
      +'<div class="toolnote">Newest first, fetched live via a public relay — needs signal. Tap to open the full judgment on bailii.org.</div>';
    $$('.jlink').forEach(b=>b.addEventListener('click',()=>window.open(b.dataset.u,'_blank')));
  }catch(e){
    out.innerHTML='Feed unavailable (signal or relay down). <button class="csall" id="jopen">Open BAILII recent Irish decisions</button>';
    $('#jopen').addEventListener('click',()=>window.open('https://www.bailii.org/recent-accessions-ie.html','_blank'));
  }
}
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
  let html='<h2 class="sec">Saved sections</h2>';
  if(!favs.length)html+='<div class="empty">Nothing saved. Open any page and tap ★.<br>Only section references are stored — never case data.</div>';
  favs.forEach((f,i)=>{
    html+=`<div class="savedrow"><button class="hit" data-go="${f.a}"><div class="h-title">${esc(f.title)}</div><div class="h-loc">${esc(f.label)}</div></button>
    <button class="unsave" data-i="${i}" aria-label="Remove">✕</button></div>`;
  });
  view.innerHTML=html;
  $$('.savedrow .hit').forEach(b=>b.addEventListener('click',()=>openPage(+b.dataset.go)));
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
  $('#rdTitle').textContent=titleFor(curPage);
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
function _wordEsc(x){return String(x==null?'':x).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
function textToWordHtml(text){
  const lines=String(text||'').split('\n');let out='',inList=false;
  const isHead=t=>t.length>2&&t.length<110&&t===t.toUpperCase()&&/[A-Z]{3}/.test(t)&&!/[.;]$/.test(t);
  const isSub=t=>/^\d+(\.\d+)*\s+\S/.test(t)&&!/[.;,]$/.test(t)&&t.length<90;
  for(let raw of lines){
    const t=raw.replace(/\*+/g,'').trim();
    if(!t){if(inList){out+='</ul>';inList=false;}continue;}
    if(isHead(t)){if(inList){out+='</ul>';inList=false;}out+='<h2>'+_wordEsc(t)+'</h2>';continue;}
    if(isSub(t)){if(inList){out+='</ul>';inList=false;}out+='<h3>'+_wordEsc(t)+'</h3>';continue;}
    const b=t.match(/^[•▪◦·–\-\*]\s+(.*)/);
    if(b){if(!inList){out+='<ul>';inList=true;}out+='<li>'+_wordEsc(b[1])+'</li>';continue;}
    const lm=t.match(/^([A-Z][\w\s\/()'’&,–-]{1,42}):\s+(\S.*)/);
    if(inList){out+='</ul>';inList=false;}
    if(lm&&lm[1].split(' ').length<=6){out+='<p><b>'+_wordEsc(lm[1])+':</b> '+_wordEsc(lm[2])+'</p>';continue;}
    out+='<p>'+_wordEsc(t)+'</p>';
  }
  if(inList)out+='</ul>';
  return out;
}
function downloadDoc(title,text){
  const body=textToWordHtml(text);
  const html='<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">'+
   '<head><meta charset="utf-8"><title>'+_wordEsc(title)+'</title><style>'+
   'body{font-family:Calibri,Arial,sans-serif;font-size:11pt;color:#111;line-height:1.42}'+
   'h1{font-size:19pt;color:#0a1930;margin:0 0 4pt}h2{font-size:13pt;color:#8a6d1d;border-bottom:1px solid #d8cba4;padding-bottom:2pt;margin:16pt 0 6pt}'+
   'h3{font-size:11.5pt;color:#334;margin:11pt 0 4pt}ul{margin:6pt 0 6pt 0}li{margin:2pt 0}p{margin:6pt 0}'+
   '.sub{color:#666;font-size:9.5pt;margin:0 0 12pt}.disc{color:#888;font-size:9pt;margin-top:18pt;border-top:1px solid #ccc;padding-top:6pt}'+
   '</style></head><body><h1>'+_wordEsc(title)+'</h1>'+
   '<p class="sub">Garda Reference — Mountjoy Garda Station, DMR North Central</p>'+body+
   '<p class="disc">Working reference — not legal advice — verify current wording before relying. Generated '+new Date().toLocaleDateString('en-IE')+'.</p></body></html>';
  try{
    const blob=new Blob(['\ufeff'+html],{type:'application/msword'});
    const a=document.createElement('a');a.href=URL.createObjectURL(blob);
    a.download=(String(title).replace(/[^\w\s-]/g,'').trim().slice(0,60)||'garda-reference')+'.doc';
    document.body.appendChild(a);a.click();
    setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},1200);
    if(typeof toast==='function')toast('Downloading Word document…');
  }catch(e){alert('Download not supported on this browser.');}
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
/* ---------- AI SEARCH (needs your Anthropic API key + signal) ---------- */
const AIKEY='gr_apikey';
function getKey(){let k=localStorage.getItem(AIKEY);
  if(!k){k=prompt('Paste your Anthropic API key (from console.anthropic.com → API Keys).\nStored only on this phone. Each answer costs a fraction of a cent.');
    if(k)localStorage.setItem(AIKEY,k.trim());}
  return localStorage.getItem(AIKEY);}
async function askAI(){
  const q=($('#q').value||'').trim();
  const panel=$('#aiPanel');
  if(q.length<4){panel.innerHTML='<div class="aians">Type your question in the box first — e.g. "can I draw an inference if he refuses to account for the phone?"</div>';return;}
  const key=getKey(); if(!key)return;
  if(!navigator.onLine){panel.innerHTML='<div class="aians">AI needs signal — offline search below still works.</div>';return;}
  panel.innerHTML='<div class="aians">✦ Reading the manual…</div>';
  // gather best pages via local search
  const terms=q.toLowerCase().split(/\s+/).filter(w=>w.length>2);
  const hits=[];
  for(const c of META.chunks){const ch=CHUNKS[c.f];if(!ch)continue;
    for(let i=0;i<ch.pages.length;i++){const low=ch.pages[i].toLowerCase();
      let sc=0;for(const t of terms){let p=low.indexOf(t);while(p>=0&&sc<60){sc++;p=low.indexOf(t,p+1);}}
      if(sc>0)hits.push({abs:c.s+i,sc});}}
  hits.sort((a,b)=>b.sc-a.sc);
  const top=hits.slice(0,6);
  const ctx=top.map(h=>'[[PAGE '+h.abs+' — '+titleFor(h.abs)+']]\n'+pageText(h.abs).slice(0,2600)).join('\n\n');
  try{
    const r=await fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{
      'Content-Type':'application/json','x-api-key':key,'anthropic-version':'2023-06-01',
      'anthropic-dangerous-direct-browser-access':'true'},
      body:JSON.stringify({model:'claude-sonnet-4-6',max_tokens:900,messages:[{role:'user',content:
      'You are helping a serving Garda use his own reference manual. Answer his question ONLY from the extracts below. Be direct, operational, brief. Cite pages as (p.N) exactly matching the [[PAGE N]] markers. If the extracts do not cover it, say so. End with: Verify before relying.\n\nQUESTION: '+q+'\n\nEXTRACTS:\n'+ctx}]})});
    const d=await r.json();
    if(d.error)throw new Error(d.error.message||'API error');
    let txt=(d.content||[]).filter(b=>b.type==='text').map(b=>b.text).join('\n');
    let h=esc(txt)
      .replace(/^#{1,4}\s*(.+)$/gm,'<b class="aih">$1</b>')
      .replace(/\*\*([^*]+)\*\*/g,'<b>$1</b>')
      .replace(/^\s*[-•]\s+(.+)$/gm,'<span class="aib">▸ $1</span>')
      .replace(/\n{2,}/g,'<br>')
      .replace(/\n/g,'<br>')
      .replace(/(<br>)+(<b class="aih">)/g,'<br>$2')
      .replace(/\(p\.(\d{1,4})\)/g,(m,n)=>'<span class="xref" data-a="'+n+'">(p.'+n+')</span>');
    panel.innerHTML='<div class="aians">'+h+'<div class="aisrc">Sources: '+top.map(t=>'<span class="xref" data-a="'+t.abs+'">'+esc(pageLabel(t.abs))+'</span>').join(' · ')+'</div></div>';
    panel.querySelectorAll('.xref').forEach(x=>x.addEventListener('click',()=>openPage(+x.dataset.a)));
  }catch(e){
    let msg=String(e.message||e);
    if(/401|invalid|auth/i.test(msg)){localStorage.removeItem(AIKEY);msg='Key rejected — tap Ask AI again and re-enter it.';}
    panel.innerHTML='<div class="aians">AI failed: '+esc(msg)+'</div>';
  }
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
    document.querySelectorAll('.hudclock').forEach(el=>{
      const f=el.dataset.f, h=f==='line'?'<b>'+t+'</b> · '+ds:'<b>'+t+'</b><small>'+(f==='noyear'?ds.slice(0,-5):ds)+'</small>';
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
    for(const id of ['mStory','mTV','mRadio']){ const el=document.getElementById(id); if(vis(el)){ el.querySelector('.m-x').click(); return true; } }
    if(window.prsBack&&window.prsBack())return true;                      // present to TV: blank → show → grid → closed
    if(window.scnBack&&window.scnBack())return true;                      // scanner: sheet → crop/enhance → pages → camera → closed
    if(window.recBack&&window.recBack())return true;                      // recorder: sheet → player → list → closed
    if(window.detBack&&window.detBack())return true;                      // detention clock: desk → sheet → clock → list → closed
    if(window.tskBack&&window.tskBack())return true;                      // tasks: sheet → editor → list → closed
    if(window.rstBack&&window.rstBack())return true;                      // roster: sheet → wizard step → main → closed
    if(window.ntsBack&&window.ntsBack())return true;                      // notes: sheet → sketch → editor → list → closed
    if(window.tbxBack&&window.tbxBack())return true;                      // toolbox: tool → grid → closed
    const reel=document.getElementById('osReel');
    if(vis(reel)){ const gv=document.getElementById('reelGridView');
      if(gv&&gv.classList.contains('hidden'))clk('#reelGridBtn'); else clk('#reelClose'); return true; }   // reel → list → closed
    if(vis(document.getElementById('dccList'))) return clk('#dclClose');
    const osint=document.getElementById('osint');
    if(vis(osint)){ const p=document.getElementById('osPanel');
      if(vis(p)){ if(!clk('#osPanel #ospClose'))p.classList.add('hidden'); return true; }
      if(window.closeOSINT){ closeOSINT(); return true; } }
    if(!reader.classList.contains('hidden')){ closeReader(); return true; }
    if(tab!=='search'){ tab='search'; $$('#tabbar .tab').forEach(x=>x.classList.toggle('active',x.dataset.tab==='search')); render(); view.scrollTop=0; return true; }
    if(lastQuery||!document.getElementById('homeNews')){ lastQuery=''; renderSearch(); view.scrollTop=0; return true; }
    return false;
  }
  try{ history.replaceState({gr:'base'},''); history.pushState({gr:'guard'},''); }catch(e){}
  let armed=false, leaving=false;
  addEventListener('popstate',()=>{
    if(leaving)return;
    if(closeTop()){ armed=false; history.pushState({gr:'guard'},''); return; }
    if(!armed){ armed=true; history.pushState({gr:'guard'},''); if(window.grToast)grToast('Press back again to exit'); setTimeout(()=>{armed=false;},2500); return; }
    leaving=true; history.back();                                          // second Back within 2.5 s → close the app
  });
})();
