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
       <button class="os-r on" id="osGarda"><span>🛡️</span><em>GARDA</em><i class="rbadge" id="bGarda">96</i></button>
       <button class="os-r on" id="osDist"><span>▦</span><em>DIST</em><i class="rbadge" id="bDist">96</i></button>
       <button class="os-r" id="osCams"><span>📹</span><em>CAMS</em><i class="rbadge" id="bCams">7</i></button>
       <button class="os-r" id="osFlights"><span>✈️</span><em>AIR</em></button>
       <button class="os-r" id="osTransport"><span>🚌</span><em>TRANSIT</em></button>
       <button class="os-r" id="osList"><span>📷</span><em>LOG</em><i class="rbadge" id="bLog">${cctv.length}</i></button>
       <button class="os-r" id="osCam"><span>➕</span><em>PIN</em></button>
       <button class="os-r" id="osLoc"><span>📍</span><em>ME</em></button>
     </div>
     <div class="os-mode">
       <button id="osModeMap" class="on">◐ TACTICAL</button>
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
  $('#osModeMap').addEventListener('click',()=>setBase(false));
  $('#osModeSat').addEventListener('click',()=>setBase(true));
  $('#osCam').addEventListener('click',togglePlace);
  $('#osFlights').addEventListener('click',toggleFlights);
  $('#osLoc').addEventListener('click',locate);
  $('#osList').addEventListener('click',showList);
  $('#osGarda').addEventListener('click',toggleGarda);
  $('#osDist').addEventListener('click',toggleDist);
  $('#osCams').addEventListener('click',toggleCams);
  $('#osTransport').addEventListener('click',showTransport);
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
let baseStreets,baseSat,baseLabels,onSat=false;
let gardaLayer=null,camsLayer=null,STATIONS=[],LIVECAMS=[],gardaOn=false,camsOn=false;
let districtLayer=null,districtLabels=null,DISTRICTS=null,distOn=false,_divmap=null,_featShown=false;
const HOME_DIST='Fitzgibbon Street'; // Mountjoy Station's district — highlighted as "your patch"
function initMap(){
  if(map)return;
  map=L.map('osmap',{zoomControl:false,attributionControl:true}).setView(DUB,14);
  L.control.zoom({position:'bottomright'}).addTo(map);
  // keyless dark tactical basemap (Esri Dark Gray) — no API key required
  baseStreets=L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
    {maxZoom:16,attribution:'Esri — dark canvas'});
  baseLabels=L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}',
    {maxZoom:16,pane:'markerPane'});
  baseSat=L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    {maxZoom:19,attribution:'Imagery © Esri'});
  // fallback dark tiles from OSM/CARTO community mirror if Esri is slow
  baseStreets.on('tileerror',function(){ if(!baseStreets._fb){baseStreets._fb=1;
    baseStreets.setUrl('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'); baseStreets.options.subdomains='abcd'; } });
  baseStreets.addTo(map); baseLabels.addTo(map);
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
  fetch('data/livecams.json').then(r=>r.json()).then(d=>{LIVECAMS=d;autoDefaults();}).catch(()=>{});
  drawCameras();
  // drawing / measuring tools
  try{
    map.pm.addControls({position:'topright',drawCircleMarker:false,rotateMode:false,
      drawText:false,cutPolygon:false});
    map.pm.setLang('en');
    map.on('pm:create',e=>{
      const l=e.layer; const t=e.shape;
      if(t==='Line'){const m=measureLine(l);l.bindPopup('Distance: '+m).openPopup();}
      if(t==='Polygon'){const a=measureArea(l);l.bindPopup('Area: '+a).openPopup();}
    });
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
  if(STATIONS.length && !gardaOn) toggleGarda();
  if(LIVECAMS.length && !camsOn) toggleCams();
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

function setBase(sat){
  onSat=sat;
  const mm=$('#osModeMap'),ms=$('#osModeSat');
  if(sat){map.removeLayer(baseStreets);map.removeLayer(baseLabels);baseSat.addTo(map);document.querySelector('#osmap').classList.add('sat');mm&&mm.classList.remove('on');ms&&ms.classList.add('on');}
  else{map.removeLayer(baseSat);baseStreets.addTo(map);baseLabels.addTo(map);document.querySelector('#osmap').classList.remove('sat');ms&&ms.classList.remove('on');mm&&mm.classList.add('on');}
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
     toast('Live flights unavailable — opening FlightRadar');
     const c2=map.getCenter();window.open(`https://www.flightradar24.com/${c2.lat.toFixed(4)},${c2.lng.toFixed(4)}/12`,'_blank');
     flightsOn=false;$('#osFlights').classList.remove('on');clearInterval(flightTimer);
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
const DIV_PAL=['#d4af37','#39c2d7','#c084fc','#6ee7a8','#ffb066','#ff7a7a','#69b7ff','#ffd34d','#a3e05b','#e879c9','#4fd1c5','#f6a24b','#9aa8ff','#f491b6','#8fb4d9','#ecc94b','#7fd1c2','#b794f4','#f6a1a1','#8bd17a'];
function distColor(dv){
  if(!_divmap){_divmap={};const ds=[...new Set(DISTRICTS.features.map(f=>f.properties.dv))].sort();ds.forEach((d,i)=>_divmap[d]=DIV_PAL[i%DIV_PAL.length]);}
  return _divmap[dv]||'#d4af37';
}
function distStyle(f){
  const home=f.properties.d===HOME_DIST;
  return {color:home?'#3fe0ff':'#d4af37',weight:home?2.4:0.8,opacity:home?0.95:0.5,
          fillColor:distColor(f.properties.dv),fillOpacity:home?0.30:0.12,dashArray:home?null:'3 3'};
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

function gardaIcon(hq){return L.divIcon({className:'gdaIcon'+(hq?' hq':''),html:'🛡️',iconSize:[26,26],iconAnchor:[13,13]});}
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
function camsIcon(live){return L.divIcon({className:'liveCamIcon'+(live?' isLive':''),html:live?'🔴':'📹',iconSize:[26,26],iconAnchor:[13,13]});}
function toggleCams(){
  camsOn=!camsOn; $('#osCams').classList.toggle('on',camsOn);
  if(!camsOn){map.removeLayer(camsLayer);return;}
  camsLayer.clearLayers();
  LIVECAMS.forEach((c,i)=>{
    const m=L.marker([c.lat,c.lon],{icon:camsIcon(c.yt)}).addTo(camsLayer);
    m.on('click',()=>showFeed(c));
  });
  camsLayer.addTo(map);
  toast(LIVECAMS.length+' public webcams · tap to view');
}
function showFeed(c){
  const p=$('#osPanel');p.classList.remove('hidden');
  const embed = c.yt
    ? '<div class="os-feedwrap"><iframe class="os-feedvid" src="https://www.youtube.com/embed/'+c.yt+'?autoplay=1&mute=1&playsinline=1&rel=0" allow="autoplay; fullscreen" allowfullscreen></iframe></div>'
    : '<div class="os-feednoembed">This camera plays on its own site — tap “Open live feed” to watch it here in the app.</div>';
  p.innerHTML='<div class="os-panel-in"><div class="osp-head os-feedhead"><div><b>📹 '+esc(c.n)+'</b>'+
    '<div class="os-feedmeta">'+c.lat.toFixed(4)+', '+c.lon.toFixed(4)+' · '+esc(c.s)+' · <span class="os-livetag">● LIVE</span></div></div>'+
    '<button class="osx" id="ospClose">✕</button></div>'+
    embed+
    '<div class="osp-btns"><button class="osbtn wide" id="feedOpen">↗ Open live feed (source)</button>'+
    '<button class="osbtn" id="feedCams">📹 More cams</button></div>'+
    '<p class="osp-empty">Public webcam — not private or Garda CCTV. Everything opens here in the app.</p></div>';
  $('#ospClose').addEventListener('click',()=>p.classList.add('hidden'));
  $('#feedOpen').addEventListener('click',()=>openWeb(c.u,{title:c.n,embed:!!c.yt||knownEmbed(c.u),note:'Live public webcam source.'}));
  $('#feedCams').addEventListener('click',()=>openWeb('https://embed.windy.com/embed2.html?type=map&location=coordinates&zoom=12&overlay=webcams&lat='+c.lat+'&lon='+c.lon,{title:'Public webcams near '+c.n,embed:true}));
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
// turn any panel .oslink[data-u] into an in-app openWeb call
function wirePanelLinks(p){
  p.querySelectorAll('.oslink[data-u]').forEach(b=>b.addEventListener('click',()=>{
    const u=b.dataset.u;openWeb(u,{title:b.textContent.replace(/^[^\w]+/,'').trim(),embed:b.dataset.e==='1'||knownEmbed(u)});
  }));
}
window.openOSINT=open;
})();
