// Only Auth and identity discovery. No operational TAL data or privileged credentials.
export function validateConfig(value) {
  try {
    const url = new URL(value.supabaseUrl);
    if (!/^https:\/\/[a-z]{20}\.supabase\.co$/.test(url.origin) || url.username || url.password || url.port || !['', '/'].includes(url.pathname) || url.search || url.hash) return null;
    if (!/^sb_publishable_[A-Za-z0-9_-]{20,}$/.test(value.publishableKey)) return null;
    return { supabaseUrl: url.origin, publishableKey: value.publishableKey };
  } catch { return null; }
}
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const messages = {
  signup: 'Non è stato possibile completare la registrazione. Se hai già un account, accedi; altrimenti riprova tra poco.',
  credentials: 'Email o password non corrette.',
  expired: 'La sessione è terminata. Accedi di nuovo.',
  unavailable: 'Non riusciamo a verificare il tuo accesso. Riprova tra poco.',
  limited: 'Troppi tentativi. Attendi qualche minuto e riprova.',
  storage: 'Consenti il salvataggio locale della sessione per accedere.',
  configuration: 'Configurazione di sviluppo assente. Avvia la preview con serve-dev.mjs dopo aver configurato config.local.js.',
};
const problem = code => Object.assign(new Error(code), { code });
const same = (a, b) => !!a && !!b && a.context_type === b.context_type && a.context_id === b.context_id;

