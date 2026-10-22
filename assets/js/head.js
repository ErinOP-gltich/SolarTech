/* Runs in <head>, before the page paints (a file rather than an inline script, so the Content-Security-Policy
   can stay script-src 'self'): mark that JS is on, and make a refresh open at the top. A refresh drops any
   #section left in the address so the browser doesn't jump there; the marketplace reads GS_RELOAD_HASH to keep
   its category filter. */
document.documentElement.classList.add('js');
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
try {
  var n = performance.getEntriesByType && performance.getEntriesByType('navigation')[0];
  if (location.hash && (n ? n.type === 'reload' : performance.navigation && performance.navigation.type === 1)) {
    window.GS_RELOAD_HASH = location.hash;
    history.replaceState(null, '', location.pathname + location.search);
  }
} catch (e) { /* old browsers: the page still works, a refresh just keeps the #section */ }
