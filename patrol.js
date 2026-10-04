/* Assisting — Proactive patrol: records exactly where you went (GPS route with times), finds where you stopped and for
   how long, names the streets, and writes a patrol log you can copy into your notebook later in the shift.
   The route is saved only on this phone (IndexedDB 'gr_patrol'). Street names come from OpenStreetMap's street list
   for the area, downloaded when there is signal and kept on the phone (the route itself is never sent).
   Web apps can't use GPS with the screen off, so the screen is kept on while recording; pocket mode blacks it out. */
(function(){
'use strict';
const W=window, D=document, N=navigator;
const DAY=864e5;
const p2=n=>String(n).padStart(2,'0');
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const DAYS=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'], MON=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const hm=t=>{const d=new Date(t);return p2(d.getHours())+':'+p2(d.getMinutes());};
const hms=t=>{const d=new Date(t);return hm(t)+':'+p2(d.getSeconds());};
const dstr=t=>{const d=new Date(t);return DAYS[d.getDay()]+' '+d.getDate()+' '+MON[d.getMonth()]+' '+d.getFullYear();};
const dshort=t=>{const d=new Date(t);return DAYS[d.getDay()]+' '+d.getDate()+' '+MON[d.getMonth()];};
const sameDay=(a,b)=>new Date(a).toDateString()===new Date(b).toDateString();
function dur(sec){ sec=Math.max(0,Math.round(sec)); const h=Math.floor(sec/3600), m=Math.floor(sec%3600/60); return h?h+' h '+p2(m)+' min':(m?m+' min':sec+' s'); }
function durS(sec){ sec=Math.max(0,Math.round(sec)); const h=Math.floor(sec/3600), m=Math.floor(sec%3600/60); return h?h+' h '+p2(m):m+' min'; }
function clock(sec){ sec=Math.max(0,Math.floor(sec)); return Math.floor(sec/3600)+':'+p2(Math.floor(sec%3600/60))+':'+p2(sec%60); }
function km(m){ return m<1000?Math.round(m/10)*10+' m':(m/1000).toFixed(m<10000?1:0)+' km'; }
const rad=x=>x*Math.PI/180;
function dist(a1,o1,a2,o2){ const dA=rad(a2-a1), dO=rad(o2-o1); const s=Math.sin(dA/2)**2+Math.cos(rad(a1))*Math.cos(rad(a2))*Math.sin(dO/2)**2; return 12742017.6*Math.asin(Math.min(1,Math.sqrt(s))); }
function bearing(a1,o1,a2,o2){ const y=Math.sin(rad(o2-o1))*Math.cos(rad(a2)), x=Math.cos(rad(a1))*Math.sin(rad(a2))-Math.sin(rad(a1))*Math.cos(rad(a2))*Math.cos(rad(o2-o1)); return (Math.atan2(y,x)*180/Math.PI+360)%360; }
const COMP=['N','NE','E','SE','S','SW','W','NW']; const compass=b=>COMP[Math.round(b/45)%8];
const vib=p=>{try{if(N.vibrate)N.vibrate(p);}catch(e){}};
const _sv=b=>'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+b+'</svg>';
const IC={
  walk:_sv('<circle cx="13" cy="4.5" r="1.8"/><path d="M9.5 21 11 15l2.5 2.5V21"/><path d="m7 12 2.2-4.2c.4-.7 1.1-1.1 1.9-1l2.6.4 2.3 3.3 2.5.8"/><path d="m11 15 1.3-5.5"/>'),
  mark:_sv('<path d="M12 21s7-6.3 7-11.3A7 7 0 0 0 5 9.7C5 14.7 12 21 12 21Z"/><path d="M9.5 9.5h5M12 7v5"/>'),
  pocket:_sv('<rect x="6" y="2.5" width="12" height="19" rx="2.5"/><path d="M6 15h12"/><path d="M10.5 18.3h3"/>'),
  pause:_sv('<rect x="6.5" y="5" width="3.5" height="14" rx="1"/><rect x="14" y="5" width="3.5" height="14" rx="1"/>'),
  play:_sv('<path d="M7 4.8v14.4a1 1 0 0 0 1.5.9l11.2-7.2a1 1 0 0 0 0-1.7L8.5 3.9A1 1 0 0 0 7 4.8Z"/>'),
  stop:_sv('<rect x="5.5" y="5.5" width="13" height="13" rx="2"/>'),
  follow:_sv('<circle cx="12" cy="12" r="7"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3"/><circle cx="12" cy="12" r="1.8" fill="currentColor" stroke="none"/>'),
  moon:_sv('<path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5Z"/>'),
  fit:_sv('<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>'),
  info:_sv('<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>'),
  sat:_sv('<path d="M13 7 9 3 5 7l4 4"/><path d="m17 11 4 4-4 4-4-4"/><path d="m8 12 4 4 6-6-4-4Z"/><path d="m16 8 3-3"/><path d="M9 21a6 6 0 0 0-6-6"/>'),
  gear:_sv('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"/>')
};

/* ================= settings ================= */
const SK='gr_pp_set';
let S=Object.assign({stopMin:2,dark:true,online:true},(()=>{try{return JSON.parse(localStorage.getItem(SK)||'{}');}catch(e){return {};}})());
function saveS(){ try{localStorage.setItem(SK,JSON.stringify(S));}catch(e){} }

/* ================= storage (IndexedDB) ================= */
let dbp=null;
function db(){ if(dbp)return dbp; dbp=new Promise((res,rej)=>{ let r; try{ r=indexedDB.open('gr_patrol',1); }catch(e){ rej(e); return; }
  r.onupgradeneeded=()=>{ const d=r.result; if(!d.objectStoreNames.contains('patrols'))d.createObjectStore('patrols',{keyPath:'id'}); if(!d.objectStoreNames.contains('streets'))d.createObjectStore('streets',{keyPath:'k'}); };
  r.onsuccess=()=>res(r.result); r.onerror=()=>rej(r.error); }); return dbp; }
function idb(store,mode,fn){ return db().then(d=>new Promise((res,rej)=>{ const tx=d.transaction(store,mode), st=tx.objectStore(store); let out; const q=fn(st);
  if(q)q.onsuccess=()=>{out=q.result;}; tx.oncomplete=()=>res(out); tx.onerror=tx.onabort=()=>rej(tx.error); })); }
const put=(s,v)=>idb(s,'readwrite',st=>st.put(v));
const get=(s,k)=>idb(s,'readonly',st=>st.get(k));
const del=(s,k)=>idb(s,'readwrite',st=>st.delete(k));
const getAll=s=>idb(s,'readonly',st=>st.getAll());
const clearStore=s=>idb(s,'readwrite',st=>st.clear());

/* ================= reference data (offline landmarks) ================= */
let STN=null, DCC=null, refP=null;
function loadRefs(){ if(refP)return refP; refP=Promise.all([
    fetch('data/garda_stations.json').then(r=>r.json()).catch(()=>[]),
    fetch('data/dcc_cams.json').then(r=>r.json()).catch(()=>[])]).then(([s,d])=>{ STN=(s||[]).filter(x=>x&&x.lat); DCC=(d||[]).filter(x=>x&&x.lat); });
  return refP; }
function nearStation(lat,lon){ let b=null; for(const s of STN||[]){ const d=dist(lat,lon,s.lat,s.lon); if(!b||d<b.d)b={d,s}; } return b; }
function landmark(lat,lon){
  let c=null; for(const x of DCC||[]){ const d=dist(lat,lon,x.lat,x.lon); if(d<=140&&(!c||d<c.d))c={d,n:x.n}; }
  const st=nearStation(lat,lon);
  if(st&&st.d<90) return 'at '+st.s.n+' Garda Station';
  if(c) return 'near '+c.n;
  if(st&&st.d<5000) return km(st.d)+' '+compass(bearing(st.s.lat,st.s.lon,lat,lon))+' of '+st.s.n+' Garda Station';
  return lat.toFixed(5)+', '+lon.toFixed(5);
}

/* ================= street names (OpenStreetMap, cached per ~1 km tile) ================= */
const TLA=0.01, TLO=0.016, TILE_TTL=180*DAY;
const OVP=['https://overpass-api.de/api/interpreter','https://overpass.private.coffee/api/interpreter'];
const tk=(i,j)=>i+'_'+j;
function tilesAround(lat,lon,r){ const i0=Math.floor(lat/TLA), j0=Math.floor(lon/TLO), out=[]; for(let i=i0-r;i<=i0+r;i++)for(let j=j0-r;j<=j0+r;j++)out.push([i,j]); return out; }
function tilesForTrack(P){ const m=new Map(); for(const q of P){ const i=Math.floor(q[1]/TLA), j=Math.floor(q[2]/TLO);
    for(let a=-1;a<=1;a++)for(let b=-1;b<=1;b++){ // neighbour tiles only when the point is near that edge (~150 m)
      if(a&&Math.abs(q[1]-(a<0?i:i+1)*TLA)>0.0014)continue; if(b&&Math.abs(q[2]-(b<0?j:j+1)*TLO)>0.0023)continue; m.set(tk(i+a,j+b),[i+a,j+b]); } }
  return [...m.values()]; }
async function overpass(s,w,n,e){
  const q='[out:json][timeout:25];way["highway"]["name"]('+[s,w,n,e].map(x=>x.toFixed(5)).join(',')+');out geom;';
  let last=null;
  for(const u of OVP){
    try{ const ac=W.AbortController?new AbortController():null, tm=setTimeout(()=>ac&&ac.abort(),35000);
      const r=await fetch(u,{method:'POST',body:'data='+encodeURIComponent(q),headers:{'Content-Type':'application/x-www-form-urlencoded'},signal:ac?ac.signal:undefined});
      clearTimeout(tm); if(!r.ok)throw new Error('HTTP '+r.status);
      const j=await r.json();
      return (j.elements||[]).filter(x=>x.type==='way'&&x.tags&&x.tags.name&&x.geometry&&x.geometry.length>1)
        .map(x=>{ const g=[]; for(const p of x.geometry){ g.push(Math.round(p.lat*1e5),Math.round(p.lon*1e5)); } return {id:x.id,n:x.tags.name,g}; });
    }catch(err){ last=err; }
  }
  throw last||new Error('no street server');
}
let fetching=null, fetchFailAt=0;
// load cached tiles; optionally download missing ones (grouped into ~3 km blocks, one request each)
async function tiles(T,download){
  const recs=await Promise.all(T.map(t=>get('streets',tk(t[0],t[1])).catch(()=>null)));
  const miss=T.filter((t,k)=>!recs[k]||Date.now()-recs[k].ts>TILE_TTL);
  if(miss.length&&download&&S.online&&N.onLine!==false&&Date.now()-fetchFailAt>90e3){
    const blocks=new Map(); for(const t of miss){ const key=tk(Math.floor(t[0]/3),Math.floor(t[1]/3)); if(!blocks.has(key))blocks.set(key,[]); blocks.get(key).push(t); }
    let n=0;
    for(const bl of blocks.values()){
      if(n++>=12)break;
      const s=Math.min(...bl.map(t=>t[0]))*TLA, nn=(Math.max(...bl.map(t=>t[0]))+1)*TLA, w=Math.min(...bl.map(t=>t[1]))*TLO, e=(Math.max(...bl.map(t=>t[1]))+1)*TLO;
      let ways; try{ ways=await overpass(s,w,nn,e); }catch(err){ fetchFailAt=Date.now(); break; }
      const buckets=new Map(bl.map(t=>[tk(t[0],t[1]),[]]));
      for(const wy of ways){ let a=90,b=180,c=-90,d=-180; for(let k=0;k<wy.g.length;k+=2){ const la=wy.g[k]/1e5, lo=wy.g[k+1]/1e5; if(la<a)a=la; if(la>c)c=la; if(lo<b)b=lo; if(lo>d)d=lo; }
        for(let i=Math.floor(a/TLA);i<=Math.floor(c/TLA);i++)for(let j=Math.floor(b/TLO);j<=Math.floor(d/TLO);j++){ const bk=buckets.get(tk(i,j)); if(bk)bk.push(wy); } }
      for(const [k,ws] of buckets){ const r={k,ts:Date.now(),ways:ws}; try{ await put('streets',r); }catch(e){} const ix=T.findIndex(t=>tk(t[0],t[1])===k); if(ix>=0)recs[ix]=r; }
      if(n<blocks.size)await new Promise(r=>setTimeout(r,1100));
    }
  }
  return recs.filter(Boolean);
}
// spatial index over street segments
const CLA=0.0005, CLO=0.0008;
function buildIndex(recs){
  const names=[], nmap=new Map(), seg=[], cells=new Map(), seen=new Set();
  for(const r of recs)for(const w of r.ways||[]){ if(seen.has(w.id))continue; seen.add(w.id);
    let ni=nmap.get(w.n); if(ni==null){ ni=names.length; names.push(w.n); nmap.set(w.n,ni); }
    const g=w.g; for(let k=0;k+3<g.length;k+=2){ const a=g[k]/1e5,b=g[k+1]/1e5,c=g[k+2]/1e5,d=g[k+3]/1e5, si=seg.length; seg.push([a,b,c,d,ni]);
      const i0=Math.floor(Math.min(a,c)/CLA)-1,i1=Math.floor(Math.max(a,c)/CLA)+1,j0=Math.floor(Math.min(b,d)/CLO)-1,j1=Math.floor(Math.max(b,d)/CLO)+1;
      if((i1-i0)*(j1-j0)>400)continue;   // absurdly long segment — skip rather than flood the grid
      for(let i=i0;i<=i1;i++)for(let j=j0;j<=j1;j++){ const key=i*1000000+j; let L=cells.get(key); if(!L){L=[];cells.set(key,L);} L.push(si); } } }
  return seg.length?{names,seg,cells}:null;
}
function segDist(lat,lon,s){ const kx=Math.cos(rad(lat))*111320, ky=110574;
  const ax=(s[1]-lon)*kx, ay=(s[0]-lat)*ky, bx=(s[3]-lon)*kx, by=(s[2]-lat)*ky, dx=bx-ax, dy=by-ay, L=dx*dx+dy*dy;
  let t=L?-(ax*dx+ay*dy)/L:0; t=t<0?0:t>1?1:t; const x=ax+t*dx, y=ay+t*dy; return Math.sqrt(x*x+y*y); }
function nearest(ix,lat,lon,max,notName){ if(!ix)return null; const L=ix.cells.get(Math.floor(lat/CLA)*1000000+Math.floor(lon/CLO)); if(!L)return null;
  let best=null; for(const si of L){ const s=ix.seg[si]; if(notName!=null&&s[4]===notName)continue; const d=segDist(lat,lon,s); if(d<=max&&(!best||d<best.d))best={d,ni:s[4]}; }
  return best?{d:best.d,ni:best.ni,n:ix.names[best.ni]}:null; }

/* ================= analysis: segments, gaps, stops, distance ================= */
const anMemo=new Map();
function analyseMemo(p){ const k=p.id+'|'+(S.stopMin||2)+'|'+p.pts.length+'|'+(p.pauses||[]).length; let a=anMemo.get(k); if(!a){ a=analyse(p); anMemo.set(k,a); } return a; }
const MAXACC=65, GAP=75, STOP_R=35;
function analyse(p){
  const P=p.pts, n=P.length, TMIN=(S.stopMin||2)*60, gaps=[], segs=[]; let cur=[];
  for(let i=0;i<n;i++){
    if(i>0&&P[i][0]-P[i-1][0]>GAP){ const d=dist(P[i-1][1],P[i-1][2],P[i][1],P[i][2]);
      const pz=(p.pauses||[]).some(q=>q[0]>=P[i-1][0]-2&&q[1]!=null&&q[1]<=P[i][0]+2);
      gaps.push({i0:i-1,i1:i,s0:P[i-1][0],s1:P[i][0],d,still:d<STOP_R,pause:pz}); if(cur.length)segs.push(cur); cur=[]; }
    cur.push(i); }
  if(cur.length)segs.push(cur);
  const stops=[]; let i=0;
  while(i<n){ let j=i, la=P[i][1], lo=P[i][2], m=1;
    while(j+1<n){ const q=P[j+1]; if(dist(la,lo,q[1],q[2])>STOP_R)break; j++; m++; la+=(q[1]-la)/m; lo+=(q[2]-lo)/m; }
    const d=P[j][0]-P[i][0];
    if(j>i&&d>=TMIN){ const gp=gaps.filter(g=>g.i0>=i&&g.i1<=j); stops.push({i0:i,i1:j,s0:P[i][0],s1:P[j][0],dur:d,lat:la,lon:lo,gap:gp.reduce((a,g)=>a+(g.s1-g.s0),0),paused:gp.some(g=>g.pause)}); i=j+1; }
    else i++; }
  const inStop=new Uint8Array(n); for(const s of stops)for(let k=s.i0;k<=s.i1;k++)inStop[k]=1;
  // distance: smooth the wobble (centred 5-point mean) and only count movement once it clears ~12 m,
  // so GPS jitter while walking or standing doesn't inflate the total
  let dm=0, mv=0;
  for(const sg of segs){
    const sm=sg.map((i,k)=>{ let la=0,lo=0,c=0; for(let j=Math.max(0,k-2);j<=Math.min(sg.length-1,k+2);j++){ if(inStop[sg[j]]!==inStop[i])continue; la+=P[sg[j]][1]; lo+=P[sg[j]][2]; c++; } return [la/c,lo/c]; });
    let A=null;
    for(let k=0;k<sg.length;k++){ if(!A){ A=sm[k]; continue; } const d=dist(A[0],A[1],sm[k][0],sm[k][1]);
      if(inStop[sg[k]]){ if(!inStop[sg[k-1]]&&d>3)dm+=d; A=sm[k]; continue; }      // reaching a stop: count the last stretch, then hold
      if(d>=12){ dm+=d; A=sm[k]; } }
    if(A&&sg.length&&!inStop[sg[sg.length-1]]){ const z=sm[sg.length-1], d=dist(A[0],A[1],z[0],z[1]); if(d>3)dm+=d; }
    for(let k=1;k<sg.length;k++){ if(inStop[sg[k-1]]&&inStop[sg[k]])continue; mv+=P[sg[k]][0]-P[sg[k-1]][0]; } }
  const total=n?P[n-1][0]-P[0][0]:0, spd=mv>30?dm/mv:0;
  return {segs,gaps,stops,dist:dm,moving:mv,total,mode:spd>3.2?'mobile':'foot'};
}
// position at s seconds (interpolated; inside a gap → last known position)
function posAt(p,s){ const P=p.pts; if(!P.length)return null; if(s<=P[0][0])return {lat:P[0][1],lon:P[0][2],i:0};
  let lo=0, hi=P.length-1; if(s>=P[hi][0])return {lat:P[hi][1],lon:P[hi][2],i:hi};
  while(hi-lo>1){ const m=(lo+hi)>>1; if(P[m][0]<=s)lo=m; else hi=m; }
  const a=P[lo], b=P[hi]; if(b[0]-a[0]>GAP)return {lat:a[1],lon:a[2],i:lo,gap:true};
  const f=(s-a[0])/Math.max(1,b[0]-a[0]); return {lat:a[1]+(b[1]-a[1])*f,lon:a[2]+(b[2]-a[2])*f,i:f<.5?lo:hi}; }

/* per-point street names, smoothed */
function pointNames(p,ix){ if(!ix)return null; const P=p.pts, nm=new Array(P.length);
  for(let k=0;k<P.length;k++){ const r=nearest(ix,P[k][1],P[k][2],Math.min(45,Math.max(25,P[k][3]||0))); nm[k]=r?r.n:null; }
  for(let k=1;k<P.length-1;k++){ if(nm[k]!==nm[k-1]&&nm[k-1]===nm[k+1])nm[k]=nm[k-1]; }
  return nm; }
function stopLabel(p,ix,st){
  if(ix){ const a=nearest(ix,st.lat,st.lon,45); if(a){ const b=nearest(ix,st.lat,st.lon,40,a.ni); return a.n+(b?' at '+b.n:''); } }
  const rv=p.rev&&p.rev[st.lat.toFixed(4)+','+st.lon.toFixed(4)]; if(rv)return rv;
  return landmark(st.lat,st.lon); }
function placeLabel(p,ix,lat,lon){ if(ix){ const a=nearest(ix,lat,lon,45); if(a)return a.n; } const rv=p.rev&&p.rev[lat.toFixed(4)+','+lon.toFixed(4)]; return rv||landmark(lat,lon); }

/* timeline: start, streets walked, stops, notes, gaps, pauses, end */
function timeline(p,a,ix){
  const P=p.pts, n=P.length, T=[]; if(!n)return T;
  T.push({k:'start',s:P[0][0],i:0,label:placeLabel(p,ix,P[0][1],P[0][2])});
  const nm=pointNames(p,ix);
  if(nm){
    const brk=new Uint8Array(n); for(const s of a.stops)for(let k=s.i0;k<=s.i1;k++)brk[k]=2; for(const g of a.gaps)brk[g.i1]=brk[g.i1]||1;
    let runs=[], r=null;
    for(let k=0;k<n;k++){ if(brk[k]===2){ if(r){runs.push(r);r=null;} continue; }
      if(brk[k]===1&&r){ runs.push(r); r=null; }
      if(r&&r.name===nm[k]){ r.s1=P[k][0]; r.i1=k; continue; }
      if(r)runs.push(r); r={s0:P[k][0],s1:P[k][0],i0:k,i1:k,name:nm[k]}; }
    if(r)runs.push(r);
    // absorb flickers (<25 s) into the previous run on the same stretch, then join neighbours with the same name
    const out=[]; for(const x of runs){ const pv=out[out.length-1];
      if(pv&&x.s1-x.s0<25&&x.i0===pv.i1+1){ pv.s1=x.s1; pv.i1=x.i1; continue; }
      if(pv&&pv.name===x.name&&x.i0===pv.i1+1){ pv.s1=x.s1; pv.i1=x.i1; continue; }
      out.push(x); }
    for(const x of out){ if(x.name==null&&x.s1-x.s0<60)continue; const mid=P[(x.i0+x.i1)>>1];
      T.push({k:'street',s:x.s0,s0:x.s0,s1:x.s1,i0:x.i0,i1:x.i1,name:x.name,label:x.name||('off-street · '+landmark(mid[1],mid[2]))}); }
  }
  a.stops.forEach((st,si)=>T.push({k:'stop',s:st.s0,s0:st.s0,s1:st.s1,dur:st.dur,si,i0:st.i0,i1:st.i1,label:stopLabel(p,ix,st),gap:st.gap,paused:st.paused}));
  for(const g of a.gaps){ if(a.stops.some(st=>g.i0>=st.i0&&g.i1<=st.i1))continue; T.push({k:g.pause?'pause':'gap',s:g.s0,s0:g.s0,s1:g.s1,d:g.d,still:g.still,i0:g.i0,i1:g.i1}); }
  (p.marks||[]).forEach((m,mi)=>T.push({k:'mark',s:m.s,mi,label:m.k+(m.note?' — '+m.note:''),place:placeLabel(p,ix,m.lat,m.lon)}));
  const L=P[n-1]; T.push({k:'end',s:L[0],i:n-1,label:placeLabel(p,ix,L[1],L[2]),open:!p.end});
  const rank={start:0,street:1,gap:1,pause:1,stop:2,mark:3,end:9};
  T.sort((x,y)=>x.s-y.s||rank[x.k]-rank[y.k]);
  // a street entry that only repeats the stop it leads into/out of adds nothing
  return T.filter((x,k)=>!(x.k==='street'&&x.s1-x.s0<60&&((T[k+1]&&T[k+1].k==='stop'&&T[k+1].label.indexOf(x.name)===0)||(T[k-1]&&T[k-1].k==='stop'&&T[k-1].label.indexOf(x.name)===0))));
}
function mostTime(T){ const m=new Map(); for(const x of T){ if(x.k!=='street'&&x.k!=='stop')continue; const key=x.k==='stop'?x.label.split(' at ')[0]:x.name; if(!key)continue; m.set(key,(m.get(key)||0)+(x.s1-x.s0)); }
  return [...m.entries()].filter(e=>e[1]>=60).sort((a,b)=>b[1]-a[1]).slice(0,8); }
function tlTime(p,x){ const t0=p.start+x.s*1000; if(x.s1!=null&&x.s1-x.s0>=60)return hm(t0)+'–'+hm(p.start+x.s1*1000); return hm(t0); }
function logText(p,a,T,ix){
  const P=p.pts, L=[]; const t0=p.start+(P.length?P[0][0]*1000:0), t1=p.start+(P.length?P[P.length-1][0]*1000:0);
  const st=a.stops.length, mk=(p.marks||[]).length;
  L.push('PROACTIVE PATROL — '+dstr(t0));
  L.push(hm(t0)+'–'+hm(t1)+(sameDay(t0,t1)?'':' ('+dshort(t1)+')')+' · '+dur(a.total)+' · '+km(a.dist)+(a.mode==='mobile'?' mobile':' on foot')+' · '+st+' stop'+(st===1?'':'s')+(mk?' · '+mk+' note'+(mk===1?'':'s'):''));
  L.push('');
  let day=new Date(t0).toDateString();
  for(const x of T){ const tt=p.start+x.s*1000; if(new Date(tt).toDateString()!==day){ day=new Date(tt).toDateString(); L.push('— '+dshort(tt)+' —'); }
    const tm=tlTime(p,x);
    if(x.k==='start')L.push(tm+'  Start — '+x.label);
    else if(x.k==='street')L.push(tm+'  '+x.label);
    else if(x.k==='stop')L.push(tm+'  STOP '+dur(x.dur)+' — '+x.label+(x.gap?' (no GPS for '+dur(x.gap)+' of it)':''));
    else if(x.k==='mark')L.push(tm+'  NOTE: '+x.label+' ('+x.place+')');
    else if(x.k==='gap')L.push(tm+'  No GPS '+dur(x.s1-x.s0)+(x.still?' — same place before and after':' — moved '+km(x.d)+' in that time'));
    else if(x.k==='pause')L.push(tm+'  Recording paused '+dur(x.s1-x.s0));
    else if(x.k==='end')L.push(tm+'  '+(x.open?'Still recording — ':'End — ')+x.label); }
  const mt=mostTime(T); if(mt.length){ L.push(''); L.push('Most time: '+mt.slice(0,5).map(e=>e[0]+' '+durS(e[1])).join(' · ')); }
  L.push(''); L.push('Positions from this phone’s GPS (usually within 5–20 m).'+(ix?' Street names © OpenStreetMap contributors.':' Street names not looked up — nearest landmarks given.'));
  return L.join('\n'); }

/* ================= recording ================= */
const AK='gr_pp_active';
let rec=null, wl=null, tick=null, batt=null;
function newPatrol(id){ const now=Date.now(); return {id:id||'pp_'+now,v:1,start:now,end:null,pts:[],marks:[],pauses:[],rev:{}}; }

/* ================= Assisting GPS — the companion app that records with the phone locked =================
   Assisting asks it to start / sync / stop with an intent link; it answers by opening Assisting at
   ?open=patrol&… with the track packed into the #fragment (never sent to a server — fragments stay on the phone). */
const HP_PKG='ie.assisting.gps', HP_SCHEME='assisting-gps', HK='gr_pp_helper';
const APP_BASE=location.origin+location.pathname.replace(/[^/]*$/,'');
const HP_APK=APP_BASE+'helper/assisting-gps.apk';
const isAndroid=/Android/i.test(N.userAgent||'');
function hinfo(){ try{ return JSON.parse(localStorage.getItem(HK)||'{}')||{}; }catch(e){ return {}; } }
function hset(o){ const x=Object.assign(hinfo(),o); try{ localStorage.setItem(HK,JSON.stringify(x)); }catch(e){} return x; }
function helperOn(){ const h=hinfo(); return isAndroid&&!!h.ok&&h.use!==false; }
function hpRemember(id){ const h=hinfo(); hset({sids:[id].concat((h.sids||[]).filter(x=>x!==id)).slice(0,12)}); }
const hpKnows=id=>(hinfo().sids||[]).includes(id);
// call straight from a tap: Chrome only opens another app from a user gesture
function hpUrl(cmd,params){
  const qs=new URLSearchParams(params||{}).toString(), fb=APP_BASE+'?open=patrol&gpsok=0&cmd='+encodeURIComponent(cmd);
  return 'intent://'+cmd+(qs?'?'+qs:'')+'#Intent;scheme='+HP_SCHEME+';package='+HP_PKG+';S.browser_fallback_url='+encodeURIComponent(fb)+';end'; }
function callHelper(cmd,params){ const u=hpUrl(cmd,params); hset({last:cmd,lastAt:Date.now()});
  if(W.__hpTest){ W.__hpTest(u); return true; }                                  // test harness only
  try{ location.href=u; return true; }catch(e){ return false; } }
async function unpackHelper(b64){
  let t=String(b64||'').replace(/-/g,'+').replace(/_/g,'/'); while(t.length%4)t+='=';
  const bin=atob(t), u8=new Uint8Array(bin.length); for(let i=0;i<bin.length;i++)u8[i]=bin.charCodeAt(i);
  if(typeof DecompressionStream!=='function')throw new Error('update Chrome to bring tracks in');
  const txt=await new Response(new Blob([u8]).stream().pipeThrough(new DecompressionStream('deflate'))).text();
  const j=JSON.parse(txt); if(!j||j.src!=='assisting-gps'||!Array.isArray(j.f)||!isFinite(+j.t0))throw new Error('not an Assisting GPS track');
  const t0=+j.t0, fixes=[]; let ss=0, la=0, lo=0;
  for(const r of j.f){ if(!Array.isArray(r))continue; ss+=+r[0]||0; la+=+r[1]||0; lo+=+r[2]||0; fixes.push({t:t0+ss*1000,lat:la/1e6,lon:lo/1e6,acc:r[3]==null?999:+r[3]}); }
  return {sid:String(j.sid||''),part:!!j.part,t0,fixes}; }
const span=p=>p.pts.length?[p.start+p.pts[0][0]*1000,p.start+p.pts[p.pts.length-1][0]*1000]:[p.start,p.end||p.start];
function overlaps(a,b){ const A=span(a), B=span(b); return Math.min(A[1],B[1])-Math.max(A[0],B[0])>0; }
// the helper keeps recording through a pause in Assisting — leave those minutes out, as the officer asked
function mergeHelper(a,b){
  const pz=(a.pauses||[]).map(q=>[a.start+q[0]*1000,q[1]==null?Infinity:a.start+q[1]*1000]);
  const keep=b.pts.filter(q=>{ const t=b.start+q[0]*1000; return !pz.some(z=>t>z[0]&&t<z[1]); });
  if(!keep.length)return Object.assign({},a,{hp:1});
  const m=mergePatrols(a,Object.assign({},b,{pts:keep,src:{kind:'helper',name:'Assisting GPS'}}));
  m.hp=1; return m; }
async function importHelper(pk){
  let h; try{ h=await unpackHelper(pk); }catch(e){ toast(/update Chrome/.test(e&&e.message)?'Couldn’t bring the route in — update Chrome, then open the Assisting GPS app and tap “Send the last patrol to Assisting again”':'Couldn’t read the route from Assisting GPS — open the Assisting GPS app and tap “Send the last patrol to Assisting again”'); return; }
  hset({ok:true,seen:Date.now()});
  try{ await initP; }catch(e){}
  const hp=patrolFromFixes(h.fixes,[],{kind:'helper',name:'Assisting GPS'});
  if(!hp){ toast('Assisting GPS had no usable positions — was GPS on?'); return; }
  const sid=/^pp_[A-Za-z0-9_]{1,60}$/.test(h.sid)?h.sid:null;
  const live=rec&&!rec.done?rec.p:null;
  anMemo.clear();
  // 1. the patrol the helper was started for (its id travels both ways)
  let target=null;
  if(sid){ if(live&&live.id===sid)target=live; else { try{ target=await get('patrols',sid)||null; }catch(e){} } }
  if(target){ await applyHelper(target,hp,h.part); return; }
  // 2. no patrol with that id: keep it as its own patrol, and offer to merge if it overlaps one by a minute or more
  hp.id=sid||hp.id; hp.hp=1; hp.src={kind:'helper',name:'Assisting GPS'};
  const ov=x=>{ if(!x||!x.pts||!x.pts.length)return false; const A=span(x), B=span(hp); return Math.min(A[1],B[1])-Math.max(A[0],B[0])>=60e3; };
  let all=[]; try{ all=await getAll('patrols'); }catch(e){}
  const cand=ov(live)?live:all.find(x=>x.end&&x.id!==hp.id&&ov(x));
  if(cand){ hpMergeSheet(cand,hp,h.part); return; }
  try{ await put('patrols',hp); }catch(e){ toast('Couldn’t save on this phone'); return; }
  openDetail(hp.id,true); toast('Patrol brought in from Assisting GPS'); }
async function applyHelper(target,hp,part){
  const live=rec&&!rec.done&&rec.p===target;
  const m=mergeHelper(target,hp);
  if(live){
    m.end=null; rec.p=m; rec.an=null; rec.anAt=0; rec.anDrawn=-1; save(true);
    if(!part){ await finish(); toast('Finished — the route Assisting GPS recorded is in'); return; }
    view='rec'; render(); toast('Gaps filled from Assisting GPS'); return; }
  if(!target.end&&part)m.end=null;
  else if(!target.end){ m.end=span(m)[1]; try{ if(localStorage.getItem(AK)===m.id)localStorage.removeItem(AK); }catch(e){} }
  try{ await put('patrols',m); }catch(e){ toast('Couldn’t save on this phone'); return; }
  openDetail(m.id,true); toast('Route from Assisting GPS added'); }
function hpMergeSheet(a,b,part){ build(); const A=span(a);
  sheet('<h4>Add this route to your patrol?</h4><p>Assisting GPS sent a route that overlaps your patrol of <b>'+dshort(A[0])+' '+hm(A[0])+'–'+hm(A[1])+'</b>. Adding it fills the “No GPS” gaps and keeps your notes.</p>'
   +'<div class="pp-row"><button type="button" class="pp-sec" id="ppSep">Keep separate</button><button type="button" class="pp-sec on" id="ppMrg">Add it</button></div>',
   s=>{ s.querySelector('#ppMrg').onclick=async()=>{ closeSheet(); await applyHelper(a,b,part); };
     s.querySelector('#ppSep').onclick=async()=>{ closeSheet(); try{ await put('patrols',b); }catch(e){} openDetail(b.id,true); toast('Saved as its own patrol'); }; }); }

async function startPatrol(id){
  if(!('geolocation' in N)){ toast('This phone’s browser has no GPS access'); return; }
  if(rec&&!rec.done){ view='rec'; render(); return; }
  const p=newPatrol(id); if(helperOn()){ p.hp=1; hpRemember(p.id); }
  rec={p,watch:null,last:null,cur:null,weak:0,glitch:0,paused:false,lastSave:0,live:null,an:null,anAt:0,err:null};
  try{ localStorage.setItem(AK,p.id); }catch(e){}
  try{ await put('patrols',p); }catch(e){ toast('Can’t save on this phone — storage is blocked'); }
  beginWatch(); wake(true); vib(60); view='rec'; render(); paintStrips(); startTick();
  toast(p.hp?'Recording — Assisting GPS records too, so you can lock the phone':'Recording — keep Assisting open. Pocket mode blacks out the screen.');
}
function beginWatch(){ if(!rec||rec.watch!=null)return; rec.err=null;
  try{ rec.watch=N.geolocation.watchPosition(onFix,onErr,{enableHighAccuracy:true,maximumAge:0,timeout:30000}); }catch(e){ rec.err='nogps'; } }
function endWatch(){ if(rec&&rec.watch!=null){ try{N.geolocation.clearWatch(rec.watch);}catch(e){} rec.watch=null; } }
function onErr(e){ if(!rec)return; if(e&&e.code===1){ rec.err='denied'; endWatch(); vib([200,100,200]); } else rec.err='nosig'; updateLive(); }
function onFix(pos){ feed({lat:pos.coords.latitude,lon:pos.coords.longitude,acc:pos.coords.accuracy,t:(pos.timestamp&&Math.abs(pos.timestamp-Date.now())<120e3)?pos.timestamp:Date.now()}); }
function feed(f){
  if(!rec||rec.paused||rec.done)return; rec.err=null;
  const acc=Math.round(f.acc||999), P=rec.p.pts, s=Math.max(0,Math.round((f.t-rec.p.start)/1000)), L=P[P.length-1];
  if(L&&acc<=MAXACC){ const dd=dist(L[1],L[2],f.lat,f.lon), dt0=Math.max(1,s-L[0]); if(dd>60&&dd/dt0>45){ rec.glitch++; updateLive(); return; } }   // impossible jump — GPS glitch
  rec.cur={lat:f.lat,lon:f.lon,acc,t:f.t};
  if(acc>MAXACC){ rec.weak++; updateLive(); return; }
  if(L){ const dt=s-L[0]; if(dt<=0){ updateLive(); return; }
    const d=dist(L[1],L[2],f.lat,f.lon);
    if(d<Math.max(5,acc*.6)&&dt<20){ updateLive(); return; } }             // standing still: one point every 20 s
  const pt=[s,+f.lat.toFixed(6),+f.lon.toFixed(6),acc]; P.push(pt);
  addLive(pt,L); save(false); updateLive();
  if(!fetching&&Date.now()-(rec.tileAt||0)>60e3){ rec.tileAt=Date.now(); fetching=tiles(tilesAround(f.lat,f.lon,1),S.online&&N.onLine!==false).then(r=>{ liveIx=buildIndex(r)||liveIx; }).catch(()=>{}).finally(()=>{fetching=null;}); }
}
function save(force){ if(!rec)return; const now=Date.now(); if(!force&&now-rec.lastSave<10e3)return; rec.lastSave=now; put('patrols',rec.p).catch(()=>{}); }
function pause(){ if(!rec||rec.paused)return; const s=Math.round((Date.now()-rec.p.start)/1000); rec.p.pauses.push([s,null]); rec.paused=true; endWatch(); wake(false); save(true); render(); paintStrips(); vib(40); }
function resume(){ if(!rec||!rec.paused)return; const s=Math.round((Date.now()-rec.p.start)/1000); const q=rec.p.pauses[rec.p.pauses.length-1]; if(q&&q[1]==null)q[1]=s;
  rec.paused=false; beginWatch(); wake(true); save(true); render(); paintStrips(); vib(40); }
async function finish(){ if(!rec)return; const p=rec.p;
  if(rec.paused){ const q=p.pauses[p.pauses.length-1]; if(q&&q[1]==null)q[1]=Math.round((Date.now()-p.start)/1000); }
  endWatch(); wake(false); p.end=Date.now(); rec.done=true;
  try{ await put('patrols',p); }catch(e){}
  try{ localStorage.removeItem(AK); }catch(e){}
  rec=null; stopTick(); pocket(false); paintStrips(); vib([60,80,60]);
  if(!p.pts.length){ if(p.hp){ view='list'; render(); toast('Waiting for the route from Assisting GPS…'); return; }
    try{ await del('patrols',p.id); }catch(e){} toast('Nothing recorded — no GPS fix was received'); view='list'; render(); return; }
  openDetail(p.id,true);
}
async function wake(on){
  if(!('wakeLock' in N))return;
  try{ if(on&&!wl&&D.visibilityState==='visible'){ wl=await N.wakeLock.request('screen'); wl.addEventListener('release',()=>{wl=null;}); }
       else if(!on&&wl){ const w=wl; wl=null; await w.release(); } }catch(e){}
}
D.addEventListener('visibilitychange',()=>{ if(!rec||rec.done)return;
  if(D.visibilityState==='hidden'){ save(true); rec.hiddenAt=Date.now(); }
  else { if(!rec.paused){ wake(true); if(rec.watch==null&&rec.err!=='denied')beginWatch(); }
    if(rec.hiddenAt&&Date.now()-rec.hiddenAt>GAP*1000)toast(rec.p.hp?'Assisting GPS kept recording while the phone was locked — tap Fill gaps to add it now, or it comes in when you finish':'GPS paused while Assisting was in the background ('+hm(rec.hiddenAt)+'–'+hm(Date.now())+')'); rec.hiddenAt=0; } });
W.addEventListener('pagehide',()=>{ if(rec&&!rec.done)save(true); });
function startTick(){ if(tick)return; tick=setInterval(()=>{ if(!rec){stopTick();return;} updateLive(); paintStrips(); },1000); }
function stopTick(){ if(tick){ clearInterval(tick); tick=null; } }
function elapsed(){ if(!rec)return 0; const p=rec.p; let s=(Date.now()-p.start)/1000; for(const q of p.pauses){ s-=((q[1]==null?(Date.now()-p.start)/1000:q[1])-q[0]); } return Math.max(0,s); }
function recAnalysis(){ if(!rec)return null; if(!rec.an||Date.now()-rec.anAt>10e3){ rec.an=analyse(rec.p); rec.anAt=Date.now(); } return rec.an; }
if(N.getBattery){ N.getBattery().then(b=>{ batt=b; }).catch(()=>{}); }

/* marks (quick notes at the current spot) */
const MARKS=['Checked premises','Spoke to person','Business visit','Vehicle check','Suspicious activity','Incident','Public order','Visible presence'];
function markSheet(){
  if(!rec)return; const P=rec.p.pts, lp=P.length?P[P.length-1]:null, fresh=lp&&Date.now()-(rec.p.start+lp[0]*1000)<90e3;
  // the live fix if it's good, else the last recorded point
  const c=(rec.cur&&rec.cur.acc<=MAXACC)?rec.cur:(lp&&(fresh||!rec.cur)?{lat:lp[1],lon:lp[2]}:rec.cur);
  if(!c){ toast('Waiting for GPS — try again in a moment'); return; }
  let pick=null;
  sheet('<h4>Note this spot</h4><p>'+hm(Date.now())+' · '+esc(placeLabel(rec.p,liveIx,c.lat,c.lon))+'</p><div class="pp-chips">'+MARKS.map(m=>'<button type="button" class="pp-chip" data-m="'+esc(m)+'">'+esc(m)+'</button>').join('')+'</div>'
    +'<input class="pp-in" id="ppMkN" maxlength="140" placeholder="Details (optional) — keep personal details to a minimum" autocomplete="off"><div class="pp-row"><button type="button" class="pp-sec" data-x="1">Cancel</button><button type="button" class="pp-sec on" id="ppMkS">Save note</button></div>',
    sh=>{ sh.querySelectorAll('.pp-chip').forEach(b=>b.onclick=()=>{ sh.querySelectorAll('.pp-chip').forEach(x=>x.classList.toggle('on',x===b)); pick=b.dataset.m; });
      sh.querySelector('#ppMkS').onclick=()=>{ const note=sh.querySelector('#ppMkN').value.trim(); if(!pick&&!note){ toast('Pick a type or type a note'); return; }
        rec.p.marks.push({s:Math.round((Date.now()-rec.p.start)/1000),lat:+c.lat.toFixed(6),lon:+c.lon.toFixed(6),k:pick||'Note',note}); save(true); rec.an=null; closeSheet(); drawLiveMarks(); toast('Noted at '+hm(Date.now())); vib(30); }; });
}

/* ================= map ================= */
let map=null, mapEl=null, baseL=null, lay=null, liveLay=null, meMk=null, accC=null, scrubMk=null, follow=true, liveIx=null, liveLines=null;
function ensureMap(host){
  if(!W.L)return null;
  if(!mapEl){ mapEl=D.createElement('div'); mapEl.style.cssText='position:absolute;inset:0'; }
  host.insertBefore(mapEl,host.firstChild);
  if(!map){ map=L.map(mapEl,{zoomControl:false,attributionControl:true,preferCanvas:true}).setView([53.3564,-6.2560],16);
    baseL=L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,subdomains:'abc',className:'pp-tiles',attribution:'© OpenStreetMap'}).addTo(map);
    L.control.zoom({position:'bottomright'}).addTo(map); L.control.scale({imperial:false,position:'bottomleft'}).addTo(map);
    lay=L.layerGroup().addTo(map); liveLay=L.layerGroup().addTo(map);
    map.on('dragstart',()=>{ if(follow){ follow=false; paintMapBtns(); } }); }
  ov.classList.toggle('pp-dark',!!S.dark);
  setTimeout(()=>{ try{map.invalidateSize();}catch(e){} },60);
  return map; }
