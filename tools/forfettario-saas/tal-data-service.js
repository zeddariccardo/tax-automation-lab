// Structural cloud data only. All application requests are GET under user RLS.
// Auth owns credentials/rotation. No fiscal facts, documents, notes or writes.
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const problem = code => Object.assign(new Error(code), { code });
const text = value => typeof value === 'string' && value.trim().length <= 300 ? value.trim() || null : null;
const date = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value ? value : null;
const columns = {
  tax_workspace: 'id,label:identity->>label,start_date:identity->>startDate,status',
  tax_year: 'id,workspace_id,year',
  economic_activity: 'id,workspace_id,ateco_code:facts->>atecoCode',
  studio: 'id,name,status',
  studio_client_link: 'id,workspace_id,studio_id,status',
  studio_client_private: 'id,workspace_id,studio_id,link_id,reference:facts->alias->>clientCode',
};
export function createTalDataService({ auth, fetchImpl }) {
  async function rows(session, table, filters = {}) {
    if (!Object.hasOwn(columns, table)) throw problem('forbidden');
    const out = [];
    for (let offset = 0; ; ) {
      const query = new URLSearchParams({ select: columns[table], ...filters, order: 'id.asc', limit: '200', offset: String(offset) });
      let response;
      try {
        response = await fetchImpl(session.config.supabaseUrl + '/rest/v1/' + table + '?' + query, {
          method: 'GET', credentials: 'omit', cache: 'no-store', redirect: 'error',
          headers: { apikey: session.config.publishableKey, Authorization: 'Bearer ' + session.token,
            'Accept-Profile': 'tal', 'x-tal-context': session.context.context_type + ':' + session.context.context_id, Prefer: 'count=exact' },
          signal: AbortSignal.timeout(15000),
        });
      } catch { throw problem('unavailable'); }
      if (!response.ok) {
        await response.body?.cancel();
        throw problem(response.status === 401 ? 'expired' : response.status === 403 ? 'forbidden' : response.status === 404 ? 'missing' : 'unavailable');
      }
      let page;
      try { page = await response.json(); } catch { throw problem('unavailable'); }
      const total = Number(response.headers.get('content-range')?.match(/\/(\d+)$/)?.[1]);
      if (!Array.isArray(page) || page.some(r => !uuid.test(r.id)) || !Number.isSafeInteger(total) || total < 0) throw problem('unavailable');
      out.push(...page); offset += page.length;
      if (offset >= total) break;
      if (!page.length || offset > 10000) throw problem('unavailable'); // no silent truncation
    }
    if (new Set(out.map(r => r.id)).size !== out.length) throw problem('unavailable');
    return out;
  }
  async function load(session, requestedId = null) {
    const c = session.context, personal = c.context_type === 'personal';
    if (!['personal', 'studio'].includes(c.context_type) || !uuid.test(c.context_id)) throw problem('forbidden');
    if (requestedId !== null && !uuid.test(requestedId)) throw problem('forbidden');
    const scope = personal ? { workspace_id: 'eq.' + c.context_id } : {};
    const [years, activities, links, aliases] = await Promise.all([
      rows(session, 'tax_year', scope), rows(session, 'economic_activity', scope),
      personal ? [] : rows(session, 'studio_client_link', { studio_id: 'eq.' + c.context_id, status: 'eq.active' }),
      personal ? [] : rows(session, 'studio_client_private', { studio_id: 'eq.' + c.context_id }),
    ]);
    // Read current access again after supporting rows; a revoked link cannot leave
    // a previously fetched alias/year displayed as an accessible client.
    const [workspaces, studios] = await Promise.all([
      rows(session, 'tax_workspace', { status: 'eq.active', ...(requestedId || personal ? { id: 'eq.' + (requestedId || c.context_id) } : {}) }),
      personal ? [] : rows(session, 'studio', { id: 'eq.' + c.context_id, status: 'eq.verified' }),
    ]);
    if (!personal && (studios.length !== 1 || studios[0].id !== c.context_id)) throw problem('forbidden');
    if (personal && (workspaces.length !== 1 || workspaces[0].id !== c.context_id)) throw problem('forbidden');
    const positions = workspaces.filter(w => personal || links.some(l => l.workspace_id === w.id && l.studio_id === c.context_id && l.status === 'active')).map(w => {
      const link = links.find(l => l.workspace_id === w.id);
      const alias = aliases.find(a => a.workspace_id === w.id && a.studio_id === c.context_id && a.link_id === link?.id);
      return { source: 'cloud', id: w.id, label: text(w.label) || 'Posizione senza nome', startDate: date(w.start_date),
        studioReference: text(alias?.reference), // private import reference, NOT a global TAL ID
        years: years.filter(y => y.workspace_id === w.id).map(y => {
          if (!Number.isInteger(y.year) || y.year < 2000 || y.year > 2200) throw problem('unavailable');
          return { id: y.id, year: y.year };
        }).sort((a,b) => b.year - a.year),
        activities: activities.filter(a => a.workspace_id === w.id).map(a => ({ id: a.id, atecoCode: text(a.ateco_code) })),
      };
    });
    if (requestedId && !positions.some(p => p.id === requestedId)) throw problem('forbidden');
    return { source: 'cloud', context: { ...c }, studio: personal ? null : { id: studios[0].id, name: text(studios[0].name) || c.label }, positions };
  }
  return {
    loadContext: () => auth.withContextSession(session => load(session)),
    readPosition: id => auth.withContextSession(async session => (await load(session, id)).positions.find(p => p.id === id)),
  };
}

// Context lifecycle: results are not kept across logout, error, revocation or context switch.
export function createTalDataController({ auth, service, defer = fn => setTimeout(fn,0) }) {
const listeners = new Set();
let scope = '', generation = 0, pending = null;
let state = { phase: 'idle', data: null };
const emit = next => { state = next; for (const fn of listeners) fn(structuredClone(state)); };
const key = a => a.phase === 'ready' ? a.user.id + ':' + a.selected.context_type + ':' + a.selected.context_id : '';
async function refresh() {
  if (!scope) return;
  if (pending) return pending;
  const version = generation;
  if (!state.data) emit({ phase: 'loading', data: null });
  pending = (async () => {
    try {
      const data = await service.loadContext();
      if (version === generation) emit({ phase: 'ready', data });
    } catch (error) {
      if (version !== generation) return;
      // A periodic Auth discovery can supersede a read. Retry from current identity.
      if (error.code === 'stale') {
        emit({ phase: 'loading', data: null });
        defer(() => void refresh());
      } else emit({ phase: ['forbidden','expired'].includes(error.code) ? 'forbidden' : 'error', data: null });
    } finally { if (version === generation) pending = null; }
  })();
  return pending;
}
const controller = {
  getState: () => structuredClone(state),
  subscribe(fn) { listeners.add(fn); fn(structuredClone(state)); return () => listeners.delete(fn); },
  refresh,
};
auth.subscribe(a => {
  const next = key(a);
  if (next !== scope) {
    scope = next; generation++; pending = null;
    emit({ phase: next ? 'loading' : 'idle', data: null });
  }
  if (next) void refresh();
});

return controller;
}
