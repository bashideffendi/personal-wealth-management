import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  enqueue, getQueued, removeQueued, isNetworkError, flushQueue,
  type QueuedTransaction,
} from './offline-queue'

/**
 * Env vitest = node (tanpa jsdom). offline-queue baca window.localStorage /
 * navigator di CALL-TIME (bukan import-time), jadi cukup stub globalThis
 * sebelum tiap test — gak butuh jsdom. crypto.randomUUID sudah ada di Node 18+.
 */

// localStorage in-memory yang meniru kontrak Storage (getItem/setItem) +
// opsi throwOnSet buat simulasi quota penuh / private mode.
function makeLocalStorage(opts: { throwOnSet?: boolean } = {}) {
  let store: Record<string, string> = {}
  return {
    getItem: (k: string) => (k in store ? store[k] : null),
    setItem: (k: string, v: string) => {
      if (opts.throwOnSet) throw new DOMException('QuotaExceededError')
      store[k] = v
    },
    removeItem: (k: string) => { delete store[k] },
    clear: () => { store = {} },
    _dump: () => store,
  }
}

let ls: ReturnType<typeof makeLocalStorage>

// vi.stubGlobal dipakai (bukan assign langsung) karena Node 21+ bikin
// globalThis.navigator read-only (getter-only) → assign biasa melempar.
function installEnv(navPatch: Record<string, unknown> = {}) {
  ls = makeLocalStorage()
  vi.stubGlobal('window', { localStorage: ls })
  vi.stubGlobal('localStorage', ls)
  // default onLine true; navigator.locks sengaja undefined → flushQueue pakai
  // jalur fallback doFlush (Web Locks lintas-tab gak bisa diuji di node).
  vi.stubGlobal('navigator', { onLine: true, ...navPatch })
}

// Override localStorage/window saja (navigator tetap dari installEnv).
function setStorage(mock: { getItem: (k: string) => string | null; setItem: (k: string, v: string) => void }) {
  vi.stubGlobal('window', { localStorage: mock })
  vi.stubGlobal('localStorage', mock)
}

beforeEach(() => { installEnv() })
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('isNetworkError', () => {
  it('navigator.onLine === false selalu true (sinyal terkuat), apapun err-nya', () => {
    installEnv({ onLine: false })
    expect(isNetworkError(null)).toBe(true)
    expect(isNetworkError(new Error('apa saja'))).toBe(true)
  })

  it('cocokkan pesan fetch-failure lintas browser', () => {
    for (const msg of [
      'TypeError: Failed to fetch',        // Chrome
      'NetworkError when attempting to fetch resource', // Firefox
      'Load failed',                        // Safari
      'fetch failed',                       // undici/Node
      'network request failed',
      'net::ERR_INTERNET_DISCONNECTED',
    ]) {
      expect(isNetworkError({ message: msg })).toBe(true)
      expect(isNetworkError(new Error(msg))).toBe(true)
    }
  })

  it('error non-jaringan (RLS/validasi) → false', () => {
    expect(isNetworkError({ message: 'new row violates row-level security policy' })).toBe(false)
    expect(isNetworkError({ message: 'duplicate key value violates unique constraint' })).toBe(false)
    expect(isNetworkError(null)).toBe(false)
    expect(isNetworkError(undefined)).toBe(false)
  })
})

describe('enqueue / getQueued / removeQueued', () => {
  it('enqueue menambah item & getQueued mengembalikannya', () => {
    expect(getQueued()).toEqual([])
    const item = enqueue({ amount: 25_000, category: 'Makanan' })
    expect(item).not.toBeNull()
    expect(item!.localId).toBeTypeOf('string')
    expect(item!.payload).toEqual({ amount: 25_000, category: 'Makanan' })
    const all = getQueued()
    expect(all).toHaveLength(1)
    expect(all[0].localId).toBe(item!.localId)
  })

  it('menghormati cap MAX_QUEUE (100) → item ke-101 ditolak (null)', () => {
    for (let i = 0; i < 100; i++) expect(enqueue({ i })).not.toBeNull()
    expect(getQueued()).toHaveLength(100)
    expect(enqueue({ i: 100 })).toBeNull()          // penuh
    expect(getQueued()).toHaveLength(100)            // tetap 100, gak nambah
  })

  it('localStorage gagal ditulis (quota/private) → enqueue null, gak melempar', () => {
    setStorage(makeLocalStorage({ throwOnSet: true }))
    expect(() => enqueue({ amount: 1 })).not.toThrow()
    expect(enqueue({ amount: 1 })).toBeNull()
  })

  it('removeQueued menghapus tepat satu item berdasarkan localId', () => {
    const a = enqueue({ n: 1 })!
    const b = enqueue({ n: 2 })!
    removeQueued(a.localId)
    const rest = getQueued()
    expect(rest).toHaveLength(1)
    expect(rest[0].localId).toBe(b.localId)
  })

  it('readStore membuang entri korup / non-array', () => {
    setStorage({ getItem: () => 'bukan json {{{', setItem: () => {} })
    expect(getQueued()).toEqual([])
    setStorage({ getItem: () => JSON.stringify([{ bogus: true }, { localId: 'x', payload: {} }]), setItem: () => {} })
    expect(getQueued()).toHaveLength(1) // yang bogus (tanpa localId/payload) dibuang
  })
})

