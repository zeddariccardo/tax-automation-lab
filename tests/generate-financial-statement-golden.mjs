import { financialStatementCases } from './financial-statement-cases.mjs';
import { buildFinancialStatementSnapshot } from './financial-statement-golden-utils.mjs';
import { startFinancialStatementHarness } from './financial-statement-harness.mjs';

const harness = await startFinancialStatementHarness();
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
  process.stdout.write(`${JSON.stringify({ schemaVersion: 1, toolVersion: '1.4.2', cases }, null, 2)}\n`);
} finally {
  await harness.close();
}
