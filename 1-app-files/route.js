/* Assisting — Emergency route: the most direct way to a call.
   A road route that may use any road or lane, ignoring one-way streets and turn bans (Valhalla routing on OpenStreetMap,
   the FOSSGIS public server), drawn against the normal route and the straight line, with the distance and bearing as the
   crow flies and a live arrow that points at the call. Works with Google Maps both ways: paste a Google Maps link (or
   copied coordinates) as the destination, and hand the call to Google Maps — straight there, or along the direct route
   with up to 3 stops where it differs (Google still obeys one-way streets) — for the phone, CarPlay or Android Auto.
   Apple Maps and Waze too. Needs signal for search, routing and map tiles.
   Voice guidance reads the direct route out turn by turn ("in 300 metres, turn left onto…"), says when you're off the
   route (and finds a new one), and when you've arrived — using the phone's own text-to-speech, while this screen is open.
   Driving view: once the route is found the screen switches to a Google-Maps-style view — a big turn banner ("Then" for the
   turn after), a tilted map that turns with you (heading up; the compass button switches to north up), the route ahead in
   blue and behind you in grey, and minutes · distance · arrival time at the bottom. Touch the map to look around;
   "Re-centre" goes back. ✕ leaves the driving view; "Start" brings it back.
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
 mic:'<path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><path d="M12 19v3"/>',
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
 play:'<path d="M7 4.5v15l12-7.5z"/>',
 navi:'<path d="M12 2.5 19.5 21 12 16.8 4.5 21z"/>',
 needle:'<path class="n" d="M12 2.8 15.6 12H8.4z"/><path class="s" d="M12 21.2 8.4 12h7.2z"/>'
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
const S={me:null,to:null,toName:'',emer:null,norm:null,busy:false,err:'',picking:false,turns:false,head:null,follow:true,res:null,q:'',voice:true,nav:null,reroute:false,
  drive:false,free:false,northUp:false,rot:null,tl:false,autoDrive:false,lastHd:null,dz:null};
try{ S.voice=localStorage.getItem('gr_rt_voice')!=='0'; S.northUp=localStorage.getItem('gr_rt_north')==='1'; }catch(e){}
let ctl=null;

function build(){
  if(ov&&ov.isConnected)return;
  ov=D.createElement('div'); ov.id='rte'; ov.hidden=true; ov.setAttribute('role','dialog'); ov.setAttribute('aria-label','Emergency route');
  ov.innerHTML='<div class="rt-top"><button type="button" class="rt-back">'+svg(IC.back)+'Back</button><div class="rt-tt"><b>Emergency route</b><span class="hudclock" data-f="line"></span></div>'
    +'<button type="button" class="rt-ib rt-vo" aria-pressed="true" aria-label="Voice guidance">'+svg(IC.spk)+'</button><button type="button" class="rt-ib rt-me" aria-label="Centre on my position">'+svg(IC.me)+'</button></div>'
    +'<form class="rt-q" autocomplete="off"><input class="rt-in" type="search" enterkeyhint="go" placeholder="Address, place, lat, long or a Google Maps link" aria-label="Where is the call?"><button type="button" class="rt-mic" aria-label="Say where the call is">'+svg(IC.mic)+'</button><button type="submit" class="rt-go" aria-label="Find">'+svg(IC.search)+'</button></form>'
    +'<div class="rt-res" hidden></div>'
    +'<div class="rt-listen" hidden role="status" aria-live="polite"><div class="rt-lring">'+svg(IC.mic)+'</div><b class="rt-lh">Listening…</b><p class="rt-lt"></p>'
    +'<button type="button" class="rt-lx">Stop</button><small>Say an address or a place — or “nearest Garda station”, “nearest hospital”, “cancel”, “next turn”.</small></div>'
    +'<div class="rt-map"><div class="rt-pickhint" hidden>Tap the map where the call is</div><button type="button" class="rt-next" hidden aria-live="polite"></button>'
    +'<div class="rt-dv" hidden><div class="rt-bnw"><button type="button" class="rt-bn"><span class="rt-bni"></span><span class="rt-bnt"><small></small><b></b></span></button>'
    +'<div class="rt-then" hidden><span>Then</span><i></i></div><button type="button" class="rt-dalt" hidden>'+svg(IC.pin)+'Not this place? Other matches</button></div>'
    +'<div class="rt-side"><button type="button" class="rt-fab rt-cmp" aria-label="Compass — switch between north up and direction of travel up"><span class="rt-needle">'+svg(IC.needle)+'</span></button>'
    +'<button type="button" class="rt-fab rt-dvo" aria-label="Voice guidance"></button>'
    +'<button type="button" class="rt-fab rt-dmic" aria-label="Speak — a new place, “next turn” or “cancel”">'+svg(IC.mic)+'</button>'
    +'<button type="button" class="rt-fab rt-dall" aria-label="See the whole route">'+svg(IC.route)+'</button>'
    +'<a class="rt-dgm" target="_blank" rel="noopener">'+GM+'<span>Google Maps</span></a></div>'
    +'<div class="rt-pos" hidden>'+svg(IC.navi)+'</div>'
    +'<button type="button" class="rt-rc" hidden>'+svg(IC.navi)+'Re-centre</button>'
    +'<small class="rt-attr">© OpenStreetMap contributors</small>'
    +'<div class="rt-tl" hidden></div>'
    +'<div class="rt-bar"><button type="button" class="rt-bx" aria-label="Leave the driving view">'+svg(IC.x)+'</button>'
    +'<button type="button" class="rt-eta" aria-label="Show the turns"><b></b><small></small></button>'
    +'<button type="button" class="rt-bl" aria-label="Show the turns">'+svg(IC.list)+'</button></div></div></div>'
    +'<div class="rt-panel"></div><div class="rt-toast"></div>';
  D.body.appendChild(ov);
  ov.querySelector('.rt-back').onclick=()=>back();
  ov.querySelector('.rt-me').onclick=()=>{ S.follow=true; if(S.me&&map)map.setView([S.me.lat,S.me.lon],Math.max(map.getZoom(),16)); else toast('Waiting for your position…'); };
  ov.querySelector('.rt-q').onsubmit=e=>{ e.preventDefault(); const v=ov.querySelector('.rt-in').value.trim(); if(v)search(v); };
  ov.querySelector('.rt-vo').onclick=()=>setVoice(!S.voice);
  ov.querySelector('.rt-mic').onclick=()=>listen();
  ov.querySelector('.rt-lx').onclick=()=>stopListen(true);
  ov.querySelector('.rt-next').onclick=()=>sayNext(true);
  ov.querySelector('.rt-bn').onclick=()=>sayNext(true);
  ov.querySelector('.rt-cmp').onclick=()=>{ S.northUp=!S.northUp; try{ localStorage.setItem('gr_rt_north',S.northUp?'1':'0'); }catch(e){}
    if(S.free){ S.free=false; dvInteract(false); dvApply(); } dvUpdate(true); toast(S.northUp?'North up':'Direction of travel up'); };
  ov.querySelector('.rt-dvo').onclick=()=>setVoice(!S.voice);
  ov.querySelector('.rt-dmic').onclick=()=>listen();
  ov.querySelector('.rt-dall').onclick=()=>dvOverview();
  ov.querySelector('.rt-rc').onclick=()=>{ S.free=false; dvInteract(false); dvApply(); dvUpdate(false); };
  ov.querySelector('.rt-bx').onclick=()=>exitDrive();
  ov.querySelector('.rt-dalt').onclick=()=>showAlts();
  ov.querySelector('.rt-eta').onclick=ov.querySelector('.rt-bl').onclick=()=>{ S.tl=!S.tl; S._tlj=null; dvList(); };
  W.addEventListener('resize',()=>{ if(S.drive&&!S.free){ dvApply(); dvUpdate(false); } });
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
  host.addEventListener('pointerdown',ev=>{ if(!S.drive||S.free||!ev.target.closest('.rt-mapc'))return;   // driving view: a touch on the map = look around
    S.free=true; dvApply(); dvInteract(true); const h=S._here; if(h)map.setView(h,map.getZoom(),{animate:false}); dvUpdate(false); },true);
  return map; }

/* ---------- open / close ---------- */
function openRoute(dest){
  build(); const bt=D.getElementById('boot'); if(bt&&bt.parentNode)bt.parentNode.removeChild(bt);
  ov.hidden=false; D.body.classList.add('rte-open'); ensureMap(); setTimeout(()=>{ try{ map&&map.invalidateSize(); }catch(e){} },80);
  startGPS(); keepAwake(true);
  // iPhone: speech only works after the page has spoken once from a tap — a silent word now lets the directions talk later
  if(S.voice&&SY){ try{ const u=new SpeechSynthesisUtterance(' '); u.volume=0; SY.speak(u); }catch(e){} }
  if(dest&&dest.lat!=null&&dest.lon!=null)setTo({lat:+dest.lat,lon:+dest.lon},dest.name||dest.n||'Destination');
  else paint();
  if(W.grHudTick)W.grHudTick(); return true; }
