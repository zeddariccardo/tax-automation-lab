/* Tax Automation Lab — contratto di licenze e proprietà intellettuale
   Copyright (c) 2026 Riccardo Zedda — Tax Automation Lab. All rights reserved.

   Impedisce di attribuire nuovamente una licenza aperta al software originale
   TAL, mantiene allineate le tre pagine Licenze e protegge le notice dei
   componenti di terzi e dei font distribuiti con il sito.
*/
import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const exists = (rel) => fs.existsSync(path.join(root, rel));

const TOOL_SLUGS = [
  'financial-statement',
  'financial-analysis',
  'lipe',
  'tfa-client-file',
  'f24',
  'confronto-regimi'
];

const PROPRIETARY_URL =
  'https://taxautomationlab.com/legal-docs/PROPRIETARY-NOTICE.txt';

test('package frontend: non è pubblicabile e non concede una licenza npm', () => {
  const pkg = JSON.parse(read('package.json'));
  assert.equal(pkg.private, true);
  assert.equal(pkg.license, 'UNLICENSED');
});

test('avviso proprietario: contiene le tre versioni e lo stesso perimetro', () => {
  const notice = read('legal-docs/PROPRIETARY-NOTICE.txt');
  const normalised = notice.replace(/\s+/g, ' ');
  for (const marker of [
    'ITALIANO — TESTO SORGENTE',
    'ENGLISH — FAITHFUL TRANSLATION',
    'ESPAÑOL — TRADUCCIÓN FIEL'
  ]) assert.ok(notice.includes(marker), 'manca: ' + marker);

  const headings = [
    ['Software originale Tax Automation Lab', 'Original Tax Automation Lab software',
      'Software original de Tax Automation Lab'],
    ['Uso degli strumenti attraverso il sito', 'Use of the tools through the website',
      'Uso de las herramientas a través del sitio'],
    ['Dati e output dell’utente', 'User data and outputs', 'Datos y resultados del usuario'],
    ['Componenti e librerie di terzi', 'Third-party components and libraries',
      'Componentes y librerías de terceros'],
    ['Contenuti, marchio e materiali editoriali', 'Content, trade mark and editorial materials',
      'Contenidos, marca y materiales editoriales']
  ];
  for (const translated of headings) {
    for (const heading of translated) assert.ok(notice.includes(heading), 'manca: ' + heading);
  }

  for (const required of [
    'Tutti i diritti riservati',
    'All rights reserved',
    'Todos los derechos reservados',
    'I dati e i documenti caricati restano dell’utente',
    'Data and documents uploaded by the user remain the user’s',
    'Los datos y documentos cargados siguen siendo del usuario',
    'aggirare limiti o misure tecniche',
    'circumvent limits or technical measures',
    'eludir límites o medidas técnicas'
  ]) assert.ok(normalised.includes(required), 'avviso proprietario incompleto: ' + required);
});

test('pagine Licenze: cinque sezioni equivalenti in IT, EN ed ES', () => {
  const pages = [
    'licenses/index.html',
    'en/licenses/index.html',
    'es/licencias/index.html'
  ];
  const expected = [
    'original-software',
    'website-use',
    'user-data',
    'third-party',
    'content-brand'
  ];
  for (const rel of pages) {
    const html = read(rel);
    const found = [...html.matchAll(/data-license-section="([^"]+)"/g)].map((m) => m[1]);
    assert.deepEqual(found, expected, rel + ': sezioni licenza divergenti');
    assert.ok(html.includes('/legal-docs/PROPRIETARY-NOTICE.txt'));
    assert.ok(html.includes('/legal-docs/THIRD-PARTY-NOTICES.txt'));
    assert.doesNotMatch(html, /open[ -]?source|licen[cs](?:e|a)\s+MIT|codice\s+MIT|software\s+libero/i);
  }
});

