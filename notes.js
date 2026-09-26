/* Garda Reference — Notes (Samsung Notes style): rich-text notes, checklists, photos, sketches, folders,
   per-note encryption (AES-GCM, PBKDF2) and JSON backup. Self-contained IIFE: no dependencies, no network.
   Content lives only in IndexedDB "gr_notes" on this phone. Styles in notes.css (#nts / .nts scoped). */
(function(){
'use strict';
const W=window, D=document;
const DAY=864e5, MIN=6e4, TRASH_DAYS=30;

/* ---------- small helpers ---------- */
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const p2=n=>String(n).padStart(2,'0');
const DAYS=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'], MON=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const hm=t=>{const d=new Date(t);return p2(d.getHours())+':'+p2(d.getMinutes());};
const dayLong=t=>{const d=new Date(t);return DAYS[d.getDay()]+' '+d.getDate()+' '+MON[d.getMonth()]+' '+d.getFullYear();};
const full=t=>hm(t)+' · '+dayLong(t);
const sameDay=(a,b)=>a.getFullYear()===b.getFullYear()&&a.getMonth()===b.getMonth()&&a.getDate()===b.getDate();
function shortWhen(t){
  const d=new Date(t), n=new Date(), y=new Date(n.getFullYear(),n.getMonth(),n.getDate()-1);
  if(sameDay(d,n))return hm(t)+' · Today';
  if(sameDay(d,y))return hm(t)+' · Yesterday';
  if(d.getFullYear()===n.getFullYear())return hm(t)+' · '+d.getDate()+' '+MON[d.getMonth()];
  return d.getDate()+' '+MON[d.getMonth()]+' '+d.getFullYear();
}
const stampTxt=()=>{const d=new Date();return p2(d.getDate())+'/'+p2(d.getMonth()+1)+'/'+d.getFullYear()+' '+p2(d.getHours())+':'+p2(d.getMinutes())+' — ';};
const fileStamp=t=>{const d=new Date(t);return p2(d.getDate())+'-'+p2(d.getMonth()+1)+'-'+d.getFullYear()+'_'+p2(d.getHours())+p2(d.getMinutes());};
const uid=p=>p+Date.now().toString(36)+Math.random().toString(36).slice(2,8);
const LSget=(k,d)=>{try{const v=localStorage.getItem('nts_'+k);return v==null?d:JSON.parse(v);}catch(e){return d;}};
const LSset=(k,v)=>{try{localStorage.setItem('nts_'+k,JSON.stringify(v));}catch(e){}};
const q=(r,s)=>r.querySelector(s), qa=(r,s)=>Array.from(r.querySelectorAll(s));
const vib=p=>{try{if(navigator.vibrate)navigator.vibrate(p);}catch(e){}};
const svg=(p,cls)=>'<svg viewBox="0 0 24 24" aria-hidden="true"'+(cls?' class="'+cls+'"':'')+'>'+p+'</svg>';
const plural=(n,w,ws)=>n+' '+(n===1?w:(ws||w+'s'));
const wordCount=t=>(String(t||'').match(/[\p{L}\p{N}][\p{L}\p{N}'’\-.]*/gu)||[]).length;
const nextFrame=()=>new Promise(r=>requestAnimationFrame(()=>r()));
function el(html){const t=D.createElement('template');t.innerHTML=html.trim();return t.content.firstElementChild;}
function toBlob(cv,type,qual){return new Promise((res,rej)=>{try{cv.toBlob(b=>b?res(b):rej(new Error('Image encoding failed')),type,qual);}catch(e){rej(e);}});}
function download(blob,name){
  const u=URL.createObjectURL(blob), a=D.createElement('a'); a.href=u; a.download=name; a.rel='noopener'; a.style.display='none';
  (ov||D.body).appendChild(a); a.click(); a.remove(); setTimeout(()=>{try{URL.revokeObjectURL(u);}catch(e){}},60000);
}
const safeName=s=>String(s||'').replace(/[\\/:*?"<>|\u0000-\u001f]+/g,' ').replace(/\s+/g,' ').trim().slice(0,60).replace(/ /g,'-')||'Note';

/* ---------- icons (stroke line art, currentColor) ---------- */
const IC={
  back:'<path d="M15 5l-7 7 7 7"/>',
  settings:'<path d="M4 7h10M18.5 7H20M4 17h3.5M12 17h8"/><circle cx="16.2" cy="7" r="2.3"/><circle cx="9.8" cy="17" r="2.3"/>',
  dots:'<circle cx="12" cy="5.5" r="1.7" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.7" fill="currentColor" stroke="none"/><circle cx="12" cy="18.5" r="1.7" fill="currentColor" stroke="none"/>',
  star:'<path d="m12 3.3 2.65 5.4 5.95.87-4.3 4.2 1.02 5.93L12 16.9l-5.32 2.8 1.02-5.93-4.3-4.2 5.95-.87z"/>',
  folder:'<path d="M3 6.6A1.6 1.6 0 0 1 4.6 5h4.1l2.1 2.3h8.6A1.6 1.6 0 0 1 21 8.9v9.5a1.6 1.6 0 0 1-1.6 1.6H4.6A1.6 1.6 0 0 1 3 18.4z"/>',
  palette:'<path d="M12 3a9 9 0 1 0 0 18c1.2 0 1.8-.8 1.8-1.7 0-1.2-1-1.6-1-2.6 0-.9.7-1.6 1.7-1.6h2.2A4.3 4.3 0 0 0 21 10.8C21 6.5 17 3 12 3z"/><circle cx="7.5" cy="11.3" r="1.2"/><circle cx="10.3" cy="7.3" r="1.2"/><circle cx="15" cy="7.6" r="1.2"/>',
  trash:'<path d="M4 6.5h16M9.5 6.5V4.2h5v2.3M6 6.5l1 13.3a1.5 1.5 0 0 0 1.5 1.4h7a1.5 1.5 0 0 0 1.5-1.4l1-13.3M10 10.5v6.5M14 10.5v6.5"/>',
  lock:'<rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8 10.5V7.6a4 4 0 0 1 8 0v2.9M12 14.4v2.6"/>',
  unlock:'<rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8 10.5V7.6a4 4 0 0 1 7.7-1.6M12 14.4v2.6"/>',
  copy:'<rect x="8.5" y="8.5" width="12" height="12" rx="2"/><path d="M15.5 8.5V5A1.5 1.5 0 0 0 14 3.5H5A1.5 1.5 0 0 0 3.5 5v9A1.5 1.5 0 0 0 5 15.5h3.5"/>',
  download:'<path d="M12 3.5v12M7 10.5l5 5 5-5M4.5 20.5h15"/>',
  upload:'<path d="M12 15.5v-12M7 8.5l5-5 5 5M4.5 20.5h15"/>',
  print:'<path d="M7 8V3.5h10V8"/><rect x="3.5" y="8" width="17" height="8.5" rx="1.6"/><path d="M7 13.5h10v7H7z"/>',
  search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 5 5"/>',
  x:'<path d="M6 6l12 12M18 6 6 18"/>',
  grid:'<rect x="3.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.5"/>',
  rows:'<rect x="3.5" y="4" width="17" height="6.5" rx="1.5"/><rect x="3.5" y="13.5" width="17" height="6.5" rx="1.5"/>',
  sort:'<path d="M7 4v16M3.5 16.5 7 20l3.5-3.5M17 20V4M13.5 7.5 17 4l3.5 3.5"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',
  camera:'<path d="M3 8.3A1.3 1.3 0 0 1 4.3 7h2.9l1.8-2.5h6L16.8 7h2.9A1.3 1.3 0 0 1 21 8.3v10.4a1.3 1.3 0 0 1-1.3 1.3H4.3A1.3 1.3 0 0 1 3 18.7z"/><circle cx="12" cy="13.3" r="3.8"/>',
  image:'<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9.5" r="1.8"/><path d="m21 15.5-5.2-5.2L5.5 20"/>',
  pen:'<path d="M4 20l1.2-4.5L16 4.7a2 2 0 0 1 2.8 0l.5.5a2 2 0 0 1 0 2.8L8.5 18.8z"/><path d="M14.4 6.3l3.3 3.3"/>',
  marker:'<path d="M14.2 4.1l5.7 5.7-7.6 7.6-5.7-5.7z"/><path d="M6.6 11.7 4.4 17.4l2.2 2.2 5.7-2.2"/><path d="M3.5 21h8"/>',
  eraser:'<path d="M8.5 20.5h11"/><path d="M4.4 15.8 13.6 6.6a2 2 0 0 1 2.8 0l3 3a2 2 0 0 1 0 2.8l-8.1 8.1H8.4l-4-4a.5.5 0 0 1 0-.7z"/><path d="m9.2 11.2 5.6 5.6"/>',
  undo:'<path d="M9 14.5 4 9.5l5-5"/><path d="M4 9.5h10a6 6 0 0 1 0 12h-3"/>',
  redo:'<path d="m15 14.5 5-5-5-5"/><path d="M20 9.5H10a6 6 0 0 0 0 12h3"/>',
  ul:'<path d="M9.5 6.5h11M9.5 12h11M9.5 17.5h11"/><circle cx="4.8" cy="6.5" r="1.4" fill="currentColor" stroke="none"/><circle cx="4.8" cy="12" r="1.4" fill="currentColor" stroke="none"/><circle cx="4.8" cy="17.5" r="1.4" fill="currentColor" stroke="none"/>',
  ol:'<path d="M10 6.5h10.5M10 12h10.5M10 17.5h10.5"/><path d="M3.8 5 5.3 4v5M3.6 13.4a1.5 1.5 0 1 1 2.6 1L3.6 18h3" stroke-width="1.4"/>',
  check:'<rect x="3" y="3.8" width="7" height="7" rx="1.5"/><path d="m4.6 7.3 1.5 1.5 2.6-2.9"/><rect x="3" y="13.8" width="7" height="7" rx="1.5"/><path d="M13 7.3h8M13 17.3h8"/>',
  clock:'<circle cx="12" cy="12" r="8.5"/><path d="M12 7.3V12l3.2 2"/>',
  kbd:'<rect x="2.5" y="3.5" width="19" height="11.5" rx="2"/><path d="M6 7.5h.01M9.3 7.5h.01M12.6 7.5h.01M15.9 7.5h.01M18 7.5h.01M7 11.2h10" stroke-width="2"/><path d="m8.8 18.2 3.2 2.8 3.2-2.8"/>',
  hand:'<path d="M8 13V5.6a1.5 1.5 0 0 1 3 0V11m0-1V4.2a1.5 1.5 0 0 1 3 0V10m0 .5V5.6a1.5 1.5 0 0 1 3 0V13c0 4.5-2.5 7.5-6.5 7.5-3 0-4.5-1.5-6-4l-1.7-3a1.4 1.4 0 0 1 2.3-1.6L8 13"/>',
  pageGrid:'<rect x="3.5" y="3.5" width="17" height="17" rx="1.5"/><path d="M3.5 9.2h17M3.5 14.8h17M9.2 3.5v17M14.8 3.5v17"/>',
  pageLined:'<rect x="3.5" y="3.5" width="17" height="17" rx="1.5"/><path d="M6.5 8.5h11M6.5 12.5h11M6.5 16.5h11"/>',
  pagePlain:'<rect x="3.5" y="3.5" width="17" height="17" rx="1.5"/>',
  tick:'<path d="m4.5 12.5 5 5 10-11"/>',
  restore:'<path d="M4 12a8 8 0 1 0 2.4-5.7"/><path d="M4 4v4.5h4.5"/>',
  info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5h.01" stroke-width="2"/>',
  note:'<path d="M6 3.5h8.5l4 4V19a1.5 1.5 0 0 1-1.5 1.5H6A1.5 1.5 0 0 1 4.5 19V5A1.5 1.5 0 0 1 6 3.5z"/><path d="M14 3.5V8h4.5M8 12h8M8 15.5h8M8 8.5h3"/>',
  tcolor:'<path d="M6.5 16.5 12 3.5l5.5 13M8.4 12h7.2"/>',
  hl:'<path d="M14.2 3.6l5.2 5.2-7.4 7.4H6.8v-5.2z"/><path d="M4 20.5h16"/>'
};

/* ---------- palettes ---------- */
const TINTS=[['','None','#9fb0c8'],['rose','Rose','#ff8fab'],['amber','Amber','#ffb45e'],['lemon','Lemon','#eedc5b'],
  ['mint','Mint','#5fd3a0'],['sky','Sky','#6cc4ff'],['lilac','Lilac','#b99cff']];
const TINTK=new Set(TINTS.map(t=>t[0]));
const TX_COL=[['Red','#ff6b6b'],['Orange','#ffa94d'],['Green','#69db7c'],['Blue','#74c0fc'],['Purple','#da77f2']];
const HL=[255,214,10,0.4], HLS='rgba(255, 214, 10, 0.4)';

/* ---------- IndexedDB: gr_notes v1 — notes (index updated), blobs (index note), meta ---------- */
let dbP=null;
function idb(){
  if(dbP)return dbP;
  dbP=new Promise((res,rej)=>{
    let r; try{r=indexedDB.open('gr_notes',1);}catch(e){dbP=null;rej(e);return;}
    r.onupgradeneeded=()=>{const db=r.result;
      if(!db.objectStoreNames.contains('notes'))db.createObjectStore('notes',{keyPath:'id'}).createIndex('updated','updated');
      if(!db.objectStoreNames.contains('blobs'))db.createObjectStore('blobs',{keyPath:'id'}).createIndex('note','note');
      if(!db.objectStoreNames.contains('meta'))db.createObjectStore('meta',{keyPath:'id'});};
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
const dbGet=(st,id)=>run([st],'readonly',(t,set)=>rq(t.objectStore(st).get(id),set));
const dbAll=st=>run([st],'readonly',(t,set)=>rq(t.objectStore(st).getAll(),set));
const dbPut=(st,v)=>run([st],'readwrite',t=>{t.objectStore(st).put(v);});
const blobsOf=nid=>run(['blobs'],'readonly',(t,set)=>rq(t.objectStore('blobs').index('note').getAll(nid),set));
let persistAsked=false;
function askPersist(){ if(persistAsked)return; persistAsked=true; try{ if(navigator.storage&&navigator.storage.persist)navigator.storage.persist().catch(()=>{}); }catch(e){} }

/* ---------- in-memory state ---------- */
let ALL=new Map(), FOLDERS=[], LOCK=null, loadP=null;
function load(force){
  if(loadP&&!force)return loadP;
  loadP=Promise.all([dbAll('notes'),dbGet('meta','folders'),dbGet('meta','lock')]).then(([ns,f,l])=>{
    ALL=new Map((ns||[]).map(n=>[n.id,n])); FOLDERS=(f&&Array.isArray(f.list))?f.list:[]; LOCK=l||null;
  }).catch(e=>{loadP=null;throw e;});
  return loadP;
}
function putNote(rec){ ALL.set(rec.id,rec); askPersist(); return dbPut('notes',rec); }
function putNotes(recs){ recs.forEach(r=>ALL.set(r.id,r)); askPersist(); return run(['notes'],'readwrite',t=>{const s=t.objectStore('notes');recs.forEach(r=>s.put(r));}); }
function saveFolders(){ return dbPut('meta',{id:'folders',list:FOLDERS}); }
function deleteNotesHard(ids){
  ids.forEach(id=>ALL.delete(id));
  return run(['notes','blobs'],'readwrite',t=>{const ns=t.objectStore('notes'),bs=t.objectStore('blobs'),ix=bs.index('note');
    ids.forEach(id=>{ns.delete(id); rq(ix.getAllKeys(id),keys=>keys.forEach(k=>bs.delete(k)));});});
}
const blobIds=html=>{const s=new Set(),re=/data-blob="([A-Za-z0-9_-]+)"/g;let m;while((m=re.exec(html||'')))s.add(m[1]);return s;};
const firstBlob=html=>{const m=/data-blob="([A-Za-z0-9_-]+)"/.exec(html||'');return m?m[1]:null;};

/* ---------- sanitiser: allowlist of exactly what the editor generates ---------- */
const MAPT={B:'b',STRONG:'b',I:'i',EM:'i',U:'u',INS:'u',S:'s',STRIKE:'s',DEL:'s',H1:'h2',H2:'h2',H3:'h3',H4:'h3',H5:'h3',H6:'h3',
  P:'p',DIV:'div',BR:'br',UL:'ul',OL:'ol',LI:'li',MARK:'',SPAN:'',FONT:'',IMG:'img'};
const BLOCKY=new Set(['ADDRESS','ARTICLE','ASIDE','BLOCKQUOTE','DD','DETAILS','DL','DT','FIELDSET','FIGCAPTION','FIGURE','FOOTER','HEADER','HGROUP','MAIN','NAV','PRE','SECTION','SUMMARY','TABLE','TR','CAPTION','CENTER']);
const DROP=new Set(['SCRIPT','STYLE','IFRAME','FRAME','FRAMESET','OBJECT','EMBED','APPLET','NOSCRIPT','TEMPLATE','SVG','MATH','CANVAS','VIDEO','AUDIO','SOURCE','TRACK',
  'INPUT','TEXTAREA','SELECT','OPTION','BUTTON','LINK','META','BASE','TITLE','HEAD','PARAM','MAP','AREA','PICTURE','DIALOG','PORTAL','XMP','PLAINTEXT']);
function parseCol(v){
  v=String(v||'').trim().toLowerCase(); let m;
  if((m=/^#([0-9a-f]{3})$/.exec(v)))return [...m[1]].map(c=>parseInt(c+c,16)).concat(1);
  if((m=/^#([0-9a-f]{6})$/.exec(v)))return [0,2,4].map(i=>parseInt(m[1].substr(i,2),16)).concat(1);
  if((m=/^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*(?:,\s*([\d.]+)\s*)?\)$/.exec(v)))return [+m[1],+m[2],+m[3],m[4]==null?1:+m[4]];
  return null;
}
const near=(a,b)=>!!(a&&b)&&Math.abs(a[0]-b[0])<=3&&Math.abs(a[1]-b[1])<=3&&Math.abs(a[2]-b[2])<=3&&Math.abs(a[3]-b[3])<=0.06;
function txCol(v){const c=parseCol(v);if(!c)return null;for(const t of TX_COL){const h=parseCol(t[1]);if(near(c,h))return 'rgb('+h[0]+', '+h[1]+', '+h[2]+')';}return null;}
const isHL=v=>near(parseCol(v),HL);
function styleWraps(n,tag){
  let col=null,hl=tag==='MARK',b=false,i=false,u=false,s=false;
  if(tag==='FONT')col=txCol(n.getAttribute('color'));
  String(n.getAttribute('style')||'').split(';').forEach(decl=>{
    const k=decl.indexOf(':'); if(k<0)return; const p=decl.slice(0,k).trim().toLowerCase(), v=decl.slice(k+1).trim().toLowerCase();
    if(p==='color'){const c=txCol(v);if(c)col=c;}
    else if(p==='background-color'||p==='background'){if(isHL(v))hl=true;}
    else if(p==='font-weight'){if(v==='bold'||v==='bolder'||+v>=600)b=true;}
    else if(p==='font-style'){if(v==='italic'||v==='oblique')i=true;}
    else if(p==='text-decoration'||p==='text-decoration-line'){if(v.includes('underline'))u=true;if(v.includes('line-through'))s=true;}
  });
  const o=[],c=[];
  if(col||hl){o.push('<span style="'+(col?'color: '+col+';':'')+(col&&hl?' ':'')+(hl?'background-color: '+HLS+';':'')+'">');c.unshift('</span>');}
  [[b,'b'],[i,'i'],[u,'u'],[s,'s']].forEach(([f,t])=>{if(f&&t!==MAPT[tag]){o.push('<'+t+'>');c.unshift('</'+t+'>');}});
  return [o.join(''),c.join('')];
}
const hasCls=(n,c)=>(' '+(n.getAttribute&&n.getAttribute('class')||'')+' ').indexOf(' '+c+' ')>=0;
function sanNode(n,out,d){
  if(n.nodeType===3){out.push(esc(n.data.replace(/\u200b/g,'')));return;}
  if(n.nodeType!==1)return;
  const tag=String(n.tagName).toUpperCase();
  if(DROP.has(tag))return;
  if(d>80){out.push(esc(n.textContent));return;}
  let t=MAPT[tag];
  if(t===undefined){ if(BLOCKY.has(tag)){t='div';} else {sanKids(n,out,d);return;} }
  if(t==='br'){out.push('<br>');return;}
  if(t==='img'){const id=n.getAttribute('data-blob');if(id&&/^[A-Za-z0-9_-]{4,64}$/.test(id))out.push('<img data-blob="'+id+'">');return;}
  if(tag==='SPAN'&&hasCls(n,'nts-cb'))return;                 // a checkbox outside its checklist line
  const [so,sc]=styleWraps(n,tag);
  if(t===''){out.push(so);sanKids(n,out,d);out.push(sc);return;}
  if(t==='div'&&hasCls(n,'nts-ck')){
    let f=n.firstChild; while(f&&f.nodeType===3&&!f.data.trim())f=f.nextSibling;
    if(f&&f.nodeType===1&&hasCls(f,'nts-cb')){
      const done=f.textContent.indexOf('☑')>=0;
      out.push('<div class="nts-ck'+(done?' nts-done':'')+'"><span class="nts-cb" contenteditable="false">'+(done?'☑':'☐')+'</span>'+so);
      for(let c=f.nextSibling;c;c=c.nextSibling)sanNode(c,out,d+1);
      out.push(sc+'</div>'); return;
    }
  }
  out.push('<'+t+'>'+so); sanKids(n,out,d); out.push(sc+'</'+t+'>');
}
function sanKids(n,out,d){for(let c=n.firstChild;c;c=c.nextSibling)sanNode(c,out,d+1);}
let PARSER=null;
function parseDoc(html){ if(!PARSER)PARSER=new DOMParser(); return PARSER.parseFromString('<!doctype html><html><body>'+String(html||'')+'</body></html>','text/html'); }
function sanitize(html){
  if(!html)return '';
  const out=[]; sanKids(parseDoc(html).body,out,0);
  return out.join('').replace(/<(b|i|u|s|span[^>]*)><\/(b|i|u|s|span)>/g,'');
}
/* plain text (search, previews, word count, copy, .txt) from sanitised HTML */
function textOf(root){
  let s='';
  const nl=()=>{if(s&&s[s.length-1]!=='\n')s+='\n';};
  (function walk(n){
    for(let c=n.firstChild;c;c=c.nextSibling){
      if(c.nodeType===3){s+=c.data.replace(/[\r\n\t]+/g,' ').replace(/\u00a0/g,' ');continue;}
      if(c.nodeType!==1)continue;
      const t=c.tagName;
      if(t==='BR'){s+='\n';continue;}
      if(t==='IMG'){nl();s+='[Image]\n';continue;}
      if(t==='SPAN'&&hasCls(c,'nts-cb')){s+=(c.textContent.indexOf('☑')>=0?'☑':'☐')+' ';continue;}
      const blk=/^(DIV|P|H2|H3|UL|OL|LI)$/.test(t);
      if(blk)nl();
      if(t==='LI'){const p=c.parentNode; if(p&&p.tagName==='OL'){let i=1;for(let x=c.previousElementSibling;x;x=x.previousElementSibling)if(x.tagName==='LI')i++;s+=i+'. ';} else s+='• ';}
      walk(c);
      if(blk)nl();
    }
  })(root);
  return s.replace(/[ \t]+\n/g,'\n').replace(/\n{3,}/g,'\n\n').trim();
}
const htmlText=html=>html?textOf(parseDoc(html).body):'';

/* =====================================================================
   OVERLAY SHELL: top bar, toast, bottom sheets, Back, keyboard-safe sizing
   ===================================================================== */
let ov=null, topEl=null, ttlEl=null, tactEl=null, mainEl=null, shadeEl=null, sheetEl=null, toastEl=null, viewerEl=null, skEl=null, toastT=0;
const S={view:'list', filter:'all', q:'', sort:LSget('sort','edited'), mode:LSget('view','grid'), sel:null, listStale:true};
function build(){
  if(ov&&ov.isConnected)return;
  if(!D.querySelector('link[href*="notes.css"]')){const l=D.createElement('link');l.rel='stylesheet';l.href='notes.css';D.head.appendChild(l);}
  ov=el('<div id="nts" class="nts" role="dialog" aria-modal="true" aria-label="Notes" tabindex="-1" hidden>'
    +'<div class="nts-top"><button type="button" class="nts-back" aria-label="Back">‹ Back</button>'
    +'<div class="nts-tt"><b class="nts-title">Notes</b><span class="hudclock" data-f="line"></span></div><div class="nts-tacts"></div></div>'
    +'<div class="nts-main"></div><div class="nts-viewer" hidden></div><div class="nts-sk" hidden></div>'
    +'<div class="nts-shade" hidden></div><div class="nts-sheet" role="dialog" aria-modal="true" hidden></div>'
    +'<div class="nts-toast" role="status" aria-live="polite"></div></div>');
  D.body.appendChild(ov);
  topEl=q(ov,'.nts-top'); ttlEl=q(ov,'.nts-title'); tactEl=q(ov,'.nts-tacts'); mainEl=q(ov,'.nts-main');
  shadeEl=q(ov,'.nts-shade'); sheetEl=q(ov,'.nts-sheet'); toastEl=q(ov,'.nts-toast'); viewerEl=q(ov,'.nts-viewer'); skEl=q(ov,'.nts-sk');
  q(ov,'.nts-back').addEventListener('click',()=>ntsBack());
  shadeEl.addEventListener('click',()=>closeSheet());
  tactEl.addEventListener('click',e=>{const b=e.target.closest('[data-t]');if(b)topAction(b.dataset.t,b);});
}
function setTop(title,acts){
  ttlEl.textContent=title; ov.dataset.v=S.view;
  tactEl.innerHTML=(acts||[]).map(a=>'<button type="button" class="nts-ib'+(a[3]?' '+a[3]:'')+'" data-t="'+a[0]+'" aria-label="'+esc(a[1])+'" title="'+esc(a[1])+'">'+a[2]+'</button>').join('');
  hud();
}
function hud(){try{if(W.grHudTick)W.grHudTick();}catch(e){}}
function toast(m,act){
  if(!toastEl){if(W.grToast)W.grToast(m);return;}
  toastEl.innerHTML='<span>'+esc(m)+'</span>'+(act?'<button type="button" class="nts-tact">'+esc(act.label)+'</button>':'');
  toastEl.classList.toggle('nts-hasact',!!act); toastEl.classList.add('nts-on');
  if(act)q(toastEl,'.nts-tact').onclick=()=>{toastEl.classList.remove('nts-on');try{act.fn();}catch(e){console.error(e);}};
  clearTimeout(toastT); toastT=setTimeout(()=>toastEl&&toastEl.classList.remove('nts-on'),act?5200:3000);
}
/* bottom sheets (one level) */
let sheetOnClose=null;
function sheet(html,wire,onClose){
  if(sheetOnClose){const f=sheetOnClose;sheetOnClose=null;try{f();}catch(e){}}
  sheetEl.innerHTML=''; const box=D.createElement('div'); box.className='nts-sin';      // fresh node per sheet: no listeners pile up
  box.innerHTML='<div class="nts-grip"></div>'+html; sheetEl.appendChild(box); sheetEl.hidden=false; shadeEl.hidden=false; sheetOnClose=onClose||null;
  qa(box,'.nts-x').forEach(b=>b.addEventListener('click',()=>closeSheet()));
  if(wire)wire(box); sheetEl.scrollTop=0; hud();
}
function closeSheet(){
  if(!sheetEl||sheetEl.hidden)return;
  sheetEl.hidden=true; sheetEl.innerHTML=''; shadeEl.hidden=true;
  if(sheetOnClose){const f=sheetOnClose;sheetOnClose=null;try{f();}catch(e){}}
}
function sErr(m){const e=q(sheetEl,'.nts-err');if(e){e.textContent=m||'';e.hidden=!m;}}
function confirmSheet(title,text,okLabel,danger,fn){
  sheet('<h3>'+esc(title)+'</h3><p class="nts-note">'+text+'</p><div class="nts-row2"><button type="button" class="nts-go'+(danger?' nts-danger':'')+' nts-ok">'+esc(okLabel)+'</button><button type="button" class="nts-sec nts-x">Cancel</button></div>',
    r=>{q(r,'.nts-ok').onclick=()=>{closeSheet();fn();};});
}
/* phone Back: sheet → image viewer → sketch → editor → selection → search → folder → close */
function ntsBack(){
  if(!ov||ov.hidden||!ov.isConnected)return false;
  if(!sheetEl.hidden){closeSheet();return true;}
  if(!skEl.hidden){sketchBack();return true;}
  if(!viewerEl.hidden){closeViewer();return true;}
  if(S.view==='editor'){ if(E&&E.pal){showPal(false);return true;} toList(); return true; }
  if(S.view==='lock'){toList();return true;}
  if(S.sel){endSelect();return true;}
  if(S.q){clearSearch();return true;}
  if(S.filter!=='all'){S.filter='all';renderList(true);return true;}
  closeNotes(); return true;
}
function onKey(e){
  if(!ov||ov.hidden)return;
  if(e.key==='Escape'){e.preventDefault();e.stopPropagation();ntsBack();}
}
/* keep everything above the on-screen keyboard (Chrome Android resizes only the visual viewport) */
function vvFit(){
  const v=W.visualViewport; if(!v||!ov||ov.hidden)return;
  const kb=W.innerHeight-v.height-v.offsetTop;
  if(Math.abs(v.scale-1)<0.01&&(kb>40||v.offsetTop>1)){
    ov.style.top=Math.round(v.offsetTop)+'px'; ov.style.height=Math.round(v.height)+'px'; ov.style.bottom='auto'; ov.classList.add('nts-kb');
  } else if(ov.style.height){ ov.style.top=''; ov.style.height=''; ov.style.bottom=''; ov.classList.remove('nts-kb'); }
  if(E&&S.view==='editor')keepCaret();
}
let listening=false;
function listen(on){
  if(on===listening)return; listening=on;
  const f=on?'addEventListener':'removeEventListener';
  W[f]('keydown',onKey,true);
  if(W.visualViewport){W.visualViewport[f]('resize',vvFit);W.visualViewport[f]('scroll',vvFit);}
  D[f]('selectionchange',onSelChange);
}
function show(){
  build(); const was=ov.hidden; ov.hidden=false; D.body.classList.add('nts-open'); listen(true);
  if(was){try{ov.focus({preventScroll:true});}catch(e){}}
  vvFit(); hud();
}
function openNotes(){
  show(); S.sel=null;
  if(S.view!=='list'||!mainEl.firstChild){ leaveEditor(); S.view='list'; }
  mainEl.innerHTML='<div class="nts-loading">Opening notes…</div>'; setTop('Notes',[]);
  saveQ.catch(()=>{}).then(()=>load(true)).then(()=>purgeTrash()).then(()=>{ if(!ov.hidden&&S.view==='list')renderList(true); gcOrphans(); })
    .catch(err=>{ mainEl.innerHTML='<div class="nts-empty"><b>Notes can’t open</b><span>'+esc(storageErr(err))+'</span></div>'; });
  return true;
}
function storageErr(e){
  const m=String(e&&(e.name||e.message)||e);
  if(/QuotaExceeded/i.test(m))return 'The phone is out of storage space for this app. Free some space, or export and delete old notes.';
  if(/Security|InvalidState|UnknownError/i.test(m))return 'This browser is blocking storage for the app (private browsing or site data blocked). Notes need normal browsing.';
  return 'Storage error: '+(e&&e.message||m);
}
function closeNotes(){
  if(!ov)return;
  closeSheet(); closeViewer();
  const sk=SK?skSave():null;                                 // an open sketch is saved into its note first
  S.view=S.view==='editor'?'editor':'list'; S.sel=null; S.q=''; S.filter='all';
  ov.hidden=true; D.body.classList.remove('nts-open'); listen(false);
  ov.style.top=''; ov.style.height=''; ov.style.bottom=''; ov.classList.remove('nts-kb');
  clearTimeout(toastT); toastEl.classList.remove('nts-on');
  const fin=()=>{ leaveEditor(); S.view='list'; if(ov.hidden){ dropThumbs(); mainEl.innerHTML=''; } };
  if(sk)sk.then(fin); else fin();
}
function purgeTrash(){
  const now=Date.now(), old=[...ALL.values()].filter(n=>n.trashed&&now-n.trashed>TRASH_DAYS*DAY).map(n=>n.id);
  return old.length?deleteNotesHard(old):Promise.resolve();
}
/* blobs whose note no longer exists (e.g. the app was closed mid-insert) — once per session */
let gcDone=false;
function gcOrphans(){
  if(gcDone)return; gcDone=true;
  run(['blobs'],'readwrite',t=>{const s=t.objectStore('blobs'); const c=s.index('note').openKeyCursor();
    c.onsuccess=()=>{const k=c.result; if(!k)return; if(!ALL.has(k.key)&&!(E&&E.id===k.key))s.delete(k.primaryKey); k.continue();};}).catch(()=>{});
}

/* =====================================================================
   LIST SCREEN: search, folder chips, grid/list of cards, sort, empty states
   ===================================================================== */
const NOTICE='Notes are saved only on this phone — not uploaded or backed up anywhere. Clearing Chrome’s data or uninstalling the app deletes them, so export a backup now and then. This is not your official notebook: keep personal details of members of the public to the minimum.';
const SORTS=[['edited','Date edited'],['created','Date created'],['title','Title']];
const fold=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
function foldMap(s){let f='',m=[];for(let i=0;i<s.length;i++){const c=s[i].normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();for(let k=0;k<c.length;k++){f+=c[k];m.push(i);}}return {f,m};}
const terms=()=>fold(S.q).split(/\s+/).filter(Boolean).slice(0,8);
function hiText(s,ts){
  s=String(s||''); if(!ts.length)return esc(s);
  const {f,m}=foldMap(s), rs=[];
  ts.forEach(t=>{let i=0;while((i=f.indexOf(t,i))>=0){rs.push([m[i],m[i+t.length-1]+1]);i+=t.length;}});
  if(!rs.length)return esc(s);
  rs.sort((a,b)=>a[0]-b[0]); const mg=[]; rs.forEach(r=>{const l=mg[mg.length-1]; if(l&&r[0]<=l[1])l[1]=Math.max(l[1],r[1]); else mg.push(r.slice());});
  let o='',p=0; mg.forEach(([a,b])=>{o+=esc(s.slice(p,a))+'<mark class="nts-hit">'+esc(s.slice(a,b))+'</mark>';p=b;}); return o+esc(s.slice(p));
}
const FOLDC=new WeakMap();
function hay(n){let h=FOLDC.get(n); if(h==null){h=fold((n.title||'')+'\n'+(n.locked?'':(n.text||''))); FOLDC.set(n,h);} return h;}
function cardInfo(n){
  if(n.locked)return {title:n.title||'Locked note',prev:'',img:null,locked:true};
  const text=n.text||''; let title=(n.title||'').trim(), body=text;
  if(!title){const L=text.split('\n'); const i=L.findIndex(l=>l.trim()&&l.trim()!=='[Image]');
    if(i>=0){const [t,rest]=splitLine(L[i].trim().replace(/^[☐☑•]\s*/,'')); title=t; body=(rest?rest+'\n':'')+L.slice(i+1).join('\n');}}
  const img=firstBlob(n.html);
  return {title:title||(img?'Image':'Untitled'),prev:body.replace(/\[Image\]\n?/g,'').replace(/\n{2,}/g,'\n').trim(),img,locked:false};
}
/* an untitled note's first line becomes its card title — cut long lines at a natural break so no text repeats */
function splitLine(s){
  if(s.length<=60)return [s,''];
  let best=-1,len=0;
  for(const sep of ['. ',' — ',' – ',' - ','? ','! ']){const i=s.indexOf(sep,12); if(i>=0&&i<=64&&(best<0||i<best)){best=i;len=sep.length;}}
  if(best<0)for(const sep of [': ','; ',', ']){const i=s.lastIndexOf(sep,64); if(i>=20){best=i;len=sep.length;break;}}
  if(best>=0)return [s.slice(0,best+(len===2&&/[.?!]/.test(s[best])?1:0)).trim(),s.slice(best+len).trim()];
  const cut=s.lastIndexOf(' ',56); const at=cut>24?cut:56; return [s.slice(0,at).trim()+'…','…'+s.slice(at).trim()];
}
function snip(p,ts){
  if(!ts.length||p.length<120)return p;
  const f=fold(p); let at=-1; ts.forEach(t=>{const i=f.indexOf(t); if(i>=0&&(at<0||i<at))at=i;});
  if(at<90)return p;
  const nl=p.lastIndexOf('\n',at); const st=nl>=0&&at-nl<60?nl+1:Math.max(0,at-40);
  return '…'+p.slice(st);
}
const daysLeft=(n,now)=>{const d=Math.ceil((n.trashed+TRASH_DAYS*DAY-now)/DAY); return d<=1?'Deleted in 1 day':'Deleted in '+d+' days';};
function folderName(id){const f=FOLDERS.find(x=>x.id===id);return f?f.name:'';}
function filterTitle(){ const f=S.filter; return f==='all'?'Notes':f==='fav'?'Favourites':f==='trash'?'Recently deleted':(folderName(f)||'Notes'); }
function visible(){
  const f=S.filter, ts=terms(); let a=[];
  ALL.forEach(n=>{
    if(f==='trash'){if(!n.trashed)return;} else { if(n.trashed)return; if(f==='fav'&&!n.pinned)return; if(f!=='all'&&f!=='fav'&&n.folder!==f)return; }
    if(ts.length){const h=hay(n); for(const t of ts)if(h.indexOf(t)<0)return;}
    a.push(n);
  });
  if(f==='trash')return a.sort((x,y)=>y.trashed-x.trashed);
  const ti=new Map(); const tk=n=>{let v=ti.get(n); if(v==null){v=cardInfo(n).title; ti.set(n,v);} return v;};
  if(S.mode!=='grid'&&S.mode!=='list')S.mode='grid';
  const cmp=S.sort==='created'?(x,y)=>y.created-x.created:S.sort==='title'?(x,y)=>tk(x).localeCompare(tk(y),'en-IE',{sensitivity:'base',numeric:true})||y.updated-x.updated:(x,y)=>y.updated-x.updated;
  return a.sort((x,y)=>(y.pinned?1:0)-(x.pinned?1:0)||cmp(x,y));
}
function counts(){
  const c={all:0,fav:0,trash:0}; FOLDERS.forEach(f=>c[f.id]=0);
  ALL.forEach(n=>{ if(n.trashed){c.trash++;return;} c.all++; if(n.pinned)c.fav++; if(n.folder&&c[n.folder]!=null)c[n.folder]++; });
  return c;
}
function chipsHtml(){
  const c=counts(), ch=(id,label,n,extra)=>'<button type="button" class="nts-chip'+(S.filter===id?' nts-on':'')+(extra||'')+'" data-f="'+esc(id)+'" role="tab" aria-selected="'+(S.filter===id)+'">'+label+(n!=null?'<em>'+n+'</em>':'')+'</button>';
  return ch('all','All notes',c.all)+ch('fav','★ Favourites',c.fav)
    +FOLDERS.map(f=>ch(f.id,svg(IC.folder)+'<span>'+esc(f.name)+'</span>'+(S.filter===f.id?'<i>▾</i>':''),c[f.id],' nts-uf')).join('')
    +'<button type="button" class="nts-chip nts-addf" data-f="+">＋ Folder</button>'
    +ch('trash',svg(IC.trash)+'<span>Recently deleted</span>',c.trash||null,' nts-trc');
}
function renderList(full){
  if(!ov||ov.hidden)return;
  S.view='list'; S.listStale=false;
  let L=q(mainEl,'.nts-list');
  if(full||!L){
    dropThumbs();
    mainEl.innerHTML='<div class="nts-list"><div class="nts-lscroll">'
      +'<label class="nts-search">'+svg(IC.search)+'<input type="search" placeholder="Search notes" enterkeyhint="search" autocomplete="off" spellcheck="false" aria-label="Search notes"><button type="button" class="nts-sx" aria-label="Clear search" hidden>'+svg(IC.x)+'</button></label>'
      +'<div class="nts-chips" role="tablist" aria-label="Folders"></div><div class="nts-meta"></div><div class="nts-noticebox"></div><div class="nts-cards"></div></div>'
      +'<button type="button" class="nts-fab" aria-label="New note">'+svg(IC.plus)+'</button><div class="nts-selbar" hidden></div></div>';
    L=q(mainEl,'.nts-list'); wireList(L);
    q(L,'.nts-search input').value=S.q; q(L,'.nts-sx').hidden=!S.q;
  }
  L.classList.toggle('nts-selmode',!!S.sel); L.classList.toggle('nts-trashv',S.filter==='trash');
  q(L,'.nts-chips').innerHTML=chipsHtml();
  const on=q(L,'.nts-chip.nts-on'); if(on&&full)on.scrollIntoView({block:'nearest',inline:'center'});
  const nb=q(L,'.nts-noticebox'); nb.innerHTML=(!LSget('notice',0)&&S.filter!=='trash'&&!S.sel)?noticeHtml(true):'';
  renderCards(); topForList();
}
function topForList(){
  if(S.sel)setTop(plural(S.sel.size,'note')+' selected',[['all','Select all','<span class="nts-tx">All</span>']]);
  else setTop(filterTitle(),[['settings','Notes settings',svg(IC.settings)]]);
}
function noticeHtml(card){
  return '<div class="nts-notice'+(card?'':' nts-flat')+'"><b>'+svg(IC.info)+' Saved on this phone only</b><p>'+esc(NOTICE)+'</p>'
    +(card?'<div class="nts-row2"><button type="button" class="nts-sec" data-a="export">'+svg(IC.download)+' Export backup</button><button type="button" class="nts-go" data-a="gotit">Got it</button></div>':'')+'</div>';
}
function renderCards(){
  const L=q(mainEl,'.nts-list'); if(!L)return;
  const box=q(L,'.nts-cards'), arr=visible(), ts=terms(), now=Date.now(), trash=S.filter==='trash';
  const nAll=q(L,'.nts-meta');
  nAll.innerHTML='<span class="nts-count">'+plural(arr.length,'note')+(S.q?' found':'')+'</span>'
    +(trash?(arr.length&&!S.sel?'<button type="button" class="nts-mbtn nts-dang" data-a="empty">'+svg(IC.trash)+'Empty</button>':'')
      :'<button type="button" class="nts-mbtn" data-a="sort" aria-label="Sort">'+svg(IC.sort)+esc((SORTS.find(s=>s[0]===S.sort)||SORTS[0])[1])+'</button>'
      +'<button type="button" class="nts-mbtn nts-vbtn" data-a="view" aria-label="'+(S.mode==='grid'?'List view':'Grid view')+'">'+svg(S.mode==='grid'?IC.rows:IC.grid)+'</button>');
  box.className='nts-cards nts-'+(S.mode==='list'?'rows':'grid');
  if(thumbIO)thumbIO.disconnect();                          // re-observed below; stale cards are not kept alive
  if(!arr.length){box.innerHTML=emptyHtml(); selBar(); return;}
  const pin=!trash&&S.filter!=='fav'&&arr.some(n=>n.pinned)&&arr.some(n=>!n.pinned);
  let h='';
  if(pin)h+='<h3 class="nts-sec">★ Pinned</h3>';
  arr.forEach((n,i)=>{ if(pin&&i>0&&arr[i-1].pinned&&!n.pinned)h+='<h3 class="nts-sec">Other notes</h3>'; h+=cardHtml(n,ts,now,trash); });
  box.innerHTML=h; watchThumbs(box); selBar();
}
function cardHtml(n,ts,now,trash){
  const ci=cardInfo(n), fn=S.mode==='list'&&S.filter==='all'&&n.folder?folderName(n.folder):'';
  return '<div class="nts-card'+(S.sel&&S.sel.has(n.id)?' nts-picked':'')+(ci.locked?' nts-lk':'')+(ci.img?' nts-hasimg':'')+'" role="button" tabindex="0" data-id="'+esc(n.id)+'"'+(n.color?' data-tint="'+esc(n.color)+'"':'')+'>'
    +(ci.img?'<div class="nts-thumb" data-b="'+ci.img+'"></div>':'')
    +'<div class="nts-cbd"><b class="nts-ct">'+hiText(ci.title,ts)+'</b>'
    +(ci.locked?'<div class="nts-clk">'+svg(IC.lock)+'<span>Locked</span></div>':(ci.prev?'<p class="nts-cp">'+hiText(snip(ci.prev,ts),ts)+'</p>':''))
    +'</div><div class="nts-cf"><span>'+esc(trash?daysLeft(n,now):shortWhen(n.updated))+(fn?' · '+esc(fn):'')+'</span>'
    +(n.pinned&&!trash?'<i class="nts-pin" title="Pinned">★</i>':'')+(n.locked?'<i title="Locked">🔒</i>':'')+'</div>'
    +'<span class="nts-tick" aria-hidden="true">'+svg(IC.tick)+'</span></div>';
}
function emptyHtml(){
  const f=S.filter, e=(t,s)=>'<div class="nts-empty">'+svg(f==='trash'?IC.trash:IC.note)+'<b>'+t+'</b><span>'+s+'</span></div>';
  if(S.q)return e('No notes match “'+esc(S.q)+'”','Search looks in titles and note text. Locked notes are searched by title only when their titles are shown.');
  if(f==='trash')return e('Nothing in Recently deleted','Deleted notes stay here for '+TRASH_DAYS+' days so you can restore them, then they are removed for good.');
  if(f==='fav')return e('No favourites yet','Pin a note to keep it at the top and here: open it and tap ★, or long-press a card and choose Pin.');
  if(f!=='all')return e('This folder is empty','Tap ＋ to write a note in this folder, or long-press notes elsewhere and choose Move. Tap the folder name again to rename or delete it.');
  return e('No notes yet','Tap the gold ＋ to write your first note. Add checklists, photos and sketches from the toolbar. Long-press a note to pin, move, colour or delete it.');
}
/* thumbnails: loaded lazily from the small copy stored with each image */
const THUMBS=new Map(), THUMBK=new Map(); let thumbIO=null;
function thumbURL(bid){
  if(!THUMBS.has(bid))THUMBS.set(bid,dbGet('blobs',bid).then(r=>{if(!r||r.enc)return null;const b=r.thumb||r.data;if(!b)return null;const u=URL.createObjectURL(b);THUMBK.set(u,r.kind);return u;}).catch(()=>null));
  return THUMBS.get(bid);
}
function dropThumb(bid){const p=THUMBS.get(bid);if(p){THUMBS.delete(bid);p.then(u=>{if(u){URL.revokeObjectURL(u);THUMBK.delete(u);}});}}
function dropThumbs(){ if(thumbIO){thumbIO.disconnect();thumbIO=null;} THUMBS.forEach(p=>p.then(u=>{if(u)URL.revokeObjectURL(u);})); THUMBS.clear(); THUMBK.clear(); }
function watchThumbs(box){
  const ts=qa(box,'.nts-thumb'); if(!ts.length)return;
  const fill=t=>{ if(t._f)return; t._f=1; thumbURL(t.dataset.b).then(u=>{ if(u&&t.isConnected){t.innerHTML='<img alt="" src="'+u+'">'; if(THUMBK.get(u)==='sketch')t.classList.add('nts-skthumb');} else if(!u)t.classList.add('nts-nothumb'); }); };
  if(!('IntersectionObserver' in W)){ts.forEach(fill);return;}
  if(!thumbIO)thumbIO=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){thumbIO.unobserve(e.target);fill(e.target);}}),{root:q(mainEl,'.nts-lscroll'),rootMargin:'400px 0px'});
  ts.forEach(t=>thumbIO.observe(t));
}
function clearSearch(){ S.q=''; const L=q(mainEl,'.nts-list'); if(L){const i=q(L,'.nts-search input'); i.value=''; i.blur(); q(L,'.nts-sx').hidden=true;} renderCards(); }
function wireList(L){
  const sc=q(L,'.nts-lscroll'), inp=q(L,'.nts-search input'); let st=0;
  inp.addEventListener('input',()=>{ clearTimeout(st); q(L,'.nts-sx').hidden=!inp.value; st=setTimeout(()=>{S.q=inp.value.trim(); renderCards(); sc.scrollTop=0;},110); });
  inp.addEventListener('focus',()=>{ if(S.sel)endSelect(); });
  inp.addEventListener('keydown',e=>{ if(e.key==='Enter')inp.blur(); });
  q(L,'.nts-sx').addEventListener('click',e=>{e.preventDefault();clearSearch();inp.focus();});
  q(L,'.nts-fab').addEventListener('click',()=>openNote());
  // chips
  const chips=q(L,'.nts-chips'); let lpT=0, lpF=false;
  chips.addEventListener('pointerdown',e=>{const b=e.target.closest('.nts-uf'); lpF=false; if(!b)return; clearTimeout(lpT); lpT=setTimeout(()=>{lpF=true;vib(20);folderSheet(b.dataset.f);},520);});
  ['pointerup','pointercancel','pointerleave'].forEach(t=>chips.addEventListener(t,()=>clearTimeout(lpT)));
  chips.addEventListener('scroll',()=>clearTimeout(lpT),{passive:true});
  chips.addEventListener('contextmenu',e=>e.preventDefault());
  chips.addEventListener('click',e=>{
    const b=e.target.closest('.nts-chip'); if(!b)return; if(lpF){lpF=false;return;}
    const f=b.dataset.f;
    if(f==='+'){newFolderSheet(id=>{S.filter=id;S.sel=null;renderList(false);});return;}
    if(S.sel)S.sel=null;
    if(S.filter===f&&FOLDERS.some(x=>x.id===f)){folderSheet(f);return;}
    S.filter=f; renderList(false); sc.scrollTop=0; b.scrollIntoView({block:'nearest',inline:'nearest'});
  });
  // meta row + notice
  L.addEventListener('click',e=>{
    const a=e.target.closest('[data-a]'); if(!a||!L.contains(a))return; const k=a.dataset.a;
    if(k==='sort')sortSheet(); else if(k==='view'){S.mode=S.mode==='grid'?'list':'grid';LSset('view',S.mode);renderCards();}
    else if(k==='empty')emptyTrash(); else if(k==='gotit'){LSset('notice',1);q(L,'.nts-noticebox').innerHTML='';toast('You can read this again in Notes settings, top right');}
    else if(k==='export')exportAll();
  });
  wireCards(q(L,'.nts-cards'),sc);
  q(L,'.nts-selbar').addEventListener('click',e=>{const b=e.target.closest('[data-s]');if(b)selAction(b.dataset.s);});
}
/* cards: tap = open (or toggle in selection mode); long-press = selection mode */
function wireCards(box,sc){
  let t=0,sx=0,sy=0,fired=false,pid=null;
  box.addEventListener('pointerdown',e=>{
    const c=e.target.closest('.nts-card'); fired=false; if(!c||(e.pointerType==='mouse'&&e.button!==0))return;
    sx=e.clientX; sy=e.clientY; pid=c.dataset.id; clearTimeout(t);
    t=setTimeout(()=>{fired=true;vib(25); if(!S.sel)startSelect(pid); else toggleSel(pid);},480);
  });
  box.addEventListener('pointermove',e=>{if(Math.abs(e.clientX-sx)>10||Math.abs(e.clientY-sy)>10)clearTimeout(t);},{passive:true});
  ['pointerup','pointercancel'].forEach(k=>box.addEventListener(k,()=>clearTimeout(t)));
  sc.addEventListener('scroll',()=>clearTimeout(t),{passive:true});
  box.addEventListener('contextmenu',e=>{if(e.target.closest('.nts-card'))e.preventDefault();});
  box.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target.classList.contains('nts-card')){e.preventDefault();e.target.click();}});
  sc.addEventListener('click',e=>{
    const c=e.target.closest('.nts-card');
    if(fired){fired=false;e.preventDefault();return;}
    if(!c){ if(S.sel&&!e.target.closest('.nts-chips,.nts-meta,.nts-search'))endSelect(); return; }
    const id=c.dataset.id;
    if(S.sel){toggleSel(id);return;}
    if(S.filter==='trash')trashSheet(id); else openNote(id);
  });
}
function sortSheet(){
  sheet('<h3>Sort notes</h3><div class="nts-opts">'+SORTS.map(s=>'<button type="button" class="nts-opt'+(S.sort===s[0]?' nts-on':'')+'" data-k="'+s[0]+'"><span>'+esc(s[1])+'</span>'+(S.sort===s[0]?svg(IC.tick):'')+'</button>').join('')+'</div>'
    +'<p class="nts-note">Pinned notes always come first.</p>',r=>{
    qa(r,'.nts-opt').forEach(b=>b.onclick=()=>{S.sort=b.dataset.k;LSset('sort',S.sort);closeSheet();renderCards();});});
}

/* =====================================================================
   SELECTION MODE, FOLDERS, COLOURS, RECENTLY DELETED
   ===================================================================== */
function topAction(t,b){
  if(t==='settings')return settingsSheet();
  if(t==='all'){ const ids=visible().map(n=>n.id); if(S.sel&&S.sel.size===ids.length)S.sel=new Set(); else S.sel=new Set(ids); if(!S.sel.size)return endSelect(); renderCards(); topForList(); return; }
  edTop(t,b);
}
function startSelect(id){ S.sel=new Set(id?[id]:[]); const a=D.activeElement; if(a&&a.blur&&mainEl.contains(a))a.blur(); renderList(false); }
function endSelect(){ S.sel=null; if(S.view==='list')renderList(false); }
function toggleSel(id){
  if(!S.sel)return; if(S.sel.has(id))S.sel.delete(id); else S.sel.add(id);
  if(!S.sel.size)return endSelect();
  const c=q(mainEl,'.nts-card[data-id="'+id+'"]'); if(c)c.classList.toggle('nts-picked',S.sel.has(id));
  topForList(); selBar();
}
function selBar(){
  const bar=q(mainEl,'.nts-selbar'); if(!bar)return;
  if(!S.sel){bar.hidden=true;bar.innerHTML='';return;}
  const recs=[...S.sel].map(id=>ALL.get(id)).filter(Boolean), dis=recs.length?'':' disabled';
  const b=(k,ic,l,cls)=>'<button type="button" class="nts-sbb'+(cls?' '+cls:'')+'" data-s="'+k+'"'+dis+'>'+svg(ic)+'<span>'+l+'</span></button>';
  bar.innerHTML=S.filter==='trash'?b('restore',IC.restore,'Restore')+b('purge',IC.trash,'Delete forever','nts-dang')
    :b('pin',IC.star,recs.length&&recs.every(n=>n.pinned)?'Unpin':'Pin')+b('move',IC.folder,'Move')+b('colour',IC.palette,'Colour')+b('delete',IC.trash,'Delete','nts-dang');
  bar.hidden=false;
}
function selAction(k){
  const ids=[...(S.sel||[])].filter(id=>ALL.has(id)); if(!ids.length)return;
  const recs=ids.map(id=>ALL.get(id));
  if(k==='pin'){const to=!recs.every(n=>n.pinned); saveMeta(recs,{pinned:to}).then(()=>{toast(plural(ids.length,'note')+(to?' pinned':' unpinned'));endSelect();});}
  else if(k==='move')folderPicker(recs.length===1?recs[0].folder:undefined,fid=>saveMeta(recs,{folder:fid}).then(()=>{toast(plural(ids.length,'note')+' moved to '+(fid?folderName(fid):'All notes'));endSelect();}));
  else if(k==='colour')colourPicker(recs.length===1?recs[0].color:undefined,c=>saveMeta(recs,{color:c}).then(()=>endSelect()));
  else if(k==='delete')trashNotes(ids,()=>endSelect());
  else if(k==='restore')restoreNotes(ids).then(()=>{toast(plural(ids.length,'note')+' restored');endSelect();});
  else if(k==='purge')confirmSheet('Delete forever?','Permanently delete '+plural(ids.length,'note')+'? This can’t be undone.','Delete forever',true,()=>deleteNotesHard(ids).then(()=>{toast(plural(ids.length,'note')+' deleted');endSelect();}));
}
/* metadata changes don't count as edits (they don't move a note in "Date edited") */
function saveMeta(recs,patch){
  const out=recs.map(r=>Object.assign({},r,patch)); if(E&&out.some(r=>r.id===E.id))Object.assign(E.rec,patch);
  return putNotes(out).catch(e=>toast(storageErr(e)));
}
function trashNotes(ids,after){
  const now=Date.now(), recs=ids.map(id=>ALL.get(id)).filter(Boolean);
  return saveMeta(recs,{trashed:now}).then(()=>{
    if(after)after();
    toast(recs.length===1?'Moved to Recently deleted':plural(recs.length,'note')+' moved to Recently deleted',{label:'Undo',fn:()=>restoreNotes(ids).then(()=>{ if(S.view==='list')renderList(false); })});
  });
}
function restoreNotes(ids){ return saveMeta(ids.map(id=>ALL.get(id)).filter(Boolean),{trashed:null}); }
function trashSheet(id){
  const n=ALL.get(id); if(!n)return; const ci=cardInfo(n);
  sheet('<h3>'+esc(ci.title)+'</h3><p class="nts-note">Deleted '+esc(full(n.trashed))+'. '+esc(daysLeft(n,Date.now()))+'.</p>'
    +(ci.prev?'<div class="nts-tprev">'+esc(ci.prev.slice(0,400))+'</div>':'')
    +'<div class="nts-row2"><button type="button" class="nts-go nts-r">'+svg(IC.restore)+' Restore</button><button type="button" class="nts-sec nts-dang nts-p">'+svg(IC.trash)+' Delete forever</button></div>'
    +'<button type="button" class="nts-sec nts-x nts-wide">Cancel</button>',r=>{
    q(r,'.nts-r').onclick=()=>{closeSheet();restoreNotes([id]).then(()=>{renderList(false);toast('Restored to '+(n.folder&&folderName(n.folder)?folderName(n.folder):'All notes'));});};
    q(r,'.nts-p').onclick=()=>{closeSheet();confirmSheet('Delete forever?','“'+esc(ci.title)+'” will be deleted permanently. This can’t be undone.','Delete forever',true,()=>deleteNotesHard([id]).then(()=>{renderList(false);toast('Deleted permanently');}));};
  });
}
function emptyTrash(){
  const ids=[...ALL.values()].filter(n=>n.trashed).map(n=>n.id); if(!ids.length)return;
  confirmSheet('Empty Recently deleted?','Permanently delete all '+plural(ids.length,'note')+' in Recently deleted? This can’t be undone.','Delete all',true,()=>deleteNotesHard(ids).then(()=>{renderList(false);toast('Recently deleted emptied');}));
}
/* ---------- folders ---------- */
function validFolderName(v,except){
  v=String(v||'').replace(/\s+/g,' ').trim();
  if(!v)return [null,'Enter a folder name.'];
  if(v.length>40)return [null,'Keep the name under 40 characters.'];
  if(/^(all notes|favourites|recently deleted)$/i.test(v)||FOLDERS.some(f=>f.id!==except&&f.name.toLowerCase()===v.toLowerCase()))return [null,'There is already a folder called “'+v+'”.'];
  return [v,null];
}
function newFolderSheet(done){
  sheet('<h3>New folder</h3><input class="nts-in nts-fn" maxlength="40" placeholder="e.g. Court dates" autocomplete="off" enterkeyhint="done"><p class="nts-err" hidden></p>'
    +'<div class="nts-row2"><button type="button" class="nts-go nts-ok">Create</button><button type="button" class="nts-sec nts-x">Cancel</button></div>',r=>{
    const i=q(r,'.nts-fn'), go=()=>{const [v,err]=validFolderName(i.value); if(err)return sErr(err);
      const f={id:uid('f'),name:v,created:Date.now()}; FOLDERS.push(f);
      saveFolders().then(()=>{closeSheet();toast('Folder “'+v+'” created');done&&done(f.id);}).catch(e=>sErr(storageErr(e)));};
    q(r,'.nts-ok').onclick=go; i.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();go();}}); setTimeout(()=>i.focus(),60);
  });
}
function folderSheet(fid){
  const f=FOLDERS.find(x=>x.id===fid); if(!f)return; const n=counts()[fid]||0;
  sheet('<h3>'+svg(IC.folder)+' '+esc(f.name)+'</h3><p class="nts-note">'+plural(n,'note')+' in this folder.</p>'
    +'<label class="nts-lab">Rename</label><input class="nts-in nts-fn" maxlength="40" autocomplete="off" enterkeyhint="done" value="'+esc(f.name)+'"><p class="nts-err" hidden></p>'
    +'<div class="nts-row2"><button type="button" class="nts-go nts-ok">Save name</button><button type="button" class="nts-sec nts-x">Cancel</button></div>'
    +'<button type="button" class="nts-link nts-dang nts-del">Delete this folder…</button>',r=>{
    const i=q(r,'.nts-fn'), go=()=>{const [v,err]=validFolderName(i.value,fid); if(err)return sErr(err); f.name=v; saveFolders().then(()=>{closeSheet();renderList(false);toast('Folder renamed');});};
    q(r,'.nts-ok').onclick=go; i.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();go();}});
    q(r,'.nts-del').onclick=()=>confirmSheet('Delete folder “'+f.name+'”?','Its '+plural(n,'note')+' move to All notes — no notes are deleted.','Delete folder',true,()=>{
      FOLDERS=FOLDERS.filter(x=>x.id!==fid); const moved=[...ALL.values()].filter(x=>x.folder===fid).map(x=>Object.assign({},x,{folder:null}));
      Promise.all([saveFolders(),moved.length?putNotes(moved):null]).then(()=>{ if(E&&E.rec.folder===fid)E.rec.folder=null; if(S.filter===fid)S.filter='all'; renderList(false); toast('Folder deleted — its notes are in All notes'); });
    });
  });
}
function folderPicker(cur,done){
  const row=(id,label,on)=>'<button type="button" class="nts-opt'+(on?' nts-on':'')+'" data-f="'+esc(id)+'">'+svg(id?IC.folder:IC.note)+'<span>'+label+'</span>'+(on?svg(IC.tick):'')+'</button>';
  sheet('<h3>Move to folder</h3><div class="nts-opts">'+row('','All notes <small>(no folder)</small>',cur===null||cur==='')
    +FOLDERS.map(f=>row(f.id,esc(f.name),cur===f.id)).join('')+'<button type="button" class="nts-opt nts-newf">'+svg(IC.plus)+'<span>New folder…</span></button></div>',r=>{
    qa(r,'.nts-opt[data-f]').forEach(b=>b.onclick=()=>{closeSheet();done(b.dataset.f||null);});
    q(r,'.nts-newf').onclick=()=>newFolderSheet(id=>done(id));
  });
}
function colourPicker(cur,done){
  sheet('<h3>Note colour</h3><div class="nts-swatches">'+TINTS.map(t=>'<button type="button" class="nts-sw'+(cur===t[0]?' nts-on':'')+'" data-c="'+t[0]+'" data-tint="'+t[0]+'" aria-label="'+t[1]+'"><i></i><span>'+t[1]+'</span></button>').join('')+'</div>',r=>{
    qa(r,'.nts-sw').forEach(b=>b.onclick=()=>{closeSheet();done(b.dataset.c);});});
}

