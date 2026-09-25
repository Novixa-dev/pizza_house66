# QA Checklist

The manual pass before any release. The automated suites
(`docs/TESTING.md`) cover the rules; this covers the things a person notices
and a test does not.

Run it in **Arabic on a phone-width viewport first** — that is how most
customers will use this — then spot-check English on a desktop.

---

## Customer: ordering

- [ ] Home page loads; hours, address and phone are correct and clickable
- [ ] "Open now" / "Closed" matches the real clock in Al Mukalla
- [ ] Menu loads; category filter and search both work
- [ ] A sold-out product shows as unavailable and cannot be added
- [ ] A product with options shows them; required groups block until answered
- [ ] The price updates as options are selected
- [ ] Add to cart; the header count increments
- [ ] Reload the page — the cart survives
- [ ] Change a quantity and remove a line; totals follow
- [ ] Checkout: name and phone are validated, with a usable error message
- [ ] **ASAP** pickup shows a realistic time
- [ ] **Scheduled** pickup offers only slots that are open and have room
- [ ] A promo code applies and shows the discount; a bad code says why
- [ ] Each enabled payment method is offered; bank transfer shows the
      restaurant's real instructions
- [ ] Upload a receipt image at checkout; a non-image file is refused
- [ ] Submit — the order confirmation shows a reference and a pickup time
- [ ] **Double-click submit** — exactly one order is created
- [ ] The tracking page loads from the confirmation link
- [ ] The tracking timeline shows the right stage and updates on its own
- [ ] Attach a receipt from the tracking page after ordering

## Customer: edge cases

- [ ] Ordering while paused shows the restaurant's pause message
- [ ] Ordering while closed explains when the restaurant opens
- [ ] A scheduled slot that is full is refused **with a suggested alternative**
- [ ] An ASAP order when the nearest slot is full **rolls forward silently** —
      it must not say "pick another time" to someone who picked nothing
- [ ] An order below the minimum says what the minimum is
- [ ] A tracking URL with a wrong token shows not-found, not an error page

## Language and direction

- [ ] The language switch works from every page and keeps you on that page
- [ ] Arabic is RTL throughout; nothing is mirrored that should not be
- [ ] A back arrow points the correct way in each direction
- [ ] **Prices and times read correctly in Arabic** — no `يبدأ من2,200`,
      no reordered `16:00 – 00:00`
- [ ] Both languages are complete; no raw keys, no English leaking into
      Arabic
- [ ] Dates and times are in the restaurant's timezone, not the reader's

## Staff

- [ ] Sign in as **owner** → dashboard; every nav item present
- [ ] Sign in as **manager** → no staff accounts, no audit log
- [ ] Sign in as **cashier** → payments yes, settings no
- [ ] Sign in as **kitchen** → lands on `/kitchen`, not `/admin`
- [ ] A wrong password says only that the credentials are wrong
- [ ] Repeated wrong passwords are throttled, and a correct one still works
      afterwards from a different account
- [ ] Typing an admin URL directly while signed out redirects to login, and
      back to that URL after signing in
- [ ] Dashboard figures match the orders list
- [ ] Orders list filters by status and date
- [ ] Order detail shows items, options, payment, history
- [ ] Every status transition offered actually works
- [ ] Payment verify → order confirmed; reject → order rejected, slot freed
- [ ] The receipt image opens, and the view appears in the audit log
- [ ] Create, edit and delete a product, a category, an option group
- [ ] Create a promotion and confirm it applies at checkout
- [ ] Edit hours; add a dated override; confirm the customer site respects both
- [ ] Pause ordering → the customer site stops taking orders → resume
- [ ] Create a staff account, sign in as it, deactivate it, confirm it cannot
      sign in
- [ ] Reports load and the numbers are plausible
- [ ] The audit log shows everything just done, with the right actor

## Kitchen

- [ ] The board shows three lanes
- [ ] A newly confirmed **scheduled** order is **not** on the board yet
- [ ] It appears on its own at `kitchenReleaseAt`, with nobody loading a page
- [ ] Queued → Preparing → Ready → Completed all work in one tap
- [ ] The board refreshes without a manual reload
- [ ] Targets are comfortable to hit with a thumb
- [ ] Two devices tapping the same order: one wins, the other gets a clear
      message rather than a silent overwrite

## The scheduling promise

This is the product. Test it deliberately:

- [ ] Place an order for pickup ~1 hour out
- [ ] In the admin panel, confirm `kitchenReleaseAt` = pickup − prep time
- [ ] Confirm it is **not** on the kitchen board
- [ ] Wait for the release time (or shift the pickup time) and confirm it
      appears **without anyone loading a page**
- [ ] Confirm the customer's tracking page reflects each stage

## Accessibility

- [ ] Tab through checkout — every control is reachable, focus is visible
- [ ] Every form field has a label; errors are announced, not just coloured
- [ ] Headings are in order, one `h1` per page
- [ ] Zoom to 200% — nothing is clipped or overlapping
- [ ] Turn on reduced motion — nothing animates
- [ ] Images have meaningful alt text

## Performance and resilience

- [ ] Home, menu and product pages feel fast on a throttled connection
- [ ] No layout shift as images load
- [ ] Stop the database and load a page — an error page, not a stack trace
- [ ] Trigger an error and confirm the reference digest is shown
- [ ] `/robots.txt` and `/sitemap.xml` are correct and list the real domain
- [ ] A product URL previews correctly when shared on WhatsApp

## Security spot-checks

Automated (`docs/SECURITY.md`), but worth eyeballing on the real deployment:

- [ ] `/admin` and `/kitchen` while signed out → redirect
- [ ] `/api/receipts/<any id>` while signed out → 401
- [ ] `/api/cron/release-orders` without the bearer token → 401
- [ ] Response headers carry the CSP and the hardening set
- [ ] The site is served over HTTPS and the session cookie is `Secure`

---

## Before announcing to customers

- [ ] No `@pizzahouse.local` account still exists
- [ ] No demo product, category or promotion remains
- [ ] Every price is the real price
- [ ] Bank transfer details are correct — **check them character by
      character with the owner**
- [ ] Phone and WhatsApp numbers connect to the restaurant
- [ ] Database backups are on **and a restore has been tested**
- [ ] `NEXT_PUBLIC_APP_URL` is the real domain
- [ ] A real order has been placed, cooked and collected end to end
