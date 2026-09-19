# Pizza House — Digital Ordering & Restaurant Operations Platform

A bilingual (Arabic-first RTL / English) online ordering platform for Pizza
House (Al Mukalla, Yemen), built around one idea: customers order ahead and
choose a pickup time, and the system works out exactly when the kitchen
should start preparing so the order is ready when the customer arrives —
not before, not after. See `docs/PROJECT_ORIGIN.md` for the full story
behind that idea and `docs/PRD.md` for the complete product requirements.

This is also the reference implementation for a future reusable product,
**Novixa Restaurant** — see `docs/ROADMAP.md`.

## What's here

- Public site: home, database-driven menu, product customization (generic
  size/add-on option system), cart, checkout with guest info, scheduled or
  ASAP pickup, configurable payment methods, order tracking.
- Staff admin: order list, bank-transfer payment verification, pause/resume
  online ordering — behind real authentication and role-based access.
- Kitchen display: queued/preparing/ready board with one-tap status updates.
- The scheduling engine that computes kitchen-release time from pickup time
  and preparation duration, with business-hours and slot-capacity
  validation (`src/lib/scheduling.ts`).

See `docs/ARCHITECTURE.md` for how it fits together and `docs/ROADMAP.md`
for what's built vs. deferred.

## Quick start

```bash
cp .env.example .env
sed -i "s/replace-with-a-long-random-secret/$(openssl rand -hex 32)/" .env
npm install
npm run db:push
npm run db:seed
npm run dev
```

Then open http://localhost:3000. Staff/kitchen login is at
`/admin/login` — demo accounts are printed by `npm run db:seed`.

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run build` / `npm start` | Production build / start |
| `npm run lint` | ESLint |
| `npm test` | Unit tests (Vitest) — scheduling & order-state rules |
| `npm run db:push` | Sync the Prisma schema to the SQLite dev database |
| `npm run db:seed` | Load demo restaurant/menu/staff data |
| `npm run db:reset` | Drop and recreate the dev database, then reseed |

## Important: the seed data is not real

Menu items, prices, hours, and contact details are illustrative
placeholders, not the real Pizza House menu — Instagram/web access needed
to verify them was blocked in the environment this was built in. See
`docs/RESTAURANT_DISCOVERY.md` and `docs/ASSUMPTIONS.md` before treating any
of it as fact, and definitely before any production launch.

## Documentation

- `docs/PROJECT_ORIGIN.md` — why this exists (source vision document)
- `docs/PRD.md` — full product requirements (source PRD)
- `docs/RESTAURANT_DISCOVERY.md` — what was/wasn't verifiable about the real restaurant
- `docs/ASSUMPTIONS.md` — every placeholder that needs owner confirmation
- `docs/ARCHITECTURE.md` — module layout and request flow
- `docs/DATABASE.md` — data model rationale
- `docs/DECISIONS.md` — architectural decisions and tradeoffs made building this
- `docs/SECURITY.md` — what's implemented vs. still open
- `docs/TESTING.md` — what's tested vs. still needed
- `docs/ENVIRONMENT.md` — environment variables
- `docs/ROADMAP.md` — phase-by-phase status