function mapBtns(extra){ return '<div class="pp-mapbtns">'+(extra||'')+'<button type="button" class="pp-mb" data-a="style" aria-label="Dark or light map">'+IC.moon+'</button></div>'; }
function paintMapBtns(){ const b=ov.querySelector('.pp-mb[data-a="follow"]'); if(b)b.classList.toggle('on',follow); const s=ov.querySelector('.pp-mb[data-a="style"]'); if(s)s.classList.toggle('on',!!S.dark); }
const meIcon=()=>L.divIcon({className:'',html:'<div class="pp-me"><b></b><i></i></div>',iconSize:[20,20],iconAnchor:[10,10]});
function stnMarkers(group,bounds){ if(!STN)return; const b=bounds.pad(.3); for(const s of STN){ if(b.contains([s.lat,s.lon]))L.marker([s.lat,s.lon],{icon:L.divIcon({className:'',html:'<div class="pp-stn-ic"></div>',iconSize:[14,14],iconAnchor:[7,7]}),interactive:true,keyboard:false}).bindTooltip(esc(s.n)+' Garda Station',{direction:'top'}).addTo(group); } }
function drawLiveAll(){ if(!map||!rec)return; liveLay.clearLayers(); liveLines=null; const P=rec.p.pts; let prev=null;
  for(const q of P){ addLive(q,prev,true); prev=q; }
  drawLiveMarks(); if(P.length)map.setView([P[P.length-1][1],P[P.length-1][2]],Math.max(map.getZoom(),17)); }
