/* Road planner: road details in, a light + pole layout out. Used by the Road planner page and (through seo.mjs) by the
   Ask AI assistant, so both give the same answer. Plain script: sets window.GSPlan.
   ponytail: the lumen method with fixed utilisation and maintenance factors, a rule of thumb rather than a photometric
   calculation from the lights' IES files. Fine for sizing an enquiry; a tender gets a proper DIALux layout. */
(function (root) {
  // target average illuminance on the road, after IS 1944's road classes
  const ROADS = {
    village: { name: 'Village lane', lux: 5 },
    street: { name: 'Town street', lux: 8 },
    main: { name: 'Main road', lux: 15 },
    highway: { name: 'Highway', lux: 22 }
  };
  // [up to this many watts, pole height m, standard spacing m]. 10 m is the standard; bigger lights go higher and wider.
  const MOUNT = [[9, 4, 10], [15, 5, 10], [20, 5, 12], [25, 6, 14], [30, 6, 15], [40, 7, 18], [50, 8, 20], [60, 8, 22], [80, 9, 25]];
  const LM_PER_W = 155, CU = 0.45, MF = 0.8;   // LED efficacy from the catalogue; light reaching the road; dirt + ageing
  // how wide a road each arrangement lights evenly, as a multiple of the pole height
  const REACH = { one: 1.2, zigzag: 1.6, parallel: 3.2 };
  const ARR = { one: 'One side', zigzag: 'Zigzag (staggered)', parallel: 'Parallel (opposite)' };
  const POLE_COST = 12;  // ponytail: comparing layouts, a pole + install costs about what 12 W more of light does (rough market prices); the owner's price list would be better

  function mount(w) { for (let i = 0; i < MOUNT.length; i++) if (w <= MOUNT[i][0]) return MOUNT[i]; return MOUNT[MOUNT.length - 1]; }
  function num(v, lo, hi, d) { v = parseFloat(v); return isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d; }

  // lights: catalogue items with a .watt; input: { length, lanes, laneWidth, road, arrangement: auto|one|zigzag|parallel, spacing (0 = by wattage),
  //   width (m, optional: beats lanes × laneWidth), lux (optional: beats the road type's target) }
  function plan(input, lights) {
    const L = num(input.length, 10, 50000, 500), lanes = Math.round(num(input.lanes, 1, 8, 2)), lw0 = num(input.laneWidth, 2.5, 5, 3.5);
    const ownW = parseFloat(input.width) > 0 ? num(input.width, 2, 60, 0) : 0, ownLux = parseFloat(input.lux) > 0 ? num(input.lux, 1, 75, 0) : 0;
    const W = +(ownW || lanes * lw0).toFixed(2), lw = +(W / lanes).toFixed(2), road = ROADS[input.road] ? input.road : 'street', target = ownLux || ROADS[road].lux;
    const fixed = num(input.spacing, 0, 60, 0);
    const arrs = ARR[input.arrangement] ? [input.arrangement] : ['one', 'zigzag', 'parallel'];
    const list = lights.filter(function (p) { return p.watt; }).slice().sort(function (a, b) { return a.watt - b.watt; });
    let best = null;
    arrs.forEach(function (arr) {
      list.forEach(function (p) {
        const m = mount(p.watt), H = m[1], S = fixed || m[2], per = arr === 'one' ? 1 : 2;
        const lux = per * p.watt * LM_PER_W * CU * MF / (S * W);
        const sideA = Math.floor(L / S) + 1, sideB = arr === 'one' ? 0 : arr === 'zigzag' ? (L >= S / 2 ? Math.floor((L - S / 2) / S) + 1 : 0) : sideA;
        const n = sideA + sideB;
        const c = {
          light: p, watt: p.watt, height: H, spacing: S, arrangement: arr, lux: +lux.toFixed(1), reach: W <= REACH[arr] * H,
          bright: lux >= target, poles: n, sideA: sideA, sideB: sideB, kw: +(n * p.watt / 1000).toFixed(2), cost: n * (POLE_COST + p.watt)
        };
        // a layout that is bright enough and even across the road beats one that isn't; then the cheaper one
        const rank = function (x) { return (x.bright ? 0 : 2) + (x.reach ? 0 : 1); };
        if (!best || rank(c) < rank(best) || (rank(c) === rank(best) && (rank(c) < 2 ? c.cost < best.cost : c.lux > best.lux))) best = c;
      });
    });
    if (!best) return null;
    const notes = [];
    if (!best.reach) notes.push(best.arrangement === 'one'
      ? 'One row of lights won’t reach across ' + W + ' m evenly: the far side stays dim. Zigzag or parallel fixes that.'
      : 'This road is wider than the poles can light evenly from the edges. Add a central median row, or ask us about high masts.');
    if (!best.bright) notes.push('Even the brightest light here falls short of ' + target + ' lux at this spacing. Bring the poles closer, light both sides, or ask us about high masts.');
    if (fixed && fixed !== mount(best.watt)[2]) notes.push('You set ' + fixed + ' m spacing; our standard for a ' + best.watt + ' W light is ' + mount(best.watt)[2] + ' m.');
    return Object.assign(best, { length: L, lanes: lanes, laneWidth: lw, width: W, road: road, roadName: ROADS[road].name, target: target, ownLux: !!ownLux, ownWidth: !!ownW, arrangementName: ARR[best.arrangement], notes: notes });
  }

  // one line for the assistant and the quote: what was asked and what we suggest
  function summary(r) {
    return r.roadName + ', ' + r.length + ' m long, ' + r.lanes + ' lane' + (r.lanes > 1 ? 's' : '') + ' (' + r.width + ' m wide): ' +
      r.poles + ' × ' + r.light.name + ' on ' + r.height + ' m poles, ' + r.spacing + ' m apart, ' + r.arrangementName.toLowerCase() +
      ', about ' + r.lux + ' lux average against a ' + r.target + ' lux target.';
  }

  root.GSPlan = { plan: plan, summary: summary, ROADS: ROADS, MOUNT: MOUNT, ARR: ARR, REACH: REACH };
})(typeof window !== 'undefined' ? window : globalThis);
