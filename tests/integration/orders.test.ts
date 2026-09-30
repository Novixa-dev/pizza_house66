import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import {
  BelowMinimumOrderError,
  createOrder,
  getAvailablePickupSlots,
  getOrderByTrackingToken,
  InvalidOptionsError,
  InvalidPickupTimeError,
  OrderingPausedError,
  ProductUnavailableError,
  releaseDueOrders,
  SlotFullError,
} from "@/server/orders";
import { getAttentionQueue, getDashboardSnapshot } from "@/server/admin-queries";
import type { CreateOrderInput } from "@/server/order-schema";

// Integration tests against a real PostgreSQL database (docs/PRD.md §72.2).
//
// These cover the claims that a unit test physically cannot: that the server
// is the authority on price, that a duplicate submission produces one order,
// that capacity is enforced under a transaction, and that a scheduled order
// stays out of the kitchen until its time. Every one of them is a rule the
// brief states explicitly, and every one of them is only true if the database
// behaves as assumed.
//
// Requires DATABASE_URL and a migrated, seeded schema — see docs/TESTING.md.

const prisma = new PrismaClient();

const TEST_PHONE_PREFIX = "+96777700";
let pizzaId: string;
let sizeValueId: string;
let crustValueId: string;
let extraCheeseId: string;
let restaurantId: string;

/** Removes only rows this suite created. */
async function cleanup() {
  // Analytics rows first. AnalyticsEvent.orderId is a plain column, not a
  // foreign key, so an order's events survive the order — deliberate for a
  // production history, and a slow leak in a test database.
  const mine = await prisma.order.findMany({
    where: { guestPhone: { startsWith: TEST_PHONE_PREFIX } },
    select: { id: true },
  });
  if (mine.length > 0) {
    await prisma.analyticsEvent.deleteMany({
      where: { orderId: { in: mine.map((order) => order.id) } },
    });
  }

  await prisma.order.deleteMany({ where: { guestPhone: { startsWith: TEST_PHONE_PREFIX } } });
  await prisma.customer.deleteMany({
    where: { phone: { startsWith: TEST_PHONE_PREFIX }, orders: { none: {} } },
  });
}

function orderInput(overrides: Partial<CreateOrderInput> = {}): CreateOrderInput {
  return {
    idempotencyKey: `it-${Math.random().toString(36).slice(2)}-${Date.now()}`,
    items: [{ productId: pizzaId, quantity: 1, optionValueIds: [sizeValueId, crustValueId] }],
    customer: { name: "Integration Test", phone: `${TEST_PHONE_PREFIX}01` },
    pickup: { mode: "ASAP" },
    payment: { method: "PAY_AT_PICKUP" },
    ...overrides,
  };
}

beforeAll(async () => {
  const restaurant = await prisma.restaurant.findFirstOrThrow();
  restaurantId = restaurant.id;

  const pizza = await prisma.product.findFirstOrThrow({
    where: { slug: "margherita" },
    include: { optionGroups: { include: { values: true }, orderBy: { sortOrder: "asc" } } },
  });
  pizzaId = pizza.id;

  const sizeGroup = pizza.optionGroups.find((g) => g.nameEn === "Size")!;
  const crustGroup = pizza.optionGroups.find((g) => g.nameEn === "Crust")!;
  const extrasGroup = pizza.optionGroups.find((g) => g.nameEn === "Extras")!;
  sizeValueId = sizeGroup.values.find((v) => v.nameEn === "Small")!.id;
  crustValueId = crustGroup.values.find((v) => v.nameEn === "Classic")!.id;
  extraCheeseId = extrasGroup.values.find((v) => v.nameEn === "Extra cheese")!.id;
});

beforeEach(cleanup);

afterAll(async () => {
  await cleanup();
  // Leave the restaurant as the suite found it.
  await prisma.restaurant.update({
    where: { id: restaurantId },
    data: { onlineOrderingPaused: false, minOrderMinor: 0 },
  });
  await prisma.product.update({ where: { id: pizzaId }, data: { availability: "AVAILABLE" } });
  await prisma.$disconnect();
});

