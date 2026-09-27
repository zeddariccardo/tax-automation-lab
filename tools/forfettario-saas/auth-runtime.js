import config from './runtime-config.js';
import { createAuthContextService } from './auth-context-service.js';

const blockedStorage = { getItem() { throw new Error('storage'); }, setItem() { throw new Error('storage'); }, removeItem() {} };
let sessionStoragePort, localStoragePort;
try { localStoragePort = window.localStorage; sessionStoragePort = window.sessionStorage; } catch { /* controlled error in service */ }
export const auth = createAuthContextService({
  config,
  fetchImpl: window.fetch.bind(window),
  storage: localStoragePort || blockedStorage,
  preferenceStorage: sessionStoragePort || blockedStorage,
  lock: (key, work) => navigator.locks ? navigator.locks.request(key, work) : Promise.reject(new Error('Browser without Web Locks')),
});
window.addEventListener('storage', event => { if (event.key === auth.sessionKey || event.key === null) void auth.restore(); });
window.addEventListener('focus', () => void auth.revalidate());
document.addEventListener('visibilitychange', () => { if (!document.hidden) void auth.revalidate(); });
window.setInterval(() => { if (!document.hidden) void auth.revalidate(); }, 30000);
