// Presentation regression using the existing isolated S16 gallery; no hosted access.
// Run: node tools/forfettario-saas/test-support/product-ui.e2e.mjs
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {mkdtemp} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
const port=Number(process.env.TAL_UI_TEST_PORT)||4187,base='http://127.0.0.1:'+port;
const server=spawn(process.execPath,[fileURLToPath(new URL('./s16/gallery-server.mjs',import.meta.url))],{env:{...process.env,TAL_GALLERY_PORT:String(port)},stdio:['ignore','pipe','pipe']});
let browser,passed=0;
const check=async(name,fn)=>{await fn();passed++;console.log('PASS '+name);};
try{
 await Promise.race([once(server.stdout,'data'),once(server,'exit').then(()=>{throw Error('Gallery failed to start');})]);
 browser=await chromium.launch();
 const page=await browser.newPage({viewport:{width:1440,height:900},reducedMotion:'no-preference'});
 const errors=[],badResponses=[],external=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 page.on('response',r=>{if(r.status()>=400)badResponses.push(r.status()+' '+r.url());});
 await page.route('**/*',route=>{
  if(new URL(route.request().url()).origin!==base){external.push(route.request().url());return route.abort();}
  return route.continue();
 });
 const search=page.getByRole('combobox',{name:'Cerca nel Forfettario'});
 const goHome=async()=>{await page.goto(base+'/app/#/io/oggi');await page.reload();await search.waitFor();};
 const logout=async()=>{await page.getByRole('button',{name:'Account',exact:true}).click();await page.getByRole('button',{name:'Esci',exact:true}).click();await page.locator('.hero-access').waitFor();};
 const chooseStudio=async()=>{await page.getByRole('button',{name:'Account',exact:true}).click();await page.getByRole('button',{name:'Cambia profilo',exact:true}).click();await page.getByRole('button',{name:'Studio di prova Gestisci i clienti dello Studio'}).click();await search.waitFor();};
 await check('personal search: keyboard, Escape, outside click, shortcut and real navigation',async()=>{
  await goHome();await search.fill('dove inserisco una fattura?');
  assert.deepEqual(await page.locator('#product-results').getByRole('option').allTextContents(),['EntrateFatture, incassi e importazione.']);
  await search.press('ArrowDown');assert.equal(await search.getAttribute('aria-activedescendant'),'product-option-0');
  await search.press('Escape');assert.equal(await search.getAttribute('aria-expanded'),'false');
  await page.keyboard.press('Control+k');assert.equal(await search.getAttribute('aria-expanded'),'true');
  await page.getByRole('heading',{name:'Oggi',exact:true}).click();assert.equal(await search.getAttribute('aria-expanded'),'false');
  await search.fill('fatture');await search.press('ArrowUp');await search.press('Enter');
  await page.waitForURL('**/#/io/entrate');assert.equal(await page.locator('#main h1').textContent(),'Entrate');
 });
 await check('Studio root and selected client never reuse personal search scope',async()=>{
  await goHome();await chooseStudio();await search.fill('fatture');
  assert.deepEqual(await page.locator('#product-results').getByRole('option').allTextContents(),['ClientiApri una posizione collegata per consultarne i dati.']);
  await search.press('ArrowDown');await search.press('Enter');await page.getByRole('link',{name:'Cliente sintetico S16',exact:true}).click();
  await search.fill('saldo');await search.press('ArrowDown');await search.press('Enter');
  await page.waitForURL('**/#/studio/clienti/synthetic-position/pagamenti');
 });
 await check('existing checkbox is native, labelled, keyboard operable and focus visible',async()=>{
  await page.getByRole('button',{name:'Verifica versamenti e crediti'}).click();
  await page.locator('#panel summary').click();
  const cb=page.getByRole('checkbox',{name:'Associazione di tutte le attività al perimetro verificata'});
  await cb.focus();await cb.press('Space');assert.equal(await cb.isChecked(),true);
  await cb.evaluate(e=>Promise.all(e.getAnimations().map(a=>a.finished)));
  const styles=await cb.evaluate(e=>({tag:e.tagName,type:e.type,color:getComputedStyle(e).backgroundColor,outline:getComputedStyle(e).outlineWidth,transform:getComputedStyle(e).transform,labelHeight:e.labels[0].getBoundingClientRect().height}));
  assert.equal(styles.tag,'INPUT');assert.equal(styles.type,'checkbox');assert.equal(styles.color,'rgb(20, 83, 104)');
  assert.ok(parseFloat(styles.outline)>=3);assert.ok(styles.labelHeight>=44);
  await cb.press('Space');assert.equal(await cb.isChecked(),false);
  await page.keyboard.press('Escape');
 });
 await check('logged-out hero and search both use existing Auth form, never operational routes',async()=>{
  await logout();assert.equal(await page.locator('h1').count(),1);
  await search.fill('quanto devo pagare?');assert.equal(await page.locator('#product-results').getByRole('option').count(),1);
  await search.press('ArrowDown');await search.press('Enter');
  assert.equal(await page.locator('#login-email').evaluate(e=>document.activeElement===e),true);
  await page.locator('.hero-access').click();
  assert.equal(await page.locator('#login-email').evaluate(e=>document.activeElement===e),true);
  assert.equal(await page.locator('#login-form').count(),1);
  assert.equal(await page.locator('.hero-access').count(),1);
  assert.equal(await page.locator('#auth-error').textContent(),'');
 });
 await check('responsive hero/search at 1440, 1024, 390 and 375; no horizontal overflow',async()=>{
  for(const width of [1440,1024,390,375]){
   await page.setViewportSize({width,height:width<500?812:900});
   await search.fill('documenti');
   const geometry=await page.evaluate(()=>{
    const a=document.querySelector('.hero-fixed'),b=document.querySelector('.hero-word'),popup=document.querySelector('.product-search-popup');
    const typ=e=>{const s=getComputedStyle(e);return [s.fontFamily,s.fontSize,s.fontWeight,s.lineHeight];};
    return {width:innerWidth,scroll:document.documentElement.scrollWidth,typA:typ(a),typB:typ(b),popup:popup.getBoundingClientRect().toJSON()};
   });
   assert.ok(geometry.scroll<=width+1,JSON.stringify(geometry));assert.deepEqual(geometry.typA,geometry.typB);
   assert.ok(geometry.popup.left>=0&&geometry.popup.right<=width+1);
   await search.press('Escape');
  }
 });
 await check('loop holds five words then seamless repeated first word, without moving the layout',async()=>{
  await page.setViewportSize({width:1440,height:900});
  const geometry=await page.evaluate(()=>{
   const track=document.querySelector('.hero-track'),a=track.getAnimations()[0],word=track.firstElementChild;
   a.pause();
   const samples=[0,2150,4300,6450,8600,10749.9].map(t=>{
    a.currentTime=t;
    const p=document.querySelector('.hero-window').getBoundingClientRect(),cta=document.querySelector('.hero-access').getBoundingClientRect();
    return {offset:new DOMMatrix(getComputedStyle(track).transform).m42,top:p.top,width:p.width,ctaTop:cta.top};
   });
   const h=word.getBoundingClientRect().height;a.play();
   return {samples,h,duration:a.effect.getTiming().duration};
  });
  assert.equal(geometry.duration,10750);
  geometry.samples.forEach((x,i)=>{assert.ok(Math.abs(x.offset+i*geometry.h)<.1);assert.equal(x.top,geometry.samples[0].top);assert.equal(x.width,geometry.samples[0].width);assert.equal(x.ctaTop,geometry.samples[0].ctaTop);});
  await page.locator('.hero-motion').click();
  assert.equal(await page.locator('.hero-track').evaluate(e=>getComputedStyle(e).animationPlayState),'paused');
  await page.locator('.hero-motion').click();
 });
 await check('reduced motion: static phrase, hidden pause, no rotating checkbox',async()=>{
  await page.emulateMedia({reducedMotion:'reduce'});
  assert.equal(await page.locator('.hero-track').evaluate(e=>getComputedStyle(e).animationName),'none');
  assert.equal(await page.locator('.hero-motion').isVisible(),false);
  await goHome();await chooseStudio();await page.getByRole('link',{name:'Clienti',exact:true}).click();
  await page.getByRole('link',{name:'Cliente sintetico S16',exact:true}).click();
  await search.fill('saldo');await search.press('ArrowDown');await search.press('Enter');
  await page.getByRole('button',{name:'Verifica versamenti e crediti'}).click();await page.locator('#panel summary').click();
  const cb=page.getByRole('checkbox',{name:'Associazione di tutte le attività al perimetro verificata'});
  await cb.check();assert.equal(await cb.evaluate(e=>getComputedStyle(e).transform),'none');await page.keyboard.press('Escape');
 });
 await check('new foreground/control colours have adequate contrast',async()=>{
  const lum=hex=>{const v=hex.match(/../g).map(h=>parseInt(h,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return v[0]*.2126+v[1]*.7152+v[2]*.0722;};
  const ratio=(a,b)=>(Math.max(lum(a),lum(b))+.05)/(Math.min(lum(a),lum(b))+.05);
  for(const [fg,bg] of [['6E6B65','F6F5F1'],['5B3A8C','F6F5F1'],['145368','F6F5F1'],['FFFFFF','5B3A8C'],['FFFFFF','6D3C99'],['FFFFFF','145368'],['47443F','FFFFFF']])assert.ok(ratio(fg,bg)>=4.5,fg+'/'+bg);
 });
 await check('no console errors, 404 or external requests',async()=>{
  assert.deepEqual(errors,[]);assert.deepEqual(badResponses,[]);assert.deepEqual(external,[]);
 });
 await logout();
 const artifacts=await mkdtemp(path.join(tmpdir(),'tal-product-ui-'));
 await page.setViewportSize({width:1440,height:900});await page.screenshot({path:path.join(artifacts,'entry-desktop.png'),fullPage:true});
 await page.setViewportSize({width:375,height:812});await page.screenshot({path:path.join(artifacts,'entry-mobile.png'),fullPage:true});
 console.log('Screenshots (outside repository): '+artifacts);
 console.log(passed+'/'+passed+' product UI browser checks PASS; synthetic local gallery only.');
}finally{await browser?.close();server.kill();}
