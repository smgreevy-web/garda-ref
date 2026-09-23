/* Garda Reference — OSINT field-intelligence map.
   Real, public-source tools only. No fake feeds, no private-system access.
   Everything here needs signal; the rest of the app stays offline. */
'use strict';
(function(){
const DUB=[53.3498,-6.2603];
const $=s=>document.querySelector(s);
const CCTVKEY='gr_cctv_v1';
let map=null, built=false, flightLayer=null, cctvLayer=null, nightLayer=null;
let cctv=load(); let placing=false; let flightsOn=false; let flightTimer=null;

function load(){try{return JSON.parse(localStorage.getItem(CCTVKEY)||'[]');}catch(e){return [];}}
function save(){try{localStorage.setItem(CCTVKEY,JSON.stringify(cctv));}catch(e){}}
function esc(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function toast(m){let t=$('#osToast');if(!t){t=document.createElement('div');t.id='osToast';document.body.appendChild(t);}t.textContent=m;t.className='show';clearTimeout(t._h);t._h=setTimeout(()=>t.className='',3200);}

// ---- rail line-icons (osiris-style, stroke = currentColor) ----
const _sv=p=>'<svg viewBox="0 0 24 24" class="ri">'+p+'</svg>';
const RIC={
  garda:_sv('<path d="M12 2.6 19 5.2V11c0 4.9-3 8.4-7 9.8C8 19.4 5 15.9 5 11V5.2Z"/><path d="M9 7.2c4.4 1 4.2 8.2 0 11.2M9 7.2v11.2" stroke-width="1.2"/>'),
  dist:_sv('<path d="M12 3 3 7.5l9 4.5 9-4.5Z"/><path d="M3 12l9 4.5L21 12"/><path d="M3 16.5 12 21l9-4.5"/>'),
  cam:_sv('<rect x="3" y="7.5" width="12" height="9.5" rx="2"/><path d="M15 10.6 21 8v8l-6-2.6Z"/>'),
  air:_sv('<path d="M12 2.7c.7 0 1 .6 1 1.4v4.7l7 4v2l-7-2v4.4l2 1.4V20l-3-1-3 1v-1.4l2-1.4V12.8l-7 2v-2l7-4V4.1c0-.8.3-1.4 1-1.4Z"/>'),
  bus:_sv('<rect x="4" y="4" width="16" height="13" rx="2"/><path d="M4 11h16M4 8h16"/><circle cx="8" cy="20" r="1.3"/><circle cx="16" cy="20" r="1.3"/>'),
  log:_sv('<rect x="5" y="4.5" width="14" height="16" rx="2"/><path d="M9 4.5h6v3H9Z"/><path d="M8.5 11.5h7M8.5 15h7"/>'),
  pin:_sv('<path d="M12 21s7-6.3 7-11.3A7 7 0 0 0 5 9.7C5 14.7 12 21 12 21Z"/><circle cx="12" cy="9.6" r="2.3"/>'),
  me:_sv('<circle cx="12" cy="12" r="7"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3"/><circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none"/>'),
  traffic:_sv('<path d="M12 3v18" stroke-dasharray="0 0"/><rect x="4.5" y="4.5" width="9" height="3.6" rx="1"/><rect x="10.5" y="10.2" width="9" height="3.6" rx="1"/><rect x="4.5" y="15.9" width="9" height="3.6" rx="1"/>'),
  cctv:_sv('<rect x="2.5" y="7" width="11" height="5.5" rx="1.2"/><path d="M13.5 8.6 20.5 6.5v7.5l-7-2.1Z"/><path d="M7.5 12.5v4.5"/><path d="M4.5 17h6"/>')
};
// ---- build overlay once ----
function build(){
  if(built)return;
  const o=document.createElement('div'); o.id='osint'; o.className='hidden';
  o.innerHTML=`
   <div class="os-header">
     <div class="os-brand"><span class="oseye">◎</span><div><b>GARDA · OSINT</b><small>FIELD INTELLIGENCE</small></div></div>
     <div class="os-statusline" id="osStatus">INITIALISING…</div>
     <div class="os-hact">
       <input id="osSearch" type="search" placeholder="SEARCH LOCATION…" autocomplete="off">
       <button id="osLinks" class="os-ic" title="OSINT links">☰</button>
       <button id="osBack" class="os-ic" title="Close" aria-label="Close">✕</button>
     </div>
   </div>
   <div id="osmap">
     <div class="os-rail">
       <button class="os-r" id="osGarda">${RIC.garda}<em>GARDA</em><i class="rbadge" id="bGarda">96</i></button>
       <button class="os-r on" id="osDist">${RIC.dist}<em>DIST</em><i class="rbadge" id="bDist">96</i></button>
       <button class="os-r" id="osCams">${RIC.cam}<em>CAMS</em><i class="rbadge" id="bCams">7</i></button>
       <button class="os-r" id="osDcc">${RIC.cctv}<em>DCC</em><i class="rbadge" id="bDcc">241</i></button>
       <button class="os-r" id="osFlights">${RIC.air}<em>AIR</em></button>
       <button class="os-r" id="osTransport">${RIC.bus}<em>TRANSIT</em></button>
       <button class="os-r" id="osTraffic">${RIC.traffic}<em>TRAFFIC</em></button>
       <button class="os-r" id="osList">${RIC.log}<em>LOG</em><i class="rbadge" id="bLog">${cctv.length}</i></button>
       <button class="os-r" id="osCam">${RIC.pin}<em>PIN</em></button>
       <button class="os-r" id="osLoc">${RIC.me}<em>ME</em></button>
     </div>
     <div class="os-mode">
       <button id="osModeStreet" class="on">🗺 MAP</button>
       <button id="osModeTac">◐ TACTICAL</button>
       <button id="osModeSat">✦ SAT</button>
     </div>
     <div class="os-statusbar">
       <span id="osCursor">CURSOR ——</span><span class="sep">·</span>
       <span id="osZoom">ZOOM ——</span><span class="sep">·</span>
       <span class="dim">DUBLIN · IRELAND</span>
     </div>
   </div>
   <div id="osPanel" class="os-panel hidden"></div>
   <div class="os-caution">⚠️ PUBLIC-SOURCE INTELLIGENCE ONLY — sustained monitoring of an identifiable person can become directed surveillance under GDPR / the LED. Obtain authorisation or it may be inadmissible.</div>`;
  document.body.appendChild(o);
  $('#osBack').addEventListener('click',close);
  $('#osLinks').addEventListener('click',showLinks);
  $('#osSearch').addEventListener('keydown',e=>{if(e.key==='Enter')geocode(e.target.value);});
  $('#osModeStreet').addEventListener('click',()=>setBase('street'));
  $('#osModeTac').addEventListener('click',()=>setBase('tactical'));
  $('#osModeSat').addEventListener('click',()=>setBase('sat'));
  $('#osCam').addEventListener('click',togglePlace);
  $('#osFlights').addEventListener('click',toggleFlights);
  $('#osLoc').addEventListener('click',locate);
  $('#osList').addEventListener('click',showList);
  $('#osGarda').addEventListener('click',toggleGarda);
  $('#osDist').addEventListener('click',toggleDist);
  $('#osCams').addEventListener('click',toggleCams);
  $('#osDcc').addEventListener('click',toggleDcc);
  $('#osTransport').addEventListener('click',showTransport);
  $('#osTraffic').addEventListener('click',toggleTraffic);
  startClock();
  built=true;
}
let _clk=null;
function startClock(){
  if(_clk)clearInterval(_clk);
  const upd=()=>{
    const d=new Date();
    const z=d.toISOString().substr(11,8);
    const on=navigator.onLine;
    const st=$('#osStatus');
    const nly=(distOn?1:0)+(gardaOn?1:0)+(camsOn?1:0)+(flightsOn?1:0)+(cctv&&cctv.length?1:0);
    if(st)st.innerHTML='ZULU <b>'+z+'Z</b> <span class="sdot '+(on?'live':'off')+'"></span>'+(on?'LIVE':'OFFLINE')+
      ' · <b>96</b> STN · <b>'+(DISTRICTS?DISTRICTS.features.length:'—')+'</b> DIST · <b>'+nly+'</b> LYR';
  };
  upd(); _clk=setInterval(upd,1000);
}
let baseLight,baseStreets,baseSat,baseLabels,onSat=false,baseMode='street';
let gardaLayer=null,camsLayer=null,STATIONS=[],LIVECAMS=[],TIICAMS=[],gardaOn=false,camsOn=false,_tiiMerged=false;
let DCCCAMS=[],dccLayer=null,dccOn=false;
// merge TII motorway cams into the cam set once both files are in
function mergeTii(){
  if(_tiiMerged || !LIVECAMS.length || !TIICAMS.length) return;
  LIVECAMS = LIVECAMS.concat(TIICAMS); _tiiMerged=true;
  const bc=document.querySelector('#bCams'); if(bc)bc.textContent=LIVECAMS.length;
  if(camsOn && map){ camsOn=false; toggleCams(); }   // re-plot with the full set + two icons
}
let districtLayer=null,districtLabels=null,DISTRICTS=null,distOn=false,_divmap=null,_featShown=false;
const HOME_DIST='Fitzgibbon Street'; // Mountjoy Station's district — highlighted as "your patch"
function initMap(){
  if(map)return;
  map=L.map('osmap',{zoomControl:false,attributionControl:true}).setView(DUB,14);
  L.control.zoom({position:'bottomright'}).addTo(map);
  // DEFAULT: the original street map (standard OpenStreetMap, keyless).
  baseLight=L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    {maxZoom:19,subdomains:'abc',attribution:'© OpenStreetMap'});
  // OPTION: dark tactical (Esri Dark Gray, keyless, no watermark; overzoom past 16).
  baseStreets=L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
    {maxNativeZoom:16,maxZoom:19,attribution:'Tiles © Esri'});
  // OPTION: satellite (Esri World Imagery).
  baseSat=L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    {maxNativeZoom:19,maxZoom:19,attribution:'Imagery © Esri'});
  baseLabels=null;
  baseLight.addTo(map);   // start on the normal map
  // tactical grid overlay
  const grid=document.createElement('div'); grid.className='os-grid'; 
  const mc=document.querySelector('#osmap'); if(mc)mc.appendChild(grid);
  L.control.scale({imperial:false,position:'bottomright'}).addTo(map);
  cctvLayer=L.layerGroup().addTo(map);
  flightLayer=L.layerGroup();
  gardaLayer=L.layerGroup();
  camsLayer=L.layerGroup();
  fetch('data/garda_districts.geojson').then(r=>r.json()).then(d=>{DISTRICTS=d;const b=$('#bDist');if(b)b.textContent=d.features.length;autoDefaults();}).catch(()=>{const b=$('#osDist');if(b){b.classList.remove('on');}});
  fetch('data/garda_stations.json').then(r=>r.json()).then(d=>{STATIONS=d;autoDefaults();}).catch(()=>{});
  fetch('data/livecams.json').then(r=>r.json()).then(d=>{LIVECAMS=d;mergeTii();autoDefaults();}).catch(()=>{});
  fetch('data/tii_cams.json').then(r=>r.json()).then(d=>{TIICAMS=d;mergeTii();}).catch(()=>{});
  fetch('data/dcc_cams.json').then(r=>r.json()).then(d=>{DCCCAMS=d;const b=$('#bDcc');if(b)b.textContent=d.length;}).catch(()=>{});
  drawCameras();
  // drawing / measuring tools — collapsed into a single drop-down toggle
  try{
    map.pm.addControls({position:'topright',drawCircleMarker:false,rotateMode:false,
      drawText:false,cutPolygon:false});
    map.pm.setLang('en');
    map.on('pm:create',e=>{
      const l=e.layer; const t=e.shape;
      if(t==='Line'){const m=measureLine(l);l.bindPopup('Distance: '+m).openPopup();}
      if(t==='Polygon'){const a=measureArea(l);l.bindPopup('Area: '+a).openPopup();}
    });
    // drop-down toggle button that shows/hides the draw tools
    const mc=document.querySelector('#osmap');
    const dt=document.createElement('button'); dt.className='os-drawtoggle'; dt.title='Draw & measure';
    dt.innerHTML='<svg viewBox="0 0 24 24" class="ri"><path d="M4 20l4-1L18.5 8.5a2 2 0 0 0 0-2.8l-.2-.2a2 2 0 0 0-2.8 0L4 16l-1 4Z"/><path d="M14 7l3 3"/></svg><em>DRAW</em>';
    if(mc)mc.appendChild(dt);
    dt.addEventListener('click',ev=>{ev.stopPropagation(); const open=mc.classList.toggle('draw-open'); dt.classList.toggle('on',open);});
  }catch(e){}
  // single tap = just pan/dismiss (Leaflet closes popups on click). Options come from a HOLD.
  map.on('click',e=>{ if(placing){addCameraAt(e.latlng);return;} });
  // long-press (hold) to drop a pin — like Google Maps — so light taps don't fire the menu
  setupLongPress();
  // wire any popup's in-app buttons the moment it opens (keeps everything in-app)
  map.on('popupopen',e=>{const el=e.popup.getElement();if(el)wireEls(el);});
  // cursor + zoom readout + district-label visibility
  map.on('mousemove',e=>{const c=$('#osCursor');if(c)c.textContent='CURSOR '+e.latlng.lat.toFixed(4)+', '+e.latlng.lng.toFixed(4);});
  const zu=()=>{const z=$('#osZoom');if(z)z.textContent='ZOOM '+map.getZoom().toFixed(1);
    const mc=document.querySelector('#osmap');if(mc)mc.classList.toggle('zlabels',map.getZoom()>=12);};
  map.on('zoomend',zu); zu();
  // default layers appear as soon as their data loads (no waiting screen)
  setTimeout(autoDefaults,600);
  // night layer
  try{buildNight();}catch(e){}
}

