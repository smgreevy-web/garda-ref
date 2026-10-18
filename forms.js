/* Assisting — print-and-fill forms: paper statements you print, fill in by pen and have the witness sign.
   First: the CCTV continuity statement. On screen the form reflows to fit the phone; printed (or as the PDF
   in forms/) it is two A4 pages of lines and tick boxes. Nothing here is saved or uploaded. */
(function(){
'use strict';
const W=window, D=document;
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

/* ---------- the forms ----------
   blocks: {h} heading · {p} text · {li} bullet · {gap} space · {f:[[label,weight]…]} a row of labelled lines · {decl} declaration box
           {tbl:{head,w,rows}} blank table · {ln:n} ruled lines · {sm} small print
   inline: [] tick box · {date} · {time} · {hms} · {N} a line N em long · {N:caption} the same with a caption after it */
const DECL='I hereby declare that this statement is true to the best of my knowledge and belief and that I make it knowing that if it is tendered in evidence I will be liable to prosecution if I state in it anything which I know to be false or do not believe to be true.';
const FORMS={
 cctv:{t:'CCTV continuity statement',v:'Plain — delete as appropriate',alt:'cctvtick',file:'cctv-continuity',
  tip:'Print it, fill it in by pen — cross out what doesn’t apply where it says “delete as appropriate” — and have the witness sign the declaration, the bottom of each page and the end.',
  refs:[['PULSE incident no.'],['Exhibit no.']],
  pages:[[
   {f:[['Statement of',3],['Phone',1.6]]},
   {f:[['Address',1]]},
   {f:[['Occupation / role',2],['Business',2.4]]},
   {f:[['Taken by Garda',2.4],['Reg. no.',1],['Station',1.6]]},
   {f:[['Taken at',2.2],['Date',1.25],['Started',0.95],['Finished',0.95]]},
   {decl:DECL},
   {gap:1},
   {p:'I am the {9:job or role} at {16:business name and address}.'},
   {p:'I have used this system for about {5:years or months}.'},
   {gap:1},
   {p:'The cameras record to a {13:DVR, NVR, computer or cloud}.'},
   {p:'Make {9}  Model {9}  Serial no. {8:if known}'},
   {p:'There are {3} cameras.  It records {14:all the time, on movement or on a schedule}.'},
   {p:'It keeps footage for about {3} days before it records over it.'},
   {p:'Others who can get into the system: {18:e.g. nobody, staff, installer, head office}'},
   {gap:1},
   {p:'On {date} at {time} I checked the system clock against the correct time.'},
   {p:'I took the correct time from {16:e.g. mobile phone network time}.'},
   {p:'At that moment the system showed {hms} on {date}.'},
   {p:'The time on the system was correct / fast / slow* by {2.5} min {2.5} sec.'},
   {p:'The date on the system was correct / wrong* — it showed {date}.'},
   {p:'It changes for summer and winter time by itself:  yes / no / don’t know*.'},
   {p:'This check was done by me / by Garda {10} in my presence*.'},
   {sm:'* Delete as appropriate.'}
  ],[
   {p:'At the request of Garda {10}, I looked for footage of {date} between {time} and {time} (system time). The relevant cameras — number or name, what each one shows, and the times on the system — are:'},
   {li:'Camera {6} showing {17} from {time} to {time}'},
   {li:'Camera {6} showing {17} from {time} to {time}'},
   {li:'Camera {6} showing {17} from {time} to {time}'},
   {li:'Camera {6} showing {17} from {time} to {time}'},
   {li:'Camera {6} showing {17} from {time} to {time}'},
   {gap:1},
   {p:'On {date} at {time}, I / Garda {10} in my presence* copied the footage'},
   {p:'onto a {14:USB stick, DVD, hard drive or link}.'},
   {p:'File type {7}  Number of files {3}  Player software included:  yes / no*'},
   {p:'I did not edit, cut, alter or delete any of it. It is a true and complete copy of what the system recorded on those cameras for those times.'},
   {p:'The original footage is kept on the system until about {date}.'},
   {p:'It has / has not* been locked so it won’t be recorded over.'},
   {gap:1},
   {p:'On {date} at {time} at {13:place}'},
   {p:'I handed the {10:e.g. USB stick} to Garda {11}  Reg. no. {5}.'},
   {p:'It was labelled Exhibit {7} and sealed in evidence bag no. {8}.'},
   {p:'I signed the exhibit label.'},
   {p:'I was / was not* given a written request for the footage under s.41 of the Data Protection Act 2018.'},
   {gap:1},
   {p:'Anything else that could affect the footage — gaps in recording, faults, other copies made:'},
   {ln:4},
   {p:'This statement has been read over to me and is correct.',b:1},
   {f:[['Signed (witness)',2.6],['Date',1.25],['Time',0.95]],big:1},
   {f:[['Taken by Garda',2.2],['Reg. no.',1],['Signed',1.8]],big:1},
   {sm:'* Delete as appropriate.'}
  ]]},
 cctvtick:{t:'CCTV continuity statement',v:'Tick boxes',alt:'cctv',file:'cctv-continuity-tick-boxes',sub:'CCTV footage — continuity',cont:'STATEMENT OF WITNESS — continued',
  tip:'Print it, fill it in by pen — tick the boxes that apply — and have the witness sign the declaration, the bottom of each page and the end.',
  refs:[['PULSE incident no.'],['Exhibit no.']],
  pages:[[
   {f:[['Statement of',3],['Phone',1.6]]},
   {f:[['Address',1]]},
   {f:[['Occupation / role',2],['Business',2.4]]},
   {f:[['Taken by Garda',2.4],['Reg. no.',1],['Station',1.6]]},
   {f:[['Taken at',2.2],['Date',1.25],['Started',0.95],['Finished',0.95]]},
   {decl:DECL},
   {h:'1.  About me'},
   {p:'I am the {9:job or role} at {16:business name and address}.'},
   {p:'I have used this system for about {5:years or months}.'},
   {h:'2.  The system'},
   {p:'The cameras record to a [] DVR [] NVR [] computer [] cloud service [] other {8}'},
   {p:'Make {9}  Model {9}  Serial no. {8:if known}'},
   {p:'Number of cameras {3}.  It records [] all the time [] on movement [] on a schedule.'},
   {p:'It keeps footage for about {3} days before it records over it.'},
   {p:'Others who can get into it: [] nobody else [] other staff [] installer or remote access [] head office [] other {6}'},
   {h:'3.  Time and date on the system'},
   {p:'On {date} at {time} (correct time) I checked the system clock against [] mobile phone network time [] the Garda’s phone or radio [] other {8}'},
   {p:'At that moment the system showed {hms} on {date}.'},
   {p:'The time on the system is [] correct [] fast by {2.5} min {2.5} sec [] slow by {2.5} min {2.5} sec.'},
   {p:'The date on the system is [] correct [] wrong — it showed {date}.'},
   {p:'It changes for summer and winter time [] by itself [] not at all [] I don’t know.'},
   {p:'This check was done [] by me [] by Garda {10} in my presence.'}
  ],[
   {h:'4.  The footage'},
   {p:'At the request of Garda {10}, I looked for footage of {date} between {time} and {time} (system time). The relevant cameras are:'},
   {tbl:{head:['Camera no. or name','Where it is and what it shows','From (system time)','To (system time)'],w:[20,44,18,18],rows:5}},
   {h:'5.  Copying the footage'},
   {p:'On {date} at {time} [] I copied [] Garda {10} copied, in my presence,'},
   {p:'the footage onto a [] USB stick [] DVD or CD [] hard drive [] link or email [] other {6}'},
   {p:'File type {7}  [] Player software included  Number of files {3}'},
   {p:'I did not edit, cut, alter or delete any of it. It is a true and complete copy of what the system recorded on those cameras for those times.'},
   {p:'The original footage [] is kept on the system until about {date} [] has been locked so it won’t be recorded over [] has since been recorded over.'},
   {h:'6.  Handing it over'},
   {p:'On {date} at {time} at {13:place}'},
   {p:'I handed the {10:e.g. USB stick} to Garda {11}  Reg. no. {5}.'},
   {p:'It was labelled Exhibit {7}  [] and sealed in evidence bag no. {8}.'},
   {p:'[] I signed the exhibit label.  [] I was given a written request for the footage (s.41 Data Protection Act 2018).'},
   {h:'7.  Anything else',hs:'gaps in recording, faults, other copies made — anything that could affect the footage'},
   {ln:4},
   {p:'This statement has been read over to me and is correct.',b:1},
   {f:[['Signed (witness)',2.6],['Date',1.25],['Time',0.95]],big:1},
   {f:[['Taken by Garda',2.2],['Reg. no.',1],['Signed',1.8]],big:1}
  ]]}
};

function inl(s){ const b=w=>'<i class="fb" style="--w:'+w+'em"></i>';
  return esc(s).replace(/ {2,}/g,'<i class="fsp"></i>').replace(/\[\] ?([^\s\[{<]*)/g,'<span class="fo"><i class="fx" aria-label="tick box"></i>&nbsp;$1</span>')
    .replace(/\{date\}/g,'<span class="fd">'+b(1.7)+'/'+b(1.7)+'/'+b(2.9)+'</span>')
    .replace(/\{time\}/g,'<span class="fd">'+b(1.7)+':'+b(1.7)+'</span>')
    .replace(/\{hms\}/g,'<span class="fd">'+b(1.7)+':'+b(1.7)+':'+b(1.7)+'</span>')
    .replace(/\{(\d+(?:\.\d+)?)(?::([^}]*))?\}/g,(m,w,c)=>b(w)+(c?'<small class="fc">('+c+')</small>':'')); }
function block(x){
  if(x.h!=null)return '<h3 class="fh">'+esc(x.h)+(x.hs?' <small>— '+esc(x.hs)+'</small>':'')+'</h3>';
  if(x.p!=null)return '<p class="fp'+(x.b?' fbold':'')+'">'+inl(x.p)+'</p>';
  if(x.li!=null)return '<p class="fp fli">'+inl(x.li)+'</p>';
  if(x.gap)return '<div class="fgap"></div>';
  if(x.f)return '<div class="fr'+(x.big?' big':'')+'">'+x.f.map(([l,wt])=>'<span class="ff" style="--g:'+wt+'"><b>'+esc(l)+'</b><i class="fg"></i></span>').join('')+'</div>';
  if(x.decl)return '<div class="fdecl"><b>Declaration</b><p>“'+esc(x.decl)+'”</p><div class="fr big"><span class="ff" style="--g:1"><b>Signed (witness)</b><i class="fg"></i></span><span class="ff" style="--g:.55"><b>Date</b><i class="fg"></i></span></div></div>';
  if(x.tbl){ const t=x.tbl; return '<table class="ftb"><colgroup>'+t.w.map(w=>'<col style="width:'+w+'%">').join('')+'</colgroup><thead><tr>'+t.head.map(h=>'<th>'+esc(h)+'</th>').join('')+'</tr></thead><tbody>'
    +Array.from({length:t.rows},()=>'<tr>'+t.head.map(()=>'<td></td>').join('')+'</tr>').join('')+'</tbody></table>'; }
  if(x.ln)return '<div class="fln">'+'<i></i>'.repeat(x.ln)+'</div>';
  if(x.sm)return '<p class="fsm">'+esc(x.sm)+'</p>';
  return ''; }
function formHtml(k){ const F=FORMS[k], n=F.pages.length;
  return F.pages.map((P,i)=>'<section class="fpg f-'+k+'" aria-label="Page '+(i+1)+' of '+n+'">'
    +(i===0?'<header class="fhd"><div class="ftt"><b>STATEMENT OF WITNESS</b>'+(F.sub?'<span>'+esc(F.sub)+'</span>':'')+'</div><div class="frefs">'+F.refs.map(([l])=>'<span class="ff" style="--g:1"><b>'+esc(l)+'</b><i class="fg"></i></span>').join('')+'</div></header>'
      :'<header class="fhd c"><div class="ftt"><b>'+esc(F.cont||'STATEMENT OF WITNESS')+'</b>'+(F.sub?'<span>'+esc(F.sub)+'</span>':'')+'</div><div class="frefs"><span class="ff" style="--g:1"><b>Name of witness</b><i class="fg"></i></span></div></header>')
    +'<div class="fbody">'+P.map(block).join('')+'</div>'
    +'<footer class="fft"><span>Page '+(i+1)+' of '+n+'</span><span class="ff" style="--g:1"><b>Witness</b><i class="fg"></i></span><span class="ff" style="--g:1"><b>Garda</b><i class="fg"></i></span></footer></section>').join(''); }

/* ---------- the screen ---------- */
let ov=null, cur=null;
function build(){ if(ov&&ov.isConnected)return;
  ov=D.createElement('div'); ov.id='frm'; ov.hidden=true; ov.setAttribute('role','dialog'); ov.setAttribute('aria-label','Print-and-fill form');
  ov.innerHTML='<div class="fm-top"><button type="button" class="fm-back">‹ Back</button><div class="fm-tt"><b class="fm-title"></b><span>Print · fill in by pen</span></div></div>'
    +'<div class="fm-main"><div class="fm-vers" role="group" aria-label="Version" hidden></div><div class="fm-acts"><button type="button" class="fm-b fm-print">'+ic('print')+'Print</button><button type="button" class="fm-b fm-share">'+ic('share')+'Send the PDF</button><button type="button" class="fm-b fm-save">'+ic('down')+'Save the PDF</button></div>'
    +'<p class="fm-tip"></p><div class="fm-doc"></div><p class="fm-foot">An independent template, not an official Garda form — check it against your station’s statement form and your Sergeant’s direction. Nothing you write here is saved; it’s for paper.</p></div><div class="fm-toast"></div>';
  D.body.appendChild(ov);
  ov.querySelector('.fm-back').onclick=()=>close();
  ov.querySelector('.fm-print').onclick=()=>{ const np=D.getElementById('nts-print'); if(np)np.remove(); try{ W.print(); }catch(e){ toast('Printing isn’t available on this phone — send the PDF to yourself instead'); } };
  ov.querySelector('.fm-share').onclick=()=>pdf(true);
  ov.querySelector('.fm-save').onclick=()=>pdf(false); }
function ic(k){ const P={print:'<path d="M7 9V3h10v6M7 18H4.5A1.5 1.5 0 0 1 3 16.5v-6A1.5 1.5 0 0 1 4.5 9h15a1.5 1.5 0 0 1 1.5 1.5v6a1.5 1.5 0 0 1-1.5 1.5H17"/><path d="M7 14h10v7H7z"/>',
  share:'<path d="M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7M16 6l-4-4-4 4M12 2v13"/>',down:'<path d="M12 3v12M7 10l5 5 5-5M5 21h14"/>'};
  return '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'+P[k]+'</svg>'; }
function toast(m){ const t=ov.querySelector('.fm-toast'); t.textContent=m; t.classList.add('on'); clearTimeout(t._t); t._t=setTimeout(()=>t.classList.remove('on'),3400); }
async function pdf(send){ const F=FORMS[cur]; if(!F)return; const name=F.file+'.pdf';
  let blob; try{ const r=await fetch('forms/'+name); if(!r.ok)throw 0; blob=await r.blob(); blob=new Blob([blob],{type:'application/pdf'}); }catch(e){ toast('Couldn’t open the PDF — tap Print instead'); return; }
  const G=W.GRDocs;
  if(send&&G&&G.canShare(blob,name)){ if(await G.share(blob,name,F.t))return; }
  if(G){ G.save(blob,name); toast(send?'Saved '+name+' — email it to yourself from your downloads':'Saved '+name+' to your downloads'); } }
function open(k){ if(!FORMS[k])return false; build(); cur=k; const F=FORMS[k];
  const bt=D.getElementById('boot'); if(bt&&bt.parentNode)bt.parentNode.removeChild(bt);
  ov.querySelector('.fm-title').textContent=F.t; ov.querySelector('.fm-tip').textContent=F.tip;
  const vs=ov.querySelector('.fm-vers'), A=F.alt&&FORMS[F.alt]; vs.hidden=!A;
  if(A){ const pair=[k,F.alt].sort((a,b)=>(FORMS[a].fixed?1:0)-(FORMS[b].fixed?1:0));   // the plain one first
    vs.innerHTML=pair.map(x=>'<button type="button" class="fm-v'+(x===k?' on':'')+'" data-v="'+x+'" aria-pressed="'+(x===k)+'">'+esc(FORMS[x].v)+'</button>').join('');
    vs.querySelectorAll('[data-v]').forEach(b=>b.onclick=()=>{ if(b.dataset.v!==cur)open(b.dataset.v); }); }
  ov.querySelector('.fm-doc').innerHTML=formHtml(k); ov.hidden=false; D.body.classList.add('frm-open'); ov.querySelector('.fm-main').scrollTop=0;
  if(W.grHudTick)W.grHudTick(); return true; }
function close(){ if(!ov||ov.hidden)return false; ov.hidden=true; D.body.classList.remove('frm-open'); ov.querySelector('.fm-doc').innerHTML=''; cur=null; return true; }
W.frmBack=()=>close();
W.GRForms=Object.freeze({open,close,html:formHtml,list:()=>Object.keys(FORMS).map(k=>({k,t:FORMS[k].t,v:FORMS[k].v||'',fixed:!!FORMS[k].fixed,file:'forms/'+FORMS[k].file+'.pdf'}))});
})();
