# Pizza House — Project Handbook

The single entry point. Everything about this project in one file: what it
is, what is built, how it works, how it is styled, how it is tested, how it
ships, what is left, and the rules that hold it together.

Each section is a summary with a pointer to the document that goes deeper.
If the two ever disagree, the deeper document is right and this one needs
updating.

**Status:** feature-complete and deployed, carrying placeholder restaurant
data. Not yet launchable — see [§12](#12-what-is-blocked-on-the-owner).

---

## Contents

1. [The product in one page](#1-the-product-in-one-page)
2. [Project facts](#2-project-facts)
3. [Tools and stack](#3-tools-and-stack)
4. [What is built](#4-what-is-built)
5. [The rules that hold it together](#5-the-rules-that-hold-it-together)
6. [Design: UI, UX and the style system](#6-design-ui-ux-and-the-style-system)
7. [Testing](#7-testing)
8. [Workflows](#8-workflows)
9. [Deployment and environments](#9-deployment-and-environments)
10. [Progress log](#10-progress-log)
11. [Bugs found by review, and what they taught](#11-bugs-found-by-review-and-what-they-taught)
12. [What is blocked on the owner](#12-what-is-blocked-on-the-owner)
13. [Plans and ideas, in priority order](#13-plans-and-ideas-in-priority-order)
14. [Document map](#14-document-map)

---

## 1. The product in one page

Pizza House is a pickup restaurant in Al Mukalla, Yemen. This is its ordering
platform — Arabic-first, bilingual, and built around one promise:

> The customer chooses **when they want to collect their food**, and the
> system works backwards to decide **when the kitchen should start**, so the
> order is ready as they arrive.

```
 customer picks pickup 19:00
            │
            │  prep time for this basket = 25 min  (max across the items)
            ▼
 kitchenReleaseAt = 19:00 − 25 min = 18:35
            │
            ├── 16:00  order placed        → CONFIRMED, invisible to the kitchen
            ├── 18:35  release scheduler    → QUEUED, appears on the kitchen display
            ├── 18:37  cook starts          → PREPARING
            ├── 18:58  food is bagged       → READY   (customer notified)
            └── 19:00  customer arrives     → COMPLETED
```

Everything else exists to make that promise keepable:

| Mechanism | What it protects |
|---|---|
| Slot capacity | The kitchen is never handed more than it can cook in a 15-minute window |
| Release scheduler | Food starts at the right time without anyone watching a clock |
| Payment verification | An unverified bank transfer cannot occupy a slot |
| Timezone layer | "16:00" means 16:00 in Al Mukalla, whatever the server's clock says |
| Admin panel | Every rule above is editable by the restaurant, not by a developer |

Source of the idea: `docs/PROJECT_ORIGIN.md`. Full requirements: `docs/PRD.md`.

---

## 2. Project facts

| | |
|---|---|
| Client | Pizza House, Al Mukalla, Hadhramaut, Yemen |
| Built by | Novixa |
| Repository | `Novixa-dev/pizza_house66` |
| Working branch | `claude/lucid-bohr-kmmyyp` |
| Live deployment | Railway (app + PostgreSQL in one project) |
| Languages | Arabic (default, RTL) and English (LTR) |
| Currency | YER, integer minor units |
| Timezone | `Asia/Aden` (UTC+3, no DST) — stored as data, not hardcoded |
| Application code | ~20,600 lines across 135 TypeScript/TSX files in `src/` |
| Tests | 259 unit · 71 integration · 190 end-to-end (95 × two projects; one skipped by design) |
| Documentation | 31 files in `docs/`, plus this handbook |

This is also the reference implementation for **Novixa Restaurant**, a
reusable product for other restaurants — see [§13](#13-plans-and-ideas-in-priority-order).

---

## 3. Tools and stack

**Runtime and framework**

| Tool | Version | Why |
|---|---|---|
| Next.js | 16.3.5 (App Router) | Server components keep pricing and permissions on the server by construction |
| React | 19.2 | Server Actions for staff mutations; forms work before hydration |
| TypeScript | 5.x, strict | The permission and dictionary types catch whole classes of mistake at compile time |
| Node | ≥ 20.9 | Pinned in `.nvmrc` and `engines.node` — see [§11](#11-bugs-found-by-review-and-what-they-taught) |

**Data**

| Tool | Version | Why |
|---|---|---|
| PostgreSQL | 16 | `Json`, `@db.Date`, `bytea` receipts, `groupBy` reports; survives a read-only serverless filesystem |
| Prisma | 6.19.x | Versioned migrations under source control. Pinned off the 8.0 RC deliberately |

**Interface**

| Tool | Version | Why |
|---|---|---|
| Tailwind CSS | v4 | `@theme inline` over CSS custom properties: one palette, retheming is one block |
| next/font | — | Self-hosted, no render-blocking third-party stylesheet |

**Validation, auth, testing**

| Tool | Purpose |
|---|---|
| Zod 4 | Every write boundary. The request schema has no price field to tamper with |
| jose | HS256 session JWTs, `HttpOnly`, 8-hour expiry |
| bcryptjs | Password hashing |
| Vitest 5 | Unit and integration |
| Playwright 1.63 | End-to-end, two projects: mobile-Arabic and desktop-English |
| axe-core | WCAG 2.1 A/AA inside the Playwright suite |

**Deliberately absent:** no UI component library (the design system is 16
primitives, ~360 lines), no state manager (server components plus one cart
context), no ORM abstraction over Prisma, no analytics SDK, no CSS-in-JS.
Every dependency is one someone would have to justify at review.

---

## 4. What is built

### Customer site

| Screen | What it does |
|---|---|
| Home | Hours, location, payment methods, FAQ, `Restaurant` + `FAQPage` structured data |
| Menu | Database-driven, category rail, search |
| Product | Generic option groups (size, crust, add-ons), live price, related items |
| Cart | Persisted client-side across reloads |
| Checkout | Guest details, ASAP or a server-generated slot, promo code, payment method, receipt upload |
| Order tracking | Capability-token URL, live timeline, auto-refresh |

### Staff admin (`/admin`)

Dashboard · Orders (filters, detail, transitions) · Payments (verification
queue, receipt viewer) · Products · Categories · Option groups · Promotions ·
Customers · Hours (weekly + dated overrides) · Settings · Staff · Reports
(revenue, top products, payment mix, funnel, busiest slots) · Audit log.

### Kitchen (`/kitchen`)

Queued / Preparing / Ready lanes with live timers, late highlighting, a
separate lane for scheduled orders not yet startable, and one-tap
transitions. Deliberately outside the admin shell — a cook needs no
navigation.

### Platform

Timezone layer · server-authoritative pricing · order state machine ·
26-permission matrix · audit trail · nonce-based CSP · idempotent order
creation · guarded concurrent updates · first-party analytics · SEO and PWA ·
scheduled kitchen release with a fail-closed cron endpoint.

Feature-by-feature status, including what is deliberately *not* built:
`docs/PROJECT-STATUS.md`.

---

## 5. The rules that hold it together

These are invariants. Breaking one is a bug even if tests pass.

**1. The client is never trusted for money.** `POST /api/orders` accepts
product ids, option ids and quantities. There is no price field in the
schema, so there is nothing to tamper with. `createOrder` reloads every price
and recomputes the total.

**2. The client can never set an order's status.** No endpoint accepts one.
Every change goes through `transitionOrder`, which checks the edge is legal
*and* that the actor may walk it, then writes the change and its history row
in one transaction.

**3. Authorization asks permissions, never roles.** `can(role, "payments.verify")`,
never `role === "MANAGER"`. Adding a role is one line in one table.

**4. Money is integer minor units.** No floats, anywhere, ever.

**5. Wall-clock time goes through `src/lib/time.ts`.** Nothing else calls
`setHours` or `getDay`. "16:00" means 16:00 in the restaurant's zone — and
so does a bare `"2026-01-05"` off a date input, which `new Date()` would
otherwise read as midnight UTC. `startOfDateInput` / `endOfDateInput` /
`toDateInputValue` are the round-trip; an end date covers the whole of its
day, because an offer advertised until a date is good through it.

**6. Order lines snapshot what was bought.** A price rise on Thursday never
rewrites Tuesday's receipt.

**7. `Order.reference` is not a capability.** Tracking uses
`Order.trackingToken` — 256 random bits. Incrementing a reference must never
read someone else's order.

**8. `src/lib` is pure.** No I/O, clock as a parameter. That is what makes
the rules that most need to be correct testable to the minute.

**9. Redirects are relative.** An absolute `Location` can resolve to a
different origin than the browser used, and `form-action 'self'` then refuses
it — which once presented as staff login silently doing nothing.

**10. The UI hiding a control is not security.** Every Server Action
re-checks, because a Server Action is a POST endpoint anyone can read from
the page source.

**11. A package the production build resolves is a dependency of it.** Not
a devDependency, whatever it is used for: a host with `NODE_ENV=production`
prunes those before the build runs. CI has a job that installs the same way,
because every other job runs a plain `npm ci` and so cannot see this class of
failure at all.

**12. A reported number names the table it came from.** The orders table is
the authority on how many orders exist; the analytics table is a lossy
signal about journeys, and `AnalyticsEvent.orderId` is deliberately not a
foreign key so history survives a deletion. A chart that mixes the two
produces a funnel wider at the bottom than the top — which it did, twice.
`foldFunnel` in `src/lib/funnel.ts` counts sessions that reached *at least*
each step and nothing else, so it is monotonic for any input; the true order
count is read straight from the orders table beside it.

---

## 6. Design: UI, UX and the style system

### Intent

`docs/PRD.md` §48 asks for premium without "gradient soup". The result is
restrained: one warm food-first palette, real typographic hierarchy, generous
spacing, and very little else.

### Tokens

Everything lives in the `:root` block of `src/app/globals.css`, exposed to
Tailwind through `@theme inline`. **Components reference semantic names only**
— `bg-surface`, `text-ink-muted`, `border-line` — never a raw hex. Retheming
for another restaurant is a change to that one block.

| Group | Tokens |
|---|---|
| Ground | `page`, `page-elevated`, `surface`, `surface-muted` |
| Text | `ink`, `ink-soft`, `ink-muted` |
| Lines | `line`, `line-strong` |
| Brand | `brand`, `brand-hover`, `brand-soft`, `brand-ink` (tomato) |
| Accent | `accent`, `accent-soft` (basil) |
| Highlight | `gold`, `gold-soft` |
| State | `danger`, `info` (+ `-soft`) |
| Focus | `focus-ring`, `focus-halo` |

Palette intent: tomato, basil, warm gold, an oven-warm neutral ground. Not a
blue-grey SaaS dashboard, not black-on-white minimalism — a restaurant.

Dark mode is a **full re-declaration** of the same token names, not an
inversion filter. Brand red lightens to `#e8685a` because the light-mode
value fails contrast on a dark ground.

### Components

`src/components/ui/index.tsx` — sixteen primitives every screen is built
from: `Button` `ButtonLink` `Card` `SectionHeading` `Badge` `Alert`
`EmptyState` `Field` `Input` `Textarea` `Select` `Checkbox` `StatCard`
`DescriptionRow` `Divider` `buttonClass`.

Three rules they all follow:

1. **Variants are props, not class strings at the call site.** One button
   looks the same everywhere because there is one button.
2. **Interactive targets are ≥ 44 px.** A cook taps these with a thumb, in a
   hurry, possibly with flour on their hands.
3. **`Field` owns the label/description/error relationship**, generating ids
   and wiring `aria-describedby`/`aria-invalid` — so accessible markup is the
   path of least resistance.

### The seven style rules that are load-bearing

These are not preferences. Each one was a bug first.

**Use logical properties.** `ps-`/`pe-`/`ms-`/`text-start`/`border-s`, never
`pl-`/`ml-`/`text-left`. Physical properties do not flip with `dir`, and the
bug only appears in the language most customers use.

**`.numeric` goes on the number and nothing else.** It forces `direction: ltr`
with `unicode-bidi: isolate` so `16:00 – 00:00` is not reordered. Put it on a
container holding Arabic words and it eats the space before the value —
`يبدأ من2,200`. That was real, in nine places.

**Never use container `opacity` to recede a block of text.** It composites
every descendant toward whatever is behind it, so rendered contrast falls
below AA however carefully the tokens are chosen, and no token arithmetic
reveals it. Use `bg-surface-muted`. The kitchen's scheduled lane shipped with
`opacity-85` and failed for exactly this reason.

**Grid and flex children need `min-w-0`.** They default to `min-width: auto`
and refuse to shrink below min-content, pushing the page wider than the
screen. Checkout rendered 555px of content in a 414px viewport this way,
sliding the pickup-slot buttons partly off-screen.

**The focus indicator is two-tone.** A single ring colour is invisible
wherever it matches the surface — a brand ring on the brand-coloured skip
link measured exactly 1.00:1. `--focus-ring` plus a `--focus-halo` box-shadow
guarantees one of the two always contrasts.

**Every target gets an explicit 24px floor, and a thumb-sized one where a
thumb lands.** A bare text link's hit box is
whatever its line box happens to be, which is 18px at `text-sm` in English.
Three footer links cleared the WCAG 2.2 floor (SC 2.5.8) only because
`[dir="rtl"]` sets line-height 1.75 — accessible in Arabic and not in
English, from the same markup. Give an interactive element `min-h-6` with
centred content rather than inheriting a size by accident. Asserted for
every link, button, input and select in `tests/e2e/accessibility.spec.ts`.
Primary controls on a phone get `min-h-11` (44px) instead — passing the AA
floor is not the same as being comfortable to hit.

**Numbers a person reads go through `Intl`, never through concatenation.**
Money, times, dates and durations each have a formatter, and all four pin
the numbering system to Western digits so one order row does not show ٤٥
beside 2,200. Arabic is why this is load-bearing rather than tidy: دقيقة,
دقيقتان, ٣ دقائق and ١١ دقيقة are four forms of one word selected by the
number in front of it, so `${n} ${word}` is wrong for most values of `n`.
`describeDuration` in `src/lib/duration.ts` is the entry point for elapsed
and remaining times.

### Arabic typography

Arabic gets its own face and looser leading:

```css
[dir="rtl"] body { font-family: var(--font-arabic); line-height: 1.75; }
```

Arabic script needs vertical room Latin does not; identical leading makes the
Arabic look cramped and the Latin look loose.

Digits are **Western-Arabic in both languages** — `1234`, not `١٢٣٤`. That is
what Yemeni customers see on a bank app, a price list and a phone keypad.
Enforced by `-u-nu-latn` on every `Intl` formatter and asserted in tests,
because half the app using one system and half the other is what shipped
before anyone checked.

### Motion and focus

160 ms transitions on cards and buttons. Nothing animates on load; nothing
moves while someone is reading a price. `prefers-reduced-motion: reduce`
collapses every animation and transition to 0.01 ms in one global block, so a
new component cannot forget it.

### Imagery

18 SVG illustrations in `public/menu/`, generated by
`scripts/generate-menu-art.mjs`. Illustrations rather than photographs on
purpose: real food photography has to come from the restaurant, stock photos
show a customer a product they will not receive, and an external image CDN
adds a deployment dependency. Each sits at exactly the path a real photo will
replace.

Deeper: `docs/DESIGN-SYSTEM.md`, `docs/LOCALIZATION.md`.

---

## 7. Testing

| Suite | Question it answers | Count | Command |
|---|---|---|---|
| Unit | Are the rules correct? | 118 | `npm test` |
| Integration | Does the database agree? | 28 | `npm run test:integration` |
| End-to-end | Does a person get through it? | 102 | `npm run test:e2e` |
| Smoke | Is a deployment serving and still private? | 19 | `npm run smoke -- <url>` |

`npm run verify` chains typecheck → lint → unit → build.

**Unit** covers `src/lib`, which is pure and takes the clock as a parameter:
scheduling to the minute, the timezone layer including a DST boundary,
pricing and every promotion rejection path, the permission matrix, the state
machine, and digit rendering.

**Integration** runs against a real PostgreSQL, because the properties tested
are ones only a database can violate: server-authoritative pricing,
idempotency, slot capacity inside the creation transaction, and kitchen
release.

**End-to-end** runs against a real production build in two projects —
`mobile-ar` (Pixel 7, Arabic, RTL) and `desktop-en` — with the timezone
pinned to `Asia/Aden`. Covers the customer journey, the staff journey, the
security boundaries, WCAG 2.1 A/AA via axe-core in light and dark,
horizontal-overflow assertions at phone width, and the rendered size of
every interactive target against the 24px floor of WCAG 2.2 SC 2.5.8.

**What automated tests cannot do:** axe-core catches perhaps a third to a
half of WCAG issues and cannot judge whether alt text is meaningful or a
reading order sensible. `docs/QA-CHECKLIST.md` is the manual pass, and it
still matters.

Deeper: `docs/TESTING.md`, `docs/QA-CHECKLIST.md`.

---

## 8. Workflows

### Day-to-day development

```bash
cp .env.example .env            # set DATABASE_URL and AUTH_SECRET
npm install
npm run db:migrate:dev
npm run db:seed
npm run dev
```

Before pushing: `npm run verify`. Before touching UI: look at it in Arabic at
phone width.

### Adding a feature

1. If it has a rule, put the rule in `src/lib` and unit-test it there.
2. If it writes to the database, add an integration test for what the
   database could violate — uniqueness, a transaction boundary, a race.
3. If a person will do it, add one end-to-end test for the path they take.
4. Compose the UI from `src/components/ui`; extend a primitive rather than
   forking it.
5. Update the document that covers the area, and this handbook if the
   summary changed.

### Adding a role

Add it to `enum Role`, migrate, add its permission list to
`ROLE_PERMISSIONS`, add its label to the dictionaries, add a row to the table
in `docs/ROLES-PERMISSIONS.md`. Nothing else changes — pages and actions ask
about permissions, and the new role answers.

### Changing a schema

`npm run db:migrate:dev` writes a migration. Never `prisma db push` — it
mutates without recording how. Deployment runs `prisma migrate deploy`, which
applies only what is committed.

### Continuous integration

`.github/workflows/ci.yml`, three jobs on every pull request:

| Job | Runs | Needs a database |
|---|---|---|
| `static` | typecheck → lint → unit | No — so a type error fails in under a minute |
| `integration` | migrate → seed → integration | Postgres 16 service |
| `e2e` | build → Playwright, both projects | Postgres 16 service |

Each job is guarded so a branch with an open pull request builds once, not
twice. A failing E2E run uploads its Playwright report as an artifact.

### Releasing

Push → CI → review → merge → Railway deploys the branch → `npm run smoke`
against the deployed URL → walk `docs/QA-CHECKLIST.md` if the change touches
the ordering flow.

---

## 9. Deployment and environments

The live deployment is Railway: the Next.js app and PostgreSQL 16 in one
project, with the app referencing the database internally via
`${{Postgres.DATABASE_URL}}` — so the credential resolves at runtime and is
never copied into a second place.

Each deploy runs, from `railway.json`:

```
prisma migrate deploy  →  db:seed  →  next start
```

behind a health check on `/`.

**`db:seed` in a start command is safe only because of `SEED_ONLY_IF_EMPTY=1`.**
The seed upserts, so without the guard every redeploy would rewrite the
owner's edited prices back to demo values. Never set that start command
without that variable.

### Variables

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL. SQLite will not work |
| `AUTH_SECRET` | Yes | ≥ 32 chars. The app throws rather than sign with a short key |
| `CRON_SECRET` | Production | **Unset means the cron endpoint returns 401** — it fails closed |
| `NEXT_PUBLIC_APP_URL` | Recommended | Canonical URLs, Open Graph, sitemap |
| `SEED_ONLY_IF_EMPTY` | Deployments | `1`. See above |
| `SEED_STAFF_PASSWORD` | Dev | Demo accounts only |

Vercel, containers and any Node host also work; nothing in the code is
platform-specific. Deeper: `docs/DEPLOYMENT.md`, `docs/ENVIRONMENT.md`.

---

## 10. Progress log

| Phase | Outcome |
|---|---|
| Foundation | PostgreSQL with versioned migrations, environment, seed |
| Design system | Token-driven palette, 16 primitives, premium public site |
| Ordering | Slot picker, receipt upload, promotions, order tracking |
| Admin | Twelve screens, full CRUD, reports, audit |
| Kitchen | Live board, timers, scheduled lane |
| Hardening | Permission matrix, audit logging, CSP, scheduled release |
| Testing | Unit, integration and end-to-end suites |
| SEO, analytics, PWA | Structured data, sitemap, funnel, manifest |
| Documentation | 24 documents, rewritten from the code |
| CI | Four-job workflow (static, production build with no devDependencies, integration, end-to-end), run once per commit by the pull-request event |
| Deployment | Live on Railway with a post-deploy smoke check and a startup wait for the database |
| Accessibility | axe-core in CI; three real defects found and fixed |
| Review | Screen-by-screen design and UX pass against the running app: 17 defects found and fixed, 248 tests green |

`docs/ROADMAP.md` maps this onto the PRD's phases.

---

### Review pass: every screen, as its user

A second pass over the built application, screen by screen, reading each one
as the person who has to use it rather than as the person who wrote it. The
customer side was walked at 414px in Arabic and at 1440px in English; the
staff side as an owner, a cashier and a kitchen account.

Seventeen defects came out of it, all listed in the table below. The ones
worth naming separately:

- The **conversion funnel** was not a funnel. It took two fixes: the first
  established that lossy browser beacons and reliable server writes cannot
  be counted the same way, and the second that a chart's unit has to be one
  thing.
- The **dashboard reported an idle restaurant** while ten orders sat
  unstarted in the kitchen queue.
- A **promotion expired 21 hours early** in the restaurant's own timezone.
- The **kitchen board** showed "متأخر 6862" on the screen that most needs to
  be readable at a glance.

An external accessibility scan of the deployment arrived during the pass and
was worth exactly one of its five findings. Its touch-target report was real
and understated — measuring every element found seven failures where it
reported three. Its two focus-indicator findings were false positives from
using a programmatic `.focus()`, which does not match `:focus-visible` on a
link or a button; all 22 keyboard stops carry a ring and a halo when tabbed
to. Its `alt=""` finding was wrong on the standard: that is how an image is
marked decorative. **A scanner's finding is a lead, not a verdict** — each
one is worth the measurement it takes to confirm.

Its own rescan then closed the loop: the touch-target finding dropped from
🔴 SC 2.5.8 (24px, AA) to 🔵 SC 2.5.5 (44px, AAA), which is independent
confirmation that the fix reached the live site. The remaining AAA
suggestion was taken only where it earns its keep — the mobile nav pills and
the language toggle, the whole of the navigation on a phone, went from 28px
to 44px. The footer's text links stay at 24px: they are read rather than
aimed at, and making every line of text 44px tall would cost more than it
buys. The reply on the PR records all of this with the measurements, so the
disagreement is checkable rather than asserted.

---

## 11. Bugs found by review, and what they taught

Every one of these was found by running the built application and looking at
it — not by reading the code. They are listed because the lesson is reusable.

| Bug | Lesson |
|---|---|
| Business hours evaluated against the **server's** clock | A silent three-hour error. Wall-clock time needs an explicit zone, always |
| Redirects built from `request.url` | It can resolve to a different origin than the browser used; `form-action 'self'` then refuses the POST. Staff login "did nothing" in Chrome |
| `upgrade-insecure-requests` on plain HTTP | Rewrote same-origin form posts to `https://` and broke them. Emit only over HTTPS |
| Cookie `Secure` keyed off `NODE_ENV` | Any production-mode run over HTTP silently drops the session cookie |
| ASAP rejected with "that time is full" | The customer picked no time. Error copy must match what the user actually did |
| Slot capacity counted exact timestamps | 19:00 and 19:07 in different buckets meant capacity meant nothing |
| Login throttle counted successes | A shift change behind one NAT'd address could lock out a restaurant |
| `.numeric` on Arabic containers | Forcing LTR on mixed content eats the space before the value |
| Arabic dates in Arabic-Indic digits | Two digit systems in one order row, because money and time used different formatters |
| `releaseDueOrders` history row outside its transaction | A crash between the two leaves an order that moved with no record of how |
| Nixpacks defaulted to Node 18 | Declare the Node version or a builder picks its own |
| `--gold` failed AA on every light surface | A design system claiming AA needs a test, or the claim decays |
| `opacity-85` on the kitchen lane | Container opacity defeats any amount of token care |
| Checkout 555px wide in a 414px viewport | Grid children need `min-w-0`; the slot buttons slid off-screen |
| Focus ring 1.00:1 on the skip link | A single ring colour is invisible somewhere. Two-tone or nothing |
| ASAP promised "~20 minutes" while closed | A constant in the UI made a promise the server would not keep |
| Conversion funnel grew as it descended | Two halves collected differently — lossy browser beacons on top, server writes at the bottom — cannot be counted the same way |
| A funnel of sessions holding un-sessioned orders | The second attempt at the above. A chart's unit has to be one thing; orders without a session belong to the orders table, not to a funnel of journeys |
| 377 recorded orders against 16 real ones | `AnalyticsEvent.orderId` is deliberately not a foreign key, so events outlive orders. Right for production history, a slow leak in a database that is wiped and refilled |
| "Nothing needs attention" while ten orders sat unstarted | An attention queue is only as good as the states it knows to watch. `QUEUED` is where waiting is pure lost time, and it was the one state unwatched |
| The tile row read all zeros while the kitchen was behind | It counted `PREPARING` and not `QUEUED` |
| Customer count was the page size | `take: 100` then `array.length` as the total. A capped list is not a count |
| A promotion ended 21 hours early | `new Date("2026-01-05")` is midnight **UTC** — the one case where JS date parsing is not local. A calendar date only means something inside a timezone |
| A button labelled "Sold out" beside a badge labelled "Available" | Name a control for what it does, never for a state — most of all the one used mid-service |
| Eighteen identical "Mark sold out" buttons | A screen reader hears a list of controls out of the context of the row they sit in |
| "متأخر 6862" on the kitchen board | Four digits and no unit, on the screen read at a glance from across a room |
| "3 دقيقة" for a three-minute prep time | Arabic has four forms of that word chosen by the number in front of it. `Intl.NumberFormat` knows them; concatenation never will |
| "16 الطلبات" | A number in Arabic is not followed by the definite article |
| Three footer links 18px tall in English, 24px in Arabic | They cleared the floor only because `[dir="rtl"]` sets line-height 1.75. Accessible in one language and not the other is not accessible |
| Half the activity log in English | A log the owner cannot read is not an audit trail |
| Payment instructions in a single-line input | The owner could only see the first few words of a sentence the customer reads at checkout |
| A deploy crash-looped on `P1001` while the database was healthy | A container is up before the private network is. Wait for the dependency; do not race it, and do not wrap the migration itself in the retry |
| The production build needed a devDependency | `NODE_ENV=production` makes npm prune devDependencies, so `@tailwindcss/postcss` was gone before `next build` ran. It had been wrong since the first deploy and only surfaced when a warm build cache rotated — arriving on an unrelated commit and looking like its fault. "dev" describes who runs a package, not when it is needed |
| Fixing that did not fix the deploy | Turbopack's `.next/cache` keeps a failed build's state and fails the next build for the original reason after it is gone. Railway persists that directory between deploys, so one failure made every later build fail and no correct commit could ship. A build must be able to recover from its own cache |

Three patterns run through the list. **Anything that depends on the
environment** — clock, protocol, origin, Node version, timezone, locale —
needs to be read from the environment rather than assumed. **Anything the
design system claims** needs a test or it quietly stops being true. And
**any number shown to a person** needs to be traced to the table it came
from: the funnel, the customer count and the order tiles were each wrong in
a way that looked plausible until the two numbers on the same screen were
compared.

A fourth, learned the hard way on the funnel: when a fix produces the same
symptom by a different route, the model is wrong, not the arithmetic. The
first funnel fix was correct about *why* the data disagreed and still built
a chart that bulged at the bottom, because it kept mixing two units in one
column.

---

## 12. What is blocked on the owner

None of this is development work. Each is information or a decision only
Pizza House can supply. `docs/HANDOVER.md` walks through them in order.

| # | Needed | Why it blocks launch |
|---|---|---|
| 1 | Real menu, prices, descriptions | We have 16 items; the restaurant's own delivery-app listing shows ~184 (`docs/FIELD-RESEARCH-2026-10.md`). Ask the owner to export it |
| 2 | Confirm closing time | Google says 23:00, we use 23:30 |
| 3 | Real prep time per product | The scheduling promise is only as good as these |
| 4 | Real slot capacity | What the kitchen can actually cook per 15 minutes |
| 5 | ~~Real contact details and address~~ | Done — checked against Google Maps and Instagram |
| 6 | Bank transfer details | Checked character by character |
| 7 | Food photography | Current images are illustrations |
| 8 | Staff list and roles | So real accounts replace the demo ones |
| 9 | A domain | Canonical URLs and the Google Business Profile |

Every one is editable from the admin panel. No business logic hardcodes a
Pizza House value.

**One environment blocker**, outside the repository (and one that cleared):

- ~~**GitHub Actions cannot schedule a runner.**~~ **Cleared.** For the first 55
  runs, jobs completed in ~5 seconds with `runner_id: 0` and no logs — an
  account-level block. It was lifted, CI runs on every pull request, and the
  working branch is green on all four jobs. If the symptom ever returns, it is
  that block again, not the code: `docs/DEPLOYMENT.md`.
- **The build container's network policy denies the deployment host**, so the
  smoke check and Playwright cannot be pointed at the live URL from here.
  `app-production-656a.up.railway.app:443` and `pizza-house66.ai.studio:443`
  both return `connect_rejected` from the egress proxy. Allowing those two
  hosts in the environment's network settings would let `npm run smoke -- <url>`
  and the full Playwright suite run against the deployment, and let the
  ai.studio build be compared screen by screen.

---

## 13. Plans and ideas, in priority order

**1. Per-language URLs (`app/[lang]/…`).** The highest-value remaining
change. Today one route tree serves both languages from a cookie, so neither
can be indexed separately — the single biggest SEO limitation in the build.
Migrating is additive: dictionaries and `pick()` carry over untouched.

**2. WhatsApp order notifications.** The notification records already exist
and drive the tracking page; only delivery is missing. In Yemen, WhatsApp is
the channel customers actually read, and "your order is ready" arriving there
is worth more than any other feature on this list.

**3. Printable kitchen tickets**, if the restaurant has a receipt printer.

**4. Shared-store rate limiting.** Counters are per-process today, so across
N instances the effective limit is N times the configured one. Fine for a
single-location pilot; move to Redis or the host's edge limiting before
scaling out. One file changes.

**5. Object storage for receipts.** `bytea` is right at a few hundred a
month. Past that, move the bytes and keep the row as metadata — the serving
route is the only code that changes.

**6. Dependency scanning in CI.** `npm audit` is manual today.

**Deliberately not built** (`docs/PRD.md` §5.2, §89): delivery, customer
accounts, loyalty, reviews, and multi-tenancy. The schema avoids blocking
any of them — every restaurant-specific value is data, the option system is
generic, currency and timezone are rows. Adding `restaurantId` later is a
schema change and a query filter, not a redesign.

---

## 14. Document map

**Start here**

| Document | What it answers |
|---|---|
| `PROJECT-HANDBOOK.md` | This file — everything, summarised |
| `README.md` | Quick start and scripts |
| `docs/PROJECT-STATUS.md` | What is done, what is not, in one table |
| `docs/HANDOVER.md` | Everything the owner must do to go live |

**The domain**

| Document | What it answers |
|---|---|
| `docs/ARCHITECTURE.md` | Module layout and the request flow that matters |
| `docs/DECISIONS.md` | Thirteen architectural choices and what each costs |
| `docs/ORDER-STATE-MACHINE.md` | The order lifecycle, transition by transition |
| `docs/PAYMENT-FLOW.md` | Cash, bank transfer, receipts, verification |
| `docs/ROLES-PERMISSIONS.md` | The permission matrix and how it is enforced |
| `docs/DATABASE.md` | The data model and why it is shaped that way |
| `docs/API.md` | Every HTTP endpoint and its error codes |

**The build**

| Document | What it answers |
|---|---|
| `docs/DESIGN-SYSTEM.md` | Tokens, components, the RTL and contrast rules |
| `docs/LOCALIZATION.md` | The bilingual system and the bidi rules |
| `docs/SEO.md` | What is implemented and the one real limitation |
| `docs/ANALYTICS.md` | The first-party funnel |
| `docs/SECURITY.md` | The threat model, control by control |
| `docs/TESTING.md` | The four suites and the gaps |
| `docs/QA-CHECKLIST.md` | The manual pass before any release |
| `docs/ENVIRONMENT.md` | Every variable |
| `docs/DEPLOYMENT.md` | Railway, Vercel, containers, rollback |

**Source material**

| Document | What it answers |
|---|---|
| `docs/PROJECT_ORIGIN.md` | The original vision document |
| `docs/PRD.md` | The full product requirements |
| `docs/RESTAURANT_DISCOVERY.md` | What was and was not verifiable |
| `docs/ASSUMPTIONS.md` | Every placeholder awaiting confirmation |
| `docs/ROADMAP.md` | Phase-by-phase status |

---

Built by **Novixa**. Licensed to Pizza House.
