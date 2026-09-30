# SEO

`docs/PRD.md` §47 and §51 want Pizza House findable when someone in Al
Mukalla searches for pizza. That is a local-search problem before it is a
technical one, so most of what matters here is structured data and honest
metadata rather than keyword work.

## Implemented

**Metadata, per page and bilingual.** `generateMetadata` in the root layout
sets the title template, description, `metadataBase`, icons, the manifest
link, and Open Graph/Twitter cards — all in the resolved locale, with
`og:locale` and `alternateLocale` set correctly (`ar_YE` / `en_US`). Product
and menu pages narrow it further with their own title, description, canonical
and product image.

**Structured data** (JSON-LD, escaped on output):

| Type | Where | Why |
|---|---|---|
| `Restaurant` | Home | Name, address, `PostalAddress`, geo coordinates, phone, opening hours, price range, cuisine — the local-pack fields |
| `OrderAction` | Home | Declares the site takes orders, pointing at `/menu` |
| `FAQPage` | Home | The questions customers actually ask, eligible for rich results |
| `MenuItem` | Product pages | Name, description, image, `Offer` with price, currency and in-stock state |

Opening hours and address come from the `Restaurant` row, so updating them in
the admin panel updates the structured data. Nothing is hardcoded, which
means nothing drifts.

**`sitemap.xml`** — home, menu, and every non-hidden product, with each
product's real `updatedAt`. Revalidated hourly. It catches its own database
errors and falls back to the static routes: a sitemap listing two URLs is
better than a build that fails because the database blinked.

**`robots.txt`** — allows the public site; disallows `/admin`, `/kitchen`,
`/api/`, `/cart`, `/checkout`, and **`/order/`**. That last one matters most:
those URLs carry a capability token, and an indexed one is a leaked order.

**`opengraph-image.tsx`** — a generated OG image, so a link shared on
WhatsApp (which is how this will actually spread here) previews properly.

**PWA manifest** — installable to a home screen, Arabic-first, with menu and
cart shortcuts. Deliberately *not* an offline app: ordering depends on live
availability and live slot capacity, and an offline mode would only produce
orders the restaurant cannot honour.

**Performance**, which is ranking-relevant: server components by default,
`next/image` with explicit `sizes`, `priority` on the product hero, no
client-side data fetching on first paint, and self-hosted fonts through
`next/font` so there is no render-blocking third-party stylesheet.

## The limitation, stated plainly

**There is no distinct URL per language.** `/menu` serves Arabic or English
depending on the `ph_locale` cookie. A crawler sees one URL and whichever
language the default resolution gives it, so:

- the two languages cannot rank separately,
- `hreflang` cannot be expressed, because there is no alternate URL to point
  at,
- a shared link does not carry the sender's language.

`docs/PRD.md` §47 and §51 want both languages indexed. This build does not
deliver that, and the reason is recorded in `docs/DECISIONS.md` — cookie
locale kept the MVP's routing simple, and the cost was accepted knowingly.

**The fix is additive, not a rewrite.** Moving to `app/[lang]/…` means:

1. Move `src/app/(site)/` under `app/[lang]/`.
2. Read `lang` from params instead of the cookie in `getLocale()`.
3. Emit `alternates.languages` in `generateMetadata`.
4. Add both language variants of each URL to the sitemap.
5. Keep the cookie as a redirect preference on `/`.

The dictionaries, `pick()`, every component and all the structured data carry
over untouched. It is a routing change, and it is the single highest-value SEO
work remaining.

## Not done, and out of scope for the platform

These are the owner's to do, and they will matter more than anything in the
code:

- **Google Business Profile.** For a single-location restaurant this is the
  largest single source of local discovery, and no amount of on-site markup
  substitutes for it.
- **Real photographs.** Current images are illustrations. Google's local pack
  shows photos; illustrations will not compete.
- **A real domain**, set as `NEXT_PUBLIC_APP_URL` so every canonical URL,
  sitemap entry and OG tag points at it.
- **Search Console verification**, and submitting the sitemap.
- **Reviews.** Structured `AggregateRating` needs real ratings; inventing
  them is both against Google's guidelines and against the point.

## Checking it

```bash
npm run build && npm start
curl -s localhost:3000/robots.txt
curl -s localhost:3000/sitemap.xml | head -40
curl -s localhost:3000/ | grep -o 'application/ld+json' | wc -l
```

Then paste the home page into Google's Rich Results Test, and open a product
URL in a WhatsApp chat with yourself to confirm the preview card renders.