function addLive(pt,prev,bulk){ if(!map||!liveLay||view!=='rec')return; const ll=[pt[1],pt[2]];
  if(!liveLines||(prev&&pt[0]-prev[0]>GAP)){ if(prev&&liveLines)L.polyline([[prev[1],prev[2]],ll],{color:'#f0b429',weight:3,dashArray:'6 8',opacity:.9}).addTo(liveLay);
    liveLines=[L.polyline([ll],{color:'#04070b',weight:8,opacity:.75}).addTo(liveLay),L.polyline([ll],{color:'#6aa2ef',weight:4.5,opacity:.95}).addTo(liveLay)]; }
  else { liveLines[0].addLatLng(ll); liveLines[1].addLatLng(ll); }
  if(!bulk&&follow){ const b=map.getBounds().pad(-.25); if(!b.contains(ll))map.panTo(ll,{animate:true}); } }
function drawLiveMarks(){ if(!map||!rec||view!=='rec')return; const an=recAnalysis();
  if(rec.mk)rec.mk.clearLayers(); else rec.mk=L.layerGroup().addTo(liveLay);
  an.stops.forEach((s,i)=>L.marker([s.lat,s.lon],{icon:L.divIcon({className:'',html:'<div class="pp-stop-ic">'+(i+1)+'</div>',iconSize:[26,26],iconAnchor:[13,13]})}).bindPopup('<b>Stop '+(i+1)+'</b><br>'+hm(rec.p.start+s.s0*1000)+'–'+hm(rec.p.start+s.s1*1000)+' · '+dur(s.dur)).addTo(rec.mk));
  (rec.p.marks||[]).forEach((m,i)=>L.marker([m.lat,m.lon],{icon:L.divIcon({className:'',html:'<div class="pp-mark-ic"><span>'+(i+1)+'</span></div>',iconSize:[26,26],iconAnchor:[13,13]})}).bindPopup('<b>'+esc(m.k)+'</b><br>'+hm(rec.p.start+m.s*1000)+(m.note?'<br>'+esc(m.note):'')).addTo(rec.mk));
  const P=rec.p.pts; if(P.length)L.marker([P[0][1],P[0][2]],{icon:L.divIcon({className:'',html:'<div class="pp-se s">S</div>',iconSize:[24,24],iconAnchor:[12,12]})}).addTo(rec.mk); }
