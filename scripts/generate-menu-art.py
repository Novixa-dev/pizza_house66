"""Menu artwork generator.

Vector, not photography, and it says so: these ship so a new item is never a
grey rectangle, and every one of them is meant to be replaced by a photograph
the restaurant takes of its own food (admin → Products → Dish photo).

What makes these read as food rather than clip art is depth. Each plate is
built in layers — a shadow that falls the way a real one does, a warm rim
light on the top-left, char on the crust edge, gloss on the cheese, and a
faint grain over everything so no area is a flat fill.
"""
import math, random, os, textwrap

W = 640
OUT = "public/menu"

def rnd(seed):
    return random.Random(seed)

def defs(seed, base, deep):
    """Shared gradients, shadow and grain."""
    return f"""
  <defs>
    <radialGradient id="bg" cx="42%" cy="34%" r="78%">
      <stop offset="0%" stop-color="{base}"/>
      <stop offset="70%" stop-color="{deep}"/>
      <stop offset="100%" stop-color="{shade(deep, -14)}"/>
    </radialGradient>
    <radialGradient id="rim" cx="36%" cy="30%" r="68%">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.30"/>
      <stop offset="55%" stop-color="#ffffff" stop-opacity="0.04"/>
      <stop offset="100%" stop-color="#000000" stop-opacity="0.16"/>
    </radialGradient>
    <filter id="drop" x="-30%" y="-30%" width="160%" height="170%">
      <feDropShadow dx="0" dy="16" stdDeviation="22" flood-color="#2b1708" flood-opacity="0.30"/>
    </filter>
    <filter id="soften" x="-10%" y="-10%" width="120%" height="120%">
      <feGaussianBlur stdDeviation="1.1"/>
    </filter>
    <filter id="grain" x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="3" seed="{seed}"/>
      <feColorMatrix type="saturate" values="0"/>
    </filter>
  </defs>"""

def shade(hexcolor, amount):
    c = hexcolor.lstrip("#")
    r, g, b = (int(c[i:i+2], 16) for i in (0, 2, 4))
    f = lambda v: max(0, min(255, v + amount))
    return "#%02x%02x%02x" % (f(r), f(g), f(b))

def grain(op=0.05):
    return (f'  <rect width="{W}" height="{W}" filter="url(#grain)" opacity="{op}" '
            'style="mix-blend-mode:multiply"/>')

def header(seed, base="#fdf3e3", deep="#e9d4b0"):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {W}" '
            f'width="{W}" height="{W}" role="img">{defs(seed, base, deep)}\n'
            f'  <rect width="{W}" height="{W}" fill="url(#bg)"/>')

def footer():
    return grain() + f'\n  <rect width="{W}" height="{W}" fill="url(#rim)"/>\n</svg>\n'

# --- pizza ------------------------------------------------------------------

