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
        amount: cleanNumber(n(node.amount)),
        amountPrev: cleanNumber(n(node.amountPrev)),
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
        raw: cleanNumber(n(row.sumRaw)),
        rawPrev: cleanNumber(n(row.sumRawPrev)),
        storno: cleanNumber(n(row.sumStornoRaw)),
        stornoPrev: cleanNumber(n(row.sumStornoRawPrev)),
        adjustment: cleanNumber(n(row.sumAdj)),
        adjustmentPrev: cleanNumber(n(row.sumAdjPrev)),
      };
    });

    const checks = readChecks();
    const gate = window.fsExportGate();
    const technicalAix = (STATE.accounts || []).filter(account => account && account.technicalResult).map(account => ({
      origin: account.technicalOrigin || '',
      status: account.resultStatus || '',
      current: cleanNumber(n(account.importo)),
      previous: cleanNumber(n(account.importo_prev)),
    }));

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

  function load(fixture) {
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
    window.__talFsReconciliation = null;
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
    };
    RESULT = null;
    if (fixture.reconcile) window.fsPostLoadReconcile('golden');
    if (fixture.confirmTechnical) {
      STATE.accounts.filter(account => account && account.technicalResult).forEach(account => {
        account.resultStatus = 'confirmed';
      });
    }
    window.refreshAll(true);
    return {
      accounts: STATE.accounts.length,
      technical: STATE.accounts.filter(account => account && account.technicalResult).length,
    };
  }

  window.__financialStatementGolden = {
    captureExcel,
    capturePdf,
    load,
    project,
    xbrlFacts,
  };
})();
`;

export async function startFinancialStatementHarness() {
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
    async xbrlFacts() {
      return page.evaluate(() => window.__financialStatementGolden.xbrlFacts());
    },
    async captureExcel() {
      return page.evaluate(() => window.__financialStatementGolden.captureExcel());
    },
    async capturePdf() {
      return page.evaluate(() => window.__financialStatementGolden.capturePdf());
    },
    async close() {
      await browser.close();
      await stopStaticServer(server);
    },
  };
}