test('Termini: le tre lingue tutelano software, dati e output', () => {
  const pages = [
    ['terms/index.html', '/licenses/', 'I dati e i documenti caricati restano dell’utente'],
    ['en/terms/index.html', '/en/licenses/', 'Data and documents uploaded by the user remain the user’s'],
    ['es/terminos/index.html', '/es/licencias/', 'Los datos y documentos cargados siguen siendo del usuario']
  ];
  for (const [rel, href, dataText] of pages) {
    const html = read(rel);
    assert.ok(html.includes(href), rel + ': manca il link alla pagina Licenze');
    assert.ok(html.includes(dataText), rel + ': manca la titolarità dei dati');
    assert.match(html, /proprietari|proprietary|propietarios/i);
  }
});

test('sei tool: header e metadata puntano al regime proprietario', () => {
  const manifest = JSON.parse(read('tools/manifest.json'));
  assert.deepEqual(manifest.tools.map((tool) => tool.slug).sort(), [...TOOL_SLUGS].sort());
  for (const entry of manifest.tools) assert.equal(entry.license, PROPRIETARY_URL);

  for (const slug of TOOL_SLUGS) {
    const html = read('tools/' + slug + '/index.html');
    const originalHeader = html.slice(0, 1500);
    assert.match(originalHeader, /All rights reserved\./);
    assert.match(originalHeader, /Original TAL software is proprietary\./);
    assert.ok(originalHeader.includes('/legal-docs/PROPRIETARY-NOTICE.txt'));
    const ldBlocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)]
      .map((match) => JSON.parse(match[1]));
    const app = ldBlocks.find((block) => block['@type'] === 'SoftwareApplication');
    assert.ok(app, slug + ': metadata SoftwareApplication assenti');
    assert.equal(app.license, PROPRIETARY_URL, slug + ': metadata licenza non proprietario');
    assert.doesNotMatch(originalHeader, /open[ -]?source|licensed under the MIT|legal-docs\/MIT\.txt/i);
  }
});

test('superfici originali TAL: non dichiarano licenze aperte', () => {
  const surfaces = [
    read('licenses/index.html'),
    read('en/licenses/index.html'),
    read('es/licencias/index.html'),
    read('tools/manifest.json'),
    read('package.json'),
    read('assets/tal-focus-guard.js').slice(0, 2500),
    ...TOOL_SLUGS.map((slug) => read('tools/' + slug + '/index.html').slice(0, 1500))
  ].join('\n');
  assert.doesNotMatch(surfaces,
    /open[ -]?source|open\s+access|software\s+libero|licensed\s+under\s+the\s+MIT|licenza\s+MIT|"license"\s*:\s*"MIT"/i);
});

test('notice storiche: MIT resta confinata ai terzi e il sito resta proprietario', () => {
  const mit = read('legal-docs/MIT.txt');
  assert.ok(mit.startsWith('THIRD-PARTY MIT LICENCE REFERENCE'));
  assert.ok(mit.includes('does not grant any rights in the original software'));
  assert.doesNotMatch(mit, /Copyright \(c\) 2026 Riccardo Zedda/i);

  const site = read('legal-docs/SITE-CONTENT-NOTICE.txt');
  assert.match(site, /All rights reserved\./);
  assert.match(site, /original website[\s\S]*proprietary/i);
  assert.ok(site.includes('PROPRIETARY-NOTICE.txt'));
  assert.ok(site.includes('THIRD-PARTY-NOTICES.txt'));
});

test('SheetJS: banner, attribuzione Apache e licenza completa restano presenti', () => {
  for (const slug of TOOL_SLUGS) {
    const html = read('tools/' + slug + '/index.html');
    assert.ok(html.includes('data-vendored="SheetJS 0.20.3"'), slug + ': SheetJS non marcato');
    assert.ok(html.includes('xlsx.js (C) 2013-present SheetJS'), slug + ': banner SheetJS assente');
  }
  const apache = read('legal-docs/APACHE-2.0.txt');
  assert.ok(apache.includes('Copyright (C) 2012-present SheetJS LLC'));
  assert.ok(apache.includes('Apache License'));
  assert.ok(apache.includes('END OF TERMS AND CONDITIONS'));
});