// enable the default layers once their data is in — order doesn't affect stacking
function autoDefaults(){
  if(!map)return;
  if(DISTRICTS && !distOn) toggleDist();
  if(LIVECAMS.length && !camsOn) toggleCams();
  // Garda stations are OFF by default now — tap the shield rail button to show them.
  if(!_featShown){const feat=LIVECAMS.find(c=>c.feat);if(feat){_featShown=true;setTimeout(()=>showFeed(feat),450);}}
}

function measureLine(layer){
  let d=0;const ll=layer.getLatLngs();
  for(let i=1;i<ll.length;i++)d+=ll[i-1].distanceTo(ll[i]);
  return d>1000?(d/1000).toFixed(2)+' km':Math.round(d)+' m';
}
function measureArea(layer){
  const ll=layer.getLatLngs()[0]; let a=0;
  const R=6378137;
  for(let i=0,len=ll.length;i<len;i++){
    const p1=ll[i],p2=ll[(i+1)%len];
    a+=(p2.lng-p1.lng)*Math.PI/180*(2+Math.sin(p1.lat*Math.PI/180)+Math.sin(p2.lat*Math.PI/180));
  }
  a=Math.abs(a*R*R/2);
  return a>10000?(a/10000).toFixed(2)+' ha ('+Math.round(a)+' m²)':Math.round(a)+' m²';
}

function setBase(mode){
  if(mode===true)mode='sat'; if(mode===false)mode='street';  // back-compat
  baseMode=mode; onSat=(mode==='sat');
  [baseLight,baseStreets,baseSat].forEach(l=>{if(l&&map.hasLayer(l))map.removeLayer(l);});
  const mc=document.querySelector('#osmap');
  if(mode==='sat'){ baseSat.addTo(map); mc&&mc.classList.add('sat'); mc&&mc.classList.remove('tac'); }
  else if(mode==='tactical'){ baseStreets.addTo(map); mc&&mc.classList.remove('sat'); mc&&mc.classList.add('tac'); }
  else { baseLight.addTo(map); mc&&mc.classList.remove('sat'); mc&&mc.classList.remove('tac'); }
  const bs=$('#osModeStreet'),bt=$('#osModeTac'),bsat=$('#osModeSat');
  [bs,bt,bsat].forEach(b=>b&&b.classList.remove('on'));
  const on = mode==='sat'?bsat : mode==='tactical'?bt : bs; on&&on.classList.add('on');
}

// ---- in-app web viewer (keeps everything on this page, no redirect) ----
function hostOf(u){try{return new URL(u).hostname.replace(/^www\./,'');}catch(e){return 'this site';}}
function openWeb(url,opt){
  opt=opt||{};
  const p=$('#osPanel');p.classList.remove('hidden');p.classList.add('os-web');
  const body = opt.embed
    ? '<div class="osw-frame"><iframe src="'+esc(url)+'" allow="autoplay; fullscreen; geolocation; encrypted-media" referrerpolicy="no-referrer-when-downgrade"></iframe></div>'
    : '<div class="osw-block"><div class="osw-blkico">▤</div><div class="osw-blkh">'+esc(hostOf(url))+'</div>'
      +'<p>This site doesn’t allow being shown inside another app (its own security policy). Open it below — it stays in your browser and one tap back brings you straight here.</p>'
      +'<a class="osbtn wide osw-open" href="'+esc(url)+'" target="_blank" rel="noopener">↗ Open '+esc(hostOf(url))+'</a></div>';
  p.innerHTML='<div class="os-panel-in os-webin">'
    +'<div class="osp-head osw-head"><button class="osx osw-back" id="ospBack">‹ Back to map</button>'
    +'<b class="osw-title">'+esc(opt.title||hostOf(url))+'</b>'
    +'<a class="osw-ext" href="'+esc(url)+'" target="_blank" rel="noopener" title="Open in browser">↗</a></div>'
    +body
    +(opt.note?'<p class="osp-empty">'+esc(opt.note)+'</p>':'')
    +'</div>';
  $('#ospBack').addEventListener('click',()=>{p.classList.add('hidden');p.classList.remove('os-web');p.innerHTML='';});
}
// known keyless-embeddable URL shapes — everything else opens via the fallback card
function knownEmbed(u){return /(maps\.google\.[^/]+\/maps\?.*output=embed|[?&]output=embed|openstreetmap\.org\/export\/embed|youtube(-nocookie)?\.com\/embed\/|embed\.windy\.com)/i.test(u);}

