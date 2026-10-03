// Local synthetic DOM harness. No hosted credentials, no external connections.
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {spawn} from 'node:child_process';import {once} from 'node:events';
import {fileURLToPath} from 'node:url';import {mkdtemp} from 'node:fs/promises';import {tmpdir} from 'node:os';import path from 'node:path';
const base='http://127.0.0.1:4192',screens=await mkdtemp(path.join(tmpdir(),'tal-s18c-ui-'));
const server=spawn(process.execPath,[fileURLToPath(new URL('./s16/gallery-server.mjs',import.meta.url))],{env:{...process.env,TAL_GALLERY_PORT:'4192'},stdio:['ignore','pipe','pipe']});
let browser;
try{
 await once(server.stdout,'data');browser=await chromium.launch();const page=await browser.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',r=>new URL(r.request().url()).origin===base?r.continue():r.abort());
 await page.goto(base+'/');
 await page.evaluate(async()=>{
  const {escapeHtml:esc,localHref}=await import('/app/html.js');
  const {clientWorkflow,nextPaymentView}=await import('/app/workflow-view.js');
  const {collaborationView}=await import('/app/collaboration-view.js');
  const attack='"><img src=x onerror="globalThis.attacked=1"><script>globalThis.attacked=1</script>';
  const helpers={esc,heading:t=>'<h1>'+esc(t)+'</h1>',button:(a,t,attrs='',cls='button')=>'<button type="button" class="'+cls+'" data-action="'+esc(a)+'" '+attrs+'>'+esc(t)+'</button>',icon:()=>'',link:(u,t)=>'<a href="'+localHref(u)+'">'+esc(t)+'</a>',euro:n=>n+' EUR'};
  const data={workspaceId:'w',links:[],documents:[{id:attack,original_filename:attack}],activities:[{id:attack,kind:'request_upload',status:'todo',actor_context:'studio:x',recipient_context:'personal:synthetic',body:attack,created_at:'2026-01-01'}]};
  document.querySelector('#preview').innerHTML=nextPaymentView(null,{...helpers,href:'#/io/'+attack})+clientWorkflow({counts:{invoices:attack,payments:attack,documents:attack,contributions:attack}},{...helpers,label:attack,base:'#/'+attack})+collaborationView({...helpers,r:{id:'w'},state:{phase:'ready',data:[data]},access:{selected:{context_type:'personal',context_id:'synthetic'}},positions:[{id:'w',label:attack}],href:()=> '#/io/attivita',mode:'activity'});
  window.s18cHelpers=helpers;
 });
 assert.equal(await page.locator('#preview img,#preview script,[onerror]').count(),0);
 assert.equal(await page.evaluate(()=>globalThis.attacked),undefined);
 console.log('PASS executable XSS payloads render as text in live DOM');
 await page.evaluate(async()=>{
  const {createOnboardingUI}=await import('/app/onboarding-ui.js');
  const mount=document.querySelector('#preview');mount.className='page';window.s18cCalls=[];
  const service={listLinks:async()=>[{id:'synthetic-invite',revision:1,status:'pending',canCancel:true}],previewInvite:async()=>({linkId:'synthetic-invite',revision:1,studioName:'SYNTHETIC Studio',direction:'studio_to_client'}),endInvite:async(...args)=>s18cCalls.push(args)};
  const ui=createOnboardingUI({...s18cHelpers,auth:{getState:()=>({selected:{context_type:'personal',context_id:'synthetic'}})},service,openPanel:(t,h)=>{mount.innerHTML='<h2>'+s18cHelpers.esc(t)+'</h2>'+h;},notify:()=>{},render:()=>{},refresh:async()=>{}});
  mount.addEventListener('click',e=>{const b=e.target.closest('[data-action]');if(b)void ui.act(b.dataset.action,b);});
  mount.addEventListener('submit',e=>{e.preventDefault();void ui.submit(e.target);});
  window.s18cUI=ui;await ui.act('s11-links');
 });
 for(const width of [1440,1024,390,375]){
  await page.setViewportSize({width,height:844});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await page.getByRole('button',{name:'Annulla invito',exact:true}).focus();
  assert.equal(await page.evaluate(()=>document.activeElement.textContent),'Annulla invito');
  await page.screenshot({path:path.join(screens,'invites-'+width+'.png'),fullPage:true});
 }
 await page.keyboard.press('Enter');await page.getByText('Invito annullato.',{exact:true}).waitFor();
 assert.equal(await page.evaluate(()=>s18cCalls[0][1]),'cancel');
 await page.evaluate(()=>s18cUI.act('s11-links'));
 await page.getByLabel('Hai ricevuto un codice invito?').fill('SYNTHETIC-OPAQUE-INVITE');
 await page.getByRole('button',{name:'Apri invito',exact:true}).click();
 await page.getByRole('button',{name:'Rifiuta',exact:true}).click();await page.getByText('Invito rifiutato.',{exact:true}).waitFor();
 assert.equal(await page.evaluate(()=>s18cCalls[1][1]),'reject');
 assert.equal(await page.evaluate(()=>s18cCalls[1][3]),'SYNTHETIC-OPAQUE-INVITE');
 assert.deepEqual(errors,[]);
 console.log('PASS cancel/reject controls, keyboard, 1440/1024/390/375; screenshots '+screens);
 await page.evaluate(async()=>{
  const {paymentsView}=await import('/app/payments-view.js');
  const {createVerificationUI}=await import('/app/verification-ui.js');
  const draft={groups:[],settlement:{completeness:'PARTIAL'},credit:{},blocked:[],diagnostics:[],declarationRevision:1,
   paymentReconciliation:{payments:[212000,108000].map((amountCents,i)=>({eventId:'synthetic-'+i,paidDate:'2026-06-30',amountCents,documentId:'synthetic-receipt',confirmation:{state:'studio_verified',evidenceStatus:'needs_review'},verifications:[{state:'studio_verified'}]}))}};
  document.querySelector('#preview').innerHTML=paymentsView({...s18cHelpers,state:{phase:'ready',data:{draft}},studio:true,base:'#/studio/synthetic'});
  const ui=createVerificationUI({auth:{getState:()=>({phase:'ready',user:{id:'synthetic'},selected:{context_type:'studio',context_id:'synthetic'}})},
   route:()=>({id:'w',page:'pagamenti'}),payments:{refresh:async()=>{},getState:()=>({data:{draft}})},openPanel:()=>{throw Error('Conflict verification panel must not open');}});
  await ui.act('fact-verify:f24_payment:synthetic-0');
 });
 assert.equal(await page.getByText('Evidenza da verificare · associazioni in conflitto',{exact:true}).count(),2);
 assert.equal(await page.locator('[data-action^="fact-verify:"]').count(),0);
 for(const width of [1440,1024,390,375]){
  await page.setViewportSize({width,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  if(width===375)await page.screenshot({path:path.join(screens,'historical-conflict-375.png'),fullPage:true});
 }
 assert.deepEqual(errors,[]);
 console.log('PASS historical conflict visible, no professional verification CTA/panel, all four widths');
}finally{await browser?.close();server.kill();}
