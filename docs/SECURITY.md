# Security

What this system is defending, from whom, and with what. Where a control has
a limit, the limit is stated — a threat model that only lists strengths is
marketing.

## What is worth attacking here

| Asset | The realistic attack |
|---|---|
| Money | Tamper with a price or total at checkout and buy food for less |
| Kitchen capacity | Flood the slots so real customers cannot order |
| Customer data | Read other people's orders, phone numbers, bank receipts |
| Staff accounts | Guess a password and get an admin session |
| Order state | Mark an order paid or ready without authorization |

There is no card data, no customer passwords, and no payment gateway
credential in this system — a deliberate consequence of the payment model in
`docs/PAYMENT-FLOW.md`. The most sensitive thing stored is a bank-transfer
receipt image.

---

## Money: the client is never trusted for a price

`POST /api/orders` accepts product ids, option ids and quantities. It accepts
**no price, no total, no discount amount**. `createOrder` reloads every price
from the database, re-evaluates the promotion server-side, and computes the
total itself.

This is not validation — there is nothing to validate. The field does not
exist in the schema, so there is no request shape that carries a price to
reject.

Promotion rules (minimum order, maximum discount cap, date window, usage
limit, product scoping) are all evaluated server-side. `/api/promotions/preview`
exists only so the checkout page can *display* a discount; the number charged
is recomputed at creation.

`tests/integration/orders.test.ts` asserts this from the outside.

---

## Order state: the client can never set a status

There is no endpoint that accepts an order status. Every change goes through
`transitionOrder`, which checks:

1. the transition is a legal edge (`src/lib/order-state.ts`),
2. the actor's role may walk it,

then writes the change and its `OrderStatusHistory` row in one transaction.
The update is conditioned on the status the caller believed the order was in,
so two staff members acting simultaneously produce one winner and one clear
error rather than two history rows.

See `docs/ORDER-STATE-MACHINE.md`.

---

## Access control

Four layers, three of which are security (`docs/ROLES-PERMISSIONS.md`):

| Layer | What it does | Is it a control? |
|---|---|---|
| UI | Hides buttons you cannot use | **No** — courtesy |
| Proxy (`src/proxy.ts`) | Redirects unauthenticated `/admin/*`, `/kitchen/*` | Convenience. It verifies a signature; it cannot tell OWNER from KITCHEN |
| Page | `requirePagePermission()` before rendering | **Yes** |
| Server Action | `requirePermission()` before touching data | **Yes — the real boundary** |

A Server Action is a POST endpoint with a generated URL, reachable by anyone
who reads the page source. Each one is written as if the UI did not exist,
because for an attacker it does not.

---

## Authentication

- **Passwords:** bcrypt via `bcryptjs`. Never logged, never returned.
- **Sessions:** HS256 JWT (`jose`), `HttpOnly`, `SameSite=Lax`, 8-hour
  expiry — one working shift, so a tablet left on a counter overnight is not
  a standing session.
- **`AUTH_SECRET` must be ≥ 32 characters.** The app throws rather than sign
  with a short key; a weak secret is a deployment mistake, not a runtime
  condition to paper over.
- **`Secure` follows the protocol, not `NODE_ENV`.** Derived from
  `x-forwarded-proto`. Keying it off `NODE_ENV` breaks any production-mode
  run over plain HTTP — the browser silently drops the cookie and the symptom
  is "login does nothing".
- **Timing:** a bcrypt comparison runs against a dummy hash even when the
  account does not exist, so response time does not reveal which emails are
  registered. The error message does not either.
- **Throttling counts failures only:** 20 per 10 min per IP, 5 per 5 min per
  account. Counting successes would lock out a restaurant at shift change
  behind one NAT'd address while barely inconveniencing an attacker. The
  per-account limit is what actually stops a distributed attempt from walking
  one password space.

---

## Customer data

- **Order tracking is capability-based.** `/order/[token]` requires
  `Order.trackingToken` — 256 bits from `randomBytes(32)`, base64url-encoded.
  The
  human-facing `reference` (`PH-4821`) is short and sequential-looking and is
  **not** accepted as a lookup key anywhere — if it were, incrementing it
  would read the next customer's order.
- **Receipts are never public.** Stored as `bytea`, served only by
  `/api/receipts/[paymentId]` behind `payments.receipt.read`, with
  `Cache-Control: private, no-store` so they do not linger in a CDN. **Every
  view is audited.** A permission failure returns 404, not 403, so an
  unauthorized user learns nothing about which payment ids exist.
- **Uploads are validated by content, not by claim.** Type must be
  JPEG/PNG/WebP, size ≤ 3 MB checked *after* base64 decode, and the bytes are
  sniffed for the format's magic number. A client-declared content type is a
  hint, never a permission. The original filename is sanitized and used for
  display only — it never builds a path, because there is no filesystem path.
- **Analytics carry no personal data.** An opaque cookie id, event names,
  product ids and amounts. No names, no phone numbers, no joins to a customer
  row.

---

## Transport and browser controls

