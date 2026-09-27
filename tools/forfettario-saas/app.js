import { demoService as service } from './demo-service.js';

const app = document.querySelector('#app');
const panel = document.querySelector('#panel');
const notice = document.querySelector('#notice');
const euro = value => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', useGrouping: 'always', maximumFractionDigits: value % 100 ? 2 : 0 }).format(value / 100);
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
const navItems = [['oggi', 'Oggi', 'home'], ['entrate', 'Entrate', 'income'], ['tasse', 'Tasse', 'taxes'], ['attivita', 'Attività', 'activity']];
const clientItems = navItems.map(([key, label, glyph]) => [key, key === 'oggi' ? 'Riepilogo' : label, glyph]);
const positionPages = [...navItems.map(n => n[0]), 'documenti'];
const studioItems = [['da-fare', 'Da fare', 'todo'], ['clienti', 'Clienti', 'people'], ['scadenze', 'Scadenze', 'calendar']];
let filter = 'all'; let taxMode = 'current'; let notificationTimer;
let clientQuery = '';
const views = new Map();
let renderedHash = '';
let panelSequence = 0;
const panels = new Map();
let panelOpener;
let afterPanelClose;
let closingPanel = false;
history.scrollRestoration = 'manual';
history.replaceState({ ...history.state, panel: null }, '', location.href);

function route() {
  const bits = location.hash.replace(/^#\/?/, '').split('/');
  if (bits[0] === 'io' && positionPages.includes(bits[1])) return { role: 'personal', id: 'mario', page: bits[1], client: false };
  if (bits[0] === 'studio') {
    if (bits[1] === 'clienti' && bits[2] && service.listClients().some(p => p.id === bits[2]) && positionPages.includes(bits[3])) return { role: 'studio', id: bits[2], page: bits[3], client: true };
    if (studioItems.some(n => n[0] === bits[1]) && !bits[2]) return { role: 'studio', page: bits[1], client: false };
  }
  return { role: 'entry', page: 'ingresso' };
}
const href = (r, page) => r.client ? `#/studio/clienti/${r.id}/${page}` : `#/io/${page}`;
const link = (url, text, cls = 'text-link', arrow = true, attributes = '') => `<a class="${cls}" href="${url}" ${attributes}>${text}${arrow ? icon('arrow') : ''}</a>`;
const button = (action, text, options = '') => `<button class="button" type="button" data-action="${action}" ${options}>${text}</button>`;
function nav(items, base, current, name, cls = '') { return `<nav aria-label="${name}" class="primary-nav ${cls}">${items.map(([key, label, glyph]) => `<a class="nav-link" href="${base}/${key}" ${key === current ? 'aria-current="page"' : ''}>${icon(glyph)}<span>${label}</span></a>`).join('')}</nav>`; }
function heading(title, text = '', actions = '') { return `<div class="heading"><div><h1>${title}</h1>${text ? `<p>${text}</p>` : ''}</div>${actions ? `<div class="actions">${actions}</div>` : ''}</div>`; }
function footer() { return '<p class="page-footer">Anteprima con dati di esempio · Nessun dato viene inviato o conservato alla chiusura.</p>'; }

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
  render(true);
  window.scrollTo(0, saved?.scroll || 0);
}
function navigate(url, { open, focus } = {}) {
  const proceed = () => {
    rememberView();
    const r = route();
    const source = r.role === 'studio' && !r.client ? { href: location.hash, label: studioItems.find(n => n[0] === r.page)?.[1] || 'Clienti' } : r.client ? origin() : null;
    history.pushState({ origin: source, panel: null, context: focus === 'payment-context' ? focus : null }, '', url);
    showRoute(focus);
    if (focus) focusContext(focus);
    if (open) action(open, document.querySelector('#main'));
  };
  if (panel.open) closePanel(proceed); else proceed();
}

