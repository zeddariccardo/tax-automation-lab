import config from './runtime-config.js';
import binding from './environment-binding.js';
import {validateEnvironment} from './environment-config.js';
import { createAuthContextService } from './auth-context-service.js';
let runtimeConfig=null;
try { runtimeConfig=validateEnvironment(config,binding); } catch { /* fail closed, no requests */ }

// Email confirmation is completed by Supabase. Never adopt a session from a URL.
// Remove callback credentials immediately and ask for a normal verified login.
if (/(?:[?#&])(?:access_token|refresh_token|token_hash|code|error_description)=/.test(location.href)) {
  history.replaceState(null, '', location.pathname + '#/ingresso');
}

const blockedStorage = { getItem() { throw new Error('storage'); }, setItem() { throw new Error('storage'); }, removeItem() {} };
let sessionStoragePort, localStoragePort;
try { localStoragePort = window.localStorage; sessionStoragePort = window.sessionStorage; } catch { /* controlled error in service */ }
export const auth = createAuthContextService({
  config:runtimeConfig,
  fetchImpl: window.fetch.bind(window),
  storage: localStoragePort || blockedStorage,
  preferenceStorage: sessionStoragePort || blockedStorage,
  lock: (key, work) => navigator.locks ? navigator.locks.request(key, work) : Promise.reject(new Error('Browser without Web Locks')),
});
window.addEventListener('storage', event => { if (event.key === auth.sessionKey || event.key === null) void auth.restore(); });
window.addEventListener('focus', () => void auth.revalidate());
document.addEventListener('visibilitychange', () => { if (!document.hidden) void auth.revalidate(); });
window.setInterval(() => { if (!document.hidden) void auth.revalidate(); }, 30000);
