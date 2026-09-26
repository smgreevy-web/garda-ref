/* Garda Reference — Toolbox: the phone as an instrument (level, ruler, compass, camera measure …).
   Self-contained IIFE: no dependencies, no network, no external assets. Styles in toolbox.css (#tbx / .tbx scoped). */
(function(){
'use strict';
const W=window, D=document;

/* ---------- small helpers ---------- */
const LSget=(k,d)=>{try{const v=localStorage.getItem(k);return v==null?d:JSON.parse(v);}catch(e){return d;}};
const LSset=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v));}catch(e){}};
const LSdel=k=>{try{localStorage.removeItem(k);}catch(e){}};
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const p2=n=>String(n).padStart(2,'0');
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const R2D=180/Math.PI, D2R=Math.PI/180;
const fx=(v,d)=>(v==null||!isFinite(v))?'—':Number(v).toFixed(d);
const q=(r,s)=>r.querySelector(s), qa=(r,s)=>Array.from(r.querySelectorAll(s));
const svg=(p,cls)=>'<svg viewBox="0 0 24 24" aria-hidden="true"'+(cls?' class="'+cls+'"':'')+'>'+p+'</svg>';
function el(html){const t=D.createElement('template');t.innerHTML=html.trim();return t.content.firstElementChild;}
const wrap360=a=>((a%360)+360)%360;
const scrAngle=()=>{try{return (screen.orientation&&screen.orientation.angle)||W.orientation||0;}catch(e){return 0;}};
function vib(p){try{if(navigator.vibrate)navigator.vibrate(p);}catch(e){}}

