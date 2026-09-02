/* Same-origin transport for the four authoritative tools. No calculation,
   payload transformation or access to client archives belongs in this module. */
(function () {
  'use strict';
  const calculationPath = /^\/api\/(?:confronto-regimi|lipe|financial-statement|financial-analysis)\/calcola$/;
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname.toLowerCase());
  const legacyKeys = ['tal-api-base', 'tal-api-modo', 'tal-lipe-api'];
  let base = '';
  for (const name of ['localStorage', 'sessionStorage']) {
    try {
      const storage = window[name];
      for (const key of legacyKeys) {
        const value = storage.getItem(key);
        if (value && /workers\.dev/i.test(value)) storage.removeItem(key);
      }
    } catch (_) { /* Storage may be disabled; same-origin still works. */ }
  }
  if (local) {
    try {
      const value = localStorage.getItem('tal-api-base');
      if (value) {
        const url = new URL(value);
        if (['http:', 'https:'].includes(url.protocol) &&
            ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) &&
            !url.username && !url.password && url.pathname === '/' && !url.search && !url.hash) base = url.origin;
      }
    } catch (_) { /* Invalid development overrides are ignored. */ }
  }
  let confirmed = false, pending = null;
  function invalidate() { confirmed = false; }
  function url(path) {
    if (path !== '/api/stato' && !calculationPath.test(path)) throw new Error('Percorso del servizio non valido.');
    return base + path;
  }
  async function ready() {
    if (confirmed) return true;
    if (pending) return pending;
    pending = (async () => {
      const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 8000);
      try {
        const response = await fetch(url('/api/stato'), { method: 'GET', cache: 'no-store',
          credentials: 'omit', referrerPolicy: 'no-referrer', redirect: 'error', signal: controller.signal });
        const json = response.ok && /application\/json/i.test(response.headers.get('content-type') || '')
          ? await response.json() : null;
        confirmed = json?.ok === true;
        return confirmed;
      } catch (_) { return false; }
      finally { clearTimeout(timer); pending = null; }
    })();
    return pending;
  }
  async function request(path, options) {
    if (!(await ready())) throw new Error('Il servizio di calcolo non risponde. Riprova fra un momento.');
    try {
      const response = await fetch(url(path), { ...options, cache: 'no-store', credentials: 'omit',
        referrerPolicy: 'no-referrer', redirect: 'error', signal: options.signal
          ? AbortSignal.any([options.signal, AbortSignal.timeout(8000)]) : AbortSignal.timeout(8000) });
      if (!response.ok) invalidate();
      return response;
    } catch (error) { invalidate(); throw error; }
  }
  window.TAL_API = Object.freeze({ ready, request, invalidate, url });
})();
