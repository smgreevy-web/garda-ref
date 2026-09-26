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
  $('#mTVt').textContent='LIVE NEWS · '+(alt?ch.altT:ch.t+' · '+ch.s).toUpperCase();
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
function favs(){try{return JSON.parse(localStorage.getItem('gr_radiofav')||'[]');}catch(e){return [];}}
function isFav(u){return favs().some(f=>f.u===u);}
function toggleFav(st){ let f=favs(); if(f.some(x=>x.u===st.u))f=f.filter(x=>x.u!==st.u); else f.unshift({n:st.n,d:st.d||'',u:st.u});
  try{localStorage.setItem('gr_radiofav',JSON.stringify(f.slice(0,40)));}catch(e){} renderRadio(); toast(isFav(st.u)?'★ Added to favourites':'Removed from favourites'); }
function stRow(st,i,src){
  const on=radio.cur&&radio.cur.u===st.u, fv=isFav(st.u);
  return '<div class="m-st'+(on?' on':'')+'" data-q="'+esc((st.n+' '+(st.d||'')+' '+(st.g||'')).toLowerCase())+'">'
    +'<button class="m-stp" data-src="'+src+'" data-i="'+i+'"><span class="m-sti">'+(on&&radio.state==='playing'?'<i class="eq"><b></b><b></b><b></b></i>':'▶')+'</span><span class="m-stt"><b>'+esc(st.n)+'</b><small>'+esc(st.d||'')+'</small></span></button>'
    +'<button class="m-fav'+(fv?' on':'')+'" data-src="'+src+'" data-i="'+i+'" aria-label="'+(fv?'Remove from':'Add to')+' favourites">'+(fv?'★':'☆')+'</button></div>';
}
const PINNED=STATIONS.map(([g,n,d,u])=>({g,n,d,u}));
function renderRadio(){
  const L=$('#mRlist'); if(!L)return;
  const F=favs(); let h='', last='';
  if(F.length){ h+='<h3 class="m-h">★ Favourites</h3><div class="m-list">'+F.map((st,i)=>stRow(st,i,'f')).join('')+'</div>'; }
  PINNED.forEach((st,i)=>{ if(st.g!==last){ h+=(last?'</div>':'')+'<h3 class="m-h">'+esc(st.g)+'</h3><div class="m-list">'; last=st.g; } h+=stRow(st,i,'p'); });
  h+='</div><h3 class="m-h">All Irish stations <small id="mRallN">'+(radio.all?radio.all.length:'loading…')+'</small></h3><div class="m-list" id="mRall">'
    +(radio.all?radio.all.map((st,i)=>stRow(st,i,'a')).join(''):'<p class="m-note">Loading the full station directory…</p>')+'</div>'
    +'<p class="m-note">Tap ☆ to add a station to Favourites. Live internet streams — needs signal. A web app can’t reach the phone’s built-in FM tuner, so there’s no offline FM.</p>';
  L.innerHTML=h;
  const pick=b=>b.dataset.src==='p'?PINNED[+b.dataset.i]:(b.dataset.src==='f'?F[+b.dataset.i]:radio.all[+b.dataset.i]);
  L.querySelectorAll('.m-stp').forEach(b=>b.addEventListener('click',()=>{ const st=pick(b); if(radio.cur&&radio.cur.u===st.u){toggle();return;} play(st); }));
  L.querySelectorAll('.m-fav').forEach(b=>b.addEventListener('click',()=>toggleFav(pick(b))));
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

/* ================= NEED-TO-KNOW NEWS (merged, ranked for a Garda) ================= */
const FEEDS=[
  {k:'rte',t:'RTÉ News',u:['https://www.rte.ie/feeds/rss/?index=/news/ireland/']},
  {k:'rtecrime',t:'RTÉ News',u:['https://www.rte.ie/feeds/rss/?index=/news/crime/']},
  {k:'rtecourts',t:'RTÉ News',u:['https://www.rte.ie/feeds/rss/?index=/news/courts/']},
  {k:'mirror',t:'Irish Mirror',u:['https://www.irishmirror.ie/news/irish-news/crime/?service=rss','https://www.irishmirror.ie/news/irish-news/?service=rss']},
  {k:'sun',t:'The Irish Sun',u:['https://www.thesun.ie/news/feed/','https://www.thesun.ie/feed/']},
  {k:'dublinlive',t:'DublinLive',u:['https://www.dublinlive.ie/news/dublin-news/?service=rss']},
  {k:'bn',t:'BreakingNews.ie',u:['https://feeds.breakingnews.ie/bnireland']},
  {k:'indo',t:'Irish Independent',u:['https://www.independent.ie/irish-news/courts/rss']},
  {k:'examiner',t:'Irish Examiner',u:['https://www.irishexaminer.com/feed/35-top_news.xml']},
  {k:'times',t:'Irish Times',u:['https://www.irishtimes.com/arc/outboundfeeds/feed-irish-news/?from=0&size=30']},
  {k:'journal',t:'TheJournal.ie',u:['https://www.thejournal.ie/feed/']}
];
// weight, category — what a Garda needs to know first
const NW=[
  [/\b(shot|shooting|gunman|gunmen|firearms?|gun attack|shots fired)\b/i,10,'serious'],
  [/\b(stabb(ed|ing)|knife attack|machete|slash(ed|ing))\b/i,10,'serious'],
  [/\b(murder(ed)?|manslaughter|homicide|found dead|body (was )?found|died|fatal(ly)?|killed)\b/i,8,'serious'],
  [/\b(explosi(ve|on)|pipe bomb|viable device|security alert|bomb)\b/i,10,'serious'],
  [/\bmissing\b|\bconcern for\b|\bhave you seen\b/i,9,'missing'],
  [/\bappeal(s|ed)? (for|to)\b|\brenewed appeal\b|\bwitnesses\b/i,6,'missing'],
  [/\b(armed robbery|robbery|robbed|hijack(ed)?|carjack|aggravated burglary|burglar(y|ies))\b/i,7,'serious'],
  [/\b(assault(ed|s)?|attack(ed)?|violent|violence|punched|kicked)\b/i,5,'serious'],
  [/\b(hostage|abduct(ed|ion)|kidnap)/i,10,'serious'],
  [/\b(gard(a|aí|ai)|garda síochána|detective|policing)\b/i,4,'garda'],
  [/\b(arrest(ed|s)?|charged|questioned|detained|in custody)\b/i,4,'garda'],
  [/\b(drugs?|cocaine|cannabis|heroin|seiz(ed|ure)|crystal meth|ketamine)\b/i,4,'garda'],
  [/\b(court|judge|jury|trial|sentenced?|jailed|bail|dpp|pleaded|prosecut)/i,3,'courts'],
  [/\b(crash|collision|road traffic|pedestrian|cyclist|motorcyclist|m50|m1|n\d{1,2}\b|road closed|closures?|diversions?|motorway|traffic)\b/i,5,'roads'],
  [/\b(status (red|orange|yellow)|weather warning|met éireann|flooding|storm)\b/i,5,'weather'],
  [/\b(protest(ers)?|disorder|riot|public order|unrest|anti-immigration)\b/i,7,'publicorder'],
  [/\b(fire|blaze|dublin fire brigade|evacuat(ed|ion)|emergency services)\b/i,4,'serious'],
  [/\b(dublin|inner city|phibsborough|cabra|finglas|ballymun|drumcondra|mountjoy|o'?connell st|dorset st|parnell|smithfield|stoneybatter|glasnevin|santry|coolock|temple bar|north strand|east wall)\b/i,4,'dublin'],
  [/\b(psni|europol|interpol|extradit|criminal assets|kinahan|hutch|gangland|feud)\b/i,5,'serious'],
  [/\b(football|soccer|gaa|hurling|rugby|golf|tennis|oasis|concert|festival|celebrity|showbiz|recipe|fashion|horoscope|property price|house prices|stock market|shares|budget 20|eurovision|love island|tv show|film|album)\b/i,-9,'']
];
const NCATS=[['serious','Serious crime & urgent'],['missing','Missing persons & appeals'],['roads','Roads & traffic'],['weather','Weather warnings'],['publicorder','Protest & public order'],['courts','Courts'],['garda','Garda news']];
const NEWS_KEY='gr_news3', NSET_KEY='gr_newsset', NSEEN_KEY='gr_newsseen';
let news=null;
function clean(h){return String(h||'').replace(/<(br|\/p|\/div|\/li)[^>]*>/gi,'\n').replace(/<[^>]+>/g,' ').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/&#39;|&rsquo;|&#8217;/g,'’').replace(/&lsquo;|&#8216;/g,'‘').replace(/&quot;|&ldquo;|&rdquo;|&#8220;|&#8221;/g,'"').replace(/&#8211;|&ndash;/g,'–').replace(/&#8212;|&mdash;/g,'—').replace(/&hellip;|&#8230;/g,'…').replace(/[ \t]+/g,' ').replace(/\n\s*\n+/g,'\n\n').trim();}
function ago(t){const m=Math.round((Date.now()-t)/60000); if(!isFinite(m)||m<0)return''; if(m<1)return 'just now'; if(m<60)return m+' min ago'; const h=Math.floor(m/60); return h<24?h+' h ago':Math.round(h/24)+' d ago';}
function hhmm(t){const d=new Date(t);return isFinite(d)?String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0'):'';}
function when(t){const d=new Date(t); if(!isFinite(d)||!t)return''; const today=new Date().toDateString()===d.toDateString();
  return (today?'':d.toLocaleDateString('en-IE',{weekday:'short',day:'numeric',month:'short'})+' ')+hhmm(t);}
function scoreItem(it){
  const txt=it.t+' '+it.d; let s=0; const cats=new Set();
  NW.forEach(([re,w,c])=>{ if(re.test(txt)){ s+=w; if(c&&w>0)cats.add(c);} });
  it.score=s; it.cats=[...cats];
  const ageH=(Date.now()-(it.ts||0))/3600000;
  it.urgent = s>=14 && ageH<8 && cats.has('serious') || (cats.has('missing') && s>=13 && ageH<24);
  it.tier = it.urgent?3:(s>=10?2:(s>=5?1:0));
}
async function fetchFeed(F){
  for(const url of F.u){
    const ac=new AbortController(); const tm=setTimeout(()=>ac.abort(),10000);
    try{
      const r=await fetch('https://api.rss2json.com/v1/api.json?rss_url='+encodeURIComponent(url),{signal:ac.signal});
      const j=await r.json(); if(j.status!=='ok'||!(j.items||[]).length)continue;
      return (j.items||[]).map(i=>{ const d=clean(i.description), c=clean(i.content);
        const ts=Date.parse(String(i.pubDate||'').replace(' ','T')+'Z')||Date.parse(i.pubDate)||0;
        return {id:(i.guid||i.link||i.title||'').slice(-120),t:clean(i.title),d:d.slice(0,700),c:(c.length>d.length?c:d).slice(0,6000),ts,src:F.t,sk:F.k}; });
    }catch(e){} finally{clearTimeout(tm);}
  }
  return null;
}
const STOP=new Set('the a an and or of to in on for at by with from after over into as is are was were be been has have had will says said say its his her their this that it new man woman two three four five one year years old garda gardai gardaí dublin irish ireland'.split(' '));
const EVT={shoot:/\b(shot|shoot(ing|s)?|gun(man|men|fire)?|firearms?)\b/i,stab:/\b(stab(bed|bing)?|knife|slash(ed)?|machete)\b/i,missing:/\bmissing\b/i,
  crash:/\b(crash|collision|pedestrian|knocked down|hit by)\b/i,fire:/\b(fire|blaze)\b/i,drugs:/\b(drugs?|cocaine|cannabis|heroin|seiz(ed|ure))\b/i,
  robbery:/\b(robbery|robbed|raid|burglary)\b/i,death:/\b(murder|killed|died|death|dead|fatal|body)\b/i,assault:/\b(assault(ed)?|attack(ed)?)\b/i,court:/\b(court|jailed|sentenced|trial|charged)\b/i};
const NOTPLACE=new Set('Gardaí Garda Gardai The This That They There Their Dublin Ireland Irish Met Éireann Status Minister Government Court Judge Justice Monday Tuesday Wednesday Thursday Friday Saturday Sunday January February March April June July August September October November December News Live Police Man Woman Teenager Family Fans'.split(' '));
function keyWords(t){return new Set(String(t).toLowerCase().replace(/[^a-z0-9áéíóú' ]/g,' ').split(/\s+/).filter(w=>w.length>3&&!STOP.has(w)));}
function evts(t){return Object.keys(EVT).filter(k=>EVT[k].test(t));}
function places(t){return new Set((String(t).match(/\b[A-ZÁÉÍÓÚ][a-záéíóú']{3,}(?:\s[A-Z][a-z']{2,})?\b/g)||[]).filter(w=>!NOTPLACE.has(w.split(' ')[0])));}
function prep(it){ const txt=it.t+' '+(it.d||'').slice(0,300); it.kw=keyWords(it.t); it.ev=evts(txt); it.pl=places(txt); }
function sameStory(a,b){
  if(Math.abs((a.ts||0)-(b.ts||0))>36*3600000)return false;
  let kw=0; a.kw.forEach(w=>{if(b.kw.has(w))kw++;}); if(kw>=3)return true;
  const ev=a.ev.some(e=>b.ev.includes(e)); let pl=0; a.pl.forEach(w=>{if(b.pl.has(w))pl++;});
  return ev&&pl>=1;
}
function buildFeed(raw){
  const all=[]; const seen=new Set();
  raw.forEach(S=>S.items.forEach(it=>{ const k=it.t.toLowerCase(); if(seen.has(k))return; seen.add(k); scoreItem(it); prep(it); all.push(it); }));
  const rel=all.filter(it=>it.tier>0 && Date.now()-it.ts<3*86400000);
  rel.sort((a,b)=>(b.tier-a.tier)||(b.ts-a.ts));
  const clusters=[];
  rel.forEach(it=>{ const c=clusters.find(C=>sameStory(C[0],it)); if(c){ if(!c.some(x=>x.sk===it.sk))c.push(it); } else clusters.push([it]); });
  return clusters.map(C=>{ const lead=C[0]; lead.tier=Math.max(...C.map(x=>x.tier)); lead.urgent=C.some(x=>x.urgent); return {lead,also:C.slice(1)}; })
    .sort((a,b)=>(b.lead.tier-a.lead.tier)||(b.lead.ts-a.lead.ts));
}
async function refreshNews(force){
  let cached=null; try{cached=JSON.parse(localStorage.getItem(NEWS_KEY)||'null');}catch(e){}
  if(cached&&!news)news=cached;
  if(!force&&cached&&Date.now()-cached.t<8*60000)return;
  if(navigator.onLine===false)return;
  const res=await Promise.all(FEEDS.map(F=>fetchFeed(F).then(it=>({k:F.k,t:F.t,items:it||[]}))));
  const raw=res.filter(x=>x.items.length);
  if(!raw.length)return;
  // merge same-named outlets (RTÉ ireland/crime/courts) into one source page
  const bySrc={}; raw.forEach(S=>{ (bySrc[S.t]=bySrc[S.t]||[]).push(...S.items); });
  const slim=it=>({id:it.id,t:it.t,d:it.d,c:it.c,ts:it.ts,src:it.src,sk:it.sk});
  news={t:Date.now(),raw:Object.entries(bySrc).map(([t,items])=>({t,items:items.sort((a,b)=>b.ts-a.ts).slice(0,25).map(slim)}))};
  try{localStorage.setItem(NEWS_KEY,JSON.stringify(news));}catch(e){}
  notifyNew(); document.querySelectorAll('.nstrip').forEach(el=>paintStrip(el));
}
function feedNow(){ if(!news||!news.raw)return []; return buildFeed(news.raw.map(S=>({items:S.items.map(x=>Object.assign({},x))}))); }
function rowHtml(C,i){
  const it=C.lead;
  return '<button class="ns-row'+(it.urgent?' urg':'')+'" data-i="'+i+'">'
    +'<span class="ns-meta">'+(it.urgent?'<b class="ns-urg">URGENT</b>':'')+'<span class="ns-srcs">'+esc(it.src)+(C.also.length?' +'+C.also.length:'')+'</span><span class="ns-when">'+esc(when(it.ts))+' · '+esc(ago(it.ts))+'</span></span>'
    +'<span class="ns-t">'+esc(it.t)+'</span></button>';
}
let _feed=[];
function paintStrip(el){
  _feed=feedNow();
  const head='<div class="ns-head"><span class="ns-pip"></span><b>NEED-TO-KNOW NEWS</b><span class="ns-as">'+(news&&news.t?'updated '+hhmm(news.t):'')+'</span><button class="ns-bell" aria-label="News alerts settings">'+(nset().on?'🔔':'🔕')+'</button></div>';
  if(!_feed.length){ el.innerHTML=head+'<div class="ns-empty">'+(navigator.onLine===false?'Offline — news loads when you have signal.':'Loading Garda-relevant news…')+'</div>'; wireStrip(el); return; }
  el.innerHTML=head+'<div class="ns-list">'+_feed.slice(0,30).map(rowHtml).join('')+'</div>'
    +'<div class="ns-foot">ranked for Garda need-to-know · '+(news.raw||[]).length+' Irish sources · tap for the full story</div>';
  wireStrip(el);
}
function wireStrip(el){
  el.querySelectorAll('.ns-row').forEach(b=>b.addEventListener('click',()=>openStory(_feed[+b.dataset.i])));
  const bell=el.querySelector('.ns-bell'); bell&&bell.addEventListener('click',openNewsSettings);
}
function storyEl(){
  let o=$('#mStory');
  if(!o){ o=document.createElement('div'); o.id='mStory'; o.className='m-ov hidden';
    o.innerHTML='<div class="m-top"><button class="m-x" id="mSx">‹ Back</button><div class="m-tt"><b id="mSsrc">NEWS</b><small class="hudclock" data-f="line"></small></div><span></span></div><div class="m-scroll m-story" id="mSbody"></div>';
    document.body.appendChild(o); $('#mSx').addEventListener('click',()=>{o.classList.add('hidden');document.body.classList.remove('m-open');}); }
  return o;
}
function paras(t){return String(t||'').split(/\n{2,}/).map(x=>x.trim()).filter(Boolean).map(x=>'<p>'+esc(x)+'</p>').join('');}
function openStory(C){
  if(!C)return; const o=storyEl(), it=C.lead;
  $('#mSsrc').textContent=(it.urgent?'URGENT · ':'')+'NEED-TO-KNOW';
  let h='<h2>'+esc(it.t)+'</h2><div class="m-when">'+esc(when(it.ts))+' · '+esc(ago(it.ts))+' · <button class="m-srcbtn" data-s="'+esc(it.src)+'">'+esc(it.src)+' ›</button></div>'
    +(paras(it.c||it.d)||'<p>No summary provided by the source.</p>');
  if(C.also.length){
    h+='<h3 class="m-h">Also reported by</h3>'+C.also.map(x=>'<div class="m-persp"><div class="m-when">'+esc(x.src)+' · '+esc(when(x.ts))+'</div><b>'+esc(x.t)+'</b>'+(x.d?'<p>'+esc(x.d.slice(0,420))+(x.d.length>420?'…':'')+'</p>':'')+'</div>').join('');
  }
  h+='<p class="m-note">Text as published in each outlet’s news feed — some outlets only publish a summary.</p>';
  $('#mSbody').innerHTML=h;
  $('#mSbody').querySelectorAll('.m-srcbtn').forEach(b=>b.addEventListener('click',()=>openSource(b.dataset.s)));
  o.classList.remove('hidden'); document.body.classList.add('m-open'); $('#mSbody').scrollTop=0;
}
function openSource(name){
  const S=(news&&news.raw||[]).find(x=>x.t===name); if(!S)return;
  const o=storyEl(); $('#mSsrc').textContent=name.toUpperCase()+' · LATEST';
  $('#mSbody').innerHTML='<div class="m-list1">'+S.items.map((x,i)=>'<button class="ns-row" data-i="'+i+'"><span class="ns-meta"><span class="ns-when">'+esc(when(x.ts))+' · '+esc(ago(x.ts))+'</span></span><span class="ns-t">'+esc(x.t)+'</span></button>').join('')+'</div>';
  $('#mSbody').querySelectorAll('.ns-row').forEach(b=>b.addEventListener('click',()=>{const x=S.items[+b.dataset.i]; const it=Object.assign({},x); scoreItem(it); openStory({lead:it,also:[]});}));
  o.classList.remove('hidden'); document.body.classList.add('m-open'); $('#mSbody').scrollTop=0;
}
/* ---- news alerts (by category) ---- */
function nset(){ try{return Object.assign({on:false,cats:['serious','missing']},JSON.parse(localStorage.getItem(NSET_KEY)||'{}'));}catch(e){return {on:false,cats:['serious','missing']};} }
function openNewsSettings(){
  const o=storyEl(), st=nset(); $('#mSsrc').textContent='NEWS ALERTS';
  $('#mSbody').innerHTML='<h2>News alerts</h2><p>Get a phone notification when a new story in these categories appears.</p>'
    +'<label class="m-tog"><input type="checkbox" id="naOn"'+(st.on?' checked':'')+'> <b>Alerts on</b></label>'
    +'<div class="m-cats">'+NCATS.map(([k,l])=>'<label class="m-tog"><input type="checkbox" data-c="'+k+'"'+(st.cats.includes(k)?' checked':'')+'> '+esc(l)+'</label>').join('')+'</div>'
    +'<p class="m-note">Alerts are checked every few minutes while the app is open or running in the background. Android may pause web apps after the phone has been locked for a long time, so treat this as an extra, not a guarantee.</p>';
  const save=()=>{ const s2={on:$('#naOn').checked,cats:[...document.querySelectorAll('#mSbody [data-c]')].filter(x=>x.checked).map(x=>x.dataset.c)};
    localStorage.setItem(NSET_KEY,JSON.stringify(s2)); document.querySelectorAll('.ns-bell').forEach(b=>b.textContent=s2.on?'🔔':'🔕'); };
  $('#naOn').addEventListener('change',async e=>{ if(e.target.checked&&'Notification' in window&&Notification.permission!=='granted'){ const p=await Notification.requestPermission(); if(p!=='granted'){e.target.checked=false;toast('Notifications are blocked for this app in Android settings');} } save(); if(e.target.checked)markSeen(); });
  document.querySelectorAll('#mSbody [data-c]').forEach(x=>x.addEventListener('change',save));
  o.classList.remove('hidden'); document.body.classList.add('m-open');
}
function markSeen(){ const ids=feedNow().map(C=>C.lead.id); try{localStorage.setItem(NSEEN_KEY,JSON.stringify(ids.slice(0,300)));}catch(e){} }
function notifyNew(){
  const st=nset(); if(!st.on||!('Notification' in window)||Notification.permission!=='granted')return;
  let seen=[]; try{seen=JSON.parse(localStorage.getItem(NSEEN_KEY)||'[]');}catch(e){}
  const S=new Set(seen), fresh=feedNow().filter(C=>!S.has(C.lead.id)&&C.lead.tier>=2&&C.lead.cats.some(c=>st.cats.includes(c))&&Date.now()-C.lead.ts<3*3600000);
  markSeen(); if(!seen.length)return;              // first run: just remember what exists
  fresh.slice(0,3).forEach(C=>{ const it=C.lead;
    navigator.serviceWorker&&navigator.serviceWorker.ready.then(reg=>reg.showNotification((it.urgent?'URGENT · ':'')+it.t,{body:it.src+' · '+hhmm(it.ts),tag:'news-'+it.id,icon:'icons/icon-192.png',badge:'icons/badge.png',vibrate:it.urgent?[120,60,120,60,240]:[90,50,90]})).catch(()=>{}); });
}
function mountNewsStrip(el){ if(!el)return; el.classList.add('nstrip'); paintStrip(el); refreshNews(false).then(()=>paintStrip(el)); }
setInterval(()=>{ if(document.visibilityState==='visible'||nset().on)refreshNews(false); },5*60000);

window.GRMedia={openTV,openRadio,mountNewsStrip,refreshNews:()=>refreshNews(true),openNewsSettings};
})();
