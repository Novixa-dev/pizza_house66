# Testing

Three suites, each answering a different question.

| Suite | Question | Tests | Command |
|---|---|---|---|
| Unit | Are the rules correct? | 259 | `npm test` |
| Integration | Does the database agree? | 71 | `npm run test:integration` |
| End-to-end | Does a person get through it? | 190 (95 × two projects) | `npm run test:e2e` |

All green — 189 of the 190 end-to-end runs pass and one is skipped by design
(a phone-only test, on the desktop project) — along with `npm run lint`,
`npm run typecheck` and `npm run build`. `npm run verify` chains the first
four. The counts are read from the runs, not carried over; if you add a test,
re-read them rather than adding one.

---

## Unit — `tests/unit/` (259)

Everything in `src/lib` is pure and takes the clock as a parameter, which is
exactly what makes the rules that most need to be *right* testable to the
minute with no database and no server.

**`scheduling.test.ts` (35)** — the product's whole reason for existing.
`computeKitchenReleaseAt` against the worked examples in
`docs/PROJECT_ORIGIN.md` §4 and `docs/PRD.md` §13 (order at 16:00, pickup at
19:00, 25 min prep → release at 18:35). Business hours including overnight
closing times and dated overrides. `validatePickupTime` across all six reason
codes. Slot generation and snapping, including the quarter-hour boundaries
where an off-by-one would quietly move every slot.

**`time.test.ts` (27)** — the timezone layer, and the digit-rendering rule:
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

**`menu-import.test.ts` (56)** — the CSV menu importer's parsing and planning,
with no database in them. What it protects against is *an import that
succeeds while writing something wrong*: a decimal comma read as a thousands
separator (45,5 → 455), a Windows-1256 file read as UTF-8 (every Arabic letter
a `�`), a blank cell clearing a value, a price change slipping in unlisted.
The first 44 were themselves checked by breaking two guards on purpose and
watching them fail. `docs/MENU-IMPORT.md`.

**`search.test.ts` (23)** — what makes two Arabic spellings the same for
search: every alef, ة and ه, ى and ي, vowel marks and tatweel, Arabic-Indic and
Persian digits, presentation forms from copied text — and what must *not* be
merged (ج and غ), idempotence, and the token matching built on top (every word,
any order, no word spanning two fields, absent fields never searched as the
word "null"). Checked by breaking fifteen rules one at a time; each break
failed a test. `src/lib/search.ts` serves both the customer menu and the
staff product list.

**`plus-code.test.ts` (5)** — the Plus Code encoder against the
specification's own test vectors (a code a few metres off still looks right,
so these are exact strings), the restaurant's pin (`F2QV+MQ`), the map's
edges, and the alphabet. **`photo-hosts.test.ts` (4)** — the allowlist for
photographs the server fetches to draw a share card: the two hosts, look-alike
hosts, plain http, private addresses, credentials in the URL.

**`funnel.test.ts` (13)** — the conversion funnel's fold: monotonic for any
input, counts a session once however often it repeats a step, tolerates lost
beacons.

**`hours-display.test.ts` (10)** — how opening hours read to a customer and to
a search engine: both services of a day, identical days grouped, a midnight
close written as 23:59 for schema.org.

**`loyalty.test.ts` (10)**, **`order-memory.test.ts` (10)**,
**`duration.test.ts` (9)**, **`site.test.ts` (11)**, **`photo-credits.test.ts`
(3)** — the fifth-order reward and unambiguous coupon codes; the browser's
remembered-orders list (garbage in, expiry, de-duplication, cap); "in 25
minutes / 2 hours / 3 days" with Arabic's plural forms; the canonical URL
fallbacks and WhatsApp/tel links; and the shape of a Wikimedia file URL that
the credits page reads its file name from.

---

## Integration — `tests/integration/` (71)

Runs against a **real PostgreSQL database**, because the properties under
test are ones only a database can violate: uniqueness, transaction
boundaries, and what happens when two writes race.

`tests/integration/orders.test.ts` (28) covers:

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

