# Restaurant Discovery — Pizza House 66 (Al Mukalla, Yemen)

Status: **substantially verified, with two open items.** The first version of
this file was written when Instagram and the web were unreachable, and said
almost nothing was known. That is no longer true. The full account — sources,
what each one could and could not give, and what changed — is in
[`FIELD-RESEARCH-2026-10.md`](FIELD-RESEARCH-2026-10.md). This file keeps the
summary.

## Verified (the restaurant's own Google Maps listing and Instagram)

- Name **بيتزا هاوس / Pizza House 66**, a pizza restaurant, rated 4.3 on
  Google Maps.
- Address: حي المساكن، فوة، المكلا. Coordinates **14.4891696, 49.0444845**,
  Plus Code `F2QV+MQ`.
- Phone `05375561` and WhatsApp `772207788` — both in the Instagram bio, which
  labels them "for orders and reservations".
- Instagram `@pizza_house66`: about 67,000 followers, 117 posts.
- Two daily sessions, morning and evening, with Friday evening only.
- It has publicly stated that this is its **first and only branch** and that
  it is unconnected to any other business using the name.

## Open

1. **The menu.** The 16 items on the site came from an early prototype. The
   restaurant's own listing on a delivery app shows roughly 184 items,
   including about 41 pizzas with local flavours and a "House" size tier,
   about 40 drinks and 12 add-ons — and the prices differ from ours in both
   directions. The owner has to supply the real menu.
2. **Closing time.** Google Maps says 11 PM; the prototype and this site say
   11:30 PM. Only the current day's row was readable on Maps, so Friday could
   not be confirmed either.

## Not reachable from here

Instagram and the prototype site are blocked from the build environment by
network policy, and the scraping service does not support Instagram. What is
quoted above from Instagram comes from search-result titles and descriptions,
not from a visit to the profile.

## What this means for the build

The product does not depend on any of this being right — only the content
does, and all of it is data an owner can change from the admin panel. The one
change that is a developer's job is getting ~184 menu items in without
entering them by hand: a CSV importer, listed first in
`FIELD-RESEARCH-2026-10.md` §6.
