/* Garda Reference — Document scanner ("Genius Scan" style): live page-edge detection with auto-capture,
   corner adjustment with a magnifier, perspective correction, scan filters (Colour+, Greyscale, Black & white)
   and a multi-page PDF (or JPEGs) saved to this phone's Downloads. Self-contained IIFE: no libraries, no network,
   no external assets. Pages live only in memory (Blobs) while the scanner is open — nothing is stored in the app.
   Heavy image work runs in a Web Worker built from a Blob URL (main-thread fallback). Styles: scanner.css (#scn). */
(function(){
'use strict';
const W=window, D=document;

/* ---------- small helpers ---------- */
const LSget=(k,d)=>{try{const v=localStorage.getItem('scn_'+k);return v==null?d:JSON.parse(v);}catch(e){return d;}};
const LSset=(k,v)=>{try{localStorage.setItem('scn_'+k,JSON.stringify(v));}catch(e){}};
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const p2=n=>String(n).padStart(2,'0');
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const q=(r,s)=>r.querySelector(s), qa=(r,s)=>Array.from(r.querySelectorAll(s));
const svg=(p,cls)=>'<svg viewBox="0 0 24 24" aria-hidden="true"'+(cls?' class="'+cls+'"':'')+'>'+p+'</svg>';
function el(html){const t=D.createElement('template');t.innerHTML=html.trim();return t.content.firstElementChild;}
function vib(p){try{if(navigator.vibrate)navigator.vibrate(p);}catch(e){}}
const hm=t=>{const d=new Date(t);return p2(d.getHours())+':'+p2(d.getMinutes());};
const plural=(n,w)=>n+' '+w+(n===1?'':'s');
const uid=()=>'s'+Date.now().toString(36)+Math.random().toString(36).slice(2,7);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const fmtSize=b=>b>=1048576?(b/1048576).toFixed(b>=10485760?0:1)+' MB':Math.max(1,Math.round(b/1024))+' KB';
const errMsg=e=>String(e&&e.message||e||'Something went wrong');
function withTimeout(p,ms){return new Promise((res,rej)=>{const t=setTimeout(()=>rej(new Error('Timed out')),ms);Promise.resolve(p).then(v=>{clearTimeout(t);res(v);},e=>{clearTimeout(t);rej(e);});});}
function hud(){try{if(W.grHudTick)W.grHudTick();}catch(e){}}
const closeBmp=b=>{try{if(b&&b.close)b.close();}catch(e){}};

const WARN='Scans are saved only to this phone (your Downloads folder). Nothing is stored in this app or sent anywhere. Documents with personal data must be handled in line with Garda policy — delete them from the phone when no longer needed.';
const HIGH=2600, STD=1800, PREV=1400, SRCMAX=4096;
const JQ={high:{c:0.9,g:88,bw:85},std:{c:0.82,g:82,bw:80}};
const FILTERS=[['orig','Original'],['color','Colour+'],['grey','Greyscale'],['bw','Black & white']];

/* ---------- session: everything a screen starts is registered here and torn down when it ends ---------- */
function mkSess(){
  const fns=[];
  const s={alive:true,
    clean(f){if(s.alive)fns.push(f);else{try{f();}catch(e){}}return f;},
    on(t,ev,fn,o){t.addEventListener(ev,fn,o);s.clean(()=>t.removeEventListener(ev,fn,o));},
    every(ms,fn){const id=setInterval(()=>{if(s.alive)fn();},ms);s.clean(()=>clearInterval(id));return id;},
    after(ms,fn){const id=setTimeout(()=>{if(s.alive)fn();},ms);s.clean(()=>clearTimeout(id));return id;},
    loop(fn){let id=0;const f=t=>{if(!s.alive)return;try{fn(t);}catch(e){console.error(e);}id=requestAnimationFrame(f);};
      id=requestAnimationFrame(f);s.clean(()=>cancelAnimationFrame(id));},
    end(){if(!s.alive)return;s.alive=false;while(fns.length){const f=fns.pop();try{f();}catch(e){}}}
  };
  return s;
}
function cvFit(cv){
  const r=cv.getBoundingClientRect(),dpr=W.devicePixelRatio||1,w=Math.max(1,Math.round(r.width)),h=Math.max(1,Math.round(r.height));
  if(cv.width!==Math.round(w*dpr)||cv.height!==Math.round(h*dpr)){cv.width=Math.round(w*dpr);cv.height=Math.round(h*dpr);}
  const c=cv.getContext('2d');c.setTransform(dpr,0,0,dpr,0,0);return {c,w,h,dpr};
}
function contentRect(v,w,h){const vw=v&&v.videoWidth,vh=v&&v.videoHeight;if(!vw||!vh)return {x:0,y:0,w,h};const k=Math.min(w/vw,h/vh);return {x:(w-vw*k)/2,y:(h-vh*k)/2,w:vw*k,h:vh*k};}

/* =====================================================================
   ENGINE — pure image processing (detection, homography warp, filters, greyscale JPEG encoder).
   Serialised into a Web Worker from a Blob URL; the same code runs on the main thread when Workers
   are unavailable. It must not reference anything outside this function.
   Coordinates are continuous: an image spans [0,w]×[0,h], pixel (i,j) has its centre at (i+.5, j+.5).
   ===================================================================== */
function ENGINE(){
  const HAS_OC=typeof OffscreenCanvas!=='undefined', HAS_DOC=typeof document!=='undefined';
  const now=()=>(typeof performance!=='undefined'?performance.now():Date.now());
  function mkCanvas(w,h){w=Math.max(1,Math.round(w));h=Math.max(1,Math.round(h));
    if(HAS_OC)return new OffscreenCanvas(w,h);
    if(HAS_DOC){const c=document.createElement('canvas');c.width=w;c.height=h;return c;}
    throw new Error('Canvas not available');}
  const ctx2=(cv,rd)=>cv.getContext('2d',rd?{willReadFrequently:true}:{alpha:false});
  const free=cv=>{try{cv.width=cv.height=1;}catch(e){}};
  const closeB=b=>{try{if(b&&b.close)b.close();}catch(e){}};
  function toBlob(cv,type,qq){
    if(cv.convertToBlob)return cv.convertToBlob({type,quality:qq});
    return new Promise((res,rej)=>{try{cv.toBlob(b=>b?res(b):rej(new Error('Image encoding failed')),type,qq);}catch(e){rej(e);}});
  }
  async function decode(blob){
    if(typeof createImageBitmap==='function'){
      try{return await createImageBitmap(blob,{imageOrientation:'from-image'});}catch(e){}
      try{return await createImageBitmap(blob);}catch(e){}
    }
    if(HAS_DOC){const u=URL.createObjectURL(blob);try{const im=new Image();im.src=u;await im.decode();return im;}catch(e){}finally{URL.revokeObjectURL(u);}}
    throw new Error('That picture can’t be opened here (HEIC or damaged?) — use a JPEG or PNG');
  }
  const dims=b=>[b.width||b.naturalWidth||0,b.height||b.naturalHeight||0];
  function grab(src,sx,sy,sw,sh,dw,dh){
    const cv=mkCanvas(dw,dh),c=ctx2(cv,true);c.imageSmoothingEnabled=true;c.imageSmoothingQuality='high';
    c.drawImage(src,sx,sy,sw,sh,0,0,cv.width,cv.height);const d=c.getImageData(0,0,cv.width,cv.height);free(cv);return d;
  }

  /* ---------- basic raster ops ---------- */
  function luma(d,n){const o=new Uint8Array(n);for(let i=0,j=0;i<n;i++,j+=4)o[i]=(d[j]*77+d[j+1]*150+d[j+2]*29)>>8;return o;}
  function minCh(d,n){const o=new Uint8Array(n);for(let i=0,j=0;i<n;i++,j+=4){const r=d[j],g=d[j+1],b=d[j+2];o[i]=r<g?(r<b?r:b):(g<b?g:b);}return o;}
  function blur(src,w,h,r){ /* separable box blur, edges clamped */
    const t=new Float32Array(w*h),o=new Uint8Array(w*h),kk=(2*r+1)*(2*r+1);
    for(let y=0;y<h;y++){const b=y*w;let s=src[b]*(r+1);for(let x=1;x<=r;x++)s+=src[b+Math.min(x,w-1)];
      for(let x=0;x<w;x++){t[b+x]=s;s+=src[b+Math.min(x+r+1,w-1)]-src[b+Math.max(x-r,0)];}}
    for(let x=0;x<w;x++){let s=t[x]*(r+1);for(let y=1;y<=r;y++)s+=t[Math.min(y,h-1)*w+x];
      for(let y=0;y<h;y++){o[y*w+x]=s/kk+0.5;s+=t[Math.min(y+r+1,h-1)*w+x]-t[Math.max(y-r,0)*w+x];}}
    return o;
  }
  function otsu(g,n){
    const H=new Float64Array(256);for(let i=0;i<n;i++)H[g[i]]++;
    let sum=0;for(let t=0;t<256;t++)sum+=t*H[t];
    let sB=0,wB=0,best=-1,th=127;
    for(let t=0;t<256;t++){wB+=H[t];if(!wB)continue;const wF=n-wB;if(!wF)break;sB+=t*H[t];const dd=sB/wB-(sum-sB)/wF,v=wB*wF*dd*dd;if(v>best){best=v;th=t;}}
    return th;
  }
  function meanBelow(g,n,T){let s=0,c=0;for(let i=0;i<n;i++)if(g[i]<=T){s+=g[i];c++;}return c?s/c:T;}
  function smooth121(src,w,h){ /* separable [1 2 1]/4 smoothing — takes the edge off sensor noise without fattening strokes */
    const t=new Uint16Array(w*h),o=new Uint8Array(w*h);
    for(let y=0;y<h;y++){const b=y*w;for(let x=0;x<w;x++){const l=src[b+(x>0?x-1:0)],r=src[b+(x<w-1?x+1:x)];t[b+x]=l+2*src[b+x]+r;}}
    for(let y=0;y<h;y++){const u=(y>0?y-1:0)*w,dn=(y<h-1?y+1:y)*w,b=y*w;for(let x=0;x<w;x++)o[b+x]=(t[u+x]+2*t[b+x]+t[dn+x]+8)>>4;}
    return o;}
  function erode(m,w,h){const o=new Uint8Array(w*h);for(let y=1;y<h-1;y++)for(let x=1,i=y*w+1;x<w-1;x++,i++)o[i]=m[i]&m[i-1]&m[i+1]&m[i-w]&m[i+w];return o;}
  function dilate(m,w,h){const o=new Uint8Array(w*h);for(let y=0;y<h;y++)for(let x=0,i=y*w;x<w;x++,i++)o[i]=m[i]|(x>0?m[i-1]:0)|(x<w-1?m[i+1]:0)|(y>0?m[i-w]:0)|(y<h-1?m[i+w]:0);return o;}
  function sobel(g,w,h){const m=new Uint8Array(w*h);
    for(let y=1;y<h-1;y++)for(let x=1,i=y*w+1;x<w-1;x++,i++){
      const gx=(g[i-w+1]+2*g[i+1]+g[i+w+1])-(g[i-w-1]+2*g[i-1]+g[i+w-1]),gy=(g[i+w-1]+2*g[i+w]+g[i+w+1])-(g[i-w-1]+2*g[i-w]+g[i-w+1]);
      const v=((gx<0?-gx:gx)+(gy<0?-gy:gy))>>2;m[i]=v>255?255:v;}
    return m;}
  function label(m,w,h){ /* 4-connected components */
    const n=w*h,lab=new Int32Array(n),st=new Int32Array(n),comps=[];let id=0;
    for(let p=0;p<n;p++){if(!m[p]||lab[p])continue;id++;let sp=0;st[sp++]=p;lab[p]=id;let area=0,x0=w,y0=h,x1=0,y1=0;
      while(sp){const k=st[--sp],x=k%w,y=(k-x)/w;area++;if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y;
        if(x>0&&m[k-1]&&!lab[k-1]){lab[k-1]=id;st[sp++]=k-1;}
        if(x<w-1&&m[k+1]&&!lab[k+1]){lab[k+1]=id;st[sp++]=k+1;}
        if(y>0&&m[k-w]&&!lab[k-w]){lab[k-w]=id;st[sp++]=k-w;}
        if(y<h-1&&m[k+w]&&!lab[k+w]){lab[k+w]=id;st[sp++]=k+w;}}
      comps.push({id,area,x0,y0,x1,y1});}
    return {lab,comps};
  }
  /* outer-boundary samples of one region: left/right extremes of each row, top/bottom of each column */
  function extremes(lab,w,id,c){const P=[];
    for(let y=c.y0;y<=c.y1;y++){let a=-1,b=-1;const o=y*w;for(let x=c.x0;x<=c.x1;x++)if(lab[o+x]===id){if(a<0)a=x;b=x;}
      if(a>=0)P.push(a,y+0.5,b+1,y+0.5);}
    for(let x=c.x0;x<=c.x1;x++){let a=-1,b=-1;for(let y=c.y0,o=c.y0*w+x;y<=c.y1;y++,o+=w)if(lab[o]===id){if(a<0)a=y;b=y;}
      if(a>=0)P.push(x+0.5,a,x+0.5,b+1);}
    return P;}

  /* ---------- geometry ---------- */
  function hull(P){const n=P.length/2,idx=new Array(n);for(let i=0;i<n;i++)idx[i]=i;
    idx.sort((a,b)=>P[2*a]-P[2*b]||P[2*a+1]-P[2*b+1]);
    const cr=(o,a,b)=>(P[2*a]-P[2*o])*(P[2*b+1]-P[2*o+1])-(P[2*a+1]-P[2*o+1])*(P[2*b]-P[2*o]);
    const lo=[],up=[];
    for(const i of idx){while(lo.length>=2&&cr(lo[lo.length-2],lo[lo.length-1],i)<=0)lo.pop();lo.push(i);}
    for(let k=n-1;k>=0;k--){const i=idx[k];while(up.length>=2&&cr(up[up.length-2],up[up.length-1],i)<=0)up.pop();up.push(i);}
    lo.pop();up.pop();return lo.concat(up).map(i=>[P[2*i],P[2*i+1]]);}
  function simplify(H,max){H=H.slice();const ar=(a,b,c)=>Math.abs((b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]));
    while(H.length>max){let bi=0,bv=Infinity;for(let i=0;i<H.length;i++){const v=ar(H[(i+H.length-1)%H.length],H[i],H[(i+1)%H.length]);if(v<bv){bv=v;bi=i;}}H.splice(bi,1);}
    return H;}
  function maxQuad(H){const n=H.length;if(n<4)return null;
    const A=(a,b,c)=>Math.abs((H[b][0]-H[a][0])*(H[c][1]-H[a][1])-(H[b][1]-H[a][1])*(H[c][0]-H[a][0]));
    let best=-1,res=null;
    for(let i=0;i<n;i++)for(let k=i+2;k<n;k++){if(n-(k-i)<2)continue;
      let bj=-1,bv=-1;for(let j=i+1;j<k;j++){const v=A(i,j,k);if(v>bv){bv=v;bj=j;}}
      let bl=-1,bw=-1;for(let l=k+1;l<i+n;l++){const L=l%n,v=A(k,L,i);if(v>bw){bw=v;bl=L;}}
      if(bj<0||bl<0)continue;if(bv+bw>best){best=bv+bw;res=[H[i],H[bj],H[k],H[bl]];}}
    return res;}
  function orderQuad(qd){ /* clockwise on screen (y down), starting at the top-left corner */
    let s=0;for(let i=0;i<4;i++){const a=qd[i],b=qd[(i+1)%4];s+=a[0]*b[1]-b[0]*a[1];}
    const r=s<0?[qd[0],qd[3],qd[2],qd[1]]:qd.slice();
    let k=0,m=Infinity;for(let i=0;i<4;i++){const v=r[i][0]+r[i][1];if(v<m){m=v;k=i;}}
    return [0,1,2,3].map(i=>[r[(k+i)%4][0],r[(k+i)%4][1]]);}
  function tls(P){const n=P.length/2;let mx=0,my=0;for(let i=0;i<P.length;i+=2){mx+=P[i];my+=P[i+1];}mx/=n;my/=n;
    let sxx=0,sxy=0,syy=0;for(let i=0;i<P.length;i+=2){const dx=P[i]-mx,dy=P[i+1]-my;sxx+=dx*dx;sxy+=dx*dy;syy+=dy*dy;}
    const th=0.5*Math.atan2(2*sxy,sxx-syy);return {px:mx,py:my,nx:-Math.sin(th),ny:Math.cos(th)};}
  const lineAB=(a,b)=>{const dx=b[0]-a[0],dy=b[1]-a[1],l=Math.hypot(dx,dy)||1;return {px:a[0],py:a[1],nx:-dy/l,ny:dx/l};};
  function meet(L1,L2){const c1=L1.nx*L1.px+L1.ny*L1.py,c2=L2.nx*L2.px+L2.ny*L2.py,det=L1.nx*L2.ny-L1.ny*L2.nx;
    if(Math.abs(det)<1e-9)return null;return [(c1*L2.ny-c2*L1.ny)/det,(L1.nx*c2-L2.nx*c1)/det];}
  function fitSides(qd,P,sc){const L=[];
    for(let s=0;s<4;s++){const A=qd[s],B=qd[(s+1)%4],dx=B[0]-A[0],dy=B[1]-A[1],len2=dx*dx+dy*dy||1;let ln=lineAB(A,B);
      for(let it=0;it<3;it++){const band=(it===0?4:it===1?2.2:1.4)*sc,S=[];
        for(let i=0;i<P.length;i+=2){const x=P[i],y=P[i+1],t=((x-A[0])*dx+(y-A[1])*dy)/len2;if(t<0.1||t>0.9)continue;
          if(Math.abs(ln.nx*(x-ln.px)+ln.ny*(y-ln.py))<band)S.push(x,y);}
        if(S.length<20)break;ln=tls(S);}
      L.push(ln);}
    const r=[];for(let s=0;s<4;s++){const p=meet(L[(s+3)%4],L[s]);r.push(p&&isFinite(p[0])&&isFinite(p[1])?p:qd[s]);}
    return r;}
  function quadArea(qd){let a=0;for(let i=0;i<4;i++){const p=qd[i],r=qd[(i+1)%4];a+=p[0]*r[1]-r[0]*p[1];}return a/2;}
  function pointIn(qd,x,y){for(let i=0;i<4;i++){const a=qd[i],b=qd[(i+1)%4];if((b[0]-a[0])*(y-a[1])-(b[1]-a[1])*(x-a[0])<0)return false;}return true;}
  function quadValid(qd,w,h,minArea){
    for(const p of qd)if(!isFinite(p[0])||!isFinite(p[1])||p[0]<-0.03*w||p[0]>1.03*w||p[1]<-0.03*h||p[1]>1.03*h)return false;
    for(let i=0;i<4;i++){const a=qd[i],b=qd[(i+1)%4],c=qd[(i+2)%4],e1x=b[0]-a[0],e1y=b[1]-a[1],e2x=c[0]-b[0],e2y=c[1]-b[1];
      if(e1x*e2y-e1y*e2x<=0)return false;
      const l1=Math.hypot(e1x,e1y),l2=Math.hypot(e2x,e2y);if(l1<0.1*Math.min(w,h))return false;
      if(Math.abs((e1x*e2x+e1y*e2y)/(l1*l2))>0.82)return false;}                 /* corner angles 35°–145° */
    if(quadArea(qd)<minArea*w*h)return false;
    const d=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]),t=d(qd[0],qd[1]),bo=d(qd[3],qd[2]),l=d(qd[0],qd[3]),r=d(qd[1],qd[2]);
    return Math.max(t,bo)/Math.min(t,bo)<=2.2&&Math.max(l,r)/Math.min(l,r)<=2.2;
  }
  const inset=(w,h,f)=>[[f*w,f*h],[(1-f)*w,f*h],[(1-f)*w,(1-f)*h],[f*w,(1-f)*h]];
  /* how much of each side has a real edge under it (inside vs outside brightness) */
  function support(G,w,h,qd){
    let cx=0,cy=0;for(const p of qd){cx+=p[0]/4;cy+=p[1]/4;}
    const off=Math.max(1.5,Math.max(w,h)/220),K=24,pos=[0,0,0,0],neg=[0,0,0,0];
    const at=(x,y)=>{const ix=Math.floor(x),iy=Math.floor(y);return (ix<0||iy<0||ix>=w||iy>=h)?-1:G[iy*w+ix];};
    for(let s=0;s<4;s++){const A=qd[s],B=qd[(s+1)%4],dx=B[0]-A[0],dy=B[1]-A[1],l=Math.hypot(dx,dy)||1;
      let nx=dy/l,ny=-dx/l;if(nx*((A[0]+B[0])/2-cx)+ny*((A[1]+B[1])/2-cy)<0){nx=-nx;ny=-ny;}
      for(let k=0;k<K;k++){const t=0.08+0.84*(k+0.5)/K,x=A[0]+dx*t,y=A[1]+dy*t,vi=at(x-nx*off,y-ny*off),vo=at(x+nx*off,y+ny*off);
        if(vi<0||vo<0)continue;const c=vi-vo;if(c>=12)pos[s]++;else if(c<=-12)neg[s]++;}}
    const P=pos[0]+pos[1]+pos[2]+pos[3],N=neg[0]+neg[1]+neg[2]+neg[3],S=(P>=N?pos:neg).map(v=>v/K);
    return {mean:(S[0]+S[1]+S[2]+S[3])/4,min:Math.min(S[0],S[1],S[2],S[3])};
  }
  function quadFromPts(P,sc){if(P.length<16)return null;const H=hull(P);if(H.length<4)return null;
    const Q=maxQuad(simplify(H,40));if(!Q)return null;return orderQuad(fitSides(orderQuad(Q),P,sc));}
  function edgeFlood(L,w,h,sc){ /* region grown from the centre, bounded by edges (robust to shading) */
    const n=w*h,E=sobel(L,w,h),Te=Math.max(14,otsu(E,n)*0.75);let e=new Uint8Array(n);for(let i=0;i<n;i++)e[i]=E[i]>Te?1:0;e=dilate(e,w,h);
    let seed=-1;const cx=w>>1,cy=h>>1,R=Math.round(Math.min(w,h)*0.12);
    for(let r=0;r<=R&&seed<0;r+=2)for(let a=0;a<8&&seed<0;a++){const x=Math.round(cx+r*Math.cos(a*Math.PI/4)),y=Math.round(cy+r*Math.sin(a*Math.PI/4));if(x>=0&&y>=0&&x<w&&y<h&&!e[y*w+x])seed=y*w+x;}
    if(seed<0)return null;
    const Rm=new Uint8Array(n),st=new Int32Array(n);let sp=0,area=0,border=0,x0=w,y0=h,x1=0,y1=0;st[sp++]=seed;Rm[seed]=1;
    while(sp){const p=st[--sp],x=p%w,y=(p-x)/w;area++;if(x===0||y===0||x===w-1||y===h-1)border++;if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y;
      if(x>0&&!e[p-1]&&!Rm[p-1]){Rm[p-1]=1;st[sp++]=p-1;}if(x<w-1&&!e[p+1]&&!Rm[p+1]){Rm[p+1]=1;st[sp++]=p+1;}
      if(y>0&&!e[p-w]&&!Rm[p-w]){Rm[p-w]=1;st[sp++]=p-w;}if(y<h-1&&!e[p+w]&&!Rm[p+w]){Rm[p+w]=1;st[sp++]=p+w;}}
    if(border>0.12*(w+h)||area<0.1*n)return null;
    const R2=dilate(Rm,w,h),c={x0:Math.max(0,x0-1),y0:Math.max(0,y0-1),x1:Math.min(w-1,x1+1),y1:Math.min(h-1,y1+1)};
    const qd=quadFromPts(extremes(R2,w,1,c),sc);return qd?{q:qd,area}:null;
  }
  function detectQuad(d,w,h,dbg){
    const t0=now(),n=w*h,sc=Math.max(w,h)/400;
    const L=blur(blur(luma(d,n),w,h,2),w,h,1),M=blur(minCh(d,n),w,h,2),ci=Math.floor(h/2)*w+Math.floor(w/2),cand=[];
    const fromMask=m=>{m=dilate(erode(m,w,h),w,h);const r=label(m,w,h),lab=r.lab,comps=r.comps;
      comps.sort((a,b)=>b.area-a.area);const pick=comps.filter(c=>c.area>=0.04*n).slice(0,2);
      const cc=lab[ci];if(cc){const c=comps.find(x=>x.id===cc);if(c&&c.area>=0.04*n&&pick.indexOf(c)<0)pick.push(c);}
      for(const c of pick){const qd=quadFromPts(extremes(lab,w,c.id,c),sc);if(qd)cand.push({q:qd,area:c.area,src:fromMask.src});}};
    const thr=(g,T)=>{const m=new Uint8Array(n);for(let i=0;i<n;i++)m[i]=g[i]>T?1:0;return m;};
    const T1=otsu(L,n);fromMask.src='luma';fromMask(thr(L,T1));
    fromMask.src='min';fromMask(thr(M,otsu(M,n)));
    fromMask.src='luma-lo';fromMask(thr(L,Math.round(T1-(T1-meanBelow(L,n,T1))*0.5)));
    try{const f=edgeFlood(L,w,h,sc);if(f){f.src='edges';cand.push(f);}}catch(e){}
    let best=null;
    for(const c of cand){if(!quadValid(c.q,w,h,0.2)){c.why='invalid';continue;}const s=support(L,w,h,c.q);c.sup=s;if(s.min<0.3){c.why='weak';continue;}
      c.score=s.mean+0.35*s.min+(pointIn(c.q,w/2,h/2)?0.12:0)+0.15*quadArea(c.q)/n;if(!best||c.score>best.score)best=c;}
    let ok=!!best&&best.score>0.7,grown=false;
    if(ok){ /* grow each side out to the outermost paper edge nearby: repairs sides cut short by shadows, headers or printed frames */
      for(let it=0;it<3;it++){try{const g=refineQuad(L,w,h,best.q,{rf:0.06,noShift:true,minCos:0.96});
        if(!quadValid(g,w,h,0.2))break;const s=support(L,w,h,g),sc2=s.mean+0.35*s.min+(pointIn(g,w/2,h/2)?0.12:0)+0.15*quadArea(g)/n;
        if(s.min<0.3||sc2<best.score-0.04)break;const moved=Math.max(...g.map((p,i)=>Math.hypot(p[0]-best.q[i][0],p[1]-best.q[i][1])));
        best={q:orderQuad(g),score:sc2,src:best.src};grown=true;if(moved<0.5)break;}catch(e){break;}}}
    const res={quad:ok?best.q:inset(w,h,0.06),ok,score:best?+best.score.toFixed(3):0,n:cand.length,grown,ms:+(now()-t0).toFixed(2)};
    if(dbg)res.cands=cand.map(c=>({src:c.src,q:c.q.map(p=>p.map(v=>+v.toFixed(1))),score:c.score,why:c.why,sup:c.sup}));
    return res;
  }
  /* sub-pixel edge refinement on a larger image: strongest step along each side's normal, robust line fit */
  function refineQuad(G,w,h,qd,op){
    /* per side: sample brightness profiles across the coarse edge; the side's polarity (paper brighter or darker than the
       desk) is read near the coarse line; then on each profile the OUTERMOST strong edge of that polarity is taken — the
       paper edge is the last paper→desk transition, so printed frames or text near the edge can't capture it */
    const bil=(x,y)=>{x-=0.5;y-=0.5;if(x<0)x=0;if(y<0)y=0;if(x>w-1.001)x=w-1.001;if(y>h-1.001)y=h-1.001;
      const x0=x|0,y0=y|0,fx=x-x0,fy=y-y0,i=y0*w+x0;return (G[i]*(1-fx)+G[i+1]*fx)*(1-fy)+(G[i+w]*(1-fx)+G[i+w+1]*fx)*fy;};
    let cx=0,cy=0;for(const p of qd){cx+=p[0]/4;cy+=p[1]/4;}
    op=op||{};const R=Math.max(5,Math.round(Math.max(w,h)*(op.rf||0.018))),inward=op.noShift?0:Math.max(0.6,Math.hypot(w,h)*0.0015),lines=[],M=2*R+1;
    for(let s=0;s<4;s++){const A=qd[s],B=qd[(s+1)%4],dx=B[0]-A[0],dy=B[1]-A[1],len=Math.hypot(dx,dy)||1;
      let nx=dy/len,ny=-dx/len;if(nx*((A[0]+B[0])/2-cx)+ny*((A[1]+B[1])/2-cy)<0){nx=-nx;ny=-ny;}
      const K=Math.max(12,Math.min(64,Math.round(len/10))),Dk=new Float32Array(K*M),P=new Float32Array(M+2),base=[];let pol=0;
      for(let k=0;k<K;k++){const t=0.1+0.8*(k+0.5)/K,px=A[0]+dx*t,py=A[1]+dy*t;base.push(px,py);
        for(let o=-R-1;o<=R+1;o++)P[o+R+1]=bil(px+nx*o,py+ny*o);
        let si=0,so=0;for(let o=1;o<=R;o++){si+=P[R+1-o];so+=P[R+1+o];}pol+=so-si;       /* outside minus inside, over wide bands */
        for(let o=-R;o<=R;o++)Dk[k*M+o+R]=(P[o+R+2]-P[o+R])/2;}
      const sgn=pol<0?-1:1,S=[];
      for(let k=0;k<K;k++){const o0=k*M;let pk=0;for(let o=0;o<M;o++){const v=sgn*Dk[o0+o];if(v>pk)pk=v;}
        if(pk<3)continue;let bi=-1;
        for(let o=M-1;o>=0;o--){const v=sgn*Dk[o0+o];if(v>=0.5*pk&&v>=(o>0?sgn*Dk[o0+o-1]:-1e9)&&v>=(o<M-1?sgn*Dk[o0+o+1]:-1e9)){bi=o;break;}}
        if(bi<0)continue;let dl=0;
        if(bi>0&&bi<M-1){const a=sgn*Dk[o0+bi-1],b=sgn*Dk[o0+bi],c=sgn*Dk[o0+bi+1],den=a-2*b+c;if(den<0)dl=clampN(0.5*(a-c)/den,-0.5,0.5);}
        const off=bi-R+dl;S.push(base[2*k]+nx*off,base[2*k+1]+ny*off);}
      let ln=null;
      if(S.length/2>=Math.max(6,K*0.35)){ln=tls(S);
        for(let it=0;it<2;it++){const res=[];for(let i=0;i<S.length;i+=2)res.push(Math.abs(ln.nx*(S[i]-ln.px)+ln.ny*(S[i+1]-ln.py)));
          const md=res.slice().sort((a,b)=>a-b)[res.length>>1],lim=Math.max(0.8,3*md),T=[];for(let i=0;i<res.length;i++)if(res[i]<=lim)T.push(S[2*i],S[2*i+1]);
          if(T.length/2<Math.max(6,K*0.3))break;ln=tls(T);}
        const ang=Math.abs(ln.nx*nx+ln.ny*ny),dm=Math.abs(ln.nx*((A[0]+B[0])/2-ln.px)+ln.ny*((A[1]+B[1])/2-ln.py));
        if(ang<(op.minCos||0.994)||dm>R)ln=null;}
      if(ln){let lx=ln.nx,ly=ln.ny;if(lx*(cx-ln.px)+ly*(cy-ln.py)<0){lx=-lx;ly=-ly;}ln={px:ln.px+lx*inward,py:ln.py+ly*inward,nx:lx,ny:ly};}
      lines.push(ln||lineAB(A,B));}
    const r=[];for(let s=0;s<4;s++){const p=meet(lines[(s+3)%4],lines[s]);r.push(p&&Math.hypot(p[0]-qd[s][0],p[1]-qd[s][1])<3*R?p:qd[s]);}
    return r;
  }
  function clampN(v,a,b){return v<a?a:v>b?b:v;}

  /* ---------- perspective ---------- */
  function solve(A,b){const n=b.length,M=A.map((r,i)=>r.concat([b[i]]));
    for(let c=0;c<n;c++){let p=c;for(let r=c+1;r<n;r++)if(Math.abs(M[r][c])>Math.abs(M[p][c]))p=r;if(Math.abs(M[p][c])<1e-12)return null;
      const t=M[c];M[c]=M[p];M[p]=t;
      for(let r=0;r<n;r++){if(r===c)continue;const f=M[r][c]/M[c][c];if(!f)continue;for(let k=c;k<=n;k++)M[r][k]-=f*M[c][k];}}
    return M.map((r,i)=>r[n]/r[i]);}
  function homog(src,dst){ /* 3×3 H (h33=1) with src ≈ H·dst — i.e. it maps output pixels back into the photo */
    const A=[],b=[];
    for(let i=0;i<4;i++){const u=dst[i][0],v=dst[i][1],x=src[i][0],y=src[i][1];
      A.push([u,v,1,0,0,0,-u*x,-v*x]);b.push(x);A.push([0,0,0,u,v,1,-u*y,-v*y]);b.push(y);}
    const h=solve(A,b);return h&&h.every(isFinite)?h.concat([1]):null;}
  function warp(S,sw,sh,Hm,Wd,Hd,prog){ /* inverse mapping with bilinear sampling */
    const out=new Uint8ClampedArray(Wd*Hd*4),a=Hm[0],b=Hm[1],c=Hm[2],d=Hm[3],e=Hm[4],f=Hm[5],g=Hm[6],hh=Hm[7];
    const mx=sw-1.001,my=sh-1.001,row=sw*4,step=Math.max(1,Math.floor(Hd/16));
    for(let v=0;v<Hd;v++){const vc=v+0.5;let X=a*0.5+b*vc+c,Y=d*0.5+e*vc+f,Z=g*0.5+hh*vc+1,o=v*Wd*4;
      for(let u=0;u<Wd;u++,X+=a,Y+=d,Z+=g,o+=4){const iz=1/Z;let x=X*iz-0.5,y=Y*iz-0.5;
        if(x<0)x=0;else if(x>mx)x=mx;if(y<0)y=0;else if(y>my)y=my;
        const x0=x|0,y0=y|0,fx=x-x0,fy=y-y0,i=(y0*sw+x0)*4,j=i+row,w00=(1-fx)*(1-fy),w10=fx*(1-fy),w01=(1-fx)*fy,w11=fx*fy;
        out[o]=S[i]*w00+S[i+4]*w10+S[j]*w01+S[j+4]*w11;
        out[o+1]=S[i+1]*w00+S[i+5]*w10+S[j+1]*w01+S[j+5]*w11;
        out[o+2]=S[i+2]*w00+S[i+6]*w10+S[j+2]*w01+S[j+6]*w11;
        out[o+3]=255;}
      if(prog&&v%step===0)prog(v/Hd);}
    return out;
  }
  const reorder=(qd,r)=>{r=((r|0)%4+4)%4;return [0,1,2,3].map(i=>qd[(i-r+4)%4]);};
  /* true aspect ratio of the page (Zhang & He, whiteboard scanning) — principal point at the image centre */
  function aspectZH(Q,u0,v0){
    const m1=[Q[0][0]-u0,Q[0][1]-v0,1],m2=[Q[1][0]-u0,Q[1][1]-v0,1],m3=[Q[3][0]-u0,Q[3][1]-v0,1],m4=[Q[2][0]-u0,Q[2][1]-v0,1];
    const cr=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],dt=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
    const c14=cr(m1,m4),k2=dt(c14,m3)/dt(cr(m2,m4),m3),k3=dt(c14,m2)/dt(cr(m3,m4),m2);if(!isFinite(k2)||!isFinite(k3))return 0;
    const n2=[k2*m2[0]-m1[0],k2*m2[1]-m1[1],k2*m2[2]-m1[2]],n3=[k3*m3[0]-m1[0],k3*m3[1]-m1[1],k3*m3[2]-m1[2]];
    const aff=Math.sqrt((n2[0]*n2[0]+n2[1]*n2[1])/(n3[0]*n3[0]+n3[1]*n3[1])),Dg=2*Math.hypot(u0,v0);
    const f2=-(n2[0]*n3[0]+n2[1]*n3[1])/(n2[2]*n3[2]);
    if(!(f2>0)||!isFinite(f2))return aff;const f=Math.sqrt(f2);if(f<0.25*Dg||f>6*Dg)return aff;
    return Math.sqrt((n2[0]*n2[0]+n2[1]*n2[1]+f2*n2[2]*n2[2])/(n3[0]*n3[0]+n3[1]*n3[1]+f2*n3[2]*n3[2]));
  }
  function outDims(Q,bw,bh,cap){
    const d=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]),Wn=Math.max(d(Q[0],Q[1]),d(Q[3],Q[2])),Hn=Math.max(d(Q[0],Q[3]),d(Q[1],Q[2]));
    let Wd=Wn,Hd=Hn,r=0;try{r=aspectZH(Q,bw/2,bh/2);}catch(e){}
    if(r>0&&isFinite(r)&&Math.abs(Math.log(r/(Wn/Hn)))<0.35){if(Wn*Wn/r>=Hn*Hn*r){Wd=Wn;Hd=Wn/r;}else{Hd=Hn;Wd=Hn*r;}}
    let a4=false;const S2=Math.SQRT2;
    if(Hd>=Wd){if(Math.abs(Hd/Wd-S2)/S2<=0.06){Wd=Hd/S2;a4=true;}}else if(Math.abs(Wd/Hd-S2)/S2<=0.06){Hd=Wd/S2;a4=true;}
    const k=Math.min(1,cap/Math.max(Wd,Hd));return {W:Math.max(16,Math.round(Wd*k)),H:Math.max(16,Math.round(Hd*k)),a4,aspect:r||Wn/Hn};
  }

  /* ---------- scan filters ---------- */
  const PAPER=232; /* normalised paper level */
  function paperField(d,Wd,Hd){ /* coarse map of the paper colour (brightest 10 % of each block, dilated, smoothed) */
    const bs=Math.max(6,Math.round(Math.min(Wd,Hd)/40)),gw=Math.ceil(Wd/bs),gh=Math.ceil(Hd/bs),G=gw*gh,st=bs>=12?2:1;
    const R=new Float32Array(G),Gg=new Float32Array(G),B=new Float32Array(G),Lm=new Float32Array(G),hist=new Uint32Array(256);
    for(let by=0;by<gh;by++)for(let bx=0;bx<gw;bx++){
      const x0=bx*bs,y0=by*bs,x1=Math.min(Wd,x0+bs),y1=Math.min(Hd,y0+bs);hist.fill(0);let cnt=0;
      for(let y=y0;y<y1;y+=st)for(let x=x0,o=(y*Wd+x0)*4;x<x1;x+=st,o+=4*st){hist[(d[o]*77+d[o+1]*150+d[o+2]*29)>>8]++;cnt++;}
      let acc=0,thr=255;const tg=cnt*0.9;for(let t=0;t<256;t++){acc+=hist[t];if(acc>=tg){thr=t;break;}}
      let sr=0,sg=0,sb=0,k=0;
      for(let y=y0;y<y1;y+=st)for(let x=x0,o=(y*Wd+x0)*4;x<x1;x+=st,o+=4*st)if(((d[o]*77+d[o+1]*150+d[o+2]*29)>>8)>=thr){sr+=d[o];sg+=d[o+1];sb+=d[o+2];k++;}
      const i=by*gw+bx;k=k||1;R[i]=sr/k;Gg[i]=sg/k;B[i]=sb/k;Lm[i]=R[i]*0.299+Gg[i]*0.587+B[i]*0.114;}
    const R2=new Float32Array(G),G2=new Float32Array(G),B2=new Float32Array(G),L2=new Float32Array(G);
    for(let by=0;by<gh;by++)for(let bx=0;bx<gw;bx++){let bi=by*gw+bx,bv=-1;
      for(let yy=Math.max(0,by-2);yy<=Math.min(gh-1,by+2);yy++)for(let xx=Math.max(0,bx-2);xx<=Math.min(gw-1,bx+2);xx++){const j=yy*gw+xx;if(Lm[j]>bv){bv=Lm[j];bi=j;}}
      const i=by*gw+bx;R2[i]=R[bi];G2[i]=Gg[bi];B2[i]=B[bi];L2[i]=bv;}
    /* …then erode by the same radius (a closing): fills text and logos but leaves smooth shading gradients in place */
    const R3=new Float32Array(G),G3=new Float32Array(G),B3=new Float32Array(G),L3=new Float32Array(G);
    for(let by=0;by<gh;by++)for(let bx=0;bx<gw;bx++){let bi=by*gw+bx,bv=1e9;
      for(let yy=Math.max(0,by-2);yy<=Math.min(gh-1,by+2);yy++)for(let xx=Math.max(0,bx-2);xx<=Math.min(gw-1,bx+2);xx++){const j=yy*gw+xx;if(L2[j]<bv){bv=L2[j];bi=j;}}
      const i=by*gw+bx;R3[i]=R2[bi];G3[i]=G2[bi];B3[i]=B2[bi];L3[i]=bv;}
    R2.set(R3);G2.set(G3);B2.set(B3);L2.set(L3);
    const ord=Array.from(L2.keys()).sort((a,b)=>L2[a]-L2[b]),gp=ord[Math.min(G-1,Math.floor(G*0.8))];
    const fr=Math.max(24,R2[gp]*0.45),fg=Math.max(24,G2[gp]*0.45),fb=Math.max(24,B2[gp]*0.45);
    for(let i=0;i<G;i++){if(R2[i]<fr)R2[i]=fr;if(G2[i]<fg)G2[i]=fg;if(B2[i]<fb)B2[i]=fb;}
    const sm=a=>{const t=new Float32Array(G);for(let p=0;p<2;p++){for(let y=0;y<gh;y++)for(let x=0;x<gw;x++){let s=0,c=0;
      for(let yy=Math.max(0,y-1);yy<=Math.min(gh-1,y+1);yy++)for(let xx=Math.max(0,x-1);xx<=Math.min(gw-1,x+1);xx++){s+=a[yy*gw+xx];c++;}t[y*gw+x]=s/c;}a.set(t);}return a;};
    return {bs,gw,gh,R:sm(R2),G:sm(G2),B:sm(B2)};
  }
  function normalise(d,Wd,Hd){ /* divide by the paper field: removes shadows and colour casts, paper → PAPER */
    const F=paperField(d,Wd,Hd),bs=F.bs,gw=F.gw,gh=F.gh,N=new Uint8ClampedArray(Wd*Hd*4),ix=new Int32Array(Wd),wx=new Float32Array(Wd);
    for(let x=0;x<Wd;x++){let f=(x+0.5)/bs-0.5;if(f<0)f=0;if(f>gw-1)f=gw-1;ix[x]=f|0;wx[x]=f-(f|0);}
    const rR=new Float32Array(gw+1),rG=new Float32Array(gw+1),rB=new Float32Array(gw+1);
    for(let y=0;y<Hd;y++){let f=(y+0.5)/bs-0.5;if(f<0)f=0;if(f>gh-1)f=gh-1;const j=f|0,j2=Math.min(gh-1,j+1),wy=f-j;
      for(let i=0;i<gw;i++){const a=j*gw+i,b=j2*gw+i;rR[i]=F.R[a]+(F.R[b]-F.R[a])*wy;rG[i]=F.G[a]+(F.G[b]-F.G[a])*wy;rB[i]=F.B[a]+(F.B[b]-F.B[a])*wy;}
      rR[gw]=rR[gw-1];rG[gw]=rG[gw-1];rB[gw]=rB[gw-1];
      for(let x=0,o=y*Wd*4;x<Wd;x++,o+=4){const i=ix[x],t=wx[x];
        N[o]=d[o]*PAPER/(rR[i]+(rR[i+1]-rR[i])*t);N[o+1]=d[o+1]*PAPER/(rG[i]+(rG[i+1]-rG[i])*t);N[o+2]=d[o+2]*PAPER/(rB[i]+(rB[i+1]-rB[i])*t);N[o+3]=255;}}
    return N;
  }
  function levels(hist,tot){let acc=0,bp=0;for(let t=0;t<256;t++){acc+=hist[t];if(acc>=tot*0.01){bp=t;break;}}
    bp=Math.min(bp,Math.round(PAPER*0.45));const wp=Math.round(PAPER*0.9),lut=new Uint8ClampedArray(256);
    for(let v=0;v<256;v++){const x=Math.min(1,Math.max(0,(v-bp)/(wp-bp)));lut[v]=255*Math.pow(x,1.15);}return lut;}
  function fColour(d,Wd,Hd){ /* Colour+: white paper, deeper ink, gentle saturation boost */
    const N=normalise(d,Wd,Hd),n=Wd*Hd,hist=new Uint32Array(256);let tot=0;
    for(let o=0;o<n*4;o+=12){hist[(N[o]*77+N[o+1]*150+N[o+2]*29)>>8]++;tot++;}
    const lut=levels(hist,tot);
    for(let o=0;o<n*4;o+=4){const r=lut[N[o]],g=lut[N[o+1]],b=lut[N[o+2]],l=r*0.299+g*0.587+b*0.114,
        c=(r>g?(r>b?r:b):(g>b?g:b))-(r<g?(r<b?r:b):(g<b?g:b)),k=c<=16?0:c>=40?1.3:1.3*(c-16)/24; /* chroma gate: tints and colour noise → neutral, real ink colour → boosted */
      N[o]=l+(r-l)*k;N[o+1]=l+(g-l)*k;N[o+2]=l+(b-l)*k;}
    return N;
  }
  function fGrey(d,Wd,Hd){const N=normalise(d,Wd,Hd),n=Wd*Hd,g=new Uint8Array(n),hist=new Uint32Array(256);
    for(let i=0,o=0;i<n;i++,o+=4){const l=(N[o]*77+N[o+1]*150+N[o+2]*29)>>8;g[i]=l;hist[l]++;}
    const lut=levels(hist,n);for(let i=0;i<n;i++)g[i]=lut[g[i]];return g;}
  function maxFilter(src,w,h,r){ /* van Herk / Gil-Werman separable max over a (2r+1)² window, O(n) */
    const k=2*r+1,L=Math.max(w,h)+2*r,a=new Uint8Array(L),g=new Uint8Array(L),hh=new Uint8Array(L),tmp=new Uint8Array(w*h),out=new Uint8Array(w*h);
    const run=len=>{const N=len+2*r;let c=0,m=0;
      for(let i=0;i<N;i++){const v=a[i];if(c===0||v>m)m=v;g[i]=m;if(++c===k)c=0;}
      const last=N-1;let pos=last%k;m=0;
      for(let i=last;i>=0;i--){const v=a[i];if(i===last||pos===k-1)m=v;else if(v>m)m=v;hh[i]=m;if(--pos<0)pos=k-1;}};
    for(let y=0;y<h;y++){const o=y*w;a.fill(0,0,r);a.set(src.subarray(o,o+w),r);a.fill(0,r+w,w+2*r);run(w);
      for(let x=0;x<w;x++){const p=hh[x],q2=g[x+2*r];tmp[o+x]=p>q2?p:q2;}}
    for(let x=0;x<w;x++){a.fill(0,0,r);for(let y=0,o=x;y<h;y++,o+=w)a[r+y]=tmp[o];a.fill(0,r+h,h+2*r);run(h);
      for(let y=0,o=x;y<h;y++,o+=w){const p=hh[y],q2=g[y+2*r];out[o]=p>q2?p:q2;}}
    return out;
  }
  function minFilter(src,w,h,r){const n=w*h,inv=new Uint8Array(n);for(let i=0;i<n;i++)inv[i]=255-src[i];const m=maxFilter(inv,w,h,r);for(let i=0;i<n;i++)m[i]=255-m[i];return m;}
  function fBW(d,Wd,Hd,op){ /* contrast-aware local midpoint threshold (Bernsen) on the shading-corrected image:
      every edge is cut halfway between the local paper and local ink levels, so faint thin strokes survive and bold
      strokes keep their true weight; flat areas (paper, solid fills) fall back to a global level */
    op=op||{};const N=normalise(d,Wd,Hd),n=Wd*Hd;let G=new Uint8Array(n);for(let i=0,o=0;i<n;i++,o+=4)G[i]=(N[o]*77+N[o+1]*150+N[o+2]*29)>>8;
    G=smooth121(G,Wd,Hd);
    const r=Math.max(2,Math.round(Math.min(Wd,Hd)/(op.rf||300))),MX=maxFilter(G,Wd,Hd,r),MN=minFilter(G,Wd,Hd,r);
    const C=op.C||36,glob=PAPER*(op.g||0.6),hiG=PAPER*0.92,loG=PAPER*0.3,sl=128/(op.ramp||8),out=new Uint8Array(n);
    for(let i=0;i<n;i++){const v=G[i];let o;
      if(v>=hiG)o=255;else if(v<=loG)o=0;else{const mx=MX[i],mn=MN[i],T=mx-mn>=C?(mx+mn)/2:glob;o=128+(v-T)*sl;o=o<0?0:o>255?255:o;}
      out[i]=o;}
    for(let y=1;y<Hd-1;y++)for(let x=1,i=y*Wd+1;x<Wd-1;x++,i++){if(out[i]>=128)continue;let c=0;
      if(out[i-1]<128)c++;if(out[i+1]<128)c++;if(out[i-Wd]<128)c++;if(out[i+Wd]<128)c++;if(out[i-Wd-1]<128)c++;if(out[i-Wd+1]<128)c++;if(out[i+Wd-1]<128)c++;if(out[i+Wd+1]<128)c++;
      if(c===0)out[i]=255;}
    return out;
  }
  function filt(rgba,Wd,Hd,f){if(f==='color')return {rgba:fColour(rgba,Wd,Hd)};if(f==='grey')return {grey:fGrey(rgba,Wd,Hd)};if(f==='bw')return {grey:fBW(rgba,Wd,Hd)};return {rgba};}
  function g2rgba(g){const n=g.length,o=new Uint8ClampedArray(n*4);for(let i=0,j=0;i<n;i++,j+=4){o[j]=o[j+1]=o[j+2]=g[i];o[j+3]=255;}return o;}
  function downBox(src,w,h,tw,th,ch){ /* area-average downscale, ch = 1 (grey) or 4 (RGBA) */
    const out=ch===4?new Uint8ClampedArray(tw*th*4):new Uint8Array(tw*th),sx=w/tw,sy=h/th;
    for(let y=0;y<th;y++){const ya=Math.floor(y*sy),yb=Math.max(ya+1,Math.min(h,Math.floor((y+1)*sy)));
      for(let x=0;x<tw;x++){const xa=Math.floor(x*sx),xb=Math.max(xa+1,Math.min(w,Math.floor((x+1)*sx)));let r=0,g=0,b=0,c=0;
        for(let yy=ya;yy<yb;yy++)for(let xx=xa;xx<xb;xx++){const i=(yy*w+xx)*ch;r+=src[i];if(ch===4){g+=src[i+1];b+=src[i+2];}c++;}
        const o=(y*tw+x)*ch;out[o]=r/c;if(ch===4){out[o+1]=g/c;out[o+2]=b/c;out[o+3]=255;}}}
    return out;}

  /* ---------- baseline greyscale JPEG encoder (1 component → PDF /DeviceGray) ---------- */
  const ZZ=[0,1,8,16,9,2,3,10,17,24,32,25,18,11,4,5,12,19,26,33,40,48,41,34,27,20,13,6,7,14,21,28,35,42,49,56,57,50,43,36,29,22,15,23,30,37,44,51,58,59,52,45,38,31,39,46,53,60,61,54,47,55,62,63];
  const YQ=[16,11,10,16,24,40,51,61,12,12,14,19,26,58,60,55,14,13,16,24,40,57,69,56,14,17,22,29,51,87,80,62,18,22,37,56,68,109,103,77,24,35,55,64,81,104,113,92,49,64,78,87,103,121,120,101,72,92,95,98,112,100,103,99];
  const DCB=[0,1,5,1,1,1,1,1,1,0,0,0,0,0,0,0],DCV=[0,1,2,3,4,5,6,7,8,9,10,11];
  const ACB=[0,2,1,3,3,2,4,3,5,5,4,4,0,0,1,0x7d];
  const ACV=[0x01,0x02,0x03,0x00,0x04,0x11,0x05,0x12,0x21,0x31,0x41,0x06,0x13,0x51,0x61,0x07,0x22,0x71,0x14,0x32,0x81,0x91,0xa1,0x08,0x23,0x42,0xb1,0xc1,0x15,0x52,0xd1,0xf0,
    0x24,0x33,0x62,0x72,0x82,0x09,0x0a,0x16,0x17,0x18,0x19,0x1a,0x25,0x26,0x27,0x28,0x29,0x2a,0x34,0x35,0x36,0x37,0x38,0x39,0x3a,0x43,0x44,0x45,0x46,0x47,0x48,0x49,0x4a,
    0x53,0x54,0x55,0x56,0x57,0x58,0x59,0x5a,0x63,0x64,0x65,0x66,0x67,0x68,0x69,0x6a,0x73,0x74,0x75,0x76,0x77,0x78,0x79,0x7a,0x83,0x84,0x85,0x86,0x87,0x88,0x89,0x8a,
    0x92,0x93,0x94,0x95,0x96,0x97,0x98,0x99,0x9a,0xa2,0xa3,0xa4,0xa5,0xa6,0xa7,0xa8,0xa9,0xaa,0xb2,0xb3,0xb4,0xb5,0xb6,0xb7,0xb8,0xb9,0xba,0xc2,0xc3,0xc4,0xc5,0xc6,0xc7,0xc8,0xc9,0xca,
    0xd2,0xd3,0xd4,0xd5,0xd6,0xd7,0xd8,0xd9,0xda,0xe1,0xe2,0xe3,0xe4,0xe5,0xe6,0xe7,0xe8,0xe9,0xea,0xf1,0xf2,0xf3,0xf4,0xf5,0xf6,0xf7,0xf8,0xf9,0xfa];
  function huff(bits,vals){const code=new Uint16Array(256),len=new Uint8Array(256);let c=0,k=0;
    for(let l=1;l<=16;l++){for(let i=0;i<bits[l-1];i++){code[vals[k]]=c;len[vals[k]]=l;k++;c++;}c<<=1;}return {code,len};}
  function fdct(d){
    for(let i=0;i<64;i+=8){
      const t0=d[i]+d[i+7],t7=d[i]-d[i+7],t1=d[i+1]+d[i+6],t6=d[i+1]-d[i+6],t2=d[i+2]+d[i+5],t5=d[i+2]-d[i+5],t3=d[i+3]+d[i+4],t4=d[i+3]-d[i+4];
      let t10=t0+t3,t13=t0-t3,t11=t1+t2,t12=t1-t2;
      d[i]=t10+t11;d[i+4]=t10-t11;const z1=(t12+t13)*0.707106781;d[i+2]=t13+z1;d[i+6]=t13-z1;
      t10=t4+t5;t11=t5+t6;t12=t6+t7;
      const z5=(t10-t12)*0.382683433,z2=0.5411961*t10+z5,z4=1.306562965*t12+z5,z3=t11*0.707106781,z11=t7+z3,z13=t7-z3;
      d[i+5]=z13+z2;d[i+3]=z13-z2;d[i+1]=z11+z4;d[i+7]=z11-z4;}
    for(let i=0;i<8;i++){
      const t0=d[i]+d[i+56],t7=d[i]-d[i+56],t1=d[i+8]+d[i+48],t6=d[i+8]-d[i+48],t2=d[i+16]+d[i+40],t5=d[i+16]-d[i+40],t3=d[i+24]+d[i+32],t4=d[i+24]-d[i+32];
      let t10=t0+t3,t13=t0-t3,t11=t1+t2,t12=t1-t2;
      d[i]=t10+t11;d[i+32]=t10-t11;const z1=(t12+t13)*0.707106781;d[i+16]=t13+z1;d[i+48]=t13-z1;
      t10=t4+t5;t11=t5+t6;t12=t6+t7;
      const z5=(t10-t12)*0.382683433,z2=0.5411961*t10+z5,z4=1.306562965*t12+z5,z3=t11*0.707106781,z11=t7+z3,z13=t7-z3;
      d[i+40]=z13+z2;d[i+24]=z13-z2;d[i+8]=z11+z4;d[i+56]=z11-z4;}
  }
  function jpegGrey(g,Wd,Hd,quality){
    quality=Math.max(1,Math.min(100,quality|0));const sf=quality<50?5000/quality:200-quality*2;
    const qt=new Uint8Array(64),fd=new Float32Array(64),AA=[1,1.387039845,1.306562965,1.175875602,1,0.785694958,0.5411961,0.275899379];
    for(let i=0;i<64;i++){const v=Math.floor((YQ[i]*sf+50)/100);qt[i]=v<1?1:v>255?255:v;}
    for(let r=0,i=0;r<8;r++)for(let c=0;c<8;c++,i++)fd[i]=1/(qt[i]*AA[r]*AA[c]*8);
    const DC=huff(DCB,DCV),AC=huff(ACB,ACV);
    let buf=new Uint8Array(Math.max(8192,(Wd*Hd/4)|0)),pos=0;
    const need=k=>{if(pos+k>buf.length){const nb=new Uint8Array(Math.max((buf.length*1.5)|0,pos+k+4096));nb.set(buf.subarray(0,pos));buf=nb;}};
    const b1=v=>{need(1);buf[pos++]=v;},b2=v=>{need(2);buf[pos++]=(v>>8)&255;buf[pos++]=v&255;};
    b2(0xFFD8);
    b2(0xFFE0);b2(16);[0x4A,0x46,0x49,0x46,0,1,1,0,0,1,0,1,0,0].forEach(b1);
    b2(0xFFDB);b2(67);b1(0);for(let k=0;k<64;k++)b1(qt[ZZ[k]]);
    b2(0xFFC0);b2(11);b1(8);b2(Hd);b2(Wd);b1(1);b1(1);b1(0x11);b1(0);
    b2(0xFFC4);b2(2+1+16+12+1+16+162);b1(0x00);DCB.forEach(b1);DCV.forEach(b1);b1(0x10);ACB.forEach(b1);ACV.forEach(b1);
    b2(0xFFDA);b2(8);b1(1);b1(1);b1(0);b1(0);b1(63);b1(0);
    let bb=0,bn=0;
    const put=(code,len)=>{bb=(bb<<len)|code;bn+=len;while(bn>=8){const v=(bb>>(bn-8))&255;need(2);buf[pos++]=v;if(v===255)buf[pos++]=0;bn-=8;}bb&=(1<<bn)-1;};
    const blk=new Float32Array(64),qv=new Int32Array(64),bw=Math.ceil(Wd/8),bh=Math.ceil(Hd/8);let pdc=0;
    for(let by=0;by<bh;by++)for(let bx=0;bx<bw;bx++){
      for(let y=0;y<8;y++){const sy=Math.min(Hd-1,by*8+y)*Wd;for(let x=0;x<8;x++)blk[y*8+x]=g[sy+Math.min(Wd-1,bx*8+x)]-128;}
      fdct(blk);
      for(let i=0;i<64;i++){const v=blk[i]*fd[i];qv[i]=v>0?(v+0.5)|0:(v-0.5)|0;}
      const diff=qv[0]-pdc;pdc=qv[0];
      if(diff===0)put(DC.code[0],DC.len[0]);else{const c=32-Math.clz32(diff<0?-diff:diff);put(DC.code[c],DC.len[c]);put(diff<0?diff+(1<<c)-1:diff,c);}
      let last=63;while(last>0&&qv[ZZ[last]]===0)last--;let run=0;
      for(let k=1;k<=last;k++){const v=qv[ZZ[k]];if(v===0){run++;continue;}
        while(run>=16){put(AC.code[0xF0],AC.len[0xF0]);run-=16;}
        const c=32-Math.clz32(v<0?-v:v),sym=(run<<4)|c;put(AC.code[sym],AC.len[sym]);put(v<0?v+(1<<c)-1:v,c);run=0;}
      if(last<63)put(AC.code[0],AC.len[0]);}
    if(bn>0)put((1<<(8-bn))-1,8-bn);
    b2(0xFFD9);
    return buf.slice(0,pos);
  }

  /* ---------- photo orientation check (takePhoto vs. what the preview showed) ---------- */
  function ncc(a,b){const n=Math.min(a.length,b.length);let ma=0,mb=0;for(let i=0;i<n;i++){ma+=a[i];mb+=b[i];}ma/=n;mb/=n;
    let sab=0,saa=0,sbb=0;for(let i=0;i<n;i++){const x=a[i]-ma,y=b[i]-mb;sab+=x*y;saa+=x*x;sbb+=y*y;}return saa&&sbb?sab/Math.sqrt(saa*sbb):0;}
  function chooseRot(bmp,bw,bh,ref){
    const refP=ref.h>ref.w,sq=Math.abs(ref.w/ref.h-1)<0.12,ra=ref.w/ref.h;let best=-2,bestR=0,s0=-2;
    for(let r=0;r<4;r++){const cw=r&1?bh:bw,ch=r&1?bw:bh;if(!sq&&(ch>cw)!==refP)continue;
      let cropW=cw,cropH=cw/ra;if(cropH>ch){cropH=ch;cropW=ch*ra;}
      const cv=mkCanvas(ref.w,ref.h),c=ctx2(cv,true),k=ref.w/cropW;c.imageSmoothingEnabled=true;c.imageSmoothingQuality='high';
      c.translate(ref.w/2,ref.h/2);c.scale(k,k);c.rotate(r*Math.PI/2);c.drawImage(bmp,-bw/2,-bh/2);
      const v=ncc(luma(c.getImageData(0,0,ref.w,ref.h).data,ref.w*ref.h),ref.data);free(cv);
      if(r===0)s0=v;if(v>best){best=v;bestR=r;}}
    return (s0>-2&&s0>=best-0.08)?0:bestR;
  }

  /* ---------- operations (worker API) ---------- */
  let cache=null;
  async function prepare(o,prog){
    const bmp=await decode(o.blob),dm=dims(bmp),bw=dm[0],bh=dm[1];
    if(!bw||!bh){closeB(bmp);throw new Error('That picture can’t be read');}
    let r=0,cv;
    try{
      if(o.ref){try{r=chooseRot(bmp,bw,bh,o.ref);}catch(e){r=0;}}
      const s=Math.min(1,(o.maxSide||4096)/Math.max(bw,bh)),Wd=Math.max(1,Math.round((r&1?bh:bw)*s)),Hd=Math.max(1,Math.round((r&1?bw:bh)*s));
      cv=mkCanvas(Wd,Hd);const c=ctx2(cv);c.imageSmoothingEnabled=true;c.imageSmoothingQuality='high';
      c.fillStyle='#fff';c.fillRect(0,0,Wd,Hd);c.translate(Wd/2,Hd/2);c.rotate(r*Math.PI/2);c.scale(s,s);c.drawImage(bmp,-bw/2,-bh/2);
    }finally{closeB(bmp);}
    const Wd=cv.width,Hd=cv.height;if(prog)prog(0.3);
    const blob=await toBlob(cv,'image/jpeg',o.q||0.93);if(prog)prog(0.6);
    const k1=Math.min(1,380/Math.max(Wd,Hd)),sm=grab(cv,0,0,Wd,Hd,Math.max(8,Math.round(Wd*k1)),Math.max(8,Math.round(Hd*k1)));
    const det=detectQuad(sm.data,sm.width,sm.height);
    const k2=Math.min(1,1280/Math.max(Wd,Hd)),md=grab(cv,0,0,Wd,Hd,Math.max(8,Math.round(Wd*k2)),Math.max(8,Math.round(Hd*k2))),mw=md.width,mh=md.height;
    free(cv);
    let q0=null,quad=null,ok=det.ok;
    if(det.ok)q0=det.quad.map(p=>[p[0]*mw/sm.width,p[1]*mh/sm.height]);
    else if(o.hint&&o.hintAspect&&Math.abs(Math.log((Wd/Hd)/o.hintAspect))<0.04)q0=o.hint.map(p=>[p[0]*mw,p[1]*mh]);
    if(q0){const q1=refineQuad(blur(luma(md.data,mw*mh),mw,mh,1),mw,mh,q0);
      if(!det.ok)ok=quadValid(q1,mw,mh,0.12);
      if(ok)quad=q1.map(p=>[clampN(p[0]*Wd/mw,0,Wd),clampN(p[1]*Hd/mh,0,Hd)]);}
    if(!quad)quad=o.whole?[[0,0],[Wd,0],[Wd,Hd],[0,Hd]]:inset(Wd,Hd,0.06);
    if(prog)prog(1);
    return {blob,w:Wd,h:Hd,quad,ok,rot:r,score:det.score};
  }
  async function render(o,prog){
    const bmp=await decode(o.blob),dm=dims(bmp),bw=dm[0],bh=dm[1];let img,Qs,Wd,Hd,a4,sw,sh;
    try{
      const Q=reorder(o.quad,o.rot|0),od=outDims(Q,bw,bh,o.maxLong||2600);Wd=od.W;Hd=od.H;a4=od.a4;
      let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;for(const p of Q){x0=Math.min(x0,p[0]);y0=Math.min(y0,p[1]);x1=Math.max(x1,p[0]);y1=Math.max(y1,p[1]);}
      x0=Math.max(0,Math.floor(x0)-2);y0=Math.max(0,Math.floor(y0)-2);x1=Math.min(bw,Math.ceil(x1)+2);y1=Math.min(bh,Math.ceil(y1)+2);
      if(x1-x0<2||y1-y0<2)throw new Error('The page area is too small');
      const d=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]),ql=Math.max(d(Q[0],Q[1]),d(Q[3],Q[2]),d(Q[0],Q[3]),d(Q[1],Q[2]));
      const s=Math.min(1,1.3*Math.max(Wd,Hd)/ql);sw=Math.max(2,Math.round((x1-x0)*s));sh=Math.max(2,Math.round((y1-y0)*s));
      img=grab(bmp,x0,y0,x1-x0,y1-y0,sw,sh);
      const kx=sw/(x1-x0),ky=sh/(y1-y0);Qs=Q.map(p=>[(p[0]-x0)*kx,(p[1]-y0)*ky]);
    }finally{closeB(bmp);}
    if(prog)prog(0.1);
    const Hm=homog(Qs,[[0,0],[Wd,0],[Wd,Hd],[0,Hd]]);if(!Hm)throw new Error('Those corners can’t be flattened');
    const rgba=warp(img.data,sw,sh,Hm,Wd,Hd,prog?p=>prog(0.1+p*0.6):null);img=null;
    if(o.key)cache={key:o.key,data:rgba,w:Wd,h:Hd};
    const res=filt(rgba,Wd,Hd,o.filter||'orig');if(prog)prog(0.8);
    if(o.out==='rgba'){const data=res.grey?g2rgba(res.grey):(o.key?res.rgba.slice():res.rgba);return {data,w:Wd,h:Hd,gray:!!res.grey,a4};}
    const qq=o.q||{c:0.9,g:90};let blob,thumb=null;
    if(res.grey){blob=new Blob([jpegGrey(res.grey,Wd,Hd,o.filter==='bw'&&qq.bw?qq.bw:qq.g)],{type:'image/jpeg'});
      if(o.thumb){const k=Math.min(1,o.thumb/Math.max(Wd,Hd)),tw=Math.max(8,Math.round(Wd*k)),th=Math.max(8,Math.round(Hd*k));thumb=new Blob([jpegGrey(downBox(res.grey,Wd,Hd,tw,th,1),tw,th,82)],{type:'image/jpeg'});}}
    else{const cv=mkCanvas(Wd,Hd),c=ctx2(cv);c.putImageData(new ImageData(res.rgba,Wd,Hd),0,0);blob=await toBlob(cv,'image/jpeg',qq.c);
      if(o.thumb){const k=Math.min(1,o.thumb/Math.max(Wd,Hd)),tc=mkCanvas(Wd*k,Hd*k),t2=ctx2(tc);t2.imageSmoothingEnabled=true;t2.imageSmoothingQuality='high';t2.drawImage(cv,0,0,tc.width,tc.height);thumb=await toBlob(tc,'image/jpeg',0.8);free(tc);}
      free(cv);}
    if(prog)prog(1);
    return {blob,thumb,w:Wd,h:Hd,gray:!!res.grey,a4};
  }
  function filterOp(o){if(!cache||cache.key!==o.key)throw new Error('Preview expired');
    const r=filt(cache.data,cache.w,cache.h,o.filter);return {data:r.grey?g2rgba(r.grey):(r.rgba===cache.data?cache.data.slice():r.rgba),w:cache.w,h:cache.h,gray:!!r.grey};}
  function thumbsOp(o){if(!cache||cache.key!==o.key)throw new Error('Preview expired');
    const w=cache.w,h=cache.h,k=Math.min(1,(o.size||120)/Math.max(w,h)),tw=Math.max(8,Math.round(w*k)),th=Math.max(8,Math.round(h*k));
    const km=Math.min(1,480/Math.max(w,h)),mw=Math.max(8,Math.round(w*km)),mh=Math.max(8,Math.round(h*km)),md=downBox(cache.data,w,h,mw,mh,4);
    return {list:['orig','color','grey','bw'].map(f=>{const r=filt(md,mw,mh,f),full=r.grey?g2rgba(r.grey):r.rgba;return {f,data:downBox(full,mw,mh,tw,th,4),w:tw,h:th};})};}
  function tx(r){const t=[];if(r&&r.data&&r.data.buffer)t.push(r.data.buffer);if(r&&r.list)r.list.forEach(x=>{if(x.data&&x.data.buffer)t.push(x.data.buffer);});return t;}
  return {
    detect:o=>detectQuad(o.data,o.w,o.h),prepare,render,filter:filterOp,thumbs:thumbsOp,drop:()=>{cache=null;return true;},ping:()=>true,tx,
    lib:{detectQuad,refineQuad,homog,warp,outDims,aspectZH,reorder,jpegGrey,fBW,fColour,fGrey,orderQuad,quadValid,maxFilter,minFilter}
  };
}