/* ---------- pure maths (unit-tested) ---------- */
/* ITM (EPSG:2157): Transverse Mercator on GRS80, Krüger n-series (sub-mm over Ireland) */
function toITM(lat,lon){
  const a=6378137, f=1/298.257222101, k0=0.99982, FE=600000, FN=750000, lat0=53.5*D2R, lon0=-8*D2R;
  const n=f/(2-f), n2=n*n, n3=n2*n, n4=n3*n, e=Math.sqrt(f*(2-f));
  const A=a/(1+n)*(1+n2/4+n4/64);
  const al=[n/2-2*n2/3+5*n3/16+41*n4/180, 13*n2/48-3*n3/5+557*n4/1440, 61*n3/240-103*n4/140, 49561*n4/161280];
  const xe=(phi,lam)=>{
    const s=Math.sin(phi), t=Math.sinh(Math.atanh(s)-e*Math.atanh(e*s));
    const xp=Math.atan2(t,Math.cos(lam)), ep=Math.atanh(Math.sin(lam)/Math.sqrt(1+t*t));
    let xi=xp, eta=ep;
    for(let j=1;j<=4;j++){xi+=al[j-1]*Math.sin(2*j*xp)*Math.cosh(2*j*ep);eta+=al[j-1]*Math.cos(2*j*xp)*Math.sinh(2*j*ep);}
    return [xi,eta];
  };
  const r=xe(lat*D2R,lon*D2R-lon0), r0=xe(lat0,0);
  return {e:FE+k0*A*r[1], n:FN+k0*A*(r[0]-r0[0])};
}
/* calculator: recursive-descent parser (no eval). + − × ÷ ^ ( ) % unary ± */
function calc(src){
  const s=String(src).replace(/×/g,'*').replace(/÷/g,'/').replace(/[−–]/g,'-').replace(/,/g,'').replace(/\s+/g,'');
  let i=0;
  const bad=m=>{throw new Error(m||'Syntax error');};
  const num=()=>{const m=/^(\d+\.?\d*|\.\d+)(e[+-]?\d+)?/i.exec(s.slice(i));if(!m)bad();i+=m[0].length;return parseFloat(m[0]);};
  const prim=()=>{let v;if(s[i]==='('){i++;v=expr();if(s[i]!==')')bad('Missing )');i++;}else v=num();while(s[i]==='%'){i++;v/=100;}return v;};
  const pow=()=>{const b=prim();if(s[i]==='^'){i++;return Math.pow(b,unary());}return b;};
  const unary=()=>{if(s[i]==='-'){i++;return -unary();}if(s[i]==='+'){i++;return unary();}return pow();};
  const term=()=>{let v=unary();for(;;){if(s[i]==='*'){i++;v*=unary();}else if(s[i]==='/'){i++;const d=unary();if(d===0)bad('Can’t divide by 0');v/=d;}else return v;}};
  function expr(){let v=term();for(;;){if(s[i]==='+'){i++;v+=term();}else if(s[i]==='-'){i++;v-=term();}else return v;}}
  if(!s)bad('Empty');
  const v=expr();
  if(i<s.length)bad();
  if(!isFinite(v))bad('Out of range');
  return parseFloat(v.toPrecision(12));
}
const CARD=['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
const CARDW={N:'north',NNE:'north-north-east',NE:'north-east',ENE:'east-north-east',E:'east',ESE:'east-south-east',SE:'south-east',SSE:'south-south-east',
  S:'south',SSW:'south-south-west',SW:'south-west',WSW:'west-south-west',W:'west',WNW:'west-north-west',NW:'north-west',NNW:'north-north-west'};
const cardinal=d=>CARD[Math.round(wrap360(d)/22.5)%16];
/* world "up" expressed in device axes (x right, y top, z out of screen) from DeviceOrientation beta/gamma */
function upVec(b,g){b*=D2R;g*=D2R;return [-Math.cos(b)*Math.sin(g), Math.sin(b), Math.cos(b)*Math.cos(g)];}
/* angle of the rear-camera axis from straight down (0 = pointing at the ground, 90 = level) */
function camTilt(b,g){return Math.acos(clamp(Math.cos(b*D2R)*Math.cos(g*D2R),-1,1))*R2D;}
/* compass heading (clockwise from N) of the rear camera; of the phone's top edge when lying flat */
function headingOf(a,b,g){
  const x=b*D2R,y=g*D2R,z=a*D2R,cX=Math.cos(x),cY=Math.cos(y),cZ=Math.cos(z),sX=Math.sin(x),sY=Math.sin(y),sZ=Math.sin(z);
  const Vx=-cZ*sY-sZ*sX*cY, Vy=-sZ*sY+cZ*sX*cY;
  if(Math.hypot(Vx,Vy)>0.5)return {deg:wrap360(Math.atan2(Vx,Vy)*R2D),cam:true};
  return {deg:wrap360(360-a+scrAngle()),cam:false};
}
function stamp(d){
  d=d||new Date();const o=-d.getTimezoneOffset(),oa=Math.abs(o);
  return {d:p2(d.getDate())+'/'+p2(d.getMonth()+1)+'/'+d.getFullYear(), t:p2(d.getHours())+':'+p2(d.getMinutes())+':'+p2(d.getSeconds()),
    tz:'UTC'+(o<0?'-':'+')+p2(Math.floor(oa/60))+':'+p2(oa%60),
    f:d.getFullYear()+p2(d.getMonth()+1)+p2(d.getDate())+'_'+p2(d.getHours())+p2(d.getMinutes())+p2(d.getSeconds())};
}
function dms(v,pos,neg){const h=v<0?neg:pos;v=Math.abs(v);let d=Math.floor(v),m=Math.floor((v-d)*60),s=(v-d-m/60)*3600;
  if(s>=59.95){s=0;m++;}if(m>=60){m=0;d++;}return d+'°'+p2(m)+'′'+s.toFixed(1).padStart(4,'0')+'″'+h;}
function fix(pos){ /* position → display strings */
  if(!pos)return null;const c=pos.coords,it=toITM(c.latitude,c.longitude);
  return {lat:c.latitude,lon:c.longitude,ll:c.latitude.toFixed(6)+', '+c.longitude.toFixed(6),acc:Math.round(c.accuracy),
    itm:'E '+it.e.toFixed(0)+' N '+it.n.toFixed(0),it,time:new Date(pos.timestamp||Date.now())};
}
const headTxt=h=>h==null?'—':Math.round(wrap360(h))%360+'° '+cardinal(h);

/* ---------- session: everything a tool starts is registered here and torn down on close ---------- */
function mkSess(){
  const fns=[];
  const s={alive:true,
    clean(f){if(s.alive)fns.push(f);else{try{f();}catch(e){}}return f;},
    on(t,ev,fn,o){t.addEventListener(ev,fn,o);s.clean(()=>t.removeEventListener(ev,fn,o));},
    every(ms,fn){const id=setInterval(()=>{if(s.alive)fn();},ms);s.clean(()=>clearInterval(id));return id;},
    after(ms,fn){const id=setTimeout(()=>{if(s.alive)fn();},ms);s.clean(()=>clearTimeout(id));return id;},
    loop(fn){let id=0;const f=t=>{if(!s.alive)return;try{fn(t);}catch(e){console.error(e);}id=requestAnimationFrame(f);};
      id=requestAnimationFrame(f);s.clean(()=>cancelAnimationFrame(id));},
    child(){const c=mkSess();s.clean(()=>c.end());return c;},
    end(){if(!s.alive)return;s.alive=false;while(fns.length){const f=fns.pop();try{f();}catch(e){}}}
  };
  return s;
}

/* ---------- device access (all auto-released through the session) ---------- */
function orient(s,cb,onNone){
  const st={b:null,g:null,a:null,head:null,cam:false,abs:false};let absSeen=false,got=false;
  const upd=(e,isAbs)=>{
    if(e.beta==null&&e.gamma==null)return;
    got=true;st.b=+e.beta||0;st.g=+e.gamma||0;
    if(e.webkitCompassHeading!=null&&!isNaN(e.webkitCompassHeading)){st.head=+e.webkitCompassHeading;st.cam=false;st.abs=true;}
    else if((isAbs||e.absolute===true)&&e.alpha!=null){absSeen=true;st.a=+e.alpha;const h=headingOf(st.a,st.b,st.g);st.head=h.deg;st.cam=h.cam;st.abs=true;}
    else if(!absSeen)st.a=e.alpha;
    cb(st);
  };
  const start=()=>{
    if(!s.alive)return;
    if('ondeviceorientationabsolute' in W)s.on(W,'deviceorientationabsolute',e=>upd(e,true));
    s.on(W,'deviceorientation',e=>upd(e,false));
    s.after(2600,()=>{if(!got&&onNone)onNone(false);});
  };
  const P=W.DeviceOrientationEvent;
  if(P&&typeof P.requestPermission==='function')P.requestPermission().then(r=>{if(r==='granted')start();else if(onNone)onNone(true);}).catch(()=>{if(onNone)onNone(true);});
  else start();
  return st;
}
function motion(s,cb,onNone){
  let got=false;
  const start=()=>{
    if(!s.alive)return;
    s.on(W,'devicemotion',e=>{const a=e.acceleration,g=e.accelerationIncludingGravity;
      if(!(a&&a.x!=null)&&!(g&&g.x!=null))return;got=true;cb(e);});
    s.after(2600,()=>{if(!got&&onNone)onNone(false);});
  };
  const P=W.DeviceMotionEvent;
  if(P&&typeof P.requestPermission==='function')P.requestPermission().then(r=>{if(r==='granted')start();else if(onNone)onNone(true);}).catch(()=>{if(onNone)onNone(true);});
  else start();
}
const NOSENSOR=denied=>denied?'Motion-sensor permission was refused. Allow “Motion sensors” for this site in Chrome settings, then reopen the tool.'
  :'No motion sensor reading yet. This tool needs a phone (it does nothing on a desktop computer).';
function openCam(s,host,facing,hi){
  const v=D.createElement('video');v.setAttribute('playsinline','');v.setAttribute('muted','');v.muted=true;v.autoplay=true;
  host.insertBefore(v,host.firstChild);
  const md=navigator.mediaDevices;
  if(!md||!md.getUserMedia)return Promise.reject(Object.assign(new Error(W.isSecureContext?'This browser cannot use the camera.':'The camera needs the app to be opened over https.'),{name:'NoCam'}));
  const vc={facingMode:{ideal:facing||'environment'}};if(hi){vc.width={ideal:1920};vc.height={ideal:1080};}
  return md.getUserMedia({audio:false,video:vc}).then(st=>{
    const tracks=st.getTracks(),stop=()=>{tracks.forEach(t=>{try{t.stop();}catch(e){}});try{v.srcObject=null;}catch(e){}};
    if(!s.alive){stop();throw Object.assign(new Error('closed'),{name:'Closed'});}
    s.clean(stop);
    v.srcObject=st;const pr=v.play();if(pr&&pr.catch)pr.catch(()=>{});
    const track=st.getVideoTracks()[0];
    const cam={v,st,track,caps:{},torch:on=>track.applyConstraints({advanced:[{torch:!!on}]})};
    const readCaps=()=>{try{cam.caps=(track.getCapabilities&&track.getCapabilities())||{};}catch(e){cam.caps={};}};
    readCaps();
    return new Promise(res=>{
      let done=false;const fin=()=>{if(done)return;done=true;setTimeout(()=>{readCaps();res(cam);},250);};
      if(v.readyState>=1)fin();else{v.addEventListener('loadedmetadata',fin,{once:true});setTimeout(fin,2500);}
    });
  });
}
function camErr(e){
  const n=e&&e.name;
  if(n==='NotAllowedError'||n==='SecurityError'||n==='PermissionDeniedError')return 'Camera permission was refused. Allow the camera for this site (Chrome › site settings), then reopen the tool.';
  if(n==='NotFoundError'||n==='OverconstrainedError'||n==='DevicesNotFoundError')return 'No suitable camera was found on this device.';
  if(n==='NotReadableError'||n==='TrackStartError')return 'The camera is in use by another app. Close it and try again.';
  return (e&&e.message)||'Camera unavailable.';
}
function gps(s,cb,err){
  if(!navigator.geolocation){if(err)err('This browser has no location access.',2);return ()=>{};}
  const id=navigator.geolocation.watchPosition(p=>{if(s.alive)cb(p);},e=>{if(!s.alive||!err)return;
    err(e.code===1?'Location permission refused — allow location for this site to use GPS.':e.code===3?'Still waiting for a GPS fix…':'Location unavailable ('+(e.message||'no fix')+').',e.code);},
    {enableHighAccuracy:true,maximumAge:2000,timeout:30000});
  const stop=()=>{try{navigator.geolocation.clearWatch(id);}catch(e){}};s.clean(stop);return stop;
}
function wake(s){ /* screen wake lock, re-acquired when the page becomes visible again */
  let lock=null,want=true;
  const req=()=>{if(!want||!s.alive||!navigator.wakeLock||D.visibilityState!=='visible')return;
    navigator.wakeLock.request('screen').then(l=>{if(!want||!s.alive){l.release().catch(()=>{});return;}lock=l;}).catch(()=>{});};
  const vis=()=>{if(D.visibilityState==='visible')req();};
  D.addEventListener('visibilitychange',vis);req();
  const stop=()=>{want=false;D.removeEventListener('visibilitychange',vis);if(lock){lock.release().catch(()=>{});lock=null;}};
  s.clean(stop);return stop;
}
function audioCtx(s){
  const AC=W.AudioContext||W.webkitAudioContext;if(!AC)return null;
  const ac=new AC();s.clean(()=>{try{ac.close();}catch(e){}});if(ac.resume)ac.resume().catch(()=>{});return ac;
}
function beep(ac,freq,dur,at){
  if(!ac||ac.state==='closed')return;const t=(at==null?ac.currentTime:at),o=ac.createOscillator(),g=ac.createGain();
  o.type='square';o.frequency.value=freq||880;g.gain.setValueAtTime(0.0001,t);g.gain.exponentialRampToValueAtTime(0.35,t+0.012);
  g.gain.exponentialRampToValueAtTime(0.0001,t+(dur||0.18));o.connect(g);g.connect(ac.destination);o.start(t);o.stop(t+(dur||0.18)+0.03);
}
function cvFit(cv){
  const r=cv.getBoundingClientRect(),dpr=W.devicePixelRatio||1,w=Math.max(1,Math.round(r.width)),h=Math.max(1,Math.round(r.height));
  if(cv.width!==Math.round(w*dpr)||cv.height!==Math.round(h*dpr)){cv.width=Math.round(w*dpr);cv.height=Math.round(h*dpr);}
  const c=cv.getContext('2d');c.setTransform(dpr,0,0,dpr,0,0);return {c,w,h};
}
function copyText(t){
  const fb=()=>{const ta=D.createElement('textarea');ta.value=t;ta.setAttribute('readonly','');ta.style.cssText='position:fixed;left:0;top:0;opacity:0';
    (ov||D.body).appendChild(ta);ta.select();let ok=false;try{ok=D.execCommand('copy');}catch(e){}ta.remove();toast(ok?'Copied':'Copy failed — select the text and copy it manually');};
  if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(t).then(()=>toast('Copied to clipboard'),fb);else fb();
}
/* photo with a data panel burned in underneath (panel is part of the JPEG) */
function burn(src,sw,sh,lines,overlay){
  const w=Math.max(640,sw),sc=w/sw,h=Math.round(sh*sc),fs=Math.max(15,Math.round(w/44)),lh=Math.round(fs*1.36),pad=Math.round(fs*0.85);
  const cv=D.createElement('canvas'),c=cv.getContext('2d'),font=b=>(b?'700 ':'500 ')+fs+'px ui-monospace,Menlo,Consolas,"Roboto Mono",monospace';
  const out=[];c.font=font(false);
  lines.forEach((ln,i)=>{const words=String(ln).split(' ');let cur='';
    words.forEach(wd=>{const t=cur?cur+' '+wd:wd;if(c.measureText(t).width>w-pad*2&&cur){out.push([cur,i===0]);cur='  '+wd;}else cur=t;});out.push([cur,i===0]);});
  const ph=pad*2+out.length*lh;cv.width=w;cv.height=h+ph;
  c.fillStyle='#000';c.fillRect(0,0,w,h);c.drawImage(src,0,0,w,h);
  if(overlay)overlay(c,w,h);
  c.fillStyle='#0a1930';c.fillRect(0,h,w,ph);c.fillStyle='#d4af37';c.fillRect(0,h,w,Math.max(3,Math.round(fs/5)));
  c.textBaseline='top';
  out.forEach((o,i)=>{c.font=font(o[1]);c.fillStyle=o[1]?'#d4af37':'#eef2f8';c.fillText(o[0],pad,h+pad+i*lh+Math.round(fs*0.12),w-pad*2);});
  return cv;
}
function saveJpeg(s,cv,name){
  return new Promise(res=>{
    const go=b=>{if(!b){toast('Could not create the photo');res(false);return;}
      const u=URL.createObjectURL(b),a=D.createElement('a');a.href=u;a.download=name;a.rel='noopener';a.style.display='none';
      (ov||D.body).appendChild(a);a.click();a.remove();
      const rv=()=>{try{URL.revokeObjectURL(u);}catch(e){}};s.after(60000,rv);s.clean(rv);
      toast('Saved '+name+' to Downloads');res(true);};
    try{cv.toBlob(go,'image/jpeg',0.92);}catch(e){toast('Could not create the photo: '+e.message);res(false);}
  });
}
function crosshair(c,w,h){const r=Math.round(Math.min(w,h)*0.045),L=r*2.6;c.save();c.translate(w/2,h/2);c.lineWidth=Math.max(2,r/6);
  c.strokeStyle='rgba(0,0,0,.7)';c.lineWidth+=2;c.beginPath();c.moveTo(-L,0);c.lineTo(L,0);c.moveTo(0,-L);c.lineTo(0,L);c.stroke();c.beginPath();c.arc(0,0,r,0,7);c.stroke();
  c.lineWidth-=2;c.strokeStyle='#d4af37';c.beginPath();c.moveTo(-L,0);c.lineTo(L,0);c.moveTo(0,-L);c.lineTo(0,L);c.stroke();c.beginPath();c.arc(0,0,r,0,7);c.stroke();c.restore();}

/* ---------- icons (stroke line art, currentColor) ---------- */
const IC={
  torch:'<path d="M8 2.5h8v4.2l-2 3V20a1.5 1.5 0 0 1-1.5 1.5h-1A1.5 1.5 0 0 1 10 20V9.7l-2-3z"/><path d="M8 6.7h8M12 12.5V15"/>',
  level:'<rect x="2" y="8" width="20" height="8" rx="2.5"/><path d="M9 8v8M15 8v8"/><circle cx="12" cy="12" r="1.6"/>',
  angle:'<path d="M3.5 20h17M3.5 20 16 7.5"/><path d="M10 20a6.5 6.5 0 0 0-1.9-4.6"/>',
  compass:'<circle cx="12" cy="12" r="9.2"/><path d="m15.6 8.4-2.3 4.9-4.9 2.3 2.3-4.9z"/><path d="M12 2.8v1.7M12 19.5v1.7M2.8 12h1.7M19.5 12h1.7"/>',
  ruler:'<rect x="1.8" y="7.5" width="20.4" height="9" rx="1.5"/><path d="M5.5 7.5v3M9 7.5v4.5M12.5 7.5v3M16 7.5v4.5M19.5 7.5v3"/>',
  measure:'<path d="M4 21V5M4 21h16"/><path d="M4 21 19 6" stroke-dasharray="2.2 2.2"/><path d="M4 17h4v4"/><path d="M16.5 3.5 19.5 6l-3 2.5"/>',
  speed:'<path d="M3.5 17.5a8.5 8.5 0 1 1 17 0"/><path d="m12 17.5 4.2-5.2"/><circle cx="12" cy="17.5" r="1.3"/><path d="m6.5 11.5 1 .8M12 8.5v1.3M17.5 11.5l-1 .8"/>',
  location:'<path d="M12 21.5s7-6.4 7-12a7 7 0 0 0-14 0c0 5.6 7 12 7 12z"/><circle cx="12" cy="9.5" r="2.6"/>',
  stopwatch:'<circle cx="12" cy="13.5" r="7.8"/><path d="M12 13.5V9.3M9.5 2.5h5M12 2.5v3.2M18.2 6.8l1.6-1.6"/>',
  timer:'<path d="M6.5 2.5h11M6.5 21.5h11"/><path d="M8 2.5v3.2a4 4 0 0 0 1.6 3.2L12 10.7l2.4-1.8A4 4 0 0 0 16 5.7V2.5M8 21.5v-3.2a4 4 0 0 1 1.6-3.2l2.4-1.8 2.4 1.8a4 4 0 0 1 1.6 3.2v3.2"/>',
  counter:'<path d="M5 5v14M9 5v14M13 5v14M17 5v14M3 16.5 20 7.5"/>',
  sound:'<path d="M3.5 9.5h3.8L12 5.5v13l-4.7-4H3.5z"/><path d="M15.5 9a4.2 4.2 0 0 1 0 6M18.3 6.3a8 8 0 0 1 0 11.4"/>',
  magnifier:'<circle cx="10.5" cy="10.5" r="6.8"/><path d="m15.5 15.5 5.5 5.5M10.5 7.6v5.8M7.6 10.5h5.8"/>',
  mirror:'<ellipse cx="12" cy="9.8" rx="6.2" ry="7.6"/><path d="M12 17.4v4.1M8.5 21.5h7M9.2 8.2l3-3M9.6 11.8l5-5"/>',
  scanner:'<path d="M3 8V4.5A1.5 1.5 0 0 1 4.5 3H8M16 3h3.5A1.5 1.5 0 0 1 21 4.5V8M21 16v3.5a1.5 1.5 0 0 1-1.5 1.5H16M8 21H4.5A1.5 1.5 0 0 1 3 19.5V16"/><path d="M7 7.5v9M10 7.5v9M13.5 7.5v9M17 7.5v9"/>',
  nfc:'<rect x="3" y="3" width="18" height="18" rx="4"/><path d="M8.5 9.3a4 4 0 0 1 0 5.4M11.5 7.5a7 7 0 0 1 0 9M14.5 5.8a10 10 0 0 1 0 12.4"/>',
  converter:'<path d="M4 8h15M15.5 4.5 19 8l-3.5 3.5M20 16H5M8.5 12.5 5 16l3.5 3.5"/>',
  calculator:'<rect x="4.5" y="2.5" width="15" height="19" rx="2.2"/><path d="M8 6.5h8v3H8z"/><path d="M8.3 13.2h.01M12 13.2h.01M15.7 13.2h.01M8.3 17.2h.01M12 17.2h.01M15.7 17.2h.01" stroke-width="2.6"/>',
  camera:'<path d="M3 8.3A1.3 1.3 0 0 1 4.3 7h2.9l1.8-2.5h6L16.8 7h2.9A1.3 1.3 0 0 1 21 8.3v10.4a1.3 1.3 0 0 1-1.3 1.3H4.3A1.3 1.3 0 0 1 3 18.7z"/><circle cx="12" cy="13.3" r="3.8"/>',
  vibro:'<rect x="8" y="3" width="8" height="18" rx="1.8"/><path d="M4.8 8v8M2 10v4M19.2 8v8M22 10v4"/>',
  device:'<rect x="6" y="2.5" width="12" height="19" rx="2.2"/><path d="M10.5 18.5h3"/><rect x="9.2" y="7" width="5.6" height="8" rx="1"/><path d="M11 6.2h2"/>',
  cross:'<circle cx="12" cy="12" r="6.5"/><path d="M12 2.5v5M12 16.5v5M2.5 12h5M16.5 12h5"/><circle cx="12" cy="12" r=".8"/>',
  power:'<path d="M12 3v8.5"/><path d="M6.3 6.8a8 8 0 1 0 11.4 0"/>',
  copy:'<rect x="8.5" y="8.5" width="12" height="12" rx="2"/><path d="M15.5 8.5V5A1.5 1.5 0 0 0 14 3.5H5A1.5 1.5 0 0 0 3.5 5v9A1.5 1.5 0 0 0 5 15.5h3.5"/>',
  shot:'<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="3.5"/>'
};

/* ---------- overlay, grid, navigation ---------- */
const GROUPS=['Scene & measurement','Timing & counting','Sound & vision','Everyday'];
const TOOLS=[],BY={};
function tool(id,name,g,icon,run,full){const t={id,name,g,icon,run,full:!!full};TOOLS.push(t);BY[id]=t;}
let ov=null,mainEl=null,ttlEl=null,toastEl=null,cur=null,sess=null,toastT=0;
function toast(m){if(!toastEl)return;toastEl.textContent=m;toastEl.classList.add('tbx-on');clearTimeout(toastT);toastT=setTimeout(()=>toastEl&&toastEl.classList.remove('tbx-on'),2800);}
function build(){
  if(ov&&ov.isConnected)return;
  if(!D.querySelector('link[href*="toolbox.css"]')){const l=D.createElement('link');l.rel='stylesheet';l.href='toolbox.css';D.head.appendChild(l);}
  ov=el('<div id="tbx" class="tbx" role="dialog" aria-modal="true" aria-label="Toolbox" tabindex="-1" hidden>'
    +'<div class="tbx-top"><button type="button" class="tbx-back" aria-label="Back">‹ Back</button>'
    +'<div class="tbx-tt"><b class="tbx-title">Toolbox</b><span class="hudclock" data-f="line"></span></div></div>'
    +'<div class="tbx-main"></div><div class="tbx-toast" role="status" aria-live="polite"></div></div>');
  D.body.appendChild(ov);
  mainEl=q(ov,'.tbx-main');ttlEl=q(ov,'.tbx-title');toastEl=q(ov,'.tbx-toast');
  q(ov,'.tbx-back').addEventListener('click',()=>tbxBack());
}
let keyOn=false;
function onKey(e){if(e.key!=='Escape'||!ov||ov.hidden)return;e.preventDefault();e.stopPropagation();tbxBack();}
function show(){ov.hidden=false;if(!keyOn){W.addEventListener('keydown',onKey,true);keyOn=true;}try{ov.focus({preventScroll:true});}catch(e){}}
function endTool(){if(sess){const s=sess;sess=null;s.end();}cur=null;}
function hud(){try{if(W.grHudTick)W.grHudTick();}catch(e){}}
function gridEl(){
  let h='<div class="tbx-scroll"><div class="tbx-gridv">';
  GROUPS.forEach((g,gi)=>{
    h+='<h3 class="tbx-sec">'+esc(g)+'</h3><div class="tbx-grid">';
    TOOLS.filter(t=>t.g===gi).forEach(t=>{h+='<button type="button" class="tbx-tile" data-id="'+t.id+'">'+svg(IC[t.icon])+'<span>'+esc(t.name)+'</span></button>';});
    h+='</div>';
  });
  h+='<p class="tbx-foot">All tools work offline on this phone. Nothing is uploaded or stored in the app — photos go only to your Downloads. Sensor figures are estimates: note how they were obtained.</p></div></div>';
  const g=el(h);g.addEventListener('click',e=>{const b=e.target.closest('.tbx-tile');if(b)openTool(b.dataset.id);});return g;
}
let gridScroll=0;
function showGrid(){
  endTool();ttlEl.textContent='Toolbox';mainEl.textContent='';const g=gridEl();mainEl.appendChild(g);g.scrollTop=gridScroll;
  g.addEventListener('scroll',()=>{gridScroll=g.scrollTop;},{passive:true});hud();
}
function openToolbox(){build();showGrid();show();return true;}
function openTool(id){
  const t=BY[id];if(!t)return false;
  build();endTool();show();cur=id;ttlEl.textContent=t.name;mainEl.textContent='';
  const box=el('<div class="tbx-tool" data-tool="'+t.id+'"></div>');mainEl.appendChild(box);
  sess=mkSess();
  try{t.run(sess,box);}catch(e){console.error(e);box.innerHTML='<div class="tbx-body"><div class="tbx-warn">This tool could not start: '+esc(e.message)+'</div></div>';}
  hud();return true;
}
function closeToolbox(){endTool();if(keyOn){W.removeEventListener('keydown',onKey,true);keyOn=false;}if(ov){ov.hidden=true;mainEl.textContent='';clearTimeout(toastT);toastEl.classList.remove('tbx-on');}}
function tbxBack(){if(!ov||ov.hidden||!ov.isConnected)return false;if(cur)showGrid();else closeToolbox();return true;}
function segBind(seg,fn){seg.addEventListener('click',e=>{const b=e.target.closest('button');if(!b||!seg.contains(b))return;
  qa(seg,'button').forEach(x=>x.classList.toggle('tbx-on',x===b));fn(b);});}

/* =====================================================================
   SCENE & MEASUREMENT
   ===================================================================== */
const SOS=[[1,1],[0,1],[1,1],[0,1],[1,1],[0,3],[1,3],[0,1],[1,3],[0,1],[1,3],[0,3],[1,1],[0,1],[1,1],[0,1],[1,1],[0,7]];
tool('torch','Torch',0,'torch',function(s,box){
  box.innerHTML='<div class="tbx-body tbx-center">'
    +'<button type="button" class="tbx-power" aria-pressed="false" aria-label="Torch on or off">'+svg(IC.power)+'<span>OFF</span></button>'
    +'<div class="tbx-seg tbx-t-mode" role="group" aria-label="Light mode"><button type="button" data-m="steady" class="tbx-on">Steady</button><button type="button" data-m="sos">SOS</button><button type="button" data-m="strobe">Strobe</button></div>'
    +'<p class="tbx-note tbx-t-st">Starting the camera torch…</p>'
    +'<div class="tbx-row"><button type="button" class="tbx-btn tbx-t-scr">'+svg(IC.device)+'Screen light</button></div>'
    +'<p class="tbx-note">The torch is the rear camera flash and stays on only while this screen is open. Screen light: turn your brightness to maximum.</p></div>'
    +'<div class="tbx-screenlight" hidden><span>Tap anywhere to turn off · brightness to max</span></div>';
  const pw=q(box,'.tbx-power'),st=q(box,'.tbx-t-st'),sl=q(box,'.tbx-screenlight');
  let cam=null,torchOK=false,on=false,mode='steady',screen=false,run=null,wk=null;
  const lamp=v=>{if(screen)sl.classList.toggle('tbx-off',!v);else if(cam&&torchOK)cam.torch(v).catch(()=>{});};
  function apply(){
    if(run){run.end();run=null;}
    pw.classList.toggle('tbx-on',on);pw.setAttribute('aria-pressed',String(on));pw.lastChild.textContent=on?'ON':'OFF';
    sl.hidden=!(screen&&on);
    if(on&&!wk)wk=wake(s);if(!on&&wk){wk();wk=null;}
    if(!on){if(cam&&torchOK)cam.torch(false).catch(()=>{});return;}
    if(mode==='steady'){lamp(true);return;}
    run=s.child();const seq=mode==='sos'?SOS:[[1,1],[0,1]],unit=mode==='sos'?220:120;let i=0,tm=0;
    const step=()=>{if(!run||!run.alive)return;const x=seq[i++%seq.length];lamp(!!x[0]);tm=setTimeout(step,x[1]*unit);};
    run.clean(()=>clearTimeout(tm));step();
  }
  pw.addEventListener('click',()=>{if(!torchOK&&!screen){screen=true;}on=!on;apply();});
  segBind(q(box,'.tbx-t-mode'),b=>{mode=b.dataset.m;if(on)apply();});
  q(box,'.tbx-t-scr').addEventListener('click',()=>{if(on&&!screen){on=false;apply();}screen=true;on=true;apply();});
  sl.addEventListener('click',()=>{on=false;apply();if(!torchOK)return;screen=false;});
  s.clean(()=>{if(cam&&torchOK)cam.torch(false).catch(()=>{});});
  openCam(s,box,'environment',false).then(c=>{
    cam=c;c.v.style.cssText='position:absolute;width:2px;height:2px;opacity:0;pointer-events:none;left:0;top:0';
    torchOK=!!(c.caps&&c.caps.torch);
    st.textContent=torchOK?'Camera torch ready — tap the button.':'This phone/browser does not let web apps use the camera torch. Use the screen light instead.';
    if(!torchOK){c.st.getTracks().forEach(t=>t.stop());cam=null;q(box,'.tbx-t-scr').classList.add('tbx-gold');}
  }).catch(e=>{if(!s.alive)return;st.textContent=camErr(e)+' The screen light still works.';q(box,'.tbx-t-scr').classList.add('tbx-gold');});
});

tool('level','Spirit level',0,'level',function(s,box){
  box.innerHTML='<div class="tbx-body tbx-center">'
    +'<div class="tbx-seg tbx-l-mode" role="group" aria-label="Level mode"><button type="button" data-m="auto" class="tbx-on">Auto</button><button type="button" data-m="flat">Flat</button><button type="button" data-m="edge">On edge</button></div>'
    +'<div class="tbx-cvwrap"><canvas aria-label="Level display"></canvas></div>'
    +'<div class="tbx-readrow"><div><small class="tbx-l-la">X</small><b class="tbx-l-x tbx-num">—</b></div><div class="tbx-l-yb"><small>Y (top–bottom)</small><b class="tbx-l-y tbx-num">—</b></div></div>'
    +'<div class="tbx-row"><button type="button" class="tbx-btn tbx-l-hold">Hold</button><button type="button" class="tbx-btn tbx-l-zero">Zero</button><button type="button" class="tbx-btn tbx-l-rst">Reset zero</button></div>'
    +'<p class="tbx-note tbx-l-msg">Flat on a surface → bubble level. Standing on its edge → bar level. Green = level within ±0.5°. Tap the dial to hold a reading.</p></div>';
  const cv=q(box,'canvas'),xb=q(box,'.tbx-l-x'),yb=q(box,'.tbx-l-y'),yw=q(box,'.tbx-l-yb'),la=q(box,'.tbx-l-la'),hb=q(box,'.tbx-l-hold'),msg=q(box,'.tbx-l-msg');
  let mode='auto',auto='flat',held=false,u=null,sm=null,z=LSget('tbx_lvl0',{x:0,y:0,e:0}),last=null;
  orient(s,st=>{u=upVec(st.b,st.g);},d=>{msg.textContent=NOSENSOR(d);msg.classList.add('tbx-warn');});
  segBind(q(box,'.tbx-l-mode'),b=>{mode=b.dataset.m;});
  const hold=()=>{held=!held;hb.classList.toggle('tbx-on',held);hb.textContent=held?'Held — tap to release':'Hold';};
  hb.addEventListener('click',hold);cv.addEventListener('click',hold);
  q(box,'.tbx-l-zero').addEventListener('click',()=>{if(!last)return;if(last.m==='flat'){z.x=last.rx;z.y=last.ry;}else z.e=last.re;LSset('tbx_lvl0',z);toast('Zeroed on this surface');});
  q(box,'.tbx-l-rst').addEventListener('click',()=>{z={x:0,y:0,e:0};LSdel('tbx_lvl0');toast('Zero reset');});
  const map=(a,R)=>R*(1-Math.exp(-Math.abs(a)/4));
  function reading(){
    const a=scrAngle()*D2R,sx=sm[0]*Math.cos(a)-sm[1]*Math.sin(a),sy=sm[0]*Math.sin(a)+sm[1]*Math.cos(a),sz=sm[2];
    if(Math.abs(sz)>0.85)auto='flat';else if(Math.abs(sz)<0.75)auto='edge';
    const m=mode==='auto'?auto:mode;
    const rx=Math.atan2(sx,sz)*R2D,ry=Math.atan2(sy,sz)*R2D,phi=Math.atan2(sx,sy)*R2D,k=Math.round(phi/90),re=phi-90*k;
    return {m,sx,sy,sz,rx,ry,re,vert:!!(k&1),x:rx-z.x,y:ry-z.y,e:re-z.e};
  }
  s.loop(()=>{
    if(u&&!held){sm=sm?sm.map((v,i)=>v+(u[i]-v)*0.2):u.slice();last=reading();}
    const {c,w,h}=cvFit(cv);c.clearRect(0,0,w,h);
    const r=last,cx=w/2,cy=h/2,R=Math.min(w,h)/2-6;
    if(!r||r.m==='flat'){
      const ok=r&&Math.abs(r.x)<=0.5&&Math.abs(r.y)<=0.5;
      const gr=c.createRadialGradient(cx,cy-R*.35,R*.1,cx,cy,R);gr.addColorStop(0,'#1a3a66');gr.addColorStop(1,'#081629');
      c.fillStyle=gr;c.beginPath();c.arc(cx,cy,R,0,7);c.fill();c.lineWidth=3;c.strokeStyle=ok?'#34c768':'#d4af37';c.stroke();
      c.lineWidth=1.2;c.strokeStyle='rgba(212,175,55,.45)';[0.5,2,5,10].forEach(d=>{c.beginPath();c.arc(cx,cy,map(d,R*0.86),0,7);c.stroke();});
      c.beginPath();c.moveTo(cx-R,cy);c.lineTo(cx+R,cy);c.moveTo(cx,cy-R);c.lineTo(cx,cy+R);c.stroke();
      c.fillStyle='rgba(159,176,200,.8)';c.font='600 11px ui-monospace,monospace';c.textAlign='left';
      [2,5,10].forEach(d=>c.fillText(d+'°',cx+map(d,R*0.86)+3,cy-4));
      let bx=cx,by=cy;
      if(r){const mag=Math.hypot(r.x,r.y),dirx=mag?r.x/mag:0,diry=mag?-r.y/mag:0,rr=map(mag,R*0.86);bx=cx+dirx*rr;by=cy+diry*rr;}
      c.beginPath();c.arc(bx,by,R*0.13,0,7);c.fillStyle=ok?'rgba(52,199,104,.9)':'rgba(212,175,55,.88)';c.fill();c.lineWidth=2;c.strokeStyle='#fff';c.stroke();
      la.textContent='X (left–right)';yw.hidden=false;
      xb.textContent=r?fx(r.x,1)+'°':'—';yb.textContent=r?fx(r.y,1)+'°':'—';
      xb.classList.toggle('tbx-ok',!!r&&Math.abs(r.x)<=0.5);yb.classList.toggle('tbx-ok',!!r&&Math.abs(r.y)<=0.5);
    }else{
      const ok=Math.abs(r.e)<=0.5,L=(r.vert?h:w)*0.94,T=Math.min(w,h)*0.2;
      c.save();c.translate(cx,cy);if(r.vert)c.rotate(Math.PI/2);
      c.fillStyle='#0d2446';c.strokeStyle=ok?'#34c768':'#d4af37';c.lineWidth=3;
      c.beginPath();if(c.roundRect)c.roundRect(-L/2,-T/2,L,T,T/2);else c.rect(-L/2,-T/2,L,T);c.fill();c.stroke();
      const bR=T*0.36;c.strokeStyle='rgba(238,242,248,.75)';c.lineWidth=2;
      c.beginPath();c.moveTo(-bR*1.25,-T/2);c.lineTo(-bR*1.25,T/2);c.moveTo(bR*1.25,-T/2);c.lineTo(bR*1.25,T/2);c.stroke();
      const along=r.vert?-r.sy:r.sx,off=Math.sign(along)*Math.min(L/2-bR-6,map(r.e,L/2-bR-6)*1.0);
      c.beginPath();c.arc(off,0,bR,0,7);c.fillStyle=ok?'rgba(52,199,104,.9)':'rgba(212,175,55,.9)';c.fill();c.lineWidth=2;c.strokeStyle='#fff';c.stroke();
      c.restore();
      la.textContent='Angle off level';yw.hidden=true;xb.textContent=fx(Math.abs(r.e),1)+'°';xb.classList.toggle('tbx-ok',ok);
    }
  });
});

tool('angle','Inclinometer',0,'angle',function(s,box){
  box.innerHTML='<div class="tbx-body tbx-center">'
    +'<div class="tbx-seg tbx-a-ax" role="group" aria-label="Axis"><button type="button" data-a="len" class="tbx-on">Along length</button><button type="button" data-a="wid">Along width</button></div>'
    +'<div class="tbx-cvwrap tbx-wide"><canvas aria-label="Slope drawing"></canvas></div>'
    +'<div class="tbx-big tbx-a-v tbx-num">—</div><div class="tbx-sub tbx-a-g">grade — · 1 : —</div><div class="tbx-a-rel" hidden><span class="tbx-pill">Relative to zero</span></div>'
    +'<div class="tbx-row"><button type="button" class="tbx-btn tbx-a-hold">Hold</button><button type="button" class="tbx-btn tbx-a-zero">Zero here</button><button type="button" class="tbx-btn tbx-a-rst">Absolute</button></div>'
    +'<p class="tbx-note tbx-a-msg">Lay the phone on the road, ramp or stair nosing with its long edge pointing up the slope (or stand it on that edge). “Zero here” then measures the angle between two surfaces.</p></div>';
  const cv=q(box,'canvas'),vb=q(box,'.tbx-a-v'),gb=q(box,'.tbx-a-g'),hb=q(box,'.tbx-a-hold'),rel=q(box,'.tbx-a-rel'),msg=q(box,'.tbx-a-msg');
  let ax='len',u=null,sm=null,held=false,z=0,ang=null;
  orient(s,st=>{u=upVec(st.b,st.g);},d=>{msg.textContent=NOSENSOR(d);msg.classList.add('tbx-warn');});
  segBind(q(box,'.tbx-a-ax'),b=>{ax=b.dataset.a;z=0;rel.hidden=true;});
  hb.addEventListener('click',()=>{held=!held;hb.classList.toggle('tbx-on',held);hb.textContent=held?'Held':'Hold';});
  q(box,'.tbx-a-zero').addEventListener('click',()=>{if(ang==null)return;z+=ang;rel.hidden=false;toast('Zeroed — now measuring relative angle');});
  q(box,'.tbx-a-rst').addEventListener('click',()=>{z=0;rel.hidden=true;});
  s.loop(()=>{
    if(u&&!held){sm=sm?sm.map((v,i)=>v+(u[i]-v)*0.2):u.slice();ang=Math.asin(clamp(ax==='len'?sm[1]:sm[0],-1,1))*R2D-z;}
    const {c,w,h}=cvFit(cv);c.clearRect(0,0,w,h);
    const a=(ang||0)*D2R,neg=a<0,ox=w*0.1,oy=neg?h*0.16:h*0.84,len=Math.min(w*0.8,(h*0.68)/Math.max(1e-6,Math.abs(Math.sin(a)))),ex=ox+len*Math.cos(a),ey=oy-len*Math.sin(a);
    c.strokeStyle='rgba(159,176,200,.6)';c.lineWidth=2;c.setLineDash([6,6]);c.beginPath();c.moveTo(ox,oy);c.lineTo(ox+w*0.8,oy);c.stroke();c.setLineDash([]);
    c.strokeStyle='#d4af37';c.lineWidth=6;c.lineCap='round';c.beginPath();c.moveTo(ox,oy);c.lineTo(ex,ey);c.stroke();
    const ar=Math.min(len*0.55,h*0.5);c.lineWidth=2.5;c.strokeStyle='#3ec8dd';c.beginPath();c.arc(ox,oy,ar,0,-a,a>0);c.stroke();
    if(ang!=null){c.fillStyle='#3ec8dd';c.font='700 14px ui-monospace,monospace';c.textBaseline='middle';c.fillText(fx(Math.abs(ang),1)+'°',ox+ar+8,oy-Math.sin(a/2)*ar*0.5-(neg?-10:10));}
    if(ang==null){vb.textContent='—';return;}
    const aa=Math.abs(ang),t=Math.tan(aa*D2R);
    vb.textContent=fx(ang,1)+'°';vb.classList.toggle('tbx-ok',aa<=0.5);
    gb.textContent='grade '+fx(t*100,1)+' % · '+(aa<0.05?'level':'1 : '+fx(1/t,1));
  });
});

tool('compass','Compass',0,'compass',function(s,box){
  box.innerHTML='<div class="tbx-body tbx-center">'
    +'<div class="tbx-cvwrap"><canvas aria-label="Compass dial"></canvas></div>'
    +'<div><span class="tbx-big tbx-c-deg tbx-num">—</span> <span class="tbx-unit tbx-c-card"></span></div>'
    +'<div class="tbx-card"><h4>For your notes</h4><div class="tbx-sentence tbx-c-sent">Waiting for the compass…</div><p class="tbx-note tbx-c-true"></p>'
    +'<div class="tbx-row"><button type="button" class="tbx-btn tbx-gold tbx-c-copy">'+svg(IC.copy)+'Copy</button><button type="button" class="tbx-btn tbx-c-hold">Hold</button></div></div>'
    +'<p class="tbx-note tbx-c-msg">Magnetic heading from the phone’s compass. Hold the phone upright to get the direction the camera faces, or flat for the direction the top points. Keep clear of cars, railings and radios; if it looks wrong, move the phone in a figure-8.</p></div>';
  const cv=q(box,'canvas'),db=q(box,'.tbx-c-deg'),cb=q(box,'.tbx-c-card'),sb=q(box,'.tbx-c-sent'),tb=q(box,'.tbx-c-true'),hb=q(box,'.tbx-c-hold'),msg=q(box,'.tbx-c-msg');
  let st0=null,sm=null,held=false,shown=null,camMode=false;
  const o=orient(s,st=>{st0=st;},d=>{msg.textContent=NOSENSOR(d);msg.classList.add('tbx-warn');});
  s.after(3500,()=>{if(o.b!=null&&o.head==null){sb.textContent='This phone/browser gives tilt but no compass heading.';}});
  hb.addEventListener('click',()=>{held=!held;hb.classList.toggle('tbx-on',held);hb.textContent=held?'Held':'Hold';});
  const sentence=()=>shown==null?'':(camMode?'Camera facing ':'Phone pointing ')+CARDW[cardinal(shown)]+' ('+Math.round(shown)%360+'°)';
  q(box,'.tbx-c-copy').addEventListener('click',()=>{if(shown==null){toast('No compass reading yet');return;}const t=stamp();
    copyText(sentence()+' — magnetic, phone compass (approx.); true ≈ '+Math.round(wrap360(shown-2))+'°. '+t.t+' '+t.d+'.');});
  s.loop(()=>{
    if(st0&&st0.head!=null&&!held){const hd=st0.head;sm=sm==null?hd:wrap360(sm+(((hd-sm+540)%360)-180)*0.15);shown=sm;camMode=st0.cam;}
    const {c,w,h}=cvFit(cv);c.clearRect(0,0,w,h);const cx=w/2,cy=h/2,R=Math.min(w,h)/2-10,hd=shown||0;
    c.fillStyle='#0b1d38';c.beginPath();c.arc(cx,cy,R,0,7);c.fill();c.lineWidth=2;c.strokeStyle='#1b3a66';c.stroke();
    c.save();c.translate(cx,cy);c.rotate(-hd*D2R);
    for(let d=0;d<360;d+=5){const big=d%30===0;c.save();c.rotate(d*D2R);c.strokeStyle=big?'#eef2f8':'rgba(159,176,200,.6)';c.lineWidth=big?2.5:1.2;
      c.beginPath();c.moveTo(0,-R+4);c.lineTo(0,-R+(big?20:11));c.stroke();
      if(big){c.fillStyle=d===0?'#e74c3c':(d%90===0?'#d4af37':'#9fb0c8');c.font=(d%90===0?'800 22px':'600 13px')+' system-ui,sans-serif';c.textAlign='center';c.textBaseline='middle';
        c.fillText(d%90===0?['N','E','S','W'][d/90]:String(d),0,-R+(d%90===0?40:34));}
      c.restore();}
    c.restore();
    c.fillStyle='#d4af37';c.beginPath();c.moveTo(cx,cy-R-6);c.lineTo(cx-10,cy-R+14);c.lineTo(cx+10,cy-R+14);c.closePath();c.fill();
    c.strokeStyle='rgba(212,175,55,.5)';c.lineWidth=1.5;c.beginPath();c.moveTo(cx,cy-R*0.55);c.lineTo(cx,cy+R*0.55);c.moveTo(cx-R*0.55,cy);c.lineTo(cx+R*0.55,cy);c.stroke();
    if(shown==null)return;
    db.textContent=Math.round(shown)%360+'°';cb.textContent=cardinal(shown)+' · magnetic';
    sb.textContent=sentence();tb.textContent='True ≈ '+Math.round(wrap360(shown-2))+'° (Dublin magnetic declination ≈ 2° W — approximate).';
  });
});

/* ---------- Ruler (Smart-Tools style: scale on both long edges, gold fill to a draggable edge) ---------- */
function pxmmEstimate(){ /* CSS px per mm: Android CSS px ≈ 1/160 in (dpr = density/160); desktop ≈ 1/96 in */
  const dpr=W.devicePixelRatio||1,coarse=!!(W.matchMedia&&W.matchMedia('(pointer:coarse)').matches);
  const ppi=dpr*(coarse?160:96);return ppi/dpr/25.4;
}
tool('ruler','Ruler',0,'ruler',function(s,box){
  box.innerHTML='<div class="tbx-rhost"><div class="tbx-rstage"><canvas class="tbx-rcv" aria-label="Ruler: tap or drag to set the measuring edge"></canvas>'
    +'<div class="tbx-rmid">'
      +'<div class="tbx-rread" aria-live="polite"><b class="tbx-r-v tbx-num">0.00</b><span class="tbx-r-u">cm</span><small class="tbx-r-s">0.0 mm</small></div>'
      +'<div class="tbx-rwarn tbx-r-w"></div>'
      +'<div class="tbx-rctl">'
        +'<div class="tbx-seg tbx-r-unit" role="group" aria-label="Units"><button type="button" data-u="in">inch</button><button type="button" data-u="cm">cm</button></div>'
        +'<button type="button" class="tbx-rbtn tbx-r-cal" aria-label="Calibrate">'+svg(IC.cross)+'</button>'
        +'<button type="button" class="tbx-rbtn tbx-r-dn" aria-label="Shorter">−</button><button type="button" class="tbx-rbtn tbx-r-up" aria-label="Longer">+</button>'
        +'<button type="button" class="tbx-rbtn tbx-r-long" aria-pressed="false">Long</button>'
        +'<button type="button" class="tbx-rbtn tbx-r-add" hidden>+ Add</button><button type="button" class="tbx-rbtn tbx-r-clr" hidden>Clear</button>'
      +'</div></div>'
    +'<div class="tbx-rcal" hidden><b>Calibrate</b>'
      +'<div class="tbx-seg tbx-r-ref" role="group" aria-label="Reference"><button type="button" data-r="card" class="tbx-on">Bank card</button><button type="button" data-r="coin">€1 coin</button></div>'
      +'<p class="tbx-r-ci"></p>'
      +'<div class="tbx-row"><button type="button" class="tbx-btn tbx-r-cm">−</button><button type="button" class="tbx-btn tbx-r-cp">+</button></div>'
      +'<div class="tbx-row"><button type="button" class="tbx-btn tbx-gold tbx-r-cs">Save</button><button type="button" class="tbx-btn tbx-r-cx">Cancel</button></div>'
      +'<button type="button" class="tbx-btn tbx-r-ce">Use estimate</button><small class="tbx-r-cv tbx-num"></small></div>'
    +'</div></div>';
  const host=q(box,'.tbx-rhost'),stage=q(box,'.tbx-rstage'),cv=q(box,'.tbx-rcv'),mid=q(box,'.tbx-rmid'),calP=q(box,'.tbx-rcal');
  const rv=q(box,'.tbx-r-v'),ru=q(box,'.tbx-r-u'),rs=q(box,'.tbx-r-s'),rw=q(box,'.tbx-r-w'),lg=q(box,'.tbx-r-long'),ad=q(box,'.tbx-r-add'),cl=q(box,'.tbx-r-clr');
  const EST=pxmmEstimate();
  let pxmm=+LSget('tbx_pxmm',0)||0,calibrated=pxmm>1;if(!calibrated)pxmm=EST;
  let unit=LSget('tbx_runit','cm')==='in'?'in':'cm',mm=0,segs=[],long=false,cal=null;
  let L=0,S=0,rot=false,band=60,dpr=1,ctx=null;const x0=14;
  qa(box,'.tbx-r-unit button').forEach(b=>b.classList.toggle('tbx-on',b.dataset.u===unit));
  /* try to go full screen + landscape; if refused we draw the ruler rotated along the long edge */
  try{if(ov.requestFullscreen&&!D.fullscreenElement){const p=ov.requestFullscreen({navigationUI:'hide'});
    if(p&&p.then)p.then(()=>{if(!s.alive)return;const so=screen.orientation;if(so&&so.lock)return so.lock('landscape');}).catch(()=>{});}}catch(e){}
  s.clean(()=>{try{const so=screen.orientation;if(so&&so.unlock)so.unlock();}catch(e){}
    try{if(D.fullscreenElement===ov&&D.exitFullscreen){const p=D.exitFullscreen();if(p&&p.catch)p.catch(()=>{});}}catch(e){}});
  function layout(){
    const w=host.clientWidth,h=host.clientHeight;if(!w||!h)return;
    rot=h>w;L=rot?h:w;S=rot?w:h;dpr=W.devicePixelRatio||1;
    stage.style.width=L+'px';stage.style.height=S+'px';stage.style.transform=rot?'translate('+w+'px,0) rotate(90deg)':'none';
    cv.style.width=L+'px';cv.style.height=S+'px';cv.width=Math.round(L*dpr);cv.height=Math.round(S*dpr);ctx=cv.getContext('2d');
    band=clamp(Math.round(S*0.22),52,120);mid.style.top=band+'px';mid.style.bottom=band+'px';
    draw();
  }
  function ticks(c,k,inch,col,numCol){
    const step=inch?25.4/16:1,n=Math.floor((L-x0)/(step*k)),per=inch?16:10;
    c.strokeStyle=col;c.lineWidth=1.3;c.beginPath();
    for(let i=0;i<=n;i++){
      const x=Math.round((x0+i*step*k)*dpr)/dpr;
      const f=inch?(i%16===0?.62:i%8===0?.5:i%4===0?.38:i%2===0?.27:.18):(i%10===0?.62:i%5===0?.43:.27);
      c.moveTo(x,0);c.lineTo(x,f*band);c.moveTo(x,S);c.lineTo(x,S-f*band);
    }
    c.stroke();
    const fs=Math.round(clamp(band*0.27,14,26));c.fillStyle=numCol;c.textAlign='center';c.font='800 '+fs+'px system-ui,-apple-system,Roboto,sans-serif';
    for(let i=per;i<=n;i+=per){const x=x0+i*step*k,t=String(i/per);
      c.textBaseline='top';c.fillText(t,x,.62*band+3);c.textBaseline='bottom';c.fillText(t,x,S-.62*band-3);}
    c.font='800 '+Math.round(fs*0.62)+'px ui-monospace,Menlo,monospace';c.textAlign='left';
    c.textBaseline='top';c.fillText(inch?'0  inch':'0  cm',x0+4,.62*band+4);c.textBaseline='bottom';c.fillText(inch?'0  inch':'0  cm',x0+4,S-.62*band-4);
  }
  function draw(){
    if(!ctx)return;const c=ctx;c.setTransform(dpr,0,0,dpr,0,0);
    const k=cal?cal.px:pxmm,inch=unit==='in',xe=x0+mm*k,fill=!cal&&mm>0;
    c.fillStyle='#000';c.fillRect(0,0,L,S);
    if(fill){c.fillStyle='#d4af37';c.fillRect(x0,0,xe-x0,S);}
    const pass=(a,b,col,nc)=>{c.save();c.beginPath();c.rect(a,0,b-a,S);c.clip();ticks(c,k,inch,col,nc);c.restore();};
    if(fill){pass(0,xe,'#0a1930','#0a1930');pass(xe,L,'#f2f4f8','#d4af37');}else pass(0,L,'#f2f4f8','#d4af37');
    c.fillStyle=fill?'#0a1930':'#3ec8dd';c.fillRect(x0-1,0,2,S);
    if(cal){
      c.save();c.strokeStyle='#3ec8dd';c.lineWidth=2;c.setLineDash([9,6]);c.fillStyle='rgba(62,200,221,.16)';
      let xr;
      if(cal.ref==='card'){const cw=85.6*k,ch=53.98*k,y=(S-ch)/2;c.fillRect(x0,y,cw,ch);c.strokeRect(x0,y,cw,ch);xr=x0+cw;}
      else{const r=23.25/2*k;c.beginPath();c.arc(x0+r,S/2,r,0,7);c.fill();c.stroke();xr=x0+2*r;}
      c.setLineDash([]);c.fillStyle='#3ec8dd';c.fillRect(xr-1.5,0,3,S);c.restore();
    }else if(mm>0){
      c.fillStyle='#e8412c';c.fillRect(xe-1.5,0,3,S);
      c.beginPath();[band*0.9,S-band*0.9].forEach(y=>{c.moveTo(xe+2,y-12);c.lineTo(xe+16,y);c.lineTo(xe+2,y+12);c.closePath();});c.fill();
    }
  }
  const fmt=v=>unit==='in'?(v/25.4).toFixed(2):(v/10).toFixed(2);
  function update(){
    const tot=segs.reduce((a,b)=>a+b,0)+mm,v=long?tot:mm;
    rv.textContent=fmt(v);ru.textContent=unit==='in'?'inch':'cm';
    rs.textContent=long?(segs.length+1)+' part'+(segs.length?'s':'')+': '+segs.concat([mm]).map(fmt).join(' + ')+' · '+tot.toFixed(1)+' mm'
      :(unit==='in'?'= ':'')+v.toFixed(1)+' mm'+(unit==='in'?'':' · '+(v/25.4).toFixed(2)+' inch');
    rw.textContent=calibrated?'CALIBRATED · '+pxmm.toFixed(2)+' px/mm':'NOT CALIBRATED — ESTIMATE · TAP ⌖ TO CALIBRATE';
    rw.classList.toggle('tbx-ok',calibrated);
    lg.classList.toggle('tbx-on',long);lg.setAttribute('aria-pressed',String(long));ad.hidden=cl.hidden=!long;
    if(cal){const ref=cal.ref==='card'?85.6:23.25;
      q(box,'.tbx-r-ci').textContent=(cal.ref==='card'?'Lay a bank card (85.60 mm) on the screen, short edge on the 0 line.':'Lay a €1 coin (23.25 mm) on the screen touching the 0 line.')+' Drag until the blue outline’s far edge meets it exactly.';
      q(box,'.tbx-r-cv').textContent=cal.px.toFixed(3)+' px/mm · '+Math.round(ref*cal.px)+' px';}
    draw();
  }
  function setFrom(e){
    const r=host.getBoundingClientRect(),lx=rot?(e.clientY-r.top):(e.clientX-r.left);
    if(cal){const ref=cal.ref==='card'?85.6:23.25;cal.px=clamp((lx-x0)/ref,2,14);}
    else mm=clamp((lx-x0)/pxmm,0,(L-x0)/pxmm);
    update();
  }
  let drag=false;
  cv.addEventListener('pointerdown',e=>{drag=true;try{cv.setPointerCapture(e.pointerId);}catch(_){}setFrom(e);e.preventDefault();});
  cv.addEventListener('pointermove',e=>{if(drag)setFrom(e);});
  ['pointerup','pointercancel','lostpointercapture'].forEach(t=>cv.addEventListener(t,()=>{drag=false;}));
  segBind(q(box,'.tbx-r-unit'),b=>{unit=b.dataset.u;LSset('tbx_runit',unit);update();});
  const nudge=d=>{mm=clamp(mm+d*(unit==='in'?0.254:0.1),0,(L-x0)/pxmm);update();};
  q(box,'.tbx-r-dn').addEventListener('click',()=>nudge(-1));q(box,'.tbx-r-up').addEventListener('click',()=>nudge(1));
  lg.addEventListener('click',()=>{long=!long;if(!long)segs=[];update();
    if(long)toast('Long item: measure to a mark, tap + Add, slide the phone so 0 sits on the mark, repeat');});
  ad.addEventListener('click',()=>{if(mm<=0){toast('Set the edge first');return;}segs.push(mm);mm=0;update();toast('Part '+segs.length+' added — slide the phone so 0 is on your mark');});
  cl.addEventListener('click',()=>{segs=[];mm=0;update();});
  q(box,'.tbx-r-cal').addEventListener('click',()=>{cal={ref:'card',px:pxmm};qa(box,'.tbx-r-ref button').forEach(b=>b.classList.toggle('tbx-on',b.dataset.r==='card'));
    calP.hidden=false;mid.hidden=true;update();});
  segBind(q(box,'.tbx-r-ref'),b=>{cal.ref=b.dataset.r;update();});
  const endCal=()=>{cal=null;calP.hidden=true;mid.hidden=false;update();};
  q(box,'.tbx-r-cm').addEventListener('click',()=>{cal.px*=0.998;update();});
  q(box,'.tbx-r-cp').addEventListener('click',()=>{cal.px*=1.002;update();});
  q(box,'.tbx-r-cs').addEventListener('click',()=>{pxmm=cal.px;calibrated=true;LSset('tbx_pxmm',+pxmm.toFixed(4));endCal();toast('Calibrated: '+pxmm.toFixed(2)+' px per mm');});
  q(box,'.tbx-r-cx').addEventListener('click',endCal);
  q(box,'.tbx-r-ce').addEventListener('click',()=>{LSdel('tbx_pxmm');pxmm=EST;calibrated=false;endCal();toast('Using the estimate — not calibrated');});
  if(W.ResizeObserver){const ro=new ResizeObserver(()=>layout());ro.observe(host);s.clean(()=>ro.disconnect());}else s.on(W,'resize',layout);
  layout();update();
});

/* ---------- Measure: distance & height by camera trigonometry, with an evidential record ---------- */
tool('measure','Measure',0,'measure',function(s,box){
  const h0=clamp(+LSget('tbx_mh',1.5)||1.5,0.2,3);
  box.innerHTML='<div class="tbx-cam"><p class="tbx-cammsg">Starting the camera…</p><div class="tbx-xh"><i></i></div><div class="tbx-flash"></div>'
    +'<div class="tbx-hud"><span>Tilt <b class="tbx-m-t tbx-num">—</b></span><span class="tbx-m-lv tbx-num">aim at the base</span></div>'
    +'<div class="tbx-hud tbx-bl"><span class="tbx-m-gps">GPS …</span><span class="tbx-m-hd">Heading —</span></div></div>'
    +'<div class="tbx-panel">'
    +'<div class="tbx-row"><label class="tbx-mfield">Phone height above ground <input class="tbx-in tbx-m-h tbx-num" type="number" inputmode="decimal" step="0.05" min="0.2" max="3" value="'+h0.toFixed(2)+'"> m</label></div>'
    +'<div class="tbx-row"><button type="button" class="tbx-btn tbx-gold tbx-lg tbx-m-b">1 · Base</button><button type="button" class="tbx-btn tbx-gold tbx-lg tbx-m-tp" disabled>2 · Top</button></div>'
    +'<div class="tbx-kv"><div><small>Distance</small><b class="tbx-m-d tbx-num">—</b></div><div><small>Height</small><b class="tbx-m-hh tbx-num">—</b></div></div>'
    +'<p class="tbx-note tbx-m-n">Estimate — level ground. Hold the phone at the height entered (lens above ground). Put the crosshair where the object meets the ground → Base; then on its top → Top.</p>'
    +'<div class="tbx-row"><button type="button" class="tbx-btn tbx-m-ph">'+svg(IC.camera)+'Evidence photo</button><button type="button" class="tbx-btn tbx-m-cp">'+svg(IC.copy)+'Copy method</button><button type="button" class="tbx-btn tbx-m-rs">Reset</button></div>'
    +'</div>';
  const camBox=q(box,'.tbx-cam'),msg=q(box,'.tbx-cammsg'),tEl=q(box,'.tbx-m-t'),lv=q(box,'.tbx-m-lv'),gEl=q(box,'.tbx-m-gps'),hEl=q(box,'.tbx-m-hd');
  const hIn=q(box,'.tbx-m-h'),dEl=q(box,'.tbx-m-d'),HEl=q(box,'.tbx-m-hh'),bB=q(box,'.tbx-m-b'),tB=q(box,'.tbx-m-tp');
  let cam=null,o=null,sm=null,pos=null,h=h0,tb=null,tt=null,tbAt=null,ttAt=null,d=null,H=null;
  o=orient(s,st=>{const t=camTilt(st.b,st.g);sm=sm==null?t:sm+(t-sm)*0.25;},dn=>{tEl.textContent='no sensor';lv.textContent=dn?'motion permission refused':'needs a phone';});
  gps(s,p=>{pos=p;gEl.textContent='GPS ±'+Math.round(p.coords.accuracy)+' m';},(m,code)=>{gEl.textContent=code===1?'GPS refused':code===3?'GPS waiting…':'GPS unavailable';});
  openCam(s,camBox,'environment',true).then(c=>{cam=c;msg.hidden=true;}).catch(e=>{if(s.alive){msg.textContent=camErr(e);msg.classList.add('tbx-err');}});
  function calc2(){
    d=tb==null?null:h*Math.tan(tb*D2R);H=(tt==null||d==null)?null:h+d*Math.tan((tt-90)*D2R);
    dEl.textContent=d==null?'—':d.toFixed(2)+' m';HEl.textContent=H==null?'—':H.toFixed(2)+' m';tB.disabled=tb==null;
  }
  hIn.addEventListener('input',()=>{const v=parseFloat(hIn.value);if(v>=0.2&&v<=3){h=v;LSset('tbx_mh',v);calc2();}});
  bB.addEventListener('click',()=>{
    if(sm==null){toast('No tilt reading — this needs the phone’s motion sensor');return;}
    if(sm>=88.5){toast('Aim lower — the base must be below the level of the phone');return;}
    tb=sm;tbAt=new Date();tt=null;ttAt=null;calc2();vib(30);toast('Base: '+tb.toFixed(1)+'° → distance '+d.toFixed(2)+' m');
  });
  tB.addEventListener('click',()=>{
    if(tb==null){toast('Take the Base reading first');return;}
    if(sm==null||sm>=178||sm<=tb){toast('Aim at the top of the object (above the base)');return;}
    tt=sm;ttAt=new Date();calc2();vib(30);toast('Top: '+tt.toFixed(1)+'° → height '+H.toFixed(2)+' m');
  });
  q(box,'.tbx-m-rs').addEventListener('click',()=>{tb=tt=tbAt=ttAt=null;calc2();});
  const hd=()=>o&&o.head!=null?o.head:null;
  function lines(t){
    const f=fix(pos),hh=hd();
    return ['GARDA REFERENCE · MEASURE — CAMERA TRIGONOMETRY',
      t.d+' '+t.t+' ('+t.tz+')',
      f?'GPS '+f.ll+' ±'+f.acc+' m · ITM '+f.itm:'GPS: not available',
      'Camera heading '+(hh==null?'not available':headTxt(hh)+' (magnetic, approx.)'),
      'Phone (lens) height h = '+h.toFixed(2)+' m',
      'Tilt from vertical: base θb = '+(tb==null?'—':tb.toFixed(1)+'°')+' · top θt = '+(tt==null?'—':tt.toFixed(1)+'°'),
      'Distance d = h × tan θb = '+(d==null?'—':d.toFixed(2)+' m'),
      'Height H = h + d × tan(θt − 90°) = '+(H==null?'—':H.toFixed(2)+' m'),
      'Estimate — camera trigonometry (assumes level ground)'];
  }
  q(box,'.tbx-m-ph').addEventListener('click',()=>{
    const v=cam&&cam.v;if(!v||!v.videoWidth){toast('Camera not ready');return;}
    const t=stamp(),fl=q(box,'.tbx-flash');fl.classList.add('tbx-on');s.after(60,()=>fl.classList.remove('tbx-on'));
    saveJpeg(s,burn(v,v.videoWidth,v.videoHeight,lines(t),crosshair),'GR_measure_'+t.f+'.jpg');
  });
  q(box,'.tbx-m-cp').addEventListener('click',()=>{
    if(tb==null){toast('Take a Base reading first');return;}
    const t=stamp(),f=fix(pos),hh=hd(),tm=x=>x?stamp(x).t:'';
    let m='METHOD — distance/height estimate by camera trigonometry\n'
      +'Date/time: '+t.d+' '+t.t+' ('+t.tz+', 24-hour)\n'
      +'Location: '+(f?f.ll+' (GPS ±'+f.acc+' m) · ITM '+f.itm:'GPS not available')+'\n'
      +'Camera heading: '+(hh==null?'not available':headTxt(hh)+' (magnetic, approx.)')+'\n'
      +'Equipment: mobile phone rear camera and tilt sensor (Garda Reference Toolbox — Measure)\n'
      +'Phone (lens) height above ground h = '+h.toFixed(2)+' m (entered)\n'
      +'Crosshair on the base of the object at '+tm(tbAt)+': tilt from vertical θb = '+tb.toFixed(1)+'°\n'
      +'Horizontal distance d = h × tan(θb) = '+h.toFixed(2)+' × tan('+tb.toFixed(1)+'°) = '+d.toFixed(2)+' m\n';
    if(tt!=null)m+='Crosshair on the top of the object at '+tm(ttAt)+': tilt from vertical θt = '+tt.toFixed(1)+'°\n'
      +'Height H = h + d × tan(θt − 90°) = '+h.toFixed(2)+' + '+d.toFixed(2)+' × tan('+(tt-90).toFixed(1)+'°) = '+H.toFixed(2)+' m\n';
    m+='Estimate only: assumes level ground between the phone and the object; accuracy depends on the phone’s sensors and aim.';
    copyText(m);
  });
  s.every(150,()=>{
    hEl.textContent='Heading '+headTxt(hd());
    if(sm==null)return;tEl.textContent=sm.toFixed(1)+'°';
    if(tb==null)lv.textContent=sm<88.5?'→ base at '+(h*Math.tan(sm*D2R)).toFixed(2)+' m':'aim lower for the base';
    else{const dd=h*Math.tan(tb*D2R);lv.textContent=sm>tb?'→ top at '+(h+dd*Math.tan((sm-90)*D2R)).toFixed(2)+' m':'aim at the top';}
  });
});

function hav(a,b){const R=6371008.8,dLa=(b.latitude-a.latitude)*D2R,dLo=(b.longitude-a.longitude)*D2R,
  x=Math.sin(dLa/2)**2+Math.cos(a.latitude*D2R)*Math.cos(b.latitude*D2R)*Math.sin(dLo/2)**2;return 2*R*Math.asin(Math.min(1,Math.sqrt(x)));}
const hms=ms=>{const t=Math.floor(ms/1000),h=Math.floor(t/3600),m=Math.floor(t/60)%60,sec=t%60;return (h?h+':'+p2(m):String(m))+':'+p2(sec);};

tool('speed','Speedometer',0,'speed',function(s,box){
  box.innerHTML='<div class="tbx-body tbx-center">'
    +'<div class="tbx-big tbx-sp-v tbx-num">0</div><div class="tbx-unit tbx-nc">km/h</div><div class="tbx-sub tbx-sp-mph">0 mph</div>'
    +'<div class="tbx-row"><button type="button" class="tbx-btn tbx-gold tbx-lg tbx-sp-go">Start</button><button type="button" class="tbx-btn tbx-lg tbx-sp-rs">Reset</button></div>'
    +'<div class="tbx-kv tbx-k3"><div><small>Max</small><b class="tbx-sp-max">—</b></div><div><small>Average</small><b class="tbx-sp-avg">—</b></div><div><small>Distance</small><b class="tbx-sp-dist">—</b></div>'
    +'<div><small>Time</small><b class="tbx-sp-time">0:00</b></div><div><small>Accuracy</small><b class="tbx-sp-acc">—</b></div><div><small>Heading</small><b class="tbx-sp-hd">—</b></div></div>'
    +'<p class="tbx-note tbx-sp-st">Tap Start. The screen stays on while it runs.</p>'
    +'<p class="tbx-note">GPS speed is an indication only — not an approved speed-measurement device.</p></div>';
  const $=c=>q(box,c),go=$('.tbx-sp-go');
  let run=null,t0=0,acc=0,dist=0,max=0,cur=0,last=null,anchor=null,lastAt=0,hd=null,accu=null;
  const el=()=>acc+(run?Date.now()-t0:0);
  function render(){
    const e=el(),stale=run&&lastAt&&Date.now()-lastAt>6000;
    $('.tbx-sp-v').textContent=stale?'—':Math.round(cur);$('.tbx-sp-mph').textContent=stale?'no recent fix':Math.round(cur/1.609344)+' mph';
    $('.tbx-sp-max').textContent=max?Math.round(max)+' km/h':'—';$('.tbx-sp-avg').textContent=e>2000&&dist?(dist/(e/1000)*3.6).toFixed(0)+' km/h':'—';
    $('.tbx-sp-dist').textContent=dist?(dist>=1000?(dist/1000).toFixed(2)+' km':Math.round(dist)+' m'):'—';$('.tbx-sp-time').textContent=hms(e);
    $('.tbx-sp-acc').textContent=accu==null?'—':'±'+Math.round(accu)+' m';$('.tbx-sp-hd').textContent=hd==null?'—':headTxt(hd);
  }
  function onPos(p){
    const c=p.coords;let v=c.speed;accu=c.accuracy;lastAt=Date.now();
    if(last&&(v==null||isNaN(v))){const dt=(p.timestamp-last.timestamp)/1000;if(dt>0)v=hav(last.coords,c)/dt;}
    last=p;cur=(v==null||isNaN(v))?0:Math.max(0,v*3.6);if(c.accuracy<=40&&cur>max)max=cur;
    if(c.heading!=null&&!isNaN(c.heading)&&cur>3)hd=c.heading;
    if(!anchor)anchor=c;else{const dd=hav(anchor,c);if(c.accuracy<=50&&dd>Math.max(4,c.accuracy*0.6)){
      if(c.heading==null||isNaN(c.heading)){const y=Math.sin((c.longitude-anchor.longitude)*D2R)*Math.cos(c.latitude*D2R),
        x=Math.cos(anchor.latitude*D2R)*Math.sin(c.latitude*D2R)-Math.sin(anchor.latitude*D2R)*Math.cos(c.latitude*D2R)*Math.cos((c.longitude-anchor.longitude)*D2R);hd=wrap360(Math.atan2(y,x)*R2D);}
      dist+=dd;anchor=c;}}
    $('.tbx-sp-st').textContent='GPS fix '+stamp(new Date(p.timestamp||Date.now())).t;render();
  }
  function stop(){if(run){acc+=Date.now()-t0;run.end();run=null;}go.textContent='Start';go.classList.add('tbx-gold');go.classList.remove('tbx-red');render();}
  go.addEventListener('click',()=>{
    if(run){stop();return;}
    run=s.child();t0=Date.now();wake(run);go.textContent='Stop';go.classList.remove('tbx-gold');go.classList.add('tbx-red');$('.tbx-sp-st').textContent='Waiting for GPS…';
    gps(run,onPos,m=>{$('.tbx-sp-st').textContent=m;});run.every(500,render);
  });
  $('.tbx-sp-rs').addEventListener('click',()=>{acc=0;t0=Date.now();dist=0;max=0;cur=0;last=anchor=null;hd=null;render();});
});

tool('location','Location',0,'location',function(s,box){
  box.innerHTML='<div class="tbx-body">'
    +'<div class="tbx-card"><h4>Latitude, longitude (WGS84)</h4><div class="tbx-coord tbx-lo-ll tbx-mono">waiting for fix…</div><div class="tbx-note tbx-lo-dms tbx-mono"></div>'
    +'<button type="button" class="tbx-btn tbx-lo-cll">'+svg(IC.copy)+'Copy lat/long</button></div>'
    +'<div class="tbx-card"><h4>Irish Transverse Mercator (ITM · EPSG:2157)</h4><div class="tbx-coord tbx-lo-itm tbx-mono">—</div>'
    +'<button type="button" class="tbx-btn tbx-lo-citm">'+svg(IC.copy)+'Copy ITM</button></div>'
    +'<div class="tbx-kv"><div><small>Accuracy</small><b class="tbx-lo-acc">—</b></div><div><small>Altitude</small><b class="tbx-lo-alt">—</b></div>'
    +'<div><small>Fix time</small><b class="tbx-lo-t">—</b></div><div><small>Fix age</small><b class="tbx-lo-age">—</b></div></div>'
    +'<div class="tbx-row"><button type="button" class="tbx-btn tbx-gold tbx-lo-all">'+svg(IC.copy)+'Copy all</button><button type="button" class="tbx-btn tbx-lo-pz">Pause</button></div>'
    +'<p class="tbx-note tbx-lo-st">Getting a GPS fix… Stand in the open, away from tall buildings, for the best accuracy.</p></div>';
  const $=c=>q(box,c);let f=null,alt=null,run=null;
  function onPos(p){
    f=fix(p);const c=p.coords;alt=c.altitude==null?null:{a:c.altitude,e:c.altitudeAccuracy};
    $('.tbx-lo-ll').textContent=f.ll;$('.tbx-lo-dms').textContent=dms(f.lat,'N','S')+'  '+dms(f.lon,'E','W');
    $('.tbx-lo-itm').textContent=f.itm;$('.tbx-lo-acc').textContent='±'+f.acc+' m';$('.tbx-lo-acc').classList.toggle('tbx-ok',f.acc<=15);
    $('.tbx-lo-alt').textContent=alt?Math.round(alt.a)+' m'+(alt.e!=null?' ±'+Math.round(alt.e):''):'n/a';
    $('.tbx-lo-t').textContent=stamp(f.time).t;$('.tbx-lo-st').textContent='Live — updates as the fix improves.';
  }
  const startW=()=>{run=s.child();gps(run,onPos,m=>{$('.tbx-lo-st').textContent=m;});};startW();
  s.every(1000,()=>{if(f)$('.tbx-lo-age').textContent=Math.max(0,Math.round((Date.now()-f.time)/1000))+' s';});
  $('.tbx-lo-pz').addEventListener('click',e=>{if(run){run.end();run=null;e.currentTarget.textContent='Resume';$('.tbx-lo-st').textContent='Paused — the fix shown is frozen.';}
    else{startW();e.currentTarget.textContent='Pause';}});
  const need=fn=>()=>{if(!f){toast('No fix yet');return;}fn();};
  $('.tbx-lo-cll').addEventListener('click',need(()=>copyText(f.ll)));
  $('.tbx-lo-citm').addEventListener('click',need(()=>copyText('ITM '+f.itm)));
  $('.tbx-lo-all').addEventListener('click',need(()=>{const t=stamp(f.time);copyText('Location (phone GPS): '+f.ll+' (WGS84) ±'+f.acc+' m\n'
    +dms(f.lat,'N','S')+' '+dms(f.lon,'E','W')+'\nITM '+f.itm+(alt?'\nAltitude '+Math.round(alt.a)+' m'+(alt.e!=null?' (±'+Math.round(alt.e)+' m)':''):'')
    +'\nFix time '+t.t+' '+t.d+' ('+t.tz+')');}));
});

/* =====================================================================
   TIMING & COUNTING
   ===================================================================== */
tool('stopwatch','Stopwatch',1,'stopwatch',function(s,box){
  const K='tbx_sw';let st=LSget(K,null);if(!st||typeof st!=='object')st={run:false,t0:0,acc:0,laps:[]};
  box.innerHTML='<div class="tbx-body tbx-center"><div class="tbx-clock tbx-sw-t tbx-num" aria-live="off">0:00<small>.00</small></div>'
    +'<div class="tbx-row"><button type="button" class="tbx-btn tbx-lg tbx-sw-lap">Reset</button><button type="button" class="tbx-btn tbx-gold tbx-lg tbx-sw-go">Start</button></div>'
    +'<ol class="tbx-list tbx-sw-laps"></ol><p class="tbx-note">Works from the phone clock, so it stays right if the screen sleeps or you leave this tool.</p></div>';
  const tEl=q(box,'.tbx-sw-t'),go=q(box,'.tbx-sw-go'),lap=q(box,'.tbx-sw-lap'),ol=q(box,'.tbx-sw-laps');
  const el=()=>Math.max(0,st.run?st.acc+Date.now()-st.t0:st.acc);
  const fmt=ms=>{const cs=Math.floor(ms/10)%100;return hms(ms)+'.'+p2(cs);};
  const show=()=>{const ms=el(),cs=Math.floor(ms/10)%100;tEl.innerHTML=esc(hms(ms))+'<small>.'+p2(cs)+'</small>';};
  function ui(){
    go.textContent=st.run?'Stop':(st.acc?'Resume':'Start');go.classList.toggle('tbx-gold',!st.run);go.classList.toggle('tbx-red',st.run);
    lap.textContent=st.run?'Lap':'Reset';lap.disabled=!st.run&&!st.acc;
    ol.innerHTML=st.laps.map((t,i)=>({i,t,d:t-(i?st.laps[i-1]:0)})).reverse()
      .map(x=>'<li><b>Lap '+(x.i+1)+'</b><span class="tbx-mono">'+esc(fmt(x.d))+'</span><em>'+esc(fmt(x.t))+'</em></li>').join('');
    show();LSset(K,st);
  }
  go.addEventListener('click',()=>{const now=Date.now();if(st.run){st.acc+=now-st.t0;st.run=false;}else{st.t0=now;st.run=true;}vib(15);ui();});
  lap.addEventListener('click',()=>{if(st.run){st.laps.push(el());if(st.laps.length>99)st.laps.shift();}else st={run:false,t0:0,acc:0,laps:[]};vib(10);ui();});
  ui();s.loop(()=>{if(st.run)show();});
});

tool('timer','Timer',1,'timer',function(s,box){
  box.innerHTML='<div class="tbx-body tbx-center"><div class="tbx-clock tbx-tm-t tbx-num">5:00</div>'
    +'<div class="tbx-presets">'+[[1,'1 min'],[5,'5 min'],[10,'10 min'],[30,'30 min'],[60,'1 h']].map(x=>'<button type="button" class="tbx-btn" data-m="'+x[0]+'">'+x[1]+'</button>').join('')+'</div>'
    +'<div class="tbx-row"><button type="button" class="tbx-btn" data-d="-60">− 1 min</button><button type="button" class="tbx-btn" data-d="60">+ 1 min</button><button type="button" class="tbx-btn" data-d="10">+ 10 s</button></div>'
    +'<div class="tbx-row"><button type="button" class="tbx-btn tbx-lg tbx-tm-rs">Reset</button><button type="button" class="tbx-btn tbx-gold tbx-lg tbx-tm-go">Start</button></div>'
    +'<label class="tbx-chk"><input type="checkbox" class="tbx-tm-wk" checked> Keep the screen on while it runs</label>'
    +'<p class="tbx-note">Vibrates and beeps at zero. The countdown is cancelled if you leave this screen.</p></div>';
  const tEl=q(box,'.tbx-tm-t'),go=q(box,'.tbx-tm-go'),wk=q(box,'.tbx-tm-wk');
  let dur=5*60000,rem=dur,end=0,run=null,alarm=null,ac=null;
  const fmt=ms=>{const t=Math.ceil(ms/1000),h=Math.floor(t/3600),m=Math.floor(t/60)%60,x=t%60;return (h?h+':'+p2(m):String(m))+':'+p2(x);};
  function ui(){tEl.textContent=fmt(rem);go.textContent=alarm?'Stop alarm':run?'Pause':(rem<dur&&rem>0?'Resume':'Start');
    go.classList.toggle('tbx-gold',!run&&!alarm);go.classList.toggle('tbx-red',!!run||!!alarm);tEl.classList.toggle('tbx-alarm',!!alarm);}
  function stopAlarm(){if(alarm){alarm.end();alarm=null;}vib(0);}
  function ring(){
    if(run){run.end();run=null;}rem=0;alarm=s.child();let n=0;
    const once=()=>{if(!ac||ac.state==='closed')return;const t=ac.currentTime;beep(ac,880,0.16,t);beep(ac,880,0.16,t+0.25);beep(ac,1175,0.3,t+0.5);};
    const pulse=()=>{once();vib([400,150,400]);if(++n>=40){stopAlarm();ui();}};
    pulse();alarm.every(1500,pulse);ui();
  }
  go.addEventListener('click',()=>{
    if(alarm){stopAlarm();rem=dur;ui();return;}
    if(run){rem=Math.max(0,end-Date.now());run.end();run=null;ui();return;}
    if(rem<=0)rem=dur;if(!ac)ac=audioCtx(s);if(ac&&ac.resume)ac.resume().catch(()=>{});
    end=Date.now()+rem;run=s.child();if(wk.checked)wake(run);
    run.every(200,()=>{rem=end-Date.now();if(rem<=0)ring();else tEl.textContent=fmt(rem);});ui();
  });
  q(box,'.tbx-tm-rs').addEventListener('click',()=>{stopAlarm();if(run){run.end();run=null;}rem=dur;ui();});
  box.addEventListener('click',e=>{const b=e.target.closest('button[data-m],button[data-d]');if(!b||run||alarm)return;
    if(b.dataset.m)dur=+b.dataset.m*60000;else dur=clamp((rem>0?rem:dur)+(+b.dataset.d)*1000,10000,24*3600000);rem=dur;ui();});
  s.clean(()=>vib(0));ui();
});

tool('counter','Counter',1,'counter',function(s,box){
  const K='tbx_counters';let cs=LSget(K,null);
  if(!Array.isArray(cs)||!cs.length)cs=[{n:'Count',v:0}];cs=cs.slice(0,4).map(c=>({n:String(c.n||'Count').slice(0,30),v:Math.max(0,parseInt(c.v,10)||0)}));
  let armed=0;
  const save=()=>LSset(K,cs);
  function render(){
    box.innerHTML='<div class="tbx-body">'+cs.map((c,i)=>'<div class="tbx-ctr'+(cs.length===1?' tbx-solo':'')+'" data-i="'+i+'">'
      +'<div class="tbx-ctr-h"><input type="text" maxlength="30" value="'+esc(c.n)+'" aria-label="Counter name">'
      +'<button type="button" class="tbx-btn" data-a="zero">Reset</button>'+(cs.length>1?'<button type="button" class="tbx-btn" data-a="del" aria-label="Remove counter">✕</button>':'')+'</div>'
      +'<div class="tbx-ctr-b"><button type="button" class="tbx-btn tbx-minus" data-a="dec" aria-label="Minus one">−</button><b class="tbx-num">'+c.v+'</b>'
      +'<button type="button" class="tbx-btn tbx-gold tbx-plus" data-a="inc" aria-label="Plus one">+</button></div></div>').join('')
      +'<div class="tbx-row">'+(cs.length<4?'<button type="button" class="tbx-btn" data-a="add">+ Add counter</button>':'')
      +'<button type="button" class="tbx-btn" data-a="all">Reset all</button></div>'
      +'<p class="tbx-note">Up to 4 named counters (crowds, vehicles, persons). Kept on this phone until you reset them.</p></div>';
  }
  box.addEventListener('click',e=>{
    const b=e.target.closest('button[data-a]');if(!b)return;const card=b.closest('.tbx-ctr'),i=card?+card.dataset.i:-1,a=b.dataset.a;
    if(a==='inc'||a==='dec'){cs[i].v=Math.max(0,cs[i].v+(a==='inc'?1:-1));q(card,'b').textContent=cs[i].v;vib(a==='inc'?18:[10,40,10]);save();return;}
    if(a==='zero'){cs[i].v=0;q(card,'b').textContent='0';save();return;}
    if(a==='del'){cs.splice(i,1);save();render();return;}
    if(a==='add'&&cs.length<4){cs.push({n:'Count '+(cs.length+1),v:0});save();render();return;}
    if(a==='all'){if(Date.now()-armed>2500){armed=Date.now();toast('Tap “Reset all” again to confirm');return;}armed=0;cs.forEach(c=>c.v=0);save();render();}
  });
  box.addEventListener('input',e=>{const card=e.target.closest('.tbx-ctr');if(!card||e.target.tagName!=='INPUT')return;cs[+card.dataset.i].n=e.target.value.slice(0,30);save();});
  render();
});

/* =====================================================================
   SOUND & VISION
   ===================================================================== */
tool('sound','Sound level',2,'sound',function(s,box){
  box.innerHTML='<div class="tbx-body tbx-center">'
    +'<div><span class="tbx-big tbx-so-v tbx-num">—</span> <span class="tbx-unit tbx-nc">dB (approx.)</span></div>'
    +'<div class="tbx-meter" aria-hidden="true"><i class="tbx-so-bar"></i><em class="tbx-so-pk"></em></div>'
    +'<div class="tbx-kv tbx-k3"><div><small>Min</small><b class="tbx-so-min">—</b></div><div><small>Avg (Leq)</small><b class="tbx-so-avg">—</b></div><div><small>Max</small><b class="tbx-so-max">—</b></div></div>'
    +'<canvas class="tbx-trace tbx-so-cv" aria-label="Sound level, last 10 seconds"></canvas>'
    +'<div class="tbx-row"><button type="button" class="tbx-btn tbx-lg tbx-so-rs">Reset</button><button type="button" class="tbx-btn tbx-gold tbx-lg tbx-so-go">Start</button></div>'
    +'<div class="tbx-row"><button type="button" class="tbx-btn tbx-so-om">Offset −1</button><button type="button" class="tbx-btn tbx-so-op">Offset +1</button></div>'
    +'<p class="tbx-note tbx-so-off"></p>'
    +'<div class="tbx-warn">Approximate, uncalibrated — not evidential. Phone microphones and their processing vary; use only as a rough indication of loudness.</div></div>';
  const $=c=>q(box,c),go=$('.tbx-so-go'),cv=$('.tbx-so-cv');
  let off=+LSget('tbx_dboff',95)||95,run=null,db=null,pk=null,pkAt=0,mn=null,mx=null,eSum=0,eT=0,hist=[],lastT=0,lastH=0,pw=0;
  const offTxt=()=>{$('.tbx-so-off').textContent='Calibration offset +'+off+' dB (adjust only against a reference meter).';};offTxt();
  const setOff=d=>{off=clamp(off+d,60,140);LSset('tbx_dboff',off);offTxt();};
  $('.tbx-so-om').addEventListener('click',()=>setOff(-1));$('.tbx-so-op').addEventListener('click',()=>setOff(1));
  const reset=()=>{pk=mn=mx=null;eSum=eT=0;hist=[];};
  $('.tbx-so-rs').addEventListener('click',reset);
  function draw(){
    const {c,w,h}=cvFit(cv);c.clearRect(0,0,w,h);const y=v=>h-4-(clamp(v,20,120)-20)/100*(h-8);
    c.strokeStyle='rgba(159,176,200,.18)';c.fillStyle='rgba(159,176,200,.7)';c.font='600 10px ui-monospace,monospace';c.lineWidth=1;
    [40,60,80,100].forEach(v=>{c.beginPath();c.moveTo(0,y(v));c.lineTo(w,y(v));c.stroke();c.fillText(String(v),4,y(v)-3);});
    if(hist.length<2)return;c.strokeStyle='#d4af37';c.lineWidth=2;c.beginPath();
    hist.forEach((v,i)=>{const x=w-(hist.length-1-i)*(w/199);i?c.lineTo(x,y(v)):c.moveTo(x,y(v));});c.stroke();
  }
  function stop(){if(run){run.end();run=null;}go.textContent='Start';go.classList.add('tbx-gold');go.classList.remove('tbx-red');}
  go.addEventListener('click',()=>{
    if(run){stop();return;}
    const md=navigator.mediaDevices;if(!md||!md.getUserMedia){toast('This browser cannot use the microphone');return;}
    const r=run=s.child();go.textContent='Stop';go.classList.remove('tbx-gold');go.classList.add('tbx-red');
    const ac=audioCtx(r);
    md.getUserMedia({audio:{echoCancellation:false,noiseSuppression:false,autoGainControl:false},video:false}).then(st=>{
      const stopT=()=>st.getTracks().forEach(t=>{try{t.stop();}catch(e){}});
      if(!r.alive){stopT();return;}r.clean(stopT);
      if(!ac){toast('No Web Audio support');stop();return;}
      const src=ac.createMediaStreamSource(st),an=ac.createAnalyser();an.fftSize=2048;src.connect(an);r.clean(()=>{try{src.disconnect();}catch(e){}});
      const buf=new Float32Array(an.fftSize);lastT=performance.now();const t0=lastT;pw=-1;
      r.loop(t=>{
        an.getFloatTimeDomainData(buf);let ms=0;for(let i=0;i<buf.length;i++)ms+=buf[i]*buf[i];ms/=buf.length;
        const dt=Math.min(0.25,Math.max(0.001,(t-lastT)/1000));lastT=t;if(pw<0)pw=ms;else pw+=(ms-pw)*(1-Math.exp(-dt/0.125));
        db=Math.max(0,10*Math.log10(pw+1e-12)+off);
        if(pk==null||db>=pk){pk=db;pkAt=t;}else if(t-pkAt>2000)pk=Math.max(db,pk-20*dt);
        if(t-t0<400){$('.tbx-so-v').textContent=Math.round(db);return;}
        mn=mn==null?db:Math.min(mn,db);mx=mx==null?db:Math.max(mx,db);eSum+=Math.pow(10,db/10)*dt;eT+=dt;
        if(t-lastH>=50){lastH=t;hist.push(db);if(hist.length>200)hist.shift();}
        $('.tbx-so-v').textContent=Math.round(db);$('.tbx-so-bar').style.width=clamp((db-20)/100*100,0,100)+'%';$('.tbx-so-pk').style.left=clamp((pk-20)/100*100,0,100)+'%';
        $('.tbx-so-min').textContent=Math.round(mn);$('.tbx-so-max').textContent=Math.round(mx);$('.tbx-so-avg').textContent=eT?Math.round(10*Math.log10(eSum/eT)):'—';
        draw();
      });
    }).catch(e=>{if(!r.alive)return;stop();toast(e&&e.name==='NotAllowedError'?'Microphone permission refused — allow it for this site':'Microphone unavailable: '+(e&&e.message||e));});
  });
  draw();
});

function camTool(s,box,facing,msgTxt){ /* shared: full-bleed camera + panel */
  const camBox=q(box,'.tbx-cam'),msg=q(box,'.tbx-cammsg');msg.textContent=msgTxt||'Starting the camera…';
  return openCam(s,camBox,facing,true).then(c=>{msg.hidden=true;return c;}).catch(e=>{if(s.alive){msg.hidden=false;msg.textContent=camErr(e);msg.classList.add('tbx-err');}throw e;});
}
function torchBtn(s,btn,cam){
  if(!cam||!cam.caps.torch){btn.disabled=true;btn.textContent='No torch';return;}
  let on=false;btn.disabled=false;btn.addEventListener('click',()=>{on=!on;cam.torch(on).catch(()=>{});btn.classList.toggle('tbx-on',on);btn.textContent=on?'Torch on':'Torch';});
  s.clean(()=>{if(on)cam.torch(false).catch(()=>{});});
}
tool('magnifier','Magnifier',2,'magnifier',function(s,box){
  box.innerHTML='<div class="tbx-cam"><p class="tbx-cammsg"></p><div class="tbx-hud"><span class="tbx-mg-z tbx-num">1.0×</span><span class="tbx-mg-fz" hidden><b>FROZEN</b></span></div></div>'
    +'<div class="tbx-panel"><div class="tbx-row"><label class="tbx-mfield tbx-mg-l">Zoom <input type="range" class="tbx-mg-r" min="1" max="8" step="0.1" value="2" aria-label="Zoom"></label></div>'
    +'<div class="tbx-row"><button type="button" class="tbx-btn tbx-mg-t" disabled>Torch</button><button type="button" class="tbx-btn tbx-gold tbx-mg-f">Freeze</button><button type="button" class="tbx-btn tbx-mg-s">'+svg(IC.camera)+'Save</button></div>'
    +'<p class="tbx-note">For serial numbers and VINs: steady the phone, then Freeze. Save puts the frame in your Downloads only.</p></div>';
  const rg=q(box,'.tbx-mg-r'),zl=q(box,'.tbx-mg-z'),fz=q(box,'.tbx-mg-fz'),fb=q(box,'.tbx-mg-f');let cam=null,hw=false,z=2,frozen=false;
  const applyZ=()=>{z=+rg.value;zl.textContent=z.toFixed(1)+'×';if(!cam)return;
    if(hw)cam.track.applyConstraints({advanced:[{zoom:z}]}).catch(()=>{});else cam.v.style.transform='scale('+z+')';};
  rg.addEventListener('input',applyZ);
  camTool(s,box,'environment').then(c=>{cam=c;const zc=c.caps.zoom;
    if(zc&&zc.max>zc.min){hw=true;rg.min=zc.min;rg.max=Math.min(zc.max,10);rg.step=zc.step||0.1;rg.value=clamp(2,zc.min,Math.min(zc.max,10));}
    torchBtn(s,q(box,'.tbx-mg-t'),c);applyZ();}).catch(()=>{});
  fb.addEventListener('click',()=>{if(!cam)return;frozen=!frozen;if(frozen)cam.v.pause();else{const p=cam.v.play();if(p&&p.catch)p.catch(()=>{});}
    fz.hidden=!frozen;fb.textContent=frozen?'Live':'Freeze';});
  q(box,'.tbx-mg-s').addEventListener('click',()=>{const v=cam&&cam.v;if(!v||!v.videoWidth){toast('Camera not ready');return;}
    const vw=v.videoWidth,vh=v.videoHeight,k=hw?1:z,sw=Math.round(vw/k),sh=Math.round(vh/k),tmp=D.createElement('canvas');tmp.width=sw;tmp.height=sh;
    tmp.getContext('2d').drawImage(v,(vw-sw)/2,(vh-sh)/2,sw,sh,0,0,sw,sh);const t=stamp();
    saveJpeg(s,burn(tmp,sw,sh,['GARDA REFERENCE · MAGNIFIER '+z.toFixed(1)+'×',t.d+' '+t.t+' ('+t.tz+')']),'GR_magnifier_'+t.f+'.jpg');});
});

tool('mirror','Mirror',2,'mirror',function(s,box){
  box.innerHTML='<div class="tbx-cam tbx-mir"><p class="tbx-cammsg"></p><div class="tbx-hud"><span class="tbx-mi-fz" hidden><b>FROZEN</b></span></div></div>'
    +'<div class="tbx-panel"><div class="tbx-row"><button type="button" class="tbx-btn tbx-mi-l">Ring light</button><button type="button" class="tbx-btn tbx-gold tbx-mi-f">Freeze</button></div></div>';
  let cam=null,frozen=false;const cb=q(box,'.tbx-cam'),fb=q(box,'.tbx-mi-f');
  camTool(s,box,'user','Starting the front camera…').then(c=>{cam=c;}).catch(()=>{});
  q(box,'.tbx-mi-l').addEventListener('click',e=>{const on=cb.classList.toggle('tbx-ring');e.currentTarget.classList.toggle('tbx-on',on);});
  fb.addEventListener('click',()=>{if(!cam)return;frozen=!frozen;if(frozen)cam.v.pause();else{const p=cam.v.play();if(p&&p.catch)p.catch(()=>{});}
    q(box,'.tbx-mi-fz').hidden=!frozen;fb.textContent=frozen?'Live':'Freeze';});
});

tool('scanner','QR / barcode',2,'scanner',function(s,box){
  const K='tbx_scans',hist=()=>{const h=LSget(K,[]);return Array.isArray(h)?h:[];};
  box.innerHTML='<div class="tbx-cam"><p class="tbx-cammsg"></p><div class="tbx-scanbox"></div></div>'
    +'<div class="tbx-panel"><div class="tbx-sc-res"><p class="tbx-note">Point the camera at a QR code or barcode.</p></div>'
    +'<div class="tbx-row"><button type="button" class="tbx-btn tbx-sc-t" disabled>Torch</button><button type="button" class="tbx-btn tbx-sc-h">History</button></div>'
    +'<div class="tbx-sc-hist" hidden></div></div>';
  const res=q(box,'.tbx-sc-res'),hl=q(box,'.tbx-sc-hist'),sb=q(box,'.tbx-scanbox'),msg=q(box,'.tbx-cammsg');
  const fmtName=f=>String(f||'code').replace(/_/g,' ').toUpperCase().replace('QR CODE','QR code');
  const isUrl=t=>/^[a-z][a-z0-9+.-]*:\/?\/?\S/i.test(t.trim())||/^www\./i.test(t.trim());
  function showHist(){const h=hist();q(box,'.tbx-sc-h').textContent='History ('+h.length+')';
    hl.innerHTML=h.length?'<ul class="tbx-list">'+h.map((x,i)=>'<li><b>'+esc(stamp(new Date(x.t)).t)+'</b><span>'+esc(x.v)+'</span><em>'+esc(fmtName(x.f))+'</em></li>').join('')+'</ul>'
      +'<div class="tbx-row"><button type="button" class="tbx-btn tbx-sc-clr">Clear history</button></div>':'<p class="tbx-note">No scans yet.</p>';}
  q(box,'.tbx-sc-h').addEventListener('click',()=>{hl.hidden=!hl.hidden;showHist();});
  hl.addEventListener('click',e=>{if(e.target.closest('.tbx-sc-clr')){LSdel(K);showHist();}});
  showHist();
  let lastV='',lastAt=0,shownV='';
  function found(code){
    const v=String(code.rawValue||''),now=Date.now();if(!v||(v===lastV&&now-lastAt<3000)){lastAt=now;return;}lastV=v;lastAt=now;
    vib(40);sb.classList.add('tbx-hit');s.after(600,()=>sb.classList.remove('tbx-hit'));
    shownV=v;res.innerHTML='<div class="tbx-res"><span class="tbx-pill">'+esc(fmtName(code.format))+'</span>'
      +(isUrl(v)?' <span class="tbx-pill tbx-red">Link — not opened</span>':'')+'<pre>'+esc(v)+'</pre>'
      +'<div class="tbx-row"><button type="button" class="tbx-btn tbx-gold tbx-sc-cp">'+svg(IC.copy)+'Copy text</button></div></div>';
    const h=hist().filter(x=>x.v!==v);h.unshift({t:now,f:code.format,v:v.slice(0,2000)});LSset(K,h.slice(0,10));showHist();
  }
  res.addEventListener('click',e=>{if(e.target.closest('.tbx-sc-cp'))copyText(shownV);});
  const unsupported=()=>{msg.textContent='This browser has no built-in barcode scanner (BarcodeDetector). Chrome on Android supports it — update Chrome, or use the phone’s own camera app.';msg.classList.add('tbx-err');sb.hidden=true;};
  if(!('BarcodeDetector' in W)){unsupported();return;}
  Promise.resolve(W.BarcodeDetector.getSupportedFormats?W.BarcodeDetector.getSupportedFormats():['qr_code']).then(fm=>{
    if(!s.alive)return;if(!fm||!fm.length){unsupported();return;}
    const det=new W.BarcodeDetector({formats:fm});
    return camTool(s,box,'environment').then(c=>{
      torchBtn(s,q(box,'.tbx-sc-t'),c);let busy=false;
      s.every(220,()=>{if(busy||c.v.readyState<2||c.v.paused)return;busy=true;
        det.detect(c.v).then(codes=>{busy=false;if(s.alive&&codes&&codes.length)found(codes[0]);}).catch(()=>{busy=false;});});
    });
  }).catch(e=>{if(s.alive&&!msg.textContent)unsupported();});
});

tool('nfc','NFC reader',2,'nfc',function(s,box){
  box.innerHTML='<div class="tbx-body tbx-center"><div class="tbx-nfcring">'+svg(IC.nfc)+'</div>'
    +'<button type="button" class="tbx-btn tbx-gold tbx-lg tbx-nf-go">Start scanning</button>'
    +'<p class="tbx-note tbx-nf-st">Tap Start, then hold a tag or sticker flat against the back of the phone.</p><div class="tbx-nf-out"></div>'
    +'<p class="tbx-note">Read-only. Shows the tag’s serial number and its NDEF records (text, links, MIME data) as plain text — links are never opened, nothing is written. Bank cards and most ID cards do not expose NDEF data.</p></div>';
  const go=q(box,'.tbx-nf-go'),st=q(box,'.tbx-nf-st'),out=q(box,'.tbx-nf-out'),ring=q(box,'.tbx-nfcring');let run=null,n=0;
  if(!('NDEFReader' in W)){go.disabled=true;st.className='tbx-warn tbx-nf-st';
    st.textContent='Web NFC is available only in Chrome on Android, with NFC switched on (Settings › Connections › NFC). This browser or device does not support it.';return;}
  const hex=dv=>{const b=new Uint8Array(dv.buffer,dv.byteOffset,dv.byteLength),a=[];for(let i=0;i<Math.min(b.length,64);i++)a.push(b[i].toString(16).padStart(2,'0'));return a.join(' ')+(b.length>64?' …':'');};
  function recTxt(r){
    const dv=r.data;
    try{
      if(!dv)return '(no data)';
      if(r.recordType==='text')return new TextDecoder(r.encoding||'utf-8').decode(dv);
      if(r.recordType==='url'||r.recordType==='absolute-url')return new TextDecoder().decode(dv);
      if(r.recordType==='mime'&&/^(text\/|application\/(json|xml|vnd\.wfa))/i.test(r.mediaType||''))return new TextDecoder().decode(dv);
      return 'hex: '+hex(dv);
    }catch(e){return '(could not decode)';}
  }
  function stop(){if(run){run.end();run=null;}ring.classList.remove('tbx-on');go.textContent='Start scanning';go.classList.add('tbx-gold');go.classList.remove('tbx-red');}
  go.addEventListener('click',()=>{
    if(run){stop();st.textContent='Stopped.';return;}
    const r=run=s.child(),ctl=new AbortController();r.clean(()=>{try{ctl.abort();}catch(e){}});
    let rd;try{rd=new W.NDEFReader();}catch(e){stop();st.textContent='NFC unavailable: '+e.message;return;}
    rd.onreading=ev=>{if(!r.alive)return;vib(60);n++;const t=stamp(),recs=(ev.message&&ev.message.records)||[];
      const card=el('<div class="tbx-card"><h4>Tag '+n+' · '+esc(t.t)+'</h4><div class="tbx-mono">Serial: '+esc(ev.serialNumber||'not available')+'</div>'
        +(recs.length?recs.map((x,i)=>'<div class="tbx-res"><span class="tbx-pill">'+esc(x.recordType)+(x.mediaType?' · '+esc(x.mediaType):'')+'</span>'
          +(x.lang?' <span class="tbx-pill tbx-dim">'+esc(x.lang)+'</span>':'')+'<pre>'+esc(recTxt(x))+'</pre></div>').join(''):'<p class="tbx-note">No NDEF records on this tag.</p>')+'</div>');
      out.insertBefore(card,out.firstChild);while(out.children.length>5)out.lastChild.remove();};
    rd.onreadingerror=()=>{if(r.alive)st.textContent='Could not read that tag — hold it still against the back of the phone.';};
    go.textContent='Stop';go.classList.remove('tbx-gold');go.classList.add('tbx-red');st.textContent='Starting NFC…';
    rd.scan({signal:ctl.signal}).then(()=>{if(!r.alive)return;ring.classList.add('tbx-on');st.textContent='Scanning — hold a tag to the back of the phone.';})
      .catch(e=>{if(!r.alive)return;stop();st.textContent=e&&e.name==='NotAllowedError'?'NFC permission refused — allow NFC for this site.':e&&e.name==='NotSupportedError'?'NFC is switched off or not available on this phone.':'NFC error: '+(e&&e.message||e);});
  });
});

/* =====================================================================
   EVERYDAY
   ===================================================================== */
const UNITS={
  speed:{l:'Speed',u:[['km/h',1/3.6],['mph',0.44704],['m/s',1],['knots',1852/3600]],d:['km/h','mph']},
  distance:{l:'Distance',u:[['m',1],['km',1000],['ft',0.3048],['yd',0.9144],['mi',1609.344],['in',0.0254],['cm',0.01]],d:['m','ft']},
  weight:{l:'Weight',u:[['kg',1],['lb',0.45359237],['st',6.35029318],['g',0.001],['oz',0.028349523125]],d:['kg','st']},
  temp:{l:'Temperature',u:[['°C'],['°F'],['K']],d:['°C','°F']},
  volume:{l:'Volume',u:[['L',1],['ml',0.001],['pint (UK)',0.56826125],['gallon (UK)',4.54609],['pint (US)',0.473176473],['gallon (US)',3.785411784]],d:['L','pint (UK)']}
};
function conv(cat,v,from,to){
  if(cat==='temp'){const c=from==='°C'?v:from==='°F'?(v-32)*5/9:v-273.15;return to==='°C'?c:to==='°F'?c*9/5+32:c+273.15;}
  const U=UNITS[cat].u,f=U.find(x=>x[0]===from),t=U.find(x=>x[0]===to);return v*f[1]/t[1];
}
const nf=v=>{if(!isFinite(v))return '';const a=Math.abs(v);if(a!==0&&(a>=1e9||a<1e-4))return v.toPrecision(6);return String(parseFloat(v.toFixed(a>=1000?2:4)));};
tool('converter','Converter',3,'converter',function(s,box){
  let cat=LSget('tbx_cvcat','speed');if(!UNITS[cat])cat='speed';
  box.innerHTML='<div class="tbx-body"><div class="tbx-cats">'+Object.keys(UNITS).map(k=>'<button type="button" class="tbx-btn'+(k===cat?' tbx-gold':'')+'" data-c="'+k+'">'+UNITS[k].l+'</button>').join('')+'</div>'
    +'<div class="tbx-cvbox"><div class="tbx-cvline"><input class="tbx-in tbx-cv-a" type="text" inputmode="decimal" autocomplete="off" aria-label="Value"><select class="tbx-in tbx-cv-ua" aria-label="Unit"></select></div>'
    +'<div class="tbx-swap"><button type="button" class="tbx-btn tbx-cv-sw" aria-label="Swap units">⇅ Swap</button></div>'
    +'<div class="tbx-cvline"><input class="tbx-in tbx-cv-b" type="text" inputmode="decimal" autocomplete="off" aria-label="Converted value"><select class="tbx-in tbx-cv-ub" aria-label="Unit"></select></div></div>'
    +'<div class="tbx-card"><h4>All units</h4><ul class="tbx-list tbx-cv-all"></ul></div></div>';
  const A=q(box,'.tbx-cv-a'),B=q(box,'.tbx-cv-b'),UA=q(box,'.tbx-cv-ua'),UB=q(box,'.tbx-cv-ub'),all=q(box,'.tbx-cv-all');let side='a';
  const num=x=>{const v=parseFloat(String(x).replace(',','.').replace(/[^\d.eE+-]/g,''));return isFinite(v)?v:null;};
  function setCat(c){cat=c;LSset('tbx_cvcat',c);const opts=UNITS[c].u.map(u=>'<option>'+esc(u[0])+'</option>').join('');UA.innerHTML=opts;UB.innerHTML=opts;
    UA.value=UNITS[c].d[0];UB.value=UNITS[c].d[1];A.value=c==='temp'?'20':c==='speed'?'50':'1';side='a';qa(box,'.tbx-cats .tbx-btn').forEach(b=>b.classList.toggle('tbx-gold',b.dataset.c===c));upd();}
  function upd(){
    const src=side==='a'?A:B,dst=side==='a'?B:A,us=side==='a'?UA.value:UB.value,ud=side==='a'?UB.value:UA.value,v=num(src.value);
    dst.value=v==null?'':nf(conv(cat,v,us,ud));
    const va=num(A.value);
    if(va==null){all.innerHTML='';return;}
    let li=UNITS[cat].u.map(u=>'<li><b>'+esc(nf(conv(cat,va,UA.value,u[0])))+'</b><span>'+esc(u[0])+'</span></li>').join('');
    if(cat==='distance'){const inch=conv(cat,va,UA.value,'in'),ft=Math.floor(Math.abs(inch)/12),ri=Math.abs(inch)-ft*12;li+='<li><b>'+(inch<0?'−':'')+ft+' ft '+ri.toFixed(1)+' in</b><span>feet & inches</span></li>';}
    if(cat==='weight'){const lb=conv(cat,va,UA.value,'lb'),st=Math.floor(Math.abs(lb)/14),rl=Math.abs(lb)-st*14;li+='<li><b>'+(lb<0?'−':'')+st+' st '+rl.toFixed(1)+' lb</b><span>stones & pounds</span></li>';}
    all.innerHTML=li;
  }
  A.addEventListener('input',()=>{side='a';upd();});B.addEventListener('input',()=>{side='b';upd();});
  UA.addEventListener('change',()=>{side='a';upd();});UB.addEventListener('change',()=>{side='a';upd();});
  q(box,'.tbx-cv-sw').addEventListener('click',()=>{const u=UA.value;UA.value=UB.value;UB.value=u;const v=A.value;A.value=B.value;B.value=v;side='a';upd();});
  q(box,'.tbx-cats').addEventListener('click',e=>{const b=e.target.closest('[data-c]');if(b)setCat(b.dataset.c);});
  setCat(cat);
});

tool('calculator','Calculator',3,'calculator',function(s,box){
  const keys=[['C','tbx-fn'],['(','tbx-fn'],[')','tbx-fn'],['÷','tbx-op'],['7'],['8'],['9'],['×','tbx-op'],['4'],['5'],['6'],['−','tbx-op'],['1'],['2'],['3'],['+','tbx-op'],['⌫','tbx-fn'],['0'],['.'],['=','tbx-eq']];
  box.innerHTML='<div class="tbx-calc"><div class="tbx-cdisp" aria-live="polite"><div class="tbx-cexp tbx-ca-e"></div><div class="tbx-cres tbx-ca-r tbx-num">0</div></div>'
    +'<div class="tbx-keys">'+keys.map(k=>'<button type="button" class="tbx-key '+(k[1]||'')+'" data-k="'+k[0]+'" aria-label="'+({'⌫':'Backspace','C':'Clear','−':'Minus','×':'Times','÷':'Divide'}[k[0]]||k[0])+'">'+k[0]+'</button>').join('')+'</div></div>';
  const E=q(box,'.tbx-ca-e'),R=q(box,'.tbx-ca-r');let exp='',done=false;
  const show=v=>String(v).replace('-','−');
  function render(){E.textContent=exp;R.classList.remove('tbx-err');
    if(!exp){R.textContent='0';return;}try{R.textContent=show(calc(exp));}catch(e){R.textContent='';}}
  function press(k){
    if(k==='C'){exp='';done=false;}
    else if(k==='⌫'){exp=done?'':exp.slice(0,-1);done=false;}
    else if(k==='='){if(!exp)return;try{const v=calc(exp);E.textContent=exp+' =';exp=show(v);done=true;R.textContent=exp;R.classList.remove('tbx-err');}
      catch(e){R.textContent=e.message;R.classList.add('tbx-err');}return;}
    else{if(done&&/[0-9.(]/.test(k))exp='';done=false;if(exp.length<120)exp+=k;}
    render();
  }
  q(box,'.tbx-keys').addEventListener('click',e=>{const b=e.target.closest('[data-k]');if(b){press(b.dataset.k);vib(8);}});
  const KM={'*':'×','x':'×','X':'×','/':'÷','-':'−','+':'+','(':'(',')':')','.':'.',',':'.','Enter':'=','=':'=','Backspace':'⌫','Delete':'C','%':'%','^':'^'};
  s.on(D,'keydown',e=>{if(e.ctrlKey||e.metaKey||e.altKey)return;const t=e.target;if(t&&/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))return;
    const k=/^\d$/.test(e.key)?e.key:KM[e.key];if(!k)return;e.preventDefault();press(k);});
  render();
});

function contentRect(v,w,h){const vw=v&&v.videoWidth,vh=v&&v.videoHeight;if(!vw||!vh)return {x:0,y:0,w,h};const k=Math.min(w/vw,h/vh);return {x:(w-vw*k)/2,y:(h-vh*k)/2,w:vw*k,h:vh*k};}
function gridLines(c,r,mode,lw){
  if(mode==='off')return;const n=mode==='thirds'?3:10;c.save();c.lineWidth=lw;
  for(let i=1;i<n;i++){const mid=mode==='fine'&&i===5;c.strokeStyle=mode==='thirds'?'rgba(212,175,55,.9)':mid?'rgba(212,175,55,.85)':'rgba(255,255,255,.45)';
    const x=r.x+r.w*i/n,y=r.y+r.h*i/n;c.beginPath();c.moveTo(x,r.y);c.lineTo(x,r.y+r.h);c.moveTo(r.x,y);c.lineTo(r.x+r.w,y);c.stroke();}
  c.restore();
}
tool('camera','Evidence camera',3,'camera',function(s,box){
  let grid=LSget('tbx_grid','off');if(!/^(off|thirds|fine)$/.test(grid))grid='off';
  box.innerHTML='<div class="tbx-cam tbx-fit"><p class="tbx-cammsg"></p><canvas class="tbx-ovl"></canvas><div class="tbx-flash"></div>'
    +'<div class="tbx-hud"><span class="tbx-ec-gps">GPS …</span><span class="tbx-ec-hd">Heading —</span></div></div>'
    +'<div class="tbx-panel">'
    +'<div class="tbx-seg tbx-ec-g" role="group" aria-label="Grid"><button type="button" data-g="off">No grid</button><button type="button" data-g="thirds">Thirds</button><button type="button" data-g="fine">10 × 10</button></div>'
    +'<div class="tbx-row"><input type="text" class="tbx-in tbx-ec-cap" maxlength="80" placeholder="Caption (optional) — e.g. Scene 1, rear door" aria-label="Caption"></div>'
    +'<label class="tbx-chk"><input type="checkbox" class="tbx-ec-ig"> Include the grid in the saved photo</label>'
    +'<div class="tbx-shrow"><button type="button" class="tbx-btn tbx-ec-t" disabled>Torch</button><button type="button" class="tbx-shutter tbx-ec-s" aria-label="Take evidence photo"></button><div class="tbx-thumb tbx-ec-th" role="img" aria-label="Last photo taken"></div></div>'
    +'<p class="tbx-note">Saved as a JPEG to this phone’s Downloads with date, time, GPS/ITM and heading burned in. Never stored in this app or uploaded.</p></div>';
  const camBox=q(box,'.tbx-cam'),ovc=q(box,'.tbx-ovl'),gEl=q(box,'.tbx-ec-gps'),hEl=q(box,'.tbx-ec-hd'),ig=q(box,'.tbx-ec-ig');
  let cam=null,pos=null,n=0;ig.checked=!!LSget('tbx_gridsave',false);
  qa(box,'.tbx-ec-g button').forEach(b=>b.classList.toggle('tbx-on',b.dataset.g===grid));
  const o=orient(s,()=>{},null);
  gps(s,p=>{pos=p;gEl.textContent='GPS ±'+Math.round(p.coords.accuracy)+' m';},(m,code)=>{gEl.textContent=code===1?'GPS refused':code===3?'GPS waiting…':'GPS unavailable';});
  function drawOv(){const {c,w,h}=cvFit(ovc);c.clearRect(0,0,w,h);gridLines(c,contentRect(cam&&cam.v,w,h),grid,1.2);}
  segBind(q(box,'.tbx-ec-g'),b=>{grid=b.dataset.g;LSset('tbx_grid',grid);drawOv();});
  ig.addEventListener('change',()=>LSset('tbx_gridsave',ig.checked));
  if(W.ResizeObserver){const ro=new ResizeObserver(drawOv);ro.observe(camBox);s.clean(()=>ro.disconnect());}
  camTool(s,box,'environment').then(c=>{cam=c;torchBtn(s,q(box,'.tbx-ec-t'),c);c.v.addEventListener('resize',drawOv);drawOv();}).catch(()=>{});
  s.every(400,()=>{hEl.textContent='Heading '+headTxt(o.head);});
  drawOv();
  q(box,'.tbx-ec-s').addEventListener('click',()=>{
    const v=cam&&cam.v;if(!v||!v.videoWidth){toast('Camera not ready');return;}
    const t=stamp(),f=fix(pos),hh=o.head,cap=q(box,'.tbx-ec-cap').value.trim().slice(0,80),fl=q(box,'.tbx-flash');
    fl.classList.add('tbx-on');s.after(60,()=>fl.classList.remove('tbx-on'));vib(25);
    const lines=['GARDA REFERENCE · EVIDENCE PHOTO',t.d+' '+t.t+' ('+t.tz+')',f?'GPS '+f.ll+' ±'+f.acc+' m · ITM '+f.itm:'GPS: not available',
      'Heading '+(hh==null?'not available':headTxt(hh)+' (magnetic, approx.)')];
    if(cap)lines.push('Caption: '+cap);
    const out=burn(v,v.videoWidth,v.videoHeight,lines,ig.checked&&grid!=='off'?(c,w,h)=>gridLines(c,{x:0,y:0,w,h},grid,Math.max(2,w/450)):null);
    const tc=D.createElement('canvas');tc.width=tc.height=116;const k=Math.max(116/out.width,116/out.height);
    tc.getContext('2d').drawImage(out,(116-out.width*k)/2,(116-out.height*k)/2,out.width*k,out.height*k);
    q(box,'.tbx-ec-th').style.backgroundImage='url('+tc.toDataURL('image/jpeg',0.7)+')';
    n++;saveJpeg(s,out,'GR_evidence_'+t.f+(n>1?'_'+n:'')+'.jpg');
  });
});

tool('vibro','Vibration meter',3,'vibro',function(s,box){
  box.innerHTML='<div class="tbx-body tbx-center"><div><span class="tbx-big tbx-vb-v tbx-num">—</span> <span class="tbx-unit tbx-nc">m/s²</span></div><div class="tbx-sub tbx-vb-g">— g</div>'
    +'<div class="tbx-kv tbx-k3"><div><small>Peak hold</small><b class="tbx-vb-pk">—</b></div><div><small>Peak g</small><b class="tbx-vb-pg">—</b></div><div><small>Rate</small><b class="tbx-vb-hz">—</b></div>'
    +'<div><small>X</small><b class="tbx-vb-x">—</b></div><div><small>Y</small><b class="tbx-vb-y">—</b></div><div><small>Z</small><b class="tbx-vb-z">—</b></div></div>'
    +'<canvas class="tbx-trace tbx-vb-cv" aria-label="Acceleration, last 10 seconds"></canvas>'
    +'<div class="tbx-row"><button type="button" class="tbx-btn tbx-vb-rs">Reset peak</button><button type="button" class="tbx-btn tbx-gold tbx-vb-p">Pause</button></div>'
    +'<p class="tbx-note tbx-vb-st">Lay the phone on the surface or hold it against it. Shows acceleration with gravity removed (1 g = 9.81 m/s²). Approximate — a phone accelerometer is not a calibrated instrument.</p></div>';
  const $=c=>q(box,c),cv=$('.tbx-vb-cv');
  let last=null,grav=null,pk=0,paused=false,tr=[],cnt=0,hz=0,t1=performance.now();
  motion(s,e=>{
    let x,y,z;const a=e.acceleration;
    if(a&&a.x!=null){x=a.x;y=a.y;z=a.z;}
    else{const g=e.accelerationIncludingGravity;grav=grav?[grav[0]*0.9+g.x*0.1,grav[1]*0.9+g.y*0.1,grav[2]*0.9+g.z*0.1]:[g.x,g.y,g.z];x=g.x-grav[0];y=g.y-grav[1];z=g.z-grav[2];}
    x=+x||0;y=+y||0;z=+z||0;cnt++;if(paused)return;
    const m=Math.hypot(x,y,z),t=performance.now();last={x,y,z,m};if(m>pk)pk=m;tr.push([t,m]);while(tr.length&&t-tr[0][0]>10000)tr.shift();
  },d=>{$('.tbx-vb-st').textContent=NOSENSOR(d);$('.tbx-vb-st').className='tbx-warn';});
  $('.tbx-vb-rs').addEventListener('click',()=>{pk=0;});
  $('.tbx-vb-p').addEventListener('click',e=>{paused=!paused;e.currentTarget.textContent=paused?'Resume':'Pause';e.currentTarget.classList.toggle('tbx-gold',!paused);});
  s.every(1000,()=>{const t=performance.now();hz=Math.round(cnt*1000/(t-t1));cnt=0;t1=t;$('.tbx-vb-hz').textContent=hz?hz+' Hz':'—';});
  s.loop(t=>{
    if(last&&!paused){let m=0;for(let i=tr.length-1;i>=0&&t-tr[i][0]<250;i--)m=Math.max(m,tr[i][1]);
      $('.tbx-vb-v').textContent=m.toFixed(2);$('.tbx-vb-g').textContent=(m/9.80665).toFixed(3)+' g';$('.tbx-vb-pk').textContent=pk.toFixed(2);$('.tbx-vb-pg').textContent=(pk/9.80665).toFixed(3);
      $('.tbx-vb-x').textContent=last.x.toFixed(2);$('.tbx-vb-y').textContent=last.y.toFixed(2);$('.tbx-vb-z').textContent=last.z.toFixed(2);}
    const {c,w,h}=cvFit(cv);c.clearRect(0,0,w,h);const top=Math.max(2,Math.ceil(pk*1.1)),Y=v=>h-4-v/top*(h-10),now=paused&&tr.length?tr[tr.length-1][0]:t;
    c.strokeStyle='rgba(159,176,200,.18)';c.fillStyle='rgba(159,176,200,.7)';c.font='600 10px ui-monospace,monospace';
    [0.25,0.5,0.75].forEach(f=>{const v=top*f;c.beginPath();c.moveTo(0,Y(v));c.lineTo(w,Y(v));c.stroke();c.fillText(v.toFixed(1),4,Y(v)-3);});
    if(tr.length<2)return;c.strokeStyle='#3ec8dd';c.lineWidth=1.6;c.beginPath();
    tr.forEach((p,i)=>{const x=w-(now-p[0])/10000*w;i?c.lineTo(x,Y(p[1])):c.moveTo(x,Y(p[1]));});c.stroke();
  });
});

tool('device','Phone status',3,'device',function(s,box){
  box.innerHTML='<div class="tbx-body"><div class="tbx-card"><h4>Battery</h4><div class="tbx-dv-bat"><p class="tbx-note">Reading…</p></div></div>'
    +'<div class="tbx-card"><h4>Network</h4><div class="tbx-dv-net"></div></div><div class="tbx-card"><h4>Screen</h4><div class="tbx-dv-scr"></div></div>'
    +'<div class="tbx-card"><h4>Phone &amp; app</h4><div class="tbx-dv-app"></div></div>'
    +'<p class="tbx-note">Read from the browser only — no speed test or other network use; nothing leaves the phone.</p></div>';
  const kv=(sel,rows)=>{q(box,sel).innerHTML='<div class="tbx-kv">'+rows.filter(r=>r).map(r=>'<div><small>'+esc(r[0])+'</small><b'+(r[2]?' class="'+r[2]+'"':'')+'>'+esc(r[1])+'</b></div>').join('')+'</div>';};
  const mins=sec=>!isFinite(sec)||sec<=0?null:(sec>=3600?Math.floor(sec/3600)+' h '+Math.round(sec%3600/60)+' min':Math.round(sec/60)+' min');
  let bat=null;
  const rb=()=>{if(!bat)return;const tf=mins(bat.chargingTime),te=mins(bat.dischargingTime);
    kv('.tbx-dv-bat',[['Level',Math.round(bat.level*100)+' %',bat.level<=0.15?'':'tbx-ok'],['Charging',bat.charging?'Yes':'No'],tf&&bat.charging?['Full in',tf]:null,te&&!bat.charging?['Time left',te]:null]);};
  if(navigator.getBattery)navigator.getBattery().then(b=>{if(!s.alive)return;bat=b;['levelchange','chargingchange','chargingtimechange','dischargingtimechange'].forEach(ev=>s.on(b,ev,rb));rb();})
    .catch(()=>{q(box,'.tbx-dv-bat').innerHTML='<p class="tbx-note">Battery information is not available.</p>';});
  else q(box,'.tbx-dv-bat').innerHTML='<p class="tbx-note">This browser does not report the battery.</p>';
  const cn=navigator.connection||navigator.mozConnection||navigator.webkitConnection;
  const rn=()=>kv('.tbx-dv-net',[['Status',navigator.onLine?'Online':'Offline',navigator.onLine?'tbx-ok':''],cn&&cn.type?['Connection',cn.type]:null,
    cn&&cn.effectiveType?['Quality',String(cn.effectiveType).toUpperCase()]:null,cn&&cn.downlink!=null?['Downlink (est.)',cn.downlink+' Mb/s']:null,
    cn&&cn.rtt!=null?['Round trip (est.)',cn.rtt+' ms']:null,cn&&cn.saveData!=null?['Data saver',cn.saveData?'On':'Off']:null,
    !cn?['Details','not reported']:null]);
  const rs=()=>{const dpr=W.devicePixelRatio||1,so=screen.orientation;
    kv('.tbx-dv-scr',[['Screen',screen.width+' × '+screen.height+' px'],['Pixel ratio',String(Math.round(dpr*1000)/1000)],['Physical',Math.round(screen.width*dpr)+' × '+Math.round(screen.height*dpr)],
      ['Viewport',W.innerWidth+' × '+W.innerHeight],['Orientation',so?String(so.type).replace('-primary','').replace('-secondary',' (flipped)')+' '+so.angle+'°':'—'],['Colour depth',screen.colorDepth+'-bit']]);};
  const standalone=W.matchMedia&&(W.matchMedia('(display-mode: standalone)').matches||W.matchMedia('(display-mode: fullscreen)').matches);
  const ra=est=>kv('.tbx-dv-app',[['CPU cores',String(navigator.hardwareConcurrency||'—')],navigator.deviceMemory?['Memory (approx.)','≥ '+navigator.deviceMemory+' GB']:null,
    ['Language',navigator.language||'—'],['Time zone',(Intl.DateTimeFormat().resolvedOptions().timeZone)||'—'],['Running as',standalone?'Installed app':'Browser tab'],
    ['Offline cache',navigator.serviceWorker&&navigator.serviceWorker.controller?'Active':'Not active'],est?['Storage used',(est.usage/1048576).toFixed(1)+' MB']:null,
    est&&est.quota?['Storage free',(Math.max(0,est.quota-est.usage)/1073741824).toFixed(1)+' GB']:null]);
  rn();rs();ra(null);
  if(navigator.storage&&navigator.storage.estimate)navigator.storage.estimate().then(e=>{if(s.alive)ra(e);}).catch(()=>{});
  if(cn&&cn.addEventListener)s.on(cn,'change',rn);
  s.on(W,'online',rn);s.on(W,'offline',rn);s.on(W,'resize',rs);if(screen.orientation)s.on(screen.orientation,'change',rs);
});

/* ---------- public API ---------- */
W.openToolbox=openToolbox;W.openTool=openTool;W.closeToolbox=closeToolbox;W.tbxBack=tbxBack;
W.tbxLib=Object.freeze({toITM,calc,cardinal,camTilt,upVec,headingOf,tools:()=>TOOLS.map(t=>t.id)});
})();
