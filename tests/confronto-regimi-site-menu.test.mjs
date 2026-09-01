import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = fs.readFileSync(path.join(root, 'tools', 'confronto-regimi', 'index.html'), 'utf8');

test('Confronto regimi: il comando del menu del sito conserva il contratto accessibile', () => {
  assert.match(html, /<button(?=[^>]*class="tal-gh-menu-toggle")(?=[^>]*data-action="toggle-site-nav")(?=[^>]*aria-expanded="false")[^>]*>/);
  assert.match(html, /aria-controls="talGhNav"/);
  assert.equal((html.match(/function impostaMenuSito\s*\(/g) || []).length, 1);
});

test('Confronto regimi: click e link della navigazione usano un solo controller', () => {
  assert.match(html, /siteToggle\.addEventListener\('click',[\s\S]{0,220}impostaMenuSito\(/);
  assert.match(html, /siteNav\.querySelectorAll\('a,button'\)[\s\S]{0,260}impostaMenuSito\(false, false\)/);
  assert.match(html, /classList\.toggle\('tal-menu-open', aperto\)/);
  assert.match(html, /setAttribute\('aria-expanded', String\(aperto\)\)/);
  assert.match(html, /setAttribute\('aria-label', aperto \? 'Chiudi il menu' : 'Apri il menu'\)/);
});

test('Confronto regimi: Escape chiude e restituisce il focus, il desktop non resta aperto', () => {
  assert.match(html, /e\.key === 'Escape'[\s\S]{0,260}impostaMenuSito\(false, true\)/);
  assert.match(html, /if \(!aperto && restituisciFuoco\) siteToggle\.focus\(\)/);
  assert.match(html, /addEventListener\('resize',[\s\S]{0,260}max-width:760px[\s\S]{0,160}impostaMenuSito\(false, false\)/);
});
