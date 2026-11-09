/* Live content: the products and contact details saved in the admin console (the solartech-admin project).
   Loads after config.js and products.js and before main.js, so everything downstream just sees the edited lists.

   1. A copy kept in localStorage ('gs-live') from the last visit replaces the built-in lists straight away.
   2. When config.js has liveApi: true, fresh data is fetched from this site's own /api/public in the background. If it
      differs from what this page was built with, it is stored and the page reloads once (the loading screen covers a
      first visit).
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
      p.img = typeof p.img === 'string' && p.img ? p.img : 'assets/brand/favicon.svg?v=1';   // no photo yet (e.g. just imported): the sun, not a broken image
      p.part = p.part || '';
      return p;
    });
  }
  function apply(d) {
    var ps = clean(d && d.products);
    if (ps.length) window.GS_PRODUCTS = ps.map(function (p, i) { p.order = i; return p; });
    if (d && d.config) CONTACT.forEach(function (k) { if (d.config[k] != null && d.config[k] !== '') C[k] = d.config[k]; });
    // projects and factory photos saved in the console replace the examples in work-data.js (which only fills what's unset)
    if (d && Array.isArray(d.projects) && d.projects.length) window.GS_PROJECTS = d.projects.map(function (x) { x.photos = Array.isArray(x.photos) ? x.photos : []; return x; });
    if (d && Array.isArray(d.factory) && d.factory.length) window.GS_FACTORY_MEDIA = d.factory;
  }

  var cached = null;
  try { cached = JSON.parse(localStorage.getItem(KEY)); } catch (e) { /* private mode, or damaged: ignore */ }
  var built = '';   // what this page is built from, measured before apply() adds defaults to the objects
  if (cached) { built = JSON.stringify({ products: cached.products || [], config: cached.config || null, projects: cached.projects || null, factory: cached.factory || null }); apply(cached); }

  if (!C.liveApi || !window.fetch) return;

  var ctl = window.AbortController ? new AbortController() : null;
  var give = setTimeout(function () { if (ctl) ctl.abort(); }, 8000);

  fetch('/api/public', { headers: { Accept: 'application/json' }, signal: ctl ? ctl.signal : undefined }).then(function (r) {
    if (!r.ok) throw new Error(r.status);
    return r.json();
  }).then(function (d) {
    clearTimeout(give);
    var products = d.products || [], config = d.config || null, projects = d.projects || null, factory = d.factory || null;
    if (!products.length && !config && !projects && !factory) return;   // the console hasn't published anything yet
    var str = JSON.stringify({ products: products, config: config, projects: projects, factory: factory });
    if (str === built) return;
    try { localStorage.setItem(KEY, JSON.stringify({ at: Date.now(), products: products, config: config, projects: projects, factory: factory })); } catch (e) { return; }
    // reload once to show it, never in a loop (a fresh value is already stored, so the next load matches)
    try {
      if (Date.now() - (+sessionStorage.getItem(FLAG) || 0) < 20000) return;
      sessionStorage.setItem(FLAG, String(Date.now()));
    } catch (e) { /* no sessionStorage: the stored copy shows on the next visit */ return; }
    location.reload();
  }).catch(function () { clearTimeout(give); /* offline or the API is down: keep what we have */ });
})();
