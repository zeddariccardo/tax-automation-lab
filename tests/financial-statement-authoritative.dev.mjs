/* Verifica locale della Fase 4. Usa il Worker privato in-process e soltanto
 * dati fittizi; non effettua richieste alla produzione. */
import assert from 'node:assert/strict';

import worker from '../../tax-automation-lab-backend/src/index.js';
import { financialStatementCases } from './financial-statement-cases.mjs';
import { startFinancialStatementHarness } from './financial-statement-harness.mjs';

const envFor = request => ({
  AMBIENTE: 'sviluppo',
  ORIGINI_AMMESSE: request.headers.get('Origin') || '',
  LIMITE: { limit: async () => ({ success: true }) },
});

const normalize = value => {
  if (Array.isArray(value)) return value.map(normalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, normalize(item)]));
  }
  return typeof value === 'number' && Object.is(value, -0) ? 0 : value;
};

const backendLeaves = leaves => Object.fromEntries(Object.entries(leaves).map(([key, row]) => [key, {
  raw: row.raw,
  rawPrev: row.rawPrev,
  storno: row.storno,
  stornoPrev: row.stornoPrev,
  adjustment: row.adjustment,
  adjustmentPrev: row.adjustmentPrev,
}]));
const backendNodes = nodes => Object.fromEntries(Object.entries(nodes).map(([key, row]) => [key, {
  amount: row.amount,
  amountPrev: row.amountPrev,
}]));

function assertPrivacy(payload, fixture) {
  const serialized = JSON.stringify(payload);
  const forbiddenFields = ['anagrafica', 'accounts', 'code', 'desc', 'source', 'uid', 'note',
    'leafOverrides', 'aiFindings', 'mapping', 'Esiti AI', 'output'];
  for (const name of forbiddenFields) {
    assert.equal(serialized.includes('"' + name + '"'), false, 'campo vietato: ' + name);
  }
  for (const account of fixture.accounts || []) {
    for (const value of [account.code, account.desc, account.uid]) {
      if (typeof value === 'string' && value.length >= 4) {
        assert.equal(serialized.includes(value), false, 'sentinella conto nel payload');
      }
    }
  }
  for (const value of Object.values(fixture.anagrafica || {})) {
    if (typeof value === 'string' && value.length >= 4) {
      assert.equal(serialized.includes(value), false, 'sentinella anagrafica nel payload');
    }
  }
  for (const sentinel of JSON.stringify(fixture).match(/SENTINELLA_[A-Z_]+/g) || []) {
    assert.equal(serialized.includes(sentinel), false, 'sentinella privacy nel payload: ' + sentinel);
  }
}

function compareProjection(name, run) {
  const { local, backend } = run;
  assert.equal(local.mode, backend.mode, name + ': schema');
  assert.deepEqual(local.comparative, backend.comparative, name + ': comparativo');
  assert.deepEqual(normalize(local.leaves), normalize(backendLeaves(backend.leaves)), name + ': foglie');
  assert.deepEqual(normalize(local.nodes), normalize(backendNodes(backend.nodes)), name + ': nodi');
  assert.deepEqual(normalize(local.totals), normalize(backend.totals), name + ': totali');
  assert.equal(local.gate, backend.gate.allowed && local.mapping.invalid === 0, name + ': gate composto');
  const statuses = Object.fromEntries(local.checks.map(row => [row.name, row.status]));
  assert.equal(statuses['Quadratura corrente'], backend.checks.quadraturaCorrente.status);
  assert.equal(statuses['Quadratura precedente'], backend.checks.quadraturaPrecedente.status);
  assert.equal(statuses['Coerenza CE'], backend.checks.coerenzaCe.status);
  assert.equal(statuses['CE ↔ Patrimonio netto'], backend.checks.cePatrimonioNetto.status);
  assert.equal(statuses['Storni da verificare'], backend.checks.storniDaVerificare.status);
  assert.equal(statuses['Rettifiche non quadrate'], backend.checks.rettificheNonQuadrate.status);
}

const exportScenarios = financialStatementCases.filter(scenario => scenario.exports);
const harness = await startFinancialStatementHarness({
  apiHandler: request => worker.fetch(request, envFor(request)),
});

