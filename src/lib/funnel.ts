// Funnel folding (docs/PRD.md §53, docs/ANALYTICS.md).
//
// Pure, so the rule can be tested without a database — the same reason
// scheduling and pricing live here rather than in src/server.

/** The ordered steps. Earlier steps are strictly earlier in the journey. */
export const FUNNEL_STEPS = [
  "page_view",
  "menu_view",
  "product_view",
  "add_to_cart",
  "checkout_started",
  "order_created",
] as const;

export type FunnelStep = (typeof FUNNEL_STEPS)[number];

export interface FunnelCounts {
  visitors: number;
  menuViews: number;
  productViews: number;
  addToCart: number;
  checkoutStarted: number;
  orders: number;
}

export interface FunnelRow {
  name: string;
  sessionId: string | null;
}

/**
 * Counts distinct sessions that reached **at least** each step.
 *
 * The obvious implementation — count sessions that recorded exactly this
 * event — produces a funnel that grows as it descends, which is not a funnel.
 * It happened here: product views read 0 while add-to-cart read 161, and
 * orders (243) exceeded checkouts started (119).
 *
 * The cause is that the two halves of the funnel are collected differently.
 * The top is browser beacons, which are lost to ad blockers, a closed tab, or
 * a navigation that beats the request; the bottom is written server-side
 * inside the code that creates the order, and is never lost. So a session
 * reliably shows up at the bottom and only sometimes at the top.
 *
 * Reaching a later step is proof of having passed the earlier ones — someone
 * who placed an order did browse a product, whatever their browser managed to
 * report. Counting a session at every step up to the furthest one it reached
 * makes the funnel monotonic by construction, and is the truer reading of
 * what the person actually did.
 *
 * Orders with no session id (an API client, a future POS integration) have no
 * journey to attribute, so they are added to the order count alone rather
 * than invented into the steps above it.
 */
export function foldFunnel(rows: FunnelRow[]): FunnelCounts {
  const furthest = new Map<string, number>();
  let anonymousOrders = 0;

  for (const row of rows) {
    const index = (FUNNEL_STEPS as readonly string[]).indexOf(row.name);
    if (index === -1) continue;

    if (!row.sessionId) {
      if (row.name === "order_created") anonymousOrders += 1;
      continue;
    }

    const seen = furthest.get(row.sessionId);
    if (seen === undefined || index > seen) furthest.set(row.sessionId, index);
  }

  // A session sitting at step N counts at every step up to and including N.
  const reached = new Array(FUNNEL_STEPS.length).fill(0) as number[];
  for (const index of furthest.values()) {
    for (let step = 0; step <= index; step += 1) reached[step] += 1;
  }

  return {
    visitors: reached[0],
    menuViews: reached[1],
    productViews: reached[2],
    addToCart: reached[3],
    checkoutStarted: reached[4],
    orders: reached[5] + anonymousOrders,
  };
}