test('librerie PDF e ZIP: perimetro e banner non cambiano', () => {
  const expected = {
    'financial-statement': { jspdf: true, autotable: true, jszip: false, pako: true },
    'financial-analysis': { jspdf: false, autotable: false, jszip: false, pako: false },
    'lipe': { jspdf: true, autotable: true, jszip: false, pako: true },
    'tfa-client-file': { jspdf: false, autotable: false, jszip: false, pako: false },
    'f24': { jspdf: true, autotable: false, jszip: true, pako: true },
    'confronto-regimi': { jspdf: false, autotable: false, jszip: false, pako: false }
  };
  for (const [slug, libraries] of Object.entries(expected)) {
    const html = read('tools/' + slug + '/index.html');
    assert.equal(html.includes('jsPDF - PDF Document creation from JavaScript'), libraries.jspdf,
      slug + ': inventario jsPDF divergente');
    assert.equal(html.includes('jsPDF AutoTable plugin v5.0.8'), libraries.autotable,
      slug + ': inventario AutoTable divergente');
    assert.equal(html.includes('JSZip v3.10.1'), libraries.jszip,
      slug + ': inventario JSZip divergente');
    assert.equal(html.includes('pako 2.1.0'), libraries.pako,
      slug + ': inventario pako divergente');
  }

  const fsTool = read('tools/financial-statement/index.html');
  const f24 = read('tools/f24/index.html');
  assert.ok(fsTool.includes('Copyright (c) 2010-2025 James Hall'));
  assert.ok(fsTool.includes('Copyright (c) 2026 Simon Bengtsson'));
  assert.ok(f24.includes('(c) 2009-2016 Stuart Knightley'));
  assert.ok(f24.includes('Dual licenced under the MIT license or GPLv3'));
});

test('font: file, copyright e SIL OFL 1.1 restano disponibili', () => {
  for (const file of [
    'assets/fonts/inter-var-latin.woff2',
    'assets/fonts/inter-var-latin-ext.woff2',
    'assets/fonts/newsreader-var-latin.woff2',
    'assets/fonts/newsreader-var-latin-ext.woff2',
    'assets/fonts/newsreader-var-italic-latin.woff2',
    'assets/fonts/newsreader-var-italic-latin-ext.woff2'
  ]) assert.ok(exists(file), 'font assente: ' + file);

  const fontCss = read('assets/fonts/fonts.css');
  assert.ok(fontCss.includes('font-family:"Inter"'));
  assert.ok(fontCss.includes('font-family:"Newsreader"'));

  const notices = read('legal-docs/THIRD-PARTY-NOTICES.txt');
  assert.ok(notices.includes('Copyright (c) 2016 The Inter Project Authors'));
  assert.ok(notices.includes('Copyright 2020 The Newsreader Project Authors'));
  assert.ok(notices.includes('SIL Open Font License 1.1'));

  const ofl = read('legal-docs/OFL-1.1.txt');
  assert.ok(ofl.includes('SIL OPEN FONT LICENSE'));
  assert.ok(ofl.includes('Version 1.1 - 26 February 2007'));
  assert.ok(ofl.includes('PERMISSION & CONDITIONS'));
  assert.ok(ofl.includes('TERMINATION'));
});

test('modulo decorativo remoto: versione e notice restano censite', () => {
  const cdn = 'threejs-components@0.0.19';
  for (const rel of ['index.html', 'en/index.html', 'es/index.html']) {
    assert.ok(read(rel).includes(cdn), rel + ': dipendenza decorativa non censita');
  }
  const notices = read('legal-docs/THIRD-PARTY-NOTICES.txt');
  assert.ok(notices.includes('threejs-components 0.0.19 — ISC'));
  assert.ok(notices.includes('Copyright 2010-2025 Three.js Authors'));
  assert.ok(notices.includes('SPDX-License-Identifier: MIT'));
  assert.ok(notices.includes('contains no standalone LICENSE file'));
});
