/* Assisting — Translator.
   Text, two-way conversation, camera/photo and document translation through the officer's own AI key (needs signal),
   plus a built-in offline phrasebook for scenes. Legal cautions and rights are never machine-translated here —
   those need the official letter of rights or an interpreter. Everything kept (history, starred, glossary) stays on this phone. */
(function(){
'use strict';
const W=window, D=document;
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const I=n=>W.GRI?GRI(n):'';
const ls={ get(k,d){ try{ const v=localStorage.getItem(k); return v==null?d:JSON.parse(v); }catch(e){ return d; } }, set(k,v){ try{ localStorage.setItem(k,JSON.stringify(v)); }catch(e){} } };
const toast=m=>{ if(W.grToast)grToast(m); };

/* [name, own name, BCP-47 code for speech, right-to-left, non-Latin script] */
const LANGS=[['English','English','en-IE'],['Irish','Gaeilge','ga-IE'],['Polish','Polski','pl-PL'],['Romanian','Română','ro-RO'],['Lithuanian','Lietuvių','lt-LT'],['Latvian','Latviešu','lv-LV'],
 ['Portuguese (Brazil)','Português (Brasil)','pt-BR'],['Portuguese (Portugal)','Português','pt-PT'],['Spanish','Español','es-ES'],['French','Français','fr-FR'],['German','Deutsch','de-DE'],['Italian','Italiano','it-IT'],
 ['Dutch','Nederlands','nl-NL'],['Ukrainian','Українська','uk-UA',0,1],['Russian','Русский','ru-RU',0,1],['Bulgarian','Български','bg-BG',0,1],['Czech','Čeština','cs-CZ'],['Slovak','Slovenčina','sk-SK'],
 ['Hungarian','Magyar','hu-HU'],['Croatian','Hrvatski','hr-HR'],['Serbian','Српски','sr-RS',0,1],['Albanian','Shqip','sq-AL'],['Greek','Ελληνικά','el-GR',0,1],['Georgian','ქართული','ka-GE',0,1],
 ['Turkish','Türkçe','tr-TR'],['Arabic','العربية','ar-SA',1,1],['Kurdish (Sorani)','کوردی','ckb-IQ',1,1],['Persian (Farsi)','فارسی','fa-IR',1,1],['Dari','دری','fa-AF',1,1],['Pashto','پښتو','ps-AF',1,1],
 ['Urdu','اردو','ur-PK',1,1],['Hindi','हिन्दी','hi-IN',0,1],['Punjabi','ਪੰਜਾਬੀ','pa-IN',0,1],['Bengali','বাংলা','bn-BD',0,1],['Mandarin Chinese','中文（普通话）','zh-CN',0,1],['Cantonese','粵語','zh-HK',0,1],
 ['Vietnamese','Tiếng Việt','vi-VN'],['Tagalog / Filipino','Filipino','fil-PH'],['Malay','Bahasa Melayu','ms-MY'],['Japanese','日本語','ja-JP',0,1],['Korean','한국어','ko-KR',0,1],
 ['Somali','Soomaali','so-SO'],['Tigrinya','ትግርኛ','ti-ER',0,1],['Amharic','አማርኛ','am-ET',0,1],['Swahili','Kiswahili','sw-KE'],['Yoruba','Yorùbá','yo-NG'],['Igbo','Igbo','ig-NG'],['Hausa','Hausa','ha-NG']];
const LX=n=>LANGS.find(l=>l[0]===n)||LANGS[0];

/* ---------- Offline phrasebook (written and checked by hand — still confirm the person understood) ---------- */
const PL=['Polish','Romanian','Lithuanian','Portuguese (Brazil)','Spanish','Ukrainian','Russian','Arabic','Mandarin Chinese','French'];
const YN={Polish:['Tak','Nie'],Romanian:['Da','Nu'],Lithuanian:['Taip','Ne'],'Portuguese (Brazil)':['Sim','Não'],Spanish:['Sí','No'],Ukrainian:['Так','Ні'],Russian:['Да','Нет'],Arabic:['نعم','لا'],'Mandarin Chinese':['是','不是'],French:['Oui','Non']};
const PH=[
 ['Basics','Hello, I am a police officer (Garda).',['Dzień dobry, jestem policjantem (Garda).','Bună ziua, sunt polițist (Garda).','Laba diena, aš esu policijos pareigūnas (Garda).','Olá, sou policial (Garda).','Hola, soy agente de policía (Garda).','Добрий день, я поліцейський (Garda).','Здравствуйте, я полицейский (Garda).','مرحباً، أنا شرطي (Garda).','您好，我是警察（Garda）。','Bonjour, je suis policier (Garda).']],
 ['Basics','Do you speak English?',['Czy mówi Pan/Pani po angielsku?','Vorbiți engleză?','Ar kalbate angliškai?','Você fala inglês?','¿Habla inglés?','Ви говорите англійською?','Вы говорите по-английски?','هل تتكلم الإنجليزية؟','您会说英语吗？','Parlez-vous anglais ?']],
 ['Basics','What language do you speak?',['W jakim języku Pan/Pani mówi?','Ce limbă vorbiți?','Kokia kalba kalbate?','Que língua você fala?','¿Qué idioma habla?','Якою мовою ви говорите?','На каком языке вы говорите?','ما هي اللغة التي تتكلمها؟','您说什么语言？','Quelle langue parlez-vous ?']],
 ['Basics','I will get an interpreter.',['Wezwę tłumacza.','Voi chema un interpret.','Iškviesiu vertėją.','Vou chamar um intérprete.','Voy a llamar a un intérprete.','Я викличу перекладача.','Я вызову переводчика.','سأطلب مترجماً.','我会叫一位翻译。','Je vais faire venir un interprète.']],
 ['Basics','Thank you.',['Dziękuję.','Mulțumesc.','Ačiū.','Obrigado.','Gracias.','Дякую.','Спасибо.','شكراً.','谢谢。','Merci.']],
 ['Safety & medical','Are you hurt?',['Czy jest Pan/Pani ranny/ranna?','Sunteți rănit?','Ar esate sužeistas?','Você está ferido?','¿Está herido?','Ви поранені?','Вы ранены?','هل أنت مصاب؟','您受伤了吗？','Êtes-vous blessé ?']],
 ['Safety & medical','Do you need an ambulance?',['Czy potrzebuje Pan/Pani karetki?','Aveți nevoie de o ambulanță?','Ar jums reikia greitosios pagalbos?','Você precisa de uma ambulância?','¿Necesita una ambulancia?','Вам потрібна швидка допомога?','Вам нужна скорая помощь?','هل تحتاج إلى سيارة إسعاف؟','您需要救护车吗？','Avez-vous besoin d’une ambulance ?']],
 ['Safety & medical','Where does it hurt?',['Gdzie boli?','Unde vă doare?','Kur skauda?','Onde dói?','¿Dónde le duele?','Де болить?','Где болит?','أين تشعر بالألم؟','哪里疼？','Où avez-vous mal ?']],
 ['Safety & medical','Are you safe now?',['Czy jest Pan/Pani teraz bezpieczny/bezpieczna?','Sunteți în siguranță acum?','Ar dabar esate saugus?','Você está seguro agora?','¿Está a salvo ahora?','Ви зараз у безпеці?','Вы сейчас в безопасности?','هل أنت في أمان الآن؟','您现在安全吗？','Êtes-vous en sécurité maintenant ?']],
 ['Safety & medical','Stay calm. You are safe.',['Proszę zachować spokój. Jest Pan/Pani bezpieczny/bezpieczna.','Vă rog să vă calmați. Sunteți în siguranță.','Prašau nusiraminti. Jūs esate saugus.','Fique calmo. Você está seguro.','Mantenga la calma. Está a salvo.','Будь ласка, заспокойтеся. Ви в безпеці.','Пожалуйста, успокойтесь. Вы в безопасности.','اهدأ من فضلك. أنت في أمان.','请保持冷静。您是安全的。','Restez calme. Vous êtes en sécurité.']],
 ['At the scene','What happened?',['Co się stało?','Ce s-a întâmplat?','Kas atsitiko?','O que aconteceu?','¿Qué ha pasado?','Що сталося?','Что случилось?','ماذا حدث؟','发生了什么事？','Que s’est-il passé ?']],
 ['At the scene','Who did this?',['Kto to zrobił?','Cine a făcut asta?','Kas tai padarė?','Quem fez isso?','¿Quién ha hecho esto?','Хто це зробив?','Кто это сделал?','من فعل هذا؟','这是谁干的？','Qui a fait cela ?']],
 ['At the scene','Where is the person now?',['Gdzie jest teraz ta osoba?','Unde este persoana acum?','Kur dabar yra tas asmuo?','Onde está a pessoa agora?','¿Dónde está esa persona ahora?','Де зараз ця людина?','Где сейчас этот человек?','أين هذا الشخص الآن؟','那个人现在在哪里？','Où est cette personne maintenant ?']],
 ['At the scene','Which way did they go?',['W którą stronę poszli?','În ce direcție au plecat?','Į kurią pusę jie nuėjo?','Para que lado eles foram?','¿Hacia dónde se fueron?','У який бік вони пішли?','В какую сторону они ушли?','في أي اتجاه ذهبوا؟','他们往哪个方向走了？','Dans quelle direction sont-ils partis ?']],
 ['At the scene','Is anyone else hurt?',['Czy ktoś jeszcze jest ranny?','Mai este cineva rănit?','Ar dar kas nors sužeistas?','Mais alguém está ferido?','¿Hay alguien más herido?','Чи ще хтось поранений?','Кто-нибудь ещё ранен?','هل هناك شخص آخر مصاب؟','还有其他人受伤吗？','Y a-t-il d’autres blessés ?']],
 ['At the scene','Did anyone else see what happened?',['Czy ktoś jeszcze widział, co się stało?','A mai văzut cineva ce s-a întâmplat?','Ar dar kas nors matė, kas atsitiko?','Mais alguém viu o que aconteceu?','¿Alguien más vio lo que pasó?','Чи ще хтось бачив, що сталося?','Кто-нибудь ещё видел, что произошло?','هل رأى أحد آخر ما حدث؟','还有其他人看到发生了什么吗？','Quelqu’un d’autre a-t-il vu ce qui s’est passé ?']],
 ['Details','What is your name?',['Jak się Pan/Pani nazywa?','Cum vă numiți?','Koks jūsų vardas?','Qual é o seu nome?','¿Cómo se llama?','Як вас звати?','Как вас зовут?','ما اسمك؟','您叫什么名字？','Comment vous appelez-vous ?']],
 ['Details','What is your date of birth?',['Jaka jest Pana/Pani data urodzenia?','Care este data dumneavoastră de naștere?','Kokia jūsų gimimo data?','Qual é a sua data de nascimento?','¿Cuál es su fecha de nacimiento?','Яка ваша дата народження?','Какая у вас дата рождения?','ما هو تاريخ ميلادك؟','您的出生日期是什么？','Quelle est votre date de naissance ?']],
 ['Details','Where do you live?',['Gdzie Pan/Pani mieszka?','Unde locuiți?','Kur gyvenate?','Onde você mora?','¿Dónde vive?','Де ви живете?','Где вы живёте?','أين تسكن؟','您住在哪里？','Où habitez-vous ?']],
 ['Details','Do you have identification?',['Czy ma Pan/Pani dokument tożsamości?','Aveți un act de identitate?','Ar turite asmens dokumentą?','Você tem um documento de identidade?','¿Tiene algún documento de identidad?','У вас є документ, що посвідчує особу?','У вас есть документ, удостоверяющий личность?','هل لديك بطاقة هوية؟','您有身份证件吗？','Avez-vous une pièce d’identité ?']],
 ['Details','What is your phone number?',['Jaki jest Pana/Pani numer telefonu?','Care este numărul dumneavoastră de telefon?','Koks jūsų telefono numeris?','Qual é o seu número de telefone?','¿Cuál es su número de teléfono?','Який ваш номер телефону?','Какой у вас номер телефона?','ما هو رقم هاتفك؟','您的电话号码是多少？','Quel est votre numéro de téléphone ?']],
 ['Instructions','Please wait here.',['Proszę tu zaczekać.','Vă rog să așteptați aici.','Prašau palaukti čia.','Por favor, espere aqui.','Por favor, espere aquí.','Будь ласка, зачекайте тут.','Пожалуйста, подождите здесь.','من فضلك انتظر هنا.','请在这里等候。','Veuillez attendre ici.']],
 ['Instructions','Please show me your hands.',['Proszę pokazać ręce.','Vă rog să-mi arătați mâinile.','Prašau parodyti rankas.','Por favor, mostre as mãos.','Por favor, enséñeme las manos.','Будь ласка, покажіть руки.','Пожалуйста, покажите руки.','من فضلك أرني يديك.','请让我看看您的双手。','Montrez-moi vos mains, s’il vous plaît.']],
 ['Instructions','Step back, please.',['Proszę się cofnąć.','Vă rog să faceți un pas înapoi.','Prašau atsitraukti.','Por favor, afaste-se.','Por favor, retroceda.','Будь ласка, відійдіть назад.','Пожалуйста, отойдите назад.','من فضلك تراجع إلى الخلف.','请往后退。','Reculez, s’il vous plaît.']],
 ['Vehicles','Is this your vehicle?',['Czy to jest Pana/Pani pojazd?','Acesta este vehiculul dumneavoastră?','Ar tai jūsų transporto priemonė?','Este veículo é seu?','¿Es este su vehículo?','Це ваш транспортний засіб?','Это ваше транспортное средство?','هل هذه مركبتك؟','这是您的车吗？','Est-ce votre véhicule ?']],
 ['Vehicles','Please show me your driving licence.',['Proszę pokazać prawo jazdy.','Vă rog să-mi arătați permisul de conducere.','Prašau parodyti vairuotojo pažymėjimą.','Por favor, mostre sua carteira de motorista.','Por favor, enséñeme su permiso de conducir.','Будь ласка, покажіть посвідчення водія.','Пожалуйста, покажите водительское удостоверение.','من فضلك أرني رخصة القيادة.','请出示您的驾驶执照。','Montrez-moi votre permis de conduire, s’il vous plaît.']],
 ['Vehicles','Please turn off the engine.',['Proszę wyłączyć silnik.','Vă rog să opriți motorul.','Prašau išjungti variklį.','Por favor, desligue o motor.','Por favor, apague el motor.','Будь ласка, вимкніть двигун.','Пожалуйста, заглушите двигатель.','من فضلك أطفئ المحرك.','请关闭发动机。','Coupez le moteur, s’il vous plaît.']]
];
/* Cyrillic → Latin letters so you can read it aloud (offline) */
const CYR={а:'a',б:'b',в:'v',г:'h',ґ:'g',д:'d',е:'e',є:'ye',ж:'zh',з:'z',и:'y',і:'i',ї:'yi',й:'y',к:'k',л:'l',м:'m',н:'n',о:'o',п:'p',р:'r',с:'s',т:'t',у:'u',ф:'f',х:'kh',ц:'ts',ч:'ch',ш:'sh',щ:'shch',ь:'',ю:'yu',я:'ya',ё:'yo',ы:'y',э:'e',ъ:''};
function translit(s,lang){ const ru=lang==='Russian'; return s.replace(/[Ѐ-ӿ]/g,ch=>{ const lo=ch.toLowerCase(); let r=CYR[lo]; if(r==null)return ch; if(ru){ if(lo==='г')r='g'; if(lo==='и')r='i'; if(lo==='е')r='ye'; }
  return ch!==lo&&r?r[0].toUpperCase()+r.slice(1):r; }); }

/* ---------- never machine-translate a caution or legal rights ---------- */
const RIGHTS=/you are not obliged to say anything|anything you say (may|will) be (taken down|given in evidence)|right to (consult|a) solicitor|right to remain silent|notice of rights|letter of rights|you are (being )?charged|under arrest|section 1[89]|section 19A|i caution you|you have been cautioned/i;
function rightsBlock(){ return '<div class="tr-warn">'+I('triangle-alert')+'<div><b>Not translated: this looks like a caution or legal rights.</b> Machine translation must not be used for these. Use the official letter of rights or an interpreter.<button type="button" class="tr-link" data-go="rights">Open Rights and languages</button></div></div>'; }

/* ---------- AI (your key, needs signal) ---------- */
const KEY='gr_apikey';
const S=()=>Object.assign({from:'auto',to:'Polish',formal:1,slow:0,priv:0,me:'English'},ls.get('gr_tr_set',{}));
const saveS=s=>ls.set('gr_tr_set',s);
const gloss=()=>ls.get('gr_tr_gloss',[]);
function glossText(to){ const g=gloss().filter(x=>!x.l||x.l===to); return g.length?'\nAlways use these fixed translations: '+g.map(x=>'"'+x.e+'" = "'+x.t+'"').join('; ')+'.':''; }
async function ai(content,maxTok){
  const key=(localStorage.getItem(KEY)||'').trim(); if(!key)throw new Error('nokey');
  if(navigator.onLine===false)throw new Error('No signal — the phrasebook works offline.');
  let models=['claude-sonnet-5','claude-sonnet-4-6']; try{ const p=localStorage.getItem('gr_ai_model'); if(p&&models.includes(p))models=[p].concat(models.filter(m=>m!==p)); }catch(e){}
  let last=null;
  for(const model of models){
    const r=await fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'Content-Type':'application/json','x-api-key':key,'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'},
      body:JSON.stringify({model,max_tokens:maxTok||1500,messages:[{role:'user',content}]})});
    const d=await r.json().catch(()=>({}));
    if(!r.ok||d.error){ const m=(d.error&&d.error.message)||('HTTP '+r.status); if(r.status===404||/model/i.test(m)){ last=new Error(m); continue; } throw new Error(r.status===401?'The AI key was refused — check it in Settings → AI search.':m); }
    const txt=(d.content||[]).filter(b=>b.type==='text').map(b=>b.text).join('').trim();
    const j=txt.slice(txt.indexOf('{'),txt.lastIndexOf('}')+1); try{ return JSON.parse(j); }catch(e){ throw new Error('The translation came back garbled — try again.'); } }
  throw last||new Error('Couldn’t reach the translator right now.'); }
