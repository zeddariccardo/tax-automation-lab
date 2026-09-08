/* File fittizi dagli input XLSX/JSON reali, Chromium isolato, nessuna rete.
 * Hook di snapshot/fault injection solo nel documento servito dal test.
 * Baseline 4f95c77: riprodotti date, quote, FY, duplicati e rollback difettosi. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {after,before,test} from 'node:test';
import {startWorkerBrowser} from './worker-browser-harness.mjs';
const HTML=readFileSync(new URL('../tools/tfa-client-file/index.html',import.meta.url),'utf8').replace(/\r\n/g,'\n');
const ANCHOR='\nloadVault();\nif(state()){';
const HOOK=String.raw`
window.__tfaTest={
 template:CTP_AI_TEMPLATE_B64,store:STORE,fallback:ATTACH_FALLBACK,
 current:function(){return clone(state())},archive:function(){return clone(vault)},backup:buildBackupPayload,
 seed:function(){
  var d=demoClientData();d.client.name='SENTINELLA FASCICOLO';d.client.taxId='20202020200';
  d.profile.other.push({id:'nota-sentinella',title:'NOTA DA PRESERVARE',description:'SENTINELLA_COMPLETA',status:'Ricorrente',source:'Fittizia',updated:'2024-02-29'});
  resetHistoryFromCurrent(d,'2024-01-01');
  d.client.description='Modifica storica sentinella';d.nextEffectiveDate='2024-06-01';commit({},d);d=normalise(d);
  var other=newClientData({name:'ALTRO CLIENTE SENTINELLA',taxId:'30303030300'});
  vault={version:VAULT_VERSION,currentId:'old',clients:[{id:'old',data:d},{id:'other',data:other}]};
  selectedFY=d.client.currentFY;view={scope:'profile',section:'overview',taxArea:null,asOf:null};historic=null;
  clearTimeout(saveTimer);saveTimer=null;persist();render();setSaveState('ok');
  localStorage.setItem('sentinella_non_fascicolo','NON TOCCARE');
 },
 snapshot:function(){return JSON.stringify({vault:vault,selectedFY:selectedFY,view:view,historic:historic,saveState:saveState,
  storage:Object.entries(localStorage).sort(),session:Object.entries(sessionStorage).sort()})},
 clearFeedback:function(){closeModal();document.querySelector('#toast').textContent=''},
 storageFault:function(mode){
  var native=Storage.prototype.setItem,once=false;
  Storage.prototype.setItem=function(k,v){
   if(k===STORE&&!once){once=true;if(mode==='after')native.call(this,k,v);throw new DOMException('Storage simulato indisponibile','QuotaExceededError')}
   return native.call(this,k,v);
  };
 },
 disableIDB:function(){Object.defineProperty(window,'indexedDB',{value:null,configurable:true})},
 put:putAttachment,
 attachmentSnapshot:function(){return idbOpen().then(function(db){return new Promise(function(resolve,reject){var tx=db.transaction('files','readonly'),req=tx.objectStore('files').getAll();req.onsuccess=function(){db.close();resolve(JSON.stringify(req.result.sort(function(a,b){return a.id.localeCompare(b.id)})))};req.onerror=reject})})},
 slowAttachmentFailure:function(){
  var native=putAttachment,n=0;
  putAttachment=function(id,data,meta){if(++n===1)return Promise.reject(new Error('Allegato fittizio rifiutato'));return new Promise(function(resolve){setTimeout(resolve,70)}).then(function(){return native(id,data,meta)})};
 },
 renderFault:function(){var native=render,once=false;render=function(){if(!once){once=true;throw new Error('Render simulato indisponibile')}return native()}}
};`;
assert.ok(HTML.includes(ANCHOR),'aggancio closure non trovato');
const instrumented=HTML.replace(ANCHOR,'\n'+HOOK+ANCHOR);
let runner;
before(async()=>{runner=await startWorkerBrowser()});
after(async()=>{await runner?.close()});
async function using(fn){
 const h=await runner.open('tfa-client-file',{storage:{tal_ctp_welcome_v21:'1'}});
 try{
  await h.page.route('**/tools/tfa-client-file/',r=>r.fulfill({contentType:'text/html',body:instrumented}));
  await h.page.reload();await h.page.evaluate(()=>__tfaTest.seed());await fn(h);
  assert.deepEqual(h.requests,[],'Fascicolo deve restare locale');assert.deepEqual(h.missing,[]);
  // Solo eccezioni intenzionali dei test di rollback JSON; nessun errore nel percorso valido.
  assert.deepEqual(h.errors.filter(e=>!e.includes('simulato indisponibile')&&!e.includes('Allegato fittizio rifiutato')),[]);
 }finally{await h.close()}
}
const snapshot=p=>p.evaluate(()=>__tfaTest.snapshot());
const current=p=>p.evaluate(()=>__tfaTest.current());
const baseRows=()=>({
 ANAGRAFICA:[['Ragione sociale','Codice fiscale PIVA','Paese'],['IMPORTATO FITTIZIO','40404040400','Italia']],
 TEMATICHE_BUSINESS:[['Titolo','Aggiornato al','Descrizione'],['Tematica nuova','2025-12-31','Descrizione fittizia']],
 GRUPPO_ENTITA:[['ID','Denominazione','Cliente'],['C1','IMPORTATO FITTIZIO','si'],['H1','Holding fittizia','']],
 GRUPPO_RELAZIONI:[['Da ID','A ID','Quota percentuale','Diritti voto percentuale'],['H1','C1','100%','50%']],
 FY:[['Esercizio','Titolo','Data'],['2025','Evento fittizio','2025-12-31']]
});
async function workbook(p,{replace={},cells=[],official=false}={}){
 return Buffer.from(await p.evaluate(({rows,cells,official})=>{
  const wb=official?XLSX.read(__tfaTest.template,{type:'base64'}):XLSX.utils.book_new();
  for(const [name,values]of Object.entries(rows)){
   let data=values;
   if(official&&wb.Sheets[name]){
    const headers=XLSX.utils.sheet_to_json(wb.Sheets[name],{header:1})[0];
    const key=s=>String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,'');
    const columns=values[0].map(label=>{const index=headers.findIndex(h=>key(h)===key(label));if(index<0)throw Error(name+': campo non presente nel template ufficiale: '+label);return index});
    data=[headers,...values.slice(1).map(row=>{const out=headers.map(()=>'');row.forEach((v,i)=>{out[columns[i]]=v});return out})];
   }
   const sh=XLSX.utils.aoa_to_sheet(data);
   if(wb.Sheets[name])wb.Sheets[name]=sh;else XLSX.utils.book_append_sheet(wb,sh,name);
  }
  for(const [sheet,address,cell]of cells)wb.Sheets[sheet][address]=cell;
  return XLSX.write(wb,{type:'base64',bookType:'xlsx'});
 },{rows:{...baseRows(),...replace},cells,official}),'base64');
}
async function upload(p,opts={}){
 await p.evaluate(()=>__tfaTest.clearFeedback());
 await p.locator('#xlsxInput').setInputFiles({name:'fascicolo-fittizio.xlsx',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',buffer:await workbook(p,opts)});
 await p.waitForFunction(()=>document.querySelector('#impCreate')||/Importazione non riuscita/.test(document.querySelector('#toast').textContent));
}
async function rejectExcel(h,opts,pattern){
 const before=await snapshot(h.page);await upload(h.page,opts);
 assert.equal(await h.page.locator('#impCreate').count(),0,'nessuna conferma per file invalido');
 assert.match(await h.page.locator('#toast').textContent(),pattern);
 assert.equal(await snapshot(h.page),before,'lavorazione e storage identici');
}
async function acceptExcel(h,opts={}){
 const before=await snapshot(h.page);await upload(h.page,opts);
 assert.equal(await snapshot(h.page),before,'preview senza scritture');
 assert.equal(await h.page.locator('#impCreate').count(),1,await h.page.locator('#toast').textContent());
 await h.page.locator('#impCreate').click();
 await h.page.waitForFunction(()=>/Cliente creato/.test(document.querySelector('#toast').textContent));
 assert.ok(await h.page.evaluate(()=>localStorage.getItem(__tfaTest.store)===JSON.stringify(__tfaTest.archive())));
 return current(h.page);
}
for(const date of ['2024-02-29','31/12/2025','2025/12/31']){
 test('Fascicolo Excel: data reale '+date,()=>using(async h=>{
  const d=await acceptExcel(h,{replace:{TEMATICHE_BUSINESS:[['Titolo','Aggiornato al'],['Data valida',date]]}});
  assert.equal(d.profile.businessTopics[0].updated,date==='2024-02-29'?'2024-02-29':'2025-12-31');
 }));
}
for(const date of ['31/02/2025','2025-02-29','31/04/2025','2025-13-01']){
 test('Fascicolo Excel: rifiuto atomico data impossibile '+date,()=>using(h=>rejectExcel(h,{
  replace:{TEMATICHE_BUSINESS:[['Titolo','Aggiornato al'],['Data impossibile',date]]}
 },/TEMATICHE_BUSINESS.*riga 2.*B2.*aggiornato_al.*data non valida/)));
}
test('Fascicolo Excel: data nativa e percentuale formattata',()=>using(async h=>{
 const d=await acceptExcel(h,{cells:[['TEMATICHE_BUSINESS','B2',{t:'n',v:46022,z:'dd/mm/yyyy'}],['GRUPPO_RELAZIONI','C2',{t:'n',v:1,z:'0%'}]]});
 assert.equal(d.profile.businessTopics[0].updated,'2025-12-31');assert.equal(d.profile.corporate.graph.relations[0].ownership,100);
}));
test('Fascicolo Excel: falso 29 febbraio 1900',()=>using(h=>rejectExcel(h,{
 cells:[['TEMATICHE_BUSINESS','B2',{t:'n',v:60,z:'dd/mm/yyyy'}]]
},/data non valida|data Excel non valida/)));
for(const pct of ['0%','100%','30,5%']){
 test('Fascicolo Excel: quota nel dominio '+pct,()=>using(async h=>{
  const d=await acceptExcel(h,{replace:{GRUPPO_RELAZIONI:[['Da ID','A ID','Quota percentuale'],['H1','C1',pct]]}});
  assert.equal(d.profile.corporate.graph.relations[0].ownership,Number(pct.replace('%','').replace(',','.')));
 }));
}
for(const pct of ['150%','-1%','NON DISPONIBILE','abc123']){
 test('Fascicolo Excel: quota invalida '+pct,()=>using(h=>rejectExcel(h,{
  replace:{GRUPPO_RELAZIONI:[['Da ID','A ID','Quota percentuale'],['H1','C1',pct]]}
 },/GRUPPO_RELAZIONI.*riga 2.*C2.*quota_percentuale.*0 a 100/)));
}
test('Fascicolo Excel: diritti di voto oltre 100',()=>using(h=>rejectExcel(h,{
 replace:{GRUPPO_RELAZIONI:[['Da ID','A ID','Quota percentuale','Diritti voto percentuale'],['H1','C1','50%','150%']]}
},/D2.*diritti_voto_percentuale.*0 a 100/)));
for(const order of [['Prima','Seconda'],['Seconda','Prima']]){
 test('Fascicolo Excel: ID H1 duplicato '+order.join('/'),()=>using(async h=>{
  await rejectExcel(h,{replace:{GRUPPO_ENTITA:[['ID','Denominazione','Cliente'],['C1','IMPORTATO FITTIZIO','si'],['H1',order[0],''],['H1',order[1],'']]}},/ID entità duplicato.*H1.*GRUPPO_ENTITA.*A3.*A4/);
  const msg=await h.page.locator('#toast').textContent();assert.ok(msg.includes('Prima')&&msg.includes('Seconda')&&msg.includes('ambigui'));
 }));
}
test('Fascicolo Excel: ID normalizzati che collidono',()=>using(h=>rejectExcel(h,{
 replace:{GRUPPO_ENTITA:[['ID','Denominazione'],['H-1','Prima'],['h 1','Seconda']]}
},/duplicato/)));
test('Fascicolo Excel: FY 2025 valido',()=>using(async h=>{
 const d=await acceptExcel(h);assert.equal(d.years['2025'].events[0].title,'Evento fittizio');assert.equal(d.years['2025'].events[0].date,'2025-12-31');
}));
for(const fy of ['2025/2026','20252026','FY 2025','2025.5']){
 test('Fascicolo Excel: esercizio malformato '+fy,()=>using(h=>rejectExcel(h,{
  replace:{FY:[['Esercizio','Titolo'],[fy,'Evento']]}
 },/FY.*riga 2.*A2.*esercizio.*quattro cifre/)));
}
const incomplete=[
 ['entità senza ID',{GRUPPO_ENTITA:[['ID','Denominazione'],['','Orfana']]},/GRUPPO_ENTITA.*A2.*manca id/],
 ['entità senza nome',{GRUPPO_ENTITA:[['ID','Denominazione'],['H1','']]},/GRUPPO_ENTITA.*B2.*denominazione/],
 ['relazione senza destinazione',{GRUPPO_RELAZIONI:[['Da ID','A ID','Quota percentuale'],['H1','','50%']]},/GRUPPO_RELAZIONI.*B2.*a_id/],
 ['relazione con ID inesistente',{GRUPPO_RELAZIONI:[['Da ID','A ID','Quota percentuale'],['H1','ASSENTE','50%']]},/GRUPPO_RELAZIONI.*B2.*ASSENTE/],
 ['tematica senza titolo',{TEMATICHE_BUSINESS:[['Titolo','Descrizione'],['','Non ignorare']]},/TEMATICHE_BUSINESS.*A2.*titolo/],
 ['evento senza esercizio',{FY:[['Esercizio','Titolo'],['','Evento']]},/FY.*A2.*esercizio/],
 ['area fiscale assente',{FISCALE:[['Area','Titolo'],['','Tematica']]},/FISCALE.*A2.*area/],
 ['seconda anagrafica',{ANAGRAFICA:[['Ragione sociale'],['Prima'],['Seconda']]},/ANAGRAFICA.*riga 3.*una sola riga/]
];
for(const [name,replace,pattern]of incomplete)test('Fascicolo Excel: '+name,()=>using(h=>rejectExcel(h,{replace},pattern)));
for(const [name,cell]of [['errore Excel',{t:'e',v:7,f:'1/0'}],['formula senza cache',{t:'n',f:'1+1'}]]){
 test('Fascicolo Excel: '+name,()=>using(h=>rejectExcel(h,{cells:[['GRUPPO_RELAZIONI','C2',cell]]},/GRUPPO_RELAZIONI.*C2.*(?:errore Excel|formula senza risultato)/)));
}
test('Fascicolo Excel: formula senza cache in riga vuota',()=>using(h=>rejectExcel(h,{
 replace:{TEMATICHE_BUSINESS:[['Titolo','Aggiornato al'],['','']]},cells:[['TEMATICHE_BUSINESS','B2',{t:'n',f:'TODAY()'}]]
},/B2.*formula senza risultato/)));
test('Fascicolo Excel: chiusura esercizio impossibile',()=>using(h=>rejectExcel(h,{
 replace:{ANAGRAFICA:[['Ragione sociale','Esercizio sociale','Chiusura esercizio MM GG'],['Importato','custom','02-30']]}
},/ANAGRAFICA.*C2.*chiusura esercizio non valida/)));

test('Fascicolo Excel: template ufficiale articolato, più entità ed esercizi',()=>using(async h=>{
 const replace={
  CONTABILITA:[['Principi contabili','Tipo bilancio'],['OIC','Ordinario']],
  TEMATICHE_CONTABILI:[['Titolo','Descrizione','Aggiornato al'],['Rimanenze','Verifica fittizia','2025-12-31']],
  SOCIETA_GRUPPO:[['Gruppo di appartenenza','Direzione e coordinamento'],['Gruppo fittizio','No']],
  TEMATICHE_GRUPPO:[['Titolo','Descrizione'],['Gruppo','Nota fittizia']],
  CARATTERISTICHE_FISCALI:[['Caratteristica'],['Caratteristica fittizia']],
  GRUPPO_ENTITA:[['ID','Denominazione','Cliente'],['C1','IMPORTATO FITTIZIO','si'],...Array.from({length:8},(_,i)=>['H'+(i+1),'Società fittizia '+(i+1),''])],
  GRUPPO_RELAZIONI:[['Da ID','A ID','Quota percentuale'],...Array.from({length:8},(_,i)=>['H'+(i+1),'C1','12,5%'])],
  FISCALE:[['Area','Titolo','Descrizione'],['IRES','Credito','Nota fiscale'],['date','Area personalizzata','Non è una data']],
  CONTENZIOSO:[['Titolo','Data apertura','Data chiusura'],['Contenzioso fittizio','2024-02-29','2025-12-31']],
  OPERAZIONI:[['Titolo','Data efficacia'],['Operazione fittizia','2025-12-31']],
  ALTRI_ASPETTI:[['Titolo','Descrizione'],['Nota libera','TESTO FITTIZIO']],
  FY:[['Esercizio','Titolo','Data'],...['2024','2025','2026'].map(y=>[y,'Evento '+y,y+'-12-31'])]
 };
 const d=await acceptExcel(h,{official:true,replace});
 assert.equal(d.profile.corporate.graph.entities.length,9);assert.equal(d.profile.corporate.graph.relations.length,8);
 assert.equal(d.profile.accounting.standards,'OIC');
 assert.equal(d.profile.litigation[0].opened,'2024-02-29');assert.equal(d.profile.litigation[0].closed,'2025-12-31');
 assert.equal(d.profile.transactions[0].effective,'2025-12-31');
 for(const y of ['2024','2025','2026'])assert.equal(d.years[y].events[0].title,'Evento '+y);
 assert.equal(d.profile.other[0].description,'TESTO FITTIZIO');assert.equal(d.profile.tax.areas.date[0].title,'Area personalizzata');
 const backup=await h.page.evaluate(()=>__tfaTest.backup());assert.equal(backup.vault.clients.length,3);
 assert.ok(backup.vault.clients.some(c=>c.data.client.name==='SENTINELLA FASCICOLO'));
}));
test('Fascicolo Excel: integrazione conserva dati e registra storico',()=>using(async h=>{
 const old=await current(h.page);
 await upload(h.page,{replace:{ANAGRAFICA:[['Ragione sociale','Codice fiscale PIVA'],['SENTINELLA FASCICOLO','20202020200']]}});
 await h.page.locator('#impMerge').click();await h.page.waitForFunction(()=>/Fascicolo integrato/.test(document.querySelector('#toast').textContent));
 const d=await current(h.page);
 assert.equal(d.profile.businessTopics.length,old.profile.businessTopics.length+1);assert.deepEqual(d.profile.other,old.profile.other);
 assert.ok(d.history.changes.length>old.history.changes.length);
 assert.equal((await h.page.evaluate(()=>__tfaTest.archive())).clients.length,2);
 assert.ok(await h.page.evaluate(()=>localStorage.getItem(__tfaTest.store)===JSON.stringify(__tfaTest.archive())));
}));
for(const action of ['create','merge'])for(const failure of ['before','after','render']){
 test('Fascicolo Excel: rollback '+action+' errore '+failure,()=>using(async h=>{
  const before=await snapshot(h.page);
  await upload(h.page,action==='merge'?{replace:{ANAGRAFICA:[['Ragione sociale','Codice fiscale PIVA'],['SENTINELLA FASCICOLO','20202020200']]}}:{});
  if(failure==='render')await h.page.evaluate(()=>__tfaTest.renderFault());else await h.page.evaluate(mode=>__tfaTest.storageFault(mode),failure);
  await h.page.locator(action==='merge'?'#impMerge':'#impCreate').click();
  assert.match(await h.page.locator('#toast').textContent(),/annullata.*precedente conservata/);assert.equal(await snapshot(h.page),before);
  // Supera l'autosave preesistente: nessuna scrittura tardiva del candidato.
  await h.page.waitForTimeout(520);assert.equal(await snapshot(h.page),before);
 }));
}
async function backupFile(h,edit){
 const payload=await h.page.evaluate(()=>__tfaTest.backup());if(edit)edit(payload);return payload;
}
async function uploadBackup(h,payload){
 await h.page.evaluate(()=>__tfaTest.clearFeedback());
 await h.page.locator('#jsonInput').setInputFiles({name:'backup-fittizio.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(payload))});
 await h.page.waitForFunction(()=>document.querySelector('#cfmOk')||/Backup non valido/.test(document.querySelector('#toast').textContent));
}
async function rejectBackup(h,edit,pattern){
 const payload=await backupFile(h,edit),before=await snapshot(h.page);await uploadBackup(h,payload);
 assert.equal(await h.page.locator('#cfmOk').count(),0,'nessuna conferma per backup invalido');
 assert.match(await h.page.locator('#toast').textContent(),pattern);assert.equal(await snapshot(h.page),before);
}
const backupInvalid=[
 ['data impossibile',p=>{p.vault.clients[0].data.profile.other[0].updated='2025-02-29'},/updated.*data non valida/],
 ['quota 150',p=>{p.vault.clients[0].data.profile.corporate.graph.relations[0].ownership=150},/ownership.*0 a 100/],
 ['quota negativa',p=>{p.vault.clients[0].data.profile.corporate.graph.relations[0].voting=-1},/voting.*0 a 100/],
 ['FY malformato',p=>{p.vault.clients[0].data.years['2025/2026']={events:[]}},/years.*esercizio non valido/],
 ['currentFY malformato',p=>{p.vault.clients[0].data.client.currentFY='2025/2026'},/currentFY.*esercizio non valido/],
 ['data storica impossibile',p=>{p.vault.clients[0].data.history.baselineDate='2025-02-29'},/baselineDate.*data non valida/],
 ['ID cliente duplicato',p=>{p.vault.clients[1].id=p.vault.clients[0].id},/ID cliente duplicato/],
];
for(const [name,edit,pattern]of backupInvalid)test('Fascicolo JSON: rifiuto atomico '+name,()=>using(h=>rejectBackup(h,edit,pattern)));
for(const order of [['Prima','Seconda'],['Seconda','Prima']]){
 test('Fascicolo JSON: ID entità duplicato '+order.join('/'),()=>using(h=>rejectBackup(h,p=>{
  const g=p.vault.clients[0].data.profile.corporate.graph;g.entities.push({...g.entities[0],name:order[0]},{...g.entities[0],name:order[1]});
 },/ID entità duplicato.*entities\[0\]/)));
}
test('Fascicolo JSON: ripristino valido multi-cliente con storico',()=>using(async h=>{
 const payload=await backupFile(h);await uploadBackup(h,payload);await h.page.locator('#cfmOk').click();
 await h.page.waitForFunction(()=>/Backup ripristinato integralmente/.test(document.querySelector('#toast').textContent));
 assert.deepEqual(await h.page.evaluate(()=>__tfaTest.archive()),payload.vault);
}));
const PNG='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==';
async function attachmentBackup(h){
 return backupFile(h,p=>{
  const d=p.vault.clients[0].data,si={attachmentId:'new-image',date:'2025-12-31',source:'Immagine fittizia'};
  d.profile.corporate.graph.supportImage=si;d.history.baseline.profile.corporate.graph.supportImage=si;
  p.attachments={'new-image':{data:PNG,meta:{name:'prova.png'}}};
 });
}
for(const fallback of [false,true])for(const mode of ['before','after']){
 test('Fascicolo JSON: rollback '+mode+' con allegati '+(fallback?'fallback':'IndexedDB'),()=>using(async h=>{
  if(fallback)await h.page.evaluate(()=>__tfaTest.disableIDB());else await h.page.evaluate(data=>__tfaTest.put('old-sentinel',data,{name:'esistente'}),PNG);
  const payload=await attachmentBackup(h),before=await snapshot(h.page),attachments=fallback?null:await h.page.evaluate(()=>__tfaTest.attachmentSnapshot());
  await uploadBackup(h,payload);await h.page.evaluate(mode=>__tfaTest.storageFault(mode),mode);
  await h.page.locator('#cfmOk').click();await h.page.waitForFunction(()=>/Ripristino annullato/.test(document.querySelector('#toast').textContent));
  assert.equal(await snapshot(h.page),before,'rollback include assenza della chiave fallback');
  if(!fallback)assert.equal(await h.page.evaluate(()=>__tfaTest.attachmentSnapshot()),attachments);
 }));
}
test('Fascicolo JSON: rollback byte esatti fallback preesistente',()=>using(async h=>{
 await h.page.evaluate(data=>{__tfaTest.disableIDB();localStorage.setItem(__tfaTest.fallback,JSON.stringify({'esistente':{id:'esistente',data,meta:{name:'sentinella'}}},null,2))},PNG);
 const payload=await attachmentBackup(h),before=await snapshot(h.page);
 await uploadBackup(h,payload);await h.page.evaluate(()=>__tfaTest.storageFault('before'));
 await h.page.locator('#cfmOk').click();await h.page.waitForFunction(()=>/Ripristino annullato/.test(document.querySelector('#toast').textContent));
 assert.equal(await snapshot(h.page),before);
}));
test('Fascicolo JSON: attende gli allegati lenti prima del rollback',()=>using(async h=>{
 const payload=await attachmentBackup(h);payload.attachments['second-image']={data:PNG,meta:{name:'seconda.png'}};
 const before=await snapshot(h.page),attachments=await h.page.evaluate(()=>__tfaTest.attachmentSnapshot());
 await uploadBackup(h,payload);await h.page.evaluate(()=>__tfaTest.slowAttachmentFailure());
 await h.page.locator('#cfmOk').click();await h.page.waitForFunction(()=>/Ripristino annullato/.test(document.querySelector('#toast').textContent));
 assert.equal(await snapshot(h.page),before);assert.equal(await h.page.evaluate(()=>__tfaTest.attachmentSnapshot()),attachments);
}));
