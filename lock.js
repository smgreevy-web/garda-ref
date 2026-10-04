/* Assisting — app lock: a username and password to open the app, checked on this phone only.
   The password is never stored: only a salted PBKDF2-SHA-256 hash (310 000 rounds) is kept in this app's storage.
   It stops someone who picks up the phone from opening Assisting; it does not encrypt what the app stores
   (locked notes have their own encryption). */
(function(){
'use strict';
const W=window, D=document, KEY='gr_lock', SEEN='gr_lock_seen';
const ROUNDS=310000;
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const b64=u8=>btoa(String.fromCharCode(...u8)), unb64=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
function cfg(){ try{ const c=JSON.parse(localStorage.getItem(KEY)||'null'); return c&&c.hash&&c.salt?c:null; }catch(e){ return null; } }
function setCfg(c){ try{ if(c)localStorage.setItem(KEY,JSON.stringify(c)); else localStorage.removeItem(KEY); }catch(e){} }
async function hash(user,pass,salt){
  const k=await crypto.subtle.importKey('raw',new TextEncoder().encode(String(user).trim().toLowerCase()+'\u0000'+pass),'PBKDF2',false,['deriveBits']);
  const bits=await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt,iterations:ROUNDS},k,256);
  return b64(new Uint8Array(bits)); }
async function check(user,pass){ const c=cfg(); if(!c)return true; return (await hash(user,pass,unb64(c.salt)))===c.hash; }
async function setLock(user,pass,after){ const salt=crypto.getRandomValues(new Uint8Array(16));
  setCfg({v:1,u:String(user).trim(),salt:b64(salt),hash:await hash(user,pass,salt),after:after==null?5:after,set:Date.now()}); }

/* ---- the lock screen ---- */
let fails=0, waitUntil=0, scr=null;
function locked(){ return D.documentElement.classList.contains('locked'); }
function lock(){ if(!cfg())return; D.documentElement.classList.add('locked'); show(); }
function unlock(){ D.documentElement.classList.remove('locked'); if(scr){ scr.remove(); scr=null; } try{ sessionStorage.setItem(SEEN,String(Date.now())); }catch(e){} fails=0; }
function show(){
  if(scr&&scr.isConnected)return; const c=cfg(); if(!c){ unlock(); return; }
  scr=D.createElement('div'); scr.id='lockScr'; scr.setAttribute('role','dialog'); scr.setAttribute('aria-label','Assisting is locked');
  scr.innerHTML='<form class="lk-card" autocomplete="on" action="#"><div class="lk-ico" aria-hidden="true">'+(W.GRI?GRI('lock'):'')+'</div><h1>Assisting</h1><p>Locked — sign in to open</p>'
    +'<label>Username<input id="lkU" name="username" autocomplete="username" autocapitalize="off" spellcheck="false" value="'+esc(c.u||'')+'"></label>'
    +'<label>Password<input id="lkP" name="password" type="password" autocomplete="current-password"></label>'
    +'<div class="lk-err" id="lkE" role="alert"></div><button class="lk-go" id="lkGo">Unlock</button>'
    +'<button type="button" class="lk-forgot" id="lkF">Forgotten your password?</button></form>';
  D.body.appendChild(scr);
  const f=scr.querySelector('form'), u=scr.querySelector('#lkU'), p=scr.querySelector('#lkP'), e=scr.querySelector('#lkE'), go=scr.querySelector('#lkGo');
  setTimeout(()=>{ (u.value?p:u).focus(); },60);
  f.addEventListener('submit',async ev=>{ ev.preventDefault();
    const now=Date.now(); if(now<waitUntil){ e.textContent='Too many tries — wait '+Math.ceil((waitUntil-now)/1000)+' s.'; return; }
    if(!u.value.trim()||!p.value){ e.textContent='Enter your username and password.'; return; }
    go.disabled=true; e.textContent='Checking…';
    let ok=false; try{ ok=await check(u.value,p.value); }catch(err){ e.textContent='This browser can’t check the password here.'; go.disabled=false; return; }
    go.disabled=false;
    if(ok){ unlock(); return; }
    fails++; p.value=''; p.focus();
    if(fails>=5){ waitUntil=Date.now()+Math.min(300,30*Math.pow(2,fails-5))*1000; e.textContent='Wrong username or password. Try again in '+Math.round((waitUntil-Date.now())/1000)+' s.'; }
    else e.textContent='Wrong username or password.'; });
  scr.querySelector('#lkF').addEventListener('click',forgot);
}
function forgot(){
  const card=scr&&scr.querySelector('.lk-card'); if(!card)return;
  card.innerHTML='<h1>Forgotten password</h1><p>The password can’t be recovered — it isn’t stored anywhere. To get back in, erase Assisting’s data on this phone: your notes, tasks, patrols, recordings, roster and settings are deleted and the lock is removed. The manual, guides and cases stay.</p>'
    +'<label>Type ERASE to confirm<input id="lkX" autocomplete="off" autocapitalize="characters"></label><div class="lk-err" id="lkE2" role="alert"></div>'
    +'<button type="button" class="lk-go danger" id="lkErase">Erase and unlock</button><button type="button" class="lk-forgot" id="lkBack">Back</button>';
  card.querySelector('#lkBack').addEventListener('click',()=>{ scr.remove(); scr=null; show(); });
  card.querySelector('#lkErase').addEventListener('click',async()=>{
    if(card.querySelector('#lkX').value.trim().toUpperCase()!=='ERASE'){ card.querySelector('#lkE2').textContent='Type ERASE to confirm.'; return; }
    await eraseAll(); location.reload(); }); }
