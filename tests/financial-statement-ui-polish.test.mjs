import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { financialStatementCases } from './financial-statement-cases.mjs';
import { financialStatementFixtureApi } from './financial-statement-fixture-api.mjs';
import { startFinancialStatementHarness } from './financial-statement-harness.mjs';

let harness;
const fixture = structuredClone(financialStatementCases.find(item => item.name === 'abbreviato_utile_erp_comparativo').fixture);

before(async () => {
  harness = await startFinancialStatementHarness({ apiHandler: financialStatementFixtureApi });
  await harness.load(fixture);
});

after(async () => {
  if (!harness) return;
  const errors = [...harness.consoleErrors];
  await harness.close();
  assert.deepEqual(errors, [], 'il polish UI non deve generare errori console');
});

for (const expected of [
  { width: 1440, height: 900, columns: 4 },
  { width: 768, height: 1024, columns: 2 },
  { width: 390, height: 844, columns: 1 },
]) {
  test(`layout Bilancio a ${expected.width}×${expected.height}`, async () => {
    const audit = await harness.uiAudit(expected.width, expected.height);
    assert.equal(audit.horizontalOverflow, 0, 'la pagina non deve superare il viewport');
    assert.equal(audit.columnCount, expected.columns);
    assert.deepEqual(audit.fieldsOffscreen, []);
    assert.ok(audit.tabMaxHeight <= 34.5, `tab troppo alta: ${audit.tabMaxHeight}px`);
    assert.ok(audit.tabMaxWidth < audit.viewport.width, 'un controllo supera il viewport');
    assert.match(audit.headline, /Bilancio quadrato|Da verificare/);
    assert.equal(audit.detailsClosed, true, 'il dettaglio deve partire chiuso');
    assert.ok(audit.controlCount >= 10, 'tutte le verifiche devono restare disponibili');
  });
}
