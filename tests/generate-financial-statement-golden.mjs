import { writeFile } from 'node:fs/promises';
import { financialStatementCases } from './financial-statement-cases.mjs';
import { financialStatementFixtureApi } from './financial-statement-fixture-api.mjs';
import { buildFinancialStatementSnapshot } from './financial-statement-golden-utils.mjs';
import { startFinancialStatementHarness } from './financial-statement-harness.mjs';

const harness = await startFinancialStatementHarness({ apiHandler: financialStatementFixtureApi });
const cases = {};
try {
  for (const scenario of financialStatementCases) {
    await harness.load(scenario.fixture);
    const project = await harness.project();
    const xbrl = await harness.xbrlFacts();
    const excel = scenario.exports ? await harness.captureExcel() : [];
    const pdf = scenario.exports ? await harness.capturePdf() : [];
    cases[scenario.name] = buildFinancialStatementSnapshot({ project, xbrl, excel, pdf });
  }
  if (harness.consoleErrors.length) throw new Error(`Errori console: ${harness.consoleErrors.join(' | ')}`);
  const output = new URL('./golden/financial-statement-v1.4.2.json', import.meta.url);
  await writeFile(output, `${JSON.stringify({ schemaVersion: 1, toolVersion: '1.4.2', cases }, null, 2)}\n`);
  console.log(JSON.stringify({ cases: Object.keys(cases).length, output: output.pathname }));
} finally {
  await harness.close();
}
