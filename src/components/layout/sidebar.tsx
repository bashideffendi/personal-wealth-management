'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard, Receipt, Wallet, Building2, CreditCard, Shield,
  TrendingUp, ChevronDown, LogOut, Repeat, Target, Calculator,
  Coins, Clock, Sparkles, Gift, ListOrdered, Compass,
} from 'lucide-react'
import { NAV_ITEMS, NAV_SECTIONS, type NavItem } from '@/lib/constants'
import { createClient } from '@/lib/supabase/client'
import { useT } from '@/lib/i18n/context'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { User } from '@supabase/supabase-js'

// Icons are used only on top-level nav — sub-items are text-only (minimal).
const topIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  LayoutDashboard, Receipt, Wallet, Building2, CreditCard, Shield, TrendingUp,
  Repeat, Target, Calculator, Coins, Clock, Sparkles, Gift, ListOrdered, Compass,
}

interface SidebarProps {
  user: User
}

function matchesPath(pathname: string, href: string) {
  if (href === '/dashboard') return pathname === '/dashboard'
  return pathname === href || pathname.startsWith(href + '/')
}

function containsActive(item: NavItem, pathname: string): boolean {
  if (matchesPath(pathname, item.href)) return true
  return Boolean(item.children?.some((c) => containsActive(c, pathname)))
}

export function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const t = useT()

  const fullName =
    (user.user_metadata?.full_name as string) || user.email || 'Pengguna'
  const initials = fullName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  const [expanded, setExpanded] = useState<Set<string>>(() => {
    const s = new Set<string>()
    for (const item of NAV_ITEMS) {
      if (item.children && containsActive(item, pathname)) s.add(item.href)
      for (const c of item.children ?? []) {
        if (c.children && containsActive(c, pathname)) s.add(c.href)
      }
    }
    return s
  })

  useEffect(() => {
    setExpanded((prev) => {
      const next = new Set(prev)
      for (const item of NAV_ITEMS) {
        if (item.children && containsActive(item, pathname)) next.add(item.href)
        for (const c of item.children ?? []) {
          if (c.children && containsActive(c, pathname)) next.add(c.href)
        }
      }
      return next
    })
  }, [pathname])

  function toggle(href: string) {
    setExpanded((prev) => {
      const n = new Set(prev)
      if (n.has(href)) n.delete(href)
      else n.add(href)
      return n
    })
  }

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  function renderItem(item: NavItem, depth: number, parentKey = 'root') {
    const hasChildren = !!item.children?.length
    const active = matchesPath(pathname, item.href)
    const open = expanded.has(item.href)
    const Icon = depth === 0 ? topIcons[item.icon] : undefined

    return (
      <div key={`${parentKey}>${item.href}`} className="select-none">
        <div className={cn('group relative flex items-center', depth === 0 ? 'py-0.5' : 'py-0')}>
          <Link
            href={item.href}
            className={cn(
              'flex flex-1 items-center gap-2.5 rounded-md transition-colors',
              depth === 0 ? 'px-3 py-2 text-[13.5px]' : 'px-3 py-1.5 text-[13px]',
              active
                ? 'text-white font-medium bg-[#27272A]'
                : 'text-[#A1A1AA] hover:text-white hover:bg-[#18181B]',
            )}
          >
            {active && depth === 0 && (
              <span
                className="absolute left-0 top-1/2 h-4 w-[2px] -translate-y-1/2 rounded-r"
                style={{ background: 'var(--lime-400)' }}
              />
            )}
            {Icon && (
              <Icon
                className={cn(
                  'h-4 w-4 shrink-0',
                  active ? 'text-white' : 'text-[#71717A]',
                )}
              />
            )}
            <span className="truncate">{item.titleKey ? t(item.titleKey) : item.label}</span>
          </Link>
          {hasChildren && (
            <button
              type="button"
              onClick={() => toggle(item.href)}
              className={cn(
                'ml-1 flex h-7 w-7 items-center justify-center rounded-md',
                'text-[#71717A] hover:text-white hover:bg-[#18181B]',
              )}
              aria-label={open ? 'Tutup' : 'Buka'}
            >
              <ChevronDown
                className={cn('h-3.5 w-3.5 transition-transform', open && 'rotate-180')}
              />
            </button>
          )}
        </div>

        {hasChildren && open && (
          <div className="ml-5 mt-0.5 pl-3 border-l border-[rgba(255,255,255,0.08)] space-y-0.5">
            {item.children!.map((c) => renderItem(c, depth + 1, item.href))}
          </div>
        )}
      </div>
    )
  }

  return (
    <aside className="hidden md:flex md:w-64 md:flex-col">
      <div
        className="flex flex-1 flex-col"
        style={{ background: '#09090B' }}
      >
        {/* Brand — minimal wordmark */}
        <div className="px-5 py-5 border-b border-[rgba(255,255,255,0.06)]">
          <p
            className="text-[10px] uppercase tracking-[0.24em] font-medium"
            style={{ color: '#71717A' }}
          >
            Personal
          </p>
          <p
            className="text-base font-semibold text-white mt-0.5 flex items-center gap-2"
          >
            Wealth
            <span
              className="inline-block h-1.5 w-1.5 rounded-full"
              style={{ background: 'var(--lime-400)' }}
            />
            <span style={{ color: '#71717A' }} className="text-sm font-normal">Management</span>
          </p>
        </div>

        {/* Nav — grouped by section */}
        <nav className="flex-1 overflow-y-auto px-2.5 py-3">
          {NAV_SECTIONS.map((sec) => {
            const items = NAV_ITEMS.filter((it) => it.section === sec.key)
            if (items.length === 0) return null
            const sectionLabel = t(sec.titleKey)
            return (
              <div key={sec.key} className="mb-3 last:mb-0">
                {sectionLabel && (
                  <p
                    className="px-3 pt-2 pb-1 text-[10px] uppercase tracking-[0.14em] font-semibold"
                    style={{ color: '#52525B' }}
                  >
                    {sectionLabel}
                  </p>
                )}
                <div className="space-y-0.5">
                  {items.map((item) => renderItem(item, 0))}
                </div>
              </div>
            )
          })}
        </nav>

        {/* User */}
        <div className="border-t border-[rgba(255,255,255,0.06)] p-3">
          <div className="flex items-center gap-3 rounded-md p-2 hover:bg-[#18181B] transition-colors">
            <Avatar size="sm">
              <AvatarFallback
                className="text-[11px] font-semibold"
                style={{ background: 'var(--lime-400)', color: 'var(--black)' }}
              >
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 truncate">
              <p className="truncate text-[13px] font-medium text-white">
                {fullName}
              </p>
              <p className="truncate text-[11px]" style={{ color: '#71717A' }}>
                {user.email}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={handleLogout}
              className="text-[#71717A] hover:bg-[#27272A] hover:text-[#F87171]"
              aria-label="Keluar"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </aside>
  )
}
