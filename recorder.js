/* Garda Reference — Voice recorder.
   Record with pause/resume, ⚑ markers, a live scrolling waveform + level meter and keep-screen-on. Crash-safe: every
   1-second chunk is written to IndexedDB as it arrives, and an interrupted recording is offered for recovery on the next
   open. Recordings list with inline play, player (waveform seek bar with marker flags, ±10 s, 1×–2× speed), rename,
   delete and save to phone. Self-contained IIFE: no dependencies, no network. Audio lives only in IndexedDB "gr_rec"
   on this phone. Styles in recorder.css (#rec / .rec scoped). */
(function(){
'use strict';
const W=window, D=document;
const TIMESLICE=1000, BITRATE=64000, BAR_MS=50, PEAK_MS=100, LIVE_GRACE=6000, LOCK='gr_rec_live_';
const MIMES=['audio/mp4;codecs=mp4a.40.2','audio/mp4','audio/webm;codecs=opus','audio/webm'];
const SPEEDS=[1,1.25,1.5,2];
const NOTICE='Recordings are kept only on this phone — not uploaded or backed up. Not for interviews under caution: those must be recorded on the station’s approved system. Recording people is processing personal data — tell people you’re recording where appropriate, keep only what you need and delete recordings when no longer needed.';

/* ---------- small helpers ---------- */
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const p2=n=>String(n).padStart(2,'0');
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const q=(r,s)=>r.querySelector(s), qa=(r,s)=>Array.from(r.querySelectorAll(s));
const svg=(p,cls)=>'<svg viewBox="0 0 24 24" aria-hidden="true"'+(cls?' class="'+cls+'"':'')+'>'+p+'</svg>';
function el(html){const t=D.createElement('template');t.innerHTML=html.trim();return t.content.firstElementChild;}
const vib=p=>{try{if(navigator.vibrate)navigator.vibrate(p);}catch(e){}};
const LSget=(k,d)=>{try{const v=localStorage.getItem('gr_rec_'+k);return v==null?d:JSON.parse(v);}catch(e){return d;}};
const LSset=(k,v)=>{try{localStorage.setItem('gr_rec_'+k,JSON.stringify(v));}catch(e){}};
const uid=()=>'r'+Date.now().toString(36)+Math.random().toString(36).slice(2,7);
const DAYS=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'], MON=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const hm=t=>{const d=new Date(t);return p2(d.getHours())+':'+p2(d.getMinutes());};
const hms=t=>{const d=new Date(t);return hm(t)+':'+p2(d.getSeconds());};
const dayLong=t=>{const d=new Date(t);return DAYS[d.getDay()]+' '+d.getDate()+' '+MON[d.getMonth()]+' '+d.getFullYear();};
function clock(ms){const s=Math.max(0,Math.floor((ms||0)/1000));return p2(Math.floor(s/3600))+':'+p2(Math.floor(s/60)%60)+':'+p2(s%60);}
function durTxt(ms){const s=Math.max(0,Math.floor((ms||0)/1000)),h=Math.floor(s/3600),m=Math.floor(s/60)%60,x=s%60;return h?h+':'+p2(m)+':'+p2(x):m+':'+p2(x);}
function sizeTxt(b){b=+b||0;if(b<1048576)return Math.max(b?1:0,Math.round(b/1024))+' KB';if(b<1073741824)return (b/1048576).toFixed(b<10485760?1:0)+' MB';return (b/1073741824).toFixed(2)+' GB';}
const plural=(n,w)=>n+' '+w+(n===1?'':'s');
const defName=t=>{const d=new Date(t);return 'Recording '+d.getDate()+' '+MON[d.getMonth()]+' '+d.getFullYear()+' '+hm(t);};
const extOf=m=>/mp4|m4a|aac/i.test(m||'')?'m4a':/webm/i.test(m||'')?'webm':/ogg/i.test(m||'')?'ogg':'audio';
const fmtName=m=>({m4a:'M4A',webm:'WebM',ogg:'Ogg'})[extOf(m)]||'Audio';
function fileName(r){ // plain ASCII: some download managers drop a name with é or — and save "download" with no extension
  const base=String(r.name||defName(r.created)).normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/(\d{1,2}):(\d{2})/g,'$1$2')
    .replace(/[‐-―−]/g,'-').replace(/[’‘'`]/g,'').replace(/[^A-Za-z0-9 ._()-]+/g,' ')
    .replace(/\s+/g,' ').trim().slice(0,80).replace(/ /g,'_').replace(/^[._-]+|[._-]+$/g,'')||'Recording';
  return base+'.'+extOf(r.mime);
}
function cvFit(cv){
  const r=cv.getBoundingClientRect(),dpr=W.devicePixelRatio||1,w=Math.max(1,Math.round(r.width)),h=Math.max(1,Math.round(r.height));
  if(cv.width!==Math.round(w*dpr)||cv.height!==Math.round(h*dpr)){cv.width=Math.round(w*dpr);cv.height=Math.round(h*dpr);}
  const c=cv.getContext('2d');c.setTransform(dpr,0,0,dpr,0,0);return {c,w,h};
}
const DLS=new Set();
function download(blob,name){
  const u=URL.createObjectURL(blob),a=D.createElement('a');a.href=u;a.download=name;a.rel='noopener';a.style.display='none';
  (ov||D.body).appendChild(a);a.click();a.remove();DLS.add(u);
  setTimeout(()=>{if(DLS.delete(u)){try{URL.revokeObjectURL(u);}catch(e){}}},30000);
}
function hud(){try{if(W.grHudTick)W.grHudTick();}catch(e){}}

/* ---------- icons (stroke line art, currentColor) ---------- */
const IC={
  info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5h.01" stroke-width="2"/>',
  mic:'<rect x="9" y="2.8" width="6" height="11.5" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5v3.7M8.5 21.2h7"/>',
  play:'<path d="M8 5.2v13.6L19 12z" fill="currentColor" stroke="none"/>',
  pause:'<rect x="6.3" y="5" width="4" height="14" rx="1.2" fill="currentColor" stroke="none"/><rect x="13.7" y="5" width="4" height="14" rx="1.2" fill="currentColor" stroke="none"/>',
  stop:'<rect x="6" y="6" width="12" height="12" rx="2.2" fill="currentColor" stroke="none"/>',
  flag:'<path d="M6 21.5V3.5"/><path d="M6 4h11.5l-2.8 4.2 2.8 4.3H6z" fill="currentColor"/>',
  rw:'<path d="M4.2 12a7.8 7.8 0 1 0 2.3-5.5"/><path d="M4 3.6v3.8h3.8"/>',
  ff:'<path d="M19.8 12a7.8 7.8 0 1 1-2.3-5.5"/><path d="M20 3.6v3.8h-3.8"/>',
  pen:'<path d="M4 20l1.2-4.5L16 4.7a2 2 0 0 1 2.8 0l.5.5a2 2 0 0 1 0 2.8L8.5 18.8z"/><path d="M14.4 6.3l3.3 3.3"/>',
  download:'<path d="M12 3.5v12M7 10.5l5 5 5-5M4.5 20.5h15"/>',
  trash:'<path d="M4 6.5h16M9.5 6.5V4.2h5v2.3M6 6.5l1 13.3a1.5 1.5 0 0 0 1.5 1.4h7a1.5 1.5 0 0 0 1.5-1.4l1-13.3M10 10.5v6.5M14 10.5v6.5"/>',
  warn:'<path d="M12 3.6 2.6 20h18.8z"/><path d="M12 10v4.6M12 17.3h.01" stroke-width="2"/>',
  restore:'<path d="M4 12a8 8 0 1 0 2.4-5.7"/><path d="M4 4v4.5h4.5"/><path d="M12 8v4.3l2.8 1.7"/>',
  chev:'<path d="m9.5 5.5 6.5 6.5-6.5 6.5"/>',
  shield:'<path d="M12 3 4.5 6v5.5c0 4.6 3.1 8.1 7.5 9.5 4.4-1.4 7.5-4.9 7.5-9.5V6z"/><path d="m8.8 12 2.3 2.3 4.3-4.6"/>'
};

/* ---------- IndexedDB "gr_rec" v1: recs (metadata) · chunks ([rid,seq] → audio pieces) · live (recording in progress) ---------- */
let dbP=null;
function idb(){
  if(dbP)return dbP;
  dbP=new Promise((res,rej)=>{
    let r; try{r=indexedDB.open('gr_rec',1);}catch(e){dbP=null;rej(e);return;}
    r.onupgradeneeded=()=>{const db=r.result;
      if(!db.objectStoreNames.contains('recs'))db.createObjectStore('recs',{keyPath:'id'});
      if(!db.objectStoreNames.contains('chunks'))db.createObjectStore('chunks',{keyPath:['rid','seq']});
      if(!db.objectStoreNames.contains('live'))db.createObjectStore('live',{keyPath:'id'});};
    r.onsuccess=()=>{const db=r.result;db.onversionchange=()=>{try{db.close();}catch(e){}dbP=null;};db.onclose=()=>{dbP=null;};res(db);};
    r.onerror=()=>{dbP=null;rej(r.error||new Error('Storage unavailable'));};
  });
  return dbP;
}
function run(stores,mode,fn){
  return idb().then(db=>new Promise((res,rej)=>{
    let t; try{t=db.transaction(stores,mode);}catch(e){dbP=null;rej(e);return;}
    let out; t.oncomplete=()=>res(out); t.onerror=()=>rej(t.error); t.onabort=()=>rej(t.error||new Error('Save aborted'));
    try{const v=fn(t,x=>{out=x;}); if(v!==undefined)out=v;}catch(e){try{t.abort();}catch(_){}rej(e);}
  }));
}
const rq=(req,cb)=>{req.onsuccess=()=>cb(req.result);};
const rng=rid=>IDBKeyRange.bound([rid,-Infinity],[rid,Infinity]);
const allOf=st=>run([st],'readonly',(t,set)=>rq(t.objectStore(st).getAll(),set));
const putRec=rec=>run(['recs'],'readwrite',t=>{t.objectStore('recs').put(rec);});
const chunkRecs=rid=>run(['chunks'],'readonly',(t,set)=>rq(t.objectStore('chunks').getAll(rng(rid)),r=>set(r||[])));
const piecesOf=rid=>chunkRecs(rid).then(cs=>cs.map(x=>x.blob));
function peaksOf(cs){ let n=0; cs.forEach(c=>{if(c.pk&&c.pk.length)n=Math.max(n,(c.pkFrom||0)+c.pk.length);}); const a=new Uint8Array(n);
  cs.forEach(c=>{if(c.pk&&c.pk.length)a.set(c.pk,c.pkFrom||0);}); return a; }
function blobOf(rec){return piecesOf(rec.id).then(ps=>{if(!ps.length)throw new Error('The audio for this recording is missing.');return new Blob(ps,{type:rec.mime||'audio/webm'});});}
const dropAudio=rid=>run(['recs','chunks','live'],'readwrite',t=>{t.objectStore('recs').delete(rid);t.objectStore('live').delete(rid);t.objectStore('chunks').delete(rng(rid));});
let persistAsked=false;
function askPersist(){ if(persistAsked)return; persistAsked=true; try{ if(navigator.storage&&navigator.storage.persist)navigator.storage.persist().catch(()=>{}); }catch(e){} }
function room(){ const S=navigator.storage; if(!S||!S.estimate)return Promise.resolve(null);
  return S.estimate().then(e=>e&&e.quota?Math.max(0,e.quota-(e.usage||0)):null).catch(()=>null); }
const isQuota=e=>/Quota/i.test(String(e&&(e.name||e.message)||e));
function storageErr(e){
  const m=String(e&&(e.name||e.message)||e);
  if(/Quota/i.test(m))return 'Phone storage is full. Free some space — delete old recordings, photos or files — and try again.';
  if(/Security|InvalidState|UnknownError/i.test(m))return 'This browser is blocking storage for the app (private browsing or site data blocked). Recordings need normal browsing so they can be kept safely.';
  return 'Storage error: '+((e&&e.message)||m);
}
function micErr(e){
  const n=e&&e.name;
  if(n==='NotAllowedError'||n==='SecurityError'||n==='PermissionDeniedError')
    return 'Microphone permission was refused. Allow it in Chrome: ⋮ menu → Settings → Site settings → Microphone → allow this app. If it is already allowed there, check Android Settings → Apps → Chrome → Permissions → Microphone. Then tap Record again.';
  if(n==='NotFoundError'||n==='DevicesNotFoundError'||n==='OverconstrainedError')return 'No microphone was found on this device.';
  if(n==='NotReadableError'||n==='TrackStartError'||n==='AbortError')return 'The microphone is busy — another app or a call is using it. Close it and tap Record again.';
  return 'The microphone could not start: '+((e&&e.message)||n||'unknown error')+'.';
}
function pickMime(){
  if(typeof MediaRecorder.isTypeSupported!=='function')return '';
  for(const m of MIMES){try{if(MediaRecorder.isTypeSupported(m))return m;}catch(e){}}
  return '';
}

/* =====================================================================
   OVERLAY SHELL: top bar, toast, bottom sheets, Back
   ===================================================================== */
let ov=null, mainEl=null, ttlEl=null, shadeEl=null, sheetEl=null, toastEl=null, toastT=0;
let view='list', curId=null, hiId=null, recErr='';
let RECS=[], ORPH=[], loaded=false, gcDone=false;
const offered=new Set();
const byId=id=>RECS.find(r=>r.id===id)||null;
function build(){
  if(ov&&ov.isConnected)return;
  if(!D.querySelector('link[href*="recorder.css"]')){const l=D.createElement('link');l.rel='stylesheet';l.href='recorder.css';D.head.appendChild(l);}
  ov=el('<div id="rec" class="rec" role="dialog" aria-modal="true" aria-label="Voice recorder" tabindex="-1" hidden>'
    +'<div class="rec-top"><button type="button" class="rec-back" aria-label="Back">‹ Back</button>'
    +'<div class="rec-tt"><b class="rec-title">Voice recorder</b><span class="hudclock" data-f="line"></span></div>'
    +'<button type="button" class="rec-ib rec-info" aria-label="About recordings">'+svg(IC.info)+'</button></div>'
    +'<div class="rec-main"></div><div class="rec-shade" hidden></div><div class="rec-sheet" role="dialog" aria-modal="true" hidden></div>'
    +'<div class="rec-toast" role="status" aria-live="polite"></div></div>');
  D.body.appendChild(ov);
  mainEl=q(ov,'.rec-main'); ttlEl=q(ov,'.rec-title'); shadeEl=q(ov,'.rec-shade'); sheetEl=q(ov,'.rec-sheet'); toastEl=q(ov,'.rec-toast');
  q(ov,'.rec-back').addEventListener('click',()=>recBack());
  q(ov,'.rec-info').addEventListener('click',()=>noticeSheet());
  shadeEl.addEventListener('click',()=>closeSheet());
  mainEl.addEventListener('click',onMainClick);
}
function setTitle(t){ ttlEl.textContent=t; ov.dataset.v=view; hud(); }
function toast(m,act){
  if(!toastEl){if(W.grToast)W.grToast(m);return;}
  toastEl.innerHTML='<span>'+esc(m)+'</span>'+(act?'<button type="button" class="rec-tact">'+esc(act.label)+'</button>':'');
  toastEl.classList.toggle('rec-hasact',!!act); toastEl.classList.add('rec-on');
  if(act)q(toastEl,'.rec-tact').onclick=()=>{toastEl.classList.remove('rec-on');try{act.fn();}catch(e){console.error(e);}};
  clearTimeout(toastT); toastT=setTimeout(()=>toastEl&&toastEl.classList.remove('rec-on'),act?5200:3000);
}
let sheetOnClose=null;
function sheet(html,wire,onClose){
  if(sheetOnClose){const f=sheetOnClose;sheetOnClose=null;try{f();}catch(e){}}
  clearTimeout(toastT); if(toastEl)toastEl.classList.remove('rec-on');
  sheetEl.innerHTML=''; const box=D.createElement('div'); box.className='rec-sin';
  box.innerHTML='<div class="rec-grip"></div>'+html; sheetEl.appendChild(box); sheetEl.hidden=false; shadeEl.hidden=false; sheetOnClose=onClose||null;
  qa(box,'.rec-x').forEach(b=>b.addEventListener('click',()=>closeSheet()));
  if(wire)wire(box); sheetEl.scrollTop=0; hud();
}
function closeSheet(){
  if(!sheetEl||sheetEl.hidden)return;
  sheetEl.hidden=true; sheetEl.innerHTML=''; shadeEl.hidden=true;
  if(sheetOnClose){const f=sheetOnClose;sheetOnClose=null;try{f();}catch(e){}}
}
function confirmSheet(title,html,okLabel,danger,fn){
  sheet('<h3>'+esc(title)+'</h3><p class="rec-note">'+html+'</p><div class="rec-row2"><button type="button" class="rec-go'+(danger?' rec-danger':'')+' rec-ok">'+esc(okLabel)+'</button><button type="button" class="rec-b2 rec-x">Cancel</button></div>',
    r=>{q(r,'.rec-ok').onclick=()=>{closeSheet();fn();};});
}
function onKey(e){ if(!ov||ov.hidden)return; if(e.key==='Escape'){e.preventDefault();e.stopPropagation();recBack();} }
let listening=false;
function listen(on){ if(on===listening)return; listening=on; W[on?'addEventListener':'removeEventListener']('keydown',onKey,true); }

/* phone Back: sheet → record / player → list → close */
function recBack(){
  if(!ov||ov.hidden||!ov.isConnected)return false;
  if(!sheetEl.hidden){closeSheet();return true;}
  if(view==='rec'){
    if(R&&R.phase==='starting'){R=null;toList();return true;}
    if(R&&(R.phase==='rec'||R.phase==='paused')){askStop(false);return true;}
    if(R&&R.phase==='stopping'){toast('Saving the recording…');return true;}
    toList(); return true;
  }
  if(view==='play'){toList();return true;}
  closeRecorder(); return true;
}
function openRecorder(){
  build(); const was=ov.hidden; ov.hidden=false; D.body.classList.add('rec-open'); listen(true);
  if(was){try{ov.focus({preventScroll:true});}catch(e){}}
  if(R&&R.phase!=='done'){ if(view!=='rec')renderRec(); }
  else if(was||view==='list'){ view='list'; renderList(true); }
  hud(); return true;
}
function closeRecorder(){
  if(!ov||ov.hidden)return true;
  if(R&&(R.phase==='rec'||R.phase==='paused')){ if(view!=='rec')renderRec(); askStop(true); return false; }
  if(R&&R.phase==='stopping')return false;
  if(R&&R.phase==='starting')R=null;
  closeSheet(); unload(); stopDraw(); wakeSync();
  ov.hidden=true; D.body.classList.remove('rec-open'); listen(false);
  clearTimeout(toastT); toastEl.classList.remove('rec-on');
  mainEl.innerHTML=''; view='list'; curId=null; recErr='';
  DLS.forEach(u=>setTimeout(()=>{if(DLS.delete(u)){try{URL.revokeObjectURL(u);}catch(e){}}},4000));
  return true;
}
function toList(){ unloadIfNot(null); view='list'; recErr=''; renderList(false); }

/* =====================================================================
   RECORDING ENGINE
   ===================================================================== */
let R=null;               // the recording in progress: {phase:'starting'|'rec'|'paused'|'stopping'|'done', …}
let tS=0, tU=0, tR=0, raf=0;
const elapsed=()=>!R?0:R.acc+(R.run&&R.t0?performance.now()-R.t0:0);
const keepOn=()=>LSget('keep',true)!==false;
function liveRec(r,t){   // small, rewritten every second; the waveform peaks travel with each chunk instead
  return {id:r.id,name:r.name,started:r.started,mime:r.mime,dur:Math.round(t==null?(r.savedDur||0):t),bytes:r.bytes,
    markers:r.markers.slice(),updated:Date.now()};
}
function uniqueName(n){ if(!RECS.some(r=>r.name===n))return n; let i=2; while(RECS.some(r=>r.name===n+' ('+i+')'))i++; return n+' ('+i+')'; }
async function startRec(){
  if(R&&R.phase!=='done')return;
  recErr='';
  const md=navigator.mediaDevices;
  if(!md||!md.getUserMedia){ recErr=W.isSecureContext===false?'Recording needs the app to be opened over https.':'This browser can’t use the microphone.'; paintRec(); return; }
  if(!W.MediaRecorder){ recErr='This browser can’t record audio (MediaRecorder isn’t available). Update Chrome and try again.'; paintRec(); return; }
  unload();                                                         // never record the playback
  const r=R={phase:'starting',id:uid(),markers:[],peaks:[],pkSaved:0,disp:[],dispOff:0,acc:0,t0:0,run:false,seq:0,parts:[],bytes:0,q:Promise.resolve(),
    started:0,mime:'',name:'',savedDur:0,muted:false,lvl:null};
  paintRec();
  try{ await idb(); }catch(e){ if(R===r)R=null; recErr=storageErr(e); paintRec(); return; }
  const left=await room();
  if(R!==r)return;
  if(left!=null&&left<4*1048576){ R=null; recErr='Phone storage is full — there is no room to save a recording. Free some space (old recordings, photos, downloads) and try again.'; paintRec(); return; }
  r.low=left!=null&&left<120*1048576?left:0;
  let st;
  try{ st=await md.getUserMedia({audio:{channelCount:{ideal:1},echoCancellation:false,noiseSuppression:false,autoGainControl:true},video:false}); }
  catch(e){ if(R===r){R=null;recErr=micErr(e);paintRec();} return; }
  if(R!==r||!ov||ov.hidden||view!=='rec'){ st.getTracks().forEach(t=>{try{t.stop();}catch(e){}}); if(R===r)R=null; return; }
  r.stream=st;
  const mime=pickMime(); let mr=null;
  try{ mr=new MediaRecorder(st,mime?{mimeType:mime,audioBitsPerSecond:BITRATE}:{audioBitsPerSecond:BITRATE}); }
  catch(e){ try{mr=new MediaRecorder(st);}catch(e2){} }
  if(!mr){ release(r); R=null; recErr='This phone can’t record audio in a format the app can save.'; paintRec(); return; }
  r.mr=mr; r.mime=mr.mimeType||mime||'audio/webm';
  r.started=Date.now(); r.name=uniqueName(defName(r.started));
  try{ await run(['live'],'readwrite',t=>{t.objectStore('live').put(liveRec(r,0));}); }
  catch(e){ release(r); if(R===r)R=null; recErr=storageErr(e); paintRec(); return; }
  if(R!==r){ release(r); run(['live'],'readwrite',t=>{t.objectStore('live').delete(r.id);}).catch(()=>{}); return; }
  analyser(r);
  mr.ondataavailable=e=>onData(r,e);
  mr.onerror=e=>{ if(R===r)stopRec('The recorder reported an error'+(e&&e.error&&e.error.message?' ('+e.error.message+')':'')+', so the recording was stopped and saved.'); };
  const tr=st.getAudioTracks()[0];
  if(tr){
    tr.onended=()=>{ if(R===r&&(r.phase==='rec'||r.phase==='paused'))stopRec('The microphone was switched off or taken by another app (for example a phone call), so the recording was stopped and saved up to that point.'); };
    tr.onmute=()=>{r.muted=true;paintRec();}; tr.onunmute=()=>{r.muted=false;paintRec();};
  }
  try{ mr.start(TIMESLICE); }
  catch(e){ release(r); R=null; run(['live'],'readwrite',t=>{t.objectStore('live').delete(r.id);}).catch(()=>{}); recErr='The recorder could not start: '+(e.message||e.name)+'.'; paintRec(); return; }
  r.phase='rec'; r.run=true; r.t0=performance.now();
  holdLock(r); W.addEventListener('beforeunload',onUnload);
  clearInterval(tS); clearInterval(tU); clearInterval(tR);
  tS=setInterval(sampleTick,BAR_MS); tU=setInterval(uiTick,250); tR=setInterval(roomTick,30000);
  wakeSync(); renderRec(); vib(40);
}
function onData(r,e){
  const b=e&&e.data; if(!b||!b.size)return;
  if(b.type&&!r.typed){r.typed=true;if(/^audio\//.test(b.type))r.mime=b.type;}
  const seq=++r.seq, t=Math.round(r===R?elapsed():r.acc), pkFrom=r.pkSaved, pk=Uint8Array.from(r.peaks.slice(pkFrom)); r.pkSaved=r.peaks.length;
  r.parts.push(b); r.bytes+=b.size;
  r.q=r.q.then(()=>{ if(r.broken)return;
    return run(['chunks','live'],'readwrite',tx=>{tx.objectStore('chunks').put({rid:r.id,seq,blob:b,pkFrom,pk});tx.objectStore('live').put(liveRec(r,t));})
      .then(()=>{r.savedDur=t;},err=>{ if(!r.broken){ r.broken=err; if(R===r&&(r.phase==='rec'||r.phase==='paused'))setTimeout(()=>stopRec(null),0); } });
  });
}
function saveLive(r){ r.q=r.q.then(()=>{ if(!r.broken)return run(['live'],'readwrite',t=>{t.objectStore('live').put(liveRec(r));}).catch(()=>{}); }); }
function analyser(r){
  const AC=W.AudioContext||W.webkitAudioContext; if(!AC)return;
  try{ const ac=new AC(), src=ac.createMediaStreamSource(r.stream), an=ac.createAnalyser(); an.fftSize=2048; an.smoothingTimeConstant=0;
    src.connect(an); r.ac=ac; r.src=src; r.an=an; r.buf=new Float32Array(an.fftSize); if(ac.state==='suspended'&&ac.resume)ac.resume().catch(()=>{}); }
  catch(e){ r.ac=r.src=r.an=null; }
}
function putPeak(arr,i,v,maxGap){ const n=arr.length; if(i<n){if(v>arr[i])arr[i]=v;return;} const f=i-n<=maxGap?v:0; for(let k=n;k<i;k++)arr.push(f); arr.push(v); }
function sampleTick(){
  const r=R; if(!r||!r.an)return;
  r.an.getFloatTimeDomainData(r.buf); let pk=0,ss=0; const b=r.buf;
  for(let i=0;i<b.length;i++){const v=b[i],a=v<0?-v:v;if(a>pk)pk=a;ss+=v*v;}
  const rms=Math.sqrt(ss/b.length), now=performance.now();
  const L=r.lvl||(r.lvl={pk:0,rms:0,hold:0,holdAt:0,clipAt:-1e9});
  L.pk=pk; L.rms=rms; if(pk>=L.hold||now-L.holdAt>1500){L.hold=pk;L.holdAt=now;} if(pk>=0.98)L.clipAt=now;
  if(!r.run)return;
  const t=elapsed(), v=Math.round(clamp((20*Math.log10(pk+1e-9)+60)/60,0,1)*255);
  putPeak(r.disp,Math.floor(t/BAR_MS)-r.dispOff,v,40); putPeak(r.peaks,Math.floor(t/PEAK_MS),v,20);
  if(r.disp.length>2400){r.disp.splice(0,1200);r.dispOff+=1200;}
}
function uiTick(){
  if(!R||!ov||ov.hidden)return;
  const t=elapsed(), tm=view==='rec'&&q(mainEl,'.rec-timer'); if(tm){const s=clock(t);if(tm._s!==s){tm._s=s;tm.textContent=s;}}
  const a=!sheetEl.hidden&&q(sheetEl,'.rec-askt'); if(a)a.textContent=clock(t);
}
function roomTick(){
  const r=R; if(!r||(r.phase!=='rec'&&r.phase!=='paused'))return;
  room().then(left=>{ if(R!==r||left==null)return;
    if(left<8*1048576){ stopRec('Phone storage is almost full, so the recording was stopped and saved. Free some space before recording again.'); return; }
    r.low=left<120*1048576?left:0; paintRec(); });
}
function pauseRec(){ const r=R; if(!r||r.phase!=='rec')return; try{r.mr.pause();}catch(e){toast('Pause isn’t supported here');return;}
  r.acc+=performance.now()-r.t0; r.run=false; r.phase='paused'; saveLive(r); vib(25); wakeSync(); paintRec(); }
function resumeRec(){ const r=R; if(!r||r.phase!=='paused')return; try{r.mr.resume();}catch(e){return;}
  r.t0=performance.now(); r.run=true; r.phase='rec'; vib(25); wakeSync(); paintRec(); }
function markRec(){
  const r=R; if(!r||(r.phase!=='rec'&&r.phase!=='paused'))return;
  const t=Math.round(elapsed()), last=r.markers[r.markers.length-1];
  if(last&&Math.abs(t-last.t)<700){toast('A marker is already here');return;}
  r.markers.push({t,at:Date.now()}); saveLive(r); vib([15,40,15]);
  const b=q(mainEl,'.rec-mk'); if(b){b.classList.remove('rec-flash');void b.offsetWidth;b.classList.add('rec-flash');}
  toast('⚑ Marker '+r.markers.length+' at '+clock(t)); paintRec();
}
function stopRec(why){
  const r=R; if(!r||(r.phase!=='rec'&&r.phase!=='paused'))return Promise.resolve();
  if(r.run){r.acc+=performance.now()-r.t0;r.run=false;}
  r.phase='stopping'; r.ended=Date.now(); r.why=why||''; closeSheet(); paintRec();
  const mr=r.mr, stopped=new Promise(res=>{ if(!mr||mr.state==='inactive'){res();return;} mr.addEventListener('stop',()=>res(),{once:true}); setTimeout(res,4000); try{mr.stop();}catch(e){res();} });
  return stopped.then(()=>r.q).then(()=>finish(r));
}
function discardRec(){
  const r=R; if(!r||(r.phase!=='rec'&&r.phase!=='paused'))return;
  r.phase='stopping'; r.discard=true; r.run=false; closeSheet(); paintRec();
  const mr=r.mr, stopped=new Promise(res=>{ if(!mr||mr.state==='inactive'){res();return;} mr.addEventListener('stop',()=>res(),{once:true}); setTimeout(res,4000); try{mr.stop();}catch(e){res();} });
  stopped.then(()=>r.q).then(()=>{ release(r); r.parts=[]; r.phase='done'; if(R===r)R=null;
    return dropAudio(r.id).catch(()=>{}); }).then(()=>{ wakeSync(); if(ov&&!ov.hidden){view='list';renderList(false);toast('Recording discarded');} });
}
function release(r){
  if(r===R){clearInterval(tS);clearInterval(tU);clearInterval(tR);tS=tU=tR=0;stopDraw();}
  try{if(r.src)r.src.disconnect();}catch(e){}
  try{if(r.ac&&r.ac.state!=='closed')r.ac.close().catch(()=>{});}catch(e){}
  r.ac=r.src=r.an=null;
  if(r.stream){r.stream.getTracks().forEach(t=>{t.onended=t.onmute=t.onunmute=null;try{t.stop();}catch(e){}});r.stream=null;}
  if(r.mr){r.mr.ondataavailable=null;r.mr.onerror=null;}
  if(r.unlock){try{r.unlock();}catch(e){}r.unlock=null;}
  W.removeEventListener('beforeunload',onUnload);
}
async function finish(r){
  release(r);
  const dur=Math.round(r.acc);
  const rec={id:r.id,name:r.name,created:r.started,dur,size:r.bytes,mime:r.mime,markers:r.markers.filter(m=>m.t<=dur+250),
    peaks:Uint8Array.from(r.peaks),ended:r.ended};
  if(!r.parts.length){
    await dropAudio(r.id).catch(()=>{}); r.phase='done'; if(R===r)R=null; wakeSync();
    if(ov&&!ov.hidden){ view='rec'; recErr='Nothing was recorded — the microphone gave no sound. Tap Record to try again.'; renderRec(); }
    return;
  }
  let err=r.broken||null;
  if(!err){ try{ await run(['recs','live'],'readwrite',t=>{t.objectStore('recs').put(rec);t.objectStore('live').delete(r.id);}); askPersist(); }catch(e){err=e;} }
  r.phase='done'; if(R===r)R=null; wakeSync();
  if(err){ const blob=new Blob(r.parts,{type:r.mime}); r.parts=[]; if(ov&&!ov.hidden){view='list';renderList(true);} failSheet(rec,blob,err); return; }
  r.parts=[];
  RECS=RECS.filter(x=>x.id!==rec.id); RECS.unshift(rec); hiId=rec.id;
  if(ov&&!ov.hidden){
    view='list'; renderList(false);
    if(r.why)sheet('<h3>'+svg(IC.warn)+' Recording stopped</h3><p class="rec-note">'+esc(r.why)+'</p><p class="rec-note">Saved as “'+esc(rec.name)+'” — '+esc(durTxt(dur))+'.</p><button type="button" class="rec-go rec-wide rec-x">OK</button>');
    else toast('Saved “'+rec.name+'”',{label:'Rename',fn:()=>{const x=byId(rec.id);if(x)renameSheet(x);}});
  }
}
function onUnload(e){ if(R&&(R.phase==='rec'||R.phase==='paused')){e.preventDefault();e.returnValue='';return '';} }
function holdLock(r){ const L=navigator.locks; if(!L||!L.request)return;
  try{ L.request(LOCK+r.id,()=>new Promise(res=>{ if(r.phase==='done'){res();return;} r.unlock=res; })).catch(()=>{}); }catch(e){} }
function heldNames(){ const L=navigator.locks, none=Object.assign(new Set(),{none:true}); if(!L||!L.query)return Promise.resolve(none);
  return L.query().then(s=>new Set([].concat(s.held||[],s.pending||[]).map(x=>x.name))).catch(()=>none); }

/* ---------- screen wake lock (record screen, while a recording runs) ---------- */
let wl=null, wlWant=false, wlBusy=false;
function wakeSync(){ wlWant=!!(R&&(R.phase==='rec'||R.phase==='paused'||R.phase==='stopping')&&keepOn()&&ov&&!ov.hidden); if(wlWant)wakeReq(); else wakeRel(); }
function wakeReq(){
  if(!wlWant||wl||wlBusy||!navigator.wakeLock||D.visibilityState!=='visible')return; wlBusy=true;
  navigator.wakeLock.request('screen').then(l=>{ wlBusy=false; if(!wlWant){l.release().catch(()=>{});return;} wl=l; l.addEventListener('release',()=>{if(wl===l)wl=null;}); })
    .catch(()=>{wlBusy=false;});
}
function wakeRel(){ if(wl){const l=wl;wl=null;l.release().catch(()=>{});} }
D.addEventListener('visibilitychange',()=>{ if(D.visibilityState!=='visible')return; wakeReq(); if(ov&&!ov.hidden&&view==='rec'&&R)drawLoop(); });

/* =====================================================================
   RECORD SCREEN
   ===================================================================== */
function renderRec(){
  view='rec'; stopPlayLoop();
  mainEl.innerHTML='<div class="rec-rv">'
    +'<div class="rec-rbody">'
      +'<div class="rec-stat"><span class="rec-pill"></span><span class="rec-since"></span></div>'
      +'<div class="rec-timer rec-num" aria-live="off">00:00:00</div>'
      +'<div class="rec-wave"><canvas aria-hidden="true"></canvas><p class="rec-wmsg"></p></div>'
      +'<div class="rec-lvl" aria-hidden="true"><div class="rec-lbar"><i></i><em></em></div><span class="rec-ldb rec-num">—</span></div>'
      +'<div class="rec-mchips" aria-label="Markers"></div>'
      +'<div class="rec-err" role="alert" hidden></div>'
    +'</div>'
    +'<div class="rec-ctl">'
      +'<div class="rec-cb"><button type="button" class="rec-cbtn rec-mk" data-a="mark" aria-label="Add a marker">'+svg(IC.flag)+'</button><span>Mark</span></div>'
      +'<div class="rec-cb rec-cbm"><button type="button" class="rec-big" data-a="toggle" aria-label="Record"><i></i></button><span class="rec-bigl">Record</span></div>'
      +'<div class="rec-cb"><button type="button" class="rec-cbtn rec-st" data-a="stop" aria-label="Stop and save">'+svg(IC.stop)+'</button><span>Stop &amp; save</span></div>'
    +'</div>'
    +'<label class="rec-keep"><input type="checkbox"'+(keepOn()?' checked':'')+'><span><b>Keep screen on</b><small>Most reliable while recording. With the screen off, recording carries on in the background on most phones.</small></span></label>'
    +'<p class="rec-fmt"></p></div>';
  q(mainEl,'.rec-keep input').addEventListener('change',e=>{LSset('keep',!!e.target.checked);wakeSync();toast(e.target.checked?'Screen stays on while recording':'Screen may turn off — recording carries on');});
  paintRec(); drawLoop(); hud();
}
function paintRec(){
  if(!ov)return;
  const r=R, ph=r?r.phase:'idle', live=ph==='rec'||ph==='paused';
  ov.classList.toggle('rec-live',ph==='rec'); ov.classList.toggle('rec-paused',ph==='paused');
  if(view!=='rec'||!q(mainEl,'.rec-rv'))return;
  setTitle(ph==='rec'?'Recording':ph==='paused'?'Paused':ph==='stopping'?'Saving…':'New recording');
  const pill=q(mainEl,'.rec-pill');
  pill.className='rec-pill rec-p-'+ph; pill.textContent=ph==='rec'?'REC':ph==='paused'?'PAUSED':ph==='starting'?'STARTING…':ph==='stopping'?(r&&r.discard?'DISCARDING…':'SAVING…'):'READY';
  q(mainEl,'.rec-since').textContent=r&&r.started?'Started '+hms(r.started)+' · '+dayLong(r.started):'';
  const tm=q(mainEl,'.rec-timer'); tm.textContent=tm._s=clock(elapsed()); tm.classList.toggle('rec-blink',ph==='paused');
  const big=q(mainEl,'.rec-big'), bl=q(mainEl,'.rec-bigl');
  big.dataset.s=ph; big.disabled=ph==='starting'||ph==='stopping';
  const lab=ph==='rec'?'Pause':ph==='paused'?'Resume':ph==='starting'?'Starting…':ph==='stopping'?'Saving…':'Record';
  bl.textContent=lab; big.setAttribute('aria-label',ph==='rec'?'Pause recording':ph==='paused'?'Resume recording':'Start recording');
  q(mainEl,'.rec-mk').disabled=!live; q(mainEl,'.rec-st').disabled=!live;
  const msg=q(mainEl,'.rec-wmsg');
  msg.textContent=ph==='idle'&&!recErr?'Tap the red button to start recording':ph==='starting'?'Starting the microphone…':ph==='paused'?'Paused — tap Resume to carry on':(r&&!r.an&&live?'Level meter unavailable — still recording':'');
  msg.classList.toggle('rec-mute',!!(r&&r.muted&&live));
  if(r&&r.muted&&live)msg.textContent='The phone has muted the microphone (a call?) — recording silence until it comes back';
  const er=q(mainEl,'.rec-err');
  const low=r&&r.low&&live?'Low storage — space for about '+durTxt(r.low/(BITRATE/8)*1000)+' more recording.':'';
  er.hidden=!(recErr||low); er.textContent=recErr||low; er.classList.toggle('rec-soft',!recErr);
  const mc=q(mainEl,'.rec-mchips'), ms=r?r.markers:[];
  const mh=ms.map((m,i)=>'<span class="rec-mc">⚑ '+(i+1)+' · <b class="rec-num">'+clock(m.t)+'</b></span>').join('');
  if(mc._h!==mh){mc._h=mh;mc.innerHTML=mh;mc.scrollLeft=mc.scrollWidth;}
  q(mainEl,'.rec-fmt').textContent=r&&r.mime?fmtName(r.mime)+' · mono · '+Math.round(BITRATE/1000)+' kbps · saved to this phone every second':'Saved on this phone as it records — nothing is uploaded.';
  if(ph==='rec'||ph==='paused'||ph==='idle')drawLoop();
}
function stopDraw(){ if(raf){cancelAnimationFrame(raf);raf=0;} }
function drawLoop(){
  if(raf)return;
  const f=()=>{ raf=0; if(!ov||ov.hidden||view!=='rec')return; drawLive(); paintLevel(); if(R&&(R.phase==='rec'||R.phase==='paused'))raf=requestAnimationFrame(f); };
  raf=requestAnimationFrame(f);
}
function drawLive(){
  const cv=q(mainEl,'.rec-wave canvas'); if(!cv)return;
  const {c,w,h}=cvFit(cv); c.clearRect(0,0,w,h);
  const r=R, PX=4, BW=2.4, pxms=PX/BAR_MS, top=19, mid=Math.round(top+(h-top)/2), amp=(h-top)/2-4, nowX=Math.round(w*0.8), t=elapsed();
  c.fillStyle='rgba(159,176,200,.14)'; c.fillRect(0,mid,w,1);
  c.font='600 10px ui-monospace,Menlo,Consolas,monospace'; c.textBaseline='top';
  const s0=Math.max(0,Math.floor((t-nowX/pxms)/1000));
  for(let s=s0;;s++){ const x=nowX-(t-s*1000)*pxms; if(x>w+1)break; if(x<-40)continue;
    c.fillStyle='rgba(159,176,200,.35)'; c.fillRect(Math.round(x),0,1,s%5?4:8);
    if(s%2===0&&x<nowX+30){c.fillStyle='rgba(159,176,200,.7)';c.fillText(clock(s*1000).slice(3),Math.round(x)+3,1);} }
  if(r&&r.disp.length){
    const off=r.dispOff, last=off+r.disp.length-1;
    c.fillStyle=r.run?'#d4af37':'rgba(212,175,55,.55)';
    for(let i=last;i>=off;i--){ const x=nowX-(t-(i*BAR_MS+BAR_MS/2))*pxms; if(x<-PX)break; if(x>nowX-1)continue;
      const bh=Math.max(1.5,r.disp[i-off]/255*amp); c.fillRect(Math.round(x-BW/2),mid-bh,BW,bh*2); }
  }
  if(r)r.markers.forEach((m,k)=>{ const x=Math.round(nowX-(t-m.t)*pxms); if(x<-30||x>w)return;
    c.fillStyle='rgba(255,211,90,.9)'; c.fillRect(x,top+2,1.5,h-top-2);
    const lab=String(k+1); c.font='800 11px ui-monospace,Menlo,Consolas,monospace'; const lw=Math.max(16,c.measureText(lab).width+9);
    c.fillStyle='#ffd35a'; c.beginPath(); if(c.roundRect)c.roundRect(x,top-3,lw,15,[0,4,4,0]); else c.rect(x,top-3,lw,15); c.fill();
    c.fillStyle='#1a1405'; c.fillText(lab,x+4.5,top-1); c.font='600 10px ui-monospace,Menlo,Consolas,monospace'; });
  c.fillStyle='rgba(159,176,200,.08)'; c.fillRect(nowX+1,top,w-nowX,h-top);
  c.fillStyle=r&&r.run?'#ff4d4d':'rgba(255,77,77,.6)'; c.fillRect(nowX-1,top-4,2,h-top+4);
  c.beginPath(); c.arc(nowX,top-4,4,0,7); c.fill();
}
function paintLevel(){
  const bar=q(mainEl,'.rec-lbar'); if(!bar)return;
  const L=R&&R.lvl, db=L?20*Math.log10(L.rms+1e-9):-99, hd=L?20*Math.log10(L.hold+1e-9):-99, live=R&&(R.phase==='rec'||R.phase==='paused');
  const pct=v=>clamp((v+60)/60*100,0,100);
  q(bar,'i').style.width=(live?pct(db):0)+'%'; q(bar,'em').style.left=(live?pct(hd):0)+'%';
  const clip=L&&performance.now()-L.clipAt<1500, dbt=q(mainEl,'.rec-ldb');
  const s=!live||!L?'—':clip?'Too loud':(db<-59?'−60':'−'+Math.round(-db))+' dB';
  if(dbt._s!==s){dbt._s=s;dbt.textContent=s;} dbt.classList.toggle('rec-clip',!!clip);
}
function askStop(closeAfter){
  if(!R||(R.phase!=='rec'&&R.phase!=='paused'))return;
  sheet('<h3>Stop and save?</h3><p class="rec-note">The recording is still '+(R.phase==='paused'?'open (paused at ':'running (')+'<b class="rec-askt rec-num">'+clock(elapsed())+'</b>). Stop it now and keep it on this phone?</p>'
    +'<div class="rec-row2"><button type="button" class="rec-go rec-ok">'+svg(IC.stop)+' Stop &amp; save</button><button type="button" class="rec-b2 rec-x">Keep recording</button></div>'
    +'<button type="button" class="rec-link rec-dang rec-disc">Discard this recording</button>',r=>{
      q(r,'.rec-ok').onclick=()=>{ const p=stopRec(); if(closeAfter)p.then(()=>{ if(R||!ov||ov.hidden||!sheetEl.hidden)return; const x=RECS[0];
        closeRecorder(); if(x&&W.grToast)W.grToast('Recording saved — '+x.name); }); };
      const d=q(r,'.rec-disc'); let t=0;
      d.onclick=()=>{ if(d.dataset.sure!=='1'){d.dataset.sure='1';d.textContent='Tap again to delete it for good';clearTimeout(t);t=setTimeout(()=>{d.dataset.sure='';d.textContent='Discard this recording';},3000);return;}
        clearTimeout(t); discardRec(); };
    });
}

/* =====================================================================
   RECORDINGS LIST
   ===================================================================== */
function load(){
  return Promise.all([allOf('recs'),allOf('live'),heldNames()]).then(([rs,ls,held])=>{
    RECS=(rs||[]).sort((a,b)=>b.created-a.created);
    const now=Date.now();
    ORPH=(ls||[]).filter(s=>!(R&&R.id===s.id)&&!held.has(LOCK+s.id)&&!(held.none&&now-(s.updated||0)<LIVE_GRACE)).sort((a,b)=>b.started-a.started);
    loaded=true;
  });
}
function renderList(reload){
  view='list'; stopDraw(); setTitle('Voice recorder');
  if(reload||!loaded){
    if(!mainEl.firstChild||!q(mainEl,'.rec-lv'))mainEl.innerHTML='<div class="rec-loading">Opening recordings…</div>';
    load().then(()=>{ if(!ov||ov.hidden||view!=='list')return; paintList(); offerRecovery(); gc(); })
      .catch(e=>{ if(ov&&!ov.hidden&&view==='list')mainEl.innerHTML='<div class="rec-scroll"><div class="rec-wrap"><div class="rec-empty">'+svg(IC.warn)+'<b>Recordings can’t open</b><span>'+esc(storageErr(e))+'</span></div></div></div>'; });
    return;
  }
  paintList();
}
function noticeHtml(card){
  return '<div class="rec-notice'+(card?'':' rec-flat')+'"><b>'+svg(IC.shield)+' Kept on this phone only</b><p>'+esc(NOTICE)+'</p>'
    +(card?'<div class="rec-nrow"><button type="button" class="rec-go" data-a="gotit">Got it</button></div>':'')+'</div>';
}
function orphHtml(s){
  return '<div class="rec-orph" data-sid="'+esc(s.id)+'"><b>'+svg(IC.restore)+' Interrupted recording</b>'
    +'<p>Started <b>'+esc(hms(s.started))+'</b> · '+esc(dayLong(s.started))+' — the app closed before it was saved. About <b>'+esc(durTxt(s.dur))+'</b> ('+esc(sizeTxt(s.bytes))+') can be recovered.</p>'
    +'<div class="rec-row2"><button type="button" class="rec-go" data-a="recover">Recover it</button><button type="button" class="rec-b2 rec-dang" data-a="discard">Discard</button></div></div>';
}
function rowHtml(r){
  const mk=(r.markers||[]).length;
  return '<div class="rec-row'+(r.id===hiId?' rec-hi':'')+'" role="button" tabindex="0" data-id="'+esc(r.id)+'">'
    +'<button type="button" class="rec-pp" data-a="pp" aria-label="Play">'+svg(IC.play)+'</button>'
    +'<div class="rec-rt"><b>'+esc(r.name)+'</b><span>'+esc(hm(r.created))+' · '+esc(dayLong(r.created))+'</span>'
    +'<small><span class="rec-rd rec-num">'+esc(durTxt(r.dur))+'</span> · '+esc(sizeTxt(r.size))+(mk?' · <i class="rec-mki">⚑ '+mk+'</i>':'')+(r.recovered?' · recovered':'')+'</small></div>'
    +svg(IC.chev,'rec-chev')+'<i class="rec-prog"><i></i></i></div>';
}
function paintList(){
  const sc0=q(mainEl,'.rec-scroll'), keep=sc0?sc0.scrollTop:0;
  let h='<div class="rec-lv"><div class="rec-scroll"><div class="rec-wrap">';
  if(!LSget('notice',0))h+=noticeHtml(true);
  ORPH.forEach(s=>{h+=orphHtml(s);});
  h+='<h3 class="rec-h">Recordings'+(RECS.length?'<span>'+RECS.length+'</span>':'')+'</h3>';
  h+=RECS.length?'<div class="rec-rows">'+RECS.map(rowHtml).join('')+'</div>'
    :'<div class="rec-empty">'+svg(IC.mic)+'<b>No recordings yet</b><span>Tap the red button to record. Use ⚑ Mark to flag moments you’ll want to find again.</span></div>';
  const tot=RECS.reduce((a,r)=>a+(+r.size||0),0);
  h+='<p class="rec-foot"><span>'+plural(RECS.length,'recording')+' · '+esc(sizeTxt(tot))+' on this phone</span><small class="rec-free"></small></p>';
  h+='</div></div><div class="rec-dock"><button type="button" class="rec-dbtn" data-a="new" aria-label="New recording"><i></i></button><b>Record</b></div></div>';
  mainEl.innerHTML=h;
  const sc=q(mainEl,'.rec-scroll'); sc.scrollTop=hiId?0:keep;
  wireRows(); paintRows(); hud();
  room().then(left=>{ const f=ov&&q(mainEl,'.rec-free'); if(f&&left!=null)f.textContent='Space available to the app: '+sizeTxt(left); });
  if(hiId){const id=hiId;setTimeout(()=>{if(hiId===id){hiId=null;const x=q(mainEl,'.rec-row.rec-hi');if(x)x.classList.remove('rec-hi');}},2600);}
}
function wireRows(){
  qa(mainEl,'.rec-row').forEach(row=>row.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target===row){e.preventDefault();openPlayer(row.dataset.id);}}));
}
function offerRecovery(){
  const s=ORPH.find(x=>!offered.has(x.id)); if(!s||!sheetEl.hidden||R)return;
  offered.add(s.id);
  sheet('<h3>'+svg(IC.restore)+' Recover the interrupted recording?</h3>'
    +'<p class="rec-note">A recording started at <b>'+esc(hms(s.started))+'</b> on '+esc(dayLong(s.started))+' didn’t finish — the app was closed or the phone stopped it. About <b>'+esc(durTxt(s.dur))+'</b> ('+esc(sizeTxt(s.bytes))+') was saved as it recorded.</p>'
    +'<div class="rec-row2"><button type="button" class="rec-go rec-ok">Recover it</button><button type="button" class="rec-b2 rec-x">Later</button></div>',
    r=>{q(r,'.rec-ok').onclick=()=>{closeSheet();recover(s.id);};});
}
function probeDur(blob){
  return new Promise(res=>{
    const a=D.createElement('audio'), u=URL.createObjectURL(blob); let done=false;
    const fin=v=>{if(done)return;done=true;clearTimeout(t);a.removeAttribute('src');try{a.load();}catch(e){}URL.revokeObjectURL(u);res(v);};
    const t=setTimeout(()=>fin(null),3000);
    a.preload='metadata'; a.onloadedmetadata=()=>fin(isFinite(a.duration)&&a.duration>0?a.duration:null); a.onerror=()=>fin(null); a.src=u;
  });
}
async function recover(sid){
  const s=ORPH.find(x=>x.id===sid); if(!s)return;
  try{
    const cs=await chunkRecs(sid), ps=cs.map(x=>x.blob);
    if(!ps.length){ await dropAudio(sid); ORPH=ORPH.filter(x=>x.id!==sid); paintList(); toast('Nothing could be recovered from that recording'); return; }
    const blob=new Blob(ps,{type:s.mime||'audio/webm'});
    let dur=+s.dur||0; const pd=await probeDur(blob); if(pd&&pd<86400)dur=Math.round(pd*1000);
    if(!dur)dur=Math.round(ps.length*TIMESLICE);
    const rec={id:sid,name:uniqueName((s.name||defName(s.started))+' (recovered)'),created:s.started,dur,size:blob.size,mime:s.mime||blob.type||'audio/webm',
      markers:(s.markers||[]).filter(m=>m.t<=dur+1000),peaks:peaksOf(cs),recovered:true};
    await run(['recs','live'],'readwrite',t=>{t.objectStore('recs').put(rec);t.objectStore('live').delete(sid);});
    askPersist();
    ORPH=ORPH.filter(x=>x.id!==sid); RECS=RECS.filter(x=>x.id!==sid); RECS.push(rec); RECS.sort((a,b)=>b.created-a.created); hiId=sid;
    if(ov&&!ov.hidden&&view==='list')paintList();
    toast('Recovered “'+rec.name+'” — '+durTxt(dur));
  }catch(e){ toast(storageErr(e)); }
}
function discardOrphan(sid,btn){
  if(btn&&btn.dataset.sure!=='1'){btn.dataset.sure='1';btn.textContent='Tap to confirm';setTimeout(()=>{if(btn.isConnected){btn.dataset.sure='';btn.textContent='Discard';}},3000);return;}
  dropAudio(sid).then(()=>{ORPH=ORPH.filter(x=>x.id!==sid);if(view==='list')paintList();toast('Interrupted recording discarded');}).catch(e=>toast(storageErr(e)));
}
/* audio pieces whose recording no longer exists (e.g. a delete interrupted mid-way) — once per session, in one transaction */
function gc(){
  if(gcDone)return; gcDone=true;
  run(['recs','live','chunks'],'readwrite',t=>{
    const known=new Set(); let n=0;
    const go=()=>{ if(++n<2)return; const cs=t.objectStore('chunks'), c=cs.openKeyCursor();
      c.onsuccess=()=>{const k=c.result;if(!k)return;if(!known.has(k.primaryKey[0]))cs.delete(k.primaryKey);k.continue();}; };
    rq(t.objectStore('recs').getAllKeys(),ks=>{ks.forEach(k=>known.add(k));go();});
    rq(t.objectStore('live').getAllKeys(),ks=>{ks.forEach(k=>known.add(k));go();});
  }).catch(()=>{});
}

/* =====================================================================
   PLAYBACK (one audio element, shared by the list rows and the player)
   ===================================================================== */
const P={a:null,id:null,url:null,loading:null};
const speed=()=>{const s=+LSget('speed',1);return SPEEDS.includes(s)?s:1;};
function audioEl(){
  if(P.a)return P.a;
  const a=P.a=new Audio(); a.preload='auto';
  const upd=()=>{paintPP();paintPos();};
  ['play','pause','ended','seeked','durationchange','loadedmetadata'].forEach(ev=>a.addEventListener(ev,upd));
  a.addEventListener('timeupdate',()=>{ if(a.paused)paintPos(); });
  a.addEventListener('play',playLoop);
  a.addEventListener('error',()=>{ if(P.id&&a.getAttribute('src'))toast('This recording can’t be played on this phone ('+fmtName(recOfP()&&recOfP().mime)+').'); });
  return a;
}
const recOfP=()=>P.id?byId(P.id):null;
function loadRec(rec){
  if(P.id===rec.id&&(P.url||P.loading))return P.loading||Promise.resolve(P.a);
  unload(); P.id=rec.id;
  const my=P.loading=blobOf(rec).then(b=>{ if(P.loading!==my)return null; P.loading=null;
    P.url=URL.createObjectURL(b); const a=audioEl(); a.src=P.url; a.defaultPlaybackRate=a.playbackRate=speed(); try{a.preservesPitch=true;}catch(e){} return a; });
  my.catch(()=>{ if(P.loading===my){P.loading=null;P.id=null;} });
  return my;
}
function unload(){
  stopPlayLoop(); P.loading=null;
  if(P.a){ try{P.a.pause();}catch(e){} if(P.a.getAttribute('src')){P.a.removeAttribute('src');try{P.a.load();}catch(e){}} }
  if(P.url){try{URL.revokeObjectURL(P.url);}catch(e){}P.url=null;}
  P.id=null;
}
function unloadIfNot(id){ if(P.id&&P.id!==id)unload(); }
function durOf(rec){ const a=P.a; if(rec&&P.id===rec.id&&a&&isFinite(a.duration)&&a.duration>0)return a.duration; return ((rec&&rec.dur)||0)/1000; }
function posOf(rec){ return rec&&P.id===rec.id&&P.a&&P.url?P.a.currentTime:0; }
function togglePlay(rec){
  if(!rec)return;
  if(P.id===rec.id&&P.a&&P.url&&!P.a.paused){P.a.pause();return;}
  loadRec(rec).then(a=>{ if(!a||P.id!==rec.id)return; const d=durOf(rec); if(a.ended||(d&&a.currentTime>=d-0.05))a.currentTime=0;
    const p=a.play(); if(p&&p.catch)p.catch(e=>{ if(e&&e.name!=='AbortError')toast('Can’t play this recording: '+(e.message||e.name)); }); })
   .catch(e=>toast(e&&e.message?e.message:storageErr(e)));
}
function seekTo(rec,sec){
  loadRec(rec).then(a=>{ if(!a||P.id!==rec.id)return; const d=durOf(rec); a.currentTime=clamp(sec,0,d>0?Math.max(0,d-0.05):sec); paintPos(); }).catch(()=>{});
}
let prAF=0;
function playLoop(){ if(prAF)return; const f=()=>{prAF=0; if(!P.a||P.a.paused||!ov||ov.hidden)return; paintPos(); prAF=requestAnimationFrame(f);}; prAF=requestAnimationFrame(f); }
function stopPlayLoop(){ if(prAF){cancelAnimationFrame(prAF);prAF=0;} }
function paintPP(){
  if(!ov||ov.hidden)return;
  if(view==='list')paintRows();
  else if(view==='play'){ const b=q(mainEl,'.rec-play'); if(!b)return; const on=P.id===curId&&P.a&&P.url&&!P.a.paused;
    if(b._s!==on){b._s=on;b.innerHTML=svg(on?IC.pause:IC.play);b.setAttribute('aria-label',on?'Pause':'Play');} }
}
function paintPos(){
  if(!ov||ov.hidden)return;
  if(view==='list'){paintRows();return;}
  if(view!=='play')return;
  const rec=byId(curId); if(!rec)return;
  const cur=q(mainEl,'.rec-pcur'); if(!cur)return;
  const t=posOf(rec), s=clock(t*1000); if(cur._s!==s){cur._s=s;cur.textContent=s;}
  const tot=q(mainEl,'.rec-ptot'), ts=clock(durOf(rec)*1000); if(tot._s!==ts){tot._s=ts;tot.textContent=ts;}
  drawPlay();
}
function paintRows(){
  qa(mainEl,'.rec-row').forEach(row=>{
    const id=row.dataset.id, on=P.id===id&&!!P.url, playing=on&&P.a&&!P.a.paused, b=q(row,'.rec-pp');
    if(b._s!==playing){b._s=playing;b.innerHTML=svg(playing?IC.pause:IC.play);b.setAttribute('aria-label',playing?'Pause':'Play');}
    row.classList.toggle('rec-cur',on);
    const rec=byId(id); if(!rec)return;
    const pr=q(row,'.rec-prog i'), rd=q(row,'.rec-rd');
    if(on){ const d=durOf(rec), t=posOf(rec); pr.style.width=(d>0?clamp(t/d*100,0,100):0)+'%'; const s=durTxt(t*1000)+' / '+durTxt(d*1000); if(rd._s!==s){rd._s=s;rd.textContent=s;} }
    else { pr.style.width='0'; const s=durTxt(rec.dur); if(rd._s!==s){rd._s=s;rd.textContent=s;} }
  });
}

/* =====================================================================
   PLAYER
   ===================================================================== */
function openPlayer(id){
  const rec=byId(id); if(!rec)return;
  unloadIfNot(id); curId=id; view='play'; renderPlayer(rec);
  loadRec(rec).then(()=>paintPos()).catch(e=>toast(e&&e.message?e.message:storageErr(e)));
}
function renderPlayer(rec){
  setTitle('Playback'); stopDraw();
  const ms=rec.markers||[], D_=Math.max(1,rec.dur||1);
  const flags=ms.map((m,i)=>'<button type="button" class="rec-flag" data-m="'+i+'" style="left:'+clamp(m.t/D_*100,0,100).toFixed(3)+'%" aria-label="Marker '+(i+1)+' at '+clock(m.t)+'"><span>'+(i+1)+'</span></button>').join('');
  mainEl.innerHTML='<div class="rec-pv"><div class="rec-scroll"><div class="rec-wrap">'
    +'<div class="rec-ph"><b class="rec-pname">'+esc(rec.name)+'</b><span>Recorded '+esc(hms(rec.created))+' · '+esc(dayLong(rec.created))+'</span>'
    +'<small>'+esc(durTxt(rec.dur))+' · '+esc(sizeTxt(rec.size))+' · '+esc(fmtName(rec.mime))+(ms.length?' · ⚑ '+ms.length:'')+(rec.recovered?' · recovered':'')+'</small></div>'
    +'<div class="rec-pwave"><div class="rec-flags">'+flags+'</div><canvas class="rec-seek" role="slider" tabindex="0" aria-label="Position — tap or drag to move" aria-valuemin="0"></canvas></div>'
    +'<div class="rec-ptime"><b class="rec-pcur rec-num">00:00:00</b><span class="rec-ptot rec-num">'+clock(rec.dur)+'</span></div>'
    +'<div class="rec-pctl"><button type="button" class="rec-skip" data-a="b10" aria-label="Back 10 seconds">'+svg(IC.rw)+'<span>10</span></button>'
    +'<button type="button" class="rec-play" data-a="play" aria-label="Play">'+svg(IC.play)+'</button>'
    +'<button type="button" class="rec-skip" data-a="f10" aria-label="Forward 10 seconds">'+svg(IC.ff)+'<span>10</span></button></div>'
    +'<div class="rec-seg" role="group" aria-label="Playback speed">'+SPEEDS.map(s=>'<button type="button" data-sp="'+s+'"'+(s===speed()?' class="rec-on" aria-pressed="true"':' aria-pressed="false"')+'>'+s+'×</button>').join('')+'</div>'
    +(ms.length?'<h3 class="rec-h">Markers<span>'+ms.length+'</span></h3><div class="rec-mlist">'+ms.map((m,i)=>'<button type="button" class="rec-mrow" data-m="'+i+'"><i>⚑ '+(i+1)+'</i><b class="rec-num">'+clock(m.t)+'</b><small>added '+esc(hms(m.at))+'</small>'+svg(IC.chev)+'</button>').join('')+'</div>'
      :'<p class="rec-note rec-nomk">No markers. Next time, tap ⚑ Mark while recording to flag moments you’ll want to find again.</p>')
    +'<h3 class="rec-h">This recording</h3>'
    +'<div class="rec-acts"><button type="button" class="rec-act" data-a="rename">'+svg(IC.pen)+'<span>Rename</span></button>'
    +'<button type="button" class="rec-act" data-a="save">'+svg(IC.download)+'<span>Save to phone</span></button>'
    +'<button type="button" class="rec-act rec-dang" data-a="del">'+svg(IC.trash)+'<span>Delete</span></button></div>'
    +'<p class="rec-foot rec-pfoot">Save to phone puts a copy ('+esc(extOf(rec.mime).toUpperCase())+') in your Downloads. The copy in the app stays until you delete it.</p>'
    +'</div></div></div>';
  wireSeek(rec); paintPP(); paintPos(); hud();
}
function drawPlay(){
  const cv=q(mainEl,'.rec-seek'); if(!cv)return;
  const rec=byId(curId); if(!rec)return;
  const {c,w,h}=cvFit(cv); c.clearRect(0,0,w,h);
  const dur=durOf(rec), dms=dur*1000, t=posOf(rec), px=dur>0?clamp(t/dur,0,1)*w:0;
  const pk=rec.peaks||[], mid=Math.round(h/2), amp=h/2-6, PX=3.5, BW=2.2, n=Math.max(1,Math.floor(w/PX));
  cv.setAttribute('aria-valuemax',String(Math.round(dur))); cv.setAttribute('aria-valuenow',String(Math.round(t))); cv.setAttribute('aria-valuetext',clock(t*1000)+' of '+clock(dms));
  if(pk.length&&dms>0){
    for(let i=0;i<n;i++){
      const a=Math.floor(i/n*dms/PEAK_MS), b=Math.max(a+1,Math.floor((i+1)/n*dms/PEAK_MS)); let v=0;
      for(let k=a;k<b&&k<pk.length;k++)if(pk[k]>v)v=pk[k];
      const x=i*PX+PX/2, bh=Math.max(1.5,v/255*amp);
      c.fillStyle=x<=px?'#d4af37':'#34507a'; c.fillRect(Math.round(x-BW/2),mid-bh,BW,bh*2);
    }
  } else {
    c.fillStyle='#34507a'; c.fillRect(0,mid-3,w,6); c.fillStyle='#d4af37'; c.fillRect(0,mid-3,px,6);
  }
  (rec.markers||[]).forEach(m=>{ if(!(dms>0))return; const x=Math.round(clamp(m.t/dms,0,1)*w); c.fillStyle='rgba(255,211,90,.85)';
    for(let y=0;y<h;y+=6)c.fillRect(x,y,1.5,3); });
  c.fillStyle='#fff'; c.fillRect(Math.round(px)-1,0,2,h);
  c.beginPath(); c.arc(clamp(px,7,w-7),h-8,7,0,7); c.fill(); c.fillStyle='#d4af37'; c.beginPath(); c.arc(clamp(px,7,w-7),h-8,4,0,7); c.fill();
}
function wireSeek(rec){
  const cv=q(mainEl,'.rec-seek'); if(!cv)return;
  let drag=null, pend=null, af=0;
  const at=e=>{const r=cv.getBoundingClientRect();return clamp((e.clientX-r.left)/Math.max(1,r.width),0,1);};
  const apply=()=>{af=0; if(pend==null)return; const f=pend; pend=null; loadRec(rec).then(a=>{ if(!a||P.id!==rec.id)return; const d=durOf(rec); a.currentTime=clamp(f*d,0,Math.max(0,d-0.05)); paintPos(); }).catch(()=>{});};
  const go=f=>{pend=f; if(!af)af=requestAnimationFrame(apply);};
  cv.addEventListener('pointerdown',e=>{ if(e.pointerType==='mouse'&&e.button!==0)return; drag=e.pointerId; try{cv.setPointerCapture(e.pointerId);}catch(_){} go(at(e)); });
  cv.addEventListener('pointermove',e=>{ if(drag===e.pointerId)go(at(e)); });
  ['pointerup','pointercancel'].forEach(k=>cv.addEventListener(k,e=>{ if(drag===e.pointerId){drag=null;try{cv.releasePointerCapture(e.pointerId);}catch(_){}} }));
  cv.addEventListener('keydown',e=>{ const k=e.key; if(k==='ArrowLeft'||k==='ArrowRight'){e.preventDefault();seekTo(rec,posOf(rec)+(k==='ArrowLeft'?-5:5));}
    else if(k===' '||k==='Enter'){e.preventDefault();togglePlay(rec);} });
}
function setSpeed(s){
  if(!SPEEDS.includes(s))return; LSset('speed',s);
  if(P.a){P.a.defaultPlaybackRate=s;P.a.playbackRate=s;}
  qa(mainEl,'.rec-seg button').forEach(b=>{const on=+b.dataset.sp===s;b.classList.toggle('rec-on',on);b.setAttribute('aria-pressed',on?'true':'false');});
}
function renameSheet(rec){
  sheet('<h3>'+svg(IC.pen)+' Rename recording</h3><input class="rec-in" maxlength="80" autocomplete="off" spellcheck="false" enterkeyhint="done" aria-label="Recording name" value="'+esc(rec.name)+'">'
    +'<p class="rec-note">Avoid full names of members of the public — a reference or initials is enough.</p>'
    +'<div class="rec-row2"><button type="button" class="rec-go rec-ok">Save</button><button type="button" class="rec-b2 rec-x">Cancel</button></div>',r=>{
      const i=q(r,'.rec-in'); setTimeout(()=>{try{i.focus();i.select();}catch(e){}},80);
      const go=()=>{ const v=i.value.replace(/\s+/g,' ').trim()||defName(rec.created); const old=rec.name; rec.name=v;
        putRec(rec).then(()=>{ closeSheet(); if(view==='play'&&curId===rec.id){const n=q(mainEl,'.rec-pname');if(n)n.textContent=v;} else if(view==='list')paintList(); toast('Renamed'); })
          .catch(e=>{ rec.name=old; toast(storageErr(e)); }); };
      q(r,'.rec-ok').onclick=go; i.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();go();}});
    });
}
function deleteSheet(rec){
  confirmSheet('Delete this recording?','“'+esc(rec.name)+'” ('+esc(durTxt(rec.dur))+', '+esc(sizeTxt(rec.size))+') will be removed from this phone. A copy you saved to Downloads is not affected. This can’t be undone.','Delete',true,()=>{
    if(P.id===rec.id)unload();
    dropAudio(rec.id).then(()=>{ RECS=RECS.filter(x=>x.id!==rec.id); if(curId===rec.id)curId=null; if(ov&&!ov.hidden){view='list';renderList(false);} toast('Recording deleted'); })
      .catch(e=>toast(storageErr(e)));
  });
}
function saveToPhone(rec){
  blobOf(rec).then(b=>{ const n=fileName(rec); download(b,n); toast('Saving '+n+' to Downloads'); }).catch(e=>toast(e&&e.message?e.message:storageErr(e)));
}
function noticeSheet(){
  sheet('<h3>'+svg(IC.shield)+' Kept on this phone only</h3>'+noticeHtml(false)+'<button type="button" class="rec-go rec-wide rec-x">OK</button>');
  LSset('notice',1); const c=view==='list'&&q(mainEl,'.rec-notice:not(.rec-flat)'); if(c)c.remove();
}
function failSheet(rec,blob,err){
  const n=fileName(rec);
  sheet('<h3>'+svg(IC.warn)+' Couldn’t save it in the app</h3><p class="rec-note">'+esc(storageErr(err))+'</p>'
    +'<p class="rec-note">The complete recording (<b>'+esc(durTxt(rec.dur))+'</b>, '+esc(sizeTxt(blob.size))+') is still in memory. Save it to the phone’s Downloads now so it isn’t lost.</p>'
    +'<button type="button" class="rec-go rec-wide rec-dl">'+svg(IC.download)+' Save to phone now</button><button type="button" class="rec-b2 rec-wide rec-x">Close</button>',
    r=>{q(r,'.rec-dl').onclick=()=>{download(blob,n);toast('Saving '+n+' to Downloads');};}, ()=>{blob=null;});
}

