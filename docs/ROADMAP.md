# Roadmap

Status of `docs/PRD.md` §82's phases as of this build.

## Phase 0 — Discovery: partial

Done: architecture, data model, roles, PRD/vision captured
(docs/PROJECT_ORIGIN.md, docs/PRD.md). Partial: restaurant discovery
(docs/RESTAURANT_DISCOVERY.md) — Instagram/web access was blocked in this
environment, so menu/prices/hours/contact info are unverified assumptions
(docs/ASSUMPTIONS.md), not confirmed facts.

## Phase 1/2 — Sales demo → MVP: this build

Shipped in this pass:

- Bilingual (Arabic RTL default / English LTR) public site: home, database-
  driven menu, product customization (sizes + add-ons via a generic option
  system), cart (persisted client-side), checkout with guest information.
- **Scheduled pickup with real kitchen-release calculation** — the core
  feature from `docs/PROJECT_ORIGIN.md` §4 — plus ASAP pickup, business-hours
  validation, and slot-capacity limiting.
- Server-authoritative order creation: price recalculation, availability
  checks, idempotent duplicate handling.
- Configurable payment methods (pay-at-pickup live; bank transfer with a
  manual verification queue; electronic payment modeled but disabled).
- Order status state machine with role-gated transitions and full history.
- Guest order tracking by capability token.
- Staff admin (orders list, payment verification, pause/resume online
  ordering) and a kitchen display (queued/preparing/ready board), both
  behind real authentication and RBAC.
- Unit tests for the scheduling and state-machine logic; lint/typecheck/
  build all green.

Not yet built (explicitly deferred, not silently dropped):

- Product/category/business-hours management UI — data is seeded directly;
  an admin CRUD UI for these is the natural next slice.
- Receipt image upload for bank transfers (currently text reference number
  only) — see docs/SECURITY.md for what secure upload handling requires.
- Customer-facing notifications beyond the tracking page (WhatsApp
  click-to-chat link exists in the footer/tracking page; no automated
  status messages yet).
- A real scheduled job for kitchen release (currently lazy-on-page-load —
  see docs/DECISIONS.md).
- Playwright E2E suite, integration tests, accessibility/security test
  passes (docs/TESTING.md).
- SEO essentials beyond basic `<title>`/description metadata: sitemap,
  robots.txt, Restaurant/LocalBusiness structured data, Open Graph images.

## Phase 3 — Production hardening: not started

Domain, SSL, real Postgres, backups, monitoring, error tracking, the
security/testing gaps above, and replacing every entry in
docs/ASSUMPTIONS.md with confirmed owner-provided data.

## Phase 4 — Growth: not started

Delivery, promotions, reviews, loyalty, automated WhatsApp, richer
analytics, reorder.

## Phase 5 — Productization (Novixa Restaurant): partially enabled by design

The schema and business logic already avoid hardcoding Pizza House
specifics where the PRD calls for it (generic product-option system,
single centralized `Restaurant` config row, currency/branding read from
data not code — see docs/DECISIONS.md "Single restaurant row"). Actual
multi-tenancy (per-tenant data isolation, onboarding, billing) is
intentionally not built, per `docs/PRD.md` §5.2/§89.
