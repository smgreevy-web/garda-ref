/* Garda Reference — Present to TV.
   Show photos, CCTV clips and photographed documents full-screen on a TV through Samsung Smart View (screen mirroring),
   DeX (cable or wireless) or Cast. Photos: swipe, pinch-zoom and pan, double-tap zoom, red pointer dot, rotate.
   Videos: frame step, slow motion, fine scrub (0.01 s), ±5 s, zoom, Cast. Blank screen. Controls hide after 3 s.
   Items live only in memory (object URLs) while Present is open — nothing is stored or uploaded.
   Self-contained IIFE: no dependencies, no network. Styles in present.css (#prs / .prs scoped). */
(function(){
'use strict';
const W=window, D=document;
const FPS=25, ZMAX=8, DZOOM=2.5, UI_MS=3000, RATES=[0.25,0.5,1,2];

/* ---------- small helpers ---------- */
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const p2=n=>String(n).padStart(2,'0');
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const q=(r,s)=>r.querySelector(s), qa=(r,s)=>Array.from(r.querySelectorAll(s));
const svg=(p,cls)=>'<svg viewBox="0 0 24 24" aria-hidden="true"'+(cls?' class="'+cls+'"':'')+'>'+p+'</svg>';
function el(html){const t=D.createElement('template');t.innerHTML=html.trim();return t.content.firstElementChild;}
const vib=p=>{try{if(navigator.vibrate)navigator.vibrate(p);}catch(e){}};
const LSget=(k,d)=>{try{const v=localStorage.getItem('gr_prs_'+k);return v==null?d:JSON.parse(v);}catch(e){return d;}};
const LSset=(k,v)=>{try{localStorage.setItem('gr_prs_'+k,JSON.stringify(v));}catch(e){}};
const uid=()=>'p'+Date.now().toString(36)+Math.random().toString(36).slice(2,7);
const plural=(n,w)=>n+' '+w+(n===1?'':'s');
function durBadge(s){s=Math.max(0,Math.round(s||0));const h=Math.floor(s/3600),m=Math.floor(s/60)%60,x=s%60;return h?h+':'+p2(m)+':'+p2(x):m+':'+p2(x);}
function fmtT(t){ // 00:01.24 (to 0.01 s) — 1:02:03.45 past an hour
  if(!isFinite(t)||t<0)t=0; const cs=Math.floor(t*100+1e-4), h=Math.floor(cs/360000), m=Math.floor(cs/6000)%60, s=Math.floor(cs/100)%60, c=cs%100;
  return (h?h+':'+p2(m):p2(m))+':'+p2(s)+'.'+p2(c);
}
const fpsTxt=f=>(Math.round(f*100)/100)+' fps';
function hud(){try{if(W.grHudTick)W.grHudTick();}catch(e){}}
const IMGX=/\.(jpe?g|png|gif|webp|bmp|avif|heic|heif|tiff?)$/i, VIDX=/\.(mp4|m4v|mov|webm|mkv|3gp|avi|ts|mts|m2ts|wmv|dav)$/i;
const BADIMG='Chrome can’t display this picture’s format (for example HEIC). Save it as a JPEG in the Gallery and add it again.';
const BADVID='This video’s format can’t be played in Chrome. Export or convert the clip to MP4 (H.264) and add it again.';

/* ---------- icons (stroke line art, currentColor) ---------- */
const IC={
  plus:'<path d="M12 5v14M5 12h14"/>',
  lock:'<rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8 10.5V7.6a4 4 0 0 1 8 0v2.9M12 14.4v2.6"/>',
  tv:'<rect x="2.5" y="4.5" width="19" height="12.5" rx="1.8"/><path d="M8.5 20.5h7M12 17v3.5"/>',
  moon:'<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
  image:'<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9.5" r="1.8"/><path d="m21 15.5-5.2-5.2L5.5 20"/>',
  film:'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 4v16M17 4v16M3 8h4M3 12h4M3 16h4M17 8h4M17 12h4M17 16h4"/>',
  play:'<path d="M8 5.2v13.6L19 12z" fill="currentColor" stroke="none"/>',
  pause:'<rect x="6.3" y="5" width="4" height="14" rx="1.2" fill="currentColor" stroke="none"/><rect x="13.7" y="5" width="4" height="14" rx="1.2" fill="currentColor" stroke="none"/>',
  left:'<path d="M14.5 5.5 8 12l6.5 6.5"/>', right:'<path d="m9.5 5.5 6.5 6.5-6.5 6.5"/>',
  x:'<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>',
  trash:'<path d="M4 6.5h16M9.5 6.5V4.2h5v2.3M6 6.5l1 13.3a1.5 1.5 0 0 0 1.5 1.4h7a1.5 1.5 0 0 0 1.5-1.4l1-13.3M10 10.5v6.5M14 10.5v6.5"/>',
  warn:'<path d="M12 3.6 2.6 20h18.8z"/><path d="M12 10v4.6M12 17.3h.01" stroke-width="2"/>',
  exit:'<path d="M15 5l-7 7 7 7"/>',
  fit:'<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
  rot:'<path d="M20 12a8 8 0 1 1-2.4-5.7"/><path d="M20 3.8v4.7h-4.7"/>',
  laser:'<circle cx="12" cy="12" r="3.3" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="7.6"/><path d="M12 1.8v2.6M12 19.6v2.6M1.8 12h2.6M19.6 12h2.6"/>',
  blank:'<rect x="3" y="4.5" width="18" height="12.5" rx="1.8"/><path d="M8.5 20.5h7M4.2 4.8 19.8 16.7"/>',
  prev:'<path d="M15 4.5 7.5 12l7.5 7.5"/>', next:'<path d="m9 4.5 7.5 7.5L9 19.5"/>',
  fb:'<path d="M17.5 6v12l-8.5-6z" fill="currentColor" stroke="none"/><path d="M6.5 6v12" stroke-width="2.4"/>',
  ff:'<path d="M6.5 6v12l8.5-6z" fill="currentColor" stroke="none"/><path d="M17.5 6v12" stroke-width="2.4"/>',
  cast:'<path d="M3 17.6A3.4 3.4 0 0 1 6.4 21M3 13.6a7.4 7.4 0 0 1 7.4 7.4M3 9.7A11.3 11.3 0 0 1 14.3 21"/><path d="M3 7V5.5A1.5 1.5 0 0 1 4.5 4h15A1.5 1.5 0 0 1 21 5.5v13a1.5 1.5 0 0 1-1.5 1.5H17.5"/>'
};

/* =====================================================================
   OVERLAY SHELL
   ===================================================================== */
let ov=null, mainEl=null, showEl=null, shadeEl=null, sheetEl=null, toastEl=null, fileEl=null, toastT=0;
let ITEMS=[], S=null, undo=null, armT=0, armed=false;
function build(){
  if(ov&&ov.isConnected)return;
  if(!D.querySelector('link[href*="present.css"]')){const l=D.createElement('link');l.rel='stylesheet';l.href='present.css';D.head.appendChild(l);}
  ov=el('<div id="prs" class="prs" role="dialog" aria-modal="true" aria-label="Present to TV" tabindex="-1" hidden>'
    +'<div class="prs-top"><button type="button" class="prs-back" aria-label="Back">‹ Back</button>'
    +'<div class="prs-tt"><b class="prs-title">Present to TV</b><span class="hudclock" data-f="line"></span></div><span class="prs-tsp" aria-hidden="true"></span></div>'
    +'<div class="prs-main"></div><div class="prs-show" hidden></div>'
    +'<div class="prs-shade" hidden></div><div class="prs-sheet" role="dialog" aria-modal="true" hidden></div>'
    +'<div class="prs-toast" role="status" aria-live="polite"></div>'
    +'<input type="file" class="prs-file" accept="image/*,video/*" multiple tabindex="-1" aria-hidden="true"></div>');
  D.body.appendChild(ov);
  mainEl=q(ov,'.prs-main'); showEl=q(ov,'.prs-show'); shadeEl=q(ov,'.prs-shade'); sheetEl=q(ov,'.prs-sheet'); toastEl=q(ov,'.prs-toast'); fileEl=q(ov,'.prs-file');
  q(ov,'.prs-back').addEventListener('click',()=>prsBack());
  shadeEl.addEventListener('click',()=>closeSheet());
  fileEl.addEventListener('change',()=>{ const fs=Array.from(fileEl.files||[]); fileEl.value=''; if(fs.length)addFiles(fs); });
  mainEl.addEventListener('click',onHomeClick);
  mainEl.addEventListener('dragover',e=>{ if(e.dataTransfer&&Array.from(e.dataTransfer.types||[]).includes('Files')){e.preventDefault();e.dataTransfer.dropEffect='copy';} });
  mainEl.addEventListener('drop',e=>{ const fs=e.dataTransfer&&Array.from(e.dataTransfer.files||[]); if(fs&&fs.length){e.preventDefault();addFiles(fs);} });
}
function toast(m,act){
  if(!toastEl){if(W.grToast)W.grToast(m);return;}
  toastEl.innerHTML='<span>'+esc(m)+'</span>'+(act?'<button type="button" class="prs-tact">'+esc(act.label)+'</button>':'');
  toastEl.classList.toggle('prs-hasact',!!act); toastEl.classList.add('prs-on');
  if(act)q(toastEl,'.prs-tact').onclick=()=>{toastEl.classList.remove('prs-on');try{act.fn();}catch(e){console.error(e);}};
  clearTimeout(toastT); toastT=setTimeout(()=>toastEl&&toastEl.classList.remove('prs-on'),act?5200:3000);
}
function sheet(html,wire){
  sheetEl.innerHTML=''; const box=D.createElement('div'); box.className='prs-sin';
  box.innerHTML='<div class="prs-grip"></div>'+html; sheetEl.appendChild(box); sheetEl.hidden=false; shadeEl.hidden=false;
  qa(box,'.prs-x').forEach(b=>b.addEventListener('click',()=>closeSheet()));
  if(wire)wire(box); sheetEl.scrollTop=0;
}
function closeSheet(){ if(!sheetEl||sheetEl.hidden)return; sheetEl.hidden=true; sheetEl.innerHTML=''; shadeEl.hidden=true; }
let listening=false;
function listen(on){ if(on===listening)return; listening=on; W[on?'addEventListener':'removeEventListener']('keydown',onKey,true); }

/* phone Back: sheet → blank → show → list (press twice to close when items were added) → closed */
function prsBack(){
  if(!ov||ov.hidden||!ov.isConnected)return false;
  if(!sheetEl.hidden){closeSheet();return true;}
  if(S){ if(S.blank){setBlank(false);return true;} closeShow(); return true; }
  if(ITEMS.length&&!armed){ armed=true; clearTimeout(armT); armT=setTimeout(()=>{armed=false;},2800);
    toast('Press Back again to close — this clears the list (your files stay on the phone)'); return true; }
  closePresent(); return true;
}
function openPresent(){
  build(); const was=ov.hidden; ov.hidden=false; D.body.classList.add('prs-open'); listen(true);
  if(was){ armed=false; renderHome(); try{ov.focus({preventScroll:true});}catch(e){} }
  hud(); return true;
}
function closePresent(){
  if(!ov||ov.hidden)return true;
  closeShow(); closeSheet();
  ITEMS.forEach(drop); ITEMS=[]; if(undo){drop(undo.it);clearTimeout(undo.t);undo=null;}
  armed=false; clearTimeout(armT); clearTimeout(toastT); toastEl.classList.remove('prs-on');
  ov.hidden=true; D.body.classList.remove('prs-open'); listen(false); mainEl.innerHTML='';
  return true;
}
function drop(it){ it.dead=true; if(it.url){try{URL.revokeObjectURL(it.url);}catch(e){}} if(it.thumb){try{URL.revokeObjectURL(it.thumb);}catch(e){}} it.url=it.thumb=null; }

/* =====================================================================
   HOME: add, grid, reorder, remove, how-to
   ===================================================================== */
function kindOf(f){ const t=f.type||'', n=f.name||''; if(/^image\//.test(t))return 'img'; if(/^video\//.test(t))return 'vid'; if(IMGX.test(n))return 'img'; if(VIDX.test(n))return 'vid'; return null; }
function addFiles(files){
  let add=0,dup=0,skip=0;
  files.forEach(f=>{
    const kind=kindOf(f); if(!kind){skip++;return;}
    if(ITEMS.some(x=>x.file.name===f.name&&x.file.size===f.size&&x.file.lastModified===f.lastModified)){dup++;return;}
    const it={id:uid(),file:f,name:f.name||(kind==='img'?'Photo':'Video'),kind,url:URL.createObjectURL(f),thumb:null,dur:NaN,w:0,h:0,bad:'',rot:0,ready:false};
    ITEMS.push(it); add++; queueThumb(it);
  });
  renderHome();
  const m=[]; if(add)m.push('Added '+plural(add,'item')); if(dup)m.push(plural(dup,'item')+' already in the list'); if(skip)m.push(plural(skip,'file')+' skipped — not a photo or video');
  if(m.length)toast(m.join(' · '));
  if(add){ const g=q(mainEl,'.prs-tile:last-child'); if(g)setTimeout(()=>{try{g.scrollIntoView({block:'nearest',behavior:'smooth'});}catch(e){}},60); }
}
/* thumbnails, one at a time (phones have few video decoders) */
let thumbQ=Promise.resolve();
function queueThumb(it){ thumbQ=thumbQ.then(()=>it.dead?null:(it.kind==='img'?thumbImg(it):thumbVid(it))).catch(()=>{}).then(()=>{it.ready=true;paintTile(it);}); }
function toThumb(src,w,h){
  const k=Math.min(1,480/Math.max(1,w)), cw=Math.max(1,Math.round(w*k)), ch=Math.max(1,Math.round(h*k));
  const cv=D.createElement('canvas'); cv.width=cw; cv.height=ch; const c=cv.getContext('2d'); c.fillStyle='#000'; c.fillRect(0,0,cw,ch); c.drawImage(src,0,0,cw,ch);
  return new Promise((res,rej)=>{try{cv.toBlob(b=>b?res(b):rej(new Error('thumbnail')),'image/jpeg',0.82);}catch(e){rej(e);}});
}
function setThumb(it,blob){ if(!blob)return; if(it.dead)return; it.thumb=URL.createObjectURL(blob); }
function loadImg(u){ return new Promise((res,rej)=>{ const i=new Image(); i.decoding='async'; i.onload=()=>res(i); i.onerror=()=>rej(new Error('image')); i.src=u; }); }
async function thumbImg(it){
  let bmp=null;
  try{ if(W.createImageBitmap)bmp=await createImageBitmap(it.file,{resizeWidth:480,resizeQuality:'medium'}); }catch(e){bmp=null;}
  if(it.dead){ if(bmp&&bmp.close)bmp.close(); return; }
  if(bmp){ it.w=bmp.width; it.h=bmp.height; try{ setThumb(it,await toThumb(bmp,bmp.width,bmp.height)); }catch(e){} if(bmp.close)bmp.close(); return; }
  const img=await loadImg(it.url).catch(()=>null);
  if(it.dead)return;
  if(!img||!img.naturalWidth){ it.bad=BADIMG; return; }
  it.w=img.naturalWidth; it.h=img.naturalHeight; try{ setThumb(it,await toThumb(img,it.w,it.h)); }catch(e){}
  img.src='';
}
function thumbVid(it){
  return new Promise(res=>{
    const v=D.createElement('video'); let done=false;
    const fin=()=>{ if(done)return; done=true; clearTimeout(to); v.onloadedmetadata=v.onseeked=v.onerror=null; v.removeAttribute('src'); try{v.load();}catch(e){} res(); };
    const to=setTimeout(fin,10000);
    v.muted=true; v.preload='auto'; v.playsInline=true; v.setAttribute('playsinline','');
    v.onerror=()=>{ if(!it.dead)it.bad=BADVID; fin(); };
    v.onloadedmetadata=()=>{
      if(it.dead){fin();return;}
      it.dur=v.duration; it.w=v.videoWidth; it.h=v.videoHeight;
      if(!it.w){ it.bad='Chrome can’t show the picture in this video. Export or convert the clip to MP4 (H.264) and add it again.'; fin(); return; }
      const t=isFinite(v.duration)&&v.duration>0?Math.min(1,v.duration/2):0;      // a frame at 1 s (or mid-clip if shorter)
      try{v.currentTime=t;}catch(e){fin();}
    };
    v.onseeked=()=>{ toThumb(v,v.videoWidth,v.videoHeight).then(b=>setThumb(it,b)).catch(()=>{}).then(fin); };
    v.src=it.url;
  });
}
function countTxt(){
  const n=ITEMS.length, im=ITEMS.filter(x=>x.kind==='img').length, vd=n-im;
  return plural(n,'item')+(im&&vd?' · '+plural(im,'photo')+' · '+plural(vd,'video'):'');
}
function tileHtml(it,i){
  const n=ITEMS.length;
  return '<div class="prs-tile'+(it.bad?' prs-bad':'')+(it.ready?'':' prs-wait')+'" data-id="'+esc(it.id)+'">'
    +'<button type="button" class="prs-th" data-a="open" aria-label="Show item '+(i+1)+': '+esc(it.name)+'">'
      +(it.thumb?'<img alt="" src="'+esc(it.thumb)+'" draggable="false">':'<span class="prs-ph">'+svg(it.kind==='vid'?IC.film:IC.image)+'</span>')
      +'<b class="prs-no">'+(i+1)+'</b>'
      +(it.kind==='vid'?'<span class="prs-dur">'+svg(IC.play)+(isFinite(it.dur)&&it.dur>0?durBadge(it.dur):'Video')+'</span>':'')
      +(it.bad?'<span class="prs-badm">'+svg(IC.warn)+'Can’t show</span>':'')
    +'</button>'
    +'<div class="prs-tn" title="'+esc(it.name)+'">'+esc(it.name)+'</div>'
    +'<div class="prs-tb"><button type="button" data-a="up" aria-label="Move earlier"'+(i===0?' disabled':'')+'>'+svg(IC.left)+'</button>'
    +'<button type="button" data-a="down" aria-label="Move later"'+(i===n-1?' disabled':'')+'>'+svg(IC.right)+'</button>'
    +'<button type="button" class="prs-rm" data-a="rm" aria-label="Remove from the list">'+svg(IC.x)+'</button></div></div>';
}
function howHtml(){
  const open=LSget('how',1)!==0;
  return '<details class="prs-how"'+(open?' open':'')+'><summary>'+svg(IC.tv)+'<span>How to show it on the TV</span></summary><div class="prs-howb">'
    +'<div class="prs-dnd">'+svg(IC.moon)+'<p><b>Turn on Do Not Disturb first</b> so messages and calls don’t pop up on the TV — it shows everything on your screen. Swipe down from the top of the screen and tap <b>Do not disturb</b>.</p></div>'
    +'<ol class="prs-steps">'
    +'<li><b>Smart View</b> (wireless): swipe down twice from the top of the screen → <b>Smart View</b> → pick the TV. The TV must be on and able to take screen mirroring. If Smart View isn’t in the panel, add it with the panel’s edit button.</li>'
    +'<li><b>DeX</b>: connect a USB-C to HDMI cable, or tap <b>DeX</b> in quick settings and pick the TV. The app then opens on the TV screen.</li>'
    +'<li><b>Turn the phone sideways</b> for a full-width picture. Present switches to landscape by itself where the phone allows it.</li>'
    +'<li>Tap <b>Start presentation</b> or any item. Tap the picture to show the controls — they hide again after 3 seconds.</li></ol>'
    +'<p class="prs-hn"><b>Screen stays on while presenting.</b> <b>Blank</b> shows a fully black screen while you find the next item — tap anywhere to come back.</p>'
    +'<p class="prs-hn"><b>Photos:</b> swipe for next / previous · pinch or double-tap to zoom · drag to move around · <b>Pointer</b> shows a red dot where you touch, to point things out on the TV · <b>Rotate</b> turns the picture 90°.</p>'
    +'<p class="prs-hn"><b>Videos (CCTV):</b> ◀| |▶ steps one frame (25 fps unless the clip shows otherwise) · 0.25× / 0.5× slow motion · drag the bar to scrub — time to 0.01 s. <b>Cast</b> appears when a Chromecast or cast-ready TV is nearby; the TV then plays the clip itself.</p>'
    +'<p class="prs-hn"><b>Keyboard or presenter remote</b> (DeX): ← → next / previous · B blank · Space play / pause · , and . frame step · Esc exit.</p>'
    +'</div></details>';
}
function renderHome(){
  if(!mainEl)return;
  const sc0=q(mainEl,'.prs-scroll'), keep=sc0?sc0.scrollTop:0;
  let h='<div class="prs-home"><div class="prs-scroll"><div class="prs-wrap">'
    +'<button type="button" class="prs-add" data-a="add">'+svg(IC.plus)+'<span>Add photos &amp; videos</span></button>'
    +'<p class="prs-mem">'+svg(IC.lock)+'<span>Only in this phone’s memory while Present is open — nothing is copied, stored or uploaded. Closing Present clears this list; your files stay where they are.</span></p>'
    +'<div class="prs-list">'+listHtml()+'</div>'+howHtml()+'</div></div>'
    +'<div class="prs-dock"'+(ITEMS.length?'':' hidden')+'><button type="button" class="prs-start" data-a="start"'+(ITEMS.length?'':' disabled')+'>'+svg(IC.play)+'<span>Start presentation</span></button></div></div>';
  mainEl.innerHTML=h;
  q(mainEl,'.prs-scroll').scrollTop=keep;
  q(mainEl,'.prs-how').addEventListener('toggle',e=>LSset('how',e.target.open?1:0));
  hud();
}
function listHtml(){
  if(!ITEMS.length)return '<div class="prs-empty">'+svg(IC.tv)+'<b>Nothing added yet</b><span>Add the photos, CCTV clips or photographed documents you want to show. They stay on this phone.</span></div>';
  return '<div class="prs-bar"><span class="prs-count">'+esc(countTxt())+'</span><button type="button" class="prs-clear" data-a="clear">'+svg(IC.trash)+'<span>Clear all</span></button></div>'
    +'<div class="prs-grid">'+ITEMS.map(tileHtml).join('')+'</div>';
}
function paintList(){ const L=mainEl&&q(mainEl,'.prs-list'); if(!L){renderHome();return;} L.innerHTML=listHtml(); const st=q(mainEl,'.prs-start'); if(st)st.disabled=!ITEMS.length; const dk=q(mainEl,'.prs-dock'); if(dk)dk.hidden=!ITEMS.length; }
function paintTile(it){
  if(!mainEl||!ov||ov.hidden)return;
  const t=q(mainEl,'.prs-tile[data-id="'+it.id+'"]'), i=ITEMS.indexOf(it); if(!t||i<0)return;
  t.replaceWith(el(tileHtml(it,i)));
}
function move(id,d,a){
  const i=ITEMS.findIndex(x=>x.id===id), j=i+d; if(i<0||j<0||j>=ITEMS.length)return;
  const [x]=ITEMS.splice(i,1); ITEMS.splice(j,0,x); paintList(); vib(10);
  const t=q(mainEl,'.prs-tile[data-id="'+id+'"]'); if(!t)return;
  t.classList.add('prs-moved'); setTimeout(()=>t.classList.remove('prs-moved'),650);
  const b=q(t,'[data-a="'+a+'"]'); if(b&&!b.disabled)b.focus({preventScroll:true}); else { const o=q(t,'[data-a="'+(a==='up'?'down':'up')+'"]'); if(o)o.focus({preventScroll:true}); }
  try{t.scrollIntoView({block:'nearest'});}catch(e){}
}
function removeItem(id){
  const i=ITEMS.findIndex(x=>x.id===id); if(i<0)return;
  const it=ITEMS.splice(i,1)[0]; paintList();
  if(undo){clearTimeout(undo.t);drop(undo.it);}
  const u=undo={it,i,t:setTimeout(()=>{ if(undo===u){drop(it);undo=null;} },6000)};
  toast('Removed “'+it.name+'”',{label:'Undo',fn:()=>{ if(undo!==u)return; clearTimeout(u.t); undo=null; ITEMS.splice(Math.min(u.i,ITEMS.length),0,it); paintList(); }});
}
function clearAll(){
  sheet('<h3>'+svg(IC.trash)+' Clear the list?</h3><p class="prs-note">Removes all '+esc(plural(ITEMS.length,'item'))+' from Present. The photos and videos stay on your phone.</p>'
    +'<div class="prs-row2"><button type="button" class="prs-go prs-danger prs-ok">Clear all</button><button type="button" class="prs-b2 prs-x">Cancel</button></div>',r=>{
      q(r,'.prs-ok').onclick=()=>{ closeSheet(); ITEMS.forEach(drop); ITEMS=[]; if(undo){clearTimeout(undo.t);drop(undo.it);undo=null;} paintList(); toast('List cleared'); };
    });
}
function onHomeClick(e){
  const a=e.target.closest('[data-a]'); if(!a||!mainEl.contains(a)||a.disabled)return;
  const k=a.dataset.a, t=a.closest('.prs-tile'), id=t&&t.dataset.id;
  if(k==='add'){ fileEl.value=''; fileEl.click(); }
  else if(k==='clear')clearAll();
  else if(k==='start'){ if(ITEMS.length)openShow(0); }
  else if(k==='open'){ const i=ITEMS.findIndex(x=>x.id===id); if(i>=0)openShow(i); }
  else if(k==='up')move(id,-1,'up');
  else if(k==='down')move(id,1,'down');
  else if(k==='rm')removeItem(id);
}

/* =====================================================================
   SHOW VIEW: full screen, no chrome
   ===================================================================== */
function openShow(i){
  if(!ITEMS.length)return;
  if(S)closeShow();
  closeSheet(); clearTimeout(toastT); toastEl.classList.remove('prs-on');
  S={i:clamp(i,0,ITEMS.length-1),s:1,tx:0,ty:0,sx:0,W:0,H:0,nw:0,nh:0,fw:0,fh:0,bw:0,bh:0,rot:0,blank:false,laser:false,uiT:0,lzT:0,
    media:null,v:null,vfc:0,castId:null,fps:FPS,fpsDet:false,deltas:[],frameT:null,target:null,pend:null,onFrame:null,scrub:false,fs:false,pre:[]};
  showEl.innerHTML='<div class="prs-sv prs-nocur">'
    +'<div class="prs-stage"></div><div class="prs-laser" aria-hidden="true"></div>'
    +'<div class="prs-ui">'
      +'<div class="prs-utop">'
        +'<button type="button" class="prs-ub prs-exit" data-c="exit" aria-label="Exit the presentation">'+svg(IC.exit)+'<span>Exit</span></button>'
        +'<div class="prs-meta"><b class="prs-cnt"></b><span class="prs-nm"></span></div>'
        +'<button type="button" class="prs-ub prs-fit" data-c="fit" aria-label="Fit to the screen">'+svg(IC.fit)+'<span>Fit</span></button>'
        +'<button type="button" class="prs-ub prs-rot" data-c="rot" aria-label="Rotate 90 degrees">'+svg(IC.rot)+'<span>Rotate</span></button>'
        +'<button type="button" class="prs-ub prs-lz" data-c="laser" aria-pressed="false" aria-label="Pointer dot">'+svg(IC.laser)+'<span>Pointer</span></button>'
        +'<button type="button" class="prs-ub prs-bk" data-c="blank" aria-label="Blank the screen">'+svg(IC.blank)+'<span>Blank</span></button>'
      +'</div>'
      +'<button type="button" class="prs-nav prs-prev" data-c="prev" aria-label="Previous item">'+svg(IC.prev)+'</button>'
      +'<button type="button" class="prs-nav prs-next" data-c="next" aria-label="Next item">'+svg(IC.next)+'</button>'
      +'<div class="prs-vbar">'
        +'<div class="prs-scrub" role="slider" tabindex="0" aria-label="Position in the clip" aria-valuemin="0"><div class="prs-trk"><i class="prs-fill"></i><i class="prs-knob"></i></div></div>'
        +'<div class="prs-vrow">'
          +'<span class="prs-time"><b class="prs-tc">00:00.00</b><span class="prs-td">/ 00:00.00</span><small class="prs-fps"></small></span>'
          +'<div class="prs-vbtns">'
            +'<button type="button" class="prs-vb prs-txt" data-c="b5" aria-label="Back 5 seconds">−5 s</button>'
            +'<button type="button" class="prs-vb" data-c="fb" aria-label="Previous frame">'+svg(IC.fb)+'</button>'
            +'<button type="button" class="prs-vb prs-pp" data-c="pp" aria-label="Play">'+svg(IC.play)+'</button>'
            +'<button type="button" class="prs-vb" data-c="ff" aria-label="Next frame">'+svg(IC.ff)+'</button>'
            +'<button type="button" class="prs-vb prs-txt" data-c="f5" aria-label="Forward 5 seconds">+5 s</button>'
          +'</div>'
          +'<div class="prs-rates" role="group" aria-label="Playback speed">'+RATES.map(r=>'<button type="button" data-r="'+r+'"'+(r===1?' class="prs-on"':'')+'>'+r+'×</button>').join('')+'</div>'
          +'<button type="button" class="prs-vb prs-cast" data-c="cast" aria-label="Cast this clip to a TV" hidden>'+svg(IC.cast)+'<span>Cast</span></button>'
        +'</div>'
      +'</div>'
    +'</div>'
    +'<div class="prs-blank" hidden></div></div>';
  ov.classList.add('prs-showing'); showEl.hidden=false;
  wireShow();
  D.addEventListener('fullscreenchange',onFsChange); D.addEventListener('webkitfullscreenchange',onFsChange);
  W.addEventListener('resize',onResize);
  enterFs(); wakeWant(true);
  showItem(S.i,0); showUI();
}
function closeShow(){
  if(!S)return;
  const idx=S.i;
  clearTimeout(S.uiT); clearTimeout(S.lzT); teardownMedia(); S.pre.forEach(im=>{im.onload=im.onerror=null;im.src='';});
  S=null;
  D.removeEventListener('fullscreenchange',onFsChange); D.removeEventListener('webkitfullscreenchange',onFsChange);
  W.removeEventListener('resize',onResize);
  wakeWant(false); exitFs(); unlockOrient();
  showEl.hidden=true; showEl.innerHTML=''; ov.classList.remove('prs-showing');
  const it=ITEMS[idx], t=it&&mainEl&&q(mainEl,'.prs-tile[data-id="'+it.id+'"]'); if(t){try{t.scrollIntoView({block:'nearest'});}catch(e){}}
  hud();
}
const sv=()=>q(showEl,'.prs-sv');
function showItem(i,dir){
  if(!S)return; const it=ITEMS[i]; if(!it)return;
  teardownMedia();
  S.i=i; S.s=1; S.tx=S.ty=S.sx=0; S.nw=S.nh=0; S.rot=it.rot||0;
  const stage=q(showEl,'.prs-stage'); stage.innerHTML='';
  q(showEl,'.prs-cnt').textContent=(i+1)+' / '+ITEMS.length; q(showEl,'.prs-nm').textContent=it.name;
  const root=sv(); root.classList.toggle('prs-isvid',it.kind==='vid'); root.classList.toggle('prs-isimg',it.kind==='img'); root.classList.toggle('prs-isbad',!!it.bad);
  root.classList.remove('prs-zoomed');
  q(showEl,'.prs-prev').disabled=i===0; q(showEl,'.prs-next').disabled=i===ITEMS.length-1;
  if(it.bad||!it.url){ badMsg(it); return; }
  const cls='prs-media'+(dir>0?' prs-fromr':dir<0?' prs-froml':'');
  if(it.kind==='img'){
    const img=D.createElement('img'); img.className=cls; img.alt=''; img.draggable=false; img.decoding='async';
    img.onload=()=>{ if(!S||S.media!==img)return; S.nw=img.naturalWidth; S.nh=img.naturalHeight; layout(); img.classList.add('prs-in'); };
    img.onerror=()=>{ if(!S||S.media!==img)return; it.bad=BADIMG; showItem(S.i,0); };
    S.media=img; stage.appendChild(img); img.src=it.url;
    preload(i+1); preload(i-1);
  } else {
    const v=D.createElement('video'); v.className=cls; v.playsInline=true; v.setAttribute('playsinline',''); v.preload='auto'; v.disablePictureInPicture=true;
    S.media=v; S.v=v; S.hasVFC=typeof v.requestVideoFrameCallback==='function';
    v.addEventListener('loadedmetadata',()=>{ if(!S||S.v!==v)return; S.nw=v.videoWidth; S.nh=v.videoHeight;
      if(!S.nw){ it.bad='Chrome can’t show the picture in this video. Export or convert the clip to MP4 (H.264) and add it again.'; showItem(S.i,0); return; }
      if(!isFinite(it.dur))it.dur=v.duration; layout(); v.classList.add('prs-in'); paintTime(); });
    v.addEventListener('seeked',()=>{ if(!S||S.v!==v)return; if(S.pend!=null){const t=S.pend;S.pend=null;try{v.currentTime=t;}catch(e){}return;} S.target=null; paintTime(); });
    ['play','pause','ratechange','durationchange','loadeddata'].forEach(ev=>v.addEventListener(ev,()=>{ if(S&&S.v===v)paintTime(); }));
    v.addEventListener('ended',()=>{ if(S&&S.v===v){paintTime();showUI();} });
    v.addEventListener('timeupdate',()=>{ if(S&&S.v===v&&(!S.hasVFC||v.paused))paintTime(); });
    v.addEventListener('error',()=>{ if(!S||S.v!==v)return; it.bad=BADVID; showItem(S.i,0); });
    stage.appendChild(v); v.src=it.url;
    if(S.hasVFC){ const cb=(now,md)=>{ if(!S||S.v!==v)return; onFrame(md); S.vfc=v.requestVideoFrameCallback(cb); }; S.vfc=v.requestVideoFrameCallback(cb); }
    castWatch(v); paintRate(); showUI();
  }
}
function badMsg(it){
  const stage=q(showEl,'.prs-stage');
  stage.innerHTML='<div class="prs-msg">'+svg(IC.warn)+'<b>'+esc(it.name)+'</b><span>'+esc(it.bad||'This item can’t be shown.')+'</span></div>';
  showUI();
}
function teardownMedia(){
  if(!S)return;
  const v=S.v;
  if(v){
    try{v.pause();}catch(e){}
    if(S.vfc&&v.cancelVideoFrameCallback){try{v.cancelVideoFrameCallback(S.vfc);}catch(e){}}
    if(S.castId!=null&&v.remote&&v.remote.cancelWatchAvailability){try{v.remote.cancelWatchAvailability(S.castId).catch(()=>{});}catch(e){}}
    if(v.remote){v.remote.onconnect=v.remote.ondisconnect=v.remote.onconnecting=null;}
    v.removeAttribute('src'); try{v.load();}catch(e){}
  }
  if(S.media&&S.media.tagName==='IMG'){S.media.onload=S.media.onerror=null;S.media.removeAttribute('src');}
  S.media=null; S.v=null; S.vfc=0; S.castId=null; S.pend=null; S.target=null; S.onFrame=null; S.frameT=null; S.deltas=[]; S.lastPF=null; S.lastMT=null;
  S.fps=FPS; S.fpsDet=false; S.stepTry=0; S.scrub=false;
}
function preload(i){
  const it=ITEMS[i]; if(!S||!it||it.kind!=='img'||it.bad||!it.url)return;
  if(S.pre.some(im=>im._id===it.id))return;
  const im=new Image(); im._id=it.id; im.decoding='async'; im.src=it.url; S.pre.push(im);
  while(S.pre.length>3){const o=S.pre.shift();o.src='';}
}
function go(i,dir){ if(!S||i<0||i>=ITEMS.length||i===S.i)return; laserOff(); showItem(i,dir); }

/* ---------- fit, zoom, pan ---------- */
function layout(){
  if(!S||!S.media||!S.nw)return;
  const st=q(showEl,'.prs-stage'), w=st.clientWidth, h=st.clientHeight; if(!w||!h)return;
  S.W=w; S.H=h;
  const sw=S.rot%180!==0, vw=sw?S.nh:S.nw, vh=sw?S.nw:S.nh, k=Math.min(w/vw,h/vh);
  S.fw=S.nw*k; S.fh=S.nh*k; S.bw=vw*k; S.bh=vh*k;
  const m=S.media; m.style.width=S.fw+'px'; m.style.height=S.fh+'px'; m.style.left=((w-S.fw)/2)+'px'; m.style.top=((h-S.fh)/2)+'px';
  clampT(); apply();
}
function apply(){
  if(!S||!S.media)return;
  S.media.style.transform='translate3d('+(S.tx+S.sx).toFixed(2)+'px,'+S.ty.toFixed(2)+'px,0) scale('+S.s.toFixed(4)+') rotate('+S.rot+'deg)';
  const z=S.s>1.01, r=sv(); if(r&&r.classList.contains('prs-zoomed')!==z)r.classList.toggle('prs-zoomed',z);
}
function clampT(){ const mx=Math.max(0,(S.bw*S.s-S.W)/2), my=Math.max(0,(S.bh*S.s-S.H)/2); S.tx=clamp(S.tx,-mx,mx); S.ty=clamp(S.ty,-my,my); }
function setAnim(on){ if(S&&S.media)S.media.classList.toggle('prs-anim',!!on); }
function zoomAt(ns,px,py,anim){
  if(!S||!S.nw)return;
  ns=clamp(ns,1,ZMAX); const cx=S.W/2+S.tx, cy=S.H/2+S.ty;
  S.tx=px-(px-cx)*ns/S.s-S.W/2; S.ty=py-(py-cy)*ns/S.s-S.H/2; S.s=ns;
  if(ns<=1.001){S.s=1;S.tx=0;S.ty=0;}
  clampT(); setAnim(anim); apply();
}
function settle(){ if(!S)return; setAnim(true); if(S.s<1.01){S.s=1;S.tx=0;S.ty=0;}else{S.s=Math.min(S.s,ZMAX);clampT();} S.sx=0; apply(); }
function onResize(){ if(!S)return; S.s=1; S.tx=S.ty=S.sx=0; setAnim(false); layout(); }

/* ---------- gestures: tap = controls · double-tap = 2.5× · pinch = zoom · drag = pan / swipe / pointer ---------- */
function wireShow(){
  const root=sv(), st=q(root,'.prs-stage'), ui=q(root,'.prs-ui'), P=new Map();
  let g=null, lastTap=null, tapT=0, mvT=0;
  const pt=e=>{const r=st.getBoundingClientRect();return {x:e.clientX-r.left,y:e.clientY-r.top};};
  const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y), mid=(a,b)=>({x:(a.x+b.x)/2,y:(a.y+b.y)/2});
  function tap(p){
    const now=performance.now();
    if(lastTap&&now-lastTap.t<320&&Math.hypot(p.x-lastTap.x,p.y-lastTap.y)<42){ clearTimeout(tapT); lastTap=null; if(S&&S.media&&S.nw)zoomAt(S.s>1.05?1:DZOOM,p.x,p.y,true); return; }
    lastTap={t:now,x:p.x,y:p.y};
    if(!uiOn())showUI(); else { clearTimeout(tapT); tapT=setTimeout(()=>{ if(lastTap&&lastTap.t===now)hideUI(); },330); }
  }
  st.addEventListener('pointerdown',e=>{
    if(!S)return; if(e.pointerType==='mouse'&&e.button!==0)return;
    e.preventDefault();
    const p=pt(e); P.set(e.pointerId,p); try{st.setPointerCapture(e.pointerId);}catch(_){}
    setAnim(false);
    if(P.size===1){ g={k:'one',id:e.pointerId,x0:p.x,y0:p.y,t0:performance.now(),tx0:S.tx,ty0:S.ty,moved:false,axis:null,laser:S.laser&&!!S.media}; if(g.laser)laserAt(p.x,p.y); }
    else if(P.size===2){ const [a,b]=[...P.values()]; g={k:'pinch',d0:Math.max(1,dist(a,b)),m0:mid(a,b),s0:S.s,tx0:S.tx,ty0:S.ty}; S.sx=0; laserOff(); clearTimeout(tapT); lastTap=null; }
  });
  st.addEventListener('pointermove',e=>{
    if(!S)return;
    if(!P.has(e.pointerId)){ if(e.pointerType==='mouse'){const n=performance.now();if(n-mvT>250){mvT=n;showUI();}} return; }
    const p=pt(e); P.set(e.pointerId,p); if(!g)return;
    if(g.k==='one'&&e.pointerId===g.id){
      const dx=p.x-g.x0, dy=p.y-g.y0;
      if(!g.moved&&Math.hypot(dx,dy)>8)g.moved=true;
      if(g.laser){laserAt(p.x,p.y);return;}
      if(!g.moved||!S.media)return;
      if(S.s>1.01){ S.tx=g.tx0+dx; S.ty=g.ty0+dy; clampT(); apply(); }
      else if(ITEMS.length>1){
        if(g.axis==null&&Math.hypot(dx,dy)>12)g.axis=Math.abs(dx)>Math.abs(dy)?'x':'y';
        if(g.axis==='x'){ const edge=(dx>0&&S.i===0)||(dx<0&&S.i===ITEMS.length-1); S.sx=edge?dx*0.3:dx; apply(); }
      }
    } else if(g.k==='pinch'&&P.size>=2&&S.nw){
      const [a,b]=[...P.values()], d=dist(a,b), m=mid(a,b), ns=clamp(g.s0*d/g.d0,0.5,ZMAX);
      const cx0=S.W/2+g.tx0, cy0=S.H/2+g.ty0, ux=(g.m0.x-cx0)/g.s0, uy=(g.m0.y-cy0)/g.s0;
      S.s=ns; S.tx=m.x-ux*ns-S.W/2; S.ty=m.y-uy*ns-S.H/2; apply();
    }
  });
  const up=e=>{
    if(!P.has(e.pointerId))return; const p=P.get(e.pointerId); P.delete(e.pointerId); try{st.releasePointerCapture(e.pointerId);}catch(_){}
    if(!S||!g)return;
    if(g.k==='pinch'){
      if(P.size===1){ const [id,q1]=[...P.entries()][0]; g={k:'one',id,x0:q1.x,y0:q1.y,t0:performance.now(),tx0:S.tx,ty0:S.ty,moved:true,axis:'p',laser:false}; if(S.s<1)settle(); return; }
      if(!P.size){g=null;settle();} return;
    }
    if(g.k!=='one'||e.pointerId!==g.id)return;
    const dx=p.x-g.x0, dt=performance.now()-g.t0, gg=g; g=null;
    if(e.type==='pointercancel'){ S.sx=0; settle(); return; }
    if(gg.laser){ laserFade(); if(!gg.moved&&dt<300)tap(p); return; }
    if(!gg.moved&&dt<350){ tap(p); return; }
    if(S.s<=1.01&&gg.axis==='x'){
      const fast=Math.abs(dx)>50&&Math.abs(dx)/Math.max(1,dt)>0.45;
      if(Math.abs(dx)>S.W*0.18||fast){ if(dx<0&&S.i<ITEMS.length-1){go(S.i+1,1);return;} if(dx>0&&S.i>0){go(S.i-1,-1);return;} }
    }
    settle();
  };
  st.addEventListener('pointerup',up); st.addEventListener('pointercancel',up);
  st.addEventListener('wheel',e=>{ if(!S||!S.nw)return; e.preventDefault(); const p=pt(e); zoomAt(S.s*Math.exp(-e.deltaY*0.0018),p.x,p.y,false); },{passive:false});
  st.addEventListener('contextmenu',e=>e.preventDefault());
  // controls layer
  ui.addEventListener('pointerdown',e=>{ if(e.target.closest('button,.prs-scrub')){ clearTimeout(tapT); lastTap=null; showUI(); } });
  ui.addEventListener('click',e=>{
    const r=e.target.closest('[data-r]'); if(r){setRate(+r.dataset.r);return;}
    const b=e.target.closest('[data-c]'); if(!b||b.disabled||!S)return;
    const c=b.dataset.c, it=ITEMS[S.i];
    if(c==='exit')closeShow();
    else if(c==='prev')go(S.i-1,-1);
    else if(c==='next')go(S.i+1,1);
    else if(c==='fit'){ if(S.nw)zoomAt(1,S.W/2,S.H/2,true); }
    else if(c==='rot'){ if(it&&it.kind==='img'&&S.nw){ it.rot=((it.rot||0)+90)%360; S.rot=it.rot; S.s=1; S.tx=S.ty=0; setAnim(true); layout(); } }
    else if(c==='laser'){ S.laser=!S.laser; b.classList.toggle('prs-on',S.laser); b.setAttribute('aria-pressed',S.laser?'true':'false'); sv().classList.toggle('prs-lzon',S.laser); if(!S.laser)laserOff(); }
    else if(c==='blank')setBlank(true);
    else if(c==='pp')togglePlay();
    else if(c==='b5')seekBy(-5);
    else if(c==='f5')seekBy(5);
    else if(c==='fb')frameStep(-1);
    else if(c==='ff')frameStep(1);
    else if(c==='cast')castPrompt();
  });
  wireScrub(q(root,'.prs-scrub'));
  const bk=q(root,'.prs-blank');
  bk.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();});
  bk.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();setBlank(false);});
}
function uiOn(){ const r=S&&sv(); return !!(r&&q(r,'.prs-ui').classList.contains('prs-on')); }
function showUI(){ if(!S||S.blank)return; const r=sv(); if(!r)return; q(r,'.prs-ui').classList.add('prs-on'); r.classList.remove('prs-nocur'); clearTimeout(S.uiT); S.uiT=setTimeout(hideUI,UI_MS); }
function hideUI(){ if(!S)return; clearTimeout(S.uiT); if(S.scrub){S.uiT=setTimeout(hideUI,800);return;} const r=sv(); if(!r)return; q(r,'.prs-ui').classList.remove('prs-on'); r.classList.add('prs-nocur'); }
function setBlank(on){
  if(!S)return; S.blank=!!on; const b=q(showEl,'.prs-blank'); b.hidden=!on;
  if(on){ if(S.v&&!S.v.paused)S.v.pause(); hideUI(); laserOff(); } else showUI();
}
function laserAt(x,y){ const l=q(showEl,'.prs-laser'); if(!l)return; l.style.transform='translate3d('+x.toFixed(1)+'px,'+y.toFixed(1)+'px,0)'; l.classList.add('prs-lon'); clearTimeout(S.lzT); }
function laserFade(){ clearTimeout(S.lzT); S.lzT=setTimeout(laserOff,1400); }
function laserOff(){ const l=showEl&&q(showEl,'.prs-laser'); if(l)l.classList.remove('prs-lon'); }

