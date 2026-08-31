import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import {
  deterministicFuzzFixtures,
  financialAnalysisCases,
  financialAnalysisFixtureMeta,
} from './financial-analysis-fixtures.mjs';
import { fingerprint } from './financial-analysis-golden-utils.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const golden = JSON.parse(readFileSync(path.join(HERE, 'golden', 'financial-analysis-v2.1.3.json'), 'utf8'));
const read = relative => readFileSync(path.join(ROOT, relative), 'utf8');

test('la baseline conserva 24 golden e 200 fuzz deterministici fittizi', () => {
  assert.equal(golden.schemaVersion, 2);
  assert.equal(golden.toolVersion, '2.1.3');
  assert.equal(financialAnalysisFixtureMeta.goldenCases, 24);
  assert.equal(financialAnalysisCases.length, 24);
  assert.deepEqual(Object.keys(golden.cases), financialAnalysisCases.map(row => row.name));
  const fuzz = deterministicFuzzFixtures(200, 0x5a17c0de);
  assert.equal(fuzz.length, 200);
  assert.equal(golden.fuzz.count, 200);
  assert.equal(fingerprint(golden.fuzz.cases), golden.fuzz.aggregateFingerprint);
});

test('fixture e golden non contengono dati reali o sentinelle browser-only', () => {
  const serialized = JSON.stringify({ fixtures: financialAnalysisCases, fuzz: deterministicFuzzFixtures(200, 0x5a17c0de), golden });
  for (const forbidden of [
    'IDENTITA_REALE_VIETATA', 'CODICE_IDENTIFICATIVO_REALE_VIETATO',
    'SENTINEL_BROWSER_ONLY_4E912A', 'SENTINEL_REAL_COMPANY_FORBIDDEN',
  ]) assert.equal(serialized.includes(forbidden), false, forbidden);
});

test('il runtime pubblico usa soltanto il client autorevole e non carica shadow', () => {
  const html = read('tools/financial-analysis/index.html');
  assert.match(html, /authoritative-app\.js/);
  assert.doesNotMatch(html, /shadow-bridge\.js|FA_SHADOW|fa-shadow/);
  assert.equal((html.match(/authoritative-app\.js/g) || []).length, 1);
  const client = read('tools/financial-analysis/authoritative-app.js');
  assert.match(client, /\/api\/financial-analysis\/calcola/);
  assert.match(client, /cache:'no-store'/);
  assert.match(client, /function exportGate\(/);
  assert.match(client, /function retryAnalysis\(/);
});

test('harness e test pubblici non incorporano un motore proprietario eseguibile', () => {
  const files = [
    'tools/financial-analysis/index.html',
    'tools/financial-analysis/authoritative-app.js',
    'tests/financial-analysis-harness.mjs',
    'tests/financial-analysis-fixtures.mjs',
    'tests/financial-analysis-golden-utils.mjs',
    'tests/generate-financial-analysis-golden.mjs',
    'tests/financial-analysis-characterization.test.mjs',
    'tests/financial-analysis-golden.test.mjs',
  ];
  const forbiddenDefinitions = [
    'sp' + 'Core', 'ce' + 'Core', 'aggregate' + 'Scheme', 'v17' + 'SectionModels',
    'make' + 'Kpis', 'cashFlow' + 'Model', 'adequacy' + 'Model',
    'dupont' + 'Model', 'bridge' + 'Model', 'scenario' + 'MetricRows',
    'history' + 'Metrics',
  ];
  for (const file of files) {
    const source = read(file);
    for (const name of forbiddenDefinitions) {
      assert.doesNotMatch(source, new RegExp(`function\\s+${name}\\s*\\(`), `${file}: ${name}`);
      assert.doesNotMatch(source, new RegExp(`(?:const|let|var)\\s+${name}\\s*=\\s*(?:function|(?:async\\s*)?\\([^)]*\\)\\s*=>)`), `${file}: ${name}`);
    }
  }
});

test('privacy e sicurezza descrivono il confine browser-servizio senza anonimizzazione', () => {
  const pages = [
    'privacy/index.html', 'security/index.html',
    'en/privacy/index.html', 'en/security/index.html',
    'es/privacidad/index.html', 'es/seguridad/index.html',
  ].map(read).join('\n');
  assert.match(pages, /Analisi di bilancio|Financial Analysis|Análisis financiero/);
  assert.match(pages, /aggregati|aggregated|agregados/);
  assert.match(pages, /senza persistenza|without persistence|sin persistencia/);
  assert.doesNotMatch(pages, /anonim|anonymous|anónim/i);
});
