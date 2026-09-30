# Decisions

Architectural choices and the tradeoffs they carry. Each records what was
decided, why, and what it costs — so the next person can tell a deliberate
choice from an accident.

---

## PostgreSQL, with versioned migrations

**Context.** The first pass used SQLite for zero-setup development.
**Decision.** PostgreSQL (`prisma/schema.prisma`), with
`prisma/migrations/` under version control.
**Why.** The target deployment is serverless, where the filesystem is
read-only and ephemeral — a SQLite file cannot survive there, and cannot be
shared between instances. `PRD.md` §66 asks for Postgres, and the features
the product needs (`Json` columns for audit metadata, `@db.Date`, `bytea`
for receipts, `groupBy` aggregates for reports) are all Postgres-native.
**Cost.** Development needs a running Postgres rather than a file. See
`docs/TESTING.md` for the one command that provides one.

---

## The timezone layer

**Context.** Business hours are stored as `"16:00"`, meaning 16:00 in Al
Mukalla. The original code evaluated them with `date.setHours()`, i.e.
against the *server's* clock.
**Decision.** `src/lib/time.ts` converts between wall-clock readings and
instants using `Restaurant.timezone` and `Intl`, with no dependency.
**Why.** On a UTC host the original approach shifts every pickup slot by the
restaurant's offset — three hours here. The failure is silent: the app still
works, it is simply wrong about when the restaurant is open. Making the
timezone explicit and data-driven also means the platform can serve a
restaurant in another zone without a code change, which is the
`Novixa Restaurant` direction (`PRD.md` §89).
**Cost.** Slightly more ceremony at each call site. `tests/unit/time.test.ts`
covers the conversions, including a DST boundary for zones that have one.

---

## Relative redirects everywhere

**Context.** `NextResponse.redirect(new URL(path, request.url))` is the usual
pattern. `request.url` is the URL as the *server* resolved it, which is not
always the origin the browser used — a request to `127.0.0.1` can come back
as `localhost`, and behind a proxy it can be an internal hostname.
**Decision.** `src/lib/http.ts` emits a relative `Location` header. Proxy
redirects, which Next requires to be absolute, build the origin from
`x-forwarded-host`/`host` instead.
**Why.** A cross-origin `Location` after a form POST is refused by the browser
under `form-action 'self'` — which presented as *staff login silently doing
nothing in Chrome*, with no server-side error to find. Relative is
same-origin by construction and needs no guessing.
**Cost.** None. `ensureSameOriginPath` also gives one place to enforce the
open-redirect guard on every `?next=` parameter.

---

## Cookie `Secure` and CSP `upgrade-insecure-requests` follow the protocol, not NODE_ENV

**Context.** Both were keyed off `process.env.NODE_ENV === "production"`.
**Decision.** Both are derived from the request's actual scheme, honouring
`x-forwarded-proto`.
**Why.** Any production-mode run over plain HTTP — a staging box, a kitchen
tablet on the LAN, an end-to-end suite against a local build — breaks in two
ways that are hard to diagnose: the browser silently drops the `Secure`
cookie, and `upgrade-insecure-requests` rewrites same-origin form posts to
`https://`, which then fails `form-action 'self'`. Real deployments terminate
TLS at a proxy that sets the header, so both stay on where it matters.
**Cost.** None. This is how established auth libraries decide the same thing.

---

## `form-action 'self'` kept; POST-redirect-GET made compatible with it

**Decision.** The CSP keeps `form-action 'self'`, and every redirecting POST
emits a same-origin `Location`.
**Why.** `form-action` is the directive that stops injected HTML from posting
a login form to an attacker's server. Dropping it would have been the quick
fix for the login bug; fixing the redirects was the right one.

---

## Login throttling counts failures only

**Context.** The first implementation counted every attempt, 10/minute per IP.
**Decision.** Failures only: 20 per 10 minutes per IP, 5 per 5 minutes per
account.
**Why.** A restaurant's staff sign in together at shift change, and behind
NAT they share one address. Counting successes would lock out the normal
case while barely inconveniencing an attacker. Failures are the thing worth
rationing. The per-account limit is what actually stops a distributed attempt
from walking one password space.
**Cost.** A successful-credential attacker is unthrottled — which is what a
password check is for.

