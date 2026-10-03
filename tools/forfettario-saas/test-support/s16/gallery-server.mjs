// Run manually: node tools/forfettario-saas/test-support/s16/gallery-server.mjs
// Loopback-only presentation gallery. Not served by serve-dev or imported by the app.
import http from 'node:http';
import {readFile,realpath} from 'node:fs/promises';
import path from 'node:path';
const safeRead=async file=>{const base=await realpath(root),target=await realpath(file),r=path.relative(base,target);if(r==='..'||r.startsWith('..'+path.sep)||path.isAbsolute(r))throw Error('Outside root');return readFile(target);};
const app=new URL('../../',import.meta.url),root=new URL('../../../../',import.meta.url);
const views=new Set(['auth-view.js','fiscal-view.js','declaration-view.js','payments-view.js','collaboration-view.js','onboarding-ui.js','onboarding-service.js','app.css']);
const html=`<!doctype html><html lang="it"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>S16 · Stati simulati</title><link rel="icon" href="data:,"><link rel="stylesheet" href="/assets/fonts/fonts.css"><link rel="stylesheet" href="/app.css"><body><header class="page"><div class="field"><label for="state">S16 · Galleria locale · dati e sessioni simulati</label><select id="state"></select></div></header><div id="preview"></div><script type="module" src="/test-support/s16/gallery.mjs"></script></body></html>`;
views.add('product-ui.js');views.add('workflow-view.js');
const port=Number(process.env.TAL_GALLERY_PORT)||4179;
http.createServer(async(req,res)=>{
 res.setHeader('Cache-Control','no-store');res.setHeader('Content-Security-Policy',"default-src 'self'; connect-src 'none'; img-src 'self' data:; object-src 'none'; base-uri 'none'; form-action 'none'");
 try{const p=new URL(req.url,'http://127.0.0.1').pathname;
  if(p==='/')return res.setHeader('Content-Type','text/html; charset=utf-8'),res.end(html);
  if(p.startsWith('/app/')){
   const n=p.slice(5)||'index.html';
   if(['auth-runtime.js','tal-data-runtime.js'].includes(n)){res.setHeader('Content-Type','text/javascript');return res.end(`export {${n==='auth-runtime.js'?'auth':'cloud,service'}} from './test-support/s16/app-runtime.mjs';`);}
   const support=['test-support/s16/states.mjs','test-support/s16/app-runtime.mjs'].includes(n);
   if(!support&&(!/^[a-z0-9.-]+\.(js|css|svg|html)$/.test(n)||n.includes('config')))return res.writeHead(404).end();
   let bytes=await safeRead(new URL(n,app));
   if(n==='index.html')bytes=Buffer.from(bytes.toString().replace(/<meta[^>]+http-equiv="Content-Security-Policy"[^>]*>/,''));
   if(n==='app.js')bytes=Buffer.from(bytes.toString().replaceAll('Ambiente di sviluppo · dati sintetici','TEST VISIVO · sessione simulata'));
   res.setHeader('Content-Type',n.endsWith('.css')?'text/css':n.endsWith('.svg')?'image/svg+xml':n.endsWith('.html')?'text/html; charset=utf-8':'text/javascript; charset=utf-8');return res.end(bytes);
  }
  const gallery=['/test-support/s16/gallery.mjs','/test-support/s16/states.mjs'].includes(p),font=/^\/assets\/fonts\/[\w/-]+\.(css|woff2)$/.test(p);
  if(!gallery&&!font&&!views.has(p.slice(1)))return res.writeHead(404).end();
  const target=new URL(p.slice(1),font?root:app);
  res.setHeader('Content-Type',p.endsWith('.css')?'text/css':p.endsWith('.woff2')?'font/woff2':'text/javascript; charset=utf-8');res.end(await safeRead(target));
 }catch{res.writeHead(404).end();}
}).listen(port,'127.0.0.1',()=>console.log('S16 visual states: http://127.0.0.1:'+port+' · no external connections'));