export function createAuthContextService({ config: input, fetchImpl, storage, preferenceStorage, lock, now = Date.now }) {
  const config = validateConfig(input);
  const sessionKey = 'tal-s07-session:' + (config?.supabaseUrl || 'missing');
  const contextKey = sessionKey + ':choice';
  const listeners = new Set();
  let epoch = 0, checking = null;
  let state = { phase: config ? 'loading' : 'config-error', user: null, contexts: [], selected: null, message: config ? '' : messages.configuration };
  const snapshot = () => structuredClone(state);
  const emit = next => { state = next; for (const listener of listeners) listener(snapshot()); };
  const blank = (phase, message = '') => ({ phase, user: null, contexts: [], selected: null, message });
  const assertCurrent = version => { if (version !== epoch) throw problem('stale'); };
  function saved() {
    try {
      const s = JSON.parse(storage.getItem(sessionKey) || 'null');
      if (!s) return null;
      if (typeof s.access_token !== 'string' || !/^[\w-]+\.[\w-]+\.[\w-]+$/.test(s.access_token) || typeof s.refresh_token !== 'string' || !s.refresh_token || !Number.isFinite(s.expires_at) || !uuid.test(s.userId)) throw problem('expired');
      return s;
    } catch (error) { throw problem(error.code === 'expired' || error instanceof SyntaxError ? 'expired' : 'storage'); }
  }
  function clear() {
    storage.removeItem(sessionKey);
    preferenceStorage.removeItem(contextKey);
  }
  function persist(data, expectedUser) {
    if (!data || typeof data.access_token !== 'string' || typeof data.refresh_token !== 'string' || !Number.isFinite(data.expires_in) || !uuid.test(data.user?.id) || (expectedUser && data.user.id !== expectedUser)) throw problem('expired');
    const s = { access_token: data.access_token, refresh_token: data.refresh_token, expires_at: now() + data.expires_in * 1000, userId: data.user.id };
    try { storage.setItem(sessionKey, JSON.stringify(s)); } catch { throw problem('storage'); }
    return s;
  }
  async function request(path, { token, body, method = 'POST', credentials = false } = {}) {
    let response;
    try {
      response = await fetchImpl(config.supabaseUrl + path, {
        method, credentials: 'omit', cache: 'no-store', redirect: 'error',
        headers: { apikey: config.publishableKey, ...(token ? { Authorization: 'Bearer ' + token } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
        ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(15000),
      });
    } catch { throw problem('unavailable'); }
    if (!response.ok) {
      await response.body?.cancel();
      if (path === '/auth/v1/signup' && response.status !== 429) throw problem('signup');
      throw problem(response.status === 429 ? 'limited' : credentials && [400,401,422].includes(response.status) ? 'credentials' : [400,401,403].includes(response.status) ? 'expired' : 'unavailable');
    }
    if (response.status === 204 || path.startsWith('/auth/v1/logout')) return null;
    try { return await response.json(); } catch { throw problem('unavailable'); }
  }
  async function session(version, rejectedToken = null) {
    return lock(sessionKey, async () => {
      assertCurrent(version);
      let s = saved();
      if (!s) throw problem('expired');
      if (s.expires_at - now() < 90000 || s.access_token === rejectedToken) {
        const data = await request('/auth/v1/token?grant_type=refresh_token', { body: { refresh_token: s.refresh_token } });
        assertCurrent(version);
        s = persist(data, s.userId);
      }
      return s;
    });
  }
  async function discover(version, desired = null, chooser = false) {
    let s = await session(version), user;
    try { user = await request('/auth/v1/user', { token: s.access_token, method: 'GET' }); }
    catch (error) {
      if (error.code !== 'expired') throw error;
      s = await session(version, s.access_token);
      user = await request('/auth/v1/user', { token: s.access_token, method: 'GET' });
    }
    assertCurrent(version);
    if (user.id !== s.userId) throw problem('expired');
    const rows = await request('/rest/v1/rpc/tal_list_my_contexts', { token: s.access_token, body: {} });
    assertCurrent(version);
    if (!Array.isArray(rows) || rows.some(r => !['personal','studio'].includes(r.context_type) || !uuid.test(r.context_id) || typeof r.label !== 'string' || r.label.length > 300)) throw problem('unavailable');
    const contexts = rows.map(({context_type, context_id, label}) => ({context_type, context_id, label}));
    if (new Set(contexts.map(r => r.context_type + ':' + r.context_id)).size !== contexts.length) throw problem('unavailable');
    let preferred = desired || state.selected;
    if (!preferred && !chooser) {
      try { const cached = JSON.parse(preferenceStorage.getItem(contextKey)); if (cached?.userId === user.id) preferred = cached; } catch { /* untrusted preference */ }
    }
    // A saved choice is only a preference; it is never an authorization source.
    const selected = chooser ? null : contexts.find(c => same(c, preferred)) || (contexts.length === 1 && !desired ? contexts[0] : null);
    try {
      if (selected) preferenceStorage.setItem(contextKey, JSON.stringify({ userId: user.id, ...selected }));
      else preferenceStorage.removeItem(contextKey);
    } catch { throw problem('storage'); }
    emit({ phase: selected ? 'ready' : contexts.length ? 'choosing' : 'empty', user: { id: user.id, email: user.email || '' }, contexts, selected, message: '' });
  }
  async function failed(error, version) {
    if (version !== epoch || error.code === 'stale') return;
    if (['expired','credentials','signup'].includes(error.code)) {
      await lock(sessionKey, () => { if (version === epoch) clear(); });
      if (version !== epoch) return;
      emit(blank('signed-out', messages[error.code]));
    } else emit(blank('error', messages[error.code] || messages.unavailable));
  }
  async function run(work, { loading = true } = {}) {
    if (!config) return;
    const version = ++epoch;
    if (loading) emit(blank('loading'));
    try { await work(version); } catch (error) { await failed(error, version); }
  }
  const api = {
    sessionKey, contextKey,
    getState: snapshot,
    // Bootstrap has no selected workspace yet. The caller receives only the current identity session.
    async withIdentitySession(work) {
      if (!['ready','choosing','empty'].includes(state.phase) || !state.user) throw problem('forbidden');
      const version = epoch, userId = state.user.id;
      try {
      const s = await session(version);
      const result = await work({config, token:s.access_token});
      assertCurrent(version);
      if (state.user?.id !== userId) throw problem('stale');
      return result;
      } catch (error) {
        if (error.code === 'expired') await failed(error,version);
        throw error;
      }
    },
    signup(email, password) {
      return run(async version => {
        if (typeof password !== 'string' || password.length < 12) throw problem('credentials');
        await lock(sessionKey, async () => {
          assertCurrent(version); clear();
          const data = await request('/auth/v1/signup', {body:{email:email.trim(),password}});
          assertCurrent(version);
          // Confirmation is a product requirement. Never accept a signup session as a bypass.
          if (data?.access_token) throw problem('unavailable');
        });
        emit(blank('check-email', 'Controlla la tua email e conferma l’indirizzo. Poi torna qui e accedi.'));
      });
    },
    // Internal service port: reuse session rotation; never put credentials in UI state.
    async withContextSession(work) {
      if (state.phase !== 'ready' || !state.selected) throw problem('forbidden');
      const version = epoch, selected = { ...state.selected }, userId = state.user.id;
      const current = () => state.phase === 'ready' && state.user.id === userId && same(state.selected, selected);
      try {
        const s = await session(version);
        if (!current()) throw problem('stale');
        const result = await work({ config, token: s.access_token, context: selected });
        if (!current() || version !== epoch) throw problem('stale');
        return result;
      } catch (error) {
        if (error.code === 'expired') await failed(error, version);
        throw error;
      }
    },
    subscribe(listener) { listeners.add(listener); listener(snapshot()); return () => listeners.delete(listener); },
    restore() { return run(async version => { if (!saved()) { emit(blank('signed-out')); return; } await discover(version); }); },
    login(email, password) {
      return run(async version => {
        await lock(sessionKey, async () => {
          assertCurrent(version); clear();
          const data = await request('/auth/v1/token?grant_type=password', { body: { email: email.trim(), password }, credentials: true });
          assertCurrent(version); persist(data);
        });
        assertCurrent(version);
        await discover(version);
      });
    },
    revalidate() {
      if (checking) return checking;
      if (!['ready','choosing','empty'].includes(state.phase)) return Promise.resolve();
      // No repaint while a background check is in flight; a denial clears everything.
      checking = run(version => discover(version), { loading: false }).finally(() => { checking = null; });
      return checking;
    },
    choose(candidate) { return run(version => discover(version, { context_type: candidate?.context_type, context_id: candidate?.context_id })); },
    chooseAgain() { if (state.contexts.length > 1) return run(version => discover(version, null, true)); },
    logout() {
      return run(async version => {
        let remoteClosed = true;
        await lock(sessionKey, async () => {
          assertCurrent(version);
          let s; try { s = saved(); } catch { /* also clear a malformed session */ }
          clear();
          if (s) try { await request('/auth/v1/logout?scope=local', { token: s.access_token }); } catch { remoteClosed = false; }
        });
        assertCurrent(version);
        emit(blank('signed-out', remoteClosed ? '' : 'Sei uscito da questo browser. Non abbiamo potuto confermare la chiusura della sessione sul server.'));
      });
    },
  };
  return api;
}
