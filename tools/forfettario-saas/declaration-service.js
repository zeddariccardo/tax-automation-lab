// User JWT only. The trusted server creates/version-stamps drafts; browser supplies no tax totals.
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const problem=code=>Object.assign(new Error(code),{code});
export function createDeclarationService({auth,fetchImpl}){
 const pending=new Map();
 async function request(session,path,body){
  let response;try{response=await fetchImpl(session.config.supabaseUrl+path,{method:'POST',credentials:'omit',cache:'no-store',redirect:'error',signal:AbortSignal.timeout(50000),
   headers:{apikey:session.config.publishableKey,Authorization:'Bearer '+session.token,'Content-Type':'application/json','x-tal-context':session.context.context_type+':'+session.context.context_id},
   body:JSON.stringify(body)});}catch{throw problem('uncertain');}
  if(!response.ok){await response.body?.cancel();throw problem(response.status===401?'expired':response.status===403||response.status===404?'forbidden':
   response.status===409?'conflict':response.status===422?'year':response.status===429?'limited':response.status===400?'invalid':'unavailable');}
  try{return await response.json();}catch{throw problem('unavailable');}
 }
 return {
  readDeclaration:(id,year=2025)=>auth.withContextSession(async session=>{
   if(!uuid.test(id))throw problem('invalid');
   const data=await request(session,'/functions/v1/tal-declaration-draft',{workspaceId:id,year});
   if(data?.draft?.workspaceId!==id||data.draft.taxYear!==year||!Number.isSafeInteger(data.revision)
    ||!Array.isArray(data.draft.fields)||!data.draft.summary||!Array.isArray(data.draft.issues))throw problem('unavailable');
   return data;
  }),
  reviewDeclaration:(id,payload,key)=>{
   if(!uuid.test(id)||!uuid.test(key))return Promise.reject(problem('invalid'));
   const state=auth.getState(),c=state.selected;
   if(state.phase!=='ready'||c?.context_type!=='studio')return Promise.reject(problem('forbidden'));
   const fingerprint=JSON.stringify({id,payload,key,user:state.user.id,context:c.context_id});
   if(pending.has(key)){const p=pending.get(key);return p.fingerprint===fingerprint?p.promise:Promise.reject(problem('idempotency'));}
   const frozen=structuredClone(payload);
   const promise=auth.withContextSession(s=>request(s,'/rest/v1/rpc/tal_review_declaration',{p_workspace_id:id,p_context:'studio:'+c.context_id,p_idempotency_key:key,p_payload:frozen}));
   pending.set(key,{fingerprint,promise});promise.finally(()=>pending.delete(key)).catch(()=>{});
   return promise;
  }
 };
}
