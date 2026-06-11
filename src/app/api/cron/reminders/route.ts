import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  formatRupiah,
  sendRenewalReminderEmail,
  sendTrialEndingEmail,
} from '@/lib/email'

export const runtime = 'nodejs'
export const maxDuration = 300

/**
 * Daily cron → trial-ending + renewal reminders. Klunting has auto-renew OFF,
 * so users must renew manually; we nudge at H-14 / H-3 / H-0 before expires_at.
 *
 * ⚠️ REVIEWABLE SCAFFOLD — verify before scheduling:
 *  - Assumes subscription.status 'trialing' marks a trial and 'active' a paid
 *    sub (both used elsewhere in the app), and `expires_at` = period/trial end.
 *  - Dedup is by EXACT-date match: a once-daily run fires each threshold exactly
 *    once, so no extra column is needed. If the cron can run >1×/day, add a guard.
 *  - Needs env: SUPABASE_SERVICE_ROLE_KEY (scan all users) + CRON_SECRET +
 *    RESEND_API_KEY (kalau absen, email lib no-op dan run-nya cuma log).
 *  - Scheduled di vercel.json: daily 02:00 UTC ≈ 09:00 WIB. Vercel ngirim
 *    `Authorization: Bearer $CRON_SECRET` otomatis.
 */

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://klunting.com'
const THRESHOLDS = [14, 3, 0]

export async function GET(request: Request) {
  // Only Vercel Cron (or a caller with the secret) may trigger this.
  const auth = request.headers.get('authorization')
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
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
  horizon.setDate(horizon.getDate() + Math.max(...THRESHOLDS) + 1)
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
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

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
    const days = Math.round((expDay.getTime() - today.getTime()) / 86_400_000)
    if (!THRESHOLDS.includes(days)) continue

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
