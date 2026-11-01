// Product photos uploaded in the console live in the R2 bucket and are served from /media/products/<file>.
export async function onRequestGet({ env, params }) {
  const key = [].concat(params.path || []).join('/');
  if (!/^products\/[a-z0-9._-]+$/.test(key)) return new Response('Not found', { status: 404 });
  const obj = await env.MEDIA.get(key);
  if (!obj) return new Response('Not found', { status: 404 });
  return new Response(obj.body, {
    headers: {
      'content-type': (obj.httpMetadata && obj.httpMetadata.contentType) || 'application/octet-stream',
      'cache-control': 'public, max-age=31536000, immutable',     // every upload gets a new name, so it never changes
      'x-content-type-options': 'nosniff'
    }
  });
}
