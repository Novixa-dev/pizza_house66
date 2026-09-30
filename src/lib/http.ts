import { NextResponse } from "next/server";

/**
 * A same-origin redirect.
 *
 * `NextResponse.redirect()` requires an absolute URL and the usual way to get
 * one is `new URL(path, request.url)`. That is a trap: `request.url` is the
 * URL as the *server* resolved it, which is not always the origin the browser
 * used. A request to `http://127.0.0.1:3000` can come back as
 * `http://localhost:3000`, and behind a proxy it can be an internal hostname
 * entirely. The resulting `Location` is then cross-origin, which:
 *
 *   - trips `form-action 'self'`, so a form POST that redirects is refused by
 *     the browser and login silently does nothing; and
 *   - can bounce a user off the domain they were actually using.
 *
 * A relative `Location` (RFC 7231 §7.1.2) is resolved by the browser against
 * the request URL, so it is same-origin by construction and needs no guessing
 * about hosts or forwarded headers.
 *
 * 303 is the default: after a POST it tells the browser to follow up with a
 * GET, which is what every one of these flows wants.
 */
export function redirectSameOrigin(path: string, status: 303 | 302 | 307 = 303): NextResponse {
  return new NextResponse(null, {
    status,
    headers: { Location: ensureSameOriginPath(path) },
  });
}

/**
 * Forces a caller-supplied path to stay on this site.
 *
 * Anything that isn't a single-slash-rooted path — an absolute URL, a
 * protocol-relative `//evil.example`, a backslash variant that some browsers
 * normalize — falls back to the site root. This is the guard that keeps
 * `?next=` from becoming an open redirect.
 */
export function ensureSameOriginPath(path: string, fallback = "/"): string {
  if (!path.startsWith("/")) return fallback;
  if (path.startsWith("//") || path.startsWith("/\\")) return fallback;
  return path;
}

/** Adds or replaces a query parameter on a relative path. */
export function withQuery(path: string, params: Record<string, string | undefined>): string {
  const [pathname, existing = ""] = path.split("?");
  const query = new URLSearchParams(existing);
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === "") query.delete(key);
    else query.set(key, value);
  }
  const serialized = query.toString();
  return serialized ? `${pathname}?${serialized}` : pathname;
}
