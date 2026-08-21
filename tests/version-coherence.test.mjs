/* Tax Automation Lab — coerenza delle versioni
   Copyright (c) 2026 Riccardo Zedda — MIT

   Perché esiste. L'audit del 21 agosto 2026 (TAL-P1-05) ha trovato versioni
   diverse per lo stesso tool a seconda di dove le si leggeva: il Bilancio
   dichiarava 1.4.0 nell'attributo e nel JSON-LD ma girava con 1.4.1 nel
   codice, Analisi dichiarava 2.1.0 e teneva 2.0.4 in tre costanti, il
   Fascicolo non aveva l'attributo. Nessuno se ne accorgeva perché niente lo
   controllava. Ora lo controlla questo test: se un tool torna a parlare con
   due voci, fallisce alla prima divergenza.

   Cosa NON controlla. Le versioni nei nomi dei file di prompt e template
   (`Prompt_..._v2.0.4.txt`) sono un contratto diverso, che cambia quando
   cambia il formato del file e non a ogni correzione del tool: quelle le
   verifica prompt-template-contract.test.mjs.

   Come si esegue:  node --test tests/
*/
import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');

const TOOLS = {
  'financial-statement': 'Bilancio civilistico ITA GAAP',
  'financial-analysis' : 'Analisi di bilancio',
  'lipe'               : 'Generatore LIPE',
  'tfa-client-file'    : 'Fascicolo fiscale cliente',
  'f24'                : 'Generatore F24'
};

/* Ogni voce è un posto in cui un tool dichiara la propria versione. Le
   etichette servono al messaggio d'errore: leggere «APP_VERSION dice 3.6.0 ma
   data-tool-version dice 3.6.1» è utile, leggere «versioni incoerenti» no. */
const DECLARATIONS = [
  ['attributo data-tool-version', /data-tool-version="([^"]+)"/g],
  ['JSON-LD softwareVersion',     /"softwareVersion"\s*:\s*"([^"]+)"/g],
  ['costante APP_VERSION',        /APP_VERSION\s*=\s*'([^']+)'/g],
  ['costante PATCH_VERSION',      /PATCH_VERSION\s*=\s*'([^']+)'/g],
  ['costante VERSION',            /(?<![A-Z_])VERSION\s*=\s*'(\d[^']*)'/g],
  ['costante V20_VERSION',        /V20_VERSION\s*=\s*'([^']+)'/g],
  ['costante TAL_VERSION',        /TAL_VERSION\s*=\s*'([^']+)'/g],
  ['costante FS_VERSION',         /FS_VERSION\s*=\s*'([^']+)'/g],
  ['etichetta di pubblicazione',  /v(\d+\.\d+\.\d+)<\//g]
];

for (const [dir, label] of Object.entries(TOOLS)) {
  test(`${label}: una sola versione dichiarata`, () => {
    const html = fs.readFileSync(path.join(root, 'tools', dir, 'index.html'), 'utf8');
    const found = new Map();   // versione -> [luoghi che la dichiarano]

    for (const [where, re] of DECLARATIONS) {
      for (const m of html.matchAll(re)) {
        if (!found.has(m[1])) found.set(m[1], []);
        if (!found.get(m[1]).includes(where)) found.get(m[1]).push(where);
      }
    }

    assert.ok(found.size > 0, `${dir}: nessuna versione dichiarata da nessuna parte`);

    if (found.size > 1) {
      const detail = [...found.entries()]
        .map(([v, places]) => `  ${v} — ${places.join(', ')}`)
        .join('\n');
      assert.fail(`${dir}: ${found.size} versioni diverse nello stesso tool.\n${detail}`);
    }
  });

  test(`${label}: dichiara la versione nell'attributo del tag html`, () => {
    const html = fs.readFileSync(path.join(root, 'tools', dir, 'index.html'), 'utf8');
    /* L'attributo è il posto che leggono i test, gli export e il supporto:
       senza, l'unico modo di sapere che versione gira è aprire il sorgente. */
    assert.match(html.slice(0, 4000), /data-tool-version="\d+\.\d+\.\d+"/,
      `${dir}: manca data-tool-version sul tag <html>`);
  });
}
