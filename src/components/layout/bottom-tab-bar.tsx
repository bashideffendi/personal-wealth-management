'use client'

/**
 * Bottom tab bar — navigasi utama mobile (hidden md+).
 * 4 tab + FAB tengah. Tab "Lainnya" = Link ke /dashboard/more (layar
 * settings-style F9, ganti MoreSheet) → bottom-tab + halaman Lainnya
 * nge-cover SEMUA destinasi, jadi top-nav bisa di-slim di mobile.
 * Style: DOCK GELAP FLOATING ala app Budget iOS — pill #1c1c22 (sama di
 * dark mode), margin 14px, bottom 10px + safe-area. Aktif = ikon dibungkus
 * pill mint soft + label mint; FAB tengah lingkaran putih. Tap-target ≥44.
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
      className="md:hidden fixed z-30 mx-auto max-w-md rounded-[24px]"
      style={{
        left: 14,
        right: 14,
        bottom: 'calc(10px + env(safe-area-inset-bottom))',
        background: '#1c1c22',
        boxShadow: '0 10px 30px rgba(0,0,0,.25)',
      }}
      aria-label={t('bottom_tab.nav_label')}
    >
      <div className="grid grid-cols-5 items-center h-16 px-2">
        {LEFT.map((tab) => (
          <TabLink key={tab.href} tab={tab} active={isActive(pathname, tab.href)} />
        ))}

        {/* Center FAB — buka quick-add sheet (foto struk / AI / form manual) */}
        <div className="flex justify-center">
          <button
            type="button"
            onClick={openQuickAdd}
            className="size-[46px] rounded-full flex items-center justify-center transition active:scale-95"
            style={{
              background: '#fff',
              color: '#18181b',
              boxShadow: '0 4px 10px rgba(0,0,0,.25)',
            }}
            aria-label={t('bottom_tab.add_transaction')}
          >
            <Plus className="size-6 stroke-[2.5]" />
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
      className="flex flex-col items-center justify-center gap-0.5 h-full py-1.5 transition-colors"
      style={{ color: active ? '#3ad3a8' : '#8e8e98' }}
    >
      {/* Ikon dibungkus pill kecil — mint soft kalau aktif (dock selalu gelap,
          jadi warna hardcoded, bukan token tema) */}
      <span
        className="flex items-center justify-center rounded-full px-3.5 py-[3px] transition-colors"
        style={{ background: active ? 'rgba(23,184,144,.18)' : 'transparent' }}
      >
        <Icon className={cn('size-5', active && 'stroke-[2.25]')} />
      </span>
      <span className={cn('text-[10px] leading-tight', active && 'font-medium')}>
        {t(tab.labelKey)}
      </span>
    </Link>
  )
}