/* ---------- one delegated click handler for every screen ---------- */
function onMainClick(e){
  const a=e.target.closest('[data-a],[data-m],[data-sp]'), row=e.target.closest('.rec-row');
  if(!a&&row){ openPlayer(row.dataset.id); return; }
  if(!a||!mainEl.contains(a))return;
  if(a.dataset.sp){setSpeed(+a.dataset.sp);return;}
  if(a.dataset.m!=null&&view==='play'){ const rec=byId(curId); if(!rec)return; const m=(rec.markers||[])[+a.dataset.m]; if(m){seekTo(rec,m.t/1000);vib(12);} return; }
  const k=a.dataset.a, rec=byId(curId);
  switch(k){
    case 'new': view='rec'; recErr=''; renderRec(); startRec(); break;
    case 'toggle': { const ph=R?R.phase:'idle'; if(ph==='rec')pauseRec(); else if(ph==='paused')resumeRec(); else if(ph==='idle'||ph==='done')startRec(); break; }
    case 'mark': markRec(); break;
    case 'stop': stopRec(); break;
    case 'pp': if(row){e.stopPropagation(); togglePlay(byId(row.dataset.id));} break;
    case 'gotit': LSset('notice',1); { const c=q(mainEl,'.rec-notice'); if(c)c.remove(); } toast('Tap ⓘ at the top to read this again'); break;
    case 'recover': { const o=a.closest('.rec-orph'); if(o)recover(o.dataset.sid); break; }
    case 'discard': { const o=a.closest('.rec-orph'); if(o)discardOrphan(o.dataset.sid,a); break; }
    case 'play': if(rec)togglePlay(rec); break;
    case 'b10': if(rec)seekTo(rec,posOf(rec)-10); break;
    case 'f10': if(rec)seekTo(rec,posOf(rec)+10); break;
    case 'rename': if(rec)renameSheet(rec); break;
    case 'save': if(rec)saveToPhone(rec); break;
    case 'del': if(rec)deleteSheet(rec); break;
  }
}

W.openRecorder=openRecorder; W.closeRecorder=closeRecorder; W.recBack=recBack;
W.GRRec=Object.freeze({isRecording:()=>!!(R&&(R.phase==='rec'||R.phase==='paused'||R.phase==='stopping')),elapsed:()=>R?Math.round(elapsed()):0});
})();
