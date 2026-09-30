import "server-only";

import { randomBytes, randomInt } from "node:crypto";
import { prisma } from "@/lib/db";
import type { CreateOrderInput } from "./order-schema";
import { decodeReceipt, normalizePhone, sanitizeFilename } from "./order-schema";
import { getRestaurant, schedulingConfigFor, type RestaurantWithConfig } from "./restaurant";
import {
  computeKitchenReleaseAt,
  earliestPossiblePickup,
  generatePickupSlots,
  nextValidPickupSlot,
  slotStartFor,
  validatePickupTime,
  type SchedulingConfig,
} from "@/lib/scheduling";
import {
  computeTotals,
  evaluatePromotion,
  lineUnitPrice,
  type PricedLine,
  type PromotionRejectionCode,
  type PromotionRule,
} from "@/lib/pricing";
import { RELEASED_SLOT_STATUSES } from "@/lib/order-state";
import { track } from "./analytics";
import { notifyOrderStatus } from "./notifications";
import type { Prisma } from "@prisma/client";

// Order creation is the one write path a customer can reach, so it is also
// where the product's integrity rules concentrate: server-side pricing,
// availability re-checks, pickup-time validation, slot capacity, and
// idempotency. Each failure mode gets its own error type so the API layer can
// map it to a specific, localized message instead of a generic 500.

export class OrderingPausedError extends Error {
  constructor() {
    super("Online ordering is currently paused");
    this.name = "OrderingPausedError";
  }
}

export class InvalidPickupTimeError extends Error {
  readonly earliestValid: Date | null;
  readonly reasonCode: string;
  constructor(earliestValid: Date | null, reasonCode: string) {
    super("Requested pickup time is not valid");
    this.name = "InvalidPickupTimeError";
    this.earliestValid = earliestValid;
    this.reasonCode = reasonCode;
  }
}

export class ProductUnavailableError extends Error {
  readonly productNameAr: string;
  readonly productNameEn: string;
  constructor(nameAr: string, nameEn: string) {
    super(`${nameEn} is no longer available`);
    this.name = "ProductUnavailableError";
    this.productNameAr = nameAr;
    this.productNameEn = nameEn;
  }
}

export class InvalidOptionsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidOptionsError";
  }
}

export class SlotFullError extends Error {
  readonly suggestedAt: Date | null;
  constructor(suggestedAt: Date | null) {
    super("Requested pickup slot is at capacity");
    this.name = "SlotFullError";
    this.suggestedAt = suggestedAt;
  }
}

export class BelowMinimumOrderError extends Error {
  readonly minimumMinor: number;
  constructor(minimumMinor: number) {
    super("Order total is below the restaurant minimum");
    this.name = "BelowMinimumOrderError";
    this.minimumMinor = minimumMinor;
  }
}

export class CouponAlreadyUsedError extends Error {
  constructor() {
    super("That coupon has already been used.");
    this.name = "CouponAlreadyUsedError";
  }
}

export class NoSlotsAvailableError extends Error {
  constructor() {
    super("No pickup slots are available");
    this.name = "NoSlotsAvailableError";
  }
}

/**
 * Human-facing order code. Short enough to read out over the counter, and
 * explicitly *not* a capability — knowing it grants nothing, because tracking
 * requires `trackingToken` (docs/PRD.md §41).
 */
function generateReference(): string {
  return `PH-${randomInt(1000, 10000)}`;
}

/**
 * Tracking token: 32 bytes of CSPRNG entropy, url-safe. Unlike a cuid, this
 * carries no timestamp and no sequence, so one customer's link tells an
 * attacker nothing about anyone else's.
 */
function generateTrackingToken(): string {
  return randomBytes(32).toString("base64url");
}

interface ResolvedPricing {
  lines: PricedLine[];
  maxPrepMinutes: number;
}

