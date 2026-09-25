# Assumptions Requiring Owner Confirmation

Every value below is a placeholder chosen to make the platform demonstrable.
**None of it is verified against the real Pizza House.**
`docs/RESTAURANT_DISCOVERY.md` records what could and could not be confirmed
and why.

All of it is **data, not code** — every entry is editable from the admin
panel without a developer or a deployment. That was a design goal, not a
convenience.

| Area | What is currently used | Where it lives | Confirm before launch |
|---|---|---|---|
| Menu, prices, descriptions | An illustrative menu of pizzas, sides, drinks and desserts with YER prices | `prisma/seed.ts` → editable in **Products** | **Yes** |
| Categories | Pizzas, sides, drinks, desserts | `prisma/seed.ts` → **Categories** | **Yes** |
| Business hours | 16:00–00:00 daily, no weekly closure | `prisma/seed.ts` → **Hours** | **Yes**, including any day off |
| Preparation times | 20 min default; 2–5 min for drinks and desserts | Per product → **Products** | **Yes** — the scheduling promise depends on these |
| Slot interval | 15 minutes | `Restaurant.slotIntervalMinutes` → **Settings** | Probably fine; confirm |
| Slot capacity | 10 orders per 15-minute window | `Restaurant.slotCapacity` → **Settings** | **Yes** — this is what protects the kitchen |
| Booking horizon | 3 days ahead | `Restaurant.maxScheduleDaysAhead` → **Settings** | Confirm |
| Minimum order | 0 (none) | `Restaurant.minOrderMinor` → **Settings** | Confirm |
| Currency | YER, treated as having no practical subunit | `Restaurant.currency` → **Settings** | Confirm |
| Timezone | `Asia/Aden` (UTC+3, no DST) | `Restaurant.timezone` → **Settings** | Confirm — the whole schedule is evaluated in it |
| Payment methods | Pay-at-pickup and bank transfer enabled; electronic disabled | `prisma/seed.ts` → **Settings → Payment methods** | **Yes** |
| Bank details | Placeholder bank name, account number and holder | `Restaurant.bank*` → **Settings** | **Yes** — check character by character |
| Contact details | Placeholder phone, WhatsApp, email, address, map link, coordinates | `Restaurant` → **Settings** | **Yes** |
| Social links | Placeholder Instagram/Facebook URLs | `Restaurant` → **Settings** | **Yes** |
| Product images | 18 generated SVG illustrations | `public/menu/*.svg` | **Yes** — real photography |
| Promotions | Two demo promotions | `prisma/seed.ts` → **Promotions** | **Yes** — delete or replace |
| Staff | Four demo accounts, one per role, `@pizzahouse.local` | `prisma/seed.ts` → **Staff** | **Yes** — delete them all |
| Existing systems | None assumed; this platform is treated as additive | — | Confirm whether an existing POS must run alongside |

## Two that were assumptions and are no longer

Recorded because earlier versions of this document listed them, and someone
reading an old copy should know they were resolved rather than forgotten:

- **~~Server timezone~~.** Earlier builds assumed the server clock was
  already in the restaurant's local time. It is not, on any normal host, and
  the silent failure was a three-hour shift in every pickup slot. Business
  hours are now evaluated in `Restaurant.timezone` via `src/lib/time.ts`,
  independent of the server's clock (`docs/DECISIONS.md`).
- **~~Database~~.** Earlier builds used SQLite for zero-setup development,
  with a note to switch. It is PostgreSQL with versioned migrations now.

## What this does not block

Nothing above blocks development, review or demonstration. The data model,
the scheduling engine, the ordering flow and the staff tools all work with
any real values substituted in — which is the point of keeping every
restaurant-specific value in data.

What it blocks is **launch**. A customer ordering from a placeholder menu at
placeholder prices, to be collected during placeholder hours, is worse than
no site at all. See `docs/HANDOVER.md`.
