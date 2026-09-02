/* Tax Automation Lab — un titolo per pagina
   Copyright (c) 2026 Riccardo Zedda — Tax Automation Lab. All rights reserved.

   Perché esiste. L'audit del 23 agosto 2026 ha trovato che su quattordici
   pagine editoriali il titolo mostrato dal browser era diverso da quello del
   tag: un blocco di traduzione eseguiva `document.title = seo[lang].title` con
   un dizionario mai aggiornato. Due articoli diversi si presentavano con lo
   stesso titolo, e in inglese si leggeva «the Italian Italian statutory
   framework». Google esegue il JavaScript, quindi indicizzava quelli.

   Le pagine dichiarano il titolo in un massimo di quattro punti: il tag,
   `og:title`, `twitter:title` e — dove c'è — il dizionario che lo riscrive.
   Devono dire tutti la stessa cosa. Il tag è la fonte: è quello che vede chi
   non esegue il JavaScript, ed è quello che i quattro punti condividevano già
   prima che i dizionari restassero indietro.

   Come si esegue:  node --test tests/
*/
import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import { trackedFiles } from './tracked-files.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');

function pagine(dir = root) {
  return trackedFiles(dir, { exclude: ['tests'], pattern: /\.html$/, absolute: false });
}

function decodifica(s) {
  return s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, '\u00a0');
}

function meta(html, attributo, valore) {
  for (const tag of html.match(/<meta\b[^>]*>/gi) || []) {
    if (!new RegExp(attributo + '\\s*=\\s*["\']' + valore + '["\']', 'i').test(tag)) continue;
    const m = tag.match(/content\s*=\s*"([^"]*)"/i);
    if (m) return decodifica(m[1]);
  }
  return null;
}

const PAGINE = pagine().filter(p => {
  const html = fs.readFileSync(path.join(root, p), 'utf8');
  return !/http-equiv\s*=\s*["']refresh/i.test(html);   // le pagine di rimando non hanno testo proprio
});

test('titoli: og:title e twitter:title dicono quello che dice il tag', () => {
  const problemi = [];
  for (const p of PAGINE) {
    const html = fs.readFileSync(path.join(root, p), 'utf8');
    const tag = (html.match(/<title>([^<]*)<\/title>/) || [])[1];
    if (!tag) continue;
    const atteso = decodifica(tag);
    for (const [attributo, valore] of [['property', 'og:title'], ['name', 'twitter:title']]) {
      const trovato = meta(html, attributo, valore);
      if (trovato !== null && trovato !== atteso) {
        problemi.push(`  ${p}\n     ${valore}: «${trovato}»\n     <title>:    «${atteso}»`);
      }
    }
  }
  assert.equal(problemi.length, 0,
    `${problemi.length} titoli social diversi dal tag:\n${problemi.join('\n')}`);
});

test('titoli: il dizionario non riscrive il titolo con un valore diverso', () => {
  const problemi = [];
  for (const p of PAGINE) {
    const html = fs.readFileSync(path.join(root, p), 'utf8');
    if (!/document\.title\s*=\s*seo\[\s*lang\s*\]\.title/.test(html)) continue;
    const tag = decodifica((html.match(/<title>([^<]*)<\/title>/) || [])[1] || '');
    const lingua = (html.match(/setLang\('([a-z]{2})'/) || [])[1];
    if (!lingua) { problemi.push(`  ${p}: riscrive il titolo ma non si capisce con quale lingua`); continue; }
    const voce = html.match(new RegExp('"' + lingua + '":\\{"title":"([^"]*)"'));
    if (!voce) { problemi.push(`  ${p}: manca la voce «${lingua}» nel dizionario`); continue; }
    const scritto = JSON.parse('"' + voce[1] + '"');
    if (scritto !== tag) {
      problemi.push(`  ${p} [${lingua}]\n     dizionario: «${scritto}»\n     <title>:    «${tag}»`);
    }
  }
  assert.equal(problemi.length, 0,
    `${problemi.length} pagine riscrivono il titolo con un valore diverso dal tag:\n${problemi.join('\n')}`);
});
