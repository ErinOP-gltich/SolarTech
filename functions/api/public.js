// What the website shows: visible products in order, the contact details, projects and factory photos the console saved.
// Read-only. Hidden products never leave the database.
export async function onRequestGet({ request, env, waitUntil }) {
  // one copy per minute at the edge, not a D1 query and two R2 reads per page view; console changes show within a minute
  const key = new Request(new URL('/api/public', request.url).toString());
  const hit = await caches.default.match(key);
  if (hit) return hit;
  const [p, s] = await env.DB.batch([
    env.DB.prepare('SELECT id, data FROM products WHERE hidden = 0 ORDER BY sort, id'),
    env.DB.prepare("SELECT key, data FROM settings WHERE key = 'contact'")
  ]);
  const set = {}; s.results.forEach(r => { set[r.key] = JSON.parse(r.data); });
  // projects and factory photos: JSON files the console keeps in R2 (data/projects.json, data/factory.json)
  if (env.MEDIA) await Promise.all(['projects', 'factory'].map(async k => { const o = await env.MEDIA.get('data/' + k + '.json'); if (o) set[k] = await o.json(); }));
  const body = {
    products: p.results.map(r => Object.assign(JSON.parse(r.data), { id: r.id })),
    config: set.contact || null,
    projects: set.projects && set.projects.list && set.projects.list.length ? set.projects.list : null,
    factory: set.factory && set.factory.media && set.factory.media.length ? set.factory.media : null
  };
  const res = new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=10, s-maxage=60' } });
  waitUntil(caches.default.put(key, res.clone()));
  return res;
}
