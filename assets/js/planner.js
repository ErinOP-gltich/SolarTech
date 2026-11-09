/* Road planner page: the form, the recommendation (plan.js) and a 3D night view of the road with the lights on it.
   A module (three.js is an ES module); everything else on the page is ready before it runs. */
import * as THREE from '../vendor/three.module.min.js';

const GS = window.GS, P = window.GSPlan, root = document.documentElement;
const LIGHTS = GS.products.filter(function (p) { return /^si-\d+w$/.test(p.id); });
const form = document.querySelector('[data-plan-form]');
const out = document.querySelector('[data-out]');
const stage = document.querySelector('[data-stage]');
const hud = document.querySelector('[data-hud]');
const lite = root.classList.contains('lite') || GS.reduceMotion;
let plan = null, rebuild = 0;

// page intro: the headline words rise in once the loading screen lifts, as on the other pages
GS.ready(function () {
  document.querySelectorAll('[data-hero-line]').forEach(function (l, i) { GS.splitIn(l, .1 + i * .12); });
});

/* ---------------------------------------------------------------- form + result */
function read() {
  const f = new FormData(form);
  return {
    road: f.get('road'), length: f.get('length'), lanes: f.get('lanes'), laneWidth: f.get('laneWidth'),
    arrangement: f.get('arrangement'), spacing: f.get('std') ? 0 : f.get('spacing')
  };
}
const fmt = function (n) { return Number(n).toLocaleString('en-IN'); };

function show() {
  plan = P.plan(read(), LIGHTS);
  if (!plan) return;
  form.querySelector('[data-width-out]').textContent = plan.width + ' m wide';
  const E = form.elements, std = E.std.checked;
  E.spacing.disabled = E.spacingR.disabled = std;
  if (std) E.spacing.value = E.spacingR.value = plan.spacing;
  const own = !std && +E.spacing.value > 0;
  form.querySelector('[data-sp-out]').textContent = own ? 'Your spacing: ' + plan.spacing + ' m.' : 'Standard for a ' + plan.watt + ' W light: ' + plan.spacing + ' m' + (std ? '.' : ' (type a spacing to use your own).');

  const L = plan.light, pct = Math.min(100, plan.lux / (plan.target * 2) * 100), ok = plan.bright && plan.reach;
  out.innerHTML =
    '<p class="label pl-kicker"><i class="pl-live"></i>Recommended for your road</p>' +
    '<div class="pl-pick"><span class="pl-pick-ph"><img src="' + GS.esc(L.img) + '" alt=""></span><div>' +
    '<h2 class="h3">' + GS.esc(L.short || L.name) + '</h2><p class="label">' + GS.esc(L.part) + '</p>' +
    '<p class="pl-pick-sub">' + GS.esc(L.battery + ' ' + (L.chem || '')) + ' · ' + GS.esc(L.panel) + ' panel · ' + GS.esc(L.ip || '') + '</p></div></div>' +
    '<dl class="pl-nums">' +
    '<div class="pl-big"><dt class="label">Poles</dt><dd>' + fmt(plan.poles) + '</dd></div>' +
    '<div><dt class="label">Spacing</dt><dd>' + plan.spacing + '<small> m</small></dd></div>' +
    '<div><dt class="label">Pole height</dt><dd>' + plan.height + '<small> m</small></dd></div>' +
    '<div><dt class="label">Layout</dt><dd class="pl-sm">' + GS.esc(plan.arrangementName) + '</dd></div>' +
    '<div><dt class="label">LED power</dt><dd>' + plan.kw + '<small> kW</small></dd></div>' +
    '<div><dt class="label">Per side</dt><dd class="pl-sm">' + plan.sideA + (plan.sideB ? ' + ' + plan.sideB : '') + '</dd></div>' +
    '</dl>' +
    '<div class="pl-lux' + (ok ? '' : ' is-low') + '"><div class="pl-lux-row"><span class="label">Light on the road</span><b>' + plan.lux + ' lux</b></div>' +
    '<div class="pl-lux-bar"><i style="width:' + pct.toFixed(1) + '%"></i><em style="left:50%" title="Target"></em></div>' +
    '<p class="label">Target for a ' + GS.esc(plan.roadName.toLowerCase()) + ': ' + plan.target + ' lux average</p></div>' +
    (plan.notes.length ? '<ul class="pl-notes">' + plan.notes.map(function (n) { return '<li>' + GS.esc(n) + '</li>'; }).join('') + '</ul>' : '') +
    '<div class="pl-act">' +
    '<button type="button" class="btn btn-plasma sl" data-add><span class="state" aria-hidden="true"></span>Add ' + fmt(plan.poles) + ' to my quote</button>' +
    '<button type="button" class="btn btn-ai sl" data-ask><span class="state" aria-hidden="true"></span><span class="ai-spark" aria-hidden="true"></span>Ask AI about this plan</button>' +
    '</div><p class="pl-fine">An estimate from standard spacing and the lumen method. We confirm every layout before quoting.</p>';

  hud.querySelector('[data-hud-text]').textContent = plan.poles + ' poles · ' + plan.spacing + ' m · ' + plan.arrangementName;
  stage.querySelector('[data-hud-lux]').textContent = plan.lux;
  // the 3D road is rebuilt once a slider settles, not on every step of the drag
  if (scene3d) { clearTimeout(rebuild); rebuild = setTimeout(function () { scene3d.build(plan); }, 140); }
}

