import "server-only";

import { prisma } from "@/lib/db";
import { getRestaurant } from "./restaurant";
import { getFunnel } from "./analytics";
import { ACTIVE_ORDER_STATUSES, RELEASED_SLOT_STATUSES } from "@/lib/order-state";
import { addDays, getZonedParts, startOfZonedDay, zonedTimeToUtc } from "@/lib/time";
import type { OrderStatus, PaymentMethodType, PaymentStatus, PickupMode } from "@prisma/client";

// Read models for the staff screens.
//
// Everything here answers a question a manager actually asks — "what needs me
// right now?", "what sold today?", "where do people drop out?" — rather than
// producing decorative cards (docs/PRD.md §31 "avoid decorative metrics
// without operational value").
//
// "Today" is the restaurant's calendar day in its own timezone, not the
// server's: on a UTC host, a 22:00 order in Al Mukalla belongs to that
// evening's takings, not tomorrow's.

export async function restaurantDayBounds(now = new Date()) {
  const restaurant = await getRestaurant();
  const start = startOfZonedDay(now, restaurant.timezone);
  const end = addDays(start, 1);
  return { start, end, timezone: restaurant.timezone };
}

export interface DashboardSnapshot {
  todayOrders: number;
  todaySalesMinor: number;
  avgOrderValueMinor: number;
  pendingPayments: number;
  queued: number;
  preparing: number;
  ready: number;
  upcomingScheduled: number;
  completedToday: number;
  cancelledToday: number;
  currency: string;
}

export async function getDashboardSnapshot(now = new Date()): Promise<DashboardSnapshot> {
  const restaurant = await getRestaurant();
  const { start, end } = await restaurantDayBounds(now);

  const [todayAggregate, statusCounts, pendingPayments, upcoming] = await Promise.all([
    // Revenue counts orders that weren't cancelled or rejected — an order the
    // restaurant refused was never money.
    prisma.order.aggregate({
      where: { createdAt: { gte: start, lt: end }, status: { notIn: RELEASED_SLOT_STATUSES } },
      _sum: { totalMinor: true },
      _count: { _all: true },
    }),
    prisma.order.groupBy({
      by: ["status"],
      where: {
        OR: [
          { status: { in: ACTIVE_ORDER_STATUSES } },
          { createdAt: { gte: start, lt: end } },
        ],
      },
      _count: { _all: true },
    }),
    prisma.payment.count({ where: { status: "PENDING" } }),
    prisma.order.count({
      where: { status: { in: ["CONFIRMED", "PAYMENT_PENDING"] }, kitchenReleaseAt: { gt: now } },
    }),
  ]);

  const byStatus = new Map(statusCounts.map((row) => [row.status, row._count._all]));
  const orders = todayAggregate._count._all;
  const sales = todayAggregate._sum.totalMinor ?? 0;

  return {
    todayOrders: orders,
    todaySalesMinor: sales,
    avgOrderValueMinor: orders > 0 ? Math.round(sales / orders) : 0,
    pendingPayments,
    queued: byStatus.get("QUEUED") ?? 0,
    preparing: byStatus.get("PREPARING") ?? 0,
    ready: byStatus.get("READY") ?? 0,
    upcomingScheduled: upcoming,
    completedToday: byStatus.get("COMPLETED") ?? 0,
    cancelledToday: byStatus.get("CANCELLED") ?? 0,
    currency: restaurant.currency,
  };
}

/**
 * How long an order may sit in a lane before it counts as stalled.
 *
 * QUEUED is the sharper of the two: the kitchen release time has already
 * passed, so every minute a queued order goes unstarted comes out of the
 * customer's promised pickup time. READY is slower — the food is made and
 * the wait is on the customer — so it gets longer before it is flagged.
 */
const STALLED_AFTER_MINUTES = { queued: 10, ready: 20 } as const;

/** Orders that are blocked on a human right now, newest first. */
export async function getAttentionQueue(limit = 6, now = new Date()) {
  const minutesAgo = (minutes: number) => new Date(now.getTime() - minutes * 60 * 1000);

  return prisma.order.findMany({
    where: {
      OR: [
        { status: "PAYMENT_PENDING" },
        { status: "PENDING" },
        // Released to the kitchen but nobody has started it. Without this the
        // dashboard reported "nothing needs attention" while ten orders sat
        // unstarted in the queue — the one state where waiting is pure lost
        // time, and the state the board is least likely to be watched in.
        {
          status: "QUEUED",
          kitchenReleaseAt: { lt: minutesAgo(STALLED_AFTER_MINUTES.queued) },
        },
        // Ready for longer than 20 minutes: the customer hasn't shown up, or
        // nobody marked it handed over.
        { status: "READY", readyAt: { lt: minutesAgo(STALLED_AFTER_MINUTES.ready) } },
      ],
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { payment: { select: { status: true, method: true } } },
  });
}

export async function getRecentOrders(limit = 8) {
  return prisma.order.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { payment: { select: { status: true, method: true } } },
  });
}

