// Test only. Synthetic passwords arrive via stdin; no tokens/provider bodies in output.
// --dynamic is controlled by a local test orchestrator, never by the browser.
import assert from 'node:assert/strict';
import { createInterface } from 'node:readline';
import config from './config.local.js';
import { createAuthContextService } from './auth-context-service.js';
import { createTalDataService } from './tal-data-service.js';
const dynamic=process.argv.includes('--dynamic');
let credentials, input='';
let lines;
if(dynamic){lines=createInterface({input:process.stdin,crlfDelay:Infinity})[Symbol.asyncIterator]();credentials=JSON.parse((await lines.next()).value);}
else {for await(const part of process.stdin)input+=part;credentials=JSON.parse(input);input='';}
const memory=()=>{const m=new Map();return {getItem:k=>m.get(k)||null,setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k)};};
const subjects=new Map(),results=[],calls=[];
const check=(name,fn)=>{fn();results.push({test:name,result:'PASS'});};
try {
 for(const [name,c] of Object.entries(credentials)){
  const auth=createAuthContextService({config,fetchImpl:fetch,storage:memory(),preferenceStorage:memory(),lock:(_k,fn)=>fn()});
  await auth.login(c.email,c.password);assert.ok(['ready','choosing'].includes(auth.getState().phase));
  const data=createTalDataService({auth,fetchImpl:(url,opts)=>{calls.push({path:new URL(url).pathname,method:opts.method,body:opts.body});return fetch(url,opts)}});
  subjects.set(name,{auth,data,contexts:auth.getState().contexts});
 }
 const a=subjects.get('contribuente-a'),b=subjects.get('contribuente-b'),dual=subjects.get('dual-role');
 const admin=subjects.get('studio-a-admin'),member=subjects.get('studio-a-professionista'),other=subjects.get('studio-b-admin');
 const wa=a.contexts[0].context_id,wb=b.contexts[0].context_id,sa=admin.contexts[0],sb=other.contexts[0];
 for(const [name,s] of subjects){
  for(const context of s.contexts){
   if(s.auth.getState().selected?.context_id!==context.context_id)await s.auth.choose(context);
   const d=await s.data.loadContext();
   const expected=context.context_type==='personal'?[context.context_id]:context.context_id===sa.context_id?[wa]:[];
   check(name+' / '+context.context_type,()=>{assert.deepEqual(d.positions.map(p=>p.id).sort(),expected.sort());assert.equal(d.source,'cloud');assert.ok(d.positions.every(p=>p.label.startsWith('SYNTHETIC')));});
   if(context.context_type==='personal')check(name+' structural empty states',()=>{assert.ok(d.positions.every(p=>p.startDate===null&&p.studioReference===null&&!p.activities.length));assert.deepEqual(d.positions[0].years.map(y=>y.year),context.context_id===wa?[2026]:[]);});
  }
 }
 await assert.rejects(a.data.readPosition(wb),{code:'forbidden'});
 check('A cannot read B by known UUID',()=>{});
 await assert.rejects(other.data.readPosition(wa),{code:'forbidden'});
 check('Studio B cannot read A by known UUID',()=>{});
 async function raw(s,table,context,workspaceId){
  return s.auth.withContextSession(async session=>{
   const query=new URLSearchParams({select:'id',...(workspaceId?{id:'eq.'+workspaceId}:{})});
   const response=await fetch(config.supabaseUrl+'/rest/v1/'+table+'?'+query,{headers:{apikey:config.publishableKey,Authorization:'Bearer '+session.token,'Accept-Profile':'tal','x-tal-context':context},cache:'no-store'});
   assert.equal(response.status,200);return response.json();
  });
 }
 for(const [name,s,ctx,w] of [
  ['A forced personal B',a,'personal:'+wb,wb],['A forced Studio A',a,'studio:'+sa.context_id,wa],
  ['Studio A forced Studio B',admin,'studio:'+sb.context_id,wa],['Studio B known A',other,'studio:'+sb.context_id,wa],
  ['malformed context',admin,'studio:invalid',wa],
 ]){
  const rows=await raw(s,'tax_workspace',ctx,w);check(name,()=>assert.deepEqual(rows,[]));
 }
 await dual.auth.choose(dual.contexts.find(c=>c.context_type==='personal'));
 check('dual personal excludes Studio clients',()=>assert.notEqual(dual.auth.getState().selected.context_id,wa));
 assert.deepEqual(await raw(dual,'tax_workspace','personal:'+dual.auth.getState().selected.context_id,wa),[]);
 await dual.auth.choose(sa);const dualStudio=await dual.data.loadContext();
 check('dual Studio excludes personal workspace',()=>assert.deepEqual(dualStudio.positions.map(p=>p.id),[wa]));
 const anon=await fetch(config.supabaseUrl+'/rest/v1/tax_workspace?select=id',{headers:{apikey:config.publishableKey,'Accept-Profile':'tal'}});
 check('missing JWT denied',()=>assert.ok([401,403].includes(anon.status)));await anon.body?.cancel();
 if(dynamic){
  let originalToken;
  await member.auth.withContextSession(async session=>{
   originalToken=session.token;
   const r=await fetch(config.supabaseUrl+'/rest/v1/studio_client_link?select=id,workspace_id,revision&status=eq.active',{headers:{apikey:config.publishableKey,Authorization:'Bearer '+session.token,'Accept-Profile':'tal','x-tal-context':'studio:'+sa.context_id}});
   assert.equal(r.status,200);const links=await r.json();assert.equal(links.length,1);
   console.log('REVOKE '+JSON.stringify(links[0]));
  });
  assert.equal((await lines.next()).value,'REVOKED');
  await member.auth.withContextSession(session=>check('identical JWT before and after revoke',()=>assert.equal(session.token,originalToken)));
  const after=await member.data.loadContext();
  check('same session after administrative link revocation',()=>assert.deepEqual(after.positions,[]));
  await assert.rejects(member.data.readPosition(wa),{code:'forbidden'});
  check('revoked known workspace denied',()=>{});
  console.log('RESTORE');
  assert.equal((await lines.next()).value,'RESTORED');
  check('original portfolio restored',()=>{});
  assert.deepEqual((await member.data.loadContext()).positions.map(p=>p.id),[wa]);
  originalToken=null;
 }
 check('data service exclusively GET to six structural tables',()=>{
  const allowed=['tax_workspace','tax_year','economic_activity','studio','studio_client_link','studio_client_private'];
  assert.ok(calls.every(c=>c.method==='GET'&&!c.body&&allowed.includes(c.path.split('/').at(-1))));
 });
 console.log(JSON.stringify({passed:results.length,results,dataRequests:calls.length,applicationWrites:0}));
} finally {
 credentials=null;
 for(const s of subjects.values())await s.auth.logout();
 if(dynamic)process.stdin.destroy();
}
