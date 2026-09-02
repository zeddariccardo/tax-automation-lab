import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const homes = [
  {
    file: 'index.html',
    collaborator: 'Nome collaboratore',
    areas: 'ERP e gestionali (Profis, NetSuite)',
    applyPrefix: 'Condividi un feedback, proponi un caso d’uso',
    required: [
      'File e dati identificativi restano nel browser.',
      'dati tecnici o numerici necessari al calcolo',
      'senza persistenza',
    ],
  },
  {
    file: 'en/index.html',
    collaborator: 'Collaborator name',
    areas: 'ERP systems (Profis, NetSuite)',
    applyPrefix: 'Share feedback, propose a use case',
    required: [
      'Files and identifying data remain in the browser.',
      'technical or numerical data required for calculation',
      'without persistence',
    ],
  },
  {
    file: 'es/index.html',
    collaborator: 'Nombre del colaborador',
    areas: 'ERP y sistemas de gestión (Profis, NetSuite)',
    applyPrefix: 'Comparte tus comentarios, propón un caso de uso',
    required: [
      'Los archivos y los datos identificativos permanecen en el navegador.',
      'datos técnicos o numéricos necesarios para el cálculo',
      'sin persistencia',
    ],
  },
];

test('le tre home non contengono più claim di elaborazione interamente locale', () => {
  const obsolete = [
    /elaborazione locale(?: nel browser)?/i,
    /local (?:browser )?processing|local processing in the browser/i,
    /procesamiento local(?: en el navegador)?/i,
  ];
  for (const home of homes) {
    const html = fs.readFileSync(path.join(root, home.file), 'utf8');
    for (const pattern of obsolete) {
      assert.doesNotMatch(html, pattern, `${home.file}: claim locale obsoleto`);
    }
    for (const text of home.required) {
      assert.ok(html.includes(text), `${home.file}: manca la sostanza approvata: ${text}`);
    }
  }
});

test('le tre home ripristinano la card collaborazioni future e rimuovono la card contatti', () => {
  for (const home of homes) {
    const html = fs.readFileSync(path.join(root, home.file), 'utf8');
    assert.ok(html.includes('class="collab-preview surface"'), `${home.file}: card collaborazioni future assente`);
    assert.ok(html.includes('class="collab-blur"'), `${home.file}: effetto blur assente`);
    assert.equal((html.match(/class="collab-profile"/g) || []).length, 2, `${home.file}: profili futuri inattesi`);
    assert.ok(html.includes(home.collaborator), `${home.file}: testo collaboratore localizzato assente`);
    assert.match(html, /<div class="collab-overlay"><strong>SOON<\/strong><\/div>/, `${home.file}: badge SOON assente`);
    assert.ok(html.includes(home.areas), `${home.file}: ambiti ERP non aggiornati`);
    assert.ok(html.includes(home.applyPrefix), `${home.file}: invito al feedback non aggiornato`);
    assert.doesNotMatch(html, /<div class="contact surface">/, `${home.file}: card contatti ancora presente`);
  }
});

test('le sezioni pagina raggiunte via hash non ricevono il contorno dei controlli interattivi', () => {
  const css = fs.readFileSync(path.join(root, 'assets/tal-design.css'), 'utf8');
  assert.match(css, /\[tabindex\]:not\(\.page\):focus-visible/);
  assert.match(css, /\.page\[tabindex\]:focus-visible\s*\{\s*outline:none\s*!important\s*\}/);
});
