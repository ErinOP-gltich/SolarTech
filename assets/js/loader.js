/*!
 * Green Sun Technologies — preloader "IGNITION"
 * assets/js/loader.js  ·  pairs with assets/css/loader.css
 *
 * Include synchronously, right after the #gsl snippet (first child of <body>):
 *   <script src="assets/js/loader.js"></script>
 *
 * Public surface
 *   window.GSLoader.done      Promise — resolves when the exit starts (page may begin its intro)
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

  var root = doc.documentElement;
  var KEY = 'gs-ignited';
  var HARD_EXIT = 5000;      // ms after start: the exit begins no later than this…
  var HARD_REMOVE = 6000;    // …and the loader is gone no later than this, whatever happens
  var EXPO = 'cubic-bezier(.16,1,.3,1)';

  var now = (win.performance && performance.now) ? function () { return performance.now(); } : Date.now;
  var T0 = now();
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

  /* exit start: tell the page */
  function signal() {
    if (api.loaded) return;
    api.loaded = true;
    root.classList.add('is-loaded');
    try { win.sessionStorage.setItem(KEY, '1'); } catch (e) { /* private mode */ }
    try { doc.dispatchEvent(new CustomEvent('gs:loaded')); } catch (e) { /* listener threw */ }
    resolveDone();
  }

  /* exit end: remove everything, give scrolling back */
  function teardown() {
    if (gone) return;
    gone = true;
    signal();
    root.classList.remove('is-loading');
    if (el && el.parentNode) el.parentNode.removeChild(el);
    el = null;
    resolveRevealed();
  }

  function onReady(fn) {
    if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', fn, { once: true });
    else fn();
  }

  // Nothing to show (no snippet, or <html> lacks "js"): still announce, once page scripts have run.
  if (!el || !root.classList.contains('js')) {
    onReady(function () { setTimeout(teardown, 0); });
    return;
  }

  root.classList.add('is-loading');
  setTimeout(teardown, HARD_REMOVE);   // absolute safety net

  try { boot(); } catch (err) { teardown(); }

  /* ======================================================================= */

  function boot() {
    var reduce = !!(win.matchMedia && win.matchMedia('(prefers-reduced-motion: reduce)').matches);
    var seen = false;
    try { seen = win.sessionStorage.getItem(KEY) === '1'; } catch (e) { /* ignore */ }
    var mode = api.mode = reduce ? 'reduced' : (seen ? 'short' : 'full');
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
      if (!node || !node.animate) return null;
      try { return node.animate(frames, opts); } catch (e) { return null; }
    }

    /* ---- readiness signals ---------------------------------------------- */
    var sig = { dom: doc.readyState !== 'loading', load: doc.readyState === 'complete', fonts: false };
    onReady(function () { sig.dom = true; });
    win.addEventListener('load', function () { sig.load = true; sig.dom = true; }, { once: true });
    var fontsDone = function () { sig.fonts = true; };
    if (doc.fonts && doc.fonts.load) {
      Promise.all([
        doc.fonts.load('900 100px Archivo', '0123456789'),
        doc.fonts.load('500 12px "Geist Mono"', 'GREEN SUN')
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

    /* ---- elements ------------------------------------------------------- */
    var rays = $('.gsl-rays'), rayUses = $$('.gsl-rays use');
    var sun = $('.gsl-sun'), core = $('.gsl-core'), dial = $('.gsl-dial');
    var ember = $('.gsl-ember'), hot = $('.gsl-hot');
    var faceLit = $('.gsl-face:not(.gsl-face--dark)'), faceDark = $('.gsl-face--dark');
    var flash = $('.gsl-flash'), glow = $('.gsl-glow');
    var burn = $('.gsl-burn'), fx = $('.gsl-fx');
    var head = $('.gsl-bar b');
    var lines = $$('.gsl-log li').map(function (li) {
      var span = li.querySelector('span');
      return { li: li, span: span, text: span.textContent, n: -1, d: -1, state: '' };
    });
    var logN = $('.gsl-log-n');

    /* ---- reduced motion: still frame, then a plain fade ------------------- */
    if (mode === 'reduced') {
      reducedRun(seen);
      return;
    }

    /* ---- build the odometer -------------------------------------------- */
    var strips = [];
    $$('.gsl-num > b').forEach(function (b, i) {
      var col = doc.createElement('span');
      col.className = 'gsl-col';
      var strip = doc.createElement('span');
      strip.className = 'gsl-strip';
      var cells = i === 0 ? 2 : 11, html = '';
      for (var k = 0; k < cells; k++) html += '<span>' + (k % 10) + '</span>';
      strip.innerHTML = html;
      col.appendChild(strip);
      b.parentNode.replaceChild(col, b);
      strips.push({ el: strip, cells: cells, pos: -1 });
    });
    function setStrip(s, pos) {
      if (Math.abs(pos - s.pos) < 0.001) return;
      s.pos = pos;
      s.el.style.transform = 'translate3d(0,' + (-pos / s.cells * 100).toFixed(3) + '%,0)';
    }
    function odometer(v) {
      if (!strips.length) return;
      var n = Math.floor(v + 1e-6), f = v - n;
      var roll = smooth(0.45, 1, f);
      setStrip(strips[2], (n % 10) + roll);
      setStrip(strips[1], (Math.floor(n / 10) % 10) + ((n % 10) === 9 ? roll : 0));
      setStrip(strips[0], n >= 100 ? 1 : (n === 99 ? roll : 0));
    }

    /* ---- label scramble ------------------------------------------------- */
    var GLYPHS = 'ABCDEFGHJKLMNPRSTUVWXYZ0123456789#/°·';
    var scr = $$('[data-scr]').map(function (node) {
      return { node: node, text: node.textContent };
    });
    function scramble(t) {   // t: seconds since type-in started
      for (var i = 0; i < scr.length; i++) {
        var s = scr[i], out = '', len = s.text.length;
        if (s.done) continue;
        for (var c = 0; c < len; c++) {
          var ch = s.text.charAt(c);
          var at = 0.05 + (c / len) * 0.55 + i * 0.06;
          if (t >= at || ch === ' ' || ch === ' ') out += ch;
          else if (t >= at - 0.35) out += GLYPHS.charAt((Math.random() * GLYPHS.length) | 0);
          else out += ' ';
        }
        s.node.textContent = out;
        if (t > 0.05 + 0.55 + i * 0.06 + 0.02) { s.node.textContent = s.text; s.done = true; }
      }
    }

    /* ---- boot log ------------------------------------------------------- */
    lines.forEach(function (L) { L.span.textContent = ''; });
    function bootLog(p) {
      var okCount = 0;
      for (var i = 0; i < lines.length; i++) {
        var L = lines[i];
        var a = 0.05 + i * 0.175, b = a + 0.15;
        var f = clamp((p - a) / (b - a));
        var chars = Math.round(clamp(f / 0.62) * L.text.length);
        if (chars !== L.n) { L.n = chars; L.span.textContent = L.text.slice(0, chars); }
        var d = Math.round(clamp((f - 0.62) / 0.3) * 100) / 100;
        if (d !== L.d) { L.d = d; L.li.style.setProperty('--d', d); }
        var state = f <= 0 ? '' : f < 1 ? 'is-on is-typing' : 'is-on is-ok';
        if (state !== L.state) { L.state = state; L.li.className = state; }
        if (f >= 1) okCount++;
      }
      if (logN && logN._n !== okCount) { logN._n = okCount; logN.textContent = '0' + okCount + '/05'; }
    }

    /* ---- sparks (canvas) ------------------------------------------------ */
    var ctx = fx && fx.getContext ? fx.getContext('2d') : null;
    var W = 0, H = 0, DPR = Math.min(win.devicePixelRatio || 1, 1.75);
    var parts = [];
    var sprites = [];
    function sprite(stops) {
      var c = doc.createElement('canvas'); c.width = c.height = 64;
      var g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      for (var i = 0; i < stops.length; i++) gr.addColorStop(stops[i][0], stops[i][1]);
      g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
      return c;
    }
    if (ctx) {
      sprites = [
        sprite([[0, 'rgba(255,255,255,1)'], [0.18, 'rgba(255,241,184,.95)'], [0.45, 'rgba(255,196,0,.35)'], [1, 'rgba(255,122,0,0)']]),
        sprite([[0, 'rgba(255,246,210,1)'], [0.18, 'rgba(255,196,0,.9)'], [0.5, 'rgba(255,122,0,.3)'], [1, 'rgba(255,59,31,0)']]),
        sprite([[0, 'rgba(255,214,150,1)'], [0.2, 'rgba(255,122,0,.85)'], [0.55, 'rgba(255,59,31,.25)'], [1, 'rgba(255,59,31,0)']])
      ];
    }
    function sizeCanvas() {
      if (!ctx) return;
      W = win.innerWidth; H = win.innerHeight;
      fx.width = Math.round(W * DPR); fx.height = Math.round(H * DPR);
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    }
    sizeCanvas();
    win.addEventListener('resize', sizeCanvas);

    var C = { x: 0, y: 0, r: 0 };   // sun centre + mark radius in px
    function measure() {
      var r = sun.getBoundingClientRect();
      C.x = r.left + r.width / 2; C.y = r.top + r.height / 2; C.r = r.width / 2;
    }
    measure();
    win.addEventListener('resize', measure);

    var spinDir = 1;
    function emitEmber(spin) {
      // flung tangentially off the spinning ray tips
      var a = Math.random() * Math.PI * 2;
      var rr = C.r * (0.62 + Math.random() * 0.3);
      var x = C.x + Math.cos(a) * rr, y = C.y + Math.sin(a) * rr;
      var tv = (60 + 260 * spin) * (0.5 + Math.random() * 0.8);
      var ov = 20 + Math.random() * 60;
      parts.push({
        x: x, y: y,
        vx: -Math.sin(a) * tv * spinDir + Math.cos(a) * ov,
        vy: Math.cos(a) * tv * spinDir + Math.sin(a) * ov,
        life: 0.7 + Math.random() * 1.2, age: 0,
        size: 2 + Math.random() * 5, drag: 1.6, lift: 40 + Math.random() * 60, streak: 0.018
      });
    }
    function burst() {
      for (var i = 0; i < 170; i++) {
        var a = Math.random() * Math.PI * 2;
        var sp = 500 + Math.pow(Math.random(), 0.6) * 1900;
        var rr = C.r * 0.3 * Math.random();
        parts.push({
          x: C.x + Math.cos(a) * rr, y: C.y + Math.sin(a) * rr,
          vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
          life: 0.45 + Math.random() * 0.7, age: 0,
          size: 2.5 + Math.random() * 6, drag: 3.2, lift: 0, streak: 0.03
        });
      }
    }
    var dirty = false;
    function drawParts(dt) {
      if (!ctx) return;
      if (dirty) { ctx.clearRect(0, 0, W, H); dirty = false; }
      if (!parts.length) return;
      dirty = true;
      ctx.globalCompositeOperation = 'lighter';
      ctx.lineCap = 'round';
      for (var i = parts.length - 1; i >= 0; i--) {
        var q = parts[i];
        q.age += dt;
        if (q.age >= q.life) { parts.splice(i, 1); continue; }
        var k = Math.exp(-q.drag * dt);
        q.vx *= k; q.vy = q.vy * k - q.lift * dt;
        q.x += q.vx * dt; q.y += q.vy * dt;
        var life = q.age / q.life;
        var alpha = (1 - life) * (life < 0.08 ? life / 0.08 : 1);
        var spr = sprites[life < 0.25 ? 0 : life < 0.6 ? 1 : 2];
        // streak
        var sx = q.vx * q.streak, sy = q.vy * q.streak;
        ctx.globalAlpha = alpha * 0.55;
        ctx.strokeStyle = life < 0.4 ? '#FFD25A' : '#FF6A1A';
        ctx.lineWidth = Math.max(0.6, q.size * 0.32);
        ctx.beginPath(); ctx.moveTo(q.x, q.y); ctx.lineTo(q.x - sx, q.y - sy); ctx.stroke();
        // head
        ctx.globalAlpha = alpha;
        var s = q.size * 3;
        ctx.drawImage(spr, q.x - s / 2, q.y - s / 2, s, s);
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }

    /* ---- spin (WAAPI: runs on the compositor even if the page is busy) ----- */
    var spin = animate(rays, [{ transform: 'rotate(0turn)' }, { transform: 'rotate(1turn)' }],
      { duration: 1000, iterations: Infinity });
    var spinRate = -1;
    function setSpin(r) {
      if (!spin || Math.abs(r - spinRate) < Math.max(0.004, spinRate * 0.03)) return;
      spinRate = r;
      if (spin.updatePlaybackRate) spin.updatePlaybackRate(r); else spin.playbackRate = r;
    }

    /* ---- intro --------------------------------------------------------- */
    var typeT = -1;   // time the type layer appeared
    var dialT = -1;

    if (mode === 'full') {
      setSpin(0.05);
      raf(function () { el.classList.add('gsl--go'); });
      rayUses.forEach(function (u, i) {
        animate(u, [
          { transform: 'rotate(-50deg) scale(.15,0)', opacity: 0 },
          { transform: 'rotate(-8deg) scale(1.04,1.08)', opacity: 1, offset: 0.55 },
          { transform: 'none', opacity: 1 }
        ], { duration: 1100, delay: 120 + i * 55, easing: EXPO, fill: 'both' });
      });
      animate($('.gsl-ring'), [{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }],
        { duration: 1200, delay: 60, easing: EXPO, fill: 'both' });
      $$('.gsl-face path').forEach(function (path, i) {
        animate(path, [{ strokeDashoffset: 1.05 }, { strokeDashoffset: 0 }],
          { duration: 700, delay: 380 + i * 160, easing: EXPO, fill: 'both' });
      });
      animate(core, [{ transform: 'scale(.86)' }, { transform: 'none' }], { duration: 1600, easing: EXPO });
    } else {
      setSpin(0.6);
      hot.style.opacity = '0.25';
    }

    /* ---- main loop ----------------------------------------------------- */
    var MIN = mode === 'full' ? 1.6 : 0.24;    // seconds before progress may reach 100
    var p = 0, tgt = 0, clock = 0, last = now(), held = 0;
    var phase = 'load', exitAt = 0, exitFired = false, X = null;

    function loadStep(dt, wall) {
      var target;
      if (mode === 'full') {
        var pace = inOut(clamp(clock / MIN));
        var allow = sig.load ? 1 : Math.min(0.94, Math.max(realProgress(), 0.94 * (1 - Math.exp(-clock / 1.25))));
        target = Math.min(pace, allow);
      } else {
        var ready = sig.dom && (sig.load || clock > 0.7);
        target = Math.min(clock / MIN, ready ? 1 : 0.85);
      }
      var forced = wall > HARD_EXIT;
      if (forced) target = 1;
      if (target > tgt) tgt = target;
      p += (tgt - p) * (1 - Math.exp(-dt * (mode === 'full' ? 9 : 22)));
      if (tgt >= 1 && p > 0.995) p = 1;
      paint(p, dt);
      if (p >= 1 && (sig.dom || forced)) {
        held += dt;
        if (held > (mode === 'full' ? 0.16 : 0.02) || forced) startExit();
      }
    }

    function paint(pp, dt) {
      el.style.setProperty('--p', pp.toFixed(4));
      if (head) head.style.transform = 'translate3d(' + (pp * W).toFixed(1) + 'px,0,0)';
      if (mode === 'full') {
        ember.style.opacity = (1 - smooth(0.04, 0.6, pp)).toFixed(3);
        hot.style.opacity = (0.55 * smooth(0.68, 1, pp)).toFixed(3);
        var k = smooth(0.24, 0.56, pp);
        faceDark.style.opacity = k.toFixed(3);
        faceLit.style.opacity = (1 - k).toFixed(3);
        var ticks = Math.floor(pp * 72 + 1e-6) / 72;
        if (ticks !== dialT) { dialT = ticks; dial.style.setProperty('--t', ticks.toFixed(4)); }
        setSpin(0.05 + 0.95 * pp * pp);
        if (sig.fonts && typeT < 0) { typeT = clock; el.classList.add('gsl--type'); }
        if (typeT >= 0) {
          scramble(clock - typeT);
          odometer(pp * 100);
          bootLog(pp);
        }
        // embers thrown off the rays, more as it spins up
        if (ctx && pp > 0.12) {
          var rate = 6 + 70 * pp * pp;
          var n = rate * dt + (Math.random() < (rate * dt) % 1 ? 1 : 0);
          for (var i = 0; i < (n | 0); i++) emitEmber(pp);
        }
      }
      drawParts(dt);
    }

    function startExit() {
      if (phase !== 'load') return;
      phase = 'exit';
      el.classList.add('gsl--exit');
      measure();
      signal();
      // start the visual clock on the next frame, after any 'gs:loaded' handlers have run
      raf(function () { exitAt = now(); });
      var maxR = Math.sqrt(Math.pow(Math.max(C.x, W - C.x), 2) + Math.pow(Math.max(C.y, H - C.y), 2));
      var full = mode === 'full';
      X = {
        full: full,
        flash: full ? 0.2 : 0.04,
        wipe: full ? 0.7 : 0.34,
        maxR: maxR,
        band: full ? 0.3 : 0.12,
        clip: supportsClipPath()
      };
      setSpin(full ? 1.25 : 0.9);
    }

    function exitStep(dt) {
      if (!exitAt) { drawParts(dt); return; }
      var te = (now() - exitAt) / 1000;
      var cx = C.x, cy = C.y;
      // 1 · ignition: the core goes white-hot
      var f = clamp(te / X.flash);
      if (X.full) {
        hot.style.opacity = (0.55 + 0.45 * smooth(0, 0.6, f)).toFixed(3);
        flash.style.opacity = (smooth(0, 1, f) * (1 - smooth(X.flash + 0.15, X.flash + 0.55, te))).toFixed(3);
        flash.style.transform = 'scale(' + (0.6 + 0.9 * expoOut(f)).toFixed(3) + ')';
        glow.style.opacity = '1';
        if (!X.burst && te >= X.flash * 0.85) { X.burst = true; burst(); }
      }
      // 2 · burn-through: a circular hole races out from the sun's centre
      var u = clamp((te - X.flash) / X.wipe);
      var e = u < 0.5 ? 8 * u * u * u * u : 1 - Math.pow(-2 * u + 2, 4) / 2;   // quart in-out
      e = 0.35 * u + 0.65 * e;
      var band = 30 + X.maxR * X.band;
      var R = e * (X.maxR + band + 20);
      var sc = 1 + (X.full ? 0.06 * smooth(0, 1, f) : 0) + 1.4 * e * e;
      sun.style.transform = 'scale(' + sc.toFixed(4) + ')';
      if (u > 0) {
        var r = Math.max(R, 0.01);
        if (X.clip) {
          el.style.clipPath = 'path(evenodd,"M0 0H' + W + 'V' + H + 'H0Z M' + (cx - r).toFixed(1) + ' ' + cy.toFixed(1) +
            'a' + r.toFixed(1) + ' ' + r.toFixed(1) + ' 0 1 0 ' + (2 * r).toFixed(1) + ' 0a' + r.toFixed(1) + ' ' + r.toFixed(1) + ' 0 1 0 ' + (-2 * r).toFixed(1) + ' 0Z")';
        } else {
          var m = 'radial-gradient(circle at ' + cx + 'px ' + cy + 'px, transparent ' + r + 'px, #000 ' + (r + 1) + 'px)';
          el.style.webkitMaskImage = m; el.style.maskImage = m;
        }
        var b = band;
        burn.style.background = 'radial-gradient(circle at ' + cx.toFixed(1) + 'px ' + cy.toFixed(1) + 'px,' +
          '#fff ' + r.toFixed(1) + 'px,' +
          '#FFF1B8 ' + (r + b * 0.06).toFixed(1) + 'px,' +
          '#FFC400 ' + (r + b * 0.2).toFixed(1) + 'px,' +
          'rgba(255,122,0,.85) ' + (r + b * 0.42).toFixed(1) + 'px,' +
          'rgba(255,59,31,.4) ' + (r + b * 0.7).toFixed(1) + 'px,' +
          'rgba(255,59,31,0) ' + (r + b).toFixed(1) + 'px)';
      }
      drawParts(dt);
      if (u >= 1) teardown();
    }

    function supportsClipPath() {
      try { return !!(win.CSS && CSS.supports && CSS.supports('clip-path', 'path(evenodd,"M0 0H1V1H0Z")')); }
      catch (e) { return false; }
    }

    function frame() {
      if (gone) return;
      var t = now();
      var dt = Math.min(0.05, Math.max(0, (t - last) / 1000));
      last = t;
      clock += dt;
      try {
        if (phase === 'load') loadStep(dt, t - T0);
        else exitStep(dt);
      } catch (err) { teardown(); return; }
      raf(frame);
    }
    raf(frame);

    // background tabs pause rAF: make sure the hard limit still applies
    setTimeout(function () { if (phase === 'load') { startExit(); } }, HARD_EXIT + 50);

    api.skip = function () { if (phase === 'load') startExit(); else teardown(); };
  }

  /* reduced motion: no counter, no typing, no spin — a still frame and a fade */
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
    setTimeout(function () { if (!fired) { doc.readyState === 'loading' ? teardown() : (loaded = true, check()); } }, HARD_EXIT);
  }
})(window, document);
