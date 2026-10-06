# Testing

Three suites, each answering a different question.

| Suite | Question | Tests | Command |
|---|---|---|---|
| Unit | Are the rules correct? | 88 | `npm test` |
| Integration | Does the database agree? | 24 | `npm run test:integration` |
| End-to-end | Does a person get through it? | 92 | `npm run test:e2e` |

All green, along with `npm run lint`, `npm run typecheck` and `npm run build`.
`npm run verify` chains the first four.

---

## Unit — `tests/unit/` (88)

Everything in `src/lib` is pure and takes the clock as a parameter, which is
exactly what makes the rules that most need to be *right* testable to the
minute with no database and no server.

**`scheduling.test.ts` (26)** — the product's whole reason for existing.
`computeKitchenReleaseAt` against the worked examples in
`docs/PROJECT_ORIGIN.md` §4 and `docs/PRD.md` §13 (order at 16:00, pickup at
19:00, 25 min prep → release at 18:35). Business hours including overnight
closing times and dated overrides. `validatePickupTime` across all six reason
codes. Slot generation and snapping, including the quarter-hour boundaries
where an off-by-one would quietly move every slot.

**`time.test.ts` (19)** — the timezone layer, and the digit-rendering rule:
Arabic dates and times must use Western-Arabic digits, because `formatMoney`
does and two digit systems in one order row is what shipped before anyone
checked. Wall-clock ↔ instant
conversion, `Intl` offset lookup, start-of-day in a zone, `HH:mm`
parse/format round-trips, and a DST boundary in a zone that has one (Asia/Aden
does not, which is precisely why the test uses one that does — a layer that
only works where there is no DST is a layer with a latent bug).

**`pricing.test.ts` (21)** — line pricing with option deltas, subtotals, and
`evaluatePromotion` across every rejection path (inactive, not started,
expired, usage exhausted, below minimum, no eligible items) plus the maximum
cap and product scoping. `computeTotals` is checked to never return a
negative total, whatever the promotion says.

**`permissions.test.ts` (17)** — the matrix in `docs/ROLES-PERMISSIONS.md`,
asserted rather than described: every role against every permission, plus the
refund rule that no cashier can walk `REFUNDED`.

**`order-state.test.ts` (5)** — legal transitions, illegal ones (skipping a
state, mutating a terminal state), and role-gated ones.

---

## Integration — `tests/integration/` (24)

Runs against a **real PostgreSQL database**, because the properties under
test are ones only a database can violate: uniqueness, transaction
boundaries, and what happens when two writes race.

`tests/integration/orders.test.ts` covers:

- **Server-authoritative pricing** — a request carrying a price gets the
  server's total, not its own. Option deltas, quantities, promotions and
  minimum-order rules all recomputed from the database.
- **Availability** — a `SOLD_OUT` or `HIDDEN` product is refused; an option
  value that does not belong to the product is refused.
- **Idempotency** — the same key twice returns one order, not two.
- **Scheduling** — `kitchenReleaseAt` is pickup minus prep time; ASAP rolls
  forward to the first slot with capacity; an off-boundary or past pickup
  time is refused with a reason.
- **Kitchen release** — a scheduled order stays `CONFIRMED` and invisible to
  the kitchen before its release time, moves to `QUEUED` with a history row
  once it passes, and running the job twice produces exactly one history row.
  This is the product's central promise, asserted against a real database.
- **Capacity** — a full slot is rejected with a suggestion, and the check is
  inside the creation transaction, so concurrent orders cannot both take the
  last place.
- **Tracking tokens** — an order is reachable by its token and not by its
  reference.

Needs `DATABASE_URL` in `.env`; `vitest.config.mts` loads it before Prisma is
constructed. `fileParallelism` is off — the suite shares one restaurant's
data and its slot capacity, so parallel files would fight over it.

---

## End-to-end — `tests/e2e/` (92)

Playwright, against a **real production build** with a real database. 46 test
definitions run in two projects: `mobile-ar` (Pixel 7, `ar-YE`, RTL) and
`desktop-en` (Desktop Chrome, `en-GB`, LTR). Arabic on a phone is the primary
way this restaurant's customers will actually use the site, so it is the
default project rather than a variant.

Timezone is pinned to `Asia/Aden` in both, so a run in a UTC CI container
exercises the same wall-clock arithmetic a customer in Al Mukalla does.

