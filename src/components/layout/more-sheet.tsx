'use client'

/**
 * MoreSheet — bottom-sheet "Lainnya" buat nav sekunder di mobile.
 * Dibuka dari tab "Lainnya" di BottomTabBar. Cover semua destinasi yang
 * gak muat di 4 tab utama (Investasi/Kekayaan/Tujuan/Keluarga + tools +
 * Profil) → jadi top-nav bisa di-slim di mobile (gak ada dua permukaan nav).
 */

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  TrendingUp, Building2, Target, Home, Repeat, FileText, FileClock,
  Calculator, Compass, Sparkles, UserCircle, type LucideIcon,
} from 'lucide-react'
import { BottomSheet } from '@/components/ui/bottom-sheet'
import { NAV_ITEMS } from '@/lib/constants'
import { useT } from '@/lib/i18n/context'

const ICONS: Record<string, LucideIcon> = {
  TrendingUp, Building2, Target, Home, Repeat, FileText, FileClock,
  Calculator, Compass, Sparkles, UserCircle,
}

// Destinasi yang udah jadi tab utama (jangan diulang di sheet).
const TAB_HREFS = new Set([
  '/dashboard',
  '/dashboard/transactions',
  '/dashboard/budgeting',
])

type SheetItem = { href: string; titleKey?: string; label: string; icon: string }

const PRIMARY: SheetItem[] = NAV_ITEMS
  .filter((it) => it.section === 'primary' && !TAB_HREFS.has(it.href) && it.href !== '/dashboard/net-worth')
  .map((it) => ({ href: it.href, titleKey: it.titleKey, label: it.label, icon: it.icon }))

// Anak-anak "Kekayaan" (Net Worth, Akun, Aset Likuid/Non-Likuid, Utang, Kartu
// Kredit, Dana Darurat) — di mobile gak muat jadi tab & tadinya gak ke-surface
// di sheet sama sekali (Utang dll jadi susah dijangkau). Munculin di sini.
const WEALTH_PARENT = NAV_ITEMS.find((it) => it.href === '/dashboard/net-worth')
const WEALTH: SheetItem[] = (WEALTH_PARENT?.children ?? []).map((c) => ({
  href: c.href, titleKey: c.titleKey, label: c.label, icon: 'Building2',
}))

const SECONDARY: SheetItem[] = NAV_ITEMS
  .filter((it) => it.section === 'secondary')
  .map((it) => ({ href: it.href, titleKey: it.titleKey, label: it.label, icon: it.icon }))

const ACCOUNT: SheetItem[] = [
  { href: '/dashboard/profile', label: 'Profil', icon: 'UserCircle' },
]

function matchesPath(pathname: string, href: string) {
  if (href === '/dashboard') return pathname === '/dashboard'
  return pathname === href || pathname.startsWith(href + '/')
}

export function MoreSheet({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const pathname = usePathname()
  const t = useT()

  function Section({ label, items }: { label: string; items: SheetItem[] }) {
    return (
      <div className="mb-3">
        <p
          className="px-1 pb-1.5 text-[11px] font-semibold uppercase tracking-wide"
          style={{ color: 'var(--text-faint)' }}
        >
          {label}
        </p>
        <div className="grid grid-cols-2 gap-2">
          {items.map((it) => {
            const Icon = ICONS[it.icon] ?? Sparkles
            const active = matchesPath(pathname, it.href)
            return (
              <Link
                key={it.href}
                href={it.href}
                aria-current={active ? 'page' : undefined}
                onClick={() => onOpenChange(false)}
                className="flex items-center gap-2.5 px-3 rounded-xl transition-colors"
                style={{
                  minHeight: 52,
                  border: '0.5px solid var(--border)',
                  background: active ? 'var(--c-mint-soft)' : 'var(--surface)',
                }}
              >
                <Icon
                  className="size-[18px] shrink-0"
                  style={{ color: active ? 'var(--accent, var(--c-mint))' : 'var(--ink-soft)' }}
                />
                <span
                  className="text-[14px] leading-tight"
                  style={{
                    color: active ? 'var(--c-mint-ink)' : 'var(--ink)',
                    fontWeight: active ? 600 : 500,
                  }}
                >
                  {it.titleKey ? t(it.titleKey) : it.label}
                </span>
              </Link>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <BottomSheet open={open} onOpenChange={onOpenChange} title={t('nav.menu')}>
      <div className="pt-1">
        <Section label={t('nav.section.main')} items={PRIMARY} />
        <Section label={t('nav.wealth')} items={WEALTH} />
        <Section label={t('nav.section.secondary')} items={SECONDARY} />
        <Section label="Akun" items={ACCOUNT} />
      </div>
    </BottomSheet>
  )
}