def pizza(seed, sauce, cheese, toppings):
    """A round pizza seen from above, with char, cheese texture and toppings.

    `toppings` is a list of (count, radius_range, colours, shape).
    """
    r = rnd(seed)
    cx = cy = 320
    parts = [header(seed)]
    parts.append('  <g filter="url(#drop)">')
    # Crust: three rings, each a shade darker outward, so the edge has volume.
    parts.append(f'    <circle cx="{cx}" cy="{cy}" r="252" fill="#b5762f"/>')
    parts.append(f'    <circle cx="{cx}" cy="{cy}" r="246" fill="#d79c4b"/>')
    parts.append(f'    <circle cx="{cx}" cy="{cy}" r="238" fill="#eec483"/>')
    parts.append('  </g>')
    # Oven char on the crust: irregular dark blooms around the rim.
    for _ in range(26):
        a = r.uniform(0, math.tau)
        rad = r.uniform(222, 243)
        parts.append(
            f'  <ellipse cx="{cx + rad * math.cos(a):.1f}" cy="{cy + rad * math.sin(a):.1f}" '
            f'rx="{r.uniform(7, 19):.1f}" ry="{r.uniform(5, 13):.1f}" '
            f'transform="rotate({math.degrees(a):.0f} {cx + rad * math.cos(a):.1f} {cy + rad * math.sin(a):.1f})" '
            f'fill="#6b3d15" opacity="{r.uniform(0.12, 0.38):.2f}" filter="url(#soften)"/>')
    # Sauce, then cheese just inside it.
    parts.append(f'  <circle cx="{cx}" cy="{cy}" r="212" fill="{sauce}"/>')
    parts.append(f'  <circle cx="{cx}" cy="{cy}" r="205" fill="{cheese}"/>')
    # Melted-cheese texture: overlapping soft blobs, lighter and darker.
    for _ in range(86):
        a, rad = r.uniform(0, math.tau), r.uniform(0, 198)
        x, y = cx + rad * math.cos(a), cy + rad * math.sin(a)
        light = r.random() < 0.5
        parts.append(
            f'  <ellipse cx="{x:.1f}" cy="{y:.1f}" rx="{r.uniform(14, 38):.1f}" '
            f'ry="{r.uniform(10, 27):.1f}" fill="{shade(cheese, 30 if light else -44)}" '
            f'opacity="{r.uniform(0.12, 0.32):.2f}" '
            f'transform="rotate({r.uniform(0,180):.0f} {x:.1f} {y:.1f})" filter="url(#soften)"/>')
    # Browned blisters — the bubbles that catch in the oven. Without these a
    # pizza reads as a yellow disc rather than as something that was baked.
    for _ in range(46):
        a, rad = r.uniform(0, math.tau), r.uniform(15, 196)
        x, y = cx + rad * math.cos(a), cy + rad * math.sin(a)
        size = r.uniform(5, 16)
        parts.append(
            f'  <ellipse cx="{x:.1f}" cy="{y:.1f}" rx="{size:.1f}" ry="{size*0.72:.1f}" '
            f'fill="#8f4f13" opacity="{r.uniform(0.16, 0.36):.2f}" filter="url(#soften)"/>')
        parts.append(
            f'  <ellipse cx="{x - size*0.3:.1f}" cy="{y - size*0.35:.1f}" rx="{size*0.4:.1f}" '
            f'ry="{size*0.28:.1f}" fill="{shade(cheese, 46)}" opacity="0.45"/>')
    # Toppings.
    for count, (r0, r1), colours, shape in toppings:
        for _ in range(count):
            a, rad = r.uniform(0, math.tau), r.uniform(25, 185)
            x, y = cx + rad * math.cos(a), cy + rad * math.sin(a)
            size = r.uniform(r0, r1)
            col = r.choice(colours)
            rot = r.uniform(0, 360)
            if shape == "disc":
                parts.append(f'  <circle cx="{x:.1f}" cy="{y + 2.5:.1f}" r="{size:.1f}" fill="#000" opacity="0.18" filter="url(#soften)"/>')
                parts.append(f'  <circle cx="{x:.1f}" cy="{y:.1f}" r="{size:.1f}" fill="{col}"/>')
                parts.append(f'  <circle cx="{x - size*0.25:.1f}" cy="{y - size*0.28:.1f}" r="{size*0.42:.1f}" fill="{shade(col, 26)}" opacity="0.55"/>')
            elif shape == "ring":
                parts.append(f'  <circle cx="{x:.1f}" cy="{y:.1f}" r="{size:.1f}" fill="none" stroke="{col}" stroke-width="{size*0.42:.1f}"/>')
            elif shape == "chunk":
                parts.append(f'  <rect x="{x-size:.1f}" y="{y-size*0.7:.1f}" width="{size*2:.1f}" height="{size*1.4:.1f}" rx="{size*0.45:.1f}" fill="#000" opacity="0.16" transform="rotate({rot:.0f} {x:.1f} {y+2:.1f})" filter="url(#soften)"/>')
                parts.append(f'  <rect x="{x-size:.1f}" y="{y-size*0.7:.1f}" width="{size*2:.1f}" height="{size*1.4:.1f}" rx="{size*0.45:.1f}" fill="{col}" transform="rotate({rot:.0f} {x:.1f} {y:.1f})"/>')
            elif shape == "leaf":
                parts.append(f'  <ellipse cx="{x:.1f}" cy="{y:.1f}" rx="{size:.1f}" ry="{size*0.55:.1f}" fill="{col}" transform="rotate({rot:.0f} {x:.1f} {y:.1f})"/>')
    # Gloss: a soft highlight arc, which is what makes cheese look hot.
    parts.append(f'  <ellipse cx="{cx-58}" cy="{cy-72}" rx="118" ry="76" fill="#fff" opacity="0.14" '
                 'transform="rotate(-24 262 248)" filter="url(#soften)"/>')
    parts.append(footer())
    return "\n".join(parts)