/* =====================================================================
   EDITOR: title + rich text body, toolbar, checklist, undo/redo, autosave
   ===================================================================== */
let E=null, saveQ=Promise.resolve();
const TB1=[['bold','<b>B</b>','Bold'],['italic','<i>I</i>','Italic'],['underline','<u>U</u>','Underline'],['strikeThrough','<s>S</s>','Strikethrough'],
  ['heading','<b class="nts-h">H</b>','Heading (tap again for a smaller heading)'],['hl',svg(IC.hl),'Highlight'],['color',svg(IC.tcolor)+'<i class="nts-cbar"></i>','Text colour'],['time',svg(IC.clock),'Insert date and time']];
const TB2=[['undo',svg(IC.undo),'Undo'],['redo',svg(IC.redo),'Redo'],['ul',svg(IC.ul),'Bulleted list'],['ol',svg(IC.ol),'Numbered list'],
  ['check',svg(IC.check),'Checklist'],['image',svg(IC.image),'Image'],['sketch',svg(IC.pen),'Sketch'],['kbd',svg(IC.kbd),'Hide keyboard']];
const tbBtns=a=>a.map(b=>'<button type="button" class="nts-tbb" data-c="'+b[0]+'" aria-label="'+esc(b[2])+'" title="'+esc(b[2])+'">'+b[1]+'</button>').join('');
function newRec(){
  const now=Date.now(), f=S.filter;
  return {id:uid('n'),title:'',html:'',text:'',folder:FOLDERS.some(x=>x.id===f)?f:null,color:'',pinned:f==='fav',created:now,updated:now,trashed:null,locked:false,enc:null};
}
function openNote(id){
  if(SK)return skSave().then(()=>openNote(id));
  show(); S.sel=null; closeSheet(); closeViewer();
  if(id==null){ leaveEditor(); startEditor(newRec(),'','',true); return true; }
  return load().then(()=>{
    const n=ALL.get(id);
    if(!n){ toast('That note no longer exists'); if(S.view!=='list'||!q(mainEl,'.nts-list'))toList(); return false; }
    if(E&&E.id===id){ S.view='editor'; return true; }
    leaveEditor();
    if(n.trashed){ S.filter='trash'; renderList(true); trashSheet(id); return true; }
    if(n.locked){
      if(!keyOK()){ lockView(n); return true; }
      return decryptNote(n).then(d=>{startEditor(n,d.title,d.html,false);return true;}).catch(()=>{lockView(n);return true;});
    }
    startEditor(n,n.title,n.html,false); return true;
  }).catch(e=>{toast(storageErr(e));return false;});
}
function startEditor(rec,title,html,isNew){
  S.view='editor'; dropThumbs();
  const clean=sanitize(html||'');
  E={id:rec.id,rec:Object.assign({},rec),isNew:!!isNew,locked:!!rec.locked,dirty:false,saveT:0,urls:new Map(),pal:false,range:null,
     H:{st:[],i:-1,t:0,pend:false},savedTitle:title||'',savedHtml:clean,failed:false};
  mainEl.innerHTML='<div class="nts-ed"'+(rec.color?' data-tint="'+esc(rec.color)+'"':'')+'><div class="nts-escroll"><div class="nts-page">'
    +'<textarea class="nts-etitle" rows="1" placeholder="Title" maxlength="160" enterkeyhint="next" autocomplete="off" autocapitalize="sentences" spellcheck="true" aria-label="Title"></textarea>'
    +'<div class="nts-einfo"></div>'
    +'<div class="nts-body" contenteditable="true" role="textbox" aria-multiline="true" aria-label="Note text" spellcheck="true" autocapitalize="sentences" data-ph="Start writing…"></div>'
    +'</div></div><div class="nts-tb" role="toolbar" aria-label="Formatting">'
    +'<div class="nts-tbr nts-tbr1">'+tbBtns(TB1)+'</div>'
    +'<div class="nts-tbr nts-pal" hidden><button type="button" class="nts-tbb" data-p="x" aria-label="Close colours">'+svg(IC.back)+'</button>'
    +'<button type="button" class="nts-tbb nts-pdef" data-p="" aria-label="Default colour"><i></i></button>'
    +TX_COL.map(c=>'<button type="button" class="nts-tbb" data-p="'+c[1]+'" aria-label="'+c[0]+'"><i style="background:'+c[1]+'"></i></button>').join('')+'</div>'
    +'<div class="nts-tbr nts-tbr2">'+tbBtns(TB2)+'</div></div></div>';
  const ed=q(mainEl,'.nts-ed'); E.ed=ed; E.body=q(ed,'.nts-body'); E.tin=q(ed,'.nts-etitle'); E.info=q(ed,'.nts-einfo'); E.sc=q(ed,'.nts-escroll'); E.tb=q(ed,'.nts-tb');
  E.body.innerHTML=clean||'<div><br></div>'; E.tin.value=title||''; fitTitle();
  hydrate(E.body); updEmpty(); infoLine(); hPush(); wireEditor(E); topForEditor();
  try{D.execCommand('defaultParagraphSeparator',false,'div');D.execCommand('styleWithCSS',false,false);}catch(e){}
  if(isNew){ const b=E.body; b.focus({preventScroll:true}); caretIn(b.firstChild||b,0); }
  E.sc.scrollTop=0;
}
function topForEditor(){
  if(!E)return; const fn=E.rec.folder?folderName(E.rec.folder):'';
  setTop(fn||'Note',[['pin',E.rec.pinned?'Unpin':'Pin to top','<span class="nts-star'+(E.rec.pinned?' nts-on':'')+'">'+svg(IC.star)+'</span>'],['menu','More options',svg(IC.dots)]]);
}
function infoLine(){
  if(!E)return; const w=wordCount(htmlText(E.savedHtml)), r=E.rec;
  E.info.innerHTML=(E.isNew?'New note':'Edited '+esc(full(r.updated)))+' · '+plural(w,'word')+(E.locked?' · <span class="nts-lkd">🔒 Locked</span>':'');
}
function toList(){ const p=leaveEditor(); S.view='list'; renderList(true); return p; }
function edTop(t){
  if(!E)return;
  if(t==='pin'){ edMeta({pinned:!E.rec.pinned}); topForEditor(); toast(E.rec.pinned?'Pinned to the top':'Unpinned'); }
  else if(t==='menu')editorMenu();
}
function edMeta(patch){
  Object.assign(E.rec,patch);
  if(!E.isNew&&ALL.has(E.id))return saveMeta([ALL.get(E.id)],patch);
  return Promise.resolve();
}
/* ---------- autosave ---------- */
function markDirty(){ if(!E)return; if(E.locked)touchKey(); E.dirty=true; clearTimeout(E.saveT); E.saveT=setTimeout(()=>flush(),600); }
function flush(){
  if(!E)return saveQ; clearTimeout(E.saveT); if(!E.dirty)return saveQ;
  E.dirty=false; const e=E, snap=collect(e); if(!snap)return saveQ;
  saveQ=saveQ.then(()=>writeNote(snap,e)).then(rec=>{ e.failed=false; if(E===e&&rec){ E.rec=Object.assign({},rec); infoLine(); } })
    .catch(err=>{ console.error(err); e.failed=true; if(E===e){E.dirty=true;} toast('Not saved — '+storageErr(err)); });
  return saveQ;
}
function collect(e){
  const title=e.tin.value.replace(/\s+/g,' ').trim(), html=sanitize(e.body.innerHTML);
  const changed=title!==e.savedTitle||html!==e.savedHtml||!!e.bump; e.bump=false;
  if(!changed&&!e.isNew)return null;
  const text=htmlText(html);
  if(e.isNew&&!title&&!text&&html.indexOf('data-blob=')<0)return null;
  e.savedTitle=title; e.savedHtml=html; e.isNew=false;
  return {id:e.id,title,html,text,updated:Date.now()};
}
async function writeNote(s,e){
  const base=(E&&E.id===s.id)?E.rec:(ALL.get(s.id)||e.rec);
  let rec=Object.assign({},base,{title:s.title,html:s.html,text:s.text,updated:s.updated});
  if(rec.locked)rec=await sealNote(rec);
  await putNote(rec); return rec;
}
/* leaving: save, drop an empty note, collect unused images, free object URLs */
function leaveEditor(){
  if(!E)return saveQ;
  const e=E; clearTimeout(e.H.t); closeViewer(); if(e.body.contains(D.activeElement)||D.activeElement===e.tin)D.activeElement.blur();
  const p=flush(); E=null; if(S.view==='editor')S.view='list'; S.listStale=true;
  return p.then(()=>{
    const empty=!e.savedTitle&&!htmlText(e.savedHtml)&&e.savedHtml.indexOf('data-blob=')<0;
    if(empty)return ALL.has(e.id)?deleteNotesHard([e.id]):dropBlobs(e.id,new Set());
    if(!e.failed)return dropBlobs(e.id,blobIds(e.savedHtml));
  }).catch(()=>{}).then(()=>{ e.closed=true; dropPrint(); e.urls.forEach(u=>{try{URL.revokeObjectURL(u);}catch(_){}}); e.urls.clear(); (e.old||[]).forEach(u=>{try{URL.revokeObjectURL(u);}catch(_){}}); if(S.view==='list'&&ov&&!ov.hidden&&!E)renderList(false); });
}
function dropBlobs(nid,keep){
  return blobsOf(nid).then(bs=>{const dead=bs.filter(b=>!keep.has(b.id)).map(b=>b.id); if(dead.length)return run(['blobs'],'readwrite',t=>{dead.forEach(id=>t.objectStore('blobs').delete(id));});});
}
/* ---------- undo / redo (snapshots, so checklists, images and colours undo too) ---------- */
function pathTo(n){const p=[];for(;n&&n!==E.body;n=n.parentNode){const par=n.parentNode;if(!par)return null;p.unshift(Array.prototype.indexOf.call(par.childNodes,n));}return n===E.body?p:null;}
function nodeAt(p){let n=E.body;for(const i of p){n=n.childNodes[i];if(!n)return null;}return n;}
const nlen=n=>n.nodeType===3?n.data.length:n.childNodes.length;
function selPath(){const s=W.getSelection();if(!s.rangeCount||!E.body.contains(s.anchorNode))return null;const r=s.getRangeAt(0),a=pathTo(r.startContainer),b=pathTo(r.endContainer);return a&&b?[a,r.startOffset,b,r.endOffset]:null;}
function selRestore(sp){
  if(!sp)return; const a=nodeAt(sp[0]),b=nodeAt(sp[2]); if(!a||!b)return;
  try{const r=D.createRange();r.setStart(a,Math.min(sp[1],nlen(a)));r.setEnd(b,Math.min(sp[3],nlen(b)));const s=W.getSelection();s.removeAllRanges();s.addRange(r);}catch(e){}
}
function hPush(){
  const H=E.H; clearTimeout(H.t); H.pend=false;
  const s={h:E.body.innerHTML,s:selPath()};
  if(H.i>=0&&H.st[H.i].h===s.h){H.st[H.i].s=s.s;updUR();return;}
  H.st.splice(H.i+1); H.st.push(s); if(H.st.length>150)H.st.shift(); H.i=H.st.length-1; updUR();
}
function hSched(){const H=E.H;H.pend=true;clearTimeout(H.t);const e=E;H.t=setTimeout(()=>{if(E===e)hPush();},450);updUR();}
function hFlush(){if(E&&E.H.pend)hPush();}
function undo(){ if(!E)return; hFlush(); const H=E.H; if(H.i<=0)return; H.i--; hLoad(H.st[H.i]); }
function redo(){ if(!E)return; const H=E.H; if(H.pend||H.i>=H.st.length-1)return; H.i++; hLoad(H.st[H.i]); }
function hLoad(s){ E.body.innerHTML=s.h; qa(E.body,'img[data-blob]').forEach(im=>{const u=E.urls.get(im.dataset.blob); if(u&&im.getAttribute('src')!==u)im.src=u;}); hydrate(E.body); if(D.activeElement===E.body)selRestore(s.s); normalize(); updEmpty(); markDirty(); updUR(); updStates(); }
function updUR(){ if(!E)return; const H=E.H, u=q(E.tb,'[data-c="undo"]'), r=q(E.tb,'[data-c="redo"]'); if(u)u.disabled=!(H.pend||H.i>0); if(r)r.disabled=H.pend||H.i>=H.st.length-1; }
/* ---------- DOM helpers ---------- */
const BLK=/^(DIV|P|H2|H3|LI|UL|OL)$/;
function upTo(n,test){for(;n&&n!==E.body;n=n.parentNode)if(n.nodeType===1&&test(n))return n;return null;}
const ckOf=n=>upTo(n,x=>x.tagName==='DIV'&&x.classList.contains('nts-ck'));
function caretIn(node,off){ try{const r=D.createRange();r.setStart(node,Math.min(off,nlen(node)));r.collapse(true);const s=W.getSelection();s.removeAllRanges();s.addRange(r);}catch(e){} }
function caretAfterBox(item){ const cb=q(item,':scope>.nts-cb'); const r=D.createRange(); if(cb)r.setStartAfter(cb); else r.setStart(item,0); r.collapse(true); const s=W.getSelection(); s.removeAllRanges(); s.addRange(r); }
function curRange(){ const s=W.getSelection(); return s.rangeCount&&E.body.contains(s.getRangeAt(0).commonAncestorContainer)?s.getRangeAt(0):null; }
function ensureFocus(){
  if(!E)return; const b=E.body;
  if(D.activeElement!==b||!curRange()){
    b.focus({preventScroll:true});
    if(E.range&&b.contains(E.range.startContainer)&&b.contains(E.range.endContainer)){const s=W.getSelection();s.removeAllRanges();s.addRange(E.range);}
    else if(!curRange()){const last=b.lastChild; if(last&&last.nodeType===1&&BLK.test(last.tagName))caretIn(last,nlen(last)); else caretIn(b,nlen(b));}
  }
}
function wrapLoose(){
  let run_=[]; const b=E.body, flushRun=()=>{ if(!run_.length)return; const d=D.createElement('div'); b.insertBefore(d,run_[0]); run_.forEach(n=>d.appendChild(n)); run_=[]; };
  Array.from(b.childNodes).forEach(n=>{ if(n.nodeType===1&&BLK.test(n.tagName)&&n.tagName!=='LI')flushRun(); else if(n.nodeType===3&&!n.data.trim()&&!run_.length)n.remove(); else run_.push(n); });
  flushRun();
}
const topOf=n=>{for(;n&&n.parentNode!==E.body;n=n.parentNode){if(n===E.body)return null;}return n||null;};
const blank=b=>!b.textContent.replace(/[\u200b\s☐☑]/g,'')&&!q(b,'img');
function blocksIn(r){
  const out=[], top=Array.from(E.body.children);
  top.forEach(b=>{ if(!r.intersectsNode(b))return;
    if(b.tagName==='UL'||b.tagName==='OL')Array.from(b.children).forEach(li=>{if(r.intersectsNode(li))out.push(li);}); else out.push(b); });
  return out;
}
function normalize(){
  if(!E)return; const b=E.body;
  qa(b,'.nts-cb').forEach(cb=>{ const p=cb.parentNode; let f=p&&p.firstChild; while(f&&f.nodeType===3&&!f.data.trim())f=f.nextSibling;
    if(!(p&&p.tagName==='DIV'&&p.classList.contains('nts-ck')&&f===cb))cb.remove(); else if(cb.getAttribute('contenteditable')!=='false')cb.setAttribute('contenteditable','false'); });
  qa(b,'div.nts-ck').forEach(d=>{ if(!q(d,':scope>.nts-cb'))d.classList.remove('nts-ck','nts-done'); });
  if(!b.firstChild)b.innerHTML='<div><br></div>';
}
function updEmpty(){ if(!E)return; const b=E.body; b.toggleAttribute('data-empty',!b.textContent.replace(/[\u200b\s]/g,'')&&!q(b,'img,.nts-cb,li')); }