function entry() {
  return `<div class="entry"><header class="entry-header">${brand()}<span class="demo-label">Anteprima · dati di esempio</span></header><main class="entry-main" id="main" tabindex="-1"><div><p class="eyebrow">Il tuo forfettario, più semplice</p><h1 class="entry-title">Il tuo lavoro,<br><em>con meno pensieri.</em></h1><p class="entry-copy">Entrate, tasse e documenti. Tutto al suo posto, insieme al tuo commercialista.</p></div><div><div class="entry-choices"><a class="role-choice" href="#/io/oggi"><div class="choice-top"><span class="choice-icon">${icon('person')}</span>${icon('arrow')}</div><h2>Sono un forfettario</h2><p>Gestisci entrate, tasse e documenti senza complicazioni.</p></a><a class="role-choice" href="#/studio/da-fare"><div class="choice-top"><span class="choice-icon">${icon('briefcase')}</span>${icon('arrow')}</div><h2>Sono un commercialista</h2><p>Vedi subito quali clienti hanno bisogno di te.</p></a></div><p class="entry-privacy">${icon('lock')}Esplora liberamente. Qui usiamo solo esempi.</p></div></main><footer class="entry-footer"><span>Tax Automation Lab</span><span>Preview S06 · Nessun account richiesto</span></footer></div>`;
}

function shell(r, content) {
  const studio = r.role === 'studio';
  const p = r.id ? service.getPosition(r.id) : null;
  const activePage = r.page === 'documenti' ? 'attivita' : r.page;
  const clientHeader = r.client ? `<div class="client-bar"><span class="desktop-return">${returnLink()}</span><span class="avatar">${p.initials}</span><div class="row-main"><strong>${p.name}</strong><small>${p.talId} · ${p.profession}</small></div></div><nav class="client-nav" aria-label="Posizione cliente">${clientItems.map(([key, label]) => `<a href="${href(r, key)}" ${activePage === key ? 'aria-current="page"' : ''}>${label}</a>`).join('')}</nav>` : '';
  return `<div class="${r.client ? 'client-mode' : ''}"><aside class="rail"><div class="rail-brand">${brand()}</div><p class="eyebrow rail-label">${studio ? 'Studio Rossi' : 'Il tuo forfettario'}</p>${nav(studio ? studioItems : navItems, studio ? '#/studio' : '#/io', r.client ? 'clienti' : activePage, 'Principale')}<div class="rail-bottom"><div class="profile"><span class="avatar">${studio ? 'GR' : 'MR'}</span><div><strong>${studio ? 'Giulia' : 'Mario Rossi'}</strong><span class="small muted">${studio ? 'Studio Rossi' : 'Consulente'}</span></div></div></div></aside><div class="shell"><header class="topbar"><div class="mobile-brand">${brand()}</div><span class="small muted desktop-date">Domenica, 27 settembre 2026</span><div class="demo-tools"><span class="demo-label">Demo · dati di esempio</span><button class="demo-switch" type="button" data-action="switch">Cambia ruolo</button></div></header><main class="page" id="main" tabindex="-1">${clientHeader}${content}${footer()}</main></div>${r.client ? `<div class="mobile-client-nav">${returnLink('text-link context-return')}${nav(clientItems, `#/studio/clienti/${r.id}`, activePage, 'Posizione cliente mobile')}</div>` : ''}</div>`;
}

