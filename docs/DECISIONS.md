# Decisions

## SQLite for dev/demo, Postgres for production

**Problem:** the PRD (docs/PRD.md §66) recommends PostgreSQL. This
environment has no provisioned Postgres instance.
**Decision:** use SQLite (`prisma/schema.prisma`, `datasource db { provider
= "sqlite" }`) for local development, the demo/pilot, and CI, via a `dev.db`
file.
**Reason:** zero external setup, works identically in any sandbox or
laptop, and Prisma's schema/query API is nearly identical across both —
the application code (`src/server/*`, `src/lib/*`) does not depend on
SQLite-specific behavior.
**Tradeoff / migration path:** before a real multi-writer production
deployment, change `provider` to `"postgresql"`, set `DATABASE_URL` to a
managed Postgres instance, and re-run `prisma db push` (or switch to
`prisma migrate` for versioned migrations at that point). No model or query
changes are expected to be needed.

## Prisma major version pinned to 6.19.3, not the "latest" 8.0.0-rc

**Problem:** `npm install prisma@latest` resolved to `8.0.0-rc.15`, which
has breaking CLI/config changes (schema `datasource.url` removed in favor
of `prisma.config.ts` + driver adapters).
**Decision:** pinned to Prisma **6.19.3**, the last stable major before
that config rewrite.
**Reason:** a release candidate is the wrong foundation for a project meant
to be handed to a client and maintained long-term. Revisit once Prisma 8 is
GA and its new config model is documented/stable, or when the team decides
to invest in a rewrite.

## Lazy kitchen-release instead of a scheduled job

**Problem:** the scheduled-ordering feature (docs/PROJECT_ORIGIN.md §4)
needs orders to move from `CONFIRMED` to `QUEUED` automatically once
`kitchenReleaseAt` arrives, but this environment has no long-running
worker/cron infrastructure.
**Decision:** `releaseDueOrders()` (src/server/orders.ts) is called at the
top of both the admin orders page and the kitchen page load, and promotes
any due `CONFIRMED` order to `QUEUED`.
**Reason:** for a single-location pilot where staff keep the kitchen/admin
screen open, this achieves the same practical effect (orders never enter
the kitchen queue before their release time) without new infrastructure.
**Tradeoff:** if literally nobody has the kitchen or admin page open, a due
order won't be promoted until someone loads one of those pages. Acceptable
for a pilot; **must** move to a real scheduled job (cron / queue worker) for
production. The domain function itself does not need to change.

## Cookie-based locale instead of `/[lang]/...` path routing

**Problem:** Next.js's documented i18n pattern nests all routes under
`app/[lang]/`, which gives clean separate URLs and SEO `hreflang` support
per docs/PRD.md §51.
**Decision:** used a single route tree with an `ph_locale` cookie and a
`getLocale()`/`getDictionary()` helper (`src/lib/i18n/`) instead.
**Reason:** kept the MVP's route structure simple to build and test within
scope; still ships Arabic (default, RTL) and English (secondary, LTR) with
correct `dir`/`lang` attributes and full string localization.
**Tradeoff:** no distinct indexable URL per language, so Arabic/English SEO
cannot be fully separated (docs/PRD.md §47/§51 want both indexed). Migrating
to `app/[lang]/...` later is additive — the dictionaries and `getLocale`
pattern carry over directly.

## In-memory rate limiting on staff login

**Problem:** docs/PRD.md §39 requires rate limiting on authentication.
**Decision:** a minimal per-process in-memory limiter
(`src/lib/rate-limit.ts`), 10 attempts/minute per IP on `/api/auth/login`.
**Tradeoff:** does not work correctly across multiple server instances
(each process has its own counter). Fine for a single-instance pilot
deployment; move to a shared store (Redis, or the hosting platform's rate
limiting) before scaling to multiple instances.

## Single restaurant row, not multi-tenant

Per docs/PRD.md §5.2/§89: no tenant model yet. `getRestaurant()`
(`src/server/restaurant.ts`) always loads `Restaurant.findFirst()`. All
restaurant-specific values (name, hours, currency, prep time, payment
methods) come from that one row rather than being hardcoded, so adding a
`restaurantId` filter later is a schema/query change, not a rewrite of
business logic.
