/* Shared behaviour for every page: header, menu, quote list, product cards, reveals. */
(function () {
  const CFG = window.GS_CONFIG || {};
  const PRODUCTS = window.GS_PRODUCTS || [];
  const byId = {};
  PRODUCTS.forEach(function (p) { byId[p.id] = p; });
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia('(pointer: fine)').matches;

  const ICON = {
    arrow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
    plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7"/></svg>',
    info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h10"/></svg>',
    back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 12H5M11 6l-6 6 6 6"/></svg>'
  };

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* ---------- quote list (kept in this browser only) ---------- */
  const KEY = 'gs-quote';
  const quote = {
    list: function () {
      try {
        const v = JSON.parse(localStorage.getItem(KEY) || '[]');
        return Array.isArray(v) ? v.filter(function (x) { return x && byId[x.id]; }) : [];
      } catch (e) { return []; }
    },
    save: function (list) {
      try { localStorage.setItem(KEY, JSON.stringify(list)); } catch (e) { /* private mode: the list just won't persist */ }
      paintCount(true);
      document.dispatchEvent(new CustomEvent('gs:quote'));
    },
    has: function (id) { return quote.list().some(function (x) { return x.id === id; }); },
    add: function (id, qty) {
      const list = quote.list();
      const hit = list.find(function (x) { return x.id === id; });
      if (hit) hit.qty = Math.max(1, qty || hit.qty); else list.push({ id: id, qty: qty || 1 });
      quote.save(list);
    },
    set: function (id, qty) {
      const list = quote.list();
      const hit = list.find(function (x) { return x.id === id; });
      if (hit) { hit.qty = Math.max(1, Math.min(9999, qty | 0 || 1)); quote.save(list); }
    },
    remove: function (id) { quote.save(quote.list().filter(function (x) { return x.id !== id; })); }
  };

  function paintCount(bump) {
    const n = quote.list().length;
    document.querySelectorAll('[data-quote-count]').forEach(function (el) {
      el.textContent = n;
      if (bump) { el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); }
    });
  }

  /* ---------- product card ---------- */
  function keySpecs(p) {
    if (p.key) return p.key;
    return [['Battery', p.battery], ['Panel', p.panel], ['Backup', p.autonomy]];
  }

  function card(p) {
    const href = 'contact.html?p=' + encodeURIComponent(p.id);
    const on = quote.has(p.id);
    const big = p.big || (p.watt ? p.watt + 'W' : '');
    return '' +
      '<article class="card" data-id="' + esc(p.id) + '">' +
        '<div class="card-inner">' +
          '<div class="card-face card-front">' +
            '<a class="card-stage' + (p.blueprint ? ' blueprint' : '') + '" href="' + href + '" tabindex="-1" aria-hidden="true">' +
              (big ? '<span class="card-watt">' + esc(big) + '</span>' : '') +
              '<img src="' + esc(p.img) + '" alt="" loading="lazy" decoding="async">' +
              (p.badge ? '<span class="card-badge">' + esc(p.badge) + '</span>' : '') +
            '</a>' +
            '<div class="card-body">' +
              '<p class="card-part">' + esc(p.part) + '</p>' +
              '<h3 class="card-title"><a href="' + href + '">' + esc(p.name) + '</a></h3>' +
              '<ul class="card-tags">' + (p.tags || []).map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ul>' +
              '<dl class="card-specs">' + keySpecs(p).map(function (s) {
                return '<div><dt>' + esc(s[0]) + '</dt><dd>' + esc(s[1]) + '</dd></div>';
              }).join('') + '</dl>' +
            '</div>' +
            '<div class="card-actions">' +
              '<a class="btn btn-sun btn-sm" href="' + href + '">Enquire ' + ICON.arrow + '</a>' +
              '<button class="icon-btn' + (on ? ' is-on' : '') + '" type="button" data-add="' + esc(p.id) + '" aria-pressed="' + on + '" aria-label="Add ' + esc(p.short || p.name) + ' to quote list">' + (on ? ICON.check : ICON.plus) + '</button>' +
              '<button class="icon-btn" type="button" data-flip aria-label="Show full specifications">' + ICON.info + '</button>' +
            '</div>' +
          '</div>' +
          '<div class="card-face card-back" inert>' +
            '<h4>' + esc(p.short || p.name) + '</h4>' +
            '<p class="card-part">' + esc(p.part) + ' · datasheet</p>' +
            '<dl>' + (p.specs || []).map(function (s) {
              return '<div><dt>' + esc(s[0]) + '</dt><dd>' + esc(s[1]) + '</dd></div>';
            }).join('') + '</dl>' +
            '<div class="card-actions">' +
              '<a class="btn btn-sun btn-sm" href="' + href + '">Enquire ' + ICON.arrow + '</a>' +
              '<button class="icon-btn" type="button" data-flip aria-label="Back to product">' + ICON.back + '</button>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</article>';
  }

  function syncAddButtons() {
    document.querySelectorAll('[data-add]').forEach(function (b) {
      const on = quote.has(b.dataset.add);
      b.classList.toggle('is-on', on);
      b.setAttribute('aria-pressed', on);
      b.innerHTML = on ? ICON.check : ICON.plus;
    });
  }
  document.addEventListener('gs:quote', syncAddButtons);

  /* ---------- toast ---------- */
  let toastEl, toastTimer;
  function toast(msg, link) {
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.className = 'toast';
      toastEl.setAttribute('role', 'status');
      document.body.appendChild(toastEl);
    }
    toastEl.innerHTML = '<span>' + esc(msg) + '</span>' + (link ? '<a href="' + link.href + '">' + esc(link.text) + '</a>' : '');
    requestAnimationFrame(function () { toastEl.classList.add('is-on'); });
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('is-on'); }, 3400);
  }

  /* ---------- clicks on cards: add to list, flip ---------- */
  document.addEventListener('click', function (e) {
    const add = e.target.closest('[data-add]');
    if (add) {
      const id = add.dataset.add;
      const p = byId[id];
      if (quote.has(id)) {
        quote.remove(id);
        toast((p.short || p.name) + ' removed from your quote list');
      } else {
        quote.add(id, 1);
        toast((p.short || p.name) + ' added to your quote list', { href: 'contact.html', text: 'Get quote' });
      }
      return;
    }
    const flip = e.target.closest('[data-flip]');
    if (flip) {
      const c = flip.closest('.card');
      const flipped = c.classList.toggle('is-flipped');
      const front = c.querySelector('.card-front');
      const back = c.querySelector('.card-back');
      front.inert = flipped;
      back.inert = !flipped;
      const target = (flipped ? back : front).querySelector('[data-flip]');
      if (target) setTimeout(function () { target.focus({ preventScroll: true }); }, 50);
    }
  });

  /* ---------- config-driven contact details ---------- */
  function fillConfig() {
    document.querySelectorAll('[data-cfg]').forEach(function (el) {
      const k = el.dataset.cfg;
      if (k === 'phone' && CFG.phone) { el.href = 'tel:' + CFG.phone.replace(/\s+/g, ''); if (!el.dataset.keep) el.textContent = CFG.phone; }
      if (k === 'email' && CFG.email) { el.href = 'mailto:' + CFG.email; if (!el.dataset.keep) el.textContent = CFG.email; }
      if (k === 'whatsapp' && CFG.whatsapp) el.href = 'https://wa.me/' + CFG.whatsapp + '?text=' + encodeURIComponent('Hello Green Sun Technologies, I would like a quote.');
      if (k === 'address' && CFG.address) el.innerHTML = CFG.address.map(esc).join('<br>');
      if (k === 'gstin' && CFG.gstin) el.textContent = CFG.gstin;
      if (k === 'udyam' && CFG.udyam) el.textContent = CFG.udyam;
    });
    document.querySelectorAll('[data-cfg-text]').forEach(function (el) {
      if (CFG[el.dataset.cfgText]) el.textContent = CFG[el.dataset.cfgText];
    });
    document.querySelectorAll('[data-year]').forEach(function (el) { el.textContent = new Date().getFullYear(); });
  }

  /* ---------- header: colour follows the section under it, battery follows scroll ---------- */
  function header() {
    const hdr = document.querySelector('[data-hdr]');
    if (!hdr) return;
    const cell = hdr.querySelector('.charge-cell i');
    const pct = hdr.querySelector('.charge-pct');
    const charge = hdr.querySelector('.charge');
    let ticking = false;
    function update() {
      ticking = false;
      const y = hdr.getBoundingClientRect().bottom - 20;
      let dark = false;
      document.querySelectorAll('.t-dark, .t-light').forEach(function (s) {
        const r = s.getBoundingClientRect();
        if (r.top <= y && r.bottom > y) dark = s.classList.contains('t-dark');
      });
      hdr.classList.toggle('is-dark', dark);
      const max = document.documentElement.scrollHeight - innerHeight;
      const p = max > 0 ? Math.min(1, Math.max(0, scrollY / max)) : 1;
      if (cell) {
        cell.style.setProperty('--c', p.toFixed(3));
        pct.textContent = Math.round(p * 100) + '%';
        charge.classList.toggle('is-full', p > .995);
      }
    }
    addEventListener('scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
    addEventListener('resize', update);
    update();

    const burger = hdr.querySelector('.hdr-burger');
    const menu = document.getElementById('menu');
    if (burger && menu) {
      function setOpen(open) {
        burger.setAttribute('aria-expanded', open);
        menu.classList.toggle('is-open', open);
        menu.inert = !open;
        document.body.style.overflow = open ? 'hidden' : '';
      }
      menu.inert = true;
      burger.addEventListener('click', function () { setOpen(burger.getAttribute('aria-expanded') !== 'true'); });
      menu.addEventListener('click', function (e) { if (e.target.closest('a')) setOpen(false); });
      addEventListener('keydown', function (e) { if (e.key === 'Escape' && menu.classList.contains('is-open')) { setOpen(false); burger.focus(); } });
    }
  }

  /* ---------- reveal on scroll ---------- */
  function reveals() {
    const els = document.querySelectorAll('.rv');
    if (!('IntersectionObserver' in window) || reduceMotion) { els.forEach(function (el) { el.classList.add('in'); }); return; }
    const io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } });
    }, { rootMargin: '0px 0px -8% 0px' });
    els.forEach(function (el) { io.observe(el); });
  }

  /* ---------- cursor light + magnetic buttons ---------- */
  function pointerFx() {
    if (!finePointer || reduceMotion) return;
    const glow = document.createElement('div');
    glow.className = 'glow';
    glow.setAttribute('aria-hidden', 'true');
    document.body.appendChild(glow);
    let x = innerWidth / 2, y = innerHeight / 2, gx = x, gy = y, raf = 0;
    function loop() {
      gx += (x - gx) * .18; gy += (y - gy) * .18;
      glow.style.transform = 'translate(' + gx.toFixed(1) + 'px,' + gy.toFixed(1) + 'px)';
      raf = Math.abs(x - gx) + Math.abs(y - gy) > .5 ? requestAnimationFrame(loop) : 0;
    }
    addEventListener('pointermove', function (e) {
      x = e.clientX; y = e.clientY;
      glow.classList.add('is-on');
      if (!raf) raf = requestAnimationFrame(loop);
    }, { passive: true });
    document.addEventListener('pointerleave', function () { glow.classList.remove('is-on'); });

    document.querySelectorAll('[data-magnetic]').forEach(function (el) {
      el.addEventListener('pointermove', function (e) {
        const r = el.getBoundingClientRect();
        const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
        el.style.transform = 'translate(' + dx * .22 + 'px,' + dy * .3 + 'px)';
      });
      el.addEventListener('pointerleave', function () { el.style.transform = ''; });
    });
  }

  /* ---------- certificate lightbox ---------- */
  function lightbox() {
    const dlg = document.querySelector('[data-lightbox]');
    if (!dlg || typeof dlg.showModal !== 'function') return;
    const img = dlg.querySelector('img');
    document.querySelectorAll('[data-cert]').forEach(function (b) {
      b.addEventListener('click', function () { img.src = b.dataset.cert; img.alt = b.dataset.alt || ''; dlg.showModal(); });
    });
    dlg.querySelector('button').addEventListener('click', function () { dlg.close(); });
    dlg.addEventListener('click', function (e) { if (e.target === dlg) dlg.close(); });
  }

  /* ---------- holographic certificate foil ---------- */
  function foil() {
    document.querySelectorAll('.cert').forEach(function (c) {
      c.addEventListener('pointermove', function (e) {
        const r = c.getBoundingClientRect();
        c.style.setProperty('--mx', ((e.clientX - r.left) / r.width * 100).toFixed(1) + '%');
        c.style.setProperty('--my', ((e.clientY - r.top) / r.height * 100).toFixed(1) + '%');
      });
    });
  }

  document.querySelectorAll('[data-top]').forEach(function (b) {
    b.addEventListener('click', function () { scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' }); });
  });

  fillConfig();
  paintCount(false);
  header();
  reveals();
  pointerFx();
  lightbox();
  foil();

  window.GS = { config: CFG, products: PRODUCTS, byId: byId, quote: quote, card: card, esc: esc, icon: ICON, toast: toast, reduceMotion: reduceMotion, finePointer: finePointer, reveals: reveals };
})();
