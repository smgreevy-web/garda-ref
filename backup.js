/* Assisting — Backup file: everything you've entered (jobs, roster, custody clocks, notes text, favourites, settings) in one file,
   encrypted on this phone with a passphrase only you know (AES-256-GCM, key from PBKDF2-SHA-256). Nothing is uploaded: the file is
   saved to the phone and you decide where it goes. Photos, sketches and recordings are not in the file. Keys and the app lock are never included. */
(function(){
'use strict';
const W=window, D=document, te=new TextEncoder(), td=new TextDecoder(), ITER=310000, AD='assisting-backup-1';
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const SKIP=/^(gr_apikey|gr_tomtom|gr_lock|gr_sync|gr_sync_m|gr_ai_thread|gr_pp_active)$/;
const b64=u=>{ const a=new Uint8Array(u); let s=''; for(let i=0;i<a.length;i+=0x8000)s+=String.fromCharCode.apply(null,a.subarray(i,i+0x8000)); return btoa(s); };
const unb64=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
async function key(pass,salt){ const base=await crypto.subtle.importKey('raw',te.encode(String(pass).normalize('NFC')),'PBKDF2',false,['deriveKey']);
  return crypto.subtle.deriveKey({name:'PBKDF2',salt,iterations:ITER,hash:'SHA-256'},base,{name:'AES-GCM',length:256},false,['encrypt','decrypt']); }
function notesDb(){ return new Promise(res=>{ let r; try{ r=indexedDB.open('gr_notes'); }catch(e){ res(null); return; }
  r.onupgradeneeded=()=>{ try{ r.transaction.abort(); }catch(e){} }; r.onerror=()=>res(null); r.onsuccess=()=>{ const db=r.result; if(!db.objectStoreNames.contains('notes')){ db.close(); res(null); } else res(db); }; }); }
async function notesAll(){ const db=await notesDb(); if(!db)return []; return new Promise(res=>{ try{ const q=db.transaction('notes','readonly').objectStore('notes').getAll(); q.onsuccess=()=>{ db.close(); res(JSON.parse(JSON.stringify(q.result||[]))); }; q.onerror=()=>{ db.close(); res([]); }; }catch(e){ res([]); } }); }
async function notesPut(list){ if(!list||!list.length)return 0; try{ if(W.GRNotes&&GRNotes.recent)await GRNotes.recent(); }catch(e){} const db=await notesDb(); if(!db)return 0;
  return new Promise(res=>{ try{ const tx=db.transaction('notes','readwrite'), s=tx.objectStore('notes'); list.forEach(n=>s.put(n)); tx.oncomplete=()=>{ db.close(); res(list.length); }; tx.onerror=()=>{ db.close(); res(0); }; }catch(e){ res(0); } }); }
async function collect(){ const ls={}; for(let i=0;i<localStorage.length;i++){ const k=localStorage.key(i); if(/^gr_/.test(k)&&!SKIP.test(k))ls[k]=localStorage.getItem(k); }
  return {made:Date.now(),ver:W.GRAPP||'',ls,notes:await notesAll()}; }
async function make(pass){ const data=await collect(), salt=crypto.getRandomValues(new Uint8Array(16)), iv=crypto.getRandomValues(new Uint8Array(12)), k=await key(pass,salt);
  const ct=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:te.encode(AD)},k,te.encode(JSON.stringify(data)));
  return {file:{app:'Assisting',kind:'backup',v:1,enc:'AES-256-GCM',kdf:'PBKDF2-SHA-256',iter:ITER,salt:b64(salt),iv:b64(iv),ct:b64(ct),at:data.made},n:Object.keys(data.ls).length,notes:data.notes.length}; }
async function open(pass,f){ if(!f||f.app!=='Assisting'||f.kind!=='backup'||!f.ct)throw new Error('That isn’t an Assisting backup file.');
  const k=await key(pass,unb64(f.salt)); let pt; try{ pt=await crypto.subtle.decrypt({name:'AES-GCM',iv:unb64(f.iv),additionalData:te.encode(AD)},k,unb64(f.ct)); }catch(e){ throw new Error('That passphrase doesn’t open this file.'); }
  return JSON.parse(td.decode(pt)); }
