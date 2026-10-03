import {E,F,canonicalJson,validateAppState,verifyChecksum,professionalIdentityFromState,validateProfessionalIdentity,
 parseCsvRows,normalizeBulkSheetRows,autoMapBulkHeaders,classifyBulkInvoiceRow,bulkWorksheetMatrix,BULK_INVOICE_FIELDS} from './import-legacy.generated.js';
export {BULK_INVOICE_FIELDS,autoMapBulkHeaders};
const clone=structuredClone;
export const digest=value=>F.sha256(typeof value==='string'?value:canonicalJson(value));
// Keep legacy fingerprints only for compatibility with existing backups.
// New byte attestations and PostgreSQL hashes use the platform SHA-256.
export async function byteDigest(text){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text))),n=>n.toString(16).padStart(2,'0')).join('');}
const fail=message=>{throw Object.assign(new Error(message),{code:'import-invalid'});};
const take=out=>{if(!out.value||out.status==='blocked')fail(out.diagnostics?.map(d=>d.message).join(' ')||'Controlla il file.');return out.value;};
const talId=id=>id==null||id===''?null:/^TAL-[A-Z0-9]{8}$/.test(id)?id:fail('L’ID TAL nel file non è valido.');
// Only local document validation. Cached/default coefficients never reach the
// fiscal service, which resolves ATECO through the authoritative Worker.
export function stateFromSnapshot(s,year) {
 const order=rows=>[...(rows||[])].sort((a,b)=>(Date.parse(a.created_at)||0)-(Date.parse(b.created_at)||0)||(a.facts?._talOrder??0)-(b.facts?._talOrder??0)||a.id.localeCompare(b.id));
 const activities=order(s.activities).map(a=>({...a.facts,id:a.id,coefficientBps:0,officialDescription:a.facts.officialDescription||'Attività dichiarata'}));
 const ledger=take(E.createLedgerState({activities}));
 ledger.invoices=order(s.invoices).map(i=>take(E.validateDocument({...i.facts,id:i.id,components:order(s.components.filter(c=>c.invoice_id===i.id)).map(c=>({...c.facts,id:c.id,invoiceId:i.id,activityId:c.activity_id,amountCents:c.amount_cents}))})));
 ledger.payments=order(s.payments).map(p=>({...p.facts,id:p.id,invoiceId:p.invoice_id,amountCents:p.amount_cents,cashReceivedCents:p.cash_received_cents,withholdingCents:p.withholding_cents}));
 ledger.allocations=order(s.allocations).map(a=>({...a.facts,id:a.id,paymentId:a.payment_id,componentId:a.component_id,amountCents:a.amount_cents}));
 ledger.creditNotes=order(s.creditNotes).map(n=>({...n.facts,id:n.id,originalInvoiceId:n.invoice_id,components:order(s.creditNoteLines.filter(l=>l.credit_note_id===n.id)).map(l=>({...l.facts,id:l.id,originalComponentId:l.component_id,amountCents:l.amount_cents}))}));
 ledger.refunds=order(s.refunds).map(r=>({...r.facts,id:r.id,invoiceId:r.invoice_id,activityId:r.activity_id,amountCents:r.amount_cents}));
 return {profile:{...s.workspace.identity,year,activities},ledger};
}
export function graphFromLedger(ledger, profileActivities=ledger.activities) {
 const clean=row=>{const r=clone(row);for(const key of ['decisions','totals','revision','workspaceId','_talOrder'])delete r[key];return r;};
 return {
  activities:profileActivities.map(clean),
  invoices:ledger.invoices.map(i=>{const r=clean(i);delete r.components;return r;}),
  components:ledger.invoices.flatMap(i=>i.components.map(clean)),
  payments:ledger.payments.map(clean),allocations:ledger.allocations.map(clean),
  creditNotes:ledger.creditNotes.map(n=>{const r=clean(n);delete r.components;return r;}),
  creditNoteLines:ledger.creditNotes.flatMap(n=>n.components.map(c=>({...clean(c),creditNoteId:n.id}))),
  refunds:ledger.refunds.map(clean),pensionPayments:[]
 };
}
export function parseBackup(document) {
 let records;
 if(document?.format==='forfettario-pro-backup-v1')records=[{state:document.state,label:'La mia attività',talId:null}];
 else if(document?.format==='PracticeTransferV1'){
  if(document.schema!=='forfettario-pro-practice-transfer-v1'||document.schemaVersion!==1||!verifyChecksum(document))fail('Il file di trasferimento non supera la verifica di integrità.');
  const identity=professionalIdentityFromState(document.personalState);
  if(canonicalJson(identity)!==canonicalJson(document.identity)||validateProfessionalIdentity(identity).length)fail('I dati identificativi del trasferimento non coincidono.');
  records=[{state:document.personalState,label:document.metadata?.name||'Posizione TAL',talId:talId(document.metadata?.clientCode)}];
 }else if(document?.format==='ProfessionalWorkspaceBackupV1'){
  if(document.schema!=='forfettario-pro-workspace-backup-v1'||document.schemaVersion!==1||!verifyChecksum(document)||!Array.isArray(document.practices))fail('Il backup dello Studio non supera la verifica di integrità.');
  records=document.practices.map(r=>{
   if(r.schema!=='ProfessionalPracticeV1')fail('Una pratica ha un formato non riconosciuto.');
   const id=professionalIdentityFromState(r.personalState),m=r.professionalMetadata;
   if(!m||id.taxCode!==m.taxCode||id.vatCode!==m.vatCode||validateProfessionalIdentity(id).length)fail('I dati identificativi di una pratica non coincidono.');
   return {state:r.personalState,label:m.name||'Posizione TAL',talId:talId(r.clientCode),studioPrivate:{alias:{sourceScope:r.workspaceId,sourceClientId:r.clientId,clientCode:r.clientCode},metadata:clone(m)}};
  });
 }else fail('Usa un backup personale TAL, un trasferimento di pratica o un backup dello Studio.');
 if(!records.length)fail('Il file non contiene posizioni da importare.');
 const known=new Set();
 for(const r of records){const check=validateAppState(r.state);if(!check.ok)fail(check.errors.join(' '));
  if(r.talId&&known.has(r.talId))fail('Lo stesso ID TAL compare in più posizioni.');if(r.talId)known.add(r.talId);
  r.state=clone(r.state);r.sourceDigest=digest(r.state);r.sourceScope='legacy:'+(r.talId||'personal');
 }
 return records;
}

