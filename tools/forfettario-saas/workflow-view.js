// Presentation selectors only: never calculate taxes or infer missing fiscal facts.
export const managementLabel=id=>({INPS_GS:'Gestione Separata',INPS_ARTIGIANI:'Artigiani',INPS_COMMERCIANTI:'Commercianti',ENASARCO:'Enasarco'}[id]||'Gestione previdenziale');
export const humanDiagnostic=text=>String(text).replace(/INPS_GS/g,'Gestione Separata').replace(/INPS_ARTIGIANI/g,'Artigiani').replace(/INPS_COMMERCIANTI/g,'Commercianti');
// One receipt may contain multiple lines. Display the documented event once,
// independently from the current draft (which contains only amounts still due).
export function confirmationLabel(confirmation,verifications=[]){
 if(confirmation?.evidenceStatus==='needs_review')return 'Evidenza da verificare · associazioni in conflitto';
 if(confirmation?.state==='studio_verified')return 'Verificato dallo Studio';
 const origin=confirmation?.state==='evidence_backed'?'Dichiarato dal titolare · evidenza allegata':confirmation?.state==='self_declared'?'Dichiarato dal titolare':'Origine da verificare';
 return origin+(verifications.some(v=>v.state==='studio_verified')?' · verificato dallo Studio':'');
}
export function paymentRecords(draft){
 const records=new Map();
 for(const p of draft?.paymentReconciliation?.payments||[]){
  if(!p.eventId||p.eventId.startsWith('pension:'))continue;
  if(!Number.isSafeInteger(p.amountCents)||p.amountCents<=0)throw Error('Invalid payment record');
  const r=records.get(p.eventId)||{id:p.eventId,paidDate:p.paidDate,amountCents:0,documentId:p.documentId,...(p.confirmation?{confirmation:p.confirmation,verifications:p.verifications||[]}:{})};
  r.amountCents+=p.amountCents;if(!Number.isSafeInteger(r.amountCents))throw Error('Invalid payment total');
  records.set(p.eventId,r);
 }
 return [...records.values()].sort((a,b)=>b.paidDate.localeCompare(a.paidDate));
}
export const localDay=(now=new Date())=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Rome',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
export const overdue=(g,day=localDay())=>!!g.dueDate&&g.dueDate<day&&g.status!=='PAID'&&g.totalCents>0;
export function nextPayment(data){
 return [...(data?.result?.groups||data?.draft?.groups||[])].filter(g=>g.status!=='PAID'&&Number.isSafeInteger(g.totalCents)&&g.totalCents>0).sort((a,b)=>(a.dueDate||'9999').localeCompare(b.dueDate||'9999'))[0]||null;
}
export function workflowActions(w){
 if(!w)return[];const out=[];
 if(w.reviewStale)out.push({page:'dichiarazione',label:'Riconferma la dichiarazione',detail:'I dati sono cambiati dopo la verifica.'});
 else if(!w.declaration||!w.declaration.current||w.declaration.workflow?.state!=='prepared')out.push({page:'dichiarazione',label:'Completa la dichiarazione',detail:'Controlla i dati preparati e le conferme mancanti.'});
 const groups=w.payments?.result?.groups||[];
 if(w.paymentReviewStale||groups.some(g=>g.status==='STALE'))out.push({page:'pagamenti',label:'Riconferma i pagamenti',detail:'Rivedi i valori della precedente verifica.'});
 else if(!w.payments||groups.some(g=>['DRAFT','BLOCKED'].includes(g.status)))out.push({page:'pagamenti',label:'Controlla gli F24',detail:'Verifica versamenti, crediti e importi predisposti.'});
 if(w.pensionMissing||(w.declaration?.workflow?.blockers||[]).some(i=>/^PENSION_|^RR_/.test(i.code)))out.push({page:'tasse',label:'Completa i dati previdenziali',detail:'Versamenti o gestione da verificare.'});
 return out;
}
// Display only: ISO due dates become a readable Italian date; anything else is shown as received.
export const dueLabel=value=>/^\d{4}-\d{2}-\d{2}$/.test(value||'')?new Intl.DateTimeFormat('it-IT',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(value+'T00:00:00Z')):value||'Data da verificare';
export function nextPaymentView(w,{href,esc,euro}){
 const g=nextPayment(w?.payments);
 const pending=g&&['STALE','BLOCKED','DRAFT'].includes(g.status);
 return '<section class="payment-detail"><h2>Prossimo pagamento</h2>'+(g?'<p class="state-line status-badge tone-'+(pending?'warn':overdue(g)?'error':'info')+'">'+(pending?'Da verificare':overdue(g)?'Scadenza superata':'F24 predisposto')+'</p>'+(pending?'<p>Controlla i dati aggiornati prima del versamento.</p>':'<p class="due-date">'+esc(dueLabel(g.dueDate))+'</p><strong class="amount money">'+euro(g.totalCents)+'</strong>'):'<p>Nessun F24 da pagare disponibile.</p>')+'<p><a class="text-link" href="'+esc(href)+'">Apri Pagamenti</a></p></section>';
}
export function clientWorkflow(w,{heading,label,base,esc,link}){
 if(!w)return heading('Riepilogo',esc(label))+'<p role="status">Caricamento della posizione…</p>';
 const c=w.counts,d=w.declaration,groups=w.payments?.result?.groups||[],next=nextPayment(w.payments);
 const ds=w.reviewStale?'Da riconfermare':!d?.current?'Da aggiornare':d.workflow?.state==='prepared'?'Dati TAL preparati':d.workflow?.state==='blocked'?'Bloccata':(d.workflow?.actions?.length||1)+' conferme richieste';
 const dt=w.reviewStale||!d?.current?'warn':d.workflow?.state==='prepared'?'ok':d.workflow?.state==='blocked'?'error':'violet';
 return heading('Riepilogo',esc(label))+'<div class="workflow-chain"><section><h2>Dati raccolti</h2><p>'+esc(c.invoices)+' fatture · '+esc(c.payments)+' incassi · '+esc(c.documents)+' documenti · '+esc(c.contributions)+' versamenti contributivi</p>'+link(base+'entrate','Apri Entrate')+' · '+link(base+'tasse','Tasse e contributi')+'</section><section><h2>Dichiarazione</h2><p class="status-badge tone-'+dt+'">'+ds+'</p>'+link(base+'dichiarazione','Apri Dichiarazione')+'</section><section><h2>Pagamenti</h2><p>'+groups.filter(g=>g.status==='READY'||g.status==='DOWNLOADED').length+' F24 pronti · '+groups.filter(g=>['DRAFT','STALE','BLOCKED'].includes(g.status)).length+' da controllare · '+paymentRecords(w.payments?.result).length+' pagamenti registrati</p>'+(next?'<p class="status-badge tone-'+(overdue(next)?'error':'info')+'">'+(overdue(next)?'Scadenza superata':'Prossimo pagamento')+' · '+esc(dueLabel(next.dueDate))+'</p>':'')+link(base+'pagamenti','Apri Pagamenti')+'</section></div>';
}
