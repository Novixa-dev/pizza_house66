# Analytics

`docs/PRD.md` §52–53 wants the owner to know where customers drop out of the
ordering flow. This is built first-party, with no third-party tracker and no
personal data — a restaurant's menu page should not turn into a surveillance
surface to answer "how many people reached checkout?".

## What is recorded

Fifteen event names, a fixed list (`ANALYTICS_EVENTS` in
`src/server/analytics.ts`):

```
page_view  menu_view  product_view  add_to_cart  remove_from_cart
checkout_started  checkout_completed  order_created
payment_submitted  payment_verified  payment_rejected
order_cancelled  order_preparing  order_ready  order_completed
```

Each row carries: the name, an opaque session id, and optionally an order id,
a product id, an amount in minor units, and a small JSON metadata object.

**What it does not carry:** no name, no phone number, no IP address, no user
agent, no referrer, no cross-site identifier. The session id is a random
value in an `HttpOnly` cookie set by the proxy, and it is **never joined to a
`Customer` row**. Answering "how many people got to checkout" does not
require knowing who they were.

## Where events come from

**Server-side for everything that matters.** Order creation, payment
decisions and status transitions are recorded inside the code that performs
them, so they cannot be lost to an ad blocker, a failed beacon or a closed
tab. The numbers the owner makes decisions on are complete.

**Client-side for the two the browser alone can see** — `page_view` and
`add_to_cart` — via `POST /api/analytics` from
`src/components/analytics-tracker.tsx`.

## The endpoint's three rules

**It always returns 204.** Malformed body, unknown event name, rate limited,
all of it: 204. Analytics must never be able to break a page, and a beacon
that returns errors is a beacon that tells a prober what the server accepts.

**The session id comes from the cookie, never the body.** A client cannot
write events into someone else's session, so the funnel cannot be skewed from
outside.

**Only known names are accepted.** `isAnalyticsEvent` rejects anything not on
the list. This is a funnel, not a general-purpose log sink someone can fill
with arbitrary strings.

Rate limit: 60/min per IP.

## The funnel

`getFunnel(since, until)` powers `/admin/reports`:

```
page_view → menu_view → product_view → add_to_cart → checkout_started → order_created
```

It counts **distinct sessions per step**, not raw events. One indecisive
visitor refreshing the menu twenty times is one person, not twenty — a funnel
that counts events makes every step look healthier than it is and hides the
drop-off the owner is trying to find.

Orders with no session id (a server-side creation with no browser session,
e.g. an API client) are added to the order count rather than dropped, so the
bottom of the funnel stays truthful even when the top cannot see them.

## Failure is silent by design

```ts
try { await prisma.analyticsEvent.create({ … }); }
catch (error) { console.error("[analytics] failed to record", input.name, error); }
```

An analytics write failure must never roll back an order. The event is lost
and logged; the customer's food is not affected. That tradeoff is the right
way round, and it means the numbers are "very nearly complete" rather than
"guaranteed complete" — worth knowing when reading a report.

## What the owner sees

`/admin/reports` (requires `reports.read`):

- Revenue over a date range, and order counts by status
- The funnel above, with conversion between each step
- Top products by quantity and by revenue
- Payment method mix
- Busiest pickup slots — which feeds the real operational decision, namely
  what `slotCapacity` should be

## Retention

**There is no automatic pruning.** `AnalyticsEvent` grows without limit. At
this restaurant's volume that is a non-issue for years, but it is a real
omission rather than an oversight to leave undocumented. When it matters, a
monthly job deleting rows older than the reporting window is the whole fix —
the reports only ever query a date range.

## Why not Google Analytics

Three reasons, in order of weight:

1. **The questions are operational, not marketing.** "Which slot is busiest"
   and "how many carts die at checkout" are answered better by querying the
   orders themselves than by a general-purpose web analytics product.
2. **It would be a third-party script** on a page that currently has a strict
   CSP and no external `connect-src`. Adding one weakens the policy for
   everything.
3. **It sends customer behaviour to another company.** For a small
   restaurant's ordering page that is a cost with no matching benefit.

If the owner later wants marketing attribution — ad campaigns, referral
sources — that is a genuine reason to add a tracker, and it is an addition
rather than a replacement.
