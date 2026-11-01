/* Green Sun Technologies — admin console.
   One page, hash routes (#/ · #/products · #/products/<id> · #/enquiries/<id> · #/details), no framework, no build.

   Two back ends behind the same small `store` object:
     • live  — Supabase (supabase/schema.sql). Used when supabaseUrl + supabaseAnonKey are set in assets/js/config.js.
               Saving a product or the contact details publishes it: the website reads the same tables (assets/js/live.js).
     • demo  — this browser's localStorage, any email and password signs in. Saving also writes the site's own copy
               ('gs-live'), so the website on this same address shows your edits at once. Enquiries sent from the
               Contact page on localhost land in the demo inbox.
   Products are kept exactly as products.js builds them (one JSON object each), so nothing the site needs is lost. */
(function () {
  'use strict';

  const CFG = window.GS_CONFIG || {};
  const SBX = window.SB;
  const DEMO = !SBX.configured;
  const CATS = window.GS_CATEGORIES || [];
  const app = document.getElementById('app');

  /* ------------------------------------------------------------------ helpers */
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const clone = o => JSON.parse(JSON.stringify(o));
  const ls = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } },
    del(k) { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } }
  };
  const catShort = id => (CATS.find(c => c.id === id) || {}).short || id;
  const slug = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 64);
  const imgSrc = u => !u ? '' : /^(https?:|data:|blob:)/.test(u) ? u : '../' + u;   // site-relative paths, seen from /admin/
  const fmtDate = iso => new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
  function ago(iso) {
    const s = (Date.now() - new Date(iso).getTime()) / 1000;
    if (s < 60) return 'just now';
    if (s < 3600) return Math.floor(s / 60) + ' min ago';
    if (s < 86400) return Math.floor(s / 3600) + ' h ago';
    if (s < 604800) return Math.floor(s / 86400) + ' d ago';
    return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  }
  function waNum(phone) {
    let d = String(phone || '').replace(/\D/g, '').replace(/^0+/, '');
    if (d.length === 10) d = '91' + d;
    return d;
  }

  const ico = d => '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + '</svg>';
  const I = {
    grid: ico('<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/>'),
    box: ico('<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3z"/><path d="M12 12l8-4.5M12 12v9M12 12L4 7.5"/>'),
    inbox: ico('<path d="M3 13l2.5-8h13L21 13v6a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-6z"/><path d="M3 13h5l1.5 3h5l1.5-3h5"/>'),
    sliders: ico('<path d="M4 6h8M18 6h2M4 12h2M12 12h8M4 18h10M20 18h0"/><circle cx="15" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="18" r="2"/>'),
    out: ico('<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>'),
    logout: ico('<path d="M9 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h4M16 8l4 4-4 4M20 12H9"/>'),
    plus: ico('<path d="M12 5v14M5 12h14"/>'),
    search: ico('<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4-4"/>'),
    star: '<svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" aria-hidden="true"><path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 17l-5.2 2.7 1-5.9L3.5 9.7l5.9-.8L12 3.5z"/></svg>',
    up: ico('<path d="M12 19V5M6 11l6-6 6 6"/>'),
    down: ico('<path d="M12 5v14M6 13l6 6 6-6"/>'),
    trash: ico('<path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-12M9 7V4h6v3"/>'),
    upload: ico('<path d="M12 16V4M7 9l5-5 5 5M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3"/>'),
    phone: ico('<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a1 1 0 0 1-1 1A15 15 0 0 1 4 5a1 1 0 0 1 1-1z"/>'),
    chat: ico('<path d="M20 12a8 8 0 0 1-11.7 7L4 20l1.1-4.1A8 8 0 1 1 20 12z"/>'),
    mail: ico('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>'),
    check: ico('<path d="M5 12.5l4.5 4.5L19 7.5"/>'),
    back: ico('<path d="M15 5l-7 7 7 7"/>'),
    sun: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8"/></svg>'
  };

  /* ------------------------------------------------------------------ toast + dialog */
  function toast(msg, kind) {
    const box = $('#toasts');
    if (!box) return;
    const t = document.createElement('div');
    t.className = 'toast' + (kind ? ' ' + kind : '');
    t.textContent = msg;
    box.appendChild(t);
    requestAnimationFrame(() => t.classList.add('in'));
    setTimeout(() => { t.classList.remove('in'); setTimeout(() => t.remove(), 300); }, kind === 'bad' ? 6000 : 3800);
  }
  function ask(title, body, ok, danger) {
    return new Promise(res => {
      const d = document.createElement('dialog');
      d.className = 'dlg';
      d.innerHTML = '<form method="dialog"><h2>' + esc(title) + '</h2><p>' + esc(body) + '</p><div class="dlg-b"><button class="btn btn-ghost" value="no">Cancel</button><button class="btn ' + (danger ? 'btn-danger' : 'btn-plasma') + '" value="yes" autofocus>' + esc(ok) + '</button></div></form>';
      d.addEventListener('close', () => { res(d.returnValue === 'yes'); d.remove(); });
      document.body.appendChild(d);
      d.showModal();
    });
  }

  /* ------------------------------------------------------------------ data: baseline from the site's own files */
  const META = ['id', 'sort', 'hidden', 'order'];
  const dataOf = p => { const o = {}; Object.keys(p).forEach(k => { if (META.indexOf(k) < 0) o[k] = p[k]; }); return o; };
  const baseline = () => clone(window.GS_PRODUCTS || []).map(p => { delete p.order; return p; });
  const baseContact = () => ({
    phone: CFG.phone || '', whatsapp: CFG.whatsapp || '', email: CFG.email || '',
    address: (CFG.address || []).slice(), mapQuery: CFG.mapQuery || '', serviceAreas: (CFG.serviceAreas || []).slice()
  });
  const bySort = (a, b) => (a.sort - b.sort) || (a.id < b.id ? -1 : 1);

  /* ------------------------------------------------------------------ photos: shrink before storing */
  function shrink(file, max) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file), im = new Image();
      im.onload = () => {
        const k = Math.min(1, max / Math.max(im.width, im.height));
        const c = document.createElement('canvas');
        c.width = Math.round(im.width * k); c.height = Math.round(im.height * k);
        c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        c.toBlob(b => b ? resolve(b) : reject(new Error('Could not read that image')), 'image/webp', 0.86);
      };
      im.onerror = () => { URL.revokeObjectURL(url); reject(new Error('That file is not an image the browser can read')); };
      im.src = url;
    });
  }
  const toDataUrl = blob => new Promise(res => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(blob); });

  /* ------------------------------------------------------------------ store: demo (localStorage) */
  function makeDemo() {
    const K = { p: 'gs-demo-products', c: 'gs-demo-contact', m: 'gs-demo-messages', live: 'gs-live' };
    const readP = () => {
      let l = ls.get(K.p, null);
      if (!l) { l = baseline().map((p, i) => Object.assign(p, { sort: i, hidden: false })); ls.set(K.p, l); }
      return l;
    };
    // what the website reads: visible products in order, and the contact details once they have been saved here
    const publish = list => {
      const shown = (list || readP()).slice().sort(bySort).filter(p => !p.hidden).map(p => Object.assign({ id: p.id }, dataOf(p)));
      const ok = ls.set(K.live, { at: Date.now(), products: shown, config: ls.get(K.c, null) });
      if (!ok) toast('Browser storage is full: the website preview was not updated.', 'bad');
    };
    const seedMessages = () => {
      const base = baseline(), pick = (id, qty) => { const p = base.find(x => x.id === id); return { id, name: p ? p.name : id, part: p ? p.part : '', qty }; };
      const h = 3600e3, now = Date.now();
      const l = [
        { id: 'm1', at: new Date(now - 3 * h).toISOString(), status: 'new', starred: false, name: 'Ranjit Baruah', phone: '+91 98640 12345', email: null, org: 'Gaon Panchayat office', site: 'Jonai, Dhemaji, Assam', message: 'Need a quote for 40 W street lights, about 60 poles along the village road. Tender closes at the end of next month.', products: [pick('si-40w', 60)] },
        { id: 'm2', at: new Date(now - 26 * h).toISOString(), status: 'read', starred: false, name: 'Meera Kalita', phone: '+91 70020 55511', email: 'estate.office@example.org', org: 'Tea estate, Sonitpur', site: 'Tezpur, Assam', message: 'A 12 m high mast for the factory yard and 20 flood lights. Please call after 4 pm.', products: [pick('high-mast-12m', 1), pick('flood-60w', 20)] },
        { id: 'm3', at: new Date(now - 96 * h).toISOString(), status: 'replied', starred: true, name: 'Abdul Karim', phone: '99540 80808', email: null, org: null, site: 'Silchar, Cachar', message: 'Do you sell the 100 Ah battery pack on its own? Price and warranty please.', products: [pick('battery-100ah', 2)] }
      ];
      ls.set(K.m, l);
      return l;
    };
    const readM = () => ls.get(K.m, null) || seedMessages();
    return {
      mode: 'demo',
      products: async () => readP().slice().sort(bySort),
      put: async (p, isNew) => {
        const l = readP(), i = l.findIndex(x => x.id === p.id);
        if (i < 0) { p.sort = l.reduce((m, x) => Math.max(m, x.sort), -1) + 1; l.push(p); } else l[i] = Object.assign({}, p, { sort: l[i].sort });
        ls.set(K.p, l); publish(l);
      },
      patch: async (id, patch) => { const l = readP(), p = l.find(x => x.id === id); if (p) Object.assign(p, patch); ls.set(K.p, l); publish(l); },
      remove: async id => { const l = readP().filter(x => x.id !== id); ls.set(K.p, l); publish(l); },
      importAll: async () => { ls.del(K.p); publish(); },
      contact: async () => ls.get(K.c, null),
      saveContact: async c => { ls.set(K.c, c); publish(); },
      messages: async () => readM().slice(),
      patchMessage: async (id, patch) => { const l = readM(), m = l.find(x => x.id === id); if (m) Object.assign(m, patch); ls.set(K.m, l); },
      removeMessage: async id => { ls.set(K.m, readM().filter(x => x.id !== id)); },
      upload: async file => toDataUrl(await shrink(file, 640)),
      reset: () => { [K.p, K.c, K.m, K.live].forEach(ls.del); }
    };
  }

  /* ------------------------------------------------------------------ store: live (Supabase) */
  function makeLive() {
    const db = SBX.db, q = SBX.q;
    const who = () => (SBX.session && SBX.session.user && SBX.session.user.email) || null;
    const row = (p, sort) => ({ id: p.id, sort, hidden: !!p.hidden, data: dataOf(p), updated_by: who() });
    return {
      mode: 'live',
      products: async () => (await db.select('gs_products', 'select=id,sort,hidden,data&order=sort.asc,id.asc')).map(r => Object.assign({}, r.data, { id: r.id, sort: r.sort, hidden: r.hidden })),
      put: async (p, isNew, sort) => isNew
        ? db.insert('gs_products', row(p, sort || 0))
        : db.update('gs_products', 'id=eq.' + q(p.id), { hidden: !!p.hidden, data: dataOf(p), updated_by: who() }),
      patch: async (id, patch) => db.update('gs_products', 'id=eq.' + q(id), patch),
      remove: async id => db.remove('gs_products', 'id=eq.' + q(id)),
      importAll: async function () {
        const have = new Set((await this.products()).map(p => p.id));
        const rows = baseline().map((p, i) => row(p, i)).filter(r => !have.has(r.id));
        if (rows.length) await db.insert('gs_products', rows);
        if (!(await this.contact())) await this.saveContact(baseContact());
      },
      contact: async () => { const r = await db.select('gs_settings', 'select=data&key=eq.contact'); return r[0] ? r[0].data : null; },
      saveContact: async function (c) {
        if (await this.contact()) await db.update('gs_settings', 'key=eq.contact', { data: c, updated_by: who() });
        else await db.insert('gs_settings', { key: 'contact', data: c, updated_by: who() });
      },
      messages: async () => db.select('gs_messages', 'select=*&order=at.desc&limit=500'),
      patchMessage: async (id, patch) => db.update('gs_messages', 'id=eq.' + q(id), patch),
      removeMessage: async id => db.remove('gs_messages', 'id=eq.' + q(id)),
      upload: async file => {
        const blob = await shrink(file, 1200);
        const path = 'products/' + Date.now() + '-' + (slug(file.name.replace(/\.[^.]+$/, '')) || 'photo') + '.webp';
        await SBX.storage.upload('gs-media', path, blob, 'image/webp');
        return SBX.storage.publicUrl('gs-media', path);
      }
    };
  }
  const store = DEMO ? makeDemo() : makeLive();

  /* ------------------------------------------------------------------ auth */
  const auth = {
    user: null, denied: false,
    async resume() {
      if (DEMO) { const e = sessionStorage.getItem('gs-demo-user'); this.user = e ? { email: e } : null; return !!e; }
      if (!SBX.session || SBX.timedOut()) return false;
      try {
        const u = await SBX.user();
        if ((await SBX.db.rpc('gs_is_admin')) === true) { this.user = u; return true; }
        this.denied = true; await SBX.signOut();
      } catch (e) { /* not signed in */ }
      return false;
    },
    async signIn(email, pw) {
      if (DEMO) { sessionStorage.setItem('gs-demo-user', email); return; }
      await SBX.signIn(email, pw);
    },
    async signOut() {
      this.user = null;
      if (DEMO) sessionStorage.removeItem('gs-demo-user'); else await SBX.signOut();
    }
  };

  /* ------------------------------------------------------------------ state */
  const S = { products: null, messages: null, contact: null, contactSaved: false, pf: { q: '', cat: '' }, ef: 'new', eq: '', dirty: false, edit: null };
  async function loadProducts(force) { if (!S.products || force) S.products = (await store.products()).sort(bySort); return S.products; }
  async function loadMessages(force) { if (!S.messages || force) S.messages = await store.messages(); return S.messages; }
  async function loadContact(force) {
    if (S.contact && !force) return S.contact;
    const c = await store.contact();
    S.contactSaved = !!c;
    S.contact = Object.assign(baseContact(), c || {});
    return S.contact;
  }
  const newCount = () => (S.messages || []).filter(m => m.status === 'new').length;
  function paintBadge() {
    const b = $('#badge'); if (!b) return;
    const n = newCount();
    b.hidden = !n; b.textContent = n > 99 ? '99+' : n;
  }
  async function refreshBadge() { try { await loadMessages(true); paintBadge(); } catch (e) { /* offline */ } }

  /* ------------------------------------------------------------------ shared view pieces */
  function head(eyebrow, title, em, sub, acts) {
    return '<header class="phead"><div><p class="eyebrow"><i></i>' + esc(eyebrow) + '</p><h1>' + esc(title) + (em ? ' <em>' + esc(em) + '</em>' : '') + '</h1>' +
      (sub ? '<p class="sub">' + sub + '</p>' : '') + '</div>' + (acts ? '<div class="acts">' + acts + '</div>' : '') + '</header>';
  }
  const thumb = p => p.img ? '<img src="' + esc(imgSrc(p.img)) + '" alt="" loading="lazy">' : '<span class="nophoto">' + I.sun + '</span>';
  const loading = '<div class="loading" aria-live="polite"><i></i><i></i><i></i><span class="sr">Loading</span></div>';
  function fail(err) {
    return '<div class="empty bad"><h2>That didn’t load</h2><p>' + esc(err && err.message || err) + '</p><button class="btn btn-ghost" data-act="reload">Try again</button></div>';
  }

  /* ================================================================== views */

  /* ---------------------------------------------------------- dashboard */
  async function vDashboard() {
    const [ps, ms, c] = await Promise.all([loadProducts(true), loadMessages(true), loadContact(true)]);
    paintBadge();
    const visible = ps.filter(p => !p.hidden), hidden = ps.length - visible.length;
    const fresh = ms.filter(m => m.status === 'new');
    const hr = new Date().getHours();
    const greet = hr < 5 ? 'Still up' : hr < 12 ? 'Good morning' : hr < 17 ? 'Good afternoon' : 'Good evening';

    const todo = [];
    if (!ps.length) todo.push(['warn', 'The catalogue is empty', 'Import the ' + baseline().length + ' products from the website files to start editing.', '<button class="btn btn-plasma btn-sm" data-act="import">Import the catalogue</button>']);
    if (fresh.length) todo.push(['hot', fresh.length + (fresh.length === 1 ? ' new enquiry is' : ' new enquiries are') + ' waiting', 'Call or WhatsApp them while the interest is fresh.', '<a class="btn btn-ghost btn-sm" href="#/enquiries">Open inbox</a>']);
    const noPhoto = ps.filter(p => !p.img);
    if (noPhoto.length) todo.push(['warn', noPhoto.length + (noPhoto.length === 1 ? ' product has' : ' products have') + ' no photo', noPhoto.slice(0, 3).map(p => esc(p.short || p.name)).join(', ') + (noPhoto.length > 3 ? '…' : ''), '<a class="btn btn-ghost btn-sm" href="#/products/' + esc(noPhoto[0].id) + '">Fix</a>']);
    const thin = ps.filter(p => (p.specs || []).length < 4);
    if (thin.length) todo.push(['info', thin.length + (thin.length === 1 ? ' product has' : ' products have') + ' a short spec sheet', 'Buyers compare specs; fewer than four rows looks unfinished.', '<a class="btn btn-ghost btn-sm" href="#/products/' + esc(thin[0].id) + '">Open</a>']);
    if (hidden) todo.push(['info', hidden + (hidden === 1 ? ' product is' : ' products are') + ' hidden from the website', 'Visitors cannot see it until you switch it back on.', '<a class="btn btn-ghost btn-sm" href="#/products">Review</a>']);
    if (ps.length && !S.contactSaved) todo.push(['info', 'Contact details not saved here yet', 'The site still uses the numbers written in its files. Save them once to manage them from here.', '<a class="btn btn-ghost btn-sm" href="#/details">Open</a>']);

    const cats = CATS.map(k => ({ k, n: ps.filter(p => p.cat === k.id).length }));
    const total = Math.max(1, ps.length);
    const recent = ms.slice(0, 3);

    return head('Overview', greet + ',', 'Green Sun.', 'Everything on the website that changes — products, contact details and enquiries — is managed from here.',
      '<a class="btn btn-plasma" href="#/products/new">' + I.plus + '<span>Add product</span></a>') +
      '<div class="bento">' +
        '<section class="card b-inbox"><div class="card-h"><h2>Enquiries</h2><a class="more" href="#/enquiries">Open inbox</a></div>' +
          '<div class="big"><b>' + fresh.length + '</b><span>new ' + (fresh.length === 1 ? 'enquiry' : 'enquiries') + '<br><small>' + ms.length + ' in all</small></span></div>' +
          (recent.length ? '<ul class="mini">' + recent.map(m => '<li><a href="#/enquiries/' + esc(m.id) + '"><i class="dot ' + esc(m.status) + '"></i><span><b>' + esc(m.name) + '</b><small>' + esc(summary(m)) + '</small></span><time>' + esc(ago(m.at)) + '</time></a></li>').join('') + '</ul>'
            : '<p class="muted">No enquiries yet. They appear here as soon as someone uses the Contact page.</p>') +
        '</section>' +
        '<section class="card b-cat"><div class="card-h"><h2>Catalogue</h2><a class="more" href="#/products">Manage</a></div>' +
          '<div class="big"><b>' + visible.length + '</b><span>products on the site<br><small>' + (hidden ? hidden + ' hidden' : 'none hidden') + '</small></span></div>' +
          '<div class="bars">' + cats.map(x => '<div class="bar"><span>' + esc(x.k.short) + '</span><i><u style="width:' + Math.round(x.n / total * 100) + '%"></u></i><b>' + x.n + '</b></div>').join('') + '</div>' +
        '</section>' +
        '<section class="card b-todo"><div class="card-h"><h2>Needs attention</h2></div>' +
          (todo.length ? '<ul class="todo">' + todo.map(t => '<li class="' + t[0] + '"><i></i><div><b>' + t[1] + '</b><small>' + t[2] + '</small></div>' + t[3] + '</li>').join('') + '</ul>'
            : '<div class="allgood">' + I.check + '<div><b>All clear</b><small>Every product has a photo and a full spec sheet, and no enquiry is waiting.</small></div></div>') +
        '</section>' +
        '<section class="card b-quick"><div class="card-h"><h2>Quick actions</h2></div><div class="quick">' +
          '<a href="#/products/new">' + I.plus + '<span>Add a product</span></a>' +
          '<a href="#/details">' + I.sliders + '<span>Edit phone, email &amp; areas</span></a>' +
          '<a href="../products.html" target="_blank" rel="noopener">' + I.out + '<span>See the products page</span></a>' +
          '<a href="../contact.html" target="_blank" rel="noopener">' + I.out + '<span>See the contact page</span></a>' +
        '</div></section>' +
        '<section class="card b-site"><div class="card-h"><h2>Website</h2></div>' +
          '<dl class="facts"><div><dt>Data from</dt><dd>' + (DEMO ? 'Demo (this browser)' : 'Supabase database') + '</dd></div>' +
          '<div><dt>Phone</dt><dd>' + esc(c.phone || '—') + '</dd></div><div><dt>Email</dt><dd>' + esc(c.email || '—') + '</dd></div>' +
          '<div><dt>Areas served</dt><dd>' + c.serviceAreas.length + '</dd></div></dl>' +
          (DEMO ? '<p class="note">Demo mode: nothing here reaches the real website. Open the site in this same browser and it shows your edits. <button class="linkbtn" data-act="reset-demo">Reset demo data</button></p>'
            : '<p class="note">Changes go live as soon as you save. Visitors see them on their next page load.</p>') +
        '</section>' +
      '</div>';
  }
  function summary(m) {
    const p = m.products || [];
    if (!p.length) return m.message ? String(m.message).slice(0, 60) : 'No products listed';
    return p.slice(0, 2).map(x => x.qty + '× ' + (x.name || x.id)).join(', ') + (p.length > 2 ? ' +' + (p.length - 2) : '');
  }

  /* ---------------------------------------------------------- products: list */
  function productRows() {
    const f = S.pf, q = f.q.trim().toLowerCase();
    const all = S.products;
    const list = all.filter(p => (!f.cat || p.cat === f.cat) && (!q || (p.name + ' ' + (p.short || '') + ' ' + (p.part || '') + ' ' + p.id).toLowerCase().indexOf(q) >= 0));
    if (!list.length) return '<li class="empty-row">' + (all.length ? 'No product matches. <button class="linkbtn" data-act="clear-filter">Clear the filter</button>' : '') + '</li>';
    return list.map(p => {
      const url = '#/products/' + encodeURIComponent(p.id);
      return '<li class="prow' + (p.hidden ? ' is-off' : '') + '" data-id="' + esc(p.id) + '">' +
        '<a class="pthumb' + (p.blueprint ? ' bp' : '') + '" href="' + url + '" tabindex="-1" aria-hidden="true">' + thumb(p) + '</a>' +
        '<a class="pmain" href="' + url + '"><b>' + esc(p.name) + '</b><span>' + esc(p.part || p.id) + (p.watt ? ' · ' + esc(p.watt) + ' W' : '') + '</span></a>' +
        '<span class="chip c-' + esc(p.cat) + '">' + esc(catShort(p.cat)) + '</span>' +
        '<button class="star' + (p.featured ? ' on' : '') + '" data-act="feature" data-id="' + esc(p.id) + '" aria-pressed="' + !!p.featured + '" title="Show on the home page">' + I.star + '<span class="sr">Featured on the home page</span></button>' +
        '<label class="switch" title="' + (p.hidden ? 'Hidden from the website' : 'Visible on the website') + '"><input type="checkbox" data-act="visible" data-id="' + esc(p.id) + '"' + (p.hidden ? '' : ' checked') + '><span></span><b class="sr">Visible on the website</b></label>' +
        '<span class="mv"><button data-act="move" data-dir="-1" data-id="' + esc(p.id) + '" aria-label="Move up">' + I.up + '</button><button data-act="move" data-dir="1" data-id="' + esc(p.id) + '" aria-label="Move down">' + I.down + '</button></span>' +
        '<a class="btn btn-ghost btn-sm" href="' + url + '">Edit</a></li>';
    }).join('');
  }
  async function vProducts() {
    const ps = await loadProducts();
    const f = S.pf;
    const chips = [{ id: '', short: 'All' }].concat(CATS).map(c => {
      const n = c.id ? ps.filter(p => p.cat === c.id).length : ps.length;
      return '<button class="fchip' + (f.cat === c.id ? ' on' : '') + '" data-act="cat" data-cat="' + esc(c.id) + '">' + esc(c.short) + '<b>' + n + '</b></button>';
    }).join('');
    return head('Catalogue', 'Your', 'products', ps.length + ' in the catalogue. The order here is the order on the website; the star puts a product on the home page.',
      '<a class="btn btn-plasma" href="#/products/new">' + I.plus + '<span>Add product</span></a>') +
      (ps.length ? '' : '<div class="empty"><h2>Nothing here yet</h2><p>Import the ' + baseline().length + ' products from the website files, then edit them one by one.</p><button class="btn btn-plasma" data-act="import">Import the catalogue</button></div>') +
      '<div class="toolbar"><label class="search">' + I.search + '<input type="search" id="pq" placeholder="Search name, part number…" value="' + esc(f.q) + '" autocomplete="off"></label><div class="fchips" role="group" aria-label="Category">' + chips + '</div></div>' +
      '<ul class="plist" id="plist">' + productRows() + '</ul>';
  }

  /* ---------------------------------------------------------- products: editor */
  const fld = (label, name, val, o) => {
    o = o || {};
    return '<label class="fld' + (o.wide ? ' wide' : '') + '"><span>' + esc(label) + (o.req ? ' <i class="req">*</i>' : '') + '</span>' +
      '<input name="' + name + '" type="' + (o.type || 'text') + '" value="' + esc(val == null ? '' : val) + '"' + (o.ph ? ' placeholder="' + esc(o.ph) + '"' : '') + (o.req ? ' required' : '') + (o.ro ? ' readonly' : '') + (o.step ? ' step="' + o.step + '"' : '') + ' autocomplete="off">' +
      (o.hint ? '<em>' + o.hint + '</em>' : '') + '</label>';
  };
  const specRow = (k, v) => '<li class="srow"><input data-sl value="' + esc(k) + '" placeholder="Label" aria-label="Spec label"><input data-sv value="' + esc(v) + '" placeholder="Value" aria-label="Spec value">' +
    '<span class="mv"><button type="button" data-act="spec-up" aria-label="Move up">' + I.up + '</button><button type="button" data-act="spec-down" aria-label="Move down">' + I.down + '</button><button type="button" data-act="spec-del" aria-label="Remove row">' + I.trash + '</button></span></li>';

  async function vEditor(id) {
    const ps = await loadProducts();
    const isNew = id === 'new';
    let p;
    if (isNew) p = { cat: 'street', specs: [], tags: [], img: '' };
    else { p = ps.find(x => x.id === id); if (!p) return '<div class="empty"><h2>No such product</h2><p>It may have been deleted.</p><a class="btn btn-ghost" href="#/products">Back to products</a></div>'; p = clone(p); }
    S.edit = { base: p, isNew };
    S.dirty = false;
    const key = p.key || [];
    const keyRows = [0, 1, 2].map(i => '<div class="kf"><input name="k' + i + 'l" value="' + esc((key[i] || [])[0] || '') + '" placeholder="Label" aria-label="Key fact ' + (i + 1) + ' label"><input name="k' + i + 'v" value="' + esc((key[i] || [])[1] || '') + '" placeholder="Value" aria-label="Key fact ' + (i + 1) + ' value"></div>').join('');
    return '<a class="crumb" href="#/products">' + I.back + '<span>Products</span></a>' +
      head(isNew ? 'New product' : 'Edit product', isNew ? 'Add a' : 'Edit', isNew ? 'product' : p.short || p.name, isNew ? 'It appears on the website as soon as you save.' : 'Part ' + esc(p.part || '—') + ' · id <code>' + esc(p.id) + '</code>',
        (isNew ? '' : '<button class="btn btn-danger btn-sm" type="button" data-act="delete">' + I.trash + '<span>Delete</span></button>') +
        '<button class="btn btn-plasma" type="submit" form="pform" id="psave">Save product</button>') +
      '<form id="pform" class="eform" autocomplete="off" novalidate><div class="ecol">' +
        '<section class="card"><div class="card-h"><h2>Basics</h2></div><div class="fgrid">' +
          fld('Name', 'name', p.name, { req: true, wide: true, ph: '40W Semi-Integrated Solar Street Light' }) +
          fld('Short name', 'short', p.short, { ph: '40W Semi-Integrated', hint: 'Used on cards and in the quote list.' }) +
          fld('Part number', 'part', p.part, { ph: '40W-SI-SOL' }) +
          '<label class="fld"><span>Category <i class="req">*</i></span><select name="cat">' + CATS.map(c => '<option value="' + esc(c.id) + '"' + (p.cat === c.id ? ' selected' : '') + '>' + esc(c.name) + '</option>').join('') + '</select></label>' +
          fld('Power (watts)', 'watt', p.watt, { type: 'number', step: 'any', ph: '40', hint: 'Leave empty for poles, batteries and masts.' }) +
          fld('Badge', 'badge', p.badge, { ph: 'Smart', hint: 'Small label on the card, optional.' }) +
          fld('Big label', 'big', p.big, { ph: '12m', hint: 'Large text on the card; defaults to the wattage.' }) +
          (isNew ? fld('Product id', 'id', p.id || '', { ph: 'si-40w', wide: true, hint: 'Web-safe name used in links. Street lights named <code>si-&lt;watt&gt;w</code> also appear on the wattage dial. It cannot be changed later.' }) : '<input type="hidden" name="id" value="' + esc(p.id) + '">') +
        '</div></section>' +
        '<section class="card"><div class="card-h"><h2>Power &amp; build</h2></div><div class="fgrid">' +
          fld('Battery', 'battery', p.battery, { ph: '12.8 V · 30 Ah' }) + fld('Chemistry', 'chem', p.chem, { ph: 'LiFePO₄' }) +
          fld('Solar panel', 'panel', p.panel, { ph: '100 Wp' }) + fld('Optic', 'optic', p.optic, { ph: 'Glass' }) +
          fld('Protection', 'ip', p.ip, { ph: 'IP66' }) + fld('Autonomy', 'autonomy', p.autonomy, { ph: '2 days' }) +
          fld('Tags', 'tags', (p.tags || []).join(', '), { wide: true, ph: 'IP66, LiFePO₄, Glass optic', hint: 'Comma-separated; shown as small chips on the card.' }) +
        '</div></section>' +
        '<section class="card"><div class="card-h"><h2>Key facts</h2></div><p class="muted tight">Three headline numbers on the home page showroom. Leave empty to use battery, panel and backup.</p><div class="kfs">' + keyRows + '</div></section>' +
        '<section class="card"><div class="card-h"><h2>Spec sheet</h2><button class="btn btn-ghost btn-sm" type="button" data-act="spec-add">' + I.plus + '<span>Add row</span></button></div>' +
          '<ul class="slist" id="slist">' + (p.specs || []).map(r => specRow(r[0], r[1])).join('') + '</ul></section>' +
      '</div><aside class="ecol side-col">' +
        '<section class="card"><div class="card-h"><h2>Photo</h2></div>' +
          '<div class="pimg' + (p.blueprint ? ' bp' : '') + '" id="pimg">' + (p.img ? '<img src="' + esc(imgSrc(p.img)) + '" alt="">' : '<span class="nophoto">' + I.sun + '<small>No photo yet</small></span>') + '</div>' +
          '<label class="fld"><span>Photo address</span><input name="img" value="' + esc(p.img || '') + '" placeholder="assets/img/products/name.webp" autocomplete="off"></label>' +
          '<div class="row"><button class="btn btn-ghost btn-sm" type="button" data-act="pick-photo">' + I.upload + '<span>Upload a photo</span></button><input type="file" id="pfile" accept="image/jpeg,image/png,image/webp,image/avif" hidden></div>' +
          '<p class="note">Square or 4:3, on a plain background, at least 800 px wide. ' + (DEMO ? 'In demo mode the photo is kept in this browser.' : 'Photos are resized and stored in your Supabase bucket.') + '</p>' +
          '<label class="check"><input type="checkbox" name="blueprint"' + (p.blueprint ? ' checked' : '') + '><span>Technical-drawing style<small>For white-background drawings and poles; the card shows them on a blueprint grid.</small></span></label>' +
        '</section>' +
        '<section class="card"><div class="card-h"><h2>On the website</h2></div>' +
          '<label class="check"><input type="checkbox" name="visible"' + (p.hidden ? '' : ' checked') + '><span>Visible<small>Switch off to hide it without deleting.</small></span></label>' +
          '<label class="check"><input type="checkbox" name="featured"' + (p.featured ? ' checked' : '') + '><span>Featured on the home page<small>Adds it to the showroom on the home page.</small></span></label>' +
        '</section>' +
      '</aside></form>';
  }
  function readEditor() {
    const f = $('#pform'), g = n => (f.elements[n].value || '').trim();
    const p = Object.assign({}, S.edit.base);
    p.id = g('id');
    p.name = g('name'); p.short = g('short') || p.name; p.part = g('part'); p.cat = g('cat');
    const w = g('watt'); if (w !== '') p.watt = +w; else delete p.watt;
    ['battery', 'chem', 'panel', 'optic', 'ip', 'autonomy', 'badge', 'big'].forEach(k => { const v = g(k); if (v) p[k] = v; else delete p[k]; });
    p.tags = g('tags').split(',').map(s => s.trim()).filter(Boolean);
    p.img = g('img');
    if (f.elements.featured.checked) p.featured = true; else delete p.featured;
    if (f.elements.blueprint.checked) p.blueprint = true; else delete p.blueprint;
    p.hidden = !f.elements.visible.checked;
    const key = [0, 1, 2].map(i => [g('k' + i + 'l'), g('k' + i + 'v')]).filter(r => r[0] && r[1]);
    if (key.length) p.key = key; else delete p.key;
    p.specs = $$('.srow', f).map(r => [$('[data-sl]', r).value.trim(), $('[data-sv]', r).value.trim()]).filter(r => r[0] && r[1]);
    return p;
  }
  function validate(p) {
    const bad = [];
    if (!p.name) bad.push(['name', 'Give the product a name.']);
    if (S.edit.isNew) {
      if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(p.id)) bad.push(['id', 'The id may use lower-case letters, numbers and hyphens only.']);
      else if (S.products.some(x => x.id === p.id)) bad.push(['id', 'Another product already uses that id.']);
    }
    if (p.watt != null && !(p.watt >= 0)) bad.push(['watt', 'Power must be a number.']);
    return bad;
  }
  async function saveProduct() {
    const f = $('#pform');
    let p = readEditor();
    if (S.edit.isNew && !p.id) { p.id = slug(p.name); f.elements.id.value = p.id; }
    const bad = validate(p);
    $$('.fld.bad', f).forEach(x => x.classList.remove('bad'));
    if (bad.length) {
      bad.forEach(b => { const l = f.elements[b[0]].closest('.fld'); if (l) { l.classList.add('bad'); let e = $('.err', l); if (!e) { e = document.createElement('em'); e.className = 'err'; l.appendChild(e); } e.textContent = b[1]; } });
      f.elements[bad[0][0]].focus();
      toast(bad[0][1], 'bad');
      return;
    }
    const btn = $('#psave'); btn.disabled = true;
    try {
      const nextSort = S.products.reduce((m, x) => Math.max(m, x.sort), -1) + 1;
      await store.put(p, S.edit.isNew, nextSort);
      await loadProducts(true);
      S.dirty = false;
      toast(DEMO ? 'Saved. The website in this browser shows it now.' : 'Saved. It is live on the website.');
      if (S.edit.isNew) location.hash = '#/products/' + encodeURIComponent(p.id);
      else { S.edit.base = p; const t = $('.phead h1'); if (t) t.innerHTML = 'Edit <em>' + esc(p.short || p.name) + '</em>'; }
    } catch (err) { toast(err.message || 'Could not save', 'bad'); }
    btn.disabled = false;
  }

  /* ---------------------------------------------------------- enquiries */
  function filterMessages(sel) {
    const q = S.eq.trim().toLowerCase();
    return S.messages.filter(m => {
      if (m.id === sel) return true;     // the one being read stays in the list even after it stops being "new"
      const okTab = S.ef === 'all' ? m.status !== 'archived' : S.ef === 'new' ? m.status === 'new' : S.ef === 'starred' ? m.starred : m.status === 'archived';
      return okTab && (!q || [m.name, m.phone, m.email, m.org, m.site, m.message, summary(m)].join(' ').toLowerCase().indexOf(q) >= 0);
    });
  }
  function msgList(sel) {
    const l = filterMessages(sel);
    if (!l.length) return '<li class="empty-row">' + (S.messages.length ? 'Nothing in this view.' : 'No enquiries yet. They appear here as soon as someone uses the Contact page.') + '</li>';
    return l.map(m => '<li><a class="mrow' + (m.id === sel ? ' on' : '') + (m.status === 'new' ? ' unread' : '') + '" href="#/enquiries/' + encodeURIComponent(m.id) + '"><i class="dot ' + esc(m.status) + '"></i><span class="mt"><b>' + esc(m.name) + (m.starred ? ' <u class="starred">★</u>' : '') + '</b><small>' + esc(summary(m)) + '</small></span><time>' + esc(ago(m.at)) + '</time></a></li>').join('');
  }
  function msgDetail(m) {
    if (!m) return '<div class="mdetail none"><div class="empty"><h2>Pick an enquiry</h2><p>Choose one on the left to see who wrote, what they want, and how to reach them.</p></div></div>';
    const wa = 'https://wa.me/' + waNum(m.phone) + '?text=' + encodeURIComponent('Hello ' + m.name + ', this is Green Sun Technologies about your enquiry.');
    const ps = m.products || [];
    return '<article class="mdetail"><a class="crumb only-m" href="#/enquiries">' + I.back + '<span>All enquiries</span></a>' +
      '<header class="mhead"><div><h2>' + esc(m.name) + '</h2><p>' + esc([m.org, m.site].filter(Boolean).join(' · ') || 'No organisation or site given') + '</p><time datetime="' + esc(m.at) + '">' + esc(fmtDate(m.at)) + ' · ' + esc(ago(m.at)) + '</time></div>' +
        '<span class="pill s-' + esc(m.status) + '">' + esc(m.status) + '</span></header>' +
      '<div class="reach"><a class="btn btn-plasma" href="tel:' + esc(String(m.phone).replace(/[^\d+]/g, '')) + '">' + I.phone + '<span>' + esc(m.phone) + '</span></a>' +
        '<a class="btn btn-volt" href="' + esc(wa) + '" target="_blank" rel="noopener">' + I.chat + '<span>WhatsApp</span></a>' +
        (m.email ? '<a class="btn btn-ghost" href="mailto:' + esc(m.email) + '?subject=' + encodeURIComponent('Your Green Sun Technologies enquiry') + '">' + I.mail + '<span>' + esc(m.email) + '</span></a>' : '') + '</div>' +
      (ps.length ? '<section class="mblock"><h3>Asked about</h3><table class="ptab"><thead><tr><th>Product</th><th>Part</th><th class="r">Qty</th></tr></thead><tbody>' + ps.map(x => '<tr><td>' + esc(x.name || x.id) + '</td><td class="mono">' + esc(x.part || '') + '</td><td class="r">' + esc(x.qty) + '</td></tr>').join('') + '</tbody></table></section>' : '') +
      '<section class="mblock"><h3>Message</h3>' + (m.message ? '<p class="msg">' + esc(m.message).replace(/\n/g, '<br>') + '</p>' : '<p class="muted">They didn’t write a message.</p>') + '</section>' +
      '<footer class="macts"><button class="btn btn-ghost btn-sm" data-act="mstatus" data-s="replied" data-id="' + esc(m.id) + '"' + (m.status === 'replied' ? ' disabled' : '') + '>' + I.check + '<span>Mark replied</span></button>' +
        '<button class="btn btn-ghost btn-sm" data-act="mstar" data-id="' + esc(m.id) + '">' + I.star + '<span>' + (m.starred ? 'Unstar' : 'Star') + '</span></button>' +
        (m.status === 'archived' ? '<button class="btn btn-ghost btn-sm" data-act="mstatus" data-s="read" data-id="' + esc(m.id) + '"><span>Move to inbox</span></button>' : '<button class="btn btn-ghost btn-sm" data-act="mstatus" data-s="archived" data-id="' + esc(m.id) + '"><span>Archive</span></button>') +
        (m.status === 'read' || m.status === 'replied' ? '<button class="btn btn-ghost btn-sm" data-act="mstatus" data-s="new" data-id="' + esc(m.id) + '"><span>Mark unread</span></button>' : '') +
        '<button class="btn btn-danger btn-sm" data-act="mdelete" data-id="' + esc(m.id) + '">' + I.trash + '<span>Delete</span></button></footer></article>';
  }
  async function vEnquiries(id) {
    const ms = await loadMessages(true);
    paintBadge();
    let m = id ? ms.find(x => x.id === id) : null;
    if (m && m.status === 'new') { m.status = 'read'; store.patchMessage(m.id, { status: 'read' }).then(paintBadge).catch(() => { m.status = 'new'; }); paintBadge(); }
    const tabs = [['new', 'New'], ['all', 'All'], ['starred', 'Starred'], ['archived', 'Archived']].map(t => {
      const n = ms.filter(x => t[0] === 'all' ? x.status !== 'archived' : t[0] === 'new' ? x.status === 'new' : t[0] === 'starred' ? x.starred : x.status === 'archived').length;
      return '<button class="fchip' + (S.ef === t[0] ? ' on' : '') + '" data-act="etab" data-t="' + t[0] + '">' + t[1] + '<b>' + n + '</b></button>';
    }).join('');
    return head('Inbox', 'Customer', 'enquiries', 'Sent from the Contact page. Call or message them, then mark the enquiry replied.',
      '<button class="btn btn-ghost btn-sm" data-act="refresh">Refresh</button>') +
      '<div class="inbox' + (m ? ' has-sel' : '') + '"><div class="ilist"><div class="toolbar tight"><label class="search">' + I.search + '<input type="search" id="eq" placeholder="Search enquiries…" value="' + esc(S.eq) + '" autocomplete="off"></label></div><div class="fchips" role="group" aria-label="Show">' + tabs + '</div><ul class="mlist" id="mlist">' + msgList(m && m.id) + '</ul></div>' + msgDetail(m) + '</div>';
  }

  /* ---------------------------------------------------------- site details */
  async function vDetails() {
    const c = await loadContact(true);
    S.dirty = false;
    return head('Website', 'Site', 'details', 'The phone, email, address and areas shown on every page and used by the Call, WhatsApp and Email buttons.',
      '<button class="btn btn-plasma" type="submit" form="dform" id="dsave">Save details</button>') +
      (S.contactSaved ? '' : '<p class="banner">These are the values written in the website’s files. Saving them here makes this console the place to change them from now on.</p>') +
      '<form id="dform" class="eform one" autocomplete="off" novalidate><div class="ecol">' +
        '<section class="card"><div class="card-h"><h2>Reach us</h2></div><div class="fgrid">' +
          fld('Phone', 'phone', c.phone, { req: true, ph: '+91 99209 96608', hint: 'As visitors should see it.' }) +
          fld('WhatsApp number', 'whatsapp', c.whatsapp, { req: true, ph: '919920996608', hint: 'Country code and number, digits only.' }) +
          fld('Email', 'email', c.email, { req: true, type: 'email', wide: true, ph: 'name@example.com' }) +
        '</div></section>' +
        '<section class="card"><div class="card-h"><h2>Address</h2></div><div class="fgrid">' +
          fld('Line 1', 'a0', c.address[0], { wide: true }) + fld('Line 2', 'a1', c.address[1], { wide: true }) + fld('Line 3', 'a2', c.address[2], { wide: true }) +
          fld('Map search', 'mapQuery', c.mapQuery, { wide: true, hint: 'What Google Maps searches for on the Contact page: a place name, an address, or latitude,longitude.' }) +
        '</div></section>' +
        '<section class="card"><div class="card-h"><h2>Areas served</h2></div>' +
          '<ul class="achips" id="areas">' + c.serviceAreas.map(a => '<li><span>' + esc(a) + '</span><button type="button" data-act="area-del" aria-label="Remove ' + esc(a) + '">×</button></li>').join('') + '</ul>' +
          '<div class="row"><input id="newArea" class="grow" placeholder="Add a place, e.g. North Bengal" aria-label="New area"><button class="btn btn-ghost" type="button" data-act="area-add">' + I.plus + '<span>Add</span></button></div>' +
          '<p class="note">Shown as tags under the map on the Contact page.</p></section>' +
      '</div></form>' +
      '<p class="note after">The website’s HTML also carries a copy of the phone, email and address for search engines and link previews. When these change, update the pages’ <code>tel:</code>, <code>mailto:</code> and address text too (see the README).</p>';
  }
  function readDetails() {
    const f = $('#dform'), g = n => (f.elements[n].value || '').trim();
    return {
      phone: g('phone'), whatsapp: g('whatsapp').replace(/\D/g, ''), email: g('email'),
      address: [g('a0'), g('a1'), g('a2')].filter(Boolean), mapQuery: g('mapQuery'),
      serviceAreas: $$('#areas li span').map(s => s.textContent.trim()).filter(Boolean)
    };
  }
  async function saveDetails() {
    const c = readDetails(), f = $('#dform');
    $$('.fld.bad', f).forEach(x => x.classList.remove('bad'));
    const bad = [];
    if (!c.phone) bad.push('phone'); if (!c.whatsapp) bad.push('whatsapp');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(c.email)) bad.push('email');
    if (bad.length) { bad.forEach(n => f.elements[n].closest('.fld').classList.add('bad')); f.elements[bad[0]].focus(); toast('Please check the highlighted fields.', 'bad'); return; }
    const btn = $('#dsave'); btn.disabled = true;
    try {
      await store.saveContact(c);
      S.contact = c; S.contactSaved = true; S.dirty = false;
      $('.banner') && $('.banner').remove();
      toast(DEMO ? 'Saved. The website in this browser shows it now.' : 'Saved. It is live on the website.');
    } catch (err) { toast(err.message || 'Could not save', 'bad'); }
    btn.disabled = false;
  }

  /* ================================================================== router */
  let navId = 0, lastHash = '';
  async function route() {
    const my = ++navId;
    const parts = location.hash.replace(/^#\/?/, '').split('/').map(decodeURIComponent);
    const page = parts[0] || '', arg = parts[1] || '';
    $$('[data-nav]').forEach(a => a.classList.toggle('on', a.dataset.nav === page));
    const v = $('#view');
    v.innerHTML = loading;
    let html;
    try {
      html = page === 'products' ? (arg ? await vEditor(arg) : await vProducts())
        : page === 'enquiries' ? await vEnquiries(arg)
        : page === 'details' ? await vDetails()
        : await vDashboard();
    } catch (err) { html = fail(err); if (err && err.status === 401) return signedOut('Your session ended. Please sign in again.'); }
    if (my !== navId) return;
    v.innerHTML = html;
    v.scrollTop = 0; window.scrollTo(0, 0);
    document.title = ({ products: 'Products', enquiries: 'Enquiries', details: 'Site details' }[page] || 'Dashboard') + ' | Green Sun Console';
    if (page === 'products' && arg) { markDirty($('#pform')); }
    if (page === 'details') markDirty($('#dform'));
    lastHash = location.hash;
  }
  function markDirty(form) { if (form) form.addEventListener('input', () => { S.dirty = true; }); }
  window.addEventListener('hashchange', () => {
    if (!$('#view')) return;
    if (S.dirty && location.hash !== lastHash && !confirm('Leave this page? Your unsaved changes will be lost.')) { location.hash = lastHash; return; }
    S.dirty = false;
    route();
  });
  window.addEventListener('beforeunload', e => { if (S.dirty) { e.preventDefault(); e.returnValue = ''; } });

  /* ================================================================== events */
  document.addEventListener('click', async e => {
    const el = e.target.closest('[data-act]');
    if (!el) return;
    const act = el.dataset.act, id = el.dataset.id;
    try {
      if (act === 'signout') { await auth.signOut(); return signedOut(''); }
      if (act === 'reload' || act === 'refresh') { S.products = S.messages = null; return route(); }
      if (act === 'reset-demo') { if (await ask('Reset the demo?', 'This clears the demo products, contact details and enquiries kept in this browser. The website goes back to its own files.', 'Reset', true)) { store.reset(); S.products = S.messages = S.contact = null; toast('Demo data cleared.'); route(); } return; }
      if (act === 'import') {
        el.disabled = true; await store.importAll(); S.products = null; S.contact = null;
        toast('Catalogue imported. Every product is now editable here.'); return route();
      }
      if (act === 'cat') { S.pf.cat = el.dataset.cat; return rerenderProducts(); }
      if (act === 'clear-filter') { S.pf = { q: '', cat: '' }; return route(); }
      if (act === 'feature') {
        const p = S.products.find(x => x.id === id); p.featured = !p.featured; if (!p.featured) delete p.featured;
        await store.put(p, false); return rerenderProducts();
      }
      if (act === 'move') { await moveProduct(id, +el.dataset.dir); return rerenderProducts(); }
      if (act === 'pick-photo') return $('#pfile').click();
      if (act === 'spec-add') { $('#slist').insertAdjacentHTML('beforeend', specRow('', '')); S.dirty = true; return $('#slist li:last-child [data-sl]').focus(); }
      if (act === 'spec-del') { el.closest('.srow').remove(); S.dirty = true; return; }
      if (act === 'spec-up' || act === 'spec-down') {
        const row = el.closest('.srow'); S.dirty = true;
        if (act === 'spec-up' && row.previousElementSibling) row.parentNode.insertBefore(row, row.previousElementSibling);
        if (act === 'spec-down' && row.nextElementSibling) row.parentNode.insertBefore(row.nextElementSibling, row);
        return;
      }
      if (act === 'delete') {
        const p = S.edit.base;
        if (await ask('Delete “' + (p.short || p.name) + '”?', 'It disappears from the website for good. To keep it but hide it from visitors, switch off Visible instead.', 'Delete product', true)) {
          await store.remove(p.id); S.products = null; S.dirty = false; toast('Deleted.'); location.hash = '#/products';
        }
        return;
      }
      if (act === 'area-add') return addArea();
      if (act === 'area-del') { el.closest('li').remove(); S.dirty = true; return; }
      if (act === 'etab') { S.ef = el.dataset.t; return route(); }
      if (act === 'mstatus' || act === 'mstar' || act === 'mdelete') return messageAction(act, id, el);
    } catch (err) { toast(err.message || 'Something went wrong', 'bad'); if (el) el.disabled = false; }
  });
  document.addEventListener('change', async e => {
    const t = e.target;
    try {
      if (t.matches('[data-act="visible"]')) {
        const p = S.products.find(x => x.id === t.dataset.id); p.hidden = !t.checked;
        await store.patch(p.id, { hidden: p.hidden });
        toast(p.hidden ? 'Hidden from the website.' : 'Visible on the website.'); return rerenderProducts();
      }
      if (t.id === 'pfile' && t.files[0]) {
        toast('Uploading…');
        const url = await store.upload(t.files[0]);
        const f = $('#pform'); f.elements.img.value = url; S.dirty = true; paintPhoto();
        toast('Photo ready. Press Save product to keep it.'); t.value = '';
      }
    } catch (err) { toast(err.message || 'Could not upload', 'bad'); }
  });
  document.addEventListener('input', e => {
    const t = e.target;
    if (t.id === 'pq') { S.pf.q = t.value; $('#plist').innerHTML = productRows(); }
    else if (t.id === 'eq') { S.eq = t.value; $('#mlist').innerHTML = msgList((location.hash.split('/')[2]) || ''); }
    else if (t.name === 'img') paintPhoto();
    else if (t.name === 'blueprint') { const b = $('#pimg'); if (b) b.classList.toggle('bp', t.checked); }
    else if (t.name === 'name' && S.edit && S.edit.isNew && $('#pform') && !$('#pform').elements.id.dataset.touched) $('#pform').elements.id.value = slug(t.value);
    else if (t.name === 'id') t.dataset.touched = '1';
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Enter' && e.target.id === 'newArea') { e.preventDefault(); addArea(); }
  });
  document.addEventListener('submit', e => {
    // matches(), not .id: a form with an input named "id" returns that input for form.id
    if (e.target.matches('#pform')) { e.preventDefault(); saveProduct(); }
    else if (e.target.matches('#dform')) { e.preventDefault(); saveDetails(); }
  });

  function rerenderProducts() {
    const l = $('#plist'); if (!l) return;
    l.innerHTML = productRows();
    $$('.fchip[data-act="cat"]').forEach(b => b.classList.toggle('on', b.dataset.cat === S.pf.cat));
    $$('.fchip[data-act="cat"] b').forEach(b => { const c = b.parentNode.dataset.cat; b.textContent = c ? S.products.filter(p => p.cat === c).length : S.products.length; });
  }
  function paintPhoto() {
    const f = $('#pform'), box = $('#pimg'); if (!f || !box) return;
    const u = f.elements.img.value.trim();
    box.innerHTML = u ? '<img src="' + esc(imgSrc(u)) + '" alt="">' : '<span class="nophoto">' + I.sun + '<small>No photo yet</small></span>';
  }
  async function moveProduct(id, dir) {
    const list = S.products, i = list.findIndex(p => p.id === id);
    if (i < 0) return;
    let j = i + dir;
    while (list[j] && list[j].cat !== list[i].cat) j += dir;     // swap with the neighbour in the same category
    if (!list[j]) return;
    const t = list[i]; list[i] = list[j]; list[j] = t;
    for (let n = 0; n < list.length; n++) {
      if (list[n].sort !== n) { list[n].sort = n; await store.patch(list[n].id, { sort: n }); }
    }
  }
  function addArea() {
    const inp = $('#newArea'), v = inp.value.trim();
    if (!v) return inp.focus();
    const li = document.createElement('li');
    li.innerHTML = '<span>' + esc(v) + '</span><button type="button" data-act="area-del" aria-label="Remove ' + esc(v) + '">×</button>';
    $('#areas').appendChild(li);
    inp.value = ''; inp.focus(); S.dirty = true;
  }
  async function messageAction(act, id, el) {
    const m = S.messages.find(x => x.id === id); if (!m) return;
    if (act === 'mdelete') {
      if (!(await ask('Delete this enquiry?', 'Enquiry from ' + m.name + ' is removed for good. Archive it instead to keep a record.', 'Delete', true))) return;
      await store.removeMessage(id); S.messages = S.messages.filter(x => x.id !== id); toast('Deleted.'); location.hash = '#/enquiries'; return;
    }
    const patch = act === 'mstar' ? { starred: !m.starred } : { status: el.dataset.s };
    await store.patchMessage(id, patch); Object.assign(m, patch);
    if (act === 'mstatus' && patch.status === 'archived') { toast('Archived.'); location.hash = '#/enquiries'; return; }
    route();
  }

  /* ================================================================== sign-in screens */
  function signedOut(msg) { S.products = S.messages = S.contact = null; S.dirty = false; location.hash = ''; viewLogin(msg); }

  function viewLogin(msg) {
    app.innerHTML = '<main class="login"><div class="glow" aria-hidden="true"></div>' +
      '<form class="lcard" id="lform" novalidate><img class="llogo" src="../assets/brand/gs-lockup-dark.svg" alt="Green Sun Technologies">' +
      '<p class="eyebrow"><i></i>Console</p><h1>Sign in to <em>run the site.</em></h1>' +
      (DEMO ? '<p class="demo-note"><b>Demo mode.</b> No database is connected, so any email and password opens the console. Changes stay in this browser and show on the website here. See the README to connect Supabase.</p>' : '<p class="sub">Products, contact details and enquiries for the Green Sun website.</p>') +
      '<label class="fld"><span>Email</span><input name="email" type="email" autocomplete="username" required autofocus value="' + (DEMO ? 'owner@greensun.example' : '') + '"></label>' +
      '<label class="fld"><span>Password</span><input name="password" type="password" autocomplete="current-password" required value="' + (DEMO ? 'demo' : '') + '"></label>' +
      '<p class="err" id="lerr" role="alert">' + esc(msg || '') + '</p>' +
      '<button class="btn btn-plasma full" type="submit" id="lgo">Sign in</button>' +
      (DEMO ? '' : '<button class="linkbtn" type="button" id="lforgot">Forgot your password?</button>') +
      '<a class="back" href="../index.html">← Back to the website</a></form></main><div id="toasts" class="toasts" role="status" aria-live="polite"></div>';
    const f = $('#lform'), err = $('#lerr');
    f.addEventListener('submit', async e => {
      e.preventDefault();
      const btn = $('#lgo'); btn.disabled = true; btn.textContent = 'Signing in…'; err.textContent = '';
      try {
        await auth.signIn(f.elements.email.value.trim(), f.elements.password.value);
        if (!(await auth.resume())) throw new Error(auth.denied ? 'That account is not on the admin list.' : 'Could not sign in.');
        start();
      } catch (ex) {
        err.textContent = /invalid login/i.test(ex.message) ? 'That email and password don’t match.' : ex.message;
        btn.disabled = false; btn.textContent = 'Sign in';
      }
    });
    const fg = $('#lforgot');
    if (fg) fg.addEventListener('click', async () => {
      const em = f.elements.email.value.trim();
      if (!em) { err.textContent = 'Type your email first, then press “Forgot your password?”.'; return; }
      try { await SBX.recover(em, location.origin + location.pathname); err.textContent = ''; toast('If that email has an account, a reset link is on its way.'); }
      catch (ex) { err.textContent = ex.message; }
    });
  }

  function viewSetPassword() {
    app.innerHTML = '<main class="login"><div class="glow" aria-hidden="true"></div><form class="lcard" id="pwform" novalidate><img class="llogo" src="../assets/brand/gs-lockup-dark.svg" alt="Green Sun Technologies">' +
      '<p class="eyebrow"><i></i>Console</p><h1>Choose a <em>new password.</em></h1>' +
      '<label class="fld"><span>New password</span><input name="p1" type="password" autocomplete="new-password" minlength="10" required autofocus></label>' +
      '<label class="fld"><span>Repeat it</span><input name="p2" type="password" autocomplete="new-password" required></label>' +
      '<p class="err" id="perr" role="alert"></p><button class="btn btn-plasma full" type="submit">Save password</button></form></main><div id="toasts" class="toasts"></div>';
    $('#pwform').addEventListener('submit', async e => {
      e.preventDefault();
      const f = e.target, err = $('#perr');
      if (f.p1.value.length < 10) { err.textContent = 'Use at least 10 characters.'; return; }
      if (f.p1.value !== f.p2.value) { err.textContent = 'The two passwords differ.'; return; }
      try { await SBX.updatePassword(f.p1.value); if (await auth.resume()) start(); else viewLogin('Password saved. Please sign in.'); }
      catch (ex) { err.textContent = ex.message; }
    });
  }

  /* ================================================================== shell */
  function start() {
    app.innerHTML =
      '<div class="shell"><aside class="side">' +
        '<a class="brand" href="#/"><img src="../assets/brand/gs-lockup-dark.svg" alt="Green Sun Technologies"><span class="tag">Console</span></a>' +
        '<nav class="nav" aria-label="Console">' +
          '<a href="#/" data-nav="">' + I.grid + '<span>Dashboard</span></a>' +
          '<a href="#/products" data-nav="products">' + I.box + '<span>Products</span></a>' +
          '<a href="#/enquiries" data-nav="enquiries">' + I.inbox + '<span>Enquiries</span><b class="badge" id="badge" hidden></b></a>' +
          '<a href="#/details" data-nav="details">' + I.sliders + '<span>Site details</span></a>' +
        '</nav>' +
        '<div class="side-foot">' +
          '<a class="btn btn-ghost btn-sm full" href="../index.html" target="_blank" rel="noopener">' + I.out + '<span>View website</span></a>' +
          '<div class="who"><span class="mode ' + (DEMO ? 'demo' : 'live') + '"><i></i>' + (DEMO ? 'Demo mode' : 'Live database') + '</span><small>' + esc(auth.user && auth.user.email || '') + '</small></div>' +
          '<button class="linkbtn" data-act="signout">' + I.logout + '<span>Sign out</span></button>' +
        '</div></aside>' +
        '<header class="mtop"><img src="../assets/brand/gs-mark.svg" alt="" width="28" height="28"><b>Console</b><span class="mode ' + (DEMO ? 'demo' : 'live') + '"><i></i>' + (DEMO ? 'Demo' : 'Live') + '</span><button class="linkbtn" data-act="signout" aria-label="Sign out">' + I.logout + '</button></header>' +
        '<main class="main"><div id="view" class="view" tabindex="-1"></div></main></div>' +
      '<div id="toasts" class="toasts" role="status" aria-live="polite"></div>';
    refreshBadge();
    route();
  }

  // a session lasts a set number of hours (config.js sessionHours, default 6); the badge also refreshes on a timer
  setInterval(() => {
    if (!auth.user) return;
    if (!DEMO && SBX.timedOut()) { auth.signOut().then(() => signedOut('Your session ended after ' + SBX.limitHours + ' hours. Please sign in again.')); return; }
    refreshBadge();
  }, 60000);
  window.addEventListener('focus', () => { if (auth.user) refreshBadge(); });

  /* ------------------------------------------------------------------ go */
  (async function boot() {
    document.documentElement.classList.add('js');
    const fromLink = DEMO ? null : SBX.fromHash();
    if (fromLink && fromLink.type === 'recovery') return viewSetPassword();
    if (await auth.resume()) return start();
    viewLogin(fromLink && fromLink.error ? fromLink.error : auth.denied ? 'That account is not on the admin list.' : SBX.endedByClose ? 'You were signed out because the tab was closed.' : '');
  })();
})();
