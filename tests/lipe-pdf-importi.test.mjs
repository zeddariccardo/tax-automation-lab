/* Regressioni del renderer PDF LIPE.
 *
 * Il riferimento professionale usa una battuta monospaziata completa:
 * «1.234.567,89». Il modello incorporato da TAL ha invece virgola e celle dei
 * centesimi prestampate. Il renderer deve ripulire l'area utile del campo,
 * scrivere l'importo italiano completo, e non invadere note, etichette o righe.
 *
 * Qui si estraggono le funzioni vere dalla pagina. Il browser E2E continua a
 * provare il download; questo file prova formattazione, geometria e tipografia.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = fs.readFileSync(path.join(root, 'tools', 'lipe', 'index.html'), 'utf8');

function estrai(inizio, forma = 'blocco') {
  const i = html.indexOf(inizio);
  assert.ok(i > 0, `non trovo «${inizio}» nella pagina`);
  if (forma === 'riga') return html.slice(i, html.indexOf('\n', i));
  let j = i, graffe = 0, aperto = false;
  while (j < html.length) {
    const c = html[j];
    if (c === '{') { graffe++; aperto = true; }
    else if (c === '}') {
      graffe--;
      if (aperto && graffe === 0) { j++; break; }
    }
    j++;
  }
  return html.slice(i, j) + ';';
}

const api = (() => {
  const src = [
    estrai('const round2=', 'riga'),
    estrai('function num(v){'),
    estrai('function modelNumber('),
    estrai('function cleanFiscalCode('),
    estrai('function writeModelBoxes('),
    estrai('function writeModelText('),
    estrai('const MODELLO_IMPORTO='),
    estrai('function posizioniImporto('),
    estrai('function writeModelValue(')
  ].join('\n');
  return new Function(src + '\n;return {modelNumber,writeModelBoxes,writeModelText,MODELLO_IMPORTO,posizioniImporto,writeModelValue};')();
})();

const DEBITI = 146.4;
const CREDITI = 196.8;

class DocumentoFinto {
  constructor() {
    this.font = ''; this.style = ''; this.size = 0; this.eventi = [];
  }
  setFont(font, style) { this.font = font; this.style = style; return this; }
  setFontSize(size) { this.size = size; return this; }
  setTextColor() { return this; }
  setFillColor(...rgb) { this.fill = rgb; return this; }
  setDrawColor(...rgb) { this.stroke = rgb; return this; }
  setLineWidth(width) { this.lineWidth = width; return this; }
  rect(x, y, width, height, mode) {
    this.eventi.push({ tipo: 'rect', x, y, width, height, mode, fill: this.fill });
    return this;
  }
  line(x1, y1, x2, y2) {
    this.eventi.push({ tipo: 'line', x1, y1, x2, y2, stroke: this.stroke, lineWidth: this.lineWidth });
    return this;
  }
  getTextWidth(value) {
    /* Courier: 600 unita' per em; conversione pt -> mm. */
    return String(value).length * this.size * 0.6 * 25.4 / 72;
  }
  text(value, x, y, options = {}) {
    this.eventi.push({
      tipo: 'text', value: String(value), x, y, options,
      font: this.font, style: this.style, size: this.size,
      width: this.getTextWidth(value)
    });
    return this;
  }
}

test('gli importi richiesti hanno punto migliaia, virgola e due decimali', () => {
  const casi = new Map([
    [1, '1,00'],
    [12.34, '12,34'],
    [999.99, '999,99'],
    [1234.56, '1.234,56'],
    [12345.67, '12.345,67'],
    [123456.78, '123.456,78'],
    [1234567.89, '1.234.567,89']
  ]);
  for (const [input, atteso] of casi) assert.equal(api.modelNumber(input), atteso);
});

test('zero e valori sotto il centesimo restano semanticamente assenti', () => {
  for (const v of [0, '', null, undefined, 0.004, -0.004, '0,00']) {
    assert.equal(api.modelNumber(v), '', `«${v}» non deve valorizzare un rigo vuoto`);
    assert.equal(api.posizioniImporto(v, DEBITI), null);
  }
});

test('il segno non si perde se un valore negativo raggiunge il renderer', () => {
  assert.equal(api.modelNumber(-1234.56), '-1.234,56');
});

test('debiti e crediti hanno margini destri misurati separatamente', () => {
  assert.equal(api.posizioniImporto(1, DEBITI).xTesto, 145.84);
  assert.equal(api.posizioniImporto(1, CREDITI).xTesto, 196.64);
  assert.ok(api.posizioniImporto(1, DEBITI).largo > 30);
});

test('una geometria sconosciuta conserva la formattazione italiana e il margine dato', () => {
  const p = api.posizioniImporto(1234.5, 123.4, 28);
  assert.deepStrictEqual(p, { testo: '1.234,50', xTesto: 123.4, largo: 28 });
});

