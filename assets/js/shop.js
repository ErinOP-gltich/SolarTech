/* Marketplace: the wattage dial, the command bar (search, categories, power & feature chips, sort,
   grid/list) and a product grid whose cards fly to their new places when the filters change. */
(function () {
  const GS = window.GS;
  const gsap = window.gsap;
  const Flip = window.Flip;
  const CATS = window.GS_CATEGORIES;
  const ALL = GS.products;
  const motion = !GS.reduceMotion && !!gsap;
  if (gsap && Flip) gsap.registerPlugin(Flip);

  const CHECK = '<span class="tick" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7"/></svg></span>';
  const POWER = [
    { id: 'low', label: '≤ 20 W', test: function (p) { return p.watt && p.watt <= 20; } },
    { id: 'mid', label: '25–40 W', test: function (p) { return p.watt >= 25 && p.watt <= 40; } },
    { id: 'high', label: '50 W +', test: function (p) { return p.watt >= 50; } }
  ];
  const FEATURES = [
    { id: 'rms', label: 'Remote monitoring', test: function (p) { return (p.tags || []).indexOf('RMS') >= 0; } },
    { id: 'aio', label: 'All-in-one', test: function (p) { return (p.tags || []).indexOf('All-in-one') >= 0; } },
    { id: 'lifepo4', label: 'LiFePO₄', test: function (p) { return /LiFePO/.test(p.chem || ''); } }
  ];
  const state = { cat: 'all', q: '', power: new Set(), feat: new Set(), sort: 'featured', view: 'grid' };

  const $ = function (s) { return document.querySelector(s); };
  const grid = $('[data-grid]'), table = $('[data-table]'), empty = $('[data-empty]'), count = $('[data-count]');
  const seg = $('[data-seg]'), segInd = seg.querySelector('.seg-ind');
  const powerBox = $('[data-power]'), featBox = $('[data-feat]');
  const qInput = $('[data-q]'), sortSel = $('[data-sort]'), resetBtn = $('[data-reset]');

  /* ---------- 1. the wattage dial ---------- */
  function dial() {
    const host = $('[data-dial]');
    const lights = ALL.filter(function (p) { return /^si-\d+w$/.test(p.id); }).sort(function (a, b) { return a.watt - b.watt; });
    if (!host || !window.GSDial || !lights.length) { const sec = $('[data-dial-sec]'); if (sec) sec.hidden = true; return; }
    window.GSDial.mount(host, { products: lights, contactHref: function (id) { return 'contact.html?p=' + encodeURIComponent(id); } });
  }

  /* ---------- 2. search ---------- */
  // NFKC folds the catalogue's subscripts and symbols to plain text, so "LiFePO4" finds "LiFePO₄"
  const norm = function (s) { return String(s || '').normalize ? String(s || '').normalize('NFKC').toLowerCase() : String(s || '').toLowerCase(); };
  ALL.forEach(function (p) {
    const cat = CATS.find(function (c) { return c.id === p.cat; });
    p._hay = [p.name, p.part, p.short, cat && cat.name, (p.tags || []).join(' '),
      (p.specs || []).map(function (s) { return s.join(' '); }).join(' ')].join(' ');
    p._hay = norm(p._hay);
  });
  function matches(p, skip) {
    if (state.cat !== 'all' && p.cat !== state.cat) return false;
    if (state.q) {
      // every word must match the start of a word ("rms" finds RMS, not "arms")
      const ok = norm(state.q).split(/\s+/).filter(Boolean).every(function (w) {
        return new RegExp('(^|[^a-z0-9])' + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).test(p._hay);
      });
      if (!ok) return false;
    }
    if (skip !== 'power' && state.power.size && !POWER.some(function (f) { return state.power.has(f.id) && f.test(p); })) return false;
    if (skip !== 'feat') {
      for (const id of state.feat) if (!FEATURES.find(function (f) { return f.id === id; }).test(p)) return false;
    }
    return true;
  }
  function sorted(list) {
    const out = list.slice();
    if (state.sort === 'watt-asc') out.sort(function (a, b) { return (a.watt || 999) - (b.watt || 999) || a.order - b.order; });
    else if (state.sort === 'watt-desc') out.sort(function (a, b) { return (b.watt || 0) - (a.watt || 0) || a.order - b.order; });
    else if (state.sort === 'name') out.sort(function (a, b) { return a.name.localeCompare(b.name); });
    else out.sort(function (a, b) { return (b.featured ? 1 : 0) - (a.featured ? 1 : 0) || a.order - b.order; });
    return out;
  }

  /* ---------- 3. command bar ---------- */
  function buildBar() {
    const items = [{ id: 'all', name: 'All' }].concat(CATS);
    seg.insertAdjacentHTML('beforeend', items.map(function (c) {
      const n = c.id === 'all' ? ALL.length : ALL.filter(function (p) { return p.cat === c.id; }).length;
      const short = { street: 'Street lights', mast: 'Masts & floods', traffic: 'Traffic', storage: 'Storage', poles: 'Poles' }[c.id] || c.name;
      return '<button type="button" class="sl" aria-pressed="' + (state.cat === c.id) + '" data-cat="' + c.id + '"><span class="state" aria-hidden="true"></span><span>' + GS.esc(short) + '</span> <span class="n">' + n + '</span></button>';
    }).join(''));
    const chip = function (kind, f) {
      return '<button type="button" class="chip sl" aria-pressed="false" data-' + kind + '="' + f.id + '"><span class="state" aria-hidden="true"></span>' + CHECK + '<span>' + GS.esc(f.label) + '</span> <span class="n"></span></button>';
    };
    powerBox.innerHTML = POWER.map(function (f) { return chip('pw', f); }).join('');
    featBox.innerHTML = FEATURES.map(function (f) { return chip('ft', f); }).join('');
  }
  function moveIndicator(instant) {
    const b = seg.querySelector('[aria-pressed="true"]');
    if (!b) return;
    if (instant) segInd.style.transition = 'none';
    segInd.style.width = b.offsetWidth + 'px';
    segInd.style.transform = 'translateX(' + b.offsetLeft + 'px)';
    if (instant) { void segInd.offsetWidth; segInd.style.transition = ''; }
  }
  function paintBar() {
    seg.querySelectorAll('[data-cat]').forEach(function (b) { b.setAttribute('aria-pressed', b.dataset.cat === state.cat); });
    moveIndicator();
    [[powerBox, POWER, state.power, 'power', 'pw'], [featBox, FEATURES, state.feat, 'feat', 'ft']].forEach(function (g) {
      g[0].querySelectorAll('[data-' + g[4] + ']').forEach(function (b) {
        const f = g[1].find(function (x) { return x.id === b.getAttribute('data-' + g[4]); });
        b.setAttribute('aria-pressed', g[2].has(f.id));
        b.querySelector('.n').textContent = ALL.filter(function (p) { return matches(p, g[3]) && f.test(p); }).length;
      });
    });
    resetBtn.hidden = !(state.q || state.cat !== 'all' || state.power.size || state.feat.size);
  }

  /* ---------- 4. grid (built once; filtering moves cards with FLIP) and list ---------- */
  const cards = {};
  function buildGrid() {
    grid.innerHTML = sorted(ALL).map(function (p) { return GS.card(p, { feature: p.featured }); }).join('');
    grid.querySelectorAll('.card').forEach(function (c) { cards[c.dataset.id] = c; });
  }
  function renderTable(list) {
    table.innerHTML = '<table class="ptable"><thead><tr><th></th><th>Product</th><th>Power</th><th>Battery</th><th>Panel</th><th>Backup</th><th>Protection</th><th><span class="sr-only">Actions</span></th></tr></thead><tbody>' +
      list.map(function (p) {
        const href = 'contact.html?p=' + encodeURIComponent(p.id);
        return '<tr><td><span class="th' + (p.blueprint ? ' blueprint' : '') + '"><img src="' + p.img + '" alt="" loading="lazy"></span></td>' +
          '<td class="nm"><b>' + GS.esc(p.name) + '</b><span class="label">' + GS.esc(p.part) + '</span></td>' +
          '<td class="watt">' + (p.watt ? p.watt + 'W' : '—') + '</td><td>' + GS.esc(p.battery) + '</td><td>' + GS.esc(p.panel) + '</td>' +
          '<td>' + GS.esc(p.autonomy || '—') + '</td><td>' + GS.esc(p.ip || '—') + '</td>' +
          '<td><div style="display:flex;gap:8px;justify-content:flex-end">' + GS.btn('Enquire', href, 'btn-plasma btn-sm', ' aria-label="Enquire about ' + GS.esc(p.name) + '"') +
          '<button class="icon-btn glass sl" type="button" data-add="' + GS.esc(p.id) + '" aria-pressed="false" aria-label="Add ' + GS.esc(p.short || p.name) + ' to quote list"><span class="state" aria-hidden="true"></span>' + GS.icon.plus + '</button></div></td></tr>';
      }).join('') + '</tbody></table>';
    document.dispatchEvent(new CustomEvent('gs:quote'));
  }

  function render(animate) {
    const list = sorted(ALL.filter(function (p) { return matches(p); }));
    const show = {};
    list.forEach(function (p) { show[p.id] = true; });
    const cat = CATS.find(function (c) { return c.id === state.cat; });
    count.textContent = 'Showing ' + list.length + ' of ' + ALL.length + ' products' + (cat ? ' · ' + cat.name : '');
    empty.hidden = list.length > 0;
    paintBar();

    grid.hidden = state.view !== 'grid';
    table.hidden = state.view !== 'list' || !list.length;
    if (state.view === 'list') { renderTable(list); return; }

    const els = Object.keys(cards).map(function (k) { return cards[k]; });
    els.forEach(function (c) { c.style.transform = ''; });
    const flipState = animate && motion && Flip ? Flip.getState(els, { props: 'opacity' }) : null;
    list.forEach(function (p) { grid.appendChild(cards[p.id]); });
    els.forEach(function (c) { if (!show[c.dataset.id]) { c.hidden = true; grid.appendChild(c); } else c.hidden = false; });
    if (flipState) {
      Flip.from(flipState, {
        duration: .75, ease: 'expo.out', absolute: true, nested: true,
        onEnter: function (el) { return gsap.fromTo(el, { opacity: 0, scale: .88, y: 30 }, { opacity: 1, scale: 1, y: 0, duration: .6, ease: 'expo.out', clearProps: 'transform,opacity' }); },
        onLeave: function (el) { return gsap.to(el, { opacity: 0, scale: .88, duration: .35, ease: 'power2.in' }); },
        onComplete: function () { if (window.ScrollTrigger) window.ScrollTrigger.refresh(); }
      });
    } else if (window.ScrollTrigger) window.ScrollTrigger.refresh();
  }

  /* ---------- 5. wiring ---------- */
  function fromHash() {
    const id = location.hash.slice(1);
    state.cat = CATS.some(function (c) { return c.id === id; }) ? id : 'all';
  }
  seg.addEventListener('click', function (e) {
    const b = e.target.closest('[data-cat]');
    if (!b) return;
    state.cat = b.dataset.cat;
    history.replaceState(null, '', state.cat === 'all' ? location.pathname + location.search : '#' + state.cat);
    render(true);
  });
  function toggleChip(set, attr) {
    return function (e) {
      const b = e.target.closest('[data-' + attr + ']');
      if (!b) return;
      const id = b.getAttribute('data-' + attr);
      if (set.has(id)) set.delete(id); else set.add(id);
      render(true);
    };
  }
  powerBox.parentElement.addEventListener('click', toggleChip(state.power, 'pw'));
  featBox.parentElement.addEventListener('click', toggleChip(state.feat, 'ft'));
  let qTimer;
  qInput.addEventListener('input', function () { clearTimeout(qTimer); qTimer = setTimeout(function () { state.q = qInput.value.trim(); render(true); }, 120); });
  sortSel.addEventListener('change', function () { state.sort = sortSel.value; render(true); });
  document.querySelectorAll('[data-view]').forEach(function (b) {
    b.addEventListener('click', function () {
      state.view = b.dataset.view;
      document.querySelectorAll('[data-view]').forEach(function (x) { x.setAttribute('aria-pressed', x === b); });
      render(false);
    });
  });
  resetBtn.addEventListener('click', function () {
    state.q = ''; qInput.value = ''; state.power.clear(); state.feat.clear(); state.cat = 'all';
    history.replaceState(null, '', location.pathname);
    render(true);
    qInput.focus(); // the reset button hides itself, so give focus a home
  });
  addEventListener('hashchange', function () {
    fromHash(); render(true);
    // footer category links change the hash: bring the catalogue into view if it isn't. Wait two frames:
    // a shorter grid clamps the scroll position, and Lenis must see that before it can aim correctly.
    const c = $('#catalogue');
    if (!c) return;
    requestAnimationFrame(function () { requestAnimationFrame(function () {
      const t = c.getBoundingClientRect().top;
      if (t >= -40 && t <= innerHeight * .6) return;
      if (GS.lenis) { GS.lenis.resize(); GS.lenis.scrollTo(t + scrollY - 20); } else c.scrollIntoView();
    }); });
  });
  addEventListener('resize', function () { moveIndicator(true); });
  addEventListener('keydown', function (e) {
    // Ctrl/⌘ + K jumps to search (a modified shortcut, so it can't fire by accident while typing or using a screen reader)
    if ((e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey) && !e.altKey) { e.preventDefault(); qInput.focus(); qInput.select(); }
  });

  if (/Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)) document.querySelectorAll('[data-kbd]').forEach(function (k) { k.textContent = '⌘K'; });
  // While the command bar is pinned over the catalogue, the site nav tucks away and the bar moves up into its
  // place; once the products have scrolled past, the nav comes back. Measured from a marker at the bar's
  // natural position, so the bar moving up never flips the state back (wide screens only: below 1180 px the
  // bar is not sticky).
  (function tuckNav() {
    const cmd = $('[data-cmd]'), cat = $('#catalogue');
    if (!cmd || !cat || !document.querySelector('[data-nav]')) return;
    const mark = document.createElement('div');
    mark.setAttribute('aria-hidden', 'true');
    cmd.before(mark);
    const wide = matchMedia('(min-width: 1181px)');
    const pinAt = function () { return document.querySelector('[data-nav]').offsetHeight + 24; }; // the bar's sticky top: nav height + --s5
    let tucked = false, raf = 0;
    const check = function () {
      raf = 0;
      const want = wide.matches && mark.getBoundingClientRect().top <= pinAt() &&
        cat.getBoundingClientRect().bottom > cmd.offsetHeight + innerHeight * .35;
      if (want !== tucked) { tucked = want; document.documentElement.classList.toggle('nav-tucked', want); }
    };
    addEventListener('scroll', function () { if (!raf) raf = requestAnimationFrame(check); }, { passive: true });
    addEventListener('resize', check);
    check();
  })();

  const params = new URLSearchParams(location.search);
  if (params.get('q')) { state.q = params.get('q'); qInput.value = state.q; }
  // a refresh keeps the category filter but, like every page, opens at the top (the head script took the
  // #category out of the address so the browser wouldn't jump to it; put it back without scrolling)
  const kept = (window.GS_RELOAD_HASH || '').slice(1);
  const refreshed = CATS.some(function (c) { return c.id === kept; });
  if (refreshed) history.replaceState(null, '', '#' + kept);
  fromHash();
  buildBar();
  buildGrid();
  render(false);
  if (document.fonts) document.fonts.ready.then(function () { moveIndicator(true); });
  dial();

  // page intro
  GS.ready(function () {
    document.querySelectorAll('[data-hero-line]').forEach(function (l, i) { GS.splitIn(l, .1 + i * .12); });
    if (state.cat !== 'all' && !refreshed) { const c = $('#catalogue'); if (c) setTimeout(function () { if (GS.lenis) GS.lenis.scrollTo(c, { offset: -20 }); else c.scrollIntoView(); }, 400); }
  });
})();
