import {parseAmount,amountInput,formatCents} from './income-model.js';
const labels={advancesPaid:'Acconti imposta sostitutiva 2025 versati',taxCredits:'Crediti d’imposta pertinenti',withholdings:'Ritenute pertinenti',priorCredit:'Credito dalla dichiarazione precedente',priorCreditUsed:'Credito precedente già utilizzato',suspendedAdvances:'Acconti sospesi',otherPayments:'Altri versamenti da riconciliare',adjustments:'Altre rettifiche dichiarative'};
const amount=v=>{const s=v.trim();if(!s)return null;if(/^0+(?:[.,]0{1,2})?$/.test(s))return 0;return parseAmount(s);};
export function createPaymentsUI({auth,service,controller,route,openPanel,done,notify,esc}){
 let opened=null,jobs=new WeakMap();
 const stamp=()=>{const s=auth.getState();return s.phase==='ready'?s.user.id+':'+s.selected.context_type+':'+s.selected.context_id:'';};
 const valid=o=>o&&stamp()===o.stamp&&route().id===o.id&&route().page==='pagamenti';
 const field=(key,label,value='',extra='')=>'<div class="field"><label for="pay-'+key+'">'+label+'</label><input id="pay-'+key+'" name="'+key+'" value="'+esc(value)+'" '+extra+'></div>';
 const errors='<p class="error" role="alert" tabindex="-1"></p>';
 const download=(blob,name)=>{const u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);};
 async function act(name){
  if(!name.startsWith('payments-'))return false;
  if(name==='payments-retry'){await controller.refresh();return true;}
  const r=route(),o={stamp:stamp(),id:r.id};
  await controller.refresh();if(!valid(o))return true;
  const data=controller.getState().data;if(!data){notify('Pagamenti non disponibili. Riprova.');return true;}
  opened={...o,data};
  if(name==='payments-review'){
   if(r.role!=='studio')return true;
   const facts=data.reviewFacts;
   openPanel('Verifica versamenti e crediti','<form id="payments-review-form"><p>Importi dell’imposta sostitutiva 2025. Lascia vuoto ciò che non hai verificato; indica 0 soltanto quando ne hai accertato l’assenza.</p>'+
    Object.entries(labels).map(([k,l])=>field(k,l,Number.isSafeInteger(facts?.amounts?.[k])?amountInput(facts.amounts[k]):'','inputmode="decimal"')).join('')+
    '<div class="field"><label for="pay-method">Metodo acconti 2026</label><select id="pay-method" name="method"><option value="">Da confermare</option><option value="historical">Storico</option><option value="forecast">Previsionale · da verificare</option></select></div>'+
    '<details><summary>Ripartizione acconti · verifica professionale</summary><div class="field"><label for="pay-scope">Perimetro articolo 58</label><select id="pay-scope" name="scope"><option value="">Da verificare</option><option value="inside">Attività nel perimetro ISA · verificato</option><option value="outside">Fuori dal perimetro · verificato</option></select></div>'+
    field('isaCode','Codice ISA')+field('activityCode','Codice attività verificato')+field('revenue','Ricavi per il test ISA','', 'inputmode="decimal"')+field('limit','Limite ISA applicabile','', 'inputmode="decimal"')+
    '<p class="small">I dati ISA servono solo per il perimetro verificato. Situazioni con più attività restano da verificare per la ripartizione.</p></details>'+
    field('reason','Riferimento della verifica',facts?.reason||'','required minlength="3" maxlength="1000"')+errors+'<button class="button" type="submit">Salva verifica</button></form>');
   const form=document.querySelector('#payments-review-form');form.elements.method.value=facts?.method||'';form.elements.scope.value=facts?.scope?.scope||'';
   for(const k of ['isaCode','activityCode'])form.elements[k].value=facts?.scope?.[k]||'';
   for(const [k,p]of [['revenue','revenueCents'],['limit','limitCents']])form.elements[k].value=Number.isSafeInteger(facts?.scope?.[p])?amountInput(facts.scope[p]):'';
   return true;
  }
  if(!name.startsWith('payments-open:'))return true;
  const key=decodeURIComponent(name.slice(14)),g=data.draft.groups.find(g=>g.key===key);if(!g)return true;opened.group=g;
  const allowed=['READY','DOWNLOADED','PAID'].includes(g.status);
  let docs=[];if(r.role==='studio'&&allowed&&g.status!=='PAID'){try{docs=(await service.listCollaboration(r.id)).documents;}catch{}if(!valid(o))return true;}
  opened.documents=docs;
  const row=g.lines.map(l=>'<tr><td>'+esc(l.taxCode)+'</td><td>'+esc(l.referenceTaxYear)+'</td><td>'+formatCents(l.amountCents)+'</td></tr>').join('');
  openPanel('F24 · '+(g.dueDate||'da verificare'),'<div class="payment-preview"><p>'+esc(data.draft.taxpayer.name)+' · '+esc(data.draft.taxpayer.cf)+'</p><table><caption>Sezione Erario</caption><thead><tr><th>Codice</th><th>Anno</th><th>Importo</th></tr></thead><tbody>'+row+'</tbody></table><p><strong>Totale '+formatCents(g.totalCents)+'</strong></p><p class="small">Modello precompilato, non file telematico. Controlla anagrafica e termine di versamento; il ravvedimento non è incluso.</p></div>'+
   '<form id="payments-action-form">'+errors+
   (g.status==='DRAFT'&&r.role==='studio'?'<p>Conferma dopo aver controllato imposta, versamenti e dati del contribuente.</p><button class="button" type="submit" name="command" value="READY">Conferma F24</button>':
    allowed?'<button class="button" type="submit" name="command" value="PDF">Scarica F24 PDF</button> <button class="text-link" type="submit" name="command" value="JSON">Esporta dati JSON</button>':'<p>Questa versione non è ancora disponibile per il download.</p>')+
   (r.role==='studio'&&allowed&&g.status!=='PAID'?'<details class="payment-evidence"><summary>Registra pagamento documentato</summary><p>Seleziona una ricevuta già caricata e verifica che attesti il versamento completo di questo F24.</p>'+
    '<div class="field"><label for="pay-document">Ricevuta del versamento</label><select id="pay-document" name="document" required><option value="">Seleziona documento</option>'+docs.map(d=>'<option value="'+esc(d.id)+'">'+esc(d.original_filename)+'</option>').join('')+'</select></div>'+
    field('paidDate','Data di pagamento','','type="date" required')+field('reason','Riferimento della verifica','','minlength="3" maxlength="1000" required')+
    '<button class="button" type="submit" name="command" value="PAID">Registra pagamento</button></details>':'')+'</form>');
  // Receipt fields are validated only for PAID, never block a download.
  document.querySelector('#payments-action-form').noValidate=true;
  return true;
 }
 async function submit(form,submitter){
  if(!['payments-review-form','payments-action-form'].includes(form.id))return false;
  const o=opened;if(!valid(o)||form.dataset.busy==='true')return true;
  const controls=[...form.querySelectorAll('input,select,button')],error=form.querySelector('.error'),still=()=>form.isConnected&&valid(o);
  form.dataset.busy='true';error.textContent='';
  try{
   let job=jobs.get(form);
   if(!job){
    if(form.id==='payments-review-form'){
     const amounts=Object.fromEntries(Object.keys(labels).map(k=>[k,amount(form.elements[k].value)])),scope=form.elements.scope.value;
     const facts={amounts,method:form.elements.method.value||null,scope:scope?{scope,verified:true,isaCode:form.elements.isaCode.value.trim()||null,activityCode:form.elements.activityCode.value.trim()||null,revenueCents:amount(form.elements.revenue.value),limitCents:amount(form.elements.limit.value)}:null,reason:form.elements.reason.value.trim()};
     if(facts.reason.length<3)throw Object.assign(Error(),{code:'invalid'});
     job={key:crypto.randomUUID(),review:true,payload:{inputHash:o.data.reviewInput,facts}};
    }else{
     const cmd=submitter?.value,g=o.group;if(!['READY','PDF','JSON','PAID'].includes(cmd))return true;
     const evidence=cmd==='PAID'?{documentId:form.elements.document.value,paidDate:form.elements.paidDate.value,amountCents:g.totalCents,reason:form.elements.reason.value.trim()}:null;
     if(evidence&&(!o.documents.some(d=>d.id===evidence.documentId)||!evidence.paidDate||evidence.reason.length<3))throw Object.assign(Error(),{code:'invalid'});
     job={key:crypto.randomUUID(),cmd,payload:{draftId:o.data.id,groupKey:g.key,action:cmd==='PDF'||cmd==='JSON'?'DOWNLOADED':cmd,expectedRevision:g.eventRevision,evidence}};
     if(cmd==='PDF'){const {renderF24Pdf}=await import('./f24-renderer.generated.js');job.blob=renderF24Pdf(o.data.draft.taxpayer,g).output('blob');}
     if(cmd==='JSON')job.blob=new Blob([JSON.stringify({draftId:o.data.id,...o.data.draft,groups:[g]},null,2)],{type:'application/json'});
    }
    jobs.set(form,job);
   }
   controls.forEach(x=>x.disabled=true);
   if(job.review)await service.reviewPayments(o.id,job.payload,job.key);else await service.actF24(o.id,job.payload,job.key);
   jobs.delete(form);if(!still())return true;
   if(job.blob)download(job.blob,'TAL-F24-'+o.group.key+'.'+(job.cmd==='PDF'?'pdf':'json'));
   await controller.refresh();if(still())done(job.cmd==='PAID'?'Pagamento registrato con la ricevuta.':job.blob?'Modello scaricato. Lo stato del pagamento non cambia.':'Verifica salvata.');
  }catch(e){
   if(!still())return true;const uncertain=['uncertain','stale'].includes(e.code);if(!uncertain)jobs.delete(form);
   error.textContent=e.code==='conflict'?'I dati sono cambiati. Chiudi e riapri i pagamenti aggiornati.':['forbidden','expired'].includes(e.code)?'Non sei più autorizzato a questa operazione.':uncertain?'Conferma non ricevuta. Riprova lo stesso tentativo, senza duplicarlo.':'Controlla i dati. La verifica o il modello non sono disponibili.';
   error.focus();controls.forEach(x=>x.disabled=uncertain&&x.tagName!=='BUTTON');
  }finally{form.dataset.busy='false';}
  return true;
 }
 return {act,submit,clear(){opened=null;jobs=new WeakMap();}};
}
