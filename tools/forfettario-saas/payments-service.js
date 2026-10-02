// User-session transport only; no amount/code/calendar generation in the browser.
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const fail=code=>Object.assign(Error(code),{code});
export function createPaymentsService({auth,fetchImpl}){
 const pending=new Map();
 const context=s=>s.context.context_type+':'+s.context.context_id;
 async function request(s,path,body){
  let r;try{r=await fetchImpl(s.config.supabaseUrl+path,{method:'POST',credentials:'omit',cache:'no-store',redirect:'error',signal:AbortSignal.timeout(60000),
   headers:{apikey:s.config.publishableKey,Authorization:'Bearer '+s.token,'Content-Type':'application/json','x-tal-context':context(s)},body:JSON.stringify(body)});}
  catch{throw fail('uncertain');}
  if(!r.ok){await r.body?.cancel();throw fail(({400:'invalid',401:'expired',403:'forbidden',404:'forbidden',409:'conflict',422:'year',429:'limited'})[r.status]||'unavailable');}
  try{return await r.json();}catch{throw fail('unavailable');}
 }
 const command=(rpc,id,payload,key)=>auth.withContextSession(s=>{
  if(!uuid.test(id)||!uuid.test(key))throw fail('invalid');
  const fingerprint=JSON.stringify([id,payload,s.user?.id,context(s)]),existing=pending.get(key);
  if(existing)return existing.fingerprint===fingerprint?existing.promise:Promise.reject(fail('idempotency'));
  const promise=request(s,'/rest/v1/rpc/'+rpc,{p_workspace_id:id,p_context:context(s),p_idempotency_key:key,p_payload:structuredClone(payload)});
  pending.set(key,{fingerprint,promise});promise.finally(()=>pending.delete(key)).catch(()=>{});return promise;
 });
 return {
  readWorkflow:id=>auth.withContextSession(async s=>{
   if(!uuid.test(id))throw fail('invalid');
   const d=await request(s,'/rest/v1/rpc/tal_workflow_summary',{p_workspace_id:id});
   if(!d||d.workspaceId!==id)throw fail('forbidden');return d;
  }),
  readPayments:(id,year=2025)=>auth.withContextSession(async s=>{
   if(!uuid.test(id))throw fail('invalid');
   const d=await request(s,'/functions/v1/tal-payment-draft',{workspaceId:id,year});
   if(d?.draft?.workspaceId!==id||d.draft.taxYear!==year||!Array.isArray(d.draft.groups)||!Number.isSafeInteger(d.revision))throw fail('unavailable');
   return d;
  }),
  reviewPayments:(id,payload,key)=>command('tal_review_payments',id,payload,key),
  actF24:(id,payload,key)=>command('tal_f24_action',id,payload,key),
 };
}
