// Local static preview only. Resolve both root and target before reading bytes.
import http from 'node:http';
import {readFile,realpath,stat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=await realpath(fileURLToPath(new URL('../',import.meta.url)));
const port=Number(process.argv[2]||4173);
if(!Number.isInteger(port)||port<1||port>65535)throw Error('Invalid preview port');
const inside=p=>{const r=path.relative(root,p);return r!=='..'&&!r.startsWith('..'+path.sep)&&!path.isAbsolute(r);};
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.woff2':'font/woff2','.json':'application/json','.ico':'image/x-icon','.pdf':'application/pdf'};
http.createServer(async(req,res)=>{
 res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
 if(!['GET','HEAD'].includes(req.method)){res.writeHead(405).end();return;}
 try{
  const name=decodeURIComponent(req.url.split('?')[0]);
  if(name.split(/[\\/]/).some(s=>s.startsWith('.')&&s!=='.'&&s!=='..'))throw Error('Hidden path');
  let target=path.resolve(root,'.'+path.sep+name.replace(/^[\\/]+/,''));
  if(!inside(target))throw Error('Outside root');
  target=await realpath(target);if(!inside(target))throw Error('Outside root');
  if((await stat(target)).isDirectory())target=await realpath(path.join(target,'index.html'));
  if(!inside(target)||(await stat(target)).isFile()===false)throw Error('Outside root');
  const bytes=await readFile(target);res.setHeader('Content-Type',types[path.extname(target)]||'application/octet-stream');res.end(req.method==='HEAD'?undefined:bytes);
 }catch{res.writeHead(404).end();}
}).listen(port,'127.0.0.1',()=>console.log('TAL static preview: http://127.0.0.1:'+port));