const BASE='You are a professional interpreter helping a police officer in Ireland (An Garda Síochána) communicate with a member of the public. ';
const RULE=' If the text is a legal caution, a statement of legal rights, or a formal charge, do not translate it and return {"refuse":true}. Keep names, numbers, times, addresses and registration numbers exactly as written.';
function promptText(text,from,to,formal){ return BASE+'Translate the TEXT '+(from==='auto'?'(detect its language)':'from '+from)+' into '+to+'. Register: '+(formal?'formal and polite':'informal and friendly')+'. Translate the meaning and tone, including idioms and slang, not word for word.'+RULE+glossText(to)
  +'\nReturn only JSON: {"detected":"<source language name in English>","translation":"...","romanisation":"<pronunciation in Latin letters if '+to+' is not written in Latin letters, else empty>","back":"<the translation translated back into English, literally>","alternatives":[{"text":"<another way to say it>","note":"<when to use it>"}],"notes":"<one short sentence on any ambiguity, or empty>"}\nTEXT:\n'+text; }

/* ---------- speech ---------- */
const SR=W.SpeechRecognition||W.webkitSpeechRecognition;
function speak(text,lang){ try{ speechSynthesis.cancel(); const u=new SpeechSynthesisUtterance(text); u.lang=LX(lang)[2]; u.rate=S().slow?0.6:0.95;
  const v=(speechSynthesis.getVoices()||[]).find(x=>x.lang&&x.lang.toLowerCase().startsWith(u.lang.slice(0,2).toLowerCase())); if(v)u.voice=v; else toast('No '+lang+' voice on this phone — it may sound wrong. Add one in your phone’s text-to-speech settings.');
  speechSynthesis.speak(u); }catch(e){ toast('Speech isn’t available on this phone'); } }
