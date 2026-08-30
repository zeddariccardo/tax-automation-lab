const ALL_SCHEMES = [
  'sp_fin', 'sp_func', 'sp_sources', 'sp_pfn', 'ce_va',
  'ce_ebitda', 'ce_cogs', 'ce_contrib', 'ce_areas', 'ce_adjusted',
];

const clone = value => JSON.parse(JSON.stringify(value));

function sp(code, desc, current, previous, iv, attrs) {
  return { type: 'SP', code, desc, current, previous, iv, attrs };
}

function ce(code, desc, current, previous, iv, attrs = {}) {
  return { type: 'CE', code, desc, current, previous, iv, attrs };
}

const EQUITY = { currentClass: 'equity', nature: 'equity', pfn: 'exclude' };
const OPERATING_FIXED = { currentClass: 'noncurrent', nature: 'operating', pfn: 'exclude' };
const INVENTORY = { currentClass: 'current', nature: 'inventory', pfn: 'exclude' };
const RECEIVABLE = { currentClass: 'current', nature: 'trade_receivable', pfn: 'exclude' };
const CASH = { currentClass: 'current', nature: 'cash', pfn: 'cash' };
const PAYABLE = { currentClass: 'current', nature: 'trade_payable', pfn: 'exclude' };
const DEBT = { currentClass: 'noncurrent', nature: 'financial', pfn: 'debt' };
const OPERATING_LONG = { currentClass: 'noncurrent', nature: 'operating_other', pfn: 'exclude' };
const TAX_CURRENT = { currentClass: 'current', nature: 'tax_operating', pfn: 'exclude' };

const COST_VARIABLE = { function: 'production_direct', behavior: 'variable' };
const COST_MIXED = { function: 'production_indirect', behavior: 'mixed', variablePct: 40 };
const COST_FIXED = { function: 'ga', behavior: 'fixed_common' };
const COST_SELLING = { function: 'selling', behavior: 'fixed_specific' };

export function baseAccounts() {
  return [
    sp('100000', 'Capitale sociale fittizio', -200000, -200000, 'AI', EQUITY),
    sp('112000', 'Riserva legale fittizia', -40000, -32000, 'AVI', EQUITY),
    sp('129000', 'Utili portati a nuovo fittizi', -90000, -120000, 'AVIII', EQUITY),
    sp('129900', "Utile dell'esercizio fittizio", -70000, -64000, 'AIX', EQUITY),
    sp('211000', 'Impianti e macchinari fittizi', 700000, 640000, 'BII', OPERATING_FIXED),
    sp('281000', 'Fondo ammortamento impianti fittizio', -180000, -140000, 'BII', OPERATING_FIXED),
    sp('300000', 'Rimanenze materie prime fittizie', 210000, 185000, 'CI', INVENTORY),
    sp('430000', 'Crediti verso clienti fittizi', 390000, 352000, 'CIIE', RECEIVABLE),
    sp('572000', 'Banca fittizia', 96000, 189000, 'CIV', CASH),
    sp('400000', 'Debiti verso fornitori fittizi', -330000, -296000, 'DE', PAYABLE),
    sp('170000', 'Mutuo bancario fittizio oltre dodici mesi', -380000, -420000, 'DO', DEBT),
    sp('141000', 'Fondo TFR fittizio', -74000, -66000, 'C', OPERATING_LONG),
    sp('475000', 'Debiti tributari fittizi', -32000, -28000, 'DE', TAX_CURRENT),
    ce('700000', 'Ricavi delle vendite fittizi', -1480000, -1320000, 'A1'),
    ce('601000', 'Materie prime fittizie', 520000, 472000, 'B6', COST_VARIABLE),
    ce('623000', 'Consulenze e servizi fittizi', 248000, 226000, 'B7', COST_FIXED),
    ce('621000', 'Canoni di locazione fittizi', 56000, 56000, 'B8', COST_FIXED),
    ce('640000', 'Salari e stipendi fittizi', 330000, 302000, 'B9A', COST_MIXED),
    ce('642000', 'Oneri sociali fittizi', 104000, 95000, 'B9B', COST_MIXED),
    ce('641000', 'TFR maturato fittizio', 24000, 22000, 'B9C', COST_MIXED),
    ce('681000', 'Ammortamento impianti produttivi fittizio', 40000, 38000, 'B10B', COST_MIXED),
    ce('631000', 'Oneri diversi di gestione fittizi', 14000, 12000, 'B14', COST_FIXED),
    ce('662000', 'Interessi passivi bancari fittizi', 26000, 29000, 'C17E'),
    ce('630000', 'Imposte fittizie', 48000, 4000, '20A'),
  ];
}

