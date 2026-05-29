// Lightweight in-memory rate limiter — first-layer abuse/burst guard for the
// AI endpoints (scan struk, parse transaksi, insights, import, research).
//
// LIMITATION: state is per serverless instance (not distributed), so under
// heavy fan-out the effective limit is per-instance. That's fine as a first
// layer: it stops a single client's rapid-fire loop, and the AI CREDIT system
// already enforces the hard MONTHLY cost ceiling. For production-grade global
// limiting, swap the store below for Upstash Redis (@upstash/ratelimit) or a
// Supabase RPC — the call sites don't need to change.

type Bucket = { count: number; resetAt: number }

const buckets = new Map<string, Bucket>()

export interface RateLimitResult {
  ok: boolean
  remaining: number
  retryAfterSec: number
}

/**
 * Fixed-window rate limit. Returns ok=false when the key exceeds `limit`
 * requests within `windowMs`. Default: 30 requests / 60s.
 */
export function rateLimit(
  key: string,
  { limit = 30, windowMs = 60_000 }: { limit?: number; windowMs?: number } = {},
): RateLimitResult {
  const now = Date.now()
  const b = buckets.get(key)

  if (!b || now >= b.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    // Opportunistic cleanup so the Map can't grow unbounded.
    if (buckets.size > 5000) {
      for (const [k, v] of buckets) if (now >= v.resetAt) buckets.delete(k)
    }
    return { ok: true, remaining: limit - 1, retryAfterSec: 0 }
  }

  if (b.count >= limit) {
    return { ok: false, remaining: 0, retryAfterSec: Math.max(1, Math.ceil((b.resetAt - now) / 1000)) }
  }

  b.count += 1
  return { ok: true, remaining: limit - b.count, retryAfterSec: 0 }
}
