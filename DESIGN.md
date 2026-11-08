# Green Sun Technologies — design system ("Daylight", v3)

Replaces the dark "Solar Noir" look (v2) across the site. Light first, a real dark mode, photos and products do the
talking, one calm type family, and the colours of the registered logo: sun gold and leaf green.

Compared (2026-11-08, looked at live): **Sunna Design** (solar street lighting: dusk photo hero, then a white page with
black sentence-case headings, brand yellow only as small accents), **Enphase** (full-bleed real photos, plain headings,
pill buttons, one orange for the main action), **Ather Energy** (light grey page, white floating nav, black pill
button, big rounded photo cards). All three: light pages, real imagery, one clean sans, one accent used sparingly.

## Colour

| Token | Light | Dark | Role |
|---|---|---|---|
| `--bg` | `#F6F5F1` | `#0E120F` | Page background (warm off-white / green-black) |
| `--surface` | `#FFFFFF` | `#161B17` | Cards, nav, panels, inputs |
| `--surface-2` | `#EEECE5` | `#1E2420` | Insets, product stages, chips |
| `--ink` | `#14160F` | `#F2F1EA` | Headings and body text |
| `--ink-2` | `#4A4D44` | `#B9BDB2` | Secondary text |
| `--muted` | `#6B6E64` | `#8E9388` | Captions, labels (≥ 4.5:1 on `--bg`) |
| `--line` | `rgb(20 22 15 / .10)` | `rgb(242 241 234 / .10)` | Borders, dividers |
| `--primary` | `#1F7A34` | `#4CC46A` | Leaf green: buttons, links, selected states (white text on it in light, ink in dark) |
| `--primary-hover` | `#186429` | `#62D27E` | Hover of the above |
| `--accent` | `#EBAD03` | `#F2BB1D` | Sun gold: highlights, focus ring, small dots, the one warm touch. Never text on white |
| `--danger` | `#B42318` | `#F97066` | Errors |

No gradient text, no glass, no plasma gradients. The night scenes (home hero, planner, 24-hour demo) stay dark panels
set into the page, like a photo.

## Typography

One family: **Geist** (self-hosted, 400–700). Headings 600, sentence case, tracking −0.03em. **Geist Mono** only for
numbers in specs and the clock. Archivo Expanded survives only inside the logo lockup.

| Step | Size (desktop / phone) | Line height | Use |
|---|---|---|---|
| display | 76 / 42 | 1.02 | Home hero |
| h1 | 60 / 36 | 1.05 | Page titles |
| h2 | 44 / 30 | 1.1 | Section titles |
| h3 | 24 / 20 | 1.25 | Card titles |
| lead | 20 / 17 | 1.55 | Intro paragraphs |
| body | 16.5 / 16 | 1.6 | Text (60–75 characters a line) |
| small | 14 | 1.5 | Captions, labels (sentence case, 500) |

## Spacing, shape, depth

- Spacing: 4-based — 4 8 12 16 24 32 48 64 96 128. Sections 96px apart (64 on phones); content width 1200px.
- Radius: 12 (inputs, chips), 20 (cards), 28 (big media panels), full (buttons, nav).
- Shadow (light only): `0 1px 2px rgb(20 22 15 / .05), 0 10px 30px -14px rgb(20 22 15 / .18)`. Dark mode uses borders.

## Components

- **Buttons** (pill, 48px tall, 15px/600): primary = green fill; secondary = surface with a line border; quiet = text
  with an arrow. Focus = 3px gold ring, 2px offset. Disabled = 45% opacity.
- **Nav**: a white (dark: surface) floating pill, logo left, links centre, quote button right.
- **Cards**: surface, 1px line, radius 20, image on top; hover lifts 2px.
- **Labels**: small sentence-case text in `--muted`, not mono capitals.
- **Inputs**: surface, 1px line, radius 12, green focus border.

## Imagery and icons

Real photos full-bleed with a dark gradient under any text; product cut-outs on a `--surface-2` stage. One line icon
set (1.75 stroke, rounded). The sun mark keeps its slow spin.
