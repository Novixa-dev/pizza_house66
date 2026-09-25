// Generates the menu illustration set in public/menu/.
//
// Why illustrations and not photographs: the real Pizza House food
// photography has to come from the restaurant. Shipping stock or generated
// "photos" would show customers a product that isn't what they'd receive, and
// binding the deployment to a third-party image CDN adds a dependency the
// app doesn't need. These are deliberately stylized, consistent, tiny
// (~2-4KB each), and sit in exactly the slot a real photo will later fill —
// swap the file, keep the path. See docs/ASSUMPTIONS.md.
//
// Run with: npm run art

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "menu");
const SIZE = 640;

const PALETTE = {
  crust: "#d9a441",
  crustDark: "#b8822c",
  dough: "#f3d9a4",
  sauce: "#c0392b",
  sauceDeep: "#9c2b20",
  cheese: "#f4c95d",
  cheeseDeep: "#e0a93c",
  basil: "#3f7d4e",
  basilLight: "#5a9c67",
  pepperoni: "#b3261e",
  olive: "#3d4a3d",
  mushroom: "#c9a882",
  onion: "#b9a3c9",
  pepper: "#3f8a35",
  chicken: "#d99a4e",
  cola: "#4a2c1a",
  juice: "#e8833a",
  water: "#8fc7e8",
  choco: "#5c3a24",
  cream: "#faf3e6",
  berry: "#9b2242",
  lettuce: "#6aa84f",
  bun: "#e0a962",
  patty: "#6b3f2a",
  fries: "#f0b429",
  plate: "#ffffff",
};

/** Deterministic pseudo-random so re-running the script produces identical art. */
function makeRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function wrap(background, body) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SIZE} ${SIZE}" width="${SIZE}" height="${SIZE}" role="img">
  <defs>
    <radialGradient id="bg" cx="50%" cy="38%" r="72%">
      <stop offset="0%" stop-color="${background.inner}"/>
      <stop offset="100%" stop-color="${background.outer}"/>
    </radialGradient>
    <filter id="soft" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="10" stdDeviation="16" flood-color="#2a1b10" flood-opacity="0.18"/>
    </filter>
  </defs>
  <rect width="${SIZE}" height="${SIZE}" fill="url(#bg)"/>
