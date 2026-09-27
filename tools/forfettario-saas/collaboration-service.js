// S05 commands, real user sessions only. No Storage reads or technical attestation here.
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const fail=code=>Object.assign(Error(code),{code});
const context=s=>s.context.context_type+':'+s.context.context_id;
const cols={document:'id,workspace_id,original_filename,media_type,size_bytes,sha256,upload_status,revision,created_at,ready_at,expires_at,uploader_context',activity_feed_item:'id,workspace_id,actor_id,actor_context,kind,body,document_id,reply_to,recipient_context,status,revision,created_at,updated_at',tax_workspace:'id,status',studio_client_link:'id,workspace_id,studio_id,status'};
export const MAX_DOCUMENT_BYTES=10*1024*1024;
export function documentType(file){
 const ext=file.name?.split('.').pop()?.toLowerCase();const mime={pdf:'application/pdf',png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',xml:'application/xml'}[ext];
 if(!mime||!Number.isSafeInteger(file.size)||file.size<1||file.size>MAX_DOCUMENT_BYTES||file.name.length>180)throw fail('file');
 if(file.type&&file.type!==mime&&!(ext==='xml'&&file.type==='text/xml'))throw fail('file');return mime;
}
export async function hashBytes(bytes){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');}
export function createCollaborationService({auth,fetchImpl}){
 const jobs=new Map();let scope='';
 const actor=()=>{const s=auth.getState();return s.phase==='ready'?s.user.id+':'+s.selected.context_type+':'+s.selected.context_id:'';};
 auth.subscribe?.(()=>{if(scope!==actor()){scope=actor();jobs.clear();}});
 async function request(s,path,{method='GET',body,headers={},binary=false}={}){
  let r;try{r=await fetchImpl(s.config.supabaseUrl+path,{method,credentials:'omit',redirect:'error',cache:'no-store',signal:AbortSignal.timeout(40000),headers:{apikey:s.config.publishableKey,Authorization:'Bearer '+s.token,'x-tal-context':context(s),...(path.startsWith('/rest/v1/')&&method==='GET'?{'Accept-Profile':'tal'}:{}),...(!binary?{'Content-Type':'application/json'}:{}),...headers},body:body===undefined?undefined:binary?body:JSON.stringify(body)});}catch{throw fail(method==='GET'?'unavailable':'uncertain');}
  return r;
 }
 async function json(r){let data;try{data=await r.json();}catch{if(r.ok)throw fail('uncertain');data={};}
  if(!r.ok){const code=data?.code;throw fail(data?.message==='DOCUMENT_USED_BY_COMPLETED_REQUEST'?'evidence':code==='40001'||code==='PT409'||r.status===409?'conflict':r.status===401?'expired':[403,404].includes(r.status)?'forbidden':r.status===422?'file':r.status>=500?'uncertain':'invalid');}return data;
 }
 async function rows(s,table,filter={}){
  const out=[];for(let offset=0;;){const q=new URLSearchParams({select:cols[table],...filter,order:'created_at' in filter?'created_at.asc,id.asc':'id.asc',limit:'200',offset:String(offset)});
   const r=await request(s,'/rest/v1/'+table+'?'+q,{headers:{Prefer:'count=exact'}});const total=Number(r.headers.get('content-range')?.match(/\/(\d+)$/)?.[1]);const page=await json(r);
   if(!Array.isArray(page)||page.some(x=>!uuid.test(x.id))||!Number.isSafeInteger(total))throw fail('unavailable');out.push(...page);offset+=page.length;if(offset>=total)break;if(!page.length||offset>10000)throw fail('unavailable');
  }if(new Set(out.map(x=>x.id)).size!==out.length)throw fail('unavailable');return out;
 }
 async function load(s,id){
  if(!uuid.test(id))throw fail('forbidden');const filter={workspace_id:'eq.'+id};
  const[activities,documents,links]=await Promise.all([rows(s,'activity_feed_item',filter),rows(s,'document',{...filter,deleted_at:'is.null',upload_status:'eq.ready'}),rows(s,'studio_client_link',{...filter,status:'eq.active'})]);
  if(!(await rows(s,'tax_workspace',{id:'eq.'+id,status:'eq.active'})).length)throw fail('forbidden');
  return{workspaceId:id,activities:activities.sort((a,b)=>a.created_at.localeCompare(b.created_at)||a.id.localeCompare(b.id)),documents,links};
 }
 function command(name,id,payload,key){
  if(!uuid.test(id)||!uuid.test(key)||!scope)return Promise.reject(fail('invalid'));
  const stamp=JSON.stringify([name,id,payload]),k=scope+':'+key;
  if(jobs.has(k)){const old=jobs.get(k);return old.stamp===stamp?old.promise:Promise.reject(fail('idempotency'));}
  const promise=auth.withContextSession(async s=>json(await request(s,'/rest/v1/rpc/'+name,{method:'POST',headers:{'Content-Profile':'public'},body:{p_workspace_id:id,p_context:context(s),p_idempotency_key:key,p_payload:structuredClone(payload)}})));
  jobs.set(k,{stamp,promise});promise.then(()=>jobs.delete(k),()=>jobs.delete(k));if(jobs.size>100)jobs.delete(jobs.keys().next().value);return promise;
 }
 const api={
  listCollaboration:id=>auth.withContextSession(s=>load(s,id)),
  listCollaborationQueue:ids=>auth.withContextSession(async s=>{
   if(!ids.length)return[];if(ids.length===1)return[await load(s,ids[0])];
   if(ids.some(id=>!uuid.test(id)))throw fail('forbidden');
   const wanted=[...new Set(ids)],scopeFilter='in.('+wanted.join(',')+')';
   const[activities,documents,links]=await Promise.all([rows(s,'activity_feed_item',{workspace_id:scopeFilter}),rows(s,'document',{workspace_id:scopeFilter,deleted_at:'is.null',upload_status:'eq.ready'}),rows(s,'studio_client_link',{workspace_id:scopeFilter,status:'eq.active'})]);
   const current=await rows(s,'tax_workspace',{id:scopeFilter,status:'eq.active'});
   if(wanted.some(id=>!current.some(w=>w.id===id)))throw fail('forbidden');
   return wanted.map(id=>({workspaceId:id,activities:activities.filter(x=>x.workspace_id===id).sort((a,b)=>a.created_at.localeCompare(b.created_at)||a.id.localeCompare(b.id)),documents:documents.filter(x=>x.workspace_id===id),links:links.filter(x=>x.workspace_id===id)}));
  }),
  postActivity:(id,input,key)=>command('tal_post_activity',id,input,key),
  completeRequest:(id,item,key)=>command('tal_advance_request',id,{requestId:item.id,expectedRevision:Number(item.revision),status:'completed'},key),
  submitConfirmation:(id,item,key)=>command('tal_advance_request',id,{requestId:item.id,expectedRevision:Number(item.revision),status:'submitted'},key),
  deleteDocument:(id,doc,key)=>command('tal_delete_document',id,{documentId:doc.id,expectedRevision:Number(doc.revision)},key),
  async prepareUpload(id,file,item=null){
   if(!scope||!uuid.test(id))throw fail('forbidden');const started=scope,mime=documentType(file),bytes=await file.arrayBuffer(),sha256=await hashBytes(bytes);if(scope!==started)throw fail('stale');
   // Resume only an identical, unexpired reservation visible to this uploader via RLS.
   const existing=await auth.withContextSession(async s=>(await rows(s,'document',{workspace_id:'eq.'+id,upload_status:'eq.pending',deleted_at:'is.null',sha256:'eq.'+sha256})).find(d=>d.workspace_id===id&&d.upload_status==='pending'&&d.uploader_context===context(s)&&d.original_filename===file.name&&d.media_type===mime&&Number(d.size_bytes)===file.size&&d.sha256===sha256&&Date.parse(d.expires_at)>Date.now()));
   if(scope!==started)throw fail('stale');
   // Opaque retry job, held only in memory. Each write revalidates the current Auth scope.
   return{scope:started,id,file,mime,sha256,size:file.size,reserveKey:crypto.randomUUID(),finalKey:crypto.randomUUID(),request:item?{requestId:item.id,expectedRequestRevision:Number(item.revision)}:{},reservation:existing?{documentId:existing.id,revision:Number(existing.revision),storageKey:id+'/'+existing.id+'/1/original',uploadRequired:true}:null};
  },
  async uploadDocument(job,progress=()=>{}){
   const guard=()=>{if(!scope||scope!==job.scope)throw fail('stale');};guard();
   if(!job.reservation){progress('Preparazione…');job.reservation=await command('tal_reserve_document',job.id,{filename:job.file.name,mediaType:job.mime,sizeBytes:job.size,sha256:job.sha256},job.reserveKey);}guard();
   const res=job.reservation;const id=res.documentId||res.duplicateDocumentId;if(!uuid.test(id))throw fail('invalid');
   if(res.uploadRequired&&!job.finalPayload){
    if(res.storageKey!==job.id+'/'+id+'/1/original')throw fail('forbidden');
    if(!job.uploaded){progress('Caricamento…');await auth.withContextSession(async s=>{const r=await request(s,'/storage/v1/object/tal-documents/'+res.storageKey,{method:'POST',body:job.file,binary:true,headers:{'Content-Type':job.mime,'cache-control':'0','x-upsert':'false'}});if(!r.ok){const e=await r.json().catch(()=>({}));if(!(r.status===409||e.statusCode==='409'||e.error==='Duplicate'))throw fail(r.status===401?'expired':r.status===403?'forbidden':'uncertain');}else await r.body?.cancel();});job.uploaded=true;}guard();
    progress('Verifica del documento…');await auth.withContextSession(async s=>{const v=await json(await request(s,'/functions/v1/tal-verify-document-upload',{method:'POST',body:{document_id:id}}));if(v.verified!==true||v.documentId!==id)throw fail('file');});guard();
   }
   if(!job.finalPayload){let revision=Number(res.revision);if(!res.uploadRequired){const d=(await api.listCollaboration(job.id)).documents.find(d=>d.id===id);if(!d)throw fail('forbidden');revision=Number(d.revision);}job.finalPayload={documentId:id,expectedRevision:revision,...job.request};}
   guard();progress('Invio…');const result=await command('tal_finalize_document',job.id,job.finalPayload,job.finalKey);guard();return result;
  },
  async downloadDocument(id,document){
   if(!uuid.test(id)||!uuid.test(document.id))throw fail('invalid');
   return auth.withContextSession(async s=>{const r=await request(s,'/functions/v1/tal-download-document',{method:'POST',body:{document_id:document.id}});if(!r.ok){await r.body?.cancel();throw fail(r.status===401?'expired':r.status===404?'forbidden':'unavailable');}
    if(!r.headers.get('cache-control')?.includes('no-store')||r.headers.get('content-type')?.split(';')[0]!==document.media_type)throw fail('unavailable');
    const reader=r.body.getReader(),parts=[];let size=0;try{for(;;){const{done,value}=await reader.read();if(done)break;size+=value.length;if(size>MAX_DOCUMENT_BYTES||size>Number(document.size_bytes))throw fail('file');parts.push(value);}}finally{await reader.cancel();}
    const blob=new Blob(parts,{type:document.media_type});if(size!==Number(document.size_bytes)||await hashBytes(await blob.arrayBuffer())!==document.sha256)throw fail('file');return blob;
   });
  },
 };return api;
}