**`customer-ordering.spec.ts` (8)** — home → menu → product with options →
cart → checkout → order placed → tracking page, in both languages; the
language switch; ASAP and scheduled pickup; a promo code applied at checkout.

**`staff-and-security.spec.ts` (16)** — sign-in for each role and where each
lands; the permission boundaries; the kitchen board's three lanes and its
transitions; the anonymous-access refusals; the cron endpoint's 401; the
client-submitted-price rejection; the hardening headers.

**`accessibility.spec.ts` (22)** — axe-core against WCAG 2.1 A and AA on
seven pages in light mode and four in dark; the specific commitments in
`docs/DESIGN-SYSTEM.md` (`lang` and `dir` agree, every checkout field is
programmatically labelled, focus is never suppressed, one `h1` per page);
and horizontal-overflow assertions at 414px across the customer and staff
screens.

This suite is not decoration — adding it found three real bugs on its first
run: `--gold` failing AA on every light surface, `opacity-85` on the kitchen's
scheduled lane dropping the text inside below AA, and checkout rendering
555px of content in a 414px viewport, which pushed the pickup-slot buttons
partly off-screen. A failure names the rule and the offending selector, so it
says what to fix rather than that "accessibility broke".

### Running it

```bash
npm run build          # the suite runs the production build, not `next dev`
npm run db:seed        # it signs in as the seeded accounts
npm run test:e2e
```

`globalSetup` clears orders from previous runs first — otherwise slot capacity
accumulates across runs and the suite starts failing for a reason that has
nothing to do with the code.

`reuseExistingServer: false` is deliberate and was paid for: a server left
running from before the last build serves a stale asset manifest, the page
renders unstyled, and every test fails with "element intercepts pointer
events" — an error that points nowhere near the actual cause.

**Environment overrides**

| Variable | Use |
|---|---|
| `PLAYWRIGHT_BASE_URL` | Run against an already-running or deployed server instead of starting one |
| `PLAYWRIGHT_PORT` | Change the port the suite starts on (default 3111) |
| `PLAYWRIGHT_CHROMIUM_PATH` | Point at an installed Chromium when the downloaded build does not match |
| `STAFF_PASSWORD` | Sign-in password, if the seed used a non-default one |

---

## Never assert on seed data you can change

Eight end-to-end tests broke in one afternoon when the catalogue was replaced
with the restaurant's real menu. Not one of them was testing anything that
broke — the product worked throughout. They were coupled to the seed:

- Five reached the product page by clicking a link matching
  `/margherita|مارغريتا/`. The real catalogue spells it **مارجريتا**, with a
  ج. The Arabic-language project timed out on every one of them.
- One searched for "pepperoni" and asserted on **بيبروني** against a menu
  that says **ببروني**.
- One asserted that a cheesecake link was filtered out. Cheesecake had left
  the menu entirely, so the assertion passed without testing the filter.
- One relied on tiramisu being seeded `SOLD_OUT` to exercise that state.
  Tiramisu left too, nothing else was sold out, and the test kept passing
  because it only looked for the first match of a selector — it asserted
  against a menu where its subject did not exist.

The last two are the dangerous ones: they did not fail. They quietly stopped
testing anything, which is worse than a red build, because a red build gets
fixed.

Three rules came out of it:

1. **Navigate and assert by slug**, never by a rendered name. A slug is the
   stable identifier and it is the same in both languages. Display names are
   content, and content is the thing most likely to change.
2. **A test that needs a state should create it**, not hope the seed still
   provides it. The sold-out test now marks a product `SOLD_OUT`, asserts,
   and restores it in a `finally`.
3. **Assert that something is there, not only that something is absent.** An
   absence assertion against data that no longer exists is a test that cannot
   fail.

Every product card carries `data-testid="product-card-<slug>"` so a test can
name the product it means rather than taking the first match.

---

## A count read once is a count that can be wrong

The sold-out test used to read how many cards the menu had for a product and
then assert on each index in turn. That passes while the number is stable and
fails on an index that no longer exists when it is not — and the failure
reads exactly like a product bug while being a fault in the test.

The same check, written so Playwright can retry it:

```ts
const cards = page.locator('[data-testid="product-card-veggie"]');
await expect(cards).not.toHaveCount(0);
await expect(cards.filter({ hasNotText: /sold out|غير متوفر/i })).toHaveCount(0);
```