// each slider and its box show the same number; the box takes any value (a 12 km road, 7.5 m spacing), the slider a usual range
form.addEventListener('input', function (e) {
  const E = form.elements, n = e.target.name;
  if (n === 'lengthR') E.length.value = e.target.value;
  if (n === 'length') E.lengthR.value = e.target.value;
  if (n === 'spacingR') E.spacing.value = e.target.value;
  if (n === 'spacing') E.spacingR.value = e.target.value;
});
form.addEventListener('input', show);
form.addEventListener('change', show);
form.addEventListener('submit', function (e) { e.preventDefault(); });
form.addEventListener('click', function (e) {
  const b = e.target.closest('[data-step]'); if (!b) return;
  const n = form.elements.lanes; n.value = Math.min(8, Math.max(1, (+n.value || 1) + +b.dataset.step)); show();
});
out.addEventListener('click', function (e) {
  if (e.target.closest('[data-add]') && plan) {
    GS.quote.add(plan.light.id, plan.poles);
    try { sessionStorage.setItem('gs-plan', P.summary(plan)); } catch (err) { /* private mode */ }   // contact.js writes it into the message
    GS.toast(plan.poles + ' × ' + (plan.light.short || plan.light.name) + ' on your quote list.', { text: 'Send it', href: 'contact#enquiry' });
  }
  if (e.target.closest('[data-ask]') && plan && window.GSAsk) window.GSAsk.open('Explain this road plan and tell me if anything could be better: ' + P.summary(plan));
});

/* ---------------------------------------------------------------- 3D */
let scene3d = null;
try { scene3d = make3d(); } catch (e) { stage.classList.add('no-3d'); }
show();

