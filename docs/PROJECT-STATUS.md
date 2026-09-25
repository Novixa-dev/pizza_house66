# Project Status

One table per area: what is built, what is deliberately not, and what is
blocked on someone other than a developer.

Legend: ✅ built and tested · ⚠️ built with a stated limit · ⬜ not built,
deliberately · 🔑 blocked on the owner

---

## Customer experience

| Feature | Status | Note |
|---|---|---|
| Home page | ✅ | Hours, location, payment methods, FAQ, `Restaurant` + `FAQPage` JSON-LD |
| Menu | ✅ | Database-driven, category filter, search |
| Product page | ✅ | Generic options, live price, related items, `MenuItem` JSON-LD |
| Cart | ✅ | Persisted client-side across reloads |
| Checkout | ✅ | Guest details, ASAP or slot, promo code, payment method |
| Pickup slot picker | ✅ | Only slots that are open and have capacity |
| Bank-transfer receipt upload | ✅ | At checkout or later from the tracking page |
| Order tracking | ✅ | Capability token, live timeline, auto-refresh |
| Arabic / English | ✅ | Full RTL, both languages complete |
| PWA install | ✅ | Installable; deliberately not offline |
| Customer accounts | ⬜ | Guest checkout only — an account requirement loses orders |
| Delivery | ⬜ | Pickup-only product (`PRD.md` §5.2) |
| Reorder from history | ⬜ | Phase 4 |

## Staff admin

| Feature | Status | Note |
|---|---|---|
| Dashboard | ✅ | Today's revenue, counts, live queue, upcoming pickups |
| Orders list + detail | ✅ | Filters, transitions, cancellation |
| Payment verification | ✅ | Queue, receipt viewing, verify/reject with reason |
| Products CRUD | ✅ | Including option groups and values |
| Categories CRUD | ✅ | |
| Promotions CRUD | ✅ | Percentage/fixed, minimum, cap, window, usage limit, scoping |
| Customers | ✅ | Order history by phone |
| Business hours | ✅ | Weekly pattern plus dated overrides |
| Settings | ✅ | Every restaurant rule, incl. pause ordering |
| Staff accounts | ✅ | Create, edit, deactivate, role |
| Reports | ✅ | Revenue, top products, payment mix, funnel, busiest slots |
| Audit log | ✅ | Every staff mutation, filterable |
| Bulk operations | ⬜ | One at a time is enough at this scale |
| Printable kitchen tickets | ⬜ | Worth adding if the restaurant has a receipt printer |

## Kitchen

| Feature | Status | Note |
|---|---|---|
| Queued/Preparing/Ready board | ✅ | Auto-refreshing |
| One-tap transitions | ✅ | 44 px targets, guarded against concurrent taps |
| Scheduled release | ✅ | Cron every 5 min, plus on page load |
| Audio alert on new order | ⬜ | Needs a real kitchen to tune against |

## Platform

| Concern | Status | Note |
|---|---|---|
| Timezone correctness | ✅ | `src/lib/time.ts`, data-driven, DST-safe |
| Server-authoritative pricing | ✅ | No price field exists in the request schema |
| Order state machine | ✅ | Legal edge + permission, per transition |
| Permission matrix | ✅ | 26 permissions, 4 roles, enforced server-side |
| Audit trail | ✅ | Three tables |
| Security headers + CSP | ✅ | Nonce-based, `strict-dynamic` |
| Idempotent order creation | ✅ | |
| Concurrency safety | ✅ | Guarded updates on orders and payments |
| Rate limiting | ⚠️ | Per-process — see `docs/SECURITY.md` |
| Receipt storage | ⚠️ | In-database; move to object storage past a few hundred/month |
| Multi-tenancy | ⬜ | Explicitly out of MVP scope (`PRD.md` §5.2, §89) |
| Notifications | ⚠️ | Recorded and shown on the tracking page; no WhatsApp/SMS delivery |

## Quality

| Item | Status |
|---|---|
| Unit tests (84) | ✅ |
| Integration tests (24) | ✅ |
| E2E tests (48, two viewports/languages) | ✅ |
| Lint, typecheck, build | ✅ clean |
| CI pipeline | ✅ `.github/workflows/ci.yml` |
| Accessibility | ⚠️ Built in and checked by hand; not asserted in CI |
| Visual regression | ⬜ |
| Load testing | ⬜ |
| Dependency scanning in CI | ⬜ `npm audit` is manual |

## Documentation

All of `docs/` is current as of this build — architecture, decisions,
database, API, security, testing, deployment, design system, localization,
SEO, analytics, roles, order state machine, payment flow, QA checklist and
handover.

---

## 🔑 Blocked on the owner

Nothing below is a development task. Each is information or a decision only
Pizza House can supply.

| # | What is needed | Why it blocks |
|---|---|---|
| 1 | **Real menu, prices and descriptions** | Everything seeded is illustrative (`docs/ASSUMPTIONS.md`) |
| 2 | **Real business hours** | Seeded as 16:00–00:00 daily |
| 3 | **Real prep times per product** | The scheduling promise is only as good as these numbers |
| 4 | **Real slot capacity** | How many orders the kitchen can actually cook per 15 minutes |
| 5 | **Real contact details and address** | Phone, WhatsApp, address, map link, coordinates |
| 6 | **Bank transfer details** | Bank name, account number, account holder |
| 7 | **Food photography** | Current images are illustrations |
| 8 | **Staff list and roles** | So real accounts replace the demo ones |
| 9 | **A production database** | Any managed Postgres |
| 10 | **A domain** | For canonical URLs and the Google Business Profile |
| 11 | **A Vercel plan decision** | A private org-owned repo needs Pro; see `docs/DEPLOYMENT.md` |

`docs/HANDOVER.md` walks through each of these in order.

## What I would build next

In the order I would do it:

1. **Per-language URLs** (`app/[lang]/…`). The single highest-value
   remaining change — it is what makes both languages indexable, and it is
   additive (`docs/SEO.md`).
2. **WhatsApp order notifications.** The notification records already exist;
   only delivery is missing. In Yemen this is the channel customers actually
   read.
3. **Printable kitchen tickets**, if the restaurant has a printer.
4. **`axe-core` in the Playwright suite**, so accessibility cannot regress
   silently.
5. **Shared-store rate limiting**, before the deployment ever scales past one
   instance.
