/* Tax Automation Lab — inventario sicuro per le verifiche locali.
   Copyright (c) 2026 Riccardo Zedda — Tax Automation Lab. All rights reserved.
   Non attraversa il filesystem: legge soltanto l'elenco Git dei file tracciati.
*/
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const cache = new Map();
const forbidden = new Set(['.git', '.21st', '.claude', 'node_modules', 'output']);

export function trackedFiles(root, { exclude = [], pattern = /.*/, absolute = true } = {}) {
  const base = path.resolve(root);
  if (!cache.has(base)) {
    const output = execFileSync('git', ['--no-optional-locks', 'ls-files', '-z'], {
      cwd: base, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024
    });
    const files = output.split('\0').filter(Boolean);
    if (!files.length) throw new Error('Inventario Git vuoto: verifica interrotta.');
    cache.set(base, files);
  }
  return cache.get(base).filter(file => {
    const segments = file.split('/');
    if (segments.some(segment => forbidden.has(segment.toLowerCase()) ||
        /^\.codex-tmp(?:-|$)|^back[ -]?ups?(?:[ ._-]|$)/i.test(segment))) return false;
    if (segments.slice(0, -1).some(segment => exclude.includes(segment))) return false;
    pattern.lastIndex = 0;
    return pattern.test(file);
  }).map(file => absolute ? path.join(base, ...file.split('/')) : file);
}
