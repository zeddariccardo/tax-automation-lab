(function(){
'use strict';
const VERSION='2.0.5';
const XLSX_MIME='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

function toUint8Array(value){
  if(value instanceof Uint8Array)return value;
  if(value instanceof ArrayBuffer)return new Uint8Array(value);
  if(typeof ArrayBuffer!=='undefined'&&typeof ArrayBuffer.isView==='function'&&ArrayBuffer.isView(value)){
    return new Uint8Array(value.buffer,value.byteOffset,value.byteLength);
  }
  if(Array.isArray(value))return Uint8Array.from(value,function(item){return Number(item)&255;});
  throw new TypeError('Payload XLSX non binario.');
}

function exactBuffer(bytes){
  if(bytes.byteOffset===0&&bytes.byteLength===bytes.buffer.byteLength)return bytes.buffer;
  return bytes.slice().buffer;
}

function hasXlsxSignature(bytes){
  return bytes.length>=4&&bytes[0]===0x50&&bytes[1]===0x4b&&bytes[2]===0x03&&bytes[3]===0x04;
}

function cleanWorkbook(wb){
  ['View','Support','Watermark'].forEach(function(name){
    if(wb&&wb.Sheets&&wb.Sheets[name])delete wb.Sheets[name];
  });
  if(wb&&Array.isArray(wb.SheetNames)){
    wb.SheetNames=wb.SheetNames.filter(function(name){return !['View','Support','Watermark'].includes(name);});
  }
}

function normalizeWorkbookVersion(wb){
  if(!wb||!wb.Sheets)return;
  Object.keys(wb.Sheets).forEach(function(sheetName){
    const sheet=wb.Sheets[sheetName];
    Object.keys(sheet||{}).forEach(function(address){
      if(address.charAt(0)==='!')return;
      const cell=sheet[address];
      if(!cell||typeof cell.v!=='string')return;
      const source=cell.v;
      if(!/(Tax Automation Lab|Financial Analysis|Analisi di bilancio|Versione|^v?2\.0\.[0-4]$)/i.test(source))return;
      const updated=source.replace(/v?2\.0\.[0-4]/g,function(value){return value.charAt(0).toLowerCase()==='v'?'v'+VERSION:VERSION;});
      if(updated!==source){
        cell.v=updated;
        if(Object.prototype.hasOwnProperty.call(cell,'w'))delete cell.w;
        if(Object.prototype.hasOwnProperty.call(cell,'h'))delete cell.h;
      }
    });
  });
}

function normalizedFilename(filename){
  const value=String(filename||'Analisi.xlsx').trim()||'Analisi.xlsx';
  return /\.xlsx$/i.test(value)?value:value+'.xlsx';
}

async function validatePackage(bytes){
  if(!hasXlsxSignature(bytes))throw new Error('Il file generato non presenta la firma ZIP/XLSX prevista.');
  if(!window.JSZip)return;
  const zip=await JSZip.loadAsync(bytes);
  if(!zip.file('[Content_Types].xml')||!zip.file('xl/workbook.xml')){
    throw new Error('Il pacchetto generato non contiene la struttura minima di un workbook XLSX.');
  }
}

function downloadBytes(bytes,filename){
  if(!hasXlsxSignature(bytes))throw new Error('Download bloccato: payload XLSX non valido.');
  const blob=new Blob([bytes],{type:XLSX_MIME});
  if(blob.size!==bytes.byteLength||blob.size<100){
    throw new Error('Dimensione del file XLSX non coerente con il payload generato.');
  }
  const url=URL.createObjectURL(blob);
  const link=document.createElement('a');
  link.href=url;
  link.download=normalizedFilename(filename);
  link.style.display='none';
  document.body.appendChild(link);
  link.click();
  setTimeout(function(){link.remove();URL.revokeObjectURL(url);},1800);
}

async function safeWriteWorkbookFile(wb,filename,profile){
  cleanWorkbook(wb);
  normalizeWorkbookVersion(wb);
  try{
    const raw=XLSX.write(wb,{bookType:'xlsx',type:'array',cellStyles:true});
    let bytes=toUint8Array(raw);
    if(typeof v17PatchXlsxStyles==='function'){
      try{
        const styled=await v17PatchXlsxStyles(exactBuffer(bytes),profile||'generic');
        bytes=toUint8Array(styled);
      }catch(styleError){
        console.warn('TAL XLSX style patch skipped:',styleError);
      }
    }
    await validatePackage(bytes);
    downloadBytes(bytes,filename);
    return true;
  }catch(error){
    console.error('TAL XLSX export failed:',error);
    if(typeof toast==='function')toast('Esportazione Excel non riuscita: '+(error&&error.message?error.message:'file XLSX non valido.'),true);
    throw error;
  }
}

const previousDownloadBlob=typeof window.downloadBlob==='function'?window.downloadBlob:null;
window.downloadBlob=function(content,filename,mime){
  if(/\.xlsx$/i.test(String(filename||''))||String(mime||'').indexOf('spreadsheetml')>=0){
    try{
      downloadBytes(toUint8Array(content),filename);
      return;
    }catch(error){
      console.error('TAL binary download guard:',error);
      if(typeof toast==='function')toast('Download Excel bloccato: il file generato non è valido.',true);
      throw error;
    }
  }
  if(previousDownloadBlob)return previousDownloadBlob.apply(this,arguments);
  const blob=content instanceof Blob?content:new Blob([content],{type:mime||'application/octet-stream'});
  const url=URL.createObjectURL(blob);
  const link=document.createElement('a');
  link.href=url;
  link.download=filename||'download';
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(function(){URL.revokeObjectURL(url);},1000);
};

window.talXlsxHotfixVersion=VERSION;
window.writeWorkbookFile=safeWriteWorkbookFile;
try{writeWorkbookFile=window.writeWorkbookFile;}catch(_){ }
try{downloadBlob=window.downloadBlob;}catch(_){ }

function updateVersion(){
  document.documentElement.dataset.toolVersion=VERSION;
  document.querySelectorAll('.tal-publication-label').forEach(function(el){
    el.textContent=el.textContent.replace(/v\d+\.\d+\.\d+/,'v'+VERSION);
  });
}

function install(){
  window.writeWorkbookFile=safeWriteWorkbookFile;
  try{writeWorkbookFile=window.writeWorkbookFile;}catch(_){ }
  try{downloadBlob=window.downloadBlob;}catch(_){ }
  updateVersion();
  setTimeout(updateVersion,50);
  setTimeout(updateVersion,300);
  setTimeout(updateVersion,1200);
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});
else install();
})();