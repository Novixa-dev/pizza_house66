import "server-only";

import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";

// Audit trail for staff actions (docs/PRD.md §61).
//
// Order and payment status changes already have their own dedicated history
// tables, which carry richer, queryable state. This log covers everything
// else a staff member can change — prices, availability, hours, settings,
// accounts — so that "who put the price up on Thursday?" has an answer.
//
// `actorName` is denormalized on purpose: deleting a staff account nulls the
// foreign key, and a trail that forgets who did something is not a trail.

export interface AuditActor {
  id: string;
  name: string;
}

export type AuditAction =
  | "order.transition"
  | "order.cancel"
  | "payment.verify"
  | "payment.reject"
  | "payment.receipt.view"
  | "product.create"
  | "product.update"
  | "product.delete"
  | "product.availability"
  | "category.create"
  | "category.update"
  | "category.delete"
  | "promotion.create"
  | "promotion.update"
  | "promotion.delete"
  | "coupon.granted"
  | "hours.update"
  | "hours.override.create"
  | "hours.override.delete"
  | "settings.update"
  | "payment-method.update"
  | "ordering.pause"
  | "ordering.resume"
  | "staff.create"
  | "staff.update"
  | "staff.delete"
  | "auth.login";

export async function recordAudit(params: {
  actor: AuditActor | null;
  action: AuditAction;
  entity: string;
  entityId?: string | null;
  metadata?: Prisma.InputJsonValue;
}): Promise<void> {
  // An audit write must never be the reason a legitimate staff action fails.
  // The action itself is already committed by the time we get here; losing a
  // log line is bad, rolling back a verified payment because of one is worse.
  try {
    await prisma.auditLog.create({
      data: {
        actorId: params.actor?.id ?? null,
        actorName: params.actor?.name ?? null,
        action: params.action,
        entity: params.entity,
        entityId: params.entityId ?? null,
        metadata: params.metadata,
      },
    });
  } catch (error) {
    console.error("[audit] failed to record entry", params.action, error);
  }
}

export async function listAuditEntries(limit = 100) {
  return prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

/**
 * Shallow diff of the fields that actually changed, for audit metadata.
 *
 * Values are normalized to JSON-safe primitives so the result can be stored
 * directly in the log's `metadata` column — a Date or a Decimal would fail at
 * the database boundary, which is not where an audit write should discover it.
 */
export type AuditDiff = Record<string, { from: Prisma.JsonValue; to: Prisma.JsonValue }>;

export function diffFields<T extends Record<string, unknown>>(
  before: T,
  after: Partial<T>
): AuditDiff {
  const changes: AuditDiff = {};
  for (const [key, nextValue] of Object.entries(after)) {
    const previousValue = before[key];
    if (nextValue === undefined) continue;
    const normalize = (value: unknown): Prisma.JsonValue => {
      if (value instanceof Date) return value.toISOString();
      if (value === null || value === undefined) return null;
      if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
        return value;
      }
      return String(value);
    };
    if (normalize(previousValue) !== normalize(nextValue)) {
      changes[key] = { from: normalize(previousValue), to: normalize(nextValue) };
    }
  }
  return changes;
}
