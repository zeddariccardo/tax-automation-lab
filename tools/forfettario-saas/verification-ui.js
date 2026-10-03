// An explicit professional attestation; the server derives actor and current grant.
import {paymentRecords} from './workflow-view.js';
export function createVerificationUI({auth,service,route,fiscals,payments,openPanel,done}){
 let opened=null,job=null;
 const stamp=()=>{const s=auth.getState();return s.phase==='ready'?s.user.id+':'+s.selected.context_type+':'+s.selected.context_id:'';};
 const current=o=>o&&o.stamp===stamp()&&route().id===o.workspace&&route().page===o.page;
 async function act(name){
  if(!name.startsWith('fact-verify:'))return false;
  const s=auth.getState(),r=route();if(s.selected?.context_type!=='studio')return true;
  const [,kind,id]=name.split(':'),controller=kind==='pension_payment'?fiscals:kind==='f24_payment'?payments:null;
  if(!controller)return true;
  const o={stamp:stamp(),workspace:r.id,page:r.page,controller};
  await controller.refresh();if(!current(o))return true;
  const d=controller.getState().data;
  const record=kind==='pension_payment'?d?.pensionPayments?.find(p=>p.id===id):paymentRecords(d?.draft).find(p=>p.id===id);
  if(!record||record.confirmation?.evidenceStatus==='needs_review')return true;
  opened={...o,kind,id,revision:(record.verifications||[]).length};job=null;
  openPanel('Verifica del versamento','<p>Conferma dopo aver controllato il versamento. La dichiarazione originale del titolare resta nello storico.</p><form id="fact-verification-form"><div class="field"><label for="fact-verification-reason">Riferimento della verifica</label><input id="fact-verification-reason" name="reason" required minlength="3" maxlength="1000"></div><p class="error" role="alert" tabindex="-1"></p><button class="button" type="submit">Conferma verifica dello Studio</button></form>');
  return true;
 }
 async function submit(form){
  if(form.id!=='fact-verification-form')return false;
  const o=opened;if(!current(o)||form.dataset.busy==='true')return true;
  const controls=[...form.querySelectorAll('input,button')],error=form.querySelector('.error'),valid=()=>form.isConnected&&current(o);
  form.dataset.busy='true';error.textContent='';
  try{
   const reason=form.elements.reason.value.trim();if(reason.length<3||reason.length>1000)throw Object.assign(Error(),{code:'invalid'});
   job ||= {key:crypto.randomUUID(),payload:{kind:o.kind,id:o.id,expectedRevision:o.revision,reason}};
   controls.forEach(x=>x.disabled=true);
   await service.verifyPaymentFact(o.workspace,job.payload,job.key);job=null;
   if(!valid())return true;await o.controller.refresh();if(valid())done('Verifica dello Studio registrata.');
  }catch(e){
   if(!valid())return true;const uncertain=['uncertain','stale'].includes(e.code);if(!uncertain)job=null;
   error.textContent=uncertain?'Conferma non ricevuta. Riprova lo stesso tentativo.':e.code==='conflict'?'La verifica è cambiata. Chiudi e riapri il versamento.':['forbidden','expired'].includes(e.code)?'Non sei più autorizzato a verificare questo versamento.':'Controlla il riferimento della verifica.';
   controls.forEach(x=>x.disabled=uncertain&&x.tagName!=='BUTTON');error.focus();
  }finally{form.dataset.busy='false';}
  return true;
 }
 return {act,submit,clear(){opened=null;job=null;}};
}