/* =====================================================================
   ENGINE HOST — one job at a time, interactive jobs ahead of background ones
   ===================================================================== */
let ENG=null;const eng=()=>ENG||(ENG=ENGINE());
let wk=null,wkURL=null,wkState='off',wkBroken=false,wkSeq=0,wkTimer=0,running=null,jobQ=[];const wkJobs=new Map();
function startWorker(){
  if(wk||wkBroken||typeof Worker==='undefined'){if(!wk&&wkState==='off')wkState=wkBroken||typeof Worker==='undefined'?'main':'off';return;}
  try{
    const src='"use strict";const E=('+ENGINE.toString()+')();\n'
      +'self.onmessage=function(e){const m=e.data;Promise.resolve().then(function(){return E[m.op](m.a,function(p){self.postMessage({id:m.id,p:p});});})'
      +'.then(function(r){self.postMessage({id:m.id,ok:1,r:r},E.tx(r));},function(err){self.postMessage({id:m.id,ok:0,e:String(err&&err.message||err)});});};\n'
      +'self.postMessage({ready:1,oc:typeof OffscreenCanvas!=="undefined"&&typeof createImageBitmap==="function"});';
    wkURL=URL.createObjectURL(new Blob([src],{type:'text/javascript'}));
    wk=new Worker(wkURL);wkState='starting';
    wk.onmessage=onWk;wk.onerror=e=>{try{e.preventDefault();}catch(_){}console.warn('Scanner worker unavailable — using the main thread',e&&e.message);failWorker();};
    wkTimer=setTimeout(()=>{if(wkState==='starting')failWorker();},5000);
  }catch(e){failWorker();}
}
function onWk(e){
  const m=e.data||{};
  if(m.ready){clearTimeout(wkTimer);if(!m.oc){failWorker();return;}wkState='ready';if(wkURL){try{URL.revokeObjectURL(wkURL);}catch(_){}wkURL=null;}pump();return;}
  const j=wkJobs.get(m.id);if(!j)return;
  if(m.p!=null){if(j.prog)try{j.prog(m.p);}catch(_){}return;}
  wkJobs.delete(m.id);if(running===j)running=null;if(m.ok)j.res(m.r);else j.rej(new Error(m.e));pump();
}
function failWorker(){
  clearTimeout(wkTimer);wkBroken=true;wkState='main';
  if(wk){try{wk.terminate();}catch(e){}wk=null;}if(wkURL){try{URL.revokeObjectURL(wkURL);}catch(e){}wkURL=null;}
  const inflight=[...wkJobs.values()];wkJobs.clear();
  if(running&&inflight.indexOf(running)>=0)jobQ.unshift(running);running=null;pump();
}
function stopWorker(){
  clearTimeout(wkTimer);if(wk){try{wk.terminate();}catch(e){}}wk=null;if(wkURL){try{URL.revokeObjectURL(wkURL);}catch(e){}wkURL=null;}
  if(!wkBroken)wkState='off';
  const all=jobQ.concat([...wkJobs.values()]);if(running&&all.indexOf(running)<0)all.push(running);
  jobQ=[];wkJobs.clear();running=null;all.forEach(j=>{try{j.rej(Object.assign(new Error('Scanner closed'),{closed:true}));}catch(e){}});
  ENG=null;
}
function call(op,a,opt){
  opt=opt||{};
  return new Promise((res,rej)=>{
    const j={op,a,res,rej,prio:opt.prio?1:0,prog:opt.progress||null,id:++wkSeq};
    if(j.prio){const i=jobQ.findIndex(x=>!x.prio);if(i<0)jobQ.push(j);else jobQ.splice(i,0,j);}else jobQ.push(j);
    pump();
  });
}
function pump(){
  if(running||!jobQ.length)return;
  if(wkState==='starting')return;
  const j=running=jobQ.shift();
  if(wk&&wkState==='ready'){wkJobs.set(j.id,j);try{wk.postMessage({id:j.id,op:j.op,a:j.a});}catch(e){wkJobs.delete(j.id);running=null;j.rej(e);pump();}return;}
  setTimeout(()=>{Promise.resolve().then(()=>eng()[j.op](j.a,j.prog)).then(r=>{if(running===j)running=null;j.res(r);pump();},e=>{if(running===j)running=null;j.rej(e);pump();});},0);
}

