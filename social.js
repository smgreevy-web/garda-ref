/* Garda Reference — Social media: read-only view of official accounts (X, Facebook, TikTok) inside the app,
   with a clear warning. Needs signal; the platforms' own embed code shows the posts. Nothing is stored. */
(function(){
'use strict';
const W=window, D=document, LSP='gr_soc';
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const ACCOUNTS={
  x:[
    {id:'gardainfo',t:'Garda Info',sub:'An Garda Síochána — national',off:1},
    {id:'GardaTraffic',t:'Garda Traffic',sub:'Roads policing',off:1},
    {id:'DubFireBrigade',t:'Dublin Fire Brigade',sub:'Fire & ambulance'},
    {id:'MetEireann',t:'Met Éireann',sub:'Weather warnings'},
    {id:'aaroadwatch',t:'AA Roadwatch',sub:'Traffic & road closures'}
  ],
  fb:[
    {id:'https://www.facebook.com/angardasiochana/',t:'An Garda Síochána',sub:'National page',off:1},
    {id:'https://www.facebook.com/318037998836039/',t:'Garda Síochána Dublin',sub:'DMR page',off:1}
  ],
  tt:[ {id:'gardainfo',t:'An Garda Síochána',sub:'@gardainfo',off:1} ]
};
const TABS=[['x','X'],['fb','Facebook'],['tt','TikTok']];
const pref=()=>{try{return JSON.parse(localStorage.getItem(LSP)||'{}')||{};}catch(e){return {};}};
const setPref=(k,v)=>{const p=pref();p[k]=v;try{localStorage.setItem(LSP,JSON.stringify(p));}catch(e){}};

let ov=null, body=null, tab='x', acc=null, tmr=null;
function build(){
  if(ov&&ov.isConnected)return;
  ov=D.createElement('div'); ov.id='soc'; ov.hidden=true; ov.setAttribute('role','dialog'); ov.setAttribute('aria-label','Social media');
  ov.innerHTML='<div class="sc-top"><button type="button" class="sc-back">‹ Back</button><div class="sc-tt"><b>Social media</b><span class="hudclock" data-f="line"></span></div><button type="button" class="sc-info" aria-label="About">ⓘ</button></div>'
   +'<div class="sc-warn"></div><div class="sc-tabs"></div><div class="sc-accs"></div><div class="sc-body"></div>';
  D.body.appendChild(ov); body=ov.querySelector('.sc-body');
  ov.querySelector('.sc-back').onclick=()=>closeSocial();
  ov.querySelector('.sc-info').onclick=()=>{ setPref('warnHidden',false); paintWarn(); };
}
function paintWarn(){
  const w=ov.querySelector('.sc-warn'), hide=pref().warnHidden;
  w.hidden=!!hide;
  w.innerHTML='<b>⚠ Read-only — official accounts</b><p>Posts are public and can be wrong or out of date: check before acting on anything. '
   +'Don’t post, comment or share about work from a personal account — follow the Garda policy on social media. '
   +'These pages are loaded from X, Facebook and TikTok, so they can see the visit.</p><button type="button" class="sc-ok">Got it</button>';
  w.querySelector('.sc-ok').onclick=()=>{ setPref('warnHidden',true); w.hidden=true; };
}
function openSocial(){
  build(); const bt=D.getElementById('boot'); if(bt&&bt.parentNode)bt.parentNode.removeChild(bt);
  ov.hidden=false; tab=pref().tab||'x'; paintWarn(); paintTabs(); if(W.grHudTick)W.grHudTick(); return true;
}
function closeSocial(){ if(!ov)return; clearTimeout(tmr); ov.hidden=true; body.innerHTML=''; ov.querySelector('.sc-accs').innerHTML=''; }
function back(){ if(!ov||ov.hidden)return false; closeSocial(); return true; }
function paintTabs(){
  const tb=ov.querySelector('.sc-tabs');
  tb.innerHTML=TABS.map(([k,l])=>'<button type="button" class="sc-tab'+(k===tab?' on':'')+'" data-tab="'+k+'">'+l+'</button>').join('');
  tb.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{ tab=b.dataset.tab; setPref('tab',tab); paintTabs(); });
  const list=ACCOUNTS[tab], saved=pref()['acc_'+tab]; acc=list.find(a=>a.id===saved)||list[0];
  const ac=ov.querySelector('.sc-accs');
  ac.innerHTML=list.map(a=>'<button type="button" class="sc-acc'+(a===acc?' on':'')+'" data-acc="'+esc(a.id)+'"><b>'+esc(a.t)+(a.off?' <i title="Official Garda account">✓</i>':'')+'</b><small>'+esc(a.sub)+'</small></button>').join('');
  ac.querySelectorAll('[data-acc]').forEach(b=>b.onclick=()=>{ acc=list.find(a=>a.id===b.dataset.acc); setPref('acc_'+tab,acc.id); ac.querySelectorAll('.sc-acc').forEach(x=>x.classList.toggle('on',x===b)); load(); });
  load();
}
function need(src,id){ return new Promise((res,rej)=>{ let s=D.getElementById(id); if(s){ if(s.dataset.ok)res(); else { s.addEventListener('load',()=>res()); s.addEventListener('error',()=>rej()); } return; }
  s=D.createElement('script'); s.id=id; s.async=true; s.src=src; s.onload=()=>{s.dataset.ok='1';res();}; s.onerror=()=>{s.remove();rej();}; D.head.appendChild(s); }); }
function offline(){ body.innerHTML='<div class="sc-msg"><b>No signal</b><span>Social media needs a connection. Everything else in the app works offline.</span></div>'; }
function load(){
  clearTimeout(tmr); body.innerHTML='<div class="sc-load">Loading…</div>';
  if(!navigator.onLine){ offline(); return; }
  const w=Math.min(500,Math.max(280,body.clientWidth-8||380));
  if(tab==='fb'){
    const src='https://www.facebook.com/plugins/page.php?href='+encodeURIComponent(acc.id)+'&tabs=timeline&width='+w+'&height=2000&small_header=true&adapt_container_width=true&hide_cover=true&show_facepile=false';
    body.innerHTML='<div class="sc-frame"><iframe title="'+esc(acc.t)+' on Facebook" src="'+esc(src)+'" width="'+w+'" height="2000" scrolling="no" frameborder="0" allowfullscreen="true" allow="encrypted-media; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin"></iframe></div>'
      +'<p class="sc-note">Showing the page’s public posts. If nothing appears, Facebook may be blocking it on this connection — try again later.</p>';
    return;
  }
  if(tab==='x'){
    body.innerHTML='<div class="sc-frame x"><a class="twitter-timeline" data-theme="dark" data-chrome="noheader nofooter transparent" data-dnt="true" data-width="'+w+'" href="https://twitter.com/'+esc(acc.id)+'">Loading posts by @'+esc(acc.id)+'…</a></div>'
      +'<p class="sc-note">X only shows timelines to people signed in to X in Chrome. If you see “Nothing to see here”, that’s why — sign in to x.com once in Chrome and it will show here.</p>';
    need('https://platform.twitter.com/widgets.js','sc-xjs').then(()=>{ try{ if(W.twttr&&W.twttr.widgets)W.twttr.widgets.load(body); }catch(e){} })
      .catch(()=>{ body.querySelector('.sc-frame').innerHTML='<div class="sc-msg"><b>Couldn’t reach X</b><span>Check your signal and try again.</span></div>'; });
    tmr=setTimeout(()=>{ const f=body.querySelector('.sc-frame iframe'); if(!f){ const n=body.querySelector('.sc-note'); if(n)n.classList.add('hl'); } },9000);
    return;
  }
  if(tab==='tt'){
    body.innerHTML='<div class="sc-frame tt"><blockquote class="tiktok-embed" cite="https://www.tiktok.com/@'+esc(acc.id)+'" data-unique-id="'+esc(acc.id)+'" data-embed-type="creator" style="max-width:'+w+'px;min-width:288px;margin:0 auto"><section><a href="https://www.tiktok.com/@'+esc(acc.id)+'">@'+esc(acc.id)+'</a></section></blockquote></div>'
      +'<p class="sc-note">Recent videos from the official account. Tapping a video plays it here.</p>';
    const old=D.getElementById('sc-ttjs'); if(old)old.remove();   // TikTok's script only scans the page once, so reload it each time
    need('https://www.tiktok.com/embed.js','sc-ttjs').catch(()=>{ body.querySelector('.sc-frame').innerHTML='<div class="sc-msg"><b>Couldn’t reach TikTok</b><span>Check your signal and try again.</span></div>'; });
  }
}
W.addEventListener('online',()=>{ if(ov&&!ov.hidden)load(); });
// keep embeds' links inside the app where possible: block navigation away for plain links in our own markup
D.addEventListener('click',e=>{ if(!ov||ov.hidden)return; const a=e.target.closest&&e.target.closest('#soc .sc-frame a'); if(a){ e.preventDefault(); } },true);

W.openSocial=openSocial; W.closeSocial=closeSocial; W.socBack=back;
})();
