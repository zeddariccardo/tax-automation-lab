/* I collegamenti interni del sito.
 *
 * Non serve un server: le pagine sono file, e GitHub Pages serve `/qualcosa/`
 * come `/qualcosa/index.html`. Il 24 agosto 2026 questo controllo, scritto per
 * la prima volta, ha trovato **39 ancore che non portavano da nessuna parte**:
 * `id="about"` era stato aggiunto alla home italiana e mai a quella inglese e
 * spagnola, quindi la voce «About» / «Sobre mí» dell'intestazione — presente su
 * ogni pagina delle due lingue — lasciava il lettore in cima. Piu' la scheda di
 * LIPE in «Configura con AI», l'unica delle sei senza il proprio `id`.
 *
 * Si guarda solo il markup: i collegamenti costruiti dentro il JavaScript non
 * si possono verificare cosi', e fingere di averlo fatto sarebbe peggio.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const pagine = [];
(function cammina(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    if (e.name === '.git' || e.name === 'node_modules' || e.name === 'tests') continue;
    const p = path.join(d, e.name);
    if (e.isDirectory()) cammina(p);
    else if (e.name.endsWith('.html')) pagine.push(p);
  }
})(root);

const rel = (p) => p.slice(root.length + 1).split(path.sep).join('/');

/* Commenti e script fuori: un `id` nominato dentro un commento non esiste in
   pagina. Ci sono cascato scrivendo questo controllo — il commento che spiega
   la correzione conteneva `id="about"`, e il controllo si dichiarava
   soddisfatto anche dopo che avevo tolto l'attributo vero. */
const ripulisci = (h) => h
  .replace(/<!--[\s\S]*?-->/g, ' ')
  .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ');

const testo = new Map(pagine.map((p) => [rel(p), ripulisci(fs.readFileSync(p, 'utf8'))]));

const idDi = new Map();
function ids(f) {
  if (idDi.has(f)) return idDi.get(f);
  const s = new Set();
  const h = testo.get(f) || '';
  for (const m of h.matchAll(/\sid="([^"]+)"/g)) s.add(m[1]);
  for (const m of h.matchAll(/\sname="([^"]+)"/g)) s.add(m[1]);
  idDi.set(f, s);
  return s;
}

function risolvi(daFile, href) {
  let u = String(href).trim();
  if (!u || /^(https?:|mailto:|tel:|data:|javascript:|blob:|#)/i.test(u)) return null;
  u = u.split('?')[0];
  let ancora = null;
  const h = u.indexOf('#');
  if (h >= 0) { ancora = u.slice(h + 1); u = u.slice(0, h); }
  let f;
  if (u === '') f = daFile;
  else if (u.startsWith('/')) f = u.slice(1);
  else f = path.posix.normalize(path.posix.join(path.posix.dirname(daFile), u));
  if (f.endsWith('/') || f === '') f += 'index.html';
  else if (!path.posix.extname(f)) f += '/index.html';
  return { f, ancora };
}

const rotti = [];
const ancoreRotte = [];
for (const [f, h] of testo) {
  const visti = new Set();
  for (const m of h.matchAll(/(?:href|src)="([^"]*)"/g)) {
    if (visti.has(m[1])) continue;
    visti.add(m[1]);
    const r = risolvi(f, m[1]);
    if (!r) continue;
    if (!fs.existsSync(path.join(root, r.f))) {
      rotti.push(`  ${f} -> ${m[1]}  (manca ${r.f})`);
      continue;
    }
    if (r.ancora && testo.has(r.f) && !ids(r.f).has(r.ancora)) {
      ancoreRotte.push(`  ${f} -> ${m[1]}  (in ${r.f} non c'e' nessun id "${r.ancora}")`);
    }
  }
}

test('nessun collegamento interno punta a un file che non esiste', () => {
  assert.equal(rotti.length, 0, `${rotti.length} collegamenti rotti:\n${rotti.slice(0, 25).join('\n')}`);
});

test('ogni ancora #id esiste nella pagina di destinazione', () => {
  assert.equal(ancoreRotte.length, 0,
    `${ancoreRotte.length} ancore che non portano da nessuna parte:\n${ancoreRotte.slice(0, 25).join('\n')}`);
});

test('le tre home dichiarano le stesse ancore di navigazione', () => {
  for (const home of ['index.html', 'en/index.html', 'es/index.html']) {
    for (const a of ['about', 'intro']) {
      assert.ok(ids(home).has(a), `${home}: manca id="${a}", e la navigazione ci punta da ogni pagina`);
    }
  }
});
