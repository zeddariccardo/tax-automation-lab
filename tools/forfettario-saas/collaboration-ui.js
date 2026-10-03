import {parseAmount,amountInput,formatCents} from './income-model.js';
import {managementLabel} from './workflow-view.js';
// Presentation and transient form state. All network operations live in tal-data-service.
export function createCollaborationUI({service,controller,route,access,openPanel,done,notify,esc,button,render}){
 const jobs=new WeakMap();let reviewContext=null,requestTargets=[];let activeDownload=0;const urls=new Set();
 const data=()=>controller.getState().data?.find(x=>x.workspaceId===route().id);
 const identity=()=>{const a=access();return a.phase==='ready'?a.user.id+':'+a.selected.context_type+':'+a.selected.context_id+':'+route().id:'';};
 const errors={file:'Il documento non corrisponde al formato previsto. Usa PDF, PNG, JPG o XML fino a 10 MiB.',forbidden:'L’accesso è cambiato o la richiesta non è più disponibile.',expired:'Accedi di nuovo per continuare.',conflict:'La richiesta è cambiata. Chiudi questo pannello e controlla la situazione aggiornata.',evidence:'Questo documento è conservato come evidenza nella cronologia e non può essere eliminato.',uncertain:'Non abbiamo ricevuto conferma. Riprova: lo stesso tentativo non crea duplicati.',stale:'La sessione è cambiata. Riapri la richiesta.',idempotency:'Il tentativo precedente contiene dati diversi. Chiudi e controlla le attività.',invalid:'Controlla i dati e riprova.'};
 const errorMarkup='<p class="error" role="alert" tabindex="-1"></p>';
 const form=(id,body,label,attributes='')=>'<form id="'+id+'" '+attributes+'>'+body+errorMarkup+'<p class="small" role="status"></p><button class="button" type="submit">'+label+'</button></form>';
 function fileForm(item){return form('collaboration-upload',(item?'<p>'+esc(item.body)+'</p>':'')+'<div class="field"><label for="document-file">Scegli il documento</label><input id="document-file" type="file" name="file" accept=".pdf,.png,.jpg,.jpeg,.xml,application/pdf,image/png,image/jpeg,application/xml,text/xml" required aria-describedby="file-help"><p id="file-help">PDF, PNG, JPG o XML · massimo 10 MiB. Usa solo dati sintetici.</p></div>','Carica documento',item?'data-request="'+item.id+'"':'');}
 async function download(doc){const stamp=identity(),seq=++activeDownload;const blob=await service.downloadDocument(route().id,doc);if(identity()!==stamp||seq!==activeDownload)return false;
  const url=URL.createObjectURL(blob);urls.add(url);const anchor=document.createElement('a');anchor.href=url;anchor.download=doc.original_filename.replace(/[\x00-\x1f/\\]/g,'_');anchor.rel='noopener';anchor.click();setTimeout(()=>{URL.revokeObjectURL(url);urls.delete(url);},10000);return true;
 }
 async function action(name,element){
  const d=data(),item=d?.activities.find(x=>x.id===element?.dataset.request);
  switch(name){
   case 'request-again':{const f=document.querySelector('#collaboration-complete');if(!f)return true;f.dataset.reopen='true';await submit(f);return true;}
   case 'collaboration-retry':await controller.refresh();return true;
   case 'new-request':{if(!d)return true;const stamp=identity(),w=await service.readWorkflow(route().id);if(stamp!==identity())return true;requestTargets=[...(w.pensionObligations||[]).map(o=>({label:'Ricevuta contributi · '+managementLabel(o.managementId)+' '+o.year,target:{kind:'pension',obligationId:o.id}})),...(w.payments?.result?.groups||[]).filter(g=>['READY','DOWNLOADED'].includes(g.status)).map(g=>({label:'Quietanza F24 · '+g.dueDate+' · '+formatCents(g.totalCents),target:{kind:'f24',draftId:w.payments.id,groupKey:g.key}}))];openPanel('Richiedi un documento',form('collaboration-request','<div class="field"><label for="request-target">A cosa serve</label><select id="request-target" name="target"><option value="">Documento generico</option>'+requestTargets.map((t,i)=>'<option value="'+i+'">'+esc(t.label)+'</option>').join('')+'</select></div><div class="field"><label for="request-text">Documento richiesto</label><textarea id="request-text" name="text" rows="3" maxlength="4000" required placeholder="Carica la ricevuta dei contributi versati"></textarea></div>','Invia richiesta'));return true;}
   case 'upload-request':if(item)openPanel('Carica documento',fileForm(item));return true;
   case 'upload-other':if(d)openPanel('Aggiungi un documento',fileForm(null));return true;
   case 'document':{const doc=d?.documents.find(x=>x.id===element.dataset.document);if(!doc)return true;element.disabled=true;try{if(await download(doc))notify('Documento scaricato.');}finally{element.disabled=false;}return true;}
   case 'review':case 'complete-request':case 'confirm-request':{
    if(!item)return true;const doc=d.documents.find(x=>x.id===item.document_id);
    const captured=identity();reviewContext=item.fact_target?await service.readWorkflow(route().id):null;if(identity()!==captured)return true;
    openPanel(name==='confirm-request'?'Conferma il dato':'Verifica la richiesta',form('collaboration-complete','<p>'+esc(item.body)+'</p>'+(item.fact_target?factFields(item,reviewContext):'')+(doc?'<p>'+esc(doc.original_filename)+'</p><p role="status" id="review-download">Download del documento…</p>':'') ,name==='confirm-request'?'Conferma':item.fact_target?'Conferma e registra':'Completa richiesta','data-request="'+item.id+'" data-status="'+(name==='confirm-request'?'submitted':'completed')+'"'));
    const target=document.querySelector('#collaboration-complete');if(doc)target.insertAdjacentHTML('beforeend','<div class="field"><label for="reopen-reason">Se il documento è errato o incompleto</label><input id="reopen-reason" name="reopenReason" placeholder="Cosa manca o va corretto"></div><button type="button" class="text-link" data-action="request-again">Richiedi di nuovo</button>');if(doc){target.querySelector('[type=submit]').disabled=true;try{if(await download(doc)&&target.isConnected){target.querySelector('#review-download').textContent='Documento scaricato. Dopo il controllo, completa la richiesta.';target.querySelector('[type=submit]').disabled=false;}}catch(e){if(target.isConnected){target.querySelector('#review-download').textContent='Download non riuscito. Chiudi e riprova.';}throw e;}}return true;
   }
  }return false;
 }

 function factFields(item,w){
  const t=item.fact_target,g=t.kind==='f24'?w.payments?.result?.groups.find(g=>g.key===t.groupKey):null;
  return '<p>Il documento verrà collegato '+(t.kind==='f24'?'al pagamento F24':'al versamento contributivo')+'. Verifica il contenuto prima di registrare.</p><div class="field"><label for="fact-amount">Importo effettivamente versato (€)</label><input id="fact-amount" name="factAmount" inputmode="decimal" required value="'+(g?amountInput(g.totalCents):'')+'"></div><div class="field"><label for="fact-date">Data effettiva del versamento</label><input id="fact-date" name="factDate" type="date" required></div>'+(t.kind==='pension'?'<div class="field"><label for="fact-year">Anno cui si riferiscono i contributi</label><input id="fact-year" name="referenceYear" type="number" min="1900" max="2200" required value="'+(w.pensionObligations.find(o=>o.id===t.obligationId)?.year||'')+'"></div><div class="field"><label for="fact-role">Tipo di versamento</label><select id="fact-role" name="settlementRole" required><option value="">Scegli</option><option value="minimum">Minimale</option><option value="advance">Acconto</option><option value="balance">Saldo</option></select></div>':'')+'<div class="field"><label for="fact-reason">Riferimento della verifica</label><input id="fact-reason" name="factReason" required minlength="3" maxlength="1000"></div>';
 }
 function factPayload(form,item,w){
  const t=item.fact_target,amountCents=parseAmount(form.elements.factAmount.value),paidDate=form.elements.factDate.value,reason=form.elements.factReason.value.trim();
  if(!paidDate||reason.length<3)throw {code:'invalid'};
  if(t.kind==='f24'){const g=w.payments?.result?.groups.find(g=>g.key===t.groupKey);if(!g||w.payments.id!==t.draftId)throw {code:'conflict'};return {draftId:t.draftId,groupKey:t.groupKey,action:'PAID',expectedRevision:g.eventRevision,evidence:{documentId:item.document_id,paidDate,amountCents,reason}};}
  const referenceYear=Number(form.elements.referenceYear.value),settlementRole=form.elements.settlementRole.value;
  if(!referenceYear||!settlementRole)throw {code:'invalid'};
  return {year:Number(paidDate.slice(0,4)),paidDate,amountCents,movementKind:'payment',obligationId:t.obligationId,referenceYear,settlementRole,expectedDataRevision:Number(w.dataRevision),evidenceId:item.document_id};
 }
 async function submit(target){
  if(!['collaboration-upload','collaboration-request','collaboration-complete','message-form'].includes(target.id))return false;
  if(target.dataset.busy==='true')return true;const stamp=identity(),w=route().id,current=()=>identity()===stamp&&target.isConnected;
  const controls=[...target.querySelectorAll('input,textarea,select,button')],message=target.querySelector('.error'),submit=target.querySelector('[type=submit]');target.dataset.busy='true';message.textContent='';controls.forEach(x=>x.disabled=true);
  try{
   const d=data();if(!d)throw Object.assign(Error(),{code:'stale'});
   if(!jobs.has(target)){
    if(target.id==='collaboration-upload'){const file=target.elements.file.files[0];if(!file)throw Object.assign(Error(),{code:'file'});jobs.set(target,await service.prepareUpload(w,file,d.activities.find(x=>x.id===target.dataset.request)));}
    else {const item=d.activities.find(x=>x.id===target.dataset.request),a=access(),recipient=a.selected.context_type==='studio'?'personal:'+w:d.links[0]?'studio:'+d.links[0].studio_id:null;
     const body=target.id==='message-form'?target.elements.message.value.trim():target.elements.text?.value.trim();
     if(target.id!=='collaboration-complete'&&(!body||!recipient))throw Object.assign(Error(),{code:'invalid'});
     let method=target.id==='collaboration-complete'?(target.dataset.status==='submitted'?'submitConfirmation':'completeRequest'):'postActivity',payload=target.id==='collaboration-complete'?item:{kind:target.id==='message-form'?'message':'request_upload',body,recipientContext:recipient};
     if(target.id==='collaboration-request'&&target.elements.target.value!==''){method='requestFactDocument';payload={body,recipientContext:recipient,target:requestTargets[Number(target.elements.target.value)].target};}
     if(target.dataset.reopen==='true'){const reason=target.elements.reopenReason.value.trim();if(reason.length<3)throw {code:'invalid'};method='reopenRequest';payload={requestId:item.id,expectedRevision:Number(item.revision),reason};}
     else if(target.id==='collaboration-complete'&&item.fact_target){method='resolveDocumentFact';payload={requestId:item.id,expectedRevision:Number(item.revision),fact:factPayload(target,item,reviewContext)};}
     jobs.set(target,{key:crypto.randomUUID(),item,method,payload});
    }
   }
   const job=jobs.get(target);
   if(target.id==='collaboration-upload')await service.uploadDocument(job,text=>{if(current()){submit.textContent=text;target.querySelector('[role=status]').textContent=text;}});
   else await service[job.method](w,job.payload,job.key);
   jobs.delete(target);if(!current())return true;
   if(target.id==='message-form')target.elements.message.value='';
   await controller.refresh();
   if(identity()===stamp){if(target.id==='message-form'){target.dataset.busy='false';render(false);notify('Messaggio inviato.');document.querySelector('#message')?.focus();}else done(target.id==='collaboration-upload'?(target.dataset.request?'Documento inviato · da verificare':'Documento aggiunto.') :target.id==='collaboration-request'?'Richiesta inviata.':'Richiesta aggiornata.');}
  }catch(e){
   if(!current())return true;
   // Preserve the exact payload/file and keys after uncertain outcomes; never auto-renew a reservation.
   const uncertain=['uncertain','stale'].includes(e.code);if(!uncertain&&target.id!=='collaboration-upload'){jobs.delete(target);delete target.dataset.reopen;}
   if(['forbidden','conflict'].includes(e.code))await controller.refresh();
   if(current()){message.textContent=errors[e.code]||'Non riusciamo a completare l’operazione. Riprova.';message.focus();controls.forEach(x=>x.disabled=(uncertain||jobs.has(target))&&x.tagName!=='BUTTON');submit.textContent='Riprova';submit.disabled=['forbidden','expired','conflict','file'].includes(e.code)&&jobs.has(target);}
  }finally{target.dataset.busy='false';if(!jobs.has(target))controls.forEach(x=>x.disabled=false);}
  return true;
 }
 return{action,submit,clear(){reviewContext=null;requestTargets=[];activeDownload++;for(const url of urls)URL.revokeObjectURL(url);urls.clear();}};
}