// Conservative mapping. Original source remains immutable in the private batch.
// No zero/unknown conversion; no pension scheme inferred from dates/ATECO/profile.
export function migrationTarget(record,position,{personal=true,confirmNoContributions=[]}={}) {
 const s=record.state,profile=s.profile,graph=graphFromLedger(s.ledger,profile.activities),warnings=[];
 if(record.talId)warnings.push('L’ID nel backup è conservato come riferimento di origine. Non assegna né sostituisce l’ID della posizione cloud.');
 warnings.push('Dati fiscali e previdenziali del backup conservati, da confermare in TAL. Le conferme precedenti non vengono importate come verifiche.');
 const {activities,year,pension,eligibilityFacts,priorEmployeePensionIncomeCents,employeeIncomeExceptionApplies,startupRateRequested,startupFacts,...identity}=profile;
 const years=Object.entries(s.fiscalYears).map(([year0,annual])=>{
  const {pension:p,forecast,liquidity,...facts}=clone(annual);
  const pensionFacts=p&&typeof p.managementId==='string'&&p.options&&typeof p.options==='object'?p:{};
  if(!pensionFacts.managementId)warnings.push('Previdenza '+year0+': originale conservato, da verificare.');
  return {year:Number(year0),facts:{facts,pensionFacts,forecast,legacyPensionOriginal:clone(p)},...(personal?{privateLiquidity:{liquidity}}:{})};
 });
 const unresolved=[];
 graph.pensionPayments=(s.contributionPayments||[]).flatMap((p,i)=>{
  if(!Number.isSafeInteger(p.amountCents)||p.amountCents<=0||!p.paidDate||!['mandatory','deductible','remainedAtCharge'].every(k=>p[k]===true)||!p.evidenceId||p.managementId!=null&&!/^[A-Z][A-Z0-9_]{1,60}$/.test(p.managementId)){
   unresolved.push(p);warnings.push('Un versamento previdenziale richiede verifica. L’originale è conservato.');return [];
  }
  return [{id:p.id||'legacy-contribution-'+i,paidDate:p.paidDate,amountCents:p.amountCents,managementId:p.managementId??null}];
 });
 const pensionDeclarations=years.map(y=>{
  const unknown=unresolved.some(p=>!p.paidDate||p.paidDate.startsWith(y.year+'-')) || (s.contributionPayments||[]).some(p=>p.paidDate?.startsWith(y.year+'-')&&(!['mandatory','deductible','remainedAtCharge'].every(k=>p[k]===true)||!p.evidenceId));
  const count=graph.pensionPayments.filter(p=>p.paidDate.startsWith(y.year+'-')).length;
  const state=unknown?'unknown':count?'provided':confirmNoContributions.includes(y.year)?'none':'unknown';
  if(state==='unknown')warnings.push('Contributi versati '+y.year+': da verificare, non impostati a zero.');
  return {year:y.year,state};
 });
 if(!personal)warnings.push('Il piano delle spese personali resta nell’originale; lo Studio non accede all’area privata del contribuente.');
 const target={expectedDataRevision:position?.dataRevision??0,sourceScope:record.sourceScope,sourceDigest:record.sourceDigest,
  graph,years,pensionDeclarations,legacyTalId:record.talId,original:clone(s),
  ...(position?{workspaceId:position.id,talId:position.talId}:{}),...(personal?{identity}:{}),
  ...(!personal&&record.studioPrivate?{studioPrivate:record.studioPrivate}:{})};
 return {target,warnings:[...new Set(warnings)],counts:{invoices:graph.invoices.length,payments:graph.payments.length,creditNotes:graph.creditNotes.length,refunds:graph.refunds.length,years:years.length}};
}

