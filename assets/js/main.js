/* Shared runtime for every page: smooth scroll, cursor, liquid-glass highlights, Material state
   layers + ripples, navigation, the quote list, the product card component and reveals. */
(function () {
  const CFG = window.GS_CONFIG || {};
  const PRODUCTS = window.GS_PRODUCTS || [];
  const byId = Object.create(null); // no prototype, so ?p=constructor can't match anything
  PRODUCTS.forEach(function (p) { byId[p.id] = p; });
  const root = document.documentElement;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia('(pointer: fine)').matches;
  const gsap = window.gsap;
  if (gsap && window.ScrollTrigger) gsap.registerPlugin(window.ScrollTrigger);

  const ICON = {
    arrow: '<svg class="arr" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
    plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7"/></svg>',
    chevron: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>',
    star: '<svg class="star" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 0l2.6 8.4L23 12l-8.4 2.6L12 24l-2.6-8.4L1 12l8.4-3.6z"/></svg>'
  };

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* ---------- page-ready: fires when the loading screen starts to reveal the page ---------- */
  const readyQueue = [];
  let isReady = false;
  function fireReady() {
    if (isReady) return;
    isReady = true;
    readyQueue.splice(0).forEach(function (fn) { try { fn(); } catch (e) { setTimeout(function () { throw e; }); } });
  }
  function ready(fn) { if (isReady) fn(); else readyQueue.push(fn); }
  if (root.classList.contains('is-loading')) {
    const behind = Array.from(document.body ? document.body.children : []).filter(function (n) { return n.id !== 'gsl' && n.tagName !== 'SCRIPT'; });
    behind.forEach(function (n) { n.inert = true; });
    ready(function () { behind.forEach(function (n) { n.inert = false; }); });
  }
  if (window.GSLoader && window.GSLoader.done) window.GSLoader.done.then(fireReady);
  else if (root.classList.contains('is-loaded') || !document.getElementById('gsl')) setTimeout(fireReady, 0);
  document.addEventListener('gs:loaded', fireReady);
  setTimeout(fireReady, 7000); // never wait forever

  /* ---------- quote list (kept in this browser only) ---------- */
  const KEY = 'gs-quote';
  let memList = null; // used when storage is blocked: the list then lasts as long as the page
  function clampQty(q) { return Math.max(1, Math.min(9999, parseInt(q, 10) || 1)); }
  const quote = {
    list: function () {
      let v = memList;
      try { const raw = localStorage.getItem(KEY); if (raw !== null) v = JSON.parse(raw); } catch (e) { /* blocked or corrupt: keep memList */ }
      if (!Array.isArray(v)) return [];
      const seen = Object.create(null);
      return v.filter(function (x) {
        if (!x || typeof x.id !== 'string' || !byId[x.id] || seen[x.id]) return false;
        return (seen[x.id] = true);
      }).map(function (x) { return { id: x.id, qty: clampQty(x.qty) }; });
    },
    save: function (list) {
      memList = list;
      try { localStorage.setItem(KEY, JSON.stringify(list)); } catch (e) { /* private mode: memList keeps it for this page */ }
      paintCount(true);
      document.dispatchEvent(new CustomEvent('gs:quote'));
    },
    has: function (id) { return quote.list().some(function (x) { return x.id === id; }); },
    add: function (id, qty) {
      const list = quote.list();
      const hit = list.find(function (x) { return x.id === id; });
      if (hit) hit.qty = clampQty(qty || hit.qty); else list.push({ id: id, qty: clampQty(qty) });
      quote.save(list);
    },
    set: function (id, qty) {
      const list = quote.list();
      const hit = list.find(function (x) { return x.id === id; });
      if (hit) { hit.qty = clampQty(qty); quote.save(list); }
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

  /* ---------- components ---------- */
  // a button's text rolls up to a copy of itself on hover; every .sl gets a Material state layer
  function enhance(scope) {
    (scope || document).querySelectorAll('.btn:not([data-enh])').forEach(function (b) {
      b.setAttribute('data-enh', '');
      Array.from(b.childNodes).forEach(function (n) {
        if (n.nodeType === 3 && n.textContent.trim()) {
          const t = n.textContent.trim();
          const lbl = document.createElement('span');
          lbl.className = 'lbl';
          lbl.innerHTML = lblHTML(t);
          b.replaceChild(lbl, n);
        }
      });
    });
    (scope || document).querySelectorAll('.sl').forEach(function (el) {
      if (!el.querySelector(':scope > .state')) el.insertAdjacentHTML('afterbegin', '<span class="state" aria-hidden="true"></span>');
    });
  }

  // the label and its hover-roll copy; the copy is hidden from assistive tech so names aren't read twice
  function lblHTML(t) { return '<span>' + esc(t) + '</span><span aria-hidden="true">' + esc(t) + '</span>'; }
  function btn(label, href, cls, extra) {
    return '<a class="btn ' + (cls || 'btn-plasma') + ' sl" href="' + href + '"' + (extra || '') + '><span class="state" aria-hidden="true"></span>' +
      '<span class="lbl">' + lblHTML(label) + '</span>' + ICON.arrow + '</a>';
  }

  function keySpecs(p) {
    if (p.key) return p.key;
    return [['Battery', p.battery], ['Panel', p.panel], ['Backup', p.autonomy]];
  }

  let cardSeq = 0;
  function card(p, opts) {
    opts = opts || {};
    const href = 'contact.html?p=' + encodeURIComponent(p.id);
    const on = quote.has(p.id);
    const big = p.big || (p.watt ? p.watt + 'W' : '');
    const cat = (window.GS_CATEGORIES || []).find(function (c) { return c.id === p.cat; });
    const moreId = 'more-' + p.id + '-' + (++cardSeq);
    const n = PRODUCTS.indexOf(p) + 1;
    return '' +
      '<article class="card glass glass-edge' + (opts.feature ? ' is-feature' : '') + '" data-id="' + esc(p.id) + '" data-flip-id="' + esc(p.id) + '">' +
        '<div class="card-top"><span class="label">№ ' + (n < 10 ? '0' : '') + n + ' · ' + esc(cat ? cat.short || cat.name : '') + '</span>' +
          (p.badge ? '<span class="card-badge">' + esc(p.badge) + '</span>' : '') + '</div>' +
        '<a class="card-stage' + (p.blueprint ? ' blueprint' : '') + '" href="' + href + '" tabindex="-1" aria-hidden="true" data-cursor="Enquire">' +
          (big ? '<span class="card-watt cond">' + esc(big) + '</span>' : '') +
          '<img src="' + esc(p.img) + '" alt="" loading="lazy" decoding="async">' +
        '</a>' +
        '<div class="card-body">' +
          '<p class="card-part label">' + esc(p.part) + '</p>' +
          '<h3 class="card-title"><a href="' + href + '">' + esc(p.name) + '</a></h3>' +
          '<ul class="card-tags">' + (p.tags || []).map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ul>' +
          '<dl class="card-specs">' + keySpecs(p).map(function (s) {
            return '<div><dt>' + esc(s[0]) + '</dt><dd>' + esc(s[1]) + '</dd></div>';
          }).join('') + '</dl>' +
        '</div>' +
        '<div class="card-actions">' +
          btn('Enquire', href, 'btn-plasma btn-sm', ' aria-label="Enquire about ' + esc(p.name) + '"') +
          '<button class="icon-btn glass sl' + (on ? ' is-on' : '') + '" type="button" data-add="' + esc(p.id) + '" aria-pressed="' + on + '" aria-label="Add ' + esc(p.short || p.name) + ' to quote list"><span class="state" aria-hidden="true"></span>' + (on ? ICON.check : ICON.plus) + '</button>' +
          '<button class="icon-btn glass sl" type="button" data-more aria-expanded="false" aria-controls="' + moreId + '" aria-label="Full specifications: ' + esc(p.short || p.name) + '"><span class="state" aria-hidden="true"></span>' + ICON.chevron + '</button>' +
        '</div>' +
        '<div class="card-more" id="' + moreId + '"><div inert><dl>' + (p.specs || []).map(function (s) {
          return '<div><dt>' + esc(s[0]) + '</dt><dd>' + esc(s[1]) + '</dd></div>';
        }).join('') + '</dl></div></div>' +
      '</article>';
  }

  function syncAddButtons() {
    document.querySelectorAll('[data-add]').forEach(function (b) {
      const on = quote.has(b.dataset.add);
      b.classList.toggle('is-on', on);
      b.setAttribute('aria-pressed', on);
      const svg = b.querySelector('svg');
      if (svg) svg.outerHTML = on ? ICON.check : ICON.plus;
    });
  }
  document.addEventListener('gs:quote', syncAddButtons);
  // another tab changed the list, or this page came back from the back/forward cache
  function resync() { paintCount(false); document.dispatchEvent(new CustomEvent('gs:quote')); }
  addEventListener('storage', function (e) { if (e.key === KEY || e.key === null) resync(); });
  addEventListener('pageshow', function (e) { if (e.persisted) resync(); });

  /* ---------- snackbar ---------- */
  let toastTimer;
  const toastEl = document.createElement('div');
  toastEl.className = 'toast glass glass-strong';
  toastEl.setAttribute('role', 'status');
  toastEl.inert = true;
  document.body.appendChild(toastEl);
  function toast(msg, link) {
    toastEl.innerHTML = '<span>' + esc(msg) + '</span>' + (link ? btn(link.text, link.href, 'btn-volt btn-sm') : '');
    toastEl.inert = false;
    requestAnimationFrame(function () { toastEl.classList.add('is-on'); });
    clearTimeout(toastTimer);
    // stays while hovered or focused, so there's time to reach the link
    const hide = function () {
      if (toastEl.matches(':hover, :focus-within')) { toastTimer = setTimeout(hide, 1500); return; }
      toastEl.classList.remove('is-on'); toastEl.inert = true;
    };
    toastTimer = setTimeout(hide, 4200);
  }

  /* ---------- delegated clicks: quote list, spec drawers, ripples ---------- */
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
    const more = e.target.closest('[data-more]');
    if (more) {
      const c = more.closest('.card');
      const open = c.classList.toggle('is-open');
      more.setAttribute('aria-expanded', open);
      const body = c.querySelector('.card-more > div');
      if (body) body.inert = !open;
      if (window.ScrollTrigger) setTimeout(function () { window.ScrollTrigger.refresh(); }, 850);
    }
  });

  document.addEventListener('pointerdown', function (e) {
    const host = e.target.closest('.sl');
    if (!host || reduceMotion) return;
    const r = host.getBoundingClientRect();
    const size = Math.max(r.width, r.height) * 2.2;
    const s = document.createElement('span');
    s.className = 'ripple';
    s.style.cssText = 'width:' + size + 'px;height:' + size + 'px;left:' + (e.clientX - r.left - size / 2) + 'px;top:' + (e.clientY - r.top - size / 2) + 'px';
    host.appendChild(s);
    setTimeout(function () { s.remove(); }, 700);
  });

  /* ---------- liquid glass: the specular highlight follows the pointer ---------- */
  function glassLight() {
    if (!finePointer) return;
    let last = null;
    document.addEventListener('pointermove', function (e) {
      const g = e.target.closest && e.target.closest('.glass');
      if (last && last !== g) last.style.removeProperty('--gx');
      last = g;
      if (!g) return;
      const r = g.getBoundingClientRect();
      g.style.setProperty('--gx', (e.clientX - r.left).toFixed(0) + 'px');
      g.style.setProperty('--gy', (e.clientY - r.top).toFixed(0) + 'px');
    }, { passive: true });
  }

  // 3D tilt for product cards
  function tilt() {
    if (!finePointer || reduceMotion) return;
    document.addEventListener('pointermove', function (e) {
      const c = e.target.closest && e.target.closest('.card');
      if (!c || c.classList.contains('is-open')) return;
      const r = c.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5;
      c.style.transform = 'perspective(1000px) rotateX(' + (-y * 7).toFixed(2) + 'deg) rotateY(' + (x * 7).toFixed(2) + 'deg)';
    }, { passive: true });
    document.addEventListener('pointerout', function (e) {
      const c = e.target.closest && e.target.closest('.card');
      if (c && !c.contains(e.relatedTarget)) c.style.transform = '';
    });
  }

  /* ---------- custom cursor ---------- */
  function cursor() {
    if (!finePointer || reduceMotion || matchMedia('(forced-colors: active), (prefers-contrast: more)').matches) return;
    const el = document.createElement('div');
    el.className = 'cursor';
    el.setAttribute('aria-hidden', 'true');
    el.innerHTML = '<div class="cursor-ring"><span class="cursor-label"></span></div><div class="cursor-dot"></div>';
    document.body.appendChild(el);
    root.classList.add('has-cursor');
    const ring = el.querySelector('.cursor-ring'), dot = el.querySelector('.cursor-dot'), label = el.querySelector('.cursor-label');
    let x = -100, y = -100, rx = x, ry = y;
    (function loop() {
      rx += (x - rx) * .18; ry += (y - ry) * .18;
      ring.style.transform = 'translate(' + rx.toFixed(1) + 'px,' + ry.toFixed(1) + 'px)';
      dot.style.transform = 'translate(' + x + 'px,' + y + 'px)';
      requestAnimationFrame(loop);
    })();
    document.addEventListener('pointermove', function (e) {
      x = e.clientX; y = e.clientY;
      const t = e.target.closest ? e.target : null;
      const big = t && t.closest('[data-cursor]');
      const link = t && t.closest('a, button, [role="slider"], [role="radio"], label, select');
      el.classList.toggle('is-big', !!big);
      el.classList.toggle('is-link', !big && !!link);
      if (big) label.textContent = big.dataset.cursor;
      const field = t && t.closest('input, textarea, select, iframe');
      el.classList.toggle('is-hidden', !!field);
    }, { passive: true });
    document.addEventListener('pointerleave', function () { el.classList.add('is-hidden'); });
    document.addEventListener('pointerenter', function () { el.classList.remove('is-hidden'); });
  }

  /* ---------- smooth scroll (Lenis) driven by the GSAP ticker so ScrollTrigger stays in sync ---------- */
  let lenis = null;
  function smooth() {
    if (reduceMotion || !window.Lenis) return;
    lenis = new window.Lenis({ duration: 1.15, smoothWheel: true, wheelMultiplier: 1 });
    // the loading screen locks the page; keep Lenis still until it lifts
    if (root.classList.contains('is-loading')) { lenis.stop(); ready(function () { lenis.start(); }); }
    if (gsap) {
      lenis.on('scroll', function () { if (window.ScrollTrigger) window.ScrollTrigger.update(); });
      gsap.ticker.add(function (t) { lenis.raf(t * 1000); });
      gsap.ticker.lagSmoothing(0);
    } else {
      (function raf(t) { lenis.raf(t); requestAnimationFrame(raf); })(0);
    }
    document.addEventListener('click', function (e) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = e.target.closest('a[href*="#"]');
      if (!a || a.target === '_blank') return;
      const url = new URL(a.href, location.href);
      if (url.pathname !== location.pathname || !url.hash) return;
      let target = null;
      try { target = document.getElementById(decodeURIComponent(url.hash.slice(1))); } catch (err) { /* malformed hash */ }
      if (!target) return;
      e.preventDefault();
      lenis.scrollTo(target, { offset: -20 });
      history.pushState(null, '', url.hash);
      // move keyboard focus too, as a native jump would (skip link, in-page links)
      if (!target.matches('a[href], button, input, select, textarea, [tabindex]')) target.setAttribute('tabindex', '-1');
      target.focus({ preventScroll: true });
    });
  }
  function scrollToTop() {
    if (lenis) lenis.scrollTo(0); else scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
  }

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

  /* ---------- navigation ---------- */
  function nav() {
    const bar = document.querySelector('[data-nav]');
    if (!bar) return;
    let lastY = scrollY;
    addEventListener('scroll', function () {
      const y = scrollY, d = y - lastY;
      const menuOpen = document.getElementById('menu') && document.getElementById('menu').classList.contains('is-open');
      if (y < innerHeight * .6 || menuOpen) bar.classList.remove('is-hidden');
      else if (Math.abs(d) < 4) return; // too small to tell a direction (end of a smooth scroll): keep the state and the anchor
      else bar.classList.toggle('is-hidden', d > 0);
      lastY = y;
    }, { passive: true });
    // a keyboard user tabbing into the hidden bar brings it back
    bar.addEventListener('focusin', function () { bar.classList.remove('is-hidden'); });

    // Guwahati time in the bar
    const clock = bar.querySelector('[data-ist]');
    if (clock) {
      const paint = function () {
        const d = new Date(Date.now() + 330 * 60000);
        clock.textContent = String(d.getUTCHours()).padStart(2, '0') + ':' + String(d.getUTCMinutes()).padStart(2, '0');
      };
      paint();
      setInterval(paint, 20000);
    }

    const burger = bar.querySelector('.nav-burger');
    const menu = document.getElementById('menu');
    if (burger && menu) {
      const outside = function () {
        return Array.from(document.body.children).filter(function (n) { return n !== menu && n !== bar && !n.contains(bar) && n.tagName !== 'SCRIPT'; })
          .concat(Array.from(bar.querySelectorAll('a, button')).filter(function (n) { return n !== burger; }));
      };
      function setOpen(open) {
        const was = menu.classList.contains('is-open');
        burger.setAttribute('aria-expanded', open);
        menu.classList.toggle('is-open', open);
        menu.inert = !open;
        outside().forEach(function (n) { n.inert = open; });
        if (lenis) { if (open) lenis.stop(); else lenis.start(); }
        document.body.style.overflow = open ? 'hidden' : '';
        if (open && !was) { const first = menu.querySelector('a'); if (first) setTimeout(function () { first.focus(); }, 60); }
      }
      menu.inert = true;
      burger.addEventListener('click', function () { setOpen(burger.getAttribute('aria-expanded') !== 'true'); });
      menu.addEventListener('click', function (e) { if (e.target.closest('a')) setOpen(false); });
      addEventListener('keydown', function (e) { if (e.key === 'Escape' && menu.classList.contains('is-open')) { setOpen(false); burger.focus(); } });
      // the burger disappears above 1020px: never leave the menu open (and the page locked) behind it
      const wide = matchMedia('(min-width: 1021px)');
      const onWide = function () { if (wide.matches && menu.classList.contains('is-open')) setOpen(false); };
      if (wide.addEventListener) wide.addEventListener('change', onWide); else if (wide.addListener) wide.addListener(onWide);
    }
  }

  /* ---------- reveal on scroll ---------- */
  function reveals() {
    const els = document.querySelectorAll('.rv:not(.in)');
    if (!('IntersectionObserver' in window) || reduceMotion) { els.forEach(function (el) { el.classList.add('in'); }); return; }
    const io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } });
    }, { rootMargin: '0px 0px -8% 0px' });
    els.forEach(function (el) { io.observe(el); });
  }

  // a heading whose words are animated separately gets one plain, screen-reader-only copy of its text
  function labelHeading(el) {
    const h = el.closest('h1, h2, h3');
    if (!h || h.querySelector(':scope > [data-sr-copy]')) return;
    const text = h.textContent.replace(/\s+/g, ' ').trim();
    Array.from(h.children).forEach(function (c) { c.setAttribute('aria-hidden', 'true'); });
    h.insertAdjacentHTML('afterbegin', '<span class="sr-only" data-sr-copy>' + esc(text) + '</span>');
  }

  // split a heading into masked lines of characters and animate them in (GSAP SplitText)
  function splitIn(el, delay) {
    if (!el) return;
    if (!gsap || reduceMotion) { el.style.opacity = 1; return; }
    // gradient text can't be split (background-clip doesn't survive per-letter transforms): slide the word up as one
    if (!window.SplitText || el.classList.contains('grad')) {
      labelHeading(el);
      gsap.set(el, { opacity: 1 });
      gsap.from(el, { yPercent: 110, duration: 1.2, ease: 'expo.out', delay: (delay || 0) + .1 });
      return;
    }
    gsap.registerPlugin(window.SplitText);
    labelHeading(el);
    const go = function () {
      const split = new window.SplitText(el, { type: 'lines,chars', linesClass: 'line-mask', charsClass: 'ch', aria: 'hidden' });
      gsap.set(el, { opacity: 1 });
      gsap.from(split.chars, { yPercent: 115, rotate: 6, duration: 1.1, ease: 'expo.out', stagger: .018, delay: delay || 0 });
    };
    if (document.fonts && document.fonts.status !== 'loaded') document.fonts.ready.then(go); else go();
  }

  function magnetic() {
    if (!finePointer || reduceMotion) return;
    document.querySelectorAll('[data-magnetic]').forEach(function (el) {
      el.addEventListener('pointermove', function (e) {
        const r = el.getBoundingClientRect();
        el.style.transform = 'translate(' + ((e.clientX - r.left - r.width / 2) * .25) + 'px,' + ((e.clientY - r.top - r.height / 2) * .35) + 'px)';
      });
      el.addEventListener('pointerleave', function () { el.style.transform = ''; });
    });
  }

  function lightbox() {
    const dlg = document.querySelector('[data-lightbox]');
    if (!dlg || typeof dlg.showModal !== 'function') return;
    const img = dlg.querySelector('img');
    document.querySelectorAll('[data-cert]').forEach(function (b) {
      b.addEventListener('click', function () { img.src = b.dataset.cert; img.alt = b.dataset.alt || ''; dlg.showModal(); if (lenis) lenis.stop(); });
    });
    dlg.querySelector('button').addEventListener('click', function () { dlg.close(); });
    dlg.addEventListener('click', function (e) { if (e.target === dlg) dlg.close(); });
    dlg.addEventListener('close', function () { if (lenis) lenis.start(); });
  }

  // Chromium can refract the backdrop through an SVG displacement filter; elsewhere glass stays frosted
  if (window.chrome && CSS.supports && CSS.supports('backdrop-filter', 'url(#lg-refract)') && document.getElementById('lg-refract')) {
    root.classList.add('lg-refract');
  }

  /* ---------- "Pause motion": stops the looping animations (tickers, marquee, drifting light, the sun) ---------- */
  let motionPaused = false;
  function motionToggle() {
    try { motionPaused = localStorage.getItem('gs-motion') === 'paused'; } catch (e) { /* storage blocked */ }
    const btns = document.querySelectorAll('[data-motion-toggle]');
    const apply = function () {
      root.classList.toggle('motion-paused', motionPaused);
      btns.forEach(function (b) { b.setAttribute('aria-pressed', motionPaused); });
      document.dispatchEvent(new CustomEvent('gs:motion', { detail: { paused: motionPaused } }));
    };
    btns.forEach(function (b) {
      b.addEventListener('click', function () {
        motionPaused = !motionPaused;
        try { localStorage.setItem('gs-motion', motionPaused ? 'paused' : 'on'); } catch (e) { /* not persisted */ }
        apply();
      });
    });
    apply();
  }

  document.querySelectorAll('[data-top]').forEach(function (b) { b.addEventListener('click', scrollToTop); });

  fillConfig();
  enhance();
  paintCount(false);
  smooth();
  nav();
  reveals();
  glassLight();
  tilt();
  cursor();
  magnetic();
  lightbox();
  motionToggle();

  window.GS = {
    config: CFG, products: PRODUCTS, byId: byId, quote: quote, card: card, btn: btn, esc: esc, icon: ICON, toast: toast,
    reduceMotion: reduceMotion, finePointer: finePointer, reveals: reveals, enhance: enhance, splitIn: splitIn, ready: ready,
    get lenis() { return lenis; },
    get motionPaused() { return motionPaused; }
  };
})();
