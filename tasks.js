/* Assisting — Tasks: a to-do scheduler for the job.
   Types and sub-types with their own icons (CCTV, statements, enquiries, files — charged, for directions, traffic, sudden
   death…), steps inside a task — and steps inside steps, up to six levels — time windows (business hours, early morning, nights…), deadlines with reminders, an urgent
   flag, planning around My roster (your next tours, "you're off that day"), a place lookup for phone / email / opening hours,
   email-to-myself and calendar files, and helpers for CCTV overwrite dates and the 6-month summary time limit.
   Saved only on this phone (localStorage). Nothing is uploaded — except, when you tap Find, the place name you typed
   (to OpenStreetMap; or to Claude with your own API key if you choose that). */
(function(){
'use strict';
const W=window, D=document;
const LS='gr_tasks', LSP='gr_tasks_prefs';
const H=3600e3, MIN=60e3, DAY=24*H;
const p2=n=>String(n).padStart(2,'0');
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const DAYS=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'], MON=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const hm=t=>{const d=new Date(t);return p2(d.getHours())+':'+p2(d.getMinutes());};
const day=t=>{const d=new Date(t);return DAYS[d.getDay()]+' '+d.getDate()+' '+MON[d.getMonth()];};
const full=t=>{const d=new Date(t);return hm(t)+' '+DAYS[d.getDay()]+' '+p2(d.getDate())+'/'+p2(d.getMonth()+1)+'/'+d.getFullYear();};
const dateOnly=t=>{const d=new Date(t);return DAYS[d.getDay()]+' '+d.getDate()+' '+MON[d.getMonth()]+' '+d.getFullYear();};
const sod=t=>{const d=new Date(t);d.setHours(0,0,0,0);return d.getTime();};
function durStr(ms){ms=Math.abs(ms);const d=Math.floor(ms/DAY),h=Math.floor(ms%DAY/H),m=Math.round(ms%H/MIN);
  return d?d+' d'+(h?' '+h+' h':''):h?h+' h'+(m?' '+p2(m)+' m':''):m+' min';}
function rel(t,now){ // "today 17:00" / "tomorrow 09:00" / "Mon 29 Sep 09:00"
  const dd=Math.round((sod(t)-sod(now))/DAY);
  return (dd===0?'today':dd===1?'tomorrow':dd===-1?'yesterday':day(t))+' '+hm(t);
}
const uid=()=>'t'+Date.now().toString(36)+Math.random().toString(36).slice(2,6);
const vib=p=>{try{if(navigator.vibrate)navigator.vibrate(p);}catch(e){}};
const svg=(p,c)=>'<svg viewBox="0 0 24 24" aria-hidden="true"'+(c?' class="'+c+'"':'')+'>'+p+'</svg>';

/* ================= icons =================
   Line icons on a 24-px grid. Parts with class "d" also get a soft fill in the type's colour, "f" is fill only, "s" solid. */
const IC={
 // types
 cctv:'<path class="d" d="M4 5.5h11.5A1.5 1.5 0 0 1 17 7v4a1.5 1.5 0 0 1-1.5 1.5H4A1.5 1.5 0 0 1 2.5 11V7A1.5 1.5 0 0 1 4 5.5z"/><path d="m17 7.8 4.5-1.8v6L17 10.2M9.5 12.5V17h-5M4.5 14.5v5.5"/><circle class="s" cx="6" cy="9" r="1"/>',
 statement:'<path class="d" d="M11.5 21H6.5A1.5 1.5 0 0 1 5 19.5v-15A1.5 1.5 0 0 1 6.5 3H14l5 5v3.5"/><path d="M14 3v5h5M8.5 12h6M8.5 15.5h3.5"/><path d="M19.4 13.6a1.5 1.5 0 0 1 2.1 2.1l-6 6-2.8.7.7-2.8z"/>',
 arrest:'<circle cx="7" cy="16" r="4.5"/><circle cx="17" cy="16" r="4.5"/><path class="d" d="M5.3 11.8V9.4a1 1 0 0 1 1-1h1.4a1 1 0 0 1 1 1v2.4M15.3 11.8V9.4a1 1 0 0 1 1-1h1.4a1 1 0 0 1 1 1v2.4"/><path d="M7 8.4V6.8M17 8.4V6.8"/><rect x="7.6" y="4.3" width="3.2" height="2.2" rx="1.1"/><rect x="13.2" y="4.3" width="3.2" height="2.2" rx="1.1"/><path d="M10.8 5.4h2.4"/>',
 enquiry:'<circle class="d" cx="10.5" cy="10.5" r="7"/><path d="m15.8 15.8 5 5"/><path d="M8.6 8.7a2 2 0 1 1 2.8 1.8c-.6.3-.9.7-.9 1.3v.3M10.5 14.2h.01"/>',
 visit:'<path class="f" d="M5 9.5 12 4l7 5.5V20H5z"/><path d="M3 11 12 3.8 21 11M5 9.5V20h14V9.5M10 20v-5h4v5"/>',
 call:'<path class="d" d="M5 4h3.5l2 5-2.5 1.5a11 11 0 0 0 5.5 5.5L15 13.5l5 2V19a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/><path d="M14.5 3.5a6.5 6.5 0 0 1 6 6M14.5 7a3 3 0 0 1 2.5 2.5"/>',
 file:'<path class="d" d="M3 7a1.5 1.5 0 0 1 1.5-1.5H9l2 2.5h8.5A1.5 1.5 0 0 1 21 9.5v9a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18.5z"/><path d="M3 11h18"/>',
 court:'<path d="M12 4.8V20M8 20.5h8M4.5 7h15M4.5 7 2 13M4.5 7 7 13M19.5 7 17 13M19.5 7 22 13"/><path class="d" d="M2 13a2.5 2.5 0 0 0 5 0zM17 13a2.5 2.5 0 0 0 5 0z"/><circle cx="12" cy="3.8" r="1.1"/>',
 limit:'<path d="M6.5 3h11M6.5 21h11M7.5 3v2.6a4.5 4.5 0 0 0 2 3.7L12 11l2.5-1.7a4.5 4.5 0 0 0 2-3.7V3M7.5 21v-2.6a4.5 4.5 0 0 1 2-3.7L12 13l2.5 1.7a4.5 4.5 0 0 1 2 3.7V21"/><path class="f" d="M8.6 21v-1.9a3.4 3.4 0 0 1 1.5-2.8L12 15l1.9 1.3a3.4 3.4 0 0 1 1.5 2.8V21z"/>',
 exhibit:'<path class="d" d="M3 5a2 2 0 0 1 2-2h6.2a2 2 0 0 1 1.4.6l8 8a2 2 0 0 1 0 2.8l-6.2 6.2a2 2 0 0 1-2.8 0l-8-8A2 2 0 0 1 3 11.2z"/><circle cx="7.8" cy="7.8" r="1.7"/><path d="m10.5 14.5 4-4M12.8 16.8l2.4-2.4"/>',
 traffic:'<path d="M5.2 10.5 6.7 6.3A2 2 0 0 1 8.6 5h6.8a2 2 0 0 1 1.9 1.3l1.5 4.2"/><path class="d" d="M3.5 12a1.5 1.5 0 0 1 1.5-1.5h14a1.5 1.5 0 0 1 1.5 1.5v5h-17z"/><path d="M5.5 17v2.5h3V17M15.5 17v2.5h3V17M6.5 13.8h1.5M16 13.8h1.5"/>',
 victim:'<path class="d" d="M12 13.8s-4.6-2.7-4.6-5.9A2.5 2.5 0 0 1 12 6.5a2.5 2.5 0 0 1 4.6 1.4c0 3.2-4.6 5.9-4.6 5.9z"/><path d="M2.5 14.5h2.8l3.6 2.3h5a1.3 1.3 0 0 1 0 2.6H10.2M17 17.6l3.5-2.4a1.3 1.3 0 0 1 1.5 2.1L16.2 21H8.6l-3.3-1.6H2.5"/>',
 email:'<rect class="d" x="3" y="5" width="18" height="14" rx="2"/><path d="m3.5 6.5 8.5 6.5 8.5-6.5"/>',
 night:'<path class="d" d="M19.5 14.6A8 8 0 1 1 9.4 4.5a6.4 6.4 0 0 0 10.1 10.1z"/><path d="M17 2.8v3.4M15.3 4.5h3.4M20.6 8.4v1.8M19.7 9.3h1.8"/>',
 admin:'<rect class="d" x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7M3 12.5h18M10.5 12.5v2h3v-2"/>',
 other:'<path d="M10 6h10M10 12h10M10 18h10"/><path d="m3.5 6 1.5 1.5L8 4.5M3.5 12l1.5 1.5L8 10.5M3.5 18l1.5 1.5L8 16.5"/>',
 // sub-types
 pin:'<path class="d" d="M12 21.5s-6.5-6-6.5-11.5a6.5 6.5 0 0 1 13 0c0 5.5-6.5 11.5-6.5 11.5z"/><circle cx="12" cy="10" r="2.4"/>',
 shield:'<path class="d" d="M12 3 5 5.8v5.4c0 4.4 3 8.1 7 9.8 4-1.7 7-5.4 7-9.8V5.8z"/><path d="m8.8 12 2.2 2.2 4.3-4.4"/>',
 download:'<path d="M12 3.5v10.5M7.5 9.5 12 14l4.5-4.5"/><path class="d" d="M3.5 15v3.5A1.5 1.5 0 0 0 5 20h14a1.5 1.5 0 0 0 1.5-1.5V15"/>',
 play:'<rect class="d" x="2.5" y="4" width="19" height="13" rx="2"/><path d="M8.5 21h7M12 17v4"/><path class="s" d="M10.2 7.9v5.2l4.4-2.6z"/>',
 stills:'<rect x="3" y="3" width="18" height="18" rx="2.5"/><circle class="d" cx="12" cy="10" r="3.2"/><path d="M6.3 21a5.7 5.7 0 0 1 11.4 0"/>',
 plaster:'<g transform="rotate(-45 12 12)"><rect class="d" x="2" y="8.5" width="20" height="7" rx="3.5"/><path d="M9 8.5v7M15 8.5v7"/></g><path d="M11.2 12h.01M12.8 12h.01"/>',
 eye:'<path class="d" d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>',
 userpen:'<circle cx="9" cy="7.5" r="3.5"/><path class="d" d="M2.5 20.5a6.5 6.5 0 0 1 10.6-5"/><path d="M19.6 12.2a1.6 1.6 0 0 1 2.3 2.3L16.5 20l-3 .7.7-3z"/>',
 speech:'<path class="d" d="M4.5 4.5h15A1.5 1.5 0 0 1 21 6v9.5a1.5 1.5 0 0 1-1.5 1.5H11l-4.5 3.5V17h-2A1.5 1.5 0 0 1 3 15.5V6a1.5 1.5 0 0 1 1.5-1.5z"/><path d="M7.5 9h9M7.5 12.5h6"/>',
 clipcross:'<rect class="d" x="5" y="4" width="14" height="17.5" rx="2"/><rect x="9" y="2.5" width="6" height="3.5" rx="1"/><path d="M12 10v6.5M8.8 13.2h6.4"/>',
 fileheart:'<path class="d" d="M6.5 3H14l5 5v12.5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 20.5v-16A1.5 1.5 0 0 1 6.5 3z"/><path d="M14 3v5h5"/><path d="M12 18.3s-3.3-1.9-3.3-4.3a1.8 1.8 0 0 1 3.3-1 1.8 1.8 0 0 1 3.3 1c0 2.4-3.3 4.3-3.3 4.3z"/>',
 user:'<circle class="d" cx="12" cy="8" r="4"/><path class="d" d="M4.5 21a7.5 7.5 0 0 1 15 0z"/>',
 gavel:'<path class="d" d="m9.6 6.2 3.6-3.6 7.2 7.2-3.6 3.6z"/><path d="M13.2 9.8 4.5 18.5M3 21.5h9"/>',
 warrant:'<path d="M13 21H6.5A1.5 1.5 0 0 1 5 19.5v-15A1.5 1.5 0 0 1 6.5 3H14l5 5v3.5"/><path d="M14 3v5h5M8.5 11h6M8.5 14h3.5"/><circle class="d" cx="17" cy="16.5" r="3.2"/><path d="m15.3 19.3-.8 3.2 2.5-1.2 2.5 1.2-.8-3.2"/>',
 target:'<circle cx="12" cy="12" r="8.5"/><path d="M12 1.8v3.4M12 18.8v3.4M1.8 12h3.4M18.8 12h3.4"/><circle class="d" cx="12" cy="10.3" r="2.3"/><path class="d" d="M8.4 16.6a3.6 3.6 0 0 1 7.2 0z"/>',
 chain:'<rect x="12.9" y="3" width="6.6" height="10" rx="3.3" transform="rotate(45 16.2 8)"/><rect x="4.5" y="11" width="6.6" height="10" rx="3.3" transform="rotate(45 7.8 16)"/><path d="M10.4 10.4 9 9M13.6 13.6 15 15"/>',
 bars:'<rect class="d" x="4" y="3" width="16" height="18" rx="1.5"/><path d="M8.5 3v18M12 3v18M15.5 3v18M4 9h16"/>',
 houses:'<path class="d" d="M2.5 12.5 7 8.5l4.5 4V20h-9z"/><path class="d" d="M12.5 11 17 7l4.5 4v9h-9z"/><path d="M6 20v-3h2v3M16 20v-3h2v3"/>',
 shop:'<path class="f" d="M3 9.5 4.6 4.5h14.8L21 9.5z"/><path d="M4.6 4.5h14.8L21 9.5H3zM3 9.5a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0M4.5 12v8h15v-8M10 20v-4.5h4V20"/>',
 civic:'<path class="d" d="M3 9 12 4l9 5z"/><path d="M5.5 10.5v7M10 10.5v7M14 10.5v7M18.5 10.5v7M3.5 20.5h17M4.5 18h15"/>',
 feet:'<path class="d" d="M7.5 3.5c1.6 0 2.7 1.7 2.7 4.1 0 1.9-.6 3.4-.9 4.4H6.1c-.4-1-.9-2.5-.9-4.2 0-2.5 1-4.3 2.3-4.3z"/><path d="M6.2 14.5h3.2v1.3a1.6 1.6 0 0 1-3.2 0z"/><path class="d" d="M16.5 7.5c1.3 0 2.3 1.8 2.3 4.3 0 1.7-.5 3.2-.9 4.2h-3.2c-.3-1-.9-2.5-.9-4.4 0-2.4 1.1-4.1 2.7-4.1z"/><path d="M14.6 18.5h3.2v1.3a1.6 1.6 0 0 1-3.2 0z"/>',
 globe:'<circle class="d" cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.5 3.8 5.5 3.8 9s-1.3 6.5-3.8 9c-2.5-2.5-3.8-5.5-3.8-9S9.5 5.5 12 3z"/>',
 idcard:'<rect class="d" x="2.5" y="5" width="19" height="14" rx="2"/><circle cx="8.3" cy="10.8" r="2"/><path d="M5.2 16a3.2 3.2 0 0 1 6.2 0M14 10h4.5M14 13.5h3"/>',
 taxi:'<rect class="f" x="9.3" y="2.3" width="5.4" height="2.7" rx=".6"/><rect x="9.3" y="2.3" width="5.4" height="2.7" rx=".6"/><path d="M5.2 11 6.6 7.3A2 2 0 0 1 8.5 6h7a2 2 0 0 1 1.9 1.3l1.4 3.7"/><path class="d" d="M3.5 12.5A1.5 1.5 0 0 1 5 11h14a1.5 1.5 0 0 1 1.5 1.5V17h-17z"/><path d="M5.5 17v2.5h3V17M15.5 17v2.5h3V17M6.5 14h1.5M16 14h1.5"/>',
 hosp:'<rect class="d" x="4" y="3.5" width="16" height="17.5" rx="1.5"/><path d="M12 7.5v6M9 10.5h6M10 21v-3.5h4V21"/>',
 radio:'<rect class="d" x="6.5" y="7.5" width="11" height="14" rx="2"/><path d="M9.5 7.5V2.5M9.5 11.5h5M9.5 14.5h5M9.5 17.5h5"/>',
 door:'<path class="d" d="M6 21V4.5A1.5 1.5 0 0 1 7.5 3h9A1.5 1.5 0 0 1 18 4.5V21"/><path d="M3.5 21h17M14.5 12.5h.01"/>',
 again:'<path d="M20 12a8 8 0 1 1-2.4-5.7"/><path d="M20.5 3.5v5h-5"/><path d="M12 8v4.5l3 1.8"/>',
 heartpulse:'<path class="d" d="M12 20.5s-8.5-4.9-8.5-11A4.8 4.8 0 0 1 12 6.6a4.8 4.8 0 0 1 8.5 2.9c0 6.1-8.5 11-8.5 11z"/><path d="M3.8 12.5h4.4l1.6-2.8 2.6 5 1.6-2.2h6.2"/>',
 serve:'<path class="f" d="M5 4.5A1.5 1.5 0 0 1 6.5 3H12l4 4v12.5a1.5 1.5 0 0 1-1.5 1.5h-8A1.5 1.5 0 0 1 5 19.5z"/><path d="M16 11.5V7l-4-4H6.5A1.5 1.5 0 0 0 5 4.5v15A1.5 1.5 0 0 0 6.5 21h8a1.5 1.5 0 0 0 1.5-1.5v-2M12 3v4h4M10 14.5h11M18 11.5l3 3-3 3"/>',
 clock:'<circle class="d" cx="12" cy="12" r="8.5"/><path d="M12 7v5l3.5 2"/>',
 pulse:'<rect class="d" x="2.5" y="4.5" width="19" height="15" rx="2.5"/><path d="M5.5 12.5h3l1.8-4 3.4 7.5 1.8-3.5h3"/>',
 signpost:'<path d="M12 2.5v19M8.5 21.5h7"/><path class="d" d="M12 4.5h6.2l2.3 2.3-2.3 2.2H12z"/><path class="d" d="M12 11H5.8l-2.3 2.3 2.3 2.2H12z"/>',
 warn:'<path class="d" d="M10.3 4.2 2.7 17.6A2 2 0 0 0 4.4 20.6h15.2a2 2 0 0 0 1.7-3L13.7 4.2a2 2 0 0 0-3.4 0z"/><path d="M12 9.5v4.5M12 17.2h.01"/>',
 lily:'<path d="M12 21.5v-9"/><path class="d" d="M12 20c-3 .2-4.8-1.6-5.3-3.8 2.8-.2 4.6 1.4 5.3 3.8zM12 18.8c3 .2 4.8-1.6 5.3-3.8-2.8-.2-4.6 1.4-5.3 3.8z"/><path class="d" d="M7.8 4.8 10 7.3 12 3.5l2 3.8 2.2-2.5v4.5a4.2 4.2 0 0 1-8.4 0z"/>',
 missing:'<circle cx="9" cy="8" r="3.5"/><path class="d" d="M2.5 20.5a6.5 6.5 0 0 1 13 0z"/><path d="M17.2 6.6a2.3 2.3 0 1 1 3.1 2.2c-.7.3-1.1.8-1.1 1.6v.6M19.2 14.3h.01"/>',
 child:'<circle cx="8.5" cy="6.5" r="3"/><path class="d" d="M3 19.5a5.5 5.5 0 0 1 11 0z"/><circle cx="17.5" cy="11" r="2.2"/><path class="d" d="M13.8 19.8a3.7 3.7 0 0 1 7.4 0z"/>',
 homeheart:'<path d="M3 11 12 3.8 21 11M5 9.5v11h14v-11"/><path class="d" d="M12 17.6s-3.3-1.9-3.3-4.3a1.8 1.8 0 0 1 3.3-1 1.8 1.8 0 0 1 3.3 1c0 2.4-3.3 4.3-3.3 4.3z"/>',
 hand:'<path d="M8 11.5V5.2a1.4 1.4 0 0 1 2.8 0v5M10.8 10V3.9a1.4 1.4 0 0 1 2.8 0V10M13.6 10.2V5.2a1.4 1.4 0 0 1 2.8 0v6.3M16.4 11.5V8.4a1.4 1.4 0 0 1 2.8 0v5.6a7.2 7.2 0 0 1-7.2 7.2h-.6a6.4 6.4 0 0 1-5.2-2.7l-2.6-3.7a1.45 1.45 0 0 1 2.3-1.8L8 14.2v-2.7"/>',
 cliplist:'<rect class="d" x="5" y="4" width="14" height="17.5" rx="2"/><rect x="9" y="2.5" width="6" height="3.5" rx="1"/><path d="M8.5 10.5h7M8.5 14h7M8.5 17.5h4"/>',
 clipcheck:'<rect class="d" x="5" y="4" width="14" height="17.5" rx="2"/><rect x="9" y="2.5" width="6" height="3.5" rx="1"/><path d="m8.8 13.5 2.3 2.3 4.4-4.6"/>',
 cal:'<rect x="3" y="4.5" width="18" height="16.5" rx="2"/><path class="f" d="M3 6.5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2V10H3z"/><path d="M3 10h18M8 2.5v4M16 2.5v4"/><path class="s" d="M7 13h3v3H7z"/>',
 fileplus:'<path class="d" d="M6.5 3H14l5 5v12.5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 20.5v-16A1.5 1.5 0 0 1 6.5 3z"/><path d="M14 3v5h5M12 11.5v6M9 14.5h6"/>',
 key:'<circle class="d" cx="8" cy="15.5" r="4.5"/><path d="M11.3 12.2 20 3.5M16.3 7.2l2.6 2.6M13.9 9.6l2 2"/>',
 cube:'<path class="f" d="M12 3 20.5 7.5 12 12 3.5 7.5z"/><path d="M12 3 20.5 7.5v9L12 21l-8.5-4.5v-9zM3.5 7.5 12 12l8.5-4.5M12 12v9"/>',
 flask:'<path d="M9 3h6M10 3v6.2L4.6 18.6A1.6 1.6 0 0 0 6 21h12a1.6 1.6 0 0 0 1.4-2.4L14 9.2V3"/><path class="f" d="M7.2 14.5h9.6l2.6 4.1A1.6 1.6 0 0 1 18 21H6a1.6 1.6 0 0 1-1.4-2.4z"/>',
 pill:'<g transform="rotate(-45 12 12)"><rect x="3" y="8" width="18" height="8" rx="4"/><path class="f" d="M12 8h5a4 4 0 0 1 0 8h-5z"/><path d="M12 8v8"/></g>',
 phone:'<rect class="d" x="6.5" y="2.5" width="11" height="19" rx="2.5"/><path d="M10.5 5.5h3M11.2 18.5h1.6"/>',
 undo:'<path d="M9 14.5 4 9.5l5-5"/><path d="M4 9.5h10.5a5.5 5.5 0 0 1 0 11H11"/>',
 bin:'<path d="M4 6.5h16M9 6.5v-2A1.5 1.5 0 0 1 10.5 3h3A1.5 1.5 0 0 1 15 4.5v2"/><path class="d" d="M5.8 6.5 6.9 19.6A1.6 1.6 0 0 0 8.5 21h7a1.6 1.6 0 0 0 1.6-1.4l1.1-13.1"/><path d="M10 10.5V17M14 10.5V17"/>',
 cone:'<path class="d" d="M9.9 4.2a1.1 1.1 0 0 1 1-.7h2.2a1.1 1.1 0 0 1 1 .7l4.3 14.3H5.6z"/><path d="M8.4 9.5h7.2M7 14h10M3 18.5h18v2.5H3z"/>',
 ticket:'<path class="d" d="M5 3v18l2.3-1.5L9.7 21l2.3-1.5 2.3 1.5 2.4-1.5L19 21V3l-2.3 1.5L14.3 3 12 4.5 9.7 3 7.3 4.5z"/><path d="M8.5 9h7M8.5 12.5h7M8.5 16h4"/>',
 lock:'<rect class="d" x="4.5" y="10.5" width="15" height="10.5" rx="2"/><path d="M8 10.5v-3a4 4 0 0 1 8 0v3M12 14.5V17"/>',
 chat:'<path class="d" d="M20.5 11.5a8.5 8.5 0 0 1-12.6 7.4L3.5 20.5l1.6-4.3A8.5 8.5 0 1 1 20.5 11.5z"/><path d="M8.2 11.5h.01M12 11.5h.01M15.8 11.5h.01"/>',
 refer:'<circle cx="8.5" cy="7.5" r="3.5"/><path class="d" d="M2 20.5a6.5 6.5 0 0 1 13 0z"/><path d="M15.5 12h6.5M19 9l3 3-3 3"/>',
 send:'<path class="d" d="M21.5 2.5 2.8 10.2l7.4 3.6 3.6 7.4z"/><path d="M21.5 2.5 10.2 13.8"/>',
 reply:'<path d="M9.5 6.5 4 12l5.5 5.5"/><path d="M4 12h10.5a5.5 5.5 0 0 1 5.5 5.5V19"/>',
 memo:'<path class="d" d="M6.5 3H14l5 5v12.5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 20.5v-16A1.5 1.5 0 0 1 6.5 3z"/><path d="M14 3v5h5M8.5 12h7M8.5 15h7M8.5 18h4.5"/>',
 letter:'<rect class="d" x="2.5" y="5" width="19" height="14" rx="2"/><rect x="15" y="7.5" width="4" height="4.5" rx=".6"/><path d="M5.5 13.5h7M5.5 16.2H10"/>',
 db:'<ellipse class="d" cx="12" cy="5.5" rx="7.5" ry="2.8"/><path d="M4.5 5.5v13c0 1.5 3.4 2.8 7.5 2.8s7.5-1.3 7.5-2.8v-13M4.5 12c0 1.5 3.4 2.8 7.5 2.8s7.5-1.3 7.5-2.8"/>',
 torch:'<path class="d" d="M7 3.5h10l-2 5.5H9z"/><path d="M9 9h6v11a1.5 1.5 0 0 1-1.5 1.5h-3A1.5 1.5 0 0 1 9 20zM12 12.5V15"/>',
 pint:'<path d="M6 3.5h12l-1.4 16.3a1.5 1.5 0 0 1-1.5 1.4H8.9a1.5 1.5 0 0 1-1.5-1.4z"/><path class="f" d="M6.7 9.2h10.6l-.9 10.6a1.5 1.5 0 0 1-1.5 1.4H9.1a1.5 1.5 0 0 1-1.5-1.4z"/><path d="M6.5 9h11"/>',
 euro:'<circle class="d" cx="12" cy="12" r="9"/><path d="M15.6 8.4a4.6 4.6 0 1 0 0 7.2M7 10.8h6M7 13.2h6"/>',
 cap:'<path class="d" d="M2 9.5 12 5l10 4.5L12 14z"/><path d="M6 11.3v4.4c0 1.3 2.7 2.8 6 2.8s6-1.5 6-2.8v-4.4M21.5 9.7v5"/>',
 shirt:'<path class="d" d="M8.5 3.5 3 6.5l2 4.2 2.3-1.1v10.9h9.4V9.6l2.3 1.1 2-4.2-5.5-3c-.4 1.5-1.8 2.5-3.5 2.5S8.9 5 8.5 3.5z"/>',
 pen:'<path class="d" d="M16.9 3.6a2 2 0 0 1 2.8 2.8L9.3 16.8 5.5 18l1.2-3.8z"/><path d="M3.5 21h17"/>',
 people:'<circle cx="9" cy="8" r="3.3"/><path class="d" d="M2.5 20.5a6.5 6.5 0 0 1 13 0z"/><circle cx="17" cy="8.5" r="2.6"/><path d="M16.5 14a5.3 5.3 0 0 1 5.3 5.3"/>',
 // interface
 scan:'<path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3"/><path d="M8 9h8M8 12h8M8 15h5"/>',
 flag:'<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
 any:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
 business:'<path d="M3 8h18v11H3z"/><path d="M8 8V5h8v3"/><path d="M3 13h18"/>',
 early:'<path d="M3 18h18M7 18a5 5 0 0 1 10 0"/><path d="M12 5v4M5.6 9.6l2 2M18.4 9.6l-2 2"/>',
 lunch:'<path d="M8 3v18M6 3v5a2 2 0 0 0 4 0V3M16 21V3c2 1 3.5 4 3.5 8H16"/>',
 evening:'<path d="M3 18h18M7 18a5 5 0 0 1 10 0"/><path d="M12 5v5M9.5 8 12 10.5 14.5 8"/>',
 custom:'<path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/>',
 check:'<path d="m5 12.5 4.5 4.5L19 7.5"/>', bell:'<path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z"/><path d="M10 20a2 2 0 0 0 4 0"/>',
 copy:'<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V4H4v12h4"/>', trash:'<path d="M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14"/>',
 plus:'<path d="M12 5v14M5 12h14"/>',
 camera:'<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3z"/><circle cx="12" cy="13" r="3.5"/>',
 images:'<path d="M18 22H4a2 2 0 0 1-2-2V6"/><path d="m22 13-1.3-1.3a2.4 2.4 0 0 0-3.4 0L11 18"/><circle cx="12" cy="8" r="2"/><rect width="16" height="16" x="6" y="2" rx="2"/>',
 x:'<path d="M18 6 6 18M6 6l12 12"/>',
 steps:'<rect x="3.5" y="3.5" width="17" height="17" rx="3"/><path d="m8 12 3 3 5-5.5"/>',
 search:'<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/>',
 share:'<path d="M12 3v12M7.5 7.5 12 3l4.5 4.5"/><path d="M5 12v7.5A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5V12"/>',
 ext:'<path d="M14 4h6v6M20 4l-9 9"/><path d="M18 14v5.5a1.5 1.5 0 0 1-1.5 1.5h-12A1.5 1.5 0 0 1 3 19.5v-12A1.5 1.5 0 0 1 4.5 6H10"/>',
 spark:'<path class="d" d="M12 3c.6 4.2 2.8 6.4 7 7-4.2.6-6.4 2.8-7 7-.6-4.2-2.8-6.4-7-7 4.2-.6 6.4-2.8 7-7z"/><path d="M19 15.5v4M17 17.5h4"/>',
 // steps inside steps
 chev:'<path d="m6 9 6 6 6-6"/>',
 dots:'<circle cx="5" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="19" cy="12" r="1.2"/>',
 expand:'<path d="M15 3.5h5.5V9M9 20.5H3.5V15M20.5 3.5 14 10M3.5 20.5 10 14"/>',
 indent:'<path d="M3.5 5h17M11 10h9.5M11 14.5h9.5M3.5 19.5h17"/><path d="m3.5 9 3.5 3.3-3.5 3.2"/>',
 outdent:'<path d="M3.5 5h17M11 10h9.5M11 14.5h9.5M3.5 19.5h17"/><path d="M7 9 3.5 12.3 7 15.5"/>',
 up:'<path d="M12 19.5v-15M6 10.5l6-6 6 6"/>',
 down:'<path d="M12 4.5v15M6 13.5l6 6 6-6"/>',
 sub:'<path d="M5.5 4v8.5a3.5 3.5 0 0 0 3.5 3.5h10.5"/><path d="m15.5 12 4 4-4 4"/>',
 eyeoff:'<path d="M3 3l18 18"/><path d="M10.6 5.1A9.6 9.6 0 0 1 12 5c6 0 9.5 7 9.5 7a17 17 0 0 1-2.9 3.7M6.6 6.6C3.9 8.3 2.5 12 2.5 12S6 19 12 19a9.4 9.4 0 0 0 5.4-1.6"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/>',
 colall:'<path d="m17 11.5-5-5-5 5M17 18.5l-5-5-5 5"/>',
 expall:'<path d="m7 5.5 5 5 5-5M7 12.5l5 5 5-5"/>'
};

/* ================= types and sub-types ================= */
const K=(k,t,i,ph)=>({k,t,i,ph});
const TYPES=[
 {k:'cctv',t:'CCTV',tip:'View, collect or preserve footage',kinds:[
   K('canvass','Canvass for cameras','pin','e.g. Canvass Dorset St for cameras'),
   K('preserve','Ask them to preserve it','shield','e.g. Ask Centra to keep Friday night’s footage'),
   K('collect','Collect / download','download','e.g. Collect CCTV — Centra, Dorset St'),
   K('view','View the footage','play','e.g. View the bus footage'),
   K('stills','Stills / identification','stills','e.g. Stills of the suspect for identification')]},
 {k:'statement',t:'Statement',tip:'Take or finish a statement',kinds:[
   K('ip','Injured party','plaster','e.g. Statement from the injured party'),
   K('wit','Witness','eye','e.g. Statement from the shop assistant'),
   K('own','My own statement','userpen','e.g. My statement — Tuesday’s arrest'),
   K('sus','Suspect — memo of interview','speech','e.g. Interview the suspect'),
   K('med','Medical report','clipcross','e.g. Medical report from the Mater'),
   K('vis','Victim impact statement','fileheart','e.g. Victim impact statement before sentence')]},
 {k:'arrest',t:'Arrest / warrant',tip:'Arrest to make — named suspect, warrant, person wanted',kinds:[
   K('suspect','Named suspect','user','e.g. Arrest the suspect for the burglary'),
   K('bench','Bench warrant','gavel','e.g. Bench warrant — address on PULSE'),
   K('warrant','Arrest warrant','warrant','e.g. Execute the arrest warrant'),
   K('wanted','Wanted on PULSE','target','e.g. Person wanted by another station'),
   K('bail','Breach of bail','chain','e.g. Breach of bail conditions'),
   K('committal','Committal warrant','bars','e.g. Committal warrant — convey to prison')]},
 {k:'enquiry',t:'Enquiries',tip:'House-to-house, shops, agencies, tracing someone…',kinds:[
   K('h2h','House-to-house','houses','e.g. House-to-house on Summerhill'),
   K('shop','Shops & businesses','shop','e.g. Ask the shops on Talbot St'),
   K('agency','Council / HSE / agency','civic','e.g. Ask the council about the CCTV'),
   K('vehicle','Vehicle / owner','traffic','e.g. Find the registered owner'),
   K('trace','Trace a person','feet','e.g. Trace the witness'),
   K('online','Online / social media','globe','e.g. Check the seller’s online profile'),
   K('spsv','SPSV / taxi licence','taxi','e.g. SPSV driver licence — new applicant'),
   K('licence','Other licence / permit','idcard','e.g. Licence enquiry for the applicant'),
   K('hosp','Hospital','hosp','e.g. Check on the injured party at the Mater'),
   K('station','Other station / unit','radio','e.g. Ask Store St about their incident')]},
 {k:'visit',t:'Call to house',tip:'House call at an address',kinds:[
   K('enq','Enquiries at the address','door','e.g. House call — 12 Summerhill'),
   K('callback','Call back — nobody home','again','e.g. Call back to 12 Summerhill'),
   K('welfare','Welfare check','heartpulse','e.g. Welfare check — Gardiner St'),
   K('serve','Serve a document','serve','e.g. Serve the summons'),
   K('curfew','Bail / curfew check','clock','e.g. Curfew check — 22:00')]},
 {k:'call',t:'Phone call',tip:'Ring back / follow up',kinds:[
   K('ip','Injured party','plaster','e.g. Ring the injured party back'),
   K('wit','Witness','eye','e.g. Ring the witness to arrange a statement'),
   K('agency','Agency','civic','e.g. Ring Tusla'),
   K('biz','Business','shop','e.g. Ring the shop manager'),
   K('station','Station / unit','radio','e.g. Ring Store St'),
   K('hosp','Hospital','hosp','e.g. Ring the hospital ward'),
   K('again','Ring again — no answer','again','e.g. Ring again — no answer earlier')]},
 {k:'file',t:'File / PULSE',tip:'Update PULSE, prepare a file',kinds:[
   K('pulse','PULSE update','pulse','e.g. Update the PULSE incident'),
   K('charged','Charged — court file','gavel','e.g. Court file — charged with theft'),
   K('dpp','For directions — not charged','signpost','e.g. File for directions — assault'),
   K('traffic','Traffic file','traffic','e.g. Traffic file — no insurance'),
   K('fatal','Fatal / serious collision','warn','e.g. Fatal collision file'),
   K('sudden','Sudden death — Coroner','lily','e.g. Sudden death — file for the Coroner'),
   K('missing','Missing person','missing','e.g. Missing person — update the file'),
   K('youth','Youth diversion (JLO)','child','e.g. Youth referral — shoplifting'),
   K('domestic','Domestic abuse','homeheart','e.g. Domestic abuse incident — follow-up'),
   K('caution','Adult caution','hand','e.g. Adult caution — report to the Superintendent'),
   K('disclosure','Disclosure','cliplist','e.g. Disclosure schedule for the file')]},
 {k:'court',t:'Court',tip:'Court date, summons, warrant',kinds:[
   K('date','Court date','cal','e.g. Court 8, CCJ — 10:30'),
   K('summons','Apply for a summons','fileplus','e.g. Apply for a summons — s.4 Public Order'),
   K('serve','Serve a summons','serve','e.g. Serve the summons on the defendant'),
   K('warrant','Apply for a warrant','warrant','e.g. Apply for a search warrant'),
   K('bail','Bail / remand','key','e.g. Bail objection — Tuesday'),
   K('outcome','Record the outcome','clipcheck','e.g. Record the court outcome')]},
 {k:'limit',t:'Time limit',tip:'Summons deadline for a summary offence'},
 {k:'exhibit',t:'Exhibit',tip:'Lodge, send to the lab, return property',kinds:[
   K('lodge','Lodge in the property store','cube','e.g. Lodge the seized bike'),
   K('lab','Send to FSI (lab)','flask','e.g. Send the swabs to FSI'),
   K('drugs','Drugs','pill','e.g. Send the drugs for analysis'),
   K('digital','Phone / digital','phone','e.g. Phone for examination'),
   K('return','Return to the owner','undo','e.g. Return the bike to the owner'),
   K('dispose','Disposal','bin','e.g. Disposal of old property')]},
 {k:'traffic',t:'Road traffic',tip:'Documents, collisions, seized vehicles, checkpoints',kinds:[
   K('docs','Documents produced','idcard','e.g. Check licence and insurance produced'),
   K('collision','Collision report','warn','e.g. Collision report — Dorset St'),
   K('seized','Seized vehicle','lock','e.g. Seized car — release or dispose'),
   K('fcn','Fixed charge notice','ticket','e.g. Fixed charge notice to issue'),
   K('checkpoint','Checkpoint','cone','e.g. Checkpoint — North Circular'),
   K('tax','Tax / insurance / NCT','shield','e.g. Check the NCT and tax')]},
 {k:'victim',t:'Victim care',tip:'Keep victims informed and supported',kinds:[
   K('update','Update the victim','chat','e.g. Update the injured party on the case'),
   K('assess','Needs assessment','clipcheck','e.g. Victim needs assessment'),
   K('refer','Refer to support','refer','e.g. Refer to support services'),
   K('letter','Information letter','letter','e.g. Victim information letter')]},
 {k:'email',t:'Email / letter',tip:'Request, reply, agency letter',kinds:[
   K('request','Request','send','e.g. Email the council for footage'),
   K('reply','Reply','reply','e.g. Reply to the solicitor'),
   K('report','Internal report','memo','e.g. Report to the Superintendent'),
   K('letter','Letter','letter','e.g. Letter to the injured party'),
   K('records','Records request','db','e.g. Phone records request')]},
 {k:'night',t:'Night shift',tip:'Something to do on nights',win:'night',kinds:[
   K('premises','Premises check','torch','e.g. Check the back of the shops on Parnell St'),
   K('pubs','Licensed premises','pint','e.g. Licensed premises check'),
   K('curfew','Curfew check','clock','e.g. Curfew check — 23:00'),
   K('patrol','Patrol point','pin','e.g. Patrol the lane behind the chipper')]},
 {k:'admin',t:'Admin',tip:'Claims, training, kit, leave, forms',kinds:[
   K('claim','Claims / overtime','euro','e.g. Submit the overtime claim'),
   K('course','Training / course','cap','e.g. Book the driving course'),
   K('kit','Uniform & kit','shirt','e.g. Order new boots'),
   K('leave','Leave / roster','cal','e.g. Apply for annual leave'),
   K('forms','Forms to sign','pen','e.g. Sign the passport form'),
   K('meeting','Meeting / briefing','people','e.g. Unit briefing')]},
 {k:'other',t:'Other',tip:'Anything else'}
];
const TY=Object.fromEntries(TYPES.map(x=>[x.k,x]));
const tyOf=t=>TY[t&&t.type]||TY.other;
const kindOf=t=>{ const ty=tyOf(t); return (ty.kinds&&t&&t.kind&&ty.kinds.find(k=>k.k===t.kind))||null; };
const icOf=t=>{ const k=kindOf(t); return IC[k?k.i:tyOf(t).k]||IC.other; };
const tyLabel=t=>{ const k=kindOf(t); return tyOf(t).t+(k?' · '+k.t:''); };

/* the usual steps — a starting checklist the user can change; follow current Garda policy and your Sergeant's direction */
const STEPS={
 'cctv':['Ask how long the system keeps footage','Ask them to preserve it now','Check the system clock — note any difference from the real time','Download or collect a copy (note the format and any player needed)','Exhibit it — label and continuity','Statement from whoever produced it'],
 'cctv.canvass':['Walk the route — note every camera (shops, homes, buses, traffic)','Note the owner or contact for each','Ask each one to preserve the footage','Add a CCTV task for each one with footage'],
 'cctv.preserve':['Ask how long the system keeps footage','Ask them to preserve the times you need','Send the request in writing','Arrange to collect it'],
 'cctv.view':['Note who viewed it, when and where','Viewing notes — times and what’s seen','Stills of anyone of interest','Viewing notes to the file'],
 'cctv.stills':['Clear stills — note the camera and time','Circulate for identification (with approval)','Record any identification'],
 'statement':['Arrange a time and place','Take the statement','Read it over — signed, alterations initialled','Add it to the file and PULSE'],
 'statement.ip':['Arrange a time and place','Take the statement — injuries, loss and damage','Read it over — signed, alterations initialled','Consent for a medical report, if injured','Give them the PULSE number and your contact details','Add it to the file'],
 'statement.wit':['Arrange a time and place','Take the statement — what they saw, from where, lighting, distance','Read it over — signed, alterations initialled','Ask about CCTV, phone footage, other witnesses','Add it to the file'],
 'statement.own':['From your notebook — times, words used, caution','Write and sign it','List the exhibits you’re producing','Add it to the file'],
 'statement.sus':['Prepare — evidence, exhibits, questions','Solicitor offered — note it in the custody record','Interview — caution, recorded','Memo signed, or refusal noted','Custody record updated'],
 'statement.med':['Signed consent from the patient','Request the report from the doctor or hospital','Chase it','Add it to the file'],
 'statement.vis':['Explain what a victim impact statement is','Take it, or help them write it','To the prosecutor before sentence'],
 'arrest':['Check PULSE — warnings, address, photo','Plan it — when, where, who’s with you','Arrest — tell them why, and caution','To the station — member in charge','Custody record / detention clock','Update PULSE'],
 'arrest.bench':['Check the warrant is still in force','Find them — address, associates, haunts','Arrest — tell them it’s on a warrant','Bring them before the court as the warrant directs','Update the warrant on PULSE'],
 'arrest.warrant':['Check the warrant is still in force','Find them','Arrest — tell them it’s on a warrant and why','Bring them before the court as the warrant directs','Update the warrant on PULSE'],
 'arrest.wanted':['Confirm they’re still wanted (PULSE / circulating station)','Find them','Arrest or detain as the circulation says','Tell the circulating station','Update PULSE'],
 'arrest.bail':['Check the bail conditions (court order)','Evidence of the breach — statements, CCTV','Report it — arrest or bail application, as directed','Update PULSE'],
 'arrest.committal':['Check the warrant is still in force','Find them','Arrest on the warrant','Convey them to the prison named on the warrant','Update the warrant on PULSE'],
 'enquiry':['What you need to find out','Make the enquiries','Record the result (PULSE / notes)'],
 'enquiry.h2h':['Set the area — streets and numbers','Call to each house — note answers and no replies','Leave a card where nobody’s home','Call back to the no replies','Note CCTV and doorbell cameras','Statements from anyone who saw something'],
 'enquiry.shop':['Ask the staff on duty at the time','Ask about CCTV and how long it’s kept','Manager’s name and number','Record the result'],
 'enquiry.agency':['Find the right contact (department, email)','Request in writing, with the PULSE number','Chase a reply','Record the result'],
 'enquiry.vehicle':['Check the registration on PULSE','Registered owner — contact or call to the address','Who was driving at the time?','Record the result'],
 'enquiry.trace':['Last known address and phone (PULSE)','Family, friends, work','Social media (open sources)','Other stations and units','Record the result'],
 'enquiry.online':['Screenshot with the link, date and time','Note the account details','Request data through the proper channel','Record the result'],
 'enquiry.spsv':['Application, photographs, ID and proof of address received','Identity and address verified (originals seen)','PULSE person and address searches — all name and DOB variants','Convictions, pending prosecutions, penalty points','Driving licence (and immigration status) verified','Enquiries where the applicant lived before','Interview the applicant','Meet both referees — ID verified, PULSE checks','Cover report with recommendation — SPSV stencil'],
 'enquiry.licence':['Check the applicant on PULSE','Call to the address','Your report and recommendation','Submit through your Sergeant'],
 'enquiry.hosp':['Speak to the ward or ED staff','Condition (with consent)','Consent for a medical report','Record the result'],
 'enquiry.station':['Which station or unit, and who','Ring or email with the PULSE number','Chase a reply','Record the result'],
 'visit':['Check PULSE for the address (warnings)','Call to the address','Record the result'],
 'visit.callback':['Leave a card','Try another time — early or evening','Ring, if you have a number','Note each attempt'],
 'visit.welfare':['Check PULSE and history at the address','Call to the address','See the person — safe and well?','Refer on if needed (HSE, family)','Record the result'],
 'visit.serve':['Check the document and who it’s for','Serve it','Note the time, place and who you served','Proof of service'],
 'visit.curfew':['Check the bail conditions — times and address','Call within the curfew hours','Note the time and who answered','Report any breach'],
 'file':['Statements in','Exhibits listed','Cover report','Submit for review','Update PULSE'],
 'file.pulse':['Create or update the incident','Persons, vehicles, property added','Narrative up to date','Status / outcome updated'],
 'file.charged':['Charge sheet — copy to the accused','Court date (station bail or custody)','Statements and exhibits in order','Cover report and file','Disclosure schedule','Update PULSE'],
 'file.dpp':['All statements taken','Interview notes / memo','Exhibits and lab results','Cover report with your recommendation','Submit through your Sergeant for directions','Update PULSE'],
 'file.traffic':['Driver — licence and insurance','Vehicle — registration, tax, NCT','Statements','Photos or a sketch of the scene','Breath print-out or MBRS certificate (drink / drug driving)','Cover report and PULSE'],
 'file.fatal':['Scene preserved — Forensic Collision Investigators','Next of kin informed','Coroner informed','Family Liaison Officer','Statements, CCTV, dash cam','Vehicles examined','File for the Coroner and the DPP'],
 'file.sudden':['Death pronounced (doctor or paramedic) — note who and when','Identify the deceased','Next of kin informed','Report to the Coroner','Statements — who found them, who last saw them alive, the doctor','Property and valuables recorded','Removal / post-mortem as the Coroner directs'],
 'file.missing':['Full description and a recent photo','Risk assessment','Circulate on PULSE','Check the home, hospitals, friends, social media','Keep the family updated','When found — safe and well check, cancel the circulation'],
 'file.youth':['Under 18 at the time, and accepts responsibility','Referral to the Garda National Youth Diversion Bureau','Victim’s views','Parent or guardian informed','Update PULSE'],
 'file.domestic':['Victim safety and risk','Any orders in place (safety, protection, barring)','Statements and photos','Support services information','Recorded as domestic abuse on PULSE','Follow-up contact with the victim'],
 'file.caution':['Offence covered by the Adult Caution Scheme','Accepts responsibility and agrees to a caution','Victim’s views','Report to the Superintendent for a decision','Caution given','Update PULSE'],
 'file.disclosure':['List all material — used and unused','Flag anything sensitive','Schedule to the prosecutor','Keep it under review'],
 'court.date':['Check the court list and time','Notebook, statements and exhibits ready','Witnesses told','Record the outcome on PULSE'],
 'court.summons':['Check the time limit','Apply to the District Court office','Summons issued','Serve it','Proof of service'],
 'court.serve':['Check the summons — name, address, court date','Serve it','Note the time, place and how it was served','Proof of service'],
 'court.warrant':['Grounds — sworn information','Apply to the judge (or as the Act allows)','Execute it within the time on the warrant','Record what was done and found'],
 'court.bail':['Grounds for objecting — or not','Your evidence ready','Conditions to ask for','Record the outcome'],
 'court.outcome':['Result and next date','Update PULSE','Tell the injured party','Exhibits — keep or return'],
 'exhibit':['Label — number, description, where and when found, by whom','Seal it','Lodge it','Property record / PULSE'],
 'exhibit.lab':['Labelled and sealed','FSI submission form','Deliver it — continuity recorded','Chase the result','Result to the file'],
 'exhibit.drugs':['Seal and label — description and count','Lodge it (drugs safe / property store)','Send to FSI for analysis','Certificate of analysis to the file'],
 'exhibit.digital':['Isolate it from the network (flight mode / Faraday bag)','Note make, model, condition, whether locked','Authority to examine (consent or warrant)','Request the examination','Continuity recorded'],
 'exhibit.return':['Check it’s no longer needed','Contact the owner','ID and signature on return','Update the property record'],
 'exhibit.dispose':['Authority to dispose','Dispose of it as policy says','Update the property record'],
 'traffic.docs':['Check the licence and insurance','Note the details','Not produced — follow up','Update PULSE'],
 'traffic.collision':['Injuries? Scene safe?','Details — drivers, insurers, witnesses','Photos and measurements','Statements','Collision report on PULSE'],
 'traffic.seized':['Notice given','Removal to the pound','Check the documents when produced','Release or disposal','Update PULSE'],
 'traffic.checkpoint':['Authorisation in place','Results recorded','Follow-ups added'],
 'traffic.tax':['Check the vehicle on PULSE','Contact the owner','Proof produced?','Fixed charge or summons'],
 'victim.update':['What’s happened since the last update','Call or meet the victim','Your name, station and the PULSE number','Note the update on PULSE'],
 'victim.assess':['Needs assessment done','Protection / special measures noted','Recorded on PULSE'],
 'victim.refer':['Ask what support they want','Details of support services','Refer, with their consent','Note it on PULSE'],
 'email.request':['Right contact or department','Send the request with the PULSE number','Chase a reply','Reply to the file'],
 'email.records':['Check the legal route and authority','Request through the proper channel','Chase it','Result to the file'],
 'night.premises':['Check doors and windows','Anything wrong — contact the keyholder','Record the check'],
 'night.curfew':['Check the bail conditions — times and address','Call within the curfew hours','Note the time and who answered','Report any breach'],
 'admin.course':['Apply or book','Roster sorted','Attend','Certificate recorded'],
 'admin.claim':['Fill in the claim','Signed off','Submitted']
};
const stepsFor=t=>STEPS[(t.type||'other')+'.'+(t.kind||'')]||STEPS[t.type||'other']||null;
const sid=()=>'s'+Math.random().toString(36).slice(2,8);

/* ================= steps: as many levels as the job needs =================
   A step: {id, t, done, due, rem:[minutes before], n:note, c:collapsed, u:changed, steps:[…sub-steps]}.
   A step with sub-steps is done when all of them are — ticking it ticks them all. */
const MAXD=6, MAXN=800;
const kids=n=>(n&&Array.isArray(n.steps))?n.steps:[];
function walk(list,fn,d,par){ (list||[]).forEach((n,i)=>{ fn(n,d||1,par||null,i); if(kids(n).length)walk(n.steps,fn,(d||1)+1,n); }); }
const isDone=n=>kids(n).length?kids(n).every(isDone):!!n.done;
const anyStep=(t,fn)=>{ let r=false; walk(t&&t.steps,n=>{ if(!r&&fn(n))r=true; }); return r; };
function cnt(list){ let n=0,m=0; walk(list,x=>{ if(!kids(x).length){ m++; if(x.done)n++; } }); return {n,m}; }
function nodeCount(list){ let k=0; walk(list,()=>{ k++; }); return k; }
function locate(list,id,par){ list=list||[]; for(let i=0;i<list.length;i++){ const x=list[i]; if(x.id===id)return {n:x,list,i,par:par||null}; const r=locate(x.steps,id,x); if(r)return r; } return null; }
function pathTo(list,id){ const p=[]; (function f(L){ for(const x of (L||[])){ p.push(x); if(x.id===id||f(x.steps))return true; p.pop(); } return false; })(list); return p; }
const levelOf=(list,id)=>pathTo(list,id).length;
const height=n=>1+Math.max(0,...kids(n).map(height));
function norm(list){ (list||[]).forEach(n=>{ if(!n.id)n.id=sid(); if(Array.isArray(n.steps)&&!n.steps.length)delete n.steps;
    if(kids(n).length){ norm(n.steps); n.done=n.steps.every(isDone)?(Math.max(...n.steps.map(k=>k.done||0))||Date.now()):null; } });
  return list; }
function pruneEmpty(list,keep){ for(let i=(list||[]).length-1;i>=0;i--){ const x=list[i]; if(kids(x).length)pruneEmpty(x.steps,keep); if(!String(x.t||'').trim()&&!kids(x).length&&x.id!==keep)list.splice(i,1); } return list; }
function nextStepDue(t){ let b=null; walk(t&&t.steps,n=>{ if(n.due&&!isDone(n)&&(b==null||n.due<b))b=n.due; }); return b; }
function firstOpen(list){ for(const n of (list||[])){ if(isDone(n))continue; if(kids(n).length){ const k=firstOpen(n.steps); if(k)return k; } else return n; } return null; }
const tplText=x=>Array.isArray(x)?x[0]:x;
function tplNodes(a){ return (a||[]).map(x=>Array.isArray(x)?{id:sid(),t:String(x[0]),done:null,steps:tplNodes(x[1])}:{id:sid(),t:String(x),done:null}); }
// a pasted list → steps.  A line starting "-" (or "•") goes under the plain line above it, "--" two levels in; indenting
// (spaces or tabs) and "1.2.3" numbering also set the level; "[x]" or "✓" marks a step done
function parseOutline(txt,maxd){ maxd=Math.max(1,maxd||MAXD);
  const root=[], st=[{ind:-1,list:root}];
  String(txt||'').replace(/\r/g,'').split('\n').forEach(raw=>{ if(!raw.trim())return;
    const m=/^([ \t\u00a0]*)(.*)$/.exec(raw); let ind=m[1].replace(/\t/g,'    ').length, s=m[2].trim(), done=false;
    const num=/^(\d+(?:\.\d+)*)[.)]?\s+(?=\S)/.exec(s);
    if(num){ ind=ind||(num[1].split('.').length-1)*4; s=s.slice(num[0].length); }
    else{ const b=/^(-{1,6}|[*•·▪◦›>+])\s*(?=\S)/.exec(s); if(b&&(b[1][0]!=='-'||/\s/.test(s.charAt(b[0].length-1))||b[1].length>1)){ ind+=(b[1][0]==='-'?b[1].length:1)*4; s=s.slice(b[0].length); } }
    const ck=/^(\[[ xX✓✔]?\]|[☐□✓✔☑])\s*/.exec(s); if(ck){ done=/[xX✓✔☑]/.test(ck[1]); s=s.slice(ck[0].length); }
    s=s.replace(/\s+/g,' ').trim().slice(0,200); if(!s)return;
    while(st.length>1&&st[st.length-1].ind>=ind)st.pop();
    while(st.length>maxd)st.pop();
    const node={id:sid(),t:s,done:done?Date.now():null}; st[st.length-1].list.push(node); st.push({ind,list:(node.steps=[])}); });
  return norm(root); }
function stepDues(t){ const out=[]; walk(t.steps,n=>{ if(n.due&&!isDone(n))[...new Set(n.rem&&n.rem.length?n.rem:[0])].forEach(m=>out.push(['s'+m+':'+n.id+':'+n.due,n.due-m*MIN,n])); }); return out; }
// a step's own type and time window, in words — "CCTV · Business hours 09:00–17:30 Mon–Fri"
function stepTags(n){ const w=n.win?winOf(n):null; return [n.pri>=1&&n.pri<=4?LV[n.pri]:'', n.type&&TY[n.type]?TY[n.type].t:'', n.win?(w?w.label.trim()+(w.days!=='all'?' '+DAYSET[w.days]:''):'any time'):'',
    n.avail==='away'?'going away'+(n.awayBy?' '+day(n.awayBy):''):n.avail==='hard'?'hard to reach':n.avail==='lim'?'only free at certain times':''].filter(Boolean).join(' · '); }
function stepLines(list,ind,notes){ const L=[]; (list||[]).forEach(n=>{ const d=isDone(n), tg=stepTags(n); L.push(ind+'['+(d?'x':' ')+'] '+n.t+(tg?' ('+tg+')':'')+(n.due&&!d?' — by '+full(n.due):'')); if(notes&&n.n)L.push(ind+'      ('+n.n.replace(/\s*\n\s*/g,' · ')+')'); L.push(...stepLines(n.steps,ind+'  ',notes)); }); return L; }

const WINS=[
 {k:'any',t:'Any time'},
 {k:'business',t:'Business hours',from:'09:00',to:'17:30',days:'weekdays',tip:'Shops, offices, agencies'},
 {k:'early',t:'Early morning',from:'06:00',to:'09:00',tip:'Catch people at home before work'},
 {k:'lunch',t:'Lunchtime',from:'12:00',to:'14:00'},
 {k:'evening',t:'Evening',from:'17:00',to:'21:00',tip:'People home from work'},
 {k:'night',t:'Night shift',from:'22:00',to:'07:00'},
 {k:'custom',t:'Custom'}
];
const WN=Object.fromEntries(WINS.map(x=>[x.k,x]));
const DAYSET={all:'Every day',weekdays:'Mon–Fri',weekend:'Sat–Sun'};
const REMS=[[0,'At the time'],[15,'15 min before'],[60,'1 hour before'],[DAY/MIN,'1 day before'],[7*DAY/MIN,'1 week before'],[30*DAY/MIN,'1 month before']];

/* ================= storage ================= */
let DB=load();
function load(){try{const d=JSON.parse(localStorage.getItem(LS)||'null');if(d&&Array.isArray(d.tasks))return d;}catch(e){}return {v:1,tasks:[]};}
function persist(){try{localStorage.setItem(LS,JSON.stringify(DB));}catch(e){}}
function save(){persist();paintStrips();if(W.grSyncDirty)W.grSyncDirty();}
function prefs(){try{return JSON.parse(localStorage.getItem(LSP)||'{}')||{};}catch(e){return {};}}
function setPref(k,v){const p=prefs();p[k]=v;try{localStorage.setItem(LSP,JSON.stringify(p));}catch(e){}}
function purge(){const now=Date.now(),n=DB.tasks.length;DB.tasks=DB.tasks.filter(t=>!t.done||now-t.done<30*DAY);if(n!==DB.tasks.length)persist();}
purge();
const byId=id=>DB.tasks.find(t=>t.id===id);
const open_=()=>DB.tasks.filter(t=>!t.done);

/* ================= time windows ================= */
const hmMin=s=>{const m=/^(\d{1,2}):(\d{2})$/.exec(s||'');return m?(+m[1])*60+(+m[2]):null;};
function winOf(t){ const w=WN[t.win||'any']||WN.any; if(w.k==='any')return null;
  const from=w.k==='custom'?t.wFrom:w.from, to=w.k==='custom'?t.wTo:w.to; const a=hmMin(from),b=hmMin(to);
  if(a==null||b==null||a===b)return null; return {k:w.k,a,b,days:t.wDays||w.days||'all',label:(w.k==='custom'?'':w.t+' ')+from+'–'+to}; }
const dayOK=(days,dow)=>days==='weekdays'?(dow>=1&&dow<=5):days==='weekend'?(dow===0||dow===6):true;
// is time `now` inside the window?  Overnight windows (22:00–07:00) belong to the day they start.
function inWin(w,now){ const d=new Date(now), m=d.getHours()*60+d.getMinutes(), dow=d.getDay();
  if(w.a<w.b)return m>=w.a&&m<w.b&&dayOK(w.days,dow);
  if(m>=w.a)return dayOK(w.days,dow);
  if(m<w.b)return dayOK(w.days,(dow+6)%7);
  return false; }
function nextOpen(w,now){ // start of the next window after now
  const base=new Date(now); base.setSeconds(0,0);
  for(let i=0;i<9;i++){ const d=new Date(base); d.setDate(base.getDate()+i); d.setHours(Math.floor(w.a/60),w.a%60,0,0);
    if(d.getTime()>now&&dayOK(w.days,d.getDay()))return d.getTime(); }
  return null; }
function winState(t,now){ const w=winOf(t); if(!w)return {any:true,open:true};
  const o=inWin(w,now); return {w,open:o,next:o?null:nextOpen(w,now)}; }
/* a step can have its own time window, or follow the step it's under — and in the end the task's */
const curOpen=(w,now)=>{ const d=new Date(now), m=d.getHours()*60+d.getMinutes(); return new Date(d.getFullYear(),d.getMonth(),d.getDate()-(w.a>w.b&&m<w.b?1:0),0,w.a).getTime(); };   // when the window you're in opened
function upWin(t,id){ const p=pathTo(t.steps,id).slice(0,-1); for(let i=p.length-1;i>=0;i--)if(p[i].win)return {w:winOf(p[i]),src:p[i]}; return {w:winOf(t),src:null}; }
function openLeaves(t){ const out=[];   // the smallest steps still to do, each with the window it can be done in
  (function f(L,w){ (L||[]).forEach(n=>{ if(isDone(n))return; const ww=n.win?winOf(n):w; if(kids(n).length)f(n.steps,ww); else out.push([n,ww]); }); })(t.steps,winOf(t));
  return out; }
// can the task be worked on now? With steps: is any step still to do inside its window?
function taskWin(t,now){ const L=t.done?[]:openLeaves(t); if(!L.length)return winState(t,now);
  const nw=[]; let wins=0, next=null, k=null, k0=null;
  L.forEach(([n,w])=>{ if(!w){ nw.push(n); return; } wins++;
    if(inWin(w,now)){ nw.push(n); if(!k0)k0=w.k; } else { const x=nextOpen(w,now); if(x!=null&&(next==null||x<next)){ next=x; k=w.k; } } });
  if(!wins)return {any:true,open:true,now:nw};
  const o=nw.length>0; return {open:o,next:o?null:next,k:o?(k0||'any'):k,now:nw,part:o&&nw.length<L.length}; }

/* ================= urgency: how pressing each step is =================
   Worked out from the deadlines that bind it — its own date, the step it is under, the task, the next court date, the
   6-month summons limit, CCTV overwrite, the day the person goes away — and from the case: with the DPP (on hold),
   suspect not interviewed (the interview comes first). "Hard to reach" and an urgent task push it up a level.
   Set it yourself and that wins. Levels: 1 Low · 2 Normal · 3 High · 4 Critical. */
const LV=[null,'Low','Normal','High','Critical'];
const STAGES=[{k:'inv',t:'Investigating',s:'nobody charged yet',i:'enquiry'},{k:'file',t:'File for the DPP',s:'still to send',i:'file'},{k:'dpp',t:'With the DPP',s:'waiting for directions',i:'send'},
  {k:'charged',t:'Charged',s:'before the court',i:'court'},{k:'summons',t:'Summons',s:'6-month limit',i:'limit'},{k:'traffic',t:'Traffic file',s:'6-month limit',i:'traffic'}];
const STG=Object.fromEntries(STAGES.map(x=>[x.k,x]));
const AVAIL=[['','Not set'],['easy','Easy to get'],['lim','Only certain times'],['hard','Hard to reach'],['away','Going away']];
function caseOf(t){ const c=Object.assign({},(t&&t.cs)||{});
  if(!c.st&&t){ const g=t.type==='file'?({charged:'charged',dpp:'file',traffic:'traffic'})[t.kind]:t.type==='limit'?'summons':null; if(g){ c.st=g; c.guess=true; } }
  if(!c.off&&t&&t.type==='limit'&&t.sol&&t.sol.off)c.off=t.sol.off;
  return c; }
const isIntv=n=>n.type==='arrest'||/\binterview|\bcautioned\b|\bsuspect\b/i.test(n.t||'');
function urgOf(t,n,now,inh){ const c=caseOf(t), why=[]; let D=null, dw='', dk='';
  const dl=(ms,txt,k)=>{ if(ms!=null&&!isNaN(ms)&&(D==null||ms<D)){ D=ms; dw=txt; dk=k||''; } };
  const av=n?(n.avail?n:(inh&&inh.av)||{}):{};
  if(n){ if(n.due)dl(n.due,'Do it by'); if(inh&&inh.due!=null)dl(inh.due,inh.why); if(av.avail==='away'&&av.awayBy)dl(av.awayBy,'They’re going away','away'); }
  if(t.due)dl(t.due,planned(t)?'Planned for your tour, ending':'The task is due');
  if(c.st==='charged'&&c.court)dl(c.court,'Court date');
  if((c.st==='summons'||c.st==='traffic')&&c.off)dl(limitEnd(c.off,6),'Last day to apply for the summons','limit');
  if(t.type==='cctv'){ const ow=cctvOverwrite(t.cctv); if(ow)dl(ow,'Footage may be overwritten'); }
  let lv=2;
  if(D!=null){ const left=D-now, cd=Math.round((sod(D)-sod(now))/DAY);   // a summons application has to reach the court office in time — so that limit is pressing a month out
    // other dates count in calendar days, so a court date a week away is High all day — not only after the hour it's listed for
    lv=dk==='limit'?(left<=7*DAY?4:left<=30*DAY?3:left<=60*DAY?2:1):(left<0?4:cd<=2?4:cd<=7?3:cd<=28?2:1);
    why.push(dw+' '+(left<0?'— overdue by '+durStr(-left):(dk==='away'||dk==='limit'?day(D):rel(D,now))+' ('+durStr(left)+' left)')); }
  if(c.st==='dpp'&&!(n&&n.due)){ lv=Math.max(1,lv-1); why.push('With the DPP — waiting for directions'); }
  if(c.st==='charged'&&!c.court)why.push('Charged — add the next court date');
  if(c.intv==='no'&&c.st!=='dpp'&&(!n||isIntv(n))){ lv=Math.min(4,lv+1); why.push(n?'Suspect not interviewed yet':'Suspect not interviewed yet — the file can’t go without it'); }
  if(n&&av.avail==='hard'){ lv=Math.min(4,lv+1); why.push('Hard to reach — start early'); }
  if(n&&av.avail==='lim')why.push('Only free at certain times'+(n.win?'':' — set them under “When can it be done?”'));
  if(n&&av.avail==='away'&&!av.awayBy)why.push('Going away — add the date');
  if(t.urgent){ lv=Math.min(4,lv+1); why.push('The task is marked urgent'); }
  if(!why.length)why.push('No deadline yet');
  const auto=lv; if(n&&n.pri>=1&&n.pri<=4){ lv=n.pri; why.unshift('Set by you'+(n.pri!==auto?' (worked out as '+LV[auto]+')':'')); }
  return {lv,auto,why,dl:D}; }
// every open step's urgency in one pass — dates and availability carry down to the steps underneath
function stepUrgs(t,now){ const M=new Map();
  (function f(L,inh){ let mx=0; (L||[]).forEach(n=>{ if(isDone(n))return; const u=urgOf(t,n,now,inh); M.set(n.id,u); u.leaf=!kids(n).length;
      if(!u.leaf){ const nd=n.due&&(inh.due==null||n.due<inh.due)?{due:n.due,why:'“'+String(n.t).slice(0,40)+'” is due'}:{due:inh.due,why:inh.why};
        u.mx=Math.max(u.lv,f(n.steps,{due:nd.due,why:nd.why,av:n.avail?{avail:n.avail,awayBy:n.awayBy}:inh.av})); } else u.mx=u.lv;
      mx=Math.max(mx,u.mx); }); return mx; })(t.steps,{due:null,why:'',av:null});
  return M; }
function taskUrg(t,now){ const own=urgOf(t,null,now), M=t.done?new Map():stepUrgs(t,now); let lv=own.lv, n4=0, n3=0, dl=own.dl;
  M.forEach(u=>{ if(!u.leaf)return; if(u.lv>lv)lv=u.lv; if(u.lv===4)n4++; else if(u.lv===3)n3++; if(u.dl!=null&&(dl==null||u.dl<dl))dl=u.dl; });
  return {lv,own,M,n4,n3,dl}; }   // dl: the earliest date anything in it is bound by (court, limit, step dates, someone going away)

/* ================= roster: your tours ================= */
// Uses My roster (roster.js) when it is set up. A tour is {s,e,code,label,ico}: start and end of a working day's tour.
function RO(){ try{ return W.GRRoster&&W.GRRoster._state&&W.GRRoster._state()?W.GRRoster:null; }catch(e){ return null; } }
function dayInf(d){ const R=RO(); if(!R)return null; try{ return R.dayInfo(d); }catch(e){ return null; } }
function tourOf(i){ if(!i||i.off||!i.from||!i.to)return null; const a=hmMin(i.from), b=hmMin(i.to); if(a==null||b==null)return null; const d=i.d;
  return {s:new Date(d.getFullYear(),d.getMonth(),d.getDate(),0,a).getTime(), e:new Date(d.getFullYear(),d.getMonth(),d.getDate()+(b<=a?1:0),0,b).getTime(),
    code:i.code,label:String(i.label||'Tour').replace(/ \(.*\)$/,''),ico:i.ico||'',tag:i.tag||null}; }
const d0=(ms,k)=>{ const d=new Date(ms); return new Date(d.getFullYear(),d.getMonth(),d.getDate()+(k||0)); };
function tours(from,n,maxDays){ const out=[]; if(!RO())return out;
  for(let k=-1;k<(maxDays||42)&&out.length<n;k++){ const sp=tourOf(dayInf(d0(from,k))); if(sp&&sp.e>from)out.push(sp); }
  return out; }
function tourAt(ms){ for(const k of [0,-1]){ const sp=tourOf(dayInf(d0(ms,k))); if(sp&&ms>=sp.s&&ms<=sp.e)return sp; } return null; }
// the latest tour that starts before `ms` — null if it has already finished
function lastTourBefore(ms,now){ for(let k=0;k>-28;k--){ const sp=tourOf(dayInf(d0(ms,k))); if(sp&&sp.s<ms)return sp.e>now?sp:null; } return null; }
// the first stretch of a coming tour (30 min or more) that falls inside the task's time window — "next chance on duty"
function nextChance(t,now){ const w=winOf(t);
  for(const sp of tours(now,14,42)){ const s0=Math.max(sp.s,now);
    if(!w){ if(sp.e-s0>=30*MIN)return {s:s0,e:sp.e,tour:sp}; continue; }
    for(let k=-1;k<=1;k++){ const d=d0(sp.s,k); if(!dayOK(w.days,d.getDay()))continue;
      const ws=new Date(d.getFullYear(),d.getMonth(),d.getDate(),0,w.a).getTime(), we=new Date(d.getFullYear(),d.getMonth(),d.getDate()+(w.b<=w.a?1:0),0,w.b).getTime();
      const s=Math.max(s0,ws), e=Math.min(sp.e,we); if(e-s>=30*MIN)return {s,e,tour:sp}; } }
  return null; }
const planned=t=>!!(t&&t.tour&&t.tour.ts!=null&&t.tour.e===t.due);
const tourShort=(tr,now)=>(now>=tr.ts&&now<tr.te?'this tour':String(tr.label||'Tour').split(' ')[0]+' '+DAYS[new Date(tr.ts).getDay()]+' '+new Date(tr.ts).getDate());
// tasks for a tour: planned for it, or (not planned elsewhere) due before it ends
function tourTasks(sp){ return open_().filter(t=>planned(t)?(t.tour.ts<sp.e&&t.tour.te>sp.s):((t.due&&t.due<=sp.e)||(x=>x&&x<=sp.e)(nextStepDue(t)))); }
// a reminder at the start of the planned tour (or of the window inside it)
function tourRem(t){ if(!planned(t)||!(t.tour.s<t.tour.e))return null;
  return [Math.round((t.tour.e-t.tour.s)/MIN), t.tour.s===t.tour.ts?'Start of tour':'When it opens ('+hm(t.tour.s)+')']; }

/* ================= my days: your detail for each tour, and the jobs that suit it =================
   Your detail (car, station, files…) for each working day is kept with My roster. Each open job — and each sub job
   inside one — is matched to a day by where it gets done (out and about, meeting someone, on the phone, at a desk,
   in the station, at court), the hours it can be done in, roughly how long it takes and its deadline. Most urgent
   first, into the earliest part of a tour that suits it; the rest into the best fit while there's time left. */
const DETS=()=>{ const R=RO(); return (R&&R.DET)||[]; };
const detOf=k=>DETS().find(x=>x.k===k)||null;
// how well each detail suits each kind of work (0 = it can't be done), and the share of a tour left for your own jobs
const DFIT={car:{out:1,meet:1,phone:1,stn:.5,desk:.3},beat:{out:.8,meet:1,phone:1,stn:.3,desk:.2},station:{stn:1,desk:1,phone:1,meet:.8},
  files:{desk:1,phone:1,stn:1,meet:.7,out:.4},court:{court:1,phone:.6,desk:.4},event:{phone:.3},escort:{phone:.4,desk:.3},training:{phone:.2},
  other:{out:.6,meet:.6,phone:.6,stn:.6,desk:.6,court:.6},'':{out:.7,meet:.7,phone:.7,stn:.7,desk:.7,court:.7}};
const DOWN={car:.3,beat:.3,station:.4,files:.8,court:.3,event:.1,escort:.1,training:.05,other:.3,'':.35};
const MODE={cctv:'out','cctv.preserve':'phone','cctv.view':'desk','cctv.stills':'desk',statement:'meet','statement.own':'desk','statement.sus':'stn','statement.med':'desk',
  arrest:'out',enquiry:'out','enquiry.agency':'phone','enquiry.vehicle':'desk','enquiry.trace':'desk','enquiry.online':'desk','enquiry.spsv':'desk','enquiry.licence':'desk','enquiry.station':'phone',
  visit:'out',call:'phone',file:'desk',court:'desk','court.date':'court','court.bail':'court','court.serve':'out',limit:'desk',exhibit:'stn','exhibit.lab':'out',
  traffic:'desk','traffic.checkpoint':'out','traffic.docs':'stn',victim:'phone','victim.letter':'desk','victim.assess':'meet',email:'desk',night:'out',admin:'desk','admin.meeting':'stn',other:'any'};
const MODET={out:'out and about',meet:'meeting someone',phone:'on the phone',desk:'at a desk',stn:'in the station',court:'at court',any:''};
const EST={cctv:45,'cctv.canvass':60,'cctv.view':60,'cctv.stills':30,'cctv.preserve':10,statement:90,'statement.own':45,'statement.sus':120,'statement.med':15,arrest:120,
  enquiry:45,'enquiry.h2h':120,'enquiry.spsv':120,'enquiry.online':30,visit:30,call:10,file:120,'file.pulse':20,court:30,'court.date':240,'court.outcome':15,limit:30,
  exhibit:30,'exhibit.lab':90,traffic:30,'traffic.checkpoint':60,'traffic.docs':15,victim:20,email:15,night:20,admin:20,other:30};
const kv=(o,ty,kd)=>o[ty+'.'+(kd||'')]!=null?o[ty+'.'+(kd||'')]:o[ty];
const fitOf=(k,m)=>{ const F=DFIT[k]||DFIT['']; return m==='any'?Math.max(0,...Object.values(F)):(F[m]||0); };
// a step's own words can say where it's done — "Ring the manager", "Collect the footage", "Update PULSE"
function modeOfText(s){ s=String(s||'').toLowerCase().trim();
  if(/^(ring|phone|text|call (him|her|them|back))\b|^arrange\b|\b(ring|phone) (the|him|her|them)\b/.test(s))return 'phone';
  if(/^(collect|call to|call round|go to|visit|attend|canvass|serve|deliver|walk the|find (him|her|them)|arrest|house-to-house|check on)\b/.test(s))return 'out';
  if(/^(take (the|a|her|his|their) statement|statement from|meet|read it over)\b/.test(s))return 'meet';
  if(/^(update pulse|pulse|cover report|type|write|email|send the|submit|add it to the file|disclosure|request the|fill in)\b/.test(s))return 'desk';
  return null; }
// the hours a job can be done in when you haven't set any: people at reasonable hours, offices in business hours, shops in shop hours
const WPEOPLE={k:'people',a:480,b:1260,days:'all',label:'reasonable hours (08:00–21:00)'}, WBIZ={k:'business',a:540,b:1050,days:'weekdays',label:'business hours (09:00–17:30 Mon–Fri)'},
  WSHOP={k:'shops',a:480,b:1200,days:'all',label:'shop hours (about 08:00–20:00)'};
function impWin(ty,kd,mode){ const k=ty+'.'+(kd||'');
  if(ty==='night'||/^(visit\.(curfew|welfare)|call\.(station|hosp)|enquiry\.(station|hosp))$/.test(k))return null;
  if(mode==='phone')return /^(call\.(biz|agency)|enquiry\.agency)$/.test(k)?WBIZ:WPEOPLE;
  if(ty==='cctv'||k==='enquiry.shop')return mode==='out'?WSHOP:null;
  if(/^(court\.(summons|warrant)|exhibit\.lab)$/.test(k))return WBIZ;
  if(mode==='meet'||ty==='visit'||k==='enquiry.h2h')return WPEOPLE;
  return null; }
// minutes of window w inside [s,e), and when it first opens in there
function winIn(w,s,e){ if(!(e>s))return {m:0,at:null}; if(!w)return {m:(e-s)/MIN,at:s}; let m=0, at=null;
  for(let k=-1;k<20;k++){ const d=d0(s,k); if(d.getTime()>=e)break; if(!dayOK(w.days,d.getDay()))continue;
    const ws=new Date(d.getFullYear(),d.getMonth(),d.getDate(),0,w.a).getTime(), we=new Date(d.getFullYear(),d.getMonth(),d.getDate()+(w.b<=w.a?1:0),0,w.b).getTime();
    const a=Math.max(s,ws), b=Math.min(e,we); if(b>a){ m+=(b-a)/MIN; if(at==null||a<at)at=a; } }
  return {m,at}; }
const dkeyOf=d=>d.getFullYear()+'-'+p2(d.getMonth()+1)+'-'+p2(d.getDate());
const keyDate=k=>{ const [y,m,d]=String(k).split('-').map(Number); return new Date(y,m-1,d); };
// the changeover for a half-and-half day — on the tour, after it starts (a night's "01:00" is the next morning)
function changeAt(sp,at){ const t=hmMin(at); if(t==null)return null; const d=new Date(sp.s); let c=new Date(d.getFullYear(),d.getMonth(),d.getDate(),0,t).getTime(); if(c<=sp.s)c+=DAY; return c>sp.s&&c<sp.e?c:null; }
const midTour=sp=>{ const c=new Date(sp.s+(sp.e-sp.s)/2); c.setMinutes(0,0,0); return hm(c.getTime()); };
// your run of working days — the one you're in, or the next one
function block(now){ const R=RO(); if(!R)return null; const first=tours(now,1)[0]; if(!first)return null;
  let d=d0(first.s,0); for(let i=0;i<10&&tourOf(dayInf(d0(d.getTime(),-1)));i++)d=d0(d.getTime(),-1);
  const days=[]; for(let k=0;k<8;k++){ const dd=d0(d.getTime(),k), inf=dayInf(dd), sp=tourOf(inf); if(!sp)break;
    const x=R.detail?R.detail(dd):null, c=x&&x.b?changeAt(sp,x.at):null;
    days.push({d:dd,key:dkeyOf(dd),sp,inf,det:x,past:sp.e<=now,cur:sp.s<=now&&now<sp.e,
      segs:c?[{k:x.a,s:sp.s,e:c,half:1},{k:x.b,s:c,e:sp.e,half:2}]:[{k:x?x.a:'',s:sp.s,e:sp.e}]}); }
  return days.length?{days,n:days.length}:null; }
// the pieces of work to place: each job (its own steps), and each sub job given its own category inside one
function planUnits(now,B){ const out=[], b0=B?B.days[0].sp.s:null, b1=B?B.days[B.days.length-1].sp.e:null;
  open_().forEach(t=>{ const M=stepUrgs(t,now), own=urgOf(t,null,now), subs=[], mine=[];
    (function f(L,w,inSub){ (L||[]).forEach(n=>{ if(isDone(n))return; const ww=n.win?winOf(n):w, hit=!inSub&&!!(n.type&&n.type!==t.type&&TY[n.type]);
      if(hit)subs.push({n,w:ww}); else if(!inSub&&!kids(n).length)mine.push([n,ww]); f(n.steps,ww,inSub||hit); }); })(t.steps,winOf(t),false);
    const anyStep=(t.steps||[]).some(n=>!isDone(n));
    if(mine.length||!anyStep){ let lv=own.lv, dl=own.dl; mine.forEach(([n])=>{ const u=M.get(n.id); if(u){ lv=Math.max(lv,u.lv); if(u.dl!=null&&(dl==null||u.dl<dl))dl=u.dl; } });
      const nx=mine.length?mine[0][0]:null; let mode=(nx&&modeOfText(nx.t))||kv(MODE,t.type||'other',t.kind)||'any', fix=planned(t)?t.tour.ts:null;
      // a court date in these days is the day you're at court; one after them leaves the preparation to do now
      if(mode==='court'){ if(t.due&&b0!=null&&t.due>=b0-12*H&&t.due<b1)fix=t.due; else mode='desk'; }
      out.push({key:t.id,t,n:null,ty:t.type||'other',kd:t.kind,nx,mode,w:(nx&&mine[0][1])||winOf(t)||impWin(t.type||'other',t.kind,mode),lv,dl,fix}); }
    subs.forEach(({n,w})=>{ const u=M.get(n.id)||{lv:2,mx:2,dl:null}; let dl=u.dl; walk(n.steps,x=>{ const v=M.get(x.id); if(v&&v.dl!=null&&(dl==null||v.dl<dl))dl=v.dl; });
      const nx=firstOpen(n.steps)||n, mode=(nx!==n&&modeOfText(nx.t))||modeOfText(n.t)||MODE[n.type]||'any';
      out.push({key:t.id+'|'+n.id,t,n,ty:n.type,kd:null,nx,mode,w:w||impWin(n.type,null,mode),lv:Math.max(u.lv,u.mx||0),dl,fix:null}); }); });
  return out; }
function plan4(now){ const B=block(now); if(!B)return null; const segs=[];
  B.days.forEach((D_,di)=>D_.segs.forEach(g=>{ g.di=di; g.items=[]; g.s0=Math.max(g.s,now); g.room=g.e>g.s0?Math.round((g.e-g.s0)/MIN*(DOWN[g.k]!=null?DOWN[g.k]:.35)):0; g.cap=g.room; if(g.e>g.s0)segs.push(g); }));
  const endB=B.days[B.days.length-1].sp.e, nxt=tours(endB+MIN,1)[0]||null, offTo=nxt?nxt.s:null, left=[], spare=[];
  const U=planUnits(now,B).sort((a,b)=>(b.lv-a.lv)||((a.dl||9e15)-(b.dl||9e15))||((a.t.created||0)-(b.t.created||0)));
  U.forEach(u=>{ const need=kv(EST,u.ty,u.kd)||30; u.need=need; u.off=u.dl!=null&&u.dl>endB&&offTo!=null&&u.dl<offTo;
    let pool=segs;
    if(u.fix!=null){ const fd=B.days.findIndex(D_=>u.fix>=D_.sp.s&&u.fix<D_.sp.e||sod(u.fix)===sod(D_.sp.s)); if(fd>=0)pool=segs.filter(g=>g.di===fd); }
    const C=pool.filter(g=>{ if(u.fix==null&&fitOf(g.k,u.mode)<.5)return false; const end=u.dl!=null&&u.dl>g.s0?Math.min(g.e,u.dl):g.e; return winIn(u.w,g.s0,end).m>=Math.min(need,30); });
    if(!C.length){ left.push({u,why:whyNot(u,segs,need)}); return; }
    if(u.fix!=null)C.sort((a,b)=>((b.s0<=u.fix&&u.fix<b.e)-(a.s0<=u.fix&&u.fix<a.e))||a.s-b.s);   // a fixed time goes in the part of the tour it falls in
    const urgent=u.fix!=null||u.lv>=3||(u.dl!=null&&u.dl<=endB)||u.off, roomy=C.filter(g=>g.cap>=need*.5);
    let g=null;
    if(urgent)g=roomy[0]||C[0];
    else g=roomy.slice().sort((a,b)=>(fitOf(b.k,u.mode)-.12*b.di)-(fitOf(a.k,u.mode)-.12*a.di)||a.s-b.s)[0]||null;
    if(!g){ spare.push(u); return; }
    g.cap-=need; const end=u.dl!=null&&u.dl>g.s0?Math.min(g.e,u.dl):g.e; u.at=u.fix!=null&&u.mode==='court'?u.fix:winIn(u.w,g.s0,end).at; g.items.push(u); });
  segs.forEach(g=>g.items.sort((a,b)=>(b.lv-a.lv)||(a.at||0)-(b.at||0)));
  return {B,segs,left,spare,endB,offTo,now}; }
function whyNot(u,segs,need){ const D_=DETS().filter(x=>fitOf(x.k,u.mode)>=.5).map(x=>x.t);
  if(!segs.length)return 'No more of your tours in this run';
  if(!segs.some(g=>fitOf(g.k,u.mode)>=.5))return 'Needs you '+MODET[u.mode]+' — set a day to '+(D_.slice(0,3).join(' or ')||'a detail that suits it');
  if(u.dl!=null&&u.dl<segs[0].s0)return 'Was due '+rel(u.dl,Date.now())+' — do it as soon as you can';
  if(u.w)return 'Needs '+(u.w.label||'its time window').trim()+' — your '+[...new Set(segs.filter(g=>fitOf(g.k,u.mode)>=.5).map(g=>(detOf(g.k)||{t:'tour'}).t.toLowerCase()))].join(' / ')+' time doesn’t cover that'+(u.dl!=null?' before it’s due':'');
  return 'Doesn’t fit before it’s due '+rel(u.dl,Date.now()); }
// what a stretch of a tour is good for, from its hours and the detail
function goodFor(g){ const L=[], len=(g.e-g.s0)/MIN, biz=winIn(WBIZ,g.s0,g.e).m, eve=winIn({a:1020,b:1260,days:'all'},g.s0,g.e).m, late=winIn({a:1320,b:420,days:'all'},g.s0,g.e).m;
  if(biz>=90)L.push('shops and offices open'); if(eve>=60)L.push('people home in the evening'); if(late>=len*.5)L.push('late — checks and files, no house calls');
  const k={car:'calls come first',beat:'calls come first',station:'people can come in to you',files:'desk time',court:'court first — calls and emails while you wait'}[g.k]; if(k)L.push(k);
  return L.join(' · '); }
const spanTxt=(s,e)=>hm(s)+'–'+hm(e);
function unitRow(u,now){ const t=u.t, n=u.n, ty=TY[u.ty]||TY.other, D_=u.dl;
  let chips='';
  if(u.lv>=3)chips+='<span class="tk-chip ug l'+u.lv+'">'+svg(IC.flag)+LV[u.lv]+'</span>';
  if(D_!=null)chips+='<span class="tk-chip '+(D_<now?'od':sod(D_)===sod(now)?'td':'')+'">'+(D_<now?'overdue '+esc(durStr(now-D_)):'by '+esc(rel(D_,now)))+'</span>';
  if(u.off)chips+='<span class="tk-chip od">due while you’re off</span>';
  const why=[MODET[u.mode]?MODET[u.mode].replace(/^./,c=>c.toUpperCase()):'', u.w&&u.at&&u.at>now+5*MIN?'from '+hm(u.at):'', u.w?(u.w.label||'').replace(/ \(.*\)$/,''):''].filter(Boolean).join(' · ');
  const id=n?t.id+'|'+n.id:t.id;
  return '<div class="tk-row d4r'+(u.lv>=4?' od':'')+'" data-key="'+esc(id)+'">'
   +'<button type="button" class="tk-ck" '+(n?'data-sck':'data-ck')+'="'+esc(id)+'" aria-label="Mark done">'+svg(IC.check)+'</button>'
   +'<button type="button" class="tk-body" '+(n?'data-sop':'data-ed')+'="'+esc(id)+'"><span class="tk-ico ty-'+ty.k+'">'+svg(n?(IC[ty.k]||IC.other):icOf(t))+'</span>'
   +'<span class="tk-txt"><b>'+esc(n?n.t:(t.title||ty.t))+'</b>'+(n?'<small class="tk-in-job">'+svg(IC.sub)+'in '+esc(tyOf(t).t)+': '+esc((t.title||'').slice(0,60))+'</small>':u.nx?'<small class="tk-next">Next: '+esc(String(u.nx.t).slice(0,80))+'</small>':'')
   +(why?'<small class="d4-why">'+esc(why)+'</small>':'')+(chips?'<span class="tk-chips">'+chips+'</span>':'')+'</span></button></div>'; }
let dFocus=null, retView=null;
function openDays(key){ if(!ov||ov.hidden)openTasks(); commitEdit(); view='days'; dFocus=key||null; render(); }
function renderDays(){ const now=Date.now(); ov.querySelector('.tk-title').textContent='My days'; ov.querySelector('.tk-fab').hidden=true; ov.querySelector('.tk-copy').hidden=true; ov.querySelector('.tk-scan').hidden=true;
  let h='<div class="tk-wrap">';
  if(!RO()){ main.innerHTML=h+empty('Set up My roster first','Your tours come from My roster — then set your detail for each day here.')+'<button type="button" class="tk-go wide d4-ro">Set up My roster</button></div>';
    main.querySelector('.d4-ro').onclick=()=>{ closeTasks(); if(W.openRoster)W.openRoster(); }; return; }
  const P=plan4(now);
  if(!P){ main.innerHTML=h+empty('No tours coming up','My roster has no working days in the next six weeks.')+'</div>'; return; }
  const B=P.B, ci=B.days.findIndex(x=>x.cur), last=B.days[B.days.length-1];
  h+='<div class="d4-top"><b>Your '+B.n+' day'+(B.n===1?'':'s')+' · '+esc(day(B.days[0].sp.s))+' – '+esc(day(last.sp.s))+'</b><small>'
    +(ci>=0?'You’re on day '+(ci+1)+' of '+B.n+' — '+esc(B.days[ci].sp.label)+' until '+hm(B.days[ci].sp.e)+' ('+esc(durStr(B.days[ci].sp.e-now))+' left)'
      :B.days[0].sp.s>now?'Starts '+esc(day(B.days[0].sp.s))+' '+hm(B.days[0].sp.s)+' — in '+esc(durStr(B.days[0].sp.s-now)):'Between tours — next '+esc(rel((B.days.find(x=>!x.past)||last).sp.s,now)))+'</small></div>'
    +'<p class="tk-note">Set your detail for each day — car, station, files, half days. Your jobs are matched to it, the time of day and each job’s deadline. Tap a job to open it.</p>';
  B.days.forEach((D_,di)=>{ const sp=D_.sp, x=D_.det, dt=x?detOf(x.a):null, dt2=x&&x.b?detOf(x.b):null;
    h+='<section class="d4-day'+(D_.past?' past':'')+(D_.cur?' cur':'')+'" data-day="'+D_.key+'"><div class="d4-hd"><span class="d4-dn"><b>'+esc(day(sp.s).replace(/ \w+$/,''))+'</b><small>Day '+(di+1)+' of '+B.n+'</small></span>'
      +'<span class="d4-tour">'+esc(sp.ico||'')+' '+esc(sp.label)+' '+spanTxt(sp.s,sp.e)+'</span><span class="d4-st">'+(D_.cur?'Now · '+esc(durStr(sp.e-now))+' left':D_.past?'Done':sod(sp.s)===sod(now)?'Today':sod(sp.s)===sod(now+DAY)?'Tomorrow':'')+'</span></div>';
    if(!D_.past)h+='<button type="button" class="d4-det'+(x?'':' none')+'" data-dd="'+D_.key+'">'+(x?'<span class="d4-di">'+esc(dt.i)+(dt2?'<i>'+esc(dt2.i)+'</i>':'')+'</span><span class="d4-dt"><b>'+esc(dt.t)+(dt2?' → '+esc(dt2.t)+'</b><small>changes at '+esc(hm(D_.segs[1].s))+'</small>':'</b>')+(x.note?'<small>'+esc(x.note)+'</small>':'')+'</span><em>Change</em>'
        :'<span class="d4-di">＋</span><span class="d4-dt"><b>Set your detail</b><small>Car, station, files, half and half…</small></span><em>Set</em>')+'</button>';
    else h+='<p class="d4-done">'+(x?esc(dt.i+' '+dt.t+(dt2?' → '+dt2.t:''))+' · ':'')+(n=>n?'✓ '+n+' job'+(n===1?'':'s')+' ticked off that day':'Nothing ticked off that day')(DB.tasks.filter(t=>t.done&&t.done>=sp.s&&t.done<sp.e+2*H).length)+'</p>';
    P.segs.filter(g=>g.di===di).forEach(g=>{ const gd=detOf(g.k);
      h+='<div class="d4-seg"><div class="d4-sh"><b>'+(gd?esc(gd.i+' '+gd.t):'Your tour')+' · '+spanTxt(g.s0,g.e)+'</b><small>'+(g.room?'about '+esc(durStr(g.room*MIN))+' for your own jobs':'little time for your own jobs')+(goodFor(g)?' · '+esc(goodFor(g)):'')+'</small></div>'
        +(g.items.length?g.items.map(u=>unitRow(u,now)).join(''):'<p class="d4-none">'+(gd&&DOWN[g.k]<=.1?'Not much time for your own jobs on this one.':'Nothing on your list suits this — calls and patrol.')+'</p>')+'</div>'; });
    h+='</section>'; });
  if(P.spare.length)h+='<h3 class="tk-sec">If you get time <span>'+P.spare.length+'</span></h3><p class="tk-note">These suit your days but there isn’t room for them as well.</p>'+P.spare.map(u=>unitRow(u,now)).join('');
  if(P.left.length)h+='<h3 class="tk-sec red">Not on these days <span>'+P.left.length+'</span></h3>'+P.left.map(x=>unitRow(x.u,now).replace('<span class="tk-txt">','<span class="tk-txt"><small class="d4-whynot">'+esc(x.why)+'</small>')).join('');
  if(!open_().length)h+=empty('No jobs on your list','Add your jobs and they’ll be suggested for the right day here.');
  h+='<p class="tk-foot">Suggestions only — calls, your Sergeant and the unit come first. Details are saved with My roster on this device.</p></div>';
  main.innerHTML=h; main.scrollTop=0;
  main.querySelectorAll('[data-dd]').forEach(b=>b.onclick=()=>detSheet(b.dataset.dd));
  main.querySelectorAll('[data-ck]').forEach(b=>b.onclick=()=>toggleDone(b.dataset.ck));
  main.querySelectorAll('[data-ed]').forEach(b=>b.onclick=()=>{ retView='days'; editTask(b.dataset.ed); });
  main.querySelectorAll('[data-sck]').forEach(b=>b.onclick=()=>{ const [ti,si]=b.dataset.sck.split('|'); tickSub(ti,si); });
  main.querySelectorAll('[data-sop]').forEach(b=>b.onclick=()=>{ const [ti,si]=b.dataset.sop.split('|'); retView='days'; openSub(ti,si); });
  if(dFocus){ const el=main.querySelector('.d4-day[data-day="'+dFocus+'"]'); dFocus=null; if(el)setTimeout(()=>el.scrollIntoView({block:'start'}),30); } }
function detSheet(key){ const R=RO(); if(!R)return; const dd=keyDate(key), sp=tourOf(dayInf(dd)); if(!sp)return;
  const x=R.detail(dd)||{}; let a=x.a||'', b=x.b||'', split=!!x.b, at=x.at||midTour(sp);
  const opts=(g,cur)=>DETS().map(o=>'<button type="button" class="d4-o'+(cur===o.k?' on':'')+'" data-'+g+'="'+o.k+'"><span>'+esc(o.i)+'</span><b>'+esc(o.t)+'</b><small>'+esc(o.s)+'</small></button>').join('');
  const m=hmMin(midTour(sp)), ats=[-120,-60,0,60,120].map(k=>{ const v=((m+k)%1440+1440)%1440; return p2(Math.floor(v/60))+':'+p2(v%60); }).filter(v=>changeAt(sp,v));
  if(!ats.includes(at))ats.push(at);
  sh.innerHTML='<div class="tk-grip"></div><h3>'+esc(day(sp.s))+' · '+esc(sp.label)+' '+spanTxt(sp.s,sp.e)+'</h3>'
    +'<p class="tk-note d4-l1">'+(split?'First half':'Your detail')+'</p><div class="d4-opts" data-g="a">'+opts('da',a)+'</div>'
    +'<button type="button" class="d4-split'+(split?' on':'')+'" aria-pressed="'+split+'"><b>½</b> Half and half — two details on this tour</button>'
    +'<div class="d4-half"'+(split?'':' hidden')+'><p class="tk-note">Changes at</p><div class="d4-ats">'+ats.map(v=>'<button type="button" class="tk-f'+(v===at?' on':'')+'" data-at="'+v+'">'+v+'</button>').join('')+'</div>'
    +'<p class="tk-note">Second half</p><div class="d4-opts" data-g="b">'+opts('db',b)+'</div></div>'
    +'<label class="tk-lab">Note <small>optional</small></label><input class="tk-in d4-note" maxlength="60" placeholder="e.g. Car 2 with Garda Byrne" value="'+esc(x.note||'')+'">'
    +'<p class="tk-err d4-err" hidden></p><div class="tk-row2"><button type="button" class="tk-sec-btn d4-clr"'+(x.a?'':' disabled')+'>Clear</button><button type="button" class="tk-go d4-ok">Save</button></div>';
  sh.hidden=false; ov.querySelector('.tk-shade').hidden=false;
  const pick=(g,k)=>{ sh.querySelectorAll('[data-'+g+']').forEach(o=>o.classList.toggle('on',o.dataset[g==='da'?'da':'db']===k)); };
  sh.querySelectorAll('[data-da]').forEach(o=>o.onclick=()=>{ a=o.dataset.da; pick('da',a); });
  sh.querySelectorAll('[data-db]').forEach(o=>o.onclick=()=>{ b=o.dataset.db; pick('db',b); });
  sh.querySelectorAll('[data-at]').forEach(o=>o.onclick=()=>{ at=o.dataset.at; sh.querySelectorAll('[data-at]').forEach(y=>y.classList.toggle('on',y===o)); });
  const sp_=sh.querySelector('.d4-split'); sp_.onclick=()=>{ split=!split; sp_.classList.toggle('on',split); sp_.setAttribute('aria-pressed',split); sh.querySelector('.d4-half').hidden=!split; sh.querySelector('.d4-l1').textContent=split?'First half':'Your detail'; };
  sh.querySelector('.d4-clr').onclick=()=>{ R.setDetail(dd,null); closeSheet(); render(); toast('Detail cleared'); };
  sh.querySelector('.d4-ok').onclick=()=>{ const e=sh.querySelector('.d4-err'), err=t=>{ e.textContent=t; e.hidden=!t; };
    if(!a)return err('Pick your detail.'); if(split&&!b)return err('Pick the second half.'); if(split&&b===a)return err('Pick a different detail for the second half — or turn half and half off.');
    R.setDetail(dd,{a,b:split?b:null,at:split?at:null,note:sh.querySelector('.d4-note').value.trim()}); closeSheet(); render(); toast('Saved — '+esc((detOf(a)||{}).t)+(split?' → '+esc((detOf(b)||{}).t):'')); }; }

/* ================= helpers: CCTV + time limits ================= */
function addMonths(ms,n){ const d=new Date(ms), dd=d.getDate(); const r=new Date(d); r.setDate(1); r.setMonth(r.getMonth()+n);
  const last=new Date(r.getFullYear(),r.getMonth()+1,0).getDate(); r.setDate(Math.min(dd,last)); return r.getTime(); }
// 6 months "from" the offence: the last safe day is the day before the same date 6 months on (counted cautiously)
// Irish public holidays (+ Good Friday, when court offices close) — so a "last safe day" never lands on a day the office is shut
function easter(y){ const a=y%19,b=Math.floor(y/100),c=y%100,d=Math.floor(b/4),e=b%4,f=Math.floor((b+8)/25),g=Math.floor((b-f+1)/3),h=(19*a+b-d-g+15)%30,i=Math.floor(c/4),k=c%4,l=(32+2*e+2*i-h-k)%7,m=Math.floor((a+11*h+22*l)/451),mo=Math.floor((h+l-7*m+114)/31),da=((h+l-7*m+114)%31)+1; return new Date(y,mo-1,da); }
function firstMon(y,m){ const d=new Date(y,m,1); d.setDate(1+((8-d.getDay())%7)); return d; }
function lastMon(y,m){ const d=new Date(y,m+1,0); d.setDate(d.getDate()-((d.getDay()+6)%7)); return d; }
const _hol={};
function holidays(y){ if(_hol[y])return _hol[y]; const L=[], add=d=>L.push(d.toDateString()), fixed=(m,d)=>{ const x=new Date(y,m,d); add(x); if(x.getDay()===6||x.getDay()===0){ const n=new Date(x); n.setDate(n.getDate()+(x.getDay()===6?2:1)); while(L.includes(n.toDateString()))n.setDate(n.getDate()+1); add(n); } };
  fixed(0,1); const b1=new Date(y,1,1); add(b1.getDay()===5?b1:firstMon(y,1)); fixed(2,17);
  const e=easter(y), gf=new Date(e), em=new Date(e); gf.setDate(e.getDate()-2); em.setDate(e.getDate()+1); add(gf); add(em);
  add(firstMon(y,4)); add(firstMon(y,5)); add(firstMon(y,7)); add(lastMon(y,9)); fixed(11,25); fixed(11,26);
  return (_hol[y]=L); }
const workDay=d=>d.getDay()!==0&&d.getDay()!==6&&!holidays(d.getFullYear()).includes(d.toDateString());
function limitEnd(offence,months){ const e=addMonths(sod(offence),months); const d=new Date(e); d.setDate(d.getDate()-1); d.setHours(12,0,0,0); while(!workDay(d))d.setDate(d.getDate()-1); return d.getTime(); }
function cctvOverwrite(c){ return c&&c.inc&&c.keep?c.inc+c.keep*DAY:null; }

/* ================= reminders ================= */
const permOK=()=>('Notification' in W)&&Notification.permission==='granted';
let regP=null;
function reg(){ if(!('serviceWorker' in navigator))return Promise.resolve(null);
  if(!regP)regP=Promise.race([navigator.serviceWorker.ready,new Promise(r=>setTimeout(()=>r(null),2500))]).then(r=>{if(!r)regP=null;return r;}).catch(()=>{regP=null;return null;});
  return regP; }
async function notify(title,opt){ if(!permOK())return false;
  const o=Object.assign({icon:'icons/icon-192.png',badge:'icons/badge.png',lang:'en-IE'},opt);
  try{const r=await reg(); if(r&&r.showNotification){await r.showNotification(title,o);return true;}}catch(e){}
  try{new Notification(title,o);return true;}catch(e){} return false; }
function dueTimes(t){ // [key, when, label]
  const out=[];
  if(t.due){ (t.rem||[]).forEach(m=>{ out.push(['d'+m+':'+t.due, t.due-m*MIN, 'due']); }); }
  return out; }
function check(){
  if(!permOK())return;
  const now=Date.now(); let dirty=false;
  for(const t of open_()){ t.fired=t.fired||{};
    const w=t.remWin?winOf(t):null;
    if(w){ if(!t.nextWin){t.nextWin=nextOpen(w,now);dirty=true;}
      else if(now>=t.nextWin){ const at=t.nextWin; t.nextWin=nextOpen(w,now); dirty=true;
        if(now-at<=12*H)notify((t.urgent?'🚩 ':'')+tyOf(t).t+': '+(t.title||'Task'),{
          body:'Window open now — '+w.label.trim()+(now-at>5*MIN?' (reminder was delayed — phone asleep)':'')+(t.due?' · due '+rel(t.due,now):'')+(t.notes?' · '+t.notes.slice(0,80):''),
          tag:'gr-task-'+t.id,renotify:true,vibrate:[120,80,120],data:{open:'task',id:t.id}}); } }
    const sds=stepDues(t).filter(([k,at])=>!t.fired[k]&&at<=now);
    if(sds.length){ sds.forEach(([k])=>{t.fired[k]=now;}); dirty=true; const by={};
      sds.forEach(x=>{ const id=x[2].id; if(!by[id]||x[1]>by[id][1])by[id]=x; });
      Object.values(by).forEach(([k,at,n])=>{ if(now-at>12*H||at<Math.max(n.u||0,t.updated||t.created||0)-MIN)return;
        notify((t.urgent?'🚩 ':'')+'Step: '+String(n.t).slice(0,80),{body:(n.due<=now+MIN?(n.due<now-MIN?'Overdue since '+rel(n.due,now):'Due now'):'Due '+rel(n.due,now))+(now-at>5*MIN?' (reminder was delayed — phone asleep)':'')+' · '+(t.title||tyOf(t).t),
          tag:'gr-step-'+n.id,renotify:true,vibrate:[200,100,200],data:{open:'task',id:t.id},timestamp:n.due}); }); }
    // a step's own time window has opened — "Remind me when it opens"
    for(const k in t.fired){ if(k[0]==='w'&&k[1]===':'&&now-(+k.slice(k.lastIndexOf(':')+1)||0)>3*DAY){ delete t.fired[k]; dirty=true; } }
    walk(t.steps,n=>{ if(!n.remWin||!n.win||isDone(n))return; const w=winOf(n); if(!w||!inWin(w,now))return;
      const at=curOpen(w,now), k='w:'+n.id+':'+at; if(t.fired[k])return; t.fired[k]=now; dirty=true;
      if(at<Math.max(n.u||0,t.updated||t.created||0)-MIN)return;   // it was already open when you set it — it reminds you from the next time
      notify((t.urgent?'🚩 ':'')+'Step: '+String(n.t).slice(0,80),{body:'You can do it now — '+w.label.trim()+(now-at>5*MIN?' (reminder was delayed — phone asleep)':'')+' · '+(t.title||tyOf(t).t),
        tag:'gr-stepw-'+n.id,renotify:true,vibrate:[120,80,120],data:{open:'task',id:t.id}}); });
    const due=dueTimes(t).filter(([k,at])=>!t.fired[k]&&at<=now);
    if(due.length){ due.forEach(([k])=>{t.fired[k]=now;}); dirty=true;
      const [k,at]=due.reduce((a,b)=>b[1]>a[1]?b:a);
      if(now-at>12*H||at<(t.updated||t.created||0)-MIN)continue;   // long missed, or already past when saved — the list shows it
      const late=now-at>5*MIN;
      notify((t.urgent?'🚩 ':'')+tyOf(t).t+': '+(t.title||'Task'),{
        body:(t.due<=now+MIN?(t.due<now-MIN?'Overdue since '+rel(t.due,now):'Due now'):'Due '+rel(t.due,now))+(late?' (reminder was delayed — phone asleep)':'')+(t.notes?' · '+t.notes.slice(0,80):''),
        tag:'gr-task-'+t.id,renotify:true,vibrate:t.urgent?[250,120,250,120,250]:[200,100,200],data:{open:'task',id:t.id},timestamp:t.due||at});
    }
  }
  if(dirty)persist();
}
async function enableReminders(){
  if(!('Notification' in W)){toast(W.grNotifHelp?W.grNotifHelp('none'):'This browser can’t show notifications');return false;}
  let p=Notification.permission; if(p==='default'){try{p=await Notification.requestPermission();}catch(e){}}
  if(p!=='granted'){toast(W.grNotifHelp?W.grNotifHelp('denied'):'Notifications are blocked — allow them in your phone’s settings');return false;}
  toast('Reminders on'); return true;
}

/* ================= overlay shell ================= */
let ov=null, main=null, sh=null, view='list', curId=null, tab=null, draft=null;
function build(){
  if(ov&&ov.isConnected)return;
  ov=D.createElement('div'); ov.id='tsk'; ov.hidden=true; ov.setAttribute('role','dialog'); ov.setAttribute('aria-label','Tasks');
  ov.innerHTML='<div class="tk-top"><button type="button" class="tk-back">‹ Back</button><div class="tk-tt"><b class="tk-title">Tasks</b><span class="hudclock" data-f="line"></span></div><button type="button" class="tk-sync" hidden aria-label="Sync across devices"></button><button type="button" class="tk-scan" aria-label="Photo or screenshots of a to-do list">'+svg(IC.scan)+'</button><button type="button" class="tk-copy" aria-label="Share or copy the list">'+svg(IC.share)+'</button></div>'
    +'<div class="tk-main"></div><button type="button" class="tk-fab" aria-label="New task">'+svg(IC.plus)+'</button><div class="tk-shade" hidden></div><div class="tk-sheet" hidden></div><div class="tk-toast"></div>'
    +'<div class="tk-edbar" hidden role="toolbar" aria-label="Step tools">'+[['out','outdent','Out'],['in','indent','In'],['up','up','Up'],['down','down','Down'],['sub','sub','Sub-step'],['more','dots','More'],['done','check','Done']].map(([k,i,l])=>'<button type="button" class="eb-'+k+'" data-eb="'+k+'">'+svg(IC[i])+l+'</button>').join('')+'</div>';
  D.body.appendChild(ov); main=ov.querySelector('.tk-main'); sh=ov.querySelector('.tk-sheet');
  ov.querySelector('.tk-back').onclick=()=>back();
  ov.querySelector('.tk-copy').onclick=()=>copyList();
  ov.querySelector('.tk-scan').onclick=()=>startScan();
  ov.querySelector('.tk-fab').onclick=()=>editTask(null);
  ov.querySelector('.tk-shade').onclick=()=>closeSheet();
  const eb=ov.querySelector('.tk-edbar');
  ['pointerdown','mousedown'].forEach(ev=>eb.addEventListener(ev,e=>{ if(e.target.closest('button'))e.preventDefault(); }));   // keep the keyboard up
  eb.addEventListener('click',e=>{ const b=e.target.closest('[data-eb]'); if(!b)return; const k=b.dataset.eb;
    if(k==='done'){ const a=D.activeElement; if(a&&a.blur)a.blur(); return; }
    if(k==='more'){ if(sEd)stepSheet(sEd); return; }
    stepOp(k); });
}
function toast(m){ if(!ov){if(W.grToast)W.grToast(m);return;} const t=ov.querySelector('.tk-toast'); t.innerHTML=m; t.classList.add('on'); clearTimeout(t._t); t._t=setTimeout(()=>t.classList.remove('on'),3400); }
function openTasks(id){
  build(); purge();
  const bt=D.getElementById('boot'); if(bt&&bt.parentNode)bt.parentNode.removeChild(bt);
  ov.hidden=false; D.body.classList.add('tsk-open'); closeSheet();
  if(id&&byId(id))editTask(id); else {view='list';render();}
  { const sc=ov.querySelector('.tk-sync'); let on=false; try{ on=!!(JSON.parse(localStorage.getItem('gr_sync')||'{}')||{}).on; }catch(e){} sc.hidden=!(on&&W.GRSync); if(on&&W.GRSync)W.GRSync.mountChip(sc); }
  if(W.grHudTick)W.grHudTick(); check(); return true;
}
function closeTasks(){ if(!ov)return; retView=null; closeSheet(); commitEdit(); if(curId&&draft&&(view==='plan'||view==='edit'))stepsSync(); edbar(false); sEd=null; zoomId=null; ov.hidden=true; D.body.classList.remove('tsk-open'); main.innerHTML=''; draft=null; paintStrips(); }
function back(){
  if(!ov||ov.hidden)return false;
  if(!sh.hidden){closeSheet();return true;}
  if(view==='plan'){ commitEdit(); if(curId)stepsSync(); sEd=null; edbar(false);
    if(zoomId){ const p=pathTo(draft.steps,zoomId); zoomId=p.length>1?p[p.length-2].id:null; renderPlan(); return true; }
    view='edit'; renderEdit(); const s=main.querySelector('.tk-tree')||main.querySelector('.tk-stadd'); if(s)s.scrollIntoView({block:'center'}); return true; }
  if(view==='edit'){ commitEdit(); if(curId)stepsSync(); sEd=null; edbar(false); view=retView||'list'; retView=null; draft=null; render(); return true; }
  if(view==='days'){ view='list'; render(); return true; }
  if(view==='scan'){ const big=ov&&ov.querySelector('.tk-big'); if(big){ big.remove(); return true; }
    if(scan&&(scan.mode==='type'||scan.mode==='key')){ scan.mode=scan.imgs&&scan.imgs.length?'choose':'pick'; scan.err=''; render(); return true; } scan=null; view='list'; render(); return true; }
  closeTasks(); return true;
}
function render(){ if(!ov||ov.hidden)return; if(view==='edit')renderEdit(); else if(view==='plan')renderPlan(); else if(view==='scan')renderScan(); else if(view==='days')renderDays(); else renderList(); if(W.grHudTick)W.grHudTick(); }

/* ================= list ================= */
const _cls=new WeakMap();   // sorting asks about each task many times — work it out once per redraw
function classify(t,now){ const m=t.m||t.updated||0, ck=_cls.get(t); if(ck&&ck.now===now&&ck.m===m&&ck.d===t.done)return ck.r;
  const ws=taskWin(t,now), od=t.due&&t.due<now, today=t.due&&sod(t.due)===sod(now), sd=t.done?null:nextStepDue(t);
  const r={ws,od,today,sd,sdo:!!(sd&&sd<now),sdt:!!(sd&&sd>=now&&sod(sd)===sod(now)),ug:t.done?null:taskUrg(t,now)}; _cls.set(t,{now,m,d:t.done,r}); return r;
}
function sortKey(t,now){ const c=classify(t,now); return [t.urgent?0:1, 4-(c.ug?c.ug.lv:2), (c.od||c.sdo)?0:1, Math.min(t.due||9e15,c.sd||9e15,(c.ug&&c.ug.dl)||9e15), t.created]; }
// the step to show on the task's row: the most urgent one that can be done now — or, if none can, the most urgent one
function nextPick(t,c){ const first=firstOpen(t.steps); if(!first)return null; const M=c.ug&&c.ug.M, pool=c.ws.now&&c.ws.now.length?c.ws.now:openLeaves(t).map(x=>x[0]);
  let best=null, bl=0; pool.forEach(n=>{ const l=M&&M.get(n.id)?M.get(n.id).lv:2; if(l>bl){ bl=l; best=n; } });
  best=best||first; return {n:best,lv:bl,lab:best===first?'Next':c.ws.now&&c.ws.now.includes(best)?'Now':'Most urgent'}; }
function cmp(a,b){ for(let i=0;i<a.length;i++){ if(a[i]!==b[i])return a[i]<b[i]?-1:1; } return 0; }
function row(t,now){
  const c=classify(t,now), ty=tyOf(t), kd=kindOf(t), done=!!t.done, pl=planned(t);
  let chips='';
  if(kd)chips+='<span class="tk-chip kd">'+esc(kd.t)+'</span>';
  if(t.urgent&&!done)chips+='<span class="tk-chip urg">'+svg(IC.flag)+'URGENT</span>';
  if(!done&&c.ug&&c.ug.lv>=3&&!(t.urgent&&c.ug.lv<4)){ const k=c.ug.lv===4?c.ug.n4:c.ug.n3; chips+='<span class="tk-chip ug l'+c.ug.lv+'">'+svg(IC.flag)+LV[c.ug.lv]+(k?' · '+k+' step'+(k===1?'':'s'):'')+'</span>'; }
  if(done)chips+='<span class="tk-chip">✓ done '+esc(rel(t.done,now))+'</span>';
  else{
    if(pl&&!c.od)chips+='<span class="tk-chip tour'+(c.today?' td':'')+'">'+svg(IC.cal)+esc(tourShort(t.tour,now))+(now>=t.tour.ts?' · by '+esc(hm(t.due)):'')+'</span>';
    else if(t.due)chips+='<span class="tk-chip '+(c.od?'od':c.today?'td':'')+'">'+(c.od?'overdue '+esc(durStr(now-t.due)):'due '+esc(rel(t.due,now)))+'</span>';
    if(!c.ws.any)chips+='<span class="tk-chip '+(c.ws.open?'op':'cl')+'">'+svg(IC[c.ws.k||t.win]||IC.custom)+(c.ws.part?c.ws.now.length+' step'+(c.ws.now.length===1?'':'s')+' now':c.ws.open?'open now':'opens '+esc(c.ws.next?rel(c.ws.next,now):'—'))+'</span>';
    if(t.type==='cctv'&&cctvOverwrite(t.cctv)){ const ow=cctvOverwrite(t.cctv); chips+='<span class="tk-chip '+(ow<now?'od':ow-now<2*DAY?'td':'')+'">'+(ow<now?'footage may be gone':'overwritten '+esc(rel(ow,now)))+'</span>'; }
    if(c.sd&&(!t.due||c.sd<t.due))chips+='<span class="tk-chip sd'+(c.sdo?' od':c.sdt?' td':'')+'">'+svg(IC.sub)+(c.sdo?'a step is overdue':'next step by '+esc(rel(c.sd,now)))+'</span>';
  }
  if(!done){ const cs=caseOf(t); if(cs.st&&STG[cs.st])chips+='<span class="tk-chip cs">'+svg(IC[STG[cs.st].i])+esc(STG[cs.st].t)+(cs.st==='charged'&&cs.court?' · court '+esc(day(cs.court)):(cs.st==='summons'||cs.st==='traffic')&&cs.off?' · apply by '+esc(day(limitEnd(cs.off,6))):'')+(cs.intv==='no'?' · not interviewed':'')+'</span>'; }
  if(t.steps&&t.steps.length){ const s=cnt(t.steps); chips+='<span class="tk-chip st'+(s.n===s.m?' all':'')+'">'+svg(IC.steps)+s.n+'/'+s.m+'</span>'; }
  if(t.place&&t.place.n)chips+='<span class="tk-chip pl">'+svg(IC.pin)+esc(t.place.n.slice(0,30))+'</span>';
  return '<div class="tk-row'+(done?' done':'')+(t.urgent&&!done?' urg':'')+(c.od&&!done?' od':'')+'" data-id="'+t.id+'">'
   +'<button type="button" class="tk-ck" data-ck="'+t.id+'" aria-label="'+(done?'Mark not done':'Mark done')+'">'+svg(IC.check)+'</button>'
   +'<button type="button" class="tk-body" data-ed="'+t.id+'"><span class="tk-ico ty-'+ty.k+'">'+svg(icOf(t))+'</span>'
   +'<span class="tk-txt"><b>'+esc(t.title||ty.t)+'</b>'+((p=>p?'<small class="tk-next'+(p.lab==='Now'?' now':'')+(p.lv>=3?' u'+p.lv:'')+'">'+(p.lv>=3?svg(IC.flag):'')+p.lab+': '+esc(p.n.t.slice(0,90))+'</small>'
      :t.notes?'<small>'+esc(t.notes.split('\n')[0].slice(0,90))+'</small>':'')(done?null:nextPick(t,c)))+'<span class="tk-chips">'+chips+'</span></span></button></div>';
}
/* sub jobs by category — a step given a type (Statement, CCTV…) inside a job of another type */
function subJobs(list,type,now){ const out=[];
  (list||[]).forEach(t=>{ if(t.done||t.type===type||!t.steps)return; const M=stepUrgs(t,now);
    (function f(L,w,under){ (L||[]).forEach(n=>{ if(isDone(n))return; const ww=n.win?winOf(n):w, hit=n.type===type&&!under;
      if(hit){ const u=M.get(n.id)||{lv:2,mx:2,dl:null}; out.push({t,n,w:ww,open:!ww||inWin(ww,now),next:ww&&!inWin(ww,now)?nextOpen(ww,now):null,u,lv:Math.max(u.lv,u.mx||0),dl:u.dl}); }
      f(n.steps,ww,under||hit); }); })(t.steps,winOf(t),false); });
  return out.sort((a,b)=>(b.lv-a.lv)||((a.dl||9e15)-(b.dl||9e15))||(a.t.created-b.t.created)); }
function subRow(x,now){ const n=x.n, t=x.t, ty=TY[n.type]||TY.other, od=x.dl!=null&&x.dl<now, td=x.dl!=null&&!od&&sod(x.dl)===sod(now), c=kids(n).length?cnt(n.steps):null;
  let chips='';
  if(x.lv>=3)chips+='<span class="tk-chip ug l'+x.lv+'">'+svg(IC.flag)+LV[x.lv]+(n.pri?' · set by you':'')+'</span>';
  if(n.due)chips+='<span class="tk-chip '+(n.due<now?'od':td?'td':'')+'">'+(n.due<now?'overdue '+esc(durStr(now-n.due)):'by '+esc(rel(n.due,now)))+'</span>';
  else if(x.dl!=null)chips+='<span class="tk-chip '+(od?'od':td?'td':'')+'">'+esc((x.u.why&&x.u.why[0]||'').split(' — ')[0].replace(/ \(.*$/,'').slice(0,60))+'</span>';
  if(x.w)chips+='<span class="tk-chip '+(x.open?'op':'cl')+'">'+svg(IC[x.w.k]||IC.custom)+(x.open?'open now':'opens '+esc(x.next?rel(x.next,now):'—'))+'</span>';
  if(c)chips+='<span class="tk-chip st'+(c.n===c.m?' all':'')+'">'+svg(IC.steps)+c.n+'/'+c.m+'</span>';
  return '<div class="tk-row sub'+(x.lv>=4?' od':'')+'" data-sid="'+n.id+'">'
   +'<button type="button" class="tk-ck" data-sck="'+t.id+'|'+n.id+'" aria-label="Mark this sub job done">'+svg(IC.check)+'</button>'
   +'<button type="button" class="tk-body" data-sop="'+t.id+'|'+n.id+'"><span class="tk-ico ty-'+ty.k+'">'+svg(IC[ty.k]||IC.other)+'</span>'
   +'<span class="tk-txt"><b>'+esc(n.t)+'</b><small class="tk-in-job">'+svg(IC.sub)+'in '+esc(tyOf(t).t)+': '+esc((t.title||tyOf(t).t).slice(0,70))+'</small>'
   +'<span class="tk-chips">'+chips+'</span></span></button></div>'; }
function tickSub(tid,stepId){ const t=byId(tid); if(!t)return; const x=locate(t.steps,stepId); if(!x)return; const n=x.n, was=isDone(n), at=Date.now();
  (function set(m){ m.done=was?null:at; kids(m).forEach(set); })(n); norm(t.steps); t.m=at; save(); vib(20); render();
  toast(was?'Back on the list':'Done: '+esc(String(n.t).slice(0,50))+(isDone({steps:t.steps})?' — every step of that job is done':'')); }
function openSub(tid,stepId){ if(!byId(tid))return; editTask(tid); const p=pathTo(draft.steps,stepId); if(!p.length)return; openPlan(p.length>1?p[p.length-2].id:null);
  setTimeout(()=>{ const el=main.querySelector('.sn[data-sid="'+stepId+'"]'); if(el){ el.scrollIntoView({block:'center'}); el.classList.add('flash'); setTimeout(()=>el.classList.remove('flash'),1800); } },60); }
let qry='';
function matchQ(t,q){ if(!q)return true; const k=kindOf(t);
  const st=[]; walk(t.steps,n=>{ st.push(n.t); if(n.n)st.push(n.n); if(n.type&&TY[n.type])st.push(TY[n.type].t); });
  const s=[t.title,t.notes,tyOf(t).t,k&&k.t,t.place&&t.place.n,t.place&&t.place.a,st.join(' ')].join(' ').toLowerCase();
  return q.toLowerCase().split(/\s+/).filter(Boolean).every(w=>s.includes(w)); }
function renderList(){
  const now=Date.now(); ov.querySelector('.tk-title').textContent='Tasks'; ov.querySelector('.tk-fab').hidden=false; ov.querySelector('.tk-copy').hidden=false; ov.querySelector('.tk-scan').hidden=false;
  const all=open_().sort((a,b)=>cmp(sortKey(a,now),sortKey(b,now)));
  const nowList=all.filter(t=>classify(t,now).ws.open), todayList=all.filter(t=>{const c=classify(t,now);return c.od||c.today||c.sdo||c.sdt;});
  const done=DB.tasks.filter(t=>t.done).sort((a,b)=>b.done-a.done);
  const tr=tours(now,1)[0]||null, on=!!(tr&&tr.s<=now), trList=tr?tourTasks(tr).sort((a,b)=>cmp(sortKey(a,now),sortKey(b,now))):[];
  if(!tab)tab=prefs().tab||'now'; if(tab==='tour'&&!tr)tab='now';
  const tabs=[['now','Can do now',nowList.length]].concat(tr?[['tour',on?'This tour':'Next tour',trList.length]]:[],[['today','Due today',todayList.length],['all','All',all.length],['done','Done',done.length]]);
  let h='<div class="tk-wrap">';
  if(tr)h+='<button type="button" class="tk-tourb'+(on?' on':'')+'" data-tab="tour"><span class="tbi">'+esc(tr.ico||'🗓')+'</span><span class="tbt"><b>'
    +(on?'On duty · '+esc(tr.label)+' until '+hm(tr.e):'Next tour · '+esc(tr.label)+' '+esc(day(tr.s))+' '+hm(tr.s))+'</b><small>'
    +(on?esc(durStr(tr.e-now))+' left':'in '+esc(durStr(tr.s-now)))+' · '+(trList.length?trList.length+' task'+(trList.length===1?'':'s')+' for '+(on?'this':'that')+' tour':'nothing planned for it yet')+'</small></span><em>›</em></button>';
  if(RO()){ const B=block(now), ci=B?B.days.findIndex(x=>x.cur):-1, D_=B?(ci>=0?B.days[ci]:B.days.find(x=>!x.past)):null, x=D_&&D_.det, dt=x?detOf(x.a):null, dt2=x&&x.b?detOf(x.b):null;
    h+='<button type="button" class="tk-tourb tk-4d"><span class="tbi">🗓</span><span class="tbt"><b>My days — your detail and what to do</b><small>'
      +(D_?(ci>=0?'Day '+(ci+1)+' of '+B.n:esc(day(D_.sp.s)))+' · '+(dt?esc(dt.i+' '+dt.t+(dt2?' → '+dt2.t:'')):'set your detail — car, station, files…'):'Plan your next tours')+'</small></span><em>›</em></button>'; }
  h+='<div class="tk-tabs'+(tabs.length>4?' n5':'')+'">'+tabs.map(([k,l,n])=>'<button type="button" class="tk-tab'+(tab===k?' on':'')+'" data-tab="'+k+'">'+l+' <span>'+n+'</span></button>').join('')+'</div>';
  if(DB.tasks.length>5||qry)h+='<div class="tk-srch">'+svg(IC.search)+'<input class="tk-in tk-q" type="search" enterkeyhint="search" autocomplete="off" placeholder="Search tasks" aria-label="Search tasks" value="'+esc(qry)+'"></div>';
  const type=prefs().type||'';
  // categories: a job of that type, or a sub job given that type inside any other job, counts
  const subCnt={}; all.forEach(t=>{ (function f(L,under){ (L||[]).forEach(n=>{ if(isDone(n))return; const hit=!!(n.type&&n.type!==t.type&&!(under&&under[n.type])); if(hit)subCnt[n.type]=(subCnt[n.type]||0)+1;
      f(n.steps,hit?Object.assign({},under,{[n.type]:1}):under); }); })(t.steps,null); });
  const tyN=k=>all.filter(t=>t.type===k).length+(subCnt[k]||0);
  h+='<div class="tk-filters"><button type="button" class="tk-f'+(type?'':' on')+'" data-ty="">All types</button>'+TYPES.filter(x=>x.k===type||tyN(x.k)||DB.tasks.some(t=>t.type===x.k)).map(x=>{ const n=tyN(x.k); return '<button type="button" class="tk-f'+(type===x.k?' on':'')+'" data-ty="'+x.k+'"><span class="tk-fi ty-'+x.k+'">'+svg(IC[x.k])+'</span>'+esc(x.t)+(n?' <em>'+n+'</em>':'')+'</button>'; }).join('')+'</div>';
  const f=l=>l.filter(t=>(!type||t.type===type)&&matchQ(t,qry));
  // sub jobs of the chosen category, from every other job — shown under the jobs, following the tab you're on
  const subs=type?subJobs(all,type,now).filter(x=>matchQ(x.t,qry)||!qry):[];
  const subSec=(L,head)=>L.length?'<h3 class="tk-sec">'+head+' <span>'+L.length+'</span></h3>'+L.map(x=>subRow(x,now)).join(''):'';
  let body='';
  if(tab==='now'){ const l=f(nowList), sn=subs.filter(x=>x.open); body=l.length||sn.length?l.map(t=>row(t,now)).join(''):empty(qry?'No match.':'Nothing that can be done right now.',all.length&&!qry?'Tasks waiting for their time window are under “All”.':'');
    body+=subSec(sn,'Sub jobs — '+esc(TY[type]?TY[type].t:'')+' — can do now');
    const later=f(all.filter(t=>!classify(t,now).ws.open)); if(later.length)body+='<h3 class="tk-sec">Waiting for their time window</h3>'+later.map(t=>row(t,now)).join('');
    body+=subSec(subs.filter(x=>!x.open),'Sub jobs waiting for their time window'); }
  else if(tab==='tour'){ const l=f(trList);
    body='<p class="tk-note">'+(on?'Planned for this tour, or due before it ends at '+hm(tr.e)+'.':'Planned for your next tour ('+esc(tr.label)+' '+esc(day(tr.s))+' '+hm(tr.s)+'–'+hm(tr.e)+'), or due before it ends.')+'</p>'
      +(l.length?l.map(t=>row(t,now)).join(''):empty('Nothing for '+(on?'this':'your next')+' tour.','Open a task and pick one of your tours under “Deadline” to plan it.')); }
  else if(tab==='today'){ const l=f(todayList), st=subs.filter(x=>x.dl!=null&&sod(x.dl)<=sod(now)); body=l.length||st.length?l.map(t=>row(t,now)).join(''):empty('Nothing due today.','');
    body+=subSec(st,'Sub jobs — '+esc(TY[type]?TY[type].t:'')+' — due today or overdue'); }
  else if(tab==='done'){ const l=f(done); body=l.length?'<p class="tk-note">Completed tasks are kept for 30 days, then deleted automatically.</p>'+l.map(t=>row(t,now)).join(''):empty('No completed tasks yet.',''); }
  else { const l=f(all); if(!l.length)body=subs.length?'':empty(qry?'No match.':'No tasks yet.',qry?'':'Tap ＋ to add one — CCTV to collect, a statement to take, something for nights…');
    else { const g={}; const order=['Overdue','Today','Tomorrow','This week','Later','No date'];
      l.forEach(t=>{const c=classify(t,now); let k='No date'; const ed=Math.min(t.due||9e15,c.sd||9e15,(c.ug&&c.ug.dl)||9e15); if(ed<9e15){const dd=Math.round((sod(ed)-sod(now))/DAY); k=(c.od||c.sdo)?'Overdue':dd===0?'Today':dd===1?'Tomorrow':dd<7?'This week':'Later';} (g[k]=g[k]||[]).push(t);});
      order.forEach(k=>{ if(g[k])body+='<h3 class="tk-sec'+(k==='Overdue'?' red':'')+'">'+k+' <span>'+g[k].length+'</span></h3>'+g[k].map(t=>row(t,now)).join(''); }); }
    body+=subSec(subs,'Sub jobs — '+esc(TY[type]?TY[type].t:'')+' — in other jobs'); }
  h+=body;
  if(!permOK()&&open_().some(t=>t.due||t.remWin||nextStepDue(t)||anyStep(t,n=>n.remWin&&!isDone(n))))h+='<button type="button" class="tk-remcard" data-a="rem"><b>🔕 Reminders are off</b><span>Allow notifications so due tasks can remind you.</span></button>';
  { let on=false; try{ on=!!(JSON.parse(localStorage.getItem('gr_sync')||'{}')||{}).on; }catch(e){}
    h+='<p class="tk-foot">'+(on?'Saved on this device and synced, encrypted, to your Google Drive.':'Saved only on this device.')+' Keep details of members of the public to the minimum — this isn’t your official notebook.</p>'
      +(on||!W.openSync?'':'<button type="button" class="tk-synclink">'+(W.GRI?W.GRI('cloud'):'')+'Use your tasks on your computer too — Sync across devices</button>'); }
  h+='</div>';
  main.innerHTML=h; main.scrollTop=0;
  main.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{tab=b.dataset.tab;setPref('tab',tab);renderList();});
  { const d4=main.querySelector('.tk-4d'); if(d4)d4.onclick=()=>openDays(); }
  main.querySelectorAll('[data-ty]').forEach(b=>b.onclick=()=>{setPref('type',b.dataset.ty);renderList();});
  main.querySelectorAll('[data-ck]').forEach(b=>b.onclick=()=>toggleDone(b.dataset.ck));
  main.querySelectorAll('[data-ed]').forEach(b=>b.onclick=()=>editTask(b.dataset.ed));
  main.querySelectorAll('[data-sck]').forEach(b=>b.onclick=()=>{ const [ti,si]=b.dataset.sck.split('|'); tickSub(ti,si); });
  main.querySelectorAll('[data-sop]').forEach(b=>b.onclick=()=>{ const [ti,si]=b.dataset.sop.split('|'); openSub(ti,si); });
  const rc=main.querySelector('[data-a="rem"]'); if(rc)rc.onclick=async()=>{ if(await enableReminders())renderList(); };
  const sl=main.querySelector('.tk-synclink'); if(sl)sl.onclick=()=>{ closeTasks(); W.openSync(); };
  const qi=main.querySelector('.tk-q'); if(qi)qi.oninput=()=>{ qry=qi.value; const pos=qi.selectionStart; renderList(); const q2=main.querySelector('.tk-q'); if(q2){ q2.focus(); try{ q2.setSelectionRange(pos,pos); }catch(e){} } };
}
function empty(a,b){ return '<div class="tk-empty"><b>'+esc(a)+'</b>'+(b?'<span>'+esc(b)+'</span>':'')+'</div>'; }
function toggleDone(id){
  const t=byId(id); if(!t)return;
  if(t.done){ t.done=null; t.m=Date.now(); save(); render(); toast('Back on the list'); return; }
  t.done=Date.now(); t.m=t.done; save(); vib(30); render();
  closeTag('gr-task-'+id);
  followSheet(t);
}
async function closeTag(tag){try{const r=await reg();if(!r||!r.getNotifications)return;(await r.getNotifications({tag})).forEach(n=>n.close());}catch(e){}}

/* ================= date/time inputs (24-hour) ================= */
function dtVal(ms){const d=new Date(ms);return {d:d.getFullYear()+'-'+p2(d.getMonth()+1)+'-'+p2(d.getDate()),t:p2(d.getHours())+':'+p2(d.getMinutes())};}
function parseHM(t){ const m=/^(\d{1,2}):?(\d{2})$/.exec(String(t||'').trim()); if(!m)return null; const h=+m[1],mi=+m[2]; return (h>23||mi>59)?null:[h,mi]; }
function dtHtml(key,ms,chips,raw){ const v=raw&&(raw.d||raw.t)?raw:ms==null?{d:'',t:''}:dtVal(ms);
  return '<div class="tk-dt" data-dt="'+key+'"><input type="date" class="tk-in dt-d" value="'+v.d+'" aria-label="Date"><input type="text" class="tk-in dt-t" inputmode="numeric" maxlength="5" placeholder="HH:MM" autocomplete="off" aria-label="Time, 24-hour" value="'+v.t+'">'
   +(chips?'<div class="dt-q">'+chips.map(([l,v])=>'<button type="button" data-q="'+v+'">'+l+'</button>').join('')+'</div>':'')+'<div class="dt-read"></div></div>'; }
function dtRead(root,key){ const w=root.querySelector('[data-dt="'+key+'"]'); if(!w)return NaN; const d=w.querySelector('.dt-d').value, t=parseHM(w.querySelector('.dt-t').value);
  if(!d||!t)return NaN; const [y,mo,da]=d.split('-').map(Number); return new Date(y,mo-1,da,t[0],t[1],0,0).getTime(); }
function dtSet(root,key,ms){ const w=root.querySelector('[data-dt="'+key+'"]'); if(!w)return; if(ms==null){w.querySelector('.dt-d').value='';w.querySelector('.dt-t').value='';} else {const v=dtVal(ms); w.querySelector('.dt-d').value=v.d; w.querySelector('.dt-t').value=v.t;} dtShow(root,key); }
function dtShow(root,key){ const w=root.querySelector('[data-dt="'+key+'"]'); if(!w)return; const ms=dtRead(root,key), r=w.querySelector('.dt-read');
  const tv=w.querySelector('.dt-t').value.trim(), bad=tv&&tv.length>=4&&!parseHM(tv);
  r.textContent=bad?'Use a 24-hour time, e.g. 07:35 or 19:05':isNaN(ms)?'':full(ms); r.classList.toggle('warn',!!bad); }
function quick(q){ // chip value → ms
  const n=new Date(); n.setSeconds(0,0); const at=(d,h,m)=>{const x=new Date(n);x.setDate(x.getDate()+d);x.setHours(h,m||0,0,0);return x.getTime();};
  if(q==='none')return null;
  if(q==='now')return n.getTime();
  if(/^\+\d+h$/.test(q))return n.getTime()+parseInt(q.slice(1))*H;
  if(q==='t17')return at(0,17);
  if(q==='t23')return at(0,23,0);
  if(q==='m09')return at(1,9);
  if(q==='m1030')return at(1,10,30);
  if(/^\+\d+d$/.test(q))return at(parseInt(q.slice(1)),9);
  if(q==='-1d')return n.getTime()-DAY;
  if(q==='-2h')return n.getTime()-2*H;
  return n.getTime();
}
function dtWire(root,key,onch){ const w=root.querySelector('[data-dt="'+key+'"]'); if(!w)return;
  const ti=w.querySelector('.dt-t');
  ti.addEventListener('input',()=>{const dg=ti.value.replace(/\D/g,'').slice(0,4);const v=dg.length>2?dg.slice(0,2)+':'+dg.slice(2):dg;if(v!==ti.value)ti.value=v;});
  ti.addEventListener('blur',()=>{const t=parseHM(ti.value);if(t)ti.value=p2(t[0])+':'+p2(t[1]);});
  w.querySelectorAll('input').forEach(i=>i.addEventListener('input',()=>{dtShow(root,key);onch&&onch();}));
  w.querySelectorAll('[data-q]').forEach(b=>b.addEventListener('click',()=>{dtSet(root,key,quick(b.dataset.q));onch&&onch();}));
  dtShow(root,key); }

/* ================= editor ================= */
function editTask(id){
  const t=id?byId(id):null; view='edit'; curId=t?t.id:null;
  draft=t?JSON.parse(JSON.stringify(t)):{id:uid(),type:'other',kind:null,title:'',notes:'',urgent:false,win:'any',wDays:null,due:null,rem:[0,60],remWin:false,steps:[],place:null,tour:null,created:Date.now(),done:null,fired:{}};
  if(!Array.isArray(draft.steps))draft.steps=[];
  sEd=null; zoomId=null; hideDone=!!prefs().hideDone; pruneEmpty(draft.steps); norm(draft.steps);
  render(); main.scrollTop=0;
}
let edTours=[], edLast=null, edChance=null;
function renderEdit(){
  const t=draft, now=Date.now(); if(Array.isArray(t.steps)){ pruneEmpty(t.steps,sEd); norm(t.steps); } ov.querySelector('.tk-title').textContent=curId?'Edit task':'New task'; ov.querySelector('.tk-fab').hidden=true; ov.querySelector('.tk-copy').hidden=true; ov.querySelector('.tk-scan').hidden=true;
  const ty=tyOf(t), w=WN[t.win]||WN.any;
  let h='<div class="tk-wrap tk-form">'
   +'<label class="tk-lab">Type</label><div class="tk-types">'+TYPES.map(x=>'<button type="button" class="tk-type ty-'+x.k+(x.k===t.type?' on':'')+'" data-type="'+x.k+'">'+svg(IC[x.k])+'<b>'+esc(x.t)+'</b></button>').join('')+'</div>';
  if(ty.kinds)h+='<label class="tk-lab sm">'+esc(ty.t)+' — what kind? <small>optional</small></label><div class="tk-kinds">'+ty.kinds.map(x=>'<button type="button" class="tk-kind'+(x.k===t.kind?' on':'')+'" data-kind="'+x.k+'" aria-pressed="'+(x.k===t.kind)+'"><span class="tk-ki ty-'+ty.k+'">'+svg(IC[x.i])+'</span><span>'+esc(x.t)+'</span></button>').join('')+'</div>';
  else h+='<p class="tk-hint">'+esc(ty.tip)+'</p>';
  h+='<label class="tk-lab">What needs doing</label><input class="tk-in f-title" maxlength="120" autocomplete="off" placeholder="'+esc(placeholder(t))+'" value="'+esc(t.title)+'">'
   +'<textarea class="tk-in tk-ta f-notes" maxlength="2000" placeholder="Notes — reference numbers, contact, what’s been done… (optional)">'+esc(t.notes)+'</textarea>'
   +'<button type="button" class="tk-urg'+(t.urgent?' on':'')+'">'+svg(IC.flag)+'<b>'+(t.urgent?'Urgent':'Mark as urgent')+'</b><span>'+(t.urgent?'Shown first, in red':'Tap to flag it')+'</span></button>';
  h+=caseHtml(t,now);
  if(t.type==='enquiry'&&t.kind==='spsv')h+='<button type="button" class="tk-sec-btn wide f-psv">'+svg(IC.memo)+'Open the SPSV cover report stencil</button>';
  if(t.type==='cctv'&&W.GRForms)h+='<button type="button" class="tk-sec-btn wide f-cctvf">'+svg(IC.memo)+'CCTV continuity statement — print and fill in by pen</button>';
  h+=stepsHtml(t);
  h+=placeHtml(t);
  if(t.type==='cctv')h+=cctvHtml(t,now);
  if(t.type==='limit')h+=limitHtml(t,now);
  // window
  h+='<label class="tk-lab">When can it be done?</label><div class="tk-wins">'+WINS.map(x=>'<button type="button" class="tk-win'+(x.k===t.win?' on':'')+'" data-win="'+x.k+'">'+svg(IC[x.k])+'<b>'+esc(x.t)+'</b><small>'+(x.from?esc(x.from+'–'+x.to):x.k==='any'?'no restriction':'set times')+'</small></button>').join('')+'</div>';
  if(t.win==='custom')h+='<div class="tk-cw"><input class="tk-in f-wf" inputmode="numeric" maxlength="5" placeholder="From HH:MM" value="'+esc(t.wFrom||'')+'"><span>to</span><input class="tk-in f-wt" inputmode="numeric" maxlength="5" placeholder="To HH:MM" value="'+esc(t.wTo||'')+'"></div>';
  if(t.win!=='any')h+='<div class="tk-days">'+Object.keys(DAYSET).map(k=>'<button type="button" class="tk-d'+((t.wDays||w.days||'all')===k?' on':'')+'" data-days="'+k+'">'+DAYSET[k]+'</button>').join('')+'</div>'
     +'<label class="tk-chk"><input type="checkbox" class="f-rw"'+(t.remWin?' checked':'')+'><span>Remind me when the window opens</span></label>'
     +'<p class="tk-hint wst"></p>';
  // deadline
  const RAW=t._raw||{};
  h+='<label class="tk-lab">Deadline <small>optional</small></label>'+dtHtml('due',t.due,[['Today 17:00','t17'],['Today 23:00','t23'],['Tomorrow 09:00','m09'],['+2 days','+2d'],['+1 week','+7d'],['None','none']],RAW.due);
  h+=rosterHtml(t,now);
  const tr=tourRem(t);
  h+='<div class="tk-rems"><span>Remind me</span>'+(tr?'<button type="button" class="tk-rm trm'+((t.rem||[]).includes(tr[0])?' on':'')+'" data-rm="'+tr[0]+'">'+esc(tr[1])+'</button>':'')
    +REMS.filter(([m])=>(m<=DAY/MIN||t.type==='limit'||(t.rem||[]).includes(m))&&!(tr&&m===tr[0])).map(([m,l])=>'<button type="button" class="tk-rm'+((t.rem||[]).includes(m)?' on':'')+'" data-rm="'+m+'">'+l+'</button>').join('')+'</div>';
  h+='<p class="tk-err" hidden></p><div class="tk-row2"><button type="button" class="tk-go f-save">'+(curId?'Save':'Add task')+'</button>'
   +(curId?'<button type="button" class="tk-sec-btn f-done">'+(t.done?'Not done':'✓ Mark done')+'</button>':'<button type="button" class="tk-sec-btn f-cancel">Cancel</button>')+'</div>'
   +'<div class="tk-row2 tk-out"><button type="button" class="tk-sec-btn f-mail">'+svg(IC.email)+'Email it to me</button><button type="button" class="tk-sec-btn f-cal">'+svg(IC.cal)+'Add to calendar</button></div>'
   +'<p class="tk-hint sm">'+(prefs().me?'Emails go to '+esc(prefs().me)+' · <button type="button" class="tk-inl f-me">change</button><br>':'')+'Keep personal details of members of the public out of emails and calendars.</p>'
   +(curId?'<button type="button" class="tk-link del f-del">'+svg(IC.trash)+'Delete task</button>':'')
   +'</div>';
  main.innerHTML=h;
  wireEdit();
}
/* ---------- where the case is at — it decides how urgent each step is ---------- */
function caseHtml(t,now){ const c=caseOf(t), u=urgOf(t,null,now);
  let h='<div class="tk-case"><label class="tk-lab">Where’s the case at? <small>optional — it decides how urgent each step is</small></label>'
   +'<div class="tk-stg">'+STAGES.map(x=>'<button type="button" class="tk-kind cs-st'+(c.st===x.k?' on':'')+'" data-cst="'+x.k+'" aria-pressed="'+(c.st===x.k)+'"><span class="tk-ki">'+svg(IC[x.i])+'</span><span class="cs-tx"><b>'+esc(x.t)+'</b><small>'+esc(x.s)+'</small></span></button>').join('')+'</div>';
  if(c.guess)h+='<p class="tk-hint sm">Going by the type of task — tap one to set it.</p>';
  if(c.st==='charged')h+='<label class="tk-lab sm">Next court date</label>'+dtHtml('csCourt',c.court||null,[['Tomorrow 10:30','m1030'],['+7 days','+7d'],['+14 days','+14d']],(t._raw||{}).csCourt);
  if(c.st==='summons'||c.st==='traffic')h+='<label class="tk-lab sm">Date of the offence</label>'+dtHtml('csOff',c.off||null,[['Today','now'],['Yesterday','-1d']],(t._raw||{}).csOff)+'<p class="tk-hint sm cs-lim">'+limHint(c)+'</p>';
  if(c.st)h+='<div class="cs-iv"><span>Suspect interviewed?</span>'+[['yes','Yes'],['no','Not yet'],['na','No suspect']].map(([k,l])=>'<button type="button" class="tk-d'+(c.intv===k?' on':'')+'" data-civ="'+k+'" aria-pressed="'+(c.intv===k)+'">'+l+'</button>').join('')+'</div>';
  return h+'<p class="cs-urg l'+u.lv+'">'+svg(IC.flag)+'<b>'+LV[u.lv]+'</b><span>'+esc(u.why.join(' · '))+'</span></p></div>'; }
const limHint=c=>c.off?'Last safe day to apply for the summons: <b>'+esc(dateOnly(limitEnd(c.off,6)))+'</b> — 6 months, for summary offences (indictable and either-way offences have no limit).':'Add the date of the offence to count the 6-month limit for summary offences.';
function placeholder(t){ const k=kindOf(t); if(k&&k.ph)return k.ph;
  return ({cctv:'e.g. Collect CCTV — Centra, Dorset St',statement:'e.g. Statement from shop manager',arrest:'e.g. Arrest on bench warrant — address on PULSE',enquiry:'e.g. Enquiries at the shops on Talbot St',night:'e.g. Check back lane behind the chipper',call:'e.g. Ring the injured party back',visit:'e.g. House call — 12 Summerhill',court:'e.g. Court 8, CCJ — 10:30',file:'e.g. Update PULSE incident',exhibit:'e.g. Send exhibit to FSI',traffic:'e.g. Check the insurance produced',victim:'e.g. Update the injured party',email:'e.g. Email the council for footage',limit:'e.g. Apply for summons — s.4 Public Order',admin:'e.g. Submit the overtime claim',other:'e.g. Anything to remember'})[t.type]||''; }

/* ---------- steps inside a task — and steps inside steps ---------- */
function stepsHtml(t){
  const L=t.steps||[], c=cnt(L), tpl=stepsFor(t), kd=kindOf(t), N=nodeCount(L);
  let h='<label class="tk-lab">Steps <small>'+(c.m?c.n+' of '+c.m+' done':'optional — break it into steps, and steps into smaller steps')+'</small></label>';
  if(c.m)h+='<div class="tk-prog" aria-hidden="true"><i style="width:'+Math.round(100*c.n/c.m)+'%"></i></div>';
  if(L.length){ const o={ed:sEd,now:Date.now(),budget:{left:40,cut:0}}; o.urg=stepUrgs(t,o.now); h+=treeHtml(L,o);
    if(o.budget.cut)h+='<button type="button" class="tk-link st-full more">'+svg(IC.expand)+'Show all '+N+' steps</button>'; }
  if(c.m&&c.n===c.m&&curId&&!t.done)h+='<button type="button" class="tk-alldone">'+svg(IC.check)+'All steps done — mark the task done</button>';
  h+='<div class="tk-stadd"><input class="tk-in st-new" maxlength="200" placeholder="Add a step" enterkeyhint="done" aria-label="New step"><button type="button" class="tk-sec-btn st-add" aria-label="Add the step">'+svg(IC.plus)+'</button></div>'
   +'<div class="tk-stbar">'+(L.length?'<button type="button" class="st-full">'+svg(IC.expand)+'Full screen</button>':'')+'<button type="button" class="st-paste">'+svg(IC.cliplist)+'Paste a list</button>'+(hasKey()?'<button type="button" class="st-ai">'+svg(IC.spark)+'Break it down</button>':'')+'</div>';
  if(tpl){ const have=new Set(L.map(x=>x.t)), miss=tpl.filter(x=>!have.has(tplText(x)));
    if(miss.length)h+='<button type="button" class="tk-link st-tpl">'+svg(IC.cliplist)+(L.length?'Add the rest of the usual steps ('+miss.length+')':'Add the usual steps — '+esc(kd?kd.t:tyOf(t).t))+'</button>'
      +'<p class="tk-hint sm">A starting checklist — change it to fit. Follow current Garda policy and your Sergeant’s direction.</p>'; }
  if(L.length&&N<=4&&!L.some(x=>kids(x).length))h+='<p class="tk-hint sm">Tap ⋯ on a step to give it sub-steps, a date or a note. Tap a step to change its wording.</p>';
  return h; }
function ringSvg(c){ const f=c.m?c.n/c.m:0, R=8.6, L=2*Math.PI*R;
  return '<svg viewBox="0 0 24 24" class="sn-ring" aria-hidden="true"><circle class="rb" cx="12" cy="12" r="'+R+'"/>'
    +(f>=1?'<circle class="rf" cx="12" cy="12" r="'+R+'"/><path class="rk" d="m7.9 12.3 2.7 2.7 5.5-5.8"/>'
      :f>0?'<circle class="rp" cx="12" cy="12" r="'+R+'" stroke-dasharray="'+(L*f).toFixed(2)+' '+L.toFixed(2)+'" transform="rotate(-90 12 12)"/>':'')+'</svg>'; }
function snRow(n,o){
  if(o.budget){ if(o.budget.left<=0){ o.budget.cut++; return ''; } o.budget.left--; }
  const ch=kids(n), has=ch.length>0, c=has?cnt(ch):null, done=isDone(n), now=o.now, ed=o.ed===n.id;
  const od=n.due&&!done&&n.due<now, td=n.due&&!done&&!od&&sod(n.due)===sod(now);
  let meta='';
  if(has)meta+='<span class="sn-m'+(c.n===c.m?' all':'')+'">'+c.n+'/'+c.m+'</span>';
  if(n.due&&!done)meta+='<span class="sn-m'+(od?' od':td?' td':'')+'">'+svg(IC.cal)+(od?'overdue — ':'by ')+esc(rel(n.due,now))+'</span>';
  if(n.win&&!done)meta+=winChip(n,now);
  if(n.n)meta+='<span class="sn-m nt">'+svg(IC.memo)+'<span>'+esc(n.n.split('\n')[0].slice(0,80))+'</span></span>';
  if(n.type&&TY[n.type])meta='<span class="sn-m ty"><span class="sn-tyi ty-'+n.type+'">'+svg(IC[n.type]||IC.other)+'</span>'+esc(TY[n.type].t)+'</span>'+meta;
  { const u=!done&&o.urg?o.urg.get(n.id):null, ul=u?u.mx:0; if(u&&(ul>=3||n.pri))meta='<span class="sn-m ug l'+ul+'">'+svg(IC.flag)+LV[ul]+(u.mx>u.lv?' inside':'')+'</span>'+meta; }
  let h='<div class="sn'+(done?' done':'')+(has?' par':'')+(n.c?' col':'')+(ed?' ed':'')+'" data-sid="'+n.id+'">'
   +(has?'<button type="button" class="sn-car" aria-expanded="'+(!n.c)+'" aria-label="'+(n.c?'Show':'Hide')+' its sub-steps">'+svg(IC.chev)+'</button>':'<span class="sn-car" aria-hidden="true"></span>')
   +'<button type="button" class="sn-ck" aria-label="'+(done?'Mark not done':has?'Mark it and all its sub-steps done':'Mark done')+'">'+(has?ringSvg(c):svg(IC.check))+'</button>'
   +'<div class="sn-b">'+(ed?'<textarea class="tk-in sn-in" rows="1" maxlength="200" enterkeyhint="next" aria-label="Step wording">'+esc(n.t)+'</textarea>':'<button type="button" class="sn-t">'+esc(n.t)+'</button>')
   +(meta?'<div class="sn-meta">'+meta+'</div>':'')+'</div>'
   +'<button type="button" class="sn-more" aria-label="Options for this step — sub-steps, date, move, delete">'+svg(IC.dots)+'</button></div>';
  if(has&&!n.c){ const L=o.hide?ch.filter(k=>!isDone(k)||k.id===o.ed):ch; if(L.length)h+='<div class="sn-kids">'+L.map(k=>snRow(k,o)).join('')+'</div>'; }
  return h; }
function winChip(n,now){ const w=winOf(n); if(!w)return '<span class="sn-m wn">'+svg(IC.any)+'Any time</span>';
  const o=inWin(w,now), x=o?null:nextOpen(w,now);
  return '<span class="sn-m wn'+(o?' op':'')+'">'+svg(IC[w.k]||IC.custom)+esc(w.k==='custom'?w.label:WN[w.k].t)+' · '+(o?'open now':'opens '+esc(x?rel(x,now):'—'))+'</span>'; }
function treeHtml(list,o){ const L=o.hide?(list||[]).filter(k=>!isDone(k)||k.id===o.ed):(list||[]); return '<div class="tk-tree">'+L.map(n=>snRow(n,o)).join('')+'</div>'; }

/* ---------- place: phone, email and opening hours ---------- */
const AIKEY='gr_apikey';
const hasKey=()=>{ try{ return !!(localStorage.getItem(AIKEY)||'').trim(); }catch(e){ return false; } };
const telOf=p=>String(p||'').replace(/[^\d+]/g,'');
const webOf=u=>/^https?:\/\//i.test(u)?u:'https://'+String(u||'').replace(/^\/+/,'');
const hostOf=u=>{ try{ return new URL(webOf(u)).hostname.replace(/^www\./,''); }catch(e){ return String(u||'').slice(0,40); } };
const googleUrl=q=>'https://www.google.com/search?q='+encodeURIComponent(q+' phone email');
function guessPlace(s){ s=String(s||''); const m=s.split(/\s[—–-]\s/);
  if(m.length>1){ const x=m[m.length-1].trim(); if(/[a-z]{3}/i.test(x)&&!/^\d/.test(x))return x.slice(0,80); }
  const a=/\b(?:at|from)\s+([A-Z].{2,60})$/.exec(s); return a?a[1].trim():''; }
function contactsHtml(x,big){ const L=[];
  if(x.ph)L.push('<a href="tel:'+esc(telOf(x.ph))+'"'+(big?' class="pri"':'')+'>'+svg(IC.call)+esc(x.ph)+'</a>');
  if(x.em)L.push('<a href="mailto:'+esc(x.em)+'">'+svg(IC.email)+esc(x.em)+'</a>');
  if(x.web)L.push('<a href="'+esc(webOf(x.web))+'" target="_blank" rel="noopener">'+svg(IC.globe)+esc(hostOf(x.web))+'</a>');
  if(big&&x.lat!=null&&x.lon!=null){ L.push('<a href="https://www.google.com/maps/search/?api=1&amp;query='+(+x.lat).toFixed(6)+','+(+x.lon).toFixed(6)+'" target="_blank" rel="noopener">'+svg(IC.pin)+'Map</a>');
    if(W.openRoute)L.push('<button type="button" class="pl-route">'+svg(IC.traffic)+'Route</button>'); }
  let h=L.length?'<div class="tk-pla">'+L.join('')+'</div>':(x.src==='typed'?'':'<p class="tk-plnone">No phone or email listed'+(x.src==='osm'?' on OpenStreetMap':'')+'.</p>');
  if(x.oh)h+='<p class="tk-ploh">'+svg(IC.any)+'<span>'+esc(x.oh)+'</span></p>';
  return h; }
function webHtml(t){ const w=t._web; if(!w)return '';
  if(w.busy)return '<div class="tk-busy sm"><i></i>Claude is searching the web…</div>';
  if(w.err)return '<p class="tk-err">'+esc(w.err)+'</p>';
  const x=w.res; if(!x)return '';
  if(x.private)return '<p class="tk-note">That looks like a private address or person, so Claude didn’t search it.</p>';
  const any=x.ph||x.em||x.web||x.oh;
  return '<div class="tk-plr web"><b>'+esc(x.name||'Found on the web')+'</b>'+(x.a?'<small>'+esc(x.a)+'</small>':'')
   +(any?contactsHtml({ph:x.ph,em:x.em,web:x.web,oh:x.oh},false):'<p class="tk-plnone">Claude couldn’t find a phone number or email.</p>')
   +(x.sources&&x.sources.length?'<p class="tk-plsrc">Sources: '+x.sources.slice(0,4).map(u=>'<a href="'+esc(u)+'" target="_blank" rel="noopener">'+esc(hostOf(u))+'</a>').join(' · ')+' — check before you rely on it.</p>':'')
   +(any?'<button type="button" class="tk-sec-btn pl-webuse">Use these details</button>':'')+'</div>'; }
function plResHtml(t){ const P=t._pl; if(!P)return '';
  if(P.busy)return '<div class="tk-busy sm"><i></i>Searching OpenStreetMap…</div>';
  let h=P.err?'<p class="tk-note">'+esc(P.err)+'</p>':'';
  h+=(P.res||[]).map((x,i)=>'<div class="tk-plr"><b>'+esc(x.n)+'</b><small>'+esc([x.kind,x.a].filter(Boolean).join(' · '))+'</small>'+contactsHtml(x,false)
    +'<button type="button" class="tk-sec-btn pl-use" data-plu="'+i+'">Use this place</button></div>').join('');
  if((P.res||[]).length)h+='<p class="tk-plsrc">Map data © OpenStreetMap contributors. Phone and email only where they’re listed there.</p>';
  if(P.q)h+='<div class="tk-pla sec"><a href="'+esc(googleUrl(P.q))+'" target="_blank" rel="noopener">'+svg(IC.ext)+'Search Google</a>'
    +(hasKey()?'<button type="button" class="pl-web">'+svg(IC.spark)+'Find phone & email with Claude</button>':'')+'</div>'+webHtml(t);
  return h; }
function placeHtml(t){ const p=t.place;
  let h='<label class="tk-lab">Place <small>shop, business, station — optional</small></label>';
  if(p&&p.n){
    h+='<div class="tk-plc"><div class="tk-plh">'+svg(IC.pin)+'<div><b>'+esc(p.n)+'</b>'+(p.a?'<small>'+esc(p.a)+'</small>':'')+'</div></div>'+contactsHtml(p,true)
      +(p.web2&&p.srcs&&p.srcs.length?'<p class="tk-plsrc">Some details found on the web by Claude — check them: '+p.srcs.slice(0,3).map(u=>'<a href="'+esc(u)+'" target="_blank" rel="noopener">'+esc(hostOf(u))+'</a>').join(' · ')+'</p>':'')
      +(p.src==='osm'?'<p class="tk-plsrc">From OpenStreetMap — © OpenStreetMap contributors.</p>':'')
      +'<div class="tk-pla sec">'+(!p.ph||!p.em?'<button type="button" class="pl-re">'+svg(IC.search)+'Find phone & email</button>':'')
      +(hasKey()&&(!p.ph||!p.em)?'<button type="button" class="pl-web">'+svg(IC.spark)+'Ask Claude</button>':'')
      +'<button type="button" class="pl-rm">'+svg(IC.x)+'Remove</button></div>'+webHtml(t)+'</div>';
  } else {
    h+='<div class="tk-plq"><input class="tk-in f-place" maxlength="120" autocomplete="off" enterkeyhint="search" placeholder="'+esc(guessPlace(t.title)||'e.g. Centra, Dorset Street')+'" value="'+esc(t._pq||'')+'" aria-label="Place name">'
      +'<button type="button" class="tk-sec-btn pl-find">'+svg(IC.search)+'Find</button></div>'
      +'<div class="tk-plres">'+plResHtml(t)+'</div>';
    if(!t._pl)h+='<p class="tk-hint sm">Find looks the place up on OpenStreetMap (needs signal) and shows its phone, email and hours where listed.</p>';
  }
  return h; }

/* ---------- roster: plan it for a tour ---------- */
function rosterHtml(t,now){
  if(!W.GRRoster)return '';
  if(!RO())return '<button type="button" class="tk-link ro-set">'+svg(IC.cal)+'Set up My roster to plan tasks for your tours</button>';
  let L=tours(now,8); if(t.type==='night'){ const n=L.filter(x=>x.code==='N'); if(n.length)L=n; } L=L.slice(0,6); edTours=L;
  let h='';
  if(L.length)h+='<span class="tk-sublab">Or on one of your tours</span><div class="tk-tours">'+L.map((sp,i)=>{ const cur=sp.s<=now, on=planned(t)&&t.tour.ts===sp.s, d=new Date(sp.s);
      return '<button type="button" class="tk-tc'+(on?' on':'')+'" data-tour="'+i+'"><b>'+(cur?'This tour':esc(DAYS[d.getDay()]+' '+d.getDate()+' '+MON[d.getMonth()]))+'</b><small>'+esc((sp.ico?sp.ico+' ':'')+sp.label+' '+hm(sp.s)+'–'+hm(sp.e))+'</small></button>'; }).join('')+'</div>';
  return h+'<div class="tk-roi"></div>'; }
function roInfo(){ const box=main&&main.querySelector('.tk-roi'); if(!box||!draft)return; const t=draft, now=Date.now(); let h=''; edLast=null; edChance=null;
  if(planned(t)){ const x=t.tour; h='<p class="tk-ro ok">'+svg(IC.cal)+'<span>Planned for your <b>'+esc(x.label)+'</b> tour, '+esc(day(x.ts))+' '+hm(x.ts)+'–'+hm(x.te)+(x.s!==x.ts||x.e!==x.te?' · in its window '+hm(x.s)+'–'+hm(x.e):'')+'</span></p>'; }
  else if(t.due){ const sp=tourAt(t.due);
    if(sp)h='<p class="tk-ro ok">'+svg(IC.cal)+'<span>You’re on duty then — '+esc(sp.label)+' '+hm(sp.s)+'–'+hm(sp.e)+'</span></p>';
    else { const di=dayInf(d0(t.due)); edLast=lastTourBefore(t.due,now);
      h='<p class="tk-ro warn">'+svg(IC.cal)+'<span>'+(di&&di.off?'You’re off that day ('+esc(di.label)+')':'You’re not rostered on at that time')
        +(edLast?' — last tour before it: <b>'+esc(edLast.label+' '+day(edLast.s)+' '+hm(edLast.s)+'–'+hm(edLast.e))+'</b>':'')+'</span>'+(edLast?'<button type="button" data-ro="last">Do it then</button>':'')+'</p>'; } }
  if(!planned(t)&&winOf(t)){ edChance=nextChance(t,now);
    h+=edChance?'<p class="tk-ro tip">'+svg(IC.any)+'<span>Next chance on duty in its window: <b>'+esc(day(edChance.s)+' '+hm(edChance.s)+'–'+hm(edChance.e))+'</b> ('+esc(edChance.tour.label)+')</span><button type="button" data-ro="chance">Plan it</button></p>'
      :'<p class="tk-ro warn">'+svg(IC.any)+'<span>None of your tours in the next 6 weeks overlaps its time window.</span></p>'; }
  box.innerHTML=h;
  box.querySelectorAll('[data-ro]').forEach(b=>b.onclick=()=>{ readDraft(); if(b.dataset.ro==='last'&&edLast)planTour(edLast,edLast.s,edLast.e); else if(edChance)planTour(edChance.tour,edChance.s,edChance.e); });
}
function planTour(sp,s,e){ const t=draft, now=Date.now(); if(!t)return;
  t.tour={s,e,ts:sp.s,te:sp.e,label:sp.label,code:sp.code}; t.due=e;
  t.rem=(s>now+MIN?[Math.round((e-s)/MIN)]:[]).concat(e-s>2*H?[60]:[0]);
  dtSet(main,'due',e); rerEdit(); toast('Planned: '+day(s)+' '+hm(s)+'–'+hm(e)); }
let redrawing=false;
function rerEdit(){ if(redrawing||view!=='edit'||!draft)return; redrawing=true;
  try{ const a=D.activeElement; if(a&&main.contains(a)&&a.blur)a.blur(); const st=main.scrollTop; readDraft(); renderEdit(); main.scrollTop=st; } finally{ redrawing=false; } }
function cctvHtml(t,now){
  const c=t.cctv||{}; const ow=cctvOverwrite(c);
  return '<div class="tk-help"><div class="tk-help-h">'+svg(IC.cctv)+'<b>CCTV — beat the overwrite</b></div>'
   +'<p>Many systems overwrite footage within days, and few keep it much beyond a month. Ask the owner how long theirs keeps it, and ask them to preserve the footage straight away.</p>'
   +'<label class="tk-lab sm">Time of the incident</label>'+dtHtml('inc',c.inc||null,[['Now','now'],['2 h ago','-2h'],['Yesterday','-1d']],(t._raw||{}).inc)
   +'<label class="tk-lab sm">The system keeps footage for</label><div class="tk-keeps">'+[[1,'24 h'],[3,'3 days'],[7,'7 days'],[14,'14 days'],[28,'28 days'],[31,'31 days'],[0,'Don’t know']].map(([d,l])=>'<button type="button" class="tk-kp'+((c.keep||0)===d?' on':'')+'" data-keep="'+d+'">'+l+'</button>').join('')+'</div>'
   +'<div class="tk-help-r">'+cctvRes(c,now)+'</div>'
   +'<div class="tk-row2"><button type="button" class="tk-sec-btn f-cdl"'+(c.inc?'':' disabled')+'>Set deadline '+(ow?'a day before':'for 24 h after the incident')+'</button><button type="button" class="tk-sec-btn f-tpl">📧 Preservation request</button></div></div>';
}
function cctvRes(c,now){ const ow=cctvOverwrite(c);
  return ow?'Footage may be overwritten from <b>'+esc(full(ow))+'</b>'+(ow<now?' — <b class="red">that may already have happened</b>':' ('+(ow-now<DAY?'in '+esc(durStr(ow-now)):esc(rel(ow,now)))+')'):c.inc?'Unknown retention — treat it as urgent: some systems keep only 24–72 hours.':'Enter the incident time to work out the overwrite date.'; }
function limitRes(s,now){ const end=s.off?limitEnd(s.off,s.months||6):null;
  return end?'Last safe day to apply: <b>'+esc(dateOnly(end))+'</b>'+(end<now?' — <b class="red">that date has passed</b>':' ('+esc(durStr(end-now))+' left)')+'<br><small>Counted cautiously: the day before the same date '+(s.months||6)+' months on, moved back to a working day if that falls on a weekend or public holiday.</small>':'Enter the date of the offence.'; }
function limitHtml(t,now){
  const s=t.sol||{months:6}; const end=s.off?limitEnd(s.off,s.months||6):null;
  return '<div class="tk-help"><div class="tk-help-h">'+svg(IC.limit)+'<b>Summons time limit</b></div>'
   +'<p>For a <b>summary offence</b> the complaint must be made — the summons applied for — within <b>6 months</b> of the offence: s.10(4) Petty Sessions (Ireland) Act 1851. What counts is the date the application reaches the District Court office.</p>'
   +'<p>That limit doesn’t apply to indictable offences, or to offences that can be tried either way (s.7 Criminal Justice Act 1951, substituted by s.177 Criminal Justice Act 2006). Some Acts set their own, longer limits — check the Act for the offence.</p>'
   +'<label class="tk-lab sm">Date of the offence</label>'+dtHtml('off',s.off||null,[['Today','now'],['Yesterday','-1d']],(t._raw||{}).off)
   +'<label class="tk-lab sm">Time limit</label><div class="tk-keeps">'+[[6,'6 months'],[12,'12 months'],[24,'2 years'],[36,'3 years']].map(([m,l])=>'<button type="button" class="tk-kp'+((s.months||6)===m?' on':'')+'" data-mon="'+m+'">'+l+'</button>').join('')+'</div>'
   +'<div class="tk-help-r">'+limitRes(s,now)+'</div>'
   +'<button type="button" class="tk-sec-btn wide f-ldl"'+(end?'':' disabled')+'>Set the deadline and reminders (1 month, 1 week, 1 day before)</button></div>';
}
function readDraft(){
  const r=main; const t=draft; t._raw={};
  r.querySelectorAll('[data-dt]').forEach(w=>{ t._raw[w.dataset.dt]={d:w.querySelector('.dt-d').value,t:w.querySelector('.dt-t').value}; });
  t.title=r.querySelector('.f-title').value.trim(); t.notes=r.querySelector('.f-notes').value.trim();
  const due=dtRead(r,'due'); t.due=isNaN(due)?null:due;
  if(t.tour&&t.due!==t.tour.e){ t.tour=null; t.rem=(t.rem||[]).filter(m=>REMS.some(([x])=>x===m)); }
  const rw=r.querySelector('.f-rw'); if(rw)t.remWin=rw.checked;
  const wf=r.querySelector('.f-wf'), wt=r.querySelector('.f-wt'); if(wf){ const a=parseHM(wf.value), b=parseHM(wt.value); t.wFrom=a?p2(a[0])+':'+p2(a[1]):wf.value.trim(); t.wTo=b?p2(b[0])+':'+p2(b[1]):wt.value.trim(); }
  if(t.type==='cctv'){ const inc=dtRead(r,'inc'); t.cctv=t.cctv||{}; t.cctv.inc=isNaN(inc)?null:inc; }
  if(t.type==='limit'){ let off=dtRead(r,'off'); if(isNaN(off)){ const d=r.querySelector('[data-dt="off"] .dt-d'); if(d&&d.value){ const [y,mo,da]=d.value.split('-').map(Number); off=new Date(y,mo-1,da,12,0,0,0).getTime(); } }
    t.sol=t.sol||{months:6}; t.sol.off=isNaN(off)?null:off; }
  commitEdit();
  const pq=r.querySelector('.f-place'); if(pq)t._pq=pq.value;
  if(r.querySelector('[data-dt="csCourt"]')){ const v=dtRead(r,'csCourt'); t.cs=Object.assign({},t.cs||{}); if(!isNaN(v))t.cs.court=v; else delete t.cs.court; }
  if(r.querySelector('[data-dt="csOff"]')){ let v=dtRead(r,'csOff'); if(isNaN(v)){ const d=r.querySelector('[data-dt="csOff"] .dt-d'); if(d&&d.value){ const [y,mo,da]=d.value.split('-').map(Number); v=new Date(y,mo-1,da,12,0,0,0).getTime(); } }
    t.cs=Object.assign({},t.cs||{}); if(!isNaN(v))t.cs.off=v; else delete t.cs.off; }
}
function wireEdit(){
  const r=main, t=draft, rer=rerEdit;
  r.querySelectorAll('[data-type]').forEach(b=>b.onclick=()=>{ readDraft(); const k=b.dataset.type; if(k===t.type)return; t.type=k; t.kind=null;
    if(TY[k].win&&t.win==='any')t.win=TY[k].win;
    if(k==='cctv'&&!t.cctv)t.cctv={inc:null,keep:0};
    if(k==='limit'&&!t.sol)t.sol={months:6,off:null};
    if(k==='cctv'||k==='limit')t.urgent=t.urgent||k==='cctv';
    rer(); });
  r.querySelectorAll('[data-kind]').forEach(b=>b.onclick=()=>{ readDraft(); t.kind=t.kind===b.dataset.kind?null:b.dataset.kind; vib(10); rer(); });
  r.querySelectorAll('[data-cst]').forEach(b=>b.onclick=()=>{ readDraft(); const c=caseOf(t), k=b.dataset.cst; t.cs=Object.assign({},t.cs||{}); t.cs.st=(c.st===k&&!c.guess)?null:k; if(!t.cs.st)delete t.cs.st; vib(10); rer(); });
  r.querySelectorAll('[data-civ]').forEach(b=>b.onclick=()=>{ readDraft(); t.cs=Object.assign({},t.cs||{}); t.cs.intv=t.cs.intv===b.dataset.civ?null:b.dataset.civ; if(!t.cs.intv)delete t.cs.intv; vib(10); rer(); });
  ['csCourt','csOff'].forEach(k=>dtWire(r,k,()=>{ readDraft(); const u=urgOf(t,null,Date.now()), p=r.querySelector('.cs-urg'); if(p){ p.className='cs-urg l'+u.lv; p.innerHTML=svg(IC.flag)+'<b>'+LV[u.lv]+'</b><span>'+esc(u.why.join(' · '))+'</span>'; }
    const lh=r.querySelector('.cs-lim'); if(lh)lh.innerHTML=limHint(caseOf(t)); }));
  r.querySelector('.tk-urg').onclick=()=>{ readDraft(); t.urgent=!t.urgent; vib(15); rer(); };
  const cf=r.querySelector('.f-cctvf'); if(cf)cf.onclick=()=>{ commitEdit(); if(curId)stepsSync(); W.GRForms.open('cctv'); };
  const psv=r.querySelector('.f-psv'); if(psv)psv.onclick=()=>{ try{ if(typeof STEN!=='undefined'&&STEN&&typeof openStencil==='function'){ const i=STEN.findIndex(x=>x.id==='psv_cover'); if(i>=0){ closeTasks(); openStencil(i); return; } } }catch(e){} toast('The stencil is still loading — try again in a moment'); };
  r.querySelectorAll('[data-win]').forEach(b=>b.onclick=()=>{ readDraft(); t.win=b.dataset.win; t.wDays=null; if(t.win==='custom'&&!t.wFrom){t.wFrom='09:00';t.wTo='17:00';} rer(); });
  r.querySelectorAll('[data-days]').forEach(b=>b.onclick=()=>{ readDraft(); t.wDays=b.dataset.days; rer(); });
  r.querySelectorAll('[data-rm]').forEach(b=>b.onclick=()=>{ const m=+b.dataset.rm; t.rem=t.rem||[]; if(t.rem.includes(m))t.rem=t.rem.filter(x=>x!==m); else t.rem.push(m); b.classList.toggle('on'); });
  ['f-wf','f-wt'].forEach(c=>{const i=r.querySelector('.'+c); if(i)i.addEventListener('input',()=>{const dg=i.value.replace(/\D/g,'').slice(0,4);const v=dg.length>2?dg.slice(0,2)+':'+dg.slice(2):dg;if(v!==i.value)i.value=v;});});
  // deadline: typing a date or time drops a planned tour and refreshes the roster hints without redrawing the form
  dtWire(r,'due',()=>{ const had=!!t.tour; readDraft(); if(had&&!t.tour){ r.querySelectorAll('.tk-tc.on').forEach(x=>x.classList.remove('on')); const tc=r.querySelector('.tk-rm.trm'); if(tc)tc.remove(); } roInfo(); });
  r.querySelectorAll('[data-tour]').forEach(b=>b.onclick=()=>{ readDraft(); const sp=edTours[+b.dataset.tour]; if(!sp)return;
    if(planned(t)&&t.tour.ts===sp.s){ t.tour=null; t.due=null; t.rem=[0,60]; dtSet(r,'due',null); rer(); toast('Not planned for a tour'); return; }
    planTour(sp,sp.s,sp.e); });
  const rs=r.querySelector('.ro-set'); if(rs)rs.onclick=()=>{ closeTasks(); if(W.GRRoster)W.GRRoster.open(); };
  roInfo();
  // window status line
  const ws=r.querySelector('.wst'); if(ws){ readDraft(); const s=winState(t,Date.now()); ws.innerHTML=s.any?'':s.open?'<span class="grn">Open now</span> · '+esc(s.w.label.trim())+' · '+esc(DAYSET[s.w.days]):'Next opens <b>'+esc(s.next?rel(s.next,Date.now()):'—')+'</b> · '+esc(DAYSET[s.w.days]); }
  wireSteps(r); wirePlace(r);
  // CCTV helper
  if(t.type==='cctv'){
    const cr=()=>{ readDraft(); r.querySelector('.tk-help-r').innerHTML=cctvRes(t.cctv,Date.now()); const b=r.querySelector('.f-cdl'); b.disabled=!t.cctv.inc;
      b.textContent='Set deadline '+(cctvOverwrite(t.cctv)?'a day before':'for 24 h after the incident'); };
    dtWire(r,'inc',cr);
    r.querySelectorAll('[data-keep]').forEach(b=>b.onclick=()=>{ t.cctv.keep=+b.dataset.keep||0; r.querySelectorAll('[data-keep]').forEach(x=>x.classList.toggle('on',x===b)); cr(); });
    const cd=r.querySelector('.f-cdl'); if(cd)cd.onclick=()=>{ readDraft(); const c=t.cctv; if(!c.inc)return; const ow=cctvOverwrite(c);
      let due=ow?ow-DAY:c.inc+DAY; if(due<Date.now()+30*MIN)due=Math.ceil((Date.now()+60*MIN)/MIN)*MIN; t.rem=[0,60]; t.urgent=true; t.tour=null;
      dtSet(r,'due',due); const ti=r.querySelector('.f-title'); if(!ti.value.trim())ti.value='Collect CCTV';
      rer(); toast('Deadline set: '+full(due)); };
    r.querySelector('.f-tpl').onclick=()=>{ openTpl('cctv'); }; }
  // time-limit helper
  if(t.type==='limit'){
    const lr=()=>{ readDraft(); r.querySelector('.tk-help-r').innerHTML=limitRes(t.sol,Date.now()); r.querySelector('.f-ldl').disabled=!t.sol.off; };
    dtWire(r,'off',lr);
    r.querySelectorAll('[data-mon]').forEach(b=>b.onclick=()=>{ t.sol.months=+b.dataset.mon; r.querySelectorAll('[data-mon]').forEach(x=>x.classList.toggle('on',x===b)); lr(); });
    const ld=r.querySelector('.f-ldl'); if(ld)ld.onclick=()=>{ readDraft(); if(!t.sol.off)return; const due=limitEnd(t.sol.off,t.sol.months||6); t.rem=[0,DAY/MIN,7*DAY/MIN,30*DAY/MIN]; t.tour=null;
      dtSet(r,'due',due); const ti=r.querySelector('.f-title'); if(!ti.value.trim())ti.value='Apply for the summons';
      rer(); toast('Deadline set: '+dateOnly(due)); }; }
  const err=m=>{const e=r.querySelector('.tk-err');e.textContent=m;e.hidden=!m;if(m)e.scrollIntoView({block:'center'});};
  r.querySelector('.f-save').onclick=async()=>{
    readDraft();
    const ns=r.querySelector('.st-new'); if(ns&&ns.value.trim())t.steps.push({id:sid(),t:ns.value.replace(/\s+/g,' ').trim().slice(0,200),done:null,u:Date.now()});
    sEd=null; edbar(false); pruneEmpty(t.steps); norm(t.steps);
    if(!t.title&&!t.notes)return err('Say what needs doing.');
    const tv=r.querySelector('[data-dt="due"] .dt-t').value.trim(), dv=r.querySelector('[data-dt="due"] .dt-d').value;
    if((tv||dv)&&t.due==null)return err('Finish the deadline — date and a 24-hour time (e.g. 17:00) — or tap “None”.');
    if(t.win==='custom'&&(!parseHM(t.wFrom)||!parseHM(t.wTo)||t.wFrom===t.wTo))return err('Enter the custom window as two 24-hour times, e.g. 10:00 to 16:00.');
    if(!t.title)t.title=t.notes.split('\n')[0].slice(0,80);
    if(!t.place&&t._pq&&t._pq.trim())t.place={n:t._pq.trim().slice(0,120),src:'typed'};
    t.updated=Date.now(); t.m=t.updated; t.fired={}; t.nextWin=null; delete t._raw; delete t._pl; delete t._pq; delete t._web;
    const isNew=!curId; if(isNew)DB.tasks.push(t); else { const i=DB.tasks.findIndex(x=>x.id===curId); if(i>=0)DB.tasks[i]=t; }
    save(); view='list'; draft=null; render(); toast(isNew?'Task added':'Saved');
    if((t.due&&(t.rem||[]).length)||t.remWin){ if(!permOK()&&('Notification' in W)&&Notification.permission==='default')await enableReminders(); }
    check();
  };
  const c=r.querySelector('.f-cancel'); if(c)c.onclick=()=>back();
  const dn=r.querySelector('.f-done'); if(dn)dn.onclick=()=>{ const id=curId; view='list'; draft=null; toggleDone(id); };
  r.querySelector('.f-mail').onclick=()=>{ readDraft(); mailTask(t); };
  r.querySelector('.f-cal').onclick=()=>{ readDraft(); calTask(t); };
  const me=r.querySelector('.f-me'); if(me)me.onclick=()=>askEmail(()=>rerEdit());
  const dl=r.querySelector('.f-del'); if(dl)dl.onclick=()=>{ if(dl.dataset.sure!=='1'){dl.dataset.sure='1';dl.lastChild.textContent='Tap again to delete';setTimeout(()=>{if(dl.isConnected){dl.dataset.sure='';dl.lastChild.textContent='Delete task';}},2500);return;}
    DB.tasks=DB.tasks.filter(x=>x.id!==curId); (DB.del=DB.del||{})[curId]=Date.now(); save(); closeTag('gr-task-'+curId); view='list'; draft=null; render(); toast('Deleted'); };
}
/* steps: ticks, edits and new steps on a saved task are kept straight away, so nothing is lost if you go back */
let sEd=null, zoomId=null, hideDone=false, stTours=[];
function stepsSync(){ if(!curId||!draft)return; const st=byId(curId); if(!st)return; st.steps=pruneEmpty(JSON.parse(JSON.stringify(draft.steps||[])),sEd); st.m=Date.now(); save(); }
function wireSteps(r){ const t=draft;
  r.querySelectorAll('.tk-tree').forEach(wireTree);
  const ni=r.querySelector('.st-new');
  const add=()=>{ const v=ni.value.replace(/\s+/g,' ').trim(); if(!v){ ni.focus(); return; } readDraft(); if(addStep(v,null)===false)return; const n2=main.querySelector('.st-new'); if(n2)n2.focus(); };
  if(ni){ r.querySelector('.st-add').onclick=add; ni.onkeydown=e=>{ if(e.key==='Enter'&&!e.isComposing){ e.preventDefault(); add(); } }; }
  r.querySelectorAll('.st-full').forEach(b=>b.onclick=()=>openPlan(null));
  const pa=r.querySelector('.st-paste'); if(pa)pa.onclick=()=>{ readDraft(); pasteSheet(null); };
  const ai=r.querySelector('.st-ai'); if(ai)ai.onclick=()=>{ readDraft(); aiSteps(null); };
  const tp=r.querySelector('.st-tpl'); if(tp)tp.onclick=()=>{ readDraft(); const have=new Set((t.steps||[]).map(x=>x.t)); t.steps=(t.steps||[]).concat(tplNodes((stepsFor(t)||[]).filter(x=>!have.has(tplText(x))))); norm(t.steps); stepsSync(); rerEdit(); toast('Steps added — change any of them to fit'); };
  const ad=r.querySelector('.tk-alldone'); if(ad)ad.onclick=()=>{ const id=curId; view='list'; draft=null; toggleDone(id); };
}
function toastUndo(msg,fn){ if(!ov)return; const el=ov.querySelector('.tk-toast'); el.innerHTML=esc(msg)+'<button type="button" class="tk-undo">Undo</button>'; el.classList.add('on'); clearTimeout(el._t); el._t=setTimeout(()=>el.classList.remove('on'),6500);
  el.querySelector('.tk-undo').onclick=()=>{ el.classList.remove('on'); fn(); toast('Undone'); }; }
function restoreSteps(t,json){ const L=JSON.parse(json); if(draft===t){ t.steps=L; stepsSync(); reSteps(false); } else { const st=byId(t.id); if(st){ st.steps=L; st.m=Date.now(); save(); render(); } } }
/* the editing toolbar sits just above the phone's keyboard */
function edbar(on){ if(!ov)return; const b=ov.querySelector('.tk-edbar'); if(!b)return; b.hidden=!on; if(main)main.classList.toggle('edpad',!!on); if(on)edbarPos(); }
function edbarPos(){ const b=ov&&ov.querySelector('.tk-edbar'); if(!b||b.hidden)return; const vv=W.visualViewport; const off=vv?Math.max(0,Math.round(W.innerHeight-vv.height-vv.offsetTop)):0; b.style.transform=off?'translateY(-'+off+'px)':''; }
if(W.visualViewport){ W.visualViewport.addEventListener('resize',edbarPos); W.visualViewport.addEventListener('scroll',edbarPos); }
// redraw whichever screen is showing the steps, keeping the step being typed in focus
function reSteps(focus){ if(!ov||ov.hidden)return; if(view==='plan')renderPlan(true); else if(view==='edit')rerEdit(); else return;
  if(focus&&sEd){ const ta=edBox(sEd); if(ta){ try{ ta.focus({preventScroll:true}); const v=ta.value.length; ta.setSelectionRange(v,v); }catch(e){} fitTa(ta); const r=ta.closest('.sn'); if(r)r.scrollIntoView({block:'nearest'}); } } }
function edBox(id){ return main&&id?main.querySelector('.sn[data-sid="'+id+'"] > .sn-b > .sn-in'):null; }
function commitEdit(){ if(!sEd||!draft||!main)return false; const ta=edBox(sEd), x=locate(draft.steps,sEd); if(!ta||!x)return false;
  const v=ta.value.replace(/\s+/g,' ').trim().slice(0,200); if(v&&v!==x.n.t){ x.n.t=v; x.n.u=Date.now(); return true; } return false; }
function fitTa(ta){ ta.style.height='auto'; ta.style.height=Math.min(ta.scrollHeight+2,260)+'px'; }
function wireEditBox(ta){ fitTa(ta);
  ta.addEventListener('focus',()=>{ const r=ta.closest('.sn'); if(r)sEd=r.dataset.sid; edbar(true); });
  ta.addEventListener('input',()=>{ if(ta.value.includes('\n')){ const p=ta.value.split('\n'); ta.value=p[0]; fitTa(ta); stepEnter(p.slice(1).join(' ')); return; } fitTa(ta); });
  ta.addEventListener('keydown',e=>{ if(e.isComposing)return;
    if(e.key==='Enter'){ e.preventDefault(); stepEnter(''); }
    else if(e.key==='Tab'){ e.preventDefault(); stepOp(e.shiftKey?'out':'in'); }
    else if(e.key==='Backspace'&&!ta.value){ e.preventDefault(); stepBack(); }
    else if(e.key==='Escape'){ e.preventDefault(); ta.blur(); }
    else if(e.altKey&&(e.key==='ArrowUp'||e.key==='ArrowDown')){ e.preventDefault(); stepOp(e.key==='ArrowUp'?'up':'down'); } });
  ta.addEventListener('blur',()=>{ setTimeout(()=>{ if(!ta.isConnected||D.activeElement===ta)return; const r=ta.closest('.sn'), id=r&&r.dataset.sid; if(sEd!==id)return;
    const ch=commitEdit(), x=draft&&locate(draft.steps,id); sEd=null; edbar(false);
    if(x&&!x.n.t&&!kids(x.n).length){ x.list.splice(x.i,1); norm(draft.steps); stepsSync(); if(r)r.remove(); return; }
    if(ch){ stepsSync(); const b=D.createElement('button'); b.type='button'; b.className='sn-t'; b.textContent=x?x.n.t:ta.value; ta.replaceWith(b); if(r)r.classList.remove('ed'); }
    else if(r){ const b=D.createElement('button'); b.type='button'; b.className='sn-t'; b.textContent=x?x.n.t:ta.value; ta.replaceWith(b); r.classList.remove('ed'); } },0); }); }
function stepEnter(rest){ const t=draft; if(!t||!sEd)return; const x=locate(t.steps,sEd); if(!x)return;
  const ta=edBox(sEd), v=(ta?ta.value:x.n.t).replace(/\s+/g,' ').trim();
  if(!v&&!kids(x.n).length){ if(x.par&&!(view==='plan'&&zoomId===x.par.id)){ stepOp('out'); return; } x.list.splice(x.i,1); sEd=null; norm(t.steps); stepsSync(); reSteps(false); edbar(false); return; }
  commitEdit();
  if(nodeCount(t.steps)>=MAXN){ toast('That’s the most steps one task can hold ('+MAXN+')'); return; }
  const nn={id:sid(),t:String(rest||'').replace(/\s+/g,' ').trim().slice(0,200),done:null,u:Date.now()};
  if(kids(x.n).length&&!x.n.c)x.n.steps.unshift(nn); else x.list.splice(x.i+1,0,nn);   // on an open step with sub-steps, the new one goes first inside it
  sEd=nn.id; norm(t.steps); stepsSync(); reSteps(true); }
function stepBack(){ const t=draft; const x=t&&locate(t.steps,sEd); if(!x||kids(x.n).length)return;
  const vis=[...main.querySelectorAll('.tk-tree .sn')].map(r=>r.dataset.sid), k=vis.indexOf(sEd);
  x.list.splice(x.i,1); sEd=k>0?vis[k-1]:null; norm(t.steps); stepsSync(); reSteps(!!sEd); if(!sEd)edbar(false); }
function stepOp(op,id){ id=id||sEd; const t=draft; if(!t||!id)return; commitEdit(); const x=locate(t.steps,id); if(!x)return; let msg='';
  if(op==='up'){ if(x.i===0)msg='It’s already at the top'; else { x.list.splice(x.i,1); x.list.splice(x.i-1,0,x.n); } }
  else if(op==='down'){ if(x.i>=x.list.length-1)msg='It’s already at the bottom'; else { x.list.splice(x.i,1); x.list.splice(x.i+1,0,x.n); } }
  else if(op==='in'){ if(x.i===0)msg='There’s no step above it to go under';
    else { const p=x.list[x.i-1]; if(levelOf(t.steps,p.id)+height(x.n)>MAXD)msg='That’s as deep as steps go ('+MAXD+' levels)';
      else { x.list.splice(x.i,1); (p.steps=p.steps||[]).push(x.n); p.c=false; } } }
  else if(op==='out'){ if(!x.par)msg='It’s already at the top level';
    else if(view==='plan'&&zoomId===x.par.id)msg='Go up a level (top of the screen) to move it out';
    else { const g=locate(t.steps,x.par.id); x.list.splice(x.i,1); g.list.splice(g.i+1,0,x.n); } }
  else if(op==='sub'){ if(levelOf(t.steps,id)>=MAXD)msg='That’s as deep as steps go ('+MAXD+' levels)';
    else if(nodeCount(t.steps)>=MAXN)msg='That’s the most steps one task can hold ('+MAXN+')';
    else { const nn={id:sid(),t:'',done:null,u:Date.now()}; (x.n.steps=x.n.steps||[]).push(nn); x.n.c=false; sEd=nn.id; } }
  if(msg){ toast(msg); return; }
  x.n.u=Date.now(); norm(t.steps); stepsSync(); reSteps(!!sEd); vib(8); }
function tickStep(id){ const t=draft; const x=t&&locate(t.steps,id); if(!x)return; commitEdit();
  const before=JSON.stringify(t.steps), now=Date.now();
  if(!kids(x.n).length){ x.n.done=x.n.done?null:now; x.n.u=now; vib(12); norm(t.steps); stepsSync(); reSteps(!!sEd&&sEd!==id); return; }
  const all=isDone(x.n); let k=0;
  walk(x.n.steps,n=>{ if(kids(n).length)return; if(all){ if(n.done){ n.done=null; n.u=now; k++; } } else if(!n.done){ n.done=now; n.u=now; k++; } });
  vib(all?12:[12,40,12]); norm(t.steps); stepsSync(); reSteps(!!sEd&&sEd!==id);
  if(k>1)toastUndo((all?'Unticked ':'Ticked ')+k+' sub-steps',()=>restoreSteps(t,before)); }
function wireTree(el){
  el.addEventListener('click',e=>{ const row=e.target.closest('.sn'); if(!row||!el.contains(row)||e.target.closest('.sn-in'))return; const id=row.dataset.sid;
    if(e.target.closest('.sn-car')){ commitEdit(); const x=locate(draft.steps,id); if(x){ x.n.c=!x.n.c; stepsSync(); reSteps(!!sEd); } return; }
    if(e.target.closest('.sn-ck'))return tickStep(id);
    if(e.target.closest('.sn-more'))return stepSheet(id);
    if(e.target.closest('.sn-t')){ commitEdit(); sEd=id; reSteps(true); } });
  el.querySelectorAll('.sn-in').forEach(wireEditBox); }
function addStep(v,parentId){ const t=draft; if(!t)return false; commitEdit();
  if(nodeCount(t.steps)>=MAXN){ toast('That’s the most steps one task can hold ('+MAXN+')'); return false; }
  const nn={id:sid(),t:v.slice(0,200),done:null,u:Date.now()};
  if(parentId){ const x=locate(t.steps,parentId); if(!x)return false; if(levelOf(t.steps,parentId)>=MAXD){ toast('That’s as deep as steps go ('+MAXD+' levels)'); return false; } (x.n.steps=x.n.steps||[]).push(nn); x.n.c=false; }
  else (t.steps=t.steps||[]).push(nn);
  norm(t.steps); stepsSync(); reSteps(false);
  const row=main.querySelector('.sn[data-sid="'+nn.id+'"]'); if(row)row.scrollIntoView({block:'nearest'}); return true; }
/* ⋯ — everything you can do with one step */
function stepTourChips(){ stTours=[]; if(!RO())return ''; const L=tours(Date.now(),6).slice(0,5); if(!L.length)return ''; stTours=L;
  return '<span class="tk-sublab">Or by the end of one of your tours</span><div class="tk-tours sm">'+L.map((sp,i)=>{ const cur=sp.s<=Date.now(), d=new Date(sp.s);
    return '<button type="button" class="tk-tc" data-stour="'+i+'"><b>'+(cur?'This tour':esc(DAYS[d.getDay()]+' '+d.getDate()+' '+MON[d.getMonth()]))+'</b><small>'+esc((sp.ico?sp.ico+' ':'')+sp.label+' until '+hm(sp.e))+'</small></button>'; }).join('')+'</div>'; }
function stepSheet(id){ const t=draft; if(!t)return; commitEdit(); const ae=D.activeElement; sEd=null; if(ae&&ae.blur&&main.contains(ae))ae.blur(); edbar(false);
  if(main.querySelector('.sn-in'))reSteps(false);
  const x=locate(t.steps,id); if(!x)return; const n=x.n, has=kids(n).length, c=has?cnt(n.steps):null, lvl=levelOf(t.steps,id);
  const sw={win:n.win&&WN[n.win]?n.win:'',wFrom:n.wFrom||'',wTo:n.wTo||'',wDays:n.wDays||null,remWin:!!n.remWin};
  let sty=n.type&&TY[n.type]?n.type:'', chance=null, opAt=null, sav=n.avail||'', saway=n.awayBy||null, spri=n.pri>=1&&n.pri<=4?n.pri:0;
  let h='<div class="tk-grip"></div><h3 class="sn-sh">'+esc(n.t||'Step')+'</h3><p class="tk-note">'+(lvl>1?'Level '+lvl+' · ':'')+(has?c.n+' of '+c.m+' sub-steps done':'No sub-steps yet')+'</p>'
   +'<div class="sn-acts"><button type="button" data-sa="sub">'+svg(IC.sub)+'Add a sub-step</button>'
   +(has?'<button type="button" data-sa="zoom">'+svg(IC.expand)+'Open it on its own</button>':'<button type="button" data-sa="edit">'+svg(IC.pen)+'Change the wording</button>')
   +'<button type="button" data-sa="up">'+svg(IC.up)+'Move up</button><button type="button" data-sa="down">'+svg(IC.down)+'Move down</button>'
   +'<button type="button" data-sa="in">'+svg(IC.indent)+'Put it under the step above</button><button type="button" data-sa="out">'+svg(IC.outdent)+'Move it out a level</button></div>'
   +'<div class="sn-urg"></div>'
   +'<label class="tk-lab sm">Type <small>optional</small></label><div class="sn-tys" role="group" aria-label="Type of step">'
   +[''].concat(TYPES.filter(y=>y.k!=='other').map(y=>y.k)).map(k=>'<button type="button" class="tk-kind sn-ty'+(k===sty?' on':'')+'" data-sty="'+k+'" aria-pressed="'+(k===sty)+'"><span class="tk-ki ty-'+(k||'other')+'">'+svg(IC[k||'other'])+'</span><span>'+esc(k?TY[k].t:'No type')+'</span></button>').join('')+'</div>'
   +'<div class="sn-tpl"></div>'
   +'<label class="tk-lab sm">When can it be done?</label><div class="sn-win"></div>'
   +'<label class="tk-lab sm">Do it by <small>optional</small></label>'+dtHtml('sdue',n.due||null,[['Today 17:00','t17'],['Tomorrow 09:00','m09'],['+2 days','+2d'],['+1 week','+7d'],['None','none']])
   +stepTourChips()
   +'<div class="tk-rems sn-rems"></div>'
   +'<p class="tk-hint sm sn-dw"></p>'
   +'<label class="tk-lab sm">Note <small>optional</small></label><textarea class="tk-in tk-ta sn-note" maxlength="1000" placeholder="Details for this step">'+esc(n.n||'')+'</textarea>'
   +'<p class="tk-err" hidden></p>'
   +'<div class="tk-row2"><button type="button" class="tk-sec-btn sn-del">'+svg(IC.trash)+'<span>'+(has?'Delete it and its '+nodeCount(n.steps)+' sub-steps':'Delete this step')+'</span></button><button type="button" class="tk-go sn-ok">Done</button></div>';
  sh.innerHTML=h; sh.hidden=false; ov.querySelector('.tk-shade').hidden=false; sh.scrollTop=0;
  let rem=(n.rem&&n.rem.length?n.rem:[0]).slice();
  // reminders: the usual three, plus "when it opens" once it's planned for a tour
  const remLab=m=>m===0?'At the time':m<60?m+' min before':m%1440===0?(m===1440?'1 day':(m/1440)+' days')+' before':m%60===0?(m===60?'1 hour':(m/60)+' hours')+' before':Math.floor(m/60)+' h '+(m%60)+' min before';
  const paintRem=()=>{ const base=[0,60,DAY/MIN], ms=base.concat(rem.filter(m=>!base.includes(m))).sort((p,q)=>p-q), box=sh.querySelector('.sn-rems');
    box.innerHTML='<span>Remind me</span>'+ms.map(m=>'<button type="button" class="tk-rm'+(rem.includes(m)?' on':'')+'" data-srm="'+m+'">'+esc(opAt&&m===opAt[0]?'When it opens ('+opAt[1]+')':remLab(m))+'</button>').join('');
    box.querySelectorAll('[data-srm]').forEach(b=>b.onclick=()=>{ const m=+b.dataset.srm; rem=rem.includes(m)?rem.filter(v=>v!==m):rem.concat(m); b.classList.toggle('on',rem.includes(m)); }); };
  // when it can be done: the same choices as a task, plus "same as above" (the step it's under, or the task)
  const readSW=()=>{ const f=sh.querySelector('.sn-wf'), to=sh.querySelector('.sn-wt'); if(f&&to){ const a=parseHM(f.value), b=parseHM(to.value); sw.wFrom=a?p2(a[0])+':'+p2(a[1]):f.value.trim(); sw.wTo=b?p2(b[0])+':'+p2(b[1]):to.value.trim(); }
    const rw=sh.querySelector('.sn-rw'); if(rw)sw.remWin=rw.checked; };
  const badWin=()=>{ readSW(); return sw.win==='custom'&&(!parseHM(sw.wFrom)||!parseHM(sw.wTo)||sw.wFrom===sw.wTo); };
  const wName=w=>w?(w.k==='custom'?w.label:WN[w.k].t):'any time';
  const paintWinInfo=()=>{ const box=sh.querySelector('.sn-winfo'); if(!box)return; const up=upWin(t,id), now=Date.now(), eff=sw.win?(badWin()?null:winOf(sw)):up.w; let h='';
    chance=null;
    if(eff){ const o=inWin(eff,now), nx=o?null:nextOpen(eff,now);
      h+='<p class="tk-hint sn-wst">'+(o?'<span class="grn">Open now</span>':'Next opens <b>'+esc(nx?rel(nx,now):'—')+'</b>')+' · '+esc(eff.label.trim())+' · '+esc(DAYSET[eff.days])+'</p>';
      if(RO()){ chance=nextChance(sw.win?Object.assign({},sw):(up.src||t),now);
        h+=chance?'<p class="tk-ro tip">'+svg(IC.any)+'<span>Next chance on duty in its window: <b>'+esc(day(chance.s)+' '+hm(chance.s)+'–'+hm(chance.e))+'</b> ('+esc(chance.tour.label)+')</span><button type="button" class="sn-plan">Plan it</button></p>'
          :'<p class="tk-ro warn">'+svg(IC.any)+'<span>None of your tours in the next 6 weeks overlaps its time window.</span></p>'; } }
    box.innerHTML=h;
    const pb=box.querySelector('.sn-plan'); if(pb)pb.onclick=()=>{ if(!chance)return; const s=chance.s, e=chance.e;
      dtSet(sh,'sdue',e); sh.querySelectorAll('[data-stour]').forEach(b=>b.classList.remove('on'));
      if(s>Date.now()+MIN){ const m=Math.round((e-s)/MIN); opAt=[m,hm(s)]; if(!rem.includes(m))rem.push(m); } else opAt=null;
      paintRem(); dw(); vib(10); toast('Planned: '+day(s)+' '+hm(s)+'–'+hm(e)); }; };
  const paintWin=()=>{ const box=sh.querySelector('.sn-win'), up=upWin(t,id);
    let h='<div class="tk-wins"><button type="button" class="tk-win'+(sw.win?'':' on')+'" data-swin="" aria-pressed="'+!sw.win+'">'+svg(IC.up)+'<b>Same as above</b><small>'+esc(wName(up.w))+'</small></button>'
      +WINS.map(w=>'<button type="button" class="tk-win'+(w.k===sw.win?' on':'')+'" data-swin="'+w.k+'" aria-pressed="'+(w.k===sw.win)+'">'+svg(IC[w.k])+'<b>'+esc(w.t)+'</b><small>'+(w.from?esc(w.from+'–'+w.to):w.k==='any'?'no restriction':'set times')+'</small></button>').join('')+'</div>';
    if(sw.win==='custom')h+='<div class="tk-cw"><input class="tk-in sn-wf" inputmode="numeric" maxlength="5" placeholder="From HH:MM" aria-label="From — 24-hour time" value="'+esc(sw.wFrom||'')+'"><span>to</span><input class="tk-in sn-wt" inputmode="numeric" maxlength="5" placeholder="To HH:MM" aria-label="To — 24-hour time" value="'+esc(sw.wTo||'')+'"></div>';
    if(sw.win&&sw.win!=='any')h+='<div class="tk-days">'+Object.keys(DAYSET).map(k=>'<button type="button" class="tk-d'+((sw.wDays||WN[sw.win].days||'all')===k?' on':'')+'" data-sdays="'+k+'">'+DAYSET[k]+'</button>').join('')+'</div>'
      +'<label class="tk-chk"><input type="checkbox" class="sn-rw"'+(sw.remWin?' checked':'')+'><span>Remind me when it opens</span></label>';
    box.innerHTML=h+'<div class="sn-winfo"></div>';
    box.querySelectorAll('[data-swin]').forEach(b=>b.onclick=()=>{ readSW(); const k=b.dataset.swin; if(k===sw.win)return; sw.win=k; sw.wDays=null;
      if(k==='custom'&&!parseHM(sw.wFrom)){ sw.wFrom='09:00'; sw.wTo='17:00'; } if(!k||k==='any')sw.remWin=false; paintWin(); vib(8); });
    box.querySelectorAll('[data-sdays]').forEach(b=>b.onclick=()=>{ readSW(); sw.wDays=b.dataset.sdays; paintWin(); });
    box.querySelectorAll('.sn-wf,.sn-wt').forEach(i=>{ i.addEventListener('input',()=>{ const dg=i.value.replace(/\D/g,'').slice(0,4), v=dg.length>2?dg.slice(0,2)+':'+dg.slice(2):dg; if(v!==i.value)i.value=v; if(v.length===5)paintWinInfo(); });
      i.addEventListener('blur',()=>{ const p=parseHM(i.value); if(p)i.value=p2(p[0])+':'+p2(p[1]); paintWinInfo(); }); });
    paintWinInfo(); };
  // a type gives the step its symbol and offers that type's usual steps as its sub-steps
  const paintTpl=()=>{ const box=sh.querySelector('.sn-tpl'), y=locate(t.steps,id), L=sty&&STEPS[sty];
    const miss=y&&L&&levelOf(t.steps,id)<MAXD?(have=>L.filter(z=>!have.has(tplText(z))))(new Set(kids(y.n).map(k=>k.t))):[];
    if(!miss.length){ box.innerHTML=''; return; }
    box.innerHTML='<button type="button" class="tk-link sn-tplb">'+svg(IC.cliplist)+(kids(y.n).length?'Add the rest of the usual steps for '+esc(TY[sty].t)+' ('+miss.length+')':'Add the usual steps for '+esc(TY[sty].t)+' as sub-steps ('+miss.length+')')+'</button>';
    box.querySelector('.sn-tplb').onclick=()=>go(()=>{ const z=locate(t.steps,id); if(!z)return; if(nodeCount(t.steps)+miss.length>MAXN){ toast('That’s the most steps one task can hold ('+MAXN+')'); return; }
      const before=JSON.stringify(t.steps); z.n.steps=(z.n.steps||[]).concat(tplNodes(miss)); z.n.c=false; z.n.u=Date.now(); norm(t.steps); stepsSync(); reSteps(false);
      toastUndo(miss.length+' usual steps added',()=>restoreSteps(t,before)); }); };
  const dw=()=>{ const d=dtRead(sh,'sdue'), p=sh.querySelector('.sn-dw'); p.textContent=!isNaN(d)&&t.due&&d>t.due?'That’s after the task’s own deadline ('+full(t.due)+').':''; };
  dtWire(sh,'sdue',()=>{ sh.querySelectorAll('[data-stour]').forEach(b=>b.classList.remove('on')); if(opAt){ opAt=null; paintRem(); } dw(); });
  sh.querySelectorAll('[data-stour]').forEach(b=>b.onclick=()=>{ const sp=stTours[+b.dataset.stour]; if(!sp)return; dtSet(sh,'sdue',sp.e); sh.querySelectorAll('[data-stour]').forEach(x=>x.classList.toggle('on',x===b)); if(opAt){ opAt=null; paintRem(); } dw(); });
  const partial=()=>{ const w=sh.querySelector('[data-dt="sdue"]'); return !!((w.querySelector('.dt-d').value||w.querySelector('.dt-t').value.trim())&&isNaN(dtRead(sh,'sdue'))); };
  // keep what's finished — an unfinished date or unfinished custom times stay as they were
  const apply=()=>{ const y=locate(draft&&draft.steps,id); if(!y)return false; const pd=partial(), bw=badWin();
    const d=dtRead(sh,'sdue'), nd=pd?(y.n.due||null):(isNaN(d)?null:d), nt=sh.querySelector('.sn-note').value.trim().slice(0,1000), nr=rem.length?rem.slice().sort((p,q)=>p-q):[];
    const nw=bw?{win:y.n.win||null,wFrom:y.n.wFrom||null,wTo:y.n.wTo||null,wDays:y.n.wDays||null,remWin:!!y.n.remWin}
      :{win:sw.win||null,wFrom:sw.win==='custom'?sw.wFrom:null,wTo:sw.win==='custom'?sw.wTo:null,wDays:sw.win&&sw.win!=='any'?(sw.wDays||null):null,remWin:!!(sw.win&&sw.win!=='any'&&sw.remWin)};
    const na=sav||null, nb=sav==='away'?(saway||null):null, np=spri||null;
    if((y.n.due||null)===nd&&(y.n.n||'')===nt&&JSON.stringify(y.n.rem||[0])===JSON.stringify(nr)&&(y.n.type||'')===sty
      &&['win','wFrom','wTo','wDays'].every(k=>(y.n[k]||null)===nw[k])&&!!y.n.remWin===nw.remWin&&(y.n.avail||null)===na&&(y.n.awayBy||null)===nb&&(y.n.pri||null)===np)return false;
    y.n.due=nd; if(nt)y.n.n=nt; else delete y.n.n; y.n.rem=nr; if(sty)y.n.type=sty; else delete y.n.type;
    if(na)y.n.avail=na; else delete y.n.avail; if(nb)y.n.awayBy=nb; else delete y.n.awayBy; if(np)y.n.pri=np; else delete y.n.pri;
    ['win','wFrom','wTo','wDays'].forEach(k=>{ if(nw[k])y.n[k]=nw[k]; else delete y.n[k]; }); if(nw.remWin)y.n.remWin=true; else delete y.n.remWin;
    y.n.u=Date.now(); stepsSync(); return true; };
  sh._onclose=()=>{ const pd=partial(), bw=badWin(); if(apply())reSteps(false);
    if(pd||bw)toast(pd&&bw?'The date and the custom times weren’t finished, so they weren’t saved':pd?'The date wasn’t finished, so it wasn’t saved':'The custom times weren’t finished, so they weren’t saved'); };
  const go=fn=>{ apply(); sh._onclose=null; closeSheet(); fn(); };
  sh.querySelectorAll('[data-sa]').forEach(b=>b.onclick=()=>{ const k=b.dataset.sa;
    if(k==='zoom')go(()=>openPlan(id)); else if(k==='edit')go(()=>{ sEd=id; reSteps(true); }); else go(()=>stepOp(k,id)); });
  sh.querySelector('.sn-ok').onclick=async()=>{ const e=sh.querySelector('.tk-err');
    if(partial()){ e.textContent='Finish the date — a date and a 24-hour time — or tap “None”.'; e.hidden=false; e.scrollIntoView({block:'center'}); return; }
    if(badWin()){ e.textContent='Enter the times as two 24-hour times, e.g. 10:00 to 16:00.'; e.hidden=false; e.scrollIntoView({block:'center'}); return; }
    const ch=apply(); sh._onclose=null; closeSheet(); if(ch)reSteps(false);
    const y=locate(t.steps,id); if(y&&(y.n.remWin||y.n.due)&&!permOK()&&('Notification' in W)&&Notification.permission==='default')await enableReminders(); };
  const del=sh.querySelector('.sn-del'); del.onclick=()=>{ if(has&&del.dataset.sure!=='1'){ del.dataset.sure='1'; del.querySelector('span').textContent='Tap again to delete '+(nodeCount(n.steps)+1)+' steps'; return; }
    const before=JSON.stringify(t.steps), y=locate(t.steps,id); sh._onclose=null; closeSheet(); if(!y)return; y.list.splice(y.i,1); if(zoomId&&(zoomId===id||!locate(t.steps,zoomId)))zoomId=null;
    norm(t.steps); stepsSync(); reSteps(false); toastUndo(has?'Deleted '+(nodeCount(n.steps)+1)+' steps':'Step deleted',()=>restoreSteps(t,before)); };
  sh.querySelectorAll('[data-sty]').forEach(b=>b.onclick=()=>{ if(b.dataset.sty===sty)return; sty=b.dataset.sty;
    sh.querySelectorAll('[data-sty]').forEach(z=>{ const on=z.dataset.sty===sty; z.classList.toggle('on',on); z.setAttribute('aria-pressed',on); });
    if(sty&&TY[sty].win&&!sw.win){ readSW(); sw.win=TY[sty].win; paintWin(); }
    paintTpl(); vib(8); });
  // how urgent: worked out live from the case, the dates and their availability — or set it yourself
  const awayVal=ms=>ms?(d=>d.getFullYear()+'-'+p2(d.getMonth()+1)+'-'+p2(d.getDate()))(new Date(ms)):'';
  const paintUrg=()=>{ const box=sh.querySelector('.sn-urg'), y=locate(t.steps,id); if(!box||!y)return; const now=Date.now(), d=dtRead(sh,'sdue');
    const p=pathTo(t.steps,id).slice(0,-1); let inh={due:null,why:'',av:null}; p.forEach(a=>{ if(a.due&&(inh.due==null||a.due<inh.due)){ inh.due=a.due; inh.why='“'+String(a.t).slice(0,40)+'” is due'; } if(a.avail)inh.av={avail:a.avail,awayBy:a.awayBy}; });
    const tmp=Object.assign({},y.n,{due:isNaN(d)?(partial()?y.n.due:null):d,avail:sav||undefined,awayBy:saway||undefined,pri:spri||undefined}), u=urgOf(t,tmp,now,inh);
    box.innerHTML='<label class="tk-lab sm">How urgent?</label><p class="cs-urg l'+u.lv+'">'+svg(IC.flag)+'<b>'+LV[u.lv]+'</b><span>'+esc(u.why.join(' · '))+'</span></p>'
      +'<span class="tk-sublab">Their availability <small>— the person this step needs</small></span><div class="tk-days sn-av">'+AVAIL.map(([k,l])=>'<button type="button" class="tk-d'+(sav===k?' on':'')+'" data-sav="'+k+'" aria-pressed="'+(sav===k)+'">'+l+'</button>').join('')+'</div>'
      +(sav==='away'?'<label class="sn-awl"><span>Going on</span><input type="date" class="tk-in sn-away" value="'+awayVal(saway)+'" aria-label="The day they go away"></label>':'')
      +(!sav&&inh.av?'<p class="tk-hint sm">Following the step above: '+esc((AVAIL.find(a=>a[0]===inh.av.avail)||['',''])[1].toLowerCase())+'.</p>':'')
      +'<span class="tk-sublab">Set it yourself</span><div class="tk-days sn-pri">'+[[0,'Worked out'],[1,'Low'],[2,'Normal'],[3,'High'],[4,'Critical']].map(([k,l])=>'<button type="button" class="tk-d'+(k?' pl'+k:'')+(spri===k?' on':'')+'" data-spri="'+k+'" aria-pressed="'+(spri===k)+'">'+l+'</button>').join('')+'</div>';
    box.querySelectorAll('[data-sav]').forEach(b=>b.onclick=()=>{ sav=b.dataset.sav; if(sav!=='away')saway=null; vib(8); paintUrg(); if(sav==='away'&&!saway){ const i=box.querySelector('.sn-away'); if(i)try{ i.focus(); }catch(e){} } });
    box.querySelectorAll('[data-spri]').forEach(b=>b.onclick=()=>{ spri=+b.dataset.spri; vib(8); paintUrg(); });
    const ai=box.querySelector('.sn-away'); if(ai)ai.addEventListener('change',()=>{ const v=ai.value; if(v){ const [yy,mo,da]=v.split('-').map(Number); saway=new Date(yy,mo-1,da,0,0,0,0).getTime(); } else saway=null; paintUrg(); }); };
  dtWire(sh,'sdue',()=>paintUrg());
  paintRem(); paintWin(); paintTpl(); dw(); paintUrg();
  { const on=sh.querySelector('.sn-ty.on'), row=sh.querySelector('.sn-tys'); if(on&&row&&row.scrollWidth>row.clientWidth)row.scrollLeft=Math.max(0,on.offsetLeft-row.offsetLeft-12); }
}
/* full screen: the whole plan, or one step and everything under it */
function openPlan(z){ if(view==='edit')readDraft(); commitEdit(); sEd=null; edbar(false); zoomId=z||null; view='plan'; render(); main.scrollTop=0; }
function renderPlan(keep){ const t=draft; if(!t){ view='list'; renderList(); return; }
  const st=keep?main.scrollTop:0, now=Date.now();
  ov.querySelector('.tk-title').textContent='Steps'; ov.querySelector('.tk-fab').hidden=true; ov.querySelector('.tk-copy').hidden=true; ov.querySelector('.tk-scan').hidden=true;
  pruneEmpty(t.steps||(t.steps=[]),sEd); norm(t.steps);
  const z=zoomId?locate(t.steps,zoomId):null; if(zoomId&&!z)zoomId=null;
  const all=cnt(t.steps), list=z?kids(z.n):t.steps, ty=tyOf(t), sd=nextStepDue(t), o={ed:sEd,now,hide:hideDone,urg:stepUrgs(t,now)};
  let h='<div class="tk-wrap tk-plan"><div class="pl-head"><span class="tk-ico ty-'+ty.k+'">'+svg(icOf(t))+'</span><div class="pl-ht"><b>'+esc(t.title||ty.t)+'</b><small>'
    +(all.m?all.n+' of '+all.m+' steps done':'No steps yet')+(sd?' · next by '+esc(rel(sd,now)):'')+'</small>'+(all.m?'<div class="tk-prog"><i style="width:'+Math.round(100*all.n/all.m)+'%"></i></div>':'')+'</div></div>';
  if(z){ const p=pathTo(t.steps,z.n.id);
    h+='<nav class="pl-crumbs" aria-label="Back up to"><button type="button" data-z="">'+svg(IC.up)+'All steps</button>'+p.slice(0,-1).map(x=>'<span aria-hidden="true">›</span><button type="button" data-z="'+x.id+'">'+esc(x.t)+'</button>').join('')+'</nav>'
      +'<div class="pl-zoom">'+treeHtml([Object.assign({},z.n,{c:true})],{ed:sEd,now,urg:o.urg})+'</div>'; }
  h+='<div class="pl-ctl"><button type="button" data-pc="hide" class="'+(hideDone?'on':'')+'" aria-pressed="'+hideDone+'">'+svg(IC.eyeoff)+'Hide done</button>'
   +(list.some(x=>kids(x).length)?'<button type="button" data-pc="col">'+svg(IC.colall)+'Collapse all</button><button type="button" data-pc="exp">'+svg(IC.expall)+'Expand all</button>':'')
   +'<button type="button" data-pc="paste">'+svg(IC.cliplist)+'Paste a list</button>'+(hasKey()?'<button type="button" data-pc="ai">'+svg(IC.spark)+'Break it down</button>':'')
   +(list.length?'<button type="button" data-pc="copy">'+svg(IC.copy)+'Copy</button>':'')+'</div>';
  if(list.length){ h+=treeHtml(list,o); if(hideDone&&!list.some(k=>!isDone(k)))h+=empty('Everything here is done.','Tap “Hide done” to see the finished steps.'); }
  else h+=empty(z?'No sub-steps yet.':'No steps yet.','Add one below, or paste a whole list.');
  if(!z&&all.m&&all.n===all.m&&curId&&!t.done)h+='<button type="button" class="tk-alldone">'+svg(IC.check)+'All steps done — mark the task done</button>';
  h+='<div class="pl-add"><input class="tk-in pl-new" maxlength="200" placeholder="'+esc(z?'Add a sub-step to “'+z.n.t.slice(0,36)+(z.n.t.length>36?'…':'')+'”':'Add a step')+'" enterkeyhint="done" aria-label="New step"><button type="button" class="tk-go pl-addb" aria-label="Add the step">'+svg(IC.plus)+'</button></div></div>';
  main.innerHTML=h; main.scrollTop=st;
  main.querySelectorAll('.tk-tree').forEach(wireTree);
  main.querySelectorAll('[data-z]').forEach(b=>b.onclick=()=>{ commitEdit(); sEd=null; edbar(false); zoomId=b.dataset.z||null; renderPlan(); });
  main.querySelectorAll('[data-pc]').forEach(b=>b.onclick=()=>{ const k=b.dataset.pc, zz=zoomId?locate(t.steps,zoomId):null, L=zz?kids(zz.n):t.steps;
    if(k==='hide'){ hideDone=!hideDone; setPref('hideDone',hideDone); renderPlan(true); }
    else if(k==='col'||k==='exp'){ commitEdit(); sEd=null; edbar(false); walk(L,n=>{ if(kids(n).length)n.c=(k==='col'); }); stepsSync(); renderPlan(true); }
    else if(k==='paste')pasteSheet(zoomId); else if(k==='ai')aiSteps(zoomId); else if(k==='copy')copySteps(zz?zz.n:null); });
  const ni=main.querySelector('.pl-new'), add=()=>{ const v=ni.value.replace(/\s+/g,' ').trim(); if(!v){ ni.focus(); return; } if(addStep(v,zoomId)===false)return; const n2=main.querySelector('.pl-new'); if(n2)n2.focus(); };
  main.querySelector('.pl-addb').onclick=add; ni.onkeydown=e=>{ if(e.key==='Enter'&&!e.isComposing){ e.preventDefault(); add(); } };
  const ad=main.querySelector('.tk-alldone'); if(ad)ad.onclick=()=>{ const id=curId; view='list'; draft=null; zoomId=null; toggleDone(id); };
  if(W.grHudTick)W.grHudTick(); }
/* paste a whole list — from your notes app, an email, a checklist */
function pasteSheet(parentId,prefill,src){ const t=draft; if(!t)return; commitEdit(); sEd=null; edbar(false);
  const z=parentId?locate(t.steps,parentId):null, base=z?levelOf(t.steps,parentId):0;
  sh.innerHTML='<div class="tk-grip"></div><h3>'+(src==='ai'?'Suggested steps':'Paste a list')+'</h3>'
   +'<p class="tk-note">'+(src==='ai'?'From Claude — check them and change anything that doesn’t fit. Follow current Garda policy and your Sergeant’s direction.':'One step per line. To make a line a sub-step of the one above it, start it with “-” (or “--” to go two levels in), or indent it.')+'</p>'
   +'<textarea class="tk-in tk-ta big pa-t" placeholder="Statements\n- Injured party\n- Witnesses\nCCTV\n- Centra, Dorset St\n- Spar, Parnell St">'+esc(prefill||'')+'</textarea>'
   +'<p class="tk-hint pa-n"></p><div class="tk-row2"><button type="button" class="tk-sec-btn pa-x">Cancel</button><button type="button" class="tk-go pa-ok" disabled>Add</button></div>';
  sh.hidden=false; ov.querySelector('.tk-shade').hidden=false; sh.scrollTop=0;
  const ta=sh.querySelector('.pa-t'), ok=sh.querySelector('.pa-ok'), info=sh.querySelector('.pa-n');
  const upd=()=>{ const L=parseOutline(ta.value,MAXD-base), n=nodeCount(L), lv=L.length?Math.max(...L.map(height)):0;
    ok.disabled=!n; ok.textContent=n?'Add '+n+' step'+(n===1?'':'s'):'Add'; info.textContent=n?n+' step'+(n===1?'':'s')+(lv>1?' on '+lv+' levels':'')+(z?' — under “'+z.n.t.slice(0,40)+'”':''):''; return L; };
  ta.oninput=upd; upd(); if(!prefill)setTimeout(()=>{ try{ ta.focus(); }catch(e){} },60);
  sh.querySelector('.pa-x').onclick=()=>closeSheet();
  ok.onclick=()=>{ const L=upd(); if(!L.length)return; if(nodeCount(L)>MAXN-nodeCount(t.steps)){ toast('Too many — one task holds up to '+MAXN+' steps'); return; }
    const before=JSON.stringify(t.steps||[]), y=parentId?locate(t.steps,parentId):null;
    if(y){ y.n.steps=(y.n.steps||[]).concat(L); y.n.c=false; } else t.steps=(t.steps||[]).concat(L);
    norm(t.steps); stepsSync(); closeSheet(); reSteps(false); toastUndo(nodeCount(L)+' step'+(nodeCount(L)===1?'':'s')+' added',()=>restoreSteps(t,before)); }; }
/* break it down — Claude suggests steps (with your own API key; only the title is sent) */
function aiSteps(parentId){ const t=draft; if(!t)return; commitEdit(); sEd=null; edbar(false);
  if(!hasKey()){ toast('Add your Anthropic API key in AI search settings first'); return; }
  const z=parentId?locate(t.steps,parentId):null, what=(z?z.n.t:(t.title||'')).trim();
  if(what.length<4){ toast('Give the '+(z?'step':'task')+' a title first'); return; }
  sh.innerHTML='<div class="tk-grip"></div><h3>Break it down with Claude</h3><p class="tk-note">Claude suggests steps and sub-steps. Only this is sent (to Anthropic, with your API key):</p>'
   +'<div class="tk-plr"><b>'+esc(what)+'</b><small>'+esc(tyLabel(t))+(z&&t.title?' · part of “'+esc(t.title.slice(0,60))+'”':'')+'</small></div>'
   +'<p class="tk-hint">Nothing else from the task — no notes, places or other steps. Don’t send names or details of members of the public: change the title first if it has any.</p><p class="tk-err" hidden></p>'
   +'<div class="tk-row2"><button type="button" class="tk-sec-btn ai-x">Cancel</button><button type="button" class="tk-go ai-go">'+svg(IC.spark)+' Suggest steps</button></div>';
  sh.hidden=false; ov.querySelector('.tk-shade').hidden=false; sh.scrollTop=0;
  sh.querySelector('.ai-x').onclick=()=>closeSheet();
  const go=sh.querySelector('.ai-go'); go.onclick=async()=>{ go.disabled=true; go.textContent='Thinking…'; const e=sh.querySelector('.tk-err'); e.hidden=true;
    try{ const out=await claudeOutline(what,tyLabel(t),z?(t.title||''):''); if(draft!==t||sh.hidden)return; pasteSheet(parentId,out,'ai'); }
    catch(err){ if(sh.hidden||!go.isConnected)return; go.disabled=false; go.innerHTML=svg(IC.spark)+' Try again'; e.textContent=(err&&err.message)||'Couldn’t reach Claude right now.'; e.hidden=false; } }; }
async function claudeOutline(what,type,parent){ const key=(localStorage.getItem(AIKEY)||'').trim();
  if(navigator.onLine===false)throw new Error('No signal — try again when you have signal.');
  let models=['claude-sonnet-5','claude-sonnet-4-6']; try{ const pref=localStorage.getItem('gr_ai_model'); if(pref&&models.includes(pref))models=[pref].concat(models.filter(m=>m!==pref)); }catch(e){}
  const prompt='A probationary member of An Garda Síochána (Ireland) wants to break a piece of work into steps.\n'+(parent?'It is part of the task: "'+parent+'".\n':'')+'Work: "'+what+'" (type: '+type+').\n'
   +'Write a practical plan as an indented outline: one step per line, two spaces of indent per level, at most 3 levels and 30 lines, each line under 90 characters, each starting with a verb. '
   +'Keep to general good practice under Irish law and Garda procedure. Do not invent form numbers, policy names, deadlines or legal sections you are not sure of, and do not include any personal details. '
   +'Reply with the outline only — no title, numbering, bullets, markdown or commentary.';
  let last=null;
  for(const model of models){
    const r=await fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'Content-Type':'application/json','x-api-key':key,'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'},body:JSON.stringify({model,max_tokens:1500,messages:[{role:'user',content:prompt}]})});
    const d=await r.json().catch(()=>({}));
    if(!r.ok||d.error){ const m=(d.error&&d.error.message)||('HTTP '+r.status); if(r.status===404||/model/i.test(m)){ last=new Error(m); continue; } throw new Error(r.status===401?'The API key was refused — check it in AI search settings.':m); }
    const txt=(d.content||[]).filter(b=>b.type==='text').map(b=>b.text).join('\n').replace(/^```[a-z]*\n?/i,'').replace(/```\s*$/,'').trim();
    if(!txt)throw new Error('Claude didn’t suggest anything — try rewording the title.');
    return txt; }
  throw last||new Error('Couldn’t reach Claude right now.'); }