// Match the existing binding fingerprint (PostgreSQL jsonb text), only for
// preview. The server repeats all binding/CAS/grant checks at commit time.
export async function bindingDigest(value){
 const enc=new TextEncoder(),compare=(a,b)=>{const x=enc.encode(a),y=enc.encode(b);if(x.length!==y.length)return x.length-y.length;for(let i=0;i<x.length;i++)if(x[i]!==y[i])return x[i]-y[i];return 0;};
 const number=n=>{if(!Number.isFinite(n))fail('Numero non valido nel file.');const raw=JSON.stringify(n);if(!/e/i.test(raw))return raw;
  const [base,e]=raw.toLowerCase().split('e'),negative=base.startsWith('-'),b=base.replace('-',''),digits=b.replace('.',''),point=(b.indexOf('.')<0?b.length:b.indexOf('.'))+Number(e);
  return (negative?'-':'')+(point<=0?'0.'+'0'.repeat(-point)+digits:point>=digits.length?digits+'0'.repeat(point-digits.length):digits.slice(0,point)+'.'+digits.slice(point));};
 const encode=v=>v===null?'null':typeof v==='number'?number(v):Array.isArray(v)?'['+v.map(encode).join(', ')+']':typeof v==='object'?'{'+Object.keys(v).sort(compare).map(k=>JSON.stringify(k)+': '+encode(v[k])).join(', ')+'}':JSON.stringify(v);
 return byteDigest(encode(JSON.parse(JSON.stringify(value))));
}
export async function migrationPreview(target,snapshot){
 const errors=[],counts={},bindings=snapshot.bindings.filter(b=>b.source_scope===target.sourceScope),ids=new Map(bindings.map(b=>[b.legacy_id,b.target_id]));let duplicates=0;
 for(const [kind,rows]of Object.entries(target.graph)){counts[kind]=0;if(kind==='pensionPayments')continue;for(const row of rows){const old=bindings.find(b=>b.kind===kind&&b.legacy_id===row.id);if(!old){counts[kind]++;continue;}
  const copy=clone(row);delete copy._talOrder;
  if(await bindingDigest(copy)!==old.content_hash)errors.push('Un dato già importato è cambiato nel file. Nessuna sostituzione automatica.');
  else if(kind==='invoices')duplicates++;
 }}
 for(const y of target.years||[]){const old=snapshot.years.find(v=>v.year===y.year),facts=clone(y.facts);if(facts.forecast?.activityId)facts.forecast.activityId=ids.get(facts.forecast.activityId)||facts.forecast.activityId;
  if(old&&Object.keys(old.facts).length&&canonicalJson(old.facts.importReview?.state==='needs_review'?old.facts.legacyOriginal:old.facts)!==canonicalJson(old.facts.importReview?.state==='needs_review'?y.facts:facts))errors.push('I dati dell’anno '+y.year+' sono diversi da quelli già presenti.');
 }
 for(const [k,v]of Object.entries(target.identity||{}))if(Object.hasOwn(snapshot.workspace.identity,k)&&canonicalJson(v)!==canonicalJson(snapshot.workspace.identity[k]))errors.push('I dati della posizione non coincidono con il file.');
 const declaration=target.pensionDeclarations?.find(d=>d.year===snapshot.taxYear?.year);
 if(declaration&&snapshot.pensionDeclaration&&snapshot.pensionDeclaration.state!=='unknown')errors.push('I contributi versati hanno già una conferma: verifica i dati prima di importare.');
 return {counts,duplicates,errors:[...new Set(errors)]};
}