/* ---------- video: play, seek, frame step, rate, cast ---------- */
function curT(){ const v=S&&S.v; if(!v)return 0; return S.pend!=null?S.pend:S.target!=null?S.target:v.currentTime; }
function seek(t){
  const v=S&&S.v; if(!v||!isFinite(v.duration))return;
  t=clamp(t,0,Math.max(0,v.duration-0.001)); S.target=t;
  if(v.seeking)S.pend=t; else {try{v.currentTime=t;}catch(e){}}
  paintTime();
}
function seekBy(d){ const v=S&&S.v; if(!v)return; seek(curT()+d); }
function togglePlay(){
  const v=S&&S.v; if(!v)return;
  if(v.paused||v.ended){ const p=v.play(); if(p&&p.catch)p.catch(e=>{ if(e&&e.name!=='AbortError')toast('Can’t play this clip: '+(e.message||e.name)); }); }
  else v.pause();
}
function frameStep(dir){
  const v=S&&S.v; if(!v||!isFinite(v.duration))return;
  const was=!v.paused; if(was)v.pause();
  if(dir>0&&typeof v.seekToNextFrame==='function'&&S.target==null){ v.seekToNextFrame().then(paintTime).catch(()=>{}); return; }
  S.stepTry=0; stepOnce(dir,was?null:S.frameT);
}
function stepOnce(dir,before){
  const v=S.v, fps=S.fps||FPS, t=curT(), n=Math.floor(t*fps+1e-3);
  const tgt=clamp((n+dir)/fps+0.001,0,Math.max(0,v.duration-0.001));
  S.onFrame=null;
  if(Math.abs(tgt-t)<1e-6)return;
  seek(tgt);
  // requestVideoFrameCallback reports the frame the seek landed on: if a clip is slower than the assumed 25 fps and the same
  // picture comes back, step again (at most 3 more times) so every tap shows a new frame
  if(S.hasVFC&&before!=null)S.onFrame={tgt,fn:mt=>{ if(S&&S.v===v&&Math.abs(mt-before)<1e-4&&++S.stepTry<4)stepOnce(dir,before); }};
}
function onFrame(md){
  const v=S.v; S.frameT=md.mediaTime;
  if(!v.paused&&S.lastPF!=null&&md.presentedFrames===S.lastPF+1&&S.lastMT!=null){
    const d=md.mediaTime-S.lastMT; if(d>0.004&&d<0.5){S.deltas.push(d);if(S.deltas.length>48)S.deltas.shift();if(S.deltas.length>=12)detectFps();}
  }
  S.lastPF=md.presentedFrames; S.lastMT=md.mediaTime;
  if(S.onFrame&&S.pend==null&&Math.abs(v.currentTime-S.onFrame.tgt)<2e-3){const f=S.onFrame;S.onFrame=null;f.fn(md.mediaTime);}
  paintTime();
}
function detectFps(){
  const a=S.deltas.slice().sort((x,y)=>x-y), med=a[a.length>>1]; if(!med)return;
  if(a.filter(d=>Math.abs(d-med)/med<0.06).length/a.length<0.8)return;
  const f=1/med; let best=null;
  [8,10,12,12.5,15,20,23.976,24,25,29.97,30,48,50,59.94,60].forEach(s=>{ if(Math.abs(s-f)/s<0.04&&(best==null||Math.abs(s-f)<Math.abs(best-f)))best=s; });
  if(best&&best!==S.fps){S.fps=best;S.fpsDet=true;paintTime();}
}
function setRate(r){ const v=S&&S.v; if(!v||!RATES.includes(r))return; v.playbackRate=r; v.defaultPlaybackRate=r; paintRate(); }
function paintRate(){ const v=S&&S.v, r=v?v.playbackRate:1; qa(showEl,'.prs-rates button').forEach(b=>{const on=Math.abs(+b.dataset.r-r)<1e-6;b.classList.toggle('prs-on',on);b.setAttribute('aria-pressed',on?'true':'false');}); }
function paintTime(){
  if(!S||!S.v)return; const v=S.v, r=sv(); if(!r)return;
  const d=isFinite(v.duration)?v.duration:0, t=curT();
  const tc=q(r,'.prs-tc'), s1=fmtT(t); if(tc._s!==s1){tc._s=s1;tc.textContent=s1;}
  const td=q(r,'.prs-td'), s2='/ '+(d>0?fmtT(d):'--:--.--'); if(td._s!==s2){td._s=s2;td.textContent=s2;}
  const fp=q(r,'.prs-fps'), s3=fpsTxt(S.fps)+(S.fpsDet?'':' (assumed)'); if(fp._s!==s3){fp._s=s3;fp.textContent=s3;}
  const pct=d>0?clamp(t/d*100,0,100):0; q(r,'.prs-fill').style.width=pct+'%'; q(r,'.prs-knob').style.left=pct+'%';
  const sc=q(r,'.prs-scrub'); sc.setAttribute('aria-valuemax',d.toFixed(2)); sc.setAttribute('aria-valuenow',t.toFixed(2)); sc.setAttribute('aria-valuetext',s1);
  const pp=q(r,'.prs-pp'), on=!v.paused&&!v.ended; if(pp._s!==on){pp._s=on;pp.innerHTML=svg(on?IC.pause:IC.play);pp.setAttribute('aria-label',on?'Pause':'Play');}
}
function wireScrub(sc){
  let drag=null, was=false;
  const frac=e=>{const r=q(sc,'.prs-trk').getBoundingClientRect();return clamp((e.clientX-r.left)/Math.max(1,r.width),0,1);};
  sc.addEventListener('pointerdown',e=>{ const v=S&&S.v; if(!v||!isFinite(v.duration))return; e.preventDefault(); drag=e.pointerId; S.scrub=true;
    try{sc.setPointerCapture(e.pointerId);}catch(_){} was=!v.paused; if(was)v.pause(); seek(frac(e)*v.duration); sc.classList.add('prs-drag'); showUI(); });
  sc.addEventListener('pointermove',e=>{ if(drag!==e.pointerId||!S||!S.v)return; seek(frac(e)*S.v.duration); });
  const end=e=>{ if(drag!==e.pointerId)return; drag=null; sc.classList.remove('prs-drag'); try{sc.releasePointerCapture(e.pointerId);}catch(_){}
    if(S){ S.scrub=false; if(was&&S.v){const p=S.v.play();if(p&&p.catch)p.catch(()=>{});} showUI(); } };
  sc.addEventListener('pointerup',end); sc.addEventListener('pointercancel',end);
  sc.addEventListener('keydown',e=>{ if(!S||!S.v)return; const k=e.key;
    if(k==='ArrowLeft'||k==='ArrowRight'){e.preventDefault();e.stopPropagation();if(e.shiftKey)seekBy(k==='ArrowLeft'?-5:5);else frameStep(k==='ArrowLeft'?-1:1);} });
}
function castWatch(v){
  const b=q(showEl,'.prs-cast'); if(!b)return; b.hidden=true;
  const rp=v.remote; if(!rp||typeof rp.watchAvailability!=='function')return;
  const paint=()=>{ if(!S||S.v!==v)return; const on=rp.state==='connected'||rp.state==='connecting'; b.classList.toggle('prs-on',on); q(b,'span').textContent=rp.state==='connected'?'On TV':rp.state==='connecting'?'Connecting…':'Cast'; };
  rp.onconnecting=paint; rp.onconnect=paint; rp.ondisconnect=paint;
  try{ rp.watchAvailability(av=>{ if(S&&S.v===v){ b.hidden=!av; paint(); } })
    .then(id=>{ if(S&&S.v===v)S.castId=id; else rp.cancelWatchAvailability(id).catch(()=>{}); }).catch(()=>{ b.hidden=true; }); }
  catch(e){ b.hidden=true; }
}
function castPrompt(){ const v=S&&S.v; if(!v||!v.remote)return; try{ v.remote.prompt().catch(e=>{ if(e&&e.name!=='AbortError'&&e.name!=='NotAllowedError')toast('Cast isn’t available: '+(e.message||e.name)); }); }catch(e){} }