function listen(lang,onText,onEnd){ if(!SR){ toast('Voice input isn’t supported in this browser — type instead'); onEnd&&onEnd(); return null; }
  const r=new SR(); r.lang=LX(lang)[2]; r.interimResults=true; r.maxAlternatives=1; let fin='';
  r.onresult=e=>{ let t=''; for(let i=0;i<e.results.length;i++)t+=e.results[i][0].transcript; fin=t; onText(t,false); };
  r.onerror=e=>{ if(e.error!=='no-speech'&&e.error!=='aborted')toast('Mic: '+e.error); };
  r.onend=()=>{ onText(fin,true); onEnd&&onEnd(fin); };
  try{ r.start(); }catch(e){ onEnd&&onEnd(); return null; } return r; }

/* ---------- history / starred ---------- */
function addHist(o){ if(S().priv)return; const h=ls.get('gr_tr_hist',[]); h.unshift(Object.assign({ts:Date.now()},o)); ls.set('gr_tr_hist',h.slice(0,80)); }
function star(o){ const f=ls.get('gr_tr_star',[]); if(f.some(x=>x.s===o.s&&x.t===o.t&&x.to===o.to)){ toast('Already starred'); return; } f.unshift(o); ls.set('gr_tr_star',f.slice(0,200)); toast('Starred — works offline'); }