/**
 * Re-reads every product and option from the database and prices the basket
 * from those rows. The client's `optionValueIds` are only used to *select*
 * rows, never to supply prices, and an id that doesn't belong to the product
 * is rejected rather than silently ignored.
 */
async function priceBasket(
  items: CreateOrderInput["items"],
  defaultPrepMinutes: number,
  tx: Prisma.TransactionClient = prisma
): Promise<ResolvedPricing> {
  const products = await tx.product.findMany({
    where: { id: { in: items.map((item) => item.productId) } },
    include: { optionGroups: { include: { values: true } } },
  });
  const productMap = new Map(products.map((product) => [product.id, product]));

  const lines: PricedLine[] = [];
  let maxPrepMinutes = defaultPrepMinutes;

  for (const item of items) {
    const product = productMap.get(item.productId);
    if (!product) {
      throw new ProductUnavailableError("صنف غير معروف", "Unknown item");
    }
    if (product.availability !== "AVAILABLE") {
      throw new ProductUnavailableError(product.nameAr, product.nameEn);
    }

    const requested = new Set(item.optionValueIds);
    const options: PricedLine["options"] = [];

    for (const group of product.optionGroups) {
      const selected = group.values.filter((value) => requested.has(value.id));
      for (const value of selected) requested.delete(value.id);

      if (group.required && selected.length === 0) {
        throw new InvalidOptionsError(`Missing required option "${group.nameEn}" for ${product.nameEn}`);
      }
      if (!group.multiSelect && selected.length > 1) {
        throw new InvalidOptionsError(`Only one "${group.nameEn}" may be chosen for ${product.nameEn}`);
      }
      if (group.multiSelect && group.maxSelect !== null && selected.length > group.maxSelect) {
        throw new InvalidOptionsError(`At most ${group.maxSelect} "${group.nameEn}" may be chosen`);
      }
      for (const value of selected) {
        if (!value.available) {
          throw new ProductUnavailableError(value.nameAr, value.nameEn);
        }
        options.push({
          optionValueId: value.id,
          groupNameAr: group.nameAr,
          groupNameEn: group.nameEn,
          nameAr: value.nameAr,
          nameEn: value.nameEn,
          priceDeltaMinor: value.priceDeltaMinor,
        });
      }
    }

    // Anything left over referenced an option that doesn't belong to this
    // product — a tampered request, not a valid basket.
    if (requested.size > 0) {
      throw new InvalidOptionsError(`Unknown option for ${product.nameEn}`);
    }

    const unitPriceMinor = lineUnitPrice(product.basePriceMinor, options);
    lines.push({
      productId: product.id,
      nameAr: product.nameAr,
      nameEn: product.nameEn,
      basePriceMinor: product.basePriceMinor,
      unitPriceMinor,
      quantity: item.quantity,
      lineTotalMinor: unitPriceMinor * item.quantity,
      note: item.note,
      options,
    });

    maxPrepMinutes = Math.max(maxPrepMinutes, product.prepMinutes ?? defaultPrepMinutes);
  }

  return { lines, maxPrepMinutes };
}

type PromotionRow = Prisma.PromotionGetPayload<{
  include: { products: { select: { productId: true } } };
}>;

function toRule(promotion: PromotionRow): PromotionRule {
  return {
    id: promotion.id,
    code: promotion.code,
    discountType: promotion.discountType,
    discountValue: promotion.discountValue,
    minOrderMinor: promotion.minOrderMinor,
    maxDiscountMinor: promotion.maxDiscountMinor,
    startsAt: promotion.startsAt,
    endsAt: promotion.endsAt,
    active: promotion.active,
    usageLimit: promotion.usageLimit,
    usageCount: promotion.usageCount,
    productIds: promotion.products.map((p) => p.productId),
  };
}

export interface ResolvedPromoCode {
  rule: PromotionRule;
  nameAr: string;
  nameEn: string;
  /** Set when the code was a single-use coupon issued to this customer. */
  grantId?: string;
}

