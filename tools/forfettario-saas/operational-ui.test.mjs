import test from 'node:test';import assert from 'node:assert/strict';
import http from 'node:http';import {readFile,mkdir} from 'node:fs/promises';import os from 'node:os';import path from 'node:path';import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';import {authEntry} from './auth-view.js';
test('native MFA surface: labeled controls, keyboard, 1440/1024/390/375, no overflow or network',async()=>{
 const dir=path.dirname(fileURLToPath(import.meta.url)),root=path.resolve(dir,'../..');
 const css=await readFile(path.join(dir,'app.css'),'utf8');
 const esc=x=>String(x||'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
 const markup=enrolled=>authEntry({access:{phase:'mfa',message:'',mfa:{enrolled,secret:enrolled?'SYNTHETICTESTKEYONLY234567ABCDEFGH':''}},brand:()=>'<strong>TAL</strong>',icon:()=>'',esc,button:(a,t)=>`<button class="button" data-action="${a}">${t}</button>`});
 const server=http.createServer(async(req,res)=>{
  const url=new URL(req.url,'http://127.0.0.1');
  if(url.pathname==='/app.css'){res.setHeader('Content-Type','text/css');return res.end(css);}
  if(/^\/assets\/fonts\/[A-Za-z0-9/_-]+\.(css|woff2)$/.test(url.pathname)){
   try{res.setHeader('Content-Type',url.pathname.endsWith('.css')?'text/css':'font/woff2');return res.end(await readFile(path.join(root,url.pathname)));}catch{return res.writeHead(404).end();}
  }
  if(url.pathname!=='/')return res.writeHead(404).end();
  res.setHeader('Content-Type','text/html; charset=utf-8');res.end('<!doctype html><html lang="it"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/app.css"><body>'+markup(url.searchParams.has('enrolled'))+'</body></html>');
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const browser=await chromium.launch({headless:true}),page=await browser.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)errors.push(String(r.status()));});
 try{
  const origin='http://127.0.0.1:'+server.address().port;
  page.on('request',r=>assert.ok(r.url().startsWith(origin),'external request'));
  for(const width of [1440,1024,390,375])for(const enrolled of [false,true]){
   await page.setViewportSize({width,height:850});await page.goto(origin+(enrolled?'/?enrolled':''));
   await page.getByRole('heading',{name:'Verifica in due passaggi'}).waitFor();
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
   if(enrolled){const input=page.getByLabel('Codice a 6 cifre');await input.fill('123456');await input.press('Tab');assert.equal(await page.evaluate(()=>document.activeElement.textContent),'Verifica');}
   if(width===375&&enrolled){const out=path.join(os.tmpdir(),'tal-s18b-ui');await mkdir(out,{recursive:true});await page.screenshot({path:path.join(out,'mfa-375.png'),fullPage:true});}
  }
  assert.deepEqual(errors,[]);
 }finally{await browser.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
});
