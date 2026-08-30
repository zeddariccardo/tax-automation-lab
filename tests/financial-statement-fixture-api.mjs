import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

const fixture = JSON.parse(await readFile(
  new URL('./golden/financial-statement-api-v1.json', import.meta.url),
  'utf8',
));

export async function financialStatementFixtureApi(request) {
  const body = await request.text();
  const key = createHash('sha256').update(body).digest('hex');
  const response = fixture.cases[key];
  if (!response) {
    return new Response(JSON.stringify({ error: 'fixture API non disponibile per il payload' }), {
      status: 422,
      headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
    });
  }
  return new Response(JSON.stringify(response), {
    status: 200,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });
}

export const financialStatementFixtureMeta = Object.freeze({
  version: fixture.version,
  schemaFingerprint: fixture.schemaFingerprint,
  responses: Object.keys(fixture.cases).length,
});
