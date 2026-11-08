/* Projects and Visit the factory: both pages are built from work-data.js. */
(function () {
  const GS = window.GS, esc = GS.esc, CFG = GS.config;
  const root = document.documentElement;
  const lite = function () { return root.classList.contains('lite') || GS.reduceMotion; };
  const PIN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 22c5-4 8-8 8-12a8 8 0 0 0-16 0c0 4 3 8 8 12z"/><circle cx="12" cy="10" r="3"/></svg>';
  const ARROW = '<svg class="arr" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
  const uniq = function (a) { return a.filter(function (x, i) { return x && a.indexOf(x) === i; }); };

  // numbers that count up the first time they scroll into view
  function countUp(scope) {
    const els = scope.querySelectorAll('[data-to]');
    const run = function (el) {
      const to = +el.dataset.to, t0 = performance.now(), dur = lite() ? 0 : 1400;
      (function tick(t) {
        const k = dur ? Math.min(1, (t - t0) / dur) : 1;
        el.textContent = Math.round(to * (1 - Math.pow(1 - k, 4))).toLocaleString('en-IN');
        if (k < 1) requestAnimationFrame(tick);
      })(t0);
    };
    if (!('IntersectionObserver' in window)) { els.forEach(run); return; }
    const io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { io.unobserve(e.target); run(e.target); } }); });
    els.forEach(function (el) { io.observe(el); });
  }

  // a <dialog> that pauses smooth scrolling while it is open
  function modal(dlg) {
    dlg.addEventListener('click', function (e) { if (e.target === dlg || e.target.closest('[data-close]')) dlg.close(); });
    dlg.addEventListener('close', function () { if (GS.lenis) GS.lenis.start(); const v = dlg.querySelector('video'); if (v) v.pause(); });
    return function () { dlg.showModal(); if (GS.lenis) GS.lenis.stop(); };
  }

  /* ---------------------------------------------------------------- projects */
  const grid = document.querySelector('[data-projects]');
  if (grid) {
    const P = window.GS_PROJECTS || [];
    const byId = {}; P.forEach(function (p) { byId[p.id] = p; });
    const where = function (p) { return [p.place, p.district !== p.place ? p.district : '', p.state].filter(Boolean).join(', '); };

    // headline numbers
    const stats = document.querySelector('[data-wk-stats]');
    // counted from real projects only: the sample entries are never totted up as if they were work done
    const real = P.filter(function (p) { return !p.sample; });
    if (stats && !real.length) stats.outerHTML = '<p class="wk-note rv">Our project gallery is being filled in. Until then, the projects below are <b>examples</b> of how each one will be shown.</p>';
    else if (stats) {
      const lights = real.reduce(function (s, p) { return s + (p.lights || 0); }, 0);
      stats.innerHTML = [[real.length, 'Projects'], [lights, 'Lights up'], [uniq(real.map(function (p) { return p.district; })).length, 'Districts'], [uniq(real.map(function (p) { return p.state; })).length, 'States']]
        .map(function (s) { return '<div><dt class="label">' + s[1] + '</dt><dd data-to="' + s[0] + '">0</dd></div>'; }).join('');
      countUp(stats);
    }

    // place names, round and round
    const tick = document.querySelector('[data-wk-places]');
    if (tick) {
      const names = uniq(P.map(function (p) { return p.place; }));
      const run = names.map(function (n) { return '<span>' + esc(n) + '</span><i aria-hidden="true">✳</i>'; }).join('');
      tick.innerHTML = '<div class="wk-tick-track">' + run + run + run + run + '</div>';
    }

    // the radar: every project as a dot at its latitude / longitude, Guwahati (us) at the centre of the sweep
    const radar = document.querySelector('[data-radar]');
    if (radar && P.length) {
      const home = CFG.geo || { lat: 26.12, lng: 91.68 };
      const lats = P.map(function (p) { return p.lat; }).concat(home.lat), lngs = P.map(function (p) { return p.lng; }).concat(home.lng);
      const pad = 0.8, la0 = Math.min.apply(0, lats) - pad, la1 = Math.max.apply(0, lats) + pad, lo0 = Math.min.apply(0, lngs) - pad, lo1 = Math.max.apply(0, lngs) + pad;
      const xy = function (lat, lng) { return 'left:' + ((lng - lo0) / (lo1 - lo0) * 100).toFixed(2) + '%;top:' + ((la1 - lat) / (la1 - la0) * 100).toFixed(2) + '%'; };
      radar.querySelector('[data-dots]').innerHTML =
        '<span class="wk-dot is-home" style="' + xy(home.lat, home.lng) + '"><i></i><b class="label">Green Sun · Guwahati</b></span>' +
        P.map(function (p, i) {
          return '<button type="button" class="wk-dot" style="' + xy(p.lat, p.lng) + ';--d:' + (i * .15).toFixed(2) + 's" data-id="' + esc(p.id) + '" aria-label="' + esc(p.title + ', ' + where(p)) + '"><i></i><b class="label">' + esc(p.place) + '</b></button>';
        }).join('');
      radar.querySelector('[data-coords]').textContent = la0.toFixed(1) + '°N – ' + la1.toFixed(1) + '°N · ' + lo0.toFixed(1) + '°E – ' + lo1.toFixed(1) + '°E';
    }

    // filter + cards
    const types = uniq(P.map(function (p) { return p.type; }));
    const filter = document.querySelector('[data-filter]');
    let on = 'All';
    const card = function (p, i) {
      const big = i === 0 ? ' is-big' : '';
      return '<li class="wk-card rv' + big + '" style="--d:' + (i % 3 * .07).toFixed(2) + 's">' +
        '<button type="button" class="wk-open" data-id="' + esc(p.id) + '">' +
        '<span class="wk-ph"><img src="' + esc(p.photos[0]) + '" alt="" loading="lazy" decoding="async"></span>' +
        '<span class="wk-top"><span class="wk-chip">' + esc(p.type) + '</span><span class="wk-chip">' + esc(p.year) + '</span>' + (p.sample ? '<span class="wk-chip wk-sample">Sample</span>' : '') + '</span>' +
        '<span class="wk-no label">№ ' + String(i + 1).padStart(2, '0') + '</span>' +
        '<span class="wk-body"><b class="wk-title">' + esc(p.title) + '</b><span class="wk-loc">' + PIN + esc(where(p)) + '</span>' +
        '<span class="wk-n"><b>' + esc(p.lights) + '</b> light' + (p.lights === 1 ? '' : 's') + (p.length ? ' · ' + esc(p.length) + ' m of road' : '') + '</span></span>' +
        '<span class="wk-go" aria-hidden="true">' + ARROW + '</span></button></li>';
    };
    const render = function () {
      const list = P.filter(function (p) { return on === 'All' || p.type === on; });
      grid.innerHTML = list.map(card).join('');
      GS.reveals();
    };
    if (filter) {
      filter.innerHTML = ['All'].concat(types).map(function (t) {
        const n = t === 'All' ? P.length : P.filter(function (p) { return p.type === t; }).length;
        return '<button type="button" class="chip sl" aria-pressed="' + (t === on) + '" data-type="' + esc(t) + '"><span class="state" aria-hidden="true"></span>' + esc(t) + ' <span class="n">' + n + '</span></button>';
      }).join('');
      filter.addEventListener('click', function (e) {
        const b = e.target.closest('[data-type]'); if (!b) return;
        on = b.dataset.type;
        filter.querySelectorAll('[data-type]').forEach(function (x) { x.setAttribute('aria-pressed', x === b); });
        render();
      });
    }
    render();

    // one project, full size
    const dlg = document.querySelector('[data-project-dlg]');
    const open = dlg && modal(dlg);
    const show = function (id) {
      const p = byId[id]; if (!p) return;
      const names = (p.products || []).map(function (x) { return GS.byId[x]; }).filter(Boolean);
      const map = 'https://www.google.com/maps/search/?api=1&query=' + p.lat + ',' + p.lng;
      dlg.querySelector('[data-body]').innerHTML =
        '<div class="wk-dlg-ph">' + p.photos.map(function (src) { return '<img src="' + esc(src) + '" alt="' + esc(p.title) + '">'; }).join('') + '</div>' +
        '<div class="wk-dlg-tx"><p class="label">' + esc(p.type) + ' · ' + esc(p.year) + (p.sample ? ' · <span class="wk-sample-tx">Sample entry</span>' : '') + '</p>' +
        '<h2 class="h3" id="wk-dlg-h">' + esc(p.title) + '</h2>' +
        '<p class="wk-loc">' + PIN + esc(where(p)) + '</p>' +
        (p.text ? '<p>' + esc(p.text) + '</p>' : '') +
        '<dl class="wk-facts"><div><dt class="label">Lights</dt><dd>' + esc(p.lights) + '</dd></div>' +
        (p.length ? '<div><dt class="label">Road</dt><dd>' + esc(p.length) + ' m</dd></div>' : '') +
        '<div><dt class="label">Where</dt><dd>' + p.lat.toFixed(2) + '°N, ' + p.lng.toFixed(2) + '°E</dd></div></dl>' +
        (names.length ? '<p class="label" style="margin-top:var(--s5)">On the poles</p><ul class="wk-prods">' + names.map(function (x) { return '<li><img src="' + esc(x.img) + '" alt=""><span>' + esc(x.name) + '</span></li>'; }).join('') + '</ul>' : '') +
        '<div class="wk-dlg-act">' + GS.btn('Open in Google Maps', map, 'btn-glass glass btn-sm', ' target="_blank" rel="noopener"') +
        GS.btn('Get a quote like this', 'contact?p=' + encodeURIComponent((p.products || []).join(',')), 'btn-plasma btn-sm') + '</div></div>';
      open();
    };
    document.addEventListener('click', function (e) { const b = e.target.closest('.wk-open, .wk-dot[data-id]'); if (b && dlg) show(b.dataset.id); });
  }

  /* ---------------------------------------------------------------- factory */
  const stepsEl = document.querySelector('[data-steps]');
  if (stepsEl) {
    const F = window.GS_FACTORY || { steps: [], media: [] };
    const ICONS = {
      ruler: '<path d="M3 17 17 3l4 4L7 21z"/><path d="M7 13l2 2M10 10l2 2M13 7l2 2"/>',
      chip: '<rect x="6" y="6" width="12" height="12" rx="2"/><path d="M9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4"/><circle cx="12" cy="12" r="2"/>',
      battery: '<rect x="3" y="7" width="16" height="10" rx="2"/><path d="M21 11v2M7 10v4M11 10v4"/>',
      sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5 19 19M5 19l1.5-1.5M17.5 6.5 19 5"/>',
      shield: '<path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z"/><path d="M8 12l3 3 5-6"/>',
      check: '<circle cx="12" cy="12" r="9"/><path d="M8 12l3 3 5-6"/>',
      truck: '<path d="M2 6h11v10H2zM13 10h5l3 3v3h-8z"/><circle cx="6" cy="18" r="2"/><circle cx="17" cy="18" r="2"/>'
    };
    stepsEl.innerHTML = F.steps.map(function (s, i) {
      return '<li class="fx-step" data-n="' + (i + 1) + '"><div class="fx-top"><span class="fx-no">' + String(i + 1).padStart(2, '0') + '</span>' +
        '<span class="fx-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (ICONS[s.icon] || ICONS.check) + '</svg></span></div>' +
        '<h3 class="h3">' + esc(s.title) + '</h3><p>' + esc(s.text) + '</p></li>';
    }).join('');

    // the light beside the steps builds up as each step crosses the middle of the screen: s1 … s7 stay on once reached
    const vis = document.querySelector('[data-vis]'), cap = document.querySelector('[data-vis-cap]');
    const items = stepsEl.querySelectorAll('.fx-step');
    const show = function (n) {
      for (let k = 0; k <= items.length; k++) vis.classList.toggle('s' + k, k <= n);
      items.forEach(function (li, i) { li.classList.toggle('is-on', i + 1 === n); li.classList.toggle('is-done', i + 1 < n); });
      if (cap) cap.textContent = n ? String(n).padStart(2, '0') + ' / ' + String(items.length).padStart(2, '0') + ' · ' + F.steps[n - 1].title : 'Scroll to build a light';
    };
    if (!('IntersectionObserver' in window) || lite()) show(items.length);
    else {
      const io = new IntersectionObserver(function (es) {
        es.forEach(function (e) { if (e.isIntersecting) show(+e.target.dataset.n); });
      }, { rootMargin: '-48% 0px -48% 0px' });
      items.forEach(function (li) { io.observe(li); });
    }

    // photos and videos
    const media = document.querySelector('[data-media]');
    if (media) {
      media.innerHTML = F.media.map(function (m, i) {
        const inner = m.type === 'video'
          ? '<video src="' + esc(m.src) + '"' + (m.poster ? ' poster="' + esc(m.poster) + '"' : '') + ' muted loop playsinline preload="none"></video><span class="fx-play" aria-hidden="true"></span>'
          : '<img src="' + esc(m.src) + '" alt="" loading="lazy" decoding="async">';
        return '<li class="fx-m rv" style="--d:' + (i % 3 * .07).toFixed(2) + 's"><button type="button" data-m="' + i + '" aria-label="' + esc((m.type === 'video' ? 'Play video: ' : 'View photo: ') + (m.caption || '')) + '">' + inner +
          '<span class="fx-cap">' + esc(m.caption || '') + (m.sample ? ' <span class="wk-chip wk-sample">Sample</span>' : '') + '</span></button></li>';
      }).join('');
      GS.reveals();
      // muted clips play only while on screen
      if ('IntersectionObserver' in window && !lite()) {
        const io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) e.target.play().catch(function () {}); else e.target.pause(); }); }, { threshold: .4 });
        media.querySelectorAll('video').forEach(function (v) { io.observe(v); });
      }
      const dlg = document.querySelector('[data-media-dlg]');
      const open = dlg && modal(dlg);
      media.addEventListener('click', function (e) {
        const b = e.target.closest('[data-m]'); if (!b || !dlg) return;
        const m = F.media[+b.dataset.m];
        dlg.querySelector('[data-body]').innerHTML = (m.type === 'video'
          ? '<video src="' + esc(m.src) + '" controls autoplay playsinline' + (m.poster ? ' poster="' + esc(m.poster) + '"' : '') + '></video>'
          : '<img src="' + esc(m.src) + '" alt="' + esc(m.caption || '') + '">') + (m.caption ? '<p class="label">' + esc(m.caption) + '</p>' : '');
        open();
      });
    }

    // visit: WhatsApp with the message written out
    const visit = document.querySelector('[data-visit]');
    if (visit) visit.href = 'https://wa.me/' + CFG.whatsapp + '?text=' + encodeURIComponent('Hello Green Sun Technologies, I would like to visit your factory. ');
    const maps = document.querySelector('[data-visit-map]');
    if (maps && CFG.mapQuery) maps.href = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(CFG.mapQuery);
  }
})();
