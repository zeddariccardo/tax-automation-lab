/* Tax Automation Lab — XLSX binary download guard v1.0.0
 * Keeps browser-side SheetJS exports binary-safe even if page globals collide
 * with minified vendor helper names. Loaded after each tool's own scripts.
 */
(function(){
  'use strict';

  const MIME='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

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

  function install(){
    if(!window.XLSX || typeof window.XLSX.write!=='function' || window.XLSX.__talBinaryGuardInstalled)return false;
    const originalWriteFile=typeof window.XLSX.writeFile==='function'?window.XLSX.writeFile.bind(window.XLSX):null;
    const originalWriteFileXLSX=typeof window.XLSX.writeFileXLSX==='function'?window.XLSX.writeFileXLSX.bind(window.XLSX):null;

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
    window.TALXlsxGuard=Object.freeze({version:'1.0.0',toBytes:toBytes,assertXlsx:assertXlsx,downloadBytes:downloadBytes,install:install});
    return true;
  }

  if(!install()){
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});
    else setTimeout(install,0);
  }
})();
