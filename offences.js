/* Every offence — one list, grouped by area, each with an icon. Tap for the offence hub: manual page, guide, points to prove, cases, statement check. */
(function(W){ 'use strict';
let OFF=null; const D=document;
const GICO={'Property':'1f45b','Person':'1f44a','Public order':'1f4e3','Domestic violence':'1f3e0','Drugs':'1f48a','Sexual offences':'1f6d1','Road traffic':'1f697','Weapons':'1f52a'};
const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const ico=(c,s)=>W.GRPro&&GRPro.icon?GRPro.icon(c,s):'';
async function load(){ if(OFF)return OFF; const r=await fetch('data/offences.json'); OFF=await r.json(); return OFF; }
const norm=s=>String(s||'').toLowerCase().replace(/\s+/g,' ').replace(/[()]/g,'').trim();
function ptpIndex(o){ try{ const P=(W.grOPS&&grOPS())||[]; const key=norm(o.c).split(' ').slice(0,2).join(' '); return P.findIndex(p=>{ const c=norm(p.o.split('—')[1]||''); return c.startsWith(key)||norm(p.o).startsWith(norm(o.n)); }); }catch(e){ return -1; } }
async function renderAll(){
  const v=D.getElementById('view'); v.innerHTML='<div class="pro ofx"><div class="ofx-load">Loading…</div></div>';
  const L=await load(); const groups=[...new Set(L.map(o=>o.g))];
  const head=(W.kbHead?kbHead('⚖️ Every offence'):'');
  v.innerHTML=head+'<div class="pro ofx"><p class="ofx-sub">'+L.length+' offences by area. Tap one for the manual, guide, proofs and cases.</p>'
   +'<div class="ofx-find"><input id="ofxQ" type="search" placeholder="Filter offences" autocomplete="off"></div>'
   +'<div class="ofx-jump">'+groups.map(g=>'<button type="button" data-g="'+esc(g)+'">'+ico(GICO[g]||'2696-fe0f',18)+'<span>'+esc(g)+'</span></button>').join('')+'</div>'
   +groups.map(g=>'<section class="ofx-g" data-gs="'+esc(g)+'"><h3>'+esc(g)+'</h3><div class="p-card">'+L.map((o,i)=>[o,i]).filter(([o])=>o.g===g).map(([o,i])=>
     '<button type="button" class="p-row ofx-r" data-i="'+i+'" data-s="'+esc(norm(o.n+' '+o.c))+'">'+ico(o.i,34)+'<span class="p-tx"><b>'+esc(o.n)+'</b><small>'+esc(o.c)+'</small></span><i class="p-ch" aria-hidden="true">›</i></button>').join('')+'</div></section>').join('')
   +'<p class="toolnote">Section references are for quick orientation — check the current wording before relying on it.</p></div>';
  if(W.wireBack)wireBack(); v.scrollTop=0;
  v.querySelectorAll('.ofx-r').forEach(b=>b.onclick=()=>W.renderOffenceHub(+b.dataset.i));
  v.querySelectorAll('.ofx-jump button').forEach(b=>b.onclick=()=>{ const s=v.querySelector('[data-gs="'+b.dataset.g+'"]'); if(s)s.scrollIntoView({behavior:'smooth',block:'start'}); });
  const q=v.querySelector('#ofxQ'); q.oninput=()=>{ const t=norm(q.value); v.querySelectorAll('.ofx-r').forEach(r=>r.hidden=!!t&&!r.dataset.s.includes(t)); v.querySelectorAll('.ofx-g').forEach(s=>s.hidden=![...s.querySelectorAll('.ofx-r')].some(r=>!r.hidden)); };
}
async function renderOne(i){
  const L=await load(), o=L[i]; if(!o)return; const v=D.getElementById('view');
  const pi=ptpIndex(o); const acts=[];
  if(o.p)acts.push(['1f4d6','Manual','Page '+o.p,'page']);
  if(o.gd&&W.GRPro&&GRPro.items[o.gd])acts.push([GRPro.items[o.gd][0],'Investigation guide',GRPro.items[o.gd][1],'guide']);
  if(pi>=0)acts.push(['2705','Points to prove','Elements and arrest notes','ptp']);
  acts.push(['2696-fe0f','Case law','Cases on '+o.n.toLowerCase(),'cases']);
  if(W.GRPro&&GRPro.items.proofs)acts.push(['1f4dd','Statement check','Tick proofs against a statement','proofs']);
  acts.push(['1f50d','Search everything','All mentions in the app','search']);
  v.innerHTML=(W.kbHead?kbHead('⚖️ '+o.n):'')+'<div class="pro ofx"><div class="ofx-hero">'+ico(o.i,56)+'<div><h2>'+esc(o.n)+'</h2><small>'+esc(o.c)+' · '+esc(o.g)+'</small></div></div>'
   +'<div class="p-card">'+acts.map(a=>'<button type="button" class="p-row" data-a="'+a[3]+'">'+ico(a[0],30)+'<span class="p-tx"><b>'+esc(a[1])+'</b><small>'+esc(a[2])+'</small></span><i class="p-ch" aria-hidden="true">›</i></button>').join('')+'</div></div>';
  if(W.wireBack)wireBack(); v.scrollTop=0;
  try{ if(W.pushRecent)pushRecent({k:'tool',id:'alloff',t:o.n,s:o.c}); }catch(e){}
  v.querySelectorAll('[data-a]').forEach(b=>b.onclick=()=>{ const a=b.dataset.a;
    if(a==='page'&&W.openPage)openPage(o.p);
    else if(a==='guide')GRPro.run(o.gd);
    else if(a==='ptp'&&W.renderOffence)renderOffence(pi);
    else if(a==='proofs')GRPro.run('proofs');
    else if(W.searchFor)searchFor(a==='cases'?o.n:o.n); });
}
W.renderAllOffences=renderAll; W.renderOffenceHub=renderOne;
})(window);