${body}
</svg>
`;
}

const WARM = { inner: "#fdf4e6", outer: "#f0dfc4" };
const COOL = { inner: "#f4f7f8", outer: "#dfe8ec" };
const DARK = { inner: "#f7ece0", outer: "#e6d2b8" };

/** Scatters n items over a disc without clustering them in the centre. */
function scatter(random, count, radius, cx, cy, render) {
  const parts = [];
  for (let i = 0; i < count; i++) {
    const angle = random() * Math.PI * 2;
    const distance = Math.sqrt(random()) * radius;
    parts.push(render(cx + Math.cos(angle) * distance, cy + Math.sin(angle) * distance, i));
  }
  return parts.join("\n");
}

function pizza({ seed, toppings }) {
  const random = makeRandom(seed);
  const cx = SIZE / 2;
  const cy = SIZE / 2;
  const outer = 245;
  const sauceR = 200;

  const layers = [
    `  <g filter="url(#soft)">`,
    `    <circle cx="${cx}" cy="${cy}" r="${outer}" fill="${PALETTE.crust}"/>`,
    `    <circle cx="${cx}" cy="${cy}" r="${outer - 12}" fill="${PALETTE.dough}"/>`,
    `    <circle cx="${cx}" cy="${cy}" r="${sauceR}" fill="${PALETTE.sauce}"/>`,
    `    <circle cx="${cx}" cy="${cy}" r="${sauceR - 8}" fill="${PALETTE.cheese}"/>`,
    `  </g>`,
    // Melted-cheese blotches for texture rather than a flat disc.
    scatter(random, 14, sauceR - 40, cx, cy, (x, y) => {
      const r = 22 + random() * 26;
      return `  <circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(1)}" fill="${PALETTE.cheeseDeep}" opacity="0.45"/>`;
    }),
    // Crust bubbles.
    scatter(makeRandom(seed + 77), 10, outer - 6, cx, cy, (x, y) => {
      const dx = x - cx;
      const dy = y - cy;
      const d = Math.hypot(dx, dy);
      if (d < outer - 40) return "";
      return `  <circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(6 + random() * 5).toFixed(1)}" fill="${PALETTE.crustDark}" opacity="0.5"/>`;
    }),
  ];

  // Each topping type gets its own stream, seeded from the pizza and its
  // position in the list, so a four-topping pizza spreads evenly instead of
  // inheriting a stream that has already drifted to one side of the pie.
  for (const [index, topping] of toppings.entries()) {
    const toppingRandom = makeRandom(seed * 31 + index * 761 + 991);
    const density = toppings.length > 2 ? 0.7 : 1;
    switch (topping) {
      case "pepperoni":
        layers.push(
          scatter(toppingRandom, Math.round(11 * density), sauceR - 52, cx, cy, (x, y) =>
            `  <g><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="30" fill="${PALETTE.pepperoni}"/><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="30" fill="#000" opacity="0.08"/><circle cx="${(x - 8).toFixed(1)}" cy="${(y - 7).toFixed(1)}" r="5" fill="#8d1b15" opacity="0.6"/></g>`
          )
        );
        break;
      case "basil":
        layers.push(
          scatter(toppingRandom, Math.round(9 * density), sauceR - 58, cx, cy, (x, y, i) =>
            `  <ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="26" ry="15" fill="${i % 2 ? PALETTE.basil : PALETTE.basilLight}" transform="rotate(${(toppingRandom() * 180).toFixed(0)} ${x.toFixed(1)} ${y.toFixed(1)})"/>`
          )
        );
        break;
      case "olive":
        layers.push(
          scatter(toppingRandom, Math.round(14 * density), sauceR - 55, cx, cy, (x, y) =>
            `  <g><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="14" fill="${PALETTE.olive}"/><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="6" fill="${PALETTE.cheese}"/></g>`
          )
        );
        break;
      case "mushroom":
        layers.push(
          scatter(toppingRandom, Math.round(10 * density), sauceR - 60, cx, cy, (x, y) =>
            `  <path d="M ${(x - 24).toFixed(1)} ${y.toFixed(1)} a 24 18 0 0 1 48 0 z" fill="${PALETTE.mushroom}"/><rect x="${(x - 6).toFixed(1)}" y="${y.toFixed(1)}" width="12" height="16" rx="4" fill="${PALETTE.mushroom}" opacity="0.8"/>`
          )
        );
        break;
      case "chicken":
        layers.push(
          scatter(toppingRandom, Math.round(13 * density), sauceR - 58, cx, cy, (x, y) =>
            `  <rect x="${(x - 20).toFixed(1)}" y="${(y - 12).toFixed(1)}" width="40" height="24" rx="10" fill="${PALETTE.chicken}" stroke="#b97c34" stroke-width="3" transform="rotate(${(toppingRandom() * 90 - 45).toFixed(0)} ${x.toFixed(1)} ${y.toFixed(1)})"/>`
          )
        );
        break;
      case "pepper":
        layers.push(
          scatter(toppingRandom, Math.round(12 * density), sauceR - 60, cx, cy, (x, y) =>
            `  <path d="M ${(x - 22).toFixed(1)} ${y.toFixed(1)} q 22 -20 44 0 q -22 12 -44 0 z" fill="${PALETTE.pepper}" stroke="#2f6b28" stroke-width="2.5" transform="rotate(${(toppingRandom() * 180).toFixed(0)} ${x.toFixed(1)} ${y.toFixed(1)})"/>`
          )
        );
        break;
      case "onion":
        layers.push(
          scatter(toppingRandom, Math.round(10 * density), sauceR - 62, cx, cy, (x, y) =>
            `  <path d="M ${(x - 26).toFixed(1)} ${y.toFixed(1)} a 26 26 0 0 1 52 0" fill="none" stroke="${PALETTE.onion}" stroke-width="7" stroke-linecap="round" transform="rotate(${(toppingRandom() * 360).toFixed(0)} ${x.toFixed(1)} ${y.toFixed(1)})"/>`
          )
        );
        break;
    }
  }

  return wrap(WARM, layers.filter(Boolean).join("\n"));
}

