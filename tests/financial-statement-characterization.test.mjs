import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { after, before, test } from 'node:test';
import { financialStatementCases } from './financial-statement-cases.mjs';
import { financialStatementFixtureApi } from './financial-statement-fixture-api.mjs';
import { startFinancialStatementHarness } from './financial-statement-harness.mjs';

let harness;

before(async () => {
  harness = await startFinancialStatementHarness({ apiHandler: financialStatementFixtureApi });
});

after(async () => {
  if (!harness) return;
  const consoleErrors = [...harness.consoleErrors];
  await harness.close();
  assert.deepEqual(consoleErrors, [], 'il runtime della pagina non deve generare errori console');
});

const scenario = name => structuredClone(financialStatementCases.find(item => item.name === name).fixture);

test('caratterizzazione: nessuna soglia di quadratura resta nel frontend', async () => {
  const source = await readFile(new URL('../tools/financial-statement/index.html', import.meta.url), 'utf8');
  assert.equal(source.includes('FS_BAL' + '_TOL'), false);
  assert.equal(source.includes('Math.abs(r.totAtt-r.totPas)'), false);
});

test('caratterizzazione: i duplicati usano il codice conto originale normalizzato', async () => {
  await harness.load(scenario('duplicati_non_mappati_override'));
  const result = await harness.project();
  const duplicateCheck = result.checks.find(check => check.name === 'Codici duplicati');
  assert.equal(result.mapping.duplicates.length, 1, 'le varianti grafiche dello stesso codice sono un duplicato');
  assert.equal(result.mapping.duplicates[0], 'sp::dup 01');
  assert.equal(duplicateCheck?.status, 'warn');
});

test('caratterizzazione: storno tra sezioni resta attivo e non è marcato incompleto', async () => {
  await harness.load(scenario('storno_fra_sezioni_con_segni'));
  const result = await harness.project();
  assert.equal(result.storni[0].active, true);
  assert.equal(result.storni[0].warning, false, 'il comportamento attivo corrente non va modificato');
});

test('caratterizzazione: scenario XBRL ordinario resta esplicitamente non verificato', async () => {
  await harness.load(scenario('ordinario_codici_b_c_d_qualificati'));
  const result = await harness.project();
  assert.equal(result.ordinaryScenarioVerified, false);
});