/* =====================================================================
   PDF writer — PDF 1.4, one A4 (or image-sized) page per JPEG, binary-safe, exact xref offsets
   ===================================================================== */
function jpegInfo(b){
  if(!b||b.length<4||b[0]!==0xFF||b[1]!==0xD8)return null;let i=2;
  while(i+9<b.length){if(b[i]!==0xFF){i++;continue;}const m=b[i+1];
    if(m===0xFF){i++;continue;}if(m===0xD8||m===0x01||(m>=0xD0&&m<=0xD7)){i+=2;continue;}
    const len=(b[i+2]<<8)|b[i+3];
    if(m>=0xC0&&m<=0xCF&&m!==0xC4&&m!==0xC8&&m!==0xCC)return {h:(b[i+5]<<8)|b[i+6],w:(b[i+7]<<8)|b[i+8],c:b[i+9]};
    i+=2+len;}
  return null;
}
const pdfNum=v=>String(Math.round(v*100)/100);
function pdfStr(s){s=String(s||'');if(/^[\x20-\x7e]*$/.test(s))return '('+s.replace(/[\\()]/g,'\\$&')+')';
  let h='FEFF';for(let i=0;i<s.length;i++)h+=s.charCodeAt(i).toString(16).toUpperCase().padStart(4,'0');return '<'+h+'>';}
