/* LIPE, azione per azione, in un browser vero.
 *
 * PERCHÉ ESISTE. Il 28 agosto 2026 la card «Importa da Excel» in Impostazioni
 * cliente non apriva niente: chiamava `getElementById('lipe-nav-import').click()`
 * e quella voce di menu era stata tolta in Fase 1. Il click lanciava un
 * TypeError e sullo schermo non succedeva nulla.
 *
 * Nessuno dei test statici poteva vederlo: il pulsante c'era nel sorgente, la
 * funzione bersaglio pure, il markup era a posto. Mancava solo che le due cose
 * si parlassero. E il mio primo tentativo di prova nel browser era altrettanto
 * cieco: passavo il file direttamente all'input, saltando la card — cioè
 * saltando esattamente il pezzo rotto.
 *
 * LA REGOLA DI QUESTO FILE, allora: si clicca quello che clicca una persona, e
 * si verifica quello che una persona vedrebbe. Mai chiamare la funzione sotto.
 * Per i selettori di file si aspetta l'evento `filechooser`: è la prova che il
 * picker si è aperto davvero, non che esiste un input da qualche parte.
 *
 * Uso:  npm run test:e2e:lipe
 */
import http from 'node:http';
import https from 'node:https';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const PORT = Number(process.env.TAL_E2E_PORT || 4207);
const API = process.env.TAL_E2E_API || 'https://taxautomationlab.com';

const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff2': 'font/woff2',
  '.woff': 'font/woff', '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
};

/* Il motore fiscale non è nel browser: sta nel Worker. Le richieste `/api/`
   vanno inoltrate a quello vero, altrimenti non si sta provando il tool, si sta
   provando una sua imitazione. Se la rete non c'è, i controlli che dipendono
   dal calcolo si dichiarano saltati invece di fallire. */
function proxy(req, res) {
  const url = new URL(req.url, API);
  const corpo = [];
  req.on('data', (c) => corpo.push(c));
  req.on('end', () => {
    const r = https.request({
      hostname: url.hostname, path: url.pathname + url.search, method: req.method,
      headers: { 'content-type': req.headers['content-type'] || 'application/json', host: url.hostname }
    }, (up) => {
      res.writeHead(up.statusCode, { 'content-type': up.headers['content-type'] || 'application/json' });
      up.pipe(res);
    });
    r.on('error', () => { res.writeHead(502).end('{"errore":"proxy"}'); });
    if (corpo.length) r.write(Buffer.concat(corpo));
    r.end();
  });
}

function serve() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      if (req.url.startsWith('/api/')) return proxy(req, res);
      let rel = decodeURIComponent(req.url.split('?')[0]);
      if (rel.endsWith('/')) rel += 'index.html';
      const file = path.join(root, rel);
      if (!file.startsWith(root)) { res.writeHead(403).end(); return; }
      fs.readFile(file, (err, buf) => {
        if (err) { res.writeHead(404).end('not found'); return; }
        res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
        res.end(buf);
      });
    });
    server.listen(PORT, () => resolve(server));
  });
}

/* ─────────────────────────────────────────────────────── il piccolo runner */

const esiti = [];
let pagina = null;

async function prova(nome, fn) {
  const errori = [];
  const ascolta = (e) => errori.push(e.message);
  pagina.on('pageerror', ascolta);
  try {
    await fn();
    /* Un click che lancia non è un click che funziona, anche se per caso
       l'effetto si vede lo stesso. */
    if (errori.length) throw new Error('la pagina ha lanciato: ' + errori.join(' | '));
    esiti.push({ nome, ok: true });
    console.log('  ok   ' + nome);
  } catch (e) {
    esiti.push({ nome, ok: false, perche: e.message });
    console.log('  NO   ' + nome + '\n         ' + e.message.split('\n')[0]);
  } finally {
    pagina.off('pageerror', ascolta);
  }
}

function pretendi(condizione, messaggio) {
  if (!condizione) throw new Error(messaggio);
}

/* ─────────────────────────────────────────────────────────────── gli aiuti */

const attendi = (ms) => new Promise((r) => setTimeout(r, ms));

