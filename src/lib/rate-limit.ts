// Minimal in-memory rate limiter for a single-instance MVP deployment.
// LIMITATION: state is per-process, so this does not work correctly behind
// multiple server instances/replicas — production should move this to a
// shared store (e.g. Redis). See docs/SECURITY.md and docs/DECISIONS.md.

const buckets = new Map<string, { count: number; resetAt: number }>();

export function isRateLimited(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return false;
  }
  bucket.count += 1;
  return bucket.count > limit;
}