function pdfDate(d){const o=-d.getTimezoneOffset(),oa=Math.abs(o);
  return 'D:'+d.getFullYear()+p2(d.getMonth()+1)+p2(d.getDate())+p2(d.getHours())+p2(d.getMinutes())+p2(d.getSeconds())+(o<0?'-':'+')+p2(Math.floor(oa/60))+"'"+p2(oa%60)+"'";}
async function buildPdf(list,opt){ /* list: [{bytes:Uint8Array}] or [{blob}] ; opt: {size:'a4'|'fit', title} */
  const enc=s=>{const a=new Uint8Array(s.length);for(let i=0;i<s.length;i++)a[i]=s.charCodeAt(i)&255;return a;};
  const parts=[],off=[];let pos=0;
  const put=x=>{const b=typeof x==='string'?enc(x):x;parts.push(b);pos+=b.length;};
  const obj=(i,s)=>{off[i]=pos;put(i+' 0 obj\n'+s+'\nendobj\n');};
  const n=list.length,N=3+3*n,now=new Date(),A4W=595.28,A4H=841.89,M=14.17;
  put('%PDF-1.4\n%âãÏÓ\n');
  obj(1,'<< /Type /Catalog /Pages 2 0 R >>');
  obj(2,'<< /Type /Pages /Kids ['+list.map((_,k)=>(4+3*k)+' 0 R').join(' ')+'] /Count '+n+' >>');
  obj(3,'<< /Title '+pdfStr(opt.title)+' /Producer (Garda Reference) /Creator (Garda Reference Scanner) /CreationDate ('+pdfDate(now)+') /ModDate ('+pdfDate(now)+') >>');
  for(let k=0;k<n;k++){
    const it=list[k],bytes=it.bytes||new Uint8Array(await it.blob.arrayBuffer()),info=jpegInfo(bytes);
    if(!info||!info.w||!info.h)throw new Error('Page '+(k+1)+' image is damaged');
    const w=info.w,h=info.h,c=info.c,cs=c===1?'/DeviceGray':c===4?'/DeviceCMYK':'/DeviceRGB';
    let pw,ph,x,y,dw,dh;
    if(opt.size==='fit'){if(h>=w){ph=A4H;pw=A4H*w/h;}else{pw=A4H;ph=A4H*h/w;}x=0;y=0;dw=pw;dh=ph;}
    else{const land=w>h;pw=land?A4H:A4W;ph=land?A4W:A4H;const s=Math.min((pw-2*M)/w,(ph-2*M)/h);dw=w*s;dh=h*s;x=(pw-dw)/2;y=(ph-dh)/2;}
    const pi=4+3*k,ci=pi+1,ii=pi+2,cs2='q '+pdfNum(dw)+' 0 0 '+pdfNum(dh)+' '+pdfNum(x)+' '+pdfNum(y)+' cm /Im1 Do Q';
    obj(pi,'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 '+pdfNum(pw)+' '+pdfNum(ph)+'] /Resources << /XObject << /Im1 '+ii+' 0 R >> /ProcSet [/PDF '+(c===1?'/ImageB':'/ImageC')+'] >> /Contents '+ci+' 0 R >>');
    obj(ci,'<< /Length '+cs2.length+' >>\nstream\n'+cs2+'\nendstream');
    off[ii]=pos;
    put(ii+' 0 obj\n<< /Type /XObject /Subtype /Image /Width '+w+' /Height '+h+' /ColorSpace '+cs+' /BitsPerComponent 8 /Filter /DCTDecode'+(c===4?' /Decode [1 0 1 0 1 0 1 0]':'')+' /Length '+bytes.length+' >>\nstream\n');
    put(bytes);put('\nendstream\nendobj\n');
  }
  const xref=pos;let xs='xref\n0 '+(N+1)+'\n0000000000 65535 f \n';for(let i=1;i<=N;i++)xs+=String(off[i]).padStart(10,'0')+' 00000 n \n';
  let id='';for(let i=0;i<16;i++)id+=((Math.random()*256)|0).toString(16).padStart(2,'0');
  put(xs+'trailer\n<< /Size '+(N+1)+' /Root 1 0 R /Info 3 0 R /ID [<'+id+'> <'+id+'>] >>\nstartxref\n'+xref+'\n%%EOF\n');
  return new Blob(parts,{type:'application/pdf'});
}

