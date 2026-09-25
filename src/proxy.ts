import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";

// Runs before every matched request (Next.js 16 renamed Middleware to Proxy).
//
// Three jobs, in order of importance:
//   1. Keep signed-out visitors out of staff routes.
//   2. Set security headers, including a nonce-based CSP.
//   3. Issue the anonymous analytics session id.
//
// Note the deliberate limit on (1): this is an *optimistic* check — it proves
// a session cookie is validly signed, nothing more. It cannot tell an OWNER
// from a KITCHEN user, so every protected page and every server action
// re-checks the actual permission on the server. Proxy is a redirect for
// convenience; the real authorization boundary is in the page and the action
// (docs/SECURITY.md).

const SESSION_COOKIE = "ph_session";
const ANALYTICS_COOKIE = "ph_sid";
const ANALYTICS_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

async function hasValidSession(request: NextRequest): Promise<boolean> {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return false;
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) return false;
  try {
    await jwtVerify(token, new TextEncoder().encode(secret));
    return true;
  } catch {
    return false;
  }
}

function buildCsp(nonce: string, isDev: boolean, isHttps: boolean): string {
  return [
    "default-src 'self'",
    // 'strict-dynamic' lets Next's nonced bootstrap load the chunks it needs
    // without listing every hashed filename. 'unsafe-eval' is a development
    // requirement of React's debug tooling and is absent in production.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    // Styles stay 'unsafe-inline': next/font and Tailwind emit inline style
    // elements, and an injected stylesheet is a far smaller risk than an
    // injected script. Revisit if the framework starts noncing them reliably.
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "img-src 'self' blob: data:",
    "font-src 'self' https://fonts.gstatic.com data:",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    // Only meaningful when the page itself came over HTTPS. On a plain-HTTP
    // origin this directive rewrites same-origin form posts to https://,
    // which then fails `form-action 'self'` because the scheme no longer
    // matches — login silently stops working on any non-TLS deployment
    // (a staging box, a LAN kitchen tablet, an end-to-end run against a
    // local production build). There is nothing to upgrade there anyway.
    ...(isHttps ? ["upgrade-insecure-requests"] : []),
  ].join("; ");
}

function randomId(): string {
  return crypto.randomUUID().replace(/-/g, "");
}

/** The origin the browser actually used, honouring a TLS-terminating proxy. */
function requestOrigin(request: NextRequest): string {
  const host =
    request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? request.nextUrl.host;
  const proto =
    request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() ??
    request.nextUrl.protocol.replace(":", "");
  return `${proto}://${host}`;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isLoginPage = pathname === "/admin/login";
  const isStaffRoute = pathname.startsWith("/admin") || pathname.startsWith("/kitchen");

  if (isStaffRoute && !isLoginPage && !(await hasValidSession(request))) {
    // Proxy redirects must carry an absolute Location — Next parses the
    // header as a URL — so build one from the host the browser actually
    // used rather than from `request.url`, which can resolve to a different
    // hostname (localhost vs 127.0.0.1, or an internal name behind a proxy)
    // and bounce the user off the origin they were on.
    const loginUrl = new URL("/admin/login", requestOrigin(request));
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl, 307);
  }

  const nonce = Buffer.from(randomId()).toString("base64");
  const isDev = process.env.NODE_ENV === "development";
  // Behind a TLS-terminating proxy (Vercel and friends) the inbound URL is
  // http, so trust the forwarded scheme when one is present.
  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const isHttps = forwardedProto
    ? forwardedProto === "https"
    : request.nextUrl.protocol === "https:";
  const csp = buildCsp(nonce, isDev, isHttps);

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);
  // Server components can read headers but not the current path; the admin
  // shell needs it to mark the active nav item.
  requestHeaders.set("x-pathname", pathname);

  const response = NextResponse.next({ request: { headers: requestHeaders } });

  response.headers.set("Content-Security-Policy", csp);
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()");

  // An opaque, non-identifying id so the conversion funnel can count people
  // rather than page loads. It carries no personal data and is never joined
  // to a customer record (docs/PRD.md §52).
  if (!request.cookies.get(ANALYTICS_COOKIE) && !isStaffRoute) {
    response.cookies.set(ANALYTICS_COOKIE, randomId(), {
      httpOnly: true,
      sameSite: "lax",
      // Secure only when the request actually arrived over HTTPS; a Secure
      // cookie on an http:// origin is silently dropped by the browser.
      secure: request.nextUrl.protocol === "https:",
      path: "/",
      maxAge: ANALYTICS_COOKIE_MAX_AGE,
    });
  }

  return response;
}

export const config = {
  matcher: [
    // Everything except static assets and image optimization, which need no
    // session check and would only pay the cost of one.
    "/((?!_next/static|_next/image|favicon.ico|menu/|brand/|manifest.webmanifest|robots.txt|sitemap.xml).*)",
  ],
};
