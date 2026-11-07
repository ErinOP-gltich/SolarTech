/* The old GitHub Pages copy sends people to the real address (search engines already see the canonical links). */
if (location.hostname === 'erinop-gltich.github.io') location.replace('https://greensuntechnologies.com' + location.pathname.replace(/^\/SolarTech/i, '') + location.search + location.hash);
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

/* Lite: Android phones short on cores, any device short on memory, Data Saver, or a device that couldn't keep up on an earlier
   visit (main.js measures the frame rate and remembers a slow result for three days) get the light version: the painted
   hero instead of the live one, no live blur, native scrolling. Decided here so the first paint is already light. */
(function () {
  // (cores are only counted where the browser also reports memory, i.e. Chromium: Safari's core count isn't reliable,
  // and iPhones are left to the frame-rate check)
  var nv = navigator, c = nv.connection, lite = (c && c.saveData) || (nv.deviceMemory && (nv.deviceMemory <= 2 ||
    (nv.hardwareConcurrency && nv.hardwareConcurrency <= 4 && window.matchMedia && matchMedia('(pointer: coarse)').matches)));
  try { lite = lite || Date.now() - (+localStorage.getItem('gs-lite') || 0) < 3 * 864e5; } catch (e) { /* storage blocked */ }
  if (lite) document.documentElement.classList.add('lite');
})();

/* Theme: light ("Daylight") unless the visitor chose dark with the nav button. Set here, before first paint, so there is no flash. */
try { document.documentElement.dataset.theme = localStorage.getItem('gs-theme') === 'dark' ? 'dark' : 'light'; } catch (e) { document.documentElement.dataset.theme = 'light'; }
