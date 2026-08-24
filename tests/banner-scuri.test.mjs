/* I titoli chiari sui banner scuri.
 *
 * `assets/tal-app.css` impone a ogni h1/h2/h3 del guscio
 * `color: var(--tal-fg) !important`, con una lista di eccezioni scritta come
 * `h2:not(:is(…) *)`. Se un tool disegna un banner scuro e gli scrive dentro
 * `.banner h2{color:#fff}`, quella riga **non fa niente**: perde contro
 * l'`!important` del guscio, e il titolo resta nero su fondo scuro.
 *
 * È successo davvero. Il 24 agosto 2026 le sei riclassificazioni di Analisi
 * avevano il titolo nero su petrolio, rapporto di contrasto **1,07**, mentre
 * l'occhiello accanto — un `<small>`, che la regola non tocca — era bianco.
 * `.reclass-head h2{color:#fff}` c'era, dal primo giorno, e non serviva a
 * niente.
 *
 * Il controllo: ogni volta che un tool dichiara un titolo **chiaro** dentro un
 * contenitore, quel contenitore deve comparire fra le eccezioni. Altrimenti la
 * dichiarazione è morta e il difetto torna.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TOOLS = ['financial-statement', 'financial-analysis', 'lipe', 'tfa-client-file', 'f24', 'confronto-regimi'];

const guscio = fs.readFileSync(path.join(root, 'assets', 'tal-app.css'), 'utf8');

/* La lista di eccezioni, presa dalla regola degli h2 del guscio. */
function eccezioni() {
  const m = guscio.match(/html\.tal-tool-page h2:not\(:is\(([^)]*)\)\s*\*\)/);
  assert.ok(m, 'tal-app.css: non trovo piu’ la regola che colora gli h2 del guscio');
  return m[1].split(',').map((s) => s.trim()).filter(Boolean);
}

/* Chiaro = luminanza alta. Si riconoscono #fff, #ffffff, white e rgb(...). */
function chiaro(valore) {
  const v = String(valore).trim().toLowerCase();
  if (v === 'white' || v === '#fff' || v === '#ffffff') return true;
  let c = null;
  const esa = v.match(/^#([0-9a-f]{6})$/);
  if (esa) c = [0, 2, 4].map((i) => parseInt(esa[1].slice(i, i + 2), 16));
  const rgb = v.match(/^rgba?\(([^)]+)\)$/);
  if (rgb) c = rgb[1].split(',').slice(0, 3).map(Number);
  if (!c || c.some((x) => isNaN(x))) return false;
  const l = c.map((x) => { x /= 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); });
  return 0.2126 * l[0] + 0.7152 * l[1] + 0.0722 * l[2] > 0.5;
}

const LISTA = eccezioni();

/* Un selettore come `.reclass-head h2` è coperto se una delle classi che lo
   compongono è fra le eccezioni. */
function coperto(selettore) {
  return LISTA.some((e) => selettore.includes(e));
}

for (const dir of TOOLS) {
  test(`${dir}: nessun titolo chiaro dichiarato invano`, () => {
    const html = fs.readFileSync(path.join(root, 'tools', dir, 'index.html'), 'utf8');
    const morte = [];
    /* Solo le regole che riguardano un'intestazione dentro qualcos'altro. */
    for (const m of html.matchAll(/([.#][\w-]+(?:[^{};]*?))\s(h[123])\s*\{([^}]*)\}/g)) {
      const [, contenitore, tag, corpo] = m;
      if (contenitore.includes('@') || contenitore.includes('\n')) continue;
      const colore = corpo.match(/(?:^|;)\s*color\s*:\s*([^;!]+)/);
      if (!colore || !chiaro(colore[1])) continue;
      const sel = (contenitore + ' ' + tag).trim();
      if (coperto(sel)) continue;
      morte.push(`  ${sel} { color: ${colore[1].trim()} } — il guscio lo sovrascrive con !important`);
    }
    assert.equal(morte.length, 0,
      `${morte.length} dichiarazioni di titolo chiaro che non fanno niente:\n${morte.join('\n')}\n` +
      `  Aggiungere il contenitore alle eccezioni in assets/tal-app.css, oppure\n` +
      `  dargli la classe .tal-on-dark.`);
  });
}

test('le tre regole del guscio hanno la stessa lista di eccezioni', () => {
  const liste = [];
  for (const tag of ['h1', 'h2', 'h3']) {
    const m = guscio.match(new RegExp('html\\.tal-tool-page ' + tag + ':not\\(:is\\(([^)]*)\\)\\s*\\*\\)'));
    assert.ok(m, `tal-app.css: manca la regola per ${tag}`);
    liste.push(m[1].split(',').map((s) => s.trim()).sort().join(','));
  }
  assert.equal(new Set(liste).size, 1,
    `h1, h2 e h3 escludono contenitori diversi:\n  ${liste.join('\n  ')}`);
});
