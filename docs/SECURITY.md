# Security

Status of the requirements in `docs/PRD.md` §40–46 as actually implemented
in this codebase.

## Implemented

- **Server-authoritative pricing.** `createOrder()` (src/server/orders.ts)
  reloads every product/option price from the database; the client submits
  only IDs and quantities, never prices. Verified manually (see PR
  description / test evidence): submitting an order does not accept a
  client-provided price.
- **Idempotent order creation.** Unique `idempotencyKey` prevents duplicate
  orders from a double-submitted checkout (src/server/orders.ts).
- **Order tracking uses an unguessable capability token**
  (`Order.trackingToken`, a cuid), not the human-facing `reference` code —
  see docs/DATABASE.md.
- **Order status transitions are server-enforced**, not client-settable.
  `assertTransitionAllowed()` (src/lib/order-state.ts) validates both that
  the transition is legal for the order's current state *and* that the
  acting user's role is permitted to perform it. Every transition writes an
  `OrderStatusHistory` row (actor, from/to status, timestamp).
- **RBAC enforced server-side**, not just hidden in the UI: `src/proxy.ts`
  blocks unauthenticated requests to `/admin/*` and `/kitchen/*` at the
  edge; `src/app/admin/(staff)/layout.tsx` and `src/app/kitchen/page.tsx`
  re-check the specific role server-side; `src/server/actions.ts` checks
  the role again inside every mutation before touching the database (never
  trusts that the UI wouldn't have shown the button).
- **Passwords hashed** with bcrypt (`bcryptjs`, cost 10) — never stored or
  logged in plaintext.
- **Sessions** are signed (HS256 JWT via `jose`), `HttpOnly`, `SameSite=Lax`
  cookies with an 8-hour expiry (src/lib/auth.ts) — not readable or
  forgeable from client JS.
- **Login rate limiting**: 10 attempts/minute per IP
  (src/lib/rate-limit.ts) — see docs/DECISIONS.md for its single-process
  limitation.
- **Input validation** on every write boundary via Zod
  (`src/server/order-schema.ts`).
- **No secrets in client code**: `AUTH_SECRET` is read only in server-only
  modules (`src/lib/auth.ts`, `src/proxy.ts`); `.env` is gitignored,
  `.env.example` documents every variable without real values.

## Explicitly out of scope for this pass (tracked, not silently skipped)

- **File upload / receipt storage** for bank-transfer proof images
  (docs/PRD.md §42) is **not implemented** — the current bank-transfer flow
  only collects a text reference number. Before enabling real receipt
  uploads: validate MIME type and size server-side, generate a random
  storage filename (never trust the client's filename), store outside the
  public web root or behind an authorization check, and never expose the
  raw storage path to the client.
- **CSRF**: Server Actions get Next.js's built-in CSRF protection
  automatically. The two plain POST routes (`/api/auth/login`,
  `/api/locale`) accept form submissions same-origin only by convention;
  if this app is ever embedded or called cross-origin, add explicit CSRF
  tokens or `Origin` header checks to those routes.
- **Audit logging** beyond order/payment status history (the `AuditLog`
  table exists in the schema but nothing writes to it yet) — see
  docs/DATABASE.md.
- **Automated security tests** (IDOR probing, role-escalation attempts,
  malicious upload fuzzing per docs/PRD.md §73) — the unit tests in
  `tests/unit/` cover the *business rule* correctness (state machine,
  scheduling) that security depends on, but there is no dedicated adversarial
  test suite yet. Recommended before production: automated tests that
  attempt to hit `/admin/*`/`/kitchen` without a session, attempt an
  invalid state transition via a crafted Server Action call, and attempt to
  fetch another customer's order by guessing a `reference` instead of a
  `trackingToken`.

## Never do

- Never trust a client-submitted price, total, product ID validity, or
  order/payment status.
- Never let the kitchen role read payment verification or settings screens
  (enforced by `roleCanAccessAdmin`/`roleCanAccessKitchen` in
  `src/lib/auth.ts` plus the per-transition role table in
  `src/lib/order-state.ts`).
- Never log passwords, session tokens, or full payment reference numbers at
  debug level in production.
