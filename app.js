/* Garda Reference PWA — offline, no case data, no analytics */
'use strict';
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const view=$('#view'), reader=$('#reader'), rdBody=$('#rdBody');

let META=null, AZ=null, CASES=null, OPS=null, STEN=null;
const CHUNKS={};            // file -> {start,end,pages}
let chunksReady=false, chunksLoading=false;
let curPage=1, tab='search', lastQuery='', lastFilter='all';
let toolState={};           // session-only checklist state
const FAVKEY='gr_favs_v1';
let favs=JSON.parse(localStorage.getItem(FAVKEY)||'[]'); // [{a,title,label}] — section IDs only

/* ---------- boot ---------- */
(async function boot(){
  if('serviceWorker' in navigator){ try{ navigator.serviceWorker.register('sw.js'); }catch(e){} }
  const [m,a,cs,op,sn]=await Promise.all(['meta','az','cases','ops','stencils'].map(f=>fetch('data/'+f+'.json').then(r=>r.json())));
  META=m; AZ=a; CASES=cs; OPS=op; STEN=sn;
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
function titleFor(abs){
  const t=META.titles; let lo=0,hi=t.length-1,ans='Cover';
  while(lo<=hi){const mid=(lo+hi)>>1; if(t[mid][0]<=abs){ans=t[mid][1];lo=mid+1;}else hi=mid-1;}
  return ans;
}
function isDated(abs){ return abs>=993; } // 2007 manual

/* ---------- tabs ---------- */
function applyFS(){document.documentElement.dataset.fs=localStorage.getItem('gr_fs')||'m';}
function bindUI(){
  applyFS();
  $('#loadState').insertAdjacentHTML('beforebegin','<button id="fsBtn" title="Text size">Aa</button>');
  $('#fsBtn').addEventListener('click',()=>{const o=['s','m','l'],c=localStorage.getItem('gr_fs')||'m';
    localStorage.setItem('gr_fs',o[(o.indexOf(c)+1)%3]);applyFS();});
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
  <div class="searchbox"><input id="q" type="search" placeholder="Search everything — topic, case, statute, section…" value="${esc(lastQuery)}" autocomplete="off"></div>
  <div class="chips">${FILTERS.map(([k,l])=>`<button class="chip ${k===lastFilter?'on':''}" data-f="${k}">${l}</button>`).join('')}</div>
  <button id="askAI" class="askbtn">✦ Ask AI — plain-language answer from the manual</button>
  <div id="aiPanel"></div><div id="results"></div>`;
  const q=$('#q'); let t;
  q.addEventListener('input',()=>{clearTimeout(t);t=setTimeout(()=>doSearch(q.value,lastFilter),200);});
  q.addEventListener('keydown',e=>{if(e.key==='Enter'){q.blur();doSearch(q.value,lastFilter);}});
  $$('.chip').forEach(c=>c.addEventListener('click',()=>{lastFilter=c.dataset.f;$$('.chip').forEach(x=>x.classList.toggle('on',x===c));doSearch($('#q').value,lastFilter);}));
  $('#askAI').addEventListener('click',askAI);
  if(lastQuery)doSearch(lastQuery,lastFilter,true); else homeQuick();
}
function homeQuick(){
  const lp=+localStorage.getItem('gr_lastpage')||0;
  $('#results').innerHTML=`${lp?`<button class="hit ixhit" id="contBtn" style="margin-top:6px"><div class="h-title">▶ Continue reading</div><div class="h-loc">${esc(titleFor(lp))} — ${esc(pageLabel(lp))}</div></button>`:''}
  <h2 class="sec">Straight to</h2><div class="quick">
    <button class="qbtn" id="qbCourt">⚖ Court-day mode<small>everything for the stand</small></button>
    <button class="qbtn" id="qbOff">⚖ Offences A–Z<small>everything per offence</small></button>
    <button class="qbtn" id="qbEss">★ Essential case law<small>the ones that changed everything</small></button>
    <button class="qbtn" id="qbPTP">Points to prove<small>offence cards</small></button>
    <button class="qbtn" id="qbGuides">📝 Statement guides<small>per offence, in depth</small></button>
    <button class="qbtn" id="qbSten">📄 My stencils<small>statements · cover reports</small></button>
    <button class="qbtn" id="qbMajor">🚨 Major incident<small>first response guide</small></button>
    <button class="qbtn" id="qbLive">◉ Live judgments<small>courts.ie · BAILII · Westlaw</small></button>
    <button class="qbtn" id="qbClock">Detention clock<small>s.4 · 1996 Act · s.50</small></button>
    <button class="qbtn" id="qbCases">⚖ Case law library<small>every case, in depth</small></button>
    <button class="qbtn" data-go="986">Offence playbooks<small>5-part, per offence</small></button>
    <button class="qbtn" data-go="955">Inference aide<small>ss.18 / 19 / 19A</small></button>
    <button class="qbtn" data-go="975">ADVOKATE<small>identification</small></button>
    <button class="qbtn" data-go="941">Cross-exam tactics<small>V12 Part A</small></button>
    <button class="qbtn" data-go="945">Law of evidence<small>V12 Part B</small></button>
    <button class="qbtn" data-go="144">Assault statement guide<small>s.2 / s.3 deep guide</small></button>
    <button class="qbtn" data-go="28">Detention framework<small>consolidated</small></button>
    <button class="qbtn" data-go="42">Powers ready-reckoner<small>arrest · search · detain</small></button>
    <button class="qbtn" data-go="322">Disclosure framework<small>duty & method</small></button>
    <button class="qbtn" data-go="945">Continuity & exhibits<small>chain of custody law</small></button>
    <button class="qbtn" data-go="178">Domestic violence<small>DV Act 2018 + statements</small></button>
    <button class="qbtn" data-go="344">Drugs & trafficking<small>MDA · 1996 Act</small></button>
    <button class="qbtn" data-go="179">Victims of Crime 2017<small>rights & VIS</small></button>
    <button class="qbtn" data-go="188">Bail<small>objections & considerations</small></button>
    <button class="qbtn" data-go="1134">Forensics (manual)<small>official ch.7</small></button>
  </div>
  <div class="empty">Type anything above — every page of the 1,478 is searchable.</div>`;
  $$('.qbtn').forEach(b=>{
    if(b.id==='qbCases'){b.addEventListener('click',()=>{ixKind='case';tab='index';$$('#tabbar .tab').forEach(x=>x.classList.toggle('active',x.dataset.tab==='index'));render();});}
    else if(b.id==='qbCourt'){b.addEventListener('click',renderCourtDay);}
    else if(b.id==='qbOff'){b.addEventListener('click',()=>renderOffences());}
    else if(b.id==='qbEss'){b.addEventListener('click',renderEssentials);}
    else if(b.id==='qbPTP'){b.addEventListener('click',renderPTP);}
    else if(b.id==='qbGuides'){b.addEventListener('click',()=>renderGuides());}
    else if(b.id==='qbSten'){b.addEventListener('click',renderStencils);}
    else if(b.id==='qbMajor'){b.addEventListener('click',renderMajor);}
    else if(b.id==='qbLive'){b.addEventListener('click',renderLive);}
    else if(b.id==='qbClock'){b.addEventListener('click',renderClock);}
    else b.addEventListener('click',()=>openPage(+b.dataset.go));});
  const cb=$('#contBtn'); if(cb)cb.addEventListener('click',()=>openPage(+localStorage.getItem('gr_lastpage')));
}
const SYN=[['phone','mobile','handset','device','smartphone'],['car','vehicle','automobile','van'],['cctv','camera','footage','video'],['knife','blade','weapon'],['drugs','controlled','substance','narcotics'],['theft','steal','stolen','larceny'],['assault','attack','violence'],['detention','detain','custody'],['arrest','apprehend'],['search','seizure','seize'],['statement','account','memo'],['witness','deponent'],['solicitor','lawyer','legal advisor'],['child','minor','juvenile','youth'],['caution','warning'],['inference','adverse'],['id','identification','identity','parade'],['dna','forensic','swab'],['bail','remand'],['warrant','order']];
function expandTerms(terms){
  const out=new Set(terms);
  for(const t of terms)for(const g of SYN)if(g.includes(t))g.forEach(x=>out.add(x));
  return [...out];
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
    html+=`<button class="hit" data-go="${h.abs}"><div class="h-title">${esc(titleFor(h.abs))}</div>
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
  rdBody.innerHTML=h;
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
function openStencil(i){
  const st=STEN[i];
  reader.classList.remove('hidden');reader.setAttribute('aria-hidden','false');
  $('#rdTitle').textContent=st.t; $('#rdPage').textContent='Stencil · '+st.cat;
  const star=$('#rdStar'); star.textContent='⧉';
  star.onclick=()=>{navigator.clipboard.writeText(st.b).then(()=>{$('#rdPage').textContent='Copied ✓';setTimeout(()=>$('#rdPage').textContent='Stencil · '+st.cat,1500);}).catch(()=>{$('#rdPage').textContent='Copy failed';});};
  $('#rdFlag').classList.add('hidden');
  let h=esc(st.b);
  h=h.replace(/(\[[^\]\n]{1,60}\]|_{3,}|\bXXXX?\b|\bTIME\b|\bDATE\b|\bLOCATION\b|\bNAME\b|\bSTATION\b|\bOFFENCE\b)/g,'<mark class="ph">$1</mark>');
  h=h.split(/\n/).map(l=>l.trim()?('<p>'+l+'</p>'):'').join('');
  rdBody.innerHTML=h; rdBody.scrollTop=0;
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
  $('#results').innerHTML=`<h2 class="sec">Detention clock — verify every authorisation</h2>
  <div class="tool"><h3>Start of detention</h3>
  <input type="datetime-local" id="dtStart" class="dtin">
  <div class="chips"><button class="chip on" data-r="s4">s.4 CJA 1984</button><button class="chip" data-r="dta">s.2 DTA 1996</button><button class="chip" data-r="s50">s.50 CJA 2007</button></div>
  <div id="clockOut"></div>
  <div class="toolnote">Times computed on this phone only, never stored. Rest-period suspensions (midnight–8am) and medical suspensions NOT auto-added — apply manually.</div></div>`;
  let regime='s4';
  const REG={
   s4:[['Initial period','6h','Member i/c authorises'],['First extension','+6h (12h total)','Superintendent'],['Second extension','+12h (24h total)','Chief Superintendent']],
   dta:[['Initial','6h','Member i/c'],['Extension','+18h (24h)','Supt (Chief Supt authorises? — verify)'],['Extension','+24h (48h)','Chief Supt'],['Court','+72h (120h)','Judge — application'],['Court','+48h (168h / 7 days)','Judge']],
   s50:[['Initial','6h','Member i/c'],['Extension','+18h (24h)','Superintendent'],['Extension','+24h (48h)','Chief Supt'],['Court','+72h (120h)','Judge'],['Court','+48h (168h)','Judge']]};
  const draw=()=>{
    const v=$('#dtStart').value; const out=$('#clockOut');
    if(!v){out.innerHTML='';return;}
    let t=new Date(v).getTime(), html='<table class="clocktab"><tr><th>Stage</th><th>Expires</th><th>Authority</th></tr>';
    const fmt=ms=>new Date(ms).toLocaleString('en-IE',{weekday:'short',hour:'2-digit',minute:'2-digit',day:'numeric',month:'short'});
    for(const[st,dur,auth]of REG[regime]){
      const h=parseFloat(dur.replace(/[^\d.]/g,''));
      t+=h*3600e3;
      html+=`<tr><td>${st} <small>${dur}</small></td><td><b>${fmt(t)}</b></td><td>${auth}</td></tr>`;
    }
    out.innerHTML=html+'</table>';
  };
  $('#dtStart').addEventListener('input',draw);
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
    <button class="tmenu" data-v="clock"><b>⏱ Detention clock</b><small>live deadlines — s.4 · 1996 Act · s.30 · s.50</small></button>
    <button class="tmenu" data-v="ptp"><b>Points to prove</b><small>20 offence cards — elements & arrest power</small></button>
    <button class="tmenu" data-v="guides"><b>📝 Statement guides</b><small>what to capture, per offence</small></button>
    <button class="tmenu" data-v="sten"><b>📄 My stencils</b><small>your templates — tap to copy</small></button>
    <button class="tmenu" data-v="checks"><b>✓ Checklists</b><small>scene · arrest · warrant · exhibits · interview · ID</small></button>
    <button class="tmenu" data-v="major"><b>🚨 Major incident</b><small>first response · golden hour</small></button>
    <button class="tmenu" data-v="judg"><b>◉ Latest judgments</b><small>Supreme · Appeal · High Court — live</small></button>
  </div>`;
  $$('.tmenu').forEach(b=>b.addEventListener('click',()=>{
    const v=b.dataset.v;
    if(v==='clock'){tab='search';renderSearch();renderClock();}
    else if(v==='ptp'){tab='search';renderSearch();renderPTP();}
    else if(v==='guides')renderGuides();
    else if(v==='sten')renderStencils();
    else if(v==='checks')renderChecklists();
    else if(v==='major')renderMajor();
    else renderJudgments();
  }));
  view.scrollTop=0;
}
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
  court=court||'IESC';
  view.innerHTML=`<button class="chip" id="backT" style="margin-bottom:8px">‹ Tools</button>
  <h2 class="sec">◉ Latest judgments — live from BAILII</h2>
  <div class="chips">${[['IESC','Supreme'],['IECA','Appeal'],['IEHC','High Court']].map(([k,l])=>`<button class="chip ${k===court?'on':''}" data-c="${k}">${l}</button>`).join('')}</div>
  <div id="jout" class="empty">Loading from bailii.org…</div>`;
  wireBack();
  $$('#view .chip[data-c]').forEach(c=>c.addEventListener('click',()=>renderJudgments(c.dataset.c)));
  const out=$('#jout');
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
    const items=[];let m;
    while((m=re.exec(window._bailii))!==null){if(m[2]===court)items.push({u:'https://www.bailii.org'+m[1],t:m[3]});if(items.length>60)break;}
    if(!items.length)throw new Error('none found');
    out.className='';
    out.innerHTML=items.slice(0,25).map(it=>`<button class="hit jlink" data-u="${it.u}"><div class="h-title" style="font-weight:400"><i>${esc(it.t)}</i></div></button>`).join('')
      +'<div class="toolnote">Needs signal — fetched via a public relay (allorigins.win). Tap to open the full judgment on bailii.org.</div>';
    $$('.jlink').forEach(b=>b.addEventListener('click',()=>window.open(b.dataset.u,'_blank')));
  }catch(e){
    out.innerHTML='Feed unavailable (signal or relay down). <button class="csall" id="jopen">Open BAILII recent Irish decisions</button>';
    $('#jopen').addEventListener('click',()=>window.open('https://www.bailii.org/recent-accessions-ie.html','_blank'));
  }
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
function openPage(abs){
  try{localStorage.setItem('gr_lastpage',String(abs));}catch(e){}
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
  rdBody.innerHTML=formatPage(stripMd(txt));
  rdBody.querySelectorAll('.xref').forEach(x=>x.addEventListener('click',()=>openPage(+x.dataset.a)));
  rdBody.scrollTop=0;
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
