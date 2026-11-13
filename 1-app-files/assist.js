/* Assisting — help while you type:
   1. A slim bar above the keyboard on every free-text box: a reminder not to enter identifiers, and a Dictate button.
   2. "Open in the app" and "Ask next" on the Search tab — works offline, no AI.
   Dictation uses the phone's own speech service (Google or Apple), so the first use explains that and asks. */
(function(){
'use strict';
const W=window, D=document;
const WARN='No names, addresses, dates of birth, PULSE or reg numbers.';
const SR=W.SpeechRecognition||W.webkitSpeechRecognition;
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let bar=null, cur=null, rec=null, listening=false;
const free=el=>{ if(!el||el.disabled||el.readOnly)return false; if(el.closest('#lockScr,.lk-card,[data-noassist]'))return false;
  if(el.tagName==='TEXTAREA')return true; if(el.tagName!=='INPUT')return false;
  const t=(el.getAttribute('type')||'text').toLowerCase(); if(!['text','search',''].includes(t))return false;
  const im=(el.getAttribute('inputmode')||'').toLowerCase(); if(['numeric','decimal','tel','email','url','none'].includes(im))return false;
  const ml=+el.getAttribute('maxlength')||0; if(ml&&ml<20)return false;
  if(/username|password|email|key/i.test((el.getAttribute('autocomplete')||'')+' '+(el.name||'')+' '+(el.id||'')))return false;
  return true; };
function build(){ if(bar)return; bar=D.createElement('div'); bar.id='asBar'; bar.hidden=true;
  bar.innerHTML='<span class="as-w"><i aria-hidden="true">⚠</i>'+WARN+'</span>'+(SR?'<button type="button" class="as-mic" aria-label="Dictate" aria-pressed="false"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg><span>Dictate</span></button>':'');
  D.body.appendChild(bar);
  const m=bar.querySelector('.as-mic'); if(m){ m.addEventListener('pointerdown',e=>e.preventDefault()); m.addEventListener('click',e=>{ e.preventDefault(); toggle(); }); }
  place(); }
function place(){ if(!bar||bar.hidden)return; const vv=W.visualViewport; const h=bar.offsetHeight||40;
  if(vv){ bar.style.top=Math.round(vv.offsetTop+vv.height-h)+'px'; bar.style.bottom='auto'; } else { bar.style.top='auto'; bar.style.bottom='0'; } }
function show(el){ build(); cur=el; bar.hidden=false; place(); }
function hide(){ if(bar)bar.hidden=true; cur=null; stop(); }
D.addEventListener('focusin',e=>{ if(free(e.target))show(e.target); else if(cur&&!(bar&&bar.contains(e.target)))hide(); });
D.addEventListener('focusout',()=>setTimeout(()=>{ const a=D.activeElement; if(cur&&a!==cur&&!(bar&&bar.contains(a))&&!free(a))hide(); },120));
if(W.visualViewport){ visualViewport.addEventListener('resize',place); visualViewport.addEventListener('scroll',place); }
W.addEventListener('resize',place);
/* ---- dictation ---- */
const okd=()=>{ try{ return localStorage.getItem('gr_dictate_ok')==='1'; }catch(e){ return false; } };
function consent(then){ let o=D.getElementById('asAsk'); if(!o){ o=D.createElement('div'); o.id='asAsk'; D.body.appendChild(o); }
  const el=cur;
  o.innerHTML='<div class="as-shade"></div><div class="as-sheet" role="dialog" aria-label="Dictation"><h3>Before you dictate</h3><p>Dictation uses your phone’s own speech service (Google or Apple) to turn what you say into text. What you say is sent to that service.</p><p><b>Never say names, addresses, dates of birth, PULSE numbers or reg numbers.</b> Use “Person A”, “the location”.</p><div class="as-acts"><button type="button" data-a="no">Cancel</button><button type="button" class="go" data-a="yes">I understand</button></div></div>';
  const close=()=>{ o.innerHTML=''; };
  o.querySelector('.as-shade').onclick=close; o.querySelector('[data-a="no"]').onclick=close;
  o.querySelector('[data-a="yes"]').onclick=()=>{ try{ localStorage.setItem('gr_dictate_ok','1'); }catch(e){} close(); if(el){ el.focus(); cur=el; } then(); }; }
function insert(el,txt){ if(!el||!txt)return; const s=el.selectionStart!=null?el.selectionStart:el.value.length, e2=el.selectionEnd!=null?el.selectionEnd:s, v=el.value;
  const pre=v.slice(0,s), sp=pre&&!/\s$/.test(pre)?' ':''; el.value=pre+sp+txt+v.slice(e2); const p=(pre+sp+txt).length; try{ el.setSelectionRange(p,p); }catch(e){}
  el.dispatchEvent(new Event('input',{bubbles:true})); }
function paintMic(){ const m=bar&&bar.querySelector('.as-mic'); if(m){ m.classList.toggle('on',listening); m.setAttribute('aria-pressed',String(listening)); m.querySelector('span').textContent=listening?'Stop':'Dictate'; } }
function stop(){ if(rec){ try{ rec.stop(); }catch(e){} } listening=false; paintMic(); }
function start(){ if(!SR||!cur)return; const el=cur;
  try{ rec=new SR(); rec.lang='en-IE'; rec.interimResults=false; rec.continuous=true;
    rec.onresult=ev=>{ for(let i=ev.resultIndex;i<ev.results.length;i++){ if(ev.results[i].isFinal)insert(el,ev.results[i][0].transcript.trim()); } };
    rec.onerror=ev=>{ listening=false; paintMic(); if(W.grToast)grToast(ev.error==='not-allowed'?'Microphone is blocked — allow it in your browser settings':ev.error==='network'?'Dictation needs signal':'Dictation stopped'); };
    rec.onend=()=>{ listening=false; paintMic(); };
    rec.start(); listening=true; paintMic(); }catch(e){ listening=false; paintMic(); if(W.grToast)grToast('This browser can’t dictate'); } }
function toggle(){ if(listening){ stop(); return; } if(!okd()){ consent(start); return; } start(); }
W.GRAssist={WARN,free,_bar:()=>bar,_insert:insert,dictateSupported:!!SR};

/* ---------- Search: "Open in the app" and "Ask next" (offline) ---------- */
const DO=new Set(['app','tool','nb','off','sg','tpl','sten','major','kb','ops2','guide','fa']);
const ICON={app:'1f4f1',tool:'1f9f0',nb:'1f4d3',off:'1f6e1-fe0f',sg:'1f4c4',tpl:'1f4e8',sten:'1f4d1',major:'1f6a8',kb:'1f4d5',ops2:'1f4d5',guide:'1f4d6',fa:'1f691',case:'2696-fe0f'};
const NEXT=[
 [/name|address|identify himself|won.t give/i,['What if he gives a false name?','Can I arrest for refusing a name and address?','What do I write in my notebook?']],
 [/search|s\.?\s?23|warrant/i,['What grounds do I need to search a person?','Can I search a car without a warrant?','What do I record after a search?']],
 [/arrest|detain|detention|custody|s\.?\s?4\b/i,['How long can I detain someone under s.4?','What must I say on arrest?','When does the detention clock stop?']],
 [/bail/i,['What are the grounds to object to bail?','Can I use hearsay in a bail objection?','What is the burglary presumption?']],
 [/drink|drunk driv|breath|intoxilyser|drug driv/i,['What is the 20-minute observation period?','What do I need to prove for drink driving?','What goes in my notebook at the station?']],
 [/public order|s\.?\s?6\b|s\.?\s?8\b|abusive|direction/i,['What do I need to prove for s.6?','What warning must I give under s.8?','What do I write for a s.8 arrest?']],
 [/assault|harm|injur/i,['What are the proofs for assault causing harm?','What should the injured party’s statement cover?','What medical evidence do I need?']],
 [/theft|steal|shoplift|robbery|handling/i,['What are the proofs for theft?','How do I prove dishonesty?','What CCTV do I need to collect?']],
 [/burglar/i,['What are the proofs for burglary?','What is recent possession?','What should I look for at the point of entry?']],
 [/drug|cannabis|cocaine|mda/i,['What are my search powers for drugs?','How do I prove possession for sale or supply?','What do I record when I seize drugs?']],
 [/caution|interview|question|silence|inference/i,['When must I caution?','What inferences can be drawn from silence?','How do I plan an interview?']],
 [/statement|witness|proof/i,['What must a witness statement cover?','How do I write my own statement?','What is the 5-part structure?']],
 [/cctv|footage|camera/i,['How do I request CCTV?','How long is CCTV usually kept?','What goes in a CCTV continuity statement?']],
 [/domestic|barring|safety order|coercive/i,['What are my powers of arrest for a barring order breach?','What do I record at a domestic incident?','What is coercive control?']],
 [/identif|parade|recogni/i,['When is an identification parade needed?','What is ADVOKATE?','Is dock identification enough?']]
];
function nextFor(q){ const out=[]; NEXT.forEach(([re,qs])=>{ if(re.test(q))qs.forEach(x=>{ if(x.toLowerCase()!==q.toLowerCase()&&!out.includes(x))out.push(x); }); }); return out.slice(0,4); }
/* search.js calls these */
W.GRAsk={
 isDo:k=>DO.has(k),
 block(items,q){ const isQ=/\?\s*$/.test(q)||q.trim().split(/\s+/).length>=3;
   // suggest a tool only when its own name shares a real word with the question — not just any match deep in its text
   const STOP=new Set('the and for with that this what when where which who how can could should would will does did not him his her she they them you your have has had are was were been from into about give gave get got want wont won dont don cant isnt out off any one make made need there their then than very just also only over under after before while do to me my of on in it is be as at an a i he we or if so no up'.split(' '));
   const toks=[...new Set(q.toLowerCase().replace(/[’']/g,'').split(/[^a-z0-9.]+/).filter(w=>w.length>=3&&!STOP.has(w)).map(w=>w.slice(0,5)))];
   const sc=it=>{ const t=(' '+it.t+' '+(it.l||'')).toLowerCase().replace(/[’']/g,''); let n=0; toks.forEach(w=>{ if(t.includes(' '+w)||t.includes('.'+w))n++; }); return n; };
   const feats=items.slice(0,80).map((it,i)=>[it,i,DO.has(it.k)?sc(it):0]).filter(x=>x[2]>=(x[0].k==='fa'?2:1)).sort((a,b)=>b[2]-a[2]||a[1]-b[1]).slice(0,3);
   const nx=isQ?nextFor(q):[]; if(!feats.length&&!nx.length)return '';
   const ic=c=>W.GRPro?GRPro.icon(c,36):'';
   return '<div class="pro as-open">'+(feats.length?'<div class="p-sec"><b>Open in the app</b></div><div class="p-card">'+feats.map(([it,i])=>'<button type="button" class="p-row as-go" data-i="'+i+'">'+ic(ICON[it.k]||'1f4c4')+'<span class="p-tx"><b>'+esc(it.t)+'</b><small>'+esc(it.l||'')+'</small></span><i class="p-ch" aria-hidden="true">›</i></button>').join('')+'</div>':'')
     +(nx.length?'<div class="p-sec"><b>Ask next</b></div><div class="p-chips as-next">'+nx.map(x=>'<button type="button">'+esc(x)+'</button>').join('')+'</div>':'')+'</div>'; },
 next:nextFor };
})();