export interface OrderFilters {
  status?: OrderStatus;
  paymentStatus?: PaymentStatus;
  search?: string;
  todayOnly?: boolean;
  page?: number;
  pageSize?: number;
}

export async function listOrders(filters: OrderFilters = {}) {
  const pageSize = Math.min(filters.pageSize ?? 25, 100);
  const page = Math.max(1, filters.page ?? 1);
  const { start, end } = await restaurantDayBounds();

  const search = filters.search?.trim();
  const where = {
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.paymentStatus ? { payment: { status: filters.paymentStatus } } : {}),
    ...(filters.todayOnly ? { createdAt: { gte: start, lt: end } } : {}),
    ...(search
      ? {
          OR: [
            { reference: { contains: search, mode: "insensitive" as const } },
            { guestPhone: { contains: search } },
            { guestName: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { payment: { select: { status: true, method: true } }, _count: { select: { items: true } } },
    }),
    prisma.order.count({ where }),
  ]);

  return { orders, total, page, pageSize, pageCount: Math.max(1, Math.ceil(total / pageSize)) };
}

/** The payment verification queue — the cashier's main screen. */
export async function listPaymentsForReview() {
  return prisma.payment.findMany({
    where: { method: "BANK_TRANSFER", status: { in: ["PENDING", "PROCESSING"] } },
    orderBy: { createdAt: "asc" },
    include: {
      receipt: { select: { id: true, contentType: true, byteSize: true, uploadedAt: true } },
      order: { select: { id: true, reference: true, guestName: true, guestPhone: true, totalMinor: true, currency: true, status: true, requestedPickupAt: true } },
    },
  });
}

export async function listRecentlyReviewedPayments(limit = 10) {
  return prisma.payment.findMany({
    where: { status: { in: ["VERIFIED", "REJECTED", "PAID", "REFUNDED"] } },
    orderBy: { updatedAt: "desc" },
    take: limit,
    include: {
      order: { select: { reference: true, totalMinor: true, currency: true } },
      statusHistory: {
        orderBy: { createdAt: "desc" },
        take: 1,
        include: { reviewedBy: { select: { name: true } } },
      },
    },
  });
}

export async function listCustomers(limit = 100) {
  // `total` is the whole table, not the page: the screen used to print the
  // length of this capped list as the customer count, so a restaurant with
  // six hundred regulars was told it had a hundred.
  const [customers, total] = await Promise.all([
    prisma.customer.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
      include: {
        orders: {
          select: { totalMinor: true, createdAt: true, status: true },
          orderBy: { createdAt: "desc" },
        },
      },
    }),
    prisma.customer.count(),
  ]);

  const rows = customers.map((customer) => {
    const billable = customer.orders.filter(
      (order) => !RELEASED_SLOT_STATUSES.includes(order.status)
    );
    return {
      id: customer.id,
      name: customer.name,
      phone: customer.phone,
      orderCount: billable.length,
      totalSpentMinor: billable.reduce((sum, order) => sum + order.totalMinor, 0),
      firstOrderAt: customer.orders[customer.orders.length - 1]?.createdAt ?? customer.createdAt,
      lastOrderAt: customer.orders[0]?.createdAt ?? null,
    };
  });

  return { customers: rows, total, shown: rows.length };
}

export interface ReportRange {
  start: Date;
  end: Date;
}

export function rangeForPreset(preset: "today" | "7d" | "30d", now = new Date()): ReportRange {
  const end = now;
  const days = preset === "today" ? 0 : preset === "7d" ? 7 : 30;
  const start = preset === "today" ? new Date(now.getTime() - 86_400_000) : addDays(now, -days);
  return { start, end };
}

export interface ReportSummary {
  orders: number;
  revenueMinor: number;
  avgOrderValueMinor: number;
  completionRate: number;
  cancellationRate: number;
  repeatCustomerRate: number;
  currency: string;
  topProducts: { name: string; nameAr: string; quantity: number; revenueMinor: number }[];
  paymentMix: { method: PaymentMethodType; count: number }[];
  pickupMix: { mode: PickupMode; count: number }[];
  peakHours: { hour: number; count: number }[];
  funnel: Awaited<ReturnType<typeof getFunnel>>;
}

