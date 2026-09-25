import "server-only";

// Demo rate limit: a sliding window per key in process memory. Enough for one Node process (next start);
// on serverless or several instances it must live in a shared store (Redis/KV/DB) instead.
const hits = new Map<string, number[]>();

/** true = allowed (and counted); false = the key already made `limit` calls within `windowMs`. */
export function takeRateLimit(key: string, limit: number, windowMs: number, now = Date.now()): boolean {
  const recent = (hits.get(key) ?? []).filter((at) => now - at < windowMs);
  if (recent.length >= limit) {
    hits.set(key, recent);
    return false;
  }
  recent.push(now);
  hits.set(key, recent);
  return true;
}
