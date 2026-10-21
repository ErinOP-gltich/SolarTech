/* Green Sun Technologies — hero concept "NIGHT ROAD".
   A procedural, full-bleed dusk drive down an Assam road lined with Green Sun solar street lights:
   layered hills, the last warm band of daylight, stars, and a row of poles (tilted solar panel, slim
   LED head, battery box with a charge LED) that switch on one after another as the dusk sensor trips.
   Plain 2D canvas (no WebGL) so it draws the same everywhere. Static layers (sky, hills, sprites) are
   cached offscreen; each frame only draws the moving parts.

   const road = GSHeroRoad.mount(host, opts)
     host: positioned element the canvas fills. Composition comes from CSS custom properties on it:
       --road-vp-x (0..1), --road-horizon (0..1), --road-lens (focal length / height),
       --road-cam-x (metres from the road centre, negative = left lane), --road-cam-y (eye height, m)
     opts: { ignite: true (auto-ignite after opts.delay ms) | false (wait for road.ignite()),
             delay: 450, speed: 5.2 (m/s), reduceMotion: bool (defaults to the media query),
             pixelBudget: 2.6e6 (device pixels before the DPR is lowered), flush: false (benchmark only) }
   road.pause() / play()      user-level pause (finishes the ignition so the frozen frame is complete)
   road.setProgress(p)        0..1 as the hero scrolls away: the drive speeds up and the scene fades
   road.ignite()              start the dusk-to-dawn sequence (no-op if already lit)
   road.stats()               frame timing and canvas size
   road.destroy()
   Pauses itself off-screen (IntersectionObserver), while the tab is hidden, and while the site's
   "Pause motion" is on (document 'gs:motion' / GS.motionPaused). Under prefers-reduced-motion it
   draws one finished frame and never animates. */