function copySteps(node){ const t=draft; if(!t)return; const txt=(node?node.t:(t.title||'Steps'))+'\n'+stepLines(node?node.steps:t.steps,'',false).join('\n');
  (navigator.clipboard&&navigator.clipboard.writeText?navigator.clipboard.writeText(txt):Promise.reject()).then(()=>toast('Steps copied — paste them into a message or your notes')).catch(()=>{
    sh.innerHTML='<div class="tk-grip"></div><h3>Steps</h3><textarea class="tk-in tk-ta big" readonly>'+esc(txt)+'</textarea><button type="button" class="tk-sec-btn wide tk-x">Close</button>';
    sh.hidden=false; ov.querySelector('.tk-shade').hidden=false; sh.querySelector('.tk-x').onclick=()=>closeSheet(); }); }
/* place lookup: OpenStreetMap (Nominatim, one search per tap — no search-as-you-type) and, if you choose, Claude web search */
let lastNom=0;
function osmPlace(r){ const x=r.extratags||{}, a=r.address||{};
  const pick=(...ks)=>{ for(const k of ks){ if(x[k])return String(x[k]).split(';')[0].trim(); } return ''; };
  const street=[a.house_number,a.road].filter(Boolean).join(' '), area=a.suburb||a.neighbourhood||a.quarter||a.city_district||'', city=a.city||a.town||a.village||a.county||'';
  return {n:(r.name||String(r.display_name||'').split(',')[0]).trim(),a:[street,area!==city?area:'',city,a.postcode||''].filter(Boolean).join(', ')||String(r.display_name||'').split(',').slice(1,4).join(',').trim(),
    lat:+r.lat,lon:+r.lon,ph:pick('phone','contact:phone','contact:mobile','mobile'),em:pick('email','contact:email'),web:pick('website','contact:website','url'),oh:String(x.opening_hours||'').slice(0,200),src:'osm',kind:String(r.type||'').replace(/_/g,' ')}; }
