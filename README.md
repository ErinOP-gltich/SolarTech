# Green Sun Technologies — website

A three-page website for **Green Sun Technologies** (Guwahati, Assam): solar street lights, high masts, flood lights, traffic and pedestrian systems, lithium battery packs and decorative poles.

**Live:** https://erinop-gltich.github.io/SolarTech/

Plain HTML, CSS and JavaScript. There is nothing to install or build. It is served by GitHub Pages from the `gh-pages` branch of this repository, so every push to `gh-pages` updates the live site within a minute or two.

| Page | What's on it |
|---|---|
| `index.html` | A loading screen where a solar street light powers on and its beam reveals the page, a hero in which a Green Sun street light hangs over a night road and its beam follows the pointer and lights up the headline, live "is the sun up in Guwahati?" status, a marquee driven by scroll speed, the company story, datasheet numbers, a scroll-driven 24-hour day/night demo, a pinned horizontal showroom, product families, a light finder, certifications, sectors and a street light switching on over the closing call to action |
| `products.html` | The marketplace: a rotary **wattage dial** for the street lights, then every product with search, category, power and feature filters, sorting, and a grid or spec-table view. **Enquire** goes to the Contact page with that product filled in, and **+** adds it to a quote list |
| `contact.html` | The quote list (with quantities), an enquiry form that sends through WhatsApp or email, phone/WhatsApp/email/address cards, the areas served, and a map |

## Design system

"Solar Noir": void black, a plasma gradient (flare red → orange → sun yellow → white-hot) and electric volt green, set in Archivo Expanded, Instrument Serif italic, Geist and Geist Mono. Surfaces are Apple-style liquid glass (frosted, with a specular highlight and rim light that follow the pointer); interaction follows Material 3 (shape scale, state layers, ripples, filter chips, segmented buttons, snackbar, motion tokens). Every colour, radius, spacing step, shadow and duration is a token at the top of `assets/css/gs.css`.

Animation uses GSAP (ScrollTrigger, SplitText, Flip) and Lenis smooth scrolling, both vendored in `assets/vendor/` so the site has no runtime CDN dependency. Everything degrades gracefully: without canvas the hero falls back to a painted CSS version of the scene, with *reduce motion* switched on the animations and smooth scrolling are off, and without JavaScript the content is still there.

## Preview

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000.

## Editing

| To change… | Edit |
|---|---|
| Phone, WhatsApp, email, address, map location, **areas served**, GSTIN | `assets/js/config.js` |
| Products, specs, photos, categories | `assets/js/products.js` |
| Colours, fonts, spacing, motion | `assets/css/gs.css` (all tokens are at the top) |
| Loading screen, live-beam hero, wattage dial | `assets/js/loader.js` + `assets/css/loader.css`, `assets/js/hero-beam.js` + `assets/css/hero-beam.css`, `assets/js/dial.js` + `assets/css/dial.css` |
| Page text | the `.html` files |

The contact details in `config.js` replace the ones written in the HTML when the page loads, so visitors always see the `config.js` values. Search engines and link previews read the HTML itself, though: when the phone, email or address changes, also change it in the HTML of the three pages (the `tel:`, `mailto:` and address copies) and in the LocalBusiness JSON-LD block near the top of `index.html`.

**Product list for search engines.** `products.html` carries a plain list of the 18 product names inside the grid, for crawlers and visitors without JavaScript; the scripts replace it with the cards. Keep it in step with `assets/js/products.js` when products are added, renamed or removed.

**Sitemap.** Update the `<lastmod>` dates in `sitemap.xml` when a page's content changes.

**Enquiries.** Without a server the form opens WhatsApp or the visitor's email app with the enquiry already written out. To receive enquiries directly instead, create a form with Formspree or Getform (both accept the JSON this site sends), put its URL in `formEndpoint` in `config.js`, and add the service's origin (for example `https://formspree.io`) to `connect-src` in the Content-Security-Policy tag of the three pages. A **Send enquiry** button then appears, and the note above the form says that it sends the details through a form service.

**Security policy.** Each page starts with a Content-Security-Policy `<meta>` tag. Scripts may only come from this site (there are no inline scripts; the small start-up script is `assets/js/head.js`), fonts from Google Fonts and the map from Google. Anything new from another site (analytics, a chat widget, a form service) has to be added to that tag on all three pages, or the browser blocks it.

**Cache-busting.** Every local stylesheet and script is linked with `?v=<date>`. Change that date in all three pages whenever you change a CSS or JS file, so visitors get the new file at once instead of after GitHub Pages' ten-minute cache.

**Quote list.** It is kept in the visitor's own browser (`localStorage`), so nothing is stored anywhere else.

## Logo

The redesigned logo keeps the original idea (a smiling sun whose face is a plug) and redraws it as clean geometry: twelve swirl rays running from sun-yellow to flare red, a white-hot core, the plug's prongs as eyes, and a volt-green cable that leaves the sun and ends in a leaf.

| File | Use |
|---|---|
| `assets/brand/gs-mark.svg` | The sun on its own |
| `assets/brand/gs-lockup-light.svg` / `gs-lockup-dark.svg` | Sun + wordmark, for light and dark backgrounds |
| `assets/brand/favicon.svg`, `apple-touch-icon.png` | Browser tab and phone home-screen icons |
| `assets/brand/og-image.jpg` | Preview image when the site is shared on social media / WhatsApp (97 KB; `og-image.png` is the lossless master) |

The wordmark is set in Archivo Expanded Black with Geist Mono (free, Google Fonts) and converted to outlines. To rebuild the SVGs: `pip install fonttools`, download the two static TTFs (links in the script), then `python3 brand-source/build_logo.py Archivo-ExpandedBlack.ttf GeistMono-Medium.ttf`.

**Previous version.** The first design is tagged `v1-original` in this repository.

## Before going live

- Confirm the **areas served** in `config.js` (currently a placeholder list).
- If the site moves to its own domain, search and replace `https://erinop-gltich.github.io/SolarTech/` with the new address in `index.html`, `products.html`, `contact.html`, `404.html` and `sitemap.xml` (canonical links, `og:url`, `og:image`, the JSON-LD `@id`, `url`, `logo` and `image`, and the 404 page's links), and add the new domain as a property in Google Search Console.
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