/* ---------- editor events ---------- */
function wireEditor(e){
  const b=e.body, t=e.tin, tb=e.tb;
  t.addEventListener('input',()=>{ if(/[\r\n]/.test(t.value)){const p=t.selectionStart;t.value=t.value.replace(/[\r\n]+/g,' ');t.selectionStart=t.selectionEnd=Math.min(p,t.value.length);} fitTitle(); markDirty(); });
  t.addEventListener('keydown',ev=>{ if(ev.key==='Enter'){ev.preventDefault(); b.focus({preventScroll:true}); caretIn(b.firstChild||b,0);} });
  b.addEventListener('beforeinput',ev=>{
    const it=ev.inputType;
    if(it==='historyUndo'){ev.preventDefault();undo();return;}
    if(it==='historyRedo'){ev.preventDefault();redo();return;}
    if(it==='insertFromDrop'||it==='insertFromYank'){ev.preventDefault();return;}
    if(it==='insertParagraph'&&ckEnter(ev))return;
    if(it==='deleteContentBackward'&&ckBackspace(ev))return;
    if(/^format/.test(it)||it==='insertParagraph'||it==='deleteContentBackward'&&!E.H.pend)hFlush();
  });
  b.addEventListener('input',ev=>{ if(ev.inputType==='insertParagraph')ckAfterNativeEnter(); normalize(); updEmpty(); hSched(); markDirty(); queueStates(); });
  b.addEventListener('keydown',ev=>{
    const k=ev.key.toLowerCase();
    if((ev.ctrlKey||ev.metaKey)&&!ev.altKey){
      if(k==='z'&&!ev.shiftKey){ev.preventDefault();undo();}
      else if(k==='y'||(k==='z'&&ev.shiftKey)){ev.preventDefault();redo();}
    }
    if(ev.key==='Tab'){ev.preventDefault();}
  });
  b.addEventListener('paste',onPaste);
  b.addEventListener('dragover',ev=>ev.preventDefault());
  b.addEventListener('drop',ev=>ev.preventDefault());
  const boxDown=ev=>{ if(ev.target.closest&&ev.target.closest('.nts-cb'))ev.preventDefault(); };
  b.addEventListener('pointerdown',boxDown); b.addEventListener('mousedown',boxDown);
  b.addEventListener('click',ev=>{
    const cb=ev.target.closest('.nts-cb'); if(cb&&b.contains(cb)){ev.preventDefault();toggleBox(cb);return;}
    if(ev.target.tagName==='IMG'&&ev.target.dataset.blob){ev.preventDefault();openViewer(ev.target);}
  });
  // toolbar: never take focus from the text (keeps the keyboard and selection)
  const keep=ev=>{ if(ev.target.closest('button'))ev.preventDefault(); };
  tb.addEventListener('pointerdown',keep); tb.addEventListener('mousedown',keep);
  tb.addEventListener('click',ev=>{ const x=ev.target.closest('button'); if(!x||x.disabled)return;
    if(x.dataset.p!=null)return palPick(x.dataset.p); if(x.dataset.c)cmd(x.dataset.c); });
  e.sc.addEventListener('click',ev=>{ if(ev.target===e.sc||ev.target.classList.contains('nts-page')){ b.focus({preventScroll:true}); const l=b.lastChild; if(l)caretIn(l,nlen(l)); } });
}
function fitTitle(){ if(!E)return; const t=E.tin; t.style.height='auto'; t.style.height=Math.max(52,t.scrollHeight)+'px'; }
function onSelChange(){
  if(!E)return; const s=W.getSelection();
  if(s.rangeCount&&E.body.contains(s.anchorNode)){E.range=s.getRangeAt(0).cloneRange();queueStates();}
}
let stT=0; function queueStates(){ if(stT)return; stT=requestAnimationFrame(()=>{stT=0;updStates();}); }
function qState(c){try{return D.queryCommandState(c);}catch(e){return false;}}
function qVal(c){try{return String(D.queryCommandValue(c)||'');}catch(e){return '';}}
function updStates(){
  if(!E||!E.tb)return; const r=curRange(), on=(c,v)=>{const x=q(E.tb,'[data-c="'+c+'"]');if(x){x.classList.toggle('nts-on',!!v);x.setAttribute('aria-pressed',v?'true':'false');}};
  if(!r){['bold','italic','underline','strikeThrough','heading','hl','ul','ol','check'].forEach(c=>on(c,false));return;}
  ['bold','italic','underline','strikeThrough'].forEach(c=>on(c,qState(c)));
  const blk=upTo(r.startContainer,n=>/^(H2|H3|DIV|P|LI)$/.test(n.tagName));
  on('heading',blk&&/^H[23]$/.test(blk.tagName)); on('hl',isHL(qVal('backColor')));
  on('ul',qState('insertUnorderedList')); on('ol',qState('insertOrderedList')); on('check',!!ckOf(r.startContainer));
  const c=txCol(qVal('foreColor')), bar=q(E.tb,'.nts-cbar'); if(bar)bar.style.background=c||'';
}
/* ---------- commands ---------- */
function afterEdit(){ normalize(); updEmpty(); hPush(); markDirty(); updStates(); keepCaret(); }
function cmd(c){
  if(!E)return;
  if(c==='undo')return undo(); if(c==='redo')return redo();
  if(c==='image')return imageSheet(); if(c==='sketch')return newSketch();
  if(c==='kbd'){const a=D.activeElement; if(a&&a.blur)a.blur(); return;}
  if(c==='color')return showPal(true);
  ensureFocus(); hFlush();
  try{
    if(c==='bold'||c==='italic'||c==='underline'||c==='strikeThrough')D.execCommand(c,false,null);
    else if(c==='heading'){ const r=curRange(), blk=r&&upTo(r.startContainer,n=>/^(H2|H3|DIV|P|LI)$/.test(n.tagName)); unCheckSel();
      D.execCommand('formatBlock',false,blk&&blk.tagName==='H2'?'h3':blk&&blk.tagName==='H3'?'div':'h2'); }
    else if(c==='ul'||c==='ol'){ unCheckSel(); D.execCommand(c==='ul'?'insertUnorderedList':'insertOrderedList',false,null); }
    else if(c==='check')toggleChecklist();
    else if(c==='hl'){ const onHL=isHL(qVal('backColor')), r=curRange();
      if(!(onHL&&r&&r.collapsed&&escapeStyle(n=>n.style&&isHL(n.style.backgroundColor)))){ D.execCommand('styleWithCSS',false,true); D.execCommand('hiliteColor',false,onHL?'transparent':HLS); D.execCommand('styleWithCSS',false,false); } }
    else if(c==='time')D.execCommand('insertText',false,stampTxt());
  }catch(err){console.error(err);}
  afterEdit();
}
function showPal(on){ if(!E)return; E.pal=on; q(E.tb,'.nts-pal').hidden=!on; q(E.tb,'.nts-tbr1').hidden=on; }
function palPick(v){
  if(v==='x')return showPal(false);
  ensureFocus(); hFlush();
  const ink=getComputedStyle(E.body).color, r=curRange();
  if(!(!v&&r&&r.collapsed&&escapeStyle(n=>(n.tagName==='FONT'&&n.hasAttribute('color'))||(n.style&&!!n.style.color)))){ D.execCommand('styleWithCSS',false,true); D.execCommand('foreColor',false,v||ink); D.execCommand('styleWithCSS',false,false); }
  showPal(false); afterEdit();
}
/* collapsed caret: step out of a colour/highlight wrapper so new typing (and new lines) are plain */
function escapeStyle(test){
  const r=curRange(); if(!r||!r.collapsed)return false;
  const blk=upTo(r.startContainer,n=>/^(DIV|P|H2|H3|LI)$/.test(n.tagName))||E.body; let anc=null;
  for(let n=r.startContainer;n&&n!==blk&&n!==E.body;n=n.parentNode)if(n.nodeType===1&&test(n))anc=n;
  if(!anc)return false;
  const tail=D.createRange(); tail.setStart(r.startContainer,r.startOffset); tail.setEnd(anc,anc.childNodes.length);
  const frag=tail.extractContents(), z=D.createTextNode('\u200b'); anc.after(z);
  if(frag.textContent.replace(/\u200b/g,'')||frag.querySelector('img')){const c=anc.cloneNode(false);c.appendChild(frag);z.after(c);}
  if(!anc.textContent.replace(/\u200b/g,'')&&!anc.querySelector('img'))anc.remove();
  caretIn(z,1); return true;
}
/* ---------- checklist ---------- */
function mkItem(done){ const d=D.createElement('div'); d.className='nts-ck'+(done?' nts-done':''); const s=D.createElement('span'); s.className='nts-cb'; s.setAttribute('contenteditable','false'); s.textContent=done?'☑':'☐'; d.appendChild(s); return d; }
function toggleBox(cb){
  const item=cb.parentNode; if(!E||!item||!item.classList.contains('nts-ck'))return;
  hFlush(); const done=!item.classList.contains('nts-done'); item.classList.toggle('nts-done',done); cb.textContent=done?'☑':'☐';
  vib(12); hPush(); markDirty();
}
function toCheck(b){
  let d;
  if(b.tagName==='LI'){ const list=b.parentNode, after=D.createElement(list.tagName); let n=b.nextSibling; while(n){const x=n.nextSibling;after.appendChild(n);n=x;}
    d=mkItem(false); while(b.firstChild)d.appendChild(b.firstChild); list.after(d); if(after.childNodes.length)d.after(after); b.remove(); if(!list.children.length)list.remove(); }
  else { d=mkItem(false); while(b.firstChild)d.appendChild(b.firstChild); b.replaceWith(d); }
  if(d.childNodes.length===1)d.appendChild(D.createElement('br'));
  return d;
}
function unCheck(d){ const cb=q(d,':scope>.nts-cb'); if(cb)cb.remove(); d.classList.remove('nts-ck','nts-done'); if(!d.className)d.removeAttribute('class'); if(!d.firstChild)d.appendChild(D.createElement('br')); }
function unCheckSel(){ const r=curRange(); if(!r)return; blocksIn(r).forEach(b=>{if(b.classList&&b.classList.contains('nts-ck'))unCheck(b);}); }
function toggleChecklist(){
  wrapLoose(); const r=curRange(); if(!r)return;
  const sc=r.startContainer, so=r.startOffset, ec=r.endContainer, eo=r.endOffset, col=r.collapsed;
  const bl=blocksIn(r); if(!bl.length)return;
  if(bl.every(b=>b.classList&&b.classList.contains('nts-ck'))){ bl.forEach(unCheck); }
  else {
    const made=bl.map(b=>b.classList&&b.classList.contains('nts-ck')?b:toCheck(b));
    if(made.length===1&&blank(made[0])){caretAfterBox(made[0]);return;}
  }
  try{ const s=W.getSelection(), nr=D.createRange(); nr.setStart(sc,Math.min(so,nlen(sc))); if(col)nr.collapse(true); else nr.setEnd(ec,Math.min(eo,nlen(ec)));
    if(!E.body.contains(nr.startContainer))throw 0; const ck=ckOf(nr.startContainer); if(col&&ck&&nr.startContainer===ck&&nr.startOffset===0)nr.setStartAfter(ck.firstChild);
    s.removeAllRanges(); s.addRange(nr); }catch(e){ const f=bl[0]&&bl[0].isConnected?bl[0]:null; if(f)caretAfterBox(f); }
}
function ckSplit(item,r){
  const cb=q(item,':scope>.nts-cb'), rr=D.createRange();
  if(cb&&r.startContainer===item&&r.startOffset<=Array.prototype.indexOf.call(item.childNodes,cb))rr.setStartAfter(cb); else rr.setStart(r.startContainer,r.startOffset);
  rr.setEnd(item,item.childNodes.length);
  const ni=mkItem(false); ni.appendChild(rr.extractContents());
  [item,ni].forEach(x=>{ if(blank(x)&&!q(x,'br'))x.appendChild(D.createElement('br')); });
  item.after(ni); caretAfterBox(ni); return ni;
}
function ckBackspace(ev){
  const r=curRange(); if(!r||!r.collapsed||!ev.cancelable)return false; const item=ckOf(r.startContainer); if(!item)return false;
  const cb=q(item,':scope>.nts-cb'); if(!cb)return false;
  const pre=D.createRange(); pre.setStartAfter(cb); try{pre.setEnd(r.startContainer,r.startOffset);}catch(e){return false;}
  if(pre.toString().length||pre.cloneContents().querySelector('img'))return false;
  ev.preventDefault(); hFlush(); unCheck(item); caretIn(item,0); afterEdit(); return true;
}
/* fallback when the keyboard's Enter could not be intercepted (e.g. mid-composition on Android) */
function ckAfterNativeEnter(){
  const r=curRange(); if(!r)return; const cur=upTo(r.startContainer,n=>n.tagName==='DIV'&&n.parentNode===E.body); if(!cur)return;
  const prev=cur.previousElementSibling; if(!prev||!prev.classList.contains('nts-ck')||!cur.classList.contains('nts-ck')||q(cur,':scope>.nts-cb'))return;
  if(blank(prev)){ prev.remove(); cur.classList.remove('nts-ck','nts-done'); if(!cur.className)cur.removeAttribute('class'); if(!cur.firstChild)cur.appendChild(D.createElement('br')); caretIn(cur,0); return; }
  cur.className='nts-ck'; const box=mkItem(false).firstChild; cur.insertBefore(box,cur.firstChild); if(cur.childNodes.length===1)cur.appendChild(D.createElement('br'));
  const pos=D.createRange(); pos.setStartAfter(box); pos.collapse(true); const s=W.getSelection(); s.removeAllRanges(); s.addRange(pos);
}
function ckEnter(ev){
  const r=curRange(); if(!r)return false; const item=ckOf(r.startContainer); if(!item)return false;
  ev.preventDefault(); hFlush(); if(!r.collapsed)r.deleteContents();
  if(blank(item)){ unCheck(item); caretIn(item,0); } else ckSplit(item,W.getSelection().getRangeAt(0));
  afterEdit(); return true;
}
/* paste = plain text only */
function onPaste(ev){
  ev.preventDefault(); if(!E)return;
  const t=((ev.clipboardData&&ev.clipboardData.getData('text/plain'))||'').replace(/\r\n?/g,'\n').replace(/\u0000/g,'');
  if(!t)return; hFlush();
  const r=curRange(), item=r&&ckOf(r.startContainer);
  if(item&&t.indexOf('\n')>=0){
    const lines=t.split('\n'); if(!r.collapsed)r.deleteContents();
    lines.forEach((ln,i)=>{ if(i)ckSplit(ckOf(W.getSelection().anchorNode)||item,W.getSelection().getRangeAt(0)); if(ln)D.execCommand('insertText',false,ln); });
  } else D.execCommand('insertText',false,t);
  afterEdit();
}
/* keep the caret visible above the keyboard/toolbar */
function keepCaret(){
  if(!E)return; const r=curRange(); if(!r)return;
  let rc=r.getClientRects()[0]; if(!rc){const n=r.startContainer.nodeType===1?r.startContainer:r.startContainer.parentNode; rc=n&&n.getBoundingClientRect&&n.getBoundingClientRect();}
  if(!rc||(!rc.height&&!rc.top))return; const box=E.sc.getBoundingClientRect();
  if(rc.bottom>box.bottom-12)E.sc.scrollTop+=rc.bottom-box.bottom+28; else if(rc.top<box.top+8)E.sc.scrollTop-=box.top-rc.top+28;
}
/* ---------- note menu ---------- */
function editorMenu(){
  if(!E)return; hFlush(); const r=E.rec;
  const row=(k,ic,l,sub,cls)=>'<button type="button" class="nts-mi'+(cls?' '+cls:'')+'" data-m="'+k+'">'+svg(ic)+'<span>'+l+(sub?'<small>'+sub+'</small>':'')+'</span></button>';
  sheet('<div class="nts-menu">'
    +row('pin',IC.star,r.pinned?'Unpin':'Pin to top',r.pinned?'Shown first and in ★ Favourites':'')
    +row('colour',IC.palette,'Colour',(TINTS.find(t=>t[0]===(r.color||''))||TINTS[0])[1])
    +row('move',IC.folder,'Move to folder',r.folder?esc(folderName(r.folder)):'All notes')
    +row('lock',E.locked?IC.unlock:IC.lock,E.locked?'Remove lock':'Lock note',E.locked?'Stores this note unencrypted again':'Encrypt with your notes passcode')
    +row('copy',IC.copy,'Copy text')+row('txt',IC.download,'Save as text file')+row('print',IC.print,'Print / Save as PDF')
    +row('del',IC.trash,'Delete','Kept '+TRASH_DAYS+' days in Recently deleted','nts-dang')+'</div>',root=>{
    root.addEventListener('click',ev=>{ const b=ev.target.closest('[data-m]'); if(!b)return; const m=b.dataset.m; closeSheet(); menuAct(m); });
  });
}
function menuAct(m){
  if(!E)return;
  if(m==='pin')edTop('pin');
  else if(m==='colour')colourPicker(E.rec.color||'',c=>{edMeta({color:c}); if(E){ if(c)E.ed.dataset.tint=c; else delete E.ed.dataset.tint; }});
  else if(m==='move')folderPicker(E.rec.folder||'',f=>{edMeta({folder:f}); topForEditor(); toast('Moved to '+(f?folderName(f):'All notes'));});
  else if(m==='lock'){ if(E.locked)unlockNoteForever(); else lockThisNote(); }
  else if(m==='copy'){ const tx=noteText(); copyText(tx); }
  else if(m==='txt'){ const tx=noteText(true); const nm=E.tin.value.trim()||(htmlText(sanitize(E.body.innerHTML)).split('\n').find(l=>l.trim())||'Note'); download(new Blob([tx.replace(/\n/g,'\r\n')],{type:'text/plain;charset=utf-8'}),safeName(nm)+'_'+fileStamp(Date.now())+'.txt'); toast('Text file saved to Downloads'); }
  else if(m==='print')printNote();
  else if(m==='del'){ const id=E.id; flush().then(()=>{ if(!ALL.has(id)){ toList(); return; } trashNotes([id],()=>{ if(E&&E.id===id)toList(); }); }); }
}
function noteText(withMeta){
  const html=sanitize(E.body.innerHTML), txt=htmlText(html), title=E.tin.value.trim();
  if(!withMeta)return (title?title+'\n\n':'')+txt;
  return (title||'Note')+'\n'+'Edited '+full(E.rec.updated||Date.now())+'\n\n'+txt+'\n';
}
function copyText(t){
  const fb=()=>{const ta=D.createElement('textarea');ta.value=t;ta.setAttribute('readonly','');ta.style.cssText='position:fixed;left:0;top:0;opacity:0';(ov||D.body).appendChild(ta);ta.select();let ok=false;try{ok=D.execCommand('copy');}catch(e){}ta.remove();toast(ok?'Text copied':'Copy failed');};
  if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(t).then(()=>toast('Text copied'),fb); else fb();
}

