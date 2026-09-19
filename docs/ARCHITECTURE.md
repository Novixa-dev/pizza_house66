# Architecture

Modular monolith, as directed by `PROJECT_ORIGIN.md` §38 and `PRD.md` §65 —
no microservices, no premature multi-tenancy.

```
Next.js (App Router, TypeScript)
│
├── src/app/                  Routes (public site, admin, kitchen, API)
│   ├── (public)              Home, menu, product, cart, checkout, order tracking
│   ├── admin/(staff)/        Protected staff dashboard (route group keeps
│   │                         /admin/login outside the auth-required layout)
│   ├── kitchen/              Protected kitchen display
│   └── api/                  Order creation, auth, locale switch
│
├── src/components/           Client-side UI (cart, product customizer, forms)
├── src/lib/                  Pure/reusable logic: scheduling, order state
│   │                         machine, money formatting, auth, i18n
├── src/server/                Server-only domain logic: order creation,
│                              transitions, restaurant config loading
├── prisma/                   Schema, seed data
└── tests/unit/                Vitest tests for lib/ business rules
```

## Why this split

- **`src/lib`** holds pure functions with no I/O (`scheduling.ts`,
  `order-state.ts`, `money.ts`) so the rules that most need to be *correct*
  — pickup-time validation, kitchen-release timing, status transitions —
  are unit-testable without a database or a running server.
- **`src/server`** holds the things that touch Prisma or need the request
  context (creating orders, transitioning them, loading restaurant config).
  Nothing in `app/` talks to Prisma directly except simple read queries for
  a single page (menu, home) — anything with business rules goes through
  `src/server`.
- **Server Actions** (`src/server/actions.ts`) are used for staff mutations
  (confirm/cancel/verify payment/pause ordering) instead of a second set of
  REST endpoints — they run only on the server, get automatic CSRF
  protection from Next.js, and let the admin/kitchen UIs stay server
  components with plain `<form action={...}>` submissions.
- **`/api/orders`** is a real REST endpoint (not a Server Action) because
  the checkout form needs to inspect structured error codes
  (`ORDERING_PAUSED`, `INVALID_PICKUP_TIME`, `SLOT_FULL`,
  `PRODUCT_UNAVAILABLE`) to show the right message, and because it's the
  one write path a future native app or POS integration would also call.

## Request flow for the core scenario (docs/PROJECT_ORIGIN.md §4)

```
Customer submits checkout
        │
        ▼
POST /api/orders  →  createOrder() (src/server/orders.ts)
        │
        ├─ reload product + option prices from DB (never trust client price)
        ├─ validate availability, required options
        ├─ validate/resolve pickup time (src/lib/scheduling.ts)
        ├─ check slot capacity
        ├─ compute kitchenReleaseAt = pickupAt − prepMinutes
        └─ create Order + OrderItems + Payment in one transaction
                │
                ▼
   Order sits as CONFIRMED / PAYMENT_PENDING until kitchenReleaseAt
                │
                ▼
   releaseDueOrders() (called on every admin/kitchen page load)
   promotes CONFIRMED → QUEUED once now ≥ kitchenReleaseAt
                │
                ▼
   Kitchen staff: QUEUED → PREPARING → READY → COMPLETED
   (src/server/order-transitions.ts, guarded by src/lib/order-state.ts)
```

## Known architectural limitation (documented, not hidden)

`releaseDueOrders()` runs lazily on page load rather than on a real
scheduler. For a single-location pilot with staff actively watching the
kitchen/admin screens this is sufficient — the order is released the next
time anyone loads either page, and pickup times have minute-level slack.
For production, replace this with a real scheduled job (cron, a queue
worker, or a platform's scheduled functions) calling the same
`releaseDueOrders()` function — the domain logic does not need to change.
See `docs/DECISIONS.md`.