(function () {
  'use strict';

  /* ---------------- helpers ---------------- */
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function sstep(a, b, x) { var t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }
  function hash(n) { var s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); }
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
  function valueNoise(rand) {
    var tab = new Float32Array(512);
    for (var i = 0; i < 512; i++) tab[i] = rand();
    return function (x) {
      var i = Math.floor(x), t = x - i;
      t = t * t * (3 - 2 * t);
      return lerp(tab[i & 511], tab[(i + 1) & 511], t);
    };
  }
  function makeCanvas(w, h) {
    var c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }
  function radial(size, stops) {
    var c = makeCanvas(size, size), g = c.getContext('2d');
    var gr = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    for (var i = 0; i < stops.length; i++) gr.addColorStop(stops[i][0], stops[i][1]);
    g.fillStyle = gr;
    g.fillRect(0, 0, size, size);
    return c;
  }

  /* ---------------- sprites (built once, size-independent) ---------------- */
  var SPR = null;
  function sprites() {
    if (SPR) return SPR;
    SPR = {};
    // LED head bloom: hot near-white core falling off through the plasma palette
    SPR.glow = radial(128, [[0, 'rgba(255,252,240,1)'], [0.08, 'rgba(255,246,222,.92)'], [0.2, 'rgba(255,226,176,.42)'], [0.42, 'rgba(255,180,96,.12)'], [0.7, 'rgba(255,140,50,.03)'], [1, 'rgba(255,122,0,0)']]);
    // wide humid-air halo around each head
    SPR.halo = radial(128, [[0, 'rgba(255,214,150,.55)'], [0.3, 'rgba(255,170,80,.2)'], [0.65, 'rgba(255,122,30,.05)'], [1, 'rgba(255,100,20,0)']]);
    // the battery box charge LED (volt green)
    SPR.volt = radial(32, [[0, 'rgba(232,255,170,1)'], [0.25, 'rgba(198,255,61,.7)'], [1, 'rgba(198,255,61,0)']]);
    // warm afterglow on the horizon
    SPR.after = radial(256, [[0, 'rgba(255,214,120,.9)'], [0.12, 'rgba(255,170,60,.55)'], [0.32, 'rgba(255,110,30,.22)'], [0.6, 'rgba(200,60,60,.07)'], [1, 'rgba(120,40,90,0)']]);

    // volumetric cone under a head: narrow at the top, spreading and fading to the ground
    var cw = 128, ch = 256, c = makeCanvas(cw, ch), g = c.getContext('2d');
    for (var y = 0; y < ch; y++) {
      var t = y / (ch - 1);
      var hw = lerp(0.06, 0.5, Math.pow(t, 0.85)) * cw;
      var a = Math.pow(1 - t, 1.5) * 0.85 + 0.05 * (1 - t);
      var gr = g.createLinearGradient(cw / 2 - hw, 0, cw / 2 + hw, 0);
      gr.addColorStop(0, 'rgba(255,226,184,0)');
      gr.addColorStop(0.28, 'rgba(255,226,184,' + (a * 0.45).toFixed(3) + ')');
      gr.addColorStop(0.5, 'rgba(255,238,206,' + a.toFixed(3) + ')');
      gr.addColorStop(0.72, 'rgba(255,226,184,' + (a * 0.45).toFixed(3) + ')');
      gr.addColorStop(1, 'rgba(255,226,184,0)');
      g.fillStyle = gr;
      g.fillRect(cw / 2 - hw, y, hw * 2, 1);
    }
    SPR.cone = c;

    // one scanline of a ground light pool: a Gaussian across ±2 radii
    c = makeCanvas(512, 2); g = c.getContext('2d');
    var id = g.createImageData(512, 2);
    for (var bx = 0; bx < 512; bx++) {
      var u = (bx + 0.5) / 512 * 3 - 1.5, al = Math.exp(-1.6 * u * u) * (1 - sstep(1.25, 1.5, Math.abs(u)));
      for (var by = 0; by < 2; by++) {
        var o = (by * 512 + bx) * 4;
        id.data[o] = 255; id.data[o + 1] = 230; id.data[o + 2] = 192; id.data[o + 3] = Math.round(al * 255);
      }
    }
    g.putImageData(id, 0, 0);
    SPR.band = c;

    // reflection streak on wet asphalt: peaks at the mirror point (55% down), long soft tails
    var sw = 32, sh = 256;
    c = makeCanvas(sw, sh); g = c.getContext('2d');
    for (y = 0; y < sh; y++) {
      t = y / (sh - 1);
      var v = t < 0.55 ? Math.pow(t / 0.55, 2.2) : Math.pow(1 - (t - 0.55) / 0.45, 1.4);
      gr = g.createLinearGradient(0, 0, sw, 0);
      gr.addColorStop(0, 'rgba(255,214,160,0)');
      gr.addColorStop(0.5, 'rgba(255,232,196,' + v.toFixed(3) + ')');
      gr.addColorStop(1, 'rgba(255,214,160,0)');
      g.fillStyle = gr;
      g.fillRect(0, y, sw, 1);
    }
    SPR.streak = c;

    // anamorphic lens streak through bright heads
    var fw = 256, fh = 8;
    c = makeCanvas(fw, fh); g = c.getContext('2d');
    for (y = 0; y < fh; y++) {
      var vy = 1 - Math.abs((y + 0.5) / fh * 2 - 1);
      gr = g.createLinearGradient(0, 0, fw, 0);
      gr.addColorStop(0, 'rgba(255,196,120,0)');
      gr.addColorStop(0.42, 'rgba(255,214,160,' + (0.35 * vy).toFixed(3) + ')');
      gr.addColorStop(0.5, 'rgba(255,240,214,' + vy.toFixed(3) + ')');
      gr.addColorStop(0.58, 'rgba(255,214,160,' + (0.35 * vy).toFixed(3) + ')');
      gr.addColorStop(1, 'rgba(255,196,120,0)');
      g.fillStyle = gr;
      g.fillRect(0, y, fw, 1);
    }
    SPR.flare = c;
    return SPR;
  }

  /* ---------------- the world (metres) ---------------- */
  var ROAD = 3.7;        // half width of the carriageway
  var EDGE = 3.42;       // edge-line centre
  var LINE = 0.15;       // paint width
  var DASH = 3, PERIOD = 9;
  var POLE_X = 5.1;      // poles stand on the verge
  var HEAD_X = 3.2;      // LED heads hang over the outer wheel track
  var ARM_Y = 6.55, HEAD_Y = 6.9, POLE_H = 7.15;
  var SPACING = 36;      // per side; the two sides are staggered by half
  var HALF = SPACING / 2;
  var FAR = 760;
  var RX = 6, RZ = 9.5; // light pool radii across / along the road
  var TILT = 26 * Math.PI / 180; // panel tilt = Guwahati's latitude

  // dusk-sensor switch-on: a quick LED flicker, then a firm ramp with a slight bloom overshoot
  function flicker(ms) {
    if (ms < 0) return 0;
    if (ms < 45) return 0.85;
    if (ms < 95) return 0.06;
    if (ms < 125) return 0.62;
    if (ms < 190) return 0.12;
    if (ms < 470) { var k = (ms - 190) / 280; return 0.3 + 0.95 * (1 - Math.pow(1 - k, 3)); }
    if (ms < 900) return 1 + 0.25 * (1 - (ms - 470) / 430);
    return 1;
  }

  function mount(host, opts) {
    opts = opts || {};
    var doc = document;
    var reduce = opts.reduceMotion != null ? !!opts.reduceMotion : !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
    var canvas = doc.createElement('canvas');
    var ctx = null;
    try { ctx = canvas.getContext('2d'); } catch (e) { ctx = null; }
    if (!ctx) {
      host.classList.add('road-fallback');
      var noop = function () {};
      return { destroy: noop, pause: noop, play: noop, setProgress: noop, ignite: noop, stats: function () { return { fallback: true }; } };
    }
    var S = sprites();

    /* ---------- layer stack ----------
       The scenery that only shifts (sky, afterglow, three ridges, valley mist, ground) lives in its own
       layers, moved by compositor transforms; only the road, its light and the lamps are drawn per frame. */
    var scene = doc.createElement('div');
    scene.className = 'road-scene';
    scene.setAttribute('aria-hidden', 'true');
    scene.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%;overflow:hidden;isolation:isolate;pointer-events:none';
    function layer(tag, cls, blend) {
      var el = doc.createElement(tag);
      el.className = 'road-l ' + cls;
      // max-width:none: the parallax layers are wider than the frame (site CSS caps canvases at 100%)
      el.style.cssText = 'position:absolute;left:0;top:0;max-width:none;max-height:none;will-change:transform' + (blend ? ';mix-blend-mode:' + blend : '');
      scene.appendChild(el);
      return el;
    }
    var LY = {
      sky: layer('canvas', 'road-sky'),
      dusk: layer('canvas', 'road-dusk', 'screen'),
      far: layer('canvas', 'road-hill'),
      mid: layer('canvas', 'road-hill'),
      mist: layer('canvas', 'road-mist', 'screen'),
      near: layer('canvas', 'road-hill'),
      ground: layer('div', 'road-ground')
    };
    canvas.className = 'road-canvas';
    canvas.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%';
    scene.appendChild(canvas);
    host.appendChild(scene);

    /* ---------- state ---------- */
    var W = 0, H = 0, dpr = 1, unit = 1, margin = 0, marginY = 0, hillH = 0, mistW = 0, mistH = 0;
    var comp = { vpx: 0.7, hy: 0.6, lens: 0.95, camX: -1.75, camY: 2.1 };
    var F = 1, baseCx = 0, baseCy = 0, cx = 0, cy = 0, camX = 0, camY = 0, camZ = opts.startZ != null ? opts.startZ : 11;
    var speed = opts.speed || 5.2;
    var progress = 0;
    var ptr = { x: 0, y: 0, tx: 0, ty: 0, active: false };
    var sceneT = 0, igniteT = -1, igniteSlot = 0, forcedOn = reduce;
    var raf = 0, lastNow = 0, frames = 0, drawn = 0, destroyed = false, readyFired = false, sized = false;
    var visible = true, hidden = !!doc.hidden, userPaused = false;
    var motionPaused = !!(window.GS && window.GS.motionPaused);
    var PAR = { far: 8, mid: 18, near: 34 };
    var placed = {};
    var stars = [];
    var times = new Float32Array(240), tIdx = 0, tN = 0, lastMs = 0, maxMs = 0;
    var autoTimer = 0;

    /* ---------- composition from CSS ---------- */
    function readComp() {
      var cs = getComputedStyle(host);
      var num = function (n, d) { var v = parseFloat(cs.getPropertyValue(n)); return isFinite(v) ? v : d; };
      var land = W >= H;
      comp.vpx = num('--road-vp-x', land ? 0.7 : 0.5);
      comp.hy = num('--road-horizon', land ? 0.6 : 0.42);
      comp.lens = num('--road-lens', land ? 0.95 : 0.62);
      comp.camX = num('--road-cam-x', -1.75);
      comp.camY = num('--road-cam-y', 2.1);
    }
    function sizeLayer(el, w, h, left, top) {
      if (el.tagName === 'CANVAS') { el.width = Math.max(1, Math.round(w * dpr)); el.height = Math.max(1, Math.round(h * dpr)); }
      el.style.width = w + 'px'; el.style.height = h + 'px';
      el.style.left = left + 'px'; el.style.top = top + 'px';
    }
    function ctx2(el) { var g = el.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); return g; }

    /* ---------- static layers ---------- */
    function buildSky() {
      var lw = W + margin * 2, lh = baseCy + marginY + H * 0.08;
      sizeLayer(LY.sky, lw, lh, -margin, -marginY);
      var g = ctx2(LY.sky);
      g.translate(margin, marginY);
      var hy = baseCy, vx = baseCx;
      var gr = g.createLinearGradient(0, -marginY, 0, hy);
      gr.addColorStop(0, '#040409');
      gr.addColorStop(0.34, '#07091a');
      gr.addColorStop(0.62, '#0e0f29');
      gr.addColorStop(0.8, '#1a1636');
      gr.addColorStop(0.9, '#2b1b37');
      gr.addColorStop(0.965, '#4a2232');
      gr.addColorStop(1, '#6a2c22');
      g.fillStyle = gr;
      g.fillRect(-margin, -marginY, lw, lh);
      // the last light sits where the road goes: a wide ember wash and a tight gold core
      g.save();
      g.translate(vx, hy);
      g.scale(1, 0.32);
      var rr = Math.max(W, H) * 0.75;
      gr = g.createRadialGradient(0, 0, 0, 0, 0, rr);
      gr.addColorStop(0, 'rgba(255,122,0,.42)');
      gr.addColorStop(0.22, 'rgba(255,72,31,.2)');
      gr.addColorStop(0.55, 'rgba(140,40,80,.08)');
      gr.addColorStop(1, 'rgba(60,20,70,0)');
      g.fillStyle = gr;
      g.fillRect(-rr, -rr, rr * 2, rr * 2);
      rr = Math.max(W, H) * 0.24;
      gr = g.createRadialGradient(0, 0, 0, 0, 0, rr);
      gr.addColorStop(0, 'rgba(255,214,120,.55)');
      gr.addColorStop(0.35, 'rgba(255,160,40,.2)');
      gr.addColorStop(1, 'rgba(255,122,0,0)');
      g.fillStyle = gr;
      g.fillRect(-rr, -rr, rr * 2, rr * 2);
      g.restore();
      // the night-time share of the afterglow (the dusk share is its own layer and fades at ignition)
      var aw = W * 0.55, ah = H * 0.2;
      g.globalCompositeOperation = 'lighter';
      g.globalAlpha = 0.3;
      g.drawImage(S.after, vx - aw / 2, hy - ah * 0.62, aw, ah);
      g.globalCompositeOperation = 'source-over';
      g.globalAlpha = 1;
      // thin strato streaks above the valley, lit from below by the last light
      var cr = rng(5);
      for (var ci = 0; ci < 9; ci++) {
        var cyy = hy * (0.7 + cr() * 0.22), cxx = vx + (cr() - 0.5) * W * 0.7, crx = W * (0.07 + cr() * 0.12), cry = H * (0.004 + cr() * 0.006);
        var warm = 1 - Math.min(1, Math.abs(cxx - vx) / (W * 0.6));
        g.save();
        g.translate(cxx, cyy);
        g.scale(1, cry / crx);
        var cg = g.createRadialGradient(0, 0, 0, 0, 0, crx);
        cg.addColorStop(0, 'rgba(255,' + Math.round(120 + 60 * warm) + ',' + Math.round(90 + 20 * warm) + ',' + (0.05 + 0.13 * warm * (cyy / hy)).toFixed(3) + ')');
        cg.addColorStop(1, 'rgba(255,120,90,0)');
        g.fillStyle = cg;
        g.fillRect(-crx, -crx, crx * 2, crx * 2);
        g.restore();
      }
      // stars: denser and brighter high up, washed out by the afterglow near the horizon
      var r = rng(91);
      var n = Math.round(lw * hy / 3600);
      stars = [];
      for (var i = 0; i < n; i++) {
        var x = r() * lw - margin, y = Math.pow(r(), 1.5) * (hy - H * 0.08) - marginY;
        var fadeH = 1 - sstep(hy * 0.45, hy * 0.92, y);
        var nearGlow = 1 - 0.8 * Math.exp(-Math.pow((x - vx) / (W * 0.3), 2)) * sstep(hy * 0.3, hy, y);
        var a = (0.18 + Math.pow(r(), 3) * 0.75) * fadeH * nearGlow;
        if (a < 0.04) continue;
        var s = r() < 0.06 ? 1.6 : r() < 0.3 ? 1.1 : 0.75;
        if (r() < 0.08 && stars.length < 26 && y < hy - H * 0.22) { stars.push({ x: x, y: y, s: s + 0.3, a: Math.min(1, a + 0.3), w: 0.6 + r() * 1.8, p: r() * 6.28 }); continue; }
        g.globalAlpha = a;
        g.fillStyle = r() < 0.2 ? '#FFE7C2' : '#E9ECFF';
        g.fillRect(x, y, s, s);
      }
      g.globalAlpha = 1;

      // dusk share of the afterglow, screened over the sky
      sizeLayer(LY.dusk, aw, ah, vx - aw / 2, hy - ah * 0.62);
      var dg = ctx2(LY.dusk);
      dg.globalAlpha = 0.34;
      dg.drawImage(S.after, 0, 0, aw, ah);
    }

    function buildHills() {
      var lw = W + margin * 2;
      var hh = hillH = unit * 0.24;
      var r = rng(7);
      var specs = [
        { el: LY.far, h: 0.125, v: 0.62, oct: [[1.15, 1], [2.7, 0.42], [6.5, 0.16], [17, 0.05]], top: '#1d1b3d', bot: '#3a2340', trees: 0 },
        { el: LY.mid, h: 0.08, v: 0.55, oct: [[2.1, 1], [4.6, 0.4], [11, 0.15], [29, 0.05]], top: '#12122b', bot: '#21182f', trees: 0 },
        { el: LY.near, h: 0.045, v: 0.4, oct: [[3.4, 1], [8, 0.35], [22, 0.12]], top: '#08080f', bot: '#0a0912', trees: 1 }
      ];
      specs.forEach(function (sp) {
        sizeLayer(sp.el, lw, hh, -margin, baseCy - hh + 1);
        var g = ctx2(sp.el);
        var nz = valueNoise(r), tz = valueNoise(r);
        var step = 3, pts = [];
        for (var x = 0; x <= lw + step; x += step) {
          var u = (x - margin) / W;
          var h = 0, norm = 0;
          for (var k = 0; k < sp.oct.length; k++) { h += nz(u * sp.oct[k][0] * 1.7 + k * 13.7) * sp.oct[k][1]; norm += sp.oct[k][1]; }
          h /= norm;
          // the road runs out through a valley: hills dip around the vanishing point
          var vd = (u - comp.vpx) / (W > H ? 0.15 : 0.22);
          var valley = 1 - sp.v * Math.exp(-vd * vd);
          var y = (0.35 + 0.9 * h) * sp.h * unit * valley;
          if (sp.trees) y += (tz(u * 90) * 0.6 + tz(u * 260 + 3) * 0.4) * unit * 0.008 * valley;
          pts.push(hh - y);
        }
        var gr = g.createLinearGradient(0, hh * 0.25, 0, hh);
        gr.addColorStop(0, sp.top);
        gr.addColorStop(1, sp.bot);
        g.fillStyle = gr;
        g.beginPath();
        g.moveTo(0, hh);
        for (var i = 0; i < pts.length; i++) g.lineTo(i * step, pts[i]);
        g.lineTo(lw, hh);
        g.closePath();
        g.fill();
        if (sp.trees) palms(g, pts, step, hh, r, sp.top);
      });

      // drifting valley mist (Brahmaputra-valley humidity), drawn twice side by side so it can loop
      mistW = lw; mistH = unit * 0.1;
      sizeLayer(LY.mist, lw * 2, mistH, -margin, baseCy - mistH * 0.72);
      LY.mist.style.opacity = '0.55';
      var mg = ctx2(LY.mist), mr = rng(23);
      for (var j = 0; j < 22; j++) {
        var mx = mr() * lw, my = mistH * (0.45 + mr() * 0.3), rx = W * (0.08 + mr() * 0.14), ry = mistH * (0.18 + mr() * 0.2);
        for (var t = -1; t <= 2; t++) {
          var ox = mx + t * lw;
          if (ox + rx < 0 || ox - rx > lw * 2) continue;
          mg.save();
          mg.translate(ox, my);
          mg.scale(1, ry / rx);
          var mgr = mg.createRadialGradient(0, 0, 0, 0, 0, rx);
          mgr.addColorStop(0, 'rgba(150,118,170,.32)');
          mgr.addColorStop(1, 'rgba(150,118,170,0)');
          mg.fillStyle = mgr;
          mg.fillRect(-rx, -rx, rx * 2, rx * 2);
          mg.restore();
        }
      }

      // the plain in front of the ridges
      var gh = H - baseCy;
      sizeLayer(LY.ground, W, gh + H * 0.06, 0, baseCy);
      LY.ground.style.background = 'linear-gradient(180deg,#171222 0,#0c0b13 ' + (gh * 0.05).toFixed(1) + 'px,#08080d ' + (gh * 0.4).toFixed(1) + 'px,#050507 ' + gh.toFixed(1) + 'px)';
    }

    // areca (tamul) palms: the silhouette of every Assamese village edge
    function palms(g, pts, step, hh, r, col) {
      var lw = W + margin * 2;
      var clusters = [-0.34, -0.2, 0.12, 0.27];
      g.strokeStyle = col;
      g.fillStyle = col;
      g.lineCap = 'round';
      for (var ci = 0; ci < clusters.length; ci++) {
        var cu = comp.vpx + clusters[ci] * (W > H ? 1 : 1.5);
        var n = 1 + Math.floor(r() * 3);
        for (var k = 0; k < n; k++) {
          var x = margin + (cu + (r() - 0.5) * 0.05) * W;
          if (x < 0 || x > lw) continue;
          var gi = clamp(Math.round(x / step), 0, pts.length - 1);
          var base = pts[gi] + 2;
          var th = unit * (0.034 + r() * 0.03);
          var lean = (r() - 0.5) * th * 0.12;
          var tw = Math.max(1, unit * 0.0018);
          g.lineWidth = tw;
          g.beginPath();
          g.moveTo(x, base);
          g.quadraticCurveTo(x + lean * 0.3, base - th * 0.6, x + lean, base - th);
          g.stroke();
          var tx = x + lean, ty = base - th, fl = unit * (0.0075 + r() * 0.0035);
          g.lineWidth = Math.max(0.8, tw * 0.9);
          for (var fi = 0; fi < 8; fi++) {
            var ang = -Math.PI / 2 + (fi / 7 - 0.5) * 2.9 + (r() - 0.5) * 0.25;
            var ex = tx + Math.cos(ang) * fl, ey = ty + Math.sin(ang) * fl * 0.55 + fl * 0.35;
            g.beginPath();
            g.moveTo(tx, ty);
            g.quadraticCurveTo(tx + Math.cos(ang) * fl * 0.6, ty + Math.sin(ang) * fl * 0.6 - fl * 0.18, ex, ey);
            g.stroke();
          }
          g.beginPath();
          g.ellipse(tx, ty + fl * 0.12, fl * 0.12, fl * 0.2, 0, 0, Math.PI * 2);
          g.fill();
        }
      }
    }

    /* ---------- sizing ---------- */
    function resize() {
      var rect = host.getBoundingClientRect();
      var w = Math.max(1, Math.round(rect.width)), h = Math.max(1, Math.round(rect.height));
      if (w === W && h === H && sized) return false;
      W = w; H = h; sized = true;
      var budget = opts.pixelBudget || 2.6e6;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      if (W * H * dpr * dpr > budget) dpr = Math.max(0.75, Math.sqrt(budget / (W * H)));
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      readComp();
      unit = Math.sqrt(W * H) * 0.82;
      margin = Math.round(W * 0.06);
      marginY = Math.round(H * 0.04);
      baseCx = W * comp.vpx;
      baseCy = H * comp.hy;
      F = comp.lens * H;
      buildSky();
      buildHills();
      placed = {};
      return true;
    }

    // the layers follow the camera's yaw/pitch (and the ridges add parallax); writes only real changes
    function move(key, el, x, y) {
      var p = placed[key];
      if (p && Math.abs(p[0] - x) < 0.05 && Math.abs(p[1] - y) < 0.05) return;
      placed[key] = [x, y];
      el.style.transform = 'translate3d(' + x.toFixed(2) + 'px,' + y.toFixed(2) + 'px,0)';
    }
    function placeLayers(yaw, pitch, night) {
      var k = W / 1440;
      move('sky', LY.sky, yaw, pitch);
      move('dusk', LY.dusk, yaw, pitch);
      move('far', LY.far, yaw - ptr.x * PAR.far * k, pitch);
      move('mid', LY.mid, yaw - ptr.x * PAR.mid * k, pitch);
      move('mist', LY.mist, yaw - ptr.x * 26 * k - ((sceneT * 5) % mistW), pitch);
      move('near', LY.near, yaw - ptr.x * PAR.near * k, pitch);
      move('ground', LY.ground, 0, pitch);
      var op = (1 - night).toFixed(2);
      if (placed.duskOp !== op) { placed.duskOp = op; LY.dusk.style.opacity = op; }
    }

    /* ---------- lamps ---------- */
    function level(slot) {
      if (forcedOn) return 1;
      if (igniteT < 0) return 0;
      var n = Math.max(0, slot - igniteSlot);
      var delay = 0.22 + 0.15 * Math.pow(n, 0.8);
      var j = hash(slot);
      return flicker((sceneT - igniteT - delay) * 1000 / (0.85 + 0.3 * j));
    }
    // per-frame cache of lamp levels (the ground, markings and lamps all ask for the same slots)
    var lvCache = new Float32Array(128), lvBase = 0, lvN = 0;
    function cacheLevels(s0, s1) {
      lvBase = s0; lvN = Math.min(lvCache.length, s1 - s0 + 1);
      for (var i = 0; i < lvN; i++) lvCache[i] = level(s0 + i);
    }
    function lvl(slot) { var i = slot - lvBase; return i >= 0 && i < lvN ? lvCache[i] : level(slot); }
    function lit(x, z) {
      var sum = 0, k0 = Math.floor(z / HALF);
      for (var s = k0 - 2; s <= k0 + 3; s++) {
        var L = lvl(s);
        if (L <= 0) continue;
        var hx = (s & 1) ? HEAD_X : -HEAD_X;
        var a = (x - hx) / RX, b = (z - s * HALF) / RZ;
        sum += Math.min(1, L) * Math.exp(-1.6 * (a * a + b * b));
      }
      return sum;
    }

    /* ---------- frame ---------- */
    function draw() {
      var c = ctx;
      var cX = cx, cY = cy, f = F, kx = camX, ky = camY, cz = camZ;
      var sx = function (x, dz) { return cX + f * (x - kx) / dz; };
      var sy = function (y, dz) { return cY - f * (y - ky) / dz; };
      var yaw = cx - baseCx, pitch = cy - baseCy;
      var T = sceneT;
      var lampsOn = igniteT < 0 && !forcedOn ? 0 : 1;
      // how far into the night we are: the afterglow sinks as the lamps take over
      var night = forcedOn ? 1 : igniteT < 0 ? 0 : sstep(0, 3.2, T - igniteT);
      placeLayers(yaw, pitch, night);

      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      c.globalCompositeOperation = 'source-over';
      c.globalAlpha = 1;
      c.clearRect(0, 0, W, H);

      /* a few stars twinkle (high enough never to sit over a ridge) */
      c.fillStyle = '#F3EFE6';
      for (var i = 0; i < stars.length; i++) {
        var st = stars[i];
        c.globalAlpha = st.a * (0.55 + 0.45 * Math.sin(T * st.w + st.p));
        c.fillRect(st.x + yaw, st.y + pitch, st.s, st.s);
      }
      c.globalAlpha = 1;
      var gr;

      /* road: one triangle to the vanishing point, cut just below the bottom edge */
      var dzN = f * ky / (H - cY + 40);
      var shoulder = 6.4;
      c.fillStyle = '#0a0a10';
      c.beginPath();
      c.moveTo(cX, cY);
      c.lineTo(sx(-shoulder, dzN), sy(0, dzN));
      c.lineTo(sx(shoulder, dzN), sy(0, dzN));
      c.closePath();
      c.fill();
      gr = c.createLinearGradient(0, cY, 0, H);
      gr.addColorStop(0, '#2a1a20');
      gr.addColorStop(0.06, '#141118');
      gr.addColorStop(0.35, '#0d0d13');
      gr.addColorStop(1, '#0b0b10');
      c.fillStyle = gr;
      c.beginPath();
      c.moveTo(cX, cY);
      c.lineTo(sx(-ROAD, dzN), sy(0, dzN));
      c.lineTo(sx(ROAD, dzN), sy(0, dzN));
      c.closePath();
      c.fill();

      /* the wet road mirrors the afterglow just below the horizon */
      c.globalCompositeOperation = 'lighter';
      c.globalAlpha = 0.22 + 0.18 * (1 - night);
      c.drawImage(S.halo, cX - W * 0.05, cY - H * 0.01, W * 0.1, H * 0.3);
      c.globalAlpha = 1;

      var half = HALF;
      var sMin = Math.ceil((cz + 0.7) / half), sMax = Math.floor((cz + FAR) / half);
      var s, z, dz, Lv, side, hx;
      cacheLevels(sMin - 4, sMax + 4);

      /* light on the ground: per scanline, one world-space Gaussian per side of the road, so pools
         stay correct in perspective and seam-free (rows snap to device pixels) */
      if (lampsOn) {
        c.globalCompositeOperation = 'lighter';
        var yRow = Math.ceil((cY + 0.5) * dpr) / dpr;
        var bandW = 3 * RX;                       // the band sprite spans ±1.5 RX
        while (yRow < H) {
          var rh = Math.max(1, Math.round(clamp((yRow - cY) * 0.02, 1, 4) * dpr)) / dpr;
          var zr0 = f * ky / (yRow + rh - cY), zr1 = f * ky / (yRow - cY);
          var zr = f * ky / (yRow + rh / 2 - cY);
          var ns = (zr1 - zr0) > RZ * 0.6 ? 5 : 1;  // rows near the horizon span several pools: average them
          var aL = 0, aR = 0;
          for (var q = 0; q < ns; q++) {
            var zw = cz + (ns === 1 ? zr : lerp(zr0, zr1, (q + 0.5) / ns));
            var k0 = Math.floor(zw / half);
            for (var sl = k0 - 2; sl <= k0 + 3; sl++) {
              var lv = lvl(sl);
              if (lv <= 0) continue;
              var dd = (zw - sl * half) / RZ;
              var e = Math.min(1.15, lv) * Math.exp(-1.6 * dd * dd);
              if (sl & 1) aR += e; else aL += e;
            }
          }
          var g2 = 0.6 * Math.exp(-zr / 280) / ns;
          var wpx = bandW * f / zr;
          if (aL > 0.004) { c.globalAlpha = Math.min(1, aL * g2); c.drawImage(S.band, sx(-HEAD_X, zr) - wpx / 2, yRow, wpx, rh); }
          if (aR > 0.004) { c.globalAlpha = Math.min(1, aR * g2); c.drawImage(S.band, sx(HEAD_X, zr) - wpx / 2, yRow, wpx, rh); }
          yRow += rh;
        }
      }

      /* markings: centre dashes and edge lines, brighter where a pool falls */
      c.globalCompositeOperation = 'source-over';
      c.fillStyle = '#ECE6D6';
      var speedNow = curSpeed();
      var blur = speedNow * 0.045;
      var j0 = Math.floor((cz + 0.7) / PERIOD), j1 = Math.floor((cz + 260) / PERIOD);
      for (var jj = j1; jj >= j0; jj--) {
        var za0 = jj * PERIOD - cz, za1 = za0 + DASH + blur;
        if (za1 <= 0.7) continue;
        za0 = Math.max(za0, 0.7);
        var b = 0.07 + 0.9 * Math.min(1.2, lit(0, cz + (za0 + za1) / 2));
        c.globalAlpha = clamp(b, 0, 0.9) * (1 - sstep(120, 260, za0));
        quad(sx(-LINE / 2, za0), sx(LINE / 2, za0), sy(0, za0), sx(-LINE / 2, za1), sx(LINE / 2, za1), sy(0, za1));
      }
      for (var e = -1; e <= 1; e += 2) {
        var ex = e * EDGE;
        var seg = 3;
        for (var zz = 160; zz > 0.7; zz -= seg) {
          var zA = Math.max(zz - seg, 0.7), zB = zz;
          var bb = 0.07 + 0.75 * Math.min(1.2, lit(ex, cz + (zA + zB) / 2));
          c.globalAlpha = clamp(bb, 0, 0.85) * (1 - sstep(90, 160, zA));
          quad(sx(ex - LINE / 2, zA), sx(ex + LINE / 2, zA), sy(0, zA), sx(ex - LINE / 2, zB), sx(ex + LINE / 2, zB), sy(0, zB));
          if (sy(0, zA) > H) break;
        }
      }

      /* reflections of every lit head in the wet asphalt */
      if (lampsOn) {
        c.globalCompositeOperation = 'lighter';
        for (s = sMax; s >= sMin; s--) {
          z = s * half; dz = z - cz;
          if (dz < 7 || dz > 360) continue;
          Lv = lvl(s);
          if (Lv <= 0.003) continue;
          hx = ((s & 1) ? 1 : -1) * HEAD_X;
          var rxS = sx(hx, dz), gy = sy(0, dz), mY = cY + f * (HEAD_Y + ky) / dz;
          if (gy > H) continue;
          var bot = mY + (mY - gy) * 0.75;
          var rw = Math.max(1.6, f * 0.5 / dz);
          c.globalAlpha = Math.min(1.1, Lv) * 0.42 * Math.exp(-dz / 300);
          c.drawImage(S.streak, rxS - rw * 2, gy, rw * 4, bot - gy);
        }
      }

      /* poles, panels, heads and their light — far to near */
      for (s = sMax; s >= sMin; s--) {
        z = s * half; dz = z - cz;
        if (dz < 0.7) continue;
        side = (s & 1) ? 1 : -1;
        Lv = lampsOn ? lvl(s) : 0;
        var Lc = Math.min(1, Lv);
        var pX = side * POLE_X;
        hx = side * HEAD_X;
        // far poles fade in from the haze; near left-side poles (they sweep behind the copy) ghost out
        var fade = (1 - sstep(330, 470, dz)) * (side < 0 ? 0.3 + 0.7 * sstep(2.2, 9, dz) : 1);
        var hxS = sx(hx, dz), hyS = sy(HEAD_Y - 0.06, dz), gyS = sy(0, dz);

        if (fade > 0.01) {
          c.globalCompositeOperation = 'source-over';
          c.globalAlpha = fade;
          var pxS = sx(pX, dz), topS = sy(POLE_H, dz);
          var wB = Math.max(0.7, f * 0.17 / dz), wT = Math.max(0.6, f * 0.1 / dz);
          // pole
          c.fillStyle = '#0d0d14';
          c.beginPath();
          c.moveTo(pxS - wB / 2, gyS); c.lineTo(pxS + wB / 2, gyS); c.lineTo(pxS + wT / 2, topS); c.lineTo(pxS - wT / 2, topS);
          c.closePath(); c.fill();
          if (dz < 140) {
            // road-facing edge catches the neighbours' light; the plinth catches the pool
            c.globalAlpha = fade * (0.18 + 0.4 * Lc);
            c.fillStyle = '#6b5a4c';
            var rimW = Math.max(0.5, wB * 0.28);
            var rx0 = side > 0 ? pxS - wB / 2 : pxS + wB / 2 - rimW;
            c.fillRect(rx0, sy(HEAD_Y - 0.3, dz), rimW, gyS - sy(HEAD_Y - 0.3, dz));
            c.globalAlpha = fade;
            c.fillStyle = '#16161d';
            var plW = f * 0.5 / dz, plH = f * 0.55 / dz;
            c.fillRect(pxS - plW / 2, gyS - plH, plW, plH);
            c.fillStyle = 'rgba(255,214,160,' + (0.08 + 0.3 * Lc).toFixed(3) + ')';
            c.fillRect(pxS - plW / 2, gyS - plH, plW, Math.max(0.6, plH * 0.12));
          }
          // arm, rising slightly toward the head
          var aX0 = sx(pX, dz), aY0 = sy(ARM_Y, dz), aX1 = sx(hx + side * 0.38, dz), aY1 = sy(HEAD_Y + 0.02, dz);
          c.strokeStyle = '#0d0d14';
          c.lineWidth = Math.max(0.6, f * 0.075 / dz);
          c.lineCap = 'round';
          c.beginPath();
          c.moveTo(aX0, aY0);
          c.quadraticCurveTo(sx(pX - side * 0.6, dz), sy(HEAD_Y + 0.12, dz), aX1, aY1);
          c.stroke();
          // battery box with its charge LED
          if (dz < 110 && side > 0) {
            var bxX = sx(pX + side * 0.02, dz), bw = f * 0.34 / dz, bt = sy(3.45, dz), bh = sy(2.75, dz) - bt;
            c.fillStyle = '#14151c';
            c.fillRect(bxX - bw / 2, bt, bw, bh);
            c.fillStyle = 'rgba(243,239,230,.10)';
            c.fillRect(bxX - bw / 2, bt, bw, Math.max(0.5, bh * 0.06));
          }
          // slim LED head: housing + emissive underside
          var hl = sx(hx - 0.42, dz), hr = sx(hx + 0.42, dz);
          var hTop = sy(HEAD_Y + 0.06, dz), hBot = sy(HEAD_Y - 0.05, dz);
          c.fillStyle = '#1b1c25';
          c.beginPath();
          var inner = side > 0 ? hl : hr, outer = side > 0 ? hr : hl;
          c.moveTo(outer, hTop); c.lineTo(inner, hTop + (hBot - hTop) * 0.35); c.lineTo(inner, hBot); c.lineTo(outer, hBot);
          c.closePath(); c.fill();
          if (dz < 70) {
            var uN = sy(HEAD_Y - 0.05, Math.max(0.5, dz - 0.15)), uF = sy(HEAD_Y - 0.05, dz + 0.15);
            var ul0 = sx(hx - 0.36, dz - 0.15), ur0 = sx(hx + 0.36, dz - 0.15), ul1 = sx(hx - 0.36, dz + 0.15), ur1 = sx(hx + 0.36, dz + 0.15);
            c.fillStyle = Lc > 0.02 ? 'rgba(255,248,226,' + (0.25 + 0.75 * Lc).toFixed(3) + ')' : '#2a2c39';
            c.beginPath();
            c.moveTo(ul1, uF); c.lineTo(ur1, uF); c.lineTo(ur0, uN); c.lineTo(ul0, uN);
            c.closePath(); c.fill();
          }
          // tilted solar panel on top
          if (dz < 300) panel(c, sx, sy, pX + side * 0.05, POLE_H + 0.42, dz, f, fade);
        }

        if (Lv > 0.003) {
          c.globalCompositeOperation = 'lighter';
          var ext = Math.exp(-Math.max(0, dz - 90) / 260);
          var a = Lv * ext;
          var rb = clamp(f * 0.62 / dz, 1.3, H * 0.045);
          // volumetric cone through the humid air
          if (dz < 180 && dz > 5) {
            var cwB = f * 8.6 / dz;
            c.globalAlpha = 0.16 * a * (1 - sstep(110, 180, dz)) * sstep(5, 14, dz);
            c.drawImage(S.cone, hxS - cwB / 2, hyS, cwB, gyS - hyS);
          }
          c.globalAlpha = 0.3 * a;
          c.drawImage(S.halo, hxS - rb * 3.4, hyS - rb * 3, rb * 6.8, rb * 6);
          c.globalAlpha = Math.min(1, a);
          c.drawImage(S.glow, hxS - rb * 1.5, hyS - rb * 0.85, rb * 3, rb * 1.7);
          if (Lv > 1) { c.globalAlpha = (Lv - 1) * 2; c.drawImage(S.glow, hxS - rb * 2.4, hyS - rb * 1.6, rb * 4.8, rb * 3.2); }
          if (dz < 85) {
            var fw = Math.min(W * 0.11, rb * 9), fh = Math.max(1, rb * 0.14);
            c.globalAlpha = 0.3 * Math.min(1, a) * sstep(85, 22, dz);
            c.drawImage(S.flare, hxS - fw, hyS - fh / 2, fw * 2, fh);
          }
        }
        // charge LED, blinking slowly (volt accent)
        if (dz < 70 && fade > 0 && side > 0) {
          var on = (Math.sin(T * 2.4 + s * 1.7) > 0.55) ? 1 : 0.25;
          var lr = Math.max(0.8, f * 0.045 / dz);
          var lx = sx(pX + side * 0.02 - side * 0.1, dz), ly = sy(3.3, dz);
          c.globalCompositeOperation = 'lighter';
          c.globalAlpha = on * (1 - sstep(40, 70, dz));
          c.drawImage(S.volt, lx - lr * 3, ly - lr * 3, lr * 6, lr * 6);
        }
      }
      c.globalCompositeOperation = 'source-over';
      c.globalAlpha = 1;

      function quad(xa0, xa1, ya, xb0, xb1, yb) {
        c.beginPath();
        c.moveTo(xa0, ya); c.lineTo(xa1, ya); c.lineTo(xb1, yb); c.lineTo(xb0, yb);
        c.closePath();
        c.fill();
      }
    }

    // a small mono-crystalline panel tilted at 26°, facing the camera; its underside shows once it is overhead
    function panel(c, sx, sy, pcx, pcy, dz, f, fade) {
      var hw = 0.62, hl = 0.36, sn = Math.sin(TILT) * hl, cs = Math.cos(TILT) * hl;
      var zt = dz + cs, zb = dz - cs;
      if (zb < 0.6) return;
      var yt = pcy + sn, yb = pcy - sn;
      var x0 = sx(pcx - hw, zt), x1 = sx(pcx + hw, zt), x2 = sx(pcx + hw, zb), x3 = sx(pcx - hw, zb);
      var y0 = sy(yt, zt), y2 = sy(yb, zb);
      // bracket
      c.strokeStyle = '#0d0d14';
      c.lineWidth = Math.max(0.6, f * 0.06 / dz);
      c.beginPath(); c.moveTo(sx(pcx, dz), sy(POLE_H - 0.05, dz)); c.lineTo(sx(pcx, dz), sy(pcy, dz)); c.stroke();
      var face = Math.cos(TILT) * (camY - pcy) + Math.sin(TILT) * dz > 0;
      c.globalAlpha = fade;
      c.fillStyle = face ? '#16204a' : '#16171f';
      c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y0); c.lineTo(x2, y2); c.lineTo(x3, y2); c.closePath(); c.fill();
      var big = (x1 - x0) > 14;
      if (face) {
        // glass sheen picks up the dusk sky; cell grid on the near ones
        c.fillStyle = 'rgba(255,150,90,.16)';
        c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y0); c.lineTo(lerp(x1, x2, 0.4), lerp(y0, y2, 0.4)); c.lineTo(lerp(x0, x3, 0.4), lerp(y0, y2, 0.4)); c.closePath(); c.fill();
        if (big) {
          c.strokeStyle = 'rgba(150,170,230,.22)';
          c.lineWidth = 0.6;
          c.beginPath();
          for (var i = 1; i < 6; i++) { var t = i / 6; c.moveTo(lerp(x0, x1, t), y0); c.lineTo(lerp(x3, x2, t), y2); }
          for (i = 1; i < 3; i++) { t = i / 3; var yy = lerp(y0, y2, t); c.moveTo(lerp(x0, x3, t), yy); c.lineTo(lerp(x1, x2, t), yy); }
          c.stroke();
        }
      }
      if ((x1 - x0) > 4) {
        c.strokeStyle = face ? 'rgba(200,205,220,.55)' : 'rgba(200,205,220,.25)';
        c.lineWidth = Math.max(0.6, f * 0.025 / dz);
        c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y0); c.lineTo(x2, y2); c.lineTo(x3, y2); c.closePath(); c.stroke();
      }
    }

    function curSpeed() { return speed * (1 + 7 * progress * progress); }

    function step(dt) {
      sceneT += dt;
      var k = 1 - Math.exp(-dt * 2.4);
      if (!ptr.active) { ptr.tx = Math.sin(sceneT * 0.13) * 0.32; ptr.ty = Math.sin(sceneT * 0.083 + 1) * 0.12; }
      ptr.x += (ptr.tx - ptr.x) * k;
      ptr.y += (ptr.ty - ptr.y) * k;
      camZ += curSpeed() * dt;
      pose();
    }
    function pose() {
      camX = comp.camX + ptr.x * 0.85;
      camY = comp.camY + ptr.y * 0.22 + progress * 1.4 + Math.sin(sceneT * 0.7) * 0.015;
      cx = baseCx + ptr.x * 0.028 * W;
      cy = baseCy + ptr.y * 0.016 * H;
    }

    function render() {
      var t0 = performance.now();
      draw();
      if (opts.flush) ctx.getImageData(0, 0, 1, 1); // benchmarking only: include rasterisation in the timing
      var ms = performance.now() - t0;
      lastMs = ms;
      times[tIdx] = ms; tIdx = (tIdx + 1) % times.length; tN = Math.min(times.length, tN + 1);
      if (frames > 30 && ms > maxMs) maxMs = ms;
      drawn++;
      if (!readyFired) {
        readyFired = true;
        host.classList.add('is-ready');
        try { host.dispatchEvent(new CustomEvent('gs:road-ready', { bubbles: true })); } catch (e) { /* old browsers */ }
      }
    }

    function running() { return !destroyed && !reduce && visible && !hidden && !userPaused && !motionPaused; }
    function loop(now) {
      raf = 0;
      if (!running()) { lastNow = 0; return; }
      var dt = lastNow ? Math.min(0.05, (now - lastNow) / 1000) : 1 / 60;
      lastNow = now;
      step(dt);
      render();
      frames++;
      raf = requestAnimationFrame(loop);
    }
    function wake() { if (!raf && running()) raf = requestAnimationFrame(loop); }
    function finishIgnition() { if (!forcedOn) { forcedOn = true; } }
    function still() { if (!destroyed) { pose(); render(); } }

    /* ---------- inputs ---------- */
    function onPointer(e) {
      if (e.pointerType === 'touch') return;
      var r = host.getBoundingClientRect();
      if (e.clientY > r.bottom || e.clientY < r.top) return;
      ptr.active = true;
      ptr.tx = clamp(((e.clientX - r.left) / r.width) * 2 - 1, -1, 1);
      ptr.ty = clamp(((e.clientY - r.top) / r.height) * 2 - 1, -1, 1);
    }
    function onLeave(e) { if (!e.relatedTarget) ptr.active = false; }
    function onVis() { hidden = !!doc.hidden; wake(); }
    function onMotion(e) {
      motionPaused = e && e.detail && 'paused' in e.detail ? !!e.detail.paused : !!(window.GS && window.GS.motionPaused);
      if (motionPaused) { finishIgnition(); still(); }
      wake();
    }
    var ro = null, io = null, roT = 0;
    function onResize() {
      if (destroyed) return;
      if (resize()) { pose(); render(); }
    }
    if (window.ResizeObserver) { ro = new ResizeObserver(function () { cancelAnimationFrame(roT); roT = requestAnimationFrame(onResize); }); ro.observe(host); }
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    if (window.IntersectionObserver) {
      io = new IntersectionObserver(function (en) { visible = en[en.length - 1].isIntersecting; wake(); }, { rootMargin: '40px' });
      io.observe(host);
    }
    doc.addEventListener('visibilitychange', onVis);
    doc.addEventListener('gs:motion', onMotion);
    if (!reduce) {
      window.addEventListener('pointermove', onPointer, { passive: true });
      doc.addEventListener('pointerout', onLeave);
    }

    /* ---------- go ---------- */
    resize();
    if (reduce) {
      // one finished frame: lamps on, a composed moment of the drive, no motion
      camZ = opts.startZ != null ? opts.startZ : 11;
      sceneT = 4;
      pose();
      render();
    } else {
      pose();
      render();
      if (motionPaused) { finishIgnition(); still(); }
      wake();
    }

    function ignite() {
      if (igniteT >= 0 || forcedOn) return;
      igniteT = sceneT;
      igniteSlot = Math.ceil((camZ + 0.7) / HALF);
      if (!running()) { finishIgnition(); still(); }
    }
    if (opts.ignite !== false && !reduce) autoTimer = setTimeout(ignite, opts.delay != null ? opts.delay : 450);

    return {
      ignite: ignite,
      pause: function () { userPaused = true; finishIgnition(); still(); },
      play: function () { userPaused = false; wake(); },
      setProgress: function (p) {
        p = clamp(+p || 0, 0, 1);
        if (p === progress) return;
        progress = p;
        scene.style.opacity = (1 - 0.92 * sstep(0.05, 0.95, p)).toFixed(3);
        if (!running() && !destroyed) still();
      },
      stats: function () {
        var sum = 0;
        for (var i = 0; i < tN; i++) sum += times[i];
        return {
          frames: drawn, avgDrawMs: tN ? +(sum / tN).toFixed(3) : 0, lastDrawMs: +lastMs.toFixed(3), maxDrawMs: +maxMs.toFixed(3),
          samples: tN, width: W, height: H, dpr: +dpr.toFixed(3), canvasPx: canvas.width * canvas.height,
          running: running(), reduced: reduce, lit: forcedOn || igniteT >= 0, progress: progress,
          vp: [+cx.toFixed(1), +cy.toFixed(1)]
        };
      },
      destroy: function () {
        destroyed = true;
        clearTimeout(autoTimer);
        if (raf) cancelAnimationFrame(raf);
        raf = 0;
        if (ro) ro.disconnect();
        if (io) io.disconnect();
        window.removeEventListener('resize', onResize);
        window.removeEventListener('orientationchange', onResize);
        window.removeEventListener('pointermove', onPointer);
        doc.removeEventListener('pointerout', onLeave);
        doc.removeEventListener('visibilitychange', onVis);
        doc.removeEventListener('gs:motion', onMotion);
        host.classList.remove('is-ready');
        if (scene.parentNode) scene.parentNode.removeChild(scene);
      }
    };
  }

  window.GSHeroRoad = { mount: mount };
})();
