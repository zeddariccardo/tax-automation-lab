import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.ico': 'image/x-icon' };

// Every request is intercepted. Even the production hostname serves local files
// and a supplied in-process API: these tests cannot contact the deployed Worker.
export async function startWorkerBrowser() {
  const allowed = new Set(execFileSync('git', ['ls-files', '-z'], { cwd: ROOT, encoding: 'utf8' }).split('\0'));
  allowed.add('assets/tal-api-connection.js'); // new client, before its first commit
  const browser = await chromium.launch({ headless: true });
  return {
    async open(slug, { origin = 'https://taxautomationlab.com', storage = {}, session = {}, api } = {}) {
      const context = await browser.newContext({ locale: 'it-IT', viewport: { width: 1440, height: 1000 }, serviceWorkers: 'block' });
      await context.addInitScript(({ storage, session }) => {
        for (const [key, value] of Object.entries(storage)) localStorage.setItem(key, value);
        for (const [key, value] of Object.entries(session)) sessionStorage.setItem(key, value);
      }, { storage, session });
      const page = await context.newPage(), requests = [], errors = [], resources = [], missing = [];
      page.on('pageerror', error => errors.push(error.message));
      page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
      page.on('dialog', dialog => dialog.accept());
      await context.route('**/*', async route => {
        const request = route.request(), url = new URL(request.url());
        if (url.pathname.startsWith('/api/')) {
          requests.push({ url: request.url(), method: request.method(), body: request.postData(), headers: request.headers() });
          const response = api ? await api(request) : new Response('{"ok":true}', { headers: { 'content-type': 'application/json' } });
          await route.fulfill({ status: response.status, headers: Object.fromEntries(response.headers), body: Buffer.from(await response.arrayBuffer()) });
          return;
        }
        let relative = decodeURIComponent(url.pathname).replace(/^\/+/, '');
        if (!relative || relative.endsWith('/')) relative += 'index.html';
        if (url.origin !== origin || !allowed.has(relative) || /(?:^|\/)(?:node_modules|output|\.git|\.21st|\.codex-tmp[^/]*)\//.test(relative)) {
          missing.push(request.url());
          await route.fulfill({ status: 404, body: 'Not found' });
          return;
        }
        resources.push(relative);
        await route.fulfill({ status: 200, contentType: MIME[path.extname(relative)] || 'application/octet-stream', body: await readFile(path.join(ROOT, relative)) });
      });
      await page.goto(`${origin}/tools/${slug}/`, { waitUntil: 'load' });
      return { page, requests, errors, resources, missing, close: () => context.close() };
    },
    close: () => browser.close()
  };
}