async function eraseAll(){
  try{ localStorage.clear(); }catch(e){} try{ sessionStorage.clear(); }catch(e){}
  const names=new Set(['gr_notes','gr_patrol','gr_rec']);
  try{ if(indexedDB.databases)(await indexedDB.databases()).forEach(d=>d&&d.name&&names.add(d.name)); }catch(e){}
  await Promise.all([...names].map(n=>new Promise(r=>{ try{ const q=indexedDB.deleteDatabase(n); q.onsuccess=q.onerror=q.onblocked=()=>r(); }catch(e){ r(); } })));
  try{ await caches.delete('gr-share'); }catch(e){} }

/* ---- lock again after time away ---- */
let hiddenAt=0;
const mark=()=>{ if(!locked())try{ sessionStorage.setItem(SEEN,String(Date.now())); }catch(e){} };
D.addEventListener('visibilitychange',()=>{ const c=cfg(); if(!c)return;
  if(D.visibilityState==='hidden'){ hiddenAt=Date.now(); mark(); if(c.after===0)lock(); }
  else if(hiddenAt&&Date.now()-hiddenAt>=(c.after||0)*60000){ lock(); } });
W.addEventListener('pagehide',mark);

/* ---- settings sheet (Tools → Settings → App lock) ---- */
function sheet(){
  const c=cfg(); let o=D.getElementById('lkSet'); if(o)o.remove();
  o=D.createElement('div'); o.id='lkSet'; o.className='dsp';
  const afterOpts=[[0,'As soon as I leave the app'],[1,'After 1 minute away'],[5,'After 5 minutes away'],[15,'After 15 minutes away'],[60,'After 1 hour away']];
  o.innerHTML='<div class="dsp-shade"></div><div class="dsp-sheet lk-set"><div class="dsp-grip"></div><h3>App lock</h3>'
    +(c?'<p class="lk-note">On — username <b>'+esc(c.u)+'</b>. Assisting asks for your password when it opens.</p>'
        +'<div class="dsp-l">Lock again</div><div class="lk-opts">'+afterOpts.map(([m,l])=>'<button type="button" data-af="'+m+'" class="'+((c.after==null?5:c.after)===m?'on':'')+'">'+l+'</button>').join('')+'</div>'
        +'<div class="dsp-l">Change password or turn off</div><label class="lk-f">Current password<input type="password" id="lsCur" autocomplete="current-password"></label>'
        +'<label class="lk-f">New password <small>(leave empty to keep)</small><input type="password" id="lsNew" autocomplete="new-password"></label>'
        +'<div class="lk-err" id="lsE"></div><div class="lk-row"><button type="button" id="lsOff" class="lk-b">Turn lock off</button><button type="button" id="lsSave" class="lk-b on">Save</button></div>'
      :'<p class="lk-note">Ask for a username and password whenever Assisting opens. The password stays on this phone as a one-way hash — it can’t be recovered, so choose one you’ll remember.</p>'
        +'<label class="lk-f">Username<input id="lsU" autocomplete="username" autocapitalize="off" spellcheck="false"></label>'
        +'<label class="lk-f">Password <small>(at least 6 characters)</small><input type="password" id="lsP" autocomplete="new-password"></label>'
        +'<label class="lk-f">Password again<input type="password" id="lsP2" autocomplete="new-password"></label>'
        +'<div class="dsp-l">Lock again</div><div class="lk-opts">'+afterOpts.map(([m,l])=>'<button type="button" data-af="'+m+'" class="'+(m===5?'on':'')+'">'+l+'</button>').join('')+'</div>'
        +'<div class="lk-err" id="lsE"></div><div class="lk-row"><button type="button" id="lsCancel" class="lk-b">Cancel</button><button type="button" id="lsOn" class="lk-b on">Turn lock on</button></div>')
    +'<p class="lk-small">The lock stops someone who picks up your phone from opening Assisting. It doesn’t encrypt what Assisting stores — use the notes lock for anything sensitive, and your phone’s own screen lock.</p></div>';
  D.body.appendChild(o);
  const $=s=>o.querySelector(s), err=t=>{ $('#lsE').textContent=t||''; }, close=()=>o.remove();
  let after=c?(c.after==null?5:c.after):5;
  o.querySelector('.dsp-shade').addEventListener('click',close);
  o.querySelectorAll('[data-af]').forEach(b=>b.addEventListener('click',()=>{ after=+b.dataset.af; o.querySelectorAll('[data-af]').forEach(x=>x.classList.toggle('on',x===b));
    if(c){ const cc=cfg(); cc.after=after; setCfg(cc); } }));
  if(!c){
    $('#lsCancel').addEventListener('click',close);
    $('#lsOn').addEventListener('click',async()=>{ const u=$('#lsU').value.trim(), p=$('#lsP').value, p2=$('#lsP2').value;
      if(!u)return err('Choose a username.'); if(p.length<6)return err('The password needs at least 6 characters.'); if(p!==p2)return err('The two passwords don’t match.');
      err('Saving…'); await setLock(u,p,after); try{ sessionStorage.setItem(SEEN,String(Date.now())); }catch(e){} close(); if(W.grToast)grToast('App lock is on'); });
  } else {
    $('#lsOff').addEventListener('click',async()=>{ err('Checking…'); if(!(await check(c.u,$('#lsCur').value)))return err('Current password is wrong.'); setCfg(null); close(); if(W.grToast)grToast('App lock is off'); });
    $('#lsSave').addEventListener('click',async()=>{ const np=$('#lsNew').value; if(!np){ close(); return; }
      err('Checking…'); if(!(await check(c.u,$('#lsCur').value)))return err('Current password is wrong.'); if(np.length<6)return err('The new password needs at least 6 characters.');
      await setLock(c.u,np,after); close(); if(W.grToast)grToast('Password changed'); });
  }
  return true; }

/* ---- start-up: the page was hidden by the inline script if a lock is set ---- */
if(cfg()){ let seen=0; try{ seen=+sessionStorage.getItem(SEEN)||0; }catch(e){}
  const c=cfg(); if(seen&&(c.after||0)>0&&Date.now()-seen<c.after*60000){ D.documentElement.classList.remove('locked'); } else lock(); }
else D.documentElement.classList.remove('locked');
W.GRLock=Object.freeze({on:()=>!!cfg(),lock,sheet,_check:check,_set:setLock});
W.lockBack=()=>{ const s=D.getElementById('lkSet'); if(s){ s.remove(); return true; } return locked(); };   // Back can't get past the lock screen
})();
