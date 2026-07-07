import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

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
  const [accRes, alRes, nlqRes, invRes, debtRes, ccRes] = await Promise.all([
    admin.from('accounts').select('user_id, current_balance'),
    admin.from('assets_liquid').select('user_id, balance'),
    admin.from('assets_non_liquid').select('user_id, current_value'),
    admin.from('investments').select('user_id, total_value'),
    admin.from('debts').select('user_id, remaining').eq('is_active', true),
    admin.from('credit_cards').select('user_id, current_balance').eq('is_active', true),
  ])
  // Strict (pola fetchLiquidEntries strict): satu query gagal = abort run.
  // Lanjut dengan tabel "kosong" bakal nulis snapshot Rp 0 palsu buat semua user.
  const firstErr = [accRes, alRes, nlqRes, invRes, debtRes, ccRes].find((r) => r.error)?.error
  if (firstErr) {
    return NextResponse.json({ error: firstErr.message }, { status: 500 })
  }

  // Agregasi per user, meniru client: aset = liquid (accounts + assets_liquid,
  // cash-equivalent MAUPUN receivable — dua-duanya masuk total_assets) +
  // non-liquid + investasi; kewajiban = debts.remaining + CC balance.
  const totals = new Map<string, { assets: number; debts: number }>()
  const bump = (userId: string, field: 'assets' | 'debts', amount: number) => {
    const t = totals.get(userId) ?? { assets: 0, debts: 0 }
    t[field] += amount || 0
    totals.set(userId, t)
  }
  for (const r of (accRes.data ?? []) as { user_id: string; current_balance: number }[]) bump(r.user_id, 'assets', r.current_balance)
  for (const r of (alRes.data ?? []) as { user_id: string; balance: number }[]) bump(r.user_id, 'assets', r.balance)
  for (const r of (nlqRes.data ?? []) as { user_id: string; current_value: number }[]) bump(r.user_id, 'assets', r.current_value)
  for (const r of (invRes.data ?? []) as { user_id: string; total_value: number }[]) bump(r.user_id, 'assets', r.total_value)
  for (const r of (debtRes.data ?? []) as { user_id: string; remaining: number }[]) bump(r.user_id, 'debts', r.remaining)
  for (const r of (ccRes.data ?? []) as { user_id: string; current_balance: number }[]) bump(r.user_id, 'debts', r.current_balance)

  // Tanggal kalender Asia/Jakarta (pola post-recurring/portfolio-snapshots) —
  // di 17:30 UTC tanggal UTC masih kemarin, tapi WIB sudah masuk hari baru.
  const snapshotDate = new Date().toLocaleDateString('sv', { timeZone: 'Asia/Jakarta' })

  let written = 0
  const errors: Array<{ user_id: string; error: string }> = []

  for (const [userId, t] of totals) {
    // Per-user try/catch: satu user gagal gak ngehentikan sisanya.
    try {
      // Bentuk baris + onConflict SAMA PERSIS dengan upsert client di
      // /dashboard/net-worth (satu baris per user per tanggal).
      const { error } = await admin.from('net_worth_snapshots').upsert(
        {
          user_id: userId,
          snapshot_date: snapshotDate,
          total_assets: t.assets,
          total_debts: t.debts,
          net_worth: t.assets - t.debts,
        },
        { onConflict: 'user_id,snapshot_date' },
      )
      if (error) throw new Error(error.message)
      written++
    } catch (err) {
      errors.push({ user_id: userId, error: err instanceof Error ? err.message : String(err) })
    }
  }

  return NextResponse.json({ ok: true, date: snapshotDate, users: totals.size, written, errors })
}
