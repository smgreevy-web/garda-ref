/* Assisting — Emergency route: the most direct way to a call.
   A road route that may use any road or lane, ignoring one-way streets and turn bans (Valhalla routing on OpenStreetMap,
   the FOSSGIS public server), drawn against the normal route and the straight line, with the distance and bearing as the
   crow flies and a live arrow that points at the call. Works with Google Maps both ways: paste a Google Maps link (or
   copied coordinates) as the destination, and hand the call to Google Maps — straight there, or along the direct route
   with up to 3 stops where it differs (Google still obeys one-way streets) — for the phone, CarPlay or Android Auto.
   Apple Maps and Waze too. Needs signal for search, routing and map tiles.
   Voice guidance reads the direct route out turn by turn ("in 300 metres, turn left onto…"), says when you're off the
   route (and finds a new one), and when you've arrived — using the phone's own text-to-speech, while this screen is open.
   Nothing is saved: the destination and route are kept only while this screen is open. */
(function(){
'use strict';
const W=window, D=document;
const DEG=Math.PI/180, R2D=180/Math.PI, MIN=60e3;
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const p2=n=>String(n).padStart(2,'0');
const svg=p=>'<svg viewBox="0 0 24 24" aria-hidden="true">'+p+'</svg>';
const IC={
 back:'<path d="m15 18-6-6 6-6"/>',
 me:'<circle cx="12" cy="12" r="3.5"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/><circle cx="12" cy="12" r="8"/>',
 pin:'<path d="M12 21.5s-6.5-6-6.5-11.5a6.5 6.5 0 0 1 13 0c0 5.5-6.5 11.5-6.5 11.5z"/><circle cx="12" cy="10" r="2.4"/>',
 route:'<circle cx="6" cy="19" r="2.5"/><circle cx="18" cy="5" r="2.5"/><path d="M8.5 19H16a3.5 3.5 0 0 0 0-7H8a3.5 3.5 0 0 1 0-7h7.5"/>',
 again:'<path d="M20 12a8 8 0 1 1-2.4-5.7"/><path d="M20.5 3.5v5h-5"/>',
 list:'<path d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01"/>',
 compass:'<circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5z"/>',
 x:'<path d="M18 6 6 18M6 6l12 12"/>',
 search:'<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/>',
 ext:'<path d="M14 4h6v6M20 4l-9 9"/><path d="M18 14v5.5a1.5 1.5 0 0 1-1.5 1.5h-12A1.5 1.5 0 0 1 3 19.5v-12A1.5 1.5 0 0 1 4.5 6H10"/>',
 spk:'<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M15.5 9a4 4 0 0 1 0 6M18.3 6.3a8 8 0 0 1 0 11.4"/>',
 mute:'<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="m16 9.5 5 5M21 9.5l-5 5"/>',
 play:'<path d="M7 4.5v15l12-7.5z"/>'
};
/* turn arrows for the next-turn banner */
const TURN={s:'<path d="M12 20.5V4M6 10l6-6 6 6"/>',r:'<path d="M6 20.5V12a4 4 0 0 1 4-4h10M16 4l4 4-4 4"/>',l:'<path d="M18 20.5V12a4 4 0 0 0-4-4H4M8 4 4 8l4 4"/>',
 sr:'<path d="M8 20.5v-7l8.5-8.5M11.5 5h5v5"/>',sl:'<path d="M16 20.5v-7L7.5 5M12.5 5h-5v5"/>',u:'<path d="M8 20.5V9a4 4 0 0 1 8 0v5M12.5 10.5l3.5 3.5 3.5-3.5"/>',
 rb:'<circle cx="12" cy="9.5" r="4"/><path d="M12 13.5v7M14.8 6.7 18 3.5M14.5 3.5H18V7"/>',dest:'<path d="M5.5 21V4M5.5 4h11l-2 4 2 4h-11"/>'};
const turnIcon=t=>TURN[({9:'sr',10:'r',11:'r',12:'u',13:'u',14:'l',15:'l',16:'sl',18:'sr',19:'sl',20:'sr',21:'sl',23:'sr',24:'sl',37:'sr',38:'sl',26:'rb',27:'rb',4:'dest',5:'dest',6:'dest'})[t]||'s'];
const GM='<svg viewBox="0 0 24 24" class="gmi" aria-hidden="true"><path d="M12 21.5s-6.5-6-6.5-11.5a6.5 6.5 0 0 1 13 0c0 5.5-6.5 11.5-6.5 11.5z"/><circle cx="12" cy="10" r="2.4"/></svg>';
const VALHALLA='https://valhalla1.openstreetmap.de/route';
const NOMINATIM='https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&countrycodes=ie&accept-language=en&viewbox=-6.55,53.50,-6.00,53.20&q=';

/* ---------- maths ---------- */
function dist(a,b){ const R=6371008.8, f1=a.lat*DEG, f2=b.lat*DEG, df=(b.lat-a.lat)*DEG, dl=(b.lon-a.lon)*DEG;
  const h=Math.sin(df/2)**2+Math.cos(f1)*Math.cos(f2)*Math.sin(dl/2)**2; return 2*R*Math.asin(Math.min(1,Math.sqrt(h))); }
function bearing(a,b){ const f1=a.lat*DEG, f2=b.lat*DEG, dl=(b.lon-a.lon)*DEG;
  return (Math.atan2(Math.sin(dl)*Math.cos(f2),Math.cos(f1)*Math.sin(f2)-Math.sin(f1)*Math.cos(f2)*Math.cos(dl))*R2D+360)%360; }
const POINTS=['north','north-east','east','south-east','south','south-west','west','north-west'];
const compass=b=>POINTS[Math.round(b/45)%8];
const km=m=>m<1000?Math.round(m/10)*10+' m':(m/1000).toFixed(m<10000?1:0)+' km';
const mins=s=>s<60?'under 1 min':Math.round(s/60)+' min';
const wrap360=a=>((a%360)+360)%360;
const scrAngle=()=>{ try{ return (screen.orientation&&screen.orientation.angle)||W.orientation||0; }catch(e){ return 0; } };
function headingOf(a,b,g){ const x=b*DEG,y=g*DEG,z=a*DEG,cX=Math.cos(x),cY=Math.cos(y),cZ=Math.cos(z),sX=Math.sin(x),sY=Math.sin(y),sZ=Math.sin(z);
  const Vx=-cZ*sY-sZ*sX*cY, Vy=-sZ*sY+cZ*sX*cY; void cX;
  if(Math.hypot(Vx,Vy)>0.5)return wrap360(Math.atan2(Vx,Vy)*R2D);
  return wrap360(360-a+scrAngle()); }
function decode6(str){ let i=0,lat=0,lon=0; const out=[];
  while(i<str.length){ let b,s=0,r=0; do{ b=str.charCodeAt(i++)-63; r|=(b&31)<<s; s+=5; }while(b>=32); lat+=(r&1)?~(r>>1):(r>>1);
    s=0; r=0; do{ b=str.charCodeAt(i++)-63; r|=(b&31)<<s; s+=5; }while(b>=32); lon+=(r&1)?~(r>>1):(r>>1); out.push([lat/1e6,lon/1e6]); }
  return out; }
const okLL=(lat,lon)=>isFinite(lat)&&isFinite(lon)&&Math.abs(lat)<=90&&Math.abs(lon)<=180&&!(lat===0&&lon===0)?{lat,lon}:null;
function parseLL(q){ q=String(q||'').trim(); let m=/^(-?\d{1,2}\.\d{2,})\s*[, ]\s*(-?\d{1,3}\.\d{2,})$/.exec(q); if(m)return okLL(+m[1],+m[2]);
  if(!/^https?:\/\/|maps\.|goo\.gl/i.test(q))return null;
  let u=q; try{ u=decodeURIComponent(q); }catch(e){}
  m=/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/.exec(u); if(m)return okLL(+m[1],+m[2]);                       // Google place link: the place itself
  m=/[?&](?:q|query|ll|sll|daddr|destination|center)=(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)/.exec(u); if(m)return okLL(+m[1],+m[2]);   // ?q=lat,lon · Apple ?ll=
  m=/@(-?\d+\.\d+),(-?\d+\.\d+)/.exec(u); if(m)return okLL(+m[1],+m[2]);                             // map view centre
  return null; }
const isShortLink=q=>/\b(?:maps\.app\.goo\.gl|goo\.gl\/maps|g\.co\/kgs)\//i.test(q||'');

/* ---------- state ---------- */
let ov=null, map=null, lay=null, meMk=null, accC=null, toMk=null, watchId=null, wake=null, oriOn=false;
const S={me:null,to:null,toName:'',emer:null,norm:null,busy:false,err:'',picking:false,turns:false,head:null,follow:true,res:null,q:'',voice:true,nav:null,reroute:false};
try{ S.voice=localStorage.getItem('gr_rt_voice')!=='0'; }catch(e){}
let ctl=null;

function build(){
  if(ov&&ov.isConnected)return;
  ov=D.createElement('div'); ov.id='rte'; ov.hidden=true; ov.setAttribute('role','dialog'); ov.setAttribute('aria-label','Emergency route');
  ov.innerHTML='<div class="rt-top"><button type="button" class="rt-back">'+svg(IC.back)+'Back</button><div class="rt-tt"><b>Emergency route</b><span class="hudclock" data-f="line"></span></div>'
    +'<button type="button" class="rt-ib rt-vo" aria-pressed="true" aria-label="Voice guidance">'+svg(IC.spk)+'</button><button type="button" class="rt-ib rt-me" aria-label="Centre on my position">'+svg(IC.me)+'</button></div>'
    +'<form class="rt-q" autocomplete="off"><input class="rt-in" type="search" enterkeyhint="go" placeholder="Address, place, lat, long or a Google Maps link" aria-label="Where is the call?"><button type="submit" class="rt-go" aria-label="Find">'+svg(IC.search)+'</button></form>'
    +'<div class="rt-res" hidden></div>'
    +'<div class="rt-map"><div class="rt-pickhint" hidden>Tap the map where the call is</div><button type="button" class="rt-next" hidden aria-live="polite"></button></div>'
    +'<div class="rt-panel"></div><div class="rt-toast"></div>';
  D.body.appendChild(ov);
  ov.querySelector('.rt-back').onclick=()=>back();
  ov.querySelector('.rt-me').onclick=()=>{ S.follow=true; if(S.me&&map)map.setView([S.me.lat,S.me.lon],Math.max(map.getZoom(),16)); else toast('Waiting for your position…'); };
  ov.querySelector('.rt-q').onsubmit=e=>{ e.preventDefault(); const v=ov.querySelector('.rt-in').value.trim(); if(v)search(v); };
  ov.querySelector('.rt-vo').onclick=()=>setVoice(!S.voice);
  ov.querySelector('.rt-next').onclick=()=>sayNext(true);
  paintVo();
}
function toast(m){ const t=ov&&ov.querySelector('.rt-toast'); if(!t)return; t.textContent=m; t.classList.add('on'); clearTimeout(t._t); t._t=setTimeout(()=>t.classList.remove('on'),3200); }
function ensureMap(){
  if(map||!W.L)return map;
  const host=ov.querySelector('.rt-map'), el=D.createElement('div'); el.className='rt-mapc'; host.insertBefore(el,host.firstChild);
  map=L.map(el,{zoomControl:false,attributionControl:true,preferCanvas:true}).setView([53.3564,-6.2560],14);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,subdomains:'abc',attribution:'© OpenStreetMap contributors · routing Valhalla / FOSSGIS'}).addTo(map);
  L.control.zoom({position:'bottomright'}).addTo(map); L.control.scale({imperial:false,position:'bottomleft'}).addTo(map);
  lay=L.layerGroup().addTo(map);
  map.on('dragstart',()=>{ S.follow=false; });
  map.on('click',e=>{ if(!S.picking)return; S.picking=false; ov.querySelector('.rt-pickhint').hidden=true; setTo({lat:e.latlng.lat,lon:e.latlng.lng},'Point on the map'); });
  return map; }

