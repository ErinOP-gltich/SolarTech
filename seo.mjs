// Search-engine data that follows the catalogue: the product catalogue as JSON-LD inside products.html (between the
// <!--LD:catalogue--> markers) and sitemap.xml with the product photos. Run by deploy.sh; safe to run any time: node seo.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import vm from 'node:vm';
const SITE = 'https://greensuntechnologies.com/';
const ctx = { window: {} }; vm.createContext(ctx); vm.runInContext(readFileSync('assets/js/products.js', 'utf8'), ctx);
const { GS_PRODUCTS: P, GS_CATEGORIES: C } = ctx.window;
const cat = id => (C.find(c => c.id === id) || {}).name || '';
const spec = (p, k) => (p.specs || []).find(s => s[0] === k);
const describe = p => [p.name + ' by Green Sun Technologies, Guwahati.', p.battery && 'Battery ' + p.battery + (p.chem ? ' ' + p.chem : '') + '.', p.panel && 'Solar panel ' + p.panel + '.', p.ip && p.ip + '.', p.autonomy && p.autonomy + ' backup.'].filter(Boolean).join(' ');
const props = p => [['Power', p.watt ? p.watt + ' W' : null], ['Battery', p.battery], ['Chemistry', p.chem], ['Solar panel', p.panel], ['Optic', p.optic], ['Ingress protection', p.ip], ['Autonomy', p.autonomy]]
  .filter(x => x[1]).map(([name, value]) => ({ '@type': 'PropertyValue', name, value: String(value) }));
const ld = {
  '@context': 'https://schema.org',
  '@graph': [
    { '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: SITE },
      { '@type': 'ListItem', position: 2, name: 'Marketplace', item: SITE + 'products.html' }] },
    { '@type': 'OfferCatalog', '@id': SITE + 'products.html#catalogue', name: 'Green Sun Technologies product catalogue', url: SITE + 'products.html',
      numberOfItems: P.length, seller: { '@id': SITE + '#business' },
      itemListElement: P.map((p, i) => ({ '@type': 'Offer', position: i + 1, availability: 'https://schema.org/InStock', areaServed: 'IN',
        itemOffered: { '@type': 'Product', name: p.name, sku: p.part || p.id, mpn: p.part || undefined, category: cat(p.cat),
          image: SITE + p.img, description: describe(p), brand: { '@type': 'Brand', name: 'Green Sun Technologies' },
          manufacturer: { '@id': SITE + '#business' }, additionalProperty: props(p) } })) }
  ]
};
let html = readFileSync('products.html', 'utf8');
const block = '<!--LD:catalogue-->\n  <script type="application/ld+json">\n' + JSON.stringify(ld, null, 1) + '\n  </script>\n  <!--/LD:catalogue-->';
html = /<!--LD:catalogue-->[\s\S]*?<!--\/LD:catalogue-->/.test(html) ? html.replace(/<!--LD:catalogue-->[\s\S]*?<!--\/LD:catalogue-->/, block) : html.replace('</head>', '  ' + block + '\n</head>');
writeFileSync('products.html', html);
const today = new Date().toISOString().slice(0, 10);
const img = p => `    <image:image><image:loc>${SITE + p.img}</image:loc><image:title>${p.name.replace(/&/g, '&amp;')}</image:title></image:image>`;
const photos = [...new Map(P.filter(p => !/\.svg$/.test(p.img)).map(p => [p.img, p])).values()];
writeFileSync('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
  <url><loc>${SITE}</loc><lastmod>${today}</lastmod><changefreq>monthly</changefreq><priority>1.0</priority></url>
  <url><loc>${SITE}products.html</loc><lastmod>${today}</lastmod><changefreq>weekly</changefreq><priority>0.9</priority>
${photos.map(img).join('\n')}
  </url>
  <url><loc>${SITE}contact.html</loc><lastmod>${today}</lastmod><changefreq>yearly</changefreq><priority>0.7</priority></url>
</urlset>
`);
console.log('seo: catalogue of', P.length, 'products, sitemap with', photos.length, 'photos');
