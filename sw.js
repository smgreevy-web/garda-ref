const CACHE='garda-ref-v62';
const ASSETS=["./", "./index.html", "./app.js", "./custody.css", "./custody.js", "./data/az.json", "./data/c00_master.json", "./data/c01_vol.json", "./data/c02_vol.json", "./data/c03_vol.json", "./data/c04_vol.json", "./data/c05_vol.json", "./data/c06_vol.json", "./data/c07_vol.json", "./data/c08_vol.json", "./data/c09_vol.json", "./data/c10_vol.json", "./data/c11_vol.json", "./data/c11b_vol.json", "./data/c12_v12.json", "./data/c13_st.json", "./data/c14_pb.json", "./data/c15_man1.json", "./data/c16_man2.json", "./data/c17_man3.json", "./data/cases.json", "./data/dcc_cams.json", "./data/garda_districts.geojson", "./data/garda_stations.json", "./data/guides3.json", "./data/kb.json", "./data/livecams.json", "./data/meta.json", "./data/ops.json", "./data/ops2.json", "./data/stencils.json", "./data/templates.json", "./data/tii_cams.json", "./docs.js", "./firstaid.css", "./firstaid.js", "./fonts/LICENSE-Inter.txt", "./fonts/LICENSE-SourceSerif4.txt", "./fonts/inter-var.woff2", "./fonts/sourceserif-400.woff2", "./fonts/sourceserif-600.woff2", "./gaoler.css", "./gaoler.js", "./icons.js", "./icons/apple-180.png", "./icons/badge-clock.png", "./icons/badge.png", "./icons/hero-dublin.jpg", "./icons/icon-192.png", "./icons/icon-512.png", "./icons/irl-map.svg", "./icons/maskable-192.png", "./icons/maskable-512.png", "./icons/officer.png", "./lock.js", "./manifest.json", "./media.js", "./notes.css", "./notes.js", "./osint.js", "./patrol.css", "./patrol.js", "./present.css", "./present.js", "./recorder.css", "./recorder.js", "./roster.css", "./roster.js", "./scanner.css", "./scanner.js", "./search-worker.js", "./search.js", "./social.css", "./social.js", "./style.css", "./tasks.css", "./tasks.js", "./theme.css", "./toolbox.css", "./toolbox.js", "./vendor/images/layers-2x.png", "./vendor/images/layers.png", "./vendor/images/marker-icon-2x.png", "./vendor/images/marker-icon.png", "./vendor/images/marker-shadow.png", "./vendor/leaflet-geoman.css", "./vendor/leaflet-geoman.min.js", "./vendor/leaflet.css", "./vendor/leaflet.js"];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting()));});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE&&k!=='gr-share').map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
// share menu → Assisting: a GPS app's track file arrives here (manifest share_target), is parked, and the app opens to import it
async function shareIn(req){ const items=[];
  try{ const fd=await req.formData(); for(const f of fd.getAll('track')){ if(f&&typeof f.text==='function'&&f.size<15e6)items.push({name:f.name||'track',type:f.type||'',text:await f.text()}); } }catch(_){}
  try{ const c=await caches.open('gr-share'); await c.put('./__shared-track',new Response(JSON.stringify({t:Date.now(),items}),{headers:{'Content-Type':'application/json'}})); }catch(_){}
  return Response.redirect(new URL('./?open=patrol&shared=1',self.registration.scope).href,303); }
self.addEventListener('fetch',e=>{
 const u0=new URL(e.request.url);
 if(e.request.method==='POST'&&u0.origin===location.origin&&u0.pathname.endsWith('/share-target')){ e.respondWith(shareIn(e.request)); return; }
 if(e.request.method!=='GET')return;
 const u=new URL(e.request.url);
 if(u.origin!==location.origin)return;
 if(u.pathname.includes('/helper/'))return;   // the Assisting GPS download always comes fresh from the site, never from the cache
 e.respondWith(caches.match(e.request,{ignoreSearch:true}).then(r=>r||fetch(e.request).then(res=>{
   const cp=res.clone();caches.open(CACHE).then(c=>c.put(e.request,cp));return res;})));
});self.addEventListener('notificationclick',e=>{
  e.notification.close();
  const d=Object.assign({},e.notification.data||{},{action:e.action||'',ts:Date.now()});
  const url='./'+(d.open?'?open='+encodeURIComponent(d.open)+(d.id?'&id='+encodeURIComponent(d.id):'')+(d.action?'&act='+encodeURIComponent(d.action)+'&ts='+d.ts:''):'');
  e.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(cs=>{
    for(const c of cs){ if('focus' in c){ try{ c.postMessage({gr:'notif',data:d}); }catch(_){} return c.focus(); } }
    return self.clients.openWindow(url);
  }));
});