async function findPlace(q){ const t=draft; if(!t)return;
  if(navigator.onLine===false){ t._pl={q,res:[],err:'No signal — try again when you have signal.'}; rerEdit(); return; }
  t._pl={q,busy:true,res:[]}; t._web=null; rerEdit();
  await new Promise(ok=>setTimeout(ok,Math.max(0,1100-(Date.now()-lastNom)))); lastNom=Date.now();
  try{ const ctl=new AbortController(), to=setTimeout(()=>ctl.abort(),12000);
    const res=await fetch('https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&extratags=1&limit=6&countrycodes=ie&accept-language=en&viewbox=-6.55,53.50,-6.00,53.20&q='+encodeURIComponent(q),{headers:{'Accept':'application/json'},signal:ctl.signal});
    clearTimeout(to); if(!res.ok)throw new Error('HTTP '+res.status);
    const j=await res.json(); if(draft!==t)return;
    const L=(Array.isArray(j)?j:[]).map(osmPlace).filter(x=>x.n);
    t._pl={q,res:L,err:L.length?'':'Nothing found on OpenStreetMap for “'+q+'” — try adding the street or the town.'}; }
  catch(e){ if(draft!==t)return; t._pl={q,res:[],err:'Couldn’t search right now — check your signal and try again.'}; }
  rerEdit(); }
