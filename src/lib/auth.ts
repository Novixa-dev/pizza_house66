import "server-only";

import { SignJWT, jwtVerify } from "jose";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import type { Role } from "@prisma/client";
import { can, canAccessAdmin, canAccessKitchen, ForbiddenError, type Permission } from "./permissions";

// Staff authentication (docs/PRD.md §39).
//
// Signed, HttpOnly session cookies rather than a full auth library:
// deliberately small for the MVP, and isolated behind this module so it can
// be swapped for a managed provider later without touching any call site.
// Customers never authenticate — guest checkout is the only ordering path.

const SESSION_COOKIE = "ph_session";
const SESSION_TTL_SECONDS = 60 * 60 * 8; // one working shift

export const SESSION_COOKIE_NAME = SESSION_COOKIE;

function getSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    // Failing loudly beats signing sessions with a guessable key. A short or
    // missing secret is a deployment mistake, not a runtime condition to
    // paper over.
    throw new Error(
      "AUTH_SECRET is missing or shorter than 32 characters. Generate one with `openssl rand -base64 32`."
    );
  }
  return new TextEncoder().encode(secret);
}

export interface SessionPayload {
  userId: string;
  role: Role;
  name: string;
}

/**
 * Whether to mark cookies `Secure`, decided from the protocol actually in
 * use rather than from NODE_ENV.
 *
 * Keying this off NODE_ENV alone breaks any production-mode run over plain
 * HTTP — a staging box, a LAN kitchen tablet, or an end-to-end suite against
 * a local `next start` — because the browser silently refuses to store a
 * Secure cookie on an insecure origin, and the symptom is "login does
 * nothing". Real deployments terminate TLS at a proxy that sets
 * `x-forwarded-proto`, so this stays `true` everywhere it matters.
 */
async function shouldUseSecureCookies(): Promise<boolean> {
  if (process.env.NODE_ENV !== "production") return false;
  const headerList = await headers();
  const forwardedProto = headerList.get("x-forwarded-proto")?.split(",")[0]?.trim();
  if (forwardedProto) return forwardedProto === "https";
  // No proxy header: fall back to the configured public origin, and default
  // to secure when nothing says otherwise.
  const configured = process.env.NEXT_PUBLIC_APP_URL;
  if (configured) return configured.startsWith("https://");
  return true;
}

export async function createSession(payload: SessionPayload): Promise<void> {
  const token = await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(getSecret());

  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: await shouldUseSecureCookies(),
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

export async function getSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecret());
    const role = payload.role as Role;
    const userId = payload.userId as string;
    const name = payload.name as string;
    if (!userId || !role || !name) return null;
    return { userId, role, name };
  } catch {
    // Expired, tampered, or signed with a rotated secret — all mean "no session".
    return null;
  }
}

export class UnauthenticatedError extends Error {
  constructor() {
    super("Authentication required");
    this.name = "UnauthenticatedError";
  }
}

export interface StaffSession extends SessionPayload {
  can: (permission: Permission) => boolean;
}

/**
 * Loads the session and asserts a permission. Every server action and
 * protected page starts here — authorization is a server fact, never an
 * inference from which buttons the UI rendered (docs/PRD.md §37, §92.G).
 */
export async function requirePermission(permission: Permission): Promise<StaffSession> {
  const session = await getSession();
  if (!session) throw new UnauthenticatedError();
  if (!can(session.role, permission)) throw new ForbiddenError(permission);
  return withHelpers(session);
}

/**
 * The page-level counterpart to `requirePermission`.
 *
 * A page can't usefully *throw* an authorization failure: the generic error
 * boundary would say "something went wrong", which is both unhelpful and
 * indistinguishable from a real fault. So a page redirects instead — to the
 * login screen when there is no session, and to an explicit no-access screen
 * when the session simply lacks the permission.
 *
 * (Next.js 16 ships `forbidden()` for exactly this, but only behind the
 * experimental `authInterrupts` flag; a client deliverable shouldn't depend
 * on an experimental toggle. Revisit once it is stable — see docs/DECISIONS.md.)
 */
export async function requirePagePermission(permission: Permission): Promise<StaffSession> {
  const session = await getSession();
  if (!session) {
    redirect(`/admin/login?next=${encodeURIComponent(await currentPath())}`);
  }
  if (!can(session.role, permission)) {
    redirect(`/admin/no-access?permission=${encodeURIComponent(permission)}`);
  }
  return withHelpers(session);
}

async function currentPath(): Promise<string> {
  const headerList = await headers();
  return headerList.get("x-pathname") ?? "/admin";
}

/** For pages that only need "is a staff member signed in". */
export async function requireSession(): Promise<StaffSession> {
  const session = await getSession();
  if (!session) throw new UnauthenticatedError();
  return withHelpers(session);
}

function withHelpers(session: SessionPayload): StaffSession {
  return { ...session, can: (permission) => can(session.role, permission) };
}

export { canAccessAdmin as roleCanAccessAdmin, canAccessKitchen as roleCanAccessKitchen };
