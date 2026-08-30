import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.dirname(TEST_DIR);

const MIME = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
};

function startStaticServer() {
  const server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url || '/', 'http://127.0.0.1');
      let pathname = decodeURIComponent(url.pathname);
      if (pathname.endsWith('/')) pathname += 'index.html';
      const filename = path.resolve(REPO_ROOT, `.${pathname}`);
      const rootPrefix = `${path.resolve(REPO_ROOT)}${path.sep}`;
      if (filename !== path.resolve(REPO_ROOT) && !filename.startsWith(rootPrefix)) {
        response.writeHead(403).end('Forbidden');
        return;
      }
      const info = await stat(filename);
      if (!info.isFile()) throw new Error('Not a file');
      const body = await readFile(filename);
      response.writeHead(200, {
        'cache-control': 'no-store',
        'content-type': MIME[path.extname(filename).toLowerCase()] || 'application/octet-stream',
      });
      response.end(body);
    } catch {
      response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      response.end('Not found');
    }
  });
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      resolve({ server, origin: `http://127.0.0.1:${address.port}` });
    });
  });
}

function stopStaticServer(server) {
  server.close();
  if (typeof server.closeAllConnections === 'function') server.closeAllConnections();
  return Promise.resolve();
}

const PAGE_BRIDGE = String.raw`
(() => {
  'use strict';
  const clone = value => JSON.parse(JSON.stringify(value));
  const cleanNumber = value => Object.is(value, -0) ? 0 : value;
  const clean = value => {
    if (typeof value === 'number') return Number.isFinite(value) ? cleanNumber(value) : null;
    if (Array.isArray(value)) return value.map(clean);
    if (value && typeof value === 'object') {
      return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, clean(item)]));
    }
    return value;
  };
  const num = value => {
    const parsed = Number(value || 0);
    return Number.isFinite(parsed) ? cleanNumber(parsed) : 0;
  };
  const norm = value => String(value == null ? '' : value)
    .normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

  function assignTechnicalKeys(accounts) {
    const counts = new Map();
    (accounts || []).forEach((account, index) => {
      const base = String(account.type || '') + '|' + String(account.code || '').trim() + '|' + norm(account.desc);
      const occurrence = (counts.get(base) || 0) + 1;
      counts.set(base, occurrence);
      account.row = account.row || index + 2;
      account.originalCode = account.originalCode || account.code;
      account.techKey = account.techKey || base + '|' + occurrence;
      account.subaccountIndex = occurrence;
    });
  }

  function allSchemeNames() {
    return Object.keys(SCHEME_TARGETS).sort();
  }

  function findGroup(scheme, reference) {
    const groups = relevantGroups(STATE.accounts, SCHEME_TARGETS[scheme].type);
    const occurrence = Number(reference.occurrence || 1);
    return groups.filter(group => String(group.code) === String(reference.code))[occurrence - 1] || null;
  }

  function applyCustomMappings(rows) {
    (rows || []).forEach(spec => {
      const group = findGroup(spec.scheme, spec);
      if (!group) throw new Error('Gruppo non trovato per mapping: ' + spec.scheme + '/' + spec.code);
      const current = groupAmount(group, 'current');
      const previous = groupAmount(group, 'previous');
      STATE.reclassMap[spec.scheme] ||= {};
      STATE.reclassMap[spec.scheme][group.key] = spec.allocations.map((allocation, index) => ({
        id: 'golden-' + (index + 1),
        target: allocation.target,
        current: current * Number(allocation.share),
        previous: previous * Number(allocation.share),
      }));
    });
  }

  function confirmClassifications() {
    const props = ['currentClass', 'nature', 'pfn', 'function', 'behavior'];
    STATE.accounts.forEach(account => {
      const attr = getAttr(account);
      if (account.attrs) Object.assign(attr, account.attrs);
      props.forEach(prop => {
        if (attr[prop] && attr[prop + 'Status'] !== 'auto') attr[prop + 'Status'] = 'confirmed';
      });
    });
  }

  function coreSnapshot(accounts, field) {
    const copy = Array.from(accounts || []);
    return { ce: clean(ceCore(copy, field)), sp: clean(spCore(copy, field)) };
  }

  function technicalSnapshot(accounts, field) {
    return {
      civilistico: coreSnapshot(accounts, field),
      schemi: Object.fromEntries(allSchemeNames().map(scheme => [
        scheme,
        clean(aggregateScheme(scheme, accounts, field)),
      ])),
    };
  }

  function technicalInput() {
    const selected = Array.from(STATE.selected).sort();
    const centerNames = Array.from(new Set((STATE.centers || []).map(row => row.center))).sort();
    const extraNames = [
      'employeesCurrent', 'employeesPrevious', 'cashFlowDebtService', 'debtService',
      'purchasesCurrent', 'vatSalesPct', 'vatPurchasesPct', 'interestCoverageExpense',
      'dscrHorizonMonths', 'cfOtherOperating', 'cfInterestPaid', 'cfTaxPaid',
      'cfCapex', 'cfDisposals', 'cfOtherInvesting', 'cfDebtFlow', 'cfCapital',
      'cfDividends', 'cfOtherFinancing', 'cfOtherUnreconstructed', 'overdueWages',
      'overdueSuppliers', 'taxSocialDebt', 'capitalLoss', 'minimumCapital',
    ];
    const assumptions = Object.fromEntries(extraNames.map(key => {
      const value = STATE.extra ? STATE.extra[key] : null;
      return [key, value === '' || value == null ? null : num(value)];
    }));
    assumptions.useAdjustedEbitda = !!(STATE.extra && (STATE.extra.useAdjustedEbitda === true || STATE.extra.useAdjustedEbitda === 'true'));
    return clean({
      version: 1,
      comparative: {
        present: !!(STATE.periods && STATE.periods.previous && STATE.periods.previous.available),
        days: num(STATE.company.days || 365),
      },
      selected,
      periods: {
        current: technicalSnapshot(STATE.accounts, 'current'),
        previous: technicalSnapshot(STATE.accounts, 'previous'),
      },
      adjustments: {
        current: num(adjustmentTotal('current')),
        previous: num(adjustmentTotal('previous')),
      },
      assumptions,
      scenarios: Object.fromEntries(['budget', 'forecast'].map(kind => [kind,
        STATE.scenarios && STATE.scenarios[kind] && STATE.scenarios[kind].length
          ? technicalSnapshot(STATE.scenarios[kind], 'current') : null,
      ])),
      centers: centerNames.map((name, slot) => ({
        slot,
        period: technicalSnapshot(centerAccounts(name), 'current'),
      })),
      history: (STATE.history || []).map((row, slot) => ({
        slot,
        period: technicalSnapshot(row.accounts || [], row.field || 'current'),
      })),
      benchmark: (STATE.benchmark || []).map(row => ({
        kpi: String(row.code || ''),
        unit: String(row.unit || ''),
        q1: row.q1Present === false ? null : num(row.q1),
        median: row.medianPresent === false ? null : num(row.median),
        q3: row.q3Present === false ? null : num(row.q3),
      })).sort((a, b) => a.kpi.localeCompare(b.kpi)),
    });
  }

  function reclassificationSnapshot() {
    return clean(v17SectionModels().map(model => ({
      scheme: String(model.scheme || ''),
      title: String(model.title || ''),
      rows: (model.rows || []).map(row => ({
        label: String(row.label || ''),
        current: num(row.current),
        previous: num(row.previous),
        kind: String(row.kind || ''),
        target: String(row.target || ''),
      })),
    })));
  }

  function kpiSnapshot() {
    return clean(makeKpis().map(item => ({
      code: item.code,
      family: item.family,
      value: item.value,
      currentValue: item.currentValue,
      previousValue: item.previousValue,
      unit: item.unit,
      formula: item.formula,
      status: item.status,
      note: item.note || '',
      issueSeverity: item.issueSeverity || '',
      issue: item.issue || '',
      dataBasis: item.dataBasis || '',
    })));
  }

  function scenarioSnapshot() {
    return clean(Object.fromEntries(['budget', 'forecast'].map(kind => {
      const accounts = STATE.scenarios && STATE.scenarios[kind] || [];
      return [kind, accounts.length ? scenarioMetricRows(accounts) : []];
    })));
  }

  function centerSnapshot() {
    const names = Array.from(new Set((STATE.centers || []).map(row => row.center))).sort();
    return clean(names.map((name, slot) => ({
      slot,
      ce: ceCore(centerAccounts(name)),
    })));
  }

  function historySnapshot() {
    return clean(historyMetrics().map((row, slot) => ({
      slot,
      revenue: row.revenue,
      ebitda: row.ebitda,
      ebit: row.ebit,
      net: row.net,
      equity: row.equity,
      pfn: row.pfn,
      ccn: row.ccn,
      roe: row.roe,
      assetTurnover: row.assetTurnover,
      pfnEbitda: row.pfnEbitda,
      currentRatio: row.currentRatio,
      basis: row.basis,
    })));
  }

  function reportCenterSnapshot() {
    renderReportCenter();
    const host = document.getElementById('reportcenter-content');
    return Array.from(host ? host.querySelectorAll('.check-item') : []).map(item => ({
      name: item.querySelector('.name')?.textContent.trim() || '',
      value: item.querySelector('.value')?.textContent.trim() || '',
      desc: item.querySelector('.desc')?.textContent.trim() || '',
      status: item.classList.contains('fail') ? 'fail' : item.classList.contains('warn') ? 'warn' : 'ok',
    }));
  }

  function protectedExports() {
    const names = [
      'exportExcel', 'exportKpiExcel', 'exportCashFlowExcel', 'exportAdequacyExcel',
      'exportHistoryExcel', 'exportAdvancedExcel', 'printReclassReport', 'printKpiReport',
      'printCashFlowReport', 'printAdequacyReport', 'printAdvancedReport', 'printReport',
    ];
    return Object.fromEntries(names.map(name => [name, {
      exists: typeof window[name] === 'function',
      protected: !!(window[name] && window[name].__talResultGate),
    }]));
  }

  function semanticWorkbook(workbook, filename) {
    return {
      filename: String(filename || '').replace(/\d{4}-\d{2}-\d{2}[^.]*/g, '<dynamic>'),
      sheets: workbook.SheetNames.map(name => ({
        name,
        rows: XLSX.utils.sheet_to_json(workbook.Sheets[name], {
          header: 1,
          raw: true,
          defval: null,
        }).map(row => row.map(clean)),
      })),
    };
  }

  async function captureExcel() {
    const captured = [];
    const originalWindow = window.writeWorkbookFile;
    const originalXlsxWriteFile = XLSX.writeFile;
    let originalLexical;
    try { originalLexical = writeWorkbookFile; } catch (_) { originalLexical = null; }
    const fake = async (workbook, filename) => {
      captured.push(semanticWorkbook(workbook, filename));
      return true;
    };
    window.writeWorkbookFile = fake;
    XLSX.writeFile = (workbook, filename) => captured.push(semanticWorkbook(workbook, filename));
    try { writeWorkbookFile = fake; } catch (_) { }
    try {
      for (const name of ['exportExcel', 'exportKpiExcel', 'exportCashFlowExcel', 'exportAdequacyExcel', 'exportHistoryExcel', 'exportAdvancedExcel']) {
        if (typeof window[name] === 'function') await window[name]();
      }
    } finally {
      window.writeWorkbookFile = originalWindow;
      XLSX.writeFile = originalXlsxWriteFile;
      try { if (originalLexical) writeWorkbookFile = originalLexical; } catch (_) { }
    }
    return clean(captured);
  }

  function semanticPrint(html, index) {
    const template = document.createElement('template');
    template.innerHTML = String(html || '');
    const root = template.content;
    return {
      index,
      title: root.querySelector('title')?.textContent.trim() || '',
      headings: Array.from(root.querySelectorAll('h1,h2,h3')).map(node => node.textContent.trim().replace(/\s+/g, ' ')),
      tables: Array.from(root.querySelectorAll('table')).map(table => Array.from(table.rows).map(row =>
        Array.from(row.cells).map(cell => cell.textContent.trim().replace(/\s+/g, ' ')))),
      notes: Array.from(root.querySelectorAll('.meta,.note,.warning,.warn')).map(node => node.textContent.trim().replace(/\s+/g, ' ')),
    };
  }

  async function capturePdf() {
    const html = [];
    const originalOpen = window.open;
    window.open = () => {
      let body = '';
      return {
        document: {
          write(value) { body += String(value || ''); },
          close() { html.push(body); },
          fonts: { ready: Promise.resolve() },
          images: [],
        },
        focus() {},
        print() {},
      };
    };
    try {
      if (typeof window.printReclassReport === 'function') window.printReclassReport('synthetic');
      for (const name of ['printKpiReport', 'printCashFlowReport', 'printAdequacyReport', 'printAdvancedReport', 'printReport']) {
        if (typeof window[name] === 'function') window[name]();
      }
      await new Promise(resolve => setTimeout(resolve, 20));
    } finally {
      window.open = originalOpen;
    }
    return html.map(semanticPrint);
  }

  async function activeGateProbe() {
    const originalToast = window.toast;
    const messages = [];
    window.toast = (message, error) => messages.push({ message: String(message || ''), error: !!error });
    try { toast = window.toast; } catch (_) { }
    const before = await captureExcel();
    window.toast = originalToast;
    try { toast = originalToast; } catch (_) { }
    return { allowed: before.length > 0, messages, protected: protectedExports() };
  }

  async function gateMatrix() {
    const original = {
      loaded: STATE.loaded,
      schema: STATE.company.schema,
      diagnostics: clone(STATE.diagnostics || []),
      aiFindings: clone(STATE.extra.aiFindings || []),
    };
    const aix = (STATE.accounts || []).find(row => row.iv === 'AIX') || null;
    const sp = (STATE.accounts || []).find(row => row.type === 'SP') || null;
    const aixState = aix ? {
      technicalResult: aix.technicalResult,
      technicalOrigin: aix.technicalOrigin,
      resultStatus: aix.resultStatus,
    } : null;
    const spCurrent = sp ? sp.current : null;
    const restore = () => {
      STATE.loaded = original.loaded;
      STATE.company.schema = original.schema;
      STATE.diagnostics = clone(original.diagnostics);
      STATE.extra.aiFindings = clone(original.aiFindings);
      if (aix && aixState) Object.assign(aix, aixState);
      if (sp) sp.current = spCurrent;
    };
    const cases = [
      ['NOT_LOADED', () => { STATE.loaded = false; }],
      ['SCHEMA_REQUIRED', () => { STATE.company.schema = ''; }],
      ['IMPORT_ERRORS', () => { STATE.diagnostics = [{ level: 'error', text: 'Errore strutturale fittizio.' }]; }],
      ['AI_BLOCKING', () => { STATE.extra.aiFindings = [{ blocking: true, closed: false, elemento: 'Eccezione fittizia' }]; }],
      ['AIX_PENDING', () => { if (aix) Object.assign(aix, { technicalResult: true, technicalOrigin: 'tool', resultStatus: 'proposed' }); }],
      ['SP_UNBALANCED', () => { if (sp) sp.current = Number(sp.current || 0) + 0.5; }],
    ];
    const result = [];
    try {
      for (const [code, mutate] of cases) {
        restore();
        mutate();
        const blockers = faExportBlockers();
        const excel = await captureExcel();
        const pdf = await capturePdf();
        result.push({ code, blockers: blockers.map(row => row.code), excel: excel.length, pdf: pdf.length });
      }
    } finally {
      restore();
    }
    return clean(result);
  }

  function runtimeSources() {
    const names = [
      'accountKey', 'ceCore', 'spCore', 'aggregateScheme', 'v17SectionModels',
      'makeKpis', 'cashFlowModel', 'adequacyModel', 'dupontModel', 'bridgeModel',
      'historyMetrics', 'scenarioMetricRows', 'centerAccounts', 'renderReportCenter',
      'benchmarkAssessment', 'faSchemaIsDefined', 'faExportBlockers',
    ];
    const functions = Object.fromEntries(names.map(name => {
      try {
        const fn = eval(name);
        return [name, typeof fn === 'function' ? Function.prototype.toString.call(fn) : null];
      } catch (_) {
        return [name, null];
      }
    }));
    functions.v20Health = typeof window.v20Health === 'function'
      ? Function.prototype.toString.call(window.v20Health) : null;
    const scriptIds = [
      'fa-v17-patch', 'fa-v17-final-patch', 'fa-v18-remediation',
      'tal-fa-v200', 'tal-fa-v204-result-reconciliation', 'fa-audit-remediation',
    ];
    const scripts = Object.fromEntries(scriptIds.map(id => [id, document.getElementById(id)?.textContent || null]));
    return { functions, scripts, protected: protectedExports() };
  }

  async function snapshot(options = {}) {
    const result = {
      inputTechnical: technicalInput(),
      reclassifications: reclassificationSnapshot(),
      kpis: kpiSnapshot(),
      cashFlow: clean(cashFlowModel()),
      adequacy: clean(adequacyModel()),
      dupont: clean(dupontModel()),
      benchmark: clean(typeof window.v20Health === 'function' ? window.v20Health() : null),
      bridge: clean(bridgeModel()),
      scenarios: scenarioSnapshot(),
      centers: centerSnapshot(),
      history: historySnapshot(),
      gateSummary: reportCenterSnapshot(),
      protectedExports: protectedExports(),
    };
    if (options.outputs) {
      result.outputs = {
        excel: await captureExcel(),
        pdf: await capturePdf(),
      };
    }
    if (options.gateProbe) result.gateProbe = await activeGateProbe();
    return clean(result);
  }

  async function load(fixture) {
    const data = clone(fixture || {});
    localStorage.clear();
    STATE.company = Object.assign({
      name: 'Scenario Golden Fittizio S.r.l.', vat: '', cf: '', currency: 'EUR', schema: 'abbrev',
      periodFrom: '2025-01-01', periodTo: '2025-12-31', yearCurrent: 2025,
      yearPrevious: 2024, days: 365,
    }, data.company || {});
    STATE.accounts = data.accounts || [];
    assignTechnicalKeys(STATE.accounts);
    STATE.scenarios = data.scenarios || { budget: [], forecast: [] };
    assignTechnicalKeys(STATE.scenarios.budget || []);
    assignTechnicalKeys(STATE.scenarios.forecast || []);
    STATE.scenarioMeta = data.scenarioMeta || {};
    STATE.centers = data.centers || [];
    STATE.centerCatalog = data.centerCatalog || [];
    STATE.benchmark = data.benchmark || [];
    STATE.selected = new Set(data.selected || allSchemeNames());
    STATE.attrs = {};
    STATE.adjustments = data.adjustments || [];
    STATE.extra = Object.assign({ aiFindings: [] }, data.extra || {});
    STATE.diagnostics = data.diagnostics || [];
    STATE.files = { main: 'bilancio-fittizio.xlsx', budget: '', forecast: '', centers: '', benchmark: '' };
    STATE.fileMeta = {};
    STATE.loaded = true;
    STATE.periods = data.periods || { current: { available: true }, previous: { available: true } };
    STATE.reclassMap = {};
    STATE.mappingScheme = 'sp_fin';
    STATE.history = data.history || [];
    (STATE.history || []).forEach(row => assignTechnicalKeys(row.accounts || []));
    buildProposals();
    confirmClassifications();
    applyCustomMappings(data.customMappings || []);
    if (data.forceUnresolved) {
      const account = STATE.accounts.find(row => row.code === data.forceUnresolved.code);
      if (account) getAttr(account)[data.forceUnresolved.prop + 'Status'] = 'proposed';
    }
    if (typeof syncCompanyInputs === 'function') syncCompanyInputs();
    updateAll();
    if (data.forceSchemaBlank) {
      STATE.company.schema = '';
      const schema = document.getElementById('an_schema');
      if (schema) schema.value = '';
    }
    await new Promise(resolve => setTimeout(resolve, 10));
    return { accounts: STATE.accounts.length, schemes: allSchemeNames() };
  }

  function activeAnomalies() {
    const s = spCore();
    const report = reportCenterSnapshot();
    const scenario = STATE.scenarios.budget && STATE.scenarios.budget.length
      ? {
        actual: ceCore(),
        budget: ceCore(STATE.scenarios.budget),
        forecast: ceCore(STATE.scenarios.forecast),
        budgetMappedCeVa: aggregateScheme('ce_va', STATE.scenarios.budget, 'current'),
        forecastMappedCeVa: aggregateScheme('ce_va', STATE.scenarios.forecast, 'current'),
      } : null;
    const equalQuartile = STATE.benchmark.find(row => row.q1 === row.median || row.median === row.q3) || null;
    let schemaNavigationBlocked = null;
    if (!faSchemaIsDefined()) {
      setView('executive');
      schemaNavigationBlocked = document.getElementById('view-setup')?.classList.contains('active') || false;
    }
    return clean({
      tolerances: {
        difference: s.balanceDifference,
        sharedMonetaryTolerance: window.FA_SP_BAL_TOLERANCE,
        exportAccepts: Math.abs(s.balanceDifference) <= window.FA_SP_BAL_TOLERANCE,
        kpiMarksBalanceBad: Math.abs(s.balanceDifference) > window.FA_SP_BAL_TOLERANCE,
      },
      scenario,
      equalQuartile: equalQuartile ? {
        assessment: benchmarkAssessment(equalQuartile, { [equalQuartile.code]: 1 }),
        issues: benchmarkIssueList(equalQuartile, { [equalQuartile.code]: 1 }),
        acceptedByLookup: !!benchmarkFor(equalQuartile.code),
        health: typeof window.v20Health === 'function' ? window.v20Health() : null,
      } : null,
      protected: protectedExports(),
      report,
      schemaValueAfterRuntimeModels: STATE.company && STATE.company.schema || '',
      schemaNavigationBlocked,
      exportGateAllows: typeof window.faExportGate === 'function' ? window.faExportGate() : null,
      exportBlockers: typeof window.faExportBlockers === 'function' ? window.faExportBlockers() : [],
      blockersAbsentFromReport: {
        schema: !(STATE.company && STATE.company.schema) && !report.some(row => /schema/i.test(row.name)),
        ai: !!((STATE.extra.aiFindings || []).some(row => row.blocking && !row.closed)) && !report.some(row => /AI/i.test(row.name)),
        aix: !!STATE.accounts.some(row => row.technicalResult && row.resultStatus !== 'confirmed') && !report.some(row => /A\.IX/i.test(row.name)),
      },
    });
  }

  window.__financialAnalysisGolden = {
    activeAnomalies,
    captureExcel,
    capturePdf,
    gateMatrix,
    load,
    runtimeSources,
    snapshot,
    technicalInput,
  };
})();
`;

