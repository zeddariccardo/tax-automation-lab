/* Gli importi dentro le caselle del modello ministeriale.
 *
 * IL DIFETTO. Il modello ha la virgola già stampata e due caselle sue per i
 * centesimi. `writeModelValue` scriveva l'importo tutto attaccato — «262500,00»
 * — allineato a destra del campo: la nostra virgola finiva sopra la loro, i due
 * decimali fuori dalle caselle, e con sei cifre l'intero sforava a sinistra.
 * Con importi piccoli non si notava; con quelli veri sì.
 *
 * Non era una regressione recente: la funzione è identica da prima di tutto il
 * rifacimento dell'interfaccia. È che con numeri grandi si vede.
 *
 * LE COORDINATE non sono inventate: sono misurate sull'immagine del modello,
 * cercando la virgola e i divisori delle caselle sulle righe dei singoli VP.
 * Debiti: virgola a 136,36 mm, caselle centrate a 139,09 e 144,29.
 * Crediti: virgola a 187,05 mm, caselle centrate a 189,75 e 195,15.
 *
 * Qui si prova la matematica, che è pura. Che poi il PDF esca davvero lo prova
 * `tests/lipe-azioni.e2e.mjs` in un browser vero.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = fs.readFileSync(path.join(root, 'tools', 'lipe', 'index.html'), 'utf8');

/* Si estraggono dalla pagina le funzioni vere, non una loro copia: una copia
   invecchia da sola, e questo file esiste proprio perché una formula sbagliata
   non si veda solo guardando il PDF stampato. */
const { posizioniImporto, DEBITI, CREDITI } = (() => {
  const pezzi = [
    ['const round2=', 'riga'],
    ['function num(v){', 'blocco'],
    ['const MODELLO_IMPORTO={', 'blocco'],
    ['function posizioniImporto(', 'blocco']
  ];
  const src = pezzi.map(([inizio, forma]) => {
    const i = html.indexOf(inizio);
    assert.ok(i > 0, `non trovo «${inizio}» nella pagina`);
    if (forma === 'riga') return html.slice(i, html.indexOf('\n', i));
    /* Si conta l'annidamento delle graffe: queste definizioni sono blocchi. */
    let j = i, graffe = 0, aperto = false;
    while (j < html.length) {
      const c = html[j];
      if (c === '{') { graffe++; aperto = true; }
      else if (c === '}') { graffe--; if (aperto && graffe === 0) { j++; break; } }
      j++;
    }
    return html.slice(i, j) + ';';
  }).join('\n');
  const f = new Function(src + '\n;return {posizioniImporto:posizioniImporto,MODELLO_IMPORTO:MODELLO_IMPORTO};')();
  return { posizioniImporto: f.posizioniImporto, DEBITI: 146.4, CREDITI: 196.8 };
})();

/* ────────────────────────────────────────────── quello che deve uscire */

test('l’importo si spezza in intero e centesimi, e la virgola non la scriviamo noi', () => {
  const p = posizioniImporto(262500, DEBITI);
  assert.equal(p.intero, '262500', 'la parte intera va da sola');
  assert.equal(p.dec, '00', 'i centesimi vanno nelle loro caselle');
  assert.ok(!/,/.test(p.intero), 'la virgola è già stampata sul modello: non va riscritta');
});

test('i centesimi finiscono nelle due caselle del modello', () => {
  const p = posizioniImporto(1234.56, DEBITI);
  assert.equal(p.dec, '56');
  assert.deepStrictEqual(p.xDec, [139.09, 144.29]);
  const q = posizioniImporto(1234.56, CREDITI);
  assert.deepStrictEqual(q.xDec, [189.75, 195.15]);
});

test('la parte intera finisce prima della virgola stampata, non sopra', () => {
  for (const [colonna, virgola] of [[DEBITI, 136.36], [CREDITI, 187.05]]) {
    const p = posizioniImporto(999999.99, colonna);
    assert.ok(p.xIntero < virgola,
      `la parte intera arriva a ${p.xIntero}, la virgola del modello è a ${virgola}`);
    assert.ok(virgola - p.xIntero < 1.5,
      'fra l’ultima cifra e la virgola non ci deve essere un buco');
  }
});

test('lo spazio per la parte intera è quello che resta a sinistra della virgola', () => {
  const p = posizioniImporto(1, DEBITI, 31.5);
  /* 31,5 di campo meno i 10,04 occupati da virgola e centesimi, meno il
     mezzo millimetro di respiro. */
  assert.ok(p.largo > 19 && p.largo < 22, 'spazio calcolato male: ' + p.largo);
  assert.ok(p.largo < 31.5, 'lo spazio non può essere quello dell’intero campo');
});

/* ────────────────────────────────────── i casi che rompono le cose */

test('zero e valori sotto il centesimo non si scrivono affatto', () => {
  for (const v of [0, '', null, undefined, 0.004, -0.004, '0,00']) {
    assert.equal(posizioniImporto(v, DEBITI), null, `«${v}» non deve stampare niente`);
  }
});

test('un centesimo si scrive, e con lo zero davanti', () => {
  const p = posizioniImporto(0.01, DEBITI);
  assert.equal(p.intero, '0');
  assert.equal(p.dec, '01', 'il centesimo solo va nella seconda casella, con lo zero nella prima');
});

test('un decimale solo diventa due cifre', () => {
  assert.equal(posizioniImporto(12.5, DEBITI).dec, '50');
  assert.equal(posizioniImporto(12.5, DEBITI).intero, '12');
});

test('gli importi lunghi restano interi: si stringe il carattere, non il numero', () => {
  const p = posizioniImporto(9876543.21, DEBITI);
  assert.equal(p.intero, '9876543', 'sette cifre devono restare sette cifre');
  assert.equal(p.dec, '21');
});

test('i negativi non perdono il segno', () => {
  const p = posizioniImporto(-1500.25, DEBITI);
  assert.equal(p.intero, '-1500');
  assert.equal(p.dec, '25', 'i centesimi di un negativo restano positivi nelle caselle');
});

test('niente separatore delle migliaia: nel modello le cifre stanno in casella', () => {
  const p = posizioniImporto(1234567, DEBITI);
  assert.ok(!/[.\s]/.test(p.intero), 'nessun punto e nessuno spazio: ' + p.intero);
});

test('una colonna sconosciuta torna al comportamento di prima invece di sparare a caso', () => {
  const p = posizioniImporto(100.5, 123.4);
  assert.equal(p.intero, '100,50', 'senza geometria si riscrive tutto attaccato, come prima');
  assert.equal(p.dec, null);
  assert.equal(p.xIntero, 123.4);
});

/* ─────────────────────────────── la pagina usa davvero questa strada */

test('nessun importo del modello viene più scritto tutto attaccato', () => {
  const i = html.indexOf('function writeModelValue(');
  const corpo = html.slice(i, html.indexOf('function writeModelMark(', i));
  assert.match(corpo, /posizioniImporto\(value,xRight,maxWidth\)/,
    'writeModelValue deve passare dalle posizioni calcolate');
  assert.doesNotMatch(corpo, /doc\.text\(s,xRight,y/,
    'la vecchia riga che scriveva tutto attaccato non deve tornare');
});

test('le due colonne del modello hanno la loro geometria, misurata', () => {
  const i = html.indexOf('const MODELLO_IMPORTO=');
  const blocco = html.slice(i, i + 220);
  assert.match(blocco, /146\.4:\{virgola:136\.36/, 'colonna dei debiti');
  assert.match(blocco, /196\.8:\{virgola:187\.05/, 'colonna dei crediti');
});
