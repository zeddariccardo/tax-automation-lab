/* Tax Automation Lab — coerenza delle versioni
   Copyright (c) 2026 Riccardo Zedda — Tax Automation Lab. All rights reserved.

   Perché esiste. L'audit del 21 agosto 2026 (TAL-P1-05) ha trovato versioni
   diverse per lo stesso tool a seconda di dove le si leggeva: il Bilancio
   dichiarava 1.4.0 nell'attributo e nel JSON-LD ma girava con 1.4.1 nel
   codice, Analisi dichiarava 2.1.0 e teneva 2.0.4 in tre costanti, il
   Fascicolo non aveva l'attributo. Nessuno se ne accorgeva perché niente lo
   controllava. Ora lo controlla questo test: se un tool torna a parlare con
   due voci, fallisce alla prima divergenza.

   Cosa NON controlla. Le versioni nei nomi dei file di prompt e template
   (`Prompt_..._v2.0.4.txt`) sono un contratto diverso, che cambia quando
   cambia il formato del file e non a ogni correzione del tool: quelle le
   verifica prompt-template-contract.test.mjs.

   Come si esegue:  node --test tests/
*/
import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');

const TOOLS = {
  'financial-statement': 'Bilancio civilistico ITA GAAP',
  'financial-analysis' : 'Analisi di bilancio',
  'lipe'               : 'Generatore LIPE',
  'tfa-client-file'    : 'Fascicolo fiscale cliente',
  'f24'                : 'Generatore F24',
  'confronto-regimi': 'Confronto regimi'
};

/* Ogni voce è un posto in cui un tool dichiara la propria versione. Le
   etichette servono al messaggio d'errore: leggere «APP_VERSION dice 3.6.0 ma
   data-tool-version dice 3.6.1» è utile, leggere «versioni incoerenti» no. */
const DECLARATIONS = [
  ['attributo data-tool-version', /data-tool-version="([^"]+)"/g],
  ['JSON-LD softwareVersion',     /"softwareVersion"\s*:\s*"([^"]+)"/g],
  ['costante APP_VERSION',        /APP_VERSION\s*=\s*'([^']+)'/g],
  ['costante PATCH_VERSION',      /PATCH_VERSION\s*=\s*'([^']+)'/g],
  ['costante VERSION',            /(?<![A-Z_])VERSION\s*=\s*'(\d[^']*)'/g],
  ['costante V20_VERSION',        /V20_VERSION\s*=\s*'([^']+)'/g],
  ['costante TAL_VERSION',        /TAL_VERSION\s*=\s*'([^']+)'/g],
  ['costante FS_VERSION',         /FS_VERSION\s*=\s*'([^']+)'/g],
  ['etichetta di pubblicazione',  /v(\d+\.\d+\.\d+)<\//g]
];

for (const [dir, label] of Object.entries(TOOLS)) {
  test(`${label}: una sola versione dichiarata`, () => {
    const html = fs.readFileSync(path.join(root, 'tools', dir, 'index.html'), 'utf8');
    const found = new Map();   // versione -> [luoghi che la dichiarano]

    for (const [where, re] of DECLARATIONS) {
      for (const m of html.matchAll(re)) {
        if (!found.has(m[1])) found.set(m[1], []);
        if (!found.get(m[1]).includes(where)) found.get(m[1]).push(where);
      }
    }

    assert.ok(found.size > 0, `${dir}: nessuna versione dichiarata da nessuna parte`);

    if (found.size > 1) {
      const detail = [...found.entries()]
        .map(([v, places]) => `  ${v} — ${places.join(', ')}`)
        .join('\n');
      assert.fail(`${dir}: ${found.size} versioni diverse nello stesso tool.\n${detail}`);
    }
  });

  test(`${label}: dichiara la versione nell'attributo del tag html`, () => {
    const html = fs.readFileSync(path.join(root, 'tools', dir, 'index.html'), 'utf8');
    /* L'attributo è il posto che leggono i test, gli export e il supporto:
       senza, l'unico modo di sapere che versione gira è aprire il sorgente. */
    assert.match(html.slice(0, 4000), /data-tool-version="\d+\.\d+\.\d+"/,
      `${dir}: manca data-tool-version sul tag <html>`);
  });
}

/* Il catalogo.

   `tools/manifest.json` è il catalogo pubblico dei tool: nome, versione, URL,
   licenza. La prima versione di questo test guardava solo dentro le pagine, e
   il manifest è rimasto fuori — quindi ha continuato a dichiarare 1.3.6 per il
   Bilancio che gira a 1.4.1, 3.4.3 per LIPE che gira a 3.6.1, 1.7.1 per il
   Fascicolo che gira a 2.3.2. Era esattamente il difetto che il test doveva
   impedire, in un file che il test non leggeva: il catalogo è uno dei posti
   che TAL-P1-05 elenca, non un ripostiglio.

   Controlla anche che l'elenco dei tool sia lo stesso: un tool nuovo che entra
   nel sito e non nel catalogo resta invisibile a chi legge il manifest. */
