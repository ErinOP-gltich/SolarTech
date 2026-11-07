// The site is shown at 90% on every screen, as if the browser were zoomed out (the client's choice).
// Run by deploy.sh on the upload copy: every length over 1.5px in the given stylesheets becomes calc(N * var(--px)), and
// gs.css sets --px to .9px. Viewport units and
// hairlines stay as they are, which is what browser zoom does too. Real CSS pixels, so scripts that measure the page
// (the hero beam, ScrollTrigger, Flip) need no changes, unlike CSS zoom.
//   node scale.mjs assets/css/*.css
import { readFileSync, writeFileSync } from 'node:fs';

function scale(css) {
  let out = '', i = 0;
  const n = css.length;
  while (i < n) {
    const c = css[i];
    if (c === '/' && css[i + 1] === '*') { const j = css.indexOf('*/', i + 2); const e = j < 0 ? n : j + 2; out += css.slice(i, e); i = e; continue; }
    if (c === '"' || c === "'") { let j = i + 1; while (j < n && css[j] !== c) j += css[j] === '\\' ? 2 : 1; out += css.slice(i, j + 1); i = j + 1; continue; }
    if (css.startsWith('url(', i) && css[i + 4] !== '"' && css[i + 4] !== "'") { const j = css.indexOf(')', i); out += css.slice(i, j + 1); i = j + 1; continue; }
    if (c === '@') { // at-rule preludes (@media widths, @supports) keep real pixels
      let j = i; while (j < n && css[j] !== '{' && css[j] !== ';') j++;
      out += css.slice(i, j); i = j; continue;
    }
    const m = /^(-?)(\d*\.?\d+)px(?![\w-])/.exec(css.slice(i, i + 24));
    if (m && !/[\w.#-]/.test(css[i - 1] || ' ')) {
      const v = parseFloat(m[2]);
      out += v > 1.5 ? 'calc(' + m[1] + m[2] + '*var(--px))' : m[0];
      i += m[0].length; continue;
    }
    out += c; i++;
  }
  return out;
}

for (const f of process.argv.slice(2)) {
  const before = readFileSync(f, 'utf8'), after = scale(before);
  writeFileSync(f, after);
  console.log(`scale: ${f} ${(after.match(/\*var\(--px\)/g) || []).length} lengths`);
}