function updateMe(){ if(!map||!rec||!rec.cur||view!=='rec')return; const ll=[rec.cur.lat,rec.cur.lon];
  if(!meMk)meMk=L.marker(ll,{icon:meIcon(),interactive:false,keyboard:false,zIndexOffset:1000}); if(!map.hasLayer(meMk))meMk.addTo(map); meMk.setLatLng(ll);
  if(!accC)accC=L.circle(ll,{radius:rec.cur.acc,color:'#6aa2ef',weight:1,opacity:.5,fillOpacity:.08,interactive:false}); if(!map.hasLayer(accC))accC.addTo(map); accC.setLatLng(ll); accC.setRadius(Math.min(rec.cur.acc,200));
  if(follow&&!rec.p.pts.length)map.setView(ll,17); }
function hideMe(){ if(map){ if(meMk&&map.hasLayer(meMk))map.removeLayer(meMk); if(accC&&map.hasLayer(accC))map.removeLayer(accC); } }

/* ================= UI shell ================= */
let ov=null, main=null, sh=null, view='list', det=null, strips=[];
function build(){
  if(ov&&ov.isConnected)return;
  ov=D.createElement('div'); ov.id='pp'; ov.hidden=true; ov.setAttribute('role','dialog'); ov.setAttribute('aria-label','Proactive patrol');
  ov.innerHTML='<div class="pp-top"><button type="button" class="pp-back">‹ Back</button><div class="pp-tt"><b class="pp-title">Proactive patrol</b><span class="hudclock" data-f="line"></span></div>'
   +'<button type="button" class="pp-ic" data-a="menu" aria-label="Settings and help">'+IC.gear+'</button></div>'
   +'<div class="pp-main"></div><div class="pp-pocket" hidden><b id="ppPT">0:00:00</b><span id="ppPS">● Recording</span><small>Double-tap to wake</small></div>'
   +'<div class="pp-shade" hidden></div><div class="pp-sheet" hidden></div><div class="pp-toast" role="status" aria-live="polite"></div>';
  D.body.appendChild(ov); main=ov.querySelector('.pp-main'); sh=ov.querySelector('.pp-sheet');
  ov.querySelector('.pp-back').onclick=()=>back();
  ov.querySelector('.pp-ic[data-a="menu"]').onclick=()=>settingsSheet();
  ov.querySelector('.pp-shade').onclick=()=>closeSheet();
  const pk=ov.querySelector('.pp-pocket'); let lastTap=0;
  pk.addEventListener('pointerdown',e=>{ e.preventDefault(); const t=Date.now(); if(t-lastTap<450){ pocket(false); lastTap=0; } else lastTap=t; });
  main.addEventListener('click',onClick);
}
function toast(m){ if(!ov){ if(W.grToast)W.grToast(m); return; } const t=ov.querySelector('.pp-toast'); t.textContent=m; t.classList.add('on'); clearTimeout(t._t); t._t=setTimeout(()=>t.classList.remove('on'),3400); }
function sheet(html,wire){ sh.innerHTML='<div class="pp-grip"></div>'+html; sh.hidden=false; ov.querySelector('.pp-shade').hidden=false; sh.querySelectorAll('[data-x]').forEach(b=>b.onclick=()=>closeSheet()); wire&&wire(sh); }
function closeSheet(){ if(!sh)return; sh.hidden=true; sh.innerHTML=''; ov.querySelector('.pp-shade').hidden=true; }
function pocket(on){ if(!ov)return; const pk=ov.querySelector('.pp-pocket');
  if(on){ if(!rec)return; pk.hidden=false; updatePocket(); try{ if(D.documentElement.requestFullscreen&&!D.fullscreenElement)D.documentElement.requestFullscreen().catch(()=>{}); }catch(e){} }
  else if(!pk.hidden){ pk.hidden=true; try{ if(D.fullscreenElement&&D.exitFullscreen)D.exitFullscreen().catch(()=>{}); }catch(e){} } }
function updatePocket(){ const pk=ov&&ov.querySelector('.pp-pocket'); if(!pk||pk.hidden||!rec)return; const an=recAnalysis();
  pk.querySelector('#ppPT').textContent=clock(elapsed());
  pk.querySelector('#ppPS').textContent=(rec.paused?'❚❚ Paused':'● Recording')+' · '+km(an.dist)+(batt?' · battery '+Math.round(batt.level*100)+'%':''); }
function openPatrol(id){ build(); const bt=D.getElementById('boot'); if(bt&&bt.parentNode)bt.parentNode.removeChild(bt);
  ov.hidden=false; closeSheet(); loadRefs();
  if(id)openDetail(id); else { view=rec&&!rec.done?'rec':'list'; render(); }
  if(W.grHudTick)W.grHudTick(); return true; }
function closePatrol(){ if(!ov)return; pocket(false); closeSheet(); ov.hidden=true; hideMe(); main.innerHTML=''; det=null; view='list'; paintStrips(); }
function back(){ if(!ov||ov.hidden)return false;
  if(!ov.querySelector('.pp-pocket').hidden){ pocket(false); return true; }
  if(!sh.hidden){ closeSheet(); return true; }
  if(view==='detail'){ view='list'; det=null; render(); return true; }
  if(rec&&!rec.done&&view==='rec')toast('Still recording — the red bar on the home screen brings you back');
  closePatrol(); return true; }
function render(){ if(!ov||ov.hidden)return; ov.querySelector('.pp-ic[data-a="menu"]').hidden=view==='rec'; ov.classList.toggle('pp-recv',view==='rec'); main.style.overflow='';
  if(view==='rec')renderRec(); else if(view==='detail')renderDetail(); else renderList(); if(W.grHudTick)W.grHudTick(); }

/* ---------- list ---------- */
async function renderList(){
  const geo='geolocation' in N; let items=[]; try{ items=(await getAll('patrols')).filter(p=>!rec||p.id!==rec.p.id).sort((a,b)=>b.start-a.start); }catch(e){}
  if(view!=='list'||ov.hidden)return;
  const pend=items.filter(p=>!p.end);
  let h='<div class="pp-wrap">';
  for(const p of pend){ const L=p.pts.length?p.pts[p.pts.length-1]:null;
    h+='<div class="pp-resume"><b>Patrol from '+dshort(p.start)+' '+hm(p.start)+' wasn’t finished</b><span>Last position '+(L?hm(p.start+L[0]*1000):'—')+'. Finish it to see the route and log, or carry on recording.</span>'
      +'<div class="pp-row"><button type="button" class="pp-sec" data-a="resume" data-id="'+p.id+'">Carry on recording</button><button type="button" class="pp-sec on" data-a="close" data-id="'+p.id+'">Finish it</button></div></div>'; }
  h+='<div class="pp-hero"><h2>Proactive patrol</h2><p>Records exactly where you walked and when — so later in the shift you can write up the patrol with streets, stops and times.</p>'
   +'<ul class="pp-feats"><li>Exact route on the map</li><li>Where you stopped &amp; how long</li><li>Street names, offline once downloaded</li><li>“Where was I at 15:20?”</li><li>Quick notes at a spot</li><li>Copy the patrol log</li></ul>'
   +(rec&&!rec.done?'<button type="button" class="pp-go" data-a="torec"><i></i>Back to recording</button>':geo?'<button type="button" class="pp-go" data-a="start"><i></i>Start patrol</button>':'<div class="pp-err"><b>No GPS access.</b> This browser can’t read your location.</div>')
   +(helperOn()?'<div class="pp-warn ok"><b>Assisting GPS is connected.</b> Start the patrol here and lock the phone as normal — the helper records in the background and sends the whole route back when you tap Finish.</div></div>'
     :'<div class="pp-warn"><b>Keep Assisting open while you patrol.</b> Phones stop web apps using GPS when the screen goes off or you switch apps — the screen stays on while recording, and <b>pocket mode</b> blacks it out. Any break shows in the log as “No GPS”.</div></div>');
  if(isAndroid&&!helperOn())h+='<div class="pp-lock"><b>Want to lock the phone?</b><span>Install <b>Assisting GPS</b>, a small companion app: it records while the phone is locked and sends the route straight back into Assisting when you finish — same streets, stops and patrol log.</span><div class="pp-row"><button type="button" class="pp-sec on" data-a="helper">Set up Assisting GPS</button><button type="button" class="pp-sec" data-a="howlock">Other ways</button></div></div>';
  else if(!isAndroid)h+='<div class="pp-lock"><b>Want to lock the phone?</b><span>Record with a GPS logger app while the phone is locked, then share the track to Assisting — same route, stops, streets and patrol log.</span><div class="pp-row"><button type="button" class="pp-sec" data-a="howlock">How to set it up</button><button type="button" class="pp-sec on" data-a="import">Import a track</button></div></div>';
  h+='<h3 class="pp-hd">Saved patrols <small>'+items.filter(p=>p.end).length+'</small></h3>';
  const done=items.filter(p=>p.end);
  if(!done.length)h+='<div class="pp-empty">No patrols yet. Tap <b>Start patrol</b> as you head out, or import a track.</div>';
  else { h+='<div class="pp-list">'+done.map(p=>{ const P=p.pts, t1=P.length?p.start+P[P.length-1][0]*1000:p.end, a=analyseMemo(p);
      return '<button type="button" class="pp-item" data-a="open" data-id="'+p.id+'"><div class="d">'+new Date(p.start).getDate()+'<small>'+MON[new Date(p.start).getMonth()]+'</small></div>'
        +'<div><b>'+hm(p.start+(P.length?P[0][0]*1000:0))+'–'+hm(t1)+' · '+DAYS[new Date(p.start).getDay()]+'</b><span>'+dur(a.total)+' · '+a.stops.length+' stop'+(a.stops.length===1?'':'s')+((p.marks||[]).length?' · '+p.marks.length+' note'+(p.marks.length===1?'':'s'):'')+'</span></div><em>'+km(a.dist)+'</em></button>'; }).join('')+'</div>'; }
  h+='<p class="pp-foot">Saved only on this phone — nothing is uploaded. Street names come from OpenStreetMap: the phone downloads the street list for the area when it has signal and keeps it, so it works offline after that. Your route is never sent. If a patrol record becomes relevant to a case, keep it — it may be disclosable.</p></div>';
  main.innerHTML=h;
}