# --- other plates -----------------------------------------------------------

def pastry(seed, dough, filling, drizzle=None, seeds=False):
    """An open fatayer: a round dough base with a filling and a rolled edge."""
    r = rnd(seed)
    cx, cy = 320, 330
    parts = [header(seed, "#fbf1de", "#e6d0aa")]
    parts.append('  <g filter="url(#drop)">')
    parts.append(f'    <ellipse cx="{cx}" cy="{cy}" rx="248" ry="228" fill="{shade(dough, -34)}"/>')
    parts.append(f'    <ellipse cx="{cx}" cy="{cy-5}" rx="242" ry="222" fill="{dough}"/>')
    parts.append('  </g>')
    for _ in range(30):
        a = r.uniform(0, math.tau)
        rad_x, rad_y = 220 * math.cos(a), 202 * math.sin(a)
        parts.append(f'  <ellipse cx="{cx+rad_x:.1f}" cy="{cy+rad_y-5:.1f}" rx="{r.uniform(9,22):.1f}" '
                     f'ry="{r.uniform(6,14):.1f}" fill="{shade(dough,-48)}" '
                     f'opacity="{r.uniform(0.1,0.34):.2f}" filter="url(#soften)"/>')
    parts.append(f'  <ellipse cx="{cx}" cy="{cy-8}" rx="196" ry="178" fill="{filling}"/>')
    for _ in range(46):
        a, t = r.uniform(0, math.tau), r.uniform(0, 1)
        x, y = cx + 178 * t * math.cos(a), cy - 8 + 162 * t * math.sin(a)
        parts.append(f'  <ellipse cx="{x:.1f}" cy="{y:.1f}" rx="{r.uniform(10,34):.1f}" '
                     f'ry="{r.uniform(8,24):.1f}" fill="{shade(filling, 20 if r.random()<0.5 else -22)}" '
                     f'opacity="{r.uniform(0.16,0.44):.2f}" filter="url(#soften)"/>')
    if seeds:
        for _ in range(90):
            a, t = r.uniform(0, math.tau), math.sqrt(r.random())
            x, y = cx + 170 * t * math.cos(a), cy - 8 + 154 * t * math.sin(a)
            parts.append(f'  <ellipse cx="{x:.1f}" cy="{y:.1f}" rx="{r.uniform(5,13):.1f}" '
                         f'ry="{r.uniform(3,8):.1f}" fill="{shade(filling, 34 if r.random()<0.5 else -30)}" '
                         f'opacity="{r.uniform(0.25,0.6):.2f}" '
                         f'transform="rotate({r.uniform(0,180):.0f} {x:.1f} {y:.1f})"/>')
        for _ in range(14):
            a, t = r.uniform(0, math.tau), math.sqrt(r.random()) * 0.9
            x, y = cx + 160 * t * math.cos(a), cy - 8 + 145 * t * math.sin(a)
            parts.append(f'  <ellipse cx="{x:.1f}" cy="{y:.1f}" rx="{r.uniform(12,26):.1f}" '
                         f'ry="{r.uniform(8,17):.1f}" fill="#b8912f" opacity="0.3" filter="url(#soften)"/>')
        for _ in range(70):
            a, t = r.uniform(0, math.tau), math.sqrt(r.random())
            x, y = cx + 168 * t * math.cos(a), cy - 8 + 152 * t * math.sin(a)
            parts.append(f'  <ellipse cx="{x:.1f}" cy="{y:.1f}" rx="3.4" ry="2.1" fill="#3f4f22" '
                         f'opacity="0.7" transform="rotate({r.uniform(0,180):.0f} {x:.1f} {y:.1f})"/>')
    if drizzle:
        path = f"M {cx-150} {cy-40}"
        for i in range(1, 9):
            path += f" Q {cx-150+i*38} {cy-40+(60 if i%2 else -60)} {cx-150+i*38} {cy-40}"
        parts.append(f'  <path d="{path}" fill="none" stroke="{drizzle}" stroke-width="9" '
                     'stroke-linecap="round" opacity="0.9"/>')
        parts.append(f'  <path d="{path}" fill="none" stroke="{shade(drizzle,40)}" stroke-width="3" '
                     'stroke-linecap="round" opacity="0.6"/>')
    parts.append(f'  <ellipse cx="{cx-62}" cy="{cy-96}" rx="102" ry="60" fill="#fff" opacity="0.13" '
                 f'transform="rotate(-20 {cx-62} {cy-96})" filter="url(#soften)"/>')
    parts.append(footer())
    return "\n".join(parts)

