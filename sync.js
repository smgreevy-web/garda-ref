/* Assisting — Sync across your devices: end-to-end encrypted, through your own Google account.
   What syncs: Tasks (with all their steps), My roster and Saved sections. Looks, text size and Home layout stay per device.
   How it works:
   • Everything is encrypted on this device before it leaves: AES-256-GCM with a key made from a passphrase only you know
     (PBKDF2-SHA-256, 310,000 rounds, random salt). The passphrase itself is never stored or sent — only the key, kept
     non-exportable in this browser's own database.
   • The scrambled file is kept in the app's private folder in your Google Drive (appDataFolder): it doesn't show in your
     Drive, other apps can't read it, and the permission asked for is only that folder (drive.appdata).
   • Sign-in is Google's own (Google Identity Services). It lasts about an hour; after that, tapping Sync asks Google again.
   • Merging: each task carries the time it last changed and the newer copy wins; deleted tasks are remembered (90 days) so
     they don't come back. My roster and Saved sections: the newer one wins.
   You need a Google OAuth client ID (free, made once in Google Cloud) — the Sync screen walks you through it.
   Without the passphrase nobody can open the copy in Google Drive — not Google, not the app, not you. */
(function(){
'use strict';
const W=window, D=document;
const LSK='gr_sync', FILE='assisting-sync-v1.json', SCOPE='https://www.googleapis.com/auth/drive.appdata', ITER=310000, AD='assisting-sync-v1';
const GIS='https://accounts.google.com/gsi/client', DRV='https://www.googleapis.com/drive/v3/files', UPL='https://www.googleapis.com/upload/drive/v3/files';
const te=new TextEncoder(), td=new TextDecoder();
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const I=(n,c)=>W.GRI?W.GRI(n,c):'';
const p2=n=>String(n).padStart(2,'0');
const when=t=>{ if(!t)return 'never'; const d=new Date(t), n=new Date(), same=d.toDateString()===n.toDateString(), y=new Date(n); y.setDate(n.getDate()-1);
  return (same?'today':d.toDateString()===y.toDateString()?'yesterday':d.getDate()+'/'+(d.getMonth()+1))+' '+p2(d.getHours())+':'+p2(d.getMinutes()); };

/* ---------- settings (this device) ---------- */
function cfg(){ try{ return JSON.parse(localStorage.getItem(LSK)||'{}')||{}; }catch(e){ return {}; } }
function setCfg(p){ const c=Object.assign(cfg(),p); try{ localStorage.setItem(LSK,JSON.stringify(c)); }catch(e){} return c; }
const devName=()=>{ const u=navigator.userAgent||''; return /Android/i.test(u)?'Android phone':/iPhone|iPad/i.test(u)?'iPhone':/Windows/i.test(u)?'Windows computer':/Mac OS/i.test(u)?'Mac':/Linux/i.test(u)?'Linux computer':'this device'; };

/* ---------- change stamps for the parts that sync as one piece ---------- */
function stamps(){ try{ return JSON.parse(localStorage.getItem('gr_sync_m')||'{}')||{}; }catch(e){ return {}; } }
function setStamp(k,t){ const m=stamps(); m[k]=t; try{ localStorage.setItem('gr_sync_m',JSON.stringify(m)); }catch(e){} }
W.grTouch=k=>{ setStamp(k,Date.now()); dirty(); };
W.grSyncDirty=()=>dirty();

/* ---------- the key: kept in IndexedDB as a non-exportable CryptoKey ---------- */
function idb(){ return new Promise((ok,no)=>{ const r=indexedDB.open('gr_sync',1); r.onupgradeneeded=()=>r.result.createObjectStore('k'); r.onsuccess=()=>ok(r.result); r.onerror=()=>no(r.error); }); }
async function kget(n){ const db=await idb(); return new Promise((ok,no)=>{ const q=db.transaction('k').objectStore('k').get(n); q.onsuccess=()=>ok(q.result||null); q.onerror=()=>no(q.error); }); }
async function kput(n,v){ const db=await idb(); return new Promise((ok,no)=>{ const tx=db.transaction('k','readwrite'); tx.objectStore('k').put(v,n); tx.oncomplete=()=>ok(); tx.onerror=()=>no(tx.error); }); }
async function kdel(n){ const db=await idb(); return new Promise(ok=>{ const tx=db.transaction('k','readwrite'); tx.objectStore('k').delete(n); tx.oncomplete=()=>ok(); tx.onerror=()=>ok(); }); }
const b64=u=>{ const a=new Uint8Array(u); let s=''; for(let i=0;i<a.length;i+=0x8000)s+=String.fromCharCode.apply(null,a.subarray(i,i+0x8000)); return btoa(s); };
const unb64=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
async function deriveKey(pass,salt){ const base=await crypto.subtle.importKey('raw',te.encode(String(pass).normalize('NFC')),'PBKDF2',false,['deriveKey']);
  return crypto.subtle.deriveKey({name:'PBKDF2',salt,iterations:ITER,hash:'SHA-256'},base,{name:'AES-GCM',length:256},false,['encrypt','decrypt']); }
async function seal(key,salt,obj){ const iv=crypto.getRandomValues(new Uint8Array(12));
  const ct=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:te.encode(AD)},key,te.encode(JSON.stringify(obj)));
  return {app:'Assisting',v:1,enc:'AES-256-GCM',kdf:'PBKDF2-SHA-256',iter:ITER,salt,iv:b64(iv),ct:b64(ct),at:Date.now(),dev:devName()}; }
