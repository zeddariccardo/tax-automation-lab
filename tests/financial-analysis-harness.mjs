import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const API_PATTERN = '**/api/financial-analysis/calcola';
const MIME = new Map([
  ['.html', 'text/html; charset=utf-8'], ['.js', 'text/javascript; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'], ['.json', 'application/json; charset=utf-8'],
  ['.woff2', 'font/woff2'], ['.png', 'image/png'], ['.svg', 'image/svg+xml'],
]);

function startServer() {
  return new Promise(resolve => {
    const server = http.createServer(async (request, response) => {
      try {
        const url = new URL(request.url, 'http://127.0.0.1');
        let relative = decodeURIComponent(url.pathname).replace(/^\/+/, '');
        if (!relative || relative.endsWith('/')) relative += 'index.html';
        const target = path.resolve(ROOT, relative);
        if (!target.startsWith(ROOT)) throw new Error('path');
        const body = await readFile(target);
        response.writeHead(200, { 'content-type': MIME.get(path.extname(target)) || 'application/octet-stream' });
        response.end(body);
      } catch (_) {
        response.writeHead(404).end('Not found');
      }
    });
    server.listen(0, '127.0.0.1', () => resolve({ server, origin: `http://127.0.0.1:${server.address().port}` }));
  });
}

const stopServer = server => new Promise(resolve => server.close(resolve));

export async function startFinancialAnalysisHarness({ apiHandler, viewport = { width: 1280, height: 900 } } = {}) {
  const { server, origin } = await startServer();
  let browser;
  let context;
  const consoleErrors = [];
  const requests = [];
  try {
    browser = await chromium.launch({ headless: true });
    context = await browser.newContext({ locale: 'it-IT', viewport });
    const page = await context.newPage();
    page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
    page.on('pageerror', error => consoleErrors.push(error.message));
    await page.route(API_PATTERN, async route => {
      const raw = route.request().postData() || '';
      requests.push(raw);
      if (!apiHandler) {
        await route.fulfill({ status: 503, contentType: 'application/json', body: '{"errore":{"codice":"test_no_backend"}}' });
        return;
      }
      try {
        const answer = await apiHandler(JSON.parse(raw), { raw, route, requests });
        if (answer && Object.prototype.hasOwnProperty.call(answer, 'status')) {
          await route.fulfill({
            status: answer.status,
            contentType: answer.contentType || 'application/json',
            headers: { 'cache-control': 'no-store', ...(answer.headers || {}) },
            body: typeof answer.body === 'string' ? answer.body : JSON.stringify(answer.body),
          });
        } else {
          await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'cache-control': 'no-store' }, body: JSON.stringify(answer) });
        }
      } catch (_) {
        await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ errore: { codice: 'test_handler' } }) });
      }
    });
    await page.goto(`${origin}/tools/financial-analysis/`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => !!window.FA_APP);
    await page.evaluate(() => window.FA_APP.configureForTests({ debounceMs: 0, timeoutMs: 2000 }));
    return {
      page, requests, consoleErrors,
      load: async fixture => {
        const before = await page.evaluate(() => window.FA_APP.diagnostics().requests);
        await page.evaluate(value => window.FA_APP.loadFixture(value), fixture);
        await page.waitForFunction(expected => {
          const state = window.FA_APP.diagnostics();
          return state.requests > expected && ['ready', 'error'].includes(state.status);
        }, before, { timeout: 15000 });
        return page.evaluate(() => window.FA_APP.diagnostics());
      },
      buildPayload: () => page.evaluate(() => window.FA_APP.buildPayload()),
      result: () => page.evaluate(() => window.FA_APP.result()),
      diagnostics: () => page.evaluate(() => window.FA_APP.diagnostics()),
      measurePayload: () => page.evaluate(() => window.FA_APP.measurePayload()),
      captureExcel: async names => page.evaluate(async requested => {
        const captured = [];
        const original = window.writeWorkbookFile;
        window.writeWorkbookFile = async (workbook, filename) => {
          captured.push({ filename, sheets: workbook.SheetNames.map(name => ({ name, rows: XLSX.utils.sheet_to_json(workbook.Sheets[name], { header: 1, raw: true, defval: null }) })) });
          return true;
        };
        try { for (const name of requested) await window[name](); }
        finally { window.writeWorkbookFile = original; }
        return captured;
      }, names || ['exportExcel', 'exportKpiExcel', 'exportCashFlowExcel', 'exportAdequacyExcel', 'exportHistoryExcel', 'exportAdvancedExcel']),
      capturePdf: async names => page.evaluate(async requested => {
        const captured = [];
        const original = window.open;
        window.open = () => {
          let html = '';
          return { document: { write(value) { html += String(value); }, close() { captured.push(html); } }, focus() {}, print() {} };
        };
        try { for (const name of requested) await window[name](); await new Promise(resolve => setTimeout(resolve, 150)); }
        finally { window.open = original; }
        return captured;
      }, names || ['printReclassReport', 'printKpiReport', 'printCashFlowReport', 'printAdequacyReport', 'printAdvancedReport', 'printReport']),
      close: async () => { await context.close(); await browser.close(); await stopServer(server); },
    };
  } catch (error) {
    await context?.close().catch(() => {});
    await browser?.close().catch(() => {});
    await stopServer(server);
    throw error;
  }
}
