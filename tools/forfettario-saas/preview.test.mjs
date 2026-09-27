import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const dir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(dir, '../..');
const read = name => readFileSync(path.join(dir, name), 'utf8');
const fresh = async () => (await import(`./demo-service.js?test=${crypto.randomUUID()}`)).demoService;

test('preview fiscal data isolated; Auth and structural read-only adapters may connect', () => {
  const html = read('index.html');
  assert.match(html, /name="robots" content="noindex,nofollow"/);
  assert.ok(html.includes('connect-src https://*.supabase.co/auth/v1/ https://*.supabase.co/rest/v1/rpc/tal_list_my_contexts'));
  for (const table of ['tax_workspace','economic_activity','tax_year','studio','studio_client_link','studio_client_private']) assert.ok(html.includes('https://*.supabase.co/rest/v1/'+table));
  assert.doesNotMatch(html, /rest\/v1\/(invoice|payment|allocation|document|activity_feed_item)|storage\/v1|functions\/v1/);
  assert.match(html, /form-action 'none'/);
  for (const name of ['app.js', 'demo-service.js']) {
    assert.doesNotMatch(read(name), /\b(fetch|XMLHttpRequest|WebSocket|EventSource|sendBeacon|localStorage|sessionStorage|indexedDB)\s*[.(]/);
    assert.doesNotMatch(read(name), /sb_secret_|service_role|eyJ[A-Za-z0-9_-]{20}|https?:\/\//);
  }
  for (const match of html.matchAll(/(?:src|href)="(\.\.?\/[^"#]+)"/g)) assert.ok(existsSync(path.resolve(dir, match[1])), match[1]);
  for (const file of ['index.html', 'sitemap.xml', 'tools/index.html', 'tools/manifest.json']) assert.doesNotMatch(readFileSync(path.join(root, file), 'utf8'), /forfettario-saas/);
});

test('invoice totals and tax snapshots are internally consistent, in integer cents', async () => {
  const s = await fresh(); const p = s.getPosition('mario');
  assert.equal(p.received, 3124000); assert.equal(p.outstanding, 40000);
  for (const t of Object.values(p.tax)) {
    for (const v of Object.values(t)) assert.ok(Number.isSafeInteger(v));
    assert.equal(t.reserve, t.tax + t.contributions - t.paid);
    assert.equal(t.contributions, Math.round(t.income * .78 * .2607));
    assert.equal(t.tax, Math.round((t.income * .78 - t.paid) * .15));
  }
});

test('shared contributor/Studio journey: request, document, completion, quiet todo list', async () => {
  const s = await fresh(); assert.equal(s.listAttention().length, 3);
  s.uploadExample('mario');
  assert.equal(s.getPosition('mario').request.state, 'submitted');
  assert.equal(s.listClients().find(p => p.id === 'mario').documents[0].state, 'submitted');
  s.uploadExample('mario'); assert.equal(s.getPosition('mario').documents.length, 2);
  s.completeRequest('mario');
  assert.equal(s.getPosition('mario').request.completedBy, 'Giulia · Studio Rossi');
  assert.equal(s.getPosition('mario').documents[0].state, 'completed');
  assert.equal(s.listAttention().length, 2);
  assert.equal(s.getPosition('laura').request.state, 'submitted');
});

test('partial receipt: bad inputs leave state intact; balance updates both totals', async () => {
  const s = await fresh();
  for (const amount of [0, -1, 40001, 2.2, NaN]) assert.throws(() => s.recordPayment('mario', 'inv-4', amount));
  assert.equal(s.getPosition('mario').received, 3124000);
  s.recordPayment('mario', 'inv-4', 20000);
  assert.equal(s.getPosition('mario').outstanding, 20000);
  s.recordPayment('mario', 'inv-4', 20000);
  assert.equal(s.getPosition('mario').received, 3164000);
  assert.equal(s.getPosition('mario').outstanding, 0);
});

test('manual and import examples never create a receipt; repeated import has no duplicates', async () => {
  const s = await fresh(); s.addInvoice('mario', 125050);
  assert.equal(s.getPosition('mario').received, 3124000);
  assert.equal(s.importExample('mario'), true); assert.equal(s.importExample('mario'), false);
  assert.equal(s.getPosition('mario').outstanding, 260050);
});

test('contextual replies, separate positions and caller snapshots cannot mutate the store', async () => {
  const s = await fresh(); s.sendMessage('mario', 'you', ' Messaggio sintetico ');
  const p = s.getPosition('mario'); assert.equal(p.messages.at(-1).text, 'Messaggio sintetico');
  p.invoices[0].paid = 0; assert.equal(s.getPosition('mario').received, 3124000);
  assert.equal(s.getPosition('laura').messages.length, 0);
  assert.throws(() => s.sendMessage('mario', 'you', ' '));
  assert.throws(() => s.sendMessage('mario', 'you', 'x'.repeat(501)));
  assert.throws(() => s.completeRequest('mario'));
});

test('professional exceptions can be resolved without showing quiet clients', async () => {
  const s = await fresh(); s.resolveDifference('andrea');
  assert.deepEqual(s.listAttention().map(p => p.id), ['mario', 'laura']);
  assert.equal(new Set(s.listClients().map(p => p.talId)).size, 4);
});

test('archive upload does not answer a request; completion verifies only its linked evidence', async () => {
  const s = await fresh();
  s.uploadExample('mario', false);
  const generic = s.getPosition('mario').documents[0].id;
  assert.equal(s.getPosition('mario').request.state, 'todo');
  assert.equal(s.getPosition('mario').request.documentId, null);
  assert.throws(() => s.completeRequest('mario'));
  s.uploadExample('mario', true);
  const requested = s.getPosition('mario').request.documentId;
  assert.notEqual(requested, generic);
  assert.equal(s.getPosition('mario').messages.at(-1).documentId, requested);
  s.uploadExample('mario', false);
  s.completeRequest('mario');
  const p = s.getPosition('mario');
  assert.equal(p.documents.find(d => d.id === requested).state, 'completed');
  assert.equal(p.documents.find(d => d.id === generic).state, 'submitted');
  assert.equal(p.documents[0].state, 'submitted');
  assert.equal(s.getPosition('laura').request.documentId, 'receipt-laura');
});

test('reply from a payment retains its context without attaching it to unrelated replies', async () => {
  const s = await fresh();
  s.sendMessage('mario', 'you', 'Domanda sintetica sul pagamento', 'payment-context');
  s.sendMessage('mario', 'studio', 'Risposta libera');
  const messages = s.getPosition('mario').messages;
  assert.equal(messages[0].context, 'payment-context');
  assert.equal(messages[1].context, null);
  assert.equal(s.getPosition('laura').messages.length, 0);
});