def sticks(seed, body, coating, count=11, sauce=None):
    """A pile of golden sticks — mozzarella sticks, wedges, garlic bread."""
    r = rnd(seed)
    parts = [header(seed, "#fbf0dc", "#e4cca4")]
    parts.append(f'  <ellipse cx="320" cy="470" rx="230" ry="52" fill="#2b1708" opacity="0.18" filter="url(#soften)"/>')
    for i in range(count):
        a = -0.55 + i * (1.1 / max(1, count - 1)) + r.uniform(-0.08, 0.08)
        x = 306 + math.cos(a) * r.uniform(74, 152)
        y = 326 + math.sin(a) * r.uniform(66, 136)
        w, h = r.uniform(66, 94), r.uniform(186, 248)
        rot = r.uniform(-70, 70)
        parts.append(f'  <g transform="rotate({rot:.0f} {x:.0f} {y:.0f})" filter="url(#drop)">')
        parts.append(f'    <rect x="{x-w/2:.0f}" y="{y-h/2:.0f}" width="{w:.0f}" height="{h:.0f}" rx="{w*0.32:.0f}" fill="{shade(coating,-30)}"/>')
        parts.append(f'    <rect x="{x-w/2+4:.0f}" y="{y-h/2+4:.0f}" width="{w-8:.0f}" height="{h-8:.0f}" rx="{w*0.3:.0f}" fill="{coating}"/>')
        parts.append(f'    <rect x="{x-w/2+11:.0f}" y="{y-h/2+11:.0f}" width="{w-22:.0f}" height="{h*0.42:.0f}" rx="{w*0.22:.0f}" fill="{body}" opacity="0.85"/>')
        parts.append('  </g>')
        for _ in range(9):
            parts.append(f'  <circle cx="{x + r.uniform(-w/2, w/2):.0f}" cy="{y + r.uniform(-h/2, h/2):.0f}" '
                         f'r="{r.uniform(2.5, 6):.1f}" fill="{shade(coating,-45)}" opacity="{r.uniform(0.2,0.5):.2f}"/>')
    if sauce:
        parts.append(f'  <ellipse cx="470" cy="452" rx="74" ry="52" fill="#fff" opacity="0.9"/>')
        parts.append(f'  <ellipse cx="470" cy="448" rx="64" ry="43" fill="{sauce}"/>')
        parts.append(f'  <ellipse cx="452" cy="436" rx="22" ry="13" fill="{shade(sauce,34)}" opacity="0.5"/>')
    parts.append(footer())
    return "\n".join(parts)

