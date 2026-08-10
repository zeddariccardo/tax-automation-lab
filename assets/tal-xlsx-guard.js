/* Tax Automation Lab — XLSX binary/download and output polish guard v1.1.1
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
    if(cell&&typeof cell.v==='number')cell.z=format;
  }

  function polishFinancialAnalysisWorkbook(wb){
    if(!wb||!wb.Sheets)return wb;
    const dash=wb.Sheets['Executive Dashboard'];
    if(!dash)return wb;

    /* AOA contract in FA 2.0.6:
       rows 7-12 = primary financial KPIs, D7:D10 = percentage changes. */
    for(let r=7;r<=12;r++){
      setFmt(dash,'B'+r,MONEY_FMT);
      setFmt(dash,'C'+r,MONEY_FMT);
    }
    for(let r=7;r<=10;r++)setFmt(dash,'D'+r,'0.00%');
    setFmt(dash,'B14','0');

    if(window.XLSX&&window.XLSX.utils&&dash['!ref']){
      const range=window.XLSX.utils.decode_range(dash['!ref']);
      for(let row=15;row<=range.e.r;row++)setFmt(dash,'B'+(row+1),'0');
    }
    dash['!cols']=[{wch:42},{wch:20},{wch:20},{wch:18}];

    /* Keep the KPI workbook usable without changing values/formulas. */
    const kpi=wb.Sheets.KPI;
    if(kpi)kpi['!cols']=[{wch:22},{wch:18},{wch:32},{wch:46},{wch:16},{wch:11},{wch:34},{wch:18},{wch:44}];
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
    document.querySelectorAll('button,a').forEach(function(el){
      if((el.textContent||'').trim()==='Riclassificazioni PDF'){
        el.textContent='Stampa / Salva PDF';
        el.setAttribute('title','Apre la vista di stampa, da cui puoi stampare o salvare in PDF.');
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
      version:'1.1.1',
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
