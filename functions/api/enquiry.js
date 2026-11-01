// The Contact page's "Send enquiry": adds one row to the console's inbox. Add-only: this site cannot read the inbox.
// Limits mirror the form: 5 enquiries an hour from one phone number, 40 an hour in all.
const reply = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
const text = (v, max) => (typeof v === 'string' && v.trim().length <= max ? v.trim() : null);

export async function onRequestPost({ request, env }) {
  const origin = request.headers.get('origin');
  if (origin && new URL(origin).host !== new URL(request.url).host) return reply(403, { error: 'Not allowed.' });

  const raw = await request.text();
  if (raw.length > 20000) return reply(413, { error: 'That is too large.' });
  let b; try { b = JSON.parse(raw); } catch (e) { return reply(400, { error: 'Not valid JSON.' }); }
  if (!b || typeof b !== 'object') return reply(400, { error: 'Not valid JSON.' });

  const name = text(b.name, 120), phone = text(b.phone, 40);
  const email = b.email ? text(b.email, 200) : '', org = b.org ? text(b.org, 200) : '', site = b.site ? text(b.site, 200) : '', message = b.message ? text(b.message, 5000) : '';
  if (!name || !phone || phone.length < 3) return reply(400, { error: 'Name and phone are required.' });
  if (email === null || org === null || site === null || message === null || (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))) return reply(400, { error: 'Please check the details.' });
  const products = (Array.isArray(b.products) ? b.products : []).slice(0, 50).map(x => ({
    id: String(x && x.id || '').slice(0, 64), name: String(x && x.name || '').slice(0, 200), part: String(x && x.part || '').slice(0, 80),
    qty: Math.min(99999, Math.max(1, parseInt(x && x.qty, 10) || 1))
  }));
  const productsJson = JSON.stringify(products);
  if (productsJson.length > 7900) return reply(413, { error: 'That is too large.' });

  const since = new Date(Date.now() - 3600e3).toISOString();
  const n = await env.DB.prepare('SELECT (SELECT COUNT(*) FROM messages WHERE phone = ?1 AND at > ?2) AS mine, (SELECT COUNT(*) FROM messages WHERE at > ?2) AS total')
    .bind(phone, since).first();
  if (n.mine >= 5 || n.total >= 40) return reply(429, { error: 'Too many enquiries right now. Please try again later, or call us.' });

  await env.DB.prepare('INSERT INTO messages (id, at, name, phone, email, org, site, message, products) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)')
    .bind(crypto.randomUUID(), new Date().toISOString(), name, phone, email || null, org || null, site || null, message || null, productsJson).run();
  return reply(201, { ok: true });
}
