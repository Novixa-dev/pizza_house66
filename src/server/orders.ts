import { prisma } from "@/lib/db";
import type { CreateOrderInput } from "./order-schema";
import { getRestaurant, toBusinessHourRules, toScheduleOverrideRules } from "./restaurant";
import {
  computeKitchenReleaseAt,
  earliestPossiblePickup,
  isReadyForKitchenRelease,
  nextValidPickupSlot,
  validatePickupTime,
} from "@/lib/scheduling";
import type { Prisma } from "@prisma/client";

export class OrderingPausedError extends Error {
  constructor() {
    super("Online ordering is currently paused");
    this.name = "OrderingPausedError";
  }
}

export class InvalidPickupTimeError extends Error {
  earliestValid: Date;
  constructor(earliestValid: Date) {
    super("Requested pickup time is not valid");
    this.name = "InvalidPickupTimeError";
    this.earliestValid = earliestValid;
  }
}

export class ProductUnavailableError extends Error {
  constructor(productName: string) {
    super(`${productName} is no longer available`);
    this.name = "ProductUnavailableError";
  }
}

export class SlotFullError extends Error {
  suggestedAt: Date;
  constructor(suggestedAt: Date) {
    super("Requested pickup slot is at capacity");
    this.name = "SlotFullError";
    this.suggestedAt = suggestedAt;
  }
}

function generateReference(): string {
  const n = Math.floor(1000 + Math.random() * 9000);
  return `PH-${n}`;
}

/**
 * Creates an order with server-authoritative pricing, availability, and
 * pickup-time validation. Never trusts client-submitted prices or totals
 * (docs/PRD.md sections 43, 90). Idempotent on `idempotencyKey`: a repeated
 * call with the same key returns the original order instead of creating a
 * duplicate (docs/PRD.md section 45).
 */
