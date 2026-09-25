/* Garda Reference — media: live news TV, Irish radio, local crime/court news strip.
   Everything plays inside the app. Sources verified live from the app's own site (Sept 2026):
   - Sky News 24/7 YouTube live stream; RTÉ News latest uploads (YouTube playlist)
   - Irish radio: secure streams tested to connect; full list from radio-browser.info (open directory)
   - News: RTÉ Crime / Courts, BreakingNews.ie, DublinLive, Irish Independent Courts, Irish Examiner via rss2json */
(function(){
'use strict';
const $=s=>document.querySelector(s);
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function toast(m){ if(window.grToast)return window.grToast(m); console.log(m); }

/* ================= LIVE TV (in-app YouTube) ================= */
const TV={
  sky:{t:'Sky News',s:'24/7 live',src:'https://www.youtube.com/embed/PP0xlL6Wo7c?autoplay=1&playsinline=1&rel=0&modestbranding=1',
       alt:'https://www.youtube.com/embed/videoseries?list=UUoMdktPbSTixAyNGwb-UYkQ&playsinline=1&rel=0', altT:'Sky News · latest videos'},
  rte:{t:'RTÉ News',s:'latest reports',src:'https://www.youtube.com/embed/videoseries?list=UU8urSFTmQDxaPDEIZ2Fd63Q&autoplay=1&playsinline=1&rel=0&modestbranding=1'}
};
function tvEl(){
  let o=$('#mTV'); if(o)return o;
  o=document.createElement('div'); o.id='mTV'; o.className='m-ov hidden';
  o.innerHTML='<div class="m-top"><button class="m-x" id="mTVx">‹ Close</button><div class="m-tt"><b id="mTVt">LIVE TV</b><small class="hudclock" data-f="line"></small></div><span class="m-live" id="mTVlive">● LIVE</span></div>'
    +'<div class="m-screen"><iframe id="mTVf" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen title="Live news"></iframe></div>'
    +'<div class="m-chips" id="mTVchips"></div>'
    +'<p class="m-note" id="mTVnote"></p>';
  document.body.appendChild(o);
  $('#mTVx').addEventListener('click',()=>{ $('#mTVf').src='about:blank'; o.classList.add('hidden'); document.body.classList.remove('m-open'); });
  return o;
}
function openTV(k,alt){
  const o=tvEl(), ch=TV[k]||TV.sky;
  $('#mTVt').textContent=(alt?ch.altT:ch.t+' · '+ch.s).toUpperCase();
  $('#mTVlive').style.display=(k==='sky'&&!alt)?'':'none';
  $('#mTVf').src=alt?ch.alt:ch.src;
  const chips=[['sky',0,'📺 Sky News · live'],['rte',0,'📰 RTÉ News · latest'],['sky',1,'🎞️ Sky · latest videos']];
  $('#mTVchips').innerHTML=chips.map(([kk,a,l])=>'<button class="m-chip'+(kk===k&&!!a===!!alt?' on':'')+'" data-k="'+kk+'" data-a="'+a+'">'+l+'</button>').join('');
  $('#mTVchips').querySelectorAll('.m-chip').forEach(b=>b.addEventListener('click',()=>openTV(b.dataset.k,b.dataset.a==='1')));
  $('#mTVnote').textContent=k==='rte'
    ? 'RTÉ News’ newest reports play in order — use the player’s next button or the list icon (top right of the video) to pick one.'
    : (alt?'Sky News’ latest uploaded reports.':'If Sky ever moves its live stream and this shows “unavailable”, tap “Sky · latest videos”.');
  o.classList.remove('hidden'); document.body.classList.add('m-open');
  if(radio.el&&!radio.el.paused){ radio.el.pause(); radio.pausedForTV=true; updMini(); }
}

/* ================= RADIO ================= */
const STATIONS=[
 ['National','RTÉ Radio 1','news · talk · current affairs','https://icecast.rte.ie/radio1'],
 ['National','Newstalk','news · talk','https://edge.audioxi.com/NT'],
 ['National','RTÉ 2FM','music','https://icecast.rte.ie/2fm'],
 ['National','Today FM','music · talk','https://stream.audioxi.com/TD'],
 ['National','RTÉ lyric fm','classical','https://icecast.rte.ie/lyric'],
 ['National','RTÉ Raidió na Gaeltachta','as Gaeilge','https://icecast.rte.ie/rnag'],
 ['National','RTÉ Gold','classic hits','https://icecast.rte.ie/gold'],
 ['National','Off The Ball','sport','https://stream.audioxi.com/OTB'],
 ['Dublin','98FM','Dublin · music · news','https://stream.audioxi.com/98'],
 ['Dublin','FM104','Dublin · music','https://wg.cdn.tibus.net/fm104MP3128'],
 ['Dublin','Q102','Dublin · hits','https://wg.cdn.tibus.net/q102MP3128'],
 ['Dublin','Spin 1038','Dublin · music','https://live-bauerie.sharp-stream.com/SP'],
 ['Dublin','Sunshine 106.8','Dublin · easy listening','https://live-bauerie.sharp-stream.com/SUN'],
 ['Dublin','Radio Nova','Dublin · rock','https://playerservices.streamtheworld.com/api/livestream-redirect/RADIONOVA.mp3'],
 ['Dublin','Classic Hits','Dublin · classic hits','https://stream.audioxi.com/CLASSIC'],
 ['Dublin','NEAR FM','Dublin north-side community','https://nearfm-radiohosting.radioca.st/stream.mp3'],
 ['Dublin','Dublin Digital Radio','Dublin · community','https://dublin-digital-radio.radiocult.fm/stream'],
 ['Regional','LMFM','Louth · Meath','https://wg.cdn.tibus.net/LMFM'],
 ['Regional','KFM','Kildare','https://live-bauerie.sharp-stream.com/KFM'],
 ['Regional','Midlands 103','Laois · Offaly · Westmeath','https://playerservices.streamtheworld.com/api/livestream-redirect/MIDLANDS_103.mp3'],
 ['Regional','Beat 102-103','South-east youth','https://stream.audioxi.com/BEAT'],
 ['Regional','Cork’s Red FM','Cork','https://live-bauerie.sharp-stream.com/RED'],
 ['Regional','Cork’s 96FM','Cork','https://wg.cdn.tibus.net/96fm'],
 ['Regional','Live 95','Limerick','https://wg.cdn.tibus.net/Live95fm'],
 ['Regional','Clare FM','Clare','https://playerservices.streamtheworld.com/api/livestream-redirect/CLARE_FM.mp3'],
 ['Regional','Midwest Radio','Mayo','https://playerservices.streamtheworld.com/api/livestream-redirect/MIDWEST_RADIO.mp3'],
 ['Regional','Highland Radio','Donegal','https://playerservices.streamtheworld.com/api/livestream-redirect/HIGHLAND_RADIO.mp3'],
 ['Regional','iRadio','north-west & midlands youth','https://live-bauerie.sharp-stream.com/IRADNWAAC'],
 ['Regional','C103','Cork north','https://wg.cdn.tibus.net/C103']
];
const RB_HOSTS=['de1.api.radio-browser.info','fi1.api.radio-browser.info','nl1.api.radio-browser.info'];
const radio={el:null,cur:null,all:null,pausedForTV:false};
function audioEl(){
  if(radio.el)return radio.el;
  const a=document.createElement('audio'); a.preload='none'; a.id='mAudio';
  a.addEventListener('playing',()=>{radio.state='playing';updMini();updList();});
  a.addEventListener('waiting',()=>{radio.state='buffering';updMini();});
  a.addEventListener('pause',()=>{radio.state='paused';updMini();updList();});
  a.addEventListener('error',()=>{ if(!radio.cur)return; radio.state='error'; updMini(); updList(); toast(radio.cur.n+' isn’t responding right now — try another station'); });
  document.body.appendChild(a); radio.el=a; return a;
}
function play(st){
  const a=audioEl(); radio.cur=st; radio.state='buffering'; radio.pausedForTV=false;
  a.src=st.u; const p=a.play(); if(p&&p.catch)p.catch(()=>{});
  if('mediaSession' in navigator){
    try{
      navigator.mediaSession.metadata=new MediaMetadata({title:st.n,artist:'Live radio · '+(st.d||'Ireland'),album:'Garda Reference',
        artwork:[{src:'icons/icon-192.png',sizes:'192x192',type:'image/png'},{src:'icons/icon-512.png',sizes:'512x512',type:'image/png'}]});
      navigator.mediaSession.setActionHandler('play',()=>a.play());
      navigator.mediaSession.setActionHandler('pause',()=>a.pause());
      navigator.mediaSession.setActionHandler('stop',stop);
    }catch(e){}
  }
  updMini(); updList();
}
function stop(){ const a=radio.el; if(a){a.pause();a.removeAttribute('src');a.load();} radio.cur=null; radio.state=''; updMini(); updList(); }
function toggle(){ const a=radio.el; if(!a||!radio.cur)return; if(a.paused){a.play().catch(()=>{});}else a.pause(); }
function miniEl(){
  let m=$('#mMini'); if(m)return m;
  m=document.createElement('div'); m.id='mMini'; m.className='hidden';
  m.innerHTML='<button class="mm-pp" id="mmPP" aria-label="Play or pause">❚❚</button><button class="mm-info" id="mmInfo"><b id="mmName"></b><small id="mmState"></small></button><button class="mm-x" id="mmX" aria-label="Stop radio">■</button>';
  document.body.appendChild(m);
  $('#mmPP').addEventListener('click',toggle); $('#mmX').addEventListener('click',stop); $('#mmInfo').addEventListener('click',openRadio);
  return m;
}
function updMini(){
  const m=miniEl(); if(!radio.cur){m.classList.add('hidden');return;}
  m.classList.remove('hidden');
  $('#mmName').textContent='📻 '+radio.cur.n;
  const s=radio.state; $('#mmState').textContent=s==='playing'?'● live':s==='buffering'?'connecting…':s==='error'?'not responding':'paused';
  m.className=s==='playing'?'on':(s==='error'?'err':'');
  $('#mmPP').textContent=(s==='playing'||s==='buffering')?'❚❚':'▶';
}
function radioEl(){
  let o=$('#mRadio'); if(o)return o;
  o=document.createElement('div'); o.id='mRadio'; o.className='m-ov hidden';
  o.innerHTML='<div class="m-top"><button class="m-x" id="mRx">‹ Close</button><div class="m-tt"><b>IRISH RADIO</b><small class="hudclock" data-f="line"></small></div><span></span></div>'
    +'<div class="m-bar"><input class="cl-search" id="mRq" type="search" placeholder="Search stations — Newstalk, Cork, 98…" autocomplete="off" enterkeyhint="search"></div>'
    +'<div class="m-scroll" id="mRlist"></div>';
  document.body.appendChild(o);
  $('#mRx').addEventListener('click',()=>{o.classList.add('hidden');document.body.classList.remove('m-open');});
  $('#mRq').addEventListener('input',filterRadio);
  return o;
}
function stRow(st,i,src){
  const on=radio.cur&&radio.cur.u===st.u;
  return '<button class="m-st'+(on?' on':'')+'" data-src="'+src+'" data-i="'+i+'" data-q="'+esc((st.n+' '+(st.d||'')+' '+(st.g||'')).toLowerCase())+'"><span class="m-sti">'+(on&&radio.state==='playing'?'<i class="eq"><b></b><b></b><b></b></i>':'▶')+'</span><span class="m-stt"><b>'+esc(st.n)+'</b><small>'+esc(st.d||'')+'</small></span></button>';
}
const PINNED=STATIONS.map(([g,n,d,u])=>({g,n,d,u}));
function renderRadio(){
  const L=$('#mRlist'); if(!L)return;
  let h='', last='';
  PINNED.forEach((st,i)=>{ if(st.g!==last){ h+=(last?'</div>':'')+'<h3 class="m-h">'+esc(st.g)+'</h3><div class="m-list">'; last=st.g; } h+=stRow(st,i,'p'); });
  h+='</div><h3 class="m-h">All Irish stations <small id="mRallN">'+(radio.all?radio.all.length:'loading…')+'</small></h3><div class="m-list" id="mRall">'
    +(radio.all?radio.all.map((st,i)=>stRow(st,i,'a')).join(''):'<p class="m-note">Loading the full station directory…</p>')+'</div>'
    +'<p class="m-note">Live internet streams — needs signal. A web app can’t reach the phone’s built-in FM tuner, so there’s no offline FM.</p>';
  L.innerHTML=h;
  L.querySelectorAll('.m-st').forEach(b=>b.addEventListener('click',()=>{
    const st=b.dataset.src==='p'?PINNED[+b.dataset.i]:radio.all[+b.dataset.i];
    if(radio.cur&&radio.cur.u===st.u){toggle();return;} play(st);
  }));
  filterRadio();
}
function updList(){ if($('#mRadio')&&!$('#mRadio').classList.contains('hidden'))renderRadio(); }
function filterRadio(){
  const q=($('#mRq')||{}).value||''; const w=q.toLowerCase().split(/\s+/).filter(Boolean);
  document.querySelectorAll('#mRlist .m-st').forEach(b=>b.classList.toggle('hidden',!w.every(x=>b.dataset.q.includes(x))));
}
async function loadAllRadio(){
  if(radio.all||radio.loading)return; radio.loading=true;
  const have=new Set(PINNED.map(s=>s.u));
  for(const h of RB_HOSTS){
    try{
      const ac=new AbortController(); const tm=setTimeout(()=>ac.abort(),9000);
      const r=await fetch('https://'+h+'/json/stations/bycountrycodeexact/IE?hidebroken=true&order=clickcount&reverse=true&limit=400',{signal:ac.signal});
      clearTimeout(tm); if(!r.ok)continue;
      const j=await r.json(); const seen=new Set();
      radio.all=j.filter(s=>s&&s.url_resolved&&/^https:\/\//.test(s.url_resolved)&&!have.has(s.url_resolved))
        .filter(s=>{const k=(s.name||'').trim().toLowerCase(); if(!k||seen.has(k))return false; seen.add(k); return true;})
        .map(s=>({n:String(s.name).trim().slice(0,60),d:[s.state,String(s.tags||'').split(',').slice(0,3).join(' · ')].filter(Boolean).join(' · '),u:s.url_resolved,g:'All'}));
      break;
    }catch(e){}
  }
  radio.loading=false; if(!radio.all)radio.all=[];
  renderRadio();
}
function openRadio(){
  const o=radioEl(); o.classList.remove('hidden'); document.body.classList.add('m-open');
  renderRadio(); if(navigator.onLine!==false)loadAllRadio();
}

/* ================= NEWS STRIP (Garda · crime · courts) ================= */
const FEEDS=[
  {k:'rtecrime',t:'RTÉ · Crime',u:'https://www.rte.ie/feeds/rss/?index=/news/crime/'},
  {k:'rtecourts',t:'RTÉ · Courts',u:'https://www.rte.ie/feeds/rss/?index=/news/courts/'},
  {k:'dublinlive',t:'DublinLive · Dublin',u:'https://www.dublinlive.ie/news/dublin-news/?service=rss',filter:1},
  {k:'bn',t:'BreakingNews.ie · Ireland',u:'https://feeds.breakingnews.ie/bnireland',filter:1},
  {k:'indo',t:'Irish Independent · Courts',u:'https://www.independent.ie/irish-news/courts/rss'},
  {k:'examiner',t:'Irish Examiner',u:'https://www.irishexaminer.com/feed/35-top_news.xml',filter:1}
];
const RELEVANT=/\bgard(a|aí|ai)\b|court|charged|arrest|assault|murder|manslaughter|stab|shoot|shot|firearm|drug|seiz|cannabis|cocaine|crash|collision|missing|appeal for|robber|burglar|sentenc|jail|prison|dpp|crimin|psni|police|fire brigade|rescue|m50|traffic|protest|disorder|theft|fraud|jury|trial|judge|bail|inquest|death|killed|injur|dangerous driving|violence|attack/i;
const NEWS_KEY='gr_news2';
let news=null;
function strip(h){return String(h||'').replace(/<[^>]+>/g,' ').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/&#39;|&rsquo;/g,'’').replace(/&quot;/g,'"').replace(/\s+/g,' ').trim();}
function ago(t){const m=Math.round((Date.now()-t)/60000); if(!isFinite(m)||m<0)return''; if(m<60)return m+' min ago'; const h=Math.round(m/60); return h<24?h+' h ago':Math.round(h/24)+' d ago';}
async function fetchFeed(F){
  const ac=new AbortController(); const tm=setTimeout(()=>ac.abort(),10000);
  try{
    const r=await fetch('https://api.rss2json.com/v1/api.json?rss_url='+encodeURIComponent(F.u),{signal:ac.signal});
    const j=await r.json(); if(j.status!=='ok')return null;
    let it=(j.items||[]).map(i=>({t:strip(i.title),d:strip(i.description||i.content).slice(0,600),ts:Date.parse((i.pubDate||'').replace(' ','T')+'Z')||Date.parse(i.pubDate)||0}));
    if(F.filter)it=it.filter(i=>RELEVANT.test(i.t+' '+i.d));
    return it.slice(0,3);
  }catch(e){return null;} finally{clearTimeout(tm);}
}
async function refreshNews(force){
  let cached=null; try{cached=JSON.parse(localStorage.getItem(NEWS_KEY)||'null');}catch(e){}
  if(cached&&!news)news=cached;
  if(!force&&cached&&Date.now()-cached.t<10*60000)return;
  if(navigator.onLine===false)return;
  const res=await Promise.all(FEEDS.map(F=>fetchFeed(F).then(it=>({F,it}))));
  const srcs=res.filter(x=>x.it&&x.it.length).map(x=>({k:x.F.k,t:x.F.t,items:x.it}));
  if(!srcs.length)return;
  news={t:Date.now(),srcs}; try{localStorage.setItem(NEWS_KEY,JSON.stringify(news));}catch(e){}
  document.querySelectorAll('.nstrip').forEach(el=>paintStrip(el));
}
function paintStrip(el){
  if(!news||!news.srcs.length){ el.innerHTML='<div class="ns-empty">'+(navigator.onLine===false?'Offline — news will load when you have signal.':'Loading Garda · crime · court news…')+'</div>'; return; }
  const idx=Math.min(+(el.dataset.i||0),news.srcs.length-1);
  el.innerHTML='<div class="ns-head"><span class="ns-pip"></span><b>GARDA · CRIME · COURTS</b><span class="ns-as">updated '+new Date(news.t).toLocaleTimeString('en-IE',{hour:'2-digit',minute:'2-digit',hour12:false})+'</span></div>'
    +'<div class="ns-track">'+news.srcs.map((S,si)=>'<div class="ns-card" data-si="'+si+'"><div class="ns-src">'+esc(S.t)+'<em>'+(si+1)+' / '+news.srcs.length+'</em></div>'
      +S.items.map((it,ii)=>'<button class="ns-row" data-si="'+si+'" data-ii="'+ii+'"><span class="ns-t">'+esc(it.t)+'</span><span class="ns-ago">'+esc(ago(it.ts))+'</span></button>').join('')+'</div>').join('')+'</div>'
    +'<div class="ns-dots">'+news.srcs.map((S,si)=>'<i class="'+(si===idx?'on':'')+'"></i>').join('')+'</div>'
    +'<div class="ns-foot">swipe ‹ › for another source · tap a story to read it here</div>';
  const tr=el.querySelector('.ns-track');
  requestAnimationFrame(()=>{ tr.scrollLeft=idx*tr.clientWidth; });
  let st; tr.addEventListener('scroll',()=>{clearTimeout(st);st=setTimeout(()=>{const i=Math.round(tr.scrollLeft/Math.max(1,tr.clientWidth)); el.dataset.i=i;
    el.querySelectorAll('.ns-dots i').forEach((d,di)=>d.classList.toggle('on',di===i));},90);},{passive:true});
  el.querySelectorAll('.ns-row').forEach(b=>b.addEventListener('click',()=>openStory(news.srcs[+b.dataset.si],+b.dataset.ii)));
}
function openStory(S,ii){
  let o=$('#mStory');
  if(!o){ o=document.createElement('div'); o.id='mStory'; o.className='m-ov hidden';
    o.innerHTML='<div class="m-top"><button class="m-x" id="mSx">‹ Back</button><div class="m-tt"><b id="mSsrc">NEWS</b><small class="hudclock" data-f="line"></small></div><span></span></div><div class="m-scroll m-story" id="mSbody"></div>';
    document.body.appendChild(o); $('#mSx').addEventListener('click',()=>{o.classList.add('hidden');document.body.classList.remove('m-open');}); }
  const it=S.items[ii];
  $('#mSsrc').textContent=S.t.toUpperCase();
  $('#mSbody').innerHTML='<h2>'+esc(it.t)+'</h2><div class="m-when">'+(it.ts?new Date(it.ts).toLocaleString('en-IE',{weekday:'short',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit',hour12:false}):'')+' · '+esc(S.t)+'</div>'
    +'<p>'+esc(it.d||'No summary provided by the source.')+'</p>'
    +'<p class="m-note">Summary as published in the source’s news feed. More from this source:</p>'
    +S.items.map((x,k)=>k===ii?'':'<button class="ns-row" data-k="'+k+'"><span class="ns-t">'+esc(x.t)+'</span><span class="ns-ago">'+esc(ago(x.ts))+'</span></button>').join('');
  $('#mSbody').querySelectorAll('.ns-row').forEach(b=>b.addEventListener('click',()=>openStory(S,+b.dataset.k)));
  o.classList.remove('hidden'); document.body.classList.add('m-open'); $('#mSbody').scrollTop=0;
}
function mountNewsStrip(el){ if(!el)return; el.classList.add('nstrip'); paintStrip(el); refreshNews(false).then(()=>paintStrip(el)); }
setInterval(()=>{ if(document.visibilityState==='visible'&&document.querySelector('.nstrip'))refreshNews(false); },5*60000);

window.GRMedia={openTV,openRadio,mountNewsStrip,refreshNews:()=>refreshNews(true)};
})();
