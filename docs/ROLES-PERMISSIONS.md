# Roles & Permissions

Source of truth: `src/lib/permissions.ts`. Nothing in this document is
duplicated logic — it is that file, explained.

## The rule that shapes everything

**Code never asks what role someone has. It asks what they are allowed to
do.**

```ts
// not this
if (session.role === "MANAGER" || session.role === "OWNER") { … }

// this
await requirePermission("payments.verify");
```

Role checks scatter a policy across a codebase: adding a "Shift Supervisor"
role means finding every comparison and deciding whether it applies. A
permission matrix puts the policy in one table, and adding a role is one line
in that table. It also makes the policy readable by someone who is not going
to read the code — this document is a rendering of a data structure, not a
description of behaviour someone has to keep in sync.

## The four roles

| Role | Who | Shape of the job |
|---|---|---|
| `OWNER` | The restaurant's owner | Everything, including staff accounts and the audit log |
| `MANAGER` | Day-to-day manager | Everything operational: menu, prices, promotions, hours, settings, reports. Not staff accounts, not the audit log |
| `CASHIER` | Front counter | Takes and verifies orders and payments. Reads the menu, cannot change it |
| `KITCHEN` | Cooks | The kitchen display, and nothing else. No prices, no customers, no payments |

`KITCHEN` is deliberately the narrowest role in the system. A kitchen tablet
sits on a counter all shift, unlocked, in a room where anyone might walk past.
Its session should be worth as little as possible if someone picks it up.

## The matrix

| Permission | OWNER | MANAGER | CASHIER | KITCHEN |
|---|:--:|:--:|:--:|:--:|
| `dashboard.read` | ● | ● | ● | |
| `orders.read` | ● | ● | ● | ● |
| `orders.update` | ● | ● | ● | |
| `orders.cancel` | ● | ● | ● | |
| `payments.read` | ● | ● | ● | |
| `payments.verify` | ● | ● | ● | |
| `payments.reject` | ● | ● | ● | |
| `payments.receipt.read` | ● | ● | ● | |
| `products.read` | ● | ● | ● | |
| `products.create` | ● | ● | | |
| `products.update` | ● | ● | | |
| `products.delete` | ● | ● | | |
| `categories.manage` | ● | ● | | |
| `addons.manage` | ● | ● | | |
| `kitchen.read` | ● | ● | ● | ● |
| `kitchen.update` | ● | ● | ● | ● |
| `customers.read` | ● | ● | ● | |
| `promotions.manage` | ● | ● | | |
| `settings.read` | ● | ● | | |
| `settings.update` | ● | ● | | |
| `hours.manage` | ● | ● | | |
| `ordering.pause` | ● | ● | ● | |
| `reports.read` | ● | ● | | |
| `staff.manage` | ● | | | |
| `audit.read` | ● | | | |

`OWNER` holds every permission by construction (`OWNER: PERMISSIONS`) rather
than by a second list — a second list is a second place to forget one.

### Two entries worth explaining

**`ordering.pause` reaches the cashier.** Pausing online ordering is what you
do when the kitchen is drowning or an ingredient has run out. Making the
person at the counter walk away to find a manager is how a restaurant ends up
taking orders it cannot cook. It is reversible, audited, and visible to
everyone the moment it happens.

**Refunds are not in the matrix alone.** `REFUNDED` additionally requires
`OWNER` or `MANAGER` explicitly, in `src/lib/order-state.ts`. It is the one
transition that moves money back out, so it does not ride on a permission a
cashier holds for a different purpose.

## Where it is enforced

Four layers, and only the last three are security:

**1. The UI hides what you cannot do.** Nav items and buttons are filtered by
`session.can(...)`. This is courtesy — a screen full of controls that error
is a bad screen. It is *not* a control.

**2. Proxy redirects anonymous requests.** `src/proxy.ts` bounces any
`/admin/*` or `/kitchen/*` request without a validly signed session cookie to
the login page. It deliberately does not check the role: at the edge, all it
can do is verify a signature. It is a redirect for convenience.

**3. Every page re-checks.** Each admin page begins with
`requirePagePermission("…")`, which loads the session server-side and
redirects to `/admin/no-access?permission=…` if it is missing. The no-access
page names the permission, because "you do not have access" without saying to
what is a support call.

**4. Every mutation re-checks.** Each Server Action begins with
`requirePermission("…")`, which throws `ForbiddenError`. This is the real
boundary. A Server Action is a POST endpoint with a generated URL; it is
reachable by anyone who can read the page source, so it is checked as if the
UI did not exist — because for an attacker it does not.

`tests/e2e/staff-and-security.spec.ts` drives this from the outside: it signs
in as `KITCHEN` and confirms `/admin/settings`, `/admin/staff`,
`/admin/reports` and `/admin/audit` are refused, and signs in as `CASHIER` to
confirm the payments queue opens while staff management does not.

## Adding a role

1. Add it to `enum Role` in `prisma/schema.prisma`, and migrate.
2. Add its permission list to `ROLE_PERMISSIONS` in `src/lib/permissions.ts`.
3. Add its label to the dictionaries in `src/lib/i18n/dictionaries.ts`.
4. Add a row to the table above.

That is the whole change. No page, action, or component needs touching — they
ask about permissions, and the new role answers.

## Adding a permission

Add the string to `PERMISSIONS`, grant it in the role lists that should have
it, and call `requirePermission` / `requirePagePermission` with it. The union
type is derived from the array, so a typo is a compile error rather than a
silent `false`.