The other five files, each there because a database is the only thing that
can break the property:

- **`coupons.test.ts` (14)** — a once-per-customer code holds per customer and
  not globally; a cancelled order does not count against the cap; the loyalty
  template's own code is refused whoever asks; a coupon is issued on the fifth
  *collected* order and no sooner, works only for its owner, cannot be spent
  twice, and expires.
- **`order-lookup.test.ts` (17)** — finding an order again by reference and
  phone, however the phone was typed, with the same answer for a reference
  that does not exist; summaries per remembered token; and "order it again"
  priced from the product as it is today, naming a withdrawn item instead of
  dropping it.
- **`reports.test.ts` (7)** — the report aggregation done in Postgres:
  `count(*)` coming back as a number, not a `BigInt`; peak hours bucketed in
  the restaurant's timezone (a 22:30 UTC order lands in hour 1 in Al Mukalla);
  the payment queue's cap and its "N more waiting" arithmetic.
- **`photo-credits.test.ts` (3)** — every Wikimedia photograph actually on the
  menu has a credit entry, and a second test that it found something to check
  so the first cannot pass by looking at nothing.
- **`restaurant-identity.test.ts` (2)** — the map link is the restaurant's own
  listing, not a text search, and the coordinates fall in Al Mukalla.

Needs `DATABASE_URL` in `.env`; `vitest.config.mts` loads it before Prisma is
constructed. `fileParallelism` is off — the suite shares one restaurant's
data and its slot capacity, so parallel files would fight over it.

---

## End-to-end — `tests/e2e/` (190)

Playwright, against a **real production build** with a real database. 95 test
definitions run in two projects: `mobile-ar` (Pixel 7, `ar-YE`, RTL) and
`desktop-en` (Desktop Chrome, `en-GB`, LTR). Arabic on a phone is the primary
way this restaurant's customers will actually use the site, so it is the
default project rather than a variant.

Timezone is pinned to `Asia/Aden` in both, so a run in a UTC CI container
exercises the same wall-clock arithmetic a customer in Al Mukalla does.

**`customer-ordering.spec.ts` (12 per project)** — the customer's path, in
both languages: home → menu (categories, search) → a sold-out product that is
visible but not orderable → product customisation updating the running total →
cart → checkout → an ASAP order landing on tracking; search forgiving how
Arabic is typed (ه for ة, words in any order); scheduled pickup offering only
the slots the server generated; the ASAP option telling the truth about when
the food will be ready; the tracking page not being indexable; the phone order
bar (phone project only — the one skipped run is its desktop twin); and the
returning-customer prompt, which must appear only once this browser has an
order.

