import test from 'node:test';import assert from 'node:assert/strict';import {readFile,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';import {join} from 'node:path';
import {createPaymentsService} from './payments-service.js';import {paymentsView} from './payments-view.js';
const w='15000000-0000-4000-8000-000000000001',s='15000000-0000-4000-8000-000000000002';
const session={token:'synthetic.jwt.test',user:{id:s},context:{context_type:'personal',context_id:w},config:{supabaseUrl:'https://synthetic.example',publishableKey:'sb_publishable_synthetic'}};
function harness(response,wait=false){const calls=[];let release;
 const auth={withContextSession:fn=>Promise.resolve().then(()=>fn(session))};
 const service=createPaymentsService({auth,fetchImpl:async(url,options)=>{calls.push({url,options});if(wait)await new Promise(r=>release=r);return typeof response==='function'?response():Response.json(response);}});
 return {service,calls,release:()=>release()};
}
test('scoped transport accepts current server-owned amounts',async()=>{
 const record={revision:1,draft:{workspaceId:w,taxYear:2025,groups:[]}},x=harness(record);
 assert.deepEqual(await x.service.readPayments(w),record);assert.equal(x.calls[0].options.headers.Authorization,'Bearer synthetic.jwt.test');
 assert.deepEqual(JSON.parse(x.calls[0].options.body),{workspaceId:w,year:2025});
 assert.equal(x.calls[0].options.cache,'no-store');
});
for(const status of [401,403,404,409,503])test('HTTP '+status+' handled without sensitive details',async()=>{
 const x=harness(()=>new Response('private diagnostic',{status}));
 await assert.rejects(x.service.readPayments(w),e=>e.code&&e.message!=='private diagnostic');
});
test('foreign workspace result rejected',async()=>{const x=harness({revision:1,draft:{workspaceId:s,taxYear:2025,groups:[]}});await assert.rejects(x.service.readPayments(w));});
test('double submit shares one network attempt and conflicting payload rejected',async()=>{
 const x=harness({revision:1},true),key=crypto.randomUUID(),p={action:'READY'};
 const a=x.service.actF24(w,p,key),b=x.service.actF24(w,p,key);
 await new Promise(r=>setTimeout(r,0));assert.equal(x.calls.length,1);
 await assert.rejects(x.service.actF24(w,{action:'PAID'},key),e=>e.code==='idempotency');
 x.release();assert.deepEqual(await a,await b);
});
test('money/codes/calendar only from server; payment preview never invents a figure',async()=>{
 const src=await readFile(new URL('./payments-view.js',import.meta.url),'utf8');
 assert.doesNotMatch(src,/179[012]|40\s*\/\s*100|new Date\(\)\.getFullYear/);
 const html=paymentsView({state:{phase:'forbidden'},heading:t=>t,button:()=>'',esc:String,euro:String});
 assert.match(html,/non è più disponibile/);
});
test('legacy PDF renderer exact cents, three pages, overflow and blocked gates',async()=>{
 globalThis.window=globalThis;
 const {renderF24Pdf}=await import('./f24-renderer.generated.js');
 const taxpayer={name:'SYNTHETIC TEST DATA',cf:'RSSMRA80A01H501U',city:'ROMA',province:'RM',address:'VIA TEST 1'};
 const group={status:'READY',key:'2026-06-30',dueDate:'2026-06-30',totalCents:287601,lines:[
  {section:'ERARIO',taxCode:'1792',period:'0101',referenceTaxYear:2025,amountCents:194001},
  {section:'ERARIO',taxCode:'1790',period:'0101',referenceTaxYear:2026,amountCents:93600}]};
 const doc=renderF24Pdf(taxpayer,group);assert.equal(doc.getNumberOfPages(),3);
 // Independent extraction of the immutable old renderer, with its original euro adapter.
 const legacy=await readFile(new URL('../f24/index.html',import.meta.url),'utf8');
 const section=(a,b)=>legacy.slice(legacy.indexOf(a),legacy.indexOf(b,legacy.indexOf(a)));
 const oldRender=new Function('window',section('const F24_MINISTERIAL_TEMPLATES','</script>')+
  section('const MONEY_OFFSET','/* Elenco piatto dei riquadri')+
  'const APP_VERSION="S15";const cents=v=>Math.round((Number(v)||0)*100);const fromCents=v=>v/100;const normalizeId=v=>String(v??"").toUpperCase().replace(/[^A-Z0-9]/g,"");const sectionedRows=g=>({erario:g.filled});'+
  section('function pdfDocForGroup(g)','function pdfFileName(g)')+';return pdfDocForGroup;')(globalThis);
 const legacyRows=group.lines.map(l=>({section:'ERARIO',taxCode:l.taxCode,period:l.period,year:String(l.referenceTaxYear),debit:l.amountCents/100,credit:0}));
 const legacyDoc=oldRender({client:taxpayer,filled:legacyRows,rows:legacyRows,balance:group.totalCents/100,date:'',flow:'S15'});
 assert.deepEqual(doc.internal.pages,legacyDoc.internal.pages,'Every PDF drawing/text operation matches the compatible old model');

 const bytes=Buffer.from(doc.output('arraybuffer'));assert.equal(bytes.subarray(0,4).toString(),'%PDF');
 await writeFile(join(tmpdir(),'tal-s15-f24-synthetic.pdf'),bytes);
 assert.throws(()=>renderF24Pdf(taxpayer,{...group,status:'STALE'}));
 assert.throws(()=>renderF24Pdf(taxpayer,{...group,totalCents:1}));
 assert.throws(()=>renderF24Pdf(taxpayer,{...group,lines:Array(7).fill(group.lines[0])}));
 delete globalThis.window;
});