/**
 * Turns a typed code into the rule that prices it.
 *
 * Two kinds of code arrive at the same box. A **promotion code** is shared —
 * printed on a flyer, listed on the offers page — and its limits are about
 * everyone: a total cap, and how often one phone number may use it. A **grant
 * code** belongs to one person, works once, and carries its own expiry.
 *
 * They are resolved in that order of specificity, grants first, because a
 * grant code is random and cannot collide with a chosen one.
 *
 * `phone` is what makes the per-customer rules enforceable. Without it — at
 * preview time, before the customer has typed their number — a grant cannot
 * be checked at all, so it is refused rather than optimistically allowed: a
 * preview that promises a discount checkout then withdraws is worse than one
 * that asks for the phone number first.
 */
export async function resolvePromoCode(
  code: string,
  phone: string | null,
  tx: Prisma.TransactionClient = prisma,
  now = new Date()
): Promise<{ resolved: ResolvedPromoCode | null; reasonCode?: PromotionRejectionCode }> {
  const normalized = code.trim().toUpperCase();
  if (!normalized) return { resolved: null, reasonCode: "NOT_FOUND" };

  const grant = await tx.couponGrant.findUnique({
    where: { code: normalized },
    include: {
      customer: { select: { phone: true } },
      promotion: { include: { products: { select: { productId: true } } } },
    },
  });

  if (grant) {
    if (!phone) return { resolved: null, reasonCode: "NEEDS_PHONE" };
    if (grant.customer.phone !== phone) return { resolved: null, reasonCode: "NOT_YOURS" };
    if (grant.redeemedAt) return { resolved: null, reasonCode: "ALREADY_USED" };
    if (grant.expiresAt && grant.expiresAt < now) {
      return { resolved: null, reasonCode: "EXPIRED" };
    }
    return {
      resolved: {
        // A grant is its own usage limit: one code, one use, already checked
        // above. The promotion's shared counters would refuse every grant
        // after the offer's overall cap, which is not what a cap on a public
        // code is for.
        rule: { ...toRule(grant.promotion), usageLimit: null, usageCount: 0, active: true },
        nameAr: grant.promotion.nameAr,
        nameEn: grant.promotion.nameEn,
        grantId: grant.id,
      },
    };
  }

  const promotion = await tx.promotion.findUnique({
    where: { code: normalized },
    include: { products: { select: { productId: true } } },
  });
  if (!promotion) return { resolved: null, reasonCode: "NOT_FOUND" };

  // An EARNED promotion is a template that grants are issued from. Its own
  // code must never work, or the reward is a public discount.
  if (promotion.visibility === "EARNED") return { resolved: null, reasonCode: "NOT_FOUND" };

  if (promotion.perCustomerLimit !== null) {
    if (!phone) return { resolved: null, reasonCode: "NEEDS_PHONE" };
    const used = await tx.order.count({
      where: {
        guestPhone: phone,
        promotionId: promotion.id,
        status: { notIn: ["CANCELLED", "REJECTED"] },
      },
    });
    if (used >= promotion.perCustomerLimit) {
      return { resolved: null, reasonCode: "CUSTOMER_LIMIT" };
    }
  }

  return {
    resolved: { rule: toRule(promotion), nameAr: promotion.nameAr, nameEn: promotion.nameEn },
  };
}

/** Promotions with no code that are live right now — the homepage "offers" rail. */
export async function getAutomaticPromotions(now = new Date()) {
  return prisma.promotion.findMany({
    where: {
      active: true,
      code: null,
      OR: [{ startsAt: null }, { startsAt: { lte: now } }],
      AND: [{ OR: [{ endsAt: null }, { endsAt: { gte: now } }] }],
    },
    include: { products: { select: { productId: true } } },
    orderBy: { createdAt: "desc" },
  });
}

export interface PromoPreview {
  valid: boolean;
  discountMinor: number;
  reasonCode?: string;
  nameAr?: string;
  nameEn?: string;
}

