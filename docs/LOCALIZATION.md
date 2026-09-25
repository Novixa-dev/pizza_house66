# Localization

Arabic is the default and English is opt-in — not the other way round. Al
Mukalla's customers read Arabic; English exists for visitors and for the
owner's own convenience. Getting that order right shapes the whole
implementation: RTL is the base layout, not a variant.

## How a locale is decided

`getLocale()` in `src/lib/i18n/locale.ts`:

1. The `ph_locale` cookie, if the visitor has chosen.
2. Otherwise `Accept-Language`, but only if it asks for English *ahead of*
   Arabic.
3. Otherwise Arabic.

The header check is deliberately asymmetric. A browser listing
`en-GB, ar;q=0.8` means someone who reads English; a browser listing Arabic
first, or nothing recognisable, gets Arabic. The default is never English by
accident.

Switching posts to `/api/locale`, which sets the cookie and redirects back —
a POST because it changes state, a form because it must work before
hydration.

## Two modules, one split that matters

| Module | Contents | Importable from |
|---|---|---|
| `src/lib/i18n/locale.ts` | `getLocale()` — reads cookies and headers | Server only (`import "server-only"`) |
| `src/lib/i18n/pick.ts` | `pick`, `pickValue`, `otherLocale`, `directionFor`, `joinList`, the cookie name | Anywhere |

The split exists because a shared component — a product card, say — renders
on both the server and the client, and needs `pick()`. Importing it from
`locale.ts` pulls `server-only` into the client bundle and the build fails.
The pure helpers live apart so that cannot happen; `locale.ts` re-exports them
so server code has one import.

## Content in two languages

Two mechanisms, for two kinds of text:

**Interface copy** — `src/lib/i18n/dictionaries.ts`, about 1,150 lines
covering the public site, the admin panel and the kitchen display.

```ts
const t = getDictionary(locale);
t.checkout.pickupTime;
```

The dictionary is typed so a key missing from `en` is a compile error, using
a mapped type that widens literal types without losing the shape:

```ts
type Widen<T> = T extends string ? string
  : T extends readonly (infer U)[] ? readonly Widen<U>[]
  : { -readonly [K in keyof T]: Widen<T[K]> };
type Dictionary = Widen<typeof ar>;
```

Without the widening, `as const` on the Arabic object makes every string its
own literal type and the English object is not assignable to it. This is the
one piece of type gymnastics in the codebase, and it buys a real guarantee:
adding an Arabic string without its English counterpart does not build.

**Restaurant data** — bilingual column pairs on the row itself:
`nameAr`/`nameEn`, `descriptionAr`/`descriptionEn`. The owner types both in
the admin panel.

```tsx
{pick(locale, product.nameAr, product.nameEn)}
```

Column pairs rather than a translations table because the set of translatable
fields is small, fixed, and always loaded together — a join per product to
fetch a name would be all cost and no benefit.

## Direction

The root layout sets `dir` and `lang` from the resolved locale, and every
layout rule is written in logical properties so it follows. `docs/DESIGN-SYSTEM.md`
has the details; the short version:

- `ps-`/`pe-`/`ms-`/`me-`/`text-start`/`border-s`, never `pl-`/`ml-`/`text-left`
- mirror directional icons (`rtl:-scale-x-100`), not all icons
- Arabic gets its own typeface and looser leading

## Numbers, dates and money

Western-Arabic digits (`1234`) throughout, in both languages. Eastern-Arabic
numerals (`١٢٣٤`) are correct Arabic but are not what Yemeni customers see on
a bank app, a price list or a phone keypad — following the convention people
actually use beats following the one that is formally tidier.

Numbers are wrapped in `.numeric`, which sets tabular figures and isolates
the span so RTL reordering cannot scramble `16:00 – 00:00`. **The class goes
on the number and nothing else** — putting it on a container that also holds
Arabic words reorders the label and eats the space before the value. That bug
was real, in nine places, and is documented at the class definition.

Money is formatted by `src/lib/money.ts` from integer minor units and the
restaurant's configured currency. No float ever touches a price.

Times and dates go through `src/lib/time.ts` with the restaurant's timezone,
so "19:00" means 19:00 in Al Mukalla regardless of where the server or the
reader is.

## Adding a language

1. Add the code to `Locale` and a dictionary object to `dictionaries.ts`. The
   type will list everything missing.
2. Add the schema columns if restaurant data needs it (`nameFr`, …) and
   extend `pick`.
3. Add its direction to `directionFor`.
4. Add the switcher entry.

Nothing else is language-aware. No component hardcodes a string, and no
layout hardcodes a direction.

## The known limitation

There is no distinct URL per language: `/menu` serves Arabic or English
depending on a cookie. That makes the two versions un-indexable separately,
which is the most significant SEO cost in the build. It is recorded in
`docs/DECISIONS.md` and `docs/SEO.md`, and migrating to `app/[lang]/…` is
additive — the dictionaries and `pick()` carry over untouched.