/* ---------- open / close ---------- */
function openRoute(dest){
  build(); const bt=D.getElementById('boot'); if(bt&&bt.parentNode)bt.parentNode.removeChild(bt);
  ov.hidden=false; D.body.classList.add('rte-open'); ensureMap(); setTimeout(()=>{ try{ map&&map.invalidateSize(); }catch(e){} },80);
  startGPS(); keepAwake(true);
  if(dest&&dest.lat!=null&&dest.lon!=null)setTo({lat:+dest.lat,lon:+dest.lon},dest.name||dest.n||'Destination');
  else paint();
  if(W.grHudTick)W.grHudTick(); return true; }
function closeRoute(){ if(!ov||ov.hidden)return; ov.hidden=true; D.body.classList.remove('rte-open'); stopGPS(); keepAwake(false); stopOri(); hush(); if(ctl){ try{ ctl.abort(); }catch(e){} ctl=null; } }
function back(){ if(!ov||ov.hidden)return false;
  if(S.picking){ S.picking=false; ov.querySelector('.rt-pickhint').hidden=true; paint(); return true; }
  const r=ov.querySelector('.rt-res'); if(!r.hidden){ r.hidden=true; return true; }
  if(S.turns){ S.turns=false; paint(); return true; }
  closeRoute(); return true; }

