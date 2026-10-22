/* Green Sun Technologies — "Live Beam" hero.
   A Green Sun solar street light (LED head + its solar panel) hangs into the hero from the top edge. It powers
   on with a short LED flicker, then its light cone (dust drifting in it, soft falloff, a warm pool where it
   lands) follows the visitor's pointer across a dark highway at night: asphalt, lane paint, road studs, a zebra
   crossing, black-and-yellow kerbs, an NH-37 milestone and the tea bushes of an Assam estate, most of which only
   show up when the light reaches them. Further down the road, a row of street lights is already on.

   Plain 2D canvas, no dependencies. Three layers: a static street (redrawn only on resize), a lit copy of the
   same street that the beam reveals, and one dynamic canvas for the pool, the volumetric cone, the dust and the
   luminaire itself. The volumetric light is drawn at a third of the resolution and scaled up, which keeps its
   edges soft and the fill cheap.

   window.GSHeroBeam.mount(host, opts) → { destroy, pause, play, setProgress(p), stats(), aim(x, y), ignite() }
     opts.lit        elements whose ::after "lit" copy is masked to the beam (default: host [data-beam-lit])
     opts.igniteDelay  ms before the LED flicker starts (default 250)
     opts.reduceMotion force the static frame (default: prefers-reduced-motion)
   The host gets .hb-on after the first frame, and CSS variables --hb-ax/ay/a0/aw/r/k describing the beam on screen. */