test('l’importo è una sola battuta Courier 10, non cifre separate', () => {
  const doc = new DocumentoFinto();
  api.writeModelValue(doc, 1234567.89, DEBITI, 67.05);
  const testi = doc.eventi.filter((e) => e.tipo === 'text');
  assert.equal(testi.length, 1);
  assert.deepStrictEqual(
    { value: testi[0].value, x: testi[0].x, font: testi[0].font, size: testi[0].size, align: testi[0].options.align },
    { value: '1.234.567,89', x: 145.84, font: 'courier', size: 10, align: 'right' }
  );
});

test('l’area importo prestampata viene coperta prima del testo senza invadere la nota', () => {
  const doc = new DocumentoFinto();
  api.writeModelValue(doc, 1234.56, CREDITI, 75.45);
  assert.equal(doc.eventi[0].tipo, 'rect');
  assert.deepStrictEqual(doc.eventi[0].fill, [255, 255, 255]);
  assert.equal(doc.eventi[0].mode, 'F');
  assert.equal(doc.eventi[0].x, 166);
  assert.ok(doc.eventi[0].x > 165 && doc.eventi[0].x + doc.eventi[0].width > 196.8);
  assert.equal(doc.eventi[0].height, 4.55);
  assert.ok(doc.eventi.findIndex((e) => e.tipo === 'rect') < doc.eventi.findIndex((e) => e.tipo === 'text'));
});

test('un rigo a zero conserva il campo prestampato e non riceve testo', () => {
  const doc = new DocumentoFinto();
  api.writeModelValue(doc, 0, DEBITI, 100.45);
  assert.equal(doc.eventi.filter((e) => e.tipo === 'rect').length, 0);
  assert.equal(doc.eventi.filter((e) => e.tipo === 'text').length, 0);
});

test('un numero eccezionalmente lungo viene ridotto senza oltrepassare il campo', () => {
  const doc = new DocumentoFinto();
  api.writeModelValue(doc, 1234567890123.45, DEBITI, 67.05);
  const t = doc.eventi.find((e) => e.tipo === 'text');
  assert.equal(t.value, '1.234.567.890.123,45');
  assert.ok(t.size < 10, 'il carattere deve ridursi per un valore fuori scala');
  assert.ok(t.width <= api.posizioniImporto(1, DEBITI).largo + 0.01,
    `${t.width} mm oltrepassano il campo`);
});

test('codici fiscali e partita IVA usano Courier 12 con passo di casella', () => {
  const doc = new DocumentoFinto();
  api.writeModelBoxes(doc, 'AB12', 90.15, 22.9, 4, 5.13);
  const testi = doc.eventi.filter((e) => e.tipo === 'text');
  assert.deepStrictEqual(testi.map((t) => t.value), ['A', 'B', '1', '2']);
  assert.deepStrictEqual(testi.map((t) => Number(t.x.toFixed(2))), [90.15, 95.28, 100.41, 105.54]);
  assert.ok(testi.every((t) => t.font === 'courier' && t.size === 12));
});

test('anno e data del frontespizio sono battute monospaziate leggibili', () => {
  const doc = new DocumentoFinto();
  api.writeModelText(doc, '2026', 63.9, 54.4);
  api.writeModelText(doc, '28/08/2026', 62.2, 144.2);
  assert.deepStrictEqual(doc.eventi.map((e) => e.value), ['2026', '28/08/2026']);
  assert.ok(doc.eventi.every((e) => e.font === 'courier' && e.size === 12));
});

test('exportPdf conserva tutti i righi VP e separa debito e credito', () => {
  const i = html.indexOf('function exportPdf(');
  const corpo = html.slice(i, html.indexOf('function xmlEsc(', i));
  const chiamate = [
    'v.vp2,146.4,67.05', 'v.vp3,196.8,75.45',
    'v.vp4,146.4,83.7', 'v.vp5,196.8,92.08',
    'v.vp7,146.4,108.85', 'v.vp8,196.8,117.22',
    'v.vp9,196.8,125.6', 'v.vp10,196.8,133.98',
    'v.vp11,196.8,142.36', 'v.vp12,146.4,150.74',
    'v.vp13,196.8,159.12', 'v.vp14deb,146.4,167.5',
    'v.vp14cre,196.8,167.5'
  ];
  for (const chiamata of chiamate) {
    assert.ok(corpo.includes('writeModelValue(doc,' + chiamata + ')'), `manca ${chiamata}`);
  }
  assert.ok(corpo.includes('v.vp6>0?v.vp6:0,146.4,100.45'));
  assert.ok(corpo.includes('v.vp6<0?-v.vp6:0,196.8,100.45'));
});

test('il vecchio renderer a intero e centesimi separati non può tornare', () => {
  const i = html.indexOf('function writeModelValue(');
  const corpo = html.slice(i, html.indexOf('function writeModelMark(', i));
  assert.doesNotMatch(corpo, /p\.dec|xDec|p\.intero|xIntero/);
  assert.match(corpo, /doc\.text\(p\.testo,p\.xTesto,y,\{align:'right'\}\)/);
});