/* ---------- position, compass, screen ---------- */
function startGPS(){ if(watchId!=null||!('geolocation' in navigator))return;
  watchId=navigator.geolocation.watchPosition(p=>{ const c=p.coords, prev=S.me, t=Date.now();
    let sp=(c.speed!=null&&!isNaN(c.speed))?c.speed:null; if(sp==null&&prev&&t-prev.t>500&&t-prev.t<15e3)sp=dist(prev,{lat:c.latitude,lon:c.longitude})/((t-prev.t)/1000);
    S.me={lat:c.latitude,lon:c.longitude,acc:c.accuracy,hd:(c.heading!=null&&!isNaN(c.heading)&&c.speed>2)?c.heading:null,sp,t}; const first=S.err==='gps'; if(first)S.err=''; drawMe(); if(first&&S.to&&!S.busy){ route(); return; } navStep(); paintInfo(); },
    e=>{ S.gpsErr=e&&e.code===1?'Location is blocked — allow it for this site to route from where you are.':'No GPS fix yet.'; paintInfo(); },
    {enableHighAccuracy:true,maximumAge:3000,timeout:20000}); }
function stopGPS(){ if(watchId!=null){ try{ navigator.geolocation.clearWatch(watchId); }catch(e){} watchId=null; } }
async function keepAwake(on){ try{ if(on){ if(!wake&&navigator.wakeLock)wake=await navigator.wakeLock.request('screen'); } else if(wake){ await wake.release(); wake=null; } }catch(e){ wake=null; } }
D.addEventListener('visibilitychange',()=>{ if(D.visibilityState==='visible'&&ov&&!ov.hidden){ wake=null; keepAwake(true); } });
function onOri(e){ let h=null;
  if(e.webkitCompassHeading!=null&&!isNaN(e.webkitCompassHeading))h=+e.webkitCompassHeading;
  else if((e.absolute===true||e.type==='deviceorientationabsolute')&&e.alpha!=null)h=headingOf(+e.alpha,+e.beta||0,+e.gamma||0);
  if(h==null)return; S.head=h; paintArrow(); }
function startOri(){ if(oriOn)return; const go=()=>{ oriOn=true; if('ondeviceorientationabsolute' in W)W.addEventListener('deviceorientationabsolute',onOri); W.addEventListener('deviceorientation',onOri); setTimeout(()=>{ if(S.head==null)toast('No compass on this device — the arrow uses map north'); },2500); };
  const P=W.DeviceOrientationEvent; if(P&&typeof P.requestPermission==='function')P.requestPermission().then(r=>{ if(r==='granted')go(); else toast('Compass not allowed'); }).catch(()=>toast('Compass not allowed')); else go(); }
function stopOri(){ if(!oriOn)return; oriOn=false; W.removeEventListener('deviceorientationabsolute',onOri); W.removeEventListener('deviceorientation',onOri); S.head=null; }

