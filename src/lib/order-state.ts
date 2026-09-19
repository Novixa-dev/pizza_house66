import type { OrderStatus, Role } from "@prisma/client";

// Order state machine — docs/PRD.md section 23 / docs/PROJECT_ORIGIN.md section 19.
// The client must never be able to set an order's status directly; every
// transition goes through `assertTransitionAllowed` on the server.

const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING: ["PAYMENT_PENDING", "CONFIRMED", "REJECTED", "CANCELLED"],
  PAYMENT_PENDING: ["CONFIRMED", "REJECTED", "CANCELLED"],
  CONFIRMED: ["QUEUED", "CANCELLED"],
  QUEUED: ["PREPARING", "CANCELLED"],
  PREPARING: ["READY", "CANCELLED"],
  READY: ["COMPLETED"],
  COMPLETED: [],
  REJECTED: [],
  CANCELLED: ["REFUNDED"],
  REFUNDED: [],
};

// Which roles may perform which transition. OWNER/MANAGER can do anything
// CASHIER or KITCHEN can, plus payment/cancellation actions.
const TRANSITION_ROLES: Partial<Record<OrderStatus, Role[]>> = {
  CONFIRMED: ["OWNER", "MANAGER", "CASHIER"],
  QUEUED: ["OWNER", "MANAGER", "CASHIER"], // usually automatic (kitchen release), but staff can force it
  PREPARING: ["OWNER", "MANAGER", "KITCHEN"],
  READY: ["OWNER", "MANAGER", "KITCHEN"],
  COMPLETED: ["OWNER", "MANAGER", "CASHIER", "KITCHEN"],
  REJECTED: ["OWNER", "MANAGER", "CASHIER"],
  CANCELLED: ["OWNER", "MANAGER", "CASHIER"],
  REFUNDED: ["OWNER", "MANAGER"],
};

export class InvalidTransitionError extends Error {
  constructor(from: OrderStatus, to: OrderStatus) {
    super(`Cannot transition order from ${from} to ${to}`);
    this.name = "InvalidTransitionError";
  }
}

export class ForbiddenTransitionError extends Error {
  constructor(role: Role, to: OrderStatus) {
    super(`Role ${role} is not allowed to transition an order to ${to}`);
    this.name = "ForbiddenTransitionError";
  }
}

export function assertTransitionAllowed(from: OrderStatus, to: OrderStatus, role: Role): void {
  if (!TRANSITIONS[from]?.includes(to)) {
    throw new InvalidTransitionError(from, to);
  }
  const allowedRoles = TRANSITION_ROLES[to];
  if (allowedRoles && !allowedRoles.includes(role)) {
    throw new ForbiddenTransitionError(role, to);
  }
}

export const CUSTOMER_VISIBLE_LABELS: Record<OrderStatus, { ar: string; en: string }> = {
  PENDING: { ar: "تم استلام الطلب", en: "Order Received" },
  PAYMENT_PENDING: { ar: "الدفع قيد المراجعة", en: "Payment Under Review" },
  CONFIRMED: { ar: "تم تأكيد الطلب", en: "Order Confirmed" },
  QUEUED: { ar: "في قائمة الانتظار", en: "Queued" },
  PREPARING: { ar: "جاري التحضير", en: "Preparing" },
  READY: { ar: "جاهز للاستلام", en: "Ready for Pickup" },
  COMPLETED: { ar: "تم الاستلام", en: "Completed" },
  REJECTED: { ar: "تم رفض الطلب", en: "Rejected" },
  CANCELLED: { ar: "تم إلغاء الطلب", en: "Cancelled" },
  REFUNDED: { ar: "تم استرداد المبلغ", en: "Refunded" },
};
