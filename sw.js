// Green Sun Technologies service worker: lets the website be installed as an app ("Get the app") and opens the last
// copy of a page when the phone is offline. /api/* always goes to the network (live products, enquiries, Ask AI);
// everything else is network-first, with the last copy kept per address (the ?v= stamp ignored) for offline use.
const SHELL = 'gs-site-1';
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(caches.keys()
  .then(ks => Promise.all(ks.filter(k => k !== SHELL).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', e => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== 'GET' || u.origin !== location.origin || /^\/(api|cdn-cgi)\//.test(u.pathname)) return;
  const key = u.origin + u.pathname;
  e.respondWith(fetch(r).then(res => {
    if (res.ok && res.type === 'basic') { const copy = res.clone(); caches.open(SHELL).then(c => c.put(key, copy)); }
    return res;
  }).catch(() => caches.match(key).then(m => m || (r.mode === 'navigate' ? caches.match(u.origin + '/') : null)).then(m => m || Response.error())));
});