async function claudeContacts(q){ const key=(localStorage.getItem(AIKEY)||'').trim(); if(!key)throw new Error('Add your Anthropic API key in AI search settings first.');
  let models=['claude-sonnet-5','claude-sonnet-4-6']; try{ const pref=localStorage.getItem('gr_ai_model'); if(pref&&models.includes(pref))models=[pref].concat(models.filter(m=>m!==pref)); }catch(e){}
  const prompt='Find the public contact details of this business, organisation or public place in Ireland: "'+q+'".\n'
   +'Search the web. Only give details you actually found on a web page in this search — never guess or make up a phone number, email or address. '
   +'If this looks like a private home or a private individual rather than a business or public place, do not search: reply {"private":true}.\n'
   +'Reply with JSON only, no other text: {"name":"","address":"","phone":"","email":"","website":"","hours":"","sources":["https://…"]} — use "" for anything you did not find.';
  let last=null;
  for(const model of models){
    let messages=[{role:'user',content:prompt}], d=null, modelErr=false;
    for(let turn=0;turn<3;turn++){
      const r=await fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'Content-Type':'application/json','x-api-key':key,'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'},
        body:JSON.stringify({model,max_tokens:1500,tools:[{type:'web_search_20250305',name:'web_search',max_uses:4,user_location:{type:'approximate',country:'IE',timezone:'Europe/Dublin'}}],messages})});
      d=await r.json().catch(()=>({}));
      if(!r.ok||d.error){ const m=(d.error&&d.error.message)||('HTTP '+r.status);
        if(r.status===404||/model/i.test(m)){ modelErr=true; last=new Error(m); break; }
        throw new Error(r.status===401?'The API key was refused — check it in AI search settings.':/web.?search/i.test(m)?'Web search isn’t switched on for your Anthropic account — it can be enabled in the Anthropic Console.':m); }
      if(d.stop_reason==='pause_turn'){ messages=[messages[0],{role:'assistant',content:d.content}]; continue; }
      break; }
    if(modelErr||!d||!Array.isArray(d.content))continue;
    const txt=d.content.filter(b=>b.type==='text').map(b=>b.text).join(''), a=txt.indexOf('{'), z=txt.lastIndexOf('}');
    const cites=[]; d.content.forEach(b=>(b.citations||[]).forEach(c=>{ if(c.url&&!cites.includes(c.url))cites.push(c.url); }));
    let j; try{ j=JSON.parse(txt.slice(a,z+1)); }catch(e){ throw new Error('Claude’s answer couldn’t be read — try again.'); }
    if(j.private)return {private:true};
    const em=String(j.email||'').trim(), ph=String(j.phone||'').trim(), web=String(j.website||'').trim();
    return {name:String(j.name||'').trim().slice(0,120),a:String(j.address||'').trim().slice(0,160),ph:ph.replace(/\D/g,'').length>=6?ph.slice(0,40):'',
      em:/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)?em.slice(0,120):'',web:/^https?:\/\//i.test(web)?web.slice(0,200):'',oh:String(j.hours||'').trim().slice(0,200),
      sources:[].concat(Array.isArray(j.sources)?j.sources:[],cites).map(String).filter(u=>/^https?:\/\//.test(u)).filter((u,i,A)=>A.indexOf(u)===i).slice(0,6)}; }
  throw last||new Error('Couldn’t search the web right now.'); }
