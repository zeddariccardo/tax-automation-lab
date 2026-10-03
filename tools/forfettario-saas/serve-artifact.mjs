// Acceptance server for the SAME header manifest deployed on a dedicated origin.
import http from 'node:http';import {readFile,realpath} from 'node:fs/promises';import path from 'node:path';import {fileURLToPath} from 'node:url';
export async function serveArtifact(directory,port=4178){
const root=await realpath(directory),manifest=JSON.parse(await readFile(path.join(root,'artifact-manifest.json'),'utf8'));
const allowed=new Set(manifest.files),types={'.js':'text/javascript','.css':'text/css','.html':'text/html','.woff2':'font/woff2','.svg':'image/svg+xml'};
const server=http.createServer(async(req,res)=>{
 for(const[k,v]of Object.entries(manifest.headers))res.setHeader(k,v);
 try{
  if(!['GET','HEAD'].includes(req.method))return res.writeHead(405).end();
  let name=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname).slice(1);
  if(name==='')return res.writeHead(302,{Location:'/tools/forfettario-saas/'}).end();
  if(name==='tools/forfettario-saas/')name+='index.html';
  if(!allowed.has(name))return res.writeHead(404).end();
  const file=await realpath(path.join(root,name)),rel=path.relative(root,file);
  if(rel==='..'||rel.startsWith('..'+path.sep)||path.isAbsolute(rel))return res.writeHead(404).end();
  const data=await readFile(file);res.setHeader('Content-Type',types[path.extname(name)]||'application/octet-stream');
  res.end(req.method==='HEAD'?undefined:data);
 }catch{res.writeHead(404).end();}
});
await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve);});return server;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const server=await serveArtifact(process.argv[2],Number(process.env.TAL_ARTIFACT_PORT||4178));
 console.log('Artifact loopback server ready on '+server.address().port);
}