"No card is missing the marker" is the same guarantee as "every card has the
marker", with no index arithmetic and no single instant to be wrong about.
Reach for `toHaveCount` on a filtered locator before reaching for `count()`
and a loop.

The related trap is asserting on state that an effect writes. `await
expect(page).toHaveURL(/\/order\//)` resolves as soon as the URL matches,
which is before the tracking page has hydrated and written the order into
`localStorage` — so a test that navigates away next finds nothing remembered.
Wait for the state itself, not for the page that produces it:

```ts
await page.waitForFunction(() => {
  try {
    const raw = window.localStorage.getItem("ph66.orders.v1");
    return raw !== null && (JSON.parse(raw) as unknown[]).length > 0;
  } catch {
    return false;
  }
});
```

---

## What is not covered

Stated rather than implied:

- **Accessibility is automated but not exhaustive.** axe-core catches roughly
  a third to a half of WCAG issues; it cannot judge whether alt text is
  *meaningful*, whether a reading order makes sense, or whether an
  interaction works with a real screen reader. The manual pass in
  `docs/QA-CHECKLIST.md` still matters.
- **No visual regression testing.** A CSS change that breaks a layout is
  caught by a human or not at all.
- **No load testing.** Slot capacity is tested for correctness under
  concurrency, not for throughput under load.
- **No mutation testing**, so the suites' own thoroughness is unmeasured.
- **No dependency scanning in CI.** `npm audit` is a manual step.

---

## Continuous integration

`.github/workflows/ci.yml` runs on every push and pull request, in three
parallel jobs:

| Job | What it runs | Needs a database |
|---|---|---|
| `static` | `typecheck` → `lint` → unit tests | No |
| `integration` | `migrate deploy` → `db:seed` → integration tests | Postgres 16 service |
| `e2e` | `build` → Playwright, both projects | Postgres 16 service |

`static` is separate and databaseless on purpose: a type error should fail in
under a minute rather than waiting on a Postgres container to become healthy.
The two database jobs use a service container with a `pg_isready` health
check — without it the first Prisma call races the container's startup and
fails on a refused connection.

A failing E2E run uploads its Playwright report and traces as an artifact,
since a screenshot of the actual failure beats reading a log.

The environment variables in the workflow are test-only values on an
ephemeral runner. No real secret is needed to run CI, and none is referenced.

### Two things pass locally and fail on a fresh checkout

The first time Actions actually ran, `static` and `production-build` both
failed on code that had been green locally for weeks. Neither was a code
fault; both were the same mistake in different clothes — **a check that only
passed because an earlier command had left a file behind.**

**`PageProps` and `LayoutProps` are generated, not imported.** Next 16 writes
them into `.next/types` during `next dev`, `next build` or `next typegen`.
Every developer machine has run one of those, so `tsc --noEmit` finds them;
a clean CI checkout has no `.next` and reports 12 `Cannot find name
'PageProps'` errors. So `npm run typecheck` is `next typegen && tsc
--noEmit` — it generates what it needs rather than inheriting it. Run it
after `rm -rf .next` if you ever want to see the difference.

**`next build` type-checks whatever its tsconfig selects — including tests.**
`tsconfig.json` deliberately covers `tests/**`, which is right for the editor
and for `npm run typecheck`. It is wrong for the production build, where
`vitest` and `@playwright/test` are not installed: the build failed on the
test files, not on anything it ships. Hence `tsconfig.build.json`, named by
`typescript.tsconfigPath` in `next.config.ts`. It relaxes nothing — same
strict options, fewer files.

A consequence worth knowing: anything `next build` resolves is a real
dependency, type packages included. `typescript`, `@types/node`,
`@types/react` and `@types/react-dom` sit in `dependencies` for that reason,
exactly as `@tailwindcss/postcss` does.

To reproduce either job before pushing:

```bash
rm -rf .next && npm run typecheck      # the static job's first step
npm ci --omit=dev && npm run build     # the production-build job
```

The second command removes your devDependencies — `npm ci` afterwards puts
them back. Running it in a scratch copy of the repository is less disruptive.

---

## When adding a feature

1. If it has a rule, put the rule in `src/lib` and unit-test it there.
2. If it writes to the database, add an integration test for what the
   database could violate — uniqueness, a transaction boundary, a race.
3. If a customer or staff member will do it, add one E2E test for the path
   they take, not for every branch.

Three suites exist so each can stay fast. Pushing a rule down into the unit
layer is almost always the right move: 84 unit tests run in about a second.