test('catalogo: manifest.json elenca gli stessi tool delle pagine', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'tools', 'manifest.json'), 'utf8'));
  const inManifest = manifest.tools.map(t => t.slug).sort();
  const expected = Object.keys(TOOLS).sort();
  assert.deepEqual(inManifest, expected,
    `il catalogo elenca [${inManifest.join(', ')}], le pagine sono [${expected.join(', ')}]`);
});

test('catalogo: le versioni del manifest sono quelle che girano', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'tools', 'manifest.json'), 'utf8'));
  const wrong = [];
  for (const entry of manifest.tools) {
    const html = fs.readFileSync(path.join(root, 'tools', entry.slug, 'index.html'), 'utf8');
    const running = (html.match(/data-tool-version="([^"]+)"/) || [])[1];
    if (running !== entry.version) {
      wrong.push(`  ${entry.slug}: catalogo ${entry.version}, in esecuzione ${running}`);
    }
  }
  assert.equal(wrong.length, 0,
    `${wrong.length} tool con versione sbagliata nel catalogo:\n${wrong.join('\n')}`);
});

test('catalogo: nome e URL del manifest coincidono con le pagine', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'tools', 'manifest.json'), 'utf8'));
  const problems = [];
  for (const entry of manifest.tools) {
    if (TOOLS[entry.slug] && entry.name !== TOOLS[entry.slug]) {
      problems.push(`  ${entry.slug}: il catalogo lo chiama «${entry.name}», il sito «${TOOLS[entry.slug]}»`);
    }
    const url = `https://taxautomationlab.com/tools/${entry.slug}/`;
    if (entry.site_url !== url) problems.push(`  ${entry.slug}: site_url è ${entry.site_url}, atteso ${url}`);
  }
  assert.equal(problems.length, 0, `catalogo non allineato:\n${problems.join('\n')}`);
});

/* Le pagine di catalogo — /tools/, /en/tools/, /es/tools/ — mostrano la versione
   di ogni tool in un badge accanto al nome. Erano fuori da ogni controllo, e
   l'audit del 23 agosto 2026 le ha trovate ferme: il catalogo inglese e quello
   spagnolo dichiaravano 1.3.6 per il Bilancio (che gira con 1.4.1), 2.0.6 per
   Analisi (2.1.0) e 3.4.3 per LIPE (3.6.1); anche quello italiano era indietro
   su due tool. Il test qui sopra non poteva accorgersene, perché confronta
   manifest.json con le pagine dei tool, e il badge non sta né nell'uno né nelle
   altre: è una terza voce, quella che legge chi arriva dal sito. */
const CATALOGHI = ['tools/index.html', 'en/tools/index.html', 'es/tools/index.html'];

for (const catalogo of CATALOGHI) {
  test(`catalogo: i badge di ${catalogo} dichiarano le versioni che girano`, () => {
    const manifest = JSON.parse(fs.readFileSync(path.join(root, 'tools', 'manifest.json'), 'utf8'));
    const atteso = new Map(manifest.tools.map(t => [t.slug, t.version]));
    const html = fs.readFileSync(path.join(root, catalogo), 'utf8');

    const problemi = [];
    let schede = 0;
    for (const card of html.split('<article').slice(1)) {
      const badge = card.match(/<span class="label">([^<]*?·\s*v(\d+\.\d+\.\d+))<\/span>/);
      const link = card.match(/href="\/tools\/([a-z0-9-]+)\/"/);
      if (!badge || !link) continue;
      schede++;
      const slug = link[1];
      if (!atteso.has(slug)) {
        problemi.push(`  ${slug}: la scheda punta a un tool che non sta nel manifest`);
        continue;
      }
      if (badge[2] !== atteso.get(slug)) {
        problemi.push(`  ${slug}: la scheda dice «${badge[1]}», in esecuzione ${atteso.get(slug)}`);
      }
    }

    assert.equal(schede, atteso.size,
      `${catalogo}: ho letto ${schede} schede con badge di versione, i tool sono ${atteso.size}`);
    assert.equal(problemi.length, 0,
      `${catalogo}: badge non allineati al manifest\n${problemi.join('\n')}`);
  });
}

/* Le date del catalogo non sono più duplicate nell'HTML. Ogni scheda espone
   soltanto lo slug e assets/tool-catalog.js legge `updated` dal manifest: la
   stessa fonte che governa già versioni e metadati del tool. */
for (const catalogo of ['tools/index.html', 'en/tools/index.html', 'es/tools/index.html']) {
  test(`catalogo: date e confine di ${catalogo} vengono dal manifest`, () => {
    const manifest = JSON.parse(fs.readFileSync(path.join(root, 'tools', 'manifest.json'), 'utf8'));
    const html = fs.readFileSync(path.join(root, catalogo), 'utf8');
    assert.match(html, /<script defer src="\/assets\/tool-catalog\.js\?v=\d+"><\/script>/);
    assert.doesNotMatch(html, /(?:Aggiornato il|Updated|Actualizado el)\s+\d{1,2}\s+/);
    for (const voce of manifest.tools) {
      assert.match(voce.updated, /^\d{4}-\d{2}-\d{2}$/, `${voce.slug}: updated non valido`);
      const card = new RegExp(`<article[^>]*data-tool-slug="${voce.slug}"[\\s\\S]*?<\\/article>`).exec(html);
      assert.ok(card, `${catalogo}: scheda ${voce.slug} assente`);
      assert.match(card[0], /data-tool-meta/, `${catalogo}: ${voce.slug} non usa i metadati autorevoli`);
      assert.match(card[0], new RegExp(`href="/tools/${voce.slug}/"`),
        `${catalogo}: URL fallback di ${voce.slug} non allineato`);
      if (catalogo === 'tools/index.html') {
        assert.ok(card[0].includes(`<h2>${voce.name}</h2>`),
          `${catalogo}: nome fallback di ${voce.slug} non allineato`);
      }
    }
  });
}

