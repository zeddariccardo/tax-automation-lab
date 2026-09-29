// Synthetic presentation fixtures. No authentication, API, calculation or persistence.
import {authEntry} from '../../auth-view.js';
import {fiscalView} from '../../fiscal-view.js';
import {declarationView} from '../../declaration-view.js';
import {paymentsView} from '../../payments-view.js';
import {collaborationView} from '../../collaboration-view.js';
import {createOnboardingUI} from '../../onboarding-ui.js';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const button=(a,t,attrs='',cls='button')=>`<button type="button" class="${cls}" ${attrs}>${t}</button>`;
const heading=(t,s='',a='')=>`<div class="heading"><div><h1>${t}</h1>${s?`<p>${s}</p>`:''}</div><div class="actions">${a}</div></div>`;
const link=(h,t,cls='text-link')=>`<a href="#" class="${cls}">${t}</a>`;
const euro=c=>new Intl.NumberFormat('it-IT',{style:'currency',currency:'EUR'}).format(c/100);
const h={heading,button,link,href:()=> '#',esc,euro,icon:()=>'',brand:()=>'<strong class="brand">TAL</strong>'};
const personal={context_type:'personal',context_id:'synthetic-position',label:'La mia attività'};
const studio={context_type:'studio',context_id:'synthetic-studio',label:'Studio di prova'};
const access={phase:'ready',user:{id:'synthetic-user'},selected:personal,contexts:[personal,studio]};
const fiscal={year:2025,missing:['paid-contributions'],pensionState:'unknown',pensionPayments:[],paidContributionCents:null,receivedCents:1200000,reserveInputsComplete:false,forecastAvailable:false,worker:{status:'blocked',result:{income:{status:'ok',value:{grossIncomeCents:936000}},pensionObligations:[{label:'Gestione da verificare',state:'PARTIAL'}]}}};
const declaration={revision:1,createdAt:'2026-09-29T10:00:00Z',draft:{summary:{receivedCents:1200000,grossIncomeCents:936000,taxCents:null,paidCents:null,deductedCents:null},fields:[{id:'LM35.1',label:'Contributi previdenziali',value:null,modelValue:null,unit:'cents',state:'missing',reason:'Contributi versati da indicare.',provenance:{fact:'Versamenti registrati',refs:[]},authority:{source:'Istruzioni Redditi PF',page:46}}],issues:[{message:'Contributi previdenziali da verificare.'}],activities:[],pensions:[],counts:{complete:2,confirm:1}}};
const payment={draft:{groups:[],diagnostics:[{message:'Acconti versati da verificare.'}],blocked:[{managementId:'Gestione previdenziale',message:'Importo non determinabile dai dati disponibili.'}],settlement:{completeness:'PARTIAL',grossLiabilityCents:100000,priorPaymentsCents:null,balanceDueCents:null},credit:{availableCents:null},declarationRevision:1}};
const request={id:'synthetic-request',kind:'request_upload',actor_context:'studio:synthetic-studio',recipient_context:'personal:synthetic-position',body:'Carica la ricevuta dei contributi versati.',created_at:'2026-09-29T10:00:00Z',status:'submitted',document_id:'synthetic-document'};
const document={id:'synthetic-document',original_filename:'ricevuta-contributi-synthetic.pdf',ready_at:request.created_at};
const data={workspaceId:personal.context_id,activities:[request],documents:[document],links:[{studio_id:studio.context_id}]};
export const names=['Accesso','Registrazione','Conferma email','Accesso in corso','Errore accesso','Scelta profilo','Onboarding attività','Nuovo Studio','Studio da verificare','Tasse parziali','Previsione assente','Calcolo in corso','Errore calcolo','Bozza parziale','Bozza non aggiornata','Pagamenti bloccati','Pagamenti scaricati','Pagamenti non disponibili','Richiesta inviata','Archivio','Attività vuote','Coda Studio'];
export const fixtures={personal,studio,fiscal,declaration,payment,data};
export async function renderState(name){
 let content;
 if(names.indexOf(name)<6){
  const phases={'Conferma email':'check-email','Accesso in corso':'loading','Errore accesso':'error','Scelta profilo':'choosing'};
  content=authEntry({...h,loginEmail:'',signup:name==='Registrazione',access:{...access,phase:phases[name]||'signed-out',message:name==='Conferma email'?'Conferma l’indirizzo email. Poi torna qui e accedi.':name==='Errore accesso'?'Accesso non disponibile. Controlla la connessione e riprova.':''}});
 }else if(['Onboarding attività','Nuovo Studio','Studio da verificare'].includes(name)){
  const state={personal:name==='Onboarding attività'?{configured:false,talId:'TAL-TEST0001'}:null,studios:name==='Studio da verificare'?[{status:'pending',name:'Studio di prova'}]:[]};
  const ui=createOnboardingUI({...h,auth:{getState:()=>access},service:{getOnboarding:async()=>state},render:()=>{}});
  await ui.load();if(name==='Nuovo Studio')await ui.act('s11-studio');
  content=authEntry({...h,loginEmail:'',access,setup:ui.content()});
 }else if(['Tasse parziali','Previsione assente','Calcolo in corso','Errore calcolo'].includes(name)){
  const phase=name==='Calcolo in corso'?'loading':name==='Errore calcolo'?'error':'ready';
  content=fiscalView({...h,r:{page:'tasse'},mode:name==='Previsione assente'?'forecast':'current',state:{phase,error:'stale',data:fiscal}});
 }else if(name.startsWith('Bozza'))content=declarationView({...h,studio:true,state:{phase:name==='Bozza parziale'?'ready':'error',error:'conflict',data:declaration}});
 else if(name.startsWith('Pagamenti')){
  const d=structuredClone(payment);if(name==='Pagamenti scaricati')d.draft.groups=[{key:'synthetic',status:'DOWNLOADED',dueDate:'2026-11-30',totalCents:60000,lines:[{obligationType:'advance',referenceTaxYear:2026}]}];
  content=paymentsView({...h,studio:true,base:'#',state:{phase:name==='Pagamenti non disponibili'?'forbidden':'ready',data:d}});
 }else{
  const d=structuredClone(data);if(name==='Attività vuote')d.activities=[];
  content=collaborationView({...h,r:{id:personal.context_id,role:name==='Coda Studio'?'studio':'personal'},state:{phase:'ready',data:[d]},access:name==='Coda Studio'?{...access,selected:studio}:access,positions:[{id:personal.context_id,label:'Cliente sintetico'}],mode:name==='Archivio'?'documents':name==='Coda Studio'?'queue':'activity'});
 }
 return names.indexOf(name)<9?content:`<main class="page" id="main" tabindex="-1">${content}</main>`;
}
