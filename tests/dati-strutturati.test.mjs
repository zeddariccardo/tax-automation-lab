/* I dati strutturati (JSON-LD).
 *
 * Il 24 agosto 2026, letti per la prima volta: 36 blocchi, tutti JSON valido.
 * Due cose non tornavano. **Analisi di bilancio era l'unico dei sei tool senza
 * dati strutturati**, quindi non poteva comparire come applicazione nei
 * risultati di ricerca mentre gli altri cinque sì. E un articolo spagnolo
 * portava ancora la `headline` di prima che il titolo fosse corretto.
 *
 * Nota di metodo: `headline` si confronta con l'**H1**, non con il `<title>`.
 * Il titolo della scheda è volutamente più corto e scritto per i motori di
 * ricerca — confrontarlo con la headline mi aveva fatto contare nove difetti
 * che non esistevano.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { trackedFiles } from './tracked-files.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITO = 'https://taxautomationlab.com';
const TOOLS = ['financial-statement', 'financial-analysis', 'lipe', 'tfa-client-file', 'f24', 'confronto-regimi'];

const pagine = trackedFiles(root, { exclude: ['tests'], pattern: /\.html$/ });

const rel = (p) => p.slice(root.length + 1).split(path.sep).join('/');
const percorsoDi = (u) => {
  if (!String(u).startsWith(SITO)) return null;
  let f = String(u).slice(SITO.length).replace(/^\//, '').split('#')[0].split('?')[0];
  if (f === '' || f.endsWith('/')) f += 'index.html';
  else if (!path.extname(f)) f += '/index.html';
  return f;
};

const letti = pagine.map((p) => {
  const h = fs.readFileSync(p, 'utf8');
  const grezzoH1 = (h.match(/<h1[^>]*>([\s\S]*?)<\/h1>/) || [])[1];
  return {
    f: rel(p),
    h1: grezzoH1 ? grezzoH1.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim() : null,
    blocchi: [...h.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]),
  };
});

function nodi(testo) {
  const d = JSON.parse(testo);
  return Array.isArray(d) ? d : (d['@graph'] || [d]);
}

test('ogni blocco JSON-LD e’ JSON valido e dichiara un @type', () => {
  const male = [];
  for (const { f, blocchi } of letti) {
    for (const b of blocchi) {
      let ns;
      try { ns = nodi(b); }
      catch (e) { male.push(`  ${f}: JSON non valido — ${e.message.slice(0, 70)}`); continue; }
      for (const n of ns) {
        if (!n || typeof n !== 'object') { male.push(`  ${f}: nodo che non e’ un oggetto`); continue; }
        if (!n['@type']) male.push(`  ${f}: nodo senza @type`);
      }
    }
  }
  assert.equal(male.length, 0, `${male.length} blocchi malformati:\n${male.join('\n')}`);
});

test('ogni tool dichiara la sua SoftwareApplication, completa', () => {
  const male = [];
  for (const dir of TOOLS) {
    const pagina = letti.find((x) => x.f === `tools/${dir}/index.html`);
    assert.ok(pagina, `${dir}: pagina non trovata`);
    const app = pagina.blocchi.flatMap((b) => { try { return nodi(b); } catch { return []; } })
      .find((n) => String(n['@type']) === 'SoftwareApplication');
    if (!app) { male.push(`  ${dir}: nessuna SoftwareApplication`); continue; }
    for (const k of ['name', 'url', 'description', 'softwareVersion', 'applicationCategory', 'offers', 'author']) {
      if (!(k in app)) male.push(`  ${dir}: SoftwareApplication senza ${k}`);
    }
    const attesa = (fs.readFileSync(path.join(root, 'tools', dir, 'index.html'), 'utf8')
      .match(/data-tool-version="([^"]+)"/) || [])[1];
    if (app.softwareVersion !== attesa) {
      male.push(`  ${dir}: softwareVersion "${app.softwareVersion}" ma il tool gira ${attesa}`);
    }
    if (app.url !== `${SITO}/tools/${dir}/`) male.push(`  ${dir}: url "${app.url}" sbagliato`);
  }
  assert.equal(male.length, 0, `${male.length} problemi:\n${male.join('\n')}`);
});

test('la headline di un articolo dice quello che dice il suo H1', () => {
  const male = [];
  for (const { f, h1, blocchi } of letti) {
    if (!h1) continue;
    for (const b of blocchi) {
      let ns;
      try { ns = nodi(b); } catch { continue; }
      for (const n of ns) {
        if (!/Article|BlogPosting/.test(String(n['@type'] || ''))) continue;
        if (!n.headline) continue;
        if (String(n.headline).trim() !== h1) {
          male.push(`  ${f}:\n      headline "${String(n.headline).trim()}"\n      h1       "${h1}"`);
        }
      }
    }
  }
  assert.equal(male.length, 0, `${male.length} headline che non dicono quello che dice l’H1:\n${male.join('\n')}`);
});

test('gli indirizzi dichiarati nei dati strutturati esistono', () => {
  const male = [];
  for (const { f, blocchi } of letti) {
    for (const b of blocchi) {
      let ns;
      try { ns = nodi(b); } catch { continue; }
      for (const n of ns) {
        for (const k of ['url', 'mainEntityOfPage', 'item', 'image']) {
          const v = n[k];
          const lista = Array.isArray(v) ? v : (typeof v === 'string' ? [v] : []);
          for (const u of lista) {
            if (!String(u).startsWith(SITO)) continue;
            const t = /\.(png|jpg|jpeg|webp|svg|ico)$/i.test(String(u))
              ? String(u).slice(SITO.length).replace(/^\//, '')
              : percorsoDi(u);
            if (t && !fs.existsSync(path.join(root, t))) male.push(`  ${f}: ${n['@type']}.${k} -> ${u} (non esiste)`);
          }
        }
      }
    }
  }
  assert.equal(male.length, 0, `${male.length} indirizzi che non portano a niente:\n${male.join('\n')}`);
});
