/**
 * offline-queue — antrian transaksi ringan berbasis localStorage.
 *
 * Kenapa localStorage (bukan IndexedDB): payload transaksi kecil (satu objek
 * per entri), antrian dibatasi 100 item, dan API sinkron localStorage jauh
 * lebih simpel — gak butuh schema/versioning IndexedDB.
 *
 * Alur:
 *   1. Insert supabase gagal karena jaringan → enqueue(payload)
 *   2. OfflineSync (mount di dashboard layout) manggil flushQueue() saat
 *      online lagi → insert semua pending, hapus yang sukses.
 *
 * Item yang gagal karena error NON-jaringan (mis. RLS/validasi) sengaja
 * dibiarkan di antrian (sesuai kontrak "hapus yang sukses") — cap 100 item
 * menjaga localStorage tetap aman dari pertumbuhan liar.
 */

const STORAGE_KEY = 'klunting.offline-tx-queue'
const MAX_QUEUE = 100

export interface QueuedTransaction {
  /** id lokal antrian (bukan id DB) — buat removeQueued */
  localId: string
  /** payload persis seperti yang mau di-insert ke tabel transactions */
  payload: Record<string, unknown>
  /** ISO timestamp saat entri diantre */
  createdAt: string
}

/** Bentuk minimal client supabase yang dibutuhkan flushQueue (client asli bertipe any). */
interface SupabaseLike {
  from: (table: string) => {
    insert: (payload: Record<string, unknown>) => PromiseLike<{ error: { message?: string } | null }>
  }
}

function readStore(): QueuedTransaction[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (it): it is QueuedTransaction =>
        !!it && typeof it === 'object' &&
        typeof (it as QueuedTransaction).localId === 'string' &&
        !!(it as QueuedTransaction).payload && typeof (it as QueuedTransaction).payload === 'object',
    )
  } catch {
    return []
  }
}

function writeStore(items: QueuedTransaction[]): boolean {
  if (typeof window === 'undefined') return false
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
    return true
  } catch {
    // Quota penuh / private mode — jangan lempar, biar caller fallback ke toast error biasa.
    return false
  }
}

/** Semua transaksi yang masih ngantri (kosong di SSR). */
export function getQueued(): QueuedTransaction[] {
  return readStore()
}

/**
 * Antre satu payload transaksi. Return item-nya kalau sukses, null kalau
 * antrian penuh (>= MAX_QUEUE) atau localStorage gagal ditulis.
 */
export function enqueue(payload: Record<string, unknown>): QueuedTransaction | null {
  const items = readStore()
  if (items.length >= MAX_QUEUE) return null
  const item: QueuedTransaction = {
    localId: crypto.randomUUID(),
    payload,
    createdAt: new Date().toISOString(),
  }
  return writeStore([...items, item]) ? item : null
}

/** Hapus satu item antrian berdasarkan localId. */
export function removeQueued(localId: string): void {
  const items = readStore()
  const next = items.filter((it) => it.localId !== localId)
  if (next.length !== items.length) writeStore(next)
}

/**
 * Deteksi error jaringan — dari objek error supabase (postgrest membungkus
 * fetch reject jadi { message: 'TypeError: Failed to fetch' }) maupun error
 * yang dilempar langsung. Plus cek navigator.onLine sebagai sinyal terkuat.
 */
export function isNetworkError(err: unknown): boolean {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true
  if (!err) return false
  const msg =
    err instanceof Error
      ? err.message
      : typeof err === 'object' && 'message' in err
        ? String((err as { message?: unknown }).message ?? '')
        : String(err)
  // Chrome: "Failed to fetch" · Firefox: "NetworkError when attempting…"
  // Safari: "Load failed" · undici/Node: "fetch failed"
  return /failed to fetch|fetch failed|load failed|networkerror|network request failed|network error|err_internet/i.test(msg)
}

// Guard biar flush dari interval + event 'online' gak jalan barengan (dalam SATU tab).
let flushing = false

export interface FlushResult {
  flushed: number
  remaining: number
  /** true kalau flush di-skip karena tab lain lagi megang lock lintas-tab. */
  skipped?: boolean
}

/** Nama lock Web Locks — satu nama dipakai semua tab origin ini. */
const FLUSH_LOCK_NAME = 'klunting-offline-flush'

/** Isi flush sebenarnya — dipanggil setelah lolos lock lintas-tab (atau fallback). */
async function doFlush(supabase: SupabaseLike): Promise<FlushResult> {
  if (flushing) return { flushed: 0, remaining: readStore().length }
  flushing = true
  let flushed = 0
  try {
    const items = readStore()
    for (const item of items) {
      let error: { message?: string } | null = null
      try {
        ;({ error } = await supabase.from('transactions').insert(item.payload))
      } catch (err) {
        error = { message: err instanceof Error ? err.message : String(err) }
      }
      if (!error) {
        // Hapus dari antrian HANYA setelah insert sukses.
        removeQueued(item.localId)
        flushed++
      } else if (isNetworkError(error)) {
        break // masih offline — stop, coba lagi di flush berikutnya
      }
      // error non-jaringan → biarkan di antrian, lanjut item berikutnya
    }
  } finally {
    flushing = false
  }
  return { flushed, remaining: readStore().length }
}

/**
 * Coba insert semua item pending ke tabel transactions; item yang sukses
 * dihapus dari antrian. Kalau ketemu error jaringan, berhenti (masih offline —
 * sisanya dicoba lagi nanti). Error non-jaringan: item dibiarkan, lanjut item
 * berikutnya (satu item busuk gak boleh nyumbat antrian).
 *
 * Anti double-insert LINTAS-TAB: guard `flushing` cuma hidup per-tab (module
 * scope), jadi dua tab bisa flush antrian localStorage yang sama barengan →
 * transaksi dobel. Web Locks API kasih mutex lintas-tab se-origin: cuma satu
 * tab yang dapat lock `klunting-offline-flush`. `ifAvailable: true` bikin tab
 * lain SKIP (bukan ngantri) — antriannya toh sama, biar tab pemegang lock yang
 * beresin, tab lain coba lagi di interval berikutnya.
 */
export async function flushQueue(supabase: SupabaseLike): Promise<FlushResult> {
  if (typeof navigator !== 'undefined' && navigator.locks) {
    const result: FlushResult = await navigator.locks.request(
      FLUSH_LOCK_NAME,
      { ifAvailable: true },
      async (lock): Promise<FlushResult> =>
        lock ? doFlush(supabase) : { flushed: 0, remaining: readStore().length, skipped: true },
    )
    return result
  }
  // Fallback browser tanpa Web Locks: jalan seperti biasa —
  // guard `flushing` di atas tetap jadi lapis anti-overlap dalam satu tab.
  return doFlush(supabase)
}