async function webFind(){ const t=draft; if(!t)return;
  const q=(t.place&&t.place.n?[t.place.n,t.place.a].filter(Boolean).join(', '):(t._pl&&t._pl.q)||t._pq||guessPlace(t.title)||'').trim();
  if(q.length<3){ toast('Type the name of the place first'); return; }
  if(navigator.onLine===false){ t._web={err:'No signal — try again when you have signal.'}; rerEdit(); return; }
  t._web={busy:true}; rerEdit();
  try{ const res=await claudeContacts(q); if(draft!==t)return; t._web={res}; }
  catch(e){ if(draft!==t)return; t._web={err:(e&&e.message)||'Couldn’t search the web right now.'}; }
  rerEdit(); }
function wirePlace(r){ const t=draft;
  const fi=r.querySelector('.pl-find'), inp=r.querySelector('.f-place');
  if(fi){ const go=()=>{ readDraft(); const q=((inp&&inp.value.trim())||guessPlace(t.title)||'').trim(); if(q.length<3){ toast('Type the name of the place first'); if(inp)inp.focus(); return; } findPlace(q); };
    fi.onclick=go; if(inp)inp.onkeydown=e=>{ if(e.key==='Enter'){ e.preventDefault(); go(); } }; }
  r.querySelectorAll('[data-plu]').forEach(b=>b.onclick=()=>{ readDraft(); const x=(t._pl&&t._pl.res||[])[+b.dataset.plu]; if(!x)return; t.place=Object.assign({},x); t._pl=null; t._pq=''; t._web=null; rerEdit(); toast('Place added'); });
  const ro=r.querySelector('.pl-route'); if(ro)ro.onclick=()=>{ readDraft(); const p=t.place; if(!p||p.lat==null)return; closeTasks(); W.openRoute({lat:p.lat,lon:p.lon,name:p.n}); };
  const rm=r.querySelector('.pl-rm'); if(rm)rm.onclick=()=>{ readDraft(); t._pq=(t.place&&t.place.n)||''; t.place=null; t._pl=null; t._web=null; rerEdit(); };
  const re=r.querySelector('.pl-re'); if(re)re.onclick=()=>{ readDraft(); const q=[t.place.n,t.place.src==='osm'?'':t.place.a].filter(Boolean).join(', '); t._pq=t.place.n; t.place=null; findPlace(q); };
  r.querySelectorAll('.pl-web').forEach(b=>b.onclick=()=>{ readDraft(); webFind(); });
  const wu=r.querySelector('.pl-webuse'); if(wu)wu.onclick=()=>{ readDraft(); const w=t._web&&t._web.res; if(!w)return;
    const p=t.place?Object.assign({},t.place):{n:w.name||t._pq||(t._pl&&t._pl.q)||'',a:'',src:'web'};
    if(!p.n&&w.name)p.n=w.name; ['ph','em','web','oh','a'].forEach(k=>{ if(w[k]&&!p[k])p[k]=w[k]; }); p.srcs=w.sources||[]; p.web2=1;
    t.place=p; t._web=null; t._pl=null; rerEdit(); toast('Details added — check them before relying on them'); };
}
/* email it to yourself · add to calendar */
const EMRE=/^[^\s@<>()"',;:]+@[^\s@<>()"',;:]+\.[a-z]{2,}$/i;
function askEmail(then){ const cur=prefs().me||'';
  sh.innerHTML='<div class="tk-grip"></div><h3>Your email address</h3><p class="tk-note">Tasks you email to yourself go here. Saved only on this phone.</p>'
   +'<input class="tk-in f-em" type="email" inputmode="email" autocomplete="email" placeholder="name@example.com" value="'+esc(cur)+'"><p class="tk-err" hidden></p>'
   +'<div class="tk-row2"><button type="button" class="tk-sec-btn em-x">Cancel</button><button type="button" class="tk-go em-ok">Save</button></div>';
  sh.hidden=false; ov.querySelector('.tk-shade').hidden=false;
  const i=sh.querySelector('.f-em'); setTimeout(()=>{ try{ i.focus(); }catch(e){} },60);
  sh.querySelector('.em-x').onclick=()=>closeSheet();
  const ok=()=>{ const v=i.value.trim(); if(!EMRE.test(v)){ const e=sh.querySelector('.tk-err'); e.textContent='Enter a valid email address.'; e.hidden=false; return; } setPref('me',v); closeSheet(); toast('Saved'); if(then)then(); };
  sh.querySelector('.em-ok').onclick=ok; i.onkeydown=e=>{ if(e.key==='Enter'){ e.preventDefault(); ok(); } }; }
function mailTo(subject,body){ const to=prefs().me||''; if(!EMRE.test(to))return;
  location.href='mailto:'+to+'?subject='+encodeURIComponent(subject)+'&body='+encodeURIComponent(body.length>7000?body.slice(0,7000)+'\n…':body); }
function mailTask(t){ if(!prefs().me){ askEmail(()=>mailTask(t)); return; }
  mailTo((t.urgent?'URGENT · ':'')+'Task: '+(t.title||tyOf(t).t)+(t.due?' — '+(planned(t)?'by end of tour ':'due ')+hm(t.due)+' '+day(t.due):''), taskText(t)+'\n\n— sent from Assisting'); }
function taskText(t,now){ now=now||Date.now(); const c=classify(t,now), w=winOf(t), k=kindOf(t), L=[];
  L.push((t.urgent?'[URGENT] ':'')+tyOf(t).t+(k?' · '+k.t:'')+': '+(t.title||''));
  if(t.due)L.push('   '+(c.od&&!t.done?'OVERDUE since ':'Due ')+full(t.due)+(planned(t)?' — end of your '+t.tour.label+' tour':''));
  if(w)L.push('   When: '+w.label.trim()+(w.days!=='all'?' '+DAYSET[w.days]:''));
  if(t.type==='cctv'&&cctvOverwrite(t.cctv))L.push('   Footage overwritten from '+full(cctvOverwrite(t.cctv)));
  if(t.place&&t.place.n)L.push('   Place: '+t.place.n+(t.place.a?', '+t.place.a:'')+(t.place.ph?' · tel '+t.place.ph:'')+(t.place.em?' · '+t.place.em:''));
  if(t.notes)L.push('   '+t.notes.replace(/\n/g,'\n   '));
  const sc=cnt(t.steps); if(sc.m){ L.push('   Steps — '+sc.n+' of '+sc.m+' done:'); stepLines(t.steps,'   ',true).forEach(x=>L.push(x)); }
  return L.join('\n'); }
const fileSafe=s=>String(s||'task').replace(/[^\w\s-]/g,'').trim().replace(/\s+/g,'-').slice(0,40)||'task';
function icsText(list){ const now=Date.now(), te=new TextEncoder();
  const ie=s=>String(s||'').replace(/\\/g,'\\\\').replace(/;/g,'\;').replace(/,/g,'\\,').replace(/\r?\n/g,'\\n');
  const ut=ms=>{ const d=new Date(ms); return d.getUTCFullYear()+p2(d.getUTCMonth()+1)+p2(d.getUTCDate())+'T'+p2(d.getUTCHours())+p2(d.getUTCMinutes())+'00Z'; };
  const dur=ms=>{ const neg=ms<0; let m=Math.abs(Math.round(ms/MIN)); const dd=Math.floor(m/1440), hh=Math.floor(m%1440/60); m=m%60;
    return (neg?'-':'')+'P'+(dd?dd+'D':'')+(hh||m||!dd?'T'+(hh?hh+'H':'')+(m||!hh?m+'M':''):''); };
  const fold=l=>{ const out=[]; let cur='', n=0; for(const ch of l){ const b=te.encode(ch).length; if(n+b>74){ out.push(cur); cur=' '; n=1; } cur+=ch; n+=b; } out.push(cur); return out.join('\r\n'); };
  const L=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Assisting//Tasks//EN','CALSCALE:GREGORIAN','METHOD:PUBLISH'];
  list.forEach(t=>{ walk(t.steps,n=>{ if(!n.due||isDone(n))return;
      L.push('BEGIN:VEVENT','UID:'+t.id+'-'+n.id+'@assisting','DTSTAMP:'+ut(now),'DTSTART:'+ut(n.due-30*MIN),'DTEND:'+ut(n.due),'SUMMARY:'+ie('Step: '+n.t+' — '+(t.title||tyOf(t).t)),'DESCRIPTION:'+ie((n.n?n.n+'\n\n':'')+(stepTags(n)?stepTags(n)+'\n\n':'')+'Part of: '+(t.title||tyOf(t).t)+'\n\nFrom Assisting'));
      [...new Set(n.rem&&n.rem.length?n.rem:[0])].sort((a,b)=>a-b).slice(0,3).forEach(m=>L.push('BEGIN:VALARM','ACTION:DISPLAY','DESCRIPTION:'+ie(n.t),'TRIGGER:'+dur(30*MIN-m*MIN),'END:VALARM'));
      L.push('END:VEVENT'); }); });
  list.filter(t=>t.due).forEach(t=>{ const s=planned(t)?t.tour.s:t.due-30*MIN, e=t.due;
    L.push('BEGIN:VEVENT','UID:'+t.id+'@assisting','DTSTAMP:'+ut(now),'DTSTART:'+ut(s),'DTEND:'+ut(e),'SUMMARY:'+ie((t.urgent?'URGENT · ':'')+tyOf(t).t+': '+(t.title||'')),
      'DESCRIPTION:'+ie(taskText(t).split('\n').slice(1).map(x=>x.replace(/^ {3}/,'')).join('\n')+'\n\nFrom Assisting'));
    if(t.place&&t.place.n)L.push('LOCATION:'+ie([t.place.n,t.place.a].filter(Boolean).join(', ')));
    [...new Set(t.rem&&t.rem.length?t.rem:[0])].sort((a,b)=>a-b).slice(0,3).forEach(m=>L.push('BEGIN:VALARM','ACTION:DISPLAY','DESCRIPTION:'+ie(t.title||'Task'),'TRIGGER:'+dur(e-m*MIN-s),'END:VALARM'));
    L.push('END:VEVENT'); });
  L.push('END:VCALENDAR'); return L.map(fold).join('\r\n')+'\r\n'; }
function saveIcs(list,name){ const blob=new Blob([icsText(list)],{type:'text/calendar;charset=utf-8'});
  try{ if(W.GRDocs&&W.GRDocs.save)W.GRDocs.save(blob,name); else { const u=URL.createObjectURL(blob), a=D.createElement('a'); a.href=u; a.download=name; D.body.appendChild(a); a.click(); setTimeout(()=>{ URL.revokeObjectURL(u); a.remove(); },4000); }
    toast('Calendar file saved — open it to add '+(list.length>1?'them':'it')+' to your calendar'); }
  catch(e){ toast('Couldn’t save the calendar file'); } }
function calTask(t){ if(!t.due&&!nextStepDue(t)){ toast('Set a deadline (for the task or a step) first — then add it to your calendar'); return; } saveIcs([t],'task-'+fileSafe(t.title||tyOf(t).t)+'.ics'); }
function openTpl(id){
  try{ if(typeof TPL!=='undefined'&&TPL&&typeof openTemplate==='function'){ const i=TPL.findIndex(x=>x.id===id); if(i>=0){ closeTasks(); openTemplate(i); return; } } }catch(e){}
  toast('Templates are still loading — try again in a moment');
}
function closeSheet(){ if(!sh)return; const f=sh._onclose; sh._onclose=null; if(f&&!sh.hidden){ try{ f(); }catch(e){} } sh.hidden=true; sh.innerHTML=''; ov.querySelector('.tk-shade').hidden=true; }

/* ================= follow-ups when a task is done ================= */
// [type, title, what it involves, when]  when: none · t23 (today) · +Nd (N days, 09:00)
const FOLLOW={
 cctv:[['exhibit','Exhibit the footage','label it and keep the continuity','none','lodge'],['cctv','View the footage','viewing notes · stills of anyone of interest','+1d','view'],['statement','Statement from whoever produced it','how and when the footage was downloaded','+2d','wit'],['file','Disclosure — schedule the footage','relied on, or unused material','+7d','disclosure']],
 statement:[['file','Add the statement to the file','and update PULSE','+1d','pulse'],['other','Follow up what the statement raised','witnesses, CCTV, other enquiries','+2d'],['victim','Update the injured party','what happens next','+2d','update'],['file','Disclosure — schedule the statement','','+7d','disclosure']],
 arrest:[['file','Update PULSE — arrest and outcome','','t23','pulse'],['statement','Arrest statement / memo of interview','','+1d','own'],['court','Charge, or apply for a summons','','+1d'],['exhibit','Record property and exhibits','seized items · continuity','t23','lodge'],['file','Prepare the file','','+7d'],['file','Disclosure — schedule the material','','+7d','disclosure']],
 enquiry:[['file','Record the result','PULSE / notes','t23','pulse'],['statement','Statement arising from the enquiries','','+2d','wit'],['enquiry','Further enquiries','','+2d']],
 visit:[['file','Record the result','PULSE / notes','t23','pulse'],['visit','Call back — nobody home','','+1d','callback'],['statement','Statement arising from the visit','','+2d']],
 call:[['file','Record the result','','t23','pulse'],['call','Ring again','no answer','+1d','again']],
 night:[['file','Record the result','','t23','pulse']],
 court:[['file','Update PULSE with the outcome','','t23','pulse'],['court','Next court date','remand or adjourned date','none','date'],['victim','Tell the injured party the outcome','','+2d','update'],['exhibit','Exhibits — return or dispose','once the case is finished','+7d','return']],
 file:[['file','Submit for review','sergeant / supervisor','+1d'],['file','Disclosure schedule','','+7d','disclosure']],
 exhibit:[['file','Update the exhibits register','continuity','t23'],['exhibit','Chase the lab result','','+14d','lab'],['exhibit','Return property to the owner','','+7d','return']],
 traffic:[['file','Update PULSE','','t23','pulse'],['file','Traffic file','statements · documents · exhibits','+7d','traffic'],['limit','Watch the summons time limit','summary offence','none']],
 victim:[['victim','Next update to the victim','','+14d','update'],['file','Note the contact on PULSE','','t23','pulse']],
 email:[['email','Chase a reply','','+7d']],
 limit:[['court','Track the summons','issue, service and court date','+14d','summons']],
 admin:[['admin','Follow up','','+7d']],
 other:[['other','Follow-up','','+1d']]
};
const whenTxt=q=>q==='none'?'no deadline':q==='t23'?'today':q==='+1d'?'tomorrow':q.replace(/^\+(\d+)d$/,'in $1 days');
function followSheet(t){
  if(!ov||ov.hidden)return; const L=FOLLOW[t.type]||FOLLOW.other, pick=new Set();
  let h='<div class="tk-grip"></div><h3>✓ Done — any follow-up?</h3><p class="tk-note">'+esc(t.title)+'</p>';
  if(t.type==='arrest')h+='<div class="tk-row2"><button type="button" class="tk-sec-btn fu-det">⏱ Start detention clock</button><button type="button" class="tk-sec-btn fu-gaol">🔐 Cell checks</button></div>';
  h+='<div class="tk-fu">'+L.map((f,i)=>'<button type="button" class="tk-fuo" data-fu="'+i+'"><span class="tk-ico ty-'+f[0]+'">'+svg(icOf({type:f[0],kind:f[4]}))+'</span><span class="tk-fut"><b>'+esc(f[1])+'</b><small>'+esc((f[2]?f[2]+' · ':'')+whenTxt(f[3]))+'</small></span><i></i></button>').join('')+'</div>'
   +'<div class="tk-row2"><button type="button" class="tk-sec-btn fu-none">No follow-up</button><button type="button" class="tk-go fu-add" disabled>Add follow-up</button></div>'
   +'<div class="tk-fu-foot"><button type="button" class="tk-link fu-own">'+svg(IC.plus)+'Write my own</button><button type="button" class="tk-link fu-undo">Undo — not done</button></div>';
  sh.innerHTML=h; sh.hidden=false; ov.querySelector('.tk-shade').hidden=false; ov.querySelector('.tk-toast').classList.remove('on');
  const add=sh.querySelector('.fu-add');
  sh.querySelectorAll('[data-fu]').forEach(b=>b.onclick=()=>{ const i=+b.dataset.fu; if(pick.has(i))pick.delete(i); else pick.add(i); b.classList.toggle('on',pick.has(i));
    add.disabled=!pick.size; add.textContent=pick.size?'Add '+pick.size+' follow-up'+(pick.size>1?'s':''):'Add follow-up'; });
  add.onclick=()=>{ const now=Date.now(); let n=0;
    for(const i of [...pick].sort()){ const f=L[i], ty=TY[f[0]]||TY.other;
      DB.tasks.push({id:uid(),type:f[0],kind:f[4]||null,steps:[],title:(f[1]+' · '+t.title).slice(0,120),notes:'Follow-up from “'+t.title+'” (done '+full(t.done||now)+')'+(f[2]?'\n'+f[2]:''),urgent:false,win:ty.win||'any',wDays:null,
        due:f[3]==='none'?null:quick(f[3]),rem:f[3]==='none'?[]:[0,60],remWin:false,created:now+n,done:null,fired:{},from:t.id}); n++; }
    save(); closeSheet(); render(); check(); toast(n+' follow-up'+(n>1?'s':'')+' added'); };
  sh.querySelector('.fu-none').onclick=()=>{ closeSheet(); toast('✓ Done'); };
  sh.querySelector('.fu-own').onclick=()=>{ closeSheet(); editTask(null); draft.notes='Follow-up from “'+t.title+'” (done '+full(t.done||Date.now())+')'; draft.from=t.id; render(); };
  sh.querySelector('.fu-undo').onclick=()=>{ t.done=null; save(); closeSheet(); render(); toast('Back on the list'); };
  const dt=sh.querySelector('.fu-det'); if(dt)dt.onclick=()=>{ closeSheet(); if(W.openDetention)W.openDetention(); };
  const gl=sh.querySelector('.fu-gaol'); if(gl)gl.onclick=()=>{ closeSheet(); if(W.openGaol)W.openGaol(); };
}

/* ================= photograph a to-do list → read it → sort it into tasks ================= */
let scan=null;   // {imgs:[jpeg data URLs], items:[{on,text,type,urgent,due}], busy, err, mode: pick|choose|key|type|triage}
const SCAN_MAX=8;   // images per read (a long scrolling screenshot is cut into readable parts, each counts)
function guessType(s){ s=' '+String(s).toLowerCase()+' ';
  if(/cctv|footage|camera/.test(s))return 'cctv';
  if(/arrest|warrant|\bbench\b|wanted|detain/.test(s))return 'arrest';
  if(/victim|needs assessment|support services|update (?:the )?(?:ip|injured)/.test(s))return 'victim';
  if(/\bfcn\b|fixed charge|\bnct\b|insurance|checkpoint|\bmat\b|collision|\brtc\b|seized (?:car|vehicle)|produc(?:e|ed) (?:docs|documents|licen)/.test(s))return 'traffic';
  if(/enquir|inquir|house[- ]to[- ]house|\bh2h\b|canvass|trace|locate|\bspsv\b|taxi licen/.test(s))return 'enquiry';
  if(/overtime|\bclaims?\b|expenses|training|course|uniform|\bkit\b|annual leave|\bpdr\b|briefing/.test(s))return 'admin';
  if(/statement|\bstmt\b|\bs\/t\b|memo of int|interview/.test(s))return 'statement';
  if(/\bcourt\b|summons|\bccj\b|remand|\bdc\b/.test(s))return 'court';
  if(/exhibit|\blab\b|\bfsi\b|property|\bseal/.test(s))return 'exhibit';
  if(/pulse|\bfile\b|incident|report/.test(s))return 'file';
  if(/e-?mail|letter|write to/.test(s))return 'email';
  if(/house|visit|call to|call at|address|door|knock/.test(s))return 'visit';
  if(/\bring\b|\bcall\b|phone|\btel\b|text back|ring back/.test(s))return 'call';
  if(/\bnights?\b/.test(s))return 'night';
  if(/time limit|6 months|six months/.test(s))return 'limit';
  return 'other'; }
const KIND_RE={
 file:[['sudden',/sudden death|coroner|deceased|\bsd\b/],['fatal',/fatal|\bfci\b|serious collision/],['missing',/missing/],['youth',/\bjlo\b|juvenile|youth|diversion/],['domestic',/domestic|barring|safety order|protection order/],['caution',/adult caution/],['dpp',/direction|\bdpp\b/],['charged',/charged|charge sheet|court file/],['traffic',/traffic|\brta\b|drink.?driv|no insurance|collision/],['disclosure',/disclosure/],['pulse',/pulse/]],
 statement:[['vis',/impact/],['sus',/suspect|memo|interview/],['med',/medical|doctor/],['own',/my statement|own statement/],['ip',/\bip\b|injured party|victim/],['wit',/witness/]],
 arrest:[['bench',/bench/],['committal',/committal/],['wanted',/wanted/],['bail',/bail/],['warrant',/warrant/]],
 enquiry:[['h2h',/house[- ]to[- ]house|\bh2h\b|door[- ]to[- ]door/],['spsv',/\bspsv\b|taxi|hackney|limousine/],['vehicle',/vehicle|\breg\b|registration|owner/],['trace',/trace|locate/],['online',/online|facebook|instagram|snapchat|social media/],['hosp',/hospital|\bmater\b|beaumont|st\.? james/],['licence',/licen[cs]e|permit|firearm/],['shop',/shop|store|business/]],
 cctv:[['canvass',/canvass/],['preserve',/preserv/],['view',/\bview|watch/],['stills',/stills?\b/],['collect',/collect|download/]],
 exhibit:[['lab',/\bfsi\b|\blab\b/],['drugs',/drugs?|cannabis|cocaine|heroin/],['digital',/phone|laptop|digital/],['return',/return/],['dispose',/dispos/]],
 traffic:[['docs',/produc|documents/],['collision',/collision|\brtc\b/],['seized',/seized|pound/],['fcn',/\bfcn\b|fixed charge/],['checkpoint',/checkpoint|\bmat\b/],['tax',/\bnct\b|\btax\b|insurance/]],
 visit:[['callback',/call ?back/],['welfare',/welfare|concern for/],['serve',/serve|summons/],['curfew',/curfew/]],
 court:[['summons',/apply.*summons|summons app/],['serve',/serve/],['warrant',/warrant/],['bail',/bail|remand/],['outcome',/outcome|result/],['date',/court/]],
 night:[['curfew',/curfew/],['pubs',/pub|licensed premises/],['premises',/premises|check (?:the )?(?:back|doors)/]],
 admin:[['claim',/claim|overtime|expenses/],['course',/course|training/],['kit',/uniform|\bkit\b|boots/],['leave',/leave|roster/],['forms',/\bforms?\b|sign/],['meeting',/meeting|briefing/]]};
function guessKind(type,s){ const L=KIND_RE[type]; if(!L)return null; s=String(s||'').toLowerCase(); for(const [k,re] of L)if(re.test(s))return k; return null; }
function guessDue(s){ s=String(s).toLowerCase(); return /\btoday\b|\btonight\b|\basap\b/.test(s)?'today':/tomorrow|\btmrw\b|\btmw\b|\btmr\b/.test(s)?'tomorrow':/this week|by fri|end of week/.test(s)?'week':'none'; }
/* ===== a pasted list → tasks =====
   Recognises the list copied from Assisting (Tasks → Share → Copy the list, any version): numbered tasks "3. [URGENT] Statement · Witness: title",
   then "Due …"/"OVERDUE since …", "When: …", "Place: …", notes, and "Steps — n of m done:" with [x]/[ ] steps (indented sub-steps, their notes,
   type, urgency, time of day and "by" dates). Anything else is read as one task per line, with "-" lines under a task becoming its steps. */
const DT_RE=/(\d{1,2}):(\d{2})\s+[A-Za-z]{3}\s+(\d{1,2})\/(\d{1,2})\/(\d{4})/;
const dtParse=x=>{ const m=DT_RE.exec(x||''); if(!m)return null; const d=new Date(+m[5],+m[4]-1,+m[3],+m[1],+m[2]); return isNaN(d)?null:d.getTime(); };
const tyByLabel=lb=>{ lb=String(lb||'').trim().toLowerCase(); const y=TYPES.find(x=>x.t.toLowerCase()===lb); return y?y.k:null; };
const kindByLabel=(type,lb)=>{ const y=TY[type]; lb=String(lb||'').trim().toLowerCase(); const k=y&&y.kinds&&y.kinds.find(z=>z.t.toLowerCase()===lb); return k?k.k:null; };
function winByLabel(x){ x=String(x||'').trim(); let days=null;
  Object.entries(DAYSET).forEach(([k,v])=>{ if(k!=='all'&&x.endsWith(' '+v)){ days=k; x=x.slice(0,-v.length-1).trim(); } });
  const w=WINS.find(y=>y.k!=='any'&&y.k!=='custom'&&x.toLowerCase().startsWith(y.t.toLowerCase()));
  if(w)return {win:w.k,wDays:days&&days!==(w.days||'all')?days:null};
  const m=/(\d{1,2}:\d{2})\s*[–-]\s*(\d{1,2}:\d{2})/.exec(x); if(m)return {win:'custom',wFrom:m[1].padStart(5,'0'),wTo:m[2].padStart(5,'0'),wDays:days};
  return null; }
function stepFrom(n){   // "Take statement (High · Statement · Business hours 09:00–17:30 Mon–Fri) — by 17:00 Fri 23/10/2026"
  let t=n.t; const by=/\s+—\s+by\s+(.+)$/.exec(t); if(by){ const d=dtParse(by[1]); if(d){ n.due=d; n.rem=[0]; } t=t.slice(0,by.index); }
  const tg=/\s+\(([^()]*)\)$/.exec(t);
  if(tg){ let used=0; tg[1].split(' · ').map(x=>x.trim()).forEach(p=>{ const lv=LV.indexOf(p); if(lv>=1){ n.pri=lv; used++; return; }
      const ty=tyByLabel(p); if(ty){ n.type=ty; used++; return; } if(p==='any time'){ used++; return; }
      if(/^going away/.test(p)){ n.avail='away'; const m=/(\d{1,2}) ([A-Z][a-z]{2})$/.exec(p); if(m){ const mi=MON.indexOf(m[2]); if(mi>=0){ const d=new Date(); let y=d.getFullYear(); const c=new Date(y,mi,+m[1],12); if(c.getTime()<Date.now()-180*DAY)y++; n.awayBy=new Date(y,mi,+m[1],12).getTime(); } } used++; return; }
      if(p==='hard to reach'){ n.avail='hard'; used++; return; } if(p==='only free at certain times'){ n.avail='lim'; used++; return; }
      const w=winByLabel(p); if(w){ Object.assign(n,w); used++; } });
    if(used)t=t.slice(0,tg.index); }
  n.t=t.trim().slice(0,200)||'Step'; }
function stepsFromBlock(lines){ const root=[], st=[{ind:-1,list:root}]; let last=null;
  lines.forEach(raw=>{ const m=/^(\s*)(.*)$/.exec(raw), ind=m[1].replace(/\t/g,'    ').length, x=m[2].trim(); if(!x)return;
    const ck=/^\[([ xX✓✔]?)\]\s*(.*)$/.exec(x);
    if(!ck){ if(last&&/^\(.*\)$/.test(x))last.n=(last.n?last.n+'\n':'')+x.slice(1,-1).replace(/ · /g,'\n'); else if(last)last.t+=' '+x; return; }
    while(st.length>1&&st[st.length-1].ind>=ind)st.pop(); while(st.length>MAXD)st.pop();
    const node={id:sid(),t:ck[2],done:/[xX✓✔]/.test(ck[1])?Date.now():null}; stepFrom(node); last=node;
    st[st.length-1].list.push(node); st.push({ind,list:(node.steps=[])}); });
  return norm(root); }
function plainJobs(txt){ return parseOutline(txt,MAXD).map(n=>{ const l=n.t, ty=guessType(l);
  return {on:true,text:l.slice(0,120),type:ty,kind:guessKind(ty,l),urgent:/urgent|asap|!!/i.test(l),due:guessDue(l),dueAt:null,steps:kids(n).length?n.steps:[]}; }).filter(x=>x.text.length>1); }
function parseJobs(txt){ txt=String(txt||'').replace(/\r/g,''); const L=txt.split('\n'), JOB=/^ {0,2}(\d{1,3})[.)]\s+(.+)$/;
  const head=r=>{ r=r.replace(/^\[URGENT\]\s*/i,''); const c=/^([^:]{2,60}):\s+(.*)$/.exec(r); return c&&tyByLabel(c[1].split(' · ')[0])?c:null; };
  const app=L.some(l=>{ const m=JOB.exec(l); return !!(m&&head(m[2].trim())); })||(/^\s*TASKS\s+—/m.test(txt)&&/^ {3}(Due|OVERDUE since|Steps —|When:)/m.test(txt));
  if(!app)return plainJobs(txt);
  const out=[]; let cur=null, inSteps=false, blk=[];
  const flush=()=>{ if(!cur)return; if(blk.length)cur.steps=stepsFromBlock(blk); cur.notes=cur.notesL.join('\n').trim(); delete cur.notesL; out.push(cur); cur=null; inSteps=false; blk=[]; };
  L.forEach(raw=>{ if(!raw.trim()||/^\s*TASKS\s+—/.test(raw))return;
    const m=JOB.exec(raw);
    if(m&&!/^ {3}/.test(raw)){ flush(); let r=m[2].trim(); const urgent=/^\[URGENT\]/i.test(r); r=r.replace(/^\[URGENT\]\s*/i,'');
      const c=head(r); let type=null, kind=null, title=r;
      if(c){ const pr=c[1].split(' · '); type=tyByLabel(pr[0]); kind=pr[1]?kindByLabel(type,pr[1]):null; title=c[2].trim()||TY[type].t; }
      else { type=guessType(r); kind=guessKind(type,r); }
      cur={on:true,text:title.slice(0,120),type,kind,urgent,due:'none',dueAt:null,place:null,notesL:[],steps:[]}; return; }
    if(!cur){ out.push(...plainJobs(raw)); return; }
    if(inSteps){ blk.push(raw.replace(/^ {3}/,'')); return; }
    const t=raw.trim(); let mm;
    if((mm=/^(OVERDUE since|Due)\s+(.*)$/.exec(t))){ const d=dtParse(mm[2]); if(d){ cur.dueAt=d; cur.due='exact'; } else cur.notesL.push(t); return; }
    if((mm=/^When:\s+(.*)$/.exec(t))){ const w=winByLabel(mm[1]); if(w)Object.assign(cur,w); return; }
    if((mm=/^Place:\s+(.*)$/.exec(t))){ const parts=mm[1].split(' · '), nm=parts[0], i=nm.indexOf(', ');
      cur.place={n:(i>0?nm.slice(0,i):nm).trim(),a:i>0?nm.slice(i+2).trim():''}; parts.slice(1).forEach(p=>{ if(/^tel /.test(p))cur.place.ph=p.slice(4).trim(); else if(/@/.test(p))cur.place.em=p.trim(); }); return; }
    if(/^Footage overwritten from/.test(t))return;
    if(/^Steps\s+—\s+\d+\s+of\s+\d+\s+done:?$/.test(t)){ inSteps=true; return; }
    cur.notesL.push(t); });
  flush(); return out; }
