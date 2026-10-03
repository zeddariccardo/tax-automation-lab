import {readFile,writeFile,mkdir,copyFile,readdir,stat} from 'node:fs/promises';
import path from 'node:path';import {fileURLToPath} from 'node:url';
import {validateEnvironment} from './environment-config.js';
const source=path.dirname(fileURLToPath(import.meta.url)),root=path.resolve(source,'../..');
// No default production target. The operator supplies independently approved bindings.
export async function buildSaas({config,binding,forbiddenResources,output}) {
 if(config.environment!=='production'||binding.environment!=='production')throw Error('PRODUCTION_MANIFEST_REQUIRED');
 validateEnvironment(config,binding);
 if(!Array.isArray(forbiddenResources)||!forbiddenResources.length)throw Error('DEVELOPMENT_RESOURCE_INVENTORY_REQUIRED');
 if(forbiddenResources.some(s=>JSON.stringify({config,binding}).includes(s)))throw Error('DEVELOPMENT_RESOURCE_FORBIDDEN');
 if(!/^sb_publishable_[A-Za-z0-9_-]{20,}$/.test(config.publishableKey)||Object.keys(config).some(k=>/secret|password|token|credential/i.test(k)))throw Error('PUBLIC_CONFIG_ONLY');
 if(config.supabaseUrl!==binding.approvedSupabaseUrl||!binding.publicSiteOrigin)throw Error('APPROVED_PRODUCTION_PROJECT_REQUIRED');
 const out=path.resolve(output);
 try{await stat(out);throw Error('OUTPUT_MUST_BE_NEW');}catch(e){if(e.code!=='ENOENT')throw e;}
 const prefix='tools/forfettario-saas/',files=new Set(['index.html','app.css','mark.svg','environment-binding.js','runtime-config.js']);
 async function module(name) {
  if(files.has(name))return; if(!/^[\w.-]+\.js$/.test(name)||/test|config\.local|demo-service/.test(name))throw Error('NON_RUNTIME_IMPORT');
  files.add(name);const body=await readFile(path.join(source,name),'utf8');
  for(const m of body.matchAll(/(?:from\s*|import\s*\(\s*)['"](\.\/[\w.-]+\.js)['"]/g))await module(m[1].slice(2));
 }
 await module('app.js');
 // JS-generated vendor loading is explicitly part of the runtime manifest.
 const assets=['assets/vendor/sheetjs-0.20.3.min.js'];
 async function fonts(dir) {for(const item of await readdir(path.join(root,dir),{withFileTypes:true})){
  const f=dir+'/'+item.name;if(item.isDirectory())await fonts(f);else if(/\.(css|woff2)$/.test(f))assets.push(f);
 }}await fonts('assets/fonts');
 const template=await readFile(path.join(source,'index.html'),'utf8');
 const csp=template.match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)"/)[1]
  .replaceAll('https://*.supabase.co',config.supabaseUrl)
  .replace('; object-src',' '+config.supabaseUrl+'/rest/v1/rpc/tal_my_studio_security; object-src')
  + "; frame-ancestors 'none'; upgrade-insecure-requests";
 // Runtime API allowlist, pinned provider; no generic REST/functions namespaces.
 const headers={'Content-Security-Policy':csp,'X-Frame-Options':'DENY','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Cache-Control':'no-store','Permissions-Policy':'camera=(), microphone=(), geolocation=()'};
 const outputFiles=[];
 for(const name of files){
  let data=name==='runtime-config.js'?'export default '+JSON.stringify(config)+';':name==='environment-binding.js'?'export default '+JSON.stringify(binding)+';':await readFile(path.join(source,name));
  if(name==='index.html')data=data.toString().replace(/\s*<meta http-equiv="Content-Security-Policy"[^>]+>/,'');
  const relative=prefix+name;
  if(/\.(js|html|css)$/.test(name)&&/(?:TAL-S\d.*(?:auth|PAT)|sb_secret_|service_role_key|@[^\s'"]+\.test\b|config\.local\.js)/.test(String(data)))throw Error('ARTIFACT_HYGIENE_'+name);
  await mkdir(path.dirname(path.join(out,relative)),{recursive:true});await writeFile(path.join(out,relative),data);outputFiles.push(relative);
 }
 for(const a of assets){await mkdir(path.dirname(path.join(out,a)),{recursive:true});await copyFile(path.join(root,a),path.join(out,a));outputFiles.push(a);}
 await writeFile(path.join(out,'_headers'),'/*\n'+Object.entries(headers).map(([k,v])=>'  '+k+': '+v).join('\n')+'\n');
 await writeFile(path.join(out,'_redirects'),'/ /tools/forfettario-saas/ 302\n');
 const manifest={files:outputFiles,headers,origin:config.saasOrigin,environment:config.environment};
 await writeFile(path.join(out,'artifact-manifest.json'),JSON.stringify(manifest,null,2));
 return manifest;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const input=JSON.parse(await readFile(process.argv[2],'utf8'));await buildSaas({...input,output:process.argv[3]});console.log('SaaS artifact built; no deployment performed.');
}
