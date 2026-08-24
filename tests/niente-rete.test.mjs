/* I tool non chiedono niente a nessuno.
 *
 * «L'elaborazione dei file avviene localmente nel browser» è scritto nel piede
 * di ogni pagina, nella privacy e nei cataloghi: è la promessa su cui poggia
 * tutto il resto. Il 24 agosto 2026, misurata aprendo i sei tool e leggendo le
 * risorse caricate: **sette risorse ciascuno, zero fuori origine**.
 *
 * Questo controllo la tiene senza dover aprire un browser: nessun tool può
 * caricare uno script, un foglio di stile, un carattere o un'immagine da un
 * altro dominio. Gli indirizzi che **dichiarano** e non caricano — `canonical`,
 * `og:image`, gli `hreflang`, i dati strutturati — restano liberi: servono ai
 * motori di ricerca e non fanno partire nessuna richiesta.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TOOLS = ['financial-statement', 'financial-analysis', 'lipe', 'tfa-client-file', 'f24', 'confronto-regimi'];

/* Solo gli attributi che fanno partire una richiesta. */
const CARICANO = [
  /<script[^>]*\ssrc="([^"]+)"/g,
  /<link[^>]*\srel="(?:stylesheet|preload|prefetch|preconnect|dns-prefetch|modulepreload)"[^>]*\shref="([^"]+)"/g,
  /<link[^>]*\shref="([^"]+)"[^>]*\srel="(?:stylesheet|preload|prefetch|preconnect|dns-prefetch|modulepreload)"/g,
  /<img[^>]*\ssrc="([^"]+)"/g,
  /<iframe[^>]*\ssrc="([^"]+)"/g,
  /<video[^>]*\ssrc="([^"]+)"/g,
  /<audio[^>]*\ssrc="([^"]+)"/g,
  /@import\s+(?:url\()?["']([^"']+)/g,
];

const fuoriOrigine = (u) => /^(https?:)?\/\//i.test(String(u).trim());

for (const dir of TOOLS) {
  test(`${dir}: non carica niente da fuori`, () => {
    const html = fs.readFileSync(path.join(root, 'tools', dir, 'index.html'), 'utf8')
      .replace(/<!--[\s\S]*?-->/g, ' ');
    const male = [];
    for (const re of CARICANO) {
      for (const m of html.matchAll(re)) {
        if (fuoriOrigine(m[1])) male.push(`  ${m[1].slice(0, 90)}`);
      }
    }
    /* Anche i `url(...)` dentro il CSS in pagina: un carattere remoto è una
       richiesta come le altre. */
    for (const m of html.matchAll(/url\(\s*['"]?((?:https?:)?\/\/[^)'"]+)/g)) male.push(`  url(${m[1].slice(0, 80)})`);

    assert.equal(male.length, 0,
      `${dir}: ${male.length} risorse caricate da un altro dominio:\n${[...new Set(male)].join('\n')}\n` +
      `  «L'elaborazione avviene localmente nel browser» è scritto nel piede di ogni pagina.`);
  });
}

test('nessun tool fa richieste di rete a runtime verso l’esterno', () => {
  const male = [];
  for (const dir of TOOLS) {
    const html = fs.readFileSync(path.join(root, 'tools', dir, 'index.html'), 'utf8');
    /* `fetch`, `XMLHttpRequest`, `sendBeacon`, `EventSource`, `WebSocket` verso
       un indirizzo assoluto. Le chiamate a indirizzi relativi non escono dal
       sito e non violano la promessa. */
    for (const m of html.matchAll(/\b(fetch|open|sendBeacon)\s*\(\s*['"`]((?:https?:)?\/\/[^'"`]+)/g)) {
      male.push(`  ${dir}: ${m[1]}("${m[2].slice(0, 70)}")`);
    }
    for (const m of html.matchAll(/new\s+(WebSocket|EventSource)\s*\(\s*['"`]([^'"`]+)/g)) {
      male.push(`  ${dir}: new ${m[1]}("${m[2].slice(0, 70)}")`);
    }
  }
  assert.equal(male.length, 0, `${male.length} chiamate di rete verso l’esterno:\n${male.join('\n')}`);
});
