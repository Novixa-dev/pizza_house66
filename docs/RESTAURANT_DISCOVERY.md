# Restaurant Discovery — Pizza House (Al Mukalla, Yemen)

Status: **partial**. Direct access to Instagram (`instagram.com`) and several
third-party listing sites was blocked by the build environment's network
policy, so this discovery pass relied on web search snippets rather than a
full visit to the profile. Everything below is labeled by confidence.

## Verified

- The restaurant is real and operates as **Pizza House** / **بيتزا هاوس**.
- Instagram: [`@pizza_house66`](https://www.instagram.com/pizza_house66/),
  reported at roughly 64K followers, Arabic display name "بيتزا هاوس", bio
  indicates it makes pizza and pastries and lists contact numbers for orders.
- Located in **Al Mukalla, Yemen**, specifically the **Fawah** district,
  matching the PRD's own SEO examples ("Pizza House Mukalla", "بيتزا في
  المكلا").

## Not verified — OWNER INPUT REQUIRED

Everything below is an **ASSUMPTION** used only to make the demo/seed data
realistic. None of it should be treated as fact, quoted to the owner, or
shipped to production without confirmation:

- Exact street address / map location
- Phone number and WhatsApp number
- Opening hours (seed data assumes 16:00–00:00 daily, matching the PRD's
  illustrative example — not a real schedule)
- Full menu, product names, and prices (seed data uses common
  pizza-restaurant offerings, not the restaurant's actual menu)
- Existing payment methods actually accepted (seed enables Pay-at-Pickup and
  Bank Transfer as plausible defaults for the Yemeni market; disables
  Electronic Payment since no local gateway was confirmed)
- Whether an existing POS or ordering process is in use
- Staff roles and how many people would use the admin/kitchen views
- Preparation time per product (seed assumes 20 minutes for pizza, matching
  the PRD's own worked examples)
- Delivery availability (assumed out of scope per PRD — pickup-first)

## What this means for the build

Every seeded price, hour, and contact detail in `prisma/seed.ts` is marked
`ASSUMPTION` in comments. The product itself (data model, ordering flow,
scheduling engine, admin/kitchen tools) does not depend on any of these
being correct — only the demo content does. Swapping in real menu/contact
data is a seed-data and content change, not an architecture change.

## Recommended next step

Before this goes anywhere near production: get the actual menu, prices,
phone/WhatsApp numbers, real opening hours, and confirmed payment methods
directly from the owner, and replace `prisma/seed.ts` (or better, enter them
through the admin product/category/settings screens once built out).