/* ---------- recording ---------- */
function renderRec(){
  if(!rec){ view='list'; renderList(); return; }
  main.innerHTML='<div class="pp-rec'+(rec.paused?' paused':'')+'" style="height:100%"><div class="pp-map" id="ppHost">'+mapBtns('<button type="button" class="pp-mb" data-a="follow" aria-label="Follow me">'+IC.follow+'</button>')+'</div>'
   +'<div class="pp-panel"><div class="pp-banner" id="ppBan" hidden></div>'
   +'<div class="pp-stats"><div class="pp-st t"><small><i class="pp-recdot"></i><span id="ppRL">'+(rec.paused?'Paused':'Rec')+'</span></small><b id="ppT">0:00:00</b></div><div class="pp-st"><small>Distance</small><b id="ppD">0 m</b></div><div class="pp-st"><small>Stops</small><b id="ppS">0</b></div></div>'
   +'<div class="pp-now"><em>ON</em><b id="ppNow">Waiting for GPS…</b><span class="acc" id="ppAcc">—</span></div>'
   +(rec.p.hp&&isAndroid?'<div class="pp-hp">'+IC.sat+'<span>Assisting GPS is recording too — you can lock the phone</span><button type="button" data-a="sync">Fill gaps</button></div>'
     :helperOn()?'<div class="pp-hp off">'+IC.sat+'<span>Assisting GPS isn’t recording this patrol — keep Assisting open, or start it</span><button type="button" data-a="hpstart">Start it</button></div>':'')
   +'<div class="pp-acts"><button type="button" class="pp-sec" data-a="mark">'+IC.mark+'Note</button><button type="button" class="pp-sec" data-a="pocket">'+IC.pocket+'Pocket</button>'
   +(rec.paused?'<button type="button" class="pp-sec" data-a="resumeRec">'+IC.play+'Resume</button>':'<button type="button" class="pp-sec" data-a="pause">'+IC.pause+'Pause</button>')
   +'<button type="button" class="fin" data-a="finish">'+IC.stop+'Finish</button></div></div></div>';
  // the main area scrolls for other views; the recording screen fills it
  main.style.overflow='hidden';
  if(!ensureMap(main.querySelector('#ppHost')))return;
  paintMapBtns(); lay.clearLayers(); rec.mk=null; drawLiveAll(); rec.anDrawn=rec.anAt; updateMe(); updateLive();
  if(STN)stnMarkers(liveLay,map.getBounds());
  if(rec.p.pts.length&&!liveIx){ const q=rec.p.pts[rec.p.pts.length-1]; tiles(tilesAround(q[1],q[2],1),S.online&&N.onLine!==false).then(r=>{ liveIx=buildIndex(r)||liveIx; updateLive(); }).catch(()=>{}); }
}
function updateLive(){
  updatePocket();
  if(!ov||ov.hidden||view!=='rec'||!rec)return;
  const $=id=>ov.querySelector('#'+id); if(!$('ppT'))return;
  const an=recAnalysis(); if(rec.anDrawn!==rec.anAt){ rec.anDrawn=rec.anAt; drawLiveMarks(); } $('ppT').textContent=clock(elapsed()); $('ppD').textContent=km(an.dist); $('ppS').textContent=an.stops.length;
  const c=rec.cur, now=$('ppNow'), ac=$('ppAcc'), ban=$('ppBan');
  if(c){ const stale=Date.now()-c.t>60e3; now.textContent=stale?'No GPS fix for '+dur((Date.now()-c.t)/1000):placeLabel(rec.p,liveIx,c.lat,c.lon);
    ac.textContent='±'+c.acc+' m'; ac.className='acc '+(c.acc<=20?'g':c.acc<=MAXACC?'m':'b'); }
  let msg=null, bad=false;
  if(rec.err==='denied'){ msg='Location is blocked for Assisting. Allow it in the phone’s Settings → Apps → Chrome (or Assisting) → Permissions → Location, then tap Resume.'; bad=true; }
  else if(rec.paused)msg='Paused — no GPS is being recorded. Tap Resume to carry on.';
  else if(!c&&Date.now()-rec.p.start>20e3)msg='Still waiting for a GPS fix — step outside or away from tall buildings.';
  else if(c&&c.acc>MAXACC)msg='Weak GPS (±'+c.acc+' m) — those positions are left out until it improves.';
  ban.hidden=!msg; if(msg){ ban.textContent=msg; ban.className='pp-banner'+(bad?' bad':''); }
  updateMe();
}

/* ---------- patrol detail ---------- */
async function openDetail(id,fresh){
  let p=null; try{ p=await get('patrols',id); }catch(e){}
  if(!p){ toast('That patrol isn’t on this phone any more'); view='list'; render(); return; }
  await loadRefs();
  det={p,ix:null,a:analyse(p),T:null,fresh:!!fresh,naming:false,sel:-1};
  view='detail'; render();
  // street names: cached tiles first (offline), then download what's missing if allowed
  try{ const T=tilesForTrack(p.pts); const r=await tiles(T,false); if(det&&det.p.id===id){ det.ix=buildIndex(r); det.cached=r.length; det.need=T.length; if(det.ix)renderDetail(); } }catch(e){}
  if(det&&det.p.id===id&&S.online&&N.onLine!==false&&(det.cached||0)<(det.need||0))nameStreets();
}
async function nameStreets(){ if(!det||det.naming)return; const p=det.p; det.naming=true; paintNames();
  try{ const T=tilesForTrack(p.pts); const r=await tiles(T,true); if(!det||det.p.id!==p.id)return; det.ix=buildIndex(r); det.cached=r.length; det.need=T.length;
    if(!det.ix&&N.onLine!==false)await reverseStops(p);
  }catch(e){}
  if(det&&det.p.id===p.id){ det.naming=false; renderDetail(); } }
// fallback when the street list can't be downloaded: look up stop/start/end positions one by one (Nominatim, ≤1 per second)
async function reverseStops(p){ const a=analyse(p), P=p.pts; const pts=a.stops.map(s=>[s.lat,s.lon]); if(P.length){ pts.unshift([P[0][1],P[0][2]]); pts.push([P[P.length-1][1],P[P.length-1][2]]); }
  (p.marks||[]).forEach(m=>pts.push([m.lat,m.lon])); p.rev=p.rev||{}; let n=0;
  for(const [la,lo] of pts.slice(0,30)){ const k=la.toFixed(4)+','+lo.toFixed(4); if(p.rev[k])continue;
    try{ const r=await fetch('https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=17&addressdetails=1&lat='+la.toFixed(5)+'&lon='+lo.toFixed(5),{headers:{'Accept':'application/json','Accept-Language':'en'}});
      const j=await r.json(), ad=j.address||{}; const road=ad.road||ad.pedestrian||ad.footway||ad.square||ad.neighbourhood; if(road)p.rev[k]=(ad.house_number?ad.house_number+' ':'')+road+(ad.suburb?', '+ad.suburb:''); n++; }catch(e){ break; }
    await new Promise(r=>setTimeout(r,1100)); }
  if(n)try{ await put('patrols',p); }catch(e){} }
function paintNames(){ const el=ov&&ov.querySelector('#ppNames'); if(!el||!det)return; el.innerHTML=namesHtml(); }
function namesHtml(){ const d=det; if(!d)return '';
  if(d.naming)return 'Getting street names from OpenStreetMap…';
  if(d.ix)return 'Street names from OpenStreetMap'+(d.cached<d.need?' — part of this route is outside the downloaded area'+(S.online&&N.onLine!==false?'. <button type="button" class="pp-link" data-a="names">Try again</button>':'.'):' · kept on this phone for next time.');
  if(!S.online)return 'Street names are switched off in settings — nearest landmarks shown instead.';
  if(N.onLine===false)return 'No signal — nearest landmarks shown. Street names are added when you open this with signal.';
  return 'Street names couldn’t be downloaded — nearest landmarks shown. <button type="button" class="pp-link" data-a="names">Try again</button>'; }
function renderDetail(){
  const d=det; if(!d){ view='list'; renderList(); return; }
  const p=d.p, P=p.pts, a=d.a=analyse(p); d.T=timeline(p,a,d.ix);
  const t0=p.start+(P.length?P[0][0]*1000:0), t1=p.start+(P.length?P[P.length-1][0]*1000:0), mk=(p.marks||[]).length;
  const sc=main.scrollTop;
  let h='<div class="pp-det"><div class="pp-map" id="ppHost">'+mapBtns('<button type="button" class="pp-mb" data-a="fit" aria-label="Whole route">'+IC.fit+'</button>')+'</div>'
   +'<div class="pp-scrub"><div class="lbl"><b id="ppScT">'+hm(t0)+'</b><span id="ppScL">Start</span><input id="ppScIn" inputmode="numeric" maxlength="5" placeholder="hh:mm" aria-label="Go to a time"></div>'
   +'<input type="range" id="ppScR" min="'+(P.length?P[0][0]:0)+'" max="'+(P.length?P[P.length-1][0]:0)+'" step="1" value="'+(P.length?P[0][0]:0)+'" aria-label="Where was I at this time"></div>'
   +'<div class="pp-wrap"><h2 class="pp-dh">'+dstr(t0)+'</h2><p class="pp-ds">'+hm(t0)+' – '+hm(t1)+(sameDay(t0,t1)?'':' ('+dshort(t1)+')')+' · '+(a.mode==='mobile'?'mobile patrol':'on foot')+(p.src&&p.src.kind==='import'?' · imported from '+esc(p.src.name||'a GPS app'):p.src&&p.src.kind==='merged'?' · merged with '+esc(p.src.name||'an imported track'):'')+'</p>'
   +'<div class="pp-sum"><div><b>'+durS(a.total)+'</b><small>Time</small></div><div><b>'+km(a.dist)+'</b><small>Distance</small></div><div><b>'+a.stops.length+'</b><small>Stops</small></div><div><b>'+mk+'</b><small>Notes</small></div></div>'
   +'<div class="pp-row"><button type="button" class="pp-sec on" data-a="copy">Copy patrol log</button><button type="button" class="pp-sec" data-a="gpx">Save GPX file</button></div>'
   +'<div class="pp-names" id="ppNames">'+namesHtml()+'</div>'
   +'<h3 class="pp-hd">Timeline <small>tap to see it on the map</small></h3><ul class="pp-tl">'+tlHtml(p,d.T)+'</ul>';
  const mt=mostTime(d.T);
  if(mt.length){ const mx=mt[0][1]; h+='<h3 class="pp-hd">Most time spent</h3><div class="pp-most">'+mt.map(e=>'<div><span>'+esc(e[0])+'</span><em>'+durS(e[1])+'</em><i style="width:'+Math.max(6,Math.round(e[1]/mx*100))+'%"></i></div>').join('')+'</div>'; }
  h+='<p class="pp-foot">Positions from this phone’s GPS — usually within 5–20 m, less accurate beside tall buildings. A stop is staying within about 35 m for '+(S.stopMin||2)+' min or more. '
    +(a.gaps.length?'“No GPS” means no position was received — usually the screen was off or Assisting wasn’t open. ':'')+'Map and street data © OpenStreetMap contributors.</p>'
    +'<button type="button" class="pp-link del" data-a="del">Delete this patrol</button></div></div>';
  main.innerHTML=h; main.scrollTop=sc;
  ensureMap(main.querySelector('#ppHost')); paintMapBtns(); liveLay.clearLayers(); hideMe(); drawDetail();
  const R=main.querySelector('#ppScR'); R.oninput=()=>scrub(+R.value,false);
  const I=main.querySelector('#ppScIn'); I.onkeydown=e=>{ if(e.key==='Enter'){ e.preventDefault(); gotoTime(I.value); } }; I.onchange=()=>gotoTime(I.value);
  I.oninput=()=>{ const v=I.value.replace(/[^\d]/g,'').slice(0,4); I.value=v.length>2?v.slice(0,2)+':'+v.slice(2):v; };
  if(d.fresh){ d.fresh=false; toast('Patrol saved — '+km(a.dist)+', '+a.stops.length+' stop'+(a.stops.length===1?'':'s')); }
}
function tlHtml(p,T){ let day=T.length?new Date(p.start+T[0].s*1000).toDateString():'', h='';
  T.forEach((x,k)=>{ const tt=p.start+x.s*1000; if(new Date(tt).toDateString()!==day){ day=new Date(tt).toDateString(); h+='<li class="day"><b>'+dshort(tt)+'</b></li>'; }
    const t='<span class="t">'+hm(tt)+'</span>';
    if(x.k==='start')h+='<li class="se" data-k="'+k+'">'+t+'<b>Start</b><span>'+esc(x.label)+'</span></li>';
    else if(x.k==='end')h+='<li class="se e" data-k="'+k+'">'+t+'<b>'+(x.open?'Last position (not finished)':'End')+'</b><span>'+esc(x.label)+'</span></li>';
    else if(x.k==='street')h+='<li class="street" data-k="'+k+'">'+t+'<b>'+esc(x.label)+'</b><span>'+(x.s1-x.s0>=60?'until '+hm(p.start+x.s1*1000)+' · '+durS(x.s1-x.s0):'passed through')+'</span></li>';
    else if(x.k==='stop')h+='<li class="stop" data-k="'+k+'">'+t+'<b>Stop '+(x.si+1)+' · '+dur(x.dur)+'</b><span>'+esc(x.label)+' · until '+hm(p.start+x.s1*1000)+(x.gap?' · no GPS for '+durS(x.gap)+' of it':'')+'</span></li>';
    else if(x.k==='mark')h+='<li class="mark" data-k="'+k+'">'+t+'<b>'+esc(x.label)+'</b><span>'+esc(x.place)+'</span></li>';
    else if(x.k==='gap')h+='<li class="gap" data-k="'+k+'">'+t+'<b>No GPS for '+durS(x.s1-x.s0)+' (until '+hm(p.start+x.s1*1000)+')</b><span>'+(x.still?'Same place before and after':'Moved '+km(x.d)+' in that time — route not known')+'</span></li>';
    else if(x.k==='pause')h+='<li class="pause" data-k="'+k+'">'+t+'<b>Recording paused '+durS(x.s1-x.s0)+'</b><span>until '+hm(p.start+x.s1*1000)+'</span></li>'; });
  return h; }
