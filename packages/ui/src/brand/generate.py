"""Draw the no-tone wordmark.

`no-tone` with the `t` replaced by a backslash, so it reads `no\\one` - the
name and "no one" at once.

Every letter is **drawn**, not outlined from a typeface. The alphabet is
monoline geometric: one stroke width, and every curve is a true circle. That
is the whole point of the mark. The site's running text is a neutral
grotesque doing a professional job quietly; the logo is the one place allowed
to be round, wide and a bit playful, and borrowing the body font for it -
which is what the first attempt did - produced something that read as "the
website's font, italic" rather than as a mark.

Three rules hold it together:

  1. **One stroke width.** Stems, arches and bowls are all the same weight.
  2. **True circles.** The `o` is a perfect ring; the `n`'s shoulder and the
     `e`'s bowl are arcs of the same radius family. Nothing is an oval.
  3. **One angle.** The letters lean by it and the backslash *is* it, drawn
     full height. It is the only diagonal in the mark; everything else is
     circular or vertical.

No font dependency - pure geometry, so this runs with a bare Python.

Regenerate:  python3 packages/ui/src/brand/generate.py
"""

import math
import pathlib

OUT = pathlib.Path(__file__).parent

# ---------------------------------------------------------------- metrics --

UPM = 1000
X_HEIGHT = 540.0
# Stroke weight. Heavy enough to hold at favicon size, light enough that the
# counters in `o` and `e` stay open.
STROKE = 104.0
# Letter widths. Wider than a text face would set them: a wordmark is read as
# one shape, and width is what makes it feel drawn rather than typed.
W_N = 500.0
W_O = X_HEIGHT
W_E = X_HEIGHT
GAP = 52.0

ANGLE = 14.0
# Matches PROFILE_ROWS in the gradient field, so a frame's colour bands map
# one-to-one onto the mark's gradient stops.
PROFILE_STOPS = 25
SLANT = math.tan(math.radians(ANGLE))

ASCEND = X_HEIGHT * 1.62
DESCEND = -X_HEIGHT * 0.30

# ------------------------------------------------------------ path builder --


class Path:
    """Absolute-coordinate path, serialised through a point transform.

    Points are kept as numbers until the very end so the oblique can be
    applied once, uniformly, to everything - including bezier control
    points, which is why arcs are built from cubics rather than SVG `A`
    commands. A sheared cubic is still a cubic; a sheared circular arc is a
    rotated ellipse and would need its parameters recomputed.
    """

    def __init__(self):
        self.ops = []

    def M(self, x, y):
        self.ops.append(("M", x, y))
        return self

    def L(self, x, y):
        self.ops.append(("L", x, y))
        return self

    def C(self, x1, y1, x2, y2, x, y):
        self.ops.append(("C", x1, y1, x2, y2, x, y))
        return self

    def Z(self):
        self.ops.append(("Z",))
        return self

    def extend(self, other):
        self.ops.extend(other.ops)
        return self

    def points(self, shift_x=0.0, slant=None):
        """Every point in the path, after the same transform `d` applies.

        Control points included: for a bounding box that is only ever used to
        centre something, an approximation that can only be too generous is
        the right kind of wrong.
        """
        k = SLANT if slant is None else slant
        out = []
        for op in self.ops:
            if op[0] == "Z":
                continue
            for i in range(1, len(op), 2):
                x, y = op[i], op[i + 1]
                out.append((x + k * y + shift_x, y))
        return out

    def d(self, shift_x=0.0, slant=None):
        k = SLANT if slant is None else slant
        out = []
        for op in self.ops:
            if op[0] == "Z":
                out.append("Z")
                continue
            coords = []
            for i in range(1, len(op), 2):
                x, y = op[i], op[i + 1]
                coords.append(f"{x + k * y + shift_x:.1f},{y:.1f}")
            out.append(op[0] + " ".join(coords))
        return "".join(out)


def arc(path: Path, cx, cy, r, a0, a1, move=False):
    """Append a circular arc as cubics, splitting at 90° so error stays tiny."""
    sweep = a1 - a0
    steps = max(1, math.ceil(abs(sweep) / (math.pi / 2)))
    step = sweep / steps
    # Control-point offset for a cubic approximation of an arc of `step`.
    k = 4 / 3 * math.tan(step / 4)
    a = a0
    if move:
        path.M(cx + r * math.cos(a), cy + r * math.sin(a))
    for _ in range(steps):
        b = a + step
        x0, y0 = cx + r * math.cos(a), cy + r * math.sin(a)
        x1, y1 = cx + r * math.cos(b), cy + r * math.sin(b)
        path.C(
            x0 - k * r * math.sin(a),
            y0 + k * r * math.cos(a),
            x1 + k * r * math.sin(b),
            y1 - k * r * math.cos(b),
            x1,
            y1,
        )
        a = b
    return path


