/* Tax Automation Lab — contratto fra prompt, template e tool
   Copyright (c) 2026 Riccardo Zedda — MIT

   Perché esiste. L'audit del 21 agosto 2026 ha trovato due difetti che vivevano
   nei file distribuiti, non nel codice:

   - TAL-P0-02: il template F24 usciva con cinque pagamenti operativi di ALFA e
     BETA nel foglio PAGAMENTI (54.500 a debito, 2.000 a credito). Chi lo
     scaricava e lo ricaricava senza toccarlo si portava dentro dati inventati.
   - la pagina «Configura con AI» e il prompt scaricabile in .txt erano due
     copie dello stesso testo, e potevano divergere senza che nulla lo dicesse.

   Questi test guardano dentro i file veri: aprono l'.xlsx e contano le righe.
   Un test che si limitasse a leggere il sorgente HTML non vedrebbe niente.

   Uso:  node --test "tests/*.test.mjs"
*/
import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import {fileURLToPath} from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');

/* ---------------------------------------------------------------------------
   Lettore .xlsx minimo. Non c'è un package manager in questo repository e non
   voglio introdurne uno per due asserzioni: un .xlsx è uno zip, e qui serve
   solo estrarre due entry XML. Legge la central directory dalla fine del file,
   che è l'unico modo corretto — scorrere gli header locali si rompe sulle
   entry con dimensione dichiarata a posteriori.
--------------------------------------------------------------------------- */
function unzip(buf) {
  const files = new Map();
  /* End of central directory: firma 0x06054b50, cercata dalla fine perché può
     essere seguita da un commento di lunghezza variabile. */
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0 && i > buf.length - 66000; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  assert.ok(eocd >= 0, 'xlsx: end of central directory non trovato');
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);

  for (let n = 0; n < count; n++) {
    assert.equal(buf.readUInt32LE(p), 0x02014b50, 'xlsx: central directory corrotta');
    const method   = buf.readUInt16LE(p + 10);
    const compSize = buf.readUInt32LE(p + 20);
    const nameLen  = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const cmtLen   = buf.readUInt16LE(p + 32);
    const localOff = buf.readUInt32LE(p + 42);
    const name     = buf.slice(p + 46, p + 46 + nameLen).toString('utf8');

    /* Dall'header locale serve solo la lunghezza dei suoi campi variabili,
       per sapere dove comincia il payload. */
    const lNameLen  = buf.readUInt16LE(localOff + 26);
    const lExtraLen = buf.readUInt16LE(localOff + 28);
    const start = localOff + 30 + lNameLen + lExtraLen;
    const raw = buf.slice(start, start + compSize);
    files.set(name, method === 0 ? raw : zlib.inflateRawSync(raw));

    p += 46 + nameLen + extraLen + cmtLen;
  }
  return files;
}

/* Nomi dei fogli, nell'ordine in cui il workbook li dichiara. */
function sheetNames(files) {
  const wb = files.get('xl/workbook.xml').toString('utf8');
  return [...wb.matchAll(/<sheet\b[^>]*\bname="([^"]*)"/g)].map(m => m[1]);
}

/* Righe con almeno una cella valorizzata nel foglio indicato (1-based). */
function nonEmptyRows(files, index) {
  const xml = files.get(`xl/worksheets/sheet${index}.xml`).toString('utf8');
  let n = 0;
  for (const m of xml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
    if (/<c\b[^>]*>[\s\S]*?<(?:v|is|t)\b/.test(m[1])) n++;
  }
  return n;
}

/* ---------------------------------------------------------------------------
   1. Il template F24 distribuito esce senza pagamenti
--------------------------------------------------------------------------- */
test('template F24: il foglio PAGAMENTI non contiene dati, gli esempi sono a parte', () => {
  const rel = 'resources/templates/Template_F24_Configura_AI_v1.0.xlsx';
  const files = unzip(fs.readFileSync(path.join(root, rel)));
  const names = sheetNames(files);

  assert.equal(names[0], 'PAGAMENTI', `${rel}: PAGAMENTI deve restare il primo foglio`);
  assert.ok(names.includes('ESEMPI_NON_IMPORTARE'),
    `${rel}: manca il foglio ESEMPI_NON_IMPORTARE; gli esempi non devono stare in PAGAMENTI`);

  /* Una sola riga non vuota = le intestazioni. Due o più significa che sono
     tornati i pagamenti dimostrativi. */
  const rows = nonEmptyRows(files, 1);
  assert.equal(rows, 1,
    `${rel}: il foglio PAGAMENTI ha ${rows} righe non vuote invece di 1 (solo intestazioni). `
    + 'Scaricare e ricaricare il template deve dare «nessun pagamento da importare».');

  /* Gli esempi devono esserci, altrimenti si è perso l'intento didattico. */
  const exampleIndex = names.indexOf('ESEMPI_NON_IMPORTARE') + 1;
  assert.ok(nonEmptyRows(files, exampleIndex) >= 5,
    `${rel}: il foglio degli esempi è vuoto; le cinque righe di esempio servono a mostrare la forma di una riga corretta`);
});

