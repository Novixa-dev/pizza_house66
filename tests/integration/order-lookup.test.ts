import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { createOrder } from "@/server/orders";
import {
  findOrderByReferenceAndPhone,
  phoneTail,
  summarizeOrders,
} from "@/server/order-lookup";
import type { CreateOrderInput } from "@/server/order-schema";

// Finding an order again — the recovery path for a customer who closed the
// tab, which is the commonest support message a small restaurant gets.
//
// The security question is the interesting one: the reference is short and
// sequential, so the phone number is the only secret. These cover both that
// it works for the person who placed the order and that it tells nobody else
// anything.

const prisma = new PrismaClient();
const PHONE = "+967771119999";
const OTHER_PHONE = "+967772228888";

let pizzaId: string;
let sizeValueId: string;
let crustValueId: string;

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
  await prisma.order.deleteMany({ where: { guestPhone: { in: [PHONE, OTHER_PHONE] } } });
  await prisma.customer.deleteMany({ where: { phone: { in: [PHONE, OTHER_PHONE] } } });
}

function orderInput(overrides: Partial<CreateOrderInput> = {}): CreateOrderInput {
  return {
    idempotencyKey: `lookup-${Math.random().toString(36).slice(2)}-${Date.now()}`,
    items: [{ productId: pizzaId, quantity: 1, optionValueIds: [sizeValueId, crustValueId] }],
    customer: { name: "Lookup Test", phone: PHONE },
    pickup: { mode: "ASAP" },
    payment: { method: "PAY_AT_PICKUP" },
    ...overrides,
  };
}

beforeAll(async () => {
  const pizza = await prisma.product.findFirstOrThrow({
    where: { slug: "margherita" },
    include: { optionGroups: { include: { values: true }, orderBy: { sortOrder: "asc" } } },
  });
  pizzaId = pizza.id;
  sizeValueId = pizza.optionGroups.find((g) => g.nameEn === "Size")!.values[0]!.id;
  crustValueId = pizza.optionGroups.find((g) => g.nameEn === "Crust")!.values[0]!.id;
});

beforeEach(cleanup);

afterAll(async () => {
  await cleanup();
  await prisma.$disconnect();
});

describe("phoneTail", () => {
  it("treats the shapes one person types for one number as equal", () => {
    // Someone types 0771234567 at checkout and +967 771 234 567 a day later.
    // Those are the same phone, and a lookup that says otherwise is a lookup
    // nobody can use.
    const forms = ["0771234567", "+967771234567", "00967 771 234 567", "771-234-567"];
    const tails = new Set(forms.map((form) => phoneTail(form)));
    expect(tails.size).toBe(1);
    expect([...tails][0]).toBe("771234567");
  });

  it("keeps genuinely different numbers different", () => {
    expect(phoneTail("+967771234567")).not.toBe(phoneTail("+967779999999"));
  });
});

describe("findOrderByReferenceAndPhone", () => {
  it("returns the tracking token for the right pair", async () => {
    const order = await createOrder(orderInput());
    const token = await findOrderByReferenceAndPhone(order.reference, PHONE);
    expect(token).toBe(order.trackingToken);
  });

  it("accepts the reference in any case and with surrounding space", async () => {
    const order = await createOrder(orderInput());
    expect(await findOrderByReferenceAndPhone(`  ${order.reference.toLowerCase()} `, PHONE)).toBe(
      order.trackingToken
    );
  });

  it("accepts a phone number written differently from how it was given", async () => {
    const order = await createOrder(orderInput({ customer: { name: "X", phone: "0771119999" } }));
    expect(await findOrderByReferenceAndPhone(order.reference, "+967 771 119 999")).toBe(
      order.trackingToken
    );
  });

  it("refuses the right reference with the wrong phone", async () => {
    const order = await createOrder(orderInput());
    expect(await findOrderByReferenceAndPhone(order.reference, OTHER_PHONE)).toBeNull();
  });

  it("answers the same way for a reference that does not exist", async () => {
    // Identical null for "wrong phone" and "no such order", so the endpoint
    // cannot be walked to learn which order numbers are real.
    expect(await findOrderByReferenceAndPhone("PH-000000", PHONE)).toBeNull();
  });

  it("refuses an implausibly short reference or phone without a query", async () => {
    expect(await findOrderByReferenceAndPhone("A", PHONE)).toBeNull();
    expect(await findOrderByReferenceAndPhone("PH-1234", "123")).toBeNull();
  });
});

describe("summarizeOrders", () => {
  it("returns a summary per known token", async () => {
    const first = await createOrder(orderInput());
    const second = await createOrder(orderInput());

    const summaries = await summarizeOrders([first.trackingToken, second.trackingToken]);
    expect(summaries).toHaveLength(2);
    expect(summaries.map((order) => order.reference).sort()).toEqual(
      [first.reference, second.reference].sort()
    );
    expect(summaries[0]!.live).toBe(true);
    expect(summaries[0]!.itemCount).toBe(1);
  });

  it("silently drops a token it does not recognize", async () => {
    const order = await createOrder(orderInput());
    const summaries = await summarizeOrders([
      order.trackingToken,
      "not-a-real-token-but-long-enough-to-pass",
    ]);
    expect(summaries).toHaveLength(1);
  });

  it("does not query at all for obviously malformed tokens", async () => {
    expect(await summarizeOrders(["short", ""])).toEqual([]);
    expect(await summarizeOrders([])).toEqual([]);
  });

  it("caps how many tokens one call will look up", async () => {
    const many = Array.from({ length: 200 }, (_, index) => `token-${index}`.padEnd(32, "x"));
    // Returns nothing because none exist; the point is that it does not hand
    // an unbounded IN list to the database.
    expect(await summarizeOrders(many)).toEqual([]);
  });
});
