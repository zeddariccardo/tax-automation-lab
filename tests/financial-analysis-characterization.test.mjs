import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const golden = JSON.parse(readFileSync(path.join(HERE, 'golden', 'financial-analysis-v2.1.3.json'), 'utf8'));

test('le sei decisioni pre-migrazione documentano esplicitamente prima e dopo', () => {
  assert.deepEqual(Object.keys(golden.beforeAfter), [
    'quadratura', 'scenarios', 'benchmark', 'exportGate', 'reportCenter', 'schema',
  ]);
  Object.values(golden.beforeAfter).forEach(change => {
    assert.match(change.before, /./);
    assert.match(change.after, /./);
  });
});

test('fix 1: quadratura SP condivide la tolleranza monetaria di 0,01', () => {
  const observed = golden.anomalies['14_soglia_sbilancio_050'].tolerances;
  assert.equal(observed.difference, 0.5);
  assert.equal(observed.sharedMonetaryTolerance, 0.01);
  assert.equal(observed.exportAccepts, false);
  assert.equal(observed.kpiMarksBalanceBad, true);
  const scenario = golden.cases['14_soglia_sbilancio_050'].snapshot;
  assert.equal(scenario.gateProbe.allowed, false);
  assert.equal(scenario.gateSummary.find(row => row.name === 'Quadratura SP')?.status, 'fail');
  assert.equal(scenario.outputs.excel.length, 0);
  assert.equal(scenario.outputs.pdf.length, 0);
});

test('fix 2: budget e forecast riusano mapping/split actual e applicano il fattore una volta', () => {
  const observed = golden.anomalies['21_budget_forecast_con_mapping_custom'].scenario;
  assert.equal(observed.actual.external, 590000);
  assert.equal(observed.budget.external, 637200);
  assert.equal(observed.forecast.external, 607700);
  assert.equal(observed.budgetMappedCeVa.cv_services, 0);
  assert.equal(observed.forecastMappedCeVa.cv_services, 0);
  assert.equal(observed.budgetMappedCeVa.cv_personnel, -762480);
  assert.equal(observed.forecastMappedCeVa.cv_personnel, -727180);
  assert.equal(observed.budgetMappedCeVa.cv_revenue, observed.budget.rev);
  assert.equal(observed.forecastMappedCeVa.cv_revenue, observed.forecast.rev);
});

test('fix 3: quartili non strettamente ordinati hanno reason code e non sono validi', () => {
  const observed = golden.anomalies['20_benchmark_quartili_uguali'].equalQuartile;
  assert.equal(observed.assessment.valid, false);
  assert.deepEqual(observed.assessment.reasons, [{
    code: 'QUARTILES_NOT_STRICTLY_INCREASING',
    message: 'Ordine richiesto non rispettato: Q1 < mediana < Q3',
  }]);
  assert.deepEqual(observed.issues, ['Ordine richiesto non rispettato: Q1 < mediana < Q3']);
  assert.equal(observed.acceptedByLookup, false);
  assert.equal(observed.health.score, null);
  assert.equal(observed.health.coverage, 75);
  assert.equal(observed.health.label, 'Benchmark incompleto');
});

test('fix 4: tutti i dodici entry point condividono il gate export', () => {
  const protection = golden.runtime.protected;
  const names = Object.keys(protection);
  assert.equal(names.length, 12);
  assert.deepEqual(names.filter(name => protection[name].exists && protection[name].protected), names);
  const complete = golden.cases['01_completo_tutti_moduli'].snapshot;
  assert.equal(complete.outputs.excel.length, 6);
  assert.equal(complete.outputs.pdf.length, 6);
  const pending = golden.cases['11_aix_tecnica_pendente'].snapshot;
  assert.equal(pending.gateProbe.allowed, false);
  assert.equal(pending.outputs.excel.length, 0);
  assert.equal(pending.outputs.pdf.length, 0);
});

test('fix 5: Report Center mostra schema, AI e A.IX come blocker reali', () => {
  const observed = golden.anomalies['24_schema_ai_aix_tutti_bloccanti'];
  assert.deepEqual(observed.blockersAbsentFromReport, { schema: false, ai: false, aix: false });
  for (const pattern of [/schema/i, /esiti ai/i, /a\.ix/i]) {
    assert.equal(observed.report.some(row => pattern.test(row.name) && row.status === 'fail'), true);
  }
});

test('fix 6: schema assente resta vuoto e blocca analisi ed export', () => {
  const observed = golden.anomalies['24_schema_ai_aix_tutti_bloccanti'];
  assert.equal(observed.schemaValueAfterRuntimeModels, '');
  assert.equal(observed.schemaNavigationBlocked, true);
  assert.equal(observed.exportGateAllows, false);
  assert.deepEqual(observed.exportBlockers.map(row => row.code), [
    'SCHEMA_REQUIRED', 'AI_BLOCKING', 'AIX_PENDING',
  ]);
  const scenario = golden.cases['24_schema_ai_aix_tutti_bloccanti'].snapshot;
  assert.equal(scenario.gateProbe.allowed, false);
  assert.equal(scenario.outputs.excel.length, 0);
  assert.equal(scenario.outputs.pdf.length, 0);
});
