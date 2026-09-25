import "server-only";

import { prisma } from "@/lib/db";
import type { OrderStatus } from "@prisma/client";

// Order notifications (docs/PRD.md §54).
//
// Two rules shape this module:
//
//   1. A notification failure must never break the order workflow. Every
//      write is wrapped, and delivery is separate from recording.
//   2. Don't spam. Only the handful of transitions a customer actually cares
//      about produce a notification; the rest are silent.
//
// For the MVP the delivery channel is the tracking page itself — the record
// is what the customer sees when they refresh, and what staff see in the
// order's history. Email/WhatsApp delivery plugs in at `deliver()` without
// touching any caller.

interface NotificationTemplate {
  event: string;
  titleAr: string;
  titleEn: string;
  bodyAr?: string;
  bodyEn?: string;
}

const STATUS_TEMPLATES: Partial<Record<OrderStatus, NotificationTemplate>> = {
  PENDING: {
    event: "order_received",
    titleAr: "تم استلام طلبك",
    titleEn: "We received your order",
    bodyAr: "سنبدأ التحضير في الوقت المناسب لموعد استلامك.",
    bodyEn: "We'll start preparing in time for your pickup slot.",
  },
  PAYMENT_PENDING: {
    event: "payment_submitted",
    titleAr: "إيصالك قيد المراجعة",
    titleEn: "Your receipt is under review",
    bodyAr: "سنؤكد الطلب فور اعتماد التحويل.",
    bodyEn: "We'll confirm the order as soon as the transfer is approved.",
  },
  CONFIRMED: {
    event: "order_confirmed",
    titleAr: "تم تأكيد طلبك",
    titleEn: "Your order is confirmed",
    bodyAr: "طلبك مجدول وسيبدأ تحضيره في الوقت المحدد.",
    bodyEn: "Your order is scheduled and will start preparing on time.",
  },
  PREPARING: {
    event: "order_preparing",
    titleAr: "بدأ تحضير طلبك",
    titleEn: "Your order is being prepared",
  },
  READY: {
    event: "order_ready",
    titleAr: "طلبك جاهز للاستلام",
    titleEn: "Your order is ready for pickup",
    bodyAr: "يمكنك استلام طلبك الآن من المطعم.",
    bodyEn: "You can collect your order from the restaurant now.",
  },
  COMPLETED: {
    event: "order_completed",
    titleAr: "تم تسليم طلبك",
    titleEn: "Order handed over",
    bodyAr: "شكرًا لاختيارك بيتزا هاوس.",
    bodyEn: "Thanks for choosing Pizza House.",
  },
  REJECTED: {
    event: "payment_rejected",
    titleAr: "تعذّر تأكيد الدفع",
    titleEn: "We couldn't confirm your payment",
    bodyAr: "يرجى التواصل مع المطعم لمعرفة التفاصيل.",
    bodyEn: "Please contact the restaurant for details.",
  },
  CANCELLED: {
    event: "order_cancelled",
    titleAr: "تم إلغاء طلبك",
    titleEn: "Your order was cancelled",
  },
};

/** Records a customer-facing notification for an order status change. */
export async function notifyOrderStatus(
  orderId: string,
  status: OrderStatus,
  reason?: string
): Promise<void> {
  const template = STATUS_TEMPLATES[status];
  if (!template) return; // QUEUED and REFUNDED are internal; don't nag the customer.

  try {
    const notification = await prisma.notification.create({
      data: {
        orderId,
        event: template.event,
        channel: "IN_APP",
        status: "PENDING",
        titleAr: template.titleAr,
        titleEn: template.titleEn,
        bodyAr: reason ?? template.bodyAr ?? null,
        bodyEn: reason ?? template.bodyEn ?? null,
      },
    });
    await deliver(notification.id);
  } catch (error) {
    console.error("[notifications] failed to record", { orderId, status }, error);
  }
}

/**
 * Marks a recorded notification as delivered.
 *
 * The in-app channel is delivered by definition — the customer sees it on the
 * tracking page. When an email or WhatsApp channel is added, this is the one
 * function that changes, and a throw here still leaves the order untouched.
 */
async function deliver(notificationId: string): Promise<void> {
  try {
    await prisma.notification.update({
      where: { id: notificationId },
      data: { status: "SENT", sentAt: new Date() },
    });
  } catch (error) {
    await prisma.notification
      .update({
        where: { id: notificationId },
        data: { status: "FAILED", error: error instanceof Error ? error.message : "unknown" },
      })
      .catch(() => undefined);
  }
}

export async function listOrderNotifications(orderId: string) {
  return prisma.notification.findMany({
    where: { orderId },
    orderBy: { createdAt: "asc" },
  });
}