export async function getReportSummary(range: ReportRange): Promise<ReportSummary> {
  const restaurant = await getRestaurant();
  const window = { gte: range.start, lte: range.end };

  const [orders, itemRows, paymentRows, pickupRows, funnel] = await Promise.all([
    prisma.order.findMany({
      where: { createdAt: window },
      select: { id: true, status: true, totalMinor: true, createdAt: true, customerId: true },
    }),
    prisma.orderItem.groupBy({
      by: ["nameEn", "nameAr"],
      where: { order: { createdAt: window, status: { notIn: RELEASED_SLOT_STATUSES } } },
      _sum: { quantity: true, lineTotalMinor: true },
      orderBy: { _sum: { quantity: "desc" } },
      take: 8,
    }),
    prisma.payment.groupBy({
      by: ["method"],
      where: { order: { createdAt: window } },
      _count: { _all: true },
    }),
    prisma.order.groupBy({
      by: ["pickupMode"],
      where: { createdAt: window },
      _count: { _all: true },
    }),
    getFunnel(range.start, range.end),
  ]);

  const billable = orders.filter((order) => !RELEASED_SLOT_STATUSES.includes(order.status));
  const revenue = billable.reduce((sum, order) => sum + order.totalMinor, 0);
  const completed = orders.filter((order) => order.status === "COMPLETED").length;
  const cancelled = orders.filter((order) => RELEASED_SLOT_STATUSES.includes(order.status)).length;

  // A "repeat customer" is one who appears on more than one order in the
  // window — a crude but honest measure without a loyalty system.
  const perCustomer = new Map<string, number>();
  for (const order of billable) {
    if (!order.customerId) continue;
    perCustomer.set(order.customerId, (perCustomer.get(order.customerId) ?? 0) + 1);
  }
  const repeatCustomers = [...perCustomer.values()].filter((count) => count > 1).length;

  // Peak hours are counted in restaurant-local time — a UTC histogram would
  // show a rush three hours off from the one the staff lived through.
  const hourCounts = new Map<number, number>();
  for (const order of billable) {
    const { hour } = getZonedParts(order.createdAt, restaurant.timezone);
    hourCounts.set(hour, (hourCounts.get(hour) ?? 0) + 1);
  }

  return {
    orders: orders.length,
    revenueMinor: revenue,
    avgOrderValueMinor: billable.length > 0 ? Math.round(revenue / billable.length) : 0,
    completionRate: orders.length > 0 ? completed / orders.length : 0,
    cancellationRate: orders.length > 0 ? cancelled / orders.length : 0,
    repeatCustomerRate: perCustomer.size > 0 ? repeatCustomers / perCustomer.size : 0,
    currency: restaurant.currency,
    topProducts: itemRows.map((row) => ({
      name: row.nameEn,
      nameAr: row.nameAr,
      quantity: row._sum.quantity ?? 0,
      revenueMinor: row._sum.lineTotalMinor ?? 0,
    })),
    paymentMix: paymentRows.map((row) => ({ method: row.method, count: row._count._all })),
    pickupMix: pickupRows.map((row) => ({ mode: row.pickupMode, count: row._count._all })),
    peakHours: [...hourCounts.entries()]
      .map(([hour, count]) => ({ hour, count }))
      .sort((a, b) => a.hour - b.hour),
    funnel,
  };
}

/** Today's best sellers, for the dashboard rail. */
export async function getTopProductsToday(limit = 5) {
  const { start, end } = await restaurantDayBounds();
  const rows = await prisma.orderItem.groupBy({
    by: ["nameEn", "nameAr"],
    where: {
      order: { createdAt: { gte: start, lt: end }, status: { notIn: RELEASED_SLOT_STATUSES } },
    },
    _sum: { quantity: true },
    orderBy: { _sum: { quantity: "desc" } },
    take: limit,
  });
  return rows.map((row) => ({
    nameEn: row.nameEn,
    nameAr: row.nameAr,
    quantity: row._sum.quantity ?? 0,
  }));
}

/** Builds a UTC instant from a date-only input in the restaurant's timezone. */
export async function restaurantDateToUtc(dateOnly: string): Promise<Date> {
  const restaurant = await getRestaurant();
  const [year, month, day] = dateOnly.split("-").map(Number);
  return zonedTimeToUtc(year, month, day, 0, 0, restaurant.timezone);
}