/* ---------- icons (stroke line art, currentColor) ---------- */
const IC={
  info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6"/><path d="M12 7.4v.2" stroke-width="2.6"/>',
  torch:'<path d="M8 2.5h8v4.2l-2 3V20a1.5 1.5 0 0 1-1.5 1.5h-1A1.5 1.5 0 0 1 10 20V9.7l-2-3z"/><path d="M8 6.7h8M12 12.5V15"/>',
  auto:'<path d="M4 8V5.5A1.5 1.5 0 0 1 5.5 4H8M16 4h2.5A1.5 1.5 0 0 1 20 5.5V8M20 16v2.5a1.5 1.5 0 0 1-1.5 1.5H16M8 20H5.5A1.5 1.5 0 0 1 4 18.5V16"/><path d="M8.8 15.5 12 8l3.2 7.5M9.9 13h4.2"/>',
  image:'<rect x="3" y="4.5" width="18" height="15" rx="2"/><circle cx="8.5" cy="9.5" r="1.8"/><path d="m21 16-5.2-5.2L6 19.5"/>',
  pages:'<rect x="7.5" y="3" width="12.5" height="16" rx="1.6"/><path d="M4.5 7v12.5A1.5 1.5 0 0 0 6 21h10.5"/><path d="M10.5 7.5h6.5M10.5 11h6.5M10.5 14.5h4"/>',
  detect:'<path d="M4 8V5.5A1.5 1.5 0 0 1 5.5 4H8M16 4h2.5A1.5 1.5 0 0 1 20 5.5V8M20 16v2.5a1.5 1.5 0 0 1-1.5 1.5H16M8 20H5.5A1.5 1.5 0 0 1 4 18.5V16"/><path d="m8.2 8.6 7.3-1 1 7.3-7.3 1z"/>',
  whole:'<rect x="4" y="4" width="16" height="16" rx="1.5"/><path d="M8 8h.01M16 8h.01M16 16h.01M8 16h.01" stroke-width="3"/>',
  rotate:'<path d="M20 11.5A8 8 0 1 1 17.6 6"/><path d="M20 3.8V9h-5.2"/>',
  camera:'<path d="M3 8.3A1.3 1.3 0 0 1 4.3 7h2.9l1.8-2.5h6L16.8 7h2.9A1.3 1.3 0 0 1 21 8.3v10.4a1.3 1.3 0 0 1-1.3 1.3H4.3A1.3 1.3 0 0 1 3 18.7z"/><circle cx="12" cy="13.3" r="3.8"/>',
  next:'<path d="M5 12h13M13 6l6 6-6 6"/>',
  check:'<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  up:'<path d="M12 19V5M6 11l6-6 6 6"/>',
  down:'<path d="M12 5v14M6 13l6 6 6-6"/>',
  trash:'<path d="M4 6.5h16M9.5 6.5V4.2h5v2.3M6 6.5l1 13.3a1.5 1.5 0 0 0 1.5 1.4h7a1.5 1.5 0 0 0 1.5-1.4l1-13.3M10 10.5v6.5M14 10.5v6.5"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',
  pdf:'<path d="M14 3H6.5A1.5 1.5 0 0 0 5 4.5v15A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5V8z"/><path d="M14 3v5h5M8.5 13h7M8.5 16.5h5"/>',
  download:'<path d="M12 3.5v12M7 10.5l5 5 5-5M4.5 20.5h15"/>',
  shield:'<path d="M12 2.8 4.5 5.6v5.8c0 4.4 3.1 8.2 7.5 9.8 4.4-1.6 7.5-5.4 7.5-9.8V5.6z"/><path d="M12 7.8v5.4"/><path d="M12 16.2v.2" stroke-width="2.6"/>',
  crop:'<path d="M6.5 2.5v14a1 1 0 0 0 1 1h14"/><path d="M2.5 6.5h14a1 1 0 0 1 1 1v14"/>'
};

/* =====================================================================
   OVERLAY SHELL
   ===================================================================== */
let ov=null,mainEl=null,ttlEl=null,toastEl=null,shadeEl=null,sheetEl=null,busyEl=null,toastT=0,listening=false,epoch=0;
function build(){
  if(ov&&ov.isConnected)return;
  if(!D.querySelector('link[href*="scanner.css"]')){const l=D.createElement('link');l.rel='stylesheet';l.href='scanner.css';D.head.appendChild(l);}
  ov=el('<div id="scn" class="scn" role="dialog" aria-modal="true" aria-label="Document scanner" tabindex="-1" hidden>'
    +'<div class="scn-top"><button type="button" class="scn-back" aria-label="Back">‹ Back</button>'
    +'<div class="scn-tt"><b class="scn-title">Scanner</b><span class="hudclock" data-f="line"></span></div>'
    +'<button type="button" class="scn-ib scn-info" aria-label="Where scans are saved">'+svg(IC.info)+'</button></div>'
    +'<div class="scn-main"></div>'
    +'<div class="scn-busy" hidden><div class="scn-bcard" role="status" aria-live="polite"><span class="scn-spin" aria-hidden="true"></span><b class="scn-btxt">Working…</b><div class="scn-bbar"><i></i></div></div></div>'
    +'<div class="scn-shade" hidden></div><div class="scn-sheet" role="dialog" aria-modal="true" hidden></div>'
    +'<div class="scn-toast" role="status" aria-live="polite"></div></div>');
  D.body.appendChild(ov);
  mainEl=q(ov,'.scn-main');ttlEl=q(ov,'.scn-title');toastEl=q(ov,'.scn-toast');shadeEl=q(ov,'.scn-shade');sheetEl=q(ov,'.scn-sheet');busyEl=q(ov,'.scn-busy');
  q(ov,'.scn-back').addEventListener('click',()=>scnBack());
  q(ov,'.scn-info').addEventListener('click',()=>noticeSheet(false));
  shadeEl.addEventListener('click',()=>closeSheet());
}
function hideToast(){if(!toastEl)return;clearTimeout(toastT);toastEl.classList.remove('scn-on');}
function toastPos(){ /* just above the bottom bar of the current screen (above the hint on the camera); at the top while a sheet is open */
  if(sheetEl&&!sheetEl.hidden){toastEl.style.top='calc(70px + env(safe-area-inset-top,0px))';toastEl.style.bottom='auto';return;}
  const bar=mainEl&&q(mainEl,'.scn-bar,.scn-cbar');let b=16;
  if(bar){const r=bar.getBoundingClientRect(),o=ov.getBoundingClientRect();b=Math.max(16,o.bottom-r.top+12);if(view==='cam')b+=54;}
  toastEl.style.top='auto';toastEl.style.bottom=Math.round(b)+'px';
}
function toast(m,act){
  if(!toastEl){if(W.grToast)W.grToast(m);return;}
  toastPos();
  toastEl.innerHTML='<span>'+esc(m)+'</span>'+(act?'<button type="button" class="scn-tact">'+esc(act.label)+'</button>':'');
  toastEl.classList.toggle('scn-hasact',!!act);toastEl.classList.add('scn-on');
  if(act)q(toastEl,'.scn-tact').onclick=()=>{toastEl.classList.remove('scn-on');clearTimeout(toastT);try{act.fn();}catch(e){console.error(e);}};
  clearTimeout(toastT);toastT=setTimeout(()=>{if(toastEl)toastEl.classList.remove('scn-on');if(act&&act.expire)try{act.expire();}catch(e){}},act?5200:3000);
}
let sheetOnClose=null;
function sheet(html,wire,onClose){
  if(sheetOnClose){const f=sheetOnClose;sheetOnClose=null;try{f();}catch(e){}}
  hideToast();sheetEl.innerHTML='';const box=D.createElement('div');box.className='scn-sin';
  box.innerHTML='<div class="scn-grip"></div>'+html;sheetEl.appendChild(box);sheetEl.hidden=false;shadeEl.hidden=false;sheetOnClose=onClose||null;
  qa(box,'.scn-x').forEach(b=>b.addEventListener('click',()=>closeSheet()));
  if(wire)wire(box);sheetEl.scrollTop=0;hud();
}
function closeSheet(){
  if(!sheetEl||sheetEl.hidden)return;
  sheetEl.hidden=true;sheetEl.innerHTML='';shadeEl.hidden=true;
  if(sheetOnClose){const f=sheetOnClose;sheetOnClose=null;try{f();}catch(e){}}
}
let busySince=0;
function busy(txt,p){
  if(!busyEl)return;if(busyEl.hidden)busySince=Date.now();busyEl.hidden=false;q(busyEl,'.scn-btxt').textContent=txt||'Working…';
  const bar=q(busyEl,'.scn-bbar');bar.hidden=p==null;if(p!=null)q(bar,'i').style.width=Math.round(clamp(p,0,1)*100)+'%';
}
function unbusy(){if(busyEl)busyEl.hidden=true;}
function onKey(e){if(e.key!=='Escape'||!ov||ov.hidden)return;e.preventDefault();e.stopPropagation();scnBack();}
let hiddenCam=false;
function onVis(){
  if(!ov||ov.hidden)return;
  if(D.visibilityState==='hidden'){if(view==='cam'&&vs){vs.end();vs=null;cam=null;hiddenCam=true;}}
  else if(hiddenCam){hiddenCam=false;if(view==='cam')goCam();}
}
function listen(on){
  if(on===listening)return;listening=on;const f=on?'addEventListener':'removeEventListener';
  W[f]('keydown',onKey,true);D[f]('visibilitychange',onVis);
}

/* =====================================================================
   STATE
   ===================================================================== */
let pages=[],pagesVer=0,savedVer=0,savedAt=0,view=null,vs=null,cam=null,crop=null,enh=null,draft=null,replaceIdx=-1,exporting=false,undoDel=null,lastCap=null;
let lastFilter=LSget('filter','color');if(!FILTERS.some(f=>f[0]===lastFilter))lastFilter='color';
const dlURLs=new Set();
const unsaved=()=>pages.length>0&&pagesVer!==savedVer;
function setView(v,title){
  if(vs){vs.end();vs=null;}cam=null;crop=null;enh=null;hideToast();
  view=v;vs=mkSess();ttlEl.textContent=title;mainEl.textContent='';ov.dataset.v=v;hud();return vs;
}
function mkDraft(r,o){return Object.assign({src:r.blob,w:r.w,h:r.h,quad:r.quad.map(p=>p.slice()),auto:r.ok?r.quad.map(p=>p.slice()):null,rot:0,filter:lastFilter,edit:-1,replace:-1},o||{});}
function mkPage(src){return {id:uid(),src:src.src||src.blob,w:src.w,h:src.h,quad:src.quad.map(p=>p.slice()),auto:src.auto!==undefined?src.auto:(src.ok?src.quad.map(p=>p.slice()):null),
  rot:src.rot|0,filter:src.filter||lastFilter,out:null,ow:0,oh:0,gray:false,thumb:null,job:null,ver:0,err:null,dead:false};}
function setThumb(p,blob){if(!blob||p.dead)return;const u=URL.createObjectURL(blob);if(p.thumb)try{URL.revokeObjectURL(p.thumb);}catch(e){}p.thumb=u;}
function dropPage(p){if(!p)return;p.dead=true;if(p.thumb){try{URL.revokeObjectURL(p.thumb);}catch(e){}p.thumb=null;}p.out=null;p.src=null;}
function queueRender(p){
  const ver=++p.ver,ep=epoch;p.out=null;p.err=null;
  p.job=call('render',{blob:p.src,quad:p.quad,rot:p.rot,filter:p.filter,maxLong:HIGH,out:'jpeg',q:JQ.high,thumb:360},{prio:0})
    .then(r=>{if(p.dead||p.ver!==ver||ep!==epoch)return;p.out=r.blob;p.ow=r.w;p.oh=r.h;p.gray=r.gray;setThumb(p,r.thumb);p.job=null;pageChanged(p);})
    .catch(e=>{if(p.dead||p.ver!==ver||ep!==epoch)return;p.job=null;p.err=errMsg(e);pageChanged(p);});
  return p.job;
}
function pageChanged(p){
  if(view==='cam')updStack();
  else if(view==='pages'){const c=q(mainEl,'.scn-card[data-id="'+p.id+'"]');if(c&&!c.classList.contains('scn-ph')){const i=pages.indexOf(p);if(i>=0)c.replaceWith(el(cardHtml(p,i)));}}
}
function previewThumb(p,cv){ /* quick thumbnail from the enhance preview until the full render is ready */
  try{const k=Math.min(1,360/Math.max(cv.width,cv.height)),t=D.createElement('canvas');t.width=Math.max(1,Math.round(cv.width*k));t.height=Math.max(1,Math.round(cv.height*k));
    const c=t.getContext('2d');c.imageSmoothingQuality='high';c.drawImage(cv,0,0,t.width,t.height);
    t.toBlob(b=>{if(b&&!p.thumb)setThumb(p,b);if(b)pageChanged(p);t.width=t.height=1;},'image/jpeg',0.8);}catch(e){}
}

/* =====================================================================
   CAMERA SCREEN
   ===================================================================== */
