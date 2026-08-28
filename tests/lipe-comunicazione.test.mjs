/* La schermata «Comunicazione», e le due cose che la possono rompere in silenzio.
 *
 * Fase 2, 28 agosto 2026. La schermata è passata da un flusso verticale unico a
 * due colonne: a sinistra il lavoro sul periodo, a destra un pannello appeso che
 * risponde alla sola domanda per cui si apre questa pagina — «posso procedere
 * oppure no?».
 *
 * LA PRIMA COSA che si può rompere è il ponte. Il riquadro «servizio non
 * disponibile» nasce con `sezione.insertBefore(el, ancora)`, dove `sezione` è
 * `#results-section` e `ancora` è `#results-empty`. Se `results-empty` finisce
 * dentro una colonna, `insertBefore` non lancia un avviso: lancia un errore, e
 * il messaggio di guasto non compare più. Il test qui sotto pretende che resti
 * figlio diretto.
 *
 * LA SECONDA è più insidiosa: la riga di stato conta i controlli. Se un giorno
 * qualcuno la facesse chiamare `checks()` invece di leggere il DOM già
 * disegnato, ogni ridisegno diventerebbe una richiesta al servizio, e
 * `window.lipeApiDiagnostica()` smetterebbe di poter dire «una richiesta per
 * stato». Non c'è modo di accorgersene guardando lo schermo: si vedrebbe solo
 * il conto del traffico.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = fs.readFileSync(path.join(root, 'tools', 'lipe', 'index.html'), 'utf8');

const sezione = (() => {
  const i = html.indexOf('id="results-section"');
  return i < 0 ? '' : html.slice(i, html.indexOf('</section>', i));
})();

test('la struttura a due colonne c’è, con il lavoro a sinistra e il pannello a destra', () => {
  assert.ok(sezione, 'non trovo più la sezione della comunicazione');
  assert.match(sezione, /<div class="com-grid">/);
  assert.match(sezione, /<div class="com-main">/);
  assert.match(sezione, /<aside class="com-side" id="com-side">/);

  const main = sezione.slice(sezione.indexOf('com-main'), sezione.indexOf('com-side'));
  const side = sezione.slice(sezione.indexOf('com-side'));
  for (const id of ['period-tabs', 'period-panels', 'detail-table']) {
    assert.ok(main.includes(`id="${id}"`), `${id} deve stare nella colonna principale`);
  }
  for (const id of ['results-summary', 'com-stato', 'checks-grid']) {
    assert.ok(side.includes(`id="${id}"`), `${id} deve stare nel pannello`);
  }
});

test('results-empty resta figlio diretto di results-section', () => {
  /* Il ponte ci fa insertBefore. Dentro una colonna, il riquadro di guasto non
     comparirebbe più e l'errore finirebbe solo in console. */
  /* Fino all'apertura del suo tag, non fino all'attributo: il tag di
     results-empty comincia con `<div`, e contarlo falserebbe il conto. */
  const dove = sezione.indexOf('id="results-empty"');
  const prima = sezione.slice(0, sezione.lastIndexOf('<div', dove));
  const aperti = (prima.match(/<div\b/g) || []).length;
  const chiusi = (prima.match(/<\/div>/g) || []).length;
  assert.equal(aperti, chiusi,
    'fra l’inizio della sezione e results-empty c’è un contenitore aperto: ' +
    'results-empty non è più figlio diretto e insertBefore fallirebbe');
});

test('tutti gli id del contratto sopravvivono al rifacimento', () => {
  for (const id of ['results-empty', 'results-summary', 'period-tabs', 'period-panels',
    'checks-grid', 'detail-table']) {
    assert.ok(sezione.includes(`id="${id}"`), `${id} è sparito dalla sezione`);
  }
  assert.match(html, /id="detail-table"[\s\S]{0,400}<tbody>/,
    'il ponte svuota il tbody di detail-table: deve continuare a esistere');
});

test('il dettaglio analitico è chiuso di default', () => {
  const d = /<details class="com-dettaglio" id="detail-block"([^>]*)>/.exec(sezione);
  assert.ok(d, 'il dettaglio per rigo non è più un blocco richiudibile');
  assert.doesNotMatch(d[1], /\bopen\b/,
    'deve essere chiuso all’apertura della schermata: sedici righe di dettaglio ' +
    'sono la cosa che si guarda per ultima, non per prima');
});

test('c’è una sola chiamata all’azione, e porta agli output', () => {
  const cta = sezione.match(/class="btn com-cta"[^>]*data-lipeview="([a-z-]+)"/);
  assert.ok(cta, 'manca il pulsante verso il passo 3');
  assert.equal(cta[1], 'exports-section');
  assert.equal((sezione.match(/com-cta/g) || []).length, 1,
    'una sola chiamata all’azione nella schermata: due pulsanti che portano nello ' +
    'stesso posto sono due decisioni da prendere invece di una');
});

