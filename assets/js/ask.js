/* Ask AI: the floating button on every page and its chat panel. Answers come from /api/ask (Cloudflare Workers AI).
   The conversation is kept for this browser tab (sessionStorage), so it follows the visitor from page to page.
   Other scripts open it with window.GSAsk.open('a question'). */
(function () {
  const GS = window.GS, esc = GS.esc, CFG = GS.config, KEY = 'gs-ask', MAX = 24;
  const lite = function () { return GS.reduceMotion; };   // the typed-out answer is cheap: only "reduce motion" skips it
  let msgs = [];
  try { msgs = JSON.parse(sessionStorage.getItem(KEY)) || []; if (!Array.isArray(msgs)) msgs = []; } catch (e) { msgs = []; }
  const save = function () { try { sessionStorage.setItem(KEY, JSON.stringify(msgs.slice(-MAX))); } catch (e) { /* private mode */ } };
  const svg = function (d, w) { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="' + (w || 2) + '" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + '</svg>'; };
  const IC = {
    road: '<path d="M4 21 9 3M20 21 15 3M12 5v2M12 11v2M12 17v2"/>',
    battery: '<rect x="3" y="7" width="16" height="10" rx="2"/><path d="M21 11v2M7 10v4M11 10v4"/>',
    pin: '<path d="M12 22c5-4 8-8 8-12a8 8 0 0 0-16 0c0 4 3 8 8 12z"/><circle cx="12" cy="10" r="3"/>',
    mast: '<path d="M12 22V6M8 22h8M6 6h12M7 3h2M11 3h2M15 3h2M7 6l-1 3M17 6l1 3"/>',
    plus: '<path d="M12 5v14M5 12h14"/>', x: '<path d="M6 6l12 12M18 6 6 18"/>', send: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h8"/>', tick: '<path d="M5 12l5 5 9-10"/>',
    wa: '<path d="M4 20l1.3-3.9A8 8 0 1 1 8 19.3z"/>', call: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/>'
  };
  const SUGGEST = [
    ['road', 'Which light for a 2-lane village road?'], ['battery', 'How long does the battery last in the monsoon?'],
    ['pin', 'Do you deliver outside Assam?'], ['mast', 'What does a high mast for a playground need?']
  ];
  const ORB = '<span class="ask-orb" aria-hidden="true"><i></i><i></i><i></i></span>';

  const fab = document.createElement('button');
  fab.type = 'button'; fab.className = 'ask-fab sl'; fab.setAttribute('aria-expanded', 'false'); fab.setAttribute('aria-controls', 'ask');
  fab.innerHTML = '<span class="state" aria-hidden="true"></span>' + ORB + '<span class="ask-fab-t">Ask AI</span>';
  const box = document.createElement('section');
  box.className = 'ask'; box.id = 'ask'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-labelledby', 'ask-h'); box.hidden = true;
  box.innerHTML =
    '<div class="ask-in"><div class="ask-aura" aria-hidden="true"><i></i><i></i><i></i></div>' +
    '<header class="ask-head">' + ORB + '<div class="ask-id"><h2 id="ask-h">Sun AI</h2><p><i class="ask-on"></i>Online · answers in seconds</p></div>' +
    '<button type="button" class="ask-ib sl" data-new aria-label="New chat" title="New chat"><span class="state" aria-hidden="true"></span>' + svg(IC.plus) + '</button>' +
    '<button type="button" class="ask-ib sl" data-x aria-label="Close" title="Close"><span class="state" aria-hidden="true"></span>' + svg(IC.x) + '</button></header>' +
    '<div class="ask-log" data-log data-lenis-prevent role="log" aria-live="polite"></div>' +
    '<div class="ask-quick" data-lenis-prevent><a href="planner" class="sl"><span class="state" aria-hidden="true"></span>' + svg(IC.road) + 'Plan my road</a>' +
    '<a href="https://wa.me/' + esc(CFG.whatsapp) + '" target="_blank" rel="noopener" class="sl"><span class="state" aria-hidden="true"></span>' + svg(IC.wa) + 'WhatsApp</a>' +
    '<a href="tel:+' + esc(CFG.whatsapp) + '" class="sl"><span class="state" aria-hidden="true"></span>' + svg(IC.call) + 'Call</a></div>' +
    '<form class="ask-form" data-form><label class="sr-only" for="ask-q">Your question</label>' +
    '<textarea id="ask-q" rows="1" maxlength="1000" placeholder="Ask about lights, roads, batteries…" enterkeyhint="send"></textarea>' +
    '<button type="submit" class="ask-send sl" aria-label="Send"><span class="state" aria-hidden="true"></span>' + svg(IC.send, 2.4) + '</button></form>' +
    '<p class="ask-fine">AI can get things wrong. For a firm price, <a href="contact">ask us for a quote</a>.</p></div>';
  document.body.append(fab, box);
  const log = box.querySelector('[data-log]'), form = box.querySelector('[data-form]'), q = box.querySelector('textarea');

  // a little formatting from plain text: paragraphs, "- " lists, **bold**, and links to our own pages
  function fmt(t) {
    const inline = function (s) {
      return esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
        .replace(/(^|[\s(])\/(planner|products|projects|factory|contact)\b/g, '$1<a href="$2">/$2</a>');
    };
    return t.split(/\n{2,}/).map(function (blk) {
      const lines = blk.split('\n');
      if (lines.every(function (l) { return /^\s*([-*•]|\d+[.)])\s+/.test(l); })) return '<ul>' + lines.map(function (l) { return '<li>' + inline(l.replace(/^\s*([-*•]|\d+[.)])\s+/, '')) + '</li>'; }).join('') + '</ul>';
      return '<p>' + lines.map(inline).join('<br>') + '</p>';
    }).join('');
  }
  const AI_HEAD = '<p class="ask-who">' + ORB + '<b>Sun AI</b></p>';
  function bubble(m, i) {
    if (m.role === 'user') return '<div class="ask-m is-user"><div class="ask-b">' + esc(m.content) + '</div></div>';
    return '<div class="ask-m is-ai">' + AI_HEAD + '<div class="ask-b">' + fmt(m.content) + '</div>' +
      '<button type="button" class="ask-copy" data-copy="' + i + '">' + svg(IC.copy) + '<span>Copy</span></button></div>';
  }
  function paint() {
    log.innerHTML = msgs.length ? msgs.map(bubble).join('') :
      '<div class="ask-hello"><span class="ask-orb is-xl" aria-hidden="true"><i></i><i></i><i></i></span>' +
      '<h3>How can I light up<br><span>your road?</span></h3><p>Ask which light suits a road, how the batteries hold up in the monsoon, or what a high mast needs.</p>' +
      '<div class="ask-sug">' + SUGGEST.map(function (s) { return '<button type="button" class="sl" data-sug><span class="state" aria-hidden="true"></span><span class="ic">' + svg(s[0] === 'road' ? IC.road : IC[s[0]], 1.8) + '</span><span class="t">' + esc(s[1]) + '</span></button>'; }).join('') + '</div></div>';
    log.scrollTop = log.scrollHeight;
  }
  // the newest answer types itself out, then settles into its formatted form
  function typeOut(el, text, done) {
    if (lite()) { done(); return; }
    let n = 0; const step = Math.max(2, Math.round(text.length / 90));
    (function tick() {
      n = Math.min(text.length, n + step);
      el.textContent = text.slice(0, n); el.insertAdjacentHTML('beforeend', '<i class="ask-caret"></i>');
      log.scrollTop = log.scrollHeight;
      if (n < text.length) requestAnimationFrame(tick); else done();
    })();
  }

  let busy = false;
  function send(text) {
    text = (text || '').trim();
    if (!text || busy) return;
    msgs.push({ role: 'user', content: text.slice(0, 1000) }); save(); paint();
    busy = true; box.classList.add('is-busy');
    log.insertAdjacentHTML('beforeend', '<div class="ask-m is-ai is-typing" data-typing>' + AI_HEAD + '<div class="ask-b"><span class="ask-dots"><i></i><i></i><i></i></span><span class="ask-think">Thinking</span></div></div>');
    log.scrollTop = log.scrollHeight;
    fetch('/api/ask', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages: msgs.slice(-10) }) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (b) { if (!r.ok || !b.reply) throw new Error(b.error || 'failed'); return b.reply; }); })
      .then(function (reply) {
        const t = log.querySelector('[data-typing]');
        const b = t.querySelector('.ask-b'); t.classList.remove('is-typing'); t.removeAttribute('data-typing');
        typeOut(b, reply, function () { msgs.push({ role: 'assistant', content: reply }); save(); paint(); });
      })
      .catch(function (e) {
        const t = log.querySelector('[data-typing]'); if (t) t.remove();
        log.insertAdjacentHTML('beforeend', '<div class="ask-m is-ai is-err">' + AI_HEAD + '<div class="ask-b"><p>' + esc(/^[A-Z]/.test(e.message) ? e.message : 'I couldn’t answer just now.') +
          ' <a href="https://wa.me/' + esc(CFG.whatsapp) + '?text=' + encodeURIComponent(text) + '" target="_blank" rel="noopener">Ask on WhatsApp instead</a>.</p></div></div>');
        log.scrollTop = log.scrollHeight;
      })
      .then(function () { busy = false; box.classList.remove('is-busy'); });
  }

  const phone = matchMedia('(max-width: 640px)');
  function open(text) {
    if (box.hidden) {
      paint(); box.hidden = false; fab.setAttribute('aria-expanded', 'true');
      requestAnimationFrame(function () { box.classList.add('is-open'); });
      if (phone.matches && GS.lenis) GS.lenis.stop();
      document.documentElement.classList.add('ask-up');
    }
    if (text) send(text); else if (!phone.matches) q.focus({ preventScroll: true });
  }
  function close() {
    box.classList.remove('is-open'); fab.setAttribute('aria-expanded', 'false');
    document.documentElement.classList.remove('ask-up');
    if (GS.lenis) GS.lenis.start();
    setTimeout(function () { if (!box.classList.contains('is-open')) box.hidden = true; }, 420);
    fab.focus({ preventScroll: true });
  }
  fab.addEventListener('click', function () { if (box.hidden) open(); else close(); });
  box.addEventListener('click', function (e) {
    if (e.target.closest('[data-x]')) close();
    if (e.target.closest('[data-new]')) { msgs = []; save(); paint(); q.focus(); }
    const s = e.target.closest('[data-sug]'); if (s) send(s.querySelector('.t').textContent);
    const c = e.target.closest('[data-copy]');
    if (c && navigator.clipboard) navigator.clipboard.writeText(msgs[+c.dataset.copy].content).then(function () {
      c.innerHTML = svg(IC.tick) + '<span>Copied</span>'; setTimeout(function () { c.innerHTML = svg(IC.copy) + '<span>Copy</span>'; }, 1600);
    }).catch(function () { /* clipboard blocked */ });
  });
  box.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
  form.addEventListener('submit', function (e) { e.preventDefault(); const t = q.value; q.value = ''; q.style.height = ''; send(t); });
  q.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); form.requestSubmit(); } });
  q.addEventListener('input', function () { q.style.height = ''; q.style.height = Math.min(q.scrollHeight, 140) + 'px'; });

  window.GSAsk = { open: open };
})();
