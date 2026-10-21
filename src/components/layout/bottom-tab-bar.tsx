'use client'

/**
 * Bottom tab bar — navigasi utama mobile (hidden md+).
 * 4 tab + FAB tengah. Tab "Lainnya" = Link ke /dashboard/more (layar
 * settings-style F9, ganti MoreSheet) → bottom-tab + halaman Lainnya
 * nge-cover SEMUA destinasi, jadi top-nav bisa di-slim di mobile.
 * Style: bilah docked mono — permukaan + hairline atas + safe-area. Aktif =
 * ink + label tebal (tanpa warna); tombol tengah = tombol primer bulat 44px.
 * Tap-target ≥ 44.
 */

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Receipt, Plus, Wallet, LayoutGrid } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useT } from '@/lib/i18n/context'

interface TabItem {
  href: string
  labelKey: string
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>
}

// 4 tab link + FAB tengah. "Lainnya" → /dashboard/more (grouped list).
const LEFT: TabItem[] = [
  { href: '/dashboard',              labelKey: 'bottom_tab.home',         icon: Home },
  { href: '/dashboard/transactions', labelKey: 'bottom_tab.transactions', icon: Receipt },
]
const RIGHT: TabItem[] = [
  { href: '/dashboard/budgeting',    labelKey: 'bottom_tab.budget',       icon: Wallet },
  { href: '/dashboard/more',         labelKey: 'nav.section.secondary',   icon: LayoutGrid },
]

function isActive(pathname: string, href: string): boolean {
  if (href === '/dashboard') return pathname === '/dashboard'
  return pathname === href || pathname.startsWith(href + '/')
}

function openQuickAdd() {
  window.dispatchEvent(new CustomEvent('klunting:quick-add'))
}

export function BottomTabBar() {
  const pathname = usePathname()
  const t = useT()

  return (
    <nav
      className="md:hidden fixed inset-x-0 bottom-0 z-30"
      style={{
        background: 'var(--surface)',
        borderTop: '1px solid var(--border)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
      aria-label={t('bottom_tab.nav_label')}
    >
      <div className="mx-auto grid max-w-md grid-cols-5 items-center h-14 px-1">
        {LEFT.map((tab) => (
          <TabLink key={tab.href} tab={tab} active={isActive(pathname, tab.href)} />
        ))}

        {/* Tombol tengah — buka quick-add sheet (foto struk / AI / form manual) */}
        <div className="flex justify-center">
          <button
            type="button"
            onClick={openQuickAdd}
            className="size-11 rounded-full flex items-center justify-center transition active:scale-95"
            style={{ background: 'var(--c-primary)', color: 'var(--c-primary-foreground)' }}
            aria-label={t('bottom_tab.add_transaction')}
          >
            <Plus className="size-5 stroke-[2.5]" />
          </button>
        </div>

        {RIGHT.map((tab) => (
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
      className="flex flex-col items-center justify-center gap-1 h-full min-h-11 transition-colors"
      style={{ color: active ? 'var(--ink)' : 'var(--ink-soft)' }}
    >
      <Icon className={cn('size-[22px]', active ? 'stroke-[2.25]' : 'stroke-[1.75]')} />
      <span className={cn('text-3xs leading-none', active ? 'font-semibold' : 'font-medium')}>
        {t(tab.labelKey)}
      </span>
    </Link>
  )
}
