/* Un file che non è una cartella Excel deve essere detto subito.
 *
 * `XLSX.read` non si lamenta di niente: su otto byte a caso restituisce una
 * cartella con un foglio «Sheet1», e su un file di testo pure. Il risultato è
 * che ogni tool, davanti a un PDF rinominato o a un download corrotto, diceva
 * «Fogli obbligatori mancanti: Stato Patrimoniale, Conto Economico» — e chi
 * legge va a cercare i fogli dentro un file che non è un foglio di calcolo.
 *
 * `assets/tal-xlsx-guard.js` avvolge la lettura come già avvolge la scrittura.
 * Qui la guardia viene **eseguita** su un finto `window`, e le si passano i
 * quattro casi che contano.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function guardiaInstallata() {
  const src = fs.readFileSync(path.join(root, 'assets', 'tal-xlsx-guard.js'), 'utf8');
  let letto = null;
  const finto = {
    XLSX: {
      read: (d) => { letto = d; return { SheetNames: ['ok'], Sheets: {} }; },
      write: () => new Uint8Array(0),
      utils: { decode_range: () => ({ s: { r: 0, c: 0 }, e: { r: 0, c: 0 } }), encode_cell: () => 'A1' },
    },
    addEventListener() {},
    setTimeout: (f) => f(),
    /* Il finto documento risponde a tutto quello che la guardia le chiede
       all'avvio: senza, l'installazione si ferma prima di avvolgere `read`. */
    document: {
      readyState: 'complete',
      addEventListener() {},
      querySelector: () => null,
      querySelectorAll: () => [],
      getElementById: () => null,
      createElement: () => ({ style: {}, setAttribute() {}, appendChild() {}, click() {}, remove() {} }),
      body: { appendChild() {}, removeChild() {} },
    },
    MutationObserver: function () { this.observe = () => {}; },
    location: { pathname: '/tools/financial-analysis/' },
  };
  finto.window = finto;
  new Function('window', 'document', 'setTimeout', 'MutationObserver', 'location', src)
    (finto, finto.document, finto.setTimeout, finto.MutationObserver, finto.location);
  return { XLSX: finto.XLSX, ultimoLetto: () => letto };
}

const zip = () => new Uint8Array([0x50, 0x4B, 0x03, 0x04, 0, 0, 0, 0, 0, 0, 0, 0]);
const ole = () => new Uint8Array([0xD0, 0xCF, 0x11, 0xE0, 0, 0, 0, 0, 0, 0, 0, 0]);
const testo = () => new TextEncoder().encode('Codice;Descrizione;Importo\n100;Cassa;10\n');
const spazzatura = () => new Uint8Array(Array.from({ length: 64 }, (_, i) => (i * 7) % 31));
const pdf = () => new Uint8Array([0x25, 0x50, 0x44, 0x46, ...Array.from({ length: 300 }, (_, i) => i % 256)]);

test('la guardia avvolge la lettura', () => {
  const { XLSX } = guardiaInstallata();
  assert.equal(typeof XLSX.read, 'function');
  assert.doesNotThrow(() => XLSX.read(zip(), { type: 'array' }), 'una cartella .xlsx deve passare');
});

test('passano cartelle .xlsx, vecchi .xls e testo (il CSV serve a due input)', () => {
  const { XLSX } = guardiaInstallata();
  for (const [nome, dati] of [['zip/xlsx', zip()], ['ole/xls', ole()], ['csv', testo()]]) {
    assert.doesNotThrow(() => XLSX.read(dati, { type: 'array' }), `${nome} doveva passare`);
  }
});

test('si ferma quello che non è un foglio di calcolo, e lo dice', () => {
  const { XLSX } = guardiaInstallata();
  for (const [nome, dati] of [['byte a caso', spazzatura()], ['PDF rinominato', pdf()]]) {
    assert.throws(() => XLSX.read(dati, { type: 'array' }),
      /non è una cartella Excel/, `${nome} doveva essere fermato con un messaggio chiaro`);
  }
});

test('quello che non si sa misurare passa: meglio del falso allarme', () => {
  const { XLSX } = guardiaInstallata();
  /* Una stringa binaria (`type: 'binary'`) non si ispeziona: passa. */
  assert.doesNotThrow(() => XLSX.read('PK qualcosa', { type: 'binary' }));
});
