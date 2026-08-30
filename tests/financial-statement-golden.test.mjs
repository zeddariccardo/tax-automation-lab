import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { after, before, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { financialStatementCases } from './financial-statement-cases.mjs';
import { buildFinancialStatementSnapshot } from './financial-statement-golden-utils.mjs';
import { financialStatementFixtureApi, financialStatementFixtureMeta } from './financial-statement-fixture-api.mjs';
import { startFinancialStatementHarness } from './financial-statement-harness.mjs';

const goldenUrl = new URL('./golden/financial-statement-v1.4.2.json', import.meta.url);
const golden = JSON.parse(await readFile(fileURLToPath(goldenUrl), 'utf8'));
let harness;

before(async () => {
  harness = await startFinancialStatementHarness({ apiHandler: financialStatementFixtureApi });
});
after(async () => {
  if (!harness) return;
  const consoleErrors = [...harness.consoleErrors];
  await harness.close();
  assert.deepEqual(consoleErrors, [], 'la suite golden non deve generare errori console');
});

test('baseline golden post-mapping del Bilancio civilistico', async t => {
  assert.equal(golden.schemaVersion, 1);
  assert.equal(golden.toolVersion, '1.4.2');
  assert.equal(financialStatementFixtureMeta.version, 1);
  assert.deepEqual(Object.keys(golden.cases), financialStatementCases.map(scenario => scenario.name));

  for (const scenario of financialStatementCases) {
    await t.test(scenario.name, async () => {
      await harness.load(scenario.fixture);
      const project = await harness.project();
      const xbrl = await harness.xbrlFacts();
      const excel = scenario.exports ? await harness.captureExcel() : [];
      const pdf = scenario.exports ? await harness.capturePdf() : [];
      const actual = buildFinancialStatementSnapshot({ project, xbrl, excel, pdf });
      assert.deepEqual(actual, golden.cases[scenario.name]);
    });
  }
});

test('il golden non materializza il futuro payload né dati browser-only', () => {
  const serialized = JSON.stringify(golden);
  for (const forbidden of ['an_denom', 'an_piva', 'an_cf', 'uid', 'desc', 'note', 'leafOverrides', 'aiFindings']) {
    assert.equal(serialized.includes(`\"${forbidden}\"`), false, `${forbidden} non deve entrare nel golden contrattuale`);
  }
});
