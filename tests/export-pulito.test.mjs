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

/* Il filtro si estrae dal file e si esegue: leggerlo non basta. */
function filtro() {
  const i = analisi.indexOf('const TAL_FRASE_OPERATIVA=');
  assert.ok(i > 0, 'financial-analysis: non trovo piu’ TAL_FRASE_OPERATIVA');
  const j = analisi.indexOf('function talTemaSezione', i);
  assert.ok(j > i, 'financial-analysis: non trovo piu’ talTemaSezione');
  const sorgente = analisi.slice(i, j);
  /* Il blocco si espone su `window` — che qui non esiste: gliene si passa uno
     finto, cosi' il codice gira identico a come gira nel browser. */
  return new Function('window', sorgente + '\nreturn talNotaDiMetodo;')({});
}

test('il filtro toglie le istruzioni e tiene il metodo', () => {
  const f = filtro();
  const daButtare = [
    'Apri una voce per vedere i conti sottostanti. Le modifiche sono salvate per società e metodologia.',
    'Apri una voce per vedere i conti sottostanti. Trascina una quota su un’altra voce per riclassificarla.',
    'Stampa browser: verificare anteprima, colori e interruzioni di pagina prima del salvataggio PDF.',
  ];
  for (const s of daButtare) assert.equal(f(s), '', `doveva sparire: ${s}`);

  const daTenere = [
    'Le poste finanziarie e non operative sono escluse dal capitale investito operativo.',
    'PFN positiva = indebitamento netto; PFN negativa = cassa netta.',
    'Prospetto gestionale: proxy e assunzioni devono essere verificati.',
  ];
  for (const s of daTenere) assert.equal(f(s), s, `doveva restare: ${s}`);

  /* Una frase mista: si tiene il metodo, si butta l'istruzione. */
  assert.equal(
    f('Le poste finanziarie sono escluse. Apri una voce per vedere i conti sottostanti.'),
    'Le poste finanziarie sono escluse.');
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