describe("createOrder — server-authoritative pricing", () => {
  it("prices the order from the database, not the request", async () => {
    const product = await prisma.product.findUniqueOrThrow({ where: { id: pizzaId } });
    const order = await createOrder(orderInput());

    expect(order.subtotalMinor).toBe(product.basePriceMinor);
    expect(order.totalMinor).toBe(product.basePriceMinor);
    expect(order.items[0].unitPriceMinor).toBe(product.basePriceMinor);
  });

  it("adds paid option deltas from the database", async () => {
    const [product, extra] = await Promise.all([
      prisma.product.findUniqueOrThrow({ where: { id: pizzaId } }),
      prisma.productOptionValue.findUniqueOrThrow({ where: { id: extraCheeseId } }),
    ]);

    const order = await createOrder(
      orderInput({
        items: [
          {
            productId: pizzaId,
            quantity: 2,
            optionValueIds: [sizeValueId, crustValueId, extraCheeseId],
          },
        ],
      })
    );

    const expectedUnit = product.basePriceMinor + extra.priceDeltaMinor;
    expect(order.items[0].unitPriceMinor).toBe(expectedUnit);
    expect(order.items[0].lineTotalMinor).toBe(expectedUnit * 2);
    expect(order.totalMinor).toBe(expectedUnit * 2);
  });

  it("snapshots name and price so later catalog edits never rewrite history", async () => {
    // docs/PRD.md §44: a price change must not alter a past order.
    const before = await prisma.product.findUniqueOrThrow({ where: { id: pizzaId } });
    const order = await createOrder(orderInput());

    await prisma.product.update({
      where: { id: pizzaId },
      data: { basePriceMinor: before.basePriceMinor + 1000, nameEn: "Renamed Pizza" },
    });

    const reloaded = await prisma.order.findUniqueOrThrow({
      where: { id: order.id },
      include: { items: true },
    });
    expect(reloaded.totalMinor).toBe(before.basePriceMinor);
    expect(reloaded.items[0].nameEn).toBe(before.nameEn);

    await prisma.product.update({
      where: { id: pizzaId },
      data: { basePriceMinor: before.basePriceMinor, nameEn: before.nameEn },
    });
  });

  it("rejects an option that does not belong to the product", async () => {
    const foreign = await prisma.productOptionValue.findFirstOrThrow({
      where: { group: { productId: { not: pizzaId } } },
    });
    await expect(
      createOrder(
        orderInput({
          items: [
            {
              productId: pizzaId,
              quantity: 1,
              optionValueIds: [sizeValueId, crustValueId, foreign.id],
            },
          ],
        })
      )
    ).rejects.toBeInstanceOf(InvalidOptionsError);
  });

  it("rejects a missing required option", async () => {
    await expect(
      createOrder(
        orderInput({ items: [{ productId: pizzaId, quantity: 1, optionValueIds: [] }] })
      )
    ).rejects.toBeInstanceOf(InvalidOptionsError);
  });

  it("rejects two values from the same single-select group", async () => {
    const pizza = await prisma.product.findUniqueOrThrow({
      where: { id: pizzaId },
      include: { optionGroups: { include: { values: true } } },
    });
    const size = pizza.optionGroups.find((g) => g.nameEn === "Size")!;
    await expect(
      createOrder(
        orderInput({
          items: [
            {
              productId: pizzaId,
              quantity: 1,
              optionValueIds: [size.values[0].id, size.values[1].id, crustValueId],
            },
          ],
        })
      )
    ).rejects.toBeInstanceOf(InvalidOptionsError);
  });
});

describe("createOrder — availability", () => {
  it("refuses a sold-out product", async () => {
    // docs/PRD.md §92.E
    await prisma.product.update({ where: { id: pizzaId }, data: { availability: "SOLD_OUT" } });
    try {
      await expect(createOrder(orderInput())).rejects.toBeInstanceOf(ProductUnavailableError);
    } finally {
      await prisma.product.update({ where: { id: pizzaId }, data: { availability: "AVAILABLE" } });
    }
  });

  it("refuses a hidden product", async () => {
    await prisma.product.update({ where: { id: pizzaId }, data: { availability: "HIDDEN" } });
    try {
      await expect(createOrder(orderInput())).rejects.toBeInstanceOf(ProductUnavailableError);
    } finally {
      await prisma.product.update({ where: { id: pizzaId }, data: { availability: "AVAILABLE" } });
    }
  });

  it("refuses every order while online ordering is paused", async () => {
    // docs/PRD.md §92.F
    await prisma.restaurant.update({
      where: { id: restaurantId },
      data: { onlineOrderingPaused: true },
    });
    try {
      await expect(createOrder(orderInput())).rejects.toBeInstanceOf(OrderingPausedError);
    } finally {
      await prisma.restaurant.update({
        where: { id: restaurantId },
        data: { onlineOrderingPaused: false },
      });
    }
  });

  it("refuses an order below the restaurant minimum", async () => {
    await prisma.restaurant.update({
      where: { id: restaurantId },
      data: { minOrderMinor: 999_999 },
    });
    try {
      await expect(createOrder(orderInput())).rejects.toBeInstanceOf(BelowMinimumOrderError);
    } finally {
      await prisma.restaurant.update({ where: { id: restaurantId }, data: { minOrderMinor: 0 } });
    }
  });
});