// ---- point / coordinate actions (all in-app) ----
function pointActionsHtml(ll){
  const la=ll.lat.toFixed(6),lo=ll.lng.toFixed(6);
  return '<button class="oscopy" data-c="'+la+', '+lo+'">⧉ copy coords</button>'
   +'<button class="osact" data-act="map" data-la="'+ll.lat+'" data-lo="'+ll.lng+'">🗺️ Map & Street View here</button>'
   +'<button class="osact" data-act="sat" data-la="'+ll.lat+'" data-lo="'+ll.lng+'">✦ Aerial (satellite) here</button>'
   +'<button class="osact" data-act="air" data-la="'+ll.lat+'" data-lo="'+ll.lng+'">✈️ Live aircraft overhead</button>'
   +'<button class="osact" data-act="cams" data-la="'+ll.lat+'" data-lo="'+ll.lng+'">📹 Public webcams near here</button>'
   +'<button class="osact" data-act="yt" data-la="'+ll.lat+'" data-lo="'+ll.lng+'">▶️ Live video search</button>'
   +'<button class="oscam2" data-la="'+ll.lat+'" data-lo="'+ll.lng+'">📷 Log a camera here</button>';
}
function doAct(act,la,lo){
  if(act==='sat'){map.closePopup();setBase(true);map.setView([la,lo],18);toast('Satellite view — this map');return;}
  if(act==='air'){map.closePopup();map.setView([la,lo],13);if(!flightsOn)toggleFlights();toast('Live aircraft (needs signal)');return;}
  if(act==='map'){openWeb('https://maps.google.com/maps?q='+la+','+lo+'&t=m&z=18&output=embed',{title:'Map — '+la.toFixed(5)+', '+lo.toFixed(5),embed:true,note:'Google map of this point (drag/zoom inside). Drag to Pegman for Street View. Aerial is on the ✦ SAT toggle top-right.'});return;}
  if(act==='cams'){openWeb('https://embed.windy.com/embed2.html?type=map&location=coordinates&metricRain=default&metricTemp=default&metricWind=default&zoom=12&overlay=webcams&product=ecmwf&level=surface&lat='+la+'&lon='+lo,{title:'Public webcams near here',embed:true,note:'Windy public webcams — tap a camera dot to view. Public only, not Garda or private CCTV.'});return;}
  if(act==='yt'){openWeb('https://www.youtube.com/results?search_query='+la.toFixed(3)+'%2C'+lo.toFixed(3)+'+live',{title:'Live video search',note:'Public YouTube live streams mentioning this area.'});return;}
}
// wire any in-app buttons inside a freshly-opened popup or panel
function wireEls(el){
  if(!el)return;
  el.querySelectorAll('.oscopy').forEach(cb=>cb.onclick=()=>{navigator.clipboard.writeText(cb.dataset.c).then(()=>toast('Coordinates copied')).catch(()=>{});});
  el.querySelectorAll('.oscam2').forEach(c2=>c2.onclick=()=>{map.closePopup();addCameraAt({lat:+c2.dataset.la,lng:+c2.dataset.lo});});
  el.querySelectorAll('.osact').forEach(b=>b.onclick=()=>{
    const a=b.dataset.act;
    if(a==='url'){openWeb(b.dataset.u,{title:b.dataset.t||'Page'});}
    else if(a==='dir'){openWeb('https://maps.google.com/maps?daddr='+b.dataset.la+','+b.dataset.lo+'&output=embed',{title:'Directions',embed:true,note:'Route preview. For turn-by-turn, tap ↗ to open your maps app.'});}
    else{doAct(a,+b.dataset.la,+b.dataset.lo);}
  });
}
// ---- point actions popup ----
function pointPopup(ll){
  if(placing){addCameraAt(ll);return;}
  const la=ll.lat.toFixed(6),lo=ll.lng.toFixed(6);
  const html='<div class="ospop"><b>'+la+', '+lo+'</b>'+pointActionsHtml(ll)+'</div>';
  L.popup({maxWidth:250}).setLatLng(ll).setContent(html).openOn(map);
}

// ---- CCTV pins ----
function camIcon(){return L.divIcon({className:'camIcon',html:'📷',iconSize:[28,28],iconAnchor:[14,14]});}
function drawCameras(){
  cctvLayer.clearLayers();
  cctv.forEach((c,i)=>{
    L.marker([c.lat,c.lon],{icon:camIcon()}).addTo(cctvLayer).on('click',()=>editCamera(i));
  });
  const lb=$('#bLog');if(lb)lb.textContent=cctv.length;
}
function togglePlace(){
  placing=!placing;
  $('#osCam').classList.toggle('on',placing);
  $('#osCam').textContent=placing?'📷 Tap the map…':'📷 Add camera';
  toast(placing?'Tap the map where the camera is':'');
}
function addCameraAt(ll){
  placing=false;$('#osCam').classList.remove('on');$('#osCam').textContent='📷 Add camera';
  cctv.push({lat:ll.lat,lon:ll.lng,owner:'',phone:'',email:'',retention:'',direction:'',notes:'',ts:Date.now()});
  save();drawCameras();editCamera(cctv.length-1);
}
function editCamera(i){
  const c=cctv[i];
  const p=$('#osPanel');p.classList.remove('hidden');
  p.innerHTML=`<div class="os-panel-in">
   <div class="osp-head"><b>📷 Camera ${i+1}</b><button class="osx" id="ospClose">✕</button></div>
   <div class="osp-co">${c.lat.toFixed(6)}, ${c.lon.toFixed(6)}</div>
   <label>Owner / premises<input id="c_owner" value="${esc(c.owner)}" placeholder="e.g. Centra, 12 Main St"></label>
   <label>Phone<input id="c_phone" value="${esc(c.phone)}" inputmode="tel" placeholder="contact number"></label>
   <label>Email<input id="c_email" value="${esc(c.email)}" inputmode="email" placeholder="for preservation request"></label>
   <label>Retention (days)<input id="c_ret" value="${esc(c.retention)}" inputmode="numeric" placeholder="e.g. 28"></label>
   <label>Direction / coverage<input id="c_dir" value="${esc(c.direction)}" placeholder="e.g. faces east over footpath"></label>
   <label>Notes<textarea id="c_notes" rows="2" placeholder="height, type, opening hours to call">${esc(c.notes)}</textarea></label>
   <div class="osp-btns">
     <button class="osbtn wide" id="c_save">Save</button>
     <button class="osbtn" id="c_go">Centre</button>
     <button class="osbtn danger" id="c_del">Delete</button>
   </div></div>`;
  const g=id=>$('#'+id).value.trim();
  $('#ospClose').addEventListener('click',()=>p.classList.add('hidden'));
  $('#c_save').addEventListener('click',()=>{
    Object.assign(c,{owner:g('c_owner'),phone:g('c_phone'),email:g('c_email'),retention:g('c_ret'),direction:g('c_dir'),notes:$('#c_notes').value.trim()});
    save();drawCameras();toast('Camera saved');p.classList.add('hidden');
  });
  $('#c_go').addEventListener('click',()=>{map.setView([c.lat,c.lon],18);p.classList.add('hidden');});
  $('#c_del').addEventListener('click',()=>{if(confirm('Delete this camera?')){cctv.splice(i,1);save();drawCameras();p.classList.add('hidden');}});
}
function showList(){
  const p=$('#osPanel');p.classList.remove('hidden');
  if(!cctv.length){p.innerHTML='<div class="os-panel-in"><div class="osp-head"><b>📷 Camera log</b><button class="osx" id="ospClose">✕</button></div><p class="osp-empty">No cameras logged. Tap “Add camera”, then tap the map where you see one. Everything is stored on this phone only.</p></div>';$('#ospClose').addEventListener('click',()=>p.classList.add('hidden'));return;}
  let rows=cctv.map((c,i)=>`<button class="oslistrow" data-i="${i}"><b>📷 ${i+1}. ${esc(c.owner||'(no owner yet)')}</b>
    <span>${c.phone?'📞 '+esc(c.phone)+'  ':''}${c.retention?'🗓️ '+esc(c.retention)+'d  ':''}${esc(c.direction)}</span></button>`).join('');
  p.innerHTML=`<div class="os-panel-in"><div class="osp-head"><b>📷 Camera log (${cctv.length})</b><button class="osx" id="ospClose">✕</button></div>
    ${rows}
    <div class="osp-btns"><button class="osbtn wide" id="c_export">⧉ Copy all for report / preservation</button></div>
    <p class="osp-empty">Stored on this phone only — nothing uploaded.</p></div>`;
  $('#ospClose').addEventListener('click',()=>p.classList.add('hidden'));
  p.querySelectorAll('.oslistrow').forEach(b=>b.addEventListener('click',()=>{const i=+b.dataset.i;map.setView([cctv[i].lat,cctv[i].lon],18);editCamera(i);}));
  $('#c_export').addEventListener('click',()=>{
    const txt=cctv.map((c,i)=>`Camera ${i+1}\n  Location: ${c.lat.toFixed(6)}, ${c.lon.toFixed(6)}\n  Owner/premises: ${c.owner||'-'}\n  Phone: ${c.phone||'-'}   Email: ${c.email||'-'}\n  Retention: ${c.retention||'-'} days\n  Coverage: ${c.direction||'-'}\n  Notes: ${c.notes||'-'}`).join('\n\n');
    navigator.clipboard.writeText('CCTV CANVASS — cameras identified\n\n'+txt).then(()=>toast('Copied — paste into your report')).catch(()=>toast('Copy failed'));
  });
}