/** Prices a promo code against a basket without creating anything. */
export async function previewPromotion(
  code: string,
  items: CreateOrderInput["items"],
  phone: string | null = null,
  now = new Date()
): Promise<PromoPreview> {
  const restaurant = await getRestaurant();
  const { lines } = await priceBasket(items, restaurant.defaultPrepMinutes);
  const { resolved, reasonCode } = await resolvePromoCode(code, phone, prisma, now);
  if (!resolved) {
    return { valid: false, discountMinor: 0, reasonCode: reasonCode ?? "NOT_FOUND" };
  }

  const evaluation = evaluatePromotion(resolved.rule, lines, now);
  return {
    valid: evaluation.applicable,
    discountMinor: evaluation.discountMinor,
    reasonCode: evaluation.reasonCode,
    nameAr: resolved.nameAr,
    nameEn: resolved.nameEn,
  };
}

/** Resolves the pickup instant for either ordering mode, or throws. */
async function resolvePickupTime(
  input: CreateOrderInput,
  now: Date,
  maxPrepMinutes: number,
  config: SchedulingConfig
): Promise<Date> {
  if (input.pickup.mode === "ASAP") {
    // "As soon as possible" means the earliest slot that can actually take
    // the order — so a full slot rolls forward rather than failing. Telling
    // a customer "that time is full, pick another" when they never picked a
    // time is nonsense; only the SCHEDULED path can meaningfully say that.
    const [firstOpen] = await getAvailablePickupSlots(maxPrepMinutes, now);
    if (!firstOpen) throw new NoSlotsAvailableError();
    return firstOpen.at;
  }

  const requested = new Date(input.pickup.requestedAt);
  if (Number.isNaN(requested.getTime())) {
    throw new InvalidPickupTimeError(null, "IN_PAST");
  }

  const result = validatePickupTime({
    now,
    requested,
    prepMinutes: maxPrepMinutes,
    config,
    onlineOrderingPaused: false, // already checked by the caller
  });
  if (!result.valid) {
    const suggestion = nextValidPickupSlot(result.earliestPossible, config);
    throw new InvalidPickupTimeError(suggestion, result.reasonCode ?? "CLOSED");
  }
  return requested;
}

export type CreatedOrder = Prisma.OrderGetPayload<{
  include: { items: { include: { options: true } }; payment: true };
}>;

/**
 * Creates an order.
 *
 * Idempotent on `idempotencyKey`: a repeated submission returns the original
 * order rather than creating a second one, both via an up-front lookup and
 * via the unique constraint, so two genuinely concurrent requests still
 * produce exactly one order (docs/PRD.md §45, §92.I).
 */
