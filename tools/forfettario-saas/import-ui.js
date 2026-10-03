import {formatCents,sumCents} from './income-model.js';
// Local-only drafts. Only the explicit confirmation calls a cloud write.
export function createImportUI({auth,service,positions,route,esc,openPanel,refresh,completed}) {
 let model,document0=null,snapshots=new Map(),plan=null,bootstrap=false,scope=[],busy=false,generation=0,identity='';
 let sheetIndex=0,year=new Date().getFullYear(),mapping=null,legacyAssignments=null;
 const button=(action,label)=>'<button class="button" type="button" data-action="'+action+'">'+label+'</button>';
 const secondary=(action,label)=>'<button class="text-link" type="button" data-action="'+action+'">'+label+'</button>';
 const errorText=e=>({conflict:'I dati sono cambiati o entrano in conflitto. Riapri il file e controlla l’anteprima. Nessun dato è stato sovrascritto.',forbidden:'L’accesso a una delle posizioni è cambiato. Nessuna importazione parziale.',expired:'Accedi di nuovo per continuare.',uncertain:'Non abbiamo ricevuto conferma. Riprova la stessa importazione: non creerà duplicati.',stale:'La sessione è cambiata. Riapri il file per controllare lo stato.'}[e.code]||e.message||'Controlla il file e riprova.');
 function clear(){generation++;document0=null;snapshots.clear();plan=null;scope=[];busy=false;mapping=null;sheetIndex=0;legacyAssignments=null;}
 function sync(){const a=auth.getState(),next=JSON.stringify([a.user?.id,a.selected]);if(next!==identity){identity=next;clear();}}
 function fileForm(){return '<p>Backup TAL, FatturaPA XML o file CSV/Excel. Controlla l’anteprima prima di confermare.</p><form id="import-file-form"><div class="field"><label for="import-file">File da importare</label><input id="import-file" name="file" type="file" accept=".json,.xml,.csv,.xlsx" multiple required></div><p class="small muted">Il file viene letto sul tuo dispositivo. L’originale locale rimane invariato.</p><p role="alert" class="error" tabindex="-1"></p><button class="button" type="submit">Controlla il file</button></form>';}
 async function loadSnapshots(ids){const v=generation;for(const id of ids){if(!snapshots.has(id)){const s=await service.importSnapshot(id,year);if(v!==generation)return;snapshots.set(id,s);}}}
 function position(s){return {id:s.workspace.id,talId:s.workspace.tal_id,dataRevision:s.workspace.data_revision};}
 function errorPanel(e){openPanel('Importazione da controllare','<p role="alert">'+esc(errorText(e))+'</p>'+secondary('s13-import','Scegli un file'));}
 async function configure(){
  const d=document0;
  if(d.kind==='table'){
   if(d.sheets.length>1&&mapping===null){openPanel('Scegli il foglio','<form id="import-sheet-form"><div class="field"><label for="import-sheet">Foglio</label><select id="import-sheet" name="sheet">'+d.sheets.map((s,i)=>'<option value="'+i+'" '+(i===sheetIndex?'selected':'')+'>'+esc(s.name)+'</option>').join('')+'</select></div><p role="alert" class="error" tabindex="-1"></p><button class="button" type="submit">Controlla le colonne</button></form>');return;}
   const headers=model.spreadsheetPreview({matrix:d.sheets[sheetIndex].matrix,records:[],mapping:{}}).sheet.headers;
   mapping??=model.autoMapBulkHeaders(headers);
   const personal=scope.length===1&&auth.getState().selected?.context_type==='personal';
   openPanel('Controlla le colonne','<p>'+esc(d.name)+'</p><form id="import-mapping-form">'+
    (d.sheets.length>1?'<p>Foglio: '+esc(d.sheets[sheetIndex].name)+'</p>':'')+
    '<div class="field"><label for="import-year">Anno delle fatture</label><input id="import-year" name="year" type="number" min="2000" max="2200" value="'+year+'" required></div>'+
    model.BULK_INVOICE_FIELDS.filter(f=>!personal||f.key!=='clientCode'||mapping.clientCode).map(f=>'<div class="field"><label for="map-'+f.key+'">'+esc(f.label)+'</label><select id="map-'+f.key+'" name="'+f.key+'" '+(f.required?'required':'')+'><option value="">'+(f.required?'Scegli colonna':'Non presente')+'</option>'+headers.map(h=>'<option '+(mapping[f.key]===h?'selected ':'')+'value="'+esc(h)+'">'+esc(h)+'</option>').join('')+'</select></div>').join('')+
    '<p role="alert" class="error" tabindex="-1"></p><button class="button" type="submit">Mostra anteprima</button></form>');
  }else if(d.kind==='xml'){
   const p=scope.length===1?scope[0]:null;
   if(!p){openPanel('Scegli il cliente','<form id="import-xml-client-form"><div class="field"><label for="import-client">Cliente collegato</label><select id="import-client" name="client" required><option value="">Scegli cliente</option>'+scope.map(p=>'<option value="'+esc(p.id)+'">'+esc(p.label+' · '+p.talId)+'</option>').join('')+'</select></div><button class="button" type="submit">Controlla XML</button></form>');return;}
   await prepareXML(p.id);
  }else await prepareLegacy();
 }
 function showPreview({targets=[],counts={},warnings=[],errors=[],duplicates=0,bootstrapTarget=null,newInvoices=null}){
  plan=errors.length?null:{key:crypto.randomUUID(),payload:{version:1,targets},bootstrapTarget};
  const total=newInvoices??(targets.reduce((n,t)=>n+(t.graph.invoices?.length||0),0)+(bootstrapTarget?.graph.invoices.length||0));
  const entries=[...targets,...(bootstrapTarget?[bootstrapTarget]:[])].flatMap(t=>(t.graph.invoices||[]).map(i=>({number:i.number||'Senza numero',date:i.issueDate,amount:sumCents(t.graph.components.filter(c=>c.invoiceId===i.id&&c.kind!=='withholding').map(c=>c.amountCents))})));
  if(plan)plan.invoiceCount=total;
  openPanel('Prima di importare','<p><strong>'+total+(total===1?' fattura pronta':' fatture pronte')+'</strong>'+(duplicates?' · '+duplicates+(duplicates===1?' già presente':' già presenti'):'')+'</p>'+
   (entries.length?'<details><summary>Vedi le fatture</summary><ul class="import-preview">'+entries.slice(0,30).map(i=>'<li><strong>'+esc(i.number)+'</strong> · '+esc(i.date)+' · '+esc(formatCents(i.amount))+'</li>').join('')+'</ul>'+(entries.length>30?'<p>Prime 30 fatture di '+entries.length+'.</p>':'')+'</details>':'')+
   ([['payments','incasso','incassi'],['creditNotes','nota di credito','note di credito'],['refunds','rimborso effettivo','rimborsi effettivi']].some(([k])=>counts[k])?'<p>'+[['payments','incasso','incassi'],['creditNotes','nota di credito','note di credito'],['refunds','rimborso effettivo','rimborsi effettivi']].filter(([k])=>counts[k]).map(([k,one,many])=>esc(counts[k])+' '+(counts[k]===1?one:many)).join(' · ')+'</p>':'')+
   (counts.years?'<p>'+esc(counts.years)+' annualità, attività e dati originali conservati.</p>':'')+
   warnings.map(w=>'<p class="small muted">'+esc(w)+'</p>').join('')+
   (errors.length?'<div role="alert"><h3>'+errors.length+' elementi da controllare</h3><ul>'+errors.slice(0,30).map(e=>'<li>'+esc(e)+'</li>').join('')+'</ul><p>Nessun dato verrà importato finché questi problemi non sono risolti.</p></div>':'<p>'+ (targets.length>1?'L’importazione riguarda '+targets.length+' clienti e verrà completata tutta insieme.':!targets.length&&!bootstrapTarget?'Non c’è nulla di nuovo da importare.':'Controlla che il file riguardi questa posizione.')+'</p>')+
   (targets.length?'<ul>'+targets.map(t=>{const p=scope.find(p=>p.id===t.workspaceId);return '<li>Destinazione: '+esc(p?.label||'La mia attività')+' · '+esc(p?.talId||'')+'</li>';}).join('')+'</ul>':'')+
   (!errors.length&&(targets.length||bootstrapTarget)?button('s13-confirm','Conferma importazione'):'')+
   '<p role="alert" id="import-error" class="error" tabindex="-1"></p>'+secondary('s13-import','Scegli un altro file'));
 }
 async function prepareLegacy(){
  if(!bootstrap&&auth.getState().selected.context_type==='studio'&&!legacyAssignments){
   openPanel('Associa le posizioni','<p>Scegli la destinazione di ogni backup tra i clienti collegati. L’ID contenuto nel file non autorizza l’importazione.</p><form id="import-legacy-clients-form">'+document0.records.map((r,i)=>'<div class="field"><label for="legacy-client-'+i+'">'+esc(r.label)+' · '+esc(r.talId||'ID non presente')+'</label><select id="legacy-client-'+i+'" name="'+i+'" required><option value="">Scegli cliente</option>'+scope.map(p=>'<option value="'+esc(p.id)+'">'+esc(p.label+' · '+(p.talId||''))+'</option>').join('')+'</select></div>').join('')+'<p role="alert" class="error" tabindex="-1"></p><button class="button" type="submit">Mostra anteprima</button></form>');return;
  }
  const v=generation,targets=[],warnings=[],errors=[],counts={payments:0,creditNotes:0,refunds:0,years:0};let bootstrapTarget,duplicates=0,newInvoices=0;
  if(bootstrap&&document0.records.length!==1)throw Error('Per iniziare scegli il backup della tua sola posizione.');
  for(const r of document0.records){let p;
   if(!bootstrap){p=scope.length===1&&auth.getState().selected.context_type==='personal'?scope[0]:scope.find(p=>p.id===legacyAssignments?.[document0.records.indexOf(r)]);
    if(!p){errors.push(r.label+': nessuna posizione collegata con questo ID TAL.');continue;}await loadSnapshots([p.id]);}
   if(v!==generation)return;
   try{const built=model.migrationTarget(r,p?position(snapshots.get(p.id)):null,{personal:bootstrap||auth.getState().selected.context_type==='personal'});
    const preview=p?await model.migrationPreview(built.target,snapshots.get(p.id)):null;if(v!==generation)return;
    if(preview){errors.push(...preview.errors);duplicates+=preview.duplicates;}
    newInvoices+=preview?.counts.invoices??built.counts.invoices;
    for(const k of Object.keys(counts))counts[k]+=(preview?.counts[k]??built.counts[k])||0;warnings.push(...built.warnings);
    if(bootstrap)bootstrapTarget=built.target;else targets.push(built.target);
   }catch(e){errors.push(r.label+': '+errorText(e));}
  }
  showPreview({targets,bootstrapTarget,counts,warnings:[...new Set(warnings)],errors:[...new Set(errors)],duplicates,newInvoices});
 }
 async function prepareTable(fields){
  const v=generation;year=Number(fields.year);mapping=Object.fromEntries(model.BULK_INVOICE_FIELDS.map(f=>[f.key,fields[f.key]||'']));
  let matrix=structuredClone(document0.sheets[sheetIndex].matrix);
  if(scope.length===1&&auth.getState().selected.context_type==='personal'&&!mapping.clientCode){
   const header='ID TAL della posizione';matrix=matrix.map((row,i)=>[...row,i?scope[0].talId:header]);mapping.clientCode=header;
  }
  const normalized=model.spreadsheetPreview({matrix,mapping,records:[]});
  const idx=normalized.sheet.headers.indexOf(mapping.clientCode),codes=new Set(normalized.sheet.rows.map(r=>String(r.values[idx]??'').trim().toUpperCase()));
  const chosen=scope.filter(p=>codes.has(p.talId));await loadSnapshots(chosen.map(p=>p.id));if(v!==generation)return;
  const records=chosen.map(p=>({clientId:p.id,clientCode:p.talId,revision:snapshots.get(p.id).workspace.data_revision,
   professionalMetadata:{name:p.label,year},personalState:model.stateFromSnapshot(snapshots.get(p.id),year)}));
  const preview=model.spreadsheetPreview({matrix,mapping,records,fileName:document0.name,sheetName:document0.sheets[sheetIndex].name});
  const errors=[...preview.missing.map(k=>'Manca una colonna richiesta: '+model.BULK_INVOICE_FIELDS.find(f=>f.key===k).label),...preview.rows.filter(r=>!['ready','duplicate'].includes(r.status)).map(r=>'Riga '+r.rowNumber+': '+r.errors.join(' '))];
  const targets=errors.length?[]:model.tabularTargets(preview,chosen.map(p=>position(snapshots.get(p.id))),{fileName:document0.name,sheetName:document0.sheets[sheetIndex].name});
  showPreview({targets,errors,duplicates:preview.counts.duplicates,counts:{payments:targets.reduce((n,t)=>n+t.graph.payments.length,0)}});
 }
 async function prepareXML(id,assignments={}){
  const v=generation;await loadSnapshots([id]);if(v!==generation)return;
  const s=snapshots.get(id),out=model.xmlPreview(document0.files,model.stateFromSnapshot(s,year),assignments);
  if(out.needsAssignment){openPanel('A quale attività appartengono?','<form id="import-xml-activities-form" data-position="'+esc(id)+'">'+out.preview.value.documents.filter(d=>d.assignmentRequired).map(d=>'<div class="field"><label for="xml-'+esc(d.id)+'">Fattura '+esc(d.number)+'</label><select id="xml-'+esc(d.id)+'" name="'+esc(d.documentIdentity)+'" required><option value="">Scegli attività</option>'+s.activities.map(a=>'<option value="'+esc(a.id)+'">'+esc(a.facts.atecoCode)+'</option>').join('')+'</select></div>').join('')+'<button class="button" type="submit">Mostra anteprima</button></form>');return;}
  const provenance={files:await Promise.all(document0.files.map(async f=>({name:f.name,sha256:await model.byteDigest(f.text)})))};if(v!==generation)return;
  const graph=out.graph,targets=graph&&(graph.invoices.length||graph.creditNotes.length)?[{workspaceId:id,talId:s.workspace.tal_id,expectedDataRevision:s.workspace.data_revision,sourceScope:'fatturapa:v1',sourceDigest:model.digest(graph),graph,provenance}]:[];
  showPreview({targets,errors:out.errors,duplicates:out.preview.value?.documents.filter(d=>d.duplicate).length||0});
 }
 async function action(name){
  if(!name.startsWith('s13-'))return false;
  if(busy)return true;
  if(name==='s13-import'||name==='s13-import-personal'){
   clear();bootstrap=name==='s13-import-personal'&&!positions().length;scope=route().id?positions().filter(p=>p.id===route().id):positions();
   if(!auth.getState().user)return true;
   const v=generation;model??=await import('./import-model.js');if(v===generation)openPanel('Importa i tuoi dati',fileForm());return true;
  }
  if(name==='s13-confirm'&&plan){busy=true;const v=generation,actor=auth.getState().user?.id,context=JSON.stringify(auth.getState().selected),wasBootstrap=!!plan.bootstrapTarget;let output;
   const b=document.querySelector('[data-action="s13-confirm"]');if(b)b.disabled=true;
   try{if(auth.getState().selected?.context_type==='studio')for(const t of plan.payload.targets)t.destinationConfirmed=true;
    output=plan.bootstrapTarget?await service.migratePersonal(plan.bootstrapTarget,plan.key):await service.commitImport(plan.payload,plan.key);
    if(v!==generation)return true;
    const invoiceCount=plan.invoiceCount,count=output.targets.reduce((n,t)=>n+t.inserted,0);
    await refresh();await completed(output);
    const current=auth.getState();if(current.user?.id!==actor||(!wasBootstrap&&JSON.stringify(current.selected)!==context)||(wasBootstrap&&(current.selected?.context_type!=='personal'||current.selected?.context_id!==output.workspaceId)))return true;
    clear();openPanel('Importazione completata','<p>'+(count?invoiceCount+(invoiceCount===1?' fattura elaborata':' fatture elaborate')+'. Dati collegati conservati.':'I dati erano già presenti. Nessun duplicato.')+'</p><p>I dati sono salvati. Il file originale non è stato modificato.</p>'+button('close','Torna a TAL'));
   }catch(e){if(v!==generation)return true;const error=document.querySelector('#import-error');if(error){error.textContent=errorText(e);error.focus();}if(e.code!=='uncertain'&&e.code!=='stale')plan=null;}
   finally{if(v===generation)busy=false;if(b)b.disabled=!plan;}
  }return true;
 }
 async function submit(form){
  if(!form.id.startsWith('import-'))return false;if(busy)return true;
  busy=true;const v=generation;
  const b=form.querySelector('[type="submit"]');if(b)b.disabled=true;
  try{
   if(form.id==='import-file-form'){
    const files=[...form.elements.file.files];if(files.length>100||files.reduce((n,f)=>n+f.size,0)>15*1024*1024)throw Error('Scegli al massimo 100 file, entro 15 MiB complessivi.');
    if(files.some(f=>f.name.endsWith('.xlsx'))&&!globalThis.XLSX)await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='/assets/vendor/sheetjs-0.20.3.min.js';script.onload=resolve;script.onerror=()=>reject(Error('Lettura Excel non disponibile.'));document.head.append(script);});
    const parsed=await Promise.all(files.map(f=>model.readImportFile(f,globalThis.XLSX)));if(v!==generation)return true;
    if(parsed.length>1&&parsed.some(p=>p.kind!=='xml'))throw Error('Seleziona un solo backup o foglio, oppure più file XML.');
    document0=parsed.length>1?{kind:'xml',files:parsed.flatMap(p=>p.files),name:'FatturaPA'}:parsed[0];
    if(bootstrap&&document0.kind!=='legacy')throw Error('Per trasferire la posizione iniziale serve un backup TAL (.json).');await configure();
   }else if(form.id==='import-sheet-form'){
    sheetIndex=Number(form.elements.sheet.value);const headers=model.spreadsheetPreview({matrix:document0.sheets[sheetIndex].matrix,records:[],mapping:{}}).sheet.headers;
    mapping=model.autoMapBulkHeaders(headers);await configure();
   }else if(form.id==='import-mapping-form'){
    await prepareTable(Object.fromEntries(new FormData(form)));
   }else if(form.id==='import-legacy-clients-form'){
    const choices=Object.fromEntries(new FormData(form));
    if(Object.values(choices).some(id=>!scope.some(p=>p.id===id))||new Set(Object.values(choices)).size!==Object.values(choices).length)throw Error('Scegli una posizione collegata distinta per ogni backup.');
    legacyAssignments=choices;await prepareLegacy();
   }else if(form.id==='import-xml-client-form')await prepareXML(form.elements.client.value);
   else if(form.id==='import-xml-activities-form')await prepareXML(form.dataset.position,Object.fromEntries(new FormData(form)));
  }catch(e){if(v===generation){const el=form.querySelector('[role="alert"]');if(el){el.textContent=errorText(e);el.focus();}else errorPanel(e);}}
  finally{if(v===generation)busy=false;if(b)b.disabled=false;}
  return true;
 }
 return {action,submit,sync,clear};
}
