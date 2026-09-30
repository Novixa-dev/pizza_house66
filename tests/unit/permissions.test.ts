import { describe, expect, it } from "vitest";
import { can, canAccessAdmin, canAccessKitchen, permissionsFor, PERMISSIONS } from "@/lib/permissions";
import {
  allowedTransitionsForRole,
  assertTransitionAllowed,
  ForbiddenTransitionError,
  InvalidTransitionError,
  isTransitionAllowed,
} from "@/lib/order-state";
import type { OrderStatus, Role } from "@prisma/client";

// The authorization matrix (docs/PRD.md §37, §38) and the order state machine
// (§23). These two together are what stop "the client cannot manipulate order
// state" from being merely an intention.

const ROLES: Role[] = ["OWNER", "MANAGER", "CASHIER", "KITCHEN"];

describe("permission matrix", () => {
  it("gives the owner every permission", () => {
    for (const permission of PERMISSIONS) {
      expect(can("OWNER", permission), permission).toBe(true);
    }
  });

  it("keeps kitchen staff away from money and configuration", () => {
    // docs/PRD.md §38: "Kitchen staff should not have access to sensitive
    // financial or configuration features."
    const forbidden = [
      "payments.verify",
      "payments.reject",
      "payments.receipt.read",
      "settings.update",
      "staff.manage",
      "reports.read",
      "promotions.manage",
      "products.update",
    ] as const;
    for (const permission of forbidden) {
      expect(can("KITCHEN", permission), permission).toBe(false);
    }
  });

  it("gives kitchen staff exactly what the board needs", () => {
    expect(can("KITCHEN", "kitchen.read")).toBe(true);
    expect(can("KITCHEN", "kitchen.update")).toBe(true);
    expect(can("KITCHEN", "orders.read")).toBe(true);
  });

  it("lets a cashier verify payments but not manage staff or the catalog", () => {
    expect(can("CASHIER", "payments.verify")).toBe(true);
    expect(can("CASHIER", "payments.receipt.read")).toBe(true);
    expect(can("CASHIER", "staff.manage")).toBe(false);
    expect(can("CASHIER", "products.update")).toBe(false);
    expect(can("CASHIER", "settings.update")).toBe(false);
  });

  it("lets a manager run the restaurant but not manage staff accounts", () => {
    expect(can("MANAGER", "products.update")).toBe(true);
    expect(can("MANAGER", "promotions.manage")).toBe(true);
    expect(can("MANAGER", "hours.manage")).toBe(true);
    expect(can("MANAGER", "reports.read")).toBe(true);
    expect(can("MANAGER", "staff.manage")).toBe(false);
  });

  it("reserves the audit log for the owner", () => {
    expect(can("OWNER", "audit.read")).toBe(true);
    for (const role of ["MANAGER", "CASHIER", "KITCHEN"] as Role[]) {
      expect(can(role, "audit.read"), role).toBe(false);
    }
  });

  it("grants no role a permission outside the declared list", () => {
    for (const role of ROLES) {
      for (const permission of permissionsFor(role)) {
        expect(PERMISSIONS).toContain(permission);
      }
    }
  });

  it("routes each role to an area it can actually use", () => {
    // Every role must be able to reach at least one screen, or signing in
    // would bounce them in a loop.
    for (const role of ROLES) {
      expect(canAccessAdmin(role) || canAccessKitchen(role), role).toBe(true);
    }
    expect(canAccessAdmin("KITCHEN")).toBe(false);
    expect(canAccessKitchen("KITCHEN")).toBe(true);
  });
});

describe("order state machine", () => {
  it("walks the happy path", () => {
    const path: OrderStatus[] = ["PENDING", "CONFIRMED", "QUEUED", "PREPARING", "READY", "COMPLETED"];
    for (let i = 0; i < path.length - 1; i++) {
      expect(isTransitionAllowed(path[i], path[i + 1]), `${path[i]} → ${path[i + 1]}`).toBe(true);
    }
  });

  it("refuses to skip preparation", () => {
    expect(() => assertTransitionAllowed("PENDING", "READY", "OWNER")).toThrow(InvalidTransitionError);
    expect(() => assertTransitionAllowed("CONFIRMED", "READY", "OWNER")).toThrow(InvalidTransitionError);
  });

  it("treats completed, rejected and refunded as terminal", () => {
    for (const terminal of ["COMPLETED", "REJECTED", "REFUNDED"] as OrderStatus[]) {
      expect(allowedTransitionsForRole(terminal, "OWNER"), terminal).toEqual([]);
    }
  });

  it("never lets an order go backwards", () => {
    expect(isTransitionAllowed("READY", "PREPARING")).toBe(false);
    expect(isTransitionAllowed("PREPARING", "QUEUED")).toBe(false);
    expect(isTransitionAllowed("COMPLETED", "READY")).toBe(false);
  });

  it("stops kitchen staff refunding an order", () => {
    expect(() => assertTransitionAllowed("CANCELLED", "REFUNDED", "KITCHEN")).toThrow(
      ForbiddenTransitionError
    );
    expect(() => assertTransitionAllowed("CANCELLED", "REFUNDED", "CASHIER")).toThrow(
      ForbiddenTransitionError
    );
    expect(() => assertTransitionAllowed("CANCELLED", "REFUNDED", "OWNER")).not.toThrow();
    expect(() => assertTransitionAllowed("CANCELLED", "REFUNDED", "MANAGER")).not.toThrow();
  });

  it("stops kitchen staff cancelling or rejecting an order", () => {
    expect(() => assertTransitionAllowed("QUEUED", "CANCELLED", "KITCHEN")).toThrow(
      ForbiddenTransitionError
    );
    expect(() => assertTransitionAllowed("PENDING", "REJECTED", "KITCHEN")).toThrow(
      ForbiddenTransitionError
    );
  });

  it("lets kitchen staff move food along", () => {
    expect(() => assertTransitionAllowed("QUEUED", "PREPARING", "KITCHEN")).not.toThrow();
    expect(() => assertTransitionAllowed("PREPARING", "READY", "KITCHEN")).not.toThrow();
    expect(() => assertTransitionAllowed("READY", "COMPLETED", "KITCHEN")).not.toThrow();
  });

  it("offers a role only the moves it may actually make", () => {
    expect(allowedTransitionsForRole("QUEUED", "KITCHEN")).toEqual(["PREPARING"]);
    expect(allowedTransitionsForRole("QUEUED", "CASHIER").sort()).toEqual(["CANCELLED", "PREPARING"].sort());
  });

  it("keeps a bank-transfer order out of the kitchen until payment resolves", () => {
    // PAYMENT_PENDING can only become CONFIRMED, REJECTED or CANCELLED —
    // never QUEUED directly (docs/PRD.md §19, §92.B).
    expect(isTransitionAllowed("PAYMENT_PENDING", "QUEUED")).toBe(false);
    expect(isTransitionAllowed("PAYMENT_PENDING", "PREPARING")).toBe(false);
    expect(isTransitionAllowed("PAYMENT_PENDING", "CONFIRMED")).toBe(true);
  });
});
