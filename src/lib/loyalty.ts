// The loyalty rule, and what a coupon is for.
//
// WHY THIS EXISTS, in the restaurant's terms rather than the code's:
//
// A pizza shop's problem is not the first order, it is the fourth. Someone
// tries it, likes it, and then orders from whoever they happen to think of
// next Thursday. Every large chain solves this the same way, and it is worth
// being explicit about the mechanism because it is the whole point of the
// feature:
//
//   - A reward the customer can *see coming* changes the next decision. "Two
//     more orders until 1,000 off" is a reason to come back here rather than
//     somewhere else, and it costs the restaurant nothing until it is earned.
//   - A reward that is *already in their hand* — an issued code, sitting on
//     their orders page — is stronger still, because leaving it unused feels
//     like losing something. That is why the coupon is issued rather than
//     merely promised.
//   - The discount is only paid on an order that happened. A 1,000 rial
//     coupon redeemed against a 4,500 rial basket is 1,000 spent to earn
//     3,500 that would otherwise have gone elsewhere, from a customer who has
//     now ordered six times instead of five.
//
// And the part that is easy to get wrong: a coupon must be attached to a
// person. A shared code in a WhatsApp group is not a loyalty scheme, it is a
// price cut with extra steps. Hence CouponGrant — one code, one customer, one
// use.

/**
 * The promotion an earned coupon is issued from.
 *
 * Lives here rather than beside the issuing code so the seed can name it
 * without importing a "server-only" module.
 */
export const LOYALTY_PROMOTION_CODE = "LOYALTY-REWARD";

/** Orders between rewards. Every Nth completed order earns a coupon. */
export const LOYALTY_MILESTONE = 5;

/** How long an earned coupon stays usable. */
export const LOYALTY_EXPIRY_DAYS = 60;

export interface LoyaltyProgress {
  /** Completed orders this customer has to their name. */
  completed: number;
  /** How many of the current cycle's orders are done (0…MILESTONE-1). */
  towardsNext: number;
  /** Orders still needed for the next reward. Never 0 — see below. */
  remaining: number;
  /** The milestone number the next reward will be for. */
  nextMilestone: number;
}

/**
 * Where a customer stands.
 *
 * `remaining` is never zero: the moment an order completes the milestone, the
 * coupon is issued and the cycle restarts, so "0 to go" is a state that lasts
 * no longer than a transaction. Showing it would be showing a reward that has
 * already been granted.
 */
export function loyaltyProgress(completed: number, milestone = LOYALTY_MILESTONE): LoyaltyProgress {
  const safeCompleted = Math.max(0, Math.floor(completed));
  const towardsNext = safeCompleted % milestone;
  return {
    completed: safeCompleted,
    towardsNext,
    remaining: milestone - towardsNext,
    nextMilestone: safeCompleted - towardsNext + milestone,
  };
}

/**
 * Does completing this order earn a reward?
 *
 * Takes the count *after* the order completes, so the fifth order earns, not
 * the sixth.
 */
export function earnsReward(completedAfter: number, milestone = LOYALTY_MILESTONE): boolean {
  return completedAfter > 0 && completedAfter % milestone === 0;
}

// Codes are read aloud over a landline and typed on a phone keyboard, so the
// alphabet leaves out every pair that is ambiguous in either: no O or 0, no I
// or 1 or L, no S or 5, no B or 8, no Z or 2.
const CODE_ALPHABET = "ACDEFGHJKMNPQRTUVWXY34679";

/**
 * A grant code: a readable prefix and enough entropy that guessing one is not
 * a strategy.
 *
 * Eight characters from a 25-letter alphabet is about 37 bits — roughly 190
 * billion codes. At the rate limit on the checkout endpoint, finding one live
 * code by guessing takes longer than the restaurant will exist.
 */
export function generateCouponCode(
  prefix = "PH",
  length = 8,
  random: (bytes: number) => Uint8Array = defaultRandom
): string {
  const bytes = random(length);
  let code = "";
  for (let index = 0; index < length; index += 1) {
    code += CODE_ALPHABET[bytes[index]! % CODE_ALPHABET.length];
  }
  return `${prefix}${code}`;
}

function defaultRandom(bytes: number): Uint8Array {
  const buffer = new Uint8Array(bytes);
  globalThis.crypto.getRandomValues(buffer);
  return buffer;
}
