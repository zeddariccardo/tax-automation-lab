/* «Modello ministeriale» si può dire in F24, non in LIPE.
 *
 * In F24 è vero: quel tool riproduce il modello dell'Agenzia, immagine A4 a 300
 * dpi con sopra il testo compilato, ed è il foglio che si stampa e si porta in
 * banca. La LIPE no: si trasmette come XML, e il PDF che il tool produce
 * documenta l'elaborazione — utile, ma non è quello che si deposita.
 *
 * Il 25 agosto 2026 avevo corretto la descrizione del tool e la scheda della
 * home, e avevo dato la cosa per chiusa. Erano rimasti tre posti che non avevo
 * guardato: **il nome del file scaricato** (`LIPE_Modello_Ministeriale_…`), il
 * messaggio che compare dopo l'export, e l'elenco delle funzioni nei dati
 * strutturati. Un file con quel nome, in una cartella condivisa, sembra quello
 * da presentare.
 *
 * Questo test è la ragione per cui la prossima volta non serve ricordarselo.
 * Restano fuori i nomi delle costanti nel codice (`MINISTERIAL_FRONT_TEMPLATE`:
 * l'immagine del modello è davvero quella) e i commenti, che spiegano il perché.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/* Via i commenti, i nomi delle costanti in maiuscolo e le etichette interne che
   jsPDF usa per non ricaricare due volte la stessa immagine: quella immagine è
   davvero il modello dell'Agenzia, e nessuno di questi nomi arriva all'utente.
   Restano le scritte, i nomi dei file e i dati strutturati. */
function soloQuelloCheSiVede(html) {
  return html
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/^\s*\/\/.*$/gm, ' ')
    .replace(/\bMINISTERIAL[A-Z_]*\b/g, ' ')
    .replace(/'(?:front|vp)Ministeriale'/g, ' ');
}

test('LIPE non chiama ministeriale niente di quello che produce', () => {
  const html = fs.readFileSync(path.join(root, 'tools', 'lipe', 'index.html'), 'utf8');
  const testo = soloQuelloCheSiVede(html);
  const male = [];
  for (const m of testo.matchAll(/ministerial[ei]?/gi)) {
    male.push(`  …${testo.slice(Math.max(0, m.index - 70), m.index + 50).replace(/\s+/g, ' ')}…`);
  }
  assert.equal(male.length, 0,
    `${male.length} volte «ministeriale» in LIPE:\n${male.join('\n')}\n` +
    `  La LIPE si trasmette come XML. Il PDF è un prospetto di lavoro: chiamarlo così.`);
});

test('e il file che scarica si chiama prospetto', () => {
  const html = fs.readFileSync(path.join(root, 'tools', 'lipe', 'index.html'), 'utf8');
  const nomi = [...html.matchAll(/'(LIPE_[A-Za-z_]+)'/g)].map((m) => m[1]);
  const bugiardi = nomi.filter((n) => /ministerial/i.test(n));
  assert.equal(bugiardi.length, 0, `nomi di file che promettono un modello: ${bugiardi.join(', ')}`);
  assert.ok(nomi.some((n) => /^LIPE_Prospetto/.test(n)),
    `nessun file si chiama LIPE_Prospetto…: trovati ${nomi.join(', ')}`);
});

test('in F24 invece resta, perché lì è vero', () => {
  const html = fs.readFileSync(path.join(root, 'tools', 'f24', 'index.html'), 'utf8');
  assert.ok(/ministerial/i.test(html),
    'F24 riproduce il modello dell’Agenzia: se la parola è sparita, controllare che non sia sparito anche il modello.');
});
