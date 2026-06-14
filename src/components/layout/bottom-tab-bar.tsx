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
import { useT } from '@/lib/i18n/context'

interface TabItem {
  href: string
  labelKey: string
  icon: React.ComponentType<{ className?: string }>
}

const TABS: TabItem[] = [
  { href: '/dashboard',                 labelKey: 'bottom_tab.home',         icon: Home },
  { href: '/dashboard/transactions',    labelKey: 'bottom_tab.transactions', icon: Receipt },
  // Center FAB is rendered separately
  { href: '/dashboard/budgeting',       labelKey: 'bottom_tab.budget',       icon: Wallet },
  { href: '/dashboard/profile',         labelKey: 'bottom_tab.profile',      icon: UserCircle },
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
  const t = useT()

  return (
    <nav
      className="md:hidden fixed bottom-0 inset-x-0 z-30 border-t pb-safe"
      style={{
        background: 'color-mix(in srgb, var(--surface) 90%, transparent)',
        borderColor: 'var(--border)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
      }}
      aria-label={t('bottom_tab.nav_label')}
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
            className="relative -translate-y-3 size-14 rounded-full flex items-center justify-center shadow-[var(--card-shadow)] transition active:scale-95"
            style={{
              background: 'var(--c-primary)',
              color: 'var(--c-primary-foreground)',
              boxShadow: 'var(--card-shadow)',
            }}
            aria-label={t('bottom_tab.add_transaction')}
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
  const t = useT()
  return (
    <Link
      href={tab.href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex flex-col items-center justify-center gap-0.5 h-full pt-2 pb-1 transition-colors relative',
      )}
      style={{ color: active ? 'var(--ink)' : 'var(--ink-soft)' }}
    >
      <Icon className={cn('size-5', active && 'stroke-[2.25]')} />
      <span className={cn('text-[10px] leading-tight', active && 'font-semibold')}>
        {t(tab.labelKey)}
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
