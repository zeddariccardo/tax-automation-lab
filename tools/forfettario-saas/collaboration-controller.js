// Never retain a previous person's timeline after a scope change or denied read.
export function createCollaborationController({auth,service,defer=queueMicrotask}){
 let ids=[],scope='',generation=0,pending=null,state={phase:'idle',data:null};const listeners=new Set();
 const emit=next=>{if(JSON.stringify(next)===JSON.stringify(state))return;state=next;for(const fn of listeners)fn(structuredClone(state));};
 async function refresh(){if(!scope||!ids.length)return;if(pending)return pending;const version=generation,selected=[...ids];
  pending=(async()=>{let retry=false;try{const data=await service.listCollaborationQueue(selected);if(version===generation)emit({phase:'ready',data});}catch(e){if(version===generation){retry=e.code==='stale';emit({phase:retry?'loading':['forbidden','expired'].includes(e.code)?'forbidden':'error',data:null});}}finally{if(version===generation){pending=null;if(retry)defer(()=>void refresh());}}})();return pending;
 }
 const api={getState:()=>structuredClone(state),subscribe(fn){listeners.add(fn);fn(structuredClone(state));return()=>listeners.delete(fn);},refresh,
  select(next){next=[...new Set(next)].sort();if(JSON.stringify(next)===JSON.stringify(ids))return;ids=next;generation++;pending=null;state={phase:ids.length?'loading':'idle',data:null};if(ids.length)defer(()=>void refresh());},
  clear(){ids=[];generation++;pending=null;emit({phase:'idle',data:null});}
 };
 auth.subscribe(a=>{const next=a.phase==='ready'?a.user.id+':'+a.selected.context_type+':'+a.selected.context_id:'';if(scope!==next){scope=next;api.clear();}});return api;
}
