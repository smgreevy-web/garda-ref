/* Assisting — real Word (.docx) and Excel (.xlsx) files, made on the phone with no library and no network.
   A small ZIP writer plus the XML that Word, Excel, Google Docs/Sheets, Samsung and LibreOffice expect.
   Documents use one house style: the title, then the text exactly as written in a ruled box (Courier, like a typed form). */
(function(){
'use strict';
const W=window, D=document;

/* ---------- ZIP (stored entries, CRC-32, UTF-8 names) ---------- */
const CRC=(()=>{ const t=new Uint32Array(256); for(let n=0;n<256;n++){ let c=n; for(let k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1; t[n]=c>>>0; } return t; })();
function crc32(u8){ let c=0xFFFFFFFF; for(let i=0;i<u8.length;i++)c=CRC[(c^u8[i])&255]^(c>>>8); return (c^0xFFFFFFFF)>>>0; }
const ENC=new TextEncoder();
function dos(d){ return {time:(d.getHours()<<11)|(d.getMinutes()<<5)|(Math.floor(d.getSeconds()/2)), date:((Math.max(1980,d.getFullYear())-1980)<<9)|((d.getMonth()+1)<<5)|d.getDate()}; }
function zip(files){                       // files: [{name, data: string | Uint8Array}] → Uint8Array
  const out=[], cen=[], t=dos(new Date()); let off=0;
  for(const f of files){
    const nm=ENC.encode(f.name), data=typeof f.data==='string'?ENC.encode(f.data):f.data, crc=crc32(data);
    const lh=new DataView(new ArrayBuffer(30));
    lh.setUint32(0,0x04034b50,true); lh.setUint16(4,20,true); lh.setUint16(6,0x0800,true); lh.setUint16(8,0,true);
    lh.setUint16(10,t.time,true); lh.setUint16(12,t.date,true); lh.setUint32(14,crc,true); lh.setUint32(18,data.length,true); lh.setUint32(22,data.length,true);
    lh.setUint16(26,nm.length,true); lh.setUint16(28,0,true);
    out.push(new Uint8Array(lh.buffer),nm,data);
    const ch=new DataView(new ArrayBuffer(46));
    ch.setUint32(0,0x02014b50,true); ch.setUint16(4,20,true); ch.setUint16(6,20,true); ch.setUint16(8,0x0800,true); ch.setUint16(10,0,true);
    ch.setUint16(12,t.time,true); ch.setUint16(14,t.date,true); ch.setUint32(16,crc,true); ch.setUint32(20,data.length,true); ch.setUint32(24,data.length,true);
    ch.setUint16(28,nm.length,true); ch.setUint16(30,0,true); ch.setUint16(32,0,true); ch.setUint16(34,0,true); ch.setUint16(36,0,true); ch.setUint32(38,0,true); ch.setUint32(42,off,true);
    cen.push(new Uint8Array(ch.buffer),nm);
    off+=30+nm.length+data.length;
  }
  const cs=cen.reduce((a,b)=>a+b.length,0), ed=new DataView(new ArrayBuffer(22));
  ed.setUint32(0,0x06054b50,true); ed.setUint16(8,files.length,true); ed.setUint16(10,files.length,true); ed.setUint32(12,cs,true); ed.setUint32(16,off,true);
  const all=[...out,...cen,new Uint8Array(ed.buffer)], n=all.reduce((a,b)=>a+b.length,0), u=new Uint8Array(n); let p=0;
  for(const a of all){ u.set(a,p); p+=a.length; }
  return u;
}

/* ---------- XML helpers ---------- */
const BAD=/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g;
const x=s=>String(s==null?'':s).replace(BAD,'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const HEAD='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
const NS_W='http://schemas.openxmlformats.org/wordprocessingml/2006/main', NS_R='http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const NS_PR='http://schemas.openxmlformats.org/package/2006/relationships';
function iso(d){ return new Date(d||Date.now()).toISOString().replace(/\.\d+Z$/,'Z'); }
function core(title){ return HEAD+'<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">'
  +'<dc:title>'+x(title)+'</dc:title><dc:creator>Assisting</dc:creator><cp:lastModifiedBy>Assisting</cp:lastModifiedBy>'
  +'<dcterms:created xsi:type="dcterms:W3CDTF">'+iso()+'</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">'+iso()+'</dcterms:modified></cp:coreProperties>'; }
function app(){ return HEAD+'<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Application>Assisting</Application></Properties>'; }

/* ---------- Word ---------- */
// blocks: {h:'Heading'} · {p:'text', b, i, sz (pt), color, mono} · {box:'text kept line for line'} · {table:{cols:[twips…], head:[…], rows:[[…]]}} · {note:'small grey text'} · {gap:1}
const PAGE_W=11906, PAGE_H=16838, MARGIN=1134, TEXT_W=PAGE_W-2*MARGIN;
function run(t,o){ o=o||{}; const f=o.mono?'Courier New':(o.font||'Calibri');
  return '<w:r><w:rPr><w:rFonts w:ascii="'+f+'" w:hAnsi="'+f+'" w:cs="'+f+'" w:eastAsia="'+f+'"/>'+(o.b?'<w:b/><w:bCs/>':'')+(o.i?'<w:i/><w:iCs/>':'')
    +(o.color?'<w:color w:val="'+o.color+'"/>':'')+'<w:sz w:val="'+Math.round((o.sz||11)*2)+'"/><w:szCs w:val="'+Math.round((o.sz||11)*2)+'"/></w:rPr>'
    +'<w:t xml:space="preserve">'+x(t)+'</w:t></w:r>'; }
function para(t,o){ o=o||{};
  const sp='<w:spacing w:before="'+(o.before||0)+'" w:after="'+(o.after==null?120:o.after)+'" w:line="'+(o.line||252)+'" w:lineRule="auto"/>';
  const ppr='<w:pPr>'+(o.keep?'<w:keepNext/>':'')+sp+(o.align?'<w:jc w:val="'+o.align+'"/>':'')+(o.border?'<w:pBdr><w:bottom w:val="single" w:sz="6" w:space="2" w:color="999999"/></w:pBdr>':'')+'</w:pPr>';
  return '<w:p>'+ppr+(t===''||t==null?'':run(t,o))+'</w:p>'; }
function borders(sz,color,inner){ const b=s=>'<w:'+s+' w:val="single" w:sz="'+sz+'" w:space="0" w:color="'+color+'"/>';
  return '<w:tblBorders>'+b('top')+b('left')+b('bottom')+b('right')+(inner?b('insideH')+b('insideV'):'')+'</w:tblBorders>'; }
function box(text,TW){ TW=TW||TEXT_W;
  const lines=String(text==null?'':text).replace(/\r\n?/g,'\n').replace(/\t/g,'    ').split('\n');
  const ps=lines.map(l=>para(l,{mono:true,sz:10,after:0,line:240})).join('')||para('',{mono:true,sz:10,after:0});
  return '<w:tbl><w:tblPr><w:tblW w:w="'+TW+'" w:type="dxa"/>'+borders(12,'000000',false)
    +'<w:tblLayout w:type="fixed"/><w:tblCellMar><w:top w:w="170" w:type="dxa"/><w:left w:w="200" w:type="dxa"/><w:bottom w:w="170" w:type="dxa"/><w:right w:w="200" w:type="dxa"/></w:tblCellMar></w:tblPr>'
    +'<w:tblGrid><w:gridCol w:w="'+TW+'"/></w:tblGrid><w:tr><w:tc><w:tcPr><w:tcW w:w="'+TW+'" w:type="dxa"/></w:tcPr>'+ps+'</w:tc></w:tr></w:tbl>'; }
function table(t,TW){ TW=TW||TEXT_W;
  const cols=t.cols&&t.cols.length?t.cols:(t.head||t.rows[0]||[]).map(()=>Math.floor(TW/((t.head||t.rows[0]||[1]).length)));
  const sum=cols.reduce((a,b)=>a+b,0), k=TW/sum, w=cols.map(c=>Math.floor(c*k));
  const cell=(v,i,head)=>'<w:tc><w:tcPr><w:tcW w:w="'+w[i]+'" w:type="dxa"/>'+(head?'<w:shd w:val="clear" w:color="auto" w:fill="E7E6E6"/>':'')+'</w:tcPr>'
    +String(v==null?'':v).split('\n').map(l=>para(l,{sz:t.sz||9,b:head,after:0,line:240})).join('')+'</w:tc>';
  let h='<w:tbl><w:tblPr><w:tblW w:w="'+TW+'" w:type="dxa"/>'+borders(4,'8C8C8C',true)
    +'<w:tblLayout w:type="fixed"/><w:tblCellMar><w:top w:w="40" w:type="dxa"/><w:left w:w="80" w:type="dxa"/><w:bottom w:w="40" w:type="dxa"/><w:right w:w="80" w:type="dxa"/></w:tblCellMar></w:tblPr>'
    +'<w:tblGrid>'+w.map(c=>'<w:gridCol w:w="'+c+'"/>').join('')+'</w:tblGrid>';
  if(t.head)h+='<w:tr><w:trPr><w:tblHeader/><w:cantSplit/></w:trPr>'+t.head.map((v,i)=>cell(v,i,true)).join('')+'</w:tr>';
  for(const r of t.rows)h+='<w:tr><w:trPr><w:cantSplit/></w:trPr>'+cols.map((_,i)=>cell(r[i],i,false)).join('')+'</w:tr>';
  return h+'</w:tbl>'; }
function docx(o){
  const parts=[], land=!!o.landscape, pw=land?PAGE_H:PAGE_W, ph=land?PAGE_W:PAGE_H, TW=pw-2*MARGIN;
  parts.push(para(o.title||'Document',{b:true,sz:15,after:o.sub?40:200,keep:true}));
  if(o.sub)parts.push(para(o.sub,{sz:9.5,color:'555555',after:200}));
  for(const b of o.blocks||[]){
    if(b.h!=null)parts.push(para(b.h,{b:true,sz:12,before:200,after:100,keep:true}));
    else if(b.box!=null)parts.push(box(b.box,TW),para('',{after:120}));
    else if(b.table)parts.push(table(b.table,TW),para('',{after:120}));
    else if(b.note!=null)parts.push(para(b.note,{sz:8.5,color:'666666',after:80}));
    else if(b.gap)parts.push(para('',{after:0}));
    else if(b.p!=null)parts.push(para(b.p,b));
  }
  if(o.footer!==false)parts.push(para(o.footer||('Assisting — independent reference tool, not an official Garda system · not legal advice · verify current wording · '+new Date().toLocaleDateString('en-IE')),{sz:8,color:'777777',before:120,after:0}));
  const doc=HEAD+'<w:document xmlns:w="'+NS_W+'" xmlns:r="'+NS_R+'"><w:body>'+parts.join('')
    +'<w:sectPr><w:pgSz w:w="'+pw+'" w:h="'+ph+'"'+(land?' w:orient="landscape"':'')+'/><w:pgMar w:top="'+MARGIN+'" w:right="'+MARGIN+'" w:bottom="'+MARGIN+'" w:left="'+MARGIN+'" w:header="567" w:footer="567" w:gutter="0"/></w:sectPr></w:body></w:document>';
  const styles=HEAD+'<w:styles xmlns:w="'+NS_W+'"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri" w:eastAsia="Calibri"/><w:sz w:val="22"/><w:szCs w:val="22"/><w:lang w:val="en-IE"/></w:rPr></w:rPrDefault>'
    +'<w:pPrDefault><w:pPr><w:spacing w:after="120" w:line="252" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>'
    +'<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>'
    +'<w:style w:type="table" w:default="1" w:styleId="TableNormal"><w:name w:val="Normal Table"/><w:uiPriority w:val="99"/><w:semiHidden/><w:unhideWhenUsed/><w:tblPr><w:tblInd w:w="0" w:type="dxa"/><w:tblCellMar><w:top w:w="0" w:type="dxa"/><w:left w:w="108" w:type="dxa"/><w:bottom w:w="0" w:type="dxa"/><w:right w:w="108" w:type="dxa"/></w:tblCellMar></w:tblPr></w:style></w:styles>';
  const files=[
    {name:'[Content_Types].xml',data:HEAD+'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>'
      +'<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>'
      +'<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>'},
    {name:'_rels/.rels',data:HEAD+'<Relationships xmlns="'+NS_PR+'"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>'
      +'<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>'},
    {name:'word/document.xml',data:doc},
    {name:'word/styles.xml',data:styles},
    {name:'word/_rels/document.xml.rels',data:HEAD+'<Relationships xmlns="'+NS_PR+'"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>'},
    {name:'docProps/core.xml',data:core(o.title)},
    {name:'docProps/app.xml',data:app()}];
  return new Blob([zip(files)],{type:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'});
}

/* ---------- Excel ---------- */
// sheets: [{name, cols:[width…], head:[…], rows:[[…]]}] · a cell is a string, a number, or {v, f:'time'|'dt'|'n6'|'n1'|'int'}
function colName(i){ let s=''; i++; while(i>0){ const m=(i-1)%26; s=String.fromCharCode(65+m)+s; i=Math.floor((i-1)/26); } return s; }
const XF={head:1,wrap:2,time:3,dt:4,n6:5,n1:6,int:7};
function xlCell(v,r,c,head){
  const ref=colName(c)+(r+1);
  if(v==null||v==='')return '';
  if(head)return '<c r="'+ref+'" t="inlineStr" s="'+XF.head+'"><is><t xml:space="preserve">'+x(v)+'</t></is></c>';
  if(typeof v==='object'&&v.v!=null){
    if(v.f==='time'||v.f==='dt'){ const d=new Date(v.v); const ser=(d.getTime()-d.getTimezoneOffset()*60000)/86400000+25569; return '<c r="'+ref+'" s="'+XF[v.f]+'"><v>'+ser.toFixed(8)+'</v></c>'; }
    if(typeof v.v==='number'&&isFinite(v.v))return '<c r="'+ref+'" s="'+(XF[v.f]||0)+'"><v>'+v.v+'</v></c>';
    v=v.v; }
  if(typeof v==='number'&&isFinite(v))return '<c r="'+ref+'"><v>'+v+'</v></c>';
  return '<c r="'+ref+'" t="inlineStr" s="'+XF.wrap+'"><is><t xml:space="preserve">'+x(v)+'</t></is></c>'; }
function sheetXml(s){
  const cols=s.cols&&s.cols.length?'<cols>'+s.cols.map((w,i)=>'<col min="'+(i+1)+'" max="'+(i+1)+'" width="'+w+'" customWidth="1"/>').join('')+'</cols>':'';
  const rows=[]; let r=0;
  if(s.head){ rows.push('<row r="1">'+s.head.map((v,c)=>xlCell(v,0,c,true)).join('')+'</row>'); r=1; }
  for(const row of s.rows){ rows.push('<row r="'+(r+1)+'">'+row.map((v,c)=>xlCell(v,r,c,false)).join('')+'</row>'); r++; }
  return HEAD+'<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="'+NS_R+'">'
    +(s.head?'<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>':'')
    +'<sheetFormatPr defaultRowHeight="15"/>'+cols+'<sheetData>'+rows.join('')+'</sheetData>'
    +'<pageMargins left="0.5" right="0.5" top="0.6" bottom="0.6" header="0.3" footer="0.3"/><pageSetup paperSize="9" orientation="landscape" fitToHeight="0"/></worksheet>'; }
function xlsx(sheets,title){
  const used=new Set(), names=sheets.map((s,i)=>{ let n=String(s.name||('Sheet'+(i+1))).replace(/[\\\/\?\*\[\]:]/g,' ').slice(0,31).trim()||('Sheet'+(i+1)); while(used.has(n.toLowerCase()))n=(n.slice(0,28)+' '+(i+1)); used.add(n.toLowerCase()); return n; });
  const styles=HEAD+'<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
    +'<numFmts count="4"><numFmt numFmtId="164" formatCode="hh:mm:ss"/><numFmt numFmtId="165" formatCode="dd/mm/yyyy hh:mm"/><numFmt numFmtId="166" formatCode="0.000000"/><numFmt numFmtId="167" formatCode="0.0"/></numFmts>'
    +'<fonts count="2"><font><sz val="11"/><name val="Calibri"/><family val="2"/></font><font><b/><sz val="11"/><name val="Calibri"/><family val="2"/></font></fonts>'
    +'<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFE7E6E6"/><bgColor indexed="64"/></patternFill></fill></fills>'
    +'<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left/><right/><top/><bottom style="thin"><color rgb="FF8C8C8C"/></bottom><diagonal/></border></borders>'
    +'<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'
    +'<cellXfs count="8"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'
    +'<xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>'
    +'<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>'
    +'<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyAlignment="1"><alignment vertical="top"/></xf>'
    +'<xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyAlignment="1"><alignment vertical="top"/></xf>'
    +'<xf numFmtId="166" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyAlignment="1"><alignment vertical="top"/></xf>'
    +'<xf numFmtId="167" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyAlignment="1"><alignment vertical="top"/></xf>'
    +'<xf numFmtId="1" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyAlignment="1"><alignment vertical="top"/></xf></cellXfs>'
    +'<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>';
  const files=[
    {name:'[Content_Types].xml',data:HEAD+'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>'
      +'<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'
      +sheets.map((s,i)=>'<Override PartName="/xl/worksheets/sheet'+(i+1)+'.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>').join('')
      +'<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>'},
    {name:'_rels/.rels',data:HEAD+'<Relationships xmlns="'+NS_PR+'"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>'
      +'<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>'},
    {name:'xl/workbook.xml',data:HEAD+'<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="'+NS_R+'"><bookViews><workbookView/></bookViews><sheets>'
      +names.map((n,i)=>'<sheet name="'+x(n)+'" sheetId="'+(i+1)+'" r:id="rId'+(i+1)+'"/>').join('')+'</sheets></workbook>'},
    {name:'xl/_rels/workbook.xml.rels',data:HEAD+'<Relationships xmlns="'+NS_PR+'">'+sheets.map((s,i)=>'<Relationship Id="rId'+(i+1)+'" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet'+(i+1)+'.xml"/>').join('')
      +'<Relationship Id="rId'+(sheets.length+1)+'" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>'},
    {name:'xl/styles.xml',data:styles},
    ...sheets.map((s,i)=>({name:'xl/worksheets/sheet'+(i+1)+'.xml',data:sheetXml(s)})),
    {name:'docProps/core.xml',data:core(title||'Spreadsheet')},
    {name:'docProps/app.xml',data:app()}];
  return new Blob([zip(files)],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
}

/* ---------- save or share ---------- */
function safeName(s){ return (String(s||'assisting').replace(/[^\w\s\-–.()]/g,'').replace(/\s+/g,' ').trim().slice(0,70)||'assisting'); }
function save(blob,name){
  const u=URL.createObjectURL(blob), a=D.createElement('a'); a.href=u; a.download=name; a.rel='noopener'; a.style.display='none';
  D.body.appendChild(a); a.click(); setTimeout(()=>{ URL.revokeObjectURL(u); a.remove(); },4000); }
function canShare(blob,name){ try{ return !!(navigator.canShare&&navigator.canShare({files:[new File([blob],name,{type:blob.type})]})); }catch(e){ return false; } }
async function share(blob,name,title){
  const f=new File([blob],name,{type:blob.type});
  try{ await navigator.share({files:[f],title:title||name}); return true; }catch(e){ if(e&&e.name==='AbortError')return true; return false; } }
// one document in the house style: title, then the text in a ruled box
function textDoc(title,text,sub){ return docx({title,sub,blocks:[{box:String(text||'').replace(/\*\*/g,'')}]}); }

W.GRDocs=Object.freeze({zip,crc32,docx,xlsx,save,share,canShare,safeName,textDoc});
})();
