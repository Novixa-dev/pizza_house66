# Pizza House — Digital Ordering & Restaurant Operations Platform

A bilingual (Arabic-first RTL / English LTR) ordering and operations platform
for Pizza House, Al Mukalla, Yemen.

It is built around one idea, taken from `docs/PROJECT_ORIGIN.md` §4: the
customer chooses **when they want to collect their food**, and the system
works backwards from that to decide **when the kitchen should start** — so the
order is ready as they arrive, not sitting under a lamp for forty minutes and
not still in the oven.

Everything else in the product exists to make that one promise keepable:
slot capacity so the kitchen is never handed more than it can cook, a
release scheduler that feeds the kitchen display on time, a payment flow that
does not let an unverified transfer take a slot, and a staff panel where the
restaurant can change every rule without a developer.

This is also the reference implementation for **Novixa Restaurant**, a
reusable product for other restaurants — see `docs/ROADMAP.md`.

---

## The core mechanic in one diagram

```
 customer picks pickup 19:00
            │
            │  prep time for this basket = 25 min  (per-product, max of items)
            ▼
 kitchenReleaseAt = 19:00 − 25 min = 18:35
            │
            ├── 16:00  order placed        → CONFIRMED, invisible to the kitchen
            ├── 18:35  release scheduler    → QUEUED, appears on the kitchen display
            ├── 18:37  cook starts          → PREPARING
            └── 18:58  food is bagged       → READY   (customer notified)
                19:00  customer arrives     → COMPLETED
```

Worked through in `src/lib/scheduling.ts`, tested to the minute in
`tests/unit/scheduling.test.ts`, and explained in `docs/ARCHITECTURE.md`.

---

## What is built

**Customer site** (`/`)
- Home with hours, location, payment methods and `Restaurant` structured data
- Database-driven menu with category filter and search
- Product pages with a generic option system (size, crust, add-ons) and
  live price preview
- Cart persisted client-side across reloads
- Checkout: guest details, ASAP or a specific pickup slot, promo code,
  payment method, bank-transfer receipt upload
- Order tracking by unguessable token, with a live timeline and auto-refresh
- Arabic (default, RTL) and English (LTR) throughout

**Staff admin** (`/admin`)
- Dashboard: today's revenue, order counts, live queue, upcoming pickups
- Orders: filterable list, full detail, status transitions, cancellation
- Payments: bank-transfer verification queue with receipt viewing
- Products, categories, option groups and values: full CRUD
- Promotions: percentage/fixed, minimum order, cap, date window, usage limit
- Customers: order history by phone
- Hours: weekly schedule plus dated overrides (holidays, closures)
- Settings: every restaurant-level rule, including pausing online ordering
- Staff: accounts and roles
- Reports: revenue, top products, payment mix, funnel
- Audit: who changed what, when

**Kitchen display** (`/kitchen`)
- Queued / Preparing / Ready board, auto-refreshing, one tap per transition
- Deliberately outside the admin shell — a cook needs no navigation

---

## Quick start

Requires Node 20+ and a PostgreSQL 16 database.

```bash
cp .env.example .env
# set DATABASE_URL, then:
sed -i "s/replace-with-a-long-random-secret/$(openssl rand -hex 32)/" .env

npm install
npm run db:migrate:dev     # create the schema
npm run db:seed            # demo restaurant, menu, staff
npm run dev
```

Open http://localhost:3000. Staff sign-in is at `/admin/login`; the seed
script prints the demo accounts and their password.

Full setup, including a local Postgres in one command, is in
`docs/ENVIRONMENT.md`.

---

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build / serve |
| `npm run verify` | typecheck → lint → unit tests → build. Run this before pushing |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint (flat config) |
| `npm test` | Unit tests (Vitest) |
| `npm run test:integration` | Integration tests against a real database |
| `npm run test:e2e` | Playwright end-to-end suite |
| `npm run db:migrate:dev` | Create/apply a migration in development |
| `npm run db:migrate` | `prisma migrate deploy` — the production path |
| `npm run db:seed` | Load demo restaurant/menu/staff data |
| `npm run db:reset` | Drop, re-migrate and reseed |
| `npm run staff:create` | Create a real staff account interactively |
| `npm run art` | Regenerate the menu illustrations |

---

## Test status

| Suite | Count | Command |
|---|---|---|
| Unit | 88 | `npm test` |
| Integration | 24 | `npm run test:integration` |
| End-to-end | 92 | `npm run test:e2e` |

All passing, with lint, typecheck and build clean. What each suite covers —
and what it deliberately does not — is in `docs/TESTING.md`.

---

## Read this before going live

Two things are placeholders, and both are the restaurant's to supply:

1. **The menu, prices, hours and contact details are illustrative.** They were
   never verified against the real Pizza House — see
   `docs/RESTAURANT_DISCOVERY.md` for why, and `docs/ASSUMPTIONS.md` for the
   complete list of what needs confirming. Every one of them is editable from
   the admin panel; none is hardcoded.
2. **The product images are illustrations, not photographs.** Real food
   photography has to come from the restaurant. Each illustration sits at
   exactly the path a real photo will replace.

`docs/HANDOVER.md` is the checklist for turning this into a live restaurant's
system.

---

## Documentation

**Start here**
- `docs/PROJECT-STATUS.md` — what is done, what is not, in one table
- `docs/HANDOVER.md` — everything the owner must do to go live
- `docs/ARCHITECTURE.md` — module layout and the request flow that matters
- `docs/DECISIONS.md` — the architectural choices and what each one costs

**The domain**
- `docs/ORDER-STATE-MACHINE.md` — the order lifecycle, transition by transition
- `docs/PAYMENT-FLOW.md` — cash, bank transfer, receipts, verification
- `docs/ROLES-PERMISSIONS.md` — the permission matrix and how it is enforced
- `docs/DATABASE.md` — the data model and why it is shaped that way
- `docs/API.md` — every HTTP endpoint and its error codes

**The build**
- `docs/DESIGN-SYSTEM.md` — tokens, components, RTL rules
- `docs/LOCALIZATION.md` — the bilingual system and the bidi rules
- `docs/SEO.md` — what is implemented and the one real limitation
- `docs/ANALYTICS.md` — the first-party funnel
- `docs/SECURITY.md` — the threat model, control by control
- `docs/TESTING.md` — the three suites and the gaps
- `docs/QA-CHECKLIST.md` — the manual pass before any release
- `docs/ENVIRONMENT.md` — every variable
- `docs/DEPLOYMENT.md` — deploying to Vercel or anywhere else

**The source material**
- `docs/PROJECT_ORIGIN.md` — the original vision document
- `docs/PRD.md` — the full product requirements
- `docs/RESTAURANT_DISCOVERY.md` — what was and was not verifiable
- `docs/ASSUMPTIONS.md` — every placeholder awaiting confirmation
- `docs/ROADMAP.md` — phase-by-phase status

---

Built by **Novixa**. Licensed to Pizza House.