async function unseal(key,f){ if(!f||f.v!==1||!f.ct||!f.iv)throw new Error('The copy in Google Drive isn’t one this app can read.');
  try{ const pt=await crypto.subtle.decrypt({name:'AES-GCM',iv:unb64(f.iv),additionalData:te.encode(AD)},key,unb64(f.ct)); return JSON.parse(td.decode(pt)); }
  catch(e){ throw Object.assign(new Error('That passphrase doesn’t open it — use the one you set on your other device.'),{code:'pass'}); } }

/* ---------- Google sign-in (Google Identity Services, token model) ---------- */
let gisP=null, tok=null, tokExp=0;
try{ const s=JSON.parse(sessionStorage.getItem('gr_sync_tok')||'null'); if(s&&s.exp>Date.now()+60e3){ tok=s.t; tokExp=s.exp; } }catch(e){}
const gisReady=()=>!!(W.google&&W.google.accounts&&W.google.accounts.oauth2);
function loadGIS(){ if(gisReady())return Promise.resolve(); if(gisP)return gisP;
  gisP=new Promise((ok,no)=>{ const s=D.createElement('script'); s.src=GIS; s.async=true; s.onload=()=>gisReady()?ok():no(new Error('Google sign-in didn’t start.')); s.onerror=()=>{ gisP=null; no(new Error('Couldn’t reach Google — check your signal.')); }; D.head.appendChild(s); });
  return gisP; }
const signedIn=()=>!!(tok&&Date.now()<tokExp-60e3);
function forget(){ tok=null; tokExp=0; try{ sessionStorage.removeItem('gr_sync_tok'); }catch(e){} }
/* must run straight from a tap (Google's window is a pop-up) — so load the library first (openSync does) */
function signIn(){ if(signedIn())return Promise.resolve(tok);
  const c=cfg(); if(!c.cid)return Promise.reject(new Error('Add your Google client ID first (step 1).'));
  if(!gisReady())return loadGIS().then(()=>Promise.reject(new Error('Google sign-in is ready now — tap again.')));
  return new Promise((ok,no)=>{ let done=false;
    const tc=W.google.accounts.oauth2.initTokenClient({client_id:c.cid,scope:SCOPE,prompt:c.consented?'':'consent',
      callback:r=>{ done=true; if(!r||r.error)return no(new Error(r&&r.error==='access_denied'?'Google access wasn’t allowed.':(r&&(r.error_description||r.error))||'Google sign-in failed.'));
        if(r.scope&&r.scope.indexOf('drive.appdata')<0)return no(new Error('Tick the Google Drive box when Google asks, so the app can keep its copy there.'));
        tok=r.access_token; tokExp=Date.now()+(+r.expires_in||3600)*1000; try{ sessionStorage.setItem('gr_sync_tok',JSON.stringify({t:tok,exp:tokExp})); }catch(e){} setCfg({consented:1}); ok(tok); },
      error_callback:e=>{ if(done)return; done=true; const t=e&&e.type; no(new Error(t==='popup_closed'?'Google sign-in was closed before it finished.':t==='popup_failed_to_open'?'The Google window was blocked — allow pop-ups for this site and tap again.':'Google sign-in failed.')); } });
    try{ tc.requestAccessToken(); }catch(e){ no(new Error('Google sign-in failed: '+e.message)); } }); }