export async function createOrder(input: CreateOrderInput) {
  const existing = await prisma.order.findUnique({
    where: { idempotencyKey: input.idempotencyKey },
    include: { items: { include: { options: true } }, payment: true },
  });
  if (existing) return existing;

  const restaurant = await getRestaurant();
  if (restaurant.onlineOrderingPaused) {
    throw new OrderingPausedError();
  }

  const now = new Date();
  const hours = toBusinessHourRules(restaurant.businessHours);
  const overrides = toScheduleOverrideRules(restaurant.scheduleOverrides);

  const products = await prisma.product.findMany({
    where: { id: { in: input.items.map((i) => i.productId) } },
    include: { optionGroups: { include: { values: true } } },
  });
  const productMap = new Map(products.map((p) => [p.id, p]));

  let subtotalMinor = 0;
  let maxPrepMinutes = restaurant.defaultPrepMinutes;
  const preparedItems: {
    productId: string;
    nameAr: string;
    nameEn: string;
    unitPriceMinor: number;
    quantity: number;
    lineTotalMinor: number;
    note?: string;
    options: { optionValueId: string; nameAr: string; nameEn: string; priceDeltaMinor: number }[];
  }[] = [];

  for (const item of input.items) {
    const product = productMap.get(item.productId);
    if (!product || product.availability !== "AVAILABLE") {
      throw new ProductUnavailableError(product?.nameEn ?? item.productId);
    }

    let unitPriceMinor = product.basePriceMinor;
    const options: (typeof preparedItems)[number]["options"] = [];

    for (const group of product.optionGroups) {
      const selectedInGroup = group.values.filter((v) => item.optionValueIds.includes(v.id));
      if (group.required && selectedInGroup.length === 0) {
        throw new Error(`Missing required option: ${group.nameEn} for ${product.nameEn}`);
      }
      if (!group.multiSelect && selectedInGroup.length > 1) {
        throw new Error(`Only one value allowed for ${group.nameEn} on ${product.nameEn}`);
      }
      for (const value of selectedInGroup) {
        if (!value.available) throw new Error(`${value.nameEn} is no longer available`);
        unitPriceMinor += value.priceDeltaMinor;
        options.push({
          optionValueId: value.id,
          nameAr: value.nameAr,
          nameEn: value.nameEn,
          priceDeltaMinor: value.priceDeltaMinor,
        });
      }
    }

    const lineTotalMinor = unitPriceMinor * item.quantity;
    subtotalMinor += lineTotalMinor;
    maxPrepMinutes = Math.max(maxPrepMinutes, product.prepMinutes ?? restaurant.defaultPrepMinutes);

    preparedItems.push({
      productId: product.id,
      nameAr: product.nameAr,
      nameEn: product.nameEn,
      unitPriceMinor,
      quantity: item.quantity,
      lineTotalMinor,
      note: item.note,
      options,
    });
  }

  let requestedPickupAt: Date;
  if (input.pickup.mode === "ASAP") {
    requestedPickupAt = nextValidPickupSlot(
      earliestPossiblePickup(now, maxPrepMinutes),
      restaurant.slotIntervalMinutes,
      hours,
      overrides
    );
  } else {
    const requested = new Date(input.pickup.requestedAt);
    const result = validatePickupTime({
      now,
      requested,
      prepMinutes: maxPrepMinutes,
      hours,
      overrides,
      onlineOrderingPaused: false,
    });
    if (!result.valid) {
      const suggestion = nextValidPickupSlot(
        result.earliestValid,
        restaurant.slotIntervalMinutes,
        hours,
        overrides
      );
      throw new InvalidPickupTimeError(suggestion);
    }
    requestedPickupAt = requested;
  }

  const slotStart = new Date(requestedPickupAt);
  const slotCount = await prisma.order.count({
    where: {
      requestedPickupAt: slotStart,
      status: { notIn: ["CANCELLED", "REJECTED"] },
    },
  });
  if (slotCount >= restaurant.slotCapacity) {
    const suggestion = nextValidPickupSlot(
      new Date(requestedPickupAt.getTime() + restaurant.slotIntervalMinutes * 60 * 1000),
      restaurant.slotIntervalMinutes,
      hours,
      overrides
    );
    throw new SlotFullError(suggestion);
  }

  const kitchenReleaseAt = computeKitchenReleaseAt(requestedPickupAt, maxPrepMinutes);
  const initialStatus = input.payment.method === "BANK_TRANSFER" ? "PAYMENT_PENDING" : "CONFIRMED";

  const order = await prisma.$transaction(async (tx) => {
    let customer = await tx.customer.findUnique({ where: { phone: input.customer.phone } });
    if (!customer) {
      customer = await tx.customer.create({
        data: { name: input.customer.name, phone: input.customer.phone },
      });
    }

    let reference = generateReference();
    for (let attempt = 0; attempt < 5; attempt++) {
      const clash = await tx.order.findUnique({ where: { reference } });
      if (!clash) break;
      reference = generateReference();
    }

    const created = await tx.order.create({
      data: {
        reference,
        customerId: customer.id,
        guestName: input.customer.name,
        guestPhone: input.customer.phone,
        notes: input.notes,
        pickupMode: input.pickup.mode,
        requestedPickupAt,
        prepMinutes: maxPrepMinutes,
        kitchenReleaseAt,
        subtotalMinor,
        discountMinor: 0,
        totalMinor: subtotalMinor,
        currency: restaurant.currency,
        status: initialStatus,
        idempotencyKey: input.idempotencyKey,
        items: {
          create: preparedItems.map((item) => ({
            productId: item.productId,
            nameAr: item.nameAr,
            nameEn: item.nameEn,
            unitPriceMinor: item.unitPriceMinor,
            quantity: item.quantity,
            lineTotalMinor: item.lineTotalMinor,
            note: item.note,
            options: {
              create: item.options.map((o) => ({
                optionValueId: o.optionValueId,
                nameAr: o.nameAr,
                nameEn: o.nameEn,
                priceDeltaMinor: o.priceDeltaMinor,
              })),
            },
          })),
        },
        statusHistory: {
          create: [
            { toStatus: "PENDING" as const },
            { toStatus: initialStatus, fromStatus: "PENDING" as const },
          ],
        },
        payment: {
          create: {
            method: input.payment.method,
            status: input.payment.method === "BANK_TRANSFER" ? "PENDING" : "UNPAID",
            amountMinor: subtotalMinor,
            currency: restaurant.currency,
            referenceNumber:
              input.payment.method === "BANK_TRANSFER" ? input.payment.referenceNumber : null,
          },
        },
      },
      include: { items: { include: { options: true } }, payment: true },
    });

    return created;
  });

  return order;
}

export async function getOrderByTrackingToken(token: string) {
  return prisma.order.findUnique({
    where: { trackingToken: token },
    include: { items: { include: { options: true } }, payment: true, statusHistory: true },
  });
}

/**
 * Lazily promotes CONFIRMED orders whose kitchenReleaseAt has arrived to
 * QUEUED. In production this should run on a scheduled job (see
 * docs/DECISIONS.md); for the MVP it is invoked whenever staff load the
 * kitchen or admin orders views, which is sufficient for a single-location
 * pilot and keeps the system dependency-free.
 */
export async function releaseDueOrders(): Promise<number> {
  const now = new Date();
  const due = await prisma.order.findMany({
    where: { status: "CONFIRMED", kitchenReleaseAt: { lte: now } },
  });
  for (const order of due) {
    await prisma.$transaction([
      prisma.order.update({ where: { id: order.id }, data: { status: "QUEUED" } }),
      prisma.orderStatusHistory.create({
        data: { orderId: order.id, fromStatus: "CONFIRMED", toStatus: "QUEUED" },
      }),
    ]);
  }
  return due.length;
}

export function orderIsDueSoon(kitchenReleaseAt: Date, now: Date = new Date()): boolean {
  return isReadyForKitchenRelease(kitchenReleaseAt, now);
}

export type OrderWithRelations = Prisma.OrderGetPayload<{
  include: { items: { include: { options: true } }; payment: true; statusHistory: true };
}>;