/* =====================================================================
   IMAGES: pick → downscale → store blob → <img data-blob>; viewer; print
   ===================================================================== */
function openBlob(r){ return r.enc?openSealedBlob(r):Promise.resolve(r); }
function putBlob(rec,locked){ return (locked?sealBlob(rec):Promise.resolve(rec)).then(r=>{askPersist();return run(['blobs'],'readwrite',t=>{t.objectStore('blobs').put(r);});}); }
function blobURL(e,id){
  if(e.urls.has(id))return Promise.resolve(e.urls.get(id));
  e.pend=e.pend||new Map(); if(e.pend.has(id))return e.pend.get(id);
  const p=dbGet('blobs',id).then(r=>r?openBlob(r):null).then(r=>{
    e.pend.delete(id); if(!r||!r.data)return null; if(e.urls.has(id))return e.urls.get(id);
    const u=URL.createObjectURL(r.data); if(e.closed){setTimeout(()=>URL.revokeObjectURL(u),1000);return u;} e.urls.set(id,u); return u;
  }).catch(()=>{e.pend.delete(id);return null;});
  e.pend.set(id,p); return p;
}
function hydrate(root){
  const e=E; if(!e)return;
  qa(root,'img[data-blob]').forEach(img=>{
    img.setAttribute('draggable','false'); if(!img.hasAttribute('alt'))img.alt='';
    if(!img.getAttribute('src'))blobURL(e,img.dataset.blob).then(u=>{ if(u)img.src=u; else {img.classList.add('nts-miss');img.alt='Image missing';} });
  });
}
function scaled(src,sw,sh,max,bg){
  const sc=Math.min(1,max/Math.max(sw,sh)), w=Math.max(1,Math.round(sw*sc)), h=Math.max(1,Math.round(sh*sc));
  const cv=D.createElement('canvas'); cv.width=w; cv.height=h; const c=cv.getContext('2d');
  if(bg){c.fillStyle=bg;c.fillRect(0,0,w,h);} c.imageSmoothingEnabled=true; c.imageSmoothingQuality='high'; c.drawImage(src,0,0,w,h); return cv;
}
async function processImage(file){
  let src=null, w=0, h=0, bmp=null, url=null;
  try{ bmp=await createImageBitmap(file,{imageOrientation:'from-image'}); src=bmp; w=bmp.width; h=bmp.height; }
  catch(e){ url=URL.createObjectURL(file); const im=new Image(); im.src=url; await im.decode(); src=im; w=im.naturalWidth; h=im.naturalHeight; }
  try{
    if(!w||!h)throw new Error('Unreadable image');
    const cv=scaled(src,w,h,2000,'#ffffff'), full=await toBlob(cv,'image/jpeg',0.85);
    const tc=scaled(cv,cv.width,cv.height,360,'#ffffff'), thumb=await toBlob(tc,'image/jpeg',0.72);
    const out={full,thumb,w:cv.width,h:cv.height}; cv.width=cv.height=tc.width=tc.height=0; return out;
  } finally { if(bmp&&bmp.close)bmp.close(); if(url)URL.revokeObjectURL(url); }
}
function imageSheet(){
  if(!E)return;
  sheet('<h3>Add image</h3><div class="nts-two"><button type="button" class="nts-big nts-cam">'+svg(IC.camera)+'<span>Take photo</span></button><button type="button" class="nts-big nts-gal">'+svg(IC.image)+'<span>From gallery</span></button></div>'
    +'<p class="nts-note">Photos are resized to 2000 px and kept inside this note on this phone only. Location and camera details (EXIF) are removed.</p>',r=>{
    q(r,'.nts-cam').onclick=()=>{closeSheet();pickFiles(true);};
    q(r,'.nts-gal').onclick=()=>{closeSheet();pickFiles(false);};
  });
}
function pickFiles(cam){
  if(!E)return; const e=E, i=D.createElement('input');
  i.type='file'; i.accept='image/*'; if(cam)i.setAttribute('capture','environment'); else i.multiple=true;
  i.className='nts-file'; ov.appendChild(i); e.picking=true;
  const done=()=>{ e.picking=false; i.remove(); };
  i.addEventListener('change',()=>{ const fs=Array.from(i.files||[]); done(); if(E===e&&fs.length)addImages(fs); },{once:true});
  i.addEventListener('cancel',done,{once:true});
  i.click();
}
async function addImages(files){
  const e=E; if(!e)return; let n=0;
  toast(files.length>1?'Adding '+files.length+' photos…':'Adding photo…');
  for(const f of files){
    if(E!==e)break;
    try{
      const im=await processImage(f), id=uid('b');
      await putBlob({id,note:e.id,kind:'img',type:'image/jpeg',data:im.full,thumb:im.thumb,w:im.w,h:im.h,created:Date.now()},e.locked);
      if(E!==e)break;
      const u=URL.createObjectURL(im.full); e.urls.set(id,u); insertImgBlock(id,u); n++;
    }catch(err){ console.error(err); toast(/decode|source|unreadable|state/i.test(String(err&&(err.message||err.name)))?'That picture can’t be opened here (HEIC?) — choose a JPEG or PNG':'Could not add the photo — '+storageErr(err)); }
  }
  if(n)toast(n>1?n+' photos added':'Photo added');
}
function insertImgBlock(id,u,after){
  if(!E)return; const b=E.body;
  b.focus({preventScroll:true});
  if(E.range&&b.contains(E.range.startContainer)){const s=W.getSelection();s.removeAllRanges();s.addRange(E.range);}
  hFlush(); wrapLoose();
  const r=curRange(); let top=after||null;
  if(!top&&r)top=r.startContainer===b?(b.childNodes[Math.max(0,r.startOffset-1)]||null):topOf(r.startContainer);
  const blk=el('<div><img data-blob="'+id+'" alt="" draggable="false"></div>'); q(blk,'img').src=u;
  if(top&&top.tagName==='DIV'&&blank(top)&&!q(top,'.nts-cb'))top.replaceWith(blk); else if(top&&top.parentNode===b)top.after(blk); else b.appendChild(blk);
  let nx=blk.nextElementSibling; if(!nx||!blank(nx)||q(nx,'.nts-cb')||nx.tagName!=='DIV'){nx=el('<div><br></div>');blk.after(nx);}
  caretIn(nx,0); afterEdit();
  setTimeout(()=>{try{blk.scrollIntoView({block:'nearest'});}catch(e){}},60);
}
/* full-screen viewer */
function openViewer(img){
  if(!E)return; const id=img.dataset.blob, e=E, a=D.activeElement; if(a&&a.blur)a.blur();
  dbGet('blobs',id).then(r=>{
    if(E!==e)return; const kind=r&&r.kind==='sketch'?'sketch':'img';
    viewerEl.innerHTML='<div class="nts-top nts-vtop"><button type="button" class="nts-back nts-vx" aria-label="Back">‹ Back</button><div class="nts-tt"><b class="nts-title">'+(kind==='sketch'?'Sketch':'Photo')+'</b><span class="hudclock" data-f="line"></span></div></div>'
      +'<div class="nts-vimg"><img alt="'+(kind==='sketch'?'Sketch':'Photo')+'"></div><div class="nts-vbar">'
      +(kind==='sketch'?'<button type="button" class="nts-vb nts-gold" data-v="edit">'+svg(IC.pen)+'<span>Edit sketch</span></button>':'')
      +'<button type="button" class="nts-vb" data-v="save">'+svg(IC.download)+'<span>Save copy</span></button>'
      +'<button type="button" class="nts-vb nts-dang" data-v="del">'+svg(IC.trash)+'<span>Delete image</span></button></div>';
    q(viewerEl,'.nts-vimg img').src=img.src; viewerEl.hidden=false; hud();
    viewerEl.onclick=ev=>{ if(ev.target.closest('.nts-vx'))return closeViewer(); const b=ev.target.closest('[data-v]'); if(!b)return; const v=b.dataset.v;
      if(v==='del'){closeViewer();deleteImage(id);} else if(v==='edit'){closeViewer();editSketch(id);} else if(v==='save')saveImage(id,kind); };
  });
}
function closeViewer(){ if(!viewerEl||viewerEl.hidden)return; viewerEl.hidden=true; viewerEl.innerHTML=''; viewerEl.onclick=null; }
function deleteImage(id){
  if(!E)return; hFlush();
  qa(E.body,'img[data-blob="'+id+'"]').forEach(im=>{const p=im.parentNode; im.remove(); if(p&&p!==E.body&&p.tagName==='DIV'&&blank(p)&&!q(p,'.nts-cb')&&p.nextSibling)p.remove();});
  afterEdit(); toast('Image removed',{label:'Undo',fn:()=>undo()});
}
function saveImage(id,kind){
  dbGet('blobs',id).then(r=>r?openBlob(r):null).then(r=>{ if(!r||!r.data)return toast('Image not found');
    download(r.data,safeName(E&&E.tin.value.trim()||kind)+'_'+fileStamp(Date.now())+(r.type==='image/png'?'.png':'.jpg')); toast('Saved to Downloads'); }).catch(e=>toast(storageErr(e)));
}
/* print / save as PDF: a black-on-white copy outside the overlay, shown only by the print stylesheet */
function printNote(){
  if(!E)return; flush();
  const html=sanitize(E.body.innerHTML), title=E.tin.value.trim(), e=E;
  let pr=D.getElementById('nts-print'); if(pr)pr.remove();
  pr=D.createElement('div'); pr.id='nts-print';
  pr.innerHTML='<h1>'+esc(title||'Note')+'</h1><p class="nts-pmeta">Edited '+esc(full(e.rec.updated||Date.now()))+'</p><div class="nts-pbody">'+html+'</div>';
  qa(pr,'img[data-blob]').forEach(im=>{const u=e.urls.get(im.dataset.blob); if(u)im.src=u; else im.remove();});
  D.body.appendChild(pr);
  Promise.all(qa(pr,'img').map(im=>im.decode?im.decode().catch(()=>{}):null)).then(()=>{ try{W.print();}catch(err){toast('Printing isn’t available on this device');} });
}
function dropPrint(){ const pr=D.getElementById('nts-print'); if(pr)pr.remove(); }

