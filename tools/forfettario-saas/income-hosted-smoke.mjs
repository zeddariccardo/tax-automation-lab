// Synthetic hosted acceptance. Secrets only from stdin; never log provider responses.
// --dynamic requires the controlled link-revocation orchestrator. No admin key in this process.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createInterface } from 'node:readline';
import config from './config.local.js';
import { createAuthContextService } from './auth-context-service.js';
import { createTalDataService } from './tal-data-service.js';
if(!process.argv.includes('--dynamic'))throw Error('Controlled synthetic orchestrator required');
const lines=createInterface({input:process.stdin,crlfDelay:Infinity})[Symbol.asyncIterator]();
let credentials=JSON.parse((await lines.next()).value);
const memory=()=>{const m=new Map();return{getItem:k=>m.get(k)||null,setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k)};};
const subjects=new Map(),results=[],conflicts=[];
let current='login',createdId;
async function check(name,fn){current=name;await fn();results.push({test:name,result:'PASS'});}
async function raw(s,table,context,filters={}){
 return s.auth.withContextSession(async session=>{
 const r=await fetch(config.supabaseUrl+'/rest/v1/'+table+'?'+new URLSearchParams({select:'id',...filters}),{headers:{apikey:config.publishableKey,Authorization:'Bearer '+session.token,'Accept-Profile':'tal','x-tal-context':context},cache:'no-store',redirect:'error'});
 assert.equal(r.status,200);return r.json();
 });
}
try {
 for(const [name,c]of Object.entries(credentials)){
  const auth=createAuthContextService({config,fetchImpl:fetch,storage:memory(),preferenceStorage:memory(),lock:(_k,fn)=>fn()});
  await auth.login(c.email,c.password);assert.ok(['ready','choosing'].includes(auth.getState().phase));
  subjects.set(name,{auth,contexts:auth.getState().contexts,data:createTalDataService({auth,fetchImpl:async(url,options)=>{
   const started=performance.now(),r=await fetch(url,options);
   if(options.method==='POST'&&r.status===409)conflicts.push({status:r.status,ms:Math.round(performance.now()-started)});
   return r;
  }})});
 }
 credentials=null;
 const a=subjects.get('contribuente-a'),b=subjects.get('contribuente-b'),admin=subjects.get('studio-a-admin'),member=subjects.get('studio-a-professionista'),other=subjects.get('studio-b-admin'),dual=subjects.get('dual-role');
 const wa=a.contexts[0].context_id,wb=b.contexts[0].context_id,sa=admin.contexts[0],sb=other.contexts[0];
 await check('login and discovery 6/6',()=>assert.equal(subjects.size,6));
 const before=await a.data.listInvoices(wa),key=randomUUID();
 const input={number:'S08-TEST-HOSTED-'+randomUUID().slice(0,8),customer:'SYNTHETIC acceptance customer',issueDate:'2026-09-27',amountCents:120001,expectedDataRevision:before.dataRevision,activityId:null};
 let created;
 await check('double submit creates one invoice',async()=>{
  const [x,y]=await Promise.all([a.data.createInvoice(wa,input,key),a.data.createInvoice(wa,input,key)]);
  assert.deepEqual(x,y);created=x;createdId=x.invoiceId;
  const data=await a.data.listInvoices(wa);assert.equal(data.invoices.length,before.invoices.length+1);
  assert.equal(data.invoices.find(i=>i.id===x.invoiceId).total,120001);
 });
 await check('invoice retry returns original receipt',async()=>assert.deepEqual(await a.data.createInvoice(wa,input,key),created));
 await check('fresh service reload sees persisted invoice',async()=>assert.equal((await createTalDataService({auth:a.auth,fetchImpl:fetch}).readInvoice(wa,createdId)).total,120001));
 let data=await a.data.listInvoices(wa),invoice=data.invoices.find(i=>i.id===createdId);
 const payment={invoice,amountCents:80001,cashDate:'2026-09-27',expectedDataRevision:data.dataRevision},paymentKey=randomUUID();
 let drop=true;
 const lossy=createTalDataService({auth:a.auth,fetchImpl:async(url,options)=>{
  const r=await fetch(url,options);if(drop&&url.endsWith('/tal_record_payment')){drop=false;await r.arrayBuffer();throw Error('synthetic lost response');}return r;
 }});
 await check('payment response lost after server processing',async()=>assert.rejects(lossy.recordPayment(wa,payment,paymentKey),{code:'uncertain'}));
 let partial;
 await check('payment retry no duplicate, exact 40000 residual',async()=>{
  partial=await lossy.recordPayment(wa,payment,paymentKey);
  assert.deepEqual(await a.data.recordPayment(wa,payment,paymentKey),partial);
  const i=await a.data.readInvoice(wa,createdId);assert.equal(i.payments.length,1);assert.equal(i.paid,80001);assert.equal(i.residual,40000);assert.equal(i.components[0].allocated,80001);
 });
 await check('stale revision rejected without duplicate',async()=>assert.rejects(a.data.recordPayment(wa,payment,randomUUID()),{code:'conflict'}));
 await check('hosted HTTP 409 promptly, single request and no blind retry',()=>{assert.equal(conflicts.length,1);assert.equal(conflicts[0].status,409);assert.ok(conflicts[0].ms<5000);});
 await check('same key altered body rejected',async()=>assert.rejects(a.data.recordPayment(wa,{...payment,amountCents:80000},paymentKey),{code:'idempotency'}));
 await check('Studio admin/member see identical invoice',async()=>{
  assert.deepEqual(await admin.data.readInvoice(wa,createdId),await a.data.readInvoice(wa,createdId));
  assert.deepEqual(await member.data.readInvoice(wa,createdId),await a.data.readInvoice(wa,createdId));
 });
 await check('Studio records remaining payment through same RPC',async()=>{
  const d=await member.data.listInvoices(wa),i=d.invoices.find(i=>i.id===createdId);
  await member.data.recordPayment(wa,{invoice:i,amountCents:40000,cashDate:'2026-09-27',expectedDataRevision:d.dataRevision},randomUUID());
  const paid=await a.data.readInvoice(wa,createdId);
  assert.equal(paid.paid,120001);assert.equal(paid.residual,0);assert.equal(paid.payments.length,2);assert.equal(paid.components[0].allocated,120001);
 });
 await check('cash total uses persisted payments only',async()=>assert.equal((await a.data.listInvoices(wa)).received-before.received,120001));
 for(const [name,s]of [['contributor B',b],['Studio B',other]]){
  await check(name+' denied A via service',()=>assert.rejects(s.data.listInvoices(wa),{code:'forbidden'}));
  await check(name+' known UUID filtered by actual RLS',async()=>{
   for(const t of ['invoice','invoice_component','payment','allocation'])assert.deepEqual(await raw(s,t,s.auth.getState().selected.context_type+':'+s.auth.getState().selected.context_id,{workspace_id:'eq.'+wa}),[]);
  });
 }
 await check('forced personal/Studio context gives no access',async()=>{
  assert.deepEqual(await raw(a,'invoice','personal:'+wb,{workspace_id:'eq.'+wb}),[]);
  assert.deepEqual(await raw(b,'invoice','personal:'+wa,{workspace_id:'eq.'+wa}),[]);
  assert.deepEqual(await raw(other,'invoice','studio:'+sa.context_id,{workspace_id:'eq.'+wa}),[]);
 });
 await check('dual personal context cannot read Studio invoices',async()=>{
  await dual.auth.choose(dual.contexts.find(c=>c.context_type==='personal'));
  await assert.rejects(dual.data.listInvoices(wa),{code:'forbidden'});
  assert.deepEqual(await raw(dual,'invoice','personal:'+dual.auth.getState().selected.context_id,{workspace_id:'eq.'+wa}),[]);
 });
 await check('dual Studio context sees authorized invoice only',async()=>{
  await dual.auth.choose(dual.contexts.find(c=>c.context_type==='studio'));
  assert.equal((await dual.data.readInvoice(wa,createdId)).paid,120001);
  await assert.rejects(dual.data.listInvoices(wb),{code:'forbidden'});
 });
 await check('anon reads and RPC denied',async()=>{
  for(const [path,method,body]of [['invoice?select=id','GET',undefined],['rpc/tal_create_invoice','POST',{p_workspace_id:wa,p_context:'personal:'+wa,p_idempotency_key:randomUUID(),p_payload:{}}]]){
   const r=await fetch(config.supabaseUrl+'/rest/v1/'+path,{method,headers:{apikey:config.publishableKey,...(method==='GET'?{'Accept-Profile':'tal'}:{'Content-Profile':'public','Content-Type':'application/json'})},body:body?JSON.stringify(body):undefined});
   assert.ok([401,403].includes(r.status));await r.body?.cancel();
  }
 });
 await check('direct table write denied',async()=>a.auth.withContextSession(async session=>{
  const r=await fetch(config.supabaseUrl+'/rest/v1/invoice?id=eq.'+createdId,{method:'PATCH',headers:{apikey:config.publishableKey,Authorization:'Bearer '+session.token,'Content-Profile':'tal','Content-Type':'application/json','x-tal-context':'personal:'+wa},body:JSON.stringify({workspace_id:wb})});
  assert.equal(r.status,403);await r.body?.cancel();
 }));
 let originalToken;
 await member.auth.withContextSession(async session=>{
  originalToken=session.token;
  const r=await fetch(config.supabaseUrl+'/rest/v1/studio_client_link?select=id,workspace_id,revision&status=eq.active',{headers:{apikey:config.publishableKey,Authorization:'Bearer '+session.token,'Accept-Profile':'tal','x-tal-context':'studio:'+sa.context_id}});
  assert.equal(r.status,200);const links=await r.json();assert.equal(links.length,1);console.log('REVOKE '+JSON.stringify(links[0]));
 });
 assert.equal((await lines.next()).value,'REVOKED');
 await check('identical JWT after link revoked',()=>member.auth.withContextSession(session=>assert.equal(session.token,originalToken)));
 await check('next invoice read denied immediately',()=>assert.rejects(member.data.listInvoices(wa),{code:'forbidden'}));
 await check('known invoice and payments filtered after revoke',async()=>{
  assert.deepEqual(await raw(member,'invoice','studio:'+sa.context_id,{id:'eq.'+createdId}),[]);
  assert.deepEqual(await raw(member,'payment','studio:'+sa.context_id,{invoice_id:'eq.'+createdId}),[]);
 });
 await check('revoked Studio financial write denied',()=>assert.rejects(member.data.createInvoice(wa,input,randomUUID()),{code:'forbidden'}));
 await check('owner retains access after link revocation',async()=>assert.equal((await a.data.readInvoice(wa,createdId)).paid,120001));
 console.log('RESTORE');assert.equal((await lines.next()).value,'RESTORED');
 await check('restored Studio sees same persisted invoice',async()=>assert.equal((await member.data.readInvoice(wa,createdId)).paid,120001));
 await check('resume earlier S08 synthetic invoice without recreating it',async()=>{
  const d=await member.data.listInvoices(wa),old=d.invoices.find(i=>i.number.startsWith('S08-SYNTHETIC-HOSTED-')&&i.residual>0);
  if(old){assert.equal(old.residual,40000);await member.data.recordPayment(wa,{invoice:old,amountCents:40000,cashDate:'2026-09-27',expectedDataRevision:d.dataRevision},randomUUID());assert.equal((await a.data.readInvoice(wa,old.id)).residual,0);}
 });
 originalToken=null;
 console.log(JSON.stringify({passed:results.length,results,conflicts,created:{invoiceId:createdId,payments:2,amountCents:120001},credentials:'publishable + user JWT only'}));
} catch(error) {console.log(JSON.stringify({failed:current,code:error?.code||error?.name||'unknown',createdId}));process.exitCode=1;}
finally{credentials=null;for(const s of subjects.values())await s.auth.logout();process.stdin.destroy();}
