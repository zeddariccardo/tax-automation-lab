import test from 'node:test';
import assert from 'node:assert/strict';
import {createImportService} from './import-service.js';
const w='00000000-0000-4000-8000-000000000001';
function setup(){
 const h={calls:[],receipts:new Map(),lose:false,deny:false};
 const state={user:{id:'synthetic-actor'},selected:{context_type:'personal',context_id:w}};
 const session={config:{supabaseUrl:'https://example.test',publishableKey:'public-test'},context:state.selected,token:'synthetic-test-only'};
 const auth={getState:()=>state,withContextSession:fn=>fn(session),withIdentitySession:fn=>fn({...session,context:null})};
 h.service=createImportService({auth,rows:async()=>[],fetchImpl:async(url,opts)=>{
  h.calls.push({url,opts});if(h.deny)return new Response('{}',{status:403});
  const p=JSON.parse(opts.body),key=p.p_idempotency_key;
  let result=h.receipts.get(key);if(!result){result={targets:[{workspaceId:w,dataRevision:1,inserted:4,existing:0}]};h.receipts.set(key,result);}
  if(h.lose){h.lose=false;throw Error('response lost');}return new Response(JSON.stringify(result));
 }});return h;
}
const payload={version:1,targets:[{workspaceId:w,expectedDataRevision:0,graph:{invoices:[{id:'synthetic'}]}}]};
test('import double-submit coalesces one exact frozen command',async()=>{
 const h=setup(),p=structuredClone(payload),a=h.service.commitImport(p,'same'),b=h.service.commitImport(p,'same');p.targets=[];
 assert.deepEqual(await a,await b);assert.equal(h.calls.length,1);assert.deepEqual(JSON.parse(h.calls[0].opts.body).p_payload,payload);
});
test('response lost retries identical key and payload without another receipt',async()=>{
 const h=setup();h.lose=true;await assert.rejects(h.service.commitImport(payload,'retry'),{code:'uncertain'});
 await h.service.commitImport(payload,'retry');assert.equal(h.receipts.size,1);assert.equal(h.calls[0].opts.body,h.calls[1].opts.body);
});
test('an altered in-flight import cannot reuse the same key',async()=>{
 const h=setup(),p=h.service.commitImport(payload,'key');assert.throws(()=>h.service.commitImport({version:1,targets:[]},'key'),{code:'idempotency'});await p;
});
test('retry after revocation still reaches current authorization and fails closed',async()=>{
 const h=setup();await h.service.commitImport(payload,'key');h.deny=true;await assert.rejects(h.service.commitImport(payload,'key'),{code:'forbidden'});
});
test('bootstrap needs identity session, no context or secret credentials',async()=>{
 const h=setup();await h.service.migratePersonal({original:{synthetic:true}},'bootstrap');const c=h.calls[0];
 assert.ok(c.url.endsWith('/rpc/tal_migrate_personal'));assert.equal(c.opts.headers['x-tal-context'],undefined);assert.equal(c.opts.headers.apikey,'public-test');assert.equal(c.opts.credentials,'omit');assert.equal(c.opts.cache,'no-store');
});