/* ---------- map drawing ---------- */
function drawMe(){ if(!map||!S.me)return; const ll=[S.me.lat,S.me.lon];
  if(!meMk){ meMk=L.marker(ll,{icon:L.divIcon({className:'',html:'<div class="rt-mek"><b></b></div>',iconSize:[20,20],iconAnchor:[10,10]}),interactive:false,zIndexOffset:900}).addTo(map);
    accC=L.circle(ll,{radius:S.me.acc||30,weight:1,color:'#2f6fc0',fillOpacity:.08,interactive:false}).addTo(map); }
  else { meMk.setLatLng(ll); accC.setLatLng(ll).setRadius(S.me.acc||30); }
  if(S.follow&&!S.to)map.setView(ll,Math.max(map.getZoom(),15),{animate:false});
  else if(S.follow&&S.nav&&!S.nav.arrived){ const pt=map.latLngToContainerPoint(ll), sz=map.getSize(); if(pt.x<sz.x*.18||pt.x>sz.x*.82||pt.y<sz.y*.3||pt.y>sz.y*.85)map.panTo(ll,{animate:true}); }   // keep you on screen while driving
  drawLine(); }
function drawLine(){ if(!map)return; if(S._crow){ lay.removeLayer(S._crow); S._crow=null; }
  if(S.me&&S.to)S._crow=L.polyline([[S.me.lat,S.me.lon],[S.to.lat,S.to.lon]],{color:'#d6455d',weight:2.5,dashArray:'4 8',opacity:.9,interactive:false}).addTo(lay); }
function drawAll(){ if(!map)return; lay.clearLayers(); S._crow=null; toMk=null;
  if(S.norm&&S.norm.pts)L.polyline(S.norm.pts,{color:'#7d8794',weight:5,opacity:.65,interactive:false}).addTo(lay);
  if(S.emer&&S.emer.pts){ L.polyline(S.emer.pts,{color:'#ffffff',weight:9,opacity:.9,interactive:false}).addTo(lay); L.polyline(S.emer.pts,{color:'#c81d3a',weight:5.5,opacity:1,interactive:false}).addTo(lay); }
  if(S.to)toMk=L.marker([S.to.lat,S.to.lon],{icon:L.divIcon({className:'',html:'<div class="rt-tok">'+svg(IC.pin)+'</div>',iconSize:[34,34],iconAnchor:[17,32]}),interactive:false,zIndexOffset:1000}).addTo(lay);
  drawLine(); }
function fit(){ if(!map)return; const pts=[]; if(S.me)pts.push([S.me.lat,S.me.lon]); if(S.to)pts.push([S.to.lat,S.to.lon]); if(S.emer&&S.emer.pts)S.emer.pts.forEach(p=>pts.push(p));
  if(pts.length===1)map.setView(pts[0],16); else if(pts.length)map.fitBounds(L.latLngBounds(pts),{paddingTopLeft:[36,S.emer?100:36],paddingBottomRight:[36,36],maxZoom:17}); }

