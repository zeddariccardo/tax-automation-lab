import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const configPath = path.join(root, '_config.yml');

const INTERNAL_ROOT_FILES = [
  'AGENTS.md',
  'AUDIT-2026-08-23.md',
  'CONTESTO.md',
  'REPOSITORY-PRIVACY-OPTIONS.md',
  'assets/tal-design.README.md',
  'HANDOFF_CODEX_TO_CLAUDE_2026-08-21.md',
  'package.json',
];

const REQUIRED_PUBLIC_FILES = [
  '.well-known/security.txt',
  '404.html',
  'CNAME',
  'index.html',
  'en/index.html',
  'es/index.html',
  'robots.txt',
  'sitemap.xml',
  'site.webmanifest',
  'legal-docs/PROPRIETARY-NOTICE.txt',
  'legal-docs/APACHE-2.0.txt',
  'legal-docs/OFL-1.1.txt',
  'legal-docs/MIT.txt',
  'legal-docs/THIRD-PARTY-NOTICES.txt',
  'legal-docs/SITE-CONTENT-NOTICE.txt',
  'assets/tal-app.css',
  'assets/tal-app.js',
  'assets/tal-design.css',
  'tools/financial-statement/index.html',
  'tools/financial-analysis/index.html',
  'tools/financial-analysis/authoritative-app.js',
  'tools/lipe/index.html',
  'tools/confronto-regimi/index.html',
  'tools/f24/index.html',
  'tools/tfa-client-file/index.html',
];

function listItems(yaml, key) {
  const lines = yaml.split(/\r?\n/);
  const start = lines.findIndex((line) => line.trim() === `${key}:`);
  assert.notEqual(start, -1, `manca ${key}: in _config.yml`);
  const items = [];
  for (let index = start + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (/^[A-Za-z0-9_-]+:\s*$/.test(line)) break;
    const match = line.match(/^\s+-\s+(.+?)\s*$/);
    if (match) items.push(match[1].replace(/^['"]|['"]$/g, ''));
  }
  return items;
}

function trackedFiles() {
  const output = execFileSync('git', ['ls-files', '-z'], {
    cwd: root,
    encoding: 'utf8',
  });
  const files = output.split('\0').filter(Boolean).map((file) => file.replace(/\\/g, '/'));
  // Prima del commit anche la configurazione deve partecipare alla simulazione.
  if (!files.includes('_config.yml')) files.push('_config.yml');
  // Include i nuovi avvisi del commit candidato senza modificare l'indice Git.
  // Il documento interno entra nella simulazione per provare l'esclusione
  // anche nel caso di una futura aggiunta accidentale al repository.
  for (const file of ['legal-docs/PROPRIETARY-NOTICE.txt', 'legal-docs/APACHE-2.0.txt',
    'legal-docs/OFL-1.1.txt', 'REPOSITORY-PRIVACY-OPTIONS.md']) {
    if (!files.includes(file)) files.push(file);
  }
  return files;
}

function isExcluded(file, excludes) {
  return excludes.some((entry) => file === entry || file.startsWith(`${entry}/`));
}

function isJekyllHidden(file, includes) {
  const segments = file.split('/');
  const explicitlyIncluded = includes.some((entry) => file === entry || file.startsWith(`${entry}/`));
  if (explicitlyIncluded) return false;
  return segments.some((segment) => /^[._#~]/.test(segment));
}

function materializeArtifact(files, excludes, includes) {
  const destination = fs.mkdtempSync(path.join(os.tmpdir(), 'tal-pages-artifact-'));
  for (const relative of files) {
    if (isExcluded(relative, excludes) || isJekyllHidden(relative, includes)) continue;
    const source = path.join(root, ...relative.split('/'));
    if (!fs.existsSync(source) || !fs.statSync(source).isFile()) continue;
    const target = path.join(destination, ...relative.split('/'));
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(source, target);
  }
  return destination;
}

test('l’artefatto GitHub Pages esclude i file interni e include security.txt', () => {
  const config = fs.readFileSync(configPath, 'utf8');
  const excludes = listItems(config, 'exclude');
  const includes = listItems(config, 'include');
  const tracked = trackedFiles();

  assert.deepStrictEqual(
    INTERNAL_ROOT_FILES.filter((file) => !excludes.includes(file)),
    [],
    'mancano file interni nell’allowlist di esclusione Jekyll',
  );
  assert.ok(excludes.includes('tests'), 'tests/ deve essere esclusa in modo esplicito');
  assert.ok(excludes.includes('output'), 'output/ deve essere esclusa in modo esplicito');
  assert.ok(includes.includes('.well-known'), '.well-known deve essere inclusa in modo esplicito');

  const artifact = materializeArtifact(tracked, excludes, includes);
  try {
    const forbidden = [
      ...INTERNAL_ROOT_FILES,
      ...tracked.filter((file) => file.startsWith('tests/')),
      '.github/workflows/ci.yml',
      '_config.yml',
    ];
    for (const relative of forbidden) {
      assert.equal(
        fs.existsSync(path.join(artifact, ...relative.split('/'))),
        false,
        `${relative} non deve risultare nell’artefatto pubblico`,
      );
    }

    for (const relative of REQUIRED_PUBLIC_FILES) {
      assert.ok(
        fs.existsSync(path.join(artifact, ...relative.split('/'))),
        `${relative} deve risultare nell’artefatto pubblico`,
      );
    }

    const sourceSecurity = fs.readFileSync(path.join(root, '.well-known', 'security.txt'));
    const artifactSecurity = fs.readFileSync(path.join(artifact, '.well-known', 'security.txt'));
    assert.deepStrictEqual(artifactSecurity, sourceSecurity, 'security.txt deve essere pubblicato senza modifiche');
  } finally {
    fs.rmSync(artifact, { recursive: true, force: true });
  }
});
