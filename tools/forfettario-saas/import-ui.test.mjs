import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createImportUI} from './import-ui.js';
const fixture=JSON.parse(await readFile(new URL('./import-fixtures.json',import.meta.url)));
const file=()=>new File([JSON.stringify({format:'forfettario-pro-backup-v1',state:fixture.portfolio[0].personalState})],'synthetic.json');
const turn=()=>new Promise(r=>setImmediate(r));
for(const reason of ['context change','cancel'])test('late import snapshot cannot reopen preview after '+reason,async()=>{
 let state={user:{id:'actor-a'},selected:{context_type:'personal',context_id:'a'}},resolve,reads=0;
 const panels=[],snapshot={workspace:{id:'a',tal_id:'TAL-AAAAAAAA',data_revision:1,identity:{}},years:[],bindings:[]};
 const ui=createImportUI({auth:{getState:()=>state},service:{importSnapshot:async()=>{reads++;return new Promise(r=>resolve=r);}},
  positions:()=>[{id:'a',talId:'TAL-AAAAAAAA',label:'SYNTHETIC'}],route:()=>({}),esc:String,openPanel:(title,body)=>panels.push({title,body}),refresh:async()=>{},completed:async()=>{}});
 ui.sync();await ui.action('s13-import');
 const form={id:'import-file-form',elements:{file:{files:[file()]}},querySelector:()=>null};
 const pending=ui.submit(form);while(!resolve)await turn();
 if(reason==='context change'){state={user:{id:'actor-b'},selected:{context_type:'personal',context_id:'b'}};ui.sync();}else ui.clear();
 resolve(snapshot);await pending;assert.ok(!panels.some(p=>p.title==='Prima di importare'));
 await ui.action('s13-import');resolve=null;const retry=ui.submit(form);while(!resolve)await turn();assert.equal(reads,2);
 resolve(snapshot);await retry;assert.equal(panels.at(-1).title,'Prima di importare');
});
