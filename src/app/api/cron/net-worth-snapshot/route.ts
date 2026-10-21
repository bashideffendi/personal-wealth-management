import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { fetchAllRows } from '@/lib/data/fetch-all'
import { computeNetWorth, type NetWorthParts } from '@/lib/data/net-worth'

export const runtime = 'nodejs'
export const maxDuration = 300

/**
 * Daily cron → net_worth_snapshots for EVERY user, computed server-side.
 *
 * Complements the client-side "snapshot on page open" upsert on
 * /dashboard/net-worth, which records attendance (only users who visit get a
 * point on the chart). The client upsert stays — both write the SAME row shape
 * to the SAME (user_id, snapshot_date) key, so a visit on a cron day is a
 * harmless idempotent re-upsert. This cron guarantees days WITHOUT a visit.
 *
 * Aggregation mirrors the client exactly (net-worth page + accounts
 * "networth-lite" hero — the two are already kept in sync):
 *   assets      = accounts.current_balance (all)          — fetchLiquidEntries
 *               + assets_liquid.balance   (all)           — (no dedup: the lib
 *                 concatenates both tables; findDuplicates is a warning only)
 *               + assets_non_liquid.current_value (all)
 *               + investments.total_value (all)
 *   liabilities = debts.remaining          (is_active)
 *               + credit_cards.current_balance (is_active)
 *
 * Wiring (mirrors /api/cron/post-recurring):
 *  - vercel.json crons → { "path": "/api/cron/net-worth-snapshot", "schedule": "30 17 * * *" }
 *    (17:30 UTC = 00:30 WIB — snapshot dated with the fresh Jakarta day)
 *  - env CRON_SECRET — Vercel sends `Authorization: Bearer $CRON_SECRET`
 *  - env SUPABASE_SERVICE_ROLE_KEY — scans all users (RLS bypass, server-only)
 */

export async function GET(request: Request) {
  // Only Vercel Cron (or a caller with the secret) may trigger this.
  const auth = request.headers.get('authorization')
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Env-gate: cron cuma jalan di production (atau lokal saat dev/testing, di mana
  // VERCEL_ENV unset). Preview/branch deploy share env DB prod → jangan biarin
  // cron preview nulis snapshot ke data prod. [reliability-6]
  if (process.env.VERCEL_ENV && process.env.VERCEL_ENV !== 'production') {
    return NextResponse.json({ ok: true, skipped: `disabled on VERCEL_ENV=${process.env.VERCEL_ENV}` })
  }

  const admin = createAdminClient()
  if (!admin) {
    return NextResponse.json(
      { error: 'SUPABASE_SERVICE_ROLE_KEY not configured' },
      { status: 503 },
    )
  }

  // Semua komponen lintas user — kolom sama persis dengan query client
  // (fetchLiquidEntries + net-worth page), plus user_id buat grouping.
  // LINTAS USER → total baris cepat > 1000: wajib paginate. Dulu cap PostgREST
  // memotong diam-diam → user yang barisnya kepotong dapat snapshot salah
  // (mis. aset hilang tapi utang ikut → net worth anjlok palsu).
  const [accRes, alRes, nlqRes, invRes, debtRes, ccRes] = await Promise.all([
    fetchAllRows((f, t) => admin.from('accounts').select('id, user_id, current_balance').order('id').range(f, t)),
    fetchAllRows((f, t) => admin.from('assets_liquid').select('id, user_id, balance').order('id').range(f, t)),
    fetchAllRows((f, t) => admin.from('assets_non_liquid').select('id, user_id, current_value').order('id').range(f, t)),
    fetchAllRows((f, t) => admin.from('investments').select('id, user_id, total_value').order('id').range(f, t)),
    fetchAllRows((f, t) => admin.from('debts').select('id, user_id, remaining').eq('is_active', true).order('id').range(f, t)),
    fetchAllRows((f, t) => admin.from('credit_cards').select('id, user_id, current_balance').eq('is_active', true).order('id').range(f, t)),
  ])
  // Strict (pola fetchLiquidEntries strict): satu query gagal = abort run.
  // Lanjut dengan tabel "kosong" bakal nulis snapshot Rp 0 palsu buat semua user.
  const firstErr = [accRes, alRes, nlqRes, invRes, debtRes, ccRes].find((r) => r.error)?.error
  if (firstErr) {
    return NextResponse.json({ error: firstErr.message }, { status: 500 })
  }

  // Agregasi komponen per user, lalu rumus kanonik lib/data/net-worth (sama
  // persis dengan client: likuid termasuk piutang; kewajiban = utang + kartu).
  const parts = new Map<string, NetWorthParts>()
  const bump = (userId: string, field: keyof NetWorthParts, amount: number | null) => {
    const p = parts.get(userId) ?? { liquid: 0, nonLiquid: 0, investments: 0, debts: 0, creditCards: 0 }
    p[field] += Number(amount) || 0
    parts.set(userId, p)
  }
  for (const r of accRes.data) bump(r.user_id, 'liquid', r.current_balance)
  for (const r of alRes.data) bump(r.user_id, 'liquid', r.balance)
  for (const r of nlqRes.data) bump(r.user_id, 'nonLiquid', r.current_value)
  for (const r of invRes.data) bump(r.user_id, 'investments', r.total_value)
  for (const r of debtRes.data) bump(r.user_id, 'debts', r.remaining)
  for (const r of ccRes.data) bump(r.user_id, 'creditCards', r.current_balance)

  // Tanggal kalender Asia/Jakarta (pola post-recurring/portfolio-snapshots) —
  // di 17:30 UTC tanggal UTC masih kemarin, tapi WIB sudah masuk hari baru.
  const snapshotDate = new Date().toLocaleDateString('sv', { timeZone: 'Asia/Jakarta' })

  let written = 0
  const errors: Array<{ user_id: string; error: string }> = []

  for (const [userId, p] of parts) {
    const t = computeNetWorth(p)
    // Per-user try/catch: satu user gagal gak ngehentikan sisanya.
    try {
      // Bentuk baris + onConflict SAMA PERSIS dengan upsert client di
      // /dashboard/net-worth (satu baris per user per tanggal).
      const { error } = await admin.from('net_worth_snapshots').upsert(
        {
          user_id: userId,
          snapshot_date: snapshotDate,
          total_assets: t.assets,
          total_debts: t.liabilities,
          net_worth: t.netWorth,
        },
        { onConflict: 'user_id,snapshot_date' },
      )
      if (error) throw new Error(error.message)
      written++
    } catch (err) {
      errors.push({ user_id: userId, error: err instanceof Error ? err.message : String(err) })
    }
  }

  return NextResponse.json({ ok: true, date: snapshotDate, users: parts.size, written, errors })
}
