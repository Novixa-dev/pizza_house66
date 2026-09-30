import { describe, expect, it } from "vitest";
import {
  computeTotals,
  evaluatePromotion,
  lineUnitPrice,
  subtotalOf,
  type PricedLine,
  type PromotionRule,
} from "@/lib/pricing";

// Money rules (docs/PRD.md §43, §60, §91.1). These are the calculations a
// customer is charged by, so they are tested against the worked examples in
// the brief rather than against whatever the code happens to do.

function line(overrides: Partial<PricedLine> = {}): PricedLine {
  return {
    productId: "p1",
    nameAr: "بيبروني",
    nameEn: "Pepperoni",
    basePriceMinor: 2500,
    unitPriceMinor: 2500,
    quantity: 1,
    lineTotalMinor: 2500,
    options: [],
    ...overrides,
  };
}

function promotion(overrides: Partial<PromotionRule> = {}): PromotionRule {
  return {
    id: "promo1",
    code: "SAVE",
    discountType: "PERCENTAGE",
    discountValue: 10,
    minOrderMinor: 0,
    maxDiscountMinor: null,
    startsAt: null,
    endsAt: null,
    active: true,
    usageLimit: null,
    usageCount: 0,
    productIds: [],
    ...overrides,
  };
}

const NOW = new Date("2026-01-06T18:00:00+03:00");

describe("lineUnitPrice", () => {
  it("matches the PRD worked example: large pepperoni + cheese + olives = 3,000", () => {
    // docs/PRD.md §9.3: base 2,500 · Large +0 · Extra cheese +300 · Olives +200
    const unit = lineUnitPrice(2500, [{ priceDeltaMinor: 300 }, { priceDeltaMinor: 200 }]);
    expect(unit).toBe(3000);
  });

  it("handles a negative delta (a removal priced as a discount)", () => {
    expect(lineUnitPrice(2500, [{ priceDeltaMinor: -200 }])).toBe(2300);
  });

  it("stays an integer — no floating point anywhere near money", () => {
    const unit = lineUnitPrice(333, [{ priceDeltaMinor: 333 }, { priceDeltaMinor: 333 }]);
    expect(Number.isInteger(unit)).toBe(true);
    expect(unit).toBe(999);
  });
});

describe("subtotalOf", () => {
  it("sums line totals", () => {
    expect(subtotalOf([line({ lineTotalMinor: 2500 }), line({ lineTotalMinor: 1200 })])).toBe(3700);
  });

  it("is zero for an empty basket", () => {
    expect(subtotalOf([])).toBe(0);
  });
});

describe("evaluatePromotion", () => {
  const basket = [line({ lineTotalMinor: 5000, quantity: 2, unitPriceMinor: 2500 })];

  it("applies a percentage discount", () => {
    const result = evaluatePromotion(promotion({ discountValue: 10 }), basket, NOW);
    expect(result.applicable).toBe(true);
    expect(result.discountMinor).toBe(500);
  });

  it("applies a fixed discount", () => {
    const result = evaluatePromotion(
      promotion({ discountType: "FIXED", discountValue: 750 }),
      basket,
      NOW
    );
    expect(result.discountMinor).toBe(750);
  });

  it("rounds a percentage down, never up — the customer is never overcharged", () => {
    const result = evaluatePromotion(
      promotion({ discountValue: 33 }),
      [line({ lineTotalMinor: 1000 })],
      NOW
    );
    expect(result.discountMinor).toBe(330);
  });

  it("caps at maxDiscountMinor", () => {
    const result = evaluatePromotion(
      promotion({ discountValue: 50, maxDiscountMinor: 1000 }),
      basket,
      NOW
    );
    expect(result.discountMinor).toBe(1000);
  });

  it("never discounts more than the eligible amount", () => {
    const result = evaluatePromotion(
      promotion({ discountType: "FIXED", discountValue: 99_999 }),
      [line({ lineTotalMinor: 1000 })],
      NOW
    );
    expect(result.discountMinor).toBe(1000);
  });

  it("rejects a basket below the minimum", () => {
    const result = evaluatePromotion(promotion({ minOrderMinor: 6000 }), basket, NOW);
    expect(result.applicable).toBe(false);
    expect(result.reasonCode).toBe("BELOW_MINIMUM");
  });

  it("rejects an inactive promotion", () => {
    expect(evaluatePromotion(promotion({ active: false }), basket, NOW).reasonCode).toBe("INACTIVE");
  });

  it("rejects one that hasn't started", () => {
    const rule = promotion({ startsAt: new Date("2026-02-01T00:00:00Z") });
    expect(evaluatePromotion(rule, basket, NOW).reasonCode).toBe("NOT_STARTED");
  });

  it("rejects an expired one", () => {
    const rule = promotion({ endsAt: new Date("2026-01-01T00:00:00Z") });
    expect(evaluatePromotion(rule, basket, NOW).reasonCode).toBe("EXPIRED");
  });

  it("rejects one that has hit its usage limit", () => {
    const rule = promotion({ usageLimit: 5, usageCount: 5 });
    expect(evaluatePromotion(rule, basket, NOW).reasonCode).toBe("USAGE_EXHAUSTED");
  });

  describe("product-scoped promotions", () => {
    const mixed = [
      line({ productId: "pizza", lineTotalMinor: 3000 }),
      line({ productId: "drink", lineTotalMinor: 1000 }),
    ];

    it("discounts only the eligible lines", () => {
      const rule = promotion({ discountValue: 10, productIds: ["pizza"] });
      // 10% of the pizza line only, not of the 4,000 subtotal.
      expect(evaluatePromotion(rule, mixed, NOW).discountMinor).toBe(300);
    });

    it("does not apply when no basket line matches", () => {
      const rule = promotion({ productIds: ["dessert"] });
      const result = evaluatePromotion(rule, mixed, NOW);
      expect(result.applicable).toBe(false);
      expect(result.reasonCode).toBe("NO_ELIGIBLE_ITEMS");
    });

    it("still measures the minimum against the whole order", () => {
      // The basket is 4,000 overall, so a 3,500 minimum is met even though
      // the eligible line alone is 3,000.
      const rule = promotion({ minOrderMinor: 3500, productIds: ["pizza"] });
      expect(evaluatePromotion(rule, mixed, NOW).applicable).toBe(true);
    });
  });
});

describe("computeTotals", () => {
  it("subtracts the discount from the subtotal", () => {
    const totals = computeTotals([line({ lineTotalMinor: 5000 })], 500);
    expect(totals).toEqual({ subtotalMinor: 5000, discountMinor: 500, totalMinor: 4500 });
  });

  it("clamps an oversized discount so a total is never negative", () => {
    const totals = computeTotals([line({ lineTotalMinor: 1000 })], 5000);
    expect(totals.discountMinor).toBe(1000);
    expect(totals.totalMinor).toBe(0);
  });

  it("ignores a negative discount", () => {
    const totals = computeTotals([line({ lineTotalMinor: 1000 })], -500);
    expect(totals.discountMinor).toBe(0);
    expect(totals.totalMinor).toBe(1000);
  });
});
