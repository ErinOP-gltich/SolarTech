"""Builds the Green Sun Technologies logo files in ../assets/brand/.

    python3 build_logo.py path/to/Unbounded-800.ttf path/to/Unbounded-500.ttf

The fonts are the free Unbounded family (Google Fonts, OFL). The wordmark is
converted to outlines, so the SVGs look the same on machines without the font.
Needs: pip install fonttools
"""
import math
import os
import sys

from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "assets", "brand")

GOLD = "#FFB000"
GOLD_DEEP = "#FF8A00"
GREEN = "#12A150"
INK = "#0B1220"
CREAM = "#FFF8E6"


def ray(i):
    """One swirl blade, pointing up and bent clockwise, rotated to slot i of 12."""
    d = ("M-27,-118 C-36,-168 -14,-214 44,-242 "
         "C24,-206 22,-166 27,-118 Z")
    return f'<path d="{d}" transform="rotate({i * 30})"/>'


def mark(face=GREEN, ring=CREAM, rays=GOLD, core=GOLD, with_defs=True, uid="gs", cord=True, at="translate(270 250) scale(0.95)"):
    """The sun mark, drawn around 0,0 and placed with `at` (default: centre of a 512 canvas)."""
    grad = (f'<defs><radialGradient id="{uid}-core" cx="40%" cy="35%" r="75%">'
            f'<stop offset="0" stop-color="#FFD24A"/><stop offset="1" stop-color="{GOLD_DEEP}"/>'
            f'</radialGradient></defs>') if with_defs else ""
    core_fill = f"url(#{uid}-core)" if with_defs else core
    # the plug's cable leaves the sun and ends in a leaf
    cord_path = '<path d="M0,52 C0,96 -18,122 -62,138 C-104,153 -150,150 -188,176"/>' if cord else ""
    leaf = (f'<path d="M-188,176 C-196,142 -232,128 -268,140 C-258,176 -224,192 -188,176 Z" fill="{face}"/>'
            f'<path d="M-192,172 Q-226,158 -254,147" fill="none" stroke="{ring if ring != "none" else "#fff"}" '
            f'stroke-width="5" stroke-linecap="round"/>' if cord else "")
    return f"""{grad}
<g transform="{at}">
  <g fill="{rays}">{''.join(ray(i) for i in range(12))}</g>
  <circle r="112" fill="{ring}"/>
  <circle r="98" fill="{core_fill}"/>
  <g fill="none" stroke="{face}" stroke-width="17" stroke-linecap="round" stroke-linejoin="round">
    <path d="M-27,-58 V-30 M27,-58 V-30"/>
    <path d="M-56,-6 C-56,40 -30,52 0,52 C30,52 56,40 56,-6"/>
    {cord_path}
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


def main(bold, medium):
    os.makedirs(OUT, exist_ok=True)

    write("gs-mark.svg", mark(), 512, 512)
    # favicon: no cable, so the face still reads at 16-32 px
    write("favicon.svg", mark(cord=False, at="translate(256 256)"), 512, 512)

    for theme, ink, sub in (("light", INK, GREEN), ("dark", "#FFFFFF", "#3BD37A")):
        d1, w1 = text_path(bold, "GREEN SUN", 120, tracking=2)
        d2, w2 = text_path(medium, "TECHNOLOGIES", 44, tracking=17.5)
        width = max(w1, w2)
        body = mark(face=GREEN if theme == "light" else "#3BD37A", ring=CREAM if theme == "light" else INK,
                    uid=f"gs-{theme}", at="translate(164 146) scale(0.56)")
        body += f'<path d="{d1}" fill="{ink}" transform="translate(330 150)"/>'
        body += f'<path d="{d2}" fill="{sub}" transform="translate(334 214)"/>'
        write(f"gs-lockup-{theme}.svg", body, 330 + width + 20, 290)


if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    main(sys.argv[1], sys.argv[2])
