/* Ogni prompt porta le dieci regole comuni, in tutte le lingue.
 *
 * In italiano ogni prompt di «Configura con AI» comincia con lo stesso blocco:
 * dieci regole che valgono prima e sopra le istruzioni specifiche — non
 * inventare, non correggere i codici, lasciare vuoto quello che è ambiguo,
 * citare le fonti, riconciliare i conteggi, non dichiarare completo un lavoro
 * con esiti bloccanti aperti.
 *
 * Il 25 agosto 2026 quel blocco mancava in **tutti e sei** i prompt tradotti,
 * tre inglesi e tre spagnoli: chi copiava il prompt inglese istruiva la propria
 * AI senza il divieto di inventare dati. Era la deriva che la pagina stessa
 * temeva — nel blocco del Fascicolo, in inglese, c'è scritto che tenere tre
 * copie tradotte vuol dire correggerne una e lasciare indietro le altre due.
 *
 * Questo test è il modo di tenerle allineate senza doversene ricordare.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const PAGINE = [
  ['configura-con-ai/index.html', 'REGOLE COMUNI A TUTTI I TEMPLATE DI TAX AUTOMATION LAB',
    ['Usa solo le evidenze contenute nei documenti allegati',
      'Non correggere e non completare gli identificativi',
      'Non dichiarare completo un lavoro che ha esiti bloccanti aperti']],
  ['en/configure-with-ai/index.html', 'COMMON RULES FOR ALL TAX AUTOMATION LAB TEMPLATES',
    ['Use only the evidence contained in the attached documents',
      'Do not correct and do not complete identifiers',
      'Do not declare a job complete while blocking findings are still open']],
  ['es/configura-con-ia/index.html', 'REGLAS COMUNES A TODAS LAS PLANTILLAS DE TAX AUTOMATION LAB',
    ['Utiliza solo la evidencia contenida en los documentos adjuntos',
      'No corrijas ni completes los identificadores',
      'No declares completo un trabajo con resultados bloqueantes abiertos']],
];

function prompt(html) {
  const out = {};
  for (const m of html.matchAll(/<pre id="([a-z0-9-]+)-prompt">([\s\S]*?)<\/pre>/g)) {
    out[m[1]] = m[2];
  }
  return out;
}

for (const [pagina, titolo, regole] of PAGINE) {
  test(`${pagina}: ogni prompt porta le regole comuni`, () => {
    const html = fs.readFileSync(path.join(root, pagina), 'utf8');
    const trovati = prompt(html);
    assert.ok(Object.keys(trovati).length > 0, `${pagina}: nessun prompt trovato`);
    const senza = Object.keys(trovati).filter((k) => !trovati[k].includes(titolo));
    assert.equal(senza.length, 0,
      `${pagina}: ${senza.length} prompt su ${Object.keys(trovati).length} senza le regole comuni: ${senza.join(', ')}\n` +
      `  Il blocco «${titolo}» va prima delle istruzioni specifiche di ogni prompt.`);

    /* Non basta il titolo: le regole che contano devono esserci per intero. */
    for (const [id, testo] of Object.entries(trovati)) {
      for (const regola of regole) {
        assert.ok(testo.includes(regola),
          `${pagina}, prompt ${id}: manca la regola «${regola.slice(0, 60)}…»`);
      }
    }
  });
}

test('le tre lingue hanno gli stessi prompt', () => {
  /* Fino al 25 agosto 2026 inglese e spagnolo ne avevano tre invece di sei: per
     i tool piu' recenti il blocco rimandava alla pagina italiana, per non tenere
     tre copie che divergono. Riccardo ha scelto di tradurre tutto, e allora la
     regola diventa questa: se un prompt esiste in italiano, esiste in tutte e
     tre le lingue. Un prompt aggiunto in una lingua sola fa fallire il test. */
  const quali = (p) => Object.keys(prompt(fs.readFileSync(path.join(root, p), 'utf8'))).sort();
  const it = quali('configura-con-ai/index.html');
  assert.equal(it.length, 6, `l’italiano ha ${it.length} prompt, non 6`);
  for (const [lingua, p] of [['inglese', 'en/configure-with-ai/index.html'],
    ['spagnolo', 'es/configura-con-ia/index.html']]) {
    const altri = quali(p);
    const mancanti = it.filter((k) => !altri.includes(k));
    const inPiu = altri.filter((k) => !it.includes(k));
    assert.equal(mancanti.length + inPiu.length, 0,
      `${lingua}: ${mancanti.length ? 'mancano ' + mancanti.join(', ') : ''}` +
      `${inPiu.length ? ' in piu’ ' + inPiu.join(', ') : ''}`);
  }
});
