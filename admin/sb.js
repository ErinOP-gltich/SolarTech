/* ============================================================================
   Green Sun console — a tiny Supabase client (auth · database · storage)
   Talks to Supabase's REST endpoints directly with fetch(): no third-party
   script, so the console's Content-Security-Policy can stay 'self'-only.
   ========================================================================== */
window.SB = (() => {
  const C = window.GS_CONFIG || {};
  const BASE = (C.supabaseUrl || '').replace(/\/+$/, ''), KEY = C.supabaseAnonKey || '';
  const configured = !!(BASE && KEY);
  const STORE = 'gs-admin-session';
  const legacyJWT = /^eyJ/.test(KEY);          // old-style anon keys are JWTs; new "publishable" keys are not

  class SBError extends Error {
    constructor(message, status, body){ super(message); this.status = status; this.body = body; }
  }

  /* ------------------------------------------------------------ session
     Kept in sessionStorage, so it belongs to this tab: it survives reloads and moving between
     console pages, and is gone when the tab or the browser is closed. Browsers can bring a closed
     tab's storage back (reopen closed tab, restore last session), so every page also stamps when
     it was left — a session left alone for over CLOSED_GRACE counts as closed and is ended. */
  const CLOSED_GRACE = 2 * 60e3;
  let session = null, endedByClose = false;
  try { localStorage.removeItem(STORE); } catch (e) {}          // sessions used to outlive the tab
  try { session = JSON.parse(sessionStorage.getItem(STORE) || 'null'); } catch (e) {}
  const persist = s => {
    session = s;
    try { s ? sessionStorage.setItem(STORE, JSON.stringify(s)) : sessionStorage.removeItem(STORE); } catch (e) {}
  };
  if (session && session.left_at && Date.now() - session.left_at > CLOSED_GRACE){
    // a closed tab came back: end the session here and at Supabase
    const old = session; endedByClose = true; persist(null);
    if (configured && old.access_token)
      fetch(BASE + '/auth/v1/logout', { method: 'POST', keepalive: true, headers: { apikey: KEY, Authorization: 'Bearer ' + old.access_token } }).catch(() => {});
  } else if (session && session.left_at){ const { left_at, ...rest } = session; persist(rest); }
  addEventListener('pagehide', () => { if (session) persist({ ...session, left_at: Date.now() }); });
  const shape = s => ({
    access_token: s.access_token,
    refresh_token: s.refresh_token,
    expires_at: +s.expires_at || Math.floor(Date.now() / 1000) + (+s.expires_in || 3600),
    user: s.user || (session && session.user) || null,
    signed_in_at: +s.signed_in_at || (session && session.signed_in_at) || Date.now()   // kept across token refreshes
  });

  /* sessions end sessionHours (config.js, default 6) after signing in, however active the console is */
  const LIMIT_H = +C.sessionHours > 0 ? +C.sessionHours : 6;
  if (session && !session.signed_in_at) persist({ ...session, signed_in_at: Date.now() });   // signed in before this limit existed
  const endsAt = () => session ? session.signed_in_at + LIMIT_H * 3600e3 : 0;
  const timedOut = () => !!session && Date.now() >= endsAt();

  /* ------------------------------------------------------------ request */
  async function req(path, { method = 'GET', body, headers = {}, auth = true } = {}){
    if (!configured) throw new SBError('Supabase is not configured yet (assets/js/config.js)', 0);
    const h = { apikey: KEY, ...headers };
    const tok = auth ? await token() : null;
    if (tok) h.Authorization = 'Bearer ' + tok;
    else if (legacyJWT) h.Authorization = 'Bearer ' + KEY;
    let payload = body;
    if (body !== undefined && !(body instanceof Blob) && typeof body !== 'string'){
      h['Content-Type'] = 'application/json'; payload = JSON.stringify(body);
    }
    let res;
    try { res = await fetch(BASE + path, { method, headers: h, body: payload, cache: 'no-store' }); }
    catch (e) { throw new SBError('Could not reach Supabase — check the internet connection', 0); }
    const text = await res.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch (e) { data = text; }
    if (!res.ok){
      const msg = (data && typeof data === 'object' && (data.msg || data.message || data.error_description || data.error)) || `Supabase returned ${res.status}`;
      throw new SBError(msg, res.status, data);
    }
    return data;
  }

  /* --------------------------------------------------------------- auth */
  let refreshing = null;
  function refresh(){
    if (!session || !session.refresh_token) return Promise.resolve(null);
    if (!refreshing){
      refreshing = req('/auth/v1/token?grant_type=refresh_token', { method: 'POST', body: { refresh_token: session.refresh_token }, auth: false })
        .then(s => { persist(shape(s)); return session; })
        .catch(e => { if (e.status >= 400 && e.status < 500) persist(null); throw e; })
        .finally(() => { refreshing = null; });
    }
    return refreshing;
  }
  /* a valid access token, refreshed a minute before it expires */
  async function token(){
    if (!session) return null;
    if (session.expires_at - 60 < Date.now() / 1000){
      try { await refresh(); } catch (e) { return null; }
    }
    return session ? session.access_token : null;
  }
  async function signIn(email, password){
    const s = await req('/auth/v1/token?grant_type=password', { method: 'POST', body: { email, password }, auth: false });
    persist({ ...shape(s), signed_in_at: Date.now() });
    return session;
  }
  async function signOut(){
    if (session){ try { await req('/auth/v1/logout', { method: 'POST' }); } catch (e) {} }
    persist(null);
  }
  async function user(){
    const u = await req('/auth/v1/user');
    if (session){ session.user = u; persist(session); }
    return u;
  }
  const recover = (email, redirectTo) =>
    req('/auth/v1/recover' + (redirectTo ? '?redirect_to=' + encodeURIComponent(redirectTo) : ''), { method: 'POST', body: { email }, auth: false });
  const updatePassword = password => req('/auth/v1/user', { method: 'PUT', body: { password } });
  /* password-reset / invite links arrive with the session in the URL hash (#access_token=…&type=recovery) */
  function fromHash(){
    const h = new URLSearchParams(location.hash.slice(1));
    if (h.get('error_description')) return { error: h.get('error_description').replace(/\+/g, ' ') };
    if (!h.get('access_token')) return null;
    persist(shape({ access_token: h.get('access_token'), refresh_token: h.get('refresh_token'), expires_in: h.get('expires_in'), expires_at: h.get('expires_at'), user: null, signed_in_at: Date.now() }));
    history.replaceState(null, '', location.pathname + location.search);
    return { type: h.get('type') || 'magiclink' };
  }

  /* ----------------------------------------------------------- database */
  const q = v => encodeURIComponent(v);
  const db = {
    select: (table, query = '') => req(`/rest/v1/${table}?${query}`),
    insert: (table, rows) => req(`/rest/v1/${table}`, { method: 'POST', body: rows, headers: { Prefer: 'return=representation' } }),
    update: (table, query, patch) => req(`/rest/v1/${table}?${query}`, { method: 'PATCH', body: patch, headers: { Prefer: 'return=representation' } }),
    remove: (table, query) => req(`/rest/v1/${table}?${query}`, { method: 'DELETE', headers: { Prefer: 'return=representation' } }),
    rpc: (fn, args = {}) => req(`/rest/v1/rpc/${fn}`, { method: 'POST', body: args })
  };

  /* ------------------------------------------------------------ storage */
  const enc = path => path.split('/').map(encodeURIComponent).join('/');
  const storage = {
    upload: (bucket, path, blob, type) => req(`/storage/v1/object/${bucket}/${enc(path)}`, {
      method: 'POST', body: blob,
      headers: { 'Content-Type': type || blob.type || 'application/octet-stream', 'x-upsert': 'false', 'cache-control': 'max-age=31536000' }
    }),
    publicUrl: (bucket, path) => `${BASE}/storage/v1/object/public/${bucket}/${enc(path)}`,
    list: (bucket, prefix = '', limit = 500) => req(`/storage/v1/object/list/${bucket}`, {
      method: 'POST', body: { prefix, limit, offset: 0, sortBy: { column: 'created_at', order: 'desc' } }
    }),
    remove: (bucket, paths) => req(`/storage/v1/object/${bucket}`, { method: 'DELETE', body: { prefixes: paths } })
  };

  return {
    configured, url: BASE, q, SBError,
    get session(){ return session; },
    get endedByClose(){ return endedByClose; },
    signIn, signOut, refresh, token, user, recover, updatePassword, fromHash,
    limitHours: LIMIT_H, endsAt, timedOut,
    db, storage
  };
})();