/* ---------- Google Drive: one file in the app's private folder ---------- */
async function api(url,opt){ const o=Object.assign({},opt||{}); o.headers=Object.assign({Authorization:'Bearer '+tok},o.headers||{});
  const ctl=new AbortController(), to=setTimeout(()=>ctl.abort(),25000); o.signal=ctl.signal; let r;
  try{ r=await fetch(url,o); }catch(e){ throw new Error(e&&e.name==='AbortError'?'Google Drive didn’t answer — check your signal.':'Couldn’t reach Google Drive — check your signal.'); } finally{ clearTimeout(to); }
  if(r.status===401){ forget(); throw Object.assign(new Error('Google sign-in has run out — tap Sync to sign in again.'),{code:'auth'}); }
  if(!r.ok){ let m='Google Drive said no ('+r.status+')'; try{ const j=await r.json(); if(j&&j.error&&j.error.message)m+=': '+j.error.message; }catch(e){} throw Object.assign(new Error(m),{status:r.status}); }
  return r; }
async function findFile(){ const r=await api(DRV+'?spaces=appDataFolder&fields=files(id,modifiedTime)&q='+encodeURIComponent("name='"+FILE+"' and trashed=false")); const j=await r.json(); return j.files&&j.files.length?j.files[0].id:null; }
const getFile=async id=>(await api(DRV+'/'+encodeURIComponent(id)+'?alt=media')).json();
async function createFile(obj){ const b='grsync'+Math.random().toString(36).slice(2);
  const body='--'+b+'\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n'+JSON.stringify({name:FILE,parents:['appDataFolder'],mimeType:'application/json'})+'\r\n--'+b+'\r\nContent-Type: application/json\r\n\r\n'+JSON.stringify(obj)+'\r\n--'+b+'--';
  const r=await api(UPL+'?uploadType=multipart&fields=id',{method:'POST',headers:{'Content-Type':'multipart/related; boundary='+b},body}); return (await r.json()).id; }
const updateFile=(id,obj)=>api(UPL+'/'+encodeURIComponent(id)+'?uploadType=media&fields=id',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(obj)});
const deleteFile=id=>api(DRV+'/'+encodeURIComponent(id),{method:'DELETE'});

/* ---------- what's on this device, and merging ---------- */
const L=k=>{ try{ return JSON.parse(localStorage.getItem(k)||'null'); }catch(e){ return null; } };
const strip=t=>{ const x=Object.assign({},t); ['fired','nextWin','_raw','_pl','_pq','_web'].forEach(k=>delete x[k]); return x; };
function collect(){ const T=L('gr_tasks')||{v:1,tasks:[]}, m=stamps(), ro=L('gr_roster'), fv=L('gr_favs_v1')||[];
  return {v:1,at:Date.now(),dev:devName(),tasks:{tasks:(T.tasks||[]).map(strip),del:T.del||{}},
    roster:{d:ro,m:m.roster||(ro?1:0)},favs:{d:fv,m:m.favs||(fv.length?1:0)}}; }
const mt=t=>t.m||t.updated||t.created||0;
function mergeTasks(a,b){ const del=Object.assign({},b.del||{}); Object.entries(a.del||{}).forEach(([k,v])=>{ if(!del[k]||v>del[k])del[k]=v; });
  const by=new Map(); (b.tasks||[]).forEach(t=>by.set(t.id,{r:t})); (a.tasks||[]).forEach(t=>{ const e=by.get(t.id)||{}; e.l=t; by.set(t.id,e); });
  const out=[], cut=Date.now()-30*864e5;
  for(const [id,e] of by){ const t=e.l&&e.r?(mt(e.r)>mt(e.l)?e.r:e.l):(e.l||e.r);
    if(del[id]&&del[id]>=mt(t))continue; if(t.done&&t.done<cut)continue; out.push(t); }
  const old=Date.now()-90*864e5; Object.keys(del).forEach(k=>{ if(del[k]<old)delete del[k]; });
  out.sort((x,y)=>(x.created||0)-(y.created||0));
  return {tasks:out,del}; }
