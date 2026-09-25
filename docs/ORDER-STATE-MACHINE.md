# The Order State Machine

Source of truth: `src/lib/order-state.ts`. Tested in
`tests/unit/order-state.test.ts`.

An order's status is never assigned. Every change goes through
`assertTransitionAllowed(from, to, role)`, which answers two questions that
are kept deliberately separate:

1. **Is this a legal edge at all?** — the lifecycle
2. **May this actor walk it?** — the permission

Separating them is what stops "kitchen staff marked an order refunded" from
being one careless UI change away. A UI bug can offer an illegal button; it
cannot make the server accept it.

## The lifecycle

```
                    ┌──────────────────────────────┐
                    │           PENDING            │  order created
                    └──────────────────────────────┘
                       │          │          │   │
        bank transfer  │          │ cash     │   │ rejected / cancelled
                       ▼          │          │   │
            ┌────────────────┐    │          │   │
            │PAYMENT_PENDING │────┤          │   │
            └────────────────┘    │          │   │
                       │          ▼          ▼   ▼
                       │   ┌────────────┐ ┌──────────┐ ┌───────────┐
                       └──▶│ CONFIRMED  │ │ REJECTED │ │ CANCELLED │
                           └────────────┘ └──────────┘ └───────────┘
                                 │  kitchenReleaseAt arrives   │
                                 ▼                             ▼
                           ┌────────────┐                ┌──────────┐
                           │   QUEUED   │                │ REFUNDED │
                           └────────────┘                └──────────┘
                                 │  cook picks it up
                                 ▼
                           ┌────────────┐
                           │ PREPARING  │
                           └────────────┘
                                 │  food is bagged
                                 ▼
                           ┌────────────┐
                           │   READY    │
                           └────────────┘
                                 │  customer collects
                                 ▼
                           ┌────────────┐
                           │ COMPLETED  │   terminal
                           └────────────┘
```

`CANCELLED` is reachable from every live state up to `PREPARING` — food can
be cancelled while it is being cooked, because sometimes it has to be. It is
**not** reachable from `READY`: at that point the food exists and is bagged,
and what happens next is a completion or a refund, not a cancellation.

## The table

| From | May become |
|---|---|
| `PENDING` | `PAYMENT_PENDING`, `CONFIRMED`, `REJECTED`, `CANCELLED` |
| `PAYMENT_PENDING` | `CONFIRMED`, `REJECTED`, `CANCELLED` |
| `CONFIRMED` | `QUEUED`, `CANCELLED` |
| `QUEUED` | `PREPARING`, `CANCELLED` |
| `PREPARING` | `READY`, `CANCELLED` |
| `READY` | `COMPLETED` |
| `COMPLETED` | — terminal |
| `REJECTED` | — terminal |
| `CANCELLED` | `REFUNDED` |
| `REFUNDED` | — terminal |

## Who may walk which edge

Each target status demands one permission
(`TRANSITION_PERMISSION` in the same file):

| Target | Permission | Which roles |
|---|---|---|
| `PAYMENT_PENDING` | `orders.update` | Owner, Manager, Cashier |
| `CONFIRMED` | `orders.update` | Owner, Manager, Cashier |
| `QUEUED` | `orders.update` | Owner, Manager, Cashier — and the release job |
| `PREPARING` | `kitchen.update` | All four roles |
| `READY` | `kitchen.update` | All four roles |
| `COMPLETED` | `kitchen.update` | All four roles |
| `REJECTED` | `payments.reject` | Owner, Manager, Cashier |
| `CANCELLED` | `orders.cancel` | Owner, Manager, Cashier |
| `REFUNDED` | `payments.verify` **and** role ∈ {OWNER, MANAGER} | Owner, Manager |

The refund rule is the one place a role is named directly rather than through
a permission, and the comment in the source says why: a refund moves money
back out of the business, so it does not ride on a permission a cashier holds
for a different purpose. That is a deliberate exception to the "permissions,
not roles" rule in `docs/ROLES-PERMISSIONS.md`, kept to one line and one
place.

## How a transition is written

`transitionOrder` in `src/server/order-transitions.ts`:

```ts
const result = await tx.order.updateMany({
  where: { id, status: expectedFrom },   // ← the guard
  data:  { status: to, … },
});
if (result.count === 0) throw new InvalidTransitionError(expectedFrom, to);
```

The `where` clause carries the status the caller believed the order was in.
Two cooks tapping "Preparing" on the same ticket at the same moment produce
one successful update and one `count === 0`, and the second sees a clear
error instead of silently overwriting. It is optimistic concurrency with no
extra column and no lock held across a round trip.

The status change and its `OrderStatusHistory` row are written in the same
transaction, so there is no state in which an order has moved but no record
says who moved it.

## What the customer is told

The internal statuses are finer-grained than anything a customer benefits
from seeing. `CUSTOMER_VISIBLE_LABELS` maps each to bilingual copy, and
`CUSTOMER_TIMELINE` narrows the tracking page to five steps:

```
Received → Confirmed → Preparing → Ready → Completed
```

A customer does not need to know the difference between `CONFIRMED` and
`QUEUED` — one is "we have your order", the other is "the kitchen can see it
now", and from outside the kitchen those are the same thing.

## Automatic transitions

One transition has no human actor: `CONFIRMED → QUEUED`, performed by
`releaseDueOrders()` when `now >= kitchenReleaseAt`. It runs from the cron
endpoint every five minutes, and opportunistically whenever staff load the
kitchen or orders screen — so the feature degrades to "works, slightly late"
rather than "does not work" if the schedule is ever misconfigured.

It is the mechanic the whole product exists for, and the reason `QUEUED` is a
separate status from `CONFIRMED` at all: an order placed at 16:00 for 19:00
pickup must be invisible to the kitchen until 18:35, or the kitchen will cook
it at 16:05.

## Derived sets

The same file exports the groupings the rest of the app queries by, so no
screen hardcodes a status list:

- `ACTIVE_ORDER_STATUSES` — still live work for the restaurant
- `RELEASED_SLOT_STATUSES` — `CANCELLED`, `REJECTED`; no longer occupy slot capacity
- `KITCHEN_BOARD_STATUSES` — `QUEUED`, `PREPARING`, `READY`
- `STATUS_TONE` — the badge colour per status, so one status is one colour everywhere
