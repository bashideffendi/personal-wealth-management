'use client'

/**
 * Bottom tab bar — mobile primary navigation.
 *
 * Visible on mobile only (hidden md+). 5-item iOS-style layout with
 * an elevated center "+" button that opens the QuickAddLauncher sheet
 * (foto struk / AI / form manual).
 */

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Receipt, Plus, Wallet, UserCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface TabItem {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string }>
}

const TABS: TabItem[] = [
  { href: '/dashboard',                 label: 'Beranda',   icon: Home },
  { href: '/dashboard/transactions',    label: 'Transaksi', icon: Receipt },
  // Center FAB is rendered separately
  { href: '/dashboard/budgeting',       label: 'Anggaran',  icon: Wallet },
  { href: '/dashboard/profile',         label: 'Profil',    icon: UserCircle },
]

function isActive(pathname: string, href: string): boolean {
  if (href === '/dashboard') return pathname === '/dashboard'
  return pathname === href || pathname.startsWith(href + '/')
}

function openQuickAdd() {
  // QuickAddLauncher listens for this event globally
  window.dispatchEvent(new CustomEvent('klunting:quick-add'))
}

export function BottomTabBar() {
  const pathname = usePathname()

  return (
    <nav
      className="md:hidden fixed bottom-0 inset-x-0 z-30 border-t pb-safe"
      style={{
        background: 'color-mix(in srgb, var(--surface) 90%, transparent)',
        borderColor: 'var(--border)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
      }}
      aria-label="Navigasi utama"
    >
      <div className="grid grid-cols-5 items-end h-16 max-w-md mx-auto px-2">
        {/* Left side: Beranda + Transaksi */}
        {TABS.slice(0, 2).map((tab) => (
          <TabLink key={tab.href} tab={tab} active={isActive(pathname, tab.href)} />
        ))}

        {/* Center FAB — buka quick-add sheet (foto struk / AI / form manual) */}
        <div className="flex justify-center">
          <button
            type="button"
            onClick={openQuickAdd}
            className="relative -translate-y-3 size-14 rounded-full flex items-center justify-center shadow-lg transition active:scale-95"
            style={{
              background: 'linear-gradient(135deg, #10B981, #047857)',
              color: '#FFFFFF',
              boxShadow: '0 8px 20px -4px rgba(16, 185, 129, 0.45)',
            }}
            aria-label="Tambah transaksi"
          >
            <Plus className="size-6 stroke-[2.5]" />
          </button>
        </div>

        {/* Right side: Anggaran + Profil */}
        {TABS.slice(2).map((tab) => (
          <TabLink key={tab.href} tab={tab} active={isActive(pathname, tab.href)} />
        ))}
      </div>
    </nav>
  )
}

function TabLink({ tab, active }: { tab: TabItem; active: boolean }) {
  const Icon = tab.icon
  return (
    <Link
      href={tab.href}
      className={cn(
        'flex flex-col items-center justify-center gap-0.5 h-full pt-2 pb-1 transition-colors relative',
      )}
      style={{ color: active ? 'var(--ink)' : 'var(--ink-soft)' }}
    >
      <Icon className={cn('size-5', active && 'stroke-[2.25]')} />
      <span className={cn('text-[10px] leading-tight', active && 'font-semibold')}>
        {tab.label}
      </span>
      {active && (
        <span
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: 0,
            left: '50%',
            transform: 'translateX(-50%)',
            width: 16,
            height: 2,
            borderRadius: '0 0 2px 2px',
            background: 'var(--c-primary)',
          }}
        />
      )}
    </Link>
  )
}