function closeRoute(){ if(!ov||ov.hidden)return; if(recOn)stopListen(true); if(S.drive){ S.drive=false; S.free=false; S.tl=false; ov.classList.remove('drive'); dvApply(); dvInteract(true); } ov.hidden=true; D.body.classList.remove('rte-open'); stopGPS(); keepAwake(false); stopOri(); hush(); if(ctl){ try{ ctl.abort(); }catch(e){} ctl=null; } }
function back(){ if(!ov||ov.hidden)return false;
  if(recOn){ stopListen(true); return true; }
  if(S.picking){ S.picking=false; ov.querySelector('.rt-pickhint').hidden=true; paint(); return true; }
  const r=ov.querySelector('.rt-res'); if(!r.hidden){ r.hidden=true; return true; }
  if(S.drive){ if(S.tl){ S.tl=false; dvList(); } else exitDrive(); return true; }
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
  if(!meMk){ meMk=L.marker(ll,{icon:L.divIcon({className:'',html:'<div class="rt-mek"><b></b><i>'+svg(IC.navi)+'</i></div>',iconSize:[20,20],iconAnchor:[10,10]}),interactive:false,zIndexOffset:900}).addTo(map);
    accC=L.circle(ll,{radius:S.me.acc||30,weight:1,color:'#2f6fc0',fillOpacity:.08,interactive:false}).addTo(map); }
  else if(!S.drive){ meMk.setLatLng(ll); accC.setLatLng(ll).setRadius(S.me.acc||30); }
  if(S.drive)return;   // the driving view places the arrow itself (on the road) after working out where you are on the route
  if(S.follow&&!S.to)map.setView(ll,Math.max(map.getZoom(),15),{animate:false});
  else if(S.follow&&S.nav&&!S.nav.arrived){ const pt=map.latLngToContainerPoint(ll), sz=map.getSize(); if(pt.x<sz.x*.18||pt.x>sz.x*.82||pt.y<sz.y*.3||pt.y>sz.y*.85)map.panTo(ll,{animate:true}); }   // keep you on screen while driving
  drawLine(); }
function drawLine(){ if(!map)return; if(S._crow){ lay.removeLayer(S._crow); S._crow=null; }
  if(S.me&&S.to&&!S.drive)S._crow=L.polyline([[S.me.lat,S.me.lon],[S.to.lat,S.to.lon]],{color:'#d6455d',weight:2.5,dashArray:'4 8',opacity:.9,interactive:false}).addTo(lay); }
function drawAll(){ if(!map)return; lay.clearLayers(); S._crow=null; toMk=null; S._done=S._aheadC=S._ahead=null;
  if(S.drive&&S.emer&&S.emer.pts){   // driving view: the route ahead in blue, the part behind you in grey (SVG — the tilted map is large)
    if(!dvSvg)dvSvg=L.svg({padding:.2}); const o={renderer:dvSvg,interactive:false,lineCap:'round',lineJoin:'round'};
    S._done=L.polyline([],Object.assign({color:'#9aa3ad',weight:9,opacity:.95},o)).addTo(lay);
    S._aheadC=L.polyline([],Object.assign({color:'#0b3e91',weight:14,opacity:1},o)).addTo(lay);
    S._ahead=L.polyline([],Object.assign({color:'#1a73e8',weight:9,opacity:1},o)).addTo(lay); dvLine(); }
  else {
    if(S.norm&&S.norm.pts)L.polyline(S.norm.pts,{color:'#7d8794',weight:5,opacity:.65,interactive:false}).addTo(lay);
    if(S.emer&&S.emer.pts){ L.polyline(S.emer.pts,{color:'#ffffff',weight:9,opacity:.9,interactive:false}).addTo(lay); L.polyline(S.emer.pts,{color:'#c81d3a',weight:5.5,opacity:1,interactive:false}).addTo(lay); } }
  if(S.to)toMk=L.marker([S.to.lat,S.to.lon],{icon:L.divIcon({className:'',html:'<div class="rt-tok">'+svg(IC.pin)+'</div>',iconSize:[34,34],iconAnchor:[17,32]}),interactive:false,zIndexOffset:1000}).addTo(lay);
  if(!S.drive)drawLine(); }
