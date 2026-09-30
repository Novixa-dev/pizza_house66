import "server-only";

import { prisma } from "@/lib/db";
import { assertTransitionAllowed } from "@/lib/order-state";
import { can, ForbiddenError } from "@/lib/permissions";
import type { OrderStatus, Role } from "@prisma/client";
import { recordAudit } from "./audit";
import { notifyOrderStatus } from "./notifications";
import { track } from "./analytics";
import { recordCompletionAndReward } from "./coupons";

// Every staff-initiated change to an order or a payment funnels through this
// module. It is the single place that:
//   - checks the transition is legal and the actor is allowed,
//   - writes the status change and its history row in one transaction,
//   - stamps the matching timestamp column,
//   - and records the audit trail and customer notification afterwards.
//
// Doing all five in one place is what makes "the client cannot manipulate
// order state" a property of the system rather than a hope.

export interface StaffActor {
  id: string;
  name: string;
  role: Role;
}

const TIMESTAMP_FIELD: Partial<Record<OrderStatus, string>> = {
  CONFIRMED: "confirmedAt",
  QUEUED: "queuedAt",
  PREPARING: "preparingAt",
  READY: "readyAt",
  COMPLETED: "completedAt",
  CANCELLED: "cancelledAt",
};

const ANALYTICS_FOR_STATUS: Partial<Record<OrderStatus, "order_preparing" | "order_ready" | "order_completed" | "order_cancelled">> = {
  PREPARING: "order_preparing",
  READY: "order_ready",
  COMPLETED: "order_completed",
  CANCELLED: "order_cancelled",
};

export class OrderNotFoundError extends Error {
  constructor() {
    super("Order not found");
    this.name = "OrderNotFoundError";
  }
}

export class ConcurrentUpdateError extends Error {
  constructor() {
    super("The order changed while you were working on it. Reload and try again.");
    this.name = "ConcurrentUpdateError";
  }
}

export async function transitionOrder(
  orderId: string,
  toStatus: OrderStatus,
  actor: StaffActor,
  reason?: string
): Promise<void> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { id: true, status: true, totalMinor: true },
  });
  if (!order) throw new OrderNotFoundError();

  assertTransitionAllowed(order.status, toStatus, actor.role);

  const field = TIMESTAMP_FIELD[toStatus];
  const now = new Date();

  const reward = await prisma.$transaction(async (tx) => {
    // Conditioning the update on the status we validated against turns a
    // concurrent double-click by two staff members into one winner and one
    // clear error, instead of two history rows for the same move
    // (docs/PRD.md §46).
    const result = await tx.order.updateMany({
      where: { id: orderId, status: order.status },
      data: { status: toStatus, ...(field ? { [field]: now } : {}) },
    });
    if (result.count === 0) throw new ConcurrentUpdateError();

    await tx.orderStatusHistory.create({
      data: {
        orderId,
        fromStatus: order.status,
        toStatus,
        changedById: actor.id,
        reason,
      },
    });

    // Handing the food over is the moment the order counts, so it is also the
    // moment the loyalty counter moves and a reward can fall due. Inside the
    // transaction on purpose: the counter and the order that advanced it have
    // to agree, or a rolled-back completion leaves someone a step closer to a
    // coupon for an order they never collected.
    return toStatus === "COMPLETED" ? recordCompletionAndReward(tx, orderId, now) : null;
  });

  await recordAudit({
    actor,
    action: toStatus === "CANCELLED" ? "order.cancel" : "order.transition",
    entity: "Order",
    entityId: orderId,
    metadata: { from: order.status, to: toStatus, reason: reason ?? null },
  });
  await notifyOrderStatus(orderId, toStatus, reason);

  const analyticsEvent = ANALYTICS_FOR_STATUS[toStatus];
  if (analyticsEvent) {
    await track({ name: analyticsEvent, orderId, valueMinor: order.totalMinor });
  }

  // Logged rather than notified: there is no messaging channel wired up yet,
  // and the coupon is already waiting on the customer's orders page. The
  // audit line is what lets the owner see rewards going out.
  if (reward) {
    await recordAudit({
      actor,
      action: "coupon.granted",
      entity: "Order",
      entityId: orderId,
      metadata: { code: reward.code, milestone: reward.milestone },
    });
  }
}