// ---- geocode (Nominatim, public, CORS-enabled) ----
function geocode(q){
  q=(q||'').trim(); if(!q)return; toast('Searching…');
  fetch('https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=ie&q='+encodeURIComponent(q),{headers:{'Accept':'application/json'}})
   .then(r=>r.json()).then(d=>{
     if(!d.length){toast('No match — try adding “Dublin”');return;}
     map.setView([+d[0].lat,+d[0].lon],17);
     L.popup().setLatLng([+d[0].lat,+d[0].lon]).setContent(esc(d[0].display_name)).openOn(map);
   }).catch(()=>toast('Search needs signal'));
}
function locate(){
  if(!navigator.geolocation){toast('No location on this device');return;}
  toast('Locating…');
  navigator.geolocation.getCurrentPosition(
    p=>{const ll=[p.coords.latitude,p.coords.longitude];map.setView(ll,17);L.circleMarker(ll,{radius:8,color:'#d4af37'}).addTo(map);},
    ()=>toast('Location unavailable'),{enableHighAccuracy:true,timeout:8000});
}

// ---- live flights (adsb.lol public API, best-effort) ----
function toggleFlights(){
  flightsOn=!flightsOn;
  $('#osFlights').classList.toggle('on',flightsOn);
  if(flightsOn){flightLayer.addTo(map);fetchFlights();flightTimer=setInterval(fetchFlights,15000);}
  else{clearInterval(flightTimer);map.removeLayer(flightLayer);}
}
function planeIcon(track){return L.divIcon({className:'planeIcon',html:`<span style="display:inline-block;transform:rotate(${(track||0)}deg)">✈️</span>`,iconSize:[24,24],iconAnchor:[12,12]});}
function fetchFlights(){
  const c=map.getCenter();
  const nm=Math.min(250,Math.max(10,Math.round(map.getBounds().getNorthEast().distanceTo(c)/1852)));
  fetch(`https://api.adsb.lol/v2/lat/${c.lat.toFixed(4)}/lon/${c.lng.toFixed(4)}/dist/${nm}`)
   .then(r=>r.json()).then(d=>{
     flightLayer.clearLayers();
     const ac=(d&&d.ac)||[];
     if(!ac.length){toast('No aircraft in range right now');return;}
     ac.forEach(a=>{if(a.lat==null||a.lon==null)return;
       const m=L.marker([a.lat,a.lon],{icon:planeIcon(a.track)}).addTo(flightLayer);
       m.bindPopup(`<b>${esc((a.flight||'').trim()||a.hex||'aircraft')}</b><br>${a.alt_baro!=null?'Alt '+a.alt_baro+' ft<br>':''}${a.gs!=null?'Speed '+Math.round(a.gs)+' kt':''}`);
     });
     toast(ac.length+' aircraft overhead');
   }).catch(()=>{
     // stay in the app — don't bounce out to FlightRadar. Offer the in-app viewer.
     const c2=map.getCenter();
     openWeb('https://globe.adsbexchange.com/?lat='+c2.lat.toFixed(3)+'&lon='+c2.lng.toFixed(3)+'&zoom=11',
       {title:'Live aircraft', note:'Live ADS-B traffic. If the in-app feed is quiet, this is the fallback radar — still inside the app.'});
   });
}

// ---- night terminator ----
function buildNight(){
  const pts=[]; const now=new Date();
  const jd=now/86400000+2440587.5, T=(jd-2451545)/36525;
  const L0=(280.46646+36000.76983*T)%360;
  const M=357.52911+35999.05029*T;
  const C=(1.914602-0.004817*T)*Math.sin(M*Math.PI/180)+0.019993*Math.sin(2*M*Math.PI/180);
  const lam=(L0+C)*Math.PI/180;
  const eps=23.439*Math.PI/180;
  const dec=Math.asin(Math.sin(eps)*Math.sin(lam));
  const gmst=(18.697374558+24.06570982441908*(jd-2451545))%24;
  for(let lng=-180;lng<=180;lng+=2){
    const ha=(gmst*15+lng)*Math.PI/180;
    let lat=Math.atan(-Math.cos(ha)/Math.tan(dec))*180/Math.PI;
    pts.push([lat,lng]);
  }
  const north=dec>0; const cap=north?-90:90;
  const poly=pts.concat([[cap,180],[cap,-180]]);
  nightLayer=L.polygon(poly,{stroke:false,fillColor:'#000',fillOpacity:0.28,interactive:false});
}

// ---- OSINT links launcher ----
const LINKS=[
 ['Company & assets',[
   ['CRO — company search','https://core.cro.ie/'],
   ['RBO — beneficial owners','https://rbo.gov.ie/'],
   ['OpenCorporates (IE)','https://opencorporates.com/companies/ie'],
   ['Property Price Register','https://www.propertypriceregister.ie/'],
 ]],
 ['Marketplaces (stolen goods)',[
   ['DoneDeal','https://www.donedeal.ie/'],
   ['Adverts.ie','https://www.adverts.ie/'],
   ['Facebook Marketplace','https://www.facebook.com/marketplace/dublin/'],
 ]],
 ['Imagery & geolocation',[
   ['Google Earth (3D)','https://earth.google.com/web/'],
   ['Google Street View','https://www.google.com/maps'],
   ['Bing Maps (bird\'s-eye)','https://www.bing.com/maps'],
   ['GeoHive / OSI historic maps','https://webapps.geohive.ie/mapviewer/'],
 ]],
 ['Transport & movement',[
   ['Transport for Ireland — live','https://www.transportforireland.ie/'],
   ['FlightRadar24','https://www.flightradar24.com/'],
   ['MarineTraffic','https://www.marinetraffic.com/'],
 ]],
 ['Metadata & media',[
   ['Jimpl — EXIF/photo metadata','https://jimpl.com/'],
   ['metadata2go','https://www.metadata2go.com/'],
 ]],
 ['Planning & property',[
   ['MyPlan.ie','https://www.myplan.ie/'],
   ['Dublin City planning','https://www.dublincity.ie/residential/planning'],
 ]],
];
function showLinks(){
  const p=$('#osPanel');p.classList.remove('hidden');
  p.innerHTML=`<div class="os-panel-in"><div class="osp-head"><b>☰ OSINT links</b><button class="osx" id="ospClose">✕</button></div>
   ${LINKS.map(([h,items])=>`<div class="oslgrp"><div class="oslh">${esc(h)}</div>${items.map(([n,u])=>`<button class="oslink" data-u="${esc(u)}">${esc(n)}</button>`).join('')}</div>`).join('')}
   <p class="osp-empty">Everything opens here in the app. Any sign-ins are yours; nothing here is logged by the app.</p></div>`;
  $('#ospClose').addEventListener('click',()=>p.classList.add('hidden'));
  wirePanelLinks(p);
}

// ---- open / close ----
function open(){
  build();
  $('#osint').classList.remove('hidden');
  document.body.classList.add('os-open');
  setTimeout(()=>{initMap();if(map)map.invalidateSize();},60);
}
function close(){
  $('#osint').classList.add('hidden');
  document.body.classList.remove('os-open');
  if(flightsOn){clearInterval(flightTimer);}
}

// ---- Garda district boundaries (default layer) ----
// distinct qualitative palette (Tableau/d3) — reads well on the light OR dark basemap
const DIV_PAL=['#4e79a7','#f28e2b','#e15759','#59a14f','#b07aa1','#edc948','#76b7b2','#ff9da7','#9c6b4f','#1f9e89',
               '#5b8ff9','#e8684a','#6dc8ec','#9270ca','#ff9d4d','#269a99','#d96c9a','#5ad8a6','#c98a3b','#7a7fd6'];
