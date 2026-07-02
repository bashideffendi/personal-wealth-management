import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  formatRupiah,
  sendRenewalReminderEmail,
  sendTrialEndingEmail,
} from '@/lib/email'
import { REMINDER_THRESHOLDS, reminderDaysLeft, shouldRemind } from '@/lib/reminders'

export const runtime = 'nodejs'
export const maxDuration = 300

/**
 * Daily cron → trial-ending + renewal reminders. Klunting has auto-renew OFF,
 * so users must renew manually; we nudge at H-14 / H-3 / H-0 before expires_at.
 *
 * ⚠️ REVIEWABLE SCAFFOLD — verify before scheduling:
 *  - Assumes subscription.status 'trialing' marks a trial and 'active' a paid
 *    sub (both used elsewhere in the app), and `expires_at` = period/trial end.
 *  - Idempoten via tabel reminder_log (PK user+threshold+tanggal): cron retry
 *    atau re-run >1×/hari TIDAK mengirim email dobel (migrasi 061).
 *  - Needs env: SUPABASE_SERVICE_ROLE_KEY (scan all users) + CRON_SECRET +
 *    RESEND_API_KEY (kalau absen, email lib no-op dan run-nya cuma log).
 *  - Scheduled di vercel.json: daily 02:00 UTC ≈ 09:00 WIB. Vercel ngirim
 *    `Authorization: Bearer $CRON_SECRET` otomatis.
 */

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://klunting.com'

export async function GET(request: Request) {
  // Only Vercel Cron (or a caller with the secret) may trigger this.
  const auth = request.headers.get('authorization')
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Env-gate: cron cuma jalan di production (atau lokal saat dev/testing, di mana
  // VERCEL_ENV unset). Preview/branch deploy share env DB prod → jangan biarin
  // cron preview kirim email ke user beneran. [reliability-6]
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

  // Plan lookup (name + price) for the renewal email body.
  const { data: plans } = await admin.from('plans').select('id, name, price_idr')
  const planMap = new Map<string, { name: string; price_idr: number }>(
    ((plans ?? []) as Array<{ id: string; name: string; price_idr: number }>).map(
      (p) => [p.id, { name: p.name, price_idr: p.price_idr }],
    ),
  )

  // Subs expiring within the widest threshold window.
  const horizon = new Date()
  horizon.setDate(horizon.getDate() + Math.max(...REMINDER_THRESHOLDS) + 1)
  const { data: subs, error } = await admin
    .from('subscriptions')
    .select('user_id, plan_id, status, expires_at')
    .in('status', ['active', 'trialing'])
    .not('expires_at', 'is', null)
    .lte('expires_at', horizon.toISOString())
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const now = new Date()

  let sent = 0
  const results: Array<{ days: number; type: string; ok: boolean }> = []

  for (const s of (subs ?? []) as Array<{
    user_id: string
    plan_id: string
    status: string
    expires_at: string
  }>) {
    const exp = new Date(s.expires_at)
    const expDay = new Date(exp.getFullYear(), exp.getMonth(), exp.getDate())
    const days = reminderDaysLeft(s.expires_at, now)
    if (!shouldRemind(days)) continue

    // Idempotency: dedup per (user, threshold, tanggal) → cron retry/re-run gak
    // kirim email dobel. Best-effort: kalau tabel belum ada (migrasi 061) → skip guard.
    const kind = s.status === 'trialing' ? 'trial' : 'renewal'
    const { data: logRows, error: logErr } = await admin
      .from('reminder_log')
      .upsert(
        { user_id: s.user_id, kind, threshold: days, sent_on: now.toISOString().slice(0, 10) },
        { onConflict: 'user_id,threshold,sent_on', ignoreDuplicates: true },
      )
      .select('user_id')
    if (!logErr && (logRows?.length ?? 0) === 0) continue

    const { data: u } = await admin.auth.admin.getUserById(s.user_id)
    const email = u?.user?.email
    if (!email) continue

    const expiryDate = expDay.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })

    const res =
      s.status === 'trialing'
        ? await sendTrialEndingEmail(email, {
            daysLeft: days,
            pricingUrl: `${SITE}/dashboard/pricing`,
          })
        : await sendRenewalReminderEmail(email, {
            plan: planMap.get(s.plan_id)?.name ?? s.plan_id,
            daysLeft: days,
            expiryDate,
            price: planMap.get(s.plan_id)
              ? formatRupiah(planMap.get(s.plan_id)!.price_idr)
              : undefined,
            renewUrl: `${SITE}/dashboard/pricing`,
          })

    if (res.ok) sent++
    results.push({
      days,
      type: s.status === 'trialing' ? 'trial' : 'renewal',
      ok: res.ok,
    })
  }

  return NextResponse.json({ ok: true, checked: subs?.length ?? 0, sent, results })
}
