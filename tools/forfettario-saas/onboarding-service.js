// Identity bootstrap and directed links only. Auth owns all credentials.
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const fail=code=>Object.assign(Error(code),{code});
export function activityCanBeSaved(result) {
 if (['calculated','warning'].includes(result?.status)) return true;
 // Preserve the declared activity when only a fiscal crosswalk decision is missing.
 // No coefficient, historic code or pension choice is inferred here.
 return result?.status==='blocked' && result.diagnostics?.length>0 &&
  result.diagnostics.every(d=>['ATECO_AMBIGUOUS_COEFFICIENT','ATECO_NO_OFFICIAL_CROSSWALK'].includes(d.code));
}
export function inviteCode(id,token){if(!uuid.test(id)||!/^[a-f0-9]{64}$/.test(token))throw fail('invalid');return 'TALI1.'+id+'.'+token;}
export function parseInvite(value){const parts=String(value).trim().split('.');if(parts.length!==3||parts[0]!=='TALI1'||!uuid.test(parts[1])||!/^[a-f0-9]{64}$/.test(parts[2]))throw fail('invalid');return {p_link_id:parts[1],p_token:parts[2]};}
export function newInviteToken(){return Array.from(crypto.getRandomValues(new Uint8Array(32)),n=>n.toString(16).padStart(2,'0')).join('');}
export function createOnboardingService({auth,fetchImpl}) {
 const pending=new Map();
 async function call(session,name,input) {
  let response;try{response=await fetchImpl(session.config.supabaseUrl+'/rest/v1/rpc/'+name,{
   method:'POST',cache:'no-store',credentials:'omit',redirect:'error',signal:AbortSignal.timeout(20000),
   headers:{apikey:session.config.publishableKey,Authorization:'Bearer '+session.token,'Content-Type':'application/json'},
   body:JSON.stringify(input)
  });}catch{throw fail('uncertain');}
  if(!response.ok){let body;try{body=await response.json();}catch{}throw fail(body?.code==='40001'?'conflict':response.status===401?'expired':response.status===403?'forbidden':response.status===429?'limited':'invalid');}
  return response.json();
 }
 const identity=(name,input={})=>auth.withIdentitySession(s=>call(s,name,input));
 const scoped=(name,input)=>auth.withContextSession(s=>call(s,name,{...input,p_context:s.context.context_type+':'+s.context.context_id}));
 function command(name,input,scope=false){
  const user=auth.getState().user?.id,ctx=auth.getState().selected;
  const key=JSON.stringify([user,ctx,name,input]);if(pending.has(key))return pending.get(key);
  const job=(scope?scoped(name,input):identity(name,input)).finally(()=>pending.delete(key));pending.set(key,job);return job;
 }
 return {
  getOnboarding:()=>identity('tal_get_onboarding'),
  provisionPersonal:()=>command('tal_provision_personal',{}),
  provisionStudio:name=>command('tal_provision_studio',{p_name:name}),
  saveOnboarding:input=>command('tal_save_onboarding',input,true),
  listLinks:()=>scoped('tal_list_my_links',{}),
  createInvite:input=>command('tal_create_link_invite',input,true),
  previewInvite:code=>identity('tal_preview_link_invite',parseInvite(code)),
  acceptInvite:(code,preview,key)=>{
   const selected=auth.getState().selected;
   if(!selected||selected.context_type+':'+selected.context_id!==preview.context)throw fail('context');
   return command('tal_accept_link',{...parseInvite(code),p_expected_revision:preview.revision,p_idempotency_key:key},true);
  },
  endInvite:(link,action,key,code=null)=>command('tal_end_link_invite',{p_link_id:link.id,p_expected_revision:link.revision,p_idempotency_key:key,p_action:action,p_token:code?parseInvite(code).p_token:null},true),
  revokeLink:(link,key)=>command('tal_revoke_link',{p_link_id:link.id,p_expected_revision:link.revision,p_idempotency_key:key},true),
  async resolveActivity(year,code){
   return auth.withIdentitySession(async s=>{
    let r;try{r=await fetchImpl(s.config.supabaseUrl+'/functions/v1/tal-resolve-activity',{method:'POST',cache:'no-store',credentials:'omit',redirect:'error',signal:AbortSignal.timeout(20000),
     headers:{apikey:s.config.publishableKey,Authorization:'Bearer '+s.token,'Content-Type':'application/json'},body:JSON.stringify({year,code})});}catch{throw fail('unavailable');}
    if(!r.ok){await r.body?.cancel();throw fail('unavailable');}const out=await r.json();
    if(!out||!['calculated','warning','blocked'].includes(out.status)||typeof out.engineVersion!=='string')throw fail('unavailable');
    return out;
   });
  }
 };
}