function distColor(dv){
  if(!_divmap){_divmap={};const ds=[...new Set(DISTRICTS.features.map(f=>f.properties.dv))].sort();ds.forEach((d,i)=>_divmap[d]=DIV_PAL[i%DIV_PAL.length]);}
  return _divmap[dv]||'#4e79a7';
}
function distStyle(f){
  const home=f.properties.d===HOME_DIST;
  const col=distColor(f.properties.dv);
  return home
    ? {color:'#00c2ff',weight:3,opacity:1,fillColor:'#12b6ff',fillOpacity:0.30,dashArray:null,lineJoin:'round'}
    : {color:col,weight:1.6,opacity:0.9,fillColor:col,fillOpacity:0.20,dashArray:null,lineJoin:'round'};
}
function buildDistricts(){
  if(districtLayer)return;
  // non-interactive: the polygons are purely visual so light taps pan the map.
  // District info comes from a long-press, resolved via districtAt() point-in-polygon.
  districtLayer=L.geoJSON(DISTRICTS,{style:distStyle,interactive:false});
  districtLabels=L.layerGroup();
  DISTRICTS.features.forEach(f=>{
    try{
      const c=L.geoJSON(f).getBounds().getCenter();
      const home=f.properties.d===HOME_DIST;
      L.marker(c,{interactive:false,keyboard:false,icon:L.divIcon({className:'os-distlabel'+(home?' home':''),html:'<span>'+esc(f.properties.d)+'</span>',iconSize:[0,0]})}).addTo(districtLabels);
    }catch(e){}
  });
}
function toggleDist(){
  distOn=!distOn; $('#osDist').classList.toggle('on',distOn);
  if(!distOn){ if(districtLayer)map.removeLayer(districtLayer); if(districtLabels)map.removeLayer(districtLabels); return; }
  if(!DISTRICTS){ distOn=false; $('#osDist').classList.remove('on'); toast('District boundaries still loading…'); return; }
  buildDistricts();
  districtLayer.addTo(map); districtLabels.addTo(map);
  const mc=document.querySelector('#osmap'); if(mc&&map.getZoom()>=12)mc.classList.add('zlabels');
}
function districtPopup(p,ll){
  const home=p.d===HOME_DIST;
  const tel=p.ph?String(p.ph).replace(/^0/,''):'';
  const head='<div class="osp-dist'+(home?' home':'')+'"><b>▦ '+esc(p.d)+' District</b>'+(home?' <span class="os-homepin">◉ YOUR PATCH</span>':'')+
    '<div class="osp-distmeta">'+esc(p.dv)+' Division'+(p.c?' · '+esc(p.c):'')+'</div>'+
    '<div class="osp-distmeta">HQ '+esc(p.st||'—')+(p.ty?' · '+esc(p.ty):'')+'</div>'+
    ((p.pop||p.km2)?'<div class="osp-distmeta">'+(p.pop?Number(p.pop).toLocaleString()+' pop':'')+(p.km2?(p.pop?' · ':'')+p.km2+' km²':'')+'</div>':'')+
    (tel?'<a href="tel:0'+esc(tel)+'">📞 Call 0'+esc(tel)+'</a>':'')+'</div>';
  const html='<div class="ospop">'+head+'<div class="ospop-sep"></div><b>'+ll.lat.toFixed(6)+', '+ll.lng.toFixed(6)+'</b>'+pointActionsHtml(ll)+'</div>';
  L.popup({maxWidth:260}).setLatLng(ll).setContent(html).openOn(map);
}
// which district contains a point (ray-casting; handles holes + MultiPolygon)
function ringContains(ring,x,y){
  let inside=false;
  for(let i=0,j=ring.length-1;i<ring.length;j=i++){
    const xi=ring[i][0],yi=ring[i][1],xj=ring[j][0],yj=ring[j][1];
    if(((yi>y)!==(yj>y))&&(x<(xj-xi)*(y-yi)/(yj-yi)+xi))inside=!inside;
  }
  return inside;
}
function districtAt(ll){
  if(!DISTRICTS)return null;
  const x=ll.lng,y=ll.lat;
  for(const f of DISTRICTS.features){
    const g=f.geometry;if(!g)continue;
    const polys=g.type==='Polygon'?[g.coordinates]:g.type==='MultiPolygon'?g.coordinates:[];
    for(const poly of polys){
      if(ringContains(poly[0],x,y)){
        let inHole=false;for(let h=1;h<poly.length;h++){if(ringContains(poly[h],x,y)){inHole=true;break;}}
        if(!inHole)return f.properties;
      }
    }
  }
  return null;
}
// HOLD to drop a pin (like Google Maps). A light tap or a drag does nothing.
function setupLongPress(){
  const el=document.querySelector('#osmap');if(!el)return;
  let timer=null,start=null,moved=false;
  const cancel=()=>{if(timer){clearTimeout(timer);timer=null;}start=null;moved=false;};
  el.addEventListener('pointerdown',e=>{
    if(e.pointerType==='mouse'&&e.button!==0)return;
    if(placing)return;
    if(e.target.closest('.leaflet-marker-icon,.leaflet-popup,.leaflet-control,.os-rail,.os-mode,.os-statusbar,.os-header,.os-panel'))return;
    if(map.pm&&map.pm.globalDrawModeEnabled&&map.pm.globalDrawModeEnabled())return;
    moved=false;start={x:e.clientX,y:e.clientY};
    clearTimeout(timer);
    timer=setTimeout(()=>{
      timer=null;if(moved||!start)return;
      const rect=el.getBoundingClientRect();
      const ll=map.containerPointToLatLng(L.point(start.x-rect.left,start.y-rect.top));
      longPressAt(ll);
      if(navigator.vibrate){try{navigator.vibrate(18);}catch(_){}}
    },480);
  },{passive:true});
  el.addEventListener('pointermove',e=>{
    if(!start)return;
    if(Math.abs(e.clientX-start.x)>12||Math.abs(e.clientY-start.y)>12){moved=true;if(timer){clearTimeout(timer);timer=null;}}
  },{passive:true});
  el.addEventListener('pointerup',cancel,{passive:true});
  el.addEventListener('pointercancel',cancel,{passive:true});
  el.addEventListener('pointerleave',cancel,{passive:true});
  // desktop: right-click also drops the pin instantly
  map.on('contextmenu',e=>{if(!placing)longPressAt(e.latlng);});
}
let _lastLP=0;
function longPressAt(ll){
  const now=Date.now();if(now-_lastLP<600)return;_lastLP=now;
  map.closePopup();
  const d=distOn?districtAt(ll):null;
  if(d)districtPopup(d,ll);else pointPopup(ll);
}

