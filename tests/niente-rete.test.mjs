/* I tool non caricano niente da fuori, e quattro su sei non chiedono niente a
 * nessuno.
 *
 * «I file restano nel browser» è scritto nel piede di ogni pagina, nella privacy
 * e nei cataloghi: è la promessa su cui poggia tutto il resto. Il 24 agosto
 * 2026, misurata aprendo i sei tool e leggendo le risorse caricate: **sette
 * risorse ciascuno, zero fuori origine**.
 *
 * Due tool — Confronto regimi e Generatore LIPE — dal 27 agosto 2026 fanno il
 * calcolo su un servizio nostro, allo stesso indirizzo del sito. Non mandano
 * file né dati identificativi: solo i valori del calcolo. Hanno controlli loro,
 * in fondo a questo file.
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

/* Dal 27 agosto 2026 il Confronto regimi fa il calcolo su un servizio nostro, e
   il Generatore LIPE ha il ponte per farlo — spento, ma c'è. Tutti e due
   continuerebbero a passare il controllo qui sotto, perché l'indirizzo che
   chiamano è relativo — ma passerebbero per un dettaglio di forma, e un test
   che dice sì per il motivo sbagliato è peggio di un test che non c'è. Gli
   altri quattro restano senza rete; per questi due ci sono controlli loro, in
   fondo al file. */
const CON_SERVIZIO = ['confronto-regimi', 'lipe'];
const SENZA_RETE = TOOLS.filter((t) => CON_SERVIZIO.indexOf(t) === -1);

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

/* ------------------------------------------------ il tool che chiama, ma spento */

test('LIPE usa il servizio di calcolo, e non ha più un’alternativa', () => {
  const html = fs.readFileSync(path.join(root, 'tools', 'lipe', 'index.html'), 'utf8');
  const blocco = html.match(/\/\* >>> PONTE LIPE[\s\S]*?\/\* >>> fine PONTE LIPE <<< \*\//);
  assert.ok(blocco, 'non trovo il blocco del ponte LIPE');
  const codice = blocco[0];

  /* Dal 27 agosto 2026 il motore fiscale non è più in questa pagina: il calcolo
     lo fa il servizio, sempre. Non c'è più un interruttore, perché non c'è più
     una seconda strada da scegliere. */
  assert.match(codice, /const acceso = \(\) => true;/,
    'il ponte non deve avere alternative: il motore non è più in pagina');
  assert.match(codice, /const motoreInPagina = \(\) => false;/);
  assert.doesNotMatch(codice, /location\.search|URLSearchParams|getAttribute\('data-api/,
    'né l’interruttore né l’indirizzo devono poter arrivare dal link o dal markup');
});

test('LIPE non calcola più in pagina, e non può ripiegare', () => {
  /* Le funzioni fiscali non sono più nel file. Se il risultato del servizio
     manca, la pagina si rifiuta e lo dice: non c'è niente su cui ripiegare, e
     non deve esserci — un ripiego silenzioso nasconderebbe il guasto proprio
     quando conta saperlo. */
  const html = fs.readFileSync(path.join(root, 'tools', 'lipe', 'index.html'), 'utf8');
  const codice = html.match(/\/\* >>> PONTE LIPE[\s\S]*?\/\* >>> fine PONTE LIPE <<< \*\//)[0];
  assert.match(codice, /throw rifiuta\(\);/, 'manca il rifiuto');
  assert.match(codice, /RIFIUTI \+= 1;/, 'i rifiuti devono essere contati');
  ['function computePeriod(', 'function checks(){', 'function automaticCarry(',
    'function periodDescriptors(', 'function vp7Limit(', 'function groupParticipant('
  ].forEach((pezzo) => assert.equal(html.includes(pezzo), false,
    'la logica fiscale è ancora nel sorgente pubblico: ' + pezzo));
  /* E le strade che esportano passano dal servizio come quelle che disegnano. */
  ['exportPdf', 'exportWorkingPaper', 'exportXml', 'saveHistory'].forEach((n) => {
    assert.ok(codice.includes("'" + n + "'"), 'l’export ' + n + ' non passa dal servizio');
  });
});

test('LIPE chiama solo il proprio servizio di calcolo, e bussa prima', () => {
  const html = fs.readFileSync(path.join(root, 'tools', 'lipe', 'index.html'), 'utf8');
  const codice = html.match(/\/\* >>> PONTE LIPE[\s\S]*?\/\* >>> fine PONTE LIPE <<< \*\//)[0];

  const percorsi = [...codice.matchAll(/const (?:PERCORSO_LIPE|SONDA_LIPE) = '([^']+)'/g)].map((m) => m[1]);
  assert.deepStrictEqual(percorsi.sort(), ['/api/lipe/calcola', '/api/stato'],
    'gli indirizzi chiamati non sono quelli attesi');
  percorsi.forEach((u) => assert.ok(u.startsWith('/'), u + ' non è relativo: uscirebbe dal sito'));

  assert.match(codice, /const FORMA_PROVA_LIPE = \/\^https:.*workers\\.dev\$\//,
    'manca il vincolo di forma sull’indirizzo di prova');

  /* Prima di spedire si controlla che dall'altra parte ci sia il servizio:
     senza, con la Route non attiva, un POST finirebbe a GitHub Pages. */
  assert.match(codice, /if \(!\(await ilServizioLipeCe\(\)\)\) throw guastoLipe\('assente'\);/,
    'manca la sonda che precede ogni invio');
  const i = codice.indexOf('async function chiamaLipe(');
  const j = codice.indexOf('ilServizioLipeCe()', i);
  const k = codice.indexOf('body: JSON.stringify(corpo)', i);
  assert.ok(i !== -1 && j !== -1 && k !== -1 && j < k,
    'la sonda deve stare prima del corpo della richiesta, non dopo');
});

test('nessun dato identificativo è fra i campi che LIPE spedirebbe', () => {
  const html = fs.readFileSync(path.join(root, 'tools', 'lipe', 'index.html'), 'utf8');
  const codice = html.match(/\/\* >>> PONTE LIPE[\s\S]*?\/\* >>> fine PONTE LIPE <<< \*\//)[0];

  /* Il registro non parte: parte la somma per rigo VP e per mese. Quindi nel
     payload non c'è nessun posto dove un codice IVA possa infilarsi. */
  const costruttore = codice.match(/function costruisciPayload\(stato, api\) \{([\s\S]*?)\n\}/);
  assert.ok(costruttore, 'non trovo il costruttore del payload');
  ['denom', 'piva', 'cf', 'repCf', 'interCf', 'notes', 'sourceFile', 'code', 'description', 'note']
    .forEach((campo) => {
      assert.equal(new RegExp('\b' + campo + ':').test(costruttore[1]), false,
        campo + ' non deve comparire fra i campi che partono');
    });

  /* Le uniche stringhe ammesse, e sono elenchi chiusi. */
  assert.match(codice, /const PERIODICITA = \['M', 'T'\];/);
  assert.match(codice, /const REGIMI = \['', 'ordinary', 'option'\];/);
  /* «eventi» viaggia come sì/no: al calcolo serve sapere se c'è, non che cosa. */
  assert.match(codice, /eventi: !!m\.eventi/,
    'il codice degli eventi eccezionali non deve partire come testo');
});
