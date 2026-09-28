// Operational amounts only. No tax, pension or forecast calculations.
export const incomeProblem = code => Object.assign(new Error(code), { code });
export function cents(value) {
  if (!Number.isSafeInteger(value) || value < 0) throw incomeProblem('invalid');
  return value;
}
export function sumCents(values) {
  if (values.some(v => v === null)) return null;
  const total = values.reduce((s, v) => s + BigInt(cents(v)), 0n);
  if (total > BigInt(Number.MAX_SAFE_INTEGER)) throw incomeProblem('invalid');
  return Number(total);
}
export function parseAmount(value) {
  const match = /^(\d{1,14})(?:[.,](\d{1,2}))?$/.exec(String(value).trim());
  if (!match) throw incomeProblem('amount');
  const n = BigInt(match[1]) * 100n + BigInt((match[2] || '').padEnd(2, '0'));
  if (n <= 0n || n > BigInt(Number.MAX_SAFE_INTEGER)) throw incomeProblem('amount');
  return Number(n);
}
export function amountInput(value) { cents(value); return String(BigInt(value) / 100n) + ',' + String(BigInt(value) % 100n).padStart(2, '0'); }
export function formatCents(value) {
  if (!Number.isSafeInteger(value)) throw incomeProblem('invalid');
  const n=BigInt(value),abs=n<0n?-n:n,remainder=abs%100n;
  return (n<0n?'-':'')+new Intl.NumberFormat('it-IT',{useGrouping:'always'}).format(abs/100n)+(remainder?','+String(remainder).padStart(2,'0'):'')+'\u00a0€';
}
export function isoDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0,10) !== value) throw incomeProblem('date');
  return value;
}
export function projectIncome({ workspace, invoices, components, payments, allocations, activities,creditNotes=[],creditNoteLines=[],refunds=[] }, year) {
  const inScope = rows => rows.every(r => r.workspace_id === workspace.id);
  if (![invoices, components, payments, allocations, activities,creditNotes,creditNoteLines,refunds].every(inScope)) throw incomeProblem('invalid');
  const invoiceIds = new Set(invoices.map(i => i.id));
  if (components.some(c => !invoiceIds.has(c.invoice_id)) || payments.some(p => !invoiceIds.has(p.invoice_id))) throw incomeProblem('invalid');
  if(creditNotes.some(n=>!invoiceIds.has(n.invoice_id))||refunds.some(r=>!invoiceIds.has(r.invoice_id)))throw incomeProblem('invalid');
  for(const l of creditNoteLines){const n=creditNotes.find(n=>n.id===l.credit_note_id),c=components.find(c=>c.id===l.component_id);
    cents(l.amount_cents);if(!n||!c||n.invoice_id!==l.invoice_id||c.invoice_id!==l.invoice_id)throw incomeProblem('invalid');}
  const cashRefunds=refunds.map(r=>({...r,amount_cents:cents(r.amount_cents),cash_date:isoDate(r.cash_date)}));
  for (const a of allocations) {
    const p = payments.find(p => p.id === a.payment_id), c = components.find(c => c.id === a.component_id);
    cents(a.amount_cents);
    if (!p || !c || p.invoice_id !== a.invoice_id || c.invoice_id !== a.invoice_id) throw incomeProblem('invalid');
  }
  const mappedPayments = payments.map(p => {
    cents(p.amount_cents);
    const cash = p.cash_received_cents === null ? null : cents(p.cash_received_cents);
    const withholding = p.withholding_cents === null ? null : cents(p.withholding_cents);
    if (cash !== null && withholding !== null && sumCents([cash,withholding]) !== p.amount_cents) throw incomeProblem('invalid');
    const allocated = sumCents(allocations.filter(a => a.payment_id === p.id).map(a => a.amount_cents));
    if (allocated > p.amount_cents || p.currency !== 'EUR') throw incomeProblem('invalid');
    return { id:p.id, invoiceId:p.invoice_id, amount:p.amount_cents, cash, withholding, allocated, date:isoDate(p.cash_date) };
  });
  const list = invoices.map(i => {
    if (i.currency !== 'EUR') throw incomeProblem('invalid');
    const parts = components.filter(c => c.invoice_id === i.id).map(c => {
      const amount = cents(c.amount_cents), allocated = sumCents(allocations.filter(a => a.component_id === c.id).map(a => a.amount_cents));
      if (allocated > amount) throw incomeProblem('invalid');
      const credited=sumCents(creditNoteLines.filter(l=>l.component_id===c.id).map(l=>l.amount_cents));if(credited>amount)throw incomeProblem('invalid');
      return { id:c.id, amount, allocated,credited, kind:c.kind, activityId:c.activity_id };
    });
    if (!parts.length) throw incomeProblem('invalid');
    const receipts = mappedPayments.filter(p => p.invoiceId === i.id).sort((a,b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
    const original = sumCents(parts.filter(c=>c.kind!=='withholding').map(c => c.amount)),credited=sumCents(parts.filter(c=>c.kind!=='withholding').map(c=>c.credited));
    const total=original-credited,paid=sumCents(receipts.map(p=>p.amount)),refunded=sumCents(cashRefunds.filter(r=>r.invoice_id===i.id).map(r=>r.amount_cents));
    if(refunded>Math.max(0,paid-total))throw incomeProblem('invalid');
    // Preserve settlement vs cash and unallocated amounts; never coerce unknown cash to zero.
    return { id:i.id, revision:cents(i.revision), number:i.number || 'Senza numero', customer:i.customer || 'Cliente non indicato', date:isoDate(i.issue_date),
      total, original,credited,refunded,paid, residual:Math.max(0,total-paid), cash:sumCents(receipts.map(p => p.cash)), components:parts, payments:receipts,
      review:parts.some(c=>c.kind==='unknown')||receipts.some(p=>p.allocated!==p.amount||p.cash===null)||Math.max(0,paid-total)>refunded,
      simple:parts.length === 1 && parts[0].kind === 'compensation' && receipts.every(p => p.allocated === p.amount && p.withholding === 0 && p.cash === p.amount) };
  }).sort((a,b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id));
  return { workspaceId:workspace.id, dataRevision:cents(workspace.data_revision), year, invoices:list, payments:mappedPayments,
    received:(()=>{const cash=sumCents(mappedPayments.filter(p => p.date.startsWith(year+'-')).map(p => p.cash));return cash===null?null:cash-sumCents(cashRefunds.filter(r=>r.cash_date.startsWith(year+'-')).map(r=>r.amount_cents));})(),
    outstanding:sumCents(list.map(i => i.residual)), activities:activities.map(a => ({id:a.id,label:a.ateco_code || 'Attività senza codice ATECO'})) };
}