/* duplicates: the same (or nearly the same) title and type as a task you have — or one earlier in the same paste */
const normT=x=>String(x||'').toLowerCase().replace(/[’']/g,'').replace(/[^a-z0-9]+/g,' ').replace(/\b(the|a|an|re|for|from|to|of|at|on|in|and|with)\b/g,' ').replace(/\s+/g,' ').trim();
function simT(a,b){ const A=new Set(normT(a).split(' ').filter(w=>w.length>1)), B=new Set(normT(b).split(' ').filter(w=>w.length>1)); if(!A.size||!B.size)return 0;
  let i=0; A.forEach(w=>{ if(B.has(w))i++; }); return i/Math.max(A.size,B.size); }
const reId=n=>{ const c=Object.assign({},n,{id:sid()}); if(kids(n).length)c.steps=n.steps.map(reId); else delete c.steps; return c; };
function newSteps(dst,src){ let k=0; (src||[]).forEach(x=>{ const m=(dst||[]).find(d=>normT(d.t)===normT(x.t)); k+=m?newSteps(m.steps,x.steps):nodeCount([x]); }); return k; }
function mergeSteps(dst,src){ (src||[]).forEach(x=>{ const m=dst.find(d=>normT(d.t)===normT(x.t)); if(m){ if(kids(x).length){ if(!Array.isArray(m.steps))m.steps=[]; mergeSteps(m.steps,x.steps); } } else dst.push(reId(x)); }); return dst; }
function markDups(items){ const now=Date.now(), pool=DB.tasks.filter(t=>!t.done||now-t.done<30*DAY), seen=[];
  items.forEach(x=>{ x.dup=null; x.merge=false; let best=null, bs=0;
    const sc=(title,type)=>{ const ok=!type||!x.type||type===x.type||type==='other'||x.type==='other'; if(!ok)return 0; return normT(title)===normT(x.text)?1:simT(title,x.text); };
    pool.forEach(t=>{ const v=sc(t.title||'',t.type); if(v>bs){ bs=v; best={t}; } });
    seen.forEach(y=>{ const v=sc(y.text,y.type); if(v>bs){ bs=v; best={y}; } });
    if(best&&bs>=0.8){ x.on=false; x.dup=best.t?{id:best.t.id,title:best.t.title||tyOf(best.t).t,done:best.t.done||null,nw:newSteps(best.t.steps,x.steps)}:{batch:true,title:best.y.text,nw:0}; }
    else seen.push(x); });
  return items; }
function triInfo(x){ const out=[], y=TY[x.type]; if(x.kind&&y&&y.kinds){ const k=y.kinds.find(z=>z.k===x.kind); if(k)out.push(k.t); }
  if(x.steps&&x.steps.length){ const c=cnt(x.steps); out.push(c.m+' step'+(c.m===1?'':'s')+(c.n?' ('+c.n+' done)':'')); }
  if(x.win&&WN[x.win]&&x.win!=='any')out.push(x.win==='custom'?(x.wFrom||'')+'–'+(x.wTo||''):WN[x.win].t);
  if(x.place&&x.place.n)out.push(x.place.n); if(x.notes)out.push('notes'); return out; }
function lineItems(txt){ return String(txt||'').split(/\r?\n/).map(l=>l.replace(/^\s*(?:[-*•·▪◦›>]|\d{1,2}[.)]|\[[ xX✓]?\]|[☐□✓✔])\s*/,'').trim()).filter(l=>l.length>1)
  .map(l=>({on:true,text:l.slice(0,120),type:guessType(l),urgent:/urgent|asap|!!/i.test(l),due:guessDue(l)})); }
function startScan(){ scan={imgs:[],items:[],busy:false,err:'',mode:'pick'}; view='scan'; render(); }
/* camera = one photo now; gallery = pick several screenshots or photos at once (e.g. screenshots of your phone's notes app) */
function pickImages(camera){ const inp=D.createElement('input'); inp.type='file'; inp.accept='image/*'; inp.style.display='none';
  if(camera)inp.setAttribute('capture','environment'); else inp.multiple=true;
  D.body.appendChild(inp);
  inp.onchange=()=>{ const fs=[...(inp.files||[])]; inp.remove(); if(fs.length)addImages(fs); };
  inp.click(); setTimeout(()=>{ if(inp.isConnected&&!(inp.files&&inp.files.length))inp.remove(); },60000); }
function fileImage(file){ return new Promise((ok,no)=>{ const url=URL.createObjectURL(file), im=new Image();
  im.onload=()=>{ ok({im,url}); }; im.onerror=()=>{ URL.revokeObjectURL(url); no(new Error('bad image')); }; im.src=url; }); }
/* scale to Claude's best size (long side ≤1568 px); a tall scrolling screenshot is cut into overlapping parts so the text stays readable */
function toParts(im){ const W0=im.naturalWidth, H0=im.naturalHeight, out=[]; if(!W0||!H0)return out;
  const ratio=H0/W0, n=ratio>2.6?Math.min(6,Math.ceil(ratio/2.1)):1, ov=n>1?Math.round(W0*0.12):0, seg=Math.ceil((H0+(n-1)*ov)/n);
  for(let i=0;i<n;i++){ const y=Math.max(0,Math.min(H0-seg,i*(seg-ov))), h=Math.min(seg,H0-y), k=Math.min(1,1568/Math.max(W0,h));
    const c=D.createElement('canvas'); c.width=Math.round(W0*k); c.height=Math.round(h*k);
    const g=c.getContext('2d'); g.fillStyle='#fff'; g.fillRect(0,0,c.width,c.height); g.drawImage(im,0,y,W0,h,0,0,c.width,c.height);
    out.push(c.toDataURL('image/jpeg',.85)); }
  return out; }
async function addImages(files){ if(!scan)scan={imgs:[],items:[],busy:false,err:'',mode:'choose'};
  let bad=0, cut=false;
  for(const f of files){ if(scan.imgs.length>=SCAN_MAX){ cut=true; break; }
    try{ const {im,url}=await fileImage(f); const parts=toParts(im); URL.revokeObjectURL(url);
      for(const d of parts){ if(scan.imgs.length>=SCAN_MAX){ cut=true; break; } scan.imgs.push(d); } }catch(e){ bad++; } }
  if(!scan.imgs.length){ toast('Couldn’t open '+(files.length>1?'those images':'that image')); if(scan.mode==='pick')render(); return; }
  scan.mode='choose'; scan.err=bad?(bad+' image'+(bad===1?'':'s')+' couldn’t be opened.'):(cut?'Only the first '+SCAN_MAX+' images (or parts of a long screenshot) are used.':''); view='scan'; render(); }
async function readWithClaude(){ const key=(localStorage.getItem(AIKEY)||'').trim(); if(!key){ scan.mode='key'; render(); return; }
  if(navigator.onLine===false){ scan.err='No signal — type the list in instead, or try again when you have signal.'; render(); return; }
  scan.busy=true; scan.err=''; render();
  const n=scan.imgs.length;
  const prompt=(n>1?'These '+n+' images are':'This image is')+' a Garda’s to-do list or work notes — a photo of handwriting or print, or a screenshot from a phone (for example a notes app). '
   +(n>1?'Several images may be consecutive parts of one long screenshot or list, and they can overlap: list each task once. ':'')
   +'Transcribe each separate task or action as one item, keeping the wording close to what is written (fix obvious spelling only). In a plain list, each line is an item. '
   +'Ignore phone interface text (clock, battery, app names, buttons, menus), headings and dates that stand alone. Do not invent tasks; if part of a line is unreadable, put (?) there. '
   +'For each item give: "text" (max 120 characters), "type" — one of '+TYPES.map(x=>x.k).join(', ')+' — "urgent" (true only if it is marked urgent, starred or says ASAP), and "due" — one of "today", "tomorrow", "week", "none" (only if the list says when). '
   +'Reply with JSON only, no other text: {"items":[{"text":"...","type":"other","urgent":false,"due":"none"}]}';
  try{ const r=await fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'Content-Type':'application/json','x-api-key':key,'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'},
      body:JSON.stringify({model:'claude-sonnet-5',max_tokens:3000,messages:[{role:'user',content:[...scan.imgs.map(d=>({type:'image',source:{type:'base64',media_type:'image/jpeg',data:d.split(',')[1]}})),{type:'text',text:prompt}]}]})});
    const d=await r.json().catch(()=>({}));
    if(!r.ok||d.error){ const m=(d.error&&d.error.message)||('HTTP '+r.status); throw new Error(r.status===401?'The API key was refused — check it in AI search settings.':m); }
    const txt=(d.content||[]).filter(b=>b.type==='text').map(b=>b.text).join('\n'), a=txt.indexOf('{'), z=txt.lastIndexOf('}');
    const j=JSON.parse(txt.slice(a,z+1)), ok=TYPES.map(x=>x.k);
    const items=(j.items||[]).map(x=>({on:true,text:String(x.text||'').trim().slice(0,120),type:ok.includes(x.type)?x.type:guessType(x.text),urgent:!!x.urgent,due:['today','tomorrow','week','none'].includes(x.due)?x.due:'none'})).filter(x=>x.text);
    if(!scan)return; scan.busy=false; if(!items.length){ scan.err='Claude couldn’t find any tasks in '+(scan.imgs.length>1?'those images':'that image')+' — type them in instead.'; render(); return; }
    scan.items=items; scan.mode='triage'; render();
  }catch(e){ if(!scan)return; scan.busy=false; scan.err=(e&&e.message&&!/JSON|Unexpected/.test(e.message))?e.message:'Couldn’t read the list — try a clearer photo or screenshot, or type it in.'; render(); } }
