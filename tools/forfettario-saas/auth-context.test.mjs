import test from 'node:test';
import assert from 'node:assert/strict';
import { createAuthContextService, validateConfig } from './auth-context-service.js';
import { demoService } from './demo-service.js';
// Deliberately fake tokens and reserved synthetic identifiers; never hosted credentials.
const uid = '00000000-0000-4000-8000-000000000001';
const personal = {context_type:'personal',context_id:'00000000-0000-4000-8000-000000000002',label:'La mia attività'};
const studio = {context_type:'studio',context_id:'00000000-0000-4000-8000-000000000003',label:'Studio sintetico'};
const outsider = {context_type:'studio',context_id:'00000000-0000-4000-8000-000000000004'};
const config = {supabaseUrl:'https://aaaaaaaaaaaaaaaaaaaa.supabase.co',publishableKey:'sb_publishable_'+'x'.repeat(25)};
const memory = () => { const m = new Map(); return { getItem:k=>m.get(k) || null,setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k),m }; };
const mutex = () => { let last = Promise.resolve(); return (_key, work) => { const next = last.catch(()=>{}).then(work); last=next; return next; }; };
function harness(options={}) {
  const storage=options.storage || memory(), preferenceStorage=options.preferenceStorage || memory(), lock=options.lock || mutex();
  const h={calls:[],contexts:[personal],clock:100000,refreshes:0,fail:null,...options};
  const reply=(data,status=200)=>new Response(JSON.stringify(data),{status});
  const token=()=>({access_token:'synthetic.token.'+(++h.refreshes),refresh_token:'synthetic-refresh-'+h.refreshes,expires_in:3600,user:{id:uid}});
  const fetchImpl=async(url,opts)=>{
    const path=new URL(url).pathname;
    h.calls.push({url,opts});
    if (h.pause && path.includes('/rpc/')) await h.pause;
    if(h.fail?.(path,opts)) return reply({error:'redacted provider error'},h.fail(path,opts));
    if(path==='/auth/v1/token') return reply(token());
    if(path==='/auth/v1/user') return reply({id:uid,email:'synthetic@example.test'});
    if(path==='/rest/v1/rpc/tal_list_my_contexts') return reply(h.contexts);
    if(path==='/auth/v1/logout') return new Response(null,{status:204});
    throw new Error('Unexpected endpoint');
  };
  const service=createAuthContextService({config,fetchImpl,storage,preferenceStorage,lock,now:()=>h.clock});
  return Object.assign(h,{service,storage,preferenceStorage,lock,fetchImpl});
}
const login=h=>h.service.login('synthetic@example.test','unit-test-only');

