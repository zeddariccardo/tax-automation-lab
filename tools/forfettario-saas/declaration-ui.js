import {parseAmount,amountInput} from './income-model.js';
export function createDeclarationUI({auth,service,controller,route,openPanel,done,notify,esc}){
 let opened=null,jobs=new WeakMap();
 const identity=()=>{const a=auth.getState();return a.phase==='ready'?a.user.id+':'+a.selected.context_type+':'+a.selected.context_id:'';};
 const current=stamp=>identity()===stamp&&route().page==='dichiarazione';
 async function act(name){
  if(!name.startsWith('declaration-')||name==='declaration-retry')return false;
  const r=route(),stamp=identity(),d=controller.getState().data?.draft;
  if(!d||d.workspaceId!==r.id||r.role!=='studio')return true;
  if(name==='declaration-json'||name==='declaration-print'){
   await controller.refresh();if(!current(stamp)||route().id!==r.id)return true;
   const record=controller.getState().data;if(!record||record.draft?.workspaceId!==r.id){notify('La bozza deve essere aggiornata prima di esportarla.');return true;}
   if(name==='declaration-json'){
    const blob=new Blob([JSON.stringify(record,null,2)],{type:'application/json'});
    const url=URL.createObjectURL(blob),anchor=document.createElement('a');anchor.href=url;anchor.download='TAL-bozza-Redditi-PF-2026-v'+record.revision+'.json';
    anchor.click();setTimeout(()=>URL.revokeObjectURL(url),1000);notify('Bozza esportata.');
   }else{
    const details=[...document.querySelectorAll('.declaration-page details')],previous=details.map(x=>x.open);
    details.forEach(x=>x.open=true);
    const restore=()=>details.forEach((x,i)=>x.open=previous[i]);window.addEventListener('afterprint',restore,{once:true});window.print();
   }
   return true;
  }
  if(!['declaration-losses','declaration-advances'].includes(name))return true;
  const losses=name==='declaration-losses',field=losses?'priorLossesNone':'lmAdvancesPaidCents';
  opened={stamp,workspaceId:r.id,year:2025,expectedRevision:d.reviewRevision,sourceHash:d.sourceHash,field};
  const previous=d.fields.find(f=>f.id===(losses?'LM37.5':'LM45.2'))?.value;
  openPanel(losses?'Perdite pregresse':'Acconti versati 2025',
   '<form id="declaration-review-form">'+(losses?'<p>Conferma soltanto dopo aver verificato che non esistono perdite pregresse da utilizzare. Se esistono, il relativo calcolo resta da verificare.</p><div class="field"><label for="declaration-loss-value">Esito della verifica</label><select id="declaration-loss-value" name="value"><option value="confirm">Confermo: nessuna perdita pregressa</option value="clear">Da verificare · rimuovi conferma</option></select></div>':
    '<p>Importo effettivamente versato per gli acconti dell’imposta sostitutiva 2025, esclusi interessi e maggiorazioni. Non inserire acconti previdenziali.</p><div class="field"><label for="declaration-amount">Importo in euro</label><input id="declaration-amount" name="amount" inputmode="decimal" required value="'+(Number.isSafeInteger(previous)?amountInput(previous):'')+'"></div>')+
   '<div class="field"><label for="declaration-reason">Riferimento della verifica</label><input id="declaration-reason" name="reason" required minlength="3" maxlength="1000" autocomplete="off"></div><p class="small">La conferma conserva autore, motivazione e valore precedente. Va rivista quando cambiano i dati fiscali.</p><p class="error" role="alert" tabindex="-1"></p><button class="button" type="submit">Salva verifica</button></form>');
  return true;
 }
 async function submit(form){
  if(form.id!=='declaration-review-form')return false;
  if(form.dataset.busy==='true'||!opened)return true;
  const captured=opened,controls=[...form.querySelectorAll('input,select,button')],error=form.querySelector('.error');
  const still=()=>form.isConnected&&current(captured.stamp)&&route().id===captured.workspaceId;
  form.dataset.busy='true';error.textContent='';
  try{
   if(!jobs.has(form)){
    const raw=form.elements.amount?.value.trim();
    const value=captured.field==='priorLossesNone'?(form.elements.value.value==='confirm'?true:null):/^0+(?:[.,]0{1,2})?$/.test(raw)?0:parseAmount(raw);
    if(value!==null&&captured.field==='lmAdvancesPaidCents'&&(!Number.isSafeInteger(value)||value<0))throw Object.assign(Error(),{code:'invalid'});
    const reason=form.elements.reason.value.trim();if(reason.length<3)throw Object.assign(Error(),{code:'invalid'});
    jobs.set(form,{key:crypto.randomUUID(),payload:{year:captured.year,expectedRevision:captured.expectedRevision,sourceHash:captured.sourceHash,field:captured.field,value,reason}});
   }
   controls.forEach(x=>x.disabled=true);const job=jobs.get(form);
   await service.reviewDeclaration(captured.workspaceId,job.payload,job.key);jobs.delete(form);
   if(!still())return true;await controller.refresh();if(still())done('Verifica salvata. La bozza è stata aggiornata.');
  }catch(e){
   if(!still())return true;
   const uncertain=['uncertain','stale'].includes(e.code);if(!uncertain)jobs.delete(form);
   error.textContent=e.code==='conflict'?'I dati sono cambiati. Chiudi e riapri la verifica sulla bozza aggiornata.':
    ['expired','forbidden'].includes(e.code)?'Il tuo accesso è cambiato. Non puoi salvare questa verifica.':
    uncertain?'Conferma non ricevuta. Riprova: lo stesso tentativo non crea duplicati.':'Controlla importo e riferimento della verifica.';
   if(['conflict','forbidden'].includes(e.code))await controller.refresh();
   if(still()){error.focus();controls.forEach(x=>x.disabled=uncertain&&x.tagName!=='BUTTON');}
  }finally{form.dataset.busy='false';}
  return true;
 }
 return {act,submit,clear(){opened=null;jobs=new WeakMap();}};
}
