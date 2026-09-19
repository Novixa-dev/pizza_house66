# Database

Schema: `prisma/schema.prisma`. Dev/demo datastore: SQLite (see
`docs/DECISIONS.md` for why, and how to move to Postgres).

## Entity overview

- **Restaurant / BusinessHour / ScheduleOverride / PaymentMethodConfig** —
  single-restaurant configuration (docs/PRD.md §58, §89 explicitly asks for
  this to stay centralized and non-hardcoded even before multi-tenancy).
- **Category / Product / ProductOptionGroup / ProductOptionValue** — a
  generic option system (group = "Size", "Add-ons"; required + single-select
  vs. optional + multi-select) instead of pizza-specific fields, per
  docs/PROJECT_ORIGIN.md §16/§53 ("build a general option system capable of
  representing pizza size, burger size, drink size, crust type...").
- **Customer** — looked up/created by phone number at order time; no
  password, no forced signup (guest checkout is the only path in this MVP).
- **Order / OrderItem / OrderItemOption / OrderStatusHistory** — the order
  and an audit trail of every status change. `OrderItem`/`OrderItemOption`
  **snapshot** the product name and price at purchase time (docs/PRD.md §44
  "Order Snapshot Integrity") — a later price or name change on the
  `Product` row never rewrites historical orders.
- **Payment / PaymentStatusHistory** — payment status is a separate state
  machine from order status (docs/PRD.md §19), because a `BANK_TRANSFER`
  payment can be `PENDING` review while the order itself is
  `PAYMENT_PENDING`, and approving it moves both.
- **User / Role** — staff accounts (`OWNER`, `MANAGER`, `CASHIER`,
  `KITCHEN`). No customer-facing accounts in the MVP.
- **AuditLog** — reserved for staff/financial actions; currently the
  `OrderStatusHistory`/`PaymentStatusHistory` tables carry the audit trail
  for order and payment events specifically, which covers every mutation
  exposed today. Wire actual `AuditLog` writes in before adding actions that
  aren't already covered by those two tables (e.g. settings changes).

## Money

All amounts are stored as **integer minor units** (`Int` columns named
`*Minor`), never floats (docs/PRD.md §60). For this deployment YER is
treated as having no meaningful subunit, so "minor units" here just means
"whole currency units as an integer" — the important part is that
`unitPriceMinor`, `priceDeltaMinor`, `subtotalMinor`, etc. are always
integers and arithmetic on them is integer arithmetic.

## Idempotency

`Order.idempotencyKey` is unique. `createOrder()` looks up an existing order
by that key before creating a new one, so a retried/double-submitted
checkout request returns the original order instead of creating a
duplicate (docs/PRD.md §45).

## Order reference vs. tracking token

`Order.reference` (e.g. `PH-4821`) is short and shown to the customer and
staff, but it is **not** a capability — you cannot use it alone to look up
someone else's order. Customer-facing tracking uses `Order.trackingToken`
(an unguessable cuid), which is what `/order/[token]` requires
(docs/PRD.md §41 "Order Security" — order references must not become a
substitute for authorization).
