import { describe, it, expect, beforeEach } from 'vitest'
import {
  withRetry,
  withBreaker,
  withResilience,
  CircuitOpenError,
  defaultShouldRetry,
  _resetBreakers,
} from './retry'

const FAST = { baseDelayMs: 1, jitter: false } as const

beforeEach(() => _resetBreakers())

describe('withRetry', () => {
  it('sukses percobaan pertama → fn dipanggil sekali', async () => {
    let calls = 0
    const r = await withRetry(async () => { calls++; return 'ok' }, FAST)
    expect(r).toBe('ok')
    expect(calls).toBe(1)
  })

  it('gagal lalu sukses → retry sampai berhasil', async () => {
    let calls = 0
    const r = await withRetry(async () => {
      calls++
      if (calls < 3) throw new Error('500 server error')
      return 'ok'
    }, { ...FAST, retries: 3 })
    expect(r).toBe('ok')
    expect(calls).toBe(3)
  })

  it('habis retry → lempar error ASLI (bukan dibungkus)', async () => {
    let calls = 0
    const original = new Error('503 unavailable')
    await expect(
      withRetry(async () => { calls++; throw original }, { ...FAST, retries: 2 }),
    ).rejects.toBe(original)
    expect(calls).toBe(3) // 1 + 2 retry
  })

  it('shouldRetry=false → short-circuit, fn dipanggil sekali', async () => {
    let calls = 0
    await expect(
      withRetry(async () => { calls++; throw new Error('400 bad symbol') }, { ...FAST, retries: 5 }),
    ).rejects.toThrow('400')
    expect(calls).toBe(1) // 400 deterministik → gak di-retry
  })
})

describe('defaultShouldRetry', () => {
  it('retry: 429, 5xx, network/timeout/abort', () => {
    expect(defaultShouldRetry(new Error('429 too many'))).toBe(true)
    expect(defaultShouldRetry(new Error('Binance 503: down'))).toBe(true)
    expect(defaultShouldRetry(new Error('fetch failed'))).toBe(true)
    expect(defaultShouldRetry(new Error('yahoo-timeout'))).toBe(true)
  })
  it('JANGAN retry: 4xx selain 429, error tanpa status', () => {
    expect(defaultShouldRetry(new Error('400 bad request'))).toBe(false)
    expect(defaultShouldRetry(new Error('404 not found'))).toBe(false)
    expect(defaultShouldRetry(new Error('parse error'))).toBe(false)
  })
})

describe('withBreaker', () => {
  it('buka setelah threshold gagal beruntun → CircuitOpenError tanpa manggil fn', async () => {
    let t = 1000
    const now = () => t
    let calls = 0
    const boom = () => { calls++; return Promise.reject(new Error('down')) }

    // 3 gagal → buka (threshold 3)
    for (let i = 0; i < 3; i++) {
      await expect(withBreaker('svc', boom, { threshold: 3, cooldownMs: 5000, now })).rejects.toThrow('down')
    }
    expect(calls).toBe(3)

    // breaker terbuka → fn TIDAK dipanggil lagi, langsung CircuitOpenError
    await expect(withBreaker('svc', boom, { threshold: 3, cooldownMs: 5000, now })).rejects.toBeInstanceOf(CircuitOpenError)
    expect(calls).toBe(3) // gak nambah
  })

  it('half-open setelah cooldown → fn dicoba lagi; sukses menutup breaker', async () => {
    let t = 1000
    const now = () => t
    const fail = () => Promise.reject(new Error('down'))
    for (let i = 0; i < 3; i++) {
      await expect(withBreaker('svc2', fail, { threshold: 3, cooldownMs: 5000, now })).rejects.toThrow('down')
    }
    // masih dalam cooldown → CircuitOpenError
    await expect(withBreaker('svc2', fail, { threshold: 3, cooldownMs: 5000, now })).rejects.toBeInstanceOf(CircuitOpenError)

    // lewat cooldown → half-open trial dijalankan
    t = 1000 + 5001
    const r = await withBreaker('svc2', async () => 'recovered', { threshold: 3, cooldownMs: 5000, now })
    expect(r).toBe('recovered')
    // setelah sukses, breaker tutup → call berikut jalan normal
    const r2 = await withBreaker('svc2', async () => 'ok', { threshold: 3, cooldownMs: 5000, now })
    expect(r2).toBe('ok')
  })
})

describe('withResilience', () => {
  it('gabung breaker + retry: retry dulu, kalau tetap gagal hitung ke breaker', async () => {
    let t = 0
    const now = () => t
    let calls = 0
    const fail = () => { calls++; return Promise.reject(new Error('500')) }
    // retries:1 → tiap withResilience call = 2 attempt fn; threshold 2 → buka setelah 2 call gagal
    await expect(withResilience('svcR', fail, { ...FAST, retries: 1, threshold: 2, cooldownMs: 9999, now })).rejects.toThrow('500')
    await expect(withResilience('svcR', fail, { ...FAST, retries: 1, threshold: 2, cooldownMs: 9999, now })).rejects.toThrow('500')
    const before = calls
    await expect(withResilience('svcR', fail, { ...FAST, retries: 1, threshold: 2, cooldownMs: 9999, now })).rejects.toBeInstanceOf(CircuitOpenError)
    expect(calls).toBe(before) // breaker buka → fn gak dipanggil
  })
})