/* ---------- screens ---------- */
const TABS=[['text','Text','languages'],['talk','Talk','messages-square'],['camera','Camera','camera'],['phrases','Phrases','book-open'],['saved','Saved','star']];
let cur='text';
function langSel(id,val,auto){ return '<select id="'+id+'" class="tr-sel">'+(auto?'<option value="auto"'+(val==='auto'?' selected':'')+'>Detect language</option>':'')+LANGS.map(l=>'<option value="'+esc(l[0])+'"'+(l[0]===val?' selected':'')+'>'+esc(l[0])+(l[1]!==l[0]?' · '+esc(l[1]):'')+'</option>').join('')+'</select>'; }
function head(){ return '<div class="pro" id="proTr"><div class="p-fhead">'+(W.GRPro?GRPro.icon('1f310',30):'')+'<div><h1>Translator</h1><small>'+LANGS.length+' languages · phrasebook works offline</small></div><button type="button" class="p-ib tr-cog" aria-label="Translator settings">'+I('settings')+'</button></div>'
  +'<div class="tr-tabs" role="tablist">'+TABS.map(t=>'<button type="button" role="tab" data-t="'+t[0]+'" class="'+(t[0]===cur?'on':'')+'">'+I(t[2])+'<span>'+t[1]+'</span></button>').join('')+'</div><div id="trBody"></div></div>'; }
function needKey(){ return '<div class="tr-warn">'+I('wifi-off')+'<div><b>Live translation uses your own AI key and needs signal.</b> Add it in Settings → AI search. The Phrases tab works with no key and no signal.<button type="button" class="tr-link" data-go="aikey">Add AI key</button></div></div>'; }
function err(e){ return e&&e.message==='nokey'?needKey():'<div class="tr-warn">'+I('triangle-alert')+'<div>'+esc(e&&e.message||e)+'</div></div>'; }
function resultCard(r,to,src){
  if(r.refuse)return rightsBlock();
  const L=LX(to); const rtl=L[3]?' dir="rtl"':'';
  return '<div class="p-card tr-res"><div class="tr-out"'+rtl+' lang="'+L[2]+'">'+esc(r.translation)+'</div>'
   +(r.romanisation?'<div class="tr-rom">'+esc(r.romanisation)+'</div>':'')
   +'<div class="tr-acts"><button type="button" data-a="say">'+I('volume-2')+'Speak</button><button type="button" data-a="show">'+I('maximize')+'Show them</button><button type="button" data-a="copy">'+I('copy')+'Copy</button><button type="button" data-a="star">'+I('star')+'Star</button></div>'
   +(r.back?'<div class="tr-back"><small>Back into English — check the meaning</small>'+esc(r.back)+'</div>':'')
   +(r.alternatives&&r.alternatives.length?'<div class="tr-alts"><small>Other ways to say it</small>'+r.alternatives.slice(0,3).map(a=>'<button type="button" class="tr-alt" data-alt="'+esc(a.text)+'"><b'+rtl+'>'+esc(a.text)+'</b><span>'+esc(a.note||'')+'</span></button>').join('')+'</div>':'')
   +(r.notes?'<div class="tr-note">'+I('info')+esc(r.notes)+'</div>':'')
   +(r.detected?'<div class="tr-det">From '+esc(r.detected)+'</div>':'')+'</div>'; }
