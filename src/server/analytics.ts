import "server-only";

import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import { foldFunnel, type FunnelCounts } from "@/lib/funnel";

// First-party analytics (docs/PRD.md §52, §53).
//
// No third-party tracker, and deliberately no personal data: a session is an
// opaque random id in a cookie, and events carry ids and amounts, never
// names or phone numbers. That keeps the funnel useful for the restaurant
// without turning the ordering page into a surveillance surface.

export const ANALYTICS_EVENTS = [
  "page_view",
  "menu_view",
  "product_view",
  "add_to_cart",
  "remove_from_cart",
  "checkout_started",
  "checkout_completed",
  "order_created",
  "payment_submitted",
  "payment_verified",
  "payment_rejected",
  "order_cancelled",
  "order_preparing",
  "order_ready",
  "order_completed",
] as const;

export type AnalyticsEventName = (typeof ANALYTICS_EVENTS)[number];

export function isAnalyticsEvent(name: string): name is AnalyticsEventName {
  return (ANALYTICS_EVENTS as readonly string[]).includes(name);
}

export interface TrackInput {
  name: AnalyticsEventName;
  sessionId?: string | null;
  orderId?: string | null;
  productId?: string | null;
  valueMinor?: number | null;
  metadata?: Prisma.InputJsonValue;
}

/** Records an event. Analytics must never break a customer's order. */
export async function track(input: TrackInput): Promise<void> {
  try {
    await prisma.analyticsEvent.create({
      data: {
        name: input.name,
        sessionId: input.sessionId ?? null,
        orderId: input.orderId ?? null,
        productId: input.productId ?? null,
        valueMinor: input.valueMinor ?? null,
        metadata: input.metadata,
      },
    });
  } catch (error) {
    console.error("[analytics] failed to record", input.name, error);
  }
}

export type { FunnelCounts };

/**
 * The funnel from docs/PRD.md §53. Counts distinct sessions rather than raw
 * events, so one indecisive visitor refreshing the menu twenty times does not
 * read as twenty people. The folding rule — and why it counts sessions that
 * reached *at least* each step — lives in `src/lib/funnel.ts`.
 */
export async function getFunnel(since: Date, until: Date): Promise<FunnelCounts> {
  const rows = await prisma.analyticsEvent.findMany({
    where: { createdAt: { gte: since, lte: until } },
    select: { name: true, sessionId: true },
  });
  return foldFunnel(rows);
}

export async function countEventsByName(since: Date, until: Date) {
  const grouped = await prisma.analyticsEvent.groupBy({
    by: ["name"],
    where: { createdAt: { gte: since, lte: until } },
    _count: { _all: true },
  });
  return Object.fromEntries(grouped.map((row) => [row.name, row._count._all]));
}