const reserveMeaning = 'La riserva stima imposte e contributi sugli incassi considerati, tenendo conto dei versamenti indicati. Non misura il denaro già messo da parte.';
const paymentMeaning = 'Il pagamento previsto riguarda una scadenza specifica. In questa demo non è stabilito quanto del pagamento rientri nella riserva: non usarli per ricavare un totale.';
function amountMeaning() { return `<details class="amount-meaning"><summary>Riserva e pagamento: la differenza</summary><p>${reserveMeaning}</p><p>${paymentMeaning}</p></details>`; }
function receipt(p) { return p.documents.find(d => d.id === p.request.documentId); }
function documentButton(d) { return d ? button('document', icon('file')+'Apri documento', `data-document="${d.id}"`) : ''; }
function requestAction(r, p) {
  if (p.request.state === 'todo') return r.role === 'studio' ? '<p class="muted small">In attesa del cliente.</p>' : button('upload-request', icon('upload')+'Carica documento');
  if (r.role === 'studio' && p.request.state === 'submitted') return button('review', 'Verifica documento');
  return documentButton(receipt(p));
}
function requestState(r, p) {
  if (p.request.state === 'todo') return '';
  if (p.request.state === 'submitted') return r.role === 'studio' ? 'Documento ricevuto. Da verificare.' : 'Ricevuta inviata. Ora la controlla Studio Rossi.';
  return `Ricevuta verificata da ${p.request.completedBy || 'Studio Rossi'}.`;
}
function deadlineStrip(r) {
  return `<section class="deadline-strip" aria-label="Prossimo pagamento previsto"><div class="deadline-detail"><div class="date-tile"><strong>30</strong><span>nov</span></div><div><p class="eyebrow">Prossimo pagamento previsto</p><h3>Acconti di novembre</h3><p class="muted small">Imposte e contributi</p></div></div><div class="deadline-end"><strong class="money">${euro(214000)}</strong>${link(href(r, 'tasse'), 'Dettaglio pagamento', 'text-link', false, 'data-focus="payment-detail"')}</div></section>`;
}
function today(r, p) {
  const studio = r.role === 'studio';
  const discrepancy = studio && p.issue === 'difference' && !p.differenceResolved;
  const actionable = discrepancy || (studio ? p.request.state === 'submitted' : p.request.state === 'todo');
  let task;
  if (actionable) {
    task = `<section class="task-card" id="current-task" tabindex="-1"><span class="task-label">${icon('todo')}${studio ? 'Da fare' : 'Da fare · Studio Rossi'}</span><h2>${discrepancy ? 'Un versamento da controllare' : 'Ricevuta contributi'}</h2>${discrepancy ? '<p>Il cliente ha indicato 320 € in più rispetto alla ricevuta.</p>'+button('difference', 'Controlla differenza') : requestAction(r, p)}</section>`;
  } else {
    const text = p.request.state === 'submitted' ? requestState(r,p) : p.request.state === 'todo' ? 'Ricevuta richiesta. In attesa del cliente.' : 'Nessuna attività da svolgere.';
    task = `<div class="task-status"><p>${text}</p>${p.request.state !== 'completed' ? link(href(r,'attivita'),'Apri attività','text-link',false) : ''}</div>`;
  }
  return `${heading(studio ? 'Riepilogo di '+p.firstName : 'Buongiorno, Mario.')}<div class="today-grid"><section class="income-hero" aria-label="Incassi e riserva fiscale"><div class="income-line"><div><p class="eyebrow">Incassati nel 2026</p><strong class="hero-amount money">${euro(p.received)}</strong></div>${link(href(r, 'entrate'), 'Vedi entrate')}</div><div class="reserve"><div><p class="reserve-label">Riserva fiscale stimata</p><strong class="amount money">${p.tax ? euro(p.tax.current.reserve) : 'Da definire'}</strong><p>${p.tax ? 'Su '+euro(p.tax.current.income)+' incassati'+(p.received !== p.tax.current.income ? ' · stima iniziale della demo' : '') : 'Stima non disponibile nella demo'}</p></div>${link(href(r,'tasse'),'Dettaglio riserva','text-link',false,'data-focus="reserve-detail"')}</div>${p.tax ? amountMeaning() : ''}</section>${task}${p.tax ? deadlineStrip(r) : ''}</div>`;
}

function invoiceRows(p) {
  const list = p.invoices.filter(i => filter !== 'outstanding' || i.paid < i.total);
  if (!list.length) return '<p class="empty">Non ci sono importi da incassare.</p>';
  return list.map(i => `<article class="row"><div class="row-main"><h3>Fattura ${esc(i.number)}</h3><p>${esc(i.customer)} · ${new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(i.date))}</p></div><div class="row-end"><strong class="money">${euro(i.total)}</strong><span class="payment-state ${i.paid === i.total ? 'paid' : ''}">${i.paid === i.total ? 'Incassata' : i.paid ? `${euro(i.paid)} incassati` : 'Da incassare'}</span></div><div class="row-action">${i.paid < i.total ? button('payment', 'Registra incasso', `data-invoice="${i.id}"`) : ''}</div></article>`).join('');
}
function income(r, p) {
  return `${heading('Entrate', 'Fatture e incassi, senza perdere il filo.', `${button('add-invoice', icon('plus')+'Aggiungi fattura')}<button class="button secondary" data-action="import" type="button">${icon('upload')}Importa fatture</button>`)}<div class="summary-inline"><div><span>Incassati nel 2026</span><strong class="money">${euro(p.received)}</strong></div><div><span>Da incassare</span><strong class="money">${euro(p.outstanding)}</strong></div></div><div class="filterbar" aria-label="Filtra fatture"><button class="chip" aria-pressed="${filter === 'all'}" data-filter="all">Tutte</button><button class="chip" aria-pressed="${filter === 'outstanding'}" data-filter="outstanding">Da incassare</button></div><div class="list" id="invoice-list">${invoiceRows(p)}</div>`;
}

