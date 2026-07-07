import 'server-only'
import webpush from 'web-push'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Web Push — helper sisi SERVER.
 *
 * sendPushToUser(admin, userId, payload): kirim notif ke SEMUA device user
 * (satu user bisa punya banyak subscription — HP + laptop). Dipanggil dari
 * route cron / server action pakai admin client (service-role) karena
 * pengirim bukan si user (RLS bypass memang disengaja di sini).
 *
 * Subscription mati (endpoint balas 404/410 Gone — user cabut izin /
 * uninstall PWA) langsung dihapus dari tabel biar gak dikirimi terus.
 * Payload di-parse public/sw.js (event 'push').
 */

export interface PushPayload {
  title: string
  body: string
  /** Tujuan saat notif diklik — default /dashboard (lihat sw.js). */
  url?: string
  /** Dedup — notif baru dengan tag sama menggantikan yang lama. */
  tag?: string
}

let vapidConfigured = false

function ensureVapid(): boolean {
  if (vapidConfigured) return true
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  const subject = process.env.VAPID_SUBJECT ?? 'mailto:bashide@gmail.com'
  if (!publicKey || !privateKey) return false
  webpush.setVapidDetails(subject, publicKey, privateKey)
  vapidConfigured = true
  return true
}

export interface SendPushResult {
  /** Jumlah notif sukses terkirim. */
  sent: number
  /** Jumlah subscription mati (404/410) yang dihapus dari tabel. */
  gone: number
}

export async function sendPushToUser(
  admin: SupabaseClient,
  userId: string,
  payload: PushPayload,
): Promise<SendPushResult> {
  if (!ensureVapid()) return { sent: 0, gone: 0 }

  const { data, error } = await admin
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth')
    .eq('user_id', userId)
  // Tabel belum ada (pre-migrasi 063) / error lain → no-op aman.
  if (error || !data || data.length === 0) return { sent: 0, gone: 0 }

  const body = JSON.stringify(payload)
  let sent = 0
  const goneEndpoints: string[] = []

  await Promise.all(
    (data as { endpoint: string; p256dh: string; auth: string }[]).map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          body,
        )
        sent++
      } catch (err) {
        const statusCode = (err as { statusCode?: number }).statusCode
        if (statusCode === 404 || statusCode === 410) {
          goneEndpoints.push(sub.endpoint)
        }
        // Error lain (429/5xx push service) — biarin, coba lagi di kirim berikutnya.
      }
    }),
  )

  if (goneEndpoints.length > 0) {
    await admin.from('push_subscriptions').delete().in('endpoint', goneEndpoints)
  }

  return { sent, gone: goneEndpoints.length }
}
