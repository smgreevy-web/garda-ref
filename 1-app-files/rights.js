/* Assisting — Rights and languages.
   The official letter of rights (English and Irish) from the DPP's website, and a "point to your language" card so the right
   interpreter can be asked for. Legal rights are NOT translated here: only official translations may be used, and none were found
   in a free official source — so each language says to use an interpreter. */
(function(){
'use strict';
const W=window, D=document;
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const P3=c=>W.GRPro?GRPro.icon(c,30):'';
const LETTER='https://www.dppireland.ie/criminal-justice-system/letters-of-rights/', LETTER_GA='https://www.dppireland.ie/ga/criminal-justice-system/letters-of-rights';
/* [English name, the language's own name, right-to-left?] */
const LANGS=[['Polish','Polski'],['Romanian','Română'],['Lithuanian','Lietuvių'],['Portuguese','Português'],['Spanish','Español'],['Ukrainian','Українська'],['Russian','Русский'],['Arabic','العربية',1],
 ['Mandarin Chinese','中文（普通话）'],['French','Français'],['Latvian','Latviešu'],['Slovak','Slovenčina'],['Czech','Čeština'],['Hungarian','Magyar'],['Bulgarian','Български'],['Croatian','Hrvatski'],
 ['Albanian','Shqip'],['Georgian','ქართული'],['Italian','Italiano'],['German','Deutsch'],['Turkish','Türkçe'],['Urdu','اردو',1],['Persian (Farsi)','فارسی',1],['Pashto','پښتو',1],['Kurdish','Kurdî'],
 ['Somali','Soomaali'],['Hindi','हिन्दी'],['Bengali','বাংলা'],['Vietnamese','Tiếng Việt'],['Irish','Gaeilge']];
function show(){ let o=D.getElementById('rtFull'); if(!o){ o=D.createElement('div'); o.id='rtFull'; D.body.appendChild(o); }
  o.innerHTML='<div class="rt-full" role="dialog" aria-label="Point to your language"><div class="rt-top"><b>☝ Point to your language</b><button type="button" class="rt-x">Close</button></div><div class="rt-grid">'+LANGS.map((l,i)=>'<button type="button" data-l="'+i+'"'+(l[2]?' dir="rtl"':'')+'>'+esc(l[1])+'</button>').join('')+'</div></div>';
  o.querySelector('.rt-x').onclick=()=>{ o.innerHTML=''; };
  o.querySelectorAll('[data-l]').forEach(b=>b.onclick=()=>{ o.innerHTML=''; W.renderRights(+b.dataset.l); }); }
W.rtBack=()=>{ const o=D.getElementById('rtFull'); if(o&&o.innerHTML){ o.innerHTML=''; return true; } return false; };
W.renderRights=function(li){
  const L=li!=null&&LANGS[li]?LANGS[li]:null;
  view.innerHTML='<div class="pro" id="proRights"><div class="p-fhead">'+P3('1f5e3-fe0f')+'<div><h1>Rights and languages</h1><small>Custody · the official letter, and finding the right interpreter</small></div></div>'
   +(L?'<div class="p-card rt-pick"><small>They pointed to</small><b'+(L[2]?' dir="rtl"':'')+'>'+esc(L[1])+'</b><span>'+esc(L[0])+'</span><p><b>Use an interpreter for '+esc(L[0])+'.</b> An official translation of the notice of rights wasn’t found in a free official source, so it isn’t shown here. Give the station’s official translated notice if it has one, and record the language and the time you asked for the interpreter in the custody record.</p></div>':'')
   +'<div class="p-sec"><b>Find the language</b></div><div class="p-card"><button type="button" class="p-row" data-a="point">'+P3('1f310')+'<span class="p-tx"><b>Point to your language</b><small>Full screen — hand the phone over, 30 languages in their own script</small></span><i class="p-ch">›</i></button></div>'
   +'<div class="p-sec"><b>Official letter of rights</b><button type="button" disabled style="opacity:.7">Needs signal</button></div><div class="p-card">'
   +'<button type="button" class="p-row" data-u="'+LETTER+'">'+P3('1f4dc')+'<span class="p-tx"><b>Letter of rights — custody (English)</b><small>Office of the DPP · dppireland.ie · opens in your browser</small></span><i class="p-ch">›</i></button>'
   +'<button type="button" class="p-row" data-u="'+LETTER_GA+'">'+P3('1f4dc')+'<span class="p-tx"><b>Litir um chearta (Gaeilge)</b><small>Office of the DPP · dppireland.ie</small></span><i class="p-ch">›</i></button></div>'
   +'<div class="p-sec"><b>In the app</b></div><div class="p-card"><button type="button" class="p-row" data-a="caut">'+P3('1f4ac')+'<span class="p-tx"><b>Cautions and declarations</b><small>The English wording, ready to read out</small></span><i class="p-ch">›</i></button>'
   +'<button type="button" class="p-row" data-a="clock">'+P3('23f0')+'<span class="p-tx"><b>Detention clock</b><small>Log when the interpreter was asked for and arrived</small></span><i class="p-ch">›</i></button></div>'
   +'<p class="p-foot">Why no translations? A person’s legal rights must be given in an official translation or through an interpreter. Machine translation of rights is not safe, so this app doesn’t do it. If you can get the official translated notices and permission to use them, they can be added. Source checked November 2026. Not legal advice.</p></div>';
  const root=view.querySelector('#proRights');
  root.querySelector('[data-a="point"]').onclick=show;
  root.querySelector('[data-a="caut"]').onclick=()=>renderCautions();
  root.querySelector('[data-a="clock"]').onclick=()=>{ if(W.openDetention)openDetention(); };
  root.querySelectorAll('[data-u]').forEach(b=>b.onclick=()=>{ try{ W.open(b.dataset.u,'_blank','noopener'); }catch(e){} });
  view.scrollTop=0;
};
W.GRRights={LANGS,show};
})();
