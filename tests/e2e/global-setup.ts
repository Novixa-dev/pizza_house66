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

/** Removes analytics rows pointing at orders that are gone. Returns the count. */
async function clearOrphanedAnalytics(prisma: PrismaClient): Promise<number> {
  const withOrder = await prisma.analyticsEvent.findMany({
    where: { NOT: { orderId: null } },
    select: { id: true, orderId: true },
  });
  if (withOrder.length === 0) return 0;

  const referenced = [...new Set(withOrder.map((row) => row.orderId!))];
  const alive = new Set(
    (
      await prisma.order.findMany({ where: { id: { in: referenced } }, select: { id: true } })
    ).map((order) => order.id)
  );

  const dead = withOrder.filter((row) => !alive.has(row.orderId!)).map((row) => row.id);
  if (dead.length === 0) return 0;

  const { count } = await prisma.analyticsEvent.deleteMany({ where: { id: { in: dead } } });
  return count;
}

export default async function globalSetup() {
  const prisma = new PrismaClient();
  try {
    // Events left behind by orders that no longer exist. AnalyticsEvent.orderId
    // is a plain column rather than a foreign key, so that deleting an order
    // does not rewrite the record of what happened — right in production, and
    // wrong for a database that gets wiped and refilled every run. Left alone
    // it had reached 377 recorded orders against 16 real ones, and the reports
    // funnel in development drifted to nonsense.
    const orphans = await clearOrphanedAnalytics(prisma);

    const orders = await prisma.order.findMany({
      where: { guestPhone: { startsWith: E2E_PHONE_PREFIX } },
      select: { id: true, customerId: true },
    });
    if (orders.length === 0) {
      if (orphans > 0) console.log(`[e2e] cleared ${orphans} orphaned analytics event(s)`);
      return;
    }

    const orderIds = orders.map((order) => order.id);

    const analytics = await prisma.analyticsEvent.deleteMany({
      where: { orderId: { in: orderIds } },
    });

    // Cascades handle items, options, payments, receipts and history.
    await prisma.order.deleteMany({ where: { id: { in: orderIds } } });

    // Remove the synthetic customers too, but only the ones with no orders
    // left — a real customer who happens to share a phone is not possible
    // here, since the prefix is reserved for tests.
    await prisma.customer.deleteMany({
      where: { phone: { startsWith: E2E_PHONE_PREFIX }, orders: { none: {} } },
    });

    console.log(
      `[e2e] cleared ${orderIds.length} order(s) and ${analytics.count + orphans} analytics event(s) from a previous run`
    );
  } finally {
    await prisma.$disconnect();
  }
}