/* =====================================================================
   SKETCH: full-screen canvas — pressure pen, highlighter, stroke eraser, undo/redo,
   plain / lined / grid paper, finger toggle. Saved as PNG + stroke JSON (re-editable).
   ===================================================================== */
const PEN_COL=[['Black','#111111'],['Blue','#1f5fd6'],['Red','#d62828'],['Green','#16893a'],['Gold','#d4af37'],['White','#ffffff']];
const PEN_W=[2,4,8], HL_W=[12,20,32], ER_R=[12,20,32], PAPER='#fbf8f1';
const BGS=[['plain','Plain',IC.pagePlain],['lined','Lined',IC.pageLined],['grid','Grid',IC.pageGrid]];
let SK=null;
const penCol=c=>PEN_COL.some(x=>x[1]===c)?c:'#111111';
function newSketch(){ if(E)skOpen(null,res=>insertSketch(res)); }
function editSketch(id){
  if(!E)return; const e=E;
  dbGet('blobs',id).then(r=>r?openBlob(r):null).then(r=>{
    if(E!==e)return; let d=null; try{d=r&&r.strokes?(typeof r.strokes==='string'?JSON.parse(r.strokes):r.strokes):null;}catch(err){}
    if(!d||!d.w||!d.h)return toast('This sketch can’t be edited');
    skOpen(d,res=>replaceSketch(id,res));
  }).catch(err=>toast(storageErr(err)));
}
function decodeStrokes(d){
  return (Array.isArray(d.s)?d.s:[]).slice(0,5000).map(s=>{
    const k=s.f?3:2, a=Array.isArray(s.p)?s.p:[], p=[];
    for(let i=0;i+k-1<a.length;i+=k)p.push({x:+a[i]||0,y:+a[i+1]||0,f:s.f?Math.min(1.8,Math.max(.2,+a[i+2]||1)):1});
    return bbox({t:s.t==='h'?'h':'p',c:penCol(s.c),w:Math.min(60,Math.max(1,+s.w||4)),p});
  }).filter(s=>s.p.length);
}
function encodeStrokes(ss){
  const r=v=>Math.round(v*10)/10;
  return ss.map(s=>{const f=s.p.some(p=>p.f!==1),a=[];s.p.forEach(p=>{a.push(r(p.x),r(p.y));if(f)a.push(Math.round(p.f*100)/100);});return {t:s.t,c:s.c,w:s.w,f:f?1:0,p:a};});
}
function bbox(s){let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;s.p.forEach(p=>{if(p.x<x0)x0=p.x;if(p.y<y0)y0=p.y;if(p.x>x1)x1=p.x;if(p.y>y1)y1=p.y;});s.bb=[x0,y0,x1,y1];return s;}
function skOpen(data,onSave){
  const a=D.activeElement; if(a&&a.blur)a.blur(); closeSheet();
  SK={tool:LSget('sktool','pen'),col:penCol(LSget('skcol','#111111')),wi:Math.min(2,Math.max(0,+LSget('skw',1)||0)),bg:data?(BGS.some(b=>b[0]===data.bg)?data.bg:'plain'):LSget('skbg','grid'),
    finger:LSget('finger',true)!==false,strokes:data?decodeStrokes(data):[],undo:[],redo:[],changed:false,page:data?{w:+data.w,h:+data.h}:null,onSave,act:null,cur:null,er:null,hinted:false};
  if(!['pen','hl','eraser'].includes(SK.tool))SK.tool='pen';
  const tb=(k,ic,l)=>'<button type="button" class="nts-skb" data-k="'+k+'" aria-label="'+l+'">'+svg(ic)+'<span>'+l+'</span></button>';
  skEl.innerHTML='<div class="nts-top"><button type="button" class="nts-back" data-k="back" aria-label="Back — saves the sketch">‹ Back</button>'
    +'<div class="nts-tt"><b class="nts-title">Sketch</b><span class="hudclock" data-f="line"></span></div>'
    +'<div class="nts-tacts"><button type="button" class="nts-ib" data-k="discard" aria-label="Discard sketch" title="Discard">'+svg(IC.x)+'</button><button type="button" class="nts-skdone" data-k="done" aria-label="Done — save the sketch" title="Done">'+svg(IC.tick)+'</button></div></div>'
    +'<div class="nts-skwrap"><canvas class="nts-skc"></canvas><canvas class="nts-skl"></canvas></div>'
    +'<div class="nts-skbar"><div class="nts-skr">'+tb('pen',IC.pen,'Pen')+tb('hl',IC.marker,'Marker')+tb('eraser',IC.eraser,'Eraser')+tb('undo',IC.undo,'Undo')+tb('redo',IC.redo,'Redo')+tb('clear',IC.trash,'Clear')+'</div>'
    +'<div class="nts-skr">'+PEN_COL.map(c=>'<button type="button" class="nts-skc2" data-col="'+c[1]+'" aria-label="'+c[0]+'"><i style="background:'+c[1]+'"></i></button>').join('')+'</div>'
    +'<div class="nts-skr">'+PEN_W.map((w,i)=>'<button type="button" class="nts-skw" data-w="'+i+'" aria-label="'+['Thin','Medium','Thick'][i]+' line"><i style="height:'+(2+i*3)+'px"></i></button>').join('')+'<span class="nts-sksep"></span>'
    +BGS.map(b=>'<button type="button" class="nts-skbg" data-bg="'+b[0]+'" aria-label="'+b[1]+' paper">'+svg(b[2])+'<span>'+b[1]+'</span></button>').join('')+'<span class="nts-sksep"></span>'
    +'<button type="button" class="nts-skf" data-k="finger" aria-label="Draw with finger">'+svg(IC.hand)+'<span>Finger</span></button></div></div>';
  skEl.hidden=false; hud();
  const st=SK; st.wrap=q(skEl,'.nts-skwrap'); st.base=q(skEl,'.nts-skc'); st.live=q(skEl,'.nts-skl');
  skEl.onclick=ev=>skClick(ev); wireSk(st); skBtns();
  const fit=()=>{ if(SK===st)skLayout(); };
  if('ResizeObserver' in W){ st.ro=new ResizeObserver(fit); st.ro.observe(st.wrap); } else { W.addEventListener('resize',fit); st.unfit=()=>W.removeEventListener('resize',fit); }
  skLayout();
}
function skLayout(){
  const st=SK, r=st.wrap.getBoundingClientRect(), w0=Math.max(40,r.width), h0=Math.max(40,r.height);
  if(!st.page){ const chrome=skEl.clientHeight-h0; st.page={w:Math.round(w0),h:Math.round(Math.max(h0,Math.min(W.innerHeight,screen.height||W.innerHeight)-chrome))}; }
  st.sc=Math.min(w0/st.page.w,h0/st.page.h); st.ox=(w0-st.page.w*st.sc)/2; st.oy=(h0-st.page.h*st.sc)/2; st.rect=r;
  st.dpr=Math.min(3,W.devicePixelRatio||1);
  [st.base,st.live].forEach(cv=>{const W_=Math.round(w0*st.dpr),H_=Math.round(h0*st.dpr); if(cv.width!==W_||cv.height!==H_){cv.width=W_;cv.height=H_;} cv.style.width=w0+'px'; cv.style.height=h0+'px';});
  skRender(); skLive();
}
function skCtx(cv){ const c=cv.getContext('2d'), st=SK; c.setTransform(1,0,0,1,0,0); c.clearRect(0,0,cv.width,cv.height); const k=st.dpr*st.sc; c.setTransform(k,0,0,k,st.dpr*st.ox,st.dpr*st.oy); return c; }
function skRender(){ const st=SK; if(!st)return; drawPage(skCtx(st.base),st.page.w,st.page.h,st.bg,st.strokes); }
function drawPage(c,w,h,bg,strokes){
  c.save(); c.beginPath(); c.rect(0,0,w,h); c.clip(); c.fillStyle=PAPER; c.fillRect(0,0,w,h); c.lineWidth=1;
  if(bg==='lined'){ c.strokeStyle='rgba(60,105,170,.30)'; for(let y=46;y<h;y+=30){c.beginPath();c.moveTo(0,y);c.lineTo(w,y);c.stroke();}
    c.strokeStyle='rgba(205,70,70,.35)'; c.beginPath(); c.moveTo(44,0); c.lineTo(44,h); c.stroke(); }
  else if(bg==='grid'){ const g=20;
    for(let i=1;i*g<w;i++){c.strokeStyle=i%5?'rgba(60,105,170,.17)':'rgba(60,105,170,.38)';c.beginPath();c.moveTo(i*g,0);c.lineTo(i*g,h);c.stroke();}
    for(let i=1;i*g<h;i++){c.strokeStyle=i%5?'rgba(60,105,170,.17)':'rgba(60,105,170,.38)';c.beginPath();c.moveTo(0,i*g);c.lineTo(w,i*g);c.stroke();} }
  strokes.forEach(s=>drawStroke(c,s)); c.restore();
}
function drawStroke(c,s){
  const p=s.p, n=p.length; if(!n)return;
  c.save(); c.lineCap='round'; c.lineJoin='round'; c.strokeStyle=s.c; c.fillStyle=s.c;
  if(s.t==='h'){
    c.globalAlpha=.36; c.globalCompositeOperation='multiply'; c.lineWidth=s.w; c.beginPath(); c.moveTo(p[0].x,p[0].y);
    if(n===1)c.lineTo(p[0].x+.1,p[0].y); for(let i=1;i<n-1;i++)c.quadraticCurveTo(p[i].x,p[i].y,(p[i].x+p[i+1].x)/2,(p[i].y+p[i+1].y)/2);
    if(n>1)c.lineTo(p[n-1].x,p[n-1].y); c.stroke(); c.restore(); return;
  }
  if(n===1){c.beginPath();c.arc(p[0].x,p[0].y,Math.max(.6,s.w*p[0].f/2),0,Math.PI*2);c.fill();c.restore();return;}
  let mx=p[0].x, my=p[0].y;
  for(let i=1;i<n;i++){
    const a=p[i-1], b=p[i], nx=(a.x+b.x)/2, ny=(a.y+b.y)/2;
    c.lineWidth=Math.max(.6,s.w*(a.f+b.f)/2); c.beginPath(); c.moveTo(mx,my); c.quadraticCurveTo(a.x,a.y,nx,ny); c.stroke(); mx=nx; my=ny;
  }
  const b=p[n-1]; c.lineWidth=Math.max(.6,s.w*b.f); c.beginPath(); c.moveTo(mx,my); c.lineTo(b.x,b.y); c.stroke(); c.restore();
}
function skLive(){
  const st=SK; if(!st)return; const c=skCtx(st.live);
  if(st.cur)drawStroke(c,st.cur);
  if(st.er){ c.save(); c.lineWidth=1.5/st.sc; c.strokeStyle='rgba(20,30,50,.7)'; c.fillStyle='rgba(255,255,255,.35)'; c.beginPath(); c.arc(st.er.x,st.er.y,ER_R[st.wi]/st.sc,0,Math.PI*2); c.fill(); c.stroke(); c.restore(); }
}
let skRaf=0; const skQueue=()=>{ if(!skRaf)skRaf=requestAnimationFrame(()=>{skRaf=0;skLive();}); };
function toPage(ev){ const st=SK, r=st.live.getBoundingClientRect(); return {x:(ev.clientX-r.left-st.ox)/st.sc, y:(ev.clientY-r.top-st.oy)/st.sc}; }
function wireSk(st){
  const cv=st.live;
  cv.addEventListener('pointerdown',ev=>{
    if(SK!==st)return; if(ev.pointerType==='mouse'&&ev.button!==0)return;
    if(ev.pointerType==='touch'&&!st.finger){ if(!st.hinted){st.hinted=true;toast('Finger drawing is off — use the S Pen, or tap ✋ Finger');} return; }
    if(st.act){ if(!(st.act.type==='touch'&&ev.pointerType==='pen'))return; st.cur=null; }   // pen wins over a resting palm
    ev.preventDefault(); try{cv.setPointerCapture(ev.pointerId);}catch(e){}
    st.act={id:ev.pointerId,type:ev.pointerType}; const p=toPage(ev);
    if(st.tool==='eraser'){ st.erased=[]; eraseAt(p); st.er=p; }
    else { st.cur={t:st.tool==='hl'?'h':'p',c:st.col,w:st.tool==='hl'?HL_W[st.wi]:PEN_W[st.wi],p:[mkPt(ev,p)]}; }
    skQueue();
  });
  cv.addEventListener('pointermove',ev=>{
    if(SK!==st||!st.act||ev.pointerId!==st.act.id)return; ev.preventDefault();
    const evs=(ev.getCoalescedEvents&&ev.getCoalescedEvents())||[]; (evs.length?evs:[ev]).forEach(x=>{ const p=toPage(x);
      if(st.tool==='eraser'){eraseAt(p);st.er=p;} else if(st.cur){ const l=st.cur.p[st.cur.p.length-1]; if(Math.hypot(p.x-l.x,p.y-l.y)>=.7/st.sc)st.cur.p.push(mkPt(x,p)); } });
    skQueue();
  });
  const end=ev=>{
    if(SK!==st||!st.act||ev.pointerId!==st.act.id)return; st.act=null; if(E&&E.locked)touchKey();
    if(st.tool==='eraser'){ st.er=null; if(st.erased&&st.erased.length){st.undo.push({t:'erase',items:st.erased});st.redo=[];st.changed=true;} st.erased=null; }
    else if(st.cur){ const s=bbox(st.cur); st.cur=null; st.strokes.push(s); st.undo.push({t:'add',s}); st.redo=[]; st.changed=true;
      const c=st.base.getContext('2d'), k=st.dpr*st.sc; c.setTransform(k,0,0,k,st.dpr*st.ox,st.dpr*st.oy); c.save(); c.beginPath(); c.rect(0,0,st.page.w,st.page.h); c.clip(); drawStroke(c,s); c.restore(); }
    skLive(); skBtns();
  };
  cv.addEventListener('pointerup',end); cv.addEventListener('pointercancel',end);
  cv.addEventListener('contextmenu',ev=>ev.preventDefault());
}
function mkPt(ev,p){ const pen=ev.pointerType==='pen'&&ev.pressure>0; return {x:p.x,y:p.y,f:pen?Math.min(1.7,Math.max(.3,.25+ev.pressure*1.3)):1}; }
function segDist(px,py,a,b){ const dx=b.x-a.x, dy=b.y-a.y, L=dx*dx+dy*dy; let t=L?((px-a.x)*dx+(py-a.y)*dy)/L:0; t=t<0?0:t>1?1:t; return Math.hypot(px-(a.x+t*dx),py-(a.y+t*dy)); }
function eraseAt(pt){
  const st=SK, r=ER_R[st.wi]/st.sc; let hit=false;
  for(let i=st.strokes.length-1;i>=0;i--){
    const s=st.strokes[i], m=r+s.w*(s.t==='h'?.5:.85), bb=s.bb;
    if(pt.x<bb[0]-m||pt.x>bb[2]+m||pt.y<bb[1]-m||pt.y>bb[3]+m)continue;
    let on=s.p.length===1?Math.hypot(pt.x-s.p[0].x,pt.y-s.p[0].y)<=m:false;
    for(let j=1;!on&&j<s.p.length;j++)if(segDist(pt.x,pt.y,s.p[j-1],s.p[j])<=m)on=true;
    if(on){st.erased.push({i,s}); st.strokes.splice(i,1); hit=true;}
  }
  if(hit){skRender();vib(8);}
}
function skUndo(){ const st=SK, a=st.undo.pop(); if(!a)return;
  if(a.t==='add'){const i=st.strokes.lastIndexOf(a.s);if(i>=0)st.strokes.splice(i,1);}
  else if(a.t==='erase'){for(let k=a.items.length-1;k>=0;k--)st.strokes.splice(a.items[k].i,0,a.items[k].s);}
  else if(a.t==='clear')st.strokes=a.prev.slice();
  st.redo.push(a); st.changed=true; skRender(); skBtns(); }
