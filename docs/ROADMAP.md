# Roadmap

Status against the phases in `docs/PRD.md` §82. `docs/PROJECT-STATUS.md` has
the feature-by-feature table; this is the shape of the journey.

## Phase 0 — Discovery: partial, and blocked externally

Done: architecture, data model, roles, the full PRD and vision document
(`docs/PROJECT_ORIGIN.md`, `docs/PRD.md`).

Not done: **restaurant discovery**. Instagram and web access were blocked in
the environment this was built in, so the real menu, prices, hours and
contact details were never verifiable (`docs/RESTAURANT_DISCOVERY.md`).
Everything in the seed is a placeholder, catalogued in
`docs/ASSUMPTIONS.md`. This is the one phase that cannot be completed by a
developer.

## Phase 1–2 — Sales demo → MVP: **complete**

The full product, not a demo of one:

- Bilingual (Arabic RTL default / English LTR) public site: home, menu,
  product pages with a generic option system, cart, checkout, order tracking
- **Scheduled pickup with real kitchen-release calculation** — the core
  feature from `PROJECT_ORIGIN.md` §4 — with business-hours validation, slot
  capacity, and a timezone layer that evaluates the restaurant's hours in the
  restaurant's zone regardless of where the server runs
- Server-authoritative pricing, promotions, idempotent order creation
- Payment methods with a bank-transfer verification queue and receipt upload
- Order state machine with per-transition permissions and full history
- **The complete staff admin**: dashboard, orders, payments, products,
  categories, options, promotions, customers, hours, settings, staff,
  reports, audit
- Kitchen display with one-tap transitions
- Permission matrix (26 permissions, 4 roles) enforced server-side
- Nonce-based CSP and the hardening header set
- First-party analytics and the conversion funnel
- SEO: structured data, sitemap, robots, Open Graph, PWA manifest
- 84 unit / 24 integration / 48 E2E tests, and a CI pipeline

## Phase 3 — Production hardening: partially done

**Done in this build:** PostgreSQL with versioned migrations; real
authentication and RBAC; rate limiting; audit logging; error boundaries that
never leak internals; scheduled kitchen release with a fail-closed cron
endpoint; the security controls in `docs/SECURITY.md`; a deployment guide.

**Remaining, and it is owner work rather than development:** a production
database, a domain, TLS (which the host provides), backups with a *tested*
restore, error tracking, and replacing every entry in `docs/ASSUMPTIONS.md`
with confirmed data. `docs/HANDOVER.md` is the checklist.

**Remaining development, small:** dependency scanning in CI, and
shared-store rate limiting before the deployment ever runs more than one
instance.

## Phase 4 — Growth: not started

Delivery, loyalty, reviews, reorder-from-history, richer promotions, customer
accounts. All deliberately deferred — `PRD.md` §5.2 is explicit that the MVP
is pickup-only and guest-only.

The two worth doing first, and why:

1. **Per-language URLs** (`app/[lang]/…`). Not a growth feature as such, but
   the single highest-value remaining change: it is what makes both languages
   separately indexable, and it is additive — the dictionaries and `pick()`
   carry over untouched (`docs/SEO.md`).
2. **WhatsApp order notifications.** The notification records already exist
   and already drive the tracking page; only delivery is missing. In Yemen,
   WhatsApp is the channel customers actually read, and "your order is ready"
   arriving there is worth more than any other feature on this list.

## Phase 5 — Productization (Novixa Restaurant): enabled by design, not built

Actual multi-tenancy — per-tenant isolation, onboarding, billing — is
deliberately not built (`PRD.md` §5.2, §89).

What *was* done, so that it stays a change rather than a rewrite:

- Every restaurant-specific value lives in one `Restaurant` row and is
  editable from the admin panel. **No business logic hardcodes a Pizza House
  value.**
- The option system is generic — it expresses a pizza size, a burger size, a
  drink size or a crust type with no schema change, exactly as
  `PROJECT_ORIGIN.md` §16 asks.
- The timezone is data, so a restaurant in another zone is a row, not a
  release.
- Currency is data.
- The design system is token-driven; retheming is one CSS block.
- The permission matrix is a table, so a new role is one entry.

Adding `restaurantId` later is a schema change and a query filter. It is not
a redesign, and that was the point of every decision above.