const newer=(a,b)=>b&&b.m>a.m?b:a;
function merge(a,b){ return {v:1,at:Date.now(),dev:devName(),tasks:mergeTasks(a.tasks,b.tasks||{}),roster:newer(a.roster,b.roster),favs:newer(a.favs,b.favs)}; }
const same=(x,y)=>JSON.stringify(x)===JSON.stringify(y);
function apply(M,loc){ const ch=[];
  if(!same(M.tasks.tasks,loc.tasks.tasks)||!same(M.tasks.del,loc.tasks.del)){ if(W.GRTasks&&W.GRTasks.adopt)W.GRTasks.adopt(M.tasks); else try{ localStorage.setItem('gr_tasks',JSON.stringify({v:1,tasks:M.tasks.tasks,del:M.tasks.del})); }catch(e){}
    const n=M.tasks.tasks.length-loc.tasks.tasks.length; ch.push('tasks'+(n>0?' (+'+n+')':'')); }
  if(M.roster.m!==loc.roster.m&&M.roster.d){ try{ localStorage.setItem('gr_roster',JSON.stringify(M.roster.d)); }catch(e){} setStamp('roster',M.roster.m); if(W.GRRoster&&W.GRRoster._reload)W.GRRoster._reload(); ch.push('My roster'); }
  if(M.favs.m!==loc.favs.m){ try{ localStorage.setItem('gr_favs_v1',JSON.stringify(M.favs.d||[])); }catch(e){} setStamp('favs',M.favs.m); if(W.grFavsReload)W.grFavsReload(); ch.push('Saved sections'); }
  return ch; }

/* ---------- sync ---------- */
let busy=false, lastMsg='';
async function syncNow(fromTap){
  if(busy)return; const c=cfg(); if(!c.on)return;
  busy=true; paint();
  try{
    const K=await kget('key'); if(!K||!K.key)throw Object.assign(new Error('Enter your sync passphrase on this device.'),{code:'pass'});
    if(!signedIn()){ if(!fromTap)throw Object.assign(new Error('Tap Sync to sign in to Google.'),{code:'auth'}); await signIn(); }
    let id=c.fileId||await findFile(), file=null;
    if(id){ try{ file=await getFile(id); }catch(e){ if(e.status===404){ id=await findFile(); file=id?await getFile(id):null; } else throw e; } }
    if(file&&file.salt!==K.salt)throw Object.assign(new Error('The copy in Google Drive was made with another passphrase — enter it again on this device.'),{code:'pass'});
    const loc=collect(), remote=file?await unseal(K.key,file):null, M=remote?merge(loc,remote):loc;
    const ch=remote?apply(M,loc):[];
    const out=await seal(K.key,K.salt,M);
    if(id)await updateFile(id,out); else id=await createFile(out);
    setCfg({fileId:id,last:Date.now(),err:'',from:file&&file.dev||''});
    lastMsg=ch.length?'Brought in: '+ch.join(', '):'Up to date';
    if(fromTap&&W.grToast)W.grToast('Synced — '+lastMsg.toLowerCase());
  }catch(e){ setCfg({err:(e&&e.message)||'Sync failed'}); if(fromTap&&W.grToast)W.grToast((e&&e.message)||'Sync failed'); if(e&&e.code==='pass'){ setCfg({needPass:1}); } }
  finally{ busy=false; paint(); paintChips(); }
}
/* from a tap: sign in to Google first, straight away, so its window isn't blocked */
function tapSync(){ const c=cfg(); if(!c.on||c.needPass){ openSync(); return; }
  if(signedIn()||!gisReady())return syncNow(true);
  signIn().then(()=>syncNow(true)).catch(e=>{ setCfg({err:e.message}); paint(); paintChips(); if(W.grToast)W.grToast(e.message); }); }
if(cfg().on)setTimeout(()=>{ if(navigator.onLine!==false)loadGIS().catch(()=>{}); },4000);
let dt=null;
function dirty(){ const c=cfg(); if(!c.on||c.auto===false)return; clearTimeout(dt); dt=setTimeout(()=>{ if(signedIn()&&navigator.onLine!==false)syncNow(false); },6000); }
D.addEventListener('visibilitychange',()=>{ if(D.visibilityState==='visible'){ const c=cfg(); if(c.on&&c.auto!==false&&signedIn())syncNow(false); paintChips(); } });