function wireResult(box,r,to,src){ const q=s=>box.querySelector(s);
  box.querySelectorAll('[data-a]').forEach(b=>b.onclick=()=>{ const a=b.dataset.a;
    if(a==='say')speak(r.translation,to); else if(a==='show')showBig(r.translation,to,src); else if(a==='copy'){ try{ navigator.clipboard.writeText(r.translation); toast('Copied'); }catch(e){} } else if(a==='star')star({s:src,t:r.translation,to,rom:r.romanisation||''}); });
  box.querySelectorAll('[data-alt]').forEach(b=>b.onclick=()=>speak(b.dataset.alt,to));
  box.querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>go(b.dataset.go)); }
function go(k){ if(k==='rights'&&W.renderRights)renderRights(); else if(k==='aikey'&&W.GRSearch)GRSearch.settings(); }
function showBig(text,lang,en,yn){ let o=D.getElementById('trBig'); if(!o){ o=D.createElement('div'); o.id='trBig'; D.body.appendChild(o); }
  const L=LX(lang); const y=yn&&YN[lang];
  o.innerHTML='<div class="tr-big" role="dialog" aria-label="Show to the person"><div class="tr-big-l">'+esc(L[1])+'</div><div class="tr-big-t"'+(L[3]?' dir="rtl"':'')+' lang="'+L[2]+'">'+esc(text)+'</div>'
   +(y?'<div class="tr-yn"><button type="button" data-yn="0">'+esc(y[0])+'<small>Yes</small></button><button type="button" data-yn="1">'+esc(y[1])+'<small>No</small></button></div><div class="tr-ans" aria-live="polite"></div>':'')
   +(en?'<div class="tr-big-e">'+esc(en)+'</div>':'')+'<div class="tr-big-acts"><button type="button" data-b="say">'+I('volume-2')+'Speak</button><button type="button" data-b="x">Close</button></div></div>';
  o.querySelector('[data-b="say"]').onclick=()=>speak(text,lang); o.querySelector('[data-b="x"]').onclick=()=>{ o.innerHTML=''; };
  o.querySelectorAll('[data-yn]').forEach(b=>b.onclick=()=>{ o.querySelector('.tr-ans').textContent='They answered: '+(b.dataset.yn==='0'?'YES':'NO'); }); }
W.trBack=()=>{ const o=D.getElementById('trBig'); if(o&&o.innerHTML){ o.innerHTML=''; return true; } return false; };

function tabText(b){ const s=S();
  b.innerHTML='<div class="tr-langs">'+langSel('trFrom',s.from,1)+'<button type="button" class="tr-swap" aria-label="Swap languages">'+I('arrow-left-right')+'</button>'+langSel('trTo',s.to)+'</div>'
   +'<div class="p-card tr-in"><textarea id="trIn" rows="4" placeholder="Type, paste or speak…"></textarea><div class="tr-inacts"><button type="button" id="trMic">'+I('mic')+'Speak</button>'
   +'<label class="tr-reg"><input type="checkbox" id="trFormal"'+(s.formal?' checked':'')+'> Formal / polite</label><button type="button" id="trGo" class="tr-go">Translate</button></div></div><div id="trOut"></div>'
   +'<p class="tr-small">Names, numbers and addresses are kept as written. Read the “back into English” line to check the meaning. For a statement, interview or anything legal, use an interpreter.</p>';
  const from=b.querySelector('#trFrom'), to=b.querySelector('#trTo'), inp=b.querySelector('#trIn'), out=b.querySelector('#trOut');
  from.onchange=()=>{ const x=S(); x.from=from.value; saveS(x); }; to.onchange=()=>{ const x=S(); x.to=to.value; saveS(x); };
  b.querySelector('#trFormal').onchange=e=>{ const x=S(); x.formal=e.target.checked?1:0; saveS(x); };
  b.querySelector('.tr-swap').onclick=()=>{ const x=S(); const f=x.from==='auto'?x.me:x.from; x.from=x.to; x.to=f; saveS(x); tabText(b); };
  let rec=null; b.querySelector('#trMic').onclick=e=>{ if(rec){ rec.stop(); return; } const x=S(); const btn=e.currentTarget; btn.classList.add('live');
    rec=listen(x.from==='auto'?x.me:x.from,(t)=>{ inp.value=t; },()=>{ rec=null; btn.classList.remove('live'); if(inp.value.trim())run(); }); };
  async function run(){ const text=inp.value.trim(); if(!text)return; const x=S();
    if(RIGHTS.test(text)){ out.innerHTML=rightsBlock(); wireResult(out,{},x.to,text); return; }
    out.innerHTML='<div class="tr-wait">Translating…</div>';
    try{ const r=await ai(promptText(text,x.from,x.to,x.formal)); out.innerHTML=resultCard(r,x.to,text); wireResult(out,r,x.to,text); if(!r.refuse)addHist({s:text,t:r.translation,to:x.to,from:r.detected||x.from,rom:r.romanisation||''}); }
    catch(e){ out.innerHTML=err(e); wireResult(out,{},x.to,text); } }
  b.querySelector('#trGo').onclick=run; }