test('la riga di stato legge il DOM e non chiede niente al servizio', () => {
  const i = html.indexOf('<script id="lipe-comunicazione-stato">');
  assert.ok(i > 0, 'manca lo script della riga di stato');
  /* Senza i commenti: qui dentro si spiega proprio perché `checks()` non va
     chiamata, e cercare il nome nel testo intero troverebbe la spiegazione. */
  const script = html.slice(i, html.indexOf('</script>', i))
    .replace(/\/\*[\s\S]*?\*\//g, ' ');

  for (const vietato of ['checks(', 'fetch(', 'computePeriod(', 'renderResults(',
    'assicura(', 'lipeApi', 'hasBlocking(', 'officialOutputProblems(']) {
    assert.ok(!script.includes(vietato),
      `la riga di stato chiama «${vietato}»: ogni ridisegno diventerebbe una richiesta al ` +
      'servizio, e il contatore di lipeApiDiagnostica smetterebbe di voler dire qualcosa');
  }
  assert.match(script, /new MutationObserver\(disegna\)\.observe\(griglia, \{ childList: true \}\)/,
    'deve guardare il disegno dei controlli, non i punti che lo provocano');
  assert.match(script, /querySelectorAll\('\.check-item\.' \+ classe\)/,
    'il conteggio viene dalle classi che il disegno mette sugli elementi');
});

test('i tre stati sono tutti e tre previsti, e vestiti in modo diverso', () => {
  const i = html.indexOf('<script id="lipe-comunicazione-stato">');
  const script = html.slice(i, html.indexOf('</script>', i));
  for (const [classe, testo] of [['is-bloccata', 'Comunicazione bloccata'],
    ['is-avvisi', 'Pronta, con '], ['is-pronta', 'Comunicazione pronta']]) {
    assert.ok(script.includes(classe), `manca lo stato ${classe}`);
    assert.ok(script.includes(testo), `manca il testo dello stato ${classe}`);
    assert.match(html, new RegExp('\\.com-stato\\.' + classe + '\\{'),
      `lo stato ${classe} non ha un colore suo: tre stati che si somigliano non sono tre stati`);
  }
});

test('i controlli sono ordinati per gravità, non per come arrivano', () => {
  assert.match(html, /\.com-card \.check-item\.fail\{order:1/);
  assert.match(html, /\.com-card \.check-item\.warn\{order:2/);
  assert.match(html, /\.com-card \.check-item\.ok\{\s*\n?\s*order:3/,
    'chi ferma sta in cima, chi va bene in fondo');
});

test('i controlli superati sono compressi a una riga, senza perdere il testo', () => {
  assert.match(html, /\.com-card \.check-item\.ok \.desc\{display:none\}/,
    'la spiegazione di un controllo superato non serve a nessuno');
  assert.match(html, /\.com-card \.check-item\{[^}]*min-height:0/,
    'senza togliere il minimo di 112px della griglia originale dieci controlli ' +
    'occupano mille pixel di riquadri mezzi vuoti');
  const i = html.indexOf('<script id="lipe-comunicazione-stato">');
  const script = html.slice(i, html.indexOf('</script>', i));
  assert.match(script, /superati\[i\]\.title =/,
    'il testo tagliato deve restare leggibile almeno nel suggerimento');
});

test('il pannello non può superare lo schermo', () => {
  assert.match(html, /\.com-card\{[^}]*max-height:calc\(100vh/,
    'con molti controlli la chiamata all’azione finirebbe fuori dallo schermo');
  assert.match(html, /\.com-card \.checks-grid\{overflow-y:auto/,
    'a scorrere devono essere i controlli, non saldo e stato');
});

test('sotto i 1080 il pannello va sopra, non sparisce', () => {
  const m = /@media \(max-width:1080px\)\{([\s\S]*?)\n\}/.exec(html);
  assert.ok(m, 'manca l’adattamento per lo schermo stretto');
  assert.match(m[1], /\.com-side\{position:static;order:-1\}/,
    'saldo e stato restano la prima cosa che si legge');
  assert.match(m[1], /\.com-card \.check-item\.ok\{display:none\}/,
    'i controlli superati restano contati nella riga di stato ma non elencati');
});

test('la navigazione fuori dalla sidebar aggiorna anche l’indirizzo', () => {
  assert.match(html, /\(window\.lipeGo\|\|showSection\)\(link\.dataset\.lipeview\)/,
    'schede, barra di contesto e chiamata all’azione passavano da showSection, ' +
    'che non tocca l’indirizzo: bastava ricaricare per tornare dove non si era più');
});
