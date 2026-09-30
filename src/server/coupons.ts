import "server-only";

import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  LOYALTY_EXPIRY_DAYS,
  LOYALTY_MILESTONE,
  LOYALTY_PROMOTION_CODE,
  earnsReward,
  generateCouponCode,
  loyaltyProgress,
} from "@/lib/loyalty";
import { addDays } from "@/lib/time";

type Tx = Prisma.TransactionClient | PrismaClient;

/**
 * Issues the loyalty coupon if this completion earned one.
 *
 * Runs inside the transaction that completes the order, and increments the
 * counter with the same `update` that reads it, so two tills marking up two
 * of the same customer's orders at once cannot both see "four completed" and
 * both skip the reward — or both grant it.
 */
export async function recordCompletionAndReward(
  tx: Tx,
  orderId: string,
  now = new Date()
): Promise<{ code: string; milestone: number } | null> {
  const order = await tx.order.findUnique({
    where: { id: orderId },
    select: { customerId: true },
  });
  if (!order?.customerId) return null;

  const customer = await tx.customer.update({
    where: { id: order.customerId },
    data: { completedOrders: { increment: 1 } },
    select: { id: true, completedOrders: true },
  });

  if (!earnsReward(customer.completedOrders)) return null;

  const promotion = await tx.promotion.findUnique({
    where: { code: LOYALTY_PROMOTION_CODE },
    select: { id: true, active: true },
  });
  // No reward configured, or the owner switched it off. Completing the order
  // is the important part; a missing coupon must never roll it back.
  if (!promotion?.active) return null;

  const code = generateCouponCode();
  await tx.couponGrant.create({
    data: {
      code,
      promotionId: promotion.id,
      customerId: customer.id,
      reason: "loyalty",
      milestone: customer.completedOrders,
      expiresAt: addDays(now, LOYALTY_EXPIRY_DAYS),
    },
  });

  return { code, milestone: customer.completedOrders };
}

export interface CustomerCoupon {
  code: string;
  nameAr: string;
  nameEn: string;
  descriptionAr: string | null;
  descriptionEn: string | null;
  discountType: "PERCENTAGE" | "FIXED";
  discountValue: number;
  minOrderMinor: number;
  maxDiscountMinor: number | null;
  expiresAt: Date | null;
  milestone: number | null;
  redeemedAt: Date | null;
}

/** Every coupon issued to a phone number, newest first. */
export async function couponsForPhone(phone: string): Promise<CustomerCoupon[]> {
  const grants = await prisma.couponGrant.findMany({
    where: { customer: { phone } },
    orderBy: { issuedAt: "desc" },
    take: 20,
    select: {
      code: true,
      expiresAt: true,
      milestone: true,
      redeemedAt: true,
      promotion: {
        select: {
          nameAr: true,
          nameEn: true,
          descriptionAr: true,
          descriptionEn: true,
          discountType: true,
          discountValue: true,
          minOrderMinor: true,
          maxDiscountMinor: true,
        },
      },
    },
  });

  return grants.map((grant) => ({
    code: grant.code,
    expiresAt: grant.expiresAt,
    milestone: grant.milestone,
    redeemedAt: grant.redeemedAt,
    ...grant.promotion,
  }));
}

export interface LoyaltyStanding {
  completed: number;
  towardsNext: number;
  remaining: number;
  nextMilestone: number;
  milestone: number;
}

export async function loyaltyStandingForPhone(phone: string): Promise<LoyaltyStanding | null> {
  const customer = await prisma.customer.findUnique({
    where: { phone },
    select: { completedOrders: true },
  });
  if (!customer) return null;
  return { ...loyaltyProgress(customer.completedOrders), milestone: LOYALTY_MILESTONE };
}

/** The offers to advertise on the public offers page. */
export async function publicOffers(now = new Date()) {
  return prisma.promotion.findMany({
    where: {
      active: true,
      visibility: "PUBLIC",
      OR: [{ startsAt: null }, { startsAt: { lte: now } }],
      AND: [{ OR: [{ endsAt: null }, { endsAt: { gte: now } }] }],
    },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      code: true,
      nameAr: true,
      nameEn: true,
      descriptionAr: true,
      descriptionEn: true,
      discountType: true,
      discountValue: true,
      minOrderMinor: true,
      maxDiscountMinor: true,
      endsAt: true,
      usageLimit: true,
      usageCount: true,
      perCustomerLimit: true,
      products: { select: { product: { select: { nameAr: true, nameEn: true } } } },
    },
  });
}
