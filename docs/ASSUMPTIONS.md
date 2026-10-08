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
| Business hours | 08:00–12:00 and 16:00–23:30 daily; **Friday evening only** | Client's published hours |
| Phone | `05375561` (landline) | Client listing |
| WhatsApp | `+967 772207788` | Client listing |
| Address | حضرموت، المكلا، فوه، حي المساكن — near Al Nour clinic, Al Ahgaff University and Al Sallal school | Client listing |
| Instagram | `@pizza_house66` | Client's profile |
| Transfer payment | Kuraimi / Al-Omqi / Al-Basiri wallets, number `772207788` | Client listing |

## Still unconfirmed

| Area | What is currently used | Where it lives | Confirm before launch |
|---|---|---|---|
| **Menu and prices** | **16 items from an early prototype.** The restaurant's own delivery-app listing shows ~184 (41+ pizzas with local flavours and a "House" size tier, ~40 drinks, 12 add-ons), and prices differ in both directions | Products → **Products** | **Yes — the biggest open item.** Evidence: `docs/FIELD-RESEARCH-2026-10.md` §4. Loader: `docs/MENU-IMPORT.md` |
| **Closing time** | 23:30 | **Hours** | **Yes** — Google Maps says 11 PM, the prototype says 11:30 PM |
| Preparation times | 20 min default; 1–8 min for drinks, sides and desserts | Per product → **Products** | **Yes** — the scheduling promise depends on these |
| Slot interval | 15 minutes | `Restaurant.slotIntervalMinutes` → **Settings** | Probably fine; confirm |
| Slot capacity | 10 orders per 15-minute window | `Restaurant.slotCapacity` → **Settings** | **Yes** — this is what protects the kitchen |
| Booking horizon | 3 days ahead | `Restaurant.maxScheduleDaysAhead` → **Settings** | Confirm |
| Minimum order | 0 (none) | `Restaurant.minOrderMinor` → **Settings** | Confirm |
| Currency subunit | YER, treated as having no practical subunit | `Restaurant.currency` → **Settings** | Confirm |
| Timezone | `Asia/Aden` (UTC+3, no DST) | `Restaurant.timezone` → **Settings** | Confirm — the whole schedule is evaluated in it |
| Map pin | **Done** — the restaurant's own Google Maps listing, coordinates 14.4891696, 49.0444845 | `Restaurant.mapUrl`, `latitude`, `longitude` → **Settings** | No |
| Extra phone numbers | **Not used.** The prototype lists two more (YOU 738227788, Sabafon 711227788); neither Google Maps nor Instagram does | `Restaurant` has one phone and one WhatsApp field | **Yes** — a wrong number on the contact page costs an order. If real, they need a place to live in **Settings** |
| Dining-room facts | **Not shown.** The prototype claims a family section, a youth hall, outdoor seating and a pickup corner | — | **Yes** — say what is true and the About page can carry it |
| Plus Code | `F2QV+MQ`, computed from the pin (the prototype prints `F2QV+HPW`, about 30 m away) | `src/lib/plus-code.ts` | Check it resolves to the door in Google Maps |
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

**Six of the seven Wikimedia photographs require attribution,** and those
licences are not decorative: CC BY 2.0 (Fatayer, Nutella pizza, potato
wedges), CC BY-SA 2.0 (mozzarella sticks), CC BY-SA 3.0 (garlic bread) and
CC BY-SA 4.0 (za'atar fatayer) all oblige the photographer to be named
wherever the work appears. Only Sfiha2.jpg is public domain, and Unsplash's
licence asks for nothing. For a while the site used all of them with no
credit anywhere, which is a breach the restaurant would have carried rather
than the agency that built the page. The credit is now at `/credits`, linked
from the footer of every page, and `src/lib/photo-credits.ts` holds the list.
`tests/integration/photo-credits.test.ts` fails if a dish is given a
Wikimedia photograph with no entry there — because nothing else connects a
row in the database to a name on a page.

**The three branded drinks keep a clean vector bottle, deliberately.** The
obvious move is a stock photo of a Pepsi can, and it is the wrong one. Each
of the three was checked against what is actually available:

| Item | Best licensed photograph | Why it is not used |
|---|---|---|
| Cold Pepsi, 330 ml can | `Pepsi_lime_330ml_can-front` | A *Pepsi Lime Zero Sugar* can — a different product |
| Cold 7-Up, 330 ml can | `7up_1.jpg` (CC BY 2.0, correct product) | A **bottle**; the menu sells a can |
| Drinking water, 500 ml | `…Vita_Pure_Distilled_Water_500ml…` | A specific Hong Kong brand, for an item that names no brand |

The reference build at `pizza-house66.ai.studio` ships all three anyway,
including the Pepsi Lime can for a plain Pepsi — which is how the problem was
found rather than assumed.

A customer ordering a cold Pepsi and being shown a lime zero-sugar can is a
factual error on a menu, not a stylistic preference. A correct bottle beats a
wrong photograph, and every large chain uses a neutral product image for
exactly this reason. All three are one upload away from being right the
moment the restaurant photographs its own fridge.

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
