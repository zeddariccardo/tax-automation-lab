// Auth owns credentials/rotation. Reads use user RLS; financial writes only frozen RPCs.
import { cents, isoDate, projectIncome, incomeProblem } from './income-model.js';
import { createCollaborationService } from './collaboration-service.js';
import { createOnboardingService } from './onboarding-service.js';
import { createImportService } from './import-service.js';
import { createDeclarationService } from './declaration-service.js';
import { createPaymentsService } from './payments-service.js';
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const problem = code => Object.assign(new Error(code), { code });
const text = value => typeof value === 'string' && value.trim().length <= 300 ? value.trim() || null : null;
const date = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value ? value : null;
const columns = {
  legacy_binding: 'id,workspace_id,source_scope,kind,legacy_id,target_id,ordinal,content_hash',
  tax_workspace: 'id,tal_id,label:identity->>label,start_date:identity->>startDate,status',
  tax_year: 'id,workspace_id,year',
  economic_activity: 'id,workspace_id,ateco_code:facts->>atecoCode',
  studio: 'id,name,status',
  studio_client_link: 'id,workspace_id,studio_id,status',
  studio_client_private: 'id,workspace_id,studio_id,link_id,reference:facts->alias->>clientCode',
  invoice: 'id,workspace_id,revision,number:facts->>number,customer:facts->>customer,issue_date:facts->>issueDate,currency:facts->>currency',
  invoice_component: 'id,workspace_id,invoice_id,activity_id,amount_cents,kind:facts->>kind',
  payment: 'id,workspace_id,invoice_id,amount_cents,cash_received_cents,withholding_cents,cash_date:facts->>cashDate,currency:facts->>currency',
  allocation: 'id,workspace_id,invoice_id,payment_id,component_id,amount_cents',
  credit_note: 'id,workspace_id,invoice_id,revision,issue_date:facts->>issueDate',
  credit_note_line: 'id,workspace_id,invoice_id,credit_note_id,component_id,amount_cents',
  refund: 'id,workspace_id,invoice_id,amount_cents,cash_date:facts->>cashDate',
};
export function createTalDataService({ auth, fetchImpl }) {
  const pending = new Map();
  async function rows(session, table, filters = {}, select = columns[table]) {
    if (!Object.hasOwn(columns, table)) throw problem('forbidden');
    const out = [];
    for (let offset = 0; ; ) {
      const query = new URLSearchParams({ select, ...filters, order: 'id.asc', limit: '200', offset: String(offset) });
      let response;
      try {
        response = await fetchImpl(session.config.supabaseUrl + '/rest/v1/' + table + '?' + query, {
          method: 'GET', credentials: 'omit', cache: 'no-store', redirect: 'error',
          headers: { apikey: session.config.publishableKey, Authorization: 'Bearer ' + session.token,
            'Accept-Profile': 'tal', 'x-tal-context': session.context.context_type + ':' + session.context.context_id, Prefer: 'count=exact' },
          signal: AbortSignal.timeout(15000),
        });
      } catch { throw problem('unavailable'); }
      if (!response.ok) {
        await response.body?.cancel();
        throw problem(response.status === 401 ? 'expired' : response.status === 403 ? 'forbidden' : response.status === 404 ? 'missing' : 'unavailable');
      }
      let page;
      try { page = await response.json(); } catch { throw problem('unavailable'); }
      const total = Number(response.headers.get('content-range')?.match(/\/(\d+)$/)?.[1]);
      if (!Array.isArray(page) || page.some(r => !uuid.test(r.id)) || !Number.isSafeInteger(total) || total < 0) throw problem('unavailable');
      out.push(...page); offset += page.length;
      if (offset >= total) break;
      if (!page.length || offset > 10000) throw problem('unavailable'); // no silent truncation
    }
    if (new Set(out.map(r => r.id)).size !== out.length) throw problem('unavailable');
    return out;
  }
  async function load(session, requestedId = null) {
    const c = session.context, personal = c.context_type === 'personal';
    if (!['personal', 'studio'].includes(c.context_type) || !uuid.test(c.context_id)) throw problem('forbidden');
    if (requestedId !== null && !uuid.test(requestedId)) throw problem('forbidden');
    const scope = personal ? { workspace_id: 'eq.' + c.context_id } : {};
    const [years, activities, links, aliases] = await Promise.all([
      rows(session, 'tax_year', scope), rows(session, 'economic_activity', scope),
      personal ? [] : rows(session, 'studio_client_link', { studio_id: 'eq.' + c.context_id, status: 'eq.active' }),
      personal ? [] : rows(session, 'studio_client_private', { studio_id: 'eq.' + c.context_id }),
    ]);
    // Read current access again after supporting rows; a revoked link cannot leave
    // a previously fetched alias/year displayed as an accessible client.
    const [workspaces, studios] = await Promise.all([
      rows(session, 'tax_workspace', { status: 'eq.active', ...(requestedId || personal ? { id: 'eq.' + (requestedId || c.context_id) } : {}) }),
      personal ? [] : rows(session, 'studio', { id: 'eq.' + c.context_id, status: 'eq.verified' }),
    ]);
    if (!personal && (studios.length !== 1 || studios[0].id !== c.context_id)) throw problem('forbidden');
    if (personal && (workspaces.length !== 1 || workspaces[0].id !== c.context_id)) throw problem('forbidden');
    const positions = workspaces.filter(w => personal || links.some(l => l.workspace_id === w.id && l.studio_id === c.context_id && l.status === 'active')).map(w => {
      const link = links.find(l => l.workspace_id === w.id);
      const alias = aliases.find(a => a.workspace_id === w.id && a.studio_id === c.context_id && a.link_id === link?.id);
      return { source: 'cloud', id: w.id, talId:/^TAL-[A-Z0-9]{8}$/.test(w.tal_id||'')?w.tal_id:null, label: text(w.label) || 'Posizione senza nome', startDate: date(w.start_date),
        studioReference: text(alias?.reference), // private import reference, NOT a global TAL ID
        years: years.filter(y => y.workspace_id === w.id).map(y => {
          if (!Number.isInteger(y.year) || y.year < 2000 || y.year > 2200) throw problem('unavailable');
          return { id: y.id, year: y.year };
        }).sort((a,b) => b.year - a.year),
        activities: activities.filter(a => a.workspace_id === w.id).map(a => ({ id: a.id, atecoCode: text(a.ateco_code) })),
      };
    });
    if (requestedId && !positions.some(p => p.id === requestedId)) throw problem('forbidden');
    return { source: 'cloud', context: { ...c }, studio: personal ? null : { id: studios[0].id, name: text(studios[0].name) || c.label }, positions };
  }
  async function income(session, id, year) {
    if (!uuid.test(id) || !Number.isInteger(year) || year<2000 || year>2200) throw problem('invalid');
    if (session.context.context_type === 'personal' && session.context.context_id !== id) throw problem('forbidden');
    async function workspace() {
      const list=await rows(session,'tax_workspace',{id:'eq.'+id,status:'eq.active'},'id,data_revision');
      if (list.length !== 1) throw problem('forbidden');
      cents(list[0].data_revision); return list[0];
    }
    for (let attempt=0;attempt<3;attempt++) {
      const before=await workspace(), scope={workspace_id:'eq.'+id};
      const [invoices,components,payments,allocations,activities,creditNotes,creditNoteLines,refunds]=await Promise.all(
        ['invoice','invoice_component','payment','allocation','economic_activity','credit_note','credit_note_line','refund'].map(t=>rows(session,t,scope)));
      const after=await workspace(); // current grant + consistent revision, after every supporting read
      if (before.data_revision === after.data_revision) return projectIncome({workspace:after,invoices,components,payments,allocations,activities,creditNotes,creditNoteLines,refunds},year);
    }
    throw problem('conflict');
  }
  async function command(name,id,key,payload) {
    if (!uuid.test(id) || !uuid.test(key)) throw problem('invalid');
    const actor=auth.getState().user?.id;
    if (!actor) throw problem('forbidden');
    // Freeze the exact payload before any asynchronous work. A retry must not
    // substitute newer revisions, allocation targets, or a different context.
    const frozen=JSON.stringify(payload);
    return auth.withContextSession(async session=>{
      const context=session.context.context_type+':'+session.context.context_id;
      const identity=actor+':'+context+':'+id+':'+name+':'+key;
      const active=pending.get(identity);
      if(active) { if(active.body!==frozen)throw problem('idempotency'); return active.promise; }
      const promise=(async()=>{
        let response;
        try { response=await fetchImpl(session.config.supabaseUrl+'/rest/v1/rpc/'+name,{
          method:'POST',credentials:'omit',cache:'no-store',redirect:'error',signal:AbortSignal.timeout(15000),
          headers:{apikey:session.config.publishableKey,Authorization:'Bearer '+session.token,'Content-Type':'application/json','Content-Profile':'public','x-tal-context':context},
          body:JSON.stringify({p_workspace_id:id,p_context:context,p_idempotency_key:key,p_payload:JSON.parse(frozen)}),
        }); } catch {throw problem('uncertain');}
        let body;try {body=await response.json();}catch {throw problem('uncertain');}
        if(!response.ok) {
          if(response.status===401)throw problem('expired');
          if(response.status===403||body?.code==='42501')throw problem('forbidden');
          if(response.status===409||body?.code==='PT409')throw problem('conflict');
          if(body?.message==='IDEMPOTENCY_CONFLICT')throw problem('idempotency');
          if(response.status>=500)throw problem('uncertain');
          throw problem('invalid');
        }
        if(!Number.isSafeInteger(body?.dataRevision) || (name!=='tal_record_pension_payment'&&!uuid.test(body?.invoiceId)) || (name==='tal_record_payment'&&!uuid.test(body?.paymentId)))throw problem('uncertain');
        return body;
      })();
      pending.set(identity,{body:frozen,promise});
      try{return await promise;}finally{pending.delete(identity);}
    });
  }
  return {
    ...createDeclarationService({auth,fetchImpl}),
    ...createPaymentsService({auth,fetchImpl}),
    ...createImportService({auth,fetchImpl,rows}),
    ...createOnboardingService({auth,fetchImpl}),
    ...createCollaborationService({auth,fetchImpl}),
    calculateFiscal: (id,year) => auth.withContextSession(async session=>{
      if(!uuid.test(id)||![2025,2026].includes(year))throw problem('invalid');
      let r;try{r=await fetchImpl(session.config.supabaseUrl+'/functions/v1/tal-calculate-fiscal',{
        method:'POST',credentials:'omit',cache:'no-store',redirect:'error',signal:AbortSignal.timeout(30000),
        headers:{apikey:session.config.publishableKey,Authorization:'Bearer '+session.token,'Content-Type':'application/json','x-tal-context':session.context.context_type+':'+session.context.context_id},
        body:JSON.stringify({workspaceId:id,year}),
      });}catch(e){throw problem('unavailable');}
      if(!r.ok){await r.body?.cancel();throw problem(r.status===401?'expired':r.status===404||r.status===403?'forbidden':r.status===409?'conflict':r.status===429?'limited':'unavailable');}
      let data;try{data=await r.json();}catch{throw problem('unavailable');}
      if(data?.workspaceId!==id||data.year!==year||!Number.isSafeInteger(data.dataRevision)||!Array.isArray(data.missing)||!Array.isArray(data.pensionPayments))throw problem('unavailable');
      return data;
    }),
    recordPensionMovement:(id,input,key)=>command('tal_record_pension_movement',id,key,input),
    recordPension: (id,input,key) => command('tal_record_pension_payment',id,key,input),
    loadContext: () => auth.withContextSession(session => load(session)),
    readPosition: id => auth.withContextSession(async session => (await load(session, id)).positions.find(p => p.id === id)),
    listInvoices: (id,year=new Date().getFullYear()) => auth.withContextSession(session=>income(session,id,year)),
    readInvoice: (id,invoiceId,year=new Date().getFullYear()) => auth.withContextSession(async session=>{
      const found=(await income(session,id,year)).invoices.find(i=>i.id===invoiceId);if(!found)throw problem('missing');return found;
    }),
    listPayments: (id,year=new Date().getFullYear()) => auth.withContextSession(async session=>(await income(session,id,year)).payments),
    createInvoice: (id,input,key) => {
      const number=text(input.number),customer=text(input.customer),amount=cents(input.amountCents);
      if(!number||!customer||!amount || (input.activityId!==null&&!uuid.test(input.activityId)))throw problem('invalid');
      return command('tal_create_invoice',id,key,{expectedDataRevision:cents(input.expectedDataRevision),
        invoice:{type:'invoice',number,customer,issueDate:isoDate(input.issueDate),currency:'EUR'},
        components:[{kind:'compensation',amountCents:amount,activityId:input.activityId}]});
    },
    recordPayment: (id,input,key) => {
      const i=input.invoice,amount=cents(input.amountCents);
      if(!i?.simple || !uuid.test(i.id) || !amount || amount>i.residual || amount>i.components[0].amount-i.components[0].allocated)throw incomeProblem('amount');
      return command('tal_record_payment',id,key,{action:'create_payment',expectedDataRevision:cents(input.expectedDataRevision),
        invoiceId:i.id,expectedInvoiceRevision:cents(i.revision),amountCents:amount,cashReceivedCents:amount,withholdingCents:0,
        payment:{cashDate:isoDate(input.cashDate),currency:'EUR'},allocations:[{componentId:i.components[0].id,amountCents:amount}]});
    },
  };
}

