import type { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { createSession } from "@/lib/auth";
import { clientKey, isLoginBlocked, recordLoginFailure } from "@/lib/rate-limit";
import { canAccessAdmin, canAccessKitchen } from "@/lib/permissions";
import { recordAudit } from "@/server/audit";
import { ensureSameOriginPath, redirectSameOrigin, withQuery } from "@/lib/http";

// Staff sign-in.
//
// A plain form POST, so it works without JavaScript on a kitchen tablet, and
// so Next.js's own CSRF protections for Server Actions are not something we
// have to reimplement for a credential form.

export const dynamic = "force-dynamic";

// A comparison against a real bcrypt hash even when the account does not
// exist, so response timing does not reveal which emails are registered.
const DUMMY_HASH = "$2b$12$0000000000000000000000000000000000000000000000000000";

const IP_FAILURE_LIMIT = 20;
const IP_WINDOW_MS = 10 * 60_000;
const ACCOUNT_FAILURE_LIMIT = 5;
const ACCOUNT_WINDOW_MS = 5 * 60_000;

function redirectWithError(error: string, next?: string) {
  return redirectSameOrigin(withQuery("/admin/login", { error, next }));
}

/**
 * Where to send someone after a successful sign-in.
 *
 * Two separate concerns: the path must be on this site (open-redirect
 * protection, handled by `ensureSameOriginPath`), and the role must actually
 * be able to use it — otherwise a kitchen account following an /admin link
 * would log in only to be bounced straight back out.
 */
function safeNext(raw: string, role: "OWNER" | "MANAGER" | "CASHIER" | "KITCHEN"): string {
  const fallback = canAccessAdmin(role) ? "/admin" : "/kitchen";
  const path = ensureSameOriginPath(raw, fallback);
  if (path === fallback) return fallback;
  if (path.startsWith("/admin") && !canAccessAdmin(role)) return fallback;
  if (path.startsWith("/kitchen") && !canAccessKitchen(role)) return fallback;
  if (path.startsWith("/admin/login")) return fallback;
  return path;
}

export async function POST(request: NextRequest) {
  const form = await request.formData();
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  const next = String(form.get("next") ?? "");

  // Two throttles, and both count *failures only*.
  //
  // Counting successful logins as well would punish the normal case: a
  // restaurant's staff all sign in from one connection at shift change, and
  // behind NAT they share an address. Failed attempts are the thing worth
  // rationing (docs/PRD.md §39).
  //
  //   per IP      — blunt protection against a burst from one source
  //   per account — so a distributed attempt can't walk one account's
  //                 password space from many addresses
  const ip = clientKey(request);
  if (isLoginBlocked(`login:ip:${ip}`, IP_FAILURE_LIMIT)) {
    return redirectWithError("rate_limited", next);
  }
  if (email && isLoginBlocked(`login:email:${email}`, ACCOUNT_FAILURE_LIMIT)) {
    return redirectWithError("rate_limited", next);
  }

  const user = email ? await prisma.user.findUnique({ where: { email } }) : null;
  const passwordOk = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);

  if (!user || !user.active || !passwordOk) {
    recordLoginFailure(`login:ip:${ip}`, IP_WINDOW_MS);
    if (email) recordLoginFailure(`login:email:${email}`, ACCOUNT_WINDOW_MS);
    return redirectWithError("invalid", next);
  }

  await createSession({ userId: user.id, role: user.role, name: user.name });
  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await recordAudit({
    actor: { id: user.id, name: user.name },
    action: "auth.login",
    entity: "User",
    entityId: user.id,
  });

  return redirectSameOrigin(safeNext(next, user.role));
}
