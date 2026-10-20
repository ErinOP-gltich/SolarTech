/* Home page: live sun status, the sun's face and cable, lit-up text, the 24-hour scroll story,
   catalogue teaser, light finder, sector peeks and the closing sunrise. */
(function () {
  const GS = window.GS;
  const CFG = GS.config;
  const clamp = function (v, a, b) { return Math.min(b, Math.max(a, v)); };
  const pad = function (n) { return (n < 10 ? '0' : '') + n; };

  /* ---------- 1. Is the sun up in Guwahati right now? (NOAA approximation) ---------- */
  function sunTimesUTC(date, lat, lng) {
    const rad = Math.PI / 180;
    const start = Date.UTC(date.getUTCFullYear(), 0, 0);
    const day = Math.floor((date.getTime() - start) / 864e5);
    const g = 2 * Math.PI / 365 * (day - 1);
    const eq = 229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g) - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g));
    const decl = 0.006918 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g) - 0.006758 * Math.cos(2 * g) + 0.000907 * Math.sin(2 * g) - 0.002697 * Math.cos(3 * g) + 0.00148 * Math.sin(3 * g);
    const ha = Math.acos(Math.cos(90.833 * rad) / (Math.cos(lat * rad) * Math.cos(decl)) - Math.tan(lat * rad) * Math.tan(decl)) / rad;
    return { rise: 720 - 4 * (lng + ha) - eq, set: 720 - 4 * (lng - ha) - eq }; // minutes after UTC midnight
  }

  function liveStatus() {
    const el = document.querySelector('[data-live]');
    if (!el || !CFG.geo) return;
    const IST = 330;
    function fmt(min) { min = ((Math.round(min) % 1440) + 1440) % 1440; return pad(Math.floor(min / 60)) + ':' + pad(min % 60); }
    function paint() {
      const now = new Date();
      const t = sunTimesUTC(now, CFG.geo.lat, CFG.geo.lng);
      const nowIST = ((now.getUTCHours() * 60 + now.getUTCMinutes() + IST) % 1440);
      const rise = t.rise + IST, set = t.set + IST;
      let msg, night = true;
      if (nowIST >= rise && nowIST < set) {
        night = false;
        msg = 'It’s ' + fmt(nowIST) + ' in Guwahati — sun’s up, every Green Sun panel is charging. Sunset ' + fmt(set) + '.';
      } else if (nowIST >= set && nowIST < set + 360) {
        msg = 'It’s ' + fmt(nowIST) + ' in Guwahati — sun’s down, Green Sun lights are on at full power.';
      } else {
        msg = 'It’s ' + fmt(nowIST) + ' in Guwahati — lights dimmed to 50% to save charge. Sunrise ' + fmt(rise) + '.';
      }
      el.classList.toggle('is-night', night);
      el.querySelector('span').textContent = msg;
    }
    paint();
    setInterval(paint, 30000);
  }

  /* ---------- 2. The sun watches your cursor, and its cable plugs into the button ---------- */
  function heroSun() {
    const hero = document.querySelector('.hero');
    const sun = document.querySelector('[data-sun]');
    if (!hero || !sun) return;
    const eyes = sun.querySelector('.eyes');

    if (GS.finePointer && !GS.reduceMotion) {
      addEventListener('pointermove', function (e) {
        const r = sun.getBoundingClientRect();
        const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
        const a = Math.atan2(e.clientY - cy, e.clientX - cx);
        const d = Math.min(1, Math.hypot(e.clientX - cx, e.clientY - cy) / 400);
        eyes.style.transform = 'translate(' + (Math.cos(a) * 9 * d).toFixed(1) + 'px,' + (Math.sin(a) * 7 * d).toFixed(1) + 'px)';
      }, { passive: true });
    }

    const svg = hero.querySelector('[data-cable]');
    const btn = hero.querySelector('[data-plug]');
    if (!svg || !btn) return;
    const cable = svg.querySelector('.cable'), pulse = svg.querySelector('.cable-pulse'), plug = svg.querySelector('.plug');

    function route() {
      if (getComputedStyle(svg).display === 'none') return;
      const h = hero.getBoundingClientRect();
      const s = sun.getBoundingClientRect();
      const b = btn.getBoundingClientRect();
      const k = s.width / 520;
      const sx = s.left - h.left + s.width / 2, sy = s.top - h.top + s.height / 2 + 64 * k;
      // plug in from underneath the button, prongs pointing up
      const ex = b.left - h.left + b.width * .5, ey = b.bottom - h.top + 16;
      const sag = Math.max(90, h.bottom - h.top - ey - 60);
      const d = 'M' + sx.toFixed(1) + ' ' + sy.toFixed(1) +
        ' C' + sx.toFixed(1) + ' ' + (sy + Math.max(160, ey - sy + sag)).toFixed(1) + ' ' + ex.toFixed(1) + ' ' + (ey + sag).toFixed(1) + ' ' + ex.toFixed(1) + ' ' + (ey + 24).toFixed(1);
      cable.setAttribute('d', d);
      pulse.setAttribute('d', d);
      plug.setAttribute('transform', 'translate(' + ex.toFixed(1) + ' ' + (ey + 2).toFixed(1) + ') rotate(-90)');
    }
    route();
    addEventListener('resize', route);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(route);
    sun.addEventListener('animationend', route);
    setTimeout(route, 2000);
    btn.addEventListener('pointerenter', function () { svg.classList.add('is-hot'); });
    btn.addEventListener('pointerleave', function () { svg.classList.remove('is-hot'); setTimeout(route, 450); });
    btn.addEventListener('focus', function () { svg.classList.add('is-hot'); });
    btn.addEventListener('blur', function () { svg.classList.remove('is-hot'); });
    // the magnetic button moves, so the plug follows it
    btn.addEventListener('pointermove', function () { requestAnimationFrame(route); });
  }

  /* ---------- 3. Words light up as you read ---------- */
  function litUp() {
    const el = document.querySelector('[data-litup]');
    if (!el) return;
    const words = [];
    function wrap(text, cls) {
      const frag = document.createDocumentFragment();
      text.split(/(\s+)/).forEach(function (part) {
        if (!part) return;
        if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(part)); return; }
        const s = document.createElement('span');
        s.className = 'w' + (cls ? ' ' + cls : '');
        s.textContent = part;
        words.push(s);
        frag.appendChild(s);
      });
      return frag;
    }
    Array.from(el.childNodes).forEach(function (n) {
      if (n.nodeType === 3) el.replaceChild(wrap(n.textContent), n);
      else if (n.nodeType === 1) el.replaceChild(wrap(n.textContent, n.className), n);
    });
    if (GS.reduceMotion) { el.classList.add('no-scrub'); words.forEach(function (w) { w.classList.add('on'); }); return; }
    let lit = -1;
    function update() {
      const r = el.getBoundingClientRect();
      const p = clamp((innerHeight * .85 - r.top) / (r.height + innerHeight * .35), 0, 1);
      const n = Math.round(p * words.length);
      if (n === lit) return;
      lit = n;
      words.forEach(function (w, i) { w.classList.toggle('on', i < n); });
    }
    addEventListener('scroll', function () { requestAnimationFrame(update); }, { passive: true });
    update();
  }

  /* ---------- 4. 24 hours, scrubbed by scroll ---------- */
  function dayCycle() {
    const sec = document.querySelector('[data-day]');
    if (!sec) return;
    const stick = sec.querySelector('.day-stick');
    const sun = sec.querySelector('[data-orb="sun"]');
    const moon = sec.querySelector('[data-orb="moon"]');
    const scene = sec.querySelector('[data-scene]');
    const clock = sec.querySelector('[data-clock]');
    const phaseEl = sec.querySelector('[data-phase]');
    const dots = sec.querySelectorAll('.day-dots i');
    const bars = {}, outs = {};
    sec.querySelectorAll('[data-m]').forEach(function (b) { bars[b.dataset.m] = b; });
    sec.querySelectorAll('[data-o]').forEach(function (o) { outs[o.dataset.o] = o; });

    // sky colours through the day: [hour, top, bottom]
    const SKY = [
      [5, '#0E1838', '#3B3F78'], [5.8, '#2B3A6E', '#FF9E6B'], [7, '#6FB7FF', '#FFE2B0'],
      [12, '#2F8FFF', '#BFE3FF'], [16.5, '#4A8FE0', '#FFD9A0'], [17.8, '#2A2F6B', '#FF7A45'],
      [19, '#0F1736', '#2C3268'], [24, '#060A18', '#141B38'], [29, '#0E1838', '#3B3F78']
    ];
    // battery state of charge (%) through the day
    const BAT = [[5, 58.75], [5.5, 57.5], [6.5, 57.5], [15.5, 100], [18, 100], [24, 70], [29, 57.5]];
    const PHASES = [
      { h: 'First light — lamp off', p: 'The panel senses the sky brightening and the controller switches the lamp off by itself. No timers, no switchboard, no electricity bill.' },
      { h: 'Harvest the sun', p: 'All day the polycrystalline panel feeds the LiFePO₄ battery through the charge controller, banking every hour of sunshine.' },
      { h: 'Sunset — lights on at 100%', p: 'Sun down, light up. OSRAM LEDs at 155 lumens per watt run at 100% for the first six hours of the night.' },
      { h: 'Midnight — smart dimming', p: 'As the roads empty, the lamp dims to 50% for the next six hours — keeping enough charge in reserve for two cloudy days.' }
    ];

    function hex(c) { return [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)]; }
    function mix(a, b, t) { a = hex(a); b = hex(b); return 'rgb(' + a.map(function (v, i) { return Math.round(v + (b[i] - v) * t); }).join(',') + ')'; }
    function interp(table, t, col) {
      for (let i = 0; i < table.length - 1; i++) {
        const a = table[i], b = table[i + 1];
        if (t >= a[0] && t <= b[0]) {
          const k = (t - a[0]) / (b[0] - a[0]);
          return col === undefined ? a[1] + (b[1] - a[1]) * k : mix(a[col], b[col], k);
        }
      }
      return col === undefined ? table[table.length - 1][1] : table[table.length - 1][col];
    }
    const RISE = 5.5, SET = 18;
    function sunPower(t) { return t > RISE && t < SET ? Math.sin(Math.PI * (t - RISE) / (SET - RISE)) : 0; }
    function lampLevel(t) { return t < 5.5 ? .5 : t < 18 ? 0 : t < 24 ? 1 : .5; }
    function phaseOf(t) { return t < 6.5 ? 0 : t < 18 ? 1 : t < 24 ? 2 : 3; }

    function fitScene() { scene.setAttribute('viewBox', innerWidth < 760 ? '760 0 480 900' : '0 0 1600 900'); }
    fitScene();
    addEventListener('resize', fitScene);

    let phase = -1, raf = 0;
    function update() {
      raf = 0;
      const r = sec.getBoundingClientRect();
      const total = sec.offsetHeight - innerHeight;
      const p = clamp(-r.top / total, 0, 1);
      if (r.bottom < 0 || r.top > innerHeight) return;
      const t = 5 + 24 * p;
      const sp = sunPower(t);
      const dark = clamp(1 - sp * 2.4, 0, 1);
      const lamp = lampLevel(t);
      const bat = interp(BAT, t);
      const W = stick.clientWidth, H = stick.clientHeight;

      stick.style.setProperty('--top', interp(SKY, t, 1));
      stick.style.setProperty('--bot', interp(SKY, t, 2));
      stick.style.setProperty('--night', dark.toFixed(3));
      stick.style.setProperty('--shade', (dark * .72).toFixed(3));
      stick.style.setProperty('--lamp', lamp);
      stick.style.setProperty('--sunpow', clamp(sp * 3, 0, 1).toFixed(3));
      stick.style.setProperty('--charging', t > 6 && t < 15.5 ? 1 : 0);
      stick.style.setProperty('--hint', p < .02 ? 1 : 0);

      const u = (t - RISE) / (SET - RISE);
      const sx = W * (.08 + .84 * clamp(u, 0, 1));
      const sy = u > 0 && u < 1 ? H * (.74 - .6 * Math.sin(Math.PI * u)) : H * .95;
      sun.style.transform = 'translate(' + sx.toFixed(1) + 'px,' + sy.toFixed(1) + 'px)';
      const mu = (t - 18.4) / 11.2;
      const mx = W * (.1 + .8 * clamp(mu, 0, 1));
      const my = mu > 0 && mu < 1 ? H * (.7 - .48 * Math.sin(Math.PI * mu)) : H * .95;
      moon.style.transform = 'translate(' + mx.toFixed(1) + 'px,' + my.toFixed(1) + 'px)';

      const hh = Math.floor(t) % 24, mm = Math.floor((t % 1) * 60);
      clock.firstChild.nodeValue = pad(hh) + ':' + pad(mm);
      bars.bat.style.setProperty('--v', (bat / 100).toFixed(3));
      bars.sun.style.setProperty('--v', sp.toFixed(3));
      bars.lamp.style.setProperty('--v', lamp);
      outs.bat.textContent = Math.round(bat) + '%';
      outs.sun.textContent = Math.round(sp * 100) + '%';
      outs.lamp.textContent = Math.round(lamp * 100) + '%';

      const ph = phaseOf(t);
      if (ph !== phase) {
        phase = ph;
        phaseEl.querySelector('h3').textContent = PHASES[ph].h;
        phaseEl.querySelector('p').textContent = PHASES[ph].p;
        dots.forEach(function (d, i) { d.classList.toggle('on', i <= ph); });
      }
    }
    addEventListener('scroll', function () { if (!raf) raf = requestAnimationFrame(update); }, { passive: true });
    addEventListener('resize', update);
    update();
  }

  /* ---------- 5. Catalogue teaser ---------- */
  function catalogue() {
    const cats = document.querySelector('[data-cats]');
    if (cats) {
      cats.innerHTML = window.GS_CATEGORIES.map(function (c, i) {
        const n = GS.products.filter(function (p) { return p.cat === c.id; }).length;
        return '<a class="cat rv" style="--d:' + (i * .06) + 's" href="products.html#' + c.id + '">' +
          '<span class="n">' + pad(i + 1) + ' / ' + pad(window.GS_CATEGORIES.length) + ' · ' + n + (n === 1 ? ' product' : ' products') + '</span>' +
          '<h3>' + GS.esc(c.name) + '</h3><p>' + GS.esc(c.blurb) + '</p>' +
          '<img src="' + c.img + '" alt="" loading="lazy">' +
          '<span class="go">' + GS.icon.arrow + '</span></a>';
      }).join('');
    }
    const rail = document.querySelector('[data-featured]');
    if (rail) {
      rail.innerHTML = GS.products.filter(function (p) { return p.featured; }).map(GS.card).join('');
      dragScroll(rail);
    }
    GS.reveals();
  }

  function dragScroll(el) {
    if (!GS.finePointer) return;
    let down = false, moved = false, x0 = 0, s0 = 0;
    el.addEventListener('pointerdown', function (e) {
      if (e.button !== 0 || e.target.closest('button')) return;
      down = true; moved = false; x0 = e.clientX; s0 = el.scrollLeft;
    });
    addEventListener('pointermove', function (e) {
      if (!down) return;
      const dx = e.clientX - x0;
      if (!moved && Math.abs(dx) > 6) { moved = true; el.classList.add('is-drag'); }
      if (moved) el.scrollLeft = s0 - dx;
    });
    addEventListener('pointerup', function () {
      if (!down) return;
      down = false;
      setTimeout(function () { el.classList.remove('is-drag'); }, 0);
    });
    el.addEventListener('dragstart', function (e) { e.preventDefault(); });
  }

  /* ---------- 6. Light finder ---------- */
  const FINDER = [
    { id: 'lane', label: 'Village lane or pathway', sub: 'Narrow, light traffic', picks: ['si-9w', 'aio-20w', 'si-15w'],
      why: 'Narrow lanes and paths usually need just <b>9–20 W</b>. The all-in-one model needs nothing but a pole.',
      icon: '<path d="M8 36 L16 4 M30 36 L22 4 M19 10 v4 M19 20 v5 M19 31 v4"/>' },
    { id: 'colony', label: 'Colony or campus road', sub: 'Residential, steady traffic', picks: ['si-20w', 'si-25w', 'si-30w'],
      why: 'Residential and campus roads typically sit around <b>20–30 W</b> per pole for even, glare-free light.',
      icon: '<path d="M5 18 L19 6 L33 18 M9 15 V33 H29 V15 M16 33 V24 H22 V33"/>' },
    { id: 'main', label: 'Main road or market', sub: 'Busy, wider carriageway', picks: ['si-40w', 'si-50w', 'si-40w-rms'],
      why: 'Wider, busier roads usually call for <b>40–50 W</b>. Add RMS to watch every pole’s battery from your phone.',
      icon: '<path d="M4 36 L13 4 M34 36 L25 4 M19 6 v5 M19 17 v5 M19 28 v6 M10 22 h4 M24 22 h4"/>' },
    { id: 'highway', label: 'Highway or NH stretch', sub: 'Fast traffic, long runs', picks: ['si-60w', 'si-80w', 'si-40w-rms'],
      why: 'Highways need high output and uniformity: <b>60–80 W</b> per pole, with remote monitoring for long stretches.',
      icon: '<path d="M3 30 h10 M6 22 h14 M3 14 h10 M22 30 h13 M26 14 h9 M24 8 l10 14 l-10 14"/>' },
    { id: 'open', label: 'Junction, ground or yard', sub: 'Big open area', picks: ['high-mast-12m', 'flood-60w', 'battery-100ah'],
      why: 'Open areas are lit best from height: a <b>12 m high mast</b>, or <b>60 W flood lights</b> on existing structures.',
      icon: '<path d="M19 36 V12 M10 8 h18 M12 8 l-4 8 M26 8 l4 8 M19 8 l0 6 M8 36 h22"/>' },
    { id: 'safety', label: 'School zone or crossing', sub: 'Pedestrian safety', picks: ['ped-crossing', 'blinker-20w'],
      why: 'Slow drivers down and get people across safely with <b>solar blinkers</b> and <b>push-button crossings</b>.',
      icon: '<circle cx="20" cy="6" r="3"/><path d="M20 11 l-4 10 l6 4 l-2 11 M16 21 l-6 -3 M22 14 l7 4 M16 25 l-5 11"/>' }
  ];

  function finder() {
    const opts = document.querySelector('[data-finder]');
    const out = document.querySelector('[data-finder-out]');
    if (!opts || !out) return;
    opts.innerHTML = FINDER.map(function (f, i) {
      return '<button class="fopt" type="button" role="radio" aria-checked="false" tabindex="' + (i ? -1 : 0) + '" data-f="' + f.id + '">' +
        '<svg viewBox="0 0 38 40" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + f.icon + '</svg>' +
        '<span>' + f.label + '<small>' + f.sub + '</small></span></button>';
    }).join('');
    const btns = Array.from(opts.querySelectorAll('.fopt'));
    function choose(id, focus) {
      const f = FINDER.find(function (x) { return x.id === id; });
      btns.forEach(function (b) {
        const on = b.dataset.f === id;
        b.setAttribute('aria-checked', on);
        b.tabIndex = on ? 0 : -1;
        if (on && focus) b.focus();
      });
      out.innerHTML = '<p class="finder-why">' + f.why + '</p><div class="cards">' +
        f.picks.map(function (pid) { return GS.byId[pid]; }).filter(Boolean).map(GS.card).join('') + '</div>';
    }
    opts.addEventListener('click', function (e) { const b = e.target.closest('.fopt'); if (b) choose(b.dataset.f); });
    opts.addEventListener('keydown', function (e) {
      const i = btns.indexOf(document.activeElement);
      if (i < 0) return;
      let j = -1;
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') j = (i + 1) % btns.length;
      if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') j = (i - 1 + btns.length) % btns.length;
      if (j >= 0) { e.preventDefault(); choose(btns[j].dataset.f, true); }
    });
    choose('colony');
  }

  /* ---------- 7. Sector rows show a product that follows the cursor ---------- */
  function sectors() {
    const list = document.querySelector('[data-sectors]');
    const peek = document.querySelector('[data-peek-el]');
    if (!list || !peek || !GS.finePointer || GS.reduceMotion) return;
    const img = peek.querySelector('img');
    list.querySelectorAll('[data-peek]').forEach(function (li) {
      li.addEventListener('pointerenter', function () { img.src = li.dataset.peek; peek.classList.add('is-on'); });
      li.addEventListener('pointerleave', function () { peek.classList.remove('is-on'); });
    });
    addEventListener('pointermove', function (e) {
      if (!peek.classList.contains('is-on')) return;
      peek.style.left = e.clientX + 'px';
      peek.style.top = e.clientY + 'px';
    }, { passive: true });
  }

  /* ---------- 8. The sun rises again at the bottom of the page ---------- */
  function sunrise() {
    const cta = document.querySelector('[data-cta]');
    if (!cta) return;
    const orb = cta.querySelector('.cta-sun div');
    function update() {
      const r = cta.getBoundingClientRect();
      orb.style.setProperty('--rise', clamp((innerHeight - r.top) / r.height, 0, 1).toFixed(3));
    }
    addEventListener('scroll', function () { requestAnimationFrame(update); }, { passive: true });
    update();
  }

  liveStatus();
  heroSun();
  litUp();
  dayCycle();
  catalogue();
  finder();
  sectors();
  sunrise();
})();