async function apri(page, { larghezza = 1440, altezza = 900, benvenuto = false, vista = 'period-processing' } = {}) {
  await page.setViewportSize({ width: larghezza, height: altezza });
  /* Il benvenuto e' un dialogo modale: finche' e' aperto copre tutto, ed e'
     giusto cosi'. Questi controlli partono percio' come chi l'ha gia' visto,
     tranne quello che prova proprio il benvenuto. */
  /* Solo quando NON si sta provando il benvenuto: se lo cancellassi a ogni
     caricamento, il controllo su «Non mostrarlo piu'» proverebbe soltanto che
     so cancellare una chiave. */
  /* Il contesto e' uno solo per tutto il giro, quindi la scelta fatta da un
     controllo precedente resta. Va rimessa esplicitamente, nei due versi. */
  await page.addInitScript((mostra) => {
    try {
      if (mostra) localStorage.removeItem('lipe.benvenuto');
      else localStorage.setItem('lipe.benvenuto', 'no');
    } catch (_) { }
  }, benvenuto);
  await page.goto(`http://127.0.0.1:${PORT}/tools/lipe/`, { waitUntil: 'load' });
  await page.waitForFunction(() => !!document.getElementById('load-demo'), null, { timeout: 15000 });
  await attendi(400);
  if (!vista) return;
  /* Sul telefono le voci stanno dentro il menu chiuso: si passa dall'indirizzo,
     che e' quello che fa anche un segnalibro. Il menu ha i suoi controlli. */
  if (larghezza <= 980) {
    const slug = (await page.evaluate((v) => (window.LIPE_VIEWS || {})[v], vista)) || '';
    await page.evaluate((s) => { location.hash = '#/' + s; }, slug);
    await page.waitForFunction(
      (v) => document.getElementById(v).getBoundingClientRect().height > 0, vista, { timeout: 8000 });
    await attendi(250);
    return;
  }
  await vai(page, vista);
}

/* Si passa dal menu, non dall'indirizzo: e' quello che fa una persona, ed e'
   anche l'unico modo per accorgersi se una voce smette di funzionare. */
async function vai(page, vista) {
  /* Sotto i 980 il menu e' chiuso dietro il comando: si passa dall'indirizzo. */
  const stretto = (page.viewportSize() || {}).width <= 980;
  if (stretto) {
    const slug = (await page.evaluate((v) => (window.LIPE_VIEWS || {})[v], vista)) || '';
    await page.evaluate((s) => { location.hash = '#/' + s; }, slug);
    await page.waitForFunction(
      (v) => document.getElementById(v).getBoundingClientRect().height > 0, vista, { timeout: 8000 });
    await attendi(250);
    return;
  }
  await page.locator('.workspace-nav [data-lipeview="' + vista + '"]').first().click();
  await page.waitForFunction(
    (v) => document.getElementById(v).getBoundingClientRect().height > 0, vista, { timeout: 8000 });
  await attendi(250);
}

/* Un vero file XLSX, costruito con la stessa libreria che il tool usa per
   leggerlo. Torna il percorso su disco: `setInputFiles` vuole un file vero. */
