/* I tool non caricano risorse da domini esterni. Due tool sono interamente
 * locali; quattro usano esclusivamente il servizio di calcolo TAL.
 *
 * «I file restano nel browser» è scritto nel piede di ogni pagina, nella privacy
 * e nei cataloghi: è la promessa su cui poggia tutto il resto. Il 24 agosto
 * 2026, misurata aprendo i sei tool e leggendo le risorse caricate: **sette
 * risorse ciascuno, zero fuori origine**.
 *
 * Bilancio, Analisi di bilancio, Confronto regimi e LIPE fanno il calcolo su un
 * servizio TAL, allo stesso indirizzo del sito. File e dati account-level non
 * devono entrare nel payload. F24 e Fascicolo restano locali.
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

const CON_SERVIZIO = ['financial-statement', 'financial-analysis', 'lipe', 'confronto-regimi'];
const SENZA_RETE = TOOLS.filter((t) => CON_SERVIZIO.indexOf(t) === -1);
const API_ATTESE = {
  'financial-statement': ['/api/financial-statement/calcola', '/api/stato'],
  'financial-analysis': ['/api/financial-analysis/calcola', '/api/stato'],
  lipe: ['/api/lipe/calcola', '/api/stato'],
  'tfa-client-file': [],
  f24: [],
  'confronto-regimi': ['/api/confronto-regimi/calcola', '/api/stato'],
};

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

function sorgentiRuntime(dir) {
  const toolRoot = path.join(root, 'tools', dir);
  const htmlPath = path.join(toolRoot, 'index.html');
  const html = fs.readFileSync(htmlPath, 'utf8');
  const sources = [{ file: `tools/${dir}/index.html`, code: html }];
  const seen = new Set();

  for (const match of html.matchAll(/<script\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>/gi)) {
    const raw = match[1].trim();
    if (!raw || fuoriOrigine(raw) || /^(?:data:|blob:|javascript:)/i.test(raw)) continue;
    const clean = raw.split(/[?#]/, 1)[0];
    const absolute = clean.startsWith('/')
      ? path.resolve(root, `.${clean}`)
      : path.resolve(toolRoot, clean);
    const relative = path.relative(root, absolute).replace(/\\/g, '/');
    assert.ok(relative && !relative.startsWith('..') && !path.isAbsolute(relative),
      `${dir}: script locale fuori repository: ${raw}`);
    assert.ok(fs.existsSync(absolute), `${dir}: script locale non trovato: ${relative}`);
    if (seen.has(relative)) continue;
    seen.add(relative);
    sources.push({ file: relative, code: fs.readFileSync(absolute, 'utf8') });
  }
  return sources;
}

function percorsiApi(sources) {
  return [...new Set(sources.flatMap(({ code }) =>
    [...code.matchAll(/["'`]((?:\/api\/)[A-Za-z0-9/_-]+)["'`]/g)].map((match) => match[1])
  ))].sort();
}

function patternCampoPayload(campo) {
  const escaped = campo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp('\\b' + escaped + '\\b\\s*:');
}

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
      '  I tool devono caricare solo risorse appartenenti al sito.');
  });
}

test('la classificazione locale/servizio copre esattamente i sei tool', () => {
  assert.deepStrictEqual([...CON_SERVIZIO].sort(),
    ['confronto-regimi', 'financial-analysis', 'financial-statement', 'lipe']);
  assert.deepStrictEqual([...SENZA_RETE].sort(), ['f24', 'tfa-client-file']);
  assert.deepStrictEqual([...new Set([...CON_SERVIZIO, ...SENZA_RETE])].sort(), [...TOOLS].sort());
});

test('gli endpoint dichiarati includono anche gli script runtime caricati', () => {
  for (const dir of TOOLS) {
    assert.deepStrictEqual(percorsiApi(sorgentiRuntime(dir)), [...API_ATTESE[dir]].sort(),
      `${dir}: endpoint inattesi o non coperti`);
  }
  assert.ok(
    sorgentiRuntime('financial-analysis').some(({ file }) => file === 'tools/financial-analysis/authoritative-app.js'),
    'authoritative-app.js deve essere incluso nell’analisi di rete/privacy',
  );
});

test('nessun tool fa richieste di rete a runtime verso l’esterno', () => {
  const male = [];
  for (const dir of TOOLS) {
    for (const { file, code } of sorgentiRuntime(dir)) {
    /* `fetch`, `XMLHttpRequest`, `sendBeacon`, `EventSource`, `WebSocket` verso
       un indirizzo assoluto. Le chiamate a indirizzi relativi non escono dal
       sito e non violano la promessa. */
    for (const m of code.matchAll(/\b(fetch|open|sendBeacon)\s*\(\s*['"`]((?:https?:)?\/\/[^'"`]+)/g)) {
      male.push(`  ${file}: ${m[1]}("${m[2].slice(0, 70)}")`);
    }
    for (const m of code.matchAll(/new\s+(WebSocket|EventSource)\s*\(\s*['"`]([^'"`]+)/g)) {
      male.push(`  ${file}: new ${m[1]}("${m[2].slice(0, 70)}")`);
    }
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

  /* No production override: the shared transport constrains development to loopback. */
  assert.match(codice, /window\.TAL_API\.request\(PERCORSO,/);
  assert.doesNotMatch(codice, /localStorage\.getItem|sessionStorage\.getItem|FORMA_PROVA/);
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

  assert.ok(codice.includes('window.TAL_API.request(PERCORSO_LIPE,'));
  assert.doesNotMatch(codice, /localStorage\.getItem|sessionStorage\.getItem|FORMA_PROVA_LIPE/);

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
      assert.equal(patternCampoPayload(campo).test(costruttore[1]), false,
        campo + ' non deve comparire fra i campi che partono');
    });

  /* Le uniche stringhe ammesse, e sono elenchi chiusi. */
  assert.match(codice, /const PERIODICITA = \['M', 'T'\];/);
  assert.match(codice, /const REGIMI = \['', 'ordinary', 'option'\];/);
  /* «eventi» viaggia come sì/no: al calcolo serve sapere se c'è, non che cosa. */
  assert.match(codice, /eventi: !!m\.eventi/,
    'il codice degli eventi eccezionali non deve partire come testo');
});

test('la guardia anti-PII LIPE rileva davvero una chiave vietata nel payload', () => {
  const sentinella = 'return { anno: 2026, denom: stato.denom, mesi: [] };';
  assert.equal(patternCampoPayload('denom').test(sentinella), true,
    'la prova positiva deve intercettare denom: se entra nel costruttore');
  assert.equal(patternCampoPayload('denom').test('return { anno: 2026, mesi: [] };'), false,
    'la guardia non deve produrre un falso positivo senza la chiave vietata');
  assert.equal(patternCampoPayload('denom').test('return { notdenom: 1 };'), false,
    'il word-boundary deve distinguere denom da una chiave più lunga');
});