/* ---------- search ---------- */
async function search(q){ S.q=q; const ll=parseLL(q); const box=ov.querySelector('.rt-res');
  if(ll){ box.hidden=true; setTo(ll,(/^https?:/i.test(q)?'From the map link · ':'')+ll.lat.toFixed(5)+', '+ll.lon.toFixed(5)); return; }
  if(isShortLink(q)){ box.hidden=false; box.innerHTML='<p class="rt-note">Short Google Maps links don’t carry the location, so they can’t be read here. In Google Maps, press and hold the spot, copy the coordinates it shows, and paste them here — or type the address.</p>'; return; }
  if(/^https?:\/\//i.test(q)){ box.hidden=false; box.innerHTML='<p class="rt-note">No location found in that link. Paste the coordinates (lat, long) or type the address.</p>'; return; }
  if(navigator.onLine===false){ toast('No signal — type the coordinates (lat, long) or tap the map'); return; }
  box.hidden=false; box.innerHTML='<div class="rt-busy"><i></i>Searching…</div>';
  try{ const r=await fetch(NOMINATIM+encodeURIComponent(q),{headers:{'Accept':'application/json'}}); if(!r.ok)throw new Error('HTTP '+r.status); const j=await r.json();
    const L2=(Array.isArray(j)?j:[]).map(x=>({lat:+x.lat,lon:+x.lon,n:x.name||String(x.display_name||'').split(',')[0],a:String(x.display_name||'').split(',').slice(1,4).join(',').trim()}));
    if(!L2.length){ box.innerHTML='<p class="rt-note">Nothing found for “'+esc(q)+'”. Try the street and the town, paste coordinates, or <button type="button" class="rt-lnk" data-pick>tap the map</button>.</p>'; }
    else box.innerHTML=L2.map((x,i)=>'<button type="button" class="rt-hit" data-i="'+i+'">'+svg(IC.pin)+'<span><b>'+esc(x.n)+'</b><small>'+esc(x.a)+'</small></span></button>').join('')+'<p class="rt-note sm">Search © OpenStreetMap contributors (Nominatim)</p>';
    box.querySelectorAll('[data-i]').forEach(b=>b.onclick=()=>{ const x=L2[+b.dataset.i]; box.hidden=true; setTo({lat:x.lat,lon:x.lon},x.n+(x.a?', '+x.a.split(',')[0]:'')); });
    const pk=box.querySelector('[data-pick]'); if(pk)pk.onclick=()=>{ box.hidden=true; pick(); };
  }catch(e){ box.innerHTML='<p class="rt-note">Couldn’t search right now — check your signal. You can also paste coordinates or tap the map.</p>'; } }
function pick(){ S.picking=true; ov.querySelector('.rt-pickhint').hidden=false; paint(); }
function setTo(p,name){ hush(); S.to={lat:p.lat,lon:p.lon}; S.toName=name||''; S.emer=null; S.norm=null; S.nav=null; S.err=''; S.turns=false; S.reroute=false; drawAll(); fit(); route(); }

/* ---------- routing (Valhalla): emergency = ignore one-ways, turn bans and access; normal = the usual rules ---------- */
async function valhalla(from,to,emer,signal){
  const opt=emer?{ignore_oneways:true,ignore_restrictions:true,ignore_access:true,ignore_closures:true,service_penalty:0,use_living_streets:1}:{};
  const body={locations:[{lat:from.lat,lon:from.lon},{lat:to.lat,lon:to.lon}],costing:'auto',costing_options:{auto:opt},directions_options:{units:'kilometers',language:'en-GB'}};
  const r=await fetch(VALHALLA+'?json='+encodeURIComponent(JSON.stringify(body)),{signal}); const d=await r.json().catch(()=>({}));
  if(!r.ok||!d.trip){ const m=d.error||('HTTP '+r.status); throw new Error(/no suitable edges|no path/i.test(m)?'No road found near one of the points — move it onto a road.':m); }
  const leg=d.trip.legs[0];
  return {km:d.trip.summary.length,s:d.trip.summary.time,pts:decode6(leg.shape),man:(leg.maneuvers||[]).map(m=>({i:m.instruction||'',km:m.length||0,type:m.type,b:m.begin_shape_index||0,
    va:m.verbal_transition_alert_instruction||'',vp:m.verbal_pre_transition_instruction||'',vpo:m.verbal_post_transition_instruction||''}))}; }
async function route(){
  if(!S.to)return paint();
  if(!S.me){ S.err='gps'; paint(); return; }
  if(navigator.onLine===false){ S.err='No signal — the route needs signal. The straight line and bearing still work.'; paint(); return; }
  if(ctl){ try{ ctl.abort(); }catch(e){} } ctl=new AbortController(); const sig=ctl.signal;
  S.busy=true; S.err=''; paint(); const from={lat:S.me.lat,lon:S.me.lon};
  try{ const [e,n]=await Promise.allSettled([valhalla(from,S.to,true,sig),valhalla(from,S.to,false,sig)]);
    if(sig.aborted)return;
    S.emer=e.status==='fulfilled'?e.value:null; S.norm=n.status==='fulfilled'?n.value:null; S.from=from;
    if(!S.emer)S.err=(e.reason&&e.reason.message)||'Couldn’t get a route right now.';
  }catch(x){ if(sig.aborted)return; S.err='Couldn’t get a route right now — check your signal.'; }
  S.busy=false; drawAll(); fit(); paint();
  const re=S.reroute; S.reroute=false;
  if(S.emer){ S.nav=prepNav(S.emer,S.nav); announce(re); navStep(); }
  else { S.nav=null; paintNext(); if(S.me&&S.to)say('Couldn’t get a route. The call is '+spokenDist(dist(S.me,S.to))+' to the '+compass(bearing(S.me,S.to))+', as the crow flies.',true); } }

/* ---------- voice guidance: the direct route read out, turn by turn ----------
   Uses the phone's text-to-speech (works offline once the phone has an English voice). The spoken wording comes from the
   router (Valhalla, British English): an early warning ("in 300 metres, turn left onto…"), the turn itself as you reach
   it, and "continue for…" after a turn when the next one is a while off. Leaving the route by more than ~45 m twice in a
   row finds a new route (at most every 25 s). Keep this screen open — a web app can't talk once it's in the background. */
const SY=W.speechSynthesis||null;
let vVoice=null;
function pickVoice(){ if(!SY)return null; let v=[]; try{ v=SY.getVoices()||[]; }catch(e){}
  return v.find(x=>/^en[-_]IE/i.test(x.lang))||v.find(x=>/^en[-_]GB/i.test(x.lang)&&x.localService)||v.find(x=>/^en[-_]GB/i.test(x.lang))||v.find(x=>/^en/i.test(x.lang))||null; }
if(SY){ try{ SY.addEventListener('voiceschanged',()=>{ vVoice=pickVoice(); }); }catch(e){} }
function say(text,now){ if(!S.voice||!SY||!text||!ov||ov.hidden)return; try{ if(now)SY.cancel(); const u=new SpeechSynthesisUtterance(String(text)); vVoice=vVoice||pickVoice();
    if(vVoice){ u.voice=vVoice; u.lang=vVoice.lang; } else u.lang='en-IE'; u.rate=1; u.pitch=1; u.volume=1; SY.speak(u); S.said=String(text); }catch(e){} }
function hush(){ try{ if(SY)SY.cancel(); }catch(e){} }
function setVoice(on){ S.voice=!!on; try{ localStorage.setItem('gr_rt_voice',on?'1':'0'); }catch(e){} paintVo();
  if(on){ if(!SY){ toast('This browser can’t speak — no text-to-speech'); return; } say(S.nav&&!S.nav.arrived?'Voice guidance on. '+nextText():'Voice guidance on.',true); } else { hush(); toast('Voice guidance off'); }
  const b=ov.querySelector('.rt-panel [data-a="voice"]'); if(b)paint(); }
function paintVo(){ const b=ov&&ov.querySelector('.rt-vo'); if(!b)return; b.innerHTML=svg(S.voice?IC.spk:IC.mute); b.classList.toggle('off',!S.voice); b.setAttribute('aria-pressed',String(S.voice)); b.setAttribute('aria-label',S.voice?'Voice guidance on — tap to mute':'Voice guidance off — tap to turn on'); }
function spokenDist(m){ if(m<1000){ const r=m<100?Math.max(10,Math.round(m/10)*10):Math.round(m/50)*50; return r>=1000?'1 kilometre':r+' metres'; } const k=Math.round(m/100)/10; return (k%1?k.toFixed(1):String(k))+' kilometre'+(k===1?'':'s'); }
const spokenMins=s=>s<90?'1 minute':Math.round(s/60)+' minutes';
const lc1=t=>t?t.charAt(0).toLowerCase()+t.slice(1):t;
const plainName=n=>n&&!/\d+\.\d+\s*,|^Point on the map/i.test(n)?n.split(',')[0].trim():'';
function proj(p,a,b){ const k=Math.cos(p[0]*DEG)*111320, X=q=>[(q[1]-p[1])*k,(q[0]-p[0])*110540], A=X(a), B=X(b), dx=B[0]-A[0], dy=B[1]-A[1], L2=dx*dx+dy*dy;
  let t=L2?(-(A[0]*dx+A[1]*dy))/L2:0; t=Math.max(0,Math.min(1,t)); return {d:Math.hypot(A[0]+t*dx,A[1]+t*dy),t}; }
function prepNav(e,old){ const P=e.pts, cum=[0]; for(let i=1;i<P.length;i++)cum.push(cum[i-1]+pd(P[i-1],P[i]));
  return {cum,at:e.man.map(m=>cum[Math.min(P.length-1,Math.max(0,m.b||0))]),total:cum[cum.length-1],said:{},seg:1,off:0,lastRe:old?old.lastRe:0,arrived:false,next:1,dNext:null,lastJ:null}; }
function snap(N,P,me){ let best=null; const p=[me.lat,me.lon];
  const scan=(a,b)=>{ for(let i=Math.max(1,a);i<=Math.min(P.length-1,b);i++){ const r=proj(p,P[i-1],P[i]); if(!best||r.d<best.d)best={i,d:r.d,t:r.t}; } };
  scan(N.seg-3,N.seg+80); if(!best||best.d>60)scan(1,P.length-1); if(!best)return {d:0,along:0};
  N.seg=best.i; return {d:best.d,along:N.cum[best.i-1]+best.t*(N.cum[best.i]-N.cum[best.i-1])}; }
function nextText(){ const e=S.emer, N=S.nav; if(!e||!N)return ''; const j=N.next, m=e.man[j]; if(!m)return '';
  const d=N.dNext!=null?N.dNext:N.at[j]; return d>40?'In '+spokenDist(d)+', '+lc1(m.va||m.vp||m.i):(m.vp||m.i); }
function sayNext(force){ if(!S.emer||!S.nav){ if(S.me&&S.to)say('The call is '+spokenDist(dist(S.me,S.to))+' to the '+compass(bearing(S.me,S.to))+', as the crow flies.',true); return; }
  if(!S.voice&&force){ toast('Voice is off — tap the speaker at the top to turn it on'); return; }
  say(S.nav.arrived?'You have arrived.':nextText(),true); }
function announce(re){ const e=S.emer; if(!e)return; const nm=plainName(S.toName), first=e.man[0];
  say((re?'New route. ':'Direct route'+(nm?' to '+nm:'')+'. ')+spokenDist(e.km*1000)+', about '+spokenMins(e.s)+'. '+(first?(first.vp||first.i):''),true);
  if(S.nav){ S.nav.said.p0=1; S.nav.said.a0=1; } }
function navStep(){ const e=S.emer, N=S.nav; if(!e||!N||!S.me||!S.to||N.arrived||S.busy){ paintNext(); return; }
  const now=Date.now(), acc=S.me.acc||20, sp=S.me.sp||0, last=e.man.length-1;
  if(dist(S.me,S.to)<Math.max(30,Math.min(acc,60))){ N.arrived=true; if(!N.said['p'+last])say('You have arrived'+(plainName(S.toName)?' at '+plainName(S.toName):'')+'.',true); paintNext(); return; }
  const s=snap(N,e.pts,S.me);
  if(s.d>Math.max(45,acc*1.5)&&acc<80){ N.off++;
    if(N.off>=2&&now-N.lastRe>25e3&&navigator.onLine!==false){ N.lastRe=now; N.off=0; say('Off the route. Finding a new route from here.',true); S.reroute=true; route(); return; } }
  else N.off=0;
  let j=N.at.findIndex((a,k)=>k>0&&a>s.along+8); if(j<0)j=last;
  const m=e.man[j], d=Math.max(0,N.at[j]-s.along); N.next=j; N.dNext=d;
  if(N.lastJ!=null&&j>N.lastJ){ const pm=e.man[j-1]; if(pm&&pm.vpo&&d>450&&!N.said['o'+(j-1)]){ N.said['o'+(j-1)]=1; say(pm.vpo,false); } }
  N.lastJ=j;
  const far=Math.max(350,Math.min(900,sp*28)), near=Math.max(70,Math.min(220,sp*8));
  if(d<=near&&!N.said['p'+j]){ N.said['p'+j]=1; N.said['a'+j]=1; say(m.vp||m.i,true); }
  else if(d<=far&&d>near+60&&!N.said['a'+j]){ N.said['a'+j]=1; say('In '+spokenDist(d)+', '+lc1(m.va||m.vp||m.i),false); }
  paintNext(); }
function paintNext(){ const el=ov&&ov.querySelector('.rt-next'); if(!el)return; const e=S.emer, N=S.nav;
  if(!e||!N||!S.to){ el.hidden=true; return; }
  if(N.arrived){ el.hidden=false; el.innerHTML='<span class="rt-ni">'+svg(TURN.dest)+'</span><span class="rt-nt"><b>You have arrived</b><small>'+esc(plainName(S.toName)||'at the call')+'</small></span>'; return; }
  const j=N.next||Math.min(1,e.man.length-1), m=e.man[j]; if(!m){ el.hidden=true; return; }
  const d=N.dNext!=null?N.dNext:N.at[j];
  el.hidden=false; el.setAttribute('aria-label','Next: '+km(d)+', '+m.i+' — tap to hear it');
  el.innerHTML='<span class="rt-ni">'+svg(turnIcon(m.type))+'</span><span class="rt-nt"><b>'+esc(km(d))+'</b><small>'+esc(m.i)+'</small></span><span class="rt-nrep">'+svg(S.voice?IC.spk:IC.mute)+'</span>'; }
function readAll(){ const e=S.emer; if(!e)return; if(!S.voice){ setVoice(true); }
  hush(); e.man.forEach((m,i)=>say((i+1)+'. '+(m.vp||m.i)+(m.vpo?' '+m.vpo:''),false)); }

/* ---------- Google Maps along the direct route ----------
   Google Maps can't ignore one-way streets, but a link can carry stops. Put a stop in the middle of each stretch where
   the direct route leaves the normal one (up to 3, the most a phone link carries) and Google keeps as close to it as the
   road rules allow. */
function segDist(p,a,b){ const k=Math.cos(p[0]*DEG)*111320, X=q=>[(q[1]-p[1])*k,(q[0]-p[0])*110540], A=X(a), B=X(b), dx=B[0]-A[0], dy=B[1]-A[1], L2=dx*dx+dy*dy;
  let t=L2?(-(A[0]*dx+A[1]*dy))/L2:0; t=Math.max(0,Math.min(1,t)); return Math.hypot(A[0]+t*dx,A[1]+t*dy); }
const pd=(a,b)=>dist({lat:a[0],lon:a[1]},{lat:b[0],lon:b[1]});
function densify(P,step){ const out=[P[0]]; for(let i=1;i<P.length;i++){ const a=P[i-1], b=P[i], n=Math.floor(pd(a,b)/step);
  for(let k=1;k<=n;k++){ const t=k/(n+1); out.push([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t]); } out.push(b); } return out; }
function viaPoints(E,N,max){ if(!E||E.length<2)return [];
  const D2=densify(E,20);
  if(!N||N.length<2){ const k=Math.min(max,2), out=[]; if(D2.length<8)return out; for(let i=1;i<=k;i++)out.push(D2[Math.round(i*(D2.length-1)/(k+1))]); return out; }
  const off=D2.map(p=>{ let m=1e9; for(let j=1;j<N.length;j++){ const d=segDist(p,N[j-1],N[j]); if(d<m)m=d; if(m<5)break; } return m>30; });
  const runs=[]; let i=0;
  while(i<D2.length){ if(!off[i]){ i++; continue; } let j=i; while(j+1<D2.length&&off[j+1])j++;
    let len=0; for(let k=i+1;k<=j;k++)len+=pd(D2[k-1],D2[k]);
    if(len>=40)runs.push({a:i,b:j,len}); i=j+1; }
  return runs.sort((x,y)=>y.len-x.len).slice(0,max).sort((x,y)=>x.a-y.a).map(r=>D2[Math.round((r.a+r.b)/2)]); }
const llStr=p=>(+p[0]).toFixed(6)+','+(+p[1]).toFixed(6);
function gmUrl(to,via){ return 'https://www.google.com/maps/dir/?api=1&destination='+llStr([to.lat,to.lon])+(via&&via.length?'&waypoints='+encodeURIComponent(via.map(llStr).join('|')):'')+'&travelmode=driving&dir_action=navigate'; }

/* ---------- panel ---------- */
function paintArrow(){ const a=ov&&ov.querySelector('.rt-arrow'); if(!a||!S.me||!S.to)return; const b=bearing(S.me,S.to);
  const rel=S.head!=null?b-S.head:(S.me.hd!=null?b-S.me.hd:b); a.style.transform='rotate('+wrap360(rel)+'deg)';
  const l=ov.querySelector('.rt-arrl'); if(l)l.textContent=S.head!=null?'from where the phone points':S.me.hd!=null?'from your direction of travel':'map north (tap the arrow for the compass)'; }
function paintInfo(){ const box=ov&&ov.querySelector('.rt-crow'); if(!box)return;
  if(!S.to){ box.innerHTML=''; return; }
  if(!S.me){ box.innerHTML='<p class="rt-note">'+esc(S.gpsErr||'Waiting for your position…')+'</p>'; return; }
  const m=dist(S.me,S.to), b=bearing(S.me,S.to);
  box.innerHTML='<button type="button" class="rt-arrw" aria-label="Use the compass"><span class="rt-arrow">'+svg('<path d="M12 2.5 19 20l-7-3.6L5 20z"/>')+'</span></button>'
    +'<div class="rt-crowt"><b>'+km(m)+' '+compass(b)+'</b><small>as the crow flies · '+Math.round(b)+'°</small><small class="rt-arrl"></small></div>'
    +(S.emer?'':'<button type="button" class="rt-ib rt-sayw" aria-label="Say where the call is">'+svg(IC.spk)+'</button>');
  box.querySelector('.rt-arrw').onclick=()=>{ if(oriOn)stopOri(); else startOri(); paintArrow(); };
  const sw=box.querySelector('.rt-sayw'); if(sw)sw.onclick=()=>{ if(!S.voice)setVoice(true); say('The call is '+spokenDist(m)+' to the '+compass(b)+', as the crow flies.',true); };
  paintArrow(); drawLine(); }
function paint(){ const P=ov.querySelector('.rt-panel'); let h='';
  if(!S.to){
    h='<div class="rt-empty"><b>Where is the call?</b><span>Type an address or place, paste coordinates from the job (lat, long), or tap the map.</span>'
      +'<button type="button" class="rt-btn" data-a="pick">'+svg(IC.pin)+'Tap the map</button></div>';
  } else {
    h='<div class="rt-dest">'+svg(IC.pin)+'<b>'+esc(S.toName||'Destination')+'</b><button type="button" class="rt-x" data-a="clear" aria-label="Clear the destination">'+svg(IC.x)+'</button></div><div class="rt-crow"></div>';
    if(S.busy)h+='<div class="rt-busy"><i></i>Finding the most direct route…</div>';
    else if(S.err==='gps')h+='<p class="rt-note">'+esc(S.gpsErr||'Waiting for your position to work out the route…')+'</p>';
    else if(S.err)h+='<p class="rt-err">'+esc(S.err)+'</p>';
    if(S.emer){ const e=S.emer, n=S.norm, save=n?n.km-e.km:0;
      h+='<div class="rt-sum"><div class="rt-sr emer"><i></i><span><b>'+km(e.km*1000)+' · ~'+mins(e.s)+'</b><small>Direct route — any road or lane, one-way and turn bans ignored</small></span></div>'
        +(n?'<div class="rt-sr norm"><i></i><span><b>'+km(n.km*1000)+' · ~'+mins(n.s)+'</b><small>Normal route'+(save>0.05?' — '+km(save*1000)+' longer':'')+'</small></span></div>':'')+'</div>'
        +'<div class="rt-row"><button type="button" class="rt-btn rt-vbtn'+(S.voice?' on':'')+'" data-a="voice" aria-pressed="'+S.voice+'">'+svg(S.voice?IC.spk:IC.mute)+(S.voice?'Voice on':'Voice off')+'</button><button type="button" class="rt-btn" data-a="say">'+svg(IC.play)+'Say the next turn</button></div>'
        +'<div class="rt-row"><button type="button" class="rt-btn" data-a="turns">'+svg(IC.list)+(S.turns?'Hide the turns':'Turn by turn')+'</button><button type="button" class="rt-btn" data-a="again">'+svg(IC.again)+'Re-route from here</button></div>';
      if(S.turns)h+='<button type="button" class="rt-btn wide" data-a="readall">'+svg(IC.spk)+'Read all the turns out</button><ol class="rt-turns">'+e.man.map(m=>'<li><span>'+esc(m.i)+'</span>'+(m.km?'<small>'+km(m.km*1000)+'</small>':'')+'</li>').join('')+'</ol>';
    }
    const ll=S.to.lat.toFixed(6)+','+S.to.lon.toFixed(6), via=S.emer?viaPoints(S.emer.pts,S.norm&&S.norm.pts,3):[];
    h+='<div class="rt-hand"><span>Navigate in Google Maps — on your phone, CarPlay or Android Auto</span>'
      +'<a class="gm pri" href="'+esc(gmUrl(S.to,null))+'" target="_blank" rel="noopener">'+GM+'<b>Google Maps</b><small>straight to the call · its own route</small></a>'
      +(via.length?'<a class="gm" href="'+esc(gmUrl(S.to,via))+'" target="_blank" rel="noopener">'+GM+'<b>Google Maps along this route</b><small>'+via.length+' stop'+(via.length>1?'s':'')+' where the direct route differs — it still obeys one-way streets</small></a>':'')
      +'<div class="rt-oth"><a href="https://maps.apple.com/?daddr='+ll+'&amp;dirflg=d" target="_blank" rel="noopener">'+svg(IC.ext)+'Apple Maps</a>'
      +'<a href="https://waze.com/ul?ll='+ll+'&amp;navigate=yes" target="_blank" rel="noopener">'+svg(IC.ext)+'Waze</a>'
      +'<button type="button" class="rt-cp" data-a="copy">'+svg(IC.list)+'Copy location</button></div></div>';
  }
  h+='<p class="rt-warn">The direct route ignores one-way streets and turn bans. Use it only for an emergency response as the law and Garda policy allow, check every turn yourself, and drive to the conditions — map data can be wrong or out of date.</p>';
  P.innerHTML=h; P.scrollTop=0;
  P.querySelectorAll('[data-a]').forEach(b=>b.onclick=()=>{ const a=b.dataset.a;
    if(a==='pick')pick();
    else if(a==='clear'){ hush(); S.to=null; S.toName=''; S.emer=null; S.norm=null; S.nav=null; S.err=''; drawAll(); paint(); paintNext(); }
    else if(a==='turns'){ S.turns=!S.turns; paint(); }
    else if(a==='again'){ S.follow=true; S.reroute=true; route(); }
    else if(a==='voice')setVoice(!S.voice);
    else if(a==='say')sayNext(true);
    else if(a==='readall')readAll();
    else if(a==='where')sayNext(true);
    else if(a==='copy'){ const t=S.to.lat.toFixed(6)+', '+S.to.lon.toFixed(6); (navigator.clipboard&&navigator.clipboard.writeText?navigator.clipboard.writeText(t):Promise.reject()).then(()=>toast('Copied '+t)).catch(()=>toast(t)); } });
  paintInfo(); }

W.openRoute=openRoute; W.closeRoute=closeRoute; W.rteBack=back;
W.GRRoute=Object.freeze({open:openRoute,_lib:{dist,bearing,decode6,parseLL,compass,viaPoints,gmUrl,spokenDist,prepNav,snap},_state:()=>S});
})();
