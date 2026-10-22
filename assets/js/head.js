/* Runs in <head>, before the page paints (a file rather than an inline script, so the Content-Security-Policy
   can stay script-src 'self'): mark that JS is on, and make a refresh open at the top. A refresh turns the browser's
   scroll restoring off and drops any #section left in the address so the browser doesn't jump there (the marketplace
   reads GS_RELOAD_HASH to keep its category filter); Back and Forward keep the browser's restoring, so a visitor
   returns to where they were. main.js reads GS_NAV. */
document.documentElement.classList.add('js');
try {
  var n = performance.getEntriesByType && performance.getEntriesByType('navigation')[0];
  var pn = performance.navigation;
  window.GS_NAV = n ? n.type : pn && pn.type === 1 ? 'reload' : pn && pn.type === 2 ? 'back_forward' : 'navigate';
  if ('scrollRestoration' in history) history.scrollRestoration = window.GS_NAV === 'reload' ? 'manual' : 'auto';
  if (location.hash && window.GS_NAV === 'reload') {
    window.GS_RELOAD_HASH = location.hash;
    history.replaceState(null, '', location.pathname + location.search);
  }
} catch (e) { /* old browsers: the page still works, a refresh just keeps its place */ }