---

## ASAP rolls forward; scheduled does not

**Decision.** An ASAP order takes the earliest slot *with capacity*. A
scheduled order for a full slot is rejected with a suggestion.
**Why.** "As soon as possible" is the customer declining to choose a time.
Answering with "that time is full, pick another" is nonsense — they picked
nothing. A customer who *did* choose 19:00 should be told 19:00 is gone
rather than silently moved.

---

## Receipts stored in the database

**Decision.** `PaymentReceipt.data` is a `bytea` column, capped at 3MB,
served only by `/api/receipts/[paymentId]` behind a permission check that
audits every view.
**Why.** The alternatives were a public folder (no access control, guessable
URLs — exactly what `PRD.md` §42 rules out) or object storage (another
service to provision, credential, and pay for, before the restaurant has
taken its first order). Keeping the bytes in the database makes the
authorization check unavoidable and the deployment dependency-free.
**Cost.** Database size grows with receipt volume, and every read passes
through the app server. At a few hundred receipts a month this is
immaterial; past that, move the bytes to object storage and keep the row as
metadata — the serving route is the only code that changes.

---

## `requirePagePermission` redirects; `requirePermission` throws

**Decision.** Pages redirect an under-privileged staff member to
`/admin/no-access`; Server Actions throw a `ForbiddenError` that the action
wrapper maps to a code.
**Why.** A page that throws renders the generic error boundary — "something
went wrong" — which is both unhelpful and indistinguishable from a real
fault. Next.js 16 ships `forbidden()` for exactly this, but only behind the
experimental `authInterrupts` flag, and a client deliverable should not
depend on an experimental toggle. Revisit when it stabilizes.

---

## Prisma pinned to 6.x

**Decision.** Prisma 6.19.x, not the 8.0 release candidate.
**Why.** A release candidate is the wrong foundation for something handed to
a client and maintained long-term; 8.0 also moves `datasource.url` into a new
config model. Revisit once 8 is GA.
**Cost.** A deprecation warning about `package.json#prisma`, which is
harmless in 6.x.

---

## Cookie-based locale rather than `/[lang]/…` routing

**Decision.** One route tree, an `ph_locale` cookie, and `getLocale()`.
**Why.** It kept the MVP's routing simple while still shipping full Arabic
(default, RTL) and English with correct `dir`/`lang`.
**Cost — the real one.** There is no distinct indexable URL per language, so
Arabic and English cannot be separately ranked (`PRD.md` §47, §51 want both
indexed). This is the most significant SEO limitation in the build. Migrating
to `app/[lang]/…` later is additive: the dictionaries and the `pick()` helper
carry over unchanged. See `docs/SEO.md`.

---

## Illustrated menu art, not photography

**Decision.** `public/menu/*.svg`, generated by `scripts/generate-menu-art.mjs`.
**Why.** The real food photography has to come from Pizza House. Stock or
generated "photos" would show a customer a product they will not receive,
and binding the deployment to a third-party image CDN adds a dependency the
app does not need. Each illustration sits at exactly the path a real photo
will replace — swap the file, keep the path.
**Cost.** The site looks illustrated rather than photographed until the owner
supplies images. That is the honest state of the project.

---

## In-memory rate limiting

**Decision.** Per-process counters (`src/lib/rate-limit.ts`).
**Cost, stated plainly.** Across multiple instances each process enforces its
own limit, so the effective limit is the configured one times the instance
count. Acceptable for a single-location pilot; move to a shared store (Redis,
or the host's own edge rate limiting) before scaling out. Every caller goes
through one module.

---

## Single restaurant row

**Decision.** No tenant model. `getRestaurant()` is `findFirst()`.
**Why.** `PRD.md` §5.2 and §89 are explicit that multi-tenancy is not an MVP
requirement and that building it early slows delivery.
**What was done anyway.** Every restaurant-specific value — name, hours,
currency, prep time, slot rules, payment instructions, bank details, SEO copy
— lives in that row and is editable from the admin panel. No business logic
hardcodes a Pizza House value. Adding `restaurantId` later is a schema and
query change, not a rewrite.
