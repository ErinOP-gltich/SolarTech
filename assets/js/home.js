/* Home page: the plasma sun, hero intro, velocity marquee, lit-up manifesto, count-ups, the 24-hour
   scroll story, the pinned showroom, product-family previews, the light finder and the closing sunrise. */
(function () {
  const GS = window.GS;
  const CFG = GS.config;
  const gsap = window.gsap;
  const ST = window.ScrollTrigger;
  const motion = !GS.reduceMotion && !!gsap && !!ST;
  const clamp = function (v, a, b) { return Math.min(b, Math.max(a, v)); };
  const pad = function (n) { return (n < 10 ? '0' : '') + n; };
  const isDesktop = function () { return innerWidth > 1020; };

  /* ---------- 1. the plasma sun (WebGL) ---------- */
  // The CSS gradient behind each canvas stays until the sun has drawn its first frame, and comes back
  // if WebGL is missing, software-only or lost (the module fires gs:sun-ready / gs:sun-fallback).
  function mountSun(canvas, opts) {
    const host = canvas && canvas.parentElement;
    const fb = host && host.querySelector('.hero-fallback, .cta-fallback');
    if (!canvas || !window.GSSun) {
      if (host) host.classList.add('no-gl');
      return null;
    }
    if (fb && !canvas.dataset.fallbackWired) {
      canvas.dataset.fallbackWired = '1';
      canvas.addEventListener('gs:sun-ready', function () { fb.style.opacity = 0; });
      canvas.addEventListener('gs:sun-fallback', function () { fb.style.opacity = 1; });
    }
    try { return window.GSSun.mount(canvas, opts); } catch (e) { host.classList.add('no-gl'); if (fb) fb.style.opacity = 1; return null; }
  }

  function heroSun() {
    const hero = document.querySelector('[data-hero]');
    const canvas = document.querySelector('[data-sun-canvas]');
    if (!hero || !canvas) return;
    const portrait = function () { return innerWidth < 760 || innerHeight > innerWidth * 1.15; };
    let mode = portrait();
    let sun = mountSun(canvas, mode ? { center: [0.66, 0.3], radius: 0.4 } : { center: [0.74, 0.5], radius: 0.36 });
    addEventListener('resize', function () {
      if (portrait() === mode || !sun) return;
      mode = portrait();
      sun.destroy();
      sun = mountSun(canvas, mode ? { center: [0.66, 0.3], radius: 0.4 } : { center: [0.74, 0.5], radius: 0.36 });
    });
    if (motion) {
      // as the hero scrolls away the sun swells and the headline lifts off
      gsap.to(canvas, { yPercent: 18, scale: 1.18, ease: 'none', scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: true } });
      gsap.to(hero.querySelector('.hero-mid'), { yPercent: -22, opacity: 0, ease: 'none', scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: true } });
    }
  }

  function heroIntro() {
    const lines = document.querySelectorAll('[data-hero-line]');
    const extras = document.querySelectorAll('.hero-top, .hero-row, .hero-foot');
    if (!motion) { lines.forEach(function (l) { l.style.opacity = 1; }); return; }
    gsap.set(extras, { opacity: 0, y: 24 });
    GS.ready(function () {
      lines.forEach(function (l, i) { GS.splitIn(l, .15 + i * .12); });
      gsap.to(extras, { opacity: 1, y: 0, duration: 1.2, ease: 'expo.out', stagger: .1, delay: .55 });
    });
  }

  /* ---------- 2. is the sun up in Guwahati right now? (NOAA approximation) ---------- */
  function sunTimesUTC(date, lat, lng) {
    const rad = Math.PI / 180;
    const day = Math.floor((date.getTime() - Date.UTC(date.getUTCFullYear(), 0, 0)) / 864e5);
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
    const fmt = function (min) { min = ((Math.round(min) % 1440) + 1440) % 1440; return pad(Math.floor(min / 60)) + ':' + pad(min % 60); };
    function paint() {
      const now = new Date();
      const t = sunTimesUTC(now, CFG.geo.lat, CFG.geo.lng);
      const nowIST = (now.getUTCHours() * 60 + now.getUTCMinutes() + IST) % 1440;
      const rise = t.rise + IST, set = t.set + IST;
      let msg, night = true;
      if (nowIST >= rise && nowIST < set) { night = false; msg = 'Sun’s up in Guwahati — every Green Sun panel is charging. Sunset ' + fmt(set) + '.'; }
      else if (nowIST >= set && nowIST < set + 360) msg = 'Sun’s down in Guwahati — Green Sun lights are on at full power.';
      else msg = 'Late night in Guwahati — lights dimmed to 50% to save charge. Sunrise ' + fmt(rise) + '.';
      el.classList.toggle('is-night', night);
      el.lastElementChild.textContent = msg;
    }
    paint();
    setInterval(paint, 30000);
  }

  /* ---------- 3. marquee whose speed and skew follow scroll velocity ---------- */
  function marquee() {
    const box = document.querySelector('[data-mq]');
    if (!box) return;
    const tracks = Array.from(box.querySelectorAll('.mq-track'));
    tracks.forEach(function (t) { t.innerHTML += t.innerHTML; });
    if (GS.reduceMotion) return;
    const st = tracks.map(function (t) { return { el: t, x: 0, dir: +t.dataset.dir || -1, w: 0 }; });
    const measure = function () { st.forEach(function (s) { s.w = s.el.scrollWidth / 2; }); };
    measure();
    addEventListener('resize', measure);
    let visible = true, lastY = scrollY, vel = 0, skew = 0;
    new IntersectionObserver(function (en) { visible = en[0].isIntersecting; }).observe(box);
    (function loop() {
      const y = scrollY;
      const lv = GS.lenis ? GS.lenis.velocity : (y - lastY);
      lastY = y;
      vel += (lv - vel) * .12;
      skew += (clamp(vel * -.35, -12, 12) - skew) * .1;
      if (visible) {
        st.forEach(function (s) {
          s.x += s.dir * (1.1 + Math.abs(vel) * .55);
          if (s.x <= -s.w) s.x += s.w;
          if (s.x > 0) s.x -= s.w;
          s.el.style.transform = 'translate3d(' + s.x.toFixed(1) + 'px,0,0) skewX(' + skew.toFixed(2) + 'deg)';
        });
      }
      requestAnimationFrame(loop);
    })();
  }

  /* ---------- 4. words light up as you read ---------- */
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
      const p = clamp((innerHeight * .85 - r.top) / (r.height + innerHeight * .3), 0, 1);
      const n = Math.round(p * words.length);
      if (n === lit) return;
      lit = n;
      words.forEach(function (w, i) { w.classList.toggle('on', i < n); });
    }
    addEventListener('scroll', function () { requestAnimationFrame(update); }, { passive: true });
    update();
  }

  /* ---------- 5. numbers count up when they arrive ---------- */
  function countUps() {
    const els = document.querySelectorAll('[data-count]');
    const fmt = function (v) { return Math.round(v).toLocaleString('en-US'); };
    if (GS.reduceMotion || !('IntersectionObserver' in window)) return;
    const io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        io.unobserve(en.target);
        const to = +en.target.dataset.count, t0 = performance.now(), dur = 1800;
        (function tick(t) {
          const k = Math.min(1, (t - t0) / dur);
          en.target.textContent = fmt(to * (1 - Math.pow(2, -10 * k)));
          if (k < 1) requestAnimationFrame(tick); else en.target.textContent = fmt(to);
        })(t0);
      });
    }, { threshold: .6 });
    els.forEach(function (el) { el.textContent = '0'; io.observe(el); });
  }

  /* ---------- 6. 24 hours, scrubbed by scroll ---------- */
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
      [5, '#0A0F26', '#30285E'], [5.8, '#2B2A5E', '#FF7A45'], [7, '#4E8FE0', '#FFD7A0'],
      [12, '#1F6FE0', '#A9D6FF'], [16.5, '#3A6CC0', '#FFC98A'], [17.8, '#26235C', '#FF5A2A'],
      [19, '#0B0F2A', '#2A2660'], [24, '#040611', '#121633'], [29, '#0A0F26', '#30285E']
    ];
    // battery state of charge (%) through the day
    const BAT = [[5, 58.75], [5.5, 57.5], [6.5, 57.5], [15.5, 100], [18, 100], [24, 70], [29, 57.5]];
    const PHASES = [
      { h: 'First light — lamp off', p: 'The panel senses the sky brightening and the controller switches the lamp off by itself. No timers, no switchboard, no electricity bill.' },
      { h: 'Harvest the sun', p: 'All day the polycrystalline panel feeds the LiFePO₄ battery through the charge controller, banking every hour of sunshine.' },
      { h: 'Sunset — lights on at 100%', p: 'Sun down, light up. OSRAM LEDs at 155 lumens per watt run at full power for the first six hours of the night.' },
      { h: 'Midnight — smart dimming', p: 'As the roads empty, the lamp dims to 50% for the next six hours — keeping enough charge in reserve for two cloudy days.' }
    ];

    const hex = function (c) { return [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)]; };
    const mix = function (a, b, t) { a = hex(a); b = hex(b); return 'rgb(' + a.map(function (v, i) { return Math.round(v + (b[i] - v) * t); }).join(',') + ')'; };
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
    const sunPower = function (t) { return t > RISE && t < SET ? Math.sin(Math.PI * (t - RISE) / (SET - RISE)) : 0; };
    const lampLevel = function (t) { return t < 5.5 ? .5 : t < 18 ? 0 : t < 24 ? 1 : .5; };
    const phaseOf = function (t) { return t < 6.5 ? 0 : t < 18 ? 1 : t < 24 ? 2 : 3; };

    function fitScene() { scene.setAttribute('viewBox', innerWidth < 760 ? '760 0 480 900' : '0 0 1600 900'); }
    fitScene();
    addEventListener('resize', fitScene);

    let phase = -1, raf = 0;
    function update() {
      raf = 0;
      const r = sec.getBoundingClientRect();
      if (r.bottom < 0 || r.top > innerHeight) return;
      const p = clamp(-r.top / (sec.offsetHeight - innerHeight), 0, 1);
      const t = 5 + 24 * p;
      const sp = sunPower(t);
      const dark = clamp(1 - sp * 2.4, 0, 1);
      const lamp = lampLevel(t);
      const bat = interp(BAT, t);
      const W = stick.clientWidth, H = stick.clientHeight;

      stick.style.setProperty('--top', interp(SKY, t, 1));
      stick.style.setProperty('--bot', interp(SKY, t, 2));
      stick.style.setProperty('--night', dark.toFixed(3));
      stick.style.setProperty('--shade', (dark * .75).toFixed(3));
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

      clock.firstChild.nodeValue = pad(Math.floor(t) % 24) + ':' + pad(Math.floor((t % 1) * 60));
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

  /* ---------- 7. the showroom: vertical scroll drives a horizontal run of products ---------- */
  function showroom() {
    const sec = document.querySelector('[data-show]');
    const track = document.querySelector('[data-show-track]');
    if (!sec || !track) return;
    const picks = ['si-60w', 'si-40w-rms', 'aio-20w', 'high-mast-12m', 'flood-60w', 'blinker-20w', 'battery-100ah', 'deco-pole-5m'];
    const items = picks.map(function (id) { return GS.byId[id]; }).filter(Boolean);
    track.innerHTML = items.map(function (p, i) {
      const href = 'contact.html?p=' + encodeURIComponent(p.id);
      const big = p.big || (p.watt ? p.watt + 'W' : '');
      const cat = window.GS_CATEGORIES.find(function (c) { return c.id === p.cat; });
      const specs = (p.key || [['Battery', p.battery], ['Panel', p.panel], ['Backup', p.autonomy]]).concat([['Protection', p.ip || '—']]).slice(0, 4);
      return '<article class="show-card glass glass-edge">' +
        '<a class="sc-stage' + (p.blueprint ? ' blueprint' : '') + '" href="' + href + '" tabindex="-1" aria-hidden="true" data-cursor="Enquire">' +
          (big ? '<span class="sc-watt cond">' + GS.esc(big) + '</span>' : '') + '<img src="' + p.img + '" alt="" loading="lazy"></a>' +
        '<div class="sc-body">' +
          '<span class="label">№ ' + pad(i + 1) + ' / ' + pad(items.length) + ' · ' + GS.esc(cat ? cat.name : '') + '</span>' +
          '<h3 class="h3">' + GS.esc(p.name) + '</h3>' +
          '<div class="scope" style="margin:0">' + (p.tags || []).map(function (t) { return '<span class="chip">' + GS.esc(t) + '</span>'; }).join('') + '</div>' +
          '<dl class="specs">' + specs.map(function (s) { return '<div><dt class="label">' + GS.esc(s[0]) + '</dt><dd>' + GS.esc(s[1]) + '</dd></div>'; }).join('') + '</dl>' +
          '<div class="hero-ctas">' + GS.btn('Enquire', href, 'btn-plasma btn-sm') +
            '<button class="icon-btn glass sl" type="button" data-add="' + p.id + '" aria-pressed="false" aria-label="Add ' + GS.esc(p.short || p.name) + ' to quote list"><span class="state" aria-hidden="true"></span>' + GS.icon.plus + '</button></div>' +
        '</div></article>';
    }).join('') +
      '<div class="show-end glass glass-edge"><div><p class="label">18 products · 5 families</p><p class="h3">The whole <span class="it grad">catalogue</span></p>' +
      GS.btn('Enter the marketplace', 'products.html', 'btn-plasma') + '</div></div>';
    document.dispatchEvent(new CustomEvent('gs:quote'));

    const bar = sec.querySelector('[data-show-progress]');
    if (motion && isDesktop()) {
      const dist = function () { return Math.max(0, track.scrollWidth - innerWidth); };
      gsap.to(track, {
        x: function () { return -dist(); },
        ease: 'none',
        scrollTrigger: {
          trigger: sec, start: 'top top', end: function () { return '+=' + dist(); }, pin: true, scrub: 1, invalidateOnRefresh: true,
          onUpdate: function (self) { bar.style.setProperty('--p', self.progress.toFixed(3)); }
        }
      });
    } else {
      sec.classList.add('is-native');
      track.addEventListener('scroll', function () {
        bar.style.setProperty('--p', (track.scrollLeft / Math.max(1, track.scrollWidth - track.clientWidth)).toFixed(3));
      }, { passive: true });
    }
  }

  /* ---------- 8. hovering a family or sector floats its product next to the cursor ---------- */
  function peeks() {
    const peek = document.querySelector('[data-peek-el]');
    if (!peek || !GS.finePointer || GS.reduceMotion) return;
    const img = peek.querySelector('img');
    let x = 0, y = 0, px = 0, py = 0, on = false;
    document.querySelectorAll('[data-peek-list] [data-peek]').forEach(function (row) {
      row.addEventListener('pointerenter', function () { img.src = row.dataset.peek; on = true; peek.classList.add('is-on'); });
      row.addEventListener('pointerleave', function () { on = false; peek.classList.remove('is-on'); });
    });
    addEventListener('pointermove', function (e) { x = e.clientX + 150; y = e.clientY; }, { passive: true });
    (function loop() {
      px += (x - px) * .14; py += (y - py) * .14;
      if (on || peek.classList.contains('is-on')) peek.style.translate = px.toFixed(1) + 'px ' + py.toFixed(1) + 'px';
      requestAnimationFrame(loop);
    })();
  }

  /* ---------- 9. light finder ---------- */
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
      return '<button class="fopt sl" type="button" role="radio" aria-checked="false" tabindex="' + (i ? -1 : 0) + '" data-f="' + f.id + '">' +
        '<span class="state" aria-hidden="true"></span>' +
        '<svg viewBox="0 0 38 40" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + f.icon + '</svg>' +
        '<span><b>' + f.label + '</b><small>' + f.sub + '</small></span><span class="radio" aria-hidden="true"></span></button>';
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
      out.innerHTML = '<p class="finder-why glass">' + f.why + '</p><div class="cards">' +
        f.picks.map(function (pid) { return GS.byId[pid]; }).filter(Boolean).map(function (p) { return GS.card(p); }).join('') + '</div>';
      if (motion) gsap.from(out.querySelectorAll('.card'), { y: 40, opacity: 0, duration: .9, ease: 'expo.out', stagger: .07 });
      if (ST) ST.refresh();
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

  /* ---------- 10. the sun rises again over the call to action ---------- */
  function ctaSun() {
    const cta = document.querySelector('[data-cta]');
    const canvas = document.querySelector('[data-cta-canvas]');
    if (!cta || !canvas) return;
    const sun = mountSun(canvas, { center: [0.5, 1.2], radius: innerWidth < 760 ? 0.7 : 0.55, pointer: false });
    if (motion) {
      gsap.fromTo(canvas, { yPercent: 35 }, { yPercent: 0, ease: 'none', scrollTrigger: { trigger: cta, start: 'top bottom', end: 'center center', scrub: true } });
      gsap.fromTo(cta.querySelector('.cta-fallback'), { yPercent: 35 }, { yPercent: 0, ease: 'none', scrollTrigger: { trigger: cta, start: 'top bottom', end: 'center center', scrub: true } });
    }
  }

  heroSun();
  heroIntro();
  liveStatus();
  marquee();
  litUp();
  countUps();
  dayCycle();
  showroom();
  peeks();
  finder();
  ctaSun();
  GS.reveals();
  if (ST) { addEventListener('load', function () { ST.refresh(); }); if (document.fonts) document.fonts.ready.then(function () { ST.refresh(); }); }
})();