function scaleAccounts(accounts, currentFactor, previousFactor = currentFactor) {
  return accounts.map(account => ({
    ...clone(account),
    current: Number(account.current || 0) * currentFactor,
    previous: Number(account.previous || 0) * previousFactor,
  }));
}

function ceScenario(accounts, factor) {
  return accounts.filter(account => account.type === 'CE').map(account => ({
    ...clone(account),
    current: Number(account.current || 0) * factor,
    previous: 0,
  }));
}

function standardBenchmark() {
  const row = (code, unit, q1, median, q3) => ({
    code, unit, q1, median, q3,
    q1Present: true, medianPresent: true, q3Present: true,
    source: 'Osservatorio Fittizio', year: '2025', sample: 'Campione dimostrativo', note: '',
  });
  return [
    row('prof_ebitda_margin', '%', 0.08, 0.14, 0.22),
    row('liq_current_ratio', 'x', 0.9, 1.2, 1.8),
    row('str_autonomy', '%', 0.18, 0.3, 0.48),
    row('debt_pfn_ebitda', 'x', 1.2, 2.4, 4.2),
    row('grow_revenue', '%', -0.03, 0.04, 0.12),
  ];
}

function standardCenters(accounts) {
  const ceRows = accounts.filter(account => account.type === 'CE');
  return ceRows.flatMap(account => [
    { code: account.code, desc: account.desc, center: 'CENTRO_A', current: account.current * 0.65, previous: account.previous * 0.65 },
    { code: account.code, desc: account.desc, center: 'CENTRO_B', current: account.current * 0.35, previous: account.previous * 0.35 },
  ]);
}

function commonFixture() {
  const accounts = baseAccounts();
  return {
    company: {
      name: 'Scenario Golden Fittizio S.r.l.', schema: 'abbrev',
      periodFrom: '2025-01-01', periodTo: '2025-12-31',
      yearCurrent: 2025, yearPrevious: 2024, days: 365,
    },
    accounts,
    selected: ALL_SCHEMES,
    periods: { current: { available: true }, previous: { available: true } },
    scenarios: { budget: ceScenario(accounts, 1.08), forecast: ceScenario(accounts, 1.03) },
    centers: standardCenters(accounts),
    centerCatalog: [
      { code: 'CENTRO_A', desc: 'Centro fittizio A' },
      { code: 'CENTRO_B', desc: 'Centro fittizio B' },
    ],
    benchmark: standardBenchmark(),
    history: [{
      year: 2023,
      accounts: scaleAccounts(accounts, 0.84, 0.78),
      periods: { current: { available: true }, previous: { available: true } },
      company: { yearCurrent: 2023, yearPrevious: 2022 },
      file: { name: 'storico-fittizio-2023.xlsx' },
    }],
    adjustments: [
      { description: 'Normalizzazione fittizia positiva', currentEffect: 12000, previousEffect: 8000 },
    ],
    extra: {
      employeesCurrent: 18, employeesPrevious: 17,
      purchasesCurrent: 760000, vatSalesPct: 22, vatPurchasesPct: 22,
      cashFlowDebtService: 145000, debtService: 110000,
      interestCoverageExpense: 26000, dscrHorizonMonths: 12,
      cfOtherOperating: 5000, cfInterestPaid: 26000, cfTaxPaid: 48000,
      cfCapex: 90000, cfDisposals: 6000, cfOtherInvesting: 0,
      cfDebtFlow: -40000, cfCapital: 0, cfDividends: 22000,
      cfOtherFinancing: 0, cfOtherUnreconstructed: 0,
      overdueWages: 0, overdueSuppliers: 0, taxSocialDebt: 32000,
      capitalLoss: 0, minimumCapital: 10000,
      useAdjustedEbitda: false, aiFindings: [], firstYear: 'no',
    },
  };
}

function mutate(name, change, options = {}) {
  const fixture = commonFixture();
  change(fixture);
  return { name, fixture, outputs: options.outputs !== false, gateProbe: !!options.gateProbe };
}

function account(fixture, code, occurrence = 1) {
  return fixture.accounts.filter(row => row.code === code)[occurrence - 1];
}