export async function startFinancialAnalysisHarness() {
  const { server, origin } = await startStaticServer();
  let browser;
  let context;
  let page;
  const consoleErrors = [];
  try {
    browser = await chromium.launch({ headless: true });
    context = await browser.newContext({ locale: 'it-IT' });
    page = await context.newPage();
    page.on('console', message => {
      if (message.type() === 'error') consoleErrors.push(message.text());
    });
    page.on('pageerror', error => consoleErrors.push(error.message));
    await page.goto(`${origin}/tools/financial-analysis/`, { waitUntil: 'domcontentloaded' });
    await page.addScriptTag({ content: PAGE_BRIDGE });
    await page.waitForFunction(() => !!window.__financialAnalysisGolden);
    return {
      page,
      consoleErrors,
      load: fixture => page.evaluate(value => window.__financialAnalysisGolden.load(value), fixture),
      snapshot: options => page.evaluate(value => window.__financialAnalysisGolden.snapshot(value), options || {}),
      runtimeSources: () => page.evaluate(() => window.__financialAnalysisGolden.runtimeSources()),
      activeAnomalies: () => page.evaluate(() => window.__financialAnalysisGolden.activeAnomalies()),
      gateMatrix: () => page.evaluate(() => window.__financialAnalysisGolden.gateMatrix()),
      technicalInput: () => page.evaluate(() => window.__financialAnalysisGolden.technicalInput()),
      close: async () => {
        await context?.close();
        await browser?.close();
        await stopStaticServer(server);
      },
    };
  } catch (error) {
    await context?.close().catch(() => {});
    await browser?.close().catch(() => {});
    await stopStaticServer(server);
    throw error;
  }
}
