/* Lo schermo stretto: le quattro cose della Fase 3.
 *
 * Il menu aveva già il velo e si chiudeva toccando fuori — l'audit diceva di
 * no, e l'audit sbagliava: era stato misurato in un pannello che non compone i
 * fotogrammi, dove la transizione resta ferma sul primo valore. Mancava il
 * resto: Esc, il fuoco, e la pagina dietro che stava ferma.
 *
 * Quello che questi test difendono non si vede guardando lo schermo:
 * un'omissione qui non produce una schermata storta, produce un tool che con la
 * tastiera non si chiude e che sotto il menu continua a scorrere.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = fs.readFileSync(path.join(root, 'tools', 'lipe', 'index.html'), 'utf8');

const script = (() => {
  const i = html.indexOf('<script id="lipe-mobile">');
  assert.ok(i > 0, 'manca lo script della Fase 3');
  return html.slice(i, html.indexOf('</script>', i));
})();
const senzaCommenti = script.replace(/\/\*[\s\S]*?\*\//g, ' ');

/* ══════════════════════════════════════════════════════ 1 · il menu */

test('menu · Esc chiude', () => {
  assert.match(senzaCommenti, /e\.key === 'Escape'/, 'senza tastiera il menu non si chiude');
  assert.match(senzaCommenti, /chiudi\(\)/);
});

test('menu · il fuoco entra all’apertura e torna al comando alla chiusura', () => {
  assert.match(senzaCommenti, /tornaA = document\.activeElement/,
    'chi apre il menu deve ritrovarsi dove l’aveva aperto');
  assert.match(senzaCommenti, /\.lipe-link\.active/,
    'il fuoco va sulla voce attiva, non sulla prima: il menu si apre dove si è');
  assert.match(senzaCommenti, /tornaA && document\.contains\(tornaA\) \? tornaA : tog/);
});

test('menu · con Tab il fuoco resta dentro', () => {
  assert.match(senzaCommenti, /e\.key !== 'Tab'/);
  assert.match(senzaCommenti, /shiftKey && document\.activeElement === primo/,
    'senza la trappola si gira fra elementi coperti dal velo');
  assert.match(senzaCommenti, /document\.activeElement === ultimo/);
});

