/* Contact page: the quote list, the enquiry form and the map. */
(function () {
  const GS = window.GS;
  const CFG = GS.config;
  const form = document.querySelector('[data-form]');
  const itemsEl = document.querySelector('[data-items]');
  const emptyEl = document.querySelector('[data-items-empty]');
  const addSel = document.querySelector('[data-add-select]');
  const status = document.querySelector('[data-status]');

  // "Enquire" links arrive as contact.html?p=<id>: put that product on the list, then tidy the URL
  const params = new URLSearchParams(location.search);
  const incoming = (params.get('p') || '').split(',').filter(function (id) { return GS.byId[id]; });
  incoming.forEach(function (id) { if (!GS.quote.has(id)) GS.quote.add(id, 1); });
  if (params.has('p')) history.replaceState(null, '', location.pathname + '#enquiry');

  function renderItems() {
    const list = GS.quote.list();
    itemsEl.innerHTML = list.map(function (x) {
      const p = GS.byId[x.id];
      return '<li class="item" data-id="' + GS.esc(p.id) + '">' +
        '<span class="th' + (p.blueprint ? ' blueprint' : '') + '"><img src="' + GS.esc(p.img) + '" alt=""></span>' +
        '<span><b>' + GS.esc(p.name) + '</b><span class="label">' + GS.esc(p.part) + '</span></span>' +
        '<span class="qty"><button type="button" class="sl" data-step="-1" aria-label="One fewer"><span class="state" aria-hidden="true"></span>−</button>' +
        '<input type="number" min="1" max="9999" value="' + GS.esc(x.qty) + '" aria-label="Quantity of ' + GS.esc(p.short || p.name) + '">' +
        '<button type="button" class="sl" data-step="1" aria-label="One more"><span class="state" aria-hidden="true"></span>+</button></span>' +
        '<button class="rm sl" type="button" aria-label="Remove ' + GS.esc(p.short || p.name) + '"><span class="state" aria-hidden="true"></span>×</button></li>';
    }).join('');
    emptyEl.hidden = list.length > 0;

    const inList = {};
    list.forEach(function (x) { inList[x.id] = true; });
    addSel.innerHTML = '<option value="">+ Add a product to this enquiry…</option>' + window.GS_CATEGORIES.map(function (c) {
      const opts = GS.products.filter(function (p) { return p.cat === c.id && !inList[p.id]; });
      return opts.length ? '<optgroup label="' + GS.esc(c.name) + '">' + opts.map(function (p) {
        return '<option value="' + GS.esc(p.id) + '">' + GS.esc(p.name) + '</option>';
      }).join('') + '</optgroup>' : '';
    }).join('');
  }

  itemsEl.addEventListener('click', function (e) {
    const li = e.target.closest('.item');
    if (!li) return;
    const id = li.dataset.id;
    const step = e.target.closest('[data-step]');
    if (step) {
      const input = li.querySelector('input');
      GS.quote.set(id, (parseInt(input.value, 10) || 1) + +step.dataset.step);
      return;
    }
    if (e.target.closest('.rm')) GS.quote.remove(id);
  });
  itemsEl.addEventListener('change', function (e) {
    const li = e.target.closest('.item');
    if (li && e.target.matches('input')) GS.quote.set(li.dataset.id, parseInt(e.target.value, 10) || 1);
  });
  addSel.addEventListener('change', function () {
    if (addSel.value) GS.quote.add(addSel.value, 1);
  });
  document.addEventListener('gs:quote', function () {
    // keep focus inside the list while people adjust quantities, and somewhere sensible after a removal
    const active = document.activeElement;
    const li = active && active.closest && active.closest('.item');
    const id = li && li.dataset.id;
    const idx = li ? Array.from(itemsEl.children).indexOf(li) : -1;
    const which = active && active.dataset && active.dataset.step;
    renderItems();
    if (id) {
      const again = itemsEl.querySelector('.item[data-id="' + id + '"] ' + (which ? '[data-step="' + which + '"]' : 'input'));
      if (again) { again.focus(); return; }
      const items = itemsEl.querySelectorAll('.item');
      const next = items.length ? items[Math.min(idx, items.length - 1)].querySelector('.rm') : addSel;
      next.focus();
      const gone = GS.byId[id];
      if (gone) say((gone.short || gone.name) + ' removed from the list.');
    }
  });

  /* ---------- validation + sending ---------- */
  function field(name) { return form.elements[name]; }
  function check(focus) {
    let ok = true;
    function flag(name, bad) {
      field(name).closest('.field').classList.toggle('bad', bad);
      field(name).setAttribute('aria-invalid', bad);
      const err = document.getElementById(field(name).id + '-err');
      if (err) { if (bad) field(name).setAttribute('aria-describedby', err.id); else field(name).removeAttribute('aria-describedby'); }
      if (bad && ok && focus) field(name).focus(); // only on submit: never pull focus away while someone types
      if (bad) ok = false;
    }
    flag('name', !field('name').value.trim());
    flag('phone', field('phone').value.replace(/\D/g, '').length < 10);
    const em = field('email').value.trim();
    flag('email', !!em && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em));
    return ok;
  }

  function message() {
    const lines = ['Hello Green Sun Technologies,', ''];
    const list = GS.quote.list();
    if (list.length) {
      lines.push('I would like a quote for:');
      list.forEach(function (x) {
        const p = GS.byId[x.id];
        lines.push('• ' + p.name + ' (' + p.part + ') × ' + x.qty);
      });
      lines.push('');
    }
    [['Name', 'name'], ['Phone', 'phone'], ['Email', 'email'], ['Organisation', 'org'], ['Site', 'site']].forEach(function (f) {
      const v = field(f[1]).value.trim();
      if (v) lines.push(f[0] + ': ' + v);
    });
    const msg = field('message').value.trim();
    if (msg) lines.push('', msg);
    return lines.join('\n');
  }

  function say(text, kind) {
    status.textContent = text;
    status.className = 'form-status' + (kind ? ' ' + kind : '');
  }

  // the direct "Send enquiry" button only exists when a form backend is configured; otherwise remove it so
  // pressing Enter in a field can't pick it as the form's default button
  const formBtn = form.querySelector('[data-via="form"]');
  if (CFG.formEndpoint) {
    formBtn.hidden = false;
    // the privacy line above the form must stay true once enquiries can go straight to a form service
    const note = document.querySelector('[data-send-note]');
    if (note) note.textContent = 'Nothing is sent until you press Send enquiry, WhatsApp or email below. Send enquiry passes your details to us through a form service.';
  } else formBtn.remove();
  let sending = false;

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (sending) return;
    if (!check(true)) { say('Please fix the highlighted fields.', 'bad'); return; }
    const sub = e.submitter && !e.submitter.hidden && e.submitter.dataset.via ? e.submitter : null;
    let via = sub ? sub.dataset.via : (CFG.formEndpoint ? 'form' : 'whatsapp');
    if (via === 'form' && !CFG.formEndpoint) via = 'whatsapp';
    const text = message();
    const subject = 'Quote request — ' + field('name').value.trim() + (field('org').value.trim() ? ', ' + field('org').value.trim() : '');

    if (via === 'whatsapp') {
      window.open('https://wa.me/' + CFG.whatsapp + '?text=' + encodeURIComponent(text), '_blank', 'noopener');
      say('WhatsApp opened with your enquiry written out — just press send.', 'ok');
    } else if (via === 'email') {
      location.href = 'mailto:' + CFG.email + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(text);
      say('Your email app should open with the enquiry filled in. If nothing happens, write to ' + CFG.email + '.', 'ok');
    } else {
      say('Sending…');
      sending = true;
      const busy = Array.from(form.querySelectorAll('button[data-via]'));
      busy.forEach(function (b) { b.disabled = true; });
      fetch(CFG.formEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          subject: subject, message: text,
          name: field('name').value.trim(), phone: field('phone').value.trim(), email: field('email').value.trim(),
          organisation: field('org').value.trim(), site: field('site').value.trim(),
          products: GS.quote.list().map(function (x) { return { id: x.id, name: GS.byId[x.id].name, qty: x.qty }; })
        })
      }).then(function (r) {
        if (!r.ok) throw new Error(r.status);
        form.reset();
        GS.quote.save([]);
        say('Thank you — your enquiry is with us. We’ll be in touch soon.', 'ok');
      }).catch(function () {
        say('That didn’t go through. Please try WhatsApp or email instead.', 'bad');
      }).then(function () {
        sending = false;
        busy.forEach(function (b) { b.disabled = false; });
      });
    }
  });
  form.addEventListener('input', function (e) {
    const f = e.target.closest('.field');
    if (f && f.classList.contains('bad') && check()) say('');
  });

  /* ---------- areas + map ---------- */
  const areas = document.querySelector('[data-areas]');
  if (areas) areas.innerHTML = (CFG.serviceAreas || []).map(function (a) { return '<li class="tag">' + GS.esc(a) + '</li>'; }).join('');
  const map = document.querySelector('[data-map]');
  if (map && CFG.mapQuery) {
    map.innerHTML = GS.btn('Open in Google Maps', 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(CFG.mapQuery), 'btn-glass glass btn-sm', ' target="_blank" rel="noopener"');
    // the embed loads Google's own scripts and an iframe holds up window.load, which the loading screen waits for
    // (loading="lazy" doesn't help: Chrome's lazy distance reaches it anyway). Make it only after load, near the screen.
    const frame = '<iframe title="Map: Green Sun Technologies, ' + GS.esc(CFG.address ? CFG.address.join(', ') : '') + '" loading="lazy" referrerpolicy="no-referrer-when-downgrade" src="https://www.google.com/maps?q=' + encodeURIComponent(CFG.mapQuery) + '&output=embed"></iframe>';
    const put = function () { if (!map.querySelector('iframe')) map.insertAdjacentHTML('afterbegin', frame); };
    const arm = function () {
      if (!('IntersectionObserver' in window)) { put(); return; }
      const io = new IntersectionObserver(function (es) {
        if (es.some(function (e) { return e.isIntersecting; })) { io.disconnect(); put(); }
      }, { rootMargin: '300px 0px' });
      io.observe(map);
    };
    if (document.readyState === 'complete') arm(); else addEventListener('load', arm, { once: true });
  }

  renderItems();

  // page intro
  GS.ready(function () {
    document.querySelectorAll('[data-hero-line]').forEach(function (l, i) { GS.splitIn(l, .1 + i * .12); });
  });
})();
