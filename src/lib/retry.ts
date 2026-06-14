/**
 * Resilience helpers untuk call upstream (Yahoo/Binance) — exponential backoff
 * + per-key circuit breaker. Pure, tanpa dependency (pakai setTimeout global).
 *
 * State breaker disimpan di MEMORI per warm serverless instance (best-effort,
 * sama batasannya dgn src/lib/rate-limit.ts) — BUKAN terdistribusi. Cukup buat
 * fail-fast saat satu instance kena outage beruntun; bukan global consistency.
 *
 * Catatan: JANGAN bungkus call Anthropic SDK dgn withRetry — SDK-nya (@anthropic-
 * ai/sdk) sudah retry+backoff sendiri (maxRetries default 2). Anthropic cukup
 * di-gate withBreaker kalau mau fail-fast saat outage panjang.
 */

export interface RetryOptions {
  retries?: number
  baseDelayMs?: number
  maxDelayMs?: number
  factor?: number
  jitter?: boolean
  /** Default: retry buat abort/timeout/network + HTTP 429/5xx (di-parse dari pesan error). */
  shouldRetry?: (err: unknown) => boolean
  signal?: AbortSignal
  onRetry?: (err: unknown, attempt: number) => void
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new Error('aborted'))
    const t = setTimeout(resolve, ms)
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(t)
        reject(new Error('aborted'))
      },
      { once: true },
    )
  })
}

/** Retry default: idempotent failures saja — abort/timeout/network + HTTP 429/5xx. */
export function defaultShouldRetry(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err)
  if (/abort|timeout|network|ECONN|ETIMEDOUT|ENOTFOUND|fetch failed/i.test(msg)) return true
  const m = msg.match(/\b(\d{3})\b/)
  if (m) {
    const status = parseInt(m[1], 10)
    return status === 429 || status >= 500
  }
  return false // 4xx selain 429 (mis. 400 bad symbol, 404) = deterministik, jangan retry
}

export async function withRetry<T>(fn: () => Promise<T>, opts: RetryOptions = {}): Promise<T> {
  const {
    retries = 2,
    baseDelayMs = 300,
    maxDelayMs = 4000,
    factor = 2,
    jitter = true,
    shouldRetry = defaultShouldRetry,
    signal,
    onRetry,
  } = opts

  let lastErr: unknown
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (signal?.aborted) throw new Error('aborted')
    try {
      return await fn()
    } catch (err) {
      lastErr = err
      // Attempt terakhir, atau error non-retryable → lempar apa adanya (jaga
      // jalur catch/degradasi yang ada).
      if (attempt === retries || !shouldRetry(err)) throw err
      onRetry?.(err, attempt)
      const base = Math.min(maxDelayMs, baseDelayMs * Math.pow(factor, attempt))
      const delay = jitter ? base * (0.5 + Math.random() * 0.5) : base
      await sleep(delay, signal)
    }
  }
  throw lastErr
}

// ── Circuit breaker (per-key, in-memory) ───────────────────────────────────

export class CircuitOpenError extends Error {
  constructor(key: string) {
    super(`circuit open: ${key}`)
    this.name = 'CircuitOpenError'
  }
}

interface BreakerState {
  failures: number
  openUntil: number
}

const breakers = new Map<string, BreakerState>()

export interface BreakerOptions {
  /** Berapa kali gagal beruntun sebelum buka. Default 5. */
  threshold?: number
  /** Lama buka (ms) sebelum boleh half-open trial. Default 30_000. */
  cooldownMs?: number
  /** Injectable clock (buat test). Default Date.now. */
  now?: () => number
}

/** Reset semua state breaker — buat test isolation. */
export function _resetBreakers(): void {
  breakers.clear()
}

/**
 * Gate `fn` dgn circuit breaker key. Saat terbuka (≥threshold gagal beruntun),
 * lempar CircuitOpenError tanpa manggil fn sampai cooldown lewat (half-open:
 * 1 trial; sukses → tutup, gagal → mulai hitung lagi).
 */
export function withBreaker<T>(key: string, fn: () => Promise<T>, opts: BreakerOptions = {}): Promise<T> {
  const { threshold = 5, cooldownMs = 30_000, now = Date.now } = opts
  const s = breakers.get(key) ?? { failures: 0, openUntil: 0 }

  if (s.openUntil > now()) {
    return Promise.reject(new CircuitOpenError(key))
  }

  return fn().then(
    (v) => {
      breakers.set(key, { failures: 0, openUntil: 0 })
      return v
    },
    (err: unknown) => {
      const failures = s.failures + 1
      const open = failures >= threshold
      breakers.set(key, {
        failures: open ? 0 : failures, // reset hitungan saat buka
        openUntil: open ? now() + cooldownMs : 0,
      })
      throw err
    },
  )
}

/** Breaker gate + retry dalam satu helper. */
export function withResilience<T>(
  key: string,
  fn: () => Promise<T>,
  opts: RetryOptions & BreakerOptions = {},
): Promise<T> {
  return withBreaker(key, () => withRetry(fn, opts), opts)
}
