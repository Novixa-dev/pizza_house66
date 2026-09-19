"use server";

import { revalidatePath } from "next/cache";
import { getSession, roleCanAccessAdmin, roleCanAccessKitchen } from "@/lib/auth";
import { transitionOrder, verifyPayment, rejectPayment, setOnlineOrderingPaused } from "./order-transitions";
import type { OrderStatus } from "@prisma/client";

async function requireStaff(check: (role: import("@prisma/client").Role) => boolean) {
  const session = await getSession();
  if (!session || !check(session.role)) {
    throw new Error("Not authorized");
  }
  return session;
}

export async function transitionOrderAction(orderId: string, toStatus: OrderStatus, reason?: string) {
  const session = await requireStaff((role) => roleCanAccessAdmin(role) || roleCanAccessKitchen(role));
  await transitionOrder(orderId, toStatus, { id: session.userId, role: session.role }, reason);
  revalidatePath("/admin/orders");
  revalidatePath("/kitchen");
}

export async function verifyPaymentAction(paymentId: string) {
  const session = await requireStaff(roleCanAccessAdmin);
  await verifyPayment(paymentId, { id: session.userId, role: session.role });
  revalidatePath("/admin/orders");
  revalidatePath("/kitchen");
}

export async function rejectPaymentAction(paymentId: string, reason: string) {
  const session = await requireStaff(roleCanAccessAdmin);
  await rejectPayment(paymentId, { id: session.userId, role: session.role }, reason);
  revalidatePath("/admin/orders");
}

export async function togglePausedAction(paused: boolean) {
  await requireStaff(roleCanAccessAdmin);
  await setOnlineOrderingPaused(paused);
  revalidatePath("/admin/orders");
  revalidatePath("/", "layout");
}
