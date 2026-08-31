/* Gli export non contengono istruzioni per usare il tool.
 *
 * Un file esportato finisce in mano a qualcun altro: al cliente, al collegio,
 * a un collega. Dentro non ci vanno le frasi che parlano dell'interfaccia. Il
 * 24 agosto 2026 il PDF delle riclassificazioni ne conteneva quattro —
 * «Apri una voce per vedere i conti sottostanti. Le modifiche sono salvate per
 * società e metodologia.» — più un promemoria finale rivolto a chi esporta
 * («Stampa browser: verificare anteprima, colori e interruzioni di pagina…»).
 *
 * Le note di **metodo** restano: «Le poste finanziarie e non operative sono
 * escluse dal capitale investito operativo.» serve a chi legge il documento.
 * La differenza la fa `talNotaDiMetodo`, e questo file la mette alla prova
 * eseguendola davvero, non guardandola.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TOOLS = ['financial-statement', 'financial-analysis', 'lipe', 'tfa-client-file', 'f24', 'confronto-regimi'];
const analisi = fs.readFileSync(path.join(root, 'tools', 'financial-analysis', 'index.html'), 'utf8');
const analisiClient = fs.readFileSync(path.join(root, 'tools', 'financial-analysis', 'authoritative-app.js'), 'utf8');

test('il renderer autorevole non riceve né stampa istruzioni o note libere', () => {
  const daEscludere = [
    'Apri una voce per vedere i conti sottostanti. Le modifiche sono salvate per società e metodologia.',
    'Apri una voce per vedere i conti sottostanti. Trascina una quota su un’altra voce per riclassificarla.',
    'Stampa browser: verificare anteprima, colori e interruzioni di pagina prima del salvataggio PDF.',
  ];
  for (const sentence of daEscludere) assert.equal((analisi + analisiClient).includes(sentence), false, sentence);
  assert.match(analisiClient, /function pdfHtml\(/);
  assert.match(analisiClient, /ANALYSIS\.result/);
  const renderer = analisiClient.slice(analisiClient.indexOf('function workbookFor('), analisiClient.indexOf('function sheetDownload('));
  assert.doesNotMatch(renderer, /\.note\b|\.evidence\b|benchmarkSource|aiFindings/,
    'il renderer non deve leggere testo libero browser-only');
});

test('nessun costruttore di stampa scrive la nota grezza', () => {
  const crude = analisi.match(/class="(?:meta|note)">\$\{esc\(s\[2\]\)\}/g) || [];
  assert.equal(crude.length, 0,
    `${crude.length} costruttori scrivono la nota senza filtrarla:\n` +
    `  usare window.talNotaDiMetodo(s[2]) anche nei blocchi piu’ vecchi —\n` +
    `  «morto oggi» non basta, basta che qualcuno riordini i blocchi.`);
});

/* Le frasi operative non devono comparire nei tool che stampano con jsPDF:
   li' non c'e' un filtro, il testo viene scritto riga per riga. */
const OPERATIVE = [
  /Apri una voce per vedere/,
  /Trascina una quota/,
  /Le modifiche sono salvate per/,
  /Stampa browser: verificare/,
];
for (const dir of TOOLS) {
  if (dir === 'financial-analysis') continue;
  test(`${dir}: nessuna istruzione d’uso fra le stringhe stampabili`, () => {
    const html = fs.readFileSync(path.join(root, 'tools', dir, 'index.html'), 'utf8');
    const trovate = OPERATIVE.filter((re) => re.test(html)).map((re) => String(re));
    assert.equal(trovate.length, 0, `${dir}: ${trovate.join(', ')}`);
  });
}
