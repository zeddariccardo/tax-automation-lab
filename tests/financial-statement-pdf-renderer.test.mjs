/* Regressioni del solo renderer PDF del Bilancio civilistico.
 * I dati di prova sono esclusivamente numeri e stringhe fittizie: il documento
 * usato come riferimento grafico non viene letto né incorporato da questa suite.
 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const html = await readFile(new URL('../tools/financial-statement/index.html', import.meta.url), 'utf8');
const start = html.indexOf('<script id="tal-fs-v140-deposit-format">');
const end = html.indexOf('<script id="tal-fs-v140-xbrl">', start);
assert.ok(start > 0 && end > start, 'renderer PDF di deposito non trovato');
const renderer = html.slice(start, end);

function extractFunction(name) {
  const marker = `function ${name}(`;
  const from = renderer.indexOf(marker);
  assert.ok(from >= 0, `${marker} non trovata`);
  let cursor = renderer.indexOf('{', from);
  let depth = 0;
  do {
    const char = renderer[cursor++];
    if (char === '{') depth += 1;
    if (char === '}') depth -= 1;
  } while (cursor < renderer.length && depth > 0);
  return renderer.slice(from, cursor);
}

test('il formato civilistico a euro interi resta invariato', () => {
  const fmtDep = new Function(
    `const num=value=>{const n=Number(value||0);return Number.isFinite(n)?n:0};${extractFunction('fmtDep')};return fmtDep;`,
  )();
  assert.deepEqual(
    [0, 1, 12.34, 999.99, 1234.56, -1234567.89].map(fmtDep),
    ['–', '1', '12', '1.000', '1.235', '(1.234.568)'],
  );
});

test('la tavolozza PDF usa solo bianco e celesti gerarchici', () => {
  assert.match(renderer, /BAND=\[200,222,237\]/);
  assert.match(renderer, /STRIPE=\[242,249,252\]/);
  assert.match(renderer, /GROUP=\[228,242,249\]/);
  assert.match(renderer, /alternateRowStyles:\{fillColor:STRIPE\}/);
  assert.match(renderer, /x\.group\?\{fontStyle:'bold',fillColor:GROUP/);
  assert.doesNotMatch(renderer, /alternateRowStyles:\{fillColor:\[246,248,250\]\}/);
});

test('gerarchie, totali e valori mantengono stili distinti', () => {
  assert.match(renderer, /x\.grand\?\{fontStyle:'bold',fillColor:BAND/);
  assert.match(renderer, /x\.total\?\{fontStyle:'bold',lineWidth:\{top:\.16\}/);
  assert.match(renderer, /safe\('   '\.repeat\(x\.lvl\)\+x\.label\)/);
  assert.match(renderer, /font:'times',fontSize:8\.1/);
  assert.match(renderer, /halign:'right'/);
});

test('le righe non vengono spezzate e le intestazioni si ripetono', () => {
  const avoid = renderer.match(/rowPageBreak:'avoid'/g) || [];
  const repeated = renderer.match(/showHead:'everyPage'/g) || [];
  assert.ok(avoid.length >= 2, 'rowPageBreak deve proteggere anagrafica e prospetti');
  assert.ok(repeated.length >= 2, 'le intestazioni devono tornare sulle pagine successive');
});

test('frontespizio, stato patrimoniale e conto economico hanno pagine dedicate', () => {
  assert.match(renderer, /doc\.addPage\(\);\s*doc\.setFont\('times','bold'\).*Stato patrimoniale/s);
  assert.match(renderer, /table\('Passivo e patrimonio netto'/);
  assert.match(renderer, /doc\.addPage\(\);\s*doc\.setFont\('times','bold'\).*Conto economico/s);
  assert.match(renderer, /if\(passivoStart>255\)\{doc\.addPage\(\);passivoStart=18;\}/);
});

test('le tre colonne rispettano la larghezza utile A4', () => {
  const match = renderer.match(/columnStyles:\{0:\{cellWidth:(\d+)\},1:\{cellWidth:(\d+).*2:\{cellWidth:(\d+)/s);
  assert.ok(match, 'larghezze delle colonne non trovate');
  const total = Number(match[1]) + Number(match[2]) + Number(match[3]);
  assert.equal(total, 182);
  assert.ok(total <= 210 - 28, 'le colonne oltrepassano i margini laterali');
});
