// Explicit permission matrix (docs/PRD.md §37).
//
// Roles are coarse; permissions are what the code actually checks. Every
// server action and protected page asks `can(role, "payments.verify")` rather
// than testing `role === "MANAGER"`, so adding a role later is a change to
// this one table instead of a grep across the app.
//
// This is enforced on the server. Hiding a button is presentation, never
// security (docs/PRD.md §37, §73).

import type { Role } from "@prisma/client";

export const PERMISSIONS = [
  "dashboard.read",

  "orders.read",
  "orders.update",
  "orders.cancel",

  "payments.read",
  "payments.verify",
  "payments.reject",
  "payments.receipt.read",

  "products.read",
  "products.create",
  "products.update",
  "products.delete",

  "categories.manage",
  "addons.manage",

  "kitchen.read",
  "kitchen.update",

  "customers.read",

  "promotions.manage",

  "settings.read",
  "settings.update",
  "hours.manage",
  "ordering.pause",

  "reports.read",

  "staff.manage",
  "audit.read",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const KITCHEN_PERMISSIONS: Permission[] = ["kitchen.read", "kitchen.update", "orders.read"];

const CASHIER_PERMISSIONS: Permission[] = [
  "dashboard.read",
  "orders.read",
  "orders.update",
  "orders.cancel",
  "payments.read",
  "payments.verify",
  "payments.reject",
  "payments.receipt.read",
  "products.read",
  "kitchen.read",
  "kitchen.update",
  "customers.read",
  "ordering.pause",
];

const MANAGER_PERMISSIONS: Permission[] = [
  ...CASHIER_PERMISSIONS,
  "products.create",
  "products.update",
  "products.delete",
  "categories.manage",
  "addons.manage",
  "promotions.manage",
  "settings.read",
  "settings.update",
  "hours.manage",
  "reports.read",
];

// The owner holds every permission by definition — listing them again would
// just be a second place to forget one.
const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  OWNER: PERMISSIONS,
  MANAGER: MANAGER_PERMISSIONS,
  CASHIER: CASHIER_PERMISSIONS,
  KITCHEN: KITCHEN_PERMISSIONS,
};

export function can(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

export function canAny(role: Role, permissions: Permission[]): boolean {
  return permissions.some((permission) => can(role, permission));
}

export function permissionsFor(role: Role): readonly Permission[] {
  return ROLE_PERMISSIONS[role];
}

/** Can this role open the staff admin area at all? */
export function canAccessAdmin(role: Role): boolean {
  return can(role, "dashboard.read");
}

/** Can this role open the kitchen display? */
export function canAccessKitchen(role: Role): boolean {
  return can(role, "kitchen.read");
}

export class ForbiddenError extends Error {
  readonly permission: Permission;
  constructor(permission: Permission) {
    super(`Missing permission: ${permission}`);
    this.name = "ForbiddenError";
    this.permission = permission;
  }
}
