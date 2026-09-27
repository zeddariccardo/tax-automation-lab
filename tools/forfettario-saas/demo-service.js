// S06: synthetic fixtures and an in-memory adapter. No credentials, storage or network.
// UI reads view models; a later adapter can implement these methods with real services.
const people = [
  { id: 'mario', name: 'Mario Rossi', firstName: 'Mario', initials: 'MR', talId: 'TAL-A8F31C2D', profession: 'Consulente', issue: 'upload' },
  { id: 'laura', name: 'Laura Bianchi', firstName: 'Laura', initials: 'LB', talId: 'TAL-B7E20D4A', profession: 'Designer', issue: 'review' },
  { id: 'andrea', name: 'Andrea Verdi', firstName: 'Andrea', initials: 'AV', talId: 'TAL-C6D19E3B', profession: 'Consulente', issue: 'difference' },
  { id: 'elena', name: 'Elena Neri', firstName: 'Elena', initials: 'EN', talId: 'TAL-D5C08F2E', profession: 'Traduttrice', issue: null },
];

const taxSnapshots = {
  current: { income: 3124000, tax: 298008, contributions: 635253, paid: 450000, reserve: 483261 },
  forecast: { income: 4200000, tax: 423900, contributions: 854053, paid: 450000, reserve: 827953 },
};

function position(person) {
  const example = person.id === 'mario';
  return {
    ...person,
    invoices: example ? [
      { id: 'inv-5', number: '05/2026', customer: 'Progetto Cedro', date: '2026-09-23', total: 120000, paid: 120000 },
      { id: 'inv-4', number: '04/2026', customer: 'Officina Lume', date: '2026-09-15', total: 120000, paid: 80000 },
      { id: 'inv-3', number: '03/2026', customer: 'Progetto Cedro', date: '2026-07-03', total: 624000, paid: 624000 },
      { id: 'inv-2', number: '02/2026', customer: 'Studio Quercia', date: '2026-04-10', total: 980000, paid: 980000 },
      { id: 'inv-1', number: '01/2026', customer: 'Officina Lume', date: '2026-02-18', total: 1320000, paid: 1320000 },
    ] : [{ id: `inv-${person.id}`, number: '01/2026', customer: 'Progetto Cedro', date: '2026-09-10', total: 180000, paid: 180000 }],
    tax: example ? structuredClone(taxSnapshots) : null,
    request: { state: person.issue === 'review' ? 'submitted' : person.issue === 'upload' ? 'todo' : 'completed', documentId: person.issue !== 'upload' ? `receipt-${person.id}` : null, title: 'Ricevuta contributi', text: 'Ci serve la ricevuta dei contributi versati.', created: '25 settembre', completedBy: null },
    documents: [
      ...(person.issue !== 'upload' ? [{ id: `receipt-${person.id}`, name: 'Ricevuta contributi', kind: 'receipt', state: person.issue === 'review' ? 'submitted' : 'completed', date: 'Oggi' }] : []),
      { id: `previous-${person.id}`, name: 'Documentazione previdenziale', kind: 'archive', state: 'completed', date: '12 settembre' },
    ],
    messages: [],
    differenceResolved: false,
  };
}

export function createDemoService() {
const state = new Map(people.map(p => [p.id, position(p)]));
let sequence = 0;
const clone = value => structuredClone(value);
function get(id) { const p = state.get(id); if (!p) throw new Error('Posizione non disponibile.'); return p; }

const demoService = {
  reset() { state.clear(); for (const person of people) state.set(person.id, position(person)); sequence = 0; },
  getPosition(id) {
    const p = get(id);
    return clone({ ...p, received: p.invoices.reduce((n, i) => n + i.paid, 0), outstanding: p.invoices.reduce((n, i) => n + i.total - i.paid, 0) });
  },
  listClients() { return people.map(p => this.getPosition(p.id)); },
  listAttention() {
    return this.listClients().filter(p => p.request.state !== 'completed' || (p.issue === 'difference' && !p.differenceResolved));
  },
  uploadExample(id, requested = true) {
    const p = get(id);
    if (requested && p.request.state !== 'todo') return;
    const documentId = `demo-doc-${++sequence}`;
    p.documents.unshift({ id: documentId, name: requested ? 'Ricevuta contributi' : 'Documento di esempio', kind: requested ? 'receipt' : 'archive', state: 'submitted', date: 'Oggi' });
    if (requested) { p.request.state = 'submitted'; p.request.documentId = documentId; }
    p.messages.push({ from: 'you', text: requested ? 'Ho caricato la ricevuta dei contributi.' : 'Ho condiviso un documento.', date: 'Oggi', documentId });
  },
  completeRequest(id) {
    const p = get(id); if (p.request.state !== 'submitted') throw new Error('Il documento non è ancora arrivato.');
    p.request.state = 'completed'; p.request.completedBy = 'Giulia · Studio Rossi';
    p.documents.find(d => d.id === p.request.documentId).state = 'completed';
    p.messages.push({ from: 'studio', text: 'Perfetto, grazie. Abbiamo verificato la ricevuta.', date: 'Oggi' });
  },
  sendMessage(id, from, text, context = null) { const value = text.trim(); if (!value || value.length > 500) throw new Error('Scrivi un messaggio di massimo 500 caratteri.'); get(id).messages.push({ from, text: value, date: 'Oggi', context: context === 'payment-context' ? context : null }); },
  recordPayment(id, invoiceId, amount) {
    const invoice = get(id).invoices.find(i => i.id === invoiceId);
    if (!invoice || !Number.isSafeInteger(amount) || amount <= 0 || amount > invoice.total - invoice.paid) throw new Error('Inserisci un importo entro il residuo da incassare.');
    invoice.paid += amount;
  },
  addInvoice(id, amount) {
    if (!Number.isSafeInteger(amount) || amount <= 0 || amount > 10000000) throw new Error('Inserisci un importo tra 0,01 e 100.000 euro.');
    const p = get(id);
    p.invoices.unshift({ id: `manual-${++sequence}`, number: `${String(p.invoices.length + 1).padStart(2, '0')}/2026`, customer: 'Cliente di esempio', date: '2026-09-27', total: amount, paid: 0 });
  },
  importExample(id) { const p = get(id); if (p.invoices.some(i => i.id === 'import-example')) return false; p.invoices.unshift({ id: 'import-example', number: 'IMP/2026', customer: 'Laboratorio Acero', date: '2026-09-26', total: 95000, paid: 0 }); return true; },
  resolveDifference(id) { const p = get(id); p.differenceResolved = true; p.messages.push({ from: 'studio', text: 'Differenza controllata: il versamento si riferisce al saldo precedente.', date: 'Oggi' }); },
};
return demoService;
}
export const demoService = createDemoService();
