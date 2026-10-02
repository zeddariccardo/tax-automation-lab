import test from 'node:test';import assert from 'node:assert/strict';
import {nextPayment,nextPaymentView,overdue,paymentRecords,workflowActions,clientWorkflow,localDay} from './workflow-view.js';
import {createPaymentsService} from './payments-service.js';
import {readFile} from 'node:fs/promises';
import {collaborationView} from './collaboration-view.js';
const group={key:'g',status:'READY',dueDate:'2026-06-30',totalCents:12345};
const helpers={href:'#/io/pagamenti',esc:String,euro:n=>n+' cents'};
test('home uses actual unpaid F24, not forecast; no zero invented',()=>{
 assert.equal(nextPayment(null),null);assert.equal(nextPayment({draft:{groups:[{...group,status:'PAID'}]}}),null);
 const g=nextPayment({result:{groups:[{...group,dueDate:'2026-11-30'},group]}});assert.equal(g.dueDate,'2026-06-30');assert.equal(g.totalCents,12345);
 assert.doesNotMatch(nextPaymentView(null,helpers),/0 cents/);
});
test('stale or incomplete payment never renders an actionable old amount',()=>{
 for(const status of ['STALE','BLOCKED','DRAFT'])assert.doesNotMatch(nextPaymentView({payments:{result:{groups:[{...group,status}]}}},helpers),/12345 cents/);
});
test('overdue is based on Rome civil day and paid state',()=>{
 assert.equal(localDay(new Date('2026-06-30T22:30:00Z')),'2026-07-01');
 assert.equal(overdue(group,'2026-06-30'),false);assert.equal(overdue(group,'2026-07-01'),true);assert.equal(overdue({...group,status:'PAID'},'2026-07-01'),false);
});
test('documented F24 remains visible across draft regeneration; lines counted once',()=>{
 const r=paymentRecords({paymentReconciliation:{payments:[{eventId:'one',paidDate:'2026-07-01',amountCents:101},{eventId:'one',paidDate:'2026-07-01',amountCents:202},{eventId:'pension:x',paidDate:'2026-07-01',amountCents:400}]}});
 assert.equal(r.length,1);assert.equal(r[0].amountCents,303);
 assert.throws(()=>paymentRecords({paymentReconciliation:{payments:[{eventId:'x',amountCents:0.1}]}}));
});
test('Studio queue exposes explicit rechecks and pension blockers, no duplicate payment task',()=>{
 const actions=workflowActions({reviewStale:true,paymentReviewStale:true,pensionMissing:false,declaration:{workflow:{blockers:[{code:'RR_AC_DETAIL'}]}},payments:{result:{groups:[{...group,status:'STALE'}]}}});
 assert.deepEqual(actions.map(a=>a.page),['dichiarazione','pagamenti','tasse']);
 assert.match(actions[0].label,/Riconferma/);
});
test('healthy supported position creates no phantom exception',()=>{
 assert.deepEqual(workflowActions({declaration:{current:true,workflow:{state:'prepared',blockers:[]}},payments:{result:{groups:[group]}},pensionMissing:false}),[]);
});
test('workflow transport rejects missing/foreign scope and uses user session',async()=>{
 const id='17000000-0000-4000-8000-000000000001';let seen;
 const auth={withContextSession:f=>f({context:{context_type:'personal',context_id:id},config:{supabaseUrl:'https://example.test',publishableKey:'synthetic'},token:'synthetic'})};
 let result={workspaceId:id};const service=createPaymentsService({auth,fetchImpl:async(url,o)=>{seen={url,o};return Response.json(result);}});
 assert.deepEqual(await service.readWorkflow(id),result);assert.equal(seen.o.cache,'no-store');assert.equal(seen.o.headers['x-tal-context'],'personal:'+id);
 result=null;await assert.rejects(service.readWorkflow(id),{code:'forbidden'});result={workspaceId:'other'};await assert.rejects(service.readWorkflow(id),{code:'forbidden'});
});
test('static HTML and local server both permit exactly the new RPC paths',async()=>{
 const html=await readFile(new URL('./index.html',import.meta.url),'utf8'),server=await readFile(new URL('./serve-dev.mjs',import.meta.url),'utf8');
 for(const rpc of ['tal_workflow_summary','tal_request_fact_document','tal_reopen_document_request','tal_resolve_document_fact','tal_record_pension_movement']){
  assert.ok(html.includes('https://*.supabase.co/rest/v1/rpc/'+rpc));assert.ok(server.includes('"rpc/'+rpc+'"'));
 }
 assert.doesNotMatch(html,/connect-src\s+\*/);
});
test('Studio client summary shows submitted document action, never false no-request message',()=>{
 const html=collaborationView({r:{id:'w',role:'studio'},mode:'today',state:{phase:'ready',data:[{workspaceId:'w',documents:[{id:'doc',original_filename:'synthetic.pdf'}],activities:[{id:'r',kind:'request_upload',status:'submitted',actor_context:'studio:s',recipient_context:'personal:w',document_id:'doc',body:'Ricevuta',created_at:'2026-10-01T00:00:00Z'}]}]},access:{selected:{context_type:'studio',context_id:'s'}},positions:[],heading:()=>'',link:()=>'',href:()=>'',button:(_a,t)=>t,esc:String,icon:()=>''});
 assert.match(html,/Verifica documento/);assert.doesNotMatch(html,/Non hai richieste/);
});