/* ---------- setting up: the passphrase ---------- */
function strength(p){ p=String(p||''); let s=0; if(p.length>=10)s++; if(p.length>=16)s++; if(/[a-z]/.test(p)&&/[A-Z]/.test(p))s++; if(/\d/.test(p))s++; if(/[^A-Za-z0-9]/.test(p)||/\s/.test(p))s++; return Math.min(4,s); }
async function setPass(pass,existing){ // existing: the file already in Drive (its salt), or null to start a new one
  const salt=existing?existing.salt:b64(crypto.getRandomValues(new Uint8Array(16)));
  const key=await deriveKey(pass,unb64(salt));
  if(existing)await unseal(key,existing);   // throws on the wrong passphrase
  await kput('key',{key,salt}); setCfg({on:1,needPass:0,err:''}); }

/* ---------- screen ---------- */
let ov=null, stage=null;   // stage: {file, checked}
function build(){ if(ov&&ov.isConnected)return;
  ov=D.createElement('div'); ov.id='syn'; ov.hidden=true; ov.setAttribute('role','dialog'); ov.setAttribute('aria-label','Sync across devices');
  ov.innerHTML='<div class="sy-top"><button type="button" class="sy-back">'+I('chevron-left')+'Back</button><div class="sy-tt"><b>Sync</b><span class="hudclock" data-f="line"></span></div><span class="sy-sp"></span></div><div class="sy-main"></div>';
  D.body.appendChild(ov); ov.querySelector('.sy-back').onclick=()=>closeSync(); }
function openSync(){ build(); ov.hidden=false; D.body.classList.add('syn-open'); loadGIS().catch(()=>{}); paint(); if(W.grHudTick)W.grHudTick(); return true; }
function closeSync(){ if(!ov||ov.hidden)return false; ov.hidden=true; D.body.classList.remove('syn-open'); stage=null; return true; }
function synBack(){ if(!ov||ov.hidden)return false; closeSync(); return true; }
async function paint(){ if(!ov||ov.hidden)return; const c=cfg(), K=await kget('key').catch(()=>null), on=!!(c.on&&K&&K.key&&!c.needPass), main=ov.querySelector('.sy-main');
  const st=busy?'<span class="sy-dot busy"></span>Syncing…':on?(c.err?'<span class="sy-dot err"></span>'+esc(c.err):'<span class="sy-dot ok"></span>On · last synced '+esc(when(c.last))+(lastMsg?' · '+esc(lastMsg):'')):'<span class="sy-dot"></span>Off on this device';
  let h='<div class="sy-wrap"><p class="sy-lead">Keep your <b>tasks</b> (with all their steps), <b>My roster</b> and <b>Saved sections</b> the same on your phone and your computer.</p>'
   +'<div class="sy-card sy-status">'+I(on?'cloud-check':'cloud-off')+'<div><b>'+(on?'Sync is on':'Sync is off')+'</b><small>'+st+'</small></div></div>';
  if(on){
    h+='<button type="button" class="sy-go" data-a="sync"'+(busy?' disabled':'')+'>'+I('refresh-cw')+(signedIn()?'Sync now':'Sign in to Google and sync')+'</button>'
     +'<label class="sy-chk"><input type="checkbox" data-a="auto"'+(c.auto===false?'':' checked')+'><span><b>Sync by itself</b><small>After changes and when you come back to the app, while you’re signed in to Google (about an hour after each sign-in)</small></span></label>'
     +'<p class="sy-note">'+(signedIn()?'Signed in to Google until '+esc(when(tokExp)).replace(/^today /,''):'Not signed in to Google right now — Sync now asks Google (one tap).')+(c.from?' · Last copy came from: '+esc(c.from):'')+'</p>'
     +'<details class="sy-more"><summary>More</summary><div class="sy-row"><button type="button" class="sy-sec" data-a="off">Turn sync off on this device</button><button type="button" class="sy-sec red" data-a="wipe">Delete the copy in Google Drive</button></div>'
     +'<p class="sy-note">Turning sync off forgets the key on this device — your tasks stay here. Deleting the Google Drive copy can’t be undone; your devices keep their own copies.</p></details>';
  } else {
    h+='<ol class="sy-steps">'
     +'<li class="'+(c.cid?'done':'cur')+'"><b>Your Google client ID</b><small>Made once, free, in Google Cloud — it lets this app ask Google for its own private folder in your Drive.</small>'
       +'<input class="sy-in" data-f="cid" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="…apps.googleusercontent.com" value="'+esc(c.cid||'')+'">'
       +'<details class="sy-how"><summary>How to get one (about 5 minutes, on a computer is easiest)</summary><ol>'
       +'<li>Go to <b>console.cloud.google.com</b> and sign in with your own Google account. Create a project (any name, e.g. “Assisting sync”).</li>'
       +'<li><b>APIs &amp; Services → Library</b>: search <b>Google Drive API</b> and tap <b>Enable</b>.</li>'
       +'<li><b>APIs &amp; Services → OAuth consent screen</b> (Google Auth Platform): app name “Assisting sync”, your email as support and contact email, audience <b>External</b>. Leave it in <b>Testing</b> and add your own Gmail address under <b>Test users</b>.</li>'
       +'<li>Under <b>Data access</b> (scopes), add <b>…/auth/drive.appdata</b>.</li>'
       +'<li><b>Clients → Create client</b>: type <b>Web application</b>. Under <b>Authorised JavaScript origins</b> add <b>'+esc(location.origin)+'</b> — no path, no slash at the end. No redirect URI is needed.</li>'
       +'<li>Copy the <b>Client ID</b> (it ends in .apps.googleusercontent.com) and paste it above. Do the same on your other devices — the same client ID works everywhere the app is opened from '+esc(location.origin)+'.</li>'
       +'</ol><p class="sy-note">The client ID isn’t a secret and no client secret is needed. In Testing mode only the test users you list can sign in.</p></details></li>'
     +'<li class="'+(c.cid?(signedIn()?'done':'cur'):'')+'"><b>Sign in to Google</b><small>Google asks once if this app may use its own folder in your Drive. Tick the box.</small>'
       +'<button type="button" class="sy-sec" data-a="signin"'+(c.cid?'':' disabled')+'>'+I('cloud')+(signedIn()?'Signed in ✓':'Sign in with Google')+'</button></li>'
     +'<li class="'+(signedIn()?'cur':'')+'"><b>Sync passphrase</b>'+passHtml()+'</li></ol>';
  }
  h+='<p class="sy-note sy-priv">'+I('lock')+'<span>Encrypted on this device before it goes anywhere (AES-256). Google holds only scrambled data, in a hidden app folder only this app can reach. Without the passphrase the copy in Google Drive can’t be opened by anyone — keep it somewhere safe. Keep personal details of members of the public to the minimum — this isn’t your official notebook.</span></p></div>';
  main.innerHTML=h; wire(); }
