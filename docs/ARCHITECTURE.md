# Architecture

A modular monolith, as `PROJECT_ORIGIN.md` §38 and `PRD.md` §65 both direct —
no microservices, no premature multi-tenancy.

```
Next.js 16 (App Router, TypeScript)
│
├── src/app/
│   ├── (site)/              Customer experience — home, menu, product, cart,
│   │                        checkout, order tracking. Shares one layout with
│   │                        the header/footer and the analytics beacon.
│   ├── admin/
│   │   ├── login/           Outside the auth-required layout, by design
│   │   └── (staff)/         Everything behind a staff session
│   ├── kitchen/             The kitchen display, deliberately outside the
│   │                        admin shell: a cook needs no navigation
│   └── api/                 Order creation, receipts, auth, locale,
│                            analytics, cron
│
├── src/components/          UI. `ui/` holds the primitives every screen is
│                            built from; `admin/` and `kitchen/` hold the
│                            few pieces those areas need
│
├── src/lib/                 Pure, I/O-free logic: scheduling, pricing,
│                            time/timezone, the order state machine, the
│                            permission matrix, money formatting, i18n
│
├── src/server/              Server-only domain logic: order creation and
│                            transitions, admin queries and mutations,
│                            restaurant config, audit, analytics, notifications
│
├── prisma/                  Schema, migrations, seed
├── scripts/                 Menu-art generator, staff account creation
└── tests/                   unit · integration · e2e
```

## Why the layers split where they do

**`src/lib` is pure.** `scheduling.ts`, `pricing.ts`, `time.ts`,
`order-state.ts` and `permissions.ts` contain no I/O and take the clock as a
parameter. That is what makes the rules that most need to be *correct* —
which pickup slots exist, what an order costs, who may cancel it — testable
to the minute without a database or a running server. 259 unit tests live
against this layer (see `docs/TESTING.md`).

**`src/server` touches the world.** It loads rows, opens transactions, writes
audit entries. Nothing in `app/` talks to Prisma directly except simple list
reads for a single page; anything with a business rule in it goes through
`src/server`.

**Server Actions for staff, a REST endpoint for customers.** Staff mutations
(`src/server/actions.ts`, `src/server/admin-actions.ts`) are Server Actions:
server-only by construction, CSRF-protected by the framework, and they let
the admin screens stay server components with plain `<form action={…}>` that
work before hydration — which matters on a slow kitchen tablet.
`/api/orders` is a real route handler instead, because the checkout form needs
to branch on *which* rule rejected the order (a full slot, a closed kitchen, a
sold-out item each get different copy), and because it is the one write path a
future POS integration or native client would also call.

## The request flow that matters

This is the sequence the whole product was conceived around
(`PROJECT_ORIGIN.md` §4):

```
Customer submits checkout
        │
        ▼
POST /api/orders  →  createOrder()            src/server/orders.ts
        │
        ├─ re-read every product and option price from the database
        │     the request carries ids and quantities, never prices
        ├─ validate availability and required options
        ├─ evaluate the promo code, if any        src/lib/pricing.ts
        ├─ resolve the pickup time                src/lib/scheduling.ts
        │     ASAP  → first slot with capacity
        │     SCHED → must be a slot the server itself generated
        ├─ compute kitchenReleaseAt = pickupAt − prepMinutes
        └─ inside one transaction:
              ├─ re-check slot capacity
              ├─ upsert the customer by phone
              └─ create Order + items + options + payment + history
                    │
                    ▼
   Order sits CONFIRMED (or PAYMENT_PENDING for a transfer)
                    │
                    ▼
   releaseDueOrders() promotes CONFIRMED → QUEUED once
   now ≥ kitchenReleaseAt. Runs on the cron schedule, and again
   whenever staff load the kitchen or orders screen.
                    │
                    ▼
   Kitchen: QUEUED → PREPARING → READY → COMPLETED
   every step through assertTransitionAllowed()
```

## Two properties worth stating plainly

**The client is never trusted for money.** The browser sends product ids,
option ids and quantities. `createOrder` reloads every price from the database
and recomputes the total. A tampered request buys nothing — there is no field
to tamper with (`PRD.md` §43, §92.H; tested in
`tests/integration/orders.test.ts`).

**The client can never set an order's status.** There is no endpoint that
accepts one. Every change goes through `transitionOrder`, which checks the
edge is legal *and* that the actor's role may walk it, then writes the change
and its history row in one transaction (`PRD.md` §23, §92.G).

## Timezone

Business hours are wall-clock strings ("16:00") that mean 16:00 *in Al
Mukalla*. The server runs in UTC on most hosts. Evaluating one against the
other silently shifts every pickup slot by three hours, so every conversion
between a wall-clock reading and an instant goes through `src/lib/time.ts`,
driven by `Restaurant.timezone`. Nothing else in the codebase calls
`setHours` or `getDay`.

## Known limits, stated rather than hidden

- **Rate limiting is per-process.** `src/lib/rate-limit.ts` keeps counters in
  memory, so on a platform running several instances each enforces its own
  limit. Adequate for a single-location pilot; move to a shared store before
  scaling out. Every caller goes through one function, so it is a change to
  one file.
- **Receipts live in the database.** Simple, portable, and access-controlled
  by construction. At a few hundred receipts a month this is fine; past that,
  move the bytes to object storage and keep the row as metadata.
- **One restaurant row.** `getRestaurant()` is the single lookup. Adding a
  tenant filter later is a change to that function and the queries, not a
  rewrite of the domain logic — which is the point of keeping every
  restaurant-specific value in data rather than in code (`PRD.md` §89).