**`staff-and-security.spec.ts` (17)** — sign-in for each role and where each
lands; bad credentials not saying which field was wrong, and the rate limit;
the permission boundaries (kitchen, cashier, the nav hiding what a role cannot
use); the anonymous-access refusals (admin pages, the kitchen, a receipt, the
cron endpoint's 401); a client-submitted price ignored in favour of the
server's; malformed and unknown-product orders refused; cancelling an order
asking first; the kitchen board's three lanes; the hardening headers.

**`admin-products.spec.ts` (6)** — the product list at the restaurant's real
size: search narrows it and finds a product however its Arabic was typed, a
search with no match offers a way back, the availability counts add up to the
whole menu, searching from inside a filter keeps the filter, and the active
filter is marked with `aria-current`.

**`brand-and-seo.spec.ts` (8)** — what a link preview, a search engine and a
home-screen install receive: the site card and the Twitter card are real
1200×630 PNGs; a product link carries *its own* card, and a hidden or unknown
one gets the site card rather than an error; nine pages share the card (every
page built with `buildMetadata` once lost it); the tab icon and the 180px iOS
icon are PNGs; the manifest's icons resolve at the sizes it claims; the sitemap
lists the public pages and none of the private ones.

**`contact-and-install.spec.ts` (7)** — directions go to the pin, not a name
search; the Plus Code is the one computed from those coordinates; copy puts it
on the real clipboard and says so; share falls back to copying where there is
no share sheet; the install button is absent where the browser cannot install,
appears on `beforeinstallprompt` and raises the dialog, shows the two taps on
iPhone Safari, and stays away on Chrome for iOS.

**`restaurant-info.spec.ts` (4)** — who and where: the "only branch" notice
on `/contact` and `/about`, the orders-and-reservations line, and the
structured data carrying the restaurant's real coordinates.

**`accessibility.spec.ts` (41)** — axe-core against WCAG 2.1 A and AA on the
customer pages, checkout, the dashboard, the product list (bare and with a
filter applied) and the kitchen, with the main pages repeated in dark mode;
the specific commitments in `docs/DESIGN-SYSTEM.md` (`lang` and `dir` agree,
every checkout field is programmatically labelled, a visible focus ring on
every keyboard stop, one `h1` per page); horizontal-overflow assertions at
414px across the customer and staff screens; and WCAG 2.2's 24px minimum
target size on the customer pages.

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

`.github/workflows/ci.yml` runs on every pull request, and on pushes to
`main`, in four parallel jobs:

| Job | What it runs | Needs a database |
|---|---|---|
| `static` | `typecheck` → `lint` → unit tests | No |
| `production-build` | `npm ci --omit=dev` → `build` — the way a host with `NODE_ENV=production` builds | No |
| `integration` | `migrate deploy` → `db:seed` → integration tests | Postgres 16 service |
| `e2e` | `build` → Playwright, both projects | Postgres 16 service |

Each job is guarded so a branch with an open pull request is built once, by
the `pull_request` event, not twice. The consequence is that the `push` run
for such a branch appears in the Actions list as **skipped**. That is the
guard working, not a failure; the run to read is the one titled after the pull
request.

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

### A locator that matches twice, for a few milliseconds

Found while writing the admin product-list tests: one test failed on about one
run in five with `strict mode violation: … resolved to 2 elements`, and passed
when run alone. Nothing was wrong with the page.

Staff pages stream in behind `src/app/admin/(staff)/loading.tsx`. Next sends
the shell with the skeleton first, then writes the finished page into a hidden
staging `<div id="S:0" hidden>` at the end of `<body>`, and a script moves it
into place. For a few milliseconds after `load`, the staging copy and the live
copy are both in the document. An assertion that lands in that window, using
an unscoped `a[href="…"]` or `input[name="q"]`, sees two matches and Playwright
refuses to pick one.

It was caught by sampling the DOM immediately after `goto` over 60
navigations: 3 had two matches — one 172×30 inside `main`, the other 0×0
inside `div#S:0[hidden]`. Both had the same text, class and `href`.

What fixes it, and what does not:

- **Scope to `main`** (`main a[href="…"]`). The staging copy is a child of
  `body`, so a locator rooted in `main` cannot see it.
- **Use role-based locators** (`getByRole("searchbox")`, `getByRole("link", …)`).
  They exclude hidden elements by default.
- **Not `.first()`.** It makes the failure go away by ceasing to say which of
  two elements the test means.
- **Not `retries`.** It turns a 5% failure into a green tick and a slower run;
  CI already retries once, so this would have gone unseen until it failed twice.

`locator.count()` is exposed to the same thing — an unscoped count can read
double — and `toHaveCount(n)` is not, since it retries until the page settles.
After the fix the spec ran 140 times (14 repeats × 10 tests) without a failure:
`npx playwright test tests/e2e/admin-products.spec.ts --repeat-each=14`.

---

## When adding a feature

1. If it has a rule, put the rule in `src/lib` and unit-test it there.
2. If it writes to the database, add an integration test for what the
   database could violate — uniqueness, a transaction boundary, a race.
3. If a customer or staff member will do it, add one E2E test for the path
   they take, not for every branch.

Three suites exist so each can stay fast. Pushing a rule down into the unit
layer is almost always the right move: all 259 unit tests run in a few
seconds, with no database and no server.