export const financialAnalysisCases = [
  mutate('01_completo_tutti_moduli', () => {}, { gateProbe: true }),
  mutate('02_primo_esercizio_senza_comparativo', fixture => {
    fixture.periods.previous.available = false;
    fixture.extra.firstYear = 'yes';
  }),
  mutate('03_perdita_e_patrimonio_negativo', fixture => {
    account(fixture, '700000').current = -900000;
    account(fixture, '129900').current = 510000;
    account(fixture, '100000').current = 150000;
    account(fixture, '572000').current = -114000;
  }),
  mutate('04_segni_opposti_non_normalizzati', fixture => {
    account(fixture, '700000').current = 1480000;
    account(fixture, '400000').current = 330000;
  }),
  mutate('05_codici_duplicati_sottoconti', fixture => {
    fixture.accounts.push(ce('623000', 'Secondo sottoconto servizi fittizio', 12345.67, 11234.56, 'B7', COST_SELLING));
    account(fixture, '572000').current += 12345.67;
    account(fixture, '129900').current -= 12345.67;
  }),
  mutate('06_dieci_schemi_automatici', fixture => {
    fixture.scenarios = { budget: [], forecast: [] };
    fixture.centers = [];
    fixture.history = [];
  }),
  mutate('07_mapping_custom_e_split', fixture => {
    fixture.customMappings = [
      { scheme: 'ce_va', code: '623000', allocations: [{ target: 'cv_services', share: 0.4 }, { target: 'cv_personnel', share: 0.6 }] },
      { scheme: 'sp_pfn', code: '572000', allocations: [{ target: 'spfn_cash', share: 0.75 }, { target: 'spfn_nonop_assets', share: 0.25 }] },
      { scheme: 'ce_contrib', code: '621000', allocations: [{ target: 'cc_fixed_common', share: 0.5 }, { target: 'cc_fixed_specific', share: 0.5 }] },
    ];
  }),
  mutate('08_classificazione_proposta_non_confermata', fixture => {
    fixture.forceUnresolved = { code: '601000', prop: 'function' };
  }),
  mutate('09_rettifica_positiva_reported', fixture => {
    fixture.adjustments = [{ description: 'Rettifica fittizia positiva', currentEffect: 25000, previousEffect: 10000 }];
  }),
  mutate('10_rettifica_negativa_ebitda_adjusted', fixture => {
    fixture.adjustments = [{ description: 'Rettifica fittizia negativa', currentEffect: -18000, previousEffect: -7000 }];
    fixture.extra.useAdjustedEbitda = true;
  }),
  mutate('11_aix_tecnica_pendente', fixture => {
    const aix = account(fixture, '129900');
    aix.code = 'TAL_AIX'; aix.technicalResult = true; aix.technicalOrigin = 'tool'; aix.resultStatus = 'proposed';
  }, { gateProbe: true }),
  mutate('12_aix_tecnica_confermata', fixture => {
    const aix = account(fixture, '129900');
    aix.code = 'TAL_AIX'; aix.technicalResult = true; aix.technicalOrigin = 'tool'; aix.resultStatus = 'confirmed';
  }, { gateProbe: true }),
  mutate('13_soglia_sbilancio_0009', fixture => {
    account(fixture, '572000').current += 0.009;
  }, { gateProbe: true }),
  mutate('14_soglia_sbilancio_050', fixture => {
    account(fixture, '572000').current += 0.5;
  }, { gateProbe: true }),
  mutate('15_importi_grandi_e_subcentesimi', fixture => {
    const factor = 1234.56789;
    fixture.accounts.forEach(row => { row.current *= factor; row.previous *= factor; });
    account(fixture, '572000').current += 0.0049;
  }),
  mutate('16_cash_flow_input_espliciti', fixture => {
    Object.assign(fixture.extra, {
      cfOtherOperating: -1234.56, cfInterestPaid: 26543.21, cfTaxPaid: 48123.45,
      cfCapex: 101234.56, cfDisposals: 12345.67, cfOtherInvesting: -2500,
      cfDebtFlow: 45555.55, cfCapital: 125000, cfDividends: 33333.33,
      cfOtherFinancing: -987.65, cfOtherUnreconstructed: 456.78,
    });
  }),
  mutate('17_cash_flow_input_assenti_e_zero', fixture => {
    ['cfOtherOperating', 'cfInterestPaid', 'cfTaxPaid', 'cfCapex', 'cfDisposals', 'cfOtherInvesting',
      'cfDebtFlow', 'cfCapital', 'cfDividends', 'cfOtherFinancing', 'cfOtherUnreconstructed']
      .forEach((key, index) => { fixture.extra[key] = index % 2 ? '' : 0; });
  }),
  mutate('18_dupont_con_storico_esteso', fixture => {
    fixture.history.push({
      year: 2022,
      accounts: scaleAccounts(fixture.accounts, 0.72, 0.66),
      periods: { current: { available: true }, previous: { available: true } },
      company: { yearCurrent: 2022, yearPrevious: 2021 },
      file: { name: 'storico-fittizio-2022.xlsx' },
    });
  }),
  mutate('19_dscr_orizzonte_11_e_segnali', fixture => {
    fixture.extra.dscrHorizonMonths = 11;
    fixture.extra.cashFlowDebtService = 55000;
    fixture.extra.debtService = 110000;
    fixture.extra.overdueWages = 18000;
    fixture.extra.overdueSuppliers = 125000;
  }),
  mutate('20_benchmark_quartili_uguali', fixture => {
    fixture.benchmark[0].median = fixture.benchmark[0].q1;
  }),
  mutate('21_budget_forecast_con_mapping_custom', fixture => {
    fixture.customMappings = [
      { scheme: 'ce_va', code: '623000', allocations: [{ target: 'cv_personnel', share: 1 }] },
    ];
  }),
  mutate('22_centri_copertura_parziale', fixture => {
    fixture.centers = fixture.centers.filter(row => row.code !== '623000' && row.center === 'CENTRO_A');
  }),
  mutate('23_ebitda_negativo_e_senza_rimanenze', fixture => {
    account(fixture, '700000').current = -700000;
    account(fixture, '300000').current = 0;
    account(fixture, '129900').current = 710000;
    account(fixture, '572000').current = -614000;
  }),
  mutate('24_schema_ai_aix_tutti_bloccanti', fixture => {
    fixture.company.schema = '';
    fixture.forceSchemaBlank = true;
    fixture.extra.aiFindings = [{ blocking: true, closed: false, elemento: 'Sentinella fittizia' }];
    const aix = account(fixture, '129900');
    aix.code = 'TAL_AIX'; aix.technicalResult = true; aix.technicalOrigin = 'tool'; aix.resultStatus = 'proposed';
  }, { gateProbe: true }),
];

