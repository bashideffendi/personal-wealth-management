import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { OnboardingWizard } from '@/components/onboarding/onboarding-wizard'

export const metadata: Metadata = {
  title: 'Selamat datang',
}

/**
 * /onboarding — wizard first-run (fokus → akun → kategori → selesai).
 *
 * Server guard di sini cuma soal "boleh masuk?". Logika langkah ada di
 * <OnboardingWizard /> (client). Gating MASUK ke sini ada di dashboard
 * layout (user baru tanpa akun + onboarding_focus null).
 *
 * Resilient: kalau kolom onboarding_focus belum ada (sebelum migrasi 039),
 * profRes.error → `focus` undefined → gak redirect, wizard tetap tampil.
 * Wizard nyimpen flag-nya best-effort, jadi gak akan loop.
 */
export default async function OnboardingPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const profRes = await supabase
    .from('profiles')
    .select('full_name, onboarding_focus')
    .eq('id', user.id)
    .maybeSingle()

  const data = profRes.data as { full_name: string | null; onboarding_focus: string[] | null } | null
  // Sudah pernah lewat wizard → ke dashboard (jangan suruh ulang).
  if (!profRes.error && data && data.onboarding_focus != null) redirect('/dashboard')

  const fullName = data?.full_name ?? ''
  const firstName = fullName.trim().split(/\s+/)[0] ?? ''

  return <OnboardingWizard firstName={firstName} />
}
