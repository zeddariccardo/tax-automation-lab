/* Tax Automation Lab — integrità delle librerie incorporate
   Copyright (c) 2026 Riccardo Zedda — Tax Automation Lab. All rights reserved.

   Perché esiste. L'audit del 23 agosto 2026 ha misurato la copia di SheetJS
   incorporata nei sei tool e ha trovato quattro sequenze di byte diverse, a
   fronte di una sola firma SHA-256 pubblicata in `legal-docs/THIRD-PARTY-
   NOTICES.txt`. Quella firma corrispondeva al solo Generatore F24.

   Il caso peggiore era in `financial-analysis`: dentro il bundle minificato, al
   posto della funzione `tr` di SheetJS, c'era la funzione applicativa
   `talReclassRow` — una sostituzione andata a segno nel punto sbagliato. Non
   rompeva niente solo perché `tr` non viene mai chiamata dal ramo browser, e
   perché il tool ridefiniva `talReclassRow` più avanti. Ma la versione buona
   della funzione, quella che gestisce l'assenza dell'esercizio precedente, era
   proprio quella finita nel bundle: girava la vecchia, e le riclassificazioni
   mostravano l'intero saldo corrente nella colonna della variazione.

   Cosa controlla. Che tutti i tool incorporino la stessa identica copia, e che
   sia quella dichiarata nei notices. Se qualcuno rifà una sostituzione larga su
   un file da 2 MB, questo test se ne accorge subito.

   Come si esegue:  node --test tests/
*/
import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');

const TOOLS = ['financial-statement', 'financial-analysis', 'lipe',
               'tfa-client-file', 'f24', 'confronto-regimi'];

/* Il blocco vendorizzato è il <script> che contiene il banner di SheetJS.
   Si legge in binario e si normalizzano i fine riga, perché nel repository
   convivono file CRLF e file LF: la differenza è di formato, non di contenuto. */
function bloccoSheetJS(slug) {
  const buf = fs.readFileSync(path.join(root, 'tools', slug, 'index.html'));
  const testo = buf.toString('latin1');           // 1 byte = 1 carattere: gli indici tornano
  const ancora = testo.indexOf('sheetjs.com');
  assert.ok(ancora > 0, `${slug}: nessun banner SheetJS`);
  const apre = testo.lastIndexOf('<script', ancora);
  const fineTag = testo.indexOf('>', apre) + 1;
  const chiude = testo.indexOf('</script>', fineTag);
  return {
    tag: testo.slice(apre, fineTag),
    corpo: Buffer.from(testo.slice(fineTag, chiude), 'latin1')
      .toString('utf8').trim().replace(/\r\n/g, '\n')
  };
}

function firma(corpo) {
  return crypto.createHash('sha256').update(corpo + '\n', 'utf8').digest('hex');
}

test('SheetJS: i sei tool incorporano la stessa identica copia', () => {
  const perFirma = new Map();
  for (const slug of TOOLS) {
    const f = firma(bloccoSheetJS(slug).corpo);
    if (!perFirma.has(f)) perFirma.set(f, []);
    perFirma.get(f).push(slug);
  }
  const gruppi = [...perFirma.entries()]
    .map(([f, tools]) => `  ${f.slice(0, 12)}…  ${tools.join(', ')}`);
  assert.equal(perFirma.size, 1,
    `${perFirma.size} copie diverse di SheetJS fra i tool:\n${gruppi.join('\n')}`);
});

test('SheetJS: la copia è quella dichiarata nei Third-party notices', () => {
  const notices = fs.readFileSync(path.join(root, 'legal-docs', 'THIRD-PARTY-NOTICES.txt'), 'utf8');
  const dichiarata = (notices.match(/SHA-256:\s*([0-9a-f]{64})/) || [])[1];
  assert.ok(dichiarata, 'nei notices non c\'è una firma SHA-256 da confrontare');
  const sbagliati = TOOLS
    .map(slug => [slug, firma(bloccoSheetJS(slug).corpo)])
    .filter(([, f]) => f !== dichiarata)
    .map(([slug, f]) => `  ${slug}: ${f}`);
  assert.equal(sbagliati.length, 0,
    `i notices dichiarano ${dichiarata}\n${sbagliati.length} tool non corrispondono:\n${sbagliati.join('\n')}`);
});

test('SheetJS: nel bundle non è finito codice del tool', () => {
  /* Le funzioni del tool cominciano tutte per `tal` o usano `STATE`: dentro un
     bundle minificato non hanno niente da fare. È la firma della sostituzione
     larga andata a segno nel posto sbagliato. */
  const intrusi = [];
  for (const slug of TOOLS) {
    const {corpo} = bloccoSheetJS(slug);
    for (const nome of corpo.match(/function\s+(tal[A-Za-z0-9_]*|[A-Za-z0-9_]*STATE[A-Za-z0-9_]*)\s*\(/g) || []) {
      intrusi.push(`  ${slug}: ${nome.trim()}`);
    }
    if (/\bSTATE\s*\./.test(corpo)) intrusi.push(`  ${slug}: il bundle legge STATE.`);
  }
  assert.equal(intrusi.length, 0,
    `codice del tool dentro il bundle vendorizzato:\n${intrusi.join('\n')}`);
});

test('SheetJS: il tag dichiara la libreria e la versione', () => {
  const sbagliati = TOOLS
    .map(slug => [slug, bloccoSheetJS(slug).tag])
    .filter(([, tag]) => !/data-vendored="SheetJS 0\.20\.3"/.test(tag))
    .map(([slug, tag]) => `  ${slug}: ${tag}`);
  assert.equal(sbagliati.length, 0,
    `tag senza data-vendored="SheetJS 0.20.3":\n${sbagliati.join('\n')}`);
});