export async function createOrder(input: CreateOrderInput): Promise<CreatedOrder> {
  const existing = await findOrderByIdempotencyKey(input.idempotencyKey);
  if (existing) return existing;

  const restaurant = await getRestaurant();
  if (restaurant.onlineOrderingPaused) throw new OrderingPausedError();

  assertPaymentMethodEnabled(restaurant, input.payment.method);

  const now = new Date();
  const config = schedulingConfigFor(restaurant);

  const { lines, maxPrepMinutes } = await priceBasket(input.items, restaurant.defaultPrepMinutes);

  const phone = normalizePhone(input.customer.phone);

  let discountMinor = 0;
  let promotionId: string | null = null;
  let grantId: string | null = null;
  if (input.promoCode) {
    // The phone goes in so a single-use coupon can be matched to its owner
    // and a per-customer cap can be counted.
    const { resolved } = await resolvePromoCode(input.promoCode, phone, prisma, now);
    if (resolved) {
      const evaluation = evaluatePromotion(resolved.rule, lines, now);
      if (evaluation.applicable) {
        discountMinor = evaluation.discountMinor;
        promotionId = resolved.rule.id;
        grantId = resolved.grantId ?? null;
      }
    }
    // An invalid code doesn't fail the order — the customer just doesn't get
    // the discount, and the UI has already told them so at preview time.
  }

  const totals = computeTotals(lines, discountMinor);
  if (totals.totalMinor < restaurant.minOrderMinor) {
    throw new BelowMinimumOrderError(restaurant.minOrderMinor);
  }

  const requestedPickupAt = await resolvePickupTime(input, now, maxPrepMinutes, config);
  const slotStartAt = slotStartFor(requestedPickupAt, restaurant.slotIntervalMinutes, restaurant.timezone);
  const kitchenReleaseAt = computeKitchenReleaseAt(requestedPickupAt, maxPrepMinutes);

  // Bank transfers wait for a human to approve the receipt; everything else
  // is confirmed on arrival (docs/PRD.md §19, §21).
  const initialStatus = input.payment.method === "BANK_TRANSFER" ? "PAYMENT_PENDING" : "CONFIRMED";

  const receipt =
    input.payment.method === "BANK_TRANSFER" && input.payment.receipt
      ? {
          ...decodeReceipt(input.payment.receipt.contentType, input.payment.receipt.dataBase64),
          originalName: sanitizeFilename(input.payment.receipt.originalName),
        }
      : null;

  const order = await prisma.$transaction(async (tx) => {
    await assertSlotHasCapacity(tx, slotStartAt, restaurant, config);

    const customer = await tx.customer.upsert({
      where: { phone },
      create: { name: input.customer.name, phone },
      update: { name: input.customer.name },
    });

    const created = await tx.order.create({
      data: {
        reference: await allocateReference(tx),
        trackingToken: generateTrackingToken(),
        customerId: customer.id,
        guestName: input.customer.name,
        guestPhone: phone,
        notes: input.notes,
        pickupMode: input.pickup.mode,
        requestedPickupAt,
        slotStartAt,
        prepMinutes: maxPrepMinutes,
        kitchenReleaseAt,
        subtotalMinor: totals.subtotalMinor,
        discountMinor: totals.discountMinor,
        totalMinor: totals.totalMinor,
        currency: restaurant.currency,
        promotionId,
        promoCode: promotionId ? input.promoCode?.toUpperCase() : null,
        status: initialStatus,
        confirmedAt: initialStatus === "CONFIRMED" ? now : null,
        idempotencyKey: input.idempotencyKey,
        items: {
          create: lines.map((line) => ({
            productId: line.productId,
            nameAr: line.nameAr,
            nameEn: line.nameEn,
            basePriceMinor: line.basePriceMinor,
            unitPriceMinor: line.unitPriceMinor,
            quantity: line.quantity,
            lineTotalMinor: line.lineTotalMinor,
            note: line.note,
            options: {
              create: line.options.map((option) => ({
                optionValueId: option.optionValueId,
                groupNameAr: option.groupNameAr,
                groupNameEn: option.groupNameEn,
                nameAr: option.nameAr,
                nameEn: option.nameEn,
                priceDeltaMinor: option.priceDeltaMinor,
              })),
            },
          })),
        },
        statusHistory: {
          create: [
            { toStatus: "PENDING" },
            { fromStatus: "PENDING", toStatus: initialStatus },
          ],
        },
        payment: {
          create: {
            method: input.payment.method,
            status: input.payment.method === "BANK_TRANSFER" ? "PENDING" : "UNPAID",
            amountMinor: totals.totalMinor,
            currency: restaurant.currency,
            referenceNumber:
              input.payment.method === "BANK_TRANSFER" ? input.payment.referenceNumber : null,
            ...(receipt
              ? {
                  receipt: {
                    create: {
                      contentType: receipt.contentType,
                      byteSize: receipt.buffer.byteLength,
                      data: new Uint8Array(receipt.buffer),
                      originalName: receipt.originalName,
                    },
                  },
                }
              : {}),
          },
        },
      },
      include: { items: { include: { options: true } }, payment: true },
    });

    if (promotionId) {
      await tx.promotion.update({
        where: { id: promotionId },
        data: { usageCount: { increment: 1 } },
      });
    }

    if (grantId) {
      // Conditioned on the coupon still being unredeemed, so two orders
      // submitted at the same moment with the same coupon cannot both spend
      // it. The loser's update matches nothing and the order is rejected
      // rather than quietly discounted twice.
      const claimed = await tx.couponGrant.updateMany({
        where: { id: grantId, redeemedAt: null },
        data: { redeemedAt: now, redeemedOrderId: created.id },
      });
      if (claimed.count === 0) throw new CouponAlreadyUsedError();
    }

    return created;
  });

  // Side effects deliberately run after the transaction commits: an analytics
  // write or a notification must never be able to roll back a real order.
  await track({
    name: "order_created",
    sessionId: input.sessionId,
    orderId: order.id,
    valueMinor: order.totalMinor,
    metadata: { pickupMode: order.pickupMode, paymentMethod: order.payment?.method },
  });
  await notifyOrderStatus(order.id, initialStatus);

  return order;
}