/* ---------- full screen, landscape, screen on ---------- */
const fsEl=()=>D.fullscreenElement||D.webkitFullscreenElement||null;
function enterFs(){
  const rq=ov.requestFullscreen||ov.webkitRequestFullscreen; if(!rq)return;
  try{ const p=rq.call(ov,{navigationUI:'hide'}); if(p&&p.then)p.then(()=>{ if(S)lockOrient(); else exitFs(); }).catch(()=>{}); }catch(e){}
}
function exitFs(){ if(!fsEl())return; const x=D.exitFullscreen||D.webkitExitFullscreen; try{ const p=x&&x.call(D); if(p&&p.catch)p.catch(()=>{}); }catch(e){} }
function onFsChange(){ if(!S)return; if(fsEl()===ov)S.fs=true; else if(S.fs){ S.fs=false; closeShow(); } }   // left full screen with the system gesture → back to the list
function lockOrient(){ try{ const o=screen.orientation; if(o&&o.lock){ const p=o.lock('landscape'); if(p&&p.catch)p.catch(()=>{}); } }catch(e){} }
function unlockOrient(){ try{ const o=screen.orientation; if(o&&o.unlock)o.unlock(); }catch(e){} }
let wl=null, wlWant=false, wlBusy=false;
function wakeWant(on){ wlWant=!!on; if(on)wakeReq(); else if(wl){const l=wl;wl=null;l.release().catch(()=>{});} }
function wakeReq(){
  if(!wlWant||wl||wlBusy||!navigator.wakeLock||D.visibilityState!=='visible')return; wlBusy=true;
  navigator.wakeLock.request('screen').then(l=>{ wlBusy=false; if(!wlWant){l.release().catch(()=>{});return;} wl=l; l.addEventListener('release',()=>{if(wl===l)wl=null;}); }).catch(()=>{wlBusy=false;});
}
D.addEventListener('visibilitychange',()=>{ if(D.visibilityState==='visible')wakeReq(); else if(S&&S.v&&!S.v.paused&&!(S.v.remote&&S.v.remote.state==='connected'))S.v.pause(); });