(function () {
  'use strict';

  var DEG = Math.PI / 180;
  var TAU = Math.PI * 2;

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function mix(a, b, t) { return a + (b - a) * t; }
  function sstep(a, b, x) { var t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }
  // deterministic noise, so a resize redraws exactly the same street
  function rng(seed) {
    var s = seed >>> 0;
    return function () {
      s = (s + 0x6D2B79F5) >>> 0;
      var t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* ---------- colour: all lighting maths in linear light, encoded to sRGB at the end ---------- */
  function enc(v) { v = clamp(v, 0, 1); return v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055; }
  function rgba(c, a) {
    return 'rgba(' + Math.round(enc(c[0]) * 255) + ',' + Math.round(enc(c[1]) * 255) + ',' + Math.round(enc(c[2]) * 255) + ',' + (a == null ? 1 : Math.round(clamp(a, 0, 1) * 1000) / 1000) + ')';
  }
  function cmul(a, b) { return [a[0] * b[0], a[1] * b[1], a[2] * b[2]]; }
  function cscale(a, k) { return [a[0] * k, a[1] * k, a[2] * k]; }
  function cadd(a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }
  function cmix(a, b, t) { return [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)]; }

  var LAMP = [1.0, 0.84, 0.60];        // warm-white LED light
  var LIT_GAIN = 1.0;
  var KNEE = 0.4;                      // soft shoulder on the lit street: bright paint tops out near L 0.23                 // street albedo × LAMP × gain = the lit street
  var MOON = [0.016, 0.018, 0.026];    // the unlit street: a faint, cool night
  var FOG = [0.0042, 0.0040, 0.0062];  // haze toward the horizon (≈ #101015)
  var KEY = vnorm([-0.55, 0.62, -0.56]); // studio key on the luminaire: upper-left, from the camera side
  var KEYC = [0.36, 0.42, 0.56];
  var RIMC = [0.30, 0.25, 0.20];

  // albedo (linear)
  var A = {
    asphalt: [0.07, 0.066, 0.062], wear: [0.10, 0.096, 0.09], patch: [0.035, 0.034, 0.033],
    paint: [0.58, 0.56, 0.5], stud: [0.9, 0.55, 0.08],
    kerbY: [0.80, 0.50, 0.02], kerbK: [0.03, 0.03, 0.032],
    paver: [0.13, 0.122, 0.112], joint: [0.035, 0.033, 0.03], soil: [0.05, 0.036, 0.024],
    leaf: [0.035, 0.085, 0.02], leaf2: [0.075, 0.16, 0.035], leafDk: [0.012, 0.03, 0.008],
    stoneW: [0.62, 0.61, 0.56], stoneY: [0.85, 0.56, 0.03], ink: [0.02, 0.02, 0.02],
    pole: [0.22, 0.23, 0.25]
  };

  /* ---------- vectors ---------- */
  function vadd(a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }
  function vsub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
  function vmul(a, k) { return [a[0] * k, a[1] * k, a[2] * k]; }
  function vdot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
  function vcross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
  function vlen(a) { return Math.sqrt(vdot(a, a)); }
  function vnorm(a) { var l = vlen(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; }
  // o + a·i + b·j + c·k
  function vcomb(o, a, i, b, j, c, k) {
    return [o[0] + a[0] * i + b[0] * j + c[0] * k, o[1] + a[1] * i + b[1] * j + c[1] * k, o[2] + a[2] * i + b[2] * j + c[2] * k];
  }

  /* ---------- pinhole camera standing over the road, pitched down ---------- */
  function Camera(W, H, L) {
    var phi = L.pitch * DEG;
    this.W = W; this.H = H;
    this.f = 0.5 * H / Math.tan(L.vfov * DEG / 2);
    this.cx = W * L.ppx; this.cy = H * 0.5;
    this.h = L.camH; this.x0 = L.camX;
    this.c = Math.cos(phi); this.s = Math.sin(phi);
    this.pos = [L.camX, L.camH, 0];
    this.horizon = this.cy - this.f * Math.tan(phi);
  }
  Camera.prototype.p = function (x, y, z) {
    var dx = x - this.x0, dy = y - this.h;
    var yc = dy * this.c + z * this.s, zc = -dy * this.s + z * this.c;
    if (zc < 0.05) zc = 0.05;
    return [this.cx + this.f * dx / zc, this.cy - this.f * yc / zc, zc];
  };
  Camera.prototype.pv = function (v) { return this.p(v[0], v[1], v[2]); };
  Camera.prototype.ray = function (sx, sy) {
    var a = (sx - this.cx) / this.f, b = -(sy - this.cy) / this.f;
    return [a, b * this.c - this.s, b * this.s + this.c];
  };
  Camera.prototype.ground = function (sx, sy, y0) {
    var d = this.ray(sx, sy);
    if (d[1] > -1e-4) return null;
    var t = ((y0 || 0) - this.h) / d[1];
    return [this.x0 + t * d[0], y0 || 0, t * d[2]];
  };
  Camera.prototype.depthY = function (z, y) { return this.p(0, y || 0, z)[1]; };

  /* ---------- composition per viewport shape ---------- */
  function layoutFor(W, H) {
    var ar = W / H;
    if (ar < 0.8) { // portrait phones and tablets: the lamp hangs top-right, the road runs up the middle
      return { portrait: true, camH: 7.4, pitch: 31, vfov: Math.min(80, 64 + (1.05 - ar) * 20), ppx: 0.46, camX: -0.6,
        lamp: [0.7, 0.215], lampDist: 2.9, beta: 18, minY: 0.36, maxZ: 30,
        rest: [0.56, 0.5], sweep: [0.5, 0.3, 0.52, 0.1] };
    }
    var tight = ar < 1.45; // 1024×768-ish
    return { portrait: false, camH: 7.6, pitch: 20, vfov: tight ? 58 : 54, ppx: tight ? 0.58 : 0.6, camX: tight ? -1.6 : -2.4,
      lamp: [tight ? 0.77 : 0.775, tight ? 0.245 : 0.25], lampDist: tight ? 3.9 : 3.75, beta: 17, minY: 0.3, maxZ: 40,
      rest: [0.6, 0.68], sweep: [0.56, 0.3, 0.66, 0.15] };
  }

  /* ---------- small canvas helpers ---------- */
  function path(ctx, pts) {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (var i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
  }
  function fillPoly(ctx, pts, style) { path(ctx, pts); ctx.fillStyle = style; ctx.fill(); }
  function hull(pts) { // Andrew's monotone chain
    var p = pts.slice().sort(function (a, b) { return a[0] - b[0] || a[1] - b[1]; });
    if (p.length < 3) return p;
    var cr = function (o, a, b) { return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]); };
    var lo = [], up = [], i;
    for (i = 0; i < p.length; i++) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], p[i]) <= 0) lo.pop(); lo.push(p[i]); }
    for (i = p.length - 1; i >= 0; i--) { while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], p[i]) <= 0) up.pop(); up.push(p[i]); }
    up.pop(); lo.pop();
    return lo.concat(up);
  }
  function makeCanvas(w, h) { var c = document.createElement('canvas'); c.width = Math.max(1, w); c.height = Math.max(1, h); return c; }
  function rrect(s0, s1, z0, z1, rb, rf, seg) { // rounded rectangle in the (s, z) plane, with outward normals
    var pts = [];
    function arc(cs, cz, r, a0, a1) {
      for (var i = 0; i <= seg; i++) {
        var a = a0 + (a1 - a0) * i / seg;
        pts.push([cs + Math.cos(a) * r, cz + Math.sin(a) * r, Math.cos(a), Math.sin(a)]);
      }
    }
    arc(s0 + rb, z0 + rb, rb, Math.PI, 1.5 * Math.PI);
    arc(s1 - rf, z0 + rf, rf, 1.5 * Math.PI, 2 * Math.PI);
    arc(s1 - rf, z1 - rf, rf, 0, 0.5 * Math.PI);
    arc(s0 + rb, z1 - rb, rb, 0.5 * Math.PI, Math.PI);
    return pts;
  }

  /* ---------- LED ignition: a short, irregular flicker, a little overshoot, then steady ---------- */
  var FLICK = [[0, 0], [0.05, 0.85], [0.09, 0.08], [0.15, 0.62], [0.19, 0.04], [0.33, 0.0], [0.38, 0.95], [0.43, 0.22], [0.5, 0.8], [0.55, 0.35], [0.62, 1]];
  function ignition(t) {
    if (t <= 0) return 0;
    if (t >= 0.62) return 1 + 0.16 * Math.exp(-(t - 0.62) * 5) * sstep(0.62, 0.72, t);
    for (var i = FLICK.length - 1; i >= 0; i--) {
      if (t >= FLICK[i][0]) {
        var v = FLICK[i][1];
        // each step eases in over ~18 ms like a real driver, not an instant switch
        var prev = i ? FLICK[i - 1][1] : 0;
        return mix(prev, v, sstep(0, 0.018, t - FLICK[i][0]));
      }
    }
    return 0;
  }

  /* ======================================================================================== */
  function mount(host, opts) {
    opts = opts || {};
    var GS = window.GS;
    var reduced = opts.reduceMotion != null ? !!opts.reduceMotion : (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
    var noHover = window.matchMedia && matchMedia('(hover: none)').matches;

    // stage: a static street canvas under one dynamic canvas
    var stage = host.querySelector('[data-beam-stage]');
    var ownStage = !stage;
    if (!stage) {
      stage = document.createElement('div');
      stage.className = 'hb-stage';
      stage.setAttribute('aria-hidden', 'true');
      host.insertBefore(stage, host.firstChild);
    }
    var cScene = makeCanvas(1, 1), cFx = makeCanvas(1, 1);
    cScene.className = 'hb-scene'; cFx.className = 'hb-fx';
    stage.appendChild(cScene); stage.appendChild(cFx);
    var sx = cScene.getContext('2d', { alpha: false }), fx = cFx.getContext('2d');
    if (!sx || !fx) {
      host.classList.add('hb-off');
      stage.remove && (ownStage ? stage.remove() : (cScene.remove(), cFx.remove()));
      var noop = function () {};
      return { destroy: noop, pause: noop, play: noop, setProgress: noop, aim: noop, ignite: noop, stats: function () { return { mode: 'none' }; } };
    }
    var hasConic = typeof fx.createConicGradient === 'function';

    // areas the pool must stay clear of (the lede, the foot): like a real head, the light has a limited reach
    var shieldEls = Array.prototype.slice.call(opts.shield ? (typeof opts.shield === 'string' ? host.querySelectorAll(opts.shield) : opts.shield) : host.querySelectorAll('[data-beam-shield]'));
    var shields = [];
    var lit = opts.lit ? Array.prototype.slice.call(typeof opts.lit === 'string' ? host.querySelectorAll(opts.lit) : opts.lit) : Array.prototype.slice.call(host.querySelectorAll('[data-beam-lit]'));

    // state
    var W = 0, H = 0, dpr = 1, cam = null, L = null;
    var litCanvas = null, sprite = null, spriteBox = null, vol = null, vctx = null, volQ = 1 / 3;
    var dot = null, star = null;
    var motes = [], bokeh = [], studs = [], flies = [];
    var knuckle = null, neckLen = 0.12;
    var head = null;
    var progress = 0;
    var tgt = { x: 0, y: 0, vx: 0, vy: 0, init: false }; // sprung screen target of the beam
    var aimPt = null, aimMode = 'sweep', lastInput = -1e9;
    var clock = 0, lastNow = 0, igniteAt = (opts.igniteDelay != null ? opts.igniteDelay : 250) / 1000;
    var raf = 0, running = false, destroyed = false, userPaused = false, visible = true, motionPaused = !!(GS && GS.motionPaused);
    var frames = 0, times = [], lastMs = 0, maxMs = 0;
    var cssState = '', offsetsAt = -1;
    var R = rng(7);
    var ready = false;

    /* ---------------- building the street (static) ---------------- */
    function tone(alb, lit, z) {
      if (lit) {
        var c = cscale(cmul(alb, LAMP), LIT_GAIN);
        c = [c[0] / (1 + c[0] / KNEE), c[1] / (1 + c[1] / KNEE), c[2] / (1 + c[2] / KNEE)];
        return z > 25 ? cmix(c, FOG, 1 - Math.exp(-(z - 25) / 90)) : c;
      }
      return cmix(cmul(alb, MOON), FOG, 1 - Math.exp(-z / 60));
    }

    function noiseTile(seed, size, amp) {
      // fine grain drawn at half size and scaled up smooth, so the road reads as worn asphalt, not TV static
      var c = makeCanvas(size, size), g = c.getContext('2d'), r = rng(seed);
      var h = size / 2, fine = makeCanvas(h, h), fg = fine.getContext('2d');
      var img = fg.createImageData(h, h), d = img.data;
      for (var i = 0; i < h * h; i++) {
        var v = r(), lum = v < 0.5 ? 0 : 255;
        d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = lum;
        d[i * 4 + 3] = Math.round(Math.pow(Math.abs(v - 0.5) * 2, 2.6) * 255 * amp);
      }
      fg.putImageData(img, 0, 0);
      g.imageSmoothingEnabled = true;
      g.drawImage(fine, 0, 0, size, size);
      // a few bigger aggregate stones
      for (i = 0; i < size * 0.9; i++) {
        g.fillStyle = r() < 0.5 ? 'rgba(255,255,255,' + (0.08 + r() * 0.12) + ')' : 'rgba(0,0,0,' + (0.1 + r() * 0.2) + ')';
        g.beginPath(); g.arc(r() * size, r() * size, 0.6 + r() * 1.3, 0, TAU); g.fill();
      }
      return c;
    }

    function drawStreet(ctx, isLit) {
      var r = rng(11);
      var hz = cam.horizon, P = function (x, y, z) { return cam.p(x, y, z); };
      var ZF = 900;
      ctx.save();
      // sky (the unlit layer only)
      if (!isLit) {
        var sky = ctx.createLinearGradient(0, 0, 0, Math.max(hz, 1) + 2);
        sky.addColorStop(0, '#050507');
        sky.addColorStop(0.7, '#08080c');
        sky.addColorStop(1, '#121219');
        ctx.fillStyle = sky; ctx.fillRect(0, 0, W, Math.max(hz, 0) + 2);
        // the hills around Guwahati, two layers
        var hr = rng(5);
        for (var layer = 0; layer < 2; layer++) {
          ctx.beginPath(); ctx.moveTo(0, hz + 2);
          var amp = (layer ? 0.016 : 0.028) * H, ph = hr() * 10;
          for (var x = 0; x <= W + 8; x += 8) {
            var u = x / W;
            var y = hz - amp * (0.55 + 0.45 * Math.sin(u * 5.1 + ph) * Math.sin(u * 2.3 + ph * 0.7) + 0.18 * Math.sin(u * 17 + ph));
            ctx.lineTo(x, y);
          }
          ctx.lineTo(W, hz + 2); ctx.closePath();
          ctx.fillStyle = layer ? '#09090d' : '#0c0c12'; ctx.fill();
        }
        // a few stars
        var st = rng(3);
        for (var i = 0; i < 46; i++) {
          var sy = st() * (hz - 0.035 * H), sxp = st() * W;
          if (sy < 4) continue;
          ctx.fillStyle = 'rgba(243,239,230,' + (0.08 + st() * 0.26).toFixed(2) + ')';
          ctx.fillRect(sxp, sy, st() < 0.15 ? 1.4 : 0.9, st() < 0.15 ? 1.4 : 0.9);
        }
      }
      // ground base (verge soil)
      ctx.fillStyle = rgba(tone(A.soil, isLit, 30));
      ctx.fillRect(0, Math.max(0, hz), W, H - hz + 2);

      // ---- road
      var roadL = -3.35, roadR = 3.65;
      var road = [P(roadL, 0, 0.6), P(roadR, 0, 0.6), P(roadR, 0, ZF), P(roadL, 0, ZF)];
      // depth gradient for the asphalt (near → far)
      var gy0 = cam.depthY(4), gy1 = hz;
      var gr = ctx.createLinearGradient(0, gy0, 0, gy1);
      gr.addColorStop(0, rgba(tone(A.asphalt, isLit, 5)));
      gr.addColorStop(0.45, rgba(tone(A.asphalt, isLit, 14)));
      gr.addColorStop(0.8, rgba(tone(A.asphalt, isLit, 45)));
      gr.addColorStop(1, rgba(tone(A.asphalt, isLit, 300)));
      fillPoly(ctx, road, gr);
      // polished wheel tracks in each lane, and a couple of tar patches
      [-2.35, -0.95, 1.25, 2.65].forEach(function (cx) {
        var q = [P(cx - 0.42, 0, 0.6), P(cx + 0.42, 0, 0.6), P(cx + 0.42, 0, ZF), P(cx - 0.42, 0, ZF)];
        var g = ctx.createLinearGradient(0, gy0, 0, gy1);
        g.addColorStop(0, rgba(tone(A.wear, isLit, 5), 0.55)); g.addColorStop(0.7, rgba(tone(A.wear, isLit, 30), 0.3)); g.addColorStop(1, rgba(tone(A.wear, isLit, 200), 0));
        fillPoly(ctx, q, g);
      });
      [[-1.6, 9.5, 1.3, 2.2], [2.2, 23, 0.9, 1.6], [-0.4, 31, 1.6, 2.6]].forEach(function (p) {
        var c = P(p[0], 0, p[1]), e1 = P(p[0] + p[2], 0, p[1]), e2 = P(p[0], 0, p[1] + p[3]);
        ctx.save();
        ctx.setTransform(dpr * (e1[0] - c[0]), dpr * (e1[1] - c[1]), dpr * (e2[0] - c[0]), dpr * (e2[1] - c[1]), dpr * c[0], dpr * c[1]);
        var g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
        g.addColorStop(0, rgba(tone(A.patch, isLit, p[1]), 0.7)); g.addColorStop(1, rgba(tone(A.patch, isLit, p[1]), 0));
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 1, 0, TAU); ctx.fill();
        ctx.restore();
      });
      // lane paint: dashed centre line, solid edge lines, a zebra crossing with its stop line
      var paint = function (x0, x1, z0, z1, a) {
        var zc = (z0 + z1) / 2;
        fillPoly(ctx, [P(x0, 0, z0), P(x1, 0, z0), P(x1, 0, z1), P(x0, 0, z1)], rgba(tone(A.paint, isLit, zc), a == null ? 0.9 : a));
      };
      for (var z = 1.5; z < 260; z += 9) paint(0.08, 0.22, z, z + 3.6, 0.88);
      paint(roadL + 0.22, roadL + 0.36, 0.6, 400, 0.8);
      paint(roadR - 0.36, roadR - 0.22, 0.6, 400, 0.8);
      paint(roadL + 0.4, 0.08, 14.4, 14.85, 0.85); // stop line, our lane
      for (var zx = roadL + 0.55; zx < roadR - 0.5; zx += 1.0) paint(zx, zx + 0.5, 16, 19.6, 0.9);
      // asphalt grain, finer with distance
      var tile = noiseTile(21, 128, isLit ? 0.55 : 0.4);
      var pat = ctx.createPattern(tile, 'repeat');
      ctx.save();
      path(ctx, road); ctx.clip();
      var zs = [0.6, 2, 3.5, 5, 7, 9.5, 13, 18, 25, 36, 55, 90, 160];
      for (var b = 0; b < zs.length - 1; b++) {
        var ya = cam.depthY(zs[b]), yb = cam.depthY(zs[b + 1]);
        if (ya < 0) continue;
        var zm = (zs[b] + zs[b + 1]) / 2, pxm = cam.f / cam.p(0, 0, zm)[2]; // px per metre at that depth
        var squash = (ya - yb) / Math.max(0.01, pxm * (zs[b + 1] - zs[b]));
        var sc = pxm * 0.9 / 128; // one tile ≈ 0.9 m of road
        ctx.save();
        ctx.beginPath(); ctx.rect(0, yb, W, ya - yb + 0.5); ctx.clip();
        ctx.setTransform(dpr * sc, 0, 0, dpr * sc * clamp(squash, 0.05, 1), dpr * (b * 37 % 128), dpr * yb);
        ctx.globalAlpha = (isLit ? 0.42 : 0.34) * (1 - sstep(30, 160, zm));
        ctx.fillStyle = pat;
        ctx.fillRect(-W, 0, 4 * W / sc + 256, (ya - yb) / (sc * clamp(squash, 0.05, 1)) + 128);
        ctx.restore();
      }
      ctx.restore();

      // ---- footpaths (raised 15 cm) with paver joints
      var fp = function (x0, x1) {
        var q = [P(x0, 0.15, 0.6), P(x1, 0.15, 0.6), P(x1, 0.15, ZF), P(x0, 0.15, ZF)];
        var g = ctx.createLinearGradient(0, gy0, 0, gy1);
        g.addColorStop(0, rgba(tone(A.paver, isLit, 5))); g.addColorStop(0.6, rgba(tone(A.paver, isLit, 20))); g.addColorStop(1, rgba(tone(A.paver, isLit, 300)));
        fillPoly(ctx, q, g);
        ctx.lineWidth = 1;
        for (var zz = 1; zz < 46; zz += 0.6) {
          var a = P(x0, 0.15, zz), bq = P(x1, 0.15, zz);
          ctx.strokeStyle = rgba(tone(A.joint, isLit, zz), 0.8 * (1 - sstep(16, 46, zz)));
          ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(bq[0], bq[1]); ctx.stroke();
        }
        for (var xx = x0 + 0.5; xx < x1 - 0.1; xx += 0.5) {
          var a2 = P(xx, 0.15, 0.6), b2 = P(xx, 0.15, 60);
          var lg = ctx.createLinearGradient(a2[0], a2[1], b2[0], b2[1]);
          lg.addColorStop(0, rgba(tone(A.joint, isLit, 4), 0.8)); lg.addColorStop(1, rgba(tone(A.joint, isLit, 60), 0));
          ctx.strokeStyle = lg; ctx.beginPath(); ctx.moveTo(a2[0], a2[1]); ctx.lineTo(b2[0], b2[1]); ctx.stroke();
        }
      };
      fp(-5.7, -3.6); fp(3.9, 5.7);

      // ---- black-and-yellow kerbs, far to near
      var kerb = function (xIn, xOut, faceX) {
        for (var zk = 200, n = 200; zk > 0.4; zk -= 1, n--) {
          var col = (n % 2) ? A.kerbY : A.kerbK, z0 = zk - 1, z1 = zk;
          if (z0 < 0.4) z0 = 0.4;
          fillPoly(ctx, [P(faceX, 0, z0), P(faceX, 0, z1), P(faceX, 0.15, z1), P(faceX, 0.15, z0)], rgba(cscale(tone(col, isLit, zk), 0.8)));
          fillPoly(ctx, [P(xIn, 0.15, z0), P(xOut, 0.15, z0), P(xOut, 0.15, z1), P(xIn, 0.15, z1)], rgba(tone(col, isLit, zk)));
        }
      };
      kerb(-3.6, -3.35, -3.35); kerb(3.65, 3.9, 3.65);

      // ---- tea estate on both verges: a flat-topped hedge of tea bushes, planted in rows
      var hedge = function (side) {
        var xf = side < 0 ? -6.05 : 6.15, xo = side * 40, top = 1.0;
        var face = [P(xf, 0, 0.6), P(xf, 0, ZF), P(xf, top, ZF), P(xf, top, 0.6)];
        var g = ctx.createLinearGradient(0, gy0, 0, gy1);
        g.addColorStop(0, rgba(tone(A.leafDk, isLit, 5))); g.addColorStop(1, rgba(tone(A.leafDk, isLit, 200)));
        fillPoly(ctx, face, g);
        var topq = [P(xf, top, 0.6), P(xo, top, 0.6), P(xo, top, ZF), P(xf, top, ZF)];
        var g2 = ctx.createLinearGradient(0, cam.depthY(4, top), 0, hz);
        g2.addColorStop(0, rgba(tone(A.leaf, isLit, 5))); g2.addColorStop(0.7, rgba(tone(A.leaf, isLit, 40))); g2.addColorStop(1, rgba(tone(A.leaf, isLit, 300)));
        fillPoly(ctx, topq, g2);
        // rows between the bushes
        ctx.lineWidth = 1.2;
        for (var rx = xf + side * 1.2; Math.abs(rx) < 26; rx += side * 1.25) {
          var a = P(rx, top, 0.6), bq = P(rx, top, 120);
          var lg = ctx.createLinearGradient(a[0], a[1], bq[0], bq[1]);
          lg.addColorStop(0, rgba(tone(A.leafDk, isLit, 4), 0.9)); lg.addColorStop(1, rgba(tone(A.leafDk, isLit, 120), 0));
          ctx.strokeStyle = lg; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(bq[0], bq[1]); ctx.stroke();
        }
        // leaves: clusters on the top and down the face
        var lr = rng(side < 0 ? 41 : 43);
        for (var i = 0; i < 1500; i++) {
          var zz = 0.8 + 70 * lr() * lr(), onFace = lr() < 0.38;
          var xx = onFace ? xf + side * 0.01 : xf + side * (0.05 + lr() * 14);
          var yy = onFace ? lr() * top : top + 0.01;
          var c = P(xx, yy, zz);
          if (c[1] < hz - 2 || c[0] < -30 || c[0] > W + 30 || c[1] > H + 30) continue;
          var rad = cam.f * (0.07 + lr() * 0.09) / c[2];
          if (rad < 0.5) continue;
          var al = lr();
          ctx.fillStyle = rgba(tone(al < 0.4 ? A.leaf2 : al < 0.75 ? A.leaf : A.leafDk, isLit, zz), 0.85);
          ctx.beginPath(); ctx.ellipse(c[0], c[1], rad, rad * (onFace ? 0.8 : 0.42), 0, 0, TAU); ctx.fill();
        }
      };
      hedge(-1); hedge(1);

      // ---- shade trees of the estate, as silhouettes on the far left (unlit layer only)
      if (!isLit) {
        var tr = rng(17);
        [[-11, 48], [-17, 70], [-9.5, 96], [-22, 120], [13, 140], [-14, 160]].forEach(function (t) {
          var base = P(t[0], 1, t[1]), topP = P(t[0] + 0.3, 9.5, t[1]);
          var wpx = cam.f * 0.16 / base[2];
          ctx.fillStyle = '#060609';
          ctx.beginPath(); ctx.moveTo(base[0] - wpx, base[1]); ctx.lineTo(topP[0] - wpx * 0.5, topP[1]); ctx.lineTo(topP[0] + wpx * 0.5, topP[1]); ctx.lineTo(base[0] + wpx, base[1]); ctx.fill();
          var cw = cam.f * (3.2 + tr() * 1.6) / base[2], ch = cam.f * (0.9 + tr() * 0.5) / base[2];
          for (var k = 0; k < 5; k++) {
            ctx.beginPath();
            ctx.ellipse(topP[0] + (tr() - 0.5) * cw * 0.9, topP[1] + (tr() - 0.6) * ch * 0.7, cw * (0.35 + tr() * 0.3), ch * (0.45 + tr() * 0.3), 0, 0, TAU);
            ctx.fill();
          }
        });
      }

      // ---- an NH-37 milestone on the left footpath (white stone, yellow cap)
      (function () {
        var x = -4.25, z = 11.5, w = 0.46, h = 0.62, cap = 0.23, d = 0.16;
        var base = 0.15;
        var c0 = P(x - w / 2, base, z), c1 = P(x + w / 2, base, z), t0 = P(x - w / 2, base + h, z), t1 = P(x + w / 2, base + h, z);
        var side = [P(x + w / 2, base, z), P(x + w / 2, base, z + d), P(x + w / 2, base + h, z + d), P(x + w / 2, base + h, z)];
        fillPoly(ctx, side, rgba(cscale(tone(A.stoneW, isLit, z), 0.55)));
        fillPoly(ctx, [c0, c1, t1, t0], rgba(tone(A.stoneW, isLit, z)));
        // yellow dome cap
        var cc = P(x, base + h, z), rr = (t1[0] - t0[0]) / 2, ry = rr * 1.05;
        ctx.fillStyle = rgba(tone(A.stoneY, isLit, z));
        ctx.beginPath(); ctx.moveTo(t0[0], t0[1]); ctx.ellipse(cc[0], cc[1], rr, ry, 0, Math.PI, TAU); ctx.lineTo(t1[0], t1[1]); ctx.closePath(); ctx.fill();
        // lettering: route on the cap, place on the stone
        var px = rr * 2;
        if (px > 10) {
          ctx.fillStyle = rgba(tone(A.ink, isLit, z), 0.9);
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.font = '700 ' + (px * 0.26).toFixed(1) + 'px "Geist Mono", ui-monospace, monospace';
          ctx.fillText('NH 37', cc[0], cc[1] - ry * 0.35);
          ctx.font = '600 ' + (px * 0.15).toFixed(1) + 'px "Geist Mono", ui-monospace, monospace';
          ctx.fillText('GUWAHATI', cc[0], (cc[1] + c0[1]) / 2 - (c0[1] - cc[1]) * 0.05);
        }
        void cap;
      })();

      // ---- the row of street lights further down the road (poles; their light is added afterwards)
      ctx.restore();
    }

    var DISTANT = [26, 50, 74, 98, 122, 146, 170, 194, 218];
    function distantHead(z) { return [3.0, 7.0, z]; }
    function drawDistantPoles(ctx) {
      DISTANT.forEach(function (z) {
        var b = cam.p(5.0, 0.15, z), t = cam.p(5.0, 7.3, z), hd = cam.pv(distantHead(z));
        var wpx = Math.max(0.7, cam.f * 0.07 / b[2]);
        var fog = Math.exp(-z / 120);
        var g = ctx.createLinearGradient(0, b[1], 0, t[1]);
        g.addColorStop(0, rgba(cmul(A.pole, [0.18, 0.15, 0.11]), 1)); g.addColorStop(1, rgba(cmul(A.pole, [0.03, 0.03, 0.04]), 1));
        ctx.globalAlpha = 0.5 + 0.5 * fog;
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.moveTo(b[0] - wpx, b[1]); ctx.lineTo(t[0] - wpx * 0.7, t[1]); ctx.lineTo(t[0] + wpx * 0.7, t[1]); ctx.lineTo(b[0] + wpx, b[1]); ctx.fill();
        // arm out over the road and a small head
        ctx.strokeStyle = '#121216'; ctx.lineWidth = Math.max(0.8, wpx * 1.1);
        ctx.beginPath(); ctx.moveTo(t[0], t[1]); ctx.quadraticCurveTo(t[0], hd[1] - (t[1] - hd[1]) * 0.6, hd[0], hd[1]); ctx.stroke();
        ctx.globalAlpha = 1;
      });
    }
    function drawDistantLight(ctx, maskOnly) {
      DISTANT.forEach(function (z, i) {
        var fog = Math.exp(-(z - 20) / 95);
        var hd = cam.pv(distantHead(z));
        if (maskOnly) {
          // the pool each one throws on the road
          var g0 = [2.3, 0, z + 0.6], rr = 4.2;
          var c = cam.pv(g0), e1 = cam.p(g0[0] + rr * 1.15, 0, g0[2]), e2 = cam.p(g0[0], 0, g0[2] + rr);
          ctx.save();
          ctx.setTransform(dpr * (e1[0] - c[0]), dpr * (e1[1] - c[1]), dpr * (e2[0] - c[0]), dpr * (e2[1] - c[1]), dpr * c[0], dpr * c[1]);
          var g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1.25);
          var k = 0.62 * fog;
          g.addColorStop(0, 'rgba(0,0,0,' + k + ')'); g.addColorStop(0.45, 'rgba(0,0,0,' + (k * 0.6) + ')'); g.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 1.25, 0, TAU); ctx.fill();
          ctx.restore();
          return;
        }
        // their cones (very faint) and the glowing heads
        var gp = cam.p(2.3, 0, z + 0.6), wv = cam.f * 3.4 / gp[2];
        var cg = ctx.createLinearGradient(hd[0], hd[1], gp[0], gp[1]);
        cg.addColorStop(0, 'rgba(255,228,180,' + (0.10 * fog) + ')'); cg.addColorStop(1, 'rgba(255,210,150,0)');
        ctx.fillStyle = cg;
        ctx.beginPath(); ctx.moveTo(hd[0] - 1, hd[1]); ctx.lineTo(gp[0] - wv, gp[1]); ctx.lineTo(gp[0] + wv, gp[1]); ctx.lineTo(hd[0] + 1, hd[1]); ctx.fill();
        var s = Math.max(1.2, cam.f * 0.22 / hd[2]);
        var hg = ctx.createRadialGradient(hd[0], hd[1], 0, hd[0], hd[1], s * 9);
        hg.addColorStop(0, 'rgba(255,246,226,' + (0.95 * (0.4 + 0.6 * fog)) + ')');
        hg.addColorStop(0.08, 'rgba(255,214,150,' + (0.55 * fog + 0.1) + ')');
        hg.addColorStop(0.35, 'rgba(255,150,60,' + (0.12 * fog) + ')');
        hg.addColorStop(1, 'rgba(255,120,30,0)');
        ctx.fillStyle = hg; ctx.fillRect(hd[0] - s * 9, hd[1] - s * 9, s * 18, s * 18);
        void i;
      });
    }

    /* ---------------- the luminaire: arm + solar panel (static sprite) and the LED head (live) ---------------- */
    function shade(n, p, base, warm) {
      var v = vnorm(vsub(cam.pos, p));
      var k = Math.max(0, vdot(n, KEY));
      var nv = Math.max(0, vdot(n, v));
      var rim = Math.pow(1 - nv, 3) * 0.55;
      var h = vnorm(vadd(KEY, v));
      var spec = Math.pow(Math.max(0, vdot(n, h)), 36) * 0.9;
      var down = Math.max(0, -n[1]) * (warm || 0);
      var c = cmul(base, cadd(cadd([0.012, 0.012, 0.016], cscale(KEYC, k)), cscale(LAMP, down)));
      return cadd(cadd(c, cscale(RIMC, rim)), cscale([0.55, 0.6, 0.7], spec));
    }

    function bezier(p0, p1, p2, p3, t) {
      var u = 1 - t;
      return [0, 1, 2].map(function (i) { return u * u * u * p0[i] + 3 * u * u * t * p1[i] + 3 * u * t * t * p2[i] + t * t * t * p3[i]; });
    }

    function buildLamp() {
      // the bracket (knuckle) sits on the ray through the lamp's screen position
      var d = vnorm(cam.ray(L.lamp[0] * W, L.lamp[1] * H));
      knuckle = vadd(cam.pos, vmul(d, L.lampDist));
      var K = knuckle;
      // a swan-neck arm from the bracket, up and out through the top of the frame
      var arm = { p0: vadd(K, [0.02, 0.05, 0.02]), p1: vadd(K, [0.34, 0.16, 0.06]), p2: vadd(K, [0.5, 0.62, 0.14]), p3: vadd(K, [0.52, 3.8, 0.34]), r: 0.036 };
      var pts = [];
      for (var i = 0; i <= 24; i++) pts.push(cam.pv(bezier(arm.p0, arm.p1, arm.p2, arm.p3, i / 24)));
      var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      pts.forEach(function (p) { minX = Math.min(minX, p[0]); minY = Math.min(minY, p[1]); maxX = Math.max(maxX, p[0]); maxY = Math.max(maxY, p[1]); });
      minX = Math.floor(Math.max(-40, minX - 30)); minY = Math.floor(Math.max(-40, minY - 30));
      maxX = Math.ceil(Math.min(W + 40, maxX + 30)); maxY = Math.ceil(Math.min(H + 40, maxY + 30));
      spriteBox = { x: minX, y: minY, w: Math.max(1, maxX - minX), h: Math.max(1, maxY - minY) };
      sprite = makeCanvas(Math.ceil(spriteBox.w * dpr), Math.ceil(spriteBox.h * dpr));
      var g = sprite.getContext('2d');
      g.setTransform(dpr, 0, 0, dpr, -minX * dpr, -minY * dpr);
      drawArm(g, arm);
      // all-in-one head: solar cells on top, LED modules underneath, battery inside
      var HL = 1.12, HW = 0.42;
      var leds = [];
      for (var m = 0; m < 3; m++) for (var a2 = 0; a2 < 6; a2++) for (var b2 = 0; b2 < 3; b2++) leds.push({ s: 0.36 + m * 0.24 + a2 * 0.032, z: -0.07 + b2 * 0.07, m: m });
      head = {
        L: HL, Wd: HW, T: 0.082,
        outline: rrect(0, HL, -HW / 2, HW / 2, 0.03, 0.05, 4),
        glass: rrect(0.06, HL - 0.035, -HW / 2 + 0.026, HW / 2 - 0.026, 0.01, 0.025, 3),
        face: rrect(0.3, HL - 0.05, -0.13, 0.13, 0.02, 0.03, 3),
        leds: leds
      };
    }

    function drawArm(g, arm) {
      var n = 40, left = [], right = [], mid = [];
      for (var i = 0; i <= n; i++) {
        var t = i / n, p = bezier(arm.p0, arm.p1, arm.p2, arm.p3, t);
        var q = cam.pv(p), q2 = cam.pv(bezier(arm.p0, arm.p1, arm.p2, arm.p3, Math.min(1, t + 0.01)));
        var q0 = cam.pv(bezier(arm.p0, arm.p1, arm.p2, arm.p3, Math.max(0, t - 0.01)));
        var tx = q2[0] - q0[0], ty = q2[1] - q0[1], tl = Math.hypot(tx, ty) || 1;
        var nx = -ty / tl, ny = tx / tl, r = cam.f * arm.r / q[2] * (1 - 0.12 * t);
        left.push([q[0] + nx * r, q[1] + ny * r]); right.push([q[0] - nx * r, q[1] - ny * r]); mid.push([q[0], q[1], nx, ny, r]);
      }
      g.beginPath(); g.moveTo(left[0][0], left[0][1]);
      for (i = 1; i <= n; i++) g.lineTo(left[i][0], left[i][1]);
      for (i = n; i >= 0; i--) g.lineTo(right[i][0], right[i][1]);
      g.closePath();
      g.fillStyle = rgba([0.03, 0.032, 0.04]); g.fill();
      // cylindrical shading: cool key highlight on one side, warm bounce from the road on the other
      g.lineCap = 'round';
      for (i = 0; i < n; i++) {
        var a = mid[i], b = mid[i + 1], fade = 1 - i / n;
        g.strokeStyle = 'rgba(120,132,158,' + (0.5 * fade + 0.12).toFixed(2) + ')';
        g.lineWidth = Math.max(0.8, a[4] * 0.55);
        g.beginPath(); g.moveTo(a[0] - a[2] * a[4] * 0.3, a[1] - a[3] * a[4] * 0.3); g.lineTo(b[0] - b[2] * b[4] * 0.3, b[1] - b[3] * b[4] * 0.3); g.stroke();
        g.strokeStyle = 'rgba(214,226,246,' + (0.55 * fade + 0.1).toFixed(2) + ')';
        g.lineWidth = Math.max(0.6, a[4] * 0.14);
        g.beginPath(); g.moveTo(a[0] - a[2] * a[4] * 0.5, a[1] - a[3] * a[4] * 0.5); g.lineTo(b[0] - b[2] * b[4] * 0.5, b[1] - b[3] * b[4] * 0.5); g.stroke();
        g.strokeStyle = 'rgba(255,190,120,' + (0.3 * fade * fade).toFixed(2) + ')';
        g.lineWidth = Math.max(0.6, a[4] * 0.2);
        g.beginPath(); g.moveTo(a[0] + a[2] * a[4] * 0.72, a[1] + a[3] * a[4] * 0.72); g.lineTo(b[0] + b[2] * b[4] * 0.72, b[1] + b[3] * b[4] * 0.72); g.stroke();
      }
      // clamp collar near the bend
      var cp = cam.pv(bezier(arm.p0, arm.p1, arm.p2, arm.p3, 0.5)), cr = cam.f * arm.r * 1.3 / cp[2];
      g.fillStyle = '#16171c'; g.beginPath(); g.ellipse(cp[0], cp[1], cr, cr * 0.6, -0.5, 0, TAU); g.fill();
      g.strokeStyle = 'rgba(200,212,236,.4)'; g.lineWidth = 1; g.beginPath(); g.ellipse(cp[0], cp[1], cr, cr * 0.6, -0.5, Math.PI * 1.05, Math.PI * 1.9); g.stroke();
    }

    // the head's frame for this moment: it swivels on its bracket toward the target, partly
    var REST_DOWN = vnorm([-0.22, -1, 0.05]), AIM = 0.42;
    function headFrame(G0, tilt) {
      var K = knuckle;
      var Fc = vadd(K, [-0.6, -0.1, 0.1]);
      var D = vnorm(vsub(G0, Fc));
      var dn = vnorm(vadd(vmul(REST_DOWN, 1 - AIM), vmul(D, AIM)));
      // scrolling away tips the nose down, as if the lamp were bowing out
      var nose0 = vnorm([-1, 0.06 - tilt * 0.75, -0.42 + tilt * 0.2]);
      var a = vnorm(vsub(nose0, vmul(dn, vdot(nose0, dn))));
      var u = vmul(dn, -1);
      var w = vcross(a, u);
      return { a: a, u: u, w: w, o: vadd(K, vmul(a, 0.05)) };
    }

    function drawHead(ctx, F, glow, mod) {
      var Hd = head, o = F.o, a = F.a, u = F.u, w = F.w;
      var P = function (s, y, z) { return vcomb(o, a, s, u, y, w, z); };
      var T = Hd.T, yBot = -T;
      var outl = Hd.outline, n = outl.length;
      var top3 = [], bot3 = [], topS = [], botS = [], i;
      for (i = 0; i < n; i++) {
        var q = outl[i];
        top3.push(P(q[0], 0, q[1])); bot3.push(P(q[0], yBot, q[1]));
        topS.push(cam.pv(top3[i])); botS.push(cam.pv(bot3[i]));
      }
      var center = P(Hd.L / 2, -T / 2, 0);
      var nTop = u, nBot = vmul(u, -1);
      var topC = P(Hd.L / 2, 0, 0), faceC = P(Hd.L * 0.62, yBot, 0);
      var topVis = vdot(nTop, vsub(cam.pos, topC)) > 0;
      var botVis = vdot(nBot, vsub(cam.pos, faceC)) > 0;

      // light escaping under the lip (drawn first: the housing hides the far side of it)
      if (glow > 0.01) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.lineJoin = 'round';
        path(ctx, botS);
        ctx.strokeStyle = 'rgba(255,214,150,' + (0.16 * glow).toFixed(3) + ')'; ctx.lineWidth = 9; ctx.stroke();
        ctx.strokeStyle = 'rgba(255,236,200,' + (0.45 * glow).toFixed(3) + ')'; ctx.lineWidth = 3; ctx.stroke();
        ctx.strokeStyle = 'rgba(255,250,236,' + (0.9 * Math.min(1, glow)).toFixed(3) + ')'; ctx.lineWidth = 1.2; ctx.stroke();
        ctx.restore();
      }

      // bracket + knuckle
      var k0 = cam.pv(knuckle), k1 = cam.pv(P(0.06, -T * 0.55, 0));
      var nr = cam.f * 0.032 / k0[2];
      ctx.strokeStyle = '#111217'; ctx.lineCap = 'round'; ctx.lineWidth = nr * 2;
      ctx.beginPath(); ctx.moveTo(k0[0], k0[1]); ctx.lineTo(k1[0], k1[1]); ctx.stroke();
      var kr = cam.f * 0.048 / k0[2];
      var kg = ctx.createRadialGradient(k0[0] - kr * 0.35, k0[1] - kr * 0.45, kr * 0.08, k0[0], k0[1], kr);
      kg.addColorStop(0, '#6a7080'); kg.addColorStop(0.45, '#22242c'); kg.addColorStop(1, '#0a0b0e');
      ctx.fillStyle = kg; ctx.beginPath(); ctx.arc(k0[0], k0[1], kr, 0, TAU); ctx.fill();

      // side walls (convex slab: every wall facing us can be drawn in any order)
      var bounce = 0.32 * glow;
      for (i = 0; i < n; i++) {
        var j = (i + 1) % n;
        var ns = (outl[i][2] + outl[j][2]) / 2, nz = (outl[i][3] + outl[j][3]) / 2;
        var nrm = vnorm(vcomb([0, 0, 0], a, ns, w, nz, u, 0));
        var mid = vmul(vadd(vadd(top3[i], top3[j]), vadd(bot3[i], bot3[j])), 0.25);
        if (vdot(nrm, vsub(cam.pos, mid)) <= 0) continue;
        var col = shade(nrm, mid, [0.2, 0.21, 0.235], 0);
        var pts = [topS[i], topS[j], botS[j], botS[i]];
        var gg = ctx.createLinearGradient((topS[i][0] + topS[j][0]) / 2, (topS[i][1] + topS[j][1]) / 2, (botS[i][0] + botS[j][0]) / 2, (botS[i][1] + botS[j][1]) / 2);
        gg.addColorStop(0, rgba(cscale(col, 1.15))); gg.addColorStop(1, rgba(cadd(cscale(col, 0.7), cscale(LAMP, bounce * 0.12))));
        fillPoly(ctx, pts, gg);
        ctx.strokeStyle = gg; ctx.lineWidth = 0.7; ctx.stroke();
      }

      if (topVis) {
        // aluminium frame
        var fc = shade(nTop, topC, [0.3, 0.315, 0.345], 0);
        fillPoly(ctx, topS, rgba(fc));
        // the solar glass: 2 × 8 monocrystalline cells
        var gl = Hd.glass.map(function (q2) { return cam.pv(P(q2[0], 0.001, q2[1])); });
        var g0 = cam.pv(P(0.06, 0.001, 0)), g1 = cam.pv(P(Hd.L, 0.001, 0));
        var v = vnorm(vsub(cam.pos, topC)), h = vnorm(vadd(KEY, v));
        var spec = Math.pow(Math.max(0, vdot(nTop, h)), 6);
        var sky = ctx.createLinearGradient(g0[0], g0[1], g1[0], g1[1]);
        sky.addColorStop(0, rgba([0.004 + spec * 0.02, 0.006 + spec * 0.026, 0.016 + spec * 0.05]));
        sky.addColorStop(0.6, rgba([0.007 + spec * 0.04, 0.011 + spec * 0.05, 0.03 + spec * 0.09]));
        sky.addColorStop(1, rgba([0.012 + spec * 0.06, 0.018 + spec * 0.07, 0.05 + spec * 0.12]));
        fillPoly(ctx, gl, sky);
        ctx.save();
        path(ctx, gl); ctx.clip();
        var s0 = 0.06, s1 = Hd.L - 0.035, z0 = -Hd.Wd / 2 + 0.026, z1 = Hd.Wd / 2 - 0.026, nu = 8, nv = 2;
        var Gp = function (iu, iv) { return cam.pv(P(s0 + (s1 - s0) * iu / nu, 0.0015, z0 + (z1 - z0) * iv / nv)); };
        ctx.lineWidth = 0.6; ctx.strokeStyle = 'rgba(150,170,214,.14)';
        for (i = 0; i < nu; i++) for (var bb = 1; bb < 4; bb++) { var p0 = Gp(i + bb / 4, 0), p1 = Gp(i + bb / 4, nv); ctx.beginPath(); ctx.moveTo(p0[0], p0[1]); ctx.lineTo(p1[0], p1[1]); ctx.stroke(); }
        ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(176,194,232,.42)';
        for (i = 1; i < nu; i++) { var c0 = Gp(i, 0), c1 = Gp(i, nv); ctx.beginPath(); ctx.moveTo(c0[0], c0[1]); ctx.lineTo(c1[0], c1[1]); ctx.stroke(); }
        var m0 = Gp(0, 1), m1 = Gp(nu, 1); ctx.beginPath(); ctx.moveTo(m0[0], m0[1]); ctx.lineTo(m1[0], m1[1]); ctx.stroke();
        // the cut corners of mono cells, where four cells meet
        ctx.fillStyle = 'rgba(206,218,244,.5)';
        for (i = 1; i < nu; i++) {
          var dA = Gp(i - 0.09, 1), dB = Gp(i, 1 - 0.13), dC = Gp(i + 0.09, 1), dD = Gp(i, 1 + 0.13);
          ctx.beginPath(); ctx.moveTo(dA[0], dA[1]); ctx.lineTo(dB[0], dB[1]); ctx.lineTo(dC[0], dC[1]); ctx.lineTo(dD[0], dD[1]); ctx.fill();
        }
        // a sheen that slides across the glass as the head turns
        var sh0 = cam.pv(P(s0, 0.002, z1)), sh1 = cam.pv(P(s1, 0.002, z0));
        var sw = clamp(0.5 + (a[0] + 0.85) * 1.6, 0.12, 0.88);
        var shg = ctx.createLinearGradient(sh0[0], sh0[1], sh1[0], sh1[1]);
        shg.addColorStop(0, 'rgba(190,206,255,0)'); shg.addColorStop(clamp(sw - 0.12, 0, 1), 'rgba(190,206,255,.02)');
        shg.addColorStop(sw, 'rgba(220,230,255,.2)'); shg.addColorStop(clamp(sw + 0.05, 0, 1), 'rgba(190,206,255,.03)'); shg.addColorStop(1, 'rgba(190,206,255,0)');
        ctx.fillStyle = shg; path(ctx, gl); ctx.fill();
        ctx.restore();
        // chamfer: a crisp edge on the side nearest the camera
        ctx.strokeStyle = 'rgba(222,232,250,.5)'; ctx.lineWidth = 1;
        var best = -1, bi = 0;
        for (i = 0; i < n; i++) { var d0 = (topS[i][1] + topS[(i + 1) % n][1]) / 2; if (d0 > best) { best = d0; bi = i; } }
        ctx.beginPath();
        for (i = -6; i <= 6; i++) { var pp = topS[(bi + i + n) % n]; if (i === -6) ctx.moveTo(pp[0], pp[1]); else ctx.lineTo(pp[0], pp[1]); }
        ctx.stroke();
        ctx.strokeStyle = 'rgba(222,232,250,.16)'; path(ctx, topS); ctx.stroke();
        // charge indicator: volt green, breathing
        var sl = cam.pv(P(0.035, 0.002, 0.15));
        var sr = Math.max(1.1, cam.f * 0.007 / sl[2]);
        var breath = 0.55 + 0.45 * Math.sin(clock * 2.1);
        var sg = ctx.createRadialGradient(sl[0], sl[1], 0, sl[0], sl[1], sr * 7);
        sg.addColorStop(0, 'rgba(198,255,61,' + (0.85 * breath).toFixed(3) + ')'); sg.addColorStop(0.25, 'rgba(198,255,61,' + (0.3 * breath).toFixed(3) + ')'); sg.addColorStop(1, 'rgba(198,255,61,0)');
        ctx.fillStyle = sg; ctx.fillRect(sl[0] - sr * 7, sl[1] - sr * 7, sr * 14, sr * 14);
        ctx.fillStyle = '#ECFFB8'; ctx.beginPath(); ctx.arc(sl[0], sl[1], sr * 0.75, 0, TAU); ctx.fill();
      }
      if (botVis) {
        // the LED face: dark bezel, three modules of 18 lenses, a dusk sensor
        fillPoly(ctx, botS, rgba(shade(nBot, faceC, [0.16, 0.17, 0.19], bounce)));
        fillPoly(ctx, Hd.face.map(function (q2) { return cam.pv(P(q2[0], yBot - 0.001, q2[1])); }), '#0b0b0e');
        var fc0 = cam.pv(faceC), fa = cam.pv(vadd(faceC, vmul(a, 0.01))), fw = cam.pv(vadd(faceC, vmul(w, 0.01)));
        var ax = (fa[0] - fc0[0]) * 100, ay = (fa[1] - fc0[1]) * 100, wx = (fw[0] - fc0[0]) * 100, wy = (fw[1] - fc0[1]) * 100;
        Hd.leds.forEach(function (l) {
          var c = cam.pv(P(l.s, yBot - 0.003, l.z)), on = mod[l.m];
          ctx.setTransform(dpr * ax, dpr * ay, dpr * wx, dpr * wy, dpr * c[0], dpr * c[1]);
          if (on > 0.04) {
            ctx.fillStyle = 'rgba(255,214,150,' + (0.85 * Math.min(1, on)).toFixed(3) + ')'; ctx.beginPath(); ctx.arc(0, 0, 0.014, 0, TAU); ctx.fill();
            ctx.fillStyle = 'rgba(255,252,240,' + Math.min(1, on).toFixed(3) + ')'; ctx.beginPath(); ctx.arc(0, 0, 0.008, 0, TAU); ctx.fill();
          } else {
            ctx.fillStyle = '#26262c'; ctx.beginPath(); ctx.arc(0, 0, 0.012, 0, TAU); ctx.fill();
          }
        });
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }
      var tA = topS[0], tB = topS[Math.floor(n / 2)];
      return { face: cam.pv(faceC), faceVis: botVis, facing: Math.max(0, vdot(nBot, vnorm(vsub(cam.pos, faceC)))), size: Math.hypot(tA[0] - tB[0], tA[1] - tB[1]) };
    }

    /* ---------------- sizing / rebuild ---------------- */
    function build() {
      var r = host.getBoundingClientRect();
      W = Math.max(1, Math.round(r.width)); H = Math.max(1, Math.round(r.height));
      var dev = window.devicePixelRatio || 1;
      var budget = 2.4e6; // device pixels per canvas
      dpr = Math.min(dev, 2, Math.sqrt(budget / (W * H)));
      dpr = Math.max(0.75, Math.round(dpr * 100) / 100);
      L = layoutFor(W, H);
      cam = new Camera(W, H, L);
      [cScene, cFx].forEach(function (c) { c.width = Math.round(W * dpr); c.height = Math.round(H * dpr); });

      // lit street (offscreen) and the unlit street (visible)
      litCanvas = litCanvas || makeCanvas(1, 1);
      litCanvas.width = cScene.width; litCanvas.height = cScene.height;
      var lc = litCanvas.getContext('2d');
      lc.setTransform(dpr, 0, 0, dpr, 0, 0);
      lc.clearRect(0, 0, W, H);
      drawStreet(lc, true);
      sx.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawStreet(sx, false);
      // the other street lights down the road: their pools reveal the lit street, then poles and heads on top
      var mask = makeCanvas(cScene.width, cScene.height), mc = mask.getContext('2d');
      mc.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawDistantLight(mc, true);
      mc.setTransform(1, 0, 0, 1, 0, 0);
      mc.globalCompositeOperation = 'source-in';
      mc.drawImage(litCanvas, 0, 0);
      sx.setTransform(1, 0, 0, 1, 0, 0);
      sx.drawImage(mask, 0, 0);
      sx.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawDistantPoles(sx);
      sx.globalCompositeOperation = 'lighter';
      drawDistantLight(sx, false);
      sx.globalCompositeOperation = 'source-over';
      // haze over the far road
      var hz = cam.horizon, hg = sx.createLinearGradient(0, hz - 0.03 * H, 0, hz + 0.16 * H);
      hg.addColorStop(0, 'rgba(18,17,22,0)'); hg.addColorStop(0.3, 'rgba(22,19,22,.55)'); hg.addColorStop(1, 'rgba(14,13,17,0)');
      sx.fillStyle = hg; sx.fillRect(0, hz - 0.03 * H, W, 0.2 * H);

      // volumetric buffer
      vol = vol || makeCanvas(1, 1);
      vol.width = Math.ceil(W * volQ); vol.height = Math.ceil(H * volQ);
      vctx = vol.getContext('2d');

      // sprites
      if (!dot) {
        dot = makeCanvas(32, 32);
        var d = dot.getContext('2d'), dg = d.createRadialGradient(16, 16, 0, 16, 16, 16);
        dg.addColorStop(0, 'rgba(255,248,232,1)'); dg.addColorStop(0.25, 'rgba(255,232,190,.55)'); dg.addColorStop(1, 'rgba(255,200,140,0)');
        d.fillStyle = dg; d.fillRect(0, 0, 32, 32);
        star = makeCanvas(48, 48);
        var s = star.getContext('2d');
        s.translate(24, 24);
        var sgl = s.createRadialGradient(0, 0, 0, 0, 0, 24);
        sgl.addColorStop(0, 'rgba(255,240,200,1)'); sgl.addColorStop(0.12, 'rgba(255,200,110,.7)'); sgl.addColorStop(1, 'rgba(255,160,60,0)');
        s.fillStyle = sgl; s.fillRect(-24, -24, 48, 48);
        s.fillStyle = 'rgba(255,236,190,.8)';
        s.fillRect(-22, -0.6, 44, 1.2); s.fillRect(-0.6, -10, 1.2, 20);
      }
      buildLamp();

      // dust in the air (screen space, so it is evenly spread whatever the beam does)
      var count = Math.round(clamp(W * H / 7000, 70, 220));
      var mr = rng(29);
      motes = [];
      for (var i = 0; i < count; i++) motes.push({ x: mr() * W, y: mr() * H, r: 0.5 + mr() * mr() * 1.9, a: 0.35 + mr() * 0.65, ph: mr() * TAU, sp: 0.4 + mr() * 1.4 });
      bokeh = [];
      for (i = 0; i < 9; i++) bokeh.push({ x: mr() * W, y: mr() * H, r: 5 + mr() * 12, a: 0.06 + mr() * 0.08, ph: mr() * TAU });
      // road studs on the centre line, in the gaps between dashes
      studs = [];
      for (var z = 6.3; z < 60; z += 9) studs.push([0.15, 0.01, z]);
      for (z = 4; z < 60; z += 9) { studs.push([-3.35 + 0.12, 0.01, z]); studs.push([3.65 - 0.12, 0.01, z]); }
      // fireflies over the tea bushes (volt green, very sparing)
      flies = [];
      var fr = rng(53);
      for (i = 0; i < 7; i++) flies.push({ x: -6.6 - fr() * 5, y: 1.2 + fr() * 1.1, z: 7 + fr() * 22, ph: fr() * 20, per: 3.5 + fr() * 4, dx: fr() * TAU });
      for (i = 0; i < 4; i++) flies.push({ x: 6.8 + fr() * 4, y: 1.2 + fr() * 1.1, z: 12 + fr() * 22, ph: fr() * 20, per: 3.5 + fr() * 4, dx: fr() * TAU });

      if (!tgt.init) { var rp = restPoint(); tgt.x = rp[0]; tgt.y = rp[1]; tgt.init = true; }
      offsetsAt = -1;
    }

    function restPoint() { return [L.rest[0] * W, L.rest[1] * H]; }
    function sweepPoint(t) {
      var s = L.sweep;
      return [W * (s[0] + s[1] * Math.sin(t * 0.23) + 0.04 * Math.sin(t * 0.71)), H * (s[2] + s[3] * Math.sin(t * 0.17 + 1.3))];
    }
    function clampTarget(p) {
      var y = Math.max(p[1], L.minY * H, cam.horizon + 0.07 * H);
      var mx = 0.07 * W, my = (L.portrait ? 0.075 : 0.1) * H;
      shields.forEach(function (r) {
        if (p[0] > r[0] - mx && p[0] < r[2] + mx) y = Math.min(y, r[1] - my);
      });
      y = Math.max(y, cam.horizon + 0.07 * H);
      var g = cam.ground(clamp(p[0], -0.05 * W, 1.05 * W), y);
      if (!g) return [p[0], y];
      if (g[2] > L.maxZ) { g[2] = L.maxZ; var q = cam.p(g[0], 0, g[2]); return [q[0], q[1]]; }
      return [clamp(p[0], -0.05 * W, 1.05 * W), y];
    }

    /* ---------------- per-frame rendering ---------------- */
    var lastBeam = null;
    function render(dt) {
      var t0 = performance.now();
      var ign = reduced ? 1 : ignition(clock - igniteAt);
      var modI = [0, 1, 2].map(function (m) { return reduced ? 1 : clamp(ignition(clock - igniteAt - m * 0.04 + (m === 1 ? 0.02 : 0)), 0, 1.2); });
      var I = clamp(ign, 0, 1.2) * (1 - 0.35 * progress);

      // where the beam wants to be
      var want;
      if (aimPt) want = aimPt;
      else if ((aimMode === 'pointer' && clock - lastInput < 6) || (aimMode === 'touch' && clock - lastInput < 4)) {
        // the pointer is kept in viewport coordinates: when the page scrolls under a still mouse, the light follows
        want = [tgt.cx - hostRect.left, tgt.cy - hostRect.top];
      }
      else want = reduced ? restPoint() : sweepPoint(clock + 4);
      want = clampTarget(want);
      if (reduced || !dt) { tgt.x = want[0]; tgt.y = want[1]; tgt.vx = tgt.vy = 0; }
      else {
        // underdamped spring: the head swings after the pointer and settles with a little overshoot
        var k = 38, c = 9.5, steps = Math.ceil(dt / 0.016);
        var h = dt / steps;
        for (var s = 0; s < steps; s++) {
          tgt.vx += (k * (want[0] - tgt.x) - c * tgt.vx) * h; tgt.vy += (k * (want[1] - tgt.y) - c * tgt.vy) * h;
          tgt.x += tgt.vx * h; tgt.y += tgt.vy * h;
        }
      }
      var G0 = cam.ground(tgt.x, Math.max(tgt.y, cam.horizon + 0.05 * H)) || [0, 0, L.maxZ];

      fx.setTransform(1, 0, 0, 1, 0, 0);
      fx.clearRect(0, 0, cFx.width, cFx.height);
      fx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // head orientation and its LED face
      var F = headFrame(G0, progress);
      var faceC = vcomb(F.o, F.a, head.L * 0.66, F.u, -head.T, F.w, 0);
      var Dv = vsub(G0, faceC), dist = vlen(Dv), Dn = vmul(Dv, 1 / dist);
      var beta = L.beta * DEG * (1 - 0.5 * progress);
      var cosI = clamp(-Dn[1], 0.2, 1);
      var rPerp = Math.min(dist * Math.tan(beta), 2.9 * (1 - 0.4 * progress)), rPar = Math.min(rPerp / cosI, rPerp * 2.2);
      var hd = vnorm([Dn[0], 0, Dn[2]]);
      if (!isFinite(hd[0])) hd = [1, 0, 0];
      var pp = [-hd[2], 0, hd[0]];
      var pc = cam.pv(G0), pe1 = cam.pv(vcomb(G0, hd, rPar, pp, 0, [0, 0, 0], 0)), pe2 = cam.pv(vcomb(G0, hd, 0, pp, rPerp, [0, 0, 0], 0));
      var pool = [];
      for (var i = 0; i < 28; i++) { var an = i / 28 * TAU; pool.push(cam.pv(vcomb(G0, hd, Math.cos(an) * rPar, pp, Math.sin(an) * rPerp, [0, 0, 0], 0))); }
      var kI = clamp(Math.pow((8.5 * 8.5) / (dist * dist), 0.6) * Math.pow(cosI / 0.8, 0.5), 0.45, 1.1) * I;

      // 1 · the pool: the lit street, revealed through a soft elliptical mask
      fx.save();
      fx.setTransform(dpr * (pe1[0] - pc[0]), dpr * (pe1[1] - pc[1]), dpr * (pe2[0] - pc[0]), dpr * (pe2[1] - pc[1]), dpr * pc[0], dpr * pc[1]);
      var Rm = 2.0, pg = fx.createRadialGradient(0, 0, 0, 0, 0, Rm);
      var kk = clamp(kI, 0, 1);
      pg.addColorStop(0, 'rgba(0,0,0,' + kk + ')');
      pg.addColorStop(0.22, 'rgba(0,0,0,' + (kk * 0.96) + ')');
      pg.addColorStop(0.38, 'rgba(0,0,0,' + (kk * 0.78) + ')');
      pg.addColorStop(0.52, 'rgba(0,0,0,' + (kk * 0.45) + ')');
      pg.addColorStop(0.7, 'rgba(0,0,0,' + (kk * 0.18) + ')');
      pg.addColorStop(0.86, 'rgba(0,0,0,' + (kk * 0.05) + ')');
      pg.addColorStop(1, 'rgba(0,0,0,0)');
      fx.fillStyle = pg;
      fx.fillRect(-Rm, -Rm, Rm * 2, Rm * 2);
      fx.restore();
      fx.save();
      fx.setTransform(1, 0, 0, 1, 0, 0);
      fx.globalCompositeOperation = 'source-in';
      fx.drawImage(litCanvas, 0, 0);
      fx.restore();
      fx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // a warm hotspot at the centre of the pool
      fx.save();
      fx.globalCompositeOperation = 'lighter';
      fx.setTransform(dpr * (pe1[0] - pc[0]), dpr * (pe1[1] - pc[1]), dpr * (pe2[0] - pc[0]), dpr * (pe2[1] - pc[1]), dpr * pc[0], dpr * pc[1]);
      var hs = fx.createRadialGradient(0, 0, 0, 0, 0, 1.1);
      hs.addColorStop(0, 'rgba(255,214,150,' + (0.08 * kk).toFixed(3) + ')'); hs.addColorStop(0.5, 'rgba(255,190,110,' + (0.035 * kk).toFixed(3) + ')'); hs.addColorStop(1, 'rgba(255,170,80,0)');
      fx.fillStyle = hs; fx.fillRect(-1.1, -1.1, 2.2, 2.2);
      fx.restore();
      fx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // 2 · retro-reflective road studs catch the light
      fx.globalCompositeOperation = 'lighter';
      studs.forEach(function (sd) {
        var dx = sd[0] - G0[0], dz = sd[2] - G0[2];
        var e = Math.pow((dx * hd[0] + dz * hd[2]) / rPar, 2) + Math.pow((dx * pp[0] + dz * pp[2]) / rPerp, 2);
        var li = (1 - sstep(0.3, 2.6, e)) * kI;
        if (li < 0.03) return;
        var q = cam.pv(sd), sz = clamp(cam.f * 0.5 / q[2], 6, 26) * (0.7 + 0.3 * li);
        fx.globalAlpha = clamp(li, 0, 1);
        fx.drawImage(star, q[0] - sz / 2, q[1] - sz / 2, sz, sz);
      });
      fx.globalAlpha = 1;

      // 3 · the cone, in the low-resolution volume buffer
      var apex = cam.pv(faceC);
      var srcPts = head.face.map(function (q) { return cam.pv(vcomb(F.o, F.a, q[0], F.u, -head.T, F.w, q[1])); });
      var cone = hull(srcPts.concat(pool));
      var vq = volQ;
      vctx.setTransform(1, 0, 0, 1, 0, 0);
      vctx.clearRect(0, 0, vol.width, vol.height);
      vctx.setTransform(vq, 0, 0, vq, 0, 0);
      var widen = function (pts, k1, k2) {
        return hull(srcPts.map(function (p) { return [apex[0] + (p[0] - apex[0]) * k1, apex[1] + (p[1] - apex[1]) * k1]; })
          .concat(pts.map(function (p) { return [pc[0] + (p[0] - pc[0]) * k2, pc[1] + (p[1] - pc[1]) * k2]; })));
      };
      var lg = function (a0, a1) {
        var g = vctx.createLinearGradient(apex[0], apex[1], pc[0], pc[1]);
        g.addColorStop(0, 'rgba(255,238,206,' + a0 + ')'); g.addColorStop(0.55, 'rgba(255,226,180,' + (a0 * 0.45 + a1 * 0.55) + ')'); g.addColorStop(1, 'rgba(255,214,160,' + a1 + ')');
        return g;
      };
      var Iv = clamp(I, 0, 1.2);
      fillPoly(vctx, widen(pool, 1.7, 1.35), lg(0.06 * Iv, 0.02 * Iv));
      fillPoly(vctx, cone, lg(0.28 * Iv, 0.08 * Iv));
      fillPoly(vctx, widen(pool, 0.6, 0.5), lg(0.2 * Iv, 0.0));
      // god rays: a conic gradient of shimmering shafts radiating from the LED face
      if (hasConic && Iv > 0.02) {
        var axisA = Math.atan2(pc[1] - apex[1], pc[0] - apex[0]);
        var cg = vctx.createConicGradient(axisA - 0.9, apex[0], apex[1]);
        var n = 36;
        for (i = 0; i <= n; i++) {
          var sh = 0.5 + 0.5 * Math.sin(i * 2.399 + clock * (0.35 + (i % 5) * 0.07)) * Math.sin(i * 1.13 + clock * 0.21);
          var stop = i / n * (1.8 / TAU);
          cg.addColorStop(clamp(stop, 0, 1), 'rgba(255,236,200,' + (0.10 * sh * sh * Iv).toFixed(3) + ')');
        }
        cg.addColorStop(Math.min(1, 1.8 / TAU + 0.001), 'rgba(255,236,200,0)');
        vctx.save(); path(vctx, cone); vctx.clip();
        vctx.globalCompositeOperation = 'lighter';
        vctx.fillStyle = cg; vctx.fillRect(0, 0, W, H);
        // fade the shafts out toward the ground
        vctx.restore();
      }
      // a warm haze lying over the pool
      vctx.save();
      vctx.setTransform(vq * (pe1[0] - pc[0]), vq * (pe1[1] - pc[1]), vq * (pe2[0] - pc[0]), vq * (pe2[1] - pc[1]), vq * pc[0], vq * pc[1]);
      var hgz = vctx.createRadialGradient(0, 0, 0, 0, 0, 1.6);
      var poolPx = Math.hypot(pe1[0] - pc[0], pe1[1] - pc[1]) + Math.hypot(pe2[0] - pc[0], pe2[1] - pc[1]);
      var hazeA = 0.12 * kI * clamp(260 / Math.max(1, poolPx), 0.25, 1);
      hgz.addColorStop(0, 'rgba(255,214,150,' + hazeA.toFixed(3) + ')'); hgz.addColorStop(1, 'rgba(255,200,130,0)');
      vctx.fillStyle = hgz; vctx.fillRect(-1.6, -1.6, 3.2, 3.2);
      vctx.restore();
      fx.drawImage(vol, 0, 0, W, H);

      // 4 · dust motes, lit only inside the cone
      var ax = pc[0] - apex[0], ay = pc[1] - apex[1], al2 = ax * ax + ay * ay, alen = Math.sqrt(al2) || 1;
      var hwApex = 0, hwPool = 0;
      srcPts.forEach(function (p) { hwApex = Math.max(hwApex, Math.abs(((p[0] - apex[0]) * -ay + (p[1] - apex[1]) * ax) / alen)); });
      pool.forEach(function (p) { hwPool = Math.max(hwPool, Math.abs(((p[0] - pc[0]) * -ay + (p[1] - pc[1]) * ax) / alen)); });
      var beamAt = function (x, y) {
        var rx = x - apex[0], ry = y - apex[1];
        var s2 = (rx * ax + ry * ay) / al2;
        if (s2 < -0.02 || s2 > 1.12) return 0;
        var lat = Math.abs(rx * -ay + ry * ax) / alen;
        var hw = mix(hwApex, hwPool, clamp(s2, 0, 1)) + 1;
        return (1 - sstep(0.45, 1.0, lat / hw)) * (1.05 - 0.55 * clamp(s2, 0, 1)) * (s2 > 1 ? 1 - sstep(1, 1.12, s2) : 1);
      };
      var tt = clock;
      motes.forEach(function (m) {
        if (dt) {
          m.x += (Math.sin(tt * 0.3 * m.sp + m.ph) * 4 + 2) * dt;
          m.y += (Math.cos(tt * 0.23 * m.sp + m.ph * 1.7) * 3 - 1.2) * dt;
          if (m.x > W + 4) m.x -= W + 8; if (m.x < -4) m.x += W + 8;
          if (m.y < -4) m.y += H + 8; if (m.y > H + 4) m.y -= H + 8;
        }
        var b = beamAt(m.x, m.y);
        if (b < 0.02) return;
        var tw = 0.65 + 0.35 * Math.sin(tt * 2.3 * m.sp + m.ph * 3);
        fx.globalAlpha = clamp(b * m.a * tw * Iv, 0, 1);
        var r2 = m.r * 2.6;
        fx.drawImage(dot, m.x - r2, m.y - r2, r2 * 2, r2 * 2);
      });
      bokeh.forEach(function (bk) {
        if (dt) { bk.y -= 3 * dt; bk.x += Math.sin(tt * 0.2 + bk.ph) * 2 * dt; if (bk.y < -20) bk.y += H + 40; }
        var b = beamAt(bk.x, bk.y);
        if (b < 0.02) return;
        fx.globalAlpha = clamp(b * bk.a * Iv, 0, 1);
        fx.drawImage(dot, bk.x - bk.r, bk.y - bk.r, bk.r * 2, bk.r * 2);
      });
      fx.globalAlpha = 1;

      // 5 · fireflies over the tea (they ignore the beam)
      flies.forEach(function (fl) {
        var ph = ((tt + fl.ph) % fl.per) / fl.per;
        var on = ph < 0.12 ? sstep(0, 0.05, ph) * (1 - sstep(0.06, 0.12, ph)) : 0;
        if (reduced) on = 0.6;
        if (on < 0.02) return;
        var q = cam.p(fl.x + Math.sin(tt * 0.4 + fl.dx) * 0.4, fl.y + Math.sin(tt * 0.6 + fl.dx) * 0.15, fl.z);
        if (q[1] < cam.horizon) return;
        var rr = clamp(cam.f * 0.09 / q[2], 2.5, 8);
        var g = fx.createRadialGradient(q[0], q[1], 0, q[0], q[1], rr);
        g.addColorStop(0, 'rgba(232,255,170,' + (0.75 * on).toFixed(3) + ')'); g.addColorStop(0.2, 'rgba(198,255,61,' + (0.3 * on).toFixed(3) + ')'); g.addColorStop(1, 'rgba(198,255,61,0)');
        fx.fillStyle = g; fx.fillRect(q[0] - rr, q[1] - rr, rr * 2, rr * 2);
      });
      fx.globalCompositeOperation = 'source-over';

      // 6 · the luminaire: arm, then the glow it sits in, then the head
      fx.setTransform(1, 0, 0, 1, 0, 0);
      fx.drawImage(sprite, Math.round(spriteBox.x * dpr), Math.round(spriteBox.y * dpr));
      fx.setTransform(dpr, 0, 0, dpr, 0, 0);
      var facing = Math.max(0, vdot(F.u, vnorm(vsub(faceC, cam.pos))));
      var hA = cam.pv(F.o), hB = cam.pv(vadd(F.o, vmul(F.a, head.L)));
      var hsize = Math.hypot(hB[0] - hA[0], hB[1] - hA[1]);
      fx.globalCompositeOperation = 'lighter';
      var bs = hsize * (0.62 + 0.9 * facing);
      var bl = fx.createRadialGradient(apex[0], apex[1], 0, apex[0], apex[1], bs);
      var ba = (0.34 + 0.5 * facing) * Iv;
      bl.addColorStop(0, 'rgba(255,246,226,' + clamp(ba, 0, 1).toFixed(3) + ')');
      bl.addColorStop(0.16, 'rgba(255,220,160,' + clamp(ba * 0.5, 0, 1).toFixed(3) + ')');
      bl.addColorStop(0.45, 'rgba(255,170,80,' + clamp(ba * 0.12, 0, 1).toFixed(3) + ')');
      bl.addColorStop(1, 'rgba(255,150,60,0)');
      fx.fillStyle = bl; fx.fillRect(apex[0] - bs, apex[1] - bs, bs * 2, bs * 2);
      // a thin anamorphic streak through the source, the way a lens sees a bright LED array
      var sw = hsize * 0.85, sa = (0.12 + 0.25 * facing) * Iv;
      fx.save(); fx.translate(apex[0], apex[1]); fx.scale(1, 0.016);
      var sg = fx.createRadialGradient(0, 0, 0, 0, 0, sw);
      sg.addColorStop(0, 'rgba(255,236,200,' + clamp(sa, 0, 1).toFixed(3) + ')'); sg.addColorStop(1, 'rgba(255,170,80,0)');
      fx.fillStyle = sg; fx.fillRect(-sw, -sw, sw * 2, sw * 2);
      fx.restore();
      fx.globalCompositeOperation = 'source-over';
      drawHead(fx, F, Iv, modI);

      // 8 · tell the headline where the light is
      var a0 = Infinity, a1 = -Infinity, axisAng = Math.atan2(pc[1] - apex[1], pc[0] - apex[0]), far = 0;
      pool.forEach(function (p0) {
        var p = [pc[0] + (p0[0] - pc[0]) * 1.45, pc[1] + (p0[1] - pc[1]) * 1.45];
        var d = Math.atan2(p[1] - apex[1], p[0] - apex[0]) - axisAng;
        while (d > Math.PI) d -= TAU; while (d < -Math.PI) d += TAU;
        a0 = Math.min(a0, d); a1 = Math.max(a1, d);
        far = Math.max(far, Math.hypot(p[0] - apex[0], p[1] - apex[1]));
      });
      lastBeam = { apex: apex, pool: pc, a0: axisAng + a0, a1: axisAng + a1, far: far, k: clamp(I, 0, 1), cone: cone, kI: kI, near: bs * 0.62 };
      paintCss(lastBeam);

      var ms = performance.now() - t0;
      lastMs = ms; frames++;
      times.push(ms); if (times.length > 240) times.shift();
      if (frames > 30) maxMs = Math.max(maxMs, ms);
      if (!ready) { ready = true; host.classList.add('hb-on'); host.dispatchEvent(new CustomEvent('gs:beam-ready', { bubbles: true })); }
    }

    function measureOffsets() {
      var hr = host.getBoundingClientRect();
      shields = shieldEls.filter(function (el) { return el.offsetParent !== null; }).map(function (el) {
        var r = el.getBoundingClientRect();
        return [r.left - hr.left, r.top - hr.top, r.right - hr.left, r.bottom - hr.top];
      });
      lit.forEach(function (el) {
        var r = el.getBoundingClientRect();
        el.style.setProperty('--hb-ox', (r.left - hr.left).toFixed(1));
        el.style.setProperty('--hb-oy', (r.top - hr.top).toFixed(1));
      });
    }

    function paintCss(b) {
      if (!lit.length) return;
      if (clock < 2.6 || offsetsAt < 0) { measureOffsets(); offsetsAt = clock; }
      // CSS conic angles start at 12 o'clock and run clockwise
      var from = (b.a0 * 180 / Math.PI + 90), span = (b.a1 - b.a0) * 180 / Math.PI;
      var soft = Math.max(4, span * 0.22);
      var vals = [b.apex[0].toFixed(1), b.apex[1].toFixed(1), (from - soft).toFixed(2), (span + soft * 2).toFixed(2), soft.toFixed(2), b.far.toFixed(0), b.k.toFixed(3), b.near.toFixed(0)];
      var key = vals.join('|');
      if (key === cssState) return;
      cssState = key;
      var st = host.style;
      st.setProperty('--hb-ax', vals[0]); st.setProperty('--hb-ay', vals[1]);
      st.setProperty('--hb-a0', vals[2]); st.setProperty('--hb-aw', vals[3]); st.setProperty('--hb-as', vals[4]);
      st.setProperty('--hb-r', vals[5]); st.setProperty('--hb-k', vals[6]); st.setProperty('--hb-nr', vals[7]);
    }

    /* ---------------- loop + pausing ---------------- */
    function frame(now) {
      raf = 0;
      if (!running) return;
      var dt = lastNow ? Math.min(0.1, (now - lastNow) / 1000) : 0; // keeps wall-clock pace down to 10 fps
      lastNow = now;
      clock += dt;
      render(dt);
      raf = requestAnimationFrame(frame);
    }
    function shouldRun() { return !destroyed && !reduced && !userPaused && !motionPaused && visible && !document.hidden; }
    function sync() {
      var want = shouldRun();
      if (want && !running) { running = true; lastNow = 0; raf = requestAnimationFrame(frame); }
      else if (!want && running) { running = false; if (raf) cancelAnimationFrame(raf); raf = 0; }
      if (!want && !destroyed) still();
    }
    // one finished frame (reduced motion, motion paused before the light came on, or a resize while paused)
    var stillQueued = 0;
    function still() {
      if (stillQueued || destroyed || !visible || document.hidden) return; // off-screen: nothing to show, keep the ignition for later
      stillQueued = requestAnimationFrame(function () {
        stillQueued = 0;
        if (running || destroyed) return;
        if (clock - igniteAt < 1.4) clock = igniteAt + 1.4; // a paused light is a lit light: never freeze mid-flicker
        render(0);
      });
    }

    // input
    var hostRect = { left: 0, top: 0 };
    function readRect() { var r = host.getBoundingClientRect(); hostRect = { left: r.left, top: r.top }; }
    function onScroll() { readRect(); }
    addEventListener('scroll', onScroll, { passive: true });
    function onMove(e) {
      if (reduced) return;
      if (e.pointerType === 'touch' && !tgt.down) return;
      readRect(); tgt.cx = e.clientX; tgt.cy = e.clientY;
      aimMode = e.pointerType === 'touch' ? 'touch' : 'pointer';
      lastInput = clock;
    }
    function onDown(e) {
      if (reduced) return;
      tgt.down = true; readRect(); tgt.cx = e.clientX; tgt.cy = e.clientY;
      aimMode = e.pointerType === 'touch' || noHover ? 'touch' : 'pointer';
      lastInput = clock;
    }
    function onUp() { tgt.down = false; }
    function onLeave(e) { if (e.pointerType !== 'touch') lastInput = clock - 4.8; }
    host.addEventListener('pointermove', onMove, { passive: true });
    host.addEventListener('pointerdown', onDown, { passive: true });
    addEventListener('pointerup', onUp, { passive: true });
    addEventListener('pointercancel', onUp, { passive: true });
    host.addEventListener('pointerleave', onLeave, { passive: true });

    var io = null;
    if ('IntersectionObserver' in window) {
      io = new IntersectionObserver(function (en) { visible = en[en.length - 1].isIntersecting; sync(); }, { rootMargin: '64px 0px' });
      io.observe(host);
    }
    function onVis() { sync(); }
    document.addEventListener('visibilitychange', onVis);
    function onMotion(e) { motionPaused = e && e.detail && 'paused' in e.detail ? !!e.detail.paused : !!(window.GS && window.GS.motionPaused); sync(); }
    document.addEventListener('gs:motion', onMotion);

    var rq = 0, lastW = 0, lastH = 0;
    function onResize() {
      if (rq) return;
      rq = requestAnimationFrame(function () {
        rq = 0;
        var r = host.getBoundingClientRect();
        if (Math.round(r.width) === lastW && Math.round(r.height) === lastH) return;
        lastW = Math.round(r.width); lastH = Math.round(r.height);
        readRect();
        var ox = tgt.x / (W || 1), oy = tgt.y / (H || 1);
        build();
        tgt.x = ox * W; tgt.y = oy * H;
        if (!running) still();
      });
    }
    var ro = null;
    if ('ResizeObserver' in window) { ro = new ResizeObserver(onResize); ro.observe(host); }
    addEventListener('resize', onResize);
    addEventListener('orientationchange', onResize);
    // rebuild once the fonts arrive, unless they already have (a second full street build at hand-off stalls the reveal)
    if (document.fonts && document.fonts.ready && document.fonts.status !== 'loaded') document.fonts.ready.then(function () { if (destroyed) return; offsetsAt = -1; build(); if (!running) still(); });

    build();
    readRect();
    measureOffsets();
    lastW = W; lastH = H;
    if (reduced) clock = igniteAt + 2;
    sync();
    if (!running) still();

    return {
      destroy: function () {
        destroyed = true; running = false;
        if (raf) cancelAnimationFrame(raf);
        if (stillQueued) cancelAnimationFrame(stillQueued);
        if (rq) cancelAnimationFrame(rq);
        if (io) io.disconnect();
        if (ro) ro.disconnect();
        host.removeEventListener('pointermove', onMove);
        host.removeEventListener('pointerdown', onDown);
        host.removeEventListener('pointerleave', onLeave);
        removeEventListener('pointerup', onUp);
        removeEventListener('pointercancel', onUp);
        removeEventListener('resize', onResize);
        removeEventListener('scroll', onScroll);
        removeEventListener('orientationchange', onResize);
        document.removeEventListener('visibilitychange', onVis);
        document.removeEventListener('gs:motion', onMotion);
        ['--hb-ax', '--hb-ay', '--hb-a0', '--hb-aw', '--hb-as', '--hb-r', '--hb-k', '--hb-nr'].forEach(function (p) { host.style.removeProperty(p); });
        host.classList.remove('hb-on');
        if (ownStage) stage.remove(); else { cScene.remove(); cFx.remove(); }
      },
      pause: function () { userPaused = true; sync(); },
      play: function () { userPaused = false; sync(); },
      setProgress: function (p) {
        p = clamp(+p || 0, 0, 1);
        if (Math.abs(p - progress) < 0.0005) return;
        progress = p;
        offsetsAt = -1;
        if (!running) still();
      },
      // aim at a point in host pixels (null hands control back); used by tests and by keyboard-free demos
      aim: function (x, y) { aimPt = x == null ? null : [x, y]; if (!running) still(); },
      ignite: function () { if (reduced) return; clock = 0; lastInput = -1e9; },
      // freeze the loop and draw exactly one frame at time t (seconds since mount); play() resumes. For tests and posters.
      snapshot: function (t) {
        userPaused = true; running = false;
        if (raf) cancelAnimationFrame(raf); raf = 0;
        if (t != null) clock = t;
        render(0); // dt 0: the spring snaps to its target, so the frame is exactly reproducible
        return { ms: lastMs, ignition: +clamp(ignition(clock - igniteAt), 0, 2).toFixed(3) };
      },
      stats: function () {
        var sum = 0; times.forEach(function (v) { sum += v; });
        return {
          mode: '2d', running: running, frames: frames, avgMs: times.length ? +(sum / times.length).toFixed(3) : 0, lastMs: +lastMs.toFixed(3), maxMs: +maxMs.toFixed(3),
          dpr: dpr, size: [W, H], devicePixels: cFx.width * cFx.height, reducedMotion: reduced, paused: { user: userPaused, motion: motionPaused, offscreen: !visible, hidden: document.hidden },
          ignition: +clamp(ignition(clock - igniteAt), 0, 2).toFixed(3), progress: progress,
          beam: lastBeam ? { apex: lastBeam.apex.slice(0, 2).map(Math.round), pool: lastBeam.pool.slice(0, 2).map(Math.round), k: +lastBeam.k.toFixed(3) } : null,
          layout: L ? (L.portrait ? 'portrait' : 'landscape') : null, horizon: cam ? Math.round(cam.horizon) : null
        };
      }
    };
  }

  window.GSHeroBeam = { mount: mount, version: '1.0' };
})();
