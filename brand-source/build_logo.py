"""Builds the Green Sun Technologies logo files in ../assets/brand/.

    python3 build_logo.py path/to/Archivo-ExpandedBlack.ttf path/to/GeistMono-Medium.ttf

Fonts (free, Google Fonts, OFL): Archivo at width 125 / weight 900 ("Archivo Expanded Black")
and Geist Mono at weight 500. Download them as static TTFs, e.g. from
https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@125,900 and
https://fonts.googleapis.com/css2?family=Geist+Mono:wght@500
The wordmark is converted to outlines, so the SVGs look the same on machines without the fonts.
Needs: pip install fonttools
"""
import os
import sys

from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "assets", "brand")

# "Solar Noir" palette
VOID = "#050507"
TEXT = "#F3EFE6"
FLARE = "#FF3B1F"
ORANGE = "#FF7A00"
SUN = "#FFC400"
HOT = "#FFF1B8"
VOLT = "#C6FF3D"
LEAF = "#1FAF5A"      # the cable on light backgrounds, where volt green is too pale
CREAM = "#FFF8E6"


def ray(i):
    """One swirl blade, pointing up and bent clockwise, rotated to slot i of 12."""
    d = ("M-27,-118 C-36,-168 -14,-214 44,-242 "
         "C24,-206 22,-166 27,-118 Z")
    return f'<path d="{d}" transform="rotate({i * 30})"/>'


def mark(uid, ring=VOID, cord=VOLT, with_cord=True, at="translate(270 250) scale(0.95)"):
    """The sun mark, drawn around 0,0 and placed with `at` (default: centre of a 512 canvas).
    Rays run white-hot at the root to flare red at the tips; the plug face is cut out in the ring colour."""
    defs = (f'<defs>'
            f'<radialGradient id="{uid}-rays" gradientUnits="userSpaceOnUse" cx="0" cy="0" r="250">'
            f'<stop offset=".44" stop-color="{SUN}"/><stop offset=".72" stop-color="{ORANGE}"/><stop offset="1" stop-color="{FLARE}"/>'
            f'</radialGradient>'
            f'<radialGradient id="{uid}-core" cx="42%" cy="36%" r="72%">'
            f'<stop offset="0" stop-color="{HOT}"/><stop offset=".45" stop-color="{SUN}"/><stop offset="1" stop-color="{ORANGE}"/>'
            f'</radialGradient></defs>')
    cable = ""
    leaf = ""
    if with_cord:
        # the plug's cable leaves the sun and ends in a leaf
        cable = '<path d="M0,52 C0,96 -18,122 -62,138 C-104,153 -150,150 -188,176"/>'
        leaf = (f'<path d="M-188,176 C-196,142 -232,128 -268,140 C-258,176 -224,192 -188,176 Z" fill="{cord}"/>'
                f'<path d="M-192,172 Q-226,158 -254,147" fill="none" stroke="{ring}" stroke-width="5" stroke-linecap="round"/>')
    return f"""{defs}
<g transform="{at}">
  <g fill="url(#{uid}-rays)">{''.join(ray(i) for i in range(12))}</g>
  <circle r="112" fill="{ring}"/>
  <circle r="98" fill="url(#{uid}-core)"/>
  <g fill="none" stroke="{VOID}" stroke-width="17" stroke-linecap="round" stroke-linejoin="round">
    <path d="M-27,-58 V-30 M27,-58 V-30"/>
    <path d="M-56,-6 C-56,40 -30,52 0,52 C30,52 56,40 56,-6"/>
  </g>
  <g fill="none" stroke="{cord}" stroke-width="17" stroke-linecap="round" stroke-linejoin="round">
    <path d="M0,52 V60"/>
    {cable}
  </g>
  {leaf}
</g>"""


def text_path(font_path, text, size, tracking=0):
    """SVG path data for `text` set in the font at `size` px, baseline at y=0. Returns (d, width)."""
    font = TTFont(font_path)
    gs = font.getGlyphSet()
    cmap = font.getBestCmap()
    scale = size / font["head"].unitsPerEm
    pen = SVGPathPen(gs)
    x = 0.0
    for ch in text:
        name = cmap.get(ord(ch))
        if name is None:
            continue
        glyph = gs[name]
        # font units are y-up; SVG is y-down
        glyph.draw(TransformPen(pen, (scale, 0, 0, -scale, x, 0)))
        x += glyph.width * scale + tracking
    return pen.getCommands(), x - tracking


def write(name, body, w, h):
    with open(os.path.join(OUT, name), "w", encoding="utf-8") as f:
        f.write(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w:.0f} {h:.0f}" '
                f'width="{w:.0f}" height="{h:.0f}">{body}</svg>\n')


def main(display, mono):
    os.makedirs(OUT, exist_ok=True)

    write("gs-mark.svg", mark("gs"), 512, 512)
    # favicon: no cable, so the face still reads at 16-32 px
    write("favicon.svg", mark("fav", with_cord=False, at="translate(256 256)"), 512, 512)

    for theme, ring, ink, sub, cord in (("dark", VOID, TEXT, VOLT, VOLT), ("light", CREAM, VOID, LEAF, LEAF)):
        d1, w1 = text_path(display, "GREEN SUN", 96, tracking=0)
        d2, w2 = text_path(mono, "TECHNOLOGIES", 38, tracking=0)
        # stretch the mono line's tracking so it spans the wordmark exactly
        n = len("TECHNOLOGIES") - 1
        d2, w2 = text_path(mono, "TECHNOLOGIES", 38, tracking=(w1 - w2) / n)
        body = mark(f"gs-{theme}", ring=ring, cord=cord, at="translate(164 146) scale(0.56)")
        body += f'<path d="{d1}" fill="{ink}" transform="translate(330 150)"/>'
        body += f'<path d="{d2}" fill="{sub}" transform="translate(332 212)"/>'
        write(f"gs-lockup-{theme}.svg", body, 330 + w1 + 24, 290)


if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    main(sys.argv[1], sys.argv[2])
