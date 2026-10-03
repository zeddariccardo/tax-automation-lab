// Hosted development presentation smoke. Credentials arrive only through stdin.
// No setup, revocation, financial write, upload or schema mutation.
import assert from 'node:assert/strict';
import {createInterface} from 'node:readline';
import {mkdtemp} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {chromium} from 'playwright';
const input=JSON.parse((await createInterface({input:process.stdin})[Symbol.asyncIterator]().next()).value);
const base='http://127.0.0.1:4173/tools/forfettario-saas/',workspace='510e09a2-d4d2-45ab-8fc6-4ef4dc0b4d02';
const dir=await mkdtemp(path.join(tmpdir(),'tal-overhaul-hosted-'));
let browser,stage='start',passed=0;const errors=[],failed=[],mutations=[];
const check=async(name,fn)=>{stage=name;await fn();passed++;console.log('VISUAL PASS '+name);};
const allowedRPC=new Set(['tal_list_my_contexts','tal_get_onboarding','tal_list_my_links','tal_workflow_summary']);
try{
 browser=await chromium.launch();
 for(const [name,role] of [['contribuente-b','standalone'],['s17c-workflow','personal'],['studio-a-admin','studio']]){
  stage='login '+role;const context=await browser.newContext({viewport:{width:1440,height:960}}),page=await context.newPage();
  page.on('pageerror',()=>errors.push('pageerror '+role));page.on('console',m=>{if(m.type()==='error')errors.push('console '+role);});
  page.on('response',r=>{if(r.status()>=400)failed.push({status:r.status(),path:new URL(r.url()).pathname});});
  await page.route('**/*',route=>{
   const req=route.request(),url=new URL(req.url());
   if(req.method()==='POST'&&url.pathname.includes('/rpc/')&&!allowedRPC.has(url.pathname.split('/').at(-1))){mutations.push(url.pathname);return route.abort();}
   if(['PATCH','PUT','DELETE'].includes(req.method())){mutations.push(url.pathname);return route.abort();}
   return route.continue();
  });
  await check(role+' real login',async()=>{
   await page.goto(base);await page.getByLabel('Email',{exact:true}).fill(input[name].email);await page.getByLabel('Password',{exact:true}).fill(input[name].password);
   await page.locator('#login-form button[type=submit]').click();await page.getByRole('button',{name:'Account',exact:true}).waitFor({timeout:60000});
  });
  if(role==='studio')await check('Studio queue and linked client',async()=>{
   await page.locator('#main h1').waitFor();await page.screenshot({path:path.join(dir,'studio-queue.png'),fullPage:true});
   await page.getByRole('link',{name:'Clienti',exact:true}).click();await page.locator('.client-link[href="#/studio/clienti/'+workspace+'/oggi"]').click();await page.locator('.workflow-chain').waitFor({timeout:60000});
  });
  const prefix=role==='studio'?'#/studio/clienti/'+workspace+'/':'#/io/';
  if(role==='standalone')await check('standalone has no active Studio',async()=>{
   // Read the same server-authorized data service used by the UI; never inject a role.
   const links=await page.evaluate(async()=>{const {service}=await import('./tal-data-runtime.js');return (await service.listLinks()).filter(l=>l.status==='active').length;});
   assert.equal(links,0);
  });
  await check(role+' six-screen hosted journey and four viewports',async()=>{
   for(const route of ['oggi','entrate','tasse','attivita','dichiarazione','pagamenti']){
    await page.goto(base+prefix+route);await page.locator('#main h1').waitFor({timeout:60000});
    await page.waitForFunction(()=>!document.querySelector('#main .loading,#main [aria-busy=true]'),{},{timeout:60000});await page.waitForTimeout(700);
    const text=await page.locator('#main').innerText();assert.ok(!/Non riusciamo|Accesso non disponibile|Impossibile caricare|Errore inatteso/.test(text),role+' '+route+' unavailable');
    if(role!=='standalone'&&route==='pagamenti')assert.ok(/Pagamenti registrati|Controlla F24|F24/.test(text));
    for(const width of [1440,1024,390,375]){
     await page.setViewportSize({width,height:width<500?844:960});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),role+' '+route+' '+width);
     await page.screenshot({path:path.join(dir,role+'-'+route+'-'+width+'.png'),fullPage:true});
    }
   }
  });
  await check(role+' F24 or explicit empty state, import panel and keyboard',async()=>{
   const f24=page.getByRole('button',{name:'Controlla F24',exact:true});
   if(await f24.count()){await f24.first().click();await page.locator('#panel[open]').waitFor();assert.match(await page.locator('#panel').innerText(),/F24|tributo|versamento/i);await page.screenshot({path:path.join(dir,role+'-f24.png'),fullPage:true});await page.keyboard.press('Escape');await page.locator('#panel').waitFor({state:'hidden'});}
   else assert.match(await page.locator('#main').innerText(),/Pagamenti registrati|Nessun|verific|defini|predispor/i);
   await page.goto(base+prefix+'entrate');await page.getByRole('button',{name:'Importa',exact:true}).click();await page.locator('#panel[open]').waitFor();
   const g=await page.locator('#panel').boundingBox();assert.ok(g.x>=0&&g.x+g.width<=376);await page.keyboard.press('Escape');await page.locator('#panel').waitFor({state:'hidden'});
   assert.equal(await page.evaluate(()=>document.activeElement?.textContent),'Importa');
  });
  await page.getByRole('button',{name:'Account',exact:true}).click();await page.getByRole('button',{name:'Esci',exact:true}).click();await page.locator('#login-form').waitFor();await context.close();
 }
 await check('no console errors, failed resources or operational writes',async()=>{assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);assert.deepEqual(mutations,[]);});
 console.log('VISUAL RESULT '+JSON.stringify({passed,screenshots:dir,operationalWrites:0}));
}catch(e){console.log('VISUAL FAIL '+JSON.stringify({stage,type:e.name,assertion:e.name==='AssertionError'?e.message.slice(0,220):undefined,failed,mutations}));process.exitCode=1;}
finally{await browser?.close();process.stdin.destroy();}