function tabTalk(b){ const s=S(); let other=s.to, turn=null, auto=ls.get('gr_tr_auto',1), rec=null; const log=[];
  b.innerHTML='<div class="tr-langs"><span class="tr-me">'+esc(s.me)+'</span>'+I('arrow-left-right')+langSel('trThem',other)+'</div>'
   +'<label class="tr-reg tr-autol"><input type="checkbox" id="trAuto"'+(auto?' checked':'')+'> Hands-free: after each turn the mic opens for the other person</label>'
   +'<div class="tr-face"><button type="button" class="tr-turn them" data-w="them"><span class="tr-flip">'+I('mic')+'<b>'+esc(LX(other)[1])+'</b><small>Tap and speak</small></span></button>'
   +'<div id="trLog" class="tr-log" aria-live="polite"><p class="tr-small">Put the phone between you. Each person taps their own button and speaks. You both see what the mic heard and the translation — fix it if it misheard a name or number.</p></div>'
   +'<button type="button" class="tr-turn me" data-w="me">'+I('mic')+'<b>'+esc(LX(s.me)[1])+'</b><small>Tap and speak</small></button></div>';
  b.querySelector('#trThem').onchange=e=>{ const x=S(); x.to=e.target.value; saveS(x); tabTalk(b); };
  b.querySelector('#trAuto').onchange=e=>{ auto=e.target.checked?1:0; ls.set('gr_tr_auto',auto); };
  const logEl=b.querySelector('#trLog');
  function paint(){ logEl.innerHTML=log.map((m,i)=>'<div class="tr-msg '+m.w+'"><div class="tr-heard"><small>Heard ('+esc(m.from)+')</small><span contenteditable="true" data-i="'+i+'">'+esc(m.s)+'</span><button type="button" data-re="'+i+'" aria-label="Translate again">'+I('refresh-cw')+'</button></div>'
     +(m.r?(m.r.refuse?rightsBlock():'<div class="tr-said"'+(LX(m.to)[3]?' dir="rtl"':'')+'>'+esc(m.r.translation)+'</div>'+(m.r.romanisation?'<div class="tr-rom">'+esc(m.r.romanisation)+'</div>':'')+'<button type="button" class="tr-link" data-say="'+i+'">'+I('volume-2')+'Say it again</button>'):'<div class="tr-wait">Translating…</div>')+'</div>').join('');
    logEl.scrollTop=logEl.scrollHeight;
    logEl.querySelectorAll('[data-re]').forEach(x=>x.onclick=()=>{ const i=+x.dataset.re; const sp=logEl.querySelector('[data-i="'+i+'"]'); log[i].s=sp.textContent.trim(); trans(i,false); });
    logEl.querySelectorAll('[data-say]').forEach(x=>x.onclick=()=>{ const m=log[+x.dataset.say]; speak(m.r.translation,m.to); });
    logEl.querySelectorAll('[data-go]').forEach(x=>x.onclick=()=>go(x.dataset.go)); }
  async function trans(i,then){ const m=log[i]; m.r=null; paint();
    if(RIGHTS.test(m.s)){ m.r={refuse:true}; paint(); return; }
    try{ m.r=await ai(promptText(m.s,m.from,m.to,S().formal),800); }catch(e){ m.r={translation:'',refuse:false}; logEl.insertAdjacentHTML('beforeend',err(e)); return; }
    paint(); if(!m.r.refuse){ addHist({s:m.s,t:m.r.translation,to:m.to,from:m.from}); speak(m.r.translation,m.to);
      if(then&&auto){ const next=m.w==='me'?'them':'me'; const wait=()=>{ if(speechSynthesis.speaking){ setTimeout(wait,300); return; } start(next); }; setTimeout(wait,600); } } }
  function start(w){ if(rec){ try{ rec.stop(); }catch(e){} rec=null; } const x=S(); const from=w==='me'?x.me:x.to, to=w==='me'?x.to:x.me;
    b.querySelectorAll('.tr-turn').forEach(t=>t.classList.toggle('live',t.dataset.w===w));
    const m={w,from,to,s:''}; log.push(m); const i=log.length-1; paint();
    rec=listen(from,(t)=>{ m.s=t; const sp=logEl.querySelector('[data-i="'+i+'"]'); if(sp)sp.textContent=t; },(fin)=>{ rec=null; b.querySelectorAll('.tr-turn').forEach(t=>t.classList.remove('live'));
      if(!m.s.trim()){ log.pop(); paint(); return; } trans(i,true); }); }
  b.querySelectorAll('.tr-turn').forEach(t=>t.onclick=()=>{ if(rec&&t.classList.contains('live')){ rec.stop(); return; } start(t.dataset.w); }); }