let maxPayloadBytes = 0;
let totalRequests = 0;
try {
  for (const [index, scenario] of financialStatementCases.entries()) {
    const fixture = structuredClone(scenario.fixture);
    if (index === 0) {
      fixture.anagrafica = {
        an_denom: 'SENTINELLA_IDENTITA_PRIVACY',
        an_piva: 'SENTINELLA_PARTITA_IVA_PRIVACY',
      };
      fixture.accounts[0].code = 'SENTINELLA_CODICE_CONTO_PRIVACY';
      fixture.accounts[0].desc = 'SENTINELLA_DESCRIZIONE_CONTO_PRIVACY';
      fixture.accounts[0].uid = 'SENTINELLA_UID_PRIVACY';
      fixture.aiFindings = [{ note: 'SENTINELLA_ESITI_AI_PRIVACY' }];
    }
    await harness.load(fixture);
    const first = await harness.authoritativeRun();
    assert.equal(first.requests, 1, scenario.name + ': una richiesta per lo stato');
    assert.equal(first.cached, true, scenario.name + ': deduplica dopo il risultato');
    assertPrivacy(first.payload, fixture);
    compareProjection(scenario.name, first);
    maxPayloadBytes = Math.max(maxPayloadBytes, first.payloadBytes);
    totalRequests += first.requests;
  }

  const scenario = exportScenarios[0];
  await harness.load(scenario.fixture);
  await harness.resetAuthoritative();
  const concurrent = await harness.concurrentAuthoritativeRun(3);
  concurrent.forEach(run => assert.equal(run.requests, 1, 'single-flight'));
  const cached = await harness.authoritativeRun();
  assert.equal(cached.requests, 1, 'deduplica dello stato completato');
  assert.equal(cached.cached, true);
  const outputs = await harness.captureAuthoritativeOutputs();
  assert.equal(outputs.requestsBefore, 1, 'una richiesta prima degli output');
  assert.equal(outputs.requestsAfter, 1, 'PDF/Excel/XBRL/dettaglio/archivio non richiedono altri dati');
  assert.ok(outputs.output.excel.length >= 2, 'Excel ricomposto');
  assert.ok(outputs.output.pdf.length >= 2, 'PDF ricomposto');
  assert.ok(outputs.output.xbrl.facts.length > 0, 'XBRL ricomposto');
  assert.ok(Object.keys(outputs.output.detail).length > 0, 'dettaglio conti ricomposto');
  assert.ok(outputs.output.archive.accounts.length > 0, 'archivio conserva i conti locali');
} finally {
  const consoleErrors = [...harness.consoleErrors];
  await harness.close();
  assert.deepEqual(consoleErrors, [], 'nessun errore console nel flusso autorevole');
}

const downHarness = await startFinancialStatementHarness({
  apiHandler: async () => new Response('', {
    status: 503,
    headers: { 'cache-control': 'no-store' },
  }),
});
try {
  await assert.rejects(() => downHarness.load(exportScenarios[0].fixture));
  const failed = await downHarness.serviceState();
  assert.equal(failed.hasResult, false, 'nessun risultato stale quando il servizio non risponde');
  assert.equal(failed.status, 'error');
  assert.equal(failed.retryVisible, true, 'Riprova visibile su errore HTTP');
  assert.equal(failed.exportsDisabled, true, 'export disabilitati su errore HTTP');
} finally {
  const consoleErrors = [...downHarness.consoleErrors];
  await downHarness.close();
  assert.deepEqual(
    consoleErrors,
    ['Failed to load resource: the server responded with a status of 503 (Service Unavailable)'],
    'solo il 503 di rete atteso, senza errori JavaScript aggiuntivi',
  );
}

let retryCalls = 0;
const retryHarness = await startFinancialStatementHarness({
  apiHandler: async request => {
    retryCalls += 1;
    if (retryCalls === 1) {
      const valid = await worker.fetch(request, envFor(request));
      const altered = await valid.json();
      altered.totals.campoNestedInatteso = 1;
      return new Response(JSON.stringify(altered), {
        status: 200,
        headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
      });
    }
    return worker.fetch(request, envFor(request));
  },
});
try {
  await assert.rejects(() => retryHarness.load(exportScenarios[0].fixture));
  const failed = await retryHarness.serviceState();
  assert.equal(failed.hasResult, false, 'nessun risultato stale dopo risposta invalida');
  assert.equal(failed.status, 'error');
  assert.equal(failed.retryVisible, true, 'Riprova visibile');
  assert.equal(failed.exportsDisabled, true, 'export stale disabilitati');
  assert.equal(failed.exportContentVisible, false, 'output stale non visibile');
  const retried = await retryHarness.clickRetry();
  assert.equal(retried.hasResult, true, 'Riprova ricostruisce il risultato autorevole');
  assert.equal(retried.status, 'idle');
  assert.equal(retryCalls, 2);
} finally {
  const consoleErrors = [...retryHarness.consoleErrors];
  await retryHarness.close();
  assert.deepEqual(consoleErrors, [], 'errore gestito senza errori console');
}

let raceCalls = 0;
const raceHarness = await startFinancialStatementHarness({
  apiHandler: async request => {
    raceCalls += 1;
    if (raceCalls === 2) await new Promise(resolve => setTimeout(resolve, 80));
    return worker.fetch(request, envFor(request));
  },
});
try {
  await raceHarness.load(exportScenarios[0].fixture);
  const race = await raceHarness.raceAccount('ATT-CASSA', 222, 333);
  assert.equal(race.metrics.requests, 2, 'single-flight serializza solo i due stati distinti');
  assert.equal(race.project.totals.attivo, 333, 'lo stato superato non sovrascrive il più recente');
} finally {
  const consoleErrors = [...raceHarness.consoleErrors];
  await raceHarness.close();
  assert.deepEqual(consoleErrors, [], 'race gestita senza errori console');
}

console.log(JSON.stringify({
  golden: financialStatementCases.length,
  requests: totalRequests,
  maxPayloadBytes,
  singleFlight: 'ok',
  deduplication: 'ok',
  privacySentinel: 'ok',
  pdfExcelXbrlDetailArchive: 'ok',
  serviceDownRetry: 'ok',
  staleExports: 'blocked',
  raceOutOfOrder: 'ok',
}));
