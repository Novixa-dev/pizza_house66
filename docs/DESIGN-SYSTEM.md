# Design System

`docs/PRD.md` §48 asks for a restaurant that reads as premium without
resorting to what it calls "gradient soup". The result is a small,
token-driven system: one warm palette, generous spacing, real typographic
hierarchy, and restraint everywhere else.

## Tokens

All of it lives in the `:root` block of `src/app/globals.css` and is exposed
to Tailwind through `@theme inline`. **Components reference semantic names
only** — `bg-surface`, `text-ink-muted`, `border-line` — never a raw hex.
Retheming for another restaurant (the Novixa Restaurant direction) is a
change to that one block.

### Colour

| Token | Role |
|---|---|
| `page`, `page-elevated` | The warm off-white the site sits on |
| `surface`, `surface-muted` | Cards and panels |
| `ink`, `ink-soft`, `ink-muted` | Three levels of text emphasis |
| `line`, `line-strong` | Hairlines and stronger borders |
| `brand`, `brand-hover`, `brand-soft`, `brand-ink` | The tomato red, its hover, its wash, and text that sits on it |
| `accent`, `accent-soft` | Basil green — success, availability |
| `gold`, `gold-soft` | Warm highlight — featured, premium |
| `danger`, `info` (+ `-soft`) | State colour |

The palette is food-first: tomato, basil, warm gold, an oven-warm neutral
ground. No blue-grey SaaS dashboard, no black-on-white minimalism — this is a
restaurant.

**Every text pair meets WCAG AA at its rendered size, in both schemes.** Dark
mode is a full re-declaration of the same token names under
`prefers-color-scheme: dark`, not an inversion filter — the brand red lightens
to `#e8685a` because the dark-mode original would fail contrast on a dark
ground.

### Shape, depth, spacing

Four radii (`sm` 0.5rem → `xl` 1.75rem) and three shadows, and the shadows are
deliberately soft and warm-tinted (`rgb(31 24 17 / …)`, not black) so a card
looks lifted rather than cut out.

## Components

`src/components/ui/index.tsx` — sixteen primitives every screen is built
from:

`Button` · `ButtonLink` · `Card` · `SectionHeading` · `Badge` · `Alert` ·
`EmptyState` · `Field` · `Input` · `Textarea` · `Select` · `Checkbox` ·
`StatCard` · `DescriptionRow` · `Divider` · `buttonClass`

Three rules they all follow:

1. **Variants are props, not class strings at the call site.**
   `<Button variant="secondary" size="lg">`, never a hand-assembled
   `className`. One button looks the same everywhere because there is one
   button.
2. **Interactive targets are at least 44 px tall.** A cook taps these with a
   thumb, in a hurry, possibly with flour on their hands.
3. **`Field` owns the label/description/error relationship.** It generates the
   ids and wires `aria-describedby` and `aria-invalid`, so accessible form
   markup is the path of least resistance rather than a thing to remember.

`src/components/ui/icons.tsx` holds the icon set — inline SVG, `currentColor`,
no icon-font dependency and no runtime fetch.

## Right-to-left

Arabic is the default language, so RTL is the default layout, not a variant
bolted on afterwards.

**Use logical properties.** `ps-4`/`pe-4`, `ms-auto`, `text-start`,
`border-s` — never `pl-4`, `ml-auto`, `text-left`. Tailwind's logical
utilities flip with `dir` automatically; the physical ones do not, and the
bug they cause only appears in the language most of the customers use.

**Mirror directional icons, not all of them.** A back arrow gets
`rtl:-scale-x-100` because "back" points the other way in RTL. A clock does
not.

**Arabic gets its own typeface and looser leading:**

```css
[dir="rtl"] body { font-family: var(--font-arabic); line-height: 1.75; }
```

Arabic script needs vertical room that Latin does not; setting both at
identical leading makes the Arabic look cramped and the Latin look loose.

### The `.numeric` rule — the subtle one

Prices, times, order references and phone numbers use Western-Arabic digits,
tabular figures, and `direction: ltr` with `unicode-bidi: isolate`. The
isolation is what keeps `16:00 – 00:00` from being reordered by the
surrounding RTL paragraph.

**Apply it to the number only — never to a container that also holds Arabic
words.** Forcing `direction: ltr` on mixed content reorders the label and eats
the space between it and the value:

```jsx
// wrong — renders as "يبدأ من2,200"
<p className="numeric">يبدأ من {price} ريال</p>

// right
<p>يبدأ من <span className="numeric">{price}</span> ريال</p>
```

This was a real bug in nine places in this codebase, found by rendering every
page in Arabic and reading it. The rule is written into `globals.css` beside
the class so the next person meets it before they make the same mistake.

## Motion

Short and functional: 160 ms transitions on cards and buttons, nothing that
animates on load, nothing that moves while someone is reading a price.
`prefers-reduced-motion: reduce` collapses every animation and transition to
0.01 ms and disables smooth scrolling — one global block, so a new component
cannot forget to honour it.

## Focus

```css
:focus-visible { outline: 2px solid var(--brand); outline-offset: 2px; }
```

Global, high-contrast, and never removed. `.sr-only-focusable` handles skip
links — visually hidden until focused, then fully visible.

## Imagery

18 SVG illustrations in `public/menu/`, generated deterministically by
`scripts/generate-menu-art.mjs`.

They are illustrations rather than photographs on purpose. Real food
photography has to come from the restaurant; stock photos show a customer a
product they will not receive, and an external image CDN adds a deployment
dependency the app does not need. Each illustration sits at exactly the path
a real photo will replace — swap the file, keep the path.

`public/brand/` holds the wordmark and the maskable PWA icon, both SVG.

## Adding a screen

1. Compose from `src/components/ui`. If a primitive is nearly right, extend it
   there rather than forking it locally.
2. Use tokens. If you need a colour that does not exist, add it to `:root`
   for both schemes and check its contrast.
3. Use logical properties.
4. Wrap bare numbers in `.numeric`, and nothing else.
5. Look at it in Arabic on a phone-width viewport before calling it done.
   That is how most of the customers will see it.