function skRedo(){ const st=SK, a=st.redo.pop(); if(!a)return;
  if(a.t==='add')st.strokes.push(a.s);
  else if(a.t==='erase')a.items.forEach(it=>{const i=st.strokes.indexOf(it.s);if(i>=0)st.strokes.splice(i,1);});
  else if(a.t==='clear')st.strokes=[];
  st.undo.push(a); st.changed=true; skRender(); skBtns(); }
function skBtns(){
  const st=SK; if(!st)return;
  qa(skEl,'.nts-skb[data-k="pen"],.nts-skb[data-k="hl"],.nts-skb[data-k="eraser"]').forEach(b=>b.classList.toggle('nts-on',b.dataset.k===st.tool));
  qa(skEl,'.nts-skc2').forEach(b=>b.classList.toggle('nts-on',b.dataset.col===st.col));
  qa(skEl,'.nts-skw').forEach(b=>b.classList.toggle('nts-on',+b.dataset.w===st.wi));
  qa(skEl,'.nts-skbg').forEach(b=>b.classList.toggle('nts-on',b.dataset.bg===st.bg));
  const f=q(skEl,'.nts-skf'); f.classList.toggle('nts-on',st.finger); f.setAttribute('aria-pressed',st.finger?'true':'false'); q(f,'span').textContent=st.finger?'Finger':'Pen only';
  q(skEl,'[data-k="undo"]').disabled=!st.undo.length; q(skEl,'[data-k="redo"]').disabled=!st.redo.length; q(skEl,'[data-k="clear"]').disabled=!st.strokes.length;
}
function skClick(ev){
  const st=SK, b=ev.target.closest('button'); if(!st||!b)return;
  if(b.dataset.col){st.col=b.dataset.col;LSset('skcol',st.col);if(st.tool==='eraser')st.tool='pen';}
  else if(b.dataset.w!=null){st.wi=+b.dataset.w;LSset('skw',st.wi);}
  else if(b.dataset.bg){st.bg=b.dataset.bg;LSset('skbg',st.bg);st.changed=true;skRender();}
  else { const k=b.dataset.k;
    if(k==='pen'||k==='hl'||k==='eraser'){st.tool=k;LSset('sktool',k);}
    else if(k==='undo')return skUndo(); else if(k==='redo')return skRedo();
    else if(k==='clear'){ if(!st.strokes.length)return; st.undo.push({t:'clear',prev:st.strokes.slice()}); st.redo=[]; st.strokes=[]; st.changed=true; skRender(); toast('Cleared — tap Undo to bring it back'); }
    else if(k==='finger'){st.finger=!st.finger;LSset('finger',st.finger);toast(st.finger?'Finger drawing on':'Finger drawing off — only the S Pen draws');}
    else if(k==='done'||k==='back')return skSave();
    else if(k==='discard'){ if(!st.changed)return skClose(); return confirmSheet('Discard this sketch?','Your '+(st.page&&st.onSave?'changes':'drawing')+' will be lost.','Discard',true,()=>skClose()); }
  }
  skBtns();
}
function sketchBack(){ skSave(); }
async function skSave(){
  const st=SK; if(!st)return; skClose(); if(!st.changed)return;
  try{
    const {w,h}=st.page, k=Math.max(1,Math.min(2,2400/Math.max(w,h))), cv=D.createElement('canvas');
    cv.width=Math.round(w*k); cv.height=Math.round(h*k); const c=cv.getContext('2d'); c.setTransform(k,0,0,k,0,0); drawPage(c,w,h,st.bg,st.strokes);
    const png=await toBlob(cv,'image/png'), tc=scaled(cv,cv.width,cv.height,360,PAPER), thumb=await toBlob(tc,'image/jpeg',0.8);
    const data={v:1,w,h,bg:st.bg,s:encodeStrokes(st.strokes)}; cv.width=cv.height=tc.width=tc.height=0;
    await st.onSave({png,thumb,data,empty:!st.strokes.length});
  }catch(err){ console.error(err); toast('Could not save the sketch — '+storageErr(err)); }
}
function skClose(){
  const st=SK; SK=null; if(skRaf){cancelAnimationFrame(skRaf);skRaf=0;}
  if(st){ if(st.ro)st.ro.disconnect(); if(st.unfit)st.unfit(); [st.base,st.live].forEach(cv=>{if(cv){cv.width=cv.height=0;}}); }
  if(skEl){skEl.hidden=true;skEl.innerHTML='';skEl.onclick=null;}
}
function insertSketch(res){
  if(!E)return; if(res.empty){toast('Empty sketch — nothing added');return;}
  const e=E, id=uid('b');
  return putBlob({id,note:e.id,kind:'sketch',type:'image/png',data:res.png,thumb:res.thumb,strokes:JSON.stringify(res.data),w:res.data.w,h:res.data.h,created:Date.now()},e.locked)
    .then(()=>{ if(E!==e)return; const u=URL.createObjectURL(res.png); e.urls.set(id,u); insertImgBlock(id,u); toast('Sketch added — tap it to edit'); })
    .catch(err=>toast('Sketch not saved — '+storageErr(err)));
}
function replaceSketch(id,res){
  if(!E)return; const e=E;
  if(res.empty){ deleteImage(id); return Promise.resolve(); }
  return dbGet('blobs',id).then(old=>putBlob({id,note:e.id,kind:'sketch',type:'image/png',data:res.png,thumb:res.thumb,strokes:JSON.stringify(res.data),w:res.data.w,h:res.data.h,created:old&&old.created||Date.now()},e.locked))
    .then(()=>{ if(E!==e)return; const u=URL.createObjectURL(res.png), o=e.urls.get(id); if(o)(e.old=e.old||[]).push(o); e.urls.set(id,u);
      qa(e.body,'img[data-blob="'+id+'"]').forEach(im=>{im.src=u;}); dropThumb(id); e.bump=true; markDirty(); toast('Sketch updated'); })
    .catch(err=>toast('Sketch not saved — '+storageErr(err)));
}

