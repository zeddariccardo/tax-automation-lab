// Explicit hosted smoke runner. Reads synthetic passwords once from stdin, never writes them.
// Run via the documented Windows Credential Manager wrapper; config.local.js is public-only.
import assert from 'node:assert/strict';
import config from './config.local.js';
import { createAuthContextService } from './auth-context-service.js';
let input = '';
for await (const chunk of process.stdin) input += chunk;
let credentials = JSON.parse(input); input = '';
const memory = () => { const m = new Map(); return {getItem:k=>m.get(k)||null,setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k)}; };
const subjects = new Map();
const calls = [];
const result = [];
const check = (name, action) => { action(); result.push({test:name,result:'PASS'}); };
try {
  for (const [name,c] of Object.entries(credentials)) {
    const storage=memory(), preferenceStorage=memory(), clock={value:Date.now()};
    let queue=Promise.resolve();
    const make=()=>createAuthContextService({config, storage, preferenceStorage, now:()=>clock.value, lock:(_key,fn)=>{queue=queue.catch(()=>{}).then(fn);return queue;},fetchImpl:async(url,opts)=>{calls.push({name,path:new URL(url).pathname});return fetch(url,opts);}});
    const service=make(); await service.login(c.email,c.password);
    check('login/discovery '+name,()=>{
      const state=service.getState();
      assert.ok(['ready','choosing'].includes(state.phase),'login/discovery unavailable');
      assert.equal(state.contexts.length,name==='dual-role'?2:1);
      assert.deepEqual(state.contexts.map(c=>c.context_type),name==='dual-role'?['personal','studio']:name.startsWith('contribuente')?['personal']:['studio']);
    });
    subjects.set(name,{service,make,storage,clock});
  }
  const context=name=>subjects.get(name).service.getState().contexts;
  check('Studio membership identities',()=>{
    assert.deepEqual(context('studio-a-admin'),context('studio-a-professionista'));
    assert.deepEqual(context('dual-role').filter(c=>c.context_type==='studio'),context('studio-a-admin'));
    assert.notEqual(context('contribuente-a')[0].context_id,context('contribuente-b')[0].context_id);
    assert.notEqual(context('studio-a-admin')[0].context_id,context('studio-b-admin')[0].context_id);
  });
  const a=subjects.get('contribuente-a');
  const restored=a.make(); await restored.restore();
  check('restore fresh identity and discovery',()=>assert.deepEqual(restored.getState().selected,context('contribuente-a')[0]));
  const before=JSON.parse(a.storage.getItem(a.service.sessionKey));
  a.clock.value=before.expires_at;
  await a.service.revalidate();
  const after=JSON.parse(a.storage.getItem(a.service.sessionKey));
  check('real refresh token rotation',()=>{assert.equal(a.service.getState().phase,'ready');assert.notEqual(after.access_token,before.access_token);assert.notEqual(after.refresh_token,before.refresh_token);});
  for(const target of [context('contribuente-b')[0],context('studio-b-admin')[0]]) {
    await a.service.choose(target);
    check('foreign context rejected '+target.context_type,()=>assert.equal(a.service.getState().selected,null));
  }
  const d=subjects.get('dual-role'); await d.service.choose(context('studio-a-admin')[0]);
  check('dual chooses only Studio',()=>assert.equal(d.service.getState().selected.context_type,'studio'));
  await d.service.chooseAgain();
  check('dual chooser clears active position',()=>assert.equal(d.service.getState().selected,null));
  await d.service.choose(context('dual-role')[0]);
  check('dual personal separate',()=>assert.equal(d.service.getState().selected.context_type,'personal'));
  const unauth=await fetch(config.supabaseUrl+'/rest/v1/rpc/tal_list_my_contexts',{method:'POST',headers:{apikey:config.publishableKey,'Content-Type':'application/json'},body:'{}'});
  await unauth.body.cancel();
  check('RPC without JWT denied',()=>assert.ok([401,403].includes(unauth.status)));
  await a.service.logout();
  for(const [label,email] of [['wrong password',credentials['contribuente-a'].email],['unknown email','does-not-exist-s07@tal-s04.test']]){
    const fresh=a.make(); await fresh.login(email,'SYNTHETIC-INVALID-'+crypto.randomUUID());
    check(label,()=>{assert.equal(fresh.getState().phase,'signed-out');assert.equal(fresh.getState().message,'Email o password non corrette.');});
  }
  check('only Auth and context discovery requests',()=>assert.ok(calls.every(c=>/^\/auth\/v1\/(token|user|logout)$|^\/rest\/v1\/rpc\/tal_list_my_contexts$/.test(c.path))));
  console.log(JSON.stringify({result,passed:result.length,requests:calls.length}));
} catch {
  console.log(JSON.stringify({result,passed:result.length,error:'Hosted smoke assertion failed; no credentials or provider bodies logged.'}));
  process.exitCode=1;
} finally {
  for(const {service} of subjects.values()) await service.logout();
  credentials=null;
}
