// No persistent calculation cache. Invalidation removes values before any new request.
export function createFiscalController({auth,service,defer=fn=>queueMicrotask(fn)}){
 let scope='',id=null,year=null,epoch=0,pending=null,state={phase:'idle',data:null};const listeners=new Set();
 const emit=s=>{state=s;for(const fn of listeners)fn(structuredClone(s));};
 const api={getState:()=>structuredClone(state),subscribe(fn){listeners.add(fn);fn(structuredClone(state));return()=>listeners.delete(fn);},
  select(w,y){if(w===id&&y===year)return;id=w;year=y;epoch++;pending=null;state={phase:w?'loading':'idle',data:null};if(w)defer(()=>void api.refresh());},
  invalidate(){epoch++;pending=null;emit({phase:id?'loading':'idle',data:null});},
  async refresh(){if(!scope||!id)return;if(pending)return pending;const e=epoch,w=id,y=year;emit({phase:'loading',data:null});
   pending=(async()=>{try{const data=await service.calculateFiscal(w,y);if(e===epoch)emit({phase:'ready',data});}
    catch(error){if(e===epoch)emit({phase:['forbidden','expired'].includes(error.code)?'forbidden':'error',data:null,error:error.code});}
    finally{if(e===epoch)pending=null;}})();return pending;},
 };
 auth.subscribe(a=>{const next=a.phase==='ready'?a.user.id+':'+a.selected.context_type+':'+a.selected.context_id:'';if(next!==scope){scope=next;id=null;year=null;api.invalidate();}});
 return api;
}