test('missing or invalid config is controlled and sends no request',async()=>{
  for(const c of [null,{}, {...config,supabaseUrl:'http://example.test'}, {...config,publishableKey:'not-public'}, {...config,supabaseUrl:config.supabaseUrl+'/other'}]){
    const s=createAuthContextService({config:c}); await s.restore(); assert.equal(s.getState().phase,'config-error');
  }
  assert.deepEqual(validateConfig(config),config);
});
test('single context auto entry; service state never exposes tokens',async()=>{
  const h=harness(); await login(h); assert.deepEqual(h.service.getState().selected,personal);
  assert.doesNotMatch(JSON.stringify(h.service.getState()),/synthetic.token|refresh_token/);
  assert.equal(h.calls.filter(c=>c.url.includes('/rpc/')).length,1);
});
test('dual context requires explicit choice and never combines them',async()=>{
  const h=harness({contexts:[personal,studio]}); await login(h); assert.equal(h.service.getState().phase,'choosing');
  await h.service.choose(studio); assert.deepEqual(h.service.getState().selected,studio);
  await h.service.chooseAgain(); assert.equal(h.service.getState().selected,null);
  await h.service.choose(personal); assert.deepEqual(h.service.getState().selected,personal);
});
test('zero contexts has a controlled state; no provisioning',async()=>{
  const h=harness({contexts:[]}); await login(h); assert.equal(h.service.getState().phase,'empty');
  assert.equal(h.calls.length,3);
});
test('reload verifies user and discovery before exposing any position',async()=>{
  const h=harness(); await login(h);
  const next=harness({storage:h.storage,preferenceStorage:h.preferenceStorage});
  assert.equal(next.service.getState().phase,'loading'); await next.service.restore();
  assert.equal(next.service.getState().phase,'ready');
  assert.equal(next.calls.filter(c=>c.url.includes('/token')).length,0);
});
test('revoked membership disappears with the same unexpired token',async()=>{
  const h=harness({contexts:[studio]}); await login(h); const tokenBefore=h.storage.getItem(h.service.sessionKey);
  h.contexts=[]; await h.service.revalidate();
  assert.equal(h.service.getState().phase,'empty'); assert.equal(h.service.getState().selected,null);
  assert.equal(h.storage.getItem(h.service.sessionKey),tokenBefore);
});
test('forged Studio and personal UUIDs are not selected or sent to RPC',async()=>{
  const h=harness({contexts:[personal,studio]}); await login(h);
  for(const context_type of ['studio','personal']){
    await h.service.choose({...outsider,context_type}); assert.equal(h.service.getState().selected,null);
    assert.equal(h.calls.at(-1).opts.body,'{}');
    assert.ok(!h.calls.at(-1).opts.headers['x-tal-context']);
  }
});
test('stored context absent from fresh discovery is discarded',async()=>{
  const h=harness({contexts:[personal,studio]}); await login(h); await h.service.choose(studio);
  h.contexts=[personal]; await h.service.restore();
  assert.deepEqual(h.service.getState().selected,personal);
  assert.ok(!h.preferenceStorage.getItem(h.service.contextKey).includes(studio.context_id));
});
test('cached preference belonging to a different user is ignored',async()=>{
  const h=harness({contexts:[personal,studio]}); await login(h);
  h.preferenceStorage.setItem(h.service.contextKey,JSON.stringify({...studio,userId:outsider.context_id}));
  await h.service.restore(); assert.equal(h.service.getState().phase,'choosing');
});
test('expired session refreshes under lock and rotates stored tokens',async()=>{
  const h=harness(); await login(h); const before=h.storage.getItem(h.service.sessionKey);
  h.clock+=3600000; await h.service.revalidate();
  assert.equal(h.refreshes,2); assert.notEqual(h.storage.getItem(h.service.sessionKey),before);
  assert.equal(h.service.getState().phase,'ready');
});
test('concurrent tabs serialize refresh and reuse the rotated session',async()=>{
  const h=harness(); await login(h); h.clock+=3600000;
  const second=createAuthContextService({config,fetchImpl:h.fetchImpl,storage:h.storage,preferenceStorage:memory(),lock:h.lock,now:()=>h.clock});
  await Promise.all([h.service.revalidate(),second.restore()]);
  assert.equal(h.refreshes,2); assert.equal(second.getState().phase,'ready');
});
test('invalid refresh fails closed and removes persisted session',async()=>{
  const h=harness(); await login(h); h.clock+=3600000; h.fail=p=>p==='/auth/v1/token'?400:0;
  await h.service.revalidate(); assert.equal(h.service.getState().phase,'signed-out');
  assert.equal(h.storage.getItem(h.service.sessionKey),null);
});
test('logout hides content immediately and clears session and choice',async()=>{
  const h=harness(); await login(h); const promise=h.service.logout();
  assert.equal(h.service.getState().selected,null); await promise;
  assert.equal(h.storage.getItem(h.service.sessionKey),null); assert.equal(h.preferenceStorage.getItem(h.service.contextKey),null);
  assert.ok(h.calls.at(-1).url.endsWith('/logout?scope=local'));
});
test('logout clears local content even if remote logout is unavailable',async()=>{
  const h=harness(); await login(h); h.fail=p=>p==='/auth/v1/logout'?503:0;
  await h.service.logout(); assert.equal(h.service.getState().phase,'signed-out'); assert.equal(h.storage.getItem(h.service.sessionKey),null);
  assert.match(h.service.getState().message,/Non abbiamo potuto/);
});
test('late discovery cannot restore content after logout',async()=>{
  const h=harness(); await login(h); let release; h.pause=new Promise(r=>release=r);
  const pending=h.service.revalidate();
  await new Promise(r=>setTimeout(r,10)); await h.service.logout(); release(); await pending;
  assert.equal(h.service.getState().phase,'signed-out');
});
test('credential errors are generic for wrong password and unknown email',async()=>{
  for(const code of [400,401,422]){
    const h=harness({fail:p=>p==='/auth/v1/token'?code:0}); await login(h);
    assert.equal(h.service.getState().message,'Email o password non corrette.');
    assert.equal(h.service.getState().user,null);
  }
});
test('transient discovery failure hides the position and allows recovery',async()=>{
  const h=harness(); await login(h); h.fail=p=>p.includes('/rpc/')?503:0;
  await h.service.revalidate(); assert.equal(h.service.getState().phase,'error'); assert.equal(h.service.getState().selected,null);
  h.fail=null; await h.service.restore(); assert.equal(h.service.getState().phase,'ready');
});
test('malformed persisted session and malformed discovery fail closed',async()=>{
  const h=harness(); h.storage.setItem(h.service.sessionKey,'{bad'); await h.service.restore();
  assert.equal(h.service.getState().phase,'signed-out');
  h.contexts=[{...studio,context_type:'admin'}]; await login(h);
  assert.equal(h.service.getState().phase,'error');
});
test('network boundary is Auth + read-only discovery and never credentials in URL',async()=>{
  const h=harness(); await login(h); await h.service.choose(personal); await h.service.logout();
  for(const {url,opts} of h.calls){
    assert.match(new URL(url).pathname,/^\/(auth\/v1\/(token|user|logout)|rest\/v1\/rpc\/tal_list_my_contexts)$/);
    assert.equal(opts.cache,'no-store'); assert.equal(opts.credentials,'omit'); assert.equal(opts.redirect,'error');
    assert.ok(!url.includes('unit-test-only')); assert.equal(opts.headers.apikey,config.publishableKey);
  }
});
test('context reset removes every modified operational fixture',()=>{
  demoService.addInvoice('mario',12500); demoService.uploadExample('mario'); demoService.resolveDifference('andrea');
  demoService.reset();
  assert.equal(demoService.getPosition('mario').invoices.length,5);
  assert.equal(demoService.getPosition('mario').request.state,'todo');
  assert.equal(demoService.listAttention().length,3);
});
