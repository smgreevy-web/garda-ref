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
   <div class="os-top">
     <button id="osBack" class="iconbtn" aria-label="Back">‹</button>
     <input id="osSearch" type="search" placeholder="Search address or place in Dublin…" autocomplete="off">
     <button id="osLinks" class="iconbtn" title="OSINT links">☰</button>
   </div>
   <div id="osmap"></div>
   <div class="os-bar">
     <button class="osbtn" id="osBase">🛰️ Satellite</button>
     <button class="osbtn" id="osCam">📷 Add camera</button>
     <button class="osbtn" id="osFlights">✈️ Flights</button>
     <button class="osbtn" id="osLoc">📍 Me</button>
     <button class="osbtn" id="osList">📷 Log (${cctv.length})</button>
   </div>
   <div id="osPanel" class="os-panel hidden"></div>
   <div class="os-caution">⚠️ Public-source intelligence only. Sustained monitoring of an identifiable person can become directed surveillance under GDPR / the Law Enforcement Directive — get the required authorisation or it may be inadmissible.</div>`;
  document.body.appendChild(o);
  $('#osBack').addEventListener('click',close);
  $('#osLinks').addEventListener('click',showLinks);
  $('#osSearch').addEventListener('keydown',e=>{if(e.key==='Enter')geocode(e.target.value);});
  $('#osBase').addEventListener('click',toggleBase);
  $('#osCam').addEventListener('click',togglePlace);
  $('#osFlights').addEventListener('click',toggleFlights);
  $('#osLoc').addEventListener('click',locate);
  $('#osList').addEventListener('click',showList);
  built=true;
}

let baseStreets,baseSat,onSat=false;
function initMap(){
  if(map)return;
  map=L.map('osmap',{zoomControl:true,attributionControl:true}).setView(DUB,14);
  baseStreets=L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    {maxZoom:19,attribution:'© OpenStreetMap'});
  baseSat=L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    {maxZoom:19,attribution:'Imagery © Esri'});
  baseStreets.addTo(map);
  L.control.scale({imperial:false}).addTo(map);
  cctvLayer=L.layerGroup().addTo(map);
  flightLayer=L.layerGroup();
  drawCameras();
  // drawing / measuring tools
  try{
    map.pm.addControls({position:'topleft',drawCircleMarker:false,rotateMode:false,
      drawText:false,cutPolygon:false});
    map.pm.setLang('en');
    map.on('pm:create',e=>{
      const l=e.layer; const t=e.shape;
      if(t==='Line'){const m=measureLine(l);l.bindPopup('Distance: '+m).openPopup();}
      if(t==='Polygon'){const a=measureArea(l);l.bindPopup('Area: '+a).openPopup();}
    });
  }catch(e){}
  // click for point actions (unless placing a camera or drawing)
  map.on('click',e=>{
    if(placing){addCameraAt(e.latlng);return;}
    if(map.pm && map.pm.globalDrawModeEnabled && map.pm.globalDrawModeEnabled())return;
    pointPopup(e.latlng);
  });
  // night layer
  try{buildNight();}catch(e){}
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

function toggleBase(){
  onSat=!onSat;
  if(onSat){map.removeLayer(baseStreets);baseSat.addTo(map);$('#osBase').textContent='🗺️ Streets';}
  else{map.removeLayer(baseSat);baseStreets.addTo(map);$('#osBase').textContent='🛰️ Satellite';}
}

// ---- point actions popup ----
function pointPopup(ll){
  const la=ll.lat.toFixed(6),lo=ll.lng.toFixed(6);
  const gm=`https://www.google.com/maps/search/?api=1&query=${la},${lo}`;
  const sv=`https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${la},${lo}`;
  const ge=`https://earth.google.com/web/@${la},${lo},0a,300d,35y,0h,45t,0r`;
  const bing=`https://www.bing.com/maps?cp=${la}~${lo}&lvl=19&style=o`;
  const fr=`https://www.flightradar24.com/${la},${lo}/14`;
  const mt=`https://www.marinetraffic.com/en/ais/home/centerx:${lo}/centery:${la}/zoom:13`;
  const html=`<div class="ospop"><b>${la}, ${lo}</b>
   <button class="oscopy" data-c="${la}, ${lo}">⧉ copy coords</button>
   <a href="${sv}" target="_blank">🧍 Street View here</a>
   <a href="${gm}" target="_blank">🗺️ Google Maps</a>
   <a href="${ge}" target="_blank">🌍 Google Earth 3D</a>
   <a href="${bing}" target="_blank">🦅 Bing Bird's-eye</a>
   <a href="${fr}" target="_blank">✈️ FlightRadar here</a>
   <a href="${mt}" target="_blank">🚢 MarineTraffic here</a>
   <button class="oscam2" data-la="${ll.lat}" data-lo="${ll.lng}">📷 Log a camera here</button></div>`;
  const p=L.popup({maxWidth:250}).setLatLng(ll).setContent(html).openOn(map);
  setTimeout(()=>{
    const el=document.querySelector('.ospop');if(!el)return;
    const cb=el.querySelector('.oscopy');cb&&cb.addEventListener('click',()=>{navigator.clipboard.writeText(cb.dataset.c).then(()=>toast('Coordinates copied')).catch(()=>{});});
    const c2=el.querySelector('.oscam2');c2&&c2.addEventListener('click',()=>{map.closePopup();addCameraAt({lat:+c2.dataset.la,lng:+c2.dataset.lo});});
  },30);
}

// ---- CCTV pins ----
function camIcon(){return L.divIcon({className:'camIcon',html:'📷',iconSize:[28,28],iconAnchor:[14,14]});}
function drawCameras(){
  cctvLayer.clearLayers();
  cctv.forEach((c,i)=>{
    L.marker([c.lat,c.lon],{icon:camIcon()}).addTo(cctvLayer).on('click',()=>editCamera(i));
  });
  const lb=$('#osList');if(lb)lb.textContent='📷 Log ('+cctv.length+')';
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
   ${LINKS.map(([h,items])=>`<div class="oslgrp"><div class="oslh">${esc(h)}</div>${items.map(([n,u])=>`<a class="oslink" href="${u}" target="_blank" rel="noopener">${esc(n)} ↗</a>`).join('')}</div>`).join('')}
   <p class="osp-empty">All open in your browser. Sign-ins (if any) are yours. Nothing here is logged by the app.</p></div>`;
  $('#ospClose').addEventListener('click',()=>p.classList.add('hidden'));
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
window.openOSINT=open;
})();
