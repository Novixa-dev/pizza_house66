# Testing

## What exists today

**Unit tests** (`npm test` → `vitest run`, `tests/unit/`):

- `scheduling.test.ts` — the scheduled-ordering math that is the whole
  point of this product: `computeKitchenReleaseAt` against the exact
  worked examples from `docs/PROJECT_ORIGIN.md` §4 and `docs/PRD.md` §13
  (order at 16:00, pickup 19:00, 25-min prep → release at 18:35), business
  hours resolution including overnight closing times and schedule
  overrides, and `validatePickupTime`'s reject/accept branches (too soon,
  paused, closed, valid).
- `order-state.test.ts` — the order status state machine: legal
  transitions, illegal transitions (skipping states, mutating a terminal
  state), and role-gated transitions (kitchen staff cannot issue a refund).

**Manual end-to-end verification** performed against a running dev server
with seeded data (see PR description for the transcript): staff login and
session-protected route redirect, guest checkout → server-side price
recalculation → order creation, idempotent duplicate submission returning
the same order, the tracking page rendering by capability token, and the
lazy kitchen-release job promoting a due order from `CONFIRMED` to
`QUEUED` and appearing on the kitchen board.

**Static checks**: `npm run lint` (ESLint incl. React Compiler purity
rules) and `npx tsc --noEmit` both pass; `npm run build` produces a clean
production build.

## What's missing (do not claim otherwise)

Per `docs/PRD.md` §72–75, a complete test strategy also needs:

- **Integration tests** against a real (test) database for order creation,
  payment verification, and concurrent-order/capacity edge cases.
- **Playwright E2E tests** for the full customer journey (home → menu →
  product → cart → checkout → tracking) and the staff journey (login →
  verify payment → kitchen → complete), in both Arabic/RTL and
  English/LTR, and on a mobile viewport.
- **Security-focused tests**: unauthenticated access attempts against
  `/admin`/`/kitchen`, role-escalation attempts, and IDOR attempts against
  the order tracking route.
- **Accessibility checks** (keyboard navigation, focus states, contrast)
  beyond the semantic-HTML-by-default forms already in place.

These are scoped but not built in this pass — see `docs/ROADMAP.md`.

## Running the tests

```bash
npm run db:seed   # populate dev.db with demo data first
npm test          # unit tests
npm run lint
npx tsc --noEmit
npm run build
```
