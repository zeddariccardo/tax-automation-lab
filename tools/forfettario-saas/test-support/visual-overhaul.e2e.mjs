// Technical presentation gate. Local synthetic gallery only; screenshots stay in TEMP.
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {mkdtemp} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const base='http://127.0.0.1:4191',dir=await mkdtemp(path.join(tmpdir(),'tal-overhaul-'));
const server=spawn(process.execPath,[fileURLToPath(new URL('./s16/gallery-server.mjs',import.meta.url))],{env:{...process.env,TAL_GALLERY_PORT:'4191'},stdio:['ignore','pipe','pipe']});
let browser,passes=0;
const check=async(name,fn)=>{await fn();console.log('PASS '+name);passes++;};
try{
 await once(server.stdout,'data');browser=await chromium.launch();
 const page=await browser.newPage({viewport:{width:1440,height:960}}),errors=[],bad=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 page.on('response',r=>{if(r.status()>=400)bad.push(r.status()+' '+new URL(r.url()).pathname);});
 await page.route('**/*',r=>new URL(r.request().url()).origin===base?r.continue():r.abort());
 const geometry=async()=>{
  const g=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,dialog:[...document.querySelectorAll('dialog[open]')].map(e=>({x:e.getBoundingClientRect().x,right:e.getBoundingClientRect().right,top:e.getBoundingClientRect().top,bottom:e.getBoundingClientRect().bottom,height:innerHeight,scroll:e.scrollWidth,width:e.clientWidth}))}));
  assert.ok(g.scroll<=g.width+1,JSON.stringify(g));for(const d of g.dialog)assert.ok(d.x>=0&&d.right<=g.width+1&&d.top>=0&&d.bottom<=d.height+1&&d.scroll<=d.width+1,JSON.stringify(d));
 };
 await check('15 routes at 1440/1024/390/375 without overflow',async()=>{
  await page.goto(base+'/app/#/io/oggi');await page.locator('.income-hero').waitFor();
  for(const role of ['personal','studio']){
   if(role==='studio'){
    await page.getByRole('button',{name:'Account',exact:true}).click();await page.getByRole('button',{name:'Cambia profilo',exact:true}).click();
    await page.getByRole('button',{name:'Studio di prova Gestisci i clienti dello Studio'}).click();
   }
   const routes=role==='personal'?['io/oggi','io/entrate','io/tasse','io/attivita','io/documenti','io/dichiarazione','io/pagamenti']:['studio/da-fare','studio/clienti',...['oggi','entrate','tasse','attivita','dichiarazione','pagamenti'].map(x=>'studio/clienti/synthetic-position/'+x)];
   for(const route of routes){
    await page.goto(base+'/app/#/'+route);await page.locator('#main h1').waitFor();await page.waitForTimeout(450);
    for(const width of [1440,1024,390,375]){await page.setViewportSize({width,height:width<500?844:960});await geometry();if([1440,375].includes(width))await page.screenshot({path:path.join(dir,route.replaceAll('/','-')+'-'+width+'.png'),fullPage:true});}
   }
  }
 });
 await check('invoice, import and payment panels fit; keyboard and focus return',async()=>{
  for(const width of [1440,1024,390,375]){
   await page.setViewportSize({width,height:width<500?844:960});await page.goto(base+'/app/#/studio/clienti/synthetic-position/entrate');
   await page.getByRole('button',{name:'Aggiungi fattura',exact:true}).click();await page.locator('#panel[open]').waitFor();await geometry();
   assert.equal(await page.locator('#panel').evaluate(e=>e.contains(document.activeElement)),true);await page.keyboard.press('Escape');await page.locator('#panel').waitFor({state:'hidden'});
   assert.equal(await page.evaluate(()=>document.activeElement?.textContent),'Aggiungi fattura');
   await page.getByRole('button',{name:'Importa',exact:true}).click();await page.locator('#panel[open]').waitFor();await geometry();await page.keyboard.press('Escape');await page.locator('#panel').waitFor({state:'hidden'});
   await page.goto(base+'/app/#/studio/clienti/synthetic-position/pagamenti');await page.getByRole('button',{name:'Verifica versamenti e crediti',exact:true}).click();await page.locator('#panel[open]').waitFor();await geometry();
   await page.screenshot({path:path.join(dir,'payment-panel-'+width+'.png'),fullPage:true});await page.keyboard.press('Escape');await page.locator('#panel').waitFor({state:'hidden'});
  }
 });
 await check('22 rare/loading/error/onboarding states at four widths',async()=>{
  await page.goto(base+'/');const names=await page.locator('#state option').allTextContents();assert.equal(names.length,22);
  for(const [index,name] of names.entries()){
   await page.locator('#state').selectOption(name);await page.waitForTimeout(80);
   for(const width of [1440,1024,390,375]){await page.setViewportSize({width,height:width<500?844:960});await geometry();if([1440,375].includes(width))await page.screenshot({path:path.join(dir,'state-'+index+'-'+width+'.png'),fullPage:true});}
  }
 });
 await check('background refresh does not replay page/detail animations',async()=>{
  await page.goto(base+'/app/#/io/oggi');await page.getByRole('button',{name:'Account',exact:true}).click();await page.getByRole('button',{name:'Cambia profilo',exact:true}).click();await page.getByRole('button',{name:/La mia attività/}).click();
  await page.goto(base+'/app/#/io/tasse');await page.locator('.tax-layout').waitFor();await page.waitForTimeout(800);
  await page.evaluate(()=>{window.reviewAnimations=[];document.addEventListener('animationstart',e=>{if(e.target.closest('#main'))window.reviewAnimations.push(e.animationName);});});
  await page.waitForTimeout(31000);
  const names=await page.evaluate(()=>window.reviewAnimations);assert.deepEqual(names,[],'refresh animations: '+names);
 });
 await check('error notice has no success-only check icon',async()=>{
  await page.goto(base+'/app/#/io/attivita');await page.locator('[data-action=document]').first().click();await page.getByText('Operazione non completata. Riprova.',{exact:true}).waitFor();
  const icon=await page.locator('#notice').evaluate(e=>getComputedStyle(e,'::before').backgroundImage);assert.ok(!icon.includes('m6%2012')&&!icon.includes('m6 12'),'error displayed with success check');
 });
 await check('semantic badges retain colour and text contrast; dark-card keyboard focus',async()=>{
  for(const route of ['io/oggi','studio/clienti/synthetic-position/oggi']){
   if(route.startsWith('studio')){await page.getByRole('button',{name:'Account',exact:true}).click();await page.getByRole('button',{name:'Cambia profilo',exact:true}).click();await page.getByRole('button',{name:/Studio di prova Gestisci/}).click();}
   await page.goto(base+'/app/#/'+route);await page.locator('#main .status-badge').first().waitFor();
   const colors=await page.locator('#main .status-badge').evaluateAll(es=>es.map(e=>({tone:[...e.classList].find(c=>c.startsWith('tone-')),fg:getComputedStyle(e).color,bg:getComputedStyle(e).backgroundColor})));
   const palette={'tone-info':'rgb(20, 83, 104)','tone-ok':'rgb(46, 107, 61)','tone-violet':'rgb(91, 58, 140)','tone-warn':'rgb(122, 92, 16)','tone-neutral':'rgb(71, 68, 63)'};
   const lum=c=>c.match(/\d+/g).slice(0,3).map(Number).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;}).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0);
   for(const c of colors){assert.equal(c.fg,palette[c.tone]);assert.ok((Math.max(lum(c.fg),lum(c.bg))+.05)/(Math.min(lum(c.fg),lum(c.bg))+.05)>=4.5,JSON.stringify(c));}
   if(route==='io/oggi'){
    await page.getByRole('link',{name:'Vedi entrate',exact:true}).focus();
    assert.equal(await page.evaluate(()=>getComputedStyle(document.activeElement).outlineColor),'rgb(255, 255, 255)');
   }
  }
 });
 await check('overdue F24 warning and preview fit at four widths without performing a payment',async()=>{
  // Only change synthetic fixture dates; render the actual, unchanged payment UI.
  await page.route('**/app/test-support/s16/app-runtime.mjs',async route=>{const r=await route.fetch();await route.fulfill({response:r,body:(await r.text()).replaceAll('2026-11-30','2020-11-30')});});
  await page.goto(base+'/app/?fixture=overdue#/io/pagamenti');await page.getByText('Scadenza superata',{exact:true}).waitFor();
  for(const width of [1440,1024,390,375]){
   await page.setViewportSize({width,height:width<500?844:960});await page.getByRole('button',{name:'Controlla F24',exact:true}).click();await page.locator('#panel[open]').waitFor();await geometry();
   assert.match(await page.locator('#panel [role=alert]').allTextContents().then(x=>x.join(' ')),/ravvedimento/);
   assert.ok(await page.getByRole('button',{name:'Scarica F24 PDF',exact:true}).isVisible());
   await page.screenshot({path:path.join(dir,'overdue-f24-'+width+'.png'),fullPage:true});await page.keyboard.press('Escape');await page.locator('#panel').waitFor({state:'hidden'});
  }
 });
 await check('reduced motion removes all animated states',async()=>{
  await page.emulateMedia({reducedMotion:'reduce'});await page.goto(base+'/app/#/io/tasse');await page.locator('.tax-layout').waitFor();
  assert.deepEqual(await page.evaluate(()=>document.getAnimations().map(a=>a.animationName)),[]);
 });
 await check('no console errors or failed resources',async()=>{assert.deepEqual(errors,[]);assert.deepEqual(bad,[]);});
 console.log('RESULT '+passes+' checks PASS; screenshots '+dir);
}finally{await browser?.close();server.kill();}
