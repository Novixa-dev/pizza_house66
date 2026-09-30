// Order state machine (docs/PRD.md §23, docs/PROJECT_ORIGIN.md §19).
//
// A status is never assigned directly. Every change goes through
// `assertTransitionAllowed`, which answers two separate questions:
//   1. is this a legal edge in the lifecycle at all?
//   2. is this actor allowed to walk it?
// Keeping them separate is what stops "kitchen staff marked an order
// refunded" from being one careless UI change away.

import type { OrderStatus, Role } from "@prisma/client";
import { can, type Permission } from "./permissions";

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

// The permission each target status demands. Kitchen roles can move food
// along; only cashier-and-above can confirm, cancel or reject, and refunds
// stay with the owner/manager (docs/PRD.md §38).
const TRANSITION_PERMISSION: Record<OrderStatus, Permission | null> = {
  PENDING: null,
  PAYMENT_PENDING: "orders.update",
  CONFIRMED: "orders.update",
  QUEUED: "orders.update",
  PREPARING: "kitchen.update",
  READY: "kitchen.update",
  COMPLETED: "kitchen.update",
  REJECTED: "payments.reject",
  CANCELLED: "orders.cancel",
  REFUNDED: "payments.verify",
};

// Statuses a REFUNDED transition additionally requires owner/manager rights
// for — refunds move money, so they never ride on a cashier's session.
const OWNER_MANAGER_ONLY: OrderStatus[] = ["REFUNDED"];

export class InvalidTransitionError extends Error {
  readonly from: OrderStatus;
  readonly to: OrderStatus;
  constructor(from: OrderStatus, to: OrderStatus) {
    super(`Cannot transition order from ${from} to ${to}`);
    this.name = "InvalidTransitionError";
    this.from = from;
    this.to = to;
  }
}

export class ForbiddenTransitionError extends Error {
  readonly role: Role;
  readonly to: OrderStatus;
  constructor(role: Role, to: OrderStatus) {
    super(`Role ${role} is not allowed to transition an order to ${to}`);
    this.name = "ForbiddenTransitionError";
    this.role = role;
    this.to = to;
  }
}

export function isTransitionAllowed(from: OrderStatus, to: OrderStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export function allowedTransitionsFrom(from: OrderStatus): OrderStatus[] {
  return [...(TRANSITIONS[from] ?? [])];
}

/** Transitions this role could perform from `from`, for building staff UI. */
export function allowedTransitionsForRole(from: OrderStatus, role: Role): OrderStatus[] {
  return allowedTransitionsFrom(from).filter((to) => {
    try {
      assertTransitionAllowed(from, to, role);
      return true;
    } catch {
      return false;
    }
  });
}

export function assertTransitionAllowed(from: OrderStatus, to: OrderStatus, role: Role): void {
  if (!isTransitionAllowed(from, to)) {
    throw new InvalidTransitionError(from, to);
  }
  if (OWNER_MANAGER_ONLY.includes(to) && role !== "OWNER" && role !== "MANAGER") {
    throw new ForbiddenTransitionError(role, to);
  }
  const permission = TRANSITION_PERMISSION[to];
  if (permission && !can(role, permission)) {
    throw new ForbiddenTransitionError(role, to);
  }
}

/** Statuses where the order is still live work for the restaurant. */
export const ACTIVE_ORDER_STATUSES: OrderStatus[] = [
  "PENDING",
  "PAYMENT_PENDING",
  "CONFIRMED",
  "QUEUED",
  "PREPARING",
  "READY",
];

/** Statuses that no longer occupy a pickup slot. */
export const RELEASED_SLOT_STATUSES: OrderStatus[] = ["CANCELLED", "REJECTED"];

export const KITCHEN_BOARD_STATUSES: OrderStatus[] = ["QUEUED", "PREPARING", "READY"];

/**
 * What the customer is told. Deliberately coarser than the internal status —
 * a customer does not need to know the difference between an order that is
 * queued and one that is merely confirmed (docs/PRD.md §27).
 */
export const CUSTOMER_VISIBLE_LABELS: Record<OrderStatus, { ar: string; en: string }> = {
  PENDING: { ar: "تم استلام الطلب", en: "Order Received" },
  PAYMENT_PENDING: { ar: "الدفع قيد المراجعة", en: "Payment Under Review" },
  CONFIRMED: { ar: "تم تأكيد الطلب", en: "Order Confirmed" },
  QUEUED: { ar: "في قائمة التحضير", en: "Queued" },
  PREPARING: { ar: "جاري التحضير", en: "Preparing" },
  READY: { ar: "جاهز للاستلام", en: "Ready for Pickup" },
  COMPLETED: { ar: "تم الاستلام", en: "Completed" },
  REJECTED: { ar: "تم رفض الطلب", en: "Rejected" },
  CANCELLED: { ar: "تم إلغاء الطلب", en: "Cancelled" },
  REFUNDED: { ar: "تم استرداد المبلغ", en: "Refunded" },
};

/** The ordered steps shown on the customer tracking timeline. */
export const CUSTOMER_TIMELINE: OrderStatus[] = [
  "PENDING",
  "CONFIRMED",
  "PREPARING",
  "READY",
  "COMPLETED",
];

export type StatusTone = "neutral" | "info" | "progress" | "success" | "danger";

export const STATUS_TONE: Record<OrderStatus, StatusTone> = {
  PENDING: "neutral",
  PAYMENT_PENDING: "info",
  CONFIRMED: "info",
  QUEUED: "progress",
  PREPARING: "progress",
  READY: "success",
  COMPLETED: "success",
  REJECTED: "danger",
  CANCELLED: "danger",
  REFUNDED: "danger",
};
