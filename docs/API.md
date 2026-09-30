# HTTP API

Nine route handlers. Everything else a staff member does is a Server Action —
a generated POST endpoint Next.js protects itself — so this file covers only
what is addressable by URL.

**Errors are stable machine codes**, not prose. The client picks the copy in
the current language; the server never leaks a stack trace, a SQL message or
an internal identifier across this boundary (`docs/PRD.md` §62). Anything
unrecognised is logged server-side and returned as `INTERNAL_ERROR`.

---

## `POST /api/orders`

Create an order. The one write endpoint a customer can reach, and the one
path a future POS or native client would also call.

**Rate limit:** 20 per 5 minutes per IP. Wide on purpose — an office or a
household behind one NAT'd address is a normal burst, and the duplicate guard
is the idempotency key, not the throttle.

**Body**

```jsonc
{
  "idempotencyKey": "ck-8f2…",          // generated once per checkout form
  "items": [
    { "productId": "…", "quantity": 2, "optionValueIds": ["…"], "note": "extra crispy" }
  ],
  "customer": { "name": "…", "phone": "+967 7xx xxx xxx" },
  "pickup":  { "mode": "ASAP" },
  //         | { "mode": "SCHEDULED", "requestedAt": "2026-09-25T16:30:00.000Z" }
  "payment": { "method": "PAY_AT_PICKUP" },
  //         | { "method": "BANK_TRANSFER", "referenceNumber": "…",
  //             "receipt": { "contentType": "image/jpeg", "dataBase64": "…", "originalName": "…" } }
  "promoCode": "WELCOME10",             // optional
  "notes": "…"                          // optional
}
```

**Note what is absent: no prices, no totals, no discount amount, no status.**
The client says what it wants, never what it costs. `createOrder` reloads
every price from the database and recomputes the total, so there is no field
to tamper with.

**201**

```json
{
  "reference": "PH-4821",
  "trackingToken": "…",
  "totalMinor": 5400,
  "requestedPickupAt": "2026-09-25T16:30:00.000Z"
}
```

Re-POSTing the same `idempotencyKey` returns the original order rather than
creating a second one.

**Errors**

| Code | Status | Meaning |
|---|---|---|
| `RATE_LIMITED` | 429 | With `Retry-After` |
| `INVALID_JSON` | 400 | Body was not JSON |
| `VALIDATION_ERROR` | 400 | With `details` — a flattened Zod error |
| `INVALID_OPTIONS` | 400 | A required option group is unanswered, or an option does not belong to the product |
| `RECEIPT_TYPE` | 400 | Not a JPEG/PNG/WebP, or the bytes do not match the declared type |
| `RECEIPT_TOO_LARGE` | 400 | Over 3 MB after decoding |
| `RECEIPT_EMPTY` | 400 | Zero bytes |
| `ORDERING_PAUSED` | 409 | Online ordering is switched off |
| `SLOT_FULL` | 409 | With `suggestedAt` — the next slot that has room |
| `PRODUCT_UNAVAILABLE` | 409 | With `productNameAr` / `productNameEn` |
| `NO_SLOTS` | 409 | No slot with capacity within the booking horizon |
| `INVALID_PICKUP_TIME` | 422 | With `reasonCode` and `earliestValid` |
| `BELOW_MINIMUM` | 422 | With `minimumMinor` |
| `INTERNAL_ERROR` | 500 | Logged server-side |

`INVALID_PICKUP_TIME.reasonCode` is one of `PAUSED`, `IN_PAST`, `TOO_SOON`,
`CLOSED`, `TOO_FAR`, `NOT_A_SLOT` — enough for the checkout form to say
"we're closed then" rather than "invalid time".

---

## `POST /api/orders/[token]/receipt`

Attach a transfer receipt after ordering — for the customer who pays once
they are home. `[token]` is the order's tracking token, which is the
capability: holding it is what authorizes the upload.

**Rate limit:** 6 per minute per IP.

**Body:** `{ referenceNumber?, contentType, dataBase64, originalName? }`

| Code | Status | Meaning |
|---|---|---|
| `NOT_FOUND` | 404 | No order with that token |
| `NOT_APPLICABLE` | 409 | The order is not a bank transfer |
| `ALREADY_VERIFIED` | 409 | Staff already approved it; nothing to replace |
| `RECEIPT_*` | 400 | As above |

---

## `POST /api/promotions/preview`

Evaluates a promo code against a cart **without** creating an order, so the
checkout page can show the discount before submission.

**Rate limit:** 15 per minute per IP — enough for someone trying the codes
they have, slow enough that enumerating a code space is not worth it.

It returns the discount the server computes, and the order endpoint
recomputes it again at creation. The preview is a display convenience; it is
never the number charged.

Inapplicable codes come back with a `reasonCode`: `NOT_FOUND`, `INACTIVE`,
`NOT_STARTED`, `EXPIRED`, `USAGE_EXHAUSTED`, `BELOW_MINIMUM`, or
`NO_ELIGIBLE_ITEMS`.

---

## `GET /api/receipts/[paymentId]`

Serves receipt bytes from the database to staff.

- Requires the `payments.receipt.read` permission — 401 without a session,
  404 without the permission or without a receipt.
- **Every successful view writes an audit entry** (`payment.receipt.view`).
- 404 rather than 403 for a permission failure: someone who cannot view
  receipts learns nothing about which payment ids exist.

---

## `POST /api/auth/login`

A plain form POST, so staff sign-in works on a kitchen tablet with
JavaScript disabled or still loading.

- Responds with a **relative** `Location` header. An absolute one can resolve
  to a different origin than the browser is on, and `form-action 'self'` then
  refuses the navigation — the login bug documented in `docs/DECISIONS.md`.
- `?next=` is validated by `ensureSameOriginPath` (no open redirect) **and**
  against the role — a kitchen account following an `/admin` link lands on
  `/kitchen` rather than bouncing straight back out.
- Failures redirect back with `?error=invalid` or `?error=rate_limited`;
  `invalid` never distinguishes a wrong password from an unknown account, and
  a bcrypt comparison runs against a dummy hash either way so the response
  time does not either.
- **Throttling counts failures only:** 20 per 10 min per IP, 5 per 5 min per
  account. A successful sign-in costs nothing, so a shift change behind one
  address cannot lock out a restaurant.

## `POST /api/auth/logout`

Clears the session cookie and redirects to the login page.

---

## `POST /api/analytics`

First-party event beacon. **Always 204**, even for a rejected or malformed
event: analytics must never be able to break a page, and a beacon that
returns errors is a beacon that leaks what the server accepts.

Rate limit 60/min per IP. The session id is read from the server-set `ph_sid`
cookie, never from the body — a client cannot attribute its events to someone
else's funnel. See `docs/ANALYTICS.md`.

## `POST /api/locale`

Sets the `ph_locale` cookie and redirects back. A POST rather than a GET
because it changes state, and a form rather than a fetch so the language
switch works before hydration.

---

## `GET|POST /api/cron/release-orders`

Promotes every `CONFIRMED` order whose `kitchenReleaseAt` has arrived into
`QUEUED`, putting it on the kitchen display.

- Requires `Authorization: Bearer $CRON_SECRET`, compared in constant time.
- **With no `CRON_SECRET` configured it returns 401** — it fails closed. An
  open trigger is a free way to hammer the database.
- Returns `{ "ok": true, "released": n }`.
- Accepts GET (what Vercel Cron sends) and POST (what most other schedulers
  send).

This endpoint is an optimization, not a dependency: the admin and kitchen
screens call the same function when they load, so a misconfigured schedule
degrades the feature to "slightly late" rather than "broken".
