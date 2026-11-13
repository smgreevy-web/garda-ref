/* Assisting — Statement check: does the statement meet the proofs?
   Pick the offence and the kind of statement (a witness / injured party, or your own). Tick each proof the statement covers and
   note where. Anything not covered is flagged before you copy. Nothing typed here is saved — it clears when you leave. */
(function(){
'use strict';
const W=window, D=document;
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const P3=c=>W.GRPro?GRPro.icon(c,30):'';
/* what every statement of each kind should also have, whatever the offence */
const ALSO={
 wit:['Who they are to the case, and how they know the people involved','Date, time and exact place','What they saw, heard and did — in order, in their own words','Lighting, distance, how long they watched, anything in the way (ADVOKATE)','Words spoken, word for word, in quotes','Read over, corrections initialled, signed and dated, witnessed'],
 own:['Your station, that you were on duty, in uniform or plain clothes','Date, time and exact place, and how you came to be there','What you saw, heard and did — in order','The power you used and your grounds for it','The caution, word for word, and the reply','Time of arrest and the reason given in ordinary language','Exhibits: what you seized, where, the label, and who you gave it to','Custody: arrival time, member in charge, rights given']};
let st={i:0,kind:'wit',t:{},n:{},a:{}};
function ring(pct,label){ const r=42, c=2*Math.PI*r; return '<div class="pf-ring"><svg viewBox="0 0 100 100" width="92" height="92"><circle cx="50" cy="50" r="'+r+'" fill="none" stroke="var(--p-soft)" stroke-width="9"/><circle cx="50" cy="50" r="'+r+'" fill="none" stroke="'+(pct>=100?'var(--p-grn)':'var(--p-amb)')+'" stroke-width="9" stroke-linecap="round" stroke-dasharray="'+(c*pct/100).toFixed(1)+' '+c.toFixed(1)+'" transform="rotate(-90 50 50)"/></svg><b>'+label+'</b></div>'; }
function text(p,miss){ const L=['STATEMENT CHECK — '+p.o,(st.kind==='wit'?'Witness / injured party statement':'My own statement'),'','PROOFS'];
  p.e.forEach((x,k)=>L.push((st.t[k]?'[x] ':'[ ] ')+x+(st.n[k]?' — '+st.n[k]:'')+(st.t[k]?'':'  ** NOT COVERED **')));
  L.push('','ALSO CHECK'); ALSO[st.kind].forEach((x,k)=>L.push((st.a[k]?'[x] ':'[ ] ')+x));
  if(miss.length)L.push('',miss.length+' proof'+(miss.length===1?'':'s')+' not covered yet.'); return L.join('\n'); }
W.renderProofs=function(i,kind){
  if(typeof OPS==='undefined'||!OPS||!OPS.ptp)return;
  if(i!=null&&(+i!==st.i||(kind&&kind!==st.kind))){ st={i:+i||0,kind:kind||st.kind,t:{},n:{},a:{}}; }
  const p=OPS.ptp[st.i]||OPS.ptp[0], done=p.e.filter((_,k)=>st.t[k]).length, N=p.e.length, miss=p.e.map((x,k)=>st.t[k]?null:x).filter(Boolean), sg=(OPS.sguides||[]).find(g=>g.g===p.g);
  view.innerHTML='<div class="pro" id="proProofs"><div class="p-fhead">'+P3('1f4c4')+'<div><h1>Statement check</h1><small>Does it meet the proofs?</small></div></div>'
   +'<div class="pf-seg"><button type="button" data-k="wit" class="'+(st.kind==='wit'?'on':'')+'">Witness / injured party</button><button type="button" data-k="own" class="'+(st.kind==='own'?'on':'')+'">My own statement</button></div>'
   +'<label class="pf-sel"><span>Offence</span><select data-noassist>'+OPS.ptp.map((x,k)=>'<option value="'+k+'"'+(k===st.i?' selected':'')+'>'+esc(x.o)+'</option>').join('')+'</select></label>'
   +'<div class="p-card pf-sum">'+ring(N?done/N*100:0,done+'/'+N)+'<div><b>'+(miss.length?miss.length+' proof'+(miss.length===1?'':'s')+' not covered':'Every proof is covered')+'</b><small>'+(miss.length?'Tick each proof once the statement deals with it, and note the paragraph.':'Check the “also” list, then copy the check for the file.')+'</small></div></div>'
   +'<div class="p-sec"><b>Proofs</b></div><div class="p-card">'+p.e.map((x,k)=>'<div class="pf-row'+(st.t[k]?' on':'')+'"><button type="button" class="pf-tick" data-t="'+k+'" aria-pressed="'+!!st.t[k]+'" aria-label="Covered">'+(st.t[k]?'✓':'')+'</button><div class="pf-tx"><b>'+esc(x)+'</b>'+(st.t[k]?'':'<small class="pf-miss">Not covered yet</small>')+'<input type="text" maxlength="60" data-noassist data-n="'+k+'" placeholder="Where? e.g. para 4" value="'+esc(st.n[k]||'')+'"></div></div>').join('')+'</div>'
   +'<div class="p-sec"><b>Also check</b></div><div class="p-card">'+ALSO[st.kind].map((x,k)=>'<div class="pf-row sm'+(st.a[k]?' on':'')+'"><button type="button" class="pf-tick" data-a="'+k+'" aria-pressed="'+!!st.a[k]+'">'+(st.a[k]?'✓':'')+'</button><div class="pf-tx"><span>'+esc(x)+'</span></div></div>').join('')+'</div>'
   +(st.kind==='wit'&&sg?'<div class="p-sec"><b>What this statement must capture</b></div><div class="p-card pf-must"><ul>'+sg.must.map(x=>'<li>'+esc(x)+'</li>').join('')+'</ul></div>':'')
   +'<div class="p-sec"><b>Go to</b></div><div class="p-chips pf-go"><button type="button" data-g="off">Offence card</button><button type="button" data-g="nb">Notebook entry</button>'+(sg?'<button type="button" data-g="sg">Statement guide</button>':'')+'</div>'
   +'<div class="pf-acts"><button type="button" data-g="reset">Clear</button><button type="button" class="go" data-g="copy">Copy the check</button></div>'
   +'<p class="p-foot">Arrest and notes: '+esc(p.a)+'</p><p class="p-foot">Nothing here is saved. A tick is your judgment that the statement deals with the proof — it doesn’t replace reading it through. Not legal advice.</p></div>';
  const root=view.querySelector('#proProofs'), y=()=>view.scrollTop, re=()=>{ const t=y(); W.renderProofs(); view.scrollTop=t; };
  root.querySelectorAll('.pf-seg button').forEach(b=>b.onclick=()=>{ st.kind=b.dataset.k; st.a={}; re(); });
  root.querySelector('.pf-sel select').onchange=e=>{ st={i:+e.target.value,kind:st.kind,t:{},n:{},a:{}}; re(); };
  root.querySelectorAll('[data-t]').forEach(b=>b.onclick=()=>{ st.t[b.dataset.t]=!st.t[b.dataset.t]; re(); });
  root.querySelectorAll('[data-a]').forEach(b=>b.onclick=()=>{ st.a[b.dataset.a]=!st.a[b.dataset.a]; re(); });
  root.querySelectorAll('[data-n]').forEach(x=>x.oninput=()=>{ st.n[x.dataset.n]=x.value; });
  const act=(g,fn)=>{ const b=root.querySelector('[data-g="'+g+'"]'); if(b)b.onclick=fn; };
  act('off',()=>renderOffence(st.i)); act('nb',()=>{ if(W.renderNB)renderNB('ptp:'+st.i); }); act('sg',()=>renderGuides(p.g));
  act('reset',()=>{ st={i:st.i,kind:st.kind,t:{},n:{},a:{}}; re(); });
  const doCopy=()=>{ const t=text(p,miss); (navigator.clipboard&&navigator.clipboard.writeText?navigator.clipboard.writeText(t):Promise.reject()).then(()=>{ if(W.grToast)grToast('Copied'); }).catch(()=>{ if(W.grToast)grToast('Couldn’t copy on this browser'); }); };
  act('copy',()=>{ if(!miss.length){ doCopy(); return; }
    let o=D.getElementById('pSheet'); if(!o){ o=D.createElement('div'); o.id='pSheet'; D.body.appendChild(o); }
    o.innerHTML='<div class="p-shade"></div><div class="p-sheet pro" role="alertdialog" aria-label="Proofs not covered"><h3>'+miss.length+' proof'+(miss.length===1?'':'s')+' not covered</h3><p>The statement doesn’t deal with:</p><ul class="pf-ml">'+miss.map(x=>'<li>'+esc(x)+'</li>').join('')+'</ul><div class="p-acts"><button type="button" data-a="any">Copy anyway</button><button type="button" class="go" data-a="back">Go back and fix</button></div></div>';
    const close=()=>{ o.innerHTML=''; }; o.querySelector('.p-shade').onclick=close; o.querySelector('[data-a="back"]').onclick=close; o.querySelector('[data-a="any"]').onclick=()=>{ close(); doCopy(); }; });
};
D.addEventListener('click',e=>{ const b=e.target.closest&&e.target.closest('[data-pf]'); if(!b)return; e.preventDefault(); W.renderProofs(+b.dataset.pf,b.dataset.pfk||'wit'); });
W.GRProofs={_state:()=>st,ALSO};
})();