function drawDetail(){ const d=det; if(!d||!map)return; const p=d.p, P=p.pts, a=d.a; lay.clearLayers(); if(!P.length)return;
  const all=[]; for(const sg of a.segs){ const ll=sg.map(i=>[P[i][1],P[i][2]]); all.push(...ll);
    L.polyline(ll,{color:'#04070b',weight:8,opacity:.75}).addTo(lay); L.polyline(ll,{color:'#6aa2ef',weight:4.5,opacity:.95}).addTo(lay); }
  for(const g of a.gaps)L.polyline([[P[g.i0][1],P[g.i0][2]],[P[g.i1][1],P[g.i1][2]]],{color:'#f0b429',weight:3,dashArray:'6 8',opacity:.9}).bindTooltip('No GPS '+durS(g.s1-g.s0)).addTo(lay);
  // direction arrows about every 180 m of track
  for(const sg of a.segs){ let acc=0; for(let k=1;k<sg.length;k++){ const A=P[sg[k-1]], B=P[sg[k]], dd=dist(A[1],A[2],B[1],B[2]); acc+=dd;
      if(acc>=180&&dd>3){ acc=0; const br=bearing(A[1],A[2],B[1],B[2]); L.marker([(A[1]+B[1])/2,(A[2]+B[2])/2],{interactive:false,keyboard:false,icon:L.divIcon({className:'',html:'<div class="pp-arrow" style="transform:rotate('+br.toFixed(0)+'deg)"><i></i></div>',iconSize:[14,14],iconAnchor:[7,7]})}).addTo(lay); } } }
  const bnd=L.latLngBounds(all.length?all:[[P[0][1],P[0][2]]]); stnMarkers(lay,bnd);
  a.stops.forEach((s,i)=>{ const x=d.T.find(t=>t.k==='stop'&&t.si===i);
    L.marker([s.lat,s.lon],{icon:L.divIcon({className:'',html:'<div class="pp-stop-ic">'+(i+1)+'</div>',iconSize:[26,26],iconAnchor:[13,13]}),zIndexOffset:500})
     .bindPopup('<b>Stop '+(i+1)+' · '+dur(s.dur)+'</b><br>'+hm(p.start+s.s0*1000)+'–'+hm(p.start+s.s1*1000)+'<br>'+esc(x?x.label:'')).addTo(lay); });
  (p.marks||[]).forEach((m,i)=>L.marker([m.lat,m.lon],{icon:L.divIcon({className:'',html:'<div class="pp-mark-ic"><span>'+(i+1)+'</span></div>',iconSize:[26,26],iconAnchor:[13,13]}),zIndexOffset:600})
     .bindPopup('<b>'+esc(m.k)+'</b><br>'+hm(p.start+m.s*1000)+(m.note?'<br>'+esc(m.note):'')).addTo(lay));
  L.marker([P[0][1],P[0][2]],{icon:L.divIcon({className:'',html:'<div class="pp-se s">S</div>',iconSize:[24,24],iconAnchor:[12,12]}),zIndexOffset:700}).bindTooltip('Start '+hm(p.start+P[0][0]*1000)).addTo(lay);
  const E=P[P.length-1]; L.marker([E[1],E[2]],{icon:L.divIcon({className:'',html:'<div class="pp-se e">E</div>',iconSize:[24,24],iconAnchor:[12,12]}),zIndexOffset:700}).bindTooltip((p.end?'End ':'Last ')+hm(p.start+E[0]*1000)).addTo(lay);
  scrubMk=L.marker([P[0][1],P[0][2]],{icon:L.divIcon({className:'',html:'<div class="pp-scrub-ic'+(d.scrubbed?'':' off')+'"></div>',iconSize:[18,18],iconAnchor:[9,9]}),interactive:false,keyboard:false,zIndexOffset:900}).addTo(lay);
  if(!d.drawn){ map.fitBounds(bnd.pad(.12),{maxZoom:18}); d.drawn=true; } d.bnd=bnd; scrub(P[0][0],true); }
function scrub(s,quiet){ const d=det; if(!d||!map)return; const p=d.p, q=posAt(p,s); if(!q)return;
  if(scrubMk){ scrubMk.setLatLng([q.lat,q.lon]); if(!quiet||d.scrubbed){ d.scrubbed=true; const el=scrubMk.getElement&&scrubMk.getElement(); const ic=el&&el.querySelector('.pp-scrub-ic'); if(ic)ic.classList.remove('off'); } }
  const T=main.querySelector('#ppScT'), Lb=main.querySelector('#ppScL'); if(!T)return;
  T.textContent=hms(p.start+s*1000).slice(0,5);
  let label;
  const st=d.a.stops.find(x=>s>=x.s0&&s<=x.s1), g=d.a.gaps.find(x=>s>x.s0&&s<x.s1);
  if(st){ const x=d.T.find(t=>t.k==='stop'&&t.s0===st.s0); label='Stop '+(x?x.si+1:'')+' · '+(x?x.label:''); }
  else if(g)label=g.pause?'Recording paused':'No GPS — last known position shown';
  else { const r=d.ix?nearest(d.ix,q.lat,q.lon,45):null; label=r?r.n:landmark(q.lat,q.lon); }
  Lb.textContent=label;
  if(!quiet&&!map.getBounds().pad(-.15).contains([q.lat,q.lon]))map.panTo([q.lat,q.lon]); }
function gotoTime(v){ const d=det; if(!d)return; const m=/^(\d{1,2}):?(\d{2})$/.exec(String(v||'').trim()); if(!m||+m[1]>23||+m[2]>59){ toast('Type a time like 15:20'); return; }
  const p=d.p, P=p.pts; if(!P.length)return; const a0=p.start+P[0][0]*1000, a1=p.start+P[P.length-1][0]*1000;
  const c=new Date(a0); c.setHours(+m[1],+m[2],0,0); let t=c.getTime(); if(t<a0-60e3)t+=DAY;
  if(t<a0-60e3||t>a1+60e3){ toast('That time isn’t in this patrol ('+hm(a0)+'–'+hm(a1)+')'); return; }
  const s=Math.round((t-p.start)/1000), R=main.querySelector('#ppScR'); R.value=s; scrub(s,false); map.setView(scrubMk.getLatLng(),Math.max(map.getZoom(),17)); }
function focusItem(k){ const d=det; if(!d||!map)return; const x=d.T[k]; if(!x)return; const p=d.p, P=p.pts;
  main.querySelectorAll('.pp-tl li.sel').forEach(li=>li.classList.remove('sel')); const li=main.querySelector('.pp-tl li[data-k="'+k+'"]'); if(li)li.classList.add('sel');
  const R=main.querySelector('#ppScR'); if(R){ R.value=x.s; d.scrubbed=true; scrub(x.s,true); }
  if(x.k==='street'||x.k==='gap'||x.k==='pause'){ const ll=[]; for(let i=x.i0;i<=x.i1;i++)ll.push([P[i][1],P[i][2]]); map.fitBounds(L.latLngBounds(ll).pad(.25),{maxZoom:18}); }
  else if(x.k==='stop'){ const st=d.a.stops[x.si]; map.setView([st.lat,st.lon],18); }
  else if(x.k==='mark'){ const m=p.marks[x.mi]; map.setView([m.lat,m.lon],18); }
  else { const q=P[x.i]; map.setView([q[1],q[2]],17); }
  main.scrollTo({top:0,behavior:'smooth'}); }

/* ---------- actions ---------- */
function onClick(e){ const b=e.target.closest('[data-a],[data-k]'); if(!b||!main.contains(b))return;
  const a=b.dataset.a;
  if(!a&&b.dataset.k!=null){ focusItem(+b.dataset.k); return; }
  if(a==='start'){ if(rec&&!rec.done){ view='rec'; render(); return; }
    const id='pp_'+Date.now(); if(helperOn())callHelper('start',{sid:id}); startPatrol(id); }
  else if(a==='sync'){ if(rec&&!rec.done)callHelper('sync',{sid:rec.p.id}); }
  else if(a==='hpstart'){ if(rec&&!rec.done){ callHelper('start',{sid:rec.p.id}); rec.p.hp=1; hpRemember(rec.p.id); save(true); render(); } }
  else if(a==='helper')helperSheet();
  else if(a==='torec'){ view='rec'; render(); }
  else if(a==='open')openDetail(b.dataset.id);
  else if(a==='resume'){ if(helperOn()&&!(rec&&!rec.done))callHelper('start',{sid:b.dataset.id}); resumeSaved(b.dataset.id); }
  else if(a==='close'){ if(helperOn()&&hpKnows(b.dataset.id))callHelper('stop',{sid:b.dataset.id}); closeSaved(b.dataset.id); }
  else if(a==='mark')markSheet();
  else if(a==='pocket')pocket(true);
  else if(a==='pause')pause();
  else if(a==='resumeRec')resume();
  else if(a==='finish')finishSheet();
  else if(a==='follow'){ follow=!follow; paintMapBtns(); if(follow&&rec&&rec.cur)map.setView([rec.cur.lat,rec.cur.lon],Math.max(map.getZoom(),17)); }
  else if(a==='style'){ S.dark=!S.dark; saveS(); ov.classList.toggle('pp-dark',S.dark); paintMapBtns(); }
  else if(a==='fit'){ if(det&&det.bnd)map.fitBounds(det.bnd.pad(.12),{maxZoom:18}); }
  else if(a==='copy')copyLog();
  else if(a==='gpx')saveGpx();
  else if(a==='names')nameStreets();
  else if(a==='del')delSheet();
  else if(a==='import')pickTrack();
  else if(a==='howlock')lockSheet(); }
function finishSheet(){ const an=recAnalysis();
  sheet('<h4>Finish this patrol?</h4><p><b>'+clock(elapsed())+'</b> recorded · '+km(an.dist)+' · '+an.stops.length+' stop'+(an.stops.length===1?'':'s')+'. You’ll get the route, timeline and patrol log.'+(rec&&rec.p.hp&&isAndroid?' Assisting GPS stops too and sends its full route back in — it opens for a moment.':'')+'</p>'
   +'<div class="pp-row"><button type="button" class="pp-sec" data-x="1">Keep recording</button><button type="button" class="pp-sec on" id="ppFin">Finish patrol</button></div>',
   s=>{ s.querySelector('#ppFin').onclick=()=>{ closeSheet(); if(rec&&rec.p.hp&&isAndroid)callHelper('stop',{sid:rec.p.id}); finish(); }; }); }
async function resumeSaved(id){ if(rec&&!rec.done){ toast('A patrol is already recording'); return; } let p=null; try{ p=await get('patrols',id); }catch(e){} if(!p)return;
  rec={p,watch:null,last:null,cur:null,weak:0,glitch:0,paused:false,lastSave:0,an:null,anAt:0,err:null}; p.pauses=p.pauses||[]; p.marks=p.marks||[];
  if(helperOn()){ p.hp=1; hpRemember(p.id); }
  const q=p.pauses[p.pauses.length-1]; if(q&&q[1]==null)q[1]=Math.round((Date.now()-p.start)/1000);
  try{ localStorage.setItem(AK,p.id); }catch(e){} beginWatch(); wake(true); startTick(); view='rec'; render(); paintStrips(); }
async function closeSaved(id){ let p=null; try{ p=await get('patrols',id); }catch(e){} if(!p)return;
  const q=(p.pauses||[])[p.pauses.length-1]; if(q&&q[1]==null)q[1]=p.hp?Math.round((Date.now()-p.start)/1000):(p.pts.length?p.pts[p.pts.length-1][0]:q[0]);
  p.end=p.pts.length?p.start+p.pts[p.pts.length-1][0]*1000:Date.now(); try{ await put('patrols',p); }catch(e){}
  try{ if(localStorage.getItem(AK)===id)localStorage.removeItem(AK); }catch(e){}
  if(!p.pts.length){ if(!p.hp){ try{ await del('patrols',id); }catch(e){} } render(); return; }
  openDetail(id); }
function copyLog(){ const d=det; if(!d)return; const txt=logText(d.p,d.a,d.T,d.ix);
  const ok=()=>{ toast('Patrol log copied — paste it into your notes'); vib(30); };
  if(N.clipboard&&N.clipboard.writeText)N.clipboard.writeText(txt).then(ok,()=>fallbackCopy(txt,ok)); else fallbackCopy(txt,ok); }
function fallbackCopy(txt,ok){ const ta=D.createElement('textarea'); ta.value=txt; ta.style.cssText='position:fixed;left:-9999px;top:0'; D.body.appendChild(ta); ta.select();
  try{ D.execCommand('copy'); ok(); }catch(e){ toast('Couldn’t copy on this phone'); } ta.remove(); }