Set by `src/proxy.ts` on every response:

| Header | Value |
|---|---|
| `Content-Security-Policy` | Nonce-based, `strict-dynamic` |
| `X-Content-Type-Options` | `nosniff` |
| `X-Frame-Options` | `DENY` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=(), payment=()` |

The CSP is per-request nonced, `object-src 'none'`, `base-uri 'self'`,
`frame-ancestors 'none'`, `form-action 'self'`.

Two honest notes:

- **`style-src` keeps `'unsafe-inline'`.** `next/font` and Tailwind emit
  inline style elements. An injected stylesheet is a far smaller risk than an
  injected script, and the script directive is the one that is nonced. Worth
  revisiting if the framework starts noncing styles reliably.
- **`upgrade-insecure-requests` is emitted only over HTTPS.** On a plain-HTTP
  origin it rewrites same-origin form posts to `https://`, which then fails
  `form-action 'self'` — and login silently stops working. There is nothing
  to upgrade on such an origin anyway.

**`form-action 'self'` was kept and the redirects were fixed to suit.**
Dropping it would have been the quick fix for that bug; it is also the
directive that stops injected HTML from posting a login form to an attacker's
server. Every redirecting POST now emits a relative `Location`, which is
same-origin by construction (`src/lib/http.ts`).

---

## CSRF

- **Server Actions** carry Next.js's built-in protection.
- **`/api/auth/login`, `/api/locale`** are plain form POSTs. `SameSite=Lax`
  means a cross-site POST carries no session cookie, so a forged login cannot
  attach to an existing session, and the locale route changes nothing that
  matters. `form-action 'self'` blocks the injected-form case from this
  origin.
- **`/api/orders`** requires a JSON body, which a cross-origin form cannot
  send without a preflight.

---

## Rate limits

| Endpoint | Limit |
|---|---|
| `POST /api/orders` | 20 / 5 min per IP |
| `POST /api/auth/login` | 20 failures / 10 min per IP; 5 / 5 min per account |
| `POST /api/orders/[token]/receipt` | 6 / min per IP |
| `POST /api/promotions/preview` | 15 / min per IP |
| `POST /api/analytics` | 60 / min per IP |

**Limitation, stated plainly:** the counters live in process memory, so
across N instances the effective limit is N times the configured one.
Adequate for a single-location pilot; before scaling out, move
`src/lib/rate-limit.ts` to a shared store or use the host's edge rate
limiting. Every caller goes through one module, so it is a one-file change.

---

## Audit trail

Three tables, because they answer different questions:

- `OrderStatusHistory` — every order status change, with actor and reason
- `PaymentStatusHistory` — every payment decision, with reviewer and reason
- `AuditLog` — everything else a staff member can change: prices,
  availability, hours, settings, promotions, accounts, receipt views, sign-ins

`AuditLog.actorName` is denormalized deliberately. Deleting a staff account
nulls the foreign key, and a trail that forgets who did something is not a
trail.

---

## What is tested

`tests/e2e/staff-and-security.spec.ts` drives the boundaries from a real
browser:

- unauthenticated access to `/admin` and `/kitchen` redirects to login
- bad credentials are refused without revealing which field was wrong
- repeated bad passwords for one account are throttled
- a `KITCHEN` session is refused `/admin/settings`, `/admin/staff`,
  `/admin/reports`, `/admin/audit`, and is routed to `/kitchen` on sign-in
- a `CASHIER` session reaches payments but not staff management
- the staff nav hides what the role cannot use
- an anonymous request for a receipt is refused
- a client-submitted price is ignored in favour of the server's own
- an order naming a non-existent product is refused
- the cron endpoint refuses an unauthenticated trigger
- responses carry the expected hardening headers

`tests/integration/orders.test.ts` covers server-authoritative pricing,
idempotency, slot capacity under concurrency, and promotion rule evaluation.

---

## Known gaps

Named rather than omitted:

1. **Rate limiting is per-process** — see above.
2. **No account lockout or MFA.** Throttling slows a password attack; it does
   not stop a determined one against a weak password. Staff passwords are
   set by an operator, so password quality is a handover concern
   (`docs/HANDOVER.md`), not something the code enforces beyond a length
   minimum. MFA is the right answer if the admin panel is ever exposed to a
   wider staff roster.
3. **No automated dependency scanning in CI.** `npm audit` is a manual step.
4. **Receipts grow the database.** Not a vulnerability; an operational limit.
   Past a few hundred a month, move the bytes to object storage and keep the
   row as metadata — the serving route is the only code that changes.
5. **No WAF or bot management.** Whatever the host provides is what there is.

## Never do

- Never accept a price, total, discount or status from a client.
- Never authorize by role comparison; ask the permission
  (`docs/ROLES-PERMISSIONS.md`).
- Never serve a receipt without a permission check and an audit entry.
- Never use `Order.reference` as a lookup key for customer-facing access.
- Never relax `form-action 'self'` to fix a redirect. Fix the redirect.
- Never log a password, a session token, or a full transfer reference.
