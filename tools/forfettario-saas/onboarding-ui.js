import {inviteCode,newInviteToken,activityCanBeSaved} from './onboarding-service.js';
// Drafts and invitation tokens live only in memory and are cleared on identity changes.
export function createOnboardingUI({auth,service,esc,button,openPanel,notify,render,refresh,positions=()=>[]}) {
 let currentContext='',user=null,state=null,loading=false,error='',choice='',busy=false,generation=0,invite=null,preview=null;
 const jobs=new WeakMap();
 const message=e=>({uncertain:'Non abbiamo ricevuto conferma. Riprova: useremo la stessa operazione.',conflict:'I dati sono cambiati. Aggiorna la pagina e riprova.',context:'Apri la posizione indicata nell’invito e riprova.',limited:'Troppi tentativi. Riprova più tardi.',forbidden:'Questa operazione non è disponibile per il tuo account.',invalid:'Controlla i dati. L’invito potrebbe essere scaduto, già usato o destinato a un’altra persona.'}[e.code]||'Operazione non completata. Riprova tra poco.');
 const signed=()=>['ready','empty','choosing'].includes(auth.getState().phase);
 function clear(){currentContext='';user=null;state=null;loading=false;error='';choice='';busy=false;invite=null;preview=null;generation++;}
 async function load(){if(!signed()||loading)return;const version=++generation;loading=true;error='';render();
  try{const result=await service.getOnboarding();if(version===generation)state=result;}
  catch(e){if(version===generation)error=message(e);}
  finally{if(version===generation){loading=false;render();}}
 }
 function sync(){const a=auth.getState();if(!a.user){if(user)clear();return;}
  const context=a.selected?.context_type+':'+a.selected?.context_id;
  if(user!==a.user.id){clear();user=a.user.id;currentContext=context;void load();}
  else if(currentContext!==context){currentContext=context;generation++;loading=false;invite=null;preview=null;if(!state)void load();}
 }
 const mustSetup=()=>signed()&&(!state||(!state.personal&&auth.getState().contexts.length===0)||(state.personal&&!state.personal.configured&&auth.getState().selected?.context_type==='personal'));
 function content(){
  if(loading||!state&&!error)return '<h2 id="auth-title">Caricamento del profilo</h2><p role="status">Verifica dei dati…</p>';
  if(error&&!state)return '<h2 id="auth-title">Non riusciamo a caricare il profilo</h2><p role="alert">'+esc(error)+'</p>'+button('s11-retry','Riprova');
  if(state?.personal&&!state.personal.configured)return '<h2 id="auth-title">Dati della tua attività</h2><p>Indica attività e anno da gestire. I dati fiscali si completano in seguito.</p><p class="small muted">Il tuo riferimento: '+esc(state.personal.talId)+'</p><form id="onboarding-form"><div class="field"><label for="start-date">Data di inizio attività</label><input type="date" id="start-date" name="start" max="'+new Date().toISOString().slice(0,10)+'" required></div><div class="field"><label for="onboarding-year">Anno da gestire</label><input id="onboarding-year" name="year" type="number" min="2000" max="'+(new Date().getFullYear()+1)+'" value="'+new Date().getFullYear()+'" required></div><div class="field"><label for="ateco-codes">Codici ATECO delle tue attività</label><input id="ateco-codes" name="codes" placeholder="Es. 62.10.00" aria-describedby="ateco-help" required><small id="ateco-help">Li trovi nei dati della partita IVA. Se sono più di uno, separali con una virgola.</small></div><p id="s11-error" class="error" role="alert" tabindex="-1"></p><button class="button" type="submit">Salva e continua</button></form>';
  const pending=state?.studios.find(s=>s.status!=='verified');
  if(pending)return '<h2 id="auth-title">'+esc(pending.name)+'</h2><p>Studio creato · da verificare</p><p>La verifica da parte di TAL è necessaria per collegare i clienti.</p>'+button('s11-retry','Controlla lo stato')+'<p class="small muted">Nessun cliente collegato.</p>';
  if(choice==='studio')return '<h2 id="auth-title">Come si chiama il tuo Studio?</h2><form id="studio-form"><div class="field"><label for="studio-name">Denominazione</label><input id="studio-name" name="name" minlength="2" maxlength="160" required autocomplete="organization"></div><p id="s11-error" class="error" role="alert" tabindex="-1"></p><button class="button" type="submit">Crea il tuo Studio</button></form><button class="text-link" data-action="s11-back" type="button">Indietro</button>';
  return '<h2 id="auth-title">Come vuoi usare TAL?</h2><div class="auth-choices"><button class="auth-choice" type="button" data-action="s11-personal"><span><strong>Sono un forfettario</strong><small>Gestisci entrate, tasse e documenti.</small></span></button><button class="auth-choice" type="button" data-action="s11-studio"><span><strong>Sono un commercialista</strong><small>Gestisci le posizioni dei tuoi clienti.</small></span></button></div><p class="error" role="alert">'+esc(error)+'</p><p>Hai già usato TAL? <button class="text-link" type="button" data-action="s13-import-personal">Importa i tuoi dati</button></p>';
 }
 async function act(name,element){
  if(!name.startsWith('s11-'))return false;
  if(name==='s11-back'){choice='';render();return true;}
  if(name==='s11-studio'){choice='studio';render();return true;}
  if(name==='s11-retry'){await auth.revalidate();await load();return true;}
  if(busy)return true;
  if(name==='s11-personal'){busy=true;const v=generation;
   try{await service.provisionPersonal();if(v!==generation)return true;await auth.revalidate();await load();}
   catch(e){error=message(e);render();}finally{busy=false;}return true;
  }
  if(name==='s11-links'){
   const a=auth.getState(),v=generation;openPanel('Collegamenti','<p role="status">Caricamento dei collegamenti…</p>');
   try{const links=await service.listLinks();if(v!==generation)return true;
    const personal=a.selected.context_type==='personal';
    openPanel(personal?'Il tuo commercialista':'Collegamenti clienti',
     links.filter(l=>l.status==='active').map(l=>'<article class="row"><div class="row-main"><h3>'+esc(personal?l.studioName:(positions().find(p=>p.id===l.workspaceId)?.label||'Cliente')+' · '+(positions().find(p=>p.id===l.workspaceId)?.talId||''))+'</h3><p>Collegamento attivo</p></div>'+ (l.canRevoke?button('s11-revoke','Interrompi collegamento','data-link="'+esc(l.id)+'" data-revision="'+esc(l.revision)+'"'):'')+'</article>').join('')+
     links.filter(l=>l.canCancel).map(l=>'<article class="row"><div class="row-main"><h3>Invito inviato</h3><p>In attesa di accettazione</p></div>'+button('s11-cancel','Annulla invito','data-link="'+esc(l.id)+'" data-revision="'+esc(l.revision)+'"','button secondary')+'</article>').join('')+
     (personal&&links.some(l=>l.status==='active')?'<p>Per cambiare Studio, interrompi prima il collegamento attuale.</p>':'<p>Condividi un invito con una persona che abbia già configurato il proprio profilo TAL. Sarà lei ad accettare.</p><form id="invite-form"><div class="field"><label for="recipient-email">'+(personal?'Email del titolare dello Studio':'Email del cliente')+'</label><input id="recipient-email" name="email" type="email" autocomplete="off" required></div><p id="s11-error" class="error" role="alert" tabindex="-1"></p><button class="button" type="submit">'+(personal?'Richiedi collegamento':'Crea invito')+'</button></form><hr><form id="accept-code-form"><div class="field"><label for="invite-code">Hai ricevuto un codice invito?</label><textarea id="invite-code" name="code" rows="3" autocomplete="off" spellcheck="false" required></textarea></div><p class="error" id="invite-error" role="alert" tabindex="-1"></p><button type="submit" class="button secondary">Apri invito</button></form>'));
   }catch(e){if(v!==generation)return true;openPanel('Collegamenti','<p role="alert">'+esc(message(e))+'</p>'+button('s11-links','Riprova'));}return true;
  }
  if(name==='s11-copy'){if(!invite){notify('Riapri il collegamento per controllare l’invito.');return true;}try{await navigator.clipboard.writeText(invite);notify('Codice copiato. Condividilo soltanto con il destinatario.');}catch{notify('Seleziona e copia il codice.');}return true;}
  if(name==='s11-revoke'){
   openPanel('Interrompere il collegamento?','<p>Lo Studio non potrà più accedere alla posizione. I dati della posizione rimarranno su TAL.</p>'+button('s11-revoke-confirm','Interrompi collegamento','data-link="'+esc(element.dataset.link)+'" data-revision="'+esc(element.dataset.revision)+'"'));
   return true;
  }
  if(['s11-revoke-confirm','s11-accept','s11-cancel','s11-reject'].includes(name)){
   busy=true;const v=generation;
   try{
    let job=jobs.get(element);if(!job){job={key:crypto.randomUUID(),link:{id:element.dataset.link,revision:Number(element.dataset.revision)}};jobs.set(element,job);}
    if(name==='s11-accept')await service.acceptInvite(preview.code,preview.data,job.key);
    else if(name==='s11-cancel')await service.endInvite(job.link,'cancel',job.key);
    else if(name==='s11-reject')await service.endInvite({id:preview.data.linkId,revision:preview.data.revision},'reject',job.key,preview.code);
    else await service.revokeLink(job.link,job.key);
    if(v!==generation)return true;
    invite=null;preview=null;await refresh();openPanel('Collegamento aggiornato','<p>'+ (name==='s11-accept'?'Il collegamento è attivo. La posizione è condivisa.':name==='s11-cancel'?'Invito annullato.':name==='s11-reject'?'Invito rifiutato.':'Il collegamento è stato interrotto.')+'</p>');
   }catch(e){notify(message(e));}finally{busy=false;}return true;
  }
  return true;
 }
 async function submit(form){
  if(!['studio-form','onboarding-form','invite-form','accept-code-form'].includes(form.id))return false;
  if(busy||form.dataset.busy==='true')return true;
  const version=generation;busy=true;form.dataset.busy='true';
  const controls=[...form.querySelectorAll('input,textarea,button')],err=form.querySelector('[role="alert"]');
  err.textContent='';controls.forEach(c=>c.disabled=true);
  try{
   let job=jobs.get(form);
   if(!job){const fields=new FormData();for(const el of form.elements)if(el.name)fields.set(el.name,el.value);job={key:crypto.randomUUID(),values:Object.fromEntries(fields)};jobs.set(form,job);}
   if(form.id==='studio-form'){await service.provisionStudio(job.values.name);await load();await auth.revalidate();}
   if(form.id==='onboarding-form'){
    const codes=job.values.codes.split(/[,;\s]+/).filter(Boolean),year=Number(job.values.year);
    if(!codes.length||codes.length>20||new Set(codes).size!==codes.length||codes.some(c=>!/^\d{2}\.\d{2}\.\d{2}$/.test(c)))throw Object.assign(Error(),{code:'invalid'});
    for(const code of codes){const result=await service.resolveActivity(year,code);if(!activityCanBeSaved(result))throw Object.assign(Error(),{code:'invalid'});}
    job.payload??={p_start_date:job.values.start,p_year:year,p_ateco_codes:codes,p_expected_revision:state.personal.revision,p_idempotency_key:job.key};
    await service.saveOnboarding(job.payload);if(version!==generation)return true;await load();await auth.revalidate();await refresh();
   }
   if(form.id==='invite-form'){
    job.token??=newInviteToken();
    const out=await service.createInvite({p_recipient_email:job.values.email,p_idempotency_key:job.key,p_token:job.token});
    if(out.status!=='pending')throw Object.assign(Error(),{code:out.status==='limited'?'limited':'invalid'});
    if(version!==generation)return true;invite=inviteCode(out.linkId,job.token);
    openPanel('Invito pronto','<p>Condividi questo codice soltanto con il destinatario. Il destinatario potrà usarlo se il suo profilo TAL è idoneo. Scade tra 72 ore. Nessun accesso è concesso prima dell’accettazione.</p><label for="share-code">Codice invito</label><textarea id="share-code" readonly rows="4" spellcheck="false">'+esc(invite)+'</textarea>'+button('s11-copy','Copia codice'));
   }
   if(form.id==='accept-code-form'){
    const data=await service.previewInvite(job.values.code);if(version!==generation)return true;preview={code:job.values.code,data};
    openPanel('Accetta il collegamento','<p><strong>'+esc(data.studioName)+'</strong></p><p>'+(data.direction==='studio_to_client'?'Lo Studio vuole collegarsi alla tua posizione. Potrà vedere i dati condivisi per gestirla.':esc(data.workspaceLabel)+' · '+esc(data.talId||'Riferimento non assegnato')+' chiede di collegarsi al tuo Studio.')+'</p><p>Puoi interrompere il collegamento in seguito.</p>'+button('s11-accept','Accetta')+button('s11-reject','Rifiuta','','button secondary'));
   }
  }catch(e){if(version===generation&&form.isConnected){err.textContent=message(e);err.focus();if(!['uncertain','stale'].includes(e.code))jobs.delete(form);}}
  finally{busy=false;form.dataset.busy='false';controls.forEach(c=>c.disabled=false);}
  return true;
 }
 return {dismiss:()=>{invite=null;preview=null;generation++;loading=false;},isLoading:()=>loading,sync,load,clear,content,act,submit,mustSetup,getState:()=>state};
}