function taxes(r, p) {
  if (!p.tax) return `${heading('Tasse e contributi')}<p class="empty">Per questo cliente non abbiamo aggiunto stime nella demo. La posizione di Mario include un esempio completo.</p>`;
  const forecast = r.role === 'personal' && taxMode === 'forecast'; const t = p.tax[forecast ? 'forecast' : 'current'];
  return `${heading('Tasse e contributi')}${r.role === 'personal' ? `<div class="segmented" aria-label="Periodo della stima"><button data-tax="current" aria-pressed="${!forecast}">Situazione attuale</button><button data-tax="forecast" aria-pressed="${forecast}">Previsione di fine anno</button></div>` : ''}<div class="tax-layout"><section><div class="tax-total" id="reserve-detail" tabindex="-1"><p class="eyebrow">Riserva fiscale stimata${forecast ? ' · a fine anno' : ''}</p><strong class="amount money">${euro(t.reserve)}</strong><p>${forecast ? `Se a fine anno avrai incassato ${euro(t.income)}. È un’ipotesi, non un importo già dovuto.` : `Su ${euro(t.income)} incassati. Considera già ${euro(t.paid)} di contributi versati.`}</p></div>${amountMeaning()}<div class="breakdown"><div><span>Imposta sostitutiva</span><strong class="money">${euro(t.tax)}</strong></div><div><span>Contributi</span><strong class="money">${euro(t.contributions)}</strong></div><div><span>Contributi già versati</span><strong class="money">− ${euro(t.paid)}</strong></div></div><details class="tax-detail"><summary>${icon('chevron')}Dettaglio della stima</summary><p>Esempio: consulente in Gestione Separata, senza altra copertura previdenziale, imposta al 15%. I contributi versati indicati nell’esempio riducono il reddito su cui stimare l’imposta e la riserva fiscale stimata.</p><dl><dt>Incassi considerati</dt><dd>${euro(t.income)}</dd><dt>Coefficiente di redditività</dt><dd>78%</dd><dt>Aliquota previdenziale dell’esempio</dt><dd>26,07%</dd></dl><p>Importi dimostrativi al 27 settembre 2026. Le azioni simulate sulle entrate non ricalcolano questa stima. Il pagamento di novembre è un esempio distinto.</p></details></section><section id="payment-detail" class="payment-detail" tabindex="-1"><h2>Prossimo pagamento previsto</h2><div class="calendar-row"><div class="date-tile"><strong>30</strong><span>nov</span></div><div class="row-main"><h3>Acconti di novembre</h3><p>30 novembre 2026 · Imposte e contributi</p></div><strong class="money">${euro(214000)}</strong></div><p class="calendar-note">${r.role === 'studio' ? 'Importo previsto da controllare prima del versamento.' : 'Lo Studio confermerà l’importo prima del versamento.'}</p>${link(href(r,'attivita'),r.role === 'studio' ? 'Apri attività sul pagamento' : 'Chiedi allo Studio','text-link',true,'data-focus="payment-context"')}</section></div>`;
}