function drink({ seed, liquid, label }) {
  const cx = SIZE / 2;
  const body = `  <g filter="url(#soft)">
    <path d="M 210 170 L 430 170 L 405 500 Q 403 520 383 520 L 257 520 Q 237 520 235 500 Z" fill="#ffffff" opacity="0.92"/>
    <path d="M 222 235 L 418 235 L 400 495 Q 398 508 385 508 L 255 508 Q 242 508 240 495 Z" fill="${liquid}"/>
    <rect x="200" y="150" width="240" height="34" rx="17" fill="#f2f2f2"/>
    <rect x="${cx - 14}" y="70" width="28" height="100" rx="12" fill="#c8ced4" transform="rotate(12 ${cx} 120)"/>
    <rect x="252" y="290" width="136" height="86" rx="12" fill="#ffffff" opacity="0.85"/>
    <text x="${cx}" y="345" font-family="Verdana,DejaVu Sans,sans-serif" font-size="34" font-weight="700" fill="#b3261e" text-anchor="middle">${label}</text>
  </g>`;
  return wrap(seed % 2 === 0 ? COOL : WARM, body);
}

function bottle({ liquid, label }) {
  const cx = SIZE / 2;
  const body = `  <g filter="url(#soft)">
    <path d="M 275 110 L 365 110 L 365 175 Q 415 215 415 285 L 415 505 Q 415 530 390 530 L 250 530 Q 225 530 225 505 L 225 285 Q 225 215 275 175 Z" fill="#eef3f6" opacity="0.95"/>
    <path d="M 245 300 L 395 300 L 395 500 Q 395 512 383 512 L 257 512 Q 245 512 245 500 Z" fill="${liquid}"/>
    <rect x="268" y="86" width="104" height="36" rx="10" fill="#b3261e"/>
    <rect x="248" y="330" width="144" height="82" rx="10" fill="#ffffff" opacity="0.9"/>
    <text x="${cx}" y="382" font-family="Verdana,DejaVu Sans,sans-serif" font-size="30" font-weight="700" fill="#2b2118" text-anchor="middle">${label}</text>
  </g>`;
  return wrap(COOL, body);
}

function dessert({ seed, base, topping }) {
  const random = makeRandom(seed);
  const cx = SIZE / 2;
  const body = `  <g filter="url(#soft)">
    <ellipse cx="${cx}" cy="470" rx="215" ry="42" fill="${PALETTE.plate}"/>
    <rect x="165" y="250" width="310" height="215" rx="26" fill="${base}"/>
    <rect x="165" y="250" width="310" height="52" rx="26" fill="${topping}"/>
    <rect x="165" y="292" width="310" height="22" fill="${topping}"/>
${scatter(random, 9, 130, cx, 330, (x, y) => `    <circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(8 + random() * 7).toFixed(1)}" fill="${PALETTE.cream}" opacity="0.7"/>`)}
    <path d="M ${cx - 46} 250 q 46 -70 92 0 z" fill="${PALETTE.cream}"/>
  </g>`;
  return wrap(DARK, body);
}

function burger() {
  const cx = SIZE / 2;
  const body = `  <g filter="url(#soft)">
    <ellipse cx="${cx}" cy="500" rx="205" ry="34" fill="${PALETTE.plate}"/>
    <path d="M 135 300 q 185 -185 370 0 z" fill="${PALETTE.bun}"/>
    <rect x="135" y="300" width="370" height="30" rx="14" fill="${PALETTE.lettuce}"/>
    <rect x="145" y="326" width="350" height="46" rx="16" fill="${PALETTE.patty}"/>
    <rect x="150" y="368" width="340" height="24" rx="12" fill="${PALETTE.cheese}"/>
    <path d="M 150 392 q 170 44 340 0 l 0 32 q -170 46 -340 0 z" fill="${PALETTE.bun}"/>
    <circle cx="255" cy="238" r="7" fill="#fff8e7"/>
    <circle cx="330" cy="212" r="7" fill="#fff8e7"/>
    <circle cx="400" cy="244" r="7" fill="#fff8e7"/>
  </g>`;
  return wrap(WARM, body);
}

function fries() {
  const random = makeRandom(4242);
  const sticks = [];
  for (let i = 0; i < 16; i++) {
    const x = 220 + i * 13 + random() * 6;
    const height = 150 + random() * 90;
    sticks.push(
      `    <rect x="${x.toFixed(1)}" y="${(330 - height).toFixed(1)}" width="16" height="${height.toFixed(1)}" rx="6" fill="${PALETTE.fries}" transform="rotate(${(random() * 18 - 9).toFixed(1)} ${x.toFixed(1)} 330)"/>`
    );
  }
  const body = `  <g filter="url(#soft)">
