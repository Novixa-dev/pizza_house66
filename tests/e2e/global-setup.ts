import { PrismaClient } from "@prisma/client";

/**
 * Clears orders left behind by previous end-to-end runs.
 *
 * Without this the suite is not reproducible: every run books real pickup
 * slots, and once a slot hits the restaurant's capacity the next run fails
 * with SLOT_FULL for reasons that have nothing to do with the code. Only
 * rows this suite created are removed — they are identifiable by the marker
 * phone prefix every E2E customer uses — so running it against a database
 * with real orders in it cannot destroy them.
 */

export const E2E_PHONE_PREFIX = "+96779900";
export const E2E_NAME_PREFIX = "E2E ";

export default async function globalSetup() {
  const prisma = new PrismaClient();
  try {
    const orders = await prisma.order.findMany({
      where: { guestPhone: { startsWith: E2E_PHONE_PREFIX } },
      select: { id: true, customerId: true },
    });
    if (orders.length === 0) return;

    const orderIds = orders.map((order) => order.id);
    // Cascades handle items, options, payments, receipts and history.
    await prisma.order.deleteMany({ where: { id: { in: orderIds } } });

    // Remove the synthetic customers too, but only the ones with no orders
    // left — a real customer who happens to share a phone is not possible
    // here, since the prefix is reserved for tests.
    await prisma.customer.deleteMany({
      where: { phone: { startsWith: E2E_PHONE_PREFIX }, orders: { none: {} } },
    });

    console.log(`[e2e] cleared ${orderIds.length} order(s) from a previous run`);
  } finally {
    await prisma.$disconnect();
  }
}
