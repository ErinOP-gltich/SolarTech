/* The Wattage Dial — the hero instrument of the Marketplace.
   A machined rotary control that steps through the semi-integrated street lights. Turn it
   (drag with mouse or touch, scroll, or use the arrow keys) and the lamp on the bench lights
   up in proportion while the readout rolls to the new figures.

     const dial = GSDial.mount(rootEl, {
       products,            // the semi-integrated street lights (sorted by watt here anyway);
                            // defaults to window.GS_PRODUCTS ids matching /^si-\d+w$/
       onChange(product),   // called whenever the selected light changes (user input or set())
       contactHref(id),     // link for "Enquire about the …" (default: 'contact.html?p=' + id)
       initial              // optional starting id (default: the 40 W, else the middle stop)
     });
     dial.set('si-80w');    // also accepts a wattage: dial.set(80)
     dial.get();            // -> the selected product
     dial.destroy();

   Works without GSAP or anything else. Honours prefers-reduced-motion (no intro, no inertia,
   no overshoot, no drifting dust — every change is instant). */
(function () {
  'use strict';

  var A0 = -135;                 // scale starts at 7:30 …
  var SWEEP = 270;               // … and runs clockwise through 12 to 4:30
  var EFFICACY = 155;            // OSRAM LEDs, lm/W
  var GEO = '[ 26.12°N 91.68°E ]';
  var EASE = 'cubic-bezier(.16,1,.3,1)';
  var MARK_RAY = 'M-27,-118 C-36,-168 -14,-214 44,-242 C24,-206 22,-166 27,-118 Z';
  var mq = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  var uid = 0;

  /* ---------------------------------------------------------------- helpers */
  function reduced() { return !!(mq && mq.matches); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function r2(v) { return Math.round(v * 100) / 100; }
  function now() { return window.performance && performance.now ? performance.now() : Date.now(); }
  function pad(n, len) { var s = String(n); while (s.length < len) s = '0' + s; return s; }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function fmt(n) { try { return Math.round(n).toLocaleString('en-IN'); } catch (e) { return String(Math.round(n)); } }
  function numIn(s, re) { var m = String(s || '').match(re); return m ? parseFloat(m[1]) : NaN; }
  function polar(r, a) { var t = a * Math.PI / 180; return [r * Math.sin(t), -r * Math.cos(t)]; }
  function arcD(r, a0, a1) {
    var p = polar(r, a0), q = polar(r, a1);
    return 'M' + r2(p[0]) + ' ' + r2(p[1]) + 'A' + r + ' ' + r + ' 0 ' + (a1 - a0 > 180 ? 1 : 0) + ' 1 ' + r2(q[0]) + ' ' + r2(q[1]);
  }
  function radial(r0, r1, a) {
    var p = polar(r0, a), q = polar(r1, a);
    return 'M' + r2(p[0]) + ' ' + r2(p[1]) + 'L' + r2(q[0]) + ' ' + r2(q[1]);
  }
  // the signature plasma, sampled along 0..1
  var PL = [[0, [255, 59, 31]], [0.3, [255, 122, 0]], [0.65, [255, 196, 0]], [1, [255, 241, 184]]];
  function plasma(t) {
    t = clamp(t, 0, 1);
    for (var k = 1; k < PL.length; k++) {
      if (t <= PL[k][0]) {
        var a = PL[k - 1], b = PL[k], u = (t - a[0]) / (b[0] - a[0]);
        return 'rgb(' + [0, 1, 2].map(function (j) { return Math.round(a[1][j] + (b[1][j] - a[1][j]) * u); }).join(',') + ')';
      }
    }
    return 'rgb(255,241,184)';
  }
  function easeInOut(u) { return u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2; }
  function animate(el, frames, o) {
    if (!el || !el.animate || reduced()) return null;
    try { return el.animate(frames, o); } catch (e) { return null; }
  }

  /* ---------------------------------------------------------------- markup */
  function raysSVG(id) {
    var s = '<svg class="dk-rays" viewBox="-260 -260 520 520" aria-hidden="true" focusable="false"><defs>' +
      '<linearGradient id="' + id + '-ray" x1="0" y1="-118" x2="0" y2="-242" gradientUnits="userSpaceOnUse">' +
      '<stop offset="0" stop-color="#FF3B1F"/><stop offset=".55" stop-color="#FF7A00"/><stop offset="1" stop-color="#FFC400"/></linearGradient></defs><g fill="url(#' + id + '-ray)">';
    for (var i = 0; i < 12; i++) s += '<path d="' + MARK_RAY + '" transform="rotate(' + (i * 30) + ')"/>';
    return s + '</g></svg>';
  }
  function coreSVG(id) {
    return '<svg class="dk-core" viewBox="-260 -260 520 520" aria-hidden="true" focusable="false"><defs>' +
      '<radialGradient id="' + id + '-core" cx="-.18" cy="-.22" r="1.05">' +
      '<stop offset="0" stop-color="#FFF1B8"/><stop offset=".38" stop-color="#FFC400"/><stop offset=".72" stop-color="#FF7A00"/><stop offset="1" stop-color="#FF3B1F"/></radialGradient>' +
      '<radialGradient id="' + id + '-cglow"><stop offset=".55" stop-color="#FFC400" stop-opacity=".55"/><stop offset="1" stop-color="#FF7A00" stop-opacity="0"/></radialGradient></defs>' +
      '<circle class="dk-core-glow" r="150" fill="url(#' + id + '-cglow)"/>' +
      '<circle r="112" fill="#050507" stroke="#FFC400" stroke-width="3"/>' +
      '<circle r="98" fill="url(#' + id + '-core)"/>' +
      '<g fill="none" stroke="#050507" stroke-width="17" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M-27,-58 V-30 M27,-58 V-30"/><path d="M-56,-6 C-56,40 -30,52 0,52 C30,52 56,40 56,-6"/><path d="M0,52 V66"/></g></svg>';
  }

  // engraved legend around the hub (fixed, like the maker's mark on a machined face)
  function engraveSVG(id) {
    var t = 'GREEN SUN TECHNOLOGIES \u00b7 GUWAHATI \u00b7 OSRAM 155 LM/W \u00b7 IP66 \u00b7 LiFePO\u2084 \u00b7 ';
    return '<svg class="dk-engr" viewBox="-200 -200 400 400" aria-hidden="true" focusable="false"><defs>' +
      '<path id="' + id + '-eng" d="M0,-98 A98,98 0 1 1 -0.01,-98"/></defs>' +
      '<circle class="dk-engr-ring" r="110"/><circle class="dk-engr-ring" r="86"/>' +
      '<text class="dk-engr-sh"><textPath href="#' + id + '-eng" textLength="606" lengthAdjust="spacing">' + t + '</textPath></text>' +
      '<text class="dk-engr-t"><textPath href="#' + id + '-eng" textLength="606" lengthAdjust="spacing">' + t + '</textPath></text></svg>';
  }

  function scaleSVG(id, items, step) {
    var n = items.length, span = Math.max(1, n - 1), s = '', k, a;
    var R_TRACK = 222;
    s += '<svg class="dk-scale" viewBox="-300 -300 600 600" aria-hidden="true" focusable="false">';

    // machined rings + crosshair marks
    s += '<circle class="dk-ring" r="294"/><circle class="dk-ring" r="289"/><circle class="dk-ring dk-ring--2" r="211"/><circle class="dk-ring" r="206"/>';
    var cross = '';
    [0, 90, 180, 270].forEach(function (d) { cross += radial(296, 306, d) + radial(198, 204, d); });
    s += '<path class="dk-cross" d="' + cross + '"/>';

    // fine graduation every 1.5° + minor ticks between stops
    var grad = '';
    for (a = A0; a <= A0 + SWEEP + 0.01; a += 1.5) grad += radial(283, (Math.round((a - A0) / 1.5) % 5 === 0) ? 289 : 286, a);
    s += '<path class="dk-grad" d="' + grad + '"/>';
    var minor = '';
    for (k = 0; k < n - 1; k++) for (var m = 1; m < 5; m++) minor += radial(238, 246, A0 + (k + m / 5) * step);
    s += '<path class="dk-min" d="' + minor + '"/>';

    // track (the plasma level arc itself is a pre-rendered canvas, see drawArc)
    s += '<path class="dk-track" d="' + arcD(R_TRACK, A0, A0 + SWEEP) + '"/>';

    // major ticks + labels
    for (k = 0; k < n; k++) {
      a = A0 + k * step;
      var p = polar(266, a);
      s += '<path class="dk-maj" data-i="' + k + '" style="--c:' + plasma(k / span) + ';--i:' + k + '" d="' + radial(230, 252, a) + '"/>';
      s += '<text class="dk-lab" data-i="' + k + '" style="--i:' + k + '" x="' + r2(p[0]) + '" y="' + r2(p[1]) + '">' + esc(items[k].watt) + '</text>';
    }

    // legend in the gap at the bottom
    var mn = polar(250, A0 - 13), mx = polar(250, A0 + SWEEP + 13);
    s += '<text class="dk-leg" x="' + r2(mn[0]) + '" y="' + r2(mn[1]) + '">MIN</text>';
    s += '<text class="dk-leg" x="' + r2(mx[0]) + '" y="' + r2(mx[1]) + '">MAX</text>';
    s += '<text class="dk-leg dk-leg--hot" x="0" y="246">WATTS</text>';

    s += '<circle class="dk-focus" r="300"/>';
    return s + '</svg>';
  }

  function template(id, items, step, cnt) {
    var digits = String(items[items.length - 1].watt).length, num = '', d, k;
    for (d = 0; d < digits; d++) {
      num += '<span class="dr-dig"><span class="dr-strip">';
      for (k = 0; k < 10; k++) num += '<i>' + k + '</i>';
      num += '</span></span>';
    }
    var bars = '';
    for (k = 0; k < 12; k++) bars += '<i></i>';
    return '' +
      '<i class="dial-x dial-x--tl"></i><i class="dial-x dial-x--tr"></i><i class="dial-x dial-x--bl"></i><i class="dial-x dial-x--br"></i>' +
      '<div class="dial-inst">' +
        '<div class="dial-ann dial-ann--tl dial-mono"><i class="dial-led" aria-hidden="true"></i><span>Output select</span></div>' +
        '<div class="dial-ann dial-ann--tr dial-mono"><span>' + pad(cnt, 2) + ' stops · <b>' + esc(items[0].watt) + '–' + esc(items[items.length - 1].watt) + ' W</b></span></div>' +
        '<div class="dial-knob" role="slider" tabindex="0" aria-label="Street light wattage" aria-describedby="' + id + '-help">' +
          scaleSVG(id, items, step) +
          '<canvas class="dk-arc" aria-hidden="true"></canvas>' +
          '<i class="dk-tip" aria-hidden="true"><b></b></i>' +
          '<div class="dk-cap">' +
            '<i class="dk-shadow"></i><i class="dk-grip"></i><i class="dk-shade"></i><i class="dk-face"></i>' + engraveSVG(id) +
            '<i class="dk-ind"><i></i><b class="dk-spark"></b></i>' +
            '<i class="dk-bloom"></i>' + raysSVG(id) + coreSVG(id) + '<i class="dk-gloss"></i>' +
          '</div>' +
        '</div>' +
        '<div class="dial-ann dial-ann--bl dial-mono" aria-hidden="true"><span class="dial-hint-fine">Drag · Scroll</span><span class="dial-hint-fine dial-keys"><kbd>←</kbd><kbd>→</kbd></span><span class="dial-hint-touch">Turn the dial · Tap a number</span></div>' +
        '<div class="dial-ann dial-ann--br dial-mono" aria-hidden="true">' + GEO + '</div>' +
        '<p class="dial-sr" id="' + id + '-help">Use the arrow keys to step through the wattages, Home and End for the lowest and highest.</p>' +
      '</div>' +
      '<div class="dial-bench">' +
        '<figure class="dial-stage">' +
          '<div class="ds-light" aria-hidden="true"><i class="ds-bloom"></i><i class="ds-cone ds-cone--w"></i><i class="ds-rays"></i><i class="ds-cone ds-cone--h"></i><i class="ds-pool"></i><i class="ds-emit"></i></div>' +
          '<i class="ds-floor" aria-hidden="true"></i><i class="ds-horizon" aria-hidden="true"></i>' +
          '<canvas class="ds-dust" aria-hidden="true"></canvas>' +
          '<i class="ds-ruler" aria-hidden="true"></i><i class="ds-ruler ds-ruler--r" aria-hidden="true"></i>' +
          '<div class="ds-hang"><i class="ds-cable" aria-hidden="true"></i><div class="ds-lamp">' +
            '<img class="ds-img" alt="" decoding="async" draggable="false"><img class="ds-img" alt="" decoding="async" draggable="false"><i class="ds-rim" aria-hidden="true"></i>' +
          '</div></div>' +
          '<div class="ds-fx" aria-hidden="true"><i class="ds-glare"></i><i class="ds-flare"></i></div>' +
          '<div class="ds-ann ds-ann--tl" aria-hidden="true"><span class="dial-mono">Fig. <b data-fig>01</b></span><span class="dial-mono" data-part-s></span></div>' +
          '<div class="ds-ann ds-ann--tr" aria-hidden="true"><span class="dial-mono">Beam</span><span class="dial-mono"><b data-pct>0</b>% of max</span></div>' +
          '<figcaption class="ds-ann ds-ann--bl"><span class="dial-mono">OSRAM LED · 155 lm/W</span><span class="dial-mono">Beam shown is illustrative</span></figcaption>' +
          '<div class="ds-ann ds-ann--br" aria-hidden="true"><span class="dial-mono">IP66</span><span class="dial-mono">Dusk → dawn</span></div>' +
        '</figure>' +
        '<div class="dial-read">' +
          '<div class="dr-top dial-mono"><span>№ <b data-idx>01</b> / ' + pad(cnt, 2) + '</span><span>Semi-integrated · street</span></div>' +
          '<div class="dr-head">' +
            '<div class="dr-num" aria-hidden="true">' + num + '</div>' +
            '<div class="dr-side">' +
              '<span class="dr-unit" aria-hidden="true"><b>W</b><span class="dial-mono">Rated<br>power</span></span>' +
              '<p class="dr-name" data-name></p>' +
              '<p class="dr-part dial-mono">Part № <b data-part></b></p>' +
            '</div>' +
          '</div>' +
          '<dl class="dr-specs">' +
            '<div class="dr-spec dr-spec--lm"><dt class="dial-mono">Lumens</dt><dd><span class="v" data-lm>0</span><small>LED output @155 lm/W</small></dd><i class="dr-bar" aria-hidden="true"><i data-bar="lm"></i></i></div>' +
            '<div class="dr-spec"><dt class="dial-mono">Battery</dt><dd><span class="v" data-battery></span><small data-chem></small><i class="dr-bar" aria-hidden="true"><i data-bar="ah"></i></i></dd></div>' +
            '<div class="dr-spec"><dt class="dial-mono">Panel</dt><dd><span class="v" data-panel></span><small data-ptype></small><i class="dr-bar" aria-hidden="true"><i data-bar="wp"></i></i></dd></div>' +
            '<div class="dr-spec"><dt class="dial-mono">Backup</dt><dd><span class="v" data-backup></span><small>Autonomy</small></dd></div>' +
            '<div class="dr-spec"><dt class="dial-mono">Optic</dt><dd><span class="v" data-optic></span><small data-ip></small></dd></div>' +
          '</dl>' +
          '<div class="dr-night" aria-label="Night profile: 6 hours at 100 percent, then 6 hours at 50 percent" role="img">' +
            '<span class="dial-mono">Dusk</span><span class="dr-night-bars">' + bars + '</span><span class="dial-mono">Dawn</span>' +
            '<span class="dr-night-cap dial-mono"><span>6 h · 100%</span><span>6 h · 50%</span></span>' +
          '</div>' +
          '<div class="dr-actions">' +
            '<a class="dr-cta" data-cta href="#"><span data-cta-t></span><span class="dr-arrow" aria-hidden="true">→</span></a>' +
            '<button class="dr-add" type="button" data-add-q aria-pressed="false" hidden><span class="dr-ic" aria-hidden="true"></span><span data-add-t>Add to quote</span></button>' +
          '</div>' +
        '</div>' +
      '</div>';
  }

  var ICON_PLUS = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>';
  var ICON_CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7"/></svg>';

  /* ================================================================= mount */
  function mount(root, opts) {
    if (!root) throw new Error('GSDial.mount: no root element');
    if (root.__gsdial) root.__gsdial.destroy();
    opts = opts || {};

    var src = opts.products && opts.products.length ? opts.products
      : (window.GS_PRODUCTS || []).filter(function (p) { return /^si-\d+w$/.test(p.id); });
    var items = src.filter(function (p) { return p && isFinite(p.watt) && p.watt > 0; })
      .slice().sort(function (a, b) { return a.watt - b.watt; });
    var n = items.length;
    var api = { set: function () {}, get: function () { return null; }, destroy: function () {} };
    if (!n) { root.innerHTML = ''; return api; }

    var id = 'gsd' + (++uid);
    var span = Math.max(1, n - 1);
    var step = n > 1 ? SWEEP / (n - 1) : 0;
    var hrefFor = typeof opts.contactHref === 'function' ? opts.contactHref : function (pid) { return 'contact.html?p=' + encodeURIComponent(pid); };
    var onChange = typeof opts.onChange === 'function' ? opts.onChange : null;
    var wMin = items[0].watt, wMax = items[n - 1].watt;
    var lmMax = wMax * EFFICACY;
    var ahMax = 0, wpMax = 0;
    items.forEach(function (p) {
      ahMax = Math.max(ahMax, numIn(p.battery, /(\d+(?:\.\d+)?)\s*Ah/i) || 0);
      wpMax = Math.max(wpMax, numIn(p.panel, /(\d+(?:\.\d+)?)\s*Wp/i) || 0);
    });

    function indexOf(key) {
      for (var k = 0; k < n; k++) if (items[k].id === key || (typeof key === 'number' && items[k].watt === key)) return k;
      return -1;
    }
    var start = indexOf(opts.initial);
    if (start < 0) start = indexOf('si-40w');
    if (start < 0) start = Math.floor((n - 1) / 2);

    root.classList.add('dial');
    root.innerHTML = template(id, items, step, n);

    var $ = function (s) { return root.querySelector(s); };
    var $$ = function (s) { return Array.prototype.slice.call(root.querySelectorAll(s)); };
    var knob = $('.dial-knob'), cap = $('.dk-cap');
    var grip = $('.dk-grip'), ind = $('.dk-ind'), rays = $('.dk-rays'), spark = $('.dk-spark');
    var arcCv = $('.dk-arc'), tip = $('.dk-tip');
    var majors = $$('.dk-maj'), labels = $$('.dk-lab');
    var stage = $('.dial-stage'), hang = $('.ds-hang'), imgs = $$('.ds-img'), canvas = $('.ds-dust');
    var strips = $$('.dr-strip'), digs = $$('.dr-dig');
    var el = {
      name: $('[data-name]'), part: $('[data-part]'), partS: $('[data-part-s]'), fig: $('[data-fig]'), idx: $('[data-idx]'), pct: $('[data-pct]'),
      lm: $('[data-lm]'), battery: $('[data-battery]'), chem: $('[data-chem]'), panel: $('[data-panel]'), ptype: $('[data-ptype]'),
      backup: $('[data-backup]'), optic: $('[data-optic]'), ip: $('[data-ip]'),
      cta: $('[data-cta]'), ctaT: $('[data-cta-t]'), add: $('[data-add-q]'), addT: $('[data-add-t]'),
      barLm: $('[data-bar="lm"]'), barAh: $('[data-bar="ah"]'), barWp: $('[data-bar="wp"]')
    };
    knob.setAttribute('aria-valuemin', wMin);
    knob.setAttribute('aria-valuemax', wMax);

    // preload every photo so swaps are instant
    var seen = {};
    items.forEach(function (p) { if (p.img && !seen[p.img]) { seen[p.img] = 1; var im = new Image(); im.decoding = 'async'; im.src = p.img; } });

    /* ---------- state ---------- */
    var value = -1;          // committed index (aria, onChange)
    var shown = -1;          // index the readout shows
    var target = start;      // where the spring is heading
    var pos = start;         // continuous knob position, in stops
    var vel = 0;             // stops / s
    var zeta = 0.5;          // spring damping ratio for the current move
    var detent = -1;         // last stop the knob passed
    var drag = null, intro = null, raf = 0, last = 0, lastA = null, lastLv = -1;
    var lm = { val: 0, from: 0, to: 0, t0: 0, on: false };
    var imgOn = 0, imgSrc = '', imgToken = 0, swingAnim = null;
    var wheelAcc = 0, wheelLast = 0, wheelStep = 0, wheelPass = 0, pageScrollAt = 0;
    var dust = null, visible = false, destroyed = false;
    var cleanups = [];
    function on(t, ev, fn, o) { t.addEventListener(ev, fn, o || false); cleanups.push(function () { t.removeEventListener(ev, fn, o || false); }); }

    /* ---------- readout ---------- */
    function swap(node, html) {
      if (!node || node.innerHTML === html) return;
      node.innerHTML = html;
      animate(node, [{ opacity: 0, transform: 'translateY(.5em)' }, { opacity: 1, transform: 'none' }], { duration: 480, easing: EASE });
    }
    function nameHTML(p) {
      var rest = String(p.name || '').replace(/^\s*\d+(?:\.\d+)?\s*W\s*/i, '');
      var m = rest.match(/^(.*?)\s+(Solar\b.*)$/i);
      return m ? '<span class="dr-name-a">' + esc(m[1]) + '</span> <em>' + esc(m[2].toLowerCase()) + '</em>' : '<span class="dr-name-a">' + esc(rest || p.name) + '</span>';
    }
    function setBar(node, frac) { if (node) node.style.setProperty('--p', isFinite(frac) ? clamp(frac, 0, 1).toFixed(4) : '0'); }

    function show(i, dir) {
      if (i === shown) return;
      var first = shown < 0;
      shown = i;
      var p = items[i];
      var s = pad(p.watt, strips.length), lead = true;
      for (var d = 0; d < strips.length; d++) {
        var ch = +s.charAt(d);
        if (ch !== 0 || d === strips.length - 1) lead = false;
        strips[d].style.transform = 'translateY(' + (-ch * 10) + '%)';
        digs[d].classList.toggle('is-ghost', lead);
      }
      var put = first ? function (node, html) { if (node) node.innerHTML = html; } : swap;
      put(el.name, nameHTML(p));
      put(el.part, esc(p.part || ''));
      if (el.partS) el.partS.textContent = p.part || '';
      el.fig.textContent = pad(i + 1, 2);
      el.idx.textContent = pad(i + 1, 2);
      put(el.battery, esc(p.battery || '—'));
      put(el.chem, esc(p.chem || ''));
      put(el.panel, esc(p.panel || '—'));
      var specTxt = (p.specs || []).map(function (x) { return x.join(' '); }).join(' ');
      put(el.ptype, /polycrystalline/i.test(specTxt) ? 'Polycrystalline' : '');
      put(el.backup, esc(p.autonomy || '—'));
      put(el.optic, esc(p.optic || '—'));
      put(el.ip, esc(p.ip ? p.ip + ' housing' : ''));
      setBar(el.barLm, p.watt * EFFICACY / lmMax);
      setBar(el.barAh, numIn(p.battery, /(\d+(?:\.\d+)?)\s*Ah/i) / ahMax);
      setBar(el.barWp, numIn(p.panel, /(\d+(?:\.\d+)?)\s*Wp/i) / wpMax);
      el.ctaT.textContent = 'Enquire about the ' + p.watt + 'W';
      el.cta.setAttribute('href', hrefFor(p.id));
      el.cta.setAttribute('aria-label', 'Enquire about the ' + p.name);
      // lumens count to the new figure
      lm.from = lm.val; lm.to = p.watt * EFFICACY; lm.t0 = now();
      if (first || reduced()) { lm.val = lm.to; lm.on = false; paintLm(); } else { lm.on = true; kick(); }
      // scale labels + lit ticks
      for (var k = 0; k < n; k++) {
        majors[k].classList.toggle('is-lit', k <= i);
        labels[k].classList.toggle('is-lit', k < i);
        labels[k].classList.toggle('is-cur', k === i);
      }
      var changed = setImg(p);
      if (!first) swing(dir || 1, changed);
      syncAdd();
    }
    function paintLm() {
      el.lm.innerHTML = fmt(lm.val) + '<span>lm</span>';
      el.pct.textContent = Math.round(lm.val / lmMax * 100);
    }

    /* ---------- the lamp photo: A/B cross-fade ---------- */
    function setImg(p) {
      var url = p.img || '';
      var cur = imgs[imgOn];
      if (url === imgSrc) { cur.alt = p.name; return false; }
      imgSrc = url;
      var nxt = imgs[imgOn ^ 1], token = ++imgToken;
      function go() {
        if (token !== imgToken || destroyed) return;
        nxt.alt = p.name; cur.alt = '';
        nxt.classList.add('is-on'); cur.classList.remove('is-on');
        imgOn ^= 1;
      }
      nxt.onload = nxt.onerror = null;
      nxt.src = url;
      if (nxt.complete && nxt.naturalWidth) go(); else { nxt.onload = go; nxt.onerror = go; }
      return true;
    }
    function swing(dir, big) {
      if (!hang.animate || reduced()) return;
      if (swingAnim) swingAnim.cancel();
      var a = (big ? 2.6 : 1.6) * (dir > 0 ? 1 : -1);
      swingAnim = animate(hang, [
        { transform: 'rotate(0deg)' },
        { transform: 'rotate(' + a + 'deg)', offset: 0.16 },
        { transform: 'rotate(' + (-a * 0.55) + 'deg)', offset: 0.42 },
        { transform: 'rotate(' + (a * 0.24) + 'deg)', offset: 0.68 },
        { transform: 'rotate(' + (-a * 0.08) + 'deg)', offset: 0.86 },
        { transform: 'rotate(0deg)' }
      ], { duration: 1700, easing: 'cubic-bezier(.3,.6,.4,1)' });
    }

    /* ---------- quote list (window.GS.quote, when the site provides it) ---------- */
    function quoteApi() { var G = window.GS; return G && G.quote && typeof G.quote.add === 'function' ? G.quote : null; }
    function inQuote(q, pid) {
      try { if (typeof q.has === 'function') return !!q.has(pid); if (typeof q.list === 'function') return q.list().some(function (x) { return x.id === pid; }); } catch (e) { /* ignore */ }
      return false;
    }
    function syncAdd() {
      var q = quoteApi(), p = items[shown < 0 ? start : shown];
      el.add.hidden = !q;
      if (!q || !p) return;
      var isOn = inQuote(q, p.id);
      el.add.setAttribute('aria-pressed', isOn ? 'true' : 'false');
      el.add.setAttribute('aria-label', 'Add the ' + p.name + ' to your quote list');
      el.add.querySelector('.dr-ic').innerHTML = isOn ? ICON_CHECK : ICON_PLUS;
      el.addT.textContent = isOn ? 'In your quote' : 'Add to quote';
    }
    function toggleQuote() {
      var q = quoteApi(), p = items[shown];
      if (!q || !p) return;
      var G = window.GS, msg;
      if (inQuote(q, p.id)) { q.remove(p.id); msg = (p.short || p.name) + ' removed from your quote list'; }
      else { q.add(p.id, 1); msg = (p.short || p.name) + ' added to your quote list'; }
      syncAdd();
      try { if (G && typeof G.toast === 'function') G.toast(msg, { href: 'contact.html', text: 'Get quote' }); } catch (e) { /* optional */ }
    }

    /* ---------- commit ---------- */
    function setAria(i) {
      var p = items[i];
      knob.setAttribute('aria-valuenow', p.watt);
      knob.setAttribute('aria-valuetext', p.watt + ' watts, ' + p.name);
    }
    function commit(i, dir) {
      if (i === value) return;
      var prev = value;
      value = i;
      var p = items[i];
      setAria(i);
      show(i, dir || (prev < 0 ? 1 : i > prev ? 1 : -1));
      if (onChange && prev >= 0) {
        try { onChange(p); } catch (err) { setTimeout(function () { throw err; }); }
      }
    }
    function go(i, how) {
      i = clamp(Math.round(i), 0, n - 1);
      disarm();
      cancelIntro();
      var dir = i > target ? 1 : i < target ? -1 : 0;
      target = i;
      commit(i, dir);
      if (reduced()) { pos = i; vel = 0; paint(); return; }
      zeta = clamp(0.42 + Math.abs(target - pos) * 0.07, 0.42, 0.9);
      if (how === 'drag') zeta = clamp(zeta - 0.04, 0.38, 0.9);
      kick();
    }

    /* ---------- the frame loop ---------- */
    function levelAt(q) {
      q = clamp(q, 0, n - 1);
      var i0 = Math.floor(q), i1 = Math.min(n - 1, i0 + 1), f = q - i0;
      var w = items[i0].watt + (items[i1].watt - items[i0].watt) * f;
      return Math.pow((w - wMin) / ((wMax - wMin) || 1), 0.85);
    }
    function click(i) {
      animate(spark, [{ opacity: 1, transform: 'scale(.5)' }, { opacity: 0, transform: 'scale(2.1)' }], { duration: 420, easing: 'cubic-bezier(.2,.7,.3,1)' });
      if (majors[i]) animate(majors[i], [{ strokeWidth: 6, stroke: '#FFF8DA' }, { strokeWidth: 2.4 }], { duration: 380, easing: 'ease-out' });
    }
    function paint() {
      var a = A0 + pos * step;
      if (a !== lastA) {
        lastA = a;
        var tr = 'rotate(' + a.toFixed(3) + 'deg)';
        grip.style.transform = tr; ind.style.transform = tr; rays.style.transform = tr;
        var frac = clamp(pos / span, 0, 1);
        arcCv.style.setProperty('--sw', (frac * SWEEP).toFixed(2) + 'deg');
        tip.style.transform = 'rotate(' + clamp(a, A0, A0 + SWEEP).toFixed(3) + 'deg)';
        tip.style.opacity = frac < 0.002 ? '0' : '1';
      }
      var lv = levelAt(pos);
      if (Math.abs(lv - lastLv) > 0.0005) { lastLv = lv; root.style.setProperty('--lv', lv.toFixed(4)); }
      var d = clamp(Math.round(pos), 0, n - 1);
      if (d !== detent) {
        var had = detent >= 0;
        detent = d;
        if (had && !reduced()) click(d);
        if (drag && drag.active) commit(d);
        else if (intro) show(d, 1);
      }
    }
    function kick() { if (!raf && !destroyed) { last = now(); raf = requestAnimationFrame(frame); } }
    function frame(t) {
      raf = 0;
      if (destroyed) return;
      var dt = clamp((t - last) / 1000, 0.001, 0.05);
      last = t;
      var busy = false;
      if (intro) {
        busy = stepIntro(t);
      } else if (drag && drag.active) {
        var np = pos + (drag.goal - pos) * (1 - Math.exp(-dt * 34));
        vel = (np - pos) / dt; pos = np; busy = true;
      } else if (pos !== target || vel !== 0) {
        var K = 230, c = 2 * zeta * Math.sqrt(K), steps = Math.ceil(dt * 240), h = dt / steps;
        for (var s = 0; s < steps; s++) { var acc = -K * (pos - target) - c * vel; vel += acc * h; pos += vel * h; }
        if (pos < -0.32) { pos = -0.32; vel = 0; } else if (pos > n - 1 + 0.32) { pos = n - 1 + 0.32; vel = 0; }
        if (Math.abs(pos - target) < 0.0008 && Math.abs(vel) < 0.01) { pos = target; vel = 0; } else busy = true;
      }
      paint();
      if (lm.on) {
        var u = clamp((t - lm.t0) / 750, 0, 1), e = u >= 1 ? 1 : 1 - Math.pow(2, -10 * u);
        lm.val = lm.from + (lm.to - lm.from) * e;
        if (u >= 1) { lm.val = lm.to; lm.on = false; } else busy = true;
        paintLm();
      }
      if (dust && dust.run) { stepDust(dt); busy = true; }
      if (busy) raf = requestAnimationFrame(frame);
    }

    /* ---------- intro: power-on sweep the first time the dial is seen ---------- */
    function startIntro() {
      if (intro || destroyed) return;
      root.classList.remove('is-armed');
      if (reduced()) { pos = target; paint(); finishIntro(); return; }
      root.classList.add('is-striking');
      intro = { t0: now() };
      pos = 0; vel = 0; detent = -1; lastA = null;
      kick();
    }
    function stepIntro(t) {
      var e = (t - intro.t0) / 1000, DELAY = 0.35, UP = 1.15;
      if (e < DELAY) pos = 0;
      else if (e < DELAY + UP) pos = easeInOut((e - DELAY) / UP) * (n - 1);
      else { pos = n - 1; intro = null; zeta = 0.62; show(value, -1); finishIntro(); }
      return true;
    }
    function finishIntro() {
      root.classList.add('is-ready');
      setTimeout(function () { root.classList.remove('is-striking'); }, 1200);
    }
    function cancelIntro() {
      if (!intro) return;
      intro = null;
      show(value, 1);
      finishIntro();
    }
    function disarm() {           // the visitor got there first: skip the intro altogether
      if (!introArmed) return;
      introArmed = false;
      root.classList.remove('is-armed');
      root.classList.add('is-ready');
      show(value, 1);
    }

    /* ---------- pointer: angle from the knob centre ---------- */
    function geom() {
      var r = knob.getBoundingClientRect();
      return { cx: r.left + r.width / 2, cy: r.top + r.height / 2, R: r.width / 2 };
    }
    function angleAt(g, x, y) { return Math.atan2(x - g.cx, -(y - g.cy)) * 180 / Math.PI; }
    // soft magnetic detents while dragging, rubber band past the end stops
    function shape(p) {
      var B = 0.3;
      if (p < 0) return -B * (1 - Math.exp(p / B));
      if (p > n - 1) return n - 1 + B * (1 - Math.exp(-(p - (n - 1)) / B));
      return p - 0.55 * Math.sin(2 * Math.PI * p) / (2 * Math.PI);
    }
    function unshape(q) {   // invert shape() on the valid range (Newton), so grabbing never jumps
      q = clamp(q, 0, n - 1);
      var p = q;
      for (var k = 0; k < 6; k++) p -= (p - 0.55 * Math.sin(2 * Math.PI * p) / (2 * Math.PI) - q) / (1 - 0.55 * Math.cos(2 * Math.PI * p));
      return clamp(p, 0, n - 1);
    }
    function onDown(e) {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      if (drag) return;
      var g = geom(), dx = e.clientX - g.cx, dy = e.clientY - g.cy, dist = Math.sqrt(dx * dx + dy * dy);
      var onCap = dist <= g.R * (200 / 300) * 1.04;
      disarm();
      cancelIntro();
      try { knob.focus({ preventScroll: true }); } catch (err) { knob.focus(); }
      drag = { id: e.pointerId, g: g, x0: e.clientX, y0: e.clientY, t0: now(), ang: angleAt(g, e.clientX, e.clientY),
        raw: unshape(pos), goal: pos, v: 0, tv: now(), moved: false, active: false, tapOnly: false };
      if (e.pointerType !== 'mouse' && !onCap) { drag.tapOnly = true; return; }   // touch on the scale: let the page scroll, treat as a tap
      drag.active = true;
      try { knob.setPointerCapture(e.pointerId); } catch (err) { /* not capturable */ }
      knob.classList.add('is-dragging');
      e.preventDefault();
    }
    function onMove(e) {
      if (!drag || e.pointerId !== drag.id) return;
      var mx = e.clientX - drag.x0, my = e.clientY - drag.y0;
      if (!drag.moved && mx * mx + my * my > 25) drag.moved = true;
      if (!drag.active) return;
      var g = drag.g, dx = e.clientX - g.cx, dy = e.clientY - g.cy;
      if (dx * dx + dy * dy < Math.pow(g.R * 0.12, 2)) return;   // too close to the hub to read an angle
      var a = angleAt(g, e.clientX, e.clientY), d = a - drag.ang;
      if (d > 180) d -= 360; else if (d < -180) d += 360;
      drag.ang = a;
      var dp = step ? d / step : 0, t = now(), dtv = Math.max(1, t - drag.tv) / 1000;
      drag.raw = clamp(drag.raw + dp, -1.2, n - 1 + 1.2);
      drag.v = drag.v * 0.6 + (dp / dtv) * 0.4;
      drag.tv = t;
      drag.goal = reduced() ? clamp(Math.round(drag.raw), 0, n - 1) : shape(drag.raw);
      if (reduced()) { pos = drag.goal; paint(); } else kick();
    }
    function onUp(e) {
      if (!drag || e.pointerId !== drag.id) return;
      var d = drag;
      drag = null;
      knob.classList.remove('is-dragging');
      try { if (knob.hasPointerCapture && knob.hasPointerCapture(e.pointerId)) knob.releasePointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      if (e.type === 'pointercancel') { if (d.active) go(Math.round(pos), 'drag'); return; }
      if (!d.moved) {
        // a tap: on the scale it jumps to the nearest stop
        var g = d.g, dx = e.clientX - g.cx, dy = e.clientY - g.cy, dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > g.R * 0.7 && step) {
          var a = angleAt(g, e.clientX, e.clientY), k = (a - A0) / step;
          if (k > -0.6 && k < n - 0.4) { go(Math.round(k), 'tap'); return; }
        }
        if (d.active) go(Math.round(pos), 'drag');
        return;
      }
      if (!d.active) return;
      var age = (now() - d.tv) / 1000, v = age > 0.08 ? 0 : clamp(d.v, -14, 14);
      var proj = reduced() ? d.raw : d.raw + v * 0.11;
      vel = reduced() ? 0 : v * 0.5;
      go(Math.round(clamp(proj, 0, n - 1)), 'drag');
    }

    /* ---------- wheel: one stop per notch, never traps the page ---------- */
    function onWheel(e) {
      if (e.ctrlKey) return;
      var mult = e.deltaMode === 1 ? 33 : e.deltaMode === 2 ? 400 : 1;
      var dx = e.deltaX * mult, dy = e.deltaY * mult;
      var v = Math.abs(dx) > Math.abs(dy) ? dx : -dy;
      if (!v) return;
      var t = now(), engaged = t - wheelLast < 420;
      // a page-scroll gesture that carries the knob under the cursor stays a page scroll
      // until the wheel pauses; only a fresh gesture on the knob turns it
      if (!engaged && (t - pageScrollAt < 240 || t - wheelPass < 650)) { wheelPass = t; return; }
      var dir = v > 0 ? 1 : -1;
      if ((dir > 0 && target >= n - 1) || (dir < 0 && target <= 0)) {
        if (!engaged) return;                                      // at an end stop: let the page have it
        e.preventDefault(); e.stopPropagation(); wheelLast = t; return;
      }
      e.preventDefault(); e.stopPropagation();
      wheelLast = t;
      if (wheelAcc && (wheelAcc > 0) !== (v > 0)) wheelAcc = 0;
      wheelAcc = clamp(wheelAcc + v, -120, 120);
      if (Math.abs(wheelAcc) >= 50 && t - wheelStep > 55) {
        wheelAcc = 0; wheelStep = t;
        go(target + dir, 'wheel');
      }
    }

    /* ---------- keyboard ---------- */
    function onKey(e) {
      var k = e.key, d = 0;
      if (k === 'ArrowRight' || k === 'ArrowUp') d = 1;
      else if (k === 'ArrowLeft' || k === 'ArrowDown') d = -1;
      else if (k === 'PageUp') d = 3;
      else if (k === 'PageDown') d = -3;
      else if (k === 'Home') { e.preventDefault(); go(0, 'key'); return; }
      else if (k === 'End') { e.preventDefault(); go(n - 1, 'key'); return; }
      else return;
      e.preventDefault();
      go(target + d, 'key');
    }

    /* ---------- the plasma level arc: rendered once (with its glow), revealed by a conic mask ---------- */
    var arcSize = 0;
    function drawArc() {
      var ctx = arcCv.getContext && arcCv.getContext('2d');
      if (!ctx) return;
      var css = knob.getBoundingClientRect().width, dpr = Math.min(2, window.devicePixelRatio || 1);
      var px = Math.round(css * dpr);
      if (!px || px === arcSize) return;
      arcSize = px;
      arcCv.width = arcCv.height = px;
      var u = px / 600, N = 72, w = SWEEP / N, k, a0, a1;
      ctx.setTransform(u, 0, 0, u, px / 2, px / 2);
      ctx.lineCap = 'butt';
      function seg(k, width, alpha, blur) {
        a0 = (A0 + k * w - 90) * Math.PI / 180; a1 = (A0 + (k + 1) * w + (k < N - 1 ? 0.4 : 0) - 90) * Math.PI / 180;
        var c = plasma((k + 0.5) / N);
        ctx.globalAlpha = alpha; ctx.strokeStyle = c; ctx.lineWidth = width;
        ctx.shadowColor = blur ? c : 'transparent'; ctx.shadowBlur = blur * u;
        ctx.beginPath(); ctx.arc(0, 0, 222, a0, a1); ctx.stroke();
      }
      for (k = 0; k < N; k++) seg(k, 10, 0.45, 22);   // glow
      for (k = 0; k < N; k++) seg(k, 5, 1, 0);        // the filament
      ctx.globalAlpha = 1; ctx.shadowBlur = 0;
    }

    /* ---------- dust motes drifting through the beam (canvas) ---------- */
    function setupDust() {
      var ctx = canvas.getContext && canvas.getContext('2d');
      if (!ctx) return;
      var sprite = document.createElement('canvas');
      sprite.width = sprite.height = 32;
      var sg = sprite.getContext('2d'), gr = sg.createRadialGradient(16, 16, 0, 16, 16, 16);
      gr.addColorStop(0, 'rgba(255,248,220,1)'); gr.addColorStop(0.3, 'rgba(255,214,140,.55)'); gr.addColorStop(1, 'rgba(255,140,40,0)');
      sg.fillStyle = gr; sg.fillRect(0, 0, 32, 32);
      dust = { ctx: ctx, sprite: sprite, w: 0, h: 0, dpr: 1, ps: [], run: false };
      sizeDust();
    }
    function sizeDust() {
      if (!dust) return;
      var r = stage.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
      var w = Math.max(1, Math.round(r.width)), h = Math.max(1, Math.round(r.height));
      if (w === dust.w && h === dust.h && dpr === dust.dpr) return;
      dust.w = w; dust.h = h; dust.dpr = dpr;
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      var cs = getComputedStyle(stage);
      var lt = parseFloat(cs.getPropertyValue('--lt')), lh = parseFloat(cs.getPropertyValue('--lh'));
      dust.ax = w * (parseFloat(cs.getPropertyValue('--apx')) || 50) / 100;
      dust.ay = h * ((isFinite(lt) ? lt : 10) + (isFinite(lh) ? lh : 31) - 1.5) / 100;
      dust.fy = h * (parseFloat(cs.getPropertyValue('--fy')) || 86) / 100;
      var count = w < 420 ? 46 : 80;
      dust.ps = [];
      for (var k = 0; k < count; k++) dust.ps.push(mote(true));
      drawDust();
    }
    function mote(any) {
      var w = dust.w, h = dust.h;
      return {
        x: w * (0.15 + Math.random() * 0.7),
        y: any ? dust.ay + Math.random() * (dust.fy - dust.ay) : dust.fy + Math.random() * 10,
        vx: (Math.random() - 0.5) * 4, vy: -(3 + Math.random() * 9),
        s: 0.6 + Math.pow(Math.random(), 3) * 2.6,
        ph: Math.random() * Math.PI * 2, f: 0.4 + Math.random() * 1.4,
        b: 0.35 + Math.random() * 0.65
      };
    }
    function stepDust(dt) {
      var ps = dust.ps, t = now() / 1000;
      for (var k = 0; k < ps.length; k++) {
        var p = ps[k];
        p.x += (p.vx + Math.sin(t * p.f + p.ph) * 5) * dt;
        p.y += p.vy * dt;
        if (p.y < dust.ay - 10 || p.x < -10 || p.x > dust.w + 10) ps[k] = mote(false);
      }
      drawDust();
    }
    function drawDust() {
      var c = dust.ctx, lv = lastLv < 0 ? 0 : lastLv, ps = dust.ps, t = now() / 1000;
      c.setTransform(dust.dpr, 0, 0, dust.dpr, 0, 0);
      c.clearRect(0, 0, dust.w, dust.h);
      if (lv <= 0.001 && !ps.length) return;
      // same geometry as the CSS beam: half-angle tan(40°) squeezed by scaleX(.42 + .68·lv)
      var tanHalf = Math.tan(40 * Math.PI / 180) * (0.42 + 0.68 * lv);
      var depth = dust.fy - dust.ay, base = 0.18 + 0.82 * lv;
      c.globalCompositeOperation = 'lighter';
      for (var k = 0; k < ps.length; k++) {
        var p = ps[k], dy = p.y - dust.ay;
        if (dy <= 0) continue;
        var half = dy * tanHalf, rx = Math.abs(p.x - dust.ax) / (half || 1);
        if (rx >= 1) continue;
        var edge = 1 - rx * rx, fall = clamp(1 - dy / (depth * 1.15), 0, 1);
        var tw = 0.65 + 0.35 * Math.sin(t * 2.3 * p.f + p.ph);
        var a = edge * Math.sqrt(fall) * base * p.b * tw;
        if (a < 0.02) continue;
        var size = p.s * 4 * (0.8 + lv * 0.5);
        c.globalAlpha = Math.min(1, a);
        c.drawImage(dust.sprite, p.x - size / 2, p.y - size / 2, size, size);
      }
      c.globalAlpha = 1;
      c.globalCompositeOperation = 'source-over';
    }
    function dustState() {
      if (!dust) return;
      var run = visible && !reduced() && !document.hidden;
      if (run !== dust.run) { dust.run = run; if (run) kick(); else drawDust(); }
    }

    /* ---------- wire up ---------- */
    on(knob, 'pointerdown', onDown);
    on(knob, 'pointermove', onMove);
    on(knob, 'pointerup', onUp);
    on(knob, 'pointercancel', onUp);
    on(knob, 'lostpointercapture', function (e) { if (drag && drag.active && e.pointerId === drag.id) onUp({ pointerId: e.pointerId, type: 'pointercancel', clientX: 0, clientY: 0 }); });
    on(knob, 'keydown', onKey);
    on(knob, 'wheel', onWheel, { passive: false });
    on(knob, 'dragstart', function (e) { e.preventDefault(); });
    on(window, 'scroll', function () { pageScrollAt = now(); }, { passive: true });
    on(el.add, 'click', toggleQuote);
    on(document, 'gs:quote', syncAdd);
    on(document, 'visibilitychange', dustState);
    if (mq) {
      var mqFn = function () { if (reduced()) { cancelIntro(); pos = target; vel = 0; root.classList.remove('is-armed'); paint(); } dustState(); };
      if (mq.addEventListener) on(mq, 'change', mqFn); else if (mq.addListener) { mq.addListener(mqFn); cleanups.push(function () { mq.removeListener(mqFn); }); }
    }
    if (!quoteApi()) on(window, 'load', syncAdd);   // the site script may arrive after us

    setupDust();
    drawArc();
    var ro = null;
    if (window.ResizeObserver) { ro = new ResizeObserver(function () { sizeDust(); drawArc(); }); ro.observe(stage); ro.observe(knob); }
    else on(window, 'resize', function () { sizeDust(); drawArc(); });

    // first paint: the committed value is the start stop; for the intro the knob is parked at MIN
    var canIntro = !reduced() && 'IntersectionObserver' in window;
    var io = null, introArmed = canIntro, loaderGaveUp = false;
    value = start;
    setAria(start);
    if (canIntro) { root.classList.add('is-armed'); pos = 0; show(0, 1); }
    else { show(start, 1); root.classList.add('is-ready'); }
    paint();

    function maybeIntro() {
      if (!introArmed || !visible) return;
      var html = document.documentElement;
      if (html.classList.contains('is-loading') && !loaderGaveUp) return;     // wait for the site loader to lift
      introArmed = false;
      setTimeout(startIntro, 120);
    }
    if ('IntersectionObserver' in window) {
      io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) { visible = en.isIntersecting && en.intersectionRatio > 0; });
        dustState();
        maybeIntro();
      }, { threshold: [0, 0.35] });
      io.observe(root);
      on(document, 'gs:loaded', function () { setTimeout(maybeIntro, 200); });
    } else {
      visible = true; dustState();
    }
    // safety net: never leave the dial dark if the loader never reports in
    var safety = setTimeout(function () { loaderGaveUp = true; maybeIntro(); }, 9000);

    /* ---------- public API ---------- */
    api.set = function (key) {
      var i = indexOf(key);
      if (i < 0) return false;
      go(i, 'api');
      return true;
    };
    api.get = function () { return items[value] || null; };
    api.destroy = function () {
      if (destroyed) return;
      destroyed = true;
      if (raf) cancelAnimationFrame(raf);
      clearTimeout(safety);
      if (io) io.disconnect();
      if (ro) ro.disconnect();
      if (swingAnim) swingAnim.cancel();
      cleanups.forEach(function (fn) { fn(); });
      root.innerHTML = '';
      root.classList.remove('is-armed', 'is-ready', 'is-striking');
      root.style.removeProperty('--lv');
      delete root.__gsdial;
    };
    root.__gsdial = api;
    return api;
  }

  window.GSDial = { mount: mount };
})();
