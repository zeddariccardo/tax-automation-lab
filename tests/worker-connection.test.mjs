import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../assets/tal-api-connection.js', import.meta.url), 'utf8');
const legacy = 'https://tal-api.tal-api.workers.dev';
function harness(hostname, values = {}, handler) {
  const memory = new Map(Object.entries(values)), session = new Map(Object.entries(values));
  const storage = map => ({ getItem: key => map.get(key) ?? null, removeItem: key => map.delete(key) });
  const calls = [], context = { location: { hostname }, URL, AbortController, AbortSignal, setTimeout, clearTimeout,
    localStorage: storage(memory), sessionStorage: storage(session),
    fetch: async (url, options) => {
      calls.push({url,options});
      return handler ? handler(url,options) : new Response('{"ok":true}', { headers: { 'content-type': 'application/json' } });
    }
  };
  context.window = context;
  vm.runInNewContext(source, context);
  return { api: context.TAL_API, memory, session, calls };
}
for (const hostname of ['taxautomationlab.com','www.taxautomationlab.com','preview.example','localhost.evil.test']) {
  for (const base of [legacy,'https://evil.test','//evil.test','http://localhost:8787']) {
    test(hostname + ' ignores ' + base, async () => {
      const h = harness(hostname, {'tal-api-base':base,'tal-api-modo':'locale','tal-lipe-api':'no','archive':legacy});
      await h.api.request('/api/lipe/calcola', {method:'POST',body:'{}'});
      assert.deepEqual(h.calls.map(x=>x.url), ['/api/stato','/api/lipe/calcola']);
      assert.equal(h.memory.get('archive'),legacy,'never scan/delete archive values');
      assert.equal(h.memory.get('tal-api-modo'),'locale','obsolete modes cannot disable the service');
      if(base===legacy){assert.equal(h.memory.has('tal-api-base'),false);assert.equal(h.session.has('tal-api-base'),false);}
    });
  }
}
test('loopback override only, no paths/credentials/query/protocol-relative bypass', () => {
  assert.equal(harness('localhost',{'tal-api-base':'http://127.0.0.1:8787'}).api.url('/api/stato'),'http://127.0.0.1:8787/api/stato');
  for (const base of ['http://evil.test','http://localhost@evil.test','http://user:pass@localhost','http://localhost/api','http://localhost?base=evil','//localhost:8787',legacy])
    assert.equal(harness('127.0.0.1',{'tal-api-base':base}).api.url('/api/stato'),'/api/stato');
});
test('probe memoization, single-flight and no-store without any payload', async () => {
  const h = harness('taxautomationlab.com');
  assert.deepEqual(await Promise.all([h.api.ready(),h.api.ready(),h.api.ready()]),[true,true,true]);
  assert.equal(h.calls.length,1); await h.api.ready(); assert.equal(h.calls.length,1);
  assert.equal(h.calls[0].options.body,undefined);
  assert.equal(h.calls[0].options.cache,'no-store');
  assert.equal(h.calls[0].options.redirect,'error');
});
test('absent/HTML/invalid probe forbids POST; negative probe is retryable', async () => {
  for(const response of [()=>new Response('not found',{status:404}),()=>new Response('<html>Pages</html>'),()=>new Response('{"ok":false}',{headers:{'content-type':'application/json'}})]) {
    let good=false;
    const h=harness('taxautomationlab.com',{},()=>good?new Response('{"ok":true}',{headers:{'content-type':'application/json'}}):response());
    await assert.rejects(h.api.request('/api/lipe/calcola',{method:'POST',body:'private numbers'}));
    assert.deepEqual(h.calls.map(x=>x.options.method),['GET']);
    good=true;await h.api.request('/api/lipe/calcola',{method:'POST',body:'{}'});
    assert.deepEqual(h.calls.map(x=>x.options.method),['GET','GET','POST']);
  }
});
test('arbitrary URLs cannot become payload destinations', () => {
  const h=harness('taxautomationlab.com');
  for(const path of ['https://evil.test/api/lipe/calcola','//evil.test','/api/other','/api/lipe/calcola?next=evil'])
    assert.throws(()=>h.api.url(path));
});