/* =====================================================================
   LOCK: AES-GCM 256; key from PBKDF2-SHA-256 (310,000 iterations, random 16-byte salt).
   The key is held only in memory — dropped after 5 min unused or 60 s in the background.
   ===================================================================== */
const ITER=310000, KEY_IDLE=5*MIN, KEY_BG=60e3, VERIFY='gr-notes-passcode-check-v1';
let KEY=null, keyUsed=0, keyT=0, fails=0, waitUntil=0;
const enc8=new TextEncoder(), dec8=new TextDecoder();
function b64(buf){const u=buf instanceof Uint8Array?buf:new Uint8Array(buf);let s='';for(let i=0;i<u.length;i+=0x8000)s+=String.fromCharCode.apply(null,u.subarray(i,i+0x8000));return btoa(s);}
function unb64(s){const b=atob(String(s||''));const u=new Uint8Array(b.length);for(let i=0;i<b.length;i++)u[i]=b.charCodeAt(i);return u;}
const rand=n=>crypto.getRandomValues(new Uint8Array(n));
const cryptoOK=()=>!!(W.crypto&&crypto.subtle&&crypto.getRandomValues);
async function deriveKey(pass,salt,iter){
  const base=await crypto.subtle.importKey('raw',enc8.encode(String(pass).normalize('NFC')),'PBKDF2',false,['deriveKey']);
  return crypto.subtle.deriveKey({name:'PBKDF2',salt,iterations:iter,hash:'SHA-256'},base,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
}
async function aesEnc(key,bytes){const iv=rand(12);return {iv:b64(iv),ct:await crypto.subtle.encrypt({name:'AES-GCM',iv},key,bytes)};}
function aesDec(key,o){const ct=typeof o.ct==='string'?unb64(o.ct):o.ct;return crypto.subtle.decrypt({name:'AES-GCM',iv:unb64(o.iv)},key,ct);}
function touchKey(){ if(!KEY)return; keyUsed=Date.now(); clearTimeout(keyT); keyT=setTimeout(idleCheck,KEY_IDLE+500); }
function keyOK(){ if(KEY&&Date.now()-keyUsed>KEY_IDLE){lockAll();return false;} if(KEY)touchKey(); return !!KEY; }
function idleCheck(){ if(KEY&&Date.now()-keyUsed>=KEY_IDLE)lockAll('Locked notes locked again after 5 minutes'); else if(KEY)touchKey(); }
async function verifyPass(pass,L){
  try{ const k=await deriveKey(pass,unb64(L.salt),L.iter||ITER); const pt=await aesDec(k,L.check); return dec8.decode(pt)===VERIFY?k:null; }catch(e){ return null; }
}
async function unlockWith(pass){
  if(!LOCK)throw new Error('No notes passcode has been set');
  if(Date.now()<waitUntil)throw new Error('Too many wrong tries — wait '+Math.ceil((waitUntil-Date.now())/1000)+' s');
  const k=await verifyPass(pass,LOCK);
  if(!k){ fails++; if(fails>=5)waitUntil=Date.now()+30e3*Math.pow(2,Math.min(4,fails-5)); throw new Error(fails>=5?'Wrong passcode — wait 30 s before trying again':'Wrong passcode'); }
  fails=0; KEY=k; touchKey(); return k;
}
async function newLockMeta(pass){
  const salt=rand(16), k=await deriveKey(pass,salt,ITER), c=await aesEnc(k,enc8.encode(VERIFY));
  return {k,meta:{id:'lock',v:1,salt:b64(salt),iter:ITER,check:{iv:c.iv,ct:b64(c.ct)},showTitles:!!(LOCK&&LOCK.showTitles),kid:uid('k')}};
}
/* save first (with the key), then forget the key and hide any open locked note */
let locking=null;
function lockAll(msg){
  if(!KEY)return Promise.resolve(); if(locking)return locking;
  locking=(async()=>{
    try{ if(SK&&E&&E.locked)await skSave(); }catch(e){}
    try{ await flush(); await saveQ; }catch(e){}
    KEY=null; clearTimeout(keyT);
    if(E&&E.locked){ const n=ALL.get(E.id)||E.rec; await leaveEditor(); if(ov&&!ov.hidden)lockView(n); }
    else if(S.view==='list'&&ov&&!ov.hidden)renderCards();
    if(msg&&ov&&!ov.hidden)toast(msg);
  })().finally(()=>{locking=null;});
  return locking;
}
async function sealNote(rec){
  if(!KEY)throw new Error('The note is locked — unlock it to save');
  const o=await aesEnc(KEY,enc8.encode(JSON.stringify({title:rec.title||'',html:rec.html||'',text:rec.text||''}))); touchKey();
  return Object.assign({},rec,{title:LOCK&&LOCK.showTitles?(rec.title||''):'',html:'',text:'',locked:true,enc:{v:1,iv:o.iv,ct:b64(o.ct)}});
}
async function decryptNote(rec){
  if(!KEY)throw new Error('locked');
  const d=JSON.parse(dec8.decode(await aesDec(KEY,rec.enc))); touchKey();
  return {title:String(d.title||''),html:sanitize(String(d.html||'')),text:String(d.text||'')};
}
const plainBlob=r=>{const o={id:r.id,note:r.note,kind:r.kind,type:r.type,w:r.w,h:r.h,created:r.created,data:r.data};if(r.thumb)o.thumb=r.thumb;if(r.strokes)o.strokes=r.strokes;return o;};
async function sealBlob(r){
  if(!KEY)throw new Error('The note is locked');
  const o={id:r.id,note:r.note,kind:r.kind,type:r.type,w:r.w,h:r.h,created:r.created};
  o.enc=await aesEnc(KEY,await r.data.arrayBuffer());
  if(r.thumb)o.encT=await aesEnc(KEY,await r.thumb.arrayBuffer());
  if(r.strokes)o.encS=await aesEnc(KEY,enc8.encode(typeof r.strokes==='string'?r.strokes:JSON.stringify(r.strokes)));
  touchKey(); return o;
}
async function openSealedBlob(r){
  if(!KEY)throw new Error('locked');
  const o={id:r.id,note:r.note,kind:r.kind,type:r.type,w:r.w,h:r.h,created:r.created};
  o.data=new Blob([await aesDec(KEY,r.enc)],{type:r.type||'image/jpeg'});
  if(r.encT)o.thumb=new Blob([await aesDec(KEY,r.encT)],{type:'image/jpeg'});
  if(r.encS)o.strokes=dec8.decode(await aesDec(KEY,r.encS));
  touchKey(); return o;
}
/* ---------- UI flows ---------- */
const PW_WARN='<p class="nts-warn">'+svg(IC.info)+'<span><b>If you forget it, locked notes can’t be recovered.</b> Nobody can open them without the passcode — not even from a backup.</span></p>';
function pwIn(cls,ph,ac){return '<input type="password" class="nts-in '+cls+'" placeholder="'+ph+'" aria-label="'+ph+'" autocomplete="'+(ac||'off')+'" autocapitalize="off" spellcheck="false" enterkeyhint="go">';}
function setPassSheet(then){
  if(!cryptoOK())return toast('Locking needs the app to be opened over https');
  sheet('<h3>'+svg(IC.lock)+' Set a notes passcode</h3><p class="nts-note">Used to lock notes on this phone. At least 4 characters — a longer passphrase is stronger.</p>'
    +pwIn('nts-p1','New passcode','new-password')+pwIn('nts-p2','Enter it again','new-password')+PW_WARN+'<p class="nts-err" hidden></p>'
    +'<div class="nts-row2"><button type="button" class="nts-go nts-ok">Set passcode</button><button type="button" class="nts-sec nts-x">Cancel</button></div>',r=>{
    const p1=q(r,'.nts-p1'), p2=q(r,'.nts-p2'), ok=q(r,'.nts-ok');
    const go=async()=>{ const a=p1.value, b=p2.value;
      if(a.length<4)return sErr('Use at least 4 characters.'); if(a!==b)return sErr('The two entries don’t match.');
      ok.disabled=true; ok.textContent='Setting…';
      try{ const {k,meta}=await newLockMeta(a); await dbPut('meta',meta); LOCK=meta; KEY=k; touchKey(); closeSheet(); toast('Notes passcode set'); if(then)then(); }
      catch(e){ ok.disabled=false; ok.textContent='Set passcode'; sErr(storageErr(e)); } };
    ok.onclick=go; p2.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();go();}}); p1.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();p2.focus();}});
    setTimeout(()=>p1.focus(),60);
  });
}
function askPass(title,then){
  sheet('<h3>'+svg(IC.lock)+' '+esc(title)+'</h3>'+pwIn('nts-p1','Notes passcode','current-password')+'<p class="nts-err" hidden></p>'
    +'<div class="nts-row2"><button type="button" class="nts-go nts-ok">Unlock</button><button type="button" class="nts-sec nts-x">Cancel</button></div>',r=>{
    const p=q(r,'.nts-p1'), ok=q(r,'.nts-ok');
    const go=async()=>{ ok.disabled=true; ok.textContent='Checking…';
      try{ await unlockWith(p.value); closeSheet(); if(then)then(); }catch(e){ ok.disabled=false; ok.textContent='Unlock'; p.select(); sErr(e.message); } };
    ok.onclick=go; p.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();go();}}); setTimeout(()=>p.focus(),60);
  });
}
function lockView(n){
  if(E)leaveEditor(); S.view='lock'; closeSheet(); setTop('Locked note',[]);
  mainEl.innerHTML='<div class="nts-lockv"><div class="nts-lockic">'+svg(IC.lock)+'</div><h2>'+esc(n.title||'Locked note')+'</h2>'
    +'<p class="nts-lsub">Edited '+esc(full(n.updated))+'</p><p>Enter your notes passcode to open this note.</p>'
    +'<form class="nts-lockf" autocomplete="off">'+pwIn('nts-pw','Notes passcode','current-password')+'<p class="nts-err" hidden></p>'
    +'<button type="submit" class="nts-go nts-wide">'+svg(IC.unlock)+' Unlock</button></form>'
    +'<p class="nts-note">Locked notes are encrypted on this phone. If you forget the passcode, they can’t be recovered.</p></div>';
  const f=q(mainEl,'.nts-lockf'), i=q(f,'.nts-pw'), er=q(f,'.nts-err'), b=q(f,'button');
  f.addEventListener('submit',async ev=>{ ev.preventDefault(); b.disabled=true; er.hidden=true;
    try{ await unlockWith(i.value); openNote(n.id); }catch(e){ b.disabled=false; er.textContent=e.message; er.hidden=false; i.select(); vib([30,40,30]); } });
  setTimeout(()=>{ if(S.view==='lock')i.focus(); },80);
}
function lockThisNote(){
  if(!E)return; if(!cryptoOK())return toast('Locking needs the app to be opened over https');
  if(!LOCK)return setPassSheet(()=>doLock());
  if(!keyOK())return askPass('Enter your notes passcode',()=>doLock());
  doLock();
}
async function doLock(){
  if(!E||E.locked)return; const e=E;
  try{
    e.dirty=true; await flush(); if(E!==e)return;
    const rec=await sealNote(Object.assign({},ALL.get(e.id)||e.rec,e.rec,{title:e.savedTitle,html:e.savedHtml,text:htmlText(e.savedHtml),locked:true}));
    const out=[]; for(const b of await blobsOf(e.id))out.push(b.enc?b:await sealBlob(b));
    await run(['notes','blobs'],'readwrite',t=>{t.objectStore('notes').put(rec);out.forEach(b=>t.objectStore('blobs').put(b));});
    ALL.set(rec.id,rec); e.isNew=false; e.locked=true; e.rec=Object.assign({},rec); if(E===e)infoLine();
    toast('Note locked — encrypted on this phone');
  }catch(err){ console.error(err); toast('Could not lock — '+storageErr(err)); }
}
function unlockNoteForever(){
  if(!E||!E.locked)return; if(!keyOK())return askPass('Enter your notes passcode',()=>unlockNoteForever());
  confirmSheet('Remove the lock?','This note will be stored unencrypted again, like your other notes.','Remove lock',false,async()=>{
    const e=E; if(!e)return;
    try{
      await flush(); const out=[]; for(const b of await blobsOf(e.id))out.push(b.enc?plainBlob(await openSealedBlob(b)):b);
      const rec=Object.assign({},ALL.get(e.id)||e.rec,{title:e.savedTitle,html:e.savedHtml,text:htmlText(e.savedHtml),locked:false,enc:null});
      await run(['notes','blobs'],'readwrite',t=>{t.objectStore('notes').put(rec);out.forEach(b=>t.objectStore('blobs').put(b));});
      ALL.set(rec.id,rec); e.locked=false; e.rec=Object.assign({},rec); if(E===e)infoLine(); toast('Lock removed');
    }catch(err){ console.error(err); toast('Could not remove the lock — '+storageErr(err)); }
  });
}
/* re-encrypt every locked note (and its images) under a new passcode, in one transaction */
async function changePass(oldP,newP){
  await flush(); await saveQ;
  const oldK=await verifyPass(oldP,LOCK); if(!oldK)throw new Error('The current passcode is wrong');
  const {k:newK,meta}=await newLockMeta(newP), N=[], B=[];
  for(const n of [...ALL.values()].filter(x=>x.locked&&x.enc)){
    const o=await aesEnc(newK,await aesDec(oldK,n.enc)); N.push(Object.assign({},n,{enc:{v:1,iv:o.iv,ct:b64(o.ct)}}));
    for(const b of await blobsOf(n.id)){ if(!b.enc)continue; const nb=Object.assign({},b); for(const f of ['enc','encT','encS'])if(b[f])nb[f]=await aesEnc(newK,await aesDec(oldK,b[f])); B.push(nb); }
  }
  await run(['notes','blobs','meta'],'readwrite',t=>{N.forEach(n=>t.objectStore('notes').put(n));B.forEach(b=>t.objectStore('blobs').put(b));t.objectStore('meta').put(meta);});
  N.forEach(n=>ALL.set(n.id,n)); LOCK=meta; KEY=newK; touchKey(); return N.length;
}
async function setShowTitles(on){
  const N=[];
  for(const n of [...ALL.values()].filter(x=>x.locked&&x.enc)){
    if(on){ const d=await decryptNote(n); N.push(Object.assign({},n,{title:d.title})); } else if(n.title)N.push(Object.assign({},n,{title:''}));
  }
  const meta=Object.assign({},LOCK,{showTitles:!!on});
  await run(['notes','meta'],'readwrite',t=>{N.forEach(n=>t.objectStore('notes').put(n));t.objectStore('meta').put(meta);});
  N.forEach(n=>ALL.set(n.id,n)); LOCK=meta; if(E&&E.locked)E.rec.title=on?E.savedTitle:'';
}

