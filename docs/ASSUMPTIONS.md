# Assumptions Requiring Owner Confirmation

Everything here is used only to make the MVP demoable. None of it is
verified against the real restaurant. See `docs/RESTAURANT_DISCOVERY.md`
for what *was* verifiable.

| Area | Assumption used in this build | Where | Must be confirmed before production |
|---|---|---|---|
| Menu & prices | Illustrative pizza/drinks/desserts menu, YER prices | `prisma/seed.ts` | Yes — real menu and prices |
| Business hours | 16:00–00:00 daily | `prisma/seed.ts` | Yes — real hours, including any weekly closures |
| Preparation time | 20 min for pizza, 2–5 min for drinks/desserts | `prisma/seed.ts` | Yes — real kitchen timing |
| Payment methods | Pay-at-pickup + bank transfer enabled; electronic disabled | `prisma/seed.ts` | Yes — which methods the restaurant can actually support, and bank transfer instructions/account details |
| Contact info | Phone/WhatsApp/address placeholders | `prisma/seed.ts` | Yes — real numbers and address |
| Timezone | Server clock assumed to already be in the restaurant's local time (Asia/Aden, UTC+3, no DST) | `src/lib/scheduling.ts` | Confirm the production server/container timezone is set correctly, or add explicit timezone handling if the platform's clock can't be pinned |
| Existing POS/ordering process | None assumed to exist; this platform is treated as additive | — | Confirm whether an existing system needs to be run alongside or integrated |
| Slot capacity | 10 orders per 15-minute window | `prisma/seed.ts` (`Restaurant.slotCapacity`/`slotIntervalMinutes`) | Yes — real kitchen throughput |
| Staff roles/headcount | Two demo accounts (OWNER, KITCHEN) | `prisma/seed.ts` | Confirm actual staff who'd use admin vs. kitchen views |

Nothing above blocks development of the platform itself — the data model,
ordering flow, and staff tools work with any real values substituted in.
