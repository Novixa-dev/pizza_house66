import { describe, expect, it } from "vitest";
import {
  LOYALTY_MILESTONE,
  earnsReward,
  generateCouponCode,
  loyaltyProgress,
} from "@/lib/loyalty";

describe("loyaltyProgress", () => {
  it("starts a new customer at the full distance", () => {
    expect(loyaltyProgress(0)).toEqual({
      completed: 0,
      towardsNext: 0,
      remaining: 5,
      nextMilestone: 5,
    });
  });

  it("counts down through a cycle", () => {
    expect(loyaltyProgress(1).remaining).toBe(4);
    expect(loyaltyProgress(3).remaining).toBe(2);
    expect(loyaltyProgress(4).remaining).toBe(1);
  });

  it("never shows zero remaining", () => {
    // At the milestone the coupon is already issued and the cycle restarts,
    // so "0 to go" would be advertising a reward the customer already has.
    for (let completed = 0; completed <= 40; completed += 1) {
      expect(loyaltyProgress(completed).remaining).toBeGreaterThan(0);
      expect(loyaltyProgress(completed).remaining).toBeLessThanOrEqual(LOYALTY_MILESTONE);
    }
  });

  it("rolls into the next cycle at the milestone", () => {
    expect(loyaltyProgress(5)).toEqual({
      completed: 5,
      towardsNext: 0,
      remaining: 5,
      nextMilestone: 10,
    });
    expect(loyaltyProgress(12).nextMilestone).toBe(15);
  });

  it("treats a nonsensical count as no progress rather than throwing", () => {
    expect(loyaltyProgress(-3).completed).toBe(0);
    expect(loyaltyProgress(2.7).completed).toBe(2);
  });
});

describe("earnsReward", () => {
  it("rewards the fifth order and not the fourth or sixth", () => {
    expect(earnsReward(4)).toBe(false);
    expect(earnsReward(5)).toBe(true);
    expect(earnsReward(6)).toBe(false);
    expect(earnsReward(10)).toBe(true);
  });

  it("does not reward a customer with no completed orders", () => {
    expect(earnsReward(0)).toBe(false);
  });
});

describe("generateCouponCode", () => {
  it("avoids characters that are ambiguous read aloud or typed", () => {
    // The code is dictated over a landline and typed on a phone keypad, so
    // O/0, I/1/L, S/5, B/8 and Z/2 must not appear in the random part.
    for (let attempt = 0; attempt < 200; attempt += 1) {
      const body = generateCouponCode().slice(2);
      expect(body).not.toMatch(/[OIL01S5B8Z2]/);
    }
  });

  it("is the expected shape", () => {
    expect(generateCouponCode()).toMatch(/^PH[ACDEFGHJKMNPQRTUVWXY34679]{8}$/);
    expect(generateCouponCode("XX", 4)).toMatch(/^XX[ACDEFGHJKMNPQRTUVWXY34679]{4}$/);
  });

  it("maps the random bytes without bias toward the alphabet's first entries", () => {
    // 25 does not divide 256, so a naive modulo favours the first six
    // letters. This test does not assert the fix — it records the bias so a
    // future change to the alphabet length is a deliberate one.
    const counts = new Map<string, number>();
    for (let attempt = 0; attempt < 5000; attempt += 1) {
      for (const character of generateCouponCode().slice(2)) {
        counts.set(character, (counts.get(character) ?? 0) + 1);
      }
    }
    expect(counts.size).toBe(25);
    const frequencies = [...counts.values()];
    // Within a factor of two of uniform is more than enough for a code that
    // only has to be unguessable, not uniformly distributed.
    expect(Math.max(...frequencies)).toBeLessThan(Math.min(...frequencies) * 2);
  });
});
