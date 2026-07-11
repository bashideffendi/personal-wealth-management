import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { sendPushToUser, type PushPayload } from '@/lib/push-server'

/**
 * Notifikasi — helper sisi SERVER (inbox in-app + Web Push sekaligus).
 *
 * notifyUser(admin, userId, payload): insert ke public.notifications
 * (migrasi 067, sumber data bell di top nav) lalu kirim push ke semua
 * device user via sendPushToUser. Dipanggil dari route cron / server
 * action pakai admin client (service-role) — penulis notif memang bukan
 * si user, RLS bypass disengaja (tabel tanpa policy insert).
 *
 * DEFENSIF (migrasi 067 boleh belum diapply):
 *  - Tabel belum ada (42P01) / error insert lain → lanjut diam ke push,
 *    fitur tetap jalan lewat push saja.
 *  - Duplikat tag unread (23505, unique partial index) → alert ber-tag
 *    sama masih nangkring unread di inbox; SKIP push juga biar user gak
 *    di-spam notif yang sama tiap run cron. Ini memang gunanya dedup.
 */

export interface NotifyPayload {
  title: string
  body?: string
  /** Tujuan saat notif diklik — relatif app, mis. /dashboard/... */
  url?: string
  /** Dedup — selama notif ber-tag sama masih unread, kiriman baru di-skip. */
  tag?: string
}

export interface NotifyResult {
  /** Baris inbox berhasil ditulis. */
  inserted: boolean
  /** Ke-dedup (tag sama masih unread) — insert & push sama-sama di-skip. */
  deduped: boolean
  /** Jumlah push sukses terkirim (0 kalau user gak punya subscription). */
  pushSent: number
}

export async function notifyUser(
  admin: SupabaseClient,
  userId: string,
  payload: NotifyPayload,
): Promise<NotifyResult> {
  let inserted = false

  try {
    const { error } = await admin.from('notifications').insert({
      user_id: userId,
      title: payload.title,
      body: payload.body ?? null,
      url: payload.url ?? null,
      tag: payload.tag ?? null,
    })
    if (!error) {
      inserted = true
    } else if (error.code === '23505') {
      // Duplikat tag unread → alert-nya masih ada di inbox, jangan spam push.
      return { inserted: false, deduped: true, pushSent: 0 }
    }
    // Error lain (42P01 tabel belum ada, dll) → lanjut diam ke push.
  } catch {
    // Jaring terakhir — notif gak boleh ngejatuhin caller (cron).
  }

  const push: PushPayload = {
    title: payload.title,
    body: payload.body ?? '',
    url: payload.url,
    tag: payload.tag,
  }
  const res = await sendPushToUser(admin, userId, push)
  return { inserted, deduped: false, pushSent: res.sent }
}