function renderScan(){ const s=scan; if(!s){ view='list'; renderList(); return; } ov.querySelector('.tk-title').textContent=s.imgs&&s.imgs.length?'Photos → tasks':s.mode==='pick'?'Add a list of tasks':'List → tasks'; ov.querySelector('.tk-fab').hidden=true; ov.querySelector('.tk-copy').hidden=true; ov.querySelector('.tk-scan').hidden=true;
  let h='<div class="tk-wrap tk-scanv">';
  if(s.mode==='pick'){
    h+='<p class="tk-lead">Turn a to-do list into tasks.</p>'
      +'<button type="button" class="tk-pick sc-cam">'+svg(IC.camera)+'<span><b>Take a photo</b><small>Notebook page, whiteboard, a printed list</small></span></button>'
      +'<button type="button" class="tk-pick sc-gal">'+svg(IC.images)+'<span><b>Choose screenshots or photos</b><small>From your gallery — e.g. screenshots of your notes app. Pick several at once.</small></span></button>'
      +'<button type="button" class="tk-pick sec sc-type">'+svg(IC.cliplist)+'<span><b>Paste or type a list</b><small>One task per line — or paste the list copied from Assisting (keeps dates, steps and notes)</small></span></button>'
      +'<p class="tk-hint">Up to '+SCAN_MAX+' images at a time. Long scrolling screenshots are cut into parts so they stay readable.</p></div>';
    main.innerHTML=h; main.scrollTop=0;
    main.querySelector('.sc-cam').onclick=()=>pickImages(true);
    main.querySelector('.sc-gal').onclick=()=>pickImages(false);
    main.querySelector('.sc-type').onclick=()=>{ s.mode='type'; s.err=''; render(); setTimeout(()=>{ const t=main.querySelector('.f-lines'); if(t)t.focus(); },50); };
    return;
  }
  const canEdit=s.mode==='choose'&&!s.busy;
  if(s.imgs.length)h+='<div class="tk-shots">'+s.imgs.map((d,i)=>'<div class="tk-th"><img src="'+d+'" alt="Image '+(i+1)+' — tap to enlarge" data-i="'+i+'">'+(canEdit?'<button type="button" class="tk-thx" data-i="'+i+'" aria-label="Remove image '+(i+1)+'">'+svg(IC.x)+'</button>':'')+'</div>').join('')
    +(s.imgs.length<SCAN_MAX&&canEdit?'<button type="button" class="tk-th add sc-addimg" aria-label="Add more images">'+svg(IC.plus)+'<small>Add</small></button>':'')+'</div>';
  if(s.err)h+='<p class="tk-err">'+esc(s.err)+'</p>';
  if(s.mode==='choose'||s.mode==='key'){
    if(s.busy)h+='<div class="tk-busy"><i></i>Reading your list…</div>';
    else if(s.mode==='key')h+='<label class="tk-lab">Your Anthropic API key</label><input class="tk-in f-key" type="password" autocomplete="off" placeholder="sk-ant-…"><p class="tk-hint">Stored only on this phone (the same key as AI search). Each photo costs about a cent.</p><div class="tk-row2"><button type="button" class="tk-sec-btn sc-back">Back</button><button type="button" class="tk-go sc-savekey">Save and read</button></div>';
    else h+='<div class="tk-row2 col"><button type="button" class="tk-go sc-ai">✦ Read '+(s.imgs.length>1?'them':'it')+' with Claude</button><button type="button" class="tk-sec-btn sc-type">Type it in myself</button></div>'
      +'<p class="tk-hint"><b>Read with Claude</b> sends '+(s.imgs.length>1?'these '+s.imgs.length+' images':'this image')+' to Anthropic’s Claude service with your API key to read the writing — handwriting and screenshots included. Only do that if Garda policy allows it for what’s on the list: <b>if it has personal details of members of the public, type it in instead</b>. The images aren’t kept on the phone either way.</p>';
  } else if(s.mode==='type'){
    h+='<label class="tk-lab">One task per line — or paste a list copied from Assisting</label>'
      +(navigator.clipboard&&navigator.clipboard.readText?'<button type="button" class="tk-link sc-paste">'+svg(IC.cliplist)+'Paste from the clipboard</button>':'')
      +'<textarea class="tk-in tk-ta big f-lines" placeholder="e.g.\nCCTV Centra Dorset St\nRing IP back re statement\n- statement\n- medical report\nCourt Thurs 10:30">'+esc(s.lines||'')+'</textarea>'
      +'<p class="tk-hint">From an older copy of the app: Tasks → Share → Copy the list, then paste it here — dates, times of day, places, notes and steps (ticked or not) come across. Lines starting “-” under a task become its steps. Jobs you already have are spotted and left out.</p>'
      +'<div class="tk-row2"><button type="button" class="tk-sec-btn sc-back">Back</button><button type="button" class="tk-go sc-split">Sort into tasks</button></div>';
  } else {
    const n=s.items.filter(x=>x.on&&x.text.trim()).length;
    const nd=s.items.filter(x=>x.dup).length, nowT=Date.now();
    h+='<label class="tk-lab">Check each one — untick anything that isn’t a task</label>'
      +(nd?'<p class="tk-dupnote">'+svg(IC.flag)+'<span><b>'+nd+' look'+(nd===1?'s':'')+' like '+(nd===1?'a job':'jobs')+' you already have</b> — left unticked. Tick one to add it anyway'+(s.items.some(x=>x.dup&&x.dup.nw)?', or add its new steps to the job you have':'')+'.</span></p>':'')
      +'<div class="tk-tri">'+s.items.map((x,i)=>'<div class="tk-tr'+(x.on?'':' off')+(x.dup?' dup':'')+'" data-i="'+i+'">'
      +'<button type="button" class="tk-tron" aria-label="Include">'+svg(IC.check)+'</button><div class="tk-trb"><input class="tk-in tr-t" maxlength="120" value="'+esc(x.text)+'">'
      +'<div class="tk-trm"><select class="tk-in tr-y">'+TYPES.map(y=>'<option value="'+y.k+'"'+(y.k===x.type?' selected':'')+'>'+esc(y.t)+'</option>').join('')+'</select>'
      +'<select class="tk-in tr-d">'+(x.dueAt?[['exact',(x.dueAt<Date.now()?'Overdue · ':'Due ')+full(x.dueAt)]]:[]).concat([['none','No deadline'],['today','Today'],['tomorrow','Tomorrow'],['week','This week']]).map(([v,l])=>'<option value="'+v+'"'+(v===x.due?' selected':'')+'>'+esc(l)+'</option>').join('')+'</select>'
      +'<button type="button" class="tk-tru'+(x.urgent?' on':'')+'" aria-label="Urgent">'+svg(IC.flag)+'</button></div>'
      +((info=>info.length?'<small class="tr-info">'+esc(info.join(' · '))+'</small>':'')(triInfo(x)))
      +(x.dup?'<div class="tr-dup">'+svg(IC.flag)+'<span>'+(x.dup.batch?'Twice in this list: “'+esc(x.dup.title.slice(0,60))+'”':(x.dup.done?'Already done '+esc(rel(x.dup.done,nowT))+': ':'Already in your list: ')+'“'+esc(String(x.dup.title).slice(0,60))+'”')+'</span></div>'
        +(x.dup.nw?'<button type="button" class="tr-mg'+(x.merge?' on':'')+'" aria-pressed="'+!!x.merge+'">'+svg(IC.sub)+'Add its '+x.dup.nw+' new step'+(x.dup.nw===1?'':'s')+' to that job</button>':''):'')
      +'</div></div>').join('')+'</div>'
      +'<button type="button" class="tk-link sc-more">'+svg(IC.plus)+'Add a line</button>'
      +'<div class="tk-row2"><button type="button" class="tk-sec-btn sc-back">Cancel</button><button type="button" class="tk-go sc-add"'+(n?'':' disabled')+'>Add '+n+' task'+(n===1?'':'s')+'</button></div>';
  }
  h+='</div>'; main.innerHTML=h; main.scrollTop=0;
  const q=c=>main.querySelector(c);
  if(q('.sc-ai'))q('.sc-ai').onclick=()=>readWithClaude();
  if(q('.sc-type'))q('.sc-type').onclick=()=>{ s.mode='type'; s.err=''; render(); setTimeout(()=>{ const t=q('.f-lines'); if(t)t.focus(); },50); };
  if(q('.sc-savekey'))q('.sc-savekey').onclick=()=>{ const k=q('.f-key').value.trim(); if(!/^sk-ant-/.test(k)){ s.err='That doesn’t look like an Anthropic key (it starts sk-ant-).'; render(); return; } localStorage.setItem(AIKEY,k); s.mode='choose'; s.err=''; readWithClaude(); };
  main.querySelectorAll('.sc-back').forEach(b=>b.onclick=()=>{ if(s.mode==='triage'||s.mode==='choose'){ scan=null; view='list'; render(); } else { s.mode=s.imgs.length?'choose':'pick'; s.err=''; render(); } });
  main.querySelectorAll('.tk-thx').forEach(b=>b.onclick=()=>{ s.imgs.splice(+b.dataset.i,1); s.err=''; if(!s.imgs.length)s.mode='pick'; render(); });
  if(q('.sc-addimg'))q('.sc-addimg').onclick=()=>pickImages(false);
  main.querySelectorAll('.tk-th img').forEach(im=>im.onclick=()=>{ const v=D.createElement('div'); v.className='tk-big'; v.innerHTML='<img src="'+im.src+'" alt=""><small>Tap to close</small>'; v.onclick=()=>v.remove(); ov.appendChild(v); });
  if(q('.sc-split'))q('.sc-split').onclick=()=>{ s.lines=q('.f-lines').value; const it=parseJobs(s.lines); if(!it.length){ s.err='Type at least one task — one per line.'; render(); return; } s.items=markDups(it); s.mode='triage'; s.err=''; render(); };
  if(q('.sc-paste'))q('.sc-paste').onclick=async()=>{ try{ const t=await navigator.clipboard.readText(); if(!t||!t.trim()){ toast('Nothing to paste — copy the list first'); return; } const ta=q('.f-lines'); ta.value=(ta.value.trim()?ta.value.replace(/\s*$/,'\n'):'')+t; s.lines=ta.value; ta.focus(); }catch(e){ toast('Press and hold in the box, then Paste'); } };
  if(s.mode==='triage'){
    const sync=()=>{ const n=s.items.filter(x=>x.on&&x.text.trim()).length, g=s.items.filter(x=>!x.on&&x.merge&&x.dup&&x.dup.id).length, b=q('.sc-add'); b.disabled=!n&&!g;
      b.textContent=(n||!g?'Add '+n+' task'+(n===1?'':'s'):'')+(g?(n?' · ':'')+'update '+g:''); };
    sync();
    main.querySelectorAll('.tk-tr').forEach(r=>{ const x=s.items[+r.dataset.i];
      r.querySelector('.tk-tron').onclick=()=>{ x.on=!x.on; r.classList.toggle('off',!x.on); sync(); };
      r.querySelector('.tr-t').oninput=e=>{ x.text=e.target.value; sync(); };
      r.querySelector('.tr-y').onchange=e=>{ x.type=e.target.value; x.kind=null; };
      const mg=r.querySelector('.tr-mg'); if(mg)mg.onclick=()=>{ x.merge=!x.merge; mg.classList.toggle('on',x.merge); mg.setAttribute('aria-pressed',x.merge); sync(); };
      r.querySelector('.tr-d').onchange=e=>{ x.due=e.target.value; };
      r.querySelector('.tk-tru').onclick=e=>{ x.urgent=!x.urgent; e.currentTarget.classList.toggle('on',x.urgent); }; });
    q('.sc-more').onclick=()=>{ s.items.push({on:true,text:'',type:'other',urgent:false,due:'none'}); render(); const all=main.querySelectorAll('.tr-t'); if(all.length){ all[all.length-1].focus(); } };
    q('.sc-add').onclick=()=>{ const now=Date.now(), L=s.items.filter(x=>x.on&&x.text.trim()), G=s.items.filter(x=>!x.on&&x.merge&&x.dup&&x.dup.id), skip=s.items.filter(x=>x.dup&&!x.on&&!x.merge).length;
      L.forEach((x,i)=>{ const ty=TY[x.type]||TY.other, due=x.due==='exact'&&x.dueAt?x.dueAt:x.due==='today'?quick('t23'):x.due==='tomorrow'?quick('+1d'):x.due==='week'?quick('+7d'):null;
        const t={id:uid(),type:x.type,kind:x.kind!=null?x.kind:guessKind(x.type,x.text),steps:norm((x.steps||[]).map(reId)),title:x.text.trim().slice(0,120),notes:x.notes||'',urgent:!!x.urgent,
          win:x.win||ty.win||'any',wDays:x.wDays||null,due,rem:due?[0,60]:[],remWin:false,place:x.place||null,created:now+i,m:now,done:null,fired:{}};
        if(x.win==='custom'){ t.wFrom=x.wFrom; t.wTo=x.wTo; } DB.tasks.push(t); });
      G.forEach(x=>{ const t=byId(x.dup.id); if(!t)return; if(!Array.isArray(t.steps))t.steps=[]; mergeSteps(t.steps,x.steps); norm(t.steps); t.m=now; });
      scan=null; save(); view='list'; tab='all'; render(); check();
      toast([L.length?L.length+' task'+(L.length===1?'':'s')+' added':'',G.length?'new steps added to '+G.length+' job'+(G.length===1?'':'s'):'',skip?skip+' duplicate'+(skip===1?'':'s')+' left out':''].filter(Boolean).join(' · ')||'Nothing added'); };
  }
}

