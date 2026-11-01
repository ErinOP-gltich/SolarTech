/* Live content: the products and contact details saved in the admin console (admin/).
   Loads after config.js and products.js and before main.js, so everything downstream just sees the edited lists.

   1. A copy kept in localStorage ('gs-live') from the last visit replaces the built-in lists straight away.
   2. When Supabase is set up in config.js, fresh data is fetched in the background. If it differs from what this
      page was built with, it is stored and the page reloads once (the loading screen covers a first visit).
   3. Without Supabase (the console's demo mode) step 1 is all there is.
   With nothing stored and nothing reachable, the site shows products.js and config.js exactly as written. */
(function () {
  'use strict';
  var C = window.GS_CONFIG = window.GS_CONFIG || {};
  var KEY = 'gs-live', FLAG = 'gs-live-reload';
  var CONTACT = ['phone', 'whatsapp', 'email', 'address', 'mapQuery', 'serviceAreas'];   // the only config values the console may change
  var cats = {};
  (window.GS_CATEGORIES || []).forEach(function (c) { cats[c.id] = true; });

  function clean(list) {
    return (Array.isArray(list) ? list : []).filter(function (p) {
      return p && typeof p.id === 'string' && typeof p.name === 'string' && cats[p.cat];
    }).map(function (p) {
      p.specs = Array.isArray(p.specs) ? p.specs : [];
      p.tags = Array.isArray(p.tags) ? p.tags : [];
      p.img = typeof p.img === 'string' ? p.img : '';
      p.part = p.part || '';
      return p;
    });
  }
  function apply(d) {
    var ps = clean(d && d.products);
    if (ps.length) window.GS_PRODUCTS = ps.map(function (p, i) { p.order = i; return p; });
    if (d && d.config) CONTACT.forEach(function (k) { if (d.config[k] != null && d.config[k] !== '') C[k] = d.config[k]; });
  }

  var cached = null;
  try { cached = JSON.parse(localStorage.getItem(KEY)); } catch (e) { /* private mode, or damaged: ignore */ }
  var built = '';   // what this page is built from, measured before apply() adds defaults to the objects
  if (cached) { built = JSON.stringify({ products: cached.products || [], config: cached.config || null }); apply(cached); }

  var base = (C.supabaseUrl || '').replace(/\/+$/, ''), anon = C.supabaseAnonKey || '';
  if (!base || !anon || !window.fetch) return;

  var h = { apikey: anon };
  if (/^eyJ/.test(anon)) h.Authorization = 'Bearer ' + anon;   // old-style anon keys are JWTs; publishable keys are not
  var ctl = window.AbortController ? new AbortController() : null;
  var give = setTimeout(function () { if (ctl) ctl.abort(); }, 8000);
  function get(path) {
    return fetch(base + '/rest/v1/' + path, { headers: h, signal: ctl ? ctl.signal : undefined }).then(function (r) {
      if (!r.ok) throw new Error(r.status);
      return r.json();
    });
  }

  Promise.all([get('gs_products?select=id,data&order=sort.asc,id.asc'), get('gs_settings?select=key,data&key=eq.contact')]).then(function (res) {
    clearTimeout(give);
    var products = res[0].map(function (r) { var p = r.data || {}; p.id = r.id; return p; });
    var config = res[1][0] ? res[1][0].data : null;
    if (!products.length && !config) return;                   // the console hasn't published anything yet
    var fresh = { products: products, config: config };
    var str = JSON.stringify(fresh);
    if (str === built) return;
    try { localStorage.setItem(KEY, JSON.stringify({ at: Date.now(), products: products, config: config })); } catch (e) { return; }
    // reload once to show it, never in a loop (a fresh value is already stored, so the next load matches)
    try {
      if (Date.now() - (+sessionStorage.getItem(FLAG) || 0) < 20000) return;
      sessionStorage.setItem(FLAG, String(Date.now()));
    } catch (e) { /* no sessionStorage: the stored copy shows on the next visit */ return; }
    location.reload();
  }).catch(function () { clearTimeout(give); /* offline, paused project or a blocked request: keep what we have */ });
})();
