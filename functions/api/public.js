// What the website shows: visible products in order, and the contact details the console saved.
// Read-only. Hidden products never leave the database.
export async function onRequestGet({ env }) {
  const [p, s] = await env.DB.batch([
    env.DB.prepare('SELECT id, data FROM products WHERE hidden = 0 ORDER BY sort, id'),
    env.DB.prepare("SELECT data FROM settings WHERE key = 'contact'")
  ]);
  const body = {
    products: p.results.map(r => Object.assign(JSON.parse(r.data), { id: r.id })),
    config: s.results[0] ? JSON.parse(s.results[0].data) : null
  };
  return new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=10' } });
}
