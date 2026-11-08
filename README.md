# Green Sun Technologies — website

A three-page website for **Green Sun Technologies** (Guwahati, Assam): solar street lights, high masts, flood lights, traffic and pedestrian systems, lithium battery packs and decorative poles.

**Live:** https://erinop-gltich.github.io/SolarTech/

Plain HTML, CSS and JavaScript. There is nothing to install or build. It is served by GitHub Pages from the `gh-pages` branch of this repository, so every push to `gh-pages` updates the live site within a minute or two.

| Page | What's on it |
|---|---|
| `index.html` | A loading screen where a solar street light powers on and its beam reveals the page, a hero in which a Green Sun street light hangs over a night road and its beam follows the pointer and lights up the headline, live "is the sun up in Guwahati?" status, a marquee driven by scroll speed, the company story, datasheet numbers, a scroll-driven 24-hour day/night demo, a pinned horizontal showroom, product families, a light finder, certifications, sectors and a street light switching on over the closing call to action |
| `products.html` | The marketplace: a rotary **wattage dial** for the street lights, then every product with search, category, power and feature filters, sorting, and a grid or spec-table view. **Enquire** goes to the Contact page with that product filled in, and **+** adds it to a quote list |
| `contact.html` | The quote list (with quantities), an enquiry form that sends through WhatsApp or email, phone/WhatsApp/email/address cards, the areas served, and a map |
| `planner.html` | **Road planner**: road type, length, lanes, lane width, layout (one side / parallel / zigzag) and pole spacing (typed or slid) in; the light, pole height, spacing, pole count and average lux out (`assets/js/plan.js`, tested by `node test/plan.test.mjs`), drawn as a 3D night road (three.js, `assets/js/planner.js`); add the result to the quote list or ask the AI about it |
| `projects.html` | **Projects**: a map of the work, filters and cards with photos and places. The examples in `assets/js/work-data.js` (marked Sample, never counted in the totals) show until the console saves real projects |
| `factory.html` | **Visit the factory**: the parts of a light, how one is made as a timeline, photos and videos (from the console, else samples) and a WhatsApp button to book a visit |

