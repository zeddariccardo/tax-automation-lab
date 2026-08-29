import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { startFinancialStatementHarness } from './financial-statement-harness.mjs';

let harness;

before(async () => {
  harness = await startFinancialStatementHarness();
});

after(async () => {
  if (!harness) return;
  const consoleErrors = [...harness.consoleErrors];
  await harness.close();
  assert.deepEqual(consoleErrors, [], 'il runtime della pagina non deve generare errori console');
});

function quadratureFixture(delta) {
  return {
    schema: 'abbrev',
    comparativeColumnPresent: false,
    comparativeHasValues: false,
    accounts: [
      { code: 'ATT-001', desc: 'Disponibilità liquide fittizie', source: 'sp', voce: 'CIV', importo: 100 + delta, importo_prev: 0 },
      { code: 'PAS-001', desc: 'Capitale fittizio', source: 'sp', voce: 'AI', importo: -100, importo_prev: 0 },
    ],
  };
}

test('caratterizzazione: controllo e gate condividono BAL_TOL', async () => {
  await harness.load(quadratureFixture(0.011));
  const over = await harness.project();
  const checkOver = over.checks.find(check => check.name === 'Quadratura corrente');
  assert.equal(checkOver?.status, 'fail', 'il controllo deve fallire oltre BAL_TOL');
  assert.equal(over.gate, false, 'il gate deve bloccare la stessa quadratura');

  await harness.load(quadratureFixture(0.004));
  const under = await harness.project();
  const checkUnder = under.checks.find(check => check.name === 'Quadratura corrente');
  assert.equal(checkUnder?.status, 'ok', 'il controllo deve accettare entro BAL_TOL');
  assert.equal(under.gate, true, 'il gate deve accettare la stessa quadratura');

  for (const delta of [0, 0.004, 0.009, 0.01, 0.011, 0.5]) {
    await harness.load(quadratureFixture(delta));
    const result = await harness.project();
    const check = result.checks.find(item => item.name === 'Quadratura corrente');
    assert.equal(
      check?.status === 'ok',
      result.gate,
      `controllo e gate devono prendere la stessa decisione con delta ${delta}`,
    );
  }
});

test('caratterizzazione: i duplicati usano il codice conto originale normalizzato', async () => {
  await harness.load({
    schema: 'abbrev',
    comparativeColumnPresent: false,
    comparativeHasValues: false,
    accounts: [
      { code: 'ATT-001', desc: 'Disponibilità liquide fittizie', source: 'sp', voce: 'CIV', importo: 100, importo_prev: 0 },
      { code: ' Dup-01 ', desc: 'Capitale fittizio', source: 'sp', voce: 'AI', importo: -40, importo_prev: 0 },
      { code: 'dup-01', desc: 'Riserva fittizia', source: 'sp', voce: 'AVI', importo: -60, importo_prev: 0 },
    ],
  });
  const result = await harness.project();
  const duplicateCheck = result.checks.find(check => check.name === 'Codici duplicati');
  assert.equal(result.mapping.duplicates.length, 1, 'le varianti grafiche dello stesso codice sono un duplicato');
  assert.equal(result.mapping.duplicates[0], 'sp::dup 01');
  assert.equal(duplicateCheck?.status, 'warn');
});

test('caratterizzazione: storno tra sezioni resta attivo e non è marcato incompleto', async () => {
  await harness.load({
    schema: 'abbrev',
    comparativeColumnPresent: false,
    comparativeHasValues: false,
    accounts: [
      { code: 'ATT-001', desc: 'Disponibilità liquide fittizie', source: 'sp', voce: 'CIV', importo: 100, importo_prev: 0 },
      { code: 'PAS-001', desc: 'Capitale fittizio', source: 'sp', voce: 'AI', importo: -100, importo_prev: 0 },
    ],
    storni: [
      { id: 'storno-cross-section', active: true, fromLeaf: 'CIV', toLeaf: 'AI', amount: 7.5, amountPrev: 0 },
    ],
  });
  const result = await harness.project();
  assert.equal(result.storni[0].active, true);
  assert.equal(result.storni[0].warning, false, 'il comportamento attivo corrente non va modificato');
});

test('caratterizzazione: scenario XBRL ordinario resta esplicitamente non verificato', async () => {
  await harness.load(quadratureFixture(0));
  const result = await harness.project();
  assert.equal(result.ordinaryScenarioVerified, false);
});
