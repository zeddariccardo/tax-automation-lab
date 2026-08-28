/* Renderer PDF LIPE in un browser vero, con soli dati fittizi.
 *
 * Uso:
 *   node tests/lipe-pdf-visual.e2e.mjs
 *   LIPE_PDF_OUTPUT=/percorso/prova.pdf node tests/lipe-pdf-visual.e2e.mjs
 *
 * Il test passa dal vero exportPdf e dal vero jsPDF. Una sottoclasse registra
 * le battute mentre lascia che jsPDF generi normalmente il file scaricato.
 */
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const port = Number(process.env.TAL_PDF_E2E_PORT || 4211);
const output = path.resolve(process.env.LIPE_PDF_OUTPUT || path.join(os.tmpdir(), 'LIPE_PDF_TEST_FITTIZIO.pdf'));

const mime = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff2': 'font/woff2',
  '.woff': 'font/woff'
};

function serve() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      let rel = decodeURIComponent(req.url.split('?')[0]);
      if (rel.endsWith('/')) rel += 'index.html';
      const file = path.resolve(root, '.' + rel);
      if (!file.startsWith(root)) { res.writeHead(403).end(); return; }
      fs.readFile(file, (err, buf) => {
        if (err) { res.writeHead(404).end('not found'); return; }
        res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream' });
        res.end(buf);
      });
    });
    server.listen(port, '127.0.0.1', () => resolve(server));
  });
}

function pretendi(condizione, messaggio) {
  if (!condizione) throw new Error(messaggio);
}

const valoriAttesi = [
  '1,00', '12,34', '999,99', '1.234,56',
  '12.345,67', '123.456,78', '1.234.567,89'
];

const server = await serve();
const browser = await chromium.launch();
const context = await browser.newContext({ acceptDownloads: true });
const page = await context.newPage();