def dessert(seed, base, spread, fruit):
    """A folded sweet pizza with chocolate and banana."""
    r = rnd(seed)
    parts = [header(seed, "#fbeee0", "#e5cdb3")]
    parts.append('  <g filter="url(#drop)">')
    parts.append(f'    <ellipse cx="320" cy="336" rx="246" ry="224" fill="{shade(base,-34)}"/>')
    parts.append(f'    <ellipse cx="320" cy="330" rx="240" ry="218" fill="{base}"/>')
    parts.append('  </g>')
    parts.append(f'  <ellipse cx="320" cy="326" rx="196" ry="176" fill="{spread}"/>')
    for _ in range(34):
        a, t = r.uniform(0, math.tau), r.uniform(0, 1)
        x, y = 320 + 176 * t * math.cos(a), 326 + 158 * t * math.sin(a)
        parts.append(f'  <ellipse cx="{x:.0f}" cy="{y:.0f}" rx="{r.uniform(16,40):.0f}" ry="{r.uniform(12,28):.0f}" '
                     f'fill="{shade(spread, 22 if r.random()<0.5 else -20)}" opacity="{r.uniform(0.2,0.45):.2f}" filter="url(#soften)"/>')
    for _ in range(11):
        a, t = r.uniform(0, math.tau), math.sqrt(r.random()) * 0.82
        x, y = 320 + 168 * t * math.cos(a), 326 + 150 * t * math.sin(a)
        rr = r.uniform(24, 34)
        parts.append(f'  <circle cx="{x:.0f}" cy="{y+3:.0f}" r="{rr:.0f}" fill="#000" opacity="0.2" filter="url(#soften)"/>')
        parts.append(f'  <circle cx="{x:.0f}" cy="{y:.0f}" r="{rr:.0f}" fill="{fruit}"/>')
        parts.append(f'  <circle cx="{x:.0f}" cy="{y:.0f}" r="{rr*0.62:.0f}" fill="{shade(fruit,16)}"/>')
        for k in range(3):
            parts.append(f'  <circle cx="{x + math.cos(k*2.1)*rr*0.26:.0f}" cy="{y + math.sin(k*2.1)*rr*0.26:.0f}" r="{rr*0.09:.0f}" fill="{shade(fruit,-48)}" opacity="0.6"/>')
    parts.append('  <ellipse cx="248" cy="228" rx="96" ry="58" fill="#fff" opacity="0.14" transform="rotate(-22 248 228)" filter="url(#soften)"/>')
    parts.append(footer())
    return "\n".join(parts)

def bottle(seed, liquid, cap, label_dark=False):
    """A chilled bottle, seen straight on, with condensation."""
    r = rnd(seed)
    parts = [header(seed, "#eef4f7", "#cfdde5")]
    parts.append('  <g filter="url(#drop)">')
    parts.append(f'    <path d="M262 168 h116 v44 q0 22 16 38 l22 24 q18 20 18 48 v190 q0 34 -34 34 h-160 q-34 0 -34 -34 v-190 q0 -28 18 -48 l22 -24 q16 -16 16 -38 z" fill="{shade(liquid,-40)}"/>')
    parts.append(f'    <path d="M266 172 h108 v40 q0 22 16 38 l22 24 q16 18 16 44 v186 q0 30 -30 30 h-156 q-30 0 -30 -30 v-186 q0 -26 16 -44 l22 -24 q16 -16 16 -38 z" fill="{liquid}"/>')
    parts.append('  </g>')
    parts.append(f'  <rect x="258" y="140" width="124" height="38" rx="9" fill="{cap}"/>')
    parts.append(f'  <rect x="258" y="140" width="124" height="12" rx="6" fill="{shade(cap,34)}" opacity="0.6"/>')
    parts.append(f'  <rect x="212" y="356" width="216" height="118" rx="10" fill="{"#1d2733" if label_dark else "#ffffff"}" opacity="0.94"/>')
    parts.append(f'  <rect x="232" y="386" width="176" height="16" rx="8" fill="{liquid}" opacity="0.75"/>')
    parts.append(f'  <rect x="232" y="414" width="122" height="12" rx="6" fill="{liquid}" opacity="0.45"/>')
    parts.append('  <path d="M232 214 q-14 40 -14 96 v150" fill="none" stroke="#fff" stroke-width="18" stroke-linecap="round" opacity="0.26"/>')
    parts.append('  <path d="M402 236 q8 34 8 84 v128" fill="none" stroke="#fff" stroke-width="9" stroke-linecap="round" opacity="0.16"/>')
    for _ in range(40):
        x, y = r.uniform(196, 444), r.uniform(190, 560)
        parts.append(f'  <circle cx="{x:.0f}" cy="{y:.0f}" r="{r.uniform(2,6):.1f}" fill="#fff" opacity="{r.uniform(0.1,0.4):.2f}"/>')
    parts.append(footer())
    return "\n".join(parts)

# --- the sixteen ------------------------------------------------------------

RED = "#b5341f"
CHEESE = "#f0c45c"
PEPPERONI = ["#b3302a", "#9c2621", "#c43a2f"]
GREEN = ["#4c7a2e", "#3d6626", "#5c8c38"]
CHICKEN = ["#e6c27a", "#d9ae5f", "#f0d08c"]