function documents(r, p) {
  return `${link(href(r,'attivita'),icon('back')+'Torna ad Attività','text-link archive-back',false)}${heading('Archivio documenti')}<div class="section-line"><span class="small muted">2026</span>${r.role === 'personal' ? '<button class="button secondary" type="button" data-action="upload-other">'+icon('plus')+'Aggiungi un altro documento</button>' : ''}</div><div class="list document-list">${p.documents.map(d => `<article class="row"><span class="doc-icon">${icon('file')}</span><div class="row-main"><h3>${d.name}</h3><p>${d.date} · PDF di esempio</p><span class="uploaded-label">${d.state === 'completed' ? icon('check')+'Verificato dallo Studio' : d.kind === 'receipt' ? 'In attesa di verifica dello Studio' : 'Condiviso con lo Studio'}</span></div><button class="icon-button" type="button" data-action="document" data-document="${d.id}" aria-label="Apri ${d.name}">${icon('arrow')}</button></article>`).join('')}</div>`;
}

function activity(r, p) {
  const paymentContext = history.state?.context === 'payment-context';
  return `${heading('Attività','',link(href(r,'documenti'),'Archivio documenti','text-link',false))}<div class="feed"><article class="feed-item"><span class="avatar">SR</span><div class="feed-meta"><strong>Studio Rossi</strong><time>${p.request.created}</time></div><p class="message">${p.request.text}</p><div class="feed-request">${p.request.state !== 'todo' ? '<p class="state-line">'+requestState(r,p)+'</p>' : ''}${requestAction(r,p)}</div></article>${p.messages.map(m => `<article class="feed-item"><span class="avatar ${m.from === 'you' ? 'warm' : ''}">${m.from === 'you' ? p.initials : 'SR'}</span><div class="feed-meta"><strong>${m.from === 'you' ? (r.role === 'personal' ? 'Tu' : p.name) : 'Studio Rossi'}</strong><time>${m.date}</time></div><p class="message">${esc(m.text)}</p>${m.context === 'payment-context' ? '<p class="message-context">Acconti di novembre · 30 novembre 2026 · '+euro(214000)+'</p>' : ''}${m.documentId && m.documentId !== p.request.documentId ? documentButton(p.documents.find(d=>d.id===m.documentId)) : ''}</article>`).join('')}</div><form class="composer" id="message-form">${paymentContext ? '<div class="message-context" id="payment-context" tabindex="-1">Acconti di novembre · 30 novembre 2026 · '+euro(214000)+'</div>' : ''}<label for="message">${r.role === 'studio' ? 'Scrivi al cliente' : 'Scrivi allo Studio'}</label><textarea id="message" name="message" rows="3" maxlength="500" required placeholder="Aggiungi un messaggio…"></textarea><div class="actions">${button('send', 'Invia messaggio', 'id="send-message"')}</div></form>`;
}

function todo() {
  const attention = service.listAttention();
  const active = attention.filter(p => p.request.state === 'submitted' || (p.issue === 'difference' && !p.differenceResolved));
  const waiting = attention.filter(p => !active.includes(p));
  return `${heading('Da fare',active.length ? active.length+(active.length === 1 ? ' cliente su cui intervenire.' : ' clienti su cui intervenire.') : 'Nessuna attività da svolgere.')}<div class="attention-list">${active.map(p => {
    const difference = p.issue === 'difference' && !p.differenceResolved;
    return `<article class="attention-row"><span class="avatar">${p.initials}</span><div class="row-main"><h2>${p.name}</h2><p>${difference ? 'Un versamento da chiarire' : 'Ricevuta contributi · da verificare'}</p></div>${link(`#/studio/clienti/${p.id}/${difference ? 'oggi' : 'attivita'}`,difference ? 'Controlla differenza' : 'Verifica documento','button secondary',false,`data-open="${difference ? 'difference' : 'review'}"`)}</article>`;
  }).join('')}</div>${waiting.length ? '<section class="waiting-list"><h2>In attesa del cliente</h2>'+waiting.map(p=>'<div class="waiting-row"><div><strong>'+p.name+'</strong><p>Ricevuta contributi richiesta</p></div>'+link('#/studio/clienti/'+p.id+'/attivita','Apri attività','text-link',false)+'</div>').join('')+'</section>' : ''}`;
}

