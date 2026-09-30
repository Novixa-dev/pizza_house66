import { describe, expect, it } from "vitest";
import { FUNNEL_STEPS, foldFunnel, type FunnelRow } from "@/lib/funnel";

// The funnel is the one report the owner reads to decide what to change, so
// the arithmetic has to be defensible. Every case below is a shape the real
// data actually takes — not a hypothetical.

/** Emits one row per event for a session, in the order they were recorded. */
const session = (sessionId: string | null, ...names: string[]): FunnelRow[] =>
  names.map((name) => ({ name, sessionId }));

const counts = (result: ReturnType<typeof foldFunnel>) => [
  result.visitors,
  result.menuViews,
  result.productViews,
  result.addToCart,
  result.checkoutStarted,
  result.orders,
];

describe("foldFunnel", () => {
  it("counts a complete journey once at every step", () => {
    const result = foldFunnel(session("s1", ...FUNNEL_STEPS));
    expect(counts(result)).toEqual([1, 1, 1, 1, 1, 1]);
  });

  it("counts a session at every step up to the furthest one it reached", () => {
    // Browsed to a product and stopped. Nothing below product_view.
    const result = foldFunnel(session("s1", "page_view", "menu_view", "product_view"));
    expect(counts(result)).toEqual([1, 1, 1, 0, 0, 0]);
  });

  it("credits the earlier steps of a session whose top-of-funnel beacons were lost", () => {
    // The bug this function exists for. Beacons are browser-sent and lossy;
    // order_created is written server-side and never lost. A session that
    // only ever reported the order still browsed a product to place it.
    const result = foldFunnel(session("s1", "order_created"));
    expect(counts(result)).toEqual([1, 1, 1, 1, 1, 1]);
  });

  it("never lets a step exceed the one above it", () => {
    // The exact shape that was reported wrong on the live reports screen:
    // product views read 0 while add-to-cart read 161, and orders outran
    // checkouts started.
    const rows = [
      ...session("browser-a", "page_view", "menu_view"),
      ...session("browser-b", "add_to_cart"),
      ...session("browser-c", "order_created"),
      ...session("browser-d", "checkout_started"),
      ...session("browser-e", "page_view"),
    ];

    const result = counts(foldFunnel(rows));
    for (let step = 1; step < result.length; step += 1) {
      expect(result[step]).toBeLessThanOrEqual(result[step - 1]);
    }
    expect(result).toEqual([5, 4, 3, 3, 2, 1]);
  });

  it("counts a session once however many times it repeats a step", () => {
    // One indecisive visitor refreshing the menu is not twenty people.
    const rows = session("s1", "page_view", "menu_view", "menu_view", "menu_view");
    expect(counts(foldFunnel(rows))).toEqual([1, 1, 0, 0, 0, 0]);
  });

  it("does not care what order the rows arrive in", () => {
    const forwards = session("s1", "page_view", "menu_view", "product_view", "add_to_cart");
    const backwards = [...forwards].reverse();
    expect(foldFunnel(backwards)).toEqual(foldFunnel(forwards));
  });

  it("leaves a session-less order out of the funnel entirely", () => {
    // A funnel of journeys has nowhere to put an order that had no journey.
    // Counting it at the bottom step alone was tried first and rebuilt the
    // very shape this function exists to prevent: on real data 270 of 377
    // recorded orders were un-sessioned, and the bottom bar came out nearly
    // twice the one above it. The true order count is the orders table's to
    // report, and the reports screen reads it from there.
    expect(counts(foldFunnel(session(null, "order_created")))).toEqual([0, 0, 0, 0, 0, 0]);
  });

  it("ignores session-less events of every kind", () => {
    const result = foldFunnel(session(null, "page_view", "add_to_cart", "order_created"));
    expect(counts(result)).toEqual([0, 0, 0, 0, 0, 0]);
  });

  it("treats an empty-string session id the same way as a missing one", () => {
    expect(counts(foldFunnel([{ name: "order_created", sessionId: "" }]))).toEqual([
      0, 0, 0, 0, 0, 0,
    ]);
  });

  it("is monotonic for any input at all", () => {
    // The property, not an example of it: whatever arrives, no step can come
    // out larger than the step above it.
    const names = [...FUNNEL_STEPS, "remove_from_cart", "payment_verified"];
    const rows: FunnelRow[] = [];
    let seed = 7;
    const next = (n: number) => (seed = (seed * 1103515245 + 12345) % 2147483648) % n;

    for (let i = 0; i < 400; i += 1) {
      const withSession = next(4) !== 0;
      rows.push({
        name: names[next(names.length)],
        sessionId: withSession ? `s${next(40)}` : null,
      });
    }

    const result = counts(foldFunnel(rows));
    for (let step = 1; step < result.length; step += 1) {
      expect(result[step]).toBeLessThanOrEqual(result[step - 1]);
    }
  });

  it("ignores events that are not funnel steps", () => {
    // ANALYTICS_EVENTS is a longer list than the funnel: payment_verified and
    // order_ready are recorded but belong to no step.
    const rows = [
      ...session("s1", "page_view", "menu_view"),
      ...session("s1", "remove_from_cart", "payment_verified", "order_ready"),
    ];
    expect(counts(foldFunnel(rows))).toEqual([1, 1, 0, 0, 0, 0]);
  });

  it("returns zeroes for no rows at all", () => {
    expect(counts(foldFunnel([]))).toEqual([0, 0, 0, 0, 0, 0]);
  });

  it("keeps sessions apart", () => {
    const rows = [
      ...session("s1", "page_view", "menu_view", "product_view"),
      ...session("s2", "page_view"),
      ...session("s3", ...FUNNEL_STEPS),
    ];
    expect(counts(foldFunnel(rows))).toEqual([3, 2, 2, 1, 1, 1]);
  });
});