function openCam(s,host){
  const v=D.createElement('video');v.setAttribute('playsinline','');v.setAttribute('muted','');v.muted=true;v.autoplay=true;
  host.insertBefore(v,host.firstChild);
  const md=navigator.mediaDevices;
  if(!md||!md.getUserMedia)return Promise.reject(Object.assign(new Error(W.isSecureContext?'This browser cannot use the camera.':'The camera needs the app to be opened over https.'),{name:'NoCam'}));
  return md.getUserMedia({audio:false,video:{facingMode:'environment',width:{ideal:3840},height:{ideal:2160}}})
    .catch(e=>{if(e&&(e.name==='OverconstrainedError'||e.name==='ConstraintNotSatisfiedError'||e.name==='TypeError'))return md.getUserMedia({audio:false,video:{facingMode:'environment'}});throw e;})
    .then(st=>{
      const tracks=st.getTracks(),stop=()=>{tracks.forEach(t=>{try{t.stop();}catch(e){}});try{v.srcObject=null;}catch(e){}};
      if(!s.alive){stop();throw Object.assign(new Error('closed'),{name:'Closed'});}
      s.clean(stop);v.srcObject=st;const pr=v.play();if(pr&&pr.catch)pr.catch(()=>{});
      const track=st.getVideoTracks()[0],c={v,st,track,caps:{}};
      const rc=()=>{try{c.caps=(track.getCapabilities&&track.getCapabilities())||{};}catch(e){c.caps={};}};rc();
      return new Promise(res=>{let done=false;const fin=()=>{if(done)return;done=true;setTimeout(()=>{rc();res(c);},250);};
        if(v.readyState>=1)fin();else{v.addEventListener('loadedmetadata',fin,{once:true});setTimeout(fin,2500);}});
    });
}
function camErr(e){
  const n=e&&e.name;
  if(n==='NotAllowedError'||n==='SecurityError'||n==='PermissionDeniedError')return 'Camera permission was refused. Allow the camera for this site (Chrome › site settings), then reopen the scanner.';
  if(n==='NotFoundError'||n==='OverconstrainedError'||n==='DevicesNotFoundError')return 'No suitable camera was found on this device.';
  if(n==='NotReadableError'||n==='TrackStartError')return 'The camera is in use by another app. Close it and try again.';
  return (e&&e.message)||'Camera unavailable.';
}
function stackInner(){
  const n=pages.length,p=pages[n-1];
  return '<span class="scn-sth">'+(p&&p.thumb?'<img src="'+esc(p.thumb)+'" alt="" draggable="false">':svg(IC.pages))+(n&&pages.some(x=>x.job)?'<i class="scn-sspin" aria-hidden="true"></i>':'')+'</span>'
    +(n?'<b class="scn-stc">'+n+'</b>':'')+'<span class="scn-stl">'+(n?'Pages':'No pages')+'</span>';
}
function updStack(bump){
  if(view!=='cam')return;const b=q(mainEl,'.scn-stack');if(!b)return;
  b.innerHTML=stackInner();b.disabled=!pages.length;b.setAttribute('aria-label',pages.length?'Pages ('+pages.length+')':'No pages yet');
  if(bump){b.classList.remove('scn-bump');void b.offsetWidth;b.classList.add('scn-bump');}
}
function goCam(){
  const s=setView('cam',replaceIdx>=0?'Retake page '+(replaceIdx+1):'Scan document');
  const canAuto=replaceIdx<0,auto=canAuto&&!!LSget('auto',false);
  mainEl.innerHTML='<div class="scn-cam"><div class="scn-view"><canvas class="scn-ovl" aria-hidden="true"></canvas><div class="scn-flash"></div>'
    +'<p class="scn-cammsg">Starting the camera…</p><div class="scn-hint" aria-live="polite"></div>'
    +'<div class="scn-ctop">'+(canAuto?'<button type="button" class="scn-pill scn-autob'+(auto?' scn-on':'')+'" aria-pressed="'+auto+'">'+svg(IC.auto)+'<span>Auto</span></button>':'<span></span>')
    +'<button type="button" class="scn-pill scn-torch" aria-pressed="false" disabled>'+svg(IC.torch)+'<span>Torch</span></button></div></div>'
    +'<div class="scn-cbar"><button type="button" class="scn-side scn-imp">'+svg(IC.image)+'<span>Import</span></button>'
    +'<div class="scn-shw"><svg class="scn-ring" viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="46"/></svg><button type="button" class="scn-shutter" aria-label="Capture page" disabled></button></div>'
    +'<button type="button" class="scn-side scn-stack"></button>'
    +'<input type="file" class="scn-file" accept="image/*" multiple tabindex="-1" aria-hidden="true"></div></div>';
  updStack();
  const view_=q(mainEl,'.scn-view'),msg=q(view_,'.scn-cammsg'),ovl=q(view_,'.scn-ovl'),hint=q(view_,'.scn-hint'),shut=q(mainEl,'.scn-shutter'),ring=q(mainEl,'.scn-ring circle'),fileIn=q(mainEl,'.scn-file');
  const C={s,v:null,track:null,caps:{},ic:null,pc:undefined,torch:false,auto,det:null,disp:null,alpha:0,stable:0,armed:true,pause:0,lastQ:null,capQ:null,capSig:null,shooting:false,lastFrame:null,lostSince:performance.now(),hintTxt:''};
  cam=C;
  q(mainEl,'.scn-imp').addEventListener('click',()=>{fileIn.value='';fileIn.click();});
  fileIn.addEventListener('change',()=>{const fs=Array.from(fileIn.files||[]);fileIn.value='';if(fs.length)importFiles(fs);});
  q(mainEl,'.scn-stack').addEventListener('click',()=>{if(pages.length){if(replaceIdx>=0)replaceIdx=-1;goPages();}});
  shut.addEventListener('click',()=>shoot(false));
  const ab=q(mainEl,'.scn-autob');
  if(ab)ab.addEventListener('click',()=>{C.auto=!C.auto;LSset('auto',C.auto);ab.classList.toggle('scn-on',C.auto);ab.setAttribute('aria-pressed',String(C.auto));
    C.stable=performance.now();C.armed=true;C.pause=0;toast(C.auto?'Auto-capture on — hold the phone still over each page':'Auto-capture off');});
  openCam(s,view_).then(c=>{
    C.v=c.v;C.track=c.track;C.caps=c.caps||{};msg.hidden=true;shut.disabled=false;
    const tb=q(mainEl,'.scn-torch');
    if(C.caps.torch){tb.disabled=false;tb.addEventListener('click',()=>{C.torch=!C.torch;setTorch(C,C.torch);tb.classList.toggle('scn-on',C.torch);tb.setAttribute('aria-pressed',String(C.torch));});
      s.clean(()=>{if(C.torch)setTorch(C,false);});}
    else{tb.title='This camera has no torch';q(tb,'span').textContent='No torch';}
    try{const fm=C.caps.focusMode;if(fm&&fm.indexOf&&fm.indexOf('continuous')>=0)C.track.applyConstraints({advanced:[{focusMode:'continuous'}]}).catch(()=>{});}catch(e){}
    if(typeof ImageCapture!=='undefined'){try{C.ic=new ImageCapture(C.track);withTimeout(C.ic.getPhotoCapabilities(),2500).then(pc=>{C.pc=pc;},()=>{C.pc=null;});}catch(e){C.ic=null;}}
    detLoop(C);
  }).catch(e=>{if(!s.alive)return;msg.textContent=camErr(e)+' You can still import photos from the gallery.';msg.classList.add('scn-err');});
  /* overlay: smoothed outline, auto-capture countdown */
  s.loop(()=>{
    const f=cvFit(ovl),c=f.c,w=f.w,h=f.h;c.clearRect(0,0,w,h);const v=C.v;if(!v||!v.videoWidth)return;
    const R=contentRect(v,w,h),now=performance.now();
    if(C.det){if(!C.disp)C.disp=C.det.map(p=>p.slice());else for(let i=0;i<4;i++){C.disp[i][0]+=(C.det[i][0]-C.disp[i][0])*0.3;C.disp[i][1]+=(C.det[i][1]-C.disp[i][1])*0.3;}C.alpha=Math.min(1,C.alpha+0.12);}
    else C.alpha=Math.max(0,C.alpha-0.07);
    const paused=now<C.pause;let prog=0;
    if(C.auto&&C.det&&C.armed&&!paused&&!C.shooting&&C.stable){prog=Math.min(1,(now-C.stable)/1500);if(prog>=1){prog=0;shoot(true);}}
    if(C.disp&&C.alpha>0.01){
      const P=C.disp.map(p=>[R.x+p[0]*R.w,R.y+p[1]*R.h]),green=prog>0||paused;
      c.save();c.globalAlpha=C.alpha;c.beginPath();c.moveTo(P[0][0],P[0][1]);for(let i=1;i<4;i++)c.lineTo(P[i][0],P[i][1]);c.closePath();
      c.fillStyle=green?'rgba(52,199,104,.22)':'rgba(212,175,55,.2)';c.fill();
      c.lineJoin='round';c.lineWidth=5;c.strokeStyle='rgba(0,0,0,.45)';c.stroke();c.lineWidth=3;c.strokeStyle=green?'#34c768':'#d4af37';c.stroke();
      c.fillStyle=green?'#34c768':'#d4af37';P.forEach(p=>{c.beginPath();c.arc(p[0],p[1],6,0,7);c.fill();});
      if(prog>0){const cx=(P[0][0]+P[1][0]+P[2][0]+P[3][0])/4,cy=(P[0][1]+P[1][1]+P[2][1]+P[3][1])/4;
        c.globalAlpha=1;c.lineWidth=7;c.strokeStyle='rgba(5,10,20,.6)';c.beginPath();c.arc(cx,cy,30,0,7);c.stroke();
        c.strokeStyle='#34c768';c.lineCap='round';c.beginPath();c.arc(cx,cy,30,-Math.PI/2,-Math.PI/2+prog*Math.PI*2);c.stroke();}
      c.restore();}
    ring.style.strokeDashoffset=String(289.03*(1-prog));
    let t='';
    if(C.shooting&&!C.auto)t='Capturing…';
    else if(paused)t='Captured page '+pages.length+' — next page';
    else if(!C.det)t=now-C.lostSince>5000?'Tip: put the page on a darker surface':'Looking for the page edges…';
    else if(C.auto)t=C.armed?'Hold still…':'Turn to the next page';
    else t='Page found — tap the button';
    if(t!==C.hintTxt){C.hintTxt=t;hint.textContent=t;hint.classList.toggle('scn-ok',!!C.det);}
  });
}
function setTorch(C,on){try{C.track.applyConstraints({advanced:[{torch:!!on}]}).catch(()=>{});}catch(e){}}
function qdiff(a,b){let m=0;for(let i=0;i<4;i++)m=Math.max(m,Math.hypot(a[i][0]-b[i][0],a[i][1]-b[i][1]));return m;}
function frameSig(f){if(!f)return null;const W2=16,H2=12,o=new Float32Array(W2*H2),c=new Float32Array(W2*H2);
  for(let y=0;y<f.h;y++)for(let x=0;x<f.w;x++){const i=(y*f.w+x)*4,k=Math.min(H2-1,(y*H2/f.h)|0)*W2+Math.min(W2-1,(x*W2/f.w)|0);o[k]+=f.data[i]*0.3+f.data[i+1]*0.59+f.data[i+2]*0.11;c[k]++;}
  for(let i=0;i<o.length;i++)o[i]/=c[i]||1;return o;}
