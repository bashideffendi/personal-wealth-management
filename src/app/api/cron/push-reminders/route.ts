import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendPushToUser, type PushPayload } from '@/lib/push-server'
import { DAY_MS, occurrencesInRange, parseISODate } from '@/lib/recurrence'
import { formatCompactCurrency } from '@/lib/utils'
import type { RecurringTransaction } from '@/types'

export const runtime = 'nodejs'
export const maxDuration = 300

/**
 * Daily cron → notifikasi push (Web Push, migrasi 063 + src/lib/push-server.ts).
 * Sekali sehari sore cukup — bukan tiap jam:
 *
 *  (a) H-1 TAGIHAN — recurring is_active dengan occurrence BESOK (kalender
 *      Asia/Jakarta) → 1 notif per item; kontrak (contracts) yang berakhir
 *      dalam `reminder_days_before` hari → notif serupa.
 *  (b) PENGINGAT CATAT HARIAN — profiles.daily_reminder_enabled=true DAN
 *      belum ada transaksi yang DIBUAT hari ini (Jakarta) → 1 notif,
 *      tag 'daily-reminder' biar gak numpuk.
 *
 * Hanya user yang punya push_subscription yang di-scan. Anti-spam: maks
 * MAX_PER_USER notif per user per run (tagihan duluan, pengingat harian
 * paling akhir). Per-user try/catch: satu user gagal gak ngehentikan sisanya.
 *
 * Wiring (mirrors /api/cron/post-recurring):
 *  - vercel.json crons → { "path": "/api/cron/push-reminders", "schedule": "0 12 * * *" }
 *    (12:00 UTC = 19:00 WIB — sore, pas buat H-1 & pengingat harian)
 *  - env CRON_SECRET + SUPABASE_SERVICE_ROLE_KEY + VAPID keys (push-server no-op tanpa itu)
 */

const MAX_PER_USER = 5