/* =====================================================================
   SETTINGS, BACKUP (export / import with merge), STORAGE NOTICE
   ===================================================================== */
function settingsSheet(){
  const nN=[...ALL.values()].filter(n=>!n.trashed).length, nL=[...ALL.values()].filter(n=>n.locked).length;
  const last=LSget('lastExport',0);
  sheet('<h3>'+svg(IC.settings)+' Notes settings</h3>'
    +'<div class="nts-stat"><b>'+plural(nN,'note')+'</b><span class="nts-stu">Checking storage…</span></div>'
    +'<h4 class="nts-sec">Backup</h4><div class="nts-two"><button type="button" class="nts-big" data-k="export">'+svg(IC.download)+'<span>Export all notes</span></button><button type="button" class="nts-big" data-k="import">'+svg(IC.upload)+'<span>Import backup</span></button></div>'
    +'<p class="nts-note">'+(last?'Last export '+esc(full(last))+'. ':'No backup exported from this phone yet. ')+'The backup is one .json file with every note and image. Locked notes stay encrypted inside it. Import merges: nothing is overwritten by an older copy.</p>'
    +'<h4 class="nts-sec">Lock</h4>'
    +(LOCK?'<div class="nts-two"><button type="button" class="nts-big" data-k="chpass">'+svg(IC.lock)+'<span>Change passcode</span></button><button type="button" class="nts-big" data-k="locknow"'+(KEY?'':' disabled')+'>'+svg(IC.lock)+'<span>'+(KEY?'Lock now':'Locked')+'</span></button></div>'
      +'<label class="nts-chk"><input type="checkbox" class="nts-st"'+(LOCK.showTitles?' checked':'')+'><span>Show titles of locked notes<small>Off: cards show “Locked note” and the title is encrypted too.</small></span></label>'
      +'<p class="nts-note">'+plural(nL,'locked note')+'. Unlocked notes lock again after 5 minutes unused, or 1 minute after you leave the app.</p>'
      +'<button type="button" class="nts-link nts-dang" data-k="reset">Forgot the passcode?</button>'
     :'<p class="nts-note">Lock a note from its ⋮ menu. The first time, you choose a notes passcode.</p><button type="button" class="nts-sec nts-wide" data-k="setpass">'+svg(IC.lock)+' Set notes passcode</button>')
    +'<h4 class="nts-sec">About</h4><button type="button" class="nts-sec nts-wide" data-k="notice">'+svg(IC.info)+' Where notes are saved</button>'
    +'<button type="button" class="nts-sec nts-x nts-wide">Close</button>',r=>{
    r.addEventListener('click',ev=>{ const b=ev.target.closest('[data-k]'); if(!b)return; const k=b.dataset.k;
      if(k==='export'){closeSheet();exportAll();} else if(k==='import'){closeSheet();importPick();}
      else if(k==='chpass')changePassSheet(); else if(k==='setpass')setPassSheet(()=>settingsSheet());
      else if(k==='locknow'){closeSheet();lockAll('Locked notes locked');}
      else if(k==='notice')noticeSheet(); else if(k==='reset')resetLockSheet(); });
    const st=q(r,'.nts-st'); if(st)st.addEventListener('change',()=>{ const on=st.checked; st.checked=!on;
      const go=()=>setShowTitles(on).then(()=>{toast(on?'Titles of locked notes are shown':'Titles of locked notes are hidden'); if(S.view==='list')renderCards(); settingsSheet();}).catch(e=>toast(storageErr(e)));
      if(on&&!keyOK())askPass('Enter your notes passcode',go); else go(); });
    storageLine(q(r,'.nts-stu'));
  });
}
function storageLine(elm){
  const sto=navigator.storage;
  Promise.all([sto&&sto.estimate?sto.estimate().catch(()=>null):null,sto&&sto.persisted?sto.persisted().catch(()=>null):null]).then(([es,pe])=>{
    if(!elm.isConnected)return;
    const mb=es&&es.usage!=null?(es.usage/1048576).toFixed(es.usage<10485760?1:0)+' MB used by the app':'';
    elm.textContent=[mb,pe===true?'protected from automatic clean-up':pe===false?'Chrome may clear it if the phone runs very low on space':''].filter(Boolean).join(' · ')||'Saved on this phone';
  });
}
function noticeSheet(){
  sheet('<h3>'+svg(IC.info)+' Saved on this phone only</h3>'+noticeHtml(false)+'<div class="nts-row2"><button type="button" class="nts-sec nts-exp">'+svg(IC.download)+' Export backup</button><button type="button" class="nts-go nts-x">OK</button></div>',
    r=>{q(r,'.nts-exp').onclick=()=>{closeSheet();exportAll();};});
  LSset('notice',1);
}
function changePassSheet(){
  sheet('<h3>'+svg(IC.lock)+' Change notes passcode</h3>'+pwIn('nts-p0','Current passcode','current-password')+pwIn('nts-p1','New passcode','new-password')+pwIn('nts-p2','New passcode again','new-password')
    +PW_WARN+'<p class="nts-err" hidden></p><div class="nts-row2"><button type="button" class="nts-go nts-ok">Change</button><button type="button" class="nts-sec nts-x">Cancel</button></div>',r=>{
    const ok=q(r,'.nts-ok');
    ok.onclick=async()=>{ const a=q(r,'.nts-p0').value, b=q(r,'.nts-p1').value, c=q(r,'.nts-p2').value;
      if(b.length<4)return sErr('Use at least 4 characters.'); if(b!==c)return sErr('The new passcodes don’t match.');
      ok.disabled=true; ok.textContent='Re-encrypting…';
      try{ const n=await changePass(a,b); closeSheet(); toast('Passcode changed — '+plural(n,'locked note')+' re-encrypted'); }
      catch(e){ ok.disabled=false; ok.textContent='Change'; sErr(e.message||String(e)); } };
    setTimeout(()=>q(r,'.nts-p0').focus(),60);
  });
}
function resetLockSheet(){
  const ids=[...ALL.values()].filter(n=>n.locked).map(n=>n.id);
  sheet('<h3>Forgot the passcode?</h3><p class="nts-note">Locked notes can’t be opened without it — not by the app, not by anyone. You can start again: this <b>permanently deletes '+plural(ids.length,'locked note')+'</b> and removes the passcode. Your other notes are not touched.</p>'
    +'<label class="nts-lab">Type DELETE to confirm</label><input class="nts-in nts-cf" autocomplete="off" autocapitalize="characters"><p class="nts-err" hidden></p>'
    +'<div class="nts-row2"><button type="button" class="nts-go nts-danger nts-ok">Delete locked notes</button><button type="button" class="nts-sec nts-x">Cancel</button></div>',r=>{
    q(r,'.nts-ok').onclick=async()=>{ if(q(r,'.nts-cf').value.trim().toUpperCase()!=='DELETE')return sErr('Type DELETE to confirm.');
      try{ if(E&&E.locked)await leaveEditor(); await deleteNotesHard(ids); await run(['meta'],'readwrite',t=>{t.objectStore('meta').delete('lock');}); LOCK=null; KEY=null;
        closeSheet(); if(S.view!=='list')toList(); else renderList(false); toast('Locked notes deleted — you can set a new passcode'); }catch(e){ sErr(storageErr(e)); } };
  });
}
/* ---------- export ---------- */
function blobB64(b){ return b.arrayBuffer().then(buf=>b64(buf)); }
async function exportAll(){
  try{
    await flush(); await saveQ; toast('Preparing backup…');
    const [notes,blobs]=await Promise.all([dbAll('notes'),dbAll('blobs')]), ids=new Set(notes.map(n=>n.id));
    const L=LOCK?{salt:LOCK.salt,iter:LOCK.iter,check:LOCK.check,kid:LOCK.kid,showTitles:!!LOCK.showTitles}:null;
    const parts=['{"format":"gr-notes-backup","v":1,"app":"Garda Reference — Notes","exported":'+Date.now()+',"folders":'+JSON.stringify(FOLDERS)+',"lock":'+JSON.stringify(L)+',"notes":['];
    notes.forEach((n,i)=>parts.push((i?',':'')+JSON.stringify(n)));
    parts.push('],"blobs":['); let k=0;
    for(const b of blobs){ if(!ids.has(b.note))continue;
      const o={id:b.id,note:b.note,kind:b.kind,type:b.type,w:b.w,h:b.h,created:b.created};
      if(b.data)o.data=await blobB64(b.data); if(b.thumb)o.thumb=await blobB64(b.thumb); if(b.strokes)o.strokes=typeof b.strokes==='string'?b.strokes:JSON.stringify(b.strokes);
      for(const f of ['enc','encT','encS'])if(b[f])o[f]={iv:b[f].iv,ct:typeof b[f].ct==='string'?b[f].ct:b64(b[f].ct)};
      parts.push((k++?',':'')+JSON.stringify(o)); }
    parts.push(']}');
    download(new Blob(parts,{type:'application/json'}),'garda-notes-backup_'+fileStamp(Date.now())+'.json'); LSset('lastExport',Date.now());
    toast('Exported '+plural(notes.length,'note')+' and '+plural(k,'image')+' to Downloads');
  }catch(e){ console.error(e); toast('Export failed — '+storageErr(e)); }
}
/* ---------- import (merge: skip duplicates by id, keep the newer "updated") ---------- */
function importPick(){
  const i=D.createElement('input'); i.type='file'; i.accept='.json,application/json'; i.className='nts-file'; ov.appendChild(i);
  i.addEventListener('change',()=>{const f=i.files&&i.files[0]; i.remove(); if(f)importFile(f);},{once:true});
  i.addEventListener('cancel',()=>i.remove(),{once:true}); i.click();
}
const okId=(s,min)=>typeof s==='string'&&new RegExp('^[A-Za-z0-9_-]{'+(min||2)+',64}$').test(s);
function cleanNoteIn(r,fmap){
  if(!r||!okId(r.id))return null; const now=Date.now(), num=(v,d)=>Number.isFinite(+v)&&+v>0?+v:d;
  const n={id:r.id,title:String(r.title||'').slice(0,300),html:'',text:'',folder:r.folder&&fmap.has(r.folder)?fmap.get(r.folder):null,color:TINTK.has(r.color)?r.color:'',
    pinned:!!r.pinned,created:num(r.created,now),updated:num(r.updated,now),trashed:r.trashed?num(r.trashed,now):null,locked:!!r.locked,enc:null};
  if(n.locked){ if(!r.enc||typeof r.enc.iv!=='string'||typeof r.enc.ct!=='string')return null; n.enc={v:1,iv:r.enc.iv,ct:r.enc.ct}; if(!(LOCK&&LOCK.showTitles))n.title=''; }
  else { n.html=sanitize(String(r.html||'')); n.text=htmlText(n.html); }
  return n;
}
function cleanBlobIn(b,nid){
  if(!b||!okId(b.id,4))return null;
  const o={id:b.id,note:nid,kind:b.kind==='sketch'?'sketch':'img',type:b.type==='image/png'?'image/png':'image/jpeg',w:+b.w||0,h:+b.h||0,created:+b.created||Date.now()};
  const ed=x=>x&&typeof x.iv==='string'&&typeof x.ct==='string'?{iv:x.iv,ct:unb64(x.ct).buffer}:null;
  if(b.enc){ o.enc=ed(b.enc); if(!o.enc)return null; const t=ed(b.encT),s=ed(b.encS); if(t)o.encT=t; if(s)o.encS=s; }
  else { if(typeof b.data!=='string')return null; o.data=new Blob([unb64(b.data)],{type:o.type}); if(typeof b.thumb==='string')o.thumb=new Blob([unb64(b.thumb)],{type:'image/jpeg'}); if(typeof b.strokes==='string')o.strokes=b.strokes.slice(0,8e6); }
  return o;
}
async function importFile(f){
  let d; try{ d=JSON.parse(await f.text()); }catch(e){ return toast('That file isn’t a Notes backup'); }
  if(!d||d.format!=='gr-notes-backup'||!Array.isArray(d.notes))return toast('That file isn’t a Notes backup');
  try{ await flush(); await saveQ; await load(true); }catch(e){ return toast(storageErr(e)); }
  const locked=d.notes.filter(n=>n&&n.locked&&n.enc), L=d.lock&&typeof d.lock.salt==='string'&&d.lock.check?d.lock:null;
  if(locked.length&&L&&LOCK&&LOCK.salt!==L.salt){
    return sheet('<h3>'+svg(IC.lock)+' Locked notes in this backup</h3><p class="nts-note">'+plural(locked.length,'locked note')+' in the backup use a different passcode from this phone. Enter the passcode that was used when the backup was made'+(KEY?'':', and your current notes passcode')+', to re-lock them with your current one.</p>'
      +pwIn('nts-p0','Backup passcode')+(KEY?'':pwIn('nts-p1','Current notes passcode','current-password'))+'<p class="nts-err" hidden></p>'
      +'<div class="nts-row2"><button type="button" class="nts-go nts-ok">Import all</button><button type="button" class="nts-sec nts-skip">Skip locked notes</button></div><button type="button" class="nts-sec nts-x nts-wide">Cancel</button>',r=>{
      q(r,'.nts-skip').onclick=()=>{closeSheet();doImport(d,null,true);};
      q(r,'.nts-ok').onclick=async()=>{ const ok=q(r,'.nts-ok'); ok.disabled=true;
        try{ const oldK=await verifyPass(q(r,'.nts-p0').value,L); if(!oldK)throw new Error('The backup passcode is wrong');
          if(!KEY)await unlockWith(q(r,'.nts-p1').value); closeSheet(); doImport(d,oldK,false); }
        catch(e){ ok.disabled=false; sErr(e.message); } };
    });
  }
  doImport(d,null,false);
}
async function doImport(d,oldK,skipLocked){
  try{
    const st={add:0,upd:0,same:0,bad:0,lk:0,img:0}, fmap=new Map(); let fchg=false;
    (Array.isArray(d.folders)?d.folders:[]).forEach(x=>{ if(!x||!okId(x.id)||!x.name)return; const nm=String(x.name).replace(/\s+/g,' ').trim().slice(0,40);
      const ex=FOLDERS.find(y=>y.id===x.id)||FOLDERS.find(y=>y.name.toLowerCase()===nm.toLowerCase());
      if(ex)fmap.set(x.id,ex.id); else { FOLDERS.push({id:x.id,name:nm,created:+x.created||Date.now()}); fmap.set(x.id,x.id); fchg=true; } });
    let adopt=null;
    if(d.lock&&!LOCK&&d.notes.some(n=>n&&n.locked)&&typeof d.lock.salt==='string'&&d.lock.check)
      adopt={id:'lock',v:1,salt:d.lock.salt,iter:+d.lock.iter||ITER,check:{iv:String(d.lock.check.iv),ct:String(d.lock.check.ct)},showTitles:!!d.lock.showTitles,kid:String(d.lock.kid||uid('k'))};
    const byNote=new Map(); (Array.isArray(d.blobs)?d.blobs:[]).forEach(b=>{ if(b&&okId(b.note)){ if(!byNote.has(b.note))byNote.set(b.note,[]); byNote.get(b.note).push(b);} });
    const N=[], B=[], dead=[];
    for(const raw of d.notes){
      const n=cleanNoteIn(raw,fmap); if(!n){st.bad++;continue;}
      const cur=ALL.get(n.id); if(cur&&!(n.updated>cur.updated)){st.same++;continue;}
      if(n.locked&&(skipLocked||(LOCK&&d.lock&&LOCK.salt!==d.lock.salt&&!oldK))){st.lk++;continue;}
      let bl=(byNote.get(n.id)||[]).map(b=>cleanBlobIn(b,n.id)).filter(Boolean);
      if(n.locked&&oldK){ const o=await aesEnc(KEY,await aesDec(oldK,n.enc)); n.enc={v:1,iv:o.iv,ct:b64(o.ct)};
        for(const b of bl)for(const k of ['enc','encT','encS'])if(b[k])b[k]=await aesEnc(KEY,await aesDec(oldK,b[k])); }
      if(cur){ const keep=new Set(bl.map(b=>b.id)); (await blobsOf(n.id)).forEach(b=>{if(!keep.has(b.id))dead.push(b.id);}); st.upd++; } else st.add++;
      N.push(n); B.push(...bl); st.img+=bl.length;
    }
    await run(['notes','blobs','meta'],'readwrite',t=>{ const bs=t.objectStore('blobs'); dead.forEach(id=>bs.delete(id)); N.forEach(n=>t.objectStore('notes').put(n)); B.forEach(b=>bs.put(b));
      if(fchg)t.objectStore('meta').put({id:'folders',list:FOLDERS}); if(adopt)t.objectStore('meta').put(adopt); });
    N.forEach(n=>ALL.set(n.id,n)); if(adopt)LOCK=adopt; askPersist();
    if(S.view==='list')renderList(false);
    const line=(n,w)=>n?'<li><b>'+n+'</b> '+w+'</li>':'';
    sheet('<h3>'+svg(IC.upload)+' Import finished</h3><ul class="nts-res">'+line(st.add,'new '+(st.add===1?'note':'notes')+' added')+line(st.upd,(st.upd===1?'note':'notes')+' updated with a newer copy')
      +line(st.same,'already here and up to date — skipped')+line(st.img,st.img===1?'image':'images')+line(st.lk,'locked '+(st.lk===1?'note':'notes')+' skipped')+line(st.bad,'damaged '+(st.bad===1?'entry':'entries')+' ignored')
      +(N.length||st.same||st.lk||st.bad?'':'<li>The backup had no notes.</li>')+'</ul>'+(adopt?'<p class="nts-note">Locked notes use the passcode from the backup — it is now this phone’s notes passcode.</p>':'')
      +'<button type="button" class="nts-go nts-x nts-wide">Done</button>');
  }catch(e){ console.error(e); toast('Import failed — '+(e&&e.name==='OperationError'?'the backup passcode didn’t match':storageErr(e))); }
}

/* =====================================================================
   LIFECYCLE + PUBLIC API
   ===================================================================== */
let hidAt=0, hidT=0;
const bgLimit=()=>E&&E.picking?5*MIN:KEY_BG;
D.addEventListener('visibilitychange',()=>{
  if(D.visibilityState==='hidden'){
    flush(); hidAt=Date.now(); clearTimeout(hidT);
    if(KEY)hidT=setTimeout(()=>{ if(D.visibilityState==='hidden')lockAll(); },bgLimit());
  } else {
    clearTimeout(hidT);
    if(KEY&&hidAt&&Date.now()-hidAt>bgLimit())lockAll('Locked notes were locked again');
    else if(KEY&&Date.now()-keyUsed>KEY_IDLE)lockAll('Locked notes locked again after 5 minutes');
    hidAt=0;
  }
});
W.addEventListener('pagehide',()=>{ flush(); });
/* home-screen strip: the n most recently edited notes (not deleted) */
function recent(n){
  n=Math.max(1,Math.min(50,+n||5));
  return run(['notes'],'readonly',(t,set)=>{
    const out=[], c=t.objectStore('notes').index('updated').openCursor(null,'prev');
    c.onsuccess=()=>{ const cur=c.result; if(!cur||out.length>=n){set(out);return;} const r=cur.value;
      if(!r.trashed){ const ci=cardInfo(r); out.push({id:r.id,title:ci.title,snippet:r.locked?'':ci.prev.replace(/\s*\n\s*/g,' · ').slice(0,140),updated:r.updated,locked:!!r.locked}); }
      cur.continue(); };
  }).catch(()=>[]);
}
W.openNotes=openNotes;
W.openNote=id=>openNote(id==null?undefined:id);
W.closeNotes=closeNotes;
W.ntsBack=ntsBack;
W.GRNotes=Object.freeze({recent,open:openNotes,openNote:id=>openNote(id==null?undefined:id)});
})();
