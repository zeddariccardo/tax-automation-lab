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
  '.ico': 'image/x-icon',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
};

function startStaticServer(apiHandler) {
  const server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url || '/', 'http://127.0.0.1');
      if (url.pathname === '/api/financial-statement/calcola' && apiHandler) {
        const chunks = [];
        for await (const chunk of request) chunks.push(chunk);
        const headers = new Headers();
        Object.entries(request.headers).forEach(([key, value]) => {
          if (typeof value === 'string') headers.set(key, value);
        });
        const apiRequest = new Request('http://127.0.0.1' + url.pathname, {
          method: request.method,
          headers,
          body: request.method === 'GET' || request.method === 'HEAD'
            ? undefined : Buffer.concat(chunks),
        });
        const apiResponse = await apiHandler(apiRequest);
        response.writeHead(apiResponse.status, Object.fromEntries(apiResponse.headers.entries()));
        response.end(Buffer.from(await apiResponse.arrayBuffer()));
        return;
      }
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
      resolve({
        server,
        origin: `http://127.0.0.1:${address.port}`,
      });
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
  const n = value => {
    const number = Number(value || 0);
    return Number.isFinite(number) ? number : 0;
  };
  const cleanNumber = value => Object.is(value, -0) ? 0 : value;
  const leafKey = code => {
    if (!code) return '';
    return String(sectionOfLeaf(code) || 'unknown') + ':' + String(code);
  };
  const cellValue = cell => {
    if (cell && typeof cell === 'object' && Object.prototype.hasOwnProperty.call(cell, 'content')) {
      return String(cell.content == null ? '' : cell.content);
    }
    if (cell == null) return '';
    return String(cell);
  };
  const tableRows = rows => (rows || []).map(row => {
    const cells = Array.isArray(row) ? row : [row];
    return cells.map(cellValue);
  });

  function field(id, value) {
    const element = document.getElementById(id);
    if (!element) return;
    element.value = value == null ? '' : String(value);
  }

  function flattenNodes(section, nodes, output) {
    (nodes || []).forEach(node => {
      output[section + ':' + node.code] = {
        amount: cleanNumber(n(node.calculatedAmount ?? node.amount)),
        amountPrev: cleanNumber(n(node.calculatedAmountPrev ?? node.amountPrev)),
      };
      flattenNodes(section, node.children, output);
    });
  }

  function readChecks() {
    return Array.from(document.querySelectorAll('#tab_checks .check-item')).map(item => {
      const text = selector => {
        const element = item.querySelector(selector);
        return element ? element.textContent.trim().replace(/\s+/g, ' ') : '';
      };
      const status = item.classList.contains('fail') ? 'fail'
        : item.classList.contains('warn') ? 'warn'
          : item.classList.contains('ok') ? 'ok' : '';
      return {
        name: text('.name'),
        value: text('.value'),
        status,
      };
    });
  }

  function project() {
    if (!RESULT) throw new Error('RESULT non disponibile');
    const nodes = {};
    flattenNodes('sp_attivo', RESULT.sp_att.nodes, nodes);
    flattenNodes('sp_passivo', RESULT.sp_pas.nodes, nodes);
    flattenNodes('ce', RESULT.ce.nodes, nodes);

    const leaves = {};
    Object.keys(RESULT.byCode || {}).sort().forEach(code => {
      const row = RESULT.byCode[code];
      leaves[leafKey(code)] = {
        raw: cleanNumber(n(row.raw)),
        rawPrev: cleanNumber(n(row.rawPrev)),
        storno: cleanNumber(n(row.storno)),
        stornoPrev: cleanNumber(n(row.stornoPrev)),
        adjustment: cleanNumber(n(row.adjustment)),
        adjustmentPrev: cleanNumber(n(row.adjustmentPrev)),
      };
    });

    const checks = readChecks();
    const gate = window.fsExportGate();
    const technicalAix = RESULT.technicalAix && RESULT.technicalAix.present ? [{
      origin: RESULT.technicalAix.autoProposed ? 'TAL_AIX' : 'INPUT_TECNICO',
      status: RESULT.technicalAix.confirmed ? 'confirmed' : 'pending',
      current: cleanNumber(n(RESULT.technicalAix.current)),
      previous: cleanNumber(n(RESULT.technicalAix.previous)),
    }] : [];

    return {
      mode: RESULT.mode,
      comparative: {
        columnPresent: !!RESULT.comparativeColumnPresent,
        hasValues: !!RESULT.comparativeHasValues,
      },
      leaves,
      nodes,
      totals: {
        attivo: RESULT.totAtt,
        passivo: RESULT.totPas,
        attivoPrev: RESULT.totAttPrev,
        passivoPrev: RESULT.totPasPrev,
        ceResult: RESULT.ceResult,
        ceResultPrev: RESULT.ceResultPrev,
        ceTotals: clone(RESULT.ceTotals),
        ceTotalsPrev: clone(RESULT.ceTotalsPrev),
        pnAix: RESULT.pnAix,
        pnAixPrev: RESULT.pnAixPrev,
        pnCeDelta: RESULT.pnCeDelta,
        pnCeDeltaPrev: RESULT.pnCeDeltaPrev,
        adjustments: clone(RESULT.adjTotals),
      },
      mapping: {
        accounts: RESULT.accountRows.length,
        mapped: RESULT.accountRows.filter(row => row.status === 'mapped').length,
        manualOverrides: RESULT.accountRows.filter(row => row.manual).length,
        unmapped: RESULT.unmapped.length,
        invalid: RESULT.invalidMappings.length,
        duplicates: clone(RESULT.duplicates).sort(),
        sideAnomalies: (RESULT.sideAnomalies || []).map(row => ({
          leaf: leafKey(row.leaf),
          period: row.period,
          value: row.value,
          expected: row.expected,
        })),
      },
      storni: (STATE.storni || []).map(row => ({
        active: row.active !== false,
        from: leafKey(row.fromLeaf),
        to: leafKey(row.toLeaf),
        current: cleanNumber(n(row.amount)),
        previous: cleanNumber(n(row.amountPrev)),
        warning: row.active !== false && !!stornoUnbalances(row),
      })),
      adjustments: (STATE.adjustments || []).map(row => ({
        active: row.active !== false,
        lines: (row.lines || []).map(line => ({
          leaf: leafKey(line.leaf),
          dare: cleanNumber(n(line.dare)),
          avere: cleanNumber(n(line.avere)),
          darePrev: cleanNumber(n(line.darePrev)),
          averePrev: cleanNumber(n(line.averePrev)),
        })),
      })),
      technicalAix,
      checks,
      gate,
      ordinaryScenarioVerified: window.FS_XBRL_CONFIG.ordinaryScenarioVerified,
    };
  }

  function activeSchema() {
    const strip = section => ({
      nodes: (section.nodes || []).map(function walk(node) {
        const clean = { code: String(node.code) };
        if (node.leaves && node.leaves.length) clean.leaves = node.leaves.map(String);
        if (node.children && node.children.length) clean.children = node.children.map(walk);
        return clean;
      }),
    });
    const read = schema => ({
      sp_attivo: strip(schema.sp_attivo),
      sp_passivo: strip(schema.sp_passivo),
      ce: strip(schema.ce),
    });
    return { abbrev: read(window.SCHEMA), ordinary: read(window.SCHEMA_ORD) };
  }

  function postMappingPayload() {
    if (!window.fsFinancialStatementApi) throw new Error('bridge API autorevole non disponibile');
    return window.fsFinancialStatementApi.buildPayload();
  }

  async function authoritativeRun(force) {
    if (!window.fsFinancialStatementApi) throw new Error('bridge API autorevole non disponibile');
    const run = await window.fsFinancialStatementApi.runNow(!!force);
    if (!run) throw new Error('risultato autorevole non disponibile');
    return {
      payload: clone(run.payload),
      payloadBytes: run.payloadBytes,
      local: project(),
      backend: clone(run.backend),
      requests: run.requests,
      cached: !!run.cached,
    };
  }

  async function concurrentAuthoritativeRun(count) {
    return Promise.all(Array.from({ length: count || 2 }, () => authoritativeRun(false)));
  }

  function resetAuthoritative() {
    if (window.fsFinancialStatementApi) window.fsFinancialStatementApi.reset();
  }

  function xbrlFacts() {
    const data = window.fsXbrlFacts();
    return {
      ordinary: !!data.ord,
      facts: (data.facts || []).map(fact => ({
        element: fact.el,
        current: cleanNumber(n(fact.cur)),
        previous: cleanNumber(n(fact.prev)),
      })).sort((a, b) => a.element.localeCompare(b.element)),
      skipped: clone(data.skipped || []).sort(),
      aggregated: clone(data.aggregated || []).sort(),
    };
  }

  function workbookSemantic(workbook, filename) {
    return {
      filename: String(filename || ''),
      sheets: workbook.SheetNames.map(name => ({
        name,
        rows: XLSX.utils.sheet_to_json(workbook.Sheets[name], {
          header: 1,
          raw: true,
          defval: null,
        }).map(row => row[0] === 'Data esportazione' ? [row[0], '<dynamic>'] : row),
      })),
    };
  }

  async function captureExcel() {
    const captured = [];
    const original = XLSX.writeFile;
    XLSX.writeFile = (workbook, filename) => captured.push(workbookSemantic(workbook, filename));
    try {
      window.exportExcel();
      window.exportOfficialExcel();
      await new Promise(resolve => setTimeout(resolve, 20));
    } finally {
      XLSX.writeFile = original;
    }
    return captured;
  }

  async function capturePdf() {
    const captured = [];
    const OriginalPdf = window.jspdf.jsPDF;
    class FakePdf {
      constructor() {
        this.pages = 1;
        this.currentPage = 1;
        this.texts = [];
        this.tables = [];
        this.filename = '';
        this.lastAutoTable = { finalY: 20 };
        this.internal = { getNumberOfPages: () => this.pages };
        captured.push(this);
      }
      setFont() { return this; }
      setFontSize() { return this; }
      setTextColor() { return this; }
      setFillColor() { return this; }
      setDrawColor() { return this; }
      setLineWidth() { return this; }
      line() { return this; }
      rect() { return this; }
      text(value) {
        const rendered = Array.isArray(value) ? value.map(cellValue).join(' | ') : cellValue(value);
        this.texts.push({ page: this.currentPage, value: rendered });
        return this;
      }
      autoTable(options = {}) {
        this.tables.push({
          page: this.currentPage,
          head: tableRows(options.head),
          body: tableRows(options.body),
          foot: tableRows(options.foot),
        });
        const bodyLength = (options.body || []).length;
        this.lastAutoTable = { finalY: n(options.startY) + Math.max(8, bodyLength * 3) };
        return this;
      }
      addPage() { this.pages += 1; this.currentPage = this.pages; return this; }
      setPage(page) { this.currentPage = page; return this; }
      getNumberOfPages() { return this.pages; }
      save(filename) { this.filename = String(filename || ''); return this; }
    }
    window.jspdf.jsPDF = FakePdf;
    try {
      window.exportPDF('detail');
      window.exportOfficialPDF();
      await new Promise(resolve => setTimeout(resolve, 20));
    } finally {
      window.jspdf.jsPDF = OriginalPdf;
    }
    return captured.map(doc => ({
      filename: doc.filename,
      pages: doc.pages,
      texts: doc.texts,
      tables: doc.tables,
    }));
  }

  function accountDetail() {
    return Object.fromEntries(Object.keys(RESULT.byCode || {}).sort().map(code => {
      const row = RESULT.byCode[code];
      return [leafKey(code), {
        raw: cleanNumber(n(row.raw)),
        rawPrev: cleanNumber(n(row.rawPrev)),
        storno: cleanNumber(n(row.storno)),
        stornoPrev: cleanNumber(n(row.stornoPrev)),
        adjustment: cleanNumber(n(row.adjustment)),
        adjustmentPrev: cleanNumber(n(row.adjustmentPrev)),
        accounts: (row.accounts || []).map(account => ({
          code: String(account.code || ''),
          desc: String(account.desc || ''),
          current: cleanNumber(n(account.importo)),
          previous: cleanNumber(n(account.importo_prev)),
          presented: cleanNumber(n(account.presented)),
          presentedPrev: cleanNumber(n(account.presentedPrev)),
          storno: !!account.storno,
          adjustment: !!account.adj,
        })),
      }];
    }));
  }

  async function archivedState() {
    const button = document.getElementById('fs_save_btn');
    if (!button) throw new Error('pulsante archivio non disponibile');
    const originalConfirm = window.confirm;
    window.confirm = () => true;
    try {
      button.click();
      await new Promise(resolve => setTimeout(resolve, 20));
    } finally {
      window.confirm = originalConfirm;
    }
    const archive = JSON.parse(localStorage.getItem('fs_archive_v1') || '{"clients":{}}');
    const key = String((document.getElementById('an_piva') || {}).value ||
      (document.getElementById('an_cf') || {}).value || '').trim().toUpperCase();
    const client = archive.clients && archive.clients[key];
    const year = String((document.getElementById('an_periodo_a') || {}).value || '').match(/\d{4}/);
    const saved = client && year && client.years && client.years[year[0]];
    if (!saved) throw new Error('fascicolo fittizio non archiviato');
    return clone(saved.state);
  }

  async function semanticBundle() {
    return {
      project: project(),
      xbrl: xbrlFacts(),
      excel: await captureExcel(),
      pdf: await capturePdf(),
      detail: accountDetail(),
      archive: await archivedState(),
    };
  }

  async function captureAuthoritativeOutputs() {
    if (!window.fsFinancialStatementApi) throw new Error('bridge API autorevole non attivo');
    const before = window.fsFinancialStatementApi.metrics();
    const output = await semanticBundle();
    const after = window.fsFinancialStatementApi.metrics();
    return { output, requestsBefore: before.requests, requestsAfter: after.requests };
  }

  function serviceState() {
    const host = document.getElementById('fs_api_state');
    const buttons = Array.from(document.querySelectorAll('#export_content button'));
    return {
      hasResult: !!RESULT,
      status: window.fsFinancialStatementApi ? window.fsFinancialStatementApi.metrics().status : 'missing',
      message: host ? host.textContent.trim().replace(/\s+/g, ' ') : '',
      retryVisible: !!(host && host.querySelector('button') && host.offsetParent !== null),
      exportsDisabled: buttons.length > 0 && buttons.every(button => button.disabled),
      exportContentVisible: !!(document.getElementById('export_content') &&
        document.getElementById('export_content').offsetParent !== null),
    };
  }

  async function raceAccount(code, first, second) {
    if (!window.fsFinancialStatementApi) throw new Error('bridge API autorevole non disponibile');
    window.fsFinancialStatementApi.reset();
    const account = (STATE.accounts || []).find(row => String(row.code) === String(code));
    if (!account) throw new Error('conto di race non trovato');
    account.importo = first;
    const firstRun = window.fsFinancialStatementApi.runNow().catch(error => ({ error: error.message }));
    account.importo = second;
    const secondRun = window.fsFinancialStatementApi.runNow().catch(error => ({ error: error.message }));
    await Promise.all([firstRun, secondRun]);
    return { project: project(), metrics: window.fsFinancialStatementApi.metrics() };
  }

  async function load(fixture) {
    const defaults = {
      an_denom: 'Scenario Golden Fittizio S.r.l.',
      an_piva: '12345678901',
      an_cf: '12345678901',
      an_periodo_da: '2025-01-01',
      an_periodo_a: '2025-12-31',
      an_indirizzo: 'Via dei Test 1',
      an_cap: '00100',
      an_comune: 'Roma',
      an_provincia: 'RM',
      an_rea_prov: 'RM',
      an_rea_num: '0000000',
    };
    Object.entries(Object.assign(defaults, fixture.anagrafica || {})).forEach(([id, value]) => field(id, value));
    field('an_schema', fixture.schema === 'ordinary' ? 'ordinary' : 'abbrev');
    if (window.fsFinancialStatementApi) window.fsFinancialStatementApi.reset();
    STATE = {
      accounts: clone(fixture.accounts || []),
      leafOverrides: clone(fixture.leafOverrides || {}),
      storni: clone(fixture.storni || []),
      adjustments: clone(fixture.adjustments || []),
      aiFindings: clone(fixture.aiFindings || []),
      comparativeColumnPresent: fixture.comparativeColumnPresent !== false,
      comparativeHasValues: fixture.comparativeHasValues !== undefined
        ? !!fixture.comparativeHasValues
        : (fixture.accounts || []).some(account => Math.abs(n(account.importo_prev)) >= 0.005),
      importMeta: {},
      technicalAix: fixture.confirmTechnical ? { confirmed: true } : null,
    };
    RESULT = null;
    if (fixture.confirmTechnical) {
      STATE.accounts.filter(account => account && account.technicalResult).forEach(account => {
        account.resultStatus = 'confirmed';
      });
    }
    await window.fsFinancialStatementApi.runNow();
    return {
      accounts: STATE.accounts.length,
      technical: STATE.accounts.filter(account => account && account.technicalResult).length,
    };
  }

  window.__financialStatementGolden = {
    activeSchema,
    captureExcel,
    capturePdf,
    captureAuthoritativeOutputs,
    concurrentAuthoritativeRun,
    authoritativeRun,
    load,
    postMappingPayload,
    project,
    raceAccount,
    resetAuthoritative,
    serviceState,
    xbrlFacts,
    apiMetrics: () => window.fsFinancialStatementApi
      ? window.fsFinancialStatementApi.metrics() : null,
  };
})();
`;

export async function startFinancialStatementHarness(options = {}) {
  const { server, origin } = await startStaticServer(options.apiHandler);
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
    await page.goto(`${origin}/tools/financial-statement/`, { waitUntil: 'load' });
    await page.addScriptTag({ content: PAGE_BRIDGE });
    await page.waitForFunction(() => !!window.__financialStatementGolden);
  } catch (error) {
    if (browser) await browser.close();
    await stopStaticServer(server);
    throw error;
  }

  return {
    consoleErrors,
    async load(fixture) {
      return page.evaluate(value => window.__financialStatementGolden.load(value), fixture);
    },
    async project() {
      return page.evaluate(() => window.__financialStatementGolden.project());
    },
    async activeSchema() {
      return page.evaluate(() => window.__financialStatementGolden.activeSchema());
    },
    async postMappingPayload() {
      return page.evaluate(() => window.__financialStatementGolden.postMappingPayload());
    },
    async authoritativeRun(force = false) {
      return page.evaluate(value => window.__financialStatementGolden.authoritativeRun(value), force);
    },
    async concurrentAuthoritativeRun(count = 2) {
      return page.evaluate(value => window.__financialStatementGolden.concurrentAuthoritativeRun(value), count);
    },
    async resetAuthoritative() {
      return page.evaluate(() => window.__financialStatementGolden.resetAuthoritative());
    },
    async xbrlFacts() {
      return page.evaluate(() => window.__financialStatementGolden.xbrlFacts());
    },
    async captureExcel() {
      return page.evaluate(() => window.__financialStatementGolden.captureExcel());
    },
    async capturePdf() {
      return page.evaluate(() => window.__financialStatementGolden.capturePdf());
    },
    async captureAuthoritativeOutputs() {
      return page.evaluate(() => window.__financialStatementGolden.captureAuthoritativeOutputs());
    },
    async apiMetrics() {
      return page.evaluate(() => window.__financialStatementGolden.apiMetrics());
    },
    async serviceState() {
      return page.evaluate(() => window.__financialStatementGolden.serviceState());
    },
    async uiAudit(width, height) {
      await page.setViewportSize({ width, height });
      return page.evaluate(() => {
        window.fsShowView('anagrafica');
        const root = document.documentElement;
        const form = document.querySelector('#view-anagrafica .grid');
        const formFields = [...document.querySelectorAll('#view-anagrafica input, #view-anagrafica select, #view-anagrafica textarea')];
        const columnCount = form ? getComputedStyle(form).gridTemplateColumns.split(/\s+/).filter(Boolean).length : 0;
        const fieldsOffscreen = formFields.filter(element => {
          const rect = element.getBoundingClientRect();
          return rect.left < -1 || rect.right > root.clientWidth + 1;
        }).map(element => element.id);

        window.fsShowView('results');
        document.querySelector('#results_tabs [data-tab="checks"]')?.click();
        const tabs = [...document.querySelectorAll('#results_tabs .tab')].map(element => {
          const rect = element.getBoundingClientRect();
          return { text: element.textContent.trim(), width: rect.width, height: rect.height };
        });
        const details = document.querySelector('.fs-check-details');
        return {
          viewport: { width: innerWidth, height: innerHeight },
          horizontalOverflow: Math.max(0, root.scrollWidth - root.clientWidth),
          columnCount,
          fieldsOffscreen,
          tabMaxHeight: Math.max(0, ...tabs.map(tab => tab.height)),
          tabMaxWidth: Math.max(0, ...tabs.map(tab => tab.width)),
          headline: document.querySelector('.fs-check-status h3')?.textContent.trim() || '',
          detailsClosed: !!details && !details.open,
          controlCount: document.querySelectorAll('.fs-check-details .check-item').length,
        };
      });
    },
    async clickRetry() {
      await page.click('#fs_api_state button');
      await page.waitForFunction(() => window.fsFinancialStatementApi &&
        (!!window.fsFinancialStatementApi.currentResult() ||
          window.fsFinancialStatementApi.metrics().status === 'error'));
      return page.evaluate(() => window.__financialStatementGolden.serviceState());
    },
    async raceAccount(code, first, second) {
      return page.evaluate(values => window.__financialStatementGolden.raceAccount(
        values.code, values.first, values.second,
      ), { code, first, second });
    },
    async close() {
      await browser.close();
      await stopStaticServer(server);
    },
  };
}
