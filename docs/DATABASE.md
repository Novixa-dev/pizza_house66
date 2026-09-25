# Database

PostgreSQL 16, schema in `prisma/schema.prisma`, migrations in
`prisma/migrations/`. Why Postgres rather than SQLite, and why versioned
migrations rather than `db push`, are in `docs/DECISIONS.md`.

## The entities

**Configuration** — `Restaurant`, `BusinessHour`, `ScheduleOverride`,
`PaymentMethodConfig`

One `Restaurant` row holds every restaurant-specific value: name, contact
details, currency, **timezone**, prep time, slot interval and capacity,
booking horizon, minimum order, bank-transfer instructions, SEO copy, and the
online-ordering pause switch. `BusinessHour` is the weekly pattern;
`ScheduleOverride` is a dated exception (a holiday, an early close).

Nothing in the business logic hardcodes a Pizza House value. That is the
`PRD.md` §89 requirement, and it is also what makes the admin panel able to
change the rules without a deployment.

**Catalogue** — `Category`, `Product`, `ProductOptionGroup`,
`ProductOptionValue`

A **generic** option system, not pizza-specific fields. A group is "Size" or
"Crust" or "Add-ons", with `required` and `multiSelect`/`maxSelect` flags; a
value carries a `priceDeltaMinor`. That is what lets the same schema express
a pizza size, a burger size, a drink size and a crust type — the explicit
instruction in `PROJECT_ORIGIN.md` §16/§53, and the reason this model can
serve another restaurant unchanged.

**Promotions** — `Promotion`, `PromotionProduct`

Percentage or fixed discount, with a minimum order, a maximum cap, a date
window, a usage limit, and optional scoping to specific products. Evaluated
server-side by `src/lib/pricing.ts`.

**Ordering** — `Customer`, `Order`, `OrderItem`, `OrderItemOption`,
`OrderStatusHistory`

`Customer` is looked up or created **by phone number** at order time. No
password, no signup — guest checkout is the only path, because requiring an
account to buy a pizza loses orders.

**Payments** — `Payment`, `PaymentReceipt`, `PaymentStatusHistory`

See `docs/PAYMENT-FLOW.md`. Payment status is a separate state machine from
order status, on purpose.

**Operations** — `User`, `Notification`, `AnalyticsEvent`, `AuditLog`

## Five decisions worth knowing

### 1. Money is always an integer

Every amount is an `Int` column named `*Minor`. No `Float`, no `Decimal`, no
exceptions (`PRD.md` §60). For YER, which has no practical subunit, "minor
units" means whole currency units as an integer — the guarantee being that
`unitPriceMinor + priceDeltaMinor` is integer arithmetic and cannot drift.

### 2. Order lines snapshot what was bought

`OrderItem` and `OrderItemOption` copy the name and price **at purchase
time**. `productId` is nullable with `onDelete: SetNull`.

That means a price rise on Thursday never rewrites Tuesday's receipts, and
deleting a discontinued product does not corrupt the order history that
mentions it (`PRD.md` §44). An order is a record of a transaction, not a
live join against a catalogue that has moved on.

### 3. `reference` is not a capability

`Order.reference` (`PH-4821`) is short, human-facing, and printed on
receipts. `Order.trackingToken` is 256 random bits, and it is what
`/order/[token]` requires.

If the reference were the lookup key, incrementing it would read the next
customer's order — name, phone number and all. They are separate fields
because they have entirely different security properties (`PRD.md` §41).

### 4. `slotStartAt` is stored, not derived

The order stores both its exact `requestedPickupAt` and the **start of the
capacity slot it occupies**. Capacity counting is then a simple indexed
`count` on `slotStartAt`, rather than a range scan with arithmetic on every
row. `kitchenReleaseAt` is stored for the same reason — the release job's
query is `status = CONFIRMED AND kitchenReleaseAt <= now()`, which the
`[status, kitchenReleaseAt]` index serves directly.

Derived values stored deliberately, because the queries that matter run on
every order and every cron tick.

### 5. `idempotencyKey` is unique

`createOrder` looks up an existing order by the key before creating one, and
the unique constraint is the backstop if two requests race past the lookup. A
double-clicked submit produces one order (`PRD.md` §45).

## Timezone

`Restaurant.timezone` is an IANA zone, defaulting to `Asia/Aden`. Every
`"HH:mm"` in `BusinessHour` and `ScheduleOverride` is a wall-clock reading
*in that zone*, and every conversion to an instant goes through
`src/lib/time.ts`.

`ScheduleOverride.date` is `@db.Date` rather than a timestamp, because a
holiday is a calendar date in the restaurant's local sense, not an instant.

`BusinessHour.closesAt` may be less than or equal to `opensAt`, which means
the shift crosses midnight — 16:00 to 00:00 is the seeded pattern, and the
scheduling code handles it explicitly rather than assuming a closing time is
later in the same day.

## Indexes

Every index earns its place against a query that actually runs:

| Index | Query it serves |
|---|---|
| `Order[status, kitchenReleaseAt]` | The release job, every 5 minutes |
| `Order[slotStartAt]` | Slot capacity, on every order creation |
| `Order[createdAt]` | Admin list and reports |
| `Order[guestPhone]` | Customer order history |
| `Product[categoryId, sortOrder]` | Menu rendering |
| `Product[availability]`, `[featured]` | Menu filters, home page |
| `Promotion[active, startsAt, endsAt]` | Promo code lookup at checkout |
| `Payment[status]` | The verification queue |
| `AuditLog[entity, entityId]`, `[createdAt]` | Audit screen |
| `AnalyticsEvent[name, createdAt]`, `[createdAt]` | Funnel and reports |

## Referential integrity

| Relationship | On delete | Why |
|---|---|---|
| `Order` → `OrderItem` | `Cascade` | Lines have no meaning without the order |
| `Order` → `Customer` | `SetNull` | Deleting a customer must not delete the sales record |
| `OrderItem` → `Product` | `SetNull` | Plus the snapshot columns, so the line stays readable |
| `Payment` → `PaymentReceipt` | `Cascade` | The image belongs to the payment |
| `AuditLog` → `User` | `SetNull` + denormalized `actorName` | A trail that forgets who acted is not a trail |
| `Restaurant` → hours, overrides, methods | `Cascade` | Configuration, not history |

The pattern: **history is preserved, configuration cascades.**

## Working with it

```bash
npm run db:migrate:dev     # create and apply a migration
npm run db:migrate         # prisma migrate deploy — the production path
npm run db:seed            # demo data
npm run db:reset           # drop, re-migrate, reseed
npx prisma studio          # browse it
```

Before a migration that drops or renames a column in production, take a
backup. `migrate deploy` only moves forward.