// Context lifecycle: results are not kept across logout, error, revocation or context switch.
export function createTalDataController({ auth, service, defer = fn => setTimeout(fn,0) }) {
const listeners = new Set();
let scope = '', generation = 0, pending = null;
let state = { phase: 'idle', data: null };
const emit = next => { state = next; for (const fn of listeners) fn(structuredClone(state)); };
const key = a => a.phase === 'ready' ? a.user.id + ':' + a.selected.context_type + ':' + a.selected.context_id : '';
async function refresh() {
  if (!scope) return;
  if (pending) return pending;
  const version = generation;
  if (!state.data) emit({ phase: 'loading', data: null });
  pending = (async () => {
    try {
      const data = await service.loadContext();
      if (version === generation) emit({ phase: 'ready', data });
    } catch (error) {
      if (version !== generation) return;
      // A periodic Auth discovery can supersede a read. Retry from current identity.
      if (error.code === 'stale') {
        emit({ phase: 'loading', data: null });
        defer(() => void refresh());
      } else emit({ phase: ['forbidden','expired'].includes(error.code) ? 'forbidden' : 'error', data: null });
    } finally { if (version === generation) pending = null; }
  })();
  return pending;
}
const controller = {
  getState: () => structuredClone(state),
  subscribe(fn) { listeners.add(fn); fn(structuredClone(state)); return () => listeners.delete(fn); },
  refresh,
};
auth.subscribe(a => {
  const next = key(a);
  if (next !== scope) {
    scope = next; generation++; pending = null;
    emit({ phase: next ? 'loading' : 'idle', data: null });
  }
  if (next) void refresh();
});

return controller;
}