function passHtml(){ if(!signedIn())return '<small>After you sign in.</small>';
  if(!stage)return '<small>Checking Google Drive…</small>';
  if(stage.err)return '<p class="sy-err">'+esc(stage.err)+'</p><button type="button" class="sy-sec" data-a="recheck">Try again</button>';
  if(stage.file)return '<small>There’s already a copy from your other device'+(stage.file.dev?' ('+esc(stage.file.dev)+(stage.file.at?', '+esc(when(stage.file.at)):'')+')':'')+'. Enter the passphrase you set there.</small>'
    +'<input class="sy-in" data-f="p1" type="password" autocomplete="current-password" placeholder="Sync passphrase"><p class="sy-err" hidden></p>'
    +'<button type="button" class="sy-go" data-a="unlock">'+I('key-round')+'Unlock and sync</button>';
  return '<small>Make one up — a few random words is good, e.g. “harbour lamp nineteen velvet”. You’ll type it once on each device. <b>If you forget it, the copy in Google Drive can’t be opened.</b></small>'
    +'<input class="sy-in" data-f="p1" type="password" autocomplete="new-password" placeholder="New passphrase (10 characters or more)"><div class="sy-meter"><i></i></div>'
    +'<input class="sy-in" data-f="p2" type="password" autocomplete="new-password" placeholder="Type it again"><p class="sy-err" hidden></p>'
    +'<button type="button" class="sy-go" data-a="create">'+I('lock')+'Turn on sync</button>'; }
async function check(){ stage=null; paint();
  try{ const id=await findFile(); const f=id?await getFile(id):null; if(id)setCfg({fileId:id}); stage={file:f}; }
  catch(e){ stage={err:(e&&e.message)||'Couldn’t check Google Drive.'}; }
  paint(); }