function tabCamera(b){ const s=S();
  b.innerHTML='<div class="tr-langs"><span class="tr-me">Translate into</span>'+langSel('trCamTo',s.me)+'</div>'
   +'<div class="tr-cam"><label class="tr-pick">'+I('camera')+'<b>Take a photo</b><small>Sign, label, note, menu, document</small><input type="file" accept="image/*" capture="environment" id="trShot" hidden></label>'
   +'<label class="tr-pick">'+I('image')+'<b>Photo or screenshot</b><small>From your gallery</small><input type="file" accept="image/*" id="trImg" hidden></label>'
   +'<label class="tr-pick">'+I('file-text')+'<b>PDF document</b><small>Text PDFs, up to about 20 pages</small><input type="file" accept="application/pdf" id="trPdf" hidden></label></div>'
   +'<p class="tr-small">'+I('shield')+' The image is sent to Anthropic with your own key to be read, and isn’t kept by this app unless you star it. Only photograph personal details (IDs, letters) where you’re allowed to.</p><div id="trCamOut"></div>';
  const out=b.querySelector('#trCamOut'); b.querySelector('#trCamTo').onchange=e=>{ const x=S(); x.me=e.target.value; saveS(x); };
  const onImg=async f=>{ if(!f)return; const to=b.querySelector('#trCamTo').value; out.innerHTML='<div class="tr-wait">Reading the image…</div>';
    try{ const {data,url}=await shrink(f);
      const r=await ai([{type:'image',source:{type:'base64',media_type:'image/jpeg',data}},{type:'text',text:BASE+'Read all the text in this image, in reading order, line by line, and translate each line into '+to+'.'+RULE+glossText(to)
        +'\nReturn only JSON: {"detected":"<language of the text>","what":"<what the image shows, e.g. road sign, medicine label, handwritten note>","lines":[{"o":"<original line>","t":"<translation>"}],"summary":"<one or two sentences in '+to+': what it says overall>"}'}],3000);
      if(r.refuse){ out.innerHTML=rightsBlock(); wireResult(out,{},to,''); return; }
      out.innerHTML='<div class="p-card tr-res"><div class="tr-shot"><img src="'+url+'" alt="Your photo"></div>'+(r.what?'<div class="tr-det">'+esc(r.what)+(r.detected?' · '+esc(r.detected):'')+'</div>':'')
        +(r.summary?'<div class="tr-out tr-sum">'+esc(r.summary)+'</div>':'')+'<div class="tr-lines">'+(r.lines||[]).map(l=>'<div class="tr-line"><span class="o">'+esc(l.o)+'</span><span class="t">'+esc(l.t)+'</span></div>').join('')+'</div>'
        +'<div class="tr-acts"><button type="button" data-c="copy">'+I('copy')+'Copy translation</button><button type="button" data-c="say">'+I('volume-2')+'Speak</button></div></div>';
      const all=(r.lines||[]).map(l=>l.t).join('\n');
      out.querySelector('[data-c="copy"]').onclick=()=>{ try{ navigator.clipboard.writeText(all); toast('Copied'); }catch(e){} };
      out.querySelector('[data-c="say"]').onclick=()=>speak(r.summary||all,to);
      addHist({s:'[photo] '+(r.what||''),t:r.summary||all.slice(0,300),to,from:r.detected||''}); }
    catch(e){ out.innerHTML=err(e); wireResult(out,{},to,''); } };
  b.querySelector('#trShot').onchange=e=>onImg(e.target.files[0]); b.querySelector('#trImg').onchange=e=>onImg(e.target.files[0]);
  b.querySelector('#trPdf').onchange=async e=>{ const f=e.target.files[0]; if(!f)return; const to=b.querySelector('#trCamTo').value;
    if(f.size>12e6){ out.innerHTML=err(new Error('That PDF is too big — try one under 12 MB.')); return; }
    out.innerHTML='<div class="tr-wait">Translating the document… this can take a minute.</div>';
    try{ const data=await b64(f);
      const r=await ai([{type:'document',source:{type:'base64',media_type:'application/pdf',data}},{type:'text',text:BASE+'Translate this whole document into '+to+'. Keep its structure: headings, numbered lists, tables as simple rows, and blank lines between paragraphs.'+RULE+glossText(to)
        +'\nReturn only JSON: {"detected":"<language>","what":"<what kind of document this is>","translation":"<the full translated text>"}'}],8000);
      if(r.refuse){ out.innerHTML=rightsBlock(); wireResult(out,{},to,''); return; }
      out.innerHTML='<div class="p-card tr-res"><div class="tr-det">'+esc(r.what||'Document')+(r.detected?' · from '+esc(r.detected):'')+'</div><div class="tr-doc">'+esc(r.translation)+'</div>'
        +'<div class="tr-acts"><button type="button" data-c="copy">'+I('copy')+'Copy</button><button type="button" data-c="dl">'+I('download')+'Save as text file</button></div></div>';
      out.querySelector('[data-c="copy"]').onclick=()=>{ try{ navigator.clipboard.writeText(r.translation); toast('Copied'); }catch(e){} };
      out.querySelector('[data-c="dl"]').onclick=()=>{ const a=D.createElement('a'); a.href=URL.createObjectURL(new Blob([r.translation],{type:'text/plain;charset=utf-8'})); a.download=(f.name.replace(/\.pdf$/i,'')||'document')+' ('+to+').txt'; a.click(); }; }
    catch(e){ out.innerHTML=err(e); wireResult(out,{},to,''); } }; }
function b64(f){ return new Promise((res,rej)=>{ const r=new FileReader(); r.onload=()=>res(String(r.result).split(',')[1]); r.onerror=rej; r.readAsDataURL(f); }); }
function shrink(f){ return new Promise((res,rej)=>{ const img=new Image(); const u=URL.createObjectURL(f); img.onload=()=>{ const M=1600, k=Math.min(1,M/Math.max(img.width,img.height)); const c=D.createElement('canvas'); c.width=Math.round(img.width*k); c.height=Math.round(img.height*k);
  c.getContext('2d').drawImage(img,0,0,c.width,c.height); const url=c.toDataURL('image/jpeg',0.85); URL.revokeObjectURL(u); res({data:url.split(',')[1],url}); }; img.onerror=()=>rej(new Error('Couldn’t open that image')); img.src=u; }); }

function tabPhrases(b){ let lang=ls.get('gr_tr_pl','Polish'); if(!PL.includes(lang))lang='Polish'; const li=PL.indexOf(lang); const L=LX(lang);
  const cats=[...new Set(PH.map(p=>p[0]))];
  b.innerHTML='<div class="tr-langs"><span class="tr-me">Offline phrasebook</span><select id="trPL" class="tr-sel">'+PL.map(l=>'<option'+(l===lang?' selected':'')+'>'+esc(l)+'</option>').join('')+'</select></div>'
   +'<input type="search" id="trPF" class="tr-find" placeholder="Find a phrase…">'
   +cats.map(c=>'<div class="p-sec"><b>'+esc(c)+'</b></div><div class="p-card">'+PH.map((p,i)=>p[0]!==c?'':'<button type="button" class="tr-ph" data-p="'+i+'"><span class="en">'+esc(p[1])+'</span><span class="tx"'+(L[3]?' dir="rtl"':'')+' lang="'+L[2]+'">'+esc(p[2][li])+'</span>'
      +(L[4]&&/[Ѐ-ӿ]/.test(p[2][li])?'<span class="rom">'+esc(translit(p[2][li],lang))+'</span>':'')+'</button>').join('')+'</div>').join('')
   +'<p class="tr-small">Tap a phrase to show it full-screen, speak it, and let them answer Yes or No. Check they understood — for anything important, get an interpreter. With your AI key and signal, the Text tab translates anything into all '+LANGS.length+' languages.</p>';
  b.querySelector('#trPL').onchange=e=>{ ls.set('gr_tr_pl',e.target.value); tabPhrases(b); };
  b.querySelector('#trPF').oninput=e=>{ const q=e.target.value.toLowerCase(); b.querySelectorAll('.tr-ph').forEach(x=>{ x.hidden=!!q&&!x.textContent.toLowerCase().includes(q); }); };
  b.querySelectorAll('.tr-ph').forEach(x=>x.onclick=()=>{ const p=PH[+x.dataset.p]; showBig(p[2][li],lang,p[1],/\?$/.test(p[1])); speak(p[2][li],lang); }); }

