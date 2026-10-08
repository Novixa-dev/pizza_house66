import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { getReportSummary, listPaymentsForReview } from "@/server/admin-queries";

// The management report, against a real database.
//
// Every figure in the report is now aggregated by Postgres, and two of those
// aggregates are hand-written SQL that TypeScript cannot check: the
// repeat-customer rate counts customers rather than orders, and the peak-hour
// histogram buckets by hour in the restaurant's timezone. A wrong cast there
// returns a BigInt instead of a number, and a missing `AT TIME ZONE` reports a
// rush three hours off from the one the staff worked — neither of which any
// other test in the suite would notice.
//
// The fixtures sit in a fixed window in the past so they cannot collide with
// orders created by the rest of the suite, or with the seed.

const prisma = new PrismaClient();

const TAG = "report-fixture";
const DAY = "2026-03-10";
const RANGE = {
  start: new Date(`${DAY}T00:00:00.000Z`),
  end: new Date(`${DAY}T23:59:59.999Z`),
};

/** Asia/Aden is UTC+3 all year, so 20:00Z is 23:00 the same evening. */
const HOURS_AHEAD = 3;

let firstCustomerId: string;
let secondCustomerId: string;

async function cleanup() {
  await prisma.order.deleteMany({ where: { notes: TAG } });
  await prisma.customer.deleteMany({ where: { name: TAG } });
}

/** A billable-or-not order placed at a known instant, with no items. */
async function placeOrder(options: {
  at: string;
  status: "COMPLETED" | "CANCELLED" | "PREPARING";
  totalMinor: number;
  customerId: string | null;
}) {
  const at = new Date(`${DAY}T${options.at}.000Z`);
  const order = await prisma.order.create({
    data: {
      reference: `PH-RPT-${options.at.replace(/:/g, "")}`,
      trackingToken: `rpt-${options.at.replace(/:/g, "")}-${Math.random().toString(36).slice(2)}`,
      customerId: options.customerId,
      guestName: "Report Fixture",
      guestPhone: "+96777000000",
      notes: TAG,
      pickupMode: "ASAP",
      requestedPickupAt: at,
      slotStartAt: at,
      prepMinutes: 20,
      kitchenReleaseAt: at,
      subtotalMinor: options.totalMinor,
      totalMinor: options.totalMinor,
      status: options.status,
    },
  });
  // `createdAt` has a database default, so it is set in a second write rather
  // than trusted to the insert.
  await prisma.order.update({ where: { id: order.id }, data: { createdAt: at } });
  return order;
}

beforeAll(async () => {
  await cleanup();

  const first = await prisma.customer.create({
    data: { name: TAG, phone: "+96777000001" },
  });
  const second = await prisma.customer.create({
    data: { name: TAG, phone: "+96777000002" },
  });
  firstCustomerId = first.id;
  secondCustomerId = second.id;

  // Two billable orders for one customer, so they count as a repeat.
  await placeOrder({ at: "20:00:00", status: "COMPLETED", totalMinor: 10_000, customerId: firstCustomerId });
  await placeOrder({ at: "22:30:00", status: "COMPLETED", totalMinor: 6_000, customerId: firstCustomerId });
  // One cancelled and one billable for the second customer: the cancellation
  // must not make them a repeat customer, nor count towards takings.
  await placeOrder({ at: "20:30:00", status: "CANCELLED", totalMinor: 99_999, customerId: secondCustomerId });
  await placeOrder({ at: "21:00:00", status: "PREPARING", totalMinor: 4_000, customerId: secondCustomerId });
  // A guest order, which has takings but no customer to be repeat.
  await placeOrder({ at: "20:10:00", status: "COMPLETED", totalMinor: 2_000, customerId: null });
});

afterAll(async () => {
  await cleanup();
  await prisma.$disconnect();
});

describe("getReportSummary", () => {
  it("counts every order in the window but only bills the ones that stood", async () => {
    const summary = await getReportSummary(RANGE);

    expect(summary.orders).toBe(5);
    expect(summary.revenueMinor).toBe(22_000);
    expect(summary.avgOrderValueMinor).toBe(5_500);
  });

  it("rates completion and cancellation against every order, not the billable ones", async () => {
    const summary = await getReportSummary(RANGE);

    expect(summary.completionRate).toBeCloseTo(3 / 5, 10);
    expect(summary.cancellationRate).toBeCloseTo(1 / 5, 10);
  });

  it("measures repeat customers per customer, ignoring guests and cancellations", async () => {
    const summary = await getReportSummary(RANGE);

    // Two identified customers placed a billable order; one of them twice.
    expect(summary.repeatCustomerRate).toBeCloseTo(1 / 2, 10);
  });

  it("buckets peak hours in the restaurant's timezone, not the server's", async () => {
    const summary = await getReportSummary(RANGE);

    // 20:00Z and 20:10Z are both 23:xx in Al Mukalla; 21:00Z and 22:30Z have
    // already rolled past local midnight. A UTC histogram would report
    // 20, 21 and 22 instead.
    expect(summary.peakHours).toEqual([
      { hour: (21 + HOURS_AHEAD) % 24, count: 1 },
      { hour: (22 + HOURS_AHEAD) % 24, count: 1 },
      { hour: (20 + HOURS_AHEAD) % 24, count: 2 },
    ]);
  });

  it("returns numbers from the hand-written aggregates, not BigInts", async () => {
    const summary = await getReportSummary(RANGE);

    // `count(*)` is a bigint in Postgres. Without the casts in the SQL these
    // arrive as BigInt, which serializes to a crash in a server component
    // rather than to a number.
    for (const bucket of summary.peakHours) {
      expect(typeof bucket.hour).toBe("number");
      expect(typeof bucket.count).toBe("number");
    }
    expect(Number.isFinite(summary.repeatCustomerRate)).toBe(true);
  });

  it("reports an empty window as zeroes rather than NaN", async () => {
    const summary = await getReportSummary({
      start: new Date("2025-01-01T00:00:00.000Z"),
      end: new Date("2025-01-02T00:00:00.000Z"),
    });

    expect(summary.orders).toBe(0);
    expect(summary.revenueMinor).toBe(0);
    expect(summary.avgOrderValueMinor).toBe(0);
    expect(summary.completionRate).toBe(0);
    expect(summary.cancellationRate).toBe(0);
    expect(summary.repeatCustomerRate).toBe(0);
    expect(summary.peakHours).toEqual([]);
  });
});

describe("listPaymentsForReview", () => {
  it("caps the queue and says how many are behind the cap", async () => {
    const orders = await Promise.all([
      placeOrder({ at: "08:00:00", status: "PREPARING", totalMinor: 1_000, customerId: null }),
      placeOrder({ at: "09:00:00", status: "PREPARING", totalMinor: 2_000, customerId: null }),
      placeOrder({ at: "10:00:00", status: "PREPARING", totalMinor: 3_000, customerId: null }),
    ]);
    for (const order of orders) {
      await prisma.payment.create({
        data: {
          orderId: order.id,
          method: "BANK_TRANSFER",
          status: "PENDING",
          amountMinor: order.totalMinor,
        },
      });
    }

    const capped = await listPaymentsForReview(2);

    expect(capped.payments).toHaveLength(2);
    expect(capped.waiting).toBeGreaterThanOrEqual(3);
    expect(capped.hidden).toBe(capped.waiting - 2);

    // Oldest first: a cap that returned the newest would hide exactly the
    // transfers that have waited longest.
    const createdAt = capped.payments.map((payment) => payment.createdAt.getTime());
    expect([...createdAt].sort((a, b) => a - b)).toEqual(createdAt);
  });
});
