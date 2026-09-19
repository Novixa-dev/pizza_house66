import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

// Edge-safe re-implementation of the session check (docs/SECURITY.md —
// authorization must never rely on the UI alone). Role-specific checks
// happen again in each protected layout/page since middleware only knows
// "is there a valid session", not which staff role it is.
async function hasValidSession(request: NextRequest): Promise<boolean> {
  const token = request.cookies.get("ph_session")?.value;
  if (!token) return false;
  const secret = process.env.AUTH_SECRET;
  if (!secret) return false;
  try {
    await jwtVerify(token, new TextEncoder().encode(secret));
    return true;
  } catch {
    return false;
  }
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isLoginPage = pathname === "/admin/login";
  const isProtected = (pathname.startsWith("/admin") || pathname.startsWith("/kitchen")) && !isLoginPage;

  if (isProtected && !(await hasValidSession(request))) {
    const loginUrl = new URL("/admin/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/kitchen/:path*"],
};
