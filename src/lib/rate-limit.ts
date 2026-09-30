// In-process rate limiting.
//
// LIMITATION, stated plainly: the counters live in this process's memory, so
// on a platform that runs several instances each one enforces its own limit.
// For a single-location pilot that is adequate, and it beats shipping no
// limit at all. Moving to a shared store (Redis, or the host's own edge rate
// limiting) is a change to this file only — every caller goes through
// `checkRateLimit` (docs/SECURITY.md, docs/DECISIONS.md).

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();
let lastSweep = Date.now();
const SWEEP_INTERVAL_MS = 60_000;

/** Drops expired buckets so a long-lived process doesn't grow unbounded. */
function sweep(now: number): void {
  if (now - lastSweep < SWEEP_INTERVAL_MS) return;
  lastSweep = now;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt < now) buckets.delete(key);
  }
}

export interface RateLimitResult {
  limited: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

export function checkRateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  sweep(now);

  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { limited: false, remaining: limit - 1, retryAfterSeconds: Math.ceil(windowMs / 1000) };
  }

  bucket.count += 1;
  const retryAfterSeconds = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
  return {
    limited: bucket.count > limit,
    remaining: Math.max(0, limit - bucket.count),
    retryAfterSeconds,
  };
}

/** Back-compatible boolean form. */
export function isRateLimited(key: string, limit: number, windowMs: number): boolean {
  return checkRateLimit(key, limit, windowMs).limited;
}

/**
 * Best-effort client identity for rate limiting.
 *
 * `x-forwarded-for` is trivially spoofable in general, but behind a hosting
 * proxy that rewrites it (Vercel does) the left-most entry is the real peer.
 * This is a throttle, not an authorization decision, so that is an acceptable
 * basis — nothing here grants access.
 */
export function clientKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}

/**
 * Failure-counting variant, for login throttling.
 *
 * `checkRateLimit` counts every call, which is right for an endpoint where
 * each request costs something. Authentication is different: a successful
 * sign-in should not eat into the budget, or a shift change behind one NAT'd
 * address locks the whole restaurant out. So the check and the increment are
 * separate calls, and only a failure increments.
 */
export function isLoginBlocked(key: string, limit: number): boolean {
  const now = Date.now();
  sweep(now);
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt < now) return false;
  return bucket.count >= limit;
}

export function recordLoginFailure(key: string, windowMs: number): void {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }
  bucket.count += 1;
}

/** Test seam — resets all counters. */
export function __resetRateLimits(): void {
  buckets.clear();
}
