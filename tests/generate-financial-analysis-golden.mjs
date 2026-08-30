import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
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
const OUTPUT = path.join(HERE, 'golden', 'financial-analysis-v2.1.3.json');
const harness = await startFinancialAnalysisHarness();

try {
  const runtime = await harness.runtimeSources();
  const cases = {};
  const anomalies = {};
  for (const scenario of financialAnalysisCases) {
    await harness.load(scenario.fixture);
    const snapshot = await harness.snapshot({
      outputs: scenario.outputs,
      gateProbe: scenario.gateProbe,
    });
    cases[scenario.name] = {
      fingerprints: snapshotFingerprints(snapshot),
      snapshot,
    };
    if (['14_soglia_sbilancio_050', '21_budget_forecast_con_mapping_custom',
      '20_benchmark_quartili_uguali', '11_aix_tecnica_pendente',
      '24_schema_ai_aix_tutti_bloccanti'].includes(scenario.name)) {
      anomalies[scenario.name] = await harness.activeAnomalies();
    }
  }

  const fuzz = [];
  for (const entry of deterministicFuzzFixtures(financialAnalysisFixtureMeta.fuzzCases)) {
    await harness.load(entry.fixture);
    const snapshot = await harness.snapshot({ outputs: false, gateProbe: false });
    fuzz.push({ index: entry.index, result: compactFuzzResult(snapshot) });
  }

  const golden = {
    schemaVersion: 2,
    toolVersion: '2.1.3',
    generatedFrom: 'runtime locale corrente; dati esclusivamente fittizi',
    beforeAfter: {
      quadratura: {
        before: 'Il medesimo sbilancio SP era valutato con soglie monetarie diverse (0,01 e soglie dinamiche fino ad almeno 1,00).',
        after: 'Controllo import, KPI dipendenti, gate export e Report Center condividono FA_SP_BAL_TOLERANCE = 0,01.',
      },
      scenarios: {
        before: 'Budget e forecast potevano ignorare mapping/split actual e applicare nuovamente il fattore scenario durante l’aggregazione.',
        after: 'Budget e forecast riusano mapping/split actual e ogni fattore scenario incide una sola volta.',
      },
      benchmark: {
        before: 'Quartili uguali potevano superare la validazione iniziale e produrre poi score null.',
        after: 'Il contratto richiede Q1 < mediana < Q3 e restituisce reason code e messaggio espliciti quando non è rispettato.',
      },
      exportGate: {
        before: 'Il gate vivo proteggeva otto entry point e lasciava quattro stampe PDF laterali.',
        after: 'Lo stesso gate protegge tutti i dodici entry point Excel/PDF.',
      },
      reportCenter: {
        before: 'Il riepilogo non esponeva tutti i blocker effettivi, in particolare Esiti AI e A.IX.',
        after: 'Il Report Center deriva i blocker dalla stessa valutazione del gate e li mostra tutti.',
      },
      schema: {
        before: 'Uno schema mancante veniva ripristinato silenziosamente ad abbrev.',
        after: 'Lo schema resta non definito, richiede una scelta esplicita e blocca analisi ed export.',
      },
    },
    fixtures: financialAnalysisFixtureMeta,
    runtime: runtimeFingerprints(runtime),
    cases,
    fuzz: {
      seed: '0x5a17c0de',
      count: fuzz.length,
      aggregateFingerprint: fingerprint(fuzz),
      cases: fuzz,
    },
    anomalies,
  };
  await writeFile(OUTPUT, JSON.stringify(golden, null, 2) + '\n', 'utf8');
  console.log(`Golden Analisi di Bilancio generato: ${financialAnalysisCases.length} scenari, ${fuzz.length} fuzz.`);
  console.log(`Fingerprint fuzz: ${golden.fuzz.aggregateFingerprint}`);
  if (harness.consoleErrors.length) {
    console.error(harness.consoleErrors.join('\n'));
    process.exitCode = 1;
  }
} finally {
  await harness.close();
}