function make3d() {
  const canvas = stage.querySelector('canvas');
  const renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: !lite, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, lite ? 1 : (matchMedia('(pointer: coarse)').matches ? 1.5 : 1.75)));
  const scene = new THREE.Scene();
  // near at .5 m (not .1): depth precision far down the road is ~5x better, so nothing on the ground flickers when zoomed out
  const camera = new THREE.PerspectiveCamera(48, 1, .5, 900);
  scene.fog = new THREE.Fog(0x000000, 50, 330);
  const hemi = new THREE.HemisphereLight(0xffffff, 0x222233, .6);
  scene.add(hemi);

  // a soft round spot (light on the ground, headlight glow) and a top-bright fade (the cone under each lamp)
  const glowTex = (function () {
    const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
    const r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(.35, 'rgba(255,255,255,.55)'); r.addColorStop(.7, 'rgba(255,255,255,.14)'); r.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = r; g.fillRect(0, 0, 128, 128); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  })();
  const fadeTex = (function () {
    const c = document.createElement('canvas'); c.width = 4; c.height = 64; const g = c.getContext('2d');
    const r = g.createLinearGradient(0, 0, 0, 64); r.addColorStop(0, '#fff'); r.addColorStop(.5, '#555'); r.addColorStop(1, '#000');
    g.fillStyle = r; g.fillRect(0, 0, 4, 64); return new THREE.CanvasTexture(c);
  })();
  const add = function (o) { scene.add(o); return o; };
  const basic = function (o) { return new THREE.MeshBasicMaterial(o); };
  const lift = function (n) { return { polygonOffset: true, polygonOffsetFactor: -n, polygonOffsetUnits: -n * 2 }; };
  const glow = function (o) { return new THREE.MeshBasicMaterial(Object.assign({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }, o)); };

  // the palettes: night (dark theme) and dusk (light theme)
  const THEMES = {
    dark: { fog: 0x0a0b16, ground: 0x07080d, road: 0x15161d, mark: 0xb9b5ad, hill: 0x0d0f1c, tree: 0x0b1410, pole: 0x4a4d58, pool: 0xffcf8a, cone: 0x50391a, head: 0xfff2cc, stars: 1, hemi: .35 },
    light: { fog: 0xf3b9a4, ground: 0x8f7c7a, road: 0x4b4552, mark: 0xfff6ea, hill: 0xb497c4, tree: 0x5e6f62, pole: 0x6e6a74, pool: 0xfff0c2, cone: 0x3a2d1a, head: 0xffffff, stars: 0, hemi: .9 }
  };

  // world that doesn't change with the plan: ground, hills (it is the North-East), trees, stars
  const ground = add(new THREE.Mesh(new THREE.PlaneGeometry(1400, 1400), new THREE.MeshLambertMaterial()));
  ground.rotation.x = -Math.PI / 2;
  const hillGeo = new THREE.ConeGeometry(1, 1, 5, 1);
  const hills = add(new THREE.InstancedMesh(hillGeo, new THREE.MeshLambertMaterial({ flatShading: true }), 34));
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v3 = new THREE.Vector3(), s3 = new THREE.Vector3();
  let seed = 7; const rnd = function () { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (let i = 0; i < 34; i++) {
    const a = i / 34 * Math.PI * 2 + rnd() * .2, d = 240 + rnd() * 90, h = 40 + rnd() * 70, r = 60 + rnd() * 70;
    m4.compose(v3.set(Math.cos(a) * d, h / 2 - 2, Math.sin(a) * d), q.setFromAxisAngle(s3.set(0, 1, 0), rnd() * 3), new THREE.Vector3(r, h, r));
    hills.setMatrixAt(i, m4);
  }
  const trees = add(new THREE.InstancedMesh(new THREE.ConeGeometry(1, 1, 6, 1), new THREE.MeshLambertMaterial({ flatShading: true }), 90));
  trees.frustumCulled = hills.frustumCulled = false;   // their instances move; skip the stale bounding sphere
  const stars = (function () {
    const n = 700, a = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { const t = rnd() * Math.PI * 2, p = Math.acos(rnd() * .9 + .1), r = 600; a[i * 3] = Math.sin(p) * Math.cos(t) * r; a[i * 3 + 1] = Math.cos(p) * r; a[i * 3 + 2] = Math.sin(p) * Math.sin(t) * r; }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(a, 3));
    return add(new THREE.Points(g, new THREE.PointsMaterial({ size: 1.6, sizeAttenuation: false, color: 0xffffff, transparent: true, opacity: .75, fog: false })));
  })();

  // the parts that follow the plan live in one group, rebuilt each time
  let group = null, lamps = [], cars = [], born = 0, span = 100;
  const mats = {
    // the flat layers on the ground are a hair apart: a depth offset fixes their order (ground < road < markings < light),
    // or the graphics card flips between them as the camera moves ("z-fighting": the light pools blinked when zoomed out)
    road: new THREE.MeshLambertMaterial(lift(1)), mark: basic(lift(2)), pole: new THREE.MeshLambertMaterial(), panel: new THREE.MeshLambertMaterial({ color: 0x1d3160 }),
    head: basic({}), pool: glow(Object.assign({ map: glowTex }, lift(4))), cone: glow({ alphaMap: fadeTex, side: THREE.DoubleSide }),
    hl: basic({ color: 0xfff7e0 }), tl: basic({ color: 0xff2a1a }), beam: glow(Object.assign({ map: glowTex, color: 0x8a7a5a }, lift(4)))
  };

  function build(p) {
    if (group) { scene.remove(group); group.traverse(function (o) { if (o.geometry) o.geometry.dispose(); }); }
    group = new THREE.Group(); scene.add(group); lamps = []; cars = [];
    const W = p.width, H = p.height, S = p.spacing, arm = Math.min(1.6, .25 * W + .4);
    span = Math.min(p.length, Math.max(8 * S, 120), 240);   // how much of the road we draw; fog takes the rest
    const x0 = -span / 2;

    const road = new THREE.Mesh(new THREE.PlaneGeometry(span + (p.length > span ? 400 : 6), W), mats.road);
    road.rotation.x = -Math.PI / 2; road.position.y = .01; group.add(road);
    // lane lines: dashed between lanes, solid at the edges
    const dashes = [], dash = 3, gap = 4.5, len = span + (p.length > span ? 400 : 6);
    for (let k = 1; k < p.lanes; k++) for (let x = -len / 2; x < len / 2; x += dash + gap) dashes.push([x + dash / 2, -W / 2 + k * p.laneWidth, dash, .14]);
    dashes.push([0, -W / 2 + .2, len, .12], [0, W / 2 - .2, len, .12]);
    const marks = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), mats.mark, dashes.length);
    dashes.forEach(function (d, i) { m4.compose(v3.set(d[0], .02, d[1]), q.setFromAxisAngle(s3.set(1, 0, 0), -Math.PI / 2), new THREE.Vector3(d[2], d[3], 1)); marks.setMatrixAt(i, m4); });
    group.add(marks);

    // poles: side A along z = -edge, arm reaching over the road; side B mirrored, offset by half a gap when zigzag
    const pos = [];
    const sides = [[-1, 0]].concat(p.arrangement === 'one' ? [] : [[1, p.arrangement === 'zigzag' ? S / 2 : 0]]);
    sides.forEach(function (sd) { for (let x = x0 + sd[1]; x <= x0 + span + .01; x += S) pos.push([x, sd[0]]); });
    pos.sort(function (a, b) { return a[0] - b[0]; });
    const n = pos.length, edge = W / 2 + .9;
    const poleM = new THREE.InstancedMesh(new THREE.CylinderGeometry(.07, .12, H, 8).translate(0, H / 2, 0), mats.pole, n);
    const armM = new THREE.InstancedMesh(new THREE.BoxGeometry(.07, .07, arm).translate(0, 0, arm / 2), mats.pole, n);
    const panelM = new THREE.InstancedMesh(new THREE.BoxGeometry(1.1, .05, .7), mats.panel, n);
    const boxM = new THREE.InstancedMesh(new THREE.BoxGeometry(.32, .55, .22), mats.pole, n);
    const headM = new THREE.InstancedMesh(new THREE.BoxGeometry(.32, .1, .78), mats.head, n);
    const poolM = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), mats.pool, n);
    const coneM = new THREE.InstancedMesh(new THREE.ConeGeometry(H * .85, H - .25, 24, 1, true), mats.cone, n);
    const rx = new THREE.Quaternion().setFromAxisAngle(s3.set(1, 0, 0), -Math.PI / 2), id = new THREE.Quaternion(), one = new THREE.Vector3(1, 1, 1);
    pos.forEach(function (pp, i) {
      const x = pp[0], side = pp[1], z = side * edge, toward = -side, lz = z + toward * (arm + .1), flip = new THREE.Quaternion().setFromAxisAngle(s3.set(0, 1, 0), side > 0 ? Math.PI : 0);
      m4.compose(v3.set(x, 0, z), id, one); poleM.setMatrixAt(i, m4);
      m4.compose(v3.set(x, H - .18, z), flip, one); armM.setMatrixAt(i, m4);
      m4.compose(v3.set(x, H + .45, z), new THREE.Quaternion().setFromAxisAngle(s3.set(1, 0, 0), -side * .45), one); panelM.setMatrixAt(i, m4);
      m4.compose(v3.set(x, 2.6, z - side * .16), id, one); boxM.setMatrixAt(i, m4);
      m4.compose(v3.set(x, H - .2, lz), id, one); headM.setMatrixAt(i, m4);
      const r = H * 3.6; m4.compose(v3.set(x, .03, lz), rx, new THREE.Vector3(r, r * 1.08, 1)); poolM.setMatrixAt(i, m4);
      m4.compose(v3.set(x, (H - .25) / 2, lz), id, one); coneM.setMatrixAt(i, m4);
      lamps.push(x);
    });
    [poleM, armM, panelM, boxM, headM, poolM, coneM].forEach(function (m) { group.add(m); });
    lamps = { x: lamps, head: headM, pool: poolM, cone: coneM };

    // trees: well back from the road, never in the way of a pole
    let t = 0;
    for (let i = 0; i < 90; i++) {
      const side = i % 2 ? 1 : -1, x = (rnd() - .5) * (span + 160), z = side * (edge + (side < 0 ? 22 : 9) + rnd() * 30), h = 3 + rnd() * 5;
      m4.compose(v3.set(x, h / 2, z), id, new THREE.Vector3(1.4 + rnd() * 1.4, h, 1.4 + rnd() * 1.4)); trees.setMatrixAt(t++, m4);
    }
    trees.instanceMatrix.needsUpdate = true;

    // traffic: a few cars, half each way
    if (!lite) {
      const count = Math.min(6, p.lanes * 2);
      for (let i = 0; i < count; i++) {
        const lane = i % p.lanes, dir = p.lanes === 1 ? 1 : (lane < p.lanes / 2 ? 1 : -1);
        const car = new THREE.Group();
        const body = new THREE.Mesh(new THREE.BoxGeometry(4.2, .9, 1.8), new THREE.MeshLambertMaterial({ color: [0xd94a2b, 0xe8e2d6, 0x2b5bd9, 0x1f1f24, 0xf0b400, 0x8c8c94][i % 6] }));
        body.position.y = .65; car.add(body);
        const top = new THREE.Mesh(new THREE.BoxGeometry(2.2, .7, 1.6), body.material); top.position.set(-.3, 1.4, 0); car.add(top);
        [-.6, .6].forEach(function (z) {
          const h = new THREE.Mesh(new THREE.BoxGeometry(.06, .16, .34), mats.hl); h.position.set(2.11, .7, z); car.add(h);
          const tl = new THREE.Mesh(new THREE.BoxGeometry(.06, .14, .3), mats.tl); tl.position.set(-2.11, .75, z); car.add(tl);
        });
        const beam = new THREE.Mesh(new THREE.PlaneGeometry(14, 4.5), mats.beam); beam.rotation.x = -Math.PI / 2; beam.position.set(9, .04, 0); car.add(beam);
        car.rotation.y = dir > 0 ? 0 : Math.PI;
        car.position.set((rnd() - .5) * span, 0, -W / 2 + (lane + .5) * p.laneWidth);
        car.userData = { dir: dir, v: 9 + rnd() * 6 };
        group.add(car); cars.push(car);
      }
    }
    born = performance.now();
    paint(); go();
  }

  // colours for the current theme
  let T = null;
  // night by default (the lights show best), in both site themes; the Night / Dusk switch changes it and is remembered
  let skyPref = null; try { skyPref = localStorage.getItem('gs-sky'); } catch (e) { /* storage blocked */ }
  const sky = function () { return skyPref === 'dusk' ? 'dusk' : 'night'; };
  const skyBtn = stage.querySelector('[data-sky-toggle]');
  function paint() {
    const s = sky();
    T = THEMES[s === 'dusk' ? 'light' : 'dark'];
    if (skyBtn) { skyBtn.setAttribute('aria-pressed', s === 'night'); skyBtn.querySelector('[data-sky-label]').textContent = s === 'night' ? 'Dusk' : 'Night'; skyBtn.setAttribute('aria-label', s === 'night' ? 'Switch the scene to dusk' : 'Switch the scene to night'); }
    scene.fog.color.setHex(T.fog); ground.material.color.setHex(T.ground); hills.material.color.setHex(T.hill); trees.material.color.setHex(T.tree);
    mats.road.color.setHex(T.road); mats.mark.color.setHex(T.mark); mats.pole.color.setHex(T.pole);
    stars.visible = !!T.stars; hemi.intensity = T.hemi;
    stage.dataset.sky = s;
    lightUp(1e9);
  }
  // each lamp comes on in turn along the road, the way a real row does at dusk
  const cOff = new THREE.Color(0x2a2a30), cOn = new THREE.Color(), cTmp = new THREE.Color();
  function lightUp(now) {
    if (!lamps.x) return false;
    let busy = false; cOn.setHex(T.head);
    lamps.x.forEach(function (x, i) {
      const k = lite ? 1 : Math.min(1, Math.max(0, (now - born - 250 - i * 70) / 500)); if (k < 1) busy = true;
      const f = k * k * (3 - 2 * k), flick = k > 0 && k < 1 && Math.sin(now * .09 + i) > .6 ? .4 : 1;
      lamps.head.setColorAt(i, cTmp.copy(cOff).lerp(cOn, f * flick));
      lamps.pool.setColorAt(i, cTmp.setHex(T.pool).multiplyScalar(f * flick * .85));
      lamps.cone.setColorAt(i, cTmp.setHex(T.cone).multiplyScalar(f * flick));
    });
    [lamps.head, lamps.pool, lamps.cone].forEach(function (m) { m.instanceColor.needsUpdate = true; });
    return busy;
  }

  /* camera: orbit around a point; drag turns it, pinch / buttons / ctrl+wheel zoom, presets fly to a view */
  const VIEWS = {
    drone: function () { return { tx: 0, ty: 0, th: -2.2, ph: 1.05, r: Math.max(45, span * .55) }; },
    driver: function () { return { tx: span * .35, ty: 1.4, th: Math.PI, ph: 1.53, r: span * .5 + 6 }; },
    top: function () { return { tx: 0, ty: 0, th: -Math.PI / 2, ph: .18, r: Math.max(55, span * .62) }; }
  };
  let cam = VIEWS.drone(), aim = Object.assign({}, cam), idle = 0, view = 'drone';
  function setView(v) {
    view = v; aim = VIEWS[v](); idle = performance.now();
    stage.querySelectorAll('[data-view]').forEach(function (b) { b.setAttribute('aria-pressed', b.dataset.view === v); });
    go();
  }
  stage.addEventListener('click', function (e) {
    const b = e.target.closest('[data-view]'); if (b) setView(b.dataset.view);
    if (e.target.closest('[data-sky-toggle]')) {
      skyPref = sky() === 'night' ? 'dusk' : 'night';
      try { localStorage.setItem('gs-sky', skyPref); } catch (err) { /* just not remembered */ }
      paint(); go();
    }
    const z = e.target.closest('[data-zoom]'); if (z) { aim.r = Math.min(400, Math.max(8, aim.r * (z.dataset.zoom === 'in' ? .75 : 1.33))); idle = performance.now(); go(); }
  });
  const pts = new Map(); let pinch = 0;
  canvas.addEventListener('pointerdown', function (e) { pts.set(e.pointerId, [e.clientX, e.clientY]); canvas.setPointerCapture(e.pointerId); stage.classList.add('is-grab'); });
  canvas.addEventListener('pointermove', function (e) {
    const p0 = pts.get(e.pointerId); if (!p0) return;
    if (pts.size === 2) {
      pts.set(e.pointerId, [e.clientX, e.clientY]);
      const a = Array.from(pts.values()), d = Math.hypot(a[0][0] - a[1][0], a[0][1] - a[1][1]);
      if (pinch) aim.r = Math.min(400, Math.max(8, aim.r * pinch / d)); pinch = d;
    } else {
      aim.th += (e.clientX - p0[0]) * .006; aim.ph = Math.min(1.55, Math.max(.12, aim.ph - (e.clientY - p0[1]) * .004));
      pts.set(e.pointerId, [e.clientX, e.clientY]);
    }
    idle = performance.now(); go();
  });
  const up = function (e) { pts.delete(e.pointerId); pinch = 0; if (!pts.size) stage.classList.remove('is-grab'); };
  canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
  canvas.addEventListener('wheel', function (e) {   // trackpad pinch arrives as ctrl+wheel; a plain wheel scrolls the page
    if (!e.ctrlKey && !e.metaKey) return; e.preventDefault();
    aim.r = Math.min(400, Math.max(8, aim.r * Math.exp(e.deltaY * .01))); idle = performance.now(); go();
  }, { passive: false });

  // size + render loop, which only runs while the stage is on screen and something moves
  function size() {
    const w = stage.clientWidth, h = stage.clientHeight; if (!w || !h) return;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); go();
  }
  new ResizeObserver(size).observe(stage);
  let raf = 0, last = 0, onScreen = true;
  new IntersectionObserver(function (es) { onScreen = es[0].isIntersecting; if (onScreen) go(); }).observe(stage);
  document.addEventListener('visibilitychange', function () { if (!document.hidden) go(); });
  function go() { if (!raf && onScreen && !document.hidden) { last = performance.now(); raf = requestAnimationFrame(frame); } }
  function frame(now) {
    raf = 0;
    const dt = Math.min(.05, (now - last) / 1000); last = now;
    if (!lite && !GS.motionPaused && now - idle > 5000 && view !== 'driver') aim.th += dt * .05;   // a slow drift when nobody is touching it
    const k = 1 - Math.pow(.0015, dt);
    ['tx', 'ty', 'th', 'ph', 'r'].forEach(function (key) { cam[key] += (aim[key] - cam[key]) * k; });
    camera.position.set(cam.tx + Math.sin(cam.ph) * Math.cos(cam.th) * cam.r, cam.ty + Math.cos(cam.ph) * cam.r, Math.sin(cam.ph) * Math.sin(cam.th) * cam.r);
    camera.lookAt(cam.tx, cam.ty, 0);
    const busy = lightUp(now);
    cars.forEach(function (c) {
      c.position.x += c.userData.dir * c.userData.v * dt;
      const lim = span / 2 + 30; if (c.position.x > lim) c.position.x = -lim; if (c.position.x < -lim) c.position.x = lim;
    });
    renderer.render(scene, camera);
    const settling = Math.abs(aim.th - cam.th) + Math.abs(aim.ph - cam.ph) + Math.abs(aim.r - cam.r) / 50 + Math.abs(aim.tx - cam.tx) / 50 > .002;
    if (busy || settling || cars.length || (!lite && view !== 'driver')) go();
  }

  new MutationObserver(function () { if (T) { paint(); go(); } }).observe(root, { attributes: true, attributeFilter: ['data-theme'] });
  size();
  return { build: function (p) { build(p); if (!stage.dataset.viewed) { stage.dataset.viewed = 1; aim = VIEWS[view](); cam = Object.assign({}, aim, { r: aim.r * 1.6, th: aim.th - .8 }); } } };
}
