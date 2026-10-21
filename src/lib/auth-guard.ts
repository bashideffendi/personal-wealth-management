import type { SupabaseClient } from '@supabase/supabase-js'
import { createHash, timingSafeEqual } from 'node:crypto'

/**
 * needsStepUp — true kalau user SUDAH enroll 2FA (authenticator) tapi sesi ini
 * masih AAL1 (baru password, belum masukin kode TOTP).
 *
 * Kenapa ada: enforcement 2FA di dashboard layout (redirect ke /login) TIDAK
 * menutup pemanggilan API route langsung — supabase.auth.getUser() tetap
 * mengembalikan user pada sesi AAL1. Jadi route sensitif (export-data,
 * delete-account) harus cek step-up sendiri. Fail-open: kalau lookup AAL error,
 * kembalikan false (jangan kunci user gara-gara error transient).
 */
export async function needsStepUp(supabase: SupabaseClient): Promise<boolean> {
  try {
    const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
    return !!data && data.currentLevel === 'aal1' && data.nextLevel === 'aal2'
  } catch {
    return false
  }
}

/**
 * Verifikasi header `Authorization: Bearer $CRON_SECRET` untuk route cron.
 * Fail-closed: env kosong → selalu false. Perbandingan constant-time (hash
 * SHA-256 kedua sisi dulu supaya panjang sama → timingSafeEqual tidak throw
 * dan panjang secret tidak bocor lewat timing).
 */
export function verifyCronAuth(authHeader: string | null, secret = process.env.CRON_SECRET): boolean {
  if (!secret || !authHeader) return false
  const a = createHash('sha256').update(authHeader).digest()
  const b = createHash('sha256').update(`Bearer ${secret}`).digest()
  return timingSafeEqual(a, b)
}

/**
 * Origin tepercaya untuk link yang DIKIRIM KE ORANG LAIN (email undangan,
 * redirect sukses pembayaran). JANGAN pakai header `Origin` request: pemanggil
 * bisa set bebas (curl) → email resmi Klunting berisi link ke domain phishing.
 * Urutan: NEXT_PUBLIC_SITE_URL → origin URL request (Host divalidasi platform)
 * → default produksi.
 */
export function trustedOrigin(reqUrl?: string): string {
  const site = process.env.NEXT_PUBLIC_SITE_URL
  if (site) {
    try {
      return new URL(site).origin
    } catch {
      /* env rusak → lanjut fallback */
    }
  }
  if (reqUrl) {
    try {
      return new URL(reqUrl).origin
    } catch {
      /* ignore */
    }
  }
  return 'https://klunting.com'
}

// Server (cron push-reminders/watchlist-alerts) nanti POST ke endpoint ini →
// tanpa allowlist, user bisa mendaftarkan URL https sembarang (blind SSRF dari
// infrastruktur kita). Batasi ke push service browser utama.
const PUSH_HOST_SUFFIXES = [
  'fcm.googleapis.com',            // Chrome, Edge-Chromium (sebagian), Opera, Samsung
  'push.services.mozilla.com',     // Firefox
  'push.apple.com',                // Safari / iOS PWA
  'notify.windows.com',            // Edge (WNS)
]

export function isKnownPushEndpoint(raw: string): boolean {
  let u: URL
  try {
    u = new URL(raw)
  } catch {
    return false
  }
  if (u.protocol !== 'https:' || u.port !== '' || u.username || u.password) return false
  const host = u.hostname.toLowerCase()
  return PUSH_HOST_SUFFIXES.some((sfx) => host === sfx || host.endsWith(`.${sfx}`))
}
