/* Garda Reference — Medical emergency: 999/112, type-or-voice triage, big step-by-step first aid, CPR metronome and incident log.
   Self-contained IIFE: no libraries, all content bundled (works offline; only the optional voice recognition needs signal).
   Styles in firstaid.css (every selector #fa / .fa scoped). Content checked September 2026 against current Irish sources first
   (HSE, Irish Heart Foundation, PHECC, Epilepsy Ireland, National Poisons Information Centre, drugs.ie, ESB Networks, Irish Coast Guard)
   then Resuscitation Council UK / ERC 2025 and St John Ambulance. Every step and list item carries its source keys (s) — see S. */
(function(){
'use strict';
const W=window, D=document;
const CHECKED='Checked September 2026';

/* ---------- small helpers ---------- */
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const p2=n=>String(n).padStart(2,'0');
const hms=t=>{const d=new Date(t);return p2(d.getHours())+':'+p2(d.getMinutes())+':'+p2(d.getSeconds());};
const DAYS=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const dayStr=t=>{const d=new Date(t);return DAYS[d.getDay()]+' '+p2(d.getDate())+'/'+p2(d.getMonth()+1)+'/'+d.getFullYear();};
const clk=ms=>{ms=Math.max(0,ms);const s=Math.floor(ms/1000),h=Math.floor(s/3600),m=Math.floor(s/60)%60,x=s%60;return (h?h+':'+p2(m):String(m))+':'+p2(x);};
const clkDown=ms=>clk(Math.ceil(Math.max(0,ms)/1000)*1000);
const vib=p=>{try{if(navigator.vibrate)navigator.vibrate(p);}catch(e){}};
const store=f=>({get(k,d){try{const v=f().getItem(k);return v==null?d:JSON.parse(v);}catch(e){return d;}},set(k,v){try{f().setItem(k,JSON.stringify(v));}catch(e){}}});
const LS=store(()=>W.localStorage), SS=store(()=>W.sessionStorage);
const q=(r,s)=>r?r.querySelector(s):null, qa=(r,s)=>r?Array.from(r.querySelectorAll(s)):[];

/* ---------- sources (all fetched and read, September 2026) ---------- */
const S={
 hse_heart:['HSE — Heart attack','https://www2.hse.ie/conditions/heart-attack/'],
 hse_cpr:['HSE — How to give CPR to a baby or child','https://www2.hse.ie/babies-children/first-aid/how-to-give-cpr/'],
 hse_chk:['HSE — Choking in children aged 1 year or older','https://www2.hse.ie/babies-children/first-aid/choking-in-children/'],
 hse_chb:['HSE — Choking in babies under 1 year','https://www2.hse.ie/babies-children/first-aid/choking-in-babies/'],
 hse_stroke:['HSE — Stroke symptoms','https://www2.hse.ie/conditions/stroke/symptoms/'],
 hse_ana:['HSE — Anaphylaxis','https://www2.hse.ie/conditions/anaphylaxis/'],
 hse_hypo:['HSE — Hypoglycaemia (hypos)','https://www2.hse.ie/conditions/type-1-diabetes/blood-glucose/hypoglycaemia/'],
 hse_asthma:['HSE — Asthma attacks','https://www2.hse.ie/conditions/asthma/asthma-attacks/'],
 hse_burns:['HSE — First aid for burns and scalds','https://www2.hse.ie/babies-children/first-aid/burns-scalds/'],
 hse_head:['HSE — Head injury and concussion','https://www2.hse.ie/conditions/head-injury-concussion/'],
 hse_heat:['HSE — Heat exhaustion and heatstroke','https://www2.hse.ie/conditions/heat-exhaustion-heatstroke/'],
 hse_cold:['HSE — Keeping warm in winter (hypothermia)','https://www2.hse.ie/living-well/winter/keeping-warm-in-winter/'],
 ihf_cpr:['Irish Heart Foundation — The Hard & Fast Rule of CPR','https://irishheart.ie/campaigns/the-hard-and-fast-rule/'],
 ihf_fast:['Irish Heart Foundation — Act F.A.S.T.','https://irishheart.ie/campaigns/fast/'],
 phecc_med:['PHECC — Responder medications (CPGs 2026 edition)','https://phecc.ie/responder-medications-2026/'],
 epi_ie:['Epilepsy Ireland — Seizure first aid','https://www.epilepsy.ie/content/seizure-first-aid'],
 npic:['National Poisons Information Centre of Ireland — First aid and safety','https://poisons.ie/public/first-aid-safety/'],
 drugs_ie:['HSE drugs.ie — Naloxone','https://www.drugs.ie/resources/naloxone/'],
 garda_nal:['An Garda Síochána — What is naloxone?','https://www.garda.ie/en/crime/drugs/what-is-naloxone-.html'],
 esb:['ESB Networks — Report a fallen wire','https://www.esbnetworks.ie/services/stay-safe/report-a-fallen-wire'],
 ircg:['Irish Coast Guard, Water Safety Ireland & RNLI — water safety advice (May 2026)','https://rnli.org/news-and-media/2026/may/27/irish-coast-guard-water-safety-ireland-and-rnli-advice-ahead-of-bank-holiday'],
 rc_bls:['Resuscitation Council UK — Adult basic life support guidelines 2025','https://www.resus.org.uk/professional-library/2025-resuscitation-guidelines/adult-basic-life-support-guidelines'],
 rc_fa:['Resuscitation Council UK — First aid guidelines 2025','https://www.resus.org.uk/professional-library/2025-resuscitation-guidelines/first-aid-guidelines'],
 erc_bls:['European Resuscitation Council — Guidelines 2025: Adult basic life support','https://pubmed.ncbi.nlm.nih.gov/41117574/'],
 nhs_cpr:['NHS — CPR','https://www.nhs.uk/tests-and-treatments/first-aid/cpr/'],
 nhs_ana:['NHS — Anaphylaxis','https://www.nhs.uk/conditions/anaphylaxis/'],
 sja_cpr:['St John Ambulance — How to do CPR (adult)','https://www.sja.org.uk/first-aid-advice/cpr/'],
 sja_ccpr:['St John Ambulance — Child CPR','https://www.sja.org.uk/first-aid-advice/child-cpr/'],
 sja_bcpr:['St John Ambulance — Baby CPR','https://www.sja.org.uk/first-aid-advice/baby-cpr/'],
 sja_choke:['St John Ambulance — Choking (adult)','https://www.sja.org.uk/first-aid-advice/choking/'],
 sja_bleed:['St John Ambulance — Severe bleeding','https://www.sja.org.uk/first-aid-advice/severe-bleeding/'],
 sja_ltb:['St John Ambulance — Life-threatening bleed','https://www.sja.org.uk/first-aid-advice/life-threatening-bleed/'],
 sja_rec:['St John Ambulance — Recovery position','https://www.sja.org.uk/first-aid-advice/recovery-position/'],
 sja_heart:['St John Ambulance — Heart attack','https://www.sja.org.uk/first-aid-advice/heart-attack/'],
 sja_stroke:['St John Ambulance — Stroke','https://www.sja.org.uk/first-aid-advice/stroke/'],
 sja_seiz:['St John Ambulance — Seizures','https://www.sja.org.uk/first-aid-advice/seizure/'],
 sja_ana:['St John Ambulance — Anaphylaxis','https://www.sja.org.uk/first-aid-advice/anaphylaxis/'],
 sja_od:['St John Ambulance — Drug overdose','https://www.sja.org.uk/first-aid-advice/overdose/'],
 sja_diab:['St John Ambulance — Diabetic emergencies','https://www.sja.org.uk/first-aid-advice/diabetes/'],
 sja_asthma:['St John Ambulance — Asthma attack','https://www.sja.org.uk/first-aid-advice/asthma-attack/'],
 sja_burn:['St John Ambulance — Severe burns','https://www.sja.org.uk/first-aid-advice/severe-burn/'],
 sja_chem:['St John Ambulance — Chemical burns','https://www.sja.org.uk/first-aid-advice/chemical-burn/'],
 sja_head:['St John Ambulance — Head injury','https://www.sja.org.uk/first-aid-advice/head-injury/'],
 sja_spine:['St John Ambulance — Spinal injury','https://www.sja.org.uk/first-aid-advice/spinal-injury/'],
 sja_frac:['St John Ambulance — Broken bones and fractures','https://www.sja.org.uk/first-aid-advice/fractures-and-broken-bones/'],
 sja_cold:['St John Ambulance — Hypothermia','https://www.sja.org.uk/first-aid-advice/hypothermia/'],
 sja_hs:['St John Ambulance — Heatstroke','https://www.sja.org.uk/first-aid-advice/heatstroke/'],
 sja_drown:['St John Ambulance — Drowning','https://www.sja.org.uk/first-aid-advice/drowning/'],
 sja_elec:['St John Ambulance — Electric shock','https://www.sja.org.uk/first-aid-advice/electrocution/'],
 sja_pois:['St John Ambulance — Poisoning','https://www.sja.org.uk/first-aid-advice/poisoning/'],
 sja_alc:['St John Ambulance — Alcohol poisoning','https://www.sja.org.uk/first-aid-advice/alcohol-poisoning/'],
 sja_shock:['St John Ambulance — Shock','https://www.sja.org.uk/first-aid-advice/shock/'],
 sja_eye:['St John Ambulance — Eye injury','https://www.sja.org.uk/first-aid-advice/eye-injury/']
};

/* ---------- conditions (grid order = most critical first) ----------
   t: full title · n: tile name · sub: tile subtitle · ic: icon · crit: red tile · kw: keywords/synonyms for type + voice triage
   rec: recognise · v: variants (adult/child/baby) or steps · dont · call (call 112/999 when) · er (hospital/ED when) · src
   step: {t:text ≤20 words, s:source keys, timer:{m,up,n,end,log}, log:'event', go:'condition id', cpr:1} */
const C=[
{id:'cpr',t:'Not breathing — CPR + AED',n:'Not breathing',sub:'Cardiac arrest · CPR + AED',ic:'cpr',crit:1,cprBtn:1,
 kw:['not breathing','isnt breathing','stopped breathing','no breathing','not breathing normally','no pulse','cardiac arrest','heart stopped','collapsed','collapse','cpr','resus','resuscitation','defib','defibrillator','aed','gasping','agonal','compressions','chest compressions','mouth to mouth','kiss of life','lifeless','unresponsive not breathing','unconscious not breathing','no signs of life','baby cpr','child cpr','infant cpr'],
 rec:[['No response when you shake their shoulders and shout.','sja_cpr'],
  ['Not breathing, or not breathing normally.','rc_bls'],
  ['Gasping, slow or laboured breathing is NOT normal — treat it as cardiac arrest.','rc_bls'],
  ['A brief jerking, fit-like movement can happen at collapse — check breathing once it stops.','rc_bls']],
 v:[{k:'adult',t:'Adult',steps:[
  {t:'Make sure it’s safe to approach.',s:'rc_bls erc_bls'},
  {t:'Shake their shoulders and shout: “Are you OK?”',s:'sja_cpr'},
  {t:'No response? Shout for help. Call 112 with the phone on speaker.',s:'rc_bls ihf_cpr',log:'112 called'},
  {t:'Send someone to get the nearest AED (defibrillator).',s:'sja_cpr rc_bls'},
  {t:'Tilt the head back and lift the chin.',s:'sja_cpr'},
  {t:'Look, listen and feel for normal breathing — no more than 10 seconds.',s:'sja_cpr'},
  {t:'Not breathing normally, or only gasping? Start CPR now.',s:'rc_bls',cpr:1},
  {t:'Heel of one hand in the centre of the chest. Other hand on top, fingers interlocked.',s:'erc_bls sja_cpr'},
  {t:'Arms straight, shoulders over your hands. Push straight down 5–6 cm.',s:'erc_bls sja_cpr'},
  {t:'Push hard and fast: 100–120 a minute. Let the chest come fully back up.',s:'ihf_cpr erc_bls'},
  {t:'After 30 pushes, give 2 breaths: tilt the head, pinch the nose, seal your mouth over theirs.',s:'sja_cpr erc_bls'},
  {t:'Blow for about 1 second each — just enough to make the chest rise.',s:'erc_bls'},
  {t:'Not trained, or not willing to give breaths? Keep pushing without stopping.',s:'erc_bls sja_cpr'},
  {t:'AED arrived? Switch it on and follow its voice prompts.',s:'erc_bls ihf_cpr',log:'AED on'},
  {t:'Stick the pads to the bare chest, placed as the pictures show.',s:'erc_bls'},
  {t:'Nobody touches the person while the AED analyses or shocks.',s:'erc_bls rc_bls',log:'AED shock delivered'},
  {t:'Straight after a shock — or if no shock is advised — start pushing again.',s:'erc_bls'},
  {t:'Swap rescuers every 1–2 minutes. Keep pauses as short as possible.',s:'sja_cpr'},
  {t:'Keep going until help takes over or they start breathing normally.',s:'sja_cpr'},
  {t:'Breathing normally again? Put them in the recovery position and keep checking.',s:'rc_fa sja_rec',log:'Breathing again',go:'recovery'}]},
 {k:'child',t:'Child 1+',steps:[
  {t:'Make sure it’s safe to approach.',s:'rc_bls'},
  {t:'Tap them and shout. No response? Shout for help.',s:'sja_ccpr'},
  {t:'Call 112 now, phone on speaker, and ask for an ambulance.',s:'hse_cpr sja_ccpr',log:'112 called'},
  {t:'Hand on the forehead, tilt the head back, and lift the chin.',s:'hse_cpr'},
  {t:'Check for normal breathing — no more than 10 seconds.',s:'sja_ccpr'},
  {t:'Not breathing normally? Give 5 rescue breaths, each about 1 second.',s:'sja_ccpr nhs_cpr',cpr:1},
  {t:'Hands on the centre of the chest. Press down one-third of the chest’s depth.',s:'hse_cpr'},
  {t:'Use one hand or two — whatever it takes to reach one-third.',s:'hse_cpr'},
  {t:'Push hard and fast — slightly faster than once a second.',s:'hse_cpr sja_ccpr'},
  {t:'After every 30 compressions, give 2 breaths. Keep repeating.',s:'hse_cpr'},
  {t:'AED arrived? Switch it on. Use child mode if they’re under 8.',s:'hse_cpr',log:'AED on'},
  {t:'Keep going until they recover or help takes over.',s:'hse_cpr'}]},
 {k:'baby',t:'Baby <1',steps:[
  {t:'Make sure it’s safe to approach.',s:'rc_bls'},
  {t:'Tap the baby and call out. No response? Shout for help.',s:'sja_bcpr'},
  {t:'Call 112 now, phone on speaker, and ask for an ambulance.',s:'hse_cpr sja_bcpr',log:'112 called'},
  {t:'Hand on the forehead. Tilt the head so the nose points straight up. Lift the chin.',s:'hse_cpr'},
  {t:'Check for normal breathing — no more than 10 seconds.',s:'sja_bcpr'},
  {t:'Not breathing normally? Cover the mouth AND nose with your mouth.',s:'hse_cpr sja_bcpr',cpr:1},
  {t:'Blow steadily for about 1 second. Give 5 breaths in total.',s:'hse_cpr'},
  {t:'Two fingers in the middle of the chest. Press down one-third of its depth (about 4 cm).',s:'hse_cpr sja_bcpr'},
  {t:'Push hard and fast — slightly faster than once a second. Do 30.',s:'hse_cpr'},
  {t:'Then give 2 breaths. Keep repeating 30 compressions and 2 breaths.',s:'hse_cpr'},
  {t:'AED arrived? Switch it to child mode and follow its prompts.',s:'hse_cpr',log:'AED on'},
  {t:'Keep going until the baby recovers or help takes over.',s:'hse_cpr'}]}],
 dont:[['Don’t wait to check breathing before calling — call 112 as soon as they don’t respond.','rc_bls'],
  ['Don’t mistake gasping or slow, noisy breaths for normal breathing.','rc_bls'],
  ['Don’t hold back for fear of hurting them — the risk of harm from CPR is low.','rc_bls'],
  ['Don’t lean on the chest between pushes.','erc_bls'],
  ['Don’t stop pushing for more than 10 seconds to give breaths.','erc_bls'],
  ['Don’t touch them while the AED analyses or shocks.','erc_bls']],
 call:[['Immediately if they don’t respond — before you check breathing.','rc_bls'],
  ['Put the phone on speaker and follow the call-taker’s instructions.','rc_bls ihf_cpr'],
  ['Alone with a child or baby and no speakerphone? Give 1 minute of CPR, then call.','sja_ccpr sja_bcpr']],
 src:['rc_bls','erc_bls','ihf_cpr','hse_cpr','hse_heart','sja_cpr','sja_ccpr','sja_bcpr','nhs_cpr','rc_fa','sja_rec']},

{id:'choking',t:'Choking — adult, child, baby',n:'Choking',sub:'Adult · child · baby',ic:'choke',crit:1,
 kw:['choking','choke','choked','chokes','something stuck in throat','stuck in throat','stuck in his throat','stuck in her throat','food stuck','went down the wrong way','cant cough','cant breathe','airway blocked','blocked airway','obstruction','heimlich','back blows','abdominal thrusts','baby choking','child choking','grape'],
 rec:[['Can’t breathe, speak, cry or cough.','hse_chk'],
  ['Baby: crying or coughing but no sound comes out.','hse_chb'],
  ['Pale face, blue lips.','hse_chb'],
  ['Mild choking: can still cough and speak — encourage coughing.','sja_choke rc_fa']],
 v:[{k:'adult',t:'Adult',steps:[
  {t:'Coughing? Encourage them to keep coughing.',s:'rc_fa sja_choke'},
  {t:'Remove any obvious obstruction from the mouth.',s:'sja_choke'},
  {t:'Can’t cough, speak or breathe? Lean them forward, supporting their chest with one hand.',s:'sja_choke'},
  {t:'Give up to 5 sharp back blows between the shoulder blades, with the heel of your hand.',s:'sja_choke rc_fa'},
  {t:'Check the mouth after each blow.',s:'sja_choke'},
  {t:'Still choking? Stand behind them. Put your arms around their waist.',s:'sja_choke'},
  {t:'Make a fist. Place it between the belly button and the bottom of the chest.',s:'sja_choke'},
  {t:'Grasp your fist with the other hand. Pull sharply inwards and upwards — up to 5 times.',s:'sja_choke rc_fa'},
  {t:'Still blocked? Call 112 now.',s:'sja_choke rc_fa',log:'112 called'},
  {t:'Keep repeating 5 back blows, then 5 abdominal thrusts, until help arrives.',s:'sja_choke rc_fa'},
  {t:'They become unresponsive? Start CPR.',s:'sja_choke',go:'cpr'},
  {t:'Abdominal thrusts given? They must be checked by a doctor afterwards.',s:'rc_fa'}]},
 {k:'child',t:'Child 1+',steps:[
  {t:'Coughing well? Encourage them to keep coughing.',s:'hse_chk'},
  {t:'Can’t cough, cry or breathe? Stand behind them, leaning them forward.',s:'hse_chk'},
  {t:'Give up to 5 slaps to the back, between the shoulder blades.',s:'hse_chk'},
  {t:'Still choking? Clench your fist. Place it between the belly button and the ribs.',s:'hse_chk'},
  {t:'Grasp it with your other hand. Pull sharply inwards and upwards — up to 5 times.',s:'hse_chk'},
  {t:'Still choking? Call 112.',s:'hse_chk',log:'112 called'},
  {t:'Keep repeating 5 back slaps and 5 abdominal thrusts.',s:'hse_chk'},
  {t:'Becomes unresponsive? Start CPR.',s:'hse_chk',go:'cpr'},
  {t:'Object came out? Still get medical help — part of it may remain.',s:'hse_chk'}]},
 {k:'baby',t:'Baby <1',steps:[
  {t:'Lay the baby face down along your forearm, supporting the head and jaw.',s:'hse_chb'},
  {t:'Keep the baby’s head lower than its body.',s:'hse_chb'},
  {t:'Give up to 5 back slaps between the shoulders, with the heel of your hand.',s:'hse_chb'},
  {t:'Check the mouth. Remove the object only if you can see it.',s:'hse_chb'},
  {t:'Still choking? Turn the baby face up along your forearm.',s:'hse_chb'},
  {t:'Two fingers in the middle of the chest. Push sharply — up to 5 times.',s:'hse_chb'},
  {t:'Still can’t cough? Call 112 now.',s:'hse_chb',log:'112 called'},
  {t:'Keep repeating 5 back slaps and 5 chest thrusts.',s:'hse_chb'},
  {t:'Baby becomes unresponsive? Start baby CPR.',s:'hse_chb',go:'cpr'},
  {t:'Object came out? Still get medical help.',s:'hse_chb'}]}],
 dont:[['Don’t put your fingers in the mouth unless you can see the object.','hse_chk hse_chb rc_fa'],
  ['Don’t press on the ribs during abdominal thrusts.','hse_chk'],
  ['Don’t skip medical help afterwards — part of the object may remain.','hse_chk hse_chb']],
 call:[['Still choking after back blows and thrusts.','sja_choke hse_chk rc_fa'],
  ['Baby still can’t cough, or becomes unresponsive.','hse_chb'],
  ['Anyone who becomes unresponsive — and start CPR.','hse_chk sja_choke']],
 src:['hse_chk','hse_chb','rc_fa','sja_choke']},

{id:'bleeding',t:'Severe bleeding',n:'Severe bleeding',sub:'Stab · cut · tourniquet',ic:'blood',crit:1,
 kw:['bleeding','bleed','bleeds','blood','heavy bleeding','bleeding heavily','cut','cuts','stabbed','stab','stab wound','stabbing','knife','knifed','slashed','slash','glassed','wound','gash','laceration','haemorrhage','hemorrhage','artery','spurting','pumping blood','tourniquet','impaled','embedded','object stuck','shot','gunshot','bullet','amputated','amputation','severed','chest wound'],
 rec:[['Blood pumping or spurting from the wound.','sja_ltb'],
  ['Bleeding that won’t stop with firm pressure.','sja_ltb'],
  ['Blood soaking through dressing after dressing.','sja_ltb'],
  ['Pale, cold, clammy skin — signs of shock.','sja_shock']],
 steps:[
  {t:'Protect yourself — put on gloves if you have them.',s:'sja_bleed'},
  {t:'Call 112, or get someone to. Say where the wound is and how bad.',s:'sja_bleed rc_fa',log:'112 called'},
  {t:'Press firmly and directly on the wound with a dressing or clean cloth.',s:'sja_bleed rc_fa'},
  {t:'Haemostatic dressing? Put it on the wound and hold it tightly for at least 5 minutes.',s:'rc_fa sja_ltb',timer:{m:5,n:'Pressure',end:'5 minutes of pressure — now secure the dressing with a bandage.'}},
  {t:'Bandage firmly over the pad to keep the pressure on.',s:'sja_bleed sja_ltb'},
  {t:'Blood coming through? Remove the pad and press again with a new one.',s:'sja_bleed'},
  {t:'Arm or leg still pouring despite pressure? Apply a tourniquet if you have one.',s:'rc_fa sja_ltb'},
  {t:'Place it 5–7 cm above the wound — never over a joint.',s:'rc_fa'},
  {t:'Tighten it until the bleeding stops. Warn them it will hurt.',s:'rc_fa sja_ltb'},
  {t:'Note the time it went on. Never loosen or remove it.',s:'rc_fa sja_ltb',log:'Tourniquet on'},
  {t:'Object stuck in the wound? Leave it in. Press on both sides of it.',s:'sja_bleed'},
  {t:'Open chest wound? Leave it uncovered. Press only where it bleeds.',s:'rc_fa'},
  {t:'Lie them down. Raise and support their legs — unless a leg may be broken.',s:'sja_bleed sja_frac'},
  {t:'Keep them warm with a blanket or coat.',s:'sja_bleed'},
  {t:'Severed body part? Wrap in damp clean cloth, bag it, and put that bag in ice or ice water.',s:'rc_fa'}],
 dont:[['Don’t pull out an object stuck in a wound.','sja_bleed'],
  ['Don’t loosen or remove a tourniquet once it’s on.','rc_fa sja_ltb'],
  ['Don’t put a tourniquet over a joint.','rc_fa'],
  ['Don’t cover or seal an open chest wound.','rc_fa'],
  ['Don’t bandage so tightly that it cuts off the circulation.','sja_bleed'],
  ['Don’t let a severed part freeze.','rc_fa']],
 call:[['Any heavy or spurting bleeding — call straight away.','rc_fa sja_ltb'],
  ['Follow the ambulance controller’s instructions.','sja_ltb']],
 src:['rc_fa','sja_bleed','sja_ltb','sja_shock','sja_frac']},

{id:'recovery',t:'Unresponsive but breathing — recovery position',n:'Unresponsive',tb:'Unresponsive, breathing',sub:'Breathing · recovery position',ic:'recov',crit:1,
 kw:['unconscious','unresponsive','passed out','out cold','not responding','wont wake','wont wake up','cant wake','cant wake him','cant wake her','breathing but unconscious','unconscious but breathing','breathing but unresponsive','unresponsive but breathing','recovery position','fainted','faint','fainting','keeled over','slumped'],
 rec:[['Won’t wake or respond when you shake and shout.','sja_rec sja_cpr'],
  ['Breathing normally.','rc_fa'],
  ['Gasping, slow or noisy breathing is NOT normal — do CPR instead.','rc_bls rc_fa']],
 steps:[
  {t:'Call 112, or get someone to.',s:'sja_rec',log:'112 called'},
  {t:'Kneel beside them. Straighten their legs.',s:'sja_rec'},
  {t:'Put the arm nearest you out at a right angle, elbow bent, palm up.',s:'sja_rec'},
  {t:'Bring the far arm across their chest. Hold the back of that hand against their near cheek.',s:'sja_rec'},
  {t:'Pull the far knee up so that foot is flat on the ground.',s:'sja_rec'},
  {t:'Pull on the far leg to roll them towards you, onto their side.',s:'sja_rec'},
  {t:'Bend the top leg so the hip and knee are at right angles.',s:'sja_rec'},
  {t:'Tilt the head back and lift the chin to keep the airway open.',s:'sja_rec'},
  {t:'Keep checking their breathing until help arrives.',s:'sja_rec'},
  {t:'Stops breathing normally? Roll them onto their back and start CPR.',s:'rc_bls',go:'cpr'},
  {t:'Still on their side after 30 minutes? Roll them onto the other side.',s:'sja_rec',timer:{m:30,n:'Side',end:'30 minutes — roll them onto their other side.'}}],
 dont:[['Don’t use the recovery position if they’re only gasping — start CPR.','rc_fa'],
  ['After a fall or crash, don’t roll them unless the airway needs it — keep the head and spine in line.','rc_fa sja_rec'],
  ['Don’t give them anything to eat or drink.','sja_diab'],
  ['Don’t leave them — keep watching their breathing.','sja_rec']],
 call:[['Always — anyone who stays unresponsive needs an ambulance.','sja_rec']],
 src:['sja_rec','rc_fa','rc_bls','sja_cpr','sja_diab']},

{id:'chest',t:'Chest pain — heart attack',n:'Chest pain',sub:'Heart attack',ic:'heart',crit:1,
 kw:['chest pain','chest pains','pain in chest','pain in his chest','pain in her chest','pain in the chest','heart attack','heart','chest','angina','crushing pain','tight chest','chest tightness','pain down arm','pain down his arm','pain down her arm','jaw pain','gtn','aspirin','cardiac chest pain'],
 rec:[['Pressure, tightness or squeezing pain in the centre of the chest.','hse_heart'],
  ['Pain spreading to the arms, jaw, neck, back or stomach.','hse_heart'],
  ['Sweating, breathless, light-headed or feeling sick.','hse_heart'],
  ['Pale skin, bluish lips, a sense of impending doom.','sja_heart']],
 steps:[
  {t:'Call 112 now. Say you think it’s a heart attack.',s:'hse_heart sja_heart',log:'112 called'},
  {t:'Sit them on the floor, half-sitting, knees bent, head and shoulders supported.',s:'sja_heart rc_fa'},
  {t:'Keep them resting and calm. Reassure them.',s:'hse_heart rc_fa'},
  {t:'Not allergic to aspirin and aged 16+? Give one 300 mg aspirin, if they agree.',s:'hse_heart sja_heart rc_fa phecc_med'},
  {t:'Ask them to chew it slowly, then swallow.',s:'hse_heart sja_heart',log:'Aspirin 300 mg given'},
  {t:'Have their own angina spray or tablets? Help them take it.',s:'rc_fa sja_heart',log:'Own angina medication taken'},
  {t:'Stay with them. Keep watching their breathing and response.',s:'sja_heart'},
  {t:'They collapse and stop breathing normally? Start CPR and get an AED.',s:'hse_heart sja_heart',cpr:1}],
 dont:[['Don’t give aspirin if they’re allergic to it.','hse_heart rc_fa'],
  ['Don’t give aspirin to anyone under 16, or if they refuse.','sja_heart'],
  ['Don’t let them walk about — rest avoids straining the heart.','hse_heart']],
 call:[['Straight away for chest pain that could be a heart attack — ask for an ambulance.','hse_heart sja_heart']],
 src:['hse_heart','sja_heart','rc_fa','phecc_med']},

{id:'stroke',t:'Stroke — FAST',n:'Stroke',sub:'FAST test',ic:'stroke',crit:1,
 kw:['stroke','fast test','face drooping','face droop','drooping face','face dropped','droopy face','droop','drooping','slurred','slurred speech','slurring','cant speak','cant talk','arm weakness','weak arm','weak on one side','one side','numb','numbness','paralysed','paralyzed','tia','mini stroke','confused speech'],
 rec:[['Face: dropped on one side — can’t smile evenly; mouth or eye droops.','hse_stroke ihf_fast'],
  ['Arms: can’t lift both arms and keep them up.','hse_stroke ihf_fast'],
  ['Speech: slurred or muddled, or can’t talk despite seeming awake.','hse_stroke ihf_fast'],
  ['Also sudden: loss of vision, severe headache, dizziness, confusion, trouble swallowing.','hse_stroke']],
 steps:[
  {t:'Face: ask them to smile. Has the mouth or an eye drooped?',s:'ihf_fast hse_stroke'},
  {t:'Arms: ask them to raise both arms and keep them up.',s:'ihf_fast hse_stroke'},
  {t:'Speech: can they speak clearly and understand you?',s:'ihf_fast hse_stroke'},
  {t:'Time: any one of these signs? Call 112 now. Say “stroke”.',s:'ihf_fast hse_stroke sja_stroke',log:'Stroke signs seen (FAST)'},
  {t:'Keep them comfortable and supported. Reassure them.',s:'sja_stroke'},
  {t:'Give nothing to eat or drink — they may not be able to swallow.',s:'sja_stroke'},
  {t:'Stay with them and keep watching their response.',s:'sja_stroke'},
  {t:'Becomes unresponsive? Check breathing: recovery position, or CPR if not breathing normally.',s:'sja_stroke rc_bls',go:'recovery'}],
 dont:[['Don’t give food or drink.','sja_stroke'],
  ['Don’t wait for it to pass — symptoms that go away are still an emergency.','hse_stroke']],
 call:[['Immediately — any one FAST sign.','ihf_fast hse_stroke'],
  ['Even if the symptoms go away — a mini-stroke (TIA) still needs hospital.','hse_stroke']],
 src:['ihf_fast','hse_stroke','sja_stroke','rc_bls']},

{id:'seizure',t:'Seizure (fit)',n:'Seizure',sub:'Fit · convulsion',ic:'seiz',
 kw:['seizure','seizures','fit','fits','fitting','having a fit','convulsion','convulsions','convulsing','epilepsy','epileptic','shaking','jerking','seizing','tonic clonic','shaking all over'],
 rec:[['Sudden collapse or loss of response.','sja_seiz'],
  ['Stiff body, arched back, then jerking movements.','sja_seiz'],
  ['Noisy breathing, grey-blue lips, saliva — maybe blood from a bitten tongue.','sja_seiz'],
  ['May wet or soil themselves.','sja_seiz']],
 steps:[
  {t:'Stay calm. Note the time it started — start the seizure timer.',s:'epi_ie sja_seiz',timer:{m:5,up:1,n:'Seizure',end:'The seizure has lasted 5 minutes — call 112 now.',log:'Seizure started'}},
  {t:'Move hard or dangerous objects away from them.',s:'epi_ie sja_seiz'},
  {t:'Cushion their head with something soft.',s:'epi_ie sja_seiz'},
  {t:'Loosen any tight clothing around the neck.',s:'sja_seiz'},
  {t:'Don’t hold them down. Let the seizure run its course.',s:'epi_ie sja_seiz'},
  {t:'Jerking stopped? Open the airway and check their breathing.',s:'sja_seiz',log:'Seizure stopped'},
  {t:'Breathing? Turn them onto their side — the recovery position.',s:'epi_ie sja_seiz',go:'recovery'},
  {t:'Not breathing normally? Start CPR.',s:'sja_seiz rc_bls',go:'cpr'},
  {t:'Check for injuries.',s:'epi_ie'},
  {t:'Stay with them until they’re fully awake. Reassure them — they may be confused.',s:'epi_ie'}],
 dont:[['Never put anything in their mouth.','epi_ie sja_seiz'],
  ['Don’t restrain them.','epi_ie sja_seiz'],
  ['Don’t move them unless they’re in danger.','sja_seiz']],
 call:[['The seizure lasts more than 5 minutes.','epi_ie sja_seiz'],
  ['Another seizure follows, or seizures keep coming.','epi_ie sja_seiz'],
  ['It’s their first seizure, or you don’t know.','epi_ie sja_seiz'],
  ['They’re injured, pregnant, or not breathing normally afterwards.','epi_ie sja_seiz'],
  ['Still unresponsive 10 minutes after it stops.','sja_seiz'],
  ['You’re in any doubt.','epi_ie']],
 src:['epi_ie','sja_seiz','rc_bls']},

{id:'anaphylaxis',t:'Anaphylaxis — severe allergic reaction',n:'Anaphylaxis',sub:'Severe allergy · EpiPen',ic:'pen',crit:1,
 kw:['anaphylaxis','anaphylactic','anaphylactic shock','allergy','allergic','allergic reaction','epipen','epi pen','epipens','jext','adrenaline','adrenaline pen','auto injector','autoinjector','swollen lips','swollen tongue','swollen face','swollen throat','throat swelling','tongue swelling','throat closing','hives','nut allergy','nuts','peanut','peanuts','bee sting','wasp sting','stung','sting'],
 rec:[['Swelling of the throat, tongue, lips or face.','hse_ana sja_ana'],
  ['Difficulty breathing, wheezing or noisy breathing.','hse_ana sja_ana'],
  ['Feeling faint or collapsing, pale skin, racing heart.','hse_ana'],
  ['Often an itchy rash or raised hives.','sja_ana']],
 steps:[
  {t:'Use their adrenaline pen now — help them, or give it yourself.',s:'hse_ana sja_ana rc_fa',timer:{m:5,n:'Since pen',end:'5 minutes since the pen — no better, or worse? Give the second pen.',log:'Adrenaline pen given (their own)'}},
  {t:'Follow the instructions printed on the side of the pen.',s:'hse_ana'},
  {t:'Inject into the outer thigh.',s:'rc_fa'},
  {t:'Call 112. Say “anaphylaxis”.',s:'hse_ana sja_ana',log:'112 called'},
  {t:'Lie them down. If breathing is hard, let them sit up slowly.',s:'hse_ana rc_fa nhs_ana'},
  {t:'Pregnant? Lie her on her left side.',s:'hse_ana nhs_ana'},
  {t:'Stung? Remove the sting if it’s still in the skin.',s:'hse_ana'},
  {t:'No better, or worse, after 5 minutes? Give a second pen — ideally in the other thigh.',s:'hse_ana rc_fa',log:'Second adrenaline pen given'},
  {t:'Keep them lying or sitting. Don’t let them stand or walk.',s:'hse_ana nhs_ana'},
  {t:'Stops breathing normally? Start CPR.',s:'rc_bls',go:'cpr'}],
 dont:[['Don’t let them stand or walk, even if they feel better.','hse_ana nhs_ana'],
  ['Don’t delay the pen — give it straight away.','sja_ana rc_fa']],
 call:[['Always — even if the pen works. Say “anaphylaxis”.','hse_ana sja_ana']],
 src:['hse_ana','rc_fa','sja_ana','nhs_ana','phecc_med','rc_bls']},

{id:'opioid',t:'Opioid overdose',n:'Opioid overdose',sub:'Heroin · naloxone',ic:'syringe',crit:1,
 kw:['overdose','overdosed','overdosing','od','oded','heroin','gear','smack','opioid','opioids','opiate','opiates','methadone','fentanyl','nitazene','nitazenes','morphine','oxycodone','naloxone','nyxoid','prenoxad','ventizolve','pinpoint pupils','small pupils','needle','syringe','injecting'],
 rec:[['Very drowsy, or won’t wake up.','rc_fa drugs_ie'],
  ['Slow, irregular or no breathing.','rc_fa sja_od'],
  ['Pinpoint (very small) pupils.','rc_fa sja_od'],
  ['Opioids include heroin, methadone and morphine.','garda_nal']],
 steps:[
  {t:'Shout and shake them. Check for normal breathing.',s:'drugs_ie sja_od'},
  {t:'Call 112 now. Say it may be an overdose.',s:'drugs_ie sja_od rc_fa',log:'112 called'},
  {t:'Not breathing normally? Start CPR.',s:'rc_fa drugs_ie',cpr:1},
  {t:'Breathing? Put them in the recovery position.',s:'drugs_ie',go:'recovery'},
  {t:'Have naloxone and trained to use it? Give it now.',s:'rc_fa drugs_ie',log:'Naloxone given'},
  {t:'Nasal spray: spray into one nostril. Any further dose goes in the other nostril.',s:'drugs_ie'},
  {t:'Injection kit: inject into the outer thigh.',s:'drugs_ie'},
  {t:'No response? Give further doses as the pack instructs.',s:'rc_fa drugs_ie'},
  {t:'Stay with them until the ambulance arrives.',s:'drugs_ie rc_fa'},
  {t:'Keep watching — naloxone wears off, and the overdose can come back.',s:'drugs_ie'}],
 dont:[['Don’t leave them alone, even if they wake up.','drugs_ie rc_fa'],
  ['Don’t try to make them vomit.','sja_od'],
  ['Don’t give naloxone unless you’re trained to.','rc_fa']],
 call:[['Always — straight away.','drugs_ie'],
  ['Tell the call-taker you suspect an overdose.','sja_od']],
 src:['rc_fa','drugs_ie','garda_nal','sja_od']},

{id:'hypo',t:'Low blood sugar — diabetic hypo',n:'Low blood sugar',sub:'Diabetic hypo',ic:'sweet',
 kw:['low blood sugar','low sugar','blood sugar','sugar','hypo','having a hypo','hypoglycaemia','hypoglycemia','hypoglycaemic','diabetic','diabetes','diabetic emergency','insulin','glucose','glucose gel','dextrose','sweets','sugar low','shaky and sweaty'],
 rec:[['Sweating, pale, cold and clammy.','hse_hypo sja_diab'],
  ['Shaky or trembling, hungry, weak or faint.','hse_hypo sja_diab'],
  ['Confused, irrational, anxious or irritable.','hse_hypo sja_diab'],
  ['Blurred sight, can’t concentrate.','hse_hypo'],
  ['A smell of alcohol can hide low blood sugar.','sja_alc']],
 steps:[
  {t:'Awake and able to swallow? Sit them down.',s:'sja_diab rc_fa'},
  {t:'Give fast sugar: 200 ml fruit juice, or a glass of non-diet fizzy drink.',s:'hse_hypo'},
  {t:'Or: 5 glucose tablets, 3–4 jelly babies, or their own glucose gel.',s:'hse_hypo sja_diab',log:'Sugar given'},
  {t:'Not improving quickly? Call 112.',s:'sja_diab',log:'112 called'},
  {t:'Wait 10 minutes. Not improving? Give fast sugar again.',s:'hse_hypo rc_fa',timer:{m:10,n:'Sugar',end:'10 minutes — not improving? Give fast sugar again.'}},
  {t:'Feeling better? Give a snack, like a piece of fruit or some bread.',s:'hse_hypo rc_fa sja_diab'},
  {t:'Drowsy or unresponsive? Give nothing by mouth. Recovery position if breathing.',s:'rc_fa sja_diab',go:'recovery'},
  {t:'Not breathing normally? Start CPR.',s:'sja_diab',go:'cpr'}],
 dont:[['Never give food or drink to someone drowsy, unresponsive or unable to swallow.','rc_fa sja_diab'],
  ['Don’t use diet or sugar-free drinks.','hse_hypo'],
  ['Don’t assume they’re drunk — a smell of alcohol can hide a hypo.','sja_alc']],
 call:[['Unresponsive, very drowsy, or can’t swallow.','hse_hypo rc_fa'],
  ['Not improving quickly after sugar.','sja_diab']],
 src:['hse_hypo','rc_fa','sja_diab','sja_alc']},

{id:'asthma',t:'Asthma attack',n:'Asthma attack',sub:'Reliever inhaler',ic:'inhaler',
 kw:['asthma','asthma attack','asthmatic','inhaler','puffer','blue inhaler','reliever','ventolin','salbutamol','wheeze','wheezing','wheezy','cant breathe','cant catch breath','cant catch his breath','cant catch her breath','breathless','short of breath','shortness of breath','struggling to breathe','difficulty breathing','tight chest'],
 rec:[['Coughing, wheezing, short of breath, tight chest.','hse_asthma sja_asthma'],
  ['Breathing faster; can’t catch their breath.','hse_asthma'],
  ['Can only speak in short sentences, or whispers.','sja_asthma'],
  ['Severe: grey-blue lips, exhaustion.','sja_asthma']],
 steps:[
  {t:'Sit them upright. Don’t let them lie down.',s:'hse_asthma'},
  {t:'Keep them calm. Slow, steady breaths.',s:'hse_asthma sja_asthma'},
  {t:'Help them use their own reliever inhaler (usually blue) — with a spacer if they have one.',s:'hse_asthma sja_asthma rc_fa'},
  {t:'1 puff every 30 to 60 seconds, up to 10 puffs.',s:'hse_asthma sja_asthma',log:'Own reliever inhaler used'},
  {t:'No better after 10 puffs? Call 112.',s:'hse_asthma',log:'112 called',timer:{m:10,n:'Asthma',end:'10 minutes — no better? Repeat: 1 puff every 30–60 seconds, up to 10.'}},
  {t:'Still no better after 10 minutes? Repeat: 1 puff every 30–60 seconds, up to 10.',s:'hse_asthma sja_asthma'},
  {t:'Ambulance still not there? Call 112 again.',s:'hse_asthma'},
  {t:'They have an asthma action plan? Follow it.',s:'hse_asthma sja_asthma'},
  {t:'Stops breathing normally? Start CPR.',s:'sja_asthma rc_bls',go:'cpr'}],
 dont:[['Don’t let them lie down.','hse_asthma'],
  ['Don’t leave them — keep watching their breathing.','sja_asthma']],
 call:[['No better after 10 puffs.','hse_asthma'],
  ['Severe, getting worse, exhausted — or it’s their first attack.','sja_asthma'],
  ['Ambulance not there and still struggling — call again.','hse_asthma']],
 src:['hse_asthma','sja_asthma','rc_fa','rc_bls']},

{id:'burns',t:'Burns & scalds',n:'Burns & scalds',sub:'Heat · chemical',ic:'flame',
 kw:['burn','burns','burned','burnt','scald','scalds','scalded','fire','flames','on fire','hot water','boiling water','boiling','hot oil','steam','chemical burn','acid','acid attack','caustic'],
 rec:[['Burned by flames, hot liquid, steam, chemicals or electricity.','hse_burns'],
  ['Serious: bigger than a €2 coin, or on the face, hands, feet or genitals.','hse_burns'],
  ['Serious: white or chalky-looking skin.','hse_burns'],
  ['Airway danger: burns above the neck, or any trouble breathing.','hse_burns']],
 steps:[
  {t:'Stop the burning: move them away from the heat. Smother flames with a blanket.',s:'hse_burns'},
  {t:'Cool the burn under cool running water for 20 minutes.',s:'hse_burns sja_burn',timer:{m:20,n:'Cooling',end:'20 minutes of cooling done.',log:'Burn cooling started'}},
  {t:'Serious burn? Call 112 — keep cooling while you wait.',s:'sja_burn hse_burns',log:'112 called'},
  {t:'Remove jewellery, watches and clothing near the burn — unless stuck to it.',s:'hse_burns sja_burn'},
  {t:'Clothing stuck to the burn? Leave it — cut around it.',s:'hse_burns'},
  {t:'Keep the rest of them warm with layers or a blanket.',s:'hse_burns sja_burn'},
  {t:'After cooling, cover loosely with cling film, laid on lengthways.',s:'hse_burns sja_burn'},
  {t:'Hand or foot? A clean plastic bag can be used instead.',s:'sja_burn'},
  {t:'Chemical burn: wear gloves. Brush off any powder, then rinse with running water.',s:'sja_chem hse_burns'},
  {t:'Take off clothing that has the chemical on it.',s:'sja_chem hse_burns'},
  {t:'Chemical advice: Poisons Centre 01 809 2166 (8am–10pm).',s:'hse_burns npic'}],
 dont:[['Don’t use ice, iced water, creams, butter, ointments or sprays.','hse_burns'],
  ['Don’t use plasters or sticky dressings.','hse_burns'],
  ['Don’t pull off clothing stuck to the burn.','hse_burns sja_burn'],
  ['Don’t let them get too cold — especially babies and older people.','sja_burn'],
  ['Don’t try to neutralise a chemical.','sja_chem']],
 call:[['Burn above the neck, or on the hands, elbows, knees, ankles, feet or groin.','hse_burns'],
  ['Any trouble breathing, or they’re unresponsive.','hse_burns']],
 er:[['Bigger than a €2 coin.','hse_burns'],
  ['On the face, hands or genitals.','hse_burns'],
  ['White or chalky skin.','hse_burns'],
  ['Signs of breathing in smoke or heat.','hse_burns'],
  ['Any chemical or electrical burn.','hse_burns']],
 src:['hse_burns','sja_burn','sja_chem','npic']},

{id:'head',t:'Head injury',n:'Head injury',sub:'Knocked out · concussion',ic:'head',
 kw:['head injury','head','hit head','hit his head','hit her head','hit their head','banged head','banged his head','banged her head','bang to the head','blow to the head','knocked out','concussion','concussed','skull','head wound','fell and hit','kicked in the head','punched in the head','headbutt','headbutted','cut head','bleeding from ear','bleeding from the ear','fluid from nose'],
 rec:[['Was knocked out, even briefly.','hse_head'],
  ['Headache, dizziness, feeling sick or vomiting.','sja_head hse_head'],
  ['Confused, or can’t remember what happened.','sja_head'],
  ['Scalp wound or bleeding.','sja_head']],
 steps:[
  {t:'Unresponsive after a fall or blow? Don’t move them — a neck injury is possible.',s:'sja_head sja_spine',go:'spinal'},
  {t:'Open the airway and check breathing. Be ready to start CPR.',s:'sja_head',go:'cpr'},
  {t:'Call 112 for any danger sign — see the “Call 112” tab.',s:'hse_head',log:'112 called'},
  {t:'Awake and alert? Sit them down.',s:'sja_head'},
  {t:'Hold something cold on it — an ice pack or frozen peas in a tea towel.',s:'sja_head hse_head'},
  {t:'Bleeding scalp? Press on it firmly with a clean pad.',s:'sja_head'},
  {t:'Keep checking: are they alert, answering, making sense?',s:'sja_head'},
  {t:'Getting drowsy, confused or worse? Call 112.',s:'sja_head hse_head'},
  {t:'Make sure a responsible adult stays with them for the first 24 hours.',s:'hse_head'}],
 dont:[['Don’t move them if a neck or spine injury is possible — unless they’re in danger.','sja_head'],
  ['Don’t assume they’re just drunk — alcohol or drugs at the time of injury means hospital.','hse_head sja_alc'],
  ['Don’t give aspirin or ibuprofen after a head injury.','hse_head'],
  ['Don’t leave them alone for the first 24 hours.','hse_head']],
 call:[['Knocked out and hasn’t woken up.','hse_head'],
  ['Can’t stay awake or keep their eyes open.','hse_head'],
  ['Has a fit (seizure).','hse_head'],
  ['Problems with their vision.','hse_head'],
  ['Clear fluid from the ears or nose, bleeding from the ears, or bruising behind the ears.','hse_head'],
  ['Numbness or weakness in part of the body.','hse_head'],
  ['Problems walking, balancing, understanding, speaking or writing.','hse_head']],
 er:[['Was knocked out but woke up.','hse_head'],
  ['Has vomited since the injury.','hse_head'],
  ['Headache that painkillers don’t ease.','hse_head'],
  ['Behaviour changes or memory problems.','hse_head'],
  ['Was drunk or on drugs when injured.','hse_head'],
  ['Takes blood thinners or has a clotting disorder.','hse_head'],
  ['Has had brain surgery.','hse_head']],
 src:['hse_head','sja_head','sja_spine','sja_alc']},

{id:'spinal',t:'Suspected spinal injury',n:'Spinal injury',sub:'Neck or back',ic:'spine',
 kw:['spine','spinal','spinal injury','neck','neck injury','neck pain','back injury','back pain','broken neck','broken back','hurt his back','hurt her back','fall from height','fell from height','fell from a height','fell off a ladder','ladder','diving','dived','shallow water','car crash','crash','rtc','road traffic collision','motorbike','came off bike','came off his bike','hit by a car','knocked down','tingling','pins and needles','cant move legs','cant feel legs','cant move his legs','cant feel his legs'],
 rec:[['Fall from a height, diving into shallow water, or a crash.','sja_spine'],
  ['Neck or back pain.','sja_spine'],
  ['Tingling, burning or loss of feeling in the arms or legs.','sja_spine'],
  ['Weak or no movement in the limbs; loss of bladder or bowel control.','sja_spine']],
 steps:[
  {t:'Call 112, or get someone to.',s:'sja_spine',log:'112 called'},
  {t:'Awake? Tell them to keep still, with the neck in a comfortable position.',s:'rc_fa sja_spine'},
  {t:'Kneel behind their head. Rest your elbows on the ground or your knees.',s:'sja_spine'},
  {t:'Hold the head steady, in line with the neck and spine.',s:'sja_spine rc_fa'},
  {t:'Keep holding it. Watch their breathing and response.',s:'sja_spine'},
  {t:'Unresponsive? Open the airway with a jaw thrust — don’t tilt the head back.',s:'sja_spine rc_fa'},
  {t:'The airway comes first — it matters more than keeping the neck still.',s:'rc_fa'},
  {t:'Not breathing normally? Start CPR and get an AED.',s:'sja_spine',go:'cpr'},
  {t:'Must turn them, e.g. vomiting? Get help. Roll them as one unit, head in line.',s:'rc_fa sja_rec'}],
 dont:[['Don’t move them unless they’re in danger.','sja_head sja_spine'],
  ['Don’t tilt the head back to open the airway — use a jaw thrust.','sja_spine rc_fa'],
  ['Don’t put them in the recovery position unless the airway is at risk.','rc_fa sja_rec']],
 call:[['Always, for a suspected neck or back injury.','sja_spine']],
 src:['sja_spine','rc_fa','sja_rec','sja_head']},

{id:'fracture',t:'Broken bones',n:'Broken bones',sub:'Fracture',ic:'bone',
 kw:['broken bone','broken bones','broken','fracture','fractured','fractures','broke','broke his','broke her','break','broken arm','broken leg','broken wrist','broken ankle','broken hip','broken collarbone','bone sticking out','bone','deformed','twisted ankle','sprain','sprained','cant put weight on'],
 rec:[['Pain, swelling and bruising.','sja_frac'],
  ['Can’t move it, or moving it hurts.','sja_frac'],
  ['Odd shape or angle.','sja_frac'],
  ['Bone may be poking through the skin (open fracture).','sja_frac']],
 steps:[
  {t:'Tell them to keep still.',s:'sja_frac'},
  {t:'Support the injured part — hold the joints above and below it.',s:'sja_frac'},
  {t:'Pad around it to keep it still — cushions, rolled clothing, a sling.',s:'sja_frac'},
  {t:'Open wound? Cover it with a clean dressing or non-fluffy cloth.',s:'sja_frac'},
  {t:'Press around the wound — never on the bone.',s:'sja_frac'},
  {t:'Check for numbness, tingling or coldness beyond the injury.',s:'sja_frac'},
  {t:'Call 112 for: open fractures, long bones like the thigh, the pelvis or the spine.',s:'sja_frac',log:'112 called'},
  {t:'Watch for shock: pale, cold, clammy. Keep them warm.',s:'sja_frac sja_shock',go:'shock'}],
 dont:[['Don’t move the injured part unless you must.','sja_frac'],
  ['Don’t press on bone that’s poking out.','sja_frac'],
  ['Don’t raise the legs if either may be broken.','sja_frac'],
  ['Don’t give them anything to eat or drink.','sja_frac']],
 call:[['Open fracture — a wound over it, or bone through the skin.','sja_frac'],
  ['Suspected broken thigh or other long bone, pelvis or spine.','sja_frac']],
 src:['sja_frac','sja_shock']},

{id:'hypothermia',t:'Hypothermia',n:'Hypothermia',sub:'Very cold',ic:'snow',
 kw:['hypothermia','hypothermic','cold','very cold','freezing','frozen','freezing cold','shivering','exposure','sleeping rough','rough sleeper','found outside','out all night','wet and cold','cold and wet'],
 rec:[['Shivering; pale, cold, dry skin; lips may be blue.','hse_cold sja_cold'],
  ['Slurred speech, slow breathing.','hse_cold'],
  ['Tired, confused or behaving oddly.','hse_cold sja_cold'],
  ['Body temperature below 35 °C. Older people are at higher risk.','hse_cold sja_cold']],
 steps:[
  {t:'Call 112 — any sign of hypothermia needs help.',s:'hse_cold sja_cold',log:'112 called'},
  {t:'Get them out of the wind — into shelter or indoors.',s:'sja_cold rc_fa'},
  {t:'Gently remove wet clothing. Replace it with dry clothes.',s:'rc_fa sja_cold'},
  {t:'Cover them with dry blankets or coats. Cover the head too.',s:'sja_cold rc_fa'},
  {t:'Put insulation between them and the cold ground.',s:'rc_fa sja_cold'},
  {t:'Fully alert? Give warm drinks and high-energy food, like chocolate.',s:'sja_cold'},
  {t:'Indoors? Warm the room to about 25 °C.',s:'sja_cold'},
  {t:'Stay with them. Keep watching their breathing and response.',s:'sja_cold'},
  {t:'Not breathing normally? Start CPR.',s:'rc_bls',go:'cpr'}],
 dont:[['Don’t give alcohol.','sja_cold'],
  ['Don’t apply direct heat to warm them.','sja_cold'],
  ['Don’t give food or drink unless they’re fully alert.','sja_cold'],
  ['Don’t leave them alone.','sja_cold']],
 call:[['Any signs of hypothermia.','hse_cold']],
 src:['hse_cold','sja_cold','rc_fa','rc_bls']},

{id:'heat',t:'Heat exhaustion / heatstroke',n:'Heat illness',sub:'Heat exhaustion · heatstroke',ic:'sun',
 kw:['heat exhaustion','heatstroke','heat stroke','sunstroke','heat','hot','too hot','overheated','overheating','overheat','dehydrated','dehydration','heatwave','hot weather','high temperature'],
 rec:[['Heat exhaustion: headache, dizziness, feeling sick, heavy sweating, pale clammy skin, cramps.','hse_heat'],
  ['Heatstroke: hot skin but not sweating; temperature 40 °C or higher.','hse_heat sja_hs'],
  ['Heatstroke: confused, agitated, fitting or unresponsive.','hse_heat rc_fa']],
 steps:[
  {t:'Move them to a cool, shaded place.',s:'hse_heat sja_hs rc_fa'},
  {t:'Heatstroke signs — hot, not sweating, confused? Call 112 now.',s:'hse_heat sja_hs',log:'112 called'},
  {t:'Remove unnecessary clothing.',s:'hse_heat rc_fa'},
  {t:'Cool the skin: spray or sponge with cool water, and fan them.',s:'hse_heat sja_hs'},
  {t:'Cold packs? Put them in the armpits and around the neck.',s:'sja_hs'},
  {t:'Heatstroke: cool fast with whatever you have — cold water on the body, a wet sheet, fanning.',s:'rc_fa sja_hs'},
  {t:'Alert? Give plenty of water, or a sports or rehydration drink.',s:'hse_heat'},
  {t:'No better after 30 minutes of cooling? Call 112.',s:'hse_heat',timer:{m:30,n:'Cooling',end:'30 minutes — no better? Call 112.'}},
  {t:'Cool first, transport second. If they heat up again, cool them again.',s:'rc_fa sja_hs'},
  {t:'Unresponsive? Recovery position if breathing; CPR if not.',s:'hse_heat sja_hs',go:'recovery'}],
 dont:[['Don’t wait for transport before cooling — cool first.','rc_fa'],
  ['Don’t stop checking their temperature, breathing and response.','sja_hs']],
 call:[['Heatstroke signs: hot dry skin, 40 °C or higher, confused, fitting or unresponsive.','hse_heat sja_hs rc_fa'],
  ['Heat exhaustion that isn’t better after 30 minutes of cooling.','hse_heat']],
 src:['hse_heat','sja_hs','rc_fa']},

{id:'drowning',t:'Drowning',n:'Drowning',sub:'Water rescue',ic:'water',
 kw:['drowning','drowned','drown','drowns','in the water','water','pulled from the water','pulled out of the water','river','sea','canal','liffey','lake','pool','swimming pool','swimming','submerged','went under','in difficulty','coast guard','coastguard','fell in','near drowning'],
 rec:[['In difficulty in the water, or pulled out of it.','ircg sja_drown'],
  ['Unresponsive and not breathing normally — CPR starts with 5 rescue breaths.','rc_fa sja_drown'],
  ['May vomit water during CPR.','sja_drown']],
 steps:[
  {t:'Don’t go into the water unless trained — you could drown too.',s:'rc_fa sja_drown'},
  {t:'Someone in difficulty? Call 112 and ask for the Coast Guard.',s:'ircg',log:'112 called — Coast Guard'},
  {t:'Stay on land. Reach them with a ring buoy, rescue tube or other flotation aid.',s:'rc_fa'},
  {t:'Once out: check for a response and normal breathing.',s:'sja_drown rc_fa'},
  {t:'Not breathing normally? Call 112 for an ambulance. Send for an AED.',s:'sja_drown',log:'112 called — ambulance'},
  {t:'Open the airway. Give 5 rescue breaths first.',s:'rc_fa sja_drown'},
  {t:'Then CPR: 30 compressions, 2 breaths.',s:'sja_drown rc_fa',cpr:1},
  {t:'AED here? Dry the chest quickly, then stick on the pads.',s:'rc_fa'},
  {t:'Vomiting? Roll them onto their side to clear it, then carry on.',s:'sja_drown'},
  {t:'Breathing? Recovery position. Remove wet clothes and keep them warm.',s:'sja_drown',go:'recovery'},
  {t:'Even if they seem well, they may need a hospital check.',s:'sja_drown'}],
 dont:[['Don’t enter the water unless you’re trained in water rescue.','rc_fa'],
  ['Don’t put yourself in danger.','sja_drown']],
 call:[['Someone in difficulty in the water: 112 — ask for the Coast Guard.','ircg'],
  ['Anyone pulled out unresponsive or unwell: 112 for an ambulance.','sja_drown']],
 src:['rc_fa','sja_drown','ircg']},

{id:'electric',t:'Electric shock',n:'Electric shock',sub:'Power lines · appliances',ic:'bolt',
 kw:['electric shock','electric','electrocuted','electrocution','electricity','live wire','live wires','power line','power lines','fallen wire','fallen wires','overhead wires','esb','socket','cable','pylon','substation'],
 rec:[['Contact with electricity: an appliance, cable, socket or power line.','sja_elec esb'],
  ['May have burns.','sja_elec'],
  ['May be unresponsive or not breathing.','sja_elec']],
 steps:[
  {t:'Don’t touch them while they’re still in contact with the electricity.',s:'sja_elec'},
  {t:'Turn off the source of electricity if you can.',s:'sja_elec'},
  {t:'Can’t turn it off? Stand on something dry and insulating — a plastic mat or wooden box.',s:'sja_elec'},
  {t:'Push their limb away from the source with a broom handle or wooden pole.',s:'sja_elec'},
  {t:'Fallen or overhead power lines? Keep away — assume they’re live.',s:'esb'},
  {t:'Call 112. For damaged power lines, also call ESB Networks: 1800 372 999.',s:'sja_elec esb',log:'112 called'},
  {t:'Once it’s safe: check for a response and normal breathing.',s:'sja_elec'},
  {t:'Not breathing normally? Start CPR and get an AED.',s:'sja_elec rc_bls',go:'cpr'},
  {t:'Treat any burns: cool under cool running water for 20 minutes.',s:'hse_burns sja_elec',go:'burns'}],
 dont:[['Don’t touch them until the current is off or they’re clear of it.','sja_elec'],
  ['Never approach or handle fallen power lines.','esb']],
 call:[['Always, after an electric shock.','sja_elec'],
  ['Damaged power lines: ESB Networks 1800 372 999 (24/7).','esb']],
 er:[['Any electrical burn.','hse_burns']],
 src:['sja_elec','esb','hse_burns','rc_bls']},

{id:'poisoning',t:'Poisoning — drugs, alcohol, chemicals',n:'Poisoning',sub:'Drugs · alcohol · chemicals',ic:'bottle',
 kw:['poison','poisoning','poisoned','poisonous','swallowed','drank','ingested','bleach','tablets','pills','took tablets','took pills','paracetamol','drunk','very drunk','alcohol','alcohol poisoning','intoxicated','spiked','drink spiked','cocaine','coke','ecstasy','mdma','ketamine','ket','drugs','took drugs','weed','cannabis','edibles','fumes','gas','carbon monoxide','chemical','chemicals','overdose','od','berries','mushrooms','weedkiller'],
 rec:[['Drowsy, confused, vomiting, or unresponsive.','sja_od sja_alc'],
  ['Alcohol: strong smell, slurred speech, poor coordination, flushed face.','sja_alc'],
  ['Stimulants: agitated, sweating, shaking, hallucinating, large pupils.','sja_od'],
  ['A smell of alcohol can hide a head injury, stroke or low blood sugar.','sja_alc']],
 steps:[
  {t:'Fumes or gas? Get them into fresh air — only if it’s safe for you.',s:'npic'},
  {t:'Ask what they took, how much, and when.',s:'sja_pois sja_od'},
  {t:'Call 112. Tell them what was taken.',s:'sja_pois sja_od npic',log:'112 called'},
  {t:'Keep the packet, bottle or container for the ambulance crew.',s:'sja_pois npic'},
  {t:'Unresponsive but breathing? Recovery position.',s:'sja_alc',go:'recovery'},
  {t:'Not breathing normally? Start CPR.',s:'sja_pois npic',go:'cpr'},
  {t:'On the skin? Remove the clothing. Rinse with running water for at least 15 minutes.',s:'npic',timer:{m:15,n:'Rinsing',end:'15 minutes of rinsing done.'}},
  {t:'In the eye? Rinse it with running water — see Eye injury.',s:'npic sja_eye',go:'eye'},
  {t:'They vomit? Keep a sample for the ambulance crew.',s:'sja_pois sja_od'},
  {t:'Stay with them. Keep them warm and keep checking their breathing.',s:'sja_alc sja_od'},
  {t:'Not an emergency but unsure? Poisons Centre: 01 809 2166 (8am–10pm).',s:'npic'}],
 dont:[['Don’t make them vomit.','npic sja_pois'],
  ['Never give salt water.','npic'],
  ['Don’t give food or drink unless the Poisons Centre or a doctor says so.','npic sja_pois'],
  ['Don’t assume it’s just drink — check for head injury, stroke or low blood sugar.','sja_alc']],
 call:[['Unresponsive, very drowsy, or breathing problems.','npic sja_alc'],
  ['Any suspected drug poisoning or overdose.','sja_od'],
  ['Unsure how serious it is, or a head injury is possible.','sja_alc'],
  ['For advice: Poisons Centre 01 809 2166, daily 8am–10pm.','npic']],
 src:['npic','sja_pois','sja_od','sja_alc','sja_eye']},

{id:'shock',t:'Shock — after blood loss',n:'Shock',sub:'After blood loss',ic:'drop',
 kw:['shock','in shock','clammy','cold and clammy','pale and clammy','pale','grey','going grey','blood loss','lost blood','lost a lot of blood','weak pulse','fast pulse'],
 rec:[['Pale, cold, clammy skin; sweating.','sja_shock'],
  ['Fast, shallow breathing; fast, weak pulse.','sja_shock'],
  ['Grey-blue skin, especially inside the lips.','sja_shock'],
  ['Restless, aggressive, yawning or gasping — may collapse.','sja_shock'],
  ['Causes include heavy bleeding (inside or out), burns, heart attack, severe allergy.','sja_shock']],
 steps:[
  {t:'Treat the cause — stop any bleeding first.',s:'sja_shock',go:'bleeding'},
  {t:'Call 112.',s:'sja_shock',log:'112 called'},
  {t:'Lie them down on a rug, blanket or coat.',s:'sja_bleed sja_shock'},
  {t:'Raise their legs and rest them on a chair, so they’re above the heart.',s:'sja_shock sja_bleed'},
  {t:'Loosen tight clothing at the neck, chest and waist.',s:'sja_shock'},
  {t:'Cover them with a blanket or coat to keep them warm.',s:'sja_shock'},
  {t:'Reassure them — fear and pain make shock worse.',s:'sja_shock'},
  {t:'Keep checking breathing and response. Be ready to start CPR.',s:'sja_shock',go:'cpr'}],
 dont:[['Don’t raise the legs if a leg may be broken.','sja_frac'],
  ['Don’t give them anything to eat or drink.','sja_frac'],
  ['Don’t leave them — shock is life-threatening.','sja_shock']],
 call:[['Always — shock is life-threatening.','sja_shock']],
 src:['sja_shock','sja_bleed','sja_frac']},

{id:'eye',t:'Eye injury / chemical in the eye',n:'Eye injury',sub:'Chemical in eye',ic:'eye',
 kw:['eye','eyes','eye injury','in the eye','in his eye','in her eye','in my eye','chemical in eye','chemical in the eye','chemical in his eye','acid in eye','acid in the eye','bleach in eye','bleach in the eye','splash in eye','something in eye','something in the eye','something in his eye','grit','dust','eyelash','poked in the eye','glass in eye','cant see','blinded'],
 rec:[['Chemical, powder or liquid splashed in the eye.','sja_eye'],
  ['Grit, dust or an eyelash on the eye.','sja_eye'],
  ['Object stuck in the eye, or a wound to the eye.','sja_eye']],
 steps:[
  {t:'Chemical in the eye? Rinse it now with clean running water.',s:'npic sja_eye',timer:{m:20,n:'Rinsing',end:'20 minutes of rinsing done.',log:'Eye rinsing started'}},
  {t:'Keep rinsing for at least 20 minutes.',s:'sja_eye npic'},
  {t:'Wash both the inside and the outside of the eyelids.',s:'sja_eye'},
  {t:'Don’t let the rinse water splash into the other eye.',s:'sja_eye'},
  {t:'Call 112 for any chemical splash.',s:'sja_eye',log:'112 called'},
  {t:'Keep the chemical’s container for the ambulance crew.',s:'npic sja_chem'},
  {t:'Grit or dust? Sit them facing the light. Stop them rubbing it.',s:'sja_eye'},
  {t:'Pour clean water over the eye from the inner corner.',s:'sja_eye'},
  {t:'Object stuck in the eye, or a wound? Don’t touch it. Call 112.',s:'sja_eye'}],
 dont:[['Don’t rub the eye.','sja_eye'],
  ['Don’t put anything in the eye except water.','npic'],
  ['Don’t try to remove an object stuck in the eye.','sja_eye'],
  ['Don’t let rinse water splash the other eye.','sja_eye']],
 call:[['Chemical splash, object stuck in the eye, or a wound to the eye.','sja_eye'],
  ['For advice: Poisons Centre 01 809 2166 (8am–10pm).','npic']],
 src:['sja_eye','npic','sja_chem']}
];

/* ---------- icons (24×24 line art, currentColor) ---------- */
const HEART='<path d="M12 20.3S4.5 15.7 4.5 10.1A4.2 4.2 0 0 1 12 7.5a4.2 4.2 0 0 1 7.5 2.6c0 5.6-7.5 10.2-7.5 10.2z"/>';
const IC={
 cpr:HEART+'<path d="M2.5 12.5h5l1.6-2.6 2.3 5.2 2.1-4.3 1.1 1.7h6.9"/>',
 choke:'<circle cx="12" cy="5.8" r="3.3"/><path d="M4.5 21.5v-3.6a5.4 5.4 0 0 1 5.4-5.4h4.2a5.4 5.4 0 0 1 5.4 5.4v3.6"/><path d="M8 18.2l3.2-7.4M16 18.2l-3.2-7.4"/>',
 blood:'<path d="M12 2.8s6.6 7.1 6.6 11.7a6.6 6.6 0 0 1-13.2 0C5.4 9.9 12 2.8 12 2.8z"/><path d="M8.9 14.9a3.2 3.2 0 0 0 3.1 3.2"/>',
 recov:'<circle cx="4.8" cy="10" r="2.3"/><path d="M7.4 11.3l7.6 1.3M15 12.6l3.4-3.4 2.9 2.7M15 12.6l6 2.8M9.8 11.7l-1.3 4.4M2 18.5h20"/>',
 heart:HEART+'<path d="M13 8.6l-2.4 4.2h3.2L11.6 17"/>',
 stroke:'<circle cx="12" cy="12" r="9.2"/><path d="M8.8 9.4v1.2M15.2 9.4v1.2"/><path d="M7.8 14.6c1.4 1 3.3 1.2 5.2.8l3.2 1.8"/>',
 seiz:'<circle cx="12" cy="8.2" r="4.2"/><path d="M5.8 21.5c.5-3.9 3-6.2 6.2-6.2s5.7 2.3 6.2 6.2"/><path d="M3.2 4.8l1.6 1.6-1.6 1.6 1.6 1.6-1.6 1.6M20.8 4.8l-1.6 1.6 1.6 1.6-1.6 1.6 1.6 1.6"/>',
 pen:'<g transform="rotate(45 12 12)"><rect x="9.3" y="2.8" width="5.4" height="13.6" rx="1.6"/><path d="M9.3 7h5.4M12 16.4v4.8"/></g>',
 syringe:'<g transform="rotate(45 12 12)"><rect x="9.6" y="7" width="4.8" height="9.6" rx=".9"/><path d="M12 16.6v5M8.6 7h6.8M12 7V3.2M9.8 3.2h4.4M9.6 10.2h2.2M9.6 13.2h2.2"/></g>',
 sweet:'<circle cx="12" cy="12" r="4.4"/><path d="M7.6 12L3 8.4v7.2zM16.4 12L21 8.4v7.2z"/><path d="M10.2 9.6l3.6 4.8"/>',
 inhaler:'<path d="M8.5 2.5h5.2a1.3 1.3 0 0 1 1.3 1.3V14H8.5z"/><path d="M8.5 14H15v3.7a1.8 1.8 0 0 1-1.8 1.8H5.3a1.8 1.8 0 0 1-1.8-1.8v-1.2A2.5 2.5 0 0 1 6 14z"/><path d="M18.5 14.5h3M18.2 11.4l2.7-1.2M18.2 17.6l2.7 1.2"/>',
 flame:'<path d="M12 21.6c-3.9 0-6.6-2.7-6.6-6.3 0-4 3.3-6.1 4.4-10 2.4 1.7 3.4 3.8 3.3 5.8 1-.6 1.8-1.7 2.1-3.1 1.9 1.9 3.4 4.4 3.4 7.3 0 3.6-2.7 6.3-6.6 6.3z"/><path d="M12 21.6c-1.8 0-2.9-1.1-2.9-2.8 0-1.9 1.6-2.8 2.2-4.5 1.7 1 2.9 2.7 2.9 4.5 0 1.7-1 2.8-2.2 2.8z"/>',
 head:'<path d="M9.8 21.5v-3.2H7.4a1.6 1.6 0 0 1-1.6-1.6v-2.6l-1.9-.6 1.9-3.5A6.7 6.7 0 0 1 12.5 3a6.6 6.6 0 0 1 6.6 6.6c0 2.4-1.1 4.1-2.6 5.4v6.5"/><path d="M18.4 1.6l.5 2.5M22 4.4l-2.4.9M21.6 1l-1.9 1.8"/>',
 spine:'<rect x="9" y="2.3" width="6" height="3.4" rx="1.3"/><rect x="8.6" y="7.1" width="6.8" height="3.4" rx="1.3"/><rect x="8.3" y="11.9" width="7.4" height="3.4" rx="1.3"/><rect x="8" y="16.7" width="8" height="4.4" rx="1.6"/>',
 bone:'<g transform="rotate(-40 12 12)"><path d="M10.9 10.5H6.4a2 2 0 1 0-2.2 1.5 2 2 0 1 0 2.2 1.5h4.5l.9-1.5z"/><path d="M13.1 10.5h4.5a2 2 0 1 1 2.2 1.5 2 2 0 1 1-2.2 1.5h-4.5l.9-1.5z"/></g>',
 snow:'<path d="M12 2.5v19M3.8 7.3l16.4 9.4M3.8 16.7l16.4-9.4"/><path d="M9.6 3.9L12 6.2l2.4-2.3M9.6 20.1l2.4-2.3 2.4 2.3M3.6 10.4l3.2.9-.9 3.1M20.4 10.4l-3.2.9.9 3.1"/>',
 sun:'<circle cx="12" cy="12" r="4.2"/><path d="M12 2.3v2.6M12 19.1v2.6M2.3 12h2.6M19.1 12h2.6M5.1 5.1L7 7M17 17l1.9 1.9M5.1 18.9L7 17M17 7l1.9-1.9"/>',
 water:'<path d="M2.5 15.8c1.6 0 1.6-1.2 3.2-1.2s1.6 1.2 3.2 1.2 1.6-1.2 3.2-1.2 1.6 1.2 3.2 1.2 1.6-1.2 3.2-1.2 1.6 1.2 3 1.2M2.5 20c1.6 0 1.6-1.2 3.2-1.2S7.3 20 8.9 20s1.6-1.2 3.2-1.2 1.6 1.2 3.2 1.2 1.6-1.2 3.2-1.2 1.6 1.2 3 1.2"/><path d="M11.4 13.4V5.2a1.2 1.2 0 0 1 2.4 0V10M13.8 6.4a1.2 1.2 0 0 1 2.4 0v6.2M11.4 9a1.2 1.2 0 0 0-2.4 0v4.3"/>',
 bolt:'<path d="M13.6 2.5L5 13.4h6.1L9.8 21.5l9.2-11.6h-6.2z"/>',
 bottle:'<path d="M9.5 2.5h5M10.2 2.5v4.4L7 10.2a2.6 2.6 0 0 0-.8 1.9V19a2.5 2.5 0 0 0 2.5 2.5h6.6a2.5 2.5 0 0 0 2.5-2.5v-6.9a2.6 2.6 0 0 0-.8-1.9l-3.2-3.3V2.5"/><path d="M10 13.2l4 4M14 13.2l-4 4"/>',
 drop:'<path d="M9 3.2s4.9 5.4 4.9 8.8a4.9 4.9 0 0 1-9.8 0C4.1 8.6 9 3.2 9 3.2z"/><path d="M18.5 5.5v13M15.2 15.3l3.3 3.3 3.3-3.3"/>',
 eye:'<path d="M2.2 11.5S5.8 5.5 12 5.5s9.8 6 9.8 6-3.6 6-9.8 6-9.8-6-9.8-6z"/><circle cx="12" cy="11.5" r="2.9"/><path d="M19.3 16.8s1.9 2.1 1.9 3.3a1.9 1.9 0 0 1-3.8 0c0-1.2 1.9-3.3 1.9-3.3z"/>',
 phone:'<path d="M6.6 3h2.9l1.7 4.4-2.2 1.5a11.5 11.5 0 0 0 5.9 5.9l1.5-2.2 4.4 1.7v2.9a2.2 2.2 0 0 1-2.4 2.2C10.5 18.8 5.2 13.5 4.4 5.4A2.2 2.2 0 0 1 6.6 3z"/>',
 mic:'<rect x="9" y="2.5" width="6" height="11.5" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5v3.8M8.6 21.3h6.8"/>',
 spk:'<path d="M3.5 9.5h3.8L12 5.5v13l-4.7-4H3.5z"/><path d="M15.5 9a4.2 4.2 0 0 1 0 6M18.3 6.3a8 8 0 0 1 0 11.4"/>',
 spkoff:'<path d="M3.5 9.5h3.8L12 5.5v13l-4.7-4H3.5z"/><path d="M16 9.5l5 5M21 9.5l-5 5"/>',
 rotate:'<rect x="2.5" y="9" width="14" height="9" rx="1.8"/><path d="M13.5 3.5a7 7 0 0 1 7.1 6.3"/><path d="M18.4 8.4l2.2 1.4 1.1-2.3"/>',
 clip:'<rect x="5" y="4" width="14" height="17.5" rx="2"/><path d="M9 4V2.5h6V4M8.5 9.5h7M8.5 13h7M8.5 16.5h4"/>',
 search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.4 15.4L21 21"/>',
 timer:'<circle cx="12" cy="13.5" r="7.8"/><path d="M12 13.5V9.3M9.5 2.5h5M12 2.5v3.2M18.2 6.8l1.6-1.6"/>',
 check:'<path d="M4.5 12.5l5 5 10-11"/>',
 copy:'<rect x="8.5" y="8.5" width="12" height="12" rx="2"/><path d="M15.5 8.5V5A1.5 1.5 0 0 0 14 3.5H5A1.5 1.5 0 0 0 3.5 5v9A1.5 1.5 0 0 0 5 15.5h3.5"/>',
 plus:'<path d="M12 5v14M5 12h14"/>',
 aed:'<rect x="3" y="5.5" width="18" height="14.5" rx="2.5"/><path d="M8.5 5.5V3.8h7v1.7"/><path d="M13 8.3l-3.3 4.6h3.1l-1.6 4.4 3.8-5.1h-3.1z"/>',
 vib:'<rect x="8" y="3" width="8" height="18" rx="1.8"/><path d="M4.8 8v8M2 10v4M19.2 8v8M22 10v4"/>',
 hand:'<path d="M7 11.5V6.2a1.6 1.6 0 0 1 3.2 0v4.3M10.2 10V4.6a1.6 1.6 0 0 1 3.2 0V10M13.4 10.2V5.8a1.6 1.6 0 0 1 3.2 0v6.4M16.6 9.6a1.6 1.6 0 0 1 3.2 0v4.2a7.2 7.2 0 0 1-7.2 7.2h-.4a6.5 6.5 0 0 1-5.6-3.2l-2.4-4.1a1.6 1.6 0 0 1 2.7-1.7L8 13.6"/>'
};
const svg=(k,cls)=>'<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"'+(cls?' class="'+cls+'"':'')+'>'+(IC[k]||'')+'</svg>';

/* ---------- triage: the same keyword table serves typing and voice ---------- */
const BY={};
const norm=s=>String(s||'').toLowerCase().replace(/\bo\.\s?d\b\.?/g,'od').replace(/[’‘`´]/g,"'").replace(/'/g,'').replace(/[^a-z0-9€]+/g,' ').replace(/\s+/g,' ').trim();
const STOP=new Set(('a an the is are was were be been being has have had he she they them his her their hes shes theyre its it i im ive me my we our you your '+
  'someone somebody person man woman guy lad fella and or of on in at to with from for by just very really think maybe there theres got get gets getting having '+
  'help please what whats wrong happening happened going gone keeps keep bit lot lots now all this that who been who some any after before when while so').split(' '));
C.forEach((c,i)=>{
  BY[c.id]=c; c.i=i;
  const kws=new Set(); (c.kw||[]).concat([c.n]).forEach(k=>{const n=norm(k); if(n)kws.add(n);});
  c._kw=[...kws];
  const w=new Set(); c._kw.concat([norm(c.t),norm(c.sub)]).forEach(p=>p.split(' ').forEach(x=>{if(x&&!STOP.has(x))w.add(x);}));
  c._w=w;
});
function match(query,typed){
  const qn=norm(query); if(!qn)return [];
  const pad=' '+qn+' ', toks=qn.split(' ').filter(t=>t&&!STOP.has(t));
  const out=C.map(c=>{
    let s=0; c._kw.forEach(k=>{ if(pad.indexOf(' '+k+' ')>=0)s+=k.split(' ').length*3; });
    let all=toks.length>0, any=0;
    toks.forEach((t,j)=>{
      let ok=c._w.has(t);
      if(!ok&&t.length>=2&&((typed&&j===toks.length-1)||t.length>=4)){ for(const w of c._w){ if(w.startsWith(t)){ok=true;break;} } }
      if(ok)any++; else all=false;
    });
    return {c,i:c.i,s,all,any};
  });
  let hits=out.filter(r=>r.s>0||(typed&&r.all));
  if(!hits.length)hits=out.filter(r=>r.any>0&&(typed||r.any>=1));
  hits.sort((a,b)=>(b.s-a.s)||((b.all?1:0)-(a.all?1:0))||(b.any-a.any)||(a.i-b.i));
  return hits;
}
/* who is it? pick the child/baby variant from the words used */
function variantFor(c,query){
  if(!c.v)return 0; const qn=' '+norm(query)+' ';
  const k=/ (baby|babies|infant|newborn|month old|months old) /.test(qn)?'baby':/ (child|kid|kids|toddler|little boy|little girl|little one) /.test(qn)?'child':'adult';
  const i=c.v.findIndex(v=>v.k===k); return i<0?0:i;
}

/* ---------- state ---------- */
let ov=null, main=null, ttl=null, backBtn=null, tstrip=null, logbar=null, sh=null, shade=null, banner=null, toastEl=null;
let view='main', lastQ='', homeScroll=0, cprFrom='main';
let cs={id:null,vi:0,step:0,tab:'steps',heard:null,alts:[]};
let ttsOn=!!LS.get('fa_tts',false);

/* ---------- sound (Web Audio) ---------- */
let AC=null;
function unlockAudio(){try{const K=W.AudioContext||W.webkitAudioContext;if(!K)return;if(!AC||AC.state==='closed')AC=new K();if(AC.state==='suspended'&&AC.resume)AC.resume().catch(()=>{});}catch(e){}}
function tone(freq,dur,at,vol,type){   /* at = performance.now() time the tone should start */
  if(!AC||AC.state!=='running')return false;
  try{const t=AC.currentTime+Math.max(0,((at==null?performance.now():at)-performance.now())/1000),o=AC.createOscillator(),g=AC.createGain();
    o.type=type||'square';o.frequency.value=freq;g.gain.setValueAtTime(0.0001,t);g.gain.exponentialRampToValueAtTime(vol||0.3,t+0.006);
    g.gain.exponentialRampToValueAtTime(0.0001,t+dur);o.connect(g);g.connect(AC.destination);o.start(t);o.stop(t+dur+0.03);return true;}catch(e){return false;}
}
function alarmSound(){const n=performance.now();tone(880,0.16,n,0.35);tone(880,0.16,n+230,0.35);tone(1175,0.32,n+460,0.35);}

/* ---------- read aloud (speechSynthesis, Irish or British English voice) ---------- */
const SSY=()=>W.speechSynthesis;
function spoken(t){return String(t)
  .replace(/\b(01 809 2166|1800 372 999)\b/g,m=>m.replace(/ /g,'').split('').join(' '))
  .replace(/(\d)\s*[–-]\s*(\d)/g,'$1 to $2').replace(/\b112\b/g,'1 1 2').replace(/\b999\b/g,'9 9 9')
  .replace(/(\d)\s*cm\b/g,'$1 centimetres').replace(/(\d)\s*mg\b/g,'$1 milligrams').replace(/(\d)\s*ml\b/g,'$1 millilitres')
  .replace(/\s*°C/g,' degrees').replace(/€2/g,'2 euro').replace(/\bAED\b/g,'A E D').replace(/\bCPR\b/g,'C P R').replace(/\bTIA\b/g,'T I A')
  .replace(/(\d)\+/g,'$1 or over').replace(/[“”"]/g,'').replace(/\s—\s/g,', ').replace(/&/g,' and ').replace(/</g,' under ').replace(/\s+/g,' ').trim();}
function pickVoice(){try{const vs=SSY().getVoices()||[];return vs.find(v=>/^en[-_]IE/i.test(v.lang))||vs.find(v=>/^en[-_]GB/i.test(v.lang))||vs.find(v=>/^en/i.test(v.lang))||null;}catch(e){return null;}}
function speak(text,force){
  if(!ttsOn&&!force)return false; const ss=SSY(); if(!ss||!W.SpeechSynthesisUtterance)return false;
  try{ss.cancel();const u=new W.SpeechSynthesisUtterance(spoken(text));const v=pickVoice();if(v){u.voice=v;u.lang=v.lang;}else u.lang='en-IE';u.rate=0.95;ss.speak(u);return true;}catch(e){return false;}
}
function hush(){try{const ss=SSY();if(ss)ss.cancel();}catch(e){}}

/* ---------- keep the screen on ---------- */
let wake=null, wantWake=false;
function reqWake(){if(!wantWake||wake||!navigator.wakeLock||D.visibilityState!=='visible')return;
  navigator.wakeLock.request('screen').then(l=>{if(!wantWake){l.release().catch(()=>{});return;}wake=l;l.addEventListener('release',()=>{wake=null;});}).catch(()=>{});}
function setWake(on){wantWake=on;if(on)reqWake();else if(wake){wake.release().catch(()=>{});wake=null;}}

/* ---------- landscape (only when asked; failures ignored) ---------- */
let landOn=false;
function landscape(){
  if(landOn){landOff();paintTools();return;}
  landOn=true;paintTools();
  const lock=()=>{const so=screen.orientation;return so&&so.lock?so.lock('landscape'):Promise.reject(new Error('no lock'));};
  let p;
  try{p=(ov.requestFullscreen&&!D.fullscreenElement)?ov.requestFullscreen({navigationUI:'hide'}).then(lock):lock();}catch(e){p=Promise.reject(e);}
  Promise.resolve(p).catch(()=>{if(landOn&&W.innerHeight>W.innerWidth)toast('Turn the phone sideways — the layout follows it');});
}
function landOff(){
  if(!landOn)return; landOn=false;
  try{const so=screen.orientation;if(so&&so.unlock)so.unlock();}catch(e){}
  try{if(D.fullscreenElement===ov&&D.exitFullscreen){const p=D.exitFullscreen();if(p&&p.catch)p.catch(()=>{});}}catch(e){}
}
D.addEventListener('fullscreenchange',()=>{if(landOn&&D.fullscreenElement!==ov){landOn=false;try{const so=screen.orientation;if(so&&so.unlock)so.unlock();}catch(e){}paintTools();}});

/* ---------- toast, sheet ---------- */
function toast(m){if(!toastEl){if(W.grToast)W.grToast(m);return;}toastEl.textContent=m;toastEl.classList.add('on');clearTimeout(toastEl._t);toastEl._t=setTimeout(()=>toastEl.classList.remove('on'),2600);}
function sheet(html){sh.innerHTML='<div class="fa-grip"></div>'+html;sh.hidden=false;shade.hidden=false;sh.scrollTop=0;}
function closeSheet(){if(!sh||sh.hidden)return false;sh.hidden=true;sh.innerHTML='';shade.hidden=true;return true;}
function arm(b,label,ms){ /* two-tap confirm */ if(b.dataset.sure==='1'){b.dataset.sure='';clearTimeout(b._t);return true;}
  b.dataset.sure='1';b._old=b._old||b.innerHTML;b.textContent=label;b.classList.add('sure');
  clearTimeout(b._t);b._t=setTimeout(()=>{b.dataset.sure='';b.innerHTML=b._old;b.classList.remove('sure');},ms||3000);return false;}

/* ---------- incident log (memory + sessionStorage only) ---------- */
let LOG=SS.get('fa_log',[]); if(!Array.isArray(LOG))LOG=[]; LOG=LOG.filter(e=>e&&typeof e.t==='number'&&typeof e.e==='string');
const QUICK=[['Found','Found'],['112 called','112 called'],['CPR started','CPR started'],['AED on','AED on'],['⚡ Shock','AED shock delivered'],
  ['Breathing again','Breathing again'],['Medication (their own)','Medication given (their own)'],['Ambulance arrived','Ambulance arrived']];
function addLog(e,quiet){const t=Date.now();LOG.push({t,e:String(e).slice(0,200)});SS.set('fa_log',LOG);paintLogBar();if(!quiet)toast('✓ Logged '+hms(t)+' — '+e);return t;}
function logText(){
  const L=['INCIDENT LOG — MEDICAL EMERGENCY'];let ld='';
  LOG.forEach(e=>{const d=dayStr(e.t);if(d!==ld){L.push(d);ld=d;}L.push(hms(e.t)+'  '+e.e);});
  if(!LOG.length)L.push('(no entries)');
  L.push('Copied '+hms(Date.now())+' '+dayStr(Date.now())+' · Garda Reference — times from this phone’s clock');
  return L.join('\n');
}
function copyText(t,okMsg){
  const fb=()=>{const ta=D.createElement('textarea');ta.value=t;ta.setAttribute('readonly','');ta.style.cssText='position:fixed;left:0;top:0;opacity:0';
    (ov||D.body).appendChild(ta);ta.select();let ok=false;try{ok=D.execCommand('copy');}catch(e){}ta.remove();
    if(ok)toast(okMsg);else sheet('<h3>Copy this text</h3><textarea class="fa-ta" readonly>'+esc(t)+'</textarea><button type="button" class="fa-sec wide" data-a="sx">Close</button>');};
  if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(t).then(()=>toast(okMsg),fb);else fb();
}
function paintLogBar(){
  if(!logbar)return; const n=q(logbar,'.fa-logn'); if(n)n.textContent=String(LOG.length);
  const last=q(logbar,'.fa-loglast'); if(last)last.textContent=LOG.length?hms(LOG[LOG.length-1].t):'';
  if(sh&&!sh.hidden&&q(sh,'.fa-log'))sheetLog(false,true);
}
function sheetLog(focusNote,keep){
  const inpOld=keep?q(sh,'.fa-lin'):null, draft=inpOld?inpOld.value:'';
  let rows='',ld='';
  LOG.forEach((e,i)=>{const d=dayStr(e.t);if(d!==ld){rows+='<li class="fa-lday">'+esc(d)+'</li>';ld=d;}
    rows+='<li><time>'+hms(e.t)+'</time><span>'+esc(e.e)+'</span><button type="button" class="fa-ldel" data-a="ldel" data-i="'+i+'" aria-label="Delete this entry">✕</button></li>';});
  sheet('<h3>'+svg('clip')+'Incident log</h3><p class="fa-note">Times to the second, 24-hour, from this phone’s clock. Kept only in this browser tab — nothing is saved permanently.</p>'
   +'<ol class="fa-log">'+(rows||'<li class="fa-lempty">Nothing logged yet. Tap the buttons on the log bar to time-stamp events.</li>')+'</ol>'
   +'<div class="fa-notein"><input type="text" class="fa-lin" maxlength="160" placeholder="Add a note, e.g. pen used in left thigh" autocomplete="off" aria-label="Note for the log"><button type="button" class="fa-go" data-a="addnote">Add</button></div>'
   +'<div class="fa-srow"><button type="button" class="fa-go" data-a="copylog">'+svg('copy')+'Copy log</button><button type="button" class="fa-sec" data-a="clearlog">Clear</button><button type="button" class="fa-sec" data-a="sx">Close</button></div>');
  const inp=q(sh,'.fa-lin'); inp.value=draft;
  inp.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();addNote();}});
  if(focusNote)setTimeout(()=>{try{inp.focus();}catch(e){}},60);
  const lg=q(sh,'.fa-log'); if(lg)lg.scrollTop=lg.scrollHeight;
}
function addNote(){const inp=q(sh,'.fa-lin');if(!inp)return;const v=inp.value.trim();if(!v){inp.focus();return;}inp.value='';addLog(v,true);sheetLog(true);toast('✓ Note logged');}

/* ---------- timers (burn cooling, seizure length, second pen …) ---------- */
const TM=[]; let tmSeq=0, bannerFor=null, alarmIv=0;
function tFind(cid,vi,si){return TM.find(t=>t.cid===cid&&t.vi===vi&&t.si===si);}
function tStart(cid,vi,si,def){
  unlockAudio(); const ex=tFind(cid,vi,si); if(ex)return ex;
  const t={id:'t'+(++tmSeq),cid,vi,si,name:def.n,up:!!def.up,dur:def.m*60000,t0:Date.now(),end:def.end,fired:false};
  TM.push(t); addLog(def.log||(def.n+' timer started'),true);
  toast(def.up?'⏱ '+def.n+' timer running — alert at '+def.m+' min':'⏱ '+def.m+'-minute timer started');
  paintTimers(); return t;
}
function tStop(id){const i=TM.findIndex(t=>t.id===id);if(i<0)return;TM.splice(i,1);if(bannerFor===id)closeBanner();paintTimers();if(view==='cond'){paintActs();fit();}}
function tVal(t,now){const el=now-t.t0;return t.up?clk(el):(el>=t.dur?'Done':clkDown(t.dur-el));}
function tTick(){const now=Date.now();TM.forEach(t=>{if(!t.fired&&now-t.t0>=t.dur){t.fired=true;fireAlarm(t);}});paintTimerVals(now);}
function fireAlarm(t){
  addLog('Timer: '+t.end,true); vib([600,200,600,200,600]); alarmSound(); speak(t.end); showBanner(t);
  let n=0; clearInterval(alarmIv); alarmIv=setInterval(()=>{if(!bannerFor||++n>6){clearInterval(alarmIv);return;}alarmSound();vib([400,150,400]);},2500);
}
function showBanner(t){
  if(!banner)return; bannerFor=t.id;
  banner.innerHTML='<div class="fa-bn-t">'+svg('timer')+'<b>'+esc(t.name)+' · '+esc(t.up?clk(Date.now()-t.t0):clk(t.dur))+'</b></div><p>'+esc(t.end)+'</p>'
   +'<div class="fa-bn-row">'+((view==='cond'&&cs.id===t.cid)?'':'<button type="button" class="fa-sec" data-a="bopen" data-tid="'+t.id+'">Open steps</button>')+'<button type="button" class="fa-go" data-a="bok">OK</button></div>';
  banner.hidden=false;
}
function closeBanner(){if(!banner)return false;const was=!banner.hidden;bannerFor=null;clearInterval(alarmIv);banner.hidden=true;banner.innerHTML='';vib(0);return was;}
function paintTimers(){
  if(!tstrip)return;
  const inl=t=>view==='cond'&&cs.tab==='steps'&&t.cid===cs.id&&t.vi===cs.vi&&t.si===cs.step;   /* already big on screen */
  const vt=TM.filter(t=>!inl(t));
  tstrip.hidden=!vt.length||view==='cpr';
  tstrip.innerHTML=vt.map(t=>'<div class="fa-tchip'+(t.fired?' done':'')+(t.up?' up':'')+'" data-tid="'+t.id+'"><button type="button" class="fa-tgo" data-a="topen" data-tid="'+t.id+'">'+svg('timer')+'<span>'+esc(t.name)+'</span><b class="fa-tv">'+esc(tVal(t,Date.now()))+'</b></button>'
    +'<button type="button" class="fa-tx" data-a="tstop" data-tid="'+t.id+'" aria-label="Stop the '+esc(t.name)+' timer">✕</button></div>').join('');
}
function paintTimerVals(now){
  TM.forEach(t=>{const v=tVal(t,now);
    qa(ov,'[data-tid="'+t.id+'"] .fa-tv,.fa-tbig[data-tid="'+t.id+'"] b').forEach(el=>{if(el.textContent!==v)el.textContent=v;});
    qa(ov,'[data-tid="'+t.id+'"]').forEach(el=>{if(el.classList.contains('fa-tchip')||el.classList.contains('fa-tbig'))el.classList.toggle('done',t.fired);});});
}

/* ---------- overlay shell ---------- */
function build(){
  if(ov&&ov.isConnected)return;
  if(!D.querySelector('link[href*="firstaid.css"]')){const l=D.createElement('link');l.rel='stylesheet';l.href='firstaid.css';D.head.appendChild(l);}
  ov=D.createElement('div'); ov.id='fa'; ov.className='fa'; ov.hidden=true; ov.tabIndex=-1;
  ov.setAttribute('role','dialog'); ov.setAttribute('aria-modal','true'); ov.setAttribute('aria-label','Medical emergency');
  ov.innerHTML='<div class="fa-top"><button type="button" class="fa-back" data-a="back">‹ Back</button>'
   +'<div class="fa-tt"><b class="fa-title">Medical emergency</b><span class="hudclock" data-f="line"></span></div>'
   +'<a class="fa-callmini" href="tel:112" data-a="dial" aria-label="Call 112">'+svg('phone')+'<b>112</b></a></div>'
   +'<div class="fa-tstrip" hidden></div><div class="fa-main"></div>'
   +'<div class="fa-logbar"><button type="button" class="fa-logbtn" data-a="logsheet" aria-label="Open the incident log">'+svg('clip')+'<span>Log</span><b class="fa-logn">0</b></button>'
   +'<div class="fa-chips" role="group" aria-label="Log an event with the time">'+QUICK.map((x,i)=>'<button type="button" class="fa-chip" data-a="q" data-q="'+i+'">'+esc(x[0])+'</button>').join('')
   +'<button type="button" class="fa-chip fa-chipn" data-a="note">'+svg('plus')+'Note</button></div></div>'
   +'<div class="fa-banner" role="alert" hidden></div><div class="fa-shade" data-a="sx" hidden></div><div class="fa-sheet" role="document" hidden></div>'
   +'<div class="fa-toast" role="status" aria-live="polite"></div>';
  D.body.appendChild(ov);
  main=q(ov,'.fa-main'); ttl=q(ov,'.fa-title'); backBtn=q(ov,'.fa-back'); tstrip=q(ov,'.fa-tstrip'); logbar=q(ov,'.fa-logbar');
  sh=q(ov,'.fa-sheet'); shade=q(ov,'.fa-shade'); banner=q(ov,'.fa-banner'); toastEl=q(ov,'.fa-toast');
  ov.addEventListener('click',onClick);
  ov.addEventListener('input',e=>{if(e.target.classList.contains('fa-in'))filter(e.target.value,true);});
  ov.addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target.classList.contains('fa-in')){e.preventDefault();const h=match(e.target.value,true);if(h.length){e.target.blur();openCond(h[0].c.id,{q:e.target.value});}}});
  ov.addEventListener('pointerdown',unlockAudio,{passive:true});
  paintLogBar();
}
let keyOn=false;
function onKey(e){
  if(!ov||ov.hidden)return;
  if(e.key==='Escape'){e.preventDefault();e.stopPropagation();faBack();return;}
  const t=e.target, typing=t&&(t.tagName==='INPUT'||t.tagName==='TEXTAREA');
  if(view==='cond'&&cs.tab==='steps'&&!typing&&sh.hidden){if(e.key==='ArrowRight'){e.preventDefault();go(1);}else if(e.key==='ArrowLeft'){e.preventDefault();go(-1);}}
}
function show(){
  ov.hidden=false; D.body.classList.add('fa-open'); setWake(true);
  if(!keyOn){W.addEventListener('keydown',onKey,true);keyOn=true;}
  try{if(W.grHudTick)W.grHudTick();}catch(e){}
}
function setView(v){view=v;ov.dataset.view=v;paintTimers();}

/* ---------- main screen ---------- */
function tile(c){return '<button type="button" class="fa-tile'+(c.crit?' crit':'')+'" data-id="'+c.id+'">'+svg(c.ic)+'<span><b>'+esc(c.n)+'</b><small>'+esc(c.sub)+'</small></span></button>';}
function renderMain(){
  setView('main'); ttl.textContent='Medical emergency'; backBtn.textContent='‹ Back';
  main.innerHTML='<div class="fa-scroll fa-home"><div class="fa-wrap">'
   +'<div class="fa-hero"><div class="fa-callw"><a class="fa-call" href="tel:112" data-a="dial">'+svg('phone')+'<span><b>Call 999 / 112</b><small>Ask for an ambulance</small></span></a>'
   +'<p class="fa-callnote">112 and 999 both work in Ireland</p></div>'
   +'<button type="button" class="fa-cprq" data-a="cpr">'+svg('cpr')+'<span><b>CPR mode</b><small>Metronome · 30:2 · 2-min cycles</small></span></button></div>'
   +'<h2 class="fa-h">What’s happening?</h2>'
   +'<div class="fa-find"><label class="fa-sbox">'+svg('search')+'<input type="search" class="fa-in" placeholder="Type: not breathing, fit, stabbed…" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="search" aria-label="What’s happening? Type to find the right first aid">'
   +'<button type="button" class="fa-clr" data-a="clr" aria-label="Clear" hidden>✕</button></label>'
   +'<button type="button" class="fa-mic" data-a="mic" aria-label="Say what’s wrong">'+svg('mic')+'<span>Say what’s wrong</span></button></div>'
   +'<p class="fa-vstat" role="status" hidden></p>'
   +'<div class="fa-grid">'+C.map(tile).join('')+'</div>'
   +'<p class="fa-nomatch" hidden>No match for that — pick from the full list, or try other words.</p>'
   +'<p class="fa-foot">Quick-reference first aid — not a substitute for training. Call 112/999 first. Follow the ambulance controller’s instructions. Sources: PHECC, Irish Heart Foundation, HSE, Epilepsy Ireland, National Poisons Information Centre, Resuscitation Council UK / ERC 2025, St John Ambulance and others listed with each condition ('+CHECKED.replace('Checked','checked')+').</p>'
   +'</div></div>';
  const inp=q(main,'.fa-in'); inp.value=lastQ; filter(lastQ,false);
  const sc=q(main,'.fa-scroll'); sc.scrollTop=homeScroll; sc.addEventListener('scroll',()=>{homeScroll=sc.scrollTop;},{passive:true});
  paintMic();
}
function filter(v,typed){
  lastQ=String(v||''); if(view!=='main')return;
  const grid=q(main,'.fa-grid'), clr=q(main,'.fa-clr'), nm=q(main,'.fa-nomatch'); if(!grid)return;
  clr.hidden=!lastQ.trim();
  const tiles=qa(grid,'.fa-tile');
  if(!norm(lastQ)){tiles.forEach(b=>{b.hidden=false;});C.forEach(c=>grid.appendChild(q(grid,'[data-id="'+c.id+'"]')));nm.hidden=true;return;}
  const hits=match(lastQ,typed!==false), ids=hits.map(h=>h.c.id);
  if(!ids.length){tiles.forEach(b=>{b.hidden=false;});C.forEach(c=>grid.appendChild(q(grid,'[data-id="'+c.id+'"]')));nm.hidden=false;return;}
  nm.hidden=true; tiles.forEach(b=>{b.hidden=ids.indexOf(b.dataset.id)<0;});
  ids.forEach(id=>grid.appendChild(q(grid,'[data-id="'+id+'"]')));
  tiles.filter(b=>b.hidden).forEach(b=>grid.appendChild(b));
}
function vstat(m,warn){const p=main&&q(main,'.fa-vstat');if(!p)return;p.textContent=m||'';p.hidden=!m;p.classList.toggle('warn',!!warn);}

/* ---------- voice triage (Web Speech API; needs signal) ---------- */
let rec=null, listening=false;
const SRK=()=>W.SpeechRecognition||W.webkitSpeechRecognition;
function paintMic(){const b=main&&q(main,'.fa-mic');if(!b)return;b.classList.toggle('on',listening);
  q(b,'span').textContent=listening?'Listening… tap to stop':(SRK()?'Say what’s wrong':'Voice not available');b.classList.toggle('na',!SRK());}
function stopListening(){if(rec){const r=rec;rec=null;try{r.abort();}catch(e){}}listening=false;paintMic();}
function voice(){
  if(listening){try{rec&&rec.stop();}catch(e){}return;}
  const SR=SRK();
  if(!SR){vstat('Voice isn’t available in this browser — type what’s wrong instead.',1);return;}
  if(navigator.onLine===false){vstat('Voice needs signal and this phone is offline — type what’s wrong instead.',1);return;}
  let r; try{r=new SR();}catch(e){vstat('Voice couldn’t start — type what’s wrong instead.',1);return;}
  rec=r; r.lang='en-IE'; r.interimResults=true; r.maxAlternatives=4; r.continuous=false;
  r.onstart=()=>{listening=true;paintMic();vstat('Listening… say what’s wrong, e.g. “he’s not breathing”.');};
  r.onresult=e=>{let fin=null,interim='';
    for(let i=e.resultIndex;i<e.results.length;i++){const res=e.results[i];if(res.isFinal)fin=Array.from(res).map(a=>a.transcript);else interim+=res[0].transcript;}
    if(interim&&view==='main'){const inp=q(main,'.fa-in');if(inp)inp.value=interim;}
    if(fin){try{r.stop();}catch(x){}handleVoice(fin);}};
  r.onerror=e=>{const m={'network':'Voice needs signal — no connection. Type what’s wrong instead.','not-allowed':'Microphone blocked. Allow it for this site in Chrome settings, or type instead.',
    'service-not-allowed':'Voice isn’t allowed here — type what’s wrong instead.','no-speech':'Didn’t hear anything. Tap the microphone and try again, or type.','audio-capture':'No microphone found — type what’s wrong instead.','aborted':''}[e.error];
    if(m!=='')vstat(m||'Voice failed — type what’s wrong instead.',1);};
  r.onend=()=>{if(rec===r)rec=null;listening=false;paintMic();};
  try{r.start();listening=true;paintMic();}catch(e){rec=null;listening=false;paintMic();vstat('Voice couldn’t start — type what’s wrong instead.',1);}
}
function handleVoice(alts){
  alts=(alts||[]).map(a=>String(a||'').trim()).filter(Boolean); if(!alts.length)return false;
  const best=new Map();
  alts.forEach((a,ai)=>match(a,false).forEach(r=>{const s=r.s*(ai?0.9:1)+(r.s?0:r.any*0.1);const o=best.get(r.c.id);if(!o||s>o.s)best.set(r.c.id,{c:r.c,i:r.i,s});}));
  const list=[...best.values()].sort((a,b)=>(b.s-a.s)||(a.i-b.i));
  if(view!=='main')renderMain();
  const inp=q(main,'.fa-in'); if(inp)inp.value=alts[0]; filter(alts[0],false);
  if(list.length&&list[0].s>=3){
    const top=list[0].c;
    vstat('Heard “'+alts[0]+'” → '+top.n);
    openCond(top.id,{heard:alts[0],alts:list.slice(1,4).map(r=>r.c.id),q:alts.join(' ')});
    return top.id;
  }
  vstat('Heard “'+alts[0]+'” — no clear match. Pick from the list below.',1);
  return null;
}

/* ---------- condition: big one-step-at-a-time instructions ---------- */
const TABS=[['steps','Steps'],['rec','Signs'],['dont','Don’t'],['call','Call 112']];
const stepsOf=(c,vi)=>c.v?c.v[Math.min(vi,c.v.length-1)].steps:c.steps;
function openCond(id,opt){
  const c=BY[id]; if(!c)return false; opt=opt||{};
  build(); show(); stopListening();
  if(view==='main'){const sc=q(main,'.fa-scroll');if(sc)homeScroll=sc.scrollTop;}
  if(CPR.on)cprStop(false);
  let vi=opt.vi!=null?opt.vi:variantFor(c,opt.q||opt.heard||'');
  if(opt.vk&&c.v){const k=c.v.findIndex(v=>v.k===opt.vk);if(k>=0)vi=k;}   /* baby choking → baby CPR */
  cs={id,vi,step:opt.step||0,tab:'steps',heard:opt.heard||null,alts:opt.alts||[]};
  renderCond(); return true;
}
function srcHtml(c){return '<div class="fa-src"><b>Sources</b><ol>'+c.src.map(k=>S[k]?'<li>'+esc(S[k][0])+' — <span class="fa-url">'+esc(S[k][1].replace(/^https?:\/\//,''))+'</span></li>':'').join('')+'</ol><p>'+esc(CHECKED)+'. Quick reference — not a substitute for training.</p></div>';}
function renderCond(){
  const c=BY[cs.id]; setView('cond'); ttl.textContent=c.tb||c.n; ttl.title=c.t; backBtn.textContent='‹ Back';
  let h='<div class="fa-cond">';
  if(cs.heard)h+='<div class="fa-heard">'+svg('mic')+'<span>Heard “'+esc(cs.heard)+'”'+(cs.alts.length?' — not right?':'')+'</span>'+cs.alts.map(a=>BY[a]?'<button type="button" data-a="alt" data-id="'+a+'">'+esc(BY[a].n)+'</button>':'').join('')+'</div>';
  h+='<div class="fa-bar2"><div class="fa-tabs" role="tablist">'+TABS.map(t=>'<button type="button" role="tab" data-a="tab" data-tab="'+t[0]+'" aria-selected="'+(cs.tab===t[0])+'" class="'+(cs.tab===t[0]?'on':'')+(t[0]==='call'?' red':'')+'">'+esc(t[1])+'</button>').join('')+'</div>'
   +'<div class="fa-tools">'+(c.cprBtn?'<button type="button" class="fa-tool fa-tcpr" data-a="cpr">'+svg('cpr')+'<span>CPR mode</span></button>':'')
   +'<button type="button" class="fa-tool fa-ttts" data-a="tts" aria-pressed="false"></button><button type="button" class="fa-tool fa-tland" data-a="land" aria-pressed="false"></button></div></div>';
  if(c.v)h+='<div class="fa-var" role="group" aria-label="Who">'+c.v.map((v,i)=>'<button type="button" data-a="var" data-vi="'+i+'" class="'+(i===cs.vi?'on':'')+'">'+esc(v.t)+'</button>').join('')+'</div>';
  h+='<div class="fa-pane"></div></div>';
  main.innerHTML=h; paintTools(); paintPane();
}
function paintTools(){
  if(!main)return;
  const t=q(main,'.fa-ttts'); if(t){t.innerHTML=svg(ttsOn?'spk':'spkoff')+'<span>Read aloud</span>';t.title=ttsOn?'Read aloud is on':'Read aloud is off';t.classList.toggle('on',ttsOn);t.setAttribute('aria-pressed',String(ttsOn));}
  const l=q(main,'.fa-tland'); if(l){l.innerHTML=svg('rotate')+'<span>Landscape</span>';l.title=landOn?'Landscape on':'Landscape';l.classList.toggle('on',landOn);l.setAttribute('aria-pressed',String(landOn));}
}
function paintPane(){
  const c=BY[cs.id], pane=q(main,'.fa-pane'); if(!pane)return;
  qa(main,'.fa-tabs [data-tab]').forEach(b=>{const on=b.dataset.tab===cs.tab;b.classList.toggle('on',on);b.setAttribute('aria-selected',String(on));});
  const vv=q(main,'.fa-var'); if(vv)vv.hidden=cs.tab!=='steps';
  paintTimers();
  if(cs.tab!=='steps'){
    const list=cs.tab==='rec'?c.rec:cs.tab==='dont'?c.dont:c.call;
    let h='<div class="fa-list fa-l-'+cs.tab+'"><h3>'+esc(cs.tab==='rec'?'Recognise it':cs.tab==='dont'?'Don’t':'Call 112 / 999 when')+'</h3><ul>'+list.map(x=>'<li>'+esc(x[0])+'</li>').join('')+'</ul>';
    if(cs.tab==='call'&&c.er)h+='<h3>Hospital (ED) when</h3><ul class="fa-er">'+c.er.map(x=>'<li>'+esc(x[0])+'</li>').join('')+'</ul>';
    if(cs.tab==='call')h+='<a class="fa-call fa-call-sm" href="tel:112" data-a="dial">'+svg('phone')+'<span><b>Call 112</b><small>Ask for an ambulance</small></span></a>';
    pane.innerHTML=h+srcHtml(c)+'</div>'; pane.scrollTop=0; return;
  }
  const st=stepsOf(c,cs.vi); cs.step=Math.max(0,Math.min(cs.step,st.length-1));
  pane.innerHTML='<div class="fa-steps"><div class="fa-count"><span class="fa-cn"><b></b> / '+st.length+'</span><div class="fa-prog" aria-hidden="true"><i></i></div></div>'
   +'<div class="fa-stage"><button type="button" class="fa-nav fa-prev" data-a="prev" aria-label="Previous step"><span>‹</span><small>Previous</small></button>'
   +'<div class="fa-card"><div class="fa-cin"><p class="fa-stxt" aria-live="polite"></p><div class="fa-sact"></div><div class="fa-endsrc"></div></div></div>'
   +'<button type="button" class="fa-nav fa-next" data-a="next" aria-label="Next step"><small>Next</small><span>›</span></button></div></div>';
  const stage=q(pane,'.fa-stage'); let sx=0,sy=0,st0=0;
  stage.addEventListener('touchstart',e=>{const t=e.touches[0];sx=t.clientX;sy=t.clientY;st0=Date.now();},{passive:true});
  stage.addEventListener('touchend',e=>{const t=e.changedTouches[0],dx=t.clientX-sx,dy=t.clientY-sy;
    if(Math.abs(dx)>50&&Math.abs(dx)>Math.abs(dy)*1.3&&Date.now()-st0<900)go(dx<0?1:-1);},{passive:true});
  paintStep(false);
}
function paintStep(anim){
  const c=BY[cs.id], st=stepsOf(c,cs.vi), s=st[cs.step], pane=q(main,'.fa-pane'); if(!pane||!s)return;
  q(pane,'.fa-cn b').textContent=String(cs.step+1);
  q(pane,'.fa-prog i').style.width=((cs.step+1)/st.length*100).toFixed(1)+'%';
  const tx=q(pane,'.fa-stxt'); tx.textContent=s.t;
  const pv=q(pane,'.fa-prev'), nx=q(pane,'.fa-next'); pv.disabled=cs.step===0; nx.disabled=cs.step===st.length-1;
  q(nx,'small').textContent=cs.step===st.length-1?'Last step':'Next';
  const es=q(pane,'.fa-endsrc'), last=cs.step===st.length-1; es.innerHTML=last?srcHtml(c):''; es.hidden=!last;   /* empty → no flex gap */
  paintActs(); paintTimers();
  const card=q(pane,'.fa-card'); card.scrollTop=0;
  if(anim&&card.animate)try{card.animate([{opacity:.25,transform:'translateX('+(anim>0?28:-28)+'px)'},{opacity:1,transform:'none'}],{duration:180,easing:'ease-out'});}catch(e){}
  fit();
  speak('Step '+(cs.step+1)+' of '+st.length+'. '+s.t);
}
function paintActs(){
  const c=BY[cs.id]; if(!c||view!=='cond'||cs.tab!=='steps')return;
  const s=stepsOf(c,cs.vi)[cs.step], box=q(main,'.fa-sact'); if(!box||!s)return;
  let h='';
  if(s.cpr)h+='<button type="button" class="fa-act red" data-a="cpr">'+svg('cpr')+'Open CPR mode</button>';
  if(s.timer){const t=tFind(c.id,cs.vi,cs.step);
    h+=t?'<div class="fa-tbig'+(t.fired?' done':'')+'" data-tid="'+t.id+'">'+svg('timer')+'<span>'+esc(t.name)+(t.up?'<small>alert at '+s.timer.m+' min</small>':'<small>'+s.timer.m+'-min timer</small>')+'</span><b>'+esc(tVal(t,Date.now()))+'</b><button type="button" class="fa-tx" data-a="tstop" data-tid="'+t.id+'" aria-label="Stop timer">Stop</button></div>'
      :'<button type="button" class="fa-act" data-a="stimer">'+svg('timer')+(s.timer.up?'Start '+esc(s.timer.n.toLowerCase())+' timer':'Start '+s.timer.m+'-min timer')+'</button>';}
  if(s.log)h+='<button type="button" class="fa-act ghost" data-a="slog">'+svg('clip')+'Log: '+esc(s.log)+'</button>';
  if(s.go&&BY[s.go])h+='<button type="button" class="fa-act ghost" data-a="sgo" data-id="'+s.go+'">'+svg(BY[s.go].ic)+'Open: '+esc(BY[s.go].n)+' ›</button>';
  box.innerHTML=h; box.hidden=!h;
}
function go(d){
  const c=BY[cs.id]; if(!c)return; const n=stepsOf(c,cs.vi).length, to=Math.max(0,Math.min(n-1,cs.step+d));
  if(to===cs.step){if(d>0)toast('That’s the last step — see the other tabs');return;}
  cs.step=to; paintStep(d); vib(8);
}
function fit(){
  const tx=main&&q(main,'.fa-stxt'), card=main&&q(main,'.fa-card'); if(!tx||!card)return;
  const land=W.innerWidth>W.innerHeight;
  const max=Math.round(land?Math.min(44,Math.max(32,W.innerHeight*0.1)):Math.min(40,Math.max(28,W.innerWidth*0.09))), min=land?28:24;
  const src=q(card,'.fa-endsrc'); if(src)src.style.display='none';   /* fit the step and its buttons; sources scroll below */
  let f=max; tx.style.fontSize=f+'px';
  while(f>min&&card.scrollHeight>card.clientHeight+1){f=Math.max(min,f-2);tx.style.fontSize=f+'px';}
  if(src)src.style.display='';
}
W.addEventListener('resize',()=>{if(ov&&!ov.hidden&&view==='cond')fit();});

/* ---------- CPR mode: metronome 110/min (RCUK/ERC 2025: 100–120), 30:2 or hands-only, 2-minute cycles ---------- */
const BPM=110, BREATH_MS=7000, CYCLE_MS=120000;     /* breath pause kept under the 10 s ERC maximum; tap the circle to resume sooner */
const CPR={on:false,mode:LS.get('fa_cpr_mode','302')==='ho'?'ho':'302',snd:LS.get('fa_cpr_snd',true)!==false,vb:!!LS.get('fa_cpr_vib',false),speed:1};
let cprIv=0, cprQ=[], cprBn=0, cprArm=0;
function cprOpen(){
  build(); show(); unlockAudio(); stopListening(); closeSheet();
  if(view!=='cpr'){cprFrom=view==='cond'?'cond':'main'; if(view==='main'){const sc=q(main,'.fa-scroll');if(sc)homeScroll=sc.scrollTop;}}
  if(!CPR.on){
    const now=performance.now();
    Object.assign(CPR,{on:true,t0:now,cyc0:now,cyc:1,n:0,sched:0,phase:'push',breathEnd:0,next:now+350,beats:0,clicks:0,shocks:0,aedAt:0,breaths:0,cycAlerts:0});
    cprQ=[]; const t=addLog('CPR started'+(CPR.mode==='ho'?' (hands-only)':''),true); toast('✓ Logged '+hms(t)+' — CPR started');
    clearInterval(cprIv); cprIv=setInterval(cprTick,20);
    speak('Push hard and fast in the centre of the chest.');
  }
  cprArm=0; setView('cpr'); renderCPR(); cprTick(); return true;
}
function renderCPR(){
  ttl.textContent='CPR mode'; backBtn.textContent='‹ Stop CPR';
  main.innerHTML='<div class="fa-cpr">'
   +'<div class="fc-stats"><div class="fc-st"><small>CPR time</small><b class="fc-elv">0:00</b></div>'
   +'<div class="fc-st fc-cy"><small class="fc-cyl">Cycle 1 · swap / AED in</small><b class="fc-cyv">2:00</b><span class="fc-cyb"><i></i></span></div></div>'
   +'<div class="fc-mid"><button type="button" class="fc-ring" data-a="cring" aria-label="Compression count"><span class="fc-n">0</span><span class="fc-lab">of 30</span><span class="fc-sub">110 / min</span></button>'
   +'<p class="fc-msg" aria-live="polite"></p></div>'
   +'<div class="fc-ctl"><div class="fc-seg" role="group" aria-label="Breaths"><button type="button" data-a="cmode" data-m="302">30 : 2</button><button type="button" data-a="cmode" data-m="ho">Hands-only</button></div>'
   +'<div class="fc-tog"><button type="button" class="fc-t" data-a="csnd"></button><button type="button" class="fc-t" data-a="cvib"></button></div>'
   +'<div class="fc-aed"><button type="button" class="fc-b" data-a="caed">'+svg('aed')+'<span>AED on</span></button>'
   +'<button type="button" class="fc-b fc-shock" data-a="cshock">'+svg('bolt')+'<span>Shock given</span></button>'
   +'<button type="button" class="fc-b fc-ok" data-a="cbreath">'+svg('check')+'<span>Breathing again</span></button></div></div>'
   +'<div class="fc-banner" role="alert" hidden></div></div>';
  paintCPR();
}
function paintCPR(){
  if(view!=='cpr')return;
  qa(main,'[data-a="cmode"]').forEach(b=>b.classList.toggle('on',b.dataset.m===CPR.mode));
  const s=q(main,'[data-a="csnd"]'); if(s){s.innerHTML=svg(CPR.snd?'spk':'spkoff')+'<span>'+(CPR.snd?'Beep on':'Beep off')+'</span>';s.classList.toggle('on',CPR.snd);}
  const v=q(main,'[data-a="cvib"]'); if(v){v.innerHTML=svg('vib')+'<span>'+(CPR.vb?'Vibrate on':'Vibrate off')+'</span>';v.classList.toggle('on',CPR.vb);}
  const a=q(main,'[data-a="caed"] span'); if(a)a.textContent=CPR.aedAt?'AED on '+hms(CPR.aedAt).slice(0,5):'AED on';
  const k=q(main,'[data-a="cshock"] span'); if(k)k.textContent=CPR.shocks?'Shock given ('+CPR.shocks+')':'Shock given';
  paintCount(); paintCPRClock(performance.now());
}
function paintCount(){
  if(view!=='cpr')return; const r=q(main,'.fc-ring'); if(!r)return;
  const br=CPR.phase==='breath';
  r.classList.toggle('br',br);
  q(r,'.fc-n').textContent=br?'2':String(CPR.n);
  q(r,'.fc-lab').textContent=br?'BREATHS':(CPR.mode==='ho'?'pushes':'of 30');
  if(!br)q(r,'.fc-sub').textContent='110 / min';
  q(main,'.fc-msg').textContent=br?'Give 2 breaths — about 1 second each, just enough to make the chest rise.'
    :(CPR.mode==='ho'?'Hands-only: push hard and fast in the centre of the chest, without stopping.':'Push hard and fast, 5–6 cm deep. After 30, give 2 breaths.');
}
function paintCPRClock(now){
  if(view!=='cpr'||!CPR.on)return;
  const sp=CPR.speed||1, cy=CYCLE_MS/sp, left=Math.max(0,cy-(now-CPR.cyc0));
  const set=(sel,v)=>{const e=q(main,sel);if(e&&e.textContent!==v)e.textContent=v;};
  set('.fc-elv',clk((now-CPR.t0)*sp)); set('.fc-cyv',clkDown(left*sp)); set('.fc-cyl','Cycle '+CPR.cyc+' · swap / AED in');
  const b=q(main,'.fc-cyb i'); if(b)b.style.width=((1-left/cy)*100).toFixed(1)+'%';
  if(CPR.phase==='breath')set('.fc-sub','Tap when done · '+Math.ceil(Math.max(0,CPR.breathEnd-now)*sp/1000)+' s');
}
function cprTick(){
  if(!CPR.on)return;
  const now=performance.now(), sp=CPR.speed||1, iv=60000/BPM/sp;
  if(CPR.phase==='push'){
    while(CPR.next<=now+120){
      if(CPR.mode==='302'&&CPR.sched>=30)break;
      CPR.sched++; const acc=CPR.mode==='302'&&CPR.sched===30, bt=CPR.next; cprQ.push(bt);
      if(CPR.snd&&tone(acc?1480:1050,0.05,bt,0.4,'square'))CPR.clicks++;
      CPR.next+=iv;
    }
  }
  while(cprQ.length&&cprQ[0]<=now){cprQ.shift();cprBeat();}
  if(CPR.phase==='breath'&&now>=CPR.breathEnd)cprResume(now);
  const cy=CYCLE_MS/sp;
  if(now-CPR.cyc0>=cy){const k=Math.floor((now-CPR.cyc0)/cy);CPR.cyc0+=k*cy;CPR.cyc+=k;cprCycle();}
  paintCPRClock(now);
}
function cprBeat(){
  CPR.beats++; CPR.n++;
  if(CPR.vb)vib(40);
  if(view==='cpr'){const r=q(main,'.fc-ring');if(r&&r.animate)try{r.animate([{transform:'scale(1.07)'},{transform:'scale(1)'}],{duration:240,easing:'ease-out'});}catch(e){}}
  if(CPR.mode==='302'&&CPR.n>=30)cprBreaths(); else paintCount();
}
function cprBreaths(){
  const now=performance.now(); CPR.phase='breath'; CPR.breathEnd=now+BREATH_MS/(CPR.speed||1); CPR.breaths++; cprQ=[];
  tone(660,0.12,now+60,0.35,'sine'); tone(660,0.12,now+260,0.35,'sine'); if(CPR.vb)vib([120,80,120]);
  speak('Give 2 breaths'); paintCount();
}
function cprResume(now){CPR.phase='push';CPR.n=0;CPR.sched=0;CPR.next=now;cprQ=[];paintCount();}
function cprCycle(){
  CPR.cycAlerts++; if(CPR.mode==='ho')CPR.n=0;
  const now=performance.now(); tone(880,0.14,now,0.4); tone(880,0.14,now+200,0.4); tone(1320,0.3,now+400,0.4);
  vib([300,120,300]); speak('Two minutes. Swap rescuer, or let the A E D analyse.');
  const b=view==='cpr'&&q(main,'.fc-banner');
  if(b){b.innerHTML='<b>2 minutes</b><span>Swap rescuer / let the AED analyse</span>';b.hidden=false;clearTimeout(cprBn);cprBn=setTimeout(()=>{const x=main&&q(main,'.fc-banner');if(x)x.hidden=true;},10000);}
  paintCount();
}
function cprMode(m){
  if(m!=='ho'&&m!=='302')return; CPR.mode=m; LS.set('fa_cpr_mode',m);
  if(CPR.on){const now=performance.now(); if(CPR.phase==='breath')cprResume(now); else{CPR.n=0;CPR.sched=cprQ.length;}}
  paintCPR();
}
function cprStop(silent){
  if(!CPR.on)return; const el=(performance.now()-CPR.t0)*(CPR.speed||1);
  CPR.on=false; clearInterval(cprIv); cprIv=0; cprQ=[]; clearTimeout(cprBn); hush();
  if(!silent)addLog('CPR stopped after '+clk(el),true);
}
function cprBack(){
  const now=Date.now();
  if(now-cprArm<3000){cprArm=0;cprStop(false);if(cprFrom==='cond'&&cs.id&&BY[cs.id])renderCond();else renderMain();toast('CPR stopped — logged');return;}
  cprArm=now; backBtn.textContent='Tap again to stop'; toast('Press Back again to stop CPR');
  setTimeout(()=>{if(view==='cpr'&&Date.now()-cprArm>=2900)backBtn.textContent='‹ Stop CPR';},3000);
}

/* ---------- one click handler for the whole overlay ---------- */
function onClick(e){
  const b=e.target.closest('[data-a],.fa-tile'); if(!b||!ov.contains(b))return;
  if(b.classList.contains('fa-tile')){openCond(b.dataset.id,{q:lastQ});return;}
  const a=b.dataset.a, c=BY[cs.id], s=c&&view==='cond'?stepsOf(c,cs.vi)[cs.step]:null;
  switch(a){
   case 'back': faBack(); break;
   case 'dial': addLog('Dialled 112 from this app',true); break;          /* the tel: link itself opens the dialler */
   case 'cpr': cprOpen(); break;
   case 'mic': voice(); break;
   case 'clr': {const i=q(main,'.fa-in'); if(i){i.value='';filter('',true);vstat('');i.focus();} break;}
   case 'alt': {const was=cs.id; openCond(b.dataset.id,{heard:cs.heard,alts:[was].concat(cs.alts.filter(x=>x!==b.dataset.id)).slice(0,3),q:cs.heard||''}); break;}
   case 'tab': cs.tab=b.dataset.tab; paintPane(); if(cs.tab!=='steps')hush(); break;
   case 'var': cs.vi=+b.dataset.vi; cs.step=0; qa(main,'.fa-var button').forEach(x=>x.classList.toggle('on',x===b)); paintPane(); break;
   case 'prev': go(-1); break;
   case 'next': go(1); break;
   case 'tts': ttsOn=!ttsOn; LS.set('fa_tts',ttsOn); paintTools();
     if(ttsOn){if(s)speak('Step '+(cs.step+1)+' of '+stepsOf(c,cs.vi).length+'. '+s.t);}else hush();
     toast(ttsOn?'Read aloud on — each step is spoken':'Read aloud off'); break;
   case 'land': landscape(); break;
   case 'stimer': if(s&&s.timer){tStart(c.id,cs.vi,cs.step,s.timer);paintActs();paintTimers();fit();} break;
   case 'slog': if(s&&s.log){const t=addLog(s.log);b.innerHTML=svg('check')+'Logged '+hms(t);b.classList.add('done');} break;
   case 'sgo': openCond(b.dataset.id,{vk:c&&c.v?c.v[cs.vi].k:null}); break;
   case 'tstop': if(arm(b,'Stop?',2500))tStop(b.dataset.tid); break;
   case 'topen': {const t=TM.find(x=>x.id===b.dataset.tid); if(t)openCond(t.cid,{vi:t.vi,step:t.si}); break;}
   case 'bok': closeBanner(); break;
   case 'bopen': {const t=TM.find(x=>x.id===b.dataset.tid); closeBanner(); if(t&&view!=='cpr')openCond(t.cid,{vi:t.vi,step:t.si}); break;}
   case 'q': {const x=QUICK[+b.dataset.q]; if(x){addLog(x[1]); b.classList.remove('flash'); void b.offsetWidth; b.classList.add('flash');} break;}
   case 'note': sheetLog(true); break;
   case 'logsheet': sheetLog(false); break;
   case 'sx': closeSheet(); break;
   case 'addnote': addNote(); break;
   case 'copylog': copyText(logText(),'Log copied — paste it into your notes'); break;
   case 'clearlog': if(!LOG.length){toast('The log is already empty');break;}
     if(arm(b,'Tap again to clear',3000)){LOG=[];SS.set('fa_log',LOG);paintLogBar();sheetLog(false);toast('Log cleared');} break;
   case 'ldel': if(arm(b,'Delete?',2500)){const i=+b.dataset.i; if(LOG[i]){LOG.splice(i,1);SS.set('fa_log',LOG);paintLogBar();sheetLog(false);}} break;
   case 'cmode': cprMode(b.dataset.m); break;
   case 'csnd': CPR.snd=!CPR.snd; LS.set('fa_cpr_snd',CPR.snd); unlockAudio(); paintCPR(); break;
   case 'cvib': CPR.vb=!CPR.vb; LS.set('fa_cpr_vib',CPR.vb); if(CPR.vb)vib(40); paintCPR(); break;
   case 'caed': CPR.aedAt=addLog('AED on'); paintCPR(); break;
   case 'cshock': CPR.shocks++; addLog('AED shock delivered ('+CPR.shocks+')'); paintCPR(); break;
   case 'cbreath': if(arm(b,'Tap again: stop CPR',3000)){const el=(performance.now()-CPR.t0)*(CPR.speed||1);
     addLog('Breathing again — CPR stopped after '+clk(el),true); cprStop(true); openCond('recovery'); toast('Breathing again — logged. Recovery position:');} break;
   case 'cring': if(CPR.on&&CPR.phase==='breath')cprResume(performance.now()); break;
  }
}

/* ---------- API ---------- */
function openFirstAid(id){
  build(); const wasHidden=ov.hidden; if(wasHidden){lastQ='';homeScroll=0;} show(); unlockAudio();
  if(id&&BY[id])openCond(id,{});
  else if(id==='cpr-mode')cprOpen();
  else if(wasHidden||!main.firstChild)renderMain();
  return true;
}
function closeFirstAid(){
  if(!ov)return;
  cprStop(false); TM.length=0; closeBanner(); closeSheet(); stopListening(); hush(); setWake(false); landOff(); vib(0);
  if(keyOn){W.removeEventListener('keydown',onKey,true);keyOn=false;}
  ov.hidden=true; D.body.classList.remove('fa-open'); main.innerHTML=''; view='main'; ov.dataset.view=''; if(tstrip){tstrip.innerHTML='';tstrip.hidden=true;}
  if(toastEl)toastEl.classList.remove('on');
  try{if(AC&&AC.state==='running'&&AC.suspend)AC.suspend().catch(()=>{});}catch(e){}
}
function faBack(){
  if(!ov||ov.hidden||!ov.isConnected)return false;
  if(closeSheet())return true;
  if(closeBanner())return true;
  if(view==='cpr'){cprBack();return true;}
  if(view==='cond'){renderMain();return true;}
  closeFirstAid(); return true;
}
setInterval(()=>{if(ov&&!ov.hidden)tTick();},250);
D.addEventListener('visibilitychange',()=>{if(D.visibilityState==='visible'&&ov&&!ov.hidden){reqWake();tTick();}});

function exportContent(){
  const ks=k=>String(k||'').split(/\s+/).filter(Boolean);
  const L=a=>(a||[]).map(x=>({text:x[0],src:ks(x[1])}));
  const ST=a=>a.map(s=>{const o={text:s.t,src:ks(s.s)};if(s.timer)o.timer={minutes:s.timer.m,countUp:!!s.timer.up,label:s.timer.n,message:s.timer.end};
    if(s.log)o.logButton=s.log;if(s.go)o.link=s.go;if(s.cpr)o.cprModeButton=true;return o;});
  return {checked:CHECKED,sources:Object.keys(S).reduce((o,k)=>{o[k]={name:S[k][0],url:S[k][1]};return o;},{}),
    conditions:C.map(c=>({id:c.id,title:c.t,tile:c.n,subtitle:c.sub,keywords:c.kw,recognise:L(c.rec),
      steps:c.v?undefined:ST(c.steps),variants:c.v?c.v.map(v=>({key:v.k,label:v.t,steps:ST(v.steps)})):undefined,
      dont:L(c.dont),call112When:L(c.call),hospitalWhen:c.er?L(c.er):undefined,
      sources:c.src.map(k=>({key:k,name:S[k][0],url:S[k][1]}))}))};
}

W.openFirstAid=openFirstAid; W.closeFirstAid=closeFirstAid; W.faBack=faBack;
W.GRFirstAid=Object.freeze({open:openFirstAid,close:closeFirstAid,back:faBack,
  match:(qq,typed)=>match(qq,!!typed).map(r=>r.c.id), content:exportContent, log:()=>LOG.map(e=>({t:e.t,e:e.e})), logText,
  _debug:Object.freeze({
    state:()=>({open:!!ov&&!ov.hidden,view,cond:cs.id,vi:cs.vi,vk:cs.id&&BY[cs.id].v?BY[cs.id].v[cs.vi].k:null,step:cs.step,tab:cs.tab,tts:ttsOn,land:landOn,
      timers:TM.map(t=>({name:t.name,up:t.up,el:Date.now()-t.t0,dur:t.dur,fired:t.fired,cid:t.cid,si:t.si})),
      cpr:CPR.on?{mode:CPR.mode,n:CPR.n,phase:CPR.phase,cyc:CPR.cyc,beats:CPR.beats,clicks:CPR.clicks,shocks:CPR.shocks,breaths:CPR.breaths,cycAlerts:CPR.cycAlerts,speed:CPR.speed}:null}),
    cprSpeed:k=>{CPR.speed=k>0?k:1;},
    cprFF:ms=>{if(CPR.on){const sp=CPR.speed||1;CPR.cyc0-=ms/sp;CPR.t0-=ms/sp;cprTick();}},
    timerFF:ms=>{TM.forEach(t=>{t.t0-=ms;});tTick();},
    voice:alts=>handleVoice(alts),
    variantFor:(id,qq)=>BY[id]?variantFor(BY[id],qq):null
  })});
})();
