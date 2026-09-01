/* Tax Automation Lab — generatore del sitemap
   Copyright (c) 2026 Riccardo Zedda — MIT

   Perché esiste. Il sitemap era scritto a mano e le date `lastmod` erano
   rimaste indietro: al 21 agosto 2026 trentasei URL su quarantaquattro
   dichiaravano il 4 agosto, cioè prima di due settimane di modifiche
   (TAL-P2-10). Una data di modifica sbagliata è peggio di nessuna data: dice
   a un motore di ricerca di non tornare a guardare.

   Cosa fa. Cammina il repository, tiene le pagine indicizzabili, scarta gli
   alias `noindex`, e per ogni pagina scrive la data dell'ultima modifica
   registrata da git — non la data di oggi, che sarebbe altrettanto finta.
   Se git non è disponibile ripiega sul tempo di modifica del file.

   Uso:
     node tests/build-sitemap.mjs           scrive sitemap.xml
     node tests/build-sitemap.mjs --check   non scrive, esce 1 se è da rigenerare

   La forma `--check` è quella da mettere in CI: fa fallire la build quando il
   sitemap non è più coerente col contenuto, invece di lasciarlo invecchiare.
*/
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const ORIGIN = 'https://taxautomationlab.com';
const CHECK = process.argv.includes('--check');

/* Cartelle che non contengono pagine del sito. `tests` sta qui: le sue pagine
   sono strumenti di verifica, non contenuto pubblico da indicizzare. */
const SKIP_DIRS = new Set(['.git', '.github', 'node_modules', 'assets', 'legal-docs',
                           'resources', 'tests', '.well-known', '.codex-tools',
                           '.playwright-mcp']);

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      walk(path.join(dir, entry.name), out);
    } else if (entry.name === 'index.html') {
      out.push(path.join(dir, entry.name));
    }
  }
  return out;
}

function gitDate(file) {
  try {
    const rel = path.relative(root, file);
    const dirty = execFileSync('git', ['status', '--porcelain', '--', rel],
      {cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore']}).trim();
    /* Una pagina modificata ma non ancora committata non può ereditare la data
       del commit precedente: sarebbe già falsa nel momento in cui si prepara
       la release. In quel solo caso usiamo la mtime reale del file. Dopo il
       commit la fonte torna automaticamente a essere la data Git. */
    if (dirty) return fs.statSync(file).mtime.toISOString().slice(0, 10);
    const out = execFileSync('git', ['log', '-1', '--format=%cs', '--', rel],
      {cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore']}).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(out)) return out;
  } catch { /* git assente o file non tracciato */ }
  return fs.statSync(file).mtime.toISOString().slice(0, 10);
}

const pages = [];
for (const file of walk(root)) {
  const html = fs.readFileSync(file, 'utf8');
  const head = html.slice(0, 6000);
  /* Gli alias esistono per non rompere vecchi indirizzi: sono `noindex` e non
     devono comparire nel sitemap, altrimenti si dichiarano due URL per la
     stessa pagina.

     L'ordine degli attributi non è garantito — in queste pagine `content`
     viene prima di `name` — quindi si isola il tag e poi si guarda dentro.
     Cercare `name="robots"` seguito da `noindex` nella stessa espressione
     lasciava passare tutti e diciannove gli alias. */
  const robots = head.match(/<meta\b[^>]*\bname=["']robots["'][^>]*>/i)
              || head.match(/<meta\b[^>]*\bcontent=["'][^"']*["'][^>]*\bname=["']robots["'][^>]*>/i);
  if (robots && /noindex/i.test(robots[0])) continue;
  /* Le pagine di solo reindirizzamento non sono contenuto. */
  if (/<meta\b[^>]*http-equiv=["']refresh["']/i.test(head)) continue;

  const rel = path.relative(root, path.dirname(file)).split(path.sep).join('/');
  pages.push({ loc: ORIGIN + (rel ? '/' + rel + '/' : '/'), lastmod: gitDate(file) });
}

pages.sort((a, b) => a.loc.localeCompare(b.loc, 'en'));

const xml = '<?xml version="1.0" encoding="utf-8"?>\n'
  + '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
  + pages.map(p => `  <url>\n    <loc>${p.loc}</loc>\n    <lastmod>${p.lastmod}</lastmod>\n  </url>\n`).join('')
  + '</urlset>\n';

const target = path.join(root, 'sitemap.xml');
const current = fs.existsSync(target) ? fs.readFileSync(target, 'utf8') : '';

if (CHECK) {
  /* Cosa controlla, e perché non confronta i byte.

     La prima versione pretendeva che il file generato fosse identico a quello
     committato. In CI falliva sempre, e per un difetto di progetto, non del
     sitemap: le date vengono dai commit, quindi il commit che aggiorna
     sitemap.xml cambia le date che sitemap.xml dovrebbe dichiarare. È una
     rincorsa che non può vincere.

     Quello che rot davvero è l'elenco degli URL: una pagina nuova che nessuno
     dichiara, o un alias `noindex` dichiarato per errore. Quello si controlla
     in modo stretto. Sulle date si controlla che siano date valide e non nel
     futuro — un `lastmod` domani dice a un motore di ricerca una bugia — e si
     segnala lo scostamento senza far fallire la build: rigenerarlo è un
     comando, e va fatto quando si prepara una release. */
  const declared = new Map(
    [...current.matchAll(/<loc>([^<]+)<\/loc>\s*<lastmod>([^<]+)<\/lastmod>/g)]
      .map(m => [m[1], m[2]]));
  const expected = new Map(pages.map(p => [p.loc, p.lastmod]));

  const missing = [...expected.keys()].filter(u => !declared.has(u));
  const extra   = [...declared.keys()].filter(u => !expected.has(u));
  const today   = new Date().toISOString().slice(0, 10);
  const badDate = [...declared.entries()]
    .filter(([, d]) => !/^\d{4}-\d{2}-\d{2}$/.test(d) || d > today);

  const problems = [];
  if (missing.length) problems.push(`pagine indicizzabili non dichiarate (${missing.length}):\n  ` + missing.join('\n  '));
  if (extra.length)   problems.push(`URL dichiarati che non esistono o sono noindex (${extra.length}):\n  ` + extra.join('\n  '));
  if (badDate.length) problems.push(`lastmod non valido o nel futuro (${badDate.length}):\n  `
    + badDate.map(([u, d]) => `${d}  ${u}`).join('\n  '));

  if (problems.length) {
    console.error('sitemap.xml non è allineato al contenuto.\n');
    console.error(problems.join('\n\n'));
    console.error('\nRigeneralo con:  node tests/build-sitemap.mjs');
    process.exit(1);
  }

  const drifted = [...expected.entries()].filter(([u, d]) => declared.get(u) !== d);
  console.log(`sitemap.xml allineato: ${pages.length} URL, nessuno mancante o di troppo.`);
  if (drifted.length) {
    console.log(`${drifted.length} date di modifica sono cambiate dopo l'ultima generazione.`);
    console.log('Non è un errore. Rigenera prima di una release:  node tests/build-sitemap.mjs');
  }
  process.exit(0);
}

fs.writeFileSync(target, xml);
console.log(`sitemap.xml scritto: ${pages.length} URL indicizzabili.`);
const dates = [...new Set(pages.map(p => p.lastmod))].sort();
console.log(`date lastmod, da ${dates[0]} a ${dates[dates.length - 1]} (${dates.length} distinte).`);