function sigDiff(a,b){if(!a||!b)return 999;let s=0;for(let i=0;i<a.length;i++)s+=Math.abs(a[i]-b[i]);return s/a.length;}
function detLoop(C){
  const s=C.s,cv=D.createElement('canvas'),cx=cv.getContext('2d',{willReadFrequently:true});
  const step=()=>{
    if(!s.alive)return;const v=C.v;
    if(!v||v.readyState<2||!v.videoWidth||D.hidden){s.after(300,step);return;}
    const vw=v.videoWidth,vh=v.videoHeight,k=320/Math.max(vw,vh),w=Math.max(16,Math.round(vw*k)),h=Math.max(16,Math.round(vh*k)),t0=performance.now();
    if(cv.width!==w||cv.height!==h){cv.width=w;cv.height=h;}
    let r=null;
    try{cx.drawImage(v,0,0,w,h);const id=cx.getImageData(0,0,w,h);C.lastFrame={data:id.data,w,h};r=eng().detect({data:id.data,w,h});}catch(e){r=null;}
    if(r)onDet(C,r,w,h);C.detMs=performance.now()-t0;
    s.after(Math.max(100,320-C.detMs),step);
  };
  s.after(150,step);
}
function onDet(C,r,w,h){
  const now=performance.now(),nq=r.ok?r.quad.map(p=>[p[0]/w,p[1]/h]):null;C.det=nq;C.lastScore=r.score;
  if(!nq){C.stable=0;C.lastQ=null;C.armed=true;if(!C.lostSince)C.lostSince=now;return;}
  C.lostSince=0;
  if(!(C.lastQ&&qdiff(nq,C.lastQ)<0.022))C.stable=now;
  C.lastQ=nq;
  if(!C.armed&&now>C.pause&&((C.capQ&&qdiff(nq,C.capQ)>0.08)||sigDiff(frameSig(C.lastFrame),C.capSig)>14)){C.armed=true;C.stable=now;}
}
function refFrame(v){
  try{const vw=v.videoWidth,vh=v.videoHeight,k=48/Math.max(vw,vh),w=Math.max(8,Math.round(vw*k)),h=Math.max(8,Math.round(vh*k));
    const cv=D.createElement('canvas');cv.width=w;cv.height=h;const c=cv.getContext('2d',{willReadFrequently:true});c.drawImage(v,0,0,w,h);
    const d=c.getImageData(0,0,w,h).data,g=new Uint8Array(w*h);for(let i=0,j=0;i<w*h;i++,j+=4)g[i]=(d[j]*77+d[j+1]*150+d[j+2]*29)>>8;return {data:g,w,h};}catch(e){return null;}
}
function frameBlob(v){
  const cv=D.createElement('canvas');cv.width=v.videoWidth;cv.height=v.videoHeight;cv.getContext('2d').drawImage(v,0,0);
  return new Promise((res,rej)=>cv.toBlob(b=>{cv.width=cv.height=1;b?res(b):rej(new Error('Capture failed'));},'image/jpeg',0.95));
}
async function takePhoto(C){
  if(!C.ic||!C.track||C.track.readyState!=='live')return null;
  if(C.pc===undefined){try{C.pc=await withTimeout(C.ic.getPhotoCapabilities(),1500);}catch(e){C.pc=null;}}
  let set;const pc=C.pc;
  if(pc&&pc.imageWidth&&pc.imageWidth.max&&pc.imageHeight&&pc.imageHeight.max){const mw=pc.imageWidth.max,mh=pc.imageHeight.max,k=Math.min(1,4032/Math.max(mw,mh));set={imageWidth:Math.round(mw*k),imageHeight:Math.round(mh*k)};}
  try{return await withTimeout(C.ic.takePhoto(set),8000);}
  catch(e){if(set){try{return await withTimeout(C.ic.takePhoto(),8000);}catch(e2){}}return null;}
}
async function shoot(auto){
  const C=cam;if(!C||C.shooting||!C.v||!C.v.videoWidth||exporting)return;
  C.shooting=true;const s=C.s,ep=epoch,fl=q(mainEl,'.scn-flash');
  if(fl){fl.classList.add('scn-on');s.after(90,()=>fl.classList.remove('scn-on'));}vib(auto?[15,50,15]:25);
  const v=C.v,ref=refFrame(v),hint=C.det?C.det.map(p=>p.slice()):null,hintAspect=v.videoWidth/v.videoHeight;
  if(auto){C.pause=performance.now()+2000;C.armed=false;C.capQ=hint;C.capSig=frameSig(C.lastFrame);}
  else busy('Capturing…');
  let blob=null,via='takePhoto';
  try{blob=await takePhoto(C);}catch(e){blob=null;}
  if(!blob&&s.alive&&C.v&&C.v.videoWidth){via='video frame';try{blob=await frameBlob(C.v);}catch(e){blob=null;}}
  lastCap={via,bytes:blob?blob.size:0,at:Date.now()};
  if(C.torch&&s.alive)setTorch(C,true);
  if(ep!==epoch)return;
  if(!blob){C.shooting=false;unbusy();toast('Capture failed — try again');return;}
  if(auto){C.shooting=false;batchAdd(blob,ref,hint,hintAspect);return;}
  busy('Finding the page edges…');
  let r;
  try{r=await call('prepare',{blob,ref,hint,hintAspect,maxSide:SRCMAX,q:0.93},{prio:1});}
  catch(e){if(ep===epoch){unbusy();C.shooting=false;if(!e.closed)toast(errMsg(e));}return;}
  unbusy();C.shooting=false;
  if(ep!==epoch||view!=='cam')return;
  draft=mkDraft(r,{replace:replaceIdx});goCrop();
}
function batchAdd(blob,ref,hint,hintAspect){
  const ep=epoch;
  call('prepare',{blob,ref,hint,hintAspect,maxSide:SRCMAX,q:0.93},{prio:1}).then(r=>{
    if(ep!==epoch)return;
    const p=mkPage(Object.assign({},r,{filter:lastFilter}));pages.push(p);pagesVer++;queueRender(p);updStack(true);
    if(!r.ok)toast('Page '+pages.length+' added — edges unclear, check it in Pages');
  }).catch(e=>{if(ep===epoch&&!e.closed)toast('Capture failed: '+errMsg(e));});
}
async function importFiles(fs){
  const ep=epoch;fs=fs.filter(f=>!f.type||/^image\//.test(f.type));
  if(!fs.length){toast('Choose photos (JPEG or PNG)');return;}
  if(fs.length===1){
    busy('Opening the photo…');
    try{const r=await call('prepare',{blob:fs[0],maxSide:SRCMAX,q:0.93,whole:true},{prio:1});if(ep!==epoch)return;unbusy();
      draft=mkDraft(r,{replace:replaceIdx});goCrop();}
    catch(e){if(ep===epoch){unbusy();if(!e.closed)toast(errMsg(e));}}
    return;
  }
  let n=0;
  for(let i=0;i<fs.length;i++){
    if(ep!==epoch)return;busy('Importing photo '+(i+1)+' of '+fs.length+'…',i/fs.length);
    try{const r=await call('prepare',{blob:fs[i],maxSide:SRCMAX,q:0.93,whole:true},{prio:1});if(ep!==epoch)return;
      const p=mkPage(Object.assign({},r,{filter:lastFilter}));pages.push(p);pagesVer++;queueRender(p);n++;}
    catch(e){if(e.closed||ep!==epoch)return;toast('Photo '+(i+1)+': '+errMsg(e));await sleep(1200);}
  }
  unbusy();if(ep!==epoch)return;
  if(replaceIdx>=0)replaceIdx=-1;
  toast(n?plural(n,'page')+' imported — check the corners if needed':'No photos could be imported');
  if(n)goPages();
}

/* =====================================================================
   CROP SCREEN — 4 corner + 4 edge handles, magnifier, auto-detect / whole image / rotate
   ===================================================================== */
function quadGood(qd,w,h){
  for(let i=0;i<4;i++){const a=qd[i],b=qd[(i+1)%4],c=qd[(i+2)%4];if((b[0]-a[0])*(c[1]-b[1])-(b[1]-a[1])*(c[0]-b[0])<=0)return false;if(Math.hypot(b[0]-a[0],b[1]-a[1])<8)return false;}
  let ar=0;for(let i=0;i<4;i++){const p=qd[i],r=qd[(i+1)%4];ar+=p[0]*r[1]-r[0]*p[1];}return ar/2>0.005*w*h;
}
async function goCrop(){
  const d=draft;if(!d){goCam();return;}
  const s=setView('crop',d.edit>=0?'Adjust page '+(d.edit+1):'Adjust corners');
  mainEl.innerHTML='<div class="scn-crop"><div class="scn-cview"><canvas class="scn-ccv" role="img" aria-label="Photo with the page outline — drag the round handles to the page corners"></canvas>'
    +'<canvas class="scn-loupe" hidden aria-hidden="true"></canvas><div class="scn-pwait"><span class="scn-spin" aria-hidden="true"></span><b>Opening…</b></div></div>'
    +'<div class="scn-bar"><div class="scn-tools">'
    +'<button type="button" class="scn-tool" data-a="auto">'+svg(IC.detect)+'<span>Auto-detect</span></button>'
    +'<button type="button" class="scn-tool" data-a="whole">'+svg(IC.whole)+'<span>Whole image</span></button>'
    +'<button type="button" class="scn-tool" data-a="rot">'+svg(IC.rotate)+'<span>Rotate 90°</span></button></div>'
    +'<div class="scn-acts"><button type="button" class="scn-btn" data-a="retake">'+svg(IC.camera)+'<span>Retake</span></button>'
    +'<button type="button" class="scn-btn scn-gold" data-a="next"><span>Next</span>'+svg(IC.next)+'</button></div></div></div>';
  const box=q(mainEl,'.scn-cview'),cv=q(box,'.scn-ccv'),lp=q(box,'.scn-loupe');
  const C={s,box,cv,lp,full:null,disp:null,drag:null,k:1,ox:0,oy:0,cw:1,ch:1,dpr:1,rw:1,rh:1};crop=C;
  let full=null,disp=null;
  try{full=await createImageBitmap(d.src);const k=Math.min(1,1800/Math.max(d.w,d.h));
    disp=k<1?await createImageBitmap(d.src,{resizeWidth:Math.max(1,Math.round(d.w*k)),resizeHeight:Math.max(1,Math.round(d.h*k)),resizeQuality:'high'}):full;}
  catch(e){if(!disp&&full)disp=full;}
  if(!s.alive){closeBmp(full);if(disp!==full)closeBmp(disp);return;}
  if(!full){toast('That photo can’t be shown — try again');goCam();return;}
  C.full=full;C.disp=disp;s.clean(()=>{closeBmp(full);if(disp!==full)closeBmp(disp);});
  q(box,'.scn-pwait').hidden=true;
  const lay=()=>{cropLayout(C);cropDraw(C);};
  if(W.ResizeObserver){const ro=new ResizeObserver(lay);ro.observe(box);s.clean(()=>ro.disconnect());}else s.on(W,'resize',lay);
  lay();
  const pos=e=>{const r=cv.getBoundingClientRect();return [e.clientX-r.left,e.clientY-r.top];};
  s.on(cv,'pointerdown',e=>{
    if(C.drag||!draft)return;const p=pos(e),h=hitTest(C,p[0],p[1]);if(!h)return;
    e.preventDefault();try{cv.setPointerCapture(e.pointerId);}catch(_){}
    C.drag=Object.assign(h,{id:e.pointerId,start:p,cur:p,q0:draft.quad.map(x=>x.slice()),off:[h.pt[0]-p[0],h.pt[1]-p[1]]});vib(8);
    cropDraw(C);drawLoupe(C);
  });
  s.on(cv,'pointermove',e=>{
    const g=C.drag;if(!g||e.pointerId!==g.id)return;const p=pos(e);g.cur=p;dragTo(C,g,p);cropDraw(C);drawLoupe(C);
  });
  const end=e=>{const g=C.drag;if(!g||(e&&e.pointerId!==g.id))return;C.drag=null;lp.hidden=true;cropDraw(C);};
  s.on(cv,'pointerup',end);s.on(cv,'pointercancel',end);s.on(cv,'lostpointercapture',end);
  q(mainEl,'.scn-bar').addEventListener('click',e=>{
    const b=e.target.closest('[data-a]');if(!b||!draft)return;const a=b.dataset.a,dd=draft;
    if(a==='auto'){if(dd.auto){animQuad(C,dd.auto);toast('Page edges found');}else toast('No clear page edges — drag the corners to the page');}
    else if(a==='whole')animQuad(C,[[0,0],[dd.w,0],[dd.w,dd.h],[0,dd.h]]);
    else if(a==='rot'){dd.rot=(dd.rot+1)&3;cropLayout(C);cropDraw(C);}
    else if(a==='retake')retake();
    else if(a==='next'){if(!quadGood(dd.quad,dd.w,dd.h)){toast('The corners cross over — drag them to the page corners');return;}goEnh();}
  });
}
function retake(){
  const d=draft;if(!d)return goCam();
  replaceIdx=d.edit>=0?d.edit:d.replace>=0?d.replace:-1;draft=null;goCam();
}
function cropLayout(C){
  const d=draft,r=C.box.getBoundingClientRect(),dpr=W.devicePixelRatio||1,cw=Math.max(1,Math.round(r.width)),ch=Math.max(1,Math.round(r.height));
  if(C.cv.width!==Math.round(cw*dpr)||C.cv.height!==Math.round(ch*dpr)){C.cv.width=Math.round(cw*dpr);C.cv.height=Math.round(ch*dpr);}
  const rw=d.rot&1?d.h:d.w,rh=d.rot&1?d.w:d.h,P=28,k=Math.max(0.0001,Math.min((cw-2*P)/rw,(ch-2*P)/rh));
  Object.assign(C,{cw,ch,dpr,rw,rh,k,ox:(cw-rw*k)/2,oy:(ch-rh*k)/2});
}
function toScr(C,p){const d=draft,x=p[0],y=p[1];let xr,yr;
  switch(d.rot&3){case 0:xr=x;yr=y;break;case 1:xr=d.h-y;yr=x;break;case 2:xr=d.w-x;yr=d.h-y;break;default:xr=y;yr=d.w-x;}
  return [C.ox+xr*C.k,C.oy+yr*C.k];}
function toSrc(C,sx,sy){const d=draft,xr=(sx-C.ox)/C.k,yr=(sy-C.oy)/C.k;
  switch(d.rot&3){case 0:return [xr,yr];case 1:return [yr,d.h-xr];case 2:return [d.w-xr,d.h-yr];default:return [d.w-yr,xr];}}
function rotXf(c,r,w,h){if(r===1){c.translate(h,0);c.rotate(Math.PI/2);}else if(r===2){c.translate(w,h);c.rotate(Math.PI);}else if(r===3){c.translate(0,w);c.rotate(-Math.PI/2);}}
function hitTest(C,x,y){
  const d=draft,S=d.quad.map(p=>toScr(C,p));let best=null,bd=1e9;
  for(let i=0;i<4;i++){const dd=Math.hypot(S[i][0]-x,S[i][1]-y);if(dd<34&&dd<bd){bd=dd;best={kind:'c',i,pt:S[i]};}}
  if(best)return best;
  for(let i=0;i<4;i++){const a=S[i],b=S[(i+1)%4],m=[(a[0]+b[0])/2,(a[1]+b[1])/2],dd=Math.hypot(m[0]-x,m[1]-y);if(dd<28&&dd<bd){bd=dd;best={kind:'e',i,pt:m};}}
  return best;
}
const lnAB=(a,b)=>{const dx=b[0]-a[0],dy=b[1]-a[1],l=Math.hypot(dx,dy)||1;return {px:a[0],py:a[1],nx:-dy/l,ny:dx/l};};
function lnMeet(L1,L2){const c1=L1.nx*L1.px+L1.ny*L1.py,c2=L2.nx*L2.px+L2.ny*L2.py,det=L1.nx*L2.ny-L1.ny*L2.nx;if(Math.abs(det)<1e-9)return null;return [(c1*L2.ny-c2*L1.ny)/det,(L1.nx*c2-L2.nx*c1)/det];}
function dragTo(C,g,p){
  const d=draft,cl=pt=>[clamp(pt[0],0,d.w),clamp(pt[1],0,d.h)];
  if(g.kind==='c'){d.quad[g.i]=cl(toSrc(C,p[0]+g.off[0],p[1]+g.off[1]));return;}
  const q0=g.q0,i=g.i,j=(i+1)%4,A=q0[i],B=q0[j],a=toSrc(C,g.start[0],g.start[1]),b=toSrc(C,p[0],p[1]);
  const L=lnAB(A,B),dn=(b[0]-a[0])*L.nx+(b[1]-a[1])*L.ny,An=[A[0]+L.nx*dn,A[1]+L.ny*dn],Bn=[B[0]+L.nx*dn,B[1]+L.ny*dn],Ln=lnAB(An,Bn);
  let na=lnMeet(Ln,lnAB(q0[(i+3)%4],A)),nb=lnMeet(Ln,lnAB(B,q0[(j+1)%4]));
  const far=x=>!x||x[0]<-0.02*d.w||x[0]>1.02*d.w||x[1]<-0.02*d.h||x[1]>1.02*d.h;
  if(far(na)||far(nb)){na=An;nb=Bn;}
  d.quad[i]=cl(na);d.quad[j]=cl(nb);
}
function cropDraw(C){
  const d=draft;if(!d||!C.disp)return;const c=C.cv.getContext('2d'),cw=C.cw,ch=C.ch;
  c.setTransform(C.dpr,0,0,C.dpr,0,0);c.clearRect(0,0,cw,ch);
  c.save();c.translate(C.ox,C.oy);c.scale(C.k,C.k);rotXf(c,d.rot&3,d.w,d.h);c.imageSmoothingEnabled=true;c.imageSmoothingQuality='high';c.drawImage(C.disp,0,0,d.w,d.h);c.restore();
  const S=d.quad.map(p=>toScr(C,p)),good=quadGood(d.quad,d.w,d.h),col=good?'#d4af37':'#ff5a4d';
  c.save();c.beginPath();c.rect(C.ox,C.oy,C.rw*C.k,C.rh*C.k);c.moveTo(S[0][0],S[0][1]);for(let i=1;i<4;i++)c.lineTo(S[i][0],S[i][1]);c.closePath();
  c.fillStyle='rgba(3,8,18,.58)';c.fill('evenodd');c.restore();
  c.beginPath();c.moveTo(S[0][0],S[0][1]);for(let i=1;i<4;i++)c.lineTo(S[i][0],S[i][1]);c.closePath();c.lineJoin='round';
  c.lineWidth=5;c.strokeStyle='rgba(0,0,0,.5)';c.stroke();c.lineWidth=2.5;c.strokeStyle=col;c.stroke();
  const g=C.drag;
  for(let i=0;i<4;i++){const a=S[i],b=S[(i+1)%4],m=[(a[0]+b[0])/2,(a[1]+b[1])/2],ang=Math.atan2(b[1]-a[1],b[0]-a[0]),on=g&&g.kind==='e'&&g.i===i;
    c.save();c.translate(m[0],m[1]);c.rotate(ang);c.beginPath();if(c.roundRect)c.roundRect(-14,-5,28,10,5);else c.rect(-14,-5,28,10);
    c.fillStyle=on?col:'rgba(10,25,48,.85)';c.fill();c.lineWidth=2.5;c.strokeStyle=col;c.stroke();c.restore();}
  for(let i=0;i<4;i++){const p=S[i],on=g&&g.kind==='c'&&g.i===i;
    c.beginPath();c.arc(p[0],p[1],on?15:13,0,7);c.fillStyle=on?col:'rgba(10,25,48,.55)';c.fill();c.lineWidth=3;c.strokeStyle=col;c.stroke();
    c.beginPath();c.arc(p[0],p[1],3,0,7);c.fillStyle=on?'#0a1930':'#fff';c.fill();}
}
function drawLoupe(C){
  const g=C.drag,d=draft;if(!g||!d||!C.full)return;
  const S=132,lp=C.lp,dpr=C.dpr;if(lp.width!==Math.round(S*dpr)){lp.width=lp.height=Math.round(S*dpr);}
  const P=g.kind==='c'?d.quad[g.i]:[(d.quad[g.i][0]+d.quad[(g.i+1)%4][0])/2,(d.quad[g.i][1]+d.quad[(g.i+1)%4][1])/2];
  const f=g.cur||toScr(C,P);let lx=f[0]-S/2,ly=f[1]-S-46;if(ly<6)ly=f[1]+46;
  lx=clamp(lx,6,Math.max(6,C.cw-S-6));ly=clamp(ly,6,Math.max(6,C.ch-S-6));
  lp.style.transform='translate('+Math.round(lx)+'px,'+Math.round(ly)+'px)';lp.hidden=false;
  const c=lp.getContext('2d'),Z=Math.min(1.25,4*C.k);c.setTransform(dpr,0,0,dpr,0,0);c.clearRect(0,0,S,S);
  c.save();c.beginPath();c.arc(S/2,S/2,S/2-1,0,7);c.clip();c.fillStyle='#050b16';c.fillRect(0,0,S,S);
  c.translate(S/2,S/2);c.scale(Z,Z);c.rotate((d.rot&3)*Math.PI/2);c.translate(-P[0],-P[1]);c.imageSmoothingEnabled=true;c.drawImage(C.full,0,0);
  c.beginPath();c.moveTo(d.quad[0][0],d.quad[0][1]);for(let i=1;i<4;i++)c.lineTo(d.quad[i][0],d.quad[i][1]);c.closePath();
  c.lineWidth=2/Z;c.strokeStyle='#d4af37';c.stroke();c.restore();
  c.lineWidth=3;c.strokeStyle='rgba(0,0,0,.55)';c.beginPath();c.moveTo(S/2-11,S/2);c.lineTo(S/2+11,S/2);c.moveTo(S/2,S/2-11);c.lineTo(S/2,S/2+11);c.stroke();
  c.lineWidth=1.4;c.strokeStyle='#fff';c.stroke();
  c.lineWidth=3;c.strokeStyle='#d4af37';c.beginPath();c.arc(S/2,S/2,S/2-1.6,0,7);c.stroke();
}
function animQuad(C,to){
  const from=draft.quad.map(p=>p.slice()),t0=performance.now(),s=C.s,dd=draft;
  const step=()=>{if(!s.alive||draft!==dd)return;const t=Math.min(1,(performance.now()-t0)/200),e=1-Math.pow(1-t,3);
    dd.quad=from.map((p,i)=>[p[0]+(to[i][0]-p[0])*e,p[1]+(to[i][1]-p[1])*e]);cropDraw(C);if(t<1)requestAnimationFrame(step);else dd.quad=to.map(p=>p.slice());};
  requestAnimationFrame(step);
}

/* =====================================================================
   ENHANCE SCREEN — flattened preview + filters
   ===================================================================== */
async function goEnh(){
  const d=draft;if(!d){goCam();return;}
  const s=setView('enh','Enhance');
  mainEl.innerHTML='<div class="scn-enh"><div class="scn-pview"><canvas class="scn-pcv" width="1" height="1" role="img" aria-label="Flattened page preview"></canvas>'
    +'<div class="scn-pwait"><span class="scn-spin" aria-hidden="true"></span><b>Flattening…</b></div></div>'
    +'<div class="scn-bar"><div class="scn-filters" role="radiogroup" aria-label="Filter">'
    +FILTERS.map(f=>'<button type="button" class="scn-f'+(f[0]===d.filter?' scn-on':'')+'" role="radio" aria-checked="'+(f[0]===d.filter)+'" data-f="'+f[0]+'"><canvas width="1" height="1"></canvas><span>'+esc(f[1])+'</span></button>').join('')+'</div>'
    +'<div class="scn-acts"><button type="button" class="scn-btn" data-a="crop">'+svg(IC.crop)+'<span>Crop</span></button>'
    +'<button type="button" class="scn-btn" data-a="rot">'+svg(IC.rotate)+'<span>Rotate</span></button>'
    +'<button type="button" class="scn-btn scn-gold" data-a="done" disabled>'+svg(IC.check)+'<span>Done</span></button></div></div></div>';
  const E={s,key:uid(),cache:{},seq:0,ready:false};enh=E;
  s.clean(()=>{call('drop',{},{prio:1}).catch(()=>{});});
  q(mainEl,'.scn-filters').addEventListener('click',e=>{const b=e.target.closest('[data-f]');if(!b||!draft)return;draft.filter=b.dataset.f;
    qa(mainEl,'.scn-f').forEach(x=>{const on=x===b;x.classList.toggle('scn-on',on);x.setAttribute('aria-checked',String(on));});if(E.ready)enhShow(E,draft.filter);});
  q(mainEl,'.scn-acts').addEventListener('click',e=>{const b=e.target.closest('[data-a]');if(!b||!draft)return;const a=b.dataset.a;
    if(a==='crop')goCrop();
    else if(a==='rot'){draft.rot=(draft.rot+1)&3;E.cache={};E.key=uid();E.ready=false;enhRender(E);}
    else if(a==='done')enhDone(E);});
  enhRender(E);
}
function enhWait(on,txt){const w=q(mainEl,'.scn-pwait');if(!w)return;w.hidden=!on;if(txt)q(w,'b').textContent=txt;}
function paintRGBA(cv,r){if(cv.width!==r.w||cv.height!==r.h){cv.width=r.w;cv.height=r.h;}cv.getContext('2d').putImageData(new ImageData(r.data,r.w,r.h),0,0);}
async function enhRender(E){
  const d=draft,s=E.s,key=E.key;enhWait(true,'Flattening…');const done=q(mainEl,'[data-a="done"]');if(done)done.disabled=true;
  try{
    const r=await call('render',{blob:d.src,quad:d.quad,rot:d.rot,filter:'orig',maxLong:PREV,out:'rgba',key},{prio:1,progress:p=>{if(s.alive&&E.key===key)enhWait(true,'Flattening… '+Math.round(p*100)+'%');}});
    if(!s.alive||E.key!==key)return;E.cache.orig=r;E.a4=r.a4;
    const t=await call('thumbs',{key,size:132},{prio:1});
    if(!s.alive||E.key!==key)return;
    t.list.forEach(x=>{const b=q(mainEl,'.scn-f[data-f="'+x.f+'"] canvas');if(b)paintRGBA(b,x);});
    E.ready=true;await enhShow(E,draft.filter);
    if(s.alive&&E.key===key&&done)done.disabled=false;
  }catch(e){if(s.alive&&!e.closed){enhWait(false);toast('Couldn’t flatten the page: '+errMsg(e));}}
}
async function enhShow(E,f){
  const seq=++E.seq,key=E.key;let r=E.cache[f];
  if(!r){enhWait(true,'Applying '+(FILTERS.find(x=>x[0]===f)||['',''])[1]+'…');
    try{r=await call('filter',{key,filter:f},{prio:1});}catch(e){if(E.s.alive&&!e.closed){enhWait(false);toast(errMsg(e));}return;}
    if(E.key===key)E.cache[f]=r;}
  if(seq!==E.seq||!E.s.alive||E.key!==key)return;
  paintRGBA(q(mainEl,'.scn-pcv'),r);enhWait(false);
}
function enhDone(E){
  const d=draft;if(!d||!E.ready)return;
  lastFilter=d.filter;LSset('filter',d.filter);
  const pcv=q(mainEl,'.scn-pcv');
  if(d.edit>=0&&pages[d.edit]){
    const p=pages[d.edit];p.quad=d.quad.map(x=>x.slice());p.rot=d.rot;p.filter=d.filter;
    previewThumbForce(p,pcv);queueRender(p);pagesVer++;const n=d.edit+1;draft=null;goPages();toast('Page '+n+' updated');return;
  }
  const p=mkPage(d);previewThumb(p,pcv);queueRender(p);
  if(d.replace>=0&&pages[d.replace]){const old=pages[d.replace];pages[d.replace]=p;dropPage(old);pagesVer++;const n=d.replace+1;replaceIdx=-1;draft=null;goPages();toast('Page '+n+' replaced');return;}
  pages.push(p);pagesVer++;replaceIdx=-1;draft=null;goCam();updStack(true);toast('Page '+pages.length+' added — scan the next page, or tap Pages');
}
function previewThumbForce(p,cv){if(p.thumb){try{URL.revokeObjectURL(p.thumb);}catch(e){}p.thumb=null;}previewThumb(p,cv);}

/* =====================================================================
   PAGES SCREEN — grid, reorder (buttons + long-press drag), delete with undo, tap to edit
   ===================================================================== */
function cardHtml(p,i){
  const n=i+1,busyP=!!p.job||!p.thumb;
  return '<div class="scn-card" data-id="'+esc(p.id)+'"><button type="button" class="scn-cimg" data-a="open" aria-label="Page '+n+' — tap to adjust">'
    +(p.thumb?'<img src="'+esc(p.thumb)+'" alt="" draggable="false">':'')+'<b class="scn-pno">'+n+'</b>'
    +(busyP?'<span class="scn-cspin" aria-hidden="true"></span>':'')+(p.err?'<em class="scn-cerr" title="'+esc(p.err)+'">!</em>':'')+'</button>'
    +'<div class="scn-cbtns"><button type="button" data-a="up" aria-label="Move page '+n+' earlier"'+(i?'':' disabled')+'>'+svg(IC.up)+'</button>'
    +'<button type="button" data-a="down" aria-label="Move page '+n+' later"'+(i<pages.length-1?'':' disabled')+'>'+svg(IC.down)+'</button>'
    +'<button type="button" data-a="del" class="scn-dang" aria-label="Delete page '+n+'">'+svg(IC.trash)+'</button></div></div>';
}
function goPages(){
  const s=setView('pages','Pages');
  renderPages();
  const P={s,drag:null,lp:null,suppress:false};
  wirePages(P);
}
function renderPages(){
  if(view!=='pages')return;
  const sc=q(mainEl,'.scn-pscroll'),top=sc?sc.scrollTop:0,n=pages.length,saved=n&&savedVer===pagesVer;
  ttlEl.textContent='Pages · '+n;
  mainEl.innerHTML='<div class="scn-pages"><div class="scn-pscroll">'
    +(n?'<div class="scn-phead"><b>'+plural(n,'page')+'</b><span>Tap a page to adjust it · hold and drag to reorder</span></div>':'')
    +(saved?'<div class="scn-saved">'+svg(IC.check)+'<span>Saved to Downloads at '+hm(savedAt)+'. The pages stay here until you close the scanner.</span></div>':'')
    +(n?'<div class="scn-grid">'+pages.map(cardHtml).join('')+'</div>':'<div class="scn-empty">'+svg(IC.pages)+'<b>No pages yet</b><span>Scan or import a page to start.</span></div>')
    +'</div><div class="scn-bar"><div class="scn-acts"><button type="button" class="scn-btn" data-a="add">'+svg(IC.plus)+'<span>Add page</span></button>'
    +'<button type="button" class="scn-btn scn-gold" data-a="export"'+(n?'':' disabled')+'>'+svg(IC.pdf)+'<span>Export</span></button></div></div></div>';
  const nsc=q(mainEl,'.scn-pscroll');if(nsc)nsc.scrollTop=top;
}
function movePage(i,j){if(i<0||j<0||i>=pages.length||j>=pages.length||i===j)return;const p=pages.splice(i,1)[0];pages.splice(j,0,p);pagesVer++;}
function clearUndo(){if(undoDel){const u=undoDel;undoDel=null;dropPage(u.p);}}
function deletePage(i){
  const p=pages[i];if(!p)return;clearUndo();pages.splice(i,1);pagesVer++;undoDel={p,i};renderPages();
  toast('Page '+(i+1)+' deleted',{label:'Undo',fn:()=>{if(!undoDel||undoDel.p!==p)return;pages.splice(Math.min(undoDel.i,pages.length),0,p);undoDel=null;pagesVer++;renderPages();},
    expire:()=>{if(undoDel&&undoDel.p===p)clearUndo();}});
}
function editPage(i){
  const p=pages[i];if(!p)return;
  draft={src:p.src,w:p.w,h:p.h,quad:p.quad.map(x=>x.slice()),auto:p.auto,rot:p.rot,filter:p.filter,edit:i,replace:-1};goCrop();
}
function wirePages(P){
  const s=P.s,root=mainEl;
  s.on(root,'click',e=>{
    if(view!=='pages')return;
    if(P.suppress){P.suppress=false;e.preventDefault();e.stopPropagation();return;}
    const b=e.target.closest('[data-a]');if(!b)return;const a=b.dataset.a,card=b.closest('.scn-card'),i=card?pages.findIndex(x=>x.id===card.dataset.id):-1;
    if(a==='add'){clearUndo();goCam();}
    else if(a==='export')exportSheet();
    else if(a==='open'&&i>=0)editPage(i);
    else if(a==='up'&&i>0){movePage(i,i-1);renderPages();focusCard(i-1,'up');}
    else if(a==='down'&&i>=0&&i<pages.length-1){movePage(i,i+1);renderPages();focusCard(i+1,'down');}
    else if(a==='del'&&i>=0)deletePage(i);
  },true);
  /* long-press drag to reorder */
  s.on(root,'contextmenu',e=>{if(e.target.closest('.scn-card'))e.preventDefault();});
  s.on(root,'touchmove',e=>{if(P.drag)e.preventDefault();},{passive:false});
  s.on(root,'pointerdown',e=>{
    if(P.drag||(e.pointerType==='mouse'&&e.button!==0))return;const card=e.target.closest('.scn-card');if(!card||e.target.closest('.scn-cbtns'))return;
    const lp={card,x:e.clientX,y:e.clientY,x0:e.clientX,y0:e.clientY,id:e.pointerId};P.lp=lp;
    lp.t=setTimeout(()=>{if(P.lp===lp)startDrag(P,lp);},420);
  });
  s.on(root,'pointermove',e=>{
    const lp=P.lp;if(lp&&e.pointerId===lp.id&&!P.drag){lp.x=e.clientX;lp.y=e.clientY;if(Math.hypot(lp.x-lp.x0,lp.y-lp.y0)>10){clearTimeout(lp.t);P.lp=null;}return;}
    const g=P.drag;if(g&&e.pointerId===g.id){g.x=e.clientX;g.y=e.clientY;moveDrag(P);}
  });
  const up=e=>{const lp=P.lp;if(lp&&e.pointerId===lp.id){clearTimeout(lp.t);P.lp=null;}const g=P.drag;if(g&&e.pointerId===g.id)endDrag(P,e.type==='pointerup');};
  s.on(root,'pointerup',up);s.on(root,'pointercancel',up);
  s.clean(()=>{if(P.lp)clearTimeout(P.lp.t);if(P.drag)endDrag(P,false);});
}
function focusCard(i,a){const c=qa(mainEl,'.scn-card')[i];if(c){const b=q(c,'[data-a="'+a+'"]');const t=b&&!b.disabled?b:q(c,'.scn-cimg');try{t.focus({preventScroll:false});}catch(e){}}}
function startDrag(P,lp){
  const card=lp.card;if(!card.isConnected)return;P.lp=null;
  const r=card.getBoundingClientRect(),ghost=card.cloneNode(true);ghost.classList.add('scn-ghost');ghost.removeAttribute('data-id');
  ghost.style.width=r.width+'px';ghost.style.height=r.height+'px';ov.appendChild(ghost);
  card.classList.add('scn-ph');vib(20);
  const g={card,ghost,id:lp.id,x:lp.x,y:lp.y,dx:lp.x-r.left,dy:lp.y-r.top,sc:q(mainEl,'.scn-pscroll'),raf:0};P.drag=g;
  try{mainEl.setPointerCapture(lp.id);}catch(e){}
  moveDrag(P);
  const tick=()=>{if(P.drag!==g)return;const sr=g.sc.getBoundingClientRect(),edge=64;let v=0;
    if(g.y<sr.top+edge)v=-Math.ceil((sr.top+edge-g.y)/5);else if(g.y>sr.bottom-edge)v=Math.ceil((g.y-(sr.bottom-edge))/5);
    if(v){g.sc.scrollTop+=v;placeDrag(P);}g.raf=requestAnimationFrame(tick);};
  g.raf=requestAnimationFrame(tick);
}
function moveDrag(P){const g=P.drag;if(!g)return;g.ghost.style.transform='translate('+Math.round(g.x-g.dx)+'px,'+Math.round(g.y-g.dy)+'px) scale(1.04)';placeDrag(P);}
function placeDrag(P){
  const g=P.drag;if(!g)return;const grid=g.card.parentNode;if(!grid)return;
  const cards=qa(grid,'.scn-card');let tgt=null;
  for(const c of cards){if(c===g.card)continue;const r=c.getBoundingClientRect();if(g.x>=r.left&&g.x<=r.right&&g.y>=r.top&&g.y<=r.bottom){tgt=c;break;}}
  if(!tgt)return;const ci=cards.indexOf(g.card),ti=cards.indexOf(tgt);
  if(ti>ci)tgt.after(g.card);else tgt.before(g.card);
}
function endDrag(P,commit){
  const g=P.drag;if(!g)return;P.drag=null;cancelAnimationFrame(g.raf);g.ghost.remove();g.card.classList.remove('scn-ph');
  try{mainEl.releasePointerCapture(g.id);}catch(e){}
  P.suppress=true;setTimeout(()=>{P.suppress=false;},350);
  if(commit){const ids=qa(mainEl,'.scn-card').map(c=>c.dataset.id),old=pages.map(p=>p.id).join('|');
    if(ids.length===pages.length&&ids.join('|')!==old){const by=new Map(pages.map(p=>[p.id,p]));pages=ids.map(id=>by.get(id)).filter(Boolean);pagesVer++;toast('Pages reordered');}}
  renderPages();
}

/* =====================================================================
   EXPORT — sheet, PDF, JPEGs
   ===================================================================== */
function defName(){const d=new Date();return 'Scan_'+d.getFullYear()+p2(d.getMonth()+1)+p2(d.getDate())+'_'+p2(d.getHours())+p2(d.getMinutes());}
/* file names: accents folded to ASCII (Ó → O) — some Chrome builds refuse non-ASCII download names; the PDF title keeps them */
const fileSafe=s=>String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^\x20-\x7e]+/g,'_').replace(/\s+/g,' ').trim()||defName();
function cleanName(s){s=String(s||'').replace(/\.pdf$/i,'').replace(/[\\/:*?"<>|\u0000-\u001f\u007f]+/g,' ').replace(/\s+/g,' ').trim().slice(0,80).replace(/^\.+/,'');return s;}
function estimate(qual){
  let t=1400;
  for(const p of pages){
    let b=p.out?p.out.size:0,L=Math.max(p.ow,p.oh);
    if(!b){const r=Math.max(p.w,p.h)?Math.min(1,HIGH/Math.max(p.w,p.h)):1;L=HIGH;b=(p.w*p.h*r*r*0.55)*(p.filter==='bw'?0.14:p.filter==='grey'?0.16:0.2);}
    if(qual==='std'&&L>STD)b*=Math.pow(STD/L,1.7)*0.95;
    t+=b+620;
  }
  return t;
}
function noticeSheet(first){
  sheet('<h3>'+svg(IC.shield)+'Saved to this phone only</h3><div class="scn-warn">'+svg(IC.info)+'<span>'+esc(WARN)+'</span></div>'
    +'<p class="scn-note">Pages are kept in memory only while the scanner is open. Closing it clears them.</p>'
    +'<button type="button" class="scn-go scn-wide scn-x">'+(first?'I understand':'OK')+'</button>',null,()=>{LSset('warned',1);});
}
function discardSheet(){
  const n=pages.length;
  sheet('<h3>Discard '+plural(n,'scanned page')+'?</h3><p class="scn-note">'+(n===1?'It hasn’t':'They haven’t')+' been saved to the phone. Closing the scanner deletes '+(n===1?'it':'them')+' — nothing is kept in the app.</p>'
    +'<div class="scn-row2"><button type="button" class="scn-go scn-danger scn-dis">Discard</button><button type="button" class="scn-sec scn-x">Cancel</button></div>'
    +'<button type="button" class="scn-link scn-sv">Save as PDF first</button>',r=>{
    q(r,'.scn-dis').onclick=()=>{closeSheet();closeScanner(true);};
    q(r,'.scn-sv').onclick=()=>{closeSheet();if(view!=='pages')goPages();exportSheet();};
  });
}
let expOpt={size:LSget('size','a4')==='fit'?'fit':'a4',q:LSget('q','high')==='std'?'std':'high'};
function exportSheet(){
  if(!pages.length){toast('Scan a page first');return;}
  const n=pages.length,nm=defName();
  sheet('<h3>'+svg(IC.pdf)+'Export '+plural(n,'page')+'</h3>'
    +'<label class="scn-lab" for="scn-fn">File name</label><div class="scn-fname"><input id="scn-fn" class="scn-in" maxlength="80" autocomplete="off" spellcheck="false" value="'+esc(nm)+'"><span>.pdf</span></div>'
    +'<div class="scn-lab">Page size</div><div class="scn-seg" data-k="size" role="group" aria-label="Page size"><button type="button" data-v="a4">A4</button><button type="button" data-v="fit">Fit to image</button></div>'
    +'<div class="scn-lab">Quality</div><div class="scn-seg" data-k="q" role="group" aria-label="Quality"><button type="button" data-v="std">Standard</button><button type="button" data-v="high">High</button></div>'
    +'<p class="scn-est" aria-live="polite"></p>'
    +'<div class="scn-warn">'+svg(IC.shield)+'<span>'+esc(WARN)+'</span></div>'
    +'<button type="button" class="scn-go scn-wide scn-pdf">'+svg(IC.download)+'Save PDF to phone</button>'
    +'<button type="button" class="scn-sec scn-wide scn-jpg">'+svg(IC.image)+'Save pages as JPEG</button>',r=>{
    const inp=q(r,'.scn-in');
    const upd=()=>{qa(r,'.scn-seg').forEach(sg=>qa(sg,'button').forEach(b=>{const on=b.dataset.v===expOpt[sg.dataset.k];b.classList.toggle('scn-on',on);b.setAttribute('aria-pressed',String(on));}));
      const pend=pages.some(p=>!p.out);q(r,'.scn-est').textContent=plural(n,'page')+' · '+(expOpt.size==='a4'?'A4':'fitted pages')+' · '+(expOpt.q==='high'?'high quality':'standard quality')+' · ≈ '+fmtSize(estimate(expOpt.q))+(pend?' (estimate)':'');};
    qa(r,'.scn-seg').forEach(sg=>sg.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;expOpt[sg.dataset.k]=b.dataset.v;LSset(sg.dataset.k,b.dataset.v);upd();}));
    const nameOf=()=>cleanName(inp.value)||nm;
    q(r,'.scn-pdf').onclick=()=>{const name=nameOf();closeSheet();doExport('pdf',name);};
    q(r,'.scn-jpg').onclick=()=>{const name=nameOf();closeSheet();doExport('jpg',name);};
    inp.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();q(r,'.scn-pdf').click();}});
    upd();
  });
}
function download(blob,name){
  const u=URL.createObjectURL(blob),a=D.createElement('a');a.href=u;a.download=name;a.rel='noopener';a.style.display='none';
  (ov||D.body).appendChild(a);a.click();a.remove();dlURLs.add(u);
  setTimeout(()=>{try{URL.revokeObjectURL(u);}catch(e){}dlURLs.delete(u);},60000);
}
async function pageImages(qual,ep){
  const out=[],n=pages.length;
  for(let i=0;i<n;i++){
    const p=pages[i];busy('Preparing page '+(i+1)+' of '+n+'…',i/n);
    if(p.job){try{await p.job;}catch(e){}}
    if(ep!==epoch)throw Object.assign(new Error('closed'),{closed:true});
    if(!p.out){await queueRender(p);if(!p.out)throw new Error('Page '+(i+1)+' couldn’t be processed'+(p.err?': '+p.err:''));}
    if(qual==='std'&&Math.max(p.ow,p.oh)>STD){
      const r=await call('render',{blob:p.src,quad:p.quad,rot:p.rot,filter:p.filter,maxLong:STD,out:'jpeg',q:JQ.std},{prio:1,progress:x=>busy('Preparing page '+(i+1)+' of '+n+'…',(i+x)/n)});
      out.push({blob:r.blob});
    }else out.push({blob:p.out});
  }
  return out;
}
async function doExport(kind,name){
  if(exporting||!pages.length)return;exporting=true;const ep=epoch;
  try{
    const imgs=await pageImages(expOpt.q,ep);
    if(ep!==epoch)return;
    const fn=fileSafe(name);
    if(kind==='pdf'){busy('Building the PDF…',1);const pdf=await buildPdf(imgs,{size:expOpt.size,title:name});if(ep!==epoch)return;
      download(pdf,fn+'.pdf');savedVer=pagesVer;savedAt=Date.now();toast('Saved '+fn+'.pdf ('+fmtSize(pdf.size)+') to Downloads');}
    else{for(let i=0;i<imgs.length;i++){if(ep!==epoch)return;busy('Saving JPEG '+(i+1)+' of '+imgs.length+'…',(i+1)/imgs.length);
        download(imgs[i].blob,fn+(imgs.length>1?'_p'+p2(i+1):'')+'.jpg');if(i<imgs.length-1)await sleep(450);}
      savedVer=pagesVer;savedAt=Date.now();toast(imgs.length>1?imgs.length+' JPEGs saved to Downloads':'JPEG saved to Downloads');}
    if(view==='pages')renderPages();
  }catch(e){if(ep===epoch&&!e.closed)toast('Export failed: '+errMsg(e));}
  finally{if(ep===epoch){exporting=false;unbusy();}}
}