export function spreadsheetPreview({matrix,mapping,records,fileName='',sheetName=''}){
 const sheet=normalizeBulkSheetRows(matrix),map=mapping||autoMapBulkHeaders(sheet.headers);
 const missing=BULK_INVOICE_FIELDS.filter(f=>f.required&&!map[f.key]);
 if(missing.length)return {sheet,mapping:map,missing:missing.map(f=>f.key),rows:[],counts:{ready:0,errors:0,duplicates:0}};
 const byCode=new Map();for(const r of records){const key=r.clientCode;byCode.set(key,[...(byCode.get(key)||[]),r]);}
 const seen=new Set(),rows=sheet.rows.map(r=>classifyBulkInvoiceRow(r,sheet.headers,map,byCode,seen,{fileName,sheetName}));
 // Check the reused parser against decimal integer arithmetic before any cents
 // become a command. Ambiguous/rounded disagreements require correction.
 for(let i=0;i<rows.length;i++)for(const [key,field]of [['amount','amountCents'],['paidAmount','paidAmountCents']]){
  const raw=sheet.rows[i].values[sheet.headers.indexOf(map[key])];if(raw==null||raw===''||typeof raw==='object')continue;
  try{if(exactImportedCents(raw)!==rows[i][field])throw Error();}catch{rows[i].status='error';rows[i].errors.push('Importo non rappresentabile con certezza: usa un valore con due decimali.');}
 }
 // Frozen matching supplies duplicate/conflict rules. A same-number row with
 // changed amount/date/customer must be reviewed, never silently discarded.
 const first=new Map();for(const row of rows){if(!row.clientCode||!row.number)continue;
  const key=row.clientCode+'|'+row.issueDate.slice(0,4)+'|'+row.number.normalize('NFKC').replace(/\s/g,'').toUpperCase();
  const value=canonicalJson([row.issueDate,row.amountCents,row.customer,row.paymentDate,row.paidAmountCents,row.activityId]);
  if(first.has(key)&&first.get(key)!==value){row.status='conflict';row.errors=['La stessa fattura compare con dati diversi.'];}
  first.set(key,value);
  const record=records.find(r=>r.clientId===row.clientId),old=record?.personalState.ledger.invoices.find(i=>i.issueDate?.slice(0,4)===row.issueDate.slice(0,4)&&i.number?.normalize('NFKC').replace(/\s/g,'').toUpperCase()===row.number.normalize('NFKC').replace(/\s/g,'').toUpperCase());
  if(old){const amount=old.components.filter(c=>c.kind==='compensation').reduce((n,c)=>n+BigInt(c.amountCents),0n);
   const pays=record.personalState.ledger.payments.filter(p=>p.invoiceId===old.id);
   if(BigInt(row.amountCents??0)!==amount||old.issueDate!==row.issueDate||(old.customer||'Cliente non indicato')!==(row.customer||'Cliente non indicato')||row.paymentDate&&(!pays.some(p=>p.cashDate===row.paymentDate&&p.amountCents===row.paidAmountCents))){row.status='conflict';row.errors=['Una fattura già presente ha dati diversi. Nessuna sovrascrittura automatica.'];}}
 }
 return {sheet,mapping:map,missing:[],rows,counts:{ready:rows.filter(r=>r.status==='ready').length,errors:rows.filter(r=>!['ready','duplicate'].includes(r.status)).length,duplicates:rows.filter(r=>r.status==='duplicate').length}};
}
function exactImportedCents(value){
 let raw=String(value).trim().replace(/[\s\u00a0€+]/g,'');
 if(raw.includes(',')&&raw.includes('.')){const dec=raw.lastIndexOf(',')>raw.lastIndexOf('.')?',':'.';raw=raw.split(dec===','?'.':',').join('').replace(dec,'.');}
 else if(raw.includes(','))raw=raw.replace(',','.');
 else if((raw.match(/\./g)||[]).length>1)raw=raw.replaceAll('.','');
 const m=raw.match(/^(\d+)(?:\.(\d*))?$/);if(!m)throw Error();
 const tail=m[2]||'';let cents=BigInt(m[1])*100n+BigInt((tail+'00').slice(0,2));
 if(tail.length>2){if(typeof value!=='number')throw Error();if(Number(tail[2])>=5)cents++;}
 if(cents>BigInt(Number.MAX_SAFE_INTEGER)||cents<0)throw Error();return Number(cents);
}
export function tabularTargets(preview,positions,{fileName='',sheetName=''}={}){
 if(preview.missing.length||preview.counts.errors)fail('Correggi le righe indicate. Nessun dato è stato importato.');
 return positions.flatMap(position=>{
  const selected=preview.rows.filter(r=>r.status==='ready'&&r.clientId===position.id);if(!selected.length)return [];
  const graph={activities:[],invoices:[],components:[],payments:[],allocations:[],creditNotes:[],creditNoteLines:[],refunds:[]};
  for(const r of selected){const id='tabular-'+r.fingerprint,component=id+'-component';
   graph.invoices.push({id,type:'invoice',number:r.number,issueDate:r.issueDate,currency:'EUR',customer:r.customer||'Cliente non indicato',origin:{type:'ProfessionalSpreadsheetV1',sourceFingerprint:r.fingerprint}});
   graph.components.push({id:component,invoiceId:id,kind:'compensation',amountCents:r.amountCents,activityId:r.activityId});
   if(r.paymentDate){if(r.paidAmountCents>r.amountCents)fail('L’incasso supera l’importo della fattura.');const p=id+'-payment';
    graph.payments.push({id:p,invoiceId:id,cashDate:r.paymentDate,currency:'EUR',amountCents:r.paidAmountCents,cashReceivedCents:r.paidAmountCents,withholdingCents:0});
    graph.allocations.push({id:id+'-allocation',paymentId:p,componentId:component,amountCents:r.paidAmountCents});}
  }
  return [{workspaceId:position.id,talId:position.talId,expectedDataRevision:position.dataRevision,sourceScope:'tabular:v1',sourceDigest:digest(graph),graph,
   provenance:{fileName,sheetName,rows:selected.map(r=>r.rowNumber)}}];
 });
}
export function xmlPreview(files,state,assignments={}){
 const preview=F.prepareBatch(files,state);if(preview.status==='blocked')return {preview,errors:preview.diagnostics.map(d=>d.message),target:null};
 if(preview.value.requiresAssignment&&preview.value.documents.some(d=>d.assignmentRequired&&!assignments[d.documentIdentity]))return {preview,errors:[],needsAssignment:true,target:null};
 const applied=F.applyBatch(preview,state,assignments);
 if(applied.status==='blocked')return {preview,errors:applied.diagnostics.map(d=>d.message),target:null};
 const graph=graphFromLedger(applied.value.ledger,state.profile.activities),before=graphFromLedger(state.ledger,state.profile.activities);
 for(const key of Object.keys(graph)){const ids=new Set(before[key]?.map(r=>r.id)||[]);graph[key]=graph[key].filter(r=>!ids.has(r.id));}
 return {preview,errors:[],graph};
}
export async function readImportFile(file,xlsx){
 if(!file||file.size<=0||file.size>15*1024*1024)fail('Usa un file non vuoto entro 15 MiB.');
 const ext=file.name.split('.').at(-1).toLowerCase();
 if(ext==='xlsx'){
  if(!xlsx)fail('La lettura Excel non è disponibile.');
  const workbook=xlsx.read(await file.arrayBuffer(),{type:'array',cellDates:false,cellFormula:true,raw:true});
  if(!workbook.SheetNames.length)fail('Il file non contiene fogli.');
  return {kind:'table',sheets:workbook.SheetNames.map(name=>({name,matrix:bulkWorksheetMatrix(workbook.Sheets[name],xlsx)})),name:file.name};
 }
 const text=await file.text();
 if(ext==='csv')return {kind:'table',sheets:[{name:'CSV',matrix:parseCsvRows(text)}],name:file.name};
 if(ext==='xml')return {kind:'xml',files:[{name:file.name,text,size:file.size}],name:file.name};
 if(ext==='json'){let parsed;try{parsed=JSON.parse(text);}catch{fail('Il file JSON non è leggibile.');}return {kind:'legacy',records:parseBackup(parsed),name:file.name};}
 fail('Scegli un file TAL (.json), FatturaPA (.xml), CSV o XLSX.');
}