try {
  await page.addInitScript(() => localStorage.setItem('lipe.benvenuto', 'no'));
  await page.goto(`http://127.0.0.1:${port}/tools/lipe/`, { waitUntil: 'load' });
  await page.waitForFunction(() => !!window.jspdf?.jsPDF && typeof exportPdf === 'function');
  await page.waitForFunction(() => !!document.getElementById('load-demo'));
  await page.waitForTimeout(1000);

  await page.evaluate(() => {
    const Base = window.jspdf.jsPDF;
    const eventi = [];
    window.__lipePdfEventi = eventi;
    const creaUrl = URL.createObjectURL.bind(URL);
    URL.createObjectURL = (blob) => {
      if (blob && blob.type === 'application/pdf') window.__lipePdfBlob = blob;
      return creaUrl(blob);
    };
    function PdfOsservato(...args) {
      /* jsPDF restituisce esplicitamente il proprio oggetto API dal costruttore:
         una semplice sottoclasse perderebbe quindi i metodi sovrascritti. Si
         avvolge l'istanza vera e poi la si restituisce intatta. */
      const doc = new Base(...args);
      let font = '', misura = 0, riempimento = [];
      const setFont = doc.setFont.bind(doc);
      const setFontSize = doc.setFontSize.bind(doc);
      const setFillColor = doc.setFillColor.bind(doc);
      const rect = doc.rect.bind(doc);
      const text = doc.text.bind(doc);
      doc.setFont = (family, style, ...rest) => {
        font = family;
        return setFont(family, style, ...rest);
      };
      doc.setFontSize = (size, ...rest) => {
        misura = size;
        return setFontSize(size, ...rest);
      };
      doc.setFillColor = (...values) => {
        riempimento = values.slice(0, 3);
        return setFillColor(...values);
      };
      doc.rect = (x, y, width, height, style, ...rest) => {
        eventi.push({ tipo: 'rect', x, y, width, height, style, fill: riempimento });
        return rect(x, y, width, height, style, ...rest);
      };
      doc.text = (value, x, y, options, ...rest) => {
        eventi.push({
          tipo: 'text', value: Array.isArray(value) ? value.join('') : String(value),
          x, y, align: options && options.align, font, size: misura
        });
        return text(value, x, y, options, ...rest);
      };
      return doc;
    }
    window.jspdf.jsPDF = PdfOsservato;

    state.activeClientKey = '12345678903';
    state.year = 2026;
    state.quarter = 2;
    state.rows = [{ source: 'fixture grafica fittizia' }];
    const recordFittizio = {
      client: {
        denom: 'Impresa Fittizia PDF S.r.l.',
        piva: '12345678903', cf: 'TSTPDF80A01H501X',
        periodType: 'Q', quarterRegime: 'ordinary',
        groupVat: '', lastMonth: '', groupLiquidation: '',
        repCf: 'TSTREP80A01H501X', repRole: '1', declCompanyCf: '',
        interCf: 'TSTINT80A01H501X', commitment: '1', commitmentDate: '2026-08-28'
      },
      mapping: []
    };
    let saltaBridgeUnaVolta = false;
    Object.defineProperty(state, 'activeRecord', {
      configurable: true,
      get() {
        if (saltaBridgeUnaVolta) { saltaBridgeUnaVolta = false; return null; }
        return recordFittizio;
      },
      set(value) { Object.assign(recordFittizio, value || {}); }
    });
    /* Il wrapper del PONTE chiama subito l'originale quando non trova un
       cliente. Il getter restituisce null soltanto a quella prima lettura; il
       renderer originale vede subito dopo il record fittizio completo. */
    window.__esportaSoloRendererPdf = () => {
      saltaBridgeUnaVolta = true;
      return exportPdf();
    };

    const descrittori = [
      { key: 'PDF-DEBITO', label: 'Fixture debito', quarter: 2, month: null, months: [4, 5, 6] },
      { key: 'PDF-CREDITO', label: 'Fixture credito', quarter: 2, month: null, months: [4, 5, 6] }
    ];
    const valori = {
      'PDF-DEBITO': {
        vp2: 1, vp3: 12.34, vp4: 999.99, vp5: 1234.56,
        vp6: 12345.67, vp7: 123456.78, vp8: 1234567.89,
        vp9: 0, vp10: 1, vp11: 12.34, vp12: 999.99, vp13: 1234.56,
        vp14deb: 1234567.89, vp14cre: 0
      },
      'PDF-CREDITO': {
        vp2: 1234567.89, vp3: 123456.78, vp4: 12345.67, vp5: 1234.56,
        vp6: -999.99, vp7: 12.34, vp8: 1,
        vp9: 0, vp10: 1234567.89, vp11: 123456.78,
        vp12: 12345.67, vp13: 1234.56,
        vp14deb: 0, vp14cre: 1234567.89
      }
    };
    window.periodDescriptors = () => descrittori;
    window.computePeriod = (d) => valori[d.key];
    window.manualFor = () => ({});
    window.buildXml = () => ({ problems: ['Documento di prova con dati fittizi'] });
  });

  await page.evaluate(() => window.__esportaSoloRendererPdf());
  await page.waitForTimeout(500);
  const statoExport = await page.evaluate(() => ({
    righe: state.rows.length,
    cliente: !!state.activeRecord,
    eventi: window.__lipePdfEventi.length,
    blob: window.__lipePdfBlob instanceof Blob,
    esito: document.getElementById('export-status')?.textContent || '',
    exportFn: exportPdf.toString().slice(0, 80),
    pdfClass: window.jspdf.jsPDF.name
  }));
  pretendi(statoExport.eventi > 0, 'exportPdf non ha disegnato: ' + JSON.stringify(statoExport));
  await page.waitForFunction(() => window.__lipePdfBlob instanceof Blob, null, { timeout: 5000 });
  const pdfBase64 = await page.evaluate(async () => {
    const bytes = new Uint8Array(await window.__lipePdfBlob.arrayBuffer());
    let binary = '';
    for (let i = 0; i < bytes.length; i += 0x8000) {
      binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    }
    return btoa(binary);
  });
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, Buffer.from(pdfBase64, 'base64'));
  pretendi(fs.statSync(output).size > 100000, 'il PDF generato è troppo piccolo');

  const eventi = await page.evaluate(() => window.__lipePdfEventi);
  const testi = eventi.filter((e) => e.tipo === 'text');
  const importi = testi.filter((e) => /^(?:-?\d{1,3}(?:\.\d{3})*|-?\d+),\d{2}$/.test(e.value));
  for (const valore of valoriAttesi) {
    pretendi(importi.some((e) => e.value === valore), `manca la battuta ${valore}`);
  }
  pretendi(!importi.some((e) => e.value === '0,00'), 'uno zero semanticamente assente è stato stampato');
  pretendi(importi.every((e) => e.font === 'courier' && e.size === 10 && e.align === 'right'),
    'un importo non usa Courier 10 allineato a destra');
  pretendi(eventi.filter((e) => e.tipo === 'rect' && e.style === 'F').length === importi.length,
    'ogni importo valorizzato deve ripulire il proprio campo una volta sola');
  pretendi(testi.some((e) => e.value === 'T' && e.font === 'courier' && e.size === 12),
    'i codici del frontespizio non usano Courier 12');

  console.log(JSON.stringify({
    pdf: output,
    bytes: fs.statSync(output).size,
    pagineAttese: 3,
    importiVerificati: valoriAttesi.length,
    campiRipuliti: importi.length
  }));
} finally {
  await context.close();
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
