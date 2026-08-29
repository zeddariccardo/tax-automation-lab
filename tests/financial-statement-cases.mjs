const sp = (code, voce, current, previous = 0, desc = 'Conto patrimoniale fittizio') => ({
  code,
  desc,
  source: 'sp',
  voce,
  importo: current,
  importo_prev: previous,
});

const ce = (code, voce, current, previous = 0, desc = 'Conto economico fittizio') => ({
  code,
  desc,
  source: 'ce',
  voce,
  importo: current,
  importo_prev: previous,
});

export const financialStatementCases = [
  {
    name: 'abbreviato_utile_erp_comparativo',
    exports: true,
    fixture: {
      schema: 'abbrev',
      comparativeColumnPresent: true,
      comparativeHasValues: true,
      accounts: [
        sp('ATT-CASSA', 'CIV', 200, 150),
        sp('PN-CAP', 'AI', -80, -80),
        sp('PN-RIS', 'AVI', -20, -20),
        sp('ERP-AIX', 'AIX', -100, -50, "Utile dell'esercizio ERP fittizio"),
        ce('RICAVI', 'A1', -300, -200),
        ce('SERVIZI', 'B7', 200, 150),
      ],
    },
  },
  {
    name: 'abbreviato_perdita_tal_aix',
    fixture: {
      schema: 'abbrev',
      comparativeColumnPresent: false,
      comparativeHasValues: false,
      reconcile: true,
      confirmTechnical: true,
      accounts: [
        sp('ATT-CASSA', 'CIV', 80),
        sp('PN-CAP', 'AI', -100),
        ce('RICAVI', 'A1', -50),
        ce('SERVIZI', 'B7', 70),
      ],
    },
  },
  {
    name: 'ordinario_codici_b_c_d_qualificati',
    exports: true,
    fixture: {
      schema: 'ordinary',
      comparativeColumnPresent: true,
      comparativeHasValues: true,
      accounts: [
        sp('ATT-B', 'BII1', 300, 280),
        sp('ATT-C', 'CII1', 150, 140),
        sp('ATT-D', 'D_ATT', 50, 60),
        sp('PAS-A', 'AI', -200, -200),
        sp('PAS-B', 'B1', -50, -45),
        sp('PAS-C', 'C', -30, -25),
        sp('PAS-D', 'D7', -200, -190),
        sp('PAS-E', 'E', -20, -20),
        ce('CE-C', 'C16A', -10, -8),
        ce('CE-D', 'D18A', 10, 8),
      ],
    },
  },
  {
    name: 'comparativo_assente_subcentesimi',
    fixture: {
      schema: 'abbrev',
      comparativeColumnPresent: false,
      comparativeHasValues: false,
      accounts: [
        sp('ATT-SUBCENT', 'CIV', 100.004),
        sp('PAS-SUBCENT', 'AI', -100),
      ],
    },
  },
  {
    name: 'segni_opposti',
    fixture: {
      schema: 'abbrev',
      comparativeColumnPresent: false,
      comparativeHasValues: false,
      accounts: [
        sp('ATT-NEG', 'CIV', -10, 0, 'Attività fittizia con segno opposto'),
        sp('PAS-POS', 'AI', 10, 0, 'Passività fittizia con segno opposto'),
        ce('RIC-POS', 'A1', 5, 0, 'Ricavo fittizio con segno opposto'),
        ce('COST-NEG', 'B7', -5, 0, 'Costo fittizio con segno opposto'),
      ],
    },
  },
  {
    name: 'duplicati_non_mappati_override',
    fixture: {
      schema: 'abbrev',
      comparativeColumnPresent: false,
      comparativeHasValues: false,
      leafOverrides: { 'OVR-1': 'B7' },
      accounts: [
        sp('ATT-001', 'CIV', 100),
        sp(' Dup-01 ', 'AI', -40),
        sp('dup-01', 'AVI', -60),
        ce('NO-MAP', '', 0),
        ce('BAD-MAP', 'CIV', 0),
        ce('OVR-1', '', 0),
      ],
    },
  },
  {
    name: 'storno_fra_sezioni_con_segni',
    fixture: {
      schema: 'abbrev',
      comparativeColumnPresent: true,
      comparativeHasValues: true,
      accounts: [
        sp('ATT-001', 'CIV', 100, 80),
        sp('PAS-001', 'AI', -100, -80),
      ],
      storni: [
        { id: 'ST-ATTIVO', active: true, fromLeaf: 'CIV', toLeaf: 'AI', amount: 7.5, amountPrev: -2.5 },
        { id: 'ST-SPENTO', active: false, fromLeaf: '', toLeaf: 'CIV', amount: 999, amountPrev: 999 },
      ],
    },
  },
  {
    name: 'storno_esterno_da_verificare',
    fixture: {
      schema: 'abbrev',
      comparativeColumnPresent: false,
      comparativeHasValues: false,
      accounts: [
        sp('ATT-001', 'CIV', 100),
        sp('PAS-001', 'AI', -100),
      ],
      storni: [
        { id: 'ST-ESTERNO', active: true, fromLeaf: '', toLeaf: 'CIV', amount: 5, amountPrev: 0 },
      ],
    },
  },
  {
    name: 'rettifica_quadrata_tal_aix',
    fixture: {
      schema: 'abbrev',
      comparativeColumnPresent: false,
      comparativeHasValues: false,
      reconcile: true,
      confirmTechnical: true,
      accounts: [
        sp('ATT-001', 'CIV', 100),
        sp('PAS-001', 'AI', -80),
        ce('RICAVI', 'A1', -60),
        ce('SERVIZI', 'B7', 40),
      ],
      adjustments: [
        {
          active: true,
          desc: 'Rettifica fittizia quadrata',
          lines: [
            { leaf: 'CIV', dare: 0, avere: 10, darePrev: 0, averePrev: 0 },
            { leaf: 'B7', dare: 10, avere: 0, darePrev: 0, averePrev: 0 },
          ],
        },
      ],
    },
  },
  {
    name: 'rettifica_non_quadrata_e_spenta',
    fixture: {
      schema: 'abbrev',
      comparativeColumnPresent: false,
      comparativeHasValues: false,
      accounts: [
        sp('ATT-001', 'CIV', 100),
        sp('PAS-001', 'AI', -100),
      ],
      adjustments: [
        {
          active: true,
          desc: 'Rettifica fittizia non quadrata',
          lines: [{ leaf: 'CIV', dare: 1, avere: 0, darePrev: 0, averePrev: 0 }],
        },
        {
          active: false,
          desc: 'Rettifica fittizia spenta',
          lines: [{ leaf: 'CIV', dare: 5000, avere: 0, darePrev: 5000, averePrev: 0 }],
        },
      ],
    },
  },
  {
    name: 'importi_grandi_e_decimali',
    exports: true,
    fixture: {
      schema: 'abbrev',
      comparativeColumnPresent: true,
      comparativeHasValues: true,
      accounts: [
        sp('ATT-GRANDE', 'CIV', 123456789012.345, 9876543210.125),
        sp('PAS-GRANDE', 'AI', -123456789012.345, -9876543210.125),
        ce('RIC-GRANDE', 'A1', -1234567.891, -765432.109),
        ce('COST-GRANDE', 'B7', 1234567.891, 765432.109),
      ],
    },
  },
  {
    name: 'soglia_delta_0_004',
    fixture: {
      schema: 'abbrev',
      comparativeColumnPresent: false,
      comparativeHasValues: false,
      accounts: [sp('ATT-SOGLIA', 'CIV', 100.004), sp('PAS-SOGLIA', 'AI', -100)],
    },
  },
  {
    name: 'soglia_delta_0_011',
    fixture: {
      schema: 'abbrev',
      comparativeColumnPresent: false,
      comparativeHasValues: false,
      accounts: [sp('ATT-SOGLIA', 'CIV', 100.011), sp('PAS-SOGLIA', 'AI', -100)],
    },
  },
  {
    name: 'soglia_delta_0_50',
    fixture: {
      schema: 'abbrev',
      comparativeColumnPresent: false,
      comparativeHasValues: false,
      accounts: [sp('ATT-SOGLIA', 'CIV', 100.5), sp('PAS-SOGLIA', 'AI', -100)],
    },
  },
];
