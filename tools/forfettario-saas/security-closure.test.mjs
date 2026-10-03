import test from 'node:test';import assert from 'node:assert/strict';
import {escapeHtml as esc,localHref} from './html.js';
import {nextPaymentView,clientWorkflow,confirmationLabel} from './workflow-view.js';
import {collaborationView} from './collaboration-view.js';
import {fiscalView} from './fiscal-view.js';
import {createCollaborationUI} from './collaboration-ui.js';
import {createOnboardingService} from './onboarding-service.js';
import {readFile} from 'node:fs/promises';
const attack='\"><img src=x onerror="globalThis.attacked=1"><script>globalThis.attacked=1</script>';
const helpers={esc,heading:t=>'<h1>'+esc(t)+'</h1>',button:(a,t,attrs='')=>'<button data-action="'+esc(a)+'" '+attrs+'>'+esc(t)+'</button>',icon:()=>'',link:(u,t)=>'<a href="'+localHref(u)+'">'+esc(t)+'</a>',euro:n=>n+' €'};
test('escape raw server/hash/input attributes, counts and paths before HTML',()=>{
 const html=nextPaymentView(null,{...helpers,href:'#/io/'+attack})+clientWorkflow({counts:{invoices:attack,payments:attack,documents:attack,contributions:attack}},{...helpers,label:attack,base:'#/'+attack});
 assert.ok(!html.includes('<img'));assert.ok(!html.includes('<script'));assert.match(html,/&quot;&gt;&lt;img/);
 assert.equal(localHref('javascript:alert(1)'),'#/ingresso');
 assert.equal(localHref('//evil.example'),'#/ingresso');
});
test('document and request attributes cannot create an executable HTML element',()=>{
 const context='personal:synthetic',doc={id:attack,original_filename:attack,ready_at:'2026-01-01'};
 const data={workspaceId:'w',links:[],documents:[doc],activities:[{id:attack,kind:'request_upload',status:'todo',actor_context:'studio:x',recipient_context:context,document_id:attack,body:attack,created_at:'2026-01-01'}]};
 for(const mode of ['activity','documents','queue']){
  const html=collaborationView({...helpers,r:{id:'w'},state:{phase:'ready',data:[data]},access:{selected:{context_type:'personal',context_id:'synthetic'}},positions:[{id:'w',label:attack}],href:()=> '#/io/attivita',mode});
  assert.ok(!html.includes('<img'));assert.ok(!html.includes('<script'));
 }
});
test('cancel/reject commands retain scoped session, token binding and one key on retry',async()=>{
 const calls=[],id='18000000-0000-4000-8000-000000000001',token='a'.repeat(64);
 const auth={getState:()=>({user:{id},selected:{context_type:'personal',context_id:id}}),withContextSession:f=>f({context:{context_type:'personal',context_id:id},config:{supabaseUrl:'https://synthetic.test',publishableKey:'public'},token:'synthetic'})};
 const service=createOnboardingService({auth,fetchImpl:async(u,o)=>{calls.push({u,p:JSON.parse(o.body)});return Response.json({status:'rejected'});}});
 await service.endInvite({id,revision:1},'reject','same','TALI1.'+id+'.'+token);
 await service.endInvite({id,revision:1},'reject','same','TALI1.'+id+'.'+token);
 assert.deepEqual(calls[0],calls[1]);assert.equal(calls[0].p.p_token,token);assert.equal(calls[0].p.p_context,'personal:'+id);
});
test('self-declared and documentary claims never display professional verification',()=>{
 for(const state of ['self_declared','evidence_backed','legacy_unclassified'])assert.doesNotMatch(confirmationLabel({state}),/verificato dallo Studio/i);
 assert.match(confirmationLabel({state:'self_declared'},[{state:'studio_verified'}]),/Dichiarato dal titolare.*verificato dallo Studio/);
 for(const state of ['self_declared','evidence_backed','studio_verified','legacy_unclassified']){
  const label=confirmationLabel({state,evidenceStatus:'needs_review'},[{state:'studio_verified'}]);
  assert.match(label,/Evidenza da verificare/);assert.doesNotMatch(label,/verificato dallo Studio/i);
 }
});
test('new lifecycle RPC allowed by exact CSP; lockfile and CI reproducible',async()=>{
 const read=p=>readFile(new URL(p,import.meta.url),'utf8');
 for(const p of ['./index.html','./serve-dev.mjs'])assert.ok((await read(p)).includes('rpc/tal_end_link_invite'));
 const lock=JSON.parse(await read('../../package-lock.json'));assert.equal(lock.lockfileVersion,3);
 assert.equal(lock.packages[''].devDependencies.playwright,JSON.parse(await read('../../package.json')).devDependencies.playwright);
 const ci=await read('../../.github/workflows/ci.yml');assert.match(ci,/npm ci/);assert.doesNotMatch(ci,/npm install/);
});

test('fiscal year and upload/confirmation form IDs are escaped at the HTML boundary',async()=>{
 const state={phase:'ready',data:{year:attack,missing:[],pensionPayments:[],worker:{result:{}},receivedCents:0}};
 const html=fiscalView({...helpers,heading:(t,s)=>'<h1>'+t+'</h1><p>'+s+'</p>',r:{page:'oggi',role:'personal'},state,mode:'current',label:'SYNTHETIC',href:()=> '#/io/entrate'});
 assert.ok(!html.includes('<img'));assert.match(html,/&lt;img/);
 let form='';const item={id:attack,body:attack};
 const ui=createCollaborationUI({esc,controller:{getState:()=>({data:[{workspaceId:'w',activities:[item],documents:[]}]})},route:()=>({id:'w'}),openPanel:(_t,h)=>{form=h;}});
 await ui.action('upload-request',{dataset:{request:attack}});
 assert.ok(!form.includes('<img'));assert.match(form,/data-request="&quot;&gt;&lt;img/);
});