async function restore(data){ Object.keys(data.ls||{}).forEach(k=>{ if(/^gr_/.test(k)&&!SKIP.test(k))localStorage.setItem(k,data.ls[k]); }); const n=await notesPut(data.notes||[]); return {keys:Object.keys(data.ls||{}).length,notes:n}; }
function sheet(){
  let o=D.getElementById('pSheet'); if(!o){ o=D.createElement('div'); o.id='pSheet'; D.body.appendChild(o); }
  o.innerHTML='<div class="p-shade"></div><div class="p-sheet pro bk" role="dialog" aria-label="Backup file"><h3>Backup file</h3><p>Your jobs, roster, custody clocks, notes text, favourites and settings in one file, locked with a passphrase. The file is saved to this phone — nothing is uploaded. Photos, sketches and recordings aren’t included.</p>'
   +'<label>Passphrase <small>at least 8 characters — there is no way to recover it</small><input type="password" class="bk-p" autocomplete="new-password" data-noassist></label>'
   +'<p class="bk-msg" role="status"></p><div class="p-acts"><button type="button" data-a="in">Restore from a file</button><button type="button" class="go" data-a="out">Save a backup file</button></div><input type="file" class="bk-f" accept=".assisting,application/json" hidden></div>';
  const close=()=>{ o.innerHTML=''; }, msg=(t,bad)=>{ const m=o.querySelector('.bk-msg'); m.textContent=t; m.classList.toggle('bad',!!bad); }, pass=()=>o.querySelector('.bk-p').value;
  o.querySelector('.p-shade').onclick=close;
  o.querySelector('[data-a="out"]').onclick=async()=>{ if(pass().length<8)return msg('Use a passphrase of at least 8 characters.',1); msg('Encrypting…');
    try{ const r=await make(pass()), d=new Date(), nm='assisting-backup-'+d.getFullYear()+String(d.getMonth()+1).padStart(2,'0')+String(d.getDate()).padStart(2,'0')+'.assisting';
      const a=D.createElement('a'); a.href=URL.createObjectURL(new Blob([JSON.stringify(r.file)],{type:'application/json'})); a.download=nm; D.body.appendChild(a); a.click(); setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); },4000);
      try{ localStorage.setItem('gr_backup_at',String(Date.now())); }catch(e){} msg('Saved '+nm+' — '+r.notes+' note'+(r.notes===1?'':'s')+' and your jobs, roster and settings. Keep the passphrase safe.'); }catch(e){ msg('Couldn’t make the backup: '+e.message,1); } };
  o.querySelector('[data-a="in"]').onclick=()=>{ if(pass().length<1)return msg('Type the passphrase for the file first.',1); o.querySelector('.bk-f').click(); };
  o.querySelector('.bk-f').onchange=async e=>{ const f=e.target.files&&e.target.files[0]; if(!f)return; msg('Opening…');
    try{ const data=await open(pass(),JSON.parse(await f.text())); const d=new Date(data.made);
      if(o.dataset.sure!==f.name){ o.dataset.sure=f.name; o._data=data; msg('Backup from '+d.toLocaleDateString('en-IE')+' '+d.toLocaleTimeString('en-IE',{hour:'2-digit',minute:'2-digit'})+'. Restoring replaces the jobs, roster and settings on this phone. Tap “Restore from a file” again and pick the same file to go ahead.'); e.target.value=''; return; }
      const r=await restore(data); msg('Restored — '+r.notes+' note'+(r.notes===1?'':'s')+'. Restarting…'); setTimeout(()=>location.reload(),1200); }catch(err){ msg(err.message||'Couldn’t read that file.',1); e.target.value=''; } };
}
W.GRBackup={sheet,_make:make,_open:open,_collect:collect,_restore:restore};
})();
