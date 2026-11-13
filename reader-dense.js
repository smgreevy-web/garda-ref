/* Dense reader helpers: sentence-case ALL-CAPS section titles, a one-line preview under each closed section, and a sticky jump bar */
(function(){ 'use strict';
const KEEP=/^(?:[IVX]{2,}|[B-HJ-Z]|[A-Z]\d+|CCTV|DPP|RTA|CJA|NFOAPA|PULSE|GSOC|DNA|ID|PSV|EU|ECHR|ECtHR|UK|SC|CCA|IECA|IESC|IEHC|HSE|ESB|AGS|TII|DMR|ATM|SIM|GPS|PIN|VRN|NCT|CAB|DSU|DPU|GNBCI|RPU|SOCO|HMRC|NDLS|LUAS|DART|ADVOKATE|PEACE|FAQ|AI|PDF)$/;
const SMALL=new Set(['a','an','and','or','of','the','to','in','on','for','at','by','with','from','as','vs','v']);
function sentence(t){ const s=String(t||''); const letters=s.replace(/[^A-Za-z]/g,''); if(letters.length<4||letters!==letters.toUpperCase())return s;
  let first=true; return s.split(/(\s+|—|–|-|\/|,|:|\(|\))/).map(w=>{ if(!/[A-Za-z]/.test(w))return w; const bare=w.replace(/[^A-Za-z0-9.]/g,'');
    if(KEEP.test(bare)){ first=false; return w; }
    const lw=w.toLowerCase(); const out=first?lw.charAt(0).toUpperCase()+lw.slice(1):lw; first=false; return out; }).join(''); }

/* 1 · Answer first tiles and 2 · Ask the page — built from the guide's own text, so nothing new is claimed */
const TILES=[['Offences',/offen[cs]e|element/i,null],['Powers',/arrest|power|search|detention/i,null],['What to prove',/prove|proof|ingredient|element/i,null],['Time limits',null,/time limit|within (?:six|6|\d+) months|limitation period|summons .*months/i]];
const QS=[['What do I prove?',/\b(prove|proofs?|ingredients?|elements?)\b/i],['Can I arrest?',/\barrest/i],['Search powers',/\bsearch\b/i],['Which statements?',/\bstatements?\b/i],['Injuries & photos',/injur|photograph|medical/i],['CCTV',/cctv|footage/i],['Time limits',/time limit|months|limitation/i],['Interview',/interview|caution/i],['File for the DPP',/\bDPP\b|directions|file/i]];
const clean=t=>String(t||'').replace(/\s+/g,' ').trim();
function units(d){ return [...d.querySelectorAll('.rsecb p,.rsecb li,.rsecb tr,.rsecb .rb-box')].filter(e=>!e.closest('li li')&&clean(e.textContent).length>40&&!/^[A-Z0-9 .,—–()\/-]{8,}$/.test(clean(e.textContent))); }
function jumpTo(body,d,el){ d.open=true; const t=(el||d).getBoundingClientRect().top-body.getBoundingClientRect().top+body.scrollTop-60; body.scrollTo({top:t,behavior:'smooth'}); if(el){ el.classList.add('rq-flash'); setTimeout(()=>el.classList.remove('rq-flash'),1800); } }
function answerFirst(body,secs){
  const out=[]; const used=new Set();
  TILES.forEach(([lab,titleRe,bodyRe])=>{ let hit=null;
    if(titleRe){ const d=secs.find(d=>!used.has(d)&&titleRe.test(clean(d.querySelector('summary').childNodes[0]&&d.querySelector('.rs-txt').childNodes[0].textContent))); if(d){ const u=units(d)[0]; if(u){ hit=[d,u]; used.add(d); } } }
    if(!hit&&bodyRe){ for(const d of secs){ const u=units(d).find(e=>bodyRe.test(e.textContent)); if(u){ hit=[d,u]; break; } } }
    if(hit)out.push([lab,hit]); });
  if(out.length<2)return null;
  const box=document.createElement('div'); box.className='raf';
  box.innerHTML='<div class="raf-h">At a glance <small>from this guide</small></div><div class="raf-g"></div>';
  out.forEach(([lab,[d,u]])=>{ const b=document.createElement('button'); b.type='button'; b.className='raf-t'; const tx=clean(u.textContent); b.innerHTML='<small></small><span></span>'; b.firstChild.textContent=lab; b.lastChild.textContent=tx.length>120?tx.slice(0,118)+'…':tx; b.onclick=()=>jumpTo(body,d,u); box.querySelector('.raf-g').appendChild(b); });
  return box; }
function askPage(body,secs){
  const all=secs.flatMap(d=>units(d).map(u=>[d,u]));
  const qs=QS.map(([q,re])=>[q,re,all.filter(([d,u])=>re.test(u.textContent))]).filter(x=>x[2].length);
  if(qs.length<2)return null;
  const box=document.createElement('div'); box.className='rq'; box.innerHTML='<div class="raf-h">What do you need?</div><div class="rq-c"></div><div class="rq-a" hidden></div>';
  const ans=box.querySelector('.rq-a');
  qs.forEach(([q,re,hits])=>{ const b=document.createElement('button'); b.type='button'; b.textContent=q; b.onclick=()=>{
    const on=!b.classList.contains('on'); box.querySelectorAll('.rq-c .on').forEach(x=>x.classList.remove('on')); if(!on){ ans.hidden=true; return; } b.classList.add('on');
    // rank: hits in a section whose title matches first, then the rest; show up to three
    const sc=([d,u])=>(re.test(d.querySelector('.rs-txt').childNodes[0].textContent)?2:0)+(u.tagName==='LI'?1:0);
    const top=hits.slice().sort((a,b2)=>sc(b2)-sc(a)).slice(0,3);
    ans.innerHTML=''; top.forEach(([d,u])=>{ const r=document.createElement('button'); r.type='button'; r.className='rq-r'; const tx=clean(u.textContent); const sec=clean(d.querySelector('.rs-txt').childNodes[0].textContent);
      r.innerHTML='<span></span><small></small>'; r.firstChild.textContent=tx.length>260?tx.slice(0,258)+'…':tx; r.lastChild.textContent=sec+' · read in full ›'; r.onclick=()=>jumpTo(body,d,u); ans.appendChild(r); });
    if(hits.length>3){ const m=document.createElement('small'); m.className='rq-m'; m.textContent=(hits.length-3)+' more mention'+(hits.length-3===1?'':'s')+' in this guide'; ans.appendChild(m); }
    ans.hidden=false; }; box.querySelector('.rq-c').appendChild(b); });
  return box; }
function enhance(body){
  const secs=[...body.querySelectorAll(':scope details.rsec, :scope .rb-doc details.rsec')]; if(!secs.length||body.querySelector('.rjump'))return;
  secs.forEach(d=>{ const sm=d.querySelector('summary'); if(!sm)return; let tx=sm.querySelector('.rs-txt'); if(!tx){ tx=document.createElement('span'); tx.className='rs-txt'; while(sm.firstChild)tx.appendChild(sm.firstChild); sm.appendChild(tx); } if(tx.childNodes.length===1&&tx.firstChild.nodeType===3)tx.textContent=sentence(tx.textContent);
    if(!sm.querySelector('.rs-prev')){ const b=d.querySelector('.rsecb'); const p=b?(b.textContent||'').replace(/\s+/g,' ').trim().slice(0,140):''; if(p){ const s=document.createElement('span'); s.className='rs-prev'; s.textContent=p; tx.appendChild(s); } } });
  if(secs.length<3)return;
  const bar=document.createElement('nav'); bar.className='rjump'; bar.setAttribute('aria-label','Jump to section');
  const allB=document.createElement('button'); allB.type='button'; allB.className='all'; allB.textContent='Open all';
  allB.onclick=()=>{ const open=secs.some(d=>!d.open); secs.forEach(d=>d.open=open); allB.textContent=open?'Close all':'Open all'; };
  bar.appendChild(allB);
  secs.forEach((d,i)=>{ const tx=d.querySelector('.rs-txt'); const name=tx?tx.childNodes[0].textContent.trim():('Part '+(i+1)); const b=document.createElement('button'); b.type='button'; b.textContent=(i+1)+' · '+(name.length>28?name.slice(0,26)+'…':name);
    b.onclick=()=>{ d.open=true; bar.querySelectorAll('.on').forEach(x=>x.classList.remove('on')); b.classList.add('on'); const top=d.getBoundingClientRect().top-body.getBoundingClientRect().top+body.scrollTop-bar.offsetHeight-4; body.scrollTo({top,behavior:'smooth'}); };
    bar.appendChild(b); });
  body.insertBefore(bar,body.firstChild);
  try{ const af=answerFirst(body,secs), ap=askPage(body,secs); const anchor=bar.nextSibling; if(ap)body.insertBefore(ap,anchor); if(af)body.insertBefore(af,ap||anchor); }catch(e){}
}
function init(){ const body=document.getElementById('rdBody'); if(!body)return;
  try{ if(localStorage.getItem('gr_rd_roomy')==='1')document.documentElement.classList.add('rd-roomy'); }catch(e){}
  new MutationObserver(()=>{ try{ enhance(body); }catch(e){} }).observe(body,{childList:true}); }
window.GRReader={sentence,enhance,setRoomy(on){ document.documentElement.classList.toggle('rd-roomy',!!on); try{ localStorage.setItem('gr_rd_roomy',on?'1':'0'); }catch(e){} }};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init); else init();
})();