describe("createOrder — idempotency", () => {
  it("returns the original order for a repeated key instead of creating a second", async () => {
    // docs/PRD.md §45, §92.I — a double-clicked "Place order".
    const input = orderInput();
    const first = await createOrder(input);
    const second = await createOrder(input);

    expect(second.id).toBe(first.id);
    expect(second.reference).toBe(first.reference);

    const count = await prisma.order.count({ where: { idempotencyKey: input.idempotencyKey } });
    expect(count).toBe(1);
  });

  it("creates exactly one order when the same key is submitted concurrently", async () => {
    const input = orderInput();
    const results = await Promise.allSettled([
      createOrder(input),
      createOrder(input),
      createOrder(input),
    ]);

    const succeeded = results.filter((r) => r.status === "fulfilled");
    expect(succeeded.length).toBeGreaterThan(0);

    const count = await prisma.order.count({ where: { idempotencyKey: input.idempotencyKey } });
    expect(count).toBe(1);
  });
});

describe("createOrder — scheduling", () => {
  it("computes kitchen release as pickup minus preparation time", async () => {
    const order = await createOrder(orderInput());
    const expected = order.requestedPickupAt.getTime() - order.prepMinutes * 60_000;
    expect(order.kitchenReleaseAt.getTime()).toBe(expected);
  });

  it("does not queue a scheduled order for the kitchen before its release time", async () => {
    // docs/PRD.md §92.D — the core promise of the product.
    const slots = await getAvailablePickupSlots();
    // Pick a slot comfortably in the future so release has not arrived.
    const future = slots.find((slot) => slot.at.getTime() > Date.now() + 3 * 3600_000);
    if (!future) return; // restaurant closes too soon today to test this

    const order = await createOrder(
      orderInput({ pickup: { mode: "SCHEDULED", requestedAt: future.at.toISOString() } })
    );
    expect(order.status).toBe("CONFIRMED");

    await releaseDueOrders();
    const after = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(after.status).toBe("CONFIRMED");
    expect(after.queuedAt).toBeNull();
  });

  it("queues an order once its kitchen-release time has passed", async () => {
    const order = await createOrder(orderInput());
    // Move the release into the past, as the clock would.
    await prisma.order.update({
      where: { id: order.id },
      data: { status: "CONFIRMED", kitchenReleaseAt: new Date(Date.now() - 60_000) },
    });

    const released = await releaseDueOrders();
    expect(released).toBeGreaterThanOrEqual(1);

    const after = await prisma.order.findUniqueOrThrow({
      where: { id: order.id },
      include: { statusHistory: true },
    });
    expect(after.status).toBe("QUEUED");
    expect(after.queuedAt).not.toBeNull();
    expect(after.statusHistory.some((h) => h.toStatus === "QUEUED")).toBe(true);
  });

  it("is safe to run the release job twice", async () => {
    const order = await createOrder(orderInput());
    await prisma.order.update({
      where: { id: order.id },
      data: { status: "CONFIRMED", kitchenReleaseAt: new Date(Date.now() - 60_000) },
    });

    await releaseDueOrders();
    await releaseDueOrders();

    const history = await prisma.orderStatusHistory.count({
      where: { orderId: order.id, toStatus: "QUEUED" },
    });
    expect(history).toBe(1);
  });

  it("rejects a pickup time that is not on a slot boundary", async () => {
    const slots = await getAvailablePickupSlots();
    if (slots.length === 0) return;
    const offBoundary = new Date(slots[0].at.getTime() + 7 * 60_000);

    await expect(
      createOrder(
        orderInput({ pickup: { mode: "SCHEDULED", requestedAt: offBoundary.toISOString() } })
      )
    ).rejects.toBeInstanceOf(InvalidPickupTimeError);
  });

  it("rejects a pickup time in the past", async () => {
    await expect(
      createOrder(
        orderInput({
          pickup: { mode: "SCHEDULED", requestedAt: new Date(Date.now() - 3600_000).toISOString() },
        })
      )
    ).rejects.toBeInstanceOf(InvalidPickupTimeError);
  });
});

