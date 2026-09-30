// Order pricing.
//
// The server is the only authority on money (docs/PRD.md §43, §91.1). The
// browser sends product ids, option ids and quantities; every price used in
// the total is re-read from the database and recomputed here. Nothing in this
// file accepts a price from the caller's request.
//
// All arithmetic is on integer minor units — no floats anywhere near money
// (docs/PRD.md §60).

export interface PricedOption {
  optionValueId: string;
  groupNameAr: string;
  groupNameEn: string;
  nameAr: string;
  nameEn: string;
  priceDeltaMinor: number;
}

export interface PricedLine {
  productId: string;
  nameAr: string;
  nameEn: string;
  basePriceMinor: number;
  unitPriceMinor: number;
  quantity: number;
  lineTotalMinor: number;
  note?: string;
  options: PricedOption[];
}

export type DiscountType = "PERCENTAGE" | "FIXED";

export interface PromotionRule {
  id: string;
  code: string | null;
  discountType: DiscountType;
  discountValue: number;
  minOrderMinor: number;
  maxDiscountMinor: number | null;
  startsAt: Date | null;
  endsAt: Date | null;
  active: boolean;
  usageLimit: number | null;
  usageCount: number;
  /** Empty = applies to the whole order. */
  productIds: string[];
}

export type PromotionRejectionCode =
  | "NOT_FOUND"
  | "INACTIVE"
  | "NOT_STARTED"
  | "EXPIRED"
  | "USAGE_EXHAUSTED"
  | "BELOW_MINIMUM"
  | "NO_ELIGIBLE_ITEMS"
  // The four below are about *who* is using the code rather than what is in
  // the basket, so they are decided before the basket is priced at all
  // (src/server/orders.ts, resolvePromoCode).
  | "NEEDS_PHONE"
  | "NOT_YOURS"
  | "ALREADY_USED"
  | "CUSTOMER_LIMIT";

export interface PromotionEvaluation {
  applicable: boolean;
  discountMinor: number;
  reasonCode?: PromotionRejectionCode;
}

export function lineUnitPrice(basePriceMinor: number, options: { priceDeltaMinor: number }[]): number {
  return options.reduce((sum, option) => sum + option.priceDeltaMinor, basePriceMinor);
}

export function subtotalOf(lines: PricedLine[]): number {
  return lines.reduce((sum, line) => sum + line.lineTotalMinor, 0);
}

/**
 * Decides whether a promotion applies to a basket and how much it takes off.
 *
 * A product-scoped promotion discounts only the eligible lines; an unscoped
 * one discounts the whole subtotal. The result is clamped so a discount can
 * never exceed the amount it applies to — an order total is never negative.
 */
export function evaluatePromotion(
  promotion: PromotionRule,
  lines: PricedLine[],
  now: Date
): PromotionEvaluation {
  if (!promotion.active) {
    return { applicable: false, discountMinor: 0, reasonCode: "INACTIVE" };
  }
  if (promotion.startsAt && now < promotion.startsAt) {
    return { applicable: false, discountMinor: 0, reasonCode: "NOT_STARTED" };
  }
  if (promotion.endsAt && now > promotion.endsAt) {
    return { applicable: false, discountMinor: 0, reasonCode: "EXPIRED" };
  }
  if (promotion.usageLimit !== null && promotion.usageCount >= promotion.usageLimit) {
    return { applicable: false, discountMinor: 0, reasonCode: "USAGE_EXHAUSTED" };
  }

  const subtotal = subtotalOf(lines);
  if (subtotal < promotion.minOrderMinor) {
    return { applicable: false, discountMinor: 0, reasonCode: "BELOW_MINIMUM" };
  }

  const scoped = promotion.productIds.length > 0;
  const eligibleBase = scoped
    ? lines
        .filter((line) => promotion.productIds.includes(line.productId))
        .reduce((sum, line) => sum + line.lineTotalMinor, 0)
    : subtotal;

  if (eligibleBase <= 0) {
    return { applicable: false, discountMinor: 0, reasonCode: "NO_ELIGIBLE_ITEMS" };
  }

  let discount =
    promotion.discountType === "PERCENTAGE"
      ? Math.floor((eligibleBase * promotion.discountValue) / 100)
      : promotion.discountValue;

  if (promotion.maxDiscountMinor !== null) {
    discount = Math.min(discount, promotion.maxDiscountMinor);
  }
  discount = Math.max(0, Math.min(discount, eligibleBase));

  if (discount === 0) {
    return { applicable: false, discountMinor: 0, reasonCode: "NO_ELIGIBLE_ITEMS" };
  }
  return { applicable: true, discountMinor: discount };
}

export interface OrderTotals {
  subtotalMinor: number;
  discountMinor: number;
  totalMinor: number;
}

export function computeTotals(lines: PricedLine[], discountMinor: number): OrderTotals {
  const subtotalMinor = subtotalOf(lines);
  const clampedDiscount = Math.max(0, Math.min(discountMinor, subtotalMinor));
  return {
    subtotalMinor,
    discountMinor: clampedDiscount,
    totalMinor: subtotalMinor - clampedDiscount,
  };
}