function xorshift32(seed) {
  let state = seed >>> 0;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 0x100000000;
  };
}

export function deterministicFuzzFixtures(count = 200, seed = 0x5a17c0de) {
  const random = xorshift32(seed);
  return Array.from({ length: count }, (_, index) => {
    const fixture = commonFixture();
    fixture.scenarios = { budget: [], forecast: [] };
    fixture.centers = [];
    fixture.history = [];
    fixture.benchmark = [];
    fixture.adjustments = index % 3 === 0 ? [{ currentEffect: (random() - 0.5) * 100000, previousEffect: (random() - 0.5) * 80000 }] : [];
    fixture.periods.previous.available = index % 9 !== 0;
    fixture.extra.firstYear = fixture.periods.previous.available ? 'no' : 'yes';
    fixture.extra.useAdjustedEbitda = index % 4 === 0;
    fixture.extra.cashFlowDebtService = Math.round(random() * 50000000) / 100;
    fixture.extra.debtService = index % 11 === 0 ? 0 : Math.round(random() * 50000000) / 100;
    fixture.extra.dscrHorizonMonths = index % 5 === 0 ? 11 : 12;
    fixture.accounts.forEach((row, rowIndex) => {
      const scale = 0.25 + random() * 2.75;
      const cents = Math.round((random() - 0.5) * 1000) / 1000;
      row.current = row.current * scale + cents;
      row.previous = row.previous * (0.25 + random() * 2.75) - cents;
      if ((index + rowIndex) % 37 === 0) row.current = 0;
      if ((index + rowIndex) % 53 === 0) row.current *= -1;
    });
    if (index % 7 === 0) account(fixture, '572000').current += [0.009, 0.5, 1.01][index % 3];
    return { index, seed, fixture };
  });
}

export const financialAnalysisFixtureMeta = {
  version: 1,
  goldenCases: financialAnalysisCases.length,
  fuzzCases: 200,
  schemes: ALL_SCHEMES,
  privacy: 'Solo dati fittizi; nessuna identità o documento reale.',
};
