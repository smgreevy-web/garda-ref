const CACHE='garda-ref-v12';
const ASSETS=["./", "./index.html", "./style.css", "./app.js", "./manifest.json", "./icons/icon-192.png", "./icons/icon-512.png", "./data/az.json", "./data/c00_master.json", "./data/c01_vol.json", "./data/c02_vol.json", "./data/c03_vol.json", "./data/c04_vol.json", "./data/c05_vol.json", "./data/c06_vol.json", "./data/c07_vol.json", "./data/c08_vol.json", "./data/c09_vol.json", "./data/c10_vol.json", "./data/c11_vol.json", "./data/c11b_vol.json", "./data/c12_v12.json", "./data/c13_st.json", "./data/c14_pb.json", "./data/c15_man1.json", "./data/c16_man2.json", "./data/c17_man3.json", "./data/cases.json", "./data/meta.json", "./data/ops.json", "./data/stencils.json"];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting()));});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',e=>{
 if(e.request.method!=='GET')return;
 e.respondWith(caches.match(e.request,{ignoreSearch:true}).then(r=>r||fetch(e.request).then(res=>{
   const cp=res.clone();caches.open(CACHE).then(c=>c.put(e.request,cp));return res;})));
});