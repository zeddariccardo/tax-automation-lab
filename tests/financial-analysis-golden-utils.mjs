import { createHash } from 'node:crypto';

export function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonicalize(value[key])]));
  }
  if (typeof value === 'number' && Object.is(value, -0)) return 0;
  return value;
}

export function fingerprint(value) {
  return createHash('sha256').update(JSON.stringify(canonicalize(value))).digest('hex');
}

function dscrProjection(snapshot) {
  const adequacyMetrics = (snapshot.adequacy && snapshot.adequacy.metrics || [])
    .filter(row => /DSCR|servizio del debito|orizzonte/i.test(String(row.name || row.formula || '')));
  const kpi = (snapshot.kpis || []).find(row => row.code === 'debt_dscr') || null;
  return { kpi, adequacyMetrics, signals: snapshot.adequacy && snapshot.adequacy.signals || [] };
}

export function snapshotFingerprints(snapshot) {
  const gate = {
    summary: snapshot.gateSummary,
    protected: snapshot.protectedExports,
    probe: snapshot.gateProbe || null,
  };
  return {
    inputTechnical: fingerprint(snapshot.inputTechnical),
    reclassifications: fingerprint(snapshot.reclassifications),
    kpis: fingerprint(snapshot.kpis),
    cashFlow: fingerprint(snapshot.cashFlow),
    dupont: fingerprint(snapshot.dupont),
    dscr: fingerprint(dscrProjection(snapshot)),
    benchmark: fingerprint(snapshot.benchmark),
    gate: fingerprint(gate),
    bridge: fingerprint(snapshot.bridge),
    scenarios: fingerprint(snapshot.scenarios),
    centers: fingerprint(snapshot.centers),
    history: fingerprint(snapshot.history),
    excelSemantic: fingerprint(snapshot.outputs ? snapshot.outputs.excel : []),
    pdfSemantic: fingerprint(snapshot.outputs ? snapshot.outputs.pdf : []),
    complete: fingerprint(snapshot),
  };
}

export function runtimeFingerprints(runtime) {
  return {
    functions: Object.fromEntries(Object.entries(runtime.functions).map(([name, source]) => [name, source ? fingerprint(source) : null])),
    scripts: Object.fromEntries(Object.entries(runtime.scripts).map(([name, source]) => [name, source ? fingerprint(source) : null])),
    protected: runtime.protected,
    complete: fingerprint(runtime),
  };
}

export function compactFuzzResult(snapshot) {
  const kpi = Object.fromEntries((snapshot.kpis || []).map(row => [row.code, {
    value: row.value,
    status: row.status,
  }]));
  return {
    input: fingerprint(snapshot.inputTechnical),
    result: fingerprint({
      reclassifications: snapshot.reclassifications,
      kpis: snapshot.kpis,
      cashFlow: snapshot.cashFlow,
      adequacy: snapshot.adequacy,
      dupont: snapshot.dupont,
      bridge: snapshot.bridge,
      gateSummary: snapshot.gateSummary,
    }),
    key: {
      revenue: kpi.grow_revenue || null,
      ebitdaMargin: kpi.prof_ebitda_margin || null,
      roe: kpi.prof_roe || null,
      pfnEbitda: kpi.debt_pfn_ebitda || null,
      dscr: kpi.debt_dscr || null,
      balance: snapshot.inputTechnical.periods.current.civilistico.sp.balanceDifference,
      cashResidual: snapshot.cashFlow && snapshot.cashFlow.residual != null
        ? snapshot.cashFlow.residual : null,
    },
  };
}