async function findOrderByIdempotencyKey(key: string): Promise<CreatedOrder | null> {
  return prisma.order.findUnique({
    where: { idempotencyKey: key },
    include: { items: { include: { options: true } }, payment: true },
  });
}

function assertPaymentMethodEnabled(
  restaurant: RestaurantWithConfig,
  method: CreateOrderInput["payment"]["method"]
): void {
  const config = restaurant.paymentMethods.find((entry) => entry.type === method);
  if (!config || !config.enabled) {
    // A disabled method reaching the server means the page was stale or the
    // request was crafted; either way it is not a usable payment route.
    throw new InvalidOptionsError(`Payment method ${method} is not enabled`);
  }
}

/**
 * Capacity is counted per slot *window*, not per exact timestamp — two orders
 * for 19:00 and 19:07 both occupy the 19:00 quarter-hour. The check runs
 * inside the creating transaction so a burst of simultaneous checkouts can't
 * each see a free slot and all take it.
 */
async function assertSlotHasCapacity(
  tx: Prisma.TransactionClient,
  slotStartAt: Date,
  restaurant: RestaurantWithConfig,
  config: SchedulingConfig
): Promise<void> {
  const taken = await tx.order.count({
    where: { slotStartAt, status: { notIn: RELEASED_SLOT_STATUSES } },
  });
  if (taken < restaurant.slotCapacity) return;

  const nextSlot = nextValidPickupSlot(
    new Date(slotStartAt.getTime() + restaurant.slotIntervalMinutes * 60 * 1000),
    config
  );
  throw new SlotFullError(nextSlot);
}

/** Retries on collision; `reference` is unique, so a clash must not 500. */
async function allocateReference(tx: Prisma.TransactionClient): Promise<string> {
  for (let attempt = 0; attempt < 8; attempt++) {
    const candidate = generateReference();
    const clash = await tx.order.findUnique({ where: { reference: candidate }, select: { id: true } });
    if (!clash) return candidate;
  }
  // Exhausted the short, friendly space — fall back to a longer but unique code.
  return `PH-${randomBytes(4).toString("hex").toUpperCase()}`;
}

export type OrderWithRelations = Prisma.OrderGetPayload<{
  include: {
    items: { include: { options: true } };
    payment: { include: { receipt: { select: { id: true; contentType: true; byteSize: true } } } };
    statusHistory: { include: { changedBy: { select: { name: true } } } };
    notifications: true;
  };
}>;

