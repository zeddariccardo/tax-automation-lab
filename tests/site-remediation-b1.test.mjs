/* Tax Automation Lab — regressioni mirate Site Remediation B1.
   Questi test verificano copy tecnico, metadati e semantica HTML. Non
   contengono né pilotano motori di calcolo. */
import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import { trackedFiles } from './tracked-files.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');

const toolFiles = [
  'tools/financial-statement/index.html',
  'tools/financial-analysis/index.html',
  'tools/lipe/index.html',
  'tools/confronto-regimi/index.html',
  'tools/f24/index.html',
  'tools/tfa-client-file/index.html'
];

test('trasparenza: manifest distingue quattro tool ibridi e due locali', () => {
  const manifest = JSON.parse(read('tools/manifest.json'));
  const bySlug = new Map(manifest.tools.map(tool => [tool.slug, tool]));
  for (const slug of ['financial-statement', 'financial-analysis', 'lipe', 'confronto-regimi']) {
    const privacy = bySlug.get(slug)?.privacy_model;
    assert.equal(privacy?.processing, 'server_side_calculation', slug);
    assert.equal(privacy?.server_retention, 'none', slug);
    assert.notEqual(privacy?.server_upload, false, slug);
  }
  for (const slug of ['f24', 'tfa-client-file']) {
    const privacy = bySlug.get(slug)?.privacy_model;
    assert.equal(privacy?.processing, 'local_in_browser', slug);
    assert.equal(privacy?.server_upload, false, slug);
  }
  assert.doesNotMatch(JSON.stringify(manifest), /anonim/i);
});

test('trasparenza: cataloghi e manifest non dichiarano la suite interamente locale', () => {
  for (const rel of ['tools/index.html', 'en/tools/index.html', 'es/tools/index.html']) {
    const html = read(rel);
    assert.match(html, /data-tool-slug="financial-statement"/);
    assert.match(html, /data-tool-slug="financial-analysis"/);
    assert.match(html, /data-tool-slug="lipe"/);
    assert.match(html, /data-tool-slug="confronto-regimi"/);
    assert.doesNotMatch(html, /23 (?:agosto|August|de agosto) 2026/i);
  }
  const webmanifest = JSON.parse(read('site.webmanifest'));
  assert.match(webmanifest.description, /dati tecnici o numerici/);
  assert.doesNotMatch(webmanifest.description, /elaborazione locale nel browser/i);
});

test('trasparenza: sidebar LIPE e Confronto regimi descrivono il servizio', () => {
  const lipe = read('tools/lipe/index.html');
  const regimi = read('tools/confronto-regimi/index.html');
  assert.doesNotMatch(lipe, /100% locale/);
  assert.match(lipe, /al servizio solo totali tecnici VP/);
  assert.match(lipe, /senza persistenza/);
  assert.doesNotMatch(regimi, /Elaborazione locale\. I dati non vengono inviati/);
  assert.match(regimi, /al servizio solo valori numerici necessari/);
});

test('trasparenza: i quattro tool ibridi non conservano dichiarazioni interamente locali', () => {
  const forbidden = /100% locale|elaborazione interamente locale|tool locale|nel browser, senza inviare dati|il calcolo lo fa questa pagina/i;
  for (const rel of [
    'tools/financial-statement/index.html',
    'tools/financial-analysis/index.html',
    'tools/lipe/index.html',
    'tools/confronto-regimi/index.html'
  ]) assert.doesNotMatch(read(rel), forbidden, rel);
  assert.match(read('tools/lipe/index.html'), /servizio riceve solo i totali tecnici del quadro VP/);
  assert.match(read('tools/confronto-regimi/index.html'), /nessun payload viene inviato/);
});

test('footer: i sei tool espongono Casi e metodo prima dei link legali', () => {
  for (const rel of toolFiles) {
    const footer = read(rel).match(/<footer[^>]*class="tal-site-footer"[\s\S]*?<\/footer>/)?.[0] || '';
    assert.match(footer, /href="\/approfondimenti\/">Casi e metodo<\/a>/, rel);
    assert.match(footer, /href="\/privacy\/">Privacy<\/a>/, rel);
    assert.match(footer, /href="\/security\/">Sicurezza<\/a>/, rel);
  }
});

