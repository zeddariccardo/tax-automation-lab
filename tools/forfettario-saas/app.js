import {workflowActions,nextPaymentView,clientWorkflow,managementLabel} from './workflow-view.js';
import {createImportUI} from './import-ui.js';
import {createOnboardingUI} from './onboarding-ui.js';
import { createCollaborationController } from './collaboration-controller.js';
import { collaborationView } from './collaboration-view.js';
import { createCollaborationUI } from './collaboration-ui.js';
import { auth } from './auth-runtime.js';
import { authEntry } from './auth-view.js';
import { cloud, service } from './tal-data-runtime.js';
import { createIncomeController } from './income-controller.js';
import { createFiscalController } from './fiscal-controller.js';
import { fiscalView } from './fiscal-view.js';
import { createDeclarationController } from './declaration-controller.js';
import { declarationView } from './declaration-view.js';
import { createDeclarationUI } from './declaration-ui.js';
import { paymentsView } from './payments-view.js';
import { createPaymentsUI } from './payments-ui.js';
import { createVerificationUI } from './verification-ui.js';
import { parseAmount, amountInput, formatCents } from './income-model.js';
const incomes = createIncomeController({auth,service});
const fiscals = createFiscalController({auth,service});
const declarations = createDeclarationController({auth,service});
const payments = createFiscalController({auth,service:{calculateFiscal:(id,year)=>service.readPayments(id,year)}});
let access = auth.getState();
let structural = cloud.getState();
const collaborations=createCollaborationController({auth,service});
const workflows=createCollaborationController({auth,service:{listCollaborationQueue:async ids=>{const out=[];for(let i=0;i<ids.length;i+=4)out.push(...await Promise.all(ids.slice(i,i+4).map(id=>service.readWorkflow(id))));return out;}}});
const workflow=id=>workflows.getState().phase==='ready'?workflows.getState().data.find(w=>w.workspaceId===id):null;
const canConfirm=id=>workflow(id)?.canConfirm===true;
const workflowPending=()=>workflows.getState().phase==='loading'?'<p class="loading" role="status">Aggiornamento delle verifiche…</p>':'<p role="alert">Non riusciamo a caricare le verifiche aggiornate.</p>'+button('workflow-retry','Riprova');
const positions = () => structural.phase === 'ready' ? structural.data.positions : [];
const positionFor = id => positions().find(p => p.id === id);
const positionLabel = id => positionFor(id)?.label || 'Posizione non disponibile';
let loginEmail = ''; let signup = false; let heroPaused = false;

const app = document.querySelector('#app');
const panel = document.querySelector('#panel');
const notice = document.querySelector('#notice');
const euro = formatCents;
const esc = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const paths = {
  home: '<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z"/>',
  income: '<rect x="3" y="6" width="18" height="15" rx="3"/><path d="M3 11h18M7 3v6m10-6v6m-6 6v3m-2-1 2 2 2-2"/>',
  taxes: '<path d="M4 20h16M7 20V10m5 10V7m5 13V4M4 5l5-2"/>',
  file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Zm0 0v6h6M8 13h8m-8 4h5"/>',
  activity: '<path d="M21 11a8 8 0 0 1-8 8H6l-4 3V11a9 9 0 0 1 19 0Z"/><path d="M7 10h9m-9 4h6"/>',
  arrow: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
  chevron: '<path d="m9 5 7 7-7 7"/>',
  back: '<path d="M20 12H4m6-6-6 6 6 6"/>',
  upload: '<path d="M12 16V3m-5 5 5-5 5 5M4 15v5h16v-5"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M7 3v4m10-4v4m-9 8h3"/>',
  people: '<circle cx="9" cy="7" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3m2-17a3 3 0 0 1 0 6m2 4a6 6 0 0 1 2 5v2"/>',
  person: '<circle cx="12" cy="7" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/>',
  todo: '<rect x="4" y="3" width="16" height="18" rx="3"/><path d="m8 9 2 2 5-5m-7 10h8"/>',
  plus: '<path d="M12 4v16M4 12h16"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  search: '<circle cx="10" cy="10" r="6"/><path d="m15 15 6 6"/>',
  lock: '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V6a4 4 0 0 1 8 0v4m-4 6v1"/>',
  briefcase: '<rect x="3" y="7" width="18" height="14" rx="3"/><path d="M8 7V3h8v4M3 12a24 24 0 0 0 18 0m-9 0v4"/>',
};
const icon = name => `<svg viewBox="0 0 24 24" aria-hidden="true">${paths[name] || paths.file}</svg>`;
const brand = () => '<div class="brand"><img src="./mark.svg" alt=""><span>TAL</span><span>TAX AUTOMATION<br>LAB</span></div>';
const navItems = [['oggi', 'Oggi', 'home'], ['entrate', 'Entrate', 'income'], ['tasse', 'Tasse', 'taxes'], ['pagamenti','Pagamenti','calendar'], ['attivita', 'Attività', 'activity']];
const clientItems = [['oggi','Riepilogo','home'],['entrate','Entrate','income'],['tasse','Tasse','taxes'],['attivita','Attività','activity'],['dichiarazione','Dichiarazione','file'],['pagamenti','Pagamenti','calendar']];
const positionPages = [...navItems.map(n => n[0]), 'documenti', 'dichiarazione'];
const studioItems = [['da-fare', 'Da fare', 'todo'], ['clienti', 'Clienti', 'people']];
let filter = 'all'; let taxMode = 'current'; let notificationTimer;
const fiscalYears = new Map();
let clientQuery = '';
const views = new Map();
let renderedHash = '';
let panelSequence = 0;
const panels = new Map();
let panelOpener;
let lastActionFocus;
let panelActionFocus;
let afterPanelClose;
let closingPanel = false;
history.scrollRestoration = 'manual';
history.replaceState({ ...history.state, panel: null }, '', location.href);

