import test from 'node:test';import assert from 'node:assert/strict';import {mkdtemp,readFile} from 'node:fs/promises';import os from 'node:os';import path from 'node:path';
import {buildSaas} from './build-saas.mjs';import {validateEnvironment} from './environment-config.js';import {createAuthContextService} from './auth-context-service.js';
import {serveArtifact} from './serve-artifact.mjs';
const config={environment:'production',supabaseUrl:'https://abcdefghijklmnopqrst.supabase.co',publishableKey:'sb_publishable_'+'a'.repeat(30),saasOrigin:'https://saas.example.com',studioMfa:true};
const binding={environment:'production',supabaseUrl:config.supabaseUrl,approvedSupabaseUrl:config.supabaseUrl,saasOrigin:config.saasOrigin,publicSiteOrigin:'https://www.example.com'};
test('artifact: explicit bindings, minimal module graph, no development/test files',async()=>{
 const parent=await mkdtemp(path.join(os.tmpdir(),'tal-s18b-artifact-'));
 const manifest=await buildSaas({config,binding,forbiddenResources:['https://development.example.com'],output:path.join(parent,'site')});
 assert.ok(manifest.files.includes('tools/forfettario-saas/auth-context-service.js'));
 assert.ok(manifest.files.includes('tools/forfettario-saas/f24-renderer.generated.js'));
 assert.ok(manifest.files.every(f=>!/(?:test-support|README|\.ps1|\.test\.|config.local|demo-service|serve-dev)/.test(f)));
 assert.match(manifest.headers['Content-Security-Policy'],/frame-ancestors 'none'/);
 assert.doesNotMatch(manifest.headers['Content-Security-Policy'],/localhost|127\.0\.0\.1|\*\.supabase/);
 assert.equal(manifest.headers['X-Frame-Options'],'DENY');
 const html=await readFile(path.join(parent,'site/tools/forfettario-saas/index.html'),'utf8');assert.doesNotMatch(html,/http-equiv="Content-Security-Policy"/);
 const server=await serveArtifact(path.join(parent,'site'),0);
 try{
  assert.equal(server.address().address,'127.0.0.1');const origin='http://127.0.0.1:'+server.address().port;
  const r=await fetch(origin+'/tools/forfettario-saas/');assert.equal(r.status,200);assert.equal(r.headers.get('content-security-policy'),manifest.headers['Content-Security-Policy']);assert.equal(r.headers.get('x-frame-options'),'DENY');await r.body.cancel();
  for(const denied of ['/test-support/','/tools/forfettario-saas/config.local.js','/tools/forfettario-saas/README.md','/artifact-manifest.json','/..%2ftax-automation-lab-backend/package.json']){
   const response=await fetch(origin+denied);assert.equal(response.status,404,denied);await response.body?.cancel();
  }
 }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
});
test('production rejects copied development, unpinned project, loopback and shared public origin',async()=>{
 const output=path.join(os.tmpdir(),'unused-s18b-output');
 await assert.rejects(buildSaas({config,binding,forbiddenResources:[config.supabaseUrl],output}),/DEVELOPMENT_RESOURCE/);
 await assert.rejects(buildSaas({config,binding:{...binding,approvedSupabaseUrl:'https://other.example'},forbiddenResources:['dev'],output}),/APPROVED_PRODUCTION/);
 assert.throws(()=>validateEnvironment({...config,supabaseUrl:'https://other.example'},binding),/MISMATCH/);
 assert.throws(()=>validateEnvironment({...config,saasOrigin:'http://127.0.0.1:4173'},{...binding,saasOrigin:'http://127.0.0.1:4173'}),/PRODUCTION/);
 assert.throws(()=>validateEnvironment(config,{...binding,publicSiteOrigin:config.saasOrigin}),/PRODUCTION/);
});
function authFixture({studio=true,required=true}={}){
 const uid='18000000-0000-4000-8000-000000000001',id='18000000-0000-4000-8000-000000000002',factor='18000000-0000-4000-8000-000000000003',m=new Map(),calls=[];
 let aal='aal1';const token=()=> 'eyJhbGciOiJIUzI1NiJ9.'+Buffer.from(JSON.stringify({aal})).toString('base64url')+'.synthetic';
 const session=()=>({access_token:token(),refresh_token:'synthetic',expires_in:3600,user:{id:uid}});
 const fetchImpl=async(url,options)=>{
  calls.push(url);
  if(url.includes('/token?'))return Response.json(session());
  if(url.endsWith('/user'))return Response.json({id:uid,factors:[]});
  if(url.endsWith('/tal_list_my_contexts'))return Response.json([{context_type:studio?'studio':'personal',context_id:id,label:'Synthetic'}]);
  if(url.endsWith('/tal_my_studio_security'))return Response.json([{studioId:id,mfaRequired:required}]);
  if(url.endsWith('/factors'))return Response.json({id:factor,totp:{secret:'SYNTHETICTEST'}});
  if(url.endsWith('/challenge'))return Response.json({id:'challenge'});
  if(url.endsWith('/verify')){if(JSON.parse(options.body).code==='000000')return Response.json({error:'invalid'},{status:422});aal='aal2';return Response.json(session());}
  throw Error('unexpected');
 };
 const storage={getItem:k=>m.get(k)||null,setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k)};
 return {auth:createAuthContextService({config:{...config,studioMfa:true},fetchImpl,storage,preferenceStorage:storage,lock:(_k,fn)=>fn()}),calls,m};
}
test('Studio MFA enroll/challenge uses native API, wrong code retains session; secret never stored',async()=>{
 const {auth,m}=authFixture();await auth.login('synthetic@example.test','unused');
 assert.equal(auth.getState().phase,'mfa');
 await assert.rejects(auth.withContextSession(()=>assert.fail('operation before AAL2')));
 await auth.enrollMfa();assert.equal(auth.getState().mfa.secret,'SYNTHETICTEST');
 assert.ok([...m.values()].every(v=>!v.includes('SYNTHETICTEST')));
 await auth.verifyMfa('000000');assert.equal(auth.getState().phase,'mfa');
 await auth.verifyMfa('123456');assert.equal(auth.getState().phase,'ready');assert.equal(auth.getState().mfa,undefined);
});
test('standalone is never subjected to Studio MFA',async()=>{
 const {auth,calls}=authFixture({studio:false});await auth.login('synthetic@example.test','unused');assert.equal(auth.getState().phase,'ready');
 assert.ok(calls.every(s=>!s.includes('factors')&&!s.includes('studio_security')));
});