test('catalogo: lo script usa solo metadata condivisi dal manifest', () => {
  const js = fs.readFileSync(path.join(root, 'assets', 'tool-catalog.js'), 'utf8');
  assert.match(js, /fetch\('\/tools\/manifest\.json'/);
  for (const field of ['name', 'version', 'site_url', 'updated', 'privacy_model']) {
    assert.match(js, new RegExp(`tool\\.${field}\\b`), `tool-catalog.js non usa ${field}`);
  }
  assert.doesNotMatch(js, /\/api\/|calcola\s*\(|compute|aggregate|payload|mapping/i,
    'tool-catalog.js deve contenere solo metadata, non logica dei tool');
});

/* Il separatore delle migliaia va dichiarato, non lasciato al valore
   predefinito. `useGrouping` vale 'auto', e 'auto' segue il CLDR: per
   l'italiano il CLDR **non** raggruppa i numeri di quattro cifre. Nello stesso
   elenco dell'F24 si leggeva «3500,00 €» accanto a «40.620,55 €», e le stesse
   cifre nell'Excel uscivano sempre raggruppate, perché il formato `#,##0.00`
   raggruppa comunque: schermo e file dicevano due cose diverse.

   Il controllo guarda solo i formattatori con i decimali fissati a due, che
   sono quelli monetari: un conteggio o un anno non c'entrano. */
const FORMATTATORI = /(?:new Intl\.NumberFormat|\.toLocaleString)\(\s*'it-IT'\s*,\s*\{([^}]*)\}/g;

for (const [dir, label] of Object.entries(TOOLS)) {
  test(`${label}: i formattatori monetari dichiarano il separatore`, () => {
    const html = fs.readFileSync(path.join(root, 'tools', dir, 'index.html'), 'utf8');
    const senza = [];
    for (const m of html.matchAll(FORMATTATORI)) {
      const opzioni = m[1];
      const monetario = /minimumFractionDigits\s*:\s*(2|dec)/.test(opzioni) || /style\s*:\s*'currency'/.test(opzioni);
      if (!monetario) continue;
      if (!/useGrouping/.test(opzioni)) {
        senza.push(`  riga ${html.slice(0, m.index).split('\n').length}: {${opzioni.trim().slice(0, 80)}}`);
      }
    }
    assert.equal(senza.length, 0,
      `${senza.length} formattatori monetari senza useGrouping:\n${senza.join('\n')}`);
  });
}

/* Le etichette di pubblicazione — «Bilancio civilistico ITA GAAP · v1.4.1»,
   «IVA · v3.6.1» — stanno dentro i dizionari di traduzione, cioè dentro
   virgolette e non fra due tag. Il controllo qui sopra cerca `vX.Y.Z</`, quindi
   quelle gli sfuggivano: il 24 agosto 2026 il Bilancio ne dichiarava tre a
   1.4.0 e LIPE tre a 3.5.0, mentre giravano con 1.4.1 e 3.6.1. Non si vedevano
   in pagina — un blocco le riscrive dalla versione viva — ma è proprio questo
   il problema: un `grep` sul file rispondeva la versione sbagliata.

   Restano fuori i marcatori interni dei blocchi di correzione (`'v1.6.0'` in
   Analisi): sono numeri di quella patch, non del tool, e vivono in stringhe
   senza nient'altro attorno. */
const ETICHETTA = /["'][^"']{3,70}\sv(\d+\.\d+\.\d+)["']/g;

for (const [dir, label] of Object.entries(TOOLS)) {
  test(`${label}: le etichette di pubblicazione dichiarano la versione che gira`, () => {
    const html = fs.readFileSync(path.join(root, 'tools', dir, 'index.html'), 'utf8');
    const attesa = (html.match(/data-tool-version="([^"]+)"/) || [])[1];
    assert.ok(attesa, `${dir}: manca data-tool-version sul tag html`);

    const sbagliate = [];
    for (const m of html.matchAll(ETICHETTA)) {
      if (m[1] === attesa) continue;
      const riga = html.slice(0, m.index).split('\n').length;
      sbagliate.push(`  riga ${riga}: ${m[0].slice(0, 74)} — in esecuzione ${attesa}`);
    }
    assert.equal(sbagliate.length, 0,
      `${sbagliate.length} etichette con una versione diversa da quella che gira:\n${sbagliate.join('\n')}`);
  });
}
