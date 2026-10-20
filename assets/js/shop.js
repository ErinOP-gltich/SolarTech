/* Products page: category tabs, search, power & feature filters, sorting. */
(function () {
  const GS = window.GS;
  const CATS = window.GS_CATEGORIES;
  const ALL = GS.products;

  const POWER = [
    { id: 'low', label: 'Up to 20 W', test: function (p) { return p.watt && p.watt <= 20; } },
    { id: 'mid', label: '25 – 40 W', test: function (p) { return p.watt >= 25 && p.watt <= 40; } },
    { id: 'high', label: '50 W and above', test: function (p) { return p.watt >= 50; } }
  ];
  const FEATURES = [
    { id: 'rms', label: 'Remote monitoring', test: function (p) { return (p.tags || []).indexOf('RMS') >= 0; } },
    { id: 'aio', label: 'All-in-one', test: function (p) { return (p.tags || []).indexOf('All-in-one') >= 0; } },
    { id: 'lifepo4', label: 'LiFePO₄ battery', test: function (p) { return /LiFePO/.test(p.chem || ''); } },
    { id: 'glass', label: 'Glass optic', test: function (p) { return p.optic === 'Glass'; } },
    { id: 'lens', label: 'Lens optic', test: function (p) { return p.optic === 'Lens'; } }
  ];

  const state = { cat: 'all', q: '', power: new Set(), feat: new Set(), sort: 'featured' };

  const tabs = document.querySelector('[data-tabs]');
  const grid = document.querySelector('[data-grid]');
  const count = document.querySelector('[data-count]');
  const empty = document.querySelector('[data-empty]');
  const qInput = document.querySelector('[data-q]');
  const sortSel = document.querySelector('[data-sort]');
  const powerBox = document.querySelector('[data-power]');
  const featBox = document.querySelector('[data-features]');

  function haystack(p) {
    const cat = CATS.find(function (c) { return c.id === p.cat; });
    return [p.name, p.part, p.short, cat && cat.name, (p.tags || []).join(' '),
      (p.specs || []).map(function (s) { return s.join(' '); }).join(' ')].join(' ').toLowerCase();
  }
  ALL.forEach(function (p) { p._hay = haystack(p); });

  function matches(p, skip) {
    if (state.cat !== 'all' && p.cat !== state.cat) return false;
    if (state.q) {
      // every word must match the start of a word in the product's text ("rms" finds RMS, not "arms")
      const words = state.q.toLowerCase().split(/\s+/).filter(Boolean);
      if (!words.every(function (w) {
        return new RegExp('(^|[^a-z0-9])' + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).test(p._hay);
      })) return false;
    }
    if (skip !== 'power' && state.power.size && !POWER.some(function (f) { return state.power.has(f.id) && f.test(p); })) return false;
    if (skip !== 'feat') {
      for (const id of state.feat) {
        const f = FEATURES.find(function (x) { return x.id === id; });
        if (!f.test(p)) return false;
      }
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

  function renderTabs() {
    const items = [{ id: 'all', name: 'Everything', img: 'assets/brand/favicon.svg' }].concat(CATS);
    tabs.innerHTML = items.map(function (c) {
      const n = c.id === 'all' ? ALL.length : ALL.filter(function (p) { return p.cat === c.id; }).length;
      return '<button class="cat-tab" type="button" aria-pressed="' + (state.cat === c.id) + '" data-cat="' + c.id + '">' +
        '<span class="th"><img src="' + c.img + '" alt=""></span>' + GS.esc(c.name) + ' <span class="c">' + n + '</span></button>';
    }).join('');
  }

  function renderChecks(box, defs, set, skip) {
    box.innerHTML = defs.map(function (f) {
      const n = ALL.filter(function (p) { return matches(p, skip) && f.test(p); }).length;
      return '<label class="check"><input type="checkbox" value="' + f.id + '"' + (set.has(f.id) ? ' checked' : '') + '> ' +
        GS.esc(f.label) + ' <span class="c">' + n + '</span></label>';
    }).join('');
  }

  function render() {
    const list = sorted(ALL.filter(function (p) { return matches(p); }));
    grid.innerHTML = list.map(GS.card).join('');
    empty.hidden = list.length > 0;
    const cat = CATS.find(function (c) { return c.id === state.cat; });
    count.innerHTML = '<b>' + list.length + '</b> ' + (list.length === 1 ? 'product' : 'products') + (cat ? ' in ' + GS.esc(cat.name) : '');
    tabs.querySelectorAll('[data-cat]').forEach(function (b) { b.setAttribute('aria-pressed', b.dataset.cat === state.cat); });
    renderChecks(powerBox, POWER, state.power, 'power');
    renderChecks(featBox, FEATURES, state.feat, 'feat');
  }

  function fromHash() {
    const id = location.hash.slice(1);
    state.cat = CATS.some(function (c) { return c.id === id; }) ? id : 'all';
  }

  tabs.addEventListener('click', function (e) {
    const b = e.target.closest('[data-cat]');
    if (!b) return;
    state.cat = b.dataset.cat;
    history.replaceState(null, '', state.cat === 'all' ? location.pathname + location.search : '#' + state.cat);
    render();
  });
  qInput.addEventListener('input', function () { state.q = qInput.value.trim(); render(); });
  sortSel.addEventListener('change', function () { state.sort = sortSel.value; render(); });
  powerBox.addEventListener('change', function (e) { toggle(state.power, e.target); });
  featBox.addEventListener('change', function (e) { toggle(state.feat, e.target); });
  function toggle(set, input) {
    const box = input.closest('[data-power],[data-features]');
    if (input.checked) set.add(input.value); else set.delete(input.value);
    render();
    // keep keyboard focus on the checkbox that was just re-rendered
    const again = box.querySelector('input[value="' + input.value + '"]');
    if (again) again.focus();
  }
  document.querySelector('[data-reset]').addEventListener('click', function () {
    state.q = ''; qInput.value = ''; state.power.clear(); state.feat.clear(); state.cat = 'all';
    history.replaceState(null, '', location.pathname);
    render();
  });
  const ft = document.querySelector('[data-filters-toggle]');
  const filters = document.querySelector('[data-filters]');
  ft.addEventListener('click', function () {
    const open = filters.classList.toggle('is-open');
    ft.setAttribute('aria-expanded', open);
  });
  addEventListener('hashchange', function () { fromHash(); render(); });

  const params = new URLSearchParams(location.search);
  if (params.get('q')) { state.q = params.get('q'); qInput.value = state.q; }
  fromHash();
  renderTabs();
  render();
})();
