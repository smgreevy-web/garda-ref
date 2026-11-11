/* Assisting — Notebook entries and Reasonable suspicion.
   Notebook entries: a bracket-only draft for every offence card, search and incident (data/notebook.json), built from shared
   blocks plus the parts that offence or situation needs. Each part says why it matters and which cases in the library make it
   matter. Edit the draft on screen, copy it, or save it to Notes. Never pre-written facts: fill the brackets with what actually
   happened, at the time.
   Reasonable suspicion: prompts that walk through the grounds for a search, arrest or opinion — what you saw, what you were
   told, why this person, their response, innocent explanations, what isn't enough on its own, and the test itself — and turn
   the answers into a numbered list of grounds, with the gaps flagged, that can go straight into a notebook draft.
   Session-only: drafts and answers live in memory and are cleared when the app closes. Nothing is saved or uploaded unless
   you save a draft to Notes (stored only on this phone). */
(function(){
'use strict';
const W=window, D=document;
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const ic=(n,c)=>W.GRI?W.GRI(n,c):'';
const toast=m=>{ if(W.grToast)W.grToast(m); };
const viewEl=()=>D.getElementById('view');

/* ---------------- data ---------------- */
let NB=null, nbP=null;
function load(){
  if(NB)return Promise.resolve(NB);
  if(!nbP)nbP=fetch('data/notebook.json').then(r=>{ if(!r.ok)throw new Error('notebook.json '+r.status); return r.json(); })
    .then(d=>{ NB=d; return d; }).catch(e=>{ nbP=null; throw e; });
  return nbP; }
const entryOf=id=>{ if(!NB)return null; const m=/^ptp:(\d+)$/.exec(String(id)); return m?NB.entries.find(e=>e.ptp===+m[1]):NB.entries.find(e=>e.id===id); };
const blockOf=k=>NB&&NB.blocks[k]?Object.assign({k},NB.blocks[k]):null;
const hasCase=n=>Array.isArray(W.CASES)?W.CASES.some(c=>c.n===n):(typeof CASES!=='undefined'&&Array.isArray(CASES)?CASES.some(c=>c.n===n):true);
const caseChips=list=>(list||[]).filter(hasCase).map(n=>'<button type="button" class="nb-case" data-n="'+esc(n)+'">'+ic('scale')+esc(n)+'</button>').join('');

/* ---------------- drafts (memory only) ---------------- */
const DR=new Map();          // entry id → [{k,h,text,why,cases}]
const CLK=new Map();         // entry id → detention clock id it was filled from
const pad=n=>String(n).padStart(2,'0');
const dt=t=>{ const d=new Date(t); return pad(d.getHours())+':'+pad(d.getMinutes())+' on '+pad(d.getDate())+'/'+pad(d.getMonth()+1)+'/'+d.getFullYear(); };
const hm=t=>{ const d=new Date(t); return pad(d.getHours())+':'+pad(d.getMinutes()); };
const EXCL={rest:'Rest — questioning suspended',med:'Medical attention',court:'At court — lawfulness of detention',cert:'Doctor: unfit for questioning',susp:'Detention suspended — released to return'};
const HOWL={released:'Released',charged:'Charged',court:'Brought to court',transfer:'Transferred',other:'Clock stopped'};

function secFrom(s){ const b=typeof s==='string'?blockOf(s.slice(1)):Object.assign({k:''},s); return {k:b.k||'',h:b.h,text:(b.l||[]).join('\n'),why:b.why||'',cases:b.cases||[]}; }
function fresh(e,opt){
  const secs=e.sec.map(secFrom);
  if(e.id==='custody'&&opt&&opt.clock){ const t=custodyText(opt.clock); if(t)secs[0].text=t; }
  return secs; }
function custodyText(id){
  try{
    const db=W.GRDet&&W.GRDet._db?W.GRDet._db():null, c=db&&db.clocks?db.clocks.find(x=>x.id===id):null; if(!c)return '';
    const R=(W.GRDet.REG||{})[c.reg]||{name:'[power]',stages:[]}, L=[];
    if(c.ref)L.push('Custody record: '+c.ref+'.');
    L.push('Arrested at '+dt(c.arrest)+' at [place] under [power].');
    L.push(c.arrive?'Arrived at [station] at '+hm(c.arrive)+'.':'Arrived at [station] at [time].');
    L.push('Detention authorised by [member in charge — name / number] at [time] under '+R.name+'.');
    L.push('Information on rights given at [time]; solicitor requested at [time], contacted at [time], arrived at [time]; consultation [from–to].');
    L.push('Interviews: [number, from–to, by whom, recorded: yes / no].');
    (c.ext||[]).forEach((x,i)=>{ const st=R.stages[i+1]; L.push((st?st.name:'Extension')+': directed at '+dt(x.at)+(x.by?' by '+x.by:' by [rank, name]')+' — grounds: [ ].'); });
    if(!(c.ext||[]).length)L.push('Extensions: [none / rank, name, time, grounds].');
    (c.exc||[]).forEach(x=>L.push('Excluded period — '+(EXCL[x.type]||x.type)+': '+hm(x.from)+(x.to?' to '+hm(x.to):' (still running)')+(x.note?' — '+x.note:'')+'.'));
    L.push('Meals and checks: [times].');
    L.push(c.ended?(HOWL[c.ended.how]||'Ended')+' at '+dt(c.ended.at)+' by [who]; bail [station / court date].':'Charged / released at [time] by [who]; bail [station / court date].');
    return L.join('\n');
  }catch(err){ return ''; } }
function draftFor(e){ if(!DR.has(e.id))DR.set(e.id,fresh(e,{clock:CLK.get(e.id)})); return DR.get(e.id); }
function draftText(e){
  const secs=DR.get(e.id)||fresh(e);
  return [e.t.toUpperCase(),''].concat(secs.map(s=>s.h.toUpperCase()+'\n'+s.text.trim())).join('\n\n').replace(/\n{3,}/g,'\n\n').trim(); }

/* ---------------- shared bits ---------------- */
function copyText(t,msg){
  const ok=()=>toast(msg||'Copied — paste it into your notes');
  const fb=()=>{ const ta=D.createElement('textarea'); ta.value=t; ta.setAttribute('readonly',''); ta.style.position='fixed'; ta.style.opacity='0'; D.body.appendChild(ta); ta.select(); try{ D.execCommand('copy'); ok(); }catch(e){ toast('Copy failed'); } ta.remove(); };
  if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(t).then(ok,fb); else fb(); }
function wireCases(root){
  root.querySelectorAll('.nb-case').forEach(b=>b.addEventListener('click',e=>{ e.preventDefault(); e.stopPropagation(); if(typeof W.openCase==='function')W.openCase(b.dataset.n); })); }
function grow(ta){ ta.style.height='auto'; ta.style.height=(ta.scrollHeight+2)+'px'; }
function checklistHtml(open){
  if(!NB)return '';
  return '<details class="nb-det nb-chk"'+(open?' open':'')+'><summary>'+ic('shield-check')+'The bulletproof checklist</summary><ul>'
    +NB.checklist.map(x=>'<li>'+esc(x)+'</li>').join('')+'</ul><div class="nb-cases">'+caseChips(['People (DPP) v Pringle'])+'</div></details>'; }
// links to notebook entries from other screens: GRNB.links(['po6','po8']) → HTML; GRNB.wire(container)
function linksHtml(ids,title){
  if(!ids||!ids.length)return '';
  const names=NB?ids.map(id=>{ const e=entryOf(id); return e?[id,e.t]:null; }).filter(Boolean):ids.map(id=>[id,null]);
  return '<div class="nb-links"><b>'+ic('notebook-pen')+esc(title||'Notebook entries for this')+'</b><div class="nb-lk">'
    +names.map(([id,t])=>'<button type="button" class="nb-lkb" data-nb="'+esc(id)+'">'+esc(t||id)+'</button>').join('')
    +'<button type="button" class="nb-lkb rs" data-rs="1">'+ic('brain')+'Reasonable suspicion</button></div></div>'; }
function wire(root){
  if(!root)return;
  root.querySelectorAll('[data-nb]').forEach(b=>{ if(b._nb)return; b._nb=1; b.addEventListener('click',e=>{ e.preventDefault(); e.stopPropagation(); leaveOverlays(); W.renderNB(b.dataset.nb); }); });
  root.querySelectorAll('[data-rs]').forEach(b=>{ if(b._nb)return; b._nb=1; b.addEventListener('click',e=>{ e.preventDefault(); e.stopPropagation(); leaveOverlays(); W.renderRS(b.dataset.rsfrom||undefined); }); });
  // names arrive once the data loads
  if(!NB)load().then(()=>root.querySelectorAll('.nb-lkb[data-nb]').forEach(b=>{ const e=entryOf(b.dataset.nb); if(e)b.textContent=e.t; })).catch(()=>{}); }
function leaveOverlays(){
  const rd=D.getElementById('reader'); if(rd&&!rd.classList.contains('hidden')&&typeof W.closeReader==='function'){ try{ W.closeReader(); }catch(e){} }
  if(D.body.classList.contains('det-open')&&typeof W.closeDetention==='function'){ try{ W.closeDetention(); }catch(e){} } }

/* ---------------- one entry ---------------- */
function renderNB(id,opt){
  const v=viewEl(); if(!v)return;
  if(typeof opt==='string')opt={clock:opt};
  if(!NB){ v.innerHTML='<div class="nb"><p class="nb-intro">Opening the notebook entries…</p></div>';
    load().then(()=>{ if(v.querySelector('.nb'))renderNB(id,opt); }).catch(()=>{ v.innerHTML='<div class="nb"><p class="nb-intro">The notebook entries couldn’t be loaded. Open the app once with signal so it can store them for offline use.</p></div>'; }); return; }
  const e=entryOf(id); if(!e){ renderNBLib(); return; }
  if(opt&&opt.clock&&CLK.get(e.id)!==opt.clock){ CLK.set(e.id,opt.clock); DR.delete(e.id); }
  const secs=draftFor(e), ptp=e.ptp!=null&&typeof OPS!=='undefined'&&OPS&&OPS.ptp?OPS.ptp[e.ptp]:null;
  let h='<div class="nb" data-id="'+esc(e.id)+'"><button type="button" class="chip nb-all">‹ Notebook entries</button>'
    +'<h2 class="sec">'+ic('notebook-pen')+esc(e.t)+'</h2>'
    +'<p class="nb-intro">'+esc(e.intro||'Fill the brackets with what actually happened, at the time. Never add grounds or facts after the fact.')+' <span class="nb-dim">Nothing here is saved unless you save it to Notes.</span></p>';
  if(e.id==='sperson')h+='<button type="button" class="nb-btn pri nb-sp">'+ic('user-search')+'Guided search of the person</button>';
  h+=actsHtml(e,id);
  if(ptp)h+='<details class="nb-det nb-ptp" open><summary>'+ic('list-checks')+'Points to prove — make sure your entry covers each</summary><ul>'+ptp.e.map(x=>'<li>'+esc(x)+'</li>').join('')+'</ul><p class="nb-dim"><b>Arrest / notes:</b> '+esc(ptp.a)+'</p></details>';
  if(e.id==='difficult')h+=checklistHtml(true);
  secs.forEach((s,i)=>{
    h+='<section class="nb-sec" data-i="'+i+'"><div class="nb-sh"><b><span class="nb-n">'+(i+1)+'</span>'+esc(s.h)+'</b>'
      +'<button type="button" class="nb-x" data-x="'+i+'" aria-label="Remove this part">'+ic('x')+'</button></div>'
      +'<textarea class="nb-ta" data-t="'+i+'" spellcheck="true" autocapitalize="sentences" aria-label="'+esc(s.h)+'">'+esc(s.text)+'</textarea>'
      +(s.why?'<p class="nb-why">'+ic('info')+'<span>'+esc(s.why)+'</span></p>':'')
      +(s.cases&&s.cases.length?'<div class="nb-cases">'+caseChips(s.cases)+'</div>':'')+'</section>'; });
  const have=new Set(secs.map(s=>s.k)), add=(e.add||[]).filter(k=>!have.has(k)&&NB.blocks[k]);
  if(add.length)h+='<div class="nb-addrow"><span class="nb-l">Add a part</span>'+add.map(k=>'<button type="button" class="nb-add" data-add="'+esc(k)+'">+ '+esc(NB.blocks[k].h)+'</button>').join('')+'</div>';
  h+='<div class="nb-acts bot"><button type="button" class="nb-btn pri" data-act="copy">'+ic('clipboard-list')+'Copy the whole entry</button>'
    +(ptp?'<button type="button" class="nb-btn" data-pf="'+e.ptp+'" data-pfk="own">'+ic('list-checks')+'Check against the proofs</button>':'')
    +'<button type="button" class="nb-btn" data-act="notes">'+ic('notebook-pen')+'Save to Notes</button>'
    +'<button type="button" class="nb-btn" data-act="reset">Start again</button></div>';
  if(e.id!=='difficult')h+=checklistHtml(false);
  h+='<p class="nb-foot">Bracket-only drafts — your notebook is the record, and what goes in it must be what you saw, heard and did. Independent reference, not an official Garda system, not legal advice.</p></div>';
  v.innerHTML=h; v.scrollTop=0;
  const root=v.querySelector('.nb');
  root.querySelector('.nb-all').addEventListener('click',()=>W.renderNBLib());
  const sp=root.querySelector('.nb-sp'); if(sp)sp.addEventListener('click',()=>{ if(W.renderSearchPerson)W.renderSearchPerson(); });
  root.querySelectorAll('.nb-ta').forEach(ta=>{ grow(ta); ta.addEventListener('input',()=>{ const s=secs[+ta.dataset.t]; if(s)s.text=ta.value; grow(ta); }); });
  root.querySelectorAll('.nb-x').forEach(b=>b.addEventListener('click',()=>{
    if(b.dataset.sure!=='1'){ b.dataset.sure='1'; b.classList.add('sure'); b.setAttribute('aria-label','Tap again to remove'); setTimeout(()=>{ b.dataset.sure=''; b.classList.remove('sure'); },2500); toast('Tap × again to remove this part'); return; }
    const y=v.scrollTop; secs.splice(+b.dataset.x,1); renderNB(e.id); v.scrollTop=y; }));
  root.querySelectorAll('.nb-add').forEach(b=>b.addEventListener('click',()=>{
    const s=secFrom('@'+b.dataset.add), at=Math.max(0,secs.findIndex(x=>x.k==='end')); if(at>0)secs.splice(at,0,s); else secs.push(s);
    renderNB(e.id); const el=v.querySelector('.nb-sec[data-i="'+(at>0?at:secs.length-1)+'"]'); if(el)el.scrollIntoView({block:'start'}); }));
  root.querySelectorAll('[data-act]').forEach(b=>b.addEventListener('click',()=>act(e,b.dataset.act)));
  wireCases(root); wire(root);
}
function actsHtml(e,idArg){
  return '<div class="nb-acts"><button type="button" class="nb-btn pri" data-act="copy">'+ic('clipboard-list')+'Copy</button>'
    +'<button type="button" class="nb-btn" data-act="notes">'+ic('notebook-pen')+'Save to Notes</button>'
    +'<button type="button" class="nb-btn'+(e.rs?' hi':'')+'" data-rs="1" data-rsfrom="'+esc(idArg||e.id)+'">'+ic('brain')+'Reasonable suspicion</button>'
    +(e.id!=='difficult'?'<button type="button" class="nb-btn" data-nb="difficult">'+ic('shield-check')+'Difficult interaction</button>':'')+'</div>'; }
function act(e,a){
  if(a==='copy'){ copyText(draftText(e)); return; }
  if(a==='notes'){
    const t='Notebook draft — '+e.t;
    if(W.GRNotes&&typeof W.GRNotes.compose==='function'){ W.GRNotes.compose(t,draftText(e)).then(()=>toast('Saved to Notes — on this phone only')).catch(()=>toast('Couldn’t save to Notes — copy it instead')); }
    else { copyText(draftText(e),'Notes isn’t available here — the draft is copied instead'); }
    return; }
  if(a==='reset'){ const v=viewEl(), b=v&&v.querySelector('[data-act="reset"]');
    if(b&&b.dataset.sure!=='1'){ b.dataset.sure='1'; b.textContent='Tap again to clear the draft'; setTimeout(()=>{ if(b.isConnected){ b.dataset.sure=''; b.textContent='Start again'; } },2500); return; }
    DR.delete(e.id); renderNB(e.id); toast('Draft cleared'); } }

/* ---------------- the library ---------------- */
let libQ='';
function renderNBLib(){
  const v=viewEl(); if(!v)return;
  if(!NB){ v.innerHTML='<div class="nb"><p class="nb-intro">Opening the notebook entries…</p></div>';
    load().then(()=>{ if(v.querySelector('.nb'))renderNBLib(); }).catch(()=>{ v.innerHTML='<div class="nb"><p class="nb-intro">The notebook entries couldn’t be loaded. Open the app once with signal so it can store them for offline use.</p></div>'; }); return; }
  let h='<div class="nb nb-lib"><h2 class="sec">'+ic('notebook-pen')+'Notebook entries</h2>'
    +'<p class="nb-intro">A detailed draft for every offence card, search and incident — brackets to fill with what actually happened, at the time, and why each part matters. <span class="nb-dim">Drafts stay in memory only; save one to Notes to keep it.</span></p>'
    +'<div class="nb-hero"><button type="button" class="nb-heroc" data-rs="1">'+ic('brain')+'<b>Reasonable suspicion</b><small>Think it through · numbered grounds for your entry</small></button>'
    +'<button type="button" class="nb-heroc amb" data-nb="difficult">'+ic('shield-check')+'<b>Difficult interaction</b><small>Complaint-proof entry · hostile or not in control</small></button></div>'
    +'<div class="searchbox" style="position:static"><input id="nbq" type="search" placeholder="Find an entry — assault, warrant, drink driving…" value="'+esc(libQ)+'" autocomplete="off"></div><div id="nbList"></div>'
    +checklistHtml(false)+'</div>';
  v.innerHTML=h; v.scrollTop=0;
  const root=v.querySelector('.nb'), q=root.querySelector('#nbq'), list=root.querySelector('#nbList');
  const draw=()=>{ const t=libQ.trim().toLowerCase(); let o='';
    NB.groups.forEach(g=>{ const xs=NB.entries.filter(e=>e.grp===g&&(!t||(e.t+' '+g).toLowerCase().includes(t)));
      if(!xs.length)return;
      o+='<h3 class="nb-gh">'+esc(g)+'</h3><div class="lgrp">'+xs.map(e=>'<button type="button" class="lrow nb-row" data-nb="'+esc(e.id)+'">'+ic(e.grp==='Interactions'?'shield-check':e.grp==='Road traffic'?'car-front':e.grp==='Searches & entry'?'user-search':e.grp==='Arrest & custody'?'timer':e.grp==='Evidence'?'cctv':e.grp==='Incidents'?'siren':'shield')
        +'<span class="lt"><b>'+esc(e.t)+'</b>'+(DR.has(e.id)?'<small>Draft in progress</small>':'')+'</span>'+ic('chevron-right','chev')+'</button>').join('')+'</div>'; });
    list.innerHTML=o||'<div class="empty">No entry matches “'+esc(libQ)+'”.</div>'; wire(list); };
  q.addEventListener('input',()=>{ libQ=q.value; draw(); });
  draw(); wire(root); wireCases(root);
}

/* ---------------- reasonable suspicion ---------------- */
const POW=[
 ['s23','Drugs search — s.23 MDA 1977','reasonable cause to suspect','the person has a controlled drug in their possession in contravention of the Act'],
 ['fowa16','Knife or weapon search — s.16 FOWA 1990','reasonable cause to suspect','the person has with them, in a public place, a knife, bladed or pointed article or weapon in contravention of s.9 or s.9A'],
 ['dpa29','Stolen goods (Dublin) — s.29 Dublin Police Act 1842','reasonable suspicion','the person is carrying stolen or unlawfully obtained goods'],
 ['cla4','Arrest without warrant — s.4 Criminal Law Act 1997','reasonable cause to suspect','the person is committing, or is guilty of, an arrestable offence'],
 ['rta','Drink or drug driving — s.4(8) / s.5 RTA 2010','opinion','the person has committed the offence — a low threshold, but it must be your genuine opinion, formed on facts'],
 ['cla8','Vehicle stop and search — s.8 Criminal Law Act 1976','reasonable cause to suspect','a listed offence has been, is being or is about to be committed — and, to search a person, that they are involved'],
 ['oasa30','Section 30 OASA 1939','suspicion — and it must be reasonable','an offence under the Act or a scheduled offence'],
 ['mha12','Mental Health Act 2001, s.12','reasonable grounds for believing','the person has a mental disorder and, because of it, there is a serious likelihood of immediate and serious harm to themselves or others'],
 ['other','Something else','the standard in the power you’re using','what the power requires']];
const RSQ=[
 ['obs','What you saw, heard or smelt yourself',[['saw','What exactly did you see? Actions, objects, exchanges — not “acting suspiciously”.'],['view','Where were you, how far away, for how long — and what was the view and the lighting like?'],['hs','What did you hear or smell — and can you tie it to this person, rather than the area or a group?']]],
 ['info','What you were told',[['src','Who told you, and how — a colleague, a briefing, Control, a member of the public, a named or anonymous source?'],['rec','How recent is it, and how specific — does it name or describe this person, this place, this time?'],['corr','Has anything you’ve seen since backed it up?']]],
 ['who','Why this person',[['link','What links this person, rather than anyone else nearby?'],['desc','If you’re going on a description: what was it, what matches — and what doesn’t?']]],
 ['resp','Their response',[['said','What did they say or do when you spoke to them? Word for word.'],['effect','Did it add to your suspicion — or explain it away?']]],
 ['innoc','Innocent explanations',[['expl','What innocent explanation could there be?'],['test','What did you do to test it — ask, watch longer, check?'],['survive','Why does your suspicion survive it?']]]];
const NOT=[['area','It’s a known area (Farrell)'],['nerv','Nervousness, or avoiding eye contact'],['anon','An anonymous call with no detail'],['look','Clothing, age, ethnicity or the group they’re with'],['late','Being out late, or with a known person'],['prev','Previous convictions'],['stale','Stale or vague intelligence'],['crowd','A smell I can’t pin on one person']];
const TESTS=[['own','I actually suspect it myself — not just because I was told to act.',['O’Hara v Chief Constable']],
 ['obj','A reasonable garda, knowing only what I knew then, would suspect it too.',['Hussein v Chong Fook Yam']],
 ['court','I can explain each ground in court in one sentence — what I saw or was told, and when.',['DPP v Rooney']],
 ['wait','I considered whether watching longer would give better grounds, and why acting now was necessary.',[]]];
let RS={pow:'',a:{},not:[],t:[]};
const rsAns=k=>String(RS.a[k]||'').trim();
function rsGrounds(){
  const P=POW.find(p=>p[0]===RS.pow), L=[];
  const add=(lab,t)=>{ if(t)L.push(lab+t.replace(/\s+$/,'').replace(/([^.!?”"])$/,'$1.')); };
  add('I saw: ',rsAns('saw')); add('My position and view: ',rsAns('view')); add('I heard or smelt: ',rsAns('hs'));
  const info=[rsAns('src')&&'Source — '+rsAns('src'),rsAns('rec')&&'how recent and specific — '+rsAns('rec'),rsAns('corr')&&'backed up by — '+rsAns('corr')].filter(Boolean).join('; ');
  add('I was told: ',info);
  add('Why this person: ',[rsAns('link'),rsAns('desc')].filter(Boolean).join(' '));
  add('Their response: ',[rsAns('said'),rsAns('effect')].filter(Boolean).join(' '));
  const lead=P&&P[0]!=='other'?'Before acting under '+P[1].split(' — ')[1]+', I had '+P[2]+' that '+P[3]+', on these grounds, in this order:':'Before acting, my grounds were, in this order:';
  let t=lead+'\n'+(L.length?L.map((x,i)=>(i+1)+'. '+x).join('\n'):'1. [ ]');
  const ex=[rsAns('expl')&&'innocent explanation considered — '+rsAns('expl'),rsAns('test')&&'tested by — '+rsAns('test'),rsAns('survive')&&'my suspicion remained because — '+rsAns('survive')].filter(Boolean);
  if(ex.length)t+='\n'+ex.join('; ').replace(/^./,c=>c.toUpperCase())+'.';
  return t; }
function rsGaps(){
  const g=[], obs=rsAns('saw')||rsAns('hs'), info=rsAns('src')||rsAns('rec');
  if(!RS.pow)g.push('Pick the power — the standard you have to meet depends on it.');
  if(!obs&&!info)g.push('No grounds recorded yet — what did you see, hear, smell or get told?');
  if(info&&!rsAns('rec'))g.push('You’re relying on information — record how recent and how specific it was.');
  if(info&&!rsAns('src'))g.push('Record who gave you the information, and when (a briefing counts — note who gave it).');
  if((obs||info)&&!rsAns('link'))g.push('Say what links this person, rather than anyone else nearby.');
  if(RS.not.length&&!obs&&!info)g.push('Only general factors ticked — they can’t found suspicion on their own (Farrell).');
  else if(RS.not.length)g.push('General factors can add to specific grounds but can’t carry them — make sure the specific facts stand up without them.');
  if(!rsAns('expl'))g.push('Consider the innocent explanation, and how you tested it.');
  const miss=TESTS.filter(x=>!RS.t.includes(x[0]));
  if(miss.length)g.push('Not yet confirmed: '+miss.map(x=>x[1].split(' — ')[0].replace(/\.$/,'')).join('; ')+'.');
  return g; }
function renderRS(fromId){
  const v=viewEl(); if(!v)return;
  if(fromId&&!NB){ load().then(()=>renderRS(fromId)).catch(()=>renderRS()); return; }
  const from=fromId&&NB?entryOf(fromId):null, P=POW.find(p=>p[0]===RS.pow);
  let h='<div class="nb rs">'+(from?'<button type="button" class="chip nb-back">‹ '+esc(from.t)+'</button>':'')
    +'<h2 class="sec">'+ic('brain')+'Reasonable suspicion</h2>'
    +'<p class="nb-intro">Think it through before you act, or as soon as you can after. Your answers make a numbered list of grounds for your notebook, with the gaps flagged. <span class="nb-dim">Nothing here is saved — it clears when the app closes.</span></p>'
    +'<div class="rs-card"><h3>'+ic('scale')+'The test</h3><ul>'
    +'<li>It must be <b>your own</b> suspicion, and it must be <b>reasonable</b> — would a reasonable garda, knowing what you knew then, suspect it too? A briefing can supply the grounds, but you must hold the suspicion yourself.</li>'
    +'<li>Suspicion is well short of proof — but it needs facts behind it, and they must point to <b>this person</b>, not an area or a group.</li>'
    +'<li>It can rest on information as well as what you saw. Whether an arrest was lawful and whether evidence is admissible are separate questions — so record where your information came from.</li>'
    +'<li>Tell the person the power and the reason in plain words.</li></ul><div class="nb-cases">'+caseChips(['Hussein v Chong Fook Yam','O’Hara v Chief Constable',"DPP (Garda O'Higgins) v Farrell",'DPP (Walsh) v Cash','DPP v Rooney','Christie v Leachinsky'])+'</div></div>'
    +'<h3 class="nb-gh">1 · What are you about to do?</h3><div class="rs-pow">'
    +POW.map(p=>'<button type="button" class="rs-p'+(RS.pow===p[0]?' on':'')+'" data-p="'+p[0]+'"><b>'+esc(p[1])+'</b>'+(p[0]!=='other'?'<small>Needs '+esc(p[2])+' that '+esc(p[3])+'.</small>':'')+'</button>').join('')+'</div>';
  if(P&&P[0]!=='other')h+='<p class="rs-std">'+ic('info')+'<span>This power needs <b>'+esc(P[2])+'</b> that '+esc(P[3])+'.</span></p>';
  RSQ.forEach((g,gi)=>{ h+='<h3 class="nb-gh">'+(gi+2)+' · '+esc(g[1])+'</h3><div class="rs-g">'+g[2].map(([k,q])=>'<label class="rs-q"><span>'+esc(q)+'</span><textarea class="rs-ta" data-k="'+k+'" rows="2" spellcheck="true" autocapitalize="sentences">'+esc(RS.a[k]||'')+'</textarea></label>').join('')+'</div>'; });
  h+='<h3 class="nb-gh">7 · Not enough on its own</h3><p class="nb-dim rs-sub">Tick anything you were relying on. These can add to specific grounds, but they can’t found suspicion by themselves.</p><div class="rs-not">'
    +NOT.map(([k,l])=>'<button type="button" class="rs-n'+(RS.not.includes(k)?' on':'')+'" data-n="'+k+'" aria-pressed="'+(RS.not.includes(k)?'true':'false')+'">'+esc(l)+'</button>').join('')+'</div>';
  h+='<h3 class="nb-gh">8 · The test, honestly</h3><div class="rs-tests">'
    +TESTS.map(([k,l,cs])=>'<div class="rs-t'+(RS.t.includes(k)?' on':'')+'"><button type="button" class="rs-tb" data-t="'+k+'" aria-pressed="'+(RS.t.includes(k)?'true':'false')+'"><span class="rs-box">'+(RS.t.includes(k)?'✓':'')+'</span><span>'+esc(l)+'</span></button>'+(cs.length?'<div class="nb-cases">'+caseChips(cs)+'</div>':'')+'</div>').join('')+'</div>';
  h+='<div class="rs-out"><h3>'+ic('notebook-pen')+'Your grounds — for your notebook</h3><textarea class="nb-ta rs-res" readonly aria-label="Your grounds"></textarea>'
    +'<div class="rs-gaps"></div><div class="nb-acts">'
    +(from?'<button type="button" class="nb-btn pri" data-r="put">'+ic('notebook-pen')+'Put these into my entry</button>':'')
    +'<button type="button" class="nb-btn'+(from?'':' pri')+'" data-r="copy">'+ic('clipboard-list')+'Copy the grounds</button>'
    +(from?'':'<button type="button" class="nb-btn" data-r="lib">'+ic('notebook-pen')+'Open a notebook entry</button>')
    +'<button type="button" class="nb-btn" data-r="clear">Start again</button></div></div>'
    +'<p class="nb-foot">A thinking aid, not a ruling — the decision and the record are yours. Independent reference, not an official Garda system, not legal advice.</p></div>';
  v.innerHTML=h; v.scrollTop=0;
  const root=v.querySelector('.rs'), res=root.querySelector('.rs-res'), gaps=root.querySelector('.rs-gaps');
  const paint=()=>{ res.value=rsGrounds(); grow(res); const g=rsGaps();
    gaps.innerHTML=g.length?'<p class="rs-gh">'+ic('triangle-alert')+'Gaps to fill</p><ul>'+g.map(x=>'<li>'+esc(x)+'</li>').join('')+'</ul>':'<p class="rs-ok">'+ic('check')+'No obvious gaps. Make sure each ground is true, specific and written down now.</p>'; };
  const bk=root.querySelector('.nb-back'); if(bk)bk.addEventListener('click',()=>W.renderNB(fromId));
  root.querySelectorAll('.rs-p').forEach(b=>b.addEventListener('click',()=>{ const y=v.scrollTop; RS.pow=RS.pow===b.dataset.p?'':b.dataset.p; renderRS(fromId); v.scrollTop=y; }));
  root.querySelectorAll('.rs-ta').forEach(ta=>{ grow(ta); ta.addEventListener('input',()=>{ RS.a[ta.dataset.k]=ta.value; grow(ta); paint(); }); });
  root.querySelectorAll('.rs-n').forEach(b=>b.addEventListener('click',()=>{ const k=b.dataset.n; RS.not=RS.not.includes(k)?RS.not.filter(x=>x!==k):RS.not.concat(k);
    b.classList.toggle('on',RS.not.includes(k)); b.setAttribute('aria-pressed',RS.not.includes(k)?'true':'false'); paint(); }));
  root.querySelectorAll('.rs-tb').forEach(b=>b.addEventListener('click',()=>{ const k=b.dataset.t; RS.t=RS.t.includes(k)?RS.t.filter(x=>x!==k):RS.t.concat(k);
    const on=RS.t.includes(k); b.parentNode.classList.toggle('on',on); b.setAttribute('aria-pressed',on?'true':'false'); b.querySelector('.rs-box').textContent=on?'✓':''; paint(); }));
  root.querySelectorAll('[data-r]').forEach(b=>b.addEventListener('click',()=>{
    const a=b.dataset.r;
    if(a==='copy')copyText(rsGrounds(),'Grounds copied');
    else if(a==='lib')W.renderNBLib();
    else if(a==='put'&&from){ putGrounds(from,rsGrounds()); W.renderNB(fromId); toast('Grounds added to your entry'); }
    else if(a==='clear'){ if(b.dataset.sure!=='1'){ b.dataset.sure='1'; b.textContent='Tap again to clear your answers'; setTimeout(()=>{ if(b.isConnected){ b.dataset.sure=''; b.textContent='Start again'; } },2500); return; }
      RS={pow:'',a:{},not:[],t:[]}; renderRS(fromId); } }));
  wireCases(root); paint();
}
// grounds go where the draft asks for them ([1. …  2. …]); otherwise as their own part after "Start" / "People involved"
function putGrounds(e,txt){
  const secs=draftFor(e), list=txt.split('\n').slice(1).join('  ').replace(/\s+/g,' ').trim();
  const re=/\[1\. …\s+2\. …(?:\s+3\. …)?\](?: — see the reasonable-suspicion prompts\.)?/;
  const s=secs.find(x=>re.test(x.text));
  if(s){ s.text=s.text.replace(re,list.replace(/([^.])$/,'$1.')).replace(/\.\.$/m,'.'); return; }
  const at=Math.max(secs.findIndex(x=>x.k==='people'),secs.findIndex(x=>x.k==='start'))+1;
  secs.splice(at,0,{k:'grounds',h:'My grounds',text:txt,why:'Grounds written down before acting, in the order you had them, are what the court will test.',cases:['Hussein v Chong Fook Yam','O’Hara v Chief Constable']}); }

W.renderNB=renderNB; W.renderNBLib=renderNBLib; W.renderRS=renderRS;
W.GRNB=Object.freeze({load,links:linksHtml,wire,open:renderNB,lib:renderNBLib,rs:renderRS,
  _draft:id=>{ const e=entryOf(id); return e?draftText(e):''; },_rs:()=>({grounds:rsGrounds(),gaps:rsGaps()}),_set:s=>{ RS=Object.assign({pow:'',a:{},not:[],t:[]},s||{}); }});
// warm the data in the background so buttons have their names offline
setTimeout(()=>{ load().catch(()=>{}); },2500);
})();
