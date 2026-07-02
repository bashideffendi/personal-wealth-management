/**
 * Logika threshold reminder trial/renewal — PURE (biar bisa di-unit-test tanpa
 * nyentuh Supabase/email server-only). Dipakai cron /api/cron/reminders.
 *
 * Klunting auto-renew OFF → nudge manual di H-14 / H-3 / H-0 sebelum expires_at.
 */

export const REMINDER_THRESHOLDS = [14, 3, 0] as const

/**
 * Selisih HARI KALENDER (bukan jam) dari `now` ke `expiresAt`, dibulatkan.
 * Date-only (buang komponen jam) supaya jam berapa cron jalan tidak menggeser
 * hasil — H-3 tetap H-3 walau cron jalan pagi vs malam.
 */
export function reminderDaysLeft(expiresAt: string | Date, now: Date): number {
  const exp = new Date(expiresAt)
  const expDay = Date.UTC(exp.getFullYear(), exp.getMonth(), exp.getDate())
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())
  return Math.round((expDay - today) / 86_400_000)
}

/** True kalau `daysLeft` tepat di salah satu threshold (H-14/3/0). */
export function shouldRemind(daysLeft: number): boolean {
  return (REMINDER_THRESHOLDS as readonly number[]).includes(daysLeft)
}