export async function GET(request: Request) {
  // Only Vercel Cron (or a caller with the secret) may trigger this.
  const auth = request.headers.get('authorization')
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Env-gate: cron cuma jalan di production (atau lokal saat dev/testing, di mana
  // VERCEL_ENV unset). Preview/branch deploy share env DB prod → jangan biarin
  // cron preview ngirim push ke device user beneran. [reliability-6]
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

  // Cuma user ber-subscription yang perlu discan — tanpa device, no-op.
  const { data: subRows, error: subErr } = await admin
    .from('push_subscriptions')
    .select('user_id')
  if (subErr) {
    return NextResponse.json({ error: subErr.message }, { status: 500 })
  }
  const userIds = [...new Set(((subRows ?? []) as { user_id: string }[]).map((r) => r.user_id))]
  if (userIds.length === 0) {
    return NextResponse.json({ ok: true, users: 0, sent: 0 })
  }

  // "Hari ini"/"besok" pakai kalender Asia/Jakarta (pola cron post-recurring).
  const todayISO = new Date().toLocaleDateString('sv', { timeZone: 'Asia/Jakarta' })
  const today = parseISODate(todayISO)!
  const tomorrow = new Date(today.getTime() + DAY_MS)
  // Awal hari Jakarta sebagai instant UTC — buat filter created_at transaksi.
  const jakartaDayStart = `${todayISO}T00:00:00+07:00`

  // Locale + preferensi per user (ternary teks notif).
  const { data: profRows } = await admin
    .from('profiles')
    .select('id, language, daily_reminder_enabled')
    .in('id', userIds)
  const profiles = new Map(
    ((profRows ?? []) as { id: string; language: string | null; daily_reminder_enabled: boolean | null }[])
      .map((p) => [p.id, p]),
  )
  const isEn = (userId: string) => profiles.get(userId)?.language === 'en'

  // Notif yang mau dikirim, dikumpulin per user dulu → cap MAX_PER_USER.
  const queue = new Map<string, PushPayload[]>()
  const push = (userId: string, payload: PushPayload) => {
    const list = queue.get(userId) ?? []
    list.push(payload)
    queue.set(userId, list)
  }

  // ── (a1) Recurring dengan occurrence BESOK ─────────────────────────────
  const { data: recRows } = await admin
    .from('recurring_transactions')
    .select('*')
    .eq('is_active', true)
    .in('user_id', userIds)
  const recurring = (recRows ?? []) as RecurringTransaction[]

  const dueTomorrow = recurring.filter((r) =>
    // Jendela [besok, besok] — occurrencesInRange sudah menghormati start/end_date.
    occurrencesInRange(r, tomorrow, 0).length > 0,
  )

  // Nama akun buat body notif ("Rp 150rb · BCA").
  const accountIds = [...new Set(dueTomorrow.map((r) => r.account_id).filter((id): id is string => !!id))]
  const accountName = new Map<string, string>()
  if (accountIds.length > 0) {
    const { data: accRows } = await admin.from('accounts').select('id, name').in('id', accountIds)
    for (const a of (accRows ?? []) as { id: string; name: string }[]) accountName.set(a.id, a.name)
  }

  for (const r of dueTomorrow) {
    const en = isEn(r.user_id)
    const acc = r.account_id ? accountName.get(r.account_id) : undefined
    push(r.user_id, {
      title: en ? `Tomorrow: ${r.name}` : `Besok: ${r.name}`,
      body: acc ? `${formatCompactCurrency(r.amount)} · ${acc}` : formatCompactCurrency(r.amount),
      url: '/dashboard/recurring',
      tag: `recurring-${r.id}`,
    })
  }

  // ── (a2) Kontrak berakhir dalam reminder_days_before hari ──────────────
  const horizonISO = new Date(today.getTime() + 365 * DAY_MS).toISOString().slice(0, 10)
  const { data: conRows } = await admin
    .from('contracts')
    .select('id, user_id, name, end_date, reminder_days_before')
    .eq('is_archived', false)
    .in('user_id', userIds)
    .gte('end_date', todayISO)
    .lte('end_date', horizonISO)
  for (const c of (conRows ?? []) as Array<{
    id: string
    user_id: string
    name: string
    end_date: string
    reminder_days_before: number
  }>) {
    const end = parseISODate(c.end_date)
    if (!end) continue
    const daysLeft = Math.round((end.getTime() - today.getTime()) / DAY_MS)
    if (daysLeft > (c.reminder_days_before ?? 30)) continue
    const en = isEn(c.user_id)
    push(c.user_id, {
      title: en ? `Expiring: ${c.name}` : `Segera berakhir: ${c.name}`,
      body: en
        ? daysLeft === 0 ? 'Ends today' : `${daysLeft} day${daysLeft > 1 ? 's' : ''} left`
        : daysLeft === 0 ? 'Berakhir hari ini' : `${daysLeft} hari lagi`,
      url: '/dashboard/contracts',
      tag: `contract-${c.id}`,
    })
  }

  // ── (b) Pengingat catat harian ──────────────────────────────────────────
  const reminderUsers = userIds.filter((id) => profiles.get(id)?.daily_reminder_enabled === true)
  for (const userId of reminderUsers) {
    // Belum ada transaksi yang DIBUAT hari ini (kalender Jakarta)?
    const { count, error: cntErr } = await admin
      .from('transactions')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', jakartaDayStart)
    if (cntErr || (count ?? 0) > 0) continue
    const en = isEn(userId)
    push(userId, {
      title: en ? 'No entries yet today' : 'Belum ada catatan hari ini',
      body: en ? 'Take a minute to log your transactions.' : 'Yuk, catat transaksi hari ini.',
      url: '/dashboard',
      tag: 'daily-reminder', // dedup — gak numpuk lintas hari
    })
  }

  // ── Kirim (cap per user, per-user try/catch) ────────────────────────────
  let sent = 0
  let gone = 0
  let capped = 0
  const errors: Array<{ userId: string; error: string }> = []

  for (const [userId, payloads] of queue) {
    const batch = payloads.slice(0, MAX_PER_USER)
    capped += payloads.length - batch.length
    try {
      for (const payload of batch) {
        const res = await sendPushToUser(admin, userId, payload)
        sent += res.sent
        gone += res.gone
      }
    } catch (err) {
      errors.push({ userId, error: err instanceof Error ? err.message : String(err) })
    }
  }

  return NextResponse.json({
    ok: true,
    date: todayISO,
    users: queue.size,
    bills: dueTomorrow.length,
    contracts: (conRows ?? []).length,
    sent,
    gone,
    capped,
    errors,
  })
}
