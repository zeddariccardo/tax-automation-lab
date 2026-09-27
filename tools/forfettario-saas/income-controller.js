// No shared cache across accounts, contexts or clients; late responses are discarded.
export function createIncomeController({auth,service,defer=fn=>queueMicrotask(fn)}) {
  let identity='',workspaceId=null,epoch=0,pending=null;
  let state={phase:'idle',data:null};const listeners=new Set();
  const emit=value=>{state=value;for(const fn of listeners)fn(structuredClone(state));};
  async function refresh() {
    if(!identity||!workspaceId)return;
    if(pending)return pending;
    const version=epoch,id=workspaceId;
    emit({phase:'loading',data:null});
    pending=(async()=>{
      let retry=false;
      try {const data=await service.listInvoices(id);if(version===epoch)emit({phase:'ready',data});}
      catch(e){if(version===epoch){retry=e.code==='stale';emit({phase:retry?'loading':['expired','forbidden'].includes(e.code)?'forbidden':'error',data:null});}}
      finally {if(version===epoch){pending=null;if(retry)defer(()=>void refresh());}}
    })();return pending;
  }
  const api={getState:()=>structuredClone(state),subscribe(fn){listeners.add(fn);fn(structuredClone(state));return()=>listeners.delete(fn);},
    refresh,
    select(id){if(id===workspaceId)return;workspaceId=id;epoch++;pending=null;state={phase:id?'loading':'idle',data:null};if(id)defer(()=>void refresh());},
    clear(){workspaceId=null;epoch++;pending=null;emit({phase:'idle',data:null});},
  };
  auth.subscribe(a=>{const next=a.phase==='ready'?a.user.id+':'+a.selected.context_type+':'+a.selected.context_id:'';
    if(next!==identity){identity=next;api.clear();}
  });return api;
}
