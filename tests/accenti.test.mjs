/* Gli accenti finali si scrivono con l'accento, non con l'apostrofo.
 *
 * Il 25 agosto 2026 il sito ne aveva cinquanta scritti male, quasi tutti in
 * Confronto regimi e in LIPE: «societa'» per «società», «puo'» per «può»,
 * «e'» per «è», «piu'», «maternita'», «perche'», «ne'», «E'». A schermo si
 * leggono lo stesso, ma sono italiano sbagliato, e chi copia il testo — in una
 * mail, in una relazione — si porta dietro l'errore. Altre tre stavano nei dati
 * strutturati di Analisi, cioè nel testo che leggono i motori di ricerca.
 *
 * La regola è semplice: una parola che finisce con una vocale seguita da un
 * apostrofo è quasi sempre una lettera accentata scritta male. Le elisioni vere
 * finiscono in consonante — l', un', d', dell', nell' — e non le tocca nessuno.
 *
 * **Dove si guarda quale apostrofo.** Dentro uno script l'apostrofo dritto
 * delimita le stringhe: `'societa'` è un valore, non una parola scritta male.
 * Il primo giro di questo test lo ignorava e tirava su 64 falsi allarmi. Quindi:
 * nel testo della pagina si controllano tutti e tre gli apostrofi, dentro gli
 * script soltanto quello tipografico e la sua forma con escape, che una stringa
 * non la chiudono mai.
 *
 * I commenti nel codice restano fuori: sono note a chi mantiene, e lì
 * l'apostrofo dritto serve a non litigare con le codifiche degli script.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/* Le parole che nel sito finiscono davvero con un accento. Elencate invece che
   dedotte da una regola generale: «po'» e «be'» l'apostrofo ce l'hanno per
   davvero, e una regola cieca li segnalerebbe. */
const ACCENTATE = [
  'e', 'E', 'ne', 'perche', 'poiche', 'benche', 'affinche', 'piu', 'puo', 'cosi',
  'gia', 'sara', 'verra', 'avra', 'potra', 'dovra', 'societa', 'citta', 'meta',
  'liberta', 'qualita', 'attivita', 'possibilita', 'liquidita', 'redditivita',
  'affidabilita', 'solidita', 'periodicita', 'specificita', 'identita', 'novita',
  'maternita', 'unita', 'realta', 'difficolta', 'priorita', 'utilita',
];

/* Il tipografico e la sua forma con escape: nessuno dei due chiude una stringa. */
const SICURI = ['’', '\\\\u2019'];
/* Il dritto: solo fuori dagli script. */
const DRITTO = "'";

function cerca(testo, apostrofi) {
  const male = [];
  for (const parola of ACCENTATE) {
    for (const apo of apostrofi) {
      const re = new RegExp(`(?<![A-Za-z])${parola}${apo}(?![A-Za-z])`, 'g');
      for (const m of testo.matchAll(re)) {
        male.push(`«${parola}'» → …${
          testo.slice(Math.max(0, m.index - 55), m.index + 35).replace(/\s+/g, ' ')}…`);
      }
    }
  }
  return male;
}

const senzaCommenti = (s) => s
  .replace(/<!--[\s\S]*?-->/g, ' ')
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .replace(/^\s*\/\/.*$/gm, ' ');

/* Il testo della pagina: via commenti, stile e script. */
const testoDiPagina = (html) => senzaCommenti(html)
  .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ');

/* Le stringhe degli script, commenti esclusi. */
function corpoDegliScript(html) {
  let out = '';
  for (const m of html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)) {
    out += senzaCommenti(m[1]) + '\n';
  }
  return out;
}

function pagine() {
  const out = [];
  (function cammina(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (['.git', 'node_modules', 'tests', 'resources'].includes(e.name)) continue;
      const p = path.join(d, e.name);
      if (e.isDirectory()) cammina(p);
      else if (e.name.endsWith('.html')) out.push(p);
    }
  })(root);
  return out;
}

const rel = (p) => p.slice(root.length + 1).split(path.sep).join('/');

test('nessun accento scritto con l’apostrofo nel testo delle pagine', () => {
  const male = [];
  for (const p of pagine()) {
    for (const riga of cerca(testoDiPagina(fs.readFileSync(p, 'utf8')), [...SICURI, DRITTO])) {
      male.push(`  ${rel(p)}: ${riga}`);
    }
  }
  assert.equal(male.length, 0,
    `${male.length} parole con l'accento scritto come apostrofo:\n${male.slice(0, 20).join('\n')}\n` +
    `  Si scrivono con la lettera accentata: società, può, è, più, perché.`);
});

test('nemmeno nelle scritte costruite dagli script', () => {
  const male = [];
  for (const p of pagine()) {
    for (const riga of cerca(corpoDegliScript(fs.readFileSync(p, 'utf8')), SICURI)) {
      male.push(`  ${rel(p)}: ${riga}`);
    }
  }
  assert.equal(male.length, 0,
    `${male.length} parole con l'accento sbagliato nelle scritte generate:\n${male.slice(0, 20).join('\n')}`);
});

test('nemmeno nei dati strutturati, che li leggono i motori di ricerca', () => {
  const male = [];
  for (const p of pagine()) {
    const html = fs.readFileSync(p, 'utf8');
    for (const b of html.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
      /* Dentro il JSON le stringhe stanno fra virgolette doppie: l'apostrofo
         dritto qui è testo, e va guardato come nel resto della pagina. */
      for (const riga of cerca(b[1], [...SICURI, DRITTO])) male.push(`  ${rel(p)}: ${riga}`);
    }
  }
  assert.equal(male.length, 0,
    `${male.length} parole con l'accento sbagliato nei dati strutturati:\n${male.slice(0, 12).join('\n')}`);
});

/* Il verso dell'accento. «perché» lo vuole acuto, e in italiano l'errore più
   comune è scriverlo grave. Ce n'era uno, in una frase che avevo aggiunto io
   mezz'ora prima. */
const ACUTE = ['perch', 'poich', 'affinch', 'nonch', 'giacch', 'finch', 'anzich', 'sicch', 'n', 's'];

test('perché vuole l’accento acuto, non il grave', () => {
  const male = [];
  for (const p of pagine()) {
    const testo = senzaCommenti(fs.readFileSync(p, 'utf8'));
    for (const parola of ACUTE) {
      const re = new RegExp(`(?<![A-Za-zàèéìòù])${parola}è(?![A-Za-zàèéìòù])`, 'gi');
      for (const m of testo.matchAll(re)) {
        male.push(`  ${rel(p)}: «${m[0]}» → …${
          testo.slice(Math.max(0, m.index - 45), m.index + 35).replace(/\s+/g, ' ')}…`);
      }
    }
  }
  assert.equal(male.length, 0,
    `${male.length} parole con l'accento grave al posto dell'acuto:\n${male.slice(0, 15).join('\n')}\n` +
    `  Si scrivono perché, poiché, né, sé.`);
});
