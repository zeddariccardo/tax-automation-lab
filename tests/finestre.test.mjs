/* Le finestre di dialogo.
 *
 * Il 24 agosto 2026 nessuno dei sei tool tratteneva il tabulatore: aperta una
 * finestra, Tab continuava a girare fra i pulsanti sotto, che non si vedono.
 * La correzione non sta dentro i tool - sono scritti in sei modi diversi - ma
 * in `assets/tal-focus-guard.js`, che guarda solo se in pagina c'e' un
 * `role="dialog"` visibile. Questi controlli tengono in piedi i due patti su
 * cui si regge: che la guardia sia caricata da tutti e sei, e che il ruolo e il
 * nome delle finestre restino dichiarati nel sorgente dove gia' lo sono.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TOOLS = ['financial-statement', 'financial-analysis', 'lipe', 'tfa-client-file', 'f24', 'confronto-regimi'];
const leggi = (p) => fs.readFileSync(path.join(root, p), 'utf8');

test('la guardia del fuoco esiste e si compila', () => {
  const src = leggi('assets/tal-focus-guard.js');
  new Function(src);
  assert.match(src, /role="dialog"/, 'la guardia non cerca piu\u2019 le finestre di dialogo');
});

for (const dir of TOOLS) {
  test(`${dir}: carica la guardia del fuoco`, () => {
    const html = leggi(path.join('tools', dir, 'index.html'));
    assert.match(html, /<script src="\/assets\/tal-focus-guard\.js\?v=[0-9a-z]+"><\/script>/,
      `${dir}: manca il tag di tal-focus-guard.js`);
  });

  test(`${dir}: ogni finestra di dialogo ha ruolo, modalita\u2019 e nome`, () => {
    const html = leggi(path.join('tools', dir, 'index.html'));
    const senza = [];
    for (const tag of html.match(/<div[^>]*role="dialog"[^>]*>/g) || []) {
      const manca = [];
      if (!/aria-modal="true"/.test(tag)) manca.push('aria-modal');
      if (!/aria-label(ledby)?=/.test(tag)) manca.push('nome accessibile');
      if (manca.length) senza.push(`  ${tag.slice(0, 90)} \u2014 manca ${manca.join(' e ')}`);
    }
    assert.equal(senza.length, 0, `${senza.length} finestre incomplete:\n${senza.join('\n')}`);
  });
}