function clientRows(query = '') {
  const clients = service.listClients().filter(p => `${p.name} ${p.talId}`.toLowerCase().includes(query.toLowerCase()));
  return clients.length ? clients.map(p => `<a class="client-link" href="#/studio/clienti/${p.id}/oggi"><span class="avatar">${p.initials}</span><div class="row-main"><h2>${p.name}</h2><p>${p.profession} · <span class="tal-id">${p.talId}</span></p></div>${p.request.state !== 'completed' ? `<span class="client-status">${p.request.state === 'submitted' ? 'Documento ricevuto' : 'Documento atteso'}</span>` : ''}${icon('chevron')}</a>`).join('') : '<p class="empty">Nessun cliente trovato. Prova con il nome o l’ID TAL.</p>';
}
function clients() { return `${heading('Clienti')}<label class="search">${icon('search')}<input id="client-search" type="search" aria-label="Cerca un cliente per nome o ID TAL" placeholder="Cerca per nome o ID TAL" autocomplete="off" value="${esc(clientQuery)}"></label><div class="list" id="client-list">${clientRows(clientQuery)}</div><p class="small muted" id="search-status" role="status"></p>`; }
function deadlines() { return `${heading('Scadenze')}<p class="eyebrow">Novembre 2026</p><article class="calendar-row"><div class="date-tile"><strong>30</strong><span>nov</span></div><div class="row-main"><h2>Acconti di novembre</h2><p>Mario Rossi · imposte e contributi</p>${link('#/studio/clienti/mario/tasse','Dettaglio pagamento','text-link',true,'data-focus="payment-detail"')}</div><strong class="money">${euro(214000)}</strong></article><p class="calendar-note">Le altre posizioni non hanno scadenze aggiunte in questa demo.</p>`; }

function render(focus = false) {
  const r = route();
  renderedHash = location.hash;
  document.title = `${r.role === 'entry' ? 'Benvenuto' : r.page === 'documenti' ? 'Archivio documenti' : r.client && r.page === 'oggi' ? 'Riepilogo' : [...navItems, ...studioItems].find(n => n[0] === r.page)?.[1] || 'TAL'} · TAL — Anteprima`;
  if (r.role === 'entry') app.innerHTML = entry();
  else {
    let content;
    if (r.id) {
      const p = service.getPosition(r.id);
      content = ({ oggi: today, entrate: income, tasse: taxes, documenti: documents, attivita: activity })[r.page](r, p);
    } else content = ({ 'da-fare': todo, clienti: clients, scadenze: deadlines })[r.page]();
    app.innerHTML = shell(r, content);
  }
  if (focus) document.querySelector('#main').focus({ preventScroll: true });
}

