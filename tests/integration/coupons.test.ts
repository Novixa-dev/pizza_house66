import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { createOrder, previewPromotion, resolvePromoCode } from "@/server/orders";
import { transitionOrder } from "@/server/order-transitions";
import { couponsForPhone, loyaltyStandingForPhone } from "@/server/coupons";
import { LOYALTY_MILESTONE, LOYALTY_PROMOTION_CODE } from "@/lib/loyalty";
import type { CreateOrderInput } from "@/server/order-schema";

// Coupons, per-customer limits and the loyalty cycle, against a real database.
//
// These are the rules that decide what a customer is charged, so a unit test
// on the pricing function is not enough: the questions here are "does the cap
// survive a second order", "can a coupon be spent twice", and "does the fifth
// completion actually issue one". All three are database questions.

const prisma = new PrismaClient();
const PHONE = "+96777701234";
const OTHER_PHONE = "+96777705678";

let pizzaId: string;
let sizeValueId: string;
let crustValueId: string;
let ownerActor: { id: string; name: string; role: "OWNER" };

async function cleanup() {
  const mine = await prisma.order.findMany({
    where: { guestPhone: { in: [PHONE, OTHER_PHONE] } },
    select: { id: true },
  });
  if (mine.length > 0) {
    await prisma.analyticsEvent.deleteMany({
      where: { orderId: { in: mine.map((order) => order.id) } },
    });
  }
  await prisma.couponGrant.deleteMany({
    where: { customer: { phone: { in: [PHONE, OTHER_PHONE] } } },
  });
  await prisma.order.deleteMany({ where: { guestPhone: { in: [PHONE, OTHER_PHONE] } } });
  await prisma.customer.deleteMany({ where: { phone: { in: [PHONE, OTHER_PHONE] } } });
  await prisma.promotion.updateMany({
    where: { code: { in: ["WELCOME", LOYALTY_PROMOTION_CODE] } },
    data: { usageCount: 0 },
  });
}

function orderInput(overrides: Partial<CreateOrderInput> = {}): CreateOrderInput {
  return {
    idempotencyKey: `coupon-${Math.random().toString(36).slice(2)}-${Date.now()}`,
    items: [{ productId: pizzaId, quantity: 2, optionValueIds: [sizeValueId, crustValueId] }],
    customer: { name: "Coupon Test", phone: PHONE },
    pickup: { mode: "ASAP" },
    payment: { method: "PAY_AT_PICKUP" },
    ...overrides,
  };
}

/** Walks an order through the real state machine to COMPLETED. */
async function complete(orderId: string) {
  for (const next of ["QUEUED", "PREPARING", "READY", "COMPLETED"] as const) {
    await transitionOrder(orderId, next, ownerActor);
  }
}

beforeAll(async () => {
  const pizza = await prisma.product.findFirstOrThrow({
    where: { slug: "margherita" },
    include: { optionGroups: { include: { values: true }, orderBy: { sortOrder: "asc" } } },
  });
  pizzaId = pizza.id;
  sizeValueId = pizza.optionGroups.find((g) => g.nameEn === "Size")!.values[0]!.id;
  crustValueId = pizza.optionGroups.find((g) => g.nameEn === "Crust")!.values[0]!.id;

  const owner = await prisma.user.findFirstOrThrow({ where: { role: "OWNER" } });
  ownerActor = { id: owner.id, name: owner.name, role: "OWNER" };
});

beforeEach(cleanup);

afterAll(async () => {
  await cleanup();
  await prisma.$disconnect();
});

