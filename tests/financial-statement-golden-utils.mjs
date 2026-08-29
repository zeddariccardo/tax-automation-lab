import { createHash } from 'node:crypto';

function normalized(value) {
  if (Array.isArray(value)) return value.map(normalized);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, normalized(value[key])]));
  }
  if (typeof value === 'number' && Object.is(value, -0)) return 0;
  return value;
}
export function fingerprint(value) {
  return createHash('sha256').update(JSON.stringify(normalized(value))).digest('hex');
}

function sheetMetrics(files) {
  return (files || []).map(file => ({
    sheets: file.sheets.map(sheet => ({
      name: sheet.name,
      rows: sheet.rows.length,
      columns: sheet.rows.reduce((max, row) => Math.max(max, row.length), 0),
      semanticSha256: fingerprint(sheet.rows),
    })),
  }));
}

function pdfMetrics(documents) {
  return (documents || []).map(document => ({
    pages: document.pages,
    textItems: document.texts.length,
    tables: document.tables.length,
    tableRows: document.tables.reduce((sum, table) => sum + table.head.length + table.body.length + table.foot.length, 0),
    semanticSha256: fingerprint({ texts: document.texts, tables: document.tables }),
  }));
}

export function buildFinancialStatementSnapshot({ project, xbrl, excel = [], pdf = [] }) {
  const checkStatuses = Object.fromEntries(project.checks.map(check => [check.name, check.status]));
  return {
    fingerprints: {
      calculationSha256: fingerprint(project),
      leavesSha256: fingerprint(project.leaves),
      nodesSha256: fingerprint(project.nodes),
      totalsSha256: fingerprint(project.totals),
      mappingSha256: fingerprint(project.mapping),
      storniSha256: fingerprint(project.storni),
      adjustmentsSha256: fingerprint(project.adjustments),
      checksGateSha256: fingerprint({ checks: project.checks, gate: project.gate }),
      xbrlFactsSha256: fingerprint(xbrl),
      excelSemanticSha256: excel.length ? fingerprint(excel) : null,
      pdfSemanticSha256: pdf.length ? fingerprint(pdf) : null,
    },
    summary: {
      mode: project.mode,
      comparative: project.comparative,
      totals: project.totals,
      mapping: {
        accounts: project.mapping.accounts,
        mapped: project.mapping.mapped,
        manualOverrides: project.mapping.manualOverrides,
        unmapped: project.mapping.unmapped,
        invalid: project.mapping.invalid,
        duplicates: project.mapping.duplicates.length,
        sideAnomalies: project.mapping.sideAnomalies.length,
      },
      storni: project.storni.length,
      adjustments: project.adjustments.length,
      technicalAix: project.technicalAix,
      gate: project.gate,
      checkStatuses,
      ordinaryScenarioVerified: project.ordinaryScenarioVerified,
      xbrl: {
        ordinary: xbrl.ordinary,
        facts: xbrl.facts.length,
        skipped: xbrl.skipped.length,
        aggregated: xbrl.aggregated.length,
      },
      excel: sheetMetrics(excel),
      pdf: pdfMetrics(pdf),
    },
  };
}
