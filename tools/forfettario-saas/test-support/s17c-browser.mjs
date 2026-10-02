// Real hosted journeys through the local preview. Secrets stay in process memory.
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {mkdtemp} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
export async function verifyBrowser({credentials,workspace,check,beforeRole=async()=>{},afterRole=async()=>{}}){
 const browser=await chromium.launch(),dir=await mkdtemp(path.join(tmpdir(),'tal-s17c-browser-'));
 let errors=[],bad=[],activePage,workflowCalls=[],navigationAborts=0;
 try{
  for(const [name,role] of [['s17c-workflow','personal'],['studio-a-admin','studio']]){
   await beforeRole(role);
   const context=await browser.newContext({viewport:{width:1440,height:960},reducedMotion:'reduce'}),page=await context.newPage();
   activePage=page;
   page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)bad.push(r.status()+' '+new URL(r.url()).pathname);});
   page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
   page.on('requestfailed',r=>{const why=r.failure()?.errorText;if(why==='net::ERR_ABORTED'){navigationAborts++;return;}bad.push(why+' '+new URL(r.url()).pathname);});
   page.on('response',async r=>{if(r.url().endsWith('/tal_workflow_summary')){let body;try{body=await r.json();}catch{}workflowCalls.push({status:r.status(),workspaceId:body?.workspaceId,code:body?.code,empty:!body});}});
   await page.goto('http://127.0.0.1:4173/tools/forfettario-saas/');
   await page.getByLabel('Email',{exact:true}).fill(credentials[name].email);
   await page.getByLabel('Password',{exact:true}).fill(credentials[name].password);
   await page.locator('#login-form button[type=submit]').click();
   await page.getByRole('button',{name:'Account',exact:true}).waitFor({timeout:60000});
   if(role==='studio'){
    await page.getByRole('link',{name:'Clienti',exact:true}).click();
    await page.locator('.client-link[href="#/studio/clienti/'+workspace+'/oggi"]').click();
    await page.getByRole('heading',{name:'Dati raccolti',exact:true}).waitFor();
   }
   const base=role==='personal'?'#/io/':'#/studio/clienti/'+workspace+'/';
   await check('browser '+role+' full journey',async()=>{
    for(const route of ['oggi','entrate','tasse','attivita','dichiarazione','pagamenti']){
     await page.goto('http://127.0.0.1:4173/tools/forfettario-saas/'+base+route);
     const selector=({oggi:role==='studio'?'.workflow-chain':'.income-hero',entrate:'.income-page,#invoice-list',tasse:'.tax-layout',attivita:'.feed',dichiarazione:'.declaration-page',pagamenti:'.payments-page'})[route];
     await page.locator(selector).waitFor({timeout:60000});
     assert.equal(await page.getByRole('combobox',{name:'Cerca nel Forfettario'}).count(),0);
     assert.equal(await page.getByRole('link',{name:'Scadenze',exact:true}).count(),0);
     if(route==='dichiarazione'&&role==='personal')assert.equal(await page.getByRole('button',{name:'Esporta bozza JSON'}).count(),0);
     await page.screenshot({path:path.join(dir,role+'-'+route+'-1440.png'),fullPage:true});
    }
   });
   if(role==='studio')await check('browser explicit stale reconfirmation and loss confirmation removal',async()=>{
    await page.getByRole('link',{name:'Dichiarazione',exact:true}).filter({visible:true}).click();await page.locator('.declaration-page').waitFor();
    for(const value of ['clear','confirm']){
     await page.locator('[data-action=declaration-losses]').click();
     await page.getByLabel('Esito della verifica').selectOption(value);
     await page.getByLabel('Riferimento della verifica',{exact:true}).fill('S17C SYNTHETIC browser explicit review');
     const saved=page.waitForResponse(r=>r.url().endsWith('/tal_review_declaration')&&r.request().method()==='POST');
     await page.getByRole('button',{name:'Salva verifica',exact:true}).click();assert.equal((await saved).status(),200);
     await page.locator('#panel').waitFor({state:'hidden'});
    }
    await page.getByRole('link',{name:'Pagamenti',exact:true}).filter({visible:true}).click();await page.locator('.payments-page').waitFor();
    await page.getByRole('button',{name:'Verifica versamenti e crediti',exact:true}).click();
    assert.equal(await page.locator('#pay-taxCredits').inputValue(),'0,00');
    assert.match(await page.locator('#pay-reason').inputValue(),/S17C SYNTHETIC/);
    const saved=page.waitForResponse(r=>r.url().endsWith('/tal_review_payments')&&r.request().method()==='POST');
    await page.getByRole('button',{name:'Salva verifica',exact:true}).click();assert.equal((await saved).status(),200);
    await page.locator('#panel').waitFor({state:'hidden'});
   });
   await check('browser '+role+' 1024/390/375 and payment panel',async()=>{
    for(const width of [1024,390,375]){
     await page.setViewportSize({width,height:width<500?844:960});
     assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
     await page.screenshot({path:path.join(dir,role+'-pagamenti-'+width+'.png'),fullPage:true});
     if(await page.getByRole('button',{name:'Controlla F24',exact:true}).count()){
     await page.getByRole('button',{name:'Controlla F24',exact:true}).first().click();
     await page.locator('#panel[open]').waitFor({timeout:15000});
     const box=await page.locator('#panel').boundingBox();assert.ok(box.x>=0&&box.x+box.width<=width+1);
     const gtext=await page.locator('#panel').innerText();assert.match(gtext,/ravvedimento/);
     await page.screenshot({path:path.join(dir,role+'-panel-'+width+'.png'),fullPage:true});
     await page.keyboard.press('Escape');await page.locator('#panel').waitFor({state:'hidden'});
     }else assert.ok(await page.getByRole('heading',{name:'Pagamenti registrati',exact:true}).isVisible());
     await page.getByRole('link',{name:'Tasse',exact:true}).filter({visible:true}).click();
     await page.locator('.tax-layout').waitFor({timeout:60000});
     assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
     await page.getByRole('link',{name:'Pagamenti',exact:true}).filter({visible:true}).click();
     await page.locator('.payments-page').waitFor({timeout:60000});
    }
   });
   await check('browser '+role+' logout',async()=>{
    await page.getByRole('button',{name:'Account',exact:true}).click();await page.getByRole('button',{name:'Esci',exact:true}).click();
    await page.locator('#login-form').waitFor();
   });
   await context.close();
   await afterRole(role);
  }
  await check('browser no unhandled errors or failed network requests',async()=>{if(errors.length||bad.length)console.log('S17C INSPECT '+JSON.stringify({errors,bad}));assert.deepEqual(errors,[]);assert.deepEqual(bad,[]);});
  console.log('S17C INSPECT '+JSON.stringify({screenshots:dir,navigationAborts}));
 }catch(e){
  console.log('S17C INSPECT '+JSON.stringify({url:activePage?.url(),message:e.message.slice(0,500),text:activePage&&!activePage.isClosed()?await activePage.locator('body').innerText():undefined,errors,bad,workflowCalls:workflowCalls.slice(-10)}));
  throw e;
 }finally{await browser.close();}
}
