/* Assisting — search worker. One BM25 index over every passage of reference content in the app: manual pages,
   case law, guides, offence cards, statement guides, templates, stencils, quick-reference cards, the A–Z index,
   plus first aid, toolbox and app help sent in by the page. Personal data (notes, tasks, patrols, recordings,
   roster) is never indexed. Runs off the main thread so typing never stutters. */
'use strict';

const STOP=new Set(('a an and are as at be been being but by can could did do does doing done for from had has have having he her hers him his how '+
 'i if in into is it its itself me my no nor not of on or our ours she should so than that the their theirs them then there these they this those '+
 'to too us was we were what when where which while who whom whose why will with would you your yours yourself am any all also about after again '+
 'against before below between both during each few further here more most other own same some such through until up very just get got gets '+
 'may might must shall im ive id youre dont doesnt didnt cant cannot wont isnt arent wasnt someone something anyone anything tell know need '+
 'want please thanks like way ok okay yes long many much often').split(' '));

/* concept groups: a query word also scores (at 0.6) on its group mates */
const SYNG=[
 ['garda','gardai','guard','police'],['arrest','apprehend'],['detention','detain','custody','prisoner'],
 ['assault','attack','harm'],['theft','steal','stole','stolen','shoplifting','shoplifter','larceny'],
 ['burglary','burglar','housebreaking'],['robbery','rob','mugging','mug'],
 ['drug','cannabis','cocaine','heroin','controlled'],['knife','blade','bladed','weapon'],
 ['firearm','gun','shotgun','pistol','ammunition','rifle'],['car','vehicle','motor','mpv'],
 ['drink','drunk','intoxicated','intoxicant','alcohol','breath','evidenzer'],
 ['statement','memo','memorandum','deposition'],['interview','questioning','interrogation'],
 ['bail','remand','recognisance','surety'],['child','children','juvenile','minor','youth','teenager'],
 ['cctv','footage','camera','video'],['harassment','stalking','coercive'],['rape','sexual','defilement'],
 ['fraud','deception','counterfeit','forgery','forged'],['damage','vandalism','graffiti'],
 ['immigration','visa','passport','deportation'],['collision','crash','accident','rtc'],
 ['scooter','escooter'],['identification','identify','advokate','parade'],['inference','silence'],
 ['overdose','opioid','naloxone'],['caution','cautioned'],['solicitor','lawyer'],['phone','mobile','smartphone'],
 ['cja','justice'],['mda','misuse'],['rta','traffic'],['nfoapa','fatal'],['oasa','state'],
 ['fit','seizure','convulsion'],['unconscious','unresponsive'],['bleed','bleeding','haemorrhage','blood']
];
const K1=1.2, B=0.75;
const TABLEY=/Tables|Master Index|Statutory Anchors|Consolidated Evidence Reference|Back Matter/i;
const PRIOR={page:1,case:1,guide:1.1,off:1.25,sg:1.1,tpl:1,sten:1,kb:1.1,ops2:1.05,major:1,az:1.1,fa:1.2,tool:1.1,app:1.15};
const FILTER={all:null,manual:['page','az'],cases:['case'],guides:['guide','ops2','kb','major'],offences:['off','sg'],forms:['tpl','sten'],app:['fa','tool','app']};