function wire(){ const m=ov.querySelector('.sy-main'), err=t=>{ const e=m.querySelector('.sy-err'); if(e){ e.textContent=t; e.hidden=!t; } };
  const cid=m.querySelector('[data-f="cid"]'); if(cid)cid.onchange=()=>{ const v=cid.value.trim(); if(v&&!/\.apps\.googleusercontent\.com$/.test(v)){ if(W.grToast)W.grToast('That doesn’t look like a client ID — it ends in .apps.googleusercontent.com'); } setCfg({cid:v,consented:0}); forget(); stage=null; paint(); };
  const p1=m.querySelector('[data-f="p1"]'), meter=m.querySelector('.sy-meter i'); if(p1&&meter)p1.oninput=()=>{ const s=strength(p1.value); meter.style.width=(p1.value?25*Math.max(1,s):0)+'%'; meter.className='s'+s; };
  m.querySelectorAll('[data-a]').forEach(b=>{ const a=b.dataset.a;
    if(a==='auto'){ b.onchange=()=>{ setCfg({auto:b.checked}); }; return; }
    b.onclick=async()=>{
      if(a==='signin'){ if(signedIn())return; try{ await signIn(); check(); }catch(e){ if(W.grToast)W.grToast(e.message); paint(); } }
      else if(a==='recheck')check();
      else if(a==='create'){ const v1=m.querySelector('[data-f="p1"]').value, v2=m.querySelector('[data-f="p2"]').value;
        if(v1.length<10)return err('Use 10 characters or more — a few words is easiest.'); if(v1!==v2)return err('The two don’t match.');
        b.disabled=true; b.textContent='Setting up…'; try{ await setPass(v1,null); await syncNow(true); }catch(e){ err(e.message); b.disabled=false; } paint(); }
      else if(a==='unlock'){ const v1=m.querySelector('[data-f="p1"]').value; if(!v1)return err('Enter the passphrase.');
        b.disabled=true; b.textContent='Unlocking…'; try{ await setPass(v1,stage.file); await syncNow(true); }catch(e){ err(e.message); b.disabled=false; b.innerHTML=I('key-round')+'Unlock and sync'; return; } paint(); }
      else if(a==='sync')tapSync();
      else if(a==='off'){ if(b.dataset.sure!=='1'){ b.dataset.sure='1'; b.textContent='Tap again to turn it off'; return; } await kdel('key'); setCfg({on:0,err:'',last:0}); forget(); stage=null; paint(); paintChips(); if(W.grToast)W.grToast('Sync is off on this device'); }
      else if(a==='wipe'){ if(b.dataset.sure!=='1'){ b.dataset.sure='1'; b.textContent='Tap again — it can’t be undone'; return; }
        try{ if(!signedIn())await signIn(); const id=cfg().fileId||await findFile(); if(id)await deleteFile(id); await kdel('key'); setCfg({on:0,fileId:'',err:'',last:0}); stage=null; paint(); paintChips(); if(W.grToast)W.grToast('The copy in Google Drive is deleted'); }
        catch(e){ if(W.grToast)W.grToast(e.message); } } }; });
  if(!cfg().on&&signedIn()&&!stage)check(); }

/* ---------- a small cloud button for other screens (Tasks, My roster) ---------- */
let chips=[];
function chipHtml(){ const c=cfg(), on=!!c.on; return I(busy?'refresh-cw':!on?'cloud-off':c.err?'cloud-off':'cloud-check')+'<span class="sy-cl">'+(busy?'Syncing':!on?'Sync':c.err?'Sync':signedIn()?'Synced':'Sync')+'</span>'; }
function mountChip(el){ if(!el)return; chips=chips.filter(x=>x.isConnected); if(!chips.includes(el))chips.push(el); el.innerHTML=chipHtml(); el.classList.toggle('on',!!cfg().on); el.classList.toggle('err',!!cfg().err);
  el.onclick=tapSync; }
function paintChips(){ chips=chips.filter(x=>x.isConnected); chips.forEach(mountChip); }

W.openSync=openSync; W.closeSync=closeSync; W.synBack=synBack;
W.GRSync=Object.freeze({open:openSync,now:tapSync,mountChip,_lib:{mergeTasks,merge,collect,seal,unseal,deriveKey,strength}});
})();
