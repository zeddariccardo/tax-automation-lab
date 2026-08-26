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

/* Dal 27 agosto 2026 il Confronto regimi fa il calcolo su un servizio nostro.
   Continuerebbe a passare il controllo qui sotto, perché l'indirizzo che chiama
   è relativo — ma passerebbe per un dettaglio di forma, e un test che dice sì
   per il motivo sbagliato è peggio di un test che non c'è. Gli altri cinque
   restano senza rete; per lui c'è un controllo suo, in fondo al file. */
const SENZA_RETE = TOOLS.filter((t) => t !== 'confronto-regimi');

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
  for (const dir of SENZA_RETE) {
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

/* -------------------------------------------------- il tool che invece chiama */

test('Confronto regimi chiama solo il proprio servizio di calcolo, e bussa prima', () => {
  const html = fs.readFileSync(path.join(root, 'tools', 'confronto-regimi', 'index.html'), 'utf8');
  const blocco = html.match(/<script id="cf-api">([\s\S]*?)<\/script>/);
  assert.ok(blocco, 'non trovo <script id="cf-api">');
  const codice = blocco[1];

  /* Gli unici due indirizzi, entrambi relativi: il calcolo e la sonda. */
  const percorsi = [...codice.matchAll(/const (?:PERCORSO|SONDA) = '([^']+)'/g)].map((m) => m[1]);
  assert.deepStrictEqual(percorsi.sort(), ['/api/confronto-regimi/calcola', '/api/stato'],
    'gli indirizzi chiamati non sono quelli attesi');
  percorsi.forEach((u) => assert.ok(u.startsWith('/'),
    u + ' non è relativo: uscirebbe dal sito'));

  /* L'indirizzo alternativo per le prove si può mettere solo a mano, e solo se
     è un sottodominio workers.dev: un indirizzo passabile in un link sarebbe un
     modo per far spedire i numeri di qualcuno a un server scelto da altri. */
  assert.match(codice, /const FORMA_PROVA = \/\^https:.*workers\\\.dev\$\//,
    'manca il vincolo di forma sull’indirizzo di prova');
  assert.doesNotMatch(codice, /location\.search|URLSearchParams|getAttribute\('data-api/,
    'l’indirizzo del servizio non deve poter arrivare dal link o dal markup');

  /* Prima di spedire qualcosa si controlla che dall'altra parte ci sia il
     servizio. Senza, con la Route non ancora attiva, un POST finirebbe a
     GitHub Pages portandosi dietro i numeri di chi sta usando il tool. */
  assert.match(codice, /if \(!\(await ilServizioCe\(\)\)\) throw guasto\('assente'\);/,
    'manca la sonda che precede ogni invio');
  const i = codice.indexOf("async function chiama(");
  const j = codice.indexOf("ilServizioCe()", i);
  const k = codice.indexOf("body: JSON.stringify(corpo)", i);
  assert.ok(i !== -1 && j !== -1 && k !== -1 && j < k,
    'la sonda deve stare prima del corpo della richiesta, non dopo');
});

test('nessun dato identificativo è fra i campi che Confronto regimi spedisce', () => {
  const html = fs.readFileSync(path.join(root, 'tools', 'confronto-regimi', 'index.html'), 'utf8');
  const m = html.match(/const CAMPI_DEL_MOTORE = \[([\s\S]*?)\];/);
  assert.ok(m, 'non trovo l’elenco dei campi che partono');
  const campi = m[1].split(',').map((x) => x.trim().replace(/^'|'$/g, ''))
    .filter((x) => x && !x.startsWith('/*'));

  ['subjectName', 'subjectKind', 'currentRegime', 'nome', 'nota', 'clientName']
    .forEach((c) => assert.equal(campi.indexOf(c), -1,
      c + ' non serve al calcolo: non deve uscire dal browser'));

  /* Ogni campo dev’essere un numero, un booleano o una scelta fra poche: se un
     giorno ne comparisse uno di testo libero, questa riga lo fa notare. */
  const voce = html.match(/const CAMPI_DELLA_VOCE = \[([\s\S]*?)\];/);
  assert.ok(voce, 'non trovo l’elenco dei campi di una voce di costo');
  assert.equal(voce[1].indexOf("'nome'"), -1,
    'il nome di una voce di costo lo scrive l’utente: non deve partire');
});
