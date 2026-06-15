import { describe, it, expect, vi, afterEach } from 'vitest'
import { rateLimit } from './rate-limit'

// Key unik per test biar Map module-level gak bocor antar-test.
let n = 0
const key = () => `test-${n++}`

afterEach(() => vi.useRealTimers())

describe('rateLimit — burst guard', () => {
  it('izinkan `limit` request, blokir yang ke-(limit+1)', () => {
    const k = key()
    const r1 = rateLimit(k, { limit: 3 })
    expect(r1.ok).toBe(true)
    expect(r1.remaining).toBe(2)

    expect(rateLimit(k, { limit: 3 }).remaining).toBe(1)
    expect(rateLimit(k, { limit: 3 }).remaining).toBe(0) // request ke-3 masih ok

    const blocked = rateLimit(k, { limit: 3 })
    expect(blocked.ok).toBe(false)
    expect(blocked.remaining).toBe(0)
    expect(blocked.retryAfterSec).toBeGreaterThanOrEqual(1)
  })

  it('key berbeda dihitung terpisah', () => {
    const a = key()
    const b = key()
    rateLimit(a, { limit: 1 }) // habiskan a
    expect(rateLimit(a, { limit: 1 }).ok).toBe(false)
    expect(rateLimit(b, { limit: 1 }).ok).toBe(true) // b masih segar
  })

  it('window reset: setelah windowMs lewat, kuota balik', () => {
    vi.useFakeTimers()
    vi.setSystemTime(0)
    const k = key()
    expect(rateLimit(k, { limit: 1, windowMs: 1000 }).ok).toBe(true)
    expect(rateLimit(k, { limit: 1, windowMs: 1000 }).ok).toBe(false) // masih dalam window

    vi.setSystemTime(1001) // lewat window
    expect(rateLimit(k, { limit: 1, windowMs: 1000 }).ok).toBe(true) // reset
  })

  it('default 30/menit', () => {
    const k = key()
    expect(rateLimit(k).remaining).toBe(29) // limit default 30
  })
})