function saveGpx(){ const d=det; if(!d)return; const p=d.p, P=p.pts, a=d.a; const iso=s=>new Date(p.start+s*1000).toISOString();
  const x=s=>esc(s).replace(/&#39;/g,'&apos;');
  let g='<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="Assisting — Proactive patrol" xmlns="http://www.topografix.com/GPX/1/1">\n<metadata><name>'+x('Proactive patrol '+dstr(p.start)+' '+hm(p.start))+'</name><time>'+new Date(p.start).toISOString()+'</time></metadata>\n';
  a.stops.forEach((s,i)=>{ const t=d.T.find(q=>q.k==='stop'&&q.si===i); g+='<wpt lat="'+s.lat.toFixed(6)+'" lon="'+s.lon.toFixed(6)+'"><time>'+iso(s.s0)+'</time><name>'+x('Stop '+(i+1)+' ('+dur(s.dur)+')')+'</name><desc>'+x((t?t.label+' · ':'')+hm(p.start+s.s0*1000)+'–'+hm(p.start+s.s1*1000))+'</desc></wpt>\n'; });
  (p.marks||[]).forEach(m=>{ g+='<wpt lat="'+m.lat.toFixed(6)+'" lon="'+m.lon.toFixed(6)+'"><time>'+iso(m.s)+'</time><name>'+x(m.k)+'</name>'+(m.note?'<desc>'+x(m.note)+'</desc>':'')+'</wpt>\n'; });
  g+='<trk><name>'+x('Patrol '+hm(p.start))+'</name>\n';
  for(const sg of a.segs){ g+='<trkseg>\n'; for(const i of sg){ const q=P[i]; g+='<trkpt lat="'+q[1].toFixed(6)+'" lon="'+q[2].toFixed(6)+'"><time>'+iso(q[0])+'</time></trkpt>\n'; } g+='</trkseg>\n'; }
  g+='</trk>\n</gpx>\n';
  const dd=new Date(p.start), name='patrol-'+dd.getFullYear()+'-'+p2(dd.getMonth()+1)+'-'+p2(dd.getDate())+'-'+p2(dd.getHours())+p2(dd.getMinutes())+'.gpx';
  const u=URL.createObjectURL(new Blob([g],{type:'application/gpx+xml'})); const aa=D.createElement('a'); aa.href=u; aa.download=name; D.body.appendChild(aa); aa.click(); aa.remove(); setTimeout(()=>URL.revokeObjectURL(u),4000);
  toast('Saved '+name+' to your downloads'); }
function delSheet(){ const d=det; if(!d)return;
  sheet('<h4>Delete this patrol?</h4><p>The route, stops and notes for <b>'+dstr(d.p.start)+' '+hm(d.p.start)+'</b> are removed from this phone. This can’t be undone. If it may be relevant to a case, keep it.</p>'
   +'<div class="pp-row"><button type="button" class="pp-sec" data-x="1">Keep it</button><button type="button" class="pp-sec" id="ppDel" style="border-color:#ff6b6b;color:#ffb3b3">Delete</button></div>',
   s=>{ s.querySelector('#ppDel').onclick=async()=>{ try{ await del('patrols',d.p.id); }catch(e){} closeSheet(); det=null; view='list'; render(); toast('Patrol deleted'); }; }); }
function settingsSheet(){
  const seg=[1,2,3,5].map(m=>'<button type="button" data-sm="'+m+'" class="'+((S.stopMin||2)===m?'on':'')+'">'+m+' min</button>').join('');
  sheet('<h4>Proactive patrol</h4>'
   +'<p><b>How to use it:</b> tap Start as you head out and keep Assisting open. Phones stop web apps using GPS when the screen is off or you switch app, so the screen stays on while recording — use <b>Pocket</b> to black it out (double-tap to wake). Finish when you’re back, then copy the patrol log.</p>'
   +'<p style="margin-top:14px"><b>Count a stop after</b></p><div class="pp-seg">'+seg+'</div>'
   +'<button type="button" class="pp-sw'+(S.online?' on':'')+'" data-t="online"><span>Street names from OpenStreetMap<small>Downloads the street list for the area (not your route) and keeps it on the phone</small></span><i></i></button>'
   +'<button type="button" class="pp-sw'+(S.dark?' on':'')+'" data-t="dark"><span>Dark map<small>Easier on the eyes at night</small></span><i></i></button>'
   +(isAndroid?'<button type="button" class="pp-sw'+(helperOn()?' on':'')+'" id="ppHp"><span>Assisting GPS — record with the phone locked<small>'+(hinfo().ok?(helperOn()?'Connected · starts and stops with your patrol':'Connected · switched off'):'Not set up yet — tap to install and connect')+'</small></span><i></i></button>':'')
   +'<div class="pp-row" style="margin-top:14px"><button type="button" class="pp-sec" id="ppImp">Import a track file</button><button type="button" class="pp-sec" id="ppLk">Other ways to lock the phone</button></div>'
   +'<div class="pp-row"><button type="button" class="pp-sec" id="ppDl">Download streets around me</button><button type="button" class="pp-sec" id="ppClr">Clear downloaded streets</button></div>'
   +'<p class="pp-foot" id="ppDlMsg">Street lists are downloaded automatically as you patrol with signal. Downloading your area in advance means names work offline from the start.</p>'
   +'<div class="pp-row"><button type="button" class="pp-sec" data-x="1">Done</button></div>',
   s=>{ s.querySelectorAll('[data-sm]').forEach(b=>b.onclick=()=>{ S.stopMin=+b.dataset.sm; saveS(); s.querySelectorAll('[data-sm]').forEach(x=>x.classList.toggle('on',x===b)); if(view==='detail'&&det)renderDetail(); });
     s.querySelectorAll('[data-t]').forEach(b=>b.onclick=()=>{ const k=b.dataset.t; S[k]=!S[k]; saveS(); b.classList.toggle('on',!!S[k]); if(k==='dark'&&ov)ov.classList.toggle('pp-dark',S.dark); });
     s.querySelector('#ppImp').onclick=()=>{ closeSheet(); pickTrack(); };
     s.querySelector('#ppLk').onclick=()=>{ closeSheet(); lockSheet(); };
     const hb=s.querySelector('#ppHp'); if(hb)hb.onclick=()=>{ if(!hinfo().ok){ closeSheet(); helperSheet(); return; } const on=!helperOn(); hset({use:on}); hb.classList.toggle('on',on);
       hb.querySelector('small').textContent=on?'Connected · starts and stops with your patrol':'Connected · switched off'; if(view==='list')render(); };
     s.querySelector('#ppClr').onclick=async()=>{ try{ await clearStore('streets'); }catch(e){} liveIx=null; s.querySelector('#ppDlMsg').textContent='Downloaded street lists cleared.'; };
     s.querySelector('#ppDl').onclick=()=>{ const m=s.querySelector('#ppDlMsg');
       if(N.onLine===false){ m.textContent='No signal — try again when you have signal.'; return; }
       if(!('geolocation' in N)){ m.textContent='No GPS access in this browser.'; return; }
       m.textContent='Finding you…';
       N.geolocation.getCurrentPosition(async pos=>{ m.textContent='Downloading streets within about 1.5 km…'; const save=S.online; S.online=true;
         try{ const r=await tiles(tilesAround(pos.coords.latitude,pos.coords.longitude,1),true); const ix=buildIndex(r); liveIx=ix||liveIx; m.textContent=ix?('Done — '+ix.names.length+' streets kept on this phone.'):'Couldn’t reach the street server — try again later.'; }
         catch(e){ m.textContent='Couldn’t reach the street server — try again later.'; } S.online=save; },
         ()=>{ m.textContent='Location unavailable — allow location for Assisting and try again.'; },{enableHighAccuracy:true,timeout:15000,maximumAge:60000}); }; }); }

/* ================= phone locked: import a track recorded by a GPS logger app ================= */
// Android stops web apps using GPS once the phone locks; an installed logger app keeps recording.
// Its track (GPX / TXT / KML with times / GeoJSON / CSV) comes in through the share menu or a file pick,
// and gets the same treatment: route, stops, street names, timeline and patrol log.
const LOGGER_URL='https://play.google.com/store/apps/details?id=eu.basicairdata.graziano.gpslogger';
function parseWhen(s){ s=String(s||'').trim(); if(!s)return NaN;
  if(/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/.test(s))s=s.replace(' ','T')+'Z';   // logger TXT/CSV times are UTC
  if(/^\d{10,13}$/.test(s))return +s<1e12?+s*1000:+s;
  return Date.parse(s); }
function xmlDoc(txt){ const d=new DOMParser().parseFromString(txt,'application/xml'); if(d.getElementsByTagName('parsererror').length)throw new Error('That file isn’t readable XML'); return d; }
const kids=(el,tag)=>el.getElementsByTagNameNS('*',tag);
const kid=(el,tag)=>{ const x=kids(el,tag)[0]; return x?x.textContent.trim():''; };
function parseGPX(txt){ const d=xmlDoc(txt), fixes=[], wpts=[];
  for(const p of kids(d,'trkpt')){ const t=parseWhen(kid(p,'time')), lat=+p.getAttribute('lat'), lon=+p.getAttribute('lon'); if(!isFinite(t)||!isFinite(lat)||!isFinite(lon))continue;
    let acc=parseFloat(kid(p,'accuracy')); if(!isFinite(acc)){ const hd=parseFloat(kid(p,'hdop')); acc=isFinite(hd)?Math.min(60,Math.max(4,hd*5)):NaN; }
    fixes.push({t,lat,lon,acc:isFinite(acc)?acc:10}); }
  for(const w of kids(d,'wpt')){ const t=parseWhen(kid(w,'time')), lat=+w.getAttribute('lat'), lon=+w.getAttribute('lon'); if(!isFinite(t)||!isFinite(lat))continue; wpts.push({t,lat,lon,name:kid(w,'name'),desc:kid(w,'desc')}); }
  const md=kids(d,'metadata')[0]; return {fixes,wpts,title:(md?kid(md,'name'):'')||kid(d.documentElement,'name')}; }
function parseKML(txt){ const d=xmlDoc(txt), fixes=[];
  for(const tr of kids(d,'Track')){ const W=[...kids(tr,'when')].map(x=>parseWhen(x.textContent)), C=[...kids(tr,'coord')].map(x=>x.textContent.trim().split(/\s+/).map(Number));
    for(let i=0;i<Math.min(W.length,C.length);i++){ if(isFinite(W[i])&&isFinite(C[i][1]))fixes.push({t:W[i],lat:C[i][1],lon:C[i][0],acc:10}); } }
  for(const pm of kids(d,'Placemark')){ const ts=kids(pm,'TimeStamp')[0], pt=kids(pm,'Point')[0]; if(!ts||!pt)continue; const t=parseWhen(kid(ts,'when')), c=kid(pt,'coordinates').split(',').map(Number); if(isFinite(t)&&isFinite(c[1]))fixes.push({t,lat:c[1],lon:c[0],acc:10}); }
  return {fixes,wpts:[],title:kid(d,'name')}; }
function parseCSV(txt){ const L=txt.split(/\r?\n/).filter(l=>l.trim()); if(L.length<2)return {fixes:[],wpts:[]};
  const sp=l=>l.split(/,|;|\t/).map(x=>x.trim().replace(/^"|"$/g,'')), H=sp(L[0]).map(h=>h.toLowerCase());
  const col=(...re)=>H.findIndex(h=>re.some(r=>r.test(h)));
  const it=col(/date ?time/,/^time/,/timestamp/,/^date/), ila=col(/^lat/), ilo=col(/^lon/,/^lng/), iac=col(/^acc/), ity=col(/^type$/), inm=col(/^name$/), ids=col(/^desc/);
  if(it<0||ila<0||ilo<0)return {fixes:[],wpts:[]};
  const fixes=[], wpts=[];
  for(const l of L.slice(1)){ const c=sp(l), t=parseWhen(c[it]), lat=+c[ila], lon=+c[ilo]; if(!isFinite(t)||!isFinite(lat)||!isFinite(lon))continue;
    if(ity>=0&&/^w/i.test(c[ity]))wpts.push({t,lat,lon,name:inm>=0?c[inm]:'',desc:ids>=0?c[ids]:''});
    else { const a=iac>=0?parseFloat(c[iac]):NaN; fixes.push({t,lat,lon,acc:isFinite(a)?a:10}); } }
  return {fixes,wpts}; }
function parseGeoJSON(txt){ const j=JSON.parse(txt), fixes=[], wpts=[], F=j.type==='FeatureCollection'?j.features:[j];
  for(const f of F||[]){ const g=f&&f.geometry, pr=(f&&f.properties)||{}; if(!g)continue;
    if(g.type==='Point'){ const t=parseWhen(pr.time||pr.timestamp); if(isFinite(t))fixes.push({t,lat:g.coordinates[1],lon:g.coordinates[0],acc:+pr.accuracy||10}); continue; }
    const lines=g.type==='LineString'?[g.coordinates]:g.type==='MultiLineString'?g.coordinates:[]; let times=pr.coordTimes||pr.times||[]; if(lines.length===1&&times.length&&!Array.isArray(times[0]))times=[times];
    lines.forEach((ln,i)=>(ln||[]).forEach((c,k)=>{ const t=parseWhen((times[i]||[])[k]); if(isFinite(t))fixes.push({t,lat:c[1],lon:c[0],acc:10}); })); }
  return {fixes,wpts}; }
function parseTrackFile(name,text){ const n=String(name||'').toLowerCase(), s=String(text||'').trim();
  if(/\.gpx$/.test(n)||/<gpx[\s>]/i.test(s.slice(0,800)))return parseGPX(s);
  if(/\.kml$/.test(n)||/<kml[\s>]/i.test(s.slice(0,800)))return parseKML(s);
  if(/\.(geo)?json$/.test(n)||/^[{[]/.test(s))return parseGeoJSON(s);
  return parseCSV(s); }
// same filtering as live recording: drop weak fixes, glitches and standing-still jitter
function patrolFromFixes(fixes,wpts,meta){
  fixes=fixes.filter(f=>isFinite(f.t)&&Math.abs(f.lat)<=90&&Math.abs(f.lon)<=180).sort((a,b)=>a.t-b.t);
  if(!fixes.length)return null;
  const start=fixes[0].t, pts=[]; let L=null;
  for(const f of fixes){ if(f.acc>MAXACC)continue; const s=Math.round((f.t-start)/1000);
    if(L){ const dt=s-L[0]; if(dt<=0)continue; const d=dist(L[1],L[2],f.lat,f.lon); if(d>60&&d/dt>45)continue; if(d<Math.max(5,f.acc*.6)&&dt<20)continue; }
    const pt=[s,+f.lat.toFixed(6),+f.lon.toFixed(6),Math.round(f.acc)]; pts.push(pt); L=pt; }
  if(!pts.length)return null;
  const endT=start+pts[pts.length-1][0]*1000;
  const marks=(wpts||[]).filter(w=>w.t>=start-10*60e3&&w.t<=endT+10*60e3).map(w=>({s:Math.max(0,Math.round((w.t-start)/1000)),lat:+w.lat.toFixed(6),lon:+w.lon.toFixed(6),k:(w.name||'Note').slice(0,60),note:(w.desc||'').slice(0,140)}));
  return {id:'pp_'+start+'_i',v:1,start,end:endT,pts,marks,pauses:[],rev:{},src:Object.assign({kind:'import'},meta||{})}; }
// one track can arrive as .gpx + .kml + .txt together — keep the best version of each
function pickFiles(files){ const g=new Map(), rank=n=>/\.txt$|\.csv$/i.test(n)?0:/\.gpx$/i.test(n)?1:/json$/i.test(n)?2:/\.kml$/i.test(n)?3:4;
  for(const f of files){ const base=String(f.name||'track').replace(/\.[^.]+$/,''); const cur=g.get(base); if(!cur||rank(f.name)<rank(cur.name))g.set(base,f); }
  return [...g.values()]; }
async function importTracks(files){ // files: [{name,text}]
  if(!files.length){ toast('Nothing to import — share or pick a GPX track file'); return; }
  const made=[], bad=[];
  for(const f of pickFiles(files)){ try{ const r=parseTrackFile(f.name,f.text), p=patrolFromFixes(r.fixes,r.wpts,{name:f.name,title:r.title||''});
      if(p)made.push(p); else bad.push(f.name+' — no timed track points'); }catch(e){ bad.push(f.name+' — '+(e.message||'unreadable')); } }
  if(!made.length){ errSheet(bad); return; }
  let saved=[]; try{ saved=await getAll('patrols'); }catch(e){}
  const done=[];
  for(const p of made){
    if(saved.some(x=>x.id===p.id)){ done.push(p.id); continue; }                 // already imported
    const p0=p.start, p1=p.end;
    const over=saved.filter(x=>x.src&&x.src.kind==='import'?false:true).filter(x=>!(rec&&!rec.done&&x.id===rec.p.id)&&x.pts.length).find(x=>{ const a0=x.start+x.pts[0][0]*1000, a1=x.start+x.pts[x.pts.length-1][0]*1000; return Math.min(a1,p1)-Math.max(a0,p0)>60e3; });
    if(over&&made.length===1){ mergeSheet(over,p); return; }
    try{ await put('patrols',p); done.push(p.id); }catch(e){ bad.push('Couldn’t save on this phone'); } }
  if(bad.length)toast(bad.length+' file'+(bad.length>1?'s':'')+' couldn’t be read');
  if(done.length===1){ openDetail(done[0],true); toast('Track imported'); } else if(done.length){ view='list'; render(); toast(done.length+' tracks imported'); } }
function errSheet(bad){ build(); sheet('<h4>Couldn’t import that</h4><p>'+bad.map(esc).join('<br>')+'</p><p>Share the <b>GPX</b> (or TXT) file from GPS Logger — it has the time of every point. A KML without times can’t show when you were where.</p><div class="pp-row"><button type="button" class="pp-sec" data-x="1">OK</button></div>'); }
function mergePatrols(a,b){
  const abs=p=>p.pts.map(q=>({t:p.start+q[0]*1000,lat:q[1],lon:q[2],acc:q[3]||10}));
  const all=abs(a).concat(abs(b)).sort((x,y)=>x.t-y.t), out=[];
  for(const f of all){ const L=out[out.length-1]; if(L&&f.t-L.t<2000){ if(f.acc<L.acc)out[out.length-1]=f; continue; } out.push(f); }
  const n=patrolFromFixes(out,[],{}); if(!n)return a;
  const start=n.start, re=s0=>pp=>Object.assign({},pp,{s:Math.max(0,Math.round((s0+pp.s*1000-start)/1000))});
  const marks=(a.marks||[]).map(re(a.start)).concat((b.marks||[]).map(re(b.start)).filter(m=>!(a.marks||[]).some(x=>Math.abs(a.start+x.s*1000-(start+m.s*1000))<60e3&&x.k===m.k)));
  const pauses=(a.pauses||[]).map(q=>[Math.round((a.start+q[0]*1000-start)/1000),q[1]==null?null:Math.round((a.start+q[1]*1000-start)/1000)]);
  return Object.assign({},a,{start,pts:n.pts,marks:marks.sort((x,y)=>x.s-y.s),pauses,end:Math.max(a.end||0,b.end||0,n.end),src:{kind:'merged',name:(b.src&&b.src.name)||''}}); }
function mergeSheet(a,b){ build();
  const a0=a.start+a.pts[0][0]*1000, a1=a.start+a.pts[a.pts.length-1][0]*1000;
  sheet('<h4>Merge with your patrol?</h4><p>This track overlaps the patrol you recorded in Assisting, <b>'+dshort(a0)+' '+hm(a0)+'–'+hm(a1)+'</b>. Merging fills its “No GPS” gaps and keeps your notes.</p>'
   +'<div class="pp-row"><button type="button" class="pp-sec" id="ppSep">Keep separate</button><button type="button" class="pp-sec on" id="ppMrg">Merge them</button></div>',
   s=>{ s.querySelector('#ppMrg').onclick=async()=>{ closeSheet(); const m=mergePatrols(a,b); try{ await put('patrols',m); }catch(e){} anMemo.clear(); openDetail(m.id,true); toast('Merged — gaps filled from the imported track'); };
     s.querySelector('#ppSep').onclick=async()=>{ closeSheet(); try{ await put('patrols',b); }catch(e){} openDetail(b.id,true); toast('Track imported'); }; }); }
function pickTrack(){ const inp=D.createElement('input'); inp.type='file'; inp.multiple=true; inp.style.display='none'; D.body.appendChild(inp);
  inp.onchange=async()=>{ const fs=[...(inp.files||[])]; inp.remove(); if(!fs.length)return;
    const files=[]; for(const f of fs){ if(f.size>15e6){ toast(f.name+' is too big'); continue; } try{ files.push({name:f.name,text:await f.text()}); }catch(e){} }
    importTracks(files); };
  inp.click(); }
async function importShared(){ try{ const c=await caches.open('gr-share'), r=await c.match('./__shared-track'); if(!r)return false;
    const j=await r.json(); await c.delete('./__shared-track'); if(Date.now()-(j.t||0)>30*60e3)return false;
    await importTracks((j.items||[]).filter(x=>x&&x.text)); return true; }catch(e){ return false; } }
function lockSheet(){
  sheet('<h4>Patrol with the phone locked</h4><p>Android stops web apps using GPS once the phone locks, so a small GPS app does the recording and Assisting does the rest — route, stops, street names, timeline and the patrol log.'+(isAndroid?' The easiest way is <b>Assisting GPS</b>, which hands the route back by itself. Another free option:':'')+'</p>'
   +'<p><b>1. Get GPS Logger</b> (BasicAirData) from Google Play — free, open source, works offline, collects no data.</p>'
   +'<p><b>2. Let it run when locked:</b> Settings → Apps → GPS Logger → Battery → <b>Unrestricted</b>.</p>'
   +'<p><b>3. On patrol:</b> open GPS Logger, tap <b>Record</b>, lock the phone as normal. You can still open Assisting for notes — recording in both is fine.</p>'
   +'<p><b>4. When you’re back:</b> stop the recording, open its <b>Tracklist</b>, tap the track → <b>Share</b> → choose <b>Assisting</b>. If Assisting isn’t in the list yet, save the GPX and use <b>Import a track</b> here instead.</p>'
   +'<p>If you also recorded in Assisting, the import offers to <b>merge</b> the two, so the gaps fill in and your notes stay.</p>'
   +'<p style="color:#f3d58a">Don’t use fitness apps that upload or publish routes for patrols.</p>'
   +'<div class="pp-row"><a class="pp-sec pp-a" href="'+LOGGER_URL+'" target="_blank" rel="noopener">Get GPS Logger</a><button type="button" class="pp-sec on" id="ppImp2">Import a track</button></div>'
   +'<div class="pp-row">'+(isAndroid?'<button type="button" class="pp-sec" id="ppHp2">Assisting GPS</button>':'')+'<button type="button" class="pp-sec" data-x="1">Close</button></div>',
   s=>{ s.querySelector('#ppImp2').onclick=()=>{ closeSheet(); pickTrack(); }; const h2=s.querySelector('#ppHp2'); if(h2)h2.onclick=()=>{ closeSheet(); helperSheet(); }; }); }
/* set-up for the companion app */
function helperSheet(note){ build(); if(ov.hidden)openPatrol(); const h=hinfo();
  sheet('<h4>Assisting GPS</h4>'+(note?'<p class="pp-note">'+esc(note)+'</p>':'')
   +'<p>A small companion app that records your patrol <b>with the phone locked</b> — it shows a notification while it records — and hands the route straight back into Assisting when you finish. The route goes only from the helper to Assisting on this phone: nothing is uploaded.</p>'
   +'<p><b>1. Install it.</b> Download <b>assisting-gps.apk</b> (0.1 MB) and open it. Android asks you to allow installs from Chrome once — allow it, install, then you can switch that setting off again. It isn’t on Google Play.</p>'
   +'<div class="pp-row"><a class="pp-sec pp-a on" href="'+HP_APK+'" download="assisting-gps.apk">Download Assisting GPS</a></div>'
   +'<p><b>2. Connect.</b> Tap Connect — the helper opens for a moment and comes straight back here. (Tapping <b>Open Assisting</b> in the helper connects it too.)'+(h.ok?' <span class="pp-ok">✓ Connected'+(h.perm===false?' · location not allowed yet':'')+'</span>':'')+'</p>'
   +'<div class="pp-row"><button type="button" class="pp-sec'+(h.ok?'':' on')+'" id="ppHello">'+(h.ok?'Connect again':'Connect')+'</button></div>'
   +'<p><b>3. Let it run when locked.</b> Open the Assisting GPS app once: it checks location (“While using the app” is enough), notifications and battery (“Unrestricted”), with a button for each.</p>'
   +'<p><b>On patrol:</b> tap Start patrol here as normal — the helper starts too and you can lock the phone. Tap <b>Finish</b> here (or <b>Finish &amp; send</b> in its notification) and the whole route comes in. <b>Fill gaps</b> brings in what it has so far without stopping.</p>'
   +(h.ok?'<button type="button" class="pp-sw'+(h.use!==false?' on':'')+'" id="ppHpUse"><span>Use Assisting GPS for my patrols<small>Starts and stops with Start and Finish here</small></span><i></i></button>':'')
   +'<div class="pp-row"><button type="button" class="pp-sec" data-x="1">Close</button></div>',
   s=>{ s.querySelector('#ppHello').onclick=()=>{ callHelper('hello'); };
     const u=s.querySelector('#ppHpUse'); if(u)u.onclick=()=>{ const on=!(hinfo().use!==false); hset({use:on}); u.classList.toggle('on',on); if(view==='list')render(); }; }); }

/* ================= home strip ================= */
function mountStrip(el){ if(!el)return; strips=strips.filter(x=>x.isConnected); if(!strips.includes(el))strips.push(el); paintStrip(el); }
function paintStrips(){ strips=strips.filter(x=>x.isConnected); strips.forEach(paintStrip); }
function paintStrip(el){ if(!rec||rec.done){ if(el.innerHTML)el.innerHTML=''; return; }
  const an=recAnalysis(), txt=clock(elapsed())+' · '+km(an.dist)+' · '+an.stops.length+' stop'+(an.stops.length===1?'':'s');
  let b=el.querySelector('.pp-strip');
  if(!b){ el.innerHTML='<button type="button" class="pp-strip"><i></i><b></b><span></span><em>Open ›</em></button>'; b=el.querySelector('.pp-strip'); b.onclick=()=>openPatrol(); }
  b.classList.toggle('pause',!!rec.paused); b.querySelector('b').textContent=rec.paused?'Patrol paused':'Patrol rec'; b.querySelector('span').textContent=txt; }

/* ================= start-up: carry on an unfinished recording ================= */
const initP=(async function init(){
  let id=null; try{ id=localStorage.getItem(AK); }catch(e){} if(!id)return;
  let p=null; try{ p=await get('patrols',id); }catch(e){} if(!p||p.end){ try{localStorage.removeItem(AK);}catch(e){} return; }
  p.pauses=p.pauses||[]; p.marks=p.marks||[];
  const last=p.pts.length?p.start+p.pts[p.pts.length-1][0]*1000:p.start, q=p.pauses[p.pauses.length-1], wasPaused=!!(q&&q[1]==null);
  if(Date.now()-last>(p.hp?15:8)*3600e3){ try{localStorage.removeItem(AK);}catch(e){} return; }   // left over from another day: shown as "not finished" in the list
  rec={p,watch:null,last:null,cur:null,weak:0,glitch:0,paused:wasPaused,lastSave:0,an:null,anAt:0,err:null,resumed:true};
  if(!wasPaused){ beginWatch(); wake(true); }
  startTick(); paintStrips(); loadRefs();
})();

// opened from the share menu (a GPS app's track), Assisting GPS, or a link: ?open=patrol[&shared=1|&gps=1#gps1=…|&gpsok=1|0|&gpsempty=1]
(function(){ try{ const q=new URLSearchParams((window.__entry||location).search); if(q.get('open')!=='patrol')return; const shared=q.get('shared')==='1';
  const hm1=/(?:^#|&)gps1=([A-Za-z0-9_-]+)/.exec((window.__entry||location).hash||''), pk=hm1?hm1[1]:null;
  const ok=q.get('gpsok'), empty=q.get('gpsempty')==='1', cmd=q.get('cmd')||'';
  if(ok==='1')hset({ok:true,hv:+q.get('hv')||1,perm:q.get('perm')!=='0',seen:Date.now()});
  if(ok==='0')hset({ok:false});
  history.replaceState(history.state,'',location.pathname);           // the track never stays in the address
  const go=async()=>{ try{ await initP; }catch(e){} openPatrol();
    if(pk){ await importHelper(pk); return; }
    if(ok==='1'&&cmd==='start'&&q.get('perm')==='0'){                     // the helper couldn't start: this patrol is in Assisting only
      if(rec&&!rec.done&&rec.p.hp){ delete rec.p.hp; save(true); render(); }
      helperSheet('Assisting GPS couldn’t record — it needs precise location. In its settings choose Location → “While using the app” and turn on “Use precise location”, then tap Start it on the recording screen. Until then, keep Assisting open.'); return; }
    if(ok==='1'){ toast(q.get('perm')==='0'?'Assisting GPS connected — allow it precise location when it asks':'Assisting GPS is connected'); if(view==='list')render(); return; }
    if(ok==='0'){ if(rec&&!rec.done&&rec.p.hp){ delete rec.p.hp; save(true); render(); }
      helperSheet(cmd==='start'?'Assisting GPS isn’t installed on this phone, so this patrol is recording in Assisting only — keep Assisting open.':'Assisting GPS isn’t installed on this phone (or was removed).'); return; }
    if(empty){ toast('Assisting GPS had no route to send — it may not have had a GPS fix');
      let all=[]; try{ all=await getAll('patrols'); }catch(e){}
      for(const x of all){ if(x.hp&&x.end&&!x.pts.length&&!(x.marks||[]).length){ try{ await del('patrols',x.id); }catch(e){} } }
      if(view==='list')render(); return; }
    if(shared){ const ok2=await importShared(); if(!ok2)toast('Nothing to import — share the GPX track file from GPS Logger'); } };
  if(D.readyState==='loading')D.addEventListener('DOMContentLoaded',()=>setTimeout(go,80)); else setTimeout(go,80); }catch(e){} })();
W.openPatrol=openPatrol;
W.ppBack=()=>back();
W.GRPatrol=Object.freeze({open:openPatrol,mountStrip,recording:()=>!!(rec&&!rec.done),_feed:f=>feed(f),_analyse:analyse,_timeline:timeline,_log:logText,_buildIndex:buildIndex,_nearest:nearest,_parse:parseTrackFile,_fromFixes:patrolFromFixes,_merge:mergePatrols,_import:importTracks,_state:()=>rec,_det:()=>det,_unpackHelper:unpackHelper,_importHelper:importHelper,_helper:{hinfo,hset,helperOn,hpUrl}});
})();