function gardaIcon(hq){
  const w=hq?30:26, h=Math.round(w*1.18);
  // Garda officer: navy custodian cap with gold badge, face, shoulders
  const svg='<svg viewBox="0 0 26 30" width="'+w+'" height="'+h+'" aria-hidden="true">'
    +'<ellipse cx="13" cy="28" rx="8.5" ry="1.8" fill="rgba(0,0,0,.28)"/>'
    +'<path d="M4.5 27c0-4.6 3.8-7.3 8.5-7.3s8.5 2.7 8.5 7.3z" fill="#12315e" stroke="#e7c250" stroke-width="1"/>'
    +'<circle cx="13" cy="13.4" r="4.7" fill="#f0d9bd" stroke="#0e2547" stroke-width="0.8"/>'
    +'<path d="M6.7 10.2c0-3.2 2.7-5.4 6.3-5.4s6.3 2.2 6.3 5.4l.7 1.4c.2.6-.2 1.1-.9 1.1H6.9c-.7 0-1.1-.5-.9-1.1z" fill="#12315e"/>'
    +'<rect x="6.6" y="10.3" width="12.8" height="2" fill="#0a1d3a"/>'
    +'<circle cx="13" cy="7.9" r="1.2" fill="#e7c250"/></svg>';
  return L.divIcon({className:'gdaCop'+(hq?' hq':''),html:svg,iconSize:[w,h],iconAnchor:[Math.round(w/2),h-2]});
}
// ---- DCC (Dublin City Council) traffic CCTV — location layer for canvass ----
function dccIcon(){return L.divIcon({className:'dccCam',html:'<span class="dccdot"></span><svg viewBox="0 0 24 20"><rect x="2.5" y="6" width="11" height="6" rx="1.4"/><path d="M13.5 7.6 20.5 5.5v8l-7-2.1Z"/><circle cx="7" cy="9" r="1.5"/></svg>',iconSize:[24,20],iconAnchor:[12,10]});}
function toggleDcc(){
  dccOn=!dccOn; $('#osDcc').classList.toggle('on',dccOn);
  if(!dccOn){ if(dccLayer)map.removeLayer(dccLayer); return; }
  if(!DCCCAMS.length){ fetch('data/dcc_cams.json').then(r=>r.json()).then(d=>{DCCCAMS=d;plotDcc();}).catch(()=>{dccOn=false;$('#osDcc').classList.remove('on');toast('DCC data needs signal once');}); return; }
  plotDcc();
}
function plotDcc(){
  if(!dccLayer)dccLayer=L.layerGroup();
  dccLayer.clearLayers();
  DCCCAMS.forEach(c=>{ L.marker([c.lat,c.lon],{icon:dccIcon()}).addTo(dccLayer).on('click',()=>dccPopup(c)); });
  dccLayer.addTo(map);
  const b=$('#bDcc'); if(b)b.textContent=DCCCAMS.length;
  toast(DCCCAMS.length+' DCC traffic cameras · location only');
}
function dccPopup(c){
  const ll={lat:c.lat,lng:c.lon};
  const html='<div class="ospop"><b>🎥 '+esc(c.n)+'</b>'+
    '<div class="osp-distmeta">DCC traffic CCTV'+(c.id?' · cam #'+esc(String(c.id)):'')+' · fixed council camera</div>'+
    '<div class="ospop-sep"></div><b>'+c.lat.toFixed(6)+', '+c.lon.toFixed(6)+'</b>'+pointActionsHtml(ll)+'</div>';
  L.popup({maxWidth:260}).setLatLng(ll).setContent(html).openOn(map);
}
// searchable DCC list — openable from the home screen (outside the map)
function ensureDcc(cb){ if(DCCCAMS&&DCCCAMS.length){cb();return;} fetch('data/dcc_cams.json').then(r=>r.json()).then(d=>{DCCCAMS=d;cb();}).catch(()=>toast('DCC data needs signal once')); }
function openDccList(){
  ensureDcc(()=>{
    let el=document.getElementById('dccList');
    if(!el){ el=document.createElement('div'); el.id='dccList'; document.body.appendChild(el); }
    const rows=DCCCAMS.slice().sort((a,b)=>(a.n||'').localeCompare(b.n||''));
    el.className='';
    el.innerHTML='<div class="reel-top"><button class="reel-x" id="dclClose">‹ Close</button>'
      +'<div class="reel-titles"><div class="reel-title">DCC CITY CCTV</div><div class="reel-grouptag">'+DCCCAMS.length+' fixed cameras · tap to locate</div></div>'
      +'<span style="width:64px"></span></div>'
      +'<div class="dl-search"><input id="dclSearch" type="search" placeholder="Search road or area…" autocomplete="off"></div>'
      +'<div class="dl-rows" id="dclRows"></div>';
    document.body.classList.add('reel-open');
    const render=q=>{
      q=(q||'').toLowerCase().trim();
      const list=rows.filter(c=>!q||(c.n||'').toLowerCase().includes(q));
      const rc=document.getElementById('dclRows');
      rc.innerHTML=list.length?list.map(c=>'<button class="dl-row" data-lat="'+c.lat+'" data-lon="'+c.lon+'" data-id="'+esc(String(c.id))+'"><b>'+esc(c.n)+'</b><span>cam #'+esc(String(c.id))+' · '+c.lat.toFixed(4)+', '+c.lon.toFixed(4)+'</span></button>').join(''):'<p class="osp-empty" style="padding:18px">No camera matches “'+esc(q)+'”.</p>';
      rc.querySelectorAll('.dl-row').forEach(b=>b.addEventListener('click',()=>{
        closeDccList(); openMapToDcc({lat:+b.dataset.lat,lon:+b.dataset.lon,id:b.dataset.id,n:b.querySelector('b').textContent});
      }));
    };
    render('');
    document.getElementById('dclClose').addEventListener('click',closeDccList);
    document.getElementById('dclSearch').addEventListener('input',e=>render(e.target.value));
  });
}
function closeDccList(){const el=document.getElementById('dccList');if(el){el.className='hidden';el.innerHTML='';}document.body.classList.remove('reel-open');}
function openMapToDcc(c){
  open();   // builds the map overlay if it doesn't exist yet, shows it if it does
  const go=()=>{ if(!map)return setTimeout(go,200); if(!dccOn)toggleDcc(); map.setView([c.lat,c.lon],17); setTimeout(()=>dccPopup(c),450); };
  go();
}
window.openDccList=openDccList;
function toggleGarda(){
  gardaOn=!gardaOn; $('#osGarda').classList.toggle('on',gardaOn);
  if(!gardaOn){map.removeLayer(gardaLayer);return;}
  gardaLayer.clearLayers();
  STATIONS.forEach(st=>{
    const hq=/HQ/i.test(st.ty);
    const m=L.marker([st.lat,st.lon],{icon:gardaIcon(hq)}).addTo(gardaLayer);
    m.bindPopup('<div class="ospop"><b>🛡️ '+esc(st.n)+' Garda Station</b>'+
      '<div style="color:#20180a;font-size:11px;margin:2px 0 6px">'+esc(st.dv)+' · '+esc(st.ty)+(st.ft?' · 24hr':'')+'</div>'+
      '<div style="color:#20180a;font-size:12px;margin-bottom:6px">'+esc(st.a)+'</div>'+
      (st.ph?'<a href="tel:0'+esc(st.ph.replace(/^0/,""))+'">📞 Call 0'+esc(st.ph.replace(/^0/,""))+'</a>':'')+
      '<button class="osact" data-act="dir" data-la="'+st.lat+'" data-lo="'+st.lon+'">🧭 Directions</button>'+
      (st.u?'<button class="osact" data-act="url" data-u="'+esc(st.u)+'" data-t="'+esc(st.n)+' station page">🔗 Station page</button>':'')+'</div>');
  });
  gardaLayer.addTo(map);
  toast(STATIONS.length+' Garda stations shown');
}
// is this camera inside the user's home district (Fitzgibbon St / Mountjoy)?
function camInHome(c){ if(!DISTRICTS)return false; const p=districtAt({lat:c.lat,lng:c.lon}); return !!(p && p.d===HOME_DIST); }
// two icons: a gold LIVE camera for the home patch, a cyan camera for everything else (incl. motorway)
const _camSvg='<svg viewBox="0 0 24 24" class="cvi"><rect x="2.5" y="7" width="12.5" height="10" rx="2.2"/><path d="M15 10.4 21.2 7.4v9.2L15 13.6Z"/><circle cx="8.7" cy="12" r="2.1"/></svg>';
function camsIconFor(c){
  const home=camInHome(c);
  return L.divIcon({className:'osCam osCamPulse '+(home?'osCamHome':(c.img?'osCamTii':'osCamOther')),
    html:_camSvg+'<i class="camlive"></i>', iconSize:[30,26], iconAnchor:[15,13]});
}
function toggleCams(){
  camsOn=!camsOn; $('#osCams').classList.toggle('on',camsOn);
  const bc=$('#bCams');if(bc)bc.textContent=LIVECAMS.length;
  if(!camsOn){map.removeLayer(camsLayer);return;}
  camsLayer.clearLayers();
  LIVECAMS.forEach((c,i)=>{
    const m=L.marker([c.lat,c.lon],{icon:camsIconFor(c)}).addTo(camsLayer);
    m.on('click',()=>showFeed(c));
  });
  camsLayer.addTo(map);
  toast(LIVECAMS.length+' public webcams · tap to view');
}
let _feedTimer=null;
function stopFeedTimer(){ if(_feedTimer){clearInterval(_feedTimer);_feedTimer=null;} }
function showFeed(c){
  stopFeedTimer();
  const p=$('#osPanel');p.classList.remove('hidden');
  const embed = c.yt
    ? '<div class="os-feedwrap"><iframe class="os-feedvid" src="https://www.youtube.com/embed/'+c.yt+'?autoplay=1&mute=1&playsinline=1&rel=0" allow="autoplay; fullscreen" allowfullscreen></iframe></div>'
    : c.img
    ? '<div class="os-feedwrap"><img class="os-feedimg" id="osFeedImg" src="'+esc(c.img)+'?'+Date.now()+'" alt="'+esc(c.n)+'"></div>'
    : '<div class="os-feednoembed">This camera plays on its own site — tap “Open live feed” to watch it here in the app.</div>';
  const isImg=!!c.img;
  p.innerHTML='<div class="os-panel-in"><div class="osp-head os-feedhead"><div><b>'+(isImg?'🎥':'📹')+' '+esc(c.n)+'</b>'+
    '<div class="os-feedmeta">'+c.lat.toFixed(4)+', '+c.lon.toFixed(4)+' · '+esc(c.s)+' · <span class="os-livetag">● LIVE</span></div></div>'+
    '<button class="osx" id="ospClose">✕</button></div>'+
    embed+
    '<div class="osp-btns"><button class="osbtn wide" id="feedReel">▶ All cameras (flick through)</button></div>'+
    (isImg
      ? '<p class="osp-empty">TII motorway CCTV — refreshes automatically every few seconds. Placed at the named junction (TII doesn’t publish exact camera coordinates).</p>'
      : '<div class="osp-btns"><button class="osbtn wide" id="feedOpen">↗ Open live feed (source)</button>'+
        '<button class="osbtn" id="feedCams">📹 More cams</button></div>'+
        '<p class="osp-empty">Public webcam — not private or Garda CCTV. Everything opens here in the app.</p>')+
    '</div>';
  $('#ospClose').addEventListener('click',()=>{stopFeedTimer();p.classList.add('hidden');});
  $('#feedReel').addEventListener('click',()=>{stopFeedTimer();p.classList.add('hidden');
    const cat=camCat(c); const grp=LIVECAMS.filter(x=>camCat(x)===cat); const gi=grp.indexOf(c);
    openCamReel(gi<0?0:gi, cat);});
  if(isImg){
    _feedTimer=setInterval(()=>{const im=$('#osFeedImg');if(im&&!p.classList.contains('hidden'))im.src=c.img+'?'+Date.now();else stopFeedTimer();},3000);
  }else{
    const fo=$('#feedOpen'); fo&&fo.addEventListener('click',()=>openWeb(c.u,{title:c.n,embed:!!c.yt||knownEmbed(c.u),note:'Live public webcam source.'}));
    const fc=$('#feedCams'); fc&&fc.addEventListener('click',()=>openWeb('https://embed.windy.com/embed2.html?type=map&location=coordinates&zoom=12&overlay=webcams&lat='+c.lat+'&lon='+c.lon,{title:'Public webcams near '+c.n,embed:true}));
  }
}
function showTransport(){
  const c=map?map.getCenter():{lat:53.3498,lng:-6.2603};
  const p=$('#osPanel');p.classList.remove('hidden');
  p.innerHTML='<div class="os-panel-in"><div class="osp-head"><b>🚌 Transport — live times</b><button class="osx" id="ospClose">✕</button></div>'+
   '<div class="oslgrp"><div class="oslh">Live departures</div>'+
   '<button class="oslink" data-u="https://www.transportforireland.ie/plan-a-journey/">🚏 TFI Journey Planner & live times</button>'+
   '<button class="oslink" data-u="https://luasforecasts.rpa.ie/">🚊 Luas live forecasts</button>'+
   '<button class="oslink" data-u="https://www.irishrail.ie/en-ie/train-timetables/live-departure-times">🚆 Irish Rail live departures</button>'+
   '<button class="oslink" data-u="https://www.dublinbus.ie/RTPI/">🚌 Dublin Bus real-time</button></div>'+
   '<div class="oslgrp"><div class="oslh">Maps</div>'+
   '<button class="oslink" data-e="1" data-u="https://maps.google.com/maps?q='+c.lat.toFixed(4)+','+c.lng.toFixed(4)+'&t=m&z=15&output=embed">🗺️ Transit map here (in-app)</button></div>'+
   '<p class="osp-empty">Official real-time pages open here in the app. Live vehicle positions need a paid transit feed, so the operator pages are the live source for now.</p></div>';
  $('#ospClose').addEventListener('click',()=>p.classList.add('hidden'));
  wirePanelLinks(p);
}
// ---- live traffic: coloured overlay ON the map (TomTom, free key) or Waze live view ----
let trafficLayer=null,trafficOn=false;
function ttKey(){try{return localStorage.getItem('gr_tomtom')||'';}catch(e){return '';}}
function toggleTraffic(){
  const key=ttKey();
  if(!key){ showTraffic(); return; }              // no key → in-app Waze live traffic + key entry
  trafficOn=!trafficOn; $('#osTraffic').classList.toggle('on',trafficOn);
  if(!trafficOn){ if(trafficLayer)map.removeLayer(trafficLayer); return; }
  if(!trafficLayer){
    trafficLayer=L.tileLayer('https://api.tomtom.com/traffic/map/4/tile/flow/relative0/{z}/{x}/{y}.png?key='+encodeURIComponent(key),
      {maxZoom:19,opacity:0.9,attribution:'Traffic © TomTom'});
    trafficLayer.on('tileerror',function(){ if(!trafficLayer._warned){trafficLayer._warned=1;toast('Traffic key not accepted — check your TomTom key');} });
  } else { trafficLayer.setUrl('https://api.tomtom.com/traffic/map/4/tile/flow/relative0/{z}/{x}/{y}.png?key='+encodeURIComponent(key)); }
  trafficLayer.addTo(map); toast('Live traffic overlay on the map');
}
function showTraffic(){
  const c=map?map.getCenter():{lat:53.3498,lng:-6.2603};
  const z=map?Math.round(map.getZoom()):13;
  const p=$('#osPanel');p.classList.remove('hidden');stopFeedTimer();
  const waze='https://embed.waze.com/iframe?zoom='+Math.min(17,Math.max(11,z))+'&lat='+c.lat.toFixed(4)+'&lon='+c.lng.toFixed(4)+'&ct=livemap';
  p.innerHTML='<div class="os-panel-in"><div class="osp-head"><b>🚦 Live traffic & routes</b><button class="osx" id="ospClose">✕</button></div>'
   +'<div class="os-trafficwrap"><iframe class="os-trafficmap" src="'+waze+'" allow="geolocation" referrerpolicy="no-referrer-when-downgrade"></iframe></div>'
   +'<div class="oslgrp"><div class="oslh">Plan a route — fastest with live traffic</div>'
   +'<input id="rtFrom" placeholder="From (leave blank = my location)" autocomplete="off">'
   +'<input id="rtTo" placeholder="To (address or place)" autocomplete="off">'
   +'<div class="osp-btns"><button class="osbtn wide" id="rtGo">🧭 Fastest route</button>'
   +'<button class="osbtn" id="rtBig">Bigger map</button></div></div>'
   +'<div class="oslgrp"><div class="oslh">Traffic ON the main map (like Google Maps)</div>'
   +'<input id="ttKeyIn" placeholder="Paste free TomTom key" value="'+esc(ttKey())+'" autocomplete="off">'
   +'<div class="osp-btns"><button class="osbtn wide" id="ttSave">Save key & paint traffic on the map</button></div>'
   +'<p class="osp-empty" style="margin-top:4px">Free key at developer.tomtom.com (register → copy key). Then the TRAFFIC button colours live congestion straight onto your map — green/amber/red — no key needed for the Waze view above.</p></div>'
   +'<p class="osp-empty">Live jams from Waze — red is heavy, orange moderate. Tap two points on the Waze map for a route with live traffic.</p></div>';
  $('#ospClose').addEventListener('click',()=>p.classList.add('hidden'));
  $('#ttSave').addEventListener('click',()=>{
    const k=($('#ttKeyIn').value||'').trim();
    try{if(k)localStorage.setItem('gr_tomtom',k);else localStorage.removeItem('gr_tomtom');}catch(e){}
    p.classList.add('hidden');
    if(k){trafficOn=false;toggleTraffic();toast('Traffic overlay on — tap TRAFFIC to toggle');}
  });
  $('#rtGo').addEventListener('click',()=>{
    const to=($('#rtTo').value||'').trim(), from=($('#rtFrom').value||'').trim();
    if(!to){toast('Enter a destination');return;}
    // in-app directions (classic Google embed) — no leaving the app
    const u='https://maps.google.com/maps?saddr='+encodeURIComponent(from)+'&daddr='+encodeURIComponent(to)+'&output=embed';
    openWeb(u,{title:'Route to '+to,embed:true,note:'In-app directions. For the live-traffic fastest route, use the Waze map above — tap your start then your destination.'});
  });
  $('#rtBig').addEventListener('click',()=>openWeb(waze,{title:'Live traffic map',embed:true,note:'Waze live traffic — red is heavy, orange moderate. Tap two points on the map for a route with live traffic.'}));
}
// turn any panel .oslink[data-u] into an in-app openWeb call
function wirePanelLinks(p){
  p.querySelectorAll('.oslink[data-u]').forEach(b=>b.addEventListener('click',()=>{
    const u=b.dataset.u;openWeb(u,{title:b.textContent.replace(/^[^\w]+/,'').trim(),embed:b.dataset.e==='1'||knownEmbed(u)});
  }));
}

