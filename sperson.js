/* Assisting — Search of the person.
   A guided check that narrows the situation (what's happening · the power · your grounds · the person · how far · same-sex
   searcher) and ends in a search plan: the power, what to say, what you may search for, the safeguards, what to record and a
   notebook draft. Plus the full reference and the 30-scenario matrix from "Searching the Person — Garda Powers, Limits &
   Pitfalls" (checked against the Irish Statute Book, Revised Acts, vLex headnotes and press reports, 27 October 2026).
   Session-only: nothing chosen or typed here is stored. */
(function(){
'use strict';
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const ic=n=>window.GRI?GRI(n):'';
const CHECKED='Checked against the Irish Statute Book, Revised Acts, vLex headnotes and press reports on 27 October 2026. Re-check any provision against the revised Act before relying on it in a file.';

/* cases the guide names that are in your case library (same citation) — tap to open */
const CASE={Farrell:"DPP (Garda O'Higgins) v Farrell",Rooney:'DPP v Rooney',"O'Donnell":"DPP v O'Donnell","O’Donnell":"DPP v O'Donnell","O'Brien":"People (AG) v O'Brien","O’Brien":"People (AG) v O'Brien",Kenny:'People (DPP) v Kenny',
  Cash:'DPP (Walsh) v Cash',Damache:'Damache v DPP',Owens:'DPP v Owens',JC:'People (DPP) v JC',Quirke:'People (DPP) v Quirke','Jennings v Quinn':'Jennings v Quinn','Christie v Leachinsky':'Christie v Leachinsky'};
const cz=k=>CASE[k]?'<button type="button" class="sp-case" data-n="'+esc(CASE[k])+'">'+esc(k)+'</button>':esc(k);
// mark case names inside a sentence as buttons
const withCases=t=>{ let h=esc(t); Object.keys(CASE).sort((a,b)=>b.length-a.length).forEach(k=>{ const e=esc(k); if(h.indexOf(e)>=0&&h.indexOf('data-n="'+esc(CASE[k]))<0)h=h.split(e).join('\u0000'+k+'\u0001'); });
  return h.replace(/\u0000([^\u0001]+)\u0001/g,(m,k)=>cz(k)); };

/* ---------------- the powers ---------------- */
const P={
  s23:{t:'Misuse of Drugs Act 1977, s.23 (as amended 1984)',sh:'s.23 Misuse of Drugs Act 1977',
    trig:'Reasonable cause to suspect the person has a controlled drug in their possession in contravention of the Act.',
    may:['Search the person, and detain them for the time reasonably necessary to do it.','Search a vehicle.','Examine and seize evidence.','s.23(1A): require the person to go with you to a Garda station to be searched there.'],
    pit:['Area-based suspicion (Farrell).','Detention lasting longer than the search.','Using s.23 as a pretext to question.'],
    note:'Upheld as constitutional in O’Callaghan v Ireland [1994] 1 IR 555 — an extension of arrest on suspicion.',
    scope:'Controlled drugs only — not their notes, not their phone.',
    say:'“I’m searching you under the Misuse of Drugs Act, because I suspect you have drugs on you — [what you saw, smelt or were told].”',
    nb:'section 23 of the Misuse of Drugs Act 1977',what:'a controlled drug in contravention of the Misuse of Drugs Act 1977'},
  fowa16:{t:'Firearms and Offensive Weapons Act 1990, s.16',sh:'s.16 Firearms and Offensive Weapons Act 1990',
    trig:'Reasonable cause to suspect the person has with them, in a public place, an article in contravention of s.9 (knives, bladed or pointed articles, weapons of offence) or s.9A.',
    may:['Search the person, and detain them for the time reasonably necessary.','Search a vehicle.','Seize evidence.'],
    pit:['Suspicion must attach to the person, not the crowd.','Only for s.9/9A articles: a soft package is outside the power unless it could be a weapon. Form fresh s.23 grounds or stop.'],
    scope:'Knives, bladed or pointed articles and weapons of offence only. A soft package is outside it unless it could be a weapon.',
    say:'“I’m searching you under the Firearms and Offensive Weapons Act, because I suspect you have a knife or weapon on you — [your grounds].”',
    nb:'section 16 of the Firearms and Offensive Weapons Act 1990',what:'an article in contravention of section 9 (or 9A) of the Firearms and Offensive Weapons Act 1990, namely [knife / bladed or pointed article / weapon of offence]'},
  dpa29:{t:'Dublin Police Act 1842, s.29',sh:'s.29 Dublin Police Act 1842',
    trig:'Reasonable suspicion that the person is carrying stolen or unlawfully obtained goods — Dublin Metropolitan District only.',
    may:['Stop, search and detain the person (and carts, vehicles and vessels).'],
    pit:['Geographic limit: Dublin Metropolitan District only.','You must tell the person the reason (Rooney).'],
    scope:'Stolen or unlawfully obtained goods.',
    say:'“I’m stopping and searching you under the Dublin Police Act, because I suspect you have stolen goods — [your grounds].”',
    nb:'section 29 of the Dublin Police Act 1842',what:'stolen or unlawfully obtained goods'},
  cla8:{t:'Criminal Law Act 1976, s.8',sh:'s.8 Criminal Law Act 1976',
    trig:'Reasonable cause to suspect that a listed offence (Firearms Acts, explosives, murder, manslaughter, s.18 OAPA, robbery and burglary, escape, s.12 FOWA 1990, and others) has been, is being or is about to be committed.',
    may:['Stop and search the vehicle.','Search a person in or accompanying it if you suspect with reasonable cause that they hold evidence or are involved.','Use reasonable force to stop the vehicle.'],
    pit:['Suspicion must attach to the offence AND, for a person, to them.'],
    scope:'Evidence of the listed offence — in the vehicle, and on a person you suspect.',
    say:'“I’m stopping this vehicle under the Criminal Law Act 1976. I suspect [the offence] — [your grounds] — so I’m searching the vehicle, and you, because [why this person].”',
    nb:'section 8 of the Criminal Law Act 1976',what:'evidence relating to [the listed offence]'},
  oasa30:{t:'Offences Against the State Act 1939, s.30',sh:'s.30 Offences Against the State Act 1939',
    trig:'Reasonable suspicion of an OASA offence or a scheduled offence (scheduled offences include Firearms Acts and explosives offences).',
    may:['Stop, search, question and arrest.'],
    pit:['The duty to tell the person the legal basis is strict (O’Donnell).','A person in s.30 custody can also be searched, photographed, fingerprinted and swabbed for firearms or explosives residue under s.7 of the Criminal Law Act 1976 — only in that custody, not general custody.'],
    scope:'What relates to the suspected offence (e.g. a firearm).',
    say:'“I’m searching you under section 30 of the Offences Against the State Act, because I suspect [e.g. you have a firearm] — [your grounds].”',
    nb:'section 30 of the Offences Against the State Act 1939',what:'[the scheduled offence, e.g. possession of a firearm]'},
  arrest:{t:'Search incidental to a lawful arrest (common law)',sh:'search on arrest (common law)',
    trig:'A lawful arrest has happened, on its own grounds.',
    may:['Search the person for evidence, weapons and items for escape or self-harm.','Seize property found that is evidence of the offence charged or another offence, where that’s needed to prevent its loss or destruction (McFadden, drawing on Jennings v Quinn).'],
    pit:['The arrest must be lawful: an unlawful arrest taints the search and anything found.','The search must relate to the arrest.','It does not authorise searching a phone’s contents: seize the device and get judicial authorisation (Quirke).','Arrest must never be used as a device to search. If you have no power to search, you can’t arrest just to create one.'],
    scope:'Evidence, weapons, items for escape or self-harm — not the phone’s contents.',
    say:'“You’re under arrest for [the offence, in plain words]. I’m now going to search you for [evidence / anything you could hurt yourself or someone with, or use to escape].” Give the true reason for the arrest (Christie v Leachinsky).',
    nb:'my common law power to search a person following a lawful arrest',what:'evidence, weapons or items that could be used to escape or for self-harm'},
  reg17:{t:'Treatment of Persons in Custody Regulations 1987 (S.I. 119/1987), Reg 17',sh:'Reg 17, Custody Regulations 1987',
    trig:'The person is in custody in a Garda station.',
    may:['Search the person in the station, making sure as far as practicable that they understand the reason and that it’s done with due respect.'],
    pit:['No search by a person of the opposite sex (other than a doctor).','A search involving removal of underclothing shall, where practicable, be carried out by a doctor.','A record must be made: who searched and who was present; property taken is recorded.','Breach exposes the member to discipline (CJA 1984 s.7(4)). It doesn’t automatically make the detention unlawful, but it’s admissible in assessing fairness and can support exclusion.'],
    scope:'As the Regulations allow — record all property taken.',
    say:'“I’m going to search you now, because [the reason — e.g. to make sure you’ve nothing that could harm you, and to record your property].” Make sure they understand.',
    nb:'Regulation 17 of the Criminal Justice Act 1984 (Treatment of Persons in Custody in Garda Síochána Stations) Regulations 1987',what:''},
  mda26:{t:'Misuse of Drugs Act 1977, s.26 search warrant',sh:'s.26 Misuse of Drugs Act 1977 warrant',
    trig:'A s.26 warrant, issued by a District Judge or Peace Commissioner, valid for one month. In urgent drug-trafficking cases a superintendent independent of the investigation may issue one under s.8 of the Criminal Justice (Drug Trafficking) Act 1996, valid for 24 hours.',
    may:['Search the premises “and any persons found therein” (s.26(2)).','s.26(3): the named member may arrest persons found there in order to search them.'],
    pit:['Devoy v Ireland [2004] IEHC 404 upheld the power after a nightclub raid where patrons were lined up and body-searched — and held a garda’s evidence gets no extra weight in a conflict of accounts.'],
    scope:'What the warrant describes — the premises and the people found there.',
    say:'“We have a warrant under the Misuse of Drugs Act to search here, and anyone found here. [Show it.] I’m searching you under it.”',
    nb:'a search warrant issued under section 26 of the Misuse of Drugs Act 1977',what:'controlled drugs or evidence described in the warrant'},
  consent:{t:'Consent',sh:'consent',
    trig:'Real consent: informed, voluntary, given by someone with capacity who knows they can refuse.',
    may:['Search only as far as they agreed, for as long as they agree.'],
    pit:['Consent and a statutory power are separate routes — be clear which you are using (McFadden).','Once consent is withdrawn you stop, unless a statutory power independently applies.'],
    scope:'Only what they agreed to — pockets, then bag, then phone each need a fresh yes.',
    say:'“Can I search your [pockets]? You don’t have to agree, and you can stop me at any time.” Note your exact words and their reply.',
    nb:'consent',what:''}
};

/* ---------------- grounds: what the courts accept, and what fails alone ---------------- */
const GROUNDS=[
  ['g1','ok','I saw a hand-to-hand exchange (e.g. a small bag passed for cash)'],
  ['g2','ok','Smell of cannabis from the person, plus furtive concealment'],
  ['g3','ok','Reliable, recent, specific intelligence naming this person'],
  ['g4','ok','A bulge consistent with a weapon, plus a report of a knife'],
  ['g5','ok','They ran on seeing gardaí and discarded something'],
  ['g6','ok','An admission, or an attempt to swallow something'],
  ['g7','maybe','A specific, urgent report that matches this person (description, place, time)'],
  ['g8','maybe','Something else I saw, heard, smelt or was told about this person'],
  ['r1','no','It’s a known area for drugs (Farrell)'],
  ['r2','no','Nervousness, or avoiding eye contact'],
  ['r3','no','An anonymous call with no detail or corroboration'],
  ['r4','no','Their clothing, age, ethnicity or the group they’re with'],
  ['r5','no','Being out late, or being with a known person'],
  ['r6','no','Previous convictions'],
  ['r7','no','A smell of cannabis I can’t pin on one person (crowd, bus)'],
  ['r8','no','Stale or vague intelligence (“he deals”, no recent detail)']];
const GTIP={r1:'Area alone is not reasonable cause (Farrell).',r7:'You can’t attribute it to one person — observe further before searching anyone.',r8:'Corroborate first. Stale, vague intelligence rarely justifies a search.',
  g7:'Act if it’s specific and urgent, but approach tactically and record the report’s detail.',g8:'Only if it’s specific to this person and you can say exactly what it was.'};

/* ---------------- the person ---------------- */
const PEOPLE=[
  ['child','Child (under 18)','Children Act 2001: notify a parent or guardian as soon as practicable after arrest; a parent or guardian should be present for interview unless an exception applies. Strip search a child only where strictly necessary — best practice is a parent or appropriate adult present. Explain simply and search discreetly.','Treating a 16-year-old as an adult; searching in front of peers; no parent contacted.'],
  ['id','Intellectual disability or mental illness','Custody regulations (provision for persons with intellectual disability): appropriate adult, doctor if needed. Explain in simple terms. Consent may not be valid.','Relying on “consent” from someone who can’t give it.'],
  ['drunk','Intoxicated','Their capacity to understand the reason is reduced. Explain again later and record that you did. Medical assessment if in custody.','Searching roughly because they’re uncooperative; no record of the explanation.'],
  ['trans','Transgender or non-binary','Reg 17 says “opposite sex” without defining it. Ask how the person wishes to be searched, follow Garda HQ policy and record the choice.','Assuming from appearance; mocking or exposing the person.'],
  ['relig','Religious dress (hijab, turban, kippah)','Search in private by a member of the same sex; offer to let the person remove the item themselves. Handle it with respect.','Removing headwear in public; treating the item as suspicious in itself.'],
  ['disab','Physical disability or medical device','Adjust the method. Don’t remove prosthetics, colostomy bags or medical devices without medical input.','Damaging equipment; causing pain.'],
  ['lang','Limited English','Use an interpreter for the reason for the search where practicable.','Going ahead without the person understanding why.'],
  ['journo','Journalist (notes or devices)','Searching notes or devices engages source protection (Corcoran v Commissioner [2023] IESC 15).','Seizing phones without flagging privilege.'],
  ['lawyer','Carrying a lawyer’s papers','Legal professional privilege: isolate and don’t read.','Reading documents marked privileged.']];

/* ---------------- the 30 scenarios ---------------- */
const SCEN=[
  [1,'Group of youths at a flats complex known for dealing; no other indicator','No','Area alone isn’t reasonable cause (Farrell). Engage, observe, gather specific grounds.','s23 grounds'],
  [2,'Same group; you see one pass a small bag for cash','Yes — s.23 on that person','Specific observation. Tell him why; search; record what you saw and when.','s23 grounds'],
  [3,'Strong cannabis smell from a car with four occupants','Likely yes for the vehicle and occupants, s.23','Smell plus context can found suspicion. Say which person you suspect and why; don’t search the whole car on autopilot.','s23 vehicle grounds'],
  [4,'Smell of cannabis on a crowded bus','Doubtful','Can’t attribute it to one person. Observe further before searching anyone.','s23 grounds'],
  [5,'Man runs on seeing you and throws something into a bin','Yes','Flight plus discard is specific. Recover the item; s.23 or s.16 FOWA depending on what it appears to be.','s23 fowa16 grounds'],
  [6,'Woman stopped under s.23; you want to strip-search her on the street','No','Strip search only in private, by a member of the same sex, in a station. Arrest, or use s.23(1A) to bring her to the station.','s23 strip samesex'],
  [7,'Male garda alone, female suspect with suspected drugs','Pat-down only if there’s an urgent safety need; otherwise wait','Reg 17 bars an opposite-sex search in custody; on the street, call a female member. Record why any limited search was needed.','samesex s23 custody'],
  [8,'15-year-old suspected of carrying a knife','Yes, s.16 FOWA, with care','Explain simply; search discreetly; contact a parent if detained or arrested; record.','fowa16 people'],
  [9,'Drunk man on O’Connell St, aggressive, no other indicator','No search power','Public order powers (direction, arrest) apply. A search follows a lawful arrest only.','none'],
  [10,'Arrested for s.6 Public Order; the search finds cannabis','Yes','Search incidental to a lawful arrest. The arrest must stand on its own grounds.','arrest'],
  [11,'Arrest made purely to search someone you couldn’t otherwise search','No','Improper purpose: the arrest and the search are both unlawful. Risk of a misconduct finding.','arrest abuse'],
  [12,'During a s.23 search you find a phone and want to read the messages','No','Seize it if it’s evidence; apply for a warrant to examine the contents (Quirke).','phone s23 arrest'],
  [13,'Person agrees to be searched, then says “stop”','Stop, unless a power exists','If grounds exist, state the power and the reason before continuing (O’Donnell).','consent'],
  [14,'“Turn out your pockets or I’ll arrest you” — with no grounds','No','Coerced consent; potential false imprisonment and misconduct.','consent abuse none'],
  [15,'Warrant for a house under MDA s.26; a visitor is present','Yes, under s.26','s.26(2) covers persons found there; s.26(3) allows arrest to search. Other warrants may not — then you need fresh s.23 grounds.','warrant'],
  [16,'Warrant issued by a superintendent involved in the case','Invalid','Damache, Behan. Don’t execute it; get an independent issuer.','warrant'],
  [17,'Warrant silent on devices; a laptop is found','Don’t search the contents','Seize only if lawful; apply for a further warrant naming devices.','warrant phone'],
  [18,'Journalist’s home searched for a leak source','Special care','Disclose the journalist status and the purpose to the judge (Corcoran).','warrant people'],
  [19,'Same person searched by you three nights running, nothing found','Each search needs fresh grounds','The pattern looks like harassment. A supervisor’s review is wise.','abuse grounds s23'],
  [20,'A member of the public films the search','No power to stop the filming','Filming a public search is lawful. Retaliating with a search is abuse.','abuse'],
  [21,'Person in a hijab reasonably suspected of carrying drugs','Yes, with care','Member of the same sex, private place; let her remove the hijab herself if needed.','people s23 samesex'],
  [22,'Trans woman in custody needs searching','Yes','Ask her preference, follow HQ policy, record.','people custody samesex'],
  [23,'Suspect swallowed something on arrest','No internal search','Medical attention immediately; risk of death; record.','cavity arrest custody'],
  [24,'Car stopped at a checkpoint; driver nervous, no other indicator','No search of the person','Nervousness alone isn’t reasonable cause. Road traffic powers don’t extend to a personal search.','vehicle grounds none'],
  [25,'Anonymous call: “man in red jacket has a gun at Dorset St”','Possibly — OASA s.30 (Firearms Acts offences are scheduled), or CLA s.8 if in a vehicle','Specific, urgent and matches the description: act, but approach tactically and record the call’s detail.','oasa30 cla8 grounds'],
  [26,'Informant says the target “deals”, with no recent detail','Weak','Corroborate first. Stale, vague intelligence rarely justifies a search.','grounds s23'],
  [27,'Stolen goods suspected in the DMR, no drugs or weapons','Yes, Dublin Police Act 1842 s.29','Only in the Dublin Metropolitan District. Tell the person the reason.','dpa29'],
  [28,'Same situation in Naas','No s.29 power','Outside the district. Consider arrest for theft or handling (Criminal Justice (Theft and Fraud Offences) Act 2001) if grounds exist.','dpa29 none'],
  [29,'Suspect with a learning disability “agrees” to a search','Consent invalid','Rely on a statutory power or don’t search. Appropriate adult if in custody.','consent people'],
  [30,'During a lawful pat-down you feel a soft package','Proceed only if the power covers it','Under s.23 you may examine it. Under s.16 FOWA (knives and weapons) a soft package is outside the power unless it could be a weapon — form fresh s.23 grounds or stop.','s23 fowa16']];
const SCEN_F=[['all','All'],['s23','Drugs'],['fowa16','Knives'],['grounds','Grounds'],['arrest','Arrest'],['custody','Custody'],['strip','Strip'],['samesex','Same sex'],['people','People'],['warrant','Warrants'],['consent','Consent'],['phone','Phones'],['abuse','Abuse'],['none','No power']];

/* ---------------- the questions ---------------- */
/* ---------------- the quick flow: one tap for what you're searching for, one for your grounds, then the plan ---------------- */
const KINDS=[['drugs','Drugs','s.23 MDA 1977','pill'],['knife','Knife or weapon','s.16 FOWA 1990','swords'],
  ['goods','Stolen goods','s.29 Dublin Police Act','shopping-bag'],['firearm','Firearm or explosives','s.30 OASA 1939','triangle-alert'],
  ['vehicle','Vehicle stop','s.8 CLA 1976 · s.23','car-front'],['arrest','After an arrest','search on arrest','key-round'],
  ['custody','In custody','Reg 17 Custody Regs','door-closed'],['warrant','Search warrant','people on premises','file-check'],
  ['consent','By consent','only if it’s real','hand'],['none','Nothing specific','drink · public order','user-x']];
const Q={
  kind:{q:'What are you searching for?'},
  dmd:{q:'Are you in the Dublin Metropolitan District?',h:'The s.29 power exists only there.',o:[['yes','Yes — in Dublin'],['no','No — outside it (e.g. Naas)']]},
  vwhat:{q:'Why did you stop the vehicle?',h:'A road traffic stop is not a power to search a person.',o:[['rta','Road traffic or checkpoint only'],['drugs','Drugs — in the car or on someone in it'],['listed','Serious offence: firearms, explosives, robbery, burglary, murder…'],['knife','Someone in it has a knife or weapon']]},
  grounds:{multi:1,q:'Your grounds — about this person',h:'Tick what you actually had before the search began.'},
  alawful:{q:'Is the arrest lawful on its own grounds?',h:'Search on arrest depends on a lawful arrest.',o:[['yes','Yes'],['unsure','Not sure'],['pretext','I’d be arresting so I can search them']]},
  warrant:{q:'Which warrant?',h:'Read the warrant and its section: does it cover people?',o:[['s26','Misuse of Drugs s.26 — from a judge or Peace Commissioner'],['dta8','Urgent drugs warrant — from an independent superintendent'],['other','Another search warrant (premises)'],['involved','Issued by a superintendent involved in the case']]},
  consent:{q:'Is the consent real?',h:'Informed, voluntary, from someone with capacity who knows they can refuse.',o:[['ok','Yes — told they can refuse, freely agreed, understands'],['power','I have grounds for a power anyway'],['c1','I haven’t told them they can refuse'],['c2','They may feel they’ve no choice'],['c3','Drunk, a child, impaired, or no English'],['c5','They’ve said stop'],['c6','I’d have to threaten arrest']]}
};
function route(A){ const k=A.kind, r=['kind'];
  if(k==='drugs'||k==='knife'||k==='firearm')r.push('grounds');
  else if(k==='goods'){ r.push('dmd'); if(A.dmd==='yes')r.push('grounds'); }
  else if(k==='vehicle'){ r.push('vwhat'); if(A.vwhat&&A.vwhat!=='rta')r.push('grounds'); }
  else if(k==='arrest')r.push('alawful'); else if(k==='warrant')r.push('warrant'); else if(k==='consent')r.push('consent');
  return r; }
/* optional extras, as chips on the plan — no extra questions */
const ADJ=[['child','Child (under 18)'],['vuln','Learning disability / mental illness'],['drunk','Intoxicated'],['trans','Trans / non-binary'],['relig','Religious dress'],
  ['disab','Disability / medical device'],['lang','Limited English'],['journo','Journalist / lawyer’s papers'],
  ['strip','Strip search needed'],['cavity','Swallowed / hidden inside'],['nosame','No same-sex member here'],['phone','Phone or device found'],['samples','Samples needed']];
const ADJ_P={child:['child'],vuln:['id'],drunk:['drunk'],trans:['trans'],relig:['relig'],disab:['disab'],lang:['lang'],journo:['journo','lawyer']};

/* ---------------- state ---------------- */
let A={}, step=0, mode='guide', scenF='all', root=null;
const adj=x=>(A.adj||[]).includes(x);
function gEval(){ const g=A.grounds||[], t=k=>(GROUNDS.find(x=>x[0]===k)||[])[1];
  if(g.some(k=>t(k)==='ok'))return 'ok'; if(g.some(k=>t(k)==='maybe'))return 'maybe'; return 'no'; }

/* ---------------- the plan ---------------- */
function plan(){
  const k=A.kind, out={power:null,also:[],tone:'ok',title:'',text:'',notes:[],tags:new Set(),stop:false,instead:null};
  const stop=(t,x,i)=>{ out.tone='stop'; out.title=t; out.text=x; out.stop=true; out.instead=i||null; }, warn=(t,x)=>{ if(out.tone!=='stop'){ out.tone='warn'; out.title=t; out.text=x; } };
  if(['drugs','knife','firearm','goods','none','vehicle'].includes(k)){
    const w=k==='vehicle'?A.vwhat:k;
    if(k==='vehicle')out.tags.add('vehicle');
    if(w==='drugs'){ out.power='s23'; if(k==='vehicle')out.notes.push(['Vehicle and occupants','Smell plus context can found suspicion for the vehicle and its occupants. Say which person you suspect and why — don’t search the whole car on autopilot.']); }
    else if(w==='knife')out.power='fowa16'; else if(w==='listed')out.power='cla8';
    else if(w==='firearm'){ out.power='oasa30'; out.also.push('cla8'); }
    else if(w==='goods'){ if(A.dmd==='yes')out.power='dpa29'; else { stop('No s.29 power outside the Dublin Metropolitan District','The Dublin Police Act 1842 s.29 power applies in the Dublin Metropolitan District only.',['Consider arrest for theft or handling (Criminal Justice (Theft and Fraud Offences) Act 2001) if grounds exist — then search on arrest.','Otherwise, don’t search.']); out.tags.add('dpa29'); } }
    else if(w==='none'){ stop('No power to search','“Turn out your pockets” with no statutory trigger is not a power. Public order law gives powers to direct and arrest, not to search.',['Engage, observe and gather specific grounds about this person.','Use the powers you do have (direction, arrest) where they apply.','After a lawful arrest on its own grounds, you can search on arrest.']); out.tags.add('none'); }
    else if(w==='rta'){ stop('No search of the person','A road traffic stop gives no power to search a person unless s.23 grounds separately arise. Nervousness alone is not reasonable cause.',['Deal with the road traffic matter.','If specific drug grounds about a person arise, start again: Vehicle stop → Drugs.']); out.tags.add('none'); }
    if(out.power&&!out.stop){ const g=gEval(); out.tags.add('grounds');
      if(g==='no')stop('No reasonable cause yet — don’t search','On their own, these aren’t reasonable cause. What you find afterwards can’t cure a search that lacked grounds at the start.',['Engage, observe, gather specific grounds about this person.','Corroborate any tip-off or intelligence first.','If specific grounds arise, search then — and record them.']);
      else if(g==='maybe')warn('Possibly enough — be sure before you touch','Only if it’s specific to this person and you can articulate it in the witness box. Corroborate where you can, and record the detail.');
      else { out.title='You can search: '+P[out.power].sh; out.text=''; } }
  } else if(k==='arrest'){
    out.power='arrest'; out.tags.add('arrest');
    if(A.alawful==='pretext')stop('Don’t — that’s an improper purpose','Arrest must never be used as a device to search. The arrest and the search would both be unlawful, with a risk of a misconduct finding.',['Search only under a power you actually have.','If you have no grounds, don’t search.']);
    else if(A.alawful==='unsure')warn('Check the arrest first','An unlawful arrest taints the search and anything found. Be sure of your grounds for the arrest itself, and that you told them the true reason in plain words.');
    else { out.title='You can search on arrest'; out.text=''; }
  } else if(k==='custody'){ out.power='reg17'; out.tags.add('custody'); out.title='You can search in custody — Reg 17'; out.text='Same sex only, with due respect; custody record entry before they move on.'; }
  else if(k==='warrant'){
    const W=A.warrant; out.tags.add('warrant');
    if(W==='involved')stop('Invalid warrant — don’t execute it','The issuer must be independent of the investigation (Damache v DPP [2012] IESC 11; DPP v Behan [2022] IESC 23).',['Get a warrant from an independent issuer.']);
    else if(W==='other'){ warn('The warrant covers the premises, not the people','Other warrants cover premises only. To search a person found there you need a separate power: s.23 MDA on fresh reasonable cause, or arrest.'); }
    else { out.power='mda26'; out.title='People found on the premises are covered'; out.text='A s.26 warrant covers the premises “and any persons found therein”; s.26(3) lets the named member arrest people found there to search them.'+(W==='dta8'?' An urgent superintendent’s warrant lasts 24 hours.':' Valid for one month.'); }
  } else if(k==='consent'){
    const c=A.consent; out.tags.add('consent');
    if(c==='power'){ warn('Use your power, not consent','If you have a statutory power, use it and say so. Consent and a power are separate routes — be clear which one you’re using (McFadden).'); }
    else if(c==='c6'){ stop('Coerced — don’t search','Threatening arrest to get “consent” you couldn’t otherwise get is coercion: potential false imprisonment and misconduct.',['Use a power if you genuinely have grounds — and say so.','Otherwise, don’t search.']); out.tags.add('abuse'); }
    else if(c==='c5')stop('Stop the search','Once consent is withdrawn you stop, unless a statutory power independently applies.',['If you have grounds for a power, tell them the power and the reason before you go on (O’Donnell).','Otherwise, stop.']);
    else if(c&&c!=='ok')stop('That consent isn’t valid','Consent fails where they weren’t told they could say no, felt they had no choice, or lacked the capacity or understanding to agree.',['Rely on a statutory power, or don’t search.']);
    else { out.power='consent'; out.title='Valid consent — stay inside it'; out.text='Stop the moment they withdraw.'; }
  }
  if(out.power)out.tags.add(out.power);
  out.also.forEach(x=>out.tags.add(x));
  /* the optional extras */
  if(adj('phone')){ out.tags.add('phone'); out.notes.push(['Phone or device','Don’t read it. Seize it if it’s evidence and apply for a warrant to examine the contents (Quirke). Search on arrest and street powers don’t authorise searching a phone’s contents.']); }
  if(adj('cavity')){ out.tags.add('cavity'); if(!out.stop){ out.tone='stop'; out.title='No internal search — get medical help'; out.text='Body cavities are not searchable by gardaí — internal examination is a medical procedure. If something was swallowed, get medical attention immediately (risk of death) and record it.'; } }
  else if(adj('strip')){ out.tags.add('strip');
    if(['drugs','knife','firearm','goods','vehicle'].includes(k)&&!out.stop)warn('Strip search: only in a station','In private, by a member of the same sex, in a station. '+(out.power==='s23'?'Use s.23(1A) to require them to come to the station to be searched there, or arrest.':'Arrest if you have grounds, and search in the station.'));
    if(k==='consent'&&!out.stop)warn('A strip search needs a power that extends to it','s.23 MDA, search on arrest, or custody Reg 17 — not consent.'); }
  if(adj('nosame')){ out.tags.add('samesex'); out.notes.push(['No same-sex member here',(k==='custody'||k==='arrest')?'Reg 17 bars a search by a person of the opposite sex (other than a doctor) in custody. Wait for a member of the same sex.':'Pat-down only if there’s an urgent safety need; otherwise wait for a member of the same sex. Record why any limited search was needed.']); }
  if(Object.keys(ADJ_P).some(adj))out.tags.add('people');
  return out; }

/* ---------------- drawing ---------------- */
function sec(title,body,cls){ return '<section class="sp-card'+(cls?' '+cls:'')+'"><h3>'+title+'</h3>'+body+'</section>'; }
const ul=a=>'<ul class="sp-ul">'+a.map(x=>'<li>'+withCases(x)+'</li>').join('')+'</ul>';
const det=(t,b)=>'<details class="sp-det"><summary>'+t+'</summary><div class="sp-detb">'+b+'</div></details>';
function powerBody(k){ const p=P[k]; return '<p><b>'+esc(p.t)+'.</b> '+withCases(p.trig)+'</p><p class="sp-l">What you may do</p>'+ul(p.may)+'<p class="sp-l">Pitfalls</p>'+ul(p.pit)+(p.note?'<p class="sp-dim">'+withCases(p.note)+'</p>':''); }
function notebook(pl){
  const p=P[pl.power]||{}, g=(A.grounds||[]).map(k=>(GROUNDS.find(x=>x[0]===k)||[])[2]).filter(Boolean).filter(t=>!/^Something else/.test(t));
  const L=['On [date] at [time] I was on duty in [uniform / plain clothes] at [exact location]. Lighting: [conditions]. Present: [members].'];
  if(A.kind==='warrant')L.push('I was present at the execution of '+(p.nb||'[the warrant]')+', issued by [issuer] on [date].');
  L.push('Before any search, I saw / heard / smelt / was told the following, in this order: '+(g.length?g.map(x=>'['+x+' — what exactly, where, when]').join('; '):'[what, where, when]')+'.');
  if(pl.power==='consent')L.push('I asked [the person] whether I could search [what] and told them they did not have to agree and could stop me at any time. My words were: “[exact words]”. Their reply was: “[verbatim]”.');
  else if(pl.power){ if(p.what)L.push('I suspected, with reasonable cause, that [the person] had '+p.what+'.');
    L.push('I identified myself and told [the person] in plain words that I was going to search them under '+(p.nb||'[the power]')+' and why. My words were: “[exact words]”. Their reply was: “[verbatim]”.'); }
  L.push('The search was carried out by [name], [sex], at [where — and how private], of [which parts of the body / clothing], from [time] to [time].');
  L.push('Found: [item], [where on the person]. Exhibit [ref], retained by [name] (continuity).');
  L.push('Force used: [none / what and why]. Complaint, injury or distress: [none / details, and what I did].');
  L.push('Body-worn camera: [on / not worn]. PULSE: [ref].'+(A.kind==='custody'||A.kind==='arrest'?' Custody record: [entry made by the member in charge].':''));
  return L.join('\n\n'); }
const row=(l,v)=>'<div class="sp-row"><span>'+l+'</span><div>'+v+'</div></div>';
function resultHtml(){
  const pl=plan(), p=P[pl.power], live=!pl.stop||pl.tags.has('cavity');
  let h='<div class="sp-top"><button type="button" class="sp-btn sm sp-prev">‹ Change</button><button type="button" class="sp-btn sm sp-restart">New search</button></div>';
  h+='<div class="sp-verdict '+pl.tone+'">'+ic(pl.tone==='ok'?'check':pl.tone==='warn'?'triangle-alert':'hand')+'<div><b>'+esc(pl.title)+'</b>'+(pl.text?'<p>'+withCases(pl.text)+'</p>':'')+'</div></div>';
  // the pocket card: everything you need on one screen
  if(p&&live&&!pl.tags.has('cavity')){
    h+='<div class="sp-pocket">'+(pl.tone!=='ok'||pl.also.length?row('Power',esc(p.t)+(pl.also.length?'<small>In or with a vehicle: '+esc(P[pl.also[0]].t)+'</small>':'')):'')
      +row('Say',withCases(p.say)+'<small>Name and station first. They must understand it’s a legal power and why (Rooney).</small>')
      +row('Search for',withCases(p.scope))
      +(pl.power==='s23'||pl.power==='fowa16'||pl.power==='dpa29'?row('Detain','Only as long as the search takes.'+(pl.power==='s23'?' Or require them to come to a station (s.23(1A)).':'')):'')
      +row('Record','Grounds in order · power and your exact words · their reply · who searched, where, how long · finds and continuity.')
      +'</div>';
  } else if(pl.instead||pl.tags.has('cavity')){
    h+='<div class="sp-pocket">'+row('Instead',ul(pl.tags.has('cavity')?['Get medical attention immediately — risk of death if swallowed.','Arrest if you have grounds; use lawful sampling powers.','Record what you saw, when, and what you did.']:pl.instead))+'</div>';
  }
  // the extras, as chips
  const allow=x=>x!=='samples'||A.kind==='custody'||A.kind==='arrest';
  h+='<p class="sp-l">Anything else? Tap to adjust</p><div class="sp-adj">'+ADJ.filter(x=>allow(x[0])).map(([k,l])=>'<button type="button" class="sp-adjc'+(adj(k)?' on':'')+'" data-a="'+k+'" aria-pressed="'+(adj(k)?'true':'false')+'">'+esc(l)+'</button>').join('')+'</div>';
  pl.notes.forEach(([t,x])=>{ h+=sec(esc(t),'<p>'+withCases(x)+'</p>','sp-note'); });
  if(adj('strip')&&!adj('cavity'))h+=sec('Strip search — the rules',ul(['Only if a power extends to it (s.23 MDA, search on arrest, custody Reg 17) and it’s necessary: specific grounds that an item is concealed on the body and a lesser search won’t find it.','Tell the member in charge or your sergeant first.','In a station, in private. By a member of the same sex; best practice, a second same-sex member as witness.','In stages — return each layer before removing the next. No touching of intimate areas: visual inspection only.','Removal of underclothing by a doctor where practicable (Reg 17(4)). Pause and reassess if they’re distressed, intoxicated, injured or vulnerable.']),'sp-warnc');
  const ppl=Object.keys(ADJ_P).filter(adj).flatMap(k=>ADJ_P[k]).map(k=>PEOPLE.find(p=>p[0]===k)).filter(Boolean);
  if(ppl.length)h+=sec('This person — extra care',ppl.map(p=>'<div class="sp-pp"><b>'+esc(p[1])+'</b><p>'+withCases(p[2])+'</p><p class="sp-dim">Common mistake: '+withCases(p[3])+'</p></div>').join(''));
  if(A.kind==='custody'||A.kind==='arrest')h+=sec('In the station','<p>Tell the member in charge and make sure the custody record entry is made before the prisoner moves on.</p>'+(A.kind==='custody'?ul(P.reg17.pit):''));
  if(adj('samples')&&allow('samples'))h+=sec('Samples — Forensic Evidence Act 2014',samplesHtml());
  // the detail, folded away
  if(p&&!(pl.stop&&!pl.tags.has('cavity')))h+=det('The power in full — and its pitfalls',powerBody(pl.power)+pl.also.map(x=>'<p class="sp-l">If they’re in or with a vehicle</p>'+powerBody(x)).join(''));
  if(pl.tags.has('grounds')&&(A.grounds||[]).length)h+=det('Your grounds',(A.grounds||[]).map(k=>{ const g=GROUNDS.find(x=>x[0]===k); return g?'<div class="sp-g '+g[1]+'"><b>'+(g[1]==='ok'?'Specific':g[1]==='maybe'?'Possibly':'Not on its own')+'</b> — '+withCases(g[2])+(GTIP[k]?'<span>'+withCases(GTIP[k])+'</span>':'')+'</div>':''; }).join('')
    +'<p class="sp-dim">Not reasonable cause on their own: area reputation (Farrell), nervousness, an anonymous call with no detail, clothing, age, ethnicity or group, being out late or with a known person, previous convictions, stale intelligence. The test is objective: would a reasonable garda, knowing what you knew then, have suspected?</p>');
  if(live)h+=det('Notebook draft — copy into your notes','<p class="sp-dim">Fill the brackets with what actually happened, at the time. Never add grounds after the fact.</p><textarea class="sp-nb" readonly rows="9">'+esc(notebook(pl))+'</textarea><button type="button" class="sp-btn sp-copy">'+ic('clipboard-list')+'Copy the draft</button>'
    +'<p class="sp-l">Body-worn camera</p><p>Activate it before the search, say the power and the reason out loud, and check the Code of Practice before recording during a strip search.</p>');
  const sc=SCEN.map(s=>[s,s[4].split(' ').filter(t=>pl.tags.has(t)).length]).filter(x=>x[1]).sort((a,b)=>b[1]-a[1]||a[0][0]-b[0][0]).slice(0,6).map(x=>x[0]);
  if(sc.length)h+=det('Similar situations',sc.map(scenRow).join(''));
  h+=det('The 60-second check',ul(CHECK60));
  h+='<p class="sp-law">'+ic('scale')+'<span><b>Law in transition.</b> The Garda Síochána (Powers) Bill 2026 would codify stop-and-search, a right to be told the reason and a written record of every search. Not law yet — re-check this guide when it’s commenced.</span></p>';
  return h; }

const REC=['Date, time, exact location, lighting, who was present.','What you saw, heard, smelt or were told — in sequence, before the search began.','The power used (Act and section) and the words you used to tell the person.','Their reply, verbatim where possible.','Who searched, the sex of the searcher, where on the body, how long.','What was found, where, and the continuity of each exhibit.','Any force used, and why.','Any complaint, injury or distress, and what you did.','PULSE entry and, if in custody, the custody record entry.'];
const CHECK60=['Which Act and section?','What specific facts about this person ground my suspicion?','Have I told them, in plain words, the power and why?','Is this the least intrusive way? Is the location private enough?','Is a same-sex member available? Is the person vulnerable?','Am I staying within what the power lets me search for?','Am I recording it now?'];
function samplesHtml(){ return '<div class="sp-tw"><table class="sp-t"><thead><tr><th>Type</th><th>Examples</th><th>Consent?</th><th>Authorisation</th></tr></thead><tbody>'
  +'<tr><td><b>Intimate</b></td><td>Blood, pubic hair, urine, swab from the genital area or a body orifice other than the mouth, dental impression</td><td>Written consent of the detained adult; for a child, the child’s and a parent’s consent or a District Court order</td><td>Inspector or above, with reasonable grounds. Refusal without good cause can support an adverse inference if the person was warned in plain language and had the chance to consult a solicitor.</td></tr>'
  +'<tr><td><b>Non-intimate</b></td><td>Saliva / mouth swab, hair other than pubic hair, nail or material under a nail, footprint or skin impression</td><td>Not required</td><td>Inspector or above for investigation samples; sergeant or above for a DNA database sample. Reasonable force needs a superintendent’s authorisation, an inspector present, electronic recording — and never on a child under 12.</td></tr>'
  +'</tbody></table></div><p class="sp-dim">Inferences can’t be the sole or main basis for a conviction. Check the Act’s current text before taking any sample. Record everything: reason, power, authorising member, who was present, sex of each, times, items found, the person’s demeanour and any complaint.</p>'; }
function scenRow(s){ const y=/^(No|Invalid|Don’t|Consent invalid)/.test(s[2])?'no':/^Yes/.test(s[2])?'yes':'mid';
  return '<div class="sp-sc"><span class="sp-scn">'+s[0]+'</span><div><b>'+withCases(s[1])+'</b><span class="sp-scv '+y+'">'+withCases(s[2])+'</span><p>'+withCases(s[3])+'</p></div></div>'; }

/* ---------------- the full reference (every section of the guide) ---------------- */
function refHtml(){
  const D=(t,b,open)=>'<details class="sp-ref"'+(open?' open':'')+'><summary>'+t+'</summary><div class="sp-refb">'+b+'</div></details>';
  const pt=k=>{ const p=P[k]; return '<div class="sp-pr"><b>'+esc(p.t)+'</b><p><i>Trigger:</i> '+withCases(p.trig)+'</p><p><i>What you may do:</i> '+p.may.map(withCases).join(' ')+'</p><p><i>Pitfalls:</i> '+p.pit.map(withCases).join(' ')+(p.note?' '+withCases(p.note):'')+'</p></div>'; };
  let h='';
  h+=D('1. The baseline: every search needs a lawful key','<p>A search of the person is a trespass and an assault unless a specific legal power, valid consent, or a lawful arrest authorises it. Irish law has no general power to stop and search. Each power is tied to a statute, an offence and a threshold of suspicion.</p><p class="sp-l">Rights engaged on every search</p>'
    +ul(['Art 40.3 — bodily integrity, privacy and dignity (unenumerated personal rights).','Art 40.4 — personal liberty. Detaining someone to search is a deprivation of liberty, however brief.','Art 40.5 — inviolability of the dwelling (search warrants, entry).','ECHR Art 8 — private life. In Gillan and Quinton v UK [2010] ECHR 28 the Strasbourg court held suspicionless stop-and-search powers weren’t sufficiently circumscribed or safeguarded against abuse, so weren’t “in accordance with the law”. A search in public can be worse, not better, because of the humiliation.','ECHR Art 5 (liberty) and Art 3 (degrading treatment — relevant to strip and intimate searches).'])
    +'<p><b>Law in transition.</b> The Garda Síochána (Powers) Bill 2026 would codify stop-and-search, create a statutory right to be told the reason for a search, and require a written record of every search. It cleared the Seanad on 17 June 2026 and had its Dáil Second Stage in September 2026. It is not law yet.</p><p class="sp-say">The single question for every search: under what power, on what grounds, did I search this person — and can I prove both in the witness box?</p>',true);
  h+=D('2. Five rules for every search',ul(['Identify the power before you touch. Know the Act and section. A search “on general principles” is unlawful.','Have reasonable cause — specific to this person. In DPP (Higgins) v Farrell [2009] IEHC 368 a garda stopped a car under s.23 because Neilstown had a drugs problem: general knowledge of an area wasn’t reasonable cause, and the search was unlawful (Farrell).','Tell the person, in plain terms, why. In DPP v Rooney [1992] 2 IR 7 (Dublin Police Act 1842 s.29) and DPP v O’Donnell [1995] 3 IR 551 (OASA s.30) a compulsory search was held unlawful unless the person is told the legal basis before it proceeds (Rooney; O’Donnell). You needn’t quote the section, but they must understand they’re being searched under a legal power and broadly why. In DPP v Kelly [2012] IECCA 71 the CCA held there’s no duty to explain where the person doesn’t object — don’t rely on that; always tell them.','Search for what the power allows, and stop there.','Proportion and dignity: least intrusive method, briefest detention reasonably necessary, a private place where intrusion increases. The Code of Ethics requires respect for dignity and human rights in every interaction.'])
    +'<p class="sp-l">Reasonable cause — what courts accept and reject</p><div class="sp-tw"><table class="sp-t"><thead><tr><th>Accepted (combined, articulated)</th><th>Rejected (alone)</th></tr></thead><tbody>'
    +[['Observed hand-to-hand exchange in a known dealing spot','“Known area for drugs” (Farrell)'],['Smell of cannabis from the person + furtive concealment','Nervousness or refusing eye contact'],['Reliable, recent, specific intelligence naming the person','Anonymous call with no detail or corroboration'],['Bulge consistent with a weapon + report of a knife','Clothing, age, ethnicity, group membership'],['Flight on sight of gardaí + discarding an object','Being out late, or being with a known person only'],['Admission or attempted swallowing','Previous convictions alone']].map(r=>'<tr><td>'+withCases(r[0])+'</td><td>'+withCases(r[1])+'</td></tr>').join('')
    +'</tbody></table></div><p>The test is objective: would a reasonable garda, knowing what you knew at that moment, have suspected? What you find afterwards can’t cure a search that lacked grounds at the start.</p>');
  h+=D('3. Stop-and-search powers without a warrant','<p class="sp-dim">The common ones on a DMR North Central shift. Verify the current revised text on revisedacts.lawreform.ie before relying on a subsection.</p>'+['s23','dpa29','fowa16','cla8','oasa30'].map(pt).join('')
    +'<div class="sp-pr"><b>Criminal Law Act 1976, s.7</b><p><i>Trigger:</i> a person in s.30 OASA custody.</p><p><i>What you may do:</i> search, photograph, fingerprint, swab for firearms or explosives residue.</p><p><i>Pitfalls:</i> only in that custody — not general custody.</p></div>'
    +pt('arrest')+'<p><b>Not a power:</b> “Turn out your pockets” with no statutory trigger. Public order legislation (Criminal Justice (Public Order) Act 1994) gives powers to direct and arrest, not a general power to search. A road traffic stop gives no power to search a person for drugs unless s.23 grounds separately arise.</p><p><b>Pending:</b> the Powers Bill 2026 would replace many of these with a general power to stop and search for a “relevant article” on reasonable grounds, plus a written record of every search.</p>');
  h+=D('4. Search on arrest and in custody','<p>A lawful arrest carries a common law power to search the arrested person and seize evidence. In DPP v McFadden [2003] 2 IR 105 the CCA restated that power, drawing on Jennings v Quinn [1968] IR 305: police may seize property found on an arrested person where it is evidence of the offence charged or another offence, and it’s needed to prevent its loss or destruction.</p><p class="sp-l">Limits</p>'+ul(P.arrest.pit)
    +'<p class="sp-l">In the station — Custody Regulations 1987, Reg 17</p>'+ul(P.reg17.may.concat(P.reg17.pit))+'<p>The member in charge is responsible for the custody record. If you search in the station, tell the member in charge and make sure the entry is made before the prisoner moves on.</p>');
  h+=D('5. Strip searches and intimate samples','<p>A strip search is the most intrusive search a garda routinely carries out. It engages Art 40.3, ECHR Art 3 and Art 8. Treat it as exceptional and justify each step.</p><p class="sp-l">Before you start</p>'+ul(['Is there a power that extends to it? (s.23 MDA, search on arrest, custody Reg 17.) A street pat-down doesn’t become a strip search in a lane.','Is it necessary? Specific grounds that an item is concealed on the body and a lesser search won’t find it.','Inform the member in charge or your sergeant before you start. There is no statutory rank authorisation yet; amendments to require one were tabled during the Powers Bill debates.'])
    +'<p class="sp-l">Conducting it</p>'+ul(['In a station, in private, out of public view.','By a member of the same sex (Reg 17(2) in custody). Best practice: a second same-sex member present as witness.','Best practice: remove upper and lower clothing in stages, returning each layer before removing the next.','No touching of intimate areas. Visual inspection only.','Removal of underclothing to be carried out by a doctor where practicable (Reg 17(4)).','If the person is distressed, intoxicated, injured or vulnerable, pause and reassess.'])
    +'<p><b>Body cavities are not searchable by gardaí.</b> Internal examination is a medical procedure. If concealment internally is suspected, arrest, seek medical attention, and use lawful sampling powers. Forcing such an examination is assault, possibly sexual assault, and an Art 3 breach.</p><p class="sp-l">Samples — Criminal Justice (Forensic Evidence and DNA Database System) Act 2014</p>'+samplesHtml());
  h+=D('6. Vulnerable persons and special categories','<p>The power is the same; the care required is higher. Most complaints and exclusions arise here.</p>'+PEOPLE.map(p=>'<div class="sp-pp"><b>'+esc(p[1])+'</b><p>'+withCases(p[2])+'</p><p class="sp-dim">Common mistakes: '+withCases(p[3])+'</p></div>').join('')
    +'<p><b>Profiling.</b> Selecting people for search on race, ethnicity, Traveller identity, religion, gender or appearance is unlawful discrimination and a disciplinary matter. It is also a clear Art 14 ECHR risk when combined with Art 8.</p>');
  h+=D('7. Warrants: persons, premises and devices','<p>A warrant is only as good as the information behind it and the independence of who issued it.</p><p class="sp-l">The case law spine</p>'+ul(['Damache v DPP [2012] IESC 11 — OASA s.29(1) was unconstitutional because it let a superintendent connected to the investigation issue a warrant. The issuer must be independent and assess the competing interests judicially.','DPP v Behan [2022] IESC 23 — a superintendent issuing an urgent warrant under the Criminal Justice (Search Warrants) Act 2012 wasn’t independent of the investigation. The statutory independence requirement is applied strictly.','DPP v Owens [1999] IESC 107 — the issuer’s state of mind matters; a warrant doesn’t prove itself.','DPP v Quirke [2023] IESC 5 — a computer is not a “place”. Seizing devices for later digital search is unlawful unless the sworn information told the judge devices would be seized and searched (Quirke).','Corcoran v Commissioner [2023] IESC 15 — the judge must be told plainly if the target is a journalist and the search aims at sources. Non-disclosure voided the warrant.'])
    +'<p class="sp-l">Searching people found on premises</p><p>'+withCases(P.mda26.trig)+' '+P.mda26.may.map(withCases).join(' ')+' '+withCases(P.mda26.pit[0])+'</p><p>Other warrants cover premises only. Read the warrant and the enabling section. If it doesn’t cover persons, you need a separate power (s.23 MDA on fresh reasonable cause, or arrest).</p>'
    +'<p class="sp-l">Execution checklist</p>'+ul(['Warrant in hand, within its validity period, correct address and premises description.','Have the warrant with you; show it on request and explain its purpose.','Search only for what it describes; note anything found in plain view under a separate lawful power.','Devices: covered expressly? If not, seize only where lawful and apply for a separate warrant to search the contents.','Privilege claims: isolate the material, don’t read it, seek directions.','Record times, members, items, the occupants’ responses.']));
  h+=D('8. Consent searches','<p>Consent is a valid basis only if it is real: informed, voluntary, and given by someone with capacity who knows they can refuse. In McFadden the prosecution relied on consent to justify searching a wallet; the analysis shows consent and a statutory power are separate routes, and you must be clear which you are using.</p><p class="sp-l">Consent fails where</p>'
    +ul(['The person wasn’t told they could say no.','They agreed because they believed they had no choice (“I’m going to search you, OK?” is an order, not a question).','They were drunk, a child, intellectually impaired, or didn’t understand English.','The search went beyond what they agreed to (pockets, then bag, then phone).','They withdrew consent and you continued. Once withdrawn, you stop unless a statutory power independently applies.'])
    +'<p><b>Best practice:</b> if you have a statutory power, use it and say so. Use consent only where no power exists, and record the words used, the reply, and that the right to refuse was explained.</p><p><b>Trap:</b> starting on consent, then switching to a power when the person objects. O’Donnell shows this can be saved only if, at the point of objection, you tell them the legal basis before continuing. Without that, everything after the objection is at risk.</p>');
  h+=D('9. When the search goes wrong: the exclusionary rule','<p>Since DPP v JC [2015] IESC 31, evidence obtained in breach of constitutional rights is admissible if the prosecution proves the breach arose from inadvertence or from a later change in the law. A deliberate and conscious breach still means exclusion (JC).</p><p class="sp-l">How it developed</p>'
    +ul(['People v O’Brien [1965] IR 142 — exclude only for deliberate and conscious breach (O’Brien).','DPP v Kenny [1990] 2 IR 110 — near-automatic exclusion unless extraordinary excusing circumstances; warrant invalid because the peace commissioner didn’t inquire into the garda’s grounds (Kenny).','Damache [2012] — warrants under OASA s.29 struck down, leaving many cases with unconstitutionally obtained evidence.','JC [2015] — a 4:3 majority overrules Kenny. Clarke J’s test: inadvertence saves evidence; knowing or reckless breach doesn’t. Hardiman J, dissenting, warned it removed judicial oversight of the gardaí.'])
    +'<p class="sp-l">What “deliberate and conscious” means in practice</p>'+ul(['You knew, or should have known, you had no power. Gross negligence and systemic disregard count against you.','Ignorance of settled law is not inadvertence. A probationer is expected to know s.23 requires suspicion specific to the person.','Inadvertence covers genuine errors, e.g. a warrant later found defective through a drafting slip you couldn’t detect, or law that changed after the search.'])
    +'<p>Breaches of legal (not constitutional) rules — e.g. custody regulations — go to the trial judge’s discretion to exclude in the interests of fairness. Repeated or flagrant breaches still lose cases.</p><p><b>Knock-on effects:</b> an unlawful search can taint the arrest, detention, interview, samples and admissions that followed. DPP v Cash [2010] IESC 1 held that the lawfulness of an arrest and the admissibility of evidence at trial are separate questions (Cash). The safest view: one bad search can collapse an entire file.</p>');
  h+=D('10. Abuse of power: what it looks like and what follows','<p>Abuse is using a lawful power for an improper purpose, or acting with no power while pretending to have one. Good faith doesn’t make an unlawful search lawful, but bad faith turns a mistake into misconduct.</p><p class="sp-l">Forms of abuse</p>'
    +ul(['Pretext searches — using s.23 to harass, gather intelligence, or “move on” someone you have no grounds against.','Repeat targeting — searching the same person every shift without fresh grounds.','Humiliation — searching in public when privacy was possible; prolonged exposure; comments about the body.','Retaliation — searching someone because they filmed you, complained, or were rude.','Profiling — selection on race, Traveller identity, religion, appearance or class.','Planting or fabrication — adding grounds after the fact, or writing notes to fit what was found.','Coercion — threatening arrest to obtain “consent” you know you couldn’t otherwise get.','Excess force — more than reasonably necessary to carry out a lawful search.','Sexualised conduct — any touching of intimate areas beyond what a lawful search strictly requires.','Phone browsing — reading messages or photos without a warrant or statutory authority.'])
    +'<p class="sp-l">Consequences for the member</p><div class="sp-tw"><table class="sp-t"><thead><tr><th>Route</th><th>Basis</th><th>Possible outcome</th></tr></thead><tbody>'
    +[['Criminal','Assault (NFOAPA 1997 ss.2–3); false imprisonment (s.15); sexual assault; corruption-in-office offence (Criminal Justice (Corruption Offences) Act 2018) where an improper advantage is involved; perverting the course of justice for fabrication','Prosecution, conviction, dismissal'],
      ['Oversight','Fiosrú – Office of the Police Ombudsman (replaced GSOC on 2 April 2025 under the Policing, Security and Community Safety Act 2024)','Complaint investigation, criminal or disciplinary referral'],
      ['Discipline','Garda conduct regulations; CJA 1984 s.7(4) for custody regulation breaches; Code of Ethics','Reprimand to dismissal; probation not confirmed'],
      ['Civil','Trespass to the person, assault, false imprisonment, breach of constitutional rights. In 2019 Ennis Circuit Court awarded €30,000 to a man drug-searched at 13 after a GSOC report found the search unlawful and without reasonable suspicion','Damages against the State and potentially the member'],
      ['Evidential','Exclusion under JC; acquittal; adverse judicial comment','Case collapses; credibility damaged in future cases']].map(r=>'<tr>'+r.map(c=>'<td>'+withCases(c)+'</td>').join('')+'</tr>').join('')
    +'</tbody></table></div><p><b>For a probationer:</b> a sustained finding about a search can block confirmation of appointment. Write it up honestly at the time; a correct record of an imperfect search protects you more than a perfect record nobody believes.</p>');
  h+=D('11. The scenario matrix','<p class="sp-dim">Each scenario changes one or two variables. The right answer turns on the power, the grounds and the person.</p>'+SCEN.map(scenRow).join(''));
  h+=D('12. Recording the search','<p>If it isn’t written down, a court will assume the grounds didn’t exist. Your notebook is the search’s defence. Write at the time, or as soon as practicable:</p>'+ul(REC)
    +'<p><b>Body-worn cameras.</b> The Garda Síochána (Recording Devices) Act 2023 governs body-worn cameras. They were trialled at Store Street, Pearse Street and Kevin Street, among others, and a Code of Practice went to public consultation in December 2025 ahead of national rollout. If you wear one: activate before the search, say aloud the power and reason, and check the Code of Practice before recording anything during a strip search.</p><p><b>Coming:</b> the Powers Bill 2026 would make a written record of every stop and search a statutory requirement, including reason and outcome. Building that habit now costs nothing.</p>');
  h+=D('13. Quick reference and case law','<p class="sp-l">The 60-second check before any search</p>'+ul(CHECK60)+'<p class="sp-l">Case law</p><div class="sp-tw"><table class="sp-t"><thead><tr><th>Case</th><th>Point</th></tr></thead><tbody>'
    +[['People v O’Brien [1965] IR 142','Original deliberate-and-conscious test','O\'Brien'],['DPP v Kenny [1990] 2 IR 110','Strict exclusion; overruled by JC','Kenny'],['DPP v Rooney [1992] 2 IR 7','Inform the person of the reason for a stop and search','Rooney'],['O’Callaghan v Ireland [1994] 1 IR 555','s.23 MDA search power constitutional; an extension of arrest on suspicion'],['DPP v O’Donnell [1995] 3 IR 551','Inform of the legal basis before a compulsory search; acquiescence then objection',"O'Donnell"],['DPP v Owens [1999] IESC 107','Issuer of a warrant must prove state of mind','Owens'],['DPP v McFadden [2003] 2 IR 105','Search on arrest; consent vs power'],['Devoy v Ireland [2004] IEHC 404','s.26 MDA power to search persons on premises upheld'],['DPP (Higgins) v Farrell [2009] IEHC 368','Area reputation is not reasonable cause','Farrell'],['Gillan and Quinton v UK [2010] ECHR 28','Suspicionless search breaches Art 8'],['DPP v Cash [2010] IESC 1','Lawfulness of arrest and admissibility of evidence are separate','Cash'],['Damache v DPP [2012] IESC 11','Warrant issuer must be independent','Damache'],['DPP v Kelly [2012] IECCA 71','No duty to explain the power where the person does not object'],['DPP v JC [2015] IESC 31','Current exclusionary rule: inadvertence test','JC'],['DPP v Behan [2022] IESC 23','2012 Act independence applied strictly'],['DPP v Quirke [2023] IESC 5','Devices need express judicial authorisation','Quirke'],['Corcoran v Commissioner [2023] IESC 15','Journalistic privilege must be disclosed']]
      .map(r=>'<tr><td>'+(r[2]&&CASE[r[2]]?'<button type="button" class="sp-case" data-n="'+esc(CASE[r[2]])+'">'+esc(r[0])+'</button>':esc(r[0]))+'</td><td>'+esc(r[1])+'</td></tr>').join('')+'</tbody></table></div><p class="sp-dim">Underlined cases are in your case library — tap to open.</p>');
  h+=D('Sources and checking','<p>'+esc(CHECKED)+'</p>'+ul(['Garda Síochána (Powers) Bill 2026 — Oireachtas','Dáil Business Committee report, 16–17 Sept 2026','Misuse of Drugs Act 1977 s.23 and s.26 (revised)','Firearms and Offensive Weapons Act 1990 (revised)','Criminal Law Act 1976 s.7 and s.8 (revised)','Dublin Police Act 1842 s.29','Custody Regulations, Reg 17 — PQ answer','Forensic Evidence Act 2014 summary — legalblog.ie','O’Callaghan v Ireland; Devoy v Ireland; DPP v Kelly; DPP v O’Donnell; DPP (Higgins) v Farrell','DPP v Cash — Irish Times; DPP v JC — Verfassungsblog; Damache v DPP — Irish Times; DPP v Behan — CaseMine; DPP v Quirke — Irish Legal News; Corcoran — Irish Times','Gillan and Quinton v UK — 5RB','€30,000 award over unlawful search of 13-year-old — Irish Times','Fiosrú established 2 April 2025','Body-worn camera Code of Practice consultation — Garda.ie'])
    +'<p class="sp-dim">From your guide “Searching the Person — Garda Powers, Limits & Pitfalls” (27 October 2026). Independent reference — not legal advice.</p>');
  return h; }
function scenHtml(){
  return '<div class="sp-chips">'+SCEN_F.map(([k,l])=>'<button type="button" class="chip'+(scenF===k?' on':'')+'" data-sf="'+k+'">'+esc(l)+'</button>').join('')+'</div>'
    +'<div class="sp-scl">'+SCEN.filter(s=>scenF==='all'||s[4].split(' ').includes(scenF)).map(scenRow).join('')+'</div>'; }

function questionHtml(){
  const r=route(A), k=r[step];
  if(!k)return resultHtml();
  if(k==='kind')return '<h3 class="sp-q">What are you searching for?</h3><div class="sp-kinds">'
    +KINDS.map(([v,l,s,i])=>'<button type="button" class="sp-kind'+(A.kind===v?' on':'')+(v==='none'?' none':'')+'" data-v="'+v+'">'+ic(i)+'<b>'+esc(l)+'</b><small>'+esc(s)+'</small></button>').join('')+'</div>';
  const q=Q[k], cur=A[k];
  let h=(step>0?'<button type="button" class="sp-link sp-prev">‹ Back</button>':'')+'<h3 class="sp-q">'+esc(q.q)+'</h3>'+(q.h?'<p class="sp-h">'+withCases(q.h)+'</p>':'');
  if(k==='grounds'){
    const g=A.grounds||[];
    h+='<div class="sp-chipsg">'+GROUNDS.filter(x=>x[1]!=='no').map(x=>'<button type="button" class="sp-gc'+(g.includes(x[0])?' on':'')+(x[1]==='maybe'?' maybe':'')+'" data-g="'+x[0]+'" aria-pressed="'+(g.includes(x[0])?'true':'false')+'">'+esc(x[2])+'</button>').join('')+'</div>'
      +'<button type="button" class="sp-gc gen'+(g.includes('gen')?' on':'')+'" data-g="gen" aria-pressed="'+(g.includes('gen')?'true':'false')+'">Only general things — the area, nervousness, their record, how they look, a vague tip-off</button>'
      +'<button type="button" class="sp-btn pri sp-go"'+(g.length?'':' disabled')+'>Show the plan ›</button>';
    return h; }
  h+='<div class="sp-opts">'+q.o.map(o=>'<button type="button" class="sp-opt'+(cur===o[0]?' on':'')+'" data-v="'+esc(o[0])+'">'+esc(o[1])+'</button>').join('')+'</div>';
  return h; }

function draw(keep){
  if(!root||!root.isConnected)return;
  const main=root.querySelector('#spMain'), v=document.getElementById('view'), y=v?v.scrollTop:0;
  root.querySelectorAll('.sp-tabs button').forEach(b=>b.classList.toggle('on',b.dataset.m===mode));
  main.innerHTML=mode==='guide'?questionHtml():mode==='ref'?refHtml():scenHtml();
  wire(main); if(keep&&v)v.scrollTop=y; }
function next(){ const nr=route(A); Object.keys(A).forEach(x=>{ if(x!=='adj'&&!nr.includes(x)&&x!=='kind')delete A[x]; }); step=Math.min(step+1,nr.length); draw(); scrollTop(); }
function wire(main){
  main.querySelectorAll('.sp-case').forEach(b=>b.addEventListener('click',e=>{ e.preventDefault(); e.stopPropagation(); if(typeof window.openCase==='function')window.openCase(b.dataset.n); }));
  main.querySelectorAll('.sp-kind').forEach(b=>b.addEventListener('click',()=>{ const v=b.dataset.v; if(A.kind!==v)A={kind:v,adj:A.adj||[]}; step=0; next(); }));
  main.querySelectorAll('.sp-opt').forEach(b=>b.addEventListener('click',()=>{ const k=route(A)[step]; A[k]=b.dataset.v; next(); }));
  main.querySelectorAll('.sp-gc').forEach(b=>b.addEventListener('click',()=>{ const v=b.dataset.g; let g=(A.grounds||[]).slice();
    if(g.includes(v))g=g.filter(x=>x!==v); else g=v==='gen'?['gen']:g.filter(x=>x!=='gen').concat(v);
    A.grounds=g; draw(true); }));
  const go=main.querySelector('.sp-go'); if(go)go.addEventListener('click',()=>{ step=route(A).length; draw(); scrollTop(); });
  main.querySelectorAll('.sp-adjc').forEach(b=>b.addEventListener('click',()=>{ const k=b.dataset.a; let a=(A.adj||[]).slice(); a=a.includes(k)?a.filter(x=>x!==k):a.concat(k);
    if(k==='cavity'&&a.includes('cavity'))a=a.filter(x=>x!=='strip'); if(k==='strip'&&a.includes('strip'))a=a.filter(x=>x!=='cavity'); A.adj=a; draw(true); }));
  main.querySelectorAll('.sp-prev').forEach(b=>b.addEventListener('click',()=>{ back(); }));
  main.querySelectorAll('.sp-restart').forEach(b=>b.addEventListener('click',()=>{ A={}; step=0; draw(); scrollTop(); }));
  const cp=main.querySelector('.sp-copy'); if(cp)cp.addEventListener('click',()=>{ const ta=main.querySelector('.sp-nb'), t=ta.value;
    const ok=()=>{ if(window.grToast)grToast('Copied — paste it into your notes'); };
    const fb=()=>{ ta.removeAttribute('readonly'); ta.select(); try{ document.execCommand('copy'); }catch(e){} ta.setAttribute('readonly',''); ok(); };
    if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(t).then(ok,fb); else fb(); });
  main.querySelectorAll('[data-sf]').forEach(b=>b.addEventListener('click',()=>{ scenF=b.dataset.sf; draw(true); }));
}
function scrollTop(){ const v=document.getElementById('view'), m=root&&root.querySelector('#spMain'); if(v&&m){ const y=m.getBoundingClientRect().top-v.getBoundingClientRect().top+v.scrollTop-10; v.scrollTop=Math.max(0,y); } }
function back(){ if(mode!=='guide'){ mode='guide'; draw(); return true; } if(step>0){ step--; draw(); scrollTop(); return true; } return false; }

function renderSearchPerson(){
  const view=document.getElementById('view');
  view.innerHTML='<div id="sp" class="sp"><h2 class="sec">'+ic('user-search')+'Search of the person</h2>'
    +'<p class="sp-intro">Two taps to your plan. Nothing is saved.</p>'
    +'<div class="sp-tabs" role="tablist"><button type="button" data-m="guide">Quick plan</button><button type="button" data-m="ref">Full guide</button><button type="button" data-m="scen">30 scenarios</button></div>'
    +'<div id="spMain"></div><p class="sp-foot">From your guide “Searching the Person — Garda Powers, Limits & Pitfalls” (27 Oct 2026). Independent reference — not an official Garda system, not legal advice.</p></div>';
  root=view.querySelector('#sp');
  root.querySelectorAll('.sp-tabs button').forEach(b=>b.addEventListener('click',()=>{ mode=b.dataset.m; draw(); }));
  draw(); view.scrollTop=0; }
window.renderSearchPerson=renderSearchPerson;
// Android back: step back through the questions before leaving the guide
window.GRSP={back:()=>{ const v=document.getElementById('view'); if(!root||!root.isConnected||!v||!v.contains(root))return false; return back(); },
  _plan:()=>plan(),_set:(a,s)=>{ A=a||{}; step=s==null?route(A).length:s; draw(); },_route:()=>route(A)};
})();