export async function verifyPayment(
  paymentId: string,
  actor: StaffActor,
  note?: string
): Promise<void> {
  if (!can(actor.role, "payments.verify")) throw new ForbiddenError("payments.verify");

  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    select: { id: true, status: true, orderId: true, amountMinor: true, order: { select: { status: true } } },
  });
  if (!payment) throw new OrderNotFoundError();

  await prisma.$transaction(async (tx) => {
    const result = await tx.payment.updateMany({
      where: { id: paymentId, status: payment.status },
      data: { status: "VERIFIED" },
    });
    if (result.count === 0) throw new ConcurrentUpdateError();

    await tx.paymentStatusHistory.create({
      data: {
        paymentId,
        fromStatus: payment.status,
        toStatus: "VERIFIED",
        reviewedById: actor.id,
        reason: note,
      },
    });
  });

  await recordAudit({
    actor,
    action: "payment.verify",
    entity: "Payment",
    entityId: paymentId,
    metadata: { orderId: payment.orderId, from: payment.status, amountMinor: payment.amountMinor },
  });
  await track({ name: "payment_verified", orderId: payment.orderId, valueMinor: payment.amountMinor });

  // Approving the transfer is what confirms the order — but only if the order
  // is still waiting for it. An order cancelled in the meantime stays
  // cancelled; the payment is simply recorded as verified for the refund
  // conversation (docs/PRD.md §26 edge cases, §46).
  if (payment.order.status === "PAYMENT_PENDING" || payment.order.status === "PENDING") {
    await transitionOrder(payment.orderId, "CONFIRMED", actor, "payment_verified");
  }
}

export async function rejectPayment(
  paymentId: string,
  actor: StaffActor,
  reason: string
): Promise<void> {
  if (!can(actor.role, "payments.reject")) throw new ForbiddenError("payments.reject");

  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    select: { id: true, status: true, orderId: true, amountMinor: true, order: { select: { status: true } } },
  });
  if (!payment) throw new OrderNotFoundError();

  await prisma.$transaction(async (tx) => {
    const result = await tx.payment.updateMany({
      where: { id: paymentId, status: payment.status },
      data: { status: "REJECTED" },
    });
    if (result.count === 0) throw new ConcurrentUpdateError();

    await tx.paymentStatusHistory.create({
      data: {
        paymentId,
        fromStatus: payment.status,
        toStatus: "REJECTED",
        reviewedById: actor.id,
        reason,
      },
    });
  });

  await recordAudit({
    actor,
    action: "payment.reject",
    entity: "Payment",
    entityId: paymentId,
    metadata: { orderId: payment.orderId, from: payment.status, reason },
  });
  await track({ name: "payment_rejected", orderId: payment.orderId, valueMinor: payment.amountMinor });

  if (payment.order.status === "PAYMENT_PENDING" || payment.order.status === "PENDING") {
    await transitionOrder(payment.orderId, "REJECTED", actor, reason);
  }
}

export async function setOnlineOrderingPaused(paused: boolean, actor: StaffActor): Promise<void> {
  if (!can(actor.role, "ordering.pause")) throw new ForbiddenError("ordering.pause");

  const restaurant = await prisma.restaurant.findFirstOrThrow({ select: { id: true } });
  await prisma.restaurant.update({
    where: { id: restaurant.id },
    data: { onlineOrderingPaused: paused },
  });
  await recordAudit({
    actor,
    action: paused ? "ordering.pause" : "ordering.resume",
    entity: "Restaurant",
    entityId: restaurant.id,
  });
}