// Mock client supabase minimal: tiap insert konsultasi antrian `results`
// berurutan; catat payload yang di-insert biar bisa cek anti-dobel.
function makeClient(results: Array<{ error: { message?: string } | null }>) {
  const inserted: Record<string, unknown>[] = []
  let i = 0
  const client = {
    from: (_table: string) => ({
      insert: (payload: Record<string, unknown>) => {
        inserted.push(payload)
        const r = results[i] ?? { error: null }
        i++
        return Promise.resolve(r)
      },
    }),
  }
  return { client, inserted }
}

describe('flushQueue (jalur fallback tanpa Web Locks)', () => {
  it('insert semua pending & hapus yang sukses; antrian jadi kosong', async () => {
    enqueue({ n: 1 }); enqueue({ n: 2 }); enqueue({ n: 3 })
    const { client, inserted } = makeClient([{ error: null }, { error: null }, { error: null }])
    const res = await flushQueue(client)
    expect(res.flushed).toBe(3)
    expect(res.remaining).toBe(0)
    expect(inserted).toHaveLength(3)
    expect(getQueued()).toHaveLength(0)
  })

  it('item sukses dihapus TEPAT sekali — gak ada double-insert saat flush ulang', async () => {
    enqueue({ n: 1 })
    const c1 = makeClient([{ error: null }])
    await flushQueue(c1.client)
    expect(c1.inserted).toHaveLength(1)
    expect(getQueued()).toHaveLength(0)
    // flush kedua: antrian sudah kosong → gak insert apa-apa lagi
    const c2 = makeClient([{ error: null }])
    const res2 = await flushQueue(c2.client)
    expect(c2.inserted).toHaveLength(0)
    expect(res2.flushed).toBe(0)
  })

  it('error jaringan → BERHENTI, item sisa tetap di antrian buat dicoba lagi', async () => {
    enqueue({ n: 1 }); enqueue({ n: 2 }); enqueue({ n: 3 })
    // item1 sukses, item2 error jaringan → stop sebelum item3
    const { client, inserted } = makeClient([
      { error: null },
      { error: { message: 'TypeError: Failed to fetch' } },
    ])
    const res = await flushQueue(client)
    expect(res.flushed).toBe(1)
    expect(inserted).toHaveLength(2)       // cuma sampai item2, item3 gak dicoba
    expect(getQueued()).toHaveLength(2)    // item2 & item3 masih ngantri
  })

  it('error NON-jaringan → item dibiarkan tapi lanjut item berikutnya (gak nyumbat)', async () => {
    enqueue({ n: 1 }); enqueue({ n: 2 }); enqueue({ n: 3 })
    // item1 error RLS (non-jaringan, dibiarkan), item2 & item3 sukses
    const { client, inserted } = makeClient([
      { error: { message: 'violates row-level security policy' } },
      { error: null },
      { error: null },
    ])
    const res = await flushQueue(client)
    expect(res.flushed).toBe(2)
    expect(inserted).toHaveLength(3)       // ketiganya dicoba (item busuk gak nyumbat)
    const rest = getQueued()
    expect(rest).toHaveLength(1)           // cuma item1 (busuk) yang tersisa
    expect((rest[0] as QueuedTransaction).payload).toEqual({ n: 1 })
  })

  it('insert yang throw (bukan return error) diperlakukan sebagai error & ditangani', async () => {
    enqueue({ n: 1 })
    const client = {
      from: () => ({ insert: () => Promise.reject(new Error('boom non-network')) }),
    }
    const res = await flushQueue(client)
    expect(res.flushed).toBe(0)
    expect(getQueued()).toHaveLength(1)    // dibiarkan (error non-jaringan)
  })
})
