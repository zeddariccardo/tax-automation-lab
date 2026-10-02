// Explicit local visual session. No tokens, login, network or cloud writes.
// Only gallery-server substitutes this module; the production app never imports it.
import {fixtures} from './states.mjs';
const {personal,studio}=fixtures;
const state={phase:'ready',message:'',user:{id:'synthetic-user',email:'visual-only@tal.test'},selected:personal,contexts:[personal,studio]};
const listeners=new Set(),emit=()=>{for(const fn of listeners)fn(structuredClone(state));};
export const auth={getState:()=>structuredClone(state),subscribe(fn){listeners.add(fn);fn(structuredClone(state));return()=>listeners.delete(fn);},restore:async()=>{},revalidate:async()=>{},chooseAgain:async()=>{state.phase='choosing';state.selected=null;emit();},choose:async c=>{state.phase='ready';state.selected=c;emit();},logout:async()=>{state.phase='signed-out';state.selected=null;emit();}};
const position={id:personal.context_id,label:'Cliente sintetico S16',talId:'TAL-TEST0001',years:[{year:2025},{year:2026}],activities:[{id:'synthetic-activity',atecoCode:'62.10.00',label:'Attività sintetica'}],startDate:'2020-01-01'};
const data={phase:'ready',data:{positions:[position],studio:{name:'Studio di prova'}}};
export const cloud={getState:()=>structuredClone(data),subscribe(fn){fn(structuredClone(data));return()=>{};},refresh:async()=>{}};
const invoices=[{id:'synthetic-invoice',number:'18/2025',customer:'Cliente di esempio',date:'2025-10-01',total:120000,paid:80000,residual:40000,simple:true,payments:[{date:'2025-10-10',cash:80000}]},{id:'synthetic-paid',number:'17/2025',customer:'Cliente di esempio',date:'2025-09-01',total:160000,paid:160000,residual:0,simple:true,payments:[{date:'2025-09-10',cash:160000}]}];
const payments=structuredClone(fixtures.payment);
payments.draft.groups=[{key:'2026-11-30',status:'READY',dueDate:'2026-11-30',totalCents:60000,lines:[{taxCode:'1791',section:'ERARIO',obligationType:'advance',referenceTaxYear:2026,amountCents:60000}]}];
payments.draft.taxpayer={name:'SYNTHETIC TEST DATA',cf:'RSSMRA80A01H501U'};
payments.reviewFacts={amounts:{},method:'historical'};
const readonly=async()=>{throw {code:'unavailable'};};
export const service={
 getOnboarding:async()=>({personal:{configured:true,talId:position.talId},studios:[{status:'verified',name:'Studio di prova'}]}),
 listLinks:async()=>[{id:'synthetic-link',status:'active',workspaceId:position.id,studioName:'Studio di prova',canRevoke:false}],
 readWorkflow:async workspaceId=>({workspaceId,dataRevision:1,linkedStudio:false,canConfirm:true,pensionObligations:[],counts:{invoices:2,payments:2,documents:1,contributions:0},declaration:{current:true,workflow:{state:'confirm'}},reviewStale:true,paymentReviewStale:true,pensionMissing:true,payments:{id:payments.id,result:structuredClone(payments.draft)}}),
 listInvoices:async()=>({year:2025,invoices:structuredClone(invoices),activities:position.activities,received:240000,outstanding:40000}),
 readInvoice:async(_w,id)=>structuredClone(invoices.find(i=>i.id===id)),
 calculateFiscal:async()=>({...structuredClone(fixtures.fiscal),workspaceId:position.id}),
 readDeclaration:async()=>({...structuredClone(fixtures.declaration),draft:{...structuredClone(fixtures.declaration.draft),workspaceId:position.id,taxYear:2025}}),
 readPayments:async()=>({...structuredClone(payments),draft:{...structuredClone(payments.draft),workspaceId:position.id,taxYear:2025}}),
 listCollaborationQueue:async ids=>ids.map(workspaceId=>({...structuredClone(fixtures.data),workspaceId})),
 listCollaboration:async()=>structuredClone(fixtures.data),
 downloadDocument:readonly,postActivity:readonly,createInvoice:readonly,recordPayment:readonly,recordPension:readonly,reviewDeclaration:readonly,reviewPayments:readonly,actF24:readonly,
};
