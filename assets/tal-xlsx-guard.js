/* Tax Automation Lab — XLSX binary/download and output polish guard v1.5.0
 * Loaded after each tool's own scripts. Tool-specific polish is path/sheet gated.
 */
(function(){
  'use strict';

  const MIME='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  const MONEY_FMT='#,##0.00;[Red]-#,##0.00';

  function toBytes(value){
    if(value instanceof Uint8Array)return value;
    if(value instanceof ArrayBuffer)return new Uint8Array(value);
    if(ArrayBuffer.isView(value))return new Uint8Array(value.buffer,value.byteOffset,value.byteLength);
    if(Array.isArray(value))return Uint8Array.from(value);
    throw new TypeError('Payload XLSX non binario.');
  }

  function assertXlsx(bytes){
    if(bytes.byteLength<100 || bytes[0]!==0x50 || bytes[1]!==0x4B || bytes[2]!==0x03 || bytes[3]!==0x04){
      throw new Error('Il file generato non è un pacchetto XLSX valido.');
    }
    return bytes;
  }

  function downloadBytes(value,filename){
    const bytes=assertXlsx(toBytes(value));
    const copy=bytes.byteOffset===0 && bytes.byteLength===bytes.buffer.byteLength
      ? bytes
      : bytes.slice();
    const blob=new Blob([copy],{type:MIME});
    if(blob.size!==bytes.byteLength)throw new Error('Dimensione XLSX non coerente.');
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');
    a.href=url;
    a.download=String(filename||'export.xlsx').replace(/[\\/:*?"<>|]+/g,'_');
    a.style.display='none';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function(){URL.revokeObjectURL(url);},1500);
    return a.download;
  }

  function setFmt(sheet,address,format){
    const cell=sheet&&sheet[address];
    if(cell&&typeof cell.v==='number'&&!cell.z)cell.z=format;
  }

  /* Formati per unita' di misura. I KPI dichiarano l'unita' in una colonna
     apposita: e' l'unico modo esatto di sapere se 0,48 e' «48,4%» o «0,48x». */
  const FMT_BY_UNIT={'%':'0.0%','eur':MONEY_FMT,'euro':MONEY_FMT,'€':MONEY_FMT,
                     'giorni':'0.0','gg':'0.0','x':'0.00"x"'};
  const FMT_DUPONT={'net margin':'0.0%','ros':'0.0%','roe':'0.0%','roi':'0.0%',
                    'roic':'0.0%','asset turnover':'0.00"x"','leverage medio':'0.00"x"'};

  function sheetRange(ws){
    if(!ws||!ws['!ref']||!window.XLSX||!window.XLSX.utils)return null;
    try{return window.XLSX.utils.decode_range(ws['!ref']);}catch(_){return null;}
  }

  function cellAt(ws,r,c){
    return ws[window.XLSX.utils.encode_cell({r:r,c:c})]||null;
  }

  function textAt(ws,r,c){
    const cell=cellAt(ws,r,c);
    return cell==null?'':String(cell.v==null?'':cell.v).trim();
  }

  function fmtAt(ws,r,c,format){
    const cell=cellAt(ws,r,c);
    if(cell&&typeof cell.v==='number'&&!cell.z)cell.z=format;
  }

  /* Cerca la riga di intestazione che comincia con una delle etichette date.
     Le tabelle qui hanno sempre poche righe di testata sopra, e cercarla invece
     di contarla evita che una riga in piu' scompagini tutti i formati - che e'
     esattamente quello che era successo con gli indirizzi fissi B7:D12. */
  function findHeaderRow(ws,range,first,second){
    for(let r=range.s.r;r<=Math.min(range.e.r,range.s.r+12);r++){
      if(new RegExp(first,'i').test(textAt(ws,r,0))&&
         (!second||new RegExp(second,'i').test(textAt(ws,r,1))))return r;
    }
    return -1;
  }

  /* Qualunque foglio che dichiari «Unita'» accanto a «Valore»: i KPI, dovunque
     finiscano. Vale per tutti i tool, perche' il contratto e' nel foglio. */
  function polishByUnit(ws){
    const range=sheetRange(ws);
    if(!range)return false;
    const head=findHeaderRow(ws,range,'^(codice|indicatore|kpi)$');
    if(head<0)return false;
    let iu=-1,iv=-1;
    for(let c=range.s.c;c<=range.e.c;c++){
      const t=textAt(ws,head,c).toLowerCase();
      if(/^unit/.test(t))iu=c;
      if(t==='valore')iv=c;
    }
    if(iu<0||iv<0)return false;
    for(let r=head+1;r<=range.e.r;r++){
      const fmt=FMT_BY_UNIT[textAt(ws,r,iu).toLowerCase()];
      if(fmt)fmtAt(ws,r,iv,fmt);
    }
    return true;
  }

  function polishDashboard(wb){
    const dash=wb.Sheets['Dashboard']||wb.Sheets['Executive Dashboard'];
    const range=sheetRange(dash);
    if(!range)return;
    const head=findHeaderRow(dash,range,'^indicatore$','^corrente$');
    if(head>=0){
      for(let r=head+1;r<=range.e.r;r++){
        if(!textAt(dash,r,0))break;
        fmtAt(dash,r,1,MONEY_FMT);
        fmtAt(dash,r,2,MONEY_FMT);
        fmtAt(dash,r,3,'0.0%');
      }
    }
    /* Le righe sotto la tabella (punteggio, copertura, pesi) sono numeri interi:
       senza formato Excel le mostrerebbe con la virgola mobile. */
    for(let r=range.s.r;r<=range.e.r;r++)fmtAt(dash,r,1,'0');
    dash['!cols']=[{wch:42},{wch:20},{wch:20},{wch:18}];
  }

  /* Due dichiarazioni che i fogli portano gia' addosso, e che bastano a sapere
     che cosa e' un importo senza indovinarlo:
     1. l'intestazione di colonna finisce con «€» (working paper del Bilancio:
        «Corrente €», «Importo precedente €»);
     2. l'intestazione porta due date in formato gg-mm-aaaa (prospetto di
        deposito: «Stato patrimoniale — Attivo | 31-12-2025 | 31-12-2024»).
     In entrambi i casi le colonne sotto sono euro. Il codice conto in prima
     colonna resta fuori, perche' la regola guarda l'intestazione, non il tipo. */
  /* Nomi di colonna che in un foglio contabile sono importi senza bisogno di
     dirlo. Elencati invece che indovinati: «% imponibile» contiene 100, non
     0,01, e formattarlo come percentuale scriverebbe 10.000%. */
  const COL_IMPORTO=/^(importo|imponibile|imposta|detrazione|ritenut|iva(?: esigibile| detraibile| a debito| a credito)?|debito|credito|saldo|totale|corrente|precedente)\b/i;
  const COL_PERCENTO=/^%\s/;

  function polishDeclaredMoney(ws){
    const range=sheetRange(ws);
    if(!range)return false;
    let fatto=false;
    for(let head=range.s.r;head<=Math.min(range.e.r,range.s.r+8);head++){
      const colonne=[],percento=[];
      let date=0;
      for(let c=range.s.c;c<=range.e.c;c++){
        const t=textAt(ws,head,c);
        if(!t)continue;
        if(COL_PERCENTO.test(t))percento.push(c);
        else if(/€\s*$/.test(t)||COL_IMPORTO.test(t))colonne.push(c);
        else if(c>range.s.c&&/^\d{2}-\d{2}-\d{4}$/.test(t)){colonne.push(c);date++;}
      }
      for(let r=head+1;r<=range.e.r;r++)percento.forEach(function(c){fmtAt(ws,r,c,'0"%"');});
      if(percento.length)fatto=true;
      if(!colonne.length||(date&&date<2&&colonne.length===date))continue;
      for(let r=head+1;r<=range.e.r;r++)colonne.forEach(function(c){fmtAt(ws,r,c,MONEY_FMT);});
      fatto=true;
      if(date)break;
    }
    return fatto;
  }

  /* Fogli a due colonne, etichetta e valore: «Parametri», «Sintesi»,
     «Informazioni». Qui l'intestazione non c'e', la dichiarazione sta
     nell'etichetta della riga. Un anno resta un anno: e' l'unico numero che
     non va mai formattato, e si riconosce dall'etichetta *e* dall'intervallo,
     cosi' «Compensi dell'anno = 120.000» non viene scambiato per una data. */
  const ETICHETTA_IMPORTO=/(soglia|minim|massim|compens|importo|costo|costi|ricav|utile|netto|impost|contribut|saldo|credit|debit|cassa|reddit|spesa|spese|valore|totale|acconto|iva|detrazione|ritenut|oltre|fatturato|volume)/i;
  const ETICHETTA_ANNO=/\b(anno|esercizio|periodo)\b/i;

  function polishKeyValue(ws){
    const range=sheetRange(ws);
    if(!range||range.e.c>2)return false;
    let fatto=false;
    for(let r=range.s.r;r<=range.e.r;r++){
      const etichetta=textAt(ws,r,0);
      const cell=cellAt(ws,r,1);
      if(!etichetta||!cell||typeof cell.v!=='number'||cell.z)continue;
      if(/%\s*$/.test(etichetta)||/\(%\)\s*$/.test(etichetta)){cell.z='0"%"';fatto=true;continue;}
      if(ETICHETTA_ANNO.test(etichetta)&&cell.v>=1900&&cell.v<=2100&&Number.isInteger(cell.v))continue;
      if(ETICHETTA_IMPORTO.test(etichetta)){cell.z=MONEY_FMT;fatto=true;}
    }
    return fatto;
  }

  function polishSimpleTables(wb){
    Object.keys(wb.Sheets||{}).forEach(function(nome){
      const ws=wb.Sheets[nome];
      const range=sheetRange(ws);
      if(!range)return;
      const h0=textAt(ws,range.s.r,0),h1=textAt(ws,range.s.r,1);
      let r,c;
      if(/^bridge/i.test(h0)&&/^effetto$/i.test(h1)){
        for(r=range.s.r+1;r<=range.e.r;r++)fmtAt(ws,r,1,MONEY_FMT);
      }else if(/^voce$/i.test(h0)&&/^valore$/i.test(h1)){
        for(r=range.s.r+1;r<=range.e.r;r++)fmtAt(ws,r,1,MONEY_FMT);
      }else if(/^fattore$/i.test(h0)&&/^valore$/i.test(h1)){
        for(r=range.s.r+1;r<=range.e.r;r++){
          fmtAt(ws,r,1,FMT_DUPONT[textAt(ws,r,0).toLowerCase()]||'0.00"x"');
        }
      }else if(/^anno$/i.test(h0)){
        for(r=range.s.r+1;r<=range.e.r;r++)
          for(c=range.s.c+1;c<=range.e.c;c++)fmtAt(ws,r,c,MONEY_FMT);
      }else if(/^indicatore$/i.test(h0)&&/^valore$/i.test(h1)){
        /* La Diagnostica non dichiara l'unita': gli importi si riconoscono
           dall'ordine di grandezza, i rapporti restano a tre decimali invece
           che a sedici. Non e' una regola bella, ma e' meglio di 1,8873239. */
        for(r=range.s.r+1;r<=range.e.r;r++){
          const cell=cellAt(ws,r,1);
          if(cell&&typeof cell.v==='number')fmtAt(ws,r,1,Math.abs(cell.v)>=1000?MONEY_FMT:'0.000');
        }
      }else if(/mappatura conti/i.test(nome)){
        for(r=range.s.r+1;r<=range.e.r;r++)
          for(c=range.s.c;c<=range.e.c;c++)fmtAt(ws,r,c,MONEY_FMT);
      }
    });
  }

  /* Rifinitura degli Excel prodotti dai tool.
     Perche' sta qui e non nei generatori: i fogli nascono in punti diversi del
     file - e in Analisi in piu' definizioni sovrapposte - mentre la scrittura
     passa da un punto solo. Nessun formato gia' impostato viene sovrascritto. */
  function polishFinancialAnalysisWorkbook(wb){
    if(!wb||!wb.Sheets||!window.XLSX||!window.XLSX.utils)return wb;
    try{
      polishDashboard(wb);
      polishSimpleTables(wb);
      Object.keys(wb.Sheets).forEach(function(n){
        polishByUnit(wb.Sheets[n]);
        polishDeclaredMoney(wb.Sheets[n]);
        polishKeyValue(wb.Sheets[n]);
        /* Larghezze solo dove non ci sono: il prospetto di deposito usciva senza,
           e le voci del bilancio finivano tagliate a meta'. */
        const ws=wb.Sheets[n],range=sheetRange(ws);
        if(ws&&range&&!ws['!cols']){
          const cols=[{wch:52}];
          for(let c=range.s.c+1;c<=range.e.c;c++)cols.push({wch:18});
          ws['!cols']=cols;
        }
      });
      const kpi=wb.Sheets.KPI;
      if(kpi&&!kpi['!cols'])kpi['!cols']=[{wch:22},{wch:18},{wch:32},{wch:46},{wch:16},{wch:11},{wch:34},{wch:18},{wch:44}];
    }catch(_){/* una rifinitura mancata non deve impedire l'export */}
    return wb;
  }

  function cellText(cell){
    if(cell==null)return '';
    if(typeof cell==='object'&&Object.prototype.hasOwnProperty.call(cell,'content'))return String(cell.content||'').trim();
    return String(cell).trim();
  }

  function isFinancialStatementPath(){
    return /\/tools\/financial-statement\/?$/.test(window.location&&window.location.pathname||'');
  }

  function installPdfOrphanGuard(){
    if(!isFinancialStatementPath())return false;
    const jsPDF=window.jspdf&&window.jspdf.jsPDF;
    const api=jsPDF&&jsPDF.API;
    if(!api||typeof api.autoTable!=='function'||api.autoTable.__talFsOrphanGuardInstalled)return false;
    const original=api.autoTable;
    function guardedAutoTable(opts){
      let next=opts;
      try{
        const body=opts&&Array.isArray(opts.body)?opts.body:null;
        const last=body&&body.length?body[body.length-1]:null;
        const first=Array.isArray(last)?last[0]:null;
        if(cellText(first)==='Totale passivo'){
          next=Object.assign({},opts,{pageBreak:'avoid'});
        }
      }catch(_){next=opts;}
      return original.call(this,next);
    }
    Object.defineProperty(guardedAutoTable,'__talFsOrphanGuardInstalled',{value:true});
    api.autoTable=guardedAutoTable;
    return true;
  }

  function polishFinancialAnalysisDom(){
    if(!/\/tools\/financial-analysis\/?$/.test(window.location&&window.location.pathname||''))return;
    /* I report che finiscono «in PDF» non scaricano un file: aprono la vista di
       stampa del browser, da cui si stampa o si salva. Il pulsante lo dice nel
       suggerimento, cosi' il nome resta corto e parallelo a «... Excel». */
    document.querySelectorAll('button,a').forEach(function(el){
      const testo=(el.textContent||'').trim();
      if(/\bin PDF$/.test(testo)&&!el.getAttribute('title')){
        el.setAttribute('title','Apre la vista di stampa: da lì puoi stampare o salvare in PDF.');
      }
    });
  }

  function installFaDomObserver(){
    if(!/\/tools\/financial-analysis\/?$/.test(window.location&&window.location.pathname||''))return;
    polishFinancialAnalysisDom();
    const host=document.getElementById('reportcenter-content');
    if(host&&typeof MutationObserver==='function'){
      const observer=new MutationObserver(polishFinancialAnalysisDom);
      observer.observe(host,{childList:true,subtree:true});
    }
  }

  function install(){
    installPdfOrphanGuard();
    installFaDomObserver();
    if(!window.XLSX || typeof window.XLSX.write!=='function' || window.XLSX.__talBinaryGuardInstalled)return false;
    const originalWrite=window.XLSX.write.bind(window.XLSX);
    const originalWriteFile=typeof window.XLSX.writeFile==='function'?window.XLSX.writeFile.bind(window.XLSX):null;
    const originalWriteFileXLSX=typeof window.XLSX.writeFileXLSX==='function'?window.XLSX.writeFileXLSX.bind(window.XLSX):null;

    /* Financial Analysis 2.0.6 serializes through XLSX.write inside
       safeWriteWorkbookFile, not XLSX.writeFile. Hook the real serialization
       path so the formatting contract is applied to the downloaded workbook. */
    window.XLSX.write=function(wb,opts){
      polishFinancialAnalysisWorkbook(wb);
      return originalWrite(wb,opts);
    };

    function guardedWriteFile(wb,filename,opts){
      const name=String(filename||'');
      const requestedType=opts&&opts.bookType?String(opts.bookType).toLowerCase():'';
      const isXlsx=/\.xlsx$/i.test(name)||requestedType==='xlsx';
      if(!isXlsx && originalWriteFile)return originalWriteFile(wb,filename,opts);
      const writeOpts=Object.assign({},opts||{}, {bookType:'xlsx',type:'array'});
      const raw=window.XLSX.write(wb,writeOpts);
      return downloadBytes(raw,name||'export.xlsx');
    }

    window.XLSX.writeFile=guardedWriteFile;
    if(originalWriteFileXLSX)window.XLSX.writeFileXLSX=guardedWriteFile;
    Object.defineProperty(window.XLSX,'__talBinaryGuardInstalled',{value:true,configurable:false});
    window.TALXlsxGuard=Object.freeze({
      version:'1.5.0',
      toBytes:toBytes,
      assertXlsx:assertXlsx,
      downloadBytes:downloadBytes,
      polishFinancialAnalysisWorkbook:polishFinancialAnalysisWorkbook,
      installPdfOrphanGuard:installPdfOrphanGuard,
      install:install
    });
    return true;
  }

  if(!install()){
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});
    else setTimeout(install,0);
  }
})();