function scriviXlsx(nome, righe) {
  const XLSX = require_xlsx();
  const ws = XLSX.utils.aoa_to_sheet(righe);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Foglio1');
  const dove = path.join(here, '.tmp-' + nome);
  fs.writeFileSync(dove, XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' }));
  return dove;
}

let _xlsx = null;
function require_xlsx() {
  if (_xlsx) return _xlsx;
  /* La libreria è dentro la pagina, non fra le dipendenze: la si estrae da lì
     una volta sola, così il test non aggiunge un pacchetto solo per scrivere
     tre righe di foglio elettronico. */
  const html = fs.readFileSync(path.join(root, 'tools', 'lipe', 'index.html'), 'utf8');
  const i = html.indexOf('/*! xlsx.js');
  const j = html.indexOf('</script>', i);
  const src = html.slice(i, j);
  const modulo = { exports: {} };
  new Function('module', 'exports', 'window', 'global', src + '\n;return module.exports;')(
    modulo, modulo.exports, {}, {});
  _xlsx = modulo.exports.utils ? modulo.exports : globalThis.XLSX;
  if (!_xlsx || !_xlsx.utils) throw new Error('non riesco a estrarre XLSX dalla pagina');
  return _xlsx;
}

/* ══════════════════════════════════════════════════════════════ i controlli */

async function tutto(page) {
  pagina = page;

  /* ---------------------------------------- le scorciatoie di partenza */

  await prova('Impostazioni cliente · la card «Importa da Excel» apre il selettore file', async () => {
    await apri(page, { vista: 'client-config' });
    const card = page.locator('.tal-start-card', { hasText: 'Importa da Excel' });
    pretendi(await card.count() === 1, 'la card non c’è');
    /* La prova vera: il selettore si apre. Con il difetto di prima qui si
       aspettava per sempre, perché il click lanciava e basta. */
    const [scelta] = await Promise.all([
      page.waitForEvent('filechooser', { timeout: 4000 }),
      card.click()
    ]);
    pretendi(!!scelta, 'il selettore file non si è aperto');
  });

  await prova('Impostazioni cliente · la card «Inizia a mano» prepara un cliente nuovo', async () => {
    await apri(page, { vista: 'client-config' });
    await page.fill('#cfg-denom', 'Da sovrascrivere');
    await page.locator('.tal-start-card', { hasText: 'Inizia a mano' }).click();
    await attendi(500);
    const denom = await page.inputValue('#cfg-denom');
    pretendi(denom === '', 'il modulo non è stato ripulito: «Inizia a mano» non ha fatto niente');
  });

  /* ------------------------------------------------- gli importi del periodo */

  await prova('1 · Importi · il selettore file carica un XLSX vero', async () => {
    await apri(page);
    await page.click('#load-demo');
    await attendi(1500);
    const file = scriviXlsx('importi.xlsx', [
      ['Codice IVA', 'Imponibile', 'IVA', 'Mese'],
      ['IV22', 10000, 2200, 4],
      ['AC22', 5000, 1100, 5]
    ]);
    await page.setInputFiles('#amounts-upload', file);
    await page.waitForFunction(() => typeof state !== 'undefined' && state.rows.length === 2, null, { timeout: 8000 });
    const nome = await page.evaluate(() => state.sourceFile);
    pretendi(/importi\.xlsx$/.test(nome), 'il nome del file non è arrivato nello stato: ' + nome);
    fs.unlinkSync(file);
  });

  await prova('1 · Importi · l’area di trascinamento apre il selettore al click', async () => {
    await apri(page);
    const area = page.locator('#lipe-dropzone');
    pretendi(await area.count() === 1, 'l’area di trascinamento non c’è');
    const [scelta] = await Promise.all([
      page.waitForEvent('filechooser', { timeout: 4000 }),
      area.click()
    ]);
    pretendi(!!scelta, 'il selettore non si è aperto dall’area');
  });

  await prova('1 · Importi · l’area di trascinamento accetta un file lasciato sopra', async () => {
    await apri(page);
    await page.click('#load-demo');
    await attendi(1500);
    const file = scriviXlsx('trascinato.xlsx', [
      ['Codice IVA', 'Imponibile', 'IVA', 'Mese'],
      ['IV22', 7000, 1540, 6]
    ]);
    const dati = fs.readFileSync(file).toString('base64');
    await page.evaluate(async (b64) => {
      const bin = atob(b64);
      const arr = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
      const f = new File([arr], 'trascinato.xlsx',
        { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const dt = new DataTransfer();
      dt.items.add(f);
      const zona = document.getElementById('lipe-dropzone');
      zona.dispatchEvent(new DragEvent('dragover', { bubbles: true, dataTransfer: dt }));
      zona.dispatchEvent(new DragEvent('drop', { bubbles: true, dataTransfer: dt }));
    }, dati);
    await page.waitForFunction(() => typeof state !== 'undefined' && state.rows.length === 1, null, { timeout: 8000 });
    const nome = await page.evaluate(() => state.sourceFile);
    pretendi(/trascinato\.xlsx$/.test(nome), 'il file lasciato sopra non è stato letto: ' + nome);
    fs.unlinkSync(file);
  });

  await prova('1 · Importi · l’area segnala quando si sta trascinando', async () => {
    await apri(page);
    await page.evaluate(() => {
      const dt = new DataTransfer();
      document.getElementById('lipe-dropzone')
        .dispatchEvent(new DragEvent('dragover', { bubbles: true, dataTransfer: dt }));
    });
    const acceso = await page.evaluate(() =>
      document.getElementById('lipe-dropzone').classList.contains('is-sopra'));
    pretendi(acceso, 'l’area non cambia aspetto mentre si trascina');
  });

  await prova('1 · Importi · un file non valido lo dice, e non sporca lo stato', async () => {
    await apri(page);
    await page.click('#load-demo');
    await attendi(1500);
    const prima = await page.evaluate(() => state.rows.length);
    const rotto = path.join(here, '.tmp-rotto.xlsx');
    fs.writeFileSync(rotto, 'questo non è un foglio elettronico');
    await page.setInputFiles('#amounts-upload', rotto);
    await attendi(5500);
    const dopo = await page.evaluate(() => state.rows.length);
    pretendi(dopo === prima, 'un file illeggibile ha comunque cambiato lo stato');
    const detto = await page.evaluate(() => {
      const z = document.getElementById('lipe-drop-esito');
      return (z && z.textContent) || '';
    });
    pretendi(/non .*legger|non valido|errore/i.test(detto),
      'un file illeggibile non produce nessun messaggio: ' + detto.slice(0, 80));
    fs.unlinkSync(rotto);
  });

  await prova('1 · Importi · «Carica dati dimostrativi» carica davvero il caso demo', async () => {
    await apri(page);
    const cta = page.locator('#load-demo');
    pretendi(await cta.count() === 1, 'la CTA dei dati dimostrativi non c’è');
    pretendi(await cta.isVisible(), 'la CTA c’è ma non si vede');
    await cta.click();
    await page.waitForFunction(() => typeof state !== 'undefined' && state.rows.length > 0, null, { timeout: 8000 });
    const piva = await page.evaluate(() => state.activeClientKey);
    pretendi(piva === '12345678903', 'il cliente dimostrativo non è stato caricato: ' + piva);
  });

  await prova('1 · Importi · i dati dimostrativi non sovrascrivono in silenzio', async () => {
    await apri(page);
    await page.click('#load-demo');
    await attendi(1500);
    /* Caricando la demo la vista cambia: per premere di nuovo il pulsante si
       torna agli importi, come farebbe una persona. */
    await vai(page, 'period-processing');
    let chiesto = false;
    page.once('dialog', async (d) => { chiesto = true; await d.dismiss(); });
    await page.click('#load-demo');
    await attendi(800);
    pretendi(chiesto, 'con dati già caricati la demo si è ricaricata senza chiedere niente');
    const righe = await page.evaluate(() => state.rows.length);
    pretendi(righe > 0, 'annullando la conferma i dati sono spariti lo stesso');
  });

  /* ----------------------------------------------------- cliente e periodo */

  await prova('Barra di contesto · cambiare trimestre rifà il calcolo', async () => {
    await apri(page);
    await page.click('#load-demo');
    await attendi(1600);
    const prima = await page.evaluate(() => window.lipeApiDiagnostica().impronta);
    await page.selectOption('#run-quarter', '3');
    await attendi(1800);
    const dopo = await page.evaluate(() => window.lipeApiDiagnostica().impronta);
    pretendi(prima !== dopo, 'cambiare trimestre non ha cambiato niente (impronta ' + prima + ')');
  });

  await prova('Barra di contesto · «Impostazioni cliente» porta alle impostazioni', async () => {
    await apri(page);
    await page.click('#lipe-context-bar > .btn');
    await attendi(400);
    const visibile = await page.evaluate(() =>
      document.getElementById('client-config').getBoundingClientRect().height > 0);
    pretendi(visibile, 'la scorciatoia non apre le impostazioni');
    pretendi(page.url().includes('#/impostazioni'), 'l’indirizzo non segue: ' + page.url());
  });

  await prova('Impostazioni · le tre schede aprono le tre viste', async () => {
    await apri(page, { vista: 'client-config' });
    for (const [testo, id] of [['Dati telematici', 'telematic-config'], ['Codici IVA', 'vat-codes'], ['Anagrafica', 'client-config']]) {
      const dove = await page.evaluate(() => [...document.querySelectorAll('.lipe-view')]
        .filter((v) => v.getBoundingClientRect().height > 0).map((v) => v.id)[0]);
      await page.locator('#' + dove + ' .set-tab', { hasText: testo }).click();
      await attendi(350);
      const visibile = await page.evaluate((x) =>
        document.getElementById(x).getBoundingClientRect().height > 0, id);
      pretendi(visibile, 'la scheda «' + testo + '» non apre ' + id);
    }
  });

  await prova('Impostazioni · salvare un cliente lo mette nell’archivio', async () => {
    await apri(page, { vista: 'client-config' });
    await page.fill('#cfg-denom', 'Prova E2E S.r.l.');
    await page.fill('#cfg-piva', '12345678903');
    await page.fill('#cfg-cf', '12345678903');
    const salva = page.locator('#save-client');
    pretendi(await salva.count() === 1, 'il pulsante Salva non c’è');
    await salva.click();
    await attendi(900);
    const salvati = await page.evaluate(() => {
      try { return Object.keys(JSON.parse(localStorage.getItem('taxtool_lipe_v3_clients') || '{}')); }
      catch (_) { return []; }
    });
    pretendi(salvati.length > 0, 'dopo Salva l’archivio è ancora vuoto');
  });

  await prova('Codici IVA · il selettore del codiciario si apre dal suo pulsante', async () => {
    await apri(page, { vista: 'client-config' });
    await page.locator('#client-config .set-tab', { hasText: 'Codici IVA' }).click();
    await attendi(500);
    const et = page.locator('label[for="mapping-upload"]').first();
    pretendi(await et.count() === 1, 'manca l’etichetta che apre il codiciario');
    const [scelta] = await Promise.all([
      page.waitForEvent('filechooser', { timeout: 4000 }),
      et.click()
    ]);
    pretendi(!!scelta, 'il selettore del codiciario non si è aperto');
  });

  /* ------------------------------------------------------- il quadro VP */

  await prova('2 · Comunicazione · un valore manuale entra nel quadro', async () => {
    await apri(page);
    await page.click('#load-demo');
    await attendi(1600);
    await vai(page, 'results-section');
    await attendi(500);
    const campo = page.locator('[data-manual-field="vp9"]').first();
    pretendi(await campo.count() > 0, 'non trovo il campo VP9');
    await campo.fill('120,00');
    await campo.dispatchEvent('change');
    await attendi(1800);
    const vp9 = await page.evaluate(() => {
      const d = window.periodDescriptors()[0];
      return window.computePeriod(d).vp9;
    });
    pretendi(Math.abs(vp9 - 120) < 0.01, 'il valore scritto a mano non è entrato nel calcolo: ' + vp9);
  });

  await prova('2 · Comunicazione · i controlli superati si aprono e si richiudono', async () => {
    await apri(page, { larghezza: 390, altezza: 844 });
    await page.click('#load-demo');
    await attendi(1800);
    await vai(page, 'results-section');
    await attendi(600);
    const b = page.locator('.com-superati');
    pretendi(await b.isVisible(), 'sul telefono manca il comando dei controlli superati');
    const chiusi = await page.evaluate(() =>
      [...document.querySelectorAll('#checks-grid .check-item.ok')].filter((e) => e.offsetParent).length);
    await b.click();
    await attendi(350);
    const aperti = await page.evaluate(() =>
      [...document.querySelectorAll('#checks-grid .check-item.ok')].filter((e) => e.offsetParent).length);
    pretendi(chiusi === 0 && aperti > 0, `il comando non apre niente (${chiusi} → ${aperti})`);
  });

  /* --------------------------------------------------------- gli output */

  await prova('3 · Output · la CTA dalla Comunicazione porta agli output', async () => {
    await apri(page);
    await page.click('#load-demo');
    await attendi(1600);
    await vai(page, 'results-section');
    await attendi(500);
    await page.click('.com-cta');
    await attendi(500);
    const visibile = await page.evaluate(() =>
      document.getElementById('exports-section').getBoundingClientRect().height > 0);
    pretendi(visibile, 'la CTA non porta agli output');
  });

  for (const [nome, id, estensione] of [
    ['XML', 'export-xml', /\.xml$/],
    ['working paper', 'export-excel', /\.xlsx$/],
    ['PDF', 'export-pdf', /\.pdf$/]
  ]) {
    await prova('3 · Output · ' + nome + ' produce davvero un file', async () => {
      await apri(page);
      await page.click('#load-demo');
      await attendi(1600);
      await page.click('[data-lipeview="exports-section"]');
      await attendi(600);
      const [scarico] = await Promise.all([
        page.waitForEvent('download', { timeout: 20000 }),
        page.click('#' + id)
      ]);
      const f = await scarico.path();
      const grande = f ? fs.statSync(f).size : 0;
      pretendi(estensione.test(scarico.suggestedFilename()),
        'nome del file inatteso: ' + scarico.suggestedFilename());
      pretendi(grande > 500, 'il file scaricato è vuoto o quasi: ' + grande + ' byte');
    });
  }

  await prova('3 · Output · lo storico registra il periodo', async () => {
    await apri(page);
    await page.click('#load-demo');
    await attendi(1600);
    await vai(page, 'exports-section');
    await attendi(500);
    page.once('dialog', (d) => d.accept());
    await page.click('#save-history');
    await attendi(1200);
    const quanti = await page.evaluate(() => {
      try { return (JSON.parse(localStorage.getItem('taxtool_lipe_v3_history') || '[]')).length; }
      catch (_) { return 0; }
    });
    pretendi(quanti > 0, 'lo storico è rimasto vuoto');
  });

  /* ------------------------------------------------- quando il servizio cade */

  await prova('Servizio giù · compare il guasto, e «Riprova» rimette a posto', async () => {
    await apri(page);
    await page.click('#load-demo');
    await attendi(1600);
    await page.route('**/api/lipe/**', (r) => r.abort());
    await page.evaluate(() => {
      const d = window.periodDescriptors()[0];
      state.manual[d.key] = Object.assign({}, state.manual[d.key], { vp9: '31,00' });
      window.renderResults();
    });
    await page.waitForSelector('#lipeApiRiprova', { timeout: 8000 });
    const svuotato = await page.evaluate(() =>
      document.getElementById('checks-grid').innerHTML.length === 0);
    pretendi(svuotato, 'con il servizio giù restano in pagina i numeri vecchi');
    await page.unroute('**/api/lipe/**');
    await page.click('#lipeApiRiprova');
    await page.waitForFunction(() =>
      document.querySelectorAll('#checks-grid .check-item').length > 0, null, { timeout: 15000 });
    const diag = await page.evaluate(() => window.lipeApiDiagnostica());
    pretendi(diag.rifiuti === 0, 'ci sono stati rifiuti: ' + diag.rifiuti);
  });

  /* -------------------------------------------------------- il telefono */

  await prova('Telefono · il menu si apre, si chiude con Esc e restituisce il fuoco', async () => {
    await apri(page, { larghezza: 390, altezza: 844 });
    await page.focus('#sb-toggle');
    await page.click('#sb-toggle');
    await attendi(400);
    const aperto = await page.evaluate(() => ({
      open: document.getElementById('sidebar').classList.contains('open'),
      velo: !!document.querySelector('.sb-backdrop.show'),
      fermo: document.body.classList.contains('lipe-menu-aperto'),
      fuocoDentro: document.getElementById('sidebar').contains(document.activeElement)
    }));
    pretendi(aperto.open && aperto.velo, 'il menu non si apre con il velo');
    pretendi(aperto.fermo, 'la pagina dietro non è stata bloccata');
    pretendi(aperto.fuocoDentro, 'il fuoco non è entrato nel menu');
    await page.keyboard.press('Escape');
    await attendi(400);
    const dopo = await page.evaluate(() => ({
      open: document.getElementById('sidebar').classList.contains('open'),
      fuocoSulComando: document.activeElement === document.getElementById('sb-toggle')
    }));
    pretendi(!dopo.open, 'Esc non chiude il menu');
    pretendi(dopo.fuocoSulComando, 'il fuoco non è tornato al comando');
  });

  await prova('Telefono · la barra di contesto si apre e si richiude', async () => {
    await apri(page, { larghezza: 390, altezza: 844 });
    const r = page.locator('.lipe-ctx-riassunto');
    pretendi(await r.isVisible(), 'la riga di riassunto non si vede');
    const chiusa = await page.evaluate(() =>
      [...document.querySelectorAll('#lipe-context-bar select')].filter((e) => e.offsetParent).length);
    await r.click();
    await attendi(350);
    const aperta = await page.evaluate(() =>
      [...document.querySelectorAll('#lipe-context-bar select')].filter((e) => e.offsetParent).length);
    pretendi(chiusa === 0 && aperta > 0, `la barra non si apre (${chiusa} → ${aperta})`);
  });

  /* ------------------------------------------------------- il benvenuto */

  await prova('Benvenuto · compare la prima volta e «Non mostrarlo più» lo spegne', async () => {
    /* Contesto tutto suo: `addInitScript` non si puo' togliere, e quelli
       accumulati dagli altri controlli rimetterebbero in piedi il benvenuto a
       ogni caricamento — provando soltanto che so cancellare una chiave. Qui
       serve un browser che non ha mai visto questa pagina. */
    const ctx = await page.context().browser().newContext();
    const p2 = await ctx.newPage();
    try {
      await p2.setViewportSize({ width: 1440, height: 900 });
      await p2.goto(`http://127.0.0.1:${PORT}/tools/lipe/`, { waitUntil: 'load' });
      await p2.waitForSelector('#lipe-benvenuto[open]', { timeout: 8000 });

      await p2.check('#lipe-benvenuto-mai');
      await p2.click('#lipe-benvenuto-chiudi');
      await attendi(400);
      const aperto1 = await p2.evaluate(() =>
        document.getElementById('lipe-benvenuto').open);
      pretendi(!aperto1, 'il benvenuto non si chiude');

      await p2.goto(`http://127.0.0.1:${PORT}/tools/lipe/`, { waitUntil: 'load' });
      await attendi(1400);
      const aperto2 = await p2.evaluate(() =>
        document.getElementById('lipe-benvenuto').open);
      pretendi(!aperto2, '«Non mostrarlo più» non è stato ricordato');

      /* E deve restare raggiungibile: spegnerlo non vuol dire perderlo.
         Il richiamo sta in «Come si usa», che è dove uno va a cercarlo. */
      await p2.locator('.workspace-nav [data-lipeview="period-processing"]').first().click();
      await attendi(500);
      const richiamo = p2.locator('[data-apre-benvenuto]');
      pretendi(await richiamo.count() === 1, 'una volta spento non c’è più modo di rivederlo');
      await richiamo.click();
      await attendi(400);
      const tornato = await p2.evaluate(() => document.getElementById('lipe-benvenuto').open);
      pretendi(tornato, 'il richiamo non riapre il benvenuto');
    } finally {
      await ctx.close();
    }
  });

  /* ---------------------------------------------- nessun pulsante morto */

  await prova('Nessun comando punta a un elemento che non esiste', async () => {
    await apri(page);
    const morti = await page.evaluate(() => {
      const male = [];
      document.querySelectorAll('[onclick]').forEach((e) => {
        for (const m of e.getAttribute('onclick').matchAll(/getElementById\('([^']+)'\)|querySelector\('#([^']+)'\)/g)) {
          const id = m[1] || m[2];
          if (!document.getElementById(id)) male.push((e.textContent || '').trim().slice(0, 30) + ' → #' + id);
        }
      });
      document.querySelectorAll('[data-apre],[data-preme]').forEach((e) => {
        const id = e.dataset.apre || e.dataset.preme;
        if (!document.getElementById(id)) male.push((e.textContent || '').trim().slice(0, 30) + ' → #' + id);
      });
      document.querySelectorAll('label[for]').forEach((e) => {
        if (!document.getElementById(e.htmlFor)) male.push('etichetta «' + e.textContent.trim().slice(0, 24) + '» → #' + e.htmlFor);
      });
      return male;
    });
    pretendi(morti.length === 0, 'comandi scollegati: ' + morti.join(' · '));
  });
}

/* ─────────────────────────────────────────────────────────────── il giro */

async function main() {
  let chromium;
  try { ({ chromium } = await import('playwright')); }
  catch {
    console.error('Playwright non installato. Esegui:  npm install && npx playwright install chromium');
    process.exit(2);
  }

  const server = await serve();
  const browser = await chromium.launch();
  const context = await browser.newContext({ acceptDownloads: true });
  const page = await context.newPage();
  const erroriConsole = [];
  page.on('console', (m) => { if (m.type() === 'error') erroriConsole.push(m.text()); });

  console.log(`LIPE · azioni reali (API: ${API})\n`);
  try {
    await tutto(page);
  } finally {
    await browser.close();
    server.close();
  }

  const male = esiti.filter((e) => !e.ok);
  console.log(`\n${esiti.length - male.length}/${esiti.length} azioni verificate.`);
  if (erroriConsole.length) {
    console.log('\nErrori in console durante il giro:');
    [...new Set(erroriConsole)].slice(0, 15).forEach((e) => console.log('  ' + e));
  }
  if (male.length) {
    console.log('\nNon funzionano:');
    male.forEach((e) => console.log('  · ' + e.nome + '\n      ' + e.perche));
  }
  process.exit(male.length ? 1 : 0);
}

main();
