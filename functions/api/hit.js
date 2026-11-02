// One page view, counted without cookies: the admin console's Visitors page reads these rows.
// A visitor is a daily hash of (secret salt + day + IP + browser) that cannot be reversed or linked from one day to the
// next. Bots, automation and other sites' requests are left out. Rows older than 400 days are pruned now and then.
const BOT = /bot|crawl|spider|slurp|preview|facebookexternalhit|whatsapp|telegram|headless|lighthouse|pagespeed|monitor|curl|wget|python|httpclient|axios|node-fetch/i;
const hex = buf => Array.from(new Uint8Array(buf), b => b.toString(16).padStart(2, '0')).join('');

export async function onRequestPost({ request, env }) {
  const none = new Response(null, { status: 204 });
  const ua = request.headers.get('user-agent') || '';
  const origin = request.headers.get('origin');
  if (!ua || BOT.test(ua) || (origin && new URL(origin).host !== new URL(request.url).host)) return none;
  let b = {};
  try { b = JSON.parse((await request.text()).slice(0, 2000)); } catch (e) { return none; }
  const path = (String(b.p || '/').replace(/[^\w\-./]/g, '').slice(0, 120)) || '/';
  const ref = String(b.r || '').toLowerCase().replace(/^www\./, '').replace(/[^a-z0-9.\-]/g, '').slice(0, 80) || null;
  const country = (request.cf && request.cf.country) || null;
  const device = /iPad|Tablet/i.test(ua) ? 'tablet' : /Mobi|Android|iPhone/i.test(ua) ? 'mobile' : 'desktop';
  const day = new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10);          // the day in India
  const ip = request.headers.get('cf-connecting-ip') || '';
  const vh = hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode((env.STATS_SALT || 'green-sun') + day + ip + ua))).slice(0, 16);
  await env.DB.prepare('INSERT INTO hits (day, path, ref, country, device, vh) VALUES (?1, ?2, ?3, ?4, ?5, ?6)')
    .bind(day, path, ref, country, device, vh).run();
  if (Math.random() < 0.01) await env.DB.prepare("DELETE FROM hits WHERE day < date('now', '-400 days')").run();
  return none;
}
