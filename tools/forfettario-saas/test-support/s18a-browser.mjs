// Real development JWT journeys. Only browser reads/panels; no payment submission.
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {mkdtemp} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
export async function verifyBrowser({credentials,workspace,check,beforeRole,afterRole}){
 const browser=await chromium.launch(),dir=await mkdtemp(path.join(tmpdir(),'tal-s18a-browser-'));
 const errors=[],bad=[];
 try{
  for(const [name,role] of [['s17c-workflow','personal'],['studio-a-admin','studio']]){
   await beforeRole(role);
   const context=await browser.newContext({viewport:{width:1440,height:960},reducedMotion:'reduce'}),page=await context.newPage();
   page.on('pageerror',()=>errors.push('pageerror'));
   page.on('console',m=>{if(m.type()==='error')errors.push('console error');});
   page.on('response',r=>{if(r.status()>=400)bad.push(r.status()+' '+new URL(r.url()).pathname);});
   const url='http://127.0.0.1:4173/tools/forfettario-saas/';
   await page.goto(url);await page.getByLabel('Email',{exact:true}).fill(credentials[name].email);
   await page.getByLabel('Password',{exact:true}).fill(credentials[name].password);await page.locator('#login-form button[type=submit]').click();
   await page.getByRole('button',{name:'Account',exact:true}).waitFor({timeout:60000});
   const base=role==='personal'?'#/io/':'#/studio/clienti/'+workspace+'/';
   await check('hosted browser '+role+' journey 1440/1024/390/375',async()=>{
    for(const route of ['oggi','entrate','tasse','attivita','dichiarazione','pagamenti']){
     await page.goto(url+base+route);
     const selector=({oggi:role==='studio'?'.workflow-chain':'.income-hero',entrate:'.income-page,#invoice-list',tasse:'.tax-layout',attivita:'.feed',dichiarazione:'.declaration-page',pagamenti:'.payments-page'})[route];
     await page.locator(selector).waitFor({timeout:60000});
     for(const width of [1440,1024,390,375]){
      await page.setViewportSize({width,height:width<500?844:960});
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),role+'/'+route+'/'+width);
     }
     await page.screenshot({path:path.join(dir,role+'-'+route+'-375.png'),fullPage:true});
    }
   });
   await check('hosted '+role+' professional control and keyboard panel',async()=>{
    const verify=page.locator('[data-action^="fact-verify:"]');
    if(role==='personal')assert.equal(await verify.count(),0);
    else{
     assert.ok(await verify.count());await verify.first().click();await page.locator('#fact-verification-form').waitFor();
     assert.equal(await page.locator('#panel').evaluate(e=>e.contains(document.activeElement)),true);
     await page.getByLabel('Riferimento della verifica',{exact:true}).fill('S18A SYNTHETIC preview only');
     const b=await page.locator('#panel').boundingBox();assert.ok(b.x>=0&&b.x+b.width<=376);
     await page.screenshot({path:path.join(dir,'studio-verification-375.png'),fullPage:true});
     await page.keyboard.press('Escape');await page.locator('#panel').waitFor({state:'hidden'});
    }
   });
   await page.getByRole('button',{name:'Account',exact:true}).click();await page.getByRole('button',{name:'Esci',exact:true}).click();await page.locator('#login-form').waitFor();
   await context.close();await afterRole(role);
  }
  await check('hosted browser no console errors or HTTP failures',async()=>{assert.deepEqual(errors,[]);assert.deepEqual(bad,[]);});
  console.log('S18A INSPECT '+JSON.stringify({screenshots:dir}));
 }finally{await browser.close();}
}
