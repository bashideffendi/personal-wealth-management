import type { SupabaseClient } from '@supabase/supabase-js'

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
