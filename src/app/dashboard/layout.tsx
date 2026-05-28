import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { TopNav } from '@/components/layout/top-nav'
import { QuickAddLauncher } from '@/components/layout/quick-add-launcher'
import { CommandPalette } from '@/components/layout/command-palette'
import { BottomTabBar } from '@/components/layout/bottom-tab-bar'
import { InstallPrompt } from '@/components/layout/install-prompt'

/**
 * Dashboard layout — editorial top-nav variant (2026-05-28 redesign).
 *
 * Layout pattern berubah: sidebar dihapus, TopNav horizontal jadi shell
 * utama. Konten halaman scroll vertikal di main (bukan flex column
 * dengan sidebar di kiri). Mobile dapet hamburger di TopNav + bottom
 * tab bar tetap untuk quick-access daily-use.
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

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: 'var(--bg)' }}
    >
      <TopNav user={user} />
      <main
        className="flex-1 px-4 md:px-8 pt-6 md:pt-7 pb-24 md:pb-16"
        style={{ background: 'var(--bg)' }}
      >
        <div className="mx-auto" style={{ maxWidth: 1400 }}>
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
