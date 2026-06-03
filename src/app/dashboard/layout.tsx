import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { TopNav } from '@/components/layout/top-nav'
import { QuickAddLauncher } from '@/components/layout/quick-add-launcher'
import { CommandPalette } from '@/components/layout/command-palette'
import { BottomTabBar } from '@/components/layout/bottom-tab-bar'
import { InstallPrompt } from '@/components/layout/install-prompt'

/**
 * Dashboard layout — fintech top-nav shell.
 *
 * Sidebar dihapus, TopNav horizontal jadi shell utama. Konten halaman
 * scroll vertikal di main. Mobile dapet hamburger di TopNav + bottom
 * tab bar untuk quick-access daily-use.
 */
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // Onboarding gate — user benar-benar baru (belum punya akun + belum pernah
  // lewat wizard) diarahin ke /onboarding. Resilient: kalau kolom
  // onboarding_focus belum ada (sebelum migrasi 039) query-nya error → kita
  // gak nge-gate, dashboard tetap normal. Cek akun dulu (HEAD count, murah);
  // user yang udah punya akun gak pernah kena query profil.
  {
    const accRes = await supabase
      .from('accounts')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
    if ((accRes.count ?? 0) === 0) {
      const profRes = await supabase
        .from('profiles')
        .select('onboarding_focus')
        .eq('id', user.id)
        .maybeSingle()
      const focus = (profRes.data as { onboarding_focus: string[] | null } | null)?.onboarding_focus
      if (!profRes.error && profRes.data && focus == null) {
        redirect('/onboarding')
      }
    }
  }

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: 'var(--bg)' }}
    >
      <TopNav user={user} />
      <main
        className="flex-1 pt-6 md:pt-7 pb-24 md:pb-16"
        style={{ background: 'var(--bg)' }}
      >
        {/* px di div mx-auto ini (bukan di <main>) biar persis kayak container
            TopNav — garis kiri logo, "Hi, Bashid", & kartu hero rata semua. */}
        <div className="mx-auto px-4 md:px-8" style={{ maxWidth: 1400 }}>
          {children}
        </div>
      </main>
      {/* QuickAddLauncher — renders FAB on desktop, listens to klunting:quick-add
          event on mobile (fired from BottomTabBar center button + TopNav +). */}
      <div className="hidden md:block">
        <QuickAddLauncher variant="desktop" />
      </div>
      <div className="md:hidden">
        <QuickAddLauncher variant="mobile" />
      </div>
      <CommandPalette />
      <BottomTabBar />
      <InstallPrompt />
    </div>
  )
}