/* ================= share the list (handover): copy · email to me · share · calendar file ================= */
function listText(l,now){ const lines=['TASKS — '+full(now),''];
  l.forEach((t,i)=>{ const s=taskText(t,now).split('\n'); lines.push((i+1)+'. '+s[0]); s.slice(1).forEach(x=>lines.push(x)); });
  return lines.join('\n'); }
function copyList(){
  const now=Date.now(), l=open_().sort((a,b)=>cmp(sortKey(a,now),sortKey(b,now)));
  if(!l.length){toast('No open tasks to share');return;}
  const txt=listText(l,now), nd=l.filter(t=>t.due||nextStepDue(t)).length;
  sh.innerHTML='<div class="tk-grip"></div><h3>Share the list</h3><p class="tk-note">'+l.length+' open task'+(l.length===1?'':'s')+'. Keep details of members of the public out of personal email and apps.</p>'
   +'<button type="button" class="tk-pick ls-copy">'+svg(IC.copy)+'<span><b>Copy the list</b><small>Paste it into a message or your notes</small></span></button>'
   +'<button type="button" class="tk-pick ls-mail">'+svg(IC.email)+'<span><b>Email it to me</b><small>'+(prefs().me?esc(prefs().me):'Set your email address the first time')+'</small></span></button>'
   +(navigator.share?'<button type="button" class="tk-pick ls-share">'+svg(IC.share)+'<span><b>Share…</b><small>Another app on this phone</small></span></button>':'')
   +(W.GRDocs?'<button type="button" class="tk-pick ls-xl">'+svg(IC.db)+'<span><b>Excel spreadsheet</b><small>Every job and sub job — category, urgency, dates and time of day. Email it to yourself to see it at work</small></span></button>':'')
   +'<button type="button" class="tk-pick ls-cal"'+(nd?'':' disabled')+'>'+svg(IC.cal)+'<span><b>Calendar file</b><small>'+(nd?nd+' deadline'+(nd===1?'':'s')+' with reminders — open the file to add them to your calendar':'No tasks with a deadline yet')+'</small></span></button>'
   +'<button type="button" class="tk-sec-btn wide tk-x">Close</button>';
  sh.hidden=false; ov.querySelector('.tk-shade').hidden=false;
  sh.querySelector('.tk-x').onclick=()=>closeSheet();
  sh.querySelector('.ls-copy').onclick=()=>{ (navigator.clipboard&&navigator.clipboard.writeText?navigator.clipboard.writeText(txt):Promise.reject()).then(()=>{ closeSheet(); toast('List copied — paste it into a message or your notes'); }).catch(()=>{
    sh.innerHTML='<div class="tk-grip"></div><h3>Your tasks</h3><textarea class="tk-in tk-ta big" readonly>'+esc(txt)+'</textarea><button type="button" class="tk-sec-btn wide tk-x">Close</button>'; sh.querySelector('.tk-x').onclick=()=>closeSheet(); }); };
  sh.querySelector('.ls-mail').onclick=()=>{ const go=()=>{ closeSheet(); mailTo('Tasks — '+full(now),txt+'\n\n— sent from Assisting'); }; if(!prefs().me)askEmail(go); else go(); };
  const s2=sh.querySelector('.ls-share'); if(s2)s2.onclick=async()=>{ try{ await navigator.share({title:'Tasks',text:txt}); closeSheet(); }catch(e){} };
  sh.querySelector('.ls-cal').onclick=()=>{ if(!nd)return; closeSheet(); saveIcs(l,'tasks-'+dtVal(now).d+'.ics'); };
  const xl=sh.querySelector('.ls-xl'); if(xl)xl.onclick=()=>xlSheet();
}

/* ================= Excel: every job and sub job, to email to yourself ================= */
function jobsXlsx(){ const now=Date.now(), opn=open_().sort((a,b)=>cmp(sortKey(a,now),sortKey(b,now))), dn=DB.tasks.filter(t=>t.done).sort((a,b)=>b.done-a.done);
  const dt=ms=>ms?{v:ms,f:'dt'}:'', winTxt=w=>w?w.label.trim()+(w.days!=='all'?' '+DAYSET[w.days]:''):'Any time';
  const avTxt=n=>n.avail==='away'?'Going away'+(n.awayBy?' '+day(n.awayBy):''):n.avail==='hard'?'Hard to reach':n.avail==='lim'?'Only free at certain times':n.avail==='easy'?'Easy to get':'';
  const stage=t=>{ const c=caseOf(t); return c.st&&STG[c.st]?STG[c.st].t+(c.st==='charged'&&c.court?' · court '+day(c.court):'')+((c.st==='summons'||c.st==='traffic')&&c.off?' · apply by '+day(limitEnd(c.off,6)):'')+(c.intv==='no'?' · not interviewed':''):''; };
  const jobs=opn.map(t=>{ const c=classify(t,now), u=c.ug, k=kindOf(t), sc=cnt(t.steps), nx=nextPick(t,c);
    return [(u?LV[u.lv]:'Normal')+(t.urgent?' · URGENT':''),tyOf(t).t,k?k.t:'',t.title||'',dt(t.due),u&&u.dl?dt(u.dl):'',u?u.own.why.join('; '):'',winTxt(winOf(t)),stage(t),sc.m?sc.n+' of '+sc.m:'',nx?nx.n.t:'',
      t.place&&t.place.n?t.place.n+(t.place.a?', '+t.place.a:''):'',t.notes||'',dt(t.created)]; });
  const subs=[]; opn.forEach(t=>{ const M=stepUrgs(t,now);
    walk(t.steps,(n,d)=>{ const done=isDone(n), u=M.get(n.id), w=n.win?winOf(n):upWin(t,n.id).w;
      subs.push([t.title||tyOf(t).t,tyOf(t).t,'   '.repeat(d-1)+n.t,d,n.type&&TY[n.type]?TY[n.type].t:'',done?'Done':LV[u?Math.max(u.lv,u.mx||0):2]+(n.pri?' (set by you)':''),
        dt(n.due),!done&&u&&u.dl?dt(u.dl):'',!done&&u?u.why.join('; '):'',winTxt(w),avTxt(n),n.n||'',done?dt(n.done):'']); }); });
  const cats=TYPES.map(y=>{ const J=opn.filter(t=>t.type===y.k), S=subJobs(opn,y.k,now), lv=J.map(t=>{ const u=classify(t,now).ug; return u?u.lv:2; }).concat(S.map(x=>x.lv));
    const od=J.filter(t=>{ const c=classify(t,now); return c.od||c.sdo; }).length+S.filter(x=>x.dl!=null&&x.dl<now).length;
    return [y.t,J.length,S.length,lv.filter(v=>v===4).length,lv.filter(v=>v===3).length,od]; }).filter(r=>r[1]||r[2]);
  const sheets=[
    {name:'Jobs',filter:1,cols:[16,16,20,40,17,17,44,30,30,10,40,30,40,17],head:['Urgency','Category','Kind','Job','Due','Earliest deadline','Why','When it can be done','Case stage','Steps done','Next step','Place','Notes','Added'],rows:jobs},
    {name:'Sub jobs',filter:1,cols:[34,16,46,7,16,18,17,17,44,30,22,36,17],head:['Job','Job category','Sub job','Level','Category','Urgency','Do it by','Earliest deadline','Why','When it can be done','Availability','Note','Done'],rows:subs},
    {name:'By category',cols:[22,10,12,10,10,10],head:['Category','Jobs','Sub jobs','Critical','High','Overdue'],rows:cats},
    {name:'Done (30 days)',filter:1,cols:[16,44,17,17],head:['Category','Job','Done','Added'],rows:dn.map(t=>[tyOf(t).t,t.title||'',dt(t.done),dt(t.created)])},
    {name:'About',cols:[16,90],rows:[['Made',dt(now)],['From','Assisting — Tasks'],['Jobs',opn.length+' open · '+dn.length+' done in the last 30 days'],['Note','Keep details of members of the public to the minimum — this isn’t your official notebook. Urgency is worked out from deadlines, court dates, time limits and the case, unless you set it yourself.']]}];
  return {blob:W.GRDocs.xlsx(sheets,'Jobs'),name:'jobs-'+dtVal(now).d+'.xlsx'}; }
function xlSheet(){ let f=null; try{ f=jobsXlsx(); }catch(e){ toast('Couldn’t make the spreadsheet on this phone'); return; }
  const can=W.GRDocs.canShare(f.blob,f.name);
  sh.innerHTML='<div class="tk-grip"></div><h3>Excel spreadsheet</h3><p class="tk-note">'+esc(f.name)+' — sheets: Jobs, Sub jobs, By category, Done. Keep details of members of the public out of personal email.</p>'
   +(can?'<button type="button" class="tk-pick xs-share">'+svg(IC.share)+'<span><b>Email it / share it</b><small>Pick your email app and send it to yourself — or Drive, WhatsApp…</small></span></button>':'')
   +'<button type="button" class="tk-pick xs-save">'+svg(IC.download)+'<span><b>Save to this phone</b><small>Then attach it to an email from your Downloads</small></span></button>'
   +'<button type="button" class="tk-sec-btn wide tk-x">Close</button>';
  sh.hidden=false; ov.querySelector('.tk-shade').hidden=false;
  sh.querySelector('.tk-x').onclick=()=>closeSheet();
  sh.querySelector('.xs-save').onclick=()=>{ W.GRDocs.save(f.blob,f.name); closeSheet(); toast('Saved '+esc(f.name)); };
  const sb=sh.querySelector('.xs-share'); if(sb)sb.onclick=async()=>{ try{ const ok=await W.GRDocs.share(f.blob,f.name,'Jobs'); if(ok)closeSheet(); }catch(e){ toast('Couldn’t share it — save it instead'); } }; }

/* ================= home-screen strip ================= */
let strips=[];
function mountStrip(el){ if(!el)return; strips=strips.filter(x=>x.isConnected); if(!strips.includes(el))strips.push(el); paintStrip(el); }
function paintStrips(){ strips=strips.filter(x=>x.isConnected); strips.forEach(paintStrip); }
const STRIP_MAX=8;
const shortTour=(t,now)=>planned(t)&&t.due>now?(now>=t.tour.ts?'this tour':String(t.tour.label).split(' ')[0].slice(0,5)+' '+DAYS[new Date(t.tour.ts).getDay()]):'';   // rows on Home — a list you can take in at a glance
function shortDue(t,c,now){
  const st=shortTour(t,now); if(st)return st;
  const due=c.sd&&(!t.due||c.sd<t.due)?c.sd:t.due, od=due&&due<now;
  if(due){ if(od)return 'overdue '+durStr(now-due).split(' ').slice(0,2).join(' ');
    const dd=Math.round((sod(due)-sod(now))/DAY); return dd===0?hm(due):dd===1?'tmrw '+hm(due):dd<7?day(due).split(' ')[0]+' '+hm(due):day(due); }
  if(c.ws.any)return ''; return c.ws.open?'now':'opens '+(c.ws.next?hm(c.ws.next):''); }
function paintStrip(el){
  const now=Date.now(), l=open_(); if(!l.length){ if(el.innerHTML)el.innerHTML=''; el._h=''; return; }
  const od=l.filter(t=>t.due&&t.due<now).length, urg=l.filter(t=>t.urgent).length;
  const top=l.slice().sort((a,b)=>cmp(sortKey(a,now),sortKey(b,now))).slice(0,STRIP_MAX);
  const h='<div class="tk-strip tk-compact"><button type="button" class="tks-h" data-open="1">'+svg(IC.other)+'<b>Tasks</b><span>'+l.length+' open'+(od?' · <i>'+od+' overdue</i>':'')+(urg?' · '+urg+' urgent':'')+'</span><em>Open ›</em></button><div class="tks-list">'
   +top.map(t=>{ const c=classify(t,now), d=shortDue(t,c,now);
      return '<div class="tks-r'+(t.urgent?' urg':'')+((c.od||c.sdo)?' od':'')+'"><button type="button" class="tks-ck" data-ck="'+t.id+'" aria-label="Mark done">'+svg(IC.check)+'</button>'
       +'<button type="button" class="tks-b" data-id="'+t.id+'"><span class="tks-y ty-'+tyOf(t).k+'">'+svg(icOf(t))+'</span><span class="tks-t">'+esc(t.title||(TY[t.type]||TY.other).t)+'</span>'
       +(t.urgent?'<span class="tks-u" aria-label="Urgent">'+svg(IC.flag)+'</span>':'')+(t.steps&&t.steps.length?(s=>'<span class="tks-n">'+s.n+'/'+s.m+'</span>')(cnt(t.steps)):'')+(d?'<span class="tks-d'+((c.od||c.sdo)?' od':(c.today||c.sdt)?' td':'')+'">'+esc(d)+'</span>':'')+'</button></div>'; }).join('')
   +'</div>'+(l.length>STRIP_MAX?'<button type="button" class="tks-more" data-open="1">View all '+l.length+' tasks ›</button>':'')+'</div>';
  if(el._h===h)return; el._h=h; el.innerHTML=h;
  el.querySelectorAll('[data-open]').forEach(b=>b.onclick=()=>openTasks());
  el.querySelectorAll('.tks-b').forEach(b=>b.onclick=()=>openTasks(b.dataset.id));
  el.querySelectorAll('.tks-ck').forEach(b=>b.onclick=()=>{ const t=byId(b.dataset.ck); if(!t)return; t.done=Date.now(); save(); vib(30); closeTag('gr-task-'+t.id); openTasks(); followSheet(t); });
}

/* ================= ticker / lifecycle ================= */
let lastChk=0;
setInterval(()=>{ const now=Date.now(); if(now-lastChk>=30000){lastChk=now;check();} paintStrips();
  if(ov&&!ov.hidden&&view==='list'&&sh.hidden&&!main.contains(D.activeElement)&&now-(ov._r||0)>60000){ov._r=now;const st=main.scrollTop;renderList();main.scrollTop=st;} },5000);
D.addEventListener('visibilitychange',()=>{ if(D.visibilityState==='visible'){ purge(); check(); paintStrips(); } });
if('serviceWorker' in navigator){ navigator.serviceWorker.addEventListener('message',e=>{const m=e.data||{}; if(m.gr==='notif'&&m.data&&m.data.open==='task')openTasks(m.data.id);}); }
(function(){ try{ const q=new URLSearchParams((window.__entry||location).search); if(q.get('open')==='task'){ const id=q.get('id'); history.replaceState(history.state,'',location.pathname);
  const go=()=>openTasks(id); if(D.readyState==='loading')D.addEventListener('DOMContentLoaded',()=>setTimeout(go,60)); else setTimeout(go,60); } }catch(e){} })();
setTimeout(check,1500);

/* ================= for My roster: tasks on a day, and a new task planned for a day ================= */
function forDay(d){ const a=d0(d.getTime?d.getTime():d), s=a.getTime(), e=new Date(a.getFullYear(),a.getMonth(),a.getDate()+1).getTime();
  const L=open_().filter(t=>planned(t)?(t.tour.ts>=s&&t.tour.ts<e):(t.due&&t.due>=s&&t.due<e))
    .map(t=>({id:t.id,title:t.title||tyOf(t).t,label:tyLabel(t),urgent:!!t.urgent,due:t.due,tour:planned(t),ic:icOf(t),ty:tyOf(t).k}));
  open_().forEach(t=>walk(t.steps,n=>{ if(n.due&&!isDone(n)&&n.due>=s&&n.due<e)L.push({id:t.id,title:n.t,label:'Step · '+(t.title||tyLabel(t)),urgent:!!t.urgent,due:n.due,tour:false,ic:IC.sub,ty:tyOf(t).k,step:true}); }));
  return L.sort((x,y)=>((x.urgent?0:1)-(y.urgent?0:1))||((x.due||9e15)-(y.due||9e15))); }
function newOn(d){ openTasks(); editTask(null); const now=Date.now(), sp=tourOf(dayInf(d0(d.getTime?d.getTime():d)));
  if(sp&&sp.e>now){ draft.tour={s:sp.s,e:sp.e,ts:sp.s,te:sp.e,label:sp.label,code:sp.code}; draft.due=sp.e; draft.rem=(sp.s>now+MIN?[Math.round((sp.e-sp.s)/MIN)]:[]).concat([60]); }
  else { const x=d0(d.getTime?d.getTime():d); x.setHours(17,0,0,0); if(x.getTime()>now)draft.due=x.getTime(); }
  render(); return true; }

/* sync (sync.js): take in the merged list from your other devices. Reminders that already went off there aren't replayed here. */
function adopt(T){ const byOld=new Map(DB.tasks.map(t=>[t.id,t])), now=Date.now();
  const tasks=(T&&T.tasks||[]).map(t=>{ const o=byOld.get(t.id), x=Object.assign({},t,{fired:o?(o.fired||{}):{},nextWin:o?(o.nextWin||null):null});
    if(!o||(x.m||0)>(o.m||0)){ dueTimes(x).concat(stepDues(x)).forEach(([k,at])=>{ if(at<=now&&!x.fired[k])x.fired[k]=now; });
      walk(x.steps,n=>{ if(!n.remWin||!n.win)return; const w=winOf(n); if(w&&inWin(w,now))x.fired['w:'+n.id+':'+curOpen(w,now)]=now; }); }
    return x; });
  DB={v:1,tasks,del:(T&&T.del)||{}}; purge(); persist(); paintStrips();
  if(ov&&!ov.hidden&&view==='list')render(); }

/* for Home's "today" card: counts at a glance */
function summary(now){ now=now||Date.now(); const l=open_(), tr=tours(now,1)[0]||null;
  return {open:l.length,overdue:l.filter(t=>{ const c=classify(t,now); return c.od||c.sdo; }).length,urgent:l.filter(t=>t.urgent).length,tourN:tr?tourTasks(tr).length:0,tourOn:!!(tr&&tr.s<=now)}; }

W.openTasks=openTasks; W.closeTasks=closeTasks; W.tskBack=back;
W.GRTasks=Object.freeze({open:openTasks,days:openDays,_xlsx:()=>jobsXlsx(),newOn,forDay,mountStrip,check,summary,adopt,_db:()=>DB,_lib:{inWin,nextOpen,winOf,limitEnd,addMonths,cctvOverwrite,tours,nextChance,icsText,guessKind,stepsFor,parseOutline,parseJobs,markDups,mergeSteps,subJobs,norm,cnt,isDone,nextStepDue,stepLines,taskText,firstOpen,taskWin,openLeaves,upWin,curOpen,stepTags,classify,urgOf,stepUrgs,taskUrg,caseOf,nextPick,plan4,block,planUnits,modeOfText,winIn,impWin}});
})();
