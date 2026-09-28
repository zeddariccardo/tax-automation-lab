// Deterministic extraction of the existing TAL PDF implementation, not its fiscal logic.
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const source=await readFile(new URL('../f24/index.html',import.meta.url),'utf8');
const scripts=[...source.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map(x=>x[1]);
const vendor=scripts.find(s=>s.includes('sourceMappingURL=jspdf.umd.min.js.map'));
if(!vendor)throw Error('Legacy jsPDF missing');
await writeFile(new URL('./f24-pdf-vendor.generated.js',import.meta.url),vendor.replace(/\/\/# sourceMappingURL=.*/g,'').replace(/[ \t]+$/gm,'').trimEnd()+'\n');
const between=(a,b)=>{const start=source.indexOf(a),end=source.indexOf(b,start);if(start<0||end<0)throw Error('Legacy renderer changed');return source.slice(start,end);};
const templates=between('const F24_MINISTERIAL_TEMPLATES','</script>');
const coordinates=between('const MONEY_OFFSET','/* Elenco piatto dei riquadri');
const render=between('function pdfDocForGroup(g)','function pdfFileName(g)');
const code='// Generated from immutable legacy renderer SHA-256 '+createHash('sha256').update(source).digest('hex')+'\n'+
 'import "./f24-pdf-vendor.generated.js";\n'+templates+'\n'+coordinates+'\n'+
 'const APP_VERSION="S15";const cents=v=>{if(v===undefined||v===null)return 0;if(!Number.isSafeInteger(v)||v<0)throw Error("Invalid cents");return v;};const fromCents=v=>v;\n'+
 'const normalizeId=v=>String(v??"").toUpperCase().replace(/[^A-Z0-9]/g,"");\n'+
 'const sectionedRows=g=>({erario:g.filled});\n'+render+'\n'+
 'export function renderF24Pdf(taxpayer,group){\n'+
 'if(!["READY","DOWNLOADED","PAID"].includes(group.status)||group.lines.length<1||group.lines.length>6)throw Error("F24 not ready");\n'+
 'let sum=0;const rows=group.lines.map(l=>{if(l.section!=="ERARIO"||!["1790","1791","1792"].includes(l.taxCode)||!Number.isSafeInteger(l.amountCents)||l.amountCents<=0)throw Error("Unsupported row");sum+=l.amountCents;return {section:"ERARIO",taxCode:l.taxCode,period:l.period,year:String(l.referenceTaxYear),debit:l.amountCents,credit:0};});\n'+
 'if(!Number.isSafeInteger(sum)||sum!==group.totalCents)throw Error("Totals mismatch");\n'+
 'return pdfDocForGroup({client:taxpayer,filled:rows,rows,balance:sum,date:"",flow:"S15"});}\n';
await writeFile(new URL('./f24-renderer.generated.js',import.meta.url),code);
console.log('Extracted legacy PDF geometry/templates and existing vendored jsPDF; money adapter accepts integer cents only.');
