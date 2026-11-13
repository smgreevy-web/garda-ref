/* Generic evidence-preservation request — any holder, any kind of record. Text only; the member sends it themselves. */
(function(W){ 'use strict';
const T={
 cctv:{l:'CCTV or video footage',what:'CCTV or other recorded video footage',area:'Camera(s) / area of interest',ph:'front door and footpath',win:'two hours before and two hours after the time above',why:'Recordings are often overwritten automatically within days.'},
 private:{l:'Doorbell, dashcam or phone video',what:'video or images recorded on your doorbell camera, dashcam, phone or similar device',area:'Device and view',ph:'doorbell camera facing the road',win:'one hour before and one hour after the time above',why:'Cloud and device recordings are often deleted automatically after a short time.'},
 till:{l:'Till, card or transaction records',what:'till receipts, card-terminal records, transaction logs and any linked records',area:'Till / terminal / account',ph:'till 2, card terminal at the counter',win:'the whole of the date above',why:'Electronic journals and logs may be cleared on a routine cycle.'},
 account:{l:'Account, subscriber or usage records',what:'account, subscriber, log-in and usage records',area:'Account / number / user name',ph:'account or reference number',win:'the period stated below',why:'Records are kept only for limited periods. Disclosure will be sought separately through the proper legal process — this letter only asks that records be kept.'},
 online:{l:'Online or social-media content',what:'posts, messages, images, account details and log-in records linked to the account named',area:'Account / page / link',ph:'profile name or link',win:'the period stated below',why:'Content can be deleted by the user at any time. Disclosure will be sought separately through the proper legal process — this letter only asks that content be kept.'},
 transport:{l:'Transport records (bus, rail, Luas, taxi, toll)',what:'on-board and station CCTV, ticketing, card, booking and journey records',area:'Route / vehicle / stop',ph:'route 16, northbound, stop at …',win:'one hour before and one hour after the time above',why:'On-board and station recordings are overwritten on a short cycle.'},
 access:{l:'Access, alarm or system logs',what:'access-control, alarm, key-fob, entry and system logs',area:'Door / panel / system',ph:'rear door fob reader',win:'the whole of the date above',why:'System logs are often cleared or overwritten automatically.'},
 item:{l:'A physical item or document',what:'the item or document described below, in its present condition, without cleaning, repairing, copying over or disposing of it',area:'Item / document',ph:'damaged shutter, delivery docket',win:'until it is collected by An Garda Síochána',why:'Handling, cleaning or repair can destroy evidence.'},
 other:{l:'Something else',what:'',area:'What should be kept',ph:'describe the records or material',win:'the period stated below',why:''}
};
const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
let LAST='';
function render(view,head,after){
  view.innerHTML=head+`<div class="tool pv">
  <label class="flab">What needs keeping</label><select class="fin" id="pvT">${Object.entries(T).map(([k,v])=>'<option value="'+k+'">'+esc(v.l)+'</option>').join('')}</select>
  <label class="flab" id="pvOL" hidden>Describe the material</label><input class="fin" id="pvO" hidden placeholder="e.g. delivery-app order records">
  <label class="flab">Holder (business, organisation or person)</label><input class="fin" id="pvH" placeholder="e.g. the shop, transport operator, landlord">
  <label class="flab">Incident date and time</label><input class="fin" id="pvW" placeholder="28/06/2026, about 03:30">
  <label class="flab" id="pvAL">Camera(s) / area of interest</label><input class="fin" id="pvA" placeholder="front door and footpath">
  <label class="flab">Period to keep (leave blank for the usual)</label><input class="fin" id="pvP" placeholder="">
  <label class="flab">Your details</label><input class="fin" id="pvY" placeholder="Garda [Name] [Reg], [Station], [tel]">
  <label class="flab">Reference (optional)</label><input class="fin" id="pvR" placeholder="incident reference">
  <label class="pv-ck"><input type="checkbox" id="pvU" checked> Ask them to confirm by reply</label>
  <button class="csall" id="pvGo">Make the request</button></div><div id="pvOut"></div>
  <div class="toolnote">Text only — put it on your station headed paper and send it yourself. Don't type names of injured parties, suspects or witnesses here. Any formal disclosure (e.g. data protection or court order) goes through Garda channels, never this app.</div>`;
  const $=id=>view.querySelector('#'+id), g=id=>($(id).value||'').trim();
  const sync=()=>{ const t=T[g('pvT')]; $('pvAL').textContent=t.area; $('pvA').placeholder=t.ph; $('pvP').placeholder=t.win; const o=g('pvT')==='other'; $('pvO').hidden=!o; $('pvOL').hidden=!o; };
  $('pvT').addEventListener('change',sync); sync();
  $('pvGo').addEventListener('click',()=>{
    const k=g('pvT'), t=T[k], what=k==='other'?(g('pvO')||'[describe the records or material]'):t.what, subj=k==='other'?(g('pvO')||'records'):t.l.toLowerCase();
    const body=['Re: Request to preserve '+subj+(g('pvR')?' — Ref: '+g('pvR'):''),'',
      'To '+(g('pvH')||'[holder]')+',','',
      'An Garda Síochána is investigating an incident on '+(g('pvW')||'[date and time]')+'. You may hold material that is relevant to that investigation.','',
      'I ask that you preserve, and do not delete, overwrite, alter or dispose of, '+what+(g('pvA')?', relating to: '+g('pvA'):'')+', covering '+(g('pvP')||t.win)+'.',
      t.why?'\n'+t.why:'','',
      'Please keep the material securely until a member of An Garda Síochána contacts you to view or collect it. Where required, a formal request will follow through the appropriate channel.',
      $('pvU').checked?'\nPlease confirm by reply that the material has been preserved, and tell me if any of it has already been lost.':'','',
      'Thank you for your help.','',
      g('pvY')||'Garda [Name] [Reg], [Station], [tel]','An Garda Síochána'].join('\n').replace(/\n{3,}/g,'\n\n');
    LAST=body;
    $('pvOut').innerHTML='<div class="tool"><h3>Preservation request</h3><div class="pv-txt">'+esc(body)+'</div><div class="pv-acts"><button class="csall" id="pvC">⧉ Copy</button><button class="csall" id="pvD">⬇ Word file</button></div></div>';
    $('pvC').addEventListener('click',()=>{ navigator.clipboard&&navigator.clipboard.writeText(body).then(()=>{ $('pvC').textContent='Copied ✓'; }).catch(()=>{ $('pvC').textContent='Copy failed'; }); });
    $('pvD').addEventListener('click',()=>{ if(typeof downloadDoc==='function')downloadDoc('Preservation request'+(g('pvH')?' — '+g('pvH'):''),body); });
    $('pvOut').scrollIntoView({behavior:'smooth'});
  });
  if(after)after();
}
W.GRPreserve={render,types:T,last:()=>LAST};
})(window);