**On every page:** the **Ask AI** button (`assets/js/ask.js` → `functions/api/ask.js`, Cloudflare Workers AI; what it knows is written by `seo.mjs` into `functions/api/_brief.js` from the catalogue, contact details and the planner's rules; 20 questions an hour per visitor, 600 a day, counted in D1 `asks`), and the footer's **Pause motion** and **Lite mode** switches (Lite mode is chosen automatically on slow devices; the switch's choice wins and is remembered).

## Design system

"Solar Noir": void black, a plasma gradient (flare red → orange → sun yellow → white-hot) and electric volt green, set in Archivo Expanded, Instrument Serif italic, Geist and Geist Mono. Surfaces are Apple-style liquid glass (a tint with a specular highlight and rim light that follow the pointer; only the panels that float over moving things, such as the nav, are frosted); interaction follows Material 3 (shape scale, state layers, ripples, filter chips, segmented buttons, snackbar, motion tokens). Every colour, radius, spacing step, shadow and duration is a token at the top of `assets/css/gs.css`.

Animation uses GSAP (ScrollTrigger, SplitText, Flip) and Lenis smooth scrolling, both vendored in `assets/vendor/` so the site has no runtime CDN dependency. Everything degrades gracefully: without canvas the hero falls back to a painted CSS version of the scene, with *reduce motion* switched on the animations and smooth scrolling are off, and without JavaScript the content is still there.

### Light mode

A sun/moon button in the nav switches between the dark "Solar Noir" look and "Daylight": warm white paper, ink-black type, white cards with soft warm shadows, accents in the brand's deep orange and green. The choice is kept in `localStorage` and applied by `head.js` before first paint (so the loading screen is already in the right theme); the default is light. Every part has a daylight version: the loading and page-transition screen (the lamp drawn in ink on paper), the wattage dial (a brushed-aluminium instrument), the closing call to action, footer and menu. Two night scenes stay dark, as rounded panels set into the paper: the hero's night road and the 24-hour demo's sky; the nav turns into dark glass while it floats over them. The light theme is a second set of tokens, `html[data-theme="light"]`, at the bottom of `gs.css`, `loader.css` and `dial.css`.

### Size

The live site shows at 90% on every screen, as if the browser were zoomed out. `deploy.sh` runs `scale.mjs` on the upload copy, which writes every length in the stylesheets as `N × var(--px)`; `gs.css` sets `--px` to `.9px`. The source files keep plain pixels, so `npx wrangler pages dev .` shows 100%; `./deploy.sh build` makes the scaled copy to try locally.

### Speed

Scrolling stays smooth because almost nothing is re-blurred or repainted per frame: frosting (a live backdrop blur) only on the nav, the catalogue's command bar, the snackbar and the controls over the hero; the background glow stands still; no film-grain layer; and opening a product's full specifications slides a drawer out sideways instead of re-flowing the grid. The animated parts are written to stay off the main thread: the marquee is a CSS animation that scrolling only nudges, the pulse and scroll-cue animate transforms, the hero light redraws at 30 fps while nobody is aiming it, and ScrollTrigger re-measures once (debounced) instead of four times. **Lite mode** (`html.lite`) keeps slow devices smooth: phones with few cores, any device with little memory, and Data Saver get it before the first paint (`head.js`); any other device gets it as soon as it proves too slow, measured from the frame rate a moment after loading and during the first scroll (`main.js`, remembered for three days). Lite means the painted CSS hero instead of the live canvas, no live blur on any panel (solid backings instead), and native scrolling instead of Lenis. `deploy.sh` uploads minified CSS and JS, stamps every `?v=` with the deploy time, and `_headers` lets browsers keep CSS, JS and fonts for a year (photos for a week).

## Preview

```bash
npx wrangler pages dev . --port 8788
```

Then open http://localhost:8788. (Cloudflare serves the pages without `.html`, as `/products` and `/contact`, and the site links to them that way, so use Wrangler rather than a plain static server, which wouldn't find them.)

## Deploying

The site is on **Cloudflare Pages** (project `solartech`, `https://greensuntechnologies.com/`), uploaded directly rather than built from GitHub. To publish a change, run `./deploy.sh` in this folder (it needs `npx wrangler login` once). The old GitHub Pages copy at erinop-gltich.github.io/SolarTech/ still exists but is no longer the main site.

## Search engines

Titles and descriptions per page, `lang="en-IN"`, canonical links, Open Graph, and JSON-LD: the business (LocalBusiness with map, area served and contact point) and the website on the home page, the full catalogue (an OfferCatalog of the 18 products with photos, part numbers and specs) and breadcrumbs on the Products page, and the contact page. `seo.mjs` rebuilds the catalogue data and `sitemap.xml` (with the product photos) from `products.js` on every deploy. The old GitHub Pages address forwards visitors to greensuntechnologies.com.

Still to do by the owner: add the site to **Google Search Console** and **Bing Webmaster Tools** (verify with a DNS record in Cloudflare, then submit `https://greensuntechnologies.com/sitemap.xml`), and claim the business on **Google Business Profile** with the same name, address and phone as the site.

## Visitors

Each page view is counted by the site itself (`functions/api/hit.js` → the `hits` table), without cookies: a visitor is a daily hash of a secret salt (`STATS_SALT`, a Pages secret), the day, the IP and the browser, so people can't be followed from one day to the next. Bots are left out. The admin console's **Visitors** page shows visitors, page views, enquiries per 100 visitors, a daily chart, top pages, sources, countries and devices. Turn it off with `countVisits: false` in `config.js`. Cloudflare's own Web Analytics also runs (its script is allowed in the pages' security policy) and shows in the Cloudflare dashboard.

## Admin console and live content

The owner changes products, contact details and sees enquiries in a separate login-protected website, **[solartech-admin](https://github.com/ErinOP-gltich/solartech-admin)** (in the same spirit as the PCBL and MCML consoles). Both run on **Cloudflare**: Pages for the two sites, a D1 database and an R2 photo bucket they share, and Cloudflare Access for the login. The setup steps are in that project's README.

This site's part is small: `functions/api/public.js` (read the visible products and contact details), `functions/api/enquiry.js` (add one enquiry to the inbox, max 5 an hour per phone number) and `functions/media/[[path]].js` (serve photos from R2), configured by `wrangler.jsonc` and `_routes.json`. In the browser, `assets/js/live.js` applies the copy it kept from the last visit, fetches `/api/public`, and reloads once if something changed (the loading screen covers a first visit).

It does nothing until `liveApi: true` is set in `assets/js/config.js`. **Leave it `false` while the site is on GitHub Pages** (there are no Functions there); set it `true` when the site is on Cloudflare Pages with the database connected. With it off, or if the API can't be reached, the site shows `products.js` and `config.js` exactly as written, so keep those files roughly current. Still in the files: the five categories (`GS_CATEGORIES` in `products.js`) and the HTML copy of the phone, email and address that search engines read (see below).

## Editing

| To change… | Edit |
|---|---|
| Phone, WhatsApp, email, address, map location, **areas served**, GSTIN | the console's **Site details** page, or `assets/js/config.js` (the console's values win once `liveApi` is on) |
| Products, specs, photos | the console's **Products** page, or `assets/js/products.js` (the starting catalogue) |
| Categories | `GS_CATEGORIES` in `assets/js/products.js` |
| Colours, fonts, spacing, motion | `assets/css/gs.css` (all tokens are at the top) |
| Loading screen, live-beam hero, wattage dial | `assets/js/loader.js` + `assets/css/loader.css`, `assets/js/hero-beam.js` + `assets/css/hero-beam.css`, `assets/js/dial.js` + `assets/css/dial.css` |
| Page text | the `.html` files |

The contact details in `config.js` replace the ones written in the HTML when the page loads, so visitors always see the `config.js` values. Search engines and link previews read the HTML itself, though: when the phone, email or address changes, also change it in the HTML of the three pages (the `tel:`, `mailto:` and address copies) and in the LocalBusiness JSON-LD block near the top of `index.html`.

**Product list for search engines.** `products.html` carries a plain list of the 18 product names inside the grid, for crawlers and visitors without JavaScript; the scripts replace it with the cards. Keep it in step with `assets/js/products.js` when products are added, renamed or removed.

**Sitemap.** Update the `<lastmod>` dates in `sitemap.xml` when a page's content changes.

**Enquiries.** Without a server the form opens WhatsApp or the visitor's email app with the enquiry already written out. To receive enquiries directly instead, create a form with Formspree or Getform (both accept the JSON this site sends), put its URL in `formEndpoint` in `config.js`, and add the service's origin (for example `https://formspree.io`) to `connect-src` in the Content-Security-Policy tag of the three pages. A **Send enquiry** button then appears, and the note above the form says that it sends the details through a form service.

**Loading screen length.** `STRETCH` at the top of `assets/js/loader.js` (2.5) sets how long the first visit's loading screen plays (about 4.8 s); the times in `loader.css` under "choreography" are scaled by the same number. Later pages in the same visit use a short 0.7 s version.

**Security policy.** Each page starts with a Content-Security-Policy `<meta>` tag. Scripts may only come from this site (there are no inline scripts; the small start-up script is `assets/js/head.js`), fonts from Google Fonts, the map from Google, and everything else from this site itself (the live-content calls and photos are same-origin, so nothing extra is allowed). Anything new from another site (analytics, a chat widget, a form service) has to be added to that tag on all three pages, or the browser blocks it.

**Cache-busting.** Every local stylesheet and script is linked with `?v=<date>`. Change that date in all three pages whenever you change a CSS or JS file, so visitors get the new file at once instead of after GitHub Pages' ten-minute cache.

**Quote list.** It is kept in the visitor's own browser (`localStorage`), so nothing is stored anywhere else.

## Logo

The redesigned logo keeps the original idea (a smiling sun whose face is a plug) and redraws it as clean geometry: twelve swirl rays running from sun-yellow to flare red, a white-hot core, the plug's prongs as eyes, and a volt-green cable that leaves the sun and ends in a leaf.

| File | Use |
|---|---|
| `assets/brand/gs-mark.svg` | The sun on its own (the same file as `favicon.svg`) |
| `assets/brand/gs-lockup-light.svg` / `gs-lockup-dark.svg` | Sun + wordmark, for light and dark backgrounds |
| `assets/brand/favicon.svg`, `favicon.ico`, `apple-touch-icon.png` | Browser tab and phone home-screen icons |
| `assets/brand/og-image.jpg` | Preview image when the site is shared on social media / WhatsApp: the full registered logo |

The sun is the company's registered (™) logo, traced to vector from the logo artwork so it stays sharp at any size; never redraw or recolour it. The lettering beside it (GREEN SUN / TECHNOLOGIES) is Archivo Expanded Black with Geist Mono, converted to outlines.

**Previous version.** The first design is tagged `v1-original` in this repository.

## Before going live

- Confirm the **areas served** in `config.js` (currently a placeholder list).
- If the site moves to its own domain, search and replace `https://erinop-gltich.github.io/SolarTech/` with the new address in `index.html`, `products.html`, `contact.html`, `404.html`, `sitemap.xml` and `robots.txt` (canonical links, `og:url`, `og:image`, the JSON-LD `@id`, `url`, `logo` and `image`, and the 404 page's links), and add the new domain as a property in Google Search Console.
- Check the catalogue points noted below with the client.

### Catalogue points to confirm

The source catalogue disagrees with itself in a few places. The site currently shows the values in brackets:

- **12 m Solar High Mast** — its datasheet page repeats the 9 W street light's specs, so the site lists it as sized to the site (no fixed battery or panel figures).
- **20 W Semi-Integrated** — summary table says 12.8 V 15 Ah; datasheet says 14.8 V 15 Ah lithium-ion (12.8 V, 15 Ah, lithium-ion).
- **50 W Semi-Integrated** — summary table says a 125 Wp panel; datasheet says 100 Wp (125 Wp).
- **20 W DC Street Light** — summary table says a 100 Wp panel; datasheet says 125 Wp (100 Wp).
- **40 W with RMS** — shares part number 40W-SI-SOL with the plain 40 W light (shown as "40W-SI-SOL · RMS").
- **5 m Decorative Pole** — the lantern input is written as "220 VDC" (shown as 220 V).

Product photos are taken from the catalogue and are small; sharper photos can replace the files in `assets/img/products/` with the same names.
