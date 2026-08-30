import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test, { after, before } from 'node:test';
import { startFinancialAnalysisHarness } from './financial-analysis-harness.mjs';
import {
  deterministicFuzzFixtures,
  financialAnalysisCases,
  financialAnalysisFixtureMeta,
} from './financial-analysis-fixtures.mjs';
import {
  compactFuzzResult,
  fingerprint,
  runtimeFingerprints,
  snapshotFingerprints,
} from './financial-analysis-golden-utils.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const golden = JSON.parse(readFileSync(path.join(HERE, 'golden', 'financial-analysis-v2.1.3.json'), 'utf8'));
let harness;

before(async () => {
  harness = await startFinancialAnalysisHarness();
});

after(async () => {
  await harness?.close();
});

test('runtime autorevole: sorgenti e wrapper coincidono con la baseline', async () => {
  const runtime = await harness.runtimeSources();
  assert.deepEqual(runtimeFingerprints(runtime), golden.runtime);
});

test('24 scenari golden numerici e output semantici restano invariati', async t => {
  assert.equal(golden.schemaVersion, 2);
  assert.equal(golden.toolVersion, '2.1.3');
  assert.equal(financialAnalysisFixtureMeta.goldenCases, 24);
  assert.deepEqual(Object.keys(golden.cases), financialAnalysisCases.map(row => row.name));

  for (const scenario of financialAnalysisCases) {
    await t.test(scenario.name, async () => {
      await harness.load(scenario.fixture);
      const snapshot = await harness.snapshot({ outputs: scenario.outputs, gateProbe: scenario.gateProbe });
      assert.deepEqual(snapshotFingerprints(snapshot), golden.cases[scenario.name].fingerprints);
      assert.deepEqual(snapshot, golden.cases[scenario.name].snapshot);
    });
  }
});

test('200 fuzz deterministici coincidono con la baseline', async () => {
  const actual = [];
  for (const entry of deterministicFuzzFixtures(golden.fuzz.count)) {
    await harness.load(entry.fixture);
    actual.push({
      index: entry.index,
      result: compactFuzzResult(await harness.snapshot({ outputs: false, gateProbe: false })),
    });
  }
  assert.equal(actual.length, 200);
  assert.deepEqual(actual, golden.fuzz.cases);
  assert.equal(fingerprint(actual), golden.fuzz.aggregateFingerprint);
});

test('tutti i blocker fermano ciascuno dei dodici entry point Excel/PDF', async () => {
  await harness.load(financialAnalysisCases[0].fixture);
  const matrix = await harness.gateMatrix();
  assert.deepEqual(matrix.map(row => row.code), [
    'NOT_LOADED', 'SCHEMA_REQUIRED', 'IMPORT_ERRORS',
    'AI_BLOCKING', 'AIX_PENDING', 'SP_UNBALANCED',
  ]);
  matrix.forEach(row => {
    assert.equal(row.blockers[0], row.code, `${row.code}: blocker inatteso`);
    assert.equal(row.excel, 0, `${row.code}: un export Excel ha superato il gate`);
    assert.equal(row.pdf, 0, `${row.code}: un export PDF ha superato il gate`);
  });
});

test('input tecnico golden non contiene dati browser-only o stringhe reali', () => {
  const forbiddenKeys = new Set([
    'name', 'vat', 'cf', 'desc', 'description', 'code', 'uid', 'techKey', 'row',
    'note', 'source', 'filename', 'mapping', 'aiFindings', 'company', 'identity',
  ]);
  const visit = (value, trail = []) => {
    if (Array.isArray(value)) return value.forEach((item, index) => visit(item, trail.concat(index)));
    if (!value || typeof value !== 'object') return;
    Object.entries(value).forEach(([key, item]) => {
      assert.equal(forbiddenKeys.has(key), false, `campo browser-only nel payload tecnico: ${trail.concat(key).join('.')}`);
      visit(item, trail.concat(key));
    });
  };
  Object.values(golden.cases).forEach(entry => visit(entry.snapshot.inputTechnical));
  const serialized = JSON.stringify(golden);
  for (const sentinel of ['IDENTITA_REALE_VIETATA', 'CODICE_IDENTIFICATIVO_REALE_VIETATO']) {
    assert.equal(serialized.includes(sentinel), false, `sentinella privacy vietata nel golden: ${sentinel}`);
  }
});

test('il runtime non ha prodotto errori console durante golden e fuzz', () => {
  assert.deepEqual(harness.consoleErrors, []);
});

test('harness e test pilotano il runtime senza copiare formule proprietarie eseguibili', () => {
  const files = [
    'financial-analysis-harness.mjs',
    'financial-analysis-fixtures.mjs',
    'financial-analysis-golden-utils.mjs',
    'generate-financial-analysis-golden.mjs',
    'financial-analysis-characterization.test.mjs',
    'financial-analysis-golden.test.mjs',
  ];
  const proprietary = [
    'ceCore', 'spCore', 'aggregateScheme', 'makeKpis', 'cashFlowModel',
    'adequacyModel', 'dupontModel', 'bridgeModel', 'scenarioMetricRows',
  ];
  for (const file of files) {
    const source = readFileSync(path.join(HERE, file), 'utf8');
    for (const name of proprietary) {
      assert.doesNotMatch(source, new RegExp(`function\\s+${name}\\s*\\(`), `${file} ridefinisce ${name}`);
      assert.doesNotMatch(source, new RegExp(`(?:const|let|var)\\s+${name}\\s*=\\s*(?:function|(?:async\\s*)?\\([^)]*\\)\\s*=>)`), `${file} duplica ${name}`);
    }
  }
});
