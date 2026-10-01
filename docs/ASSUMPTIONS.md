# Assumptions Requiring Owner Confirmation

Most of what this platform shows is now the **real Pizza House 66**, taken
from the restaurant's own published listing and its Instagram profile —
`docs/RESTAURANT_DISCOVERY.md` records where each value came from and how it
was verified. This document is now the short list of what is still a guess.

All of it is **data, not code** — every entry is editable from the admin
panel without a developer or a deployment. That was a design goal, not a
convenience.

## Confirmed against the client's own listing

These were placeholders and are not any more. Listed so nobody re-confirms
work that is already done, and so a discrepancy is noticed rather than
assumed to be a known gap.

| Area | What is used now | Source |
|---|---|---|
| Restaurant name | بيتزا هاوس 66 / Pizza House 66 | Client listing and Instagram handle |
| Menu and prices | 16 items in 5 categories, YER prices from 400 to 5,500 | Client's published menu |
| Business hours | 08:00–12:00 and 16:00–23:30 daily; **Friday evening only** | Client's published hours |
| Phone | `05375561` (landline) | Client listing |
| WhatsApp | `+967 772207788` | Client listing |
| Address | حضرموت، المكلا، فوه، حي المساكن — near Al Nour clinic, Al Ahgaff University and Al Sallal school | Client listing |
| Instagram | `@pizza_house66` | Client's profile |
| Transfer payment | Kuraimi / Al-Omqi / Al-Basiri wallets, number `772207788` | Client listing |

## Still unconfirmed

| Area | What is currently used | Where it lives | Confirm before launch |
|---|---|---|---|
| Preparation times | 20 min default; 1–8 min for drinks, sides and desserts | Per product → **Products** | **Yes** — the scheduling promise depends on these |
| Slot interval | 15 minutes | `Restaurant.slotIntervalMinutes` → **Settings** | Probably fine; confirm |
| Slot capacity | 10 orders per 15-minute window | `Restaurant.slotCapacity` → **Settings** | **Yes** — this is what protects the kitchen |
| Booking horizon | 3 days ahead | `Restaurant.maxScheduleDaysAhead` → **Settings** | Confirm |
| Minimum order | 0 (none) | `Restaurant.minOrderMinor` → **Settings** | Confirm |
| Currency subunit | YER, treated as having no practical subunit | `Restaurant.currency` → **Settings** | Confirm |
| Timezone | `Asia/Aden` (UTC+3, no DST) | `Restaurant.timezone` → **Settings** | Confirm — the whole schedule is evaluated in it |
| Map pin | A search link, not a dropped pin with coordinates | `Restaurant.mapUrl`, `latitude`, `longitude` → **Settings** | **Yes** — ask for the exact pin |
| Email | None set; the restaurant may not use one | `Restaurant.email` → **Settings** | Confirm |
| Facebook | None set | `Restaurant.facebookUrl` → **Settings** | Confirm whether one exists |
| Public holidays | None entered | **Hours → Overrides** | **Yes** — Eid in particular |
| Menu photographs | 13 licensed stock photographs (Unsplash licence, Creative Commons) | `prisma/seed.ts` → **Products → Dish photo** | **Yes** — replace with the restaurant's own |
| Drink artwork | 3 vector bottles, from `scripts/generate-menu-art.py` | `public/menu/*.svg` | Optional — see below |
| Coupons | Three launch coupons seeded as examples | `prisma/seed.ts` → **Coupons** | **Yes** — the client sets the real discounts |
| Staff | Four demo accounts, one per role, `@pizzahouse.local` | `prisma/seed.ts` → **Staff** | **Yes** — delete them all and issue real ones |
| Existing systems | None assumed; this platform is treated as additive | — | Confirm whether an existing POS must run alongside |

### On the menu pictures specifically

**The thirteen food items carry real photographs.** They are licensed stock —
Unsplash's own licence and Creative Commons via Wikimedia — served from those
hosts and re-encoded by Next's optimizer to AVIF or WebP at whatever size the
device asks for. The two hostnames are named explicitly in `next.config.ts`;
a wildcard there would turn this server into an open image proxy with the
restaurant's name on it.

**The three branded drinks keep a clean vector bottle, deliberately.** The
obvious move is a stock photo of a Pepsi can, and it is the wrong one: the
best-licensed photograph available shows a *Pepsi Lime Zero Sugar* can, which
is a different product from the one the restaurant sells. A customer ordering
a cold Pepsi and being shown a lime zero-sugar can is a factual error on a
menu, not a stylistic preference. Every large chain uses a neutral product
icon for exactly this reason.

These photographs are stand-ins, not the end state.

The replacement path is built in and needs no developer: **Admin → Products →
a product → Dish photo → upload**. The photo is stored in the database, takes
precedence over everything else immediately, and appears on the menu, the
product page, the cart and the order page at once.

The client's own photograph of their own pizza beats any stock picture and
every generated one. Ten minutes with a phone camera near a window is the
single highest-value hour anyone can spend on this site.

## Three that were assumptions and are no longer

Recorded because earlier versions of this document listed them, and someone
reading an old copy should know they were resolved rather than forgotten:

- **~~Server timezone~~.** Earlier builds assumed the server clock was
  already in the restaurant's local time. It is not, on any normal host, and
  the silent failure was a three-hour shift in every pickup slot. Business
  hours are now evaluated in `Restaurant.timezone` via `src/lib/time.ts`,
  independent of the server's clock (`docs/DECISIONS.md`).
- **~~Database~~.** Earlier builds used SQLite for zero-setup development,
  with a note to switch. It is PostgreSQL with versioned migrations now.
- **~~One trading period a day~~.** The schema allowed a single open window
  per weekday, which cannot express a kitchen that shuts between lunch and
  dinner. It held a lie about this restaurant for as long as it existed: the
  seeded 16:00–00:00 would have sold a 14:00 pickup during a closed kitchen.
  A day now holds as many windows as it needs, and Friday holds one.

## What this does not block

Nothing above blocks development, review or demonstration, and the menu,
prices, hours and contact details are now the real ones — so a demo to the
client shows the client's own restaurant.

What it still blocks is **launch**: the demo staff accounts must be deleted
and real ones issued, the slot capacity must be a number the kitchen agrees
it can cook, and the coupons must be discounts the owner actually wants to
give. See `docs/HANDOVER.md`.