/* =========================================================
   LIVE CAMERA REEL — full-screen, one camera per screen,
   flick up for the next (like Reels). Stays in the app.
   ========================================================= */
let _reelObs=null, REELSET=[];
const CAT_LABEL={m50:'M50 MOTORWAY',port:'DUBLIN PORT',district:'FITZGIBBON ST / MOUNTJOY'};
// category of a camera — inferred if the data file is missing the tag (robust to stale data)
function camCat(c){
  if(c.cat)return c.cat;
  if(c.img||c.road)return 'm50';                 // TII motorway snapshot cams
  if(/dublin port|poolbeg|liffey/i.test(c.n||''))return 'port';
  return 'district';
}
function ensureCamsData(cb){
  const need=[];
  if(!(LIVECAMS&&LIVECAMS.length)) need.push(fetch('data/livecams.json').then(r=>r.json()).then(d=>{LIVECAMS=d;}));
  if(!(TIICAMS&&TIICAMS.length)) need.push(fetch('data/tii_cams.json').then(r=>r.json()).then(d=>{TIICAMS=d;}));
  Promise.all(need).then(()=>{mergeTii();cb();}).catch(()=>{ if(LIVECAMS&&LIVECAMS.length){mergeTii();cb();} else toast('Cameras unavailable — needs signal once'); });
}
function buildReelEl(){
  let r=document.getElementById('osReel'); if(r)return r;
  r=document.createElement('div'); r.id='osReel'; r.className='hidden';
  r.innerHTML='<div class="reel-top"><button class="reel-x" id="reelClose">‹ Close</button>'
    +'<div class="reel-titles"><div class="reel-title" id="reelTitle">LIVE CAMERAS</div><div class="reel-grouptag" id="reelGroupTag"></div></div>'
    +'<button class="reel-gridbtn" id="reelGridBtn">▦ All</button></div>'
    +'<div class="reel-track" id="reelTrack"></div>'
    +'<div class="reel-gridview hidden" id="reelGridView"></div>'
    +'<div class="reel-hint" id="reelHint">▲ flick up for the next camera</div>';
  document.body.appendChild(r);
  document.getElementById('reelClose').addEventListener('click',closeReel);
  document.getElementById('reelGridBtn').addEventListener('click',toggleReelGrid);
  return r;
}
function ytThumb(id,q){return 'https://i.ytimg.com/vi/'+id+'/'+(q||'hqdefault')+'.jpg';}
function reelSlideHtml(c,i){
  const bg=c.yt?' style="background-image:url('+ytThumb(c.yt)+')"':'';
  const media = c.yt
    ? '<button class="rc-play" aria-label="Play">▶</button><span class="rc-load">LIVE</span>'
    : c.img
    ? '<img class="rc-img" data-src="'+esc(c.img)+'" alt="'+esc(c.n)+'"><span class="rc-load">LIVE · M50</span>'
    : '<div class="rc-ext"><div class="rc-extico">📹</div><b>'+esc(c.n)+'</b><span>'+esc(c.s)+' — plays on its own site</span><button class="rc-open osbtn">↗ Open live feed</button></div>';
  return '<div class="reelcam" data-i="'+i+'"><div class="reelcam-media"'+bg+'>'+media+'</div>'
    +'<div class="reelcam-cap"><div class="rc-name">'+esc(c.n)+(c.ap?' <span class="rc-approx">approx</span>':'')+'</div>'
    +'<div class="rc-meta"><span class="os-livetag">● LIVE</span> · '+esc(c.s)+' · '+c.lat.toFixed(4)+', '+c.lon.toFixed(4)+'</div>'
    +'<div class="rc-btns"><button class="rc-map">📍 On map</button><button class="rc-open">↗ Open</button></div></div></div>';
}
const _reelImgTimers={};
function loadReelIframe(sl){
  const i=+sl.dataset.i,c=REELSET[i]; if(!c)return;
  const media=sl.querySelector('.reelcam-media'); if(!media||media.dataset.loaded)return;
  if(c.yt){
    media.dataset.loaded='1';
    media.innerHTML='<iframe class="reelcam-vid" src="https://www.youtube.com/embed/'+c.yt+'?autoplay=1&mute=1&playsinline=1&rel=0&modestbranding=1&fs=1" allow="autoplay; fullscreen; encrypted-media" allowfullscreen></iframe>';
  } else if(c.img){
    media.dataset.loaded='1';
    const im=media.querySelector('.rc-img');
    if(im){ im.src=c.img+'?'+Date.now(); _reelImgTimers[i]=setInterval(()=>{ if(document.body.contains(im))im.src=c.img+'?'+Date.now(); else {clearInterval(_reelImgTimers[i]);delete _reelImgTimers[i];} },3000); }
  }
}
function unloadReelIframe(sl){
  const media=sl.querySelector('.reelcam-media'); if(!media||!media.dataset.loaded)return;
  const i=+sl.dataset.i,c=REELSET[i]; media.dataset.loaded='';
  if(_reelImgTimers[i]){clearInterval(_reelImgTimers[i]);delete _reelImgTimers[i];}
  if(c.img){ media.innerHTML='<img class="rc-img" data-src="'+esc(c.img)+'" alt="'+esc(c.n)+'"><span class="rc-load">LIVE · M50</span>'; return; }
  media.innerHTML='<button class="rc-play" aria-label="Play">▶</button><span class="rc-load">LIVE</span>';
  if(c.yt)media.style.backgroundImage='url('+ytThumb(c.yt)+')';
  const pb=media.querySelector('.rc-play'); pb&&pb.addEventListener('click',()=>loadReelIframe(sl));
}
function setupReelObserver(track){
  if(_reelObs)_reelObs.disconnect();
  _reelObs=new IntersectionObserver(ents=>{
    ents.forEach(e=>{
      const sl=e.target,i=+sl.dataset.i,c=REELSET[i],t=document.getElementById('reelTitle');
      if(e.isIntersecting&&e.intersectionRatio>0.55){ loadReelIframe(sl); if(t)t.textContent=(c.n||'LIVE').toUpperCase(); }
      else if(e.intersectionRatio<0.25){ unloadReelIframe(sl); }
    });
  },{threshold:[0,0.25,0.55,0.85],root:track});
  track.querySelectorAll('.reelcam').forEach(sl=>_reelObs.observe(sl));
}
function wireReelSlides(track){
  track.querySelectorAll('.reelcam').forEach(sl=>{
    const i=+sl.dataset.i,c=REELSET[i];
    sl.querySelectorAll('.rc-open').forEach(b=>b.addEventListener('click',ev=>{ev.stopPropagation();openWeb(c.u,{title:c.n,embed:!!c.yt||knownEmbed(c.u),note:'Live public webcam.'});}));
    const mb=sl.querySelector('.rc-map'); mb&&mb.addEventListener('click',ev=>{ev.stopPropagation();closeReel();openMapToCam(c);});
    const pb=sl.querySelector('.rc-play'); pb&&pb.addEventListener('click',()=>loadReelIframe(sl));
  });
}
function openMapToCam(c){
  open();   // ensure the map overlay exists and is shown
  const go=()=>{ if(!map)return setTimeout(go,200); if(!camsOn)toggleCams(); map.setView([c.lat,c.lon],16); setTimeout(()=>showFeed(c),300); };
  go();
}
function openCamReel(startIndex,cat,grid){
  ensureCamsData(()=>{
    REELSET = cat ? LIVECAMS.filter(c=>camCat(c)===cat) : LIVECAMS.slice();
    if(!REELSET.length){toast('No cameras in that group');return;}
    const r=buildReelEl(), track=document.getElementById('reelTrack');
    const gt=document.getElementById('reelGroupTag'); if(gt)gt.textContent=cat?(CAT_LABEL[cat]||''):'ALL CAMERAS';
    track.innerHTML=REELSET.map((c,i)=>reelSlideHtml(c,i)).join('');
    r.classList.remove('hidden'); document.body.classList.add('reel-open');
    wireReelSlides(track); setupReelObserver(track);
    if(grid){
      // open straight to the named grid so you can pick one fast
      buildReelGrid();
      const t=document.getElementById('reelTitle'); if(t)t.textContent='PICK A CAMERA';
      return;
    }
    document.getElementById('reelGridView').classList.add('hidden'); track.classList.remove('hidden');
    const si=startIndex&&startIndex>0&&startIndex<REELSET.length?startIndex:0;
    const first=track.children[si];
    if(first){ if(si)first.scrollIntoView(); loadReelIframe(first); const t=document.getElementById('reelTitle'); if(t)t.textContent=(REELSET[si].n||'LIVE').toUpperCase(); }
    const hint=document.getElementById('reelHint'); if(hint){hint.style.opacity='1';clearTimeout(hint._t);hint._t=setTimeout(()=>{hint.style.opacity='0';},3800);}
  });
}
function buildReelGrid(){
  const gv=document.getElementById('reelGridView'),track=document.getElementById('reelTrack'),btn=document.getElementById('reelGridBtn');
  gv.innerHTML=REELSET.map((c,i)=>'<button class="reelthumb" data-i="'+i+'"'+(c.yt?' style="background-image:url('+ytThumb(c.yt,'mqdefault')+')"':c.img?' style="background-image:url('+esc(c.img)+'?'+Date.now()+')"':'')+'><span class="rt-live">● LIVE</span><span class="rt-name">'+esc(c.n)+'</span></button>').join('');
  gv.classList.remove('hidden'); track.classList.add('hidden'); if(btn)btn.textContent='▤ Reel';
  gv.querySelectorAll('.reelthumb').forEach(b=>b.addEventListener('click',()=>{
    const i=+b.dataset.i; gv.classList.add('hidden'); track.classList.remove('hidden'); if(btn)btn.textContent='▦ All';
    const el=track.children[i]; if(el){el.scrollIntoView(); loadReelIframe(el); const t=document.getElementById('reelTitle'); if(t)t.textContent=(REELSET[i].n||'LIVE').toUpperCase();}
  }));
}
function toggleReelGrid(){
  const gv=document.getElementById('reelGridView'),track=document.getElementById('reelTrack'),btn=document.getElementById('reelGridBtn');
  if(!gv.classList.contains('hidden')){gv.classList.add('hidden');track.classList.remove('hidden');if(btn)btn.textContent='▦ All';return;}
  buildReelGrid();
}
function closeReel(){
  const r=document.getElementById('osReel'); if(!r)return;
  if(_reelObs){_reelObs.disconnect();_reelObs=null;}
  const track=document.getElementById('reelTrack'); if(track)track.innerHTML='';
  const gv=document.getElementById('reelGridView'); if(gv){gv.innerHTML='';gv.classList.add('hidden');}
  r.classList.add('hidden'); document.body.classList.remove('reel-open');
}
window.openCamReel=openCamReel;
window.openOSINT=open;
})();