def ring(cx, cy, r, w):
    """A closed monoline ring. Inner contour wound against the outer one, or
    the counter fills in solid."""
    p = Path()
    arc(p, cx, cy, r, 0, 2 * math.pi, move=True)
    p.Z()
    arc(p, cx, cy, r - w, 2 * math.pi, 0, move=True)
    p.Z()
    return p


def band(cx, cy, r, w, a0, a1):
    """An open arc of stroke width `w`: outer arc out, inner arc back."""
    p = Path()
    arc(p, cx, cy, r, a0, a1, move=True)
    p.L(cx + (r - w) * math.cos(a1), cy + (r - w) * math.sin(a1))
    arc(p, cx, cy, r - w, a1, a0)
    p.Z()
    return p


def bar(x0, y0, x1, y1):
    return Path().M(x0, y0).L(x1, y0).L(x1, y1).L(x0, y1).Z()


# ---------------------------------------------------------------- letters --


def letter_n():
    """Stem, a true half-circle shoulder, stem. No tapering, no spur."""
    r = W_N / 2
    cy = X_HEIGHT - r
    p = Path()
    p.extend(bar(0, 0, STROKE, cy))
    p.extend(band(r, cy, r, STROKE, math.pi, 0))
    p.extend(bar(W_N - STROKE, 0, W_N, cy))
    return p, W_N


def letter_o():
    r = W_O / 2
    return ring(r, r, r, STROKE), W_O


def letter_e():
    """A ring opened at the lower right, closed by a horizontal bar.

    The bar sits exactly on the centre line, so its ends land on the ring at
    0° and 180° and the joins are invisible. The 46° gap is the only thing
    telling you it is an `e` and not an `o` with a line through it, so it is
    cut generously.
    """
    r = W_E / 2
    gap = math.radians(46)
    # From 0° (where the bar's right end lands) anticlockwise the long way
    # round, stopping short of the start so the gap opens at the lower right.
    # Running to a full 2π would overlap the beginning by the gap angle.
    p = band(r, r, r, STROKE, 0, 2 * math.pi - gap)
    p.extend(bar(0, r - STROKE / 2, W_E, r + STROKE / 2))
    return p, W_E


def letter_backslash():
    """The one angle, mirrored - leaning against the letters, not with them.

    A backslash runs top-left to bottom-right. The letters lean the other
    way. They cannot share a direction, and pretending otherwise just turns
    the mark into a forward slash. So the mark is the same angle *negated*:
    the only stroke in the wordmark going against the grain, which is the
    right shape for a name that begins with "no".
    """
    top, bot = ASCEND, DESCEND
    w = STROKE * 0.96
    p = bar(0, bot, w, top)
    # Leaning left means the *top* is the leftmost point, at -SLANT*top once
    # sheared. Without compensating, the stroke starts behind the previous
    # letter and collides with it.
    return p, w + (top - bot) * SLANT


# ------------------------------------------------------------------ layout --

LETTERS = [
    ("n", letter_n),
    ("o", letter_o),
    ("mark", letter_backslash),
    ("o", letter_o),
    ("n", letter_n),
    ("e", letter_e),
]

parts, x = [], 0.0
for i, (name, build) in enumerate(LETTERS):
    path, advance = build()
    if name == "mark":
        # Negated slant, and shifted right by the lean so its leftmost point
        # (the top) lands on the pen rather than behind it.
        parts.append((name, i, path.d(x + ASCEND * SLANT, -SLANT)))
    else:
        parts.append((name, i, path.d(x, SLANT)))
    x += advance + GAP

total_w = x - GAP
# The tallest right-leaning stroke is a letter at x-height; the mark's own
# lean is already inside its advance.
overhang = X_HEIGHT * SLANT
pad = UPM * 0.05
vb_w = round(total_w + overhang + pad * 2)
vb_h = round(ASCEND - DESCEND + pad * 2)

body, seen_mark = [], False
for name, i, d in parts:
    if name == "mark":
        seen_mark = True
        body.append(f'<path class="ntl__mark" fill="url(#ntl-ramp)" d="{d}"/>')
        continue
    side = "right" if seen_mark else "left"
    body.append(
        f'<path class="ntl__glyph" data-side="{side}" data-index="{i}" d="{d}"/>'
    )

inner = "\n    ".join(body)

