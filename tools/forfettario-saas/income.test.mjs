import test from 'node:test';
import assert from 'node:assert/strict';
import {createTalDataService} from './tal-data-service.js';
import {createIncomeController} from './income-controller.js';
import {parseAmount,sumCents,projectIncome,formatCents} from './income-model.js';
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
function harness(){
 const h={calls:[],revoked:false,failAfterCommit:false,sequence:100,revision:0,receipts:new Map(),rows:{invoice:[],invoice_component:[],payment:[],allocation:[],economic_activity:[]}};
 const auth={getState:()=>({user:{id:id(9)}}),withContextSession:fn=>fn({config:{supabaseUrl:'https://example.test',publishableKey:'public-test'},token:'synthetic',context:{context_type:'personal',context_id:id(1)}})};
 h.service=createTalDataService({auth,fetchImpl:async(url,opts)=>{
  h.calls.push({url,opts});const u=new URL(url),name=u.pathname.split('/').at(-1);
  if(opts.method==='POST'){
   const b=JSON.parse(opts.body),p=b.p_payload,k=b.p_idempotency_key;
   if(h.revoked)return new Response('{"code":"42501"}',{status:403});
   const old=h.receipts.get(k);if(old)return new Response(JSON.stringify(old.payload===JSON.stringify(p)?old.result:{message:'IDEMPOTENCY_CONFLICT'}),{status:old.payload===JSON.stringify(p)?200:400});
     if(p.expectedDataRevision!==h.revision)return new Response('{"code":"PT409","message":"STALE_DATA_REVISION"}',{status:409});
   let inv,pay=null;
   if(name==='tal_create_invoice'){
    inv=id(h.sequence++);h.rows.invoice.push({id:inv,workspace_id:id(1),revision:1,number:p.invoice.number,customer:p.invoice.customer,issue_date:p.invoice.issueDate,currency:p.invoice.currency});
    for(const c of p.components)h.rows.invoice_component.push({id:id(h.sequence++),workspace_id:id(1),invoice_id:inv,activity_id:c.activityId,amount_cents:c.amountCents,kind:c.kind});
   }else{
    inv=p.invoiceId;const i=h.rows.invoice.find(i=>i.id===inv);assert.equal(i.revision,p.expectedInvoiceRevision);i.revision++;
    pay=id(h.sequence++);h.rows.payment.push({id:pay,workspace_id:id(1),invoice_id:inv,amount_cents:p.amountCents,cash_received_cents:p.cashReceivedCents,withholding_cents:p.withholdingCents,cash_date:p.payment.cashDate,currency:p.payment.currency});
    for(const a of p.allocations)h.rows.allocation.push({id:id(h.sequence++),workspace_id:id(1),invoice_id:inv,payment_id:pay,component_id:a.componentId,amount_cents:a.amountCents});
   }
   const result={invoiceId:inv,paymentId:pay,dataRevision:++h.revision};h.receipts.set(k,{payload:JSON.stringify(p),result});
   if(h.failAfterCommit){h.failAfterCommit=false;throw Error('response lost');}return new Response(JSON.stringify(result));
  }
  let rows=name==='tax_workspace'?[{id:id(1),data_revision:h.revision}]:structuredClone(h.rows[name]);
  if(h.revoked)rows=[];
  if(h.revokeDuring && name==='allocation')h.revoked=true;
  if(h.bumpOnce && name==='allocation'){h.revision++;h.bumpOnce=false;}
  return new Response(JSON.stringify(rows),{headers:{'content-range':'*/'+rows.length}});
 }});return h;
}
const input={number:'SYNTHETIC-18/2026',customer:'SYNTHETIC cliente',issueDate:'2026-09-27',amountCents:120001,activityId:null,expectedDataRevision:0};
async function invoice(h){await h.service.createInvoice(id(1),input,id(20));return (await h.service.listInvoices(id(1),2026)).invoices[0];}
test('decimal parser never multiplies floating point and rejects coercion/overflow',()=>{
 assert.equal(parseAmount('1,01'),101);assert.equal(parseAmount('90071992547409.91'),Number.MAX_SAFE_INTEGER);
 for(const x of ['1.001','1e2','-1','0','Infinity','1,2,3','90071992547409.92'])assert.throws(()=>parseAmount(x));
 assert.equal(sumCents([1,2]),3);assert.equal(sumCents([null,2]),null);assert.throws(()=>sumCents([Number.MAX_SAFE_INTEGER,1]));
 assert.equal(formatCents(Number.MAX_SAFE_INTEGER),'90.071.992.547.409,91\u00a0€');assert.equal(formatCents(101),'1,01\u00a0€');assert.equal(formatCents(-101),'-1,01\u00a0€');
 assert.equal(formatCents(120001),'1.200,01\u00a0€');
});
test('invoice creates a compensation and reload reads persisted rows without a paid flag',async()=>{
 const h=harness();const i=await invoice(h);assert.equal(i.total,120001);assert.equal(i.paid,0);assert.equal(i.residual,120001);assert.equal(i.components[0].activityId,null);
 assert.equal((await h.service.readInvoice(id(1),i.id)).id,i.id);assert.equal(h.rows.invoice_component.length,1);
});
test('partial followed by full receipt uses real Payment/Allocation and exact remaining cents',async()=>{
 const h=harness();let i=await invoice(h);
 await h.service.recordPayment(id(1),{invoice:i,amountCents:80001,cashDate:'2026-09-27',expectedDataRevision:1},id(21));
 let d=await h.service.listInvoices(id(1),2026);i=d.invoices[0];assert.equal(i.paid,80001);assert.equal(i.residual,40000);assert.equal(d.received,80001);
 await h.service.recordPayment(id(1),{invoice:i,amountCents:40000,cashDate:'2026-09-28',expectedDataRevision:2},id(22));
 d=await h.service.listInvoices(id(1),2026);assert.equal(d.outstanding,0);assert.equal(d.received,120001);assert.equal(d.invoices[0].paid,120001);
 assert.equal((await h.service.listPayments(id(1))).length,2);assert.equal(h.rows.allocation.length,2);
});
test('duplicate concurrent submit has one RPC and one invoice',async()=>{
 const h=harness();const [a,b]=await Promise.all([h.service.createInvoice(id(1),input,id(20)),h.service.createInvoice(id(1),input,id(20))]);
 assert.deepEqual(a,b);assert.equal(h.rows.invoice.length,1);assert.equal(h.calls.filter(c=>c.opts.method==='POST').length,1);
});
test('lost invoice response retries the exact payload/key and resolves the same receipt',async()=>{
 const h=harness();h.failAfterCommit=true;await assert.rejects(h.service.createInvoice(id(1),input,id(20)),{code:'uncertain'});
 const result=await h.service.createInvoice(id(1),input,id(20));assert.equal(h.rows.invoice.length,1);assert.equal(result.dataRevision,1);
 assert.equal(h.calls[0].opts.body,h.calls[1].opts.body);
});
test('lost payment response retry cannot create another payment/allocation',async()=>{
 const h=harness(),i=await invoice(h),p={invoice:i,amountCents:1,cashDate:'2026-09-27',expectedDataRevision:1};h.failAfterCommit=true;
 await assert.rejects(h.service.recordPayment(id(1),p,id(21)),{code:'uncertain'});await h.service.recordPayment(id(1),p,id(21));
 assert.equal(h.rows.payment.length,1);assert.equal(h.rows.allocation.length,1);assert.equal(h.revision,2);
});
test('stale revision and key payload mismatch are explicit, never silently retried as new writes',async()=>{
 const h=harness();await invoice(h);
 await assert.rejects(h.service.createInvoice(id(1),input,id(21)),{code:'conflict'});
 await assert.rejects(h.service.createInvoice(id(1),{...input,amountCents:9},id(20)),{code:'idempotency'});assert.equal(h.rows.invoice.length,1);
});
test('null cash stays unknown, settlement is distinct; no financial projection invented',async()=>{
 const h=harness(),i=await invoice(h);h.rows.payment.push({id:id(50),workspace_id:id(1),invoice_id:i.id,amount_cents:100,cash_received_cents:null,withholding_cents:0,cash_date:'2026-01-01',currency:'EUR'});
 const d=await h.service.listInvoices(id(1),2026);assert.equal(d.received,null);assert.equal(d.invoices[0].residual,119901);assert.equal(d.invoices[0].simple,false);
 assert.equal((await h.service.listInvoices(id(1),2025)).received,0);
});
test('cross-year collections follow cashDate; outstanding is independent of year',async()=>{
 const h=harness(),i=await invoice(h);await h.service.recordPayment(id(1),{invoice:i,amountCents:101,cashDate:'2027-01-03',expectedDataRevision:1},id(21));
 const a=await h.service.listInvoices(id(1),2026),b=await h.service.listInvoices(id(1),2027);assert.equal(a.received,0);assert.equal(b.received,101);assert.equal(a.outstanding,b.outstanding);
});
test('overpayment, zero, invalid date and multi-component auto-allocation are refused',async()=>{
 const h=harness(),i=await invoice(h);const p={invoice:i,amountCents:120002,cashDate:'2026-01-01',expectedDataRevision:1};
 for(const fields of [{},{amountCents:0},{amountCents:1,cashDate:'2026-02-30'},{amountCents:1,invoice:{...i,simple:false}}])assert.throws(()=>h.service.recordPayment(id(1),{...p,...fields},id(21)));
 assert.equal(h.rows.payment.length,0);
});
test('revocation during read clears result rather than returning partial or stale ledger',async()=>{
 const h=harness();await invoice(h);h.revokeDuring=true;await assert.rejects(h.service.listInvoices(id(1)),{code:'forbidden'});
});
test('revision changed during multi-table reads retries from consistent snapshot',async()=>{
 const h=harness();await invoice(h);h.bumpOnce=true;const d=await h.service.listInvoices(id(1));assert.equal(d.dataRevision,2);
});
test('revoked actor cannot replay an idempotency receipt',async()=>{
 const h=harness();await invoice(h);h.revoked=true;await assert.rejects(h.service.createInvoice(id(1),input,id(20)),{code:'forbidden'});
});
test('network surface limited to tal reads and two public RPCs; tokens only in headers',async()=>{
 const h=harness();await invoice(h);for(const c of h.calls){assert.equal(c.opts.cache,'no-store');assert.equal(c.opts.headers['x-tal-context'],'personal:'+id(1));assert.ok(!c.url.includes('synthetic'));if(c.opts.method==='POST')assert.ok(c.url.endsWith('/rpc/tal_create_invoice'));}
});
test('cross-workspace and dangling allocation rows fail closed',()=>{
 const graph={workspace:{id:id(1),data_revision:0},invoices:[],components:[],payments:[],allocations:[],activities:[]};
 assert.throws(()=>projectIncome({...graph,activities:[{id:id(3),workspace_id:id(2)}]},2026));
 assert.throws(()=>projectIncome({...graph,allocations:[{id:id(4),workspace_id:id(1),payment_id:id(5),component_id:id(6),amount_cents:1}]},2026));
});
test('income controller hides old client results after a switch or logout',async()=>{
 let listener,finish;const auth={subscribe(fn){listener=fn;fn({phase:'ready',user:{id:id(9)},selected:{context_type:'studio',context_id:id(2)}});}};
 const tasks=[];const service={listInvoices:()=>new Promise(r=>{finish=r;})};const c=createIncomeController({auth,service,defer:fn=>tasks.push(fn)});
 c.select(id(1));tasks.shift()();listener({phase:'signed-out'});finish({workspaceId:id(1)});await new Promise(r=>setImmediate(r));assert.deepEqual(c.getState(),{phase:'idle',data:null});
});

test('a real PostgreSQL serialization failure is uncertain, not an application conflict; no automatic retry',async()=>{
 let calls=0;const auth={getState:()=>({user:{id:id(9)}}),withContextSession:fn=>fn({config:{supabaseUrl:'https://example.test',publishableKey:'public-test'},token:'synthetic',context:{context_type:'personal',context_id:id(1)}})};
 const service=createTalDataService({auth,fetchImpl:async()=>{calls++;return new Response('{"code":"40001"}',{status:500});}});
 await assert.rejects(service.createInvoice(id(1),input,id(90)),{code:'uncertain'});assert.equal(calls,1);
});