test('menu · la pagina dietro sta ferma', () => {
  assert.match(senzaCommenti, /classList\.add\('lipe-menu-aperto'\)/);
  assert.match(senzaCommenti, /classList\.remove\('lipe-menu-aperto'\)/);
  assert.match(html, /body\.lipe-menu-aperto\{overflow:hidden/,
    'la classe senza la regola non blocca niente');
});

test('menu · si guarda la classe, non il clic sul comando', () => {
  assert.match(senzaCommenti, /observe\(sb, \{ attributes: true, attributeFilter: \['class'\] \}\)/,
    'il menu si chiude anche scegliendo una voce, e da lì un ascoltatore sul ' +
    'pulsante non passerebbe mai');
});

/* ═══════════════════════════════════════ 2 · la barra di contesto */

test('barra · da chiusa è una riga sola, e dice chi e quando', () => {
  assert.match(senzaCommenti, /className = 'lipe-ctx-riassunto'/);
  assert.match(senzaCommenti, /Nessun cliente selezionato/, 'anche senza cliente deve dire qualcosa');
  assert.match(html, /\.lipe-ctx:not\(\.is-aperta\) \.grid,/,
    'da chiusa i campi restano nel DOM ma non sullo schermo');
  assert.match(html, /\.lipe-ctx-riassunto\{[^}]*min-height:44px/,
    'è il bersaglio di un dito: non può essere più piccolo di 44 pixel');
});

test('barra · il riassunto segue anche i cambi che non passano dal menu a tendina', () => {
  assert.match(senzaCommenti, /getElementById\('active-client-card'\)/);
  assert.match(senzaCommenti, /new MutationObserver\(scrivi\)/);
});

test('barra · dice se è aperta a chi non la vede', () => {
  assert.match(senzaCommenti, /setAttribute\('aria-expanded', String\(aperta\)\)/);
  assert.match(senzaCommenti, /setAttribute\('aria-label', 'Cliente e periodo: '/);
});

/* ══════════════════════════════════ 3 · i controlli superati */

test('controlli · su schermo stretto si contano e si aprono, non spariscono', () => {
  assert.match(senzaCommenti, /className = 'com-superati'/);
  assert.match(senzaCommenti, /'controllo superato' : 'controlli superati'/);
  assert.match(html, /\.com-card\.superati-aperti \.check-item\.ok\{display:flex\}/,
    'il pulsante senza la regola che apre non apre niente');
  assert.match(html, /\.com-superati\{[^}]*min-height:44px/);
});

test('controlli · aperti scorrono dentro invece di allungare la pagina', () => {
  assert.match(html, /\.com-card\.superati-aperti \.checks-grid\{max-height:46vh;overflow-y:auto\}/);
});

/* ══════════════════════════════════════ 4 · i righi VP */

test('righi VP · due colonne invece di quattro, senza scorrimento di lato', () => {
  const m = /@media \(max-width:760px\)\{([\s\S]*?)\n\}/g;
  const blocchi = [...html.matchAll(m)].map((x) => x[1]).join('\n');
  assert.match(blocchi, /\.vp-grid\{grid-template-columns:60px minmax\(0,1fr\);overflow-x:visible\}/,
    'le stesse quattro celle in due righe da due: sopra il rigo e che cos’è, ' +
    'sotto quanto fa');
  assert.match(blocchi, /\.vp-grid > \.vp-head\{display:none\}/,
    'le intestazioni di colonna, in due colonne, mentono');
});

test('righi VP · l’etichetta va addosso al valore, visto che le colonne non ci sono più', () => {
  assert.match(html, /\.vp-grid > :nth-child\(4n\+3\)::before\{content:"Debito \/ valore"/);
  assert.match(html, /\.vp-grid > :nth-child\(4n\+4\)::before\{content:"Credito"/);
  assert.match(html, /\.vp-grid > \.flags::before\{content:none\}/,
    'la riga dei contrassegni non è un importo');
});

test('righi VP · una cella vuota resta al suo posto', () => {
  /* È il punto in cui si sbaglia: togliere una cella vuota con display:none
     sfalsa di uno tutte le righe successive, e da lì in poi «Credito»
     etichetta il codice del rigo. */
  assert.match(html, /:nth-child\(4n\+3\):empty::before,\s*\n?\s*\.vp-grid > :nth-child\(4n\+4\):empty::before\{content:none\}/,
    'la cella vuota perde l’etichetta ma non il posto');
  assert.doesNotMatch(html, /:nth-child\(4n\+4\):empty\{display:none/,
    'toglierla dal flusso sfalserebbe tutti i righi che vengono dopo');
});

/* ═════════════════════════════════════ la riga rossa, anche qui */

test('lo script del telefono non chiede niente al servizio', () => {
  for (const vietato of ['checks(', 'fetch(', 'computePeriod(', 'renderResults(',
    'assicura(', 'buildXml(', 'hasBlocking(']) {
    assert.ok(!senzaCommenti.includes(vietato),
      `lo script del telefono chiama «${vietato}»: qui si spostano pixel, non si ` +
      'chiedono numeri');
  }
});

test('niente di tutto questo tocca il desktop', () => {
  /* Ogni regola della Fase 3 sta dentro una media query. Una che ne uscisse
     cambierebbe la schermata grande senza che nessuno l’abbia chiesto. */
  const i = html.indexOf('<style id="lipe-mobile-v420">');
  assert.ok(i > 0);
  const stile = html.slice(i, html.indexOf('</style>', i));
  const fuoriDaMedia = stile
    .replace(/@media[^{]*\{[\s\S]*?\n\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/<style[^>]*>/, '')
    .split('\n').map((r) => r.trim()).filter(Boolean);
  assert.deepStrictEqual(fuoriDaMedia, ['.lipe-ctx-riassunto{display:none}', '.com-superati{display:none}'],
    'fuori dalle media query devono restare solo le due righe che tengono ' +
    'nascosti sul desktop i comandi che servono solo al telefono');
});
