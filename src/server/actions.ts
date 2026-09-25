"use server";

import { revalidatePath } from "next/cache";
import type { OrderStatus } from "@prisma/client";
import { requirePermission } from "@/lib/auth";
import { ForbiddenError, type Permission } from "@/lib/permissions";
import { ForbiddenTransitionError, InvalidTransitionError } from "@/lib/order-state";
import {
  ConcurrentUpdateError,
  OrderNotFoundError,
  rejectPayment,
  setOnlineOrderingPaused,
  transitionOrder,
  type StaffActor,
} from "./order-transitions";
import { verifyPayment } from "./order-transitions";

// Staff mutations run as Server Actions rather than REST endpoints: they are
// server-only by construction, Next.js gives them CSRF protection, and the
// admin screens stay server components with plain <form action={…}> so they
// work before hydration on a slow kitchen tablet (docs/ARCHITECTURE.md).
//
// Every action starts with `requirePermission`. An action that forgot to is a
// hole, so the pattern is uniform and deliberately boring.

export interface ActionResult {
  ok: boolean;
  /** Machine-readable code; the caller localizes it. */
  error?: string;
}

async function actor(permission: Permission): Promise<StaffActor> {
  const session = await requirePermission(permission);
  return { id: session.userId, name: session.name, role: session.role };
}

/**
 * Maps domain errors to codes the UI can translate, and lets nothing else
 * escape to the browser — a stack trace on a staff screen is still a leak
 * (docs/PRD.md §62).
 */
function toResult(error: unknown): ActionResult {
  if (error instanceof ForbiddenError || error instanceof ForbiddenTransitionError) {
    return { ok: false, error: "FORBIDDEN" };
  }
  if (error instanceof InvalidTransitionError) {
    return { ok: false, error: "INVALID_TRANSITION" };
  }
  if (error instanceof ConcurrentUpdateError) {
    return { ok: false, error: "CONCURRENT_UPDATE" };
  }
  if (error instanceof OrderNotFoundError) {
    return { ok: false, error: "NOT_FOUND" };
  }
  console.error("[actions] unhandled failure", error);
  return { ok: false, error: "INTERNAL_ERROR" };
}

function revalidateOperations(): void {
  revalidatePath("/admin");
  revalidatePath("/admin/orders");
  revalidatePath("/admin/payments");
  revalidatePath("/kitchen");
}

export async function transitionOrderAction(
  orderId: string,
  toStatus: OrderStatus,
  reason?: string
): Promise<ActionResult> {
  try {
    // Kitchen moves need kitchen rights; confirmations and cancellations need
    // order rights. `assertTransitionAllowed` re-checks the specific
    // permission for the target status, so this is the coarse gate only.
    const permission: Permission =
      toStatus === "PREPARING" || toStatus === "READY" || toStatus === "COMPLETED"
        ? "kitchen.update"
        : toStatus === "CANCELLED"
          ? "orders.cancel"
          : "orders.update";
    const staff = await actor(permission);
    await transitionOrder(orderId, toStatus, staff, reason);
    revalidateOperations();
    return { ok: true };
  } catch (error) {
    return toResult(error);
  }
}

export async function verifyPaymentAction(paymentId: string): Promise<ActionResult> {
  try {
    const staff = await actor("payments.verify");
    await verifyPayment(paymentId, staff);
    revalidateOperations();
    return { ok: true };
  } catch (error) {
    return toResult(error);
  }
}

export async function rejectPaymentAction(
  paymentId: string,
  reason: string
): Promise<ActionResult> {
  try {
    const staff = await actor("payments.reject");
    await rejectPayment(paymentId, staff, reason.trim() || "rejected_by_staff");
    revalidateOperations();
    return { ok: true };
  } catch (error) {
    return toResult(error);
  }
}

export async function togglePausedAction(paused: boolean): Promise<ActionResult> {
  try {
    const staff = await actor("ordering.pause");
    await setOnlineOrderingPaused(paused, staff);
    revalidateOperations();
    // The customer-facing shell reads the pause flag in its layout, so the
    // whole public tree has to be revalidated, not just one route.
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (error) {
    return toResult(error);
  }
}

/**
 * Form-action wrappers.
 *
 * A `<form action={…}>` handler receives FormData and must return void, so
 * these adapt the typed actions above. Errors are re-thrown to the nearest
 * error boundary rather than swallowed — a failed verification that looks
 * like a success is the worst outcome on a payments screen.
 */
export async function transitionOrderFormAction(formData: FormData): Promise<void> {
  const orderId = String(formData.get("orderId") ?? "");
  const toStatus = String(formData.get("toStatus") ?? "") as OrderStatus;
  const reason = formData.get("reason");
  const result = await transitionOrderAction(
    orderId,
    toStatus,
    typeof reason === "string" && reason.trim() ? reason.trim() : undefined
  );
  if (!result.ok) throw new Error(result.error ?? "ACTION_FAILED");
}

export async function verifyPaymentFormAction(formData: FormData): Promise<void> {
  const result = await verifyPaymentAction(String(formData.get("paymentId") ?? ""));
  if (!result.ok) throw new Error(result.error ?? "ACTION_FAILED");
}

export async function rejectPaymentFormAction(formData: FormData): Promise<void> {
  const result = await rejectPaymentAction(
    String(formData.get("paymentId") ?? ""),
    String(formData.get("reason") ?? "")
  );
  if (!result.ok) throw new Error(result.error ?? "ACTION_FAILED");
}

export async function togglePausedFormAction(formData: FormData): Promise<void> {
  const result = await togglePausedAction(formData.get("paused") === "true");
  if (!result.ok) throw new Error(result.error ?? "ACTION_FAILED");
}