describe("public coupon codes", () => {
  it("discounts an order and records which promotion paid for it", async () => {
    const order = await createOrder(orderInput({ promoCode: "WELCOME" }));
    expect(order.discountMinor).toBeGreaterThan(0);
    expect(order.promoCode).toBe("WELCOME");
    expect(order.totalMinor).toBe(order.subtotalMinor - order.discountMinor);
  });

  it("holds a once-per-customer code to once per customer", async () => {
    await createOrder(orderInput({ promoCode: "WELCOME" }));

    const second = await createOrder(orderInput({ promoCode: "WELCOME" }));
    // The order still goes through — an exhausted code is not a reason to
    // refuse someone's dinner — it simply is not discounted.
    expect(second.discountMinor).toBe(0);
    expect(second.promoCode).toBeNull();
  });

  it("caps by customer, not globally", async () => {
    await createOrder(orderInput({ promoCode: "WELCOME" }));

    const other = await createOrder(
      orderInput({
        promoCode: "WELCOME",
        customer: { name: "Someone Else", phone: OTHER_PHONE },
      })
    );
    expect(other.discountMinor).toBeGreaterThan(0);
  });

  it("does not count a cancelled order against the cap", async () => {
    const first = await createOrder(orderInput({ promoCode: "WELCOME" }));
    await transitionOrder(first.id, "CANCELLED", ownerActor);

    const second = await createOrder(orderInput({ promoCode: "WELCOME" }));
    expect(second.discountMinor).toBeGreaterThan(0);
  });

  it("refuses the loyalty template's own code, whoever asks", async () => {
    const preview = await previewPromotion(
      LOYALTY_PROMOTION_CODE,
      orderInput().items,
      PHONE
    );
    expect(preview.valid).toBe(false);
    // Reported as not-found rather than "that is a template", so the code
    // cannot be confirmed to exist.
    expect(preview.reasonCode).toBe("NOT_FOUND");
  });

  it("asks for a phone number before promising a capped discount", async () => {
    const preview = await previewPromotion("WELCOME", orderInput().items, null);
    expect(preview.reasonCode).toBe("NEEDS_PHONE");
  });
});

describe("the loyalty cycle", () => {
  it("issues a coupon on the fifth completed order and not before", async () => {
    for (let index = 1; index <= LOYALTY_MILESTONE; index += 1) {
      const order = await createOrder(orderInput());
      await complete(order.id);

      const grants = await couponsForPhone(PHONE);
      if (index < LOYALTY_MILESTONE) {
        expect(grants, `after ${index} completed orders`).toHaveLength(0);
      } else {
        expect(grants, `after ${index} completed orders`).toHaveLength(1);
        expect(grants[0]!.milestone).toBe(LOYALTY_MILESTONE);
        expect(grants[0]!.expiresAt).toBeInstanceOf(Date);
      }
    }
  });

  it("counts only orders that were actually collected", async () => {
    const cancelled = await createOrder(orderInput());
    await transitionOrder(cancelled.id, "CANCELLED", ownerActor);

    const standing = await loyaltyStandingForPhone(PHONE);
    expect(standing?.completed).toBe(0);
  });

  it("reports how far along a customer is", async () => {
    const order = await createOrder(orderInput());
    await complete(order.id);

    const standing = await loyaltyStandingForPhone(PHONE);
    expect(standing).toEqual({
      completed: 1,
      towardsNext: 1,
      remaining: LOYALTY_MILESTONE - 1,
      nextMilestone: LOYALTY_MILESTONE,
      milestone: LOYALTY_MILESTONE,
    });
  });
});

describe("an issued coupon", () => {
  async function earnCoupon(): Promise<string> {
    for (let index = 0; index < LOYALTY_MILESTONE; index += 1) {
      const order = await createOrder(orderInput());
      await complete(order.id);
    }
    const [grant] = await couponsForPhone(PHONE);
    return grant!.code;
  }

  it("works for the customer it was issued to", async () => {
    const code = await earnCoupon();
    const order = await createOrder(orderInput({ promoCode: code }));
    expect(order.discountMinor).toBe(1000);
  });

  it("does not work for anybody else", async () => {
    const code = await earnCoupon();
    const { resolved, reasonCode } = await resolvePromoCode(code, OTHER_PHONE);
    expect(resolved).toBeNull();
    expect(reasonCode).toBe("NOT_YOURS");
  });

  it("cannot be spent twice", async () => {
    const code = await earnCoupon();
    const first = await createOrder(orderInput({ promoCode: code }));
    expect(first.discountMinor).toBe(1000);

    const second = await createOrder(orderInput({ promoCode: code }));
    expect(second.discountMinor).toBe(0);

    const { reasonCode } = await resolvePromoCode(code, PHONE);
    expect(reasonCode).toBe("ALREADY_USED");
  });

  it("records which order spent it", async () => {
    const code = await earnCoupon();
    const order = await createOrder(orderInput({ promoCode: code }));

    const grant = await prisma.couponGrant.findUniqueOrThrow({ where: { code } });
    expect(grant.redeemedOrderId).toBe(order.id);
    expect(grant.redeemedAt).toBeInstanceOf(Date);
  });

  it("is refused once it has expired", async () => {
    const code = await earnCoupon();
    await prisma.couponGrant.update({
      where: { code },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    const { resolved, reasonCode } = await resolvePromoCode(code, PHONE);
    expect(resolved).toBeNull();
    expect(reasonCode).toBe("EXPIRED");
  });
});