function notify(message) { clearTimeout(notificationTimer); notice.textContent = message; notificationTimer = setTimeout(() => { notice.textContent = ''; }, 5500); }
function openPanel(title, body, restoring = false) {
  if (!restoring) {
    rememberView();
    panelOpener = document.activeElement;
    const key = ++panelSequence;
    panels.set(key, { title, body });
    history.pushState({ ...history.state, panel: key }, '', location.href);
  }
  panel.innerHTML = `<div class="dialog-head"><h2 id="panel-title">${title}</h2><button class="icon-button" aria-label="Chiudi" type="button" data-action="close">${icon('close')}</button></div><div class="dialog-body">${body}</div>`;
  panel.showModal();
}
function closePanel(after) {
  if (closingPanel) return;
  if (!panel.open) { after?.(); return; }
  afterPanelClose = after;
  closingPanel = true;
  if (history.state?.panel) history.back();
  else { panel.close(); closingPanel = false; afterPanelClose = null; after?.(); }
}
function done(message) {
  const scroll = window.scrollY;
  panels.delete(history.state?.panel);
  closePanel(() => { render(true); window.scrollTo(0, scroll); notify(message); });
}
function syntheticFile(name) { return `<div class="demo-file"><span class="example-stamp">SYNTHETIC TEST DATA</span><div class="doc-icon">${icon('file')}</div><h3>${name}</h3><p>Documento fittizio per esplorare la preview. Non è una ricevuta valida e non contiene dati personali reali.</p></div>`; }
function readAmount(form) {
  const raw = new FormData(form).get('amount').trim().replace(',', '.');
  if (!/^\d{1,6}(\.\d{1,2})?$/.test(raw)) throw new Error('Usa un importo positivo, con al massimo due decimali.');
  return Math.round(Number(raw) * 100);
}
function moneyForm(action, label, initial, description) { return `<form id="amount-form" data-command="${action}" novalidate><div class="field"><label for="amount">${label}</label><input id="amount" name="amount" inputmode="decimal" value="${initial}" aria-describedby="amount-help form-error" autocomplete="off"><p id="amount-help">${description}</p></div><p class="error" id="form-error" tabindex="-1" role="alert"></p><button class="button" type="submit">${action === 'payment-save' ? 'Registra incasso' : 'Aggiungi fattura'}</button></form>`; }
let currentInvoice;
async function action(name, element) {
  const r = route(); const p = r.id ? service.getPosition(r.id) : null;
  switch (name) {
    case 'switch': navigate('#/ingresso'); break;
    case 'close': closePanel(); break;
    case 'upload-request': case 'upload-other':
      openPanel(name === 'upload-request' ? 'Carica la ricevuta' : 'Aggiungi un documento', `<p>Per questa prova abbiamo preparato un documento di esempio. Non selezionare file personali.</p>${syntheticFile(name === 'upload-request' ? 'Ricevuta contributi · esempio' : 'Documento di esempio')}${button(name === 'upload-request' ? 'upload-save-request' : 'upload-save-other', icon('upload')+'Usa documento di esempio')}`); break;
    case 'upload-save-request': case 'upload-save-other': {
      const token = history.state?.panel;
      element.disabled = true; element.textContent = 'Aggiunta in corso…';
      await new Promise(resolve => setTimeout(resolve, 280));
      if (!panel.open || closingPanel || token !== history.state?.panel) return;
      service.uploadExample(r.id, name === 'upload-save-request'); done(name === 'upload-save-request' ? 'Ricevuta inviata. Ora la controlla Studio Rossi.' : 'Documento aggiunto all’archivio. Le richieste aperte restano invariate.'); break;
    }
    case 'review':
      openPanel('Verifica la ricevuta', `<p>${p.name} ha condiviso questo documento. Nella demo puoi simularne la verifica.</p>${syntheticFile('Ricevuta contributi')}${button('review-save', icon('check')+'Segna verificato')}`); break;
    case 'review-save': service.completeRequest(r.id); done('Ricevuta verificata. Il cliente vede l’aggiornamento.'); break;
    case 'document': {
      const d = p.documents.find(d => d.id === element.dataset.document);
      if (!d) return;
      openPanel(d.name, `<p>${r.role === 'studio' ? p.name+' · ' : ''}${d.state === 'completed' ? 'Verificato dallo Studio.' : d.kind === 'receipt' ? 'In attesa di verifica dello Studio.' : 'Condiviso con lo Studio.'}</p>${syntheticFile(d.name)}<p>Anteprima simulata: nessun file viene scaricato.</p>${link(href(r,'documenti'),'Archivio documenti','text-link',false)}`); break;
    }
    case 'add-invoice': openPanel('Una nuova fattura', `<p>Prova l’aggiunta rapida. Cliente, numero e data sono già compilati con dati di esempio.</p>${moneyForm('invoice-save', 'Importo della fattura (€)', '1200', 'Cliente di esempio · 27 settembre 2026')}`); break;
    case 'payment': {
      currentInvoice = p.invoices.find(i => i.id === element.dataset.invoice);
      openPanel('Registra un incasso', `<p>Fattura ${esc(currentInvoice.number)} · ${esc(currentInvoice.customer)}</p>${moneyForm('payment-save', 'Quanto hai ricevuto? (€)', String((currentInvoice.total - currentInvoice.paid) / 100).replace('.', ','), `Restano ${euro(currentInvoice.total - currentInvoice.paid)} da incassare. Data di esempio: oggi.`)}`); break;
    }
    case 'import': openPanel('Importa una fattura', `<p>In futuro potrai usare XML, CSV o Excel. Qui puoi provare l’esito con una fattura di esempio, senza caricare file reali.</p><div class="demo-file"><h3>Laboratorio Acero</h3><p>Fattura IMP/2026 · 26 settembre</p><strong class="money">950 €</strong><p>Da incassare</p></div>${button('import-save', 'Importa esempio')}`); break;
    case 'import-save': { const added = service.importExample(r.id); done(added ? 'Fattura importata. Nessun incasso aggiunto.' : 'Questa fattura è già presente. Nessun duplicato.'); break; }
    case 'send': document.querySelector('#message-form').requestSubmit(); break;
    case 'difference': openPanel('Un versamento da chiarire', `<p>${p.name} ha indicato 320 € in più rispetto alla ricevuta. Nell’esempio si tratta del saldo dell’anno precedente.</p>${syntheticFile('Nota del cliente · esempio')}${button('difference-save', 'Segna controllato')}`); break;
    case 'difference-save': service.resolveDifference(r.id); done('Differenza controllata. La nota è in Attività.'); break;
  }
}

