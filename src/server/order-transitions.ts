import { prisma } from "@/lib/db";
import { assertTransitionAllowed } from "@/lib/order-state";
import type { OrderStatus, Role } from "@prisma/client";

export async function transitionOrder(
  orderId: string,
  toStatus: OrderStatus,
  actor: { id: string; role: Role },
  reason?: string
) {
  const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
  assertTransitionAllowed(order.status, toStatus, actor.role);

  const timestampField: Partial<Record<OrderStatus, string>> = {
    CONFIRMED: "confirmedAt",
    PREPARING: "preparingAt",
    READY: "readyAt",
    COMPLETED: "completedAt",
    CANCELLED: "cancelledAt",
  };
  const extraData: Record<string, Date> = {};
  const field = timestampField[toStatus];
  if (field) extraData[field] = new Date();

  await prisma.$transaction([
    prisma.order.update({ where: { id: orderId }, data: { status: toStatus, ...extraData } }),
    prisma.orderStatusHistory.create({
      data: {
        orderId,
        fromStatus: order.status,
        toStatus,
        changedById: actor.id,
        reason,
      },
    }),
  ]);
}

export async function verifyPayment(paymentId: string, actor: { id: string; role: Role }) {
  const payment = await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
  await prisma.$transaction([
    prisma.payment.update({ where: { id: paymentId }, data: { status: "VERIFIED" } }),
    prisma.paymentStatusHistory.create({
      data: {
        paymentId,
        fromStatus: payment.status,
        toStatus: "VERIFIED",
        reviewedById: actor.id,
      },
    }),
  ]);
  await transitionOrder(payment.orderId, "CONFIRMED", actor);
}

export async function rejectPayment(paymentId: string, actor: { id: string; role: Role }, reason: string) {
  const payment = await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
  await prisma.$transaction([
    prisma.payment.update({ where: { id: paymentId }, data: { status: "REJECTED" } }),
    prisma.paymentStatusHistory.create({
      data: {
        paymentId,
        fromStatus: payment.status,
        toStatus: "REJECTED",
        reviewedById: actor.id,
        reason,
      },
    }),
  ]);
  await transitionOrder(payment.orderId, "REJECTED", actor, reason);
}

export async function setOnlineOrderingPaused(paused: boolean) {
  const restaurant = await prisma.restaurant.findFirstOrThrow();
  await prisma.restaurant.update({
    where: { id: restaurant.id },
    data: { onlineOrderingPaused: paused },
  });
}