${sticks.join("\n")}
    <path d="M 200 320 L 440 320 L 412 512 Q 410 528 392 528 L 248 528 Q 230 528 228 512 Z" fill="${PALETTE.sauce}"/>
    <rect x="256" y="370" width="128" height="72" rx="10" fill="#ffffff" opacity="0.9"/>
    <text x="${SIZE / 2}" y="420" font-family="Verdana,DejaVu Sans,sans-serif" font-size="30" font-weight="700" fill="${PALETTE.sauceDeep}" text-anchor="middle">PH</text>
  </g>`;
  return wrap(WARM, body);
}

function salad() {
  const random = makeRandom(8181);
  const leaves = scatter(random, 26, 150, SIZE / 2, 340, (x, y) => {
    const tone = [PALETTE.lettuce, PALETTE.basil, PALETTE.basilLight][Math.floor(random() * 3)];
    return `    <ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="${(30 + random() * 18).toFixed(1)}" ry="${(18 + random() * 10).toFixed(1)}" fill="${tone}" transform="rotate(${(random() * 180).toFixed(0)} ${x.toFixed(1)} ${y.toFixed(1)})"/>`;
  });
  const tomatoes = scatter(makeRandom(313), 7, 120, SIZE / 2, 340, (x, y) =>
    `    <circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="18" fill="${PALETTE.sauce}"/>`
  );
  const body = `  <g filter="url(#soft)">
    <circle cx="${SIZE / 2}" cy="340" r="195" fill="${PALETTE.plate}"/>
    <circle cx="${SIZE / 2}" cy="340" r="172" fill="#f6efe2"/>
${leaves}
${tomatoes}
  </g>`;
  return wrap(COOL, body);
}

function calzone() {
  const body = `  <g filter="url(#soft)">
    <ellipse cx="${SIZE / 2}" cy="480" rx="200" ry="36" fill="${PALETTE.plate}"/>
    <path d="M 130 400 q 40 -215 190 -215 q 150 0 190 215 q -190 60 -380 0 z" fill="${PALETTE.dough}"/>
    <path d="M 130 400 q 190 62 380 0 q -20 56 -190 56 q -170 0 -190 -56 z" fill="${PALETTE.crust}"/>
    <path d="M 240 250 q 40 -34 80 0" fill="none" stroke="${PALETTE.crustDark}" stroke-width="9" stroke-linecap="round"/>
    <path d="M 300 320 q 40 -34 80 0" fill="none" stroke="${PALETTE.crustDark}" stroke-width="9" stroke-linecap="round"/>
    <path d="M 200 330 q 36 -30 72 0" fill="none" stroke="${PALETTE.crustDark}" stroke-width="9" stroke-linecap="round"/>
  </g>`;
  return wrap(WARM, body);
}

const FILES = {
  "pizza-margherita.svg": pizza({ seed: 11, toppings: ["basil"] }),
  "pizza-pepperoni.svg": pizza({ seed: 23, toppings: ["pepperoni"] }),
  "pizza-chicken-ranch.svg": pizza({ seed: 37, toppings: ["chicken", "onion"] }),
  "pizza-veggie.svg": pizza({ seed: 51, toppings: ["pepper", "olive", "mushroom", "onion"] }),
  "pizza-four-cheese.svg": pizza({ seed: 67, toppings: [] }),
  "pizza-special.svg": pizza({ seed: 83, toppings: ["pepperoni", "olive", "pepper", "mushroom"] }),
  "pizza-spicy-beef.svg": pizza({ seed: 97, toppings: ["pepperoni", "pepper"] }),
  "calzone.svg": calzone(),
  "burger.svg": burger(),
  "fries.svg": fries(),
  "salad.svg": salad(),
  "cola.svg": drink({ seed: 2, liquid: PALETTE.cola, label: "COLA" }),
  "orange-juice.svg": drink({ seed: 3, liquid: PALETTE.juice, label: "JUICE" }),
  "water.svg": bottle({ liquid: PALETTE.water, label: "WATER" }),
  "mojito.svg": drink({ seed: 4, liquid: "#7fbf6a", label: "MOJITO" }),
  "chocolate-cake.svg": dessert({ seed: 5, base: PALETTE.choco, topping: "#3d2416" }),
  "cheesecake.svg": dessert({ seed: 6, base: PALETTE.cream, topping: PALETTE.berry }),
  "tiramisu.svg": dessert({ seed: 7, base: "#e8d9bf", topping: PALETTE.choco }),
};

mkdirSync(OUT_DIR, { recursive: true });
for (const [name, content] of Object.entries(FILES)) {
  writeFileSync(join(OUT_DIR, name), content, "utf8");
}
console.log(`Wrote ${Object.keys(FILES).length} menu illustrations to public/menu/`);
