import test from 'node:test';
import assert from 'node:assert/strict';
import { createTalDataService, createTalDataController } from './tal-data-service.js';
import { createAuthContextService } from './auth-context-service.js';
import { createDemoService } from './demo-service.js';
const id = n => '00000000-0000-4000-8000-' + String(n).padStart(12,'0');
const personal = {context_type:'personal',context_id:id(1),label:'La mia attività'};
const studio = {context_type:'studio',context_id:id(2),label:'Studio sintetico'};
function harness(context=personal, options={}) {
  const h={calls:[],revoked:false,...options};
  const auth={withContextSession:fn=>fn({config:{supabaseUrl:'https://example.test',publishableKey:'public-test'},token:'synthetic.token.only',context})};
  const tables={
    tax_workspace:[{id:id(1),label:'SYNTHETIC A',start_date:null,status:'active'}],
    tax_year:[{id:id(3),workspace_id:id(1),year:2026}],
    economic_activity:[],
    studio:[{id:id(2),name:'Studio sintetico',status:'verified'}],
    studio_client_link:[{id:id(4),workspace_id:id(1),studio_id:id(2),status:'active'}],
    studio_client_private:[{id:id(5),workspace_id:id(1),studio_id:id(2),link_id:id(4),reference:null}],
  };
  const fetchImpl=async(url,opts)=>{
    h.calls.push({url,opts});
    if(h.pause)await h.pause;
    if(h.network)throw Error('offline');
    if(h.status)return new Response('{}',{status:h.status});
    const u=new URL(url), table=u.pathname.split('/').at(-1);
    let rows=structuredClone(h.tables?.[table]||tables[table]);
    if(h.revoked&&['tax_workspace','studio_client_link','studio_client_private','tax_year'].includes(table))rows=[];
    const eq=u.searchParams.get('id');
    if(eq)rows=rows.filter(r=>'eq.'+r.id===eq);
    const offset=Number(u.searchParams.get('offset')), total=rows.length;
    const page=rows.slice(offset,offset+(h.pageSize||200));
    return new Response(JSON.stringify(h.malformed?{}:page),{headers:{'content-range':total?offset+'-'+(offset+page.length-1)+'/'+total:'*/0'}});
  };
  h.service=createTalDataService({auth,fetchImpl});return h;
}
test('personal cloud structures, empty activities, null remains null and no demo facts',async()=>{
 const h=harness(), d=await h.service.loadContext();
 assert.equal(d.source,'cloud');assert.equal(d.positions[0].label,'SYNTHETIC A');
 assert.equal(d.positions[0].startDate,null);assert.equal(d.positions[0].studioReference,null);
 assert.deepEqual(d.positions[0].years.map(y=>y.year),[2026]);assert.deepEqual(d.positions[0].activities,[]);
 assert.doesNotMatch(JSON.stringify(d),/Mario|received|invoices|forecast|notes|facts/);
 assert.equal(h.calls.length,3);
});
test('every data call is GET, explicit tal/context/JWT, no cache; projection excludes fiscal facts',async()=>{
 const h=harness(studio);await h.service.loadContext();
 for(const {url,opts} of h.calls){assert.equal(opts.method,'GET');assert.equal(opts.body,undefined);assert.equal(opts.cache,'no-store');assert.equal(opts.headers['Accept-Profile'],'tal');assert.equal(opts.headers['x-tal-context'],'studio:'+id(2));assert.equal(opts.headers.Authorization,'Bearer synthetic.token.only');assert.ok(!url.includes('synthetic.token'));assert.doesNotMatch(new URL(url).searchParams.get('select'),/(^|,)(facts|identity|\*)(,|$)/);}
});
test('Studio portafoglio only linked accessible workspace; private alias scoped to matching link',async()=>{
 const h=harness(studio,{tables:{tax_workspace:[{id:id(1),label:'A'},{id:id(99),label:'unlinked'}],studio_client_private:[{id:id(5),workspace_id:id(1),studio_id:id(2),link_id:id(99),reference:'FOREIGN'}]}});
 const d=await h.service.loadContext();assert.deepEqual(d.positions.map(p=>p.id),[id(1)]);assert.equal(d.positions[0].studioReference,null);
});
test('revoked link disappears on next read with same JWT; no retained portfolio',async()=>{
 const h=harness(studio);assert.equal((await h.service.loadContext()).positions.length,1);h.revoked=true;
 assert.deepEqual((await h.service.loadContext()).positions,[]);assert.equal(new Set(h.calls.map(c=>c.opts.headers.Authorization)).size,1);
});
test('missing Studio/membership is forbidden; an empty portfolio remains valid',async()=>{
 const h=harness(studio);h.revoked=true;assert.deepEqual((await h.service.loadContext()).positions,[]);
 const denied=harness(studio,{tables:{studio:[]}});await assert.rejects(denied.service.loadContext(),{code:'forbidden'});
});
test('arbitrary workspace read cannot turn empty RLS response into a position',async()=>{
 for(const context of [personal,studio]){const h=harness(context);await assert.rejects(h.service.readPosition(id(999)),{code:'forbidden'});}
});
test('invalid context/UUID fails before network',async()=>{
 const h=harness({...personal,context_id:'bad'});await assert.rejects(h.service.loadContext(),{code:'forbidden'});assert.equal(h.calls.length,0);
 const good=harness();await assert.rejects(good.service.readPosition('bad'),{code:'forbidden'});assert.equal(good.calls.length,0);
});
for(const [status,code] of [[401,'expired'],[403,'forbidden'],[404,'missing'],[500,'unavailable']])test('HTTP '+status+' controlled, no provider payload retained',async()=>{await assert.rejects(harness(personal,{status}).service.loadContext(),{code});});
test('network and malformed response fail closed',async()=>{
 for(const options of [{network:true},{malformed:true}])await assert.rejects(harness(personal,options).service.loadContext(),{code:'unavailable'});
});
test('paginated reads keep all years with stable order, not only first server page',async()=>{
 const h=harness(personal,{pageSize:1,tables:{tax_year:[2024,2025,2026].map((year,i)=>({id:id(10+i),workspace_id:id(1),year}))}});
 assert.deepEqual((await h.service.loadContext()).positions[0].years.map(y=>y.year),[2026,2025,2024]);
});
test('unknown identity fields omitted; valid ATECO and start date preserved, invalid date absent',async()=>{
 const h=harness(personal,{tables:{tax_workspace:[{id:id(1),label:'A',start_date:'2026-02-31',email:'private'}],economic_activity:[{id:id(6),workspace_id:id(1),ateco_code:'69.20.01',notes:'private'}]}});
 const p=(await h.service.loadContext()).positions[0];assert.equal(p.startDate,null);assert.equal(p.activities[0].atecoCode,'69.20.01');assert.equal(p.email,undefined);
 const valid=harness(personal,{tables:{tax_workspace:[{id:id(1),start_date:'2026-01-01'}]}});assert.equal((await valid.service.loadContext()).positions[0].startDate,'2026-01-01');
});
test('fiscal demo instances cannot contaminate another cloud position',()=>{
 const a=createDemoService(),b=createDemoService();a.addInvoice('mario',90000);assert.equal(a.getPosition('mario').invoices.length,b.getPosition('mario').invoices.length+1);
});
test('Auth context session port refuses anonymous calls and ignores late reads after logout',async()=>{
 const m=new Map(),storage={getItem:k=>m.get(k)||null,setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k)};
 const fetchImpl=async(url)=>new Response(JSON.stringify(url.includes('/token')?{access_token:'test.token.only',refresh_token:'unit',expires_in:3600,user:{id:id(100)}}:url.includes('/user')?{id:id(100)}:url.includes('/rpc/')?[personal]:null));
 const auth=createAuthContextService({config:{supabaseUrl:'https://aaaaaaaaaaaaaaaaaaaa.supabase.co',publishableKey:'sb_publishable_'+'x'.repeat(25)},fetchImpl,storage,preferenceStorage:storage,lock:(_k,fn)=>fn()});
 await assert.rejects(auth.withContextSession(()=>null),{code:'forbidden'});
 await auth.login('synthetic@example.test','unit');
 let release,started;const inFlight=new Promise(r=>started=r);
 const read=auth.withContextSession(async()=>{started();await new Promise(r=>release=r);return 'private';});
 await inFlight;await auth.logout();release();await assert.rejects(read,{code:'stale'});
});
const settle=()=>new Promise(resolve=>setImmediate(resolve));
function controllerHarness(){
 let listener;const pending=[];
 const auth={subscribe(fn){listener=fn;fn({phase:'signed-out'});}};
 const cloud=createTalDataController({auth,service:{loadContext:()=>new Promise((resolve,reject)=>pending.push({resolve,reject}))}});
 const ready=context=>listener({phase:'ready',user:{id:id(100)},selected:context});
 return {cloud,pending,ready,logout:()=>listener({phase:'signed-out'})};
}
test('controller exposes loading then ready, same-context reread removes revoked client',async()=>{
 const h=controllerHarness();h.ready(studio);assert.equal(h.cloud.getState().phase,'loading');
 h.pending[0].resolve({positions:[{id:id(1)}]});await settle();assert.equal(h.cloud.getState().phase,'ready');
 const refresh=h.cloud.refresh();h.pending[1].resolve({positions:[]});await refresh;assert.deepEqual(h.cloud.getState().data.positions,[]);
});
test('controller discards personal read completed after switch to Studio',async()=>{
 const h=controllerHarness();h.ready(personal);h.ready(studio);
 h.pending[0].resolve({positions:[{id:id(1)}]});await settle();assert.equal(h.cloud.getState().data,null);
 h.pending[1].resolve({positions:[]});await settle();assert.deepEqual(h.cloud.getState().data.positions,[]);
});
test('controller removes stale cloud data on network error and supports retry',async()=>{
 const h=controllerHarness();h.ready(personal);h.pending[0].resolve({positions:[{id:id(1)}]});await settle();
 const refresh=h.cloud.refresh();h.pending[1].reject({code:'unavailable'});await refresh;
 assert.deepEqual(h.cloud.getState(),{phase:'error',data:null});
 const retry=h.cloud.refresh();assert.equal(h.cloud.getState().phase,'loading');h.pending[2].resolve({positions:[]});await retry;assert.equal(h.cloud.getState().phase,'ready');
});
test('controller clears data after 403 and after logout; late response never reopens position',async()=>{
 const h=controllerHarness();h.ready(personal);h.pending[0].reject({code:'forbidden'});await settle();assert.deepEqual(h.cloud.getState(),{phase:'forbidden',data:null});
 h.cloud.refresh();h.logout();h.pending[1].resolve({positions:[{id:id(1)}]});await settle();assert.deepEqual(h.cloud.getState(),{phase:'idle',data:null});
});