/* =====================================================================
   PUBLIC API
   ===================================================================== */
function openScanner(){
  build();
  if(!ov.hidden){try{ov.focus({preventScroll:true});}catch(e){}return true;}
  epoch++;ov.hidden=false;D.body.classList.add('scn-open');listen(true);try{ov.focus({preventScroll:true});}catch(e){}
  startWorker();goCam();
  if(!LSget('warned',0))setTimeout(()=>{if(ov&&!ov.hidden&&sheetEl.hidden)noticeSheet(true);},350);
  hud();return true;
}
function closeScanner(force){
  if(!ov||ov.hidden)return true;
  if(force!==true&&unsaved()&&!exporting){discardSheet();return false;}
  epoch++;exporting=false;closeSheet();unbusy();
  if(vs){vs.end();vs=null;}view=null;cam=null;crop=null;enh=null;draft=null;replaceIdx=-1;hiddenCam=false;
  stopWorker();clearUndo();pages.forEach(dropPage);pages=[];pagesVer=savedVer=0;savedAt=0;
  dlURLs.forEach(u=>{try{URL.revokeObjectURL(u);}catch(e){}});dlURLs.clear();
  qa(ov,'.scn-ghost').forEach(g=>g.remove());
  ov.hidden=true;D.body.classList.remove('scn-open');listen(false);mainEl.textContent='';clearTimeout(toastT);toastEl.classList.remove('scn-on');
  return true;
}
/* phone Back: sheet / magnifier → enhance → crop → pages → camera → close */
function scnBack(){
  if(!ov||ov.hidden||!ov.isConnected)return false;
  if(!sheetEl.hidden){closeSheet();return true;}
  if(exporting){toast('Saving — one moment');return true;}
  if(!busyEl.hidden&&Date.now()-busySince<20000){toast('One moment…');return true;}   /* a capture/import is being processed */
  unbusy();
  if(view==='crop'&&crop&&crop.drag){const C=crop,g=C.drag;draft.quad=g.q0.map(p=>p.slice());C.drag=null;C.lp.hidden=true;cropDraw(C);return true;}
  if(view==='enh'){goCrop();return true;}
  if(view==='crop'){const d=draft;draft=null;
    if(d&&d.edit>=0){goPages();return true;}
    goCam();if(d&&d.replace<0)toast('Photo discarded');return true;}
  if(view==='pages'){clearUndo();goCam();return true;}
  if(view==='cam'&&replaceIdx>=0){replaceIdx=-1;goPages();return true;}
  closeScanner();return true;
}
W.openScanner=openScanner;W.closeScanner=closeScanner;W.scnBack=scnBack;
W.GRScan=Object.freeze({open:openScanner,close:closeScanner,back:scnBack,
  state:()=>({open:!!ov&&!ov.hidden,view,pages:pages.length,unsaved:unsaved(),worker:wkState,sheet:!!sheetEl&&!sheetEl.hidden,busy:!!busyEl&&!busyEl.hidden,
    draft:draft?{w:draft.w,h:draft.h,quad:draft.quad.map(p=>p.slice()),auto:!!draft.auto,rot:draft.rot,filter:draft.filter,edit:draft.edit,replace:draft.replace}:null,
    pending:pages.filter(p=>p.job).length,capture:lastCap,ids:pages.map(p=>p.id),cam:cam?{det:!!cam.det,q:cam.det?cam.det.map(p=>p.slice()):null,auto:!!cam.auto,armed:cam.armed,detMs:cam.detMs,score:cam.lastScore,torch:!!(cam.caps&&cam.caps.torch),live:!!(cam.v&&cam.v.videoWidth),vw:cam.v?cam.v.videoWidth:0,vh:cam.v?cam.v.videoHeight:0}:null,
    crop:crop&&draft&&crop.disp?{pts:draft.quad.map(p=>toScr(crop,p)),rect:crop.cv.getBoundingClientRect().toJSON(),drag:!!crop.drag,loupe:!crop.lp.hidden}:null}),
  lib:Object.freeze(Object.assign({buildPdf,jpegInfo,engine:()=>eng()},{call}))});
})();