ITEMS = {
  "pizza-margherita": lambda: pizza(11, RED, CHEESE, [
      (9, (16, 24), GREEN, "leaf"),
      (7, (12, 18), ["#f3f0e4", "#fbf8ee"], "disc")]),
  "pizza-pepperoni": lambda: pizza(22, RED, CHEESE, [
      (16, (20, 30), PEPPERONI, "disc")]),
  "pizza-veggie": lambda: pizza(33, RED, CHEESE, [
      (9, (16, 24), GREEN, "leaf"),
      (8, (14, 22), ["#3f7d3f", "#2f6b33"], "ring"),
      (7, (12, 19), ["#e0762a", "#cf6520"], "chunk"),
      (8, (9, 14), ["#2c2c2c", "#454545"], "ring"),
      (6, (11, 16), ["#f0e6c8"], "ring")]),
  "pizza-bbq-chicken": lambda: pizza(44, "#7b3a17", CHEESE, [
      (13, (15, 24), CHICKEN, "chunk"),
      (8, (10, 16), ["#8b3f1b", "#6f3214"], "leaf"),
      (6, (11, 17), ["#c0392b"], "ring")]),
  "pizza-chicken-ranch": lambda: pizza(55, "#e8d9b0", "#f4d municipal", []),  # replaced below
  "pizza-supreme": lambda: pizza(66, RED, CHEESE, [
      (10, (18, 27), PEPPERONI, "disc"),
      (8, (14, 21), ["#6b4226", "#7d4e2c"], "chunk"),
      (7, (13, 20), CHICKEN, "chunk"),
      (7, (11, 17), ["#3f7d3f"], "ring"),
      (6, (10, 15), ["#2c2c2c"], "ring"),
      (6, (12, 18), ["#e8e0c8"], "ring")]),
  "fatayer-meat": lambda: pastry(77, "#e0b06a", "#7a4426", seeds=False),
  "fatayer-kraft-honey": lambda: pastry(88, "#e6bb78", "#f6e2a8", drizzle="#d99a1f"),
  "fatayer-zaatar": lambda: pastry(99, "#e2b471", "#4a6428", seeds=True),
  "mozzarella-sticks": lambda: sticks(101, "#faf0cf", "#dca24a", 7, sauce="#b5341f"),
  "garlic-bread": lambda: sticks(112, "#f6e6bd", "#e0b463", 6, sauce=None),
  "potato-wedges": lambda: sticks(123, "#f5dd9e", "#daa44c", 8, sauce=None),
  "nutella-banana": lambda: dessert(134, "#e3b875", "#4a2a17", "#f2d97a"),
  "pepsi": lambda: bottle(145, "#2b3a5c", "#c0392b", label_dark=True),
  "seven-up": lambda: bottle(156, "#3f8f52", "#f0f4f2"),
  "water": lambda: bottle(167, "#7fc4e0", "#2f6fa8"),
}

# The chicken-ranch entry above is intentionally rewritten here rather than
# inline, because it needs a white ranch base rather than tomato.
ITEMS["pizza-chicken-ranch"] = lambda: pizza(55, "#efe3c4", "#f6e2a6", [
      (13, (16, 25), CHICKEN, "chunk"),
      (8, (11, 17), ["#d8d2c0", "#e6e0cc"], "ring"),
      (7, (14, 20), ["#6b7f3a", "#56682f"], "leaf")])

def placeholder():
    parts = [header(5, "#f4ece0", "#ded0bb")]
    parts.append('  <g opacity="0.55">')
    parts.append('    <circle cx="320" cy="320" r="150" fill="none" stroke="#a08b6d" stroke-width="12" stroke-dasharray="26 20"/>')
    parts.append('    <path d="M250 352 l44 -52 38 40 32 -34 46 58 z" fill="#a08b6d"/>')
    parts.append('    <circle cx="272" cy="276" r="20" fill="#a08b6d"/>')
    parts.append('  </g>')
    parts.append(footer())
    return "\n".join(parts)

os.makedirs(OUT, exist_ok=True)
for name, make in ITEMS.items():
    with open(f"{OUT}/{name}.svg", "w") as fh:
        fh.write(make())
with open(f"{OUT}/placeholder.svg", "w") as fh:
    fh.write(placeholder())
print(f"wrote {len(ITEMS) + 1} files")
