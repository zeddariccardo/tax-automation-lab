import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const filename = new URL('../tools/financial-statement/index.html', import.meta.url);
const html = await readFile(filename, 'utf8');
const expression = /<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi;
const failures = [];
let match;
let index = 0;
while ((match = expression.exec(html))) {
  index += 1;
  if (!match[1].trim()) continue;
  const openingTag = match[0].slice(0, match[0].indexOf('>') + 1);
  if (/type="application\/ld\+json"/i.test(openingTag)) continue;
  try {
    new vm.Script(match[1], { filename: `financial-statement-inline-${index}.js` });
  } catch (error) {
    failures.push({
      index,
      startLine: html.slice(0, match.index).split(/\r?\n/).length,
      id: (match[0].match(/id="([^"]+)/) || [])[1] || '',
      error: error.message,
      stack: String(error.stack || '').split('\n').slice(0, 4).join('\n'),
    });
  }
}
if (failures.length) {
  console.error(JSON.stringify(failures, null, 2));
  process.exitCode = 1;
} else {
  console.log(JSON.stringify({ inlineScripts: index, syntax: 'ok' }));
}
