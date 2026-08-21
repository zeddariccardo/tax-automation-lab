/* Tax Automation Lab — E2E: comando del menu e scorrimento orizzontale
   Copyright (c) 2026 Riccardo Zedda — MIT

   Perché esiste. L'audit del 21 agosto 2026 ha bocciato la release perché il
   comando del menu non era lo stesso nei cinque tool e in due di essi
   compariva a intermittenza (TAL-P0-01). La correzione è nel CSS condiviso,
   ma un CSS corretto oggi non resta corretto: bastava un `!important` locale
   per disfarlo, ed è esattamente quello che era successo. Questo test lo
   rimette in discussione a ogni commit.

   Come funziona. Serve il repository su una porta locale, apre
   tests/responsive-harness.html in un browser vero e legge il risultato che
   la pagina espone in `window.__TAL_RESULTS`. La logica delle asserzioni sta
   nella pagina, così la stessa verifica si può fare anche a mano aprendola
   nel browser — utile quando si indaga, perché mostra una tabella.

   Limite dichiarato. Chromium headless su desktop non ha una safe area:
   env(safe-area-inset-*) vale 0, quindi qui si misurano i 12/16 px di
   fallback. La safe area di iPhone va provata sul dispositivo fisico. Questo
   test non sostituisce quella prova: la rende inutile solo per i difetti che
   sa vedere.

   Uso:  npm run test:e2e
*/
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const PORT = Number(process.env.TAL_E2E_PORT || 4199);

const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.woff': 'font/woff',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml'
};

function serve() {
  return new Promise(resolve => {
    const server = http.createServer((req, res) => {
      let rel = decodeURIComponent(req.url.split('?')[0]);
      if (rel.endsWith('/')) rel += 'index.html';
      const file = path.join(root, rel);
      /* Non servire niente fuori dal repository, nemmeno per sbaglio. */
      if (!file.startsWith(root)) { res.writeHead(403).end(); return; }
      fs.readFile(file, (err, buf) => {
        if (err) { res.writeHead(404).end('not found'); return; }
        res.writeHead(200, {'Content-Type': MIME[path.extname(file)] || 'application/octet-stream'});
        res.end(buf);
      });
    });
    server.listen(PORT, () => resolve(server));
  });
}

async function main() {
  let chromium;
  try {
    ({chromium} = await import('playwright'));
  } catch {
    console.error('Playwright non installato. Esegui:  npm install && npx playwright install chromium');
    process.exit(2);
  }

  const server = await serve();
  const browser = await chromium.launch();
  let failed = 0;
  try {
    const page = await browser.newPage({viewport: {width: 1280, height: 900}});
    const consoleErrors = [];
    page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });
    page.on('pageerror', e => consoleErrors.push('pageerror: ' + e.message));

    await page.goto(`http://127.0.0.1:${PORT}/tests/responsive-harness.html`,
      {waitUntil: 'load'});
    /* La pagina carica cinque tool per sette larghezze in iframe: sono file
       molto grandi, quindi il margine è ampio di proposito. */
    const results = await page.evaluate(() => window.__talRun(), null, {timeout: 240000});

    const bad = results.filter(r => !r.ok);
    for (const r of results) {
      const mark = r.ok ? 'ok  ' : 'NO  ';
      console.log(`${mark}${r.tool} @${r.width}px — ${r.ok ? r.expected : r.fails.join('; ')}`);
    }
    console.log(`\n${results.length - bad.length}/${results.length} controlli superati.`);
    failed = bad.length;

    if (consoleErrors.length) {
      console.log('\nErrori in console durante la verifica:');
      consoleErrors.slice(0, 20).forEach(e => console.log('  ' + e));
    }
  } finally {
    await browser.close();
    server.close();
  }
  process.exit(failed ? 1 : 0);
}

main().catch(err => { console.error(err); process.exit(1); });