# The mark is painted from the gradient field rather than from currentColor:
# the one stroke that goes against the grain is also the one that carries the
# page's colour, sampled live (see @repo/ui field-controller). Stops default
# to white so the mark is correct before the first frame lands, and stays
# correct if the field never runs at all.
#
# y1/y2 are inverted because the group below flips the y axis, and the
# gradient rides that transform with everything else.
stops = "\n      ".join(
    f'<stop offset="{i / (PROFILE_STOPS - 1):.4f}" stop-color="#ffffff"/>'
    for i in range(PROFILE_STOPS)
)
svg = f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {vb_w} {vb_h}" fill="none" role="img" aria-label="no-tone">
  <defs>
    <linearGradient id="ntl-ramp" x1="0" y1="1" x2="0" y2="0">
      {stops}
    </linearGradient>
  </defs>
  <g transform="translate({pad - DESCEND * SLANT:.0f},{ASCEND + pad:.0f}) scale(1,-1)" fill="currentColor">
    {inner}
  </g>
</svg>
"""
(OUT / "wordmark.svg").write_text(svg)
print(f"wordmark {vb_w}x{vb_h}  stroke={STROKE}  x-height={X_HEIGHT}  angle={ANGLE}°")

mark_path, mark_adv = letter_backslash()
m_pad = UPM * 0.16
m_h = ASCEND - DESCEND
side_len = round(m_h + m_pad * 2)
m_w = STROKE * 0.96 + m_h * SLANT
mark_svg = f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {side_len} {side_len}" fill="none" role="img" aria-label="no-tone">
  <g transform="translate({(side_len - m_w) / 2 + ASCEND * SLANT:.0f},{(side_len + m_h) / 2:.0f}) scale(1,-1)" fill="currentColor">
    <path d="{mark_path.d(0, -SLANT)}"/>
  </g>
</svg>
"""
(OUT / "mark.svg").write_text(mark_svg)
print(f"mark {side_len}x{side_len}")

# --- favicon -----------------------------------------------------------------
#
# The tab icon is the same backslash, on a plate. Generated here rather than
# drawn by hand so it cannot drift from the wordmark: a favicon that is
# nearly the logo is worse than one that plainly is.
#
# A plate rather than a bare glyph, because a lone diagonal on a transparent
# ground disappears into whichever tab colour the browser picks. It flips with
# the browser's colour scheme so the mark reads either way.
#
# Written to both apps' public/ directories - Astro serves favicons from
# there, and there is no import path from a package into public/, so the
# copies are outputs of this script rather than duplicates to maintain.
FAVICON_BOX = 32
FAVICON_GLYPH_H = 20.0  # of 32; the rest is the plate's margin

# The mark's own bounding box, in mark.svg's coordinate space.
_pts = [(717 + x, 1197 - y) for x, y in mark_path.points(0, -SLANT)]
_x0, _x1 = min(p[0] for p in _pts), max(p[0] for p in _pts)
_y0, _y1 = min(p[1] for p in _pts), max(p[1] for p in _pts)
_scale = FAVICON_GLYPH_H / (_y1 - _y0)
_tx = FAVICON_BOX / 2 - (_x0 + _x1) / 2 * _scale
_ty = FAVICON_BOX / 2 - (_y0 + _y1) / 2 * _scale

favicon_svg = f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {FAVICON_BOX} {FAVICON_BOX}" role="img" aria-label="no-tone">
  <rect class="ntf__plate" width="{FAVICON_BOX}" height="{FAVICON_BOX}" rx="7" fill="#000000"/>
  <g transform="translate({_tx:.4f},{_ty:.4f}) scale({_scale:.6f})">
    <g transform="translate(717,1197) scale(1,-1)">
      <path class="ntf__mark" fill="#ffffff" d="{mark_path.d(0, -SLANT)}"/>
    </g>
  </g>
  <style>
    @media (prefers-color-scheme: light) {{
      .ntf__plate {{ fill: #ffffff; }}
      .ntf__mark {{ fill: #000000; }}
    }}
  </style>
</svg>
"""
for app in ("web", "dashboard"):
    dest = OUT.parents[3] / "apps" / app / "public" / "favicon.svg"
    if dest.parent.exists():
        dest.write_text(favicon_svg)
        print(f"favicon -> {dest}")
    else:
        print(f"favicon SKIPPED, no {dest.parent}")

# The raster fallbacks (favicon.ico, icons/*.png) are not generated here:
# rasterising SVG needs a renderer this script deliberately does not depend
# on. Regenerate them from the SVG above when the mark changes - any of
# `rsvg-convert`, ImageMagick, or a headless browser canvas will do.