function route() {
  if (onboardingUI.mustSetup() || access.phase !== 'ready' || !access.selected) return { role: 'entry', page: 'ingresso' };
  const bits = location.hash.replace(/^#\/?/, '').split('/');
  if (access.selected.context_type === 'personal' && bits[0] === 'io' && positionPages.includes(bits[1])) return { role: 'personal', id: access.selected.context_id, page: bits[1], client: false };
  if (access.selected.context_type === 'studio' && bits[0] === 'studio') {
    if (bits[1] === 'clienti' && bits[2] && positionPages.includes(bits[3])) return { role: 'studio', id: bits[2], page: bits[3], client: true };
    if (studioItems.some(n => n[0] === bits[1]) && !bits[2]) return { role: 'studio', page: bits[1], client: false };
  }
  return access.selected.context_type === 'personal' ? { role: 'personal', id: access.selected.context_id, page: 'oggi', client: false } : { role: 'studio', page: 'da-fare', client: false };
}
const href = (r, page) => r.client ? `#/studio/clienti/${r.id}/${page}` : `#/io/${page}`;
const link = (url, text, cls = 'text-link', arrow = true, attributes = '') => `<a class="${cls}" href="${url}" ${attributes}>${text}${arrow ? icon('arrow') : ''}</a>`;
const button = (action, text, options = '', cls = 'button') => `<button class="${cls}" type="button" data-action="${action}" ${options}>${text}</button>`;
function nav(items, base, current, name, cls = '') { return `<nav aria-label="${name}" class="primary-nav ${cls}">${items.map(([key, label, glyph]) => `<a class="nav-link" href="${base}/${key}" ${key === current ? 'aria-current="page"' : ''}>${icon(glyph)}<span>${label}</span></a>`).join('')}</nav>`; }
function heading(title, text = '', actions = '') { return `<div class="heading"><div><h1>${title}</h1>${text ? `<p>${text}</p>` : ''}</div>${actions ? `<div class="actions">${actions}</div>` : ''}</div>`; }
function footer() { return '<p class="page-footer">TAL · Anteprima di sviluppo · solo dati sintetici</p>'; }

function origin() { return history.state?.origin || { href: '#/studio/clienti', label: 'Clienti' }; }
function returnLink(cls = 'text-link') { const o = origin(); return link(o.href, `${icon('back')}Torna a ${o.label}`, cls, false); }
function rememberView() {
  if (!renderedHash || panel.open) return;
  views.set(renderedHash, { scroll: window.scrollY, query: clientQuery, filter, taxMode });
}
function focusContext(name) {
  const target = document.getElementById(name);
  if (target) { target.focus({ preventScroll: true }); target.scrollIntoView({ block: 'start' }); }
}
function showRoute(focus) {
  const saved = views.get(location.hash);
  filter = saved?.filter || 'all'; taxMode = focus === 'reserve-detail' ? 'current' : saved?.taxMode || 'current';
  if (route().role === 'studio' && route().page === 'clienti' && !route().client) clientQuery = saved?.query || '';
  entering = { hash: location.hash, at: performance.now() };
  render(true);
  void cloud.refresh();
  void workflows.refresh();
  if(['oggi','tasse'].includes(route().page))void fiscals.refresh();
  if(route().page==='dichiarazione')void declarations.refresh();
  if(['oggi','attivita','documenti','da-fare'].includes(route().page))void collaborations.refresh();
  window.scrollTo(0, saved?.scroll || 0);
}
function navigate(url, { open, focus, requestId } = {}) {
  const proceed = () => {
    rememberView();
    const r = route();
    const source = r.role === 'studio' && !r.client ? { href: location.hash, label: studioItems.find(n => n[0] === r.page)?.[1] || 'Clienti' } : r.client ? origin() : null;
    history.pushState({ origin: source, panel: null, context: focus === 'payment-context' ? focus : null }, '', url);
    showRoute(focus);
    if (focus) focusContext(focus);
    if (open) void collaborations.refresh().then(()=>{if(location.hash!==url)return;focusContext(focus);return action(open,{dataset:{request:requestId}});}).catch(()=>notify('Attività non disponibile.'));
    else if(focus?.startsWith('activity-'))void collaborations.refresh().then(()=>focusContext(focus));
  };
  if (panel.open) closePanel(proceed); else proceed();
}

function entry() { return authEntry({ access, loginEmail, brand, icon, esc, button, signup, heroPaused, setup:onboardingUI.mustSetup()?onboardingUI.content():null }); }
function shell(r, content) {
  const studio = r.role === 'studio';
  const p = positionFor(r.id);
  const studioName = structural.data?.studio?.name || access.selected.label;
  const activePage = r.page === 'documenti' ? 'attivita' : r.page;
  const clientHeader = r.client && p ? `<div class="client-bar"><span class="desktop-return">${returnLink()}</span><span class="avatar">${icon('person')}</span><div class="row-main"><strong>${esc(p.label)}</strong>${p.studioReference ? '<small>Riferimento Studio · '+esc(p.studioReference)+'</small>' : ''}</div><button class="text-link" type="button" data-action="profile">Dati della posizione</button></div><nav class="client-nav" aria-label="Posizione cliente">${clientItems.map(([key, label]) => `<a href="${href(r,key)}" ${activePage===key?'aria-current="page"':''}>${label}</a>`).join('')}</nav>` : '';
  return `<div class="${r.client ? 'client-mode' : ''}"><aside class="rail"><div class="rail-brand">${brand()}</div><p class="eyebrow rail-label">${studio ? esc(studioName) : 'Il tuo forfettario'}</p>${nav(studio ? studioItems : navItems, studio ? '#/studio' : '#/io', r.client ? 'clienti' : activePage,'Principale')}<div class="rail-bottom"><div class="profile"><span class="avatar">${icon(studio?'briefcase':'person')}</span><div><strong>${studio ? esc(studioName) : 'La mia attività'}</strong><span class="small muted">${studio ? 'Area Studio' : esc(p?.label || '')}</span></div></div></div></aside><div class="shell"><header class="topbar"><div class="mobile-brand">${brand()}</div><span class="small muted desktop-date">${new Intl.DateTimeFormat('it-IT',{weekday:'long',day:'numeric',month:'long',year:'numeric'}).format(new Date())}</span><div class="demo-tools"><span class="demo-label">Ambiente di sviluppo · dati sintetici</span><button class="demo-switch" type="button" data-action="account">Account</button></div></header><main class="page" id="main" tabindex="-1">${clientHeader}${content}${footer()}</main></div>${r.client ? `<div class="mobile-client-nav">${returnLink('text-link context-return')}${nav(clientItems,`#/studio/clienti/${r.id}`,activePage,'Posizione cliente mobile')}</div>` : ''}</div>`;
}
function cloudStatus() {
  if (structural.phase === 'loading' || structural.phase === 'idle') return heading('Caricamento')+'<p class="loading" role="status">Caricamento della posizione…</p>';
  const denied = structural.phase === 'forbidden';
  return heading(denied ? 'Posizione non disponibile' : 'Dati non disponibili')+'<p role="alert">'+(denied ? 'Il tuo accesso potrebbe essere cambiato. Ricontrolla le posizioni disponibili.' : 'Controlla la connessione e riprova.')+'</p>'+button(denied?'auth-retry':'data-retry','Riprova');
}
function profileDetails(p) {
  const start = p.startDate ? new Intl.DateTimeFormat('it-IT',{timeZone:'UTC'}).format(new Date(p.startDate)) : 'Non indicata';
  return `<p>${esc(p.label)}</p><dl class="cloud-profile"><dt>ID TAL</dt><dd>${esc(p.talId || 'Non assegnato')}</dd><dt>Inizio attività</dt><dd>${start}</dd><dt>Annualità disponibili</dt><dd>${p.years.length ? p.years.map(y=>y.year).join(', ') : 'Nessuna annualità disponibile'}</dd><dt>Attività dichiarate</dt><dd>${p.activities.length ? p.activities.map(a=>esc(a.atecoCode || 'Codice ATECO non indicato')).join('<br>') : 'Nessuna attività indicata'}</dd>${p.studioReference ? '<dt>Riferimento dello Studio</dt><dd>'+esc(p.studioReference)+'</dd>' : ''}</dl><p class="small muted">Dati della posizione · sola lettura</p>`;
}

function collaboration(r,mode='activity') {
 const ids=mode==='queue'?positions().map(p=>p.id):r.id?[r.id]:[];
 collaborations.select(ids);
 return collaborationView({r,state:collaborations.getState(),access,positions:positions(),heading,link,href,button,esc,icon,mode,connection:mode==='activity'?button('s11-links',r.role==='personal'?'Il tuo commercialista':'Collegamento cliente','','button secondary'):''});
}
function fiscalPage(r) {
 const years=positionFor(r.id)?.years.map(y=>y.year)||[];
 const year=years.includes(fiscalYears.get(r.id))?fiscalYears.get(r.id):years[0]||new Date().getFullYear();
 fiscals.select(r.id,year);
 const yearControl=years.length>1?'<label class="small fiscal-year">Anno <select aria-label="Anno fiscale" data-fiscal-year>'+years.map(y=>'<option value="'+y+'"'+(y===year?' selected':'')+'>'+y+'</option>').join('')+'</select></label>':'';
 return fiscalView({r,state:fiscals.getState(),mode:taxMode,heading:(title,text,actions='')=>heading(title,text,yearControl+actions),button,link,href,euro,esc,label:positionLabel(r.id)});
}
const today=r=>{const w=workflow(r.id);if(r.client)return (w?clientWorkflow(w,{heading,label:positionLabel(r.id),base:href(r,''),esc,link}):heading('Riepilogo',esc(positionLabel(r.id)))+workflowPending())+collaboration(r,'today');incomes.select(r.id);const s=incomes.getState();const start=s.phase==='ready'&&!s.data.invoices.length?heading('La mia attività','Aggiungi una fattura già emessa o importa i dati esistenti.',button('add-invoice','Aggiungi la prima fattura'))+'<p>Hai già usato TAL? <button class="text-link" type="button" data-action="s13-import">Importa i tuoi dati</button></p>':fiscalPage(r);return start+'<div class="today-follow"><div class="today-side">'+(w?nextPaymentView(w,{href:href(r,'pagamenti'),esc,euro}):workflowPending())+link(href(r,'dichiarazione'),icon('file')+'<span>Dichiarazione TAL</span>','link-card')+'</div>'+collaboration(r,'today')+'</div>';};
function invoiceRows(p) {
  const list = p.invoices.filter(i => filter !== 'outstanding' || i.residual > 0);
  if (!list.length) return '<p class="empty">'+(filter==='outstanding'?'Non ci sono importi da incassare.':'Non hai ancora registrato fatture. Aggiungi la prima.')+'</p>';
  return list.map(i => `<article class="row"><div class="row-main"><h3><button type="button" class="text-link" data-action="invoice-detail" data-invoice="${i.id}">Fattura ${esc(i.number)}</button></h3><p>${esc(i.customer)} · ${new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(i.date))}</p></div><div class="row-end"><strong class="money">${euro(i.total)}</strong><span class="payment-state ${i.review ? 'tone-warn' : i.residual === 0 ? 'paid tone-ok' : i.paid ? 'tone-info' : 'tone-neutral'}">${i.review ? 'Rettifica da controllare' : i.residual === 0 ? (i.credited ? 'Rettificata' : 'Incassata') : i.paid ? `${euro(i.paid)} incassati` : 'Da incassare'}</span>${i.paid>0&&i.residual>0?'<span class="muted small">Restano '+euro(i.residual)+'</span>':''}</div><div class="row-action">${i.residual>0&&i.simple ? button('payment', 'Registra incasso', `data-invoice="${i.id}"`, 'button secondary') : ''}</div></article>`).join('');
}
function income(r) {
  incomes.select(r.id);
  const state=incomes.getState();
  if(state.phase!=='ready')return heading('Entrate')+(state.phase==='loading'?'<p class="loading" role="status">Caricamento di fatture e incassi…</p>':'<p role="alert">'+(state.phase==='forbidden'?'L’accesso alla posizione non è più disponibile.':'Non riusciamo a caricare le entrate. Controlla la connessione.')+'</p>'+button('income-retry','Riprova'));
  const p=state.data;
  return `${heading('Entrate', '', `${button('add-invoice', icon('plus')+'Aggiungi fattura')}<button class="button secondary" type="button" data-action="s13-import">${icon('upload')}Importa</button>`)}<div class="summary-inline"><div><span>Incassati nel ${p.year}</span><strong class="money">${p.received===null?'Da verificare':euro(p.received)}</strong></div><div><span>Da incassare · tutte le fatture</span><strong class="money">${euro(p.outstanding)}</strong></div></div><div class="filterbar" aria-label="Filtra fatture"><button class="chip" aria-pressed="${filter === 'all'}" data-filter="all">Tutte</button><button class="chip" aria-pressed="${filter === 'outstanding'}" data-filter="outstanding">Da incassare</button><button class="text-link income-refresh" data-action="income-retry" type="button">Aggiorna</button></div><div class="list" id="invoice-list">${invoiceRows(p)}</div>`;
}

const taxes=r=>fiscalPage(r)+(r.role==='personal'?'<p>'+link(href(r,'dichiarazione'),'Dati per la dichiarazione')+'</p>':'');
function declarationPage(r){declarations.select(r.id,2025);return declarationView({state:declarations.getState(),heading,button,esc,euro,studio:r.role==='studio',canConfirm:canConfirm(r.id),linkedStudio:workflow(r.id)?.linkedStudio===true,base:href(r,'')});}
function paymentsPage(r){payments.select(r.id,2025);return paymentsView({state:payments.getState(),heading,button,esc,euro,studio:r.role==='studio',canConfirm:canConfirm(r.id),base:href(r,'pagamenti').replace(/pagamenti$/,'')});}
const documents=r=>collaboration(r,'documents');
const activity=r=>collaboration(r);
function todo(){if(!positions().length)return heading('Nessun cliente collegato','Invita un cliente già registrato su TAL.',button('s11-links','Invita il primo cliente'));const state=workflows.getState();const items=state.data?.flatMap(w=>workflowActions(w).map(a=>({...a,id:w.workspaceId})))||[];return collaboration(route(),'queue')+(state.phase==='ready'?(items.length?'<section class="waiting-list actionable-list"><h2>Dichiarazioni e pagamenti</h2>'+items.map(a=>'<article class="waiting-row"><div class="row-main"><strong>'+esc(positionLabel(a.id))+'</strong><p>'+esc(a.detail)+'</p></div>'+link('#/studio/clienti/'+a.id+'/'+a.page,a.label,'text-link',false)+'</article>').join('')+'</section>':''):workflowPending());}
function clientRows(query = '') {
  const all = positions();
  if (!all.length) return '<p class="empty">Nessun cliente collegato.</p>';
  const found = all.filter(p => (p.label+' '+(p.studioReference||'')).toLocaleLowerCase('it').includes(query.toLocaleLowerCase('it')));
  return found.length ? found.map(p => `<a class="client-link" href="#/studio/clienti/${p.id}/oggi"><span class="avatar">${icon('person')}</span><div class="row-main"><h2>${esc(p.label)}</h2>${p.studioReference ? '<p>Riferimento Studio · '+esc(p.studioReference)+'</p>' : ''}</div>${icon('chevron')}</a>`).join('') : '<p class="empty">Nessun cliente trovato. Prova con un altro nome o riferimento.</p>';
}
function clients() { return `${heading('Clienti','',button('s11-links','Invita cliente')+'<button class="button secondary" type="button" data-action="s13-import">Importa</button>')}${positions().length ? '<label class="search">'+icon('search')+'<input id="client-search" type="search" aria-label="Cerca un cliente per nome o riferimento" placeholder="Cerca per nome o riferimento" autocomplete="off" value="'+esc(clientQuery)+'"></label>' : ''}<div class="list" id="client-list">${clientRows(clientQuery)}</div><p class="small muted" id="search-status" role="status"></p>`; }
let declarationLayout=null;
// Entry motion runs once per navigation, on the first paint without loading states:
// periodic refreshes rebuild the DOM and must not replay it.
let entering=null;
function markEntering(){
  const main=document.querySelector('#main');
  if(!entering||entering.hash!==location.hash||!main)return;
  if(performance.now()-entering.at>4000){entering=null;return;}
  if(main.querySelector('.loading,[aria-busy="true"]'))return;
  main.classList.add('is-entering');entering=null;
}
function render(focus = false) {
  if(renderedHash===location.hash&&document.querySelector('.declaration-page'))declarationLayout={hash:location.hash,scroll:window.scrollY,open:[...document.querySelectorAll('.declaration-page details')].map(x=>x.open)};
  else if(declarationLayout?.hash!==location.hash)declarationLayout=null;
  if(onboardingUI.mustSetup()&&document.querySelector('#onboarding-form,#studio-form')&&!focus&&!onboardingUI.isLoading())return;
  const composer=document.querySelector('#message-form');
  const draft=renderedHash===location.hash?composer?.elements.message.value:null;
  const messageFocused=document.activeElement?.id==='message';
  const selection=messageFocused?[document.activeElement.selectionStart,document.activeElement.selectionEnd]:null;
  if(composer?.dataset.busy==='true'&&!focus)return;
  if (access.phase === 'ready') {
    const prefix = access.selected.context_type === 'personal' ? '#/io/' : '#/studio/';
    if (!location.hash.startsWith(prefix)) history.replaceState({ panel: null }, '', prefix + (access.selected.context_type === 'personal' ? 'oggi' : 'da-fare'));
  }
  const r = route();
  workflows.select(structural.phase==='ready'&&r.role!=='entry'?(r.id?[r.id]:r.page==='da-fare'?positions().map(p=>p.id):[]):[]);
  if(!['entrate','oggi'].includes(r.page))incomes.select(null);
  if(!['oggi','tasse'].includes(r.page))fiscals.select(null,null);
  if(r.page!=='dichiarazione')declarations.select(null,null);
  if(r.page!=='pagamenti')payments.select(null,null);
  renderedHash = location.hash;
  document.title = `${r.role === 'entry' ? 'Benvenuto' : r.page === 'documenti' ? 'Archivio documenti' : r.client && r.page === 'oggi' ? 'Riepilogo' : [...navItems, ...studioItems, ['dichiarazione','Dichiarazione']].find(n => n[0] === r.page)?.[1] || 'TAL'} · TAL — Anteprima`;
  if (r.role === 'entry') app.innerHTML = entry();
  else {
    let content;
    if (structural.phase !== 'ready') content = cloudStatus();
    else if (r.id && !positionFor(r.id)) content = heading('Posizione non disponibile')+'<p role="status">Questa posizione non è disponibile nel contesto scelto.</p>'+returnLink();
    else if (r.id) {
      content = ({ oggi: today, entrate: income, tasse: taxes, documenti: documents, attivita: activity, dichiarazione: declarationPage, pagamenti: paymentsPage })[r.page](r);
    } else content = ({ 'da-fare': todo, clienti: clients })[r.page]();
    app.innerHTML = shell(r, content);
  }
  if(draft!==null&&draft!==undefined&&document.querySelector('#message')){const input=document.querySelector('#message');input.value=draft;if(messageFocused){input.focus({preventScroll:true});input.setSelectionRange(...selection);}}
  if(declarationLayout?.hash===location.hash&&document.querySelector('.declaration-page')){
    document.querySelectorAll('.declaration-page details').forEach((x,i)=>{if(i<declarationLayout.open.length)x.open=declarationLayout.open[i];});
    if(!focus)window.scrollTo(0,declarationLayout.scroll);
  }
  if (focus) document.querySelector('#main').focus({ preventScroll: true });
  markEntering();
}

function notify(message) { clearTimeout(notificationTimer); notice.textContent = message; notificationTimer = setTimeout(() => { notice.textContent = ''; }, 5500); }
function openPanel(title, body, restoring = false) {
  if (!restoring && panel.open && history.state?.panel) {
    panels.set(history.state.panel, {title,body});
  } else if (!restoring) {
    rememberView();
    panelOpener = document.activeElement;
    panelActionFocus = lastActionFocus?.hash === location.hash ? lastActionFocus : null;
    const key = ++panelSequence;
    panels.set(key, { title, body });
    history.pushState({ ...history.state, panel: key }, '', location.href);
  }
  panel.innerHTML = `<div class="dialog-head"><h2 id="panel-title">${title}</h2><button class="icon-button" aria-label="Chiudi" type="button" data-action="close">${icon('close')}</button></div><div class="dialog-body">${body}</div>`;
  panel.showModal();
  if (!panel.contains(document.activeElement)) panel.querySelector('[data-action="close"]').focus();
}
function closePanel(after) {
  if (closingPanel) return;
  if (!panel.open) { after?.(); return; }
  if(panel.querySelector('form[id^="import-"], #import-error'))importUI.clear();
  afterPanelClose = after;
  closingPanel = true;
  if (history.state?.panel) history.back();
  else { panel.close(); closingPanel = false; afterPanelClose = null; after?.(); }
}
function done(message) {
  void workflows.refresh();
  const scroll = window.scrollY;
  panels.delete(history.state?.panel);
  closePanel(() => { render(true); window.scrollTo(0, scroll); notify(message); });
}
const localDate=()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');};
function moneyForm(command, initial='', invoice=null) {
  const data=incomes.getState().data, creating=command==='invoice-save';
  const activities=data?.activities||[];
  return `<form id="amount-form" data-command="${command}" novalidate>${creating?'<div class="field"><label for="invoice-number">Numero fattura</label><input id="invoice-number" name="number" maxlength="80" required autocomplete="off"></div><div class="field"><label for="invoice-customer">Cliente</label><input id="invoice-customer" name="customer" maxlength="180" required autocomplete="off"></div>':''}<div class="field"><label for="money-date">${creating?'Data fattura':'Data incasso'}</label><input id="money-date" name="date" type="date" value="${localDate()}" required></div><div class="field"><label for="amount">${creating?'Importo della fattura (€)':'Importo incassato (€)'}</label><input id="amount" name="amount" inputmode="decimal" value="${initial}" aria-describedby="amount-help form-error" autocomplete="off" required><p id="amount-help">${creating?'Inserisci l’importo di una fattura già emessa.':'Restano '+euro(invoice.residual)+' da incassare.'}</p></div>${creating&&activities.length>1?'<div class="field"><label for="invoice-activity">Attività</label><select id="invoice-activity" name="activity" required><option value="">Scegli l’attività</option>'+activities.map(a=>'<option value="'+a.id+'">'+esc(a.label)+'</option>').join('')+'</select></div>':''}<p class="error" id="form-error" tabindex="-1" role="alert"></p><button class="button" type="submit">${creating?'Aggiungi fattura':'Registra incasso'}</button></form>`;
}
const moneyJobs=new WeakMap();
const pensionJobs=new WeakMap(),pensionUploads=new WeakMap();let pensionContext=null,pensionDocuments=[];
function pensionForm(d){
 const obligations=pensionContext?.pensionObligations||[];const detail=obligations.length?'<div class="field"><label for="pension-obligation">Gestione previdenziale</label><select id="pension-obligation" name="obligation" required><option value="">Scegli la gestione</option>'+obligations.map(o=>'<option value="'+o.id+'">'+esc(managementLabel(o.managementId))+' · '+o.year+'</option>').join('')+'</select></div><div class="field"><label for="pension-reference">Anno cui si riferiscono i contributi</label><input id="pension-reference" name="referenceYear" type="number" min="1900" max="2200" required></div><div class="field"><label for="pension-role">Tipo di versamento</label><select id="pension-role" name="settlementRole" required><option value="">Scegli</option><option value="minimum">Minimale</option><option value="advance">Acconto</option><option value="balance">Saldo</option><option value="unknown">Da verificare</option></select></div>':'';
 return '<p>Registra tutti i contributi previdenziali obbligatori già pagati e rimasti a tuo carico. Escludi quelli ancora da versare.</p><form id="pension-form" data-year="'+d.year+'" data-revision="'+d.dataRevision+'">'+detail+'<div class="field"><label for="pension-date">Data del versamento</label><input id="pension-date" name="date" type="date" min="'+d.year+'-01-01" max="'+d.year+'-12-31" value="'+(Number(localDate().slice(0,4))===d.year?localDate():'')+'" required></div><div class="field"><label for="pension-amount">Importo versato (€)</label><input id="pension-amount" name="amount" inputmode="decimal" required autocomplete="off"></div><div class="field"><label for="pension-document">Ricevuta già caricata · facoltativa</label><select id="pension-document" name="document"><option value="">Nessun documento</option>'+pensionDocuments.map(doc=>'<option value="'+doc.id+'">'+esc(doc.original_filename)+'</option>').join('')+'</select></div><div class="field"><label for="pension-file">Oppure carica la ricevuta</label><input id="pension-file" name="receipt" type="file" accept=".pdf,.png,.jpg,.jpeg,.xml"></div><p id="pension-error" class="error" role="alert" tabindex="-1"></p><button class="button" type="submit">Registra versamento</button>'+(d.pensionPayments.length?'':'<button class="text-link auth-exit" type="button" data-action="pension-none">Non ho effettuato versamenti nel '+d.year+'</button>')+'</form>';
}
async function savePension(form,action){
 if(!form||form.dataset.busy==='true')return;
 form.dataset.busy='true';
 const r=route(),identity=access.user?.id+':'+access.selected?.context_id;
 const current=()=>access.phase==='ready'&&identity===access.user.id+':'+access.selected.context_id&&route().id===r.id&&form.isConnected;
 try{
  if(!pensionJobs.has(form)){
   const fields=new FormData(form);const input={year:Number(form.dataset.year),action,expectedDataRevision:Number(form.dataset.revision)};
   if(action==='add'){input.paidDate=fields.get('date');input.amountCents=parseAmount(fields.get('amount'));let evidenceId=fields.get('document')||null;
    if(!evidenceId&&form.elements.receipt.files[0]){if(!pensionUploads.has(form))pensionUploads.set(form,await service.prepareUpload(r.id,form.elements.receipt.files[0]));const res=await service.uploadDocument(pensionUploads.get(form));if(!current())return;evidenceId=res.documentId;}
    if(evidenceId)input.evidenceId=evidenceId;
    if(fields.get('obligation')){delete input.action;Object.assign(input,{movementKind:'payment',obligationId:fields.get('obligation'),referenceYear:Number(fields.get('referenceYear')),settlementRole:fields.get('settlementRole')});}
   }
   pensionJobs.set(form,{key:crypto.randomUUID(),input});
  }
  const job=pensionJobs.get(form);for(const el of form.querySelectorAll('input,select,button'))el.disabled=true;
  form.querySelector('#pension-error').textContent='';fiscals.invalidate();
  await service[job.input.movementKind?'recordPensionMovement':'recordPension'](r.id,job.input,job.key);pensionJobs.delete(form);
  if(!current())return;await fiscals.refresh();if(current())done(action==='none'?'Nessun versamento dichiarato.':'Versamento registrato.');
 }catch(error){
  if(!current())return;
  const uncertain=error.code==='uncertain'||error.code==='stale';if(!uncertain)pensionJobs.delete(form);
  await fiscals.refresh();if(!current())return;
  const data=fiscals.getState().data;if(data)form.dataset.revision=data.dataRevision;
  for(const el of form.querySelectorAll('input,select,button'))el.disabled=uncertain&&el.tagName!=='BUTTON'||['forbidden','expired'].includes(error.code);
  form.querySelector('[type="submit"]').textContent='Riprova';
  const message=form.querySelector('#pension-error');message.textContent=error.code==='conflict'?'La posizione è cambiata. Controlla i dati e riprova.':error.code==='amount'?'Inserisci un importo positivo, con al massimo due decimali.':uncertain?'Non abbiamo ricevuto conferma. Riprova: il versamento non verrà duplicato.':'Non è stato possibile registrare il versamento. Controlla data e importo.';message.focus();
 }finally{form.dataset.busy='false';}
}
document.addEventListener('submit',event=>{if(event.target.id==='pension-form'){event.preventDefault();void savePension(event.target,'add');}});
const moneyErrors={amount:'Inserisci un importo positivo con al massimo due decimali, entro il residuo.',date:'Controlla la data.',invalid:'Controlla numero, cliente, data e importo.',forbidden:'Il tuo accesso è cambiato. Non puoi completare questa operazione.',expired:'Accedi di nuovo per continuare.',conflict:'I dati sono cambiati. Controlla la situazione aggiornata e riprova.',idempotency:'Questa operazione non corrisponde al tentativo precedente. Chiudi e controlla le entrate.',uncertain:'Conferma non ricevuta. Riprova senza modificare i dati: il tentativo non crea duplicati.',stale:'La sessione è cambiata. Riprova per verificare lo stesso tentativo.'};
let currentInvoice;
async function action(name, element) {
  if(await importUI.action(name,element))return;
  if(await onboardingUI.act(name,element))return;
  if(name==='hero-motion'){
   heroPaused=!heroPaused;const intro=document.querySelector('.entry-intro');if(intro)intro.dataset.heroPaused=String(heroPaused);
   element.setAttribute('aria-pressed',String(heroPaused));element.textContent=heroPaused?'Riprendi animazione':'Ferma animazione';return;
  }
  if(name==='auth-signup-mode'||name==='auth-login-mode'){signup=name==='auth-signup-mode';if(access.phase!=='signed-out')await auth.restore();render(true);if(element?.dataset.authFocus!==undefined)document.querySelector('#login-email')?.focus();return;}
  if (!name.startsWith('auth-') && !['close','account'].includes(name) && access.phase !== 'ready') return;
  const r = route();
  if (!name.startsWith('auth-') && !['account','close','data-retry'].includes(name) && (structural.phase !== 'ready' || (r.id && !positionFor(r.id)))) return;
  if(await collaborationUI.action(name,element))return;
  if(await declarationUI.act(name))return;
  if(await paymentsUI.act(name))return;
  if(await verificationUI.act(name))return;
  switch (name) {
    case 'income-retry': await incomes.refresh(); break;
    case 'workflow-retry': await workflows.refresh(); break;
    case 'fiscal-retry': await fiscals.refresh(); break;
    case 'declaration-retry': await declarations.refresh(); break;
    case 'pension': {
      const d=fiscals.getState().data;if(!d||d.workspaceId!==r.id)return;
      const stamp=access.user.id+':'+access.selected.context_id;const [w,collab]=await Promise.all([service.readWorkflow(r.id),service.listCollaboration(r.id)]);if(access.phase!=='ready'||stamp!==access.user.id+':'+access.selected.context_id||route().id!==r.id)return;
      pensionContext=w;pensionDocuments=collab.documents;openPanel('Contributi già versati',pensionForm(d));break;
    }
    case 'pension-none': await savePension(document.querySelector('#pension-form'),'none');break;
    case 'data-retry': await cloud.refresh(); break;
    case 'profile': if(positionFor(r.id)) openPanel('Dati della posizione',profileDetails(positionFor(r.id))); break;
    case 'account':
      openPanel('Il tuo account', (access.selected.context_type==='personal'?button('profile','Dati della posizione','','button secondary'):'')+'<p class="account-email">'+esc(access.user.email)+'</p><p><strong>'+esc(access.selected.context_type === 'personal' ? 'La mia attività' : access.selected.label)+'</strong></p>'+(access.contexts.length > 1 ? button('auth-switch', 'Cambia profilo') : '')+'<button class="text-link auth-exit" type="button" data-action="auth-logout">Esci</button>'); break;
    case 'auth-switch': await auth.chooseAgain(); break;
    case 'auth-select': await auth.choose(access.contexts[Number(element.dataset.choice)]); break;
    case 'auth-retry': await auth.restore(); break;
    case 'auth-logout': loginEmail = ''; await auth.logout(); break;
    case 'close': onboardingUI.dismiss(); closePanel(); break;
    case 'add-invoice': if(incomes.getState().phase==='ready')openPanel('Aggiungi fattura',moneyForm('invoice-save')); break;
    case 'payment': {
      currentInvoice = incomes.getState().data?.invoices.find(i=>i.id===element.dataset.invoice);
      if(!currentInvoice?.simple||currentInvoice.residual<=0)return;
      openPanel('Registra un incasso', `<p>Fattura ${esc(currentInvoice.number)} · ${esc(currentInvoice.customer)}</p>${moneyForm('payment-save',amountInput(currentInvoice.residual),currentInvoice)}`); break;
    }
    case 'invoice-detail': {
      let item;
      try { item=await service.readInvoice(r.id,element.dataset.invoice); }
      catch(error) { if(route().id===r.id)await incomes.refresh();throw error; }
      if(route().id!==r.id||route().page!=='entrate')return;
      openPanel('Fattura '+esc(item.number),'<p>'+esc(item.customer)+'</p><dl class="cloud-profile"><dt>Importo</dt><dd>'+euro(item.total)+'</dd>'+(item.credited?'<dt>Rettifica documento</dt><dd>'+euro(item.credited)+'</dd><dt>Rimborsi effettuati</dt><dd>'+euro(item.refunded)+'</dd>':'')+'<dt>Residuo</dt><dd>'+euro(item.residual)+'</dd></dl><h3>Incassi registrati</h3>'+(item.payments.length?'<ul class="receipt-list">'+item.payments.map(x=>'<li><span>'+new Intl.DateTimeFormat('it-IT',{timeZone:'UTC'}).format(new Date(x.date))+'</span><strong>'+ (x.cash===null?'Da verificare':euro(x.cash))+'</strong></li>').join('')+'</ul>':'<p>Nessun incasso registrato.</p>')+(!item.simple?'<p>Questa fattura richiede un controllo dei dettagli prima di registrare altri incassi.</p>':''));break;
    }

  }
}

document.addEventListener('click', event => {
  if (event.target.closest('.skip')) { event.preventDefault(); document.querySelector('#main').focus(); return; }
  const anchor = event.target.closest('a[href^="#/"]');
  if (anchor && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey && event.button === 0) {
    event.preventDefault();
    navigate(anchor.getAttribute('href'), { open: anchor.dataset.open, focus: anchor.dataset.focus, requestId:anchor.dataset.request });
    return;
  }
  const target = event.target.closest('[data-action],[data-filter],[data-tax]');
  if (!target) return;
  if (target.dataset.action && !panel.open) lastActionFocus = { hash: location.hash, action: target.dataset.action };
  if (target.dataset.action) action(target.dataset.action, target).catch(() => notify('Operazione non completata. Riprova.'));
  if (target.dataset.filter) { filter = target.dataset.filter; render(); document.querySelector(`[data-filter="${filter}"]`).focus(); }
  if (target.dataset.tax) { taxMode = target.dataset.tax; render(); document.querySelector(`[data-tax="${taxMode}"]`).focus(); }
});
document.addEventListener('change',event=>{
 if(!event.target.matches('[data-fiscal-year]'))return;
 const r=route(),year=Number(event.target.value);
 if(!positionFor(r.id)?.years.some(y=>y.year===year))return;
 fiscalYears.set(r.id,year);taxMode='current';render();
 document.querySelector('[data-fiscal-year]')?.focus();
});
document.addEventListener('input', event => {
  if (event.target.id === 'client-search') {
    clientQuery = event.target.value;
    rememberView();
    document.querySelector('#client-list').innerHTML = clientRows(event.target.value);
    const count = document.querySelectorAll('#client-list .client-link').length;
    document.querySelector('#search-status').textContent = `${count} ${count === 1 ? 'cliente trovato' : 'clienti trovati'}.`;
  }
});
document.addEventListener('submit', async event => {
  event.preventDefault();
  if(await importUI.submit(event.target))return;
  if(await onboardingUI.submit(event.target))return;
  if (event.target.id === 'login-form' || event.target.id === 'signup-form') {
    if (access.phase !== 'signed-out') return;
    loginEmail = event.target.elements.email.value;
    const password = event.target.elements.password.value;
    event.target.elements.password.value = '';
    void (event.target.id==='signup-form'?auth.signup(loginEmail,password):auth.login(loginEmail, password));
    return;
  }
  if (access.phase !== 'ready' || structural.phase !== 'ready') return;
  const r = route();
  if(r.id && !positionFor(r.id)) return;
  if(await collaborationUI.submit(event.target))return;
  if (event.target.id === 'amount-form') {
    const form=event.target;if(form.dataset.busy==='true')return;
    const actor=access.user.id,context=access.selected.context_type+':'+access.selected.context_id;
    const stillCurrent=()=>access.phase==='ready'&&access.user.id===actor&&access.selected.context_type+':'+access.selected.context_id===context&&route().id===r.id;
    try {
      if(!moneyJobs.has(form)) {
        const data=incomes.getState().data;if(!data||data.workspaceId!==r.id)throw Object.assign(Error(),{code:'stale'});
        const fields=new FormData(form),amount=parseAmount(fields.get('amount')),key=crypto.randomUUID();
        const method=form.dataset.command==='payment-save'?'recordPayment':'createInvoice';
        const input=method==='recordPayment'?{invoice:data.invoices.find(i=>i.id===currentInvoice?.id),amountCents:amount,cashDate:fields.get('date'),expectedDataRevision:data.dataRevision}:{number:fields.get('number'),customer:fields.get('customer'),issueDate:fields.get('date'),amountCents:amount,expectedDataRevision:data.dataRevision,activityId:data.activities.length===1?data.activities[0].id:fields.get('activity')||null};
        if(method==='createInvoice'&&data.activities.length>1&&!input.activityId)throw Object.assign(Error(),{code:'invalid'});
        moneyJobs.set(form,{method,input:structuredClone(input),key});
      }
      const job=moneyJobs.get(form);form.dataset.busy='true';
      for(const el of form.querySelectorAll('input,select,button'))el.disabled=true;
      form.querySelector('[type="submit"]').textContent='Salvataggio…';form.querySelector('#form-error').textContent='';
      fiscals.invalidate();
      await service[job.method](r.id,job.input,job.key);
      moneyJobs.delete(form);
      if(!stillCurrent())return;
      await incomes.refresh();
      if(form.isConnected&&panel.open)done(job.method==='recordPayment'?'Incasso registrato.':'Fattura aggiunta.');
    } catch (error) {
      if(!stillCurrent()||!form.isConnected)return;
      const uncertain=['uncertain','stale'].includes(error.code);
      if(!uncertain)moneyJobs.delete(form);
      if(['conflict','forbidden'].includes(error.code))await incomes.refresh();
      for(const el of form.querySelectorAll('input,select'))el.disabled=uncertain;
      const submit=form.querySelector('[type="submit"]');submit.disabled=['forbidden','expired'].includes(error.code);submit.textContent='Riprova';
      if(error.code==='conflict'&&form.dataset.command==='payment-save') {
        const latest=incomes.getState().data?.invoices.find(i=>i.id===currentInvoice?.id);
        form.querySelector('#amount-help').textContent=latest ? latest.residual>0?'Restano '+euro(latest.residual)+' da incassare.':'La fattura è già saldata. Puoi controllare gli incassi nel dettaglio.' : 'Non riusciamo a rileggere la fattura. Chiudi e aggiorna le entrate.';
        submit.disabled=!latest?.simple||latest.residual<=0;
      }
      const message=form.querySelector('#form-error');message.textContent=error.code==='amount'&&form.dataset.command==='invoice-save'?'Inserisci un importo positivo con al massimo due decimali.':moneyErrors[error.code]||'Operazione non completata. Riprova.';message.focus();
    } finally {
      form.dataset.busy='false';
    }
  }
});
panel.addEventListener('keydown', event => {
  if (event.key !== 'Tab') return;
  const controls = [...panel.querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href]')].filter(e => e.getClientRects().length);
  const first = controls[0], last = controls.at(-1);
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
});
panel.addEventListener('cancel', event => { event.preventDefault(); onboardingUI.dismiss(); closePanel(); });
window.addEventListener('scroll', rememberView, { passive: true });
window.addEventListener('popstate', () => {
  const wasOpen = panel.open;
  if(wasOpen)onboardingUI.dismiss();
  if (wasOpen) panel.close();
  closingPanel = false;
  const callback = afterPanelClose; afterPanelClose = null;
  if (location.hash !== renderedHash) showRoute();
  if (history.state?.panel) {
    const cached = panels.get(history.state.panel);
    if (cached) openPanel(cached.title, cached.body, true);
    else history.replaceState({ ...history.state, panel: null }, '', location.href);
  } else if (wasOpen && !callback) {
    const replacement = panelActionFocus?.hash === location.hash
      ? [...app.querySelectorAll('[data-action]')].find(el => el.dataset.action === panelActionFocus.action && !el.disabled)
      : null;
    const opener = panelOpener?.isConnected && panelOpener !== document.body ? panelOpener : replacement;
    (opener || document.querySelector('#main')).focus({ preventScroll: true });
  }
  callback?.();
});
window.addEventListener('hashchange', () => { if (location.hash !== renderedHash) showRoute(); });
function clearPosition() {
  if (panel.open) panel.close();
  panel.innerHTML = ''; panels.clear(); views.clear(); currentInvoice = null;
  afterPanelClose = null; panelOpener = null; closingPanel = false;
  lastActionFocus = null; panelActionFocus = null;
  filter = 'all'; taxMode = 'current'; clientQuery = ''; renderedHash = '';
  fiscalYears.clear();pensionContext=null;pensionDocuments=[];
  clearTimeout(notificationTimer); notice.textContent = '';
  collaborationUI.clear();
  declarationUI.clear();
  paymentsUI.clear();
  verificationUI.clear();
  importUI.clear();
  collaborations.select([]);
  workflows.clear();
  incomes.select(null);
  fiscals.select(null,null);
  declarations.select(null,null);
  payments.select(null,null);
  history.replaceState({ panel: null, origin: null, context: null }, '', location.href);
}
const collaborationUI=createCollaborationUI({service,controller:collaborations,route,access:()=>access,openPanel,done,notify,esc,button,render});
const declarationUI=createDeclarationUI({auth,service,controller:declarations,route,canConfirm,openPanel,done,notify,esc});
const paymentsUI=createPaymentsUI({auth,service,controller:payments,route,canConfirm,openPanel,done,notify,esc});
const verificationUI=createVerificationUI({auth,service,route,fiscals,payments,openPanel,done});
document.addEventListener('submit',event=>{if(event.target.id==='fact-verification-form'){event.preventDefault();void verificationUI.submit(event.target);}});
document.addEventListener('submit',event=>{if(event.target.id.startsWith('payments-')){event.preventDefault();void paymentsUI.submit(event.target,event.submitter);}});
document.addEventListener('submit',event=>{if(event.target.id==='declaration-review-form'){event.preventDefault();void declarationUI.submit(event.target);}});

const importUI=createImportUI({auth,service,positions,route,esc,openPanel,refresh:()=>cloud.refresh(),completed:async()=>{await auth.revalidate();await onboardingUI.load();await cloud.refresh();await incomes.refresh();await fiscals.refresh();}});
const onboardingUI=createOnboardingUI({auth,service,esc,button,openPanel,notify,render,positions,refresh:()=>cloud.refresh()});

auth.subscribe(next => {
  if (JSON.stringify(next) === JSON.stringify(access) && app.childElementCount) return;
  const previous = access;
  access = next;
  onboardingUI.sync();
  importUI.sync();
  const was = previous.phase === 'ready' ? previous.user.id + ':' + previous.selected.context_id : '';
  const current = next.phase === 'ready' ? next.user.id + ':' + next.selected.context_id : '';
  if (was !== current || next.phase === 'loading') clearPosition();
  if (current && was !== current) { history.replaceState({ panel: null }, '', next.selected.context_type === 'personal' ? '#/io/oggi' : '#/studio/da-fare'); entering = { hash: location.hash, at: performance.now() }; }
  render(next.phase !== 'loading');
  if (next.phase === 'signed-out' && next.message) document.querySelector('#login-password')?.focus();
});
cloud.subscribe(next => {
  if (JSON.stringify(next) === JSON.stringify(structural)) return;
  const oldIds = structural.data?.positions.map(p=>p.id) || [];
  structural = next;
  const ids = next.data?.positions.map(p=>p.id) || [];
  if (next.phase !== 'ready' || oldIds.some(id=>!ids.includes(id))) clearPosition();
  render(false);
});
incomes.subscribe(()=>{if(['entrate','oggi'].includes(route().page))render(false);});
fiscals.subscribe(()=>{if(['oggi','tasse'].includes(route().page))render(false);});
declarations.subscribe(()=>{if(route().page==='dichiarazione')render(false);});
payments.subscribe(()=>{if(route().page==='pagamenti')render(false);});
const refreshPayments=()=>{if(!document.hidden&&access.phase==='ready'&&route().page==='pagamenti'&&!panel.open)void payments.refresh();};
window.addEventListener('focus',refreshPayments);
document.addEventListener('visibilitychange',()=>{if(document.hidden)payments.invalidate();else refreshPayments();});
window.setInterval(refreshPayments,30000);
const refreshFiscal=()=>{if(!document.hidden&&access.phase==='ready'&&['oggi','tasse'].includes(route().page)&&!panel.open)void fiscals.refresh();};
window.addEventListener('focus',refreshFiscal);
document.addEventListener('visibilitychange',()=>{if(document.hidden)fiscals.invalidate();else refreshFiscal();});
window.setInterval(refreshFiscal,30000);
const refreshDeclaration=()=>{if(!document.hidden&&access.phase==='ready'&&route().page==='dichiarazione'&&!panel.open)void declarations.refresh();};
window.addEventListener('focus',refreshDeclaration);
document.addEventListener('visibilitychange',()=>{if(document.hidden)declarations.invalidate();else refreshDeclaration();});
window.setInterval(refreshDeclaration,30000);
collaborations.subscribe(()=>{if(['oggi','attivita','documenti','da-fare'].includes(route().page))render(false);});
const refreshCollaboration=()=>{if(!document.hidden&&access.phase==='ready'&&['oggi','attivita','documenti','da-fare'].includes(route().page)&&!panel.open)void collaborations.refresh();};
window.addEventListener('focus',refreshCollaboration);
document.addEventListener('visibilitychange',()=>{if(document.hidden)collaborations.clear();else {render(false);refreshCollaboration();}});
window.setInterval(refreshCollaboration,30000);
void auth.restore();

workflows.subscribe(()=>{if(access.phase==='ready')render(false);});
const refreshWorkflow=()=>{if(!document.hidden&&access.phase==='ready'&&!panel.open)void workflows.refresh();};
window.addEventListener('focus',refreshWorkflow);
document.addEventListener('visibilitychange',()=>{if(document.hidden)workflows.clear();else {render(false);refreshWorkflow();}});
window.setInterval(refreshWorkflow,30000);