/* ---------- keyboard (DeX keyboard, presenter remotes) ---------- */
function onKey(e){
  if(!ov||ov.hidden||e.ctrlKey||e.metaKey||e.altKey)return;
  const k=e.key;
  if(S){
    if(S.blank){ if(k!=='Shift'){e.preventDefault();setBlank(false);} return; }
    if(k==='Escape'){e.preventDefault();closeShow();return;}
    if(e.target&&e.target.closest&&e.target.closest('.prs-scrub')&&(k==='ArrowLeft'||k==='ArrowRight'))return;
    let hit=true;
    if(k==='ArrowRight'||k==='PageDown')go(S.i+1,1);
    else if(k==='ArrowLeft'||k==='PageUp')go(S.i-1,-1);
    else if(k==='b'||k==='B'||(k==='.'&&!S.v))setBlank(true);
    else if((k===' '||k==='k')&&S.v)togglePlay();
    else if(k===','&&S.v)frameStep(-1);
    else if(k==='.'&&S.v)frameStep(1);
    else if((k==='+'||k==='=')&&S.nw)zoomAt(S.s*1.25,S.W/2,S.H/2,true);
    else if(k==='-'&&S.nw)zoomAt(S.s/1.25,S.W/2,S.H/2,true);
    else if(k==='0'&&S.nw)zoomAt(1,S.W/2,S.H/2,true);
    else hit=false;
    if(hit)e.preventDefault();
    return;
  }
  if(k==='Escape'){e.preventDefault();e.stopPropagation();prsBack();}
}

W.openPresent=openPresent; W.closePresent=closePresent; W.prsBack=prsBack;
})();