function fit(){ if(!map||(S.drive&&!S.free))return; const pts=[]; if(S.me)pts.push([S.me.lat,S.me.lon]); if(S.to)pts.push([S.to.lat,S.to.lon]); if(S.emer&&S.emer.pts)S.emer.pts.forEach(p=>pts.push(p));
  if(pts.length===1)map.setView(pts[0],16); else if(pts.length)map.fitBounds(L.latLngBounds(pts),{paddingTopLeft:[36,S.emer?100:36],paddingBottomRight:[36,36],maxZoom:17}); }

/* ---------- search ---------- */
async function search(q,opt){ opt=opt||{}; S.q=q; S.alts=null; const ll=parseLL(q); const box=ov.querySelector('.rt-res');
  if(ll){ box.hidden=true; setTo(ll,(/^https?:/i.test(q)?'From the map link · ':'')+ll.lat.toFixed(5)+', '+ll.lon.toFixed(5)); return; }
  if(isShortLink(q)){ box.hidden=false; box.innerHTML='<p class="rt-note">Short Google Maps links don’t carry the location, so they can’t be read here. In Google Maps, press and hold the spot, copy the coordinates it shows, and paste them here — or type the address.</p>'; return; }
  if(/^https?:\/\//i.test(q)){ box.hidden=false; box.innerHTML='<p class="rt-note">No location found in that link. Paste the coordinates (lat, long) or type the address.</p>'; return; }
  if(navigator.onLine===false){ toast('No signal — type the coordinates (lat, long) or tap the map'); return; }
  box.hidden=false; box.innerHTML='<div class="rt-busy"><i></i>Searching…</div>';
  try{ const r=await fetch(NOMINATIM+encodeURIComponent(q),{headers:{'Accept':'application/json'}}); if(!r.ok)throw new Error('HTTP '+r.status); const j=await r.json();
    const L2=(Array.isArray(j)?j:[]).map(x=>({lat:+x.lat,lon:+x.lon,n:x.name||String(x.display_name||'').split(',')[0],a:String(x.display_name||'').split(',').slice(1,4).join(',').trim()}));
    if(!L2.length){ box.innerHTML=(opt.said?'<p class="rt-note sm rt-heard">Heard “'+esc(opt.said)+'”</p>':'')+'<p class="rt-note">Nothing found for “'+esc(q)+'”. Try the street and the town, paste coordinates, or <button type="button" class="rt-lnk" data-pick>tap the map</button>.</p>'; if(opt.said)say('Nothing found for '+q+'. Try again, or type it.',true); }
    else if(opt.said&&goodMatch(q,L2)){ box.hidden=true; S.alts=L2; const x=L2[0]; setTo({lat:x.lat,lon:x.lon},x.n+(x.a?', '+x.a.split(',')[0]:'')); toast('Going to '+x.n+(L2.length>1?' — not right? see the other matches':'')); return; }
    else box.innerHTML=(opt.said?'<p class="rt-note sm rt-heard">Heard “'+esc(opt.said)+'” — tap the right one</p>':'')+hitsHtml(L2);
    wireHits(box,L2);
    const pk=box.querySelector('[data-pick]'); if(pk)pk.onclick=()=>{ box.hidden=true; pick(); };
  }catch(e){ box.innerHTML='<p class="rt-note">Couldn’t search right now — check your signal. You can also paste coordinates or tap the map.</p>'; } }
const hitsHtml=L=>L.map((x,i)=>'<button type="button" class="rt-hit" data-i="'+i+'">'+svg(IC.pin)+'<span><b>'+esc(x.n)+'</b><small>'+esc((x.d!=null?km(x.d)+' away · ':'')+x.a)+'</small></span></button>').join('')+'<p class="rt-note sm">Search © OpenStreetMap contributors (Nominatim)</p>';
function wireHits(box,L){ box.querySelectorAll('[data-i]').forEach(b=>b.onclick=()=>{ const x=L[+b.dataset.i]; box.hidden=true; S.alts=null; setTo({lat:x.lat,lon:x.lon},x.n+(x.a?', '+x.a.split(',')[0]:'')); }); }
function showAlts(){ const L=S.alts; if(!L||!L.length)return; const box=ov.querySelector('.rt-res'); box.hidden=false; box.innerHTML='<p class="rt-note sm rt-heard">Other matches — tap the right one</p>'+hitsHtml(L); wireHits(box,L); }
// is the first match clearly what was said? (most of the words that matter appear in its name or address)
const STOPW=new Set(['the','street','st','road','rd','avenue','ave','lane','dublin','co','county','north','south','east','west','upper','lower','great','little','at','in','on','of','and','near','by','number','no','a']);
function goodMatch(q,L){ if(L.length===1)return true; const k=String(q).toLowerCase().replace(/[^a-z0-9 ]/g,' ').split(/\s+/).filter(w=>w.length>2&&!STOPW.has(w));
  if(!k.length)return false; const t=(L[0].n+' '+L[0].a).toLowerCase(); return k.filter(w=>t.includes(w)).length/k.length>=0.6; }

/* ---------- say where the call is (speech to text) ----------
   Uses the phone's own speech recognition (Chrome on Android, Safari on iPhone) — it needs signal. Say an address or
   a place, "nearest Garda station", "nearest hospital", or "cancel" / "next turn" / "re-route" / "voice off". */
const SRC=W.SpeechRecognition||W.webkitSpeechRecognition||null;
let rec=null, recOn=false, recAbort=false;
const rvib=p=>{ try{ if(navigator.vibrate)navigator.vibrate(p); }catch(e){} };
function micHelp(){ return W.GRP&&W.GRP.ios?'Allow the microphone: iPhone Settings → Apps → Safari → Microphone, and turn on Dictation (Settings → General → Keyboard).'
  :'Allow the microphone: Chrome ⋮ → Settings → Site settings → Microphone → allow this app.'; }
function listen(){ if(recOn){ stopListen(false); return; }
  if(!SRC){ const i=ov.querySelector('.rt-in'); try{ i.focus(); }catch(e){} toast('Tap the microphone on your keyboard and say the address'); return; }
  if(navigator.onLine===false){ toast('Speaking it needs signal — type it, paste coordinates or tap the map'); return; }
  hush(); recAbort=false;
  try{ rec=new SRC(); }catch(e){ toast('Voice input isn’t available here — use the microphone on your keyboard'); return; }
  rec.lang='en-IE'; rec.interimResults=true; rec.maxAlternatives=3; rec.continuous=false;
  let fin='', part='';
  rec.onresult=e=>{ part=''; for(let i=e.resultIndex;i<e.results.length;i++){ const r=e.results[i]; if(r.isFinal)fin+=r[0].transcript; else part+=r[0].transcript; } paintListen((fin+' '+part).trim()); };
  rec.onerror=e=>{ const m={'not-allowed':micHelp(),'service-not-allowed':micHelp(),'network':'Speaking it needs signal — type it or tap the map','no-speech':'Didn’t hear anything — tap the microphone and try again','audio-capture':'No microphone found'}[e.error]; if(m&&!recAbort)toast(m); };
  rec.onend=()=>{ recOn=false; paintListen(null); const t=(fin||part).trim(); if(t&&!recAbort)heard(t); };
  try{ rec.start(); recOn=true; rvib(30); paintListen(''); }catch(e){ recOn=false; toast('Couldn’t start listening — try again'); } }
function stopListen(abort){ recAbort=!!abort; try{ if(rec){ if(abort&&rec.abort)rec.abort(); else rec.stop(); } }catch(e){} if(abort){ recOn=false; paintListen(null); } }
function paintListen(t){ const el=ov&&ov.querySelector('.rt-listen'); if(!el)return; const mic=ov.querySelector('.rt-mic');
  if(t==null){ el.hidden=true; if(mic)mic.classList.remove('on'); return; }
  el.hidden=false; if(mic)mic.classList.add('on'); el.querySelector('.rt-lh').textContent=t?'Heard':'Listening…'; el.querySelector('.rt-lt').textContent=t?'“'+t+'”':''; }
function heard(t){ const s=t.toLowerCase().replace(/[.,!?]/g,' ').replace(/\s+/g,' ').trim(); rvib(15);
  if(/^(cancel|stop|clear|clear it|cancel it|cancel that|cancel the route|stop the route|stop navigation|end route)$/.test(s)){
    if(S.to){ hush(); if(S.drive)exitDrive(); S.to=null; S.toName=''; S.emer=null; S.norm=null; S.nav=null; S.err=''; S.alts=null; drawAll(); paint(); paintNext(); toast('Route cleared'); } return; }
  if(/^(next turn|next|what'?s next|what is next|say the next turn|where now|which way)$/.test(s)){ if(!S.voice)setVoice(true); else sayNext(true); return; }
  if(/^(re ?-?route|route again|recalculate|new route|find a new route)$/.test(s)){ if(S.to){ S.follow=true; S.reroute=true; route(); } return; }
  if(/^(voice off|mute|quiet|be quiet|silence|stop talking)$/.test(s)){ setVoice(false); return; }
  if(/^(voice on|unmute|talk|speak|voice guidance on)$/.test(s)){ setVoice(true); return; }
  if(/\b(nearest|closest)\b.*\b(garda|police|cop)\b|\b(nearest|closest)\b.*\bstation\b/.test(s)){ nearestStation(); return; }
  if(/\b(nearest|closest)\b.*\b(hospital|a ?and ?e|a&e|a & e|emergency department|casualty)\b/.test(s)){ nearestHospital(); return; }
  const q=t.replace(/^\s*(please\s+)?(take me to|bring me to|go to|navigate to|directions to|route to|drive to|get me to|the call is (at|in|on)|call at|it'?s (at|in|on)|the address is|address is|we'?re going to|going to)\s+/i,'').trim();
  ov.querySelector('.rt-in').value=q; search(q,{said:t}); }
let STN=null;
async function nearestStation(){ if(!S.me){ toast('Waiting for your position…'); return; }
  try{ if(!STN){ const r=await fetch('data/garda_stations.json'); STN=await r.json(); } }catch(e){ toast('Couldn’t load the list of stations'); return; }
  let best=null, bd=1e12; (STN||[]).forEach(x=>{ if(x.lat==null||x.lon==null)return; const d=dist(S.me,{lat:+x.lat,lon:+x.lon}); if(d<bd){ bd=d; best=x; } });
  if(!best){ toast('No station found'); return; }
  ov.querySelector('.rt-res').hidden=true; S.alts=null; setTo({lat:+best.lat,lon:+best.lon},best.n+' Garda Station');
  toast(best.n+' Garda Station · '+km(bd)+(best.hrs?' · '+best.hrs:'')); }
async function nearestHospital(){ if(!S.me){ toast('Waiting for your position…'); return; } if(navigator.onLine===false){ toast('Finding hospitals needs signal'); return; }
  const box=ov.querySelector('.rt-res'); box.hidden=false; box.innerHTML='<div class="rt-busy"><i></i>Finding hospitals near you…</div>';
  const dl=0.09, vb=[S.me.lon-dl*1.7,S.me.lat+dl,S.me.lon+dl*1.7,S.me.lat-dl].map(v=>v.toFixed(4)).join(',');
  try{ const r=await fetch('https://nominatim.openstreetmap.org/search?format=jsonv2&limit=20&countrycodes=ie&accept-language=en&bounded=1&viewbox='+vb+'&q=hospital',{headers:{'Accept':'application/json'}}); if(!r.ok)throw new Error('HTTP '+r.status);
    const j=await r.json(); const L=(Array.isArray(j)?j:[]).filter(x=>/hospital/i.test((x.type||'')+' '+(x.category||'')+' '+(x.name||''))).map(x=>({lat:+x.lat,lon:+x.lon,n:x.name||String(x.display_name||'').split(',')[0],a:String(x.display_name||'').split(',').slice(1,3).join(',').trim()}))
      .map(x=>Object.assign(x,{d:dist(S.me,x)})).sort((a,b)=>a.d-b.d).slice(0,8);
    if(!L.length){ box.innerHTML='<p class="rt-note">No hospitals found near you — type the hospital’s name.</p>'; return; }
    box.innerHTML='<p class="rt-note sm rt-heard">Nearest hospitals — check it has an emergency department (A&amp;E) before you go</p>'+hitsHtml(L); wireHits(box,L);
    say('The nearest hospital is '+L[0].n+', '+spokenDist(L[0].d)+'. Check it has an emergency department.',true);
  }catch(e){ box.innerHTML='<p class="rt-note">Couldn’t search right now — check your signal, or type the hospital’s name.</p>'; } }
function pick(){ S.picking=true; ov.querySelector('.rt-pickhint').hidden=false; paint(); }
function setTo(p,name){ hush(); S.to={lat:p.lat,lon:p.lon}; S.toName=name||''; S.emer=null; S.norm=null; S.nav=null; S.err=''; S.turns=false; S.reroute=false; S.autoDrive=true; drawAll(); fit(); route(); }

/* ---------- routing (Valhalla): emergency = ignore one-ways, turn bans and access; normal = the usual rules ---------- */
async function valhalla(from,to,emer,signal){
  const opt=emer?{ignore_oneways:true,ignore_restrictions:true,ignore_access:true,ignore_closures:true,service_penalty:0,use_living_streets:1}:{};
  const body={locations:[{lat:from.lat,lon:from.lon},{lat:to.lat,lon:to.lon}],costing:'auto',costing_options:{auto:opt},directions_options:{units:'kilometers',language:'en-GB'}};
  const r=await fetch(VALHALLA+'?json='+encodeURIComponent(JSON.stringify(body)),{signal}); const d=await r.json().catch(()=>({}));
  if(!r.ok||!d.trip){ const m=d.error||('HTTP '+r.status); throw new Error(/no suitable edges|no path/i.test(m)?'No road found near one of the points — move it onto a road.':m); }
  const leg=d.trip.legs[0];
  return {km:d.trip.summary.length,s:d.trip.summary.time,pts:decode6(leg.shape),man:(leg.maneuvers||[]).map(m=>({i:m.instruction||'',km:m.length||0,type:m.type,b:m.begin_shape_index||0,
    st:(m.street_names||[]).join(' / '),rx:m.roundabout_exit_count||0,
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
  if(S.emer){ S.nav=prepNav(S.emer,S.nav); announce(re); navStep(); if(S.autoDrive){ S.autoDrive=false; enterDrive(); } else if(S.drive){ drawAll(); dvUpdate(false); } }
  else { S.nav=null; S.autoDrive=false; if(S.drive)exitDrive(); paintNext(); if(S.me&&S.to)say('Couldn’t get a route. The call is '+spokenDist(dist(S.me,S.to))+' to the '+compass(bearing(S.me,S.to))+', as the crow flies.',true); } }

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
function say(text,now){ if(!S.voice||!SY||!text||!ov||ov.hidden||recOn)return; try{ if(now)SY.cancel(); const u=new SpeechSynthesisUtterance(String(text)); vVoice=vVoice||pickVoice();
    if(vVoice){ u.voice=vVoice; u.lang=vVoice.lang; } else u.lang='en-IE'; u.rate=1; u.pitch=1; u.volume=1; SY.speak(u); S.said=String(text); }catch(e){} }
function hush(){ try{ if(SY)SY.cancel(); }catch(e){} }
function setVoice(on){ S.voice=!!on; try{ localStorage.setItem('gr_rt_voice',on?'1':'0'); }catch(e){} paintVo();
  if(on){ if(!SY){ toast('This browser can’t speak — no text-to-speech'); return; } say(S.nav&&!S.nav.arrived?'Voice guidance on. '+nextText():'Voice guidance on.',true); } else { hush(); toast('Voice guidance off'); }
  const b=ov.querySelector('.rt-panel [data-a="voice"]'); if(b)paint(); }
function paintVo(){ const d=ov&&ov.querySelector('.rt-dvo'); if(d){ d.innerHTML=svg(S.voice?IC.spk:IC.mute); d.classList.toggle('off',!S.voice); d.setAttribute('aria-pressed',String(S.voice)); d.setAttribute('aria-label',S.voice?'Voice guidance on — tap to mute':'Voice guidance off — tap to turn on'); }
  const b=ov&&ov.querySelector('.rt-vo'); if(!b)return; b.innerHTML=svg(S.voice?IC.spk:IC.mute); b.classList.toggle('off',!S.voice); b.setAttribute('aria-pressed',String(S.voice)); b.setAttribute('aria-label',S.voice?'Voice guidance on — tap to mute':'Voice guidance off — tap to turn on'); }
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
  scan(N.seg-3,N.seg+80); if(!best||best.d>60)scan(1,P.length-1); if(!best)return {d:0,along:0,pt:P[0]};
  N.seg=best.i; const a=P[best.i-1], b=P[best.i];
  return {d:best.d,along:N.cum[best.i-1]+best.t*(N.cum[best.i]-N.cum[best.i-1]),pt:[a[0]+(b[0]-a[0])*best.t,a[1]+(b[1]-a[1])*best.t]}; }
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
  const s=snap(N,e.pts,S.me); N.along=s.along; N.pt=s.pt; N.offd=s.d;
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
function paintNext(){ dvUpdate(true); const el=ov&&ov.querySelector('.rt-next'); if(!el)return; const e=S.emer, N=S.nav;
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
  // kept simple for an emergency: one big button to say where the call is, then the route and Google Maps — everything else is under "More"
  if(!S.to){
    h='<div class="rt-empty"><button type="button" class="rt-say" data-a="listen">'+svg(IC.mic)+'<span><b>Say where the call is</b><small>tap, then say the address or place</small></span></button>'
      +'<p class="rt-or">or type it above · paste coordinates · <button type="button" class="rt-lnk" data-a="pick">tap the map</button></p></div>';
  } else {
    const e=S.emer, n=S.norm, ll=S.to.lat.toFixed(6)+','+S.to.lon.toFixed(6), via=e?viaPoints(e.pts,n&&n.pts,3):[];
    h='<div class="rt-dest">'+svg(IC.pin)+'<b>'+esc(S.toName||'Destination')+'</b><button type="button" class="rt-x" data-a="clear" aria-label="Clear the destination">'+svg(IC.x)+'</button></div>'
      +(S.alts&&S.alts.length>1?'<button type="button" class="rt-lnk rt-alts" data-a="others">Not this one? See the other matches ('+(S.alts.length-1)+')</button>':'');
    if(S.busy)h+='<div class="rt-busy"><i></i>Finding the most direct route…</div>';
    else if(S.err==='gps')h+='<p class="rt-note">'+esc(S.gpsErr||'Waiting for your position to work out the route…')+'</p>';
    else if(S.err)h+='<p class="rt-err">'+esc(S.err)+'</p>';
    if(e)h+='<div class="rt-one"><i></i><b>'+km(e.km*1000)+' · ~'+mins(e.s)+'</b><span>direct route</span></div>'
      +'<button type="button" class="rt-start" data-a="drive">'+svg(IC.navi)+'Start</button>';
    else if(!S.busy)h+='<div class="rt-crow"></div>';   // no road route: the compass and the distance are the guidance
    h+='<div class="rt-main"><a class="rt-gm" href="'+esc(gmUrl(S.to,null))+'" target="_blank" rel="noopener">'+GM+'<span><b>Google Maps</b><small>phone · CarPlay · Android Auto</small></span></a>'
      +'<button type="button" class="rt-say sm" data-a="listen">'+svg(IC.mic)+'<span><b>Speak</b><small>place or “cancel”</small></span></button></div>'
      +'<button type="button" class="rt-more'+(S.more?' on':'')+'" data-a="more" aria-expanded="'+!!S.more+'">'+(S.more?'Less':'More — compass, turns, other map apps')+'</button>';
    if(S.more){
      h+='<div class="rt-extra">'+(e?'<div class="rt-crow"></div>':'');
      if(e){ const save=n?n.km-e.km:0;
        h+='<div class="rt-sum"><div class="rt-sr emer"><i></i><span><b>'+km(e.km*1000)+' · ~'+mins(e.s)+'</b><small>Direct route — any road or lane, one-way and turn bans ignored</small></span></div>'
          +(n?'<div class="rt-sr norm"><i></i><span><b>'+km(n.km*1000)+' · ~'+mins(n.s)+'</b><small>Normal route'+(save>0.05?' — '+km(save*1000)+' longer':'')+'</small></span></div>':'')+'</div>'
          +'<div class="rt-row"><button type="button" class="rt-btn rt-vbtn'+(S.voice?' on':'')+'" data-a="voice" aria-pressed="'+S.voice+'">'+svg(S.voice?IC.spk:IC.mute)+(S.voice?'Voice on':'Voice off')+'</button><button type="button" class="rt-btn" data-a="say">'+svg(IC.play)+'Say the next turn</button></div>'
          +'<div class="rt-row"><button type="button" class="rt-btn" data-a="turns">'+svg(IC.list)+(S.turns?'Hide the turns':'Turn by turn')+'</button><button type="button" class="rt-btn" data-a="again">'+svg(IC.again)+'Re-route from here</button></div>';
        if(S.turns)h+='<button type="button" class="rt-btn wide" data-a="readall">'+svg(IC.spk)+'Read all the turns out</button><ol class="rt-turns">'+e.man.map(m=>'<li><span>'+esc(m.i)+'</span>'+(m.km?'<small>'+km(m.km*1000)+'</small>':'')+'</li>').join('')+'</ol>';
      }
      h+='<div class="rt-hand">'+(via.length?'<a class="gm" href="'+esc(gmUrl(S.to,via))+'" target="_blank" rel="noopener">'+GM+'<b>Google Maps along this route</b><small>'+via.length+' stop'+(via.length>1?'s':'')+' where the direct route differs — it still obeys one-way streets</small></a>':'')
        +'<div class="rt-oth"><a href="https://maps.apple.com/?daddr='+ll+'&amp;dirflg=d" target="_blank" rel="noopener">'+svg(IC.ext)+'Apple Maps</a>'
        +'<a href="https://waze.com/ul?ll='+ll+'&amp;navigate=yes" target="_blank" rel="noopener">'+svg(IC.ext)+'Waze</a>'
        +'<button type="button" class="rt-cp" data-a="copy">'+svg(IC.list)+'Copy location</button></div></div>'
        +'<p class="rt-warn">The direct route ignores one-way streets and turn bans. Use it only for an emergency response as the law and Garda policy allow, check every turn yourself, and drive to the conditions — map data can be wrong or out of date.</p></div>';
    } else h+='<p class="rt-warn sm">Direct route ignores one-way streets — check every turn.</p>';
  }
  P.innerHTML=h; P.scrollTop=0;
  P.querySelectorAll('[data-a]').forEach(b=>b.onclick=()=>{ const a=b.dataset.a;
    if(a==='pick')pick();
    else if(a==='listen')listen();
    else if(a==='others')showAlts();
    else if(a==='drive')enterDrive();
    else if(a==='clear'){ hush(); if(S.drive)exitDrive(); S.to=null; S.toName=''; S.emer=null; S.norm=null; S.nav=null; S.err=''; drawAll(); paint(); paintNext(); }
    else if(a==='turns'){ S.turns=!S.turns; paint(); }
    else if(a==='more'){ S.more=!S.more; paint(); }
    else if(a==='again'){ S.follow=true; S.reroute=true; route(); }
    else if(a==='voice')setVoice(!S.voice);
    else if(a==='say')sayNext(true);
    else if(a==='readall')readAll();
    else if(a==='where')sayNext(true);
    else if(a==='copy'){ const t=S.to.lat.toFixed(6)+', '+S.to.lon.toFixed(6); (navigator.clipboard&&navigator.clipboard.writeText?navigator.clipboard.writeText(t):Promise.reject()).then(()=>toast('Copied '+t)).catch(()=>toast(t)); } });
  paintInfo(); }

/* ---------- driving view ----------
   The map is a big square that is tilted (CSS perspective) and turned so the way you're going is up, pivoting on your
   position near the bottom of the screen. Leaflet keeps drawing it flat — only the browser tilts it — so it must be big
   enough to cover the screen at any angle. Touching the map flattens it (north up) so it can be dragged; Re-centre
   goes back. */
const TILT=28, PERSP=1300;
let dvSvg=null;
const ABBR=[[/\bRoad\b/g,'Rd'],[/\bStreet\b/g,'St'],[/\bAvenue\b/g,'Ave'],[/\bLane\b/g,'Ln'],[/\bTerrace\b/g,'Tce'],[/\bCrescent\b/g,'Cres'],[/\bSquare\b/g,'Sq'],[/\bPlace\b/g,'Pl'],[/\bDrive\b/g,'Dr'],[/\bUpper\b/g,'Upr'],[/\bLower\b/g,'Lwr']];
const abbr=t=>ABBR.reduce((x,[a,b])=>x.replace(a,b),String(t||''));
const ORD=n=>n+((n%100>=11&&n%100<=13)?'th':(['th','st','nd','rd'][n%10]||'th'));
function dvDist(m){ if(m<1000){ const r=m<100?Math.max(10,Math.round(m/10)*10):Math.round(m/50)*50; return r>=1000?'1 km':r+' m'; } return (m/1000).toFixed(m<9950?1:0).replace(/\.0$/,'')+' km'; }
const durTxt=s=>{ const mm=Math.max(1,Math.round(s/60)); return mm<60?mm+' min':Math.floor(mm/60)+' hr'+(mm%60?' '+(mm%60)+' min':''); };
function mText(m){ const T=m.type, st=abbr(String(m.st||'').split(' / ')[0]);
  if(T===4||T===5||T===6)return {sm:T===5?'Destination on the right':T===6?'Destination on the left':'Arriving at',big:plainName(S.toName)||'the call'};
  if(T===26)return {sm:'At the roundabout'+(m.rx?', take the '+ORD(m.rx)+' exit':'')+(st?' onto':''),big:st||(m.rx?ORD(m.rx)+' exit':'Roundabout')};
  if(T===27)return {sm:'Exit the roundabout'+(st?' onto':''),big:st||'Exit'};
  if(st){ if(T>=1&&T<=3){ const dr=(/^(?:drive|head|walk)\s+([a-z-]+)/i.exec(m.i||'')||[])[1]; return {sm:'Head'+(dr?' '+dr.toLowerCase():'')+' on',big:st}; }
    if([7,8,22].includes(T))return {sm:'Continue on',big:st};
    if([23,24].includes(T))return {sm:'Keep '+(T===23?'right':'left')+' onto',big:st};
    return {sm:'onto',big:st}; }
  const on=/^(.*?)\s+(onto|on|towards|toward)\s+(.+?)\.?$/i.exec(m.i||'');   // no street names from the router: take it from the wording
  if(on&&on[3].length<40)return {sm:on[2].toLowerCase()==='toward'?'towards':on[2].toLowerCase(),big:abbr(on[3])};
  return {sm:'',big:String(m.i||'Continue').replace(/\.$/,'')}; }
function dvInteract(on){ if(!map)return; ['dragging','touchZoom','doubleClickZoom','scrollWheelZoom','boxZoom','keyboard','tap'].forEach(k=>{ const h=map[k]; if(h&&h.enable)try{ on?h.enable():h.disable(); }catch(e){} }); }
function dvGeom(){ const host=ov.querySelector('.rt-map'), W2=host.clientWidth||360, H=host.clientHeight||640, bar=ov.querySelector('.rt-bar'), bh=bar?bar.offsetHeight:96, bn=ov.querySelector('.rt-bn');
  const px=W2/2, py=Math.max(H*0.5,H-bh-Math.min(160,H*0.2)), t=TILT*DEG, p=PERSP;
  const top=Math.max(0,Math.min(py-120,bn?bn.getBoundingClientRect().bottom-host.getBoundingClientRect().top-8:0));   // the banner hides the top of the screen
  const plane=(x,y)=>{ const den=p*Math.cos(t)-y*Math.sin(t); const yy=den>40?y*p/den:3000; return Math.hypot(x*(p+yy*Math.sin(t))/p,yy); };   // how far from you, on the map, a screen point is
  const R=Math.min(1500,Math.max(plane(-px,py-top),plane(W2-px,py-top),plane(-px,py-H),plane(W2-px,py-H))+40);
  return {px,py,R:Math.ceil(R)}; }
function dvApply(){ const c=ov&&ov.querySelector('.rt-mapc'); if(!c||!map)return;
  if(!S.drive||S.free){ if(c.classList.contains('dv')){ c.classList.remove('dv'); ['width','height','left','top','right','bottom','transform','transition'].forEach(k=>{ c.style[k]=''; }); S.rot=null; const nd=ov.querySelector('.rt-needle'); if(nd)nd.style.transform=''; try{ map.invalidateSize({pan:false}); }catch(e){} } return; }
  const g=dvGeom(), sz=2*g.R; S.geo=g; c.classList.add('dv');
  Object.assign(c.style,{width:sz+'px',height:sz+'px',left:(g.px-g.R)+'px',top:(g.py-g.R)+'px',right:'auto',bottom:'auto'});
  try{ map.invalidateSize({pan:false}); }catch(e){} }
function routeBearing(){ const e=S.emer, N=S.nav; if(!e||!N)return null; const P=e.pts; if(P.length<2)return null;
  const i=Math.max(1,Math.min(P.length-1,N.seg||1)), a=N.pt||P[i-1]; let j=i, acc=pd(a,P[i]); while(j<P.length-1&&acc<35){ acc+=pd(P[j],P[j+1]); j++; }   // look ~35 m ahead along the road
  const b=P[j]; if(!a||!b||(a[0]===b[0]&&a[1]===b[1]))return null; return bearing({lat:a[0],lon:a[1]},{lat:b[0],lon:b[1]}); }
function dvHeading(){ if(S.me&&S.me.hd!=null&&(S.nav?S.nav.offd==null||S.nav.offd<30:true))S.lastHd=S.me.hd; else { const rb=routeBearing(); if(rb!=null)S.lastHd=rb; }
  if(S.lastHd==null&&S.me&&S.to)S.lastHd=bearing(S.me,S.to); return S.lastHd||0; }
function dvZoom(){ const sp=(S.me&&S.me.sp)||0; if(S.dz==null)S.dz=17; if(S.dz===17&&sp>24)S.dz=16; else if(S.dz===16&&sp<17)S.dz=17; return S.dz; }
function dvRotate(anim){ const c=ov.querySelector('.rt-mapc'), nd=ov.querySelector('.rt-needle'); if(!c||!c.classList.contains('dv'))return;
  const tgt=-(S.northUp?0:dvHeading()); if(S.rot==null)S.rot=tgt; else { let d=wrap360(tgt-S.rot); if(d>180)d-=360; S.rot+=d; }
  const tr=anim?'transform .9s linear':'none';
  c.style.transition=tr; c.style.transform='perspective('+PERSP+'px) rotateX('+TILT+'deg) rotate('+S.rot.toFixed(1)+'deg)';
  if(nd){ nd.style.transition=tr; nd.style.transform='rotate('+S.rot.toFixed(1)+'deg)'; } }
function dvLine(){ if(!S._ahead||!S.emer)return; const P=S.emer.pts, N=S.nav, i=Math.max(1,Math.min(P.length,(N&&N.seg)||1)), pt=(N&&N.pt)||P[0];
  const ahead=[pt].concat(P.slice(i)); S._done.setLatLngs(P.slice(0,i).concat([pt])); S._aheadC.setLatLngs(ahead); S._ahead.setLatLngs(ahead); }
function dvList(){ const el=ov&&ov.querySelector('.rt-tl'); if(!el)return; const e=S.emer, N=S.nav;
  if(!S.tl||!e||!N){ el.hidden=true; S._tlj=null; return; }
  const from=N.along||0, j0=Math.max(1,N.next||1); el.hidden=false;
  if(S._tlj===j0&&el.childElementCount){ el.querySelectorAll('[data-k] small').forEach(x=>{ const k=+x.closest('[data-k]').dataset.k; x.textContent=dvDist(Math.max(0,N.at[k]-from)); }); return; }
  S._tlj=j0; let h='<div class="rt-tlh"><b>Turns</b><button type="button" class="rt-tlx" aria-label="Close the turn list">'+svg(IC.x)+'</button></div><ol>';
  for(let k=j0;k<e.man.length;k++){ const m=e.man[k]; h+='<li><button type="button" data-k="'+k+'"><span class="ti">'+svg(turnIcon(m.type))+'</span><span class="tt"><b>'+esc(m.i)+'</b><small>'+dvDist(Math.max(0,N.at[k]-from))+'</small></span></button></li>'; }
  el.innerHTML=h+'</ol><p class="rt-warn sm">The direct route ignores one-way streets and turn bans — check every turn and drive to the conditions.</p>';
  el.querySelector('.rt-tlx').onclick=()=>{ S.tl=false; dvList(); };
  el.querySelectorAll('[data-k]').forEach(b=>b.onclick=()=>{ const m=e.man[+b.dataset.k]; if(!S.voice)setVoice(true); say(m.vp||m.i,true); }); }
function dvOverview(){ if(!S.emer||!map)return; S.free=true; dvApply(); dvInteract(true);
  const P=S.emer.pts, i=Math.max(0,((S.nav&&S.nav.seg)||1)-1), pts=P.slice(i).concat(S._here?[S._here]:[]);
  try{ map.fitBounds(L.latLngBounds(pts),{paddingTopLeft:[24,170],paddingBottomRight:[84,140],maxZoom:17,animate:false}); }catch(e){} dvUpdate(false); }
function enterDrive(){ if(!S.emer||!ov)return; S.drive=true; S.free=false; S.tl=false; S.rot=null; S._tlj=null; ov.classList.add('drive'); ov.querySelector('.rt-dv').hidden=false;
  ov.querySelector('.rt-res').hidden=true; dvInteract(false); drawAll(); dvApply(); dvUpdate(false); paintVo();
  if(!S._warned){ S._warned=1; toast('Direct route — it ignores one-way streets. Check every turn.'); } }
function exitDrive(){ if(!S.drive)return; S.drive=false; S.free=false; S.tl=false; ov.classList.remove('drive'); ov.querySelector('.rt-dv').hidden=true; dvList();
  dvApply(); dvInteract(true); if(meMk){ const mk=meMk.getElement()&&meMk.getElement().querySelector('.rt-mek'); if(mk)mk.classList.remove('nav','hid'); if(S.me)meMk.setLatLng([S.me.lat,S.me.lon]); } if(accC&&S.me)accC.setLatLng([S.me.lat,S.me.lon]).setRadius(S.me.acc||30);
  drawAll(); fit(); paint(); paintNext(); }
function dvUpdate(anim){ if(!S.drive||!ov)return; const e=S.emer, N=S.nav; if(!e||!N)return;
  // where to show you: on the road when you're on the route, otherwise your GPS position
  const raw=S.me?[S.me.lat,S.me.lon]:null, here=(N.pt&&N.offd!=null&&N.offd<30)?N.pt:(raw||e.pts[0]); S._here=here;
  const hd=dvHeading(), pos=ov.querySelector('.rt-pos');
  if(map&&here){ if(!meMk&&S.me)drawMe(); if(meMk){ meMk.setLatLng(here); const el=meMk.getElement(), mk=el&&el.querySelector('.rt-mek'); if(mk){ mk.classList.add('nav'); mk.classList.toggle('hid',!S.free); const a=mk.querySelector('i'); if(a)a.style.transform='rotate('+hd.toFixed(1)+'deg)'; } }
    if(accC)accC.setStyle({opacity:0,fillOpacity:0}); }
  // following you, the arrow stays put near the bottom of the screen and the map glides under it (as in Google Maps)
  if(pos){ pos.hidden=S.free||!S.geo; if(S.geo){ pos.style.left=S.geo.px+'px'; pos.style.top=S.geo.py+'px'; pos.style.transform='translate(-50%,-50%) perspective('+PERSP+'px) rotateX('+TILT+'deg) rotate('+(S.northUp?hd:0).toFixed(1)+'deg)'; } }
  if(!S.free&&map&&here){
    // split the line (grey behind, blue ahead) once the map has glided to your new position, so the grey never runs ahead of the arrow
    if(anim){ if(!S._lnWait){ S._lnWait=1; const go=()=>{ if(S._lnWait){ S._lnWait=0; dvLine(); } }; map.once('moveend',go); setTimeout(go,1300); } } else dvLine();
    map.setView(here,dvZoom(),{animate:!!anim,pan:{animate:!!anim,duration:.9,easeLinearity:1}}); dvRotate(!!anim); }
  else dvLine();
  // the turn banner, "Then", and the bottom bar
  const bn=ov.querySelector('.rt-bn'), bi=bn.querySelector('.rt-bni'), bt=bn.querySelector('.rt-bnt'), th=ov.querySelector('.rt-then'), bw=ov.querySelector('.rt-bnw');
  if(N.arrived){ bi.innerHTML=svg(TURN.dest); bt.querySelector('small').textContent='You have arrived'; const b=bt.querySelector('b'); b.textContent=plainName(S.toName)||'At the call'; b.classList.toggle('long',b.textContent.length>22);
    th.hidden=true; bw.classList.remove('then'); bn.setAttribute('aria-label','You have arrived'); }
  else { const j=Math.max(1,Math.min(e.man.length-1,N.next||1)), m=e.man[j], d=N.dNext!=null?N.dNext:Math.max(0,N.at[j]-(N.along||0)), tx=mText(m);
    bi.innerHTML=svg(turnIcon(m.type))+'<small>'+esc(dvDist(d))+'</small>'; bt.querySelector('small').textContent=tx.sm; const b=bt.querySelector('b'); b.textContent=tx.big; b.classList.toggle('long',tx.big.length>22);
    bn.setAttribute('aria-label','In '+dvDist(d)+': '+(m.i||'')+' — tap to hear it');
    const m2=e.man[j+1], gap=m2?N.at[j+1]-N.at[j]:1e9;
    if(m2&&gap<900){ th.hidden=false; th.querySelector('i').innerHTML=svg(turnIcon(m2.type)); bw.classList.add('then'); } else { th.hidden=true; bw.classList.remove('then'); } }
  const tot=N.total||e.km*1000||1, rem=N.arrived?0:Math.max(0,tot-(N.along||0)), secs=e.s*rem/tot, at=new Date(Date.now()+secs*1000);
  const eb=ov.querySelector('.rt-eta b'), es=ov.querySelector('.rt-eta small');
  eb.textContent=N.arrived?'Arrived':durTxt(secs); es.textContent=N.arrived?(plainName(S.toName)||'at the call'):dvDist(rem)+' · '+p2(at.getHours())+':'+p2(at.getMinutes());
  ov.querySelector('.rt-rc').hidden=!S.free;
  ov.querySelector('.rt-dalt').hidden=!(S.alts&&S.alts.length>1);
  const gm=ov.querySelector('.rt-dgm'); if(gm&&S.to)gm.href=gmUrl(S.to,null);
  dvList(); }

W.openRoute=openRoute; W.closeRoute=closeRoute; W.rteBack=back;
W.GRRoute=Object.freeze({open:openRoute,_lib:{dist,bearing,decode6,parseLL,compass,viaPoints,gmUrl,spokenDist,prepNav,snap,mText,dvDist,dvGeom,abbr},_state:()=>S,_drive:{enter:enterDrive,exit:exitDrive}});
})();
