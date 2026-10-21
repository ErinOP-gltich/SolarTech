/*!
 * Green Sun Technologies — preloader "LIGHTS ON"
 * assets/js/loader.js  ·  pairs with assets/css/loader.css
 *
 * One solar street light. Its panel charges cell by cell with the page's real
 * readiness, the LED head flickers on, and the light cone opens the page.
 *
 * Include synchronously, right after the #gsl snippet (first child of <body>):
 *   <script src="assets/js/loader.js"></script>
 *
 * Public surface
 *   window.GSLoader.done      Promise — resolves when the exit starts (the light cone opens; page may begin its intro)
 *   window.GSLoader.revealed  Promise — resolves when the loader has been removed
 *   window.GSLoader.loaded    boolean — true once the exit has started
 *   window.GSLoader.mode      'full' | 'short' | 'reduced' | 'none'
 *   window.GSLoader.skip()    start the exit now
 *   <html class="is-loading"> while the curtain is up (scroll locked)
 *   <html class="is-loaded"> + document event 'gs:loaded' when the exit starts
 *
 * No dependencies (GSAP is not available yet when this runs).
 */
(function (win, doc) {
  'use strict';

  if (win.GSLoader) return;   // included twice: keep the first instance

  var root = doc.documentElement;
  var KEY = 'gs-ignited';
  var HARD_EXIT = 4700;      // ms: the exit (the cone, 0.9 s) begins no later than this…
  var HARD_REMOVE = 5950;    // …and the loader is gone by this, counted from navigation start
  var TOO_LATE = 6300;       // loader.js arrived this late: the CSS failsafe is about to lift the curtain anyway

  // drawing geometry (SVG units, viewBox 0 0 520 340) — same numbers as loader.css
  var LENS_X = 424.14, LENS_Y = 168.07;   // LED lens centre
  var AXIS = 171.25;                      // beam axis, CSS conic angle (0 = up, clockwise)

  var hasPerf = !!(win.performance && performance.now);
  var now = hasPerf ? function () { return performance.now(); } : Date.now;
  var T0 = now();
  // ms since navigation start (what the hard limits are measured against)
  function since() { return hasPerf ? performance.now() : Date.now() - T0; }
  var raf = win.requestAnimationFrame ? win.requestAnimationFrame.bind(win) : function (f) { return setTimeout(function () { f(now()); }, 16); };

  var resolveDone, resolveRevealed;
  var api = win.GSLoader = {
    done: new Promise(function (r) { resolveDone = r; }),
    revealed: new Promise(function (r) { resolveRevealed = r; }),
    loaded: false,
    mode: 'none',
    skip: function () { teardown(); }
  };

  var el = doc.getElementById('gsl');
  var gone = false;
  var cleanups = [];

  /* exit start: tell the page */
  function signal() {
    if (api.loaded) return;
    api.loaded = true;
    root.classList.add('is-loaded');
    try { win.sessionStorage.setItem(KEY, '1'); } catch (e) { /* private mode */ }
    try { doc.dispatchEvent(new CustomEvent('gs:loaded', { detail: { mode: api.mode } })); } catch (e) { /* listener threw */ }
    resolveDone();
  }

  /* exit end: remove everything, give scrolling back */
  function teardown() {
    if (gone) return;
    gone = true;
    signal();
    if (hardTimer) clearTimeout(hardTimer);
    api.skip = function () {};   // drop the reference to the boot closure
    root.classList.remove('is-loading');
    for (var i = 0; i < cleanups.length; i++) { try { cleanups[i](); } catch (e) { /* ignore */ } }
    cleanups.length = 0;
    // cancel every WAAPI animation so the detached subtree can be collected
    try { if (el && el.getAnimations) el.getAnimations({ subtree: true }).forEach(function (a) { a.cancel(); }); } catch (e) { /* ignore */ }
    if (el && el.parentNode) el.parentNode.removeChild(el);
    el = null;
    resolveRevealed();
  }

  function onReady(fn) {
    if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', fn, { once: true });
    else fn();
  }

  // Nothing to show (no snippet, <html> lacks "js", or this script arrived so late that the
  // CSS failsafe is lifting the curtain anyway): still announce, once page scripts have run.
  if (!el || !root.classList.contains('js') || since() > TOO_LATE) {
    if (el) el.style.display = 'none';
    onReady(function () { setTimeout(teardown, 0); });
    return;
  }

  root.classList.add('is-loading');

  // Focus is never trapped, so Tab still walks the page behind the curtain — but focusing a link
  // far down would scroll the locked page (overflow:hidden still allows focus scrolling) and the
  // visitor would land mid-page when the curtain lifts. Keep the position; focus itself moves.
  var holdScroll = function (e) {
    if (e.key !== 'Tab' || gone) return;
    var x = win.pageXOffset || 0, y = win.pageYOffset || 0;
    var undo = function () {
      if (root.classList.contains('is-loading') && (win.pageXOffset !== x || win.pageYOffset !== y)) win.scrollTo(x, y);
    };
    setTimeout(undo, 0);
    raf(undo);
  };
  doc.addEventListener('keydown', holdScroll, true);
  cleanups.push(function () { doc.removeEventListener('keydown', holdScroll, true); });

  // absolute safety net (performance.now() counts from navigation start)
  var hardTimer = setTimeout(teardown, Math.max(600, HARD_REMOVE - since()));

  try { boot(); } catch (err) { teardown(); }

  /* ======================================================================= */

  function boot() {
    var reduce = !!(win.matchMedia && win.matchMedia('(prefers-reduced-motion: reduce)').matches);
    var seen = false;
    try { seen = win.sessionStorage.getItem(KEY) === '1'; } catch (e) { /* ignore */ }
    var mode = api.mode = reduce ? 'reduced' : (seen ? 'short' : 'full');
    var full = mode === 'full';
    var exitTimer = 0;
    el.classList.add('gsl--' + mode);
    if (reduce && seen) el.classList.add('gsl--short');

    /* ---- helpers -------------------------------------------------------- */
    function $(s) { return el.querySelector(s); }
    function $$(s) { return Array.prototype.slice.call(el.querySelectorAll(s)); }
    function clamp(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
    function smooth(a, b, x) { x = clamp((x - a) / (b - a)); return x * x * (3 - 2 * x); }
    function inOut(x) { return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; }
    function expoOut(x) { return x >= 1 ? 1 : 1 - Math.pow(2, -10 * x); }
    function animate(node, frames, opts) {
      if (!node) return null;
      try { if (node.animate) return node.animate(frames, opts); } catch (e) { /* fall through */ }
      // no Web Animations: jump to the end state so nothing stays hidden at its 'from' keyframe
      var end = frames[frames.length - 1];
      for (var k in end) if (k !== 'offset' && k !== 'easing') { try { node.style[k] = end[k]; } catch (e) { /* ignore */ } }
      return null;
    }

    /* ---- elements ------------------------------------------------------- */
    var curtain = $('.gsl-curtain'), beam = $('.gsl-beam'), glow = $('.gsl-glow');
    var svg = $('.gsl-lamp'), numEl = $('.gsl-num b'), lbl = $('.gsl-lbl');
    var cells = $$('.gsl-c'), NC = cells.length, cellOp = [];

    // hairlines: exactly 1 CSS px at whatever size the drawing is rendered
    function fitStroke() {
      var w = svg && svg.getBoundingClientRect().width;
      if (w > 0) svg.style.setProperty('--sw', (520 / w).toFixed(4));
    }
    fitStroke();
    win.addEventListener('resize', fitStroke);
    cleanups.push(function () { win.removeEventListener('resize', fitStroke); clearTimeout(exitTimer); });

    /* ---- reduced motion: still frame, then a plain fade ------------------- */
    if (mode === 'reduced') {
      reducedRun(seen);
      return;
    }

    /* ---- readiness signals ---------------------------------------------- */
    var sig = { dom: doc.readyState !== 'loading', load: doc.readyState === 'complete', fonts: false };
    onReady(function () { sig.dom = true; });
    win.addEventListener('load', function () { sig.load = true; sig.dom = true; }, { once: true });
    var fontsDone = function () { sig.fonts = true; };
    if (full && doc.fonts && doc.fonts.load) {
      Promise.all([
        doc.fonts.load('800 100px Archivo', '0123456789'),
        doc.fonts.load('500 12px "Geist Mono"', 'CHARGING')
      ]).then(fontsDone, fontsDone);
      setTimeout(fontsDone, 900);       // never hold the type for a slow font
    } else {
      fontsDone();
    }
    var imgs = doc.images;
    function imageFraction() {
      var n = 0, ok = 0;
      for (var i = 0; i < imgs.length; i++) {
        var im = imgs[i];
        if (im.loading === 'lazy' || el.contains(im)) continue;
        n++;
        if (im.complete) ok++;
      }
      return n ? ok / n : 1;
    }
    function realProgress() {
      if (sig.load) return 1;
      var r = 0.1;
      if (sig.fonts) r += 0.15;
      if (sig.dom) r += 0.3 + 0.35 * imageFraction();
      return Math.min(r, 0.9);
    }

    /* ---- the drawing comes in (full run only) ---------------------------- */
    if (full) {
      raf(function () { if (el) el.classList.add('gsl--go'); });
      var draw = function (sel, delay, dur) {
        $$(sel).forEach(function (n) {
          animate(n, [{ strokeDashoffset: 1.001 }, { strokeDashoffset: 0 }], { duration: dur, delay: delay, easing: 'cubic-bezier(.65,0,.35,1)', fill: 'both' });
        });
      };
      draw('.gsl-stub', 280, 260);
      draw('.gsl-col', 420, 220);
      draw('.gsl-arm', 460, 520);
      draw('.gsl-head', 700, 420);
      draw('.gsl-fin', 900, 300);
      draw('.gsl-bat', 380, 520);
      draw('.gsl-brk', 200, 300);
      draw('.gsl-pv', 100, 520);
      draw('.gsl-lead', 760, 420);
    }

    /* ---- progress: panel cells + numeral ---------------------------------- */
    var shown = -1;
    function paintProgress(pp) {
      if (!full) return;
      var f = pp * NC;
      for (var i = 0; i < NC; i++) {
        var o = Math.round(clamp(f - i) * 20) / 20;
        if (o !== cellOp[i]) { cellOp[i] = o; cells[i].style.fillOpacity = o; }
      }
      var n = Math.floor(pp * 100 + 1e-6);
      if (n !== shown && numEl) { shown = n; numEl.textContent = n; }
    }

    /* ---- main loop ----------------------------------------------------- */
    // short run (later page views) has no readout: lamp flicks on, cone opens — ~0.7 s in all
    var MIN = full ? 1.2 : 0.08;       // seconds before progress may reach 100
    var FLICK = full ? 0.3 : 0.11;     // the LED flickering on
    var DUR = full ? 0.9 : 0.42;       // the cone opening the page
    // LED brightness keys [t, level]: two quick flickers, then on (2 flashes: under 3 per second)
    var KEYS = full
      ? [[0, 0], [0.03, 1], [0.075, 0.06], [0.14, 0.85], [0.18, 0.05], [0.25, 1]]
      : [[0, 0], [0.025, 1], [0.055, 0.1], [0.095, 1]];
    var p = 0, tgt = 0, clock = 0, last = now(), held = 0;
    var phase = 'load', flickAt = 0, revealAt = 0, X = null;

    function loadStep(dt, wall) {
      var target;
      if (full) {
        var pace = inOut(clamp(clock / MIN));
        var allow = sig.load ? 1 : Math.min(0.94, Math.max(realProgress(), 0.94 * (1 - Math.exp(-clock / 1.25))));
        target = Math.min(pace, allow);
      } else {
        var ready = sig.dom && (sig.load || clock > 0.15);
        target = ready && clock >= MIN ? 1 : 0;
      }
      // late page: start the flicker early enough that the cone still opens by HARD_EXIT
      var forced = wall > HARD_EXIT - FLICK * 1000;
      if (target > tgt) tgt = target;
      p = full ? p + (tgt - p) * (1 - Math.exp(-dt * 9)) : tgt;
      if ((tgt >= 1 && p > 0.99) || forced) p = tgt = 1;
      paintProgress(p);
      if (full && sig.fonts && !el.classList.contains('gsl--type')) el.classList.add('gsl--type');
      if (p >= 1 && (sig.dom || forced)) {
        held += dt;
        if (held > (full ? 0.08 : 0) || forced) startFlick();
      }
    }

    function startFlick() {
      if (phase !== 'load') return;
      phase = 'flick';
      paintProgress(1);
      if (lbl) lbl.textContent = 'Charged';
      flickAt = now();
    }

    function level(t) {
      for (var i = 1; i < KEYS.length; i++) {
        if (t <= KEYS[i][0]) {
          var a = KEYS[i - 1], b = KEYS[i];
          return a[1] + (b[1] - a[1]) * (t - a[0]) / (b[0] - a[0]);
        }
      }
      return 1;
    }

    function flickStep() {
      if (!flickAt) return;
      var t = (now() - flickAt) / 1000;
      glow.style.opacity = level(t).toFixed(3);
      if (t >= KEYS[KEYS.length - 1][0] && !X) el.classList.add('gsl--on');
      if (t >= FLICK) startReveal();
    }

    function supports(prop, val) {
      try { return !!(win.CSS && CSS.supports && CSS.supports(prop, val)); } catch (e) { return false; }
    }

    function startReveal() {
      if (phase === 'reveal') return;
      phase = 'reveal';
      el.classList.add('gsl--on', 'gsl--reveal');
      glow.style.opacity = '1';
      // where the light starts: the lens centre, in loader (= viewport) pixels
      var W = el.clientWidth || win.innerWidth, H = el.clientHeight || win.innerHeight;
      var r = svg.getBoundingClientRect(), o = el.getBoundingClientRect();
      var k = r.width / 520;
      var cx = r.left - o.left + LENS_X * k, cy = r.top - o.top + LENS_Y * k;
      var far = 0;
      [[0, 0], [W, 0], [0, H], [W, H]].forEach(function (c) { far = Math.max(far, Math.sqrt(Math.pow(c[0] - cx, 2) + Math.pow(c[1] - cy, 2))); });
      var conic = supports('mask-image', 'conic-gradient(#000, #000)') || supports('-webkit-mask-image', 'conic-gradient(#000, #000)');
      X = { cx: cx, cy: cy, far: far + 60, at: cx.toFixed(1) + 'px ' + cy.toFixed(1) + 'px', mask: conic };
      signal();
      // start the visual clock on the next frame, after any 'gs:loaded' handlers have run
      raf(function () { revealAt = now(); });
    }

    function setMask(node, v) {
      node.style.webkitMaskImage = v;
      node.style.maskImage = v;
    }

    // warm light falling from the lamp, cut off at the beam's front (L px from the lens)
    var BEAM = [[0, '255,250,238,.9'], [0.03, '255,234,190,.5'], [0.12, '255,214,150,.22'], [0.36, '255,180,100,.09'], [0.8, '255,150,70,.03']];
    function beamBg(L) {
      var out = [];
      for (var i = 0; i < BEAM.length; i++) {
        var pos = BEAM[i][0] * X.far;
        if (pos >= L) break;
        out.push('rgba(' + BEAM[i][1] + ') ' + pos.toFixed(0) + 'px');
      }
      if (!out.length) out.push('rgba(' + BEAM[0][1] + ') 0px');
      out.push('rgba(255,150,40,0) ' + (L + 24 + 0.06 * L).toFixed(0) + 'px');
      return 'radial-gradient(circle at ' + X.at + ', ' + out.join(', ') + ')';
    }
    // a wedge around the beam axis, half-angle a, soft edges s; inside = opaque (or clear if !inside)
    function wedge(a, s, inside) {
      var from = (AXIS - a - s).toFixed(2);
      var on = inside ? '#000' : 'transparent', off = inside ? 'transparent' : '#000';
      return 'conic-gradient(from ' + from + 'deg at ' + X.at + ', ' + off + ' 0deg, ' + on + ' ' + s.toFixed(2) + 'deg ' + (2 * a + s).toFixed(2) + 'deg, ' + off + ' ' + (2 * a + 2 * s).toFixed(2) + 'deg)';
    }

    function revealStep() {
      if (!revealAt) return;
      var u = clamp((now() - revealAt) / 1000 / DUR);
      // 1 · the beam shoots down (first ~20%), 2 · then widens until it holds the whole screen
      var shoot = expoOut(clamp(u / 0.2));
      var widen = inOut(clamp((u - 0.14) / 0.86));
      var L = 8 + X.far * shoot;
      var a = 6 + 16 * shoot + 168 * widen;          // half-angle, degrees
      var s = 1 + a * 0.06;                          // soft edge, degrees
      if (X.mask) {
        if (2 * a + s >= 360) {
          curtain.style.visibility = 'hidden';
        } else {
          var hole = wedge(a, s, false);
          setMask(curtain, L < X.far ? hole + ', radial-gradient(circle at ' + X.at + ', transparent ' + L.toFixed(0) + 'px, #000 ' + (L + 30).toFixed(0) + 'px)' : hole);
        }
        // the light runs a little ahead of the opening: a warm fringe on the dark
        setMask(beam, a + 2.5 + s >= 180 ? 'none' : wedge(a + 2.5, s + 1.5, true));
        beam.style.backgroundImage = beamBg(L);
        beam.style.opacity = (1 - smooth(0.3, 1, u)).toFixed(3);
        // the dark left above the lamp dissolves rather than closing like a shutter
        curtain.style.opacity = (1 - smooth(0.45, 0.92, u)).toFixed(3);
      } else {
        curtain.style.opacity = (1 - smooth(0.1, 0.9, u)).toFixed(3);   // no masks: a plain cross-fade
      }
      glow.style.opacity = (1 - smooth(0.42, 0.85, u)).toFixed(3);
      if (u >= 1) teardown();
    }

    function frame() {
      if (gone) return;
      var t = now();
      var raw = Math.max(0, (t - last) / 1000);
      // smoothing step is capped so a hitch never teleports anything; the choreography clock
      // tolerates longer frames so a slow device (or a busy main thread while the page's own
      // scripts start) still finishes in about the intended time instead of crawling
      var dt = Math.min(0.1, raw);
      last = t;
      clock += Math.min(0.25, raw);
      try {
        if (phase === 'load') loadStep(dt, since());
        else if (phase === 'flick') flickStep();
        else revealStep();
      } catch (err) { teardown(); return; }
      raf(frame);
    }
    raf(frame);

    // background tabs pause rAF: make sure the hard limit still applies
    exitTimer = setTimeout(function () { if (phase !== 'reveal') startReveal(); }, Math.max(0, HARD_EXIT + 80 - since()));

    api.skip = function () { if (phase !== 'reveal') startReveal(); else teardown(); };
  }

  /* reduced motion: no counter, no flicker — a still frame (light already on) and a fade */
  function reducedRun(seen) {
    var minT = seen ? 150 : 450;
    var softCap = seen ? 600 : 1200;
    var fired = false;
    var loaded = doc.readyState === 'complete';
    win.addEventListener('load', function () { loaded = true; check(); }, { once: true });
    function check() {
      if (fired || gone) return;
      var t = now() - T0;
      if (doc.readyState === 'loading' || t < minT || (!loaded && t < softCap)) return;
      fired = true;
      signal();
      el.classList.add('gsl--out');
      el.style.pointerEvents = 'none';
      setTimeout(teardown, 380);
    }
    onReady(check);
    var iv = setInterval(function () { if (fired || gone) clearInterval(iv); else check(); }, 50);
    setTimeout(function () {
      if (fired) return;
      if (doc.readyState === 'loading') teardown();
      else { loaded = true; check(); }
    }, Math.max(0, HARD_EXIT - since()));
  }
})(window, document);
