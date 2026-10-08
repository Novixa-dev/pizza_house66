# Project Status

One table per area: what is built, what is deliberately not, and what is
blocked on someone other than a developer.

Legend: ✅ built and tested · ⚠️ built with a stated limit · ⬜ not built,
deliberately · 🔑 blocked on the owner

## Live deployment — 🔑 **currently down**

**The site is off.** Railway's trial expired on 2026-10-01 at 08:37 UTC: the
container took a SIGTERM and every deployment moved to REMOVED, so the domain
serves Railway's "the train has not arrived at the station" page. A redeploy
answers `Your trial has expired`. The logs show a clean stop, not an error —
nothing in this repository is broken, and no change here brings it back.
`docs/DEPLOYMENT.md` has the diagnosis and the three ways forward; the first
step in all three is a database dump, because that volume holds the only copy
of the order history.

The deployment it was: the Next.js app and a PostgreSQL 16 instance in one
Railway project, the app referencing the database internally
(`${{Postgres.DATABASE_URL}}`) so the credential is never copied anywhere. On
each deploy it ran `prisma migrate deploy`, then `db:seed` (a no-op once a
restaurant exists, via `SEED_ONLY_IF_EMPTY=1`), then `next start` behind a
health check on `/`.

It carries the restaurant's own menu, hours and contact details, not the
illustrative ones. The seeded staff accounts still use the deployment's
`SEED_STAFF_PASSWORD`; **replace them with real accounts via
`npm run staff:create` before the restaurant uses this** —
`docs/HANDOVER.md` §4.

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
| Find an order again | ✅ | `/orders` — kept in the browser for 30 days, recoverable by reference + phone |
| Reorder from history | ✅ | Rebuilt from live rows at today's prices; an unavailable item is named, not dropped. Surfaced on the home page for a returning visitor |
| Offers and coupons | ✅ | `/offers`, public offers plus a coupon issued on the 5th completed order |
| Phone order bar | ✅ | Carries the basket count and total; hidden on cart, checkout and desktop |
| About / contact / FAQ / legal | ✅ | Plus a staff sign-in link in the footer |
| Photo credits | ✅ | `/credits` — six menu photographs are CC BY or BY-SA and require it |
| Customer accounts | ⬜ | Guest checkout only — an account requirement loses orders |
| Delivery | ⬜ | Pickup-only product (`PRD.md` §5.2) |
| Dietary filters | ⬜ | The label key exists; filtering by it does not — `docs/COMPETITIVE-ANALYSIS.md` ف-٢ |

## Staff admin

| Feature | Status | Note |
|---|---|---|
| Dashboard | ✅ | Today's revenue, counts, live queue, upcoming pickups |
| Orders list + detail | ✅ | Filters, transitions, cancellation |
| Payment verification | ✅ | Queue, receipt viewing, verify/reject with reason |
| Products CRUD | ✅ | Including option groups and values. The list has name search, an availability filter with a count per state, and rows that wrap on a phone — built for the real menu's ~184 items. Search (here and on the customer's menu) forgives how Arabic is typed — ه for ة, ا for أ |
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
| Unit + integration tests (333) | ✅ 259 unit + 74 integration |
| E2E tests (190 = 95 × two viewports/languages) | ✅ 189 pass; one skipped by design — a phone-only test on the desktop project |
| Lint, typecheck, build | ✅ clean |
| CI pipeline | ✅ `.github/workflows/ci.yml` — four jobs, green on the working branch's pushed head (read from GitHub). Its first real runs found two faults that were invisible locally; both fixed, see `docs/TESTING.md` |
| Accessibility | ✅ axe-core WCAG 2.1 A/AA in CI, light and dark, plus no-horizontal-overflow at phone width |
| Visual regression | ⬜ |
| Load testing | ⬜ |
| Dependency scanning in CI | ⬜ `npm audit` is manual |

## Documentation

All of `docs/` is current as of this build — architecture, decisions,
database, API, security, testing, deployment, design system, localization,
SEO, analytics, roles, order state machine, payment flow, QA checklist and
handover.

Four documents carry the state of the work rather than its design, and are
the ones to read first on picking this up:

| | |
|---|---|
| `docs/REPORT-2026-10.md` | Where it stands, what changed last, how to verify it, what is blocked |
| `docs/REVIEW-2026-10.md` | The team-lead pass over the repository, with the evidence per finding |
| `docs/IMPROVEMENTS.md` | The plan that review produced, and what is done against it |
| `docs/COMPETITIVE-ANALYSIS.md` | Measured against the reference build and the sites worth copying |
| `docs/TEST-GUIDE.md` | Ten manual scenarios, the staff accounts, and the expected result of each |

---

## 🔑 Blocked on the owner

Nothing below is a development task. Each is information or a decision only
Pizza House can supply.

### Stopping the project right now

| # | What is needed | Why it blocks |
|---|---|---|
| 1 | **A Railway plan, or a move to another host** | The site is off. Nothing ships until this is decided — `docs/DEPLOYMENT.md` |
| 2 | **A database dump, before anything else** | That volume is the only copy of the restaurant's order history, and it is attached to an expired trial |
| 3 | **The restaurant's real menu** — ideally exported from its delivery-app dashboard | We carry 16 items; the restaurant has ~184. Orders for anything not on our menu cannot be taken — `docs/FIELD-RESEARCH-2026-10.md` |

### Still needed, not blocking today

| # | What is needed | Why it matters |
|---|---|---|
| 3a | **Closing time: 23:00 or 23:30?** | Google Maps says 11 PM, our hours say 11:30 PM |
| 4 | **Real prep times per product** | The scheduling promise is only as good as these numbers |
| 5 | **Real slot capacity** | How many orders the kitchen can actually cook per 15 minutes |
| 6 | **Bank transfer details** | Bank name, account number, account holder |
| 7 | **Staff list and roles** | So real accounts replace the seeded ones — a shared password is not an account |
| 8 | **A domain** | For canonical URLs and the Google Business Profile |

### Supplied already, and checked

The address, phone, WhatsApp, Instagram and map pin — checked against the
restaurant's own Google Maps listing and Instagram profile — and the two
daily sessions. Food photographs cover 13 of 16 items; the three branded
drinks keep a vector bottle because the stock photograph available for each
was of a different product.

**Not supplied, despite earlier notes saying so: the menu.** The 16 items come
from an early prototype; the restaurant's own delivery-app listing shows
roughly 184. See `docs/FIELD-RESEARCH-2026-10.md`.

`docs/HANDOVER.md` walks through the outstanding items in order.

## What I would build next

In the order I would do it:

1. **Per-language URLs** (`app/[lang]/…`). The highest-value structural
   change — it is what makes both languages indexable, and it is additive
   (`docs/SEO.md`).
2. **WhatsApp order notifications.** The notification records already exist;
   only delivery is missing. In Yemen this is the channel customers actually
   read.
3. **Printable kitchen tickets**, if the restaurant has a printer.
4. **Shared-store rate limiting**, before the deployment ever scales past one
   instance.