describe("createOrder — capacity", () => {
  it("refuses a scheduled slot that is already full", async () => {
    const restaurant = await prisma.restaurant.findUniqueOrThrow({ where: { id: restaurantId } });
    const slots = await getAvailablePickupSlots();
    const target = slots.find((slot) => slot.remaining === restaurant.slotCapacity);
    if (!target) return;

    for (let i = 0; i < restaurant.slotCapacity; i++) {
      await createOrder(
        orderInput({
          customer: { name: `Capacity ${i}`, phone: `${TEST_PHONE_PREFIX}${String(i).padStart(2, "0")}` },
          pickup: { mode: "SCHEDULED", requestedAt: target.at.toISOString() },
        })
      );
    }

    await expect(
      createOrder(
        orderInput({ pickup: { mode: "SCHEDULED", requestedAt: target.at.toISOString() } })
      )
    ).rejects.toBeInstanceOf(SlotFullError);
  }, 60_000);

  it("rolls an ASAP order forward instead of failing when a slot is full", async () => {
    // "As soon as possible" means the earliest slot that can take the order.
    // Telling the customer "that time is full, pick another" when they never
    // picked a time would be nonsense.
    const restaurant = await prisma.restaurant.findUniqueOrThrow({ where: { id: restaurantId } });
    const slots = await getAvailablePickupSlots();
    const first = slots[0];
    if (!first || slots.length < 2) return;

    for (let i = 0; i < first.remaining; i++) {
      await createOrder(
        orderInput({
          customer: { name: `Fill ${i}`, phone: `${TEST_PHONE_PREFIX}9${String(i).padStart(2, "0")}` },
          pickup: { mode: "SCHEDULED", requestedAt: first.at.toISOString() },
        })
      );
    }

    const rolled = await createOrder(orderInput());
    expect(rolled.requestedPickupAt.getTime()).toBeGreaterThan(first.at.getTime());
    void restaurant;
  }, 60_000);
});

describe("order tracking tokens", () => {
  it("issues a long, unguessable token distinct from the reference", async () => {
    // docs/PRD.md §41 — the reference must not be a capability.
    const order = await createOrder(orderInput());
    expect(order.trackingToken.length).toBeGreaterThanOrEqual(32);
    expect(order.trackingToken).not.toContain(order.reference);
  });

  it("returns nothing for an unknown token", async () => {
    expect(await getOrderByTrackingToken("a".repeat(43))).toBeNull();
  });

  it("returns nothing for an obviously malformed token without querying", async () => {
    expect(await getOrderByTrackingToken("short")).toBeNull();
  });

  it("finds the order for its own token", async () => {
    const order = await createOrder(orderInput());
    const found = await getOrderByTrackingToken(order.trackingToken);
    expect(found?.id).toBe(order.id);
  });
});

describe("the dashboard's attention queue", () => {
  /** Puts an order into a lane directly — the transitions are covered elsewhere. */
  async function place(status: "QUEUED" | "PREPARING", kitchenReleaseAt: Date) {
    const order = await createOrder(orderInput());
    return prisma.order.update({
      where: { id: order.id },
      data: { status, kitchenReleaseAt },
    });
  }

  const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60 * 1000);

  it("flags an order the kitchen was given but nobody started", async () => {
    // The bug this covers: the dashboard said "nothing needs attention"
    // while ten orders had been sitting in the kitchen queue for five days.
    const stalled = await place("QUEUED", minutesAgo(45));

    const queue = await getAttentionQueue(50);
    expect(queue.map((order) => order.id)).toContain(stalled.id);
  });

  it("leaves an order alone that was only just handed to the kitchen", async () => {
    // Otherwise every order would flag itself the moment it was released,
    // and a panel that always has something in it says nothing.
    const fresh = await place("QUEUED", minutesAgo(1));

    const queue = await getAttentionQueue(50);
    expect(queue.map((order) => order.id)).not.toContain(fresh.id);
  });

  it("leaves an order alone once the kitchen has started it", async () => {
    const started = await place("PREPARING", minutesAgo(45));

    const queue = await getAttentionQueue(50);
    expect(queue.map((order) => order.id)).not.toContain(started.id);
  });

  it("counts a queued order as work the kitchen still owes", async () => {
    // The tile read 0 while the queue was full, so the row of counters said
    // the restaurant was idle when it was behind.
    const before = await getDashboardSnapshot();
    await place("QUEUED", minutesAgo(45));
    const after = await getDashboardSnapshot();

    expect(after.queued).toBe(before.queued + 1);
    expect(after.queued + after.preparing).toBe(before.queued + before.preparing + 1);
  });
});
