import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const homes = [
  {
    file: 'index.html',
    required: [
      'File e dati identificativi restano nel browser.',
      'dati tecnici o numerici necessari al calcolo',
      'senza persistenza',
    ],
  },
  {
    file: 'en/index.html',
    required: [
      'Files and identifying data remain in the browser.',
      'technical or numerical data required for calculation',
      'without persistence',
    ],
  },
  {
    file: 'es/index.html',
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

test('i placeholder collaboratori e i loro badge sono rimossi senza sostituzioni', () => {
  const forbidden = [
    /Nome collaboratore/i,
    /Collaborator name/i,
    /Nombre del colaborador/i,
    /class="collab-preview/i,
    /class="collab-profile/i,
    /class="collab-overlay/i,
    /<strong>\s*(?:PRESTO|SOON|PRÓXIMAMENTE)\s*<\/strong>/i,
  ];
  for (const home of homes) {
    const html = fs.readFileSync(path.join(root, home.file), 'utf8');
    for (const pattern of forbidden) {
      assert.doesNotMatch(html, pattern, `${home.file}: placeholder collaboratore residuo`);
    }
  }
});
