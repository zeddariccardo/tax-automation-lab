/* Forfettario Pro — ponte privacy-minimal verso il motore TAL same-origin. */
(function (root) {
  'use strict';
  const CALC_PATH = '/api/forfettario/calcola';
  const CONFIG_PATH = '/api/forfettario/config';
  const ATECO_PATH = '/api/forfettario/ateco/risolvi';
  const UNAVAILABLE = 'Il servizio di calcolo non è temporaneamente disponibile. I tuoi dati locali non sono stati persi.';
  let configValue = null, configPromise = null, current = null, sequence = 0, active = null;
  const listeners = new Set();

  function canonical(value) {
    if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
    if (value && typeof value === 'object') return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonical(value[key])).join(',') + '}';
    return JSON.stringify(value);
  }
  async function sha256(value) {
    const bytes = new TextEncoder().encode(value), digest = await crypto.subtle.digest('SHA-256', bytes);
    return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
  }
  function notify() { listeners.forEach(listener => { try { listener(snapshot()); } catch (_) {} }); }
  function subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); }
  function invalidate() {
    sequence += 1;
    if (active) active.abort();
    active = null; current = null; notify();
  }
  function validEnvelope(value, needsResult = true) {
    return !!value && typeof value === 'object' && ['calculated', 'warning', 'blocked'].includes(value.status) &&
      typeof value.engineVersion === 'string' && Array.isArray(value.diagnostics) && (!needsResult || 'result' in value);
  }
  async function read(path, options) {
    const response = await root.TAL_API.request(path, options);
    if (!response.ok || !/application\/json/i.test(response.headers.get('content-type') || '')) throw new Error(UNAVAILABLE);
    const value = await response.json();
    if (!validEnvelope(value)) throw new Error(UNAVAILABLE);
    return value;
  }
  async function loadConfig(force = false) {
    if (configValue && !force) return configValue;
    if (configPromise && !force) return configPromise;
    configPromise = read(CONFIG_PATH, { method: 'GET' }).then(value => {
      if (!value.result || !Array.isArray(value.result.supportedYears) || !Array.isArray(value.result.pensionManagements)) throw new Error(UNAVAILABLE);
      configValue = value; return value;
    }).finally(() => { configPromise = null; });
    return configPromise;
  }
  async function resolveAteco(input) {
    return read(ATECO_PATH, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
  }
  function snapshot(payload) {
    if (!current) return { status: 'idle', result: null, diagnostics: [], fingerprint: null, engineVersion: null };
    if (payload && current.canonical !== canonical(payload)) return { status: 'stale', result: null, diagnostics: [], fingerprint: null, engineVersion: null };
    return { ...current, canonical: undefined };
  }
  function schedule(payload) {
    const text = canonical(payload);
    if (current && current.canonical === text && ['loading', 'calculated', 'warning', 'blocked'].includes(current.status)) return current.promise || Promise.resolve(snapshot(payload));
    const requestSequence = ++sequence;
    if (active) active.abort();
    active = new AbortController();
    current = { status: 'loading', result: null, diagnostics: [], fingerprint: null, engineVersion: null, canonical: text, promise: null };
    notify();
    const promise = (async () => {
      try {
        const fingerprint = await sha256(text);
        if (requestSequence !== sequence || !current || current.canonical !== text) return null;
        const envelope = await read(CALC_PATH, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: text, signal: active.signal });
        if (requestSequence !== sequence || !current || current.canonical !== text) return null;
        current = { ...envelope, fingerprint, canonical: text, promise: null };
      } catch (error) {
        if (requestSequence !== sequence) return null;
        current = { status: 'error', result: null, diagnostics: [{ code: 'SERVICE_UNAVAILABLE', field: null, message: UNAVAILABLE }],
          fingerprint: await sha256(text), engineVersion: null, canonical: text, promise: null };
      } finally {
        if (requestSequence === sequence) active = null;
        notify();
      }
      return snapshot(payload);
    })();
    current.promise = promise;
    return promise;
  }
  function retry(payload) { root.TAL_API.invalidate(); current = null; return schedule(payload); }
  function diagnostics() { return { calculationPath: CALC_PATH, configPath: CONFIG_PATH, atecoPath: ATECO_PATH,
    status: current && current.status || 'idle', fingerprint: current && current.fingerprint || null, sequence,
    hasResult: !!(current && current.result), configLoaded: !!configValue }; }

  root.ForfettarioAuthoritative = Object.freeze({ canonical, diagnostics, invalidate, loadConfig, resolveAteco,
    retry, schedule, snapshot, subscribe, unavailableMessage: UNAVAILABLE, config: () => configValue });
})(globalThis);
