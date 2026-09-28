// User JWT only. Parsing/preview never sends a file; writes require explicit commit.
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const error=code=>Object.assign(new Error(code),{code});
export function createImportService({auth,fetchImpl,rows}){
 const pending=new Map();
 async function rpc(s,name,input){let response;
  try{response=await fetchImpl(s.config.supabaseUrl+'/rest/v1/rpc/'+name,{method:'POST',credentials:'omit',cache:'no-store',redirect:'error',signal:AbortSignal.timeout(30000),
   headers:{apikey:s.config.publishableKey,Authorization:'Bearer '+s.token,'Content-Type':'application/json','Content-Profile':'public',
    ...(s.context?{'x-tal-context':s.context.context_type+':'+s.context.context_id}:{})},body:JSON.stringify(input)});
  }catch{throw error('uncertain');}
  let out;try{out=await response.json();}catch{throw error('uncertain');}
  if(!response.ok)throw error(response.status===401?'expired':response.status===403?'forbidden':response.status===409||out?.code==='PT409'?'conflict':response.status>=500?'uncertain':'invalid');
  return out;
 }
 function command(name,key,payload,bootstrap=false){
  if(typeof key!=='string'||key.length<1||key.length>128)throw error('invalid');
  const frozen=JSON.stringify(payload),actor=auth.getState().user?.id,c=auth.getState().selected;
  if(!actor)throw error('forbidden');
  const identity=JSON.stringify([actor,c,name,key]),active=pending.get(identity);
  if(active){if(active.body!==frozen)throw error('idempotency');return active.promise;}
  const run=async s=>{
   const result=await rpc(s,name,bootstrap?{p_idempotency_key:key,p_target:JSON.parse(frozen)}:
    {p_context:s.context.context_type+':'+s.context.context_id,p_idempotency_key:key,p_payload:JSON.parse(frozen)});
   if(!Array.isArray(result?.targets)||result.targets.some(t=>!uuid.test(t.workspaceId)||!Number.isSafeInteger(t.dataRevision)))throw error('uncertain');
   return result;
  };
  const promise=(bootstrap?auth.withIdentitySession(run):auth.withContextSession(run)).finally(()=>pending.delete(identity));
  pending.set(identity,{body:frozen,promise});return promise;
 }
 async function snapshot(s,id,year){
  if(!uuid.test(id)||!Number.isInteger(year))throw error('invalid');
  const data=await rpc(s,'tal_fiscal_snapshot',{p_workspace_id:id,p_year:year});
  if(data?.workspace?.id!==id)throw error('forbidden');
  const [years,bindings]=await Promise.all([
   rows(s,'tax_year',{workspace_id:'eq.'+id},'id,workspace_id,year,facts,revision'),
   rows(s,'legacy_binding',{workspace_id:'eq.'+id},'id,workspace_id,source_scope,kind,legacy_id,target_id,ordinal,content_hash')]);
  const last=await rows(s,'tax_workspace',{id:'eq.'+id,status:'eq.active'},'id,data_revision');
  if(last.length!==1)throw error('forbidden');
  if(last[0].data_revision!==data.workspace.data_revision)throw error('conflict');
  return {...data,years,bindings};
 }
 return {
  importSnapshot:(id,year)=>auth.withContextSession(s=>snapshot(s,id,year)),
  commitImport:(payload,key)=>command('tal_commit_import',key,payload),
  migratePersonal:(target,key)=>command('tal_migrate_personal',key,target,true),
 };
}
