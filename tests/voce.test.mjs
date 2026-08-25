/* La voce: le scritte del sito sono di Riccardo, non di un assistente.
 *
 * Dal brief iniziale dell'audit: «dobbiamo togliere scritte "AI" nei tool tipo
 * "Non ho trovato fonti aggiornate.." — le scritte devono sembrare scritte da
 * me». Cercate su tutte le pagine il 24 agosto 2026, ne restavano **due**, in
 * Confronto regimi, sulla riduzione dei minimi CNPADC. Riscritte in forma
 * impersonale: cambia la voce, non il contenuto.
 *
 * Cosa resta legittimo, e perché:
 * - i **prompt** di «Configura con AI» parlano a un'AI («Agisci come
 *   assistente…»): è il loro mestiere;
 * - «Ciao, sono Riccardo… Ho creato Tax Automation Lab» è Riccardo che parla;
 * - «Ho capito: controllerò il file…» in F24 lo dice **l'utente**, spuntando
 *   una casella;
 * - i **commenti nel codice** sono in prima persona in tutto il repository:
 *   sono note a chi mantiene, non scritte di prodotto.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TOOLS = ['financial-statement', 'financial-analysis', 'lipe', 'tfa-client-file', 'f24', 'confronto-regimi'];

/* Le formule che tradiscono un assistente che parla. Non la prima persona in
   sé: «Ho creato Tax Automation Lab» è la firma dell'autore. */
const VOCE_DA_ASSISTENTE = [
  ['non ho trovato / non ho potuto', /\bnon ho (trovato|potuto|individuato|rilevato)\b/gi],
  ['ho analizzato / ho elaborato', /\bho (analizzato|elaborato|generato|verificato|esaminato|preparato)\b/gi],
  ['posso aiutarti', /\bposso (aiutart|esserti|fornirt|suggerirt)/gi],
  ['mi dispiace', /\bmi dispiace\b/gi],
  ['non sono in grado', /\bnon sono (in grado|riuscito)\b/gi],
  ['ti consiglio / ti suggerisco', /\bti (consiglio|suggerisco|propongo)\b/gi],
  ['sono un assistente', /\bsono un[ao]? (assistente|intelligenza|modello)\b/gi],
  ['spero / ecco a te', /\b(spero che|ecco a te|ecco qui|assolutamente,)\b/gi],
];

/* Via commenti, stile e commenti dentro gli script: restano le scritte. */
function soloScritte(html) {
  return html
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/\/\*[\s\S]*?\*\//g, ' ');
}

for (const dir of TOOLS) {
  test(`${dir}: nessuna frase da assistente`, () => {
    const testo = soloScritte(fs.readFileSync(path.join(root, 'tools', dir, 'index.html'), 'utf8'));
    const male = [];
    for (const [nome, re] of VOCE_DA_ASSISTENTE) {
      for (const m of testo.matchAll(re)) {
        male.push(`  [${nome}] …${testo.slice(Math.max(0, m.index - 60), m.index + 80).replace(/\s+/g, ' ')}…`);
      }
    }
    assert.equal(male.length, 0,
      `${dir}: ${male.length} frasi che suonano come un assistente che parla:\n${male.join('\n')}\n` +
      `  Riscrivere in forma impersonale: cambia la voce, non il contenuto.`);
  });
}

test('le pagine editoriali non parlano come un assistente', () => {
  const pagine = [];
  (function cammina(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (['.git', 'node_modules', 'tests', 'tools', 'resources'].includes(e.name)) continue;
      const p = path.join(d, e.name);
      if (e.isDirectory()) cammina(p);
      else if (e.name.endsWith('.html')) pagine.push(p);
    }
  })(root);

  const male = [];
  for (const p of pagine) {
    const rel = p.slice(root.length + 1).split(path.sep).join('/');
    /* Le pagine dei prompt parlano a un'AI: è il loro mestiere. */
    if (/configura-con-ai|configure-with-ai|configura-con-ia/i.test(rel)) continue;
    const testo = soloScritte(fs.readFileSync(p, 'utf8'));
    for (const [nome, re] of VOCE_DA_ASSISTENTE) {
      for (const m of testo.matchAll(re)) {
        male.push(`  ${rel} [${nome}] …${testo.slice(Math.max(0, m.index - 50), m.index + 70).replace(/\s+/g, ' ')}…`);
      }
    }
  }
  assert.equal(male.length, 0, `${male.length} frasi da assistente nelle pagine:\n${male.slice(0, 12).join('\n')}`);
});