test('mailto: i subject statici EN ed ES sono localizzati', () => {
  const en = read('en/index.html');
  const es = read('es/index.html');
  assert.match(en, /subject=Tax%20Automation%20Lab%20%E2%80%94%20Discussion%20about%20a%20process/);
  assert.match(es, /subject=Tax%20Automation%20Lab%20%E2%80%94%20Consulta%20sobre%20un%20proceso/);
  assert.doesNotMatch(en, /subject=[^"\s]*(?:Contatto|Confronto)/);
  assert.doesNotMatch(es, /subject=[^"\s]*(?:Contatto|Confronto)/);
});

function walk(dir) {
  return trackedFiles(dir, {
    exclude: ['assets', 'tests', 'resources'],
    pattern: /(^|\/)index\.html$/
  });
}

test('favicon: ogni pagina indicizzabile usa tutti gli asset esistenti e il manifest', () => {
  const required = ['favicon.ico', 'favicon-32x32.png', 'favicon-16x16.png', 'apple-touch-icon.png', 'site.webmanifest'];
  let indexed = 0;
  for (const file of walk(root)) {
    const head = fs.readFileSync(file, 'utf8').slice(0, 12000);
    if (/name=["']robots["'][^>]*noindex|content=["'][^"']*noindex[^"']*["'][^>]*name=["']robots["']|http-equiv=["']refresh/i.test(head)) continue;
    indexed++;
    for (const asset of required) assert.ok(head.includes(asset), `${path.relative(root, file)}: manca ${asset}`);
  }
  assert.equal(indexed, 45);
});

test('Financial Statement: gli errori di import previsti non producono console.error', () => {
  const html = read('tools/financial-statement/index.html');
  assert.match(html, /function fsIsExpectedImportError\(err\)/);
  assert.match(html, /if\(!fsIsExpectedImportError\(err\)\)console\.error\(err\)/);
  assert.match(html, /Nessun conto trovato nei fogli di bilancio\\\./);
});

test('F24: esiste un solo H1 documentale e i titoli delle viste sono H2', () => {
  const html = read('tools/f24/index.html');
  assert.equal((html.match(/<h1\b/g) || []).length, 1);
  assert.equal((html.match(/<h2 class="stage-title"/g) || []).length, 8);
  assert.match(html, /<h1 class="stage-title">Come vuoi lavorare\?<\/h1>/);
});

test('Privacy e Sicurezza IT EN ES dichiarano i quattro tool ibridi', () => {
  const pages = [
    ['privacy/index.html', /confronto regimi/],
    ['security/index.html', /confronto regimi/],
    ['en/privacy/index.html', /regime comparison/],
    ['en/security/index.html', /confronto regimi|regime comparison/],
    ['es/privacidad/index.html', /comparación de regímenes/],
    ['es/seguridad/index.html', /confronto regimi|comparación de regímenes/]
  ];
  for (const [rel, regimeName] of pages) {
    const html = read(rel).toLowerCase();
    assert.match(html, /lipe/, rel);
    assert.match(html, regimeName, rel);
    assert.match(html, /bilancio|statutory statements|estados financieros/, rel);
    assert.match(html, /analisi di bilancio|financial analysis|análisis financiero/, rel);
    assert.doesNotMatch(html, /aggregat[io] anon|anonymous aggregate|agregados anónimos/, rel);
  }
});

test('sitemap: mantiene 45 URL e usa lastmod non globali', () => {
  const xml = read('sitemap.xml');
  const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>\s*<lastmod>([^<]+)<\/lastmod>/g)];
  assert.equal(urls.length, 45);
  assert.ok(new Set(urls.map(match => match[2])).size > 1, 'tutti i lastmod sono ancora uguali');
});
