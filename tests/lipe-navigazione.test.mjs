/* La navigazione di LIPE: una vista, una voce di menu, un indirizzo.
 *
 * Il 25 agosto 2026 i due pulsanti aggiunti il giorno prima — «Dati telematici»
 * e «Codiciario IVA» — non facevano niente. Non era un ascoltatore perso: la
 * sidebar usa la delega, il click arrivava. Era `go(id)`, che comincia con
 *
 *     if(SECTIONS.indexOf(id)<0)id='client-config';
 *
 * e `SECTIONS` non conosceva le due viste nuove: le **rifiutava in silenzio** e
 * ripiegava su «Clienti».
 *
 * Il problema vero: le viste erano registrate in **quattro** elenchi, in quattro
 * blocchi diversi, con slug che non coincidevano nemmeno fra loro (`panoramica`
 * in uno, `importa` nell'altro; `elaborazione` in uno, `elabora` nell'altro).
 * Aggiungerne una voleva dire ricordarsi di tutti e quattro.
 *
 * Ora la sorgente è `window.LIPE_VIEWS`, in testa alla pagina. Questo file
 * verifica che nessuno se ne discosti — è il presidio che mancava.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = fs.readFileSync(path.join(root, 'tools', 'lipe', 'index.html'), 'utf8');

/* La mappa canonica, eseguita davvero: leggerla con una regex vorrebbe dire
   fidarsi di come è scritta. */
function viste() {
  const i = html.indexOf('window.LIPE_VIEWS = {');
  assert.ok(i > 0, 'lipe: è sparita la mappa window.LIPE_VIEWS');
  const j = html.indexOf('};', i) + 2;
  const finto = { window: {} };
  new Function('window', html.slice(i, j))(finto.window);
  return finto.window.LIPE_VIEWS;
}

const MAPPA = viste();

test('ogni voce del menu punta a una vista registrata e presente', () => {
  const male = [];
  /* Dalla Fase 1 tutte e sei le voci stanno nel markup. La sezione, pero', non
     sempre: «Dati e backup» e «Come si usa» nascono da `createElement` con
     `d.id='lipe-data'`. Si cerca l'id in qualunque forma di virgolette. */
  for (const m of html.matchAll(/data-lipeview="([a-z][a-z0-9-]*)"/g)) {
    const id = m[1];
    if (!(id in MAPPA)) male.push(`  la voce "${id}" non è in window.LIPE_VIEWS: go() la rifiuterebbe`);
    if (!new RegExp(`id=["']${id}["']`).test(html)) male.push(`  la voce "${id}" non ha una sezione con quell'id`);
  }
  assert.equal(male.length, 0, `${male.length} voci di menu scollegate:\n${[...new Set(male)].join('\n')}`);
});

test('ogni vista registrata esiste come sezione', () => {
  const male = [];
  for (const id of Object.keys(MAPPA)) {
    /* «Dati e backup» e «Come si usa» non hanno una <section> nel sorgente:
       nascono da `createElement` con `id='lipe-help'`. Si cerca l'id in
       qualunque forma — contare nel sorgente quello che nasce a runtime è la
       trappola in cui sono gia' caduto. */
    if (!new RegExp(`id=["']${id}["']`).test(html)) male.push(`  "${id}" è registrata ma il suo id non compare da nessuna parte`);
  }
  assert.equal(male.length, 0, `${male.length} viste dichiarate e assenti:\n${male.join('\n')}`);
});

test('gli indirizzi sono unici: niente sinonimi per la stessa vista', () => {
  const slug = Object.values(MAPPA);
  const doppi = slug.filter((s, i) => slug.indexOf(s) !== i);
  assert.equal(doppi.length, 0, `indirizzi ripetuti: ${[...new Set(doppi)].join(', ')}`);
  for (const s of slug) assert.match(s, /^[a-z][a-z0-9-]*$/, `indirizzo non canonico: "${s}"`);
});

test('i quattro elenchi leggono la sorgente unica, non un letterale proprio', () => {
  const attesi = [
    ['SECS (showSection)', /SECS=\(window\.LIPE_VIEW_IDS/],
    ['SECTIONS (go)', /var SECTIONS=window\.LIPE_VIEW_IDS/],
    ['HASH (indirizzi)', /var HASH=window\.LIPE_VIEWS/],
    ['ROUTES (blocco di rimedio)', /ROUTES=window\.LIPE_VIEWS/],
  ];
  const male = [];
  for (const [nome, re] of attesi) if (!re.test(html)) male.push(`  ${nome} non legge window.LIPE_VIEWS`);
  assert.equal(male.length, 0,
    `${male.length} elenchi tornati a vivere per conto loro:\n${male.join('\n')}\n` +
    `  È così che i due pulsanti nuovi sono rimasti muti per un giorno.`);
});

test('la mappa copre tutte e nove le viste del menu', () => {
  const nelMenu = new Set([...html.matchAll(/data-lipeview="([a-z][a-z0-9-]*)"/g)].map((m) => m[1]));
  for (const id of nelMenu) assert.ok(id in MAPPA, `"${id}" è nel menu ma non nella mappa`);
  assert.ok(Object.keys(MAPPA).length >= nelMenu.size,
    `la mappa ha ${Object.keys(MAPPA).length} viste, il menu ne usa ${nelMenu.size}`);
});
