const request=item=>['request_upload','request_confirm'].includes(item.kind);
const actionLabel=item=>item.fact_target?.kind==='f24'?'Riconcilia quietanza':item.fact_target?.kind==='pension'?'Registra contributi':'Verifica documento';
export const currentContext=access=>access.selected.context_type+':'+access.selected.context_id;
export function collaborationView({r,state,access,positions,heading,link,href,button,esc,icon,mode='activity',connection=''}){
 const ctx=currentContext(access),data=state.data?.find(x=>x.workspaceId===r.id);
 const error=()=>'<p role="'+(state.phase==='loading'?'status':'alert')+'">'+(state.phase==='loading'?'Caricamento delle attività…':state.phase==='forbidden'?'Il tuo accesso alla posizione è cambiato.':'Non riusciamo a caricare le attività.')+'</p>'+(state.phase==='loading'?'':button('collaboration-retry','Riprova'));
 const label=item=>item.actor_context.startsWith('studio:')?(item.actor_context===ctx?'Il tuo Studio':'Lo Studio'):item.actor_context===ctx?'Tu':'Il cliente';
 const date=value=>new Intl.DateTimeFormat('it-IT',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}).format(new Date(value));
 function card(item,d,compact=false){
  const doc=d.documents.find(x=>x.id===item.document_id),mine=item.actor_context===ctx,recipient=item.recipient_context===ctx;
  let action='',status='';
  if(request(item)){
   status=item.status==='completed'?'Completata':item.status==='submitted'?(mine?'Da verificare':item.actor_context.startsWith('studio:')?'Inviato · in attesa dello Studio':'Inviato · in attesa del cliente'):recipient?'Da fare':item.recipient_context.startsWith('personal:')?'In attesa del cliente':'In attesa dello Studio';
   if(item.status==='todo'&&recipient)action=button(item.kind==='request_upload'?'upload-request':'confirm-request',item.kind==='request_upload'?'Carica documento':'Conferma il dato',`data-request="${item.id}"`);
   else if(item.status==='submitted'&&mine)action=button(doc?'review':'complete-request',doc?actionLabel(item):'Completa richiesta',`data-request="${item.id}"`);
  }
  const file=doc&&!(item.status==='submitted'&&mine)&&!(item.kind==='event'&&d.activities.some(a=>request(a)&&a.document_id===doc.id))?'<button class="text-link contextual-document" type="button" data-action="document" data-document="'+doc.id+'">'+icon('file')+esc(doc.original_filename)+'</button>':'';
  return '<article class="feed-item collaboration-item" id="activity-'+item.id+'"><div class="feed-meta"><strong>'+esc(label(item))+'</strong><time>'+date(item.created_at)+'</time></div><p class="message">'+esc(item.body)+'</p>'+ (status?'<p class="state-line">'+esc(status)+'</p>':'')+file+(action?'<div class="actions">'+action+'</div>':'')+'</article>';
 }
 if(mode==='queue'){
  if(!positions.length)return heading('Da fare')+'<p class="empty">Nessun cliente collegato.</p>';
  if(state.phase!=='ready')return heading('Da fare')+error();
  const list=state.data.flatMap(d=>d.activities.filter(x=>request(x)&&x.status!=='completed'&&(x.actor_context===ctx||x.recipient_context===ctx)).map(x=>({item:x,data:d})));
  const actionable=({item:x})=>x.status==='submitted'&&x.actor_context===ctx||x.status==='todo'&&x.recipient_context===ctx;
  const section=(title,items)=>items.length?'<section class="waiting-list '+(title==='Da controllare'?'actionable-list':'')+'"><h2>'+title+'</h2>'+items.map(({item:x,data:d})=>'<article class="waiting-row"><div class="row-main"><strong>'+esc(positions.find(p=>p.id===d.workspaceId)?.label||'Cliente')+'</strong><p>'+esc(x.body)+'</p></div>'+link('#/studio/clienti/'+d.workspaceId+'/attivita',x.status==='submitted'?actionLabel(x):'Apri attività','text-link',false,'data-request="'+x.id+'" data-open="'+(x.status==='submitted'&&x.document_id?'review':'')+'" data-focus="activity-'+x.id+'"')+'</article>').join('')+'</section>':'';
  return heading('Da fare')+(list.length?section('Da controllare',list.filter(actionable))+section('In attesa',list.filter(x=>!actionable(x))):'<p class="empty">Nessuna richiesta documentale aperta.</p>');
 }
 if(mode==='today'){
  if(!data)return '<section class="today-activity"><h2>Attività</h2>'+error()+'</section>';
  const todo=data.activities.filter(x=>request(x)&&(x.status==='todo'&&x.recipient_context===ctx||x.status==='submitted'&&x.actor_context===ctx));
  const submitted=data.activities.filter(x=>request(x)&&x.status==='submitted'&&x.recipient_context===ctx);
  return '<section class="today-activity"><div class="section-line"><h2>'+ (todo.length?'Da fare':'Attività')+'</h2>'+link(href(r,'attivita'),'Vedi attività','text-link',false)+'</div>'+(todo.length?todo.map(x=>card(x,data,true)).join(''):submitted.length?'<p class="muted">Richieste inviate · in attesa di verifica</p>':'<p class="muted">Non hai richieste a cui rispondere.</p>')+'</section>';
 }
 if(mode==='documents'){
  const head=link(href(r,'attivita'),icon('back')+'Torna ad Attività','text-link archive-back',false)+heading('Archivio documenti','',button('upload-other','Aggiungi un altro documento'));
  if(!data)return head+error();
  return head+(data.documents.length?'<div class="list document-list">'+data.documents.map(d=>{const used=data.activities.some(a=>a.document_id===d.id&&a.status==='completed');return '<article class="row"><span class="doc-icon">'+icon('file')+'</span><div class="row-main"><h2>'+esc(d.original_filename)+'</h2><p>'+date(d.ready_at)+' · '+(used?'Utilizzato in una richiesta completata':'Condiviso')+'</p></div>'+button('document','Scarica documento',`data-document="${d.id}"`,'button secondary')+'</article>';}).join('')+'</div>':'<p class="empty">Nessun documento caricato.</p>');
 }
 const header=heading('Attività','',connection+link(href(r,'documenti'),'Archivio documenti','text-link',false));
 if(!data)return header+error();
 const linked=r.role==='studio'||data.links.length>0;
 return header+(linked?'<div class="section-line"><span class="small muted">'+(r.role==='studio'?'Richieste al cliente':'Richieste allo Studio')+'</span>'+button('new-request','Richiedi documento')+'</div>':'<p class="muted">Non hai uno Studio collegato.</p>')+'<div class="feed">'+(data.activities.length?data.activities.map(x=>card(x,data)).join(''):'<p class="empty">Qui trovi richieste, risposte e documenti condivisi.</p>')+'</div>'+(linked?'<form class="composer" id="message-form"><label for="message">'+(r.role==='studio'?'Scrivi al cliente':'Scrivi allo Studio')+'</label><textarea id="message" name="message" rows="3" maxlength="4000" required></textarea><p class="error" role="alert" tabindex="-1"></p><div class="actions"><button class="button" type="submit">Invia messaggio</button></div></form>':'');
}