function fold(s){ return String(s==null?'':s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,''); }
function norm(s){ return fold(s).replace(/[’‘`]/g,"'")
  .replace(/\b(?:sections?|secs?|ss?)\.?\s?(\d{1,3}[a-z]?)\b/g,' s$1 ')
  .replace(/\b(?:articles?|arts?)\.?\s?(\d{1,3})\b/g,' art$1 '); }
function stem(w){
  if(w.length<4||/\d/.test(w))return w;
  if(w.endsWith('ies')&&w.length>4)w=w.slice(0,-3)+'y';
  else if(w.endsWith('sses'))w=w.slice(0,-2);
  else if(/(ch|sh|x|zz)es$/.test(w))w=w.slice(0,-2);
  else if(w.endsWith('s')&&!/(ss|us|is)$/.test(w))w=w.slice(0,-1);
  if(w.endsWith('ing')&&w.length>5){ w=w.slice(0,-3); if(/([^aeiouls])\1$/.test(w))w=w.slice(0,-1); }
  else if(w.endsWith('ed')&&!w.endsWith('eed')&&w.length>4){ w=w.slice(0,-2); if(/([^aeiouls])\1$/.test(w))w=w.slice(0,-1); }
  if(w.length>4&&w.endsWith('e'))w=w.slice(0,-1);
  return w;
}
function toks(s){ const out=[]; for(const w of norm(s).split(/[^a-z0-9]+/)){ if(w.length<2||w.length>32||STOP.has(w))continue; out.push(stem(w)); } return out; }
const SYN=new Map();
for(const g of SYNG){ const st=[...new Set(g.map(w=>stem(w)))]; for(const a of st){ const cur=SYN.get(a)||new Set(); st.forEach(b=>{ if(b!==a)cur.add(b); }); SYN.set(a,cur); } }

/* ---------- documents ---------- */
const docs=[];            // {k,p,t,l,x,o,ti}
const dl=[];              // weighted length per doc
const post=new Map();     // term -> [doc,tf,doc,tf,...]
const parents=new Map();  // p -> {k,t,l,o,docs:[]}
const azRefs=new Map();   // az doc -> [abs pages]
let avgdl=1, totalLen=0;
const counts={};

const deco=t=>String(t||'').replace(/^[^A-Za-z0-9ÁÉÍÓÚáéíóú('"‘“]+/,'').trim();
function addDoc(k,p,t,l,x,o,titleW){
  t=deco(t); l=deco(l);
  x=String(x||'').replace(/\s+\n/g,'\n').trim(); if(!x&&!t)return -1;
  const id=docs.length; docs.push({k,p,t,l,x,o});
  const tf=new Map(); let len=0;
  for(const w of toks(x)){ tf.set(w,(tf.get(w)||0)+1); len++; }
  const tw=titleW==null?2:titleW;
  if(tw)for(const w of toks(t)){ tf.set(w,(tf.get(w)||0)+tw); len+=tw; }
  for(const [w,n] of tf){ let a=post.get(w); if(!a){a=[];post.set(w,a);} a.push(id,n); }
  dl.push(len||1); totalLen+=len||1;
  let P=parents.get(p); if(!P){ P={k,t,l,o,docs:[]}; parents.set(p,P); counts[k]=(counts[k]||0)+1; } P.docs.push(id);
  return id;
}
/* split long text into ~900-char passages at paragraph (then sentence) boundaries; carries the latest heading */
function passages(text,max){
  max=max||900; const out=[]; let buf='', head='';
  const isHead=t=>t.length>2&&t.length<90&&!/[.;,:]$/.test(t)&&(/^(\d+(\.\d+)*\.?|[A-Z]\.|Part|Chapter|Section)\s+\S/.test(t)||(t===t.toUpperCase()&&/[A-Z]{3}/.test(t)));
  const flush=()=>{ if(buf.trim())out.push({h:head,x:buf.trim()}); buf=''; };
  for(let para of String(text||'').replace(/\r/g,'').split(/\n\s*\n/)){
    para=para.trim(); if(!para)continue;
    const first=para.split('\n')[0].trim();
    if(isHead(first)){ flush(); head=first.replace(/\s+/g,' ').slice(0,80); }
    if(para.length>max*1.5){
      flush();
      const sents=para.replace(/\s+/g,' ').split(/(?<=[.!?])\s+(?=[A-Z"“(])/);
      for(const s of sents){ if(buf.length+s.length>max){ flush(); } buf+=(buf?' ':'')+s; }
      flush(); continue;
    }
    if(buf.length+para.length>max)flush();
    buf+=(buf?'\n\n':'')+para;
  }
  flush(); return out;
}
const clean=t=>String(t||'').replace(/\*{1,3}|_{2,}|^#+\s/gm,'').split('\n').filter(l=>!/^Garda Investigation Techniques\b/.test(l.trim())).join('\n');

let META=null;
function titleFor(abs){ const t=META.titles; let lo=0,hi=t.length-1,ans='Cover'; while(lo<=hi){const mid=(lo+hi)>>1; if(t[mid][0]<=abs){ans=t[mid][1];lo=mid+1;}else hi=mid-1;} return ans; }
function pageLabel(abs){ return META.labels[abs]||('p.'+abs); }

async function getJSON(u){ const r=await fetch(u); if(!r.ok)throw new Error(u+' '+r.status); return r.json(); }

async function build(extra){
  const prog=(d,n)=>postMessage({t:'prog',d,n});
  META=await getJSON('data/meta.json');
  const names=['az','cases','ops','stencils','kb','ops2','templates','guides3'];
  const got={}; const missing=[];
  await Promise.all(names.map(async n=>{ try{ got[n]=await getJSON('data/'+n+'.json'); }catch(e){ missing.push(n); } }));
  const total=META.chunks.length+names.length; let done=0;

  /* manual pages */
  for(const c of META.chunks){
    let ch=null; try{ ch=await getJSON(c.f); }catch(e){ missing.push(c.f); }
    if(ch)ch.pages.forEach((pg,i)=>{ const abs=c.s+i; const full=titleFor(abs), parts=full.split(' › '), last=parts[parts.length-1];
      const lab=pageLabel(abs)+(abs>=993?' · 2007 manual':'');
      const ps=passages(clean(pg),900);
      ps.forEach(P=>addDoc('page','p:'+abs,last,lab,P.x,{k:'page',a:abs},2));
      if(!ps.length)addDoc('page','p:'+abs,last,lab,'',{k:'page',a:abs},2);
      const pr=parents.get('p:'+abs); if(pr){ pr.path=parts.length>1?parts[parts.length-2]:''; pr.dated=abs>=993; }
    });
    prog(++done,total);
  }
  /* case law */
  (got.cases||[]).forEach(c=>{
    const cite=(c.c||[]).filter(Boolean).slice(0,2).join(' · ');
    const x=[c.why,c.d,c.f&&c.f.facts?'Facts: '+c.f.facts:'',c.f&&c.f.held?'Held: '+c.f.held:'',(c.s||[]).map(s=>s.t).join('\n')].filter(Boolean).join('\n\n').slice(0,3200);
    addDoc('case','c:'+c.n,c.n,(c.cat||'Case law')+(cite?' · '+cite:''),x,{k:'case',n:c.n},3);
  }); prog(++done,total);
  /* investigation / deep guides */
  (got.guides3||[]).forEach(g=>{ passages(g.b,950).forEach(P=>addDoc('guide','g:'+g.id,g.t,P.h?P.h:'Guide',P.x,{k:'guide',id:g.id},2)); });
  prog(++done,total);
  /* offence cards + statement guides + major incident */
  const O=got.ops||{};
  (O.ptp||[]).forEach((p,i)=>addDoc('off','o:'+i,p.o,'Offence card · points to prove',['Points to prove:','- '+p.e.join('\n- '),'Arrest / notes: '+p.a].join('\n'),{k:'off',i},3));
  (O.sguides||[]).forEach(g=>addDoc('sg','s:'+g.g,'Statement guide — '+g.t,'What the statement must capture','- '+g.must.join('\n- '),{k:'sg',g:g.g},3));
  if(O.major)addDoc('major','major',O.major.t,'Checklist',O.major.sections.map(s=>s.h+':\n- '+s.items.join('\n- ')).join('\n\n'),{k:'major'},2);
  prog(++done,total);
  /* templates + stencils */
  (got.templates||[]).forEach((t,i)=>addDoc('tpl','t:'+i,t.t,'Template · '+String(t.cat||'').replace(/^[^\w]+/,''),((t.sub?'Subject: '+t.sub+'\n\n':'')+t.b).slice(0,3500),{k:'tpl',i},3));
  (got.stencils||[]).forEach((t,i)=>passages(t.b,1100).slice(0,4).forEach(P=>addDoc('sten','st:'+i,t.t,'Stencil · '+t.cat,P.x,{k:'sten',i},3)));
  prog(++done,total);
  /* quick-reference cards (kb) */
  const K=got.kb||{};
  if(K.caution){ const c=K.caution; addDoc('kb','kb:caution',c.t,'Quick reference',c.intro||'',{k:'kb',v:'caution'},2);
    (c.cards||[]).forEach(x=>addDoc('kb','kb:caution',c.t,x.h,x.h+'\n'+x.body,{k:'kb',v:'caution'},2));
    (c.cases||[]).forEach(x=>addDoc('kb','kb:caution',c.t,'Case law',x.n+' — '+x.p,{k:'kb',v:'caution'},1)); }
  if(K.latin){ const L=K.latin; for(let i=0;i<L.terms.length;i+=12)addDoc('kb','kb:latin',L.t,'Latin & legal terms',L.terms.slice(i,i+12).map(([a,b])=>a+' — '+b).join('\n'),{k:'kb',v:'latin'},1); }
  if(K.acronyms){ const A=K.acronyms; for(let i=0;i<A.items.length;i+=15)addDoc('kb','kb:acronyms',A.t,'Acronyms',A.items.slice(i,i+15).map(([a,b])=>a+' — '+b).join('\n'),{k:'kb',v:'acronyms'},1); }
  for(const v of ['weapons','searches','rtc','escooter','seizure']){ const T=K[v]; if(!T)continue;
    if(T.intro)addDoc('kb','kb:'+v,T.t,'Quick reference',T.intro,{k:'kb',v},2);
    (T.cards||[]).forEach(x=>addDoc('kb','kb:'+v,T.t,x.h,x.h+'\n'+x.body,{k:'kb',v},2));
    (T.sections||[]).forEach(x=>addDoc('kb','kb:'+v,T.t,x.h,x.h+':\n- '+x.items.join('\n- '),{k:'kb',v},2));
    if(T.items)for(let i=0;i<T.items.length;i+=8)addDoc('kb','kb:'+v,T.t,'Quick reference',T.items.slice(i,i+8).map(([a,b])=>a+' — '+b).join('\n'),{k:'kb',v},2); }
  /* deep-guide blocks (ops2) */
  const O2=got.ops2||{};
  for(const [v,S] of Object.entries(O2)){ if(!S)continue;
    const p='o2:'+v, o={k:'ops2',v};
    (S.blocks||[]).forEach(b=>passages(b.t,950).forEach(P=>addDoc('ops2',p,S.title,b.h,b.h+'\n'+P.x,o,2)));
    if(S.items)S.items.forEach(it=>{ if(typeof it==='string')addDoc('ops2',p,S.title,'Checklist',it,o,1);
      else addDoc('ops2',p,S.title,it.n||it.t||'',[it.n,it.t,it.m,it.u].filter(Boolean).join(' — '),o,1); });
  }
  prog(++done,total);
  /* A–Z index entries → jump straight to the pages the manual's own index gives */
  (got.az||[]).forEach(e=>{ const id=addDoc('az','az:'+e.t,e.t,'Index · '+e.r.map(r=>r.l).slice(0,4).join(' · '),'',{k:'page',a:e.r[0].a,refs:e.r},4); if(id>=0)azRefs.set(id,e.r.map(r=>r.a)); });
  prog(++done,total);
  /* sent in by the page: first aid, toolbox, app help */
  for(const d of (extra||[]))addDoc(d.k,d.p,d.t,d.l,d.x,d.o,d.w==null?2:d.w);
  avgdl=totalLen/Math.max(1,docs.length);
  return {docs:docs.length,parents:parents.size,counts,missing,pages:META.pages};
}

/* ---------- querying ---------- */
function prep(q,extra){
  const concepts=[], seen=new Set();
  const add=(t,opt)=>{ if(seen.has(t))return; seen.add(t); const alts=[[t,1]]; const g=SYN.get(t); if(g)for(const a of g)alts.push([a,0.6]); concepts.push({t,alts,opt}); };
  toks(q).forEach(t=>add(t,false));
  (extra||[]).forEach(s=>toks(s).forEach(t=>add(t,true)));
  return concepts;
}
function pop(n){ let c=0; while(n){ n&=n-1; c++; } return c; }
function rank(q,extra,allow){
  const C=prep(q,extra); if(!C.length)return {C,list:[]};
  const N=docs.length, sc=new Float32Array(N), hit=new Uint16Array(N), touched=[];
  let ci=0, nReq=0;
  for(const c of C){
    const best=new Map();
    for(const [term,w] of c.alts){ const pl=post.get(term); if(!pl)continue;
      const df=pl.length/2, idf=Math.log(1+(N-df+0.5)/(df+0.5));
      for(let i=0;i<pl.length;i+=2){ const d=pl[i]; if(allow&&!allow.has(docs[d].k))continue;
        const tf=pl[i+1], v=w*idf*tf*(K1+1)/(tf+K1*(1-B+B*dl[d]/avgdl));
        const pv=best.get(d); if(pv===undefined||v>pv)best.set(d,v); } }
    const bit=c.opt?0:(1<<Math.min(ci,15));
    for(const [d,v] of best){ if(sc[d]===0)touched.push(d); sc[d]+=v; if(bit)hit[d]|=bit; }
    if(!c.opt){ ci++; nReq++; }
  }
  const phrase=fold(q).replace(/[^a-z0-9 ]+/g,' ').replace(/\s+/g,' ').trim();
  let list=touched.map(d=>{ let s=sc[d]; if(nReq>1){ const m=pop(hit[d]); s*=Math.pow(Math.max(m,0.5)/nReq,1.6); }
    const D=docs[d]; if(D.k==='page'&&TABLEY.test(D.t))s*=0.8;          // dense summary tables: useful, but rank below the chapter itself
    return [d,s*(PRIOR[D.k]||1)]; });
  list.sort((a,b)=>b[1]-a[1]);
  if(nReq>1&&phrase.length>4){ const lim=Math.min(list.length,400);
    for(let i=0;i<lim;i++){ const D=docs[list[i][0]]; if(fold(D.x+' '+D.t).replace(/[^a-z0-9 ]+/g,' ').replace(/\s+/g,' ').includes(phrase))list[i][1]*=1.35; }
    list.sort((a,b)=>b[1]-a[1]); }
  return {C,list};
}
function snippet(x,terms){
  if(!x)return '';
  const f=fold(x); if(!terms.length)return x.slice(0,180);
  const re=new RegExp('\\b('+terms.map(t=>t.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|')+')','g');
  const pos=[]; let m; while((m=re.exec(f))&&pos.length<400){ pos.push(m.index); if(m.index===re.lastIndex)re.lastIndex++; }
  if(!pos.length)return x.slice(0,180).replace(/\s+/g,' ');
  let bi=0,bc=0,j=0;
  for(let i=0;i<pos.length;i++){ while(pos[i]-pos[j]>170)j++; if(i-j+1>bc){bc=i-j+1;bi=j;} }
  let s=Math.max(0,pos[bi]-50), e=Math.min(x.length,s+210);
  if(s>0){ const sp=x.indexOf(' ',s); if(sp>0&&sp<pos[bi])s=sp+1; }
  if(e<x.length){ const sp=x.lastIndexOf(' ',e); if(sp>s+80)e=sp; }
  return (s>0?'…':'')+x.slice(s,e).replace(/\s+/g,' ').trim()+(e<x.length?'…':'');
}
function query(q,filter,n){
  const allow=FILTER[filter]?new Set(FILTER[filter]):null;
  const {C,list}=rank(q,null,null);
  const terms=C.filter(c=>!c.opt).flatMap(c=>c.alts.map(a=>a[0])).filter(t=>t.length>1);
  const agg=new Map(), fc={all:0,manual:0,cases:0,guides:0,offences:0,forms:0,app:0};
  for(const [d,s] of list){ const D=docs[d]; let A=agg.get(D.p);
    if(!A){ A={p:D.p,d,s,n:1,extra:0}; agg.set(D.p,A); } else { A.n++; if(A.n<=4)A.extra+=s*0.15; } }
  const top=list.length?list[0][1]:0;
  let items=[...agg.values()].filter(A=>A.s>=top*0.04).map(A=>({...A,s:A.s+A.extra}));
  items.sort((a,b)=>b.s-a.s);
  for(const A of items){ const k=docs[A.d].k; fc.all++; for(const [f,ks] of Object.entries(FILTER))if(ks&&ks.includes(k))fc[f]++; }
  if(allow)items=items.filter(A=>allow.has(docs[A.d].k));
  const out=items.slice(0,n||60).map(A=>{ const D=docs[A.d], P=parents.get(A.p);
    return {k:D.k,key:A.p,t:P.t||D.t,l:D.k==='page'?(P.l+(P.path?' · '+P.path:'')):(D.l&&D.l!==P.t?D.l:P.l),o:P.o,s:+A.s.toFixed(3),n:A.n,snip:snippet(D.x,terms),dated:!!P.dated}; });
  return {items:out,counts:fc,terms:[...new Set(terms)],total:items.length};
}
/* sources for an AI answer: best passages, diverse, within a character budget; the manual's own A–Z index steers to pages */
function context(q,extra,exclude,budget){
  budget=budget||13000; exclude=new Set(exclude||[]);
  const {list}=rank(q,extra,null); if(!list.length)return [];
  const top=list[0][1];
  const boost=new Map();
  list.slice(0,60).forEach(([d,s])=>{ const refs=azRefs.get(d); if(refs)refs.slice(0,3).forEach(a=>{ const P=parents.get('p:'+a); if(P)P.docs.forEach(pd=>boost.set(pd,Math.max(boost.get(pd)||0,s*0.35))); }); });
  const sc=new Map(list.map(([d,s])=>[d,s]));
  for(const [d,b] of boost)sc.set(d,(sc.get(d)||0)+b);
  const ranked=[...sc.entries()].sort((a,b)=>b[1]-a[1]);
  const CAP={page:6,case:3,guide:3,off:2,sg:2,tpl:1,sten:1,kb:2,ops2:2,major:1,fa:2,tool:1,app:2,az:0};
  const per=new Map(), byType={}, out=[]; let used=0;
  for(const [d,s] of ranked){
    if(s<top*0.1||out.length>=14)break;
    const D=docs[d]; if(D.k==='az'||exclude.has(D.p))continue;
    const have=per.get(D.p);
    if(!have){ if((byType[D.k]||0)>=(CAP[D.k]||1))continue; }
    else if(have.parts>=2)continue;
    let x=D.x; if(D.k==='case'&&x.length>1800)x=x.slice(0,1800)+'…'; else if(x.length>1500)x=x.slice(0,1500)+'…';
    if(used+x.length>budget)continue;
    used+=x.length;
    if(have){ have.text+='\n…\n'+x; have.parts++; continue; }
    const P=parents.get(D.p);
    const src={key:D.p,k:D.k,t:P.t||D.t,l:D.k==='page'?(P.l+(P.path?' · '+P.path:'')):(D.l&&D.l!==P.t?D.l:P.l),o:P.o,text:x,parts:1,dated:!!P.dated};
    per.set(D.p,src); byType[D.k]=(byType[D.k]||0)+1; out.push(src);
  }
  return out.map(({parts,...s})=>s);
}

let ready=null;
self.onmessage=async e=>{
  const m=e.data||{};
  try{
    if(m.t==='init'){ if(!ready)ready=build(m.extra); const info=await ready; postMessage({t:'ready',info}); return; }
    if(!ready){ postMessage({t:'err',id:m.id,e:'not initialised'}); return; }
    await ready;
    if(m.t==='q'){ postMessage({t:'res',id:m.id,r:query(m.q,m.filter||'all',m.n)}); }
    else if(m.t==='ctx'){ postMessage({t:'ctx',id:m.id,r:context(m.q,m.extra,m.exclude,m.budget)}); }
  }catch(err){ postMessage({t:'err',id:m.id,e:String(err&&err.message||err)}); }
};
