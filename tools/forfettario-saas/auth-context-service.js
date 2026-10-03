// Only Auth and identity discovery. No operational TAL data or privileged credentials.
export function validateConfig(value) {
  try {
    const url = new URL(value.supabaseUrl);
    if (!/^https:\/\/[a-z]{20}\.supabase\.co$/.test(url.origin) || url.username || url.password || url.port || !['', '/'].includes(url.pathname) || url.search || url.hash) return null;
    if (!/^sb_publishable_[A-Za-z0-9_-]{20,}$/.test(value.publishableKey)) return null;
    return { supabaseUrl: url.origin, publishableKey: value.publishableKey, ...(value.studioMfa===true?{studioMfa:true}:{}) };
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
  configuration: 'Configurazione dell’ambiente non valida. Contatta il supporto.',
};
const problem = (code, transient = false) => Object.assign(new Error(code), { code, transient });
const same = (a, b) => !!a && !!b && a.context_type === b.context_type && a.context_id === b.context_id;

export function createAuthContextService({ config: input, fetchImpl, storage, preferenceStorage, lock, now = Date.now }) {
  const config = validateConfig(input);
  const sessionKey = 'tal-s07-session:' + (config?.supabaseUrl || 'missing');
  const contextKey = sessionKey + ':choice';
  const listeners = new Set();
  let epoch = 0, checking = null;
  let mfaPending=null, mfaBusy=false;
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
    mfaPending=null;
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
    } catch { throw problem('unavailable', true); }
    if (!response.ok) {
      await response.body?.cancel();
      if (path === '/auth/v1/signup' && response.status !== 429) throw problem('signup');
      if(path.includes('/factors/')&&[400,422].includes(response.status))throw problem('mfa-code');
      throw problem(response.status === 429 ? 'limited' : credentials && [400,401,422].includes(response.status) ? 'credentials' : [400,401,403].includes(response.status) ? 'expired' : 'unavailable', response.status === 429 || response.status >= 500);
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
  async function discover(version, desired = null, chooser = false, background = false) {
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
    if(config.studioMfa && selected?.context_type==='studio'){
      const security=await request('/rest/v1/rpc/tal_my_studio_security',{token:s.access_token,body:{}});
      assertCurrent(version);
      if(!Array.isArray(security))throw problem('unavailable');
      let aal='aal1';try{aal=JSON.parse(atob(s.access_token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/'))).aal;}catch{}
      if(security.some(row=>row.studioId===selected.context_id&&row.mfaRequired)&&aal!=='aal2'){
        mfaPending={selected,userId:user.id,factor:(user.factors||[]).find(f=>f.factor_type==='totp'&&f.status==='verified')?.id||null};
        emit({phase:'mfa',user:{id:user.id,email:user.email||''},contexts,selected:null,message:'',mfa:{enrolled:!!mfaPending.factor}});
        return;
      }
    }
    mfaPending=null;
    try {
      if (selected) preferenceStorage.setItem(contextKey, JSON.stringify({ userId: user.id, ...selected }));
      else preferenceStorage.removeItem(contextKey);
    } catch { throw problem('storage'); }
    // Only an actual identity/scope change invalidates pending operational reads.
    if (background && (state.user?.id !== user.id || !same(state.selected, selected) && (state.selected || selected))) epoch++;
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
    async enrollMfa(){
      if(state.phase!=='mfa'||!mfaPending||mfaPending.factor||mfaBusy)return;
      const version=epoch;mfaBusy=true;
      try{
        const s=await session(version);
        const result=await request('/auth/v1/factors',{token:s.access_token,body:{factor_type:'totp',friendly_name:'TAL Studio'}});
        assertCurrent(version);
        if(!uuid.test(result.id)||typeof result.totp?.secret!=='string')throw problem('unavailable');
        mfaPending.factor=result.id;
        // Enrollment secret is shown once in the current view, never persisted/logged.
        emit({...state,mfa:{enrolled:true,secret:result.totp.secret},message:''});
      }catch(e){if(version===epoch)emit({...state,message:messages[e.code]||'Non è stato possibile attivare la verifica. Riprova.'});}finally{mfaBusy=false;}
    },
    async verifyMfa(code){
      if(state.phase!=='mfa'||!mfaPending?.factor||!/^\d{6}$/.test(code)||mfaBusy)return;
      const version=epoch,pending=mfaPending;mfaBusy=true;
      try{
        await lock(sessionKey,async()=>{
          assertCurrent(version);const s=saved();if(!s)throw problem('expired');
          const challenge=await request('/auth/v1/factors/'+pending.factor+'/challenge',{token:s.access_token,body:{}});
          const data=await request('/auth/v1/factors/'+pending.factor+'/verify',{token:s.access_token,body:{challenge_id:challenge.id,code}});
          assertCurrent(version);persist(data,pending.userId);
        });
        await discover(version,pending.selected);
      }catch(e){if(version===epoch){if(e.code==='expired')await failed(e,version);else emit({...state,message:e.code==='mfa-code'?'Codice non valido. Riprova.':'Verifica non disponibile. Riprova.'});}}finally{mfaBusy=false;}
    },
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
      // Focus/timer checks do not create a new identity epoch. Current RLS remains
      // mandatory on every operation; discovery is never an authorization cache.
      const version = epoch;
      checking = (async () => {
        try { await discover(version, null, false, true); }
        catch (error) {
          if (version !== epoch || error.code === 'stale') return;
          let active;
          try { active = saved(); } catch { /* invalid storage must still fail closed */ }
          // A transport/5xx/429 failure is not evidence of a revoked identity.
          // Keep the already verified screen only while its access token is valid.
          // Expired-token refresh failures hide data but keep credentials for retry.
          if (error.transient && active?.userId === state.user?.id && active.expires_at > now()) return;
          await failed(error, ++epoch);
        }
      })().finally(() => { checking = null; });
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
