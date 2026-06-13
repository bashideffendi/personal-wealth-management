/**
 * Cartoon Quest fase 2 — XP & Level (milestone a).
 *
 * Sumber kebenaran XP = tabel xp_events (ledger append-only, migration
 * 050); total = SUM via RPC get_my_xp. Level diturunkan dari total
 * lewat kurva klasik RPG — TIDAK disimpan di DB, jadi gak bisa drift.
 *
 * awardXp = best-effort dengan CAP HARIAN per sumber (anti-farming):
 * gagal apa pun (migration belum jalan, offline, demo mode) gak boleh
 * mengganggu alur utama — XP itu bumbu, bukan fitur inti.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = SupabaseClient<any, any, any>

/** Sumber XP + cap harian. Tambah sumber baru = tambah baris di sini. */
export const XP_SOURCES = {
  transaction: { amount: 10, capPerDay: 30 },     // nyatat transaksi (max 3x/hari)
  recurring_paid: { amount: 20, capPerDay: 60 },  // tagihan rutin tercatat
} as const
export type XpSource = keyof typeof XP_SOURCES

/** XP yang dibutuhkan buat naik DARI level ini: 100 × level^1.5.
 *  Lv1→2 = 100, Lv5→6 ≈ 1.118, Lv10→11 ≈ 3.162 — cepat di awal, landai elegan. */
export function stepXp(level: number): number {
  return Math.round(100 * Math.pow(level, 1.5))
}

export interface LevelInfo {
  level: number
  intoLevel: number   // XP yang sudah terkumpul di level berjalan
  needed: number      // XP yang dibutuhkan buat naik dari level berjalan
}

/** Gelar per rentang level — bumbu RPG, ID casual. */
const TITLES: [number, string][] = [
  [1, 'Pemula Hemat'],
  [4, 'Penjaga Dompet'],
  [8, 'Ahli Anggaran'],
  [14, 'Juragan Tabungan'],
  [22, 'Master Cuan'],
  [35, 'Sultan Disiplin'],
]
export function levelTitle(level: number): string {
  let title = TITLES[0][1]
  for (const [min, t] of TITLES) if (level >= min) title = t
  return title
}

export function levelFromXp(totalXp: number): LevelInfo {
  let level = 1
  let acc = 0
  let need = stepXp(1)
  while (totalXp >= acc + need && level < 99) {
    acc += need
    level++
    need = stepXp(level)
  }
  return { level, intoLevel: totalXp - acc, needed: need }
}

/** Total XP user login. Gagal (RPC absen/offline/demo) → 0, jangan meledak. */
export async function fetchMyXp(supabase: DB): Promise<number> {
  try {
    const { data, error } = await supabase.rpc('get_my_xp')
    if (error) {
      console.error('[xp] get_my_xp gagal (migration 050 belum jalan?):', error.message)
      return 0
    }
    return Number(data ?? 0)
  } catch {
    return 0
  }
}

/** Anugerahkan XP (best-effort, cap harian per sumber).
 *  Sukses → dispatch 'pwm:xp-changed' biar HUD langsung refresh. */
export async function awardXp(supabase: DB, source: XpSource, refId?: string): Promise<boolean> {
  try {
    const cfg = XP_SOURCES[source]
    const { data: { session } } = await supabase.auth.getSession()
    const uid = session?.user?.id
    if (!uid) return false

    const now = new Date()
    const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
    const { data: todayRows, error: capErr } = await supabase
      .from('xp_events')
      .select('amount')
      .eq('user_id', uid)
      .eq('source', source)
      .gte('created_at', dayStart)
    if (capErr) {
      console.error('[xp] cek cap harian gagal:', capErr.message)
      return false
    }
    const sumToday = ((todayRows ?? []) as { amount: number }[]).reduce((s, r) => s + Number(r.amount || 0), 0)
    if (sumToday + cfg.amount > cfg.capPerDay) return false

    const { error } = await supabase
      .from('xp_events')
      .insert({ user_id: uid, source, amount: cfg.amount, ref_id: refId ?? null })
    if (error) {
      console.error('[xp] award gagal:', error.message)
      return false
    }
    window.dispatchEvent(new CustomEvent('pwm:xp-changed'))
    return true
  } catch {
    return false
  }
}