document.addEventListener('click', event => {
  if (event.target.closest('.skip')) { event.preventDefault(); document.querySelector('#main').focus(); return; }
  const anchor = event.target.closest('a[href^="#/"]');
  if (anchor && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey && event.button === 0) {
    event.preventDefault();
    navigate(anchor.getAttribute('href'), { open: anchor.dataset.open, focus: anchor.dataset.focus });
    return;
  }
  const target = event.target.closest('[data-action],[data-filter],[data-tax]');
  if (!target) return;
  if (target.dataset.action) action(target.dataset.action, target).catch(() => notify('Operazione non completata. Riprova.'));
  if (target.dataset.filter) { filter = target.dataset.filter; render(); document.querySelector(`[data-filter="${filter}"]`).focus(); }
  if (target.dataset.tax) { taxMode = target.dataset.tax; render(); document.querySelector(`[data-tax="${taxMode}"]`).focus(); }
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
document.addEventListener('submit', event => {
  event.preventDefault(); const r = route();
  if (event.target.id === 'message-form') {
    const input = document.querySelector('#message');
    if (!input.value.trim()) { input.setCustomValidity('Scrivi un messaggio.'); input.reportValidity(); input.addEventListener('input', () => input.setCustomValidity(''), { once: true }); return; }
    service.sendMessage(r.id, r.role === 'studio' ? 'studio' : 'you', input.value, history.state?.context);
    render(); document.querySelector('#message').focus(); notify('Messaggio inviato nella demo.');
  }
  if (event.target.id === 'amount-form') {
    try {
      const amount = readAmount(event.target);
      if (event.target.dataset.command === 'payment-save') service.recordPayment(r.id, currentInvoice.id, amount);
      else service.addInvoice(r.id, amount);
      done(event.target.dataset.command === 'payment-save' ? 'Incasso registrato.' : 'Fattura aggiunta.');
    } catch (error) {
      const message = document.querySelector('#form-error'); message.textContent = error.message; document.querySelector('#amount').setAttribute('aria-invalid', 'true'); document.querySelector('#amount').focus();
    }
  }
});
panel.addEventListener('keydown', event => {
  if (event.key !== 'Tab') return;
  const controls = [...panel.querySelectorAll('button:not(:disabled),input,textarea,a[href]')].filter(e => e.getClientRects().length);
  const first = controls[0], last = controls.at(-1);
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
});
panel.addEventListener('cancel', event => { event.preventDefault(); closePanel(); });
window.addEventListener('scroll', rememberView, { passive: true });
window.addEventListener('popstate', () => {
  const wasOpen = panel.open;
  if (wasOpen) panel.close();
  closingPanel = false;
  const callback = afterPanelClose; afterPanelClose = null;
  if (location.hash !== renderedHash) showRoute();
  if (history.state?.panel) {
    const cached = panels.get(history.state.panel);
    if (cached) openPanel(cached.title, cached.body, true);
    else history.replaceState({ ...history.state, panel: null }, '', location.href);
  } else if (wasOpen && !callback) {
    if (panelOpener?.isConnected) panelOpener.focus({ preventScroll: true });
    else document.querySelector('#main').focus({ preventScroll: true });
  }
  callback?.();
});
window.addEventListener('hashchange', () => { if (location.hash !== renderedHash) showRoute(); });
render();
