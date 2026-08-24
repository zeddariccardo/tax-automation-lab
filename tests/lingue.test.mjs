/* Il sito visto da un motore di ricerca: canonical, hreflang, sitemap.
 *
 * Sono le dichiarazioni che nessuno guarda mai perche' non si vedono in pagina,
 * e che quando sbagliano fanno danno in silenzio: due lingue che si dichiarano
 * l'una il duplicato dell'altra, o una pagina `noindex` proposta come
 * alternativa. Il 24 agosto 2026, misurate per la prima volta, erano **tutte
 * corrette** — 45 pagine indicizzabili, hreflang reciproci, sitemap esatta.
 * Questo file serve a tenerle cosi'.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITO = 'https://taxautomationlab.com';

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
const urlDi = (f) => SITO + '/' + f.replace(/index\.html$/, '');
const fileDi = (u) => {
  if (!String(u).startsWith(SITO)) return null;
  let f = u.slice(SITO.length).replace(/^\//, '').split('#')[0].split('?')[0];
  if (f === '' || f.endsWith('/')) f += 'index.html';
  else if (!path.extname(f)) f += '/index.html';
  return f;
};

/* Gli attributi non sono sempre nello stesso ordine: nel Fascicolo il canonical
   e' scritto `<link href=... rel="canonical"/>`. Cercarlo assumendo un ordine
   mi ha fatto dichiarare un difetto che non c'era. */
function attributo(tag, nome) {
  const m = tag.match(new RegExp(nome + '="([^"]*)"'));
  return m ? m[1] : null;
}

const dati = new Map();
for (const p of pagine) {
  const h = fs.readFileSync(p, 'utf8').replace(/<!--[\s\S]*?-->/g, ' ');
  const alt = {};
  let canonical = null;
  for (const m of h.matchAll(/<link[^>]*>/g)) {
    const r = attributo(m[0], 'rel');
    if (r === 'canonical') { if (!canonical) canonical = attributo(m[0], 'href'); continue; }
    if (r !== 'alternate') continue;
    const l = attributo(m[0], 'hreflang');
    if (l) alt[l] = attributo(m[0], 'href');
  }
  dati.set(rel(p), {
    canonical,
    noindex: /content="[^"]*noindex/.test(h),
    lang: (h.match(/<html[^>]*\slang="([^"]+)"/) || [])[1] || null,
    alt,
  });
}

const indicizzabili = [...dati.entries()].filter(([, d]) => !d.noindex);

test('ogni pagina indicizzabile ha un canonical che punta a se stessa', () => {
  const male = [];
  for (const [f, d] of indicizzabili) {
    if (!d.canonical) { male.push(`  ${f}: nessun canonical`); continue; }
    if (d.canonical !== urlDi(f)) male.push(`  ${f}: canonical "${d.canonical}" invece di "${urlDi(f)}"`);
  }
  assert.equal(male.length, 0, `${male.length} canonical sbagliati:\n${male.join('\n')}`);
});

test('gli hreflang esistono, si ricambiano e non propongono pagine noindex', () => {
  const male = [];
  for (const [f, d] of indicizzabili) {
    const lingue = Object.keys(d.alt).filter((x) => x !== 'x-default');
    if (!lingue.length) { male.push(`  ${f}: nessun hreflang`); continue; }
    if (!d.alt['x-default']) male.push(`  ${f}: manca x-default`);
    if (d.lang && d.alt[d.lang] !== urlDi(f)) {
      male.push(`  ${f}: hreflang="${d.lang}" dovrebbe puntare a se stessa, punta a "${d.alt[d.lang]}"`);
    }
    for (const [l, u] of Object.entries(d.alt)) {
      const t = fileDi(u);
      if (!t) { male.push(`  ${f}: hreflang="${l}" con URL fuori sito: ${u}`); continue; }
      if (!fs.existsSync(path.join(root, t))) { male.push(`  ${f}: hreflang="${l}" -> ${u}, che non esiste`); continue; }
      if (t === f) continue;
      const altra = dati.get(t);
      if (!altra) continue;
      if (altra.noindex) { male.push(`  ${f}: hreflang="${l}" propone ${t}, che e' noindex`); continue; }
      if (altra.alt[d.lang] !== urlDi(f)) {
        male.push(`  ${f}: hreflang="${l}" -> ${t}, che non ricambia (dice "${altra.alt[d.lang]}")`);
      }
    }
  }
  assert.equal(male.length, 0, `${male.length} problemi di hreflang:\n${male.join('\n')}`);
});

test('una pagina noindex non dichiara hreflang', () => {
  const male = [];
  for (const [f, d] of dati) {
    if (!d.noindex) continue;
    const n = Object.keys(d.alt).length;
    if (n) male.push(`  ${f}: noindex ma dichiara ${n} hreflang`);
  }
  assert.equal(male.length, 0, `${male.length} pagine noindex con hreflang:\n${male.join('\n')}`);
});

test('la sitemap elenca tutte e sole le pagine indicizzabili', () => {
  const x = fs.readFileSync(path.join(root, 'sitemap.xml'), 'utf8');
  const elencate = new Set([...x.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => fileDi(m[1])).filter(Boolean));
  const male = [];
  for (const f of elencate) {
    if (!fs.existsSync(path.join(root, f))) { male.push(`  la sitemap elenca ${f}, che non esiste`); continue; }
    if (dati.get(f) && dati.get(f).noindex) male.push(`  la sitemap elenca ${f}, che e' noindex`);
  }
  for (const [f] of indicizzabili) {
    if (f === '404.html') continue;
    if (!elencate.has(f)) male.push(`  la sitemap non elenca ${f}`);
  }
  assert.equal(male.length, 0, `${male.length} scostamenti fra sitemap e pagine:\n${male.join('\n')}`);
});