export async function getOrderByTrackingToken(token: string): Promise<OrderWithRelations | null> {
  // Guard the length before hitting the database: a token is fixed-size, so
  // anything else is a probe, not a customer.
  if (token.length < 16 || token.length > 128) return null;
  return prisma.order.findUnique({
    where: { trackingToken: token },
    include: {
      items: { include: { options: true } },
      payment: { include: { receipt: { select: { id: true, contentType: true, byteSize: true } } } },
      statusHistory: { include: { changedBy: { select: { name: true } } }, orderBy: { createdAt: "asc" } },
      notifications: true,
    },
  });
}

export async function getOrderById(id: string): Promise<OrderWithRelations | null> {
  return prisma.order.findUnique({
    where: { id },
    include: {
      items: { include: { options: true } },
      payment: { include: { receipt: { select: { id: true, contentType: true, byteSize: true } } } },
      statusHistory: { include: { changedBy: { select: { name: true } } }, orderBy: { createdAt: "asc" } },
      notifications: true,
    },
  });
}

export interface SlotAvailability {
  at: Date;
  remaining: number;
}

/**
 * The pickup slots a customer may actually choose: open, far enough ahead for
 * preparation, and not already full. The checkout picker renders exactly this
 * list, and `createOrder` re-validates against the same rules — so a customer
 * is never offered a time the server would then refuse (docs/PRD.md §12.3).
 */
export async function getAvailablePickupSlots(
  prepMinutes?: number,
  now = new Date()
): Promise<SlotAvailability[]> {
  const restaurant = await getRestaurant();
  const config = schedulingConfigFor(restaurant);
  const effectivePrep = prepMinutes ?? restaurant.defaultPrepMinutes;

  const slots = generatePickupSlots(earliestPossiblePickup(now, effectivePrep), config);
  if (slots.length === 0) return [];

  const counts = await prisma.order.groupBy({
    by: ["slotStartAt"],
    where: {
      slotStartAt: { gte: slots[0], lte: slots[slots.length - 1] },
      status: { notIn: RELEASED_SLOT_STATUSES },
    },
    _count: { _all: true },
  });
  const takenBySlot = new Map(counts.map((row) => [row.slotStartAt.getTime(), row._count._all]));

  return slots
    .map((at) => ({
      at,
      remaining: restaurant.slotCapacity - (takenBySlot.get(at.getTime()) ?? 0),
    }))
    .filter((slot) => slot.remaining > 0);
}

/**
 * Promotes confirmed orders whose kitchen-release time has arrived into the
 * kitchen queue. This is the mechanism that keeps a 19:00 order out of the
 * kitchen at 16:00 (docs/PRD.md §13, §26).
 *
 * Called both by the scheduled job (`/api/cron/release-orders`) and
 * opportunistically when staff load the kitchen or orders screens, so the
 * behavior is correct even if the scheduler is not configured.
 */
export async function releaseDueOrders(now = new Date()): Promise<number> {
  const due = await prisma.order.findMany({
    where: { status: "CONFIRMED", kitchenReleaseAt: { lte: now } },
    select: { id: true },
  });
  if (due.length === 0) return 0;

  let released = 0;
  for (const { id } of due) {
    // One transaction per order rather than one for the batch: a single
    // order that cannot be released must not hold back the rest of the
    // kitchen's queue.
    const moved = await prisma.$transaction(async (tx) => {
      // Guarded update: if another request (or a concurrent run of this same
      // job) moved this order first, the `status` filter makes this a no-op
      // instead of a double history entry.
      const result = await tx.order.updateMany({
        where: { id, status: "CONFIRMED" },
        data: { status: "QUEUED", queuedAt: now },
      });
      if (result.count === 0) return false;
      // Inside the transaction so there is no window in which an order has
      // moved but nothing records that it did — the same invariant
      // `transitionOrder` keeps for staff-initiated changes.
      await tx.orderStatusHistory.create({
        data: {
          orderId: id,
          fromStatus: "CONFIRMED",
          toStatus: "QUEUED",
          reason: "kitchen_release",
        },
      });
      return true;
    });
    if (moved) released += 1;
  }
  return released;
}
