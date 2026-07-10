import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { DAY_MS, occurrencesInRange, parseISODate, toLocalISO } from '@/lib/recurrence'
import type { RecurringTransaction } from '@/types'

export const runtime = 'nodejs'
export const maxDuration = 300

/**
 * Daily cron → auto-post recurring (is_active + auto_post) jadi baris
 * `transactions` untuk SEMUA user, tanpa perlu buka app (menggantikan tombol
 * "Catat sekarang" manual buat item yang di-opt-in).
 *
 * Wiring (mirrors /api/cron/portfolio-snapshots):
 *  - vercel.json crons → { "path": "/api/cron/post-recurring", "schedule": "15 17 * * *" }
 *    (17:15 UTC = 00:15 WIB — occurrence hari baru langsung tercatat dini hari)
 *  - env CRON_SECRET — Vercel sends `Authorization: Bearer $CRON_SECRET`
 *  - env SUPABASE_SERVICE_ROLE_KEY — scan all users (RLS bypass, server-only)
 *
 * Idempotensi = watermark `last_posted_date` (migrasi 062), monoton maju:
 * occurrence dihitung dari (last_posted_date + 1 hari) ?? start_date s/d hari
 * ini (kalender Asia/Jakarta), di-cap MAX_OCCURRENCES_PER_RUN per item sebagai
 * rem catch-up — sisanya kejar di run berikutnya. Retry/re-run di hari yang
 * sama mulai dari watermark yang sudah maju → gak dobel-nyatat.
 */

const MAX_OCCURRENCES_PER_RUN = 31

export async function GET(request: Request) {
  // Only Vercel Cron (or a caller with the secret) may trigger this.
  const auth = request.headers.get('authorization')
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Env-gate: cron cuma jalan di production (atau lokal saat dev/testing, di mana
  // VERCEL_ENV unset). Preview/branch deploy share env DB prod → jangan biarin
  // cron preview nulis transaksi ke data prod. [reliability-6]
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

  // Semua item yang di-opt-in, lintas user.
  const { data, error } = await admin
    .from('recurring_transactions')
    .select('*')
    .eq('is_active', true)
    .eq('auto_post', true)
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  const items = (data ?? []) as RecurringTransaction[]

  // "Hari ini" pakai kalender Asia/Jakarta (pola cron portfolio-snapshots) —
  // di 17:15 UTC tanggal UTC masih kemarin, tapi WIB sudah masuk hari baru.
  const todayISO = new Date().toLocaleDateString('sv', { timeZone: 'Asia/Jakarta' })
  const today = parseISODate(todayISO)!

  let posted = 0
  let skipped = 0
  const errors: Array<{ id: string; name: string; error: string }> = []

  for (const r of items) {
    // Per-item try/catch: satu item gagal gak ngehentikan sisanya.
    try {
      const lastPosted = parseISODate(r.last_posted_date)
      const start = parseISODate(r.start_date)
      const from = lastPosted ? new Date(lastPosted.getTime() + DAY_MS) : (start ?? today)
      if (from > today) { skipped++; continue }

      // occurrencesInRange sudah menghormati start_date/end_date; jendela
      // [from, today] inklusif. Cap sebagai rem catch-up item lama.
      const days = Math.round((today.getTime() - from.getTime()) / DAY_MS)
      const due = occurrencesInRange(r, from, days)
        .filter((d) => d.getTime() <= today.getTime())
        .slice(0, MAX_OCCURRENCES_PER_RUN)
      if (due.length === 0) { skipped++; continue }

      // Bentuk baris sama persis dengan runNow() di halaman Recurring.
      const rows = due.map((d) => ({
        user_id: r.user_id,
        date: toLocalISO(d),
        account_id: r.account_id,
        type: r.type,
        category: r.category,
        description: `[Auto] ${r.name}`,
        amount: r.amount,
      }))
      const { error: insErr } = await admin.from('transactions').insert(rows)
      if (insErr) throw new Error(insErr.message)

      // Majuin watermark HANYA setelah insert sukses — kalau update ini gagal,
      // run berikutnya bisa dobel buat item ini; catat sebagai error biar keliatan.
      const { error: updErr } = await admin
        .from('recurring_transactions')
        .update({ last_posted_date: toLocalISO(due[due.length - 1]) })
        .eq('id', r.id)
      if (updErr) throw new Error(`inserted ${due.length} tx but last_posted_date update failed: ${updErr.message}`)

      posted += due.length
    } catch (err) {
      errors.push({ id: r.id, name: r.name, error: err instanceof Error ? err.message : String(err) })
    }
  }

  return NextResponse.json({ ok: true, date: todayISO, items: items.length, posted, skipped, errors })
}