function tabSaved(b){ const st=ls.get('gr_tr_star',[]), h=ls.get('gr_tr_hist',[]);
  const row=(x,i,k)=>'<div class="tr-hrow"><button type="button" class="tr-hmain" data-k="'+k+'" data-i="'+i+'"><span class="en">'+esc(x.s)+'</span><span class="tx"'+(LX(x.to)[3]?' dir="rtl"':'')+'>'+esc(x.t)+'</span><small>'+esc(x.to)+(x.rom?' · '+esc(x.rom):'')+'</small></button><button type="button" class="tr-del" data-dk="'+k+'" data-i="'+i+'" aria-label="Remove">'+I('x')+'</button></div>';
  b.innerHTML='<input type="search" id="trHF" class="tr-find" placeholder="Search starred and history…">'
   +'<div class="p-sec"><b>Starred</b><span class="tr-small">'+st.length+' · offline</span></div><div class="p-card">'+(st.length?st.map((x,i)=>row(x,i,'gr_tr_star')).join(''):'<p class="tr-small tr-pad">Star a translation to keep it here — it works with no signal.</p>')+'</div>'
   +'<div class="p-sec"><b>History</b>'+(h.length?'<button type="button" class="tr-link" id="trClr">Clear</button>':'')+'</div><div class="p-card">'+(S().priv?'<p class="tr-small tr-pad">Private mode is on — nothing is kept.</p>':h.length?h.map((x,i)=>row(x,i,'gr_tr_hist')).join(''):'<p class="tr-small tr-pad">Nothing yet.</p>')+'</div>';
  b.querySelector('#trHF').oninput=e=>{ const q=e.target.value.toLowerCase(); b.querySelectorAll('.tr-hrow').forEach(x=>{ x.hidden=!!q&&!x.textContent.toLowerCase().includes(q); }); };
  b.querySelectorAll('.tr-hmain').forEach(x=>x.onclick=()=>{ const it=ls.get(x.dataset.k,[])[+x.dataset.i]; if(it){ showBig(it.t,it.to,it.s); speak(it.t,it.to); } });
  b.querySelectorAll('.tr-del').forEach(x=>x.onclick=()=>{ const a=ls.get(x.dataset.dk,[]); a.splice(+x.dataset.i,1); ls.set(x.dataset.dk,a); tabSaved(b); });
  const c=b.querySelector('#trClr'); if(c)c.onclick=()=>{ ls.set('gr_tr_hist',[]); tabSaved(b); }; }

function settings(b){ const s=S(), g=gloss();
  b.innerHTML='<div class="p-sec"><b>Translator settings</b><button type="button" class="tr-link" id="trSetX">Done</button></div><div class="p-card tr-pad">'
   +'<label class="tr-field">My language'+langSel('trMe',s.me)+'</label>'
   +'<label class="tr-reg"><input type="checkbox" id="trSlow"'+(s.slow?' checked':'')+'> Slow speech</label>'
   +'<label class="tr-reg"><input type="checkbox" id="trPriv"'+(s.priv?' checked':'')+'> Private mode — don’t keep history on this phone</label></div>'
   +'<div class="p-sec"><b>My glossary</b></div><div class="p-card tr-pad"><p class="tr-small">Lock in how a word is translated, e.g. “Garda” → “Garda”, “PSV” → a phrase you trust.</p>'
   +g.map((x,i)=>'<div class="tr-g"><span>'+esc(x.e)+' → '+esc(x.t)+(x.l?' <small>('+esc(x.l)+')</small>':'')+'</span><button type="button" class="tr-del" data-g="'+i+'" aria-label="Remove">'+I('x')+'</button></div>').join('')
   +'<div class="tr-gadd"><input id="trGe" placeholder="English term"><input id="trGt" placeholder="Always translate as"><select id="trGl" class="tr-sel"><option value="">Any language</option>'+LANGS.slice(1).map(l=>'<option>'+esc(l[0])+'</option>').join('')+'</select><button type="button" id="trGadd">Add</button></div></div>'
   +'<div class="p-sec"><b>Privacy</b></div><div class="p-card tr-pad tr-small">Live translation, camera and documents send what you type, say or photograph to Anthropic using your own AI key, over an encrypted connection. Anthropic’s API terms say API data isn’t used to train its models by default. The phrasebook, starred phrases, history and glossary never leave this phone. Speech to text uses your phone’s own speech service. Never translate a caution or legal rights here.</div>';
  b.querySelector('#trSetX').onclick=()=>show(cur);
  b.querySelector('#trMe').onchange=e=>{ const x=S(); x.me=e.target.value; saveS(x); };
  b.querySelector('#trSlow').onchange=e=>{ const x=S(); x.slow=e.target.checked?1:0; saveS(x); };
  b.querySelector('#trPriv').onchange=e=>{ const x=S(); x.priv=e.target.checked?1:0; saveS(x); if(x.priv)ls.set('gr_tr_hist',[]); };
  b.querySelectorAll('[data-g]').forEach(x=>x.onclick=()=>{ const a=gloss(); a.splice(+x.dataset.g,1); ls.set('gr_tr_gloss',a); settings(b); });
  b.querySelector('#trGadd').onclick=()=>{ const e=b.querySelector('#trGe').value.trim(), t=b.querySelector('#trGt').value.trim(); if(!e||!t)return; const a=gloss(); a.push({e,t,l:b.querySelector('#trGl').value}); ls.set('gr_tr_gloss',a); settings(b); }; }

function show(t){ cur=t; const v=D.getElementById('view'); const body=v.querySelector('#trBody'); if(!body)return;
  v.querySelectorAll('.tr-tabs [data-t]').forEach(x=>x.classList.toggle('on',x.dataset.t===t));
  ({text:tabText,talk:tabTalk,camera:tabCamera,phrases:tabPhrases,saved:tabSaved})[t](body); }
W.renderTranslate=function(tabName){ const v=D.getElementById('view'); if(tabName&&TABS.some(x=>x[0]===tabName))cur=tabName;
  v.innerHTML=head(); v.scrollTop=0;
  v.querySelectorAll('.tr-tabs [data-t]').forEach(x=>x.onclick=()=>show(x.dataset.t));
  v.querySelector('.tr-cog').onclick=()=>{ v.querySelectorAll('.tr-tabs [data-t]').forEach(x=>x.classList.remove('on')); settings(v.querySelector('#trBody')); };
  if(W.wireBack)try{ wireBack(); }catch(e){}
  show(cur); };
})();