/* ---------------------------------------------------------------------------
   2. Il template di Analisi non preseleziona lo schema di bilancio
--------------------------------------------------------------------------- */
test('template Analisi di bilancio: lo schema di bilancio non è precompilato', () => {
  const rel = 'resources/templates/Template_Analisi_di_Bilancio_AI.xlsx';
  const files = unzip(fs.readFileSync(path.join(root, rel)));
  const shared = files.has('xl/sharedStrings.xml')
    ? [...files.get('xl/sharedStrings.xml').toString('utf8').matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map(m => m[1])
    : [];
  /* «abbreviato» come stringa condivisa significa che una cella lo contiene:
     era in Anagrafica!B19 e faceva classificare come abbreviato anche un
     bilancio ordinario (TAL-P1-03). */
  assert.ok(!shared.some(s => s.trim().toLowerCase() === 'abbreviato'),
    `${rel}: contiene ancora il valore «abbreviato» precompilato: la scelta dello schema deve essere esplicita`);
});

/* ---------------------------------------------------------------------------
   3. Le dieci regole comuni sono in tutti e cinque i prompt
--------------------------------------------------------------------------- */
const COMMON_RULES = [
  ['legge prima ISTRUZIONI',   /foglio ISTRUZIONI/],
  ['solo le evidenze',         /solo le evidenze/],
  ['non correggere gli id',    /Non correggere e non completare gli identificativi/],
  ['ignora gli esempi',        /ogni riga di esempio/],
  ['nessun default',           /valori predefiniti che il documento non sostiene/],
  ['vuoto se ambiguo',         /lascia la cella vuota e apri un esito bloccante/],
  ['cita la fonte',            /Cita la fonte di ogni dato/],
  ['riconcilia i conteggi',    /Riconcilia i conteggi/],
  ['non rinominare i fogli',   /Non rinominare fogli/],
  ['niente «completo» con esiti aperti', /esiti bloccanti aperti/]
];

function prompts(rel) {
  const html = read(rel);
  return [...html.matchAll(/<pre\b[^>]*>([\s\S]*?)<\/pre>/g)]
    .map(m => m[1].replace(/<[^>]+>/g, '')
                  .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
                  .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
                  .replace(/&amp;/g, '&'));
}

test('Configura con AI: i cinque prompt portano tutte le regole comuni', () => {
  const list = prompts('configura-con-ai/index.html');
  assert.equal(list.length, 5, 'la pagina italiana deve avere cinque prompt');
  list.forEach((p, i) => {
    for (const [label, re] of COMMON_RULES) {
      assert.match(p, re, `prompt ${i + 1}: manca la regola comune «${label}»`);
    }
  });
});

/* ---------------------------------------------------------------------------
   4. Il prompt scaricabile in .txt non diverge dalla pagina
--------------------------------------------------------------------------- */
test('prompt F24: il .txt scaricabile coincide con quello della pagina', () => {
  const rel = 'resources/templates/Prompt_F24_AI_v1.0.txt';
  const onPage = prompts('configura-con-ai/index.html')
    .find(p => /CAPIENZA DEL MODELLO/.test(p));
  assert.ok(onPage, 'prompt F24 non trovato nella pagina');
  const norm = s => s.replace(/\r\n/g, '\n').trim();
  assert.equal(norm(read(rel)), norm(onPage),
    `${rel} e la pagina «Configura con AI» sono due copie dello stesso prompt e sono divergenti. `
    + 'Rigenera il .txt dal testo della pagina.');
});

/* ---------------------------------------------------------------------------
   5. Ogni file offerto in download esiste
--------------------------------------------------------------------------- */
for (const rel of ['configura-con-ai/index.html',
                   'en/configure-with-ai/index.html',
                   'es/configura-con-ia/index.html']) {
  test(`${rel}: i file offerti in download esistono`, () => {
    for (const m of read(rel).matchAll(/(?:href|src)="(\/resources\/[^"?#]+)/g)) {
      assert.ok(fs.existsSync(path.join(root, m[1].slice(1))),
        `${rel}: manca il file ${m[1]}`);
    }
  });
}
