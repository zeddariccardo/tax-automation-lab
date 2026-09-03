import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const TESTS_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(TESTS_DIR, '..');

// Elenco intenzionale: la guardia sotto fallisce se una nuova suite dipende
// (anche transitivamente) da Playwright ma non viene assegnata al job browser.
const BROWSER_TESTS = new Set([
  'confronto-regimi-import.test.mjs',
  'f24-import-pdf.test.mjs',
  'financial-analysis-import.test.mjs',
  'financial-statement-characterization.test.mjs',
  'financial-statement-golden.test.mjs',
  'financial-statement-import.test.mjs',
  'financial-statement-ui-polish.test.mjs',
  'lipe-import-safety.test.mjs',
]);

const IMPORT_PATTERNS = [
  /\b(?:import|export)\s+(?:[^'";]*?\s+from\s*)?['"]([^'"]+)['"]/g,
  /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
];

function testFiles() {
  const found = [];
  const visit = directory => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(absolute);
      else if (entry.isFile() && entry.name.endsWith('.test.mjs')) {
        found.push(path.relative(TESTS_DIR, absolute).split(path.sep).join('/'));
      }
    }
  };
  visit(TESTS_DIR);
  return found.sort();
}

function importedSpecifiers(source) {
  const found = new Set();
  for (const pattern of IMPORT_PATTERNS) {
    pattern.lastIndex = 0;
    for (let match; (match = pattern.exec(source));) found.add(match[1]);
  }
  return [...found];
}

function resolveLocalImport(importer, specifier) {
  if (!specifier.startsWith('.')) return null;
  const clean = specifier.split(/[?#]/, 1)[0];
  const base = path.resolve(path.dirname(importer), clean);
  const candidates = [
    base,
    `${base}.mjs`,
    `${base}.js`,
    `${base}.cjs`,
    path.join(base, 'index.mjs'),
    path.join(base, 'index.js'),
  ];
  const resolved = candidates.find(candidate => existsSync(candidate) && statSync(candidate).isFile());
  if (!resolved) throw new Error(`Import locale non risolto: ${specifier} da ${path.relative(ROOT, importer)}`);
  return resolved;
}

function importsPlaywright(entryFile, visited = new Set()) {
  const absolute = path.resolve(entryFile);
  if (visited.has(absolute)) return false;
  visited.add(absolute);

  const source = readFileSync(absolute, 'utf8');
  for (const specifier of importedSpecifiers(source)) {
    if (specifier === 'playwright' || specifier.startsWith('playwright/')) return true;
    const local = resolveLocalImport(absolute, specifier);
    if (local && importsPlaywright(local, visited)) return true;
  }
  return false;
}

function inventory() {
  const all = testFiles();
  const unknownBrowserEntries = [...BROWSER_TESTS].filter(name => !all.includes(name));
  if (unknownBrowserEntries.length) {
    throw new Error(`Suite browser dichiarate ma inesistenti: ${unknownBrowserEntries.join(', ')}`);
  }

  const detectedBrowser = all.filter(name => importsPlaywright(path.join(TESTS_DIR, name)));
  const missingFromBrowser = detectedBrowser.filter(name => !BROWSER_TESTS.has(name));
  const browserWithoutDependency = [...BROWSER_TESTS].filter(name => !detectedBrowser.includes(name));
  if (missingFromBrowser.length || browserWithoutDependency.length) {
    const details = [
      missingFromBrowser.length && `dipendono da Playwright ma non sono nel gruppo browser: ${missingFromBrowser.join(', ')}`,
      browserWithoutDependency.length && `sono nel gruppo browser ma non dipendono da Playwright: ${browserWithoutDependency.join(', ')}`,
    ].filter(Boolean).join('\n');
    throw new Error(`Classificazione test non coerente:\n${details}`);
  }

  const browser = all.filter(name => BROWSER_TESTS.has(name));
  const staticTests = all.filter(name => !BROWSER_TESTS.has(name));
  if (staticTests.length + browser.length !== all.length) {
    throw new Error('L\'inventario non copre tutti i file *.test.mjs');
  }
  return { all, static: staticTests, browser };
}

function printInventory(groups) {
  console.log(`Test statici (${groups.static.length} file):`);
  groups.static.forEach(name => console.log(`  tests/${name}`));
  console.log(`Test browser (${groups.browser.length} file):`);
  groups.browser.forEach(name => console.log(`  tests/${name}`));
  console.log(`Totale inventario: ${groups.all.length} file`);
}

function runTests(files) {
  const args = ['--test', ...files.map(name => path.join('tests', name))];
  const result = spawnSync(process.execPath, args, { cwd: ROOT, stdio: 'inherit' });
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
}

const command = process.argv[2] || 'list';
const groups = inventory();

if (command === 'list' || command === 'check') {
  printInventory(groups);
} else if (command === 'static' || command === 'browser') {
  printInventory(groups);
  runTests(groups[command]);
} else {
  console.error('Uso: node tests/run-test-group.mjs [list|check|static|browser]');
  process.exitCode = 2;
}
