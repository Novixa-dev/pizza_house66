# Handover

Everything between "the code is finished" and "Pizza House is taking real
orders". Work top to bottom; each section says who does it.

---

## 1. Information to collect from the restaurant

This is the long pole. The platform works with any values; these are the
right ones. `docs/ASSUMPTIONS.md` lists what is currently standing in.

**Identity and contact**
- Name as it should appear, in Arabic and English
- Phone, WhatsApp number, email
- Address in Arabic and English, Google Maps link, latitude/longitude
- Instagram and Facebook URLs
- A one-line tagline and an "about" paragraph, both languages

**Operating rules**
- Opening and closing times for each day of the week
- Any regular closures (a weekly day off, Friday prayer hours)
- Known dated closures for the next few months
- **Average preparation time per product.** The scheduling promise is only
  as good as these numbers — a pizza that really takes 25 minutes and is
  recorded as 15 produces a customer standing at a counter.
- **How many orders the kitchen can genuinely cook per 15 minutes.** This
  becomes `slotCapacity`, and it is the setting that protects the kitchen
  from the platform.
- How far ahead customers may book (default 3 days)
- Minimum order value, if any

**Menu**
- Every category, in order
- Every product: name and description in both languages, price, category,
  prep time
- Every option group per product (Size, Crust, Add-ons): whether it is
  required, whether multiple choices are allowed, and the price delta for
  each value
- Which items are currently unavailable

**Payment**
- Which methods the restaurant can actually support
- For bank transfer: bank name, account number, account holder name — all as
  they should be shown to a customer
- The exact instruction text to show at checkout

**People**
- Who needs an account, and which role each should have
  (`docs/ROLES-PERMISSIONS.md`)

**Photography**
- One image per product. The current illustrations sit at the exact paths
  real photos will replace, so this is a file swap, not a code change.

---

## 2. Infrastructure to provision

| Thing | Who | Notes |
|---|---|---|
| Managed PostgreSQL 16 | Novixa or owner | Any provider. Take the pooled connection string; enable backups **before** launch |
| Domain | Owner | Needed for canonical URLs and the Google Business Profile |
| Hosting account | Owner | A private org-owned repository needs a Vercel Pro team; see `docs/DEPLOYMENT.md` |
| `AUTH_SECRET`, `CRON_SECRET` | Novixa | `openssl rand -hex 32`, different values, never shared between environments |

---

## 3. First deployment

Follow `docs/DEPLOYMENT.md`. In brief:

```bash
# 1. Environment variables set on the host
#    DATABASE_URL, AUTH_SECRET, CRON_SECRET, NEXT_PUBLIC_APP_URL

# 2. Build command
prisma migrate deploy && next build

# 3. Once, against the production database
DATABASE_URL="…" npm run db:seed
DATABASE_URL="…" npm run staff:create -- --email owner@… --name "…" --role OWNER
```

Two safety behaviours worth knowing, because they will look like failures
otherwise:

- **`db:seed` will not create demo staff accounts in production.** With
  `NODE_ENV=production` and no `SEED_STAFF_PASSWORD`, it skips them and tells
  you to use `staff:create`. That is intentional — a known default password
  is how demo credentials end up live.
- **`/api/cron/release-orders` returns 401 with no `CRON_SECRET` set.** It
  fails closed, not open.

---

## 4. Replace the seeded data

Everything below is done **in the admin panel**, by the owner or by Novixa
sitting with them. No developer, no deployment.

- [ ] **Settings** — name, tagline, about, contact, address, map,
      coordinates, socials, currency, timezone
- [ ] **Settings** — prep time, slot interval, slot capacity, booking
      horizon, minimum order
- [ ] **Settings** — bank transfer details and checkout instructions
- [ ] **Settings** — SEO title and description, both languages
- [ ] **Hours** — the real weekly pattern; add known closures as overrides
- [ ] **Payment methods** — enable only what the restaurant supports
- [ ] **Categories** — real categories, in the right order
- [ ] **Products** — delete the demo items; add the real menu with real
      prices, descriptions and prep times
- [ ] **Options** — the real size/crust/add-on groups per product
- [ ] **Promotions** — delete the demo promotions; add real ones or none
- [ ] **Staff** — create real accounts; **delete every `@pizzahouse.local`
      account**
- [ ] **Images** — replace `public/menu/*.svg` with real photographs

The staff step is the one that must not be skipped. Demo accounts with a
published default password are a live admin login.

---

## 5. Verify before announcing

Walk `docs/QA-CHECKLIST.md` end to end against the production URL. The three
that catch the most:

1. **Place a real order** from a phone, in Arabic, and watch it appear in the
   admin panel.
2. **Schedule an order** for an hour out, then confirm it reaches the kitchen
   board on its own, with nobody loading a page. That proves cron auth works,
   and it is the feature the whole product is for.
3. **Sign in as each role** and confirm each sees only what it should.

---

## 6. Train the staff

Short, and worth doing in person.

**Everyone** — how to sign in, and that sessions expire after 8 hours.

**Kitchen** — the board shows orders *when the kitchen should start them*,
not when they were placed. An order that is not on the board yet is not late;
it is scheduled. Tap once per stage; if a tap is refused, someone else already
moved it.

**Cashier** — the payments queue; how to verify a transfer against the bank
app; how to reject with a reason the customer can act on; how to pause
ordering when the kitchen is overwhelmed, and to remember to resume it.

**Owner/manager** — changing prices and availability, adding promotions,
reading the reports, and where the audit log is.

One thing to say out loud to the owner: **`slotCapacity` is the setting that
protects your kitchen.** If Friday evenings are chaos, lower it. Every rule in
this system is editable, and none of it needs a developer.

---

## 7. Operating it

**Daily** — mark sold-out items unavailable as they run out. Pause ordering
if the kitchen falls behind, and resume it.

**Weekly** — check the reports. Busiest slots tell you whether `slotCapacity`
is right; the funnel tells you where customers give up.

**As needed** — add a schedule override before a holiday rather than on the
day. Customers can book three days ahead.

**Monthly** — confirm the database backup actually restores. An untested
backup is a hope.

---

## 8. What Novixa still owes, and what is optional

**Owed, when the information above arrives:** data entry support, the photo
swap, and the production deployment.

**Optional next work**, in the order I would do it:

1. Per-language URLs (`app/[lang]/…`) — makes both languages indexable
2. WhatsApp order notifications — the records exist; only delivery is missing
3. Printable kitchen tickets, if there is a receipt printer
4. `axe-core` in the E2E suite
5. Shared-store rate limiting, before scaling past one instance

Rationale for each is in `docs/PROJECT-STATUS.md`.

---

## Support notes

- **"Login does nothing."** Almost always TLS: session cookies are `Secure`
  when the request arrives over HTTPS. Check the proxy sets
  `x-forwarded-proto` (`docs/DECISIONS.md`).
- **"Orders are not reaching the kitchen."** Check `CRON_SECRET` is set on
  the host and matches the schedule's. Staff loading the kitchen page
  releases due orders as a fallback, which masks the problem — so the symptom
  is usually "late", not "never".
- **"A customer says they cannot order."** Check whether ordering is paused,
  whether the slot is full, and whether an override has closed the day.
- **Any error the customer reports with a reference code.** That digest
  matches a server log line — it is what the code is for.
