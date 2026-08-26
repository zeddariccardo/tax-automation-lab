/* Le tre lingue devono avere gli stessi pezzi, non solo lo stesso aspetto.
 *
 * Il 25 agosto 2026 Riccardo ha segnalato che le versioni inglese e spagnola non
 * riflettevano l'italiano. Avevo controllato due volte e detto che andava bene:
 *
 *  - il primo controllo contava i titoli e i riquadri. Uguali. Ma due pagine
 *    possono avere lo stesso numero di titoli e dire cose diverse;
 *  - il secondo misurava quanto testo aveva ciascuna pagina, e ho scartato uno
 *    scarto del 14% come rumore. Era una sezione intera, presente solo in
 *    spagnolo.
 *
 * Questo test confronta la **sequenza degli elementi di contenuto** — tag e
 * prima classe — dentro `<main>`, e dice esattamente cosa manca da una parte e
 * cosa avanza dall'altra. E' il controllo che avrebbe dovuto esserci prima.
 *
 * Gli script restano fuori dal confronto, ma con una cautela imparata a spese
 * mie: su queste pagine ci sono stati blocchi inseriti a runtime da uno script,
 * quindi assenti dal markup e presenti a schermo. Per questo il test guarda
 * anche che nessuna pagina costruisca schede con `insertAdjacentHTML`: quello
 * che si vede deve stare nel file.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/* Le pagine che esistono in tutte e tre le lingue, con i loro nomi diversi. */
const TERZINE = [
  ['index.html', 'en/index.html', 'es/index.html'],
  ['tools/index.html', 'en/tools/index.html', 'es/tools/index.html'],
  ['configura-con-ai/index.html', 'en/configure-with-ai/index.html', 'es/configura-con-ia/index.html'],
  ['approfondimenti/index.html', 'en/insights/index.html', 'es/analisis/index.html'],
  ['approfondimenti/riclassificazione-bilancio-ias-ifrs-oic/index.html',
    'en/insights/ias-ifrs-to-italian-statutory-financial-statements/index.html',
    'es/analisis/reclasificacion-ias-ifrs-estados-financieros-italianos/index.html'],
  ['approfondimenti/analisi-e-riclassificazione-bilancio/index.html',
    'en/insights/financial-analysis-and-reclassification/index.html',
    'es/analisis/analisis-y-reclasificacion-financiera/index.html'],
  ['approfondimenti/tfa-client-file/index.html',
    'en/insights/tfa-client-file/index.html',
    'es/analisis/tfa-client-file/index.html'],
  ['approfondimenti/automazione-lipe/index.html',
    'en/insights/lipe-automation/index.html',
    'es/analisis/automatizacion-lipe/index.html'],
  ['approfondimenti/automazione-processi-fiscali-ai/index.html',
    'en/insights/ai-tax-process-automation/index.html',
    'es/analisis/automatizacion-procesos-fiscales-ia/index.html'],
  ['licenses/index.html', 'en/licenses/index.html', 'es/licencias/index.html'],
  ['privacy/index.html', 'en/privacy/index.html', 'es/privacidad/index.html'],
  ['terms/index.html', 'en/terms/index.html', 'es/terminos/index.html'],
  ['security/index.html', 'en/security/index.html', 'es/seguridad/index.html'],
];

const CONTA = ['section', 'article', 'h1', 'h2', 'h3', 'figure', 'table', 'details', 'form'];

function ossatura(rel) {
  let html = fs.readFileSync(path.join(root, rel), 'utf8');
  html = html.replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ').replace(/<!--[\s\S]*?-->/g, ' ');
  const main = html.match(/<main[\s\S]*?<\/main>/i);
  if (main) html = main[0];
  const out = [];
  const re = new RegExp(`<(${CONTA.join('|')})\\b([^>]*)>`, 'gi');
  for (const m of html.matchAll(re)) {
    const cls = (m[2] || '').match(/class="([^"]*)"/);
    const prima = cls && cls[1].trim() ? '.' + cls[1].trim().split(/\s+/)[0] : '';
    out.push(m[1].toLowerCase() + prima);
  }
  return out;
}

const conteggio = (elenco) => elenco.reduce((acc, k) => (acc[k] = (acc[k] || 0) + 1, acc), {});

for (const [it, en, es] of TERZINE) {
  test(`${it.replace('/index.html', '')}: le tre lingue hanno gli stessi pezzi`, () => {
    const base = conteggio(ossatura(it));
    for (const [lingua, rel] of [['inglese', en], ['spagnolo', es]]) {
      const altro = conteggio(ossatura(rel));
      const manca = Object.keys(base).filter((k) => (altro[k] || 0) < base[k])
        .map((k) => `${k} x${base[k] - (altro[k] || 0)}`);
      const inPiu = Object.keys(altro).filter((k) => (base[k] || 0) < altro[k])
        .map((k) => `${k} x${altro[k] - (base[k] || 0)}`);
      assert.equal(manca.length + inPiu.length, 0,
        `${rel} non combacia con ${it}:\n` +
        (manca.length ? `  manca: ${manca.join(', ')}\n` : '') +
        (inPiu.length ? `  in più: ${inPiu.join(', ')}\n` : '') +
        `  Le tre lingue devono avere gli stessi blocchi: se una cambia, cambiano tutte.`);
    }
  });
}

test('nessuna pagina costruisce schede con uno script invece che nel markup', () => {
  const male = [];
  (function cammina(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (['.git', 'node_modules', 'tests', 'resources'].includes(e.name)) continue;
      const p = path.join(d, e.name);
      if (e.isDirectory()) { cammina(p); continue; }
      if (!e.name.endsWith('.html')) continue;
      const html = fs.readFileSync(p, 'utf8');
      for (const m of html.matchAll(/insertAdjacentHTML\([^)]{0,40}<article/g)) {
        male.push(`  ${p.slice(root.length + 1).split(path.sep).join('/')}: ${m[0].slice(0, 70)}…`);
      }
    }
  })(root);
  assert.equal(male.length, 0,
    `${male.length} pagine costruiscono schede a runtime:\n${male.join('\n')}\n` +
    `  Quello che si vede deve stare nel markup: altrimenti non si confronta fra lingue, ` +
    `e una modifica al file rischia di finire dentro una stringa JavaScript.`);
});
