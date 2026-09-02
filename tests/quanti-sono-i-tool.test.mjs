/* Quanti tool dice il sito di avere, e quanti ne ha davvero.
 *
 * Il 25 agosto 2026 il sito diceva ancora «quattro» in posti che contano: la
 * descrizione della pagina Strumenti — quella che si legge nei risultati di
 * Google e quando qualcuno condivide il link — in tre lingue e ripetuta tre
 * volte per pagina; le pagine delle licenze, «licenze applicabili ai quattro
 * strumenti software»; e il dizionario delle lingue nelle tre home. I tool sono
 * sei da agosto, e l'elenco non nominava né F24 né Confronto regimi.
 *
 * Il numero vero sta in `tools/manifest.json`, che è la fonte del catalogo. Qui
 * si controlla che nessuna pagina dica un numero diverso.
 *
 * Restano fuori i «quattro» che non contano i tool — i quattro passi del wizard
 * F24, i quattro dati essenziali del Fascicolo, i quattro grafici — e i commenti
 * nel codice, che raccontano com'era il sito quando i tool erano quattro e vanno
 * lasciati stare.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { trackedFiles } from './tracked-files.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const manifest = JSON.parse(fs.readFileSync(path.join(root, 'tools', 'manifest.json'), 'utf8'));
const QUANTI = (manifest.tools || manifest).length;

/* I numeri scritti a parole, nelle tre lingue, da uno a otto. */
const PAROLE = {
  it: ['zero', 'uno', 'due', 'tre', 'quattro', 'cinque', 'sei', 'sette', 'otto'],
  en: ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight'],
  es: ['cero', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho'],
};

/* Le parole che indicano i tool: se un numero le precede, sta contando i tool. */
const COSE = '(?:strumenti|tool|tools|herramientas|aplicaciones|applicazioni|applications)';

function senzaCommenti(html) {
  return html
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/^\s*\/\/.*$/gm, ' ');
}

function pagine() {
  return trackedFiles(root, { exclude: ['tests', 'resources'], pattern: /\.html$/ });
}

const rel = (p) => p.slice(root.length + 1).split(path.sep).join('/');

test(`nessuna pagina dice un numero di tool diverso da ${QUANTI}`, () => {
  const sbagliate = [];
  for (const p of pagine()) {
    const testo = senzaCommenti(fs.readFileSync(p, 'utf8'));
    for (const lingua of Object.keys(PAROLE)) {
      PAROLE[lingua].forEach((parola, numero) => {
        if (numero === QUANTI) return;
        /* «tre» dentro «tre volte» o «entre» non conta: serve il confine di parola
           e la cosa contata subito dopo, al massimo con un aggettivo in mezzo.
           E «uno dei tool» non conta i tool, ne indica uno: via i partitivi, che
           al primo giro mi avevano dato quindici allarmi inesistenti. */
        const re = new RegExp(
          `(?<!\\b(?:i|gli|le|nei|negli|nelle|ai|agli|alle|the|los|las|en los|en las)\\s)` +
          `\\b${parola}\\b(?!\\s+(?:dei|degli|delle|di|of|de|del|las|los)\\b)(?:\\s+\\w+){0,1}\\s+${COSE}\\b`,
          'gi');
        for (const m of testo.matchAll(re)) {
          sbagliate.push(`  ${rel(p)}: «${m[0].replace(/\s+/g, ' ')}»`);
        }
      });
    }
  }
  assert.equal(sbagliate.length, 0,
    `il manifest elenca ${QUANTI} tool, ma alcune pagine ne dichiarano un altro numero:\n` +
    `${sbagliate.slice(0, 15).join('\n')}\n` +
    `  Quando si aggiunge un tool va aggiornato anche il testo che lo conta.`);
});

test('la pagina Strumenti dice il numero giusto in tutte e tre le lingue', () => {
  const attese = {
    'tools/index.html': PAROLE.it[QUANTI],
    'en/tools/index.html': PAROLE.en[QUANTI],
    'es/tools/index.html': PAROLE.es[QUANTI],
  };
  for (const [file, parola] of Object.entries(attese)) {
    const html = fs.readFileSync(path.join(root, file), 'utf8');
    const re = new RegExp(`\\b${parola}\\b`, 'i');
    assert.ok(re.test(html), `${file} non dice «${parola}» da nessuna parte`);
  }
});

test('la pagina Strumenti mostra tante schede quanti sono i tool', () => {
  const html = fs.readFileSync(path.join(root, 'tools', 'index.html'), 'utf8');
  const schede = (html.match(/href="\/tools\/[a-z0-9-]+\/"/g) || [])
    .map((h) => h.match(/\/tools\/([a-z0-9-]+)\//)[1]);
  const nomi = new Set(schede);
  /* «convenienza-fiscale» e' il rimando al vecchio indirizzo: non e' un tool. */
  nomi.delete('convenienza-fiscale');
  assert.equal(nomi.size, QUANTI,
    `la pagina rimanda a ${nomi.size} tool (${[...nomi].join(', ')}), il manifest ne elenca ${QUANTI}`);
});
