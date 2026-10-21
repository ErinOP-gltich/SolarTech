# Green Sun Technologies — website

A three-page website for **Green Sun Technologies** (Guwahati, Assam): solar street lights, high masts, flood lights, traffic and pedestrian systems, lithium battery packs and decorative poles.

**Live:** https://erinop-gltich.github.io/SolarTech/

Plain HTML, CSS and JavaScript. There is nothing to install or build. It is served by GitHub Pages from the `gh-pages` branch of this repository, so every push to `gh-pages` updates the live site within a minute or two.

| Page | What's on it |
|---|---|
| `index.html` | Loading screen, a real-time WebGL plasma sun behind the hero, live "is the sun up in Guwahati?" status, a marquee driven by scroll speed, the company story, datasheet numbers, a scroll-driven 24-hour day/night demo, a pinned horizontal showroom, product families, a light finder, certifications, sectors and a closing sunrise |
| `products.html` | The marketplace: a rotary **wattage dial** for the street lights, then every product with search, category, power and feature filters, sorting, and a grid or spec-table view. **Enquire** goes to the Contact page with that product filled in, and **+** adds it to a quote list |
| `contact.html` | The quote list (with quantities), an enquiry form that sends through WhatsApp or email, phone/WhatsApp/email/address cards, the areas served, and a map |

## Design system

"Solar Noir": void black, a plasma gradient (flare red → orange → sun yellow → white-hot) and electric volt green, set in Archivo Expanded, Instrument Serif italic, Geist and Geist Mono. Surfaces are Apple-style liquid glass (frosted, with a specular highlight and rim light that follow the pointer); interaction follows Material 3 (shape scale, state layers, ripples, filter chips, segmented buttons, snackbar, motion tokens). Every colour, radius, spacing step, shadow and duration is a token at the top of `assets/css/gs.css`.

Animation uses GSAP (ScrollTrigger, SplitText, Flip) and Lenis smooth scrolling, both vendored in `assets/vendor/` so the site has no runtime CDN dependency. Everything degrades gracefully: without WebGL the sun becomes a CSS gradient, with *reduce motion* switched on the animations and smooth scrolling are off, and without JavaScript the content is still there.

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
| Loading screen, WebGL sun, wattage dial | `assets/js/loader.js` + `assets/css/loader.css`, `assets/js/sun-gl.js`, `assets/js/dial.js` + `assets/css/dial.css` |
| Page text | the `.html` files |

The contact details in `config.js` replace the ones written in the HTML when the page loads, so `config.js` is the only place they need changing.

**Enquiries.** Without a server the form opens WhatsApp or the visitor's email app with the enquiry already written out. To receive enquiries directly instead, create a form endpoint with a service such as Formspree, Web3Forms or Getform, put its URL in `formEndpoint` in `config.js`, and a **Send enquiry** button appears.

**Quote list.** It is kept in the visitor's own browser (`localStorage`), so nothing is stored anywhere else.

## Logo

The redesigned logo keeps the original idea (a smiling sun whose face is a plug) and redraws it as clean geometry: twelve swirl rays running from sun-yellow to flare red, a white-hot core, the plug's prongs as eyes, and a volt-green cable that leaves the sun and ends in a leaf.

| File | Use |
|---|---|
| `assets/brand/gs-mark.svg` | The sun on its own |
| `assets/brand/gs-lockup-light.svg` / `gs-lockup-dark.svg` | Sun + wordmark, for light and dark backgrounds |
| `assets/brand/favicon.svg`, `apple-touch-icon.png` | Browser tab and phone home-screen icons |
| `assets/brand/og-image.png` | Preview image when the site is shared on social media / WhatsApp |

The wordmark is set in Archivo Expanded Black with Geist Mono (free, Google Fonts) and converted to outlines. To rebuild the SVGs: `pip install fonttools`, download the two static TTFs (links in the script), then `python3 brand-source/build_logo.py Archivo-ExpandedBlack.ttf GeistMono-Medium.ttf`.

**Previous version.** The first design is tagged `v1-original` in this repository.

## Before going live

- Confirm the **areas served** in `config.js` (currently a placeholder list).
- If the site moves to its own domain, update `og:image` and `og:url` in `index.html` to the new address so link previews keep working.
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
